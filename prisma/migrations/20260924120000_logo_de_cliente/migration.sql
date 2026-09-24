-- El esquema declara `Client.logo` desde hace tiempo, pero ninguna migración lo
-- creaba: la base de producción lo tiene porque se agregó a mano, y una base
-- nueva levantada con `migrate deploy` no podía crear ni un solo cliente
-- ("The column `logo` does not exist"). `IF NOT EXISTS` deja intacta la base
-- que ya lo tiene.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "logo" TEXT;

-- El índice simple quedó sobrando cuando llegó el único de
-- `ShareLink_planningId_key`: cubre la misma columna y el esquema ya no lo pide.
DROP INDEX IF EXISTS "ShareLink_planningId_idx";
