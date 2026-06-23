<script lang="ts">
  import { onMount } from 'svelte';
  import { partnerApi, type Partner } from '$lib/api/partner.api';
  import { adminApi } from '$lib/api/admin.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { authStore } from '$lib/stores/auth.store';
  import { goto } from '$app/navigation';

  let partners: Partner[] = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let totalPages = 1;
  let searchQuery = '';
  let activeTab: 'list' | 'stats' | 'orders' | 'payouts' | 'tickets' | 'documents' = 'list';
  let selectedPartner: Partner | null = null;

  // Assign partner modal
  let showAssignModal = false;
  let userSearchQuery = '';
  let userSearchResults: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isPartner?: boolean;
  }> = [];
  let searchingUsers = false;

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
    await loadPartners();
  });

  async function loadPartners() {
    loading = true;
    try {
      const response = await partnerApi.getAllPartners(currentPage, 20, searchQuery || undefined);
      partners = response.partners;
      totalPages = response.pagination.totalPages;
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : t('partner.failedToLoad') || 'Failed to load partners';
    } finally {
      loading = false;
    }
  }

  async function togglePartnerStatus(partner: Partner) {
    try {
      const newStatus = partner.partnerStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await partnerApi.updatePartnerStatus(partner.id, newStatus);
      notificationStore.success(t('partner.statusUpdated') || 'Partner status updated');
      await loadPartners();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('partner.failedToUpdate') || 'Failed to update partner status'
      );
    }
  }

  function viewPartnerDetails(partner: Partner) {
    selectedPartner = partner;
    goto(`/admin/partners/${partner.id}`);
  }

  async function searchUsers() {
    if (!userSearchQuery.trim()) {
      userSearchResults = [];
      return;
    }
    searchingUsers = true;
    try {
      const response = await adminApi.getAllCustomers(1, 10, { search: userSearchQuery });
      // Filter out users who are already partners
      userSearchResults = (response.customers as any[])
        .filter((c: any) => !c.isPartner)
        .map((c: any) => ({
          id: c.id,
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          isPartner: false,
        }));
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToSearchUsers') || 'Failed to search users'
      );
      userSearchResults = [];
    } finally {
      searchingUsers = false;
    }
  }

  async function assignPartner(userId: string, userEmail: string) {
    const confirmed = await dialogStore.confirm(
      `${t('partner.assignPartner') || 'Assign as partner'} ${userEmail}?`,
      t('common.confirm') || 'Confirm'
    );
    if (!confirmed) return;

    try {
      await partnerApi.assignPartner(userId, 'ACTIVE');
      notificationStore.success(t('partner.assigned') || 'User assigned as partner');
      showAssignModal = false;
      userSearchQuery = '';
      userSearchResults = [];
      await loadPartners();

      // If the assigned user is the current logged-in user, refresh their auth data
      const currentUser = $authStore.user;
      if (currentUser && currentUser.id === userId) {
        await authStore.checkAuth();
      }
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('partner.failedToAssign') || 'Failed to assign partner'
      );
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('menu.partners') || 'Partners'}</h2>
    <button
      on:click={() => (showAssignModal = true)}
      class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
    >
      {t('partner.assignPartner') || 'Assign as partner'}
    </button>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
    <button
      type="button"
      on:click={() => (activeTab = 'list')}
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'list'}
      class:shadow-sm={activeTab === 'list'}
      class:text-accent={activeTab === 'list'}
      class:text-gray-600={activeTab !== 'list'}
      class:hover:bg-gray-50={activeTab !== 'list'}
      class:hover:text-gray-900={activeTab !== 'list'}
    >
      {t('partner.list') || 'List of partners'}
    </button>
    <button
      type="button"
      on:click={() => (activeTab = 'stats')}
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'stats'}
      class:shadow-sm={activeTab === 'stats'}
      class:text-accent={activeTab === 'stats'}
      class:text-gray-600={activeTab !== 'stats'}
      class:hover:bg-gray-50={activeTab !== 'stats'}
      class:hover:text-gray-900={activeTab !== 'stats'}
    >
      {t('partner.statistics') || 'Statistics'}
    </button>
    <button
      type="button"
      on:click={() => (activeTab = 'orders')}
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'orders'}
      class:shadow-sm={activeTab === 'orders'}
      class:text-accent={activeTab === 'orders'}
      class:text-gray-600={activeTab !== 'orders'}
      class:hover:bg-gray-50={activeTab !== 'orders'}
      class:hover:text-gray-900={activeTab !== 'orders'}
    >
      {t('partner.orders') || 'Orders'}
    </button>
    <button
      type="button"
      on:click={() => (activeTab = 'payouts')}
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'payouts'}
      class:shadow-sm={activeTab === 'payouts'}
      class:text-accent={activeTab === 'payouts'}
      class:text-gray-600={activeTab !== 'payouts'}
      class:hover:bg-gray-50={activeTab !== 'payouts'}
      class:hover:text-gray-900={activeTab !== 'payouts'}
    >
      {t('partner.payouts') || 'Payouts'}
    </button>
    <button
      type="button"
      on:click={() => (activeTab = 'tickets')}
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'tickets'}
      class:shadow-sm={activeTab === 'tickets'}
      class:text-accent={activeTab === 'tickets'}
      class:text-gray-600={activeTab !== 'tickets'}
      class:hover:bg-gray-50={activeTab !== 'tickets'}
      class:hover:text-gray-900={activeTab !== 'tickets'}
    >
      {t('partner.tickets') || 'Tickets'}
    </button>
    <button
      type="button"
      on:click={() => (activeTab = 'documents')}
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
      class:bg-white={activeTab === 'documents'}
      class:shadow-sm={activeTab === 'documents'}
      class:text-accent={activeTab === 'documents'}
      class:text-gray-600={activeTab !== 'documents'}
      class:hover:bg-gray-50={activeTab !== 'documents'}
      class:hover:text-gray-900={activeTab !== 'documents'}
    >
      {t('partner.documents') || 'Documents'}
    </button>
  </div>

  {#if activeTab === 'list'}
    <!-- Search -->
    <div class="mb-6">
      <input
        type="text"
        bind:value={searchQuery}
        on:input={loadPartners}
        placeholder={t('partner.searchPartners') || 'Search partners...'}
        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
      />
    </div>

    {#if loading}
      <div class="w-full py-8"><LoadingBar /></div>
    {:else if error}
      <div class="mb-6 p-4 bg-red-500/20 border border-red-500 text-red-400">
        {error}
      </div>
    {:else if partners.length === 0}
      <div class="text-center py-12">
        <p class="text-gray-600 mb-4">{t('partner.noPartners') || 'Partners not found'}</p>
        <p class="text-sm text-gray-500">
          {t('partner.assignFromCustomers') || 'Assign partners from the "Customers" section'}
        </p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each partners as partner}
          <div class="bg-white border border-gray-300 p-6 hover:shadow-md transition-shadow">
            <div class="flex flex-wrap justify-between items-start gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 sm:gap-4 mb-2">
                  <h3 class="text-lg font-semibold text-black break-words min-w-0">
                    {partner.firstName || ''}
                    {partner.lastName || ''}
                    {#if !partner.firstName && !partner.lastName}
                      <span class="break-all">{partner.email}</span>
                    {/if}
                  </h3>
                  {#if partner.partnerStatus}
                    <span
                      class="px-2 py-1 text-xs font-medium rounded {partner.partnerStatus ===
                      'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : partner.partnerStatus === 'INACTIVE'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800'}"
                    >
                      {partner.partnerStatus === 'ACTIVE'
                        ? t('partner.statusActive') || 'Active'
                        : partner.partnerStatus === 'INACTIVE'
                          ? t('partner.statusInactive') || 'Inactive'
                          : t('partner.statusSuspended') || 'Suspended'}
                    </span>
                  {/if}
                </div>
                <p class="text-sm text-gray-600 mb-1 break-all min-w-0">{partner.email}</p>
                {#if partner.phone}
                  <p class="text-sm text-gray-600 mb-1">{partner.phone}</p>
                {/if}
                <p class="text-xs text-gray-500">
                  {t('partner.joined') || 'Joined'}: {formatDate(partner.createdAt)}
                </p>
                {#if partner._count}
                  <div class="mt-3 flex gap-4 text-sm text-gray-600">
                    <span
                      >{t('partner.promoCodes') || 'Promo codes'}: {partner._count.promoCodes ||
                        0}</span
                    >
                    <span>{t('partner.orders') || 'Orders'}: {partner._count.orders || 0}</span>
                  </div>
                {/if}
              </div>
              <div class="flex flex-shrink-0 gap-2 sm:ml-4">
                <button
                  on:click={() => viewPartnerDetails(partner)}
                  class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
                >
                  {t('partner.viewDetails') || 'Details'}
                </button>
                {#if partner.partnerStatus}
                  <button
                    on:click={() => togglePartnerStatus(partner)}
                    class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-sm text-black"
                  >
                    {partner.partnerStatus === 'ACTIVE'
                      ? t('partner.deactivate') || 'Deactivate'
                      : t('partner.activate') || 'Activate'}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="mt-6 flex justify-center gap-2">
          <button
            on:click={() => {
              currentPage--;
              loadPartners();
            }}
            disabled={currentPage === 1}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-black"
          >
            {t('common.previous') || 'Previous'}
          </button>
          <span class="px-4 py-2 text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            on:click={() => {
              currentPage++;
              loadPartners();
            }}
            disabled={currentPage === totalPages}
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-black"
          >
            {t('common.next') || 'Next'}
          </button>
        </div>
      {/if}
    {/if}
  {:else if activeTab === 'stats'}
    <div class="text-center py-12">
      <p class="text-gray-600">
        {t('partner.statsComingSoon') || 'Statistics will be available soon'}
      </p>
    </div>
  {:else if activeTab === 'orders'}
    <div class="text-center py-12">
      <p class="text-gray-600">
        {t('partner.viewOrdersInPartnerDetails') || 'View orders in the details of each partner'}
      </p>
    </div>
  {:else if activeTab === 'payouts'}
    {@const payoutPage = 1}
    {#await partnerApi.getAllPayouts(payoutPage, 20) then { payouts, pagination }}
      {#if payouts.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-600">{t('partner.noPayouts') || 'Payouts not found'}</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each payouts as payout}
            <div class="bg-white border border-gray-300 p-6">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h4 class="font-semibold text-lg">
                    {payout.partner?.firstName || ''}
                    {payout.partner?.lastName || ''}
                    {#if !payout.partner?.firstName && !payout.partner?.lastName}
                      {payout.partner?.email}
                    {/if}
                  </h4>
                  <p class="text-sm text-gray-600">{payout.partner?.email}</p>
                  <p class="text-2xl font-bold mt-2">${Number(payout.amount).toFixed(2)}</p>
                  <p class="text-sm text-gray-600 mt-1">
                    {t('partner.requestedAt') || 'Requested'}: {formatDate(payout.requestedAt)}
                  </p>
                  {#if payout.approvedAt}
                    <p class="text-sm text-gray-600">
                      {t('partner.approvedAt') || 'Approved'}: {formatDate(payout.approvedAt)}
                    </p>
                  {/if}
                  {#if payout.paidAt}
                    <p class="text-sm text-gray-600">
                      {t('partner.paidAt') || 'Paid'}: {formatDate(payout.paidAt)}
                    </p>
                  {/if}
                </div>
                <span
                  class="px-3 py-1 text-sm rounded {payout.status === 'PAID'
                    ? 'bg-green-100 text-green-800'
                    : payout.status === 'APPROVED'
                      ? 'bg-blue-100 text-blue-800'
                      : payout.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'}"
                >
                  {payout.status}
                </span>
              </div>
              {#if payout.rejectionReason}
                <p class="text-sm text-red-600 mb-2">
                  <strong>{t('partner.rejectionReason') || 'Rejection reason'}:</strong>
                  {payout.rejectionReason}
                </p>
              {/if}
              {#if payout.adminNotes}
                <p class="text-sm text-gray-600 mb-2">
                  <strong>{t('partner.adminNotes') || 'Admin notes'}:</strong>
                  {payout.adminNotes}
                </p>
              {/if}
              {#if payout.commissions && payout.commissions.length > 0}
                <div class="mt-4">
                  <p class="text-sm font-medium mb-2">
                    {t('partner.commissions') || 'Commissions'} ({payout.commissions.length}):
                  </p>
                  <ul class="text-sm text-gray-600 space-y-1">
                    {#each payout.commissions.slice(0, 5) as comm}
                      <li>
                        • Order {comm.order?.orderNumber || '-'} - ${Number(
                          comm.commissionAmount
                        ).toFixed(2)}
                      </li>
                    {/each}
                    {#if payout.commissions.length > 5}
                      <li class="text-gray-500">... and {payout.commissions.length - 5} more</li>
                    {/if}
                  </ul>
                </div>
              {/if}
              <div class="mt-4 flex gap-2">
                {#if payout.status === 'PENDING'}
                  <button
                    on:click={async () => {
                      const confirmed = await dialogStore.confirm(
                        t('partner.approvePayoutConfirm') ||
                          `Approve payout $${Number(payout.amount).toFixed(2)}?`,
                        t('common.confirm') || 'Confirm'
                      );
                      if (!confirmed) return;
                      try {
                        await partnerApi.approvePayout(payout.id);
                        notificationStore.success(t('partner.payoutApproved') || 'Payout approved');
                        // Force reload by changing activeTab
                        activeTab = 'list';
                        setTimeout(() => {
                          activeTab = 'payouts';
                        }, 100);
                      } catch (e) {
                        notificationStore.error(
                          e instanceof Error
                            ? e.message
                            : t('partner.failedToApprove') || 'Failed to approve payout'
                        );
                      }
                    }}
                    class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors text-sm"
                  >
                    {t('partner.approve') || 'Approve'}
                  </button>
                  <button
                    on:click={async () => {
                      const reason = prompt(t('partner.rejectionReason') || 'Rejection reason:');
                      if (!reason) return;
                      try {
                        await partnerApi.rejectPayout(payout.id, reason);
                        notificationStore.success(t('partner.payoutRejected') || 'Payout rejected');
                        // Force reload by changing activeTab
                        activeTab = 'list';
                        setTimeout(() => {
                          activeTab = 'payouts';
                        }, 100);
                      } catch (e) {
                        notificationStore.error(
                          e instanceof Error
                            ? e.message
                            : t('partner.failedToReject') || 'Failed to reject payout'
                        );
                      }
                    }}
                    class="px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors text-sm"
                  >
                    {t('partner.reject') || 'Reject'}
                  </button>
                {:else if payout.status === 'APPROVED'}
                  <button
                    on:click={async () => {
                      const confirmed = await dialogStore.confirm(
                        t('partner.markPaidConfirm') ||
                          `Mark payout $${Number(payout.amount).toFixed(2)} as paid?`,
                        t('common.confirm') || 'Confirm'
                      );
                      if (!confirmed) return;
                      try {
                        await partnerApi.markPayoutAsPaid(payout.id);
                        notificationStore.success(
                          t('partner.payoutMarkedPaid') || 'Payout marked as paid'
                        );
                        // Force reload by changing activeTab
                        activeTab = 'list';
                        setTimeout(() => {
                          activeTab = 'payouts';
                        }, 100);
                      } catch (e) {
                        notificationStore.error(
                          e instanceof Error
                            ? e.message
                            : t('partner.failedToMarkPaid') || 'Failed to mark payout'
                        );
                      }
                    }}
                    class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm"
                  >
                    {t('partner.markAsPaid') || 'Mark as paid'}
                  </button>
                {/if}
                <button
                  on:click={() => goto(`/admin/partners/${payout.partnerId}`)}
                  class="px-4 py-2 bg-gray-200 text-black hover:bg-gray-300 transition-colors text-sm"
                >
                  {t('partner.viewPartner') || 'View partner'}
                </button>
              </div>
            </div>
          {/each}
        </div>
        {#if pagination.totalPages > 1}
          <div class="mt-6 flex justify-center gap-2">
            <button
              on:click={() => {
                currentPage++;
                loadPartners();
              }}
              disabled={currentPage >= pagination.totalPages}
              class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 text-black"
            >
              {t('common.next') || 'Next'}
            </button>
          </div>
        {/if}
      {/if}
    {:catch e}
      <div class="text-center py-12">
        <p class="text-red-600">
          {e instanceof Error
            ? e.message
            : t('partner.failedToLoadPayouts') || 'Failed to load payouts'}
        </p>
      </div>
    {/await}
  {:else if activeTab === 'tickets'}
    <div class="text-center py-12">
      <p class="text-gray-600">
        {t('partner.ticketsComingSoon') || 'Tickets will be available soon'}
      </p>
    </div>
  {:else if activeTab === 'documents'}
    <div class="text-center py-12">
      <p class="text-gray-600">
        {t('partner.documentsComingSoon') || 'Documents management will be available soon'}
      </p>
    </div>
  {/if}

  <!-- Assign Partner Modal -->
  {#if showAssignModal}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t('partner.assignPartner') || 'Assign partner'}
      tabindex="-1"
    >
      <div class="bg-white p-6 max-w-md w-full mx-4" role="document">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-black">
            {t('partner.assignPartner') || 'Assign partner'}
          </h3>
          <button
            on:click={() => {
              showAssignModal = false;
              userSearchQuery = '';
              userSearchResults = [];
            }}
            class="text-gray-500 hover:text-black"
          >
            ✕
          </button>
        </div>

        <div class="mb-4">
          <label for="user-search-input" class="block text-sm font-medium mb-2 text-black">
            {t('partner.searchUser') || 'Search user'}
          </label>
          <div class="relative">
            <input
              id="user-search-input"
              type="text"
              bind:value={userSearchQuery}
              on:input={searchUsers}
              placeholder={t('partner.searchUserPlaceholder') || 'Enter email or username...'}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
            {#if searchingUsers}
              <div class="absolute right-2 top-1/2 -translate-y-1/2">
                <span class="text-sm text-gray-500">{t('common.loading') || 'Loading...'}</span>
              </div>
            {/if}
          </div>
        </div>

        {#if userSearchResults.length > 0}
          <div class="max-h-60 overflow-y-auto border border-gray-300 mb-4">
            {#each userSearchResults as user}
              <button
                type="button"
                on:click={() => assignPartner(user.id, user.email)}
                class="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-b-0"
              >
                <div class="font-medium text-black">
                  {user.firstName || ''}
                  {user.lastName || ''}
                  {#if !user.firstName && !user.lastName}
                    {user.email}
                  {/if}
                </div>
                <div class="text-sm text-gray-600">{user.email}</div>
              </button>
            {/each}
          </div>
        {:else if userSearchQuery && !searchingUsers}
          <div class="text-center py-4 text-gray-500 text-sm">
            {t('partner.noUsersFound') || 'Users not found'}
          </div>
        {/if}

        <div class="flex justify-end gap-2">
          <button
            on:click={() => {
              showAssignModal = false;
              userSearchQuery = '';
              userSearchResults = [];
            }}
            class="px-4 py-2 bg-gray-200 text-black hover:bg-gray-300 transition-colors"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
