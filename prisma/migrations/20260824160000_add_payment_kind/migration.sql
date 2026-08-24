-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('PAYMENT', 'WITHHOLDING', 'ADJUSTMENT');

-- AlterTable
-- Todo lo ya registrado es plata que entró: el default cubre las filas viejas
-- sin cambiar ni un saldo.
ALTER TABLE "Payment" ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'PAYMENT';
