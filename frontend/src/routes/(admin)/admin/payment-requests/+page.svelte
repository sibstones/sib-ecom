<script lang="ts">
  import { onMount } from 'svelte';
  import { paymentRequestApi, type PaymentRequest } from '$lib/api/payment-request.api';
  import { deliveryTrackingApi, type CarrierOption } from '$lib/api/delivery-tracking.api';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import DateRangePicker from '$lib/components/admin/DateRangePicker.svelte';
  import { confirm, alert } from '$lib/utils/dialog.utils';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { formatPaymentStatus, formatOrderStatus } from '$lib/utils/i18n';
  import { formatPrice } from '$lib/utils/price.utils';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { i18nStore } from '$lib/stores/i18n.store';

  /** Accept params from SvelteKit root to avoid "unknown prop" warning (use $page.params when needed). */
  export let params: Record<string, string> = {};
  function consumeValue(..._values: unknown[]) {}
  consumeValue(params);

  let requests: PaymentRequest[] = [];
  let loading = true;
  let currentPage = 1;
  let totalPages = 1;
  let selectedStatus = '';
  let dateFrom = '';
  let dateTo = '';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let selectedRequest: PaymentRequest | null = null;
  let showDetailsModal = false;
  let showShippingModal = false;

  let shippingData = {
    trackingNumber: '',
    carrier: '',
    estimatedDelivery: '',
    notes: '',
  };

  let availableCarriers: CarrierOption[] = [];
  let checkingTracking = false;

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
    await loadRequests();
  });

  async function loadRequests() {
    loading = true;
    try {
      const response = await paymentRequestApi.getAll({
        status: selectedStatus || undefined,
        page: currentPage,
        limit: 20,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortOrder,
      });
      requests = [...response.requests];
      totalPages = response.pagination.totalPages;
    } catch (e) {
      notificationStore.error(t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function openDetails(request: PaymentRequest) {
    selectedRequest = request;
    showDetailsModal = true;
  }

  async function openShippingModal(request: PaymentRequest) {
    selectedRequest = request;

    // Load available carriers
    try {
      const lang = $i18nStore === 'ru' ? 'ru' : 'en';
      availableCarriers = await deliveryTrackingApi.getAvailableCarriers(lang);
    } catch (e) {
      console.error('Failed to load carriers:', e);
      availableCarriers = [];
    }

    shippingData = {
      trackingNumber: request.logisticsInfo?.trackingNumber || '',
      carrier:
        request.logisticsInfo?.carrier ||
        (availableCarriers.length > 0 ? availableCarriers[0].value : ''),
      estimatedDelivery: request.logisticsInfo?.estimatedDelivery || '',
      notes: request.logisticsInfo?.notes || '',
    };
    showShippingModal = true;
  }

  async function markAsPaid(id: string) {
    const confirmed = await confirm(
      t('paymentRequest.markAsPaidConfirm'),
      t('paymentRequest.confirmPayment'),
      t('paymentRequest.yesMarkPaid'),
      t('common.cancel')
    );
    if (!confirmed) return;
    try {
      await paymentRequestApi.markAsPaid(id);
      await loadRequests();
      notificationStore.success(t('paymentRequest.markedAsPaid'));
    } catch (e) {
      notificationStore.error(t('paymentRequest.failedToMarkAsPaid'));
    }
  }

  async function saveShipping() {
    if (!selectedRequest) return;

    checkingTracking = true;

    try {
      // If tracking number is specified and carrier is selected (not MANUAL), check via API
      if (
        shippingData.trackingNumber &&
        shippingData.carrier &&
        shippingData.carrier !== 'MANUAL'
      ) {
        try {
          const trackingResponse = await deliveryTrackingApi.checkTracking(
            shippingData.trackingNumber,
            shippingData.carrier
          );

          const trackingInfo = trackingResponse.trackingInfo;

          // Update delivery data based on information from API
          if (trackingInfo.estimatedDelivery && !shippingData.estimatedDelivery) {
            shippingData.estimatedDelivery = trackingInfo.estimatedDelivery;
          }

          // Add status information to notes if available
          if (trackingInfo.statusDescription) {
            const statusNote = `Status: ${trackingInfo.statusDescription}`;
            shippingData.notes = shippingData.notes
              ? `${shippingData.notes}\n${statusNote}`
              : statusNote;
          }

          notificationStore.success(t('order.trackingCheckedSuccessfully'));
        } catch (trackingError) {
          // If checking fails, continue saving manually
          console.warn('Failed to check tracking:', trackingError);
          notificationStore.warning(t('order.trackingCheckFailed'));
        }
      }

      // Save delivery information
      await paymentRequestApi.markAsShipped(selectedRequest.id, {
        ...shippingData,
        shippedDate: new Date().toISOString(),
      });

        // If automatic update is enabled, update order status
      if (
        shippingData.trackingNumber &&
        shippingData.carrier &&
        shippingData.carrier !== 'MANUAL' &&
        selectedRequest.orderId
      ) {
        try {
          await deliveryTrackingApi.updateOrderStatus(selectedRequest.orderId);
        } catch (updateError) {
          console.warn('Failed to update order status:', updateError);
        }
      }

      showShippingModal = false;
      await loadRequests();
      notificationStore.success(t('paymentRequest.shippingInfoSaved'));
    } catch (e) {
      notificationStore.error(t('paymentRequest.failedToSaveShippingInfo'));
    } finally {
      checkingTracking = false;
    }
  }

  async function updateRequest(id: string, updates: any) {
    try {
      await paymentRequestApi.update(id, updates);
      await loadRequests();
      if (showDetailsModal) {
        await loadRequestDetails(id);
      }
    } catch (e) {
      notificationStore.error(t('paymentRequest.failedToUpdate'));
    }
  }

  async function changeStatus(id: string, newStatus: 'PENDING' | 'PAID' | 'CANCELLED') {
    const confirmed = await confirm(
      t('paymentRequest.changeStatusConfirm').replace('{status}', newStatus),
      t('paymentRequest.confirmStatusChange'),
      t('paymentRequest.yesChange'),
      t('common.cancel')
    );
    if (!confirmed) return;
    try {
      await paymentRequestApi.update(id, { status: newStatus });

      // Reload to get the latest data including order.paymentStatus updates
      await loadRequests();

      if (showDetailsModal && selectedRequest?.id === id) {
        await loadRequestDetails(id);
      }
      notificationStore.success(t('paymentRequest.statusChanged').replace('{status}', newStatus));
    } catch (e) {
      notificationStore.error(t('paymentRequest.failedToChangeStatus'));
    }
  }

  function handleStatusChange(requestId: string, currentStatus: string) {
    return (e: any) => {
      const newStatus = e.detail.value as 'PENDING' | 'PAID' | 'CANCELLED';
      if (newStatus !== currentStatus) {
        changeStatus(requestId, newStatus);
      }
    };
  }

  async function loadRequestDetails(id: string) {
    try {
      const response = await paymentRequestApi.getById(id);
      selectedRequest = response.request;
    } catch (e) {
      console.error('Failed to load request details');
    }
  }

  $: filteredRequests = selectedStatus
    ? requests.filter((r) => r.status === selectedStatus)
    : requests;

  function getPaymentRequestStatusColor(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-400';
      case 'PAID':
        return 'text-green-400';
      case 'CONFIRMED':
        return 'text-blue-400';
      case 'CANCELLED':
        return 'text-red-400';
      default:
        return 'text-gray-300';
    }
  }

  function getOrderStatusColor(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-400';
      case 'CONFIRMED':
        return 'text-blue-400';
      case 'PROCESSING':
        return 'text-purple-400';
      case 'SHIPPED':
        return 'text-indigo-400';
      case 'DELIVERED':
        return 'text-green-400';
      case 'CANCELLED':
        return 'text-red-400';
      case 'RETURN_REQUESTED':
        return 'text-orange-400';
      case 'RETURNED':
        return 'text-gray-400';
      default:
        return 'text-gray-300';
    }
  }
</script>

<div>
  <h2 class="text-3xl font-bold mb-6">{t('menu.paymentRequests')}</h2>

  <div class="mb-4 flex flex-wrap gap-4 items-end">
    <CustomSelect
      bind:value={sortOrder}
      fitContent={true}
      options={[
        { value: 'desc', label: t('admin.sortNewestFirst') },
        { value: 'asc', label: t('admin.sortOldestFirst') },
      ]}
      on:change={() => {
        currentPage = 1;
        loadRequests();
      }}
    />
    <CustomSelect
      bind:value={selectedStatus}
      fitContent={true}
      options={[
        { value: '', label: t('paymentRequest.allStatuses') },
        { value: 'PENDING', label: t('paymentRequest.pending') },
        { value: 'PAID', label: t('paymentRequest.paid') },
        { value: 'CANCELLED', label: t('paymentRequest.cancelled') },
      ]}
      on:change={() => {
        currentPage = 1;
        loadRequests();
      }}
    />
    <DateRangePicker
      bind:dateFrom
      bind:dateTo
      tight={true}
      on:change={() => {
        currentPage = 1;
        loadRequests();
      }}
    />
  </div>

  <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
    <p class="font-medium mb-1">{t('paymentRequest.information')}</p>
    <p>{t('paymentRequest.infoText1')}</p>
    <p>
      {t('paymentRequest.infoText2')}
      <a href="/admin/orders" class="underline font-medium">{t('menu.orders')}</a>
      {t('paymentRequest.infoText3')}
    </p>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if requests.length === 0}
    <p class="text-accent-muted">{t('paymentRequest.noRequestsFound')}</p>
  {:else}
    <div class="bg-white rounded overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1000px]">
          <thead class="bg-white">
            <tr>
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('common.actions')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.orderNumber')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.customer')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('paymentRequest.amount')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.paymentMethod')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.paymentStatus')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.orderStatus')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('common.created')}</th
              >
            </tr>
          </thead>
          <tbody>
            {#each filteredRequests as request (request.id)}
              <tr class="border-t border-accent/10">
                <td class="px-3 py-3">
                  <div class="flex gap-1 items-center flex-wrap">
                    <button
                      on:click={() => openDetails(request)}
                      class="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
                    >
                      {t('common.view')}
                    </button>
                    {#if request.status === 'PENDING'}
                      <button
                        on:click={() => markAsPaid(request.id)}
                        class="px-2 py-1 bg-dark border border-green-500/20 rounded text-xs text-black hover:bg-dark-light transition-colors whitespace-nowrap"
                      >
                        {t('paymentRequest.paid')}
                      </button>
                    {/if}
                  </div>
                </td>
                <td class="px-3 py-3 whitespace-nowrap">
                  <a
                    href="/admin/orders?orderId={request.orderId}"
                    class="font-mono text-sm text-accent hover:text-accent-muted transition-colors"
                    on:click|preventDefault={(e) => {
                      goto(`/admin/orders?orderId=${request.orderId}`);
                    }}
                  >
                    {request.order?.orderNumber || t('common.n/a')}
                  </a>
                </td>
                <td class="px-3 py-3">
                  {#if request.order?.user}
                    <div class="min-w-[150px]">
                      <p class="font-medium text-sm truncate">
                        {request.order.user.firstName}
                        {request.order.user.lastName}
                      </p>
                      <p class="text-xs text-accent-muted truncate">{request.order.user.email}</p>
                    </div>
                  {:else}
                    <span class="text-accent-muted">{t('common.n/a')}</span>
                  {/if}
                </td>
                <td class="px-3 py-3 whitespace-nowrap">
                  {formatPrice(Number(request.order?.total || 0))}
                </td>
                <td class="px-3 py-3 whitespace-nowrap">
                  <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                    {request.order?.paymentMethod === 'BANK_TRANSFER'
                      ? t('order.bankTransfer')
                      : request.order?.paymentMethod === 'P2P'
                        ? t('order.p2pPayment')
                        : request.order?.paymentMethod === 'CASH_ON_DELIVERY'
                          ? t('order.cashOnDelivery')
                          : request.order?.paymentMethod === 'MANAGER_CHAT'
                            ? t('paymentGateway.managerChat')
                            : request.order?.paymentMethod === 'GATEWAY'
                              ? t('paymentRequest.gateway')
                              : t('common.n/a')}
                  </span>
                </td>
                <td class="px-3 py-3">
                  <CustomSelect
                    value={request.status}
                    options={[
                      { value: 'PENDING', label: t('paymentRequest.pending') },
                      { value: 'PAID', label: t('paymentRequest.paid') },
                      { value: 'CANCELLED', label: t('paymentRequest.cancelled') },
                    ]}
                    on:change={handleStatusChange(request.id, request.status)}
                    className="min-w-[100px]"
                  />
                </td>
                <td class="px-3 py-3 whitespace-nowrap">
                  {#if request.order?.status}
                    <span
                      class="text-xs px-2 py-1 rounded font-medium {getOrderStatusColor(
                        request.order.status
                      )} bg-opacity-20"
                    >
                      {formatOrderStatus(request.order.status)}
                    </span>
                  {:else}
                    <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                      {t('common.n/a')}
                    </span>
                  {/if}
                </td>
                <td class="px-3 py-3 text-sm text-accent-muted whitespace-nowrap">
                  {formatDate(request.createdAt)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 mt-6">
        <button
          on:click={() => {
            currentPage--;
            loadRequests();
          }}
          disabled={currentPage === 1}
          class="px-4 py-2 bg-dark-light border border-accent/20 disabled:opacity-50"
        >
          {t('order.previous')}
        </button>
        <span class="text-accent-muted"
          >{t('order.pageOf')
            .replace('{page}', String(currentPage))
            .replace('{total}', String(totalPages))}</span
        >
        <button
          on:click={() => {
            currentPage++;
            loadRequests();
          }}
          disabled={currentPage >= totalPages}
          class="px-4 py-2 bg-dark-light border border-accent/20 disabled:opacity-50"
        >
          {t('order.next')}
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Details Modal -->
{#if showDetailsModal && selectedRequest}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-dark-light rounded p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-2xl font-bold">{t('paymentRequest.details')}</h3>
        <button
          on:click={() => (showDetailsModal = false)}
          class="text-accent-muted hover:text-accent"
        >
          ×
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <h4 class="font-medium mb-2">{t('order.orderInformation')}</h4>
          <div class="bg-dark rounded p-4 space-y-2 text-sm">
            <p><strong>{t('order.orderNumber')}:</strong> {selectedRequest.order?.orderNumber}</p>
            <p>
              <strong>{t('order.total')}:</strong>
              {formatPrice(Number(selectedRequest.order?.total || 0))}
            </p>
            {#if selectedRequest.order?.user}
              <p>
                <strong>{t('order.customer')}:</strong>
                {selectedRequest.order.user.firstName}
                {selectedRequest.order.user.lastName}
              </p>
              <p><strong>{t('common.email')}:</strong> {selectedRequest.order.user.email}</p>
              {#if selectedRequest.order.user.phone}
                <p><strong>{t('common.phone')}:</strong> {selectedRequest.order.user.phone}</p>
              {/if}
            {/if}
          </div>
        </div>

        {#if selectedRequest.bankDetails}
          <div>
            <h4 class="font-medium mb-2">{t('paymentRequest.bankDetails')}</h4>
            <div class="bg-dark rounded p-4 space-y-2 text-sm">
              <p>
                <strong>{t('paymentRequest.bankName')}:</strong>
                {selectedRequest.bankDetails.bankName}
              </p>
              <p>
                <strong>{t('paymentRequest.accountName')}:</strong>
                {selectedRequest.bankDetails.accountName}
              </p>
              <p>
                <strong>{t('paymentRequest.accountNumber')}:</strong>
                {selectedRequest.bankDetails.accountNumber}
              </p>
              {#if selectedRequest.bankDetails.swiftCode}
                <p>
                  <strong>{t('paymentRequest.swiftCode')}:</strong>
                  {selectedRequest.bankDetails.swiftCode}
                </p>
              {/if}
              {#if selectedRequest.bankDetails.iban}
                <p>
                  <strong>{t('paymentRequest.iban')}:</strong>
                  {selectedRequest.bankDetails.iban}
                </p>
              {/if}
            </div>
          </div>
        {/if}

        {#if selectedRequest.p2pDetails}
          <div>
            <h4 class="font-medium mb-2">{t('paymentRequest.p2pDetails')}</h4>
            <div class="bg-dark rounded p-4 space-y-2 text-sm">
              {#if selectedRequest.p2pDetails.cardNumber}
                <p>
                  <strong>{t('paymentRequest.cardNumber')}:</strong>
                  {selectedRequest.p2pDetails.cardNumber}
                </p>
              {/if}
              {#if selectedRequest.p2pDetails.cryptoWallet}
                <p>
                  <strong>{t('paymentRequest.cryptoWallet')}:</strong>
                  {selectedRequest.p2pDetails.cryptoWallet}
                </p>
                {#if selectedRequest.p2pDetails.blockchain}
                  <p>
                    <strong>{t('paymentRequest.blockchain')}:</strong>
                    {selectedRequest.p2pDetails.blockchain}
                  </p>
                {/if}
              {/if}
              {#if selectedRequest.p2pDetails.sbpPhone}
                <p>
                  <strong>{t('paymentRequest.sbpPhone')}:</strong>
                  {selectedRequest.p2pDetails.sbpPhone}
                </p>
              {/if}
              {#if selectedRequest.p2pDetails.instruction}
                <div class="mt-2">
                  <p><strong>{t('paymentRequest.paymentInstruction')}:</strong></p>
                  <p class="whitespace-pre-wrap text-accent-muted">
                    {selectedRequest.p2pDetails.instruction}
                  </p>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if selectedRequest.logisticsInfo}
          <div>
            <h4 class="font-medium mb-2">{t('order.shippingTrackingInfo')}</h4>
            <div class="bg-dark rounded p-4 space-y-2 text-sm">
              {#if selectedRequest.logisticsInfo.trackingNumber}
                <p>
                  <strong>{t('order.trackingNumber')}:</strong>
                  {selectedRequest.logisticsInfo.trackingNumber}
                </p>
              {/if}
              {#if selectedRequest.logisticsInfo.carrier}
                <p>
                  <strong>{t('order.carrier')}:</strong>
                  {selectedRequest.logisticsInfo.carrier}
                </p>
              {/if}
              {#if selectedRequest.logisticsInfo.estimatedDelivery}
                <p>
                  <strong>{t('order.estimatedDelivery')}:</strong>
                  {selectedRequest.logisticsInfo.estimatedDelivery}
                </p>
              {/if}
            </div>
          </div>
        {/if}

        <div>
          <h4 class="font-medium mb-2">{t('common.status')}</h4>
          {#if selectedRequest}
            <div class="mb-4">
              <CustomSelect
                value={selectedRequest.status}
                options={[
                  { value: 'PENDING', label: t('paymentRequest.pending') },
                  { value: 'PAID', label: t('paymentRequest.paid') },
                  { value: 'CANCELLED', label: t('paymentRequest.cancelled') },
                ]}
                on:change={handleStatusChange(selectedRequest.id, selectedRequest.status)}
                className="mb-2"
              />
              <p class="text-sm {getPaymentRequestStatusColor(selectedRequest.status)}">
                {formatPaymentStatus(selectedRequest.status)}
              </p>
            </div>
          {/if}
        </div>

        <div>
          <h4 class="font-medium mb-2">{t('paymentRequest.adminNotes')}</h4>
          <!-- svelte-ignore element_invalid_self_closing_tag -->
          <textarea
            value={selectedRequest?.adminNotes || ''}
            on:input={(e) => {
              if (selectedRequest) {
                selectedRequest.adminNotes = e.currentTarget.value;
              }
            }}
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black"
            rows="4"
            placeholder={t('paymentRequest.addNotes')}
          />
          <button
            on:click={() => {
              if (selectedRequest) {
                updateRequest(selectedRequest.id, { adminNotes: selectedRequest.adminNotes });
              }
            }}
            class="mt-2 px-4 py-2 bg-accent text-dark rounded hover:bg-accent-muted transition-colors"
          >
            {t('paymentRequest.saveNotes')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Shipping Modal -->
{#if showShippingModal && selectedRequest}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-dark-light rounded p-6 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold">{t('paymentRequest.addShippingInfo')}</h3>
        <button
          on:click={() => (showShippingModal = false)}
          class="text-accent-muted hover:text-accent"
        >
          ×
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label for="shippingTrackingNumber" class="block text-sm font-medium mb-2"
            >{t('order.trackingNumber')}</label
          >
          <input
            id="shippingTrackingNumber"
            type="text"
            bind:value={shippingData.trackingNumber}
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black"
            placeholder={t('paymentRequest.trackingNumberPlaceholder')}
          />
        </div>
        <div>
          <label for="shippingCarrier" class="block text-sm font-medium mb-2"
            >{t('order.carrier')}</label
          >
          <select
            id="shippingCarrier"
            bind:value={shippingData.carrier}
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black"
          >
            {#each availableCarriers as carrier}
              <option value={carrier.value} disabled={!carrier.enabled}>
                {carrier.label}
              </option>
            {/each}
          </select>
          <p class="text-xs text-accent-muted mt-1">{t('order.carrierDescription')}</p>
        </div>
        <div>
          <label for="shippingEstimatedDelivery" class="block text-sm font-medium mb-2"
            >{t('order.estimatedDelivery')}</label
          >
          <input
            id="shippingEstimatedDelivery"
            type="date"
            bind:value={shippingData.estimatedDelivery}
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black"
          />
        </div>
        <div>
          <label for="shippingNotes" class="block text-sm font-medium mb-2"
            >{t('order.shippingNotes')}</label
          >
          <textarea
            id="shippingNotes"
            bind:value={shippingData.notes}
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black"
            rows="3"
            placeholder={t('paymentRequest.shippingNotesPlaceholder')}
          ></textarea>
        </div>
        <div class="flex gap-4">
          <button
            on:click={saveShipping}
            disabled={checkingTracking}
            class="flex-1 px-6 py-2 bg-accent text-dark rounded hover:bg-accent-muted transition-colors disabled:opacity-50"
          >
            {#if checkingTracking}
              {t('order.checkingTracking')}...
            {:else}
              {t('common.save')}
            {/if}
          </button>
          <button
            on:click={() => (showShippingModal = false)}
            class="px-6 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
