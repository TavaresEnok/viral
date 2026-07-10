ALTER TABLE "Transcript"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "sourceModel" TEXT,
  ADD COLUMN "qualityScore" DOUBLE PRECISION,
  ADD COLUMN "qualityWarnings" JSONB,
  ADD COLUMN "segmentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wordCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Clip"
  ADD COLUMN "finalScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scoreBreakdown" JSONB;

UPDATE "Clip"
SET "finalScore" = "viralScore"
WHERE "finalScore" = 0;

UPDATE "Transcript"
SET
  "segmentCount" = CASE
    WHEN jsonb_typeof("segmentsJson"::jsonb) = 'array' THEN jsonb_array_length("segmentsJson"::jsonb)
    ELSE 0
  END,
  "wordCount" = CASE
    WHEN "wordsJson" IS NOT NULL AND jsonb_typeof("wordsJson"::jsonb) = 'array' THEN jsonb_array_length("wordsJson"::jsonb)
    ELSE 0
  END;
