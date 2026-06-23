import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate, optionalAuthenticate, authorize } from '../middleware/auth.middleware';
import { uploadSingleImageOrVideo, uploadMultipleImageOrVideo, uploadZip, handleUploadError } from '../middleware/upload.middleware';
import { searchLimiter, uploadLimiter } from '../middleware/rate-limit.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    description: z.string().optional(),
    sku: z.string().min(1),
    price: z.number().nonnegative().optional().nullable(), // Optional when priceOnRequest is enabled
    compareAtPrice: z.number().nonnegative().optional().nullable(), // Allow 0, undefined, or null
    priceOnRequest: z.boolean().optional(),
    categoryId: z.string().uuid(),
    brandId: z.string().uuid().optional().nullable(),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    // New fields for sizes and filters
    productTypes: z.array(z.enum(['CLOTHING', 'SHOES', 'CUSTOM', 'VOLUME', 'WEIGHT'])).optional().nullable(),
    sizes: z.object({
      CLOTHING: z.array(z.string()).optional(),
      SHOES: z.array(z.string()).optional(),
      CUSTOM: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      VOLUME: z.array(z.string()).optional(),
      WEIGHT: z.array(z.string()).optional(),
    }).optional().nullable(),
    colors: z.array(z.object({
      name: z.string().min(1),
      hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color must be in format #RRGGBB')
    })).optional().nullable(),
    material: z.string().optional().nullable(),
    lining: z.string().optional().nullable(),
    application: z.string().optional().nullable(),
    countryOfOrigin: z.string().optional().nullable(),
    hideColor: z.boolean().optional(),
    hideMaterial: z.boolean().optional(),
    hideLining: z.boolean().optional(),
    hideCountryOfOrigin: z.boolean().optional(),
    relatedProducts: z.array(z.string().uuid()).optional().nullable(),
    // SEO fields
    metaTitle: z.string().optional().nullable(),
    metaDescription: z.string().optional().nullable(),
    metaKeywords: z.string().optional().nullable(),
    // Shipping (weight & dimensions per unit)
    weightNet: z.number().nonnegative().optional().nullable(),
    weightGross: z.number().nonnegative().optional().nullable(),
    lengthCm: z.number().nonnegative().optional().nullable(),
    widthCm: z.number().nonnegative().optional().nullable(),
    heightCm: z.number().nonnegative().optional().nullable(),
  }).superRefine((data, ctx) => {
    if (!data.priceOnRequest && (data.price === undefined || data.price === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Required',
      });
    }

    if (data.priceOnRequest && data.price !== undefined && data.price !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Must be empty when priceOnRequest is true',
      });
    }
  }),
});

const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    slug: z.string().optional(),
    description: z.string().optional(),
    sku: z.string().min(1).optional(),
    price: z.number().nonnegative().optional().nullable(), // Allow 0, null, and positive numbers
    compareAtPrice: z
      .union([z.number().nonnegative(), z.string(), z.null()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === '' || val === null || val === undefined) return null;
        if (typeof val === 'string') {
          const num = parseFloat(val);
          return isNaN(num) ? null : num;
        }
        return val;
      }),
    categoryId: z.string().uuid().optional(),
    brandId: z
      .union([z.string().uuid(), z.string().length(0), z.null()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === '' || val === null || val === undefined) return null;
        return val;
      }),
    priceOnRequest: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    // New fields for sizes and filters
    productTypes: z.array(z.enum(['CLOTHING', 'SHOES', 'CUSTOM', 'VOLUME', 'WEIGHT'])).optional().nullable(),
    sizes: z.object({
      CLOTHING: z.array(z.string()).optional(),
      SHOES: z.array(z.string()).optional(),
      CUSTOM: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      VOLUME: z.array(z.string()).optional(),
      WEIGHT: z.array(z.string()).optional(),
    }).optional().nullable(),
    colors: z.array(z.object({
      name: z.string().min(1),
      hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color must be in format #RRGGBB')
    })).optional().nullable(),
    material: z.string().optional().nullable(),
    lining: z.string().optional().nullable(),
    application: z.string().optional().nullable(),
    countryOfOrigin: z.string().optional().nullable(),
    hideColor: z.boolean().optional(),
    hideMaterial: z.boolean().optional(),
    hideLining: z.boolean().optional(),
    hideCountryOfOrigin: z.boolean().optional(),
    relatedProducts: z.array(z.string().uuid()).optional().nullable(),
    // SEO fields
    metaTitle: z.string().optional().nullable(),
    metaDescription: z.string().optional().nullable(),
    metaKeywords: z.string().optional().nullable(),
    // Shipping (weight & dimensions per unit)
    weightNet: z.number().nonnegative().optional().nullable(),
    weightGross: z.number().nonnegative().optional().nullable(),
    lengthCm: z.number().nonnegative().optional().nullable(),
    widthCm: z.number().nonnegative().optional().nullable(),
    heightCm: z.number().nonnegative().optional().nullable(),
  }),
});

