ALTER TABLE "User"
  ADD COLUMN "deepseekModel" TEXT NOT NULL DEFAULT 'deepseek-chat',
  ADD COLUMN "openaiTranscriptionModel" TEXT NOT NULL DEFAULT 'whisper-1';

ALTER TABLE "Clip"
  ADD COLUMN "suggestedStart" DOUBLE PRECISION,
  ADD COLUMN "suggestedEnd" DOUBLE PRECISION,
  ADD COLUMN "renderLayout" "RenderLayout",
  ADD COLUMN "captionTheme" "CaptionTheme";

UPDATE "Clip"
SET "suggestedStart" = "start",
    "suggestedEnd" = "end"
WHERE "suggestedStart" IS NULL OR "suggestedEnd" IS NULL;
