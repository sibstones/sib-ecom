<script lang="ts">
  import { cartStore } from '$lib/stores/cart.store';
  import { cartDrawerStore } from '$lib/stores/cart-drawer.store';
  import { lastAddedToCartStore } from '$lib/stores/last-added-to-cart.store';
  import { goto } from '$app/navigation';
  import { formatPrice, formatMoneyInCurrency, toPriceNumber } from '$lib/utils/price.utils';
  import { currencyStore } from '$lib/stores/currency.store';
  import { formatSizeForDisplay } from '$lib/utils/size.utils';
  import { getFirstImageUrl, isVideoUrl } from '$lib/utils/image.utils';
  import { countryApi } from '$lib/api/country.api';
  import { t } from '$lib/utils/i18n';
  import { browser } from '$app/environment';

  // Open drawer when item added to cart
  $: if (browser && $lastAddedToCartStore) {
    cartDrawerStore.open();
  }

  $: items = $cartStore.items || [];
  $: loading = $cartStore.loading || false;
  $: hasPriceOnRequestItems = items.some((item) => item.product?.priceOnRequest);

  function getRegionCountry(): string {
    if (!browser) return 'US';
    const c = localStorage.getItem('selectedCountryCode');
    return (c || 'US').trim().toUpperCase().slice(0, 2);
  }

  function closeDrawer() {
    cartDrawerStore.close();
  }

  function goToCart() {
    closeDrawer();
    goto('/cart');
  }

  function goToCheckout() {
    closeDrawer();
    goto('/checkout');
  }

  function getItemUnitPrice(item: (typeof items)[0]): number {
    const raw = item.variant?.price ?? item.product?.price;
    return toPriceNumber(raw);
  }

  function handleImageError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) fallback.classList.remove('hidden');
  }

  $: subFromCart = (() => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    let s = 0;
    for (const item of items) {
      if (item.product?.priceOnRequest) continue;
      const p = toPriceNumber(item.variant?.price ?? item.product?.price);
      if (p > 0) s += p * item.quantity;
    }
    return s;
  })();

  $: itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  /** Checkout estimate: tax, shipping, total (same as cart/checkout pages). */
  let checkoutSummary: { subtotal: number; tax: number; shipping: number; total: number } = {
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0,
  };
  let checkoutSummaryCurrency = 'USD';

  function formatDrawerSummaryAmount(amount: number): string {
    if (checkoutSummaryCurrency === 'USD') return formatPrice(amount);
    return formatMoneyInCurrency(amount, checkoutSummaryCurrency);
  }

  $: if (browser && subFromCart >= 0) {
    void $currencyStore;
    const countryCode = getRegionCountry();
    const discount = 0;
    const displayCurrency = ($currencyStore || 'USD').trim().toUpperCase();
    const fallback = () => {
      const t = subFromCart * 0.1;
      const ship = subFromCart > 100 ? 0 : 10;
      checkoutSummaryCurrency = 'USD';
      checkoutSummary = {
        subtotal: subFromCart,
        tax: t,
        shipping: ship,
        total: subFromCart + t + ship,
      };
    };
    if (subFromCart === 0) {
      checkoutSummaryCurrency = 'USD';
      checkoutSummary = { subtotal: 0, tax: 0, shipping: 0, total: 0 };
    } else {
      fallback();
      countryApi
        .getCheckoutEstimate(countryCode, subFromCart, discount, displayCurrency)
        .then((e) => {
          if (e.display && e.displayCurrency) {
            checkoutSummaryCurrency = e.displayCurrency;
            checkoutSummary = {
              subtotal: e.display.subtotal,
              tax: e.display.tax,
              shipping: e.display.shipping,
              total: e.display.total,
            };
          } else {
            checkoutSummaryCurrency = 'USD';
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
</script>

<!-- Backdrop -->
<div
  class="fixed inset-0 z-[45] transition-opacity duration-300 ease-out {$cartDrawerStore
    ? 'opacity-100 pointer-events-auto'
    : 'opacity-0 pointer-events-none'}"
  style="background: rgba(0,0,0,0.4); backdrop-filter: blur(2px)"
  on:click={closeDrawer}
  on:keydown={(e) => e.key === 'Escape' && closeDrawer()}
  role="button"
  tabindex="-1"
  aria-label="Close cart"
  aria-hidden={!$cartDrawerStore}
></div>

<!-- Drawer panel -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="cart-drawer"
  class="fixed top-0 right-0 h-full w-full max-w-full md:max-w-md bg-white z-[50] transform transition-transform duration-300 ease-out shadow-2xl overflow-hidden flex flex-col border-l border-gray-200 {$cartDrawerStore
    ? 'translate-x-0'
    : 'translate-x-full'}"
  role="dialog"
  aria-modal="true"
  aria-label="Shopping cart"
>
  <!-- Header -->
  <div
    class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-black text-white shrink-0"
  >
    <h2 class="font-semibold text-base tracking-wide">{t('cart.shoppingBag')}</h2>
    <button
      on:click={closeDrawer}
      class="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
      aria-label={t('common.close')}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  <!-- Cart content -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div
          class="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin"
        ></div>
      </div>
    {:else if items.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
        </div>
        <p class="text-gray-600 mb-6">{t('cart.yourBagIsEmpty')}</p>
        <a
          href="/shop"
          class="px-6 py-3 bg-black text-white font-medium rounded-button hover:bg-gray-800 transition-colors"
          on:click={closeDrawer}
        >
          {t('cart.continueShopping')}
        </a>
      </div>
    {:else}
      <ul class="space-y-4">
        {#each items as item}
          {@const thumbUrl = getFirstImageUrl(item.product.images)}
          {@const firstMedia = item.product.images?.[0]}
          {@const firstIsVideo = firstMedia?.url && isVideoUrl(firstMedia.url)}
          <li class="flex gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
            <a
              href="/shop/product/{item.product.slug}"
              class="flex-shrink-0"
              on:click={closeDrawer}
            >
              <div class="w-20 aspect-[4/5] bg-gray-100 overflow-hidden">
                {#if thumbUrl}
                  <img
                    src={thumbUrl}
                    alt={item.product.name}
                    class="w-full h-full object-cover"
                    on:error={handleImageError}
                  />
                  <div class="hidden w-full h-full flex items-center justify-center">
                    <span class="text-xs text-gray-400">{t('product.noImage')}</span>
                  </div>
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
                    <span class="text-xs text-gray-400">{t('product.noImage')}</span>
                  </div>
                {/if}
              </div>
            </a>
            <div class="flex-1 min-w-0">
              <a href="/shop/product/{item.product.slug}" class="block" on:click={closeDrawer}>
                <h3 class="text-sm font-medium text-gray-900 line-clamp-2 hover:text-black">
                  {item.product.name}
                </h3>
              </a>
              {#if item.size && String(item.size).trim() !== ''}
                <p class="text-xs text-gray-500 mt-0.5">
                  {t('cart.size')}: {formatSizeForDisplay(item.size)}
                </p>
              {/if}
              <div class="flex items-center justify-between mt-2">
                <span class="text-sm font-semibold text-black">
                  {#if item.product.priceOnRequest || !item.product.price}
                    {t('cart.priceOnRequest')}
                  {:else}
                    {formatPrice(getItemUnitPrice(item))} × {item.quantity}
                  {/if}
                </span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Footer -->
  {#if items.length > 0}
    <div class="shrink-0 border-t border-gray-200 p-4 bg-gray-50">
      <div class="space-y-3 mb-4 border-b border-gray-200 pb-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">{t('common.subtotal')}</span>
          <span class="font-semibold">{formatDrawerSummaryAmount(subtotal)}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">{t('cart.tax')}</span>
          <span>{formatDrawerSummaryAmount(tax)}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">{t('common.shipping')}</span>
          <span>{shipping === 0 ? t('cart.free') : formatDrawerSummaryAmount(shipping)}</span>
        </div>
        <div class="flex justify-between text-sm font-bold pt-1">
          <span>{t('common.total')}</span>
          <span>{formatDrawerSummaryAmount(total)}</span>
        </div>
        {#if hasPriceOnRequestItems}
          <p class="text-xs text-amber-700 leading-relaxed">
            {t('cart.priceOnRequestTotalsNote')}
          </p>
        {/if}
      </div>
      <a
        href="/cart"
        class="block text-center text-sm text-gray-600 hover:text-black transition-colors mb-3 py-2"
        on:click={goToCart}
      >
        {t('cart.shoppingBag')} ({itemCount}
        {itemCount === 1 ? t('common.item') : t('common.itemsPlural')})
      </a>
      <button
        on:click={goToCheckout}
        class="w-full py-3.5 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
      >
        {t('cart.proceedToCheckout')}
      </button>
    </div>
  {/if}
</aside>

<svelte:window on:keydown={(e) => e.key === 'Escape' && $cartDrawerStore && closeDrawer()} />

<style>
  #cart-drawer {
    will-change: transform;
  }
</style>
