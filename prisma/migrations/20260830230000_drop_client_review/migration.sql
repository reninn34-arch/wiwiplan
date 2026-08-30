-- Deshace 20260830220000_add_client_review.
--
-- No se borra aquella carpeta: Prisma lleva registro de lo aplicado y quitar
-- una migración ya corrida rompe el despliegue con "migración en la base que
-- no existe en el proyecto". Lo que se deshace, se deshace con otra migración.
--
-- La aprobación pieza por pieza se retiró porque no encajaba con cómo revisan
-- los clientes: la mayoría no entra a revisar, y el equipo prefiere no tener
-- un estado más que atender.
ALTER TABLE "ContentIdea" DROP COLUMN "clientReview",
DROP COLUMN "reviewedAt";

DROP TYPE "ClientReview";
