<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '$lib/api/admin.api';
  import { goto } from '$app/navigation';
  import type { Lookbook } from '$lib/api/lookbook.api';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { t, translateSeason } from '$lib/utils/i18n';
  import { compareLookbookSeasons } from '$lib/constants/lookbook-seasons';
  import LookbookSeasonSelect from '$lib/components/admin/LookbookSeasonSelect.svelte';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { languageApi, type Language } from '$lib/api/language.api';

  let lookbooks: Lookbook[] = [];
  let loading = true;
  let error = '';
  let showForm = false;
  let showPageSettings = false;
  let showArchive = false;
  let editingLookbook: Lookbook | null = null;
  let currentYear = new Date().getFullYear();
  let languages: Language[] = [];

  // Translation management for page settings
  let showTitleTranslations = false;
  let editingTitleTranslation: { languageCode: string; title: string } | null = null;
  let selectedLanguageForTitleTranslation = '';
  let titleTranslationFormData = {
    title: '',
  };

  $: activeLookbooks = lookbooks.filter((l) => !isArchived(l));
  $: archivedLookbooks = lookbooks.filter((l) => isArchived(l));
  $: displayedLookbooks = showArchive ? archivedLookbooks : activeLookbooks;

  let formData = {
    title: '',
    slug: '',
    description: '',
    season: '',
    year: new Date().getFullYear(),
    isActive: true,
    isArchived: false,
  };

  // Page design settings
  let pageSettings = {
    title: 'Lookbook',
    titleTranslations: {} as Record<string, string>, // Translations for title: { en: "Lookbook", ru: "Лукбук", ... }
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

  onMount(async () => {
    await Promise.all([loadLookbooks(), loadLanguages()]);
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
  });

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll(true);
      languages = response.languages;
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadLookbooks() {
    loading = true;
    try {
      const response = await adminApi.getAllLookbooks();
      lookbooks = response.lookbooks.sort((a, b) => {
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
    } catch (e) {
      error = e instanceof Error ? e.message : t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

  function isArchived(lookbook: Lookbook): boolean {
    const currentYear = new Date().getFullYear();
    if (lookbook.year) {
      return lookbook.year < currentYear - 1;
    }
    const createdAt = new Date(lookbook.createdAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return createdAt < oneYearAgo;
  }

  function openForm(lookbook?: Lookbook) {
    if (lookbook) {
      editingLookbook = lookbook;
      formData = {
        title: lookbook.title,
        slug: lookbook.slug,
        description: lookbook.description || '',
        season: lookbook.season || '',
        year: lookbook.year || new Date().getFullYear(),
        isActive: lookbook.isActive,
        isArchived: isArchived(lookbook),
      };
    } else {
      editingLookbook = null;
      formData = {
        title: '',
        slug: '',
        description: '',
        season: '',
        year: new Date().getFullYear(),
        isActive: true,
        isArchived: false,
      };
    }
    showForm = true;
  }

  async function saveLookbook() {
    try {
      if (editingLookbook) {
        await adminApi.updateLookbook(editingLookbook.id, formData);
      } else {
        await adminApi.createLookbook(formData);
      }
      showForm = false;
      await loadLookbooks();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteLookbook(id: string) {
    const confirmed = await dialogStore.confirm(
      t('alert.deleteLookbook'),
      t('lookbook.deleteLookbook'),
      t('common.ok'),
      t('common.cancel')
    );

    if (!confirmed) {
      return;
    }

    try {
      await adminApi.deleteLookbook(id);
      await loadLookbooks();
    } catch (e) {
      notificationStore.error(t('error.failedToDelete'));
    }
  }

  function generateSlug() {
    if (!formData.slug && formData.title) {
      formData.slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  }

  function openTitleTranslationsEditor() {
    showTitleTranslations = true;
    editingTitleTranslation = null;
    selectedLanguageForTitleTranslation = '';
    titleTranslationFormData = { title: '' };
  }

  function closeTitleTranslationsEditor() {
    showTitleTranslations = false;
    editingTitleTranslation = null;
    selectedLanguageForTitleTranslation = '';
    titleTranslationFormData = { title: '' };
  }

  function editTitleTranslation(languageCode: string) {
    editingTitleTranslation = {
      languageCode,
      title: pageSettings.titleTranslations[languageCode] || '',
    };
    selectedLanguageForTitleTranslation = languageCode;
    titleTranslationFormData = {
      title: pageSettings.titleTranslations[languageCode] || '',
    };
  }

  function saveTitleTranslation() {
    if (!selectedLanguageForTitleTranslation) {
      notificationStore.error(t('language.language') + ' is required');
      return;
    }

    if (!titleTranslationFormData.title || titleTranslationFormData.title.trim() === '') {
      notificationStore.error(t('lookbook.pageTitle') + ' is required');
      return;
    }

    const newTranslations = { ...pageSettings.titleTranslations };
    newTranslations[selectedLanguageForTitleTranslation] = titleTranslationFormData.title.trim();
    pageSettings.titleTranslations = newTranslations;

    localStorage.setItem('lookbookPageSettings', JSON.stringify(pageSettings));

    editingTitleTranslation = null;
    selectedLanguageForTitleTranslation = '';
    titleTranslationFormData = { title: '' };

    notificationStore.success(t('lookbook.translationSaved'));
  }

  function deleteTitleTranslation(languageCode: string) {
    const newTranslations = { ...pageSettings.titleTranslations };
    delete newTranslations[languageCode];
    pageSettings.titleTranslations = newTranslations;

    localStorage.setItem('lookbookPageSettings', JSON.stringify(pageSettings));

    notificationStore.success(t('lookbook.translationDeleted'));
  }

  function savePageSettings() {
    localStorage.setItem('lookbookPageSettings', JSON.stringify(pageSettings));
    showPageSettings = false;
    notificationStore.success(t('lookbook.pageSettingsSaved'));
  }
</script>

<div>
  <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <h2 class="text-3xl font-bold">{t('lookbook.lookbooks')}</h2>
      <p class="text-sm text-accent-muted mt-1">
        {t('lookbook.manageLookbooks')}
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        on:click={() => (showArchive = !showArchive)}
        class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
      >
        {showArchive ? t('lookbook.current') : t('lookbook.archive')} ({showArchive
          ? archivedLookbooks.length
          : activeLookbooks.length})
      </button>
      <button
        on:click={() => (showPageSettings = !showPageSettings)}
        class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
      >
        {t('lookbook.pageSettings')}
      </button>
      <button
        on:click={() => openForm()}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('lookbook.addLookbook')}
      </button>
    </div>
  </div>

  {#if showPageSettings}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('lookbook.pageDesignSettings')}</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="pageTitle" class="block text-sm font-medium mb-2"
              >{t('lookbook.pageTitle')} (Default)</label
            >
            <input
              id="pageTitle"
              type="text"
              bind:value={pageSettings.title}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="Lookbook"
            />
            <p class="text-xs text-accent-muted mt-1">
              Default title (used if translation not available)
            </p>
          </div>
          <div>
            <p class="block text-sm font-medium mb-2">{t('lookbook.titleTranslations')}</p>
            <button
              type="button"
              on:click={openTitleTranslationsEditor}
              class="w-full px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              {t('lookbook.manageTranslations')}
            </button>
            <p class="text-xs text-accent-muted mt-1">
              {t('lookbook.addTranslationsForDifferentLanguages')}
            </p>
          </div>
          <div>
            <label for="pageTitleSize" class="block text-sm font-medium mb-2"
              >{t('lookbook.titleSize')}</label
            >
            <select
              id="pageTitleSize"
              bind:value={pageSettings.titleSize}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="text-3xl">{t('lookbook.small')}</option>
              <option value="text-4xl">{t('lookbook.medium')}</option>
              <option value="text-5xl">{t('lookbook.large')}</option>
              <option value="text-6xl">{t('lookbook.extraLarge')}</option>
              <option value="text-7xl">{t('lookbook.xxl')}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="pageBackgroundColorText" class="block text-sm font-medium mb-2"
              >{t('lookbook.backgroundColor')}</label
            >
            <div class="flex gap-2">
              <input
                aria-label={t('lookbook.backgroundColor')}
                type="color"
                bind:value={pageSettings.backgroundColor}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="pageBackgroundColorText"
                type="text"
                bind:value={pageSettings.backgroundColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div>
            <label for="pageTitleColorText" class="block text-sm font-medium mb-2"
              >{t('lookbook.titleColor')}</label
            >
            <div class="flex gap-2">
              <input
                aria-label={t('lookbook.titleColor')}
                type="color"
                bind:value={pageSettings.titleColor}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="pageTitleColorText"
                type="text"
                bind:value={pageSettings.titleColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="pageGridColumns" class="block text-sm font-medium mb-2"
              >{t('lookbook.gridColumns')}</label
            >
            <select
              id="pageGridColumns"
              bind:value={pageSettings.gridColumns}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="grid-cols-1">{t('lookbook.oneColumn')}</option>
              <option value="grid-cols-1 md:grid-cols-2">{t('lookbook.twoColumns')}</option>
              <option value="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                >{t('lookbook.threeColumns')}</option
              >
              <option value="grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                >{t('lookbook.fourColumns')}</option
              >
            </select>
          </div>
          <div>
            <label for="pageGap" class="block text-sm font-medium mb-2">{t('lookbook.gap')}</label>
            <select
              id="pageGap"
              bind:value={pageSettings.gap}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="gap-4">{t('lookbook.gapSmall')}</option>
              <option value="gap-6">{t('lookbook.gapMedium')}</option>
              <option value="gap-8">{t('lookbook.gapLarge')}</option>
              <option value="gap-12">{t('lookbook.gapExtraLarge')}</option>
            </select>
          </div>
          <div>
            <label for="pagePaddingTop" class="block text-sm font-medium mb-2"
              >{t('lookbook.paddingTop')}</label
            >
            <select
              id="pagePaddingTop"
              bind:value={pageSettings.paddingTop}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="py-10">{t('lookbook.paddingTopSmall')}</option>
              <option value="py-20">{t('lookbook.paddingTopMedium')}</option>
              <option value="py-32">{t('lookbook.paddingTopLarge')}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="cardBackgroundColorText" class="block text-sm font-medium mb-2"
              >{t('lookbook.cardBackgroundColor')}</label
            >
            <div class="flex gap-2">
              <input
                aria-label={t('lookbook.cardBackgroundColor')}
                type="color"
                bind:value={pageSettings.cardBackgroundColor}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="cardBackgroundColorText"
                type="text"
                bind:value={pageSettings.cardBackgroundColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="transparent"
              />
            </div>
          </div>
          <div>
            <label for="cardTextColorText" class="block text-sm font-medium mb-2"
              >{t('lookbook.cardTextColor')}</label
            >
            <div class="flex gap-2">
              <input
                aria-label={t('lookbook.cardTextColor')}
                type="color"
                bind:value={pageSettings.cardTextColor}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="cardTextColorText"
                type="text"
                bind:value={pageSettings.cardTextColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            bind:checked={pageSettings.cardHoverEffect}
            id="cardHoverEffect"
            class=""
          />
          <label for="cardHoverEffect" class="text-sm font-medium">
            {t('lookbook.enableCardHoverEffects')}
          </label>
        </div>

        <div class="flex gap-4 pt-4">
          <button
            on:click={savePageSettings}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('lookbook.savePageSettings')}
          </button>
          <button
            on:click={() => (showPageSettings = false)}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showTitleTranslations}
    <div class="bg-dark-light p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('lookbook.titleTranslations')}</h3>
        <button
          on:click={closeTitleTranslationsEditor}
          class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
        >
          {t('common.close')}
        </button>
      </div>

      <!-- Translation Form -->
      <div class="mb-6 p-4 bg-white border border-gray-300">
        <h4 class="text-lg font-medium mb-4">
          {editingTitleTranslation ? t('lookbook.editTranslation') : t('lookbook.addTranslation')}
        </h4>
        <div class="space-y-4">
          <div>
            <label for="titleTranslationLanguage" class="block text-sm font-medium mb-2"
              >{t('language.language')} *</label
            >
            <select
              id="titleTranslationLanguage"
              bind:value={selectedLanguageForTitleTranslation}
              disabled={!!editingTitleTranslation}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
            >
              <option value="">{t('common.select')} {t('language.language').toLowerCase()}</option>
              {#each languages as lang}
                {#if !pageSettings.titleTranslations[lang.code] || editingTitleTranslation?.languageCode === lang.code}
                  <option value={lang.code}>{lang.name} ({lang.code})</option>
                {/if}
              {/each}
            </select>
          </div>
          <div>
            <label for="titleTranslationValue" class="block text-sm font-medium mb-2"
              >{t('lookbook.pageTitle')}</label
            >
            <input
              id="titleTranslationValue"
              type="text"
              bind:value={titleTranslationFormData.title}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={pageSettings.title}
            />
          </div>
          <div class="flex gap-4">
            <button
              on:click={saveTitleTranslation}
              disabled={!selectedLanguageForTitleTranslation}
              class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
            >
              {t('common.save')}
            </button>
            {#if editingTitleTranslation}
              <button
                on:click={() => {
                  editingTitleTranslation = null;
                  selectedLanguageForTitleTranslation = '';
                  titleTranslationFormData = { title: '' };
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
        <h4 class="text-lg font-medium mb-4">{t('lookbook.existingTranslations')}</h4>
        {#if Object.keys(pageSettings.titleTranslations).length === 0}
          <p class="text-accent-muted">{t('lookbook.noTranslations')}</p>
        {:else}
          <div class="space-y-2">
            {#each Object.entries(pageSettings.titleTranslations) as [langCode, title]}
              <div class="flex items-center justify-between p-4 bg-white border border-gray-300">
                <div>
                  <p class="font-medium">
                    {languages.find((l) => l.code === langCode)?.name || langCode}
                  </p>
                  <p class="text-sm text-accent-muted">{t('lookbook.pageTitle')}: {title}</p>
                </div>
                <div class="flex gap-2">
                  <button
                    on:click={() => editTitleTranslation(langCode)}
                    class="px-3 py-1 bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-colors text-black"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    on:click={() => deleteTitleTranslation(langCode)}
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

  {#if showForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">
        {editingLookbook ? t('lookbook.editLookbook') : t('lookbook.addNewLookbook')}
      </h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="lookbookTitle" class="block text-sm font-medium mb-2"
              >{t('lookbook.titleRequired')}</label
            >
            <input
              id="lookbookTitle"
              type="text"
              bind:value={formData.title}
              on:input={generateSlug}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('lookbook.lookbookTitle')}
            />
          </div>
          <div>
            <label for="lookbookSlug" class="block text-sm font-medium mb-2"
              >{t('lookbook.slugAutoGenerated')}</label
            >
            <input
              id="lookbookSlug"
              type="text"
              bind:value={formData.slug}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('lookbook.lookbookSlug')}
            />
          </div>
        </div>

        <div>
          <label for="lookbookDescription" class="block text-sm font-medium mb-2"
            >{t('common.description')}</label
          >
          <textarea
            id="lookbookDescription"
            bind:value={formData.description}
            rows="3"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={t('lookbook.lookbookDescription')}
          ></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="lookbookSeason" class="block text-sm font-medium mb-2"
              >{t('lookbook.season')}</label
            >
            <LookbookSeasonSelect id="lookbookSeason" bind:value={formData.season} />
          </div>
          <div>
            <label for="lookbookYear" class="block text-sm font-medium mb-2"
              >{t('lookbook.year')}</label
            >
            <input
              id="lookbookYear"
              type="number"
              bind:value={formData.year}
              min="2000"
              max="2100"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.isActive} id="isActive" class="" />
            <label for="isActive" class="text-sm font-medium">
              {t('lookbook.activeVisible')}
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.isArchived} id="isArchived" class="" />
            <label for="isArchived" class="text-sm font-medium">
              {t('lookbook.archiveMove')}
            </label>
            <p class="text-xs text-accent-muted">
              {t('lookbook.autoArchived')}
            </p>
          </div>
        </div>

        <div class="flex gap-4 pt-4">
          <button
            on:click={saveLookbook}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {editingLookbook ? t('lookbook.update') : t('lookbook.create')}
            {t('lookbook.lookbook')}
          </button>
          <button
            on:click={() => (showForm = false)}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
          {#if editingLookbook}
            <button
              on:click={() => editingLookbook && goto(`/admin/lookbook/${editingLookbook.id}`)}
              class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
            >
              {t('lookbook.manageImages')}
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if displayedLookbooks.length === 0}
    <div class="bg-dark-light p-8 text-center">
      <p class="text-accent-muted mb-4">
        {showArchive ? t('lookbook.noArchivedLookbooks') : t('lookbook.noLookbooksFound')}
      </p>
      {#if !showArchive}
        <button
          on:click={() => openForm()}
          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
        >
          {t('lookbook.createFirstLookbook')}
        </button>
      {/if}
    </div>
  {:else}
    <div class="mb-4">
      <h3 class="text-xl font-medium">
        {showArchive ? t('lookbook.archivedLookbooks') : t('lookbook.currentLookbooks')}
      </h3>
      <p class="text-sm text-accent-muted">
        {t('lookbook.lookbooksCount').replace('{count}', displayedLookbooks.length.toString())}
      </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each displayedLookbooks as lookbook}
        <div
          class="bg-dark-light min-w-0 overflow-hidden p-6 flex flex-col {!lookbook.isActive
            ? 'opacity-60'
            : ''} {isArchived(lookbook) ? 'border-2 border-yellow-500/30' : ''}"
        >
          {#if lookbook.images && lookbook.images.length > 0}
            <div class="mb-4 flex-shrink-0">
              <img
                src={lookbook.images[0].url}
                alt={lookbook.title}
                class="w-full h-48 object-cover"
                on:error={(e) => {
                  const target = e.currentTarget;
                  if (target instanceof HTMLImageElement) {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
          {/if}
          <div class="mb-2 flex flex-shrink-0 items-start justify-between gap-3">
            <h3 class="min-w-0 break-words text-xl font-medium">{lookbook.title}</h3>
            {#if isArchived(lookbook)}
              <span class="ml-2 shrink-0 bg-yellow-500/20 px-2 py-1 text-xs text-yellow-600">
                {t('lookbook.archive')}
              </span>
            {/if}
          </div>
          {#if lookbook.season || lookbook.year}
            <p class="text-sm text-accent-muted mb-2 flex-shrink-0">
              {translateSeason(lookbook.season)}
              {lookbook.year}
            </p>
          {/if}
          {#if lookbook.description}
            <p class="text-sm text-accent-muted mb-4 line-clamp-2 flex-shrink-0">
              {lookbook.description}
            </p>
          {/if}
          <div class="flex items-center gap-2 mb-4 flex-shrink-0">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lookbook.isActive}
                on:change={async () => {
                  try {
                    await adminApi.updateLookbook(lookbook.id, { isActive: !lookbook.isActive });
                    await loadLookbooks();
                  } catch (e) {
                    notificationStore.error(t('lookbook.failedToUpdate'));
                  }
                }}
                class="w-4 h-4"
              />
              <span class="text-sm">{t('lookbook.isActive')}</span>
            </label>
            {#if !lookbook.isActive}
              <span class="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs">
                {t('lookbook.inactive')}
              </span>
            {/if}
          </div>
          <div class="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <button
              on:click={() => openForm(lookbook)}
              class="w-full px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black text-sm"
            >
              {t('common.edit')}
            </button>
            <button
              on:click={() => goto(`/admin/lookbook/${lookbook.id}`)}
              class="w-full px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black text-sm"
            >
              {t('lookbook.images')}
            </button>
            <button
              on:click={() => deleteLookbook(lookbook.id)}
              class="w-full px-4 py-2 bg-white border border-red-500/20 hover:bg-red-50 transition-colors text-red-400 text-sm"
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
