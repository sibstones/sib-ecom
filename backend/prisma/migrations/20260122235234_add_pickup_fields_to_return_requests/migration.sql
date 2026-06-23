-- CreateEnum
CREATE TYPE "PickupMethod" AS ENUM ('COURIER', 'POST', 'PICKUP');

-- AlterTable
ALTER TABLE "return_request_items" ADD COLUMN     "replacementProductId" TEXT,
ADD COLUMN     "replacementVariantId" TEXT;

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "pickupAddress" TEXT,
ADD COLUMN     "pickupDate" TIMESTAMP(3),
ADD COLUMN     "pickupMethod" "PickupMethod",
ADD COLUMN     "pickupNotes" TEXT;
