/** 16×16 PNG fallback when no custom favicon is configured. */
export const DEFAULT_FAVICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export const FAVICON_CACHE_MAX_AGE_SECONDS = 86_400;
