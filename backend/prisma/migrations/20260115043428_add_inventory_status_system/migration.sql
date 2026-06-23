-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('AWAITING_RECEIPT', 'RECEIVED', 'IN_SALE', 'RESERVED', 'IN_DELIVERY', 'DELIVERED', 'RETURNED');

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "status" "InventoryStatus" NOT NULL DEFAULT 'AWAITING_RECEIPT';

-- CreateTable
CREATE TABLE "pallets" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "palletId" TEXT,
    "orderId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "InventoryStatus" NOT NULL DEFAULT 'AWAITING_RECEIPT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_qr_codes" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "orderId" TEXT,
    "code" TEXT NOT NULL,
    "qrImageUrl" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pallets_warehouseId_idx" ON "pallets"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "pallets_warehouseId_code_key" ON "pallets"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "inventory_items_inventoryId_idx" ON "inventory_items"("inventoryId");

-- CreateIndex
CREATE INDEX "inventory_items_palletId_idx" ON "inventory_items"("palletId");

-- CreateIndex
CREATE INDEX "inventory_items_orderId_idx" ON "inventory_items"("orderId");

-- CreateIndex
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_qr_codes_code_key" ON "delivery_qr_codes"("code");

-- CreateIndex
CREATE INDEX "delivery_qr_codes_inventoryItemId_idx" ON "delivery_qr_codes"("inventoryItemId");

-- CreateIndex
CREATE INDEX "delivery_qr_codes_orderId_idx" ON "delivery_qr_codes"("orderId");

-- CreateIndex
CREATE INDEX "delivery_qr_codes_code_idx" ON "delivery_qr_codes"("code");

-- CreateIndex
CREATE INDEX "delivery_qr_codes_isUsed_idx" ON "delivery_qr_codes"("isUsed");

-- CreateIndex
CREATE INDEX "inventory_status_idx" ON "inventory"("status");

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "pallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_qr_codes" ADD CONSTRAINT "delivery_qr_codes_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_qr_codes" ADD CONSTRAINT "delivery_qr_codes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
