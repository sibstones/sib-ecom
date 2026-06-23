<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { adminApi, type SalesPoint } from '$lib/api/admin.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';

  let salesPoints: SalesPoint[] = [];
  let loading = true;
  let error = '';
  let deletingId: string | null = null;
  let showDeleteConfirm = false;

  function handleWindowKeydown(e: KeyboardEvent) {
    if (showDeleteConfirm && e.key === 'Escape') {
      cancelDelete();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleWindowKeydown);
    void loadData();
    return () => {
      window.removeEventListener('keydown', handleWindowKeydown);
    };
  });

  async function loadData() {
    loading = true;
    try {
      const pointsRes = await adminApi.getAllSalesPoints();
      salesPoints = pointsRes.salesPoints;
    } catch (e) {
      error = e instanceof Error ? e.message : t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

  function openPoint(id: string) {
    goto(`/admin/sales-points/${id}`);
  }

  function confirmDelete(id: string, event: MouseEvent) {
    event.stopPropagation();
    deletingId = id;
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    deletingId = null;
    showDeleteConfirm = false;
  }

  async function deletePoint() {
    if (!deletingId) return;
    try {
      await adminApi.deleteSalesPoint(deletingId);
      notificationStore.success(t('admin.salesPoints.deletedSuccess'));
      await loadData();
      cancelDelete();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('admin.salesPoints.failedToDelete')
      );
    }
  }

  function typeLabel(type: string) {
    return type === 'MARKETPLACE'
      ? t('admin.salesPoints.typeMarketplace')
      : t('admin.salesPoints.typeStoreOffline');
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('admin.salesPoints.title')}</h2>
    <a
      href="/admin/sales-points/new"
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('admin.salesPoints.addPoint')}
    </a>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if salesPoints.length === 0}
    <p class="text-accent-muted">{t('admin.salesPoints.empty')}</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each salesPoints as point}
        <div
          class="bg-dark-light p-6 cursor-pointer hover:bg-dark transition-colors border border-transparent hover:border-accent relative"
          on:click={() => openPoint(point.id)}
          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openPoint(point.id)}
          role="button"
          tabindex="0"
        >
          <button
            on:click={(e) => confirmDelete(point.id, e)}
            class="absolute top-2 right-2 p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            aria-label={t('common.delete')}
            title={t('common.delete')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          <h3 class="text-xl font-medium mb-2 pr-8">{point.name}</h3>
          <p class="text-sm text-accent-muted">
            <span class="px-2 py-0.5 rounded bg-white/10 text-xs">{typeLabel(point.type)}</span>
          </p>
          {#if point.warehouse}
            <p class="text-sm text-accent-muted mt-2">
              {t('admin.salesPoints.warehouseLabel', { name: point.warehouse.name })}
            </p>
          {/if}
          {#if point._count}
            <p class="text-sm text-accent-muted mt-2">
              {t('admin.salesPoints.productsCountOrdersCount', {
                products: point._count.products,
                orders: point._count.orders,
              })}
            </p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if showDeleteConfirm}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="bg-dark-light p-6 rounded-lg max-w-md w-full mx-4" role="document">
        <h3 class="text-xl font-medium mb-4">{t('admin.salesPoints.deleteConfirm')}</h3>
        <p class="text-accent-muted mb-6">{t('admin.salesPoints.deleteHint')}</p>
        <div class="flex gap-4 justify-end">
          <button
            on:click={cancelDelete}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
          <button
            on:click={deletePoint}
            class="px-6 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
