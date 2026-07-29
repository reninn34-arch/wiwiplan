-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('CARROUSEL', 'REEL', 'VIDEO', 'IMAGE', 'STORY', 'STATIC', 'OTHER');

-- AlterEnum
ALTER TYPE "IdeaPlatform" ADD VALUE 'FACEBOOK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VideoPlatform" ADD VALUE 'TIKTOK';
ALTER TYPE "VideoPlatform" ADD VALUE 'INSTAGRAM';
ALTER TYPE "VideoPlatform" ADD VALUE 'FACEBOOK';

-- AlterTable
ALTER TABLE "ContentIdea" ADD COLUMN     "postType" "PostType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "referenceEmbed" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "referenceUrl" TEXT NOT NULL DEFAULT '';
