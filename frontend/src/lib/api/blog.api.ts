import { apiClient } from './client';
import { normalizeUploadFile } from '$lib/utils/file-upload';

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

/** Product preview for blog post "buy" block (image + link) */
export interface BlogLinkedProduct {
  id: string;
  slug: string;
  name: string;
  price: number | null;
  imageUrl: string | null;
}

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogAuthor {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  type: BlogPostType;
  displayFormat: BlogMediaFormat;
  categoryId?: string | null;
  category?: BlogCategory | null;
  blogAuthorId?: string | null;
  blogAuthor?: BlogAuthor | null;
  isPublished: boolean;
  publishedAt?: string;
  authorId?: string;
  author?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  views: number;
  metaTitle?: string;
  metaDescription?: string;
  faqItems?: BlogFaqItem[];
  tags: string[];
  linkedProductIds?: string[];
  /** Filled by API when fetching post by slug (product previews for "buy" block) */
  linkedProducts?: BlogLinkedProduct[];
  createdAt: string;
  updatedAt: string;
}

export interface BlogSettings {
  id: string;
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
  featuredPost?: BlogPost;
  aspectRatio: string;
  videoAutoplay: boolean;
  videoLoop: boolean;
  videoMuted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogPostDto {
  slug?: string;
  title: string;
  excerpt?: string;
  content?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  type: BlogPostType;
  displayFormat: BlogMediaFormat;
  categoryId?: string | null;
  blogAuthorId?: string | null;
  isPublished: boolean;
  publishedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
  faqItems?: BlogFaqItem[];
  tags?: string[];
  linkedProductIds?: string[];
}

export interface UpdateBlogPostDto extends Partial<CreateBlogPostDto> {}

export interface UpdateBlogSettingsDto {
  layoutStyle?: BlogLayoutStyle;
  gridColumns?: string;
  gap?: string;
  itemsPerPage?: number;
  showExcerpt?: boolean;
  showAuthor?: boolean;
  showDate?: boolean;
  showViews?: boolean;
  showTags?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  headerImageUrl?: string;
  headerVideoUrl?: string;
  heroFullscreen?: boolean;
  heroHeight?: string;
  heroAutoZoom?: boolean;
  titleFontSize?: string;
  excerptFontSize?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  cardBorderRadius?: string;
  cardShadow?: boolean;
  cardHoverEffect?: boolean;
  featuredPostId?: string | null;
  aspectRatio?: string;
  videoAutoplay?: boolean;
  videoLoop?: boolean;
  videoMuted?: boolean;
}

export const blogApi = {
  getAllPosts: (activeOnly: boolean = false, languageCode?: string) => {
    const params = new URLSearchParams({
      active: activeOnly.toString(),
    });
    if (languageCode) {
      params.append('languageCode', languageCode);
    }
    return apiClient.get<{ posts: BlogPost[] }>(`/blog/posts?${params.toString()}`);
  },
  getPostBySlug: (slug: string, languageCode?: string) => {
    const params = languageCode ? `?languageCode=${languageCode}` : '';
    return apiClient.get<{ post: BlogPost }>(`/blog/posts/slug/${slug}${params}`);
  },
  getPostById: (id: string) => apiClient.get<{ post: BlogPost }>(`/blog/posts/admin/${id}`),
  getAllCategories: () => apiClient.get<{ categories: BlogCategory[] }>('/blog/categories'),
  getAllAuthors: () => apiClient.get<{ authors: BlogAuthor[] }>('/blog/authors'),
  createCategory: (data: { name: string; slug?: string }) =>
    apiClient.post<{ category: BlogCategory }>('/blog/categories', data),
  updateCategory: (id: string, data: { name: string; slug?: string }) =>
    apiClient.put<{ category: BlogCategory }>(`/blog/categories/${id}`, data),
  deleteCategory: (id: string) => apiClient.delete<{ message: string }>(`/blog/categories/${id}`),
  createAuthor: (data: { name: string; slug?: string; bio?: string; avatarUrl?: string }) =>
    apiClient.post<{ author: BlogAuthor }>('/blog/authors', data),
  updateAuthor: (
    id: string,
    data: { name: string; slug?: string; bio?: string; avatarUrl?: string }
  ) => apiClient.put<{ author: BlogAuthor }>(`/blog/authors/${id}`, data),
  deleteAuthor: (id: string) => apiClient.delete<{ message: string }>(`/blog/authors/${id}`),
  createPost: (data: CreateBlogPostDto) => apiClient.post<{ post: BlogPost }>('/blog/posts', data),
  updatePost: (id: string, data: UpdateBlogPostDto) =>
    apiClient.put<{ post: BlogPost }>(`/blog/posts/admin/${id}`, data),
  deletePost: (id: string) => apiClient.delete<{ message: string }>(`/blog/posts/admin/${id}`),
  incrementViews: (id: string) => apiClient.post<{ message: string }>(`/blog/posts/${id}/views`),
  getSettings: (languageCode?: string) => {
    const params = languageCode ? `?languageCode=${languageCode}` : '';
    return apiClient.get<{ settings: BlogSettings }>(`/blog/settings${params}`);
  },
  updateSettings: (data: UpdateBlogSettingsDto) =>
    apiClient.put<{ settings: BlogSettings }>('/blog/settings', data),
  uploadMedia: (file: File) => {
    const formData = new FormData();
    formData.append('file', normalizeUploadFile(file));
    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    return apiClient.post<{ url: string }>('/blog/upload', formData);
  },
};
