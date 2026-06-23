<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { adminApi } from '$lib/api/admin.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';

  let warehouses: { id: string; name: string }[] = [];
  let loading = true;
  let submitting = false;
  let error = '';

  let newPoint = {
    name: '',
    type: 'MARKETPLACE' as 'MARKETPLACE' | 'STORE_OFFLINE',
    warehouseId: '' as string | null,
    externalId: '' as string | null,
  };

  onMount(async () => {
    try {
      const whRes = await adminApi.getAllWarehouses();
      warehouses = whRes.warehouses.map((w) => ({ id: w.id, name: w.name }));
    } catch (e) {
      error = e instanceof Error ? e.message : t('error.failedToLoad');
    } finally {
      loading = false;
    }
  });

  async function createPoint() {
    if (!newPoint.name.trim()) return;
    submitting = true;
    try {
      const res = await adminApi.createSalesPoint({
        name: newPoint.name.trim(),
        type: newPoint.type,
        warehouseId: newPoint.warehouseId || null,
        externalId: newPoint.externalId || null,
      });
      notificationStore.success(t('admin.salesPoints.createdSuccess'));
      goto(`/admin/sales-points/${res.salesPoint.id}`);
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('admin.salesPoints.failedToSave'));
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{t('admin.salesPoints.pageTitleAdd')}</title>
</svelte:head>

<div>
  <div class="flex items-center gap-4 mb-6">
    <button
      on:click={() => goto('/admin/sales-points')}
      class="text-accent-muted hover:text-accent transition-colors"
    >
      ← {t('common.back')}
    </button>
    <h2 class="text-3xl font-bold">{t('admin.salesPoints.addPointTitle')}</h2>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{error}</p>
  {:else}
    <div class="bg-dark-light p-6 border border-white/10 max-w-2xl">
      <form on:submit|preventDefault={createPoint} class="space-y-4">
        <div>
          <label for="point-name" class="block text-sm font-medium mb-2">{t('common.name')} *</label
          >
          <input
            id="point-name"
            type="text"
            bind:value={newPoint.name}
            required
            placeholder={t('admin.salesPoints.namePlaceholder')}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
        </div>
        <div>
          <label for="point-type" class="block text-sm font-medium mb-2">{t('common.type')}</label>
          <select
            id="point-type"
            bind:value={newPoint.type}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          >
            <option value="MARKETPLACE">{t('admin.salesPoints.typeMarketplace')}</option>
            <option value="STORE_OFFLINE">{t('admin.salesPoints.typeStoreOffline')}</option>
          </select>
        </div>
        {#if newPoint.type === 'STORE_OFFLINE'}
          <div>
            <label for="point-warehouse" class="block text-sm font-medium mb-2"
              >{t('admin.salesPoints.storeWarehouseRequired')}</label
            >
            <select
              id="point-warehouse"
              bind:value={newPoint.warehouseId}
              required
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="">{t('admin.salesPoints.selectWarehouse')}</option>
              {#each warehouses as w}
                <option value={w.id}>{w.name}</option>
              {/each}
            </select>
          </div>
        {:else}
          <div>
            <label for="point-external-id" class="block text-sm font-medium mb-2"
              >{t('admin.salesPoints.externalIdOptional')}</label
            >
            <input
              id="point-external-id"
              type="text"
              bind:value={newPoint.externalId}
              placeholder={t('admin.salesPoints.externalIdPlaceholder')}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        {/if}
        <div class="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={submitting}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
          >
            {submitting ? t('admin.salesPoints.creating') : t('common.create')}
          </button>
          <button
            type="button"
            on:click={() => goto('/admin/sales-points')}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>
