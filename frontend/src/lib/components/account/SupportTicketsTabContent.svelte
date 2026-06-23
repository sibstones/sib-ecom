<script lang="ts">
  import { onMount } from 'svelte';
  import { ticketApi, type SupportTicket, TicketStatus } from '$lib/api/ticket.api';
  import { goto } from '$app/navigation';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';
  import AccountTicketsSkeleton from '$lib/components/account/AccountTicketsSkeleton.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';

  let tickets: SupportTicket[] = [];
  let loading = true;
  let error = '';
  let page = 1;
  let totalPages = 1;
  let total = 0;

  onMount(async () => {
    await loadTickets();
  });

  async function loadTickets() {
    loading = true;
    error = '';
    try {
      const response = await ticketApi.getCustomerTickets(page, 20);
      tickets = response.tickets;
      totalPages = response.pagination.totalPages;
      total = response.pagination.total;
    } catch (e) {
      error = e instanceof Error ? e.message : t('ticket.failedToLoadTickets');
      notificationStore.error(error);
    } finally {
      loading = false;
    }
  }

  function getStatusColor(status: TicketStatus): string {
    switch (status) {
      case TicketStatus.OPEN:
        return 'bg-blue-500';
      case TicketStatus.IN_PROGRESS:
        return 'bg-yellow-500';
      case TicketStatus.RESOLVED:
        return 'bg-green-500';
      case TicketStatus.CLOSED:
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  }

  function getStatusLabel(status: TicketStatus): string {
    switch (status) {
      case TicketStatus.OPEN:
        return t('ticket.open');
      case TicketStatus.IN_PROGRESS:
        return t('ticket.inProgress');
      case TicketStatus.RESOLVED:
        return t('ticket.resolved');
      case TicketStatus.CLOSED:
        return t('ticket.closed');
      default:
        return status;
    }
  }

  function formatDate(dateString: string): string {
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

  function goToPage(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      page = newPage;
      loadTickets();
    }
  }
</script>

<div>
  <h3 class="text-xl font-medium mb-6">{t('ticket.supportTickets')}</h3>

  {#if loading}
    <AccountTicketsSkeleton />
  {:else if error}
    <p class="text-red-400">{t('common.error')}: {error}</p>
  {:else if tickets.length === 0}
    <div class="bg-dark-light p-6 text-center">
      <p class="text-accent-muted mb-4">{t('ticket.noTicketsYet')}</p>
      <p class="text-sm text-accent-muted">
        {t('ticket.createTicketHint')}
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each tickets as ticket}
        <div
          class="bg-dark-light p-6 border border-white/10 hover:border-accent/50 transition-colors cursor-pointer"
          on:click={() => goto(`/account/tickets/${ticket.id}`)}
          role="button"
          tabindex="0"
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goto(`/account/tickets/${ticket.id}`);
            }
          }}
        >
          <div class="flex justify-between items-start mb-2">
            <div class="flex-1">
              <h3 class="text-xl font-medium mb-1">{ticket.subject}</h3>
              {#if ticket.order}
                <p class="text-sm text-accent-muted">
                  {t('ticket.order')}: #{ticket.order.orderNumber}
                </p>
              {/if}
            </div>
            <span class="px-3 py-1 text-xs font-medium text-white {getStatusColor(ticket.status)}">
              {getStatusLabel(ticket.status)}
            </span>
          </div>

          {#if ticket.messages && ticket.messages.length > 0}
            <p class="text-sm text-accent-muted mb-2 line-clamp-2">
              {ticket.messages[ticket.messages.length - 1].message}
            </p>
          {/if}

          <div class="flex justify-between items-center text-sm text-accent-muted">
            <span>{t('ticket.created')}: {formatDate(ticket.createdAt)}</span>
            {#if ticket.updatedAt !== ticket.createdAt}
              <span>{t('ticket.updated')}: {formatDate(ticket.updatedAt)}</span>
            {/if}
          </div>
        </div>
      {/each}

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="flex justify-center items-center gap-2 mt-6">
          <button
            on:click={() => goToPage(page - 1)}
            disabled={page === 1}
            class="px-4 py-2 bg-dark-light border border-white/10 hover:bg-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('order.previous')}
          </button>
          <span class="px-4 py-2 text-sm">
            {t('ticket.pageInfo', { page, totalPages, total })}
          </span>
          <button
            on:click={() => goToPage(page + 1)}
            disabled={page === totalPages}
            class="px-4 py-2 bg-dark-light border border-white/10 hover:bg-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('order.next')}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
