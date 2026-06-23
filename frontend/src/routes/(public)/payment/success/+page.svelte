<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { stripeApi } from '$lib/api/stripe.api';
  import { customerApi } from '$lib/api/customer.api';
  import { guestCheckoutApi } from '$lib/api/guest-checkout.api';
  import { authStore } from '$lib/stores/auth.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';

  function guestTokenKey(orderId: string): string {
    return `guest_checkout_token_${orderId}`;
  }

  function postPaymentRedirect(orderId: string): void {
    if (get(authStore).isAuthenticated) {
      setTimeout(() => goto(`/account/orders/${orderId}`), 2000);
    } else {
      setTimeout(() => goto('/'), 2500);
    }
  }

  let loading = true;
  let error = '';

  onMount(async () => {
    const sessionId = $page.url.searchParams.get('session_id');
    const orderId =
      $page.url.searchParams.get('order_id')?.trim() ||
      $page.url.searchParams.get('orderId')?.trim() ||
      '';

    if (!orderId) {
      error = t('payment.success.invalidSession');
      loading = false;
      return;
    }

    const guestToken =
      typeof window !== 'undefined' ? sessionStorage.getItem(guestTokenKey(orderId)) : null;
    const isGuestFlow = !get(authStore).isAuthenticated && !!guestToken;

    // YooKassa / CloudPayments: redirect with order_id only (no session_id).
    if (!sessionId) {
      const paymentId =
        $page.url.searchParams.get('payment_id') ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem(`yookassa_payment_${orderId}`)
          : null);

      if (paymentId) {
        try {
          if (isGuestFlow && guestToken) {
            const { yookassaApi } = await import('$lib/api/yookassa.api');
            const { paid, status } = await yookassaApi.syncGuestPaymentStatus(
              orderId,
              paymentId,
              guestToken
            );
            sessionStorage.removeItem(`yookassa_payment_${orderId}`);
            if (paid) {
              notificationStore.success(t('payment.success.paymentSuccessful'));
              postPaymentRedirect(orderId);
              loading = false;
              return;
            }
            if (status === 'canceled' || status === 'cancelled' || status === 'failed') {
              goto(`/payment/cancel?order_id=${orderId}`);
              loading = false;
              return;
            }
          } else {
            const { yookassaApi } = await import('$lib/api/yookassa.api');
            const { paid, status } = await yookassaApi.syncPaymentStatus(orderId, paymentId);
            sessionStorage.removeItem(`yookassa_payment_${orderId}`);
            if (paid) {
              notificationStore.success(t('payment.success.paymentSuccessful'));
              postPaymentRedirect(orderId);
              loading = false;
              return;
            }
            if (status === 'canceled' || status === 'cancelled' || status === 'failed') {
              goto(`/payment/cancel?order_id=${orderId}`);
              loading = false;
              return;
            }
          }
        } catch {
          // fall through to polling
        }
      }

      const maxAttempts = 10;
      const intervalMs = 3000;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          if (isGuestFlow && guestToken) {
            const status = await guestCheckoutApi.getOrderPaymentStatus(orderId, guestToken);
            if (status?.paymentStatus === 'PAID') {
              if (paymentId && typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem(`yookassa_payment_${orderId}`);
              }
              notificationStore.success(t('payment.success.paymentSuccessful'));
              postPaymentRedirect(orderId);
              loading = false;
              return;
            }
          } else {
            const { order } = await customerApi.getOrder(orderId);
            if (order?.paymentStatus === 'PAID') {
              if (paymentId && typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem(`yookassa_payment_${orderId}`);
              }
              notificationStore.success(t('payment.success.paymentSuccessful'));
              postPaymentRedirect(orderId);
              loading = false;
              return;
            }
          }
        } catch {
          // continue polling
        }
        if (i < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }
      error = t('payment.success.paymentNotCompleted');
      postPaymentRedirect(orderId);
      loading = false;
      return;
    }

    // Stripe: verify session
    try {
      if (isGuestFlow && guestToken) {
        const sessionStatus = await stripeApi.getGuestSessionStatus(sessionId, guestToken);
        if (sessionStatus.paymentStatus === 'paid') {
          notificationStore.success(t('payment.success.paymentSuccessful'));
          postPaymentRedirect(orderId);
        } else {
          error = t('payment.success.paymentNotCompleted');
          postPaymentRedirect(orderId);
        }
      } else {
        const sessionStatus = await stripeApi.getSessionStatus(sessionId);
        if (sessionStatus.paymentStatus === 'paid') {
          notificationStore.success(t('payment.success.paymentSuccessful'));
          postPaymentRedirect(orderId);
        } else {
          error = t('payment.success.paymentNotCompleted');
          postPaymentRedirect(orderId);
        }
      }
    } catch (e) {
      console.error('Failed to verify payment:', e);
      error = t('payment.success.failedToVerify');
      postPaymentRedirect(orderId);
    } finally {
      loading = false;
    }
  });
</script>

<div class="min-h-screen bg-white flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-dark-light p-8 border border-white/10 text-center">
    {#if loading}
      <div class="space-y-4">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
        <p class="text-lg font-medium">{t('payment.success.verifying')}</p>
      </div>
    {:else if error}
      <div class="space-y-4">
        <div class="text-4xl">⚠️</div>
        <h1 class="text-2xl font-bold">{t('payment.success.error')}</h1>
        <p class="text-accent-muted">{error}</p>
        <p class="text-sm text-accent-muted">{t('payment.success.redirecting')}</p>
      </div>
    {:else}
      <div class="space-y-4">
        <div class="text-4xl">✅</div>
        <h1 class="text-2xl font-bold">{t('payment.success.success')}</h1>
        <p class="text-accent-muted">{t('payment.success.paymentReceived')}</p>
        <p class="text-sm text-accent-muted">{t('payment.success.redirecting')}</p>
      </div>
    {/if}
  </div>
</div>
