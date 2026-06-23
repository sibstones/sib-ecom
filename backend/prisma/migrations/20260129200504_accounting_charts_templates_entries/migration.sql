-- CreateEnum
CREATE TYPE "AccountingAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "accounting_charts" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_chart_items" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountingAccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_chart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_entry_templates" (
    "id" TEXT NOT NULL,
    "chartId" TEXT,
    "region" TEXT NOT NULL,
    "legalRegime" TEXT,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "debitAccountCode" TEXT NOT NULL,
    "creditAccountCode" TEXT NOT NULL,
    "amountFormula" TEXT,
    "analyticsMapping" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_entry_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_entries" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "region" TEXT NOT NULL,
    "legalRegime" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "debitAccountCode" TEXT NOT NULL,
    "creditAccountCode" TEXT NOT NULL,
    "debitAccountName" TEXT,
    "creditAccountName" TEXT,
    "analytics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_charts_region_idx" ON "accounting_charts"("region");

-- CreateIndex
CREATE INDEX "accounting_charts_isActive_idx" ON "accounting_charts"("isActive");

-- CreateIndex
CREATE INDEX "accounting_chart_items_chartId_idx" ON "accounting_chart_items"("chartId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_chart_items_chartId_code_key" ON "accounting_chart_items"("chartId", "code");

-- CreateIndex
CREATE INDEX "accounting_entry_templates_region_idx" ON "accounting_entry_templates"("region");

-- CreateIndex
CREATE INDEX "accounting_entry_templates_legalRegime_idx" ON "accounting_entry_templates"("legalRegime");

-- CreateIndex
CREATE INDEX "accounting_entry_templates_triggerEvent_idx" ON "accounting_entry_templates"("triggerEvent");

-- CreateIndex
CREATE INDEX "accounting_entry_templates_chartId_idx" ON "accounting_entry_templates"("chartId");

-- CreateIndex
CREATE INDEX "accounting_entries_templateId_idx" ON "accounting_entries"("templateId");

-- CreateIndex
CREATE INDEX "accounting_entries_region_idx" ON "accounting_entries"("region");

-- CreateIndex
CREATE INDEX "accounting_entries_entityType_idx" ON "accounting_entries"("entityType");

-- CreateIndex
CREATE INDEX "accounting_entries_entityId_idx" ON "accounting_entries"("entityId");

-- CreateIndex
CREATE INDEX "accounting_entries_eventDate_idx" ON "accounting_entries"("eventDate");

-- AddForeignKey
ALTER TABLE "accounting_chart_items" ADD CONSTRAINT "accounting_chart_items_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "accounting_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entry_templates" ADD CONSTRAINT "accounting_entry_templates_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "accounting_charts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "accounting_entry_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
