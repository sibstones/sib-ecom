-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "showOnProduct" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "size" TEXT;
