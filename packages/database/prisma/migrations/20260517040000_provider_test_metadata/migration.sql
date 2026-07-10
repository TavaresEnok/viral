ALTER TABLE "AiProviderIntegration"
  ADD COLUMN "lastTestedAt" TIMESTAMP(3),
  ADD COLUMN "lastTestStatus" TEXT,
  ADD COLUMN "lastTestLatencyMs" INTEGER,
  ADD COLUMN "lastTestError" TEXT,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);
