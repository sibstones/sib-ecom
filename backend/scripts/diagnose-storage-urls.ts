/**
 * Compare homepage vs product media URLs: host/path shape, internal MinIO stat, public HTTP probe.
 *
 * Run from repo root or backend (needs .env with DATABASE_URL + MINIO_*):
 *   cd backend && npx tsx scripts/diagnose-storage-urls.ts
 *
 * Options:
 *   --limit=5          samples per source (default 5)
 *   --timeout=8000     public HTTP probe timeout ms (default 8000)
 *   --skip-http        only DB + internal MinIO checks
 */
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config/env';
import { storageService } from '../src/services/storage.service';

const prisma = new PrismaClient();

type UrlSample = {
  source: string;
  label: string;
  url: string;
};

type ProbeResult = {
  sample: UrlSample;
  host: string;
  pathname: string;
  prefix: string;
  internalExists: boolean | null;
  internalError: string | null;
  httpStatus: number | null;
  httpMs: number | null;
  httpError: string | null;
  contentLength: string | null;
  contentType: string | null;
};

function parseArgs() {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const timeoutArg = process.argv.find((arg) => arg.startsWith('--timeout='));
  return {
    limit: limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '5', 10) : 5,
    timeoutMs: timeoutArg ? Number.parseInt(timeoutArg.split('=')[1] ?? '8000', 10) : 8000,
    skipHttp: process.argv.includes('--skip-http'),
  };
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function collectUrlsFromJson(value: unknown, bucket: string[] = []): string[] {
  if (isHttpUrl(value)) {
    bucket.push(value.trim());
    return bucket;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrlsFromJson(item, bucket);
    }
    return bucket;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectUrlsFromJson(nested, bucket);
    }
  }

  return bucket;
}

function getPathPrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  const bucketName = config.minio.bucketName;
  const startIndex = parts[0] === bucketName ? 1 : 0;
  return parts[startIndex] ? `${parts[startIndex]}/` : '/';
}

