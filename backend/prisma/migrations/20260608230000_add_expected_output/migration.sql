-- AlterTable: Add expectedOutput column to tasks table
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "expectedOutput" TEXT;
