import type { ProductColor } from '$lib/api/product.api';

export function normalizeAttributeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeHex(hex: string): string {
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  return h.toUpperCase();
}

export function findCatalogColorByName(
  name: string,
  catalog: ProductColor[]
): ProductColor | undefined {
  const key = normalizeAttributeKey(name);
  if (!key) return undefined;
  return catalog.find((c) => normalizeAttributeKey(c.name) === key);
}

export function findCatalogCountry(name: string, countries: string[]): string | undefined {
  const key = normalizeAttributeKey(name);
  if (!key) return undefined;
  return countries.find((c) => normalizeAttributeKey(c) === key);
}

export function applyCatalogColorHex(name: string, catalog: ProductColor[]): string | null {
  const match = findCatalogColorByName(name, catalog);
  return match ? normalizeHex(match.hex) : null;
}
