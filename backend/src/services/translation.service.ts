import prisma from '../config/database';
import { sanitizeHtmlContentOrPlain } from '../utils/sanitize';
import { 
  CreateProductTranslationDto, 
  UpdateProductTranslationDto,
  CreateCategoryTranslationDto,
  UpdateCategoryTranslationDto,
  CreatePageTranslationDto,
  UpdatePageTranslationDto,
  CreateHomepageSectionTranslationDto,
  UpdateHomepageSectionTranslationDto,
  CreateLookbookTranslationDto,
  UpdateLookbookTranslationDto,
  CreateProductPageDesignTranslationDto,
  UpdateProductPageDesignTranslationDto,
  CreateFooterTranslationDto,
  UpdateFooterTranslationDto,
  CreateBlogPostTranslationDto,
  UpdateBlogPostTranslationDto
} from '../types/translation';

export class TranslationService {
  /**
   * Get translation for a product in a specific language
   */
  async getProductTranslation(productId: string, languageCode: string) {
    return prisma.productTranslation.findUnique({
      where: {
        productId_languageCode: {
          productId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get all translations for a product
   */
  async getProductTranslations(productId: string) {
    return prisma.productTranslation.findMany({
      where: { productId },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update product translation
   */
  async upsertProductTranslation(data: CreateProductTranslationDto & UpdateProductTranslationDto) {
    const { productId, languageCode, ...translationData } = data;
    
    // Remove undefined values
    const cleanData: any = {};
    if (translationData.name !== undefined) cleanData.name = translationData.name;
    if (translationData.description !== undefined) cleanData.description = sanitizeHtmlContentOrPlain(translationData.description) ?? translationData.description;
    if (translationData.material !== undefined) cleanData.material = translationData.material;
    if (translationData.lining !== undefined) cleanData.lining = translationData.lining;
    if (translationData.countryOfOrigin !== undefined) cleanData.countryOfOrigin = translationData.countryOfOrigin;

    return prisma.productTranslation.upsert({
      where: {
        productId_languageCode: {
          productId,
          languageCode,
        },
      },
      create: {
        productId,
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete product translation
   */
  async deleteProductTranslation(productId: string, languageCode: string) {
    return prisma.productTranslation.delete({
      where: {
        productId_languageCode: {
          productId,
          languageCode,
        },
      },
    });
  }

  /**
   * Delete all translations for a product
   */
  async deleteProductTranslations(productId: string) {
    return prisma.productTranslation.deleteMany({
      where: { productId },
    });
  }

  /**
   * Get translated product data (fallback to default language if translation not found)
   */
  async getTranslatedProductData(productId: string, languageCode: string, defaultLanguageCode: string = 'en') {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        translations: true,
      },
    });

    if (!product) {
      return null;
    }

    // Try to get translation for requested language
    let translation = product.translations.find((t) => t.languageCode === languageCode);
    
    // Fallback to default language if translation not found
    if (!translation && languageCode !== defaultLanguageCode) {
      translation = product.translations.find((t) => t.languageCode === defaultLanguageCode);
    }

    return {
      name: translation?.name || product.name,
      description: translation?.description || product.description,
      material: translation?.material || product.material,
      lining: translation?.lining || product.lining,
      countryOfOrigin: translation?.countryOfOrigin || product.countryOfOrigin,
    };
  }

  /**
   * Get translation for a category in a specific language
   */
  async getCategoryTranslation(categoryId: string, languageCode: string) {
    return prisma.categoryTranslation.findUnique({
      where: {
        categoryId_languageCode: {
          categoryId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get all translations for a category
   */
  async getCategoryTranslations(categoryId: string) {
    return prisma.categoryTranslation.findMany({
      where: { categoryId },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update category translation
   */
  async upsertCategoryTranslation(data: CreateCategoryTranslationDto & UpdateCategoryTranslationDto) {
    const { categoryId, languageCode, ...translationData } = data;
    
    // Remove undefined values
    const cleanData: any = {};
    if (translationData.name !== undefined) cleanData.name = translationData.name;
    if (translationData.description !== undefined) cleanData.description = sanitizeHtmlContentOrPlain(translationData.description) ?? translationData.description;

    return prisma.categoryTranslation.upsert({
      where: {
        categoryId_languageCode: {
          categoryId,
          languageCode,
        },
      },
      create: {
        categoryId,
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete category translation
   */
  async deleteCategoryTranslation(categoryId: string, languageCode: string) {
    return prisma.categoryTranslation.delete({
      where: {
        categoryId_languageCode: {
          categoryId,
          languageCode,
        },
      },
    });
  }

  /**
   * Delete all translations for a category
   */
  async deleteCategoryTranslations(categoryId: string) {
    return prisma.categoryTranslation.deleteMany({
      where: { categoryId },
    });
  }

  /**
   * Get translated category data (fallback to default language if translation not found)
   */
  async getTranslatedCategoryData(categoryId: string, languageCode: string, defaultLanguageCode: string = 'en') {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        translations: true,
      },
    });

    if (!category) {
      return null;
    }

    // Try to get translation for requested language
    let translation = category.translations.find((t) => t.languageCode === languageCode);
    
    // Fallback to default language if translation not found
    if (!translation && languageCode !== defaultLanguageCode) {
      translation = category.translations.find((t) => t.languageCode === defaultLanguageCode);
    }

    return {
      ...category,
      name: translation?.name || category.name,
      description: translation?.description || category.description,
    };
  }

  /**
   * Get translation for a page in a specific language
   */
  async getPageTranslation(pageId: string, languageCode: string) {
    return prisma.pageTranslation.findUnique({
      where: {
        pageId_languageCode: {
          pageId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get all translations for a page
   */
  async getPageTranslations(pageId: string) {
    return prisma.pageTranslation.findMany({
      where: { pageId },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update page translation
   */
  async upsertPageTranslation(data: CreatePageTranslationDto & UpdatePageTranslationDto) {
    const { pageId, languageCode, ...translationData } = data;
    
    const cleanData: any = {};
    if (translationData.title !== undefined) cleanData.title = translationData.title;
    if (translationData.content !== undefined) cleanData.content = sanitizeHtmlContentOrPlain(translationData.content) ?? translationData.content;
    if (translationData.metaTitle !== undefined) cleanData.metaTitle = translationData.metaTitle;
    if (translationData.metaDescription !== undefined) cleanData.metaDescription = translationData.metaDescription;
    if (translationData.config !== undefined) cleanData.config = translationData.config;

    return prisma.pageTranslation.upsert({
      where: {
        pageId_languageCode: {
          pageId,
          languageCode,
        },
      },
      create: {
        pageId,
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete page translation
   */
  async deletePageTranslation(pageId: string, languageCode: string) {
    return prisma.pageTranslation.delete({
      where: {
        pageId_languageCode: {
          pageId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get translation for a homepage section in a specific language
   */
  async getHomepageSectionTranslation(sectionId: string, languageCode: string) {
    return prisma.homepageSectionTranslation.findUnique({
      where: {
        sectionId_languageCode: {
          sectionId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get all translations for a homepage section
   */
  async getHomepageSectionTranslations(sectionId: string) {
    return prisma.homepageSectionTranslation.findMany({
      where: { sectionId },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update homepage section translation
   */
  async upsertHomepageSectionTranslation(data: CreateHomepageSectionTranslationDto & UpdateHomepageSectionTranslationDto) {
    const { sectionId, languageCode, ...translationData } = data;
    
    const cleanData: any = {};
    if (translationData.title !== undefined) cleanData.title = translationData.title;
    if (translationData.config !== undefined) cleanData.config = translationData.config;

    return prisma.homepageSectionTranslation.upsert({
      where: {
        sectionId_languageCode: {
          sectionId,
          languageCode,
        },
      },
      create: {
        sectionId,
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete homepage section translation
   */
  async deleteHomepageSectionTranslation(sectionId: string, languageCode: string) {
    return prisma.homepageSectionTranslation.delete({
      where: {
        sectionId_languageCode: {
          sectionId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get translation for a lookbook in a specific language
   */
  async getLookbookTranslation(lookbookId: string, languageCode: string) {
    return prisma.lookbookTranslation.findUnique({
      where: {
        lookbookId_languageCode: {
          lookbookId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get all translations for a lookbook
   */
  async getLookbookTranslations(lookbookId: string) {
    return prisma.lookbookTranslation.findMany({
      where: { lookbookId },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update lookbook translation
   */
  async upsertLookbookTranslation(data: CreateLookbookTranslationDto & UpdateLookbookTranslationDto) {
    const { lookbookId, languageCode, ...translationData } = data;
    
    const cleanData: any = {};
    if (translationData.title !== undefined) cleanData.title = translationData.title;
    if (translationData.description !== undefined) cleanData.description = sanitizeHtmlContentOrPlain(translationData.description) ?? translationData.description;

    return prisma.lookbookTranslation.upsert({
      where: {
        lookbookId_languageCode: {
          lookbookId,
          languageCode,
        },
      },
      create: {
        lookbookId,
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete lookbook translation
   */
  async deleteLookbookTranslation(lookbookId: string, languageCode: string) {
    return prisma.lookbookTranslation.delete({
      where: {
        lookbookId_languageCode: {
          lookbookId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get translation for product page design in a specific language
   */
  async getProductPageDesignTranslation(languageCode: string) {
    return prisma.productPageDesignTranslation.findUnique({
      where: {
        languageCode,
      },
    });
  }

  /**
   * Get all translations for product page design
   */
  async getProductPageDesignTranslations() {
    return prisma.productPageDesignTranslation.findMany({
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update product page design translation
   */
  async upsertProductPageDesignTranslation(data: CreateProductPageDesignTranslationDto & UpdateProductPageDesignTranslationDto) {
    const { languageCode, ...translationData } = data;
    
    const cleanData: any = {};
    if (translationData.sizeChartLabels !== undefined) {
      cleanData.sizeChartLabels = translationData.sizeChartLabels;
    }

    return prisma.productPageDesignTranslation.upsert({
      where: {
        languageCode,
      },
      create: {
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete product page design translation
   */
  async deleteProductPageDesignTranslation(languageCode: string) {
    return prisma.productPageDesignTranslation.delete({
      where: {
        languageCode,
      },
    });
  }

  /**
   * Get translation for a footer in a specific language
   */
  async getFooterTranslation(footerId: string, languageCode: string) {
    return prisma.footerTranslation.findUnique({
      where: {
        footerId_languageCode: {
          footerId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get all translations for a footer
   */
  async getFooterTranslations(footerId: string) {
    return prisma.footerTranslation.findMany({
      where: { footerId },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Create or update footer translation
   */
  async upsertFooterTranslation(data: CreateFooterTranslationDto & UpdateFooterTranslationDto) {
    const { footerId, languageCode, ...translationData } = data;
    
    // Remove undefined values
    const cleanData: any = {};
    if (translationData.brandName !== undefined) cleanData.brandName = translationData.brandName;
    if (translationData.tagline !== undefined) cleanData.tagline = translationData.tagline;
    if (translationData.columns !== undefined) cleanData.columns = translationData.columns;
    if (translationData.copyright !== undefined) cleanData.copyright = translationData.copyright;
    if (translationData.links !== undefined) cleanData.links = translationData.links;
    if (translationData.socialLinks !== undefined) cleanData.socialLinks = translationData.socialLinks;

    return prisma.footerTranslation.upsert({
      where: {
        footerId_languageCode: {
          footerId,
          languageCode,
        },
      },
      create: {
        footerId,
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete footer translation
   */
  async deleteFooterTranslation(footerId: string, languageCode: string) {
    return prisma.footerTranslation.delete({
      where: {
        footerId_languageCode: {
          footerId,
          languageCode,
        },
      },
    });
  }

  /**
   * Get all translations for a blog post
   */
  async getBlogPostTranslations(blogPostId: string) {
    return prisma.blogPostTranslation.findMany({
      where: { blogPostId },
      orderBy: { languageCode: 'asc' },
    });
  }

  /**
   * Get translation for a blog post in a specific language
   */
  async getBlogPostTranslation(blogPostId: string, languageCode: string) {
    return prisma.blogPostTranslation.findUnique({
      where: {
        blogPostId_languageCode: {
          blogPostId,
          languageCode,
        },
      },
    });
  }

  /**
   * Create or update blog post translation
   */
  async upsertBlogPostTranslation(data: CreateBlogPostTranslationDto & UpdateBlogPostTranslationDto) {
    const { blogPostId, languageCode, ...translationData } = data;
    
    // Remove undefined values
    const cleanData: any = {};
    if (translationData.title !== undefined) cleanData.title = translationData.title;
    if (translationData.excerpt !== undefined) cleanData.excerpt = sanitizeHtmlContentOrPlain(translationData.excerpt) ?? translationData.excerpt;
    if (translationData.content !== undefined) cleanData.content = sanitizeHtmlContentOrPlain(translationData.content) ?? translationData.content;
    if (translationData.metaTitle !== undefined) cleanData.metaTitle = translationData.metaTitle;
    if (translationData.metaDescription !== undefined) cleanData.metaDescription = translationData.metaDescription;

    return prisma.blogPostTranslation.upsert({
      where: {
        blogPostId_languageCode: {
          blogPostId,
          languageCode,
        },
      },
      create: {
        blogPostId,
        languageCode,
        ...cleanData,
      },
      update: cleanData,
    });
  }

  /**
   * Delete blog post translation
   */
  async deleteBlogPostTranslation(blogPostId: string, languageCode: string) {
    return prisma.blogPostTranslation.delete({
      where: {
        blogPostId_languageCode: {
          blogPostId,
          languageCode,
        },
      },
    });
  }
}

export const translationService = new TranslationService();
