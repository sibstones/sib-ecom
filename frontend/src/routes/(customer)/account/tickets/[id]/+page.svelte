<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { ticketApi, type SupportTicket, TicketStatus } from '$lib/api/ticket.api';
  import { goto } from '$app/navigation';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';

  let ticket: SupportTicket | null = null;
  let loading = true;
  let error = '';
  let newMessage = '';
  let sendingMessage = false;

  $: ticketId = $page.params?.id;

  onMount(async () => {
    if (!ticketId) {
      error = t('ticket.ticketIdRequired');
      loading = false;
      return;
    }
    await loadTicket();
  });

  async function loadTicket() {
    loading = true;
    error = '';
    try {
      const response = await ticketApi.getCustomerTicket(ticketId, true);
      ticket = response.ticket;
    } catch (e) {
      error = e instanceof Error ? e.message : t('ticket.failedToLoad');
      notificationStore.error(error);
    } finally {
      loading = false;
    }
  }

  async function handleSendMessage() {
    if (!ticketId || !newMessage.trim()) {
      notificationStore.error(t('ticket.pleaseEnterMessage'));
      return;
    }

    sendingMessage = true;
    try {
      await ticketApi.addCustomerMessage(ticketId, newMessage.trim());
      newMessage = '';
      await loadTicket();
      notificationStore.success(t('ticket.messageSentSuccess'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('ticket.failedToSendMessage'));
    } finally {
      sendingMessage = false;
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('ticket.supportTicket')}</h2>
    <button
      on:click={() => goto('/account/tickets')}
      class="px-4 py-2 bg-dark-light border border-white/10 hover:bg-dark transition-colors"
    >
      {t('ticket.backToTickets')}
    </button>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('common.error')}: {error}</p>
  {:else if !ticket}
    <p class="text-accent-muted">{t('ticket.ticketNotFound')}</p>
  {:else}
    <div class="space-y-6">
      <!-- Ticket Info -->
      <div class="bg-dark-light p-6 border border-white/10">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-2xl font-medium mb-2">{ticket.subject}</h3>
            {#if ticket.order}
              <p class="text-sm text-accent-muted">
                {t('ticket.relatedToOrder')}:
                <a
                  href="/account/orders/{ticket.order.id}"
                  class="text-accent hover:text-accent-muted underline"
                >
                  #{ticket.order.orderNumber}
                </a>
              </p>
            {/if}
          </div>
          <span class="px-3 py-1 text-sm font-medium text-white {getStatusColor(ticket.status)}">
            {getStatusLabel(ticket.status)}
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-accent-muted">{t('ticket.created')}:</p>
            <p>{formatDate(ticket.createdAt)}</p>
          </div>
          {#if ticket.updatedAt !== ticket.createdAt}
            <div>
              <p class="text-accent-muted">{t('ticket.lastUpdated')}:</p>
              <p>{formatDate(ticket.updatedAt)}</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Messages -->
      <div class="bg-dark-light p-6 border border-white/10">
        <h3 class="text-xl font-medium mb-4">{t('ticket.conversation')}</h3>
        <div class="space-y-4 mb-6">
          {#each ticket.messages || [] as message}
            <div
              class="p-4 {message.isAdmin
                ? 'bg-gray-100 border border-gray-300 ml-8'
                : 'bg-dark border border-white/10 mr-8'}"
            >
              <div class="flex justify-between items-start mb-2">
                <p class="font-medium">
                  {message.isAdmin ? t('ticket.supportTeam') : t('ticket.you')}
                </p>
                <p class="text-sm text-accent-muted">{formatDate(message.createdAt)}</p>
              </div>
              <p class="whitespace-pre-wrap">{message.message}</p>
            </div>
          {/each}
        </div>

        {#if ticket.status !== TicketStatus.CLOSED}
          <!-- Reply Form -->
          <div class="border-t border-white/10 pt-4">
            <h4 class="font-medium mb-3">{t('ticket.addReply')}</h4>
            <textarea
              bind:value={newMessage}
              placeholder={t('ticket.typeMessage')}
              rows="4"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-3"
              disabled={sendingMessage}
            ></textarea>
            <button
              on:click={handleSendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if sendingMessage}
                {t('ticket.sending')}
              {:else}
                {t('ticket.send')}
              {/if}
            </button>
          </div>
        {:else}
          <div class="border-t border-white/10 pt-4">
            <p class="text-accent-muted text-sm">
              {t('ticket.ticketClosed')}
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
