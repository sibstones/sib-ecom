-- CreateTable
CREATE TABLE "currency_rates" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rateToUsd" DECIMAL(10,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currency_rates_currency_key" ON "currency_rates"("currency");

-- CreateIndex
CREATE INDEX "currency_rates_currency_idx" ON "currency_rates"("currency");

-- CreateIndex
CREATE INDEX "currency_rates_isActive_idx" ON "currency_rates"("isActive");
