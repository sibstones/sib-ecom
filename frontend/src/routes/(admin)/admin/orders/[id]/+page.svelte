<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { adminApi } from '$lib/api/admin.api';
  import type { Order } from '$lib/api/customer.api';
  import { returnApi, type ReturnRequest, type ReturnStatus } from '$lib/api/return.api';
  import { ticketApi } from '$lib/api/ticket.api';
  import { formatPrice } from '$lib/utils/price.utils';
  import { formatSizeForDisplay } from '$lib/utils/size.utils';
  import { notificationStore } from '$lib/stores/notification.store';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { formatOrderStatus, formatPaymentStatus, formatTicketStatus } from '$lib/utils/i18n';
  import { i18nStore } from '$lib/stores/i18n.store';
  import OrderQRCode from '$lib/components/OrderQRCode.svelte';
  import OrderQRCodeInline from '$lib/components/OrderQRCodeInline.svelte';

  let loading = true;
  let error = '';
  let order: Order | null = null;
  let editingPriceItemId: string | null = null;
  let editingPriceValue: number = 0;
  let showQRCodeModal = false;
  let showQRCodeInline = false;
  let returnRequest: ReturnRequest | null = null;

  // Support ticket creation
  let showTicketModal = false;
  let ticketSubject = '';
  let ticketMessage = '';
  let creatingTicket = false;

  // Admin-only: delivery & invoice (reports)
  let deliveryForm = {
    invoiceNumber: '',
    invoiceDate: '',
    shippedAt: '',
    deliveryMethod: '',
    carrierName: '',
    waybillNumber: '',
    waybillDate: '',
    trackingNumber: '',
    customsDeclarationNumber: '',
  };
  let savingDeliveryInfo = false;

  // Multi-channel: source & fulfillment
  let warehouses: { id: string; name: string }[] = [];
  let availability: {
    items: Array<{
      orderItemId: string;
      productName: string;
      quantityNeeded: number;
      warehouses: Array<{ warehouseId: string; warehouseName: string; available: number }>;
    }>;
  } | null = null;
  let orderSourceForm = '';
  let fulfillmentWarehouseIdForm = '';
  let fulfillWarehouseId = '';
  let savingSourceWarehouse = false;
  let fulfilling = false;

  $: orderCurrency =
    order && 'currency' in order
      ? String((order as Record<string, unknown>).currency ?? 'USD')
      : 'USD';

  $: if (order) {
    orderSourceForm = (order as any).orderSource ?? 'STORE_ONLINE';
    fulfillmentWarehouseIdForm =
      (order as any).fulfillmentWarehouseId ?? (order as any).fulfillmentWarehouse?.id ?? '';
    deliveryForm = {
      invoiceNumber: (order as any).invoiceNumber || '',
      invoiceDate: (order as any).invoiceDate
        ? new Date((order as any).invoiceDate).toISOString().split('T')[0]
        : '',
      shippedAt: (order as any).shippedAt
        ? new Date((order as any).shippedAt).toISOString().split('T')[0]
        : '',
      deliveryMethod: (order as any).deliveryMethod || '',
      carrierName: (order as any).carrierName || '',
      waybillNumber: (order as any).waybillNumber || '',
      waybillDate: (order as any).waybillDate
        ? new Date((order as any).waybillDate).toISOString().split('T')[0]
        : '',
      trackingNumber: (order as any).trackingNumber || '',
      customsDeclarationNumber: (order as any).customsDeclarationNumber || '',
    };
  }

  async function saveDeliveryInfo() {
    if (!order) return;
    savingDeliveryInfo = true;
    try {
      const res = await adminApi.updateOrderDeliveryInfo(order.id, {
        invoiceNumber: deliveryForm.invoiceNumber || null,
        invoiceDate: deliveryForm.invoiceDate || null,
        shippedAt: deliveryForm.shippedAt || null,
        deliveryMethod: deliveryForm.deliveryMethod || null,
        carrierName: deliveryForm.carrierName || null,
        waybillNumber: deliveryForm.waybillNumber || null,
        waybillDate: deliveryForm.waybillDate || null,
        trackingNumber: deliveryForm.trackingNumber || null,
        customsDeclarationNumber: deliveryForm.customsDeclarationNumber || null,
      });
      order = res.order;
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('error.failedToSave'));
    } finally {
      savingDeliveryInfo = false;
    }
  }

  onMount(async () => {
    await loadOrder();
  });

  async function loadOrder() {
    loading = true;
    try {
      const orderId = $page.params.id;
      const [orderResponse, returnRequestsResponse, warehousesResponse] = await Promise.all([
        adminApi.getOrderById(orderId),
        returnApi.getAllReturnRequests({ orderId }).catch(() => ({ returnRequests: [] })),
        adminApi.getAllWarehouses().catch(() => ({ warehouses: [] })),
      ]);
      order = orderResponse.order;
      warehouses = warehousesResponse.warehouses || [];
      orderSourceForm = (order as any).orderSource ?? 'STORE_ONLINE';
      fulfillmentWarehouseIdForm =
        (order as any).fulfillmentWarehouseId ?? (order as any).fulfillmentWarehouse?.id ?? '';
      if (order) {
        try {
          const av = await adminApi.getOrderAvailability(order.id);
          availability = av;
        } catch {
          availability = null;
        }
      }
      if (
        returnRequestsResponse.returnRequests &&
        returnRequestsResponse.returnRequests.length > 0
      ) {
        returnRequest = returnRequestsResponse.returnRequests[0];
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t('order.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function saveSourceWarehouse() {
    if (!order) return;
    savingSourceWarehouse = true;
    try {
      const res = await adminApi.updateOrderSourceAndWarehouse(order.id, {
        orderSource: orderSourceForm || undefined,
        fulfillmentWarehouseId: fulfillmentWarehouseIdForm || null,
      });
      order = res.order;
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('error.failedToSave'));
    } finally {
      savingSourceWarehouse = false;
    }
  }

  async function fulfillFromWarehouse() {
    if (!order || !fulfillWarehouseId) return;
    fulfilling = true;
    try {
      await adminApi.fulfillFromWarehouse(order.id, fulfillWarehouseId);
      notificationStore.success(t('order.fulfillFromWarehouseSuccess'));
      await loadOrder();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('order.fulfillFromWarehouseFailed')
      );
    } finally {
      fulfilling = false;
    }
  }

  function getOrderSourceLabel(source: string): string {
    switch (source) {
      case 'STORE_ONLINE':
        return t('order.source.storeOnline');
      case 'STORE_OFFLINE':
        return t('order.source.storeOffline');
      case 'MARKETPLACE_WB':
      case 'MARKETPLACE_WILDBERRIES':
        return t('order.source.marketplaceWildberries');
      case 'MARKETPLACE_OZON':
        return t('order.source.marketplaceOzon');
      case 'MARKETPLACE_OTHER':
        return t('order.source.marketplaceOther');
      case 'MANUAL':
        return t('order.source.manual');
      default:
        return source;
    }
  }

  function startEditingPrice(itemId: string, currentPrice: number | null) {
    editingPriceItemId = itemId;
    editingPriceValue = currentPrice || 0;
  }

  function cancelEditingPrice() {
    editingPriceItemId = null;
    editingPriceValue = 0;
  }

  async function savePrice(itemId: string) {
    if (!order || editingPriceValue <= 0) {
      notificationStore.error(t('order.enterValidPrice'));
      return;
    }

    try {
      const response = await adminApi.updateOrderItemPrice(order.id, itemId, editingPriceValue);
      order = response.order;
      editingPriceItemId = null;
      editingPriceValue = 0;
      notificationStore.success(t('order.priceUpdated'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('order.failedToUpdatePrice'));
    }
  }

  function formatDate(dateString: string) {
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

  function toNumber(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return typeof value === 'number' ? value : parseFloat(value.toString());
  }

  function handleImageError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) fallback.classList.remove('hidden');
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

  function getPaymentStatusColor(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-400';
      case 'PAID':
        return 'text-green-400';
      case 'CONFIRMED':
        return 'text-blue-400';
      case 'FAILED':
        return 'text-red-400';
      case 'REFUNDED':
        return 'text-gray-400';
      case 'CANCELLED':
        return 'text-red-400';
      default:
        return 'text-gray-300';
    }
  }

  function openTicketModal() {
    if (!order) return;
    ticketSubject = t('ticket.orderSupportSubject', { orderNumber: order.orderNumber });
    ticketMessage = '';
    showTicketModal = true;
  }

  function closeTicketModal() {
    showTicketModal = false;
    ticketSubject = '';
    ticketMessage = '';
  }

  async function createTicket() {
    if (!order || !ticketSubject.trim() || !ticketMessage.trim()) {
      notificationStore.error(t('ticket.fillAllFields'));
      return;
    }

    creatingTicket = true;
    try {
      await ticketApi.createTicketForCustomer({
        orderId: order.id,
        userId: order.userId,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
      });
      notificationStore.success(t('ticket.createdSuccessfully'));
      closeTicketModal();
      await loadOrder(); // Reload order to show the new ticket
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('ticket.failedToCreate'));
    } finally {
      creatingTicket = false;
    }
  }
