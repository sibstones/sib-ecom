<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { blogApi, type BlogPost, BlogMediaFormat } from '$lib/api/blog.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { goto } from '$app/navigation';
  import { getAspectClass, inferMediaFormat, resolveBlogPostFormat } from '$lib/utils/blog-media';

  let post: BlogPost | null = null;
  let allPosts: BlogPost[] = [];
  let loading = true;
  let error = '';
  let mediaFormat = BlogMediaFormat.AUTO;
  let relatedMediaFormats: Record<string, BlogMediaFormat> = {};
  let relatedVisibleCount = 0;
  let relatedLoadTrigger: HTMLDivElement | null = null;
  let relatedLoadObserver: IntersectionObserver | null = null;

  // Subscribe to language store
  $: currentLanguage = $i18nStore;
  $: slug = $page.params.slug;
  $: canonicalUrl = $page.url?.toString?.() || '';
  $: seoTitle = post?.metaTitle || post?.title || t('blog.defaultPostTitle');
  $: seoDescription = post?.metaDescription || post?.excerpt || '';
  $: seoImage = post?.thumbnailUrl || '';
  $: categoryName = post?.category?.name || '';
  $: authorName =
    post?.blogAuthor?.name ||
    (post?.author
      ? [post.author.firstName, post.author.lastName].filter(Boolean).join(' ').trim() ||
        post.author.email
      : '');
  $: faqEntities = (post?.faqItems || [])
    .filter((item) => item.question?.trim() && item.answer?.trim())
    .map((item) => ({
      '@type': 'Question',
      name: item.question.trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.trim(),
      },
    }));
  $: structuredData = post
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': post.videoUrl ? 'BlogPosting' : 'Article',
            headline: seoTitle,
            description: seoDescription,
            image: seoImage ? [seoImage] : undefined,
            datePublished: post.publishedAt || post.createdAt,
            dateModified: post.updatedAt,
            mainEntityOfPage: canonicalUrl || undefined,
            articleSection: categoryName || undefined,
            keywords: post.tags?.length ? post.tags.join(', ') : undefined,
            author: authorName
              ? {
                  '@type': 'Person',
                  name: authorName,
                }
              : undefined,
          },
          ...(faqEntities.length
            ? [
                {
                  '@type': 'FAQPage',
                  mainEntity: faqEntities,
                },
              ]
            : []),
        ],
      })
    : '';
  $: structuredDataHead = structuredData
    ? `<scr` +
      `ipt type="application/ld+json">${structuredData.replace(/</g, '\\u003c')}</scr` +
      `ipt>`
    : '';
  $: feedPosts = allPosts.filter((entry) => entry.id !== post?.id);
  $: if (relatedVisibleCount === 0 && feedPosts.length > 0) {
    relatedVisibleCount = Math.min(6, feedPosts.length);
  }
  $: relatedVisibleCount = Math.min(
    Math.max(relatedVisibleCount, Math.min(6, feedPosts.length)),
    feedPosts.length
  );
  $: visibleFeedPosts = feedPosts.slice(0, relatedVisibleCount);
  $: hasMoreFeedPosts = relatedVisibleCount < feedPosts.length;

  async function loadPost() {
    if (!slug || !currentLanguage) return;

    loading = true;
    mediaFormat = BlogMediaFormat.AUTO;
    relatedMediaFormats = {};
    relatedVisibleCount = 0;
    try {
      const [postResponse, postsResponse] = await Promise.all([
        blogApi.getPostBySlug(slug, currentLanguage),
        blogApi.getAllPosts(true, currentLanguage),
      ]);
      post = postResponse.post;
      allPosts = postsResponse.posts;

      // Increment views
      if (post) {
        blogApi.incrementViews(post.id).catch(console.error);
      }

      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : t('blog.failedToLoadPost');
      console.error('Failed to load blog post:', e);
    } finally {
      loading = false;
    }
  }

  // Track previous language/slug to avoid unnecessary reloads
  let previousLanguage: string | undefined = undefined;
  let previousSlug: string | undefined = undefined;
  let isInitialLoad = true;

  // Reload post when language or slug changes
  $: if (
    currentLanguage &&
    slug &&
    (currentLanguage !== previousLanguage || slug !== previousSlug) &&
    !isInitialLoad
  ) {
    previousLanguage = currentLanguage;
    previousSlug = slug;
    loadPost();
  }

  onMount(async () => {
    await loadPost();
    isInitialLoad = false;
    previousLanguage = currentLanguage;
    previousSlug = slug;
    setupRelatedInfiniteScroll();
  });

  onDestroy(() => {
    relatedLoadObserver?.disconnect();
  });

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(currentLanguage || 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function updateImageFormat(target: EventTarget | null) {
    if (!(target instanceof HTMLImageElement)) return;
    mediaFormat = inferMediaFormat(target.naturalWidth, target.naturalHeight);
  }

  function updateVideoFormat(target: EventTarget | null) {
    if (!(target instanceof HTMLVideoElement)) return;
    mediaFormat = inferMediaFormat(target.videoWidth, target.videoHeight);
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
    } catch (previewError) {
      console.debug('Video preview play prevented:', previewError);
    }
  }

  function stopVideoPreview(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    const video = target.querySelector('video[data-hover-preview="true"]');
    if (!(video instanceof HTMLVideoElement)) return;

    video.pause();
    video.currentTime = 0;
  }

  function updateRelatedMediaFormat(postId: string, width?: number, height?: number) {
    const inferredFormat = inferMediaFormat(width, height);
    if (inferredFormat !== BlogMediaFormat.AUTO && relatedMediaFormats[postId] !== inferredFormat) {
      relatedMediaFormats = { ...relatedMediaFormats, [postId]: inferredFormat };
    }
  }

  function updateRelatedImageFormat(postId: string, target: EventTarget | null) {
    if (!(target instanceof HTMLImageElement)) return;
    updateRelatedMediaFormat(postId, target.naturalWidth, target.naturalHeight);
  }

  function updateRelatedVideoFormat(postId: string, target: EventTarget | null) {
    if (!(target instanceof HTMLVideoElement)) return;
    updateRelatedMediaFormat(postId, target.videoWidth, target.videoHeight);
  }

  function getFeedPostFormat(feedPost: BlogPost) {
    return resolveBlogPostFormat(feedPost, undefined, relatedMediaFormats[feedPost.id]);
  }

  function loadMoreFeedPosts() {
    if (!hasMoreFeedPosts) return;
    relatedVisibleCount = Math.min(relatedVisibleCount + 6, feedPosts.length);
  }

  function setupRelatedInfiniteScroll() {
    if (typeof IntersectionObserver === 'undefined') return;
    relatedLoadObserver?.disconnect();
    relatedLoadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreFeedPosts();
        }
      },
      {
        rootMargin: '400px 0px',
        threshold: 0,
      }
    );

    if (relatedLoadTrigger) {
      relatedLoadObserver.observe(relatedLoadTrigger);
    }
  }

  $: resolvedMediaFormat = post
    ? resolveBlogPostFormat(post, undefined, mediaFormat)
    : BlogMediaFormat.LANDSCAPE;
  $: if (relatedLoadTrigger) {
    setupRelatedInfiniteScroll();
  }
