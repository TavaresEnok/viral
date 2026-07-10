CREATE TYPE "ClipFeedbackReason" AS ENUM (
  'WEAK_START',
  'WEAK_END',
  'NOT_VIRAL',
  'MISSING_CONTEXT',
  'BAD_CAPTION',
  'OTHER'
);

ALTER TABLE "Clip"
  ADD COLUMN "closingStrength" INTEGER,
  ADD COLUMN "closingType" TEXT;

CREATE TABLE "ClipFeedback" (
  "id" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" "ClipFeedbackReason" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClipFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClipFeedback_clipId_userId_key" ON "ClipFeedback"("clipId", "userId");
CREATE INDEX "ClipFeedback_userId_idx" ON "ClipFeedback"("userId");
CREATE INDEX "ClipFeedback_reason_idx" ON "ClipFeedback"("reason");

ALTER TABLE "ClipFeedback"
  ADD CONSTRAINT "ClipFeedback_clipId_fkey"
  FOREIGN KEY ("clipId") REFERENCES "Clip"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClipFeedback"
  ADD CONSTRAINT "ClipFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
