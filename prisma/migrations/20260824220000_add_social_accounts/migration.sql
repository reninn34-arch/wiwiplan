-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "PublishMode" AS ENUM ('ASSISTED', 'AUTOMATIC');

-- AlterTable
-- Vacío quiere decir "sin hora": la pieza tiene día pero todavía no minuto.
ALTER TABLE "ContentIdea" ADD COLUMN     "publishTime" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "mode" "PublishMode" NOT NULL DEFAULT 'ASSISTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaTarget" (
    "ideaId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "IdeaTarget_pkey" PRIMARY KEY ("ideaId","accountId")
);

-- CreateIndex
CREATE INDEX "ClientAccount_clientId_idx" ON "ClientAccount"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccount_clientId_network_key" ON "ClientAccount"("clientId", "network");

-- CreateIndex
CREATE INDEX "IdeaTarget_accountId_idx" ON "IdeaTarget"("accountId");

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaTarget" ADD CONSTRAINT "IdeaTarget_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ContentIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaTarget" ADD CONSTRAINT "IdeaTarget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
