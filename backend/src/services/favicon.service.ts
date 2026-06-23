import prisma from '../config/database';
import { DEFAULT_FAVICON_PNG, FAVICON_CACHE_MAX_AGE_SECONDS } from '../constants/default-favicon';
import { storageService } from './storage.service';
import { canServeAsSvg, toAppleTouchPng, toFaviconPng } from '../utils/site-icon.utils';

export interface SiteIconPayload {
  buffer: Buffer;
  contentType: string;
  etag: string;
  cacheMaxAge: number;
}

export type SiteIconResult = SiteIconPayload | 'redirect-favicon' | 'use-default';

type IconVariant = 'favicon' | 'apple-touch' | 'svg';

const processedCache = new Map<string, SiteIconPayload>();

function mimeFromUrl(url: string): string {
  const path = url.split('?')[0].split('#')[0].toLowerCase();
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.ico') || path.endsWith('.x-icon')) return 'image/x-icon';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

async function getSettingUrl(key: string): Promise<{ url: string; etag: string }> {
  const setting = await prisma.featureSettings.findUnique({ where: { key } });
  const raw = setting?.value;
  const url = raw != null && String(raw).trim() ? String(raw).trim() : '';
  const version = setting?.updatedAt?.getTime() ?? 0;
  return { url, etag: `"${key}-${version}"` };
}

async function loadIconFromUrl(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const fromStorage = await storageService.getFileBuffer(url);
  if (fromStorage) {
    const contentType =
      fromStorage.contentType !== 'application/octet-stream'
        ? fromStorage.contentType
        : mimeFromUrl(url);
    return { buffer: fromStorage.buffer, contentType };
  }

  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() || mimeFromUrl(url);

    return { buffer, contentType };
  } catch (error) {
    console.warn('[Favicon] Failed to fetch icon URL:', url, error);
    return null;
  }
}

async function loadSourceIcon(
  primaryKey: string,
  fallbackKey: string | null
): Promise<{ buffer: Buffer; contentType: string; etag: string } | null> {
  const primary = await getSettingUrl(primaryKey);
  const candidates = [primary.url];

  if (fallbackKey) {
    const fallback = await getSettingUrl(fallbackKey);
    if (fallback.url) {
      candidates.push(fallback.url);
    }
  }

  for (const url of candidates) {
    if (!url) continue;
    const loaded = await loadIconFromUrl(url);
    if (loaded) {
      return {
        buffer: loaded.buffer,
        contentType: loaded.contentType || mimeFromUrl(url),
        etag: primary.etag,
      };
    }
  }

  return null;
}

async function processIcon(
  variant: IconVariant,
  primaryKey: string,
  fallbackKey: string | null
): Promise<SiteIconResult> {
  const cacheKey = `${variant}:${primaryKey}:${fallbackKey ?? ''}`;
  const source = await loadSourceIcon(primaryKey, fallbackKey);

  if (!source) {
    return 'use-default';
  }

  if (variant === 'svg' && !canServeAsSvg(source.contentType, source.buffer)) {
    return 'redirect-favicon';
  }

  const etag = `${source.etag.slice(0, -1)}-${variant}"`;
  const cached = processedCache.get(cacheKey);
  if (cached?.etag === etag) {
    return cached;
  }

  let buffer: Buffer;
  let contentType: string;

  if (variant === 'svg') {
    buffer = source.buffer;
    contentType = 'image/svg+xml';
  } else if (variant === 'apple-touch') {
    buffer = await toAppleTouchPng(source.buffer, source.contentType);
    contentType = 'image/png';
  } else {
    buffer = await toFaviconPng(source.buffer, source.contentType);
    contentType = 'image/png';
  }

  const payload: SiteIconPayload = {
    buffer,
    contentType,
    etag,
    cacheMaxAge: FAVICON_CACHE_MAX_AGE_SECONDS,
  };

  processedCache.set(cacheKey, payload);
  return payload;
}

function defaultPayload(): SiteIconPayload {
  return {
    buffer: DEFAULT_FAVICON_PNG,
    contentType: 'image/png',
    etag: '"default"',
    cacheMaxAge: FAVICON_CACHE_MAX_AGE_SECONDS,
  };
}

export class FaviconService {
  async getFavicon(): Promise<SiteIconPayload> {
    const result = await processIcon('favicon', 'siteFaviconUrl', null);
    return result === 'use-default' || result === 'redirect-favicon'
      ? defaultPayload()
      : result;
  }

  async getFaviconSvg(): Promise<SiteIconResult> {
    return processIcon('svg', 'siteFaviconUrl', null);
  }

  async getAppleTouchIcon(): Promise<SiteIconPayload> {
    const result = await processIcon('apple-touch', 'siteAppleTouchIconUrl', 'siteFaviconUrl');
    return result === 'use-default' || result === 'redirect-favicon'
      ? defaultPayload()
      : result;
  }
}

export const faviconService = new FaviconService();
