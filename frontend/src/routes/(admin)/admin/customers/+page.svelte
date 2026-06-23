<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '$lib/api/admin.api';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import { getErrorMessage } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import AdminKebabMenu from '$lib/components/admin/AdminKebabMenu.svelte';
  import DateRangePicker from '$lib/components/admin/DateRangePicker.svelte';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';

  let customers: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    isPartner?: boolean;
    createdAt: string;
    _count: { orders: number };
  }> = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let totalPages = 1;
  let searchQuery = '';
  let dateFrom = '';
  let dateTo = '';
  let sortOrder: 'asc' | 'desc' = 'desc';
  /** When set, actions dropdown is open for this customer id */
  let openActionsId: string | null = null;

  function toggleActions(id: string) {
    openActionsId = openActionsId === id ? null : id;
  }

  function closeActions() {
    openActionsId = null;
  }

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  onMount(async () => {
    await loadCustomers();
  });

  async function loadCustomers() {
    loading = true;
    try {
      const response = await adminApi.getAllCustomers(currentPage, 20, {
        search: searchQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortOrder,
      });
      customers = response.customers;
      totalPages = response.pagination.totalPages;
    } catch (e) {
      error = getErrorMessage(e, 'customer.failedToLoadList');
    } finally {
      loading = false;
    }
  }

  async function togglePartnerStatus(customer: (typeof customers)[0]) {
    const action = customer.isPartner
      ? t('partner.removePartner') || 'Remove partner status'
      : t('partner.assignPartner') || 'Assign partner';

    const confirmed = await dialogStore.confirm(
      `${action} for ${customer.email}?`,
      t('common.confirm') || 'Confirm'
    );
    if (!confirmed) return;

    try {
      const { partnerApi } = await import('$lib/api/partner.api');
      if (customer.isPartner) {
        await partnerApi.removePartner(customer.id);
        notificationStore.success(t('partner.removed') || 'Partner status removed');
      } else {
        await partnerApi.assignPartner(customer.id, 'ACTIVE');
        notificationStore.success(t('partner.assigned') || 'User assigned as partner');
      }
      await loadCustomers();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('partner.failedToUpdate') || 'Failed to update status'
      );
    }
  }
</script>

<svelte:window on:click={closeActions} />

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('menu.customers')}</h2>
    <button
      type="button"
      on:click={loadCustomers}
      disabled={loading}
      class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 text-black flex items-center gap-2"
      title={t('common.refresh') || 'Refresh'}
    >
      {#if loading}
        <span class="text-sm">{t('common.loading') || 'Loading...'}</span>
      {:else}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      {/if}
    </button>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap gap-4 items-end">
    <input
      type="text"
      bind:value={searchQuery}
      on:input={loadCustomers}
      placeholder={t('common.search') + ' ' + t('menu.customers').toLowerCase() + '...'}
      class="w-full flex-1 min-w-[280px] px-4 py-2 bg-white border border-gray-300 text-black"
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
        loadCustomers();
      }}
    />
    <DateRangePicker
      bind:dateFrom
      bind:dateTo
      tight={true}
      on:change={() => {
        currentPage = 1;
        loadCustomers();
      }}
    />
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if customers.length === 0}
    <p class="text-accent-muted">{t('customer.noCustomers')}</p>
  {:else}
    <div class="bg-white">
      <table class="w-full min-w-[800px]">
        <thead class="bg-white border-b border-accent/20">
          <tr>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('customer.email')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.name')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('customer.phone')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('menu.orders')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('menu.partners')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('customer.joined')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium w-0">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-accent/20">
          {#each customers as customer}
            <tr class="border-t border-accent/10">
              <td class="px-4 py-2">{customer.email}</td>
              <td class="px-4 py-2">
                {customer.firstName}
                {customer.lastName}
              </td>
              <td class="px-4 py-2">{customer.phone || 'N/A'}</td>
              <td class="px-4 py-2">{customer._count?.orders ?? 0}</td>
              <td class="px-4 py-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customer.isPartner || false}
                    on:change={() => togglePartnerStatus(customer)}
                    class="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <span
                    class="text-sm {customer.isPartner
                      ? 'text-black font-medium'
                      : 'text-gray-500'}"
                  >
                    {customer.isPartner ? t('partner.isPartner') || 'Partner' : '-'}
                  </span>
                </label>
              </td>
              <td class="px-4 py-2">
                {formatDate(customer.createdAt)}
              </td>
              <td class="px-4 py-2 align-middle">
                <AdminKebabMenu
                  open={openActionsId === customer.id}
                  title={t('common.actions')}
                  menuToggle={() => toggleActions(customer.id)}
                >
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      goto(`/admin/customers/${customer.id}`);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                  >
                    {t('common.viewDetails')}
                  </button>
                  {#if customer.isPartner}
                    <button
                      type="button"
                      role="menuitem"
                      on:click={() => {
                        goto(`/admin/partners/${customer.id}`);
                        closeActions();
                      }}
                      class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                    >
                      {t('partner.viewAsPartner') || 'View as partner'}
                    </button>
                  {/if}
                </AdminKebabMenu>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 mt-6">
        <button
          type="button"
          on:click={() => {
            currentPage--;
            loadCustomers();
          }}
          disabled={currentPage === 1}
          class="px-4 py-2 bg-white border border-gray-300 disabled:opacity-50 text-black"
        >
          {t('common.previous')}
        </button>
        <span class="text-accent-muted"
          >{t('common.page')} {currentPage} {t('common.of')} {totalPages}</span
        >
        <button
          type="button"
          on:click={() => {
            currentPage++;
            loadCustomers();
          }}
          disabled={currentPage >= totalPages}
          class="px-4 py-2 bg-white border border-gray-300 disabled:opacity-50 text-black"
        >
          {t('common.next')}
        </button>
      </div>
    {/if}
  {/if}
</div>
