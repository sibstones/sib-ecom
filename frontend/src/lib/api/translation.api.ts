import { apiClient } from './client';

export interface ProductTranslation {
  id: string;
  productId: string;
  languageCode: string;
  name?: string | null;
  description?: string | null;
  material?: string | null;
  lining?: string | null;
  countryOfOrigin?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductTranslationDto {
  languageCode: string;
  name?: string;
  description?: string;
  material?: string;
  lining?: string;
  countryOfOrigin?: string;
}

export interface UpdateProductTranslationDto {
  name?: string;
  description?: string;
  material?: string;
  lining?: string;
  countryOfOrigin?: string;
}

export interface CategoryTranslation {
  id: string;
  categoryId: string;
  languageCode: string;
  name?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryTranslationDto {
  languageCode: string;
  name?: string;
  description?: string;
}

export interface UpdateCategoryTranslationDto {
  name?: string;
  description?: string;
}

export interface PageTranslation {
  id: string;
  pageId: string;
  languageCode: string;
  title?: string | null;
  content?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  config?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageTranslationDto {
  languageCode: string;
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  config?: Record<string, any>;
}

export interface UpdatePageTranslationDto {
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  config?: Record<string, any>;
}

export interface HomepageSectionTranslation {
  id: string;
  sectionId: string;
  languageCode: string;
  title?: string | null;
  config?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHomepageSectionTranslationDto {
  languageCode: string;
  title?: string;
  config?: Record<string, any>;
}

export interface UpdateHomepageSectionTranslationDto {
  title?: string;
  config?: Record<string, any>;
}

export interface LookbookTranslation {
  id: string;
  lookbookId: string;
  languageCode: string;
  title?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLookbookTranslationDto {
  languageCode: string;
  title?: string;
  description?: string;
}

export interface UpdateLookbookTranslationDto {
  title?: string;
  description?: string;
}

export interface ProductPageDesignTranslation {
  id: string;
  languageCode: string;
  sizeChartLabels?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPageDesignTranslationDto {
  languageCode: string;
  sizeChartLabels?: Record<string, string>;
}

export interface UpdateProductPageDesignTranslationDto {
  sizeChartLabels?: Record<string, string>;
}

export interface FooterColumnTranslation {
  title: string;
  links: Array<{
    text: string;
    url: string;
  }>;
}

export interface FooterLinkTranslation {
  text: string;
  url: string;
}

export interface FooterSocialLinksTranslation {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  youtube?: string;
}

export interface FooterTranslation {
  id: string;
  footerId: string;
  languageCode: string;
  brandName?: string | null;
  tagline?: string | null;
  columns?: FooterColumnTranslation[] | null;
  copyright?: string | null;
  links?: FooterLinkTranslation[] | null;
  socialLinks?: FooterSocialLinksTranslation | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFooterTranslationDto {
  languageCode: string;
  brandName?: string;
  tagline?: string;
  columns?: FooterColumnTranslation[];
  copyright?: string;
  links?: FooterLinkTranslation[];
  socialLinks?: FooterSocialLinksTranslation;
}

export interface UpdateFooterTranslationDto {
  brandName?: string;
  tagline?: string;
  columns?: FooterColumnTranslation[];
  copyright?: string;
  links?: FooterLinkTranslation[];
  socialLinks?: FooterSocialLinksTranslation;
}

export interface BlogPostTranslation {
  id: string;
  blogPostId: string;
  languageCode: string;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogPostTranslationDto {
  languageCode: string;
  title?: string;
  excerpt?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdateBlogPostTranslationDto {
  title?: string;
  excerpt?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export const translationApi = {
  // Get all translations for a product
  getProductTranslations: (productId: string) =>
    apiClient.get<{ translations: ProductTranslation[] }>(`/translations/products/${productId}`),

  // Get translation for a product in a specific language
  getProductTranslation: (productId: string, languageCode: string) =>
    apiClient.get<{ translation: ProductTranslation }>(
      `/translations/products/${productId}/${languageCode}`
    ),

  // Create or update product translation
  upsertProductTranslation: (productId: string, data: CreateProductTranslationDto) =>
    apiClient.post<{ translation: ProductTranslation }>(
      `/translations/products/${productId}`,
      data
    ),

  // Update product translation
  updateProductTranslation: (
    productId: string,
    languageCode: string,
    data: UpdateProductTranslationDto
  ) =>
    apiClient.put<{ translation: ProductTranslation }>(
      `/translations/products/${productId}/${languageCode}`,
      data
    ),

  // Delete product translation
  deleteProductTranslation: (productId: string, languageCode: string) =>
    apiClient.delete<{ success: boolean }>(`/translations/products/${productId}/${languageCode}`),

  // Get all translations for a category
  getCategoryTranslations: (categoryId: string) =>
    apiClient.get<{ translations: CategoryTranslation[] }>(
      `/translations/categories/${categoryId}`
    ),

  // Get translation for a category in a specific language
  getCategoryTranslation: (categoryId: string, languageCode: string) =>
    apiClient.get<{ translation: CategoryTranslation }>(
      `/translations/categories/${categoryId}/${languageCode}`
    ),

  // Create or update category translation
  upsertCategoryTranslation: (categoryId: string, data: CreateCategoryTranslationDto) =>
    apiClient.post<{ translation: CategoryTranslation }>(
      `/translations/categories/${categoryId}`,
      data
    ),

  // Update category translation
  updateCategoryTranslation: (
    categoryId: string,
    languageCode: string,
    data: UpdateCategoryTranslationDto
  ) =>
    apiClient.put<{ translation: CategoryTranslation }>(
      `/translations/categories/${categoryId}/${languageCode}`,
      data
    ),

  // Delete category translation
  deleteCategoryTranslation: (categoryId: string, languageCode: string) =>
    apiClient.delete<{ success: boolean }>(
      `/translations/categories/${categoryId}/${languageCode}`
    ),

  // Get all translations for a page
  getPageTranslations: (pageId: string) =>
    apiClient.get<{ translations: PageTranslation[] }>(`/translations/pages/${pageId}`),

  // Get translation for a page in a specific language
  getPageTranslation: (pageId: string, languageCode: string) =>
    apiClient.get<{ translation: PageTranslation }>(
      `/translations/pages/${pageId}/${languageCode}`
    ),

  // Create or update page translation
  upsertPageTranslation: (pageId: string, data: CreatePageTranslationDto) =>
    apiClient.post<{ translation: PageTranslation }>(`/translations/pages/${pageId}`, data),

  // Update page translation
  updatePageTranslation: (pageId: string, languageCode: string, data: UpdatePageTranslationDto) =>
    apiClient.put<{ translation: PageTranslation }>(
      `/translations/pages/${pageId}/${languageCode}`,
      data
    ),

  // Delete page translation
  deletePageTranslation: (pageId: string, languageCode: string) =>
    apiClient.delete<{ success: boolean }>(`/translations/pages/${pageId}/${languageCode}`),

  // Get all translations for a homepage section
  getHomepageSectionTranslations: (sectionId: string) =>
    apiClient.get<{ translations: HomepageSectionTranslation[] }>(
      `/translations/homepage-sections/${sectionId}`
    ),

  // Get translation for a homepage section in a specific language
  getHomepageSectionTranslation: (sectionId: string, languageCode: string) =>
    apiClient.get<{ translation: HomepageSectionTranslation }>(
      `/translations/homepage-sections/${sectionId}/${languageCode}`
    ),

  // Create or update homepage section translation
  upsertHomepageSectionTranslation: (
    sectionId: string,
    data: CreateHomepageSectionTranslationDto
  ) =>
    apiClient.post<{ translation: HomepageSectionTranslation }>(
      `/translations/homepage-sections/${sectionId}`,
      data
    ),

  // Update homepage section translation
  updateHomepageSectionTranslation: (
    sectionId: string,
    languageCode: string,
    data: UpdateHomepageSectionTranslationDto
  ) =>
    apiClient.put<{ translation: HomepageSectionTranslation }>(
      `/translations/homepage-sections/${sectionId}/${languageCode}`,
      data
    ),

  // Delete homepage section translation
  deleteHomepageSectionTranslation: (sectionId: string, languageCode: string) =>
    apiClient.delete<{ success: boolean }>(
      `/translations/homepage-sections/${sectionId}/${languageCode}`
    ),

  // Get all translations for product page design
  getProductPageDesignTranslations: () =>
    apiClient.get<{ translations: ProductPageDesignTranslation[] }>(
      '/translations/product-page-design'
    ),

  // Get translation for product page design in a specific language
  getProductPageDesignTranslation: (languageCode: string) =>
    apiClient.get<{ translation: ProductPageDesignTranslation }>(
      `/translations/product-page-design/${languageCode}`
    ),

  // Create or update product page design translation
  upsertProductPageDesignTranslation: (data: CreateProductPageDesignTranslationDto) =>
    apiClient.post<{ translation: ProductPageDesignTranslation }>(
      '/translations/product-page-design',
      data
    ),

  // Update product page design translation
  updateProductPageDesignTranslation: (
    languageCode: string,
    data: UpdateProductPageDesignTranslationDto
  ) =>
    apiClient.put<{ translation: ProductPageDesignTranslation }>(
      `/translations/product-page-design/${languageCode}`,
      data
    ),

  // Delete product page design translation
  deleteProductPageDesignTranslation: (languageCode: string) =>
    apiClient.delete<{ success: boolean }>(`/translations/product-page-design/${languageCode}`),

  // Get all translations for a lookbook
  getLookbookTranslations: (lookbookId: string) =>
    apiClient.get<{ translations: LookbookTranslation[] }>(`/translations/lookbooks/${lookbookId}`),

  // Get translation for a lookbook in a specific language
  getLookbookTranslation: (lookbookId: string, languageCode: string) =>
    apiClient.get<{ translation: LookbookTranslation }>(
      `/translations/lookbooks/${lookbookId}/${languageCode}`
    ),

  // Create or update lookbook translation
  upsertLookbookTranslation: (lookbookId: string, data: CreateLookbookTranslationDto) =>
    apiClient.post<{ translation: LookbookTranslation }>(
      `/translations/lookbooks/${lookbookId}`,
      data
    ),

  // Update lookbook translation
  updateLookbookTranslation: (
    lookbookId: string,
    languageCode: string,
    data: UpdateLookbookTranslationDto
  ) =>
    apiClient.put<{ translation: LookbookTranslation }>(
      `/translations/lookbooks/${lookbookId}/${languageCode}`,
      data
    ),

  // Delete lookbook translation
  deleteLookbookTranslation: (lookbookId: string, languageCode: string) =>
    apiClient.delete<{ success: boolean }>(`/translations/lookbooks/${lookbookId}/${languageCode}`),

  // Get all translations for a footer
  getFooterTranslations: (footerId: string) =>
    apiClient.get<{ translations: FooterTranslation[] }>(`/translations/footers/${footerId}`),

  // Get translation for a footer in a specific language
  getFooterTranslation: (footerId: string, languageCode: string) =>
    apiClient.get<{ translation: FooterTranslation }>(
      `/translations/footers/${footerId}/${languageCode}`
    ),

  // Create or update footer translation
  upsertFooterTranslation: (footerId: string, data: CreateFooterTranslationDto) =>
    apiClient.post<{ translation: FooterTranslation }>(`/translations/footers/${footerId}`, data),

  // Update footer translation
  updateFooterTranslation: (
    footerId: string,
    languageCode: string,
    data: UpdateFooterTranslationDto
  ) =>
    apiClient.put<{ translation: FooterTranslation }>(
      `/translations/footers/${footerId}/${languageCode}`,
      data
    ),

  // Delete footer translation
  deleteFooterTranslation: (footerId: string, languageCode: string) =>
    apiClient.delete<{ success: boolean }>(`/translations/footers/${footerId}/${languageCode}`),

  // Generate translation using GPT Assistant
  generateGPTTranslation: (data: {
    sourceLanguage: string;
    targetLanguage: string;
    content: string;
  }) => apiClient.post<{ translation: string }>('/translations/gpt-translate', data),

  // Get all translations for a blog post
  getBlogPostTranslations: (blogPostId: string) =>
    apiClient.get<{ translations: BlogPostTranslation[] }>(
      `/translations/blog-posts/${blogPostId}`
    ),

  // Get translation for a blog post in a specific language
  getBlogPostTranslation: (blogPostId: string, languageCode: string) =>
    apiClient.get<{ translation: BlogPostTranslation }>(
      `/translations/blog-posts/${blogPostId}/${languageCode}`
    ),

  // Create or update blog post translation
  upsertBlogPostTranslation: (blogPostId: string, data: CreateBlogPostTranslationDto) =>
    apiClient.post<{ translation: BlogPostTranslation }>(
      `/translations/blog-posts/${blogPostId}`,
      data
    ),

  // Update blog post translation
  updateBlogPostTranslation: (
    blogPostId: string,
    languageCode: string,
    data: UpdateBlogPostTranslationDto
  ) =>
    apiClient.put<{ translation: BlogPostTranslation }>(
      `/translations/blog-posts/${blogPostId}/${languageCode}`,
      data
    ),

  // Delete blog post translation
  deleteBlogPostTranslation: (blogPostId: string, languageCode: string) =>
    apiClient.delete<{ success: boolean }>(
      `/translations/blog-posts/${blogPostId}/${languageCode}`
    ),
};
