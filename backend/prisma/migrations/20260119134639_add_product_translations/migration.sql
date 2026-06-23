-- CreateTable
CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "material" TEXT,
    "countryOfOrigin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_translations_productId_idx" ON "product_translations"("productId");

-- CreateIndex
CREATE INDEX "product_translations_languageCode_idx" ON "product_translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_productId_languageCode_key" ON "product_translations"("productId", "languageCode");

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
