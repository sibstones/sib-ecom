-- AlterTable: Change productType column from ProductType enum to JSONB array
-- This migration converts the productType field from a single enum value to a JSON array format
-- Existing single productType values will be converted to array format: ["CLOTHING"]

-- Step 1: Add a temporary column
ALTER TABLE "products" ADD COLUMN "product_type_new" JSONB;

-- Step 2: Convert existing enum productType values to JSON array format
UPDATE "products" 
SET "product_type_new" = CASE 
  WHEN "productType" IS NOT NULL THEN
    jsonb_build_array("productType"::text)
  ELSE NULL
END;

-- Step 3: Drop the old column
ALTER TABLE "products" DROP COLUMN "productType";

-- Step 4: Rename the new column to the original name
ALTER TABLE "products" RENAME COLUMN "product_type_new" TO "productType";
