export const SUPPORTED_PAYMENT_GATEWAY_TYPES = [
  'STRIPE',
  'YOOKASSA',
  'BANK_TRANSFER',
  'CASH_ON_DELIVERY',
  'MANAGER_CHAT',
] as const;

export const ONLINE_PAYMENT_GATEWAY_TYPES = ['STRIPE', 'YOOKASSA'] as const;

export function normalizePaymentGatewayType(type: string | null | undefined): string {
  return String(type || '')
    .trim()
    .toUpperCase();
}

export function isSupportedPaymentGatewayType(type: string | null | undefined): boolean {
  return SUPPORTED_PAYMENT_GATEWAY_TYPES.includes(
    normalizePaymentGatewayType(type) as (typeof SUPPORTED_PAYMENT_GATEWAY_TYPES)[number]
  );
}

export function isOnlinePaymentGatewayType(type: string | null | undefined): boolean {
  return ONLINE_PAYMENT_GATEWAY_TYPES.includes(
    normalizePaymentGatewayType(type) as (typeof ONLINE_PAYMENT_GATEWAY_TYPES)[number]
  );
}
