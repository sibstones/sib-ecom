import type { PageLoad } from './$types';
import type { Brand, Product, ProductFilters, ProductSort } from '$lib/api/product.api';
import type { Category } from '$lib/api/category.api';
import type { FeatureSettings } from '$lib/api/settings.api';
import {
  isInternationalClothingSize,
  normalizeInternationalSize,
  sortInternationalSizes,
} from '$lib/constants/international-sizes';

const DEFAULT_LANGUAGE = 'en';
const DEFAULT_LIMIT = 20;

type InventoryStatus = '' | 'IN_SALE' | 'COMING_SOON' | 'OUT_OF_STOCK';
type SortField = 'price' | 'createdAt' | 'name';
type SortOrder = 'asc' | 'desc';

function isInventoryStatus(value: string | null): value is Exclude<InventoryStatus, ''> {
  return value === 'IN_SALE' || value === 'COMING_SOON' || value === 'OUT_OF_STOCK';
}

function parseShopDefaultSort(value: string | null | undefined): ProductSort {
  switch (value) {
    case 'price_asc':
      return { field: 'price', order: 'asc' };
    case 'price_desc':
      return { field: 'price', order: 'desc' };
    case 'name_asc':
      return { field: 'name', order: 'asc' };
    case 'createdAt_desc':
    default:
      return { field: 'createdAt', order: 'desc' };
  }
}

function parseShopDefaultInventoryStatus(value: string | null | undefined): InventoryStatus {
  const normalizedValue = value ?? null;
  return isInventoryStatus(normalizedValue) ? normalizedValue : '';
}

function normalizeProducts(products: Product[]): Product[] {
  return (products ?? []).map((product) => ({
    ...product,
    images: Array.isArray(product.images) ? [...product.images] : [],
  }));
}

function getShopCategories(categories: Category[]): Category[] {
  return categories.filter((category) => {
    const slugLower = category.slug?.toLowerCase() || '';
    const nameLower = category.name?.toLowerCase() || '';
    return slugLower !== 'lookbook' && nameLower !== 'lookbook';
  });
}

