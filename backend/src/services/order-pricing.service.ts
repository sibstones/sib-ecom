import { currencyRateService } from './currency-rate.service';

/** Parse Prisma Json snapshot into uppercased rate map; ensures USD = 1. */
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

type OrderPaymentSlice = {
  checkoutCurrency: string;
  checkoutFxRatesSnapshot?: unknown | null;
};

/**
 * Convert a catalog-USD amount to the order's checkout currency using the frozen snapshot when present.
 */
export async function convertUsdForOrderPayment(
  amountUsd: number,
  order: OrderPaymentSlice
): Promise<number> {
  const cur = (order.checkoutCurrency || 'USD').trim().toUpperCase();
  if (cur === 'USD') {
    return currencyRateService.convertWithRatesMap(amountUsd, 'USD', 'USD', { USD: 1 });
  }
  const snap = parseCheckoutFxRatesSnapshot(order.checkoutFxRatesSnapshot ?? null);
  if (snap) {
    try {
      return currencyRateService.convertWithRatesMap(amountUsd, 'USD', cur, snap);
    } catch {
      // fall through to live rates
    }
  }
  return currencyRateService.convert(amountUsd, 'USD', cur);
}

/** Convert catalog-USD to another ISO code using the order’s frozen snapshot when possible (e.g. WeChat Pay in CNY). */
export async function convertUsdToCurrencyWithOrderFxSnapshot(
  amountUsd: number,
  order: OrderPaymentSlice,
  targetCurrency: string
): Promise<number> {
  const tgt = (targetCurrency || 'USD').trim().toUpperCase();
  const snap = parseCheckoutFxRatesSnapshot(order.checkoutFxRatesSnapshot ?? null);
  if (snap) {
    try {
      return currencyRateService.convertWithRatesMap(amountUsd, 'USD', tgt, snap);
    } catch {
      // fall through
    }
  }
  return currencyRateService.convert(amountUsd, 'USD', tgt);
}
