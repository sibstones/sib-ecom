<script lang="ts">
  import { onMount } from 'svelte';
  import { cartStore } from '$lib/stores/cart.store';
  import { productApi } from '$lib/api/product.api';
  import { countryApi } from '$lib/api/country.api';
  import { goto } from '$app/navigation';
  import { formatPrice, formatMoneyInCurrency, toPriceNumber } from '$lib/utils/price.utils';
  import { formatSizeForDisplay } from '$lib/utils/size.utils';
  import { currencyStore } from '$lib/stores/currency.store';
  import { getFirstImageUrl, isVideoUrl } from '$lib/utils/image.utils';
  import { t } from '$lib/utils/i18n';
  import { confirm } from '$lib/utils/dialog.utils';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import BlurredImage from '$lib/components/BlurredImage.svelte';

  function getRegionCountry(): string {
    if (typeof window === 'undefined') return 'US';
    const c = localStorage.getItem('selectedCountryCode');
    return (c || 'US').trim().toUpperCase().slice(0, 2);
  }

  // Use reactive statements to ensure updates when store changes
  $: items = $cartStore.items || [];
  $: loading = $cartStore.loading || false;
  $: hasPriceOnRequestItems = items.some((item) => item.product?.priceOnRequest);
  let promoCode = '';
  let appliedPromo: { code: string; discount: number } | null = null;
  let promoError = '';

  /** Max quantity per cart item (product+size stock). itemId -> availableStock. */
  let maxQuantityByItemId: Record<string, number> = {};

  onMount(async () => {
    await cartStore.load();
    // Auto-apply partner promo from link (?promo=) if stored and not yet applied
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('applied_promo_code');
      if (stored?.trim() && !appliedPromo) {
        promoCode = stored.trim();
        await applyPromo();
      }
    }
  });

  /** Load available stock for each cart item when items change. */
  $: if (items.length > 0) {
    (async () => {
      const next: Record<string, number> = {};
      for (const item of items) {
        try {
          const res = await productApi.getAvailableStock(item.product.id, item.size ?? undefined);
          next[item.id] = res.availableStock ?? 0;
        } catch {
          next[item.id] = 0;
        }
      }
      maxQuantityByItemId = next;
    })();
  }

  function getMaxQuantity(itemId: string): number | undefined {
    const n = maxQuantityByItemId[itemId];
    return n === undefined ? undefined : n;
  }

  function canIncreaseQuantity(item: (typeof items)[0]): boolean {
    const max = getMaxQuantity(item.id);
    if (max === undefined) return true;
    return item.quantity < max;
  }

  async function applyPromo() {
    if (!promoCode.trim()) return;

    try {
      const { promoApi } = await import('$lib/api/promo.api');
      const list = $cartStore.items ?? [];
      const sub = Array.isArray(list)
        ? list.reduce((s, item) => {
            if (item.product?.priceOnRequest) return s;
            const p = toPriceNumber(item.variant?.price ?? item.product?.price);
            return s + (p > 0 ? p * item.quantity : 0);
          }, 0)
        : 0;
      const result = await promoApi.apply(promoCode, sub);
      appliedPromo = {
        code: result.promoCode.code,
        discount: result.discount,
      };
      promoError = '';
      promoCode = '';
    } catch (e) {
      promoError = e instanceof Error ? e.message : 'Invalid promo code';
      appliedPromo = null;
    }
  }

  function removePromo() {
    appliedPromo = null;
    promoCode = '';
    promoError = '';
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      await cartStore.remove(itemId);
      return;
    }
    const max = maxQuantityByItemId[itemId];
    if (max !== undefined && quantity > max) {
      quantity = max;
      notificationStore.error(t('productPage.maxStockQuantity', { count: max }));
    }
    await cartStore.updateQuantity(itemId, quantity);
  }

  async function removeItem(itemId: string) {
    await cartStore.remove(itemId);
  }

  async function clearCart() {
    const confirmed = await confirm(
      t('cart.clearCartConfirm'),
      undefined,
      t('common.ok'),
      t('common.cancel')
    );
    if (confirmed) {
      await cartStore.clear();
    }
  }

  /** Resolve unit price: variant price or product price (same as card display). Handles API Decimal. */
  function getItemUnitPrice(item: (typeof items)[0]): number {
    const raw = item.variant?.price ?? item.product?.price;
    return toPriceNumber(raw);
  }

  /** Subtotal and discount from cart (product prices in USD). */
  $: subFromCart = (() => {
    const list = $cartStore.items ?? [];
    if (!Array.isArray(list) || list.length === 0) return 0;
    let s = 0;
    for (const item of list) {
      if (item.product?.priceOnRequest) continue;
      const p = toPriceNumber(item.variant?.price ?? item.product?.price);
      if (p > 0) s += p * item.quantity;
    }
    return s;
  })();
  $: discFromPromo = appliedPromo?.discount ?? 0;

  /** Estimate from backend. Amounts are USD unless `summaryAmountsCurrency` is set from `display` (server conversion). */
  let summary: {
    subtotal: number;
    discount: number;
    subtotalAfterDiscount: number;
    tax: number;
    shipping: number;
    total: number;
  } = { subtotal: 0, discount: 0, subtotalAfterDiscount: 0, tax: 0, shipping: 10, total: 10 };
  let summaryAmountsCurrency = 'USD';

  function formatSummaryAmount(amount: number): string {
    if (summaryAmountsCurrency === 'USD') return formatPrice(amount);
    return formatMoneyInCurrency(amount, summaryAmountsCurrency);
  }

  $: if (subFromCart >= 0) {
    void $currencyStore;
    const countryCode = getRegionCountry();
    const displayCurrency = ($currencyStore || 'USD').trim().toUpperCase();
    const fallback = () => {
      const after = Math.max(0, subFromCart - discFromPromo);
      const taxVal = after * 0.1;
      const ship = after >= 100 ? 0 : 10;
      summaryAmountsCurrency = 'USD';
      summary = {
        subtotal: subFromCart,
        discount: discFromPromo,
        subtotalAfterDiscount: after,
        tax: taxVal,
        shipping: ship,
        total: after + taxVal + ship,
      };
    };
    if (subFromCart === 0) {
      summaryAmountsCurrency = 'USD';
      summary = {
        subtotal: 0,
        discount: discFromPromo,
        subtotalAfterDiscount: 0,
        tax: 0,
        shipping: 0,
        total: 0,
      };
    } else {
      fallback(); // optimistic
      countryApi
        .getCheckoutEstimate(countryCode, subFromCart, discFromPromo, displayCurrency)
        .then((e) => {
          if (e.display && e.displayCurrency) {
            summaryAmountsCurrency = e.displayCurrency;
            summary = {
              subtotal: e.display.subtotal,
              discount: e.display.discount,
              subtotalAfterDiscount: e.display.subtotalAfterDiscount,
              tax: e.display.tax,
              shipping: e.display.shipping,
              total: e.display.total,
            };
          } else {
            summaryAmountsCurrency = 'USD';
            summary = {
              subtotal: e.subtotal,
              discount: e.discount,
              subtotalAfterDiscount: e.subtotalAfterDiscount,
              tax: e.tax,
              shipping: e.shipping,
              total: e.total,
            };
          }
        })
        .catch(() => {});
    }
  }

  $: subtotal = summary.subtotal;
  $: discount = summary.discount;
  $: subtotalAfterDiscount = summary.subtotalAfterDiscount;
  $: tax = summary.tax;
  $: shipping = summary.shipping;
  $: total = summary.total;
