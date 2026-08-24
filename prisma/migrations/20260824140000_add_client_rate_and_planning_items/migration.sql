-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "planName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rateCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlanningItem" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningItem_planningId_idx" ON "PlanningItem"("planningId");

-- AddForeignKey
ALTER TABLE "PlanningItem" ADD CONSTRAINT "PlanningItem_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada mes que ya tenía precio estrena su línea, para que
-- Planning."priceCents" siga siendo exactamente la suma de las líneas y ningún
-- plan viejo quede con un total que no se puede explicar. El id derivado del
-- plan hace que reejecutar la migración no duplique filas.
INSERT INTO "PlanningItem" ("id", "planningId", "label", "amountCents", "order")
SELECT 'itm_' || "id", "id", 'Plan del mes', "priceCents", 0
FROM "Planning"
WHERE "priceCents" > 0
ON CONFLICT ("id") DO NOTHING;
