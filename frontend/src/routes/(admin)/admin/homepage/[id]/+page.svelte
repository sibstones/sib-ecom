<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { adminApi } from '$lib/api/admin.api';
  import { lookbookApi } from '$lib/api/lookbook.api';
  import { productApi } from '$lib/api/product.api';
  import { blogApi } from '$lib/api/blog.api';
  import type { BlogPost } from '$lib/api/blog.api';
  import { goto } from '$app/navigation';
  import type { HomepageSection } from '$lib/api/homepage.api';
  import type { Lookbook } from '$lib/api/lookbook.api';
  import type { Product } from '$lib/api/product.api';
  import { translationApi, type HomepageSectionTranslation } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { t } from '$lib/utils/i18n';
  import { hexForColorInput } from '$lib/utils/color-input';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';

  let loading = true;
  let saving = false;
  let error = '';
  let section: HomepageSection | null = null;
  let lookbooks: Lookbook[] = [];
  let products: Product[] = [];
  let searchQuery = '';
  let selectedProducts: string[] = [];
  let blogPosts: BlogPost[] = [];

  // Translation management
  let languages: Language[] = [];
  let translations: HomepageSectionTranslation[] = [];
  let showTranslations = false;
  let editingTranslation: HomepageSectionTranslation | null = null;
  let selectedLanguageForTranslation = '';
  let translationFormData = {
    title: '',
    config: {} as Record<string, any>,
  };

  let formData = {
    type: 'hero' as
      | 'hero'
      | 'collection'
      | 'editorial'
      | 'lookbook_preview'
      | 'card'
      | 'blog'
      | 'audio'
      | 'split_triple'
      | 'bleed_left'
      | 'bleed_right'
      | 'center_title_media'
      | 'text_block',
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
      displayMode: 'latest' as 'latest' | 'featured',
      limit: 6,
      postIds: [] as string[],
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
      textBlockMaxWidth: 'medium' as 'narrow' | 'medium' | 'wide' | 'full',
      textBlockAnimation: 'fade_up' as 'fade_up' | 'fade' | 'scale' | 'none',
    },
  };

  $: sectionId = $page.params.id;

  async function loadBlogPosts() {
    try {
      const response = await blogApi.getAllPosts(false);
      blogPosts = response.posts;
    } catch (e) {
      console.error('Failed to load blog posts:', e);
      blogPosts = [];
    }
  }

  function toggleBlogPost(postId: string) {
    const ids = formData.config.postIds ?? [];
    if (ids.includes(postId)) {
      formData.config.postIds = ids.filter((id) => id !== postId);
    } else {
      formData.config.postIds = [...ids, postId];
    }
  }

  onMount(async () => {
    await Promise.all([
      loadSection(),
      loadLookbooks(),
      loadProducts(),
      loadLanguages(),
      loadBlogPosts(),
    ]);
  });

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll();
      languages = response.languages;
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadTranslations() {
    if (!section) return;
    try {
      const response = await translationApi.getHomepageSectionTranslations(section.id);
      translations = response.translations;
    } catch (e) {
      console.error('Failed to load translations:', e);
      translations = [];
    }
  }

  function openTranslationEditor() {
    if (!section) return;
    showTranslations = true;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    const baseCards = (section.config?.cards as Array<{ id?: string; title?: string }>) ?? [];
    translationFormData = {
      title: '',
      config:
        section.type === 'card' || section.type === 'split_triple'
          ? { cards: baseCards.map((c) => ({ id: c.id, title: '' })) }
          : {},
    };
    loadTranslations();
  }

  function closeTranslationEditor() {
    showTranslations = false;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {
      title: '',
      config: {},
    };
  }

  function editTranslation(translation: HomepageSectionTranslation) {
    if (!section) return;
    editingTranslation = translation;
    selectedLanguageForTranslation = translation.languageCode;
    const baseCards = (section.config?.cards as Array<{ id?: string; title?: string }>) ?? [];
    const transCards = Array.isArray(translation.config?.cards) ? translation.config.cards : [];
    const cards =
      section.type === 'card' || section.type === 'split_triple'
        ? baseCards.map((c) => ({
            id: c.id,
            title:
              transCards.find((tc: { id?: string; title?: string }) => tc.id === c.id)?.title ?? '',
          }))
        : translation.config?.cards;
    translationFormData = {
      title: translation.title || '',
      config:
        section.type === 'card' || section.type === 'split_triple'
          ? { ...translation.config, cards }
          : translation.config || {},
    };
  }

  async function saveTranslation() {
    if (!section) return;

    try {
      const config: Record<string, any> = {
        ...formData.config,
        ...translationFormData.config,
        buttonText: translationFormData.config.buttonText ?? formData.config.buttonText,
        description: translationFormData.config.description ?? formData.config.description,
      };
      if (
        (section.type === 'card' || section.type === 'split_triple') &&
        Array.isArray(translationFormData.config.cards)
      ) {
        config.cards = translationFormData.config.cards;
      }

      await translationApi.upsertHomepageSectionTranslation(section.id, {
        languageCode: selectedLanguageForTranslation,
        title: translationFormData.title || undefined,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      notificationStore.success(t('notification.translationSaved'));
      await loadTranslations();
      editingTranslation = null;
      selectedLanguageForTranslation = '';
      translationFormData = {
        title: '',
        config: {},
      };
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteTranslation(languageCode: string) {
    if (!section) return;

    const confirmed = await dialogStore.confirm(t('alert.deleteTranslation'), t('common.confirm'));
    if (!confirmed) return;

    try {
      await translationApi.deleteHomepageSectionTranslation(section.id, languageCode);
      notificationStore.success(t('notification.translationDeleted'));
      await loadTranslations();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  async function loadSection() {
    loading = true;
    error = '';
    try {
      const response = await adminApi.getHomepageSectionById(sectionId);
      section = response.section;
      formData = {
        type: section.type,
        title: section.title || '',
        order: section.order,
        isActive: section.isActive,
        config: {
          imageUrl: section.config?.imageUrl || '',
          videoUrl: section.config?.videoUrl || '',
          buttonText: section.config?.buttonText || '',
          buttonLink: section.config?.buttonLink || '',
          description: section.config?.description || '',
          products: section.config?.products || [],
          lookbookId: section.config?.lookbookId || '',
          backgroundColor: (section.config?.backgroundColor as string) || '',
          textColor: (section.config?.textColor as string) || '',
          buttonColor: (section.config?.buttonColor as string) || '',
          buttonTextColor: (section.config?.buttonTextColor as string) || '',
          titleSize: (section.config?.titleSize as string) || '',
          subtitleSize: (section.config?.subtitleSize as string) || '',
          paddingTop: (section.config?.paddingTop as string) || '',
          paddingBottom: (section.config?.paddingBottom as string) || '',
          textAlign: (section.config?.textAlign as 'left' | 'center' | 'right') || 'center',
          imageOpacity: (section.config?.imageOpacity as string) || '50',
          sectionHeight: (section.config?.sectionHeight as string) || '',
          overlayColor: (section.config?.overlayColor as string) || '',
          overlayOpacity: (section.config?.overlayOpacity as string) || '0',
          displayMode: (section.config?.displayMode as 'latest' | 'featured') || 'latest',
          limit: typeof section.config?.limit === 'number' ? section.config.limit : 6,
          postIds: Array.isArray(section.config?.postIds) ? section.config.postIds : [],
          textBlockMaxWidth:
            (section.config?.textBlockMaxWidth as 'narrow' | 'medium' | 'wide' | 'full') ||
            'medium',
          textBlockAnimation:
            (section.config?.textBlockAnimation as 'fade_up' | 'fade' | 'scale' | 'none') ||
            'fade_up',
        },
      };
      selectedProducts = formData.config.products;
    } catch (e: any) {
      error = e.response?.data?.error || e.message || t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

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
    saving = true;
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
          ...(formData.type === 'blog' && {
            displayMode: formData.config.displayMode,
            limit: formData.config.limit,
            postIds: formData.config.postIds ?? [],
          }),
          ...(formData.type === 'text_block' && {
            textBlockMaxWidth: formData.config.textBlockMaxWidth || 'medium',
            textBlockAnimation: formData.config.textBlockAnimation || 'fade_up',
          }),
        },
      };

      await adminApi.updateHomepageSection(sectionId, data);
      goto('/admin/homepage');
    } catch (e: any) {
      error = e.response?.data?.error || e.message || t('error.failedToSave');
    } finally {
      saving = false;
    }
  }

  async function deleteSection() {
    const confirmed = await dialogStore.confirm(t('homepage.deleteConfirm'), t('common.confirm'));
    if (!confirmed) return;

    try {
      await adminApi.deleteHomepageSection(sectionId);
      goto('/admin/homepage');
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || e.message || t('error.failedToDelete'));
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
    <h2 class="text-3xl font-bold">{t('homepage.editSection')}</h2>
    <div class="flex gap-2">
      <button
        on:click={openTranslationEditor}
        class="px-4 py-2 bg-black text-white hover:bg-accent transition-colors"
      >
        {t('homepage.translations')}
      </button>
      <button
        on:click={() => goto('/admin/homepage')}
        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
      >
        {t('common.back')}
      </button>
      <button
        on:click={deleteSection}
        class="px-4 py-2 bg-white border border-red-500/20 hover:bg-red-50 transition-colors text-red-400"
      >
        {t('common.delete')}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error && !section}
    <div class="bg-red-500/10 border border-red-500/20 p-4">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if section}
    {#if error}
      <div class="bg-red-500/10 border border-red-500/20 p-4 mb-6">
        <p class="text-red-400">{error}</p>
      </div>
    {/if}

    <div class="bg-dark-light p-6">
      <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="edit-homepage-section-type" class="block text-sm font-medium mb-2"
              >Section Type *</label
            >
            <select
              id="edit-homepage-section-type"
              bind:value={formData.type}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="hero">Hero Section</option>
              <option value="collection">Product Collection</option>
              <option value="editorial">Editorial</option>
              <option value="lookbook_preview">Lookbook Preview</option>
              <option value="card">Card Blocks</option>
              <option value="split_triple">Split: photo + cards + edge video</option>
              <option value="bleed_left">Split: image left (edge) + text</option>
              <option value="bleed_right">Split: text + image right (edge)</option>
              <option value="center_title_media">Center title + image or video</option>
              <option value="text_block">Text block (HTML)</option>
            </select>
          </div>
          <div>
            <label for="edit-homepage-display-order" class="block text-sm font-medium mb-2"
              >Display Order *</label
            >
            <input
              id="edit-homepage-display-order"
              type="number"
              bind:value={formData.order}
              min="0"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>

        <div>
          <label for="edit-homepage-title" class="block text-sm font-medium mb-2">Title</label>
          <input
            id="edit-homepage-title"
            type="text"
            bind:value={formData.title}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder="Section title (optional)"
          />
        </div>

        {#if formData.type === 'hero' || formData.type === 'editorial' || formData.type === 'split_triple' || formData.type === 'center_title_media' || formData.type === 'bleed_left' || formData.type === 'bleed_right'}
          <div>
            <label for="edit-homepage-image-url" class="block text-sm font-medium mb-2"
              >Image URL *</label
            >
            <input
              id="edit-homepage-image-url"
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

          {#if formData.type !== 'bleed_left' && formData.type !== 'bleed_right'}
            <div>
              <label for="edit-homepage-video-url" class="block text-sm font-medium mb-2"
                >Video URL (optional)</label
              >
              <input
                id="edit-homepage-video-url"
                type="url"
                bind:value={formData.config.videoUrl}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="https://example.com/video.mp4"
              />
            </div>
          {/if}

          {#if formData.type === 'hero' || formData.type === 'editorial' || formData.type === 'bleed_left' || formData.type === 'bleed_right'}
            <div>
              <label for="edit-homepage-description" class="block text-sm font-medium mb-2"
                >Description</label
              >
              <textarea
                id="edit-homepage-description"
                bind:value={formData.config.description}
                rows="4"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="Section description"
              ></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="edit-homepage-button-text" class="block text-sm font-medium mb-2"
                  >Button Text</label
                >
                <input
                  id="edit-homepage-button-text"
                  type="text"
                  bind:value={formData.config.buttonText}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder="Shop Now"
                />
              </div>
              <div>
                <label for="edit-homepage-button-link" class="block text-sm font-medium mb-2"
                  >Button Link</label
                >
                <input
                  id="edit-homepage-button-link"
                  type="text"
                  bind:value={formData.config.buttonLink}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder="/shop"
                />
              </div>
            </div>
          {/if}
        {/if}

        {#if formData.type === 'text_block'}
          <div>
            <label for="edit-homepage-text-block-body" class="block text-sm font-medium mb-2"
              >{t('homepage.textBlockBody')}</label
            >
            <textarea
              id="edit-homepage-text-block-body"
              bind:value={formData.config.description}
              rows="16"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black font-mono text-sm"
              placeholder={t('homepage.textBlockPlaceholder')}
            ></textarea>
          </div>
          <div class="pt-2 border-t border-accent/20">
            <h4 class="text-sm font-medium mb-3 text-accent-muted">
              {t('homepage.textBlockLayout')}
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label for="edit-homepage-text-align" class="block text-sm font-medium mb-2"
                  >{t('homepage.textAlignment')}</label
                >
                <select
                  id="edit-homepage-text-align"
                  bind:value={formData.config.textAlign}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="left">{t('homepage.left')}</option>
                  <option value="center">{t('homepage.center')}</option>
                  <option value="right">{t('homepage.right')}</option>
                </select>
              </div>
              <div>
                <label for="edit-homepage-text-max-width" class="block text-sm font-medium mb-2"
                  >{t('homepage.textBlockMaxWidth')}</label
                >
                <select
                  id="edit-homepage-text-max-width"
                  bind:value={formData.config.textBlockMaxWidth}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="narrow">{t('homepage.textBlockMaxWidthNarrow')}</option>
                  <option value="medium">{t('homepage.textBlockMaxWidthMedium')}</option>
                  <option value="wide">{t('homepage.textBlockMaxWidthWide')}</option>
                  <option value="full">{t('homepage.textBlockMaxWidthFull')}</option>
                </select>
              </div>
              <div>
                <label for="edit-homepage-text-animation" class="block text-sm font-medium mb-2"
                  >{t('homepage.textBlockAnimation')}</label
                >
                <select
                  id="edit-homepage-text-animation"
                  bind:value={formData.config.textBlockAnimation}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="fade_up">{t('homepage.textBlockAnimFadeUp')}</option>
                  <option value="fade">{t('homepage.textBlockAnimFade')}</option>
                  <option value="scale">{t('homepage.textBlockAnimScale')}</option>
                  <option value="none">{t('homepage.textBlockAnimNone')}</option>
                </select>
              </div>
              <div>
                <label for="edit-homepage-padding-top" class="block text-sm font-medium mb-2"
                  >{t('homepage.paddingTop')}</label
                >
                <select
                  id="edit-homepage-padding-top"
                  bind:value={formData.config.paddingTop}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="">{t('homepage.textBlockPaddingDefault')}</option>
                  <option value="py-10">py-10</option>
                  <option value="py-20">py-20</option>
                  <option value="py-32">py-32</option>
                  <option value="pt-10">pt-10</option>
                  <option value="pt-20">pt-20</option>
                </select>
              </div>
              <div>
                <label for="edit-homepage-padding-bottom" class="block text-sm font-medium mb-2"
                  >{t('homepage.paddingBottom')}</label
                >
                <select
                  id="edit-homepage-padding-bottom"
                  bind:value={formData.config.paddingBottom}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="">{t('homepage.textBlockPaddingDefault')}</option>
                  <option value="pb-10">pb-10</option>
                  <option value="pb-20">pb-20</option>
                  <option value="pb-32">pb-32</option>
                </select>
              </div>
            </div>
            <p class="text-xs text-accent-muted mt-3">{t('homepage.textBlockLayoutHint')}</p>
          </div>
        {/if}

        {#if formData.type === 'collection'}
          <div>
            <label for="edit-homepage-product-search" class="block text-sm font-medium mb-2"
              >{t('homepage.selectProducts')}</label
            >
            <div class="mb-4">
              <div class="flex gap-2 mb-2">
                <input
                  id="edit-homepage-product-search"
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
                        id={`edit-homepage-product-${product.id}`}
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
            <label for="edit-homepage-lookbook" class="block text-sm font-medium mb-2"
              >Select Lookbook</label
            >
            <select
              id="edit-homepage-lookbook"
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

        {#if formData.type === 'blog'}
          <div class="space-y-4">
            <div>
              <label for="edit-homepage-blog-display-mode" class="block text-sm font-medium mb-2"
                >{t('homepage.blogDisplayMode') || 'Display mode'}</label
              >
              <select
                id="edit-homepage-blog-display-mode"
                bind:value={formData.config.displayMode}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="latest">{t('homepage.blogLatest') || 'Latest articles'}</option>
                <option value="featured">{t('homepage.blogFeatured') || 'Featured articles'}</option
                >
              </select>
            </div>
            {#if formData.config.displayMode === 'latest'}
              <div>
                <label for="edit-homepage-blog-limit" class="block text-sm font-medium mb-2"
                  >{t('homepage.blogLimit') || 'Number of articles'}</label
                >
                <input
                  id="edit-homepage-blog-limit"
                  type="number"
                  bind:value={formData.config.limit}
                  min="1"
                  max="12"
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                />
              </div>
            {:else}
              <div>
                <label
                  for="edit-homepage-blog-featured-posts"
                  class="block text-sm font-medium mb-2"
                  >{t('homepage.blogFeaturedPosts') || 'Select articles'}</label
                >
                <div class="border border-gray-300 bg-white max-h-60 overflow-y-auto p-2 space-y-2">
                  {#each blogPosts as post}
                    <label
                      class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        id={`edit-homepage-blog-post-${post.id}`}
                        type="checkbox"
                        checked={formData.config.postIds?.includes(post.id)}
                        on:change={() => toggleBlogPost(post.id)}
                        class="w-4 h-4"
                      />
                      <span class="text-sm truncate flex-1">{post.title || post.slug}</span>
                    </label>
                  {/each}
                  {#if blogPosts.length === 0}
                    <p class="text-sm text-accent-muted p-2">
                      {t('homepage.noBlogPostsAdmin') || 'No articles in blog yet'}
                    </p>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Design Settings -->
        <div class="pt-6 border-t border-accent/20">
          <h4 class="text-lg font-medium mb-4">Design Settings</h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label for="edit-homepage-background-color" class="block text-sm font-medium mb-2"
                >Background Color</label
              >
              <div class="flex gap-2">
                <input
                  id="edit-homepage-background-color-picker"
                  type="color"
                  value={hexForColorInput(formData.config.backgroundColor, '#ffffff')}
                  aria-label="Background color picker"
                  on:input={(e) => {
                    const el = e.currentTarget;
                    if (el instanceof HTMLInputElement) formData.config.backgroundColor = el.value;
                  }}
                  class="w-16 h-10 border border-gray-300 cursor-pointer"
                />
                <input
                  id="edit-homepage-background-color"
                  type="text"
                  bind:value={formData.config.backgroundColor}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder="#ffffff or transparent"
                />
              </div>
            </div>
            <div>
              <label for="edit-homepage-text-color" class="block text-sm font-medium mb-2"
                >Text Color</label
              >
              <div class="flex gap-2">
                <input
                  id="edit-homepage-text-color-picker"
                  type="color"
                  value={hexForColorInput(formData.config.textColor, '#000000')}
                  aria-label="Text color picker"
                  on:input={(e) => {
                    const el = e.currentTarget;
                    if (el instanceof HTMLInputElement) formData.config.textColor = el.value;
                  }}
                  class="w-16 h-10 border border-gray-300 cursor-pointer"
                />
                <input
                  id="edit-homepage-text-color"
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
                <label for="edit-homepage-button-bg-color" class="block text-sm font-medium mb-2"
                  >Button Background Color</label
                >
                <div class="flex gap-2">
                  <input
                    id="edit-homepage-button-bg-color-picker"
                    type="color"
                    value={hexForColorInput(formData.config.buttonColor, '#000000')}
                    aria-label="Button background color picker"
                    on:input={(e) => {
                      const el = e.currentTarget;
                      if (el instanceof HTMLInputElement) formData.config.buttonColor = el.value;
                    }}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="edit-homepage-button-bg-color"
                    type="text"
                    bind:value={formData.config.buttonColor}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div>
                <label for="edit-homepage-button-text-color" class="block text-sm font-medium mb-2"
                  >Button Text Color</label
                >
                <div class="flex gap-2">
                  <input
                    id="edit-homepage-button-text-color-picker"
                    type="color"
                    value={hexForColorInput(formData.config.buttonTextColor, '#ffffff')}
                    aria-label="Button text color picker"
                    on:input={(e) => {
                      const el = e.currentTarget;
                      if (el instanceof HTMLInputElement)
                        formData.config.buttonTextColor = el.value;
                    }}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="edit-homepage-button-text-color"
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
                <label for="edit-homepage-title-size" class="block text-sm font-medium mb-2"
                  >Title Size</label
                >
                <select
                  id="edit-homepage-title-size"
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
                <label for="edit-homepage-subtitle-size" class="block text-sm font-medium mb-2"
                  >Subtitle Size</label
                >
                <select
                  id="edit-homepage-subtitle-size"
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
                <label for="edit-homepage-text-align-design" class="block text-sm font-medium mb-2"
                  >Text Alignment</label
                >
                <select
                  id="edit-homepage-text-align-design"
                  bind:value={formData.config.textAlign}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label for="edit-homepage-image-opacity" class="block text-sm font-medium mb-2"
                  >Image Opacity (%)</label
                >
                <input
                  id="edit-homepage-image-opacity"
                  type="number"
                  bind:value={formData.config.imageOpacity}
                  min="0"
                  max="100"
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder="50"
                />
              </div>
              <div>
                <label for="edit-homepage-section-height" class="block text-sm font-medium mb-2"
                  >Section Height</label
                >
                <select
                  id="edit-homepage-section-height"
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
                <label for="edit-homepage-padding-top-design" class="block text-sm font-medium mb-2"
                  >Padding Top</label
                >
                <select
                  id="edit-homepage-padding-top-design"
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
                <label
                  for="edit-homepage-padding-bottom-design"
                  class="block text-sm font-medium mb-2">Padding Bottom</label
                >
                <select
                  id="edit-homepage-padding-bottom-design"
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
                <label for="edit-homepage-overlay-color" class="block text-sm font-medium mb-2"
                  >Overlay Color</label
                >
                <div class="flex gap-2">
                  <input
                    id="edit-homepage-overlay-color-picker"
                    type="color"
                    value={hexForColorInput(formData.config.overlayColor, '#000000')}
                    aria-label="Overlay color picker"
                    on:input={(e) => {
                      const el = e.currentTarget;
                      if (el instanceof HTMLInputElement) formData.config.overlayColor = el.value;
                    }}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="edit-homepage-overlay-color"
                    type="text"
                    bind:value={formData.config.overlayColor}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div>
                <label for="edit-homepage-overlay-opacity" class="block text-sm font-medium mb-2"
                  >Overlay Opacity (%)</label
                >
                <input
                  id="edit-homepage-overlay-opacity"
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
            disabled={saving}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('common.saving') : t('common.saveChanges')}
          </button>
          <button
            on:click={() => goto('/admin/homepage')}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>

    {#if showTranslations && section}
      <div class="bg-dark-light p-6 mb-6 mt-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-medium">
            {t('homepage.translations')} - {section.title || section.type}
          </h3>
          <button
            on:click={closeTranslationEditor}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.close')}
          </button>
        </div>

        <!-- Translation Form -->
        <div class="mb-6 p-4 bg-white border border-gray-300">
          <h4 class="text-lg font-medium mb-4">
            {editingTranslation ? t('homepage.editTranslation') : t('homepage.addTranslation')}
          </h4>
          <div class="space-y-4">
            <div>
              <label for="edit-homepage-translation-language" class="block text-sm font-medium mb-2"
                >{t('language.language')} *</label
              >
              <select
                id="edit-homepage-translation-language"
                bind:value={selectedLanguageForTranslation}
                disabled={!!editingTranslation}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
              >
                <option value="">{t('common.select')} {t('language.language').toLowerCase()}</option
                >
                {#each languages as lang}
                  {#if !translations.find((t) => t.languageCode === lang.code) || editingTranslation?.languageCode === lang.code}
                    <option value={lang.code}>{lang.name} ({lang.code})</option>
                  {/if}
                {/each}
              </select>
            </div>
            <div>
              <label for="edit-homepage-translation-title" class="block text-sm font-medium mb-2"
                >{t('homepage.sectionTitle')}</label
              >
              <input
                id="edit-homepage-translation-title"
                type="text"
                bind:value={translationFormData.title}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder={section.title || ''}
              />
            </div>
            {#if (section.type === 'card' || section.type === 'split_triple') && Array.isArray(section.config?.cards) && section.config.cards.length > 0}
              <div class="border-t pt-4">
                <h5 class="text-sm font-medium mb-3">
                  {t('homepage.cardTitles') || 'Card titles'}
                </h5>
                <div class="space-y-3">
                  {#each section.config.cards as card, index}
                    {@const transCards = translationFormData.config.cards ?? []}
                    {@const transCard = transCards[index] ?? { id: card.id, title: '' }}
                    <div>
                      <label
                        class="block text-sm font-medium mb-1"
                        for={`edit-homepage-translation-card-title-${index}`}
                      >
                        {t('homepage.card') || 'Card'}
                        {index + 1}{#if card.title}
                          <span class="text-accent-muted font-normal">({card.title})</span>
                        {/if}
                      </label>
                      <input
                        id={`edit-homepage-translation-card-title-${index}`}
                        type="text"
                        value={transCard.title}
                        on:input={(e) => {
                          const target = e.target;
                          const v = target && 'value' in target ? String(target.value) : '';
                          const cards = [...(translationFormData.config.cards ?? [])];
                          while (cards.length <= index) cards.push({ id: card.id, title: '' });
                          cards[index] = { id: card.id, title: v };
                          translationFormData = {
                            ...translationFormData,
                            config: { ...translationFormData.config, cards },
                          };
                        }}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={card.title || ''}
                      />
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
            {#if formData.config.buttonText !== undefined || formData.config.description !== undefined}
              <div class="border-t pt-4">
                <h5 class="text-sm font-medium mb-3">{t('homepage.configFields')}</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {#if formData.config.buttonText !== undefined}
                    <div>
                      <label
                        for="edit-homepage-translation-button-text"
                        class="block text-sm font-medium mb-2">{t('homepage.buttonText')}</label
                      >
                      <input
                        id="edit-homepage-translation-button-text"
                        type="text"
                        bind:value={translationFormData.config.buttonText}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={formData.config.buttonText || ''}
                      />
                    </div>
                  {/if}
                  {#if formData.config.description !== undefined}
                    <div>
                      <label
                        for="edit-homepage-translation-description"
                        class="block text-sm font-medium mb-2">{t('common.description')}</label
                      >
                      <textarea
                        id="edit-homepage-translation-description"
                        bind:value={translationFormData.config.description}
                        rows="3"
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={formData.config.description || ''}
                      ></textarea>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
            <div class="flex gap-4">
              <button
                on:click={saveTranslation}
                disabled={!selectedLanguageForTranslation}
                class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
              >
                {t('common.save')}
              </button>
              {#if editingTranslation}
                <button
                  on:click={() => {
                    editingTranslation = null;
                    selectedLanguageForTranslation = '';
                    translationFormData = {
                      title: '',
                      config: {},
                    };
                  }}
                  class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                >
                  {t('common.cancel')}
                </button>
              {/if}
            </div>
          </div>
        </div>

        <!-- Existing Translations -->
        <div>
          <h4 class="text-lg font-medium mb-4">{t('homepage.existingTranslations')}</h4>
          {#if translations.length === 0}
            <p class="text-accent-muted">{t('homepage.noTranslations')}</p>
          {:else}
            <div class="space-y-2">
              {#each translations as translation}
                <div class="flex items-center justify-between p-4 bg-white border border-gray-300">
                  <div>
                    <p class="font-medium">
                      {languages.find((l) => l.code === translation.languageCode)?.name ||
                        translation.languageCode}
                    </p>
                    {#if translation.title}
                      <p class="text-sm text-accent-muted">
                        {t('homepage.sectionTitle')}: {translation.title}
                      </p>
                    {/if}
                  </div>
                  <div class="flex gap-2">
                    <button
                      on:click={() => editTranslation(translation)}
                      class="px-3 py-1 bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-colors text-black"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      on:click={() => deleteTranslation(translation.languageCode)}
                      class="px-3 py-1 bg-red-500 text-white text-sm hover:bg-red-600 transition-colors"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
