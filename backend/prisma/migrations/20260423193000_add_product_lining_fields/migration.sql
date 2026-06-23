-- Add product lining fields
ALTER TABLE "products"
ADD COLUMN "lining" TEXT,
ADD COLUMN "hideLining" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "product_translations"
ADD COLUMN "lining" TEXT;
