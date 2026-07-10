-- CreateTable
CREATE TABLE "PlatformAiConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "llmActive" BOOLEAN NOT NULL DEFAULT false,
    "llmProvider" TEXT,
    "llmModel" TEXT,
    "llmBaseUrl" TEXT,
    "llmApiKeyEncrypted" TEXT,
    "transcriptionActive" BOOLEAN NOT NULL DEFAULT false,
    "transcriptionProvider" TEXT,
    "transcriptionModel" TEXT,
    "transcriptionBaseUrl" TEXT,
    "transcriptionApiKeyEncrypted" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAiConfig_pkey" PRIMARY KEY ("id")
);