</script>

<svelte:head>
  <title>{seoTitle}</title>
  <meta name="description" content={seoDescription} />
  {#if canonicalUrl}
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:url" content={canonicalUrl} />
  {/if}
  {#if post}
    <meta property="og:type" content={post.videoUrl ? 'article' : 'article'} />
    <meta property="og:title" content={seoTitle} />
    {#if seoDescription}
      <meta property="og:description" content={seoDescription} />
    {/if}
    {#if seoImage}
      <meta property="og:image" content={seoImage} />
    {/if}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={seoTitle} />
    {#if seoDescription}
      <meta name="twitter:description" content={seoDescription} />
    {/if}
    {#if seoImage}
      <meta name="twitter:image" content={seoImage} />
    {/if}
    {@html structuredDataHead}
  {/if}
</svelte:head>

<div class="container mx-auto px-4 py-12">
  {#if loading}
    <div class="w-full py-20">
      <LoadingBar />
    </div>
  {:else if error}
    <div class="text-center py-20">
      <p class="text-red-500">{error}</p>
      <button
        on:click={() => goto('/blog')}
        class="mt-4 px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
      >
        {t('blog.backToBlog') || 'Back to Blog'}
      </button>
    </div>
  {:else if !post}
    <div class="text-center py-20">
      <p class="text-lg">{t('blog.postNotFound') || 'Blog post not found'}</p>
      <button
        on:click={() => goto('/blog')}
        class="mt-4 px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
      >
        {t('blog.backToBlog') || 'Back to Blog'}
      </button>
    </div>
  {:else}
    <article class="max-w-4xl mx-auto">
      <!-- Back Button -->
      <div class="mb-6">
        <button
          on:click={() => goto('/blog')}
          class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
        >
          {t('blog.backToBlog') || '← Back to Blog'}
        </button>
      </div>

      <!-- Header -->
      <header class="mb-8">
        {#if post.tags.length > 0}
          <div class="flex flex-wrap gap-2 mb-4">
            {#each post.tags as tag}
              <span class="px-3 py-1 bg-black text-white text-sm rounded">
                {tag}
              </span>
            {/each}
          </div>
        {/if}

        <h1 class="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>

        {#if post.excerpt}
          <p class="text-xl text-gray-600 mb-6">{post.excerpt}</p>
        {/if}

        <div class="flex items-center gap-4 text-sm text-gray-500">
          {#if post.blogAuthor}
            <a
              href={`/blog?author=${post.blogAuthor.slug}`}
              class="underline underline-offset-2 hover:no-underline"
            >
              {post.blogAuthor.name}
            </a>
          {:else if post.author}
            <span>{post.author.firstName} {post.author.lastName}</span>
          {/if}
          {#if post.category}
            <span>{post.category.name}</span>
          {/if}
          {#if post.publishedAt}
            <span>{formatDate(post.publishedAt)}</span>
          {/if}
          <span>{post.views} {t('blog.views') || 'views'}</span>
        </div>
      </header>

      <!-- Media -->
      {#if post.videoUrl}
        <div class="mb-8 relative {getAspectClass(resolvedMediaFormat)} bg-black">
          <video
            src={post.videoUrl}
            muted
            controls
            class="w-full h-full object-cover rounded-lg"
            on:loadedmetadata={(event) => updateVideoFormat(event.currentTarget)}
          ></video>
        </div>
      {:else if post.thumbnailUrl}
        <div class="mb-8 relative {getAspectClass(resolvedMediaFormat)} bg-gray-100">
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            class="w-full h-full object-cover rounded-lg"
            on:load={(event) => updateImageFormat(event.currentTarget)}
          />
        </div>
      {/if}

      <!-- Content -->
      {#if post.content}
        <div class="prose prose-lg max-w-none mb-8">
          {@html post.content}
        </div>
      {/if}

      <!-- Linked products (buy previews) -->
      {#if post.linkedProducts && post.linkedProducts.length > 0}
        <section class="mt-12 pt-8 border-t border-gray-200">
          <h2 class="text-2xl font-bold mb-6">{t('blog.productsInPost') || 'Products in post'}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each post.linkedProducts as product (product.id)}
              <a
                href="/shop/product/{product.slug}"
                class="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-black hover:shadow-md transition-all"
              >
                <div class="aspect-[3/4] bg-gray-100 overflow-hidden">
                  {#if product.imageUrl}
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  {:else}
                    <div
                      class="w-full h-full flex items-center justify-center text-gray-400 text-sm"
                    >
                      {t('common.noImage') || 'No image'}
                    </div>
                  {/if}
                </div>
                <div class="p-4">
                  <h3 class="font-semibold text-gray-900 group-hover:text-black line-clamp-2">
                    {product.name}
                  </h3>
                  {#if product.price != null}
                    <p class="mt-2 text-lg font-medium text-black">
                      {product.price.toLocaleString()} ₽
                    </p>
                  {:else}
                    <p class="mt-2 text-sm text-gray-500">
                      {t('product.priceOnRequest') || 'Price on request'}
                    </p>
                  {/if}
                  <span
                    class="inline-block mt-2 text-sm font-medium underline group-hover:no-underline"
                  >
                    {t('blog.viewProduct') || 'View product →'}
                  </span>
                </div>
              </a>
            {/each}
          </div>
        </section>
      {/if}
    </article>

    {#if visibleFeedPosts.length > 0}
      <section class="mt-16 border-t border-gray-200 pt-10">
        <div class="mx-auto mb-8 max-w-4xl">
          <p class="text-[11px] uppercase tracking-[0.22em] text-gray-400">
            {t('blog.continueReading') || 'Continue reading'}
          </p>
          <h2 class="mt-2 text-2xl font-semibold text-black">
            {t('blog.nextPosts') || 'Next posts'}
          </h2>
        </div>

        <div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {#each visibleFeedPosts as feedPost (feedPost.id)}
            <a
              href={`/blog/${feedPost.slug}`}
              data-sveltekit-preload-data="hover"
              on:mouseenter={(event) => startVideoPreview(event.currentTarget)}
              on:mouseleave={(event) => stopVideoPreview(event.currentTarget)}
              class="group block overflow-hidden border border-black/10 bg-white text-inherit no-underline transition-colors hover:border-black/30"
            >
              <div
                class="relative overflow-hidden bg-black {getAspectClass(
                  getFeedPostFormat(feedPost)
                )}"
              >
                {#if feedPost.videoUrl}
                  <video
                    src={feedPost.videoUrl}
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    data-hover-preview="true"
                    muted
                    loop
                    preload="none"
                    playsinline
                    on:loadedmetadata={(event) =>
                      updateRelatedVideoFormat(feedPost.id, event.currentTarget)}
                  ></video>
                {:else if feedPost.thumbnailUrl}
                  <img
                    src={feedPost.thumbnailUrl}
                    alt={feedPost.title}
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                    on:load={(event) => updateRelatedImageFormat(feedPost.id, event.currentTarget)}
                  />
                {:else}
                  <div
                    class="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-400"
                  >
                    {t('common.noImage') || 'No image'}
                  </div>
                {/if}
              </div>

              <div class="p-5">
                <div
                  class="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-gray-500"
                >
                  {#if feedPost.category?.name}
                    <span>{feedPost.category.name}</span>
                  {/if}
                  {#if feedPost.blogAuthor?.name}
                    <span>{feedPost.blogAuthor.name}</span>
                  {/if}
                </div>

                <h3
                  class="text-xl font-semibold text-black transition-opacity group-hover:opacity-75"
                >
                  {feedPost.title}
                </h3>

                {#if feedPost.excerpt}
                  <p class="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                    {feedPost.excerpt}
                  </p>
                {/if}

                <div class="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  {#if feedPost.publishedAt}
                    <span>{formatDate(feedPost.publishedAt)}</span>
                  {/if}
                  <span>{feedPost.views} {t('blog.views') || 'views'}</span>
                </div>
              </div>
            </a>
          {/each}
        </div>

        {#if hasMoreFeedPosts}
          <div bind:this={relatedLoadTrigger} class="flex justify-center py-10 px-4">
            <div class="w-full max-w-[10rem]">
              <LoadingBar />
            </div>
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  :global(.prose) {
    color: #374151;
  }

  :global(.prose h2) {
    font-size: 1.875rem;
    font-weight: 700;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  :global(.prose h3) {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.prose p) {
    margin-bottom: 1.25rem;
    line-height: 1.75;
  }

  :global(.prose a) {
    color: #000000;
    text-decoration: underline;
  }

  :global(.prose img) {
    border-radius: 0.5rem;
    margin: 1.5rem 0;
  }

  :global(.prose figure) {
    margin: 2.5rem 0;
  }

  :global(.prose figcaption) {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
    text-align: center;
  }

  :global(.prose video),
  :global(.prose audio),
  :global(.prose img) {
    width: 100%;
    max-width: 100%;
  }

  :global(.prose video) {
    border-radius: 0.75rem;
    margin: 1.5rem 0;
    background: #000000;
  }

  :global(.prose audio) {
    margin: 1rem 0 0;
  }

  :global(.prose ul, .prose ol) {
    margin: 1.25rem 0;
    padding-left: 1.625rem;
  }

  :global(.prose li) {
    margin: 0.5rem 0;
  }
</style>
