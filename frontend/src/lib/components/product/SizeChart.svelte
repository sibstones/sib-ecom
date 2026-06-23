<script lang="ts">
  import { portal } from '$lib/utils/portal.utils';
  import { t } from '$lib/utils/i18n';

  export let sizeChartData: SizeChartData | null = null;
  export let enabled: boolean = false;
  export let showButton: boolean = true; // Show button/link, if false, only modal

  type SizeChartType = 'readyToWear' | 'shoes' | 'gloves';

  interface SizeChartData {
    enabled: boolean;
    mens?: {
      readyToWear: {
        headers: string[];
        rows: Array<{ label: string; values: string[] }>;
      };
      shoes: {
        headers: string[];
        rows: Array<{ label: string; values: string[] }>;
      };
      gloves: {
        headers: string[];
        rows: Array<{ label: string; values: string[] }>;
      };
    };
    womens?: {
      readyToWear: {
        headers: string[];
        rows: Array<{ label: string; values: string[] }>;
      };
      shoes: {
        headers: string[];
        rows: Array<{ label: string; values: string[] }>;
      };
      gloves: {
        headers: string[];
        rows: Array<{ label: string; values: string[] }>;
      };
    };
    // Legacy structure support
    readyToWear?: {
      headers: string[];
      rows: Array<{ label: string; values: string[] }>;
    };
    shoes?: {
      headers: string[];
      rows: Array<{ label: string; values: string[] }>;
    };
    gloves?: {
      headers: string[];
      rows: Array<{ label: string; values: string[] }>;
    };
  }

  let activeTab: SizeChartType = 'readyToWear';
  let activeGender: 'mens' | 'womens' = 'mens';
  let isOpen = false;

  // Get chart data with fallback for legacy structure
  $: chartData = (() => {
    if (!sizeChartData) return null;

    // New structure
    if (sizeChartData.mens || sizeChartData.womens) {
      return sizeChartData[activeGender];
    }

    // Legacy structure - use mens as default
    if (sizeChartData.readyToWear || sizeChartData.shoes || sizeChartData.gloves) {
      return {
        readyToWear: sizeChartData.readyToWear,
        shoes: sizeChartData.shoes,
        gloves: sizeChartData.gloves,
      };
    }

    return null;
  })();

  export function openChart() {
    if (!enabled || !sizeChartData || !sizeChartData.enabled) {
      console.warn('Size chart is not enabled or data is missing');
      return;
    }
    isOpen = true;
  }

  function closeChart() {
    isOpen = false;
  }

  function stopPropagation(e: MouseEvent) {
    e.stopPropagation();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      closeChart();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if enabled && sizeChartData && sizeChartData.enabled}
  {#if showButton}
    <div class="mt-6">
      <button
        on:click={openChart}
        class="text-sm underline text-accent-muted hover:text-accent transition-colors"
      >
        {t('productPage.sizeChartButton')}
      </button>
    </div>
  {/if}
{/if}

<!-- Overlay - portal renders it at body level to be above all elements -->
{#if isOpen}
  <div
    use:portal
    class="fixed inset-0 bg-black/50 flex items-center justify-center p-0 m-0"
    style="z-index: 99999; margin: 0; top: 0; left: 0; right: 0; bottom: 0; position: fixed;"
    role="dialog"
    aria-modal="true"
    aria-label={t('productPage.sizeChart')}
  >
    <button
      type="button"
      class="absolute inset-0 h-full w-full cursor-default bg-transparent"
      aria-hidden="true"
      tabindex="-1"
      on:click={closeChart}
    ></button>
    <!-- Modal -->
    <div
      class="relative z-10 bg-white w-full h-full overflow-y-auto m-0"
      style="z-index: 99999; margin: 0;"
    >
      <!-- Header -->
      <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex justify-between items-center mb-4">
          {#if sizeChartData?.mens && sizeChartData?.womens}
            <div class="flex gap-4">
              <button
                on:click={() => (activeGender = 'mens')}
                class="px-4 py-2 border-2 transition-colors {activeGender === 'mens'
                  ? 'border-black font-bold text-black bg-gray-50'
                  : 'border-gray-300 text-gray-500 hover:text-black'}"
              >
                {t('productPage.mens')}
              </button>
              <button
                on:click={() => (activeGender = 'womens')}
                class="px-4 py-2 border-2 transition-colors {activeGender === 'womens'
                  ? 'border-black font-bold text-black bg-gray-50'
                  : 'border-gray-300 text-gray-500 hover:text-black'}"
              >
                {t('productPage.womens')}
              </button>
            </div>
          {:else}
            <div></div>
          {/if}
          <button
            on:click={closeChart}
            class="text-gray-500 hover:text-black transition-colors"
            aria-label={t('common.close')}
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
        <h2 class="text-2xl font-bold uppercase">
          {#if sizeChartData?.mens && sizeChartData?.womens}
            {activeGender === 'mens'
              ? t('productPage.mensSizeChart')
              : t('productPage.womensSizeChart')}
          {:else}
            {t('productPage.sizeChart')}
          {/if}
        </h2>
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 px-6">
        <div class="flex gap-6">
          <button
            on:click={() => (activeTab = 'readyToWear')}
            class="py-4 px-2 border-b-2 transition-colors {activeTab === 'readyToWear'
              ? 'border-black font-bold text-black'
              : 'border-transparent text-gray-500 hover:text-black'}"
          >
            {t('productPage.readyToWear')}
          </button>
          <button
            on:click={() => (activeTab = 'shoes')}
            class="py-4 px-2 border-b-2 transition-colors {activeTab === 'shoes'
              ? 'border-black font-bold text-black'
              : 'border-transparent text-gray-500 hover:text-black'}"
          >
            {t('productPage.shoes')}
          </button>
          <button
            on:click={() => (activeTab = 'gloves')}
            class="py-4 px-2 border-b-2 transition-colors {activeTab === 'gloves'
              ? 'border-black font-bold text-black'
              : 'border-transparent text-gray-500 hover:text-black'}"
          >
            {t('productPage.gloves')}
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        {#if chartData && activeTab === 'readyToWear' && chartData.readyToWear}
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-black text-white">
                  <th class="px-4 py-3 text-left font-medium border border-black"></th>
                  {#each chartData.readyToWear.headers as header}
                    <th class="px-4 py-3 text-center font-medium border border-black">
                      {header}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each chartData.readyToWear.rows as row, rowIndex}
                  <tr class={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td class="px-4 py-3 font-medium border border-black bg-black text-white">
                      {row.label}
                    </td>
                    {#each row.values as value}
                      <td
                        class="px-4 py-3 text-center border border-gray-300 {rowIndex % 2 === 0
                          ? 'bg-white'
                          : 'bg-gray-50'}"
                      >
                        {value}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if chartData && activeTab === 'shoes' && chartData.shoes}
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-black text-white">
                  <th class="px-4 py-3 text-left font-medium border border-black"></th>
                  {#each chartData.shoes.headers as header}
                    <th class="px-4 py-3 text-center font-medium border border-black">
                      {header}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each chartData.shoes.rows as row, rowIndex}
                  <tr class={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td class="px-4 py-3 font-medium border border-black bg-black text-white">
                      {row.label}
                    </td>
                    {#each row.values as value}
                      <td
                        class="px-4 py-3 text-center border border-gray-300 {rowIndex % 2 === 0
                          ? 'bg-white'
                          : 'bg-gray-50'}"
                      >
                        {value}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if chartData && activeTab === 'gloves' && chartData.gloves}
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-black text-white">
                  <th class="px-4 py-3 text-left font-medium border border-black"></th>
                  {#each chartData.gloves.headers as header}
                    <th class="px-4 py-3 text-center font-medium border border-black">
                      {header}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each chartData.gloves.rows as row, rowIndex}
                  <tr class={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td class="px-4 py-3 font-medium border border-black bg-black text-white">
                      {row.label}
                    </td>
                    {#each row.values as value}
                      <td
                        class="px-4 py-3 text-center border border-gray-300 {rowIndex % 2 === 0
                          ? 'bg-white'
                          : 'bg-gray-50'}"
                      >
                        {value}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  table {
    min-width: 100%;
  }
</style>
