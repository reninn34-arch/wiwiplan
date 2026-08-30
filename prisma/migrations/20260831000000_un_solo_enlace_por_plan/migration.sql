-- Un plan, un enlace.
--
-- Generar un enlace ya reemplaza al anterior, pero los que se crearon antes de
-- ese arreglo quedaron acumulados: el mismo plan repartido en varias
-- direcciones, todas vivas. Eso es peor que incómodo — al regenerar uno, los
-- otros seguían abiertos y no había forma de saber cuál tenía el cliente.
--
-- Se conserva el más reciente de cada plan, que es el que se repartió último.
DELETE FROM "ShareLink" s
WHERE EXISTS (
  SELECT 1 FROM "ShareLink" nuevo
  WHERE nuevo."planningId" = s."planningId"
    AND (nuevo."createdAt" > s."createdAt"
         OR (nuevo."createdAt" = s."createdAt" AND nuevo.id > s.id))
);

-- Y que no vuelva a pasar, pase lo que pase en el código.
CREATE UNIQUE INDEX "ShareLink_planningId_key" ON "ShareLink"("planningId");
