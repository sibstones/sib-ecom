<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/utils/i18n';
  import { notificationStore } from '$lib/stores/notification.store';
  import { adminApi } from '$lib/api/admin.api';
  import type { Warehouse } from '$lib/api/admin.api';

  type TabId =
    | 'overview'
    | 'sales'
    | 'customers'
    | 'purchases'
    | 'returns'
    | 'paymentMethods'
    | 'delivery'
    | 'customs'
    | 'tax';

  let loading = false;
  let exporting = false;
  let activeTab: TabId = 'overview';

  let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let endDate = new Date().toISOString().split('T')[0];
  let taxRegion = 'RU';

  let overviewReport: any = null;
  let selectedOverviewCountry = '';
  let selectedOverviewCurrency = '';
  let selectedOverviewSource = '';
  let selectedOverviewWarehouseId = '';
  let salesReport: any = null;
  let customerReport: any[] = [];
  let purchasesReport: any = null;
  let returnsReport: any = null;
  let paymentMethodsReport: any = null;
  let deliveryReport: any = null;
  let customsReport: any = null;
  let taxReport: any = null;
  let warehouses: Warehouse[] = [];
  let selectedWarehouseId = '';

  const baseUrl = '/api/admin/reports';

  function fetchOpts() {
    return { credentials: 'include' as RequestCredentials };
  }

  function formatMoney(value: number | null | undefined) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatPercent(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function getOverviewFilters() {
    return {
      country: selectedOverviewCountry || undefined,
      currency: selectedOverviewCurrency || undefined,
      source: selectedOverviewSource || undefined,
      warehouseId: selectedOverviewWarehouseId || undefined,
    };
  }

  function getOverviewExportQuery() {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (selectedOverviewCountry) params.set('country', selectedOverviewCountry);
    if (selectedOverviewCurrency) params.set('currency', selectedOverviewCurrency);
    if (selectedOverviewSource) params.set('source', selectedOverviewSource);
    if (selectedOverviewWarehouseId) params.set('warehouseId', selectedOverviewWarehouseId);
    return params.toString();
  }

  function formatOrderSourceLabel(source: string | null | undefined) {
    const normalized = String(source || '').trim().toUpperCase();
    if (normalized === 'STORE_ONLINE') return t('order.source.storeOnline');
    if (normalized === 'STORE_OFFLINE') return t('order.source.storeOffline');
    if (normalized === 'MARKETPLACE_WILDBERRIES') return t('order.source.marketplaceWildberries');
    if (normalized === 'MARKETPLACE_OZON') return t('order.source.marketplaceOzon');
    if (normalized === 'MARKETPLACE_WB') return 'WB';
    if (normalized === 'MARKETPLACE_OTHER') return t('order.source.marketplaceOther');
    if (normalized === 'MANUAL') return t('order.source.manual');
    return normalized || 'UNKNOWN';
  }

  async function loadOverviewReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getOverview(startDate, endDate, getOverviewFilters());
      overviewReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadOverview'));
      overviewReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadSalesReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getSales(startDate, endDate);
      salesReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadSales'));
      salesReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadCustomerReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getCustomers(startDate, endDate);
      customerReport = data.report || [];
    } catch (e) {
      notificationStore.error(t('report.failedToLoadCustomer'));
      customerReport = [];
    } finally {
      loading = false;
    }
  }

  async function loadPurchasesReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getPurchases(
        startDate,
        endDate,
        selectedWarehouseId || undefined
      );
      purchasesReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadPurchases'));
      purchasesReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadWarehouses() {
    try {
      const response = await adminApi.getAllWarehouses();
      warehouses = response.warehouses ?? [];
    } catch (e) {
      notificationStore.error(t('report.failedToLoadWarehouses') || 'Failed to load warehouses');
      warehouses = [];
    }
  }

  async function loadDeliveryReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getDelivery(startDate, endDate);
      deliveryReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadDelivery'));
      deliveryReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadReturnsReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getReturns(startDate, endDate);
      returnsReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadReturns'));
      returnsReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadPaymentMethodsReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getPaymentMethods(startDate, endDate);
      paymentMethodsReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadPaymentMethods'));
      paymentMethodsReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadCustomsReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getCustoms(startDate, endDate);
      customsReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadCustoms'));
      customsReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadTaxReport() {
    loading = true;
    try {
      const data = await adminApi.reports.getTaxSummary(startDate, endDate, taxRegion);
      taxReport = data.report;
    } catch (e) {
      notificationStore.error(t('report.failedToLoadTaxSummary'));
      taxReport = null;
    } finally {
      loading = false;
    }
  }

  async function loadAllReports() {
    loading = true;
    try {
      const [
        overviewData,
        salesData,
        customersData,
        purchasesData,
        returnsData,
        paymentMethodsData,
        deliveryData,
        customsData,
        taxData,
      ] =
        await Promise.all([
          adminApi.reports.getOverview(startDate, endDate, getOverviewFilters()),
          adminApi.reports.getSales(startDate, endDate),
          adminApi.reports.getCustomers(startDate, endDate),
          adminApi.reports.getPurchases(startDate, endDate, selectedWarehouseId || undefined),
          adminApi.reports.getReturns(startDate, endDate),
          adminApi.reports.getPaymentMethods(startDate, endDate),
          adminApi.reports.getDelivery(startDate, endDate),
          adminApi.reports.getCustoms(startDate, endDate),
          adminApi.reports.getTaxSummary(startDate, endDate, taxRegion),
        ]);
      overviewReport = overviewData.report;
      salesReport = salesData.report;
      customerReport = customersData.report ?? [];
      purchasesReport = purchasesData.report;
      returnsReport = returnsData.report;
      paymentMethodsReport = paymentMethodsData.report;
      deliveryReport = deliveryData.report;
      customsReport = customsData.report;
      taxReport = taxData.report;
      notificationStore.success(t('report.allReportsLoaded') || 'All reports for period loaded');
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('report.failedToLoadAll'));
    } finally {
      loading = false;
    }
  }

  async function exportReport(path: string, filename: string, hasQuery: boolean = false) {
    if (exporting) return;
    exporting = true;
    try {
      const url = hasQuery ? path : `${path}?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, fetchOpts());
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${filename}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      notificationStore.success(t('report.exportSuccess'));
    } catch (e) {
      notificationStore.error(t('report.failedToExport'));
    } finally {
      exporting = false;
    }
  }

  function exportSales() {
    exportReport(`${baseUrl}/sales/export`, 'sales-report');
  }
  async function exportSalesXLSX() {
    if (exporting) return;
    exporting = true;
    try {
      const url = `${baseUrl}/sales/export/xlsx?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, fetchOpts());
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `sales-report-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(a.href);
      notificationStore.success(t('report.exportSuccess'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('report.failedToExportXlsx'));
    } finally {
      exporting = false;
    }
  }
  function exportCustomers() {
    fetch(`${baseUrl}/customers/export?startDate=${startDate}&endDate=${endDate}`, fetchOpts())
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Export failed'))))
      .then((blob) => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `customer-report-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(a.href);
        notificationStore.success(t('report.exportSuccess'));
      })
      .catch(() => notificationStore.error(t('report.failedToExportCustomer')));
  }
  async function exportCustomersXLSX() {
    if (exporting) return;
    exporting = true;
    try {
      const url = `${baseUrl}/customers/export/xlsx?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, fetchOpts());
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `customer-report-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(a.href);
      notificationStore.success(t('report.exportSuccess'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('report.failedToExportXlsx'));
    } finally {
      exporting = false;
    }
  }
  function exportPurchases() {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (selectedWarehouseId) params.set('warehouseId', selectedWarehouseId);
    exportReport(`${baseUrl}/purchases/export?${params.toString()}`, 'purchases-report', true);
  }
  async function exportReportXLSX(path: string, filename: string, hasQuery: boolean = false) {
    if (exporting) return;
    exporting = true;
    try {
      const url = hasQuery ? path : `${path}?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, fetchOpts());
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `${filename}-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(a.href);
      notificationStore.success(t('report.exportSuccess'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('report.failedToExportXlsx'));
    } finally {
      exporting = false;
    }
  }
  function exportOverview() {
    exportReport(`${baseUrl}/overview/export?${getOverviewExportQuery()}`, 'overview-report', true);
  }
  function exportOverviewXLSX() {
    exportReportXLSX(
      `${baseUrl}/overview/export/xlsx?${getOverviewExportQuery()}`,
      'overview-report',
      true
    );
  }
  function exportPurchasesXLSX() {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (selectedWarehouseId) params.set('warehouseId', selectedWarehouseId);
    exportReportXLSX(
      `${baseUrl}/purchases/export/xlsx?${params.toString()}`,
      'purchases-report',
      true
    );
  }
  function exportDelivery() {
    exportReport(`${baseUrl}/delivery/export`, 'delivery-report');
  }
  function exportDeliveryXLSX() {
    exportReportXLSX(`${baseUrl}/delivery/export/xlsx`, 'delivery-report');
  }
  function exportCustoms() {
    exportReport(`${baseUrl}/customs/export`, 'customs-report');
  }
  function exportCustomsXLSX() {
    exportReportXLSX(`${baseUrl}/customs/export/xlsx`, 'customs-report');
  }
  function exportReturns() {
    exportReport(`${baseUrl}/returns/export`, 'returns-report');
  }
  function exportReturnsXLSX() {
    exportReportXLSX(`${baseUrl}/returns/export/xlsx`, 'returns-report');
  }
  function exportPaymentMethods() {
    exportReport(`${baseUrl}/payment-methods/export`, 'payment-methods-report');
  }
  function exportPaymentMethodsXLSX() {
    exportReportXLSX(`${baseUrl}/payment-methods/export/xlsx`, 'payment-methods-report');
  }
  async function exportTaxSummary() {
    if (exporting) return;
    exporting = true;
    try {
      const url = `${baseUrl}/tax-summary/export?startDate=${startDate}&endDate=${endDate}&region=${taxRegion}`;
      const response = await fetch(url, fetchOpts());
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `tax-summary-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(a.href);
      notificationStore.success(t('report.exportSuccess'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('report.failedToExport'));
    } finally {
      exporting = false;
    }
  }
  async function exportTaxSummaryXLSX() {
    if (exporting) return;
    exporting = true;
    try {
      const url = `${baseUrl}/tax-summary/export/xlsx?startDate=${startDate}&endDate=${endDate}&region=${taxRegion}`;
      const response = await fetch(url, fetchOpts());
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `tax-summary-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(a.href);
      notificationStore.success(t('report.exportSuccess'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('report.failedToExportXlsx'));
    } finally {
      exporting = false;
    }
  }

  function loadCurrentTab() {
    if (activeTab === 'overview') loadOverviewReport();
    else if (activeTab === 'sales') loadSalesReport();
    else if (activeTab === 'customers') loadCustomerReport();
    else if (activeTab === 'purchases') loadPurchasesReport();
    else if (activeTab === 'returns') loadReturnsReport();
    else if (activeTab === 'paymentMethods') loadPaymentMethodsReport();
    else if (activeTab === 'delivery') loadDeliveryReport();
    else if (activeTab === 'customs') loadCustomsReport();
    else if (activeTab === 'tax') loadTaxReport();
  }

  onMount(() => {
    loadWarehouses();
    loadAllReports();
  });
</script>

<div class="admin-reports">
  <h2 class="text-3xl font-bold mb-6">{t('report.reports')}</h2>

  <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'overview'}
      class:shadow-sm={activeTab === 'overview'}
      class:text-accent={activeTab === 'overview'}
      class:text-gray-600={activeTab !== 'overview'}
      class:hover:bg-gray-50={activeTab !== 'overview'}
      class:hover:text-gray-900={activeTab !== 'overview'}
      on:click={() => (activeTab = 'overview')}
    >
      {t('report.overviewReport')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'sales'}
      class:shadow-sm={activeTab === 'sales'}
      class:text-accent={activeTab === 'sales'}
      class:text-gray-600={activeTab !== 'sales'}
      class:hover:bg-gray-50={activeTab !== 'sales'}
      class:hover:text-gray-900={activeTab !== 'sales'}
      on:click={() => (activeTab = 'sales')}
    >
      {t('report.sales')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'customers'}
      class:shadow-sm={activeTab === 'customers'}
      class:text-accent={activeTab === 'customers'}
      class:text-gray-600={activeTab !== 'customers'}
      class:hover:bg-gray-50={activeTab !== 'customers'}
      class:hover:text-gray-900={activeTab !== 'customers'}
      on:click={() => (activeTab = 'customers')}
    >
      {t('report.customers')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'purchases'}
      class:shadow-sm={activeTab === 'purchases'}
      class:text-accent={activeTab === 'purchases'}
      class:text-gray-600={activeTab !== 'purchases'}
      class:hover:bg-gray-50={activeTab !== 'purchases'}
      class:hover:text-gray-900={activeTab !== 'purchases'}
      on:click={() => (activeTab = 'purchases')}
    >
      {t('report.purchasesReport')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'returns'}
      class:shadow-sm={activeTab === 'returns'}
      class:text-accent={activeTab === 'returns'}
      class:text-gray-600={activeTab !== 'returns'}
      class:hover:bg-gray-50={activeTab !== 'returns'}
      class:hover:text-gray-900={activeTab !== 'returns'}
      on:click={() => (activeTab = 'returns')}
    >
      {t('report.returnsReport')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'paymentMethods'}
      class:shadow-sm={activeTab === 'paymentMethods'}
      class:text-accent={activeTab === 'paymentMethods'}
      class:text-gray-600={activeTab !== 'paymentMethods'}
      class:hover:bg-gray-50={activeTab !== 'paymentMethods'}
      class:hover:text-gray-900={activeTab !== 'paymentMethods'}
      on:click={() => (activeTab = 'paymentMethods')}
    >
      {t('report.paymentMethodsReport')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'delivery'}
      class:shadow-sm={activeTab === 'delivery'}
      class:text-accent={activeTab === 'delivery'}
      class:text-gray-600={activeTab !== 'delivery'}
      class:hover:bg-gray-50={activeTab !== 'delivery'}
      class:hover:text-gray-900={activeTab !== 'delivery'}
      on:click={() => (activeTab = 'delivery')}
    >
      {t('report.deliveryReport')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'customs'}
      class:shadow-sm={activeTab === 'customs'}
      class:text-accent={activeTab === 'customs'}
      class:text-gray-600={activeTab !== 'customs'}
      class:hover:bg-gray-50={activeTab !== 'customs'}
      class:hover:text-gray-900={activeTab !== 'customs'}
      on:click={() => (activeTab = 'customs')}
    >
      {t('report.customsReport')}
    </button>
    <button
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'tax'}
      class:shadow-sm={activeTab === 'tax'}
      class:text-accent={activeTab === 'tax'}
      class:text-gray-600={activeTab !== 'tax'}
      class:hover:bg-gray-50={activeTab !== 'tax'}
      class:hover:text-gray-900={activeTab !== 'tax'}
      on:click={() => (activeTab = 'tax')}
    >
      {t('report.taxSummary')}
    </button>
  </div>

  <div class="grid grid-cols-2 gap-4 mb-4">
    <div>
      <label for="start-date" class="block text-sm font-medium mb-2">{t('report.startDate')}</label>
      <input
        id="start-date"
        type="date"
        bind:value={startDate}
        class="w-full px-4 py-2 bg-white border border-gray-300 text-black report-input"
      />
    </div>
    <div>
      <label for="end-date" class="block text-sm font-medium mb-2">{t('report.endDate')}</label>
      <input
        id="end-date"
        type="date"
        bind:value={endDate}
        class="w-full px-4 py-2 bg-white border border-gray-300 text-black report-input"
      />
    </div>
  </div>
  <div class="flex flex-wrap gap-2 mb-4">
    <button
      on:click={loadAllReports}
      disabled={loading}
      class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
    >
      {loading
        ? t('report.loading') || 'Loading...'
        : t('report.loadAllByPeriod') || 'Load all reports for period'}
    </button>
  </div>
  <details class="mb-4 p-3 bg-dark text-sm text-accent-muted report-details-card">
    <summary class="cursor-pointer font-medium text-accent">{t('report.whenEmptyHelp')}</summary>
    <ul class="mt-2 space-y-1 list-disc list-inside">
      <li><strong>{t('report.sales')}</strong>: {t('report.whenEmptySales')}</li>
      <li><strong>{t('report.customers')}</strong>: {t('report.whenEmptyCustomers')}</li>
      <li><strong>{t('report.purchasesReport')}</strong>: {t('report.whenEmptyPurchases')}</li>
      <li><strong>{t('report.returnsReport')}</strong>: {t('report.whenEmptyReturns')}</li>
      <li>
        <strong>{t('report.paymentMethodsReport')}</strong>: {t('report.whenEmptyPaymentMethods')}
      </li>
      <li><strong>{t('report.deliveryReport')}</strong>: {t('report.whenEmptyDelivery')}</li>
      <li><strong>{t('report.customsReport')}</strong>: {t('report.whenEmptyCustoms')}</li>
      <li><strong>{t('report.taxSummary')}</strong>: {t('report.whenEmptyTaxSummary')}</li>
    </ul>
  </details>

  {#if activeTab === 'overview'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="text-xl font-medium">{t('report.overviewReport')}</h3>
          <p class="text-sm text-accent-muted">{t('report.overviewReportHint')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            on:click={loadOverviewReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportOverview}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportCsv')}
          </button>
          <button
            on:click={exportOverviewXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportXlsx')}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div>
          <label for="overview-country" class="block text-sm font-medium mb-2">{t('common.country')}</label>
          <select
            id="overview-country"
            bind:value={selectedOverviewCountry}
            class="w-full px-3 py-2 bg-white border border-gray-300 text-black report-input"
          >
            <option value="">{t('filter.allCountries')}</option>
            {#each overviewReport?.filterOptions?.countries ?? [] as country}
              <option value={country}>{country}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="overview-currency" class="block text-sm font-medium mb-2">{t('common.currency')}</label>
          <select
            id="overview-currency"
            bind:value={selectedOverviewCurrency}
            class="w-full px-3 py-2 bg-white border border-gray-300 text-black report-input"
          >
            <option value="">{t('report.allCurrencies')}</option>
            {#each overviewReport?.filterOptions?.currencies ?? [] as currency}
              <option value={currency}>{currency}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="overview-source" class="block text-sm font-medium mb-2">{t('report.source')}</label>
          <select
            id="overview-source"
            bind:value={selectedOverviewSource}
            class="w-full px-3 py-2 bg-white border border-gray-300 text-black report-input"
          >
            <option value="">{t('report.allSources')}</option>
            {#each overviewReport?.filterOptions?.sources ?? [] as source}
              <option value={source}>{formatOrderSourceLabel(source)}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="overview-warehouse" class="block text-sm font-medium mb-2">{t('report.warehouse')}</label>
          <select
            id="overview-warehouse"
            bind:value={selectedOverviewWarehouseId}
            class="w-full px-3 py-2 bg-white border border-gray-300 text-black report-input"
          >
            <option value="">{t('report.allWarehouses')}</option>
            {#each overviewReport?.filterOptions?.warehouses ?? [] as warehouse}
              <option value={warehouse.id}>{warehouse.name}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if overviewReport?.summary}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalOrders')}</p>
            <p class="text-2xl font-bold">{overviewReport.summary.totalOrders ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.grossRevenue')}</p>
            <p class="text-2xl font-bold">{formatMoney(overviewReport.summary.grossRevenue)}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.netRevenue')}</p>
            <p class="text-2xl font-bold">{formatMoney(overviewReport.summary.netRevenue)}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.averagePaidOrderValue')}</p>
            <p class="text-2xl font-bold">
              {formatMoney(overviewReport.summary.averagePaidOrderValue)}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalRefundAmount')}</p>
            <p class="text-2xl font-bold">
              {formatMoney(overviewReport.summary.totalRefundAmount)}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalPurchaseValue')}</p>
            <p class="text-2xl font-bold">
              {formatMoney(overviewReport.summary.totalPurchaseValue)}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalCustomsCost')}</p>
            <p class="text-2xl font-bold">
              {formatMoney(overviewReport.summary.totalCustomsCost)}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.marginAfterOperations')}</p>
            <p class="text-2xl font-bold">
              {formatMoney(overviewReport.summary.marginAfterOperations)}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="p-3 bg-dark report-row">
            <p class="text-sm text-accent-muted">{t('report.paidOrders')}</p>
            <p class="text-xl font-bold">{overviewReport.summary.paidOrders ?? 0}</p>
          </div>
          <div class="p-3 bg-dark report-row">
            <p class="text-sm text-accent-muted">{t('report.deliveredOrders')}</p>
            <p class="text-xl font-bold">{overviewReport.summary.deliveredOrders ?? 0}</p>
          </div>
          <div class="p-3 bg-dark report-row">
            <p class="text-sm text-accent-muted">{t('report.returnRate')}</p>
            <p class="text-xl font-bold">{formatPercent(overviewReport.summary.returnRate)}</p>
          </div>
          <div class="p-3 bg-dark report-row">
            <p class="text-sm text-accent-muted">{t('report.deliveryRate')}</p>
            <p class="text-xl font-bold">{formatPercent(overviewReport.summary.deliveryRate)}</p>
          </div>
        </div>

        <div class="grid lg:grid-cols-2 gap-6">
          <div>
            <h4 class="font-medium mb-3">{t('report.ordersByCountry')}</h4>
            {#if overviewReport.breakdowns?.countries?.length}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-white border-b border-accent/20">
                    <tr>
                      <th class="px-4 py-2 text-left">{t('common.country')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalOrders')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalRevenue')}</th>
                      <th class="px-4 py-2 text-right">{t('report.shareOfOrders')}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-accent/20">
                    {#each overviewReport.breakdowns.countries.slice(0, 8) as country}
                      <tr>
                        <td class="px-4 py-2">{country.country}</td>
                        <td class="px-4 py-2 text-right">{country.totalOrders}</td>
                        <td class="px-4 py-2 text-right">{formatMoney(country.grossRevenue)}</td>
                        <td class="px-4 py-2 text-right">{formatPercent(country.shareOfOrders)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-accent-muted">{t('report.noOverviewData')}</p>
            {/if}
          </div>

          <div>
            <h4 class="font-medium mb-3">{t('report.revenueByCurrency')}</h4>
            {#if overviewReport.breakdowns?.currencies?.length}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-white border-b border-accent/20">
                    <tr>
                      <th class="px-4 py-2 text-left">{t('common.currency')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalOrders')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-accent/20">
                    {#each overviewReport.breakdowns.currencies.slice(0, 8) as currency}
                      <tr>
                        <td class="px-4 py-2">{currency.currency}</td>
                        <td class="px-4 py-2 text-right">{currency.totalOrders}</td>
                        <td class="px-4 py-2 text-right">{formatMoney(currency.grossRevenue)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-accent-muted">{t('report.noOverviewData')}</p>
            {/if}
          </div>

          <div>
            <h4 class="font-medium mb-3">{t('report.ordersBySource')}</h4>
            {#if overviewReport.breakdowns?.sources?.length}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-white border-b border-accent/20">
                    <tr>
                      <th class="px-4 py-2 text-left">{t('report.source')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalOrders')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-accent/20">
                    {#each overviewReport.breakdowns.sources.slice(0, 8) as source}
                      <tr>
                        <td class="px-4 py-2">{formatOrderSourceLabel(source.source)}</td>
                        <td class="px-4 py-2 text-right">{source.totalOrders}</td>
                        <td class="px-4 py-2 text-right">{formatMoney(source.grossRevenue)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-accent-muted">{t('report.noOverviewData')}</p>
            {/if}
          </div>

          <div>
            <h4 class="font-medium mb-3">{t('report.ordersByWarehouse')}</h4>
            {#if overviewReport.breakdowns?.warehouses?.length}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-white border-b border-accent/20">
                    <tr>
                      <th class="px-4 py-2 text-left">{t('report.warehouse')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalOrders')}</th>
                      <th class="px-4 py-2 text-right">{t('report.totalRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-accent/20">
                    {#each overviewReport.breakdowns.warehouses.slice(0, 8) as warehouse}
                      <tr>
                        <td class="px-4 py-2">{warehouse.warehouseName}</td>
                        <td class="px-4 py-2 text-right">{warehouse.totalOrders}</td>
                        <td class="px-4 py-2 text-right">{formatMoney(warehouse.grossRevenue)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-accent-muted">{t('report.noOverviewData')}</p>
            {/if}
          </div>
        </div>
      {:else}
        <p class="text-accent-muted">{t('report.noOverviewData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Sales -->
  {#if activeTab === 'sales'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.salesReport')}</h3>
        <div class="flex gap-2">
          <button
            on:click={loadSalesReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportSales}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportCsv')}
          </button>
          <button
            on:click={exportSalesXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportXlsx') || 'Export XLSX'}
          </button>
        </div>
      </div>
      {#if salesReport?.summary}
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalRevenue')}</p>
            <p class="text-2xl font-bold">
              ${salesReport.summary.totalRevenue?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalOrders')}</p>
            <p class="text-2xl font-bold">{salesReport.summary.totalOrders ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.averageOrderValue')}</p>
            <p class="text-2xl font-bold">
              ${salesReport.summary.averageOrderValue?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>
        {#if salesReport.productSales?.length}
          <h4 class="font-medium mb-2">{t('report.topProducts')}</h4>
          <div class="space-y-2">
            {#each salesReport.productSales.slice(0, 10) as product}
              <div class="flex justify-between p-2 bg-dark report-row">
                <span>{product.name}</span>
                <span
                  >${product.revenue?.toFixed(2) || '0.00'} ({product.quantity ?? 0}
                  {t('report.sold')})</span
                >
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <p class="text-accent-muted">{t('report.noSalesData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Customers -->
  {#if activeTab === 'customers'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.customerReport')}</h3>
        <div class="flex gap-2">
          <button
            on:click={loadCustomerReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportCustomers}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {t('report.exportCsv')}
          </button>
          <button
            on:click={exportCustomersXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportXlsx')}
          </button>
        </div>
      </div>
      {#if customerReport?.length}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-white border-b border-accent/20">
              <tr>
                <th class="px-4 py-2 text-left text-sm font-medium">{t('report.email')}</th>
                <th class="px-4 py-2 text-left text-sm font-medium">{t('report.name')}</th>
                <th class="px-4 py-2 text-left text-sm font-medium">{t('report.orders')}</th>
                <th class="px-4 py-2 text-left text-sm font-medium">{t('report.totalSpent')}</th>
                <th class="px-4 py-2 text-left text-sm font-medium">{t('report.avgOrder')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-accent/20">
              {#each customerReport.slice(0, 50) as customer}
                <tr>
                  <td class="px-4 py-2">{customer.email}</td>
                  <td class="px-4 py-2">{customer.name || t('common.n/a')}</td>
                  <td class="px-4 py-2">{customer.totalOrders}</td>
                  <td class="px-4 py-2">${customer.totalSpent?.toFixed(2) || '0.00'}</td>
                  <td class="px-4 py-2">${customer.averageOrderValue?.toFixed(2) || '0.00'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-accent-muted">{t('report.noCustomerData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Purchases -->
  {#if activeTab === 'purchases'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.purchasesReport')}</h3>
        <div class="flex flex-wrap gap-2 items-center">
          <label for="warehouse-filter" class="text-sm font-medium">{t('report.warehouse')}</label>
          <select
            id="warehouse-filter"
            bind:value={selectedWarehouseId}
            class="px-3 py-2 bg-white border border-gray-300 text-black report-input"
          >
            <option value="">{t('report.allWarehouses')}</option>
            {#each warehouses as warehouse}
              <option value={warehouse.id}>{warehouse.name}</option>
            {/each}
          </select>
          <button
            on:click={loadPurchasesReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportPurchases}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {t('report.exportCsv')}
          </button>
          <button
            on:click={exportPurchasesXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {t('report.exportXlsx') || 'Export XLSX'}
          </button>
        </div>
      </div>
      {#if purchasesReport?.summary}
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalMovements')}</p>
            <p class="text-2xl font-bold">{purchasesReport.summary.totalMovements ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalPurchaseValue')}</p>
            <p class="text-2xl font-bold">
              ${purchasesReport.summary.totalPurchaseValue?.toFixed(2) ?? '0.00'}
            </p>
          </div>
        </div>
        {#if purchasesReport.movements?.length}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-white border-b border-accent/20">
                <tr>
                  <th class="px-4 py-2 text-left">{t('report.startDate')}</th>
                  <th class="px-4 py-2 text-left">{t('report.document')}</th>
                  <th class="px-4 py-2 text-left">{t('report.warehouse')}</th>
                  <th class="px-4 py-2 text-left">{t('report.supplier')}</th>
                  <th class="px-4 py-2 text-right">{t('report.quantity')}</th>
                  <th class="px-4 py-2 text-right">{t('report.amount')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-accent/20">
                {#each purchasesReport.movements.slice(0, 30) as m}
                  <tr>
                    <td class="px-4 py-2"
                      >{m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : ''}</td
                    >
                    <td class="px-4 py-2">{m.documentNumber ?? '—'}</td>
                    <td class="px-4 py-2">{m.warehouse?.name ?? '—'}</td>
                    <td class="px-4 py-2">{m.supplierName ?? '—'}</td>
                    <td class="px-4 py-2 text-right">{m.quantity}</td>
                    <td class="px-4 py-2 text-right">
                      {m.purchasePrice != null
                        ? (Number(m.purchasePrice) * m.quantity).toFixed(2)
                        : '—'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {:else}
        <p class="text-accent-muted">{t('report.noPurchasesData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Returns -->
  {#if activeTab === 'returns'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.returnsReport')}</h3>
        <div class="flex gap-2">
          <button
            on:click={loadReturnsReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportReturns}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportCsv')}
          </button>
          <button
            on:click={exportReturnsXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportXlsx')}
          </button>
        </div>
      </div>
      {#if returnsReport?.summary}
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalReturns')}</p>
            <p class="text-2xl font-bold">{returnsReport.summary.totalReturns ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalRefundAmount')}</p>
            <p class="text-2xl font-bold">
              ${returnsReport.summary.totalRefundAmount?.toFixed(2) ?? '0.00'}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalReturnItems')}</p>
            <p class="text-2xl font-bold">{returnsReport.summary.totalItems ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('orderDetail.returnStatusRequested')}</p>
            <p class="text-xl font-bold">{returnsReport.summary.requested ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('orderDetail.returnStatusProcessing')}</p>
            <p class="text-xl font-bold">{returnsReport.summary.processing ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('orderDetail.returnStatusCompleted')}</p>
            <p class="text-xl font-bold">{returnsReport.summary.completed ?? 0}</p>
          </div>
        </div>
        {#if returnsReport.returnRequests?.length}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-white border-b border-accent/20">
                <tr>
                  <th class="px-4 py-2 text-left">{t('report.order')}</th>
                  <th class="px-4 py-2 text-left">{t('report.customer')}</th>
                  <th class="px-4 py-2 text-left">{t('admin.returns.reason')}</th>
                  <th class="px-4 py-2 text-left">{t('admin.returns.status')}</th>
                  <th class="px-4 py-2 text-left">{t('admin.returns.refundMethod')}</th>
                  <th class="px-4 py-2 text-right">{t('admin.returns.refundAmount')}</th>
                  <th class="px-4 py-2 text-left">{t('report.date')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-accent/20">
                {#each returnsReport.returnRequests.slice(0, 30) as request}
                  <tr>
                    <td class="px-4 py-2">{request.order?.orderNumber ?? '—'}</td>
                    <td class="px-4 py-2">{request.order?.user?.email ?? '—'}</td>
                    <td class="px-4 py-2">{request.reason ?? '—'}</td>
                    <td class="px-4 py-2">{request.status ?? '—'}</td>
                    <td class="px-4 py-2">{request.refundMethod ?? '—'}</td>
                    <td class="px-4 py-2 text-right">
                      {request.refundAmount != null ? Number(request.refundAmount).toFixed(2) : '—'}
                    </td>
                    <td class="px-4 py-2">
                      {request.createdAt ? new Date(request.createdAt).toISOString().split('T')[0] : '—'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {:else}
        <p class="text-accent-muted">{t('report.noReturnsData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Payment Methods -->
  {#if activeTab === 'paymentMethods'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.paymentMethodsReport')}</h3>
        <div class="flex gap-2">
          <button
            on:click={loadPaymentMethodsReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportPaymentMethods}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportCsv')}
          </button>
          <button
            on:click={exportPaymentMethodsXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportXlsx')}
          </button>
        </div>
      </div>
      {#if paymentMethodsReport?.summary}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalOrders')}</p>
            <p class="text-2xl font-bold">{paymentMethodsReport.summary.totalOrders ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.paidOrders')}</p>
            <p class="text-2xl font-bold">{paymentMethodsReport.summary.paidOrders ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalRevenue')}</p>
            <p class="text-2xl font-bold">
              ${paymentMethodsReport.summary.paidRevenue?.toFixed(2) ?? '0.00'}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalRefundAmount')}</p>
            <p class="text-2xl font-bold">
              ${paymentMethodsReport.summary.refundAmount?.toFixed(2) ?? '0.00'}
            </p>
          </div>
        </div>
        {#if paymentMethodsReport.methods?.length}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-white border-b border-accent/20">
                <tr>
                  <th class="px-4 py-2 text-left">{t('order.paymentMethod')}</th>
                  <th class="px-4 py-2 text-right">{t('report.totalOrders')}</th>
                  <th class="px-4 py-2 text-right">{t('report.paidOrders')}</th>
                  <th class="px-4 py-2 text-right">{t('report.refundedOrders')}</th>
                  <th class="px-4 py-2 text-right">{t('report.failedOrders')}</th>
                  <th class="px-4 py-2 text-right">{t('report.totalRevenue')}</th>
                  <th class="px-4 py-2 text-right">{t('report.totalRefundAmount')}</th>
                  <th class="px-4 py-2 text-right">{t('report.netRevenue')}</th>
                  <th class="px-4 py-2 text-right">{t('report.conversionToPaid')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-accent/20">
                {#each paymentMethodsReport.methods as method}
                  <tr>
                    <td class="px-4 py-2">{method.paymentMethod}</td>
                    <td class="px-4 py-2 text-right">{method.totalOrders}</td>
                    <td class="px-4 py-2 text-right">{method.paidOrders}</td>
                    <td class="px-4 py-2 text-right">{method.refundedOrders}</td>
                    <td class="px-4 py-2 text-right">{method.failedOrders}</td>
                    <td class="px-4 py-2 text-right">${Number(method.paidRevenue).toFixed(2)}</td>
                    <td class="px-4 py-2 text-right">${Number(method.refundAmount).toFixed(2)}</td>
                    <td class="px-4 py-2 text-right">${Number(method.netRevenue).toFixed(2)}</td>
                    <td class="px-4 py-2 text-right">{Number(method.conversionToPaid).toFixed(1)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p class="mt-3 text-xs text-accent-muted">{t('report.paymentMethodsGatewayNote')}</p>
        {/if}
      {:else}
        <p class="text-accent-muted">{t('report.noPaymentMethodsData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Delivery -->
  {#if activeTab === 'delivery'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.deliveryReport')}</h3>
        <div class="flex gap-2">
          <button
            on:click={loadDeliveryReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportDelivery}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {t('report.exportCsv')}
          </button>
          <button
            on:click={exportDeliveryXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {t('report.exportXlsx') || 'Export XLSX'}
          </button>
        </div>
      </div>
      {#if deliveryReport?.summary}
        <p class="text-sm text-accent-muted mb-4">
          {t('report.totalOrders')}: {deliveryReport.summary.totalOrders ?? 0}
        </p>
        {#if deliveryReport.orders?.length}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-white border-b border-accent/20">
                <tr>
                  <th class="px-4 py-2 text-left">{t('report.order')}</th>
                  <th class="px-4 py-2 text-left">{t('report.shipmentDate')}</th>
                  <th class="px-4 py-2 text-left">{t('report.customer')}</th>
                  <th class="px-4 py-2 text-left">{t('report.carrier')}</th>
                  <th class="px-4 py-2 text-right">{t('report.amount')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-accent/20">
                {#each deliveryReport.orders.slice(0, 30) as o}
                  <tr>
                    <td class="px-4 py-2">{o.orderNumber}</td>
                    <td class="px-4 py-2"
                      >{o.shippedAt ? new Date(o.shippedAt).toISOString().split('T')[0] : '—'}</td
                    >
                    <td class="px-4 py-2">{o.user?.email ?? '—'}</td>
                    <td class="px-4 py-2">{o.carrierName ?? '—'}</td>
                    <td class="px-4 py-2 text-right"
                      >{o.total != null ? Number(o.total).toFixed(2) : '—'}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {:else}
        <p class="text-accent-muted">{t('report.noDeliveryData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Customs -->
  {#if activeTab === 'customs'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.customsReport')}</h3>
        <div class="flex gap-2">
          <button
            on:click={loadCustomsReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportCustoms}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {t('report.exportCsv')}
          </button>
          <button
            on:click={exportCustomsXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {t('report.exportXlsx') || 'Export XLSX'}
          </button>
        </div>
      </div>
      {#if customsReport?.summary}
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalDeclarations')}</p>
            <p class="text-2xl font-bold">{customsReport.summary.totalDeclarations ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.customsVat')}</p>
            <p class="text-2xl font-bold">
              ${customsReport.summary.totalVat?.toFixed(2) ?? '0.00'}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.customsDuty')}</p>
            <p class="text-2xl font-bold">
              ${customsReport.summary.totalDuty?.toFixed(2) ?? '0.00'}
            </p>
          </div>
        </div>
        {#if customsReport.declarations?.length}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-white border-b border-accent/20">
                <tr>
                  <th class="px-4 py-2 text-left">{t('report.number')}</th>
                  <th class="px-4 py-2 text-left">{t('report.date')}</th>
                  <th class="px-4 py-2 text-left">{t('report.direction')}</th>
                  <th class="px-4 py-2 text-right">{t('report.amount')}</th>
                  <th class="px-4 py-2 text-right">{t('report.customsVat')}</th>
                  <th class="px-4 py-2 text-right">{t('report.customsDuty')}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-accent/20">
                {#each customsReport.declarations as d}
                  <tr>
                    <td class="px-4 py-2">{d.declarationNumber}</td>
                    <td class="px-4 py-2"
                      >{d.declarationDate
                        ? new Date(d.declarationDate).toISOString().split('T')[0]
                        : ''}</td
                    >
                    <td class="px-4 py-2">{d.direction}</td>
                    <td class="px-4 py-2 text-right"
                      >{d.totalCustomsValue != null
                        ? Number(d.totalCustomsValue).toFixed(2)
                        : '—'}</td
                    >
                    <td class="px-4 py-2 text-right"
                      >{d.vatAmount != null ? Number(d.vatAmount).toFixed(2) : '—'}</td
                    >
                    <td class="px-4 py-2 text-right"
                      >{d.dutyAmount != null ? Number(d.dutyAmount).toFixed(2) : '—'}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {:else}
        <p class="text-accent-muted">{t('report.noCustomsData')}</p>
      {/if}
    </div>
  {/if}

  <!-- Tax Summary -->
  {#if activeTab === 'tax'}
    <div class="bg-dark-light p-6 report-card">
      <div class="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('report.taxSummary')}</h3>
        <div class="flex gap-2 items-center">
          <label for="tax-region" class="text-sm font-medium">{t('report.region')}</label>
          <select
            id="tax-region"
            bind:value={taxRegion}
            class="px-3 py-2 bg-white border border-gray-300 text-black report-input"
          >
            <option value="RU">RU</option>
            <option value="US">US</option>
            <option value="AE">{t('report.regionAE')}</option>
            <option value="HK">{t('report.regionHK')}</option>
            <option value="CN">CN</option>
            <option value="EU">EU</option>
          </select>
          <button
            on:click={loadTaxReport}
            disabled={loading}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 text-black report-btn report-btn-secondary"
          >
            {t('report.generateReport')}
          </button>
          <button
            on:click={exportTaxSummary}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportCsv')}
          </button>
          <button
            on:click={exportTaxSummaryXLSX}
            disabled={exporting}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50 report-btn"
          >
            {exporting ? t('report.exporting') : t('report.exportXlsx')}
          </button>
        </div>
      </div>
      {#if taxReport?.summary}
        <p class="text-sm text-accent-muted mb-2">
          {t('report.region')}: {taxReport.region ?? taxRegion}
        </p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalRevenue')}</p>
            <p class="text-xl font-bold">${taxReport.summary.totalRevenue?.toFixed(2) ?? '0.00'}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalOrders')}</p>
            <p class="text-xl font-bold">{taxReport.summary.totalOrders ?? 0}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('report.totalPurchaseValue')}</p>
            <p class="text-xl font-bold">
              ${taxReport.summary.totalPurchaseValue?.toFixed(2) ?? '0.00'}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">
              {t('report.customsVat')} / {t('report.customsDuty')}
            </p>
            <p class="text-xl font-bold">
              ${taxReport.summary.customsVat?.toFixed(2) ?? '0.00'} / ${taxReport.summary.customsDuty?.toFixed(
                2
              ) ?? '0.00'}
            </p>
          </div>
        </div>
      {:else}
        <p class="text-accent-muted"></p>
      {/if}
    </div>
  {/if}
</div>
