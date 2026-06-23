-- Checkout / payment display currency (order line totals remain USD in DB)
ALTER TABLE "orders" ADD COLUMN "checkoutCurrency" TEXT NOT NULL DEFAULT 'USD';
