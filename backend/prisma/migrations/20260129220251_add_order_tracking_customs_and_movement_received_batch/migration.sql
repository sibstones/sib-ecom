-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customsDeclarationNumber" TEXT,
ADD COLUMN     "trackingNumber" TEXT;
