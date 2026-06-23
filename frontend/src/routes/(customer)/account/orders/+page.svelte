<script lang="ts">
  import { onMount } from 'svelte';
  import { customerApi, type Order } from '$lib/api/customer.api';
  import { goto } from '$app/navigation';
  import { formatOrderAmount } from '$lib/utils/price.utils';
  import { t } from '$lib/utils/i18n';
  import { i18nStore } from '$lib/stores/i18n.store';
  import AccountOrdersSkeleton from '$lib/components/account/AccountOrdersSkeleton.svelte';

  let orders: Order[] = [];
  let loading = true;
  let error = '';
  let currentPage = 1;
  let totalPages = 1;

  onMount(async () => {
    await loadOrders();
  });

  async function loadOrders() {
    loading = true;
    try {
      const response = await customerApi.getOrders(currentPage, 20);
      orders = response.orders;
      totalPages = response.pagination.totalPages;
    } catch (e) {
      error = e instanceof Error ? e.message : t('order.failedToLoadOrders');
    } finally {
      loading = false;
    }
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

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      PENDING: 'text-black',
      CONFIRMED: 'text-gray-300',
      PROCESSING: 'text-gray-400',
      SHIPPED: 'text-gray-500',
      DELIVERED: 'text-gray-600',
      CANCELLED: 'text-black',
      REFUNDED: 'text-gray-700',
    };
    return colors[status] || 'text-gray-400';
  }

  function getStatusText(status: string) {
    const statusMap: Record<string, string> = {
      PENDING: t('order.pending'),
      CONFIRMED: t('order.confirmed'),
      PROCESSING: t('order.processing'),
      SHIPPED: t('order.shipped'),
      DELIVERED: t('order.delivered'),
      CANCELLED: t('order.cancelled'),
      REFUNDED: t('order.refunded') || status,
    };
    return statusMap[status] || status;
  }

  function handleImageError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) fallback.classList.remove('hidden');
  }

  function handleThumbnailImageError(e: Event) {
    (e.currentTarget as HTMLImageElement).style.display = 'none';
  }
</script>

<div class="min-w-0">
  <h2 class="text-2xl sm:text-3xl font-bold mb-6">{t('account.orders')}</h2>

  {#if loading}
    <AccountOrdersSkeleton />
  {:else if error}
    <p class="text-red-400">{t('common.error')}: {error}</p>
  {:else if orders.length === 0}
    <div class="bg-dark-light p-12 text-center">
      <p class="text-xl text-accent-muted mb-4">{t('order.noOrdersYet')}</p>
      <a
        href="/shop"
        class="inline-block px-6 py-3 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('order.startShopping')}
      </a>
    </div>
  {:else}
    <div class="space-y-4">
      {#each orders as order}
        <div class="bg-dark-light overflow-hidden flex min-w-0">
          <!-- Left -->
          <div
            class="w-20 sm:w-28 aspect-[9/16] flex-shrink-0 bg-dark overflow-hidden relative group"
          >
            {#if order.items.length > 0 && order.items[0].product.images && order.items[0].product.images.length > 0}
              <img
                src={order.items[0].product.images[0].url}
                alt={order.items[0].product.name}
                class="w-full h-full object-cover"
                on:error={handleImageError}
              />
              <div class="hidden w-full h-full flex items-center justify-center">
                <p class="text-xs text-accent-muted">No image</p>
              </div>
              {#if !order.items[0].product.isActive}
                <div
                  class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span class="text-white font-semibold text-sm">{t('order.soldOut')}</span>
                </div>
              {/if}
            {:else}
              <div class="w-full h-full flex items-center justify-center">
                <p class="text-xs text-accent-muted">No image</p>
              </div>
            {/if}
          </div>

          <!-- Content Right -->
          <div class="flex-1 min-w-0 p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <div class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-4">
                <div class="min-w-0">
                  <h3 class="text-lg sm:text-xl font-medium mb-2 break-words">
                    {t('order.orderHash')}{order.orderNumber}
                  </h3>
                  <p class="text-sm text-accent-muted">
                    {t('order.placedOn')}
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <div class="sm:text-right flex-shrink-0">
                  <p class="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
                    {formatOrderAmount(Number(order.total || 0), order)}
                  </p>
                  <p class="text-sm {getStatusColor(order.status)}">
                    {getStatusText(order.status)}
                  </p>
                </div>
              </div>

              <div class="mb-4">
                <p class="text-sm text-accent-muted mb-2">
                  {order.items.length}
                  {order.items.length === 1 ? t('order.item') : t('order.itemsPlural')}
                </p>
                {#if order.items.length > 1}
                  <div class="flex gap-2 flex-wrap">
                    {#each order.items.slice(1, 4) as item}
                      <div class="w-9 h-16 bg-dark overflow-hidden relative group">
                        {#if item.product.images && item.product.images.length > 0}
                          <img
                            src={item.product.images[0].url}
                            alt={item.product.name}
                            class="w-full h-full object-cover"
                            on:error={handleThumbnailImageError}
                          />
                          {#if !item.product.isActive}
                            <div
                              class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <span class="text-white font-semibold text-xs"
                                >{t('order.soldOut')}</span
                              >
                            </div>
                          {/if}
                        {/if}
                      </div>
                    {/each}
                    {#if order.items.length > 4}
                      <div class="w-9 h-16 bg-dark flex items-center justify-center">
                        <p class="text-xs">+{order.items.length - 4}</p>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <button
              on:click={() => goto(`/account/orders/${order.id}`)}
              class="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black self-stretch sm:self-start text-center sm:text-left"
            >
              {t('order.viewDetails')}
            </button>
          </div>
        </div>
      {/each}

      {#if totalPages > 1}
        <div class="flex items-center justify-center gap-2 mt-8">
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
            >{t('order.pageOf', { page: currentPage, total: totalPages })}</span
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
    </div>
  {/if}
</div>
