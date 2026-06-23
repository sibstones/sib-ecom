<script lang="ts">
  import { onMount } from 'svelte';
  import { cartStore } from '$lib/stores/cart.store';
  import { authStore } from '$lib/stores/auth.store';
  import { customerApi, type CustomerAddress } from '$lib/api/customer.api';
  import { paymentGatewayApi, type PaymentGateway } from '$lib/api/payment-gateway.api';
  import { guestCheckoutApi } from '$lib/api/guest-checkout.api';
  import { goto } from '$app/navigation';
  import { notificationStore } from '$lib/stores/notification.store';
  import { formatCheckoutSummaryAmount, formatPrice } from '$lib/utils/price.utils';
  import { formatSizeForDisplay } from '$lib/utils/size.utils';
  import { getFirstImageUrl, isVideoUrl } from '$lib/utils/image.utils';
  import { currencyStore } from '$lib/stores/currency.store';
  import { getCountryCode } from '$lib/utils/country.utils';
  import { countryApi } from '$lib/api/country.api';
  import { loyaltyApi } from '$lib/api/loyalty.api';
  import { settingsStore } from '$lib/stores/settings.store';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { isOnlinePaymentGatewayType } from '$lib/constants/payment-gateway';
  import { resolvePaymentInstruction } from '$lib/utils/payment-gateway';
  import {
    buildManagerChatAppLink,
    buildManagerChatLink,
    hasManagerChatContact,
    type ManagerChatChannel,
  } from '$lib/utils/manager-chat';
  import CheckoutAuthGate from '$lib/components/CheckoutAuthGate.svelte';
  import BlurredImage from '$lib/components/BlurredImage.svelte';

  let items = $cartStore.items;
  let loading = $cartStore.loading;
  $: hasPriceOnRequestItems = items.some((item) => item.product?.priceOnRequest);
  let addresses: CustomerAddress[] = [];
  let loadingAddresses = false;
  let selectedAddressId: string = '';
  let paymentMethod: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT' = 'GATEWAY';
  let notes = '';
  let creatingOrder = false;
  /** After order is placed, avoid empty-cart loading UI while navigating away */
  let redirectingToOrder = false;
  let showAddressForm = false;
  let checkoutMode: 'auth' | 'guest' = 'guest';
  let guestError = '';
  let checkingGuestEmail = false;
  let guestEmailBlocked = false;
  let loyaltyPointsBalance = 0;
  let loyaltyPointsSpendPerUnit = 100;
  let loyaltyRedeemPoints = 0;
  let loadingLoyalty = false;
  let loyaltyLoaded = false;
  let loyaltyError = '';

  function guestPaymentTokenStorageKey(orderId: string): string {
    return `guest_checkout_token_${orderId}`;
  }

  /** Gateways available for selected address country + currency (card payment by region) */
  let checkoutGateways: PaymentGateway[] = [];
  let loadingGateways = false;
  $: currentLanguage = $i18nStore;

  function getGatewayInstruction(gateways: PaymentGateway[], type: string): string {
    const gateway = gateways.find(
      (item) => String(item.type || '').toUpperCase() === type.toUpperCase()
    );
    return resolvePaymentInstruction(gateway?.config, currentLanguage);
  }

  function getManagerChatGateway(gateways: PaymentGateway[]): PaymentGateway | undefined {
    return gateways.find((item) => String(item.type || '').toUpperCase() === 'MANAGER_CHAT');
  }

  function openManagerChatWindow(channel?: ManagerChatChannel): Window | null {
    if (!channel || typeof window === 'undefined') return null;
    return window.open('', '_blank');
  }

  function openManagerChatForOrder(
    order: import('$lib/api/customer.api').Order,
    channel: ManagerChatChannel | undefined,
    popup: Window | null
  ) {
    if (!channel) return;
    const webLink = buildManagerChatLink(
      managerChatGateway?.config,
      channel,
      order,
      currentLanguage
    );
    if (!webLink) {
      if (popup) popup.close();
      return;
    }
    const appLink = buildManagerChatAppLink(
      managerChatGateway?.config,
      channel,
      order,
      currentLanguage
    );
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
    if (typeof window !== 'undefined') {
      window.open(webLink, '_blank');
    }
  }

  // Address form
  let addressForm = {
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    isDefault: false,
  };

  let guestForm = {
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
  };

  // Get promo code from session
  let appliedPromoCode: string | null = null;

  // Get session ID for cart
  function getSessionId(): string {
    if (typeof window === 'undefined') return '';
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  }

  /** Region country from header selector (localStorage). Used for initial gateway load when address not yet available. */
  function getRegionCountry(): string {
    if (typeof window === 'undefined') return 'US';
    const c = localStorage.getItem('selectedCountryCode');
    return (c || 'US').trim().toUpperCase().slice(0, 2);
  }

  onMount(async () => {
    // Load cart
    await cartStore.load();

    // If user is authenticated, load addresses and gateways.
    if ($authStore.isAuthenticated) {
      await loadAddresses();
    }
    await loadCheckoutGatewaysWith(getRegionCountry(), $currencyStore || 'USD');

    // Get promo code from session
    if (typeof window !== 'undefined') {
      appliedPromoCode = sessionStorage.getItem('applied_promo_code');
    }
  });

  async function onCheckoutAuthenticated() {
    checkoutMode = 'auth';
    await loadAddresses();
    await loadCheckoutGatewaysWith(getRegionCountry(), $currencyStore || 'USD');
    await loadLoyaltyData(true);
  }

  async function loadLoyaltyData(force = false) {
    if (!$authStore.isAuthenticated || !$settingsStore.loyaltyProgramEnabled) {
      loyaltyPointsBalance = 0;
      loyaltyPointsSpendPerUnit = 100;
      loyaltyRedeemPoints = 0;
      loyaltyLoaded = false;
      loyaltyError = '';
      return;
    }

    if ((loadingLoyalty || loyaltyLoaded) && !force) {
      return;
    }

    loadingLoyalty = true;
    try {
      const [pointsResponse, conversionResponse] = await Promise.all([
        loyaltyApi.getPoints(),
        loyaltyApi.getConversionRate(),
      ]);

      loyaltyPointsBalance = pointsResponse.points.balance;
      loyaltyPointsSpendPerUnit = conversionResponse.pointsPerDollarDiscount || 100;
      loyaltyLoaded = true;
      loyaltyError = '';

      const maxRedeemablePoints = Math.min(
        loyaltyPointsBalance,
        Math.max(0, Math.floor(subFromCart * Math.max(1, loyaltyPointsSpendPerUnit)))
      );
      if (loyaltyRedeemPoints > maxRedeemablePoints) {
        loyaltyRedeemPoints = maxRedeemablePoints;
      }
    } catch (error) {
      loyaltyError = error instanceof Error ? error.message : t('loyalty.failedToLoad');
      console.error('Failed to load loyalty data:', error);
    } finally {
      loadingLoyalty = false;
    }
  }

  function resetGuestEmailState() {
    guestEmailBlocked = false;
    if (guestError === t('checkout.guestEmailAlreadyExistsLoginRequired')) {
      guestError = '';
    }
  }

  async function checkGuestEmailAvailability() {
    const email = guestForm.email.trim().toLowerCase();
    resetGuestEmailState();

    if (!email || !email.includes('@')) {
      return;
    }

    checkingGuestEmail = true;
    try {
      const response = await customerApi.checkGuestCheckoutEmail(email);
      guestEmailBlocked = !response.canCheckout;
      if (guestEmailBlocked) {
        guestError = t('checkout.guestEmailAlreadyExistsLoginRequired');
      }
    } catch (error) {
      console.error('Failed to check guest checkout email:', error);
    } finally {
      checkingGuestEmail = false;
    }
  }

  async function loadAddresses() {
    loadingAddresses = true;
    try {
      const response = await customerApi.getAddresses();
      addresses = response.addresses;
      // Select default address if available
      const defaultAddress = addresses.find((a) => a.isDefault);
      if (defaultAddress) {
        selectedAddressId = defaultAddress.id;
      } else if (addresses.length > 0) {
        selectedAddressId = addresses[0].id;
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
      notificationStore.error(t('address.failedToLoad'));
    } finally {
      loadingAddresses = false;
    }
  }

  async function createAddress() {
    try {
      const response = await customerApi.createAddress(addressForm);
      addresses.push(response.address);
      selectedAddressId = response.address.id;
      showAddressForm = false;
      addressForm = {
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
        isDefault: false,
      };
      notificationStore.success(t('checkout.addressAddedSuccess'));
    } catch (error) {
      notificationStore.error(
        error instanceof Error ? error.message : t('checkout.failedToCreateAddress')
      );
    }
  }

  function calculateSubtotal() {
    return items.reduce((sum, item) => {
      // Skip items with price on request
      if (item.product.priceOnRequest || !item.product.price) {
        return sum;
      }
      const price = Number(item.variant?.price || item.product.price) || 0;
      return sum + price * item.quantity;
    }, 0);
  }

  function calculateTotal() {
    const sub = calculateSubtotal();
    const tax = sub * 0.1;
    const ship = sub > 100 ? 0 : 10;
    return sub + tax + ship;
  }

  async function redirectToOrderPage(orderId: string) {
    redirectingToOrder = true;
    await goto(`/account/orders/${orderId}`);
    void cartStore.load();
  }

  async function placeOrder(managerChatChannel?: ManagerChatChannel) {
    let managerChatPopup: Window | null = null;
    if (!selectedAddressId) {
      notificationStore.error(t('checkout.pleaseSelectAddress'));
      return;
    }

    if (items.length === 0) {
      notificationStore.error(t('checkout.yourCartIsEmpty'));
      goto('/cart');
      return;
    }

    creatingOrder = true;
    try {
      const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
      const orderData: {
        shippingAddressId: string;
        notes?: string;
        paymentMethod: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT';
        currency: string;
        countryCode: string;
        promoCode?: string;
        loyaltyRedeemPoints?: number;
        languageCode?: string;
      } = {
        shippingAddressId: selectedAddressId,
        notes: notes.trim() || undefined,
        paymentMethod,
        currency: ($currencyStore || 'USD').trim().toUpperCase(),
        countryCode: selectedAddress ? getCountryCode(selectedAddress.country) : getRegionCountry(),
        languageCode: currentLanguage,
      };

      // Add promo code if available
      if (appliedPromoCode) {
        orderData.promoCode = appliedPromoCode;
      }

      if ($settingsStore.loyaltyProgramEnabled) {
        orderData.loyaltyRedeemPoints = Math.max(0, Math.floor(loyaltyRedeemPoints));
      }

      console.log('Placing order with data:', orderData);
      const sessionId = getSessionId();
      console.log('Using sessionId:', sessionId);
      managerChatPopup =
        paymentMethod === 'MANAGER_CHAT' ? openManagerChatWindow(managerChatChannel) : null;
      const response = await customerApi.createOrder(orderData, sessionId);
      console.log('Order created successfully:', response);

      // Clear promo code from session
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('applied_promo_code');
      }

      const orderId = response.order.id;

      if (paymentMethod === 'MANAGER_CHAT') {
        openManagerChatForOrder(response.order, managerChatChannel, managerChatPopup);
        notificationStore.success(t('checkout.orderPlacedSuccess'));
        await redirectToOrderPage(orderId);
        return;
      }

      // If payment method is GATEWAY, start payment with the first available gateway (by country/currency)
      if (paymentMethod === 'GATEWAY' && checkoutGateways.length > 0) {
        const gateway = checkoutGateways.find((g) => isOnlinePaymentGatewayType(g.type));
        try {
          if (gateway?.type === 'STRIPE') {
            const { stripeApi } = await import('$lib/api/stripe.api');
            const checkoutSession = await stripeApi.createCheckoutSession(orderId);
            if (checkoutSession?.url) {
              window.location.href = checkoutSession.url;
              return;
            }
          } else if (gateway?.type === 'YOOKASSA') {
            const { yookassaApi } = await import('$lib/api/yookassa.api');
            const { paymentId, url } = await yookassaApi.createPayment(orderId);
            if (url) {
              if (paymentId && typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(`yookassa_payment_${orderId}`, paymentId);
              }
              window.location.href = url;
              return;
            }
          }
        } catch (error) {
          console.error('Failed to start payment:', error);
          notificationStore.error(t('checkout.failedToCreatePaymentSession'));
        }
      }

      notificationStore.success(t('checkout.orderPlacedSuccess'));
      await redirectToOrderPage(orderId);
    } catch (error) {
      if (managerChatPopup) managerChatPopup.close();
      console.error('Failed to create order:', error);
      const errorMessage =
        error instanceof Error ? error.message : t('checkout.failedToPlaceOrder');
      console.error('Error message:', errorMessage);
      notificationStore.error(errorMessage);
      creatingOrder = false;
      redirectingToOrder = false;
    }
  }

  async function placeGuestOrder(managerChatChannel?: ManagerChatChannel) {
    let managerChatPopup: Window | null = null;
    guestError = '';
    if (guestEmailBlocked) {
      guestError = t('checkout.guestEmailAlreadyExistsLoginRequired');
      return;
    }
    if (!guestForm.email.trim() || !guestForm.firstName.trim() || !guestForm.lastName.trim()) {
      guestError = t('checkout.guestFieldsRequired');
      return;
    }
    if (!guestForm.address.trim() || !guestForm.city.trim() || !guestForm.country.trim()) {
      guestError = t('checkout.guestFieldsRequired');
      return;
    }
    if (items.length === 0) {
      notificationStore.error(t('checkout.yourCartIsEmpty'));
      goto('/cart');
      return;
    }

    creatingOrder = true;
    try {
      const sessionId = getSessionId();
      managerChatPopup =
        paymentMethod === 'MANAGER_CHAT' ? openManagerChatWindow(managerChatChannel) : null;
      const response = await customerApi.createGuestOrder(
        {
          email: guestForm.email.trim().toLowerCase(),
          firstName: guestForm.firstName.trim(),
          lastName: guestForm.lastName.trim(),
          phone: guestForm.phone.trim() || undefined,
          address: guestForm.address.trim(),
          city: guestForm.city.trim(),
          country: guestForm.country.trim(),
          postalCode: guestForm.postalCode.trim() || undefined,
          notes: notes.trim() || undefined,
          paymentMethod,
          currency: ($currencyStore || 'USD').trim().toUpperCase(),
          countryCode: getCountryCode(guestForm.country),
          promoCode: appliedPromoCode || undefined,
          languageCode: currentLanguage,
        },
        sessionId
      );

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('applied_promo_code');
      }

      const orderId = response.order.id;
      const guestPaymentToken = response.guestPaymentToken;
      if (typeof window !== 'undefined' && guestPaymentToken) {
        sessionStorage.setItem(guestPaymentTokenStorageKey(orderId), guestPaymentToken);
      }

      if (paymentMethod === 'MANAGER_CHAT') {
        openManagerChatForOrder(response.order, managerChatChannel, managerChatPopup);
        if (guestPaymentToken) {
          const authResult = await guestCheckoutApi.authenticate(orderId, guestPaymentToken);
          await authStore.setAuthData({ user: authResult.user });
        }
        notificationStore.success(t('checkout.guestOrderCreatedRedirectingToOrders'));
        await redirectToOrderPage(orderId);
        return;
      }

      if (paymentMethod === 'GATEWAY' && checkoutGateways.length > 0) {
        const gateway = checkoutGateways.find((g) => isOnlinePaymentGatewayType(g.type));
        if (!guestPaymentToken) {
          notificationStore.error(t('checkout.failedToCreatePaymentSession'));
          creatingOrder = false;
          return;
        }
        try {
          if (gateway?.type === 'STRIPE' && guestPaymentToken) {
            const { stripeApi } = await import('$lib/api/stripe.api');
            const checkoutSession = await stripeApi.createGuestCheckoutSession(
              orderId,
              guestPaymentToken
            );
            if (checkoutSession?.url) {
              window.location.href = checkoutSession.url;
              return;
            }
          } else if (gateway?.type === 'YOOKASSA' && guestPaymentToken) {
            const { yookassaApi } = await import('$lib/api/yookassa.api');
            const { paymentId, url } = await yookassaApi.createGuestPayment(
              orderId,
              guestPaymentToken
            );
            if (url) {
              if (paymentId && typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(`yookassa_payment_${orderId}`, paymentId);
              }
              window.location.href = url;
              return;
            }
          }
        } catch (error) {
          console.error('Failed to start guest payment:', error);
          notificationStore.error(t('checkout.failedToCreatePaymentSession'));
          creatingOrder = false;
          return;
        }
        notificationStore.error(t('checkout.failedToCreatePaymentSession'));
        creatingOrder = false;
        return;
      }

      if (guestPaymentToken) {
        const authResult = await guestCheckoutApi.authenticate(orderId, guestPaymentToken);
        await authStore.setAuthData({ user: authResult.user });
      }

      notificationStore.success(
        paymentMethod === 'GATEWAY'
          ? t('checkout.orderPlacedSuccess')
          : t('checkout.guestOrderCreatedRedirectingToOrders')
      );
      await redirectToOrderPage(orderId);
    } catch (error) {
      if (managerChatPopup) managerChatPopup.close();
      const rawErrorMessage =
        error instanceof Error ? error.message : t('checkout.failedToPlaceOrder');
      const errorMessage = rawErrorMessage.includes('An account with this email already exists')
        ? t('checkout.guestEmailAlreadyExistsLoginRequired')
        : rawErrorMessage;
      guestEmailBlocked = errorMessage === t('checkout.guestEmailAlreadyExistsLoginRequired');
      guestError = errorMessage;
      notificationStore.error(errorMessage);
      creatingOrder = false;
      redirectingToOrder = false;
    }
  }

  let _checkoutGatewaysRequestId = 0;

  /** Load payment gateways for given country + currency (card by region; manual methods when enabled). */
  async function loadCheckoutGatewaysWith(countryCode: string, currency: string) {
    const reqCountry = countryCode || 'US';
    const reqCurrency = currency || 'USD';
    const requestId = ++_checkoutGatewaysRequestId;
    loadingGateways = true;
    try {
      const res = await paymentGatewayApi.getForCheckout(reqCountry, reqCurrency);
      if (requestId !== _checkoutGatewaysRequestId) return;
      checkoutGateways = Array.isArray(res.gateways) ? res.gateways : [];
    } catch (e) {
      console.error('Failed to load payment gateways:', e);
      if (requestId !== _checkoutGatewaysRequestId) return;
      checkoutGateways = [];
    } finally {
      if (requestId === _checkoutGatewaysRequestId) loadingGateways = false;
    }
  }

  /** Load payment gateways for selected address country + currency. Use region as fallback when no address. */
  async function loadCheckoutGateways() {
    const address = addresses.find((a) => a.id === selectedAddressId);
    const countryCode = address ? getCountryCode(address.country) : getRegionCountry();
    const currency = ($currencyStore || 'USD').trim().toUpperCase();
    await loadCheckoutGatewaysWith(countryCode, currency);
  }

  /** Selected address country code (for RU+RUB hint) */
  $: selectedCountryCode = (() => {
    const address = addresses.find((a) => a.id === selectedAddressId);
    return address ? getCountryCode(address.country) : getRegionCountry();
  })();

  /** Subtotal from cart (USD) */
  $: subFromCart = calculateSubtotal();
  $: loyaltyDiscountEstimate =
    $settingsStore.loyaltyProgramEnabled && $authStore.isAuthenticated
      ? Math.max(0, loyaltyRedeemPoints) / Math.max(1, loyaltyPointsSpendPerUnit)
      : 0;

  /** Estimate from backend (tax, shipping in USD by country). Fallback to local calc. */
  let checkoutSummary: { subtotal: number; tax: number; shipping: number; total: number } = {
    subtotal: 0,
    tax: 0,
    shipping: 10,
    total: 10,
  };
  /** USD or display currency from estimate — must match how checkoutSummary amounts are stored. */
  let checkoutAmountsCurrency = 'USD';

  function formatCheckoutAmount(amount: number): string {
    return formatCheckoutSummaryAmount(amount, checkoutAmountsCurrency);
  }

  $: if (subFromCart >= 0) {
    void $currencyStore;
    const countryCode = selectedCountryCode;
    const displayCurrency = ($currencyStore || 'USD').trim().toUpperCase();
    const discount = loyaltyDiscountEstimate;
    const fallback = () => {
      const t = subFromCart * 0.1;
      const ship = subFromCart > 100 ? 0 : 10;
      checkoutAmountsCurrency = 'USD';
      checkoutSummary = {
        subtotal: subFromCart,
        tax: t,
        shipping: ship,
        total: subFromCart + t + ship,
      };
    };
    if (subFromCart === 0) {
      checkoutAmountsCurrency = 'USD';
      checkoutSummary = { subtotal: 0, tax: 0, shipping: 0, total: 0 };
    } else {
      fallback();
      countryApi
        .getCheckoutEstimate(countryCode, subFromCart, 0, displayCurrency, discount)
        .then((e) => {
          if (e.display && e.displayCurrency) {
            checkoutAmountsCurrency = e.displayCurrency;
            checkoutSummary = {
              subtotal: e.display.subtotal,
              tax: e.display.tax,
              shipping: e.display.shipping,
              total: e.display.total,
            };
          } else {
            checkoutAmountsCurrency = 'USD';
            checkoutSummary = {
              subtotal: e.subtotal,
              tax: e.tax,
              shipping: e.shipping,
              total: e.total,
            };
          }
        })
        .catch(() => {});
    }
  }
  $: subtotal = checkoutSummary.subtotal;
  $: tax = checkoutSummary.tax;
  $: shipping = checkoutSummary.shipping;
  $: total = checkoutSummary.total;

  /** Card payment: STRIPE, YOOKASSA */
  $: cardPaymentAvailable = checkoutGateways.some((g) => {
    return isOnlinePaymentGatewayType(g.type);
  });
  $: bankTransferAvailable = checkoutGateways.some(
    (g) => String(g.type || '').toUpperCase() === 'BANK_TRANSFER'
  );
  $: cashOnDeliveryAvailable = checkoutGateways.some(
    (g) => String(g.type || '').toUpperCase() === 'CASH_ON_DELIVERY'
  );
  $: managerChatGateway = getManagerChatGateway(checkoutGateways);
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
  $: managerChatInstruction = getGatewayInstruction(checkoutGateways, 'MANAGER_CHAT');
  $: cashOnDeliveryInstruction = getGatewayInstruction(checkoutGateways, 'CASH_ON_DELIVERY');

  $: if (selectedAddressId && addresses.length > 0 && !loadingAddresses) {
    void $currencyStore; // reload gateways when currency changes
    loadCheckoutGateways();
  }

  $: if ($authStore.isAuthenticated && $settingsStore.loyaltyProgramEnabled) {
    void loadLoyaltyData();
  }

  $: if (!$settingsStore.loyaltyProgramEnabled || !$authStore.isAuthenticated) {
    loyaltyPointsBalance = 0;
    loyaltyPointsSpendPerUnit = 100;
    loyaltyRedeemPoints = 0;
    loadingLoyalty = false;
    loyaltyLoaded = false;
    loyaltyError = '';
  }

  $: if (loadingLoyalty || !loyaltyLoaded) {
    // keep the value until loading finishes
  } else {
    const maxRedeemablePoints = Math.min(
      loyaltyPointsBalance,
      Math.max(0, Math.floor(subFromCart * Math.max(1, loyaltyPointsSpendPerUnit)))
    );
    if (loyaltyRedeemPoints > maxRedeemablePoints) {
      loyaltyRedeemPoints = maxRedeemablePoints;
    }
  }

  /** Guest: load gateways from shipping country (or header region) + currency */
  $: guestCheckoutCountryCode =
    checkoutMode === 'guest' && guestForm.country.trim()
      ? getCountryCode(guestForm.country)
      : getRegionCountry();
  $: if (checkoutMode === 'guest' && typeof window !== 'undefined' && !$authStore.isAuthenticated) {
    void $currencyStore;
    void guestForm.country;
    loadCheckoutGatewaysWith(
      guestCheckoutCountryCode,
      ($currencyStore || 'USD').trim().toUpperCase()
    );
  }

  /** When gateways loaded, ensure selected method is available; otherwise switch to first available */
  $: if (!loadingGateways && checkoutGateways.length >= 0) {
    if (paymentMethod === 'BANK_TRANSFER' && !bankTransferAvailable) {
      paymentMethod = cardPaymentAvailable
        ? 'GATEWAY'
        : cashOnDeliveryAvailable
          ? 'CASH_ON_DELIVERY'
          : managerChatAvailable
            ? 'MANAGER_CHAT'
            : paymentMethod;
    }
    if (paymentMethod === 'CASH_ON_DELIVERY' && !cashOnDeliveryAvailable) {
      paymentMethod = cardPaymentAvailable
        ? 'GATEWAY'
        : bankTransferAvailable
          ? 'BANK_TRANSFER'
          : managerChatAvailable
            ? 'MANAGER_CHAT'
            : paymentMethod;
    }
    if (paymentMethod === 'MANAGER_CHAT' && !managerChatAvailable) {
      paymentMethod = cardPaymentAvailable
        ? 'GATEWAY'
        : bankTransferAvailable
          ? 'BANK_TRANSFER'
          : cashOnDeliveryAvailable
            ? 'CASH_ON_DELIVERY'
            : paymentMethod;
    }
    if (paymentMethod === 'GATEWAY' && !cardPaymentAvailable) {
      paymentMethod = bankTransferAvailable
        ? 'BANK_TRANSFER'
        : cashOnDeliveryAvailable
          ? 'CASH_ON_DELIVERY'
          : managerChatAvailable
            ? 'MANAGER_CHAT'
            : paymentMethod;
    }
  }
