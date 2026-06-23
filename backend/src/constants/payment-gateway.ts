export const SUPPORTED_PAYMENT_GATEWAY_TYPES = [
  'STRIPE',
  'YOOKASSA',
  'BANK_TRANSFER',
  'CASH_ON_DELIVERY',
  'MANAGER_CHAT',
] as const;

export const ONLINE_PAYMENT_GATEWAY_TYPES = [
  'STRIPE',
  'YOOKASSA',
] as const;

export const MANUAL_PAYMENT_GATEWAY_TYPES = [
  'BANK_TRANSFER',
  'CASH_ON_DELIVERY',
  'MANAGER_CHAT',
] as const;

export type SupportedPaymentGatewayType = (typeof SUPPORTED_PAYMENT_GATEWAY_TYPES)[number];

export function normalizePaymentGatewayType(type: string | null | undefined): string {
  return String(type || '').trim().toUpperCase();
}

export function isSupportedPaymentGatewayType(type: string | null | undefined): type is SupportedPaymentGatewayType {
  return SUPPORTED_PAYMENT_GATEWAY_TYPES.includes(
    normalizePaymentGatewayType(type) as SupportedPaymentGatewayType
  );
}

export function isOnlinePaymentGatewayType(type: string | null | undefined): boolean {
  return ONLINE_PAYMENT_GATEWAY_TYPES.includes(
    normalizePaymentGatewayType(type) as (typeof ONLINE_PAYMENT_GATEWAY_TYPES)[number]
  );
}

export function isManualPaymentGatewayType(type: string | null | undefined): boolean {
  return MANUAL_PAYMENT_GATEWAY_TYPES.includes(
    normalizePaymentGatewayType(type) as (typeof MANUAL_PAYMENT_GATEWAY_TYPES)[number]
  );
}
