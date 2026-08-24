-- AlterTable
-- Arranca apagado: ningún costo ya cargado se vuelve facturable de golpe, así
-- que ningún valor de mes ni ninguna factura cambian al aplicar esto.
ALTER TABLE "PlanningCost" ADD COLUMN     "billable" BOOLEAN NOT NULL DEFAULT false;
