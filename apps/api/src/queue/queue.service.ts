import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { REDIS_CONFIG, QueueJobPayload, VIDEO_PROCESSING_QUEUE } from '@viralforge/shared';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queue = new Queue<QueueJobPayload>(VIDEO_PROCESSING_QUEUE, {
    connection: REDIS_CONFIG,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });

  async addVideoProcessingJob(payload: Extract<QueueJobPayload, { jobType?: 'PROCESS_PROJECT' }>) {
    const data = { ...payload, jobType: 'PROCESS_PROJECT' as const };
    return this.addUnique('process-video', data, {
      jobId: `project:${payload.projectId}:process`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async addClipRenderJob(payload: Extract<QueueJobPayload, { jobType: 'RENDER_CLIP' }>) {
    return this.addUnique('render-clip', payload, {
      jobId: `clip:${payload.clipId}:render`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
  }

  async addRetranscribeJob(payload: Extract<QueueJobPayload, { jobType: 'RETRANSCRIBE_CLIP' }>) {
    return this.addUnique('retranscribe-clip', payload, {
      jobId: `clip:${payload.clipId}:retranscribe`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
  }

  async addPublishJob(payload: Extract<QueueJobPayload, { jobType: 'PUBLISH_CLIP' }>) {
    return this.addUnique('publish-clip', payload, {
      jobId: `clip:${payload.clipId}:publish:${payload.socialAccountId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async addRenderBulkItemJob(payload: Extract<QueueJobPayload, { jobType: 'RENDER_BULK_ITEM' }>) {
    const jobId = `bulk-item:${payload.itemId}:render`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      } else {
        return existing;
      }
    }
    return this.queue.add('render-bulk-item', payload, {
      jobId,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });
  }

  async addListChannelVideosJob(payload: Extract<QueueJobPayload, { jobType: 'LIST_CHANNEL_VIDEOS' }>) {
    // "Ver mais" reenfileira o MESMO requestId — precisa remover o job
    // anterior (que já terminou completed/failed) antes de adicionar de novo,
    // senão o BullMQ ignora silenciosamente por causa do jobId duplicado.
    const jobId = `channel-import:${payload.requestId}:list`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      } else {
        return existing;
      }
    }
    return this.queue.add('list-channel-videos', payload, {
      jobId,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });
  }

  private async addUnique(
    name: 'process-video' | 'render-clip' | 'publish-clip' | 'retranscribe-clip',
    payload: Extract<QueueJobPayload, { projectId: string }>,
    options: { jobId: string; attempts: number; backoff: { type: 'exponential'; delay: number } },
  ) {
    const existing = await this.queue.getJob(options.jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      } else {
        this.logger.log({
          msg: 'Job duplicado ignorado por já estar em processamento/fila',
          name,
          jobId: options.jobId,
          state,
          projectId: payload.projectId,
          clipId: (payload as { clipId?: string }).clipId,
        });
        return existing;
      }
    }
    this.logger.log({
      msg: 'Enfileirando job',
      name,
      jobId: options.jobId,
      projectId: payload.projectId,
      clipId: (payload as { clipId?: string }).clipId,
    });
    return this.queue.add(name, payload, options);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
