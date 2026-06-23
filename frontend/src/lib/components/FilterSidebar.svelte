<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import CustomSelect from './CustomSelect.svelte';
  import type { Category, Brand } from '$lib/api/product.api';
  import { settingsStore } from '$lib/stores/settings.store';
  import { t } from '$lib/utils/i18n';

  let mobilePortalRef: HTMLDivElement | undefined;
  let portalOriginalParent: Node | null = null;
  $: if (browser && mobile) {
    tick().then(() => {
      if (mobilePortalRef && mobilePortalRef.parentNode !== document.body) {
        portalOriginalParent = mobilePortalRef.parentNode;
        document.body.appendChild(mobilePortalRef);
      }
    });
  }
  $: if (
    browser &&
    !mobile &&
    mobilePortalRef?.parentNode === document.body &&
    portalOriginalParent
  ) {
    portalOriginalParent.appendChild(mobilePortalRef);
    portalOriginalParent = null;
  }
  onDestroy(() => {
    if (mobilePortalRef && mobilePortalRef.parentNode === document.body) {
      document.body.removeChild(mobilePortalRef);
    }
  });

  export let categories: Category[] = [];
  export let brands: Brand[] = [];
  export let selectedCategory: string = '';
  export let selectedBrand: string = '';
  export let minPrice: string = '';
  export let maxPrice: string = '';
  export let searchQuery: string = '';
  export let selectedColor: string = '';
  export let selectedMaterial: string = '';
  export let selectedCountryOfOrigin: string = '';
  export let selectedSize: string = '';
  export let selectedInventoryStatus: '' | 'IN_SALE' | 'COMING_SOON' | 'OUT_OF_STOCK' = '';
  export let availableColors: string[] = [];
  export let availableMaterials: string[] = [];
  export let availableCountries: string[] = [];
  export let availableSizes: string[] = [];
  export let sortField: 'price' | 'createdAt' | 'name' = 'createdAt';
  export let open: boolean = false;
  export let mobile: boolean = false;

  const dispatch = createEventDispatcher<{
    filterChange: void;
    sortChange: { value: string | number };
    close: void;
  }>();

  let categorySearch = '';
  let brandSearch = '';
  let filteredCategories: Category[] = [];
  let filteredBrands: Brand[] = [];

  // Subcategory with optional sub-subcategories (3-level hierarchy)
  type SubcategoryGroup = { sub: Category; subChildren: Category[] };

  // Group categories by main category with full hierarchy (main → sub → sub-sub)
  function getGroupedCategories(
    cats: Category[]
  ): Array<{ main: Category; children: SubcategoryGroup[] }> {
    const mainCategories = cats
      .filter((c) => c.isMain)
      .sort((a, b) => a.name.localeCompare(b.name));
    return mainCategories.map((main) => {
      const subcategories = cats
        .filter((c) => !c.isMain && c.parentId === main.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      const children: SubcategoryGroup[] = subcategories.map((sub) => ({
        sub,
        subChildren: cats
          .filter((c) => !c.isMain && c.parentId === sub.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
      return { main, children };
    });
  }

  // Find main category for a given category (uses provided list for parent resolution)
  function findMainCategoryIn(category: Category, cats: Category[]): Category | null {
    if (category.isMain) return category;
    if (!category.parentId) return null;
    const parent = cats.find((c) => c.id === category.parentId);
    if (!parent) return null;
    if (parent.isMain) return parent;
    return findMainCategoryIn(parent, cats);
  }

  // Only categories that have no main ancestor (truly orphaned), not sub-subcategories
  function getOrphanedCategories(cats: Category[]): Category[] {
    return cats
      .filter((c) => {
        if (c.isMain) return false;
        return findMainCategoryIn(c, cats) === null;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function findMainCategory(category: Category): Category | null {
    return findMainCategoryIn(category, categories);
  }

  $: {
    if (categorySearch) {
      // When searching, show flat list
      filteredCategories = categories.filter((cat) =>
        cat.name.toLowerCase().includes(categorySearch.toLowerCase())
      );
    } else {
      filteredCategories = categories;
    }
  }

  $: {
    if (brandSearch) {
      filteredBrands = brands.filter((brand) =>
        brand.name.toLowerCase().includes(brandSearch.toLowerCase())
      );
    } else {
      filteredBrands = brands;
    }
  }

  function handleCategoryChange(value: string) {
    selectedCategory = value;
    dispatch('filterChange');
  }

  function handleBrandChange(value: string) {
    selectedBrand = value;
    dispatch('filterChange');
  }

  function handlePriceChange() {
    dispatch('filterChange');
  }

  function handleSearchChange() {
    dispatch('filterChange');
  }

  function handleColorChange(value: string) {
    selectedColor = value;
    dispatch('filterChange');
  }

  function handleMaterialChange(value: string) {
    selectedMaterial = value;
    dispatch('filterChange');
  }

  function handleCountryChange(value: string) {
    selectedCountryOfOrigin = value;
    dispatch('filterChange');
  }

  function handleSizeChange(value: string) {
    selectedSize = value;
    dispatch('filterChange');
  }

  function handleInventoryStatusChange(value: '' | 'IN_SALE' | 'COMING_SOON' | 'OUT_OF_STOCK') {
    selectedInventoryStatus = value;
    dispatch('filterChange');
  }

  function handleSortChange(event: CustomEvent<{ value: string | number }>) {
    sortField = event.detail.value as 'price' | 'createdAt' | 'name';
    dispatch('sortChange', { value: event.detail.value });
  }

  function closeSidebar() {
    open = false;
    dispatch('close');
  }

  function resetFilters() {
    selectedCategory = '';
    selectedBrand = '';
    minPrice = '';
    maxPrice = '';
    searchQuery = '';
    selectedColor = '';
    selectedMaterial = '';
    selectedCountryOfOrigin = '';
    selectedSize = '';
    selectedInventoryStatus = '';
    categorySearch = '';
    brandSearch = '';
    dispatch('filterChange');
  }
</script>

<!-- Wrapper: when mobile, moved to body so sidebar is above header (z-40) -->
<div
  bind:this={mobilePortalRef}
  class="filter-sidebar-wrapper"
  class:filter-sidebar-mobile-portal={mobile}
>
  {#if mobile}
    <button
      type="button"
      class="sidebar-overlay fixed inset-0 bg-black/30 md:hidden {open
        ? 'overlay-open'
        : 'overlay-closed'}"
      on:click={closeSidebar}
      aria-label={t('common.close')}
    ></button>
  {/if}
  <aside
    class="bg-white p-6 {mobile
      ? 'sidebar-mobile h-full w-full max-w-full overflow-y-auto border-r border-gray-200 shadow-sm ' +
        (!open ? 'sidebar-closed pointer-events-none' : 'sidebar-open')
      : 'sticky top-4 border border-gray-200 shadow-sm'}"
  >
    <!-- Mobile Header -->
    {#if mobile}
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <h2 class="text-xl font-bold text-black">{t('filter.filters')}</h2>
        <button
          on:click={closeSidebar}
          class="text-gray-600 hover:text-black transition-colors"
          aria-label="Close filters"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    {/if}

    <!-- Desktop Header -->
    {#if !mobile}
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <h2 class="text-xl font-bold text-black">{t('filter.filters')}</h2>
        <button
          on:click={resetFilters}
          class="text-sm text-gray-600 hover:text-black transition-colors"
        >
          {t('filter.reset')}
        </button>
      </div>
    {/if}

    <div class="space-y-6">
      <!-- Search -->
      {#if $settingsStore.searchEnabled}
        <div>
          <label class="block text-sm font-medium text-black mb-2" for="filter-search-products"
            >{t('filter.searchProducts')}</label
          >
          <input
            id="filter-search-products"
            type="text"
            bind:value={searchQuery}
            on:input={handleSearchChange}
            placeholder={t('filter.searchProductsPlaceholder')}
            class="w-full px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:border-black text-black"
          />
        </div>
      {/if}

      <!-- Sort -->
      <div>
        <label class="block text-sm font-medium text-black mb-2" for="filter-sort-select"
          >{t('filter.sortBy')}</label
        >
        <CustomSelect
          id="filter-sort-select"
          bind:value={sortField}
          options={[
            { value: 'createdAt', label: t('filter.newest') },
            { value: 'price', label: t('common.price') },
            { value: 'name', label: t('common.name') },
          ]}
          on:change={handleSortChange}
          searchable={false}
        />
      </div>

      <!-- Availability Filter -->
      <div>
        <h3 class="block text-sm font-medium text-black mb-2">{t('warehouse.allStatuses')}</h3>
        <div class="space-y-1">
          <button
            type="button"
            on:click={() => handleInventoryStatusChange('')}
            class="w-full text-left px-3 py-2 text-sm transition-colors {selectedInventoryStatus ===
            ''
              ? 'bg-black text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
          >
            {t('warehouse.allStatuses')}
          </button>
          <button
            type="button"
            on:click={() => handleInventoryStatusChange('COMING_SOON')}
            class="w-full text-left px-3 py-2 text-sm transition-colors {selectedInventoryStatus ===
            'COMING_SOON'
              ? 'bg-black text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
          >
            {t('warehouse.comingSoon')}
          </button>
          <button
            type="button"
            on:click={() => handleInventoryStatusChange('IN_SALE')}
            class="w-full text-left px-3 py-2 text-sm transition-colors {selectedInventoryStatus ===
            'IN_SALE'
              ? 'bg-black text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
          >
            {t('warehouse.inSale')}
          </button>
          <button
            type="button"
            on:click={() => handleInventoryStatusChange('OUT_OF_STOCK')}
            class="w-full text-left px-3 py-2 text-sm transition-colors {selectedInventoryStatus ===
            'OUT_OF_STOCK'
              ? 'bg-black text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
          >
            {t('warehouse.outOfStock')}
          </button>
        </div>
      </div>

      <!-- Size Filter (INTERNATIONAL clothing only) -->
      {#if availableSizes.length > 0}
        <div>
          <h3 class="block text-sm font-medium text-black mb-2">{t('filter.size')}</h3>
          <div class="max-h-48 overflow-y-auto space-y-1 custom-select-dropdown">
            <button
              type="button"
              on:click={() => handleSizeChange('')}
              class="w-full text-left px-3 py-2 text-sm transition-colors {selectedSize === ''
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
            >
              {t('filter.allSizes')}
            </button>
            {#each availableSizes as size}
              <button
                type="button"
                on:click={() => handleSizeChange(size)}
                class="w-full text-left px-3 py-2 text-sm transition-colors {selectedSize === size
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
              >
                {size}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Categories -->
      {#if $settingsStore.categoryFilterEnabled}
        <div>
          <h3 class="block text-sm font-medium text-black mb-2">{t('filter.category')}</h3>
          <div class="space-y-2">
            <input
              type="text"
              bind:value={categorySearch}
              placeholder={t('filter.searchCategories')}
              class="w-full px-3 py-1.5 bg-white border border-gray-300 text-sm text-black focus:outline-none focus:border-black"
            />
            <div class="max-h-48 overflow-y-auto space-y-1 custom-select-dropdown">
              <button
                type="button"
                on:click={() => {
                  selectedCategory = '';
                  categorySearch = '';
                  handleCategoryChange('');
                }}
                class="w-full text-left px-3 py-2 text-sm transition-colors {selectedCategory === ''
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
              >
                {t('filter.allCategories')}
              </button>
              {#if categorySearch}
                <!-- Flat list when searching -->
                {#each filteredCategories as category}
                  <button
                    type="button"
                    on:click={() => {
                      selectedCategory = category.id;
                      categorySearch = '';
                      handleCategoryChange(category.id);
                    }}
                    class="w-full text-left px-3 py-2 text-sm transition-colors {selectedCategory ===
                    category.id
                      ? 'bg-black text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
                  >
                    {category.name}
                  </button>
                {/each}
                {#if filteredCategories.length === 0}
                  <div class="px-3 py-2 text-sm text-gray-500">{t('filter.noCategoriesFound')}</div>
                {/if}
              {:else}
                <!-- Hierarchical display when not searching -->
                {@const groupedCategories = getGroupedCategories(filteredCategories)}
                {@const orphanedCategories = getOrphanedCategories(filteredCategories)}
                {#each groupedCategories as group}
                  <!-- Main Category -->
                  <button
                    type="button"
                    on:click={() => {
                      selectedCategory = group.main.id;
                      categorySearch = '';
                      handleCategoryChange(group.main.id);
                    }}
                    class="w-full text-left px-3 py-2 text-sm font-medium transition-colors {selectedCategory ===
                    group.main.id
                      ? 'bg-black text-white'
                      : 'text-gray-900 hover:bg-gray-100 hover:text-black'}"
                  >
                    {group.main.name}
                  </button>
                  <!-- Subcategories and sub-subcategories with indent -->
                  {#each group.children as { sub, subChildren }}
                    <button
                      type="button"
                      on:click={() => {
                        selectedCategory = sub.id;
                        categorySearch = '';
                        handleCategoryChange(sub.id);
                      }}
                      class="w-full text-left px-3 py-2 pl-6 text-sm transition-colors {selectedCategory ===
                      sub.id
                        ? 'bg-black text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
                    >
                      {sub.name}
                    </button>
                    <!-- Sub-subcategories (e.g. COATS under FOR HIM/FOR HER) -->
                    {#each subChildren as subSub}
                      <button
                        type="button"
                        on:click={() => {
                          selectedCategory = subSub.id;
                          categorySearch = '';
                          handleCategoryChange(subSub.id);
                        }}
                        class="w-full text-left px-3 py-2 pl-9 text-sm transition-colors {selectedCategory ===
                        subSub.id
                          ? 'bg-black text-white'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-black'}"
                      >
                        {subSub.name}
                      </button>
                    {/each}
                  {/each}
                {/each}
                <!-- Orphaned categories (categories without main category) -->
                {#if orphanedCategories.length > 0}
                  {#each orphanedCategories as category}
                    <button
                      type="button"
                      on:click={() => {
                        selectedCategory = category.id;
                        categorySearch = '';
                        handleCategoryChange(category.id);
                      }}
                      class="w-full text-left px-3 py-2 text-sm transition-colors {selectedCategory ===
                      category.id
                        ? 'bg-black text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
                    >
                      {category.name}
                    </button>
                  {/each}
                {/if}
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Brands -->
      {#if $settingsStore.brandFilterEnabled && $settingsStore.brandsEnabled && $settingsStore.showBrandFilter}
        <div>
          <h3 class="block text-sm font-medium text-black mb-2">{t('product.brand')}</h3>
          <div class="space-y-2">
            <input
              type="text"
              bind:value={brandSearch}
              placeholder={t('filter.searchBrands')}
              class="w-full px-3 py-1.5 bg-white border border-gray-300 text-sm text-black focus:outline-none focus:border-black"
            />
            <div class="max-h-48 overflow-y-auto space-y-1 custom-select-dropdown">
              <button
                type="button"
                on:click={() => {
                  selectedBrand = '';
                  brandSearch = '';
                  handleBrandChange('');
                }}
                class="w-full text-left px-3 py-2 text-sm transition-colors {selectedBrand === ''
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
              >
                {t('filter.allBrands')}
              </button>
              {#each filteredBrands as brand}
                <button
                  type="button"
                  on:click={() => {
                    selectedBrand = brand.id;
                    brandSearch = '';
                    handleBrandChange(brand.id);
                  }}
                  class="w-full text-left px-3 py-2 text-sm transition-colors {selectedBrand ===
                  brand.id
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
                >
                  {brand.name}
                </button>
              {/each}
              {#if filteredBrands.length === 0 && brandSearch}
                <div class="px-3 py-2 text-sm text-gray-500">{t('filter.noBrandsFound')}</div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Price Range -->
      {#if $settingsStore.priceFilterEnabled}
        <div>
          <h3 class="block text-sm font-medium text-black mb-2">{t('filter.priceRange')}</h3>
          <div class="space-y-2">
            <input
              type="number"
              bind:value={minPrice}
              on:input={handlePriceChange}
              placeholder={t('filter.minPrice')}
              class="w-full px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:border-black text-black"
            />
            <input
              type="number"
              bind:value={maxPrice}
              on:input={handlePriceChange}
              placeholder={t('filter.maxPrice')}
              class="w-full px-4 py-2 bg-white border border-gray-300 focus:outline-none focus:border-black text-black"
            />
          </div>
        </div>
      {/if}

      <!-- Color Filter -->
      {#if availableColors.length > 0}
        <div>
          <h3 class="block text-sm font-medium text-black mb-2">{t('filter.color')}</h3>
          <div class="max-h-48 overflow-y-auto space-y-1 custom-select-dropdown">
            <button
              type="button"
              on:click={() => handleColorChange('')}
              class="w-full text-left px-3 py-2 text-sm transition-colors {selectedColor === ''
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
            >
              {t('filter.allColors')}
            </button>
            {#each availableColors as color}
              <button
                type="button"
                on:click={() => handleColorChange(color)}
                class="w-full text-left px-3 py-2 text-sm transition-colors {selectedColor === color
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
              >
                {color}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Material Filter -->
      {#if availableMaterials.length > 0}
        <div>
          <h3 class="block text-sm font-medium text-black mb-2">{t('filter.material')}</h3>
          <div class="max-h-48 overflow-y-auto space-y-1 custom-select-dropdown">
            <button
              type="button"
              on:click={() => handleMaterialChange('')}
              class="w-full text-left px-3 py-2 text-sm transition-colors {selectedMaterial === ''
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
            >
              {t('filter.allMaterials')}
            </button>
            {#each availableMaterials as material}
              <button
                type="button"
                on:click={() => handleMaterialChange(material)}
                class="w-full text-left px-3 py-2 text-sm transition-colors {selectedMaterial ===
                material
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
              >
                {material}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Country of Origin Filter -->
      {#if availableCountries.length > 0}
        <div>
          <h3 class="block text-sm font-medium text-black mb-2">{t('filter.countryOfOrigin')}</h3>
          <div class="max-h-48 overflow-y-auto space-y-1 custom-select-dropdown">
            <button
              type="button"
              on:click={() => handleCountryChange('')}
              class="w-full text-left px-3 py-2 text-sm transition-colors {selectedCountryOfOrigin ===
              ''
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
            >
              {t('filter.allCountries')}
            </button>
            {#each availableCountries as country}
              <button
                type="button"
                on:click={() => handleCountryChange(country)}
                class="w-full text-left px-3 py-2 text-sm transition-colors {selectedCountryOfOrigin ===
                country
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'}"
              >
                {country}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Mobile Reset Button -->
      {#if mobile}
        <button
          on:click={resetFilters}
          class="w-full py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 transition-colors"
        >
          {t('filter.resetFilters')}
        </button>
      {/if}
    </div>
  </aside>
</div>

<style>
  :global(.custom-select-dropdown) {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
  }

  :global(.custom-select-dropdown::-webkit-scrollbar) {
    width: 6px;
  }

  :global(.custom-select-dropdown::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.custom-select-dropdown::-webkit-scrollbar-thumb) {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  /* iOS-style smooth sidebar animation */
  :global(.sidebar-mobile) {
    will-change: transform, visibility;
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0s 0.4s;
  }

  :global(.sidebar-mobile.sidebar-open) {
    transform: translateX(0);
    visibility: visible;
    transition:
      transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0s;
  }

  :global(.sidebar-mobile.sidebar-closed) {
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform 0.35s cubic-bezier(0.4, 0, 1, 1),
      visibility 0s 0.35s;
  }

  /* Desktop: wrapper must not affect layout */
  :global(.filter-sidebar-wrapper:not(.filter-sidebar-mobile-portal)) {
    display: contents;
  }

  /* Portal: above header when moved to body (z-40) */
  :global(.filter-sidebar-mobile-portal) {
    position: fixed;
    inset: 0;
    z-index: 10000;
    pointer-events: none;
  }
  :global(.filter-sidebar-mobile-portal > .sidebar-overlay),
  :global(.filter-sidebar-mobile-portal > .sidebar-mobile) {
    pointer-events: auto;
  }

  /* On mobile, sidebar full screen overlay */
  @media (max-width: 768px) {
    :global(.sidebar-mobile) {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      max-width: 100vw;
      height: 100vh;
      min-height: 100dvh;
      z-index: 9998;
    }

    :global(.sidebar-overlay) {
      z-index: 9997;
    }
  }

  /* On desktop: narrow side panel (not full screen); full screen only on mobile */
  @media (min-width: 768px) {
    :global(.sidebar-mobile) {
      position: fixed !important;
      top: 40px !important; /* Header height (h-12 = 48px) */
      left: 0 !important;
      width: min(400px, 90vw) !important;
      max-width: 400px !important;
      height: calc(100vh - 40px) !important; /* Full height minus header */
      z-index: 9998 !important;
      /* Reset base transform/visibility for desktop - will be overridden by open/closed states */
      transform: translateX(-100%) !important;
      visibility: hidden !important;
    }

    :global(.sidebar-mobile.sidebar-open) {
      transform: translateX(0) !important;
      visibility: visible !important;
      transition:
        transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
        visibility 0s !important;
    }

    :global(.sidebar-mobile.sidebar-closed) {
      transform: translateX(-100%) !important;
      visibility: hidden !important;
      transition:
        transform 0.35s cubic-bezier(0.4, 0, 1, 1),
        visibility 0s 0.35s !important;
    }
  }

  /* iOS-style overlay fade animation */
  :global(.sidebar-overlay) {
    will-change: opacity;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(.sidebar-overlay.overlay-open) {
    opacity: 1;
    pointer-events: auto;
  }

  :global(.sidebar-overlay.overlay-closed) {
    opacity: 0;
    pointer-events: none;
  }
</style>
