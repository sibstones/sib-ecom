<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { adminApi, type Warehouse, type WarehouseType } from '$lib/api/admin.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';

  let warehouses: Warehouse[] = [];
  let loading = true;
  let error = '';
  let creating = false;
  let deletingWarehouseId: string | null = null;
  let showDeleteConfirm = false;

  $: WAREHOUSE_TYPES = [
    { value: 'MAIN' as WarehouseType, label: t('warehouse.typeMain') },
    { value: 'STORE' as WarehouseType, label: t('warehouse.typeStore') },
    { value: 'MARKETPLACE' as WarehouseType, label: t('warehouse.typeMarketplace') },
  ];

  let newWarehouse = {
    name: '',
    address: '',
    city: '',
    country: '',
    type: 'MAIN' as WarehouseType,
    priority: 10,
  };

  onMount(async () => {
    await loadWarehouses();
  });

  async function loadWarehouses() {
    loading = true;
    try {
      const response = await adminApi.getAllWarehouses();
      warehouses = response.warehouses;
    } catch (e) {
      error = e instanceof Error ? e.message : t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function createWarehouse() {
    try {
      await adminApi.createWarehouse(newWarehouse);
      newWarehouse = { name: '', address: '', city: '', country: '', type: 'MAIN', priority: 10 };
      creating = false;
      await loadWarehouses();
    } catch (e) {
      notificationStore.error(t('error.failedToSave'));
    }
  }

  async function openWarehouse(warehouseId: string) {
    goto(`/admin/warehouses/${warehouseId}`);
  }

  function confirmDelete(warehouseId: string, event: MouseEvent) {
    event.stopPropagation();
    deletingWarehouseId = warehouseId;
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    deletingWarehouseId = null;
    showDeleteConfirm = false;
  }

  async function deleteWarehouse() {
    if (!deletingWarehouseId) return;

    try {
      await adminApi.deleteWarehouse(deletingWarehouseId);
      notificationStore.success(t('warehouse.deleteSuccess'));
      await loadWarehouses();
      cancelDelete();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('warehouse.deleteFailed');
      notificationStore.error(errorMessage);
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('menu.warehouses')}</h2>
    {#if !creating}
      <button
        on:click={() => (creating = true)}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('warehouse.addWarehouse')}
      </button>
    {/if}
  </div>

  {#if creating}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('warehouse.newWarehouse')}</h3>
      <form on:submit|preventDefault={createWarehouse} class="space-y-4">
        <div>
          <label for="warehouse-name" class="block text-sm font-medium mb-2"
            >{t('common.name')} *</label
          >
          <input
            id="warehouse-name"
            type="text"
            bind:value={newWarehouse.name}
            required
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="warehouse-type" class="block text-sm font-medium mb-2"
              >{t('warehouse.type')}</label
            >
            <select
              id="warehouse-type"
              bind:value={newWarehouse.type}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              {#each WAREHOUSE_TYPES as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="warehouse-priority" class="block text-sm font-medium mb-2"
              >{t('warehouse.priority')}</label
            >
            <input
              id="warehouse-priority"
              type="number"
              min="-128"
              max="127"
              bind:value={newWarehouse.priority}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="warehouse-city" class="block text-sm font-medium mb-2"
              >{t('common.city')}</label
            >
            <input
              id="warehouse-city"
              type="text"
              bind:value={newWarehouse.city}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="warehouse-country" class="block text-sm font-medium mb-2"
              >{t('common.country')}</label
            >
            <input
              id="warehouse-country"
              type="text"
              bind:value={newWarehouse.country}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>
        <div>
          <label for="warehouse-address" class="block text-sm font-medium mb-2"
            >{t('common.address')}</label
          >
          <input
            id="warehouse-address"
            type="text"
            bind:value={newWarehouse.address}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
        </div>
        <div class="flex gap-4">
          <button
            type="submit"
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('common.create')}
          </button>
          <button
            type="button"
            on:click={() => (creating = false)}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if warehouses.length === 0}
    <p class="text-accent-muted">{t('warehouse.noWarehouses')}</p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each warehouses as warehouse}
        <div
          class="bg-dark-light p-6 cursor-pointer hover:bg-dark transition-colors border border-transparent hover:border-accent relative"
          on:click={() => openWarehouse(warehouse.id)}
          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openWarehouse(warehouse.id)}
          role="button"
          tabindex="0"
          aria-label={`${t('warehouse.openWarehouse') || 'Open warehouse'} ${warehouse.name}`}
        >
          <button
            type="button"
            on:click={(e) => confirmDelete(warehouse.id, e)}
            class="absolute top-2 right-2 p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title={t('warehouse.deleteWarehouse')}
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
          <h3 class="text-xl font-medium mb-2 pr-8">{warehouse.name}</h3>
          <div class="flex items-center gap-2 mb-1">
            <span
              class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded {warehouse.type ===
              'MAIN'
                ? 'bg-amber-100 text-amber-800'
                : warehouse.type === 'STORE'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'}"
            >
              {warehouse.type === 'MAIN'
                ? t('warehouse.typeMain')
                : warehouse.type === 'STORE'
                  ? t('warehouse.typeStore')
                  : t('warehouse.typeMarketplace')}
            </span>
            {#if (warehouse.priority ?? 0) !== 0}
              <span class="text-xs text-accent-muted">P: {warehouse.priority ?? 0}</span>
            {/if}
          </div>
          <p class="text-sm text-accent-muted">
            {warehouse.city || ''}{warehouse.city && warehouse.country
              ? ', '
              : ''}{warehouse.country || ''}
          </p>
          {#if warehouse._count}
            <p class="text-sm text-accent-muted mt-2">
              {warehouse._count.inventory}
              {t('warehouse.items')}
            </p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if showDeleteConfirm}
    <button
      type="button"
      class="fixed inset-0 bg-black bg-opacity-50 z-50"
      aria-label={t('common.close')}
      on:click={cancelDelete}
    ></button>
    <div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div
        class="bg-dark-light p-6 rounded-lg max-w-md w-full mx-4 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-warehouse-title"
      >
        <h3 id="delete-warehouse-title" class="text-xl font-medium mb-4">
          {t('warehouse.deleteWarehouse')}
        </h3>
        <p class="text-accent-muted mb-6">{t('warehouse.deleteConfirm')}</p>
        <div class="flex gap-4 justify-end">
          <button
            type="button"
            on:click={cancelDelete}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            on:click={deleteWarehouse}
            class="px-6 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
