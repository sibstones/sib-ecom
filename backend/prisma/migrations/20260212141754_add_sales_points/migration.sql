-- CreateEnum
CREATE TYPE "SalesPointType" AS ENUM ('MARKETPLACE', 'STORE_OFFLINE');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "salesPointId" TEXT;

-- CreateTable
CREATE TABLE "sales_points" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalesPointType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "warehouseId" TEXT,
    "externalId" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_point_products" (
    "id" TEXT NOT NULL,
    "salesPointId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT,
    "maxQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_point_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_points_type_idx" ON "sales_points"("type");

-- CreateIndex
CREATE INDEX "sales_points_warehouseId_idx" ON "sales_points"("warehouseId");

-- CreateIndex
CREATE INDEX "sales_point_products_salesPointId_idx" ON "sales_point_products"("salesPointId");

-- CreateIndex
CREATE INDEX "sales_point_products_productId_idx" ON "sales_point_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_point_products_salesPointId_productId_variantId_key" ON "sales_point_products"("salesPointId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "orders_salesPointId_idx" ON "orders"("salesPointId");

-- AddForeignKey
ALTER TABLE "sales_points" ADD CONSTRAINT "sales_points_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_point_products" ADD CONSTRAINT "sales_point_products_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "sales_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_point_products" ADD CONSTRAINT "sales_point_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_point_products" ADD CONSTRAINT "sales_point_products_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_point_products" ADD CONSTRAINT "sales_point_products_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "sales_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
