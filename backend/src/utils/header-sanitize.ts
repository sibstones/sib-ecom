import sanitizeHtml from 'sanitize-html';
import type {
  CreateHeaderSettingsDto,
  HeaderSettings,
  UpdateHeaderSettingsDto,
} from '../types/header';

const SVG_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'svg',
    'g',
    'path',
    'circle',
    'ellipse',
    'rect',
    'line',
    'polyline',
    'polygon',
    'defs',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
    'mask',
    'pattern',
    'symbol',
    'title',
    'desc',
  ],
  allowedAttributes: {
    svg: [
      'xmlns',
      'viewBox',
      'width',
      'height',
      'fill',
      'stroke',
      'stroke-width',
      'role',
      'aria-hidden',
      'focusable',
      'preserveAspectRatio',
      'class',
    ],
    g: [
      'fill',
      'stroke',
      'stroke-width',
      'transform',
      'opacity',
      'clip-path',
      'mask',
      'class',
    ],
    path: [
      'd',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'fill-rule',
      'clip-rule',
      'transform',
      'opacity',
      'class',
    ],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'opacity', 'class'],
    ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity', 'class'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity', 'class'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-linecap', 'opacity', 'class'],
    polyline: ['points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'class'],
    polygon: ['points', 'fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'fill-rule', 'opacity', 'class'],
    defs: ['class'],
    linearGradient: ['id', 'x1', 'x2', 'y1', 'y2', 'gradientUnits', 'gradientTransform'],
    radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform'],
    stop: ['offset', 'stop-color', 'stop-opacity'],
    clipPath: ['id', 'clipPathUnits'],
    mask: ['id', 'maskUnits', 'maskContentUnits', 'x', 'y', 'width', 'height'],
    pattern: ['id', 'patternUnits', 'patternContentUnits', 'x', 'y', 'width', 'height', 'viewBox'],
    symbol: ['id', 'viewBox', 'preserveAspectRatio'],
    title: [],
    desc: [],
  },
  allowedSchemes: [],
  allowProtocolRelative: false,
  parser: {
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
  },
};

type HeaderIcon = {
  name: string;
  svg: string;
  link: string;
  visible: boolean;
};

type NavigationBlock = NonNullable<CreateHeaderSettingsDto['navigationBlocks']>[number];
type QuickLink = NonNullable<CreateHeaderSettingsDto['quickLinks']>[number];

function sanitizeSvgMarkup(markup: string | null | undefined): string | undefined {
  if (typeof markup !== 'string') return undefined;
  const trimmed = markup.trim();
  if (!trimmed) return undefined;

  const sanitized = sanitizeHtml(trimmed, SVG_SANITIZE_OPTIONS).trim();
  if (!sanitized.startsWith('<svg')) {
    return undefined;
  }

  return sanitized;
}

function sanitizeLink(link: string | null | undefined): string | undefined {
  if (typeof link !== 'string') return undefined;
  const trimmed = link.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('#')) return trimmed;

  try {
    const url = new URL(trimmed);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return trimmed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function sanitizeCustomIcons(value: unknown): HeaderIcon[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sanitized = value
    .map((item): HeaderIcon | null => {
      if (!item || typeof item !== 'object') return null;
      const icon = item as Partial<HeaderIcon>;
      const svg = sanitizeSvgMarkup(icon.svg);
      if (!svg) return null;

      return {
        name: typeof icon.name === 'string' ? icon.name.trim().slice(0, 120) : 'Custom icon',
        svg,
        link: sanitizeLink(icon.link) ?? '#',
        visible: Boolean(icon.visible),
      };
    })
    .filter((item): item is HeaderIcon => item !== null);

  return sanitized;
}

function sanitizeNavigationBlocks(value: unknown): NavigationBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sanitized = value
    .map((item, index): NavigationBlock | null => {
      if (!item || typeof item !== 'object') return null;
      const block = item as Partial<NavigationBlock>;
      const icon = sanitizeSvgMarkup(block.icon);

      return {
        id:
          typeof block.id === 'string' && block.id.trim()
            ? block.id.trim().slice(0, 120)
            : `block-${index + 1}`,
        type:
          block.type === 'language' ||
          block.type === 'search' ||
          block.type === 'profile' ||
          block.type === 'wishlist' ||
          block.type === 'cart' ||
          block.type === 'custom'
            ? block.type
            : 'custom',
        enabled: Boolean(block.enabled),
        icon,
        link: sanitizeLink(block.link),
        label:
          typeof block.label === 'string' && block.label.trim()
            ? block.label.trim().slice(0, 120)
            : undefined,
        order:
          typeof block.order === 'number' && Number.isFinite(block.order)
            ? block.order
            : index,
      };
    })
    .filter((item): item is NavigationBlock => item !== null);

  return sanitized;
}