async function probePublicUrl(url: string, timeoutMs: number): Promise<{
  status: number | null;
  ms: number | null;
  error: string | null;
  contentLength: string | null;
  contentType: string | null;
}> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Range: 'bytes=0-0',
      },
    });

    return {
      status: response.status,
      ms: Date.now() - started,
      error: null,
      contentLength: response.headers.get('content-length'),
      contentType: response.headers.get('content-type'),
    };
  } catch (error) {
    return {
      status: null,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      contentLength: null,
      contentType: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function collectSamples(limit: number): Promise<UrlSample[]> {
  const samples: UrlSample[] = [];

  const productImages = await prisma.productImage.findMany({
    select: { url: true, product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: Math.max(limit * 4, 20),
  });

  for (const image of productImages) {
    if (!isHttpUrl(image.url)) continue;
    samples.push({
      source: 'product_images',
      label: image.product.name.slice(0, 40),
      url: image.url.trim(),
    });
    if (samples.filter((s) => s.source === 'product_images').length >= limit) break;
  }

  const homepageSections = await prisma.homepageSection.findMany({
    select: { type: true, title: true, config: true },
    where: { isActive: true },
  });

  for (const section of homepageSections) {
    const urls = collectUrlsFromJson(section.config);
    for (const url of urls) {
      samples.push({
        source: 'homepage_sections',
        label: `${section.type}${section.title ? `: ${section.title}` : ''}`,
        url,
      });
      if (samples.filter((s) => s.source === 'homepage_sections').length >= limit) break;
    }
    if (samples.filter((s) => s.source === 'homepage_sections').length >= limit) break;
  }

  return samples;
}

function summarizeByPrefix(results: ProbeResult[]) {
  const groups = new Map<
    string,
    { count: number; internalOk: number; httpOk: number; httpFail: number }
  >();

  for (const result of results) {
    const key = `${result.host} :: ${result.prefix}`;
    const current = groups.get(key) ?? { count: 0, internalOk: 0, httpOk: 0, httpFail: 0 };
    current.count += 1;
    if (result.internalExists) current.internalOk += 1;
    if (result.httpStatus !== null && result.httpStatus >= 200 && result.httpStatus < 400) {
      current.httpOk += 1;
    } else if (result.httpError || (result.httpStatus !== null && result.httpStatus >= 400)) {
      current.httpFail += 1;
    }
    groups.set(key, current);
  }

  return groups;
}

async function main() {
  const { limit, timeoutMs, skipHttp } = parseArgs();

  console.log('=== Storage URL diagnostics ===\n');
  console.log(`MINIO_ENDPOINT:      ${config.minio.endPoint}:${config.minio.port}`);
  console.log(`MINIO_BUCKET_NAME:   ${config.minio.bucketName}`);
  console.log(`MINIO_PUBLIC_URL:    ${config.minio.publicUrl}`);
  console.log(`HTTP probe timeout:  ${timeoutMs}ms${skipHttp ? ' (skipped)' : ''}\n`);

  const samples = await collectSamples(limit);
  if (samples.length === 0) {
    console.log('No HTTP media URLs found in product_images or homepage_sections.');
    return;
  }

  const results: ProbeResult[] = [];

  for (const sample of samples) {
    let host = '(invalid-url)';
    let pathname = '';
    let prefix = '/';

    try {
      const parsed = new URL(sample.url);
      host = parsed.host;
      pathname = parsed.pathname;
      prefix = getPathPrefix(pathname);
    } catch {
      // keep defaults
    }

    let internalExists: boolean | null = null;
    let internalError: string | null = null;

    try {
      internalExists = await storageService.fileExists(sample.url);
    } catch (error) {
      internalError = error instanceof Error ? error.message : String(error);
    }

    let httpStatus: number | null = null;
    let httpMs: number | null = null;
    let httpError: string | null = null;
    let contentLength: string | null = null;
    let contentType: string | null = null;

    if (!skipHttp) {
      const http = await probePublicUrl(sample.url, timeoutMs);
      httpStatus = http.status;
      httpMs = http.ms;
      httpError = http.error;
      contentLength = http.contentLength;
      contentType = http.contentType;
    }

    results.push({
      sample,
      host,
      pathname,
      prefix,
      internalExists,
      internalError,
      httpStatus,
      httpMs,
      httpError,
      contentLength,
      contentType,
    });
  }

  for (const result of results) {
    const { sample } = result;
    console.log(`[${sample.source}] ${sample.label}`);
    console.log(`  url:      ${sample.url}`);
    console.log(`  host:     ${result.host}`);
    console.log(`  prefix:   ${result.prefix}`);
    console.log(
      `  internal: ${
        result.internalExists === null
          ? `error (${result.internalError ?? 'unknown'})`
          : result.internalExists
            ? 'exists'
            : 'missing'
      }`
    );

    if (skipHttp) {
      console.log('  public:   skipped');
    } else if (result.httpError) {
      console.log(`  public:   FAIL after ${result.httpMs}ms — ${result.httpError}`);
    } else {
      console.log(
        `  public:   HTTP ${result.httpStatus} in ${result.httpMs}ms` +
          `${result.contentType ? `, type=${result.contentType}` : ''}` +
          `${result.contentLength ? `, len=${result.contentLength}` : ''}`
      );
    }
    console.log('');
  }

  console.log('=== Summary by host + path prefix ===\n');
  for (const [key, stats] of summarizeByPrefix(results)) {
    console.log(
      `${key} -> samples=${stats.count}, internal_ok=${stats.internalOk}, public_ok=${stats.httpOk}, public_fail=${stats.httpFail}`
    );
  }

  console.log('\nInterpretation:');
  console.log('- internal=exists + public timeout => broken public endpoint/CDN/DNS, not app code');
  console.log('- internal=missing + public timeout => object key/URL mismatch in DB');
  console.log('- different hosts between homepage and products => mixed URL sources in DB');
  console.log('- only one prefix failing => bucket/CDN/WAF rule on that prefix');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
