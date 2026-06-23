import * as XLSX from 'xlsx';
import CFB from 'cfb';
import path from 'path';
import prisma from '../config/database';
import { productService } from './product.service';
import { storageService } from './storage.service';
import { CreateProductDto } from '../types/product';

type ParsedImportRow = Record<string, unknown>;

type ImportMessageKey =
  | 'productImport.emptyRowSkipped'
  | 'productImport.productCreated'
  | 'productImport.productCreatedMissingImages'
  | 'productImport.fieldRequired'
  | 'productImport.priceRequiredUnlessPriceOnRequest'
  | 'productImport.referenceNotFound'
  | 'productImport.importFailed';

type ImportMessageParams = Record<string, string | number>;

type ImportRowResult = {
  row: number;
  sku?: string;
  name?: string;
  status: 'created' | 'created_with_warnings' | 'skipped' | 'failed';
  messageKey: ImportMessageKey;
  messageParams?: ImportMessageParams;
  message: string;
};

type ProductImportResult = {
  totalRows: number;
  created: number;
  warnings: number;
  failed: number;
  skipped: number;
  rows: ImportRowResult[];
};

type ZipAsset = {
  name: string;
  buffer: Buffer;
  mimeType: string;
};

const TEMPLATE_WORKBOOK_NAME = 'products-import.xlsx';
const TEMPLATE_README_NAME = 'README.txt';

type TemplateLanguage = 'en' | 'ru';

const TEMPLATE_TEXT: Record<
  TemplateLanguage,
  {
    readmeTitle: string;
    readmeSteps: string[];
    requiredColumns: string;
    supportedReferenceValues: string;
    exampleImageFiles: string;
    workbookSheetName: string;
    sampleDressName: string;
    sampleDressDescription: string;
    sampleOvershirtName: string;
    sampleOvershirtDescription: string;
    sampleDressMaterial: string;
    sampleOvershirtMaterial: string;
    sampleCountryItaly: string;
    sampleCountryPortugal: string;
    sampleDressFrontFile: string;
    sampleDressBackFile: string;
    sampleOvershirtFrontFile: string;
    svgTitle: string;
    svgFrontLabel: string;
    svgBackLabel: string;
    svgReplaceHint: string;
    svgKeepNameHint: string;
  }
> = {
  en: {
    readmeTitle: 'Mass product import format',
    readmeSteps: [
      `1. Edit ${TEMPLATE_WORKBOOK_NAME}`,
      '2. Put your product images in the images/ folder',
      '3. In the imageFiles column, list image file names separated by commas',
      '4. Save everything back into one ZIP archive and upload it in /admin/products',
    ],
    requiredColumns: 'Required columns:',
    supportedReferenceValues: 'Supported category/brand values:',
    exampleImageFiles: 'Example imageFiles value:',
    workbookSheetName: 'Products',
    sampleDressName: 'Sample Linen Dress',
    sampleDressDescription: 'Lightweight linen dress for summer collection',
    sampleOvershirtName: 'Sample Overshirt',
    sampleOvershirtDescription: 'Structured overshirt with a relaxed silhouette',
    sampleDressMaterial: '100% linen',
    sampleOvershirtMaterial: 'Cotton twill',
    sampleCountryItaly: 'Italy',
    sampleCountryPortugal: 'Portugal',
    sampleDressFrontFile: 'sample-dress-front.svg',
    sampleDressBackFile: 'sample-dress-back.svg',
    sampleOvershirtFrontFile: 'sample-overshirt-front.svg',
    svgTitle: 'Sample Product',
    svgFrontLabel: 'Front Image Placeholder',
    svgBackLabel: 'Back Image Placeholder',
    svgReplaceHint: 'Replace this file with your real photo',
    svgKeepNameHint: 'Keep the file name if it is referenced in the table',
  },
  ru: {
    readmeTitle: 'Mass product import format',
    readmeSteps: [
      `1. Edit ${TEMPLATE_WORKBOOK_NAME}`,
      '2. Put product photos in the images/ folder',
      '3. In the imageFiles column, list image file names separated by commas',
      '4. Save everything back into one ZIP archive and upload it in /admin/products',
    ],
    requiredColumns: 'Required columns:',
    supportedReferenceValues: 'Supported category/brand values:',
    exampleImageFiles: 'Example imageFiles value:',
    workbookSheetName: 'Products',
    sampleDressName: 'Example linen dress',
    sampleDressDescription: 'Lightweight linen dress for summer collection',
    sampleOvershirtName: 'Example overshirt',
    sampleOvershirtDescription: 'Structured overshirt with a relaxed silhouette',
    sampleDressMaterial: '100% linen',
    sampleOvershirtMaterial: 'Cotton twill',
    sampleCountryItaly: 'Italy',
    sampleCountryPortugal: 'Portugal',
    sampleDressFrontFile: 'primer-platye-front.svg',
    sampleDressBackFile: 'primer-platye-back.svg',
    sampleOvershirtFrontFile: 'primer-rubashka-front.svg',
    svgTitle: 'Example product',
    svgFrontLabel: 'Front image placeholder',
    svgBackLabel: 'Back image placeholder',
    svgReplaceHint: 'Replace this file with your real photo',
    svgKeepNameHint: 'Save the file name if it is referenced in the table',
  },
};

