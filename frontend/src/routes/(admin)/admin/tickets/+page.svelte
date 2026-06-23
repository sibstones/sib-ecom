<script lang="ts">
  import { onMount } from 'svelte';
  import { ticketApi, type SupportTicket, TicketStatus } from '$lib/api/ticket.api';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import DateRangePicker from '$lib/components/admin/DateRangePicker.svelte';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { formatTicketStatus } from '$lib/utils/i18n';
  import { i18nStore } from '$lib/stores/i18n.store';

  let tickets: SupportTicket[] = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let totalPages = 1;
  let selectedStatus: TicketStatus | '' = '';
  let searchQuery = '';
  let dateFrom = '';
  let dateTo = '';
  let sortOrder: 'asc' | 'desc' = 'desc';

  onMount(async () => {
    await loadTickets();
  });

  async function loadTickets() {
    loading = true;
    try {
      const response = await ticketApi.getAllTickets(currentPage, 20, {
        status: selectedStatus || undefined,
        search: searchQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortOrder,
      });
      tickets = response.tickets;
      totalPages = response.pagination.totalPages;
    } catch (e) {
      error = e instanceof Error ? e.message : t('ticket.failedToLoadTickets');
    } finally {
      loading = false;
    }
  }

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusColor(status: TicketStatus) {
    const colors: Record<TicketStatus, string> = {
      OPEN: 'text-black',
      IN_PROGRESS: 'text-gray-700',
      RESOLVED: 'text-gray-500',
      CLOSED: 'text-gray-400',
    };
    return colors[status] || 'text-accent-muted';
  }

  function getStatusBadgeColor(status: TicketStatus) {
    const colors: Record<TicketStatus, string> = {
      OPEN: 'bg-black text-white border-black',
      IN_PROGRESS: 'bg-gray-700 text-white border-gray-700',
      RESOLVED: 'bg-gray-400 text-black border-gray-400',
      CLOSED: 'bg-gray-200 text-black border-gray-300',
    };
    return colors[status] || 'bg-gray-200 text-black border-gray-300';
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('menu.tickets')}</h2>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap gap-4 items-end">
    <input
      type="text"
      bind:value={searchQuery}
      on:input={loadTickets}
      placeholder={t('ticket.searchTickets')}
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
        loadTickets();
      }}
    />
    <CustomSelect
      bind:value={selectedStatus}
      fitContent={true}
      options={[
        { value: '', label: t('ticket.allStatuses') },
        { value: TicketStatus.OPEN, label: formatTicketStatus(TicketStatus.OPEN) },
        { value: TicketStatus.IN_PROGRESS, label: formatTicketStatus(TicketStatus.IN_PROGRESS) },
        { value: TicketStatus.RESOLVED, label: formatTicketStatus(TicketStatus.RESOLVED) },
        { value: TicketStatus.CLOSED, label: formatTicketStatus(TicketStatus.CLOSED) },
      ]}
      on:change={() => {
        currentPage = 1;
        loadTickets();
      }}
    />
    <DateRangePicker
      bind:dateFrom
      bind:dateTo
      tight={true}
      on:change={() => {
        currentPage = 1;
        loadTickets();
      }}
    />
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-black">{t('notification.error')}: {error}</p>
  {:else if tickets.length === 0}
    <p class="text-accent-muted">{t('ticket.noTickets')}</p>
  {:else}
    <div class="bg-white overflow-hidden">
      <table class="w-full">
        <thead class="bg-white border-b border-accent/20">
          <tr>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('ticket.ticketId')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('order.orderNumber')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('order.customer')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('ticket.subject')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.status')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.updated')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-accent/20">
          {#each tickets as ticket}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 font-mono text-sm">#{ticket.id.slice(0, 8)}</td>
              <td class="px-6 py-4">{ticket.order?.orderNumber || 'N/A'}</td>
              <td class="px-6 py-4">{ticket.user?.email || 'N/A'}</td>
              <td class="px-6 py-4">
                <div class="max-w-xs truncate" title={ticket.subject}>
                  {ticket.subject}
                </div>
              </td>
              <td class="px-6 py-4">
                <span
                  class="px-2 py-1 text-xs font-medium border {getStatusBadgeColor(ticket.status)}"
                >
                  {formatTicketStatus(ticket.status)}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-accent-muted">{formatDate(ticket.updatedAt)}</td>
              <td class="px-6 py-4">
                <button
                  on:click={() => goto(`/admin/tickets/${ticket.id}`)}
                  class="px-3 py-1 bg-dark border border-gray-300 text-sm text-black hover:bg-gray-100 transition-colors"
                >
                  {t('common.view')}
                </button>
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
            loadTickets();
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
            loadTickets();
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
