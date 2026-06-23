<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { lookbookApi, type Lookbook } from '$lib/api/lookbook.api';
  import { t, translateSeason } from '$lib/utils/i18n';
  import { compareLookbookSeasons } from '$lib/constants/lookbook-seasons';
  import { getErrorMessage } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';

  let lookbooks: Lookbook[] = [];
  let allLookbooks: Lookbook[] = [];
  let loading = true;
  let error = '';
  let showArchive = false;
  let currentYear = new Date().getFullYear();

  // Subscribe to language store
  $: currentLanguage = $i18nStore;

  // Design settings (loaded from localStorage)
  let pageSettings = {
    title: 'Lookbook',
    titleTranslations: {} as Record<string, string>,
    titleSize: 'text-5xl',
    titleColor: '',
    backgroundColor: '',
    gridColumns: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    gap: 'gap-8',
    paddingTop: 'py-20',
    paddingBottom: '',
    cardBackgroundColor: '',
    cardTextColor: '',
    cardHoverEffect: true,
  };

  // Get translated title based on current language (reactive to language changes)
  $: translatedTitle =
    currentLanguage && pageSettings.titleTranslations?.[currentLanguage]
      ? pageSettings.titleTranslations[currentLanguage]
      : pageSettings.title || 'Lookbook';

  $: activeLookbooks = allLookbooks.filter((l) => !isArchived(l));
  $: archivedLookbooks = allLookbooks.filter((l) => isArchived(l));
  $: displayedLookbooks = showArchive ? archivedLookbooks : activeLookbooks;

  function isArchived(lookbook: Lookbook): boolean {
    // Consider archived if year is older than current year or more than 1 year old
    if (lookbook.year) {
      return lookbook.year < currentYear - 1;
    }
    // Or if created more than 1 year ago
    const createdAt = new Date(lookbook.createdAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return createdAt < oneYearAgo;
  }

  // Load lookbooks when language changes
  async function loadLookbooks() {
    if (!currentLanguage) return; // Wait for language to be initialized

    loading = true;
    try {
      const response = await lookbookApi.getAll(true, currentLanguage);
      allLookbooks = response.lookbooks.sort((a, b) => {
        // Sort by year descending, then by season
        if (a.year && b.year && a.year !== b.year) {
          return b.year - a.year;
        }
        const seasonCmp = compareLookbookSeasons(a.season, b.season);
        if (seasonCmp !== 0) {
          return seasonCmp;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      error = '';
    } catch (e) {
      error = getErrorMessage(e, 'lookbook.failedToLoadList');
      console.error('Failed to load lookbooks:', e);
    } finally {
      loading = false;
    }
  }

  // Track previous language to avoid unnecessary reloads
  let previousLanguage: string | undefined = undefined;
  let isInitialLoad = true;

  // Reload lookbooks when language changes (but not on initial load)
  $: if (currentLanguage && currentLanguage !== previousLanguage && !isInitialLoad) {
    previousLanguage = currentLanguage;
    loadLookbooks();
  }

  onMount(async () => {
    // Load page settings from localStorage
    const savedSettings = localStorage.getItem('lookbookPageSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        pageSettings = {
          ...pageSettings,
          ...parsed,
          // Ensure titleTranslations is an object
          titleTranslations: parsed.titleTranslations || {},
        };
      } catch (e) {
        console.error('Failed to load page settings:', e);
      }
    }

    // Wait a bit for language store to initialize from localStorage
    await new Promise((resolve) => setTimeout(resolve, 0));
    previousLanguage = currentLanguage;
    await loadLookbooks();
    isInitialLoad = false;
  });

  // Style objects
  $: pageStyle = {
    backgroundColor: pageSettings.backgroundColor || undefined,
  };

  $: titleStyle = {
    color: pageSettings.titleColor || undefined,
  };

  $: cardStyle = {
    backgroundColor: pageSettings.cardBackgroundColor || undefined,
    color: pageSettings.cardTextColor || undefined,
  };

  $: pageStyleStr = Object.entries(pageStyle)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
  $: titleStyleStr = Object.entries(titleStyle)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
  $: cardStyleStr = Object.entries(cardStyle)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
</script>

<main class="min-h-screen bg-white" style={pageStyleStr}>
  <div class="container-custom {pageSettings.paddingTop} {pageSettings.paddingBottom}">
    <div
      class="flex flex-col items-center gap-8 md:flex-row md:justify-between md:items-center md:gap-0 mb-16 md:mb-12"
    >
      <h1
        class="{pageSettings.titleSize} font-bold text-black text-center md:text-left w-full md:w-auto"
        style={titleStyleStr}
      >
        {translatedTitle}
      </h1>
      <div class="flex gap-2 justify-center w-full md:w-auto shrink-0">
        <button
          on:click={() => (showArchive = false)}
          class="px-4 py-2 {!showArchive
            ? 'bg-accent text-dark'
            : 'bg-white border border-gray-300 text-black'}"
        >
          {t('lookbook.current')}
        </button>
        <button
          on:click={() => (showArchive = true)}
          class="px-4 py-2 {showArchive
            ? 'bg-accent text-dark'
            : 'bg-white border border-gray-300 text-black'}"
        >
          {t('lookbook.archive')}
        </button>
      </div>
    </div>

    {#if loading}
      <div class="w-full py-20">
        <LoadingBar />
      </div>
    {:else if error}
      <div class="flex items-center justify-center py-20">
        <p class="text-red-600">{t('common.error')}: {error}</p>
      </div>
    {:else if displayedLookbooks.length === 0}
      <div class="flex items-center justify-center py-20">
        <p class="text-gray-600">
          {showArchive
            ? t('lookbook.noArchivedLookbooksAvailable')
            : t('lookbook.noLookbooksAvailable')}
        </p>
      </div>
    {:else}
      <div class="grid {pageSettings.gridColumns} {pageSettings.gap}">
        {#each displayedLookbooks as lookbook}
          <a
            href="/lookbook/{lookbook.slug || lookbook.id}"
            class="group {pageSettings.cardHoverEffect
              ? 'hover:opacity-90'
              : ''} transition-opacity"
            style={cardStyleStr}
          >
            <div class="bg-gray-100 aspect-[9/16] overflow-hidden mb-4">
              {#if lookbook.images && lookbook.images.length > 0}
                <BlurredImage
                  src={lookbook.images[0].url}
                  alt={lookbook.images[0].alt || lookbook.title}
                  className="w-full h-full object-cover {pageSettings.cardHoverEffect
                    ? 'group-hover:scale-105'
                    : ''} transition-transform duration-300"
                  loading="lazy"
                  fetchPriority="low"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center">
                  <p class="text-gray-400">{t('order.noImage')}</p>
                </div>
              {/if}
            </div>
            <h2 class="text-2xl font-medium mb-2 text-black" style={cardStyleStr}>
              {lookbook.title}
            </h2>
            {#if lookbook.season || lookbook.year}
              <p class="text-gray-600" style={cardStyleStr}>
                {translateSeason(lookbook.season)}
                {lookbook.year}
              </p>
            {/if}
          </a>
        {/each}
      </div>
    {/if}
  </div>
</main>
