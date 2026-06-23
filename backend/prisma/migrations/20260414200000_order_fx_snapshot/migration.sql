ALTER TABLE "orders" ADD COLUMN "checkoutFxCapturedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "checkoutFxRatesSnapshot" JSONB;
