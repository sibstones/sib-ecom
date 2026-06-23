-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('STORE_ONLINE', 'STORE_OFFLINE', 'MARKETPLACE_WB', 'MARKETPLACE_OZON', 'MARKETPLACE_WILDBERRIES', 'MARKETPLACE_OTHER', 'MANUAL');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fulfillmentWarehouseId" TEXT,
ADD COLUMN     "orderSource" "OrderSource" DEFAULT 'STORE_ONLINE';

-- CreateIndex
CREATE INDEX "orders_orderSource_idx" ON "orders"("orderSource");

-- CreateIndex
CREATE INDEX "orders_fulfillmentWarehouseId_idx" ON "orders"("fulfillmentWarehouseId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillmentWarehouseId_fkey" FOREIGN KEY ("fulfillmentWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
