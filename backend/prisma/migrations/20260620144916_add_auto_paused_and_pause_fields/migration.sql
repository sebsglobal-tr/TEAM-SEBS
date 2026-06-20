-- AlterEnum: Add AUTO_PAUSED to WorkSessionStatus
ALTER TYPE "WorkSessionStatus" ADD VALUE IF NOT EXISTS 'AUTO_PAUSED';

-- AlterTable: Add new columns to work_sessions
ALTER TABLE "work_sessions" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMPTZ;
ALTER TABLE "work_sessions" ADD COLUMN IF NOT EXISTS "lastResumedAt" TIMESTAMPTZ;
ALTER TABLE "work_sessions" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMPTZ;
ALTER TABLE "work_sessions" ADD COLUMN IF NOT EXISTS "pauseReason" TEXT;
