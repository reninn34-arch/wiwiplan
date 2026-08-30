-- CreateEnum
CREATE TYPE "ClientReview" AS ENUM ('PENDING', 'APPROVED', 'CHANGES');

-- AlterTable
-- Todo arranca en PENDING, incluso lo ya publicado: nadie revisó pieza por
-- pieza porque hasta ahora no se podía. Marcarlo como aprobado de oficio
-- inventaría una decisión que el cliente nunca tomó.
ALTER TABLE "ContentIdea" ADD COLUMN     "clientReview" "ClientReview" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
