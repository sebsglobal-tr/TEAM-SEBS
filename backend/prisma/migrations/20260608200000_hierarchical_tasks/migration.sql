-- Migration: add_hierarchical_task_system
-- Schema changes for Admin→Manager→Employee hierarchical task system

-- 1. Create new enums
CREATE TYPE "TaskType" AS ENUM ('SOFTWARE', 'DESIGN', 'CONTENT', 'TEST', 'OPERATION', 'MARKETING', 'OTHER');
CREATE TYPE "CommentType" AS ENUM ('NORMAL', 'UPDATE', 'BLOCKER', 'REVISION', 'APPROVAL');

-- 2. Migrate TaskStatus: old → new mapping
--    TODO → PENDING, IN_PROGRESS → IN_PROGRESS, WAITING_REVIEW → SUBMITTED,
--    COMPLETED → MANAGER_APPROVED, CANCELLED → CANCELLED
CREATE TYPE "TaskStatus_new" AS ENUM (
  'POOL', 'ASSIGNED_TO_MANAGER', 'ASSIGNED_TO_EMPLOYEE', 'PENDING',
  'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'BLOCKED', 'SUBMITTED',
  'REVISION_REQUESTED', 'MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'
);

-- Migrate task statuses
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING (
  CASE "status"::text
    WHEN 'TODO' THEN 'PENDING'::"TaskStatus_new"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"TaskStatus_new"
    WHEN 'WAITING_REVIEW' THEN 'SUBMITTED'::"TaskStatus_new"
    WHEN 'COMPLETED' THEN 'MANAGER_APPROVED'::"TaskStatus_new"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"TaskStatus_new"
    ELSE 'PENDING'::"TaskStatus_new"
  END
);

ALTER TABLE "task_history" ALTER COLUMN "old_status" TYPE "TaskStatus_new" USING ("old_status"::text::"TaskStatus_new");
ALTER TABLE "task_history" ALTER COLUMN "new_status" TYPE "TaskStatus_new" USING ("new_status"::text::"TaskStatus_new");

-- Drop old type and rename new
DROP TYPE IF EXISTS "TaskStatus" CASCADE;
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";

-- 3. Add new columns to tasks table
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "taskType" "TaskType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS "assignedToRole" "UserRole",
  ADD COLUMN IF NOT EXISTS "responsibleManagerId" TEXT,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByManagerAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByAdminAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'POOL';

-- 4. Rename comment column in task_comments
ALTER TABLE "task_comments" RENAME COLUMN "comment" TO "message";
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "commentType" "CommentType" NOT NULL DEFAULT 'NORMAL';

-- 5. Create task_files table
CREATE TABLE IF NOT EXISTS "task_files" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "task_files_taskId_idx" ON "task_files"("taskId");

ALTER TABLE "task_files" ADD CONSTRAINT "task_files_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;
ALTER TABLE "task_files" ADD CONSTRAINT "task_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE;

-- 6. Create task_status_logs table (separate from task_history)
CREATE TABLE IF NOT EXISTS "task_status_logs" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "changedById" TEXT,
  "oldStatus" "TaskStatus",
  "newStatus" "TaskStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_status_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "task_status_logs_taskId_idx" ON "task_status_logs"("taskId");

ALTER TABLE "task_status_logs" ADD CONSTRAINT "task_status_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;
ALTER TABLE "task_status_logs" ADD CONSTRAINT "task_status_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL;

-- 7. Add indexes for task performance
CREATE INDEX IF NOT EXISTS "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");
CREATE INDEX IF NOT EXISTS "tasks_responsibleManagerId_idx" ON "tasks"("responsibleManagerId");

-- 8. Add relation for user taskHistory
ALTER TABLE "task_history" ADD COLUMN IF NOT EXISTS "userId" TEXT;
CREATE INDEX IF NOT EXISTS "task_history_userId_idx" ON "task_history"("userId");
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
