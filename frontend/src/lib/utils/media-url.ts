const MEDIA_PROXY_PREFIX = '/api/media';

const ALLOWED_PUBLIC_PREFIXES = [
  'products',
  'homepage',
  'lookbook',
  'blog',
  'header',
  'site',
  'uploads',
];

function extractObjectKeyFromPathname(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const prefixIndex = parts.findIndex((part) => ALLOWED_PUBLIC_PREFIXES.includes(part));
  if (prefixIndex < 0) return null;

  const objectKey = parts.slice(prefixIndex).join('/');
  if (!objectKey || objectKey.includes('..')) return null;
  return objectKey;
}

export function isProxiedStorefrontMedia(url: string): boolean {
  return url.startsWith(MEDIA_PROXY_PREFIX);
}

/**
 * Same-origin media proxy — Chrome multiplexes one host; direct S3 stalls with many cards.
 */
export function resolveStorefrontMediaSrc(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith(MEDIA_PROXY_PREFIX)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;

    const objectKey = extractObjectKeyFromPathname(parsed.pathname);
    if (objectKey) {
      return `${MEDIA_PROXY_PREFIX}/${objectKey}`;
    }
  } catch {
    return url;
  }

  return url;
}
