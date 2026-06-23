-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductType" ADD VALUE 'VOLUME';
ALTER TYPE "ProductType" ADD VALUE 'WEIGHT';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "heightCm" DECIMAL(10,2),
ADD COLUMN     "lengthCm" DECIMAL(10,2),
ADD COLUMN     "widthCm" DECIMAL(10,2);
