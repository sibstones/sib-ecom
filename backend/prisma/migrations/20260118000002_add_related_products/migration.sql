-- AlterTable: Add relatedProducts column for "Complete the Look" feature
-- This column stores an array of product IDs as JSON

ALTER TABLE "products" ADD COLUMN "relatedProducts" JSONB;
