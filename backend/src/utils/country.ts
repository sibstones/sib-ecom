/**
 * Normalize country name/code to ISO 3166-1 alpha-2 for payment gateways.
 */
const NAME_TO_CODE: Record<string, string> = {
  russia: 'RU',
  'russian federation': 'RU',
  россия: 'RU',
  'российская федерация': 'RU',
  рф: 'RU',
  rossiya: 'RU',
  usa: 'US',
  'united states': 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  germany: 'DE',
  france: 'FR',
  italy: 'IT',
  spain: 'ES',
  japan: 'JP',
  china: 'CN',
  'south korea': 'KR',
  kazakhstan: 'KZ',
  belarus: 'BY',
  ukraine: 'UA',
};

export function normalizeCountryCode(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return 'US';
  const trimmed = input.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  return (NAME_TO_CODE[lower] ?? trimmed.toUpperCase().slice(0, 2)) || 'US';
}

/** Read tax rate from country settings; 0 is valid (do not use truthy checks). */
export function resolveTaxRate(
  countrySettings: { taxRate?: unknown } | null | undefined,
  defaultRate = 0
): number {
  if (countrySettings?.taxRate != null) {
    return Number(countrySettings.taxRate);
  }
  return defaultRate;
}
