-- AlterTable
ALTER TABLE "categories" ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "categories_isMain_idx" ON "categories"("isMain");
