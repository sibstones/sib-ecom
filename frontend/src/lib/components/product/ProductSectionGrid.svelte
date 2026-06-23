<script lang="ts">
  import { formatPrice } from '$lib/utils/price.utils';
  import { getProductImageAlt, isVideoUrl } from '$lib/utils/image.utils';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import { settingsStore } from '$lib/stores/settings.store';
  import type { Product } from '$lib/api/product.api';

  export let sectionTitle: string = '';
  export let products: Product[] = [];

  $: shopCardVideoSupport = $settingsStore.shopCardVideoSupport ?? true;
</script>

{#if sectionTitle && products.length > 0}
  <div class="py-12">
    <h2 class="text-2xl font-bold mb-8 text-left">{sectionTitle}</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {#each products as relatedProduct}
        <button
          type="button"
          on:click={() => goto(`/shop/product/${relatedProduct.slug}`)}
          class="group text-left bg-white border border-gray-200 hover:border-black transition-all"
        >
          <div class="aspect-[9/16] overflow-hidden bg-gray-100">
            {#if relatedProduct.images && relatedProduct.images.length > 0}
              {#if shopCardVideoSupport && isVideoUrl(relatedProduct.images[0].url)}
                <video
                  src={relatedProduct.images[0].url}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  muted
                  loop
                  playsinline
                  autoplay
                ></video>
              {:else}
                <img
                  src={relatedProduct.images[0].url}
                  alt={getProductImageAlt(relatedProduct.images[0].alt, relatedProduct.name)}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              {/if}
            {:else}
              <div class="w-full h-full flex items-center justify-center text-gray-400">
                <span class="text-sm">{t('product.noImage')}</span>
              </div>
            {/if}
          </div>
          <div class="p-3">
            <h3 class="text-sm font-medium text-black mb-1 line-clamp-2 group-hover:underline">
              {relatedProduct.name}
            </h3>
            <div class="text-sm font-semibold text-black">
              {#if relatedProduct.priceOnRequest}
                <span class="text-accent-muted">{t('product.priceOnRequest')}</span>
              {:else if relatedProduct.price}
                {formatPrice(relatedProduct.price)}
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}
