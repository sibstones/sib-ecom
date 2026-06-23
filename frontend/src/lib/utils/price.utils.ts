import { currencyStore } from '../stores/currency.store';
import { get } from 'svelte/store';

/** API may return price as number, string, or Prisma Decimal-like object. */
export function toPriceNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.toNumber === 'function') return toPriceNumber((o.toNumber as () => unknown)());
    if (typeof o.valueOf === 'function') return toPriceNumber((o.valueOf as () => unknown)());
    if (o.value != null) return toPriceNumber(o.value);
  }
  return 0;
}

/**
 * Format price with currency conversion based on current currency
 * Products are stored in USD, so we convert from USD to current currency
 */
export function formatPrice(priceUsd: number | string): string {
  const price = toPriceNumber(priceUsd);
  if (price === 0) {
    return '$0.00';
  }

  const currentCurrency = get(currencyStore);
  const rates = currencyStore.getExchangeRates();

  // Convert from USD to current currency
  const convertedPrice = currencyStore.convert(price, 'USD', currentCurrency, rates);

  // Format with currency symbol
  return currencyStore.format(convertedPrice, currentCurrency);
}

/**
 * Get converted price as number (without formatting)
 */
export function getConvertedPrice(priceUsd: number | string): number {
  const price = toPriceNumber(priceUsd);
  if (price === 0) {
    return 0;
  }

  const currentCurrency = get(currencyStore);
  const rates = currencyStore.getExchangeRates();

  // Convert from USD to current currency
  return currencyStore.convert(price, 'USD', currentCurrency, rates);
}

/** Format an amount that is already expressed in `currency` (no USD→currency conversion). */
export function formatMoneyInCurrency(amount: number, currency: string): string {
  return currencyStore.format(amount, currency);
}

export type OrderFxSlice = {
  checkoutCurrency?: string | null;
  checkoutFxRatesSnapshot?: unknown | null;
};

/** Parse frozen FX snapshot from order (same semantics as backend order-pricing.service). */
export function parseCheckoutFxRatesSnapshot(raw: unknown): Record<string, number> | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && n > 0) {
      out[k.trim().toUpperCase()] = n;
    }
  }
  if (Object.keys(out).length === 0) {
    return null;
  }
  if (out['USD'] === undefined) {
    out['USD'] = 1.0;
  }
  return out;
}

/** Convert catalog-USD amount to the order checkout currency (one conversion, frozen rates when available). */
export function convertUsdForOrderDisplay(amountUsd: number, order: OrderFxSlice): number {
  const usd = toPriceNumber(amountUsd);
  const currency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
  if (currency === 'USD' || usd === 0) {
    return usd;
  }
  const snap = parseCheckoutFxRatesSnapshot(order.checkoutFxRatesSnapshot ?? null);
  const rates = snap || currencyStore.getExchangeRates();
  return currencyStore.convert(usd, 'USD', currency, rates);
}

/**
 * Format an order line item or total stored in USD using the order's checkout currency.
 * Do not use formatPrice() on order amounts — that applies the header currency and can double-convert.
 */
export function formatOrderAmount(amountUsd: number | string, order: OrderFxSlice): string {
  const usd = toPriceNumber(amountUsd);
  const currency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
  if (currency === 'USD') {
    return usd === 0 ? currencyStore.format(0, 'USD') : currencyStore.format(usd, 'USD');
  }
  return formatMoneyInCurrency(convertUsdForOrderDisplay(usd, order), currency);
}

/**
 * Format a checkout/cart summary line: amounts are either USD (catalog) or already in `amountCurrency`.
 */
export function formatCheckoutSummaryAmount(amount: number, amountCurrency: string): string {
  const cur = (amountCurrency || 'USD').trim().toUpperCase();
  if (cur === 'USD') {
    return formatPrice(amount);
  }
  return formatMoneyInCurrency(amount, cur);
}
