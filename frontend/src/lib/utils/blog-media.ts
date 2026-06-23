import { BlogLayoutStyle, BlogMediaFormat, type BlogPost } from '$lib/api/blog.api';

const SQUARE_THRESHOLD = 0.08;

export function inferMediaFormat(width?: number, height?: number): BlogMediaFormat {
  if (!width || !height) {
    return BlogMediaFormat.AUTO;
  }

  const ratio = width / height;
  if (Math.abs(ratio - 1) <= SQUARE_THRESHOLD) {
    return BlogMediaFormat.SQUARE;
  }

  return ratio > 1 ? BlogMediaFormat.LANDSCAPE : BlogMediaFormat.PORTRAIT;
}

export function getLayoutDefaultFormat(layoutStyle?: BlogLayoutStyle | null): BlogMediaFormat {
  switch (layoutStyle) {
    case BlogLayoutStyle.INSTAGRAM:
      return BlogMediaFormat.SQUARE;
    case BlogLayoutStyle.TIKTOK:
      return BlogMediaFormat.PORTRAIT;
    case BlogLayoutStyle.MIXED:
      return BlogMediaFormat.AUTO;
    case BlogLayoutStyle.MAGAZINE:
    default:
      return BlogMediaFormat.LANDSCAPE;
  }
}

export function resolveBlogPostFormat(
  post: Pick<BlogPost, 'displayFormat'>,
  layoutStyle?: BlogLayoutStyle | null,
  inferredFormat?: BlogMediaFormat
): BlogMediaFormat {
  if (post.displayFormat && post.displayFormat !== BlogMediaFormat.AUTO) {
    return post.displayFormat;
  }

  if (inferredFormat && inferredFormat !== BlogMediaFormat.AUTO) {
    return inferredFormat;
  }

  return getLayoutDefaultFormat(layoutStyle);
}

export function getAspectClass(format: BlogMediaFormat): string {
  switch (format) {
    case BlogMediaFormat.SQUARE:
      return 'aspect-square';
    case BlogMediaFormat.PORTRAIT:
      return 'aspect-[9/16]';
    case BlogMediaFormat.LANDSCAPE:
    case BlogMediaFormat.AUTO:
    default:
      return 'aspect-video';
  }
}

export function getFormatLabel(format: BlogMediaFormat): string {
  switch (format) {
    case BlogMediaFormat.LANDSCAPE:
      return '16:9';
    case BlogMediaFormat.PORTRAIT:
      return '9:16';
    case BlogMediaFormat.SQUARE:
      return 'Square';
    case BlogMediaFormat.AUTO:
    default:
      return 'Auto';
  }
}
