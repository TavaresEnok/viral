import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './services/prisma.service.js';
import { ApiKeyService } from './services/api-key.service.js';
import { ClipValidationService } from './services/clip-validation.service.js';
import { ClipPersistenceService } from './services/clip-persistence.service.js';
import { FfmpegService } from './services/ffmpeg.service.js';
import { GpuCapabilityService } from './services/gpu-capability.service.js';
import { PipelineMetricsService } from './services/pipeline-metrics.service.js';
import { RemoteRenderingService } from './services/remote-rendering.service.js';
import { RenderingService } from './services/rendering.service.js';
import { RenderOrchestrationService } from './services/render-orchestration.service.js';
import { RemotionRenderService } from './services/remotion-render.service.js';
import { SubtitleService } from './services/subtitle.service.js';
import { TranscriptionService } from './services/transcription.service.js';
import { TranscriptOrchestrationService } from './services/transcript-orchestration.service.js';
import { VideoProcessorService } from './services/video-processor.service.js';
import { YoutubeDownloadService } from './services/youtube-download.service.js';
import { YoutubePublishService } from './services/youtube-publish.service.js';
import { TikTokPublishService } from './services/tiktok-publish.service.js';
import { InstagramPublishService } from './services/instagram-publish.service.js';
import { SchedulerService } from './services/scheduler.service.js';
import { OverlayBuilderService } from './services/overlay-builder.service.js';
import { BrollService } from './services/broll.service.js';
import { BrollPlanService } from './services/broll-plan.service.js';
import { BulkCaptionRenderService } from './services/bulk-caption-render.service.js';
import { ChannelImportService } from './services/channel-import.service.js';
import { WorkerRunner } from './worker-runner.js';
import { FaceDetectionService } from './services/face-detection.service.js';
import { FeedbackProfileService } from './services/feedback-profile.service.js';
import { SmartCropService } from './services/smart-crop.service.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
    }),
  ],
  providers: [
    PrismaService,
    ApiKeyService,
    ClipValidationService,
    ClipPersistenceService,
    FfmpegService,
    GpuCapabilityService,
    PipelineMetricsService,
    RemoteRenderingService,
    RenderingService,
    RenderOrchestrationService,
    RemotionRenderService,
    SubtitleService,
    TranscriptionService,
    TranscriptOrchestrationService,
    VideoProcessorService,
    YoutubeDownloadService,
    YoutubePublishService,
    TikTokPublishService,
    InstagramPublishService,
    SchedulerService,
    BrollService,
    BrollPlanService,
    BulkCaptionRenderService,
    ChannelImportService,
    OverlayBuilderService,
    WorkerRunner,
    FaceDetectionService,
    FeedbackProfileService,
    SmartCropService,
  ],
})
export class AppModule {}
