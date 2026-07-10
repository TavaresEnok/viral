-- Reconcile schema drift detected between the live database and schema.prisma.
-- `prisma migrate status` reported "up to date" because _prisma_migrations was
-- marked complete, but several objects were never actually applied.

-- 1) De-duplicate ProcessingJob so the unique (projectId, stage) index can exist.
--    upsertProcessingJob did findFirst+create without the DB constraint, which
--    allowed duplicate rows to accumulate. Keep the most recent row per pair.
DELETE FROM "ProcessingJob"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "projectId", stage
             ORDER BY "updatedAt" DESC, "createdAt" DESC
           ) AS rn
    FROM "ProcessingJob"
  ) ranked
  WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProcessingJob_projectId_stage_key"
  ON "ProcessingJob"("projectId", "stage");

-- 2) Missing NPSResponse table (+ indexes + FK).
CREATE TABLE IF NOT EXISTS "NPSResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" SMALLINT NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NPSResponse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NPSResponse_userId_idx" ON "NPSResponse"("userId");
CREATE INDEX IF NOT EXISTS "NPSResponse_score_idx" ON "NPSResponse"("score");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NPSResponse_userId_fkey'
  ) THEN
    ALTER TABLE "NPSResponse"
      ADD CONSTRAINT "NPSResponse_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Missing Transcript indexes.
CREATE INDEX IF NOT EXISTS "Transcript_language_idx" ON "Transcript"("language");
CREATE INDEX IF NOT EXISTS "Transcript_createdAt_idx" ON "Transcript"("createdAt");
