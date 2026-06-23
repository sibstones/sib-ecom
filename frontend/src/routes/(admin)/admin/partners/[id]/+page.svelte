<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { partnerApi, type PartnerStats } from '$lib/api/partner.api';
  import { promoApi } from '$lib/api/promo.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { goto } from '$app/navigation';

  let partner: any = null;
  let partnerStats: PartnerStats | null = null;
  let orders: any[] = [];
  let commissions: any[] = [];
  let payouts: any[] = [];
  let documents: any[] = [];
  let loading = true;
  let loadingTab = false;
  let error = '';
  let activeTab:
    | 'overview'
    | 'promocodes'
    | 'orders'
    | 'commissions'
    | 'payouts'
    | 'tickets'
    | 'documents' = 'overview';
  let ordersPage = 1;
  let commissionsPage = 1;
  let payoutsPage = 1;
  let selectedStatus = '';

  $: partnerId = $page.params.id;

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
    await loadPartner();
  });

  async function loadPartner() {
    loading = true;
    try {
      const [partnerResponse, statsResponse] = await Promise.all([
        partnerApi.getPartnerById(partnerId),
        partnerApi.getPartnerStats(partnerId).catch(() => null),
      ]);
      partner = partnerResponse.partner;
      partnerStats = statsResponse;
      if (!partner.isPartner) {
        error = t('partner.notAPartner') || 'This user is not a partner';
      }
    } catch (e) {
      error =
        e instanceof Error ? e.message : t('partner.failedToLoad') || 'Failed to load partner data';
    } finally {
      loading = false;
    }
  }

  async function loadOrders() {
    loadingTab = true;
    try {
      const response = await partnerApi.getPartnerOrders(partnerId, ordersPage, 20);
      orders = response.orders;
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToLoadOrders') || 'Failed to load orders'
      );
    } finally {
      loadingTab = false;
    }
  }

  async function loadCommissions() {
    loadingTab = true;
    try {
      const response = await partnerApi.getPartnerOrders(partnerId, commissionsPage, 20);
      // Get commissions from orders
      commissions = response.orders.flatMap(
        (order: any) =>
          order.partnerCommissions?.map((comm: any) => ({
            ...comm,
            order: {
              orderNumber: order.orderNumber,
              total: order.total,
              createdAt: order.createdAt,
              user: order.user,
            },
          })) || []
      );
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToLoadCommissions') || 'Failed to load commissions'
      );
    } finally {
      loadingTab = false;
    }
  }

  async function loadPayouts() {
    loadingTab = true;
    try {
      // Admin can see partner payouts through getAllPayouts filtered by partner
      const response = await partnerApi.getAllPayouts(payoutsPage, 20);
      payouts = response.payouts.filter((p: any) => p.partnerId === partnerId);
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToLoadPayouts') || 'Failed to load payouts'
      );
    } finally {
      loadingTab = false;
    }
  }

  async function loadDocuments() {
    loadingTab = true;
    try {
      const response = await partnerApi.getPartnerDocuments(partnerId);
      documents = response.documents || [];
    } catch (e) {
      console.error('Failed to load documents:', e);
      documents = [];
    } finally {
      loadingTab = false;
    }
  }

  function handleTabChange(newTab: typeof activeTab) {
    activeTab = newTab;
    if (newTab === 'orders') {
      loadOrders();
    } else if (newTab === 'commissions') {
      loadCommissions();
    } else if (newTab === 'payouts') {
      loadPayouts();
    } else if (newTab === 'documents') {
      loadDocuments();
    }
  }

  function handleStatusChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    if (target && target.value) {
      updatePartnerStatus(target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED');
    }
  }

  async function updatePartnerStatus(status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    try {
      await partnerApi.updatePartnerStatus(partnerId, status);
      notificationStore.success(t('partner.statusUpdated') || 'Status updated');
      await loadPartner();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('partner.failedToUpdate') || 'Failed to update status'
      );
    }
  }

  function createTicket() {
    // Redirect to tickets page with partner filter
    goto(`/admin/tickets?partnerId=${partnerId}`);
  }

  let showUploadModal = false;
  let uploadData = {
    name: '',
    type: 'CONTRACT' as 'CONTRACT' | 'AGREEMENT' | 'OTHER',
    description: '',
    expiresAt: '',
    file: null as File | null,
  };

  function handleUploadFileChange(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;

    const files = target.files;
    uploadData.file = files && files.length > 0 ? files[0] : null;
  }

  let showCreatePromoModal = false;
  let promoData = {
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED' | 'BALANCE',
    discountValue: 10,
    minPurchase: undefined as number | undefined,
    maxDiscount: undefined as number | undefined,
    usageLimit: undefined as number | undefined,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    partnerCommissionRate: 10 as number | undefined,
  };

  function uploadDocument() {
    showUploadModal = true;
  }

  async function handleUpload() {
    if (!uploadData.file || !uploadData.name) {
      notificationStore.error(
        t('partner.fileAndNameRequired') || 'File and name are required'
      );
      return;
    }

    try {
      await partnerApi.uploadDocument(partnerId, uploadData.file, {
        name: uploadData.name,
        type: uploadData.type,
        description: uploadData.description || undefined,
        expiresAt: uploadData.expiresAt || undefined,
      });
      notificationStore.success(t('partner.documentUploaded') || 'Document uploaded');
      showUploadModal = false;
      uploadData = {
        name: '',
        type: 'CONTRACT',
        description: '',
        expiresAt: '',
        file: null,
      };
      // Reload documents
      await loadDocuments();
    } catch (e) {
      notificationStore.error(
        e instanceof Error
          ? e.message
          : t('partner.failedToUpload') || 'Failed to upload document'
      );
    }
  }

  function openCreatePromoModal() {
    showCreatePromoModal = true;
    promoData = {
      code: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minPurchase: undefined,
      maxDiscount: undefined,
      usageLimit: undefined,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      partnerCommissionRate: 10,
    };
  }

  async function createPromoCode() {
    if (!promoData.code.trim()) {
      notificationStore.error(t('promo.codeRequired') || 'Code is required');
      return;
    }
    if (!promoData.partnerCommissionRate || promoData.partnerCommissionRate <= 0) {
      notificationStore.error(
        t('partner.commissionRateRequired') || 'Commission rate is required'
      );
      return;
    }

    try {
      await promoApi.create({
        ...promoData,
        isPartnerPromo: true,
        partnerId: partnerId,
        partnerCommissionRate: promoData.partnerCommissionRate,
      });
      notificationStore.success(t('promo.created') || 'Promo code created');
      showCreatePromoModal = false;
      await loadPartner(); // Reload partner data to get updated promo codes
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('promo.failedToCreate') || 'Failed to create promo code'
      );
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
  {:else if partner}
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-4 mb-4">
        <button
          on:click={() => goto('/admin/partners')}
          class="text-gray-600 hover:text-black transition-colors"
        >
          ← {t('common.back') || 'Back'}
        </button>
      </div>
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-3xl font-bold mb-2">
            {partner.firstName || ''}
            {partner.lastName || ''}
            {#if !partner.firstName && !partner.lastName}
              {partner.email}
            {/if}
          </h2>
          <p class="text-gray-600">{partner.email}</p>
          {#if partner.phone}
            <p class="text-gray-600">{partner.phone}</p>
          {/if}
        </div>
        <div class="flex gap-2">
          {#if partner.partnerStatus}
            <select
              value={partner.partnerStatus}
              on:change={handleStatusChange}
              class="px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="ACTIVE">{t('partner.statusActive') || 'Active'}</option>
              <option value="INACTIVE">{t('partner.statusInactive') || 'Inactive'}</option>
              <option value="SUSPENDED">{t('partner.statusSuspended') || 'Suspended'}</option>
            </select>
          {/if}
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
      <button
        type="button"
        on:click={() => handleTabChange('overview')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'overview'}
        class:shadow-sm={activeTab === 'overview'}
        class:text-accent={activeTab === 'overview'}
        class:text-gray-600={activeTab !== 'overview'}
        class:hover:bg-gray-50={activeTab !== 'overview'}
        class:hover:text-gray-900={activeTab !== 'overview'}
      >
        {t('partner.overview') || 'Overview'}
      </button>
      <button
        type="button"
        on:click={() => handleTabChange('promocodes')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'promocodes'}
        class:shadow-sm={activeTab === 'promocodes'}
        class:text-accent={activeTab === 'promocodes'}
        class:text-gray-600={activeTab !== 'promocodes'}
        class:hover:bg-gray-50={activeTab !== 'promocodes'}
        class:hover:text-gray-900={activeTab !== 'promocodes'}
      >
        {t('partner.promoCodes') || 'Promo codes'}
      </button>
      <button
        type="button"
        on:click={() => handleTabChange('orders')}
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
        on:click={() => handleTabChange('commissions')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'commissions'}
        class:shadow-sm={activeTab === 'commissions'}
        class:text-accent={activeTab === 'commissions'}
        class:text-gray-600={activeTab !== 'commissions'}
        class:hover:bg-gray-50={activeTab !== 'commissions'}
        class:hover:text-gray-900={activeTab !== 'commissions'}
      >
        {t('partner.commissions') || 'Commissions'}
      </button>
      <button
        type="button"
        on:click={() => handleTabChange('payouts')}
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
        on:click={() => handleTabChange('tickets')}
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
        on:click={() => handleTabChange('documents')}
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

    <!-- Tab Content -->
    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-sm font-medium text-gray-600 mb-2">
            {t('partner.totalOrders') || 'Total orders'}
          </h3>
          <p class="text-3xl font-bold text-black">{partnerStats?.stats.totalOrders || 0}</p>
          <p class="text-sm text-gray-500 mt-1">
            ${(partnerStats?.stats.totalOrdersValue || 0).toFixed(2)}
          </p>
        </div>
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-sm font-medium text-gray-600 mb-2">
            {t('partner.totalCommissions') || 'Total commissions'}
          </h3>
          <p class="text-3xl font-bold text-black">
            ${(partnerStats?.stats.totalCommissions || 0).toFixed(2)}
          </p>
        </div>
        <div class="bg-white border border-gray-300 p-6">
          <h3 class="text-sm font-medium text-gray-600 mb-2">
            {t('partner.availableForPayout') || 'Available for payout'}
          </h3>
          <p class="text-3xl font-bold text-black">
            ${(partnerStats?.stats.availableForPayout || 0).toFixed(2)}
          </p>
        </div>
      </div>
      <div class="bg-white border border-gray-300 p-6">
        <h3 class="text-lg font-semibold mb-4">
          {t('partner.partnerInfo') || 'Partner information'}
        </h3>
        <div class="space-y-2 text-sm">
          <p>
            <span class="font-medium">{t('partner.joined') || 'Joined'}:</span>
            {formatDate(partner.createdAt)}
          </p>
          <p>
            <span class="font-medium">{t('partner.status') || 'Status'}:</span>
            {partner.partnerStatus === 'ACTIVE'
              ? t('partner.statusActive') || 'Active'
              : partner.partnerStatus === 'INACTIVE'
                ? t('partner.statusInactive') || 'Inactive'
                : t('partner.statusSuspended') || 'Suspended'}
          </p>
        </div>
      </div>
    {:else if activeTab === 'promocodes'}
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold">{t('partner.promoCodes') || 'Promo codes'}</h3>
        <button
          on:click={openCreatePromoModal}
          class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
        >
          {t('promo.addPromoCode') || 'Create promo code'}
        </button>
      </div>
      {#if partner.partnerPromoCodes && partner.partnerPromoCodes.length > 0}
        <div class="bg-white border border-gray-300 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-300">
              <tr>
                <th class="px-6 py-3 text-left text-sm font-medium">{t('promo.code') || 'Code'}</th>
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('promo.discountType') || 'discount'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('promo.discountValue') || 'value'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('promo.usedCount') || 'used count'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('partner.commissionRate') || 'commission rate'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('promo.status') || 'status'}</th
                >
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each partner.partnerPromoCodes as promo}
                <tr>
                  <td class="px-6 py-4 font-mono">{promo.code}</td>
                  <td class="px-6 py-4">{promo.discountType}</td>
                  <td class="px-6 py-4">
                    {promo.discountType === 'PERCENTAGE'
                      ? promo.discountValue + '%'
                      : '$' + promo.discountValue}
                  </td>
                  <td class="px-6 py-4">
                    {promo.usedCount}
                    {promo.usageLimit ? '/ ' + promo.usageLimit : ''}
                  </td>
                  <td class="px-6 py-4">
                    {promo.partnerCommissionRate ? promo.partnerCommissionRate + '%' : '-'}
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class="px-2 py-1 text-xs rounded {promo.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'}"
                    >
                      {promo.isActive
                        ? t('promo.active') || 'Active'
                        : t('promo.inactive') || 'Inactive'}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-center py-12">
          <p class="text-gray-600">{t('partner.noPromoCodes') || 'Promo codes not found'}</p>
        </div>
      {/if}
    {:else if activeTab === 'orders'}
      {#if loadingTab}
        <LoadingBar />
      {:else if orders.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-600">{t('partner.noOrders') || 'Orders not found'}</p>
        </div>
      {:else}
        <div class="bg-white border border-gray-300 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-300">
              <tr>
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('order.orderNumber') || 'Order number'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium">{t('common.date') || 'Date'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('customer.customer') || 'Customer'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('promo.code') || 'Promo code'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('order.total') || 'Total'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('partner.commission') || 'Commission'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('common.actions') || 'Actions'}</th
                >
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each orders as order}
                <tr>
                  <td class="px-6 py-4 font-mono">{order.orderNumber}</td>
                  <td class="px-6 py-4">{formatDate(order.createdAt)}</td>
                  <td class="px-6 py-4">
                    {order.user?.firstName || ''}
                    {order.user?.lastName || ''}
                    <span class="text-gray-500 text-sm block">{order.user?.email}</span>
                  </td>
                  <td class="px-6 py-4">{order.promoCode?.code || '-'}</td>
                  <td class="px-6 py-4">${Number(order.total).toFixed(2)}</td>
                  <td class="px-6 py-4">
                    {#if order.partnerCommissions && order.partnerCommissions.length > 0}
                      ${Number(order.partnerCommissions[0].commissionAmount).toFixed(2)}
                      <span class="text-xs text-gray-500 block">
                        {order.partnerCommissions[0].status}
                      </span>
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="px-6 py-4">
                    <button
                      on:click={() => goto(`/admin/orders/${order.id}`)}
                      class="text-black hover:text-gray-600 transition-colors text-sm"
                    >
                      {t('common.viewDetails') || 'Details'}
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {:else if activeTab === 'commissions'}
      {#if loadingTab}
        <LoadingBar />
      {:else if commissions.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-600">{t('partner.noCommissions') || 'Commissions not found'}</p>
        </div>
      {:else}
        <div class="bg-white border border-gray-300 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-300">
              <tr>
                <th class="px-6 py-3 text-left text-sm font-medium">{t('common.date') || 'Date'}</th
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
                  >{t('partner.commissionRate') || 'Commission rate'}</th
                >
                <th class="px-6 py-3 text-left text-sm font-medium"
                  >{t('partner.commissionAmount') || 'Commission amount'}</th
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
                  <td class="px-6 py-4">{Number(commission.commissionRate).toFixed(2)}%</td>
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
      {/if}
    {:else if activeTab === 'payouts'}
      {#if loadingTab}
        <LoadingBar />
      {:else if payouts.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-600">{t('partner.noPayouts') || 'Payouts not found'}</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each payouts as payout}
            <div class="bg-white border border-gray-300 p-6">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-lg font-semibold">${Number(payout.amount).toFixed(2)}</h3>
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
                  {t('partner.rejectionReason') || 'Rejection reason'}: {payout.rejectionReason}
                </p>
              {/if}
              {#if payout.adminNotes}
                <p class="text-sm text-gray-600 mb-2">
                  {t('partner.adminNotes') || 'Admin notes'}: {payout.adminNotes}
                </p>
              {/if}
              {#if payout.commissions && payout.commissions.length > 0}
                <div class="mt-4">
                  <p class="text-sm font-medium mb-2">{t('partner.commissions') || 'Commissions'}:</p>
                  <ul class="text-sm text-gray-600 space-y-1">
                    {#each payout.commissions as comm}
                      <li>
                        • Order {comm.order?.orderNumber || '-'} - ${Number(
                          comm.commissionAmount
                        ).toFixed(2)}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else if activeTab === 'tickets'}
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold">{t('partner.tickets') || 'Tickets'}</h3>
        <button
          on:click={createTicket}
          class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
        >
          {t('partner.createTicket') || 'Create ticket'}
        </button>
      </div>
      <div class="text-center py-12">
        <p class="text-gray-600">
          {t('partner.ticketsComingSoon') || 'Partner tickets will be available soon'}
        </p>
      </div>
    {:else if activeTab === 'documents'}
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold">{t('partner.documents') || 'Documents'}</h3>
        <button
          on:click={uploadDocument}
          class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
        >
          {t('partner.uploadDocument') || 'Upload document'}
        </button>
      </div>
      {#if loadingTab}
        <LoadingBar />
      {:else if documents.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-600">{t('partner.noDocuments') || 'Documents not found'}</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each documents as document}
            <div class="bg-white border border-gray-300 p-6">
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-semibold text-lg">{document.name}</h4>
                  <p class="text-sm text-gray-600">{document.type}</p>
                  {#if document.description}
                    <p class="text-sm text-gray-600 mt-1">{document.description}</p>
                  {/if}
                  <p class="text-xs text-gray-500 mt-2">
                    {t('common.createdAt') || 'Created'}: {formatDate(document.createdAt)}
                  </p>
                  {#if document.expiresAt}
                    <p class="text-xs text-gray-500">
                      {t('common.expiresAt') || 'Expires'}: {formatDate(document.expiresAt)}
                    </p>
                  {/if}
                </div>
                <div class="flex gap-2">
                  <a
                    href={document.downloadUrl || document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
                  >
                    {t('common.view') || 'View'}
                  </a>
                  <button
                    on:click={async () => {
                      const confirmed = await dialogStore.confirm(
                        t('common.confirmDelete') || 'Delete document?',
                        t('common.confirm') || 'Confirm'
                      );
                      if (!confirmed) return;

                      try {
                        await partnerApi.deleteDocument(document.id);
                        notificationStore.success(t('common.deleted') || 'Document deleted');
                        // Reload documents
                        await loadDocuments();
                        // Force reload by changing activeTab
                        activeTab = 'documents';
                      } catch (e) {
                        notificationStore.error(
                          e instanceof Error
                            ? e.message
                            : t('common.failedToDelete') || 'Failed to delete'
                        );
                      }
                    }}
                    class="px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors text-sm"
                  >
                    {t('common.delete') || 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}

  <!-- Upload Document Modal -->
  {#if showUploadModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-semibold mb-4">
          {t('partner.uploadDocument') || 'Upload document'}
        </h3>
        <div class="space-y-4">
          <div>
            <label for="partnerDocumentName" class="block text-sm font-medium mb-2"
              >{t('partner.documentName') || 'Document name'} *</label
            >
            <input
              id="partnerDocumentName"
              type="text"
              bind:value={uploadData.name}
              class="w-full px-4 py-2 border border-gray-300 text-black"
              placeholder={t('partner.documentNamePlaceholder') || 'For example: Agency agreement'}
            />
          </div>
          <div>
            <label for="partnerDocumentType" class="block text-sm font-medium mb-2"
              >{t('partner.documentType') || 'Document type'} *</label
            >
            <select
              id="partnerDocumentType"
              bind:value={uploadData.type}
              class="w-full px-4 py-2 border border-gray-300 text-black"
            >
              <option value="CONTRACT">{t('partner.typeContract') || 'Contract'}</option>
              <option value="AGREEMENT">{t('partner.typeAgreement') || 'Agreement'}</option>
              <option value="OTHER">{t('partner.typeOther') || 'Other'}</option>
            </select>
          </div>
          <div>
            <label for="partnerFile" class="block text-sm font-medium mb-2"
              >{t('partner.file') || 'File'} *</label
            >
            <input
              id="partnerFile"
              type="file"
              on:change={handleUploadFileChange}
              class="w-full px-4 py-2 border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="partnerDescription" class="block text-sm font-medium mb-2"
              >{t('partner.description') || 'Description'}</label
            >
            <textarea
              id="partnerDescription"
              bind:value={uploadData.description}
              class="w-full px-4 py-2 border border-gray-300 text-black"
              rows="3"
            ></textarea>
          </div>
          <div>
            <label for="partnerExpiresAt" class="block text-sm font-medium mb-2"
              >{t('partner.expiresAt') || 'Expiration date'}</label
            >
            <input
              id="partnerExpiresAt"
              type="date"
              bind:value={uploadData.expiresAt}
              class="w-full px-4 py-2 border border-gray-300 text-black"
            />
          </div>
          <div class="flex gap-2 justify-end">
            <button
              on:click={() => {
                showUploadModal = false;
                uploadData = {
                  name: '',
                  type: 'CONTRACT',
                  description: '',
                  expiresAt: '',
                  file: null,
                };
              }}
              class="px-4 py-2 bg-gray-200 text-black hover:bg-gray-300 transition-colors"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              on:click={handleUpload}
              class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
            >
              {t('common.upload') || 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Create Promo Code Modal -->
  {#if showCreatePromoModal}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t('promo.addPromoCode') || 'Create promo code'}
    >
      <div class="bg-white p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" role="document">
        <h3 class="text-xl font-semibold mb-4">
          {t('promo.addPromoCode') || 'Create promo code for partner'}
        </h3>
        <div class="space-y-4">
          <div>
            <label for="promoCode" class="block text-sm font-medium mb-2"
              >{t('promo.code') || 'Code'} *</label
            >
            <input
              id="promoCode"
              type="text"
              bind:value={promoData.code}
              class="w-full px-4 py-2 border border-gray-300 text-black"
              placeholder="PARTNER2024"
            />
          </div>
          <div>
            <label for="promoDescription" class="block text-sm font-medium mb-2"
              >{t('promo.description') || 'Description'}</label
            >
            <textarea
              id="promoDescription"
              bind:value={promoData.description}
              class="w-full px-4 py-2 border border-gray-300 text-black"
              rows="2"
            ></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="promoDiscountType" class="block text-sm font-medium mb-2"
                >{t('promo.discountType') || 'Discount type'} *</label
              >
              <select
                id="promoDiscountType"
                bind:value={promoData.discountType}
                class="w-full px-4 py-2 border border-gray-300 text-black"
              >
                <option value="PERCENTAGE">{t('promo.percentage') || 'Percentage'}</option>
                <option value="FIXED">{t('promo.fixedAmount') || 'Fixed amount'}</option>
                <option value="BALANCE">{t('promo.balance') || 'Balance'}</option>
              </select>
            </div>
            <div>
              <label for="promoDiscountValue" class="block text-sm font-medium mb-2"
                >{t('promo.discountValue') || 'Value'} *</label
              >
              <input
                id="promoDiscountValue"
                type="number"
                bind:value={promoData.discountValue}
                min="0"
                step="0.01"
                class="w-full px-4 py-2 border border-gray-300 text-black"
              />
            </div>
          </div>
          <div>
            <label for="partnerCommissionRate" class="block text-sm font-medium mb-2"
              >{t('partner.commissionRate') || 'Partner commission rate'} *</label
            >
            <input
              id="partnerCommissionRate"  
              type="number"
              bind:value={promoData.partnerCommissionRate}
              min="0"
              max="100"
              step="0.01"
              class="w-full px-4 py-2 border border-gray-300 text-black"
              placeholder="10"
            />
            <p class="text-xs text-gray-500 mt-1">
              {t('partner.commissionRateHint') ||
                'Percentage of commission that the partner will receive from each order with this promo code'}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="promoMinPurchase" class="block text-sm font-medium mb-2"
                >{t('promo.minPurchase') || 'Minimum purchase'}</label
              >
              <input
                id="promoMinPurchase"
                type="number"
                bind:value={promoData.minPurchase}
                min="0"
                step="0.01"
                class="w-full px-4 py-2 border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="promoMaxDiscount" class="block text-sm font-medium mb-2"
                >{t('promo.maxDiscount') || 'Maximum discount'}</label
              >
              <input
                id="promoMaxDiscount"
                type="number"
                bind:value={promoData.maxDiscount}
                min="0"
                step="0.01"
                class="w-full px-4 py-2 border border-gray-300 text-black"
              />
            </div>
          </div>
          <div>
            <label for="promoUsageLimit" class="block text-sm font-medium mb-2"
              >{t('promo.usageLimit') || 'Usage limit'}</label
            >
            <input
              id="promoUsageLimit"
              type="number"
              bind:value={promoData.usageLimit}
              min="1"
              class="w-full px-4 py-2 border border-gray-300 text-black"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="promoValidFrom" class="block text-sm font-medium mb-2"
                >{t('promo.validFrom') || 'Valid from'} *</label
              >
              <input
                id="promoValidFrom"
                type="date"
                bind:value={promoData.validFrom}
                class="w-full px-4 py-2 border border-gray-300 text-black"
              />
            </div>
            <div>
              <label for="promoValidUntil" class="block text-sm font-medium mb-2"
                >{t('promo.validUntil') || 'Valid until'} *</label
              >
              <input
                id="promoValidUntil"
                type="date"
                bind:value={promoData.validUntil}
                class="w-full px-4 py-2 border border-gray-300 text-black"
              />
            </div>
          </div>
          <div>
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={promoData.isActive} class="w-4 h-4" />
              <span class="text-sm">{t('promo.active') || 'Active'}</span>
            </label>
          </div>
          <div class="flex gap-2 justify-end">
            <button
              on:click={() => (showCreatePromoModal = false)}
              class="px-4 py-2 bg-gray-200 text-black hover:bg-gray-300 transition-colors"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              on:click={createPromoCode}
              class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
            >
              {t('common.create') || 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