class ProductImportRowError extends Error {
  messageKey: ImportMessageKey;
  messageParams?: ImportMessageParams;

  constructor(messageKey: ImportMessageKey, message: string, messageParams?: ImportMessageParams) {
    super(message);
    this.messageKey = messageKey;
    this.messageParams = messageParams;
  }
}

function buildSampleSvg(
  theme: 'front' | 'back',
  languageCode?: string
): string {
  const copy = TEMPLATE_TEXT[resolveTemplateLanguage(languageCode)];
  const isFront = theme === 'front';
  const background = isFront ? '#f6f0ea' : '#f3f4f6';
  const stroke = isFront ? '#d5c6b8' : '#c8ccd2';
  const title = isFront ? copy.svgFrontLabel : copy.svgBackLabel;
  const hint = isFront ? copy.svgReplaceHint : copy.svgKeepNameHint;
  const titleColor = isFront ? '#2f241c' : '#1f2937';
  const subtitleColor = isFront ? '#7a6758' : '#6b7280';
  const hintColor = isFront ? '#9a8677' : '#9ca3af';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <rect width="1200" height="1600" fill="${background}"/>
  <rect x="130" y="130" width="940" height="1340" rx="36" fill="#ffffff" stroke="${stroke}" stroke-width="8"/>
  <text x="600" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="74" fill="${titleColor}">${copy.svgTitle}</text>
  <text x="600" y="640" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" fill="${subtitleColor}">${title}</text>
  <text x="600" y="740" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="${hintColor}">${hint}</text>
</svg>
`;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'y', 'da', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseOptionalNumber(value: unknown): number | undefined {
  const normalized = normalizeCell(value).replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStringList(value: unknown): string[] {
  return normalizeCell(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMimeTypeByExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function isSupportedImage(fileName: string): boolean {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(path.extname(fileName).toLowerCase());
}

function isZipDirectory(entryPath: string): boolean {
  return entryPath.endsWith('/');
}

function resolveTemplateLanguage(languageCode?: string): TemplateLanguage {
  return languageCode?.toLowerCase() === 'ru' ? 'ru' : 'en';
}

function buildTemplateReadme(languageCode?: string): string {
  const copy = TEMPLATE_TEXT[resolveTemplateLanguage(languageCode)];
  return [
    copy.readmeTitle,
    '',
    ...copy.readmeSteps,
    '',
    copy.requiredColumns,
    '- name',
    '- sku',
    '- category',
    '',
    copy.supportedReferenceValues,
    '- UUID',
    '- slug',
    '- exact name',
    '',
    copy.exampleImageFiles,
    'dress-front.jpg,dress-back.jpg',
  ].join('\n');
}

export class ProductImportService {
  async generateTemplateArchive(languageCode?: string): Promise<Buffer> {
    const copy = TEMPLATE_TEXT[resolveTemplateLanguage(languageCode)];
    const [categories, brands] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' }, take: 5 }),
      prisma.brand.findMany({ orderBy: { name: 'asc' }, take: 5 }),
    ]);

    const sampleCategory =
      categories[0]?.slug || categories[0]?.name || 'replace-with-category-slug';
    const secondCategory =
      categories[1]?.slug || categories[1]?.name || sampleCategory;
    const sampleBrand = brands[0]?.slug || brands[0]?.name || '';

    const rows = [
      {
        name: copy.sampleDressName,
        sku: 'SAMPLE-DRESS-001',
        slug: 'sample-linen-dress',
        description: copy.sampleDressDescription,
        price: 129.9,
        priceOnRequest: 'false',
        category: sampleCategory,
        brand: sampleBrand,
        isActive: 'true',
        isFeatured: 'true',
        material: copy.sampleDressMaterial,
        countryOfOrigin: copy.sampleCountryItaly,
        imageFiles: `${copy.sampleDressFrontFile},${copy.sampleDressBackFile}`,
      },
      {
        name: copy.sampleOvershirtName,
        sku: 'SAMPLE-OVERSHIRT-002',
        slug: 'sample-overshirt',
        description: copy.sampleOvershirtDescription,
        price: 159,
        priceOnRequest: 'false',
        category: secondCategory,
        brand: sampleBrand,
        isActive: 'true',
        isFeatured: 'false',
        material: copy.sampleOvershirtMaterial,
        countryOfOrigin: copy.sampleCountryPortugal,
        imageFiles: copy.sampleOvershirtFrontFile,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, copy.workbookSheetName);
    const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const zip = CFB.utils.cfb_new();
    CFB.utils.cfb_add(zip, `/${TEMPLATE_WORKBOOK_NAME}`, workbookBuffer);
    CFB.utils.cfb_add(zip, `/${TEMPLATE_README_NAME}`, Buffer.from(buildTemplateReadme(languageCode), 'utf8'));
    CFB.utils.cfb_add(zip, `/images/${copy.sampleDressFrontFile}`, Buffer.from(buildSampleSvg('front', languageCode), 'utf8'));
    CFB.utils.cfb_add(zip, `/images/${copy.sampleDressBackFile}`, Buffer.from(buildSampleSvg('back', languageCode), 'utf8'));
    CFB.utils.cfb_add(zip, `/images/${copy.sampleOvershirtFrontFile}`, Buffer.from(buildSampleSvg('front', languageCode), 'utf8'));

    return CFB.write(zip, { type: 'buffer', fileType: 'zip', compression: true }) as Buffer;
  }

  async importArchive(buffer: Buffer): Promise<ProductImportResult> {
    const zip = CFB.read(buffer, { type: 'buffer' });
    const workbookEntry = zip.FileIndex.find((entry) => {
      const lower = entry.name.toLowerCase();
      return lower.endsWith('.xlsx') || lower.endsWith('.csv');
    });

    if (!workbookEntry?.content) {
      throw new Error('Archive must include .xlsx or .csv file with products');
    }

    const rows = this.parseWorkbook(workbookEntry.name, Buffer.from(workbookEntry.content as Buffer));
    const assets = this.collectAssets(zip);

    const [categories, brands] = await Promise.all([
      prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
      prisma.brand.findMany({ select: { id: true, name: true, slug: true } }),
    ]);

    const results: ImportRowResult[] = [];
    let created = 0;
    let warnings = 0;
    let failed = 0;
    let skipped = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      const name = normalizeCell(row.name);
      const sku = normalizeCell(row.sku);

      if (!name && !sku) {
        skipped += 1;
        results.push({
          row: rowNumber,
          status: 'skipped',
          messageKey: 'productImport.emptyRowSkipped',
          message: 'Empty row skipped',
        });
        continue;
      }

      try {
        if (!name) {
          throw new ProductImportRowError(
            'productImport.fieldRequired',
            'name is required',
            { field: 'name' }
          );
        }
        if (!sku) {
          throw new ProductImportRowError(
            'productImport.fieldRequired',
            'sku is required',
            { field: 'sku' }
          );
        }

        const category = this.resolveReference(normalizeCell(row.category), categories, 'category');
        const brand = normalizeCell(row.brand)
          ? this.resolveReference(normalizeCell(row.brand), brands, 'brand')
          : null;

        const data: CreateProductDto = {
          name,
          sku,
          slug: normalizeCell(row.slug) || undefined,
          description: normalizeCell(row.description) || undefined,
          price: parseOptionalNumber(row.price),
          priceOnRequest: parseBoolean(row.priceOnRequest, false),
          categoryId: category.id,
          brandId: brand?.id,
          isActive: parseBoolean(row.isActive, true),
          isFeatured: parseBoolean(row.isFeatured, false),
          material: normalizeCell(row.material) || undefined,
          countryOfOrigin: normalizeCell(row.countryOfOrigin) || undefined,
          hideColor: true,
          hideMaterial: false,
          hideLining: true,
          hideCountryOfOrigin: false,
        };

        if (!data.priceOnRequest && data.price === undefined) {
          throw new ProductImportRowError(
            'productImport.priceRequiredUnlessPriceOnRequest',
            'price is required unless priceOnRequest=true'
          );
        }

        const product = await productService.create(data);
        const imageFiles = parseStringList(row.imageFiles);
        const missingImages: string[] = [];

        for (let imageIndex = 0; imageIndex < imageFiles.length; imageIndex += 1) {
          const imageFileName = imageFiles[imageIndex];
          const asset = assets.get(normalizeKey(path.basename(imageFileName)));
          if (!asset) {
            missingImages.push(imageFileName);
            continue;
          }

          const fileUrl = await storageService.uploadFile(
            {
              fieldname: 'file',
              originalname: asset.name,
              encoding: '7bit',
              mimetype: asset.mimeType,
              size: asset.buffer.length,
              buffer: asset.buffer,
              stream: undefined as never,
              destination: '',
              filename: asset.name,
              path: '',
            } as Express.Multer.File,
            'products'
          );

          await productService.addImage({
            productId: product.id,
            url: fileUrl,
            alt: path.parse(asset.name).name,
            order: imageIndex,
          });
        }

        if (missingImages.length > 0) {
          warnings += 1;
          created += 1;
          results.push({
            row: rowNumber,
            sku,
            name,
            status: 'created_with_warnings',
            messageKey: 'productImport.productCreatedMissingImages',
            messageParams: { files: missingImages.join(', ') },
            message: `Created product, but missing images: ${missingImages.join(', ')}`,
          });
        } else {
          created += 1;
          results.push({
            row: rowNumber,
            sku,
            name,
            status: 'created',
            messageKey: 'productImport.productCreated',
            message: 'Product created successfully',
          });
        }
      } catch (error) {
        failed += 1;
        const importError = error instanceof ProductImportRowError ? error : null;
        results.push({
          row: rowNumber,
          sku: sku || undefined,
          name: name || undefined,
          status: 'failed',
          messageKey: importError?.messageKey ?? 'productImport.importFailed',
          messageParams: importError?.messageParams,
          message: error instanceof Error ? error.message : 'Import failed',
        });
      }
    }

    return {
      totalRows: rows.length,
      created,
      warnings,
      failed,
      skipped,
      rows: results,
    };
  }

  private parseWorkbook(fileName: string, buffer: Buffer): ParsedImportRow[] {
    const lower = fileName.toLowerCase();

    if (lower.endsWith('.csv')) {
      const workbook = XLSX.read(buffer.toString('utf8'), { type: 'string' });
      return this.sheetToRows(workbook.Sheets[workbook.SheetNames[0]]);
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return this.sheetToRows(workbook.Sheets[workbook.SheetNames[0]]);
  }

  private sheetToRows(sheet: XLSX.WorkSheet): ParsedImportRow[] {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    return rawRows.map((row) => {
      const normalized: ParsedImportRow = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeKey(key)] = value;
      }
      return normalized;
    });
  }

  private collectAssets(zip: CFB.CFB$Container): Map<string, ZipAsset> {
    const assets = new Map<string, ZipAsset>();

    for (const entry of zip.FileIndex) {
      if (!entry.name || !entry.content) continue;
      if (isZipDirectory(entry.name)) continue;
      if (!isSupportedImage(entry.name)) continue;

      const fileName = path.basename(entry.name);
      assets.set(normalizeKey(fileName), {
        name: fileName,
        buffer: Buffer.from(entry.content as Buffer),
        mimeType: getMimeTypeByExtension(fileName),
      });
    }

    return assets;
  }

  private resolveReference<T extends { id: string; name: string; slug: string }>(
    rawValue: string,
    items: T[],
    label: string
  ): T {
    const value = rawValue.trim();
    if (!value) {
      throw new ProductImportRowError(
        'productImport.fieldRequired',
        `${label} is required`,
        { field: label }
      );
    }

    const normalized = normalizeKey(value);
    const match = items.find((item) =>
      item.id === value ||
      normalizeKey(item.slug) === normalized ||
      normalizeKey(item.name) === normalized
    );

    if (!match) {
      throw new ProductImportRowError(
        'productImport.referenceNotFound',
        `${label} "${value}" not found`,
        { field: label, value }
      );
    }

    return match;
  }
}

export const productImportService = new ProductImportService();
