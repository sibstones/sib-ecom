import { apiClient } from './client';

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  alt?: string;
  order: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price?: number;
  size?: string;
  showOnProduct?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  isMain?: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export type ProductType = 'CLOTHING' | 'SHOES' | 'CUSTOM' | 'VOLUME' | 'WEIGHT';

export interface ProductColor {
  name: string;
  hex: string;
}

export interface ProductSizes {
  CLOTHING?: string[];
  SHOES?: string[];
  CUSTOM?: Array<{ value: string; label: string }>;
  VOLUME?: string[]; // ml
  WEIGHT?: string[]; // g
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sku: string;
  price?: number | string; // Optional for price on request
  compareAtPrice?: number | string;
  priceOnRequest?: boolean;
  categoryId: string;
  brandId?: string;
  isActive: boolean;
  isFeatured: boolean;
  productTypes?: ProductType[]; // Array of product types - can be combined
  sizes?: ProductSizes; // Object with sizes per type
  /**
   * Normalized by backend controller: `color` (DB JSON) -> `colors` (array).
   * Use `colors` in frontend code.
   */
  colors?: ProductColor[];
  material?: string; // Composition / Material
  lining?: string; // Lining / Lining
  application?: string; // Application / Application
  countryOfOrigin?: string;
  hideColor?: boolean;
  hideMaterial?: boolean;
  hideLining?: boolean;
  hideCountryOfOrigin?: boolean;
  relatedProducts?: string[]; // Array of product IDs for "Complete the look"
  showCompleteTheLook?: boolean; // Show/hide "Complete the Look" section on product page
  // SEO fields - not visible on product page but used for search engines
  metaTitle?: string; // SEO title for search engines
  metaDescription?: string; // SEO description for search engines
  metaKeywords?: string; // SEO keywords for search engines
  createdAt: string;
  updatedAt: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  category?: Category;
  brand?: Brand;
  isComingSoon?: boolean;
  comingSoonSizes?: string[];
  // Optional: shipping weight per unit (kg) — shown in details if present
  weightNet?: number;
  weightGross?: number;
}

export interface ProductFilters {
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  search?: string;
  color?: string;
  material?: string;
  countryOfOrigin?: string;
  /** INTERNATIONAL clothing size (XS, S, M, …) */
  size?: string;
  inventoryStatus?: 'IN_SALE' | 'COMING_SOON' | 'OUT_OF_STOCK';
}

export interface ProductSort {
  field: 'price' | 'createdAt' | 'name';
  order: 'asc' | 'desc';
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CatalogAttributeSuggestions {
  colors: ProductColor[];
  countries: string[];
}

type ProductFetchOptions = {
  cache?: RequestCache;
};

export const productApi = {
  getAll: (
    page: number = 1,
    limit: number = 20,
    filters?: ProductFilters,
    sort?: ProductSort,
    options?: { imagesLimit?: number }
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.brandId) params.append('brandId', filters.brandId);
    if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
    if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters?.isFeatured !== undefined)
      params.append('isFeatured', filters.isFeatured.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.color) params.append('color', filters.color);
    if (filters?.material) params.append('material', filters.material);
    if (filters?.countryOfOrigin) params.append('countryOfOrigin', filters.countryOfOrigin);
    if (filters?.size) params.append('size', filters.size);
    if (filters?.inventoryStatus) params.append('inventoryStatus', filters.inventoryStatus);

    if (sort) {
      params.append('sortBy', sort.field);
      params.append('sortOrder', sort.order);
    }

    // Request 2 images per product for shop card hover (second image on hover)
    const imagesLimit = options?.imagesLimit ?? 2;
    params.set('imagesLimit', String(imagesLimit));

    return apiClient.get<ProductsResponse>(`/products?${params.toString()}`, { cache: 'no-store' });
  },
  getById: (id: string, languageCode?: string, options?: ProductFetchOptions) => {
    const params = languageCode ? `?languageCode=${languageCode}` : '';
    return apiClient.get<{ product: Product }>(`/products/${id}${params}`, options);
  },
  getBySlug: (slug: string, languageCode?: string) => {
    const params = languageCode ? `?languageCode=${languageCode}` : '';
    return apiClient.get<{ product: Product }>(`/products/slug/${slug}${params}`);
  },
  getSimilar: (productId: string, limit: number = 8) => {
    return apiClient.get<{ products: Product[] }>(`/products/similar/${productId}?limit=${limit}`, {
      cache: 'no-store',
    });
  },
  getCategories: () => apiClient.get<{ categories: Category[] }>('/categories'),
  getBrands: () => apiClient.get<{ brands: Brand[] }>('/brands'),
  getCatalogAttributes: () =>
    apiClient.get<CatalogAttributeSuggestions>('/products/catalog-attributes', {
      cache: 'no-store',
    }),
  searchProducts: (query: string, limit?: number, excludeId?: string) => {
    const params = new URLSearchParams({
      q: query,
      limit: (limit || 20).toString(),
    });
    if (excludeId) params.append('excludeId', excludeId);
    return apiClient.get<{ products: Product[] }>(`/products/search?${params.toString()}`);
  },
  getAvailableStock: (productId: string, size?: string | null) => {
    const params = new URLSearchParams();
    if (size) params.append('size', size);
    return apiClient.get<{ availableStock: number }>(
      `/products/${productId}/stock?${params.toString()}`
    );
  },
};
