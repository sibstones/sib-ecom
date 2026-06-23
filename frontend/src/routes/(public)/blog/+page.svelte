<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    blogApi,
    type BlogPost,
    type BlogSettings,
    BlogLayoutStyle,
    BlogMediaFormat,
    type BlogCategory,
    type BlogAuthor,
  } from '$lib/api/blog.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';
  import {
    getAspectClass,
    getFormatLabel,
    inferMediaFormat,
    resolveBlogPostFormat,
  } from '$lib/utils/blog-media';

  let posts: BlogPost[] = [];
  let settings: BlogSettings | null = null;
  let loading = true;
  let error = '';
  let categories: BlogCategory[] = [];
  let authors: BlogAuthor[] = [];
  let selectedCategory = 'ALL';
  let selectedAuthorSlug = 'ALL';
  let searchQuery = '';
  let sortOrder: 'NEWEST' | 'OLDEST' = 'NEWEST';
  let visibleCount = 0;
  let mediaFormats: Record<string, BlogMediaFormat> = {};
  let loadMoreTrigger: HTMLDivElement | null = null;
  let loadMoreObserver: IntersectionObserver | null = null;

  $: currentLanguage = $i18nStore;
  $: requestedAuthorSlug = $page.url.searchParams.get('author') || 'ALL';
  $: selectedAuthor =
    selectedAuthorSlug === 'ALL'
      ? null
      : authors.find((author) => author.slug === selectedAuthorSlug) || null;
  $: if (requestedAuthorSlug !== selectedAuthorSlug) {
    selectedAuthorSlug = requestedAuthorSlug;
    resetVisiblePosts();
  }

  async function loadBlog() {
    if (!currentLanguage) return;

    loading = true;
    try {
      const [postsResponse, settingsResponse, categoriesResponse, authorsResponse] =
        await Promise.all([
          blogApi.getAllPosts(true, currentLanguage),
          blogApi.getSettings(currentLanguage),
          blogApi.getAllCategories(),
          blogApi.getAllAuthors(),
        ]);

      posts = postsResponse.posts;
      settings = settingsResponse.settings;
      categories = categoriesResponse.categories;
      authors = authorsResponse.authors;
      mediaFormats = {};
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : t('blog.failedToLoad');
      console.error('Failed to load blog:', e);
    } finally {
      loading = false;
    }
  }

  let previousLanguage: string | undefined = undefined;
  let isInitialLoad = true;

  $: if (currentLanguage && currentLanguage !== previousLanguage && !isInitialLoad) {
    previousLanguage = currentLanguage;
    loadBlog();
  }

  onMount(async () => {
    await loadBlog();
    isInitialLoad = false;
    previousLanguage = currentLanguage;
    setupInfiniteScroll();
  });

  onDestroy(() => {
    loadMoreObserver?.disconnect();
  });

  $: filteredPosts = posts
    .filter((post) => {
      const categoryMatch = selectedCategory === 'ALL' || post.category?.id === selectedCategory;
      const authorMatch =
        selectedAuthorSlug === 'ALL' || post.blogAuthor?.slug === selectedAuthorSlug;
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const searchMatch =
        !normalizedQuery ||
        [
          post.title,
          post.excerpt || '',
          post.content || '',
          post.category?.name || '',
          post.blogAuthor?.name || '',
          ...(post.tags || []),
        ].some((value) => value.toLowerCase().includes(normalizedQuery));

      return categoryMatch && authorMatch && searchMatch;
    })
    .sort((a, b) => {
      const aTime = new Date(a.publishedAt || a.createdAt).getTime();
      const bTime = new Date(b.publishedAt || b.createdAt).getTime();
      return sortOrder === 'OLDEST' ? aTime - bTime : bTime - aTime;
    });
  $: itemsPerPage = settings?.itemsPerPage || 12;
  $: if (visibleCount === 0 && itemsPerPage > 0) {
    visibleCount = itemsPerPage;
  }
  $: visibleCount = Math.min(
    Math.max(visibleCount, itemsPerPage),
    Math.max(filteredPosts.length, itemsPerPage)
  );
  $: paginatedPosts = filteredPosts.slice(0, visibleCount);
  $: hasMorePosts = visibleCount < filteredPosts.length;
  $: gridClasses = getGridClasses(settings?.layoutStyle, settings?.gridColumns);
  $: gapClasses = settings?.gap || 'gap-4';
  $: isMagazineLayout = settings?.layoutStyle === BlogLayoutStyle.MAGAZINE;
  $: featuredPost =
    isMagazineLayout && settings?.featuredPost
      ? filteredPosts.find((post) => post.id === settings?.featuredPost?.id) || null
      : null;

  function getGridClasses(layoutStyle?: BlogLayoutStyle, fallback?: string) {
    if (layoutStyle === BlogLayoutStyle.TIKTOK) {
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
    if (layoutStyle === BlogLayoutStyle.INSTAGRAM) {
      return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    }
    if (layoutStyle === BlogLayoutStyle.MIXED) {
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    }
    return fallback || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(currentLanguage || 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function incrementViews(post: BlogPost) {
    blogApi.incrementViews(post.id).catch(console.error);
  }

  async function startVideoPreview(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    const video = target.querySelector('video[data-hover-preview="true"]');
    if (!(video instanceof HTMLVideoElement)) return;

    if (video.preload === 'none') {
      video.preload = 'metadata';
      if (video.readyState === 0) {
        video.load();
      }
    }

    try {
      await video.play();
    } catch (error) {
      console.debug('Video preview play prevented:', error);
    }
  }

  function stopVideoPreview(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    const video = target.querySelector('video[data-hover-preview="true"]');
    if (!(video instanceof HTMLVideoElement)) return;

    video.pause();
    if (settings?.layoutStyle !== BlogLayoutStyle.TIKTOK) {
      video.currentTime = 0;
    }
  }

  function setCategoryFilter(categoryId: string) {
    selectedCategory = categoryId;
    resetVisiblePosts();
  }

  function setSortOrder(order: 'NEWEST' | 'OLDEST') {
    sortOrder = order;
    resetVisiblePosts();
  }

  async function setAuthorFilter(authorSlug: string) {
    selectedAuthorSlug = authorSlug;
    resetVisiblePosts();
    const query = new URLSearchParams($page.url.searchParams);
    if (authorSlug === 'ALL') {
      query.delete('author');
    } else {
      query.set('author', authorSlug);
    }

    const search = query.toString();
    await goto(search ? `/blog?${search}` : '/blog', {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  function resetVisiblePosts() {
    visibleCount = itemsPerPage;
  }

  function loadMorePosts() {
    if (!hasMorePosts) return;
    visibleCount = Math.min(visibleCount + itemsPerPage, filteredPosts.length);
  }

  function setupInfiniteScroll() {
    if (typeof IntersectionObserver === 'undefined') return;
    loadMoreObserver?.disconnect();
    loadMoreObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMorePosts();
        }
      },
      {
        rootMargin: '400px 0px',
        threshold: 0,
      }
    );

    if (loadMoreTrigger) {
      loadMoreObserver.observe(loadMoreTrigger);
    }
  }

  function updateMediaFormat(postId: string, width?: number, height?: number) {
    const format = inferMediaFormat(width, height);
    if (format !== BlogMediaFormat.AUTO && mediaFormats[postId] !== format) {
      mediaFormats = { ...mediaFormats, [postId]: format };
    }
  }

  function updateImageFormat(postId: string, target: EventTarget | null) {
    if (!(target instanceof HTMLImageElement)) return;
    updateMediaFormat(postId, target.naturalWidth, target.naturalHeight);
  }

  function updateVideoFormat(postId: string, target: EventTarget | null) {
    if (!(target instanceof HTMLVideoElement)) return;
    updateMediaFormat(postId, target.videoWidth, target.videoHeight);
  }

  function getPostFormat(post: BlogPost) {
    return resolveBlogPostFormat(post, settings?.layoutStyle, mediaFormats[post.id]);
  }

  function getHeroClass() {
    return '';
  }

  function getHeroStyle() {
    const height = settings?.heroFullscreen ? '100vh' : settings?.heroHeight || '70vh';
    return `height: ${height};`;
  }

  function getHeroMediaClass() {
    return settings?.heroAutoZoom ? 'scale-[1.12]' : '';
  }

  function hasHero() {
    return !!(
      settings?.headerTitle ||
      settings?.headerSubtitle ||
      settings?.headerImageUrl ||
      settings?.headerVideoUrl
    );
  }

  $: if (loadMoreTrigger) {
    setupInfiniteScroll();
  }
</script>

<svelte:head>
  <title>{settings?.headerTitle || t('blog.title')}</title>
  <meta name="description" content={settings?.headerSubtitle || t('blog.title')} />
</svelte:head>

<div
  style="background-color: {settings?.backgroundColor || '#ffffff'}; color: {settings?.textColor ||
    '#000000'};"
>
  {#if loading}
    <div class="container mx-auto px-4 py-20">
      <LoadingBar />
    </div>
  {:else if error}
    <div class="container mx-auto px-4">
      <div class="text-center py-20">
        <p class="text-red-500">{error}</p>
      </div>
    </div>
  {:else if !settings}
    <div class="container mx-auto px-4">
      <div class="text-center py-20">
        <p>{t('blog.notConfigured') || 'Blog is not configured yet'}</p>
      </div>
    </div>
  {:else}
    {#if hasHero()}
      <section class="relative overflow-hidden mb-2">
        <div class="relative flex {getHeroClass()}" style={getHeroStyle()}>
          <div class="absolute inset-0 bg-black/30 z-10"></div>
          {#if settings.headerVideoUrl}
            <video
              src={settings.headerVideoUrl}
              autoplay={settings.videoAutoplay}
              loop={settings.videoLoop}
              muted={settings.videoMuted}
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 {getHeroMediaClass()}"
              playsinline
            ></video>
          {:else if settings.headerImageUrl}
            <BlurredImage
              src={settings.headerImageUrl}
              alt={settings.headerTitle || 'Blog Header'}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${getHeroMediaClass()}`}
              eager={true}
              fetchPriority="high"
            />
          {:else}
            <div
              class="absolute inset-0"
              style="background: linear-gradient(135deg, {settings.accentColor ||
                '#000000'} 0%, {settings.backgroundColor || '#ffffff'} 100%);"
            ></div>
          {/if}

          <div class="absolute inset-x-0 bottom-0 z-20 px-4 py-10">
            <div class="container mx-auto">
              <div class="max-w-3xl text-white">
                {#if settings.headerTitle}
                  <h1 class="{settings.titleFontSize || 'text-5xl'} font-bold mb-4">
                    {settings.headerTitle}
                  </h1>
                {/if}
                {#if settings.headerSubtitle}
                  <p class="{settings.excerptFontSize || 'text-xl'} opacity-90 max-w-2xl">
                    {settings.headerSubtitle}
                  </p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </section>
    {/if}

    <div
      class="container mx-auto px-4 {hasHero()
        ? ''
        : settings?.paddingTop || 'py-8'} {settings?.paddingBottom || 'py-8'}"
    >
      <section class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="w-full lg:max-w-sm lg:flex-shrink-0">
          <input
            type="search"
            bind:value={searchQuery}
            placeholder={t('blog.searchPosts')}
            class="w-full px-4 py-3 text-sm border border-black/15 bg-white text-black placeholder:text-black/40"
            on:input={resetVisiblePosts}
          />
        </div>
        <div
          class="flex w-full flex-col gap-3 lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center lg:justify-end"
        >
          <div class="flex min-w-0 flex-wrap gap-2 lg:justify-end">
            <button
              on:click={() => setCategoryFilter('ALL')}
              class="px-4 py-3 text-sm border transition-colors {selectedCategory === 'ALL'
                ? 'border-black text-white bg-black'
                : 'border-black/15 bg-transparent'}"
            >
              {t('blog.allCategories')}
            </button>
            {#each categories as category}
              <button
                on:click={() => setCategoryFilter(category.id)}
                class="px-4 py-3 text-sm border transition-colors {selectedCategory === category.id
                  ? 'border-black text-white bg-black'
                  : 'border-black/15 bg-transparent'}"
              >
                {category.name}
              </button>
            {/each}
          </div>
          <div class="w-full lg:w-auto lg:flex-shrink-0">
            <select
              bind:value={selectedAuthorSlug}
              on:change={(event) =>
                setAuthorFilter((event.currentTarget as HTMLSelectElement).value)}
              class="w-full min-w-[180px] px-4 py-3 text-sm border border-black/15 bg-white text-black"
            >
              <option value="ALL">{t('blog.allAuthors') || 'All authors'}</option>
              {#each authors as author}
                <option value={author.slug}>{author.name}</option>
              {/each}
            </select>
          </div>
          <div class="w-full lg:w-auto lg:flex-shrink-0">
            <select
              bind:value={sortOrder}
              on:change={(event) =>
                setSortOrder(
                  (event.currentTarget as HTMLSelectElement).value as 'NEWEST' | 'OLDEST'
                )}
              class="w-full min-w-[140px] px-4 py-3 text-sm border border-black/15 bg-white text-black"
            >
              <option value="NEWEST">{t('blog.sortNewest')}</option>
              <option value="OLDEST">{t('blog.sortOldest')}</option>
            </select>
          </div>
        </div>
      </section>

      {#if selectedAuthor}
        <section class="mb-8 border border-black/10 bg-black/[0.02] px-4 py-4 sm:px-5">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-4">
              {#if selectedAuthor.avatarUrl}
                <img
                  src={selectedAuthor.avatarUrl}
                  alt={selectedAuthor.name}
                  class="h-14 w-14 rounded-full object-cover"
                  loading="lazy"
                />
              {/if}
              <div>
                <p class="text-[11px] uppercase tracking-[0.2em] opacity-50">
                  {t('blog.authorFilter') || 'Author filter'}
                </p>
                <h2 class="text-xl font-semibold">{selectedAuthor.name}</h2>
                {#if selectedAuthor.bio}
                  <p class="mt-1 max-w-2xl text-sm opacity-70">{selectedAuthor.bio}</p>
                {/if}
              </div>
            </div>
            <button
              type="button"
              on:click={() => setAuthorFilter('ALL')}
              class="self-start border border-black px-4 py-2 text-sm transition-colors hover:bg-black hover:text-white sm:self-center"
            >
              {t('blog.showAllPosts') || 'Show all posts'}
            </button>
          </div>
        </section>
      {/if}

      {#if featuredPost}
        <div class="mb-12">
          <a
            href={`/blog/${featuredPost.slug}`}
            data-sveltekit-preload-data="hover"
            on:click={() => incrementViews(featuredPost)}
            on:mouseenter={(event) => startVideoPreview(event.currentTarget)}
            on:mouseleave={(event) => stopVideoPreview(event.currentTarget)}
            class="block cursor-pointer group no-underline text-inherit"
          >
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div
                class="relative aspect-video overflow-hidden rounded-none bg-black"
                style="box-shadow: {settings.cardShadow ? '0 4px 16px rgba(0,0,0,0.12)' : 'none'};"
              >
                {#if featuredPost.videoUrl}
                  <video
                    src={featuredPost.videoUrl}
                    class="w-full h-full object-cover"
                    data-hover-preview="true"
                    autoplay={settings.layoutStyle === BlogLayoutStyle.TIKTOK &&
                      settings.videoAutoplay}
                    loop={settings.videoLoop}
                    muted={settings.videoMuted}
                    preload={settings.layoutStyle === BlogLayoutStyle.TIKTOK ? 'metadata' : 'none'}
                    playsinline
                    on:loadedmetadata={(event) =>
                      updateVideoFormat(featuredPost.id, event.currentTarget)}
                  ></video>
                {:else if featuredPost.thumbnailUrl}
                  <img
                    src={featuredPost.thumbnailUrl}
                    alt={featuredPost.title}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    on:load={(event) => updateImageFormat(featuredPost.id, event.currentTarget)}
                  />
                {/if}
              </div>
              <div>
                {#if settings.showTags && featuredPost.tags.length > 0}
                  <div class="flex flex-wrap gap-2 mb-3">
                    {#each featuredPost.tags as tag}
                      <span
                        class="px-2 py-1 text-xs rounded"
                        style="background-color: {settings.accentColor ||
                          '#000000'}; color: {settings.backgroundColor || '#ffffff'};"
                      >
                        {tag}
                      </span>
                    {/each}
                  </div>
                {/if}
                <h2
                  class="{settings.titleFontSize ||
                    'text-3xl'} font-bold mb-4 group-hover:opacity-80 transition-opacity"
                >
                  {featuredPost.title}
                </h2>
                {#if settings.showExcerpt && featuredPost.excerpt}
                  <p class="{settings.excerptFontSize || 'text-base'} mb-4 opacity-80">
                    {featuredPost.excerpt}
                  </p>
                {/if}
                <div class="flex flex-wrap items-center gap-4 text-sm opacity-70">
                  <span>{getFormatLabel(getPostFormat(featuredPost))}</span>
                  {#if settings.showAuthor && featuredPost.blogAuthor}
                    <span>{featuredPost.blogAuthor.name}</span>
                  {:else if settings.showAuthor && featuredPost.author}
                    <span>{featuredPost.author.firstName} {featuredPost.author.lastName}</span>
                  {/if}
                  {#if settings.showDate && featuredPost.publishedAt}
                    <span>{formatDate(featuredPost.publishedAt)}</span>
                  {/if}
                  {#if settings.showViews}
                    <span>{featuredPost.views} {t('blog.views') || 'views'}</span>
                  {/if}
                </div>
              </div>
            </div>
          </a>
        </div>
      {/if}

      <div class="grid {gridClasses} {gapClasses}">
        {#each paginatedPosts as post}
          {@const isFeatured = featuredPost?.id === post.id}
          {@const postFormat = getPostFormat(post)}
          {#if !isFeatured}
            <a
              href={`/blog/${post.slug}`}
              data-sveltekit-preload-data="hover"
              on:click={() => incrementViews(post)}
              on:mouseenter={(event) => startVideoPreview(event.currentTarget)}
              on:mouseleave={(event) => stopVideoPreview(event.currentTarget)}
              class="block cursor-pointer group overflow-hidden no-underline text-inherit"
              style="background-color: {settings.backgroundColor || '#ffffff'};"
            >
              <div class="relative {getAspectClass(postFormat)} overflow-hidden bg-black">
                {#if post.videoUrl}
                  <video
                    src={post.videoUrl}
                    class="w-full h-full object-cover {settings.cardHoverEffect
                      ? 'group-hover:scale-105'
                      : ''} transition-transform duration-300"
                    data-hover-preview="true"
                    autoplay={settings.layoutStyle === BlogLayoutStyle.TIKTOK &&
                      settings.videoAutoplay}
                    loop={settings.layoutStyle === BlogLayoutStyle.TIKTOK && settings.videoLoop}
                    muted={settings.layoutStyle === BlogLayoutStyle.TIKTOK && settings.videoMuted}
                    preload={settings.layoutStyle === BlogLayoutStyle.TIKTOK ? 'metadata' : 'none'}
                    playsinline
                    on:loadedmetadata={(event) => updateVideoFormat(post.id, event.currentTarget)}
                  ></video>
                {:else if post.thumbnailUrl}
                  <img
                    src={post.thumbnailUrl}
                    alt={post.title}
                    class="w-full h-full object-cover {settings.cardHoverEffect
                      ? 'group-hover:scale-105'
                      : ''} transition-transform duration-300"
                    loading="lazy"
                    on:load={(event) => updateImageFormat(post.id, event.currentTarget)}
                  />
                {:else}
                  <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                    <svg
                      class="w-16 h-16 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                {/if}
              </div>

              <div class="p-4">
                <div
                  class="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.14em] opacity-60"
                >
                  {#if post.category?.name}
                    <span>{post.category.name}</span>
                  {/if}
                </div>

                {#if settings.showTags && post.tags.length > 0}
                  <div class="flex flex-wrap gap-2 mb-2">
                    {#each post.tags.slice(0, 3) as tag}
                      <span
                        class="px-2 py-1 text-xs rounded"
                        style="background-color: {settings.accentColor ||
                          '#000000'}; color: {settings.backgroundColor || '#ffffff'};"
                      >
                        {tag}
                      </span>
                    {/each}
                  </div>
                {/if}

                <h3
                  class="{settings.titleFontSize ||
                    'text-xl'} font-bold mb-2 group-hover:opacity-80 transition-opacity"
                >
                  {post.title}
                </h3>

                {#if settings.showExcerpt && post.excerpt}
                  <p class="{settings.excerptFontSize || 'text-sm'} mb-3 opacity-80 line-clamp-2">
                    {post.excerpt}
                  </p>
                {/if}

                <div class="flex flex-wrap items-center gap-3 text-xs opacity-70">
                  {#if settings.showAuthor && post.blogAuthor}
                    <span>{post.blogAuthor.name}</span>
                  {:else if settings.showAuthor && post.author}
                    <span>{post.author.firstName} {post.author.lastName}</span>
                  {/if}
                  {#if settings.showDate && post.publishedAt}
                    <span>{formatDate(post.publishedAt)}</span>
                  {/if}
                  {#if settings.showViews}
                    <span>{post.views} {t('blog.views') || 'views'}</span>
                  {/if}
                </div>
              </div>
            </a>
          {/if}
        {/each}
      </div>

      {#if hasMorePosts}
        <div bind:this={loadMoreTrigger} class="flex justify-center py-10 px-4">
          <div class="w-full max-w-[10rem]">
            <LoadingBar />
          </div>
        </div>
      {/if}

      {#if paginatedPosts.length === 0}
        <div class="text-center py-20">
          <p class="text-lg opacity-70">{t('blog.noPosts') || 'No blog posts found'}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
