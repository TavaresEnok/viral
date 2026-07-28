-- CreateEnum
CREATE TYPE "QuickCaptionStatus" AS ENUM ('DRAFT', 'PENDING', 'RENDERING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialChannelPlatform" AS ENUM ('TIKTOK', 'INSTAGRAM', 'KWAI');

-- CreateEnum
CREATE TYPE "ChannelImportStatus" AS ENUM ('PENDING', 'LISTING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "QuickCaptionBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Lote sem título',
    "renderLayout" "RenderLayout" NOT NULL DEFAULT 'BLURRED_BACKGROUND',
    "captionTheme" "CaptionTheme" NOT NULL DEFAULT 'CLEAN_FOOTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickCaptionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickCaptionItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalFilePath" TEXT,
    "captionText" TEXT NOT NULL DEFAULT '',
    "durationSeconds" DOUBLE PRECISION,
    "status" "QuickCaptionStatus" NOT NULL DEFAULT 'DRAFT',
    "videoPath" TEXT,
    "thumbnailPath" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickCaptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelImportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialChannelPlatform" NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "status" "ChannelImportStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "videosJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelImportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuickCaptionBatch_userId_idx" ON "QuickCaptionBatch"("userId");

-- CreateIndex
CREATE INDEX "QuickCaptionItem_batchId_idx" ON "QuickCaptionItem"("batchId");

-- CreateIndex
CREATE INDEX "QuickCaptionItem_userId_idx" ON "QuickCaptionItem"("userId");

-- CreateIndex
CREATE INDEX "ChannelImportRequest_userId_idx" ON "ChannelImportRequest"("userId");

-- AddForeignKey
ALTER TABLE "QuickCaptionBatch" ADD CONSTRAINT "QuickCaptionBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickCaptionItem" ADD CONSTRAINT "QuickCaptionItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "QuickCaptionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelImportRequest" ADD CONSTRAINT "ChannelImportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
