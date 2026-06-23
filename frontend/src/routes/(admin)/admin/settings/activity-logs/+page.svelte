<script lang="ts">
  import { onMount } from 'svelte';
  import { adminManagementApi, type AdminActivityLog } from '$lib/api/admin-management.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { i18nStore } from '$lib/stores/i18n.store';

  let logs: AdminActivityLog[] = [];
  let loading = false;
  let error = '';
  let page = 1;
  let limit = 50;
  let total = 0;

  let filters = {
    adminId: '',
    action: '',
    entityType: '',
  };

  onMount(() => {
    loadLogs();
  });

  async function loadLogs() {
    loading = true;
    error = '';
    try {
      const result = await adminManagementApi.getAllActivityLogs(page, limit, filters);
      logs = result.logs;
      total = result.total;
    } catch (e: any) {
      error = e.message || t('activityLog.failedToLoad');
      notificationStore.error(t('activityLog.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    page = 1;
    loadLogs();
  }

  function clearFilters() {
    filters = {
      adminId: '',
      action: '',
      entityType: '',
    };
    page = 1;
    loadLogs();
  }

  function formatDate(dateString: string): string {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  $: totalPages = Math.ceil(total / limit);
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-2xl font-bold">{t('activityLog.activityLogs')}</h2>
  </div>

  {#if error}
    <div class="mb-4 p-4 bg-red-50 border border-red-200 text-red-700">
      {error}
    </div>
  {/if}

  <div class="mb-4 p-4 bg-gray-50">
    <h3 class="text-lg font-semibold mb-2">{t('activityLog.filters')}</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label for="activityLogAdminId" class="block text-sm font-medium mb-1"
          >{t('activityLog.adminId')}</label
        >
        <input
          id="activityLogAdminId"
          type="text"
          bind:value={filters.adminId}
          class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
          placeholder={t('activityLog.filterByAdminId')}
        />
      </div>
      <div>
        <label for="activityLogAction" class="block text-sm font-medium mb-1"
          >{t('activityLog.action')}</label
        >
        <input
          id="activityLogAction"
          type="text"
          bind:value={filters.action}
          class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
          placeholder={t('activityLog.filterByAction')}
        />
      </div>
      <div>
        <label for="activityLogEntityType" class="block text-sm font-medium mb-1"
          >{t('activityLog.entityType')}</label
        >
        <input
          id="activityLogEntityType"
          type="text"
          bind:value={filters.entityType}
          class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
          placeholder={t('activityLog.filterByEntityType')}
        />
      </div>
    </div>
    <div class="mt-4 flex gap-2">
      <button
        on:click={applyFilters}
        class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('activityLog.applyFilters')}
      </button>
      <button
        on:click={clearFilters}
        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 transition-colors"
      >
        {t('activityLog.clearFilters')}
      </button>
    </div>
  </div>

  {#if loading && logs.length === 0}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b">
            <th class="text-left p-3 font-semibold">{t('activityLog.date')}</th>
            <th class="text-left p-3 font-semibold">{t('activityLog.admin')}</th>
            <th class="text-left p-3 font-semibold">{t('activityLog.action')}</th>
            <th class="text-left p-3 font-semibold">{t('activityLog.entity')}</th>
            <th class="text-left p-3 font-semibold">{t('activityLog.details')}</th>
            <th class="text-left p-3 font-semibold">{t('activityLog.ipAddress')}</th>
          </tr>
        </thead>
        <tbody>
          {#each logs as log (log.id)}
            <tr class="border-b hover:bg-gray-50">
              <td class="p-3 text-sm">{formatDate(log.createdAt)}</td>
              <td class="p-3">
                <div>
                  <div class="font-medium">{log.adminEmail}</div>
                  {#if log.adminName}
                    <div class="text-sm text-gray-500">{log.adminName}</div>
                  {/if}
                </div>
              </td>
              <td class="p-3">
                <span class="px-2 py-1 bg-blue-100 text-xs">{log.action}</span>
              </td>
              <td class="p-3">
                {#if log.entityType}
                  <div>
                    <div class="text-sm font-medium">{log.entityType}</div>
                    {#if log.entityId}
                      <div class="text-xs text-gray-500">{log.entityId}</div>
                    {/if}
                  </div>
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              <td class="p-3">
                {#if log.details}
                  <details class="text-sm">
                    <summary class="cursor-pointer text-blue-600 hover:text-blue-800">
                      {t('activityLog.viewDetails')}
                    </summary>
                    <pre
                      class="mt-2 p-2 bg-gray-100 text-xs overflow-auto max-w-md">{JSON.stringify(
                        log.details,
                        null,
                        2
                      )}</pre>
                  </details>
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </td>
              <td class="p-3 text-sm text-gray-600">{log.ipAddress || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="mt-4 flex justify-center gap-2">
        <button
          on:click={() => {
            if (page > 1) {
              page--;
              loadLogs();
            }
          }}
          disabled={page === 1}
          class="px-4 py-2 border disabled:opacity-50"
        >
          {t('common.previous')}
        </button>
        <span class="px-4 py-2">
          {t('activityLog.pageOf')
            .replace('{page}', page.toString())
            .replace('{total}', totalPages.toString())}
        </span>
        <button
          on:click={() => {
            if (page < totalPages) {
              page++;
              loadLogs();
            }
          }}
          disabled={page === totalPages}
          class="px-4 py-2 border disabled:opacity-50"
        >
          {t('common.next')}
        </button>
      </div>
    {/if}
  {/if}
</div>
