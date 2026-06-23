<script lang="ts">
  import { onMount } from 'svelte';
  import { loyaltyApi, type LoyaltyPoints } from '$lib/api/loyalty.api';
  import { settingsStore } from '$lib/stores/settings.store';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';

  let points: LoyaltyPoints | null = null;
  let loading = true;
  let error = '';
  let conversionRate: any = null;

  onMount(async () => {
    await Promise.all([loadPoints(), loadConversionRate()]);
  });

  async function loadPoints() {
    loading = true;
    try {
      const response = await loyaltyApi.getPoints();
      points = response.points;
    } catch (e) {
      error = e instanceof Error ? e.message : t('loyalty.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function loadConversionRate() {
    try {
      const response = await loyaltyApi.getConversionRate();
      conversionRate = response;
    } catch (e) {
      console.error('Failed to load conversion rate');
    }
  }

  function pointsToDollars(points: number): number {
    if (!conversionRate) return 0;
    return points / conversionRate.pointsPerDollarDiscount;
  }
</script>

{#if $settingsStore.loyaltyProgramEnabled}
  <div>
    <h3 class="text-xl font-medium mb-6">{t('loyalty.title')}</h3>

    {#if loading}
      <div class="w-full py-8"><LoadingBar /></div>
    {:else if error}
      <p class="text-red-400">{t('loyalty.error', { message: error })}</p>
    {:else if points}
      <div class="space-y-6">
        <!-- Points Summary -->
        <div class="bg-dark-light p-6">
          <div class="text-center mb-6">
            <p class="text-5xl font-bold mb-2">{points.balance}</p>
            <p class="text-xl text-accent-muted">{t('loyalty.availablePoints')}</p>
            {#if conversionRate}
              <p class="text-sm text-accent-muted mt-2">
                {t('loyalty.inDiscounts', {
                  amount: `$${pointsToDollars(points.balance).toFixed(2)}`,
                })}
              </p>
            {/if}
          </div>

          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <p class="text-sm text-accent-muted mb-1">{t('loyalty.totalEarned')}</p>
              <p class="text-xl font-medium">{points.totalEarned}</p>
            </div>
            <div>
              <p class="text-sm text-accent-muted mb-1">{t('loyalty.totalSpent')}</p>
              <p class="text-xl font-medium">{points.totalSpent}</p>
            </div>
            <div>
              <p class="text-sm text-accent-muted mb-1">{t('loyalty.currentBalance')}</p>
              <p class="text-xl font-medium">{points.balance}</p>
            </div>
          </div>
        </div>

        <!-- How it works -->
        {#if conversionRate}
          <div class="bg-dark-light p-6">
            <h3 class="text-xl font-medium mb-4">{t('loyalty.howItWorks')}</h3>
            <ul class="space-y-2 text-sm text-accent-muted">
              <li>• {t('loyalty.earnPerDollar', { points: conversionRate.pointsPerDollar })}</li>
              <li>
                • {t('loyalty.pointsForDiscount', {
                  points: conversionRate.pointsPerDollarDiscount,
                })}
              </li>
              <li>• {t('loyalty.pointsNeverExpire')}</li>
              <li>• {t('loyalty.useAtCheckout')}</li>
            </ul>
          </div>
        {/if}

        <!-- Transaction History -->
        {#if points.transactions && points.transactions.length > 0}
          <div class="bg-dark-light p-6">
            <h3 class="text-xl font-medium mb-4">{t('loyalty.recentTransactions')}</h3>
            <div class="space-y-2">
              {#each points.transactions as transaction}
                <div class="flex justify-between items-center p-3 bg-dark">
                  <div>
                    <p class="font-medium">
                      {t('loyalty.pointsAmount', {
                        sign: transaction.type === 'EARNED' ? '+' : '-',
                        points: Math.abs(transaction.points),
                      })}
                    </p>
                    {#if transaction.description}
                      <p class="text-sm text-accent-muted">{transaction.description}</p>
                    {/if}
                  </div>
                  <p class="text-sm text-accent-muted">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <div>
    <p class="text-accent-muted">{t('loyalty.programDisabled')}</p>
  </div>
{/if}
