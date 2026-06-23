<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.store';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';

  let loading = true;
  let saving = false;

  let shopGridColumns = '4';
  let shopGridGap = '6';
  let shopCardAspectRatio = '9/16';
  let shopCardHoverImage = true;
  let shopCardHoverAnimation = 'scale';
  let shopCardVideoSupport = true;
  let shopCardShowQuickAdd = false;
  let shopHeaderStyle = 'plain';
  let shopHeaderSpacing = 'comfortable';
  let shopHeaderTitleScale = 'hero';
  let shopHeaderAlignment = 'center';
  let shopHeaderShowBreadcrumbs = true;
  let shopHeaderShowTitle = true;
  let shopHeaderShowCategories = true;
  let shopHeaderShowCount = true;
  let shopHeaderShowSideMenuTab = false;
  let shopHeaderCategoryLimit = '8';
  let shopMenuLabel = 'Menu';
  let shopDefaultSort = 'createdAt_desc';
  let shopDefaultInventoryStatus = '';
  let shopToolbarStyle = 'minimal';
  let shopToolbarCorners = 'square';
  let shopToolbarDensity = 'comfortable';

  const gridColumnsOptions = [
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
    { value: '6', label: '6' },
  ];

  const gridGapOptions = [
    { value: '2', label: '2' },
    { value: '4', label: '4' },
    { value: '6', label: '6' },
    { value: '8', label: '8' },
  ];

  const aspectRatioOptions = [
    { value: '1/1', label: t('shopPageDesign.aspectRatioSquare') },
    { value: '3/4', label: t('shopPageDesign.aspectRatioPortrait') },
    { value: '4/5', label: t('shopPageDesign.aspectRatioPortraitWide') },
    { value: '9/16', label: t('shopPageDesign.aspectRatioPortraitTall') },
    { value: '16/9', label: t('shopPageDesign.aspectRatioLandscape') },
  ];

  const hoverAnimationOptions = [
    { value: 'scale', label: t('shopPageDesign.hoverAnimationScale') },
    { value: 'fade', label: t('shopPageDesign.hoverAnimationFade') },
    { value: 'none', label: t('shopPageDesign.hoverAnimationNone') },
  ];

  const toolbarStyleOptions = [
    { value: 'minimal', label: 'Minimal' },
    { value: 'boxed', label: 'Boxed' },
    { value: 'soft', label: 'Soft' },
  ];

  const headerStyleOptions = [
    { value: 'plain', label: 'Plain' },
    { value: 'card', label: 'Card' },
    { value: 'soft', label: 'Soft' },
  ];

  const headerSpacingOptions = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'airy', label: 'Airy' },
  ];

  const headerTitleScaleOptions = [
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'hero', label: 'Hero' },
  ];

  const headerAlignmentOptions = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
  ];

  const headerCategoryLimitOptions = [
    { value: '4', label: '4' },
    { value: '6', label: '6' },
    { value: '8', label: '8' },
    { value: '12', label: '12' },
    { value: '15', label: '15' },
  ];

  const toolbarCornerOptions = [
    { value: 'square', label: 'Square' },
    { value: 'rounded', label: 'Rounded' },
    { value: 'pill', label: 'Pill' },
  ];

  const defaultSortOptions = [
    { value: 'createdAt_desc', label: 'Newest first' },
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'name_asc', label: 'Name: A to Z' },
  ];

  const defaultInventoryStatusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'COMING_SOON', label: 'Coming soon' },
    { value: 'IN_SALE', label: 'In sale' },
    { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  ];

  const toolbarDensityOptions = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'airy', label: 'Airy' },
  ];

  const previewCategoryGroups = [
    {
      title: 'Women',
      items: [
        { label: 'New arrivals', active: true },
        { label: 'Dresses' },
        { label: 'Outerwear' },
      ],
    },
    {
      title: 'Men',
      items: [{ label: 'Shirts' }, { label: 'Trousers' }, { label: 'Knitwear' }],
    },
  ];

  const quickCategoryFilters = ['All', 'New arrivals', 'Dresses', 'Outerwear', 'Accessories'];

  const toolbarWrapperClassMap: Record<string, string> = {
    minimal: '',
    boxed: 'rounded-[28px] border border-accent/15 bg-background p-4 shadow-sm',
    soft: 'rounded-[32px] bg-background-secondary p-4',
  };

  const toolbarControlStyleClassMap: Record<string, string> = {
    minimal: 'border border-accent/20 bg-background text-accent',
    boxed: 'border border-accent/15 bg-background text-accent shadow-sm',
    soft: 'border border-transparent bg-background text-accent',
  };

  const toolbarChipStyleClassMap: Record<string, string> = {
    minimal: 'border border-accent/20 bg-background text-accent',
    boxed: 'border border-accent/15 bg-background text-accent shadow-sm',
    soft: 'border border-transparent bg-background text-accent',
  };

  const toolbarCornerClassMap: Record<string, string> = {
    square: 'rounded-none',
    rounded: 'rounded-xl',
    pill: 'rounded-full',
  };

  const toolbarDensityClassMap: Record<string, string> = {
    compact: 'px-3 py-2 text-xs',
    comfortable: 'px-4 py-2.5 text-sm',
    airy: 'px-5 py-3 text-sm',
  };

  const headerWrapperClassMap: Record<string, string> = {
    plain: '',
    card: 'border border-accent/15 bg-background shadow-sm',
    soft: 'bg-background-secondary',
  };

  const headerSpacingClassMap: Record<string, string> = {
    compact: 'py-5 space-y-5',
    comfortable: 'py-8 space-y-7',
    airy: 'py-10 space-y-9',
  };

  const headerTitleScaleClassMap: Record<string, string> = {
    medium: 'text-3xl md:text-4xl',
    large: 'text-4xl md:text-5xl',
    hero: 'text-5xl md:text-7xl',
  };

  const headerAlignmentClassMap: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
  };

  const headerCategoriesJustifyClassMap: Record<string, string> = {
    left: 'justify-start',
    center: 'justify-center',
  };

  $: previewHeaderWrapperClass =
    headerWrapperClassMap[shopHeaderStyle] ?? headerWrapperClassMap.plain;
  $: previewHeaderSpacingClass =
    headerSpacingClassMap[shopHeaderSpacing] ?? headerSpacingClassMap.comfortable;
  $: previewHeaderTitleScaleClass =
    headerTitleScaleClassMap[shopHeaderTitleScale] ?? headerTitleScaleClassMap.hero;
  $: previewHeaderAlignmentClass =
    headerAlignmentClassMap[shopHeaderAlignment] ?? headerAlignmentClassMap.center;
  $: previewHeaderCategoriesJustifyClass =
    headerCategoriesJustifyClassMap[shopHeaderAlignment] ?? headerCategoriesJustifyClassMap.center;
  $: previewToolbarWrapperClass =
    toolbarWrapperClassMap[shopToolbarStyle] ?? toolbarWrapperClassMap.minimal;
  $: previewToolbarControlClass =
    toolbarControlStyleClassMap[shopToolbarStyle] ?? toolbarControlStyleClassMap.minimal;
  $: previewToolbarChipClass =
    toolbarChipStyleClassMap[shopToolbarStyle] ?? toolbarChipStyleClassMap.minimal;
  $: previewToolbarCornerClass =
    toolbarCornerClassMap[shopToolbarCorners] ?? toolbarCornerClassMap.square;
  $: previewToolbarDensityClass =
    toolbarDensityClassMap[shopToolbarDensity] ?? toolbarDensityClassMap.comfortable;
  $: previewHeaderCategoryLimit = Number.parseInt(shopHeaderCategoryLimit, 10) || 8;

  onMount(async () => {
    await loadSettings();
  });

  async function loadSettings() {
    loading = true;
    try {
      await settingsStore.load();
      const s = $settingsStore;
      shopGridColumns = s.shopGridColumns ?? '4';
      shopGridGap = s.shopGridGap ?? '6';
      shopCardAspectRatio = s.shopCardAspectRatio ?? '9/16';
      shopCardHoverImage = s.shopCardHoverImage ?? true;
      shopCardHoverAnimation = s.shopCardHoverAnimation ?? 'scale';
      shopCardVideoSupport = s.shopCardVideoSupport ?? true;
      shopCardShowQuickAdd = s.shopCardShowQuickAdd ?? false;
      shopHeaderStyle = s.shopHeaderStyle ?? 'plain';
      shopHeaderSpacing = s.shopHeaderSpacing ?? 'comfortable';
      shopHeaderTitleScale = s.shopHeaderTitleScale ?? 'hero';
      shopHeaderAlignment = s.shopHeaderAlignment ?? 'center';
      shopHeaderShowBreadcrumbs = s.shopHeaderShowBreadcrumbs ?? true;
      shopHeaderShowTitle = s.shopHeaderShowTitle ?? true;
      shopHeaderShowCategories = s.shopHeaderShowCategories ?? true;
      shopHeaderShowCount = s.shopHeaderShowCount ?? true;
      shopHeaderShowSideMenuTab = s.shopHeaderShowSideMenuTab ?? false;
      shopHeaderCategoryLimit = s.shopHeaderCategoryLimit ?? '8';
      shopMenuLabel = s.shopMenuLabel ?? 'Menu';
      shopDefaultSort = s.shopDefaultSort ?? 'createdAt_desc';
      shopDefaultInventoryStatus = s.shopDefaultInventoryStatus ?? '';
      shopToolbarStyle = s.shopToolbarStyle ?? 'minimal';
      shopToolbarCorners = s.shopToolbarCorners ?? 'square';
      shopToolbarDensity = s.shopToolbarDensity ?? 'comfortable';
    } catch (e) {
      console.error('Failed to load shop page settings:', e);
      notificationStore.error(t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  async function saveAll() {
    saving = true;
    try {
      await settingsStore.updateMultiple({
        shopGridColumns,
        shopGridGap,
        shopCardAspectRatio,
        shopCardHoverImage,
        shopCardHoverAnimation,
        shopCardVideoSupport,
        shopCardShowQuickAdd,
        shopHeaderStyle,
        shopHeaderSpacing,
        shopHeaderTitleScale,
        shopHeaderAlignment,
        shopHeaderShowBreadcrumbs,
        shopHeaderShowTitle,
        shopHeaderShowCategories,
        shopHeaderShowCount,
        shopHeaderShowSideMenuTab,
        shopHeaderCategoryLimit,
        shopMenuLabel,
        shopDefaultSort,
        shopDefaultInventoryStatus,
        shopToolbarStyle,
        shopToolbarCorners,
        shopToolbarDensity,
      });
      notificationStore.success(t('shopPageDesign.settingsSaved'));
    } catch (e) {
      notificationStore.error(t('error.failedToSave'));
      console.error('Failed to save shop page settings:', e);
    } finally {
      saving = false;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <div>
      <h2 class="text-3xl font-bold">{t('shopPageDesign.title')}</h2>
      <p class="text-accent-muted mt-2">{t('shopPageDesign.description')}</p>
    </div>
    <button
      on:click={saveAll}
      disabled={saving || loading}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
    >
      {saving ? t('common.saving') : t('shopPageDesign.saveSettings')}
    </button>
  </div>

  {#if loading}
    <div class="w-full py-12">
      <LoadingBar />
    </div>
  {:else}
    <div class="space-y-8">
      <!-- Grid -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('shopPageDesign.gridTitle')}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label for="shop-grid-columns" class="block text-sm font-medium mb-2"
              >{t('shopPageDesign.gridColumns')}</label
            >
            <select
              id="shop-grid-columns"
              bind:value={shopGridColumns}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each gridColumnsOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-grid-gap" class="block text-sm font-medium mb-2"
              >{t('shopPageDesign.gridGap')}</label
            >
            <select
              id="shop-grid-gap"
              bind:value={shopGridGap}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each gridGapOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-card-aspect-ratio" class="block text-sm font-medium mb-2"
              >{t('shopPageDesign.cardAspectRatio')}</label
            >
            <select
              id="shop-card-aspect-ratio"
              bind:value={shopCardAspectRatio}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each aspectRatioOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- Card: hover & media -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('shopPageDesign.cardTitle')}</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{t('shopPageDesign.hoverImage')}</p>
              <p class="text-sm text-accent-muted">{t('shopPageDesign.hoverImageHint')}</p>
            </div>
            <label for="shop-hover-image" class="relative inline-flex items-center cursor-pointer">
              <input
                id="shop-hover-image"
                type="checkbox"
                bind:checked={shopCardHoverImage}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
          <div>
            <label for="shop-hover-animation" class="block text-sm font-medium mb-2"
              >{t('shopPageDesign.hoverAnimation')}</label
            >
            <select
              id="shop-hover-animation"
              bind:value={shopCardHoverAnimation}
              class="w-full max-w-xs px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each hoverAnimationOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
            <p class="text-sm text-accent-muted mt-1">{t('shopPageDesign.hoverAnimationHint')}</p>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{t('shopPageDesign.videoSupport')}</p>
              <p class="text-sm text-accent-muted">{t('shopPageDesign.videoSupportHint')}</p>
            </div>
            <label
              for="shop-video-support"
              class="relative inline-flex items-center cursor-pointer"
            >
              <input
                id="shop-video-support"
                type="checkbox"
                bind:checked={shopCardVideoSupport}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{t('shopPageDesign.showQuickAdd')}</p>
              <p class="text-sm text-accent-muted">{t('shopPageDesign.showQuickAddHint')}</p>
            </div>
            <label for="shop-quick-add" class="relative inline-flex items-center cursor-pointer">
              <input
                id="shop-quick-add"
                type="checkbox"
                bind:checked={shopCardShowQuickAdd}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
        </div>
      </div>

      <div class="bg-dark-light p-6">
        <div class="mb-5">
          <h3 class="text-xl font-medium">Shop Header Block</h3>
          <p class="text-sm text-accent-muted mt-2">
            Control the full top block on `/shop`: breadcrumbs, title, filter row, and product
            count.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label for="shop-header-style" class="block text-sm font-medium mb-2"
              >Header style</label
            >
            <select
              id="shop-header-style"
              bind:value={shopHeaderStyle}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each headerStyleOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-header-spacing" class="block text-sm font-medium mb-2"
              >Header spacing</label
            >
            <select
              id="shop-header-spacing"
              bind:value={shopHeaderSpacing}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each headerSpacingOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-header-title-scale" class="block text-sm font-medium mb-2"
              >Title size</label
            >
            <select
              id="shop-header-title-scale"
              bind:value={shopHeaderTitleScale}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each headerTitleScaleOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-header-alignment" class="block text-sm font-medium mb-2"
              >Alignment</label
            >
            <select
              id="shop-header-alignment"
              bind:value={shopHeaderAlignment}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each headerAlignmentOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-header-category-limit" class="block text-sm font-medium mb-2"
              >Category limit</label
            >
            <select
              id="shop-header-category-limit"
              bind:value={shopHeaderCategoryLimit}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each headerCategoryLimitOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
          <label class="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" bind:checked={shopHeaderShowBreadcrumbs} class="h-4 w-4" />
            Breadcrumbs
          </label>
          <label class="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" bind:checked={shopHeaderShowTitle} class="h-4 w-4" />
            Title
          </label>
          <label class="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" bind:checked={shopHeaderShowCategories} class="h-4 w-4" />
            Categories
          </label>
          <label class="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" bind:checked={shopHeaderShowCount} class="h-4 w-4" />
            Product count
          </label>
          <label class="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" bind:checked={shopHeaderShowSideMenuTab} class="h-4 w-4" />
            Side menu tab
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label for="shop-toolbar-style" class="block text-sm font-medium mb-2"
              >Toolbar style</label
            >
            <select
              id="shop-toolbar-style"
              bind:value={shopToolbarStyle}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each toolbarStyleOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-toolbar-corners" class="block text-sm font-medium mb-2">Corners</label>
            <select
              id="shop-toolbar-corners"
              bind:value={shopToolbarCorners}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each toolbarCornerOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-toolbar-density" class="block text-sm font-medium mb-2">Spacing</label>
            <select
              id="shop-toolbar-density"
              bind:value={shopToolbarDensity}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each toolbarDensityOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label for="shop-menu-label" class="block text-sm font-medium mb-2"
              >Menu button label</label
            >
            <input
              id="shop-menu-label"
              bind:value={shopMenuLabel}
              maxlength="24"
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
              placeholder="Menu"
            />
          </div>
          <div>
            <label for="shop-default-sort" class="block text-sm font-medium mb-2"
              >Default sort</label
            >
            <select
              id="shop-default-sort"
              bind:value={shopDefaultSort}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each defaultSortOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="shop-default-status" class="block text-sm font-medium mb-2"
              >Default status</label
            >
            <select
              id="shop-default-status"
              bind:value={shopDefaultInventoryStatus}
              class="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:border-accent"
            >
              {#each defaultInventoryStatusOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6">
          <div class="border border-accent/10 bg-background-secondary p-5 text-accent shadow-sm">
            <div
              class="{previewHeaderWrapperClass} {previewToolbarCornerClass} {previewHeaderSpacingClass} {previewHeaderAlignmentClass}"
            >
              {#if shopHeaderShowBreadcrumbs}
                <nav class="text-sm text-accent-muted">
                  Home <span class="mx-2">{'>'}</span> Showcase Category
                </nav>
              {/if}

              {#if shopHeaderShowTitle}
                <h4
                  class="font-semibold leading-none tracking-[-0.04em] text-accent {previewHeaderTitleScaleClass}"
                >
                  Showcase Category
                </h4>
              {/if}

              {#if shopHeaderShowCategories || shopHeaderShowSideMenuTab}
                <div class="flex items-start gap-3">
                  {#if shopHeaderShowSideMenuTab}
                    <button
                      type="button"
                      class="shrink-0 inline-flex items-center justify-center whitespace-nowrap border border-black bg-white px-4 py-2 text-sm font-medium text-black {previewToolbarCornerClass}"
                    >
                      {shopMenuLabel || 'Menu'}
                    </button>
                  {/if}

                  {#if shopHeaderShowCategories}
                    <div class="min-w-0 flex-1">
                      <div
                        class="flex flex-wrap items-center gap-2 md:gap-3 {previewHeaderCategoriesJustifyClass} {previewToolbarWrapperClass}"
                      >
                        {#each quickCategoryFilters.slice(0, previewHeaderCategoryLimit) as filterLabel, index}
                          <div
                            class="border transition-colors {previewToolbarCornerClass} {previewToolbarDensityClass} {index ===
                            0
                              ? 'border-accent bg-accent text-dark'
                              : previewToolbarChipClass}"
                          >
                            {filterLabel}
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if shopHeaderShowSideMenuTab && shopHeaderAlignment === 'center'}
                    <div
                      class="shrink-0 invisible inline-flex items-center justify-center whitespace-nowrap border border-black px-4 py-2 text-sm font-medium {previewToolbarCornerClass}"
                      aria-hidden="true"
                    >
                      {shopMenuLabel || 'Menu'}
                    </div>
                  {/if}
                </div>
              {/if}

              {#if shopHeaderShowCount}
                <p class="text-sm text-accent-muted">Found 1 product</p>
              {/if}
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6">
            <div class="border border-accent/10 bg-background text-accent shadow-sm">
              <div class="flex items-center justify-between px-4 py-4 border-b border-accent/10">
                <div>
                  <p class="text-xs uppercase tracking-[0.24em] text-accent-muted">
                    Desktop sidebar
                  </p>
                  <h4 class="text-lg font-semibold mt-1">{t('filter.category')}</h4>
                </div>
                <button
                  class="text-xs uppercase tracking-[0.16em] text-accent-muted hover:text-accent transition-colors"
                >
                  {t('filter.reset')}
                </button>
              </div>

              <div class="p-4 space-y-4">
                <label
                  class="block text-xs uppercase tracking-[0.18em] text-accent-muted"
                  for="category-filter-preview-search"
                >
                  {t('filter.searchCategories')}
                </label>
                <div class="relative">
                  <input
                    id="category-filter-preview-search"
                    type="text"
                    value=""
                    placeholder={t('filter.searchCategories')}
                    readonly
                    class="w-full bg-background-secondary focus:outline-none {previewToolbarControlClass} {previewToolbarCornerClass} {previewToolbarDensityClass}"
                  />
                  <span
                    class="absolute inset-y-0 right-4 flex items-center text-xs uppercase tracking-[0.16em] text-accent-muted"
                  >
                    Search
                  </span>
                </div>

                <div
                  class="border border-accent bg-accent font-medium text-dark {previewToolbarCornerClass} {previewToolbarDensityClass}"
                >
                  {t('filter.allCategories')}
                </div>

                <div class="space-y-4">
                  {#each previewCategoryGroups as group}
                    <div class="space-y-2">
                      <p class="text-xs uppercase tracking-[0.18em] text-accent-muted">
                        {group.title}
                      </p>
                      <div class="space-y-1">
                        {#each group.items as item}
                          <div
                            class="border transition-colors {previewToolbarCornerClass} {previewToolbarDensityClass} {item.active
                              ? 'border-accent bg-accent text-dark'
                              : 'border-transparent bg-background-secondary text-accent'}"
                          >
                            {item.label}
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <div
                class="border border-accent/10 bg-background-secondary p-5 text-accent shadow-sm"
              >
                <div class="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p class="text-xs uppercase tracking-[0.24em] text-accent-muted">
                      Quick filters row
                    </p>
                    <h4 class="text-lg font-semibold mt-1">Category chips</h4>
                  </div>
                  <div class="text-sm text-accent-muted">Centered categories only</div>
                </div>

                <div class={previewToolbarWrapperClass}>
                  <div class="flex flex-wrap justify-center gap-2">
                    {#each quickCategoryFilters as filterLabel, index}
                      <div
                        class="border transition-colors {previewToolbarCornerClass} {previewToolbarDensityClass} {index ===
                        0
                          ? 'border-accent bg-accent text-dark'
                          : previewToolbarChipClass}"
                      >
                        {filterLabel}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>

              <div class="border border-accent/10 bg-background p-5 text-accent shadow-sm">
                <p class="text-xs uppercase tracking-[0.24em] text-accent-muted">Mobile drawer</p>
                <div
                  class="mt-4 max-w-sm rounded-[28px] border border-accent/10 bg-background p-4 shadow-[0_18px_50px_rgba(0,0,0,0.08)]"
                >
                  <div class="flex items-center justify-between border-b border-accent/10 pb-3">
                    <h4 class="text-base font-semibold">{t('filter.filters')}</h4>
                    <div
                      class="grid h-8 w-8 place-items-center rounded-full bg-background-secondary text-lg"
                    >
                      x
                    </div>
                  </div>

                  <div class="mt-4 space-y-3">
                    <div
                      class="rounded-[20px] border border-accent bg-accent px-4 py-3 text-sm text-dark"
                    >
                      {t('filter.allCategories')}
                    </div>
                    <div
                      class="rounded-[20px] bg-background-secondary px-4 py-3 text-sm text-accent"
                    >
                      Women / New arrivals
                    </div>
                    <div
                      class="rounded-[20px] bg-background-secondary px-4 py-3 text-sm text-accent"
                    >
                      Women / Dresses
                    </div>
                    <div
                      class="rounded-[20px] bg-background-secondary px-4 py-3 text-sm text-accent"
                    >
                      Men / Shirts
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="text-sm text-accent-muted">
        {t('shopPageDesign.previewHint')}
        <a
          href="/shop"
          target="_blank"
          rel="noopener"
          class="text-accent underline hover:no-underline">/shop</a
        >
      </p>
    </div>
  {/if}
</div>
