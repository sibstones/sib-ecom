/**
 * Normalize address country value to 2-letter ISO code for payment/API.
 * Payment gateways use supportedCountries as ISO 3166-1 alpha-2 (e.g. US, RU).
 */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  russia: 'RU',
  'russian federation': 'RU',
  россия: 'RU',
  'российская федерация': 'RU',
  рф: 'RU',
  rossiya: 'RU',
  'united kingdom': 'GB',
  'great britain': 'GB',
  uk: 'GB',
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  italy: 'IT',
  spain: 'ES',
  japan: 'JP',
  china: 'CN',
  'south korea': 'KR',
  korea: 'KR',
  india: 'IN',
  brazil: 'BR',
  canada: 'CA',
  australia: 'AU',
  netherlands: 'NL',
  belgium: 'BE',
  switzerland: 'CH',
  austria: 'AT',
  poland: 'PL',
  turkey: 'TR',
  mexico: 'MX',
  argentina: 'AR',
  indonesia: 'ID',
  thailand: 'TH',
  vietnam: 'VN',
  uae: 'AE',
  'united arab emirates': 'AE',
  'saudi arabia': 'SA',
  singapore: 'SG',
  malaysia: 'MY',
  philippines: 'PH',
  'hong kong': 'HK',
  taiwan: 'TW',
  'new zealand': 'NZ',
  'south africa': 'ZA',
  egypt: 'EG',
  nigeria: 'NG',
  kenya: 'KE',
  ukraine: 'UA',
  kazakhstan: 'KZ',
  belarus: 'BY',
};

export function getCountryCode(country: string): string {
  if (!country || typeof country !== 'string') return 'US';
  const trimmed = country.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  return (COUNTRY_NAME_TO_CODE[lower] ?? trimmed.toUpperCase().slice(0, 2)) || 'US';
}

/** Infer currency from country code when order has no currency stored. */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  RU: 'RUB',
  KZ: 'KZT',
  BY: 'BYN',
  UA: 'UAH',
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  JP: 'JPY',
  CN: 'CNY',
  KR: 'KRW',
};

export function getCurrencyForCountry(countryCode: string): string {
  const cc = (countryCode || 'US').trim().toUpperCase();
  return COUNTRY_TO_CURRENCY[cc] || 'USD';
}
