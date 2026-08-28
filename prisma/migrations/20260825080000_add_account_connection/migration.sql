-- AlterTable
-- Todo nulo: una cuenta sin conectar es el estado normal, y sigue funcionando
-- por el carril asistido igual que antes.
ALTER TABLE "ClientAccount" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalName" TEXT,
ADD COLUMN     "pageId" TEXT,
ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "connectedAt" TIMESTAMP(3);
