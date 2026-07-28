import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker, Queue } from 'bullmq';
import { createRedisConnectionConfig, QueueJobPayload, VIDEO_PROCESSING_QUEUE, validateJobPayload } from '@viralforge/shared';
import { jobsTotal, queueDepth } from './metrics.js';
import { VideoProcessorService } from './services/video-processor.service.js';

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const DLQ_NAME = `${VIDEO_PROCESSING_QUEUE}-dlq`;

@Injectable()
export class WorkerRunner implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerRunner.name);
  private worker?: Worker<QueueJobPayload>;
  private dlq?: Queue;
  private metricsQueue?: Queue;
  private metricsTimer?: NodeJS.Timeout;

  constructor(private readonly processor: VideoProcessorService) {}

  async start() {
    const concurrency = positiveInt(process.env.WORKER_CONCURRENCY, 1);

    this.dlq = new Queue(DLQ_NAME, {
      connection: createRedisConnectionConfig(),
    });

    this.worker = new Worker<QueueJobPayload>(
      VIDEO_PROCESSING_QUEUE,
      async (job) => {
        const validation = validateJobPayload(job.data);
        if (!validation.valid) {
          this.logger.warn({
            msg: `Job rejeitado: ${validation.error}`,
            jobId: job.id,
            payload: job.data,
          });
          // Payload inválido é contrato quebrado entre API e worker: vai para a
          // DLQ e falha explicitamente — nunca "conclui" em silêncio.
          await this.dlq?.add(
            job.name ?? 'invalid-payload',
            {
              ...(typeof job.data === 'object' && job.data ? job.data : {}),
              _originalJobId: job.id,
              _invalidPayload: validation.error,
              _failedAt: new Date().toISOString(),
            },
            { removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
          );
          await job.discard();
          throw new Error(`Payload inválido: ${validation.error}`);
        }

        this.logger.log({
          msg: 'Processando job',
          jobId: job.id,
          projectId: 'projectId' in job.data ? job.data.projectId : undefined,
          userId: job.data.userId,
          jobType: (job.data as Record<string, unknown>).jobType ?? 'PROCESS_PROJECT',
        });

        await this.processor.process(validation.data, job.id ?? 'unknown');
      },
      {
        connection: createRedisConnectionConfig(),
        concurrency,
        stalledInterval: 30000,
        lockDuration: 60000,
      },
    );

    this.worker.on('completed', (job) => {
      jobsTotal.inc({ type: job.name ?? 'unknown', status: 'completed' });
      this.logger.log({
        msg: 'Job completed',
        jobId: job.id,
        projectId: (job.data as Record<string, unknown>).projectId,
      });
    });

    this.worker.on('failed', async (job, error) => {
      jobsTotal.inc({ type: job?.name ?? 'unknown', status: 'failed' });
      this.logger.error({
        msg: 'Job failed',
        jobId: job?.id,
        projectId: job ? (job.data as Record<string, unknown>).projectId : undefined,
        error: error.message,
        attempts: job?.attemptsMade,
      });

      if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
        const safeData = job.data
          ? { ...job.data as Record<string, unknown>, _originalJobId: job.id, _failedAt: new Date().toISOString() }
          : { _originalJobId: job.id, _failedAt: new Date().toISOString() };
        await this.dlq?.add(
          job.name,
          safeData,
          { removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
        );
        jobsTotal.inc({ type: job.name ?? 'unknown', status: 'dlq' });
        this.logger.warn({
          msg: 'Job moved to DLQ after exhausting retries',
          jobId: job.id,
          projectId: job.data ? (job.data as Record<string, unknown>).projectId : undefined,
          dlq: DLQ_NAME,
        });
      }
    });

    this.worker.on('error', (error) => {
      this.logger.error({ msg: `BullMQ error: ${error.message}` });
    });

    this.startQueueDepthSampler();

    this.logger.log({
      msg: `Worker listening on ${VIDEO_PROCESSING_QUEUE} with concurrency=${concurrency}, DLQ=${DLQ_NAME}`,
    });
  }

  /**
   * Amostra a profundidade da fila periodicamente. É o sinal que antecipa
   * saturação (backlog crescendo) e DLQ enchendo — antes do usuário reclamar.
   */
  private startQueueDepthSampler() {
    const intervalMs = positiveInt(process.env.QUEUE_METRICS_INTERVAL_MS, 15_000);
    const queue = new Queue(VIDEO_PROCESSING_QUEUE, { connection: createRedisConnectionConfig() });
    this.metricsQueue = queue;

    const sample = async () => {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        for (const [state, value] of Object.entries(counts)) {
          queueDepth.set({ state }, Number(value) || 0);
        }
        queueDepth.set({ state: 'dlq' }, (await this.dlq?.getJobCounts('waiting'))?.waiting ?? 0);
      } catch (error) {
        this.logger.warn({ msg: 'Falha ao amostrar profundidade da fila', error: (error as Error).message });
      }
    };

    void sample();
    this.metricsTimer = setInterval(() => void sample(), intervalMs);
    // Não segura o processo vivo só por causa da métrica.
    this.metricsTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    await this.metricsQueue?.close();
    await this.worker?.close();
    await this.dlq?.close();
  }
}
