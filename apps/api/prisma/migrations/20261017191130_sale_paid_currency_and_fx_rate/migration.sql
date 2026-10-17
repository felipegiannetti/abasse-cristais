-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "fxRate" DECIMAL(12,6),
ADD COLUMN     "paidAmountCents" INTEGER,
ADD COLUMN     "paidCurrency" TEXT NOT NULL DEFAULT 'USD',
ALTER COLUMN "currency" SET DEFAULT 'USD';
