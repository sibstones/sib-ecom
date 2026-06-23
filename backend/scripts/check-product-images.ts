/**
 * Check DB: how many records in product_images for each product.
 * Run from backend folder: npx tsx scripts/check-product-images.ts
 * Need .env with DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; name: string; image_count: bigint }>
  >`
    SELECT p.id, p.name,
           (SELECT COUNT(*)::int FROM product_images pi WHERE pi."productId" = p.id) as image_count
    FROM products p
    ORDER BY p."createdAt" DESC
    LIMIT 30
  `;

  console.log('=== product_images: records per product (last 30 products) ===\n');
  for (const r of rows) {
    const count = typeof r.image_count === 'bigint' ? Number(r.image_count) : r.image_count;
    const mark = count === 0 ? ' ⚠️ no photos' : count === 1 ? ' ⚠️ one' : '';
    console.log(`${r.name.slice(0, 40).padEnd(42)} id=${r.id.slice(0, 8)}... images=${count}${mark}`);
  }

  // Detailed: all product_images rows for the product "AUHSUME WFOOF" (or the first with multiple photos)
  const withMany = rows.find((r) => {
    const c = typeof r.image_count === 'bigint' ? Number(r.image_count) : r.image_count;
    return c >= 2;
  });
  const productId = withMany?.id ?? rows[0]?.id;
  if (productId) {
    const images = await prisma.$queryRaw<
      Array<{ id: string; productId: string; order: number; url: string }>
    >`
      SELECT id, "productId", "order", LEFT(url, 60) as url
      FROM product_images
      WHERE "productId" = ${productId}
      ORDER BY "order" ASC
    `;
    const prodName = rows.find((r) => r.id === productId)?.name ?? productId;
    console.log(`\n=== All product_images rows for the product: ${prodName} (id=${productId.slice(0, 8)}...) ===`);
    console.log(`Total rows: ${images.length}\n`);
    images.forEach((img, i) => console.log(`  ${i + 1}. order=${img.order} id=${img.id.slice(0, 8)}... url=${img.url}...`));
  }
  console.log('\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
