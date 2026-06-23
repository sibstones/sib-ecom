<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '$lib/api/admin.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';

  type TabId = 'charts' | 'templates' | 'entries';
  const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const;
  /** Regions for accounting (used when API constants not loaded); must match backend SUPPORTED_REGIONS */
  const ACCOUNTING_REGIONS = ['RU', 'CN', 'EU', 'US', 'AE', 'HK'];
  /** Legal regimes by region fallback (when API constants not loaded); must match backend LEGAL_REGIMES_BY_REGION */
  const LEGAL_REGIMES_FALLBACK: Record<string, string[]> = {
    RU: ['RU_OSN', 'RU_USN', 'RU_PATENT'],
    CN: ['CN_DOMESTIC', 'CN_CROSS_BORDER', 'CN_FTZ'],
    EU: ['EU_OSS', 'EU_DOMESTIC', 'EU_B2B', 'EU_B2C'],
    US: ['US_STANDARD', 'US_SALES_TAX', 'US_EXEMPT'],
    AE: ['AE_STANDARD', 'AE_FREE_ZONE', 'AE_EXEMPT'],
    HK: ['HK_STANDARD', 'HK_EXEMPT'],
  };

  let activeTab: TabId = 'entries';
  let loading = false;
  let constants: {
    regions: string[];
    triggerEvents: string[];
    accountTypes: string[];
    legalRegimesByRegion?: Record<string, string[]>;
  } | null = null;

  let charts: any[] = [];
  let templates: any[] = [];
  let entriesResult: { items: any[]; total: number } = { items: [], total: 0 };

  let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let endDate = new Date().toISOString().split('T')[0];
  let regionFilter = 'RU';
  let generating = false;
  let exporting = false;

  let newChart = { region: 'RU', name: '' };
  let newTemplate = {
    region: 'RU',
    legalRegime: '',
    name: '',
    triggerEvent: 'ORDER_DELIVERED',
    debitAccountCode: '51',
    creditAccountCode: '62',
    amountFormula: 'order.total',
  };
  let showNewChart = false;
  let showNewTemplate = false;

  let editingChartId: string | null = null;
  let editingChartName = '';
  let editingTemplateId: string | null = null;
  let editingTemplate: Record<string, string> = {};
  let expandedChartIds: Set<string> = new Set();
  let newChartItemByChartId: Record<string, { code: string; name: string; type: string }> = {};
  let editingChartItemId: string | null = null;
  let editingChartItem: { code: string; name: string; type: string } = {
    code: '',
    name: '',
    type: 'ASSET',
  };
  let deleteConfirm: {
    type: 'chart' | 'template' | 'chartItem';
    id: string;
    chartId?: string;
  } | null = null;

  onMount(async () => {
    try {
      constants = await adminApi.accounting.getConstants();
    } catch (_) {}
    await loadEntries();
  });

  async function loadCharts() {
    loading = true;
    try {
      const res = await adminApi.accounting.listCharts(regionFilter);
      charts = res.charts ?? [];
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorLoadCharts'));
    } finally {
      loading = false;
    }
  }

  async function loadTemplates() {
    loading = true;
    try {
      const res = await adminApi.accounting.listTemplates(regionFilter);
      templates = res.templates ?? [];
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorLoadTemplates'));
    } finally {
      loading = false;
    }
  }

  async function loadEntries() {
    loading = true;
    try {
      const res = await adminApi.accounting.listEntries({
        startDate,
        endDate,
        region: regionFilter,
      });
      entriesResult = res ?? { items: [], total: 0 };
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorLoadEntries'));
    } finally {
      loading = false;
    }
  }

  async function createChart() {
    if (!newChart.name.trim()) return;
    try {
      await adminApi.accounting.createChart({ region: newChart.region, name: newChart.name });
      notificationStore.success(t('common.saved'));
      newChart = { region: 'RU', name: '' };
      showNewChart = false;
      await loadCharts();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('common.error'));
    }
  }

  async function createTemplate() {
    if (!newTemplate.name.trim()) return;
    try {
      await adminApi.accounting.createTemplate({
        ...newTemplate,
        legalRegime: newTemplate.legalRegime || undefined,
      });
      notificationStore.success(t('common.saved'));
      showNewTemplate = false;
      await loadTemplates();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('common.error'));
    }
  }

  function startEditChart(chart: { id: string; name: string }) {
    editingChartId = chart.id;
    editingChartName = chart.name;
  }
  async function saveEditChart() {
    if (!editingChartId || !editingChartName.trim()) return;
    try {
      await adminApi.accounting.updateChart(editingChartId, { name: editingChartName });
      notificationStore.success(t('common.saved'));
      editingChartId = null;
      await loadCharts();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('common.error'));
    }
  }
  function cancelEditChart() {
    editingChartId = null;
  }

  async function doDeleteChart(id: string) {
    try {
      await adminApi.accounting.deleteChart(id);
      notificationStore.success(t('accounting.chartDeleted'));
      deleteConfirm = null;
      expandedChartIds.delete(id);
      await loadCharts();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorDelete'));
    }
  }

  function toggleChartExpand(chartId: string) {
    const next = new Set(expandedChartIds);
    if (next.has(chartId)) next.delete(chartId);
    else next.add(chartId);
    expandedChartIds = next;
  }
  function getNewChartItem(chartId: string) {
    if (!newChartItemByChartId[chartId])
      newChartItemByChartId[chartId] = { code: '', name: '', type: 'ASSET' };
    return newChartItemByChartId[chartId];
  }
  async function addChartItem(chartId: string) {
    const item = getNewChartItem(chartId);
    if (!item.code.trim() || !item.name.trim()) return;
    try {
      await adminApi.accounting.addChartItem(chartId, {
        code: item.code,
        name: item.name,
        type: item.type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE',
      });
      notificationStore.success(t('accounting.chartItemAdded'));
      newChartItemByChartId[chartId] = { code: '', name: '', type: 'ASSET' };
      newChartItemByChartId = newChartItemByChartId;
      await loadCharts();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('common.error'));
    }
  }
  function startEditChartItem(it: { id: string; code: string; name: string; type: string }) {
    editingChartItemId = it.id;
    editingChartItem = { code: it.code, name: it.name, type: it.type };
  }
  async function saveEditChartItem() {
    if (!editingChartItemId) return;
    try {
      await adminApi.accounting.updateChartItem(editingChartItemId, { ...editingChartItem });
      notificationStore.success(t('common.saved'));
      editingChartItemId = null;
      await loadCharts();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('common.error'));
    }
  }
  function cancelEditChartItem() {
    editingChartItemId = null;
  }
  async function doDeleteChartItem(id: string, chartId: string) {
    try {
      await adminApi.accounting.deleteChartItem(id);
      notificationStore.success(t('accounting.chartItemDeleted'));
      deleteConfirm = null;
      await loadCharts();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorDelete'));
    }
  }

  function startEditTemplate(tmpl: any) {
    editingTemplateId = tmpl.id;
    editingTemplate = {
      name: tmpl.name,
      region: tmpl.region,
      legalRegime: tmpl.legalRegime ?? '',
      triggerEvent: tmpl.triggerEvent,
      debitAccountCode: tmpl.debitAccountCode,
      creditAccountCode: tmpl.creditAccountCode,
      amountFormula: tmpl.amountFormula ?? '',
    };
  }
  async function saveEditTemplate() {
    if (!editingTemplateId) return;
    try {
      await adminApi.accounting.updateTemplate(editingTemplateId, {
        ...editingTemplate,
        legalRegime: editingTemplate.legalRegime || undefined,
        amountFormula: editingTemplate.amountFormula || undefined,
      });
      notificationStore.success(t('common.saved'));
      editingTemplateId = null;
      await loadTemplates();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('common.error'));
    }
  }
  function cancelEditTemplate() {
    editingTemplateId = null;
  }
  async function doDeleteTemplate(id: string) {
    try {
      await adminApi.accounting.deleteTemplate(id);
      notificationStore.success(t('accounting.templateDeleted'));
      deleteConfirm = null;
      await loadTemplates();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorDelete'));
    }
  }

  function confirmDelete(type: 'chart' | 'template' | 'chartItem', id: string, chartId?: string) {
    deleteConfirm = { type, id, chartId };
  }
  function cancelDelete() {
    deleteConfirm = null;
  }
  async function doDelete() {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'chart') doDeleteChart(deleteConfirm.id);
    else if (deleteConfirm.type === 'template') doDeleteTemplate(deleteConfirm.id);
    else if (deleteConfirm.type === 'chartItem' && deleteConfirm.chartId)
      doDeleteChartItem(deleteConfirm.id, deleteConfirm.chartId);
  }

  async function generateEntries() {
    generating = true;
    try {
      const res = await adminApi.accounting.generateEntries({
        startDate,
        endDate,
        region: regionFilter,
      });
      notificationStore.success(t('accounting.entriesGenerated', { count: res?.generated ?? 0 }));
      await loadEntries();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorGenerate'));
    } finally {
      generating = false;
    }
  }

  async function exportEntries() {
    exporting = true;
    try {
      const url = adminApi.accounting.getExportEntriesUrl({
        startDate,
        endDate,
        region: regionFilter,
      });
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `accounting-entries-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(a.href);
      notificationStore.success(t('report.exportSuccess'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('accounting.errorExport'));
    } finally {
      exporting = false;
    }
  }

  function toNum(v: unknown): number {
    if (v == null) return 0;
    if (typeof v === 'object' && v !== null && 'toNumber' in v)
      return (v as { toNumber: () => number }).toNumber();
    return Number(v);
  }

  function itemCodes(items: { code: string }[] | undefined): string {
    return items ? items.map((i) => i.code).join(', ') : '';
  }
  function accountTypesList(): readonly string[] {
    return constants?.accountTypes ?? ACCOUNT_TYPES;
  }
  function legalRegimesForRegion(region: string): string[] {
    return constants?.legalRegimesByRegion?.[region] ?? LEGAL_REGIMES_FALLBACK[region] ?? [];
  }

  $: if (activeTab === 'charts') loadCharts();
  $: if (activeTab === 'templates') loadTemplates();
</script>

<div>
  <h2 class="text-3xl font-bold mb-6">{t('menu.accounting')}</h2>

  <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'charts'}
      class:shadow-sm={activeTab === 'charts'}
      class:text-accent={activeTab === 'charts'}
      class:text-gray-600={activeTab !== 'charts'}
      class:hover:bg-gray-50={activeTab !== 'charts'}
      class:hover:text-gray-900={activeTab !== 'charts'}
      on:click={() => (activeTab = 'charts')}
    >
      {t('accounting.tabCharts')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'templates'}
      class:shadow-sm={activeTab === 'templates'}
      class:text-accent={activeTab === 'templates'}
      class:text-gray-600={activeTab !== 'templates'}
      class:hover:bg-gray-50={activeTab !== 'templates'}
      class:hover:text-gray-900={activeTab !== 'templates'}
      on:click={() => (activeTab = 'templates')}
    >
      {t('accounting.tabTemplates')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'entries'}
      class:shadow-sm={activeTab === 'entries'}
      class:text-accent={activeTab === 'entries'}
      class:text-gray-600={activeTab !== 'entries'}
      class:hover:bg-gray-50={activeTab !== 'entries'}
      class:hover:text-gray-900={activeTab !== 'entries'}
      on:click={() => (activeTab = 'entries')}
    >
      {t('accounting.tabEntries')}
    </button>
  </div>

  {#if activeTab === 'charts'}
    <div class="bg-dark-light p-6 rounded">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('accounting.chartsTitle')}</h3>
        <button
          on:click={() => (showNewChart = !showNewChart)}
          class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted"
        >
          {showNewChart ? t('common.cancel') : t('accounting.addChart')}
        </button>
      </div>
      {#if showNewChart}
        <div class="flex gap-3 mb-4 p-4 bg-dark rounded">
          <select
            id="new-chart-region"
            bind:value={newChart.region}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          >
            {#each constants?.regions ?? ACCOUNTING_REGIONS as r}
              <option value={r}>{r}</option>
            {/each}
          </select>
          <input
            id="new-chart-name"
            type="text"
            bind:value={newChart.name}
            placeholder={t('accounting.chartNamePlaceholder')}
            class="flex-1 px-3 py-2 bg-white border border-gray-300 text-black rounded"
          />
          <button on:click={createChart} class="px-4 py-2 bg-accent text-dark"
            >{t('common.create')}</button
          >
        </div>
      {/if}
      {#if loading && activeTab === 'charts'}
        <div class="w-full py-8"><LoadingBar /></div>
      {:else}
        <ul class="space-y-2">
          {#each charts as chart}
            <li class="p-3 bg-dark rounded">
              {#if editingChartId === chart.id}
                <div class="flex gap-2 items-center flex-wrap">
                  <input
                    id={`chart-name-${chart.id}`}
                    type="text"
                    bind:value={editingChartName}
                    class="flex-1 min-w-[200px] px-3 py-2 bg-white border border-gray-300 text-black rounded"
                  />
                  <button on:click={saveEditChart} class="px-4 py-2 bg-accent text-dark rounded"
                    >{t('common.save')}</button
                  >
                  <button
                    on:click={cancelEditChart}
                    class="px-4 py-2 bg-dark-light text-accent-muted rounded"
                    >{t('common.cancel')}</button
                  >
                </div>
              {:else}
                <div class="flex justify-between items-start flex-wrap gap-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      on:click={() => toggleChartExpand(chart.id)}
                      class="text-accent-muted hover:text-accent"
                      aria-label={t('common.expand')}
                    >
                      {expandedChartIds.has(chart.id) ? '▼' : '▶'}
                    </button>
                    <span class="font-medium">{chart.name}</span>
                    <span class="text-sm text-accent-muted">({chart.region})</span>
                    {#if chart.items?.length}
                      <span class="text-xs text-accent-muted"
                        >{t('accounting.accountsLabel', { codes: itemCodes(chart.items) })}</span
                      >
                    {/if}
                  </div>
                  <div class="flex gap-2">
                    <button
                      on:click={() => startEditChart(chart)}
                      class="px-2 py-1 text-sm bg-dark-light rounded hover:bg-accent/20"
                      >{t('common.edit')}</button
                    >
                    <button
                      on:click={() => confirmDelete('chart', chart.id)}
                      class="px-2 py-1 text-sm text-red-400 rounded hover:bg-red-400/20"
                      >{t('common.delete')}</button
                    >
                  </div>
                </div>
              {/if}
              {#if expandedChartIds.has(chart.id)}
                <div class="mt-3 pl-6 border-l-2 border-accent/30 space-y-2">
                  <p class="text-sm font-medium text-accent-muted">{t('accounting.chartItems')}</p>
                  <ul class="space-y-1">
                    {#each chart.items || [] as item}
                      <li class="flex items-center gap-2 text-sm">
                        {#if editingChartItemId === item.id}
                          <input
                            id={`chart-item-code-${item.id}`}
                            type="text"
                            bind:value={editingChartItem.code}
                            placeholder={t('common.code')}
                            class="w-16 px-2 py-1 bg-white border text-black rounded"
                          />
                          <input
                            id={`chart-item-name-${item.id}`}
                            type="text"
                            bind:value={editingChartItem.name}
                            placeholder={t('common.name')}
                            class="flex-1 px-2 py-1 bg-white border text-black rounded"
                          />
                          <select
                            id={`chart-item-type-${item.id}`}
                            bind:value={editingChartItem.type}
                            class="px-2 py-1 bg-white border text-black rounded"
                          >
                            {#each accountTypesList() as at}
                              <option value={at}>{at}</option>
                            {/each}
                          </select>
                          <button
                            on:click={saveEditChartItem}
                            class="px-2 py-1 bg-accent text-dark rounded text-xs"
                            >{t('common.ok')}</button
                          >
                          <button on:click={cancelEditChartItem} class="px-2 py-1 rounded text-xs"
                            >{t('common.cancel')}</button
                          >
                        {:else}
                          <span class="font-mono">{item.code}</span>
                          <span>{item.name}</span>
                          <span class="text-accent-muted text-xs">{item.type}</span>
                          <button
                            on:click={() => startEditChartItem(item)}
                            class="text-xs text-accent-muted hover:text-accent"
                            >{t('common.edit')}</button
                          >
                          <button
                            on:click={() => confirmDelete('chartItem', item.id, chart.id)}
                            class="text-xs text-red-400 hover:underline"
                            >{t('common.delete')}</button
                          >
                        {/if}
                      </li>
                    {/each}
                  </ul>
                  <div class="flex gap-2 items-center flex-wrap pt-2">
                    <input
                      id={`new-chart-item-code-${chart.id}`}
                      type="text"
                      value={getNewChartItem(chart.id).code}
                      on:input={(e) => {
                        getNewChartItem(chart.id).code = e.currentTarget?.value ?? '';
                        newChartItemByChartId = newChartItemByChartId;
                      }}
                      placeholder={t('accounting.accountCode')}
                      class="w-20 px-2 py-1 bg-white border text-black rounded"
                    />
                    <input
                      id={`new-chart-item-name-${chart.id}`}
                      type="text"
                      value={getNewChartItem(chart.id).name}
                      on:input={(e) => {
                        getNewChartItem(chart.id).name = e.currentTarget?.value ?? '';
                        newChartItemByChartId = newChartItemByChartId;
                      }}
                      placeholder={t('common.name')}
                      class="w-40 px-2 py-1 bg-white border text-black rounded"
                    />
                    <select
                      id={`new-chart-item-type-${chart.id}`}
                      value={getNewChartItem(chart.id).type}
                      on:change={(e) => {
                        getNewChartItem(chart.id).type = e.currentTarget?.value ?? 'ASSET';
                        newChartItemByChartId = newChartItemByChartId;
                      }}
                      class="px-2 py-1 bg-white border text-black rounded"
                    >
                      {#each accountTypesList() as at}
                        <option value={at}>{at}</option>
                      {/each}
                    </select>
                    <button
                      on:click={() => addChartItem(chart.id)}
                      class="px-3 py-1 bg-accent text-dark rounded text-sm"
                      >{t('accounting.addChartItem')}</button
                    >
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
        {#if charts.length === 0}
          <p class="text-accent-muted">{t('accounting.noCharts')}</p>
        {/if}
      {/if}
      {#if deleteConfirm?.type === 'chart'}
        <div class="mt-4 p-4 bg-dark rounded flex gap-2 items-center">
          <span class="text-accent-muted">{t('accounting.confirmDeleteChart')}</span>
          <button on:click={doDelete} class="px-3 py-1 bg-red-500 text-white rounded"
            >{t('common.yes')}</button
          >
          <button on:click={cancelDelete} class="px-3 py-1 rounded">{t('common.no')}</button>
        </div>
      {/if}
      {#if deleteConfirm?.type === 'chartItem' && activeTab === 'charts'}
        <div class="mt-4 p-4 bg-dark rounded flex gap-2 items-center">
          <span class="text-accent-muted">{t('accounting.confirmDeleteChartItem')}</span>
          <button on:click={doDelete} class="px-3 py-1 bg-red-500 text-white rounded"
            >{t('common.yes')}</button
          >
          <button on:click={cancelDelete} class="px-3 py-1 rounded">{t('common.no')}</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'templates'}
    <div class="bg-dark-light p-6 rounded">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('accounting.templatesTitle')}</h3>
        <button
          on:click={() => (showNewTemplate = !showNewTemplate)}
          class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted"
        >
          {showNewTemplate ? t('common.cancel') : t('accounting.addTemplate')}
        </button>
      </div>
      {#if showNewTemplate}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-4 bg-dark rounded">
          <input
            id="new-template-name"
            type="text"
            bind:value={newTemplate.name}
            placeholder={t('accounting.templateNamePlaceholder')}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          />
          <select
            id="new-template-trigger"
            bind:value={newTemplate.triggerEvent}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          >
            {#if constants?.triggerEvents}
              {#each constants.triggerEvents as ev}
                <option value={ev}>{ev}</option>
              {/each}
            {:else}
              <option value="ORDER_DELIVERED">ORDER_DELIVERED</option>
              <option value="INVENTORY_RECEIVED">INVENTORY_RECEIVED</option>
            {/if}
          </select>
          <input
            id="new-template-debit"
            type="text"
            bind:value={newTemplate.debitAccountCode}
            placeholder={t('accounting.debitAccount')}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          />
          <input
            id="new-template-credit"
            type="text"
            bind:value={newTemplate.creditAccountCode}
            placeholder={t('accounting.creditAccount')}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          />
          <input
            id="new-template-formula"
            type="text"
            bind:value={newTemplate.amountFormula}
            placeholder={t('accounting.amountFormulaPlaceholder')}
            title="order.total, order.subtotal, movement.quantity * movement.purchasePrice, declaration.vatAmount, return.refundAmount; арифметика: * / + -"
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded md:col-span-2"
          />
          <select
            id="new-template-region"
            bind:value={newTemplate.region}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          >
            {#each constants?.regions ?? ACCOUNTING_REGIONS as r}
              <option value={r}>{r}</option>
            {/each}
          </select>
          <select
            id="new-template-regime"
            bind:value={newTemplate.legalRegime}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
            title={t('accounting.legalRegimePlaceholder')}
          >
            <option value="">— {t('accounting.legalRegimePlaceholder')}</option>
            {#each legalRegimesForRegion(newTemplate.region) as regime}
              <option value={regime}>{regime}</option>
            {/each}
          </select>
          <button on:click={createTemplate} class="px-4 py-2 bg-accent text-dark md:col-span-2"
            >{t('common.create')}</button
          >
        </div>
      {/if}
      {#if loading && activeTab === 'templates'}
        <div class="w-full py-8"><LoadingBar /></div>
      {:else}
        <ul class="space-y-2">
          {#each templates as tmpl}
            <li class="p-3 bg-dark rounded">
              {#if editingTemplateId === tmpl.id}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <input
                    id={`edit-template-name-${tmpl.id}`}
                    type="text"
                    bind:value={editingTemplate.name}
                    placeholder={t('common.name')}
                    class="px-3 py-2 bg-white border text-black rounded"
                  />
                  <select
                    id={`edit-template-trigger-${tmpl.id}`}
                    bind:value={editingTemplate.triggerEvent}
                    class="px-3 py-2 bg-white border text-black rounded"
                  >
                    {#if constants?.triggerEvents}
                      {#each constants.triggerEvents as ev}
                        <option value={ev}>{ev}</option>
                      {/each}
                    {:else}
                      <option value="ORDER_DELIVERED">ORDER_DELIVERED</option>
                      <option value="INVENTORY_RECEIVED">INVENTORY_RECEIVED</option>
                    {/if}
                  </select>
                  <input
                    id={`edit-template-debit-${tmpl.id}`}
                    type="text"
                    bind:value={editingTemplate.debitAccountCode}
                    placeholder={t('accounting.debitAccount')}
                    class="px-3 py-2 bg-white border text-black rounded"
                  />
                  <input
                    id={`edit-template-credit-${tmpl.id}`}
                    type="text"
                    bind:value={editingTemplate.creditAccountCode}
                    placeholder={t('accounting.creditAccount')}
                    class="px-3 py-2 bg-white border text-black rounded"
                  />
                  <input
                    id={`edit-template-formula-${tmpl.id}`}
                    type="text"
                    bind:value={editingTemplate.amountFormula}
                    placeholder={t('accounting.amountFormulaPlaceholder')}
                    title="order.total, movement.quantity * movement.purchasePrice, declaration.vatAmount; арифметика * / + -"
                    class="px-3 py-2 bg-white border text-black rounded md:col-span-2"
                  />
                  <select
                    id={`edit-template-region-${tmpl.id}`}
                    bind:value={editingTemplate.region}
                    class="px-3 py-2 bg-white border text-black rounded"
                  >
                    {#each constants?.regions ?? ACCOUNTING_REGIONS as r}
                      <option value={r}>{r}</option>
                    {/each}
                  </select>
                  <select
                    id={`edit-template-regime-${tmpl.id}`}
                    bind:value={editingTemplate.legalRegime}
                    class="px-3 py-2 bg-white border text-black rounded"
                    title={t('accounting.legalRegimePlaceholder')}
                  >
                    <option value="">— {t('accounting.legalRegimePlaceholder')}</option>
                    {#each legalRegimesForRegion(editingTemplate.region) as regime}
                      <option value={regime}>{regime}</option>
                    {/each}
                  </select>
                </div>
                <div class="flex gap-2">
                  <button on:click={saveEditTemplate} class="px-4 py-2 bg-accent text-dark rounded"
                    >{t('common.save')}</button
                  >
                  <button on:click={cancelEditTemplate} class="px-4 py-2 rounded"
                    >{t('common.cancel')}</button
                  >
                </div>
              {:else}
                <div class="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <span class="font-medium">{tmpl.name}</span>
                    <span class="text-sm text-accent-muted ml-2">({tmpl.region})</span>
                    <p class="text-sm mt-1">
                      {t('accounting.templateLine', {
                        debit: tmpl.debitAccountCode,
                        credit: tmpl.creditAccountCode,
                        event: tmpl.triggerEvent,
                      })}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <button
                      on:click={() => startEditTemplate(tmpl)}
                      class="px-2 py-1 text-sm bg-dark-light rounded hover:bg-accent/20"
                      >{t('common.edit')}</button
                    >
                    <button
                      on:click={() => confirmDelete('template', tmpl.id)}
                      class="px-2 py-1 text-sm text-red-400 rounded hover:bg-red-400/20"
                      >{t('common.delete')}</button
                    >
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
        {#if templates.length === 0}
          <p class="text-accent-muted">{t('accounting.noTemplates')}</p>
        {/if}
      {/if}
      {#if deleteConfirm?.type === 'template'}
        <div class="mt-4 p-4 bg-dark rounded flex gap-2 items-center">
          <span class="text-accent-muted">{t('accounting.confirmDeleteTemplate')}</span>
          <button on:click={doDelete} class="px-3 py-1 bg-red-500 text-white rounded"
            >{t('common.yes')}</button
          >
          <button on:click={cancelDelete} class="px-3 py-1 rounded">{t('common.no')}</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'entries'}
    <div class="bg-dark-light p-6 rounded">
      <div class="flex flex-wrap gap-4 mb-4">
        <div>
          <label for="report-start-date" class="block text-sm font-medium mb-1"
            >{t('report.startDate')}</label
          >
          <input
            id="report-start-date"
            type="date"
            bind:value={startDate}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          />
        </div>
        <div>
          <label for="report-end-date" class="block text-sm font-medium mb-1"
            >{t('report.endDate')}</label
          >
          <input
            id="report-end-date"
            type="date"
            bind:value={endDate}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          />
        </div>
        <div>
          <label for="report-region" class="block text-sm font-medium mb-1"
            >{t('report.region')}</label
          >
          <select
            id="report-region"
            bind:value={regionFilter}
            class="px-3 py-2 bg-white border border-gray-300 text-black rounded"
          >
            {#each constants?.regions ?? ACCOUNTING_REGIONS as r}
              <option value={r}>{r}</option>
            {/each}
          </select>
        </div>
        <div class="flex items-end gap-2">
          <button
            on:click={loadEntries}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 text-black rounded hover:bg-gray-100 disabled:opacity-50"
          >
            {t('common.refresh')}
          </button>
          <button
            on:click={generateEntries}
            disabled={generating}
            class="px-4 py-2 bg-accent text-dark rounded hover:bg-accent-muted disabled:opacity-50"
          >
            {generating ? t('accounting.generating') : t('accounting.generateEntries')}
          </button>
          <button
            on:click={exportEntries}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark rounded hover:bg-accent-muted disabled:opacity-50"
          >
            {exporting ? '...' : t('accounting.exportCsv')}
          </button>
        </div>
      </div>
      <p class="text-sm text-accent-muted mb-2">{t('common.total')}: {entriesResult.total}</p>
      {#if loading && activeTab === 'entries'}
        <div class="w-full py-8"><LoadingBar /></div>
      {:else if entriesResult.items.length === 0}
        <p class="text-accent-muted">{t('accounting.noEntries')}</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-white border-b border-accent/20">
              <tr>
                <th class="px-4 py-2 text-left">{t('common.date')}</th>
                <th class="px-4 py-2 text-left">{t('accounting.entity')}</th>
                <th class="px-4 py-2 text-left">{t('accounting.debit')}</th>
                <th class="px-4 py-2 text-left">{t('accounting.credit')}</th>
                <th class="px-4 py-2 text-right">{t('common.amount')}</th>
                <th class="px-4 py-2 text-left">{t('common.currency')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-accent/20">
              {#each entriesResult.items.slice(0, 100) as e}
                <tr>
                  <td class="px-4 py-2"
                    >{e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : ''}</td
                  >
                  <td class="px-4 py-2">{e.entityType} {e.entityId?.slice(0, 8)}</td>
                  <td class="px-4 py-2">{e.debitAccountCode}</td>
                  <td class="px-4 py-2">{e.creditAccountCode}</td>
                  <td class="px-4 py-2 text-right">{toNum(e.amount).toFixed(2)}</td>
                  <td class="px-4 py-2">{e.currency}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if entriesResult.total > 100}
          <p class="text-sm text-accent-muted mt-2">
            {t('accounting.showingFirst100', { total: entriesResult.total })}
          </p>
        {/if}
      {/if}
    </div>
  {/if}
</div>
