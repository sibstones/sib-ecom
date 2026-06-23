<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    adminManagementApi,
    type AdminActivityLog,
    type Admin,
  } from '$lib/api/admin-management.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { i18nStore } from '$lib/stores/i18n.store';

  let admin: Admin | null = null;
  let logs: AdminActivityLog[] = [];
  let loading = false;
  let error = '';
  let pageNum = 1;
  let limit = 50;
  let total = 0;

  $: adminId = $page.params.id;

  onMount(() => {
    loadAdmin();
    loadLogs();
  });

  async function loadAdmin() {
    try {
      const result = await adminManagementApi.getAdminById(adminId);
      admin = result.admin;
    } catch (e: any) {
      error = e.message || t('activityLog.failedToLoadAdmin');
      notificationStore.error(t('activityLog.failedToLoadAdmin'));
    }
  }

  async function loadLogs() {
    loading = true;
    error = '';
    try {
      const result = await adminManagementApi.getAdminActivityLogs(adminId, pageNum, limit);
      logs = result.logs;
      total = result.total;
    } catch (e: any) {
      error = e.message || t('activityLog.failedToLoad');
      notificationStore.error(t('activityLog.failedToLoad'));
    } finally {
      loading = false;
    }
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
    <div>
      <h2 class="text-2xl font-bold">{t('activityLog.activityLogs')}</h2>
      {#if admin}
        <p class="text-gray-600 mt-1">
          {t('activityLog.forAdmin').replace('{email}', admin.email)}
          {admin.firstName || admin.lastName
            ? `(${admin.firstName || ''} ${admin.lastName || ''})`
            : ''}
        </p>
      {/if}
    </div>
    <a href="/admin/settings/admins" class="text-accent-muted hover:text-accent transition-colors">
      {t('activityLog.backToAdmins')}
    </a>
  </div>

  {#if error}
    <div class="mb-4 p-4 bg-red-50 border border-red-200 text-red-700">
      {error}
    </div>
  {/if}

  {#if loading && logs.length === 0}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b">
            <th class="text-left p-3 font-semibold">{t('activityLog.date')}</th>
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
            if (pageNum > 1) {
              pageNum--;
              loadLogs();
            }
          }}
          disabled={pageNum === 1}
          class="px-4 py-2 border disabled:opacity-50"
        >
          {t('common.previous')}
        </button>
        <span class="px-4 py-2">
          {t('activityLog.pageOf')
            .replace('{page}', pageNum.toString())
            .replace('{total}', totalPages.toString())}
        </span>
        <button
          on:click={() => {
            if (pageNum < totalPages) {
              pageNum++;
              loadLogs();
            }
          }}
          disabled={pageNum === totalPages}
          class="px-4 py-2 border disabled:opacity-50"
        >
          {t('common.next')}
        </button>
      </div>
    {/if}
  {/if}
</div>
