-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('MAIN', 'STORE', 'MARKETPLACE');

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "priority" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "type" "WarehouseType" NOT NULL DEFAULT 'MAIN';

-- CreateIndex
CREATE INDEX "warehouses_type_idx" ON "warehouses"("type");
