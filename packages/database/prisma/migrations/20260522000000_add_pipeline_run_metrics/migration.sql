CREATE TABLE "PipelineRunMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" "ProcessingStatus" NOT NULL,
    "failedStage" TEXT,
    "errorMessage" TEXT,
    "totalSec" DOUBLE PRECISION,
    "stageTimings" JSONB,
    "videoDurationSec" DOUBLE PRECISION,
    "transcriptSource" TEXT,
    "transcriptQualityScore" DOUBLE PRECISION,
    "transcriptSegmentCount" INTEGER,
    "transcriptWordCount" INTEGER,
    "asrProvider" TEXT,
    "asrModel" TEXT,
    "asrComputeType" TEXT,
    "asrDevice" TEXT,
    "asrTotalSec" DOUBLE PRECISION,
    "asrRtf" DOUBLE PRECISION,
    "llmPass1Model" TEXT,
    "llmPass2Model" TEXT,
    "llmPass1Tokens" INTEGER,
    "llmPass2Tokens" INTEGER,
    "llmTotalTokens" INTEGER,
    "llmCostEstimate" DOUBLE PRECISION,
    "pass1CandidateCount" INTEGER,
    "pass2ClipCount" INTEGER,
    "approvedClipCount" INTEGER,
    "rejectionRate" DOUBLE PRECISION,
    "rawClipCount" INTEGER,
    "validatedClipCount" INTEGER,
    "renderedClipCount" INTEGER,
    "failedRenderCount" INTEGER,
    "remoteGpuUsed" BOOLEAN NOT NULL DEFAULT false,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "renderEngines" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineRunMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PipelineRunMetric_projectId_idx" ON "PipelineRunMetric"("projectId");
CREATE INDEX "PipelineRunMetric_jobId_idx" ON "PipelineRunMetric"("jobId");
CREATE INDEX "PipelineRunMetric_status_idx" ON "PipelineRunMetric"("status");
CREATE INDEX "PipelineRunMetric_createdAt_idx" ON "PipelineRunMetric"("createdAt");

ALTER TABLE "PipelineRunMetric" ADD CONSTRAINT "PipelineRunMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
