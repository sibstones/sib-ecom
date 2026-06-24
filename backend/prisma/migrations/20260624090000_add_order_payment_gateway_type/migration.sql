-- Add explicit gateway subtype to orders so reports can distinguish
-- Stripe vs YooKassa vs other card providers for GATEWAY payments.
ALTER TABLE "orders"
ADD COLUMN "paymentGatewayType" TEXT;

CREATE INDEX "orders_paymentGatewayType_idx" ON "orders"("paymentGatewayType");
