import { InventoryStatus } from '@prisma/client';
import prisma from '../config/database';
import { isLocalDevUrl, resolveFrontendBaseUrl } from '../utils/frontend-url';
import { settingsService } from './settings.service';

export type SitemapChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface SitemapImage {
  loc: string;
  title?: string;
  caption?: string;
}

export interface SitemapUrl {
  loc: string;
  lastmod?: Date | string | null;
  changefreq?: SitemapChangeFreq;
  priority?: number;
  images?: SitemapImage[];
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: Date | string | null;
}

const MAX_URLS_PER_SITEMAP = 45_000;

const STOREFRONT_INVENTORY_STATUSES = [InventoryStatus.IN_SALE, InventoryStatus.COMING_SOON] as const;

/** CMS slugs that collide with fixed app routes — do not list in sitemap. */
const RESERVED_PAGE_SLUGS = new Set([
  'admin',
  'account',
  'api',
  'auth',
  'blog',
  'cart',
  'checkout',
  'forgot-password',
  'home',
  'login',
  'lookbook',
  'payment',
  'register',
  'reset-password',
  'shop',
  'verify-email',
]);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** W3C Datetime (ISO 8601) — recommended by Google Search Central. */
function formatLastmod(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function resolveMediaUrl(baseUrl: string, ref: string | null | undefined): string | null {
  if (!ref || !String(ref).trim()) return null;
  const trimmed = String(ref).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return joinUrl(baseUrl, trimmed);
}

function getPreferredHost(baseUrl: string): string | null {
  if (isLocalDevUrl(baseUrl)) return null;
  try {
    return new URL(baseUrl).host;
  } catch {
    return null;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  if (!path || path === '/') return `${normalizedBase}/`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildImageXml(images: SitemapImage[]): string {
  return images
    .map((image) => {
      const parts = [`      <image:loc>${escapeXml(image.loc)}</image:loc>`];
      if (image.title) parts.push(`      <image:title>${escapeXml(image.title)}</image:title>`);
      if (image.caption) parts.push(`      <image:caption>${escapeXml(image.caption)}</image:caption>`);
      return `    <image:image>\n${parts.join('\n')}\n    </image:image>`;
    })
    .join('\n');
}

export function buildUrlsetXml(urls: SitemapUrl[]): string {
  const hasImages = urls.some((entry) => entry.images && entry.images.length > 0);
  const xmlns = hasImages
    ? 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

  const body = urls
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
      const lastmod = formatLastmod(entry.lastmod);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority != null) parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      if (entry.images && entry.images.length > 0) {
        parts.push(buildImageXml(entry.images));
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset ${xmlns}>`,
    body,
    '</urlset>',
  ].join('\n');
}

export function buildSitemapIndexXml(entries: SitemapIndexEntry[]): string {
  const body = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
      const lastmod = formatLastmod(entry.lastmod);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</sitemapindex>',
  ].join('\n');
}

function chunkUrls<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function maxLastmod(urls: SitemapUrl[]): Date | undefined {
  let max: Date | undefined;
  for (const url of urls) {
    if (!url.lastmod) continue;
    const date = url.lastmod instanceof Date ? url.lastmod : new Date(url.lastmod);
    if (Number.isNaN(date.getTime())) continue;
    if (!max || date > max) max = date;
  }
  return max;
}

export class SitemapService {
  async getBaseUrl(): Promise<string> {
    return resolveFrontendBaseUrl();
  }

  async isLookbookEnabled(): Promise<boolean> {
    const value = await settingsService.getSetting('lookbookEnabled');
    return value === true;
  }

  async getStaticUrls(baseUrl: string): Promise<SitemapUrl[]> {
    const now = new Date();
    const urls: SitemapUrl[] = [
      { loc: joinUrl(baseUrl, '/'), lastmod: now, changefreq: 'daily', priority: 1.0 },
      { loc: joinUrl(baseUrl, '/shop'), lastmod: now, changefreq: 'daily', priority: 0.9 },
      { loc: joinUrl(baseUrl, '/blog'), lastmod: now, changefreq: 'daily', priority: 0.8 },
    ];

    if (await this.isLookbookEnabled()) {
      urls.push({
        loc: joinUrl(baseUrl, '/lookbook'),
        lastmod: now,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    const [categories, brands, pages] = await Promise.all([
      prisma.category.findMany({
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.brand.findMany({
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.page.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    for (const category of categories) {
      urls.push({
        loc: joinUrl(baseUrl, `/shop?category=${encodeURIComponent(category.slug)}`),
        lastmod: category.updatedAt,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }

    for (const brand of brands) {
      urls.push({
        loc: joinUrl(baseUrl, `/shop?brand=${encodeURIComponent(brand.slug)}`),
        lastmod: brand.updatedAt,
        changefreq: 'weekly',
        priority: 0.6,
      });
    }

    for (const page of pages) {
      if (RESERVED_PAGE_SLUGS.has(page.slug)) continue;
      urls.push({
        loc: joinUrl(baseUrl, `/${page.slug}`),
        lastmod: page.updatedAt,
        changefreq: 'monthly',
        priority: 0.5,
      });
    }

    return urls;
  }

  async getProductUrls(baseUrl: string): Promise<SitemapUrl[]> {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        inventory: {
          some: {
            status: { in: [...STOREFRONT_INVENTORY_STATUSES] },
            quantity: { gt: 0 },
          },
        },
      },
      select: {
        slug: true,
        name: true,
        updatedAt: true,
        images: {
          orderBy: { order: 'asc' },
          take: 3,
          select: { url: true, alt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return products.map((product) => {
      const images: SitemapImage[] = [];
      for (const image of product.images) {
        const loc = resolveMediaUrl(baseUrl, image.url);
        if (!loc) continue;
        images.push({
          loc,
          title: product.name,
          caption: image.alt || product.name,
        });
      }

      return {
        loc: joinUrl(baseUrl, `/shop/product/${product.slug}`),
        lastmod: product.updatedAt,
        changefreq: 'weekly' as const,
        priority: 0.8,
        images: images.length > 0 ? images : undefined,
      };
    });
  }

  async getBlogPostUrls(baseUrl: string): Promise<SitemapUrl[]> {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        title: true,
        updatedAt: true,
        publishedAt: true,
        thumbnailUrl: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    return posts.map((post) => {
      const thumbnail = resolveMediaUrl(baseUrl, post.thumbnailUrl);
      const images = thumbnail
        ? [{ loc: thumbnail, title: post.title, caption: post.title }]
        : undefined;

      return {
        loc: joinUrl(baseUrl, `/blog/${post.slug}`),
        lastmod: post.updatedAt || post.publishedAt,
        changefreq: 'monthly' as const,
        priority: 0.6,
        images,
      };
    });
  }

  async getLookbookUrls(baseUrl: string): Promise<SitemapUrl[]> {
    if (!(await this.isLookbookEnabled())) return [];

    const lookbooks = await prisma.lookbook.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    return lookbooks.map((lookbook) => ({
      loc: joinUrl(baseUrl, `/lookbook/${lookbook.slug}`),
      lastmod: lookbook.updatedAt,
      changefreq: 'monthly' as const,
      priority: 0.7,
    }));
  }

  async getSitemapIndexXml(): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const [staticUrls, productUrls, blogUrls, lookbookUrls] = await Promise.all([
      this.getStaticUrls(baseUrl),
      this.getProductUrls(baseUrl),
      this.getBlogPostUrls(baseUrl),
      this.getLookbookUrls(baseUrl),
    ]);

    const entries: SitemapIndexEntry[] = [
      {
        loc: joinUrl(baseUrl, '/sitemap-static.xml'),
        lastmod: maxLastmod(staticUrls),
      },
    ];

    const productChunks = chunkUrls(productUrls, MAX_URLS_PER_SITEMAP);
    if (productChunks.length === 0) {
      // Keep products sitemap out of the index when the catalog is empty.
    } else if (productChunks.length === 1) {
      entries.push({
        loc: joinUrl(baseUrl, '/sitemap-products.xml'),
        lastmod: maxLastmod(productChunks[0]),
      });
    } else {
      productChunks.forEach((chunk, index) => {
        entries.push({
          loc: joinUrl(baseUrl, `/sitemap-products-${index + 1}.xml`),
          lastmod: maxLastmod(chunk),
        });
      });
    }

    if (blogUrls.length > 0) {
      entries.push({
        loc: joinUrl(baseUrl, '/sitemap-blog.xml'),
        lastmod: maxLastmod(blogUrls),
      });
    }

    if (lookbookUrls.length > 0) {
      entries.push({
        loc: joinUrl(baseUrl, '/sitemap-lookbook.xml'),
        lastmod: maxLastmod(lookbookUrls),
      });
    }

    return buildSitemapIndexXml(entries);
  }

  async getStaticSitemapXml(): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const urls = await this.getStaticUrls(baseUrl);
    return buildUrlsetXml(urls);
  }

  async getProductsSitemapXml(chunk = 1): Promise<string | null> {
    const baseUrl = await this.getBaseUrl();
    const productUrls = await this.getProductUrls(baseUrl);
    const chunks = chunkUrls(productUrls, MAX_URLS_PER_SITEMAP);
    const selected = chunks[chunk - 1];
    if (!selected) return null;
    return buildUrlsetXml(selected);
  }

  async getBlogSitemapXml(): Promise<string | null> {
    const baseUrl = await this.getBaseUrl();
    const urls = await this.getBlogPostUrls(baseUrl);
    if (urls.length === 0) return null;
    return buildUrlsetXml(urls);
  }

  async getLookbookSitemapXml(): Promise<string | null> {
    const baseUrl = await this.getBaseUrl();
    const urls = await this.getLookbookUrls(baseUrl);
    if (urls.length === 0) return null;
    return buildUrlsetXml(urls);
  }

  private getCrawlDisallowRules(): string[] {
    return [
      'Disallow: /admin/',
      'Disallow: /account/',
      'Disallow: /api/',
      'Disallow: /checkout',
      'Disallow: /cart',
      'Disallow: /payment/',
      'Disallow: /login',
      'Disallow: /register',
      'Disallow: /forgot-password',
      'Disallow: /reset-password',
      'Disallow: /verify-email',
      'Disallow: /auth/',
    ];
  }

  async getRobotsTxt(): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const sitemapUrl = joinUrl(baseUrl, '/sitemap.xml');
    const preferredHost = getPreferredHost(baseUrl);
    const disallow = this.getCrawlDisallowRules();

    const lines = [
      '# Google, Bing, and other crawlers',
      'User-agent: *',
      'Allow: /',
      ...disallow,
      '',
      '# Yandex',
      'User-agent: Yandex',
      'Allow: /',
      ...disallow,
      'Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&utm_partner /',
      'Clean-param: page&sortBy&sortOrder&search&minPrice&maxPrice&color&material&size&inventoryStatus&dateFrom&dateTo /shop',
    ];

    if (preferredHost) {
      lines.push(`Host: ${preferredHost}`);
    }

    lines.push('', '# Sitemap (Google Search Console, Yandex Webmaster)', `Sitemap: ${sitemapUrl}`, '');

    return lines.join('\n');
  }
}

export const sitemapService = new SitemapService();
