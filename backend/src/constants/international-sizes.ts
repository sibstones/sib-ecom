/** Standard INTERNATIONAL clothing sizes (ready-to-wear). Excludes EU/US numeric, cm, ml, g, etc. */
export const INTERNATIONAL_CLOTHING_SIZES = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  'XXXL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
] as const;

export type InternationalClothingSize = (typeof INTERNATIONAL_CLOTHING_SIZES)[number];

const INTERNATIONAL_SIZE_SET = new Set<string>(INTERNATIONAL_CLOTHING_SIZES);

export function normalizeInternationalSize(size: string): string {
  return size.trim().toUpperCase();
}

export function isInternationalClothingSize(size: string): boolean {
  return INTERNATIONAL_SIZE_SET.has(normalizeInternationalSize(size));
}

export function sortInternationalSizes(sizes: string[]): string[] {
  const order = new Map<string, number>(
    INTERNATIONAL_CLOTHING_SIZES.map((s, i) => [s, i])
  );
  return [...sizes].sort((a, b) => {
    const ai = order.get(normalizeInternationalSize(a)) ?? 999;
    const bi = order.get(normalizeInternationalSize(b)) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}
