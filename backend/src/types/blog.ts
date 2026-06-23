export enum BlogPostType {
  ARTICLE = 'ARTICLE',
  VIDEO = 'VIDEO',
  MIXED = 'MIXED',
}

export enum BlogMediaFormat {
  AUTO = 'AUTO',
  LANDSCAPE = 'LANDSCAPE',
  PORTRAIT = 'PORTRAIT',
  SQUARE = 'SQUARE',
}

export enum BlogLayoutStyle {
  MAGAZINE = 'MAGAZINE',
  INSTAGRAM = 'INSTAGRAM',
  TIKTOK = 'TIKTOK',
  MIXED = 'MIXED',
}

export interface BlogPostDto {
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  type: BlogPostType;
  displayFormat: BlogMediaFormat;
  categoryId?: string;
  blogAuthorId?: string;
  isPublished: boolean;
  publishedAt?: Date;
  metaTitle?: string;
  metaDescription?: string;
  faqItems?: BlogFaqItemDto[];
  tags?: string[];
  linkedProductIds?: string[];
}

export interface CreateBlogPostDto extends BlogPostDto {}

export interface UpdateBlogPostDto extends Partial<BlogPostDto> {}

export interface BlogSettingsDto {
  layoutStyle: BlogLayoutStyle;
  gridColumns: string;
  gap: string;
  itemsPerPage: number;
  showExcerpt: boolean;
  showAuthor: boolean;
  showDate: boolean;
  showViews: boolean;
  showTags: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  headerImageUrl?: string;
  headerVideoUrl?: string;
  heroFullscreen: boolean;
  heroHeight: string;
  heroAutoZoom: boolean;
  titleFontSize: string;
  excerptFontSize: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  paddingTop: string;
  paddingBottom: string;
  cardBorderRadius: string;
  cardShadow: boolean;
  cardHoverEffect: boolean;
  featuredPostId?: string;
  aspectRatio: string;
  videoAutoplay: boolean;
  videoLoop: boolean;
  videoMuted: boolean;
}

export interface CreateBlogSettingsDto extends BlogSettingsDto {}

export interface UpdateBlogSettingsDto extends Partial<BlogSettingsDto> {}

export interface BlogCategoryDto {
  name: string;
  slug?: string;
}

export interface BlogAuthorDto {
  name: string;
  slug?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface BlogFaqItemDto {
  question: string;
  answer: string;
}
