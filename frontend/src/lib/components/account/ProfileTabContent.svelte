<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import {
    customerApi,
    type UserProfile,
    type Order,
    type NotificationCounts,
  } from '$lib/api/customer.api';
  import { ticketApi, type SupportTicket, TicketStatus } from '$lib/api/ticket.api';
  import { isAuthenticationError, getErrorMessage } from '$lib/utils/error-handler';
  import AuthError from '$lib/components/AuthError.svelte';
  import { t } from '$lib/utils/i18n';
  import ProfilePageSkeleton from '$lib/components/profile/ProfilePageSkeleton.svelte';
  import { goto } from '$app/navigation';
  import { formatOrderAmount, formatPrice } from '$lib/utils/price.utils';
  import { i18nStore } from '$lib/stores/i18n.store';

  let profile: UserProfile | null = null;
  let loading = true;
  let error: Error | null = null;
  let editing = false;

  let firstName = '';
  let lastName = '';
  let phone = '';
  let email = '';

  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let changingPassword = false;

  let recentOrders: Order[] = [];
  let recentTickets: SupportTicket[] = [];
  let loadingOrders = false;
  let loadingTickets = false;

  let notificationCounts: NotificationCounts = { ordersInProgress: 0, unreadTickets: 0 };
  let loadingNotifications = false;

  let resendBusy = false;
  let resendMsg = '';

  onMount(async () => {
    if (!$authStore.isAuthenticated) return;
    await Promise.all([
      loadProfile(),
      loadRecentOrders(),
      loadRecentTickets(),
      loadNotificationCounts(),
    ]);
  });

  async function loadNotificationCounts() {
    loadingNotifications = true;
    try {
      notificationCounts = await customerApi.getNotificationCounts();
    } catch (e) {
      if (!isAuthenticationError(e)) {
        console.error('Failed to load notification counts', e);
      }
    } finally {
      loadingNotifications = false;
    }
  }

  async function loadProfile() {
    loading = true;
    try {
      const response = await customerApi.getProfile();
      profile = response.profile;
      firstName = profile.firstName || '';
      lastName = profile.lastName || '';
      phone = profile.phone || '';
      email = profile.email;
      error = null;
    } catch (e) {
      error = e instanceof Error ? e : new Error(t('profile.failedToLoadProfile'));
    } finally {
      loading = false;
    }
  }

  async function saveProfile() {
    try {
      const response = await customerApi.updateProfile({
        firstName,
        lastName,
        phone,
        email,
      });
      profile = response.profile;
      editing = false;
      alert(t('profile.profileUpdated'));
    } catch (e) {
      alert(e instanceof Error ? e.message : t('profile.failedToUpdateProfile'));
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      alert(t('profile.passwordsDoNotMatch'));
      return;
    }

    if (newPassword.length < 8) {
      alert(t('profile.passwordMinLengthAlert'));
      return;
    }

    try {
      await customerApi.changePassword(currentPassword, newPassword);
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      changingPassword = false;
      alert(t('profile.passwordChanged'));
    } catch (e) {
      alert(e instanceof Error ? e.message : t('profile.failedToChangePassword'));
    }
  }

  async function loadRecentOrders() {
    loadingOrders = true;
    try {
      const response = await customerApi.getOrders(1, 3);
      recentOrders = response.orders;
    } catch (e) {
      if (!isAuthenticationError(e)) {
        console.error('Failed to load recent orders:', e);
      }
    } finally {
      loadingOrders = false;
    }
  }

  async function loadRecentTickets() {
    loadingTickets = true;
    try {
      const response = await ticketApi.getCustomerTickets(1, 3);
      recentTickets = response.tickets;
    } catch (e) {
      if (!isAuthenticationError(e)) {
        console.error('Failed to load recent tickets:', e);
      }
    } finally {
      loadingTickets = false;
    }
  }

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getOrderStatusText(status: string) {
    const statusMap: Record<string, string> = {
      PENDING: t('order.pending'),
      CONFIRMED: t('order.confirmed'),
      PROCESSING: t('order.processing'),
      SHIPPED: t('order.shipped'),
      DELIVERED: t('order.delivered'),
      CANCELLED: t('order.cancelled'),
      REFUNDED: t('order.refunded') || status,
    };
    return statusMap[status] || status;
  }

  function getTicketStatusColor(status: TicketStatus): string {
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

  function getTicketStatusLabel(status: TicketStatus): string {
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
</script>

{#if loading}
  <ProfilePageSkeleton />
{:else if error}
  {#if isAuthenticationError(error)}
    <AuthError message={getErrorMessage(error)} />
  {:else}
    <p class="text-red-400">Error: {getErrorMessage(error)}</p>
  {/if}
{:else if profile}
  <div class="space-y-6">
    {#if profile.emailVerified === false}
      <div class="bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
        <p class="text-sm text-white/90">{t('auth.emailNotVerifiedBanner')}</p>
        <button
          type="button"
          class="px-4 py-2 bg-white text-black text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          disabled={resendBusy}
          on:click={async () => {
            resendBusy = true;
            resendMsg = '';
            try {
              const r = await authStore.resendVerification();
              resendMsg = r.message;
            } catch (e) {
              resendMsg = e instanceof Error ? e.message : '';
            } finally {
              resendBusy = false;
            }
          }}
        >
          {resendBusy ? t('common.loading') : t('auth.resendVerificationEmail')}
        </button>
        {#if resendMsg}
          <p class="text-xs text-white/70">{resendMsg}</p>
        {/if}
      </div>
    {/if}
    <!-- Profile Info -->
    <div class="bg-dark-light p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('profile.personalInformation')}</h3>
        {#if !editing}
          <button
            on:click={() => (editing = true)}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('profile.edit')}
          </button>
        {/if}
      </div>

      {#if editing}
        <form on:submit|preventDefault={saveProfile} class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2" for="profile-first-name"
                >{t('profile.firstName')}</label
              >
              <input
                id="profile-first-name"
                type="text"
                bind:value={firstName}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2" for="profile-last-name"
                >{t('profile.lastName')}</label
              >
              <input
                id="profile-last-name"
                type="text"
                bind:value={lastName}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2" for="profile-email"
              >{t('customer.email')}</label
            >
            <input
              id="profile-email"
              type="email"
              bind:value={email}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2" for="profile-phone"
              >{t('customer.phone')}</label
            >
            <input
              id="profile-phone"
              type="tel"
              bind:value={phone}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div class="flex gap-4">
            <button
              type="submit"
              class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
            >
              {t('profile.save')}
            </button>
            <button
              type="button"
              on:click={() => {
                editing = false;
                loadProfile();
              }}
              class="px-6 py-2 bg-dark-light border border-accent/20 hover:bg-dark transition-colors"
            >
              {t('profile.cancel')}
            </button>
          </div>
        </form>
      {:else}
        <div class="space-y-2">
          <p><strong>{t('profile.name')}:</strong> {profile.firstName} {profile.lastName}</p>
          <p><strong>{t('customer.email')}:</strong> {profile.email}</p>
          {#if profile.phone}
            <p><strong>{t('customer.phone')}:</strong> {profile.phone}</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Change Password -->
    <div class="bg-dark-light p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('profile.changePassword')}</h3>
        {#if !changingPassword}
          <button
            on:click={() => (changingPassword = true)}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('profile.changePassword')}
          </button>
        {/if}
      </div>

      {#if changingPassword}
        <form on:submit|preventDefault={changePassword} class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2" for="profile-current-password"
              >{t('profile.currentPassword')}</label
            >
            <input
              id="profile-current-password"
              type="password"
              bind:value={currentPassword}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2" for="profile-new-password"
              >{t('profile.newPassword')}</label
            >
            <input
              id="profile-new-password"
              type="password"
              bind:value={newPassword}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2" for="profile-confirm-password"
              >{t('profile.confirmNewPassword')}</label
            >
            <input
              id="profile-confirm-password"
              type="password"
              bind:value={confirmPassword}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div class="flex gap-4">
            <button
              type="submit"
              class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
            >
              {t('profile.changePassword')}
            </button>
            <button
              type="button"
              on:click={() => {
                changingPassword = false;
                currentPassword = '';
                newPassword = '';
                confirmPassword = '';
              }}
              class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
            >
              {t('profile.cancel')}
            </button>
          </div>
        </form>
      {/if}
    </div>

    <!-- Recent Orders -->
    <div class="bg-dark-light p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('account.orders')}</h3>
        <a
          href="/account/orders"
          class="text-sm text-accent hover:text-accent-muted transition-colors"
        >
          {t('dashboard.viewAll')}
        </a>
      </div>

      {#if loadingOrders}
        <p class="text-accent-muted text-sm">{t('common.loading')}</p>
      {:else if recentOrders.length === 0}
        <p class="text-accent-muted text-sm">{t('order.noOrdersYet')}</p>
      {:else}
        <div class="space-y-3">
          {#each recentOrders as order}
            <div
              class="p-4 bg-dark border border-white/10 hover:border-accent/50 hover:bg-white/[0.04] hover:shadow-md hover:shadow-accent/5 transition-all duration-200 cursor-pointer"
              on:click={() => goto(`/account/orders/${order.id}`)}
              role="button"
              tabindex="0"
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  goto(`/account/orders/${order.id}`);
                }
              }}
            >
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <p class="font-medium mb-1">
                    {t('order.orderHash')}{order.orderNumber}
                  </p>
                  <p class="text-sm text-accent-muted">
                    {formatDate(order.createdAt)} • {formatOrderAmount(
                      Number(order.total || 0),
                      order
                    )}
                  </p>
                </div>
                <span class="text-xs text-black ml-4">
                  {getOrderStatusText(order.status)}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Recent Tickets -->
    <div class="bg-dark-light p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('account.supportTickets')}</h3>
        <a
          href="/account/tickets"
          class="text-sm text-accent hover:text-accent-muted transition-colors"
        >
          {t('dashboard.viewAll')}
        </a>
      </div>

      {#if loadingTickets}
        <p class="text-accent-muted text-sm">{t('common.loading')}</p>
      {:else if recentTickets.length === 0}
        <p class="text-accent-muted text-sm">{t('ticket.noTicketsYet')}</p>
      {:else}
        <div class="space-y-3">
          {#each recentTickets as ticket}
            <div
              class="p-4 bg-dark border border-white/10 hover:border-accent/50 hover:bg-white/[0.04] hover:shadow-md hover:shadow-accent/5 transition-all duration-200 cursor-pointer"
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
                  <p class="font-medium mb-1">{ticket.subject}</p>
                  <p class="text-sm text-accent-muted">
                    {formatDate(ticket.createdAt)}
                  </p>
                </div>
                <span
                  class="px-2 py-1 text-xs font-medium text-white {getTicketStatusColor(
                    ticket.status
                  )} ml-4"
                >
                  {getTicketStatusLabel(ticket.status)}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
