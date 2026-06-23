import sharp from 'sharp';

const FAVICON_SIZE = 32;
const APPLE_TOUCH_SIZE = 180;

function isSvg(contentType: string, buffer: Buffer): boolean {
  if (contentType.includes('svg')) return true;
  const head = buffer.subarray(0, 256).toString('utf8').trimStart();
  return head.startsWith('<svg') || head.startsWith('<?xml');
}

async function rasterize(
  buffer: Buffer,
  contentType: string,
  size: number,
  background: sharp.Color
): Promise<Buffer> {
  const pipeline = sharp(buffer, isSvg(contentType, buffer) ? { density: 300 } : undefined)
    .resize(size, size, {
      fit: 'contain',
      background,
    })
    .png();

  return pipeline.toBuffer();
}

/** Tab favicon: always PNG 32×32 (Safari/Yandex ignore SVG at /favicon.ico). */
export async function toFaviconPng(buffer: Buffer, contentType: string): Promise<Buffer> {
  if (
    contentType === 'image/png' &&
    buffer.length < 8_192
  ) {
    const meta = await sharp(buffer).metadata();
    if (meta.width === FAVICON_SIZE && meta.height === FAVICON_SIZE) {
      return buffer;
    }
  }

  return rasterize(buffer, contentType, FAVICON_SIZE, { r: 0, g: 0, b: 0, alpha: 0 });
}

/** iOS / Safari home screen: PNG 180×180. */
export async function toAppleTouchPng(buffer: Buffer, contentType: string): Promise<Buffer> {
  return rasterize(buffer, contentType, APPLE_TOUCH_SIZE, { r: 255, g: 255, b: 255, alpha: 1 });
}

/** Optional crisp icon for Chrome/Firefox when source is SVG. */
export function canServeAsSvg(contentType: string, buffer: Buffer): boolean {
  return isSvg(contentType, buffer);
}