// Image upload validation (url is generated automatically)
const createImageSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    alt: z.string().optional(),
    order: z.string().optional(),
  }),
});

const createVariantSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    name: z.string().min(1),
    sku: z.string().min(1),
    price: z.number().positive().optional(),
    size: z.string().optional(),
    showOnProduct: z.boolean().optional(),
  }),
});

const updateVariantSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    sku: z.string().min(1).optional(),
    price: z.number().positive().optional().nullable(),
    size: z.string().optional().nullable(),
    showOnProduct: z.boolean().optional(),
  }),
});

// Query validation for list (limit, page, filters, sort)
const listProductsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    categoryId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    minPrice: z.coerce.number().finite().optional(),
    maxPrice: z.coerce.number().finite().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    search: z.string().max(500).optional(),
    color: z.string().max(100).optional(),
    material: z.string().max(200).optional(),
    countryOfOrigin: z.string().max(100).optional(),
    size: z.string().max(20).optional(),
    dateFrom: z.string().max(50).optional(),
    dateTo: z.string().max(50).optional(),
    sortBy: z.enum(['price', 'createdAt', 'name']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    imagesLimit: z.coerce.number().int().min(1).max(20).optional(),
    languageCode: z.string().min(2).max(10).optional(),
  }).optional(),
});

const getByIdParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
const getBySlugParamsSchema = z.object({
  params: z.object({ slug: z.string().min(1).max(300) }),
});
const similarProductParamsSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
  query: z.object({ limit: z.coerce.number().int().min(1).max(20).optional() }).optional(),
});

// Public routes (optional auth: admin sees all products, guests see only in-sale with stock)
router.get('/', optionalAuthenticate, validate(listProductsQuerySchema), productController.getAll.bind(productController));
router.get('/slug/:slug', validate(getBySlugParamsSchema), productController.getBySlug.bind(productController));
router.get('/similar/:productId', validate(similarProductParamsSchema), productController.getSimilar.bind(productController));
// Search products (for admin - Complete the look feature) - MUST be before /:id route
router.get(
  '/search',
  searchLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  productController.searchProducts.bind(productController)
);
router.get(
  '/catalog-attributes',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  productController.getCatalogAttributes.bind(productController)
);
// Get available stock for a product (public endpoint) - MUST be before /:id route
router.get('/:productId/stock', productController.getAvailableStock.bind(productController));
router.get('/:id', optionalAuthenticate, validate(getByIdParamsSchema), productController.getById.bind(productController));

// Protected routes (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createProductSchema),
  productController.create.bind(productController)
);

router.get(
  '/import/template',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  productController.downloadImportTemplate.bind(productController)
);

router.post(
  '/import',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadZip,
  handleUploadError,
  productController.importProducts.bind(productController)
);

router.put(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateProductSchema),
  productController.update.bind(productController)
);

router.delete(
  '/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  productController.delete.bind(productController)
);

// Upload single image or video
router.post(
  '/images',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadSingleImageOrVideo,
  handleUploadError,
  validate(createImageSchema),
  productController.addImage.bind(productController)
);

// Upload multiple images
const createMultipleImagesSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
  }),
});

router.post(
  '/images/multiple',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadMultipleImageOrVideo,
  handleUploadError,
  validate(createMultipleImagesSchema),
  productController.addMultipleImages.bind(productController)
);

router.delete(
  '/images/:imageId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  productController.deleteImage.bind(productController)
);

// Reorder images
const reorderImagesSchema = z.object({
  body: z.object({
    imageOrders: z.array(
      z.object({
        id: z.string().uuid(),
        order: z.number().int().min(0),
      })
    ),
  }),
});

router.post(
  '/:productId/images/reorder',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(reorderImagesSchema),
  productController.reorderImages.bind(productController)
);

router.post(
  '/variants',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createVariantSchema),
  productController.addVariant.bind(productController)
);

router.put(
  '/variants/:variantId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateVariantSchema),
  productController.updateVariant.bind(productController)
);

router.delete(
  '/variants/:variantId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  productController.deleteVariant.bind(productController)
);

export default router;
