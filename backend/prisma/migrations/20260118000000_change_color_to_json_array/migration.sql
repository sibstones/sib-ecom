-- AlterTable: Change color column from String to Json
-- This migration converts the color field from a string to a JSON array format
-- Existing string colors will be converted to array format: [{"name": "ColorName", "hex": "#000000"}]

-- Step 1: Add a temporary column
ALTER TABLE "products" ADD COLUMN "color_new" JSONB;

-- Step 2: Convert existing string colors to JSON array format
UPDATE "products" 
SET "color_new" = CASE 
  WHEN "color" IS NOT NULL AND "color" != '' THEN
    jsonb_build_array(jsonb_build_object('name', "color", 'hex', '#000000'))
  ELSE NULL
END;

-- Step 3: Drop the old column
ALTER TABLE "products" DROP COLUMN "color";

-- Step 4: Rename the new column to the original name
ALTER TABLE "products" RENAME COLUMN "color_new" TO "color";
