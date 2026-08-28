-- AlterTable
-- Todo nulo o cero: lo ya publicado a mano conserva su publishedAt y no se
-- toca. Estos campos sólo los usa el carril automático.
ALTER TABLE "IdeaTarget" ADD COLUMN     "containerId" TEXT,
ADD COLUMN     "externalPostId" TEXT,
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "attemptedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT;
