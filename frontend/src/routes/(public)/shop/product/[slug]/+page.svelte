<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import {
    productApi,
    type Product,
    type Brand,
    type ProductFilters,
    type ProductVariant,
  } from '$lib/api/product.api';
  import { categoryApi, type Category } from '$lib/api/category.api';
  import { cartStore } from '$lib/stores/cart.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { authStore } from '$lib/stores/auth.store';
  import { customerApi } from '$lib/api/customer.api';
  import { goto } from '$app/navigation';
  import { currencyStore } from '$lib/stores/currency.store';
  import { i18nStore } from '$lib/stores/i18n.store';
  import FilterSidebar from '$lib/components/FilterSidebar.svelte';
  import { t } from '$lib/utils/i18n';
  import { getErrorMessage } from '$lib/utils/error-handler';

  // Design components
  import ProductPageClassic from '$lib/components/product/ProductPageClassic.svelte';
  import ProductPageModern from '$lib/components/product/ProductPageModern.svelte';
  import ProductPageMinimalist from '$lib/components/product/ProductPageMinimalist.svelte';
  import ProductPageGrid from '$lib/components/product/ProductPageGrid.svelte';
  import ProductPageGridSkeleton from '$lib/components/product/ProductPageGridSkeleton.svelte';
  import CompleteTheLook from '$lib/components/product/CompleteTheLook.svelte';
  import ProductSectionGrid from '$lib/components/product/ProductSectionGrid.svelte';
  import LazyComponent from '$lib/components/LazyComponent.svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';

  let product: Product | null = null;
  let allProductVariants: ProductVariant[] = []; // Store all variants for price calculation
  let loading = true;
  let error = '';
  let selectedImageIndex = 0;
  let selectedVariant: string | undefined = undefined;
  let selectedSize: string | null = null;
  let quantity = 1;
  let isInWishlist = false;
  let wishlistLoading = false;

  // Touch/swipe handling
  let touchStartX = 0;
  let touchEndX = 0;
  let imageContainer: HTMLDivElement;

  // Design selection
  let productPageDesign: 'classic' | 'modern' | 'minimalist' | 'grid' = 'classic';
  let designKnown = false;

  // Size Chart
  let sizeChartData: any = null;
  let sizeChartEnabled = false;

  // Recommendation sections (You might like, You viewed)
  let youMightLikeProducts: Product[] = [];
  let youViewedProducts: Product[] = [];

  // Filter sidebar state
  let mobileFiltersOpen = false;
  let allCategories: Category[] = [];
  let brands: Brand[] = [];
  let selectedCategory = '';
  let selectedBrand = '';
  let minPrice = '';
  let maxPrice = '';
  let searchQuery = '';
  let selectedColor = '';
  let selectedMaterial = '';
  let selectedCountryOfOrigin = '';
  let selectedInventoryStatus: '' | 'IN_SALE' | 'COMING_SOON' | 'OUT_OF_STOCK' = '';
  let availableColors: string[] = [];
  let availableMaterials: string[] = [];
  let availableCountries: string[] = [];
  let sortField: 'price' | 'createdAt' | 'name' = 'createdAt';
  let isBackNavigating = false;
  let backNavigationTimer: ReturnType<typeof setTimeout> | null = null;
  const BACK_NAVIGATION_DURATION = 460;

  $: slug = $page.params.slug;
  $: currentLanguage = $i18nStore;

  // SEO meta tags
  $: seoTitle = product?.metaTitle || product?.name || 'Product';
  $: seoDescription = product?.metaDescription || product?.description || '';
  $: seoKeywords = product?.metaKeywords || '';
  $: hasDescription = !!product && !!seoDescription;
  $: hasKeywords = !!product && !!seoKeywords;
  $: hasImage = (product?.images?.length ?? 0) > 0;

  // Function to check wishlist status
  async function checkWishlistStatus() {
    if (!$authStore.isAuthenticated || !$settingsStore.wishlistEnabled || !product) {
      isInWishlist = false;
      return;
    }

    try {
      const wishlistCheck = await customerApi.checkWishlist(product.id);
      isInWishlist = wishlistCheck.isInWishlist;
    } catch (e) {
      // Silently fail - wishlist check is optional
      console.error('Failed to check wishlist:', e);
      isInWishlist = false;
    }
  }

  async function loadCategories() {
    try {
      const response = await categoryApi.getAll(false, true);
      allCategories = response.categories.filter((c) => {
        const slugLower = c.slug?.toLowerCase() || '';
        const nameLower = c.name?.toLowerCase() || '';
        return slugLower !== 'lookbook' && nameLower !== 'lookbook';
      });
    } catch (e) {
      console.error('Failed to load categories:', e);
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

  async function extractFilterValues() {
    try {
      const sampleFilters: ProductFilters = {
        isActive: true,
      };

      if (selectedCategory) {
        sampleFilters.categoryId = selectedCategory;
      }

      const sampleResponse = await productApi.getAll(1, 100, sampleFilters);
      const allProducts = sampleResponse.products;

      const colors = new Set<string>();
      const materials = new Set<string>();
      const countries = new Set<string>();

      allProducts.forEach((product) => {
        if (!product.hideColor && product.colors && product.colors.length > 0) {
          product.colors.forEach((c) => {
            if (c?.name) colors.add(c.name);
          });
        }
        if (product.material && !product.hideMaterial) {
          materials.add(product.material);
        }
        if (product.countryOfOrigin && !product.hideCountryOfOrigin) {
          countries.add(product.countryOfOrigin);
        }
      });

      availableColors = Array.from(colors).sort();
      availableMaterials = Array.from(materials).sort();
      availableCountries = Array.from(countries).sort();
    } catch (e) {
      console.error('Failed to extract filter values:', e);
    }
  }

  function toggleMobileFilters() {
    mobileFiltersOpen = !mobileFiltersOpen;
  }

  function closeMobileFilters() {
    mobileFiltersOpen = false;
  }

  function handleFilterSidebarChange() {
    // Navigate to shop with filters
    const params = new URLSearchParams();

    // Use category slug if available, otherwise use ID
    if (selectedCategory) {
      const category = allCategories.find((c) => c.id === selectedCategory);
      if (category?.slug) {
        params.set('category', category.slug);
      } else {
        params.set('category', selectedCategory);
      }
    }

    if (selectedBrand) params.set('brand', selectedBrand);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (searchQuery) params.set('search', searchQuery);
    if (selectedColor) params.set('color', selectedColor);
    if (selectedMaterial) params.set('material', selectedMaterial);
    if (selectedCountryOfOrigin) params.set('country', selectedCountryOfOrigin);
    if (selectedInventoryStatus) params.set('inventoryStatus', selectedInventoryStatus);

    const queryString = params.toString();
    goto(`/shop${queryString ? '?' + queryString : ''}`);
  }

  function handleFilterSidebarSortChange(event: CustomEvent<{ value: string | number }>) {
    // Handle sort change if needed
  }

  async function handleBackNavigation() {
    if (!browser || isBackNavigating) return;

    isBackNavigating = true;
    await tick();

    backNavigationTimer = setTimeout(async () => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      await goto('/shop');
    }, BACK_NAVIGATION_DURATION);
  }

  // Track which slug we've loaded so we can reload when user navigates to another product (same route, param change)
  let currentLoadedSlug: string | null = null;
  let currentLoadedLanguage: string | null = null;

  async function loadProductData(slugParam: string) {
    currentLoadedSlug = slugParam;
    currentLoadedLanguage = currentLanguage || null;
    loading = true;
    product = null;
    error = '';
    selectedImageIndex = 0;
    selectedVariant = undefined;
    selectedSize = null;
    quantity = 1;
    youMightLikeProducts = [];
    youViewedProducts = [];

    try {
      const response = await productApi.getBySlug(slugParam, currentLanguage);
      if (currentLoadedSlug !== slugParam) return;
      product = response.product;

      if (browser && product?.id) {
        const key = 'recentlyViewedProductIds';
        let ids: string[] = [];
        try {
          const raw = localStorage.getItem(key);
          if (raw) ids = JSON.parse(raw);
        } catch (_) {}
        ids = [product.id, ...ids.filter((id) => id !== product!.id)].slice(0, 20);
        localStorage.setItem(key, JSON.stringify(ids));
      }

      try {
        const yml = await settingsStore.getSetting('productPageYouMightLikeEnabled');
        const ymlMode = await settingsStore.getSetting('productPageYouMightLikeMode');
        const yv = await settingsStore.getSetting('productPageYouViewedEnabled');
        if (yml && product?.id) {
          if (
            ymlMode === 'smart' &&
            product.relatedProducts &&
            product.relatedProducts.length > 0
          ) {
            const res = await Promise.all(
              product.relatedProducts.map((id) => productApi.getById(id, currentLanguage))
            );
            if (currentLoadedSlug !== slugParam) return;
            youMightLikeProducts = res.map((r) => r.product).filter((p) => p.isActive);
          } else {
            const sim = await productApi.getSimilar(product.id, 8);
            if (currentLoadedSlug !== slugParam) return;
            youMightLikeProducts = sim.products || [];
          }
        }
        if (yv && product?.id && browser) {
          const key = 'recentlyViewedProductIds';
          let ids: string[] = [];
          try {
            const raw = localStorage.getItem(key);
            if (raw) ids = JSON.parse(raw);
          } catch (_) {}
          const cart = get(cartStore);
          const cartIds = new Set((cart.items || []).map((i) => i.product?.id).filter(Boolean));
          ids = ids.filter((id) => id !== product!.id && !cartIds.has(id)).slice(0, 8);
          if (ids.length > 0) {
            const res = await Promise.all(ids.map((id) => productApi.getById(id, currentLanguage)));
            if (currentLoadedSlug !== slugParam) return;
            youViewedProducts = res.map((r) => r.product).filter((p) => p.isActive);
          }
        }
      } catch (e) {
        console.error('Failed to load recommendation sections:', e);
      }

      if (currentLoadedSlug !== slugParam) return;
      allProductVariants = product.variants || [];
      if (product.variants && product.variants.length > 0) {
        product.variants = product.variants.filter((v) => v.showOnProduct === true);
        if (product.variants.length > 0) {
          selectedVariant = product.variants[0].id;
        }
      }

      await checkWishlistStatus();
      if (currentLoadedSlug !== slugParam) return;
      await extractFilterValues();
      initialLoadComplete = true;
    } catch (e) {
      if (currentLoadedSlug === slugParam) {
        error = getErrorMessage(e, 'product.failedToLoad');
        console.error('Failed to load product:', e);
        initialLoadComplete = true;
      }
    } finally {
      if (currentLoadedSlug === slugParam) loading = false;
    }
  }

  onMount(async () => {
    try {
      try {
        const design = await settingsStore.getSetting('productPageDesign');
        if (design && typeof design === 'string') {
          productPageDesign = design as 'classic' | 'modern' | 'minimalist' | 'grid';
        }
        designKnown = true;
      } catch (e) {
        console.error('Failed to load product page design:', e);
        designKnown = true;
      }
      await Promise.all([loadCategories(), loadBrands()]);
      try {
        const sizeChart = await settingsStore.getSetting('sizeChart');
        if (sizeChart && typeof sizeChart === 'object') {
          const chart = sizeChart as Record<string, unknown>;
          sizeChartData = chart;
          sizeChartEnabled = chart.enabled === true;
        }
      } catch (e) {
        console.error('Failed to load size chart:', e);
      }
      await loadProductData(slug);
    } catch (e) {
      error = getErrorMessage(e, 'product.failedToLoad');
      console.error('Failed to load product:', e);
      initialLoadComplete = true;
      loading = false;
    }
  });

  onDestroy(() => {
    if (backNavigationTimer) {
      clearTimeout(backNavigationTimer);
      backNavigationTimer = null;
    }
  });

  // When navigating to another product (same route, slug param change), reload product data.
  // Only when currentLoadedSlug was already set (skip first load — that's done in onMount).
  $: if (browser && slug && currentLoadedSlug != null && currentLoadedSlug !== slug) {
    loadProductData(slug);
  }

  $: if (
    browser &&
    slug &&
    currentLoadedSlug === slug &&
    currentLoadedLanguage !== null &&
    currentLoadedLanguage !== currentLanguage
  ) {
    loadProductData(slug);
  }

  // Update wishlist status when auth state changes (only after initial load)
  let initialLoadComplete = false;
  $: if (initialLoadComplete && product && $authStore.isAuthenticated !== undefined) {
    checkWishlistStatus();
  }

  function selectImage(index: number) {
    if (product?.images && index >= 0 && index < product.images.length) {
      selectedImageIndex = index;
    }
  }

  function nextImage() {
    if (product?.images && selectedImageIndex < product.images.length - 1) {
      selectedImageIndex++;
    }
  }

  function prevImage() {
    if (selectedImageIndex > 0) {
      selectedImageIndex--;
    }
  }

  // Touch/swipe handlers
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }

  function handleSwipe() {
    const swipeThreshold = 50; // Minimum distance for swipe
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - next image
        nextImage();
      } else {
        // Swipe right - previous image
        prevImage();
      }
    }
  }

  $: hasNext = selectedImageIndex < (product?.images?.length ?? 0) - 1;
  $: hasPrev = selectedImageIndex > 0;

  async function addToCart(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log('addToCart function called', { product, selectedSize, quantity });

    if (!product) {
      console.error('addToCart: No product available');
      return;
    }

    const normalizedSelectedSize = selectedSize
      ? extractSize(selectedSize)?.trim().toLowerCase()
      : null;
    const isSelectedSizeComingSoon = normalizedSelectedSize
      ? (product.comingSoonSizes || []).some(
          (size) => size.trim().toLowerCase() === normalizedSelectedSize
        )
      : false;

    if (product.isComingSoon || isSelectedSizeComingSoon) {
      notificationStore.error(t('productPage.comingSoon'));
      return;
    }

    // Check if size is required and selected
    // Check if product has any sizes (CLOTHING, SHOES, or CUSTOM)
    const hasAnySizes =
      product.sizes &&
      ((product.sizes.CLOTHING && product.sizes.CLOTHING.length > 0) ||
        (product.sizes.SHOES && product.sizes.SHOES.length > 0) ||
        (product.sizes.CUSTOM && product.sizes.CUSTOM.length > 0));

    if (hasAnySizes && (!selectedSize || selectedSize === null || selectedSize === '')) {
      console.log('addToCart: Size required but not selected');
      notificationStore.error(t('productPage.pleaseSelectSize'));
      return;
    }

    // Convert selectedSize to string if it exists, otherwise undefined
    const sizeToSend =
      selectedSize && selectedSize !== null && selectedSize !== ''
        ? String(selectedSize).trim()
        : undefined;

    // Validate stock availability for the selected size
    if (sizeToSend) {
      try {
        const stockResponse = await productApi.getAvailableStock(product.id, sizeToSend);
        const availableStock = stockResponse.availableStock || 0;

        if (availableStock === 0) {
          notificationStore.error(t('productPage.sizeOutOfStock', { size: sizeToSend }));
          return;
        }

        if (quantity > availableStock) {
          notificationStore.error(
            t('productPage.onlyAvailableQuantity', { count: availableStock, size: sizeToSend })
          );
          return;
        }
      } catch (error) {
        console.error('Failed to check available stock:', error);
        // Continue with adding to cart if stock check fails (don't block user)
      }
    }

    try {
      // Debug: log what we're sending
      console.log('Adding to cart:', {
        productId: product.id,
        quantity,
        variantId: selectedVariant,
        selectedSize: selectedSize,
        sizeToSend: sizeToSend,
        sizeType: typeof selectedSize,
        hasSizes: hasAnySizes,
      });

      if (!sizeToSend && hasAnySizes) {
        console.error('ERROR: Size is required but not provided!', {
          selectedSize,
          sizeToSend,
          sizes: product.sizes,
        });
        notificationStore.error(t('productPage.pleaseSelectSize'));
        return;
      }

      console.log('Calling cartStore.add...');
      await cartStore.add(product.id, quantity, selectedVariant, sizeToSend);
      console.log('cartStore.add completed successfully');
      /* Cart drawer opens automatically via lastAddedToCartStore */
    } catch (e) {
      console.error('addToCart error:', e);
      const errorMessage = e instanceof Error ? e.message : t('notification.failedToAddToBag');
      notificationStore.error(errorMessage);
    }
  }

  async function toggleWishlist() {
    if (!product) return;

    // Check if user is authenticated
    if (!$authStore.isAuthenticated) {
      notificationStore.error(t('wishlist.loginToAdd'));
      goto('/login');
      return;
    }

    // Check if wishlist is enabled
    if (!$settingsStore.wishlistEnabled) {
      notificationStore.error(t('wishlist.wishlistDisabled'));
      return;
    }

    wishlistLoading = true;
    try {
      if (isInWishlist) {
        await customerApi.removeFromWishlist(product.id);
        isInWishlist = false;
        notificationStore.success(t('wishlist.removedFromWishlist'));
      } else {
        await customerApi.addToWishlist(product.id);
        isInWishlist = true;
        notificationStore.success(t('wishlist.addedToWishlist'));
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update wishlist';
      notificationStore.error(errorMessage);
    } finally {
      wishlistLoading = false;
    }
  }

  // Helper function to extract size from selectedSize (handles formats like "CLOTHING:S", "SHOES:38", "CUSTOM:value", or just "S")
  function extractSize(selectedSize: string | null): string | null {
    if (!selectedSize) return null;
    // If it contains a colon, extract the part after the colon
    if (selectedSize.includes(':')) {
      return selectedSize.split(':')[1];
    }
    return selectedSize;
  }

  $: currentImage = product?.images?.[selectedImageIndex];

  // Calculate current price based on selected size variant, selected variant, or base product price
  $: currentPrice = (() => {
    if (!product) return 0;

    if (product.priceOnRequest || !product.price) {
      return 0;
    }

    const basePrice =
      typeof product.price === 'number'
        ? product.price
        : typeof product.price === 'string'
          ? parseFloat(product.price)
          : 0;

    if (isNaN(basePrice)) {
      return 0;
    }

    // Priority 1: If size is selected, find variant with matching size and use its price if available
    // Use allProductVariants (not filtered) to find price for any size variant
    if (selectedSize && allProductVariants && allProductVariants.length > 0) {
      const selectedSizeValue = selectedSize;
      const extractedSize = extractSize(selectedSize);

      if (extractedSize) {
        const sizeVariant = allProductVariants.find((v) => {
          if (!v) return false;

          // Check exact match on size field (case-insensitive)
          const vSize = v.size ? v.size.trim() : '';
          const extractedSizeTrimmed = extractedSize.trim();
          const selectedSizeTrimmed = selectedSizeValue.trim();

          if (
            vSize.toLowerCase() === extractedSizeTrimmed.toLowerCase() ||
            vSize.toLowerCase() === selectedSizeTrimmed.toLowerCase()
          ) {
            return true;
          }

          // Check variant name for size
          if (v.name) {
            const nameLower = v.name.toLowerCase();
            const sizeLower = extractedSizeTrimmed.toLowerCase();
            if (
              nameLower.includes(`size: ${sizeLower}`) ||
              nameLower.includes(`size:${sizeLower}`) ||
              nameLower.includes(` - size: ${sizeLower}`) ||
              nameLower.endsWith(` size: ${sizeLower}`) ||
              nameLower.endsWith(` - ${sizeLower}`)
            ) {
              return true;
            }
          }
          return false;
        });

        if (sizeVariant?.price) {
          const variantPrice =
            typeof sizeVariant.price === 'number'
              ? sizeVariant.price
              : typeof sizeVariant.price === 'string'
                ? parseFloat(sizeVariant.price)
                : 0;

          if (!isNaN(variantPrice) && variantPrice > 0) {
            return variantPrice;
          }
        }
      }
    }

    // Priority 2: Use selected variant price if available
    // Use allProductVariants to find price even if variant is not shown
    if (selectedVariant && allProductVariants && allProductVariants.length > 0) {
      const variant = allProductVariants.find((v) => v && v.id === selectedVariant);
      if (variant?.price) {
        const variantPrice =
          typeof variant.price === 'number'
            ? variant.price
            : typeof variant.price === 'string'
              ? parseFloat(variant.price)
              : 0;

        if (!isNaN(variantPrice) && variantPrice > 0) {
          return variantPrice;
        }
      }
    }

    // Priority 3: Use base product price
    return basePrice;
  })();

  // Reactive to currency changes
  $: currentCurrency = $currencyStore;
</script>

<svelte:head>
  <title>{product ? seoTitle + ' | ' : 'Product | '}</title>
  {#if hasDescription}
    <meta name="description" content={seoDescription} />
  {/if}
  {#if hasKeywords}
    <meta name="keywords" content={seoKeywords} />
  {/if}
  {#if product}
    <meta property="og:type" content="product" />
    <meta property="og:title" content={seoTitle} />
    {#if hasDescription}
      <meta property="og:description" content={seoDescription} />
    {/if}
    {#if hasImage}
      <meta property="og:image" content={product.images?.[0]?.url ?? ''} />
    {/if}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={seoTitle} />
    {#if hasDescription}
      <meta name="twitter:description" content={seoDescription} />
    {/if}
    {#if hasImage}
      <meta name="twitter:image" content={product.images?.[0]?.url ?? ''} />
    {/if}
  {/if}
</svelte:head>

<main
  class="min-h-screen bg-white overflow-x-hidden relative product-page-shell"
  class:product-page-shell--back-nav={isBackNavigating}
  style="isolation: isolate;"
>
  <div
    class={productPageDesign === 'grid'
      ? 'relative flex w-full px-4 sm:px-6 lg:px-0 py-1'
      : 'container-custom py-1 relative flex'}
  >
    <!-- Filter Sidebar -->
    {#if $settingsStore.filtersEnabled || $settingsStore.searchEnabled}
      <FilterSidebar
        categories={allCategories}
        {brands}
        bind:selectedCategory
        bind:selectedBrand
        bind:minPrice
        bind:maxPrice
        bind:searchQuery
        bind:selectedColor
        bind:selectedMaterial
        bind:selectedCountryOfOrigin
        bind:selectedInventoryStatus
        {availableColors}
        {availableMaterials}
        {availableCountries}
        bind:sortField
        open={mobileFiltersOpen}
        mobile={true}
        on:filterChange={handleFilterSidebarChange}
        on:sortChange={handleFilterSidebarSortChange}
        on:close={closeMobileFilters}
      />
    {/if}

    <!-- Main Content Area -->
    <div
      class="flex-1 transition-all duration-[400ms] ease-in-out {mobileFiltersOpen
        ? 'md:ml-20'
        : ''} relative"
    >
      <!-- Navigation buttons for non-grid designs -->
      {#if productPageDesign !== 'grid'}
        <!-- Mobile: above content — back (left) + MENU (right) -->
        <div
          class="mb-8 lg:hidden flex items-center justify-between {mobileFiltersOpen
            ? 'hidden'
            : ''}"
        >
          <button
            type="button"
            on:click={handleBackNavigation}
            class="inline-flex items-center gap-2 px-4 py-2 border border-black hover:bg-gray-50 transition-colors whitespace-nowrap text-sm font-medium bg-white"
            aria-label={t('common.back')}
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>{t('common.back')}</span>
          </button>
          {#if $settingsStore.filtersEnabled || $settingsStore.searchEnabled}
            <button
              on:click={toggleMobileFilters}
              class="inline-flex items-center gap-2 px-4 py-2 border border-black hover:bg-gray-50 transition-colors whitespace-nowrap text-sm font-medium bg-white"
              aria-label={t('productPage.menu')}
            >
              {t('productPage.menu')}
            </button>
          {/if}
        </div>
        <!-- Desktop: fixed next to content -->
        <div
          class="hidden lg:flex absolute lg:left-8 top-8 items-center gap-3 {mobileFiltersOpen
            ? 'lg:hidden'
            : ''}"
          style="z-index: 50;"
        >
          <button
            type="button"
            on:click={handleBackNavigation}
            class="inline-flex items-center gap-2 px-4 py-2 border border-black hover:bg-gray-50 transition-colors whitespace-nowrap text-sm font-medium bg-white"
            aria-label={t('common.back')}
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>{t('common.back')}</span>
          </button>
          {#if $settingsStore.filtersEnabled || $settingsStore.searchEnabled}
            <button
              on:click={toggleMobileFilters}
              class="inline-flex items-center gap-2 px-4 py-2 border border-black hover:bg-gray-50 transition-colors whitespace-nowrap text-sm font-medium bg-white"
              aria-label={t('productPage.menu')}
            >
              {t('productPage.menu')}
            </button>
          {/if}
        </div>
      {/if}

      {#if loading}
        {#if !designKnown}
          <div class="min-h-[80vh] w-full" aria-hidden="true"></div>
        {:else if productPageDesign === 'grid'}
          <ProductPageGridSkeleton />
        {:else}
          <div class="min-h-screen flex items-center justify-center">
            <div class="w-full max-w-4xl mx-auto px-4">
              <div class="animate-pulse space-y-8">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div class="space-y-4">
                    <div class="aspect-square bg-gray-200 rounded-lg"></div>
                    <div class="flex gap-2">
                      {#each Array(4) as _}
                        <div class="w-20 h-20 bg-gray-200 rounded"></div>
                      {/each}
                    </div>
                  </div>
                  <div class="space-y-6">
                    <div class="space-y-2">
                      <div class="h-8 bg-gray-200 rounded w-3/4"></div>
                      <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div class="h-6 bg-gray-200 rounded w-1/4"></div>
                    </div>
                    <div class="space-y-2">
                      <div class="h-4 bg-gray-200 rounded"></div>
                      <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                      <div class="h-4 bg-gray-200 rounded w-4/6"></div>
                    </div>
                    <div class="space-y-4">
                      <div class="h-10 bg-gray-200 rounded"></div>
                      <div class="flex gap-2">
                        {#each Array(5) as _}
                          <div class="h-10 w-10 bg-gray-200 rounded"></div>
                        {/each}
                      </div>
                    </div>
                    <div class="space-y-2">
                      <div class="h-12 bg-gray-200 rounded"></div>
                      <div class="h-12 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {:else if error}
        <div class="min-h-screen flex items-center justify-center">
          <p class="text-red-400">Error: {error}</p>
        </div>
      {:else if !product}
        <div class="min-h-screen flex items-center justify-center">
          <p class="text-accent-muted">{t('productPage.productNotFound')}</p>
        </div>
      {:else if productPageDesign === 'classic'}
        <div class="lg:pl-60">
          <ProductPageClassic
            {product}
            {selectedImageIndex}
            {selectedVariant}
            bind:selectedSize
            {quantity}
            {isInWishlist}
            {wishlistLoading}
            {currentPrice}
            {currentImage}
            {hasNext}
            {hasPrev}
            bind:imageContainer
            {selectImage}
            {nextImage}
            {prevImage}
            {handleTouchStart}
            {handleTouchEnd}
            {addToCart}
            {toggleWishlist}
            {sizeChartData}
            {sizeChartEnabled}
          />
        </div>
      {:else if productPageDesign === 'modern'}
        <div class="lg:pl-60">
          <ProductPageModern
            {product}
            {selectedImageIndex}
            {selectedVariant}
            bind:selectedSize
            {quantity}
            {isInWishlist}
            {wishlistLoading}
            {currentPrice}
            {currentImage}
            {hasNext}
            {hasPrev}
            bind:imageContainer
            {selectImage}
            {nextImage}
            {prevImage}
            {handleTouchStart}
            {handleTouchEnd}
            {addToCart}
            {toggleWishlist}
            {sizeChartData}
            {sizeChartEnabled}
          />
        </div>
      {:else if productPageDesign === 'minimalist'}
        <div class="lg:pl-60">
          <ProductPageMinimalist
            {product}
            {selectedImageIndex}
            {selectedVariant}
            bind:selectedSize
            {quantity}
            {isInWishlist}
            {wishlistLoading}
            {currentPrice}
            {currentImage}
            {hasNext}
            {hasPrev}
            bind:imageContainer
            {selectImage}
            {nextImage}
            {prevImage}
            {handleTouchStart}
            {handleTouchEnd}
            {addToCart}
            {toggleWishlist}
            {sizeChartData}
            {sizeChartEnabled}
          />
        </div>
      {:else if productPageDesign === 'grid'}
        <ProductPageGrid
          {product}
          {selectedImageIndex}
          {selectedVariant}
          bind:selectedSize
          {quantity}
          {isInWishlist}
          {wishlistLoading}
          {currentPrice}
          {currentImage}
          {hasNext}
          {hasPrev}
          bind:imageContainer
          {selectImage}
          {nextImage}
          {prevImage}
          {handleTouchStart}
          {handleTouchEnd}
          {addToCart}
          {toggleWishlist}
          {sizeChartData}
          {sizeChartEnabled}
          showMenuButton={$settingsStore.filtersEnabled || $settingsStore.searchEnabled}
          {toggleMobileFilters}
          {mobileFiltersOpen}
          onBack={handleBackNavigation}
        />
      {:else}
        <!-- Fallback to classic -->
        <div class="lg:pl-60">
          <ProductPageClassic
            {product}
            {selectedImageIndex}
            {selectedVariant}
            bind:selectedSize
            {quantity}
            {isInWishlist}
            {wishlistLoading}
            {currentPrice}
            {currentImage}
            {hasNext}
            {hasPrev}
            bind:imageContainer
            {selectImage}
            {nextImage}
            {prevImage}
            {handleTouchStart}
            {handleTouchEnd}
            {addToCart}
            {toggleWishlist}
            {sizeChartData}
            {sizeChartEnabled}
          />
        </div>
      {/if}

      <!-- Complete the Look Section (global + per-product) -->
      {#if product && $settingsStore.productPageCompleteTheLookEnabled !== false && (product.showCompleteTheLook ?? true) && product.relatedProducts && product.relatedProducts.length > 0}
        <div class="px-8">
          <LazyComponent rootMargin="300px" placeholderHeight="400px">
            <CompleteTheLook
              relatedProductIds={product.relatedProducts}
              showCompleteTheLook={product.showCompleteTheLook ?? true}
            />
          </LazyComponent>
        </div>
      {/if}

      <!-- You might like -->
      {#if product && $settingsStore.productPageYouMightLikeEnabled !== false && youMightLikeProducts.length > 0}
        <div class="px-8">
          <LazyComponent rootMargin="300px" placeholderHeight="400px">
            <ProductSectionGrid
              sectionTitle={t('product.youMightLike')}
              products={youMightLikeProducts}
            />
          </LazyComponent>
        </div>
      {/if}

      <!-- You viewed -->
      {#if product && $settingsStore.productPageYouViewedEnabled !== false && youViewedProducts.length > 0}
        <div class="px-8">
          <LazyComponent rootMargin="300px" placeholderHeight="400px">
            <ProductSectionGrid
              sectionTitle={t('product.youViewed')}
              products={youViewedProducts}
            />
          </LazyComponent>
        </div>
      {/if}
    </div>
  </div>
</main>

<style>
  .product-page-shell {
    transform-origin: center top;
  }

  .product-page-shell--back-nav {
    pointer-events: none;
    animation: product-page-back-nav 460ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes product-page-back-nav {
    0% {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1) skewX(0deg);
      filter: blur(0px);
    }

    45% {
      opacity: 0.92;
      transform: translate3d(28px, -8px, 0) scale(0.988) skewX(-1deg);
      filter: blur(1.5px);
    }

    100% {
      opacity: 0;
      transform: translate3d(120px, -24px, 0) scale(0.965) skewX(-2.5deg);
      filter: blur(7px);
    }
  }

  /* Prevent text selection during swipe */
  :global(.image-gallery-container) {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    touch-action: pan-y;
  }

  /* Smooth image transitions */
  :global(.image-gallery-container img) {
    will-change: opacity;
  }
</style>
