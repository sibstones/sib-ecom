-- CreateTable
CREATE TABLE "currency_rate_settings" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'EXCHANGERATE_API',
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "autoUpdateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "currency_rate_settings_pkey" PRIMARY KEY ("id")
);
