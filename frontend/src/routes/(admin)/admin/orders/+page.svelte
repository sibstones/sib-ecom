<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '$lib/api/admin.api';
  import type { Order } from '$lib/api/customer.api';
  import {
    paymentRequestApi,
    type PaymentRequest,
    type LogisticsInfo,
  } from '$lib/api/payment-request.api';
  import {
    deliveryTrackingApi,
    type CarrierOption,
    type TrackingInfo,
  } from '$lib/api/delivery-tracking.api';
  import {
    yandexDeliveryApi,
    type YandexPickupPoint,
    type YandexDeliveryOffer,
    type YandexAddress,
    type YandexGeocodeResult,
  } from '$lib/api/yandex-delivery.api';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import DateRangePicker from '$lib/components/admin/DateRangePicker.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { confirm, alert } from '$lib/utils/dialog.utils';
  import { formatOrderStatus, formatPaymentStatus, t } from '$lib/utils/i18n';
  import { getErrorMessage, resolveApiError } from '$lib/utils/error-handler';
  import { notificationStore } from '$lib/stores/notification.store';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { settingsStore } from '$lib/stores/settings.store';

  /** Accepted from SvelteKit; no dynamic route params on this page. */
  export let params: Record<string, string> = {};
  function consumeValue(..._values: unknown[]) {}
  consumeValue(params);

  let orders: Order[] = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let totalPages = 1;
  let selectedStatus = '';
  let selectedPaymentStatus = '';
  let searchQuery = '';
  let dateFrom = '';
  let dateTo = '';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let deliveryStage:
    | ''
    | 'NO_TRACKING'
    | 'IN_TRANSIT'
    | 'AWAITING_PICKUP'
    | 'AWAITING_PICKUP_OVER_7_DAYS' = '';
  let selectedOrder: Order | null = null;
  let selectedPaymentRequest: PaymentRequest | null = null;
  let showShippingModal = false;
  let loadingPaymentRequest = false;

  let shippingData: LogisticsInfo = {
    trackingNumber: '',
    carrier: '',
    estimatedDelivery: '',
    notes: '',
  };

  let availableCarriers: CarrierOption[] = [];
  let checkingTracking = false;
  let highlightedOrderId: string | null = null;

  // Yandex Delivery integration (carrier === 'YANDEX_DELIVERY' when selected in dropdown)
  let geocodingAddress = false;
  let geocodeResult: YandexGeocodeResult | null = null;
  let loadingPickupPoints = false;
  let pickupPoints: YandexPickupPoint[] = [];
  let selectedPickupPoint: YandexPickupPoint | null = null;
  let calculatingCost = false;
  let deliveryOffers: YandexDeliveryOffer[] = [];
  let selectedOffer: YandexDeliveryOffer | null = null;
  let creatingYandexClaim = false;
  let yandexClaimId: string | null = null;

  /** Result of "Verify tracking" (link, status, instructions) — shown before Save */
  let trackingVerificationResult: TrackingInfo | null = null;
  let verifyingTracking = false;

  /** Warehouse address, where the ordered product is stored (from inventory items of the order) */
  let warehouseAddressForOrder = '';

  /** Build tracking URL by carrier (for display after verify) */
  function buildTrackingUrl(carrier: string, trackingNumber: string): string | undefined {
    const n = encodeURIComponent(trackingNumber.trim());
    const urls: Record<string, string> = {
      DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
      FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${n}`,
      UPS: `https://www.ups.com/track?tracknum=${n}`,
      USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
      CDEK: `https://www.cdek.ru/track.html?order_id=${n}`,
      BOXBERRY: `https://boxberry.ru/tracking/?code=${n}`,
      RUSSIAN_POST: `https://www.pochta.ru/tracking#${n}`,
    };
    return urls[carrier] || undefined;
  }

  function scrollToHighlightedOrder() {
    if (highlightedOrderId && !loading) {
      setTimeout(() => {
        const element = document.getElementById(`order-${highlightedOrderId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Remove orderId from URL after scrolling (but keep it in state for highlighting)
          const url = new URL(window.location.href);
          url.searchParams.delete('orderId');
          window.history.replaceState({}, '', url.toString());
        }
      }, 300);
    }
  }

  // Reactive statement to handle URL changes
  $: {
    const orderIdParam = $page.url.searchParams.get('orderId');
    if (orderIdParam && orderIdParam !== highlightedOrderId) {
      highlightedOrderId = orderIdParam;
      // Scroll after orders are loaded
      scrollToHighlightedOrder();
    }
  }

  onMount(async () => {
    // Check for orderId in URL params on mount
    const orderIdParam = $page.url.searchParams.get('orderId');
    if (orderIdParam) {
      highlightedOrderId = orderIdParam;
    }
    await loadOrders();
    scrollToHighlightedOrder();
  });

  async function loadOrders() {
    loading = true;
    try {
      const response = await adminApi.getAllOrders(currentPage, 20, {
        status: selectedStatus || undefined,
        paymentStatus: selectedPaymentStatus || undefined,
        search: searchQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortOrder,
        deliveryStage: deliveryStage || undefined,
      });
      orders = response.orders;
      totalPages = response.pagination.totalPages;
      // Scroll to highlighted order after loading
      scrollToHighlightedOrder();
    } catch (e) {
      error = getErrorMessage(e, 'order.failedToLoadOrders');
    } finally {
      loading = false;
    }
  }

  async function updateStatus(orderId: string, status: string) {
    try {
      await adminApi.updateOrderStatus(orderId, status);
      await loadOrders();
      notificationStore.success(t('notification.orderStatusUpdated'));
    } catch (e) {
      notificationStore.error(t('notification.errorOccurred'));
    }
  }

  async function confirmPayment(orderId: string) {
    const confirmed = await confirm(
      t('alert.confirmPayment'),
      t('common.confirm'),
      t('common.yes'),
      t('common.cancel')
    );
    if (!confirmed) return;

    try {
      await adminApi.updateOrderPaymentStatus(
        orderId,
        'PAID',
        'Payment confirmed manually by admin'
      );
      await loadOrders();
      notificationStore.success(t('notification.paymentStatusUpdated'));
    } catch (e) {
      notificationStore.error(t('notification.errorOccurred'));
    }
  }

  function handleStatusChange(orderId: string, value: string | number) {
    updateStatus(orderId, String(value));
  }

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function getPaymentStatusClass(status: string | undefined): string {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getPaymentRequestStatusClass(status: string | undefined): string {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  async function openShippingModal(order: Order) {
    selectedOrder = order;
    loadingPaymentRequest = true;
    showShippingModal = true;
    warehouseAddressForOrder = '';

    // Reset Yandex Delivery state
    geocodeResult = null;
    pickupPoints = [];
    selectedPickupPoint = null;
    deliveryOffers = [];
    selectedOffer = null;
    yandexClaimId = null;
    trackingVerificationResult = null;

    try {
      const lang = $i18nStore === 'ru' ? 'ru' : 'en';

      // Full order, warehouse (where the order is stored), carriers, payment request
      const [orderRes, warehouseRes, carriersRes, paymentRes] = await Promise.all([
        adminApi.getOrderById(order.id),
        adminApi.getOrderWarehouse(order.id).catch(() => ({ warehouse: null })),
        deliveryTrackingApi.getAvailableCarriers(lang),
        paymentRequestApi
          .getByOrderId(order.id)
          .catch(() => ({ request: null as PaymentRequest | null })),
      ]);

      selectedOrder = orderRes.order;
      const wh = warehouseRes?.warehouse;
      if (wh) {
        const parts = [wh.name, wh.address, wh.city, wh.country].filter(Boolean);
        warehouseAddressForOrder = parts.length ? parts.join(', ') : wh.name || wh.id || '—';
      }

      const hasYandex = carriersRes.some((c) => c.value === 'YANDEX_DELIVERY');
      availableCarriers = hasYandex
        ? carriersRes
        : [
            ...carriersRes,
            { value: 'YANDEX_DELIVERY', label: t('yandexDelivery.yandexDelivery'), enabled: true },
          ];

      let paymentRequest = paymentRes.request;
      // For GATEWAY-paid orders, PaymentRequest may not exist — create it for shipping
      if (!paymentRequest && selectedOrder.paymentStatus === 'PAID') {
        try {
          const ensureRes = await paymentRequestApi.ensureForShipping(selectedOrder.id);
          paymentRequest = ensureRes.request;
        } catch (_) {
          paymentRequest = null;
        }
      }
      selectedPaymentRequest = paymentRequest;

      // Pre-fill shipping data if exists
      if (paymentRequest?.logisticsInfo) {
        shippingData = {
          trackingNumber: paymentRequest.logisticsInfo.trackingNumber || '',
          carrier: paymentRequest.logisticsInfo.carrier || '',
          estimatedDelivery: paymentRequest.logisticsInfo.estimatedDelivery || '',
          notes: paymentRequest.logisticsInfo.notes || '',
        };

        // Check if Yandex Delivery claim ID exists
        if (paymentRequest.logisticsInfo.yandexDeliveryClaimId) {
          yandexClaimId = paymentRequest.logisticsInfo.yandexDeliveryClaimId;
          shippingData.carrier = 'YANDEX_DELIVERY';
        }
      } else {
        shippingData = {
          trackingNumber: '',
          carrier: availableCarriers.length > 0 ? availableCarriers[0].value : '',
          estimatedDelivery: '',
          notes: '',
        };
      }
    } catch (_e) {
      selectedPaymentRequest = null;
      try {
        const orderRes = await adminApi.getOrderById(order.id);
        selectedOrder = orderRes.order;
      } catch (_) {}
      try {
        const whRes = await adminApi.getOrderWarehouse(order.id);
        const wh = whRes?.warehouse;
        if (wh) {
          const parts = [wh.name, wh.address, wh.city, wh.country].filter(Boolean);
          warehouseAddressForOrder = parts.length ? parts.join(', ') : wh.name || wh.id || '—';
        }
      } catch (_) {}
      const carriersFromApi = await deliveryTrackingApi.getAvailableCarriers();
      const hasYandexFallback = carriersFromApi.some((c) => c.value === 'YANDEX_DELIVERY');
      availableCarriers = hasYandexFallback
        ? carriersFromApi
        : [
            ...carriersFromApi,
            { value: 'YANDEX_DELIVERY', label: t('yandexDelivery.yandexDelivery'), enabled: true },
          ];
      shippingData = {
        trackingNumber: '',
        carrier: availableCarriers.length > 0 ? availableCarriers[0].value : '',
        estimatedDelivery: '',
        notes: '',
      };
    } finally {
      loadingPaymentRequest = false;
    }
  }

  /** When user switches to Yandex Delivery: geocode address → find pickup points → calculate cost (all data for shipment). */
  async function runYandexFlow() {
    if (!selectedOrder || shippingData.carrier !== 'YANDEX_DELIVERY' || yandexClaimId) return;
    if (!selectedOrder.shippingAddress) {
      notificationStore.warning(t('yandexDelivery.addressNotSpecified'));
      return;
    }
    await geocodeShippingAddress();
    if (geocodeResult) {
      await calculateYandexDeliveryCost();
    }
  }

  async function geocodeShippingAddress() {
    if (!selectedOrder?.shippingAddress) {
      notificationStore.error(t('yandexDelivery.addressNotSpecified'));
      return;
    }

    geocodingAddress = true;
    try {
      const address = selectedOrder.shippingAddress.address;
      const city = selectedOrder.shippingAddress.city;
      const country = selectedOrder.shippingAddress.country;

      const result = await yandexDeliveryApi.geocodeAddress(address, city, country);
      geocodeResult = result.result;

      // Automatically search for pickup points after geocoding
      if (geocodeResult.coordinates) {
        await findNearestPickupPoints();
      }

      notificationStore.success(t('yandexDelivery.geocodeSuccess'));
    } catch (error) {
      notificationStore.error(resolveApiError(error, 'yandexDelivery.geocodeError'));
    } finally {
      geocodingAddress = false;
    }
  }

  async function findNearestPickupPoints() {
    if (!geocodeResult?.coordinates) {
      notificationStore.error(t('yandexDelivery.geocodeFirst'));
      return;
    }

    loadingPickupPoints = true;
    try {
      const result = await yandexDeliveryApi.findNearestPickupPoints(
        geocodeResult.coordinates,
        5000 // radius 5 km
      );
      pickupPoints = result.pickupPoints;

      if (pickupPoints.length === 0) {
        notificationStore.warning(t('yandexDelivery.noPickupPointsFound'));
      }
    } catch (error) {
      notificationStore.error(
        error instanceof Error ? error.message : t('yandexDelivery.pickupPointsError')
      );
    } finally {
      loadingPickupPoints = false;
    }
  }

  function getFromAddressFromSettings(): YandexAddress {
    const settings = $settingsStore as unknown as Record<string, unknown>;
    const addr = (settings.yandexDeliverySenderAddress as string) || 'Moscow, Lenina Street, 10';
    const coordsStr = (settings.yandexDeliverySenderCoordinates as string) || '55.7558,37.6173';
    const [latStr, lonStr] = coordsStr.split(',').map((s) => s.trim());
    const lat = parseFloat(latStr) || 55.7558;
    const lon = parseFloat(lonStr) || 37.6173;
    return { fullname: addr, coordinates: { lat, lon } };
  }

  function getItemWeightKg(item: {
    product?: { weightNet?: number; weightGross?: number };
  }): number {
    const p = item.product;
    const w = p?.weightGross ?? p?.weightNet;
    return typeof w === 'number' && w > 0 ? w : 0.5;
  }

  async function calculateYandexDeliveryCost() {
    if (!selectedOrder || !geocodeResult) {
      notificationStore.error(t('yandexDelivery.mustGeocodeAddress'));
      return;
    }

    calculatingCost = true;
    try {
      const fromAddress = getFromAddressFromSettings();
      const toAddress: YandexAddress = {
        fullname: geocodeResult.formatted_address,
        coordinates: geocodeResult.coordinates,
      };

      const items = selectedOrder.items.map((item) => ({
        weight: getItemWeightKg(item),
        dimensions: { length: 30, width: 20, height: 10 },
      }));

      const result = await yandexDeliveryApi.calculateDeliveryCost(
        fromAddress,
        toAddress,
        items,
        selectedPickupPoint?.id
      );

      deliveryOffers = result.offers;

      if (deliveryOffers.length === 0) {
        notificationStore.warning(t('yandexDelivery.noPickupPointsFound'));
      } else {
        selectedOffer = deliveryOffers[0];
      }
    } catch (error) {
      notificationStore.error(
        error instanceof Error ? error.message : t('yandexDelivery.costCalculationError')
      );
    } finally {
      calculatingCost = false;
    }
  }

  async function createYandexDeliveryClaim() {
    if (!selectedOrder || !selectedOffer || !geocodeResult) {
      notificationStore.error(t('yandexDelivery.mustSelectDeliveryOption'));
      return;
    }

    creatingYandexClaim = true;
    try {
      const fromAddress = getFromAddressFromSettings();
      const toAddress: YandexAddress = {
        fullname: geocodeResult.formatted_address,
        coordinates: geocodeResult.coordinates,
      };

      const items = selectedOrder.items.map((item) => ({
        name: item.product.name,
        weight: getItemWeightKg(item),
        cost_value: Number(item.price),
        cost_currency: 'RUB',
        dimensions: { length: 30, width: 20, height: 10 },
      }));

      const result = await yandexDeliveryApi.createDeliveryClaim(
        selectedOrder.id,
        fromAddress,
        toAddress,
        items,
        selectedPickupPoint?.id,
        selectedOffer.offer_id
      );

      yandexClaimId = result.claim.id;

      // Save delivery information
      await paymentRequestApi.markAsShipped(selectedPaymentRequest!.id, {
        trackingNumber: result.claim.id,
        carrier: 'YANDEX_DELIVERY',
        notes: `Yandex Delivery Claim ID: ${result.claim.id}`,
        yandexDeliveryClaimId: result.claim.id,
        pickupPointId: selectedPickupPoint?.id,
      });

      // Send notification to user about pickup point, if selected
      if (selectedPickupPoint && result.claim.pickup_point) {
        await yandexDeliveryApi.notifyUserAboutPickupPoint(
          selectedOrder.id,
          result.claim.pickup_point
        );
      }

      notificationStore.success(t('yandexDelivery.orderCreatedSuccess'));
      showShippingModal = false;
      await loadOrders();
    } catch (error) {
      notificationStore.error(
        error instanceof Error ? error.message : t('yandexDelivery.orderCreateError')
      );
    } finally {
      creatingYandexClaim = false;
    }
  }

  /** Verify tracking via API (link + instructions). Does not save. */
  async function verifyTrackingOnly() {
    if (!shippingData.trackingNumber?.trim()) {
      notificationStore.warning(t('order.trackingNumberLabel') + ' — ' + t('error.requiredField'));
      return;
    }
    if (!shippingData.carrier || shippingData.carrier === 'MANUAL') {
      notificationStore.warning(t('order.carrierDescription'));
      return;
    }
    verifyingTracking = true;
    trackingVerificationResult = null;
    try {
      const res = await deliveryTrackingApi.checkTracking(
        shippingData.trackingNumber.trim(),
        shippingData.carrier
      );
      const info = res.trackingInfo;
      const url = buildTrackingUrl(shippingData.carrier, shippingData.trackingNumber);
      trackingVerificationResult = { ...info, trackingUrl: info.trackingUrl || url };
      if (info.estimatedDelivery && !shippingData.estimatedDelivery) {
        shippingData.estimatedDelivery = info.estimatedDelivery;
      }
      notificationStore.success(t('order.trackingCheckedSuccessfully'));
    } catch (e) {
      console.warn('Verify tracking failed:', e);
      notificationStore.warning(t('order.trackingCheckFailed'));
    } finally {
      verifyingTracking = false;
    }
  }

  async function saveShipping() {
    if (!selectedOrder) {
      notificationStore.error(t('order.paymentRequestNotFound'));
      return;
    }
    // Check: order must be paid
    if (selectedOrder.paymentStatus !== 'PAID') {
      notificationStore.error(t('order.orderMustBePaidForShipping'));
      return;
    }
    // For gateway-paid orders without PaymentRequest — create/get request beforehand
    let paymentRequest = selectedPaymentRequest;
    if (!paymentRequest) {
      try {
        const res = await paymentRequestApi.ensureForShipping(selectedOrder.id);
        paymentRequest = res.request;
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('error.failedToSave');
        notificationStore.error(msg);
        return;
      }
    }

    checkingTracking = true;

    try {
      // If tracking was not verified yet but we have number + carrier, try to check (optional)
      if (
        shippingData.trackingNumber &&
        shippingData.carrier &&
        shippingData.carrier !== 'MANUAL' &&
        !trackingVerificationResult
      ) {
        try {
          const trackingResponse = await deliveryTrackingApi.checkTracking(
            shippingData.trackingNumber,
            shippingData.carrier
          );
          const trackingInfo = trackingResponse.trackingInfo;
          if (trackingInfo.estimatedDelivery && !shippingData.estimatedDelivery) {
            shippingData.estimatedDelivery = trackingInfo.estimatedDelivery;
          }
          if (trackingInfo.statusDescription) {
            const statusNote = `Status: ${trackingInfo.statusDescription}`;
            shippingData.notes = shippingData.notes
              ? `${shippingData.notes}\n${statusNote}`
              : statusNote;
          }
        } catch (trackingError) {
          console.warn('Failed to check tracking:', trackingError);
        }
      }

      const logisticsPayload = {
        ...shippingData,
        shippedDate: new Date().toISOString(),
      };
      // Save: always use markAsShipped by id (paymentRequest is guaranteed after ensureForShipping)
      await paymentRequestApi.markAsShipped(paymentRequest.id, logisticsPayload);

      // If automatic update is enabled, update order status
      if (
        shippingData.trackingNumber &&
        shippingData.carrier &&
        shippingData.carrier !== 'MANUAL'
      ) {
        try {
          await deliveryTrackingApi.updateOrderStatus(selectedOrder.id);
        } catch (updateError) {
          console.warn('Failed to update order status:', updateError);
        }
      }

      showShippingModal = false;
      // Reload orders to get updated status and paymentRequest data
      await loadOrders();
      notificationStore.success(t('notification.shippingInfoSaved'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('error.failedToSave');
      notificationStore.error(msg);
      if (import.meta.env.DEV) console.error('saveShipping failed:', e);
    } finally {
      checkingTracking = false;
    }
  }
</script>

<div>
  <h2 class="text-3xl font-bold mb-6">{t('menu.orders')}</h2>

  <!-- Filters: single line with expanding search -->
  <div class="mb-6 flex flex-wrap items-end gap-4 min-w-0">
    <input
      type="text"
      bind:value={searchQuery}
      on:input={loadOrders}
      placeholder={t('common.search') + ' ' + t('menu.orders').toLowerCase() + '...'}
      class="w-full flex-1 min-w-[280px] px-4 py-2 bg-white border border-gray-300 text-black text-sm"
    />
    <CustomSelect
      bind:value={sortOrder}
      fitContent={true}
      options={[
        { value: 'desc', label: t('admin.sortNewestFirst') },
        { value: 'asc', label: t('admin.sortOldestFirst') },
      ]}
      on:change={() => {
        currentPage = 1;
        loadOrders();
      }}
    />
    <CustomSelect
      bind:value={selectedStatus}
      fitContent={true}
      options={[
        { value: '', label: t('common.all') + ' ' + t('common.status') },
        { value: 'PENDING', label: formatOrderStatus('PENDING') },
        { value: 'CONFIRMED', label: formatOrderStatus('CONFIRMED') },
        { value: 'PROCESSING', label: formatOrderStatus('PROCESSING') },
        { value: 'SHIPPED', label: formatOrderStatus('SHIPPED') },
        { value: 'DELIVERED', label: formatOrderStatus('DELIVERED') },
        { value: 'CANCELLED', label: formatOrderStatus('CANCELLED') },
        { value: 'RETURN_REQUESTED', label: formatOrderStatus('RETURN_REQUESTED') },
        { value: 'RETURNED', label: formatOrderStatus('RETURNED') },
      ]}
      on:change={() => {
        currentPage = 1;
        loadOrders();
      }}
    />
    <CustomSelect
      bind:value={selectedPaymentStatus}
      fitContent={true}
      options={[
        { value: '', label: t('common.all') + ' ' + t('order.paymentStatus') },
        { value: 'PENDING', label: 'Pending' },
        { value: 'PAID', label: 'Paid' },
        { value: 'FAILED', label: 'Failed' },
        { value: 'REFUNDED', label: 'Refunded' },
      ]}
      on:change={() => {
        currentPage = 1;
        loadOrders();
      }}
    />
    <CustomSelect
      bind:value={deliveryStage}
      fitContent={true}
      options={[
        { value: '', label: t('order.deliveryStageAll') },
        { value: 'NO_TRACKING', label: t('order.deliveryStageNoTracking') },
        { value: 'IN_TRANSIT', label: t('order.deliveryStageInTransit') },
        { value: 'AWAITING_PICKUP', label: t('order.deliveryStageAwaitingPickup') },
        {
          value: 'AWAITING_PICKUP_OVER_7_DAYS',
          label: t('order.deliveryStageAwaitingPickupOver7Days'),
        },
      ]}
      on:change={() => {
        currentPage = 1;
        loadOrders();
      }}
    />
    <DateRangePicker
      bind:dateFrom
      bind:dateTo
      tight={true}
      on:change={() => {
        currentPage = 1;
        loadOrders();
      }}
    />
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if orders.length === 0}
    <p class="text-accent-muted">{t('order.orderNumber')} {t('common.notFound')}</p>
  {:else}
    <div class="bg-white rounded overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1400px]">
          <thead class="bg-white border-b border-accent/20">
            <tr>
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('common.actions')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.orderHash')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.customer')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.date')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('common.status')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.paymentMethod')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.paymentStatus')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.paymentRequest')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.trackingNumber')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.total')}</th
              >
              <th class="px-3 py-3 text-left text-sm font-medium whitespace-nowrap"
                >{t('order.tickets')}</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-accent/20">
            {#each orders as order}
              <tr
                id="order-{order.id}"
                class="cursor-pointer hover:bg-white/5 transition-colors {highlightedOrderId ===
                order.id
                  ? 'bg-blue-500/10 border-l-4 border-blue-500'
                  : ''}"
                role="button"
                tabindex="0"
                on:click={() => goto(`/admin/orders/${order.id}`)}
                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goto(`/admin/orders/${order.id}`);
                  }
                }}
              >
                <td class="px-3 py-4" on:click|stopPropagation>
                  <div class="flex gap-2 items-center flex-wrap">
                    <a
                      href="/admin/orders/{order.id}"
                      class="px-3 py-1 bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
                    >
                      {t('common.view')}
                    </a>
                    {#if order.paymentStatus === 'PENDING' && order.paymentMethod === 'GATEWAY' && !order.paymentRequest}
                      <button
                        on:click={() => confirmPayment(order.id)}
                        class="px-2 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors whitespace-nowrap"
                        title={t('order.confirmPayment')}
                      >
                        {t('order.confirmPayment')}
                      </button>
                    {/if}
                    {#if order.paymentStatus === 'PAID' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && !order.paymentRequest?.logisticsInfo?.trackingNumber}
                      <button
                        on:click={() => openShippingModal(order)}
                        class="px-3 py-1 bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
                      >
                        {t('order.ship')}
                      </button>
                    {/if}
                  </div>
                </td>
                <td class="px-3 py-4 whitespace-nowrap font-mono text-sm">{order.orderNumber}</td>
                <td class="px-3 py-4">
                  <div class="min-w-[150px]">
                    <p class="text-sm truncate">{order.user?.email || t('common.n/a')}</p>
                  </div>
                </td>
                <td class="px-3 py-4 whitespace-nowrap text-sm">{formatDate(order.createdAt)}</td>
                <td class="px-3 py-4" on:click|stopPropagation>
                  <CustomSelect
                    value={order.status}
                    options={[
                      { value: 'PENDING', label: formatOrderStatus('PENDING') },
                      { value: 'CONFIRMED', label: formatOrderStatus('CONFIRMED') },
                      { value: 'PROCESSING', label: formatOrderStatus('PROCESSING') },
                      { value: 'SHIPPED', label: formatOrderStatus('SHIPPED') },
                      { value: 'DELIVERED', label: formatOrderStatus('DELIVERED') },
                      { value: 'CANCELLED', label: formatOrderStatus('CANCELLED') },
                      { value: 'RETURN_REQUESTED', label: formatOrderStatus('RETURN_REQUESTED') },
                      { value: 'RETURNED', label: formatOrderStatus('RETURNED') },
                    ]}
                    size="sm"
                    on:change={(e) => handleStatusChange(order.id, e.detail.value)}
                    className="min-w-[120px]"
                  />
                </td>
                <td class="px-3 py-4 whitespace-nowrap">
                  <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                    {order.paymentMethod === 'GATEWAY'
                      ? t('order.gateway')
                      : order.paymentMethod === 'BANK_TRANSFER'
                        ? t('order.bankTransfer')
                        : order.paymentMethod === 'P2P'
                          ? t('order.p2pPayment')
                          : order.paymentMethod === 'CASH_ON_DELIVERY'
                            ? t('order.cashOnDelivery')
                            : order.paymentMethod === 'MANAGER_CHAT'
                              ? t('paymentGateway.managerChat')
                              : t('common.n/a')}
                  </span>
                </td>
                <td class="px-3 py-4 whitespace-nowrap">
                  <span
                    class="text-xs px-2 py-1 rounded font-medium {getPaymentStatusClass(
                      order.paymentStatus
                    )}"
                  >
                    {order.paymentStatus || 'N/A'}
                  </span>
                </td>
                <td class="px-3 py-4 whitespace-nowrap" on:click|stopPropagation>
                  {#if order.paymentRequest}
                    <a
                      href="/admin/payment-requests"
                      class="inline-block text-xs text-accent hover:text-accent-muted transition-colors"
                      on:click|preventDefault={() => {
                        goto('/admin/payment-requests');
                      }}
                      title={t('order.viewPaymentRequest')}
                    >
                      <span
                        class="px-2 py-1 rounded font-medium {getPaymentRequestStatusClass(
                          order.paymentRequest.status
                        )}"
                      >
                        {order.paymentRequest.status || t('common.n/a')}
                      </span>
                    </a>
                  {:else if order.paymentMethod === 'GATEWAY'}
                    <span
                      class="text-xs text-accent-muted"
                      title={t('order.gatewayPaymentNoRequest')}
                    >
                      {t('order.gateway')}
                    </span>
                  {:else}
                    <span class="text-xs text-accent-muted">—</span>
                  {/if}
                </td>
                <td class="px-3 py-4 whitespace-nowrap">
                  {#if order.paymentRequest?.logisticsInfo?.trackingNumber}
                    <span class="text-xs font-mono text-accent" title="Tracking number">
                      {order.paymentRequest.logisticsInfo.trackingNumber}
                    </span>
                  {:else}
                    <span class="text-xs text-accent-muted">—</span>
                  {/if}
                </td>
                <td class="px-3 py-4 whitespace-nowrap">${Number(order.total || 0).toFixed(2)}</td>
                <td class="px-3 py-4 whitespace-nowrap" on:click|stopPropagation>
                  {#if order.tickets && order.tickets.length > 0}
                    <button
                      on:click={() => goto(`/admin/tickets?search=${order.orderNumber}`)}
                      class="px-2 py-1 bg-black text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
                      title={t('order.openTickets')
                        .replace('{count}', order.tickets.length.toString())
                        .replace('{plural}', order.tickets.length !== 1 ? 's' : '')
                        .replace('{plural}', order.tickets.length !== 1 ? 's' : '')}
                    >
                      {order.tickets.length}
                    </button>
                  {:else}
                    <span class="text-accent-muted text-sm">—</span>
                  {/if}
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
            loadOrders();
          }}
          disabled={currentPage === 1}
          class="px-4 py-2 bg-dark-light border border-accent/20 disabled:opacity-50"
        >
          {t('order.previous')}
        </button>
        <span class="text-accent-muted"
          >{t('order.pageOf')
            .replace('{page}', currentPage.toString())
            .replace('{total}', totalPages.toString())}</span
        >
        <button
          on:click={() => {
            currentPage++;
            loadOrders();
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

<!-- Shipping Modal -->
{#if showShippingModal && selectedOrder}
  <div
    class="shipping-modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4"
    on:click={(e) => {
      if (e.target === e.currentTarget) {
        showShippingModal = false;
      }
    }}
    role="button"
    tabindex="0"
    on:keydown={(e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        showShippingModal = false;
      }
    }}
  >
    <div
      class="shipping-modal-panel bg-dark-light w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
    >
      <!-- Header -->
      <div
        class="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-white/10"
      >
        <h3 class="text-lg font-semibold text-accent m-0">{t('order.addShippingInformation')}</h3>
        <button
          type="button"
          on:click={() => (showShippingModal = false)}
          class="shipping-modal-btn-secondary w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-white/20 bg-transparent text-accent-muted hover:text-accent hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          aria-label={t('common.close')}
        >
          <span class="text-xl leading-none">×</span>
        </button>
      </div>

      {#if loadingPaymentRequest}
        <div class="flex-1 flex items-center justify-center p-8">
          <p class="text-accent-muted text-sm">{t('common.loading')}</p>
        </div>
      {:else if !selectedPaymentRequest && !(selectedOrder?.paymentStatus === 'PAID')}
        <div class="p-6 space-y-4">
          <p class="text-red-500 dark:text-red-400 text-sm">{t('order.paymentRequestNotFound')}</p>
          <button
            type="button"
            on:click={() => (showShippingModal = false)}
            class="shipping-modal-btn-secondary px-5 py-2.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors text-accent"
          >
            {t('common.close')}
          </button>
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto min-h-0">
          <div class="p-6 space-y-5">
            <!-- 1. Order details — recipient (from order) -->
            {#if selectedOrder?.shippingAddress}
              <div
                class="shipping-modal-card p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
              >
                <p class="text-xs font-medium uppercase tracking-wider text-accent-muted mb-3">
                  {t('order.orderRecipientBlockTitle')}
                </p>
                <div class="space-y-2 text-sm text-accent">
                  <p>
                    <strong class="font-medium">{t('order.recipient')}:</strong>
                    {selectedOrder.shippingAddress.firstName}
                    {selectedOrder.shippingAddress.lastName}
                  </p>
                  {#if selectedOrder.shippingAddress.phone}
                    <p>
                      <strong class="font-medium">{t('common.phone')}:</strong>
                      {selectedOrder.shippingAddress.phone}
                    </p>
                  {/if}
                  <p>
                    <strong class="font-medium">{t('yandexDelivery.address')}:</strong>
                    {selectedOrder.shippingAddress.address}
                  </p>
                  <p>
                    <strong class="font-medium">{t('yandexDelivery.city')}:</strong>
                    {selectedOrder.shippingAddress
                      .city}{#if selectedOrder.shippingAddress.postalCode}, {selectedOrder
                        .shippingAddress.postalCode}{/if}
                  </p>
                  <p>
                    <strong class="font-medium">{t('common.country')}:</strong>
                    {selectedOrder.shippingAddress.country}
                  </p>
                </div>
              </div>
            {/if}

            <!-- 1b. Cash on delivery — instruction and steps for Yandex Delivery -->
            {#if selectedOrder?.paymentMethod === 'CASH_ON_DELIVERY'}
              <div
                class="shipping-modal-card p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-3"
              >
                <p
                  class="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300"
                >
                  {t('order.cashOnDelivery')}
                </p>
                <p class="text-sm text-accent leading-relaxed">
                  {t('paymentGateway.cashOnDeliveryYandexInstruction')}
                </p>
                <p class="text-sm text-accent font-medium">
                  {t('order.shippingModal.cashOnDeliverySteps')}
                </p>
              </div>
            {/if}

            <!-- 2. From / To (warehouse → client address) -->
            <div
              class="shipping-modal-card p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-3"
            >
              <p class="text-sm">
                <strong class="font-medium">{t('order.fromWarehouse')}:</strong>
                <span class="text-accent">{warehouseAddressForOrder || '—'}</span>
              </p>
              <p class="text-sm">
                <strong class="font-medium">{t('order.toClientAddress')}:</strong>
                {#if selectedOrder?.shippingAddress}
                  <span class="text-accent"
                    >{selectedOrder.shippingAddress.address}, {selectedOrder.shippingAddress
                      .city}{#if selectedOrder.shippingAddress.postalCode}
                      {selectedOrder.shippingAddress.postalCode}{/if}, {selectedOrder
                      .shippingAddress.country}</span
                  >
                {:else}
                  <span class="text-accent-muted">—</span>
                {/if}
              </p>
            </div>

            <!-- 3. Carrier -->
            <div>
              <label for="carrier-select" class="block text-sm font-medium text-accent mb-2"
                >{t('order.carrier')}</label
              >
              <select
                id="carrier-select"
                bind:value={shippingData.carrier}
                on:change={() => shippingData.carrier === 'YANDEX_DELIVERY' && runYandexFlow()}
                class="shipping-modal-btn-secondary w-full px-4 py-2.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-accent"
              >
                {#each availableCarriers as carrier}
                  <option value={carrier.value} disabled={!carrier.enabled}>
                    {carrier.label}
                  </option>
                {/each}
              </select>
              <p class="text-xs text-accent-muted mt-1.5">{t('order.carrierDescription')}</p>
            </div>

            {#if shippingData.carrier === 'YANDEX_DELIVERY'}
              <!-- Yandex: geocode, cost, create -->
              <div
                class="shipping-modal-card border-t border-gray-200 dark:border-white/10 pt-5 space-y-4"
              >
                {#if yandexClaimId}
                  <div
                    class="shipping-modal-card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4"
                  >
                    <p class="text-green-800 dark:text-green-200 font-medium text-sm">
                      {t('yandexDelivery.orderCreated')}
                    </p>
                    <p class="text-xs text-green-600 dark:text-green-300 mt-1">
                      {t('yandexDelivery.claimId')}: {yandexClaimId}
                    </p>
                  </div>
                {:else}
                  <!-- Geocoding Address -->
                  {#if !geocodeResult}
                    <div>
                      <p class="block text-sm font-medium text-accent mb-2">
                        {t('yandexDelivery.geocodeAddress')}
                      </p>
                      {#if selectedOrder.shippingAddress}
                        <div
                          class="shipping-modal-card mb-3 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                        >
                          <p class="text-sm text-accent">
                            <strong>{t('yandexDelivery.address')}:</strong>
                            {selectedOrder.shippingAddress.address}
                          </p>
                          <p class="text-sm text-accent">
                            <strong>{t('yandexDelivery.city')}:</strong>
                            {selectedOrder.shippingAddress.city}
                          </p>
                        </div>
                        <button
                          type="button"
                          on:click={geocodeShippingAddress}
                          disabled={geocodingAddress}
                          class="shipping-modal-btn-primary w-full px-4 py-2.5 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                          {#if geocodingAddress}
                            {t('yandexDelivery.geocoding')}
                          {:else}
                            {t('yandexDelivery.geocodeButton')}
                          {/if}
                        </button>
                      {:else}
                        <p class="text-red-500 dark:text-red-400 text-sm">
                          {t('yandexDelivery.addressNotSpecified')}
                        </p>
                      {/if}
                    </div>
                  {:else}
                    <!-- Geocode Result -->
                    <div
                      class="shipping-modal-card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3"
                    >
                      <p class="text-sm text-green-800 dark:text-green-200">
                        <strong>Address:</strong>
                        {geocodeResult.formatted_address}
                      </p>
                      <p class="text-xs text-green-600 dark:text-green-300 mt-1">
                        Coordinates: {geocodeResult.coordinates.lat.toFixed(6)}, {geocodeResult.coordinates.lon.toFixed(
                          6
                        )}
                      </p>
                    </div>

                    <!-- Pickup Points -->
                    <div>
                      <label
                        for="pickupPointSelect"
                        class="block text-sm font-medium text-accent mb-2"
                        >{t('yandexDelivery.pickupPoints')}</label
                      >
                      {#if loadingPickupPoints}
                        <p class="text-sm text-accent-muted">
                          {t('yandexDelivery.searchingPickupPoints')}
                        </p>
                      {:else if pickupPoints.length === 0}
                        <button
                          type="button"
                          on:click={findNearestPickupPoints}
                          class="shipping-modal-btn-primary w-full px-4 py-2.5 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                        >
                          {t('yandexDelivery.findNearestPickupPoints')}
                        </button>
                      {:else}
                        <select
                          id="pickupPointSelect"
                          bind:value={selectedPickupPoint}
                          class="shipping-modal-btn-secondary w-full px-4 py-2.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-accent"
                        >
                          <option value={null}>{t('yandexDelivery.deliveryToAddress')}</option>
                          {#each pickupPoints as point}
                            <option value={point}>
                              {point.name} - {point.address}
                              {point.distance ? `(${(point.distance / 1000).toFixed(1)} km)` : ''}
                            </option>
                          {/each}
                        </select>
                      {/if}
                    </div>

                    <!-- Calculate Cost -->
                    <div>
                      <button
                        type="button"
                        on:click={calculateYandexDeliveryCost}
                        disabled={calculatingCost}
                        class="shipping-modal-btn-primary w-full px-4 py-2.5 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {#if calculatingCost}
                          {t('yandexDelivery.calculatingCost')}
                        {:else}
                          {t('yandexDelivery.calculateCost')}
                        {/if}
                      </button>
                    </div>

                    <!-- Delivery Offers -->
                    {#if deliveryOffers.length > 0}
                      <div>
                        <p class="block text-sm font-medium text-accent mb-2">
                          {t('yandexDelivery.deliveryOptions')}
                        </p>
                        <div class="space-y-2">
                          {#each deliveryOffers as offer}
                            <label
                              class="shipping-modal-card flex items-center p-3 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors {selectedOffer?.offer_id ===
                              offer.offer_id
                                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                : ''}"
                            >
                              <input
                                type="radio"
                                bind:group={selectedOffer}
                                value={offer}
                                class="mr-3"
                              />
                              <div class="flex-1">
                                <p class="font-medium text-accent">
                                  {offer.price}
                                  {offer.currency}
                                </p>
                                {#if offer.estimated_delivery_time}
                                  <p class="text-xs text-accent-muted">
                                    {t('yandexDelivery.deliveryTime')}: {offer.estimated_delivery_time}
                                  </p>
                                {/if}
                                {#if offer.pickup_point}
                                  <p class="text-xs text-accent-muted">
                                    {t('yandexDelivery.pickupPoint')}: {offer.pickup_point.name}
                                  </p>
                                {/if}
                              </div>
                            </label>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    <!-- Create Claim -->
                    {#if selectedOffer}
                      <button
                        type="button"
                        on:click={createYandexDeliveryClaim}
                        disabled={creatingYandexClaim}
                        class="shipping-modal-btn-primary w-full px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        {#if creatingYandexClaim}
                          {t('yandexDelivery.creatingOrder')}
                        {:else}
                          {t('yandexDelivery.createDeliveryOrder')}
                        {/if}
                      </button>
                    {/if}
                  {/if}
                {/if}
              </div>
            {:else}
              <!-- Manual: Tracking number → Verify → Estimated → Notes → Save -->
              <div
                class="shipping-modal-card border-t border-gray-200 dark:border-white/10 pt-5 space-y-5"
              >
                <p class="text-sm font-medium text-accent-muted">
                  {t('order.manualEntrySectionTitle')}
                </p>
                <div>
                  <label for="tracking-number" class="block text-sm font-medium text-accent mb-2"
                    >{t('order.trackingNumberLabel')}</label
                  >
                  <input
                    id="tracking-number"
                    type="text"
                    bind:value={shippingData.trackingNumber}
                    class="shipping-modal-btn-secondary w-full px-4 py-2.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-accent"
                    placeholder="1234567890"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    on:click={verifyTrackingOnly}
                    disabled={verifyingTracking ||
                      !shippingData.trackingNumber?.trim() ||
                      !shippingData.carrier ||
                      shippingData.carrier === 'MANUAL'}
                    class="shipping-modal-btn-primary w-full px-4 py-2.5 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {#if verifyingTracking}
                      {t('order.checkingTracking')}...
                    {:else}
                      {t('order.verifyTracking')}
                    {/if}
                  </button>
                  {#if trackingVerificationResult}
                    <div
                      class="shipping-modal-card mt-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm space-y-2"
                    >
                      <p class="font-medium text-green-800 dark:text-green-200">
                        {t('order.trackingVerified')}
                      </p>
                      {#if trackingVerificationResult.statusDescription}
                        <p class="text-accent text-sm">
                          <strong>{t('order.trackingInstructions')}:</strong>
                          {trackingVerificationResult.statusDescription}
                        </p>
                      {/if}
                      {#if trackingVerificationResult.trackingUrl}
                        <p class="text-sm">
                          <strong>{t('order.trackingLink')}:</strong>
                          <a
                            href={trackingVerificationResult.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-accent underline"
                            >{trackingVerificationResult.trackingUrl}</a
                          >
                        </p>
                      {/if}
                      {#if trackingVerificationResult.estimatedDelivery}
                        <p class="text-sm">
                          <strong>{t('order.estimatedDelivery')}:</strong>
                          {trackingVerificationResult.estimatedDelivery}
                        </p>
                      {/if}
                    </div>
                  {/if}
                </div>

                <div>
                  <label for="estimated-delivery" class="block text-sm font-medium text-accent mb-2"
                    >{t('order.estimatedDelivery')}</label
                  >
                  <input
                    id="estimated-delivery"
                    type="date"
                    bind:value={shippingData.estimatedDelivery}
                    class="shipping-modal-btn-secondary w-full px-4 py-2.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-accent"
                  />
                </div>

                <div>
                  <label for="shipping-notes" class="block text-sm font-medium text-accent mb-2"
                    >{t('order.shippingNotes')}</label
                  >
                  <textarea
                    id="shipping-notes"
                    bind:value={shippingData.notes}
                    class="shipping-modal-btn-secondary w-full px-4 py-2.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-accent resize-y min-h-[80px]"
                    rows="3"
                    placeholder={t('order.shippingNotesPlaceholder')}
                  ></textarea>
                </div>

                <p class="text-xs text-accent-muted">{t('order.afterVerifyNoteAndSave')}</p>

                <div class="flex gap-3 pt-1">
                  <button
                    type="button"
                    on:click={saveShipping}
                    disabled={checkingTracking}
                    class="shipping-modal-btn-primary flex-1 px-5 py-2.5 bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {#if checkingTracking}
                      {t('order.checkingTracking')}...
                    {:else}
                      {t('common.save')}
                    {/if}
                  </button>
                  <button
                    type="button"
                    on:click={() => (showShippingModal = false)}
                    class="shipping-modal-btn-secondary px-5 py-2.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 text-accent hover:bg-gray-50 dark:hover:bg-white/15 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
