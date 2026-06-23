-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('CLOTHING', 'SHOES', 'CUSTOM');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "color" TEXT,
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "hideColor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hideCountryOfOrigin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hideMaterial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "productType" "ProductType",
ADD COLUMN     "sizes" JSONB;

-- CreateIndex
CREATE INDEX "products_productType_idx" ON "products"("productType");

-- CreateIndex
CREATE INDEX "products_color_idx" ON "products"("color");

-- CreateIndex
CREATE INDEX "products_material_idx" ON "products"("material");

-- CreateIndex
CREATE INDEX "products_countryOfOrigin_idx" ON "products"("countryOfOrigin");
