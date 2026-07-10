import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker, Queue } from 'bullmq';
import { createRedisConnectionConfig, QueueJobPayload, VIDEO_PROCESSING_QUEUE, validateJobPayload } from '@viralforge/shared';
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
          await job.discard();
          return;
        }

        this.logger.log({
          msg: 'Processando job',
          jobId: job.id,
          projectId: job.data.projectId,
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
      this.logger.log({
        msg: 'Job completed',
        jobId: job.id,
        projectId: (job.data as Record<string, unknown>).projectId,
      });
    });

    this.worker.on('failed', async (job, error) => {
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

    this.logger.log({
      msg: `Worker listening on ${VIDEO_PROCESSING_QUEUE} with concurrency=${concurrency}, DLQ=${DLQ_NAME}`,
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.dlq?.close();
  }
}
