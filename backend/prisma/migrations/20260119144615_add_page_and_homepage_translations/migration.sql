-- CreateTable
CREATE TABLE "page_translations" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homepage_section_translations" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_section_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_translations_pageId_idx" ON "page_translations"("pageId");

-- CreateIndex
CREATE INDEX "page_translations_languageCode_idx" ON "page_translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "page_translations_pageId_languageCode_key" ON "page_translations"("pageId", "languageCode");

-- CreateIndex
CREATE INDEX "homepage_section_translations_sectionId_idx" ON "homepage_section_translations"("sectionId");

-- CreateIndex
CREATE INDEX "homepage_section_translations_languageCode_idx" ON "homepage_section_translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "homepage_section_translations_sectionId_languageCode_key" ON "homepage_section_translations"("sectionId", "languageCode");

-- AddForeignKey
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homepage_section_translations" ADD CONSTRAINT "homepage_section_translations_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "homepage_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
