<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    lookbookApi,
    type Lookbook,
    type ProductTag,
    type LookbookImage,
  } from '$lib/api/lookbook.api';
  import { t, translateSeason } from '$lib/utils/i18n';
  import { getErrorMessage } from '$lib/utils/error-handler';
  import { formatPrice } from '$lib/utils/price.utils';
  import { i18nStore } from '$lib/stores/i18n.store';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import LoadingBar from '$lib/components/LoadingBar.svelte';

  let lookbook: Lookbook | null = null;
  let loading = true;
  let error = '';
  let showProductTags = true;
  let viewMode: 'collage' | 'gallery' = 'collage';

  // Subscribe to language store
  $: currentLanguage = $i18nStore;

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
  let zoomLevel = 2; // Default zoom level
  let animationFrameId: number | null = null;
  let targetPanX = 0;
  let targetPanY = 0;

  // Design settings (loaded from localStorage)
  let pageSettings = {
    titleSize: 'text-5xl',
    titleColor: '',
    backgroundColor: '',
    paddingTop: 'py-12',
    paddingBottom: '',
    // Collage settings
    gridColumns: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    gap: 'gap-4',
    imageAspectRatio: 'aspect-auto',
    masonryLayout: false,
  };

  $: slug = $page.params.slug;

  // Load lookbook when language changes
  async function loadLookbook() {
    if (!slug || !currentLanguage) return; // Wait for language to be initialized

    loading = true;
    try {
      const response = await lookbookApi.getBySlug(slug, currentLanguage);
      lookbook = response.lookbook;

      // Load settings after lookbook is loaded
      if (lookbook?.id) {
        const savedSettings = localStorage.getItem(`lookbookDetailSettings_${lookbook.id}`);
        if (savedSettings) {
          try {
            pageSettings = { ...pageSettings, ...JSON.parse(savedSettings) };
          } catch (e) {
            console.error('Failed to load page settings:', e);
          }
        }
      }
      error = '';
    } catch (e) {
      error = getErrorMessage(e, 'lookbook.failedToLoad');
      console.error('Failed to load lookbook:', e);
    } finally {
      loading = false;
    }
  }

  // Track previous language to avoid unnecessary reloads
  let previousLanguage: string | undefined = undefined;
  let isInitialLoad = true;

  // Reload lookbook when language changes (but not on initial load)
  $: if (currentLanguage && currentLanguage !== previousLanguage && !isInitialLoad && slug) {
    previousLanguage = currentLanguage;
    loadLookbook();
  }

  onMount(async () => {
    // Wait a bit for language store to initialize from localStorage
    await new Promise((resolve) => setTimeout(resolve, 0));
    previousLanguage = currentLanguage;
    await loadLookbook();
    isInitialLoad = false;
  });

  // Style objects
  $: pageStyle = {
    backgroundColor: pageSettings.backgroundColor || undefined,
  };

  $: titleStyle = {
    color: pageSettings.titleColor || undefined,
  };

  // Update style strings when settings change
  $: pageStyleStr = Object.entries(pageStyle)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
  $: titleStyleStr = Object.entries(titleStyle)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  function isVideo(url: string): boolean {
    return (
      /\.(mp4|webm|ogg|mov)$/i.test(url) ||
      url.includes('video') ||
      url.includes('youtube') ||
      url.includes('vimeo')
    );
  }

  function getImageSize(index: number, total: number): string {
    // Create varied sizes for collage effect
    if (pageSettings.masonryLayout) {
      return 'aspect-auto';
    }

    const sizes = ['aspect-[9/16]'];
    return sizes[index % sizes.length];
  }

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
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
      if (modal) {
        modal.focus();
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
      let naturalWidth: number;
      let naturalHeight: number;

      if (imageElement instanceof HTMLImageElement) {
        naturalWidth = imageElement.naturalWidth || imageElement.clientWidth;
        naturalHeight = imageElement.naturalHeight || imageElement.clientHeight;
      } else if (imageElement instanceof HTMLVideoElement) {
        naturalWidth = imageElement.videoWidth || imageElement.clientWidth;
        naturalHeight = imageElement.videoHeight || imageElement.clientHeight;
      } else {
        naturalWidth = imageElement.clientWidth;
        naturalHeight = imageElement.clientHeight;
      }

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
    // Handle both img and video elements
    let naturalWidth: number;
    let naturalHeight: number;

    if (imageElement instanceof HTMLImageElement) {
      naturalWidth = imageElement.naturalWidth || imageElement.clientWidth;
      naturalHeight = imageElement.naturalHeight || imageElement.clientHeight;
    } else if (imageElement instanceof HTMLVideoElement) {
      naturalWidth = imageElement.videoWidth || imageElement.clientWidth;
      naturalHeight = imageElement.videoHeight || imageElement.clientHeight;
    } else {
      naturalWidth = imageElement.clientWidth;
      naturalHeight = imageElement.clientHeight;
    }

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
    let naturalWidth: number;
    let naturalHeight: number;

    if (imageElement instanceof HTMLImageElement) {
      naturalWidth = imageElement.naturalWidth || imageElement.clientWidth;
      naturalHeight = imageElement.naturalHeight || imageElement.clientHeight;
    } else if (imageElement instanceof HTMLVideoElement) {
      naturalWidth = imageElement.videoWidth || imageElement.clientWidth;
      naturalHeight = imageElement.videoHeight || imageElement.clientHeight;
    } else {
      naturalWidth = imageElement.clientWidth;
      naturalHeight = imageElement.clientHeight;
    }

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

  function nextModalImage() {
    if (lookbook?.images && modalImageIndex < lookbook.images.length - 1) {
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

  $: modalHasNext = lookbook?.images && modalImageIndex < lookbook.images.length - 1;
  $: modalHasPrev = modalImageIndex > 0;

  // Handle ESC key and arrow keys
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
        isZoomed = false;
      } else {
        closeModal();
      }
    }
  }
