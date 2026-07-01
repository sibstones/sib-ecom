const ALLOWED_PUBLIC_PREFIXES = [
  'products',
  'homepage',
  'lookbook',
  'blog',
  'header',
  'site',
  'uploads',
] as const;

export function isAllowedPublicObjectKey(objectKey: string): boolean {
  if (!objectKey || objectKey.includes('..')) return false;
  const prefix = objectKey.split('/')[0];
  return ALLOWED_PUBLIC_PREFIXES.includes(prefix as (typeof ALLOWED_PUBLIC_PREFIXES)[number]);
}

function extractObjectKeyFromPathParts(parts: string[]): string | null {
  const prefixIndex = parts.findIndex((part) =>
    ALLOWED_PUBLIC_PREFIXES.includes(part as (typeof ALLOWED_PUBLIC_PREFIXES)[number])
  );
  if (prefixIndex < 0) return null;

  const objectKey = parts.slice(prefixIndex).join('/');
  if (!objectKey || objectKey.includes('..')) return null;
  return objectKey;
}

/** Strip bucket segment(s) from pathname-style input. */
export function normalizePublicObjectKey(input: string, bucketName: string): string | null {
  const trimmed = input.replace(/^\/+/, '').trim();
  if (!trimmed || trimmed.includes('..')) return null;

  const parts = trimmed.split('/').filter(Boolean);
  while (parts.length > 0 && parts[0] === bucketName) {
    parts.shift();
  }

  const objectKey = extractObjectKeyFromPathParts(parts);
  return objectKey && isAllowedPublicObjectKey(objectKey) ? objectKey : null;
}

export function resolvePublicObjectKey(
  storedUrlOrKey: string,
  bucketName: string
): string | null {
  if (!storedUrlOrKey || typeof storedUrlOrKey !== 'string') return null;

  try {
    const url = new URL(storedUrlOrKey);
    return normalizePublicObjectKey(url.pathname, bucketName);
  } catch {
    return normalizePublicObjectKey(storedUrlOrKey, bucketName);
  }
}
