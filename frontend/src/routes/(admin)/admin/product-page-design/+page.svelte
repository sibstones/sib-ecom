<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { translationApi, type ProductPageDesignTranslation } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { t } from '$lib/utils/i18n';
  import { resolveApiError } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';

  type ProductPageDesign = 'classic' | 'modern' | 'minimalist' | 'grid';

  interface SizeChartData {
    enabled: boolean;
    mens: {
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
    womens: {
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
  }

  let selectedDesign: ProductPageDesign = 'classic';
  let productImageAspectRatio: string = '9/16';
  let loading = false;
  let saving = false;
  let savingAspectRatio = false;
  let savingGridPanel = false;
  let savingSizeChart = false;
  let savingSections = false;

  // Product page sections (Complete the Look, You might like, You viewed)
  let productPageCompleteTheLookEnabled = true;
  let productPageYouMightLikeEnabled = true;
  let productPageYouMightLikeMode: 'smart' | 'similar' = 'similar';
  let productPageYouViewedEnabled = true;
  let productPageGridPanelBackgroundColor = '#ffffff';
  let productPageGridPanelOpacity = 60;
  let productPageGridPanelBlur = 12;
  let productPageGridPanelBorderColor = '#e5e7eb';
  let productPageGridPanelBorderOpacity = 0;
  let productPageGridPanelBorderRadius = 0;

  // Default size chart data
  const defaultSizeChart: SizeChartData = {
    enabled: false,
    mens: {
      readyToWear: {
        headers: ['46', '48', '50', '52', '54', '56'],
        rows: [
          { label: 'ITALY', values: ['46', '48', '50', '52', '54', '56'] },
          { label: 'INTERNATIONAL', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
          { label: 'France', values: ['46', '48', '50', '52', '54', '56'] },
          { label: 'Europe', values: ['46', '48', '50', '52', '54', '56'] },
          { label: 'UK', values: ['36', '38', '40', '42', '44', '46'] },
          { label: 'USA', values: ['36', '38', '40', '42', '44', '46'] },
          { label: 'JAPAN', values: ['2', '3', '4', '5', '6', '7'] },
          { label: 'Australia', values: ['36', '38', '40', '42', '44', '46'] },
          { label: 'Jeans', values: ['29', '30', '32', '34', '36', '38'] },
        ],
      },
      shoes: {
        headers: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
        rows: [
          {
            label: 'Europe',
            values: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
          },
          { label: 'UK', values: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'] },
          { label: 'USA', values: ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'] },
        ],
      },
      gloves: {
        headers: ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5'],
        rows: [
          { label: 'STANDARD', values: ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5'] },
          { label: 'INTERNATIONAL', values: ['XS', 'S', 'S', 'M', 'M', 'L', 'L', 'XL'] },
          { label: 'CENTIMETERS', values: ['19', '20', '21.5', '23', '24', '25.5', '27', '28'] },
        ],
      },
    },
    womens: {
      readyToWear: {
        headers: ['38', '40', '42', '44', '46', '48'],
        rows: [
          { label: 'ITALY', values: ['38', '40', '42', '44', '46', '48'] },
          { label: 'INTERNATIONAL', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
          { label: 'France', values: ['34', '36', '38', '40', '42', '44'] },
          { label: 'Europe', values: ['34', '36', '38', '40', '42', '44'] },
          { label: 'UK', values: ['6', '8', '10', '12', '14', '16'] },
          { label: 'USA', values: ['2', '4', '6', '8', '10', '12'] },
          { label: 'JAPAN', values: ['5', '7', '9', '11', '13', '15'] },
          { label: 'Australia', values: ['6', '8', '10', '12', '14', '16'] },
          { label: 'Jeans', values: ['25', '26', '28', '30', '32', '34'] },
        ],
      },
      shoes: {
        headers: ['34', '35', '36', '37', '38', '39', '40', '41', '42'],
        rows: [
          { label: 'Europe', values: ['34', '35', '36', '37', '38', '39', '40', '41', '42'] },
          { label: 'FRANCE', values: ['35', '36', '37', '38', '39', '40', '41', '42', '43'] },
          { label: 'UK', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
          { label: 'USA', values: ['4', '5', '6', '7', '8', '9', '10', '11', '12'] },
        ],
      },
      gloves: {
        headers: ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5'],
        rows: [
          { label: 'STANDARD', values: ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5'] },
          { label: 'INTERNATIONAL', values: ['XS', 'S', 'S', 'M', 'M', 'L', 'L', 'XL'] },
          { label: 'CENTIMETERS', values: ['17', '17.5', '19', '20', '21.5', '23', '24', '25.5'] },
        ],
      },
    },
  };

  let sizeChartData: SizeChartData = { ...defaultSizeChart };
  let activeSizeChartTab: 'readyToWear' | 'shoes' | 'gloves' = 'readyToWear';
  let activeSizeChartGender: 'mens' | 'womens' = 'mens';

  // Translation management
  let languages: Language[] = [];
  let translations: ProductPageDesignTranslation[] = [];
  let showTranslations = false;
  let editingTranslation: ProductPageDesignTranslation | null = null;
  let selectedLanguageForTranslation = '';
  let gptTranslating = false;
  let translationFormData: Record<string, string> = {};

  // Extract all unique labels from size chart data
  function getAllSizeChartLabels(): string[] {
    const labels = new Set<string>();

    ['mens', 'womens'].forEach((gender) => {
      ['readyToWear', 'shoes', 'gloves'].forEach((type) => {
        const chart =
          sizeChartData[gender as 'mens' | 'womens'][type as 'readyToWear' | 'shoes' | 'gloves'];
        chart.rows.forEach((row) => {
          if (row.label) {
            labels.add(row.label);
          }
        });
      });
    });

    return Array.from(labels).sort();
  }

  $: designOptions = [
    {
      value: 'classic' as ProductPageDesign,
      label: t('productPageDesign.designClassic'),
      description: t('productPageDesign.designClassicDescription'),
      preview: t('productPageDesign.designClassicPreview'),
    },
    {
      value: 'modern' as ProductPageDesign,
      label: t('productPageDesign.designModern'),
      description: t('productPageDesign.designModernDescription'),
      preview: t('productPageDesign.designModernPreview'),
    },
    {
      value: 'minimalist' as ProductPageDesign,
      label: t('productPageDesign.designMinimalist'),
      description: t('productPageDesign.designMinimalistDescription'),
      preview: t('productPageDesign.designMinimalistPreview'),
    },
    {
      value: 'grid' as ProductPageDesign,
      label: t('productPageDesign.designGrid'),
      description: t('productPageDesign.designGridDescription'),
      preview: t('productPageDesign.designGridPreview'),
    },
  ];

  onMount(async () => {
    loading = true;
    try {
      await Promise.all([loadSettings(), loadLanguages()]);
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      loading = false;
    }
  });

  async function loadSettings() {
    await settingsStore.load();
    const design = await settingsStore.getSetting('productPageDesign');
    if (design && typeof design === 'string') {
      selectedDesign = design as ProductPageDesign;
    }

    // Load product image aspect ratio
    try {
      const aspectRatio = await settingsStore.getSetting('productImageAspectRatio');
      if (aspectRatio && typeof aspectRatio === 'string') {
        productImageAspectRatio = aspectRatio;
      }
    } catch (e) {
      console.error('Failed to load product image aspect ratio:', e);
    }

    // Load product page sections settings
    try {
      const ctl = await settingsStore.getSetting('productPageCompleteTheLookEnabled');
      if (ctl !== null && typeof ctl === 'boolean') productPageCompleteTheLookEnabled = ctl;
      const yml = await settingsStore.getSetting('productPageYouMightLikeEnabled');
      if (yml !== null && typeof yml === 'boolean') productPageYouMightLikeEnabled = yml;
      const ymlMode = await settingsStore.getSetting('productPageYouMightLikeMode');
      if (ymlMode === 'smart' || ymlMode === 'similar') productPageYouMightLikeMode = ymlMode;
      const yv = await settingsStore.getSetting('productPageYouViewedEnabled');
      if (yv !== null && typeof yv === 'boolean') productPageYouViewedEnabled = yv;
    } catch (e) {
      console.error('Failed to load product page sections:', e);
    }

    try {
      const panelBackgroundColor = await settingsStore.getSetting(
        'productPageGridPanelBackgroundColor'
      );
      if (typeof panelBackgroundColor === 'string')
        productPageGridPanelBackgroundColor = panelBackgroundColor;
      const panelOpacity = await settingsStore.getSetting('productPageGridPanelOpacity');
      if (typeof panelOpacity === 'number') productPageGridPanelOpacity = panelOpacity;
      const panelBlur = await settingsStore.getSetting('productPageGridPanelBlur');
      if (typeof panelBlur === 'number') productPageGridPanelBlur = panelBlur;
      const panelBorderColor = await settingsStore.getSetting('productPageGridPanelBorderColor');
      if (typeof panelBorderColor === 'string') productPageGridPanelBorderColor = panelBorderColor;
      const panelBorderOpacity = await settingsStore.getSetting(
        'productPageGridPanelBorderOpacity'
      );
      if (typeof panelBorderOpacity === 'number')
        productPageGridPanelBorderOpacity = panelBorderOpacity;
      const panelBorderRadius = await settingsStore.getSetting('productPageGridPanelBorderRadius');
      if (typeof panelBorderRadius === 'number')
        productPageGridPanelBorderRadius = panelBorderRadius;
    } catch (e) {
      console.error('Failed to load grid panel settings:', e);
    }

    // Load size chart data
    try {
      const sizeChart = await settingsStore.getSetting('sizeChart');
      if (sizeChart && typeof sizeChart === 'object') {
        const loaded = sizeChart as any;
        // Migrate old structure to new structure if needed
        if (loaded.readyToWear && !loaded.mens) {
          // Old structure - migrate to new
          sizeChartData = {
            enabled: loaded.enabled || false,
            mens: {
              readyToWear: loaded.readyToWear || defaultSizeChart.mens.readyToWear,
              shoes: loaded.shoes || defaultSizeChart.mens.shoes,
              gloves: loaded.gloves || defaultSizeChart.mens.gloves,
            },
            womens: defaultSizeChart.womens,
          };
        } else {
          sizeChartData = loaded as SizeChartData;
        }
      }
    } catch (e) {
      console.error('Failed to load size chart:', e);
    }
  }

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll();
      languages = response.languages;
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadTranslations() {
    try {
      const response = await translationApi.getProductPageDesignTranslations();
      translations = response.translations;
    } catch (e) {
      console.error('Failed to load translations:', e);
      translations = [];
    }
  }

  function openTranslationEditor() {
    showTranslations = true;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {};
    loadTranslations();
  }

  function closeTranslationEditor() {
    showTranslations = false;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {};
  }

  function editTranslation(translation: ProductPageDesignTranslation) {
    editingTranslation = translation;
    selectedLanguageForTranslation = translation.languageCode;
    translationFormData = { ...(translation.sizeChartLabels || {}) };
  }

  async function saveTranslation() {
    if (!selectedLanguageForTranslation) return;

    try {
      await translationApi.upsertProductPageDesignTranslation({
        languageCode: selectedLanguageForTranslation,
        sizeChartLabels: translationFormData,
      });
      notificationStore.success(t('notification.translationSaved'));
      await loadTranslations();
      editingTranslation = null;
      selectedLanguageForTranslation = '';
      translationFormData = {};
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteTranslation(languageCode: string) {
    const confirmed = await dialogStore.confirm(t('alert.deleteTranslation'), t('common.confirm'));
    if (!confirmed) return;

    try {
      await translationApi.deleteProductPageDesignTranslation(languageCode);
      notificationStore.success(t('notification.translationDeleted'));
      await loadTranslations();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  async function translateWithGPT() {
    gptTranslating = true;
    try {
      const sourceLanguage = 'en';
      const targetLanguage = selectedLanguageForTranslation;

      const targetLang = languages.find((l) => l.code === targetLanguage);
      if (!targetLang) {
        notificationStore.error(t('notification.targetLanguageNotFound'));
        return;
      }

      // Translate all size chart labels
      const labels = getAllSizeChartLabels();
      for (const label of labels) {
        try {
          const labelTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: label,
          });
          translationFormData[label] = labelTranslation.translation;
        } catch (e) {
          console.error(`Failed to translate label ${label}:`, e);
        }
      }

      notificationStore.success(
        `Translation generated for ${targetLang.nameNative || targetLang.name}`
      );
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'error.failedToGenerateTranslation'));
    } finally {
      gptTranslating = false;
    }
  }

  async function saveDesign() {
    saving = true;
    try {
      await settingsStore.updateSetting('productPageDesign', selectedDesign);
      notificationStore.success(t('productPageDesign.designSaved'));
    } catch (e) {
      notificationStore.error(t('productPageDesign.failedToSaveDesign'));
      console.error('Failed to save design:', e);
    } finally {
      saving = false;
    }
  }

  async function saveAspectRatio() {
    savingAspectRatio = true;
    try {
      await settingsStore.updateSetting('productImageAspectRatio', productImageAspectRatio);
      notificationStore.success(t('productPageDesign.aspectRatioSaved'));
    } catch (e) {
      notificationStore.error(t('productPageDesign.failedToSaveAspectRatio'));
      console.error('Failed to save aspect ratio:', e);
    } finally {
      savingAspectRatio = false;
    }
  }

  async function saveGridPanel() {
    savingGridPanel = true;
    try {
      await settingsStore.updateMultiple({
        productPageGridPanelBackgroundColor,
        productPageGridPanelOpacity,
        productPageGridPanelBlur,
        productPageGridPanelBorderColor,
        productPageGridPanelBorderOpacity,
        productPageGridPanelBorderRadius,
      });
      notificationStore.success(t('productPageDesign.designSaved'));
    } catch (e) {
      notificationStore.error(t('productPageDesign.failedToSaveDesign'));
      console.error('Failed to save grid panel settings:', e);
    } finally {
      savingGridPanel = false;
    }
  }

  async function saveSizeChart() {
    savingSizeChart = true;
    try {
      await settingsStore.updateSetting('sizeChart' as any, sizeChartData as any);
      notificationStore.success(t('productPageDesign.sizeChartSaved'));
    } catch (e) {
      notificationStore.error(t('productPageDesign.failedToSaveSizeChart'));
      console.error('Failed to save size chart:', e);
    } finally {
      savingSizeChart = false;
    }
  }

  async function saveSections() {
    savingSections = true;
    try {
      await settingsStore.updateMultiple({
        productPageCompleteTheLookEnabled,
        productPageYouMightLikeEnabled,
        productPageYouMightLikeMode,
        productPageYouViewedEnabled,
      });
      notificationStore.success(t('productPageDesign.designSaved'));
    } catch (e) {
      notificationStore.error(t('productPageDesign.failedToSaveDesign'));
      console.error('Failed to save sections:', e);
    } finally {
      savingSections = false;
    }
  }

  function addHeader(chartType: 'readyToWear' | 'shoes' | 'gloves') {
    sizeChartData[activeSizeChartGender][chartType].headers.push('');
    // Add empty value to all rows
    sizeChartData[activeSizeChartGender][chartType].rows.forEach((row) => {
      row.values.push('');
    });
    sizeChartData = { ...sizeChartData };
  }

  function removeHeader(chartType: 'readyToWear' | 'shoes' | 'gloves', index: number) {
    sizeChartData[activeSizeChartGender][chartType].headers.splice(index, 1);
    sizeChartData[activeSizeChartGender][chartType].rows.forEach((row) => {
      row.values.splice(index, 1);
    });
    sizeChartData = { ...sizeChartData };
  }

  function addRow(chartType: 'readyToWear' | 'shoes' | 'gloves') {
    const emptyValues = new Array(
      sizeChartData[activeSizeChartGender][chartType].headers.length
    ).fill('');
    sizeChartData[activeSizeChartGender][chartType].rows.push({ label: '', values: emptyValues });
    sizeChartData = { ...sizeChartData };
  }

  function removeRow(chartType: 'readyToWear' | 'shoes' | 'gloves', index: number) {
    sizeChartData[activeSizeChartGender][chartType].rows.splice(index, 1);
    sizeChartData = { ...sizeChartData };
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <div>
      <h2 class="text-3xl font-bold">{t('productPageDesign.title')}</h2>
      <p class="text-accent-muted mt-2">{t('productPageDesign.description')}</p>
    </div>
    <div class="flex gap-2">
      <button
        on:click={openTranslationEditor}
        class="px-4 py-2 bg-black text-white hover:bg-accent transition-colors"
      >
        {t('productPageDesign.translations')}
      </button>
      <button
        on:click={saveDesign}
        disabled={saving || loading}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
      >
        {saving ? t('common.saving') : t('productPageDesign.saveDesign')}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-full py-8"><LoadingBar /></div>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {#each designOptions as design}
        <button
          type="button"
          class="border-2 p-6 cursor-pointer transition-all hover:shadow-lg {selectedDesign ===
          design.value
            ? 'border-accent bg-accent/5'
            : 'border-gray-300 hover:border-accent/50'}"
          on:click={() => (selectedDesign = design.value)}
        >
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-xl font-semibold mb-2">{design.label}</h3>
              <p class="text-sm text-accent-muted mb-3">{design.description}</p>
            </div>
            <div
              class="w-6 h-6 -full border-2 flex items-center justify-center flex-shrink-0 {selectedDesign ===
              design.value
                ? 'border-accent bg-accent'
                : 'border-gray-300'}"
            >
              {#if selectedDesign === design.value}
                <svg class="w-4 h-4 text-dark" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              {/if}
            </div>
          </div>
          <div class="bg-gray-100 p-4 min-h-[120px] flex items-center justify-center">
            <p class="text-sm text-accent-muted text-center">{design.preview}</p>
          </div>
        </button>
      {/each}
    </div>

    <div class="mt-8 bg-dark-light p-6">
      <h3 class="text-lg font-medium mb-4">{t('productPageDesign.preview')}</h3>
      <p class="text-sm text-accent-muted">
        {t('productPageDesign.selectedDesign')}:
        <span class="font-semibold text-black"
          >{designOptions.find((d) => d.value === selectedDesign)?.label}</span
        >
      </p>
      <p class="text-sm text-accent-muted mt-2">
        {t('productPageDesign.visitProductPage')}
      </p>
    </div>

    <!-- Product page sections: Complete the Look, You might like, You viewed -->
    <div class="mt-12 border-t border-gray-200 pt-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-3xl font-bold">{t('productPageDesign.sectionsTitle')}</h2>
        </div>
        <button
          on:click={saveSections}
          disabled={savingSections || loading}
          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
        >
          {savingSections ? t('common.saving') : t('common.save')}
        </button>
      </div>

      <div class="space-y-6 max-w-2xl">
        <div class="border border-gray-200 p-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={productPageCompleteTheLookEnabled}
              class="w-4 h-4"
            />
            <span class="font-medium">{t('productPageDesign.completeTheLookEnabled')}</span>
          </label>
          <p class="text-sm text-accent-muted mt-2 ml-7">
            {t('productPageDesign.completeTheLookEnabledHint')}
          </p>
        </div>

        <div class="border border-gray-200 p-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" bind:checked={productPageYouMightLikeEnabled} class="w-4 h-4" />
            <span class="font-medium">{t('productPageDesign.youMightLikeEnabled')}</span>
          </label>
          <p class="text-sm text-accent-muted mt-2 ml-7">
            {t('productPageDesign.youMightLikeHint')}
          </p>
          {#if productPageYouMightLikeEnabled}
            <div class="mt-4 ml-7">
              <label for="youMightLikeMode" class="block text-sm font-medium mb-2"
                >{t('productPageDesign.youMightLikeMode')}</label
              >
              <select
                id="youMightLikeMode"
                bind:value={productPageYouMightLikeMode}
                class="w-full max-w-md px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="similar">{t('productPageDesign.youMightLikeModeSimilar')}</option>
                <option value="smart">{t('productPageDesign.youMightLikeModeSmart')}</option>
              </select>
            </div>
          {/if}
        </div>

        <div class="border border-gray-200 p-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" bind:checked={productPageYouViewedEnabled} class="w-4 h-4" />
            <span class="font-medium">{t('productPageDesign.youViewedEnabled')}</span>
          </label>
          <p class="text-sm text-accent-muted mt-2 ml-7">{t('productPageDesign.youViewedHint')}</p>
        </div>
      </div>
    </div>

    <!-- Product Image Aspect Ratio Setting -->
    <div class="mt-12 border-t border-gray-200 pt-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-3xl font-bold">{t('productPageDesign.aspectRatioTitle')}</h2>
          <p class="text-accent-muted mt-2">{t('productPageDesign.aspectRatioDescription')}</p>
        </div>
        <button
          on:click={saveAspectRatio}
          disabled={savingAspectRatio || loading}
          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
        >
          {savingAspectRatio ? t('common.saving') : t('productPageDesign.saveAspectRatio')}
        </button>
      </div>

      <div class="bg-white border border-gray-300 p-6 max-w-md">
        <label for="productImageAspectRatio" class="block text-sm font-medium mb-3"
          >{t('productPageDesign.aspectRatio')}</label
        >
        <select
          id="productImageAspectRatio"
          bind:value={productImageAspectRatio}
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
        >
          <option value="9/16">9:16 ({t('productPageDesign.portraitMobile')})</option>
          <option value="3/4">3:4 ({t('productPageDesign.portrait')})</option>
          <option value="4/5">4:5 ({t('productPageDesign.portrait')})</option>
          <option value="1/1">1:1 ({t('productPageDesign.square')})</option>
          <option value="4/3">4:3 ({t('productPageDesign.landscape')})</option>
          <option value="16/9">16:9 ({t('productPageDesign.landscapeWide')})</option>
        </select>
        <p class="text-xs text-accent-muted mt-3">
          {t('productPageDesign.aspectRatioHint')}
        </p>
      </div>
    </div>

    <div class="mt-12 border-t border-gray-200 pt-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-3xl font-bold">Journal Panel Style</h2>
          <p class="text-accent-muted mt-2">
            These settings affect the floating info panel in the journal grid product layout only.
          </p>
        </div>
        <button
          on:click={saveGridPanel}
          disabled={savingGridPanel || loading}
          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
        >
          {savingGridPanel ? t('common.saving') : t('common.save')}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        <div class="border border-gray-300 bg-white p-6 space-y-5">
          <div>
            <label for="grid-panel-background" class="block text-sm font-medium mb-2"
              >Background color</label
            >
            <div class="flex items-center gap-3">
              <input
                id="grid-panel-background"
                type="color"
                bind:value={productPageGridPanelBackgroundColor}
                class="h-11 w-16 border border-gray-300 bg-white p-1"
              />
              <input
                type="text"
                bind:value={productPageGridPanelBackgroundColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>

          <div>
            <label for="grid-panel-opacity" class="block text-sm font-medium mb-2"
              >Background opacity: {productPageGridPanelOpacity}%</label
            >
            <input
              id="grid-panel-opacity"
              type="range"
              min="0"
              max="100"
              step="1"
              bind:value={productPageGridPanelOpacity}
              class="w-full"
            />
          </div>

          <div>
            <label for="grid-panel-blur" class="block text-sm font-medium mb-2"
              >Blur: {productPageGridPanelBlur}px</label
            >
            <input
              id="grid-panel-blur"
              type="range"
              min="0"
              max="40"
              step="1"
              bind:value={productPageGridPanelBlur}
              class="w-full"
            />
          </div>
        </div>

        <div class="border border-gray-300 bg-white p-6 space-y-5">
          <div>
            <label for="grid-panel-border" class="block text-sm font-medium mb-2"
              >Border color</label
            >
            <div class="flex items-center gap-3">
              <input
                id="grid-panel-border"
                type="color"
                bind:value={productPageGridPanelBorderColor}
                class="h-11 w-16 border border-gray-300 bg-white p-1"
              />
              <input
                type="text"
                bind:value={productPageGridPanelBorderColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>

          <div>
            <label for="grid-panel-border-opacity" class="block text-sm font-medium mb-2"
              >Border opacity: {productPageGridPanelBorderOpacity}%</label
            >
            <input
              id="grid-panel-border-opacity"
              type="range"
              min="0"
              max="100"
              step="1"
              bind:value={productPageGridPanelBorderOpacity}
              class="w-full"
            />
          </div>

          <div>
            <label for="grid-panel-radius" class="block text-sm font-medium mb-2"
              >Border radius: {productPageGridPanelBorderRadius}px</label
            >
            <input
              id="grid-panel-radius"
              type="range"
              min="0"
              max="40"
              step="1"
              bind:value={productPageGridPanelBorderRadius}
              class="w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Size Chart Editor -->
    <div class="mt-12 border-t border-gray-200 pt-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-3xl font-bold">{t('productPageDesign.sizeChartTitle')}</h2>
          <p class="text-accent-muted mt-2">{t('productPageDesign.sizeChartDescription')}</p>
        </div>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={sizeChartData.enabled} class="w-4 h-4" />
            <span class="text-sm font-medium">{t('productPageDesign.enableSizeChartLabel')}</span>
          </label>
          <button
            on:click={saveSizeChart}
            disabled={savingSizeChart}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
          >
            {savingSizeChart ? t('common.saving') : t('productPageDesign.saveSizeChart')}
          </button>
        </div>
      </div>

      {#if sizeChartData.enabled}
        <!-- Gender Tabs -->
        <div class="flex gap-0.5 p-1 bg-gray-50 rounded-md border border-gray-200 w-fit mb-4">
          <button
            on:click={() => (activeSizeChartGender = 'mens')}
            class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
            class:bg-white={activeSizeChartGender === 'mens'}
            class:shadow-sm={activeSizeChartGender === 'mens'}
            class:text-accent={activeSizeChartGender === 'mens'}
            class:font-medium={activeSizeChartGender === 'mens'}
            class:text-gray-500={activeSizeChartGender !== 'mens'}
            class:hover:text-gray-700={activeSizeChartGender !== 'mens'}
          >
            {t('productPageDesign.mens')}
          </button>
          <button
            on:click={() => (activeSizeChartGender = 'womens')}
            class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
            class:bg-white={activeSizeChartGender === 'womens'}
            class:shadow-sm={activeSizeChartGender === 'womens'}
            class:text-accent={activeSizeChartGender === 'womens'}
            class:font-medium={activeSizeChartGender === 'womens'}
            class:text-gray-500={activeSizeChartGender !== 'womens'}
            class:hover:text-gray-700={activeSizeChartGender !== 'womens'}
          >
            {t('productPageDesign.womens')}
          </button>
        </div>

        <!-- Category Tabs -->
        <div class="flex gap-0.5 p-1 bg-gray-50 rounded-md border border-gray-200 w-fit mb-6">
          <button
            on:click={() => (activeSizeChartTab = 'readyToWear')}
            class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
            class:bg-white={activeSizeChartTab === 'readyToWear'}
            class:shadow-sm={activeSizeChartTab === 'readyToWear'}
            class:text-accent={activeSizeChartTab === 'readyToWear'}
            class:font-medium={activeSizeChartTab === 'readyToWear'}
            class:text-gray-500={activeSizeChartTab !== 'readyToWear'}
            class:hover:text-gray-700={activeSizeChartTab !== 'readyToWear'}
          >
            {t('productPageDesign.readyToWear')}
          </button>
          <button
            on:click={() => (activeSizeChartTab = 'shoes')}
            class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
            class:bg-white={activeSizeChartTab === 'shoes'}
            class:shadow-sm={activeSizeChartTab === 'shoes'}
            class:text-accent={activeSizeChartTab === 'shoes'}
            class:font-medium={activeSizeChartTab === 'shoes'}
            class:text-gray-500={activeSizeChartTab !== 'shoes'}
            class:hover:text-gray-700={activeSizeChartTab !== 'shoes'}
          >
            {t('productPageDesign.shoes')}
          </button>
          <button
            on:click={() => (activeSizeChartTab = 'gloves')}
            class="px-3 py-1.5 text-sm whitespace-nowrap transition-colors rounded"
            class:bg-white={activeSizeChartTab === 'gloves'}
            class:shadow-sm={activeSizeChartTab === 'gloves'}
            class:text-accent={activeSizeChartTab === 'gloves'}
            class:font-medium={activeSizeChartTab === 'gloves'}
            class:text-gray-500={activeSizeChartTab !== 'gloves'}
            class:hover:text-gray-700={activeSizeChartTab !== 'gloves'}
          >
            {t('productPageDesign.gloves')}
          </button>
        </div>

        <!-- Editor for each chart type -->
        {#if activeSizeChartTab === 'readyToWear'}
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">
                {activeSizeChartGender === 'mens'
                  ? t('productPageDesign.mens')
                  : t('productPageDesign.womens')}
                {t('productPageDesign.readyToWear')}
                {t('productPageDesign.chart')}
              </h3>
              <div class="flex gap-2">
                <button
                  on:click={() => addHeader('readyToWear')}
                  class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  {t('productPageDesign.addColumn')}
                </button>
                <button
                  on:click={() => addRow('readyToWear')}
                  class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  {t('productPageDesign.addRow')}
                </button>
              </div>
            </div>
            <div class="overflow-x-auto border border-gray-200">
              <table class="w-full border-collapse">
                <thead>
                  <tr class="bg-gray-100">
                    <th class="px-4 py-2 border border-gray-300 text-left"></th>
                    {#each sizeChartData[activeSizeChartGender].readyToWear.headers as header, index}
                      <th class="px-4 py-2 border border-gray-300">
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            bind:value={
                              sizeChartData[activeSizeChartGender].readyToWear.headers[index]
                            }
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.header')}
                          />
                          <button
                            on:click={() => removeHeader('readyToWear', index)}
                            class="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each sizeChartData[activeSizeChartGender].readyToWear.rows as row, rowIndex}
                    <tr>
                      <td class="px-4 py-2 border border-gray-300 bg-gray-50">
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            bind:value={
                              sizeChartData[activeSizeChartGender].readyToWear.rows[rowIndex].label
                            }
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.label')}
                          />
                          <button
                            on:click={() => removeRow('readyToWear', rowIndex)}
                            class="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      {#each row.values as value, colIndex}
                        <td class="px-4 py-2 border border-gray-300">
                          <input
                            type="text"
                            bind:value={
                              sizeChartData[activeSizeChartGender].readyToWear.rows[rowIndex]
                                .values[colIndex]
                            }
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.value')}
                          />
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else if activeSizeChartTab === 'shoes'}
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">
                {activeSizeChartGender === 'mens'
                  ? t('productPageDesign.mens')
                  : t('productPageDesign.womens')}
                {t('productPageDesign.shoes')}
                {t('productPageDesign.chart')}
              </h3>
              <div class="flex gap-2">
                <button
                  on:click={() => addHeader('shoes')}
                  class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  {t('productPageDesign.addColumn')}
                </button>
                <button
                  on:click={() => addRow('shoes')}
                  class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  {t('productPageDesign.addRow')}
                </button>
              </div>
            </div>
            <div class="overflow-x-auto border border-gray-200">
              <table class="w-full border-collapse">
                <thead>
                  <tr class="bg-gray-100">
                    <th class="px-4 py-2 border border-gray-300 text-left"></th>
                    {#each sizeChartData[activeSizeChartGender].shoes.headers as header, index}
                      <th class="px-4 py-2 border border-gray-300">
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            bind:value={sizeChartData[activeSizeChartGender].shoes.headers[index]}
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.header')}
                          />
                          <button
                            on:click={() => removeHeader('shoes', index)}
                            class="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each sizeChartData[activeSizeChartGender].shoes.rows as row, rowIndex}
                    <tr>
                      <td class="px-4 py-2 border border-gray-300 bg-gray-50">
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            bind:value={
                              sizeChartData[activeSizeChartGender].shoes.rows[rowIndex].label
                            }
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.label')}
                          />
                          <button
                            on:click={() => removeRow('shoes', rowIndex)}
                            class="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      {#each row.values as value, colIndex}
                        <td class="px-4 py-2 border border-gray-300">
                          <input
                            type="text"
                            bind:value={
                              sizeChartData[activeSizeChartGender].shoes.rows[rowIndex].values[
                                colIndex
                              ]
                            }
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.value')}
                          />
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else if activeSizeChartTab === 'gloves'}
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">
                {activeSizeChartGender === 'mens'
                  ? t('productPageDesign.mens')
                  : t('productPageDesign.womens')}
                {t('productPageDesign.gloves')}
                {t('productPageDesign.chart')}
              </h3>
              <div class="flex gap-2">
                <button
                  on:click={() => addHeader('gloves')}
                  class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  {t('productPageDesign.addColumn')}
                </button>
                <button
                  on:click={() => addRow('gloves')}
                  class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  {t('productPageDesign.addRow')}
                </button>
              </div>
            </div>
            <div class="overflow-x-auto border border-gray-200">
              <table class="w-full border-collapse">
                <thead>
                  <tr class="bg-gray-100">
                    <th class="px-4 py-2 border border-gray-300 text-left"></th>
                    {#each sizeChartData[activeSizeChartGender].gloves.headers as header, index}
                      <th class="px-4 py-2 border border-gray-300">
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            bind:value={sizeChartData[activeSizeChartGender].gloves.headers[index]}
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.header')}
                          />
                          <button
                            on:click={() => removeHeader('gloves', index)}
                            class="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each sizeChartData[activeSizeChartGender].gloves.rows as row, rowIndex}
                    <tr>
                      <td class="px-4 py-2 border border-gray-300 bg-gray-50">
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            bind:value={
                              sizeChartData[activeSizeChartGender].gloves.rows[rowIndex].label
                            }
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.label')}
                          />
                          <button
                            on:click={() => removeRow('gloves', rowIndex)}
                            class="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      {#each row.values as value, colIndex}
                        <td class="px-4 py-2 border border-gray-300">
                          <input
                            type="text"
                            bind:value={
                              sizeChartData[activeSizeChartGender].gloves.rows[rowIndex].values[
                                colIndex
                              ]
                            }
                            class="w-full px-2 py-1 border border-gray-300 text-sm"
                            placeholder={t('productPageDesign.value')}
                          />
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      {:else}
        <div class="bg-gray-50 p-8 text-center">
          <p class="text-accent-muted">{t('productPageDesign.enableSizeChart')}</p>
        </div>
      {/if}
    </div>

    {#if showTranslations}
      <div class="bg-dark-light p-6 mb-6 mt-12">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-medium">{t('productPageDesign.translations')}</h3>
          <button
            on:click={closeTranslationEditor}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.close')}
          </button>
        </div>

        <!-- Translation Form -->
        <div class="mb-6 p-4 bg-white border border-gray-300">
          <h4 class="text-lg font-medium mb-4">
            {editingTranslation
              ? t('productPageDesign.editTranslation')
              : t('productPageDesign.addTranslation')}
          </h4>
          <div class="space-y-4">
            <div>
              <label for="translationLanguage" class="block text-sm font-medium mb-2"
                >{t('language.language')} *</label
              >
              <select
                id="translationLanguage"
                bind:value={selectedLanguageForTranslation}
                disabled={!!editingTranslation}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
              >
                <option value="">{t('common.select')} {t('language.language').toLowerCase()}</option
                >
                {#each languages as lang}
                  {#if !translations.find((t) => t.languageCode === lang.code) || editingTranslation?.languageCode === lang.code}
                    <option value={lang.code}>{lang.name} ({lang.code})</option>
                  {/if}
                {/each}
              </select>
            </div>

            <div class="border-t pt-4">
              <h5 class="text-sm font-medium mb-3">{t('productPageDesign.sizeChartLabels')}</h5>
              <p class="text-xs text-accent-muted mb-4">
                {t('productPageDesign.sizeChartLabelsHint')}
              </p>
              <div class="space-y-3 max-h-96 overflow-y-auto">
                {#each getAllSizeChartLabels() as label}
                  <div class="flex items-center gap-4">
                    <label for={`translation-${label}`} class="w-48 text-sm font-medium"
                      >{label}</label
                    >
                    <input
                      id={`translation-${label}`}
                      type="text"
                      bind:value={translationFormData[label]}
                      class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                      placeholder={label}
                    />
                  </div>
                {/each}
              </div>
            </div>

            <div class="flex gap-4 flex-wrap">
              <button
                on:click={translateWithGPT}
                disabled={gptTranslating || !selectedLanguageForTranslation}
                class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {#if gptTranslating}
                  <svg
                    class="animate-spin h-4 w-4"
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
                  Translating...
                {:else}
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    ></path>
                  </svg>
                  GPT Assistant
                {/if}
              </button>
              <button
                on:click={saveTranslation}
                disabled={!selectedLanguageForTranslation}
                class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {t('common.save')}
              </button>
              {#if editingTranslation}
                <button
                  on:click={() => {
                    editingTranslation = null;
                    selectedLanguageForTranslation = '';
                    translationFormData = {};
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
          <h4 class="text-lg font-medium mb-4">{t('productPageDesign.existingTranslations')}</h4>
          {#if translations.length === 0}
            <p class="text-accent-muted">{t('productPageDesign.noTranslations')}</p>
          {:else}
            <div class="space-y-2">
              {#each translations as translation}
                <div class="flex items-center justify-between p-4 bg-white border border-gray-300">
                  <div>
                    <p class="font-medium">
                      {languages.find((l) => l.code === translation.languageCode)?.name ||
                        translation.languageCode}
                    </p>
                    {#if translation.sizeChartLabels}
                      <p class="text-sm text-accent-muted">
                        {Object.keys(translation.sizeChartLabels).length}
                        {t('productPageDesign.labelsTranslated')}
                      </p>
                    {/if}
                  </div>
                  <div class="flex gap-2">
                    <button
                      on:click={() => editTranslation(translation)}
                      class="px-3 py-1 bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-colors text-black"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      on:click={() => deleteTranslation(translation.languageCode)}
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
  {/if}
</div>
