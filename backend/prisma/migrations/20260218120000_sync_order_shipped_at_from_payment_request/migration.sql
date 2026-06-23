-- Sync Order.shippedAt from PaymentRequest for orders that were marked as shipped
-- before the fix (markAsShipped now sets both). Required for delivery/accounting reports.
UPDATE orders o
SET "shippedAt" = pr."shippedAt"
FROM payment_requests pr
WHERE pr."orderId" = o.id
  AND o."shippedAt" IS NULL
  AND pr."shippedAt" IS NOT NULL;
