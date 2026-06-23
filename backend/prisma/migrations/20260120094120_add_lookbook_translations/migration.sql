-- CreateTable
CREATE TABLE "lookbook_translations" (
    "id" TEXT NOT NULL,
    "lookbookId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookbook_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lookbook_translations_lookbookId_idx" ON "lookbook_translations"("lookbookId");

-- CreateIndex
CREATE INDEX "lookbook_translations_languageCode_idx" ON "lookbook_translations"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "lookbook_translations_lookbookId_languageCode_key" ON "lookbook_translations"("lookbookId", "languageCode");

-- AddForeignKey
ALTER TABLE "lookbook_translations" ADD CONSTRAINT "lookbook_translations_lookbookId_fkey" FOREIGN KEY ("lookbookId") REFERENCES "lookbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
