-- AlterTable: add period column to Planning
ALTER TABLE "Planning" ADD COLUMN "period" TEXT NOT NULL DEFAULT '';
