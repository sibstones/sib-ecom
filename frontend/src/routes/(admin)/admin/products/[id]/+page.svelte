<script lang="ts">
  /// <reference path="../../../../app.d.ts" />
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    adminApi,
    type Warehouse,
    type InventoryItem,
    type InventoryStatus,
  } from '$lib/api/admin.api';
  import {
    productApi,
    type Product,
    type Category,
    type Brand,
    type ProductImage,
    type ProductVariant,
    type ProductType,
    type ProductColor,
    type ProductSizes,
  } from '$lib/api/product.api';
  import { categoryApi } from '$lib/api/category.api';
  import { getProductImageAlt, isVideoUrl } from '$lib/utils/image.utils';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { translationApi, type ProductTranslation } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { t } from '$lib/utils/i18n';
  import {
    createCustomSizeEntry,
    getCustomSizeDisplayLabel,
    type CustomSizeEntry,
  } from '$lib/utils/size.utils';
  import {
    applyCatalogColorHex,
    findCatalogColorByName,
    findCatalogCountry,
  } from '$lib/utils/product-catalog-hints';
  import { getErrorMessage, resolveApiError } from '$lib/utils/error-handler';
  import { normalizeUploadFiles } from '$lib/utils/file-upload';
  import { notificationStore } from '$lib/stores/notification.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import SortableMediaList from '$lib/components/admin/SortableMediaList.svelte';
  import LoadingBar from '$lib/components/LoadingBar.svelte';

  let loading = false;
  let loadingProduct = true;
  let error = '';
  let product: Product | null = null;
  let mainCategories: Category[] = [];
  let allCategories: Category[] = [];
  let brands: Brand[] = [];

  let productData = {
    name: '',
    slug: '',
    description: '',
    sku: '',
    price: undefined as number | undefined,
    compareAtPrice: undefined as number | undefined,
    priceOnRequest: false,
    categoryId: '',
    brandId: undefined as string | undefined,
    isActive: true,
    isFeatured: false,
    productTypes: [] as ProductType[],
    sizes: {} as ProductSizes,
    colors: [] as ProductColor[],
    material: '',
    lining: '',
    application: '',
    countryOfOrigin: '',
    hideColor: true,
    hideMaterial: true,
    hideLining: true,
    hideCountryOfOrigin: true,
    relatedProducts: [] as string[],
    showCompleteTheLook: true,
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    // Admin-only: accounting & customs (Delivery by Seller reports)
    costPrice: undefined as number | undefined,
    costCurrency: '',
    customsCode: '',
    vatRate: undefined as number | undefined,
    exciseGoods: false,
    importDeclarationNumber: '',
    importDeclarationDate: '',
    customsValue: undefined as number | undefined,
    customsValueCurrency: '',
    weightNet: undefined as number | undefined,
    weightGross: undefined as number | undefined,
    lengthCm: undefined as number | undefined,
    widthCm: undefined as number | undefined,
    heightCm: undefined as number | undefined,
  };

  // Size management - separate for each type
  let clothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  let shoeSizes = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'];
  let volumeSizes = ['30', '50', '100', '200', '500'];
  let weightSizes = ['50', '100', '200', '500'];
  let customSizeLine = '';
  let customSizeWidthCm = '';
  let customSizeHeightCm = '';
  let selectedClothingSizes: string[] = [];
  let selectedShoeSizes: string[] = [];
  let selectedVolumeSizes: string[] = [];
  let selectedWeightSizes: string[] = [];
  let customVolumeSizes: string[] = [];
  let customWeightSizes: string[] = [];
  let customVolumeValue = '';
  let customWeightValue = '';
  let customSizes: CustomSizeEntry[] = [];

  // Color management
  let newColorName = '';
  let newColorHex = '#000000';
  let catalogColors: ProductColor[] = [];
  let catalogCountries: string[] = [];

  $: colorCatalogMatch = findCatalogColorByName(newColorName, catalogColors);
  $: countryCatalogMatch = findCatalogCountry(productData.countryOfOrigin, catalogCountries);
  $: colorAlreadyOnProduct =
    !!colorCatalogMatch &&
    productData.colors.some(
      (c) => c.name.trim().toLowerCase() === colorCatalogMatch!.name.trim().toLowerCase()
    );

  // Complete the look - related products
  let relatedProductsSearchQuery = '';
  let relatedProductsSearchResults: Product[] = [];
  let relatedProductsSearchLoading = false;
  let relatedProductsSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  let selectedRelatedProducts: Product[] = []; // Full product info for selected items

  let selectedMainCategoryId = '';
  let selectedSubcategoryId = '';
  let images: ProductImage[] = [];
  let newImages: File[] = [];
  let newImagePreviews: string[] = [];
  let isDragging = false;
  let fileInputRef: HTMLInputElement | null = null;

  let variants: ProductVariant[] = [];
  let newVariant = {
    name: '',
    sku: '',
    price: undefined as number | undefined,
    size: '',
    showOnProduct: false,
  };
  let editingVariant: { id: string; sku: string; price: number | undefined } | null = null;
  let bulkCreateMode = false;
  let bulkCreateBaseSku = '';
  let bulkCreateBasePrice: number | undefined = undefined;

  // Translations
  let languages: Language[] = [];
  let translations: ProductTranslation[] = [];
  let showTranslations = false;
  let editingTranslation: {
    languageCode: string;
    name: string;
    description: string;
    material: string;
    lining: string;
    countryOfOrigin: string;
  } | null = null;
  let selectedLanguageForTranslation = '';
  let gptTranslating = false;

  // Inventory management
  let warehouses: Warehouse[] = [];
  let productInventory: Record<string, InventoryItem[]> = {}; // warehouseId -> inventory items
  let loadingInventory = false;
  let selectedWarehouseForStock = '';
  let stockQuantities: Record<string, Record<string, number>> = {}; // variantId -> warehouseId -> quantity
  let stockStatuses: Record<string, Record<string, InventoryStatus>> = {}; // variantId -> warehouseId -> status
  let editingStock: { variantId: string; warehouseId: string } | null = null;
  let newStockQuantity = 0;
  let newStockStatus: InventoryStatus = 'OUT_OF_STOCK';
  let activeTab: 'stock' | 'analytics' = 'stock';
  type FormSectionTab =
    | 'basic'
    | 'translations'
    | 'seo'
    | 'reporting'
    | 'media'
    | 'variants'
    | 'stock';
  let formTab: FormSectionTab = 'basic';
  type ManagedSizeType = 'CLOTHING' | 'SHOES' | 'CUSTOM' | 'VOLUME' | 'WEIGHT';
  type ProductSizeEntry = {
    key: string;
    value: string;
    display: string;
    type: ManagedSizeType;
  };

  $: statusLabels = {
    AWAITING_RECEIPT: t('warehouse.awaitingReceipt'),
    RECEIVED: t('warehouse.received'),
    IN_SALE: t('warehouse.inSale'),
    COMING_SOON: t('warehouse.comingSoon'),
    RESERVED: t('warehouse.reserved'),
    IN_DELIVERY: t('warehouse.inDelivery'),
    DELIVERED: t('warehouse.delivered'),
    RETURNED: t('warehouse.returned'),
    OUT_OF_STOCK: t('warehouse.outOfStock'),
  } as Record<InventoryStatus, string>;

  $: subcategories = selectedMainCategoryId
    ? allCategories.filter((cat) => cat.parentId === selectedMainCategoryId)
    : [];

  $: subSubcategories = selectedSubcategoryId
    ? allCategories.filter((cat) => cat.parentId === selectedSubcategoryId)
    : [];

  // Check if brands feature is enabled
  let brandsEnabled = true;
  settingsStore.subscribe((settings) => {
    brandsEnabled = settings.brandsEnabled;
  });

  // Update sizes object based on selected product types (include CUSTOM whenever we have custom sizes)
  $: {
    const sizesObj: ProductSizes = {};
    if (productData.productTypes.includes('CLOTHING') && selectedClothingSizes.length > 0) {
      sizesObj.CLOTHING = selectedClothingSizes;
    }
    if (productData.productTypes.includes('SHOES') && selectedShoeSizes.length > 0) {
      sizesObj.SHOES = selectedShoeSizes;
    }
    if (customSizes.length > 0) {
      sizesObj.CUSTOM = customSizes.map((s) => ({
        value: s.value.trim(),
        label: getCustomSizeDisplayLabel(s).trim(),
      }));
    }
    if (
      productData.productTypes.includes('VOLUME') &&
      (selectedVolumeSizes.length > 0 || customVolumeSizes.length > 0)
    ) {
      sizesObj.VOLUME = [...new Set([...selectedVolumeSizes, ...customVolumeSizes])];
    }
    if (
      productData.productTypes.includes('WEIGHT') &&
      (selectedWeightSizes.length > 0 || customWeightSizes.length > 0)
    ) {
      sizesObj.WEIGHT = [...new Set([...selectedWeightSizes, ...customWeightSizes])];
    }
    productData.sizes = sizesObj;
  }

  onMount(async () => {
    // Load categories and brands first, then product
    await Promise.all([
      loadCategories(),
      loadBrands(),
      loadLanguages(),
      loadWarehouses(),
      loadCatalogAttributes(),
    ]);
    await loadProduct();
    await loadTranslations();
    await loadProductInventory();
  });

  async function loadProduct() {
    loadingProduct = true;
    try {
      const productId = $page.params.id;
      const response = await productApi.getById(productId, undefined, { cache: 'no-store' });
      const loadedProduct = response.product;
      product = loadedProduct;

      productData = {
        name: loadedProduct.name,
        slug: loadedProduct.slug,
        description: loadedProduct.description || '',
        sku: loadedProduct.sku,
        price: loadedProduct.price
          ? typeof loadedProduct.price === 'number'
            ? loadedProduct.price
            : parseFloat(String(loadedProduct.price))
          : undefined,
        compareAtPrice: loadedProduct.compareAtPrice
          ? typeof loadedProduct.compareAtPrice === 'number'
            ? loadedProduct.compareAtPrice
            : parseFloat(String(loadedProduct.compareAtPrice))
          : undefined,
        priceOnRequest: loadedProduct.priceOnRequest || false,
        categoryId: loadedProduct.categoryId,
        brandId: loadedProduct.brandId || undefined,
        isActive: loadedProduct.isActive,
        isFeatured: loadedProduct.isFeatured,
        productTypes: loadedProduct.productTypes || [],
        sizes: loadedProduct.sizes || {},
        colors: loadedProduct.colors || [],
        material: loadedProduct.material || '',
        lining: (loadedProduct as any).lining || '',
        application: (loadedProduct as any).application || '',
        countryOfOrigin: loadedProduct.countryOfOrigin || '',
        hideColor: loadedProduct.hideColor !== undefined ? loadedProduct.hideColor : true,
        relatedProducts: loadedProduct.relatedProducts || [],
        hideMaterial: loadedProduct.hideMaterial !== undefined ? loadedProduct.hideMaterial : true,
        hideLining:
          (loadedProduct as any).hideLining !== undefined
            ? (loadedProduct as any).hideLining
            : true,
        hideCountryOfOrigin:
          loadedProduct.hideCountryOfOrigin !== undefined
            ? loadedProduct.hideCountryOfOrigin
            : true,
        showCompleteTheLook:
          (loadedProduct as any).showCompleteTheLook !== undefined
            ? (loadedProduct as any).showCompleteTheLook
            : true,
        metaTitle: loadedProduct.metaTitle || '',
        metaDescription: loadedProduct.metaDescription || '',
        metaKeywords: loadedProduct.metaKeywords || '',
        costPrice:
          (loadedProduct as any).costPrice != null
            ? parseFloat(String((loadedProduct as any).costPrice))
            : undefined,
        costCurrency: (loadedProduct as any).costCurrency || '',
        customsCode: (loadedProduct as any).customsCode || '',
        vatRate:
          (loadedProduct as any).vatRate != null
            ? parseFloat(String((loadedProduct as any).vatRate))
            : undefined,
        exciseGoods: (loadedProduct as any).exciseGoods ?? false,
        importDeclarationNumber: (loadedProduct as any).importDeclarationNumber || '',
        importDeclarationDate: (loadedProduct as any).importDeclarationDate
          ? new Date((loadedProduct as any).importDeclarationDate).toISOString().split('T')[0]
          : '',
        customsValue:
          (loadedProduct as any).customsValue != null
            ? parseFloat(String((loadedProduct as any).customsValue))
            : undefined,
        customsValueCurrency: (loadedProduct as any).customsValueCurrency || '',
        weightNet:
          (loadedProduct as any).weightNet != null
            ? parseFloat(String((loadedProduct as any).weightNet))
            : undefined,
        weightGross:
          (loadedProduct as any).weightGross != null
            ? parseFloat(String((loadedProduct as any).weightGross))
            : undefined,
        lengthCm:
          (loadedProduct as any).lengthCm != null
            ? parseFloat(String((loadedProduct as any).lengthCm))
            : undefined,
        widthCm:
          (loadedProduct as any).widthCm != null
            ? parseFloat(String((loadedProduct as any).widthCm))
            : undefined,
        heightCm:
          (loadedProduct as any).heightCm != null
            ? parseFloat(String((loadedProduct as any).heightCm))
            : undefined,
      };

      // Load sizes into appropriate arrays based on new structure
      if (product.sizes && typeof product.sizes === 'object' && !Array.isArray(product.sizes)) {
        // New format: { CLOTHING: [...], SHOES: [...], CUSTOM: [...], VOLUME: [...], WEIGHT: [...] }
        if (product.sizes.CLOTHING) {
          selectedClothingSizes = product.sizes.CLOTHING;
        }
        if (product.sizes.SHOES) {
          selectedShoeSizes = product.sizes.SHOES;
        }
        if (product.sizes.CUSTOM && Array.isArray(product.sizes.CUSTOM)) {
          customSizes = (product.sizes.CUSTOM as Array<CustomSizeEntry | string>)
            .map((item): CustomSizeEntry => {
              if (typeof item === 'object' && item !== null && 'value' in item) {
                const value = String(item.value ?? '').trim();
                const label = String(item.label ?? item.value ?? '').trim();
                const widthCm = item.widthCm != null ? Number(item.widthCm) : undefined;
                const heightCm = item.heightCm != null ? Number(item.heightCm) : undefined;
                return {
                  value,
                  label: getCustomSizeDisplayLabel({ value, label, widthCm, heightCm }),
                  ...(widthCm != null && !Number.isNaN(widthCm) ? { widthCm } : {}),
                  ...(heightCm != null && !Number.isNaN(heightCm) ? { heightCm } : {}),
                };
              }
              const v = String(item).trim();
              return { value: v, label: v };
            })
            .filter((s) => s.value !== '');
          if (customSizes.length > 0 && !productData.productTypes.includes('CUSTOM')) {
            productData.productTypes = [...productData.productTypes, 'CUSTOM'];
          }
        }
        if (product.sizes.VOLUME) {
          const vol = product.sizes.VOLUME as string[];
          selectedVolumeSizes = vol.filter((v) => volumeSizes.includes(v));
          customVolumeSizes = vol.filter((v) => !volumeSizes.includes(v));
        }
        if (product.sizes.WEIGHT) {
          const w = product.sizes.WEIGHT as string[];
          selectedWeightSizes = w.filter((v) => weightSizes.includes(v));
          customWeightSizes = w.filter((v) => !weightSizes.includes(v));
        }
      } else if (product.sizes && Array.isArray(product.sizes)) {
        // Legacy format: convert based on productTypes
        if (product.productTypes && product.productTypes.length > 0) {
          const firstType = product.productTypes[0];
          if (
            firstType === 'CUSTOM' &&
            product.sizes.length > 0 &&
            typeof product.sizes[0] === 'object'
          ) {
            customSizes = product.sizes as Array<{ value: string; label: string }>;
          } else if (firstType === 'CLOTHING') {
            selectedClothingSizes = product.sizes as string[];
          } else if (firstType === 'SHOES') {
            selectedShoeSizes = product.sizes as string[];
          } else if (firstType === 'VOLUME') {
            selectedVolumeSizes = product.sizes as string[];
          } else if (firstType === 'WEIGHT') {
            selectedWeightSizes = product.sizes as string[];
          }
        }
      }

      // Load related products info
      if (product.relatedProducts && product.relatedProducts.length > 0) {
        try {
          const relatedProductsPromises = product.relatedProducts.map((id) =>
            productApi.getById(id)
          );
          const relatedProductsResponses = await Promise.all(relatedProductsPromises);
          selectedRelatedProducts = relatedProductsResponses.map((r) => r.product);
        } catch (e) {
          console.error('Failed to load related products:', e);
          selectedRelatedProducts = [];
        }
      }

      // Determine category hierarchy from current category
      const currentCategory = allCategories.find((cat) => cat.id === loadedProduct.categoryId);
      if (currentCategory) {
        if (currentCategory.isMain || !currentCategory.parentId) {
          // It's a main category
          selectedMainCategoryId = currentCategory.id;
        } else {
          // It's a subcategory or sub-subcategory, need to find the hierarchy
          const parentCategory = allCategories.find((cat) => cat.id === currentCategory.parentId);
          if (parentCategory) {
            if (parentCategory.isMain || !parentCategory.parentId) {
              // Parent is main category, so current is subcategory
              selectedMainCategoryId = parentCategory.id;
              selectedSubcategoryId = currentCategory.id;
            } else {
              // Parent is also a subcategory, so current is sub-subcategory
              const grandParentCategory = allCategories.find(
                (cat) => cat.id === parentCategory.parentId
              );
              if (grandParentCategory) {
                selectedMainCategoryId = grandParentCategory.id;
                selectedSubcategoryId = parentCategory.id;
                productData.categoryId = currentCategory.id;
              }
            }
          }
        }
      } else {
        // If not found in allCategories, try to find in main categories
        const mainCategory = mainCategories.find((cat) => cat.id === loadedProduct.categoryId);
        if (mainCategory) {
          selectedMainCategoryId = mainCategory.id;
        }
      }

      images = (product.images || []).sort((a, b) => (a.order || 0) - (b.order || 0));
      variants = product.variants || [];

      // Reload inventory after product is loaded
      await loadProductInventory();
    } catch (e) {
      error = getErrorMessage(e, 'product.failedToLoad');
    } finally {
      loadingProduct = false;
    }
  }

  async function loadCategories() {
    try {
      // Load all categories in flat format first
      const allResponse = await categoryApi.getAll(false, true, false);
      allCategories = allResponse.categories || [];
      console.log('All categories loaded:', allCategories.length);

      // Load main categories (Men/Women) - categories with isMain=true
      try {
        const mainResponse = await categoryApi.getAll(false, false, true);
        mainCategories = mainResponse.categories || [];
        console.log('Main categories loaded:', mainCategories.length);
      } catch (mainError) {
        console.warn('Failed to load main categories, using fallback:', mainError);
        mainCategories = [];
      }

      // If no main categories found, use top-level categories (without parentId) as main categories
      if (mainCategories.length === 0 && allCategories.length > 0) {
        mainCategories = allCategories.filter((cat) => !cat.parentId);
        console.log('Using top-level categories as main:', mainCategories.length);
      }

      // If still no categories, try loading without flat parameter
      if (mainCategories.length === 0 && allCategories.length === 0) {
        console.log('No categories found, trying alternative load...');
        const altResponse = await categoryApi.getAll(false, false, false);
        allCategories = altResponse.categories || [];
        mainCategories = allCategories.filter((cat) => !cat.parentId);
        console.log('Alternative load result:', {
          all: allCategories.length,
          main: mainCategories.length,
        });
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
      error = `Failed to load categories: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  async function loadBrands() {
    try {
      const response = await productApi.getBrands();
      brands = response.brands;
    } catch (e) {
      console.error('Failed to load brands:', e);
    }
  }

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll(true);
      languages = response.languages.sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadWarehouses() {
    try {
      const response = await adminApi.getAllWarehouses();
      warehouses = response.warehouses.filter((w) => w.isActive);
    } catch (e) {
      console.error('Failed to load warehouses:', e);
    }
  }

  async function loadProductInventory() {
    if (!product) return;
    const currentProduct = product;
    loadingInventory = true;
    try {
      const inventoryByWarehouse: Record<string, InventoryItem[]> = {};

      // Load inventory for each warehouse
      for (const warehouse of warehouses) {
        try {
          const response = await adminApi.getWarehouseInventory(warehouse.id);
          // Filter inventory for this product
          const productItems = response.inventory.filter(
            (item) => item.productId === currentProduct.id
          );
          // Always include warehouse entry, even if empty, to show 0 quantity
          inventoryByWarehouse[warehouse.id] = productItems;
        } catch (e) {
          console.error(`Failed to load inventory for warehouse ${warehouse.id}:`, e);
          // Set empty array if error occurs
          inventoryByWarehouse[warehouse.id] = [];
        }
      }

      // Force reactive update by creating a new object
      productInventory = { ...inventoryByWarehouse };

      // Initialize stock quantities and statuses
      for (const variant of variants) {
        if (!stockQuantities[variant.id]) {
          stockQuantities[variant.id] = {};
        }
        if (!stockStatuses[variant.id]) {
          stockStatuses[variant.id] = {};
        }
        for (const warehouse of warehouses) {
          const item = productInventory[warehouse.id]?.find((inv) => inv.variantId === variant.id);
          if (item) {
            stockQuantities[variant.id][warehouse.id] = item.quantity;
            stockStatuses[variant.id][warehouse.id] = item.status;
          } else {
            stockQuantities[variant.id][warehouse.id] = 0;
            stockStatuses[variant.id][warehouse.id] = 'OUT_OF_STOCK';
          }
        }
      }

      // Also handle product without variants
      if (variants.length === 0) {
        const tempVariantId = 'no-variant';
        if (!stockQuantities[tempVariantId]) {
          stockQuantities[tempVariantId] = {};
        }
        if (!stockStatuses[tempVariantId]) {
          stockStatuses[tempVariantId] = {};
        }
        for (const warehouse of warehouses) {
          const item = productInventory[warehouse.id]?.find((inv) => !inv.variantId);
          if (item) {
            stockQuantities[tempVariantId][warehouse.id] = item.quantity;
            stockStatuses[tempVariantId][warehouse.id] = item.status;
          } else {
            stockQuantities[tempVariantId][warehouse.id] = 0;
            stockStatuses[tempVariantId][warehouse.id] = 'OUT_OF_STOCK';
          }
        }
      }

      // Force reactive update of stockQuantities and stockStatuses
      stockQuantities = { ...stockQuantities };
      stockStatuses = { ...stockStatuses };
    } catch (e) {
      console.error('Failed to load product inventory:', e);
    } finally {
      loadingInventory = false;
    }
  }

  async function addOrUpdateStock(variantId: string | null, warehouseId: string) {
    if (!product) return;

    // Always use values from the form
    let quantity = newStockQuantity;
    let status = newStockStatus;

    if (quantity < 0) {
      notificationStore.error(t('product.quantityCannotBeNegative'));
      return;
    }

    // If quantity is 0, automatically set status to OUT_OF_STOCK unless explicitly set
    if (quantity === 0 && !status) {
      status = 'OUT_OF_STOCK';
    } else if (quantity === 0) {
      // If quantity is 0, use provided status or default to OUT_OF_STOCK
      status = status || 'OUT_OF_STOCK';
    }

    try {
      // Check if inventory already exists
      const existingItem = productInventory[warehouseId]?.find(
        (inv) => inv.variantId === (variantId || undefined)
      );

      if (existingItem) {
        // Update existing inventory - use new API to set quantity directly
        // Backend will automatically set OUT_OF_STOCK if quantity is 0 and status not provided
        const updated = await adminApi.updateInventoryQuantity(existingItem.id, quantity, status);

        // Immediately update local state for reactive UI update
        if (productInventory[warehouseId]) {
          const itemIndex = productInventory[warehouseId].findIndex(
            (inv) => inv.id === existingItem.id
          );
          if (itemIndex !== -1) {
            // Update the item with new data
            productInventory[warehouseId] = [
              ...productInventory[warehouseId].slice(0, itemIndex),
              updated.inventory,
              ...productInventory[warehouseId].slice(itemIndex + 1),
            ];
          }
        } else {
          // If warehouse entry doesn't exist, create it
          productInventory[warehouseId] = [updated.inventory];
        }

        // Force reactive update by creating completely new object structure
        const newProductInventory: Record<string, InventoryItem[]> = {};
        for (const [whId, items] of Object.entries(productInventory)) {
          newProductInventory[whId] = [...items];
        }
        productInventory = newProductInventory;

        // Also update stockQuantities and stockStatuses
        const key = variantId || 'no-variant';
        if (!stockQuantities[key]) {
          stockQuantities[key] = {};
        }
        if (!stockStatuses[key]) {
          stockStatuses[key] = {};
        }
        const newStockQuantities = { ...stockQuantities };
        const newStockStatuses = { ...stockStatuses };
        newStockQuantities[key] = {
          ...newStockQuantities[key],
          [warehouseId]: updated.inventory.quantity,
        };
        newStockStatuses[key] = {
          ...newStockStatuses[key],
          [warehouseId]: updated.inventory.status,
        };

        // Force reactive update
        stockQuantities = newStockQuantities;
        stockStatuses = newStockStatuses;
      } else {
        // Create new inventory (quantity can be 0)
        // Backend will automatically set OUT_OF_STOCK if quantity is 0 and status not provided
        // Note: addInventory adds to existing quantity if inventory already exists in DB
        // So we need to check if the returned quantity matches what we sent
        const created = await adminApi.addInventory(warehouseId, {
          productId: product.id,
          variantId: variantId || undefined,
          quantity: quantity,
          reason: 'Initial stock from product page',
          status: status,
        });

        // If inventory already existed in DB, addInventory would have added to it
        // In that case, we need to update it to set the exact quantity
        if (created.inventory.quantity !== quantity) {
          // Inventory already existed, update it to set exact quantity
          const updated = await adminApi.updateInventoryQuantity(
            created.inventory.id,
            quantity,
            status
          );
          created.inventory = updated.inventory;
        }

        // Add to local state
        if (!productInventory[warehouseId]) {
          productInventory[warehouseId] = [];
        }
        productInventory[warehouseId] = [...productInventory[warehouseId], created.inventory];

        // Force reactive update by creating completely new object structure
        const newProductInventory: Record<string, InventoryItem[]> = {};
        for (const [whId, items] of Object.entries(productInventory)) {
          newProductInventory[whId] = [...items];
        }
        productInventory = newProductInventory;

        // Also update stockQuantities and stockStatuses
        const key = variantId || 'no-variant';
        if (!stockQuantities[key]) {
          stockQuantities[key] = {};
        }
        if (!stockStatuses[key]) {
          stockStatuses[key] = {};
        }
        const newStockQuantities = { ...stockQuantities };
        const newStockStatuses = { ...stockStatuses };
        newStockQuantities[key] = {
          ...newStockQuantities[key],
          [warehouseId]: created.inventory.quantity,
        };
        newStockStatuses[key] = {
          ...newStockStatuses[key],
          [warehouseId]: created.inventory.status,
        };

        // Force reactive update
        stockQuantities = newStockQuantities;
        stockStatuses = newStockStatuses;
      }

      editingStock = null;
      notificationStore.success(
        'Stock updated successfully. Please refresh the warehouse page to see updated quantities.'
      );

      // Reload inventory after a short delay to ensure consistency with database
      // This ensures UI is updated immediately, then syncs with server
      setTimeout(async () => {
        await loadProductInventory();
      }, 500);
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'product.failedToUpdateStock'));
    }
  }

  function startEditingStock(variantId: string | null, warehouseId: string) {
    const key = variantId || 'no-variant';
    editingStock = { variantId: key, warehouseId };

    // Get current values from inventory or defaults
    const inventoryItem = productInventory[warehouseId]?.find((inv) =>
      variantId ? inv.variantId === variantId : !inv.variantId
    );

    if (inventoryItem) {
      newStockQuantity = inventoryItem.quantity;
      newStockStatus = inventoryItem.status;
    } else {
      // If no inventory exists, check if we have stored values
      const storedQty = stockQuantities[key]?.[warehouseId];
      const storedStatus = stockStatuses[key]?.[warehouseId];
      newStockQuantity = storedQty || 0;
      // If quantity is 0, default to OUT_OF_STOCK, otherwise AWAITING_RECEIPT
      newStockStatus =
        storedStatus || (newStockQuantity === 0 ? 'OUT_OF_STOCK' : 'AWAITING_RECEIPT');
    }
  }

  function cancelEditingStock() {
    editingStock = null;
    newStockQuantity = 0;
    newStockStatus = 'OUT_OF_STOCK';
  }

  function getProductSizeEntries(sizes?: ProductSizes | null): ProductSizeEntry[] {
    if (!sizes) return [];

    const entries: ProductSizeEntry[] = [];

    if (sizes.CLOTHING) {
      entries.push(
        ...sizes.CLOTHING.map((size) => ({
          key: `CLOTHING-${size}`,
          value: size,
          display: size,
          type: 'CLOTHING' as const,
        }))
      );
    }

    if (sizes.SHOES) {
      entries.push(
        ...sizes.SHOES.map((size) => ({
          key: `SHOES-${size}`,
          value: size,
          display: size,
          type: 'SHOES' as const,
        }))
      );
    }

    if (sizes.CUSTOM) {
      entries.push(
        ...sizes.CUSTOM.map((size) => ({
          key: `CUSTOM-${size.value}`,
          value: size.value,
          display: getCustomSizeDisplayLabel(size),
          type: 'CUSTOM' as const,
        }))
      );
    }

    if (sizes.VOLUME) {
      entries.push(
        ...sizes.VOLUME.map((size) => ({
          key: `VOLUME-${size}`,
          value: size,
          display: `${size} ml`,
          type: 'VOLUME' as const,
        }))
      );
    }

    if (sizes.WEIGHT) {
      entries.push(
        ...sizes.WEIGHT.map((size) => ({
          key: `WEIGHT-${size}`,
          value: size,
          display: `${size} g`,
          type: 'WEIGHT' as const,
        }))
      );
    }

    return entries;
  }

  function hasProductSizes(sizes?: ProductSizes | null): boolean {
    return getProductSizeEntries(sizes).length > 0;
  }

  function getSizeTypeLabel(type: ManagedSizeType): string {
    switch (type) {
      case 'CLOTHING':
        return 'Clothing';
      case 'SHOES':
        return 'Shoes';
      case 'CUSTOM':
        return 'Custom';
      case 'VOLUME':
        return 'Volume';
      case 'WEIGHT':
        return 'Weight';
    }
  }

  function findInventoryForSize(
    warehouseId: string,
    entry: ProductSizeEntry
  ): InventoryItem | undefined {
    return productInventory[warehouseId]?.find((inv) => {
      if (!inv.variant) return false;
      if (inv.variant.size === entry.value) return true;

      const variantName = inv.variant.name?.toLowerCase() || '';
      const rawValue = entry.value.toLowerCase();
      const displayValue = entry.display.toLowerCase();

      return (
        variantName.includes(`size: ${displayValue}`) ||
        variantName.includes(`size: ${rawValue}`) ||
        variantName.includes(displayValue) ||
        variantName.includes(rawValue)
      );
    });
  }

  function startEditingStockForSize(size: string, type: ManagedSizeType, warehouseId: string) {
    const sizeKey = `${type}-${size}`;
    editingStock = { variantId: sizeKey, warehouseId };

    // Try to find existing variant or inventory for this size
    const inventoryItem = productInventory[warehouseId]?.find((inv) => {
      if (!inv.variant) return false;
      const variantName = inv.variant.name.toLowerCase();
      const sizeLower = size.toLowerCase();
      return variantName.includes(sizeLower) || variantName.includes(`size: ${sizeLower}`);
    });

    if (inventoryItem) {
      newStockQuantity = inventoryItem.quantity;
      newStockStatus = inventoryItem.status;
    } else {
      newStockQuantity = 0;
      newStockStatus = 'OUT_OF_STOCK';
    }
  }

  async function addOrUpdateStockForSize(
    size: string,
    type: ManagedSizeType,
    warehouseId: string,
    sizeLabel?: string
  ) {
    if (!product) return;

    // Always use values from the form
    let quantity = newStockQuantity;
    let status = newStockStatus;

    if (quantity < 0) {
      notificationStore.error(t('product.quantityCannotBeNegative'));
      return;
    }

    // If quantity is 0, automatically set status to OUT_OF_STOCK unless explicitly set
    if (quantity === 0 && !status) {
      status = 'OUT_OF_STOCK';
    } else if (quantity === 0) {
      // If quantity is 0, use provided status or default to OUT_OF_STOCK
      status = status || 'OUT_OF_STOCK';
    }

    try {
      // Try to find existing variant for this size
      let variantId: string | undefined = undefined;
      const sizeDisplay = sizeLabel || size;
      const variantName = `Size: ${sizeDisplay}`;

      // Check if variant exists
      const existingVariant = variants.find(
        (v) =>
          v.name.toLowerCase().includes(size.toLowerCase()) ||
          v.name.toLowerCase().includes(`size: ${size.toLowerCase()}`)
      );

      if (existingVariant) {
        variantId = existingVariant.id;
      } else {
        // Create variant if it doesn't exist
        try {
          const variantResponse = await adminApi.addProductVariant({
            productId: product.id,
            name: variantName,
            sku: `${product.sku}-${size}`,
            price: undefined,
            size: size,
            showOnProduct: false, // Hidden by default
          });
          variantId = variantResponse.variant.id;
          // Reload variants and inventory to ensure we have latest data
          await loadProduct();
          await loadProductInventory();
        } catch (e) {
          console.error('Failed to create variant:', e);
          notificationStore.error(t('product.failedToCreateVariantManual'));
          return;
        }
      }

      // Check if inventory already exists - reload inventory first to ensure we have latest data
      await loadProductInventory();
      const existingItem = productInventory[warehouseId]?.find(
        (inv) => inv.variantId === variantId
      );

      if (existingItem) {
        // Update existing inventory - use API to set quantity directly
        // Backend will automatically set OUT_OF_STOCK if quantity is 0 and status not provided
        const updated = await adminApi.updateInventoryQuantity(existingItem.id, quantity, status);

        // Immediately update local state for reactive UI update
        if (productInventory[warehouseId]) {
          const itemIndex = productInventory[warehouseId].findIndex(
            (inv) => inv.id === existingItem.id
          );
          if (itemIndex !== -1) {
            // Update the item with new data
            productInventory[warehouseId] = [
              ...productInventory[warehouseId].slice(0, itemIndex),
              updated.inventory,
              ...productInventory[warehouseId].slice(itemIndex + 1),
            ];
          }
        } else {
          // If warehouse entry doesn't exist, create it
          productInventory[warehouseId] = [updated.inventory];
        }

        // Force reactive update by creating completely new object structure
        const newProductInventory: Record<string, InventoryItem[]> = {};
        for (const [whId, items] of Object.entries(productInventory)) {
          newProductInventory[whId] = [...items];
        }
        productInventory = newProductInventory;

        // Also update stockQuantities and stockStatuses
        const sizeKey = `${type}-${size}`;
        if (!stockQuantities[sizeKey]) {
          stockQuantities[sizeKey] = {};
        }
        if (!stockStatuses[sizeKey]) {
          stockStatuses[sizeKey] = {};
        }
        const newStockQuantities = { ...stockQuantities };
        const newStockStatuses = { ...stockStatuses };
        newStockQuantities[sizeKey] = {
          ...newStockQuantities[sizeKey],
          [warehouseId]: updated.inventory.quantity,
        };
        newStockStatuses[sizeKey] = {
          ...newStockStatuses[sizeKey],
          [warehouseId]: updated.inventory.status,
        };

        // Force reactive update
        stockQuantities = newStockQuantities;
        stockStatuses = newStockStatuses;
      } else {
        // Create new inventory (quantity can be 0)
        // Backend will automatically set OUT_OF_STOCK if quantity is 0 and status not provided
        // Note: addInventory adds to existing quantity if inventory already exists in DB
        // So we need to check if the returned quantity matches what we sent
        const created = await adminApi.addInventory(warehouseId, {
          productId: product.id,
          variantId: variantId,
          quantity: quantity,
          reason: `Initial stock for size ${sizeDisplay} from product page`,
          status: status,
        });

        // If inventory already existed in DB, addInventory would have added to it
        // In that case, we need to update it to set the exact quantity
        if (created.inventory.quantity !== quantity) {
          // Inventory already existed, update it to set exact quantity
          const updated = await adminApi.updateInventoryQuantity(
            created.inventory.id,
            quantity,
            status
          );
          created.inventory = updated.inventory;
        }

        // Add to local state
        if (!productInventory[warehouseId]) {
          productInventory[warehouseId] = [];
        }
        productInventory[warehouseId] = [...productInventory[warehouseId], created.inventory];

        // Force reactive update by creating completely new object structure
        const newProductInventory: Record<string, InventoryItem[]> = {};
        for (const [whId, items] of Object.entries(productInventory)) {
          newProductInventory[whId] = [...items];
        }
        productInventory = newProductInventory;

        // Also update stockQuantities and stockStatuses
        const sizeKey = `${type}-${size}`;
        if (!stockQuantities[sizeKey]) {
          stockQuantities[sizeKey] = {};
        }
        if (!stockStatuses[sizeKey]) {
          stockStatuses[sizeKey] = {};
        }
        const newStockQuantities = { ...stockQuantities };
        const newStockStatuses = { ...stockStatuses };
        newStockQuantities[sizeKey] = {
          ...newStockQuantities[sizeKey],
          [warehouseId]: created.inventory.quantity,
        };
        newStockStatuses[sizeKey] = {
          ...newStockStatuses[sizeKey],
          [warehouseId]: created.inventory.status,
        };

        // Force reactive update
        stockQuantities = newStockQuantities;
        stockStatuses = newStockStatuses;
      }

      editingStock = null;
      notificationStore.success(
        'Stock updated successfully. Please refresh the warehouse page to see updated quantities.'
      );

      // Reload inventory after a short delay to ensure consistency with database
      // This ensures UI is updated immediately, then syncs with server
      setTimeout(async () => {
        await loadProductInventory();
      }, 500);
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'product.failedToUpdateStock'));
    }
  }

  async function loadTranslations() {
    if (!product) return;
    try {
      const response = await translationApi.getProductTranslations(product.id);
      translations = response.translations;
    } catch (e) {
      console.error('Failed to load translations:', e);
    }
  }

  function openTranslationEditor(languageCode: string) {
    const existing = translations.find((t) => t.languageCode === languageCode);
    editingTranslation = {
      languageCode,
      name: existing?.name || '',
      description: existing?.description || '',
      material: existing?.material || '',
      lining: existing?.lining || '',
      countryOfOrigin: existing?.countryOfOrigin || '',
    };
  }

  function closeTranslationEditor() {
    editingTranslation = null;
  }

  async function saveTranslation() {
    if (!product) return;
    if (!editingTranslation) return;
    try {
      await translationApi.upsertProductTranslation(product.id, {
        languageCode: editingTranslation.languageCode,
        name: editingTranslation.name || undefined,
        description: editingTranslation.description || undefined,
        material: editingTranslation.material || undefined,
        lining: editingTranslation.lining || undefined,
        countryOfOrigin: editingTranslation.countryOfOrigin || undefined,
      });
      await loadTranslations();
      closeTranslationEditor();
      notificationStore.success(t('notification.translationSaved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('notification.errorOccurred'));
    }
  }

  async function deleteTranslation(languageCode: string) {
    if (!product) return;
    const confirmed = await dialogStore.confirm(t('alert.confirmDelete'), t('common.confirm'));
    if (!confirmed) return;

    try {
      await translationApi.deleteProductTranslation(product.id, languageCode);
      await loadTranslations();
      notificationStore.success(t('notification.translationDeleted'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('notification.errorOccurred'));
    }
  }

  async function translateWithGPT() {
    if (!product || !editingTranslation) return;

    gptTranslating = true;
    try {
      const sourceLanguage = 'en'; // Default source language
      const targetLanguage = editingTranslation.languageCode;

      // Get source language name
      const sourceLang = languages.find((l) => l.code === sourceLanguage);
      const targetLang = languages.find((l) => l.code === targetLanguage);

      if (!targetLang) {
        notificationStore.error(t('notification.targetLanguageNotFound'));
        return;
      }

      // Translate name
      if (productData.name) {
        try {
          const nameTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: productData.name,
          });
          editingTranslation.name = nameTranslation.translation;
        } catch (e) {
          console.error('Failed to translate name:', e);
        }
      }

      // Translate description
      if (productData.description) {
        try {
          const descTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: productData.description,
          });
          editingTranslation.description = descTranslation.translation;
        } catch (e) {
          console.error('Failed to translate description:', e);
        }
      }

      // Translate material
      if (productData.material) {
        try {
          const materialTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: productData.material,
          });
          editingTranslation.material = materialTranslation.translation;
        } catch (e) {
          console.error('Failed to translate material:', e);
        }
      }

      // Translate lining
      if (productData.lining) {
        try {
          const liningTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: productData.lining,
          });
          editingTranslation.lining = liningTranslation.translation;
        } catch (e) {
          console.error('Failed to translate lining:', e);
        }
      }

      // Translate country of origin
      if (productData.countryOfOrigin) {
        try {
          const countryTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: productData.countryOfOrigin,
          });
          editingTranslation.countryOfOrigin = countryTranslation.translation;
        } catch (e) {
          console.error('Failed to translate country of origin:', e);
        }
      }

      notificationStore.success(
        `Translation generated for ${targetLang.nameNative || targetLang.name}`
      );
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'error.failedToGenerateTranslation'));
    } finally {
      gptTranslating = false;
    }
  }

  function handleImageSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      const newFiles = Array.from(target.files);
      processFiles(newFiles);
    }
  }

  function processFiles(files: File[]) {
    const validFiles = normalizeUploadFiles(
      files.filter((file) => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        return isImage || isVideo;
      })
    );

    newImages = [...newImages, ...validFiles];

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newImagePreviews = [...newImagePreviews, e.target.result as string];
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;

    if (event.dataTransfer?.files) {
      const files = Array.from(event.dataTransfer.files);
      processFiles(files);
    }
  }

  function openFileDialog() {
    if (fileInputRef) {
      fileInputRef.click();
    }
  }

  function removeNewImage(index: number) {
    newImages = newImages.filter((_, i) => i !== index);
    newImagePreviews = newImagePreviews.filter((_, i) => i !== index);
  }

  function toggleClothingSize(size: string) {
    if (selectedClothingSizes.includes(size)) {
      selectedClothingSizes = selectedClothingSizes.filter((s) => s !== size);
    } else {
      selectedClothingSizes = [...selectedClothingSizes, size];
      // Auto-fill variant size field when a size is selected
      if (!newVariant.size || newVariant.size === '') {
        newVariant.size = size;
      }
    }
  }

  function toggleShoeSize(size: string) {
    if (selectedShoeSizes.includes(size)) {
      selectedShoeSizes = selectedShoeSizes.filter((s) => s !== size);
    } else {
      selectedShoeSizes = [...selectedShoeSizes, size];
      // Auto-fill variant size field when a size is selected
      if (!newVariant.size || newVariant.size === '') {
        newVariant.size = size;
      }
    }
  }

  function toggleVolumeSize(size: string) {
    if (selectedVolumeSizes.includes(size)) {
      selectedVolumeSizes = selectedVolumeSizes.filter((s) => s !== size);
    } else {
      selectedVolumeSizes = [...selectedVolumeSizes, size];
    }
  }

  function toggleWeightSize(size: string) {
    if (selectedWeightSizes.includes(size)) {
      selectedWeightSizes = selectedWeightSizes.filter((s) => s !== size);
    } else {
      selectedWeightSizes = [...selectedWeightSizes, size];
    }
  }

  function addCustomVolume() {
    const val = customVolumeValue.trim().replace(/\s/g, '');
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      const v = String(Number(val));
      if (!selectedVolumeSizes.includes(v) && !customVolumeSizes.includes(v)) {
        customVolumeSizes = [...customVolumeSizes, v];
        customVolumeValue = '';
      }
    }
  }

  function removeCustomVolume(index: number) {
    customVolumeSizes = customVolumeSizes.filter((_, i) => i !== index);
  }

  function addCustomWeight() {
    const val = customWeightValue.trim().replace(/\s/g, '');
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      const v = String(Number(val));
      if (!selectedWeightSizes.includes(v) && !customWeightSizes.includes(v)) {
        customWeightSizes = [...customWeightSizes, v];
        customWeightValue = '';
      }
    }
  }

  function removeCustomWeight(index: number) {
    customWeightSizes = customWeightSizes.filter((_, i) => i !== index);
  }

  function toggleProductType(type: ProductType) {
    if (productData.productTypes.includes(type)) {
      productData.productTypes = productData.productTypes.filter((t) => t !== type);
      // Clear sizes for removed type
      if (type === 'CLOTHING') {
        selectedClothingSizes = [];
      } else if (type === 'SHOES') {
        selectedShoeSizes = [];
      } else if (type === 'CUSTOM') {
        customSizes = [];
      } else if (type === 'VOLUME') {
        selectedVolumeSizes = [];
        customVolumeSizes = [];
      } else if (type === 'WEIGHT') {
        selectedWeightSizes = [];
        customWeightSizes = [];
      }
    } else {
      productData.productTypes = [...productData.productTypes, type];
    }
  }

  function addCustomSize() {
    const entry = createCustomSizeEntry({
      line: customSizeLine,
      widthCm: customSizeWidthCm,
      heightCm: customSizeHeightCm,
    });
    if (!entry) return;
    customSizes = [...customSizes, entry];
    customSizeLine = '';
    customSizeWidthCm = '';
    customSizeHeightCm = '';
    if (!productData.productTypes.includes('CUSTOM')) {
      productData.productTypes = [...productData.productTypes, 'CUSTOM'];
    }
  }

  function removeCustomSize(index: number) {
    customSizes = customSizes.filter((_, i) => i !== index);
  }

  // Complete the look - related products
  async function searchRelatedProducts() {
    const query = relatedProductsSearchQuery?.trim() || '';
    console.log('searchRelatedProducts called with query:', query, 'length:', query.length);

    if (query.length < 2) {
      console.log('Query too short, clearing results');
      relatedProductsSearchResults = [];
      return;
    }

    relatedProductsSearchLoading = true;
    try {
      const productId = $page.params.id;
      console.log('Searching for products with query:', query, 'excluding:', productId);
      const response = await productApi.searchProducts(query, 10, productId);
      console.log('Search response received:', response);
      console.log('Search results count:', response.products?.length || 0);
      console.log('Search results:', response.products);

      if (!response || !response.products) {
        console.error('Invalid response format:', response);
        relatedProductsSearchResults = [];
        return;
      }

      // Filter out already selected products
      relatedProductsSearchResults = response.products.filter(
        (p) => !productData.relatedProducts.includes(p.id)
      );
      console.log('Filtered results count:', relatedProductsSearchResults.length);
      console.log('Filtered results:', relatedProductsSearchResults);

      if (relatedProductsSearchResults.length === 0 && response.products.length > 0) {
        console.log('All products are already selected');
      } else if (relatedProductsSearchResults.length === 0 && response.products.length === 0) {
        console.log('No products found in database for query:', query);
      }
    } catch (e) {
      console.error('Failed to search products:', e);
      console.error('Error details:', e instanceof Error ? e.message : String(e));
      console.error('Error stack:', e instanceof Error ? e.stack : 'No stack');
      relatedProductsSearchResults = [];
      error = `Failed to search products: ${e instanceof Error ? e.message : 'Unknown error'}`;
    } finally {
      relatedProductsSearchLoading = false;
    }
  }

  async function toggleRelatedProduct(productId: string) {
    console.log('Toggle related product:', productId, 'Current:', productData.relatedProducts);
    if (productData.relatedProducts.includes(productId)) {
      productData.relatedProducts = productData.relatedProducts.filter((id) => id !== productId);
      selectedRelatedProducts = selectedRelatedProducts.filter((p) => p.id !== productId);
    } else {
      productData.relatedProducts = [...productData.relatedProducts, productId];
      // Load full product info
      try {
        const productInfo = relatedProductsSearchResults.find((p) => p.id === productId);
        if (productInfo) {
          selectedRelatedProducts = [...selectedRelatedProducts, productInfo];
        } else {
          // If not in search results, fetch it
          const response = await productApi.getById(productId);
          selectedRelatedProducts = [...selectedRelatedProducts, response.product];
        }
      } catch (e) {
        console.error('Failed to load product info:', e);
      }
    }
    console.log('Updated related products:', productData.relatedProducts);
    // Clear search results when product is selected
    relatedProductsSearchResults = [];
    relatedProductsSearchQuery = '';
  }

  function removeRelatedProduct(productId: string) {
    productData.relatedProducts = productData.relatedProducts.filter((id) => id !== productId);
    selectedRelatedProducts = selectedRelatedProducts.filter((p) => p.id !== productId);
  }

  // Debounced search - trigger on input change
  $: if (relatedProductsSearchQuery !== undefined && relatedProductsSearchQuery !== null) {
    console.log('Reactive statement triggered, query:', relatedProductsSearchQuery);
    if (relatedProductsSearchTimeout) {
      clearTimeout(relatedProductsSearchTimeout);
    }
    const trimmedQuery = relatedProductsSearchQuery.trim();
    if (trimmedQuery.length >= 2) {
      console.log('Setting timeout for search, query:', trimmedQuery);
      relatedProductsSearchTimeout = setTimeout(() => {
        console.log('Timeout fired, calling searchRelatedProducts');
        searchRelatedProducts();
      }, 500);
    } else {
      console.log('Query too short, clearing results');
      relatedProductsSearchResults = [];
    }
  }

  async function loadCatalogAttributes() {
    try {
      const data = await productApi.getCatalogAttributes();
      catalogColors = data.colors ?? [];
      catalogCountries = data.countries ?? [];
    } catch (e) {
      console.warn('Failed to load catalog attributes', e);
    }
  }

  function syncColorHexFromCatalog() {
    const hex = applyCatalogColorHex(newColorName, catalogColors);
    if (hex) {
      newColorHex = hex;
    }
  }

  function addColor() {
    if (!newColorName.trim()) {
      error = 'Please enter a color name';
      return;
    }

    syncColorHexFromCatalog();

    // Normalize hex code: ensure it starts with # and has 6 characters
    let normalizedHex = newColorHex.trim();

    // Remove # if present
    if (normalizedHex.startsWith('#')) {
      normalizedHex = normalizedHex.substring(1);
    }

    // Validate hex format (should be 6 hex characters)
    if (!/^[0-9A-Fa-f]{6}$/.test(normalizedHex)) {
      error = 'Hex color must be in format #RRGGBB (e.g., #000000)';
      return;
    }

    // Add # and convert to uppercase
    normalizedHex = '#' + normalizedHex.toUpperCase();

    // Check if color already exists
    if (
      productData.colors.some(
        (c) => c.hex === normalizedHex || c.name.toLowerCase() === newColorName.trim().toLowerCase()
      )
    ) {
      error = 'This color already exists';
      return;
    }

    productData.colors = [...productData.colors, { name: newColorName.trim(), hex: normalizedHex }];
    newColorName = '';
    newColorHex = '#000000';
    error = ''; // Clear any previous errors
  }

  function removeColor(index: number) {
    productData.colors = productData.colors.filter((_, i) => i !== index);
  }

  async function deleteImage(imageId: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Use custom dialog instead of browser confirm
    const confirmed = await dialogStore.confirm(
      t('product.deleteImageConfirm'),
      t('product.deleteImage'),
      t('common.delete'),
      t('common.cancel')
    );

    if (!confirmed) {
      return;
    }

    const originalImages = [...images];

    try {
      console.log('Deleting image:', imageId);

      // Optimistically remove image from UI immediately
      images = images.filter((img) => img.id !== imageId);

      const response = await adminApi.deleteProductImage(imageId);
      console.log('Delete image response:', response);
    } catch (e) {
      // Restore original images list on error
      images = originalImages;

      const errorMessage = e instanceof Error ? e.message : t('product.failedToDeleteImage');
      console.error('Error deleting image:', e);
      await dialogStore.alert(errorMessage, t('common.error'));
      // Reload product to sync state in case of error
      await loadProduct();
    }
  }

  async function uploadNewImages() {
    if (newImages.length === 0) return;

    try {
      const productId = $page.params.id;
      await adminApi.uploadMultipleProductImages(newImages, productId);
      newImages = [];
      newImagePreviews = [];
      await loadProduct();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('product.failedToUploadImages'));
    }
  }

  async function handleImagesReorder(
    reordered: import('$lib/types/sortable-media').SortableMediaItem[]
  ) {
    images = reordered as ProductImage[];
    await reorderImages();
  }

  async function reorderImages() {
    if (!product) return;

    const imageOrders = images.map((img, index) => ({
      id: img.id,
      order: index,
    }));

    try {
      await adminApi.reorderProductImages(product.id, imageOrders);
      // Reload to sync with backend
      await loadProduct();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : t('product.failedToReorderImages');
      notificationStore.error(errorMsg);
      // Reload to restore original order
      await loadProduct();
    }
  }

  async function addVariant() {
    if (!newVariant.name || !newVariant.sku) {
      alert(t('product.fillVariantNameAndSku'));
      return;
    }

    try {
      const productId = $page.params.id;
      const response = await adminApi.addProductVariant({
        productId,
        name: newVariant.name,
        sku: newVariant.sku,
        price: newVariant.price,
        size: newVariant.size || undefined,
        showOnProduct: newVariant.showOnProduct,
      });

      variants = [...variants, response.variant];

      newVariant = {
        name: '',
        sku: '',
        price: undefined,
        size: '',
        showOnProduct: false,
      };

      // Reload product and inventory to include new variant
      await loadProduct();
      await loadProductInventory();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('product.failedToAddVariant'));
    }
  }

  async function removeVariant(index: number) {
    const variant = variants[index];

    const confirmed = await dialogStore.confirm(
      t('product.deleteVariantConfirm', { name: variant.name }),
      t('product.deleteProduct'),
      t('common.delete'),
      t('common.cancel')
    );

    if (!confirmed) {
      return;
    }

    try {
      if (!variant.id.startsWith('temp-')) {
        await adminApi.deleteProductVariant(variant.id);
      }
      variants = variants.filter((_, i) => i !== index);
    } catch (e) {
      alert(e instanceof Error ? e.message : t('product.failedToDeleteVariant'));
    }
  }

  function startEditingVariant(variant: ProductVariant) {
    editingVariant = {
      id: variant.id,
      sku: variant.sku,
      price: variant.price != null ? Number(variant.price) : undefined,
    };
  }

  function cancelEditingVariant() {
    editingVariant = null;
  }

  async function saveVariantEdit() {
    if (!editingVariant) return;

    try {
      const variantIndex = variants.findIndex((v) => v.id === editingVariant!.id);
      if (variantIndex === -1) return;

      await adminApi.updateProductVariant(editingVariant.id, {
        sku: editingVariant.sku,
        price: editingVariant.price,
      });

      variants[variantIndex] = {
        ...variants[variantIndex],
        sku: editingVariant.sku,
        price: editingVariant.price,
      };
      variants = variants; // Trigger reactivity

      editingVariant = null;
      notificationStore.success('Variant updated successfully');
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'product.failedToUpdateVariant'));
    }
  }

  async function bulkCreateVariantsFromSizes() {
    if (!bulkCreateBaseSku) {
      notificationStore.error(t('product.pleaseEnterBaseSku'));
      return;
    }

    // Collect all selected sizes
    const sizesToCreate: Array<{ size: string; type: ManagedSizeType }> = [];

    if (selectedClothingSizes.length > 0) {
      selectedClothingSizes.forEach((size) => {
        sizesToCreate.push({ size, type: 'CLOTHING' });
      });
    }

    if (selectedShoeSizes.length > 0) {
      selectedShoeSizes.forEach((size) => {
        sizesToCreate.push({ size, type: 'SHOES' });
      });
    }

    if (customSizes.length > 0) {
      customSizes.forEach((size) => {
        sizesToCreate.push({ size: size.value || getCustomSizeDisplayLabel(size), type: 'CUSTOM' });
      });
    }

    if (selectedVolumeSizes.length > 0) {
      selectedVolumeSizes.forEach((size) => {
        sizesToCreate.push({ size, type: 'VOLUME' });
      });
    }

    if (customVolumeSizes.length > 0) {
      customVolumeSizes.forEach((size) => {
        sizesToCreate.push({ size, type: 'VOLUME' });
      });
    }

    if (selectedWeightSizes.length > 0) {
      selectedWeightSizes.forEach((size) => {
        sizesToCreate.push({ size, type: 'WEIGHT' });
      });
    }

    if (customWeightSizes.length > 0) {
      customWeightSizes.forEach((size) => {
        sizesToCreate.push({ size, type: 'WEIGHT' });
      });
    }

    if (sizesToCreate.length === 0) {
      notificationStore.error(t('product.pleaseSelectAtLeastOneSize'));
      return;
    }

    try {
      const productId = $page.params.id;
      const createdVariants: ProductVariant[] = [];

      for (const { size, type } of sizesToCreate) {
        // Check if variant with this size already exists
        const existingVariant = variants.find((v) => v.size === size);
        if (existingVariant) {
          continue; // Skip if variant already exists
        }

        // Generate SKU: base-sku-size (e.g., "PROD-001-S")
        const variantSku = `${bulkCreateBaseSku}-${size}`;
        const variantName = product?.name ? `${product.name} - Size: ${size}` : `Size: ${size}`;

        const response = await adminApi.addProductVariant({
          productId,
          name: variantName,
          sku: variantSku,
          price: bulkCreateBasePrice,
          size: size,
          showOnProduct: true,
        });

        createdVariants.push(response.variant);
      }

      variants = [...variants, ...createdVariants];

      // Reset bulk create form
      bulkCreateBaseSku = '';
      bulkCreateBasePrice = undefined;
      bulkCreateMode = false;

      notificationStore.success(`Created ${createdVariants.length} variant(s)`);

      // Reload product and inventory to include new variants
      await loadProduct();
      await loadProductInventory();
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'product.failedToCreateVariants'));
    }
  }

  async function handleSubmit() {
    // Determine final category: sub-subcategory > subcategory > main category
    let finalCategoryId = productData.categoryId;
    if (!finalCategoryId && selectedSubcategoryId) {
      finalCategoryId = selectedSubcategoryId;
    }
    if (!finalCategoryId) {
      finalCategoryId = selectedMainCategoryId;
    }

    if (!productData.name || !productData.sku || !selectedMainCategoryId) {
      error = 'Please fill in all required fields';
      return;
    }

    // Validate price: if priceOnRequest is false, price is required
    if (!productData.priceOnRequest && (!productData.price || productData.price <= 0)) {
      error = 'Price is required when "Price on Request" is not enabled';
      return;
    }

    // If priceOnRequest is true, price should be empty
    if (
      productData.priceOnRequest &&
      productData.price !== undefined &&
      productData.price !== null
    ) {
      error = 'Price must be empty when "Price on Request" is enabled';
      return;
    }

    loading = true;
    error = '';

    try {
      const productId = $page.params.id;
      // Clean up data: convert empty strings to undefined/null for optional fields
      const updateData: any = {
        name: productData.name,
        slug: productData.slug || undefined,
        description: productData.description || undefined,
        sku: productData.sku,
        price: productData.priceOnRequest ? undefined : productData.price,
        priceOnRequest: productData.priceOnRequest,
        categoryId: finalCategoryId,
        isActive: productData.isActive,
        isFeatured: productData.isFeatured,
      };

      // Only include optional fields if they have values
      if (
        productData.compareAtPrice !== undefined &&
        productData.compareAtPrice !== null &&
        productData.compareAtPrice > 0
      ) {
        updateData.compareAtPrice = productData.compareAtPrice;
      } else {
        updateData.compareAtPrice = null;
      }

      if (productData.brandId) {
        updateData.brandId = productData.brandId;
      } else {
        updateData.brandId = null;
      }

      // Always send productTypes and sizes (even if empty/null to allow clearing)
      updateData.productTypes =
        productData.productTypes && productData.productTypes.length > 0
          ? productData.productTypes
          : null;

      // Get current sizes based on selected product types (include CUSTOM whenever we have custom sizes)
      const sizesObj: ProductSizes = {};
      if (productData.productTypes.includes('CLOTHING') && selectedClothingSizes.length > 0) {
        sizesObj.CLOTHING = selectedClothingSizes;
      }
      if (productData.productTypes.includes('SHOES') && selectedShoeSizes.length > 0) {
        sizesObj.SHOES = selectedShoeSizes;
      }
      if (customSizes.length > 0) {
        sizesObj.CUSTOM = customSizes.map((s) => ({
          value: s.value.trim(),
          label: getCustomSizeDisplayLabel(s).trim(),
          ...(s.widthCm != null ? { widthCm: s.widthCm } : {}),
          ...(s.heightCm != null ? { heightCm: s.heightCm } : {}),
        }));
        const types = updateData.productTypes ?? productData.productTypes ?? [];
        if (!(Array.isArray(types) && types.includes('CUSTOM'))) {
          updateData.productTypes = Array.isArray(types) ? [...types, 'CUSTOM'] : ['CUSTOM'];
        }
      }
      if (
        productData.productTypes.includes('VOLUME') &&
        (selectedVolumeSizes.length > 0 || customVolumeSizes.length > 0)
      ) {
        sizesObj.VOLUME = [...new Set([...selectedVolumeSizes, ...customVolumeSizes])];
      }
      if (
        productData.productTypes.includes('WEIGHT') &&
        (selectedWeightSizes.length > 0 || customWeightSizes.length > 0)
      ) {
        sizesObj.WEIGHT = [...new Set([...selectedWeightSizes, ...customWeightSizes])];
      }
      updateData.sizes = Object.keys(sizesObj).length > 0 ? sizesObj : null;

      // Always send filter fields (even if empty to allow clearing)
      // Validate and send colors only if array is not empty
      if (productData.colors && productData.colors.length > 0) {
        // Validate each color before sending
        const validColors = productData.colors.filter(
          (c) => c && c.name && c.name.trim() && c.hex && /^#[0-9A-Fa-f]{6}$/i.test(c.hex)
        );
        if (validColors.length > 0) {
          updateData.colors = validColors.map((c) => ({
            name: c.name.trim(),
            hex: c.hex.toUpperCase(),
          }));
        } else {
          updateData.colors = null;
        }
      } else {
        updateData.colors = null;
      }

      // Always send relatedProducts (even if empty to allow clearing)
      updateData.relatedProducts =
        productData.relatedProducts && productData.relatedProducts.length > 0
          ? productData.relatedProducts
          : null;
      console.log('Updating product with relatedProducts:', updateData.relatedProducts);
      updateData.material = productData.material || null;
      updateData.lining = productData.lining || null;
      updateData.application = productData.application || null;
      updateData.countryOfOrigin = productData.countryOfOrigin || null;
      updateData.metaTitle = productData.metaTitle || null;
      updateData.metaDescription = productData.metaDescription || null;
      updateData.metaKeywords = productData.metaKeywords || null;
      updateData.hideColor = productData.hideColor;
      updateData.showCompleteTheLook = productData.showCompleteTheLook;
      updateData.hideMaterial = productData.hideMaterial;
      updateData.hideLining = productData.hideLining;
      updateData.hideCountryOfOrigin = productData.hideCountryOfOrigin;
      updateData.costPrice = productData.costPrice ?? null;
      updateData.costCurrency = productData.costCurrency || null;
      updateData.customsCode = productData.customsCode || null;
      updateData.vatRate = productData.vatRate ?? null;
      updateData.exciseGoods = productData.exciseGoods;
      updateData.importDeclarationNumber = productData.importDeclarationNumber || null;
      updateData.importDeclarationDate = productData.importDeclarationDate || null;
      updateData.customsValue = productData.customsValue ?? null;
      updateData.customsValueCurrency = productData.customsValueCurrency || null;
      updateData.weightNet = productData.weightNet ?? null;
      updateData.weightGross = productData.weightGross ?? null;
      updateData.lengthCm = productData.lengthCm ?? null;
      updateData.widthCm = productData.widthCm ?? null;
      updateData.heightCm = productData.heightCm ?? null;

      console.log('Updating product with data:', updateData);

      await adminApi.updateProduct(productId, updateData);

      // Upload new images if any
      if (newImages.length > 0) {
        await uploadNewImages();
      }

      await loadProduct();
      formTab = 'stock';
      activeTab = 'stock';
      notificationStore.success('Product updated successfully');
      loading = false;
    } catch (e) {
      error = getErrorMessage(e, 'product.failedToUpdate');
      loading = false;
    }
  }
</script>

{#if loadingProduct}
  <div class="w-full max-w-[10rem] py-8">
    <LoadingBar />
  </div>
{:else if error && !product}
  <p class="text-red-400">Error: {error}</p>
{:else if product}
  <div>
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <h2 class="text-2xl sm:text-3xl font-bold">{t('product.editProduct')}</h2>
      <a
        href="/admin/products"
        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black w-full sm:w-auto text-center"
      >
        {t('product.backToProducts')}
      </a>
    </div>

    {#if error}
      <div class="mb-6 p-4 bg-red-500/20 border border-red-500 text-red-400">
        {error}
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <div class="flex gap-1 p-2 bg-gray-100 rounded-lg overflow-x-auto mb-6">
        <button
          type="button"
          on:click={() => (formTab = 'basic')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={formTab === 'basic'}
          class:shadow-sm={formTab === 'basic'}
          class:text-accent={formTab === 'basic'}
          class:text-gray-600={formTab !== 'basic'}
          class:hover:bg-gray-50={formTab !== 'basic'}
          class:hover:text-gray-900={formTab !== 'basic'}
        >
          {t('product.basicInformation')}
        </button>
        <button
          type="button"
          on:click={() => (formTab = 'translations')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={formTab === 'translations'}
          class:shadow-sm={formTab === 'translations'}
          class:text-accent={formTab === 'translations'}
          class:text-gray-600={formTab !== 'translations'}
          class:hover:bg-gray-50={formTab !== 'translations'}
          class:hover:text-gray-900={formTab !== 'translations'}
        >
          {t('product.translations')}
        </button>
        <button
          type="button"
          on:click={() => (formTab = 'seo')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={formTab === 'seo'}
          class:shadow-sm={formTab === 'seo'}
          class:text-accent={formTab === 'seo'}
          class:text-gray-600={formTab !== 'seo'}
          class:hover:bg-gray-50={formTab !== 'seo'}
          class:hover:text-gray-900={formTab !== 'seo'}
        >
          {t('product.seoSettings')}
        </button>
        <button
          type="button"
          on:click={() => (formTab = 'reporting')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={formTab === 'reporting'}
          class:shadow-sm={formTab === 'reporting'}
          class:text-accent={formTab === 'reporting'}
          class:text-gray-600={formTab !== 'reporting'}
          class:hover:bg-gray-50={formTab !== 'reporting'}
          class:hover:text-gray-900={formTab !== 'reporting'}
        >
          {t('product.reportingTitle')}
        </button>
        <button
          type="button"
          on:click={() => (formTab = 'media')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={formTab === 'media'}
          class:shadow-sm={formTab === 'media'}
          class:text-accent={formTab === 'media'}
          class:text-gray-600={formTab !== 'media'}
          class:hover:bg-gray-50={formTab !== 'media'}
          class:hover:text-gray-900={formTab !== 'media'}
        >
          {t('product.imagesVideos')}
        </button>
        <button
          type="button"
          on:click={() => (formTab = 'variants')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={formTab === 'variants'}
          class:shadow-sm={formTab === 'variants'}
          class:text-accent={formTab === 'variants'}
          class:text-gray-600={formTab !== 'variants'}
          class:hover:bg-gray-50={formTab !== 'variants'}
          class:hover:text-gray-900={formTab !== 'variants'}
        >
          {t('product.productVariants')}
        </button>
        <button
          type="button"
          on:click={() => (formTab = 'stock')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={formTab === 'stock'}
          class:shadow-sm={formTab === 'stock'}
          class:text-accent={formTab === 'stock'}
          class:text-gray-600={formTab !== 'stock'}
          class:hover:bg-gray-50={formTab !== 'stock'}
          class:hover:text-gray-900={formTab !== 'stock'}
        >
          {t('warehouse.stockManagement')}
        </button>
      </div>

      {#if formTab === 'basic'}
        <div class="bg-dark-light p-6 space-y-6">
          <h3 class="text-xl font-medium">{t('product.basicInformation')}</h3>

          {#if brandsEnabled}
            <div>
              <label for="productBrand" class="block text-sm font-medium mb-2"
                >{t('product.brand')}</label
              >
              <select
                id="productBrand"
                bind:value={productData.brandId}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">{t('product.noBrand')}</option>
                {#each brands as brand}
                  <option value={brand.id}>{brand.name}</option>
                {/each}
              </select>
            </div>
          {/if}

          <div>
            <label for="productName" class="block text-sm font-medium mb-2">
              {t('product.productName')} <span class="text-red-400">*</span>
            </label>
            <input
              id="productName"
              type="text"
              bind:value={productData.name}
              required
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('product.enterProductName')}
            />
          </div>

          <div>
            <label for="productSlug" class="block text-sm font-medium mb-2"
              >{t('common.slug')}</label
            >
            <input
              id="productSlug"
              type="text"
              bind:value={productData.slug}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('product.autoGeneratedFromName')}
            />
          </div>

          <div>
            <label for="productDescription" class="block text-sm font-medium mb-2"
              >{t('product.description')}</label
            >
            <textarea
              id="productDescription"
              bind:value={productData.description}
              rows="4"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('product.enterProductDescription')}
            ></textarea>
          </div>
        </div>
      {/if}

      {#if formTab === 'translations'}
        <div class="bg-dark-light p-6 space-y-6">
          <div class="border-t border-gray-300 pt-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-lg font-medium">{t('product.translations')}</h4>
              <button
                type="button"
                on:click={() => (showTranslations = !showTranslations)}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black text-sm"
              >
                {showTranslations ? t('common.close') : t('product.addTranslation')}
              </button>
            </div>

            {#if showTranslations}
              {#if editingTranslation}
                {@const translationLangCode = editingTranslation?.languageCode ?? ''}
                <!-- Translation Editor -->
                <div class="bg-gray-50 p-4 mb-4 border border-gray-300">
                  <div class="flex items-center justify-between mb-4">
                    <h5 class="font-medium">
                      {t('product.translationFor')}
                      {languages.find((l) => l.code === translationLangCode)?.nameNative ||
                        translationLangCode}
                    </h5>
                    <button
                      type="button"
                      on:click={closeTranslationEditor}
                      class="text-gray-600 hover:text-black"
                    >
                      {t('common.close')}
                    </button>
                  </div>

                  <div class="space-y-4">
                    <div>
                      <label for="translationProductName" class="block text-sm font-medium mb-2"
                        >{t('product.name')}</label
                      >
                      <input
                        id="translationProductName"
                        type="text"
                        bind:value={editingTranslation.name}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={productData.name}
                      />
                    </div>

                    <div>
                      <label
                        for="translationProductDescription"
                        class="block text-sm font-medium mb-2">{t('product.description')}</label
                      >
                      <textarea
                        id="translationProductDescription"
                        bind:value={editingTranslation.description}
                        rows="4"
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={productData.description}
                      ></textarea>
                    </div>

                    <div>
                      <label for="translationProductMaterial" class="block text-sm font-medium mb-2"
                        >{t('product.material')}</label
                      >
                      <input
                        id="translationProductMaterial"
                        type="text"
                        bind:value={editingTranslation.material}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={productData.material}
                      />
                    </div>

                    <div>
                      <label for="translationProductLining" class="block text-sm font-medium mb-2"
                        >{t('product.lining')}</label
                      >
                      <input
                        id="translationProductLining"
                        type="text"
                        bind:value={editingTranslation.lining}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={productData.lining}
                      />
                    </div>

                    <div>
                      <label for="translationProductCountry" class="block text-sm font-medium mb-2"
                        >{t('product.countryOfOrigin')}</label
                      >
                      <input
                        id="translationProductCountry"
                        type="text"
                        bind:value={editingTranslation.countryOfOrigin}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={productData.countryOfOrigin}
                      />
                    </div>

                    <div class="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        on:click={translateWithGPT}
                        disabled={gptTranslating}
                        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {#if gptTranslating}
                          <svg
                            class="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              class="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              stroke-width="4"
                            ></circle>
                            <path
                              class="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Translating...
                        {:else}
                          <svg
                            class="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            ></path>
                          </svg>
                          GPT Assistant
                        {/if}
                      </button>
                      <button
                        type="button"
                        on:click={saveTranslation}
                        class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        type="button"
                        on:click={closeTranslationEditor}
                        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              {:else}
                <!-- Translation List -->
                <div class="space-y-2 mb-4">
                  {#each translations as translation}
                    {@const lang = languages.find((l) => l.code === translation.languageCode)}
                    <div
                      class="flex items-center justify-between p-3 bg-gray-50 border border-gray-300"
                    >
                      <div>
                        <span class="font-medium"
                          >{lang?.nameNative || lang?.name || translation.languageCode}</span
                        >
                        {#if translation.name}
                          <span class="text-sm text-gray-600 ml-2">({translation.name})</span>
                        {/if}
                      </div>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          on:click={() => openTranslationEditor(translation.languageCode)}
                          class="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black text-sm"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          on:click={() => deleteTranslation(translation.languageCode)}
                          class="px-3 py-1 bg-red-500 text-white hover:bg-red-600 transition-colors text-sm"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Add Translation Button -->
                {#if languages.length > 0}
                  <div class="mb-4">
                    <p class="block text-sm font-medium mb-2">{t('product.addTranslation')}</p>
                    <select
                      id="productAddTranslation"
                      bind:value={selectedLanguageForTranslation}
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-2"
                    >
                      <option value="">{t('common.select')}...</option>
                      {#each languages.filter((l) => !translations.find((t) => t.languageCode === l.code)) as lang}
                        <option value={lang.code}>{lang.nameNative || lang.name}</option>
                      {/each}
                    </select>
                    {#if selectedLanguageForTranslation}
                      <button
                        type="button"
                        on:click={() => {
                          openTranslationEditor(selectedLanguageForTranslation);
                          selectedLanguageForTranslation = '';
                        }}
                        class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
                      >
                        {t('common.add')}
                      </button>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          </div>
        </div>
      {/if}

      {#if formTab === 'seo'}
        <div class="bg-dark-light p-6 space-y-6">
          <h3 class="text-xl font-medium">{t('product.seoSettings')}</h3>
          <p class="text-sm text-accent-muted">
            {t('product.seoFieldsHint')}
          </p>

          <div>
            <label for="productMetaTitle" class="block text-sm font-medium mb-2">
              {t('product.metaTitle')}
            </label>
            <input
              id="productMetaTitle"
              type="text"
              bind:value={productData.metaTitle}
              maxlength="60"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('product.metaTitlePlaceholder')}
            />
            <p class="mt-1 text-xs text-accent-muted">
              {t('product.metaTitleLengthHint', {
                count: 60 - (productData.metaTitle?.length || 0),
              })}
            </p>
          </div>

          <div>
            <label for="productMetaDescription" class="block text-sm font-medium mb-2">
              {t('product.metaDescription')}
            </label>
            <textarea
              id="productMetaDescription"
              bind:value={productData.metaDescription}
              rows="3"
              maxlength="160"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('product.metaDescriptionPlaceholder')}
            ></textarea>
            <p class="mt-1 text-xs text-accent-muted">
              {t('product.metaDescriptionLengthHint', {
                count: 160 - (productData.metaDescription?.length || 0),
              })}
            </p>
          </div>

          <div>
            <label for="productMetaKeywords" class="block text-sm font-medium mb-2">
              {t('product.metaKeywords')}
            </label>
            <input
              id="productMetaKeywords"
              type="text"
              bind:value={productData.metaKeywords}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('product.metaKeywordsPlaceholder')}
            />
            <p class="mt-1 text-xs text-accent-muted">
              {t('product.metaKeywordsHint')}
            </p>
          </div>
        </div>
      {/if}

      {#if formTab === 'reporting'}
        <!-- Admin-only: accounting & customs (Delivery by Seller reports) -->
        <details class="bg-dark-light p-6" open>
          <summary class="cursor-pointer text-xl font-medium text-accent-muted hover:text-accent">
            {t('product.reportingTitle')}
          </summary>
          <p class="mt-2 text-sm text-accent-muted">{t('product.reportingSubtitle')}</p>
          <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label for="productCostPrice" class="block text-sm font-medium mb-2"
                >{t('product.costPrice')}</label
              >
              <input
                id="productCostPrice"
                type="number"
                step="0.01"
                bind:value={productData.costPrice}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productCostCurrency" class="block text-sm font-medium mb-2"
                >{t('product.costCurrency')}</label
              >
              <input
                id="productCostCurrency"
                type="text"
                bind:value={productData.costCurrency}
                placeholder={t('product.costCurrencyPlaceholder')}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productHsCode" class="block text-sm font-medium mb-2"
                >{t('product.hsCode')}</label
              >
              <input
                id="productHsCode"
                type="text"
                bind:value={productData.customsCode}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productVatRate" class="block text-sm font-medium mb-2"
                >{t('product.vatRate')}</label
              >
              <input
                id="productVatRate"
                type="number"
                step="0.01"
                bind:value={productData.vatRate}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" bind:checked={productData.exciseGoods} id="excise" />
              <label for="excise" class="text-sm">{t('product.exciseProduct')}</label>
            </div>
            <div>
              <label for="productCustomsDeclarationNumber" class="block text-sm font-medium mb-2"
                >{t('product.customsDeclarationNumber')}</label
              >
              <input
                id="productCustomsDeclarationNumber"
                type="text"
                bind:value={productData.importDeclarationNumber}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productDeclarationDate" class="block text-sm font-medium mb-2"
                >{t('product.declarationDate')}</label
              >
              <input
                id="productDeclarationDate"
                type="date"
                bind:value={productData.importDeclarationDate}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productCustomsValue" class="block text-sm font-medium mb-2"
                >{t('product.customsValue')}</label
              >
              <input
                id="productCustomsValue"
                type="number"
                step="0.01"
                bind:value={productData.customsValue}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productCustomsValueCurrency" class="block text-sm font-medium mb-2"
                >{t('product.customsValueCurrency')}</label
              >
              <input
                id="productCustomsValueCurrency"
                type="text"
                bind:value={productData.customsValueCurrency}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productNetWeightKg" class="block text-sm font-medium mb-2"
                >{t('product.netWeightKg')}</label
              >
              <input
                id="productNetWeightKg"
                type="number"
                step="0.001"
                bind:value={productData.weightNet}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productGrossWeightKg" class="block text-sm font-medium mb-2"
                >{t('product.grossWeightKg')}</label
              >
              <input
                id="productGrossWeightKg"
                type="number"
                step="0.001"
                bind:value={productData.weightGross}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="productLengthCm" class="block text-sm font-medium mb-2"
                >{t('product.lengthCm')}</label
              >
              <input
                id="productLengthCm"
                type="number"
                step="0.1"
                min="0"
                bind:value={productData.lengthCm}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="cm"
              />
            </div>
            <div>
              <label for="productWidthCm" class="block text-sm font-medium mb-2"
                >{t('product.widthCm')}</label
              >
              <input
                id="productWidthCm"
                type="number"
                step="0.1"
                min="0"
                bind:value={productData.widthCm}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="cm"
              />
            </div>
            <div>
              <label for="productHeightCm" class="block text-sm font-medium mb-2"
                >{t('product.heightCm')}</label
              >
              <input
                id="productHeightCm"
                type="number"
                step="0.1"
                min="0"
                bind:value={productData.heightCm}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="cm"
              />
            </div>
          </div>
          <p class="mt-2 text-sm text-accent-muted">{t('product.shippingHint')}</p>
        </details>
      {/if}

      {#if formTab === 'basic'}
        <div class="bg-dark-light p-6 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="productSku" class="block text-sm font-medium mb-2">
                {t('product.sku')} <span class="text-red-400">*</span>
              </label>
              <input
                id="productSku"
                type="text"
                bind:value={productData.sku}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder={t('product.skuPlaceholder')}
              />
            </div>

            <div>
              <label for="productPrice" class="block text-sm font-medium mb-2">
                {t('product.price')}
                {#if !productData.priceOnRequest}<span class="text-red-400">*</span>{/if}
              </label>
              <input
                id="productPrice"
                type="number"
                bind:value={productData.price}
                required={!productData.priceOnRequest}
                disabled={productData.priceOnRequest}
                min="0"
                step="0.01"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={productData.priceOnRequest
                  ? t('product.priceOnRequest')
                  : t('product.pricePlaceholder')}
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="productCompareAtPrice" class="block text-sm font-medium mb-2"
                >{t('product.compareAtPrice')}</label
              >
              <input
                id="productCompareAtPrice"
                type="number"
                bind:value={productData.compareAtPrice}
                min="0"
                step="0.01"
                disabled={productData.priceOnRequest}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={t('product.pricePlaceholder')}
              />
              <p class="mt-1 text-xs text-accent-muted">{t('product.compareAtPriceHint')}</p>
            </div>

            <div>
              <label class="flex items-center gap-2 mb-2" for="productPriceOnRequest">
                <input
                  id="productPriceOnRequest"
                  type="checkbox"
                  bind:checked={productData.priceOnRequest}
                  class="w-4 h-4"
                  on:change={() => {
                    if (productData.priceOnRequest) {
                      productData.price = undefined;
                      productData.compareAtPrice = undefined;
                    }
                  }}
                />
                <span class="text-sm font-medium">{t('product.priceOnRequest')}</span>
              </label>
              <p class="text-xs text-accent-muted">
                {t('product.priceOnRequestHint')}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label for="productMainCategory" class="block text-sm font-medium mb-2">
                {t('product.category')} <span class="text-red-400">*</span>
              </label>
              <select
                id="productMainCategory"
                bind:value={selectedMainCategoryId}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                on:change={(e) => {
                  // Reset dependent selections when main category changes
                  const newMainId = e.currentTarget.value;
                  if (newMainId !== selectedMainCategoryId) {
                    selectedSubcategoryId = '';
                    productData.categoryId = '';
                  }
                }}
              >
                <option value="">{t('product.selectCategory')}</option>
                {#if mainCategories.length === 0}
                  <option value="" disabled>{t('product.noCategoriesAvailable')}</option>
                {:else}
                  {#each mainCategories as category}
                    <option value={category.id}>{category.name}</option>
                  {/each}
                {/if}
              </select>
              {#if mainCategories.length === 0 && allCategories.length > 0}
                <p class="mt-1 text-xs text-black">
                  {t('product.warningNoMainCategories')}
                </p>
              {/if}
            </div>

            <div>
              <label for="productSubcategory" class="block text-sm font-medium mb-2">
                {t('product.subcategory')}
                {selectedMainCategoryId ? '' : t('product.selectCategoryFirst')}
              </label>
              <select
                id="productSubcategory"
                bind:value={selectedSubcategoryId}
                disabled={!selectedMainCategoryId}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                on:change={(e) => {
                  // Reset sub-subcategory if it's not valid for new subcategory
                  const newSubId = e.currentTarget.value;
                  if (newSubId && productData.categoryId) {
                    const currentSubSubs = allCategories.filter((cat) => cat.parentId === newSubId);
                    const isValidSubSub = currentSubSubs.find(
                      (cat) => cat.id === productData.categoryId
                    );
                    const isSubcategoryItself = productData.categoryId === newSubId;
                    if (!isValidSubSub && !isSubcategoryItself) {
                      productData.categoryId = '';
                    }
                  } else if (!newSubId) {
                    productData.categoryId = '';
                  }
                }}
              >
                <option value="">{t('product.selectSubcategoryOptional')}</option>
                {#each subcategories as subcategory}
                  <option value={subcategory.id}>{subcategory.name}</option>
                {/each}
              </select>
              {#if selectedMainCategoryId && !selectedSubcategoryId}
                <p class="mt-1 text-xs text-accent-muted">
                  {t('product.optionalSelectSubcategory')}
                </p>
              {/if}
            </div>

            <div>
              <label for="productSubSubcategory" class="block text-sm font-medium mb-2">
                {t('product.subSubcategory')}
              </label>
              <select
                id="productSubSubcategory"
                bind:value={productData.categoryId}
                disabled={!selectedSubcategoryId || subSubcategories.length === 0}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{t('product.selectSubSubcategoryOptional')}</option>
                {#if subSubcategories.length > 0}
                  {#each subSubcategories as subSubcategory}
                    <option value={subSubcategory.id}>{subSubcategory.name}</option>
                  {/each}
                {:else if selectedSubcategoryId}
                  <option value={selectedSubcategoryId}>{t('product.useSubcategory')}</option>
                {/if}
              </select>
              {#if selectedSubcategoryId && subSubcategories.length === 0}
                <p class="mt-1 text-xs text-accent-muted">
                  {t('product.noSubSubcategoriesUseSubcategory')}
                </p>
              {/if}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p class="block text-sm font-medium mb-2">
                {t('product.productTypes')} ({t('product.canSelectMultiple')})
              </p>
              <div class="flex flex-wrap gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productData.productTypes.includes('CLOTHING')}
                    on:change={() => toggleProductType('CLOTHING')}
                    class="w-4 h-4"
                  />
                  <span class="text-sm">{t('product.clothing')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productData.productTypes.includes('SHOES')}
                    on:change={() => toggleProductType('SHOES')}
                    class="w-4 h-4"
                  />
                  <span class="text-sm">{t('product.shoes')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productData.productTypes.includes('CUSTOM')}
                    on:change={() => toggleProductType('CUSTOM')}
                    class="w-4 h-4"
                  />
                  <span class="text-sm">{t('product.custom')} (cm)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productData.productTypes.includes('VOLUME')}
                    on:change={() => toggleProductType('VOLUME')}
                    class="w-4 h-4"
                  />
                  <span class="text-sm">{t('product.volume')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productData.productTypes.includes('WEIGHT')}
                    on:change={() => toggleProductType('WEIGHT')}
                    class="w-4 h-4"
                  />
                  <span class="text-sm">{t('product.weight')}</span>
                </label>
              </div>
              {#if productData.productTypes.length > 0}
                <p class="mt-2 text-xs text-accent-muted">
                  {t('common.selected')}: {productData.productTypes.join(', ')}
                </p>
              {/if}
            </div>
          </div>

          <!-- Sizes Section - Show for each selected type -->
          {#if productData.productTypes.includes('CLOTHING')}
            <div>
              <p class="block text-sm font-medium mb-2">{t('product.clothingSizes')}</p>
              <div class="flex flex-wrap gap-2">
                {#each clothingSizes as size}
                  <button
                    type="button"
                    on:click={() => toggleClothingSize(size)}
                    class="px-4 py-2 border transition-colors {selectedClothingSizes.includes(size)
                      ? 'bg-accent text-dark border-accent'
                      : 'bg-white text-black border-gray-300 hover:border-accent'}"
                  >
                    {size}
                  </button>
                {/each}
              </div>
              {#if selectedClothingSizes.length > 0}
                <p class="mt-2 text-xs text-accent-muted">
                  {t('common.selected')}: {selectedClothingSizes.join(', ')}
                </p>
              {/if}
            </div>
          {/if}

          {#if productData.productTypes.includes('SHOES')}
            <div>
              <p class="block text-sm font-medium mb-2">{t('product.shoeSizesEu')}</p>
              <div class="flex flex-wrap gap-2">
                {#each shoeSizes as size}
                  <button
                    type="button"
                    on:click={() => toggleShoeSize(size)}
                    class="px-4 py-2 border transition-colors {selectedShoeSizes.includes(size)
                      ? 'bg-accent text-dark border-accent'
                      : 'bg-white text-black border-gray-300 hover:border-accent'}"
                  >
                    {size}
                  </button>
                {/each}
              </div>
              {#if selectedShoeSizes.length > 0}
                <p class="mt-2 text-xs text-accent-muted">
                  {t('common.selected')}: {selectedShoeSizes.join(', ')}
                </p>
              {/if}
            </div>
          {/if}

          {#if productData.productTypes.includes('VOLUME')}
            <div>
              <p class="block text-sm font-medium mb-2">{t('product.volumeSizes')} (ml)</p>
              <div class="flex flex-wrap gap-2">
                {#each volumeSizes as size}
                  <button
                    type="button"
                    on:click={() => toggleVolumeSize(size)}
                    class="px-4 py-2 border transition-colors {selectedVolumeSizes.includes(size)
                      ? 'bg-accent text-dark border-accent'
                      : 'bg-white text-black border-gray-300 hover:border-accent'}"
                  >
                    {size} ml
                  </button>
                {/each}
              </div>
              <div class="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  type="number"
                  bind:value={customVolumeValue}
                  placeholder={t('product.customVolumePlaceholder')}
                  min="1"
                  step="1"
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black max-w-[140px]"
                  on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomVolume())}
                />
                <span class="self-center text-sm text-black/70">ml</span>
                <button
                  type="button"
                  on:click={addCustomVolume}
                  class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted whitespace-nowrap"
                >
                  {t('common.add')}
                </button>
              </div>
              {#if customVolumeSizes.length > 0}
                <div class="flex flex-wrap gap-2 mt-2">
                  {#each customVolumeSizes as size, index}
                    <div class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300">
                      <span class="text-sm text-black">{size} ml</span>
                      <button
                        type="button"
                        on:click={() => removeCustomVolume(index)}
                        class="text-red-500 hover:text-red-700"
                        title={t('common.remove')}
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if selectedVolumeSizes.length > 0 || customVolumeSizes.length > 0}
                <p class="mt-2 text-xs text-accent-muted">
                  {t('common.selected')}: {[...selectedVolumeSizes, ...customVolumeSizes].join(
                    ', '
                  )} ml
                </p>
              {/if}
            </div>
          {/if}

          {#if productData.productTypes.includes('WEIGHT')}
            <div>
              <p class="block text-sm font-medium mb-2">{t('product.weightSizes')} (g)</p>
              <div class="flex flex-wrap gap-2">
                {#each weightSizes as size}
                  <button
                    type="button"
                    on:click={() => toggleWeightSize(size)}
                    class="px-4 py-2 border transition-colors {selectedWeightSizes.includes(size)
                      ? 'bg-accent text-dark border-accent'
                      : 'bg-white text-black border-gray-300 hover:border-accent'}"
                  >
                    {size} g
                  </button>
                {/each}
              </div>
              <div class="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  type="number"
                  bind:value={customWeightValue}
                  placeholder={t('product.customWeightPlaceholder')}
                  min="1"
                  step="1"
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black max-w-[140px]"
                  on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomWeight())}
                />
                <span class="self-center text-sm text-black/70">g</span>
                <button
                  type="button"
                  on:click={addCustomWeight}
                  class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted whitespace-nowrap"
                >
                  {t('common.add')}
                </button>
              </div>
              {#if customWeightSizes.length > 0}
                <div class="flex flex-wrap gap-2 mt-2">
                  {#each customWeightSizes as size, index}
                    <div class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300">
                      <span class="text-sm text-black">{size} g</span>
                      <button
                        type="button"
                        on:click={() => removeCustomWeight(index)}
                        class="text-red-500 hover:text-red-700"
                        title={t('common.remove')}
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if selectedWeightSizes.length > 0 || customWeightSizes.length > 0}
                <p class="mt-2 text-xs text-accent-muted">
                  {t('common.selected')}: {[...selectedWeightSizes, ...customWeightSizes].join(
                    ', '
                  )} g
                </p>
              {/if}
            </div>
          {/if}

          {#if productData.productTypes.includes('CUSTOM')}
            <div>
              <p class="block text-sm font-medium mb-2">{t('product.customSizes')} (cm)</p>
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <input
                  type="text"
                  bind:value={customSizeLine}
                  placeholder={t('product.customSizeLinePlaceholder')}
                  class="flex-1 min-w-[8rem] px-4 py-2 bg-white border border-gray-300 text-black"
                  on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize())}
                />
                <span class="text-xs text-gray-400 shrink-0">{t('product.customSizeOr')}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  bind:value={customSizeWidthCm}
                  placeholder="70"
                  aria-label={t('product.widthCm')}
                  class="w-[4.5rem] px-2 py-2 bg-white border border-gray-300 text-black text-center"
                />
                <span class="text-gray-400 shrink-0" aria-hidden="true">×</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  bind:value={customSizeHeightCm}
                  placeholder="100"
                  aria-label={t('product.heightCm')}
                  class="w-[4.5rem] px-2 py-2 bg-white border border-gray-300 text-black text-center"
                  on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize())}
                />
                <button
                  type="button"
                  on:click={addCustomSize}
                  class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted whitespace-nowrap shrink-0"
                >
                  {t('common.add')}
                </button>
              </div>
              {#if customSizes.length > 0}
                <div class="flex flex-wrap gap-2">
                  {#each customSizes as size, index}
                    <div
                      class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 whitespace-nowrap"
                    >
                      <span class="text-sm text-black tabular-nums"
                        >{getCustomSizeDisplayLabel(size)}</span
                      >
                      <button
                        type="button"
                        on:click={() => removeCustomSize(index)}
                        class="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Colors Section -->
          <div>
            <p class="block text-sm font-medium mb-2">{t('product.colors')}</p>
            <div class="space-y-3">
              <!-- Add Color Form -->
              <div class="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
                <input
                  type="text"
                  bind:value={newColorName}
                  placeholder={t('product.colorNamePlaceholder')}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  on:keydown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addColor();
                    }
                  }}
                  on:blur={syncColorHexFromCatalog}
                />
                {#if colorCatalogMatch && !colorAlreadyOnProduct}
                  <p class="text-xs text-amber-600 sm:basis-full">
                    {t('product.colorAlreadyInCatalog', {
                      name: colorCatalogMatch.name,
                      hex: colorCatalogMatch.hex,
                    })}
                  </p>
                {/if}
                <div class="flex gap-2">
                  <input
                    type="color"
                    bind:value={newColorHex}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                    title="Select color"
                    on:input={(e) => {
                      // Ensure color picker value is normalized
                      const value = e.currentTarget.value;
                      if (value && !value.startsWith('#')) {
                        newColorHex = '#' + value;
                      } else {
                        newColorHex = value;
                      }
                    }}
                  />
                  <input
                    type="text"
                    bind:value={newColorHex}
                    placeholder="#000000"
                    class="w-24 px-3 py-2 bg-white border border-gray-300 text-black text-sm font-mono"
                    autocomplete="off"
                    spellcheck="false"
                    on:blur={() => {
                      // Normalize on blur - but don't validate, just normalize format
                      if (newColorHex) {
                        let normalized = newColorHex.trim();
                        // Remove # if present
                        if (normalized.startsWith('#')) {
                          normalized = normalized.substring(1);
                        }
                        // Convert #RGB to #RRGGBB if needed
                        if (normalized.length === 3 && /^[0-9A-Fa-f]{3}$/i.test(normalized)) {
                          normalized = normalized
                            .split('')
                            .map((c) => c + c)
                            .join('');
                        }
                        // Add # back
                        if (normalized && /^[0-9A-Fa-f]{6}$/i.test(normalized)) {
                          newColorHex = '#' + normalized.toUpperCase();
                        }
                      }
                    }}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addColor();
                      }
                    }}
                  />
                  <button
                    type="button"
                    on:click={addColor}
                    class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted whitespace-nowrap"
                  >
                    {t('product.addColor')}
                  </button>
                </div>
              </div>

              <!-- Color Palette Display -->
              {#if productData.colors.length > 0}
                <div class="flex flex-wrap gap-3">
                  {#each productData.colors as color, index}
                    <div
                      class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded"
                    >
                      <div
                        class="w-8 h-8 rounded border border-gray-300"
                        style="background-color: {color.hex};"
                        title={color.name}
                      ></div>
                      <span class="text-sm text-black">{color.name}</span>
                      <span class="text-xs text-gray-500 font-mono">{color.hex}</span>
                      <button
                        type="button"
                        on:click={() => removeColor(index)}
                        class="ml-1 text-red-500 hover:text-red-700 text-lg leading-none"
                        title="Remove color"
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-accent-muted">{t('product.noColorsAddedYet')}</p>
              {/if}

              <!-- Hide Color Checkbox -->
              <label class="flex items-center gap-2">
                <input type="checkbox" bind:checked={productData.hideColor} class="w-4 h-4" />
                <span class="text-sm">{t('product.hideColorsOnProductPage')}</span>
              </label>
            </div>
          </div>

          <!-- Complete the Look Section -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="block text-sm font-medium">{t('product.completeTheLook')}</p>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={productData.showCompleteTheLook}
                  class="w-4 h-4"
                />
                <span class="text-sm text-gray-700">{t('product.showSectionOnPage')}</span>
              </label>
            </div>
            <p class="text-xs text-accent-muted mb-3">
              {t('product.completeTheLookHint')}
            </p>

            {#if productData.showCompleteTheLook}
              <!-- Search for products -->
              <div class="mb-4">
                <div class="relative flex gap-2">
                  <input
                    type="text"
                    bind:value={relatedProductsSearchQuery}
                    placeholder={t('product.searchBySkuOrName')}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                    autocomplete="off"
                    on:input={(e) => {
                      relatedProductsSearchQuery = e.currentTarget.value;
                    }}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (relatedProductsSearchQuery.trim().length >= 2) {
                          searchRelatedProducts();
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    on:click={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const query = relatedProductsSearchQuery.trim();
                      console.log('Search button clicked, query:', query, 'length:', query.length);
                      if (query.length >= 2) {
                        searchRelatedProducts();
                      } else {
                        console.log('Query too short, not searching');
                        error = 'Please enter at least 2 characters to search';
                      }
                    }}
                    disabled={relatedProductsSearchLoading ||
                      relatedProductsSearchQuery.trim().length < 2}
                    class="px-4 py-2 bg-accent text-white font-medium hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {relatedProductsSearchLoading ? t('common.searching') : t('common.search')}
                  </button>
                  {#if relatedProductsSearchLoading}
                    <div class="absolute right-24 top-1/2 transform -translate-y-1/2">
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    </div>
                  {/if}
                </div>

                <!-- Search Results -->
                {#if relatedProductsSearchLoading}
                  <div class="mt-2 p-3 text-sm text-gray-500 text-center">Searching...</div>
                {:else if error && (error.includes('search') || error.includes('Failed to search'))}
                  <div class="mt-2 p-3 text-sm text-red-500 text-center">
                    {error}
                    <br />
                    <span class="text-xs text-gray-400 mt-1">Check browser console for details</span
                    >
                  </div>
                {:else if relatedProductsSearchQuery && relatedProductsSearchQuery.trim().length >= 2 && relatedProductsSearchResults.length === 0 && !relatedProductsSearchLoading}
                  <div class="mt-2 p-3 text-sm text-gray-500 text-center">
                    No products found. Try a different search term.
                    <br />
                    <span class="text-xs text-gray-400 mt-1"
                      >Searched for: "{relatedProductsSearchQuery}"</span
                    >
                    <br />
                    <span class="text-xs text-gray-400 mt-1"
                      >Check browser console (F12) for search details</span
                    >
                  </div>
                {/if}

                {#if relatedProductsSearchResults.length > 0}
                  <div class="mt-2 border border-gray-300 bg-white max-h-60 overflow-y-auto">
                    {#each relatedProductsSearchResults as searchProduct}
                      <label
                        class="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={productData.relatedProducts.includes(searchProduct.id)}
                          on:change={() => toggleRelatedProduct(searchProduct.id)}
                          class="w-4 h-4"
                        />
                        <div class="flex-1 flex items-center gap-3">
                          {#if searchProduct.images && searchProduct.images.length > 0}
                            {#if isVideoUrl(searchProduct.images[0].url)}
                              <video
                                src={searchProduct.images[0].url}
                                class="w-12 h-12 object-cover"
                                muted
                                playsinline
                                preload="metadata"
                              ></video>
                            {:else}
                              <img
                                src={searchProduct.images[0].url}
                                alt={searchProduct.images[0].alt || searchProduct.name}
                                class="w-12 h-12 object-cover"
                              />
                            {/if}
                          {:else}
                            <div class="w-12 h-12 bg-gray-200 flex items-center justify-center">
                              <span class="text-xs text-gray-400">{t('product.noImage')}</span>
                            </div>
                          {/if}
                          <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-black truncate">
                              {searchProduct.name}
                            </div>
                            <div class="text-xs text-gray-500">SKU: {searchProduct.sku}</div>
                          </div>
                        </div>
                      </label>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Selected Related Products -->
              {#if productData.relatedProducts.length > 0}
                <div>
                  <p class="text-sm font-medium mb-2">
                    {t('product.selectedProducts')} ({productData.relatedProducts.length})
                  </p>
                  <div class="space-y-2">
                    {#each selectedRelatedProducts as selectedProduct}
                      <div
                        class="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded"
                      >
                        {#if selectedProduct.images && selectedProduct.images.length > 0}
                          {#if isVideoUrl(selectedProduct.images[0].url)}
                            <video
                              src={selectedProduct.images[0].url}
                              class="w-12 h-12 object-cover"
                              muted
                              playsinline
                              preload="metadata"
                            ></video>
                          {:else}
                            <img
                              src={selectedProduct.images[0].url}
                              alt={selectedProduct.images[0].alt || selectedProduct.name}
                              class="w-12 h-12 object-cover"
                            />
                          {/if}
                        {:else}
                          <div class="w-12 h-12 bg-gray-200 flex items-center justify-center">
                            <span class="text-xs text-gray-400">{t('product.noImage')}</span>
                          </div>
                        {/if}
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-black truncate">
                            {selectedProduct.name}
                          </div>
                          <div class="text-xs text-gray-500">SKU: {selectedProduct.sku}</div>
                        </div>
                        <button
                          type="button"
                          on:click={() => removeRelatedProduct(selectedProduct.id)}
                          class="text-red-500 hover:text-red-700 text-lg leading-none px-2"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else}
                <p class="text-xs text-accent-muted">{t('product.noRelatedProducts')}</p>
              {/if}
            {/if}
          </div>

          <!-- Filter Attributes -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="block text-sm font-medium mb-2">{t('product.material')}</p>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  bind:value={productData.material}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder={t('product.materialPlaceholder')}
                />
                <label class="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input type="checkbox" bind:checked={productData.hideMaterial} class="w-4 h-4" />
                  <span>{t('common.hide')}</span>
                </label>
              </div>
            </div>

            <div>
              <p class="block text-sm font-medium mb-2">{t('product.lining')}</p>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  bind:value={productData.lining}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder={t('product.liningPlaceholder')}
                />
                <label class="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input type="checkbox" bind:checked={productData.hideLining} class="w-4 h-4" />
                  <span>{t('common.hide')}</span>
                </label>
              </div>
            </div>

            <div>
              <label for="productApplication" class="block text-sm font-medium mb-2"
                >{t('product.application')} ({t('common.optional')})</label
              >
              <textarea
                id="productApplication"
                bind:value={productData.application}
                rows="3"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="e.g., Daily wear, Skin care"
              ></textarea>
            </div>

            <div>
              <p class="block text-sm font-medium mb-2">{t('product.countryOfOrigin')}</p>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  bind:value={productData.countryOfOrigin}
                  list="catalog-countries-list"
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder={t('product.countryPlaceholder')}
                />
                <label class="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input
                    type="checkbox"
                    bind:checked={productData.hideCountryOfOrigin}
                    class="w-4 h-4"
                  />
                  <span>{t('common.hide')}</span>
                </label>
              </div>
              <datalist id="catalog-countries-list">
                {#each catalogCountries as country}
                  <option value={country}></option>
                {/each}
              </datalist>
              {#if countryCatalogMatch}
                <p class="text-xs text-amber-600 mt-1">
                  {t('product.countryAlreadyInCatalog', { country: countryCatalogMatch })}
                </p>
              {/if}
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-4 sm:gap-6">
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={productData.isActive} class="w-4 h-4" />
              <span class="text-sm">{t('product.isActive')}</span>
            </label>

            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={productData.isFeatured} class="w-4 h-4" />
              <span class="text-sm">{t('product.isFeatured')}</span>
            </label>
          </div>
        </div>
      {/if}

      {#if formTab === 'media'}
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('product.imagesVideos')}</h3>

          <SortableMediaList
            items={images}
            onReorder={handleImagesReorder}
            onDelete={deleteImage}
            getAlt={(item) => getProductImageAlt(item.alt, product?.name ?? '')}
            isVideo={(url) => isVideoUrl(url)}
          />

          <!-- Modern Upload Zone -->
          <div
            class="relative border-2 border-dashed p-6 sm:p-12 text-center transition-all {isDragging
              ? 'border-black bg-black/5'
              : 'border-black/30 bg-white hover:border-black/50 hover:bg-black/5'}"
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            on:drop={handleDrop}
            role="button"
            tabindex="0"
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFileDialog();
              }
            }}
          >
            <input
              bind:this={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              on:change={handleImageSelect}
              class="hidden"
            />

            <div class="flex flex-col items-center justify-center">
              <svg
                class="w-16 h-16 text-black mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p class="text-base font-medium text-black mb-2">
                {t('product.dragFilesHere')}
                <button
                  type="button"
                  on:click={openFileDialog}
                  class="text-black underline font-semibold ml-1 hover:no-underline"
                >
                  {t('product.selectFiles')}
                </button>
              </p>
              <p class="text-sm text-black/60">
                {t('product.supportedFormats')}
              </p>
              <p class="text-xs text-black/40 mt-2">
                {t('product.maxFileSize')}
              </p>
            </div>
          </div>

          {#if newImagePreviews.length > 0}
            <div class="mt-6">
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm font-semibold text-black">
                  {t('product.selectedFiles')}: {newImagePreviews.length}
                </p>
                <button
                  type="button"
                  on:click={() => {
                    newImages = [];
                    newImagePreviews = [];
                    if (fileInputRef) fileInputRef.value = '';
                  }}
                  class="text-xs text-black underline hover:no-underline"
                >
                  {t('product.clearAll')}
                </button>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                {#each newImagePreviews as preview, index}
                  <div class="relative group">
                    {#if newImages[index]?.type.startsWith('image/')}
                      <img
                        src={preview}
                        alt="Preview {index + 1}"
                        class="w-full h-32 object-cover"
                      />
                    {:else if newImages[index]?.type.startsWith('video/')}
                      <div class="w-full h-32 bg-black flex items-center justify-center">
                        <svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
                          />
                        </svg>
                      </div>
                    {/if}
                    <button
                      type="button"
                      on:click={() => removeNewImage(index)}
                      class="absolute top-2 right-2 bg-black text-white w-6 h-6 flex items-center justify-center hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    <div
                      class="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-1 truncate"
                    >
                      {newImages[index]?.name || 'File'}
                    </div>
                  </div>
                {/each}
              </div>
              <button
                type="button"
                on:click={uploadNewImages}
                class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
              >
                {t('product.uploadFiles')}
              </button>
            </div>
          {/if}
        </div>
      {/if}

      {#if formTab === 'variants'}
        <div class="bg-dark-light p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-medium">{t('product.productVariants')}</h3>
            <button
              type="button"
              on:click={() => (bulkCreateMode = !bulkCreateMode)}
              class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
            >
              {bulkCreateMode ? t('product.cancelBulkCreate') : t('product.bulkCreateFromSizes')}
            </button>
          </div>

          {#if bulkCreateMode}
            <div class="mb-6 p-4 bg-white rounded border border-gray-300">
              <h4 class="font-medium mb-3">{t('product.createVariantsFromSizes')}</h4>
              <div class="space-y-4">
                <div>
                  <label for="bulkCreateBaseSku" class="block text-sm font-medium mb-1 text-black"
                    >{t('product.baseSkuRequired')}</label
                  >
                  <input
                    id="bulkCreateBaseSku"
                    type="text"
                    bind:value={bulkCreateBaseSku}
                    placeholder={t('product.baseSkuPlaceholder')}
                    class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  />
                  <p class="text-xs text-gray-500 mt-1">{t('product.bulkCreateSkuHint')}</p>
                </div>
                <div>
                  <label for="bulkCreateBasePrice" class="block text-sm font-medium mb-1 text-black"
                    >{t('product.basePriceOptional')}</label
                  >
                  <input
                    id="bulkCreateBasePrice"
                    type="number"
                    bind:value={bulkCreateBasePrice}
                    placeholder="Price for all variants"
                    min="0"
                    step="0.01"
                    class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    on:click={bulkCreateVariantsFromSizes}
                    class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
                  >
                    {t('product.createVariants')}
                  </button>
                  <span class="text-sm text-gray-500">
                    {#if selectedClothingSizes.length > 0 || selectedShoeSizes.length > 0 || customSizes.length > 0 || selectedVolumeSizes.length > 0 || selectedWeightSizes.length > 0 || customVolumeSizes.length > 0 || customWeightSizes.length > 0}
                      {t('product.willCreateVariants', {
                        count:
                          selectedClothingSizes.length +
                          selectedShoeSizes.length +
                          customSizes.length +
                          selectedVolumeSizes.length +
                          selectedWeightSizes.length +
                          customVolumeSizes.length +
                          customWeightSizes.length,
                      })}
                    {:else}
                      {t('product.noSizesSelected')}
                    {/if}
                  </span>
                </div>
              </div>
            </div>
          {/if}

          {#if variants.length > 0}
            <div class="mb-4 space-y-2">
              {#each variants as variant, index}
                <div class="flex items-center gap-4 p-4 bg-white rounded border border-gray-300">
                  <div class="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div class="text-xs text-gray-500 mb-1">Name</div>
                      <div class="font-medium text-black">{variant.name}</div>
                    </div>

                    <div>
                      <div class="text-xs text-gray-500 mb-1">SKU</div>
                      {#if editingVariant && editingVariant.id === variant.id}
                        <input
                          type="text"
                          bind:value={editingVariant.sku}
                          class="w-full px-2 py-1 bg-white border border-accent text-black text-sm"
                          on:keydown={(e) => {
                            if (e.key === 'Enter') {
                              saveVariantEdit();
                            } else if (e.key === 'Escape') {
                              cancelEditingVariant();
                            }
                          }}
                        />
                      {:else}
                        <div class="text-sm text-black font-mono">{variant.sku}</div>
                      {/if}
                    </div>

                    {#if variant.size}
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Size</div>
                        <div class="text-sm text-black font-medium">{variant.size}</div>
                      </div>
                    {/if}

                    <div>
                      <div class="text-xs text-gray-500 mb-1">Price</div>
                      {#if editingVariant && editingVariant.id === variant.id}
                        <input
                          type="number"
                          bind:value={editingVariant.price}
                          placeholder="Price"
                          min="0"
                          step="0.01"
                          class="w-full px-2 py-1 bg-white border border-accent text-black text-sm"
                          on:keydown={(e) => {
                            if (e.key === 'Enter') {
                              saveVariantEdit();
                            } else if (e.key === 'Escape') {
                              cancelEditingVariant();
                            }
                          }}
                        />
                      {:else}
                        <div class="text-sm text-black">
                          {variant.price ? `$${variant.price}` : '-'}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    {#if editingVariant && editingVariant.id === variant.id}
                      <button
                        type="button"
                        on:click={saveVariantEdit}
                        class="px-3 py-1 bg-green-500 text-white hover:bg-green-600 transition-colors text-sm"
                        title={t('common.save')}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        on:click={cancelEditingVariant}
                        class="px-3 py-1 bg-gray-400 text-white hover:bg-gray-500 transition-colors text-sm"
                        title={t('common.cancel')}
                      >
                        ✕
                      </button>
                    {:else}
                      <button
                        type="button"
                        on:click={() => startEditingVariant(variant)}
                        class="px-3 py-1 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
                        title={t('common.edit')}
                      >
                        {t('common.edit')}
                      </button>
                    {/if}

                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={variant.showOnProduct || false}
                        on:change={async (e) => {
                          const checked = e.currentTarget.checked;
                          try {
                            await adminApi.updateProductVariant(variant.id, {
                              showOnProduct: checked,
                            });
                            variants[index] = { ...variants[index], showOnProduct: checked };
                            variants = variants; // Trigger reactivity
                          } catch (error) {
                            notificationStore.error(
                              resolveApiError(error, 'product.failedToUpdateVariant')
                            );
                          }
                        }}
                        class="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent focus:ring-2"
                      />
                      <span class="text-xs">{t('common.show')}</span>
                    </label>

                    <button
                      type="button"
                      on:click={() => removeVariant(index)}
                      class="px-3 py-1 text-red-400 hover:text-red-300 text-sm"
                      title={t('common.remove')}
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <div class="space-y-4">
            <h4 class="font-medium text-sm text-gray-400">{t('product.addSingleVariant')}</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                bind:value={newVariant.name}
                placeholder={t('product.variantName')}
                class="px-4 py-2 bg-white border border-gray-300 text-black"
              />
              <input
                type="text"
                bind:value={newVariant.sku}
                placeholder={t('product.variantSku')}
                class="px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                bind:value={newVariant.size}
                placeholder={t('product.sizeOptional')}
                class="px-4 py-2 bg-white border border-gray-300 text-black"
              />
              <input
                type="number"
                bind:value={newVariant.price}
                placeholder={t('product.priceOptional')}
                min="0"
                step="0.01"
                class="px-4 py-2 bg-white border border-gray-300 text-black"
              />
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    bind:checked={newVariant.showOnProduct}
                    class="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent focus:ring-2"
                  />
                  <span class="text-sm">{t('product.showOnProduct')}</span>
                </label>
                <button
                  type="button"
                  on:click={addVariant}
                  class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors whitespace-nowrap"
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if formTab === 'stock'}
        <div class="bg-dark-light p-6 border border-dark space-y-6">
          <!-- Stock / Analytics sub-tabs -->
          <div class="flex gap-0.5 p-1 bg-gray-50 rounded-md border border-gray-200 w-fit mb-6">
            <button
              type="button"
              on:click={() => (activeTab = 'stock')}
              class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
              class:bg-white={activeTab === 'stock'}
              class:shadow-sm={activeTab === 'stock'}
              class:text-accent={activeTab === 'stock'}
              class:font-medium={activeTab === 'stock'}
              class:text-gray-500={activeTab !== 'stock'}
              class:hover:text-gray-700={activeTab !== 'stock'}
            >
              {t('warehouse.stockManagement')}
            </button>
            <button
              type="button"
              on:click={() => (activeTab = 'analytics')}
              class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
              class:bg-white={activeTab === 'analytics'}
              class:shadow-sm={activeTab === 'analytics'}
              class:text-accent={activeTab === 'analytics'}
              class:font-medium={activeTab === 'analytics'}
              class:text-gray-500={activeTab !== 'analytics'}
              class:hover:text-gray-700={activeTab !== 'analytics'}
            >
              {t('warehouse.analytics')}
            </button>
          </div>

          {#if activeTab === 'stock'}
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-medium mb-1">{t('product.stockByWarehouseSize')}</h3>
                <p class="text-sm text-accent-muted">{t('product.stockByWarehouseHint')}</p>
              </div>
              {#if loadingInventory}
                <span class="text-sm text-accent-muted">{t('common.loading')}</span>
              {/if}
            </div>

            {#if warehouses.length === 0}
              <p class="text-accent-muted">No warehouses available. Create warehouses first.</p>
            {:else}
              <!-- Product Info Header -->
              <div class="bg-white border border-gray-300 p-4 rounded mb-4">
                <div class="flex items-center gap-4">
                  {#if product.images && product.images.length > 0}
                    {#if isVideoUrl(product.images[0].url)}
                      <video
                        src={product.images[0].url}
                        class="w-16 h-16 object-cover border border-gray-300 rounded"
                        muted
                        playsinline
                        preload="metadata"
                      ></video>
                    {:else}
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        class="w-16 h-16 object-cover border border-gray-300 rounded"
                      />
                    {/if}
                  {/if}
                  <div>
                    <h4 class="font-semibold text-lg text-black">{product.name}</h4>
                    <p class="text-sm text-gray-600">SKU: {product.sku}</p>
                    {#if hasProductSizes(product.sizes)}
                      <div class="mt-2">
                        <p class="text-xs text-gray-500 mb-1">Sizes:</p>
                        <div class="flex flex-wrap gap-1">
                          {#each getProductSizeEntries(product.sizes) as sizeEntry}
                            <span class="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                              >{sizeEntry.display}</span
                            >
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="overflow-x-auto border border-dark">
                <table class="w-full">
                  <thead>
                    <tr class="bg-dark border-b border-dark">
                      <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                        >{t('product.productSize')}</th
                      >
                      <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                        >SKU</th
                      >
                      {#each warehouses as warehouse}
                        <th
                          class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                        >
                          <div class="flex items-center gap-2">
                            <span>{warehouse.name}</span>
                            <a
                              href="/admin/warehouses/{warehouse.id}"
                              class="text-accent hover:text-accent-muted text-xs"
                              title="View warehouse"
                            >
                              ↗
                            </a>
                          </div>
                        </th>
                      {/each}
                      <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                        >Actions</th
                      >
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-dark">
                    {#if variants.length > 0}
                      {#each variants as variant}
                        {@const variantId = variant.id}
                        <tr class="hover:bg-dark/50 transition-colors">
                          <td class="py-4 px-6">
                            <div>
                              <div class="font-medium text-black">{variant.name}</div>
                              {#if variant.name.includes('Size:')}
                                {@const sizeMatch = variant.name.match(/Size:\s*([^,]+)/)}
                                {#if sizeMatch}
                                  <div class="text-xs text-gray-500 mt-1">
                                    Size: <span class="font-medium">{sizeMatch[1].trim()}</span>
                                  </div>
                                {/if}
                              {/if}
                              {#if variant.size}
                                <div class="text-xs text-gray-500 mt-1">
                                  Size: <span class="font-medium">{variant.size}</span>
                                </div>
                              {/if}
                            </div>
                          </td>
                          <td class="py-4 px-6">
                            <code class="text-sm bg-dark px-2 py-1 text-accent-muted"
                              >{variant.sku}</code
                            >
                          </td>
                          {#each warehouses as warehouse}
                            {@const warehouseId = warehouse.id}
                            {@const inventoryItem = productInventory[warehouseId]?.find(
                              (inv) => inv.variantId === variantId
                            )}
                            <td class="py-4 px-6">
                              {#if editingStock && editingStock.variantId === variantId && editingStock.warehouseId === warehouseId}
                                <div
                                  class="bg-white border-2 border-accent p-3 rounded space-y-3 min-w-[200px]"
                                >
                                  <div>
                                    <label
                                      for={`stockQuantity-${variantId}-${warehouseId}`}
                                      class="block text-xs font-medium mb-1 text-black"
                                      >{t('common.quantity')}</label
                                    >
                                    <input
                                      id={`stockQuantity-${variantId}-${warehouseId}`}
                                      type="number"
                                      bind:value={newStockQuantity}
                                      min="0"
                                      step="1"
                                      class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                      placeholder="Enter quantity"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      for={`stockStatus-${variantId}-${warehouseId}`}
                                      class="block text-xs font-medium mb-1 text-black"
                                      >{t('common.status')}</label
                                    >
                                    <select
                                      id={`stockStatus-${variantId}-${warehouseId}`}
                                      bind:value={newStockStatus}
                                      class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                    >
                                      {#each Object.entries(statusLabels) as [status, label]}
                                        <option value={status}>{label}</option>
                                      {/each}
                                    </select>
                                  </div>
                                  <div class="flex gap-2">
                                    <button
                                      type="button"
                                      on:click={() => addOrUpdateStock(variantId, warehouseId)}
                                      class="flex-1 px-3 py-1.5 bg-accent text-dark text-sm hover:bg-accent-muted rounded font-medium"
                                    >
                                      {t('common.save')}
                                    </button>
                                    <button
                                      type="button"
                                      on:click={cancelEditingStock}
                                      class="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-black text-sm hover:bg-gray-100 rounded"
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  </div>
                                </div>
                              {:else}
                                <div class="space-y-2">
                                  <div class="flex items-baseline gap-2">
                                    <span class="text-lg font-bold text-black"
                                      >{inventoryItem?.quantity || 0}</span
                                    >
                                    <span class="text-xs text-gray-500">units</span>
                                    {#if inventoryItem && inventoryItem.reserved > 0}
                                      <span class="text-xs text-orange-600 font-medium"
                                        >({t('warehouse.reservedLabel')}
                                        {inventoryItem.reserved})</span
                                      >
                                    {/if}
                                  </div>
                                  {#if inventoryItem}
                                    <div>
                                      <span
                                        class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-200 text-gray-800 rounded"
                                      >
                                        {statusLabels[inventoryItem.status]}
                                      </span>
                                    </div>
                                  {:else}
                                    <span class="text-xs text-gray-400 italic">No stock</span>
                                  {/if}
                                  <button
                                    type="button"
                                    on:click={() => startEditingStock(variantId, warehouseId)}
                                    class="w-full mt-2 px-3 py-1.5 bg-accent text-dark text-xs hover:bg-accent-muted rounded font-medium transition-colors"
                                  >
                                    {inventoryItem ? t('product.editStock') : t('product.addStock')}
                                  </button>
                                </div>
                              {/if}
                            </td>
                          {/each}
                          <td class="py-4 px-6">
                            <div class="flex flex-col gap-1">
                              {#each warehouses as warehouse}
                                <a
                                  href="/admin/warehouses/{warehouse.id}"
                                  class="text-xs text-accent hover:text-accent-muted underline"
                                >
                                  {warehouse.name}
                                </a>
                              {/each}
                            </div>
                          </td>
                        </tr>
                      {/each}
                    {/if}

                    <!-- Show sizes that don't have variants yet -->
                    {#if hasProductSizes(product.sizes)}
                      {@const sizesWithVariants = new Set(
                        variants
                          .map((v) => {
                            // First check if variant has size field
                            if (v.size) return v.size;
                            // Otherwise try to extract from name
                            const match = v.name.match(/Size:\s*([^,]+)/);
                            if (match) return match[1].trim();
                            return null;
                          })
                          .filter(Boolean)
                      )}
                      {#each getProductSizeEntries(product.sizes).filter((entry) => !sizesWithVariants.has(entry.value)) as sizeEntry}
                        <tr class="hover:bg-dark/50 transition-colors">
                          <td class="py-4 px-6">
                            <div>
                              <div class="font-medium text-black">{product.name}</div>
                              <div class="text-xs text-gray-500 mt-1">
                                Size: <span class="font-medium">{sizeEntry.display}</span>
                                ({getSizeTypeLabel(sizeEntry.type)})
                              </div>
                            </div>
                          </td>
                          <td class="py-4 px-6">
                            <code class="text-sm bg-dark px-2 py-1 text-accent-muted"
                              >{product.sku}-{sizeEntry.value}</code
                            >
                          </td>
                          {#each warehouses as warehouse}
                            {@const warehouseId = warehouse.id}
                            {@const inventoryItem = findInventoryForSize(warehouseId, sizeEntry)}
                            <td class="py-4 px-6">
                              {#if editingStock && editingStock.variantId === sizeEntry.key && editingStock.warehouseId === warehouseId}
                                <div
                                  class="bg-white border-2 border-accent p-3 rounded space-y-3 min-w-[200px]"
                                >
                                  <div>
                                    <label
                                      for={`stockQuantity-${sizeEntry.key}-${warehouseId}`}
                                      class="block text-xs font-medium mb-1 text-black"
                                      >{t('common.quantity')}</label
                                    >
                                    <input
                                      id={`stockQuantity-${sizeEntry.key}-${warehouseId}`}
                                      type="number"
                                      bind:value={newStockQuantity}
                                      min="0"
                                      step="1"
                                      class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                      placeholder="Enter quantity"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      for={`stockStatus-${sizeEntry.key}-${warehouseId}`}
                                      class="block text-xs font-medium mb-1 text-black"
                                      >{t('common.status')}</label
                                    >
                                    <select
                                      id={`stockStatus-${sizeEntry.key}-${warehouseId}`}
                                      bind:value={newStockStatus}
                                      class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                    >
                                      {#each Object.entries(statusLabels) as [status, label]}
                                        <option value={status}>{label}</option>
                                      {/each}
                                    </select>
                                  </div>
                                  <div class="flex gap-2">
                                    <button
                                      type="button"
                                      on:click={() =>
                                        addOrUpdateStockForSize(
                                          sizeEntry.value,
                                          sizeEntry.type,
                                          warehouseId,
                                          sizeEntry.display
                                        )}
                                      class="flex-1 px-3 py-1.5 bg-accent text-dark text-sm hover:bg-accent-muted rounded font-medium"
                                    >
                                      {t('common.save')}
                                    </button>
                                    <button
                                      type="button"
                                      on:click={cancelEditingStock}
                                      class="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-black text-sm hover:bg-gray-100 rounded"
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  </div>
                                </div>
                              {:else}
                                <div class="space-y-2">
                                  <div class="flex items-baseline gap-2">
                                    <span class="text-lg font-bold text-black"
                                      >{inventoryItem?.quantity || 0}</span
                                    >
                                    <span class="text-xs text-gray-500">units</span>
                                    {#if inventoryItem && inventoryItem.reserved > 0}
                                      <span class="text-xs text-orange-600 font-medium"
                                        >({t('warehouse.reservedLabel')}
                                        {inventoryItem.reserved})</span
                                      >
                                    {/if}
                                  </div>
                                  {#if inventoryItem}
                                    <div>
                                      <span
                                        class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-200 text-gray-800 rounded"
                                      >
                                        {statusLabels[inventoryItem.status]}
                                      </span>
                                    </div>
                                  {:else}
                                    <span class="text-xs text-gray-400 italic">No stock</span>
                                  {/if}
                                  <button
                                    type="button"
                                    on:click={() =>
                                      startEditingStockForSize(
                                        sizeEntry.value,
                                        sizeEntry.type,
                                        warehouseId
                                      )}
                                    class="w-full mt-2 px-3 py-1.5 bg-accent text-dark text-xs hover:bg-accent-muted rounded font-medium transition-colors"
                                  >
                                    {inventoryItem ? t('product.editStock') : t('product.addStock')}
                                  </button>
                                </div>
                              {/if}
                            </td>
                          {/each}
                          <td class="py-4 px-6">
                            <div class="flex flex-col gap-1">
                              {#each warehouses as warehouse}
                                <a
                                  href="/admin/warehouses/{warehouse.id}"
                                  class="text-xs text-accent hover:text-accent-muted underline"
                                >
                                  {warehouse.name}
                                </a>
                              {/each}
                            </div>
                          </td>
                        </tr>
                      {/each}
                    {/if}

                    <!-- General stock (inventory without variants) - show if exists and product has sizes -->
                    {#if hasProductSizes(product.sizes)}
                      {@const hasGeneralStock = warehouses.some((wh) => {
                        const generalInventory = productInventory[wh.id]?.find(
                          (inv) => !inv.variantId
                        );
                        return generalInventory && generalInventory.quantity > 0;
                      })}
                      {#if hasGeneralStock}
                        <tr class="hover:bg-dark/50 transition-colors border-t-2 border-gray-600">
                          <td class="py-4 px-6">
                            <div>
                              <div class="font-medium text-black">{product.name}</div>
                              <div class="text-xs text-gray-500 mt-1">
                                {t('product.generalStockNoSize')}
                              </div>
                            </div>
                          </td>
                          <td class="py-4 px-6">
                            <code class="text-sm bg-dark px-2 py-1 text-accent-muted"
                              >{product.sku}</code
                            >
                          </td>
                          {#each warehouses as warehouse}
                            {@const warehouseId = warehouse.id}
                            {@const inventoryItem = productInventory[warehouseId]?.find(
                              (inv) => !inv.variantId
                            )}
                            <td class="py-4 px-6">
                              {#if editingStock && editingStock.variantId === 'no-variant' && editingStock.warehouseId === warehouseId}
                                <div
                                  class="bg-white border-2 border-accent p-3 rounded space-y-3 min-w-[200px]"
                                >
                                  <div>
                                    <label
                                      for={`stockQuantity-no-variant-${warehouseId}`}
                                      class="block text-xs font-medium mb-1 text-black"
                                      >{t('common.quantity')}</label
                                    >
                                    <input
                                      id={`stockQuantity-no-variant-${warehouseId}`}
                                      type="number"
                                      bind:value={newStockQuantity}
                                      min="0"
                                      step="1"
                                      class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                      placeholder="Enter quantity"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      for={`stockStatus-no-variant-${warehouseId}`}
                                      class="block text-xs font-medium mb-1 text-black"
                                      >{t('common.status')}</label
                                    >
                                    <select
                                      id={`stockStatus-no-variant-${warehouseId}`}
                                      bind:value={newStockStatus}
                                      class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                    >
                                      {#each Object.entries(statusLabels) as [status, label]}
                                        <option value={status}>{label}</option>
                                      {/each}
                                    </select>
                                  </div>
                                  <div class="flex gap-2">
                                    <button
                                      type="button"
                                      on:click={() => addOrUpdateStock(null, warehouseId)}
                                      class="flex-1 px-3 py-1.5 bg-accent text-dark text-xs hover:bg-accent-muted rounded font-medium transition-colors"
                                    >
                                      {t('common.save')}
                                    </button>
                                    <button
                                      type="button"
                                      on:click={() => (editingStock = null)}
                                      class="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-black text-xs hover:bg-gray-100 rounded font-medium transition-colors"
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  </div>
                                </div>
                              {:else}
                                <div class="space-y-2">
                                  <div class="flex items-baseline gap-2">
                                    <span class="text-lg font-bold text-black"
                                      >{inventoryItem?.quantity || 0}</span
                                    >
                                    <span class="text-xs text-gray-500">units</span>
                                    {#if inventoryItem && inventoryItem.reserved > 0}
                                      <span class="text-xs text-orange-600 font-medium"
                                        >({t('warehouse.reservedLabel')}
                                        {inventoryItem.reserved})</span
                                      >
                                    {/if}
                                  </div>
                                  {#if inventoryItem}
                                    <div>
                                      <span
                                        class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-200 text-gray-800 rounded"
                                      >
                                        {statusLabels[inventoryItem.status]}
                                      </span>
                                    </div>
                                  {:else}
                                    <span class="text-xs text-gray-400 italic">No stock</span>
                                  {/if}
                                  <button
                                    type="button"
                                    on:click={() => startEditingStock(null, warehouseId)}
                                    class="w-full mt-2 px-3 py-1.5 bg-accent text-dark text-xs hover:bg-accent-muted rounded font-medium transition-colors"
                                  >
                                    {inventoryItem ? t('product.editStock') : t('product.addStock')}
                                  </button>
                                </div>
                              {/if}
                            </td>
                          {/each}
                          <td class="py-4 px-6">
                            <div class="flex flex-col gap-1">
                              {#each warehouses as warehouse}
                                <a
                                  href="/admin/warehouses/{warehouse.id}"
                                  class="text-xs text-accent hover:text-accent-muted underline"
                                >
                                  {warehouse.name}
                                </a>
                              {/each}
                            </div>
                          </td>
                        </tr>
                      {/if}
                    {/if}

                    <!-- Product without variants and without sizes -->
                    {#if (!variants || variants.length === 0) && !hasProductSizes(product.sizes)}
                      <tr class="hover:bg-dark/50 transition-colors">
                        <td class="py-4 px-6">{product.name} (Base Product)</td>
                        <td class="py-4 px-6">
                          <code class="text-sm bg-dark px-2 py-1 text-accent-muted"
                            >{product.sku}</code
                          >
                        </td>
                        {#each warehouses as warehouse}
                          {@const warehouseId = warehouse.id}
                          {@const inventoryItem = productInventory[warehouseId]?.find(
                            (inv) => !inv.variantId
                          )}
                          <td class="py-4 px-6">
                            {#if editingStock && editingStock.variantId === 'no-variant' && editingStock.warehouseId === warehouseId}
                              <div
                                class="bg-white border-2 border-accent p-3 rounded space-y-3 min-w-[200px]"
                              >
                                <div>
                                  <label
                                    for={`stockQuantity-no-variant-${warehouseId}`}
                                    class="block text-xs font-medium mb-1 text-black"
                                    >{t('common.quantity')}</label
                                  >
                                  <input
                                    id={`stockQuantity-no-variant-${warehouseId}`}
                                    type="number"
                                    bind:value={newStockQuantity}
                                    min="0"
                                    step="1"
                                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                    placeholder="Enter quantity"
                                  />
                                </div>
                                <div>
                                  <label
                                    for={`stockStatus-no-variant-${warehouseId}`}
                                    class="block text-xs font-medium mb-1 text-black"
                                    >{t('common.status')}</label
                                  >
                                  <select
                                    id={`stockStatus-no-variant-${warehouseId}`}
                                    bind:value={newStockStatus}
                                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                                  >
                                    {#each Object.entries(statusLabels) as [status, label]}
                                      <option value={status}>{label}</option>
                                    {/each}
                                  </select>
                                </div>
                                <div class="flex gap-2">
                                  <button
                                    type="button"
                                    on:click={() => addOrUpdateStock(null, warehouseId)}
                                    class="flex-1 px-3 py-1.5 bg-accent text-dark text-sm hover:bg-accent-muted rounded font-medium"
                                  >
                                    {t('common.save')}
                                  </button>
                                  <button
                                    type="button"
                                    on:click={cancelEditingStock}
                                    class="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-black text-sm hover:bg-gray-100 rounded"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                </div>
                              </div>
                            {:else}
                              <div class="space-y-2">
                                <div class="flex items-baseline gap-2">
                                  <span class="text-lg font-bold text-black"
                                    >{inventoryItem?.quantity || 0}</span
                                  >
                                  <span class="text-xs text-gray-500">units</span>
                                  {#if inventoryItem && inventoryItem.reserved > 0}
                                    <span class="text-xs text-orange-600 font-medium"
                                      >({t('warehouse.reservedLabel')}
                                      {inventoryItem.reserved})</span
                                    >
                                  {/if}
                                </div>
                                {#if inventoryItem}
                                  <div>
                                    <span
                                      class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-200 text-gray-800 rounded"
                                    >
                                      {statusLabels[inventoryItem.status]}
                                    </span>
                                  </div>
                                {:else}
                                  <span class="text-xs text-gray-400 italic">No stock</span>
                                {/if}
                                <button
                                  type="button"
                                  on:click={() => startEditingStock(null, warehouseId)}
                                  class="w-full mt-2 px-3 py-1.5 bg-accent text-dark text-xs hover:bg-accent-muted rounded font-medium transition-colors"
                                >
                                  {inventoryItem ? t('product.editStock') : t('product.addStock')}
                                </button>
                              </div>
                            {/if}
                          </td>
                        {/each}
                        <td class="py-4 px-6">
                          <div class="flex flex-col gap-1">
                            {#each warehouses as warehouse}
                              <a
                                href="/admin/warehouses/{warehouse.id}"
                                class="text-xs text-accent hover:text-accent-muted underline"
                              >
                                {warehouse.name}
                              </a>
                            {/each}
                          </div>
                        </td>
                      </tr>
                    {/if}
                  </tbody>
                </table>
              </div>
            {/if}
          {/if}

          {#if activeTab === 'analytics'}
            {@const analytics = (() => {
              let totalStock = 0;
              let awaitingPayment = 0;
              let paid = 0;
              let returned = 0;
              let currentStock = 0;

              // Calculate analytics from inventory
              Object.values(productInventory).forEach((items) => {
                items.forEach((item) => {
                  const available = item.quantity - item.reserved;
                  totalStock += item.quantity;
                  currentStock += available;

                  // Count reserved items (in cart, awaiting payment)
                  awaitingPayment += item.reserved;

                  // Count by status from inventory items
                  if (item.items) {
                    item.items.forEach((invItem) => {
                      if (invItem.status === 'IN_DELIVERY' || invItem.status === 'DELIVERED') {
                        paid += invItem.quantity || 1;
                      } else if (invItem.status === 'RETURNED') {
                        returned += invItem.quantity || 1;
                      }
                    });
                  }
                });
              });

              return {
                totalStock,
                awaitingPayment,
                paid,
                returned,
                currentStock,
              };
            })()}

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div class="bg-white border border-gray-300 p-4 rounded">
                <div class="text-sm text-gray-500 mb-1">{t('warehouse.totalStock')}</div>
                <div class="text-2xl font-bold text-black">{analytics.totalStock}</div>
                <div class="text-xs text-gray-400 mt-1">{t('warehouse.allTimeReceived')}</div>
              </div>

              <div class="bg-white border border-gray-300 p-4 rounded">
                <div class="text-sm text-gray-500 mb-1">{t('warehouse.awaitingPayment')}</div>
                <div class="text-2xl font-bold text-orange-600">{analytics.awaitingPayment}</div>
                <div class="text-xs text-gray-400 mt-1">{t('warehouse.inCartReserved')}</div>
              </div>

              <div class="bg-white border border-gray-300 p-4 rounded">
                <div class="text-sm text-gray-500 mb-1">{t('warehouse.paidDelivered')}</div>
                <div class="text-2xl font-bold text-green-600">{analytics.paid}</div>
                <div class="text-xs text-gray-400 mt-1">{t('warehouse.soldItems')}</div>
              </div>

              <div class="bg-white border border-gray-300 p-4 rounded">
                <div class="text-sm text-gray-500 mb-1">{t('warehouse.returns')}</div>
                <div class="text-2xl font-bold text-red-600">{analytics.returned}</div>
                <div class="text-xs text-gray-400 mt-1">{t('warehouse.returnedItems')}</div>
              </div>

              <div class="bg-white border border-gray-300 p-4 rounded">
                <div class="text-sm text-gray-500 mb-1">{t('warehouse.currentStock')}</div>
                <div class="text-2xl font-bold text-blue-600">{analytics.currentStock}</div>
                <div class="text-xs text-gray-400 mt-1">{t('warehouse.availableForSale')}</div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="flex flex-col sm:flex-row gap-4">
        <button
          type="submit"
          disabled={loading}
          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 w-full sm:w-auto"
        >
          {loading ? t('product.updating') : t('product.updateProduct')}
        </button>
        <a
          href="/admin/products"
          class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black text-center w-full sm:w-auto"
        >
          {t('common.cancel')}
        </a>
      </div>
    </form>
  </div>
{/if}
