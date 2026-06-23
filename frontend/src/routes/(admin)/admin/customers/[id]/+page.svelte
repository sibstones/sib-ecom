<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { adminApi, type CustomerDetails } from '$lib/api/admin.api';
  import { ticketApi } from '$lib/api/ticket.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { goto } from '$app/navigation';
  import { formatPrice } from '$lib/utils/price.utils';
  import { formatOrderStatus } from '$lib/utils/i18n';
  import { i18nStore } from '$lib/stores/i18n.store';

  let details: CustomerDetails | null = null;
  let loading = true;
  let error = '';
  let noteContent = '';
  let notes: Array<{ id: string; content: string; createdAt: string }> = [];
  let accountEmail = '';
  let updatingEmail = false;
  let sendingVerification = false;
  let sendingPasswordReset = false;

  // Support ticket creation
  let showTicketModal = false;
  let ticketOrderId = '';
  let ticketSubject = '';
  let ticketMessage = '';
  let creatingTicket = false;

  $: customerId = $page.params.id;

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatDateTime(dateString: string) {
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

  onMount(async () => {
    await Promise.all([loadDetails(), loadNotes()]);
  });

  async function loadDetails() {
    loading = true;
    try {
      const response = await adminApi.getCustomerDetails(customerId);
      details = response;
      accountEmail = response.customer?.email || '';
    } catch (e) {
      error = e instanceof Error ? e.message : t('customer.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function loadNotes() {
    try {
      const response = await adminApi.getCustomerNotes(customerId);
      notes = response.notes;
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }

  async function addNote() {
    if (!noteContent.trim()) return;

    try {
      await adminApi.addCustomerNote(customerId, noteContent);
      noteContent = '';
      await loadNotes();
    } catch (e) {
      notificationStore.error(t('customer.failedToAddNote'));
    }
  }

  function openTicketModal() {
    if (!details) return;
    ticketOrderId = details.orders.length > 0 ? details.orders[0].id : '';
    ticketSubject = '';
    ticketMessage = '';
    showTicketModal = true;
  }

  function closeTicketModal() {
    showTicketModal = false;
    ticketOrderId = '';
    ticketSubject = '';
    ticketMessage = '';
  }

  async function createTicket() {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      notificationStore.error(t('ticket.fillAllFields') || 'Please fill all fields');
      return;
    }

    if (!details) return;

    creatingTicket = true;
    try {
      await ticketApi.createTicketForCustomer({
        ...(ticketOrderId ? { orderId: ticketOrderId } : {}),
        userId: customerId,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
      });
      notificationStore.success(t('ticket.createdSuccessfully') || 'Ticket created successfully');
      closeTicketModal();
      await loadDetails();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('ticket.failedToCreate') || 'Failed to create ticket'
      );
    } finally {
      creatingTicket = false;
    }
  }

  async function updateCustomerEmail() {
    if (!details || !accountEmail.trim()) return;
    updatingEmail = true;
    try {
      const response = await adminApi.updateCustomerEmail(customerId, accountEmail.trim());
      notificationStore.success(response.message);
      await loadDetails();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('customer.failedToUpdateEmail'));
    } finally {
      updatingEmail = false;
    }
  }

  async function resendVerificationEmail() {
    if (!details) return;
    sendingVerification = true;
    try {
      const response = await adminApi.resendCustomerVerification(customerId);
      notificationStore.success(response.message);
      await loadDetails();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('customer.failedToSendVerification')
      );
    } finally {
      sendingVerification = false;
    }
  }

  async function sendPasswordResetEmail() {
    if (!details) return;
    sendingPasswordReset = true;
    try {
      const response = await adminApi.sendCustomerPasswordReset(customerId);
      notificationStore.success(response.message);
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('customer.failedToSendPasswordReset')
      );
    } finally {
      sendingPasswordReset = false;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('customer.customerDetails')}</h2>
    <button
      on:click={() => goto('/admin/customers')}
      class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
    >
      {t('common.back')}
    </button>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('common.error')}: {error}</p>
  {:else if !details}
    <p class="text-accent-muted">{t('customer.notFound')}</p>
  {:else}
    <div class="space-y-6">
      <!-- Customer Info -->
      <div class="bg-dark-light p-6">
        <h3 class="text-2xl font-bold mb-4">{t('customer.customerInformation')}</h3>
        <div class="space-y-2">
          <p><strong>{t('common.email')}:</strong> {details.customer.email}</p>
          <p>
            <strong>{t('common.name')}:</strong>
            {details.customer.firstName}
            {details.customer.lastName}
          </p>
          {#if details.customer.phone}
            <p><strong>{t('common.phone')}:</strong> {details.customer.phone}</p>
          {/if}
          <p>
            <strong>{t('customer.emailVerificationStatus')}:</strong>
            {details.customer.emailVerified ? t('common.yes') : t('common.no')}
          </p>
          <p>
            <strong>{t('customer.passwordLoginAvailable')}:</strong>
            {details.customer.passwordLoginAvailable ? t('common.yes') : t('common.no')}
          </p>
          <p><strong>{t('customer.joined')}:</strong> {formatDate(details.customer.createdAt)}</p>
        </div>
      </div>

      <div class="bg-dark-light p-6 border border-white/10">
        <h3 class="text-xl font-medium mb-4">{t('customer.accountAccess')}</h3>
        <div class="space-y-4">
          <div>
            <label for="customerNewEmail" class="block text-sm font-medium mb-2"
              >{t('customer.newEmail')}</label
            >
            <div class="flex gap-3">
              <input
                id="customerNewEmail"
                bind:value={accountEmail}
                type="email"
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder={t('customer.newEmail')}
              />
              <button
                on:click={updateCustomerEmail}
                disabled={updatingEmail ||
                  !accountEmail.trim() ||
                  accountEmail.trim() === details.customer.email}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('customer.updateEmailAndSendVerification')}
              </button>
            </div>
            <p class="text-sm text-accent-muted mt-2">{t('customer.updateEmailHint')}</p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              on:click={resendVerificationEmail}
              disabled={sendingVerification || !!details.customer.emailVerified}
              class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('customer.sendVerificationEmail')}
            </button>
            <button
              on:click={sendPasswordResetEmail}
              disabled={sendingPasswordReset}
              class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('customer.sendPasswordResetEmail')}
            </button>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('customer.notes')}</h3>
        <div class="mb-4">
          <textarea
            bind:value={noteContent}
            placeholder={t('customer.addNotePlaceholder')}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-2"
            rows="3"
          ></textarea>
          <button
            on:click={addNote}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('customer.addNote')}
          </button>
        </div>
        <div class="space-y-2">
          {#each notes as note}
            <div class="p-3 bg-dark">
              <p class="text-sm text-accent-muted mb-1">
                {formatDateTime(note.createdAt)}
              </p>
              <p>{note.content}</p>
            </div>
          {/each}
        </div>
      </div>

      <!-- Orders -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('customer.recentOrders')}</h3>
        {#if details.orders.length === 0}
          <p class="text-accent-muted">{t('customer.noOrders')}</p>
        {:else}
          <div class="space-y-4">
            {#each details.orders as order}
              <div class="p-4 bg-dark">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <p class="font-medium">#{order.orderNumber}</p>
                    <p class="text-sm text-accent-muted">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="font-medium">{formatPrice(Number(order.total || 0))}</p>
                    <p class="text-sm text-accent-muted">{formatOrderStatus(order.status)}</p>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Support Tickets -->
      <div class="bg-dark-light p-6 border border-white/10">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-medium">{t('order.supportTickets') || 'Support Tickets'}</h3>
          <button
            on:click={openTicketModal}
            disabled={!details}
            class="mt-4 px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('order.createSupportTicket') || 'CREATE SUPPORT TICKET'}
          </button>
        </div>
        <p class="text-sm text-accent-muted">
          {#if details.orders.length === 0}
            {t('customer.createTicketNoOrderHint') ||
              'You can create a ticket to contact the customer (e.g. proactive support).'}
          {:else}
            {t('customer.createTicketHint') ||
              'Click the button above to create a support ticket for this customer.'}
          {/if}
        </p>
      </div>

      <!-- Addresses -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('customer.addresses')}</h3>
        {#if details.addresses.length === 0}
          <p class="text-accent-muted">{t('customer.noAddresses')}</p>
        {:else}
          <div class="space-y-2">
            {#each details.addresses as address}
              <div class="p-3 bg-dark">
                <p>
                  {address.firstName}
                  {address.lastName}
                </p>
                <p class="text-sm text-accent-muted">{address.address}</p>
                <p class="text-sm text-accent-muted">
                  {address.city}, {address.country}
                  {address.postalCode}
                </p>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Ticket Creation Modal -->
{#if showTicketModal && details}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <h3 class="text-2xl font-bold mb-4 text-black">
        {t('order.createSupportTicket') || 'CREATE SUPPORT TICKET'}
      </h3>

      <div class="space-y-4">
        <!-- Order Selection (optional; only when customer has orders) -->
        {#if details.orders.length > 0}
          <div>
            <label for="ticket-order-select" class="block text-sm font-medium mb-2 text-black">
              {t('order.order') || 'Order'} ({t('common.optional') || 'optional'})
            </label>
            <select
              id="ticket-order-select"
              bind:value={ticketOrderId}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="">{t('customer.noOrder') || '— No order (general inquiry)'}</option>
              {#each details.orders as order}
                <option value={order.id}>
                  #{order.orderNumber} - {formatPrice(Number(order.total || 0))} ({formatOrderStatus(
                    order.status
                  )})
                </option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Subject -->
        <div>
          <label for="ticket-subject-input" class="block text-sm font-medium mb-2 text-black">
            {t('ticket.subject') || 'Subject'} *
          </label>
          <input
            id="ticket-subject-input"
            type="text"
            bind:value={ticketSubject}
            placeholder={t('ticket.subjectPlaceholder') || 'Enter ticket subject'}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
        </div>

        <!-- Message -->
        <div>
          <label for="ticket-message-textarea" class="block text-sm font-medium mb-2 text-black">
            {t('ticket.message') || 'Message'} *
          </label>
          <textarea
            id="ticket-message-textarea"
            bind:value={ticketMessage}
            placeholder={t('ticket.messagePlaceholder') || 'Enter ticket message'}
            rows="6"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          ></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-4 mt-6">
        <button
          on:click={closeTicketModal}
          disabled={creatingTicket}
          class="px-4 py-2 bg-gray-200 text-black hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          on:click={createTicket}
          disabled={creatingTicket || !ticketSubject.trim() || !ticketMessage.trim()}
          class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if creatingTicket}
            {t('common.loading') || 'Creating...'}
          {:else}
            {t('common.create') || 'Create Ticket'}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
