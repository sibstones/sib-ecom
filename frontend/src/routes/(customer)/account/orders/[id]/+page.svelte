<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { customerApi, type Order } from '$lib/api/customer.api';
  import { paymentRequestApi, type PaymentRequest } from '$lib/api/payment-request.api';
  import { paymentGatewayApi, type PaymentGateway } from '$lib/api/payment-gateway.api';
  import { stripeApi } from '$lib/api/stripe.api';
  import { ticketApi } from '$lib/api/ticket.api';
  import {
    returnApi,
    type ReturnRequest,
    type CreateReturnRequestDto,
    type ReturnReason,
  } from '$lib/api/return.api';
  import {
    yandexDeliveryApi,
    type YandexPickupPoint,
    type YandexDeliveryClaim,
  } from '$lib/api/yandex-delivery.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { confirm } from '$lib/utils/dialog.utils';
  import { formatSizeForDisplay } from '$lib/utils/size.utils';
  import { formatOrderAmount, formatPrice } from '$lib/utils/price.utils';
  import { t } from '$lib/utils/i18n';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { getCountryCode, getCurrencyForCountry } from '$lib/utils/country.utils';
  import { isOnlinePaymentGatewayType } from '$lib/constants/payment-gateway';
  import { resolvePaymentInstruction } from '$lib/utils/payment-gateway';
  import {
    buildManagerChatAppLink,
    buildManagerChatLink,
    hasManagerChatContact,
    type ManagerChatChannel,
  } from '$lib/utils/manager-chat';
  import OrderQRCode from '$lib/components/OrderQRCode.svelte';
  import OrderQRCodeInline from '$lib/components/OrderQRCodeInline.svelte';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { browser } from '$app/environment';

  /** Accept params from SvelteKit so the framework does not warn about unknown prop (use $page.params when needed). */
  export let params: Record<string, string> = {};
  function consumeValue(..._values: unknown[]) {}
  consumeValue(params);

  let order: Order | null = null;
  let paymentRequest: PaymentRequest | null = null;
  let loading = true;
  let error = '';
  let markingAsPaid = false;
  let processingStripePayment = false;
  let showTicketModal = false;
  let creatingTicket = false;
  let ticketSubject = '';
  let ticketMessage = '';
  let updateTrigger = 0; // Force reactivity

  // Return request modal
  let showReturnModal = false;
  let creatingReturn = false;
  let returnReason: ReturnReason = 'CUSTOMER_REQUESTED';
  let returnCustomerNotes = '';
  let returnItems: Array<{
    orderItemId: string;
    quantity: number;
    itemStatus: 'WRITE_OFF' | 'RETURN_TO_SALE';
  }> = [];
  let existingReturnRequest: ReturnRequest | null = null;

  // Track dialog state to prevent closing return modal when confirmation dialog is open
  let isDialogOpen = false;

  // QR Code display
  let showQRCodeInline = false;
  let showQRCodeModal = false;
  let isMobile = false;

  function checkMobile() {
    if (!browser) return;
    isMobile = window.innerWidth < 768;
  }

  function toggleQRCode() {
    if (isMobile) {
      showQRCodeModal = true;
      showQRCodeInline = false;
    } else {
      showQRCodeInline = !showQRCodeInline;
      showQRCodeModal = false;
    }
  }

  $: qrCodeVisible = !isMobile && showQRCodeInline;

  // Payment method change modal
  let showPaymentMethodModal = false;
  let changingPaymentMethod = false;
  let selectedPaymentMethod:
    | 'GATEWAY'
    | 'BANK_TRANSFER'
    | 'CASH_ON_DELIVERY'
    | 'MANAGER_CHAT'
    | null = null;

  // Yandex Delivery info
  let yandexClaim: YandexDeliveryClaim | null = null;
  let loadingYandexClaim = false;
  let pickupPoint: YandexPickupPoint | null = null;
  let availableGateways: PaymentGateway[] = [];
  let loadingGateways = false;

  function getGatewayInstruction(gateways: PaymentGateway[], type: string): string {
    const gateway = gateways.find(
      (item) => String(item.type || '').toUpperCase() === type.toUpperCase()
    );
    return resolvePaymentInstruction(gateway?.config, $i18nStore);
  }

  function getManagerChatGateway(gateways: PaymentGateway[]): PaymentGateway | undefined {
    return gateways.find((item) => String(item.type || '').toUpperCase() === 'MANAGER_CHAT');
  }

  $: orderId = $page.params?.id;

  // Reactive computed values for payment request status
  $: showPaymentButton = paymentRequest?.status === 'PENDING' && !paymentRequest?.paidAt;
  $: showPaymentConfirmed = paymentRequest?.status === 'PENDING' && !!paymentRequest?.paidAt;
  $: showPaymentPaid = paymentRequest?.status === 'PAID';

  // Check if payment method can be changed (order not paid)
  $: canChangePaymentMethod = order && order.paymentStatus !== 'PAID';

  // Check if Stripe payment button should be shown (hide when order cancelled or refunded)
  $: showStripePaymentButton =
    order &&
    order.paymentMethod === 'GATEWAY' &&
    order.paymentStatus !== 'PAID' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'REFUNDED';

  // Check if return can be requested
  $: canRequestReturn =
    order &&
    (order.status === 'DELIVERED' ||
      order.status === 'SHIPPED' ||
      order.status === 'PROCESSING' ||
      order.status === 'CONFIRMED') &&
    !existingReturnRequest &&
    order.paymentStatus === 'PAID';

  /** Active payment methods from backend (same logic as checkout). */
  $: cardPaymentAvailable = availableGateways.some((g) => {
    return isOnlinePaymentGatewayType(g.type);
  });
  $: bankTransferAvailable = availableGateways.some(
    (g) => String(g.type || '').toUpperCase() === 'BANK_TRANSFER'
  );
  $: cashOnDeliveryAvailable = availableGateways.some(
    (g) => String(g.type || '').toUpperCase() === 'CASH_ON_DELIVERY'
  );
  $: managerChatGateway = getManagerChatGateway(availableGateways);
  $: managerChatTelegramAvailable = hasManagerChatContact(managerChatGateway?.config, 'telegram');
  $: managerChatWhatsappAvailable = hasManagerChatContact(managerChatGateway?.config, 'whatsapp');
  $: managerChatWechatAvailable = hasManagerChatContact(managerChatGateway?.config, 'wechat');
  $: managerChatMaxAvailable = hasManagerChatContact(managerChatGateway?.config, 'max');
  $: managerChatAvailable =
    !!managerChatGateway &&
    (managerChatTelegramAvailable ||
      managerChatWhatsappAvailable ||
      managerChatWechatAvailable ||
      managerChatMaxAvailable);
  $: managerChatInstruction = getGatewayInstruction(availableGateways, 'MANAGER_CHAT');
  $: cashOnDeliveryInstruction = getGatewayInstruction(availableGateways, 'CASH_ON_DELIVERY');
  $: hasPriceOnRequestItems = !!order?.items?.some((item) => item.price == null);

  /** When modal is open and gateways loaded, ensure selected method is one of the available. */
  $: if (showPaymentMethodModal && !loadingGateways) {
    if (selectedPaymentMethod === 'GATEWAY' && !cardPaymentAvailable) {
      selectedPaymentMethod = bankTransferAvailable
        ? 'BANK_TRANSFER'
        : cashOnDeliveryAvailable
          ? 'CASH_ON_DELIVERY'
          : managerChatAvailable
            ? 'MANAGER_CHAT'
            : null;
    } else if (selectedPaymentMethod === 'BANK_TRANSFER' && !bankTransferAvailable) {
      selectedPaymentMethod = cardPaymentAvailable
        ? 'GATEWAY'
        : cashOnDeliveryAvailable
          ? 'CASH_ON_DELIVERY'
          : managerChatAvailable
            ? 'MANAGER_CHAT'
            : null;
    } else if (selectedPaymentMethod === 'CASH_ON_DELIVERY' && !cashOnDeliveryAvailable) {
      selectedPaymentMethod = cardPaymentAvailable
        ? 'GATEWAY'
        : bankTransferAvailable
          ? 'BANK_TRANSFER'
          : managerChatAvailable
            ? 'MANAGER_CHAT'
            : null;
    } else if (selectedPaymentMethod === 'MANAGER_CHAT' && !managerChatAvailable) {
      selectedPaymentMethod = cardPaymentAvailable
        ? 'GATEWAY'
        : bankTransferAvailable
          ? 'BANK_TRANSFER'
          : cashOnDeliveryAvailable
            ? 'CASH_ON_DELIVERY'
            : null;
    }
  }

  $: hasAnyPaymentMethodAvailable =
    cardPaymentAvailable ||
    bankTransferAvailable ||
    cashOnDeliveryAvailable ||
    managerChatAvailable;

  /** Primary card gateway for payment button label (YooKassa, Stripe, etc.) */
  $: primaryCardGateway = availableGateways.find((g) => isOnlinePaymentGatewayType(g.type));

  let isInitialLoad = true;
  let dialogUnsubscribe: (() => void) | null = null;
  let paymentStatusPollInterval: ReturnType<typeof setInterval> | null = null;
  const PAYMENT_STATUS_POLL_MS = 5000;
  const PAYMENT_STATUS_POLL_MAX_DURATION_MS = 60000; // Stop after 1 min

  async function loadOrderData() {
    if (!orderId) {
      error = t('orderDetail.orderIdRequired');
      loading = false;
      return;
    }

    loading = true;
    error = '';
    order = null;
    paymentRequest = null;
    existingReturnRequest = null;

    try {
      const [orderResponse, paymentRequestResponse, returnRequestsResponse] = await Promise.all([
        customerApi.getOrder(orderId),
        paymentRequestApi.getByOrderId(orderId).catch(() => null),
        returnApi.getMyReturnRequests().catch(() => ({ returnRequests: [] })),
      ]);
      order = orderResponse.order;
      if (
        order &&
        (order.paymentMethod === 'GATEWAY' || order.paymentMethod === 'MANAGER_CHAT') &&
        order.paymentStatus !== 'PAID'
      ) {
        const countryCode = order.shippingAddress?.country
          ? getCountryCode(order.shippingAddress.country)
          : 'US';
        const orderCurrency = (order as { currency?: string }).currency;
        const currency = orderCurrency?.trim().toUpperCase() || getCurrencyForCountry(countryCode);
        try {
          const gwRes = await paymentGatewayApi.getForCheckout(countryCode, currency);
          availableGateways = Array.isArray(gwRes.gateways) ? gwRes.gateways : [];
        } catch {
          availableGateways = [];
        }
      }
      if (paymentRequestResponse) {
        paymentRequest = paymentRequestResponse.request;

        // Extract pickup point from saved logisticsInfo if available
        if (paymentRequest.logisticsInfo?.pickupPoint) {
          pickupPoint = paymentRequest.logisticsInfo.pickupPoint as any;
        }

        // Load Yandex Delivery claim info if exists (to get latest status and tracking URL)
        if (paymentRequest.logisticsInfo?.yandexDeliveryClaimId) {
          await loadYandexClaimInfo(paymentRequest.logisticsInfo.yandexDeliveryClaimId);
        }
      }
      // Check if there's an existing return request for this order
      if (returnRequestsResponse.returnRequests) {
        existingReturnRequest =
          returnRequestsResponse.returnRequests.find((r: ReturnRequest) => r.orderId === orderId) ||
          null;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t('order.failedToLoad');
    } finally {
      loading = false;
      isInitialLoad = false;
    }
  }

  /** Refetch order to update payment status (e.g. after webhook from YooKassa). */
  async function refetchOrderPaymentStatus() {
    if (!orderId || !order) return;
    try {
      const res = await customerApi.getOrder(orderId);
      if (res.order && res.order.paymentStatus !== order.paymentStatus) {
        order = res.order;
        if (order.paymentStatus === 'PAID') {
          stopPaymentStatusPolling();
        }
      }
    } catch {
      // Ignore refetch errors
    }
  }

  function startPaymentStatusPolling() {
    stopPaymentStatusPolling();
    const startedAt = Date.now();
    paymentStatusPollInterval = setInterval(async () => {
      if (Date.now() - startedAt > PAYMENT_STATUS_POLL_MAX_DURATION_MS) {
        stopPaymentStatusPolling();
        return;
      }
      await refetchOrderPaymentStatus();
    }, PAYMENT_STATUS_POLL_MS);
  }

  function stopPaymentStatusPolling() {
    if (paymentStatusPollInterval) {
      clearInterval(paymentStatusPollInterval);
      paymentStatusPollInterval = null;
    }
  }

  // Load data on mount
  onMount(() => {
    checkMobile();
    if (browser) {
      window.addEventListener('resize', checkMobile);
    }
    loadOrderData();
    // Subscribe to dialog store to track when confirmation dialog is open
    dialogUnsubscribe = dialogStore.subscribe((state) => {
      isDialogOpen = state.isOpen;
    });
  });

  // Cleanup subscription on destroy
  onDestroy(() => {
    if (browser) {
      window.removeEventListener('resize', checkMobile);
    }
    if (dialogUnsubscribe) {
      dialogUnsubscribe();
    }
    stopPaymentStatusPolling();
  });

  // Poll payment status when order is GATEWAY + PENDING (user may have just paid; webhook can be delayed)
  $: if (
    order &&
    order.paymentMethod === 'GATEWAY' &&
    order.paymentStatus === 'PENDING' &&
    !loading
  ) {
    startPaymentStatusPolling();
  } else {
    stopPaymentStatusPolling();
  }

  // Reactively reload data when orderId changes (e.g., navigation between orders)
  // Skip on initial load to avoid double loading
  $: if (orderId && !isInitialLoad) {
    loadOrderData();
  }

  async function loadYandexClaimInfo(claimId: string) {
    loadingYandexClaim = true;
    try {
      const result = await yandexDeliveryApi.getClaimInfo(claimId);
      yandexClaim = result.claim;

      // Extract pickup point info if available
      if (result.claim.pickup_point) {
        pickupPoint = result.claim.pickup_point;
      } else if (paymentRequest?.logisticsInfo?.pickupPointId) {
        // Try to get pickup point info from saved data
        // In future, we can add API endpoint to get pickup point by ID
        pickupPoint = null; // Will be handled by backend if needed
      }
    } catch (error) {
      console.error('Failed to load Yandex claim info:', error);
      // Don't show error to user, just log it
    } finally {
      loadingYandexClaim = false;
    }
  }

  // Helper function to convert value to number
  function toNumber(value: number | string | any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    // Handle Prisma Decimal or other types
    if (value && typeof value === 'object' && 'toNumber' in value) {
      return value.toNumber();
    }
    return Number(value) || 0;
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

  function getStatusColor(status: string) {
    return 'text-black';
  }

  function formatStatus(status: string) {
    const statusMap: Record<string, string> = {
      PENDING: t('order.pending'),
      CONFIRMED: t('order.confirmed'),
      PROCESSING: t('order.processing'),
      SHIPPED: t('order.shipped'),
      DELIVERED: t('order.delivered'),
      CANCELLED: t('order.cancelled'),
      REFUNDED: t('order.refunded') || status,
      RETURN_REQUESTED: t('orderDetail.returnRequested') || 'Return Requested',
      RETURNED: t('orderDetail.returned') || 'Returned',
      AWAITING_CONFIRMATION: t('order.awaitingConfirmation') || status.replace(/_/g, ' '),
    };
    return statusMap[status] || status.replace(/_/g, ' ');
  }

  function formatNotes(notes: string | null | undefined, status?: string): string {
    if (!notes) return '';

    // Check if notes is a translation key (starts with common prefixes)
    if (notes.startsWith('orderDetail.') || notes.startsWith('order.')) {
      // Try to translate with status parameter if provided and translation template contains placeholder
      const translationTemplate = t(notes);
      if (status && translationTemplate.includes('{status}')) {
        const translatedStatus = formatStatus(status);
        return t(notes, { status: translatedStatus });
      }
      // Try to translate the key without parameters
      // If translation exists and is different from the key, return it
      if (translationTemplate !== notes) {
        return translationTemplate;
      }
    }

    // Check for "Return requested: REASON" pattern and translate it
    const returnRequestedPattern = /^(?:RETURN REQUESTED|Return requested):\s*(.+)$/i;
    const match = notes.match(returnRequestedPattern);
    if (match) {
      const reasonCode = match[1].trim();
      let translatedReason = reasonCode;

      // Translate the reason code
      if (reasonCode === 'PRODUCT_NOT_DELIVERED') {
        translatedReason = t('orderDetail.reasonProductNotDelivered');
      } else if (reasonCode === 'CUSTOMER_NOT_RECEIVED') {
        translatedReason = t('orderDetail.reasonCustomerNotReceived');
      } else if (reasonCode === 'CUSTOMER_REQUESTED') {
        translatedReason = t('orderDetail.reasonCustomerRequested');
      }

      return t('orderDetail.returnRequestedNote', { reason: translatedReason });
    }

    // If not a translation key or translation not found, return as is (for custom notes)
    return notes;
  }

  function handleImageError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) fallback.classList.remove('hidden');
  }

  async function handleMarkAsPaid() {
    if (!paymentRequest || !orderId) return;

    const confirmed = await confirm(
      t('orderDetail.confirmPaymentMessage'),
      t('orderDetail.confirmPaymentTitle'),
      t('orderDetail.yesIPaid'),
      t('profile.cancel')
    );

    if (!confirmed) return;

    markingAsPaid = true;
    try {
      const response = await paymentRequestApi.markAsPaidByOrderId(orderId);

      // Create a completely new object to force reactivity
      const updatedRequest: PaymentRequest = JSON.parse(
        JSON.stringify({
          ...response.request,
          paidAt: response.request.paidAt || undefined,
        })
      );

      // Clear first to force reactivity, then set new value
      paymentRequest = null;
      await new Promise((resolve) => setTimeout(resolve, 10));
      paymentRequest = updatedRequest;

      // Force reactivity update
      updateTrigger++;

      // Reload order to get updated payment status
      const orderResponse = await customerApi.getOrder(orderId);
      order = orderResponse.order;

      // Force a reactive update by triggering a re-render
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update again to ensure reactivity
      updateTrigger++;

      notificationStore.success(t('orderDetail.paymentThankYou'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('orderDetail.failedToMarkAsPaid'));
    } finally {
      markingAsPaid = false;
    }
  }

  async function handleCreateTicket(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!orderId || !ticketSubject.trim() || !ticketMessage.trim()) {
      notificationStore.error(t('orderDetail.pleaseFillAllFields'));
      return;
    }

    creatingTicket = true;
    try {
      await ticketApi.createTicket({
        orderId,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
      });
      notificationStore.success(t('orderDetail.ticketCreatedSuccess'));
      showTicketModal = false;
      ticketSubject = '';
      ticketMessage = '';
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('orderDetail.failedToCreateTicket')
      );
    } finally {
      creatingTicket = false;
    }
  }

  async function openPaymentMethodModal() {
    if (!order) return;

    showPaymentMethodModal = true;
    selectedPaymentMethod =
      order.paymentMethod === 'GATEWAY' ||
      order.paymentMethod === 'BANK_TRANSFER' ||
      order.paymentMethod === 'CASH_ON_DELIVERY' ||
      order.paymentMethod === 'MANAGER_CHAT'
        ? order.paymentMethod
        : null;

    const countryCode = order.shippingAddress?.country
      ? getCountryCode(order.shippingAddress.country)
      : 'US';
    const orderCurrency = (order as { currency?: string }).currency;
    const currency = orderCurrency?.trim().toUpperCase() || getCurrencyForCountry(countryCode);

    loadingGateways = true;
    try {
      const response = await paymentGatewayApi.getForCheckout(countryCode, currency);
      availableGateways = Array.isArray(response.gateways) ? response.gateways : [];
    } catch (e) {
      console.error('Failed to load payment gateways:', e);
      availableGateways = [];
    } finally {
      loadingGateways = false;
    }
  }

  async function handlePayWithGateway() {
    if (!orderId || !order) return;

    processingStripePayment = true;
    try {
      // Refetch order: webhook may have marked it PAID while user was on page
      const fresh = await customerApi.getOrder(orderId);
      if (fresh.order?.paymentStatus === 'PAID') {
        order = fresh.order;
        notificationStore.success(t('orderDetail.orderAlreadyPaid'));
        processingStripePayment = false;
        return;
      }
      const countryCode = order.shippingAddress?.country
        ? getCountryCode(order.shippingAddress.country)
        : 'US';
      const orderCurrency = (order as { currency?: string }).currency;
      const currency = orderCurrency?.trim().toUpperCase() || getCurrencyForCountry(countryCode);
      const res = await paymentGatewayApi.getForCheckout(countryCode, currency);
      const gateways = res.gateways ?? [];
      const gateway = gateways.find((g) => isOnlinePaymentGatewayType(g.type));

      if (!gateway) {
        notificationStore.error(t('orderDetail.gatewayNotAvailable'));
        processingStripePayment = false;
        return;
      }

      if (gateway.type === 'STRIPE') {
        const checkoutSession = await stripeApi.createCheckoutSession(orderId);
        if (checkoutSession?.url) {
          window.location.href = checkoutSession.url;
          return;
        }
      } else if (gateway.type === 'YOOKASSA') {
        const { yookassaApi } = await import('$lib/api/yookassa.api');
        const { paymentId, url } = await yookassaApi.createPayment(orderId);
        if (url) {
          if (paymentId && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(`yookassa_payment_${orderId}`, paymentId);
          }
          window.location.href = url;
          return;
        }
      } else {
        notificationStore.error(t('orderDetail.gatewayNotAvailable'));
      }
    } catch (e) {
      console.error('Failed to start payment:', e);
      notificationStore.error(
        e instanceof Error ? e.message : t('orderDetail.failedToCreatePaymentSession')
      );
    } finally {
      processingStripePayment = false;
    }
  }

  async function handlePayWithStripe() {
    await handlePayWithGateway();
  }

  function handleContactManager(channel: ManagerChatChannel) {
    if (!order) return;
    const webLink = buildManagerChatLink(managerChatGateway?.config, channel, order, $i18nStore);
    if (!webLink) {
      notificationStore.error(t('orderDetail.managerChatUnavailable'));
      return;
    }

    const popup = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    const appLink = buildManagerChatAppLink(managerChatGateway?.config, channel, order, $i18nStore);

    if (popup) {
      popup.location.href = appLink || webLink;
      if (appLink && appLink !== webLink) {
        window.setTimeout(() => {
          try {
            if (!popup.closed) {
              popup.location.href = webLink;
            }
          } catch (_) {}
        }, 800);
      }
      return;
    }

    window.open(webLink, '_blank');
  }

  async function handleChangePaymentMethod() {
    if (!orderId || !selectedPaymentMethod) {
      notificationStore.error(t('orderDetail.pleaseSelectPaymentMethod'));
      return;
    }

    if (selectedPaymentMethod === order?.paymentMethod) {
      notificationStore.info(t('orderDetail.paymentMethodAlreadySelected'));
      showPaymentMethodModal = false;
      return;
    }

    if (selectedPaymentMethod === 'GATEWAY' && !cardPaymentAvailable) {
      notificationStore.error(t('orderDetail.gatewayNotAvailable'));
      return;
    }

    const methodName =
      selectedPaymentMethod === 'GATEWAY'
        ? t('orderDetail.paymentGateway')
        : selectedPaymentMethod === 'BANK_TRANSFER'
          ? t('order.bankTransfer')
          : selectedPaymentMethod === 'CASH_ON_DELIVERY'
            ? t('order.cashOnDelivery')
            : t('paymentGateway.managerChat');
    const confirmed = await confirm(
      `${t('orderDetail.changePaymentMethod')} ${methodName}?`,
      t('orderDetail.confirmPaymentMethodChange'),
      t('orderDetail.yesChange'),
      t('profile.cancel')
    );

    if (!confirmed) return;

    changingPaymentMethod = true;
    try {
      const response = await customerApi.updatePaymentMethod(orderId, selectedPaymentMethod);
      order = response.order;

      // Reload payment request - it might have been created/updated/cancelled
      try {
        const paymentRequestResponse = await paymentRequestApi.getByOrderId(orderId);
        paymentRequest = paymentRequestResponse.request;
      } catch (e) {
        // Payment request might not exist for GATEWAY, that's ok
        paymentRequest = null;
      }

      updateTrigger++;
      notificationStore.success(t('orderDetail.paymentMethodChangedSuccess'));
      showPaymentMethodModal = false;
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('orderDetail.failedToChangePaymentMethod')
      );
    } finally {
      changingPaymentMethod = false;
    }
  }

  function openReturnModal() {
    if (!order) return;

    showReturnModal = true;
    returnReason = 'CUSTOMER_REQUESTED';
    returnCustomerNotes = '';
    returnItems = order.items.map((item) => ({
      orderItemId: item.id,
      quantity: item.quantity,
      itemStatus: 'WRITE_OFF' as const,
    }));
  }

  async function createReturnRequest(e?: Event) {
    console.log('createReturnRequest called', {
      hasEvent: !!e,
      order: !!order,
      orderId,
      returnItemsLength: returnItems.length,
      creatingReturn,
      isDialogOpen,
    });

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!order || !orderId) {
      console.error('createReturnRequest: order or orderId is missing', { order, orderId });
      notificationStore.error(t('orderDetail.failedToCreateReturnRequest'));
      return;
    }

    // Check order status before creating return request
    if (
      order.status !== 'DELIVERED' &&
      order.status !== 'SHIPPED' &&
      order.status !== 'PROCESSING' &&
      order.status !== 'CONFIRMED'
    ) {
      console.warn('createReturnRequest: invalid order status', { status: order.status });
      notificationStore.error(`${t('orderDetail.returnRequestNotAvailable')} ${order.status}`);
      return;
    }

    // Check payment status
    if (order.paymentStatus !== 'PAID') {
      console.warn('createReturnRequest: order not paid', { paymentStatus: order.paymentStatus });
      notificationStore.error(
        `${t('orderDetail.returnRequestNotAvailable')} Order not paid. Payment status: ${order.paymentStatus}`
      );
      return;
    }

    // Check for existing return request
    if (existingReturnRequest) {
      console.warn('createReturnRequest: return request already exists');
      notificationStore.error('Return request for this order already exists');
      return;
    }

    if (returnItems.length === 0) {
      console.warn('createReturnRequest: no items selected');
      notificationStore.error(t('orderDetail.selectAtLeastOneItem'));
      return;
    }

      // Validation: check that all quantities are correct
    for (const returnItem of returnItems) {
      const orderItem = order.items.find((item) => item.id === returnItem.orderItemId);
      if (!orderItem) {
        console.error('createReturnRequest: item not found', {
          orderItemId: returnItem.orderItemId,
        });
        notificationStore.error(`Item ${returnItem.orderItemId} not found in order`);
        return;
      }
      if (returnItem.quantity > orderItem.quantity || returnItem.quantity < 1) {
        console.error('createReturnRequest: invalid quantity', {
          returnItem,
          orderItemQuantity: orderItem.quantity,
        });
        notificationStore.error(`Invalid quantity for item ${orderItem.product.name}`);
        return;
      }
    }

    const confirmed = await confirm(
      t('orderDetail.confirmReturnRequestMessage'),
      t('orderDetail.confirmReturnRequest'),
      t('orderDetail.yesRequestReturn'),
      t('common.cancel')
    );

    if (!confirmed) {
      console.log('createReturnRequest: user cancelled');
      return;
    }

    creatingReturn = true;
    try {
      const itemsWithStatus = returnItems.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        itemStatus: 'WRITE_OFF' as const,
      }));

      const data: CreateReturnRequestDto = {
        orderId,
        reason: returnReason,
        customerNotes: returnCustomerNotes || undefined,
        items: itemsWithStatus,
      };

      console.log('Creating return request with data:', JSON.stringify(data, null, 2));
      console.log('API endpoint: /customer/returns');

      const response = await returnApi.createReturnRequest(data);
      console.log('Return request created successfully:', response);

      if (!response || !response.returnRequest) {
        console.error('createReturnRequest: invalid response', response);
        throw new Error('Invalid response from server');
      }

      // Set the created request immediately
      existingReturnRequest = response.returnRequest;

      // Clear the form
      returnCustomerNotes = '';
      returnItems = [];

      // Close the modal window immediately after successful creation
      showReturnModal = false;

      // Show success notification
      notificationStore.success(t('orderDetail.returnRequestCreatedSuccess'));

      // Update order data in the background (do not block the modal window from closing)
      try {
        const orderResponse = await customerApi.getOrder(orderId);
        order = orderResponse.order;
      } catch (reloadError) {
        console.error('Error reloading order data:', reloadError);
        // Not critical, if reloading fails - the request has already been created
      }
    } catch (e) {
      console.error('Error creating return request:', e);
      let errorMessage = t('orderDetail.failedToCreateReturnRequest');

      if (e instanceof Error) {
        errorMessage = e.message;
        console.error('Error details:', {
          message: e.message,
          stack: e.stack,
          name: e.name,
        });
      } else if (typeof e === 'object' && e !== null && 'message' in e) {
        errorMessage = String(e.message);
      }

      notificationStore.error(errorMessage);
    } finally {
      creatingReturn = false;
    }
  }

  function toggleReturnItem(orderItemId: string) {
    const index = returnItems.findIndex((item) => item.orderItemId === orderItemId);
    if (index >= 0) {
      returnItems = returnItems.filter((item) => item.orderItemId !== orderItemId);
    } else {
      const orderItem = order?.items.find((item) => item.id === orderItemId);
      if (orderItem) {
        returnItems = [
          ...returnItems,
          {
            orderItemId: orderItem.id,
            quantity: orderItem.quantity,
            itemStatus: 'WRITE_OFF' as const,
          },
        ];
      }
    }
  }

  function updateReturnItemQuantity(orderItemId: string, quantity: number) {
    returnItems = returnItems.map((item) =>
      item.orderItemId === orderItemId
        ? {
            ...item,
            quantity: Math.max(
              1,
              Math.min(quantity, order?.items.find((i) => i.id === orderItemId)?.quantity || 1)
            ),
          }
        : item
    );
  }

  // Function removed - client cannot choose the item status
  // Status is set by the administrator when processing the request
