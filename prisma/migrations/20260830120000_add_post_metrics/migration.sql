-- AlterTable
-- Todo nulo a propósito: "no lo hemos consultado" y "no lo vio nadie" no son
-- lo mismo. Con cero por defecto, una pieza recién publicada mostraría un
-- alcance de 0 y parecería un fracaso en vez de un dato que falta.
ALTER TABLE "IdeaTarget" ADD COLUMN     "reach" INTEGER,
ADD COLUMN     "likes" INTEGER,
ADD COLUMN     "commentCount" INTEGER,
ADD COLUMN     "saves" INTEGER,
ADD COLUMN     "shares" INTEGER,
ADD COLUMN     "views" INTEGER,
ADD COLUMN     "metricsAt" TIMESTAMP(3);
