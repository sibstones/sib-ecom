<script lang="ts">
  import type { Product } from '$lib/api/product.api';
  import { formatPrice } from '$lib/utils/price.utils';
  import { getProductImageAlt, isVideoUrl } from '$lib/utils/image.utils';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import Reviews from '$lib/components/product/Reviews.svelte';
  import SizeChart from '$lib/components/product/SizeChart.svelte';
  import ProductInfoTabs from '$lib/components/product/ProductInfoTabs.svelte';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import LazyComponent from '$lib/components/LazyComponent.svelte';
  import ReviewsSkeleton from '$lib/components/product/ReviewsSkeleton.svelte';
  import { settingsStore } from '$lib/stores/settings.store';
  import { t } from '$lib/utils/i18n';
  import { getSizeButtonLabel, productSizeButtonClass } from '$lib/utils/size.utils';

  export let product: Product;
  export let sizeChartData: any = null;
  export let sizeChartEnabled: boolean = false;

  let sizeChartComponent: SizeChart;
  export let selectedImageIndex: number;
  export let selectedVariant: string | undefined;
  export let selectedSize: string | null;
  export let quantity: number;
  export let isInWishlist: boolean;
  export let wishlistLoading: boolean;
  export let currentPrice: number;
  export let currentImage: { url: string; alt?: string } | undefined;
  export let hasNext: boolean;
  export let hasPrev: boolean;
  export let imageContainer: HTMLDivElement;

  export let selectImage: (index: number) => void;
  export let nextImage: () => void;
  export let prevImage: () => void;
  export let handleTouchStart: (e: TouchEvent) => void;
  export let handleTouchEnd: (e: TouchEvent) => void;
  export let addToCart: () => void;
  export let toggleWishlist: () => void;

  function extractSelectedSizeValue(size: string | null): string | null {
    if (!size) return null;
    return size.includes(':') ? size.split(':')[1].trim() : size.trim();
  }

  // Modal state
  let isModalOpen = false;
  let modalImageIndex = 0;
  let isZoomed = false;
  let zoomX = 0;
  let zoomY = 0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let imageElement: HTMLElement | null = null;
  let imageContainerElement: HTMLElement | null = null;
  let animationFrameId: number | null = null;
  let zoomLevel = 2; // Default zoom level
  let targetPanX = 0;
  let targetPanY = 0;
  let modalElement: HTMLDivElement;

  // Check if size is required and selected
  // Note: product.sizes is already filtered on backend to only show available sizes
  $: hasSizes =
    product.sizes &&
    ((product.sizes.CLOTHING && product.sizes.CLOTHING.length > 0) ||
      (product.sizes.SHOES && product.sizes.SHOES.length > 0) ||
      (product.sizes.CUSTOM && product.sizes.CUSTOM.length > 0) ||
      (product.sizes.VOLUME && product.sizes.VOLUME.length > 0) ||
      (product.sizes.WEIGHT && product.sizes.WEIGHT.length > 0) ||
      (Array.isArray(product.sizes) && product.sizes.length > 0));
  $: sizeRequired = hasSizes;
  $: sizeSelected = selectedSize !== null && selectedSize !== undefined && selectedSize !== '';
  $: selectedSizeValue = extractSelectedSizeValue(selectedSize);
  $: isSelectedSizeComingSoon = selectedSizeValue
    ? (product.comingSoonSizes || []).some(
        (size) => size.trim().toLowerCase() === selectedSizeValue.toLowerCase()
      )
    : false;
  $: isComingSoon = Boolean(product.isComingSoon || isSelectedSizeComingSoon);
  // Check if product is out of stock (no available sizes after backend filtering)
  // If product has variants with sizes but no sizes are available after filtering, it's out of stock
  $: hasVariantsWithSizes =
    product.variants &&
    product.variants.length > 0 &&
    product.variants.some((v) => v.showOnProduct && v.size);
  $: isOutOfStock =
    !hasSizes && ((product.sizes !== null && product.sizes !== undefined) || hasVariantsWithSizes);
  $: canAddToCart = !isOutOfStock && !isComingSoon && (!sizeRequired || sizeSelected);

  // Get aspect ratio from settings
  $: aspectRatio = $settingsStore.productImageAspectRatio || '9/16';
  $: aspectRatioValue = aspectRatio.split('/').map(Number);
  $: aspectRatioStyle =
    aspectRatioValue.length === 2
      ? `aspect-ratio: ${aspectRatioValue[0]} / ${aspectRatioValue[1]};`
      : 'aspect-ratio: 9 / 16;';

  // Modal functions
  function openModal(index: number) {
    modalImageIndex = index;
    isModalOpen = true;
    resetZoom(); // Reset zoom when opening modal
    // Prevent body scroll
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    // Focus modal for keyboard navigation
    setTimeout(() => {
      if (modalElement) {
        modalElement.focus();
      }
    }, 0);
  }

  function closeModal() {
    isModalOpen = false;
    resetZoom(); // Reset zoom when closing modal
    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  function resetZoom() {
    isZoomed = false;
    zoomX = 0;
    zoomY = 0;
    panX = 0;
    panY = 0;
    targetPanX = 0;
    targetPanY = 0;
    zoomLevel = 2;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function handleImageClick(event: MouseEvent) {
    if (!imageElement || !imageContainerElement) return;
    const containerRect = imageContainerElement.getBoundingClientRect();
    const rect = imageElement.getBoundingClientRect();

    if (isZoomed) {
      // If zoomed, toggle zoom off
      resetZoom();
    } else {
      // Calculate click position relative to image
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Only zoom if click is within image bounds
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        return;
      }

      // Get natural image dimensions
      const img = imageElement as HTMLImageElement;
      const naturalWidth = img.naturalWidth || img.clientWidth;
      const naturalHeight = img.naturalHeight || img.clientHeight;

      // Calculate displayed size (before zoom)
      const containerAspect = containerRect.width / containerRect.height;
      const imageAspect = naturalWidth / naturalHeight;

      let displayedWidth: number;
      let displayedHeight: number;

      if (imageAspect > containerAspect) {
        displayedWidth = containerRect.width;
        displayedHeight = containerRect.width / imageAspect;
      } else {
        displayedHeight = containerRect.height;
        displayedWidth = containerRect.height * imageAspect;
      }

      // Calculate click position relative to displayed image center
      const clickX = event.clientX - containerRect.left - containerRect.width / 2;
      const clickY = event.clientY - containerRect.top - containerRect.height / 2;

      // Calculate zoom origin as percentage
      zoomX = 50 + (clickX / displayedWidth) * 50;
      zoomY = 50 + (clickY / displayedHeight) * 50;

      // Calculate initial pan to center the clicked area
      // The clicked point should be at the center of the viewport after zoom
      panX = -clickX * zoomLevel;
      panY = -clickY * zoomLevel;

      // Constrain initial pan position
      const [constrainedX, constrainedY] = constrainPan(panX, panY);
      panX = constrainedX;
      panY = constrainedY;

      isZoomed = true;
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (!isZoomed || !imageElement) return;
    isDragging = true;
    dragStartX = event.clientX - panX;
    dragStartY = event.clientY - panY;
    event.preventDefault();
    event.stopPropagation();
  }

  function constrainPan(x: number, y: number): [number, number] {
    if (!imageElement || !imageContainerElement) return [x, y];

    const containerRect = imageContainerElement.getBoundingClientRect();

    // Get natural image dimensions (before any transforms)
    const img = imageElement as HTMLImageElement;
    const naturalWidth = img.naturalWidth || img.clientWidth;
    const naturalHeight = img.naturalHeight || img.clientHeight;

    // Get current displayed size (before zoom transform)
    // We need to calculate the displayed size considering object-contain
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = naturalWidth / naturalHeight;

    let displayedWidth: number;
    let displayedHeight: number;

    if (imageAspect > containerAspect) {
      // Image is wider - fit to width
      displayedWidth = containerRect.width;
      displayedHeight = containerRect.width / imageAspect;
    } else {
      // Image is taller - fit to height
      displayedHeight = containerRect.height;
      displayedWidth = containerRect.height * imageAspect;
    }

    // Calculate scaled dimensions after zoom
    const scaledWidth = displayedWidth * zoomLevel;
    const scaledHeight = displayedHeight * zoomLevel;

    // Calculate max pan - only allow panning if scaled image is larger than container
    const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);

    return [Math.max(-maxPanX, Math.min(maxPanX, x)), Math.max(-maxPanY, Math.min(maxPanY, y))];
  }

  function animatePan() {
    if (!isDragging || !isZoomed) {
      animationFrameId = null;
      return;
    }

    // Smooth interpolation towards target position
    // Higher smoothing = more responsive, lower = smoother
    const smoothing = 0.25; // Balanced for smooth but responsive movement
    const dx = targetPanX - panX;
    const dy = targetPanY - panY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0.5) {
      // Use exponential smoothing for natural feel
      panX += dx * smoothing;
      panY += dy * smoothing;

      // Constrain the interpolated position
      const [constrainedX, constrainedY] = constrainPan(panX, panY);
      panX = constrainedX;
      panY = constrainedY;

      animationFrameId = requestAnimationFrame(animatePan);
    } else {
      // Snap to final position when close enough
      panX = targetPanX;
      panY = targetPanY;
      animationFrameId = null;
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging || !isZoomed || !imageElement) return;

    // Calculate target position
    const newTargetPanX = event.clientX - dragStartX;
    const newTargetPanY = event.clientY - dragStartY;

    // Constrain target position
    const [constrainedX, constrainedY] = constrainPan(newTargetPanX, newTargetPanY);
    targetPanX = constrainedX;
    targetPanY = constrainedY;

    // Start animation loop if not already running
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(animatePan);
    }
  }

  function handleMouseUp() {
    isDragging = false;
    // Snap to final target position
    panX = targetPanX;
    panY = targetPanY;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function handleWheel(event: WheelEvent) {
    if (!isZoomed || !imageElement || !imageContainerElement) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newZoomLevel = Math.max(1.5, Math.min(4, zoomLevel + delta));

    if (newZoomLevel === zoomLevel) return;

    const containerRect = imageContainerElement.getBoundingClientRect();

    // Get natural image dimensions
    const img = imageElement as HTMLImageElement;
    const naturalWidth = img.naturalWidth || img.clientWidth;
    const naturalHeight = img.naturalHeight || img.clientHeight;

    // Calculate displayed size (before zoom)
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = naturalWidth / naturalHeight;

    let displayedWidth: number;
    let displayedHeight: number;

    if (imageAspect > containerAspect) {
      displayedWidth = containerRect.width;
      displayedHeight = containerRect.width / imageAspect;
    } else {
      displayedHeight = containerRect.height;
      displayedWidth = containerRect.height * imageAspect;
    }

    // Get current image position (accounting for current pan)
    const rect = imageElement.getBoundingClientRect();

    // Calculate mouse position relative to displayed image (before zoom)
    const mouseX = event.clientX - containerRect.left - containerRect.width / 2;
    const mouseY = event.clientY - containerRect.top - containerRect.height / 2;

    // Calculate zoom origin as percentage
    zoomX = 50 + (mouseX / displayedWidth) * 50;
    zoomY = 50 + (mouseY / displayedHeight) * 50;

    // Adjust pan to keep the point under mouse fixed
    const zoomRatio = newZoomLevel / zoomLevel;
    panX = panX * zoomRatio;
    panY = panY * zoomRatio;

    zoomLevel = newZoomLevel;

    // Constrain panning using the updated constrainPan function
    const [constrainedX, constrainedY] = constrainPan(panX, panY);
    panX = constrainedX;
    panY = constrainedY;
  }

  // Sync modal index when selectedImageIndex changes (if modal is open)
  $: if (isModalOpen && selectedImageIndex !== undefined) {
    modalImageIndex = selectedImageIndex;
    resetZoom(); // Reset zoom when changing image
  }

  function nextModalImage() {
    if (product?.images && modalImageIndex < product.images.length - 1) {
      modalImageIndex++;
      resetZoom(); // Reset zoom when changing image
    }
  }

  function prevModalImage() {
    if (modalImageIndex > 0) {
      modalImageIndex--;
      resetZoom(); // Reset zoom when changing image
    }
  }

  $: modalHasNext = product?.images && modalImageIndex < product.images.length - 1;
  $: modalHasPrev = modalImageIndex > 0;

  // Handle ESC key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isModalOpen) {
      closeModal();
    }
    if (event.key === 'ArrowLeft' && isModalOpen && modalHasPrev) {
      prevModalImage();
    }
    if (event.key === 'ArrowRight' && isModalOpen && modalHasNext) {
      nextModalImage();
    }
  }

  // Handle click outside modal to close
  function handleModalBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      if (isZoomed) {
        // If zoomed, first reset zoom, then close on second click
        resetZoom();
      } else {
        closeModal();
      }
    }
  }

  // Handle image container click - open modal
  function handleImageContainerClick(event: MouseEvent | KeyboardEvent) {
    const target = event.target as HTMLElement;

    // Don't open modal if clicking on navigation buttons
    const clickedButton = target.closest('button');

    if (clickedButton) {
      return;
    }

    // Only open modal if clicking directly on image or its container div
    if (
      target.tagName === 'IMG' ||
      target.classList.contains('image-gallery-container') ||
      target.closest('.image-gallery-container')
    ) {
      openModal(selectedImageIndex);
    }
  }

  function handleImageContainerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleImageContainerClick(event);
    }
  }
