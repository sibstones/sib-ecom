<script lang="ts">
  import type { Product } from '$lib/api/product.api';
  import { productApi } from '$lib/api/product.api';
  import { formatPrice } from '$lib/utils/price.utils';
  import { getProductImageAlt } from '$lib/utils/image.utils';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import Reviews from '$lib/components/product/Reviews.svelte';
  import SizeChart from '$lib/components/product/SizeChart.svelte';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import LazyComponent from '$lib/components/LazyComponent.svelte';
  import { settingsStore } from '$lib/stores/settings.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';
  import {
    getSizeButtonLabel,
    productSizeButtonClass,
    sizeButtonsWrapClass,
  } from '$lib/utils/size.utils';
  import ProductSizeOptionButton from '$lib/components/product/ProductSizeOptionButton.svelte';
  import { fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { onMount, onDestroy, tick } from 'svelte';

  // Custom horizontal slide transition with smoother easing
  function slideHorizontal(
    node: HTMLElement,
    { duration = 600, direction = 'right' }: { duration?: number; direction?: 'left' | 'right' }
  ) {
    return {
      duration,
      easing: (t: number) => {
        // Smooth cubic-bezier easing for fluid transitions
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      },
      css: (t: number) => {
        // Smooth fade and slide transition
        const opacity = Math.min(1, t * 1.2); // Slightly faster fade-in
        const x = direction === 'right' ? (1 - t) * 100 : (t - 1) * 100;
        return `
          opacity: ${opacity};
          transform: translateX(${x}%);
          transition: opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1);
        `;
      },
    };
  }

  export let product: Product;
  export let sizeChartData: any = null;
  export let sizeChartEnabled: boolean = false;

  let sizeChartComponent: SizeChart;
  export let selectedImageIndex: number;
  export let selectedVariant: string | undefined;
  export let selectedSize: string | null = null;
  export let quantity: number;
  export let isInWishlist: boolean;
  export let wishlistLoading: boolean;
  export let currentPrice: number;
  export let currentImage: { url: string; alt?: string } | undefined;
  export let hasNext: boolean;
  export let hasPrev: boolean;
  export let imageContainer: HTMLDivElement;
  let modalElement: HTMLDivElement;
  let modalThumbnailListElement: HTMLDivElement | null = null;

  // Stock management
  let availableStock: number = 0;
  let loadingStock: boolean = false;

  export let selectImage: (index: number) => void;
  export let nextImage: () => void;
  export let prevImage: () => void;
  export let handleTouchStart: (e: TouchEvent) => void;
  export let handleTouchEnd: (e: TouchEvent) => void;
  export let addToCart: () => void;
  export let toggleWishlist: () => void;
  export let showMenuButton: boolean = false;
  export let toggleMobileFilters: (() => void) | undefined = undefined;
  export let mobileFiltersOpen: boolean = false;
  export let onBack: (() => void) | undefined = undefined;
  function consumeValue(..._values: unknown[]) {}
  consumeValue(currentImage, selectImage);

  function extractSelectedSizeValue(size: string | null): string | null {
    if (!size) return null;
    return size.includes(':') ? size.split(':')[1].trim() : size.trim();
  }

  function hexToRgb(hex: string | undefined): [number, number, number] | null {
    if (!hex) return null;
    const normalized = hex.trim();
    const shortHex = /^#([0-9a-f]{3})$/i;
    const longHex = /^#([0-9a-f]{6})$/i;

    if (shortHex.test(normalized)) {
      const [, short] = normalized.match(shortHex) as RegExpMatchArray;
      return short.split('').map((char) => parseInt(char + char, 16)) as [number, number, number];
    }

    if (longHex.test(normalized)) {
      return [
        parseInt(normalized.slice(1, 3), 16),
        parseInt(normalized.slice(3, 5), 16),
        parseInt(normalized.slice(5, 7), 16),
      ];
    }

    return null;
  }

  function rgbaColor(hex: string | undefined, opacityPercent: number | undefined): string {
    const rgb = hexToRgb(hex);
    const alpha = Math.max(0, Math.min(100, opacityPercent ?? 100)) / 100;
    if (!rgb) return `rgba(255, 255, 255, ${alpha})`;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function blurStyle(blurPx: number | undefined): string {
    const blur = Math.max(0, blurPx ?? 0);
    if (blur === 0) return '';
    return `backdrop-filter: blur(${blur}px) saturate(180%); -webkit-backdrop-filter: blur(${blur}px) saturate(180%);`;
  }

  function handleAddToCart(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    console.log('ProductPageGrid: handleAddToCart called');
    if (addToCart) {
      addToCart();
    } else {
      console.error('ProductPageGrid: addToCart function is not defined');
    }
  }

  let imageKey = 0;
  let secondImageKey = 0;
  let animationCounter = 0; // Counter to ensure unique keys for synchronization
  let isTransitioning = false;
  let descriptionExpanded = false;
  let slideDirection: 'left' | 'right' = 'right';
  let prevImageIndex = 0;
  let galleryReady = false;
  const DESCRIPTION_PREVIEW_LENGTH = 20; // Characters to show in preview (always visible)

  let hoverOverlayLeft = 0;
  $: hoverOverlayLeft = 0;

  // Modal state
  let isModalOpen = false;
  let isHovering = false;
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
  const MODAL_INITIAL_ZOOM = 1.4;
  let modalScrollElement: HTMLDivElement | null = null;
  let galleryWheelLock = false;
  let galleryWheelUnlockTimer: number | null = null;
  let desktopGalleryScrollElement: HTMLDivElement | null = null;

  // Watch for image index changes to trigger animation
  $: if (selectedImageIndex !== undefined) {
    if (!galleryReady) {
      prevImageIndex = selectedImageIndex;
      imageKey = selectedImageIndex;
      if (product?.images && product.images.length > 1) {
        secondImageKey =
          selectedImageIndex < product.images.length - 1 ? selectedImageIndex + 1 : 0;
      }
    } else {
      if (selectedImageIndex !== prevImageIndex) {
        // Determine slide direction
        if (selectedImageIndex > prevImageIndex) {
          slideDirection = 'right';
        } else if (selectedImageIndex < prevImageIndex) {
          slideDirection = 'left';
        }
        prevImageIndex = selectedImageIndex;

        isTransitioning = true;
        // Increment counter to ensure both images get new keys simultaneously
        animationCounter++;
        // Update both keys synchronously in the same reactive update
        imageKey = selectedImageIndex;
        if (product?.images && product.images.length > 1) {
          if (selectedImageIndex < product.images.length - 1) {
            secondImageKey = selectedImageIndex + 1;
          } else {
            secondImageKey = 0;
          }
        }
        // Reset transition flag after animation completes
        setTimeout(() => {
          isTransitioning = false;
        }, 600);
      }
    }
  }

  function scrollDesktopGalleryToIndex(index: number) {
    if (!desktopGalleryScrollElement || !product?.images || product.images.length <= 1) return;
    if (index < 0 || index >= product.images.length) return;

    void tick().then(() => {
      const galleryElement = desktopGalleryScrollElement;
      if (!galleryElement) return;

      const item = galleryElement.querySelector(
        `[data-gallery-index="${index}"]`
      ) as HTMLElement | null;

      if (!item) return;

      const containerWidth = galleryElement.clientWidth;
      const maxScrollLeft = galleryElement.scrollWidth - containerWidth;
      const targetScrollLeft = item.offsetLeft;

      galleryElement.scrollTo({
        left: Math.max(0, Math.min(maxScrollLeft, targetScrollLeft)),
        behavior: 'smooth',
      });
    });
  }

  $: if (!isModalOpen && selectedImageIndex !== undefined) {
    scrollDesktopGalleryToIndex(selectedImageIndex);
  }

  // Initialize on mount
  onMount(() => {
    galleryReady = true;
    // Initialize secondImageKey on mount
    if (product?.images && product.images.length > 1 && selectedImageIndex !== undefined) {
      if (selectedImageIndex < product.images.length - 1) {
        secondImageKey = selectedImageIndex + 1;
      } else {
        secondImageKey = 0;
      }
    }
  });

  onDestroy(() => {
    if (galleryWheelUnlockTimer) {
      clearTimeout(galleryWheelUnlockTimer);
      galleryWheelUnlockTimer = null;
    }
  });

  // Handle hover state
  function handleMouseEnter() {
    isHovering = true;
  }

  function handleMouseLeave() {
    isHovering = false;
  }

  // Wrapper functions for touch handlers
  function handleTouchStartWrapper(e: TouchEvent) {
    if (handleTouchStart) {
      handleTouchStart(e);
    }
  }

  function handleTouchEndWrapper(e: TouchEvent) {
    if (handleTouchEnd) {
      handleTouchEnd(e);
    }
  }

  // Check if description needs truncation
  $: descriptionNeedsTruncation =
    product.description && product.description.length > DESCRIPTION_PREVIEW_LENGTH;
  $: previewText = product.description
    ? product.description.substring(0, DESCRIPTION_PREVIEW_LENGTH)
    : '';
  $: remainingText =
    product.description && product.description.length > DESCRIPTION_PREVIEW_LENGTH
      ? product.description.substring(DESCRIPTION_PREVIEW_LENGTH)
      : '';

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

  // Load available stock when size changes
  $: if (product && selectedSize) {
    loadAvailableStock();
  }

  // Reset available stock when size is deselected
  $: if (!selectedSize) {
    availableStock = 0;
  }

  // Ensure quantity doesn't exceed available stock
  $: if (availableStock > 0 && quantity > availableStock) {
    quantity = availableStock;
  }

  // Check if quantity controls should be disabled
  $: quantityControlsDisabled = !sizeSelected || availableStock === 0;
  $: canIncreaseQuantity = sizeSelected && quantity < availableStock && availableStock > 0;
  $: canDecreaseQuantity = quantity > 1;

  async function loadAvailableStock() {
    if (!product || !selectedSize) {
      availableStock = 0;
      return;
    }

    loadingStock = true;
    try {
      const response = await productApi.getAvailableStock(product.id, selectedSize);
      availableStock = response.availableStock || 0;

      // If current quantity exceeds available stock, adjust it
      if (quantity > availableStock && availableStock > 0) {
        quantity = availableStock;
      } else if (availableStock === 0) {
        quantity = 1; // Reset to 1 if out of stock
      }
    } catch (error) {
      console.error('Failed to load available stock:', error);
      availableStock = 0;
    } finally {
      loadingStock = false;
    }
  }

  function increaseQuantity() {
    if (!canIncreaseQuantity) return;
    if (quantity < availableStock) {
      quantity++;
    } else {
      notificationStore.error(t('productPage.maxStockQuantity', { count: availableStock }));
    }
  }

  function decreaseQuantity() {
    if (!canDecreaseQuantity) return;
    if (quantity > 1) {
      quantity--;
    }
  }

  function validateQuantity() {
    if (sizeSelected && availableStock > 0) {
      if (quantity > availableStock) {
        quantity = availableStock;
        notificationStore.error(t('productPage.maxStockQuantity', { count: availableStock }));
      } else if (quantity < 1) {
        quantity = 1;
      }
    } else if (quantity < 1) {
      quantity = 1;
    }
  }

  // Watch quantity changes to validate against available stock
  $: if (sizeSelected && availableStock > 0 && quantity > availableStock) {
    quantity = availableStock;
    notificationStore.error(t('productPage.maxStockQuantity', { count: availableStock }));
  }

  // Ensure quantity is at least 1
  $: if (quantity < 1) {
    quantity = 1;
  }

  // Get aspect ratio from settings
  $: aspectRatio = $settingsStore.productImageAspectRatio || '9/16';
  $: aspectRatioValue = aspectRatio.split('/').map(Number);
  $: aspectRatioStyle =
    aspectRatioValue.length === 2
      ? `aspect-ratio: ${aspectRatioValue[0]} / ${aspectRatioValue[1]};`
      : 'aspect-ratio: 9 / 16;';
  $: productInfoPanelBorderOpacity = Math.max(
    0,
    $settingsStore.productPageGridPanelBorderOpacity ?? 0
  );
  $: productInfoPanelStyle = `
    min-width: 296px;
    min-height: 738px;
    background-color: ${rgbaColor($settingsStore.productPageGridPanelBackgroundColor || '#ffffff', $settingsStore.productPageGridPanelOpacity ?? 60)};
    border: ${productInfoPanelBorderOpacity > 0 ? `1px solid ${rgbaColor($settingsStore.productPageGridPanelBorderColor || '#e5e7eb', productInfoPanelBorderOpacity)}` : 'none'};
    border-radius: ${Math.max(0, $settingsStore.productPageGridPanelBorderRadius ?? 0)}px;
    ${blurStyle($settingsStore.productPageGridPanelBlur ?? 12)}
  `;

  // Debug: watch selectedSize changes
  $: if (selectedSize !== null && selectedSize !== undefined) {
    console.log(
      'ProductPageGrid: selectedSize changed to:',
      selectedSize,
      'type:',
      typeof selectedSize,
      'canAddToCart:',
      canAddToCart
    );
  }

  // Modal functions
  async function openModal(index: number) {
    modalImageIndex = index;
    isModalOpen = true;
    resetZoom(); // Reset zoom when opening modal
    // Prevent body scroll
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    await tick();
    const selectedThumb = document.getElementById(`modal-thumb-${index}`);
    selectedThumb?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    const selectedModalImage = document.getElementById(`modal-image-${index}`);
    selectedModalImage?.scrollIntoView({ block: 'start', behavior: 'auto' });
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

  function setModalImage(index: number) {
    if (!product?.images || index < 0 || index >= product.images.length) return;
    modalImageIndex = index;
    resetZoom();
    void tick().then(() => {
      const selectedThumb = document.getElementById(`modal-thumb-${index}`);
      selectedThumb?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      const selectedModalImage = document.getElementById(`modal-image-${index}`);
      selectedModalImage?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
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
    if (!imageElement || !imageContainerElement) return;

    event.preventDefault();
    event.stopPropagation();

    if (!isZoomed && product?.images && product.images.length > 1) {
      if (event.deltaY > 0 && modalImageIndex < product.images.length - 1) {
        setModalImage(modalImageIndex + 1);
      } else if (event.deltaY < 0 && modalImageIndex > 0) {
        setModalImage(modalImageIndex - 1);
      }
      return;
    }

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

  $: if (isModalOpen && modalThumbnailListElement) {
    void tick().then(() => {
      const activeThumb = document.getElementById(`modal-thumb-${modalImageIndex}`);
      activeThumb?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    });
  }

  // Sync modal index when selectedImageIndex changes (if modal is open)
  $: if (isModalOpen && selectedImageIndex !== undefined) {
    modalImageIndex = selectedImageIndex;
    resetZoom(); // Reset zoom when changing image
  }

  // Handle ESC key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isModalOpen) {
      closeModal();
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

  // Handle image container click - only open modal if click is on image itself, not on buttons
  function handleImageContainerClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Don't open modal if clicking on navigation buttons, overlay, or SVG icons
    const clickedButton = target.closest('button');
    const clickedOverlay = target.closest('.absolute.inset-0');
    const clickedSvg = target.closest('svg');
    const clickedPlusIcon = target.closest('.w-12.h-12');

    if (
      clickedButton ||
      clickedOverlay ||
      target.tagName === 'BUTTON' ||
      clickedSvg ||
      clickedPlusIcon
    ) {
      // Let the button handle its own click
      return;
    }

    // Only open modal if clicking directly on image or its container div
    if (target.tagName === 'IMG' || (target.classList.contains('image-slide') && !clickedButton)) {
      openModal(selectedImageIndex);
    }
  }

  function handleGalleryWheel(event: WheelEvent) {
    if (!product?.images || product.images.length <= 1 || isModalOpen) return;

    const isHorizontalGesture =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 0;
    const primaryDelta = isHorizontalGesture ? event.deltaX : 0;

    if (primaryDelta === 0) return;

    event.preventDefault();
    event.stopPropagation();

    if (galleryWheelUnlockTimer) {
      clearTimeout(galleryWheelUnlockTimer);
    }

    if (galleryWheelLock || isTransitioning) {
      galleryWheelUnlockTimer = window.setTimeout(() => {
        galleryWheelLock = false;
        galleryWheelUnlockTimer = null;
      }, 350);
      return;
    }

    galleryWheelLock = true;

    if (primaryDelta > 0) {
      nextImage();
    } else if (primaryDelta < 0) {
      prevImage();
    }

    galleryWheelUnlockTimer = window.setTimeout(() => {
      galleryWheelLock = false;
      galleryWheelUnlockTimer = null;
    }, 350);
  }
</script>

<div class="py-1 relative">
  <!-- Navigation Buttons -->
  {#if onBack || (showMenuButton && toggleMobileFilters)}
    <div
      class="mb-4 flex items-center justify-between gap-3 lg:hidden {mobileFiltersOpen
        ? 'hidden'
        : ''}"
    >
      {#if onBack}
        <button
          type="button"
          on:click={onBack}
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
      {/if}

      {#if showMenuButton && toggleMobileFilters}
        <button
          on:click={toggleMobileFilters}
          class="inline-flex items-center gap-2 px-4 py-2 border border-black hover:bg-gray-50 transition-colors whitespace-nowrap text-sm font-medium bg-white"
          aria-label={t('productPage.menu')}
        >
          {t('productPage.menu')}
        </button>
      {/if}
    </div>

    <div
      class="hidden lg:flex absolute top-8 items-center gap-3 {mobileFiltersOpen
        ? 'lg:hidden'
        : ''}"
      style="z-index: 50;"
    >
      {#if onBack}
        <button
          type="button"
          on:click={onBack}
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
      {/if}

      {#if showMenuButton && toggleMobileFilters}
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

  <div class="flex items-start gap-4">
    <!-- Content -->
    <div class="flex-1 space-y-12 min-w-0">
      <!-- Row 1: Full width image with info overlay and third image partially visible -->
      <div class="relative overflow-visible w-full max-w-full mx-auto journal-container lg:px-0">
        <div class="flex flex-col lg:flex-row gap-8 items-start w-full overflow-visible max-w-full">
          <!-- Image Gallery - Mobile: single image, Desktop: full width slider with info overlay -->
          {#if product.images && product.images.length > 0}
            <!-- Mobile: Single Image View -->
            <div class="relative flex-shrink-0 w-full lg:hidden lg:z-20">
              <div
                class="relative image-gallery-container"
                bind:this={imageContainer}
                on:touchstart={handleTouchStartWrapper}
                on:touchend={handleTouchEndWrapper}
                on:mouseenter={handleMouseEnter}
                on:mouseleave={handleMouseLeave}
                on:click={handleImageContainerClick}
                on:wheel={handleGalleryWheel}
                role="button"
                tabindex="0"
                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal(selectedImageIndex);
                  }
                }}
                aria-label="Open image gallery"
              >
                <div class="w-full overflow-hidden relative" style={aspectRatioStyle}>
                  {#key `${imageKey}-${animationCounter}`}
                    <BlurredImage
                      src={product.images[selectedImageIndex].url}
                      alt={getProductImageAlt(product.images[selectedImageIndex].alt, product.name)}
                      className="w-full h-full object-cover select-none image-slide cursor-pointer"
                      style="width: 100%; height: 100%; object-fit: cover;"
                      eager={selectedImageIndex === 0}
                      fetchPriority="high"
                    />
                  {/key}
                </div>

                {#if product.images && product.images.length > 1}
                  <!-- Previous button -->
                  {#if hasPrev}
                    <button
                      on:click|stopPropagation={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      disabled={isTransitioning}
                      class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed z-50"
                      style="pointer-events: auto;"
                      aria-label="Previous image"
                    >
                      <svg
                        class="w-5 h-5 text-black"
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
                  {#if hasNext}
                    <button
                      on:click|stopPropagation={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      disabled={isTransitioning}
                      class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed z-50"
                      style="pointer-events: auto;"
                      aria-label="Next image"
                    >
                      <svg
                        class="w-5 h-5 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  {/if}
                {/if}
              </div>
            </div>

            <!-- Desktop: Two images side by side, info overlay, third image partially visible -->
            {#if product.images && product.images.length > 1}
              <!-- Container with overflow for third image; min-w-0 so video cannot expand column -->
              <div
                class="hidden lg:block relative w-full overflow-visible lg:z-20 lg:min-w-0 lg:flex-1"
              >
                <div
                  class="relative image-gallery-container w-full min-w-0"
                  bind:this={imageContainer}
                  on:mouseenter={handleMouseEnter}
                  on:mouseleave={handleMouseLeave}
                  on:click={handleImageContainerClick}
                  on:wheel={handleGalleryWheel}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openModal(selectedImageIndex);
                    }
                  }}
                  aria-label="Open image gallery"
                >
                  <div
                    class="relative desktop-gallery-scroll w-full overflow-x-auto overflow-y-hidden min-w-0 snap-x snap-mandatory scroll-smooth"
                    bind:this={desktopGalleryScrollElement}
                  >
                    <div class="flex desktop-slider-track items-start justify-start">
                      {#each product.images as image, index}
                        <div
                          class="flex-shrink-0 desktop-slider-image desktop-slider-image-item snap-start"
                          style={aspectRatioStyle}
                          data-gallery-index={index}
                        >
                          <div class="desktop-slider-image-inner">
                            <BlurredImage
                              src={image.url}
                              alt={getProductImageAlt(image.alt, product.name)}
                              className="w-full h-full object-cover select-none image-slide cursor-pointer"
                              style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
                              eager={index === selectedImageIndex ||
                                index === selectedImageIndex + 1}
                              fetchPriority={index === selectedImageIndex ? 'high' : 'auto'}
                            />
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>

                  <!-- Navigation buttons -->
                  {#if hasPrev}
                    <button
                      on:click|stopPropagation={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      disabled={isTransitioning}
                      class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/90 hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed z-50"
                      style="pointer-events: auto;"
                      aria-label="Previous image"
                    >
                      <svg
                        class="w-6 h-6 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  {/if}
                  {#if hasNext}
                    <button
                      on:click|stopPropagation={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      disabled={isTransitioning}
                      class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/60 hover:bg-white/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-50 backdrop-blur-md"
                      style="pointer-events: auto;"
                      aria-label="Next image"
                    >
                      <svg
                        class="w-6 h-6 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  {/if}
                </div>
              </div>
            {:else}
              <!-- Single image on desktop -->
              <div class="hidden lg:block relative flex-shrink-0 w-[30%] lg:z-20">
                <div
                  class="relative image-gallery-container"
                  bind:this={imageContainer}
                  on:mouseenter={handleMouseEnter}
                  on:mouseleave={handleMouseLeave}
                  on:click={handleImageContainerClick}
                  on:wheel={handleGalleryWheel}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openModal(selectedImageIndex);
                    }
                  }}
                  aria-label="Open image gallery"
                >
                  <div class="w-full overflow-hidden relative" style={aspectRatioStyle}>
                    <BlurredImage
                      src={product.images[0].url}
                      alt={getProductImageAlt(product.images[0].alt, product.name)}
                      className="w-full h-full object-cover select-none image-slide cursor-pointer"
                      style="width: 100%; height: 100%; object-fit: cover;"
                      eager={true}
                      fetchPriority="high"
                    />
                  </div>
                </div>
              </div>
            {/if}
          {/if}

          <!-- Product Info - Overlay on top of image (absolute positioned) -->
          <div
            class="flex-shrink-0 w-full lg:w-[25%] lg:max-w-[400px] space-y-6 relative lg:absolute lg:right-0 lg:top-16 lg:z-30 lg:flex lg:flex-col lg:justify-center lg:pr-8 lg:pl-8"
            style={productInfoPanelStyle}
          >
            <!-- Header -->
            <div>
              <h1 class="text-2xl font-bold mb-2">{product.name}</h1>
              {#if product.brand && $settingsStore.brandsEnabled}
                <p class="text-accent-muted mb-4">{product.brand.name}</p>
              {/if}
              <div class="flex items-center gap-4 mb-4">
                {#if product.priceOnRequest || !product.price || currentPrice === 0}
                  <p class="text-2xl font-bold">{t('product.priceOnRequest')}</p>
                {:else}
                  <p class="text-2xl font-bold">{formatPrice(currentPrice)}</p>
                  {#if product.compareAtPrice && (typeof product.compareAtPrice === 'number' ? product.compareAtPrice : parseFloat(String(product.compareAtPrice))) > currentPrice}
                    <p class="text-lg text-accent-muted line-through">
                      {formatPrice(product.compareAtPrice)}
                    </p>
                  {/if}
                {/if}
              </div>
            </div>

            <!-- Description -->
            {#if product.description}
              <div class="border-t border-gray-200 pt-2">
                {#if descriptionNeedsTruncation}
                  <button
                    type="button"
                    class="w-full text-left rounded-sm -mx-1 px-1 py-0.5 hover:bg-black/5 transition-colors cursor-pointer"
                    on:click={() => (descriptionExpanded = !descriptionExpanded)}
                    aria-expanded={descriptionExpanded}
                    aria-label={descriptionExpanded
                      ? t('productPage.hideDescription')
                      : t('productPage.showDescription')}
                  >
                    <h2
                      class="text-sm font-semibold mb-2 uppercase tracking-wider pointer-events-none"
                    >
                      {t('productPage.tabDescription')}
                    </h2>
                    <div class="flex items-start gap-2 pointer-events-none">
                      <span class="flex-shrink-0 mt-0.5 text-accent" aria-hidden="true">
                        {#if descriptionExpanded}
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
                          </svg>
                        {:else}
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        {/if}
                      </span>
                      <p class="text-sm text-accent-muted whitespace-pre-line flex-1">
                        <span>{previewText}</span>
                        {#if descriptionExpanded}
                          <span>{remainingText}</span>
                        {/if}
                      </p>
                    </div>
                  </button>
                {:else}
                  <h2 class="text-sm font-semibold mb-2 uppercase tracking-wider">
                    {t('productPage.tabDescription')}
                  </h2>
                  <p class="text-sm text-accent-muted whitespace-pre-line">{product.description}</p>
                {/if}
              </div>
            {/if}

            <!-- Variants -->
            {#if product.variants && product.variants.length > 0}
              <div class="border-t border-gray-200 pt-2">
                <h3 class="text-sm font-semibold mb-3 uppercase tracking-wider">
                  {t('productPage.variants')}
                </h3>
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
              <div class="border-t border-gray-200 pt-2 min-w-0">
                <div class="flex items-center gap-3 mb-3">
                  <h3 class="text-sm font-semibold uppercase tracking-wider">
                    {t('productPage.size')} <span class="text-red-500">*</span>
                  </h3>
                  {#if sizeChartEnabled && sizeChartData}
                    <button
                      on:click={() => {
                        console.log('Size Guide clicked, sizeChartComponent:', sizeChartComponent);
                        if (sizeChartComponent) {
                          sizeChartComponent.openChart();
                        } else {
                          console.error('sizeChartComponent is not defined');
                        }
                      }}
                      class="text-xs underline text-accent-muted hover:text-accent transition-colors uppercase tracking-wider"
                    >
                      {t('productPage.sizeGuide')}
                    </button>
                  {/if}
                </div>

                <!-- Clothing Sizes -->
                {#if product.sizes && product.sizes.CLOTHING && product.sizes.CLOTHING.length > 0}
                  <div class="mb-4">
                    <div class={sizeButtonsWrapClass}>
                      {#each product.sizes.CLOTHING as size}
                        <ProductSizeOptionButton
                          {size}
                          selected={selectedSize === `CLOTHING:${size}`}
                          on:click={() => (selectedSize = `CLOTHING:${size}`)}
                        />
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Shoe Sizes -->
                {#if product.sizes && product.sizes.SHOES && product.sizes.SHOES.length > 0}
                  <div class="mb-4">
                    <div class={sizeButtonsWrapClass}>
                      {#each product.sizes.SHOES as size}
                        <ProductSizeOptionButton
                          {size}
                          selected={selectedSize === `SHOES:${size}`}
                          on:click={() => (selectedSize = `SHOES:${size}`)}
                        />
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Custom Sizes -->
                {#if product.sizes && product.sizes.CUSTOM && product.sizes.CUSTOM.length > 0}
                  <div class="mb-4">
                    <div class={sizeButtonsWrapClass}>
                      {#each product.sizes.CUSTOM as sizeObj}
                        {#if sizeObj && typeof sizeObj === 'object' && 'value' in sizeObj}
                          <ProductSizeOptionButton
                            size={sizeObj}
                            selected={selectedSize === `CUSTOM:${sizeObj.value}`}
                            on:click={() => (selectedSize = `CUSTOM:${sizeObj.value}`)}
                          />
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Volume (ml) Sizes -->
                {#if product.sizes && product.sizes.VOLUME && product.sizes.VOLUME.length > 0}
                  <div class="mb-4">
                    <div class={sizeButtonsWrapClass}>
                      {#each product.sizes.VOLUME as size}
                        <button
                          type="button"
                          on:click={() => (selectedSize = `VOLUME:${size}`)}
                          class="px-3 py-2 text-sm transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                          `VOLUME:${size}`
                            ? 'bg-accent text-dark border-2 border-accent'
                            : 'bg-white text-black border border-gray-300 hover:border-gray-800'}"
                        >
                          <span class="product-size-option__label"
                            >{getSizeButtonLabel(size)} ml</span
                          >
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Weight (g) Sizes -->
                {#if product.sizes && product.sizes.WEIGHT && product.sizes.WEIGHT.length > 0}
                  <div class="mb-4">
                    <div class={sizeButtonsWrapClass}>
                      {#each product.sizes.WEIGHT as size}
                        <button
                          type="button"
                          on:click={() => (selectedSize = `WEIGHT:${size}`)}
                          class="px-3 py-2 text-sm transition-colors font-medium {productSizeButtonClass} {selectedSize ===
                          `WEIGHT:${size}`
                            ? 'bg-accent text-dark border-2 border-accent'
                            : 'bg-white text-black border border-gray-300 hover:border-gray-800'}"
                        >
                          <span class="product-size-option__label"
                            >{getSizeButtonLabel(size)} g</span
                          >
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Legacy format support -->
                {#if Array.isArray(product.sizes) && product.sizes.length > 0}
                  <div class={sizeButtonsWrapClass}>
                    {#each product.sizes as size}
                      {#if typeof size === 'string'}
                        <ProductSizeOptionButton
                          {size}
                          selected={selectedSize === size}
                          on:click={() => (selectedSize = size)}
                        />
                      {:else if size && typeof size === 'object' && 'value' in size}
                        <ProductSizeOptionButton
                          {size}
                          selected={selectedSize === size.value}
                          on:click={() => (selectedSize = String(size.value))}
                        />
                      {/if}
                    {/each}
                  </div>
                {/if}

                {#if isComingSoon}
                  <p class="mt-2 text-xs text-amber-600 font-medium">
                    {t('productPage.comingSoon')}
                  </p>
                {:else if isOutOfStock}
                  <p class="mt-2 text-xs text-red-500 font-medium">{t('productPage.outOfStock')}</p>
                {:else if !selectedSize}
                  <p class="mt-2 text-xs text-red-500">{t('productPage.pleaseSelectSize')}</p>
                {/if}
              </div>
            {:else if hasSizes && isOutOfStock}
              <!-- Show out of stock message if sizes are defined but none are available -->
              <div class="border-t border-gray-200 pt-2">
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
            <div class="border-t border-gray-200 pt-2">
              <label
                class="block text-sm font-semibold mb-3 uppercase tracking-wider"
                for="grid-quantity">{t('productPage.quantity')}</label
              >
              <div class="flex items-center gap-3">
                <button
                  on:click={decreaseQuantity}
                  disabled={quantityControlsDisabled || !canDecreaseQuantity}
                  class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  id="grid-quantity"
                  type="number"
                  bind:value={quantity}
                  min="1"
                  max={availableStock > 0 ? availableStock : undefined}
                  disabled={quantityControlsDisabled}
                  on:blur={validateQuantity}
                  on:input={validateQuantity}
                  class="w-16 px-3 py-2 bg-white border border-gray-300 text-center text-black quantity-input text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  on:click={increaseQuantity}
                  disabled={quantityControlsDisabled || !canIncreaseQuantity}
                  class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              {#if !sizeSelected && sizeRequired}
                <p class="mt-2 text-xs text-red-500">{t('productPage.pleaseSelectSize')}</p>
              {:else if isComingSoon}
                <p class="mt-2 text-xs text-amber-600">{t('productPage.comingSoon')}</p>
              {:else if sizeSelected && availableStock > 0}
                <p class="mt-2 text-xs text-gray-500">
                  {t('productPage.availableInStock', { count: availableStock })}
                </p>
              {:else if sizeSelected && availableStock === 0 && !loadingStock}
                <p class="mt-2 text-xs text-red-500">{t('productPage.outOfStock')}</p>
              {/if}
            </div>

            <!-- Actions -->
            <div class="border-t border-gray-200 pt-2 space-y-3">
              <button
                type="button"
                on:click={handleAddToCart}
                disabled={!canAddToCart || isOutOfStock || isComingSoon}
                class="w-full py-3 font-medium transition-colors {canAddToCart &&
                !isOutOfStock &&
                !isComingSoon
                  ? 'bg-accent text-dark hover:bg-accent-muted cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'}"
                style="pointer-events: {canAddToCart && !isOutOfStock && !isComingSoon
                  ? 'auto'
                  : 'none'}; position: relative; z-index: 10;"
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
                  class="w-full py-3 border-2 transition-colors font-medium flex items-center justify-center gap-2 {isInWishlist
                    ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                    : 'bg-white border-gray-300 text-black hover:border-accent'}"
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
                        stroke-width="4"
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
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  {/if}
                  {t('productPage.wishlist')}
                </button>
              {/if}
            </div>

            <!-- Product Details -->
            <div class="border-t border-gray-200 pt-2">
              <h3 class="text-sm font-semibold mb-3 uppercase tracking-wider">
                {t('productPage.details')}
              </h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-accent-muted">{t('productPage.sku')}:</span>
                  <span class="text-black font-medium">{product.sku}</span>
                </div>
                {#if product.category}
                  <div class="flex justify-between">
                    <span class="text-accent-muted">{t('productPage.category')}:</span>
                    <span class="text-black font-medium">{product.category.name}</span>
                  </div>
                {/if}
                {#if !product.hideColor && product.colors && product.colors.length > 0}
                  <div class="flex justify-between items-center">
                    <span class="text-accent-muted">Color:</span>
                    <div class="flex gap-1.5 flex-wrap justify-end">
                      {#each product.colors as color}
                        <div class="flex items-center gap-1" title={color.name}>
                          <div
                            class="w-4 h-4 rounded border border-gray-300"
                            style="background-color: {color.hex};"
                          ></div>
                          <span class="text-black text-right text-xs font-medium">{color.name}</span
                          >
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
                {#if product.material && !product.hideMaterial}
                  <div class="flex items-start justify-between gap-4">
                    <span class="text-accent-muted">{t('product.material')}:</span>
                    <span
                      class="flex-1 text-right text-black font-medium whitespace-pre-line break-words"
                      >{product.material}</span
                    >
                  </div>
                {/if}
                {#if product.lining && !product.hideLining}
                  <div class="flex items-start justify-between gap-4">
                    <span class="text-accent-muted">{t('product.lining')}:</span>
                    <span
                      class="flex-1 text-right text-black font-medium whitespace-pre-line break-words"
                      >{product.lining}</span
                    >
                  </div>
                {/if}
                {#if product.countryOfOrigin && !product.hideCountryOfOrigin}
                  <div class="flex items-start justify-between gap-4">
                    <span class="text-accent-muted">{t('product.countryOfOrigin')}:</span>
                    <span
                      class="flex-1 text-right text-black font-medium whitespace-pre-line break-words"
                      >{product.countryOfOrigin}</span
                    >
                  </div>
                {/if}
                {#if product.weightNet != null && product.weightNet !== undefined && product.weightNet > 0}
                  <div class="flex justify-between">
                    <span class="text-accent-muted">{t('product.weightNet')}:</span>
                    <span class="text-black text-right font-medium">{product.weightNet} kg</span>
                  </div>
                {/if}
                {#if product.weightGross != null && product.weightGross !== undefined && product.weightGross > 0}
                  <div class="flex justify-between">
                    <span class="text-accent-muted">{t('product.weightGross')}:</span>
                    <span class="text-black text-right font-medium">{product.weightGross} kg</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- End journal-container -->
    </div>
    <!-- End Content -->
  </div>
  <!-- End Grid -->

  <!-- Reviews -->
  {#if $settingsStore.reviewsEnabled}
    <div class="container-custom mt-12">
      <LazyComponent rootMargin="300px" placeholderHeight="400px">
        <Reviews productId={product.id} />
      </LazyComponent>
    </div>
  {/if}
</div>

<!-- Fullscreen Image Modal -->
{#if isModalOpen && product?.images}
  <div
    class="fixed inset-0 bg-white z-[10020] overflow-hidden"
    role="dialog"
    aria-modal="true"
    aria-label="Image gallery"
    tabindex="-1"
    bind:this={modalElement}
  >
    <div
      class="fixed right-4 md:right-8 z-[10060]"
      style="top: calc(env(safe-area-inset-top, 0px) + 4.25rem);"
    >
      <button
        on:click|stopPropagation={closeModal}
        class="p-2 md:p-3 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
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
    </div>

    <div
      class="relative z-10 h-full w-full px-3 md:px-8"
      style="padding-top: calc(env(safe-area-inset-top, 0px) + 0.75rem);"
    >
      <div class="flex h-full w-full flex-col gap-4 md:flex-row md:items-stretch md:gap-8">
        <div
          bind:this={modalThumbnailListElement}
          class="order-2 flex w-full gap-2 overflow-x-auto pb-2 md:order-1 md:h-full md:w-[72px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pr-2"
        >
          {#each product.images as image, index}
            <button
              id={`modal-thumb-${index}`}
              type="button"
              on:click={() => setModalImage(index)}
              class="modal-thumb group relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden bg-white transition-opacity md:h-14 md:w-14 {modalImageIndex ===
              index
                ? 'opacity-100'
                : 'opacity-50 hover:opacity-80'}"
              aria-label={`Open image ${index + 1}`}
            >
              <img
                src={image.url}
                alt={getProductImageAlt(image.alt, product.name)}
                class="h-full w-full object-contain p-1"
                draggable="false"
              />
            </button>
          {/each}
        </div>

        <div
          class="order-1 min-h-0 flex-1 overflow-y-auto scroll-smooth md:order-2 {isZoomed
            ? ''
            : 'snap-y snap-mandatory'}"
          style="scroll-padding-top: 1rem;"
          bind:this={modalScrollElement}
        >
          <div class="flex min-h-full flex-col justify-start gap-8 md:gap-12">
            {#each product.images as image, index}
              <section
                id={`modal-image-${index}`}
                class="modal-image-section snap-start min-h-[100svh] flex items-center justify-center px-2 py-3 md:px-8 md:py-4"
                aria-label={`Image ${index + 1} of ${product.images.length}`}
              >
                <img
                  src={image.url}
                  alt={getProductImageAlt(image.alt, product.name)}
                  class="modal-main-image select-none object-contain"
                  draggable="false"
                />
              </section>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<svelte:window on:keydown={handleKeydown} />

<style>
  /* Ensure navigation buttons are visible and clickable */
  .image-gallery-container {
    position: relative;
  }

  .image-gallery-container button {
    pointer-events: auto !important;
    display: flex !important;
    visibility: visible !important;
    z-index: 50 !important;
    position: absolute !important;
  }

  .image-gallery-container button:not(:disabled) {
    opacity: 1 !important;
    cursor: pointer !important;
  }

  .image-gallery-container button:disabled {
    opacity: 0.3 !important;
    cursor: not-allowed !important;
  }

  /* Journal layout for desktop only - fixed width so video does not shift sidebar */
  @media (min-width: 1024px) {
    .journal-container {
      width: 75%;
      max-width: 75%;
      margin-right: 0;
      padding-right: 0;
      padding-left: clamp(1rem, 1vw, 2rem);
      overflow: visible;
    }

    /* Ensure image slides over product details */
    .image-gallery-container {
      position: relative;
      z-index: 20;
    }

    .desktop-gallery-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .desktop-gallery-scroll::-webkit-scrollbar {
      display: none;
    }

    .desktop-slider-track {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      gap: clamp(1.5rem, 1.125vw, 4rem);
      width: max-content;
      min-width: 100%;
      padding-left: 0;
      padding-right: 30%;
      box-sizing: content-box;
    }

    .desktop-slider-image {
      width: 40% !important;
      min-width: 0 !important;
      max-width: 40% !important;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      scroll-snap-align: start;
    }

    .desktop-slider-image-inner {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .desktop-slider-image-item {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
  }

  .image-gallery-container {
    will-change: contents;
  }

  .modal-thumb {
    aspect-ratio: 1 / 1;
  }

  .modal-thumb img {
    display: block;
  }

  .modal-main-image {
    max-width: min(74vw, calc(100vw - 140px));
    width: auto;
    height: auto;
    transform: scale(1.4);
    transform-origin: center center;
    will-change: transform;
  }

  @media (max-width: 767px) {
    .modal-main-image {
      max-width: 200vw;
      max-height: 200svh;
      transform: scale(1.2);
    }
  }

  .modal-image-section {
    scroll-margin-top: 1rem;
  }

  /* Modal styles */
  :global(body.modal-open) {
    overflow: hidden;
  }

  /* Size chips: never squeeze into fixed grid cells (legacy grid-cols-3) */
  :global(.product-size-options) {
    display: flex !important;
    flex-wrap: wrap !important;
  }
</style>
