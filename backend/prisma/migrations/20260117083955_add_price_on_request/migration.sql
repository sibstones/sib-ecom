-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "price" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "priceOnRequest" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "price" DROP NOT NULL;
