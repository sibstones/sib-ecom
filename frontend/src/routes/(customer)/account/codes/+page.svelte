<script lang="ts">
  import { onMount } from 'svelte';
  import { customerApi } from '$lib/api/customer.api';
  import type { PromoCode } from '$lib/api/promo.api';
  import { t } from '$lib/utils/i18n';
  import AccountCodesSkeleton from '$lib/components/account/AccountCodesSkeleton.svelte';
  import { formatPrice } from '$lib/utils/price.utils';
  import { i18nStore } from '$lib/stores/i18n.store';

  let usedCodes: PromoCode[] = [];
  let availableCodes: PromoCode[] = [];
  let loading = true;
  let error = '';
  let copiedCode: string | null = null;

  onMount(async () => {
    await loadPromoCodes();
  });

  async function loadPromoCodes() {
    loading = true;
    try {
      const response = await customerApi.getPromoCodes();
      usedCodes = response.used;
      availableCodes = response.available;
    } catch (e) {
      error = e instanceof Error ? e.message : t('common.error');
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

  function getDiscountText(code: PromoCode): string {
    if (code.discountType === 'PERCENTAGE') {
      return `${code.discountValue}%`;
    } else {
      return formatPrice(code.discountValue);
    }
  }

  function isExpired(code: PromoCode): boolean {
    return new Date(code.validUntil) < new Date();
  }

  function isActive(code: PromoCode): boolean {
    const now = new Date();
    return (
      code.isActive &&
      new Date(code.validFrom) <= now &&
      new Date(code.validUntil) >= now &&
      (!code.usageLimit || code.usedCount < code.usageLimit)
    );
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      copiedCode = code;
      setTimeout(() => {
        copiedCode = null;
      }, 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  }

  function getStatusText(code: PromoCode): string {
    if (isExpired(code)) {
      return t('promo.expired');
    }
    if (isActive(code)) {
      return t('promo.active');
    }
    return t('promo.inactive');
  }

  function getStatusColor(code: PromoCode): string {
    if (isExpired(code)) {
      return 'bg-gray-500 text-white';
    }
    if (isActive(code)) {
      return 'bg-green-500 text-white';
    }
    return 'bg-gray-400 text-white';
  }
</script>

<div>
  <h2 class="text-3xl font-bold mb-6">{t('account.codes')}</h2>

  {#if loading}
    <AccountCodesSkeleton />
  {:else if error}
    <p class="text-red-400">{t('common.error')}: {error}</p>
  {:else}
    <div class="space-y-8">
      <!-- Available Codes -->
      <div>
        <h3 class="text-2xl font-semibold mb-4">{t('promo.availableCodes')}</h3>
        {#if availableCodes.length === 0}
          <div class="bg-dark-light p-12 text-center">
            <p class="text-xl text-accent-muted">{t('promo.noAvailableCodes')}</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {#each availableCodes as code}
              <div
                class="relative bg-white border-2 border-black shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                <!-- Card Header -->
                <div class="bg-black text-white px-6 py-4 border-b-2 border-black">
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-mono tracking-wider uppercase"
                      >{t('promo.active')}</span
                    >
                    <span class="w-1 h-1 bg-white rounded-full"></span>
                  </div>
                </div>

                <!-- Card Body -->
                <div class="p-6">
                  <!-- Discount Value - Large Display -->
                  <div class="mb-6 text-center border-b-2 border-black pb-6">
                    <div class="text-5xl font-black tracking-tighter mb-2 text-black">
                      {getDiscountText(code)}
                    </div>
                    <div class="text-xs uppercase tracking-widest text-black/60 font-semibold">
                      {t('promo.discountValue')}
                    </div>
                  </div>

                  <!-- Promo Code -->
                  <div class="mb-6">
                    <div class="text-xs uppercase tracking-widest text-black/50 mb-2 font-semibold">
                      {t('common.code')}
                    </div>
                    <div
                      class="text-2xl font-bold font-mono tracking-wider text-black border-2 border-black px-4 py-3 bg-black/5"
                    >
                      {code.code}
                    </div>
                  </div>

                  <!-- Description -->
                  {#if code.description}
                    <div class="mb-6 pb-6 border-b border-black/20">
                      <p class="text-sm text-black/70 leading-relaxed">{code.description}</p>
                    </div>
                  {/if}

                  <!-- Details -->
                  <div class="space-y-3">
                    {#if code.minPurchase}
                      <div
                        class="flex justify-between items-center text-sm border-b border-black/10 pb-2"
                      >
                        <span class="text-black/60 uppercase text-xs tracking-wide"
                          >{t('promo.minPurchase')}</span
                        >
                        <span class="font-semibold text-black">{formatPrice(code.minPurchase)}</span
                        >
                      </div>
                    {/if}
                    <div class="flex justify-between items-center text-sm">
                      <span class="text-black/60 uppercase text-xs tracking-wide"
                        >{t('promo.validUntil')}</span
                      >
                      <span class="font-semibold text-black">{formatDate(code.validUntil)}</span>
                    </div>
                  </div>
                </div>

                <!-- Perforated Edge Effect -->
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-white border-t border-black/20">
                  <div class="flex gap-1 justify-center">
                    {#each Array.from({ length: 20 }) as _}
                      <div class="w-2 h-full border-l border-black/30"></div>
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Used Codes -->
      <div>
        <h3 class="text-2xl font-semibold mb-4">{t('promo.usedCodes')}</h3>
        {#if usedCodes.length === 0}
          <div class="bg-dark-light p-12 text-center">
            <p class="text-xl text-accent-muted">{t('promo.noUsedCodes')}</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {#each usedCodes as code}
              <div
                class="relative bg-white border-2 border-black/30 shadow-md overflow-hidden opacity-75"
              >
                <!-- Card Header -->
                <div class="bg-black/30 text-white px-6 py-4 border-b-2 border-black/30">
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-mono tracking-wider uppercase">{t('promo.used')}</span
                    >
                    <span class="w-1 h-1 bg-white/50 rounded-full"></span>
                  </div>
                </div>

                <!-- Card Body -->
                <div class="p-6">
                  <!-- Discount Value - Large Display -->
                  <div class="mb-6 text-center border-b-2 border-black/30 pb-6">
                    <div class="text-5xl font-black tracking-tighter mb-2 text-black/50">
                      {getDiscountText(code)}
                    </div>
                    <div class="text-xs uppercase tracking-widest text-black/40 font-semibold">
                      {t('promo.discountValue')}
                    </div>
                  </div>

                  <!-- Promo Code -->
                  <div class="mb-6">
                    <div class="text-xs uppercase tracking-widest text-black/40 mb-2 font-semibold">
                      {t('common.code')}
                    </div>
                    <div
                      class="text-2xl font-bold font-mono tracking-wider text-black/50 border-2 border-black/30 px-4 py-3 bg-black/5"
                    >
                      {code.code}
                    </div>
                  </div>

                  <!-- Description -->
                  {#if code.description}
                    <div class="mb-6 pb-6 border-b border-black/10">
                      <p class="text-sm text-black/50 leading-relaxed">{code.description}</p>
                    </div>
                  {/if}

                  <!-- Details -->
                  <div class="space-y-3">
                    <div class="flex justify-between items-center text-sm">
                      <span class="text-black/40 uppercase text-xs tracking-wide"
                        >{t('promo.validUntil')}</span
                      >
                      <span class="font-semibold text-black/50">{formatDate(code.validUntil)}</span>
                    </div>
                  </div>
                </div>

                <!-- Used Overlay -->
                <div class="absolute inset-0 bg-black/5 pointer-events-none">
                  <div
                    class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-12"
                  >
                    <div class="text-6xl font-black text-black/10 tracking-wider uppercase">
                      {t('promo.used')}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
