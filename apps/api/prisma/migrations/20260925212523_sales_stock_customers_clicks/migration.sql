-- CreateEnum
CREATE TYPE "SaleMode" AS ENUM ('UNIT', 'WEIGHT');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "saleMode" "SaleMode" NOT NULL DEFAULT 'UNIT',
ADD COLUMN     "stockGrams" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockQuantity" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SaleStatus" NOT NULL DEFAULT 'PAID',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "shipTo" JSONB,
    "shippingMethod" TEXT,
    "shippingCostCents" INTEGER NOT NULL DEFAULT 0,
    "trackingCode" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "subtotalCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "notes" TEXT,
    "clickRef" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mode" "SaleMode" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "costCents" INTEGER,
    "totalCents" INTEGER NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePhoto" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppClick" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "productSlug" TEXT,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");

-- CreateIndex
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_clickRef_idx" ON "Sale"("clickRef");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SalePhoto_saleId_idx" ON "SalePhoto"("saleId");

-- CreateIndex
CREATE INDEX "WhatsAppClick_createdAt_idx" ON "WhatsAppClick"("createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppClick_productSlug_idx" ON "WhatsAppClick"("productSlug");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppClick_ref_key" ON "WhatsAppClick"("ref");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePhoto" ADD CONSTRAINT "SalePhoto_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing products that were already marked as sold start with no stock.
UPDATE "Product" SET "stockQuantity" = 0 WHERE "status" = 'SOLD_OUT';
