-- AlterTable
-- Vacío = todavía sin copy escrito. No se toca `description`, que es el brief.
ALTER TABLE "ContentIdea" ADD COLUMN     "caption" TEXT NOT NULL DEFAULT '';
