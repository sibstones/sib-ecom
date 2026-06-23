<script lang="ts">
  import { onMount } from 'svelte';
  import { customerApi, type WishlistItem } from '$lib/api/customer.api';
  import { cartStore } from '$lib/stores/cart.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { currencyStore } from '$lib/stores/currency.store';
  import { formatPrice } from '$lib/utils/price.utils';
  import { getProductImageAlt } from '$lib/utils/image.utils';
  import { t } from '$lib/utils/i18n';
  import AccountWishlistSkeleton from '$lib/components/account/AccountWishlistSkeleton.svelte';
  import BlurredImage from '$lib/components/BlurredImage.svelte';

  // Reactive to currency changes
  $: currentCurrency = $currencyStore;

  let items: WishlistItem[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    await loadWishlist();
  });

  async function loadWishlist() {
    loading = true;
    try {
      const response = await customerApi.getWishlist();
      items = response.items;
    } catch (e) {
      error = e instanceof Error ? e.message : t('wishlist.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function removeFromWishlist(productId: string) {
    try {
      await customerApi.removeFromWishlist(productId);
      await loadWishlist();
      notificationStore.success(t('wishlist.removedFromWishlist'));
    } catch (e) {
      notificationStore.error(t('wishlist.failedToRemove'));
    }
  }

  async function addToCart(productId: string) {
    try {
      await cartStore.add(productId, 1);
      /* Cart drawer opens automatically via lastAddedToCartStore */
    } catch (e) {
      notificationStore.error(t('wishlist.failedToAddToCart'));
    }
  }
</script>

{#if $settingsStore.wishlistEnabled}
  <div>
    <h2 class="text-3xl font-bold mb-6">{t('wishlist.wishlist')}</h2>

    {#if loading}
      <AccountWishlistSkeleton />
    {:else if error}
      <p class="text-red-400">{t('common.error')}: {error}</p>
    {:else if items.length === 0}
      <div class="bg-dark-light p-12 text-center">
        <p class="text-xl text-accent-muted mb-4">{t('wishlist.yourWishlistIsEmpty')}</p>
        <a
          href="/shop"
          class="inline-block px-6 py-3 bg-accent text-dark hover:bg-accent-muted transition-colors"
        >
          {t('wishlist.startShopping')}
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {#each items as item}
          <div class="bg-white overflow-hidden">
            <a href="/shop/product/{item.product.slug}" class="group">
              <div class="bg-dark aspect-[9/16] overflow-hidden relative">
                {#if item.product.images && item.product.images.length > 0}
                  <BlurredImage
                    src={item.product.images[0].url}
                    alt={getProductImageAlt(item.product.images[0].alt, item.product.name)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    fetchPriority="low"
                  />
                  {#if !item.product.isActive}
                    <div
                      class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span class="text-white font-semibold text-sm">{t('order.soldOut')}</span>
                    </div>
                  {/if}
                {:else}
                  <div class="w-full h-full flex items-center justify-center">
                    <p class="text-accent-muted">{t('order.noImage')}</p>
                  </div>
                {/if}
              </div>
            </a>
            <div class="p-4">
              <a href="/shop/product/{item.product.slug}">
                <h3 class="text-lg font-medium mb-2 hover:text-accent-muted transition-colors">
                  {item.product.name}
                </h3>
              </a>
              <p class="text-xl font-bold mb-4">
                {item.product.priceOnRequest || item.product.price == null
                  ? t('product.priceOnRequest') || 'Price on request'
                  : formatPrice(item.product.price)}
              </p>
              <div class="flex flex-col gap-2">
                <button
                  on:click={() => addToCart(item.product.id)}
                  class="w-full px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
                >
                  {t('wishlist.addToBag')}
                </button>
                <button
                  on:click={() => removeFromWishlist(item.product.id)}
                  class="w-full px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                  title={t('wishlist.removeFromWishlist')}
                >
                  {t('wishlist.removeFromWishlist')}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div>
    <p class="text-accent-muted">{t('wishlist.wishlistDisabled')}</p>
  </div>
{/if}