</script>

<div class="min-w-0">
  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-white">{t('common.error')}: {error}</p>
  {:else if !order}
    <p class="text-accent-muted">{t('orderDetail.orderNotFound')}</p>
  {:else}
    <div class="space-y-6">
      <!-- Order Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div class="flex-1 min-w-0">
          <h2 class="text-2xl sm:text-3xl font-bold mb-2 break-words">
            {t('order.orderHash')}{order.orderNumber}
          </h2>
          <p class="text-accent-muted">{t('order.placedOn')} {formatDate(order.createdAt)}</p>
        </div>
        {#if showQRCodeInline && !isMobile}
          <div class="flex-shrink-0">
            <OrderQRCodeInline orderNumber={order.orderNumber} orderId={order.id} />
          </div>
        {/if}
      </div>

      <!-- QR Code Toggle Button -->
      <div class="flex justify-end">
        <button
          on:click={toggleQRCode}
          class="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm flex items-center justify-center gap-2"
          title={qrCodeVisible ? t('order.hideQRCode') : t('order.generateQRCode')}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {#if isMobile}
            {t('order.generateQRCode')}
          {:else}
            {qrCodeVisible ? t('order.hideQRCode') : t('order.generateQRCode')}
          {/if}
        </button>
      </div>

      <!-- Status -->
      <div class="bg-dark-light -sm p-6 border border-white/10">
        <div class="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <p class="text-sm text-accent-muted mb-1">{t('order.orderStatus')}</p>
            <p class="text-xl font-medium {getStatusColor(order.status)}">
              {formatStatus(order.status)}
            </p>
          </div>
          <div class="sm:text-right">
            <p class="text-sm text-accent-muted mb-1">{t('order.paymentStatusLabel')}</p>
            <p class="text-xl font-medium {getStatusColor(order.paymentStatus)}">
              {#if order.paymentStatus === 'PAID'}
                {formatStatus(order.paymentStatus)}
              {:else if paymentRequest && paymentRequest.status === 'PENDING' && paymentRequest.paidAt}
                {formatStatus('AWAITING_CONFIRMATION')}
              {:else}
                {formatStatus(order.paymentStatus)}
              {/if}
            </p>
            {#if order.paymentMethod === 'BANK_TRANSFER'}
              <p class="text-xs text-accent-muted mt-1">{t('order.bankTransfer')}</p>
            {:else if order.paymentMethod === 'P2P'}
              <p class="text-xs text-accent-muted mt-1">{t('order.p2pPayment')}</p>
            {:else if order.paymentMethod === 'CASH_ON_DELIVERY'}
              <p class="text-xs text-accent-muted mt-1">{t('order.cashOnDelivery')}</p>
            {:else if order.paymentMethod === 'MANAGER_CHAT'}
              <p class="text-xs text-accent-muted mt-1">{t('paymentGateway.managerChat')}</p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Card payment gateway (Stripe, YooKassa, CloudPayments) -->
      {#if showStripePaymentButton}
        <div class="bg-dark-light -sm p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('orderDetail.paymentRequired')}</h3>
          <p class="text-accent-muted mb-4">
            {#if primaryCardGateway?.type === 'YOOKASSA'}
              {t('orderDetail.yookassaPaymentInstructions')}
            {:else}
              {t('orderDetail.cardPaymentInstructions')}
            {/if}
          </p>
          <div class="flex gap-3">
            <button
              on:click={handlePayWithGateway}
              disabled={processingStripePayment}
              class="px-6 py-3 bg-white text-black font-medium -sm border border-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if processingStripePayment}
                {t('orderDetail.processing')}
              {:else if primaryCardGateway?.type === 'YOOKASSA'}
                {t('orderDetail.payWithYookassa')}
              {:else}
                {t('orderDetail.payWithCard')}
              {/if}
            </button>
            {#if canChangePaymentMethod}
              <button
                on:click={openPaymentMethodModal}
                class="px-6 py-3 bg-black border border-white/20 -sm hover:bg-accent-muted transition-colors text-white font-medium"
              >
                {t('orderDetail.changePaymentMethod')}
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Payment Request (bank transfer, P2P, cash on delivery) -->
      {#if paymentRequest && (order.paymentMethod === 'BANK_TRANSFER' || order.paymentMethod === 'P2P' || order.paymentMethod === 'CASH_ON_DELIVERY' || order.paymentMethod === 'MANAGER_CHAT')}
        <div class="bg-dark-light -sm p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('orderDetail.paymentInstructions')}</h3>
          {#if showPaymentButton || order.paymentMethod === 'CASH_ON_DELIVERY'}
            <div class="space-y-4">
              {#if order.paymentMethod === 'BANK_TRANSFER'}
                <p class="text-accent-muted">
                  {t('orderDetail.bankTransferInstructions')}
                </p>
                {#if paymentRequest.bankDetails}
                  <div class="bg-dark -sm p-4 space-y-2 border border-white/10">
                    <p>
                      <strong>{t('orderDetail.bankName')}:</strong>
                      {paymentRequest.bankDetails.bankName}
                    </p>
                    <p>
                      <strong>{t('orderDetail.accountName')}:</strong>
                      {paymentRequest.bankDetails.accountName}
                    </p>
                    <p>
                      <strong>{t('orderDetail.accountNumber')}:</strong>
                      {paymentRequest.bankDetails.accountNumber}
                    </p>
                    {#if paymentRequest.bankDetails.swiftCode}
                      <p>
                        <strong>{t('orderDetail.swiftCode')}:</strong>
                        {paymentRequest.bankDetails.swiftCode}
                      </p>
                    {/if}
                    {#if paymentRequest.bankDetails.iban}
                      <p>
                        <strong>{t('orderDetail.iban')}:</strong>
                        {paymentRequest.bankDetails.iban}
                      </p>
                    {/if}
                    {#if paymentRequest.bankDetails.routingNumber}
                      <p>
                        <strong>{t('orderDetail.routingNumber')}:</strong>
                        {paymentRequest.bankDetails.routingNumber}
                      </p>
                    {/if}
                    {#if paymentRequest.bankDetails.notes}
                      <p class="mt-2 text-sm text-accent-muted">
                        <strong>{t('orderDetail.notes')}:</strong>
                        {paymentRequest.bankDetails.notes}
                      </p>
                    {/if}
                  </div>
                {/if}
              {:else if order.paymentMethod === 'P2P'}
                <p class="text-accent-muted">
                  {t('orderDetail.p2pInstructions')}
                </p>
                {#if paymentRequest.p2pDetails}
                  <div class="bg-dark -sm p-4 space-y-2 border border-white/10">
                    {#if paymentRequest.p2pDetails.cardNumber}
                      <p>
                        <strong>{t('orderDetail.cardNumber')}:</strong>
                        {paymentRequest.p2pDetails.cardNumber}
                      </p>
                    {/if}
                    {#if paymentRequest.p2pDetails.cryptoWallet}
                      <p>
                        <strong>{t('orderDetail.cryptoWallet')}:</strong>
                        {paymentRequest.p2pDetails.cryptoWallet}
                      </p>
                      {#if paymentRequest.p2pDetails.blockchain}
                        <p>
                          <strong>{t('orderDetail.blockchain')}:</strong>
                          {paymentRequest.p2pDetails.blockchain}
                        </p>
                      {/if}
                    {/if}
                    {#if paymentRequest.p2pDetails.sbpPhone}
                      <p>
                        <strong>{t('orderDetail.sbpPhoneNumber')}:</strong>
                        {paymentRequest.p2pDetails.sbpPhone}
                      </p>
                    {/if}
                    {#if paymentRequest.p2pDetails.instruction}
                      <div class="mt-2">
                        <p><strong>{t('orderDetail.paymentInstruction')}:</strong></p>
                        <p class="whitespace-pre-wrap text-accent-muted">
                          {paymentRequest.p2pDetails.instruction}
                        </p>
                      </div>
                    {/if}
                  </div>
                {/if}
              {:else if order.paymentMethod === 'CASH_ON_DELIVERY'}
                <p class="text-accent-muted">
                  {cashOnDeliveryInstruction ||
                    paymentRequest.cashOnDeliveryDetails?.instruction ||
                    t('paymentGateway.cashOnDeliveryHint')}
                </p>
                {#if paymentRequest.cashOnDeliveryDetails?.instruction}
                  <div class="bg-dark -sm p-4 border border-white/10">
                    <p class="whitespace-pre-wrap text-accent-muted">
                      {paymentRequest.cashOnDeliveryDetails.instruction}
                    </p>
                  </div>
                {/if}
              {:else if order.paymentMethod === 'MANAGER_CHAT'}
                <p class="text-accent-muted">
                  {managerChatInstruction ||
                    paymentRequest.p2pDetails?.instruction ||
                    t('checkout.managerChatDescription')}
                </p>
                <div class="flex flex-wrap gap-3">
                  {#if managerChatTelegramAvailable}
                    <button
                      on:click={() => handleContactManager('telegram')}
                      class="px-6 py-3 bg-white text-black font-medium -sm border border-black hover:bg-gray-100 transition-colors"
                    >
                      {t('orderDetail.contactManagerTelegram')}
                    </button>
                  {/if}
                  {#if managerChatWhatsappAvailable}
                    <button
                      on:click={() => handleContactManager('whatsapp')}
                      class="px-6 py-3 bg-black border border-white/20 -sm hover:bg-accent-muted transition-colors text-white font-medium"
                    >
                      {t('orderDetail.contactManagerWhatsapp')}
                    </button>
                  {/if}
                  {#if managerChatWechatAvailable}
                    <button
                      on:click={() => handleContactManager('wechat')}
                      class="px-6 py-3 bg-[#07C160] text-white font-medium -sm hover:opacity-90 transition-opacity"
                    >
                      {t('orderDetail.contactManagerWechat')}
                    </button>
                  {/if}
                  {#if managerChatMaxAvailable}
                    <button
                      on:click={() => handleContactManager('max')}
                      class="px-6 py-3 bg-[#2563eb] text-white font-medium -sm hover:opacity-90 transition-opacity"
                    >
                      {t('orderDetail.contactManagerMax')}
                    </button>
                  {/if}
                </div>
              {/if}
              <p class="text-sm text-accent-muted">
                {t('orderDetail.paymentRequestSentOn')}{' '}
                {paymentRequest.notifiedAt
                  ? formatDate(paymentRequest.notifiedAt)
                  : formatDate(paymentRequest.createdAt)}
              </p>
              <div class="mt-4 flex gap-3">
                {#if order.paymentMethod !== 'CASH_ON_DELIVERY'}
                  <button
                    on:click={handleMarkAsPaid}
                    disabled={markingAsPaid}
                    class="px-6 py-3 bg-white text-black font-medium -sm border border-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {#if markingAsPaid}
                      {t('orderDetail.processing')}
                    {:else}
                      {t('orderDetail.iPaid')}
                    {/if}
                  </button>
                {/if}
                {#if canChangePaymentMethod}
                  <button
                    on:click={openPaymentMethodModal}
                    class="px-6 py-3 bg-black border border-white/20 -sm hover:bg-accent-muted transition-colors text-white font-medium"
                  >
                    {t('orderDetail.changePaymentMethod')}
                  </button>
                {/if}
              </div>
            </div>
          {:else if showPaymentConfirmed}
            <div class="space-y-2">
              <p class="text-black font-medium">{t('orderDetail.paymentConfirmedByClient')}</p>
              <p class="text-sm text-accent-muted">
                {t('orderDetail.awaitingShopConfirmation')}
                {paymentRequest.paidAt ? formatDate(String(paymentRequest.paidAt)) : 'N/A'}
              </p>
            </div>
          {:else if showPaymentPaid}
            <div class="space-y-2">
              <p class="text-black font-medium">{t('orderDetail.paymentConfirmedByShop')}</p>
              <p class="text-sm text-accent-muted">
                {t('orderDetail.paymentConfirmedOn')}
                {paymentRequest.paidAt ? formatDate(paymentRequest.paidAt) : 'N/A'}
              </p>
              {#if paymentRequest.logisticsInfo}
                <div class="mt-4 pt-4 border-t border-white/10">
                  <h4 class="font-medium mb-2">{t('orderDetail.shippingInformation')}</h4>
                  {#if paymentRequest.logisticsInfo.trackingNumber}
                    <p>
                      <strong>{t('order.trackingNumberLabel')}:</strong>
                      {paymentRequest.logisticsInfo.trackingNumber}
                    </p>
                  {/if}
                  {#if paymentRequest.logisticsInfo.carrier}
                    <p>
                      <strong>{t('order.carrier')}:</strong>
                      {paymentRequest.logisticsInfo.carrier}
                    </p>
                  {/if}
                  {#if paymentRequest.logisticsInfo.estimatedDelivery}
                    <p>
                      <strong>{t('order.estimatedDelivery')}:</strong>
                      {paymentRequest.logisticsInfo.estimatedDelivery}
                    </p>
                  {/if}

                  <!-- Yandex Delivery Tracking Link -->
                  {#if yandexClaim?.tracking_url}
                    <p class="mt-2">
                      <a
                        href={yandexClaim.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-400 hover:text-blue-300 underline"
                      >
                        {t('yandexDelivery.trackDelivery')} →
                      </a>
                    </p>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Order Items -->
      <div class="bg-dark-light -sm p-6 border border-white/10">
        <h3 class="text-xl font-medium mb-4">{t('orderDetail.orderItems')}</h3>
        <div class="space-y-4">
          {#each order.items as item}
            <div
              class="flex flex-col sm:flex-row gap-4 pb-4 border-b border-white/10 last:border-0"
            >
              <div
                class="w-20 sm:w-28 aspect-[9/16] bg-dark -sm overflow-hidden flex-shrink-0 border border-white/10 relative group"
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
              <div class="flex-1 min-w-0">
                <a href="/shop/product/{item.product.slug}">
                  <h4 class="text-lg font-medium mb-1 hover:text-accent-muted transition-colors">
                    {item.product.name}
                  </h4>
                </a>
                {#if item.variant}
                  <p class="text-sm text-accent-muted mb-2">{item.variant.name}</p>
                {/if}
                {#if item.size}
                  <p class="text-sm text-accent-muted mb-2">
                    <span class="font-semibold">{t('cart.size')}:</span>
                    {formatSizeForDisplay(item.size)}
                  </p>
                {/if}
                <p class="text-sm text-accent-muted">
                  {t('orderDetail.quantity')}: {item.quantity}
                </p>
              </div>
              <div class="sm:text-right flex-shrink-0">
                <p class="text-lg font-medium">
                  {formatOrderAmount(toNumber(item.price) * item.quantity, order)}
                </p>
                <p class="text-sm text-accent-muted">
                  {formatOrderAmount(toNumber(item.price), order)}
                  {t('orderDetail.each')}
                </p>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Yandex Delivery Pickup Point Information -->
      {#if paymentRequest?.logisticsInfo?.yandexDeliveryClaimId && (pickupPoint || yandexClaim?.pickup_point)}
        <div class="bg-blue-900/20 border-2 border-blue-500/50 rounded-lg p-6">
          <div class="flex items-start gap-3 mb-4">
            <div
              class="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-bold mb-2 text-blue-300">
                {t('yandexDelivery.orderReadyForPickup')}
              </h3>
              <p class="text-blue-200/80 mb-4">{t('yandexDelivery.orderDeliveredToPickupPoint')}</p>
            </div>
          </div>

          {#if pickupPoint || yandexClaim?.pickup_point}
            {@const point = pickupPoint || yandexClaim?.pickup_point}
            <div class="bg-dark-light rounded-lg p-4 space-y-3">
              <div>
                <h4 class="font-semibold text-lg mb-2">
                  {point?.name || t('yandexDelivery.pickupPointName')}
                </h4>
                <p class="text-accent-muted">
                  <strong>{t('yandexDelivery.address')}:</strong>
                  {point?.address}
                </p>
              </div>

              {#if point?.workingHours}
                <div>
                  <p class="text-accent-muted">
                    <strong>{t('yandexDelivery.workingHours')}:</strong>
                    {point.workingHours}
                  </p>
                </div>
              {/if}

              {#if point?.phone}
                <div>
                  <p class="text-accent-muted">
                    <strong>{t('yandexDelivery.phone')}:</strong>
                    <a href="tel:{point.phone}" class="text-blue-400 hover:text-blue-300 underline">
                      {point.phone}
                    </a>
                  </p>
                </div>
              {/if}

              {#if point?.distance}
                <div>
                  <p class="text-accent-muted">
                    <strong>{t('yandexDelivery.distance')}:</strong>
                    {(point.distance / 1000).toFixed(1)} km from delivery address
                  </p>
                </div>
              {/if}
            </div>

            <!-- Instructions -->
            <div class="mt-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <h4 class="font-semibold mb-3 text-yellow-300">
                {t('yandexDelivery.pickupInstructions')}:
              </h4>
              <ol class="list-decimal list-inside space-y-2 text-accent-muted">
                <li>{t('yandexDelivery.step1')}</li>
                <li>
                  {t('yandexDelivery.step2')}:
                  <strong class="text-white">#{order.orderNumber}</strong>
                </li>
                <li>{t('yandexDelivery.step3')}</li>
                <li>{t('yandexDelivery.step4')}</li>
              </ol>
            </div>

            <!-- Tracking Link -->
            {#if yandexClaim?.tracking_url}
              <div class="mt-4">
                <a
                  href={yandexClaim.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  {t('yandexDelivery.trackDelivery')}
                </a>
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Shipping Address -->
      {#if order.shippingAddress}
        <div class="bg-dark-light -sm p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('orderDetail.shippingAddress')}</h3>
          <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
          <p>{order.shippingAddress.address}</p>
          <p>
            {order.shippingAddress.city}, {order.shippingAddress.country}{' '}
            {order.shippingAddress.postalCode}
          </p>
          {#if order.shippingAddress.phone}
            <p class="mt-2">{t('orderDetail.phone')}: {order.shippingAddress.phone}</p>
          {/if}

          <!-- Show note if delivery is to address (not pickup point) -->
          {#if paymentRequest?.logisticsInfo?.yandexDeliveryClaimId && !pickupPoint && !yandexClaim?.pickup_point}
            <div class="mt-4 pt-4 border-t border-white/10">
              <p class="text-sm text-accent-muted">
                {t('yandexDelivery.deliveryToAddressNote')}
              </p>
              {#if yandexClaim?.tracking_url}
                <a
                  href={yandexClaim.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-block mt-2 text-blue-400 hover:text-blue-300 underline text-sm"
                >
                  {t('yandexDelivery.trackDelivery')} →
                </a>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Order Summary -->
      <div class="bg-dark-light -sm p-6 border border-white/10">
        <h3 class="text-xl font-medium mb-4">{t('orderDetail.orderSummary')}</h3>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-accent-muted">{t('common.subtotal')}</span>
            <span>{formatOrderAmount(toNumber(order.subtotal), order)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-accent-muted">{t('cart.tax')}</span>
            <span>{formatOrderAmount(toNumber(order.tax), order)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-accent-muted">{t('common.shipping')}</span>
            <span>{formatOrderAmount(toNumber(order.shipping), order)}</span>
          </div>
          <div class="flex justify-between text-xl font-bold pt-4 border-t border-white/10">
            <span>{t('common.total')}</span>
            <span>{formatOrderAmount(toNumber(order.total), order)}</span>
          </div>
          {#if hasPriceOnRequestItems}
            <p class="text-sm text-yellow-300 leading-relaxed pt-3">
              {t('cart.priceOnRequestTotalsNote')}
            </p>
          {/if}
        </div>
      </div>

      <!-- Status History -->
      {#if order.statusHistory && order.statusHistory.length > 0}
        <div class="bg-dark-light -sm p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('orderDetail.statusHistory')}</h3>
          <div class="space-y-3">
            {#each order.statusHistory as history}
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <p class="font-medium {getStatusColor(history.status)}">
                    {formatStatus(history.status)}
                    {#if history.status === 'RETURN_REQUESTED' && existingReturnRequest}
                      <span
                        class="ml-2 text-xs px-2 py-1 rounded
                        {existingReturnRequest.status === 'REQUESTED'
                          ? 'bg-yellow-100 text-yellow-800'
                          : ''}
                        {existingReturnRequest.status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-800'
                          : ''}
                        {existingReturnRequest.status === 'PROCESSING'
                          ? 'bg-purple-100 text-purple-800'
                          : ''}
                        {existingReturnRequest.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : ''}
                        {existingReturnRequest.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : ''}
                      "
                      >
                        ({existingReturnRequest.status === 'REQUESTED'
                          ? t('orderDetail.returnStatusRequested')
                          : ''}
                        {existingReturnRequest.status === 'APPROVED'
                          ? t('orderDetail.returnStatusApproved')
                          : ''}
                        {existingReturnRequest.status === 'PROCESSING'
                          ? t('orderDetail.returnStatusProcessing')
                          : ''}
                        {existingReturnRequest.status === 'COMPLETED'
                          ? t('orderDetail.returnStatusCompleted')
                          : ''}
                        {existingReturnRequest.status === 'REJECTED'
                          ? t('orderDetail.returnStatusRejected')
                          : ''})
                      </span>
                    {/if}
                  </p>
                  {#if history.notes}
                    <p class="text-sm text-accent-muted mt-1">
                      {formatNotes(history.notes, history.status)}
                    </p>
                  {/if}
                </div>
                <p class="text-sm text-accent-muted ml-4 whitespace-nowrap">
                  {formatDate(history.createdAt)}
                </p>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Return Request -->
      {#if existingReturnRequest}
        <div class="bg-dark-light -sm p-6 border border-white/10">
          <h3 class="text-xl font-medium mb-4">{t('orderDetail.returnRequest')}</h3>
          <div class="space-y-2">
            <p>
              <strong>{t('orderDetail.returnStatus')}</strong>
              <span
                class="px-2 py-1 rounded text-sm
                {existingReturnRequest.status === 'REQUESTED'
                  ? 'bg-yellow-100 text-yellow-800'
                  : ''}
                {existingReturnRequest.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' : ''}
                {existingReturnRequest.status === 'PROCESSING'
                  ? 'bg-purple-100 text-purple-800'
                  : ''}
                {existingReturnRequest.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : ''}
                {existingReturnRequest.status === 'REJECTED' ? 'bg-red-100 text-red-800' : ''}
              "
              >
                {existingReturnRequest.status === 'REQUESTED'
                  ? t('orderDetail.returnStatusRequested')
                  : ''}
                {existingReturnRequest.status === 'APPROVED'
                  ? t('orderDetail.returnStatusApproved')
                  : ''}
                {existingReturnRequest.status === 'PROCESSING'
                  ? t('orderDetail.returnStatusProcessing')
                  : ''}
                {existingReturnRequest.status === 'COMPLETED'
                  ? t('orderDetail.returnStatusCompleted')
                  : ''}
                {existingReturnRequest.status === 'REJECTED'
                  ? t('orderDetail.returnStatusRejected')
                  : ''}
              </span>
            </p>
            <p>
              <strong>{t('orderDetail.returnReason')}</strong>
              {existingReturnRequest.reason === 'PRODUCT_NOT_DELIVERED'
                ? t('orderDetail.reasonProductNotDelivered')
                : ''}
              {existingReturnRequest.reason === 'CUSTOMER_NOT_RECEIVED'
                ? t('orderDetail.reasonCustomerNotReceived')
                : ''}
              {existingReturnRequest.reason === 'CUSTOMER_REQUESTED'
                ? t('orderDetail.reasonCustomerRequested')
                : ''}
            </p>
            {#if existingReturnRequest.customerNotes}
              <p>
                <strong>{t('orderDetail.yourNotes')}</strong>
                {existingReturnRequest.customerNotes}
              </p>
            {/if}
            {#if existingReturnRequest.adminNotes}
              <p>
                <strong>{t('orderDetail.adminNotes')}</strong>
                {existingReturnRequest.adminNotes}
              </p>
            {/if}
            {#if existingReturnRequest.refundAmount}
              <p>
                <strong>{t('orderDetail.refundAmount')}</strong>
                ${existingReturnRequest.refundAmount.toFixed(2)}
              </p>
            {/if}
            {#if existingReturnRequest.refundMethod}
              <p>
                <strong>{t('orderDetail.refundMethod')}</strong>
                {existingReturnRequest.refundMethod}
              </p>
            {/if}
          </div>
        </div>
      {:else if canRequestReturn}
        <div class="bg-dark-light -sm p-6 border border-white/10">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-medium">{t('orderDetail.requestReturn')}</h3>
          </div>
          <p class="text-accent-muted mb-4">
            {t('orderDetail.returnRequestDescription')}
          </p>
          <button
            on:click={openReturnModal}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium"
          >
            {t('orderDetail.requestReturn')}
          </button>
        </div>
      {:else if order && (order.status === 'PENDING' || order.status === 'CONFIRMED')}
        <div class="bg-dark-light -sm p-6 border border-white/10">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-medium">{t('orderDetail.returnRequest')}</h3>
          </div>
          <p class="text-accent-muted">
            {t('orderDetail.returnRequestNotAvailable')} <strong>{order.status}</strong>
          </p>
        </div>
      {/if}

      <!-- Support Ticket -->
      <div class="bg-dark-light -sm p-6 border border-white/10">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-medium">{t('orderDetail.needHelp')}</h3>
        </div>
        <p class="text-accent-muted mb-4">
          {t('orderDetail.needHelpDescription')}
        </p>
        <button
          on:click={() => (showTicketModal = true)}
          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium"
        >
          {t('orderDetail.contactSupport')}
        </button>
      </div>
    </div>
  {/if}

  <!-- Return Request Modal -->
  {#if showReturnModal && order}
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      style={isDialogOpen ? 'pointer-events: none;' : ''}
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
    >
      <button
        type="button"
        class="absolute inset-0 h-full w-full cursor-default bg-transparent"
        aria-hidden="true"
        tabindex="-1"
        on:click={() => {
          if (!creatingReturn && !isDialogOpen) {
            showReturnModal = false;
          }
        }}
        on:keydown={(e) => {
          if (e.key === 'Escape' && !creatingReturn && !isDialogOpen) {
            showReturnModal = false;
          }
        }}
      ></button>
      <div
        class="relative z-10 bg-white border border-gray-300 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        role="document"
      >
        <div class="flex justify-between items-center mb-4">
          <h3 id="return-modal-title" class="text-xl font-bold">
            {t('orderDetail.requestReturn')}
          </h3>
          <button
            on:click={() => {
              // Don't close if dialog confirmation is open or return is being created
              if (!creatingReturn && !isDialogOpen) {
                showReturnModal = false;
              }
            }}
            class="text-accent-muted hover:text-accent text-2xl"
            disabled={creatingReturn || isDialogOpen}
          >
            ×
          </button>
        </div>

        <form
          on:submit|preventDefault={(e) => {
            console.log('Form submit event triggered', {
              creatingReturn,
              returnItemsLength: returnItems.length,
              isDialogOpen,
            });
            e.preventDefault();
            e.stopPropagation();
            if (!creatingReturn && !isDialogOpen) {
              createReturnRequest(e);
            } else {
              console.warn('Form submit blocked', { creatingReturn, isDialogOpen });
            }
          }}
          class="space-y-4"
        >
          <div>
            <label for="return-reason" class="block text-sm font-medium mb-2"
              >{t('orderDetail.reasonForReturn')}</label
            >
            <select
              id="return-reason"
              bind:value={returnReason}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              disabled={creatingReturn}
              required
            >
              <option value="PRODUCT_NOT_DELIVERED"
                >{t('orderDetail.reasonProductNotDelivered')}</option
              >
              <option value="CUSTOMER_NOT_RECEIVED"
                >{t('orderDetail.reasonCustomerNotReceived')}</option
              >
              <option value="CUSTOMER_REQUESTED">{t('orderDetail.reasonCustomerRequested')}</option>
            </select>
          </div>

          <div>
            <p class="block text-sm font-medium mb-2">{t('orderDetail.selectItemsToReturn')}</p>
            <div class="space-y-2 max-h-60 overflow-y-auto border border-gray-300 p-2">
              {#each order.items as orderItem}
                {@const isSelected = returnItems.some((item) => item.orderItemId === orderItem.id)}
                {@const returnItem = returnItems.find((item) => item.orderItemId === orderItem.id)}
                <div
                  class="flex items-start gap-3 p-2 border border-gray-200 {isSelected
                    ? 'bg-blue-50'
                    : ''}"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    on:change={() => toggleReturnItem(orderItem.id)}
                    class="mt-1"
                    disabled={creatingReturn}
                  />
                  <div class="flex-1">
                    <p class="font-medium">{orderItem.product.name}</p>
                    {#if orderItem.size}
                      <p class="text-sm text-gray-600">{t('orderDetail.size')} {orderItem.size}</p>
                    {/if}
                    <p class="text-sm text-gray-600">
                      {t('orderDetail.quantity')}
                      {orderItem.quantity}
                    </p>
                    {#if isSelected && returnItem}
                      <div class="mt-2 space-y-2">
                        <div>
                          <label class="text-xs font-medium" for={`return-quantity-${orderItem.id}`}
                            >{t('orderDetail.returnQuantity')}</label
                          >
                          <input
                            id={`return-quantity-${orderItem.id}`}
                            type="number"
                            min="1"
                            max={orderItem.quantity}
                            value={returnItem.quantity}
                            on:input={(e) =>
                              updateReturnItemQuantity(
                                orderItem.id,
                                parseInt(e.currentTarget.value) || 1
                              )}
                            class="w-20 ml-2 px-2 py-1 border border-gray-300 text-black text-sm"
                            disabled={creatingReturn}
                          />
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div>
            <label for="return-notes" class="block text-sm font-medium mb-2"
              >{t('orderDetail.additionalNotes')}</label
            >
            <textarea
              id="return-notes"
              bind:value={returnCustomerNotes}
              placeholder={t('orderDetail.additionalNotesPlaceholder')}
              rows="4"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              disabled={creatingReturn}
            ></textarea>
          </div>

          <div class="flex gap-4">
            <button
              type="submit"
              disabled={creatingReturn || returnItems.length === 0 || isDialogOpen}
              on:click={(e) => {
                console.log('Submit button clicked', {
                  creatingReturn,
                  returnItemsLength: returnItems.length,
                  isDialogOpen,
                  disabled: creatingReturn || returnItems.length === 0 || isDialogOpen,
                });
              }}
              class="flex-1 px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if creatingReturn}
                {t('orderDetail.creatingReturnRequest')}
              {:else}
                {t('orderDetail.submitReturnRequest')}
              {/if}
            </button>
            <button
              type="button"
              on:click={() => {
                if (!creatingReturn) {
                  showReturnModal = false;
                  returnCustomerNotes = '';
                  returnItems = [];
                }
              }}
              class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
              disabled={creatingReturn}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<!-- Ticket Modal -->
{#if showTicketModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ticket-modal-title"
  >
    <button
      type="button"
      class="absolute inset-0 h-full w-full cursor-default bg-transparent"
      aria-hidden="true"
      tabindex="-1"
      on:click={() => (showTicketModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showTicketModal = false)}
    ></button>
    <div
      class="relative z-10 bg-white border border-gray-300 p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      role="document"
    >
      <div class="flex justify-between items-center mb-4">
        <h3 id="ticket-modal-title" class="text-xl font-bold">{t('orderDetail.contactSupport')}</h3>
        <button
          on:click={() => (showTicketModal = false)}
          class="text-accent-muted hover:text-accent text-2xl"
        >
          ×
        </button>
      </div>

      <form
        on:submit|preventDefault={(e) => {
          e.preventDefault();
          handleCreateTicket(e);
        }}
        class="space-y-4"
      >
        <div>
          <label for="ticket-subject" class="block text-sm font-medium mb-2"
            >{t('orderDetail.subject')}</label
          >
          <input
            id="ticket-subject"
            type="text"
            bind:value={ticketSubject}
            placeholder={t('orderDetail.subjectPlaceholder')}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            disabled={creatingTicket}
            required
          />
        </div>
        <div>
          <label for="ticket-message" class="block text-sm font-medium mb-2"
            >{t('orderDetail.message')}</label
          >
          <textarea
            id="ticket-message"
            bind:value={ticketMessage}
            placeholder={t('orderDetail.messagePlaceholder')}
            rows="6"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            disabled={creatingTicket}
            required
          ></textarea>
        </div>
        <div class="flex gap-4">
          <button
            type="submit"
            disabled={creatingTicket || !ticketSubject.trim() || !ticketMessage.trim()}
            class="flex-1 px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if creatingTicket}
              {t('orderDetail.creating')}
            {:else}
              {t('orderDetail.sendMessage')}
            {/if}
          </button>
          <button
            type="button"
            on:click={() => {
              showTicketModal = false;
              ticketSubject = '';
              ticketMessage = '';
            }}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
            disabled={creatingTicket}
          >
            {t('profile.cancel')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Payment Method Change Modal -->
{#if showPaymentMethodModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="payment-method-modal-title"
  >
    <button
      type="button"
      class="absolute inset-0 h-full w-full cursor-default bg-transparent"
      aria-hidden="true"
      tabindex="-1"
      on:click={() => (showPaymentMethodModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showPaymentMethodModal = false)}
    ></button>
    <div
      class="relative z-10 bg-white border border-gray-300 p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      role="document"
    >
      <div class="flex justify-between items-center mb-4">
        <h3 id="payment-method-modal-title" class="text-xl font-bold">
          {t('orderDetail.changePaymentMethod')}
        </h3>
        <button
          on:click={() => (showPaymentMethodModal = false)}
          class="text-accent-muted hover:text-accent text-2xl"
        >
          ×
        </button>
      </div>

      <div class="space-y-3 mb-6">
        {#if loadingGateways}
          <p class="text-sm text-gray-500 py-2">{t('orderDetail.loadingGateways')}</p>
        {:else if !cardPaymentAvailable && !bankTransferAvailable && !cashOnDeliveryAvailable}
          <p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            {t('checkout.cardPaymentNotAvailableInRegion')}
          </p>
        {:else}
          {#if cardPaymentAvailable}
            <label
              class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {selectedPaymentMethod ===
              'GATEWAY'
                ? 'bg-gray-50 border-black'
                : ''}"
            >
              <input
                type="radio"
                bind:group={selectedPaymentMethod}
                value="GATEWAY"
                class="w-4 h-4"
              />
              <div class="flex-1">
                <p class="font-medium text-black">{t('orderDetail.paymentGateway')}</p>
                <p class="text-sm text-gray-600">{t('orderDetail.paymentGatewayDescription')}</p>
              </div>
            </label>
          {/if}
          {#if bankTransferAvailable}
            <label
              class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {selectedPaymentMethod ===
              'BANK_TRANSFER'
                ? 'bg-gray-50 border-black'
                : ''}"
            >
              <input
                type="radio"
                bind:group={selectedPaymentMethod}
                value="BANK_TRANSFER"
                class="w-4 h-4"
              />
              <div>
                <p class="font-medium text-black">{t('order.bankTransfer')}</p>
                <p class="text-sm text-gray-600">{t('orderDetail.bankTransferDescription')}</p>
              </div>
            </label>
          {/if}
          {#if cashOnDeliveryAvailable}
            <label
              class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {selectedPaymentMethod ===
              'CASH_ON_DELIVERY'
                ? 'bg-gray-50 border-black'
                : ''}"
            >
              <input
                type="radio"
                bind:group={selectedPaymentMethod}
                value="CASH_ON_DELIVERY"
                class="w-4 h-4"
              />
              <div>
                <p class="font-medium text-black">{t('order.cashOnDelivery')}</p>
                <p class="text-sm text-gray-600 whitespace-pre-line">
                  {cashOnDeliveryInstruction ||
                    paymentRequest?.cashOnDeliveryDetails?.instruction ||
                    t('paymentGateway.cashOnDeliveryHint')}
                </p>
              </div>
            </label>
          {/if}
          {#if managerChatAvailable}
            <label
              class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {selectedPaymentMethod ===
              'MANAGER_CHAT'
                ? 'bg-gray-50 border-black'
                : ''}"
            >
              <input
                type="radio"
                bind:group={selectedPaymentMethod}
                value="MANAGER_CHAT"
                class="w-4 h-4"
              />
              <div>
                <p class="font-medium text-black">{t('paymentGateway.managerChat')}</p>
                <p class="text-sm text-gray-600 whitespace-pre-line">
                  {managerChatInstruction || t('checkout.managerChatDescription')}
                </p>
              </div>
            </label>
          {/if}
        {/if}
      </div>

      <div class="flex gap-4">
        <button
          type="button"
          on:click={handleChangePaymentMethod}
          disabled={changingPaymentMethod ||
            !hasAnyPaymentMethodAvailable ||
            !selectedPaymentMethod ||
            (selectedPaymentMethod === 'GATEWAY' && !cardPaymentAvailable)}
          class="flex-1 px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if changingPaymentMethod}
            {t('orderDetail.changing')}
          {:else}
            {t('orderDetail.changePaymentMethod')}
          {/if}
        </button>
        <button
          type="button"
          on:click={() => {
            showPaymentMethodModal = false;
            selectedPaymentMethod = null;
          }}
          class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          disabled={changingPaymentMethod}
        >
          {t('profile.cancel')}
        </button>
      </div>
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