function getMainCategories(categories: Category[]): Category[] {
  return getShopCategories(categories)
    .filter((category) => {
      if (category.isMain === true) return true;
      if (category.isMain === false) return false;
      return !category.parentId;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function findCategoryByParam(categoryParam: string, categories: Category[]): Category | null {
  if (!categoryParam) return null;

  return (
    categories.find((category) => category.slug === categoryParam) ||
    categories.find((category) => category.name.toLowerCase() === categoryParam.toLowerCase()) ||
    categories.find((category) => category.id === categoryParam) ||
    categories.find((category) => category.slug?.toLowerCase() === categoryParam.toLowerCase()) ||
    null
  );
}

function updateSubCategories(mainCategoryId: string, categories: Category[]): Category[] {
  if (!mainCategoryId) return [];

  return categories
    .filter((category) => category.parentId === mainCategoryId && !category.isMain)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function resolveCategorySelection(categoryParam: string, categories: Category[]) {
  const category = findCategoryByParam(categoryParam, categories);

  if (!category) {
    return {
      selectedCategory: '',
      selectedMainCategory: null as Category | null,
      selectedSubCategory: null as Category | null,
      subCategories: [] as Category[],
    };
  }

  let selectedMainCategory: Category | null = null;
  let selectedSubCategory: Category | null = null;
  let subCategories: Category[] = [];

  if (category.isMain || !category.parentId) {
    selectedMainCategory = category;
    subCategories = updateSubCategories(category.id, categories);
  } else {
    const parent = category.parent || categories.find((item) => item.id === category.parentId);
    if (parent) {
      if (parent.isMain || !parent.parentId) {
        selectedMainCategory = parent;
        selectedSubCategory = category;
        subCategories = updateSubCategories(parent.id, categories);
      } else {
        selectedSubCategory = parent;
        selectedMainCategory =
          parent.parent || categories.find((item) => item.id === parent.parentId) || null;
        if (selectedMainCategory) {
          subCategories = updateSubCategories(selectedMainCategory.id, categories);
        }
      }
    }
  }

  return {
    selectedCategory: category.id,
    selectedMainCategory,
    selectedSubCategory,
    subCategories,
  };
}

function extractAvailableFilters(products: Product[]) {
  const colors = new Set<string>();
  const materials = new Set<string>();
  const countries = new Set<string>();
  const sizes = new Set<string>();

  for (const product of products) {
    if (!product.hideColor && product.colors?.length) {
      for (const color of product.colors) {
        if (color?.name) colors.add(color.name);
      }
    }

    if (product.material && !product.hideMaterial) {
      materials.add(product.material);
    }

    if (product.countryOfOrigin && !product.hideCountryOfOrigin) {
      countries.add(product.countryOfOrigin);
    }

    if (product.sizes?.CLOTHING?.length) {
      for (const size of product.sizes.CLOTHING) {
        if (isInternationalClothingSize(size)) {
          sizes.add(normalizeInternationalSize(size));
        }
      }
    }
  }

  return {
    availableColors: Array.from(colors).sort(),
    availableMaterials: Array.from(materials).sort(),
    availableCountries: Array.from(countries).sort(),
    availableSizes: sortInternationalSizes(Array.from(sizes)),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const load: PageLoad = async ({ fetch, url, depends }) => {
  depends('app:shop');

  const languageCode = DEFAULT_LANGUAGE;
  const categoryParam = url.searchParams.get('category') ?? '';
  const selectedBrand = url.searchParams.get('brand') ?? '';
  const minPrice = url.searchParams.get('minPrice') ?? '';
  const maxPrice = url.searchParams.get('maxPrice') ?? '';
  const searchQuery = url.searchParams.get('search') ?? '';
  const selectedColor = url.searchParams.get('color') ?? '';
  const selectedMaterial = url.searchParams.get('material') ?? '';
  const selectedCountryOfOrigin = url.searchParams.get('country') ?? '';
  const selectedSize = url.searchParams.get('size') ?? '';
  const requestedInventoryStatus: InventoryStatus = isInventoryStatus(
    url.searchParams.get('inventoryStatus')
  )
    ? (url.searchParams.get('inventoryStatus') as InventoryStatus)
    : '';
  try {
    const [categoriesResponse, brandsResponse, settingsResponse] = await Promise.all([
      readJson<{ categories: Category[] }>(
        await fetch(
          `/api/categories?includeChildren=false&flat=true&mainOnly=false&languageCode=${languageCode}`
        )
      ),
      readJson<{ brands: Brand[] }>(await fetch('/api/brands')),
      readJson<{ settings: FeatureSettings }>(await fetch('/api/settings')),
    ]);

    const shopSettings = settingsResponse.settings;
    const defaultInventoryStatus = parseShopDefaultInventoryStatus(
      shopSettings?.shopDefaultInventoryStatus
    );
    const selectedInventoryStatus: InventoryStatus =
      requestedInventoryStatus || defaultInventoryStatus;
    const sort = parseShopDefaultSort(shopSettings?.shopDefaultSort);

    const allCategories = categoriesResponse.categories ?? [];
    const { selectedCategory, selectedMainCategory, selectedSubCategory, subCategories } =
      resolveCategorySelection(categoryParam, allCategories);

    const filters: ProductFilters = {
      isActive: true,
    };

    if (selectedCategory) {
      filters.categoryId = selectedCategory;
    } else if (selectedMainCategory) {
      filters.categoryId = selectedMainCategory.id;
    }
    if (selectedBrand) filters.brandId = selectedBrand;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (searchQuery) filters.search = searchQuery;
    if (selectedColor) filters.color = selectedColor;
    if (selectedMaterial) filters.material = selectedMaterial;
    if (selectedCountryOfOrigin) filters.countryOfOrigin = selectedCountryOfOrigin;
    if (selectedSize) filters.size = selectedSize;
    if (selectedInventoryStatus) filters.inventoryStatus = selectedInventoryStatus;

    const productParams = new URLSearchParams({
      page: '1',
      limit: String(DEFAULT_LIMIT),
      isActive: 'true',
      sortBy: sort.field,
      sortOrder: sort.order,
      imagesLimit: '10',
    });

    if (filters.categoryId) productParams.set('categoryId', filters.categoryId);
    if (filters.brandId) productParams.set('brandId', filters.brandId);
    if (filters.minPrice !== undefined) productParams.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) productParams.set('maxPrice', String(filters.maxPrice));
    if (filters.search) productParams.set('search', filters.search);
    if (filters.color) productParams.set('color', filters.color);
    if (filters.material) productParams.set('material', filters.material);
    if (filters.countryOfOrigin) {
      productParams.set('countryOfOrigin', filters.countryOfOrigin);
    }
    if (filters.size) productParams.set('size', filters.size);
    if (filters.inventoryStatus) {
      productParams.set('inventoryStatus', filters.inventoryStatus);
    }

    const productsResponse = await readJson<{
      products: Product[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(await fetch(`/api/products?${productParams.toString()}`));

    const products = normalizeProducts(productsResponse.products ?? []);
    const availableFilters = extractAvailableFilters(products);

    return {
      allCategories,
      mainCategories: getMainCategories(allCategories),
      subCategories,
      brands: brandsResponse.brands ?? [],
      products,
      pagination: productsResponse.pagination,
      availableFilters,
      initialState: {
        categoryParam,
        selectedCategory,
        selectedBrand,
        minPrice,
        maxPrice,
        searchQuery,
        selectedColor,
        selectedMaterial,
        selectedCountryOfOrigin,
        selectedSize,
        selectedInventoryStatus,
        selectedMainCategory,
        selectedSubCategory,
        sortField: sort.field as SortField,
        sortOrder: sort.order as SortOrder,
      },
      languageCode,
      error: null,
    };
  } catch (error) {
    return {
      allCategories: [] as Category[],
      mainCategories: [] as Category[],
      subCategories: [] as Category[],
      brands: [] as Brand[],
      products: [] as Product[],
      pagination: { page: 1, limit: DEFAULT_LIMIT, total: 0, totalPages: 1 },
      availableFilters: {
        availableColors: [] as string[],
        availableMaterials: [] as string[],
        availableCountries: [] as string[],
        availableSizes: [] as string[],
      },
      initialState: {
        categoryParam,
        selectedCategory: '',
        selectedBrand,
        minPrice,
        maxPrice,
        searchQuery,
        selectedColor,
        selectedMaterial,
        selectedCountryOfOrigin,
        selectedSize,
        selectedInventoryStatus: requestedInventoryStatus,
        selectedMainCategory: null as Category | null,
        selectedSubCategory: null as Category | null,
        sortField: 'createdAt' as const,
        sortOrder: 'desc' as const,
      },
      languageCode,
      error: error instanceof Error ? error.message : 'Failed to load shop',
    };
  }
};
