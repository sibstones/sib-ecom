import { Router } from 'express';
import { Request, Response } from 'express';
import { blogController } from '../controllers/blog.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';
import { uploadSingleImageOrVideo, handleUploadError } from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rate-limit.middleware';
import { storageService } from '../services/storage.service';

const router = Router();
const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

// Validation schemas
const createBlogPostSchema = z.object({
  body: z.object({
    slug: z.string().optional(),
    title: z.string().min(1),
    excerpt: z.string().optional(),
    content: z.string().optional(),
    videoUrl: z.union([z.string().url(), z.literal('')]).optional(),
    thumbnailUrl: z.union([z.string().url(), z.literal('')]).optional(),
    type: z.enum(['ARTICLE', 'VIDEO', 'MIXED']),
    displayFormat: z.enum(['AUTO', 'LANDSCAPE', 'PORTRAIT', 'SQUARE']).default('AUTO'),
    categoryId: z.string().uuid().optional().nullable(),
    blogAuthorId: z.string().uuid().optional().nullable(),
    isPublished: z.boolean().default(false),
    publishedAt: z.string().datetime().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    faqItems: z.array(faqItemSchema).optional(),
    tags: z.array(z.string()).optional(),
    linkedProductIds: z.array(z.string().uuid()).optional(),
  }),
});

const updateBlogPostSchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    excerpt: z.string().optional(),
    content: z.string().optional(),
    videoUrl: z.union([z.string().url(), z.literal('')]).optional(),
    thumbnailUrl: z.union([z.string().url(), z.literal('')]).optional(),
    type: z.enum(['ARTICLE', 'VIDEO', 'MIXED']).optional(),
    displayFormat: z.enum(['AUTO', 'LANDSCAPE', 'PORTRAIT', 'SQUARE']).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    blogAuthorId: z.string().uuid().optional().nullable(),
    isPublished: z.boolean().optional(),
    publishedAt: z.string().datetime().optional().nullable(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    faqItems: z.array(faqItemSchema).optional(),
    tags: z.array(z.string()).optional(),
    linkedProductIds: z.array(z.string().uuid()).optional(),
  }),
});

const updateBlogSettingsSchema = z.object({
  body: z.object({
    layoutStyle: z.enum(['MAGAZINE', 'INSTAGRAM', 'TIKTOK', 'MIXED']).optional(),
    gridColumns: z.string().optional(),
    gap: z.string().optional(),
    itemsPerPage: z.coerce.number().int().min(1).optional(),
    showExcerpt: z.boolean().optional(),
    showAuthor: z.boolean().optional(),
    showDate: z.boolean().optional(),
    showViews: z.boolean().optional(),
    showTags: z.boolean().optional(),
    headerTitle: z.string().nullish(),
    headerSubtitle: z.string().nullish(),
    headerImageUrl: z
      .union([z.string().url(), z.string(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v == null ? null : v)),
    headerVideoUrl: z
      .union([z.string().url(), z.string(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v == null ? null : v)),
    heroFullscreen: z.boolean().optional(),
    heroHeight: z.string().optional(),
    heroAutoZoom: z.boolean().optional(),
    titleFontSize: z.string().optional(),
    excerptFontSize: z.string().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    accentColor: z.string().optional(),
    paddingTop: z.string().optional(),
    paddingBottom: z.string().optional(),
    cardBorderRadius: z.string().optional(),
    cardShadow: z.boolean().optional(),
    cardHoverEffect: z.boolean().optional(),
    featuredPostId: z
      .union([z.string().uuid(), z.literal(''), z.literal('null'), z.null()])
      .optional()
      .nullable()
      .transform((v) => (v === '' || v === 'null' ? null : v)),
    aspectRatio: z.string().optional(),
    videoAutoplay: z.boolean().optional(),
    videoLoop: z.boolean().optional(),
    videoMuted: z.boolean().optional(),
  }),
});

// Query/params validation for public routes
const listPostsQuerySchema = z.object({
  query: z.object({
    active: z.enum(['true', 'false']).optional(),
    languageCode: z.string().min(2).max(10).optional(),
  }).optional(),
});
const postBySlugParamsSchema = z.object({
  params: z.object({ slug: z.string().min(1).max(300) }),
  query: z.object({ languageCode: z.string().min(2).max(10).optional() }).optional(),
});
const postIdParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
const categorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
  }),
});
const authorSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    bio: z.string().optional(),
    avatarUrl: z.union([z.string().url(), z.literal('')]).optional(),
  }),
});

// Public routes
router.get('/categories', blogController.getAllCategories.bind(blogController));
router.get('/authors', blogController.getAllAuthors.bind(blogController));
router.get('/posts', validate(listPostsQuerySchema), blogController.getAllPosts.bind(blogController));
router.get('/posts/slug/:slug', validate(postBySlugParamsSchema), blogController.getPostBySlug.bind(blogController));
router.post('/posts/:id/views', validate(postIdParamsSchema), blogController.incrementViews.bind(blogController));
router.get('/settings', blogController.getSettings.bind(blogController));

// Upload route for blog media
router.post(
  '/upload',
  uploadLimiter,
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  uploadSingleImageOrVideo,
  handleUploadError,
  async (req: Request, res: Response) => {
    try {
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Upload file to MinIO in blog folder
      const fileUrl = await storageService.uploadFile(file, 'blog');

      // Return the URL
      res.status(200).json({ url: fileUrl });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  }
);

// Protected routes (Admin only)
router.post(
  '/posts',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(createBlogPostSchema),
  blogController.createPost.bind(blogController)
);

router.get(
  '/posts/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  blogController.getPostById.bind(blogController)
);

router.put(
  '/posts/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateBlogPostSchema),
  blogController.updatePost.bind(blogController)
);

router.delete(
  '/posts/admin/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  blogController.deletePost.bind(blogController)
);

router.put(
  '/settings',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updateBlogSettingsSchema),
  blogController.updateSettings.bind(blogController)
);

router.post(
  '/categories',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(categorySchema),
  blogController.createCategory.bind(blogController)
);

router.put(
  '/categories/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(categorySchema),
  blogController.updateCategory.bind(blogController)
);

router.delete(
  '/categories/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  blogController.deleteCategory.bind(blogController)
);

router.post(
  '/authors',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(authorSchema),
  blogController.createAuthor.bind(blogController)
);

router.put(
  '/authors/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(authorSchema),
  blogController.updateAuthor.bind(blogController)
);

router.delete(
  '/authors/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  blogController.deleteAuthor.bind(blogController)
);

export default router;
