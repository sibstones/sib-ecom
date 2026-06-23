// Currency configuration
export const supportedCurrencies = ['USD', 'EUR', 'GBP', 'RUB', 'JPY', 'CNY', 'KRW'];
export const defaultCurrency = 'USD';

// Default exchange rates (fallback if DB is not available)
export const defaultExchangeRates: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  RUB: 92.5,
  JPY: 149.5,
  CNY: 7.2,
  KRW: 1330.0,
};

/**
 * Round price to make it look nice
 * Rules:
 * - For RUB: round to nearest 10 (e.g., 1250 -> 1250, 1253 -> 1250, 1257 -> 1260)
 * - For JPY, KRW: round to nearest 10
 * - For EUR, GBP, CNY: round to 2 decimal places
 * - For USD: round to 2 decimal places
 */
export function roundPrice(amount: number, currency: string): number {
  // Round to nearest 10 for RUB, JPY, KRW
  if (['RUB', 'JPY', 'KRW'].includes(currency)) {
    return Math.round(amount / 10) * 10;
  }

  // Round to 2 decimal places for others
  return Math.round(amount * 100) / 100;
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  exchangeRates?: Record<string, number>
): number {
  if (from === to) {
    return roundPrice(amount, to);
  }

  const rates = exchangeRates || defaultExchangeRates;
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;

  // Convert to USD first, then to target currency
  const usdAmount = amount / fromRate;
  const convertedAmount = usdAmount * toRate;

  return roundPrice(convertedAmount, to);
}

export function formatCurrency(amount: number, currency: string): string {
  const formatters: Record<string, Intl.NumberFormat> = {
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    EUR: new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }),
    GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    RUB: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }),
    JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }),
    CNY: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }),
    KRW: new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }),
  };

  const formatter = formatters[currency] || formatters[defaultCurrency];
  return formatter.format(amount);
}