</script>

<svelte:window
  on:keydown={handleKeydown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:wheel={handleWheel}
/>

<div class="container-custom py-8 md:py-12">
  <!-- Main image - full width without edges -->
  {#if currentImage}
    <div
      class="w-full relative image-gallery-container mb-8 md:mb-12 cursor-pointer"
      bind:this={imageContainer}
      on:touchstart={handleTouchStart}
      on:touchend={handleTouchEnd}
      on:click={handleImageContainerClick}
      on:keydown={handleImageContainerKeydown}
      role="button"
      tabindex="0"
      aria-label="Open image gallery"
      style="height: 60vh;"
    >
      <div class="w-full h-full flex items-center justify-center">
        {#if isVideoUrl(currentImage.url)}
          <video
            src={currentImage.url}
            class="w-full h-full object-contain select-none"
            muted
            loop
            playsinline
            autoplay
          ></video>
        {:else}
          <BlurredImage
            src={currentImage.url}
            alt={getProductImageAlt(currentImage.alt, product.name)}
            className="w-full h-full object-contain select-none"
            eager={selectedImageIndex === 0}
            fetchPriority="high"
          />
        {/if}
      </div>

      {#if product.images && product.images.length > 1}
        <button
          on:click={prevImage}
          disabled={!hasPrev}
          class="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-white/80 hover:bg-white border border-gray-200 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm"
          aria-label="Previous image"
        >
          <svg
            class="w-4 h-4 md:w-5 md:h-5 text-black"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          on:click={nextImage}
          disabled={!hasNext}
          class="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-white/80 hover:bg-white border border-gray-200 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm"
          aria-label="Next image"
        >
          <svg
            class="w-4 h-4 md:w-5 md:h-5 text-black"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      {/if}
    </div>
  {/if}

  <!-- Product info grid: description left, purchase form right -->
  <div class="max-w-7xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
      <!-- Left: Description -->
      <div>
        <!-- Minimal header -->
        <div class="mb-6 md:mb-8">
          <h1 class="text-3xl md:text-4xl lg:text-5xl font-extralight mb-3 tracking-tight">
            {product.name}
          </h1>
          {#if product.brand && $settingsStore.brandsEnabled}
            <p class="text-xs md:text-sm text-gray-500 uppercase tracking-[0.15em] font-light">
              {product.brand.name}
            </p>
          {/if}
        </div>

        {#if product.description}
          <div class="mb-6">
            <p
              class="text-sm md:text-base text-gray-600 leading-relaxed whitespace-pre-line font-light"
            >
              {product.description}
            </p>
          </div>
        {/if}

        <!-- Product details -->
        <div class="border-t border-gray-200 pt-6 mt-6">
          <div class="space-y-4 text-xs text-gray-500">
            <div class="flex justify-between items-center">
              <span class="font-light uppercase tracking-[0.1em]">{t('productPage.sku')}:</span>
              <span class="text-black font-light">{product.sku}</span>
            </div>
            {#if product.category}
              <div class="flex justify-between items-center">
                <span class="font-light uppercase tracking-[0.1em]"
                  >{t('productPage.category')}:</span
                >
                <span class="text-black font-light">{product.category.name}</span>
              </div>
            {/if}
            {#if !product.hideColor && product.colors && product.colors.length > 0}
              <div class="flex justify-between items-center">
                <span class="font-light uppercase tracking-[0.1em]">{t('filter.color')}:</span>
                <div class="flex gap-2 flex-wrap justify-end">
                  {#each product.colors as color}
                    <div class="flex items-center gap-1.5" title={color.name}>
                      <div
                        class="w-5 h-5 rounded border border-gray-300"
                        style="background-color: {color.hex};"
                      ></div>
                      <span class="text-black text-xs font-light">{color.name}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Product info tabs: Description, Application, Composition, Brand, Additional -->
      <div class="mt-8 w-full">
        <ProductInfoTabs {product} />
      </div>

      <!-- Right: Purchase form -->
      <div class="space-y-8">
        <!-- Price -->
        <div>
          {#if product.priceOnRequest || !product.price || currentPrice === 0}
            <p class="text-2xl md:text-3xl font-extralight tracking-tight">
              {t('product.priceOnRequest')}
            </p>
          {:else}
            <p class="text-2xl md:text-3xl font-extralight mb-1 tracking-tight">
              {formatPrice(currentPrice)}
            </p>
            {#if product.compareAtPrice}
              {@const comparePrice =
                typeof product.compareAtPrice === 'string'
                  ? parseFloat(product.compareAtPrice)
                  : product.compareAtPrice}
              {#if comparePrice > currentPrice}
                <p class="text-sm text-gray-400 line-through mt-1">
                  {formatPrice(product.compareAtPrice)}
                </p>
              {/if}
            {/if}
          {/if}
        </div>

        <!-- Variants -->
        {#if product.variants && product.variants.length > 0}
          <div>
            <CustomSelect
              bind:value={selectedVariant}
              options={product.variants.map((variant) => ({
                value: variant.id,
                label: variant.name,
              }))}
              className="w-full"
            />
          </div>
        {/if}

        <!-- Sizes -->
        {#if hasSizes}
          <div>
            <div class="flex items-center gap-4 mb-4">
              <p class="text-xs text-gray-500 uppercase tracking-[0.15em] font-light">
                {#if product.productTypes && product.productTypes.includes('CLOTHING')}
                  {t('productPage.size')} <span class="text-gray-400">*</span>
                {:else if product.productTypes && product.productTypes.includes('SHOES')}
                  {t('productPage.size')} (EU) <span class="text-gray-400">*</span>
                {:else}
                  {t('productPage.size')} <span class="text-gray-400">*</span>
                {/if}
              </p>
              {#if sizeChartEnabled && sizeChartData}
                <button
                  on:click={() => sizeChartComponent?.openChart()}
                  class="text-xs text-gray-500 hover:text-black transition-colors uppercase tracking-[0.15em] font-light underline underline-offset-2"
                >
                  {t('productPage.sizeGuide')}
                </button>
              {/if}
            </div>

            <!-- Clothing Sizes -->
            {#if product.sizes && product.sizes.CLOTHING && product.sizes.CLOTHING.length > 0}
              <div class="mb-4">
                <div class="flex flex-wrap gap-2.5">
                  {#each product.sizes.CLOTHING as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `CLOTHING:${size}`)}
                      class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                      `CLOTHING:${size}`
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black hover:border-gray-400'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Shoe Sizes -->
            {#if product.sizes && product.sizes.SHOES && product.sizes.SHOES.length > 0}
              <div class="mb-4">
                <div class="flex flex-wrap gap-2.5">
                  {#each product.sizes.SHOES as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `SHOES:${size}`)}
                      class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                      `SHOES:${size}`
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black hover:border-gray-400'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Custom Sizes -->
            {#if product.sizes && product.sizes.CUSTOM && product.sizes.CUSTOM.length > 0}
              <div class="mb-4">
                <div class="flex flex-wrap gap-2.5">
                  {#each product.sizes.CUSTOM as sizeObj}
                    {#if sizeObj && typeof sizeObj === 'object' && 'value' in sizeObj}
                      <button
                        type="button"
                        on:click={() => (selectedSize = `CUSTOM:${sizeObj.value}`)}
                        class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                        `CUSTOM:${sizeObj.value}`
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black hover:border-gray-400'}"
                      >
                        {getSizeButtonLabel(sizeObj)}
                      </button>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Volume (ml) Sizes -->
            {#if product.sizes && product.sizes.VOLUME && product.sizes.VOLUME.length > 0}
              <div class="mb-4">
                <div class="flex flex-wrap gap-2.5">
                  {#each product.sizes.VOLUME as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `VOLUME:${size}`)}
                      class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                      `VOLUME:${size}`
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black hover:border-gray-400'}"
                    >
                      {size} ml
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Weight (g) Sizes -->
            {#if product.sizes && product.sizes.WEIGHT && product.sizes.WEIGHT.length > 0}
              <div class="mb-4">
                <div class="flex flex-wrap gap-2.5">
                  {#each product.sizes.WEIGHT as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `WEIGHT:${size}`)}
                      class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                      `WEIGHT:${size}`
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black hover:border-gray-400'}"
                    >
                      {size} g
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Legacy format support -->
            {#if Array.isArray(product.sizes) && product.sizes.length > 0}
              <div class="flex flex-wrap gap-2.5">
                {#each product.sizes as size}
                  {#if typeof size === 'string'}
                    <button
                      type="button"
                      on:click={() => (selectedSize = size)}
                      class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                      size
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black hover:border-gray-400'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {:else if size && typeof size === 'object' && 'value' in size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = String(size.value))}
                      class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                      size.value
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black hover:border-gray-400'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {/if}
                {/each}
              </div>
            {/if}
            {#if isComingSoon}
              <p class="mt-3 text-xs text-amber-600 font-medium">{t('productPage.comingSoon')}</p>
            {:else if isOutOfStock}
              <p class="mt-3 text-xs text-red-500 font-medium">{t('productPage.outOfStock')}</p>
            {:else if !selectedSize}
              <p class="mt-3 text-xs text-gray-400 font-light">
                {t('productPage.pleaseSelectSize')}
              </p>
            {/if}
          </div>
        {:else if hasSizes && isOutOfStock}
          <!-- Show out of stock message if sizes are defined but none are available -->
          <div>
            <p class="text-xs text-red-500 font-medium">{t('productPage.outOfStock')}</p>
          </div>
        {/if}

        <!-- Size Chart Modal - Always render for bind:this to work -->
        <SizeChart
          bind:this={sizeChartComponent}
          {sizeChartData}
          enabled={sizeChartEnabled}
          showButton={false}
        />

        <!-- Quantity -->
        <div class="flex items-center gap-6">
          <button
            on:click={() => quantity > 1 && quantity--}
            class="w-10 h-10 flex items-center justify-center border border-gray-300 text-black hover:border-gray-400 transition-all duration-200 font-light text-lg"
            aria-label={t('cart.decreaseQuantity')}
          >
            −
          </button>
          <span class="text-sm font-light tracking-wide min-w-[2rem] text-center">{quantity}</span>
          <button
            on:click={() => quantity++}
            class="w-10 h-10 flex items-center justify-center border border-gray-300 text-black hover:border-gray-400 transition-all duration-200 font-light text-lg"
            aria-label={t('cart.increaseQuantity')}
          >
            +
          </button>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-col gap-3">
          <button
            type="button"
            on:click={addToCart}
            disabled={!canAddToCart || isOutOfStock || isComingSoon}
            class="w-full py-3.5 md:py-4 font-light tracking-wide transition-all duration-200 text-sm uppercase {canAddToCart &&
            !isOutOfStock &&
            !isComingSoon
              ? 'bg-black text-white hover:bg-gray-900 cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
          >
            {isComingSoon
              ? t('productPage.comingSoon')
              : isOutOfStock
                ? t('productPage.outOfStock')
                : t('productPage.addToBag')}
          </button>
          {#if $settingsStore.wishlistEnabled}
            <button
              on:click={toggleWishlist}
              disabled={wishlistLoading}
              class="w-full py-3.5 md:py-4 border border-gray-300 font-light transition-all duration-200 flex items-center justify-center gap-2 text-sm uppercase tracking-wide {isInWishlist
                ? 'bg-white border-gray-400 text-gray-700 hover:border-gray-500'
                : 'bg-white text-black hover:border-gray-400'}"
            >
              {#if wishlistLoading}
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
                    stroke-width="2"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              {:else if isInWishlist}
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clip-rule="evenodd"
                  />
                </svg>
              {:else}
                <svg
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              {/if}
              {t('productPage.wishlist')}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Hidden: Old product info block -->
  <div class="max-w-lg mx-auto space-y-8 mb-16 hidden">
    <div class="text-center">
      {#if product.priceOnRequest || !product.price || currentPrice === 0}
        <p class="text-2xl md:text-3xl font-extralight tracking-tight">
          {t('product.priceOnRequest')}
        </p>
      {:else}
        <p class="text-2xl md:text-3xl font-extralight mb-1 tracking-tight">
          {formatPrice(currentPrice)}
        </p>
        {#if product.compareAtPrice}
          {@const comparePrice =
            typeof product.compareAtPrice === 'string'
              ? parseFloat(product.compareAtPrice)
              : product.compareAtPrice}
          {#if comparePrice > currentPrice}
            <p class="text-sm text-gray-400 line-through mt-1">
              {formatPrice(product.compareAtPrice)}
            </p>
          {/if}
        {/if}
      {/if}
    </div>

    {#if product.description}
      <div class="text-center px-4">
        <p
          class="text-sm md:text-base text-gray-600 leading-relaxed whitespace-pre-line font-light"
        >
          {product.description}
        </p>
      </div>
    {/if}

    <!-- Variants -->
    {#if product.variants && product.variants.length > 0}
      <div class="px-4">
        <CustomSelect
          bind:value={selectedVariant}
          options={product.variants.map((variant) => ({
            value: variant.id,
            label: variant.name,
          }))}
          className="w-full"
        />
      </div>
    {/if}

    <!-- Sizes -->
    {#if hasSizes}
      <div>
        <div class="flex items-center justify-center gap-4 mb-4">
          <p class="text-xs text-gray-500 uppercase tracking-[0.15em] font-light">
            {#if product.productTypes && product.productTypes.includes('CLOTHING')}
              Size <span class="text-gray-400">*</span>
            {:else if product.productTypes && product.productTypes.includes('SHOES')}
              Shoe Size (EU) <span class="text-gray-400">*</span>
            {:else}
              Size <span class="text-gray-400">*</span>
            {/if}
          </p>
          {#if sizeChartEnabled && sizeChartData}
            <button
              on:click={() => sizeChartComponent?.openChart()}
              class="text-xs text-gray-500 hover:text-black transition-colors uppercase tracking-[0.15em] font-light underline underline-offset-2"
            >
              {t('productPage.sizeGuide')}
            </button>
          {/if}
        </div>

        <!-- Clothing Sizes -->
        {#if product.sizes && product.sizes.CLOTHING && product.sizes.CLOTHING.length > 0}
          <div class="mb-4">
            <div class="flex flex-wrap gap-2.5 justify-center px-4">
              {#each product.sizes.CLOTHING as size}
                <button
                  type="button"
                  on:click={() => (selectedSize = `CLOTHING:${size}`)}
                  class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                  `CLOTHING:${size}`
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black hover:border-gray-400'}"
                >
                  {getSizeButtonLabel(size)}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Shoe Sizes -->
        {#if product.sizes && product.sizes.SHOES && product.sizes.SHOES.length > 0}
          <div class="mb-4">
            <div class="flex flex-wrap gap-2.5 justify-center px-4">
              {#each product.sizes.SHOES as size}
                <button
                  type="button"
                  on:click={() => (selectedSize = `SHOES:${size}`)}
                  class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                  `SHOES:${size}`
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black hover:border-gray-400'}"
                >
                  {getSizeButtonLabel(size)}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Custom Sizes -->
        {#if product.sizes && product.sizes.CUSTOM && product.sizes.CUSTOM.length > 0}
          <div class="mb-4">
            <div class="flex flex-wrap gap-2.5 justify-center px-4">
              {#each product.sizes.CUSTOM as sizeObj}
                {#if sizeObj && typeof sizeObj === 'object' && 'value' in sizeObj}
                  <button
                    type="button"
                    on:click={() => (selectedSize = `CUSTOM:${sizeObj.value}`)}
                    class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                    `CUSTOM:${sizeObj.value}`
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black hover:border-gray-400'}"
                  >
                    {getSizeButtonLabel(sizeObj)}
                  </button>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <!-- Volume (ml) Sizes -->
        {#if product.sizes && product.sizes.VOLUME && product.sizes.VOLUME.length > 0}
          <div class="mb-4">
            <div class="flex flex-wrap gap-2.5 justify-center px-4">
              {#each product.sizes.VOLUME as size}
                <button
                  type="button"
                  on:click={() => (selectedSize = `VOLUME:${size}`)}
                  class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                  `VOLUME:${size}`
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black hover:border-gray-400'}"
                >
                  {size} ml
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Weight (g) Sizes -->
        {#if product.sizes && product.sizes.WEIGHT && product.sizes.WEIGHT.length > 0}
          <div class="mb-4">
            <div class="flex flex-wrap gap-2.5 justify-center px-4">
              {#each product.sizes.WEIGHT as size}
                <button
                  type="button"
                  on:click={() => (selectedSize = `WEIGHT:${size}`)}
                  class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                  `WEIGHT:${size}`
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black hover:border-gray-400'}"
                >
                  {size} g
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Legacy format support -->
        {#if Array.isArray(product.sizes) && product.sizes.length > 0}
          <div class="flex flex-wrap gap-2.5 justify-center px-4">
            {#each product.sizes as size}
              {#if typeof size === 'string'}
                <button
                  type="button"
                  on:click={() => (selectedSize = size)}
                  class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                  size
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black hover:border-gray-400'}"
                >
                  {getSizeButtonLabel(size)}
                </button>
              {:else if size && typeof size === 'object' && 'value' in size}
                <button
                  type="button"
                  on:click={() => (selectedSize = String(size.value))}
                  class="px-4 py-2.5 text-xs border border-gray-300 transition-all duration-200 font-light {productSizeButtonClass} {selectedSize ===
                  size.value
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black hover:border-gray-400'}"
                >
                  {getSizeButtonLabel(size)}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
        {#if isComingSoon}
          <p class="mt-3 text-xs text-amber-600 text-center font-medium">
            {t('productPage.comingSoon')}
          </p>
        {:else if isOutOfStock}
          <p class="mt-3 text-xs text-red-500 text-center font-medium">
            {t('productPage.outOfStock')}
          </p>
        {:else if !selectedSize}
          <p class="mt-3 text-xs text-gray-400 text-center font-light">
            {t('productPage.pleaseSelectSize')}
          </p>
        {/if}
      </div>
    {:else if hasSizes && isOutOfStock}
      <!-- Show out of stock message if sizes are defined but none are available -->
      <div class="text-center">
        <p class="text-xs text-red-500 font-medium">{t('productPage.outOfStock')}</p>
      </div>
    {/if}

    <!-- Size Chart Modal - Always render for bind:this to work -->
    <SizeChart
      bind:this={sizeChartComponent}
      {sizeChartData}
      enabled={sizeChartEnabled}
      showButton={false}
    />

    <!-- Quantity -->
    <div class="flex items-center justify-center gap-6">
      <button
        on:click={() => quantity > 1 && quantity--}
        class="w-10 h-10 flex items-center justify-center border border-gray-300 text-black hover:border-gray-400 transition-all duration-200 font-light text-lg"
        aria-label={t('cart.decreaseQuantity')}
      >
        −
      </button>
      <span class="text-sm font-light tracking-wide min-w-[2rem] text-center">{quantity}</span>
      <button
        on:click={() => quantity++}
        class="w-10 h-10 flex items-center justify-center border border-gray-300 text-black hover:border-gray-400 transition-all duration-200 font-light text-lg"
        aria-label={t('cart.increaseQuantity')}
      >
        +
      </button>
    </div>

    <!-- Action buttons -->
    <div class="flex flex-col gap-3 px-4">
      <button
        type="button"
        on:click={addToCart}
        disabled={!canAddToCart || isOutOfStock || isComingSoon}
        class="w-full py-3.5 md:py-4 font-light tracking-wide transition-all duration-200 text-sm uppercase {canAddToCart &&
        !isOutOfStock &&
        !isComingSoon
          ? 'bg-black text-white hover:bg-gray-900 cursor-pointer'
          : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
      >
        {isComingSoon
          ? t('productPage.comingSoon')
          : isOutOfStock
            ? t('productPage.outOfStock')
            : t('productPage.addToBag')}
      </button>
      {#if $settingsStore.wishlistEnabled}
        <button
          on:click={toggleWishlist}
          disabled={wishlistLoading}
          class="w-full py-3.5 md:py-4 border border-gray-300 font-light transition-all duration-200 flex items-center justify-center gap-2 text-sm uppercase tracking-wide {isInWishlist
            ? 'bg-white border-gray-400 text-gray-700 hover:border-gray-500'
            : 'bg-white text-black hover:border-gray-400'}"
        >
          {#if wishlistLoading}
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
                stroke-width="2"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          {:else if isInWishlist}
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clip-rule="evenodd"
              />
            </svg>
          {:else}
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          {/if}
          {t('productPage.wishlist')}
        </button>
      {/if}
    </div>
  </div>

  <!-- Hidden: Minimal thumbnail gallery -->
  {#if product.images && product.images.length > 1}
    <div class="flex gap-3 justify-center mb-16 overflow-x-auto px-4 pb-2 hidden">
      {#each product.images as image, index}
        <button
          on:click={() => selectImage(index)}
          class="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 border transition-all duration-200 {selectedImageIndex ===
          index
            ? 'border-black border-2'
            : 'border-gray-300 hover:border-gray-400'}"
        >
          {#if isVideoUrl(image.url)}
            <video src={image.url} class="w-full h-full object-cover" muted loop playsinline
            ></video>
          {:else}
            <BlurredImage
              src={image.url}
              alt={image.alt || `Image ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              fetchPriority="low"
            />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- Fullscreen Image Modal -->
{#if isModalOpen && product?.images}
  <div
    class="fixed inset-0 bg-white z-[9999] flex items-center justify-center"
    role="dialog"
    aria-modal="true"
    aria-label="Image gallery"
    tabindex="-1"
    bind:this={modalElement}
  >
    <button
      type="button"
      class="absolute inset-0 h-full w-full cursor-default bg-transparent"
      aria-hidden="true"
      tabindex="-1"
      on:click={handleModalBackdropClick}
      on:keydown={handleKeydown}
    ></button>
    <!-- Close button -->
    <button
      on:click|stopPropagation={closeModal}
      class="absolute top-4 right-4 md:top-8 md:right-8 z-50 p-2 md:p-3 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
      aria-label="Close gallery"
    >
      <svg
        class="w-6 h-6 md:w-8 md:h-6 text-black"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Previous button -->
    {#if modalHasPrev}
      <button
        on:click|stopPropagation={prevModalImage}
        class="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-50 p-3 md:p-4 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
        aria-label="Previous image"
      >
        <svg
          class="w-6 h-6 md:w-8 md:h-8 text-black"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    {/if}

    <!-- Next button -->
    {#if modalHasNext}
      <button
        on:click|stopPropagation={nextModalImage}
        class="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-50 p-3 md:p-4 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
        aria-label="Next image"
      >
        <svg
          class="w-6 h-6 md:w-8 md:h-8 text-black"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    {/if}

    <!-- Image container -->
    <div
      role="img"
      aria-label="Product image"
      bind:this={imageContainerElement}
      class="w-full h-full flex items-center justify-center p-4 md:p-8 overflow-hidden relative"
    >
      {#if isVideoUrl(product.images[modalImageIndex].url)}
        <video
          src={product.images[modalImageIndex].url}
          class="max-w-full max-h-full object-contain select-none"
          controls
          muted
          loop
          playsinline
        ></video>
      {:else}
        <img
          bind:this={imageElement}
          src={product.images[modalImageIndex].url}
          alt={getProductImageAlt(product.images[modalImageIndex].alt, product.name)}
          class="max-w-full max-h-full object-contain select-none {isZoomed
            ? 'cursor-grab'
            : 'cursor-zoom-in'} {isDragging ? 'cursor-grabbing' : ''}"
          style="transform: {isZoomed
            ? `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`
            : 'scale(1) translate(0, 0)'}; transform-origin: {isZoomed
            ? `${zoomX}% ${zoomY}%`
            : 'center'}; transition: {isZoomed && !isDragging
            ? 'transform 0.2s ease-out'
            : 'none'}; will-change: {isDragging ? 'transform' : 'auto'};"
          draggable="false"
        />
      {/if}
    </div>

    <!-- Image counter -->
    {#if product.images.length > 1}
      <div
        class="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/10 backdrop-blur-sm rounded-full text-black text-sm md:text-base"
      >
        {modalImageIndex + 1} / {product.images.length}
      </div>
    {/if}
  </div>
{/if}

<!-- Reviews -->
{#if $settingsStore.reviewsEnabled}
  <div class="container-custom py-8 md:py-12">
    <div class="max-w-4xl mx-auto px-4">
      <LazyComponent rootMargin="300px" placeholderHeight="400px">
        <Reviews productId={product.id} />
        <ReviewsSkeleton slot="placeholder" />
      </LazyComponent>
    </div>
  </div>
{/if}
