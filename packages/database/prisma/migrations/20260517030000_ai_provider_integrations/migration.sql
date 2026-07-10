CREATE TABLE "AiProviderIntegration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'LLM',
  "encryptedApiKey" TEXT,
  "baseUrl" TEXT,
  "model" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiProviderIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderIntegration_userId_provider_role_key"
  ON "AiProviderIntegration"("userId", "provider", "role");
CREATE INDEX "AiProviderIntegration_userId_idx" ON "AiProviderIntegration"("userId");
CREATE INDEX "AiProviderIntegration_provider_idx" ON "AiProviderIntegration"("provider");
CREATE INDEX "AiProviderIntegration_role_idx" ON "AiProviderIntegration"("role");

ALTER TABLE "AiProviderIntegration"
  ADD CONSTRAINT "AiProviderIntegration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
