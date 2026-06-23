export type ProductType = 'CLOTHING' | 'SHOES' | 'CUSTOM' | 'VOLUME' | 'WEIGHT';

export interface ProductSizes {
  CLOTHING?: string[];
  SHOES?: string[];
  CUSTOM?: Array<{ value: string; label: string }>;
  VOLUME?: string[];
  WEIGHT?: string[];
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
  /** INTERNATIONAL clothing size (XS, S, M, …) — filters products.sizes.CLOTHING and variant size */
  size?: string;
  /** Storefront availability filter (IN_SALE, COMING_SOON, OUT_OF_STOCK) */
  inventoryStatus?: 'IN_SALE' | 'COMING_SOON' | 'OUT_OF_STOCK';
  productType?: ProductType | ProductType[]; // Can filter by single type or multiple types
  skipInventoryCheck?: boolean; // Skip inventory status check (for admin panel)
  dateFrom?: string; // ISO date for createdAt filter
  dateTo?: string; // ISO date for createdAt filter
}

export interface ProductSort {
  field: 'price' | 'createdAt' | 'name' | 'onSale';
  order: 'asc' | 'desc';
}

export interface ProductColor {
  name: string;
  hex: string;
}

export interface CreateProductDto {
  name: string;
  slug?: string;
  description?: string;
  sku: string;
  price?: number; // Optional for price on request
  compareAtPrice?: number;
  priceOnRequest?: boolean; // If true, price is not required
  categoryId: string;
  brandId?: string;
  isActive: boolean;
  isFeatured: boolean;
  productTypes?: ProductType[]; // Array of product types - can be combined
  sizes?: ProductSizes; // Object with sizes per type: { CLOTHING: [...], SHOES: [...], CUSTOM: [...] }
  colors?: ProductColor[]; // Array of colors with hex codes
  material?: string; // Composition
  lining?: string; // Lining 
  application?: string; // Application / (optional)
  countryOfOrigin?: string;
  hideColor?: boolean;
  hideMaterial?: boolean;
  hideLining?: boolean;
  hideCountryOfOrigin?: boolean;
  relatedProducts?: string[]; // Array of product IDs for "Complete the look" recommendations
  showCompleteTheLook?: boolean; // Show/hide "Complete the Look" section on product page
  // SEO fields - not visible on product page but used for search engines
  metaTitle?: string; // SEO title for search engines
  metaDescription?: string; // SEO description for search engines
  metaKeywords?: string; // SEO keywords for search engines
  // Admin-only: accounting & customs (Delivery by Seller reports)
  costPrice?: number;
  costCurrency?: string;
  customsCode?: string;
  vatRate?: number;
  exciseGoods?: boolean;
  importDeclarationNumber?: string;
  importDeclarationDate?: string; // ISO date
  customsValue?: number;
  customsValueCurrency?: string;
  weightNet?: number;
  weightGross?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  isComingSoon?: boolean;
  comingSoonSizes?: string[];
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface CreateProductImageDto {
  productId: string;
  url: string;
  alt?: string;
  order: number;
}

export interface CreateProductVariantDto {
  productId: string;
  name: string;
  sku: string;
  price?: number;
  size?: string;
  showOnProduct?: boolean;
  costPrice?: number;
  customsCode?: string;
  vatRate?: number;
}
