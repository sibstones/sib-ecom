import type { Country } from '@prisma/client';
import { resolveTaxRate, normalizeCountryCode } from '../utils/country';

export type CheckoutUsdTotals = {
  subtotalAfterDiscount: number;
  tax: number;
  shipping: number;
  total: number;
  taxRate: number;
};

/** Same country resolution for checkout preview and order creation. */
export async function resolveCountrySettingsForCheckout(
  countryCode: string,
  checkoutCurrency?: string
): Promise<Country | null> {
  const { countryService } = await import('./country.service');
  const code = normalizeCountryCode(countryCode);
  const currency = (checkoutCurrency || '').trim().toUpperCase();

  let countrySettings: Country | null = null;
  try {
    countrySettings = await countryService.getByCode(code);
  } catch {
    // fall through
  }

  if (
    currency &&
    (!countrySettings ||
      (countrySettings.currency || '').trim().toUpperCase() !== currency)
  ) {
    const byCurrency = await countryService.getByCurrency(currency);
    if (byCurrency) {
      countrySettings = byCurrency;
    }
  }

  return countrySettings;
}

async function resolveShippingUsd(countrySettings: Country | null): Promise<{
  shippingCostUSD: number;
  freeShippingThresholdUSD: number;
}> {
  let shippingCostUSD = 10;
  let freeShippingThresholdUSD = 100;

  if (!countrySettings) {
    return { shippingCostUSD, freeShippingThresholdUSD };
  }

  const countryCurrency = (countrySettings.currency || 'USD').trim().toUpperCase();
  const rawShipping =
    countrySettings.shippingCost != null ? Number(countrySettings.shippingCost) : 10;
  const rawThreshold =
    countrySettings.freeShippingThreshold != null
      ? Number(countrySettings.freeShippingThreshold)
      : 100;

  try {
    const { currencyRateService } = await import('./currency-rate.service');
    shippingCostUSD =
      countryCurrency === 'USD'
        ? rawShipping
        : await currencyRateService.convert(rawShipping, countryCurrency, 'USD');
    freeShippingThresholdUSD =
      countryCurrency === 'USD'
        ? rawThreshold
        : await currencyRateService.convert(rawThreshold, countryCurrency, 'USD');
  } catch {
    const { defaultExchangeRates } = await import('../config/currency');
    const rate = defaultExchangeRates[countryCurrency] || 1;
    shippingCostUSD = countryCurrency === 'USD' ? rawShipping : rawShipping / rate;
    freeShippingThresholdUSD =
      countryCurrency === 'USD' ? rawThreshold : rawThreshold / rate;
  }

  if (shippingCostUSD > 500) shippingCostUSD = 10;
  if (freeShippingThresholdUSD > 500) freeShippingThresholdUSD = 100;

  return { shippingCostUSD, freeShippingThresholdUSD };
}

/**
 * USD totals for checkout preview and persisting on Order (must stay in sync).
 */
export async function computeCheckoutUsdTotals(params: {
  countryCode: string;
  checkoutCurrency?: string;
  subtotalUsd: number;
  discountUsd?: number;
  loyaltyDiscountUsd?: number;
}): Promise<CheckoutUsdTotals> {
  const discountUsd = params.discountUsd ?? 0;
  const loyaltyDiscountUsd = params.loyaltyDiscountUsd ?? 0;
  const countrySettings = await resolveCountrySettingsForCheckout(
    params.countryCode,
    params.checkoutCurrency
  );
  const taxRate = resolveTaxRate(countrySettings, 0.1);
  const { shippingCostUSD, freeShippingThresholdUSD } = await resolveShippingUsd(countrySettings);

  const subtotalAfterDiscount = Math.max(
    0,
    params.subtotalUsd - discountUsd - loyaltyDiscountUsd
  );
  const tax = subtotalAfterDiscount * taxRate;
  const shipping =
    freeShippingThresholdUSD > 0 && subtotalAfterDiscount >= freeShippingThresholdUSD
      ? 0
      : shippingCostUSD;
  const total = subtotalAfterDiscount + tax + shipping;

  return { subtotalAfterDiscount, tax, shipping, total, taxRate };
}
