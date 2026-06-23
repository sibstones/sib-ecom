import { buildSitemapIndexXml, buildUrlsetXml } from '../../services/sitemap.service';

describe('sitemap XML builders', () => {
  it('builds a valid urlset with escaped values', () => {
    const xml = buildUrlsetXml([
      {
        loc: 'https://example.com/shop?category=men&sale=1',
        lastmod: '2026-06-11T12:00:00.000Z',
        changefreq: 'weekly',
        priority: 0.8,
      },
    ]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(
      '<loc>https://example.com/shop?category=men&amp;sale=1</loc>'
    );
    expect(xml).toContain('<lastmod>2026-06-11T12:00:00.000Z</lastmod>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.8</priority>');
  });

  it('builds a sitemap index', () => {
    const xml = buildSitemapIndexXml([
      {
        loc: 'https://example.com/sitemap-static.xml',
        lastmod: new Date('2026-06-10T00:00:00.000Z'),
      },
      {
        loc: 'https://example.com/sitemap-products.xml',
        lastmod: new Date('2026-06-11T00:00:00.000Z'),
      },
    ]);

    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://example.com/sitemap-static.xml</loc>');
    expect(xml).toContain('<loc>https://example.com/sitemap-products.xml</loc>');
  });

  it('includes Google/Yandex image extension for product pages', () => {
    const xml = buildUrlsetXml([
      {
        loc: 'https://example.com/shop/product/dress',
        lastmod: '2026-06-11T12:00:00.000Z',
        images: [
          {
            loc: 'https://cdn.example.com/dress.jpg',
            title: 'Summer dress',
            caption: 'Front view',
          },
        ],
      },
    ]);

    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain('<image:loc>https://cdn.example.com/dress.jpg</image:loc>');
    expect(xml).toContain('<image:title>Summer dress</image:title>');
    expect(xml).toContain('<image:caption>Front view</image:caption>');
  });
});
