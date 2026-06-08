-- Fix: managerId column was missing on users table
-- This was in schema but never migrated to the database
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managerId" TEXT;
CREATE INDEX IF NOT EXISTS "users_managerId_idx" ON "users"("managerId");
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Also run the hierarchical tasks migration changes if they haven't been applied
-- (the previous migration may not have run on all environments)

-- TaskType enum
DO $$ BEGIN
  CREATE TYPE "TaskType" AS ENUM ('SOFTWARE', 'DESIGN', 'CONTENT', 'TEST', 'OPERATION', 'MARKETING', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CommentType enum
DO $$ BEGIN
  CREATE TYPE "CommentType" AS ENUM ('NORMAL', 'UPDATE', 'BLOCKER', 'REVISION', 'APPROVAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extended TaskStatus enum
DO $$ BEGIN
  CREATE TYPE "TaskStatus_new" AS ENUM (
    'POOL', 'ASSIGNED_TO_MANAGER', 'ASSIGNED_TO_EMPLOYEE', 'PENDING',
    'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'BLOCKED', 'SUBMITTED',
    'REVISION_REQUESTED', 'MANAGER_APPROVED', 'ADMIN_APPROVED', 'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Migrate task statuses if old TaskStatus type exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    -- Only migrate if still using old enum values
    ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING (
      CASE "status"::text
        WHEN 'TODO' THEN 'PENDING'::"TaskStatus_new"
        WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"TaskStatus_new"
        WHEN 'WAITING_REVIEW' THEN 'SUBMITTED'::"TaskStatus_new"
        WHEN 'COMPLETED' THEN 'MANAGER_APPROVED'::"TaskStatus_new"
        WHEN 'CANCELLED' THEN 'CANCELLED'::"TaskStatus_new"
        WHEN 'POOL' THEN 'POOL'::"TaskStatus_new"
        WHEN 'ASSIGNED_TO_MANAGER' THEN 'ASSIGNED_TO_MANAGER'::"TaskStatus_new"
        WHEN 'ASSIGNED_TO_EMPLOYEE' THEN 'ASSIGNED_TO_EMPLOYEE'::"TaskStatus_new"
        WHEN 'PENDING' THEN 'PENDING'::"TaskStatus_new"
        WHEN 'PARTIALLY_COMPLETED' THEN 'PARTIALLY_COMPLETED'::"TaskStatus_new"
        WHEN 'BLOCKED' THEN 'BLOCKED'::"TaskStatus_new"
        WHEN 'SUBMITTED' THEN 'SUBMITTED'::"TaskStatus_new"
        WHEN 'REVISION_REQUESTED' THEN 'REVISION_REQUESTED'::"TaskStatus_new"
        WHEN 'MANAGER_APPROVED' THEN 'MANAGER_APPROVED'::"TaskStatus_new"
        WHEN 'ADMIN_APPROVED' THEN 'ADMIN_APPROVED'::"TaskStatus_new"
        ELSE 'PENDING'::"TaskStatus_new"
      END
    );
    ALTER TABLE "task_history" ALTER COLUMN "old_status" TYPE "TaskStatus_new" USING ("old_status"::text::"TaskStatus_new");
    ALTER TABLE "task_history" ALTER COLUMN "new_status" TYPE "TaskStatus_new" USING ("new_status"::text::"TaskStatus_new");
    DROP TYPE IF EXISTS "TaskStatus" CASCADE;
    ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
  ELSE
    -- Type might already be renamed to TaskStatus
    BEGIN
      ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'POOL';
    EXCEPTION WHEN others THEN null;
    END;
  END IF;
END $$;

-- New columns on tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "taskType" "TaskType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assignedToRole" "UserRole";
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "responsibleManagerId" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "approvedByManagerAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "approvedByAdminAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'POOL';

-- Rename comment column in task_comments
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_comments' AND column_name = 'comment'
  ) THEN
    ALTER TABLE "task_comments" RENAME COLUMN "comment" TO "message";
  END IF;
END $$;
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "commentType" "CommentType" NOT NULL DEFAULT 'NORMAL';

-- task_files table
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
DO $$ BEGIN
  ALTER TABLE "task_files" ADD CONSTRAINT "task_files_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "task_files" ADD CONSTRAINT "task_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- task_status_logs table
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
DO $$ BEGIN
  ALTER TABLE "task_status_logs" ADD CONSTRAINT "task_status_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "task_status_logs" ADD CONSTRAINT "task_status_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Task indexes
CREATE INDEX IF NOT EXISTS "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");
CREATE INDEX IF NOT EXISTS "tasks_responsibleManagerId_idx" ON "tasks"("responsibleManagerId");

-- userId column on task_history
ALTER TABLE "task_history" ADD COLUMN IF NOT EXISTS "userId" TEXT;
CREATE INDEX IF NOT EXISTS "task_history_userId_idx" ON "task_history"("userId");
DO $$ BEGIN
  ALTER TABLE "task_history" ADD CONSTRAINT "task_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ReportStatus and ReportType enums
DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'REVISION_REQUESTED', 'APPROVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportType" AS ENUM ('DAILY', 'WEEKLY', 'TASK', 'TRAINING', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- reports table
CREATE TABLE IF NOT EXISTS "reports" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "reportType" "ReportType" NOT NULL DEFAULT 'DAILY',
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reports_userId_idx" ON "reports"("userId");
CREATE INDEX IF NOT EXISTS "reports_managerId_idx" ON "reports"("managerId");
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
DO $$ BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- report_files table
CREATE TABLE IF NOT EXISTS "report_files" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_files_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "report_files_reportId_idx" ON "report_files"("reportId");
DO $$ BEGIN
  ALTER TABLE "report_files" ADD CONSTRAINT "report_files_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- feedbacks table
CREATE TABLE IF NOT EXISTS "feedbacks" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "feedbacks_reportId_idx" ON "feedbacks"("reportId");
CREATE INDEX IF NOT EXISTS "feedbacks_employeeId_idx" ON "feedbacks"("employeeId");
DO $$ BEGIN
  ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
