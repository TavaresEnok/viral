-- AlterTable: add Stripe fields to UserQuota
ALTER TABLE "UserQuota"
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'inactive';

-- Create unique index on stripeSubscriptionId
CREATE UNIQUE INDEX IF NOT EXISTS "UserQuota_stripeSubscriptionId_key" ON "UserQuota"("stripeSubscriptionId");
