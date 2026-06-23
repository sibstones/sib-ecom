<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { ticketApi, type SupportTicket, TicketStatus } from '$lib/api/ticket.api';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import { goto } from '$app/navigation';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { formatTicketStatus, formatOrderStatus } from '$lib/utils/i18n';
  import { formatPrice } from '$lib/utils/price.utils';
  import { i18nStore } from '$lib/stores/i18n.store';

  let ticket: SupportTicket | null = null;
  let loading = true;
  let error = '';
  let newMessage = '';
  let sendingMessage = false;
  let updatingStatus = false;

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
    try {
      const response = await ticketApi.getTicketDetails(ticketId);
      ticket = response.ticket;
    } catch (e) {
      error = e instanceof Error ? e.message : t('ticket.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function handleSendMessage() {
    if (!ticketId || !newMessage.trim()) {
      notificationStore.error(t('ticket.enterMessage'));
      return;
    }

    sendingMessage = true;
    try {
      await ticketApi.addAdminMessage(ticketId, newMessage.trim());
      newMessage = '';
      await loadTicket();
      notificationStore.success(t('ticket.messageSent'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('ticket.failedToSendMessage'));
    } finally {
      sendingMessage = false;
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (!ticketId) return;

    updatingStatus = true;
    try {
      await ticketApi.updateTicketStatus(ticketId, status);
      await loadTicket();
      notificationStore.success(t('ticket.statusUpdated'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('ticket.failedToUpdateStatus'));
    } finally {
      updatingStatus = false;
    }
  }

  function handleStatusChangeEvent(event: any) {
    handleStatusChange(event.detail.value as TicketStatus);
  }

  async function handleAssign() {
    if (!ticketId) return;

    try {
      await ticketApi.assignTicket(ticketId);
      await loadTicket();
      notificationStore.success(t('ticket.assignedToYou'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('ticket.failedToAssign'));
    }
  }

  function formatDate(dateString: string) {
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

  function toNumber(value: number | string | any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (value && typeof value === 'object' && 'toNumber' in value) {
      return value.toNumber();
    }
    return Number(value) || 0;
  }
</script>

<div>
  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-black">{t('common.error')}: {error}</p>
  {:else if !ticket}
    <p class="text-accent-muted">{t('ticket.notFound')}</p>
  {:else}
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-3xl font-bold mb-2">{t('ticket.ticket')} #{ticket.id.slice(0, 8)}</h2>
          <p class="text-accent-muted">{t('ticket.createdOn')} {formatDate(ticket.createdAt)}</p>
        </div>
        <div class="flex gap-2">
          {#if ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED}
            <button
              on:click={() => handleStatusChange(TicketStatus.RESOLVED)}
              disabled={updatingStatus}
              class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if updatingStatus}
                {t('ticket.resolving')}
              {:else}
                {t('ticket.markAsResolved')}
              {/if}
            </button>
          {/if}
          {#if !ticket.adminId}
            <button
              on:click={handleAssign}
              class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
            >
              {t('ticket.assignToMe')}
            </button>
          {/if}
          <button
            on:click={() => goto('/admin/tickets')}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('ticket.backToList')}
          </button>
        </div>
      </div>

      <!-- Ticket Info -->
      <div class="bg-dark-light p-6 border border-white/10">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-sm text-accent-muted mb-1">{t('common.status')}</p>
            <CustomSelect
              value={ticket.status}
              options={[
                { value: TicketStatus.OPEN, label: t('ticket.open') },
                { value: TicketStatus.IN_PROGRESS, label: t('ticket.inProgress') },
                { value: TicketStatus.RESOLVED, label: t('ticket.resolved') },
                { value: TicketStatus.CLOSED, label: t('ticket.closed') },
              ]}
              on:change={handleStatusChangeEvent}
              disabled={updatingStatus}
            />
          </div>
          <div>
            <p class="text-sm text-accent-muted mb-1">{t('ticket.subject')}</p>
            <p class="font-medium">{ticket.subject}</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-accent-muted mb-1">{t('order.customer')}</p>
            <p>{ticket.user?.email || t('common.n/a')}</p>
            {#if ticket.user?.firstName || ticket.user?.lastName}
              <p class="text-sm text-accent-muted">
                {ticket.user.firstName}
                {ticket.user.lastName}
              </p>
            {/if}
            {#if ticket.user?.phone}
              <p class="text-sm text-accent-muted">{t('common.phone')}: {ticket.user.phone}</p>
            {/if}
          </div>
          <div>
            <p class="text-sm text-accent-muted mb-1">{t('order.order')}</p>
            <a href="/admin/orders" class="text-black hover:text-gray-700 underline">
              #{ticket.order?.orderNumber || t('common.n/a')}
            </a>
            {#if ticket.order?.status}
              <p class="text-sm text-accent-muted">
                {t('common.status')}: {formatOrderStatus(ticket.order.status)}
              </p>
            {/if}
            {#if ticket.order?.total}
              <p class="text-sm text-accent-muted">
                {t('order.total')}: {formatPrice(toNumber(ticket.order.total))}
              </p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Order Items Preview -->
      {#if ticket.order?.items && ticket.order.items.length > 0}
        <div class="bg-dark-light p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('order.orderItems')}</h3>
          <div class="space-y-2">
            {#each ticket.order.items.slice(0, 5) as item}
              <div class="flex gap-3 items-center">
                {#if item.product.images && item.product.images.length > 0}
                  <img
                    src={item.product.images[0].url}
                    alt={item.product.name}
                    class="w-12 h-12 object-cover"
                  />
                {/if}
                <div class="flex-1">
                  <p class="font-medium">{item.product.name}</p>
                </div>
              </div>
            {/each}
            {#if ticket.order.items.length > 5}
              <p class="text-sm text-accent-muted">
                +{ticket.order.items.length - 5}
                {t('ticket.moreItems')}
              </p>
            {/if}
          </div>
        </div>
      {/if}

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
                  {message.isAdmin ? t('ticket.admin') : ticket.user?.email || t('order.customer')}
                </p>
                <p class="text-sm text-accent-muted">{formatDate(message.createdAt)}</p>
              </div>
              <p class="whitespace-pre-wrap">{message.message}</p>
            </div>
          {/each}
        </div>

        <!-- Reply Form -->
        <div class="border-t border-white/10 pt-4">
          <h4 class="font-medium mb-3">{t('ticket.reply')}</h4>
          <textarea
            bind:value={newMessage}
            placeholder={t('ticket.typeReply')}
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
              {t('ticket.sendReply')}
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
