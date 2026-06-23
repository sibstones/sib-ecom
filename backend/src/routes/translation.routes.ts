import { Router } from 'express';
import { translationController } from '../controllers/translation.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const upsertProductTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    name: z.string().optional(),
    description: z.string().optional(),
    material: z.string().optional(),
    lining: z.string().optional(),
    countryOfOrigin: z.string().optional(),
  }),
});

const upsertCategoryTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
});

const upsertPageTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    title: z.string().optional(),
    content: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    config: z.record(z.any()).optional(),
  }),
});

const upsertHomepageSectionTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    title: z.string().optional(),
    config: z.record(z.any()).optional(),
  }),
});

const upsertProductPageDesignTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    sizeChartLabels: z.record(z.string()).optional(),
  }),
});

const upsertLookbookTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

const upsertFooterTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    brandName: z.string().optional(),
    tagline: z.string().optional(),
    columns: z.array(z.object({
      title: z.string(),
      links: z.array(z.object({
        text: z.string(),
        url: z.string(),
      })),
    })).optional(),
    copyright: z.string().optional(),
    links: z.array(z.object({
      text: z.string(),
      url: z.string(),
    })).optional(),
  }),
});

const upsertBlogPostTranslationSchema = z.object({
  body: z.object({
    languageCode: z.string().min(2).max(5),
    title: z.string().optional(),
    excerpt: z.string().optional(),
    content: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
  }),
});

// Params validation (uuid for ids, languageCode 2-10 chars)
const productIdOnlySchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
});
const productIdWithLangSchema = z.object({
  params: z.object({
    productId: z.string().uuid(),
    languageCode: z.string().min(2).max(10),
  }),
});

// All routes require authentication and admin authorization
router.get(
  '/products/:productId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(productIdOnlySchema),
  translationController.getProductTranslations.bind(translationController)
);

router.get(
  '/products/:productId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(productIdWithLangSchema),
  translationController.getProductTranslation.bind(translationController)
);

router.post(
  '/products/:productId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertProductTranslationSchema),
  translationController.upsertProductTranslation.bind(translationController)
);

router.put(
  '/products/:productId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertProductTranslationSchema),
  translationController.upsertProductTranslation.bind(translationController)
);

router.delete(
  '/products/:productId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deleteProductTranslation.bind(translationController)
);

// Category translation routes
router.get(
  '/categories/:categoryId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getCategoryTranslations.bind(translationController)
);

router.get(
  '/categories/:categoryId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getCategoryTranslation.bind(translationController)
);

router.post(
  '/categories/:categoryId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertCategoryTranslationSchema),
  translationController.upsertCategoryTranslation.bind(translationController)
);

router.put(
  '/categories/:categoryId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertCategoryTranslationSchema),
  translationController.upsertCategoryTranslation.bind(translationController)
);

router.delete(
  '/categories/:categoryId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deleteCategoryTranslation.bind(translationController)
);

// Page translation routes
router.get(
  '/pages/:pageId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getPageTranslations.bind(translationController)
);

router.get(
  '/pages/:pageId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getPageTranslation.bind(translationController)
);

router.post(
  '/pages/:pageId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertPageTranslationSchema),
  translationController.upsertPageTranslation.bind(translationController)
);

router.put(
  '/pages/:pageId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertPageTranslationSchema),
  translationController.upsertPageTranslation.bind(translationController)
);

router.delete(
  '/pages/:pageId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deletePageTranslation.bind(translationController)
);

// Homepage section translation routes
router.get(
  '/homepage-sections/:sectionId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getHomepageSectionTranslations.bind(translationController)
);

router.get(
  '/homepage-sections/:sectionId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getHomepageSectionTranslation.bind(translationController)
);

router.post(
  '/homepage-sections/:sectionId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertHomepageSectionTranslationSchema),
  translationController.upsertHomepageSectionTranslation.bind(translationController)
);

router.put(
  '/homepage-sections/:sectionId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertHomepageSectionTranslationSchema),
  translationController.upsertHomepageSectionTranslation.bind(translationController)
);

router.delete(
  '/homepage-sections/:sectionId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deleteHomepageSectionTranslation.bind(translationController)
);

// Product page design translation routes
router.get(
  '/product-page-design',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getProductPageDesignTranslations.bind(translationController)
);

router.get(
  '/product-page-design/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getProductPageDesignTranslation.bind(translationController)
);

router.post(
  '/product-page-design',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertProductPageDesignTranslationSchema),
  translationController.upsertProductPageDesignTranslation.bind(translationController)
);

router.put(
  '/product-page-design/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertProductPageDesignTranslationSchema),
  translationController.upsertProductPageDesignTranslation.bind(translationController)
);

router.delete(
  '/product-page-design/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deleteProductPageDesignTranslation.bind(translationController)
);

// Lookbook translation routes
router.get(
  '/lookbooks/:lookbookId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getLookbookTranslations.bind(translationController)
);

router.get(
  '/lookbooks/:lookbookId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getLookbookTranslation.bind(translationController)
);

router.post(
  '/lookbooks/:lookbookId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertLookbookTranslationSchema),
  translationController.upsertLookbookTranslation.bind(translationController)
);

router.put(
  '/lookbooks/:lookbookId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertLookbookTranslationSchema),
  translationController.upsertLookbookTranslation.bind(translationController)
);

router.delete(
  '/lookbooks/:lookbookId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deleteLookbookTranslation.bind(translationController)
);

// Footer translation routes
router.get(
  '/footers/:footerId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getFooterTranslations.bind(translationController)
);

router.get(
  '/footers/:footerId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getFooterTranslation.bind(translationController)
);

router.post(
  '/footers/:footerId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertFooterTranslationSchema),
  translationController.upsertFooterTranslation.bind(translationController)
);

router.put(
  '/footers/:footerId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertFooterTranslationSchema),
  translationController.upsertFooterTranslation.bind(translationController)
);

router.delete(
  '/footers/:footerId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deleteFooterTranslation.bind(translationController)
);

// Blog post translation routes
router.get(
  '/blog-posts/:blogPostId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getBlogPostTranslations.bind(translationController)
);

router.get(
  '/blog-posts/:blogPostId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.getBlogPostTranslation.bind(translationController)
);

router.post(
  '/blog-posts/:blogPostId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertBlogPostTranslationSchema),
  translationController.upsertBlogPostTranslation.bind(translationController)
);

router.put(
  '/blog-posts/:blogPostId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(upsertBlogPostTranslationSchema),
  translationController.upsertBlogPostTranslation.bind(translationController)
);

router.delete(
  '/blog-posts/:blogPostId/:languageCode',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.deleteBlogPostTranslation.bind(translationController)
);

// GPT translation route
router.post(
  '/gpt-translate',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  translationController.generateGPTTranslation.bind(translationController)
);

export default router;
