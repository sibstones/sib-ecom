-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'GRACE_PERIOD');

-- CreateEnum
CREATE TYPE "LicenseEventType" AS ENUM ('ACTIVATED', 'VALIDATED', 'EXPIRED', 'REVOKED', 'GRACE_PERIOD_STARTED', 'GRACE_PERIOD_ENDED', 'FEATURE_ACCESS_DENIED', 'FINGERPRINT_MISMATCH', 'SERVER_UNAVAILABLE');

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "features" TEXT[],
    "limits" JSONB NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "instanceFingerprint" TEXT NOT NULL,
    "updateChannel" TEXT NOT NULL DEFAULT 'stable',
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "gracePeriodEndsAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "lastValidatedBy" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_events" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "type" "LicenseEventType" NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_cache" (
    "id" TEXT NOT NULL,
    "licenseToken" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "features" TEXT[],
    "limits" JSONB NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "instanceFingerprint" TEXT NOT NULL,
    "updateChannel" TEXT NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_licenseId_key" ON "licenses"("licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_instanceFingerprint_key" ON "licenses"("instanceFingerprint");

-- CreateIndex
CREATE INDEX "licenses_licenseId_idx" ON "licenses"("licenseId");

-- CreateIndex
CREATE INDEX "licenses_tenant_idx" ON "licenses"("tenant");

-- CreateIndex
CREATE INDEX "licenses_status_idx" ON "licenses"("status");

-- CreateIndex
CREATE INDEX "licenses_instanceFingerprint_idx" ON "licenses"("instanceFingerprint");

-- CreateIndex
CREATE INDEX "licenses_validUntil_idx" ON "licenses"("validUntil");

-- CreateIndex
CREATE INDEX "license_events_licenseId_idx" ON "license_events"("licenseId");

-- CreateIndex
CREATE INDEX "license_events_type_idx" ON "license_events"("type");

-- CreateIndex
CREATE INDEX "license_events_createdAt_idx" ON "license_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "license_cache_licenseToken_key" ON "license_cache"("licenseToken");

-- CreateIndex
CREATE UNIQUE INDEX "license_cache_licenseId_key" ON "license_cache"("licenseId");

-- CreateIndex
CREATE INDEX "license_cache_licenseId_idx" ON "license_cache"("licenseId");

-- CreateIndex
CREATE INDEX "license_cache_expiresAt_idx" ON "license_cache"("expiresAt");

-- AddForeignKey
ALTER TABLE "license_events" ADD CONSTRAINT "license_events_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
