<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '$lib/api/admin.api';
  import { lookbookApi } from '$lib/api/lookbook.api';
  import { productApi } from '$lib/api/product.api';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import type { HomepageSection } from '$lib/api/homepage.api';
  import type { Lookbook } from '$lib/api/lookbook.api';
  import type { Product } from '$lib/api/product.api';

  let loading = false;
  let error = '';
  let lookbooks: Lookbook[] = [];
  let products: Product[] = [];
  let searchQuery = '';
  let selectedProducts: string[] = [];

  let formData = {
    type: 'hero' as 'hero' | 'collection' | 'editorial' | 'lookbook_preview' | 'card',
    title: '',
    order: 0,
    isActive: true,
    config: {
      imageUrl: '',
      videoUrl: '',
      buttonText: '',
      buttonLink: '',
      description: '',
      products: [] as string[],
      lookbookId: '',
      // Design settings
      backgroundColor: '',
      textColor: '',
      buttonColor: '',
      buttonTextColor: '',
      titleSize: '',
      subtitleSize: '',
      paddingTop: '',
      paddingBottom: '',
      textAlign: 'center' as 'left' | 'center' | 'right',
      imageOpacity: '50',
      sectionHeight: '',
      overlayColor: '',
      overlayOpacity: '0',
    },
  };

  onMount(async () => {
    await Promise.all([loadLookbooks(), loadProducts()]);
    // Set default order
    try {
      const response = await adminApi.getAllHomepageSections();
      formData.order =
        response.sections.length > 0 ? Math.max(...response.sections.map((s) => s.order)) + 1 : 0;
    } catch (e) {
      console.error('Failed to load sections for order:', e);
    }
  });

  async function loadLookbooks() {
    try {
      const response = await lookbookApi.getAll(false);
      lookbooks = response.lookbooks;
    } catch (e) {
      console.error('Failed to load lookbooks:', e);
    }
  }

  async function loadProducts(search?: string) {
    try {
      const response = await productApi.getAll(1, 50, { search });
      products = response.products;
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }

  function toggleProduct(productId: string) {
    if (selectedProducts.includes(productId)) {
      selectedProducts = selectedProducts.filter((id) => id !== productId);
    } else {
      selectedProducts = [...selectedProducts, productId];
    }
    formData.config.products = selectedProducts;
  }

  async function saveSection() {
    loading = true;
    error = '';
    try {
      const data = {
        type: formData.type,
        title: formData.title || undefined,
        order: formData.order,
        isActive: formData.isActive,
        config: {
          ...(formData.config.imageUrl && { imageUrl: formData.config.imageUrl }),
          ...(formData.config.videoUrl && { videoUrl: formData.config.videoUrl }),
          ...(formData.config.buttonText && { buttonText: formData.config.buttonText }),
          ...(formData.config.buttonLink && { buttonLink: formData.config.buttonLink }),
          ...(formData.config.description && { description: formData.config.description }),
          ...(formData.config.products.length > 0 && { products: formData.config.products }),
          ...(formData.config.lookbookId && { lookbookId: formData.config.lookbookId }),
          // Design settings
          ...(formData.config.backgroundColor && {
            backgroundColor: formData.config.backgroundColor,
          }),
          ...(formData.config.textColor && { textColor: formData.config.textColor }),
          ...(formData.config.buttonColor && { buttonColor: formData.config.buttonColor }),
          ...(formData.config.buttonTextColor && {
            buttonTextColor: formData.config.buttonTextColor,
          }),
          ...(formData.config.titleSize && { titleSize: formData.config.titleSize }),
          ...(formData.config.subtitleSize && { subtitleSize: formData.config.subtitleSize }),
          ...(formData.config.paddingTop && { paddingTop: formData.config.paddingTop }),
          ...(formData.config.paddingBottom && { paddingBottom: formData.config.paddingBottom }),
          ...(formData.config.textAlign && { textAlign: formData.config.textAlign }),
          ...(formData.config.imageOpacity && { imageOpacity: formData.config.imageOpacity }),
          ...(formData.config.sectionHeight && { sectionHeight: formData.config.sectionHeight }),
          ...(formData.config.overlayColor && { overlayColor: formData.config.overlayColor }),
          ...(formData.config.overlayOpacity && { overlayOpacity: formData.config.overlayOpacity }),
        },
      };

      await adminApi.createHomepageSection(data);
      goto('/admin/homepage');
    } catch (e: any) {
      error = e.response?.data?.error || e.message || 'Failed to create section';
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    if (searchQuery.trim()) {
      loadProducts(searchQuery);
    } else {
      loadProducts();
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">Create Homepage Section</h2>
    <button
      on:click={() => goto('/admin/homepage')}
      class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
    >
      Cancel
    </button>
  </div>

  {#if error}
    <div class="bg-red-500/10 border border-red-500/20 p-4 mb-6">
      <p class="text-red-400">{error}</p>
    </div>
  {/if}

  <div class="bg-dark-light p-6">
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="new-homepage-section-type" class="block text-sm font-medium mb-2"
            >Section Type *</label
          >
          <select
            id="new-homepage-section-type"
            bind:value={formData.type}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          >
            <option value="hero">Hero Section</option>
            <option value="collection">Product Collection</option>
            <option value="editorial">Editorial</option>
            <option value="lookbook_preview">Lookbook Preview</option>
            <option value="card">Card Blocks</option>
          </select>
          <p class="text-xs text-accent-muted mt-1">
            Choose the type of section you want to create
          </p>
        </div>
        <div>
          <label for="new-homepage-display-order" class="block text-sm font-medium mb-2"
            >Display Order *</label
          >
          <input
            id="new-homepage-display-order"
            type="number"
            bind:value={formData.order}
            min="0"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
          <p class="text-xs text-accent-muted mt-1">Lower numbers appear first on the homepage</p>
        </div>
      </div>

      <div>
        <label for="new-homepage-title" class="block text-sm font-medium mb-2">Title</label>
        <input
          id="new-homepage-title"
          type="text"
          bind:value={formData.title}
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          placeholder="Section title (optional)"
        />
      </div>

      {#if formData.type === 'hero' || formData.type === 'editorial'}
        <div>
          <label for="new-homepage-image-url" class="block text-sm font-medium mb-2"
            >Image URL *</label
          >
          <input
            id="new-homepage-image-url"
            type="url"
            bind:value={formData.config.imageUrl}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder="https://example.com/image.jpg"
          />
          {#if formData.config.imageUrl}
            <div class="mt-2">
              <img
                src={formData.config.imageUrl}
                alt="Preview"
                class="max-w-md h-48 object-cover"
                on:error={(e) => {
                  const target = e.currentTarget;
                  if (target instanceof HTMLImageElement) {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
          {/if}
        </div>

        <div>
          <label for="new-homepage-video-url" class="block text-sm font-medium mb-2"
            >Video URL (optional)</label
          >
          <input
            id="new-homepage-video-url"
            type="url"
            bind:value={formData.config.videoUrl}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder="https://example.com/video.mp4"
          />
        </div>

        <div>
          <label for="new-homepage-description" class="block text-sm font-medium mb-2"
            >Description</label
          >
          <textarea
            id="new-homepage-description"
            bind:value={formData.config.description}
            rows="4"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder="Section description"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="new-homepage-button-text" class="block text-sm font-medium mb-2"
              >Button Text</label
            >
            <input
              id="new-homepage-button-text"
              type="text"
              bind:value={formData.config.buttonText}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="Shop Now"
            />
          </div>
          <div>
            <label for="new-homepage-button-link" class="block text-sm font-medium mb-2"
              >Button Link</label
            >
            <input
              id="new-homepage-button-link"
              type="text"
              bind:value={formData.config.buttonLink}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="/shop"
            />
          </div>
        </div>
      {/if}

      {#if formData.type === 'collection'}
        <div>
          <label for="new-homepage-product-search" class="block text-sm font-medium mb-2"
            >{t('homepage.selectProducts')}</label
          >
          <div class="mb-4">
            <div class="flex gap-2 mb-2">
              <input
                id="new-homepage-product-search"
                type="text"
                bind:value={searchQuery}
                on:input={() => handleSearch()}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder={t('filter.searchProductsPlaceholder')}
              />
              <button
                on:click={handleSearch}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
              >
                {t('common.search')}
              </button>
            </div>
            <div class="max-h-64 overflow-y-auto bg-white border border-gray-300 p-2">
              {#if products.length === 0}
                <p class="text-sm text-accent-muted p-2">{t('product.noProductsFound')}</p>
              {:else}
                {#each products as product}
                  <label class="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer">
                    <input
                      id={`new-homepage-product-${product.id}`}
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      on:change={() => toggleProduct(product.id)}
                      class="w-4 h-4"
                    />
                    <span class="text-sm text-black">{product.name}</span>
                    {#if product.images?.[0]}
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        class="w-8 h-8 object-cover ml-auto"
                      />
                    {/if}
                  </label>
                {/each}
              {/if}
            </div>
            {#if selectedProducts.length > 0}
              <p class="text-xs text-accent-muted mt-2">
                {t('homepage.productsSelected', { count: selectedProducts.length })}
              </p>
            {/if}
          </div>
        </div>
      {/if}

      {#if formData.type === 'lookbook_preview'}
        <div>
          <label for="new-homepage-lookbook" class="block text-sm font-medium mb-2"
            >Select Lookbook</label
          >
          <select
            id="new-homepage-lookbook"
            bind:value={formData.config.lookbookId}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          >
            <option value="">Select a lookbook</option>
            {#each lookbooks as lookbook}
              <option value={lookbook.id}>
                {lookbook.title} ({lookbook.season}
                {lookbook.year})
              </option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Design Settings -->
      <div class="pt-6 border-t border-accent/20">
        <h4 class="text-lg font-medium mb-4">Design Settings</h4>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label for="new-homepage-background-color" class="block text-sm font-medium mb-2"
              >Background Color</label
            >
            <div class="flex gap-2">
              <input
                id="new-homepage-background-color-picker"
                type="color"
                bind:value={formData.config.backgroundColor}
                aria-label="Background color picker"
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="new-homepage-background-color"
                type="text"
                bind:value={formData.config.backgroundColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="#ffffff or transparent"
              />
            </div>
          </div>
          <div>
            <label for="new-homepage-text-color" class="block text-sm font-medium mb-2"
              >Text Color</label
            >
            <div class="flex gap-2">
              <input
                id="new-homepage-text-color-picker"
                type="color"
                bind:value={formData.config.textColor}
                aria-label="Text color picker"
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="new-homepage-text-color"
                type="text"
                bind:value={formData.config.textColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        {#if formData.type === 'hero' || formData.type === 'editorial'}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label for="new-homepage-button-bg-color" class="block text-sm font-medium mb-2"
                >Button Background Color</label
              >
              <div class="flex gap-2">
                <input
                  id="new-homepage-button-bg-color-picker"
                  type="color"
                  bind:value={formData.config.buttonColor}
                  aria-label="Button background color picker"
                  class="w-16 h-10 border border-gray-300 cursor-pointer"
                />
                <input
                  id="new-homepage-button-bg-color"
                  type="text"
                  bind:value={formData.config.buttonColor}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder="#000000"
                />
              </div>
            </div>
            <div>
              <label for="new-homepage-button-text-color" class="block text-sm font-medium mb-2"
                >Button Text Color</label
              >
              <div class="flex gap-2">
                <input
                  id="new-homepage-button-text-color-picker"
                  type="color"
                  bind:value={formData.config.buttonTextColor}
                  aria-label="Button text color picker"
                  class="w-16 h-10 border border-gray-300 cursor-pointer"
                />
                <input
                  id="new-homepage-button-text-color"
                  type="text"
                  bind:value={formData.config.buttonTextColor}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label for="new-homepage-title-size" class="block text-sm font-medium mb-2"
                >Title Size</label
              >
              <select
                id="new-homepage-title-size"
                bind:value={formData.config.titleSize}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">Default</option>
                <option value="text-4xl">Small (text-4xl)</option>
                <option value="text-5xl">Medium (text-5xl)</option>
                <option value="text-6xl">Large (text-6xl)</option>
                <option value="text-7xl">Extra Large (text-7xl)</option>
                <option value="text-8xl">2XL (text-8xl)</option>
                <option value="text-9xl">3XL (text-9xl)</option>
              </select>
            </div>
            <div>
              <label for="new-homepage-subtitle-size" class="block text-sm font-medium mb-2"
                >Subtitle Size</label
              >
              <select
                id="new-homepage-subtitle-size"
                bind:value={formData.config.subtitleSize}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">Default</option>
                <option value="text-lg">Small (text-lg)</option>
                <option value="text-xl">Medium (text-xl)</option>
                <option value="text-2xl">Large (text-2xl)</option>
                <option value="text-3xl">Extra Large (text-3xl)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label for="new-homepage-text-align" class="block text-sm font-medium mb-2"
                >Text Alignment</label
              >
              <select
                id="new-homepage-text-align"
                bind:value={formData.config.textAlign}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <label for="new-homepage-image-opacity" class="block text-sm font-medium mb-2"
                >Image Opacity (%)</label
              >
              <input
                id="new-homepage-image-opacity"
                type="number"
                bind:value={formData.config.imageOpacity}
                min="0"
                max="100"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="50"
              />
            </div>
            <div>
              <label for="new-homepage-section-height" class="block text-sm font-medium mb-2"
                >Section Height</label
              >
              <select
                id="new-homepage-section-height"
                bind:value={formData.config.sectionHeight}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">Auto</option>
                <option value="h-screen">Full Screen</option>
                <option value="h-[60vh]">60vh</option>
                <option value="h-[80vh]">80vh</option>
                <option value="min-h-screen">Min Full Screen</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label for="new-homepage-padding-top" class="block text-sm font-medium mb-2"
                >Padding Top</label
              >
              <select
                id="new-homepage-padding-top"
                bind:value={formData.config.paddingTop}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">Default</option>
                <option value="py-10">Small (py-10)</option>
                <option value="py-20">Medium (py-20)</option>
                <option value="py-32">Large (py-32)</option>
                <option value="pt-10">Top Only Small</option>
                <option value="pt-20">Top Only Medium</option>
              </select>
            </div>
            <div>
              <label for="new-homepage-padding-bottom" class="block text-sm font-medium mb-2"
                >Padding Bottom</label
              >
              <select
                id="new-homepage-padding-bottom"
                bind:value={formData.config.paddingBottom}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">Default</option>
                <option value="pb-10">Small (pb-10)</option>
                <option value="pb-20">Medium (pb-20)</option>
                <option value="pb-32">Large (pb-32)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="new-homepage-overlay-color" class="block text-sm font-medium mb-2"
                >Overlay Color</label
              >
              <div class="flex gap-2">
                <input
                  id="new-homepage-overlay-color-picker"
                  type="color"
                  bind:value={formData.config.overlayColor}
                  aria-label="Overlay color picker"
                  class="w-16 h-10 border border-gray-300 cursor-pointer"
                />
                <input
                  id="new-homepage-overlay-color"
                  type="text"
                  bind:value={formData.config.overlayColor}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder="#000000"
                />
              </div>
            </div>
            <div>
              <label for="new-homepage-overlay-opacity" class="block text-sm font-medium mb-2"
                >Overlay Opacity (%)</label
              >
              <input
                id="new-homepage-overlay-opacity"
                type="number"
                bind:value={formData.config.overlayOpacity}
                min="0"
                max="100"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="0"
              />
            </div>
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-2 pt-4 border-t border-accent/20">
        <input type="checkbox" bind:checked={formData.isActive} id="isActive" class="" />
        <label for="isActive" class="text-sm font-medium"> Active (visible on homepage) </label>
      </div>

      <div class="flex gap-4 pt-4">
        <button
          on:click={saveSection}
          disabled={loading}
          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Section'}
        </button>
        <button
          on:click={() => goto('/admin/homepage')}
          class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</div>
