-- CreateEnum
CREATE TYPE "CustomsDirection" AS ENUM ('IMPORT', 'EXPORT');

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "customsDeclarationId" TEXT,
ADD COLUMN     "documentDate" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "purchaseCurrency" TEXT,
ADD COLUMN     "purchasePrice" DECIMAL(10,2),
ADD COLUMN     "supplierInn" TEXT,
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "supplierVatNumber" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "carrierName" TEXT,
ADD COLUMN     "deliveryMethod" TEXT,
ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "waybillDate" TIMESTAMP(3),
ADD COLUMN     "waybillNumber" TEXT;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "costPrice" DECIMAL(10,2),
ADD COLUMN     "customsCode" TEXT,
ADD COLUMN     "vatRate" DECIMAL(5,4);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costCurrency" TEXT,
ADD COLUMN     "costPrice" DECIMAL(10,2),
ADD COLUMN     "customsCode" TEXT,
ADD COLUMN     "customsValue" DECIMAL(10,2),
ADD COLUMN     "customsValueCurrency" TEXT,
ADD COLUMN     "exciseGoods" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "importDeclarationDate" TIMESTAMP(3),
ADD COLUMN     "importDeclarationNumber" TEXT,
ADD COLUMN     "vatRate" DECIMAL(5,4),
ADD COLUMN     "weightGross" DECIMAL(10,4),
ADD COLUMN     "weightNet" DECIMAL(10,4);

-- CreateTable
CREATE TABLE "customs_declarations" (
    "id" TEXT NOT NULL,
    "declarationNumber" TEXT NOT NULL,
    "declarationDate" TIMESTAMP(3) NOT NULL,
    "direction" "CustomsDirection" NOT NULL,
    "customsOffice" TEXT,
    "customsProcedure" TEXT,
    "totalCustomsValue" DECIMAL(12,2),
    "totalCustomsValueCurrency" TEXT,
    "vatAmount" DECIMAL(12,2),
    "dutyAmount" DECIMAL(12,2),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customs_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customs_declarations_orderId_idx" ON "customs_declarations"("orderId");

-- CreateIndex
CREATE INDEX "customs_declarations_declarationNumber_idx" ON "customs_declarations"("declarationNumber");

-- CreateIndex
CREATE INDEX "customs_declarations_declarationDate_idx" ON "customs_declarations"("declarationDate");

-- CreateIndex
CREATE INDEX "customs_declarations_direction_idx" ON "customs_declarations"("direction");

-- CreateIndex
CREATE INDEX "inventory_movements_customsDeclarationId_idx" ON "inventory_movements"("customsDeclarationId");

-- CreateIndex
CREATE INDEX "orders_shippedAt_idx" ON "orders"("shippedAt");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_customsDeclarationId_fkey" FOREIGN KEY ("customsDeclarationId") REFERENCES "customs_declarations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
