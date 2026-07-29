/*
  Warnings:

  - You are about to drop the `VideoReference` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "VideoReference" DROP CONSTRAINT "VideoReference_planningId_fkey";

-- DropTable
DROP TABLE "VideoReference";

-- DropEnum
DROP TYPE "VideoPlatform";
