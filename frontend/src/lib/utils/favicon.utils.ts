/** MIME type for favicon from URL path (query/hash stripped). */
export function faviconMimeType(href: string): string | undefined {
  const path = String(href).split('?')[0].split('#')[0].toLowerCase();
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.ico') || path.endsWith('.x-icon')) return 'image/x-icon';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  return undefined;
}

export function faviconIsSvg(href: string): boolean {
  return faviconMimeType(href) === 'image/svg+xml';
}
