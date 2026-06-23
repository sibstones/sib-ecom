<script lang="ts">
  import { onMount } from 'svelte';
  import {
    headerApi,
    type HeaderSettings,
    type UpdateHeaderSettingsDto,
  } from '$lib/api/header.api';
  import { categoryApi, type Category } from '$lib/api/category.api';
  import { adminApi } from '$lib/api/admin.api';
  import { apiClient } from '$lib/api/client';
  import { notificationStore } from '$lib/stores/notification.store';
  import { normalizeUploadFile } from '$lib/utils/file-upload';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';

  let loading = true;
  let saving = false;
  let error = '';
  let settings: HeaderSettings | null = null;
  let categories: Category[] = [];

  let formData: UpdateHeaderSettingsDto = {
    isActive: true,
    logoType: 'TEXT',
    logoText: '',
    logoPosition: 'CENTER',
    logoSize: 'text-2xl',
    logoColor: '#000000',
    logoLink: '/',
    backgroundColor: '#ffffff',
    backgroundOpacity: 92,
    backdropBlur: 12,
    dropdownBackgroundOpacity: 96,
    dropdownBackdropBlur: 16,
    textColor: '#000000',
    borderColor: '#e5e7eb',
    shadowEnabled: true,
    stickyEnabled: true,
    height: 'h-12',
    categoryLinksEnabled: true,
    categoryLinksPosition: 'LEFT',
    categoryLinksColor: '#4b5563',
    categoryLinksHoverColor: '#000000',
    categoryLinksActiveColor: '#000000',
    categoryLinksFontSize: 'text-sm',
    categoryLinksFontWeight: 'font-medium',
    headerMenuDropdown: false,
    iconsEnabled: true,
    iconsPosition: 'RIGHT',
    iconsColor: '#4b5563',
    iconsHoverColor: '#000000',
    iconsSize: 'w-5 h-5',
    customIcons: [],
    categoryConditions: [],
    quickLinks: [
      { label: 'My Account', link: '/account/profile', visible: true },
      { label: 'Orders', link: '/account/orders', visible: true },
      { label: 'Shipping', link: '/account/orders', visible: true },
      { label: 'Returns', link: '/account/returns', visible: true },
    ],
    navigationBlocks: [],
  };

  let activeTab: 'logo' | 'styling' | 'categories' | 'icons' | 'blocks' = 'logo';
  let logoImageFile: File | null = null;
  let logoImagePreview: string | null = null;
  let logoSvgFile: File | null = null;
  let logoSvgPreview: string | null = null;

  onMount(async () => {
    await Promise.all([loadSettings(), loadCategories()]);
  });

  async function loadSettings() {
    loading = true;
    error = '';
    try {
      const response = await headerApi.getSettings();
      settings = response.settings;
      formData = {
        isActive: settings.isActive,
        logoType: settings.logoType,
        logoText: settings.logoText,
        logoImageUrl: settings.logoImageUrl || undefined,
        logoSvg: settings.logoSvg || undefined,
        logoPosition: settings.logoPosition,
        logoSize: settings.logoSize,
        logoColor: settings.logoColor,
        logoLink: settings.logoLink,
        backgroundColor: settings.backgroundColor,
        backgroundOpacity: settings.backgroundOpacity ?? 92,
        backdropBlur: settings.backdropBlur ?? 12,
        dropdownBackgroundOpacity: settings.dropdownBackgroundOpacity ?? 96,
        dropdownBackdropBlur: settings.dropdownBackdropBlur ?? 16,
        textColor: settings.textColor,
        borderColor: settings.borderColor,
        shadowEnabled: settings.shadowEnabled,
        stickyEnabled: settings.stickyEnabled,
        height: settings.height,
        categoryLinksEnabled: settings.categoryLinksEnabled,
        categoryLinksPosition: settings.categoryLinksPosition,
        categoryLinksColor: settings.categoryLinksColor,
        categoryLinksHoverColor: settings.categoryLinksHoverColor,
        categoryLinksActiveColor: settings.categoryLinksActiveColor,
        categoryLinksFontSize: settings.categoryLinksFontSize,
        categoryLinksFontWeight: settings.categoryLinksFontWeight,
        headerMenuDropdown: settings.headerMenuDropdown ?? false,
        iconsEnabled: settings.iconsEnabled,
        iconsPosition: settings.iconsPosition,
        iconsColor: settings.iconsColor,
        iconsHoverColor: settings.iconsHoverColor,
        iconsSize: settings.iconsSize,
        customIcons: settings.customIcons || [],
        categoryConditions: settings.categoryConditions || [],
        quickLinks: settings.quickLinks || [
          { label: 'My Account', link: '/account/profile', visible: true },
          { label: 'Orders', link: '/account/orders', visible: true },
          { label: 'Shipping', link: '/account/orders', visible: true },
          { label: 'Returns', link: '/account/returns', visible: true },
        ],
        navigationBlocks: settings.navigationBlocks || getDefaultNavigationBlocks(),
      };
      if (settings.logoImageUrl) {
        logoImagePreview = settings.logoImageUrl;
      } else {
        logoImagePreview = null;
      }
      if (settings.logoSvg) {
        logoSvgPreview = settings.logoSvg;
      } else {
        logoSvgPreview = null;
      }
    } catch (e: any) {
      error = e.response?.data?.error || e.message || t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function loadCategories() {
    try {
      const response = await categoryApi.getAll(false, false, true);
      categories = response.categories || [];
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }

  async function handleLogoImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const normalizedFile = normalizeUploadFile(file);
    logoImageFile = normalizedFile;
    const reader = new FileReader();
    reader.onload = (e) => {
      logoImagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(normalizedFile);

    try {
      saving = true;
      const formDataUpload = new FormData();
      formDataUpload.append('file', normalizedFile);

      const data = await apiClient.post<{ url: string }>('/header/upload', formDataUpload);
      formData.logoImageUrl = data.url;
      logoImagePreview = data.url;
      notificationStore.success(t('header.logo.imageUploaded'));
    } catch (e: any) {
      notificationStore.error(e.message || t('header.logo.imageUploadFailed'));
    } finally {
      saving = false;
    }
  }

  async function handleLogoSvgUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Check file extension and MIME type for reliability
    const fileName = file.name.toLowerCase();
    const isValidSvgFile =
      fileName.endsWith('.svg') ||
      file.type === 'image/svg+xml' ||
      file.type === 'image/svg' ||
      file.type.includes('svg');

    if (!isValidSvgFile) {
      notificationStore.error(t('header.logo.selectSvgFile'));
      // Reset input so user can select file again
      target.value = '';
      return;
    }

    logoSvgFile = file;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const svgContent = e.target?.result as string;

      // Additional content validation
      if (!svgContent.trim().startsWith('<svg') && !svgContent.trim().includes('<svg')) {
        notificationStore.error(t('header.logo.selectSvgFile'));
        target.value = '';
        logoSvgFile = null;
        logoSvgPreview = null;
        return;
      }

      logoSvgPreview = svgContent;

      try {
        saving = true;
        // Read SVG content and store it directly
        formData.logoSvg = svgContent;
        notificationStore.success(t('header.logo.svgLoaded'));
      } catch (e: any) {
        notificationStore.error(e.message || t('header.logo.svgLoadFailed'));
      } finally {
        saving = false;
      }
    };

    reader.onerror = () => {
      notificationStore.error(t('header.logo.svgLoadFailed'));
      target.value = '';
      logoSvgFile = null;
      logoSvgPreview = null;
      saving = false;
    };

    reader.readAsText(file);
  }

  async function saveSettings() {
    saving = true;
    error = '';
    try {
      // Remove null/undefined values before sending to avoid validation errors
      const dataToSend: Partial<UpdateHeaderSettingsDto> = {};

      // Copy only defined (non-null, non-undefined) values
      for (const [key, value] of Object.entries(formData)) {
        if (value !== null && value !== undefined) {
          // For arrays, always include them (even if empty)
          if (Array.isArray(value)) {
            (dataToSend as any)[key] = value;
          } else {
            (dataToSend as any)[key] = value;
          }
        }
      }

      const response = await headerApi.updateSettings(dataToSend as UpdateHeaderSettingsDto);
      settings = response.settings;
      notificationStore.success(t('header.settings.saved'));
      await loadSettings();
    } catch (e: any) {
      error = e.response?.data?.error || e.message || t('error.failedToSave');
      notificationStore.error(error);
    } finally {
      saving = false;
    }
  }

  function addCustomIcon() {
    if (!formData.customIcons) {
      formData.customIcons = [];
    }
    formData.customIcons = [
      ...formData.customIcons,
      {
        name: '',
        svg: '',
        link: '',
        visible: true,
      },
    ];
  }

  function removeCustomIcon(index: number) {
    if (!formData.customIcons) return;
    formData.customIcons = formData.customIcons.filter((_, i) => i !== index);
  }

  function addCategoryCondition() {
    if (!formData.categoryConditions) {
      formData.categoryConditions = [];
    }
    formData.categoryConditions = [
      ...formData.categoryConditions,
      {
        categoryId: '',
        condition: '',
        visible: true,
      },
    ];
  }

  function removeCategoryCondition(index: number) {
    if (!formData.categoryConditions) return;
    formData.categoryConditions = formData.categoryConditions.filter((_, i) => i !== index);
  }

  function addQuickLink() {
    if (!formData.quickLinks) {
      formData.quickLinks = [];
    }
    formData.quickLinks = [
      ...formData.quickLinks,
      {
        label: '',
        link: '',
        visible: true,
      },
    ];
  }

  function removeQuickLink(index: number) {
    if (!formData.quickLinks) return;
    formData.quickLinks = formData.quickLinks.filter((_, i) => i !== index);
  }

  function getDefaultNavigationBlocks() {
    return [
      {
        id: 'language',
        type: 'language' as const,
        enabled: true,
        icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
        link: '',
        label: 'US',
        order: 1,
      },
      {
        id: 'search',
        type: 'search' as const,
        enabled: true,
        icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>',
        link: '',
        label: 'Search',
        order: 2,
      },
      {
        id: 'profile',
        type: 'profile' as const,
        enabled: true,
        icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>',
        link: '/account/profile',
        label: 'Profile',
        order: 3,
      },
      {
        id: 'wishlist',
        type: 'wishlist' as const,
        enabled: true,
        icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>',
        link: '/account/wishlist',
        label: 'Wishlist',
        order: 4,
      },
      {
        id: 'cart',
        type: 'cart' as const,
        enabled: true,
        icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>',
        link: '/cart',
        label: 'Cart',
        order: 5,
      },
    ];
  }

  function updateNavigationBlockOrder(index: number, direction: 'up' | 'down') {
    if (!formData.navigationBlocks) return;
    const blocks = [...formData.navigationBlocks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];
    blocks[index].order = index + 1;
    blocks[newIndex].order = newIndex + 1;
    formData.navigationBlocks = blocks;
  }

  function resetNavigationBlocks() {
    formData.navigationBlocks = getDefaultNavigationBlocks();
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">{t('header.design')}</h1>
    <button
      on:click={saveSettings}
      disabled={saving}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
    >
      {saving ? t('common.saving') : t('common.save')}
    </button>
  </div>

  {#if error}
    <div class="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <!-- Tabs -->
    <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
      <button
        on:click={() => (activeTab = 'logo')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'logo'}
        class:shadow-sm={activeTab === 'logo'}
        class:text-accent={activeTab === 'logo'}
        class:text-gray-600={activeTab !== 'logo'}
        class:hover:bg-gray-50={activeTab !== 'logo'}
        class:hover:text-gray-900={activeTab !== 'logo'}
      >
        {t('header.tabs.logo')}
      </button>
      <button
        on:click={() => (activeTab = 'styling')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'styling'}
        class:shadow-sm={activeTab === 'styling'}
        class:text-accent={activeTab === 'styling'}
        class:text-gray-600={activeTab !== 'styling'}
        class:hover:bg-gray-50={activeTab !== 'styling'}
        class:hover:text-gray-900={activeTab !== 'styling'}
      >
        {t('header.tabs.styling')}
      </button>
      <button
        on:click={() => (activeTab = 'categories')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'categories'}
        class:shadow-sm={activeTab === 'categories'}
        class:text-accent={activeTab === 'categories'}
        class:text-gray-600={activeTab !== 'categories'}
        class:hover:bg-gray-50={activeTab !== 'categories'}
        class:hover:text-gray-900={activeTab !== 'categories'}
      >
        {t('header.tabs.categories')}
      </button>
      <button
        on:click={() => (activeTab = 'icons')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'icons'}
        class:shadow-sm={activeTab === 'icons'}
        class:text-accent={activeTab === 'icons'}
        class:text-gray-600={activeTab !== 'icons'}
        class:hover:bg-gray-50={activeTab !== 'icons'}
        class:hover:text-gray-900={activeTab !== 'icons'}
      >
        {t('header.tabs.icons')}
      </button>
      <button
        on:click={() => (activeTab = 'blocks')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'blocks'}
        class:shadow-sm={activeTab === 'blocks'}
        class:text-accent={activeTab === 'blocks'}
        class:text-gray-600={activeTab !== 'blocks'}
        class:hover:bg-gray-50={activeTab !== 'blocks'}
        class:hover:text-gray-900={activeTab !== 'blocks'}
      >
        {t('header.tabs.blocks')}
      </button>
    </div>

    <!-- Logo Tab -->
    {#if activeTab === 'logo'}
      <div class="space-y-6">
        <div class="bg-dark-light p-6 rounded">
          <h3 class="text-xl font-medium mb-4">{t('header.logo.settings')}</h3>

          <div class="space-y-4">
            <div>
              <label for="logoType" class="block text-sm font-medium mb-2"
                >{t('header.logo.type')}</label
              >
              <select
                id="logoType"
                bind:value={formData.logoType}
                on:change={(e) => {
                  // Clear logo data when switching types
                  if (e.currentTarget.value === 'TEXT') {
                    formData.logoImageUrl = undefined;
                    formData.logoSvg = undefined;
                    logoImagePreview = null;
                    logoSvgPreview = null;
                  } else if (e.currentTarget.value === 'IMAGE') {
                    formData.logoSvg = undefined;
                    logoSvgPreview = null;
                  } else if (e.currentTarget.value === 'SVG') {
                    formData.logoImageUrl = undefined;
                    logoImagePreview = null;
                  }
                }}
                class="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="TEXT">{t('header.logo.typeText')}</option>
                <option value="IMAGE">{t('header.logo.typeImage')}</option>
                <option value="SVG">{t('header.logo.typeSvg')}</option>
              </select>
            </div>

            {#if formData.logoType === 'TEXT'}
              <div>
                <label for="logoText" class="block text-sm font-medium mb-2"
                  >{t('header.logo.text')}</label
                >
                <input
                  id="logoText"
                  type="text"
                  bind:value={formData.logoText}
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder=""
                />
              </div>
            {/if}

            {#if formData.logoType === 'IMAGE'}
              <div>
                <label for="logoImage" class="block text-sm font-medium mb-2"
                  >{t('header.logo.image')}</label
                >
                {#if logoImagePreview}
                  <div class="mb-2">
                    <img
                      src={logoImagePreview}
                      alt={t('header.logo.imagePreview')}
                      class="max-h-20"
                    />
                  </div>
                {/if}
                <input
                  id="logoImage"
                  type="file"
                  accept="image/*"
                  on:change={handleLogoImageUpload}
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            {/if}

            {#if formData.logoType === 'SVG'}
              <div>
                <label for="logoSvgFile" class="block text-sm font-medium mb-2"
                  >{t('header.logo.svg')}</label
                >
                {#if saving && logoSvgFile}
                  <div class="mb-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <div class="flex items-center gap-2">
                      <svg
                        class="animate-spin h-4 w-4 text-blue-600"
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
                      <span class="text-sm text-blue-600">{t('common.loading')}...</span>
                    </div>
                  </div>
                {/if}
                {#if logoSvgPreview}
                  <div class="mb-2 p-3 bg-white rounded border border-gray-200">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm text-gray-600">{t('header.logo.preview')}</span>
                      <button
                        type="button"
                        on:click={() => {
                          logoSvgPreview = null;
                          formData.logoSvg = '';
                          logoSvgFile = null;
                        }}
                        class="text-xs text-red-600 hover:text-red-800"
                      >
                        {t('header.logo.clear')}
                      </button>
                    </div>
                    <div
                      class="max-h-32 overflow-auto border border-gray-200 rounded p-2 bg-gray-50"
                    >
                      {@html logoSvgPreview}
                    </div>
                  </div>
                {/if}
                <div class="space-y-2">
                  <label for="logoSvgFile" class="block">
                    <input
                      id="logoSvgFile"
                      type="file"
                      accept=".svg,image/svg+xml"
                      on:change={handleLogoSvgUpload}
                      disabled={saving}
                      class="w-full px-3 py-2 border border-gray-300 rounded text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-accent file:text-dark hover:file:bg-accent-muted"
                    />
                  </label>
                  <p class="text-xs text-gray-500">{t('header.logo.uploadSvg')}</p>
                </div>
                <div class="mt-3">
                  <label for="logoSvgPaste" class="block text-sm font-medium mb-2"
                    >{t('header.logo.pasteSvg')}</label
                  >
                  <!-- svelte-ignore element_invalid_self_closing_tag -->
                  <textarea
                    id="logoSvgPaste"
                    bind:value={formData.logoSvg}
                    rows="5"
                    class="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                    placeholder="<svg>...</svg>"
                    disabled={saving}
                    on:input={(e) => {
                      if (e.currentTarget.value) {
                        logoSvgPreview = e.currentTarget.value;
                      } else {
                        logoSvgPreview = null;
                      }
                    }}
                  />
                </div>
              </div>
            {/if}

            <div>
              <label for="logoPosition" class="block text-sm font-medium mb-2"
                >{t('header.logo.position')}</label
              >
              <select
                id="logoPosition"
                bind:value={formData.logoPosition}
                class="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="LEFT">{t('header.logo.positionLeft')}</option>
                <option value="CENTER">{t('header.logo.positionCenter')}</option>
                <option value="RIGHT">{t('header.logo.positionRight')}</option>
              </select>
            </div>

            <div>
              <label for="logoSize" class="block text-sm font-medium mb-2"
                >{t('header.logo.size')}</label
              >
              <input
                id="logoSize"
                type="text"
                bind:value={formData.logoSize}
                class="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="text-2xl"
              />
            </div>

            <div>
              <label for="logoColor" class="block text-sm font-medium mb-2"
                >{t('header.logo.color')}</label
              >
              <input
                id="logoColor"
                type="color"
                bind:value={formData.logoColor}
                class="w-full h-10 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label for="logoLink" class="block text-sm font-medium mb-2"
                >{t('header.logo.link')}</label
              >
              <input
                id="logoLink"
                type="text"
                bind:value={formData.logoLink}
                class="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="/"
              />
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Styling Tab -->
    {#if activeTab === 'styling'}
      <div class="space-y-6">
        <div class="bg-dark-light p-6 rounded">
          <h3 class="text-xl font-medium mb-4">{t('header.styling.title')}</h3>

          <div class="space-y-4">
            <div>
              <label for="backgroundColor" class="block text-sm font-medium mb-2"
                >{t('header.styling.backgroundColor')}</label
              >
              <input
                id="backgroundColor"
                type="color"
                bind:value={formData.backgroundColor}
                class="w-full h-10 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label for="backgroundOpacity" class="block text-sm font-medium mb-2"
                >Background opacity</label
              >
              <input
                id="backgroundOpacity"
                type="range"
                min="0"
                max="100"
                step="1"
                bind:value={formData.backgroundOpacity}
                class="w-full"
              />
              <p class="text-xs text-accent-muted mt-1">{formData.backgroundOpacity ?? 0}%</p>
            </div>

            <div>
              <label for="backdropBlur" class="block text-sm font-medium mb-2">Backdrop blur</label>
              <input
                id="backdropBlur"
                type="range"
                min="0"
                max="40"
                step="1"
                bind:value={formData.backdropBlur}
                class="w-full"
              />
              <p class="text-xs text-accent-muted mt-1">{formData.backdropBlur ?? 0}px</p>
            </div>

            <div>
              <label for="dropdownBackgroundOpacity" class="block text-sm font-medium mb-2"
                >Dropdown opacity</label
              >
              <input
                id="dropdownBackgroundOpacity"
                type="range"
                min="0"
                max="100"
                step="1"
                bind:value={formData.dropdownBackgroundOpacity}
                class="w-full"
              />
              <p class="text-xs text-accent-muted mt-1">
                {formData.dropdownBackgroundOpacity ?? 0}%
              </p>
            </div>

            <div>
              <label for="dropdownBackdropBlur" class="block text-sm font-medium mb-2"
                >Dropdown blur</label
              >
              <input
                id="dropdownBackdropBlur"
                type="range"
                min="0"
                max="40"
                step="1"
                bind:value={formData.dropdownBackdropBlur}
                class="w-full"
              />
              <p class="text-xs text-accent-muted mt-1">{formData.dropdownBackdropBlur ?? 0}px</p>
            </div>

            <div>
              <label for="textColor" class="block text-sm font-medium mb-2"
                >{t('header.styling.textColor')}</label
              >
              <input
                id="textColor"
                type="color"
                bind:value={formData.textColor}
                class="w-full h-10 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label for="borderColor" class="block text-sm font-medium mb-2"
                >{t('header.styling.borderColor')}</label
              >
              <input
                id="borderColor"
                type="color"
                bind:value={formData.borderColor}
                class="w-full h-10 border border-gray-300 rounded"
              />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('header.styling.shadowEnabled')}</p>
                <p class="text-sm text-accent-muted">{t('header.styling.shadowDescription')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" bind:checked={formData.shadowEnabled} class="sr-only peer" />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('header.styling.stickyEnabled')}</p>
                <p class="text-sm text-accent-muted">{t('header.styling.stickyDescription')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" bind:checked={formData.stickyEnabled} class="sr-only peer" />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>

            <div>
              <label for="headerHeight" class="block text-sm font-medium mb-2"
                >{t('header.styling.height')}</label
              >
              <input
                id="headerHeight"
                type="text"
                bind:value={formData.height}
                class="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="h-12"
              />
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Categories Tab -->
    {#if activeTab === 'categories'}
      <div class="space-y-6">
        <div class="bg-dark-light p-6 rounded">
          <h3 class="text-xl font-medium mb-4">{t('header.categories.title')}</h3>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('header.categories.enabled')}</p>
                <p class="text-sm text-accent-muted">{t('header.categories.enabledDescription')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={formData.categoryLinksEnabled}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>

            {#if formData.categoryLinksEnabled}
              <div>
                <label for="categoryLinksPosition" class="block text-sm font-medium mb-2"
                  >{t('header.categories.position')}</label
                >
                <select
                  id="categoryLinksPosition"
                  bind:value={formData.categoryLinksPosition}
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="LEFT">{t('header.logo.positionLeft')}</option>
                  <option value="CENTER">{t('header.logo.positionCenter')}</option>
                  <option value="RIGHT">{t('header.logo.positionRight')}</option>
                </select>
              </div>

              <div>
                <label for="categoryLinksColor" class="block text-sm font-medium mb-2"
                  >{t('header.categories.color')}</label
                >
                <input
                  id="categoryLinksColor"
                  type="color"
                  bind:value={formData.categoryLinksColor}
                  class="w-full h-10 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label for="categoryLinksHoverColor" class="block text-sm font-medium mb-2"
                  >{t('header.categories.hoverColor')}</label
                >
                <input
                  id="categoryLinksHoverColor"
                  type="color"
                  bind:value={formData.categoryLinksHoverColor}
                  class="w-full h-10 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label for="categoryLinksActiveColor" class="block text-sm font-medium mb-2"
                  >{t('header.categories.activeColor')}</label
                >
                <input
                  id="categoryLinksActiveColor"
                  type="color"
                  bind:value={formData.categoryLinksActiveColor}
                  class="w-full h-10 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label for="categoryLinksFontSize" class="block text-sm font-medium mb-2"
                  >{t('header.categories.fontSize')}</label
                >
                <input
                  id="categoryLinksFontSize"
                  type="text"
                  bind:value={formData.categoryLinksFontSize}
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="text-sm"
                />
              </div>

              <div>
                <label for="categoryLinksFontWeight" class="block text-sm font-medium mb-2"
                  >{t('header.categories.fontWeight')}</label
                >
                <input
                  id="categoryLinksFontWeight"
                  type="text"
                  bind:value={formData.categoryLinksFontWeight}
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="font-medium"
                />
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Header Menu Dropdown</p>
                  <p class="text-sm text-accent-muted">
                    Enable Apple-style full-width dropdown menu on hover (desktop only)
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    bind:checked={formData.headerMenuDropdown}
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                  ></div>
                </label>
              </div>

              <!-- Quick Links Section -->
              {#if formData.headerMenuDropdown}
                <div class="mt-6">
                  <div class="flex justify-between items-center mb-4">
                    <div>
                      <h4 class="text-lg font-medium">Quick Links</h4>
                      <p class="text-sm text-accent-muted">
                        Configure quick links shown in the dropdown menu
                      </p>
                    </div>
                    <button
                      on:click={addQuickLink}
                      class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
                    >
                      Add Quick Link
                    </button>
                  </div>
                  {#if formData.quickLinks && formData.quickLinks.length > 0}
                    <div class="space-y-3">
                      {#each formData.quickLinks as quickLink, index}
                        <div
                          class="flex gap-3 items-start p-3 bg-white rounded border border-gray-200"
                        >
                          <div class="flex-1 space-y-2">
                            <label class="sr-only" for={`quickLinkLabel-${index}`}
                              >{t('header.blocks.label')}</label
                            >
                            <input
                              id={`quickLinkLabel-${index}`}
                              type="text"
                              bind:value={quickLink.label}
                              placeholder="Link Label (e.g., Find a Store)"
                              class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                            <label class="sr-only" for={`quickLinkUrl-${index}`}
                              >{t('header.blocks.link')}</label
                            >
                            <input
                              id={`quickLinkUrl-${index}`}
                              type="text"
                              bind:value={quickLink.link}
                              placeholder="Link URL (e.g., /shop)"
                              class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div class="flex items-center gap-2">
                            <label class="flex items-center" for={`quickLinkVisible-${index}`}>
                              <input
                                id={`quickLinkVisible-${index}`}
                                type="checkbox"
                                bind:checked={quickLink.visible}
                                class="mr-2"
                              />
                              <span class="text-sm">Visible</span>
                            </label>
                            <button
                              on:click={() => removeQuickLink(index)}
                              class="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                            >
                              {t('common.remove')}
                            </button>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-sm text-accent-muted">
                      No quick links configured. Click "Add Quick Link" to add one.
                    </p>
                  {/if}
                </div>
              {/if}

              <div class="mt-6">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-lg font-medium">{t('header.categories.conditions')}</h4>
                  <button
                    on:click={addCategoryCondition}
                    class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
                  >
                    {t('header.categories.addCondition')}
                  </button>
                </div>
                {#if formData.categoryConditions && formData.categoryConditions.length > 0}
                  <div class="space-y-3">
                    {#each formData.categoryConditions as condition, index}
                      <div
                        class="flex gap-3 items-start p-3 bg-white rounded border border-gray-200"
                      >
                        <div class="flex-1 space-y-2">
                          <select
                            id={`categoryConditionSelect-${index}`}
                            bind:value={condition.categoryId}
                            class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="">{t('header.categories.selectCategory')}</option>
                            {#each categories as category}
                              <option value={category.id}>{category.name}</option>
                            {/each}
                          </select>
                          <label class="sr-only" for={`categoryConditionInput-${index}`}
                            >{t('header.categories.conditionPlaceholder')}</label
                          >
                          <input
                            id={`categoryConditionInput-${index}`}
                            type="text"
                            bind:value={condition.condition}
                            placeholder={t('header.categories.conditionPlaceholder')}
                            class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div class="flex items-center gap-2">
                          <label
                            class="flex items-center"
                            for={`categoryConditionVisible-${index}`}
                          >
                            <input
                              id={`categoryConditionVisible-${index}`}
                              type="checkbox"
                              bind:checked={condition.visible}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('header.categories.visible')}</span>
                          </label>
                          <button
                            on:click={() => removeCategoryCondition(index)}
                            class="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                          >
                            {t('common.remove')}
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-sm text-accent-muted">{t('header.categories.noConditions')}</p>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Icons Tab -->
    {#if activeTab === 'icons'}
      <div class="space-y-6">
        <div class="bg-dark-light p-6 rounded">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-medium">{t('header.icons.title')}</h3>
            <div class="flex gap-2">
              <button
                type="button"
                on:click={() => {
                  if (settings) {
                    formData.iconsEnabled = settings.iconsEnabled;
                    formData.iconsPosition = settings.iconsPosition;
                    formData.iconsColor = settings.iconsColor;
                    formData.iconsHoverColor = settings.iconsHoverColor;
                    formData.iconsSize = settings.iconsSize;
                    formData.customIcons = settings.customIcons ? [...settings.customIcons] : [];
                  }
                  notificationStore.info(t('header.icons.resetInfo'));
                }}
                class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                {t('header.icons.reset')}
              </button>
              <button
                type="button"
                on:click={saveSettings}
                disabled={saving}
                class="px-4 py-2 text-sm bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('header.icons.saveSettings')}
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('header.icons.enabled')}</p>
                <p class="text-sm text-accent-muted">{t('header.icons.enabledDescription')}</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" bind:checked={formData.iconsEnabled} class="sr-only peer" />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>

            {#if formData.iconsEnabled}
              <div>
                <label for="iconsPosition" class="block text-sm font-medium mb-2"
                  >{t('header.icons.position')}</label
                >
                <select
                  id="iconsPosition"
                  bind:value={formData.iconsPosition}
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="LEFT">{t('header.logo.positionLeft')}</option>
                  <option value="CENTER">{t('header.logo.positionCenter')}</option>
                  <option value="RIGHT">{t('header.logo.positionRight')}</option>
                </select>
              </div>

              <div>
                <label for="iconsColor" class="block text-sm font-medium mb-2"
                  >{t('header.icons.color')}</label
                >
                <input
                  id="iconsColor"
                  type="color"
                  bind:value={formData.iconsColor}
                  class="w-full h-10 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label for="iconsHoverColor" class="block text-sm font-medium mb-2"
                  >{t('header.icons.hoverColor')}</label
                >
                <input
                  id="iconsHoverColor"
                  type="color"
                  bind:value={formData.iconsHoverColor}
                  class="w-full h-10 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label for="iconsSize" class="block text-sm font-medium mb-2"
                  >{t('header.icons.size')}</label
                >
                <input
                  id="iconsSize"
                  type="text"
                  bind:value={formData.iconsSize}
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="w-5 h-5"
                />
              </div>

              <div class="mt-6">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-lg font-medium">{t('header.icons.custom')}</h4>
                  <button
                    on:click={addCustomIcon}
                    class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
                  >
                    {t('header.icons.addIcon')}
                  </button>
                </div>
                {#if formData.customIcons && formData.customIcons.length > 0}
                  <div class="space-y-3">
                    {#each formData.customIcons as icon, index}
                      <div
                        class="flex gap-3 items-start p-3 bg-white rounded border border-gray-200"
                      >
                        <div class="flex-1 space-y-2">
                          <input
                            id={`customIconName-${index}`}
                            type="text"
                            bind:value={icon.name}
                            placeholder={t('header.icons.iconName')}
                            class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                          <textarea
                            id={`customIconSvg-${index}`}
                            bind:value={icon.svg}
                            rows="3"
                            placeholder={t('header.icons.svgCode')}
                            class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                          ></textarea>
                          <input
                            id={`customIconLink-${index}`}
                            type="text"
                            bind:value={icon.link}
                            placeholder={t('header.icons.linkUrl')}
                            class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div class="flex items-center gap-2">
                          <label class="flex items-center" for={`customIconVisible-${index}`}>
                            <input
                              id={`customIconVisible-${index}`}
                              type="checkbox"
                              bind:checked={icon.visible}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('header.categories.visible')}</span>
                          </label>
                          <button
                            on:click={() => removeCustomIcon(index)}
                            class="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                          >
                            {t('common.remove')}
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-sm text-accent-muted">{t('header.icons.noCustomIcons')}</p>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Blocks Tab -->
    {#if activeTab === 'blocks'}
      <div class="space-y-6">
        <div class="bg-dark-light p-6 rounded">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-medium">{t('header.blocks.title')}</h3>
            <div class="flex gap-2">
              <button
                type="button"
                on:click={resetNavigationBlocks}
                class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                {t('header.blocks.reset')}
              </button>
              <button
                type="button"
                on:click={saveSettings}
                disabled={saving}
                class="px-4 py-2 text-sm bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('header.blocks.saveSettings')}
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <p class="text-sm text-accent-muted mb-4">{t('header.blocks.description')}</p>

            {#if formData.navigationBlocks && formData.navigationBlocks.length > 0}
              <div class="space-y-3">
                {#each formData.navigationBlocks.sort((a, b) => a.order - b.order) as block, index}
                  <div class="flex gap-3 items-start p-4 bg-white rounded border border-gray-200">
                    <div class="flex flex-col gap-1">
                      <button
                        on:click={() => updateNavigationBlockOrder(index, 'up')}
                        disabled={index === 0}
                        class="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('header.blocks.moveUp')}
                      >
                        ↑
                      </button>
                      <button
                        on:click={() => updateNavigationBlockOrder(index, 'down')}
                        disabled={index === formData.navigationBlocks.length - 1}
                        class="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('header.blocks.moveDown')}
                      >
                        ↓
                      </button>
                    </div>

                    <div class="flex-1 space-y-3">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              bind:checked={block.enabled}
                              class="sr-only peer"
                            />
                            <div
                              class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                            ></div>
                          </label>
                          <span class="font-medium capitalize">{block.type}</span>
                        </div>
                        <span class="text-xs text-gray-500">#{block.order}</span>
                      </div>

                      {#if block.enabled}
                        <div class="space-y-2">
                          <div>
                            <label
                              for={`navigationBlockLabel-${index}`}
                              class="block text-sm font-medium mb-1"
                              >{t('header.blocks.label')}</label
                            >
                            <input
                              id={`navigationBlockLabel-${index}`}
                              type="text"
                              bind:value={block.label}
                              placeholder={t('header.blocks.labelPlaceholder')}
                              class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                          </div>

                          {#if block.type !== 'language' && block.type !== 'search'}
                            <div>
                              <label
                                for={`navigationBlockLink-${index}`}
                                class="block text-sm font-medium mb-1"
                                >{t('header.blocks.link')}</label
                              >
                              <input
                                id={`navigationBlockLink-${index}`}
                                type="text"
                                bind:value={block.link}
                                placeholder={t('header.blocks.linkPlaceholder')}
                                class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                              />
                            </div>
                          {/if}

                          <div>
                            <label
                              for={`navigationBlockIcon-${index}`}
                              class="block text-sm font-medium mb-1"
                              >{t('header.blocks.icon')}</label
                            >
                            <textarea
                              id={`navigationBlockIcon-${index}`}
                              bind:value={block.icon}
                              rows="3"
                              placeholder={t('header.blocks.iconPlaceholder')}
                              class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                            ></textarea>
                            {#if block.icon}
                              <div
                                class="mt-2 p-2 bg-gray-50 rounded border border-gray-200 inline-flex items-center gap-2"
                              >
                                <div class="text-xs text-gray-600">
                                  {t('header.blocks.preview')}:
                                </div>
                                <div class="flex items-center gap-1.5 text-gray-700">
                                  <span class="w-4 h-4 flex items-center justify-center"
                                    >{@html block.icon}</span
                                  >
                                  {#if block.label}
                                    <span class="text-xs">{block.label}</span>
                                  {/if}
                                </div>
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-accent-muted">{t('header.blocks.noBlocks')}</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