function sanitizeQuickLinks(value: unknown): QuickLink[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sanitized = value
    .map((item): QuickLink | null => {
      if (!item || typeof item !== 'object') return null;
      const link = item as Partial<QuickLink>;
      const safeLink = sanitizeLink(link.link);
      if (!safeLink) return null;

      return {
        label:
          typeof link.label === 'string' && link.label.trim()
            ? link.label.trim().slice(0, 160)
            : 'Link',
        link: safeLink,
        visible: Boolean(link.visible),
      };
    })
    .filter((item): item is QuickLink => item !== null);

  return sanitized;
}

export function sanitizeHeaderSettingsInput<T extends CreateHeaderSettingsDto | UpdateHeaderSettingsDto>(
  data: T
): T {
  const sanitized = { ...data } as T;

  if ('logoSvg' in sanitized) {
    sanitized.logoSvg = sanitizeSvgMarkup(sanitized.logoSvg) ?? undefined;
  }
  if ('logoLink' in sanitized) {
    sanitized.logoLink = sanitizeLink(sanitized.logoLink) ?? '/';
  }
  if ('logoImageUrl' in sanitized && sanitized.logoImageUrl) {
    sanitized.logoImageUrl = sanitizeLink(sanitized.logoImageUrl) ?? undefined;
  }
  if ('customIcons' in sanitized && sanitized.customIcons !== undefined) {
    sanitized.customIcons = sanitizeCustomIcons(sanitized.customIcons);
  }
  if ('navigationBlocks' in sanitized && sanitized.navigationBlocks !== undefined) {
    sanitized.navigationBlocks = sanitizeNavigationBlocks(sanitized.navigationBlocks);
  }
  if ('quickLinks' in sanitized && sanitized.quickLinks !== undefined) {
    sanitized.quickLinks = sanitizeQuickLinks(sanitized.quickLinks);
  }

  return sanitized;
}

export function sanitizeHeaderSettingsOutput<T extends HeaderSettings | Record<string, unknown>>(settings: T): T {
  const sanitized = { ...settings } as T & Record<string, unknown>;

  if ('logoSvg' in sanitized) {
    sanitized.logoSvg = sanitizeSvgMarkup(sanitized.logoSvg as string | undefined) ?? null;
  }
  if ('logoLink' in sanitized) {
    sanitized.logoLink = sanitizeLink(sanitized.logoLink as string | undefined) ?? '/';
  }
  if ('logoImageUrl' in sanitized && sanitized.logoImageUrl) {
    sanitized.logoImageUrl = sanitizeLink(sanitized.logoImageUrl as string | undefined) ?? null;
  }
  if ('customIcons' in sanitized) {
    sanitized.customIcons = sanitizeCustomIcons(sanitized.customIcons) ?? [];
  }
  if ('navigationBlocks' in sanitized) {
    sanitized.navigationBlocks = sanitizeNavigationBlocks(sanitized.navigationBlocks) ?? [];
  }
  if ('quickLinks' in sanitized) {
    sanitized.quickLinks = sanitizeQuickLinks(sanitized.quickLinks) ?? [];
  }

  return sanitized as T;
}