</script>

<div>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
    <h2 class="text-2xl sm:text-3xl font-bold">{t('order.orderDetails')}</h2>
    <div class="flex gap-2 w-full sm:w-auto">
      {#if order}
        <button
          on:click={() => (showQRCodeInline = !showQRCodeInline)}
          class="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors w-full sm:w-auto text-center flex items-center justify-center gap-2"
          title={t('order.downloadQRCode')}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {t('order.downloadQRCode')}
        </button>
        <button
          on:click={openTicketModal}
          class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors w-full sm:w-auto text-center"
          title={t('order.viewOrCreateTicket')}
        >
          {order.tickets && order.tickets.length > 0
            ? t('order.viewTickets', { count: order.tickets.length })
            : t('order.contactCustomer')}
        </button>
        {#if order && (returnRequest || order.status === 'RETURN_REQUESTED' || order.status === 'RETURNED')}
          <button
            on:click={() => {
              if (returnRequest && order) {
                goto(`/admin/returns?orderId=${order.id}`);
              } else {
                goto('/admin/returns');
              }
            }}
            class="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors w-full sm:w-auto text-center"
            title={t('order.processReturnRequest')}
          >
            {#if returnRequest}
              {returnRequest.status === 'REQUESTED'
                ? t('order.processReturn')
                : t('order.viewReturn')}
            {:else}
              {t('order.viewReturns')}
            {/if}
          </button>
        {/if}
      {/if}
      <a
        href="/admin/orders?orderId={order?.id ?? ''}"
        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black w-full sm:w-auto text-center"
      >
        {t('order.backToOrders')}
      </a>
    </div>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('common.error')}: {error}</p>
  {:else if order}
    <div class="space-y-6">
      <!-- Order Info -->
      <div class="bg-dark-light p-6 border border-white/10">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-medium">{t('order.orderInformation')}</h3>
          {#if showQRCodeInline && order}
            <div class="ml-4">
              <OrderQRCodeInline orderNumber={order.orderNumber} orderId={order.id} />
            </div>
          {/if}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-accent-muted">{t('order.orderNumber')}</p>
            <p class="text-lg font-semibold">{order.orderNumber}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('order.status')}</p>
            <p class="text-lg font-semibold {getOrderStatusColor(order.status)}">
              {formatOrderStatus(order.status)}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('order.paymentStatus')}</p>
            <p class="text-lg font-semibold {getPaymentStatusColor(order.paymentStatus)}">
              {formatPaymentStatus(order.paymentStatus)}
            </p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('order.createdAt')}</p>
            <p class="text-lg font-semibold">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('order.customer')}</p>
            <p class="text-lg font-semibold">{order.user?.email || t('common.n/a')}</p>
          </div>
          <div>
            <p class="text-sm text-accent-muted">{t('order.total')}</p>
            <p class="text-lg font-semibold">{formatPrice(toNumber(order.total))}</p>
          </div>
        </div>
      </div>

      <!-- Multi-channel: source & fulfillment warehouse -->
      <details class="bg-dark-light p-6 border border-white/10" open>
        <summary class="cursor-pointer text-lg font-medium text-accent-muted hover:text-accent">
          {t('order.sourceWarehouseSectionTitle')}
        </summary>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="orderSource" class="block text-sm font-medium mb-1"
              >{t('order.sourceWarehouse')}</label
            >
            <select
              id="orderSource"
              bind:value={orderSourceForm}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              {#each ['STORE_ONLINE', 'STORE_OFFLINE', 'MARKETPLACE_WB', 'MARKETPLACE_OZON', 'MARKETPLACE_WILDBERRIES', 'MARKETPLACE_OTHER', 'MANUAL'] as value}
                <option {value}>{getOrderSourceLabel(value)}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="orderFulfillmentWarehouse" class="block text-sm font-medium mb-1"
              >{t('order.fulfillmentWarehouse')}</label
            >
            <select
              id="orderFulfillmentWarehouse"
              bind:value={fulfillmentWarehouseIdForm}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="">{t('order.notSelected')}</option>
              {#each warehouses as w}
                <option value={w.id}>{w.name}</option>
              {/each}
            </select>
          </div>
        </div>
        <button
          on:click={saveSourceWarehouse}
          disabled={savingSourceWarehouse}
          class="mt-4 px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50"
        >
          {savingSourceWarehouse ? t('common.saving') : t('common.save')}
        </button>

        {#if availability && availability.items.length > 0}
          <div class="mt-6 pt-4 border-t border-white/10">
            <h4 class="font-medium mb-2">{t('order.warehouseAvailability')}</h4>
            <div class="space-y-3">
              {#each availability.items as item}
                <div class="text-sm">
                  <span class="font-medium">{item.productName}</span>
                  {t('order.warehouseNeedQuantity', { count: item.quantityNeeded })}
                  {#if item.warehouses.length > 0}
                    <div class="mt-1 flex flex-wrap gap-2">
                      {#each item.warehouses as wh}
                        <span class="px-2 py-1 bg-white/10 rounded">
                          {wh.warehouseName}: {t('order.warehouseAvailableCount', {
                            count: wh.available,
                          })}
                        </span>
                      {/each}
                    </div>
                  {:else}
                    <span class="text-red-400 ml-2">{t('order.outOfStock')}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="orderFulfillFromWarehouse" class="block text-sm font-medium mb-1"
              >{t('order.fulfillFromWarehouse')}</label
            >
            <select
              id="orderFulfillFromWarehouse"
              bind:value={fulfillWarehouseId}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="">{t('order.selectWarehouse')}</option>
              {#each warehouses as w}
                <option value={w.id}>{w.name}</option>
              {/each}
            </select>
          </div>
          <div class="flex items-end">
            <button
              on:click={fulfillFromWarehouse}
              disabled={!fulfillWarehouseId || fulfilling}
              class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fulfilling
                ? t('order.fulfillFromWarehouseInProgress')
                : t('order.fulfillFromWarehouseAction')}
            </button>
          </div>
        </div>
      </details>

      <!-- Admin-only: delivery & documents for reports -->
      <details class="bg-dark-light p-6 border border-white/10">
        <summary class="cursor-pointer text-lg font-medium text-accent-muted hover:text-accent">
          {t('orderShipment.title')}
        </summary>
        <p class="mt-2 text-sm text-accent-muted">{t('orderShipment.fillOnShipmentNote')}</p>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="invoiceNumber" class="block text-sm font-medium mb-1"
              >{t('orderShipment.invoiceNumber')}</label
            >
            <input
              id="invoiceNumber"
              type="text"
              bind:value={deliveryForm.invoiceNumber}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="invoiceDate" class="block text-sm font-medium mb-1"
              >{t('orderShipment.invoiceDate')}</label
            >
            <input
              id="invoiceDate"
              type="date"
              bind:value={deliveryForm.invoiceDate}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              title={t('orderShipment.datePlaceholder')}
            />
          </div>
          <div>
            <label for="shipmentDate" class="block text-sm font-medium mb-1"
              >{t('orderShipment.shipmentDate')}</label
            >
            <input
              id="shipmentDate"
              type="date"
              bind:value={deliveryForm.shippedAt}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              title={t('orderShipment.datePlaceholder')}
            />
          </div>
          <div>
            <label for="deliveryMethod" class="block text-sm font-medium mb-1"
              >{t('orderShipment.deliveryMethod')}</label
            >
            <input
              id="deliveryMethod"
              type="text"
              bind:value={deliveryForm.deliveryMethod}
              placeholder={t('orderShipment.deliveryMethodPlaceholder')}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="carrierName" class="block text-sm font-medium mb-1"
              >{t('orderShipment.carrier')}</label
            >
            <input
              id="carrierName"
              type="text"
              bind:value={deliveryForm.carrierName}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="waybillNumber" class="block text-sm font-medium mb-1"
              >{t('orderShipment.waybillNumber')}</label
            >
            <input
              id="waybillNumber"
              type="text"
              bind:value={deliveryForm.waybillNumber}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="waybillDate" class="block text-sm font-medium mb-1"
              >{t('orderShipment.waybillDate')}</label
            >
            <input
              id="waybillDate"
              type="date"
              bind:value={deliveryForm.waybillDate}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              title={t('orderShipment.datePlaceholder')}
            />
          </div>
          <div>
            <label for="trackingNumber" class="block text-sm font-medium mb-1"
              >{t('orderShipment.trackingNumber')}</label
            >
            <input
              id="trackingNumber"
              type="text"
              bind:value={deliveryForm.trackingNumber}
              placeholder={t('orderShipment.trackingLinkPlaceholder')}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="customsDeclarationNumber" class="block text-sm font-medium mb-1"
              >{t('orderShipment.customsDeclarationNumber')}</label
            >
            <input
              id="customsDeclarationNumber"
              type="text"
              bind:value={deliveryForm.customsDeclarationNumber}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          {#if order?.shipping != null}
            <div class="sm:col-span-2">
              <span class="text-sm text-accent-muted"
                >{t('orderShipment.deliveryCostFromOrder')}</span
              >
              <span class="ml-2 font-medium"
                >{orderCurrency} {Number(order.shipping).toFixed(2)}</span
              >
            </div>
          {/if}
        </div>
        <button
          on:click={saveDeliveryInfo}
          disabled={savingDeliveryInfo}
          class="mt-4 px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50"
        >
          {savingDeliveryInfo ? t('common.saving') : t('common.save')}
        </button>
      </details>

      <!-- Order Items -->
      <div class="bg-dark-light p-6 border border-white/10">
        <h3 class="text-xl font-medium mb-4">{t('order.orderItems')}</h3>
        <div class="space-y-4">
          {#each order.items || [] as item}
            <div class="flex gap-4 pb-4 border-b border-white/10 last:border-0">
              <div
                class="w-28 aspect-[9/16] bg-dark -sm overflow-hidden flex-shrink-0 border border-white/10 relative group"
              >
                {#if item.product.images && item.product.images.length > 0}
                  <img
                    src={item.product.images[0].url}
                    alt={item.product.name}
                    class="w-full h-full object-cover"
                    on:error={handleImageError}
                  />
                  <div class="hidden w-full h-full flex items-center justify-center">
                    <p class="text-xs text-accent-muted">{t('order.noImage')}</p>
                  </div>
                  {#if !item.product.isActive}
                    <div
                      class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span class="text-white font-semibold text-sm">{t('order.soldOut')}</span>
                    </div>
                  {/if}
                {:else}
                  <div class="w-full h-full flex items-center justify-center">
                    <p class="text-xs text-accent-muted">{t('order.noImage')}</p>
                  </div>
                {/if}
              </div>
              <div class="flex-1">
                <h4 class="text-lg font-medium mb-1">{item.product.name}</h4>
                {#if item.variant}
                  <p class="text-sm text-accent-muted mb-2">{item.variant.name}</p>
                {/if}
                {#if item.size}
                  <p class="text-sm text-accent-muted mb-2">
                    <span class="font-semibold">{t('order.size')}:</span>
                    {formatSizeForDisplay(item.size)}
                  </p>
                {/if}
                <p class="text-sm text-accent-muted">{t('order.quantity')}: {item.quantity}</p>
              </div>
              <div class="text-right">
                {#if editingPriceItemId === item.id}
                  <div class="flex flex-col gap-2">
                    <input
                      type="number"
                      bind:value={editingPriceValue}
                      min="0"
                      step="0.01"
                      class="w-32 px-3 py-2 bg-white border border-gray-300 text-black"
                      placeholder="0.00"
                    />
                    <div class="flex gap-2">
                      <button
                        on:click={() => savePrice(item.id)}
                        class="px-3 py-1 bg-accent text-dark text-sm hover:bg-accent-muted transition-colors"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        on:click={cancelEditingPrice}
                        class="px-3 py-1 bg-white border border-gray-300 text-black text-sm hover:bg-gray-100 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                {:else if !item.price || item.price === null}
                  <div class="flex flex-col gap-2">
                    <p class="text-lg font-medium text-yellow-400">{t('order.priceOnRequest')}</p>
                    <button
                      on:click={() => startEditingPrice(item.id, null)}
                      class="px-3 py-1 bg-accent text-dark text-sm hover:bg-accent-muted transition-colors"
                    >
                      {t('order.setPrice')}
                    </button>
                  </div>
                {:else}
                  <div class="flex flex-col gap-2">
                    <p class="text-lg font-medium">
                      {formatPrice(toNumber(item.price) * item.quantity)}
                    </p>
                    <p class="text-sm text-accent-muted">
                      {formatPrice(toNumber(item.price))}
                      {t('order.each')}
                    </p>
                    <button
                      on:click={() => startEditingPrice(item.id, toNumber(item.price))}
                      class="px-3 py-1 bg-white border border-gray-300 text-black text-sm hover:bg-gray-100 transition-colors"
                    >
                      {t('order.editPrice')}
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Order Totals -->
      <div class="bg-dark-light p-6 border border-white/10">
        <h3 class="text-xl font-medium mb-4">{t('order.orderTotals')}</h3>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-accent-muted">{t('order.subtotal')}</span>
            <span class="font-semibold">{formatPrice(toNumber(order.subtotal))}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-accent-muted">{t('order.tax')}</span>
            <span class="font-semibold">{formatPrice(toNumber(order.tax))}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-accent-muted">{t('order.shipping')}</span>
            <span class="font-semibold">
              {toNumber(order.shipping) === 0
                ? t('order.free')
                : formatPrice(toNumber(order.shipping))}
            </span>
          </div>
          <div class="flex justify-between text-xl font-bold border-t border-white/10 pt-2">
            <span>{t('order.total')}</span>
            <span>{formatPrice(toNumber(order.total))}</span>
          </div>
        </div>
      </div>

      <!-- Shipping Address -->
      {#if order.shippingAddress}
        <div class="bg-dark-light p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('order.shippingAddress')}</h3>
          <div class="space-y-1">
            <p class="font-medium">
              {order.shippingAddress.firstName}
              {order.shippingAddress.lastName}
            </p>
            <p class="text-accent-muted">{order.shippingAddress.address}</p>
            <p class="text-accent-muted">
              {order.shippingAddress.city}, {order.shippingAddress.country}
              {order.shippingAddress.postalCode || ''}
            </p>
            {#if order.shippingAddress.phone}
              <p class="text-accent-muted">{t('common.phone')}: {order.shippingAddress.phone}</p>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Shipping & Tracking Information -->
      {#if order.paymentRequest?.logisticsInfo}
        <div class="bg-dark-light p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('order.shippingTrackingInfo')}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#if order.paymentRequest.logisticsInfo.trackingNumber}
              <div>
                <p class="text-sm text-accent-muted">{t('order.trackingNumber')}</p>
                <p class="text-lg font-semibold font-mono">
                  {order.paymentRequest.logisticsInfo.trackingNumber}
                </p>
              </div>
            {/if}
            {#if order.paymentRequest.logisticsInfo.carrier}
              <div>
                <p class="text-sm text-accent-muted">{t('order.carrier')}</p>
                <p class="text-lg font-semibold">{order.paymentRequest.logisticsInfo.carrier}</p>
              </div>
            {/if}
            {#if order.paymentRequest.logisticsInfo.estimatedDelivery}
              <div>
                <p class="text-sm text-accent-muted">{t('order.estimatedDelivery')}</p>
                <p class="text-lg font-semibold">
                  {order.paymentRequest.logisticsInfo.estimatedDelivery}
                </p>
              </div>
            {/if}
            {#if order.paymentRequest.shippedAt}
              <div>
                <p class="text-sm text-accent-muted">{t('order.shippedAt')}</p>
                <p class="text-lg font-semibold">{formatDate(order.paymentRequest.shippedAt)}</p>
              </div>
            {/if}
            {#if order.paymentRequest.logisticsInfo.shippedDate}
              <div>
                <p class="text-sm text-accent-muted">{t('order.shippedDate')}</p>
                <p class="text-lg font-semibold">
                  {order.paymentRequest.logisticsInfo.shippedDate}
                </p>
              </div>
            {/if}
            {#if order.paymentRequest.logisticsInfo.notes}
              <div class="md:col-span-2">
                <p class="text-sm text-accent-muted">{t('order.shippingNotes')}</p>
                <p class="text-lg font-semibold whitespace-pre-wrap">
                  {order.paymentRequest.logisticsInfo.notes}
                </p>
              </div>
            {/if}
          </div>
        </div>
      {:else if order.paymentRequest}
        <div class="bg-dark-light p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('order.shippingTrackingInfo')}</h3>
          <p class="text-accent-muted">{t('order.noShippingInfo')}</p>
        </div>
      {/if}

      <!-- Return Request -->
      {#if returnRequest && order}
        <div class="bg-dark-light p-6 border border-white/10">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-medium">{t('admin.returns.returnRequest')}</h3>
            <button
              on:click={() => goto(`/admin/returns?orderId=${$page.params.id}`)}
              class="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors text-sm"
            >
              {returnRequest.status === 'REQUESTED'
                ? t('order.processReturn')
                : t('order.viewReturn')}
            </button>
          </div>
          <div class="space-y-2">
            <div class="flex gap-4">
              <div>
                <p class="text-sm text-accent-muted">{t('admin.returns.status')}</p>
                <p class="text-lg font-semibold">
                  <span
                    class="px-2 py-1 rounded text-sm
                    {returnRequest.status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-800' : ''}
                    {returnRequest.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' : ''}
                    {returnRequest.status === 'PROCESSING' ? 'bg-purple-100 text-purple-800' : ''}
                    {returnRequest.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : ''}
                    {returnRequest.status === 'REJECTED' ? 'bg-red-100 text-red-800' : ''}
                  "
                  >
                    {getStatusLabel(returnRequest.status)}
                  </span>
                </p>
              </div>
              <div>
                <p class="text-sm text-accent-muted">{t('admin.returns.reason')}</p>
                <p class="text-lg font-semibold">{getReasonLabel(returnRequest.reason)}</p>
              </div>
              {#if returnRequest.refundAmount}
                <div>
                  <p class="text-sm text-accent-muted">{t('admin.returns.refundAmount')}</p>
                  <p class="text-lg font-semibold">${returnRequest.refundAmount.toFixed(2)}</p>
                </div>
              {/if}
            </div>
            {#if returnRequest.customerNotes}
              <div>
                <p class="text-sm text-accent-muted">{t('admin.returns.customerNotes')}</p>
                <p class="text-sm">{returnRequest.customerNotes}</p>
              </div>
            {/if}
            {#if returnRequest.adminNotes}
              <div>
                <p class="text-sm text-accent-muted">{t('admin.returns.adminNotes')}</p>
                <p class="text-sm">{returnRequest.adminNotes}</p>
              </div>
            {/if}
            <div>
              <p class="text-sm text-accent-muted">{t('admin.returns.returnItems')}</p>
              <ul class="list-disc list-inside text-sm mt-1">
                {#each returnRequest.items as item}
                  <li>
                    {item.orderItem.product.name}
                    {#if item.orderItem.size}
                      ({t('orderDetail.size')}: {item.orderItem.size})
                    {/if}
                    - {t('orderDetail.quantity')}: {item.quantity} - {t('common.status')}: {item.itemStatus ===
                    'WRITE_OFF'
                      ? t('orderDetail.writeOff')
                      : t('orderDetail.returnToSale')}
                  </li>
                {/each}
              </ul>
            </div>
            <p class="text-xs text-accent-muted mt-2">
              {t('common.created')}: {formatDate(returnRequest.createdAt)}
            </p>
          </div>
        </div>
      {/if}

      <!-- Support Tickets -->
      <div class="bg-dark-light p-6 border border-white/10">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-medium">{t('order.supportTickets')}</h3>
          <div class="flex gap-2">
            {#if order.tickets && order.tickets.length > 0}
              <button
                on:click={() => order && goto(`/admin/tickets?search=${order.orderNumber}`)}
                class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-100 transition-colors text-sm"
              >
                {t('order.viewTicketsNoCount')}
              </button>
            {/if}
            <button
              on:click={openTicketModal}
              class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
            >
              {t('order.createTicket')}
            </button>
          </div>
        </div>
        {#if order.tickets && order.tickets.length > 0}
          <div class="space-y-3">
            {#each order.tickets as ticket}
              <div class="p-4 bg-dark border border-white/10">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <a
                      href="/admin/tickets/{ticket.id}"
                      class="text-accent hover:text-accent-muted font-medium"
                    >
                      {t('ticket.ticket')} #{ticket.id.slice(0, 8)}
                    </a>
                    <p class="text-sm text-accent-muted mt-1">
                      {t('common.status')}:
                      <span class="font-medium">{formatTicketStatus(ticket.status)}</span>
                    </p>
                  </div>
                  <span
                    class="text-xs px-2 py-1 rounded
                      {ticket.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' : ''}
                      {ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : ''}
                      {ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-800' : ''}
                      {ticket.status === 'CLOSED' ? 'bg-gray-100 text-gray-800' : ''}
                    "
                  >
                    {formatTicketStatus(ticket.status)}
                  </span>
                </div>
                <p class="text-sm text-accent-muted">
                  {t('common.created')}: {formatDate(ticket.createdAt)}
                </p>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-accent-muted">{t('order.noSupportTickets')}</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if showQRCodeModal && order}
    <OrderQRCode
      orderNumber={order.orderNumber}
      orderId={order.id}
      onClose={() => (showQRCodeModal = false)}
    />
  {/if}

  <!-- Ticket Creation Modal -->
  {#if showTicketModal && order}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-2xl font-bold mb-4 text-black">{t('order.createSupportTicket')}</h3>

        <div class="mb-4 p-3 bg-gray-100 rounded">
          <p class="text-sm text-gray-600">
            <strong>{t('order.order')}:</strong> #{order.orderNumber}
          </p>
          <p class="text-sm text-gray-600">
            <strong>{t('customer.customer')}:</strong>
            {order.user?.email || order.userId}
          </p>
        </div>

        <div class="space-y-4">
          <!-- Subject -->
          <div>
            <label
              for="ticket-subject-input-order"
              class="block text-sm font-medium mb-2 text-black"
            >
              {t('ticket.subject')} *
            </label>
            <input
              id="ticket-subject-input-order"
              type="text"
              bind:value={ticketSubject}
              placeholder={t('ticket.subjectPlaceholder')}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>

          <!-- Message -->
          <div>
            <label
              for="ticket-message-textarea-order"
              class="block text-sm font-medium mb-2 text-black"
            >
              {t('ticket.message')} *
            </label>
            <textarea
              id="ticket-message-textarea-order"
              bind:value={ticketMessage}
              placeholder={t('ticket.messagePlaceholder')}
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
              {t('ticket.creating')}
            {:else}
              {t('common.create')}
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
