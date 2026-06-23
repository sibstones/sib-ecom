/**
 * Get proper alt text for product images
 * If the alt text looks like a filename (contains file extension),
 * fall back to product name for better accessibility
 *
 * @param imageAlt - The alt text from the image object (may be null/undefined or a filename)
 * @param productName - The product name to use as fallback
 * @returns A proper alt text for accessibility
 */
export function getProductImageAlt(
  imageAlt: string | null | undefined,
  productName: string
): string {
  if (!imageAlt) return productName;

  // If alt text looks like a filename (contains file extension), use product name instead
  const filenamePattern = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
  if (filenamePattern.test(imageAlt)) {
    return productName;
  }

  return imageAlt;
}

/**
 * Detect if URL points to a video (by extension or path).
 * Used to render <video> instead of <img> in product galleries.
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes('.mp4') || u.includes('.webm') || u.includes('.mov') || u.includes('video/');
}

/** Item with at least url (e.g. ProductImage). */
type ImageLike = { url: string; alt?: string | null };

/**
 * Returns the first media item that is an image (not video).
 * Use for <img> src so video URLs are never passed to img (broken preview).
 */
export function getFirstImage(images: ImageLike[] | null | undefined): ImageLike | undefined {
  if (!images?.length) return undefined;
  for (const img of images) {
    if (img?.url && !isVideoUrl(img.url)) return img;
  }
  return undefined;
}

/**
 * Returns the URL of the first image (not video) from product media.
 */
export function getFirstImageUrl(images: ImageLike[] | null | undefined): string | undefined {
  return getFirstImage(images)?.url;
}

/**
 * Returns the first media item (image or video). Use when you need to show
 * a preview and will render either <img> or <video> based on isVideoUrl().
 */
export function getFirstMedia(images: ImageLike[] | null | undefined): ImageLike | undefined {
  if (!images?.length) return undefined;
  return images[0];
}
