<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { partnerApi, type PartnerCommission, type PartnerPayout } from '$lib/api/partner.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { authStore } from '$lib/stores/auth.store';
  import { appendUtmParams, partnerProductUtm } from '$lib/utils/utm.utils';

  let loading = true;
  let error = '';
  let activeTab: 'dashboard' | 'promocodes' | 'orders' | 'commissions' | 'payouts' = 'dashboard';
  let partnerProductSlug = '';
  let selectedPartnerPromoCode = ''; // code string for link (one of partnerPromoCodes)
  let partnerPromoCodes: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    usageLimit?: number;
    usedCount: number;
  }[] = [];
  let copiedLink = false;

  let stats: {
    stats: Record<string, { count: number; amount: number }>;
    total: number;
    totalCount: number;
  } | null = null;

  let commissions: PartnerCommission[] = [];
  let payouts: PartnerPayout[] = [];
  let availableCommissions: PartnerCommission[] = [];

  let currentPageCommissions = 1;
  let totalPagesCommissions = 1;
  let currentPagePayouts = 1;
  let totalPagesPayouts = 1;

  let showPayoutModal = false;
  let payoutAmount = 0;
  let selectedCommissionIds: string[] = [];

  $: user = $authStore.user;
  $: baseUrl = typeof window !== 'undefined' ? window.location.origin : $page.url.origin;
  $: baseProductUrlWithUtm =
    partnerProductSlug.trim() && user?.id
      ? appendUtmParams(
          `${baseUrl}/shop/product/${partnerProductSlug.trim()}`,
          partnerProductUtm(user.id, partnerProductSlug.trim())
        )
      : '';
  $: partnerProductUrl =
    baseProductUrlWithUtm && selectedPartnerPromoCode
      ? `${baseProductUrlWithUtm}${baseProductUrlWithUtm.includes('?') ? '&' : '?'}promo=${encodeURIComponent(selectedPartnerPromoCode)}`
      : baseProductUrlWithUtm;

  async function copyPartnerLink() {
    if (!partnerProductUrl) return;
    try {
      await navigator.clipboard.writeText(partnerProductUrl);
      copiedLink = true;
      notificationStore.success(t('partner.linkCopied') || 'Link copied');
      setTimeout(() => (copiedLink = false), 2000);
    } catch {
      notificationStore.error(t('partner.linkCopyFailed') || 'Failed to copy link');
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

  onMount(async () => {
    if (!user?.isPartner) {
      error = t('partner.notAPartner') || 'You are not a partner';
      loading = false;
      return;
    }
    await loadDashboard();
  });

  async function loadDashboard() {
    loading = true;
    try {
      const [
        statsResponse,
        commissionsResponse,
        payoutsResponse,
        availableResponse,
        promoCodesResponse,
      ] = await Promise.all([
        partnerApi.getCommissionStats().catch(() => null),
        partnerApi
          .getOwnCommissions(1, 10)
          .catch(() => ({ commissions: [], pagination: { totalPages: 1 } })),
        partnerApi
          .getOwnPayouts(1, 10)
          .catch(() => ({ payouts: [], pagination: { totalPages: 1 } })),
        partnerApi.getAvailableCommissions().catch(() => ({ commissions: [] })),
        partnerApi.getOwnPromoCodes().catch(() => ({ promoCodes: [] })),
      ]);

      stats = statsResponse;
      commissions = commissionsResponse.commissions;
      payouts = payoutsResponse.payouts;
      availableCommissions = availableResponse.commissions;
      partnerPromoCodes = promoCodesResponse.promoCodes ?? [];
      if (partnerPromoCodes.length > 0 && !selectedPartnerPromoCode) {
        selectedPartnerPromoCode = partnerPromoCodes[0].code;
      }

      const totalAvailable = availableCommissions.reduce(
        (sum, c) => sum + Number(c.commissionAmount),
        0
      );
      payoutAmount = totalAvailable;
      selectedCommissionIds = availableCommissions.map((c) => c.id);
    } catch (e) {
      error =
        e instanceof Error ? e.message : t('partner.failedToLoad') || 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  async function loadCommissions(page: number = 1) {
    try {
      const response = await partnerApi.getOwnCommissions(page, 20);
      commissions = response.commissions;
      currentPageCommissions = page;
      totalPagesCommissions = response.pagination.totalPages;
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToLoadCommissions') || 'Failed to load commissions'
      );
    }
  }

  async function loadPayouts(page: number = 1) {
    try {
      const response = await partnerApi.getOwnPayouts(page, 20);
      payouts = response.payouts;
      currentPagePayouts = page;
      totalPagesPayouts = response.pagination.totalPages;
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToLoadPayouts') || 'Failed to load payouts'
      );
    }
  }

  function handleCommissionToggle(commissionId: string, checked: boolean) {
    if (checked) {
      selectedCommissionIds = [...selectedCommissionIds, commissionId];
    } else {
      selectedCommissionIds = selectedCommissionIds.filter((id: string) => id !== commissionId);
    }
    payoutAmount = selectedCommissionIds
      .map((id: string) => availableCommissions.find((c: PartnerCommission) => c.id === id))
      .filter((c): c is PartnerCommission => c !== undefined)
      .reduce((sum: number, c: PartnerCommission) => sum + Number(c.commissionAmount), 0);
  }

  async function createPayoutRequest() {
    if (selectedCommissionIds.length === 0 || payoutAmount <= 0) {
      notificationStore.error(t('partner.selectCommissions') || 'Select commissions for payout');
      return;
    }

    const confirmed = await dialogStore.confirm(
      t('partner.confirmPayoutRequest') ||
        `Request payout for $${payoutAmount.toFixed(2)}?`,
      t('common.confirm') || 'Confirm'
    );
    if (!confirmed) return;

    try {
      await partnerApi.createPayoutRequest(payoutAmount, selectedCommissionIds);
      notificationStore.success(t('partner.payoutRequestCreated') || 'Payout request created');
      showPayoutModal = false;
      await loadDashboard();
      await loadPayouts();
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToCreatePayout') || 'Failed to create payout request'
      );
    }
  }

  function handleTabChange(tab: typeof activeTab) {
    activeTab = tab;
    if (tab === 'commissions') {
      loadCommissions();
    } else if (tab === 'payouts') {
      loadPayouts();
    }
  }
</script>

<div>
  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <div class="mb-6 p-4 bg-red-500/20 border border-red-500 text-red-400">
      {error}
    </div>
  {:else}
    <h2 class="text-3xl font-bold mb-6">{t('account.partner') || 'Partner panel'}</h2>

    <!-- Tabs -->
    <div class="mb-6 border-b border-gray-300">
      <div class="flex gap-4 overflow-x-auto">
        <button
          type="button"
          on:click={() => handleTabChange('dashboard')}
          class="px-4 py-2 font-medium transition-colors whitespace-nowrap border-b-2 {activeTab ===
          'dashboard'
            ? 'border-black text-black'
            : 'border-transparent text-gray-600 hover:text-black'}"
        >
          {t('partner.dashboard') || 'Dashboard'}
        </button>
        <button
          type="button"
          on:click={() => handleTabChange('orders')}
          class="px-4 py-2 font-medium transition-colors whitespace-nowrap border-b-2 {activeTab ===
          'orders'
            ? 'border-black text-black'
            : 'border-transparent text-gray-600 hover:text-black'}"
        >
          {t('partner.orders') || 'Orders'}
        </button>
        <button
          type="button"
          on:click={() => handleTabChange('commissions')}
          class="px-4 py-2 font-medium transition-colors whitespace-nowrap border-b-2 {activeTab ===
          'commissions'
            ? 'border-black text-black'
            : 'border-transparent text-gray-600 hover:text-black'}"
        >
          {t('partner.commissions') || 'Commissions'}
        </button>
        <button
          type="button"
          on:click={() => handleTabChange('payouts')}
          class="px-4 py-2 font-medium transition-colors whitespace-nowrap border-b-2 {activeTab ===
          'payouts'
            ? 'border-black text-black'
            : 'border-transparent text-gray-600 hover:text-black'}"
        >
          {t('partner.payouts') || 'Payouts'}
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'dashboard'}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-sm font-medium text-gray-600 mb-2">
            {t('partner.totalCommissions') || 'Total commissions'}
          </h3>
          <p class="text-3xl font-bold text-black">${(stats?.total || 0).toFixed(2)}</p>
          <p class="text-sm text-gray-500 mt-1">
            {stats?.totalCount || 0}
            {t('partner.commissions') || 'commissions'}
          </p>
        </div>
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-sm font-medium text-gray-600 mb-2">
            {t('partner.availableForPayout') || 'Available for payout'}
          </h3>
          <p class="text-3xl font-bold text-black">
            ${(stats?.stats.PENDING?.amount || 0).toFixed(2)}
          </p>
          <p class="text-sm text-gray-500 mt-1">
            {stats?.stats.PENDING?.count || 0}
            {t('partner.commissions') || 'commissions'}
          </p>
        </div>
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-sm font-medium text-gray-600 mb-2">
            {t('partner.paidCommissions') || 'Paid'}
          </h3>
          <p class="text-3xl font-bold text-black">
            ${(stats?.stats.PAID?.amount || 0).toFixed(2)}
          </p>
          <p class="text-sm text-gray-500 mt-1">
            {stats?.stats.PAID?.count || 0}
            {t('partner.commissions') || 'commissions'}
          </p>
        </div>
      </div>

      {#if availableCommissions.length > 0}
        <div class="bg-white border border-gray-300 p-6 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">
              {t('partner.availableForPayout') || 'Available for payout'}
            </h3>
            <button
              on:click={() => (showPayoutModal = true)}
              class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
            >
              {t('partner.requestPayout') || 'Request payout'}
            </button>
          </div>
          <p class="text-2xl font-bold mb-4">
            ${availableCommissions
              .reduce((sum, c) => sum + Number(c.commissionAmount), 0)
              .toFixed(2)}
          </p>
          <p class="text-sm text-gray-600">
            {availableCommissions.length}
            {t('partner.commissions') || 'commissions'}
          </p>
        </div>
      {/if}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-lg font-semibold mb-4">
            {t('partner.recentCommissions') || 'Recent commissions'}
          </h3>
          {#if commissions.length === 0}
            <p class="text-gray-600 text-sm">
              {t('partner.noCommissions') || 'Commissions not found'}
            </p>
          {:else}
            <div class="space-y-3">
              {#each commissions.slice(0, 5) as commission}
                <div class="flex justify-between items-center text-sm">
                  <div>
                    <p class="font-medium">${Number(commission.commissionAmount).toFixed(2)}</p>
                    <p class="text-gray-500">{formatDate(commission.createdAt)}</p>
                  </div>
                  <span
                    class="px-2 py-1 text-xs rounded {commission.status === 'PAID'
                      ? 'bg-green-100 text-green-800'
                      : commission.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'}"
                  >
                    {commission.status}
                  </span>
                </div>
              {/each}
            </div>
            <a
              href="/account/partner#commissions"
              on:click|preventDefault={() => handleTabChange('commissions')}
              class="block mt-4 text-sm text-black hover:underline"
            >
              {t('partner.viewAllCommissions') || 'View all commissions →'}
            </a>
          {/if}
        </div>

        <!-- Partner product link with UTM + promo -->
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-lg font-semibold mb-2">
            {t('partner.productLinkTitle') || 'Partner product link'}
          </h3>
          <p class="text-sm text-gray-600 mb-4">
            {t('partner.productLinkHint') ||
              'Enter product slug — link with UTM tags for analytics. Commission is credited when your promo code is applied.'}
          </p>
          <p class="text-sm text-gray-700 mb-3">
            {t('partner.productLinkPromoHint') ||
              'Promo code in the link will be applied automatically: the visitor does not need to enter it manually.'}
          </p>
          <div class="space-y-3">
            <div class="flex gap-2 flex-wrap items-center">
              <input
                type="text"
                bind:value={partnerProductSlug}
                placeholder={t('partner.productSlugPlaceholder') || 'slug-tovara'}
                class="flex-1 min-w-[120px] px-4 py-2 border border-gray-300 text-black"
              />
              {#if partnerPromoCodes.length > 0}
                <select
                  bind:value={selectedPartnerPromoCode}
                  class="px-4 py-2 border border-gray-300 text-black bg-white min-w-[140px]"
                  aria-label={t('partner.selectPromoForLink') || 'Promo code for link'}
                >
                  {#each partnerPromoCodes as promo}
                    <option value={promo.code}>{promo.code}</option>
                  {/each}
                </select>
              {:else}
                <span class="text-sm text-amber-700"
                  >{t('partner.noPromoForLink') ||
                    'No active promo codes - create in admin panel'}</span
                >
              {/if}
              <button
                type="button"
                on:click={copyPartnerLink}
                disabled={!partnerProductUrl}
                class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {copiedLink
                  ? t('partner.copied') || 'Copied'
                  : t('partner.copyLink') || 'Copy link'}
              </button>
            </div>
          </div>
          {#if partnerProductUrl}
            <p class="mt-2 text-xs text-gray-500 break-all font-mono">{partnerProductUrl}</p>
          {/if}
        </div>

        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-lg font-semibold mb-4">
            {t('partner.recentPayouts') || 'Recent payouts'}
          </h3>
          {#if payouts.length === 0}
            <p class="text-gray-600 text-sm">{t('partner.noPayouts') || 'Payouts not found'}</p>
          {:else}
            <div class="space-y-3">
              {#each payouts.slice(0, 5) as payout}
                <div class="flex justify-between items-center text-sm">
                  <div>
                    <p class="font-medium">${Number(payout.amount).toFixed(2)}</p>
                    <p class="text-gray-500">{formatDate(payout.requestedAt)}</p>
                  </div>
                  <span
                    class="px-2 py-1 text-xs rounded {payout.status === 'PAID'
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
              {/each}
            </div>
            <a
              href="/account/partner#payouts"
              on:click|preventDefault={() => handleTabChange('payouts')}
              class="block mt-4 text-sm text-black hover:underline"
            >
              {t('partner.viewAllPayouts') || 'View all payouts →'}
            </a>
          {/if}
        </div>
      </div>
    {:else if activeTab === 'orders'}
      <div class="text-center py-12">
        <p class="text-gray-600">
          {t('partner.ordersComingSoon') || 'Orders will be available soon'}
        </p>
      </div>
    {:else if activeTab === 'commissions'}
      <div class="mb-4">
        <select
          on:change={(e) => loadCommissions(1)}
          class="px-4 py-2 border border-gray-300 text-black"
        >
          <option value="">{t('partner.allStatuses') || 'All statuses'}</option>
          <option value="PENDING">{t('partner.statusPending') || 'Pending'}</option>
          <option value="PAID">{t('partner.statusPaid') || 'Paid'}</option>
          <option value="CANCELLED">{t('partner.statusCancelled') || 'Cancelled'}</option>
        </select>
      </div>
      {#await loadCommissions(1) then _}
        {#if commissions.length === 0}
          <div class="text-center py-12">
            <p class="text-gray-600">{t('partner.noCommissions') || 'Commissions not found'}</p>
          </div>
        {:else}
          <div class="bg-white border border-gray-300 overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th class="px-6 py-3 text-left text-sm font-medium"
                    >{t('common.date') || 'Date'}</th
                  >
                  <th class="px-6 py-3 text-left text-sm font-medium"
                    >{t('order.orderNumber') || 'Order'}</th
                  >
                  <th class="px-6 py-3 text-left text-sm font-medium"
                    >{t('promo.code') || 'Promo code'}</th
                  >
                  <th class="px-6 py-3 text-left text-sm font-medium"
                    >{t('order.total') || 'Order total'}</th
                  >
                  <th class="px-6 py-3 text-left text-sm font-medium"
                    >{t('partner.commissionAmount') || 'Commission'}</th
                  >
                  <th class="px-6 py-3 text-left text-sm font-medium"
                    >{t('partner.status') || 'Status'}</th
                  >
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {#each commissions as commission}
                  <tr>
                    <td class="px-6 py-4">{formatDate(commission.createdAt)}</td>
                    <td class="px-6 py-4 font-mono">{commission.order?.orderNumber || '-'}</td>
                    <td class="px-6 py-4">{commission.promoCode?.code || '-'}</td>
                    <td class="px-6 py-4">${Number(commission.orderTotal).toFixed(2)}</td>
                    <td class="px-6 py-4">${Number(commission.commissionAmount).toFixed(2)}</td>
                    <td class="px-6 py-4">
                      <span
                        class="px-2 py-1 text-xs rounded {commission.status === 'PAID'
                          ? 'bg-green-100 text-green-800'
                          : commission.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'}"
                      >
                        {commission.status}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if totalPagesCommissions > 1}
            <div class="mt-6 flex justify-center gap-2">
              <button
                on:click={() => loadCommissions(currentPageCommissions - 1)}
                disabled={currentPageCommissions === 1}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 text-black"
              >
                {t('common.previous') || 'Previous'}
              </button>
              <span class="px-4 py-2 text-gray-600"
                >{currentPageCommissions} / {totalPagesCommissions}</span
              >
              <button
                on:click={() => loadCommissions(currentPageCommissions + 1)}
                disabled={currentPageCommissions === totalPagesCommissions}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 text-black"
              >
                {t('common.next') || 'Next'}
              </button>
            </div>
          {/if}
        {/if}
      {/await}
    {:else if activeTab === 'payouts'}
      {#await loadPayouts(1) then _}
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
                    <h4 class="font-semibold text-lg">${Number(payout.amount).toFixed(2)}</h4>
                    <p class="text-sm text-gray-600">
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
              </div>
            {/each}
          </div>
          {#if totalPagesPayouts > 1}
            <div class="mt-6 flex justify-center gap-2">
              <button
                on:click={() => loadPayouts(currentPagePayouts - 1)}
                disabled={currentPagePayouts === 1}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 text-black"
              >
                {t('common.previous') || 'Previous'}
              </button>
              <span class="px-4 py-2 text-gray-600">{currentPagePayouts} / {totalPagesPayouts}</span
              >
              <button
                on:click={() => loadPayouts(currentPagePayouts + 1)}
                disabled={currentPagePayouts === totalPagesPayouts}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 text-black"
              >
                {t('common.next') || 'Next'}
              </button>
            </div>
          {/if}
        {/if}
      {/await}
    {/if}

    <!-- Payout Request Modal -->
    {#if showPayoutModal}
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-6 max-w-md w-full mx-4">
          <h3 class="text-xl font-semibold mb-4">
            {t('partner.requestPayout') || 'Request payout'}
          </h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2" for="payout-amount"
                >{t('partner.amount') || 'Amount'} *</label
              >
              <input
                id="payout-amount"
                type="number"
                bind:value={payoutAmount}
                min="0"
                step="0.01"
                max={availableCommissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0)}
                class="w-full px-4 py-2 border border-gray-300 text-black"
              />
              <p class="text-xs text-gray-500 mt-1">
                {t('partner.maxAmount') || 'Maximum'}: ${availableCommissions
                  .reduce((sum, c) => sum + Number(c.commissionAmount), 0)
                  .toFixed(2)}
              </p>
            </div>
            <div>
              <h4 class="block text-sm font-medium mb-2">
                {t('partner.selectCommissions') || 'Select commissions'}
              </h4>
              <div class="max-h-48 overflow-y-auto border border-gray-300 p-2">
                {#each availableCommissions as commission}
                  <label class="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCommissionIds.includes(commission.id)}
                      on:change={(e) => {
                        const target = e.target;
                        if (target && target instanceof HTMLInputElement) {
                          handleCommissionToggle(commission.id, target.checked);
                        }
                      }}
                      class="w-4 h-4"
                    />
                    <div class="flex-1">
                      <p class="text-sm font-medium">
                        ${Number(commission.commissionAmount).toFixed(2)}
                      </p>
                      <p class="text-xs text-gray-500">
                        {commission.order?.orderNumber || '-'} - {commission.promoCode?.code || '-'}
                      </p>
                    </div>
                  </label>
                {/each}
              </div>
            </div>
            <div class="flex gap-2 justify-end">
              <button
                on:click={() => {
                  showPayoutModal = false;
                  const totalAvailable = availableCommissions.reduce(
                    (sum, c) => sum + Number(c.commissionAmount),
                    0
                  );
                  payoutAmount = totalAvailable;
                  selectedCommissionIds = availableCommissions.map((c) => c.id);
                }}
                class="px-4 py-2 bg-gray-200 text-black hover:bg-gray-300 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                on:click={createPayoutRequest}
                disabled={selectedCommissionIds.length === 0 || payoutAmount <= 0}
                class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {t('partner.requestPayout') || 'Request payout'}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
