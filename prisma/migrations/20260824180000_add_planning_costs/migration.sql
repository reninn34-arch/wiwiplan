-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('TEAM', 'ADS', 'PRODUCTION', 'TOOLS', 'OTHER');

-- AlterTable
-- Arranca en cero: ningún plan existente tenía costos cargados, así que el
-- margen de los meses viejos es su valor completo hasta que se carguen.
ALTER TABLE "Planning" ADD COLUMN     "costCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlanningCost" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL,
    "category" "CostCategory" NOT NULL DEFAULT 'OTHER',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningCost_planningId_idx" ON "PlanningCost"("planningId");

-- AddForeignKey
ALTER TABLE "PlanningCost" ADD CONSTRAINT "PlanningCost_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
