export interface CreateProductTranslationDto {
  productId: string;
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

export interface CreateCategoryTranslationDto {
  categoryId: string;
  languageCode: string;
  name?: string;
  description?: string;
}

export interface UpdateCategoryTranslationDto {
  name?: string;
  description?: string;
}

export interface CreatePageTranslationDto {
  pageId: string;
  languageCode: string;
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  config?: Record<string, any>; // For translated config fields
}

export interface UpdatePageTranslationDto {
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  config?: Record<string, any>;
}

export interface CreateHomepageSectionTranslationDto {
  sectionId: string;
  languageCode: string;
  title?: string;
  config?: Record<string, any>; // For translated config fields (buttonText, description, etc.)
}

export interface UpdateHomepageSectionTranslationDto {
  title?: string;
  config?: Record<string, any>;
}

export interface CreateLookbookTranslationDto {
  lookbookId: string;
  languageCode: string;
  title?: string;
  description?: string;
}

export interface UpdateLookbookTranslationDto {
  title?: string;
  description?: string;
}

export interface CreateProductPageDesignTranslationDto {
  languageCode: string;
  sizeChartLabels?: Record<string, string>; // Map of original label -> translated label
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

export interface CreateFooterTranslationDto {
  footerId: string;
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

export interface CreateBlogPostTranslationDto {
  blogPostId: string;
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
