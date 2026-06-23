<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';

  let orderId: string | null = null;

  onMount(() => {
    orderId = $page.url.searchParams.get('order_id');

    // Redirect to order page after 3 seconds
    if (orderId) {
      setTimeout(() => {
        goto(`/account/orders/${orderId}`);
      }, 3000);
    } else {
      setTimeout(() => {
        goto('/account/orders');
      }, 3000);
    }
  });

  function goToOrder() {
    if (orderId) {
      goto(`/account/orders/${orderId}`);
    } else {
      goto('/account/orders');
    }
  }
</script>

<div class="min-h-screen bg-white flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-dark-light p-8 border border-white/10 text-center">
    <div class="space-y-4">
      <div class="text-4xl">❌</div>
      <h1 class="text-2xl font-bold">{t('payment.cancel.cancelled')}</h1>
      <p class="text-accent-muted">{t('payment.cancel.paymentCancelled')}</p>
      <p class="text-sm text-accent-muted mb-6">{t('payment.cancel.redirecting')}</p>
      <button
        on:click={goToOrder}
        class="px-6 py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
      >
        {t('payment.cancel.goToOrder')}
      </button>
    </div>
  </div>
</div>
