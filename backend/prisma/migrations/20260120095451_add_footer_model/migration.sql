-- CreateTable
CREATE TABLE "footers" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL DEFAULT 'AWHSUM',
    "tagline" TEXT,
    "columns" JSONB NOT NULL,
    "copyright" TEXT NOT NULL DEFAULT '© {year} AWHSUM. {allRightsReserved}',
    "links" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "footers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_translations" (
    "id" TEXT NOT NULL,
    "footerId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "brandName" TEXT,
    "tagline" TEXT,
    "columns" JSONB,
    "copyright" TEXT,
    "links" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "footer_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "footer_translations_footerId_idx" ON "footer_translations"("footerId");

-- CreateIndex
CREATE INDEX "footer_translations_languageCode_idx" ON "footer_translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "footer_translations_footerId_languageCode_key" ON "footer_translations"("footerId", "languageCode");

-- AddForeignKey
ALTER TABLE "footer_translations" ADD CONSTRAINT "footer_translations_footerId_fkey" FOREIGN KEY ("footerId") REFERENCES "footers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
