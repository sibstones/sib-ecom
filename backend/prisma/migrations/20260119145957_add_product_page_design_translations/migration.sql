-- CreateTable
CREATE TABLE "product_page_design_translations" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "sizeChartLabels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_page_design_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_page_design_translations_languageCode_key" ON "product_page_design_translations"("languageCode");

-- CreateIndex
CREATE INDEX "product_page_design_translations_languageCode_idx" ON "product_page_design_translations"("languageCode");