</script>

<main class="min-h-screen bg-white">
  <div class="container-custom py-12">
    <h1 class="text-3xl font-bold mb-8 text-black">{t('cart.shoppingBag')}</h1>

    {#if loading}
      <div class="w-full py-20">
        <LoadingBar />
      </div>
    {:else if items.length === 0}
      <div class="flex flex-col items-center justify-center py-20">
        <p class="text-xl text-gray-600 mb-8">{t('cart.yourBagIsEmpty')}</p>
        <a
          href="/shop"
          class="px-8 py-4 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
        >
          {t('cart.continueShopping')}
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Cart Items -->
        <div class="lg:col-span-2 space-y-4">
          {#each items as item}
            {@const thumbUrl = getFirstImageUrl(item.product.images)}
            {@const firstMedia = item.product.images?.[0]}
            {@const firstIsVideo = firstMedia?.url && isVideoUrl(firstMedia.url)}
            <div class="p-6 flex gap-6 border border-gray-200 hover:shadow-md transition-shadow">
              <!-- Product Image or Video -->
              <a href="/shop/product/{item.product.slug}" class="flex-shrink-0 group">
                <div class="w-24 aspect-[9/16] bg-gray-200 overflow-hidden relative">
                  {#if thumbUrl}
                    <BlurredImage
                      src={thumbUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      fetchPriority="low"
                    />
                    {#if !item.product.isActive}
                      <div
                        class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span class="text-white font-semibold text-xs">{t('order.soldOut')}</span>
                      </div>
                    {/if}
                  {:else if firstIsVideo && firstMedia?.url}
                    <video
                      src={firstMedia.url}
                      class="w-full h-full object-cover"
                      muted
                      loop
                      playsinline
                      autoplay
                    ></video>
                    {#if !item.product.isActive}
                      <div
                        class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span class="text-white font-semibold text-xs">{t('order.soldOut')}</span>
                      </div>
                    {/if}
                  {:else}
                    <div class="w-full h-full flex items-center justify-center">
                      <p class="text-xs text-gray-400">{t('product.noImage')}</p>
                    </div>
                  {/if}
                </div>
              </a>

              <!-- Product Info -->
              <div class="flex-1 min-w-0">
                <a href="/shop/product/{item.product.slug}">
                  <h3
                    class="text-xl font-medium mb-2 text-black hover:text-gray-700 transition-colors"
                  >
                    {item.product.name}
                  </h3>
                </a>

                <!-- Variant and Size Info -->
                <div class="space-y-2 mb-3">
                  {#if item.variant}
                    <p class="text-sm text-gray-600">{item.variant.name}</p>
                  {/if}
                  <!-- Always show size if it exists -->
                  {#if item.size && String(item.size).trim() !== ''}
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                        >{t('cart.size')}:</span
                      >
                      <span
                        class="text-sm font-bold text-black bg-white px-3 py-1.5 -md border-2 border-gray-400 shadow-sm min-w-[3rem] text-center"
                      >
                        {formatSizeForDisplay(item.size)}
                      </span>
                    </div>
                  {:else}
                    <!-- Debug: show if size should be there but isn't -->
                    {#if item.product.sizes && typeof item.product.sizes === 'object' && Object.values(item.product.sizes).some((v) => Array.isArray(v) && v.length > 0)}
                      <div class="flex items-center gap-2 text-xs text-gray-400 italic">
                        <span>{t('cart.sizeNotSelected')}</span>
                      </div>
                    {/if}
                  {/if}
                </div>

                <p class="text-lg font-semibold mb-4 text-black">
                  {#if item.product.priceOnRequest || !item.product.price}
                    {t('cart.priceOnRequest')}
                  {:else}
                    {formatPrice(getItemUnitPrice(item))}
                  {/if}
                </p>

                <!-- Quantity Controls -->
                <div class="flex items-center gap-4 flex-wrap">
                  <div class="flex items-center gap-2 border border-gray-300 bg-white">
                    <button
                      on:click={() => updateQuantity(item.id, item.quantity - 1)}
                      class="px-3 py-2 hover:bg-gray-100 transition-colors text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                      aria-label={t('cart.decreaseQuantity')}
                    >
                      −
                    </button>
                    <span class="w-12 text-center text-black font-medium py-2">{item.quantity}</span
                    >
                    <button
                      on:click={() => updateQuantity(item.id, item.quantity + 1)}
                      class="px-3 py-2 hover:bg-gray-100 transition-colors text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading || !canIncreaseQuantity(item)}
                      aria-label={t('cart.increaseQuantity')}
                    >
                      +
                    </button>
                  </div>
                  {#if maxQuantityByItemId[item.id] !== undefined && maxQuantityByItemId[item.id] > 0}
                    <span class="text-xs text-gray-500"
                      >{t('productPage.availableInStock', {
                        count: maxQuantityByItemId[item.id],
                      })}</span
                    >
                  {/if}
                  <button
                    on:click={() => removeItem(item.id)}
                    class="text-red-600 hover:text-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {t('cart.remove')}
                  </button>
                </div>
              </div>

              <!-- Item Total -->
              <div class="text-right flex-shrink-0">
                <p class="text-xl font-semibold text-black">
                  {#if item.product.priceOnRequest || !item.product.price}
                    {t('cart.priceOnRequest')}
                  {:else}
                    {formatPrice(
                      toPriceNumber(item.variant?.price ?? item.product?.price) * item.quantity
                    )}
                  {/if}
                </p>
              </div>
            </div>
          {/each}

          <button on:click={clearCart} class="text-red-600 hover:text-red-700 transition-colors">
            {t('cart.clearCart')}
          </button>
        </div>

        <!-- Order Summary -->
        <div class="lg:col-span-1 min-w-0">
          <div class="bg-gray-50 p-4 sm:p-6 sticky top-4 border border-gray-200 min-w-0">
            <h2 class="text-xl sm:text-2xl font-bold mb-6 text-black">{t('cart.orderSummary')}</h2>

            <!-- Promo Code -->
            <div class="mb-6 min-w-0">
              {#if !appliedPromo}
                <div class="flex flex-col sm:flex-row gap-2 min-w-0">
                  <input
                    type="text"
                    bind:value={promoCode}
                    placeholder={t('cart.promoCode')}
                    class="w-full min-w-0 flex-1 px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    on:keydown={(e) => e.key === 'Enter' && applyPromo()}
                  />
                  <button
                    type="button"
                    on:click={applyPromo}
                    class="w-full sm:w-auto flex-shrink-0 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
                  >
                    {t('cart.apply')}
                  </button>
                </div>
                {#if promoError}
                  <p class="text-red-600 text-sm mt-2">{promoError}</p>
                {/if}
              {:else}
                <div
                  class="flex items-center justify-between p-3 bg-green-50 border border-green-200"
                >
                  <div>
                    <p class="text-sm text-green-700">Promo: {appliedPromo.code}</p>
                    <p class="text-sm text-green-700">-{formatPrice(appliedPromo.discount)}</p>
                  </div>
                  <button
                    on:click={removePromo}
                    class="text-red-600 hover:text-red-700 transition-colors"
                  >
                    ×
                  </button>
                </div>
              {/if}
            </div>

            <div class="space-y-4 mb-6">
              <div class="flex justify-between text-black">
                <span class="text-gray-600">{t('common.subtotal')}</span>
                <span>{formatSummaryAmount(subtotal || 0)}</span>
              </div>
              {#if appliedPromo}
                <div class="flex justify-between text-green-700">
                  <span>{t('cart.discount')}</span>
                  <span>-{formatSummaryAmount(discount || 0)}</span>
                </div>
              {/if}
              <div class="flex justify-between text-black">
                <span class="text-gray-600">{t('cart.tax')}</span>
                <span>{formatSummaryAmount(tax || 0)}</span>
              </div>
              <div class="flex justify-between text-black">
                <span class="text-gray-600">{t('common.shipping')}</span>
                <span>{shipping === 0 ? t('cart.free') : formatSummaryAmount(shipping || 0)}</span>
              </div>
              <div
                class="border-t border-gray-300 pt-4 flex justify-between text-xl font-bold text-black"
              >
                <span>{t('common.total')}</span>
                <span>{formatSummaryAmount(total || 0)}</span>
              </div>
              {#if hasPriceOnRequestItems}
                <p class="text-sm text-amber-700 leading-relaxed">
                  {t('cart.priceOnRequestTotalsNote')}
                </p>
              {/if}
            </div>

            <button
              on:click={async () => {
                // Store promo code in session for checkout
                if (appliedPromo) {
                  sessionStorage.setItem('applied_promo_code', appliedPromo.code);
                }
                goto('/checkout');
              }}
              class="w-full py-4 bg-black text-white font-medium hover:bg-gray-800 transition-colors mb-4"
            >
              {t('cart.proceedToCheckout')}
            </button>

            <a
              href="/shop"
              class="block text-center text-gray-600 hover:text-black transition-colors"
            >
              {t('cart.continueShopping')}
            </a>
          </div>
        </div>
      </div>
    {/if}
  </div>
</main>
