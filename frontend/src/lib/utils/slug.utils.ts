/**
 * Converts a string to a URL-safe slug (lowercase, hyphens, alphanumeric).
 * Matches backend logic used in product/lookbook/blog services.
 */
export function slugify(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
