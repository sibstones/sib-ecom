<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { settingsStore } from '$lib/stores/settings.store';
  import { onboardingStore } from '$lib/stores/onboarding.store';
  import type { FeatureSettings } from '$lib/api/settings.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { settingsApi } from '$lib/api/settings.api';
  import { normalizeUploadFile } from '$lib/utils/file-upload';

  let faviconUploading = false;

  async function handleFaviconUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    faviconUploading = true;
    try {
      const { url } = await settingsApi.uploadSiteFavicon(normalizeUploadFile(file));
      settings.siteFaviconUrl = url;
      await settingsStore.updateSetting('siteFaviconUrl', url);
      notificationStore.success(t('settings.siteFaviconUploaded'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('error.failedToUpdate');
      notificationStore.error(msg);
    } finally {
      faviconUploading = false;
    }
  }

  async function clearSiteFavicon() {
    settings.siteFaviconUrl = '';
    await updateSetting('siteFaviconUrl', '');
  }

  let appleTouchUploading = false;

  async function handleAppleTouchUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    appleTouchUploading = true;
    try {
      const { url } = await settingsApi.uploadSiteAppleTouchIcon(normalizeUploadFile(file));
      settings.siteAppleTouchIconUrl = url;
      await settingsStore.updateSetting('siteAppleTouchIconUrl', url);
      notificationStore.success(t('settings.siteAppleTouchIconUploaded'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('error.failedToUpdate');
      notificationStore.error(msg);
    } finally {
      appleTouchUploading = false;
    }
  }

  async function clearSiteAppleTouchIcon() {
    settings.siteAppleTouchIconUrl = '';
    await updateSetting('siteAppleTouchIconUrl', '');
  }

  $: settings = $settingsStore;
  let loading = false;
  let saving = false;
  type SettingsTab = 'general' | 'design' | 'security' | 'marketing';
  let activeTab: SettingsTab = 'general';

  $: tabFromUrl = $page?.url?.searchParams?.get('tab');
  $: if (
    tabFromUrl === 'general' ||
    tabFromUrl === 'design' ||
    tabFromUrl === 'security' ||
    tabFromUrl === 'marketing'
  ) {
    activeTab = tabFromUrl;
  }

  function setTab(tab: SettingsTab) {
    activeTab = tab;
    goto(`/admin/settings?tab=${tab}`, { replaceState: true });
  }

  const SETTINGS_TABS: { id: SettingsTab; labelKey: string }[] = [
    { id: 'general', labelKey: 'settings.tabGeneral' },
    { id: 'design', labelKey: 'settings.tabDesign' },
    { id: 'security', labelKey: 'settings.tabSecurity' },
    { id: 'marketing', labelKey: 'settings.tabMarketing' },
  ];

  onMount(async () => {
    await settingsStore.load();
  });

  async function updateSetting(key: keyof FeatureSettings, value: boolean | string | number) {
    saving = true;
    try {
      await settingsStore.updateSetting(key, value);
    } catch (e) {
      notificationStore.error(t('error.failedToUpdate'));
    } finally {
      saving = false;
    }
  }

  function getChecked(e: Event): boolean {
    return (e.currentTarget as HTMLInputElement).checked;
  }

  async function saveAll() {
    saving = true;
    try {
      await settingsStore.updateMultiple(settings);
      notificationStore.success(t('settings.savedSuccessfully'));
    } catch (e) {
      notificationStore.error(t('error.failedToSave'));
    } finally {
      saving = false;
    }
  }

  async function runOnboardingAgain() {
    try {
      await onboardingStore.resetProgress();
      goto('/admin/onboarding');
    } catch (e) {
      notificationStore.error(t('error.failedToUpdate'));
    }
  }

  async function resetDefaults() {
    const confirmed = await dialogStore.confirm(t('settings.resetConfirm'), t('common.confirm'));
    if (!confirmed) return;

    saving = true;
    try {
      await settingsStore.reset();
      notificationStore.success(t('settings.resetSuccess'));
    } catch (e) {
      notificationStore.error(t('error.failedToReset'));
    } finally {
      saving = false;
    }
  }
</script>

<div>
  <div class="flex justify-end items-center mb-6">
    <div class="flex gap-4">
      <button
        on:click={saveAll}
        disabled={saving}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
      >
        {t('settings.saveAll')}
      </button>
      <button
        on:click={resetDefaults}
        disabled={saving}
        class="px-6 py-2 bg-white border border-red-500/20 text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {t('settings.resetToDefaults')}
      </button>
      <button
        type="button"
        on:click={runOnboardingAgain}
        class="px-6 py-2 text-sm text-accent hover:text-accent-muted transition-colors"
      >
        {t('onboarding.runAgain')}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <!-- Subtabs (secondary) -->
    <div
      class="flex gap-0.5 mb-6 p-1 bg-gray-50 rounded-md border border-gray-200 w-fit overflow-x-auto"
    >
      {#each SETTINGS_TABS as tab}
        <button
          type="button"
          on:click={() => setTab(tab.id)}
          class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
          class:bg-white={activeTab === tab.id}
          class:shadow-sm={activeTab === tab.id}
          class:text-accent={activeTab === tab.id}
          class:font-medium={activeTab === tab.id}
          class:text-gray-500={activeTab !== tab.id}
          class:hover:text-gray-700={activeTab !== tab.id}
        >
          {t(tab.labelKey)}
        </button>
      {/each}
    </div>

    <div class="space-y-6">
      {#if activeTab === 'general'}
        <!-- Reviews & Ratings -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.reviewsRatings')}</h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{t('settings.enableReviews')}</p>
              <p class="text-sm text-accent-muted">{t('settings.allowCustomersLeaveReviews')}</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reviewsEnabled}
                on:change={(e) => {
                  settings.reviewsEnabled = getChecked(e);
                  updateSetting('reviewsEnabled', getChecked(e));
                }}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
        </div>

        <!-- Brands -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.brands')}</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.enableBrands')}</p>
                <p class="text-sm text-accent-muted">{t('settings.showBrandInformation')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.brandsEnabled}
                  on:change={(e) => {
                    settings.brandsEnabled = getChecked(e);
                    updateSetting('brandsEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between pl-6">
              <div>
                <p class="font-medium">{t('settings.showBrandFilter')}</p>
                <p class="text-sm text-accent-muted">{t('settings.displayBrandFilterShop')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showBrandFilter}
                  disabled={!settings.brandsEnabled}
                  on:change={(e) => {
                    settings.showBrandFilter = getChecked(e);
                    updateSetting('showBrandFilter', getChecked(e));
                  }}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Filters & Search -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.filtersSearch')}</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.enableFilters')}</p>
                <p class="text-sm text-accent-muted">{t('settings.masterSwitchFilters')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.filtersEnabled}
                  on:change={(e) => {
                    settings.filtersEnabled = getChecked(e);
                    updateSetting('filtersEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between pl-6">
              <div>
                <p class="font-medium">{t('settings.categoryFilter')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.categoryFilterEnabled}
                  disabled={!settings.filtersEnabled}
                  on:change={(e) => {
                    settings.categoryFilterEnabled = getChecked(e);
                    updateSetting('categoryFilterEnabled', getChecked(e));
                  }}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between pl-6">
              <div>
                <p class="font-medium">{t('settings.priceFilter')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.priceFilterEnabled}
                  disabled={!settings.filtersEnabled}
                  on:change={(e) => {
                    settings.priceFilterEnabled = getChecked(e);
                    updateSetting('priceFilterEnabled', getChecked(e));
                  }}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between pl-6">
              <div>
                <p class="font-medium">{t('settings.brandFilter')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.brandFilterEnabled}
                  disabled={!settings.filtersEnabled || !settings.brandsEnabled}
                  on:change={(e) => {
                    settings.brandFilterEnabled = getChecked(e);
                    updateSetting('brandFilterEnabled', getChecked(e));
                  }}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.search')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.searchEnabled}
                  on:change={(e) => {
                    settings.searchEnabled = getChecked(e);
                    updateSetting('searchEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Other Features -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.otherFeatures')}</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.wishlist')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.wishlistEnabled}
                  on:change={(e) => {
                    settings.wishlistEnabled = getChecked(e);
                    updateSetting('wishlistEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.productComparison')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.compareEnabled}
                  on:change={(e) => {
                    settings.compareEnabled = getChecked(e);
                    updateSetting('compareEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.newsletter')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.newsletterEnabled}
                  on:change={(e) => {
                    settings.newsletterEnabled = getChecked(e);
                    updateSetting('newsletterEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.quickView')}</p>
                <p class="text-sm text-accent-muted">{t('settings.quickViewHint')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.quickViewEnabled}
                  on:change={(e) => {
                    settings.quickViewEnabled = getChecked(e);
                    updateSetting('quickViewEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.productRecommendations')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.productRecommendationsEnabled}
                  on:change={(e) => {
                    settings.productRecommendationsEnabled = getChecked(e);
                    updateSetting('productRecommendationsEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.lookbook')}</p>
                <p class="text-sm text-accent-muted">{t('settings.showLookbookLink')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.lookbookEnabled}
                  on:change={(e) => {
                    settings.lookbookEnabled = getChecked(e);
                    updateSetting('lookbookEnabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Image Blur Feature -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.imageBlur')}</h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{t('settings.enableImageBlur')}</p>
              <p class="text-sm text-accent-muted">{t('settings.blurImagesForUnauthenticated')}</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.imageBlurEnabled}
                on:change={(e) => {
                  settings.imageBlurEnabled = getChecked(e);
                  updateSetting('imageBlurEnabled', getChecked(e));
                }}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
        </div>
      {/if}

      {#if activeTab === 'design'}
        <!-- Site favicon -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-2">{t('settings.siteFavicon')}</h3>
          <p class="text-sm text-accent-muted mb-4">{t('settings.siteFaviconDescription')}</p>
          <div class="flex flex-wrap items-start gap-6">
            <div
              class="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-gray-200 bg-white overflow-hidden"
            >
              {#if settings.siteFaviconUrl}
                <img
                  src={settings.siteFaviconUrl}
                  alt=""
                  class="max-h-full max-w-full object-contain"
                />
              {:else}
                <span class="text-xs text-gray-400">favicon</span>
              {/if}
            </div>
            <div class="flex-1 min-w-[200px] space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1" for="site-favicon-url"
                  >{t('settings.siteFaviconUrl')}</label
                >
                <input
                  id="site-favicon-url"
                  type="url"
                  bind:value={settings.siteFaviconUrl}
                  on:change={() => updateSetting('siteFaviconUrl', settings.siteFaviconUrl)}
                  class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder={t('settings.siteFaviconUrlPlaceholder')}
                />
              </div>
              <div class="flex flex-wrap gap-3 items-center">
                <label
                  class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
                    class="sr-only"
                    disabled={faviconUploading}
                    on:change={handleFaviconUpload}
                  />
                  {faviconUploading ? t('common.loading') : t('settings.siteFaviconUpload')}
                </label>
                {#if settings.siteFaviconUrl}
                  <button
                    type="button"
                    class="text-sm text-red-600 hover:underline"
                    on:click={clearSiteFavicon}
                  >
                    {t('settings.siteFaviconClear')}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Apple touch icon -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-2">{t('settings.siteAppleTouchIcon')}</h3>
          <p class="text-sm text-accent-muted mb-4">
            {t('settings.siteAppleTouchIconDescription')}
          </p>
          <div class="flex flex-wrap items-start gap-6">
            <div
              class="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white overflow-hidden"
            >
              {#if settings.siteAppleTouchIconUrl}
                <img
                  src={settings.siteAppleTouchIconUrl}
                  alt=""
                  class="max-h-full max-w-full object-cover"
                />
              {:else}
                <span class="text-xs text-gray-400 px-1 text-center">180×180</span>
              {/if}
            </div>
            <div class="flex-1 min-w-[200px] space-y-3">
              <div>
                <label class="block text-sm font-medium mb-1" for="site-apple-touch-url"
                  >{t('settings.siteAppleTouchIconUrl')}</label
                >
                <input
                  id="site-apple-touch-url"
                  type="url"
                  bind:value={settings.siteAppleTouchIconUrl}
                  on:change={() =>
                    updateSetting('siteAppleTouchIconUrl', settings.siteAppleTouchIconUrl)}
                  class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder={t('settings.siteAppleTouchIconUrlPlaceholder')}
                />
              </div>
              <div class="flex flex-wrap gap-3 items-center">
                <label
                  class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="sr-only"
                    disabled={appleTouchUploading}
                    on:change={handleAppleTouchUpload}
                  />
                  {appleTouchUploading
                    ? t('common.loading')
                    : t('settings.siteAppleTouchIconUpload')}
                </label>
                {#if settings.siteAppleTouchIconUrl}
                  <button
                    type="button"
                    class="text-sm text-red-600 hover:underline"
                    on:click={clearSiteAppleTouchIcon}
                  >
                    {t('settings.siteAppleTouchIconClear')}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Typography Settings -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.typographySettings')}</h3>
          <div class="space-y-6">
            <!-- Font Family -->
            <div>
              <label for="fontFamilySelect" class="block text-sm font-medium mb-2"
                >{t('settings.fontFamily')}</label
              >
              <select
                id="fontFamilySelect"
                bind:value={settings.fontFamily}
                on:change={() => updateSetting('fontFamily', settings.fontFamily)}
                class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="Inter">Inter</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Arial">Arial</option>
                <option value="Copperplate">Copperplate</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Lato">Lato</option>
                <option value="Poppins">Poppins</option>
                <option value="Raleway">Raleway</option>
                <option value="Playfair Display">Playfair Display</option>
              </select>
              <p class="text-sm text-accent-muted mt-1">{t('settings.selectMainFontFamily')}</p>
            </div>

            <!-- Text Transform -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.uppercaseAllText')}</p>
                <p class="text-sm text-accent-muted">{t('settings.transformAllTextUppercase')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.textTransformUppercase}
                  on:change={(e) => {
                    settings.textTransformUppercase = getChecked(e);
                    updateSetting('textTransformUppercase', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>

            <!-- Font Sizes -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="fontSizeH1" class="block text-sm font-medium mb-2"
                  >{t('settings.h1Size')}</label
                >
                <select
                  id="fontSizeH1"
                  bind:value={settings.fontSizeH1}
                  on:change={() => updateSetting('fontSizeH1', settings.fontSizeH1)}
                  class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="4rem">4rem (64px)</option>
                  <option value="3.5rem">3.5rem (56px)</option>
                  <option value="3rem">3rem (48px)</option>
                  <option value="2.75rem">2.75rem (44px)</option>
                  <option value="2.5rem">2.5rem (40px)</option>
                </select>
              </div>

              <div>
                <label for="fontSizeH2" class="block text-sm font-medium mb-2"
                  >{t('settings.h2Size')}</label
                >
                <select
                  id="fontSizeH2"
                  bind:value={settings.fontSizeH2}
                  on:change={() => updateSetting('fontSizeH2', settings.fontSizeH2)}
                  class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="3rem">3rem (48px)</option>
                  <option value="2.5rem">2.5rem (40px)</option>
                  <option value="2.25rem">2.25rem (36px)</option>
                  <option value="2rem">2rem (32px)</option>
                  <option value="1.875rem">1.875rem (30px)</option>
                </select>
              </div>

              <div>
                <label for="fontSizeH3" class="block text-sm font-medium mb-2"
                  >{t('settings.h3Size')}</label
                >
                <select
                  id="fontSizeH3"
                  bind:value={settings.fontSizeH3}
                  on:change={() => updateSetting('fontSizeH3', settings.fontSizeH3)}
                  class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="2rem">2rem (32px)</option>
                  <option value="1.875rem">1.875rem (30px)</option>
                  <option value="1.75rem">1.75rem (28px)</option>
                  <option value="1.5rem">1.5rem (24px)</option>
                  <option value="1.25rem">1.25rem (20px)</option>
                </select>
              </div>

              <div>
                <label for="fontSizeH4" class="block text-sm font-medium mb-2"
                  >{t('settings.h4Size')}</label
                >
                <select
                  id="fontSizeH4"
                  bind:value={settings.fontSizeH4}
                  on:change={() => updateSetting('fontSizeH4', settings.fontSizeH4)}
                  class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="1.5rem">1.5rem (24px)</option>
                  <option value="1.25rem">1.25rem (20px)</option>
                  <option value="1.125rem">1.125rem (18px)</option>
                  <option value="1rem">1rem (16px)</option>
                  <option value="0.875rem">0.875rem (14px)</option>
                </select>
              </div>

              <div>
                <label for="fontSizeBody" class="block text-sm font-medium mb-2"
                  >{t('settings.bodySize')}</label
                >
                <select
                  id="fontSizeBody"
                  bind:value={settings.fontSizeBody}
                  on:change={() => updateSetting('fontSizeBody', settings.fontSizeBody)}
                  class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="1.125rem">1.125rem (18px)</option>
                  <option value="1rem">1rem (16px)</option>
                  <option value="0.9375rem">0.9375rem (15px)</option>
                  <option value="0.875rem">0.875rem (14px)</option>
                  <option value="0.8125rem">0.8125rem (13px)</option>
                </select>
              </div>

              <div>
                <label for="fontSizeSmall" class="block text-sm font-medium mb-2"
                  >{t('settings.smallSize')}</label
                >
                <select
                  id="fontSizeSmall"
                  bind:value={settings.fontSizeSmall}
                  on:change={() => updateSetting('fontSizeSmall', settings.fontSizeSmall)}
                  class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="0.875rem">0.875rem (14px)</option>
                  <option value="0.8125rem">0.8125rem (13px)</option>
                  <option value="0.75rem">0.75rem (12px)</option>
                  <option value="0.6875rem">0.6875rem (11px)</option>
                  <option value="0.625rem">0.625rem (10px)</option>
                </select>
              </div>

              <div>
                <label for="fontSizeButton" class="block text-sm font-medium mb-2"
                  >{t('settings.buttonSize')}</label
                >
                <select
                  id="fontSizeButton"
                  bind:value={settings.fontSizeButton}
                  on:change={() => updateSetting('fontSizeButton', settings.fontSizeButton)}
                  class="wrounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="1.125rem">1.125rem (18px)</option>
                  <option value="1rem">1rem (16px)</option>
                  <option value="0.9375rem">0.9375rem (15px)</option>
                  <option value="0.875rem">0.875rem (14px)</option>
                  <option value="0.8125rem">0.8125rem (13px)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Border Radius Settings -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">
            {t('settings.borderRadiusSettings') || 'Border Radius Settings'}
          </h3>
          <div class="space-y-6">
            <p class="text-sm text-accent-muted mb-4">
              {t('settings.configureBorderRadius') ||
                'Configure global border radius for cards and buttons'}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Card Border Radius -->
              <div>
                <label for="borderRadiusCard" class="block text-sm font-medium mb-2"
                  >{t('settings.cardBorderRadius') || 'Card Border Radius'}</label
                >
                <select
                  id="borderRadiusCard"
                  bind:value={settings.borderRadiusCard}
                  on:change={() => updateSetting('borderRadiusCard', settings.borderRadiusCard)}
                  class="w-full rounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="0">0 (Square)</option>
                  <option value="0.25rem">0.25rem (4px)</option>
                  <option value="0.5rem">0.5rem (8px)</option>
                  <option value="0.75rem">0.75rem (12px)</option>
                  <option value="1rem">1rem (16px)</option>
                  <option value="1.5rem">1.5rem (24px)</option>
                  <option value="2rem">2rem (32px)</option>
                </select>
                <p class="text-sm text-accent-muted mt-1">
                  {t('settings.selectCardBorderRadius') || 'Select border radius for all cards'}
                </p>
              </div>

              <!-- Button Border Radius -->
              <div>
                <label for="borderRadiusButton" class="block text-sm font-medium mb-2"
                  >{t('settings.buttonBorderRadius') || 'Button Border Radius'}</label
                >
                <select
                  id="borderRadiusButton"
                  bind:value={settings.borderRadiusButton}
                  on:change={() => updateSetting('borderRadiusButton', settings.borderRadiusButton)}
                  class="w-full rounded px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="0">0 (Square)</option>
                  <option value="0.25rem">0.25rem (4px)</option>
                  <option value="0.5rem">0.5rem (8px)</option>
                  <option value="0.75rem">0.75rem (12px)</option>
                  <option value="1rem">1rem (16px)</option>
                  <option value="1.5rem">1.5rem (24px)</option>
                  <option value="9999px">9999px (Fully Rounded)</option>
                </select>
                <p class="text-sm text-accent-muted mt-1">
                  {t('settings.selectButtonBorderRadius') || 'Select border radius for all buttons'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Color Settings -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.colorSettings')}</h3>
          <div class="space-y-6">
            <p class="text-sm text-accent-muted mb-4">{t('settings.configureMainColorPalette')}</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- White -->
              <div>
                <label for="colorWhiteText" class="block text-sm font-medium mb-2"
                  >{t('settings.white')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.white')}
                    type="color"
                    bind:value={settings.colorWhite}
                    on:change={() => updateSetting('colorWhite', settings.colorWhite)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorWhiteText"
                    type="text"
                    bind:value={settings.colorWhite}
                    on:change={() => updateSetting('colorWhite', settings.colorWhite)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              <!-- Black -->
              <div>
                <label for="colorBlackText" class="block text-sm font-medium mb-2"
                  >{t('settings.black')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.black')}
                    type="color"
                    bind:value={settings.colorBlack}
                    on:change={() => updateSetting('colorBlack', settings.colorBlack)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorBlackText"
                    type="text"
                    bind:value={settings.colorBlack}
                    on:change={() => updateSetting('colorBlack', settings.colorBlack)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#000000"
                  />
                </div>
              </div>

              <!-- Dark -->
              <div>
                <label for="colorDarkText" class="block text-sm font-medium mb-2"
                  >{t('settings.dark')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.dark')}
                    type="color"
                    bind:value={settings.colorDark}
                    on:change={() => updateSetting('colorDark', settings.colorDark)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorDarkText"
                    type="text"
                    bind:value={settings.colorDark}
                    on:change={() => updateSetting('colorDark', settings.colorDark)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#e8e5e5"
                  />
                </div>
              </div>

              <!-- Dark Light -->
              <div>
                <label for="colorDarkLightText" class="block text-sm font-medium mb-2"
                  >{t('settings.darkLight')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.darkLight')}
                    type="color"
                    bind:value={settings.colorDarkLight}
                    on:change={() => updateSetting('colorDarkLight', settings.colorDarkLight)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorDarkLightText"
                    type="text"
                    bind:value={settings.colorDarkLight}
                    on:change={() => updateSetting('colorDarkLight', settings.colorDarkLight)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#f5f5f5"
                  />
                </div>
              </div>

              <!-- Dark Lighter -->
              <div>
                <label for="colorDarkLighterText" class="block text-sm font-medium mb-2"
                  >{t('settings.darkLighter')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.darkLighter')}
                    type="color"
                    bind:value={settings.colorDarkLighter}
                    on:change={() => updateSetting('colorDarkLighter', settings.colorDarkLighter)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorDarkLighterText"
                    type="text"
                    bind:value={settings.colorDarkLighter}
                    on:change={() => updateSetting('colorDarkLighter', settings.colorDarkLighter)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#e5e5e5"
                  />
                </div>
              </div>

              <!-- Accent -->
              <div>
                <label for="colorAccentText" class="block text-sm font-medium mb-2"
                  >{t('settings.accent')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.accent')}
                    type="color"
                    bind:value={settings.colorAccent}
                    on:change={() => updateSetting('colorAccent', settings.colorAccent)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorAccentText"
                    type="text"
                    bind:value={settings.colorAccent}
                    on:change={() => updateSetting('colorAccent', settings.colorAccent)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#1c1b1b"
                  />
                </div>
              </div>

              <!-- Accent Muted -->
              <div>
                <label for="colorAccentMutedText" class="block text-sm font-medium mb-2"
                  >{t('settings.accentMuted')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.accentMuted')}
                    type="color"
                    bind:value={settings.colorAccentMuted}
                    on:change={() => updateSetting('colorAccentMuted', settings.colorAccentMuted)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorAccentMutedText"
                    type="text"
                    bind:value={settings.colorAccentMuted}
                    on:change={() => updateSetting('colorAccentMuted', settings.colorAccentMuted)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#666666"
                  />
                </div>
              </div>

              <!-- Accent Light -->
              <div>
                <label for="colorAccentLightText" class="block text-sm font-medium mb-2"
                  >{t('settings.accentLight')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.accentLight')}
                    type="color"
                    bind:value={settings.colorAccentLight}
                    on:change={() => updateSetting('colorAccentLight', settings.colorAccentLight)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorAccentLightText"
                    type="text"
                    bind:value={settings.colorAccentLight}
                    on:change={() => updateSetting('colorAccentLight', settings.colorAccentLight)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#ded9d9"
                  />
                </div>
              </div>

              <!-- Background -->
              <div>
                <label for="colorBackgroundText" class="block text-sm font-medium mb-2"
                  >{t('settings.background')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.background')}
                    type="color"
                    bind:value={settings.colorBackground}
                    on:change={() => updateSetting('colorBackground', settings.colorBackground)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorBackgroundText"
                    type="text"
                    bind:value={settings.colorBackground}
                    on:change={() => updateSetting('colorBackground', settings.colorBackground)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              <!-- Background Secondary -->
              <div>
                <label for="colorBackgroundSecondaryText" class="block text-sm font-medium mb-2"
                  >{t('settings.backgroundSecondary')}</label
                >
                <div class="flex gap-2">
                  <input
                    aria-label={t('settings.backgroundSecondary')}
                    type="color"
                    bind:value={settings.colorBackgroundSecondary}
                    on:change={() =>
                      updateSetting('colorBackgroundSecondary', settings.colorBackgroundSecondary)}
                    class="w-16 h-10 border border-gray-300 cursor-pointer"
                  />
                  <input
                    id="colorBackgroundSecondaryText"
                    type="text"
                    bind:value={settings.colorBackgroundSecondary}
                    on:change={() =>
                      updateSetting('colorBackgroundSecondary', settings.colorBackgroundSecondary)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="#f9f9f9"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === 'security'}
        <!-- Delivery Tracking Settings -->
        <div class="bg-dark-light p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-medium">{t('settings.deliveryTracking')}</h3>
            {#if settings.deliveryTrackingEnabled}
              <a
                href="/admin/settings/delivery-tracking"
                class="text-sm text-accent hover:text-accent-muted transition-colors"
              >
                {t('settings.configureDeliveryTracking')} →
              </a>
            {/if}
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{t('settings.enableDeliveryTracking')}</p>
              <p class="text-sm text-accent-muted">
                {t('settings.enableDeliveryTrackingDescription')}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.deliveryTrackingEnabled}
                on:change={(e) => {
                  settings.deliveryTrackingEnabled = getChecked(e);
                  updateSetting('deliveryTrackingEnabled', getChecked(e));
                }}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
          {#if settings.deliveryTrackingEnabled}
            <div class="mt-4 pt-4 border-t border-white/10">
              <p class="text-sm text-accent-muted">
                {t('settings.deliveryTrackingConfigured')}:
                <strong>{settings.deliveryTrackingProvider}</strong>
              </p>
              <a
                href="/admin/settings/delivery-tracking"
                class="text-sm text-accent hover:text-accent-muted transition-colors mt-2 inline-block"
              >
                {t('settings.configureDeliveryTracking')} →
              </a>
            </div>
          {/if}
        </div>

        <!-- Authentication & Registration Settings -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.authRegistration')}</h3>
          <p class="text-sm text-accent-muted mb-6">{t('settings.securityNote')}</p>

          <div class="space-y-6">
            <!-- Enable/Disable Registration & Login -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">{t('settings.enableRegistration')}</p>
                  <p class="text-sm text-accent-muted">
                    {t('settings.enableRegistrationDescription')}
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.registrationEnabled}
                    on:change={(e) => {
                      settings.registrationEnabled = getChecked(e);
                      updateSetting('registrationEnabled', getChecked(e));
                    }}
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                  ></div>
                </label>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">{t('settings.enableLogin')}</p>
                  <p class="text-sm text-accent-muted">{t('settings.enableLoginDescription')}</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.loginEnabled}
                    on:change={(e) => {
                      settings.loginEnabled = getChecked(e);
                      updateSetting('loginEnabled', getChecked(e));
                    }}
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                  ></div>
                </label>
              </div>
            </div>

            <!-- Password Requirements -->
            <div class="pt-4 border-t border-white/10">
              <h4 class="text-lg font-medium mb-4">{t('settings.passwordRequirements')}</h4>
              <div class="space-y-4">
                <div>
                  <label for="passwordMinLength" class="block text-sm font-medium mb-2"
                    >{t('settings.passwordMinLength')}</label
                  >
                  <input
                    id="passwordMinLength"
                    type="number"
                    min="4"
                    max="128"
                    bind:value={settings.passwordMinLength}
                    on:change={() => updateSetting('passwordMinLength', settings.passwordMinLength)}
                    class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p class="text-sm text-accent-muted mt-1">
                    {t('settings.passwordMinLengthDescription')}
                  </p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">{t('settings.passwordRequireUppercase')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.passwordRequireUppercaseDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.passwordRequireUppercase}
                        on:change={(e) => {
                          settings.passwordRequireUppercase = getChecked(e);
                          updateSetting('passwordRequireUppercase', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">{t('settings.passwordRequireLowercase')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.passwordRequireLowercaseDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.passwordRequireLowercase}
                        on:change={(e) => {
                          settings.passwordRequireLowercase = getChecked(e);
                          updateSetting('passwordRequireLowercase', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">{t('settings.passwordRequireNumbers')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.passwordRequireNumbersDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.passwordRequireNumbers}
                        on:change={(e) => {
                          settings.passwordRequireNumbers = getChecked(e);
                          updateSetting('passwordRequireNumbers', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">{t('settings.passwordRequireSpecialChars')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.passwordRequireSpecialCharsDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.passwordRequireSpecialChars}
                        on:change={(e) => {
                          settings.passwordRequireSpecialChars = getChecked(e);
                          updateSetting('passwordRequireSpecialChars', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Rate Limiting -->
            <div class="pt-4 border-t border-white/10">
              <h4 class="text-lg font-medium mb-4">{t('settings.rateLimiting')}</h4>
              <div class="space-y-6">
                <!-- Login Rate Limit -->
                <div>
                  <h5 class="font-medium mb-3">{t('settings.loginRateLimit')}</h5>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                    <div>
                      <label for="loginRateLimitMaxAttempts" class="block text-sm font-medium mb-2"
                        >{t('settings.loginRateLimitMaxAttempts')}</label
                      >
                      <input
                        id="loginRateLimitMaxAttempts"
                        type="number"
                        min="1"
                        max="20"
                        bind:value={settings.loginRateLimitMaxAttempts}
                        on:change={() =>
                          updateSetting(
                            'loginRateLimitMaxAttempts',
                            settings.loginRateLimitMaxAttempts
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.loginRateLimitMaxAttemptsDescription')}
                      </p>
                    </div>
                    <div>
                      <label
                        for="loginRateLimitWindowMinutes"
                        class="block text-sm font-medium mb-2"
                        >{t('settings.loginRateLimitWindowMinutes')}</label
                      >
                      <input
                        id="loginRateLimitWindowMinutes"
                        type="number"
                        min="1"
                        max="1440"
                        bind:value={settings.loginRateLimitWindowMinutes}
                        on:change={() =>
                          updateSetting(
                            'loginRateLimitWindowMinutes',
                            settings.loginRateLimitWindowMinutes
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.loginRateLimitWindowMinutesDescription')}
                      </p>
                    </div>
                  </div>
                </div>
                <!-- Registration Rate Limit -->
                <div>
                  <h5 class="font-medium mb-3">{t('settings.registrationRateLimit')}</h5>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                    <div>
                      <label
                        for="registrationRateLimitMaxAttempts"
                        class="block text-sm font-medium mb-2"
                        >{t('settings.registrationRateLimitMaxAttempts')}</label
                      >
                      <input
                        id="registrationRateLimitMaxAttempts"
                        type="number"
                        min="1"
                        max="20"
                        bind:value={settings.registrationRateLimitMaxAttempts}
                        on:change={() =>
                          updateSetting(
                            'registrationRateLimitMaxAttempts',
                            settings.registrationRateLimitMaxAttempts
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.registrationRateLimitMaxAttemptsDescription')}
                      </p>
                    </div>
                    <div>
                      <label
                        for="registrationRateLimitWindowMinutes"
                        class="block text-sm font-medium mb-2"
                        >{t('settings.registrationRateLimitWindowMinutes')}</label
                      >
                      <input
                        id="registrationRateLimitWindowMinutes"
                        type="number"
                        min="1"
                        max="1440"
                        bind:value={settings.registrationRateLimitWindowMinutes}
                        on:change={() =>
                          updateSetting(
                            'registrationRateLimitWindowMinutes',
                            settings.registrationRateLimitWindowMinutes
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.registrationRateLimitWindowMinutesDescription')}
                      </p>
                    </div>
                  </div>
                </div>
                <!-- Cart reservation (Awaiting Payment) -->
                <div>
                  <h5 class="font-medium mb-3">{t('settings.cartReservation')}</h5>
                  <p class="text-sm text-accent-muted mb-3">
                    {t('settings.cartReservationDescription')}
                  </p>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4">
                    <div>
                      <label
                        for="cartReservationGuestMinutes"
                        class="block text-sm font-medium mb-2"
                        >{t('settings.cartReservationGuestMinutes')}</label
                      >
                      <input
                        id="cartReservationGuestMinutes"
                        type="number"
                        min="5"
                        max="1440"
                        bind:value={settings.cartReservationGuestMinutes}
                        on:change={() =>
                          updateSetting(
                            'cartReservationGuestMinutes',
                            settings.cartReservationGuestMinutes
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.cartReservationGuestMinutesDescription')}
                      </p>
                    </div>
                    <div>
                      <label
                        for="cartReservationRegisteredHours"
                        class="block text-sm font-medium mb-2"
                        >{t('settings.cartReservationRegisteredHours')}</label
                      >
                      <input
                        id="cartReservationRegisteredHours"
                        type="number"
                        min="1"
                        max="168"
                        bind:value={settings.cartReservationRegisteredHours}
                        on:change={() =>
                          updateSetting(
                            'cartReservationRegisteredHours',
                            settings.cartReservationRegisteredHours
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.cartReservationRegisteredHoursDescription')}
                      </p>
                    </div>
                    <div>
                      <label for="cartMaxQuantityPerProduct" class="block text-sm font-medium mb-2"
                        >{t('settings.cartMaxQuantityPerProduct')}</label
                      >
                      <input
                        id="cartMaxQuantityPerProduct"
                        type="number"
                        min="1"
                        max="99"
                        bind:value={settings.cartMaxQuantityPerProduct}
                        on:change={() =>
                          updateSetting(
                            'cartMaxQuantityPerProduct',
                            settings.cartMaxQuantityPerProduct
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.cartMaxQuantityPerProductDescription')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Account Lockout -->
            <div class="pt-4 border-t border-white/10">
              <h4 class="text-lg font-medium mb-4">{t('settings.accountLockout')}</h4>
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium">{t('settings.accountLockoutEnabled')}</p>
                    <p class="text-sm text-accent-muted">
                      {t('settings.accountLockoutEnabledDescription')}
                    </p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.accountLockoutEnabled}
                      on:change={(e) => {
                        settings.accountLockoutEnabled = getChecked(e);
                        updateSetting('accountLockoutEnabled', getChecked(e));
                      }}
                      class="sr-only peer"
                    />
                    <div
                      class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                    ></div>
                  </label>
                </div>
                {#if settings.accountLockoutEnabled}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                    <div>
                      <label for="accountLockoutAttempts" class="block text-sm font-medium mb-2"
                        >{t('settings.accountLockoutAttempts')}</label
                      >
                      <input
                        id="accountLockoutAttempts"
                        type="number"
                        min="1"
                        max="20"
                        bind:value={settings.accountLockoutAttempts}
                        on:change={() =>
                          updateSetting('accountLockoutAttempts', settings.accountLockoutAttempts)}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.accountLockoutAttemptsDescription')}
                      </p>
                    </div>
                    <div>
                      <label
                        for="accountLockoutDurationMinutes"
                        class="block text-sm font-medium mb-2"
                        >{t('settings.accountLockoutDurationMinutes')}</label
                      >
                      <input
                        id="accountLockoutDurationMinutes"
                        type="number"
                        min="1"
                        max="1440"
                        bind:value={settings.accountLockoutDurationMinutes}
                        on:change={() =>
                          updateSetting(
                            'accountLockoutDurationMinutes',
                            settings.accountLockoutDurationMinutes
                          )}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.accountLockoutDurationMinutesDescription')}
                      </p>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Email Verification (Future Feature) -->
            <div class="pt-4 border-t border-white/10">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">{t('settings.emailVerificationRequired')}</p>
                  <p class="text-sm text-accent-muted">
                    {t('settings.emailVerificationRequiredDescription')}
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked={settings.emailVerificationRequired}
                    disabled
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                  ></div>
                </label>
              </div>
            </div>

            <!-- CAPTCHA Settings -->
            <div class="pt-4 border-t border-white/10">
              <h4 class="text-lg font-medium mb-4">{t('settings.captcha')}</h4>
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium">{t('settings.captchaEnabled')}</p>
                    <p class="text-sm text-accent-muted">
                      {t('settings.captchaEnabledDescription')}
                    </p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.captchaEnabled}
                      on:change={(e) => {
                        settings.captchaEnabled = getChecked(e);
                        updateSetting('captchaEnabled', getChecked(e));
                      }}
                      class="sr-only peer"
                    />
                    <div
                      class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                    ></div>
                  </label>
                </div>
                {#if settings.captchaEnabled}
                  <div class="space-y-4 pl-4">
                    <div>
                      <label for="captchaProvider" class="block text-sm font-medium mb-2"
                        >{t('settings.captchaProvider')}</label
                      >
                      <select
                        id="captchaProvider"
                        bind:value={settings.captchaProvider}
                        on:change={() => updateSetting('captchaProvider', settings.captchaProvider)}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="GOOGLE_RECAPTCHA_V2"
                          >{t('settings.captchaProviderGoogleV2')}</option
                        >
                        <option value="GOOGLE_RECAPTCHA_V3"
                          >{t('settings.captchaProviderGoogleV3')}</option
                        >
                        <option value="HCAPTCHA">{t('settings.captchaProviderHCaptcha')}</option>
                        <option value="CLOUDFLARE_TURNSTILE"
                          >{t('settings.captchaProviderTurnstile')}</option
                        >
                      </select>
                    </div>
                    <div>
                      <label for="captchaSiteKey" class="block text-sm font-medium mb-2"
                        >{t('settings.captchaSiteKey')}</label
                      >
                      <input
                        id="captchaSiteKey"
                        type="text"
                        bind:value={settings.captchaSiteKey}
                        on:change={() => updateSetting('captchaSiteKey', settings.captchaSiteKey)}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.captchaSiteKeyDescription')}
                      </p>
                    </div>
                    <div>
                      <label for="captchaSecretKey" class="block text-sm font-medium mb-2"
                        >{t('settings.captchaSecretKey')}</label
                      >
                      <input
                        id="captchaSecretKey"
                        type="password"
                        bind:value={settings.captchaSecretKey}
                        on:change={() =>
                          updateSetting('captchaSecretKey', settings.captchaSecretKey)}
                        class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"
                      />
                      <p class="text-sm text-accent-muted mt-1">
                        {t('settings.captchaSecretKeyDescription')}
                      </p>
                    </div>
                    {#if settings.captchaProvider === 'GOOGLE_RECAPTCHA_V3'}
                      <div>
                        <label for="captchaThreshold" class="block text-sm font-medium mb-2"
                          >{t('settings.captchaThreshold')}</label
                        >
                        <input
                          id="captchaThreshold"
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          bind:value={settings.captchaThreshold}
                          on:change={() =>
                            updateSetting('captchaThreshold', settings.captchaThreshold)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <p class="text-sm text-accent-muted mt-1">
                          {t('settings.captchaThresholdDescription')}
                        </p>
                      </div>
                    {/if}
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="font-medium">{t('settings.captchaRequiredForRegistration')}</p>
                        <p class="text-sm text-accent-muted">
                          {t('settings.captchaRequiredForRegistrationDescription')}
                        </p>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.captchaRequiredForRegistration}
                          on:change={(e) => {
                            settings.captchaRequiredForRegistration = getChecked(e);
                            updateSetting('captchaRequiredForRegistration', getChecked(e));
                          }}
                          class="sr-only peer"
                        />
                        <div
                          class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                        ></div>
                      </label>
                    </div>
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="font-medium">{t('settings.captchaRequiredForLogin')}</p>
                        <p class="text-sm text-accent-muted">
                          {t('settings.captchaRequiredForLoginDescription')}
                        </p>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.captchaRequiredForLogin}
                          on:change={(e) => {
                            settings.captchaRequiredForLogin = getChecked(e);
                            updateSetting('captchaRequiredForLogin', getChecked(e));
                          }}
                          class="sr-only peer"
                        />
                        <div
                          class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                        ></div>
                      </label>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- OAuth Providers Settings -->
            <div class="pt-4 border-t border-white/10">
              <h4 class="text-lg font-medium mb-4">{t('settings.oauthProviders')}</h4>
              <p class="text-sm text-accent-muted mb-4">
                {t('settings.oauthProvidersDescription')}
              </p>

              <div class="space-y-6">
                <!-- Google OAuth -->
                <div class="bg-dark-light p-4 rounded">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="font-medium">{t('settings.oauthGoogle')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.oauthGoogleDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.oauthGoogleEnabled}
                        on:change={(e) => {
                          settings.oauthGoogleEnabled = getChecked(e);
                          updateSetting('oauthGoogleEnabled', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  {#if settings.oauthGoogleEnabled}
                    <div class="space-y-3 pl-4">
                      <div>
                        <label for="oauthGoogleClientId" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientId')}</label
                        >
                        <input
                          id="oauthGoogleClientId"
                          type="text"
                          bind:value={settings.oauthGoogleClientId}
                          on:change={() =>
                            updateSetting('oauthGoogleClientId', settings.oauthGoogleClientId)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="123456789-abcdefghijklmnop.apps.googleusercontent.com"
                        />
                      </div>
                      <div>
                        <label for="oauthGoogleClientSecret" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientSecret')}</label
                        >
                        <input
                          id="oauthGoogleClientSecret"
                          type="password"
                          bind:value={settings.oauthGoogleClientSecret}
                          on:change={() =>
                            updateSetting(
                              'oauthGoogleClientSecret',
                              settings.oauthGoogleClientSecret
                            )}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="GOCSPX-..."
                        />
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Yandex OAuth -->
                <div class="bg-dark-light p-4 rounded">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="font-medium">{t('settings.oauthYandex')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.oauthYandexDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.oauthYandexEnabled}
                        on:change={(e) => {
                          settings.oauthYandexEnabled = getChecked(e);
                          updateSetting('oauthYandexEnabled', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  {#if settings.oauthYandexEnabled}
                    <div class="space-y-3 pl-4">
                      <div>
                        <label for="oauthYandexClientId" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientId')}</label
                        >
                        <input
                          id="oauthYandexClientId"
                          type="text"
                          bind:value={settings.oauthYandexClientId}
                          on:change={() =>
                            updateSetting('oauthYandexClientId', settings.oauthYandexClientId)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="1234567890abcdef"
                        />
                      </div>
                      <div>
                        <label for="oauthYandexClientSecret" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientSecret')}</label
                        >
                        <input
                          id="oauthYandexClientSecret"
                          type="password"
                          bind:value={settings.oauthYandexClientSecret}
                          on:change={() =>
                            updateSetting(
                              'oauthYandexClientSecret',
                              settings.oauthYandexClientSecret
                            )}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="..."
                        />
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- VKontakte OAuth -->
                <div class="bg-dark-light p-4 rounded">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="font-medium">{t('settings.oauthVkontakte')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.oauthVkontakteDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.oauthVkontakteEnabled}
                        on:change={(e) => {
                          settings.oauthVkontakteEnabled = getChecked(e);
                          updateSetting('oauthVkontakteEnabled', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  {#if settings.oauthVkontakteEnabled}
                    <div class="space-y-3 pl-4">
                      <div>
                        <label for="oauthVkontakteClientId" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientId')}</label
                        >
                        <input
                          id="oauthVkontakteClientId"
                          type="text"
                          bind:value={settings.oauthVkontakteClientId}
                          on:change={() =>
                            updateSetting(
                              'oauthVkontakteClientId',
                              settings.oauthVkontakteClientId
                            )}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="12345678"
                        />
                      </div>
                      <div>
                        <label
                          for="oauthVkontakteClientSecret"
                          class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientSecret')}</label
                        >
                        <input
                          id="oauthVkontakteClientSecret"
                          type="password"
                          bind:value={settings.oauthVkontakteClientSecret}
                          on:change={() =>
                            updateSetting(
                              'oauthVkontakteClientSecret',
                              settings.oauthVkontakteClientSecret
                            )}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="..."
                        />
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Facebook OAuth -->
                <div class="bg-dark-light p-4 rounded">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="font-medium">{t('settings.oauthFacebook')}</p>
                      <p class="text-sm text-accent-muted">
                        {t('settings.oauthFacebookDescription')}
                      </p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.oauthFacebookEnabled}
                        on:change={(e) => {
                          settings.oauthFacebookEnabled = getChecked(e);
                          updateSetting('oauthFacebookEnabled', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  {#if settings.oauthFacebookEnabled}
                    <div class="space-y-3 pl-4">
                      <div>
                        <label for="oauthFacebookClientId" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientId')}</label
                        >
                        <input
                          id="oauthFacebookClientId"
                          type="text"
                          bind:value={settings.oauthFacebookClientId}
                          on:change={() =>
                            updateSetting('oauthFacebookClientId', settings.oauthFacebookClientId)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="1234567890123456"
                        />
                      </div>
                      <div>
                        <label
                          for="oauthFacebookClientSecret"
                          class="block text-sm font-medium mb-2"
                          >{t('settings.oauthClientSecret')}</label
                        >
                        <input
                          id="oauthFacebookClientSecret"
                          type="password"
                          bind:value={settings.oauthFacebookClientSecret}
                          on:change={() =>
                            updateSetting(
                              'oauthFacebookClientSecret',
                              settings.oauthFacebookClientSecret
                            )}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="..."
                        />
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Apple OAuth -->
                <div class="bg-dark-light p-4 rounded">
                  <div class="flex items-center justify-between mb-4">
                    <div>
                      <p class="font-medium">{t('settings.oauthApple')}</p>
                      <p class="text-sm text-accent-muted">{t('settings.oauthAppleDescription')}</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.oauthAppleEnabled}
                        on:change={(e) => {
                          settings.oauthAppleEnabled = getChecked(e);
                          updateSetting('oauthAppleEnabled', getChecked(e));
                        }}
                        class="sr-only peer"
                      />
                      <div
                        class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                      ></div>
                    </label>
                  </div>
                  {#if settings.oauthAppleEnabled}
                    <div class="space-y-3 pl-4">
                      <div>
                        <label for="oauthAppleClientId" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthAppleClientId')}</label
                        >
                        <input
                          id="oauthAppleClientId"
                          type="text"
                          bind:value={settings.oauthAppleClientId}
                          on:change={() =>
                            updateSetting('oauthAppleClientId', settings.oauthAppleClientId)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="com.example.app"
                        />
                      </div>
                      <div>
                        <label for="oauthAppleTeamId" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthAppleTeamId')}</label
                        >
                        <input
                          id="oauthAppleTeamId"
                          type="text"
                          bind:value={settings.oauthAppleTeamId}
                          on:change={() =>
                            updateSetting('oauthAppleTeamId', settings.oauthAppleTeamId)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="ABC123DEF4"
                        />
                      </div>
                      <div>
                        <label for="oauthAppleKeyId" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthAppleKeyId')}</label
                        >
                        <input
                          id="oauthAppleKeyId"
                          type="text"
                          bind:value={settings.oauthAppleKeyId}
                          on:change={() =>
                            updateSetting('oauthAppleKeyId', settings.oauthAppleKeyId)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="XYZ123ABC4"
                        />
                      </div>
                      <div>
                        <label for="oauthApplePrivateKey" class="block text-sm font-medium mb-2"
                          >{t('settings.oauthApplePrivateKey')}</label
                        >
                        <!-- svelte-ignore element_invalid_self_closing_tag -->
                        <textarea
                          id="oauthApplePrivateKey"
                          bind:value={settings.oauthApplePrivateKey}
                          on:change={() =>
                            updateSetting('oauthApplePrivateKey', settings.oauthApplePrivateKey)}
                          class="w-full px-4 py-2 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Base64 encoded private key"
                          rows="3"
                        />
                        <p class="text-sm text-accent-muted mt-1">
                          {t('settings.oauthApplePrivateKeyDescription')}
                        </p>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === 'marketing'}
        <!-- Promo Code Settings -->
        <div class="bg-dark-light p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('settings.promoCodeSettings')}</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.promoCodeCreationDisabled')}</p>
                <p class="text-sm text-accent-muted">
                  {t('settings.promoCodeCreationDisabledDescription')}
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.promoCodeCreationDisabled}
                  on:change={(e) => {
                    settings.promoCodeCreationDisabled = getChecked(e);
                    updateSetting('promoCodeCreationDisabled', getChecked(e));
                  }}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
