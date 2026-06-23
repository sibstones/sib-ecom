/**
 * Stripe: unit_amount is smallest currency unit (cents), except zero-decimal and three-decimal ISO codes.
 * @see https://docs.stripe.com/currencies
 */
const STRIPE_ZERO_DECIMAL = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

const STRIPE_THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

export function toStripeUnitAmount(amountMajor: number, currency: string): number {
  const c = currency.trim().toUpperCase();
  if (STRIPE_ZERO_DECIMAL.has(c)) {
    return Math.round(amountMajor);
  }
  if (STRIPE_THREE_DECIMAL.has(c)) {
    return Math.round(amountMajor * 1000);
  }
  return Math.round(amountMajor * 100);
}

/** YooKassa amount.value: integer currencies vs 2-decimal. */
export function formatYooKassaAmountValue(amountMajor: number, currency: string): string {
  const c = currency.trim().toUpperCase();
  if (['JPY', 'KRW', 'VND', 'CLP', 'VUV', 'XAF', 'XOF', 'XPF'].includes(c)) {
    return String(Math.round(amountMajor));
  }
  return amountMajor.toFixed(2);
}
