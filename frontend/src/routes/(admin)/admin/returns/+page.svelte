<script lang="ts">
  import { onMount } from 'svelte';
  import {
    returnApi,
    type ReturnRequest,
    type ProcessReturnRequestDto,
    type ReturnStatus,
    type RefundMethod,
  } from '$lib/api/return.api';
  import { adminApi } from '$lib/api/admin.api';
  import { productApi } from '$lib/api/product.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { confirm } from '$lib/utils/dialog.utils';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import DateRangePicker from '$lib/components/admin/DateRangePicker.svelte';
  import { formatPrice } from '$lib/utils/price.utils';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let returnRequests: ReturnRequest[] = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let totalPages = 1;
  let selectedStatus: ReturnStatus | '' = '';
  let dateFrom = '';
  let dateTo = '';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let selectedReturnRequest: ReturnRequest | null = null;
  let showProcessModal = false;
  let processingReturn = false;

  let processData: ProcessReturnRequestDto = {
    status: 'APPROVED',
    refundMethod: undefined,
    refundAmount: undefined,
    pickupMethod: undefined,
    pickupAddress: '',
    pickupDate: undefined,
    pickupNotes: '',
    adminNotes: '',
    items: [],
  };

  let warehouses: Array<{ id: string; name: string }> = [];
  let productSearchQueries: Record<string, string> = {};
  let productSearchResults: Record<string, any[]> = {};
  let selectedReplacementProducts: Record<string, { productId: string; variantId?: string }> = {};

  // Check for orderId in URL params
  $: {
    const orderIdParam = $page.url.searchParams.get('orderId');
    if (orderIdParam && !loading && returnRequests.length > 0) {
      const foundRequest = returnRequests.find((r) => r.orderId === orderIdParam);
      if (foundRequest) {
        openProcessModal(foundRequest);
        // Remove orderId from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('orderId');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }

  onMount(async () => {
    await loadReturnRequests();
    await loadWarehouses();
  });

  async function loadReturnRequests() {
    loading = true;
    try {
      const response = await returnApi.getAllReturnRequests({
        status: selectedStatus || undefined,
        page: currentPage,
        limit: 20,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortOrder,
      });
      returnRequests = response?.returnRequests ?? [];
      totalPages = response?.pagination?.totalPages ?? 1;

      // Check for orderId in URL after loading
      const orderIdParam = $page.url.searchParams.get('orderId');
      if (orderIdParam) {
        const foundRequest = returnRequests.find((r) => r.orderId === orderIdParam);
        if (foundRequest) {
          openProcessModal(foundRequest);
          const url = new URL(window.location.href);
          url.searchParams.delete('orderId');
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t('admin.returns.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function loadWarehouses() {
    try {
      const response = await adminApi.getAllWarehouses();
      warehouses = response.warehouses.map((w: any) => ({ id: w.id, name: w.name }));
    } catch (e) {
      console.error('Failed to load warehouses:', e);
    }
  }

  function openProcessModal(returnRequest: ReturnRequest) {
    selectedReturnRequest = returnRequest;
    processData = {
      status: returnRequest.status === 'REQUESTED' ? 'APPROVED' : returnRequest.status,
      refundMethod: returnRequest.refundMethod,
      refundAmount: returnRequest.refundAmount,
      pickupMethod: returnRequest.pickupMethod,
      pickupAddress: returnRequest.pickupAddress || '',
      pickupDate: returnRequest.pickupDate
        ? new Date(returnRequest.pickupDate).toISOString()
        : undefined,
      pickupNotes: returnRequest.pickupNotes || '',
      adminNotes: returnRequest.adminNotes || '',
      items: returnRequest.items.map((item) => ({
        returnRequestItemId: item.id,
        itemStatus: item.itemStatus,
        warehouseId: item.warehouseId,
        replacementProductId: item.replacementProductId,
        replacementVariantId: item.replacementVariantId,
      })),
    };
    showProcessModal = true;
  }

  async function processReturnRequest() {
    if (!selectedReturnRequest) return;

    const statusLabel = processData.status.toLowerCase();
    const confirmed = await confirm(
      t('admin.returns.confirmActionMessage').replace('{status}', statusLabel),
      t('admin.returns.confirmAction'),
      t('admin.returns.yesProcess'),
      t('common.cancel')
    );

    if (!confirmed) return;

    processingReturn = true;
    try {
      await returnApi.processReturnRequest(selectedReturnRequest.id, processData);
      notificationStore.success(t('admin.returns.processedSuccess'));
      showProcessModal = false;
      await loadReturnRequests();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('admin.returns.failedToProcess'));
    } finally {
      processingReturn = false;
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusColor(status: ReturnStatus) {
    switch (status) {
      case 'REQUESTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800';
      case 'PROCESSING':
        return 'bg-purple-100 text-purple-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status: ReturnStatus): string {
    switch (status) {
      case 'REQUESTED':
        return t('orderDetail.returnStatusRequested');
      case 'APPROVED':
        return t('orderDetail.returnStatusApproved');
      case 'PROCESSING':
        return t('orderDetail.returnStatusProcessing');
      case 'COMPLETED':
        return t('orderDetail.returnStatusCompleted');
      case 'REJECTED':
        return t('orderDetail.returnStatusRejected');
      default:
        return status;
    }
  }

  function getReasonLabel(reason: string): string {
    switch (reason) {
      case 'PRODUCT_NOT_DELIVERED':
        return t('orderDetail.reasonProductNotDelivered');
      case 'CUSTOMER_NOT_RECEIVED':
        return t('orderDetail.reasonCustomerNotReceived');
      case 'CUSTOMER_REQUESTED':
        return t('orderDetail.reasonCustomerRequested');
      default:
        return reason.replace(/_/g, ' ');
    }
  }

  function updateItemStatus(itemId: string, status: 'WRITE_OFF' | 'RETURN_TO_SALE') {
    if (!processData.items) return;
    processData.items = processData.items.map((item) =>
      item.returnRequestItemId === itemId ? { ...item, itemStatus: status } : item
    );
  }

  function updateItemWarehouse(itemId: string, warehouseId: string) {
    if (!processData.items) return;
    processData.items = processData.items.map((item) =>
      item.returnRequestItemId === itemId ? { ...item, warehouseId } : item
    );
  }

  async function searchProductsForReplacement(itemId: string, query: string) {
    if (!query || query.length < 2) {
      productSearchResults[itemId] = [];
      return;
    }
    try {
      const response = await productApi.searchProducts(query, 10);
      // searchProducts returns an array of products directly or an object with products
      productSearchResults[itemId] = Array.isArray(response) ? response : response.products || [];
    } catch (e) {
      console.error('Failed to search products:', e);
      productSearchResults[itemId] = [];
    }
  }

  function selectReplacementProduct(itemId: string, productId: string, variantId?: string) {
    selectedReplacementProducts[itemId] = { productId, variantId };
    if (!processData.items) return;
    processData.items = processData.items.map((item) =>
      item.returnRequestItemId === itemId
        ? { ...item, replacementProductId: productId, replacementVariantId: variantId }
        : item
    );
    productSearchQueries[itemId] = '';
    productSearchResults[itemId] = [];
  }

  function clearReplacementProduct(itemId: string) {
    delete selectedReplacementProducts[itemId];
    if (!processData.items) return;
    processData.items = processData.items.map((item) =>
      item.returnRequestItemId === itemId
        ? { ...item, replacementProductId: undefined, replacementVariantId: undefined }
        : item
    );
  }

  function viewOrder(orderId: string) {
    goto(`/admin/orders/${orderId}`);
  }
</script>

<div class="min-h-screen bg-white">
  <div class="container-custom py-8">
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-3xl font-bold">{t('admin.returns.title')}</h2>
      <div class="text-sm text-gray-500">
        {returnRequests.length}
        {returnRequests.length === 1
          ? t('admin.returns.returnRequests').toLowerCase()
          : t('admin.returns.returnRequests').toLowerCase()}
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-6 flex flex-wrap gap-4 items-end">
      <CustomSelect
        bind:value={sortOrder}
        fitContent={true}
        options={[
          { value: 'desc', label: t('admin.sortNewestFirst') },
          { value: 'asc', label: t('admin.sortOldestFirst') },
        ]}
        on:change={() => {
          currentPage = 1;
          loadReturnRequests();
        }}
      />
      <CustomSelect
        bind:value={selectedStatus}
        fitContent={true}
        options={[
          { value: '', label: t('admin.returns.allStatuses') },
          { value: 'REQUESTED', label: t('orderDetail.returnStatusRequested') },
          { value: 'APPROVED', label: t('orderDetail.returnStatusApproved') },
          { value: 'PROCESSING', label: t('orderDetail.returnStatusProcessing') },
          { value: 'COMPLETED', label: t('orderDetail.returnStatusCompleted') },
          { value: 'REJECTED', label: t('orderDetail.returnStatusRejected') },
        ]}
        on:change={() => {
          currentPage = 1;
          loadReturnRequests();
        }}
      />
      <DateRangePicker
        bind:dateFrom
        bind:dateTo
        tight={true}
        on:change={() => {
          currentPage = 1;
          loadReturnRequests();
        }}
      />
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="w-full py-8"><LoadingBar /></div>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-600">{t('common.error')}: {error}</p>
      </div>
    {:else if returnRequests.length === 0}
      <div class="bg-gray-50 border border-gray-200 p-8 text-center">
        <p class="text-gray-500 text-lg">{t('admin.returns.noReturnRequests')}</p>
      </div>
    {:else}
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  {t('admin.returns.orderNumber')}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  {t('admin.returns.customer')}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  {t('admin.returns.reason')}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  {t('admin.returns.status')}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  {t('admin.returns.items')}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  {t('admin.returns.created')}
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  {t('admin.returns.actions')}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each returnRequests as returnRequest}
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <button
                      on:click={() => viewOrder(returnRequest.orderId)}
                      class="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {returnRequest.order.orderNumber}
                    </button>
                  </td>
                  <td class="px-6 py-4">
                    <div class="min-w-[180px]">
                      <p class="text-sm font-medium text-gray-900 truncate">
                        {returnRequest.order.user.email}
                      </p>
                      {#if returnRequest.order.user.firstName || returnRequest.order.user.lastName}
                        <p class="text-xs text-gray-500 mt-1">
                          {returnRequest.order.user.firstName}
                          {returnRequest.order.user.lastName}
                        </p>
                      {/if}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-gray-900">
                      {getReasonLabel(returnRequest.reason)}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(
                        returnRequest.status
                      )}"
                    >
                      {getStatusLabel(returnRequest.status)}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-gray-900">
                      {returnRequest.items.length}
                      {returnRequest.items.length === 1
                        ? t('common.item')
                        : t('common.itemsPlural')}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(returnRequest.createdAt)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <button
                      on:click={() => openProcessModal(returnRequest)}
                      class="px-4 py-2 bg-accent text-dark text-sm font-medium hover:bg-accent-muted transition-colors rounded-md"
                    >
                      {returnRequest.status === 'REQUESTED'
                        ? t('admin.returns.process')
                        : t('admin.returns.viewUpdate')}
                    </button>
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
              loadReturnRequests();
            }}
            disabled={currentPage === 1}
            class="px-4 py-2 bg-white border border-gray-300 disabled:opacity-50 rounded"
          >
            {t('order.previous')}
          </button>
          <span class="text-gray-500"
            >{t('order.pageOf')
              .replace('{page}', String(currentPage))
              .replace('{total}', String(totalPages))}</span
          >
          <button
            on:click={() => {
              currentPage++;
              loadReturnRequests();
            }}
            disabled={currentPage >= totalPages}
            class="px-4 py-2 bg-white border border-gray-300 disabled:opacity-50 rounded"
          >
            {t('order.next')}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Process Return Modal -->
{#if showProcessModal && selectedReturnRequest}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    on:click={(e) => {
      if (e.target === e.currentTarget && !processingReturn) {
        showProcessModal = false;
      }
    }}
    role="button"
    tabindex="0"
    on:keydown={(e) => {
      if (e.key === 'Escape' && !processingReturn) {
        showProcessModal = false;
      }
    }}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-white border border-gray-300 p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
      on:click|stopPropagation
    >
      <div class="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <h3 class="text-2xl font-bold">{t('admin.returns.processReturnRequest')}</h3>
        <button
          on:click={() => {
            if (!processingReturn) {
              showProcessModal = false;
            }
          }}
          class="text-gray-400 hover:text-gray-600 text-3xl leading-none"
          disabled={processingReturn}
        >
          ×
        </button>
      </div>

      <div class="space-y-6">
        <!-- Order Info -->
        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-700">{t('admin.returns.order')}:</p>
              <button
                on:click={() => selectedReturnRequest && viewOrder(selectedReturnRequest.orderId)}
                class="text-sm text-blue-600 hover:text-blue-800 hover:underline font-mono"
              >
                {selectedReturnRequest?.order?.orderNumber}
              </button>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700">{t('admin.returns.customer')}:</p>
              <p class="text-sm text-gray-900">{selectedReturnRequest.order.user.email}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700">{t('admin.returns.reason')}:</p>
              <p class="text-sm text-gray-900">{getReasonLabel(selectedReturnRequest.reason)}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700">{t('common.total')}:</p>
              <p class="text-sm text-gray-900 font-semibold">
                {formatPrice(selectedReturnRequest.order.total)}
              </p>
            </div>
          </div>
          {#if selectedReturnRequest.customerNotes}
            <div class="mt-4 pt-4 border-t border-gray-200">
              <p class="text-sm font-medium text-gray-700 mb-1">
                {t('admin.returns.customerNotes')}:
              </p>
              <p class="text-sm text-gray-900">{selectedReturnRequest.customerNotes}</p>
            </div>
          {/if}
        </div>

        <!-- Status -->
        <div>
          <label for="returnStatus" class="block text-sm font-medium text-gray-700 mb-2"
            >{t('common.status')}</label
          >
          <select
            id="returnStatus"
            bind:value={processData.status}
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
            disabled={processingReturn}
          >
            <option value="APPROVED">{t('orderDetail.returnStatusApproved')}</option>
            <option value="REJECTED">{t('orderDetail.returnStatusRejected')}</option>
            <option value="PROCESSING">{t('orderDetail.returnStatusProcessing')}</option>
            <option value="COMPLETED">{t('orderDetail.returnStatusCompleted')}</option>
          </select>
        </div>

        <!-- Pickup Info -->
        {#if processData.status === 'APPROVED' || processData.status === 'PROCESSING' || processData.status === 'COMPLETED'}
          <div class="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
            <h4 class="font-medium text-green-900">{t('admin.returns.pickupMethod')}</h4>
            <div>
              <label for="pickupMethod" class="block text-sm font-medium text-gray-700 mb-2"
                >{t('admin.returns.pickupMethod')}</label
              >
              <select
                id="pickupMethod"
                bind:value={processData.pickupMethod}
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
                disabled={processingReturn}
              >
                <option value="">{t('admin.returns.selectPickupMethod')}</option>
                <option value="COURIER">{t('admin.returns.pickupCourier')}</option>
                <option value="POST">{t('admin.returns.pickupPost')}</option>
                <option value="PICKUP">{t('admin.returns.pickupSelf')}</option>
              </select>
            </div>
            {#if processData.pickupMethod === 'COURIER' || processData.pickupMethod === 'POST'}
              <div>
                <label for="pickupAddress" class="block text-sm font-medium text-gray-700 mb-2"
                  >{t('admin.returns.pickupAddress')}</label
                >
                <textarea
                  id="pickupAddress"
                  bind:value={processData.pickupAddress}
                  rows="3"
                  class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
                  disabled={processingReturn}
                  placeholder={t('admin.returns.pickupAddressPlaceholder')}
                ></textarea>
              </div>
            {/if}
            <div>
              <label for="pickupDate" class="block text-sm font-medium text-gray-700 mb-2"
                >{t('admin.returns.pickupDate')}</label
              >
              <input
                id="pickupDate"
                type="datetime-local"
                bind:value={processData.pickupDate}
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
                disabled={processingReturn}
              />
            </div>
            <div>
              <label for="pickupNotes" class="block text-sm font-medium text-gray-700 mb-2"
                >{t('admin.returns.pickupNotes')}</label
              >
              <textarea
                id="pickupNotes"
                bind:value={processData.pickupNotes}
                rows="3"
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
                disabled={processingReturn}
                placeholder={t('admin.returns.pickupNotesPlaceholder')}
              ></textarea>
            </div>
          </div>
        {/if}

        <!-- Refund Info -->
        {#if processData.status === 'COMPLETED'}
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <h4 class="font-medium text-blue-900">{t('admin.returns.refundMethod')}</h4>
            <div>
              <label for="refundMethod" class="block text-sm font-medium text-gray-700 mb-2"
                >{t('admin.returns.refundMethod')}</label
              >
              <select
                id="refundMethod"
                bind:value={processData.refundMethod}
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
                disabled={processingReturn}
              >
                <option value="">{t('admin.returns.selectMethod')}</option>
                <option value="STRIPE">Stripe</option>
                <option value="BANK_TRANSFER">{t('orderDetail.bankTransferDescription')}</option>
                <option value="MANUAL">{t('common.manual')}</option>
              </select>
            </div>
            <div>
              <label for="refundAmount" class="block text-sm font-medium text-gray-700 mb-2"
                >{t('admin.returns.refundAmount')}</label
              >
              <input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0"
                max={selectedReturnRequest ? selectedReturnRequest.order.total : undefined}
                bind:value={processData.refundAmount}
                placeholder={selectedReturnRequest
                  ? selectedReturnRequest.order.total.toString()
                  : '0'}
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
                disabled={processingReturn}
              />
              <p class="text-xs text-gray-500 mt-1">
                {t('common.total')}: {formatPrice(selectedReturnRequest?.order.total || 0)}
              </p>
            </div>
          </div>
        {/if}

        <!-- Items -->
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-3">
            {t('admin.returns.returnItems')}
          </p>
          <div class="space-y-3">
            {#each selectedReturnRequest.items as item}
              {@const processItem = processData.items?.find(
                (pi) => pi.returnRequestItemId === item.id
              )}
              <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">{item.orderItem.product.name}</p>
                    {#if item.orderItem.size}
                      <p class="text-sm text-gray-600 mt-1">
                        {t('orderDetail.size')}
                        {item.orderItem.size}
                      </p>
                    {/if}
                    <p class="text-sm text-gray-600">
                      {t('orderDetail.quantity')}: {item.quantity}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium text-gray-900">
                      {formatPrice(Number(item.orderItem.price) * item.quantity)}
                    </p>
                  </div>
                </div>

                <div class="mt-3 pt-3 border-t border-gray-200 space-y-3">
                  <div class="flex items-center gap-4">
                    <label
                      for={`itemStatus-${item.id}`}
                      class="text-sm font-medium text-gray-700 whitespace-nowrap"
                      >{t('admin.returns.itemStatus')}:</label
                    >
                    <select
                      id={`itemStatus-${item.id}`}
                      value={processItem?.itemStatus || item.itemStatus}
                      on:change={(e) => {
                        const value = e.currentTarget.value;
                        if (value === 'WRITE_OFF' || value === 'RETURN_TO_SALE') {
                          updateItemStatus(item.id, value);
                        }
                      }}
                      class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-black text-sm focus:ring-2 focus:ring-accent focus:border-accent"
                      disabled={processingReturn}
                    >
                      <option value="WRITE_OFF">{t('orderDetail.writeOff')}</option>
                      <option value="RETURN_TO_SALE">{t('orderDetail.returnToSale')}</option>
                    </select>
                  </div>
                  {#if processItem?.itemStatus === 'RETURN_TO_SALE'}
                    <div class="flex items-center gap-4">
                      <label
                        for={`itemWarehouse-${item.id}`}
                        class="text-sm font-medium text-gray-700 whitespace-nowrap"
                        >{t('admin.returns.warehouse')}:</label
                      >
                      <select
                        id={`itemWarehouse-${item.id}`}
                        value={processItem?.warehouseId || ''}
                        on:change={(e) => updateItemWarehouse(item.id, e.currentTarget.value)}
                        class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-black text-sm focus:ring-2 focus:ring-accent focus:border-accent"
                        disabled={processingReturn}
                      >
                        <option value="">{t('admin.returns.selectWarehouse')}</option>
                        {#each warehouses as warehouse}
                          <option value={warehouse.id}>{warehouse.name}</option>
                        {/each}
                      </select>
                    </div>
                  {/if}

                  <!-- Replacement Product -->
                  <div class="mt-3 pt-3 border-t border-gray-200">
                    <p class="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.returns.replacementProduct')} ({t('common.optional')})
                    </p>
                    {#if selectedReplacementProducts[item.id]}
                      {@const replacement = selectedReplacementProducts[item.id]}
                      <div class="mb-2 p-2 bg-green-50 border border-green-200 rounded">
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-green-900"
                            >{t('admin.returns.replacementSelected')}</span
                          >
                          <button
                            type="button"
                            on:click={() => clearReplacementProduct(item.id)}
                            class="text-xs text-red-600 hover:text-red-800"
                            disabled={processingReturn}
                          >
                            {t('common.remove')}
                          </button>
                        </div>
                      </div>
                    {:else}
                      <div class="relative">
                        <input
                          type="text"
                          bind:value={productSearchQueries[item.id]}
                          on:input={(e) =>
                            searchProductsForReplacement(item.id, e.currentTarget.value)}
                          placeholder={t('admin.returns.searchReplacementProduct')}
                          class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black text-sm focus:ring-2 focus:ring-accent focus:border-accent"
                          disabled={processingReturn}
                        />
                        {#if productSearchResults[item.id] && productSearchResults[item.id].length > 0}
                          <div
                            class="absolute z-10 w-full mt-1 bg-white border border-gray-300 shadow-lg max-h-60 overflow-y-auto rounded-md"
                          >
                            {#each productSearchResults[item.id] as product}
                              <div class="border-b border-gray-200 last:border-b-0">
                                <button
                                  type="button"
                                  on:click={() => selectReplacementProduct(item.id, product.id)}
                                  class="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                                  disabled={processingReturn}
                                >
                                  <p class="font-medium text-sm">{product.name}</p>
                                  <p class="text-xs text-gray-600">SKU: {product.sku}</p>
                                </button>
                                {#if product.variants && product.variants.length > 0}
                                  <div class="pl-4 pb-2 space-y-1">
                                    {#each product.variants as variant}
                                      <button
                                        type="button"
                                        on:click={() =>
                                          selectReplacementProduct(item.id, product.id, variant.id)}
                                        class="w-full text-left px-2 py-1 text-xs hover:bg-gray-50"
                                        disabled={processingReturn}
                                      >
                                        {variant.name || variant.sku}
                                      </button>
                                    {/each}
                                  </div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Admin Notes -->
        <div>
          <label for="adminNotes" class="block text-sm font-medium text-gray-700 mb-2"
            >{t('admin.returns.adminNotes')}</label
          >
          <textarea
            id="adminNotes"
            bind:value={processData.adminNotes}
            rows="4"
            class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-accent focus:border-accent"
            disabled={processingReturn}
            placeholder={t('admin.returns.addNotesPlaceholder')}
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex gap-4 pt-4 border-t border-gray-200">
          <button
            on:click={processReturnRequest}
            disabled={processingReturn ||
              (processData.status === 'COMPLETED' &&
                (!processData.refundMethod || !processData.refundAmount))}
            class="flex-1 px-6 py-3 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if processingReturn}
              {t('admin.returns.processing')}
            {:else}
              {t('admin.returns.processReturnRequestButton')}
            {/if}
          </button>
          <button
            on:click={() => {
              if (!processingReturn) {
                showProcessModal = false;
              }
            }}
            class="px-6 py-3 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black rounded-md"
            disabled={processingReturn}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