</script>

<main class="min-h-screen bg-white" style={pageStyleStr}>
  {#if loading}
    <div class="min-h-screen flex items-center justify-center">
      <div class="w-full py-8"><LoadingBar /></div>
    </div>
  {:else if error}
    <div class="min-h-screen flex items-center justify-center">
      <p class="text-red-400">{t('common.error')}: {error}</p>
    </div>
  {:else if !lookbook}
    <div class="min-h-screen flex items-center justify-center">
      <p class="text-accent-muted">{t('lookbook.lookbookNotFound')}</p>
    </div>
  {:else}
    <div class="container-custom {pageSettings.paddingTop} {pageSettings.paddingBottom}">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="{pageSettings.titleSize} font-bold mb-4" style={titleStyleStr}>
          {lookbook.title}
        </h1>
        {#if lookbook.season || lookbook.year}
          <p class="text-xl text-accent-muted mb-4" style={titleStyleStr}>
            {translateSeason(lookbook.season)}
            {lookbook.year}
          </p>
        {/if}
        {#if lookbook.description}
          <p class="text-lg text-accent-muted max-w-2xl" style={titleStyleStr}>
            {lookbook.description}
          </p>
        {/if}
      </div>

      <!-- View Mode Toggle -->
      <div class="flex justify-end gap-2 mb-6">
        <button
          on:click={() => (viewMode = 'collage')}
          class="px-4 py-2 {viewMode === 'collage'
            ? 'bg-accent text-dark'
            : 'bg-white border border-gray-300 text-black'}"
        >
          {t('lookbook.collage')}
        </button>
        <button
          on:click={() => (viewMode = 'gallery')}
          class="px-4 py-2 {viewMode === 'gallery'
            ? 'bg-accent text-dark'
            : 'bg-white border border-gray-300 text-black'}"
        >
          {t('lookbook.gallery')}
        </button>
      </div>

      <!-- Collage View -->
      {#if viewMode === 'collage' && lookbook.images && lookbook.images.length > 0}
        <div class="grid {pageSettings.gridColumns} {pageSettings.gap}">
          {#each lookbook.images as image, index}
            <div
              class="relative group {getImageSize(
                index,
                lookbook.images.length
              )} bg-dark-light overflow-hidden cursor-pointer"
              on:click={() => openModal(index)}
              role="button"
              tabindex="0"
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openModal(index);
                }
              }}
              aria-label="Open image gallery"
            >
              {#if isVideo(image.url)}
                <video src={image.url} class="w-full h-full object-cover" controls muted loop
                ></video>
              {:else}
                <BlurredImage
                  src={image.url}
                  alt={image.alt || `Image ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              {/if}

              <!-- Product Tags -->
              {#if showProductTags && image.productTags && image.productTags.length > 0}
                {#each image.productTags as tag}
                  <div
                    class="absolute w-4 h-4 bg-accent -full cursor-pointer hover:scale-125 transition-transform z-10"
                    style="left: {tag.x * 100}%; top: {tag.y *
                      100}%; transform: translate(-50%, -50%);"
                    title={tag.product?.name || 'Product'}
                  >
                    <div
                      class="absolute top-6 left-1/2 transform -translate-x-1/2 bg-dark border border-accent/20 p-3 min-w-[200px] opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-20"
                    >
                      {#if tag.product}
                        <a href="/shop/product/{tag.product.slug}" class="block">
                          <p class="font-medium mb-1">{tag.product.name}</p>
                          <p class="text-accent-muted text-sm">{formatPrice(tag.product.price)}</p>
                        </a>
                      {/if}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {/each}
        </div>
      {:else if viewMode === 'gallery' && lookbook.images && lookbook.images.length > 0}
        <!-- Gallery View (original) -->
        <div class="space-y-8">
          {#each lookbook.images as image, index}
            <div
              class="relative group overflow-hidden cursor-pointer"
              on:click={() => openModal(index)}
              role="button"
              tabindex="0"
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openModal(index);
                }
              }}
              aria-label="Open image gallery"
            >
              {#if isVideo(image.url)}
                <video src={image.url} class="w-full overflow-hidden" controls muted loop></video>
              {:else}
                <BlurredImage
                  src={image.url}
                  alt={image.alt || `Image ${index + 1}`}
                  className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
                />
              {/if}

              <!-- Product Tags -->
              {#if showProductTags && image.productTags && image.productTags.length > 0}
                {#each image.productTags as tag}
                  <div
                    class="absolute w-4 h-4 bg-accent -full cursor-pointer hover:scale-125 transition-transform z-10"
                    style="left: {tag.x * 100}%; top: {tag.y *
                      100}%; transform: translate(-50%, -50%);"
                    title={tag.product?.name || 'Product'}
                  >
                    <div
                      class="absolute top-6 left-1/2 transform -translate-x-1/2 bg-dark border border-accent/20 p-3 min-w-[200px] opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-20"
                    >
                      {#if tag.product}
                        <a href="/shop/product/{tag.product.slug}" class="block">
                          <p class="font-medium mb-1">{tag.product.name}</p>
                          <p class="text-accent-muted text-sm">{formatPrice(tag.product.price)}</p>
                        </a>
                      {/if}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="bg-dark-light aspect-[9/16] flex items-center justify-center">
          <p class="text-accent-muted">{t('lookbook.noImagesAvailable')}</p>
        </div>
      {/if}

      <!-- Related Products Section -->
      {#if lookbook.images}
        {@const uniqueProducts = new Map()}
        {#each lookbook.images as image}
          {#if image.productTags}
            {#each image.productTags as tag}
              {#if tag.product && !uniqueProducts.has(tag.product.id)}
                {uniqueProducts.set(tag.product.id, tag.product)}
              {/if}
            {/each}
          {/if}
        {/each}
        {@const productsList = Array.from(uniqueProducts.values())}
        {#if productsList.length > 0}
          <div class="mt-12">
            <h2 class="text-3xl font-bold mb-8">{t('lookbook.productsInThisLookbook')}</h2>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div class="lg:col-span-2 space-y-4">
                {#each productsList as product}
                  <div
                    class="bg-gray-50 p-6 flex gap-6 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <a href="/shop/product/{product.slug}" class="flex-shrink-0">
                      <div class="w-24 aspect-[9/16] bg-gray-200 overflow-hidden">
                        {#if product.images && product.images.length > 0}
                          <BlurredImage
                            src={product.images[0].url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        {:else}
                          <div class="w-full h-full flex items-center justify-center">
                            <p class="text-xs text-gray-400">{t('order.noImage')}</p>
                          </div>
                        {/if}
                      </div>
                    </a>
                    <div class="flex-1 min-w-0">
                      <a href="/shop/product/{product.slug}">
                        <h3
                          class="text-xl font-medium mb-2 text-black hover:text-gray-700 transition-colors"
                        >
                          {product.name}
                        </h3>
                      </a>
                      <p class="text-lg font-semibold text-black">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</main>

<!-- Fullscreen Image Modal -->
{#if isModalOpen && lookbook?.images}
  <div
    class="fixed inset-0 bg-white z-[9999] flex items-center justify-center mt-12"
    role="dialog"
    aria-modal="true"
    aria-label="Image gallery"
    tabindex="-1"
  >
    <button
      type="button"
      class="absolute inset-0 h-full w-full cursor-default bg-transparent"
      aria-hidden="true"
      tabindex="-1"
      on:click={handleModalBackdropClick}
      on:keydown={(e) => {
        if (e.key === 'Escape') {
          closeModal();
        }
      }}
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

    <!-- Image/Video container -->
    <div
      role="presentation"
      bind:this={imageContainerElement}
      class="w-full mt-4 h-full flex items-center justify-center p-4 md:p-8 overflow-hidden relative"
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
      on:wheel={handleWheel}
    >
      {#if isVideo(lookbook.images[modalImageIndex].url)}
        <video
          bind:this={imageElement}
          src={lookbook.images[modalImageIndex].url}
          class="max-w-full max-h-full object-contain {isZoomed
            ? 'cursor-grab'
            : 'cursor-default'} {isDragging ? 'cursor-grabbing' : ''}"
          style="transform: {isZoomed
            ? `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`
            : 'scale(1) translate(0, 0)'}; transform-origin: {isZoomed
            ? `${zoomX}% ${zoomY}%`
            : 'center'}; transition: {isZoomed && !isDragging
            ? 'transform 0.2s ease-out'
            : 'none'}; will-change: {isDragging ? 'transform' : 'auto'};"
          on:click|stopPropagation={handleImageClick}
          on:mousedown|stopPropagation={handleMouseDown}
          controls={!isZoomed}
          autoplay
          muted
          loop
        ></video>
      {:else}
        <img
          bind:this={imageElement}
          src={lookbook.images[modalImageIndex].url}
          alt={lookbook.images[modalImageIndex].alt || `Image ${modalImageIndex + 1}`}
          class="max-w-full max-h-full object-contain select-none {isZoomed
            ? 'cursor-grab'
            : 'cursor-default'} {isDragging ? 'cursor-grabbing' : ''}"
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
    {#if lookbook.images.length > 1}
      <div
        class="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/10 backdrop-blur-sm rounded-full text-black text-sm md:text-base"
      >
        {modalImageIndex + 1} / {lookbook.images.length}
      </div>
    {/if}
  </div>
{/if}

<svelte:window on:keydown={handleKeydown} />
