<script lang="ts">
  import { productApi, type Product } from '$lib/api/product.api';
  import { formatPrice } from '$lib/utils/price.utils';
  import { getProductImageAlt } from '$lib/utils/image.utils';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';

  export let relatedProductIds: string[] = [];
  export let showCompleteTheLook: boolean = true;
  export let languageCode: string | undefined = undefined;

  let relatedProducts: Product[] = [];
  let loading = false;
  let currentLoadKey = '';

  async function loadRelatedProducts(ids: string[], locale?: string) {
    const loadKey = `${ids.join(',')}::${locale || ''}`;
    currentLoadKey = loadKey;
    loading = true;
    try {
      const promises = ids.map((id) => productApi.getById(id, locale));
      const responses = await Promise.all(promises);
      if (currentLoadKey !== loadKey) return;
      // Filter out inactive products
      relatedProducts = responses.map((r) => r.product).filter((p) => p.isActive);
    } catch (e) {
      if (currentLoadKey !== loadKey) return;
      console.error('Failed to load related products:', e);
      relatedProducts = [];
    } finally {
      if (currentLoadKey === loadKey) {
        loading = false;
      }
    }
  }

  $: relatedProductsKey = `${relatedProductIds.join(',')}::${languageCode || ''}`;
  $: if (showCompleteTheLook && relatedProductsKey) {
    loadRelatedProducts([...relatedProductIds], languageCode);
  } else {
    currentLoadKey = '';
    relatedProducts = [];
    loading = false;
  }

  function navigateToProduct(product: Product) {
    goto(`/shop/product/${product.slug}`);
  }
</script>

{#if showCompleteTheLook && relatedProducts.length > 0}
  <div class="py-12">
    <h2 class="text-2xl font-bold mb-8 text-left">{t('product.completeTheLook')}</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {#each relatedProducts as relatedProduct}
        <button
          type="button"
          on:click={() => navigateToProduct(relatedProduct)}
          class="group text-left bg-white border border-gray-200 hover:border-black transition-all"
        >
          <div class="aspect-[9/16] overflow-hidden bg-gray-100">
            {#if relatedProduct.images && relatedProduct.images.length > 0}
              <BlurredImage
                src={relatedProduct.images[0].url}
                alt={getProductImageAlt(relatedProduct.images[0].alt, relatedProduct.name)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                fetchPriority="low"
              />
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
