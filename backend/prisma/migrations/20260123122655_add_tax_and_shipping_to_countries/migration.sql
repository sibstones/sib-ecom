-- AlterTable
ALTER TABLE "countries" ADD COLUMN     "freeShippingThreshold" DECIMAL(10,2),
ADD COLUMN     "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 10,
ADD COLUMN     "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.1;

-- Update existing records with default values
UPDATE "countries" SET "freeShippingThreshold" = 100 WHERE "freeShippingThreshold" IS NULL;
