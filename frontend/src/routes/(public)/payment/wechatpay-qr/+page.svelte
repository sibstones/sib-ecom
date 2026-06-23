<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import QRCode from 'qrcode';
  import { customerApi } from '$lib/api/customer.api';
  import { guestCheckoutApi } from '$lib/api/guest-checkout.api';
  import { authStore } from '$lib/stores/auth.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';

  function guestTokenKey(id: string): string {
    return `guest_checkout_token_${id}`;
  }

  let qrDataUrl = '';
  let loading = true;
  let error = '';
  let orderId = $page.url.searchParams.get('order_id') || '';
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    const init = async () => {
      if (!orderId) {
        orderId =
          typeof window !== 'undefined' ? sessionStorage.getItem('wechatpay_order_id') || '' : '';
      }
      const codeUrl =
        typeof window !== 'undefined' ? sessionStorage.getItem(`wechatpay_qr_${orderId}`) : null;
      if (!codeUrl || !orderId) {
        error = t('payment.wechatpay.invalidSession');
        loading = false;
        return;
      }
      try {
        qrDataUrl = await QRCode.toDataURL(codeUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 280,
        });
      } catch (e) {
        error = e instanceof Error ? e.message : t('order.qrCodeGenerationFailed');
      } finally {
        loading = false;
      }

      const guestToken =
        typeof window !== 'undefined' ? sessionStorage.getItem(guestTokenKey(orderId)) : null;
      const useGuestPoll = !get(authStore).isAuthenticated && !!guestToken;

      pollInterval = setInterval(async () => {
        try {
          if (useGuestPoll && guestToken) {
            const status = await guestCheckoutApi.getOrderPaymentStatus(orderId, guestToken);
            if (status?.paymentStatus === 'PAID') {
              if (pollInterval) clearInterval(pollInterval);
              sessionStorage.removeItem(`wechatpay_qr_${orderId}`);
              notificationStore.success(t('payment.success.paymentSuccessful'));
              if (get(authStore).isAuthenticated) {
                goto(`/account/orders/${orderId}`);
              } else {
                goto(`/payment/success?order_id=${encodeURIComponent(orderId)}`);
              }
            }
          } else {
            const res = await customerApi.getOrder(orderId);
            const order = res.order;
            if (order?.paymentStatus === 'PAID') {
              if (pollInterval) clearInterval(pollInterval);
              sessionStorage.removeItem(`wechatpay_qr_${orderId}`);
              notificationStore.success(t('payment.success.paymentSuccessful'));
              goto(`/account/orders/${orderId}`);
            }
          }
        } catch {
          // ignore
        }
      }, 3000);
    };

    void init();
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  });

  function goToOrder() {
    if (!orderId) return;
    const tok =
      typeof window !== 'undefined' ? sessionStorage.getItem(guestTokenKey(orderId)) : null;
    if (!get(authStore).isAuthenticated && tok) {
      goto(`/payment/success?order_id=${encodeURIComponent(orderId)}`);
    } else {
      goto(`/account/orders/${orderId}`);
    }
  }
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
  <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
    <h1 class="text-2xl font-bold text-center mb-2">{t('payment.wechatpay.title')}</h1>
    <p class="text-center text-gray-600 mb-6">{t('payment.wechatpay.scanHint')}</p>

    {#if loading}
      <div class="flex flex-col items-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mb-4"></div>
        <p class="text-gray-600">{t('order.generatingQRCode')}</p>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p class="text-red-800">{error}</p>
      </div>
      <button
        on:click={() => goto('/checkout')}
        class="w-full py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('common.back')}
      </button>
    {:else if qrDataUrl}
      <div class="flex flex-col items-center">
        <div class="bg-white border-2 border-gray-200 rounded-lg p-4 mb-4">
          <img src={qrDataUrl} alt="WeChat Pay QR" class="w-64 h-64" />
        </div>
        <p class="text-sm text-gray-500 mb-6">{t('payment.wechatpay.waitingPayment')}</p>
        <button
          on:click={goToOrder}
          class="w-full py-2 border border-gray-300 hover:bg-gray-50 transition-colors text-black"
        >
          {t('payment.wechatpay.viewOrder')}
        </button>
      </div>
    {/if}
  </div>
</div>
