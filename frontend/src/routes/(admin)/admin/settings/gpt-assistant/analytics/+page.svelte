<script lang="ts">
  import { onMount } from 'svelte';
  import {
    gptAssistantSettingsApi,
    type GPTAssistantAnalytics,
  } from '$lib/api/gpt-assistant-settings.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';

  let analytics: GPTAssistantAnalytics | null = null;
  let loading = true;
  let startDate = '';
  let endDate = '';

  onMount(async () => {
    // Set default dates (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    endDate = end.toISOString().split('T')[0];
    startDate = start.toISOString().split('T')[0];

    await loadAnalytics();
  });

  async function loadAnalytics() {
    loading = true;
    try {
      analytics = await gptAssistantSettingsApi.getAnalytics(startDate, endDate);
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat('ru-RU').format(num);
  }

  function formatPercentage(num: number): string {
    return `${num.toFixed(2)}%`;
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">{t('gptAssistant.analytics.title')}</h1>
    <div class="flex gap-4 items-center">
      <input
        type="date"
        bind:value={startDate}
        on:change={loadAnalytics}
        class="px-4 py-2 border border-gray-300 rounded"
      />
      <span class="text-gray-500">—</span>
      <input
        type="date"
        bind:value={endDate}
        on:change={loadAnalytics}
        class="px-4 py-2 border border-gray-300 rounded"
      />
      <button
        on:click={loadAnalytics}
        class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
      >
        {t('gptAssistant.analytics.refresh')}
      </button>
    </div>
  </div>

  {#if loading}
    <p class="text-gray-500">{t('gptAssistant.loading')}</p>
  {:else if analytics}
    <!-- Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-50 p-6 rounded-lg">
        <h3 class="text-sm text-gray-500 mb-2">{t('gptAssistant.analytics.totalRequests')}</h3>
        <p class="text-3xl font-bold">{formatNumber(analytics.totalRequests)}</p>
      </div>
      <div class="bg-gray-50 p-6 rounded-lg">
        <h3 class="text-sm text-gray-500 mb-2">{t('gptAssistant.analytics.successful')}</h3>
        <p class="text-3xl font-bold text-green-600">
          {formatNumber(analytics.successfulRequests)}
        </p>
        <p class="text-sm text-gray-500 mt-1">{formatPercentage(analytics.successRate)}</p>
      </div>
      <div class="bg-gray-50 p-6 rounded-lg">
        <h3 class="text-sm text-gray-500 mb-2">{t('gptAssistant.analytics.errors')}</h3>
        <p class="text-3xl font-bold text-red-600">{formatNumber(analytics.failedRequests)}</p>
      </div>
      <div class="bg-gray-50 p-6 rounded-lg">
        <h3 class="text-sm text-gray-500 mb-2">{t('gptAssistant.analytics.avgTime')}</h3>
        <p class="text-3xl font-bold">{analytics.avgExecutionTime} мс</p>
      </div>
    </div>

    <!-- User Type Stats -->
    <div class="bg-gray-50 p-6 rounded-lg mb-6">
      <h3 class="text-xl font-medium mb-4">{t('gptAssistant.analytics.byUserType')}</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p class="text-sm text-gray-500">{t('gptAssistant.analytics.admins')}</p>
          <p class="text-2xl font-bold">{formatNumber(analytics.adminRequests)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">{t('gptAssistant.analytics.customers')}</p>
          <p class="text-2xl font-bold">{formatNumber(analytics.customerRequests)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">{t('gptAssistant.analytics.guests')}</p>
          <p class="text-2xl font-bold">{formatNumber(analytics.guestRequests)}</p>
        </div>
      </div>
    </div>

    <!-- Intent Stats -->
    {#if analytics.intentStats && Object.keys(analytics.intentStats).length > 0}
      <div class="bg-gray-50 p-6 rounded-lg">
        <h3 class="text-xl font-medium mb-4">{t('gptAssistant.analytics.topIntents')}</h3>
        <div class="space-y-2">
          {#each Object.entries(analytics.intentStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) as [intent, count]}
            <div class="flex justify-between items-center">
              <span class="font-mono text-sm">{intent}</span>
              <span class="font-bold">{count}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
