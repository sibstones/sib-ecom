<script lang="ts">
  import type { Product } from '$lib/api/product.api';
  import { t } from '$lib/utils/i18n';
  import { settingsStore } from '$lib/stores/settings.store';

  export let product: Product;

  type TabId = 'description' | 'application' | 'composition' | 'brand' | 'additional';
  interface TabItem {
    id: TabId;
    labelKey: string;
    hasContent: boolean;
  }

  $: hasDescription = product.description != null && String(product.description).trim() !== '';
  $: hasApplication = product.application != null && String(product.application).trim() !== '';
  $: hasComposition =
    (product.material != null && !product.hideMaterial && String(product.material).trim() !== '') ||
    (product.lining != null && !product.hideLining && String(product.lining).trim() !== '');
  $: hasBrand = product.brand != null && $settingsStore?.brandsEnabled !== false;
  $: hasAdditional =
    (product.countryOfOrigin != null &&
      !product.hideCountryOfOrigin &&
      String(product.countryOfOrigin).trim() !== '') ||
    (product.weightNet != null &&
      product.weightNet !== undefined &&
      Number(product.weightNet) > 0) ||
    (product.weightGross != null &&
      product.weightGross !== undefined &&
      Number(product.weightGross) > 0);

  $: tabsList = [
    { id: 'description', labelKey: 'productPage.tabDescription', hasContent: hasDescription },
    { id: 'application', labelKey: 'productPage.tabApplication', hasContent: hasApplication },
    { id: 'composition', labelKey: 'productPage.tabComposition', hasContent: hasComposition },
    { id: 'brand', labelKey: 'productPage.tabBrand', hasContent: hasBrand },
    { id: 'additional', labelKey: 'productPage.tabAdditionalInfo', hasContent: hasAdditional },
  ] satisfies TabItem[];

  $: visibleTabs = tabsList.filter((tab) => tab.hasContent);
  $: hasAnyTab = visibleTabs.length > 0;

  let activeTab: TabId = 'description';
  $: if (hasAnyTab && visibleTabs[0] && !visibleTabs.some((t) => t.id === activeTab)) {
    activeTab = visibleTabs[0].id;
  }
</script>

{#if hasAnyTab}
  <div class="product-info-tabs border-t border-gray-200 pt-6 mt-6">
    <nav
      class="flex flex-wrap gap-4 border-b border-gray-200 mb-4"
      aria-label="Product information tabs"
    >
      {#each visibleTabs as tab (tab.id)}
        <button
          type="button"
          on:click={() => (activeTab = tab.id)}
          class="pb-3 text-sm font-medium uppercase tracking-wide transition-colors border-b-2 -mb-px {activeTab ===
          tab.id
            ? 'border-black text-black'
            : 'border-transparent text-gray-500 hover:text-gray-700'}"
        >
          {t(tab.labelKey)}
        </button>
      {/each}
    </nav>
    <div class="text-sm text-gray-700">
      {#if activeTab === 'description' && hasDescription}
        <p class="whitespace-pre-line leading-relaxed">{product.description}</p>
      {:else if activeTab === 'application' && hasApplication}
        <p class="whitespace-pre-line leading-relaxed">{product.application}</p>
      {:else if activeTab === 'composition' && hasComposition}
        <div class="space-y-2">
          {#if product.material && !product.hideMaterial}
            <div class="flex items-start justify-between gap-4">
              <span class="text-gray-500">{t('product.material')}:</span>
              <span class="flex-1 text-left text-black whitespace-pre-line break-words"
                >{product.material}</span
              >
            </div>
          {/if}
          {#if product.lining && !product.hideLining}
            <div class="flex items-start justify-between gap-4">
              <span class="text-gray-500">{t('product.lining')}:</span>
              <span class="flex-1 text-left text-black whitespace-pre-line break-words"
                >{product.lining}</span
              >
            </div>
          {/if}
        </div>
      {:else if activeTab === 'brand' && hasBrand && product.brand}
        <p class="leading-relaxed">{product.brand.name}</p>
      {:else if activeTab === 'additional' && hasAdditional}
        <div class="space-y-2">
          {#if product.countryOfOrigin && !product.hideCountryOfOrigin}
            <div class="flex items-start justify-between gap-4">
              <span class="text-gray-500">{t('product.countryOfOrigin')}:</span>
              <span class="flex-1 text-right text-black whitespace-pre-line break-words"
                >{product.countryOfOrigin}</span
              >
            </div>
          {/if}
          {#if product.weightNet != null && product.weightNet !== undefined && Number(product.weightNet) > 0}
            <div class="flex justify-between gap-4">
              <span class="text-gray-500">{t('product.weightNet')}:</span>
              <span class="text-black">{product.weightNet} kg</span>
            </div>
          {/if}
          {#if product.weightGross != null && product.weightGross !== undefined && Number(product.weightGross) > 0}
            <div class="flex justify-between gap-4">
              <span class="text-gray-500">{t('product.weightGross')}:</span>
              <span class="text-black">{product.weightGross} kg</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
