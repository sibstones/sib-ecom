<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi, type ProductImportResult } from '$lib/api/admin.api';
  import { productApi, type Product } from '$lib/api/product.api';
  import { goto } from '$app/navigation';
  import { getProductImageAlt, getFirstMedia, isVideoUrl } from '$lib/utils/image.utils';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { t } from '$lib/utils/i18n';
  import { getErrorMessage } from '$lib/utils/error-handler';
  import { notificationStore } from '$lib/stores/notification.store';
  import { i18nStore } from '$lib/stores/i18n.store';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import DateRangePicker from '$lib/components/admin/DateRangePicker.svelte';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import { get } from 'svelte/store';

  let products: Product[] = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let totalPages = 1;
  let searchQuery = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let activeFilter: string = ''; // '' = all, 'true' = active, 'false' = inactive
  let dateFrom = '';
  let dateTo = '';
  let sortBy: 'createdAt' | 'name' | 'price' = 'createdAt';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let showImportPanel = false;
  let importArchive: File | null = null;
  let importLoading = false;
  let importResult: ProductImportResult | null = null;
  let importError = '';
  let importInputRef: HTMLInputElement | null = null;

  onMount(async () => {
    await loadProducts();
  });

  async function loadProducts() {
    loading = true;
    try {
      // Convert string to boolean or null
      let isActiveFilter: boolean | null = null;
      if (activeFilter === 'true') {
        isActiveFilter = true;
      } else if (activeFilter === 'false') {
        isActiveFilter = false;
      }

      const response = await adminApi.getAllProducts(
        currentPage,
        20,
        searchQuery || undefined,
        isActiveFilter,
        { sortBy, sortOrder },
        { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
      );
      products = response.products;
      totalPages = response.pagination.totalPages;
    } catch (e) {
      error = getErrorMessage(e, 'shop.failedToLoadProducts');
    } finally {
      loading = false;
    }
  }

  function handleActiveFilterChange() {
    currentPage = 1;
    loadProducts();
  }

  async function deleteProduct(id: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const product = products.find((p) => p.id === id);
    const productName = product?.name || 'product';

    // Use custom dialog instead of browser confirm
    const confirmed = await dialogStore.confirm(
      t('alert.deleteProduct', { name: productName }),
      t('product.deleteProduct'),
      t('common.delete'),
      t('common.cancel')
    );

    console.log('Delete confirmation:', confirmed, 'for product:', id);

    if (!confirmed) {
      console.log('Delete cancelled by user');
      return;
    }

    const originalProducts = [...products];

    try {
      console.log('Starting delete for product:', id);
      loading = true;
      error = '';

      // Optimistically remove product from UI immediately
      products = products.filter((p) => p.id !== id);

      const response = await adminApi.deleteProduct(id);
      console.log('Delete response:', response);

      // Reload products to ensure sync with server
      await loadProducts();
      console.log('Products reloaded after delete');
    } catch (e) {
      // Restore original products list on error
      products = originalProducts;

      const errorMessage = e instanceof Error ? e.message : 'Failed to delete product';
      console.error('Error deleting product:', e);
      console.error('Error details:', {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });

      // Check if error is about foreign key constraints (product is referenced by orders)
      const isReferencedError =
        errorMessage.includes('referenced by orders') || errorMessage.includes('referenced by');

      if (isReferencedError) {
        // Offer to deactivate instead of delete
        const deactivateConfirmed = await dialogStore.confirm(
          `Cannot delete "${productName}" because it is referenced by orders or other records.\n\nWould you like to deactivate it instead? Deactivated products will be hidden from the store but remain in the system.`,
          'Cannot Delete Product',
          'Deactivate',
          'Cancel'
        );

        if (deactivateConfirmed) {
          try {
            await adminApi.updateProduct(id, { isActive: false });
            await loadProducts();
            await dialogStore.alert(
              t('product.deactivated', { name: productName }),
              t('common.success')
            );
          } catch (deactivateError) {
            const deactivateErrorMessage =
              deactivateError instanceof Error
                ? deactivateError.message
                : t('product.failedToDeactivate');
            error = `Failed to deactivate ${productName}: ${deactivateErrorMessage}`;
            await dialogStore.alert(deactivateErrorMessage, t('common.error'));
            await loadProducts();
          }
        } else {
          await loadProducts();
        }
      } else {
        error = `Failed to delete ${productName}: ${errorMessage}`;
        await dialogStore.alert(errorMessage, t('common.error'));
        await loadProducts();
      }
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadProducts();
    }, 300);
  }

  function handleImportArchiveSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    importArchive = target.files?.[0] || null;
    importError = '';
    importResult = null;
  }

  async function runImport() {
    if (!importArchive) {
      importError = t('productImport.chooseZipFirst');
      return;
    }

    importLoading = true;
    importError = '';
    importResult = null;

    try {
      importResult = await adminApi.importProducts(importArchive);
      await loadProducts();
      notificationStore.success(
        t('productImport.importFinished', {
          created: importResult.created,
          failed: importResult.failed,
        })
      );
    } catch (e) {
      importError = getErrorMessage(e, 'notification.error');
    } finally {
      importLoading = false;
    }
  }

  function downloadImportTemplate() {
    const languageCode = get(i18nStore) || 'en';
    window.location.href = `/api/products/import/template?lang=${encodeURIComponent(languageCode)}`;
  }

  function getImportRowMessage(row: ProductImportResult['rows'][number]) {
    if (row.messageKey) {
      return t(row.messageKey, row.messageParams);
    }
    return row.message;
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6 gap-4 flex-wrap">
    <h2 class="text-3xl font-bold">{t('menu.products')}</h2>
    <div class="flex gap-3 flex-wrap">
      <button
        type="button"
        on:click={() => {
          showImportPanel = !showImportPanel;
        }}
        class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
      >
        {t('productImport.massImport')}
      </button>
      <a
        href="/admin/products/new"
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('common.add')}
        {t('menu.products')}
      </a>
    </div>
  </div>

  {#if showImportPanel}
    <div class="mb-6 border border-gray-300 bg-white p-5 space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-black">{t('productImport.title')}</h3>
          <p class="text-sm text-gray-600">
            {t('productImport.description')}
          </p>
        </div>
        <button
          type="button"
          on:click={downloadImportTemplate}
          class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-sm text-black"
        >
          {t('productImport.downloadTemplate')}
        </button>
      </div>

      <div class="flex flex-wrap gap-3 items-center">
        <input
          bind:this={importInputRef}
          type="file"
          accept=".zip,application/zip"
          class="hidden"
          on:change={handleImportArchiveSelect}
        />
        <button
          type="button"
          on:click={() => importInputRef?.click()}
          class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
        >
          {t('productImport.chooseZip')}
        </button>
        <button
          type="button"
          on:click={runImport}
          disabled={!importArchive || importLoading}
          class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
        >
          {importLoading ? t('productImport.importing') : t('productImport.runImport')}
        </button>
        <span class="text-sm text-gray-600">
          {importArchive ? importArchive.name : t('productImport.noFileSelected')}
        </span>
      </div>

      {#if importError}
        <p class="text-sm text-red-500">{importError}</p>
      {/if}

      {#if importResult}
        <div class="border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div class="flex flex-wrap gap-4 text-sm text-black">
            <span>{t('productImport.totalRows')}: {importResult.totalRows}</span>
            <span>{t('productImport.created')}: {importResult.created}</span>
            <span>{t('productImport.withWarnings')}: {importResult.warnings}</span>
            <span>{t('productImport.failed')}: {importResult.failed}</span>
            <span>{t('productImport.skipped')}: {importResult.skipped}</span>
          </div>

          <div class="max-h-64 overflow-auto border border-gray-200 bg-white">
            <table class="w-full text-sm">
              <thead class="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">{t('productImport.row')}</th>
                  <th class="px-3 py-2 text-left font-medium">SKU</th>
                  <th class="px-3 py-2 text-left font-medium">{t('productImport.status')}</th>
                  <th class="px-3 py-2 text-left font-medium">{t('productImport.message')}</th>
                </tr>
              </thead>
              <tbody>
                {#each importResult.rows as row}
                  <tr class="border-b border-gray-100 align-top">
                    <td class="px-3 py-2">{row.row}</td>
                    <td class="px-3 py-2 font-mono">{row.sku || '—'}</td>
                    <td class="px-3 py-2">
                      {#if row.status === 'created'}
                        <span class="text-green-700">{t('productImport.statusCreated')}</span>
                      {:else if row.status === 'created_with_warnings'}
                        <span class="text-amber-700"
                          >{t('productImport.statusCreatedWithWarnings')}</span
                        >
                      {:else if row.status === 'skipped'}
                        <span class="text-gray-500">{t('productImport.statusSkipped')}</span>
                      {:else}
                        <span class="text-red-600">{t('productImport.statusFailed')}</span>
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-gray-700">{getImportRowMessage(row)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap gap-4 items-end">
    <input
      type="text"
      bind:value={searchQuery}
      on:input={handleSearch}
      placeholder={t('product.searchPlaceholder')}
      class="w-full flex-1 min-w-[280px] px-4 py-2 bg-white border border-gray-300 text-black"
    />
    <CustomSelect
      bind:value={sortBy}
      fitContent={true}
      options={[
        { value: 'createdAt', label: t('order.date') },
        { value: 'name', label: t('common.name') },
        { value: 'price', label: t('common.price') },
      ]}
      on:change={() => {
        currentPage = 1;
        loadProducts();
      }}
    />
    <CustomSelect
      bind:value={sortOrder}
      fitContent={true}
      options={[
        { value: 'desc', label: t('admin.sortNewestFirst') },
        { value: 'asc', label: t('admin.sortOldestFirst') },
      ]}
      on:change={() => {
        currentPage = 1;
        loadProducts();
      }}
    />
    <CustomSelect
      bind:value={activeFilter}
      fitContent={true}
      options={[
        { value: '', label: t('product.filterAll') },
        { value: 'true', label: t('product.filterActive') },
        { value: 'false', label: t('product.filterInactive') },
      ]}
      on:change={handleActiveFilterChange}
    />
    <DateRangePicker
      bind:dateFrom
      bind:dateTo
      tight={true}
      on:change={() => {
        currentPage = 1;
        loadProducts();
      }}
    />
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if products.length === 0}
    <p class="text-accent-muted">{t('product.noProducts')}</p>
  {:else}
    <div class="bg-white overflow-hidden">
      <table class="w-full">
        <thead class="bg-white border-b border-accent/20">
          <tr>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('product.images')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.name')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('product.sku')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.price')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('product.category')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.status')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-accent/20">
          {#each products as product}
            {@const firstMedia = getFirstMedia(product.images)}
            <tr>
              <td class="px-6 py-4">
                {#if firstMedia}
                  {#if isVideoUrl(firstMedia.url)}
                    <video
                      src={firstMedia.url}
                      class="w-16 h-16 object-contain bg-gray-100"
                      muted
                      playsinline
                      preload="metadata"
                    ></video>
                  {:else}
                    <img
                      src={firstMedia.url}
                      alt={getProductImageAlt(firstMedia.alt, product.name)}
                      class="w-16 h-16 object-contain bg-gray-100"
                    />
                  {/if}
                {:else}
                  <div
                    class="w-16 h-16 bg-gray-200 flex items-center justify-center text-gray-400 text-xs"
                  >
                    {t('product.images')}
                  </div>
                {/if}
              </td>
              <td class="px-6 py-4 font-medium">{product.name}</td>
              <td class="px-6 py-4 font-mono text-sm">{product.sku}</td>
              <td class="px-6 py-4">${product.price}</td>
              <td class="px-6 py-4">{product.category?.name || 'N/A'}</td>
              <td class="px-6 py-4">
                <span
                  class="px-2 py-1 text-xs {product.isActive
                    ? 'bg-dark-light text-green-400'
                    : 'bg-red-500/20 text-red-400'}"
                >
                  {product.isActive ? t('common.active') : t('common.inactive')}
                </span>
                {#if product.isFeatured}
                  <span class="px-2 text-xs bg-dark-light text-blue-400">
                    {t('product.isFeatured')}
                  </span>
                {/if}
              </td>
              <td class="px-6 py-4">
                <div class="flex gap-2">
                  <a
                    href="/admin/products/{product.id}"
                    class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-sm text-black"
                  >
                    {t('common.edit')}
                  </a>
                  <button
                    type="button"
                    on:click={(e) => deleteProduct(product.id, e)}
                    class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-sm text-black"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 mt-6">
        <button
          on:click={() => {
            currentPage--;
            loadProducts();
          }}
          disabled={currentPage === 1}
          class="px-4 py-2 bg-dark-light border border-accent/20 disabled:opacity-50"
        >
          {t('common.previous')}
        </button>
        <span class="text-accent-muted"
          >{t('common.page')} {currentPage} {t('common.of')} {totalPages}</span
        >
        <button
          on:click={() => {
            currentPage++;
            loadProducts();
          }}
          disabled={currentPage >= totalPages}
          class="px-4 py-2 bg-dark-light border border-accent/20 disabled:opacity-50"
        >
          {t('common.next')}
        </button>
      </div>
    {/if}
  {/if}
</div>
