<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { pageApi, type Page } from '$lib/api/page.api';
  import Footer from '$lib/components/Footer.svelte';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import { goto } from '$app/navigation';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { getErrorMessage } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';

  let pageData: Page | null = null;
  let loading = true;
  let error = '';

  $: slug = $page.params.slug;
  // Subscribe to language store
  $: currentLanguage = $i18nStore;

  // Track previous language/slug to avoid unnecessary reloads
  let previousLanguage: string | undefined = undefined;
  let previousSlug: string | undefined = undefined;
  let isInitialLoad = true;

  type PageContentConfig = {
    imageUrl?: string;
    videoUrl?: string;
    buttonText?: string;
    buttonLink?: string;
    description?: string;
    backgroundColor?: string;
    textColor?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    titleSize?: string;
    subtitleSize?: string;
    paddingTop?: string;
    paddingBottom?: string;
    textAlign?: 'left' | 'center' | 'right';
    imageOpacity?: string;
    mediaAspectRatio?: 'auto' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16';
    sectionHeight?: string;
    overlayColor?: string;
    overlayOpacity?: string;
  };

  function parsePageContent(rawContent: string | null | undefined): {
    content: string;
    config: PageContentConfig;
  } {
    const fallback = { content: '', config: {} as PageContentConfig };

    if (!rawContent) return fallback;

    const trimmed = rawContent.trim();
    if (!trimmed) return fallback;

    try {
      const parsed = JSON.parse(trimmed) as {
        content?: unknown;
        config?: unknown;
      };

      if (parsed && typeof parsed === 'object' && ('content' in parsed || 'config' in parsed)) {
        return {
          content: typeof parsed.content === 'string' ? parsed.content : '',
          config:
            parsed.config && typeof parsed.config === 'object'
              ? (parsed.config as PageContentConfig)
              : {},
        };
      }
    } catch {
      // Not JSON, treat the value as raw HTML/text content.
    }

    return {
      content: rawContent,
      config: {},
    };
  }

  $: pageContent = parsePageContent(pageData?.content);
  $: textAlignClass =
    pageContent.config.textAlign === 'left'
      ? 'text-left'
      : pageContent.config.textAlign === 'right'
        ? 'text-right'
        : 'text-center';
  $: alignItemsClass =
    pageContent.config.textAlign === 'left'
      ? 'items-start'
      : pageContent.config.textAlign === 'right'
        ? 'items-end'
        : 'items-center';
  $: titleSizeClass = pageContent.config.titleSize || 'text-4xl sm:text-5xl lg:text-6xl';
  $: subtitleSizeClass = pageContent.config.subtitleSize || 'text-lg sm:text-xl';
  $: mediaAspectRatio = pageContent.config.mediaAspectRatio || 'auto';
  $: mediaAspectClass =
    mediaAspectRatio === '1:1'
      ? 'aspect-square'
      : mediaAspectRatio === '4:5'
        ? 'aspect-[4/5]'
        : mediaAspectRatio === '3:4'
          ? 'aspect-[3/4]'
          : mediaAspectRatio === '9:16'
            ? 'aspect-[9/16]'
            : mediaAspectRatio === '16:9'
              ? 'aspect-video'
              : '';
  $: outerStyle = [
    pageContent.config.backgroundColor
      ? `background-color: ${pageContent.config.backgroundColor}`
      : '',
    pageContent.config.textColor ? `color: ${pageContent.config.textColor}` : '',
  ]
    .filter(Boolean)
    .join('; ');
  $: sectionPaddingClass = [pageContent.config.paddingTop, pageContent.config.paddingBottom]
    .filter(Boolean)
    .join(' ');
  $: heroHeightClass = pageContent.config.sectionHeight || 'min-h-[360px]';
  $: overlayOpacity = (() => {
    const value = Number(pageContent.config.overlayOpacity ?? 0);
    if (Number.isNaN(value)) return 0;
    return Math.min(100, Math.max(0, value));
  })();
  $: imageOpacity = (() => {
    const value = Number(pageContent.config.imageOpacity ?? 100);
    if (Number.isNaN(value)) return 100;
    return Math.min(100, Math.max(0, value));
  })();
  $: buttonStyle = [
    pageContent.config.buttonColor ? `background-color: ${pageContent.config.buttonColor}` : '',
    pageContent.config.buttonTextColor ? `color: ${pageContent.config.buttonTextColor}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  async function loadPage(slugParam = slug) {
    if (!slugParam) {
      error = 'Page slug is required';
      loading = false;
      return;
    }

    if (!currentLanguage) return; // Wait for language to be initialized

    loading = true;
    error = '';
    try {
      const response = await pageApi.getBySlug(slugParam, currentLanguage);
      if (slug !== slugParam) return;

      pageData = response.page;

      if (!pageData || !pageData.isActive) {
        error = 'Page not found';
        goto('/');
        return;
      }
    } catch (e) {
      if (slug !== slugParam) return;
      error = getErrorMessage(e, 'page.failedToLoad');
      // If page not found, redirect to home
      if (error.includes('not found') || error.includes('404')) {
        goto('/');
      }
    } finally {
      if (slug === slugParam) loading = false;
    }
  }

  // Reload page when language or slug changes (but not on initial load)
  $: if (
    currentLanguage &&
    slug &&
    (currentLanguage !== previousLanguage || slug !== previousSlug) &&
    !isInitialLoad
  ) {
    previousLanguage = currentLanguage;
    previousSlug = slug;
    pageData = null;
    loadPage();
  }

  onMount(async () => {
    // Wait a bit for language store to initialize from localStorage
    await new Promise((resolve) => setTimeout(resolve, 0));
    previousLanguage = currentLanguage;
    previousSlug = slug;
    await loadPage();
    isInitialLoad = false;
  });
</script>

<svelte:head>
  {#if pageData}
    <title>{pageData.metaTitle || pageData.title}</title>
    {#if pageData.metaDescription}
      <meta name="description" content={pageData.metaDescription} />
    {/if}
  {:else}
    <title>Page |</title>
  {/if}
</svelte:head>

<main class="min-h-screen bg-white">
  {#if loading}
    <div class="container-custom py-20">
      <div class="flex items-center justify-center min-h-[60vh]">
        <div class="w-full max-w-[10rem]">
          <LoadingBar />
        </div>
      </div>
    </div>
  {:else if error}
    <div class="container-custom py-20">
      <div class="flex items-center justify-center min-h-[60vh]">
        <div class="text-center">
          <p class="text-red-600 text-lg mb-4">Error: {error}</p>
        </div>
      </div>
    </div>
  {:else if pageData}
    <article class="min-h-screen" style={outerStyle}>
      <div class={`container-custom ${sectionPaddingClass || 'py-20'}`}>
        <div class="mx-auto max-w-6xl space-y-12">
          <header class={`flex flex-col gap-6 ${alignItemsClass}`}>
            <div class={`space-y-4 ${textAlignClass} max-w-4xl`}>
              <h1 class={`${titleSizeClass} font-semibold tracking-tight text-balance`}>
                {pageData.title}
              </h1>
              {#if pageContent.config.description}
                <p class={`${subtitleSizeClass} whitespace-pre-wrap opacity-90`}>
                  {pageContent.config.description}
                </p>
              {/if}
              {#if pageContent.config.buttonText && pageContent.config.buttonLink}
                <div class={textAlignClass}>
                  <a
                    href={pageContent.config.buttonLink}
                    class="inline-flex items-center justify-center px-6 py-3 font-semibold transition-colors rounded-full shadow-sm hover:opacity-90"
                    style={buttonStyle}
                  >
                    {pageContent.config.buttonText}
                  </a>
                </div>
              {/if}
            </div>
          </header>

          {#if pageContent.config.imageUrl || pageContent.config.videoUrl}
            <section
              class={`relative overflow-hidden bg-black/5 ${heroHeightClass} ${mediaAspectClass}`}
            >
              {#if pageContent.config.imageUrl}
                <BlurredImage
                  src={pageContent.config.imageUrl}
                  alt={pageData.title}
                  eager={true}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={`opacity: ${imageOpacity / 100}`}
                />
              {:else if pageContent.config.videoUrl}
                <video
                  src={pageContent.config.videoUrl}
                  class="absolute inset-0 h-full w-full object-cover"
                  autoplay
                  loop
                  muted
                  playsinline
                ></video>
              {/if}
              <div
                class="absolute inset-0"
                style={`background-color: ${pageContent.config.overlayColor || '#000000'}; opacity: ${overlayOpacity / 100}`}
              ></div>
            </section>
          {/if}

          {#if pageContent.content}
            <section class="prose prose-lg prose-neutral max-w-none">
              {@html pageContent.content}
            </section>
          {:else if !pageContent.config.description && !pageContent.config.imageUrl && !pageContent.config.videoUrl}
            <section class="rounded-2xl border border-black/10 bg-black/5 p-6">
              <p class="text-gray-600">No content available.</p>
            </section>
          {/if}
        </div>
      </div>
    </article>
  {/if}
</main>

<Footer />