</script>

<main class="min-h-screen bg-white">
  <div class="container-custom py-12">
    <h1 class="text-3xl font-bold mb-8 text-black">{t('checkout.checkout')}</h1>

    {#if !redirectingToOrder && (loading || items.length === 0)}
      <div class="flex items-center justify-center py-20">
        {#if loading}
          <div class="w-full max-w-[10rem]">
            <LoadingBar />
          </div>
        {:else}
          <p class="text-gray-600">{t('checkout.yourCartIsEmpty')}</p>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
          {#if !$authStore.isAuthenticated}
            <div class="bg-gray-50 p-6 border border-gray-200 space-y-4">
              <div class="flex gap-2">
                <button
                  type="button"
                  on:click={() => (checkoutMode = 'guest')}
                  class="px-4 py-2 border text-sm font-medium transition-colors {checkoutMode ===
                  'guest'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-gray-300 hover:bg-gray-100'}"
                >
                  {t('checkout.guestCheckout')}
                </button>
                <button
                  type="button"
                  on:click={() => (checkoutMode = 'auth')}
                  class="px-4 py-2 border text-sm font-medium transition-colors {checkoutMode ===
                  'auth'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-gray-300 hover:bg-gray-100'}"
                >
                  {t('checkout.loginOrRegister')}
                </button>
              </div>

              {#if checkoutMode === 'auth'}
                <!-- Auth gate: login or register without leaving checkout -->
                <CheckoutAuthGate on:authenticated={onCheckoutAuthenticated} />
              {:else}
                <div class="space-y-4">
                  <h2 class="text-xl font-bold text-black">{t('checkout.shippingAddress')}</h2>
                  {#if guestError}
                    <div class="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {guestError}
                    </div>
                  {/if}
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      bind:value={guestForm.firstName}
                      type="text"
                      placeholder={t('profile.firstName')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black"
                    />
                    <input
                      bind:value={guestForm.lastName}
                      type="text"
                      placeholder={t('profile.lastName')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black"
                    />
                    <div class="md:col-span-2 space-y-1">
                      <input
                        bind:value={guestForm.email}
                        type="email"
                        placeholder={t('auth.email')}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        on:input={resetGuestEmailState}
                        on:blur={checkGuestEmailAvailability}
                      />
                      {#if checkingGuestEmail}
                        <p class="text-xs text-gray-500">{t('common.loading')}</p>
                      {:else if guestEmailBlocked}
                        <p class="text-xs text-red-600">
                          {t('checkout.guestEmailAlreadyExistsLoginRequired')}
                        </p>
                      {/if}
                    </div>
                    <input
                      bind:value={guestForm.phone}
                      type="tel"
                      placeholder={t('address.phoneLabel')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black md:col-span-2"
                    />
                    <input
                      bind:value={guestForm.address}
                      type="text"
                      placeholder={t('common.address')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black md:col-span-2"
                    />
                    <input
                      bind:value={guestForm.city}
                      type="text"
                      placeholder={t('common.city')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black"
                    />
                    <input
                      bind:value={guestForm.country}
                      type="text"
                      placeholder={t('common.country')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black"
                    />
                    <input
                      bind:value={guestForm.postalCode}
                      type="text"
                      placeholder={t('address.postalCode')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black md:col-span-2"
                    />
                  </div>

                  <div class="border-t border-gray-200 pt-6 space-y-4">
                    <h2 class="text-xl font-bold text-black">{t('checkout.paymentMethod')}</h2>
                    {#if loadingGateways}
                      <p class="text-gray-600 text-sm">{t('checkout.checkingPaymentMethods')}</p>
                    {:else if !cardPaymentAvailable}
                      <p
                        class="text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded text-sm"
                      >
                        {#if guestCheckoutCountryCode === 'RU' && ($currencyStore || 'USD') !== 'RUB'}
                          {t('checkout.selectRUBForYooKassa')}
                        {:else}
                          {t('checkout.cardPaymentNotAvailableInRegion')}
                        {/if}
                      </p>
                    {/if}
                    <div class="space-y-3">
                      {#if cardPaymentAvailable}
                        <label
                          class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                          'GATEWAY'
                            ? 'bg-white border-black'
                            : ''}"
                        >
                          <input
                            type="radio"
                            bind:group={paymentMethod}
                            value="GATEWAY"
                            class="w-4 h-4"
                          />
                          <div>
                            <p class="font-medium text-black">{t('orderDetail.paymentGateway')}</p>
                            <p class="text-sm text-gray-600">
                              {t('orderDetail.paymentGatewayDescription')}
                            </p>
                          </div>
                        </label>
                      {/if}
                      {#if bankTransferAvailable}
                        <label
                          class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                          'BANK_TRANSFER'
                            ? 'bg-white border-black'
                            : ''}"
                        >
                          <input
                            type="radio"
                            bind:group={paymentMethod}
                            value="BANK_TRANSFER"
                            class="w-4 h-4"
                          />
                          <div>
                            <p class="font-medium text-black">{t('order.bankTransfer')}</p>
                            <p class="text-sm text-gray-600">
                              {t('orderDetail.bankTransferDescription')}
                            </p>
                          </div>
                        </label>
                      {/if}
                      {#if cashOnDeliveryAvailable}
                        <label
                          class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                          'CASH_ON_DELIVERY'
                            ? 'bg-white border-black'
                            : ''}"
                        >
                          <input
                            type="radio"
                            bind:group={paymentMethod}
                            value="CASH_ON_DELIVERY"
                            class="w-4 h-4"
                          />
                          <div>
                            <p class="font-medium text-black">{t('order.cashOnDelivery')}</p>
                            <p class="text-sm text-gray-600 whitespace-pre-line">
                              {cashOnDeliveryInstruction || t('paymentGateway.cashOnDeliveryHint')}
                            </p>
                          </div>
                        </label>
                      {/if}
                      {#if managerChatAvailable}
                        <label
                          class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                          'MANAGER_CHAT'
                            ? 'bg-white border-black'
                            : ''}"
                        >
                          <input
                            type="radio"
                            bind:group={paymentMethod}
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
                    </div>
                  </div>

                  <div class="border-t border-gray-200 pt-6">
                    <h2 class="text-xl font-bold mb-4 text-black">{t('checkout.orderNotes')}</h2>
                    <textarea
                      bind:value={notes}
                      placeholder={t('checkout.orderNotesPlaceholder')}
                      rows="4"
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                    ></textarea>
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <!-- Shipping Address -->
            <div class="bg-gray-50 p-6 border border-gray-200">
              <h2 class="text-xl font-bold mb-4 text-black">{t('checkout.shippingAddress')}</h2>

              {#if loadingAddresses}
                <p class="text-gray-600">{t('checkout.loadingAddresses')}</p>
              {:else if addresses.length === 0}
                <p class="text-gray-600 mb-4">{t('checkout.noAddressesFound')}</p>
              {:else}
                <div class="space-y-3 mb-4">
                  {#each addresses as address}
                    <label
                      class="flex items-start gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {selectedAddressId ===
                      address.id
                        ? 'bg-white border-black'
                        : ''}"
                    >
                      <input
                        type="radio"
                        bind:group={selectedAddressId}
                        value={address.id}
                        class="mt-1"
                      />
                      <div class="flex-1">
                        <p class="font-medium text-black">
                          {address.firstName}
                          {address.lastName}
                        </p>
                        <p class="text-sm text-gray-600">{address.address}</p>
                        <p class="text-sm text-gray-600">
                          {address.city}, {address.country}
                          {address.postalCode}
                        </p>
                        {#if address.phone}
                          <p class="text-sm text-gray-600">
                            {t('address.phoneLabel')}: {address.phone}
                          </p>
                        {/if}
                        {#if address.isDefault}
                          <span
                            class="inline-block mt-1 text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-1"
                            >{t('address.default')}</span
                          >
                        {/if}
                      </div>
                    </label>
                  {/each}
                </div>
              {/if}

              {#if showAddressForm}
                <div class="border-t border-gray-300 pt-4 mt-4">
                  <h3 class="text-lg font-semibold mb-4 text-black">
                    {t('checkout.addNewAddress')}
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      bind:value={addressForm.firstName}
                      placeholder={t('profile.firstName')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                      required
                    />
                    <input
                      type="text"
                      bind:value={addressForm.lastName}
                      placeholder={t('profile.lastName')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                      required
                    />
                    <input
                      type="tel"
                      bind:value={addressForm.phone}
                      placeholder={t('address.phoneLabel')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                    />
                    <input
                      type="text"
                      bind:value={addressForm.postalCode}
                      placeholder={t('address.postalCode')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                    />
                    <input
                      type="text"
                      bind:value={addressForm.address}
                      placeholder={t('common.address')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black md:col-span-2"
                      required
                    />
                    <input
                      type="text"
                      bind:value={addressForm.city}
                      placeholder={t('common.city')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                      required
                    />
                    <input
                      type="text"
                      bind:value={addressForm.country}
                      placeholder={t('common.country')}
                      class="px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
                      required
                    />
                    <label class="flex items-center gap-2 md:col-span-2">
                      <input type="checkbox" bind:checked={addressForm.isDefault} class="w-4 h-4" />
                      <span class="text-sm text-gray-700">{t('address.setAsDefault')}</span>
                    </label>
                  </div>
                  <div class="flex gap-2 mt-4">
                    <button
                      on:click={createAddress}
                      class="px-6 py-2 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
                    >
                      {t('address.addAddress')}
                    </button>
                    <button
                      on:click={() => (showAddressForm = false)}
                      class="px-6 py-2 bg-gray-200 text-black font-medium hover:bg-gray-300 transition-colors"
                    >
                      {t('profile.cancel')}
                    </button>
                  </div>
                </div>
              {:else}
                <button
                  on:click={() => (showAddressForm = true)}
                  class="mt-4 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                >
                  {t('checkout.addNewAddressButton')}
                </button>
              {/if}
            </div>

            <!-- Payment Method -->
            <div class="bg-gray-50 p-6 border border-gray-200">
              <h2 class="text-xl font-bold mb-4 text-black">{t('checkout.paymentMethod')}</h2>
              {#if loadingGateways}
                <p class="text-gray-600 text-sm mb-3">{t('checkout.checkingPaymentMethods')}</p>
              {:else if selectedAddressId && !cardPaymentAvailable}
                <p
                  class="text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded text-sm mb-3"
                >
                  {#if selectedCountryCode === 'RU' && ($currencyStore || 'USD') !== 'RUB'}
                    {t('checkout.selectRUBForYooKassa')}
                  {:else}
                    {t('checkout.cardPaymentNotAvailableInRegion')}
                  {/if}
                </p>
              {/if}
              <div class="space-y-3">
                {#if cardPaymentAvailable}
                  <label
                    class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                    'GATEWAY'
                      ? 'bg-white border-black'
                      : ''}"
                  >
                    <input
                      type="radio"
                      bind:group={paymentMethod}
                      value="GATEWAY"
                      class="w-4 h-4"
                    />
                    <div>
                      <p class="font-medium text-black">{t('orderDetail.paymentGateway')}</p>
                      <p class="text-sm text-gray-600">
                        {t('orderDetail.paymentGatewayDescription')}
                      </p>
                    </div>
                  </label>
                {/if}
                {#if bankTransferAvailable}
                  <label
                    class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                    'BANK_TRANSFER'
                      ? 'bg-white border-black'
                      : ''}"
                  >
                    <input
                      type="radio"
                      bind:group={paymentMethod}
                      value="BANK_TRANSFER"
                      class="w-4 h-4"
                    />
                    <div>
                      <p class="font-medium text-black">{t('order.bankTransfer')}</p>
                      <p class="text-sm text-gray-600">
                        {t('orderDetail.bankTransferDescription')}
                      </p>
                    </div>
                  </label>
                {/if}
                {#if cashOnDeliveryAvailable}
                  <label
                    class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                    'CASH_ON_DELIVERY'
                      ? 'bg-white border-black'
                      : ''}"
                  >
                    <input
                      type="radio"
                      bind:group={paymentMethod}
                      value="CASH_ON_DELIVERY"
                      class="w-4 h-4"
                    />
                    <div>
                      <p class="font-medium text-black">{t('order.cashOnDelivery')}</p>
                      <p class="text-sm text-gray-600 whitespace-pre-line">
                        {cashOnDeliveryInstruction || t('paymentGateway.cashOnDeliveryHint')}
                      </p>
                    </div>
                  </label>
                {/if}
                {#if managerChatAvailable}
                  <label
                    class="flex items-center gap-3 p-4 border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors {paymentMethod ===
                    'MANAGER_CHAT'
                      ? 'bg-white border-black'
                      : ''}"
                  >
                    <input
                      type="radio"
                      bind:group={paymentMethod}
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
              </div>
            </div>

            <!-- Order Notes -->
            <div class="bg-gray-50 p-6 border border-gray-200">
              <h2 class="text-xl font-bold mb-4 text-black">{t('checkout.orderNotes')}</h2>
              <textarea
                bind:value={notes}
                placeholder={t('checkout.orderNotesPlaceholder')}
                rows="4"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
              ></textarea>
            </div>
          {/if}
        </div>

        <!-- Order Summary -->
        <div class="lg:col-span-1">
          <div class="bg-gray-50 p-6 sticky top-4 border border-gray-200">
            <h2 class="text-2xl font-bold mb-6 text-black">{t('checkout.orderSummary')}</h2>

            <!-- Cart Items -->
            <div class="space-y-4 mb-6">
              {#each items as item}
                {@const thumbUrl = getFirstImageUrl(item.product.images)}
                {@const firstMedia = item.product.images?.[0]}
                {@const firstIsVideo = firstMedia?.url && isVideoUrl(firstMedia.url)}
                <div class="flex gap-3">
                  <div class="w-16 h-16 bg-gray-200 overflow-hidden flex-shrink-0 relative group">
                    {#if thumbUrl}
                      <BlurredImage
                        src={thumbUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        fetchPriority="low"
                      />
                    {:else if firstIsVideo && firstMedia?.url}
                      <video
                        src={firstMedia.url}
                        class="w-full h-full object-cover"
                        muted
                        loop
                        playsinline
                        autoplay
                      ></video>
                    {:else}
                      <div class="w-full h-full flex items-center justify-center">
                        <p class="text-xs text-gray-400">{t('order.noImage')}</p>
                      </div>
                    {/if}
                    {#if !item.product.isActive}
                      <div
                        class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span class="text-white font-semibold text-xs">{t('order.soldOut')}</span>
                      </div>
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-black truncate">{item.product.name}</p>
                    {#if item.size}
                      <p class="text-xs text-gray-600">
                        {t('checkout.size')}: {formatSizeForDisplay(item.size)}
                      </p>
                    {/if}
                    <p class="text-xs text-gray-600">{t('checkout.qty')}: {item.quantity}</p>
                    <p class="text-sm font-semibold text-black">
                      {#if item.product.priceOnRequest || !item.product.price}
                        {t('cart.priceOnRequest')}
                      {:else}
                        {formatPrice(item.variant?.price || item.product.price)}
                      {/if}
                    </p>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Totals -->
            <div class="space-y-3 mb-6 border-t border-gray-300 pt-4">
              <div class="flex justify-between text-black">
                <span class="text-gray-600">{t('common.subtotal')}</span>
                <span>{formatCheckoutAmount(subtotal || 0)}</span>
              </div>
              <div class="flex justify-between text-black">
                <span class="text-gray-600">{t('cart.tax')}</span>
                <span>{formatCheckoutAmount(tax || 0)}</span>
              </div>
              <div class="flex justify-between text-black">
                <span class="text-gray-600">{t('common.shipping')}</span>
                <span>{shipping === 0 ? t('cart.free') : formatCheckoutAmount(shipping || 0)}</span>
              </div>
              <div
                class="border-t border-gray-300 pt-3 flex justify-between text-xl font-bold text-black"
              >
                <span>{t('common.total')}</span>
                <span>{formatCheckoutAmount(total || 0)}</span>
              </div>
              {#if hasPriceOnRequestItems}
                <p class="text-sm text-amber-700 leading-relaxed">
                  {t('cart.priceOnRequestTotalsNote')}
                </p>
              {/if}
            </div>

            {#if $settingsStore.loyaltyProgramEnabled && $authStore.isAuthenticated}
              {@const maxRedeemablePoints = Math.min(
                loyaltyPointsBalance,
                Math.max(0, Math.floor((total || 0) * Math.max(1, loyaltyPointsSpendPerUnit)))
              )}
              <div class="space-y-3 mb-6 border-t border-gray-300 pt-4">
                <div>
                  <h3 class="text-sm font-semibold text-black">{t('loyalty.title')}</h3>
                  <p class="text-xs text-gray-500 mt-1">{t('loyalty.useAtCheckout')}</p>
                </div>
                {#if loadingLoyalty}
                  <p class="text-sm text-gray-600">{t('common.loading')}</p>
                {:else if loyaltyError}
                  <p class="text-sm text-red-600">{loyaltyError}</p>
                {:else}
                  <p class="text-sm text-gray-600">
                    {t('loyalty.availablePoints')}: {loyaltyPointsBalance}
                  </p>
                  <p class="text-sm text-gray-600">
                    {t('loyalty.inDiscounts', {
                      amount: `$${(loyaltyPointsBalance / Math.max(1, loyaltyPointsSpendPerUnit)).toFixed(2)}`,
                    })}
                  </p>
                  <label class="block">
                    <span class="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                      {t('checkout.loyaltyRedeemPoints')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={maxRedeemablePoints}
                      step="1"
                      bind:value={loyaltyRedeemPoints}
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black focus:outline-none focus:border-black"
                      placeholder="0"
                    />
                  </label>
                  {#if loyaltyRedeemPoints > 0}
                    <p class="text-xs text-gray-500">
                      {t('checkout.loyaltyRedeemNote', {
                        amount: `$${(loyaltyRedeemPoints / Math.max(1, loyaltyPointsSpendPerUnit)).toFixed(2)}`,
                      })}
                    </p>
                  {/if}
                {/if}
              </div>
            {/if}

            <!-- Place Order Button -->
            {#if $authStore.isAuthenticated || checkoutMode === 'guest'}
              {#if paymentMethod === 'MANAGER_CHAT'}
                <div class="space-y-3 mb-4">
                  <p class="text-sm text-gray-600">
                    {managerChatInstruction || t('checkout.managerChatDescription')}
                  </p>
                  {#if managerChatTelegramAvailable}
                    <button
                      on:click={() =>
                        $authStore.isAuthenticated
                          ? placeOrder('telegram')
                          : placeGuestOrder('telegram')}
                      disabled={creatingOrder ||
                        guestEmailBlocked ||
                        ($authStore.isAuthenticated && !selectedAddressId) ||
                        items.length === 0}
                      class="w-full py-4 bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {#if creatingOrder}
                        {t('checkout.processing')}
                      {:else}
                        {t('checkout.placeOrderWithTelegram')}
                      {/if}
                    </button>
                  {/if}
                  {#if managerChatWhatsappAvailable}
                    <button
                      on:click={() =>
                        $authStore.isAuthenticated
                          ? placeOrder('whatsapp')
                          : placeGuestOrder('whatsapp')}
                      disabled={creatingOrder ||
                        guestEmailBlocked ||
                        ($authStore.isAuthenticated && !selectedAddressId) ||
                        items.length === 0}
                      class="w-full py-4 bg-white border border-black text-black font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {#if creatingOrder}
                        {t('checkout.processing')}
                      {:else}
                        {t('checkout.placeOrderWithWhatsapp')}
                      {/if}
                    </button>
                  {/if}
                  {#if managerChatWechatAvailable}
                    <button
                      on:click={() =>
                        $authStore.isAuthenticated
                          ? placeOrder('wechat')
                          : placeGuestOrder('wechat')}
                      disabled={creatingOrder ||
                        guestEmailBlocked ||
                        ($authStore.isAuthenticated && !selectedAddressId) ||
                        items.length === 0}
                      class="w-full py-4 bg-[#07C160] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {#if creatingOrder}
                        {t('checkout.processing')}
                      {:else}
                        {t('checkout.placeOrderWithWechat')}
                      {/if}
                    </button>
                  {/if}
                  {#if managerChatMaxAvailable}
                    <button
                      on:click={() =>
                        $authStore.isAuthenticated ? placeOrder('max') : placeGuestOrder('max')}
                      disabled={creatingOrder ||
                        guestEmailBlocked ||
                        ($authStore.isAuthenticated && !selectedAddressId) ||
                        items.length === 0}
                      class="w-full py-4 bg-[#2563eb] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {#if creatingOrder}
                        {t('checkout.processing')}
                      {:else}
                        {t('checkout.placeOrderWithMax')}
                      {/if}
                    </button>
                  {/if}
                </div>
              {:else}
                <button
                  on:click={() => ($authStore.isAuthenticated ? placeOrder() : placeGuestOrder())}
                  disabled={creatingOrder ||
                    guestEmailBlocked ||
                    ($authStore.isAuthenticated && !selectedAddressId) ||
                    items.length === 0}
                  class="w-full py-4 bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                >
                  {#if creatingOrder}
                    {t('checkout.processing')}
                  {:else}
                    {t('checkout.placeOrder')}
                  {/if}
                </button>
              {/if}
            {/if}

            <a
              href="/cart"
              class="block text-center text-gray-600 hover:text-black transition-colors mt-4"
            >
              {t('checkout.backToCart')}
            </a>
          </div>
        </div>
      </div>
    {/if}
  </div>
</main>
