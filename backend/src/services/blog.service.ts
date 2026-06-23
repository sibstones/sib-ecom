import prisma from '../config/database';
import { CreateBlogPostDto, UpdateBlogPostDto, UpdateBlogSettingsDto, BlogLayoutStyle, BlogMediaFormat, BlogCategoryDto, BlogAuthorDto } from '../types/blog';
import { sanitizeHtmlContentOrPlain } from '../utils/sanitize';

export class BlogService {
  // Verify Prisma Client has BlogPost model
  private ensureBlogPostModel() {
    const prismaAny = prisma as any;
    if (!prismaAny.blogPost) {
      throw new Error(
        'BlogPost model not found in Prisma Client. Please run: cd backend && npx prisma generate'
      );
    }
  }

  // Blog Posts
  async getAllCategories() {
    return prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getAllAuthors() {
    return prisma.blogAuthor.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getAllPosts(activeOnly: boolean = false, languageCode?: string) {
    try {
      this.ensureBlogPostModel();
      const where = activeOnly ? { isPublished: true } : {};
      
      const posts = await prisma.blogPost.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          category: true,
          blogAuthor: true,
          translations: languageCode ? {
            where: { languageCode },
          } : true,
        },
        orderBy: { publishedAt: 'desc' },
      });

      // Apply translations if languageCode is provided
      if (languageCode) {
        return posts.map(post => {
          const translation = post.translations.find(t => t.languageCode === languageCode);
          return {
            ...post,
            title: translation?.title || post.title,
            excerpt: translation?.excerpt || post.excerpt,
            content: translation?.content || post.content,
            metaTitle: translation?.metaTitle || post.metaTitle,
            metaDescription: translation?.metaDescription || post.metaDescription,
          };
        });
      }

      return posts;
    } catch (error: unknown) {
      console.error('Error in blogService.getAllPosts:', error);
      throw error;
    }
  }

  async getPostBySlug(slug: string, languageCode?: string) {
    try {
      this.ensureBlogPostModel();
      const post = await prisma.blogPost.findUnique({
        where: { slug },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          category: true,
          blogAuthor: true,
          translations: languageCode ? {
            where: { languageCode },
          } : true,
        },
      });

      if (!post) {
        return null;
      }

      const linkedProducts = (post as any).linkedProductIds?.length
        ? await this.getLinkedProductsPreview((post as any).linkedProductIds)
        : [];

      // Apply translation if languageCode is provided
      if (languageCode && post.translations.length > 0) {
        const translation = post.translations[0];
        return {
          ...post,
          title: translation.title || post.title,
          excerpt: translation.excerpt || post.excerpt,
          content: translation.content || post.content,
          metaTitle: translation.metaTitle || post.metaTitle,
          metaDescription: translation.metaDescription || post.metaDescription,
          linkedProducts,
        };
      }

      return { ...post, linkedProducts };
    } catch (error: unknown) {
      console.error('Error in blogService.getPostBySlug:', error);
      throw error;
    }
  }

  async getPostById(id: string) {
    try {
      this.ensureBlogPostModel();
      const post = await prisma.blogPost.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          category: true,
          blogAuthor: true,
          translations: true,
        },
      });
      if (!post) return null;
      const linkedProducts = (post as any).linkedProductIds?.length
        ? await this.getLinkedProductsPreview((post as any).linkedProductIds)
        : [];
      return { ...post, linkedProducts };
    } catch (error: unknown) {
      console.error('Error in blogService.getPostById:', error);
      throw error;
    }
  }

  /**
   * Get minimal product data for blog "buy" previews (image + link).
   */
  private async getLinkedProductsPreview(productIds: string[]) {
    if (!productIds?.length) return [];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        price: true,
        images: { orderBy: { order: 'asc' }, take: 1, select: { url: true } },
      },
    });
    return products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price != null ? Number(p.price) : null,
      imageUrl: p.images[0]?.url ?? null,
    }));
  }

  async createPost(data: CreateBlogPostDto, authorId?: string) {
    try {
      this.ensureBlogPostModel();
      let slug = data.slug?.trim();
      if (!slug && data.title) {
        slug = data.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `post-${Date.now()}`;
        const existing = await prisma.blogPost.findUnique({ where: { slug } });
        if (existing) {
          slug = `${slug}-${Date.now()}`;
        }
      }
      if (!slug) {
        throw new Error('Slug is required when title is empty');
      }
      const postData: any = {
        slug,
        title: data.title,
        excerpt: sanitizeHtmlContentOrPlain(data.excerpt) ?? data.excerpt ?? null,
        content: sanitizeHtmlContentOrPlain(data.content) ?? data.content ?? null,
        videoUrl: data.videoUrl && data.videoUrl.trim() !== '' ? data.videoUrl : null,
        thumbnailUrl: data.thumbnailUrl && data.thumbnailUrl.trim() !== '' ? data.thumbnailUrl : null,
        type: data.type,
        displayFormat: data.displayFormat || BlogMediaFormat.AUTO,
        categoryId: data.categoryId || null,
        blogAuthorId: data.blogAuthorId || null,
        isPublished: data.isPublished,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        faqItems: data.faqItems?.length ? data.faqItems : null,
        tags: data.tags || [],
        linkedProductIds: data.linkedProductIds || [],
        ...(authorId && { authorId }),
        ...(data.isPublished && data.publishedAt && { publishedAt: new Date(data.publishedAt) }),
      };

      return await prisma.blogPost.create({
        data: postData,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          category: true,
          blogAuthor: true,
        },
      });
    } catch (error: unknown) {
      console.error('Error in blogService.createPost:', error);
      throw error;
    }
  }

  async updatePost(id: string, data: UpdateBlogPostDto) {
    try {
      this.ensureBlogPostModel();
      const updateData: any = {};
      
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.excerpt !== undefined) updateData.excerpt = sanitizeHtmlContentOrPlain(data.excerpt) ?? data.excerpt ?? null;
      if (data.content !== undefined) updateData.content = sanitizeHtmlContentOrPlain(data.content) ?? data.content ?? null;
      if (data.videoUrl !== undefined) {
        updateData.videoUrl = data.videoUrl && data.videoUrl.trim() !== '' ? data.videoUrl : null;
      }
      if (data.thumbnailUrl !== undefined) {
        updateData.thumbnailUrl = data.thumbnailUrl && data.thumbnailUrl.trim() !== '' ? data.thumbnailUrl : null;
      }
      if (data.type !== undefined) updateData.type = data.type;
      if (data.displayFormat !== undefined) updateData.displayFormat = data.displayFormat;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
      if (data.blogAuthorId !== undefined) updateData.blogAuthorId = data.blogAuthorId || null;
      if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;
      if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle || null;
      if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription || null;
      if (data.faqItems !== undefined) updateData.faqItems = data.faqItems?.length ? data.faqItems : null;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.linkedProductIds !== undefined) updateData.linkedProductIds = data.linkedProductIds;
      if (data.publishedAt !== undefined) {
        updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
      }

      return await prisma.blogPost.update({
        where: { id },
        data: updateData,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          category: true,
          blogAuthor: true,
        },
      });
    } catch (error: unknown) {
      console.error('Error in blogService.updatePost:', error);
      throw error;
    }
  }

  async deletePost(id: string) {
    try {
      this.ensureBlogPostModel();
      return await prisma.blogPost.delete({
        where: { id },
      });
    } catch (error: unknown) {
      console.error('Error in blogService.deletePost:', error);
      throw error;
    }
  }

  async incrementViews(id: string) {
    try {
      return await prisma.blogPost.update({
        where: { id },
        data: {
          views: {
            increment: 1,
          },
        },
      });
    } catch (error: unknown) {
      console.error('Error in blogService.incrementViews:', error);
      throw error;
    }
  }

  async createCategory(data: BlogCategoryDto) {
    const baseSlug = (data.slug?.trim() || data.name.trim())
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug || `category-${Date.now()}`;
    const existing = await prisma.blogCategory.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    return prisma.blogCategory.create({
      data: {
        name: data.name.trim(),
        slug,
      },
    });
  }

  async updateCategory(id: string, data: BlogCategoryDto) {
    const updateData: { name?: string; slug?: string } = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.slug !== undefined) {
      updateData.slug = data.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    return prisma.blogCategory.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCategory(id: string) {
    await prisma.blogPost.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    return prisma.blogCategory.delete({
      where: { id },
    });
  }

  async createAuthor(data: BlogAuthorDto) {
    const baseSlug = (data.slug?.trim() || data.name.trim())
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug || `author-${Date.now()}`;
    const existing = await prisma.blogAuthor.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    return prisma.blogAuthor.create({
      data: {
        name: data.name.trim(),
        slug,
        bio: data.bio?.trim() || null,
        avatarUrl: data.avatarUrl?.trim() || null,
      },
    });
  }

  async updateAuthor(id: string, data: BlogAuthorDto) {
    const updateData: {
      name?: string;
      slug?: string;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.slug !== undefined) {
      updateData.slug = data.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    if (data.bio !== undefined) updateData.bio = data.bio.trim() || null;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl.trim() || null;

    return prisma.blogAuthor.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteAuthor(id: string) {
    await prisma.blogPost.updateMany({
      where: { blogAuthorId: id },
      data: { blogAuthorId: null },
    });
    return prisma.blogAuthor.delete({
      where: { id },
    });
  }

  // Blog Settings
  async getSettings(languageCode?: string) {
    try {
      this.ensureBlogPostModel();
      const prismaAny = prisma as any;
      if (!prismaAny.blogSettings) {
        throw new Error(
          'BlogSettings model not found in Prisma Client. Please run: cd backend && npx prisma generate'
        );
      }
      let settings = await prisma.blogSettings.findFirst({
        include: {
          featuredPost: {
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              category: true,
              blogAuthor: true,
            },
          },
          translations: languageCode ? {
            where: { languageCode },
          } : true,
        },
      });

      // Create default settings if none exist
      if (!settings) {
        settings = await prisma.blogSettings.create({
          data: {
            layoutStyle: BlogLayoutStyle.MAGAZINE,
            gridColumns: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
            gap: 'gap-4',
            itemsPerPage: 12,
            showExcerpt: true,
            showAuthor: true,
            showDate: true,
            showViews: false,
            showTags: true,
            heroFullscreen: false,
            heroHeight: '70vh',
            heroAutoZoom: true,
            titleFontSize: 'text-2xl',
            excerptFontSize: 'text-base',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            accentColor: '#000000',
            paddingTop: 'py-8',
            paddingBottom: 'py-8',
            cardBorderRadius: '',
            cardShadow: true,
            cardHoverEffect: true,
            aspectRatio: 'aspect-square',
            videoAutoplay: true,
            videoLoop: true,
            videoMuted: true,
          },
          include: {
            featuredPost: {
              include: {
                category: true,
                blogAuthor: true,
              },
            },
            translations: true,
          },
        }) as any;
      }

      // Apply translation if languageCode is provided
      if (settings && languageCode && settings.translations.length > 0) {
        const translation = settings.translations[0];
        return {
          ...settings,
          headerTitle: translation.headerTitle ?? settings.headerTitle,
          headerSubtitle: translation.headerSubtitle ?? settings.headerSubtitle,
        } as typeof settings;
      }

      return settings;
    } catch (error: unknown) {
      console.error('Error in blogService.getSettings:', error);
      throw error;
    }
  }

  async updateSettings(data: UpdateBlogSettingsDto, updatedBy?: string) {
    try {
      this.ensureBlogPostModel();
      const prismaAny = prisma as any;
      if (!prismaAny.blogSettings) {
        throw new Error(
          'BlogSettings model not found in Prisma Client. Please run: cd backend && npx prisma generate'
        );
      }
      const existingSettings = await prisma.blogSettings.findFirst();
      
      if (!existingSettings) {
        // Create new settings
        const createData: any = {
          layoutStyle: data.layoutStyle || BlogLayoutStyle.MAGAZINE,
          gridColumns: data.gridColumns || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          gap: data.gap || 'gap-4',
          itemsPerPage: data.itemsPerPage || 12,
          showExcerpt: data.showExcerpt !== undefined ? data.showExcerpt : true,
          showAuthor: data.showAuthor !== undefined ? data.showAuthor : true,
          showDate: data.showDate !== undefined ? data.showDate : true,
          showViews: data.showViews !== undefined ? data.showViews : false,
          showTags: data.showTags !== undefined ? data.showTags : true,
          titleFontSize: data.titleFontSize || 'text-2xl',
          excerptFontSize: data.excerptFontSize || 'text-base',
          backgroundColor: data.backgroundColor || '#ffffff',
          textColor: data.textColor || '#000000',
          accentColor: data.accentColor || '#000000',
          paddingTop: data.paddingTop || 'py-8',
          paddingBottom: data.paddingBottom || 'py-8',
          cardBorderRadius: data.cardBorderRadius || 'rounded-lg',
          cardShadow: data.cardShadow !== undefined ? data.cardShadow : true,
          cardHoverEffect: data.cardHoverEffect !== undefined ? data.cardHoverEffect : true,
          heroFullscreen: data.heroFullscreen !== undefined ? data.heroFullscreen : false,
          heroHeight: data.heroHeight || '70vh',
          heroAutoZoom: data.heroAutoZoom !== undefined ? data.heroAutoZoom : true,
          aspectRatio: data.aspectRatio || 'aspect-square',
          videoAutoplay: data.videoAutoplay !== undefined ? data.videoAutoplay : true,
          videoLoop: data.videoLoop !== undefined ? data.videoLoop : true,
          videoMuted: data.videoMuted !== undefined ? data.videoMuted : true,
          ...(data.headerTitle && { headerTitle: data.headerTitle }),
          ...(data.headerSubtitle && { headerSubtitle: data.headerSubtitle }),
          ...(data.headerImageUrl && { headerImageUrl: data.headerImageUrl }),
          ...(data.headerVideoUrl && { headerVideoUrl: data.headerVideoUrl }),
          ...(data.featuredPostId && { featuredPostId: data.featuredPostId }),
          ...(updatedBy && { updatedBy }),
        };

        return await prisma.blogSettings.create({
          data: createData,
          include: {
            featuredPost: true,
          },
        });
      }

      // Update existing settings
      const updateData: any = {};
      
      if (data.layoutStyle !== undefined) updateData.layoutStyle = data.layoutStyle;
      if (data.gridColumns !== undefined) updateData.gridColumns = data.gridColumns;
      if (data.gap !== undefined) updateData.gap = data.gap;
      if (data.itemsPerPage !== undefined) updateData.itemsPerPage = data.itemsPerPage;
      if (data.showExcerpt !== undefined) updateData.showExcerpt = data.showExcerpt;
      if (data.showAuthor !== undefined) updateData.showAuthor = data.showAuthor;
      if (data.showDate !== undefined) updateData.showDate = data.showDate;
      if (data.showViews !== undefined) updateData.showViews = data.showViews;
      if (data.showTags !== undefined) updateData.showTags = data.showTags;
      if (data.headerTitle !== undefined) updateData.headerTitle = data.headerTitle;
      if (data.headerSubtitle !== undefined) updateData.headerSubtitle = data.headerSubtitle;
      if (data.headerImageUrl !== undefined) updateData.headerImageUrl = data.headerImageUrl;
      if (data.headerVideoUrl !== undefined) updateData.headerVideoUrl = data.headerVideoUrl;
      if (data.heroFullscreen !== undefined) updateData.heroFullscreen = data.heroFullscreen;
      if (data.heroHeight !== undefined) updateData.heroHeight = data.heroHeight;
      if (data.heroAutoZoom !== undefined) updateData.heroAutoZoom = data.heroAutoZoom;
      if (data.titleFontSize !== undefined) updateData.titleFontSize = data.titleFontSize;
      if (data.excerptFontSize !== undefined) updateData.excerptFontSize = data.excerptFontSize;
      if (data.backgroundColor !== undefined) updateData.backgroundColor = data.backgroundColor;
      if (data.textColor !== undefined) updateData.textColor = data.textColor;
      if (data.accentColor !== undefined) updateData.accentColor = data.accentColor;
      if (data.paddingTop !== undefined) updateData.paddingTop = data.paddingTop;
      if (data.paddingBottom !== undefined) updateData.paddingBottom = data.paddingBottom;
      if (data.cardBorderRadius !== undefined) updateData.cardBorderRadius = data.cardBorderRadius;
      if (data.cardShadow !== undefined) updateData.cardShadow = data.cardShadow;
      if (data.cardHoverEffect !== undefined) updateData.cardHoverEffect = data.cardHoverEffect;
      if (data.featuredPostId !== undefined) updateData.featuredPostId = data.featuredPostId;
      if (data.aspectRatio !== undefined) updateData.aspectRatio = data.aspectRatio;
      if (data.videoAutoplay !== undefined) updateData.videoAutoplay = data.videoAutoplay;
      if (data.videoLoop !== undefined) updateData.videoLoop = data.videoLoop;
      if (data.videoMuted !== undefined) updateData.videoMuted = data.videoMuted;
      if (updatedBy !== undefined) updateData.updatedBy = updatedBy;

      return await prisma.blogSettings.update({
        where: { id: existingSettings.id },
        data: updateData,
        include: {
          featuredPost: true,
        },
      });
    } catch (error: unknown) {
      console.error('Error in blogService.updateSettings:', error);
      throw error;
    }
  }
}

export const blogService = new BlogService();
