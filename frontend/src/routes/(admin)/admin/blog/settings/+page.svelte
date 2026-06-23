<script lang="ts">
  import { onMount } from 'svelte';
  import {
    blogApi,
    type BlogSettings,
    type UpdateBlogSettingsDto,
    BlogLayoutStyle,
    type BlogPost,
    type BlogCategory,
    type BlogAuthor,
  } from '$lib/api/blog.api';
  import { t } from '$lib/utils/i18n';
  import { getErrorMessage, resolveApiError } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';

  let settings: BlogSettings | null = null;
  let posts: BlogPost[] = [];
  let categories: BlogCategory[] = [];
  let authors: BlogAuthor[] = [];
  let loading = true;
  let error = '';
  let uploadingHeaderImage = false;
  let uploadingHeaderVideo = false;
  let uploadingAuthorAvatar = false;
  let isDraggingAuthorAvatar = false;
  let headerImageFileInput: HTMLInputElement | null = null;
  let headerVideoFileInput: HTMLInputElement | null = null;
  let authorAvatarFileInput: HTMLInputElement | null = null;

  let formData: Partial<BlogSettings> = {};
  let categoryName = '';
  let categorySlug = '';
  let authorName = '';
  let authorSlug = '';
  let authorBio = '';
  let authorAvatarUrl = '';

  onMount(async () => {
    await Promise.all([loadSettings(), loadPosts(), loadCategories(), loadAuthors()]);
  });

  async function loadSettings() {
    loading = true;
    try {
      const response = await blogApi.getSettings();
      settings = response.settings;
      formData = {
        ...settings,
        featuredPostId: settings?.featuredPostId ?? '',
        layoutStyle: settings?.layoutStyle ?? BlogLayoutStyle.MAGAZINE,
      };
    } catch (e) {
      error = getErrorMessage(e, 'blog.failedToLoadSettings');
    } finally {
      loading = false;
    }
  }

  async function loadPosts() {
    try {
      const response = await blogApi.getAllPosts(false);
      posts = response.posts.filter((p) => p.isPublished);
    } catch (e) {
      console.error('Failed to load posts:', e);
    }
  }

  async function loadCategories() {
    try {
      const response = await blogApi.getAllCategories();
      categories = response.categories;
    } catch (e) {
      console.error('Failed to load blog categories:', e);
      categories = [];
    }
  }

  async function loadAuthors() {
    try {
      const response = await blogApi.getAllAuthors();
      authors = response.authors;
    } catch (e) {
      console.error('Failed to load blog authors:', e);
      authors = [];
    }
  }

  async function createCategory() {
    if (!categoryName.trim()) return;
    try {
      await blogApi.createCategory({
        name: categoryName.trim(),
        slug: categorySlug.trim() || undefined,
      });
      categoryName = '';
      categorySlug = '';
      await loadCategories();
      notificationStore.success(t('blog.categoryCreated'));
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'blog.failedToCreateCategory'));
    }
  }

  async function deleteCategory(id: string) {
    try {
      await blogApi.deleteCategory(id);
      await loadCategories();
      notificationStore.success(t('blog.categoryDeleted'));
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'blog.failedToDeleteCategory'));
    }
  }

  async function createAuthor() {
    if (!authorName.trim()) return;
    try {
      await blogApi.createAuthor({
        name: authorName.trim(),
        slug: authorSlug.trim() || undefined,
        bio: authorBio.trim() || undefined,
        avatarUrl: authorAvatarUrl.trim() || undefined,
      });
      authorName = '';
      authorSlug = '';
      authorBio = '';
      authorAvatarUrl = '';
      await loadAuthors();
      notificationStore.success(t('blog.authorCreated'));
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'blog.failedToCreateAuthor'));
    }
  }

  async function deleteAuthor(id: string) {
    try {
      await blogApi.deleteAuthor(id);
      await loadAuthors();
      notificationStore.success(t('blog.authorDeleted'));
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'blog.failedToDeleteAuthor'));
    }
  }

  async function uploadHeaderImage(file: File) {
    uploadingHeaderImage = true;
    try {
      const response = await blogApi.uploadMedia(file);
      formData.headerImageUrl = response.url;
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'error.failedToUpload'));
    } finally {
      uploadingHeaderImage = false;
    }
  }

  async function uploadHeaderVideo(file: File) {
    uploadingHeaderVideo = true;
    try {
      const response = await blogApi.uploadMedia(file);
      formData.headerVideoUrl = response.url;
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'error.failedToUpload'));
    } finally {
      uploadingHeaderVideo = false;
    }
  }

  async function uploadAuthorAvatar(file: File) {
    uploadingAuthorAvatar = true;
    try {
      const response = await blogApi.uploadMedia(file);
      authorAvatarUrl = response.url;
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'blog.failedToUploadAuthorAvatar'));
    } finally {
      uploadingAuthorAvatar = false;
      isDraggingAuthorAvatar = false;
    }
  }

  function handleAuthorAvatarDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingAuthorAvatar = true;
  }

  function handleAuthorAvatarDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingAuthorAvatar = false;
  }

  function handleAuthorAvatarDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingAuthorAvatar = false;

    const files = event.dataTransfer?.files;
    if (files && files[0] && files[0].type.startsWith('image/')) {
      uploadAuthorAvatar(files[0]);
    }
  }

  function openAuthorAvatarDialog() {
    authorAvatarFileInput?.click();
  }

  function normalizePayload(data: Partial<BlogSettings>): UpdateBlogSettingsDto {
    const payload: UpdateBlogSettingsDto = {
      layoutStyle: data.layoutStyle ?? BlogLayoutStyle.MAGAZINE,
      gridColumns: data.gridColumns,
      gap: data.gap,
      itemsPerPage: data.itemsPerPage != null ? Number(data.itemsPerPage) : undefined,
      showExcerpt: data.showExcerpt,
      showAuthor: data.showAuthor,
      showDate: data.showDate,
      showViews: data.showViews,
      showTags: data.showTags,
      headerTitle: data.headerTitle === null ? undefined : data.headerTitle,
      headerSubtitle: data.headerSubtitle === null ? undefined : data.headerSubtitle,
      headerImageUrl: data.headerImageUrl,
      headerVideoUrl: data.headerVideoUrl,
      heroFullscreen: data.heroFullscreen,
      heroHeight: data.heroHeight,
      heroAutoZoom: data.heroAutoZoom,
      titleFontSize: data.titleFontSize,
      excerptFontSize: data.excerptFontSize,
      backgroundColor: data.backgroundColor,
      textColor: data.textColor,
      accentColor: data.accentColor,
      paddingTop: data.paddingTop,
      paddingBottom: data.paddingBottom,
      cardBorderRadius: data.cardBorderRadius,
      cardShadow: data.cardShadow,
      cardHoverEffect: data.cardHoverEffect,
      featuredPostId: data.featuredPostId,
      aspectRatio: data.aspectRatio,
      videoAutoplay: data.videoAutoplay,
      videoLoop: data.videoLoop,
      videoMuted: data.videoMuted,
    };
    // HTML select sends "" or "null" for "None" — backend expects null
    if (
      payload.featuredPostId === '' ||
      payload.featuredPostId === 'null' ||
      payload.featuredPostId == null
    ) {
      payload.featuredPostId = null;
    }
    // Empty URL strings fail backend .url() validation — send undefined
    if (payload.headerImageUrl === '') payload.headerImageUrl = undefined;
    if (payload.headerVideoUrl === '') payload.headerVideoUrl = undefined;
    return payload;
  }

  async function saveSettings() {
    try {
      const payload = normalizePayload(formData);
      const response = await blogApi.updateSettings(payload);
      settings = response.settings;
      formData = {
        ...settings,
        featuredPostId: settings?.featuredPostId ?? '',
        layoutStyle: settings?.layoutStyle ?? BlogLayoutStyle.MAGAZINE,
      };
      notificationStore.success(t('blog.settingsSaved') || 'Settings saved');
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      notificationStore.error(message || t('error.failedToSave'));
    }
  }

  function applyFullscreenBanner() {
    formData.heroFullscreen = true;
    formData.heroHeight = '100vh';
    formData.heroAutoZoom = true;
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <div>
      <h2 class="text-3xl font-bold">{t('blog.settings') || 'Blog Settings'}</h2>
      <p class="text-sm text-accent-muted mt-1">
        {t('blog.configureDesign') || 'Configure blog design and layout'}
      </p>
    </div>
    <button
      on:click={() => window.history.back()}
      class="px-6 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 transition-colors"
    >
      {t('blog.backToPosts') || '← Back to Posts'}
    </button>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">Error: {error}</p>
  {:else if !settings}
    <p class="text-accent-muted">{t('blog.settingsNotLoaded') || 'Settings not loaded'}</p>
  {:else}
    <div class="space-y-6">
      <!-- Layout Style -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.layoutStyle') || 'Layout Style'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <label class="cursor-pointer flex flex-col">
            <input
              type="radio"
              bind:group={formData.layoutStyle}
              value={BlogLayoutStyle.MAGAZINE}
              class="sr-only"
            />
            <div
              class="p-4 border-2 flex-1 flex flex-col {formData.layoutStyle ===
              BlogLayoutStyle.MAGAZINE
                ? 'border-accent'
                : 'border-gray-300'}"
            >
              <div class="text-[11px] uppercase tracking-[0.18em] text-accent-muted mb-2">
                MAGAZINE
              </div>
              <h4 class="font-medium mb-2">{t('blog.magazine') || 'Magazine'}</h4>
              <p class="text-sm text-accent-muted flex-grow">
                {t('blog.magazineDescription') ||
                  'Rectangular cards (16:9), one featured post, then grid. Click → post page'}
              </p>
            </div>
          </label>
          <label class="cursor-pointer flex flex-col">
            <input
              type="radio"
              bind:group={formData.layoutStyle}
              value={BlogLayoutStyle.INSTAGRAM}
              class="sr-only"
            />
            <div
              class="p-4 border-2 flex-1 flex flex-col {formData.layoutStyle ===
              BlogLayoutStyle.INSTAGRAM
                ? 'border-accent'
                : 'border-gray-300'}"
            >
              <div class="text-[11px] uppercase tracking-[0.18em] text-accent-muted mb-2">
                SQUARE
              </div>
              <h4 class="font-medium mb-2">Square</h4>
              <p class="text-sm text-accent-muted flex-grow">
                Uniform 1:1 cards like an Instagram grid.
              </p>
            </div>
          </label>
          <label class="cursor-pointer flex flex-col">
            <input
              type="radio"
              bind:group={formData.layoutStyle}
              value={BlogLayoutStyle.TIKTOK}
              class="sr-only"
            />
            <div
              class="p-4 border-2 flex-1 flex flex-col {formData.layoutStyle ===
              BlogLayoutStyle.TIKTOK
                ? 'border-accent'
                : 'border-gray-300'}"
            >
              <div class="text-[11px] uppercase tracking-[0.18em] text-accent-muted mb-2">
                VIDEO 9:16
              </div>
              <h4 class="font-medium mb-2">Video 9:16</h4>
              <p class="text-sm text-accent-muted flex-grow">
                Vertical reels-style feed with tall cards.
              </p>
            </div>
          </label>
          <label class="cursor-pointer flex flex-col">
            <input
              type="radio"
              bind:group={formData.layoutStyle}
              value={BlogLayoutStyle.MIXED}
              class="sr-only"
            />
            <div
              class="p-4 border-2 flex-1 flex flex-col {formData.layoutStyle ===
              BlogLayoutStyle.MIXED
                ? 'border-accent'
                : 'border-gray-300'}"
            >
              <div class="text-[11px] uppercase tracking-[0.18em] text-accent-muted mb-2">
                MIXED
              </div>
              <h4 class="font-medium mb-2">Mixed Feed</h4>
              <p class="text-sm text-accent-muted flex-grow">
                Adaptive grid where each post keeps its own format.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.categories') || 'Blog Categories'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 mb-4">
          <input
            type="text"
            bind:value={categoryName}
            placeholder={t('blog.categoryName') || 'Category name'}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
          <input
            type="text"
            bind:value={categorySlug}
            placeholder="category-slug"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
          <button
            type="button"
            on:click={createCategory}
            class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
          >
            Create
          </button>
        </div>
        <div class="space-y-2">
          {#if categories.length === 0}
            <p class="text-sm text-accent-muted">
              {t('blog.noCategories') || 'No categories yet.'}
            </p>
          {:else}
            {#each categories as category}
              <div class="flex items-center justify-between gap-4 border border-gray-300 p-3">
                <div>
                  <div class="font-medium">{category.name}</div>
                  <div class="text-xs text-accent-muted">{category.slug}</div>
                </div>
                <button
                  type="button"
                  on:click={() => deleteCategory(category.id)}
                  class="px-3 py-1 bg-red-500 text-white hover:bg-red-600 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.authors') || 'Blog Authors'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <input
            type="text"
            bind:value={authorName}
            placeholder={t('blog.authorName') || 'Author name'}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
          <input
            type="text"
            bind:value={authorSlug}
            placeholder="author-slug"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
          <button
            type="button"
            on:click={createAuthor}
            class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
          >
            {t('blog.createAuthor') || 'Create Author'}
          </button>
        </div>
        <div class="mb-4">
          <label for="blog-author-avatar-url" class="block text-sm font-medium mb-2"
            >{t('blog.authorAvatar') || 'Author Avatar'}</label
          >
          <input
            bind:this={authorAvatarFileInput}
            type="file"
            accept="image/*"
            aria-label="Author avatar upload"
            on:change={(e) => {
              const target = e.target;
              if (target && target instanceof HTMLInputElement && target.files && target.files[0]) {
                uploadAuthorAvatar(target.files[0]);
              }
            }}
            class="hidden"
          />
          <input
            id="blog-author-avatar-url"
            type="url"
            bind:value={authorAvatarUrl}
            placeholder={t('blog.avatarUrl') || 'Avatar URL'}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-3"
          />
          <div
            class="relative border-2 border-dashed p-5 text-center transition-all cursor-pointer {isDraggingAuthorAvatar
              ? 'border-accent bg-accent/5'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}"
            on:dragover={handleAuthorAvatarDragOver}
            on:dragleave={handleAuthorAvatarDragLeave}
            on:drop={handleAuthorAvatarDrop}
            on:click={openAuthorAvatarDialog}
            role="button"
            tabindex="0"
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openAuthorAvatarDialog();
              }
            }}
          >
            {#if authorAvatarUrl}
              <div class="flex flex-col items-center justify-center gap-3">
                <img
                  src={authorAvatarUrl}
                  alt="Author avatar preview"
                  class="h-20 w-20 rounded-full object-cover border border-gray-300"
                />
                <p class="text-xs text-gray-600">
                  {uploadingAuthorAvatar
                    ? t('common.uploading') || 'Uploading...'
                    : t('blog.authorAvatarReplace') || 'Drag a new avatar here or click to replace'}
                </p>
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center gap-2 text-gray-600">
                <div class="text-sm font-medium">
                  {uploadingAuthorAvatar
                    ? t('blog.uploadingAvatar') || 'Uploading avatar...'
                    : t('blog.authorAvatarDropzone') || 'Drop avatar here or click to upload'}
                </div>
                <div class="text-xs">
                  {t('blog.authorAvatarHint') || 'Recommended: square image, at least 600 x 600 px'}
                </div>
              </div>
            {/if}
          </div>
        </div>
        <textarea
          bind:value={authorBio}
          rows="3"
          placeholder={t('blog.authorBio') || 'Author bio'}
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-4"
        ></textarea>
        <div class="space-y-2">
          {#if authors.length === 0}
            <p class="text-sm text-accent-muted">{t('blog.noAuthors') || 'No authors yet.'}</p>
          {:else}
            {#each authors as author}
              <div class="flex items-center justify-between gap-4 border border-gray-300 p-3">
                <div class="flex items-center gap-3">
                  {#if author.avatarUrl}
                    <img
                      src={author.avatarUrl}
                      alt={author.name}
                      class="w-10 h-10 object-cover rounded-full"
                    />
                  {/if}
                  <div>
                    <div class="font-medium">{author.name}</div>
                    <div class="text-xs text-accent-muted">{author.slug}</div>
                  </div>
                </div>
                <button
                  type="button"
                  on:click={() => deleteAuthor(author.id)}
                  class="px-3 py-1 bg-red-500 text-white hover:bg-red-600 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Header Settings -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.header') || 'Header'}</h3>
        <div class="space-y-4">
          <div>
            <label for="blog-header-title" class="block text-sm font-medium mb-2"
              >{t('blog.headerTitle') || 'Header Title'}</label
            >
            <input
              id="blog-header-title"
              type="text"
              bind:value={formData.headerTitle}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="Blog"
            />
          </div>
          <div>
            <label for="blog-header-subtitle" class="block text-sm font-medium mb-2"
              >{t('blog.headerSubtitle') || 'Header Subtitle'}</label
            >
            <input
              id="blog-header-subtitle"
              type="text"
              bind:value={formData.headerSubtitle}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="Latest news and updates"
            />
          </div>
          <div>
            <label for="blog-header-image-url" class="block text-sm font-medium mb-2"
              >{t('blog.headerImage') || 'Header Image'}</label
            >
            <input
              bind:this={headerImageFileInput}
              id="blog-header-image-file"
              type="file"
              accept="image/*"
              aria-label={t('blog.headerImage') || 'Header image upload'}
              on:change={(e) => {
                const target = e.target;
                if (
                  target &&
                  target instanceof HTMLInputElement &&
                  target.files &&
                  target.files[0]
                ) {
                  uploadHeaderImage(target.files[0]);
                }
              }}
              class="hidden"
            />
            <div class="flex gap-2">
              <button
                type="button"
                on:click={() => headerImageFileInput?.click()}
                disabled={uploadingHeaderImage}
                class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadingHeaderImage
                  ? t('common.uploading') || 'Uploading...'
                  : t('blog.uploadImage') || 'Upload Image'}
              </button>
              <input
                id="blog-header-image-url"
                type="url"
                bind:value={formData.headerImageUrl}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="Or enter image URL"
              />
            </div>
            {#if formData.headerImageUrl}
              <img src={formData.headerImageUrl} alt="Header" class="mt-2 w-64 h-32 object-cover" />
            {/if}
            <div
              class="mt-3 rounded border border-gray-300 bg-gray-50 p-3 text-xs text-gray-600 space-y-1"
            >
              <p>
                <strong>{t('blog.safeBannerSize') || 'Safe banner size:'}</strong>
                {t('blog.safeBannerSizeHint') || '2400 x 1400 px or larger.'}
              </p>
              <p>
                <strong>{t('blog.safeTextArea') || 'Safe text area:'}</strong>
                {t('blog.safeTextAreaHint') ||
                  'Keep logo/title in the center area around 1600 x 900 px.'}
              </p>
              <p>
                <strong>{t('blog.bannerBestPractice') || 'Best practice:'}</strong>
                {t('blog.bannerBestPracticeHint') ||
                  'Use one clear focal point and avoid important details near top/bottom edges.'}
              </p>
            </div>
            <div class="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                on:click={applyFullscreenBanner}
                class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
              >
                {t('blog.fullscreen') || 'Fullscreen'}
              </button>
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={formData.heroFullscreen} class="w-4 h-4" />
                <span>{t('blog.useFullscreenBanner') || 'Use fullscreen banner'}</span>
              </label>
            </div>
          </div>
          <div>
            <label for="blog-header-video-url" class="block text-sm font-medium mb-2"
              >{t('blog.headerVideo') || 'Header Video'}</label
            >
            <input
              bind:this={headerVideoFileInput}
              id="blog-header-video-file"
              type="file"
              accept="video/*"
              aria-label={t('blog.headerVideo') || 'Header video upload'}
              on:change={(e) => {
                const target = e.target;
                if (
                  target &&
                  target instanceof HTMLInputElement &&
                  target.files &&
                  target.files[0]
                ) {
                  uploadHeaderVideo(target.files[0]);
                }
              }}
              class="hidden"
            />
            <div class="flex gap-2">
              <button
                type="button"
                on:click={() => headerVideoFileInput?.click()}
                disabled={uploadingHeaderVideo}
                class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadingHeaderVideo
                  ? t('common.uploading') || 'Uploading...'
                  : t('blog.uploadVideo') || 'Upload Video'}
              </button>
              <input
                id="blog-header-video-url"
                type="url"
                bind:value={formData.headerVideoUrl}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="Or enter video URL"
              />
            </div>
          </div>
          <label class="flex items-center gap-3">
            <input type="checkbox" bind:checked={formData.heroFullscreen} class="w-4 h-4" />
            <span class="text-sm font-medium"
              >{t('blog.fullscreenBannerHomepage') || 'Fullscreen banner on blog homepage'}</span
            >
          </label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="blog-hero-height" class="block text-sm font-medium mb-2"
                >{t('blog.bannerHeight') || 'Banner height'}</label
              >
              <select
                id="blog-hero-height"
                bind:value={formData.heroHeight}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="50vh">Small 50vh</option>
                <option value="60vh">Medium 60vh</option>
                <option value="70vh">Large 70vh</option>
                <option value="80vh">XL 80vh</option>
                <option value="90vh">Almost fullscreen 90vh</option>
                <option value="100vh">Fullscreen 100vh</option>
              </select>
              <p class="mt-2 text-xs text-accent-muted">
                Height controls the real banner viewport height on the blog homepage.
              </p>
            </div>
            <label class="flex items-center gap-3 pt-8">
              <input type="checkbox" bind:checked={formData.heroAutoZoom} class="w-4 h-4" />
              <span class="text-sm font-medium"
                >{t('blog.autoZoomBannerMedia') || 'Auto zoom image/video to fill banner'}</span
              >
            </label>
          </div>
        </div>
      </div>

      <!-- Grid Settings -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.gridSettings') || 'Grid Settings'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="blog-grid-columns" class="block text-sm font-medium mb-2"
              >{t('blog.gridColumns') || 'Grid Columns'}</label
            >
            <select
              id="blog-grid-columns"
              bind:value={formData.gridColumns}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="grid-cols-1">1 Column</option>
              <option value="grid-cols-1 md:grid-cols-2">2 Columns (md+)</option>
              <option value="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">3 Columns (lg+)</option>
              <option value="grid-cols-1 md:grid-cols-2 lg:grid-cols-4">4 Columns (lg+)</option>
              <option value="grid-cols-2 md:grid-cols-3 lg:grid-cols-4">4 Columns (always)</option>
            </select>
          </div>
          <div>
            <label for="blog-gap" class="block text-sm font-medium mb-2"
              >{t('blog.gap') || 'Gap'}</label
            >
            <select
              id="blog-gap"
              bind:value={formData.gap}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="gap-2">Small (gap-2)</option>
              <option value="gap-4">Medium (gap-4)</option>
              <option value="gap-6">Large (gap-6)</option>
              <option value="gap-8">Extra Large (gap-8)</option>
            </select>
          </div>
          <div>
            <label for="blog-items-per-page" class="block text-sm font-medium mb-2"
              >{t('blog.itemsPerPage') || 'Items Per Page'}</label
            >
            <input
              id="blog-items-per-page"
              type="number"
              bind:value={formData.itemsPerPage}
              min="1"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          {#if formData.layoutStyle === BlogLayoutStyle.MIXED}
            <div>
              <label for="blog-aspect-ratio" class="block text-sm font-medium mb-2"
                >{t('blog.aspectRatio') || 'Aspect Ratio'}</label
              >
              <select
                id="blog-aspect-ratio"
                bind:value={formData.aspectRatio}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="aspect-video">Video (16:9)</option>
                <option value="aspect-[4/5]">Portrait (4:5)</option>
                <option value="aspect-square">Square (1:1)</option>
                <option value="aspect-[9/16]">Vertical (9:16)</option>
              </select>
            </div>
          {/if}
        </div>
      </div>

      <!-- Featured Post (Magazine Layout) -->
      {#if formData.layoutStyle === BlogLayoutStyle.MAGAZINE}
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('blog.featuredPost') || 'Featured Post'}</h3>
          <div>
            <label for="blog-featured-post" class="block text-sm font-medium mb-2"
              >{t('blog.selectFeaturedPost') || 'Select Featured Post'}</label
            >
            <select
              id="blog-featured-post"
              bind:value={formData.featuredPostId}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="">None</option>
              {#each posts as post}
                <option value={post.id}>{post.title}</option>
              {/each}
            </select>
          </div>
        </div>
      {/if}

      <!-- Display Options -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.displayOptions') || 'Display Options'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.showExcerpt} class="w-4 h-4" />
            <span>{t('blog.showExcerpt') || 'Show Excerpt'}</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.showAuthor} class="w-4 h-4" />
            <span>{t('blog.showAuthor') || 'Show Author'}</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.showDate} class="w-4 h-4" />
            <span>{t('blog.showDate') || 'Show Date'}</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.showViews} class="w-4 h-4" />
            <span>{t('blog.showViews') || 'Show Views'}</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.showTags} class="w-4 h-4" />
            <span>{t('blog.showTags') || 'Show Tags'}</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.cardShadow} class="w-4 h-4" />
            <span>{t('blog.cardShadow') || 'Card Shadow'}</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.cardHoverEffect} class="w-4 h-4" />
            <span>{t('blog.cardHoverEffect') || 'Card Hover Effect'}</span>
          </label>
        </div>
      </div>

      <!-- Typography -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.typography') || 'Typography'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="blog-title-font-size" class="block text-sm font-medium mb-2"
              >{t('blog.titleFontSize') || 'Title Font Size'}</label
            >
            <select
              id="blog-title-font-size"
              bind:value={formData.titleFontSize}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="text-xl">Small (text-xl)</option>
              <option value="text-2xl">Medium (text-2xl)</option>
              <option value="text-3xl">Large (text-3xl)</option>
              <option value="text-4xl">Extra Large (text-4xl)</option>
            </select>
          </div>
          <div>
            <label for="blog-excerpt-font-size" class="block text-sm font-medium mb-2"
              >{t('blog.excerptFontSize') || 'Excerpt Font Size'}</label
            >
            <select
              id="blog-excerpt-font-size"
              bind:value={formData.excerptFontSize}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="text-sm">Small (text-sm)</option>
              <option value="text-base">Medium (text-base)</option>
              <option value="text-lg">Large (text-lg)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Colors -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('blog.colors') || 'Colors'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="blog-background-color" class="block text-sm font-medium mb-2"
              >{t('blog.backgroundColor') || 'Background Color'}</label
            >
            <div class="flex gap-2">
              <input
                id="blog-background-color-picker"
                type="color"
                bind:value={formData.backgroundColor}
                aria-label={t('blog.backgroundColor') || 'Background color picker'}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="blog-background-color"
                type="text"
                bind:value={formData.backgroundColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>
          <div>
            <label for="blog-text-color" class="block text-sm font-medium mb-2"
              >{t('blog.textColor') || 'Text Color'}</label
            >
            <div class="flex gap-2">
              <input
                id="blog-text-color-picker"
                type="color"
                bind:value={formData.textColor}
                aria-label={t('blog.textColor') || 'Text color picker'}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="blog-text-color"
                type="text"
                bind:value={formData.textColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>
          <div>
            <label for="blog-accent-color" class="block text-sm font-medium mb-2"
              >{t('blog.accentColor') || 'Accent Color'}</label
            >
            <div class="flex gap-2">
              <input
                id="blog-accent-color-picker"
                type="color"
                bind:value={formData.accentColor}
                aria-label={t('blog.accentColor') || 'Accent color picker'}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="blog-accent-color"
                type="text"
                bind:value={formData.accentColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Video Settings (TikTok Layout) -->
      {#if formData.layoutStyle === BlogLayoutStyle.TIKTOK}
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('blog.videoSettings') || 'Video Settings'}</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={formData.videoAutoplay} class="w-4 h-4" />
              <span>{t('blog.videoAutoplay') || 'Autoplay'}</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={formData.videoLoop} class="w-4 h-4" />
              <span>{t('blog.videoLoop') || 'Loop'}</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={formData.videoMuted} class="w-4 h-4" />
              <span>{t('blog.videoMuted') || 'Muted'}</span>
            </label>
          </div>
        </div>
      {/if}

      <!-- Save Button -->
      <div class="flex justify-end">
        <button
          on:click={saveSettings}
          class="px-6 py-2 bg-accent text-white hover:bg-accent-muted transition-colors"
        >
          {t('common.save') || 'Save Settings'}
        </button>
      </div>
    </div>
  {/if}
</div>
