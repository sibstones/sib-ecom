-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN     "isPartnerPromo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partnerCommissionRate" DECIMAL(5,2),
ADD COLUMN     "partnerId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isPartner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partnerStatus" TEXT;

-- CreateTable
CREATE TABLE "partner_commissions" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "orderTotal" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_payouts" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_documents" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_commissions_partnerId_idx" ON "partner_commissions"("partnerId");

-- CreateIndex
CREATE INDEX "partner_commissions_orderId_idx" ON "partner_commissions"("orderId");

-- CreateIndex
CREATE INDEX "partner_commissions_promoCodeId_idx" ON "partner_commissions"("promoCodeId");

-- CreateIndex
CREATE INDEX "partner_commissions_status_idx" ON "partner_commissions"("status");

-- CreateIndex
CREATE INDEX "partner_commissions_payoutId_idx" ON "partner_commissions"("payoutId");

-- CreateIndex
CREATE INDEX "partner_commissions_createdAt_idx" ON "partner_commissions"("createdAt");

-- CreateIndex
CREATE INDEX "partner_payouts_partnerId_idx" ON "partner_payouts"("partnerId");

-- CreateIndex
CREATE INDEX "partner_payouts_status_idx" ON "partner_payouts"("status");

-- CreateIndex
CREATE INDEX "partner_payouts_requestedAt_idx" ON "partner_payouts"("requestedAt");

-- CreateIndex
CREATE INDEX "partner_documents_partnerId_idx" ON "partner_documents"("partnerId");

-- CreateIndex
CREATE INDEX "partner_documents_type_idx" ON "partner_documents"("type");

-- CreateIndex
CREATE INDEX "partner_documents_createdAt_idx" ON "partner_documents"("createdAt");

-- CreateIndex
CREATE INDEX "promo_codes_isPartnerPromo_idx" ON "promo_codes"("isPartnerPromo");

-- CreateIndex
CREATE INDEX "promo_codes_partnerId_idx" ON "promo_codes"("partnerId");

-- CreateIndex
CREATE INDEX "users_isPartner_idx" ON "users"("isPartner");

-- CreateIndex
CREATE INDEX "users_partnerStatus_idx" ON "users"("partnerStatus");

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "partner_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
