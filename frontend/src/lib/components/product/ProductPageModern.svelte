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

  // Get aspect ratio from settings - container is square, but image adapts to its format
  $: aspectRatio = $settingsStore.productImageAspectRatio || '9/16';
  $: aspectRatioValue = aspectRatio.split('/').map(Number);
  $: aspectRatioStyle =
    aspectRatioValue.length === 2
      ? `aspect-ratio: ${aspectRatioValue[0]} / ${aspectRatioValue[1]};`
      : 'aspect-ratio: 9 / 16;';
  // Container is square, but image will use object-contain to fit without cropping
  $: containerAspectStyle = 'aspect-ratio: 1 / 1;';

  // Image zoom modal state (using Grid component logic)
  let showZoomModal = false;
  let isZoomed = false;
  let zoomX = 0;
  let zoomY = 0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let modalImageElement: HTMLImageElement;
  let modalContainerElement: HTMLDivElement;
  let imageContainerElement: HTMLDivElement;
  let animationFrameId: number | null = null;
  let zoomLevel = 2; // Default zoom level like Grid
  let targetPanX = 0;
  let targetPanY = 0;
  let modalImageIndex = 0;

  function openZoomModal() {
    modalImageIndex = selectedImageIndex;
    showZoomModal = true;
    resetZoom();
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    setTimeout(() => {
      if (modalContainerElement) {
        modalContainerElement.focus();
      }
    }, 0);
  }

  function closeZoomModal() {
    showZoomModal = false;
    resetZoom();
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
    if (!modalImageElement || !modalContainerElement) return;
    const containerRect = modalContainerElement.getBoundingClientRect();
    const rect = modalImageElement.getBoundingClientRect();

    if (isZoomed) {
      resetZoom();
    } else {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        return;
      }

      const img = modalImageElement as HTMLImageElement;
      const naturalWidth = img.naturalWidth || img.clientWidth;
      const naturalHeight = img.naturalHeight || img.clientHeight;

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

      const clickX = event.clientX - containerRect.left - containerRect.width / 2;
      const clickY = event.clientY - containerRect.top - containerRect.height / 2;

      zoomX = 50 + (clickX / displayedWidth) * 50;
      zoomY = 50 + (clickY / displayedHeight) * 50;

      panX = -clickX * zoomLevel;
      panY = -clickY * zoomLevel;

      const [constrainedX, constrainedY] = constrainPan(panX, panY);
      panX = constrainedX;
      panY = constrainedY;

      isZoomed = true;
    }
  }

  function constrainPan(x: number, y: number): [number, number] {
    if (!modalImageElement || !modalContainerElement) return [x, y];

    const containerRect = modalContainerElement.getBoundingClientRect();
    const img = modalImageElement as HTMLImageElement;
    const naturalWidth = img.naturalWidth || img.clientWidth;
    const naturalHeight = img.naturalHeight || img.clientHeight;

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

    const scaledWidth = displayedWidth * zoomLevel;
    const scaledHeight = displayedHeight * zoomLevel;

    const maxPanX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerRect.height) / 2);

    return [Math.max(-maxPanX, Math.min(maxPanX, x)), Math.max(-maxPanY, Math.min(maxPanY, y))];
  }

  function animatePan() {
    if (!isDragging || !isZoomed) {
      animationFrameId = null;
      return;
    }

    const smoothing = 0.25;
    const dx = targetPanX - panX;
    const dy = targetPanY - panY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0.5) {
      panX += dx * smoothing;
      panY += dy * smoothing;

      const [constrainedX, constrainedY] = constrainPan(panX, panY);
      panX = constrainedX;
      panY = constrainedY;

      animationFrameId = requestAnimationFrame(animatePan);
    } else {
      panX = targetPanX;
      panY = targetPanY;
      animationFrameId = null;
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (!isZoomed || !modalImageElement) return;
    isDragging = true;
    dragStartX = event.clientX - panX;
    dragStartY = event.clientY - panY;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging || !isZoomed || !modalImageElement) return;

    const newTargetPanX = event.clientX - dragStartX;
    const newTargetPanY = event.clientY - dragStartY;

    const [constrainedX, constrainedY] = constrainPan(newTargetPanX, newTargetPanY);
    targetPanX = constrainedX;
    targetPanY = constrainedY;

    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(animatePan);
    }
  }

  function handleMouseUp() {
    isDragging = false;
    panX = targetPanX;
    panY = targetPanY;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function handleWheel(event: WheelEvent) {
    if (!isZoomed || !modalImageElement || !modalContainerElement) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newZoomLevel = Math.max(1.5, Math.min(4, zoomLevel + delta));

    if (newZoomLevel === zoomLevel) return;

    const containerRect = modalContainerElement.getBoundingClientRect();
    const img = modalImageElement as HTMLImageElement;
    const naturalWidth = img.naturalWidth || img.clientWidth;
    const naturalHeight = img.naturalHeight || img.clientHeight;

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

    const mouseX = event.clientX - containerRect.left - containerRect.width / 2;
    const mouseY = event.clientY - containerRect.top - containerRect.height / 2;

    zoomX = 50 + (mouseX / displayedWidth) * 50;
    zoomY = 50 + (mouseY / displayedHeight) * 50;

    const zoomRatio = newZoomLevel / zoomLevel;
    panX = panX * zoomRatio;
    panY = panY * zoomRatio;

    zoomLevel = newZoomLevel;

    const [constrainedX, constrainedY] = constrainPan(panX, panY);
    panX = constrainedX;
    panY = constrainedY;
  }

  function applyZoomLevel(nextZoomLevel: number) {
    if (!showZoomModal || !modalImageElement || !modalContainerElement) return;

    const newZoomLevel = Math.max(1.5, Math.min(4, nextZoomLevel));
    if (newZoomLevel === zoomLevel) return;

    const zoomRatio = newZoomLevel / zoomLevel;
    panX = panX * zoomRatio;
    panY = panY * zoomRatio;
    zoomLevel = newZoomLevel;
    isZoomed = zoomLevel > 1;

    const [constrainedX, constrainedY] = constrainPan(panX, panY);
    panX = constrainedX;
    panY = constrainedY;
  }

  function zoomIn() {
    applyZoomLevel(zoomLevel + 0.5);
  }

  function zoomOut() {
    applyZoomLevel(zoomLevel - 0.5);
  }

  function resetZoomFromButton() {
    if (!showZoomModal) return;
    resetZoom();
  }

  function handleModalTouchStart(e: TouchEvent) {
    if (!isZoomed || e.touches.length !== 1) return;
    isDragging = true;
    dragStartX = e.touches[0].clientX - panX;
    dragStartY = e.touches[0].clientY - panY;
  }

  function handleModalTouchMove(e: TouchEvent) {
    if (!isDragging || !isZoomed || e.touches.length !== 1) return;
    e.preventDefault();
    const newTargetPanX = e.touches[0].clientX - dragStartX;
    const newTargetPanY = e.touches[0].clientY - dragStartY;
    const [constrainedX, constrainedY] = constrainPan(newTargetPanX, newTargetPanY);
    targetPanX = constrainedX;
    targetPanY = constrainedY;
    panX = constrainedX;
    panY = constrainedY;
  }

  function handleModalTouchEnd() {
    isDragging = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!showZoomModal) return;
    if (e.key === 'Escape') {
      closeZoomModal();
    } else if (e.key === 'ArrowLeft' && modalHasPrev) {
      prevModalImage();
    } else if (e.key === 'ArrowRight' && modalHasNext) {
      nextModalImage();
    }
  }

  function nextModalImage() {
    if (product?.images && modalImageIndex < product.images.length - 1) {
      modalImageIndex++;
      resetZoom();
    }
  }

  function prevModalImage() {
    if (modalImageIndex > 0) {
      modalImageIndex--;
      resetZoom();
    }
  }

  $: modalHasNext = product?.images && modalImageIndex < product.images.length - 1;
  $: modalHasPrev = modalImageIndex > 0;

  // Sync modal index when selectedImageIndex changes (if modal is open)
  $: if (showZoomModal && selectedImageIndex !== undefined) {
    modalImageIndex = selectedImageIndex;
    resetZoom();
  }

  function handleModalBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      if (isZoomed) {
        resetZoom();
      } else {
        closeZoomModal();
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="container-custom py-8">
  <!-- Two-column grid layout: Image gallery on left, Product info on right -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
    <!-- Left Column: Image Gallery -->
    <div class="sticky top-8">
      {#if currentImage}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="relative w-full mb-4 image-gallery-container flex items-center justify-center bg-gray-50"
          bind:this={imageContainer}
          role="button"
          tabindex="0"
          aria-label="Product image gallery"
          on:touchstart={handleTouchStart}
          on:touchend={handleTouchEnd}
          on:keydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openZoomModal();
            }
          }}
          style={containerAspectStyle}
        >
          <button
            type="button"
            class="w-full h-full overflow-hidden cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center"
            on:click={openZoomModal}
            aria-label="Open image zoom"
          >
            {#if isVideoUrl(currentImage.url)}
              <video
                src={currentImage.url}
                class="max-w-full max-h-full object-contain select-none pointer-events-none"
                style={aspectRatioStyle}
                muted
                loop
                playsinline
                autoplay
                on:click|stopPropagation
              ></video>
            {:else}
              <BlurredImage
                src={currentImage.url}
                alt={getProductImageAlt(currentImage.alt, product.name)}
                className="max-w-full max-h-full object-contain select-none pointer-events-none"
                style={aspectRatioStyle}
                eager={selectedImageIndex === 0}
                fetchPriority="high"
              />
            {/if}
          </button>

          {#if product.images && product.images.length > 1}
            <button
              on:click={prevImage}
              disabled={!hasPrev}
              class="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-black hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed z-10"
              aria-label="Previous image"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              on:click={nextImage}
              disabled={!hasNext}
              class="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-black hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed z-10"
              aria-label="Next image"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Thumbnail gallery -->
      {#if product.images && product.images.length > 1}
        <div class="grid grid-cols-4 gap-3">
          {#each product.images as image, index}
            <button
              on:click={() => selectImage(index)}
              class="relative aspect-square overflow-hidden transition-all bg-gray-50 flex items-center justify-center {selectedImageIndex ===
              index
                ? 'ring-2 ring-gray-400'
                : 'hover:ring-2 hover:ring-gray-300'}"
            >
              {#if isVideoUrl(image.url)}
                <video
                  src={image.url}
                  class="max-w-full max-h-full object-contain"
                  muted
                  loop
                  playsinline
                ></video>
              {:else}
                <BlurredImage
                  src={image.url}
                  alt={image.alt || `Image ${index + 1}`}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                  fetchPriority="low"
                />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right Column: Product Info -->
    <div class="space-y-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold mb-2">{product.name}</h1>
        {#if product.brand && $settingsStore.brandsEnabled}
          <p class="text-sm text-accent-muted mb-3">{product.brand.name}</p>
        {/if}
        <div class="flex items-center gap-3 mb-4">
          {#if product.priceOnRequest || !product.price || currentPrice === 0}
            <p class="text-xl lg:text-2xl font-bold">{t('product.priceOnRequest')}</p>
          {:else}
            <p class="text-xl lg:text-2xl font-bold">{formatPrice(currentPrice)}</p>
            {#if product.compareAtPrice && (typeof product.compareAtPrice === 'number' ? product.compareAtPrice : Number(product.compareAtPrice)) > currentPrice}
              <p class="text-base lg:text-lg text-accent-muted line-through">
                {formatPrice(product.compareAtPrice)}
              </p>
            {/if}
          {/if}
        </div>
      </div>

      {#if product.description}
        <div>
          <p class="text-sm text-accent-muted whitespace-pre-line">{product.description}</p>
        </div>
      {/if}

      <!-- Product options -->
      <div class="space-y-4">
        <!-- Variants -->
        {#if product.variants && product.variants.length > 0}
          <div>
            <h3 class="text-base font-medium mb-2">{t('productPage.variants')}</h3>
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
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-base font-medium">
                {t('productPage.size')} <span class="text-red-500">*</span>
              </h3>
              {#if sizeChartEnabled && sizeChartData}
                <button
                  on:click={() => sizeChartComponent?.openChart()}
                  class="text-xs underline text-accent-muted hover:text-accent transition-colors"
                >
                  {t('productPage.sizeGuide')}
                </button>
              {/if}
            </div>

            <!-- Clothing Sizes -->
            {#if product.sizes && product.sizes.CLOTHING && product.sizes.CLOTHING.length > 0}
              <div class="mb-3">
                <div class="flex flex-wrap gap-2">
                  {#each product.sizes.CLOTHING as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `CLOTHING:${size}`)}
                      class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                      `CLOTHING:${size}`
                        ? 'bg-accent text-dark border-accent'
                        : 'bg-white text-black border-gray-300 hover:border-accent'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Shoe Sizes -->
            {#if product.sizes && product.sizes.SHOES && product.sizes.SHOES.length > 0}
              <div class="mb-3">
                <div class="flex flex-wrap gap-2">
                  {#each product.sizes.SHOES as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `SHOES:${size}`)}
                      class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                      `SHOES:${size}`
                        ? 'bg-accent text-dark border-accent'
                        : 'bg-white text-black border-gray-300 hover:border-accent'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Custom Sizes -->
            {#if product.sizes && product.sizes.CUSTOM && product.sizes.CUSTOM.length > 0}
              <div class="mb-3">
                <div class="flex flex-wrap gap-2">
                  {#each product.sizes.CUSTOM as sizeObj}
                    {#if sizeObj && typeof sizeObj === 'object' && 'value' in sizeObj}
                      <button
                        type="button"
                        on:click={() => (selectedSize = `CUSTOM:${sizeObj.value}`)}
                        class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                        `CUSTOM:${sizeObj.value}`
                          ? 'bg-accent text-dark border-accent'
                          : 'bg-white text-black border-gray-300 hover:border-accent'}"
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
              <div class="mb-3">
                <div class="flex flex-wrap gap-2">
                  {#each product.sizes.VOLUME as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `VOLUME:${size}`)}
                      class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                      `VOLUME:${size}`
                        ? 'bg-accent text-dark border-accent'
                        : 'bg-white text-black border-gray-300 hover:border-accent'}"
                    >
                      {size} ml
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Weight (g) Sizes -->
            {#if product.sizes && product.sizes.WEIGHT && product.sizes.WEIGHT.length > 0}
              <div class="mb-3">
                <div class="flex flex-wrap gap-2">
                  {#each product.sizes.WEIGHT as size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = `WEIGHT:${size}`)}
                      class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                      `WEIGHT:${size}`
                        ? 'bg-accent text-dark border-accent'
                        : 'bg-white text-black border-gray-300 hover:border-accent'}"
                    >
                      {size} g
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else if Array.isArray(product.sizes) && product.sizes.length > 0}
          <!-- Legacy format support -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-base font-medium">
                {t('productPage.size')} <span class="text-red-500">*</span>
              </h3>
            </div>
            <div class="flex flex-wrap gap-2">
              {#if product.productTypes && product.productTypes.includes('CUSTOM') && typeof product.sizes[0] === 'object'}
                {#each product.sizes as sizeObj}
                  {#if sizeObj && typeof sizeObj === 'object' && 'value' in sizeObj}
                    <button
                      type="button"
                      on:click={() => (selectedSize = String(sizeObj.value))}
                      class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                      sizeObj.value
                        ? 'bg-accent text-dark border-accent'
                        : 'bg-white text-black border-gray-300 hover:border-accent'}"
                    >
                      {getSizeButtonLabel(sizeObj)}
                    </button>
                  {/if}
                {/each}
              {:else}
                {#each product.sizes as size}
                  {#if typeof size === 'string'}
                    <button
                      type="button"
                      on:click={() => (selectedSize = size)}
                      class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                      size
                        ? 'bg-accent text-dark border-accent'
                        : 'bg-white text-black border-gray-300 hover:border-accent'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {:else if size && typeof size === 'object' && 'value' in size}
                    <button
                      type="button"
                      on:click={() => (selectedSize = String(size.value))}
                      class="px-4 py-2 text-sm border-2 transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                      size.value
                        ? 'bg-accent text-dark border-accent'
                        : 'bg-white text-black border-gray-300 hover:border-accent'}"
                    >
                      {getSizeButtonLabel(size)}
                    </button>
                  {/if}
                {/each}
              {/if}
            </div>
            {#if isComingSoon}
              <p class="mt-2 text-sm text-amber-600 font-medium">{t('productPage.comingSoon')}</p>
            {:else if isOutOfStock}
              <p class="mt-2 text-sm text-red-500 font-medium">{t('productPage.outOfStock')}</p>
            {:else if !selectedSize}
              <p class="mt-2 text-sm text-red-500">{t('productPage.pleaseSelectSize')}</p>
            {/if}
          </div>
        {:else if hasSizes && isOutOfStock}
          <!-- Show out of stock message if sizes are defined but none are available -->
          <div>
            <p class="text-sm text-red-500 font-medium">{t('productPage.outOfStock')}</p>
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
        <div>
          <label class="block text-sm font-medium mb-2">
            {t('productPage.quantity')}
            <div class="flex items-center gap-2 mt-2">
              <button
                type="button"
                on:click={() => quantity > 1 && quantity--}
                class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 text-sm"
              >
                -
              </button>
              <input
                type="number"
                bind:value={quantity}
                min="1"
                class="w-16 px-3 py-2 bg-white border border-gray-300 text-center text-black quantity-input text-sm"
              />
              <button
                type="button"
                on:click={() => quantity++}
                class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 text-sm"
              >
                +
              </button>
            </div>
          </label>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          on:click={addToCart}
          disabled={!canAddToCart || isOutOfStock || isComingSoon}
          class="flex-1 py-3 font-medium transition-colors text-base {canAddToCart &&
          !isOutOfStock &&
          !isComingSoon
            ? 'bg-accent text-dark hover:bg-accent-muted cursor-pointer'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'}"
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
            class="px-6 py-3 border-2 transition-colors font-medium flex items-center justify-center text-sm {isInWishlist
              ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
              : 'bg-white border-gray-300 text-black hover:border-accent'}"
            title={isInWishlist ? t('wishlist.removeFromWishlist') : t('productPage.wishlist')}
          >
            {#if wishlistLoading}
              <svg
                class="animate-spin h-5 w-5"
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
            {:else if isInWishlist}
              <svg
                class="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clip-rule="evenodd"
                />
              </svg>
            {:else}
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            {/if}
          </button>
        {/if}
      </div>

      <!-- Product info tabs: Description, Application, Composition, Brand, Additional -->
      <ProductInfoTabs {product} />

      <!-- Product Details -->
      <div class="border-t border-accent/20 pt-3">
        <h3 class="text-xs font-medium mb-2">{t('productPage.details')}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div class="flex justify-between py-1">
            <span class="text-accent-muted text-xs">{t('productPage.sku')}:</span>
            <span class="text-black font-medium text-xs">{product.sku}</span>
          </div>
          {#if product.category}
            <div class="flex justify-between py-1">
              <span class="text-accent-muted text-xs">{t('productPage.category')}:</span>
              <span class="text-black font-medium text-xs">{product.category.name}</span>
            </div>
          {/if}
          {#if !product.hideColor && product.colors && product.colors.length > 0}
            <div class="flex justify-between items-center py-1">
              <span class="text-accent-muted text-xs">{t('filter.color')}:</span>
              <div class="flex gap-1.5 flex-wrap">
                {#each product.colors as color}
                  <div
                    class="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded"
                    title={color.name}
                  >
                    <div
                      class="w-3 h-3 rounded border border-gray-300"
                      style="background-color: {color.hex};"
                    ></div>
                    <span class="text-black text-xs font-medium">{color.name}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Reviews -->
  {#if $settingsStore.reviewsEnabled}
    <div class="mt-12">
      <LazyComponent rootMargin="300px" placeholderHeight="400px">
        <Reviews productId={product.id} />
        <ReviewsSkeleton slot="placeholder" />
      </LazyComponent>
    </div>
  {/if}
</div>

<!-- Fullscreen Image Modal -->
{#if showZoomModal && product?.images}
  <div
    class="fixed inset-0 bg-white z-[9999] flex items-center justify-center mt-12"
    role="dialog"
    aria-modal="true"
    aria-label="Image gallery"
    tabindex="-1"
    bind:this={modalContainerElement}
  >
    <button
      type="button"
      class="absolute inset-0 h-full w-full cursor-default bg-transparent"
      aria-hidden="true"
      tabindex="-1"
      on:click={handleModalBackdropClick}
      on:keydown={(e) => {
        if (e.key === 'Escape') {
          closeZoomModal();
        }
      }}
    ></button>
    <!-- Close button -->
    <button
      on:click|stopPropagation={closeZoomModal}
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

    <div
      class="absolute top-4 left-4 md:top-8 md:left-8 z-50 flex items-center gap-2 bg-black/10 backdrop-blur-sm px-2 py-2"
    >
      <button
        type="button"
        on:click|stopPropagation={zoomOut}
        class="w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white transition-colors text-black border border-black/10"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        on:click|stopPropagation={zoomIn}
        class="w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white transition-colors text-black border border-black/10"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        on:click|stopPropagation={resetZoomFromButton}
        class="h-10 px-3 flex items-center justify-center bg-white/90 hover:bg-white transition-colors text-black border border-black/10 text-xs uppercase tracking-wider"
        aria-label="Reset zoom"
      >
        1:1
      </button>
    </div>

    <!-- Image container -->
    <div
      role="presentation"
      bind:this={imageContainerElement}
      class={`w-full mt-4 h-full flex items-center justify-center p-4 md:p-8 overflow-hidden relative ${isZoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
      on:wheel={handleWheel}
      on:touchstart={handleModalTouchStart}
      on:touchmove={handleModalTouchMove}
      on:touchend={handleModalTouchEnd}
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
          bind:this={modalImageElement}
          src={product.images[modalImageIndex].url}
          alt={getProductImageAlt(product.images[modalImageIndex].alt, product.name)}
          class={`max-w-full max-h-full object-contain select-none ${isZoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
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

<style>
  .quantity-input::-webkit-inner-spin-button,
  .quantity-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .quantity-input {
    -moz-appearance: textfield;
    -webkit-appearance: textfield;
    appearance: textfield;
  }

  .image-gallery-container {
    aspect-ratio: 1 / 1;
  }

  .image-gallery-container img {
    max-width: 100%;
    max-height: 100%;
  }
</style>
