<script lang="ts">
  import { onMount } from 'svelte';
  import {
    currencyRateApi,
    type CurrencyRate,
    type CurrencyRateSettings,
    type CurrencyRateProvider,
  } from '$lib/api/currency-rate.api';
  import { supportedCurrencies } from '$lib/stores/currency.store';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';

  let rates: CurrencyRate[] = [];
  let loading = false;
  let saving = false;
  let error = '';

  // API settings for auto rates
  let settings: CurrencyRateSettings | null = null;
  let settingsLoading = false;
  let settingsSaving = false;
  let fetchLoading = false;
  let settingsForm: {
    provider: CurrencyRateProvider;
    apiKey: string;
    baseUrl: string;
    autoUpdateEnabled: boolean;
  } = {
    provider: 'EXCHANGERATE_API',
    apiKey: '',
    baseUrl: '',
    autoUpdateEnabled: false,
  };

  // Form state
  let editingCurrency: string | null = null;
  let editRate: number = 0;
  let editIsActive: boolean = true;

  // New currency form
  let newCurrency: string = '';
  let newRate: number = 0;
  let newIsActive: boolean = true;
  let showAddForm = false;

  const PROVIDERS: { value: CurrencyRateProvider; labelKey: string }[] = [
    { value: 'EXCHANGERATE_API', labelKey: 'currencyRate.providerExchangerateApi' },
    { value: 'FIXER', labelKey: 'currencyRate.providerFixer' },
    { value: 'OPEN_EXCHANGE_RATES', labelKey: 'currencyRate.providerOpenExchangeRates' },
  ];

  onMount(async () => {
    await Promise.all([loadRates(), loadSettings()]);
  });

  async function loadSettings() {
    settingsLoading = true;
    try {
      settings = await currencyRateApi.getSettings();
      settingsForm = {
        provider: settings.provider,
        apiKey: settings.apiKey && !settings.apiKeyMasked ? settings.apiKey : '',
        baseUrl: settings.baseUrl ?? '',
        autoUpdateEnabled: settings.autoUpdateEnabled ?? false,
      };
    } catch (e) {
      console.error('Failed to load currency rate settings:', e);
    } finally {
      settingsLoading = false;
    }
  }

  async function saveSettings() {
    settingsSaving = true;
    error = '';
    try {
      const payload: Parameters<typeof currencyRateApi.updateSettings>[0] = {
        provider: settingsForm.provider,
        baseUrl: settingsForm.baseUrl || null,
        autoUpdateEnabled: settingsForm.autoUpdateEnabled,
      };
      if (settingsForm.apiKey) payload.apiKey = settingsForm.apiKey;
      settings = await currencyRateApi.updateSettings(payload);
      settingsForm.apiKey = ''; // clear after save so we don't send key again
      notificationStore.success(t('currencyRate.settingsSaved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('currencyRate.fetchError'));
    } finally {
      settingsSaving = false;
    }
  }

  async function fetchRatesFromApi() {
    fetchLoading = true;
    error = '';
    try {
      const result = await currencyRateApi.fetchRates();
      notificationStore.success(
        t('currencyRate.fetchSuccess').replace('{count}', String(result?.updated ?? 0))
      );
      await loadRates(true);
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('currencyRate.fetchError'));
    } finally {
      fetchLoading = false;
    }
  }

  async function loadRates(noCache = false) {
    loading = true;
    error = '';
    try {
      const response = await currencyRateApi.getAll(noCache ? { cache: 'no-store' } : undefined);
      const list = response?.rates ?? [];
      // New array reference for Svelte reactivity
      rates = Array.isArray(list) ? [...list] : [];

      // Ensure USD is in the list (it's always 1.0)
      if (!rates.find((r) => r.currency === 'USD')) {
        rates = [{ currency: 'USD', rateToUsd: 1.0, isActive: true }, ...rates];
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t('currencyRate.failedToLoad');
      console.error('Failed to load currency rates:', e);
    } finally {
      loading = false;
    }
  }

  function startEdit(rate: CurrencyRate) {
    editingCurrency = rate.currency;
    editRate = rate.rateToUsd;
    editIsActive = rate.isActive;
  }

  function cancelEdit() {
    editingCurrency = null;
    editRate = 0;
    editIsActive = true;
  }

  async function saveEdit(currency: string) {
    if (currency === 'USD') {
      notificationStore.error(t('currencyRate.usdCannotBeChanged'));
      return;
    }

    saving = true;
    error = '';
    try {
      await currencyRateApi.update(currency, {
        rateToUsd: editRate,
        isActive: editIsActive,
      });
      await loadRates(true);
      editingCurrency = null;
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('currencyRate.failedToUpdate'));
      console.error('Failed to update currency rate:', e);
    } finally {
      saving = false;
    }
  }

  function startAdd() {
    newCurrency = '';
    newRate = 0;
    newIsActive = true;
    showAddForm = true;
  }

  function cancelAdd() {
    showAddForm = false;
    newCurrency = '';
    newRate = 0;
    newIsActive = true;
  }

  async function saveNew() {
    if (!newCurrency || newRate <= 0) {
      notificationStore.error(t('currencyRate.currencyCodeAndRateRequired'));
      return;
    }

    if (newCurrency === 'USD') {
      notificationStore.error(t('currencyRate.usdCannotBeAdded'));
      return;
    }

    if (!supportedCurrencies.includes(newCurrency)) {
      notificationStore.error(
        t('currencyRate.currencyNotSupported')
          .replace('{currency}', newCurrency)
          .replace('{supported}', supportedCurrencies.join(', '))
      );
      return;
    }

    saving = true;
    error = '';
    try {
      await currencyRateApi.upsert({
        currency: newCurrency.toUpperCase(),
        rateToUsd: newRate,
        isActive: newIsActive,
      });
      // Force fresh list (no cache) so new rate appears immediately
      await loadRates(true);
      showAddForm = false;
      newCurrency = '';
      newRate = 0;
      newIsActive = true;
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('currencyRate.failedToCreate'));
      console.error('Failed to create currency rate:', e);
    } finally {
      saving = false;
    }
  }

  async function deleteRate(currency: string) {
    if (currency === 'USD') {
      notificationStore.error(t('currencyRate.usdCannotBeDeleted'));
      return;
    }

    const confirmed = await dialogStore.confirm(
      t('currencyRate.deleteConfirm').replace('{currency}', currency),
      t('currencyRate.deleteRate'),
      t('common.ok'),
      t('common.cancel')
    );
    if (!confirmed) {
      return;
    }

    saving = true;
    error = '';
    try {
      await currencyRateApi.delete(currency);
      await loadRates(true);
      notificationStore.success(t('common.success'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('currencyRate.failedToDelete'));
      console.error('Failed to delete currency rate:', e);
    } finally {
      saving = false;
    }
  }

  async function initializeDefaults() {
    const confirmed = await dialogStore.confirm(
      t('currencyRate.initializeDefaultsConfirm'),
      t('currencyRate.initializeDefaults'),
      t('common.ok'),
      t('common.cancel')
    );
    if (!confirmed) {
      return;
    }

    saving = true;
    error = '';
    try {
      const defaultRates = [
        { currency: 'EUR', rateToUsd: 0.92, isActive: true },
        { currency: 'GBP', rateToUsd: 0.79, isActive: true },
        { currency: 'RUB', rateToUsd: 92.5, isActive: true },
        { currency: 'JPY', rateToUsd: 149.5, isActive: true },
        { currency: 'CNY', rateToUsd: 7.2, isActive: true },
        { currency: 'KRW', rateToUsd: 1330.0, isActive: true },
      ];

      for (const rate of defaultRates) {
        await currencyRateApi.upsert(rate);
      }

      await loadRates();
      notificationStore.success(t('currencyRate.defaultsInitialized'));
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('currencyRate.failedToInitializeDefaults')
      );
      console.error('Failed to initialize default rates:', e);
    } finally {
      saving = false;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('currencyRate.fxCurrencyRates')}</h2>
    <div class="flex gap-4">
      {#if rates.length <= 1}
        <button
          on:click={initializeDefaults}
          disabled={saving}
          class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {t('currencyRate.initializeDefaults')}
        </button>
      {/if}
      <button
        on:click={startAdd}
        disabled={saving || showAddForm}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
      >
        {t('currencyRate.addCurrencyRate')}
      </button>
    </div>
  </div>

  {#if error}
    <div class="mb-4 p-4 bg-gray-100 border border-gray-400 text-black">
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <div class="space-y-4">
      <!-- Add New Currency Form -->
      {#if showAddForm}
        <div class="bg-dark-light p-6 border-2 border-accent">
          <h3 class="text-xl font-medium mb-4">{t('currencyRate.addNewCurrencyRate')}</h3>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label for="currencyCode" class="block text-sm font-medium mb-2"
                >{t('currencyRate.currencyCode')}</label
              >
              <input
                id="currencyCode"
                type="text"
                bind:value={newCurrency}
                placeholder={t('currencyRate.currencyCodePlaceholder')}
                maxlength="3"
                class="w-full px-4 py-2 bg-black border border-gray-600 text-white uppercase"
              />
            </div>
            <div>
              <label for="currencyRateToUsd" class="block text-sm font-medium mb-2"
                >{t('currencyRate.rateToUsd')}</label
              >
              <input
                id="currencyRateToUsd"
                type="number"
                bind:value={newRate}
                step="0.000001"
                min="0.000001"
                placeholder={t('currencyRate.ratePlaceholder')}
                class="w-full px-4 py-2 bg-black border border-gray-600 text-white"
              />
              <p class="text-xs text-accent-muted mt-1">
                {t('currencyRate.rateDisplay')
                  .replace('{rate}', String(newRate ?? ''))
                  .replace('{currency}', newCurrency || 'XXX')}
              </p>
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2">
                <input type="checkbox" bind:checked={newIsActive} class="w-4 h-4" />
                <span class="text-sm">{t('common.active')}</span>
              </label>
            </div>
            <div class="flex items-end gap-2">
              <button
                type="button"
                on:click={saveNew}
                disabled={saving}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 flex-1"
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                on:click={cancelAdd}
                disabled={saving}
                class="px-4 py-2 bg-white border border-gray-400 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Currency Rates List -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('currencyRate.currencyRates')}</h3>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-600">
                <th class="text-left py-3 px-4 font-medium">{t('currencyRate.currency')}</th>
                <th class="text-left py-3 px-4 font-medium">{t('currencyRate.rateToUsd')}</th>
                <th class="text-left py-3 px-4 font-medium">{t('common.status')}</th>
                <th class="text-right py-3 px-4 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {#each rates as rate (rate.currency)}
                <tr class="border-b border-gray-700 hover:bg-dark/50">
                  {#if editingCurrency === rate.currency}
                    <!-- Edit Mode -->
                    <td class="py-3 px-4 font-medium">{rate.currency}</td>
                    <td class="py-3 px-4">
                      <input
                        type="number"
                        bind:value={editRate}
                        step="0.000001"
                        min="0.000001"
                        disabled={rate.currency === 'USD'}
                        class="w-full px-3 py-1 bg-black border border-gray-600 text-white disabled:opacity-50"
                      />
                      <p class="text-xs text-accent-muted mt-1">
                        {t('currencyRate.rateDisplay')
                          .replace('{rate}', String(editRate ?? ''))
                          .replace('{currency}', rate.currency)}
                      </p>
                    </td>
                    <td class="py-3 px-4">
                      <label class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          bind:checked={editIsActive}
                          disabled={rate.currency === 'USD'}
                          class="w-4 h-4 disabled:opacity-50"
                        />
                        <span class="text-sm">{t('common.active')}</span>
                      </label>
                    </td>
                    <td class="py-3 px-4 text-right">
                      <div class="flex justify-end gap-2">
                        <button
                          on:click={() => saveEdit(rate.currency)}
                          disabled={saving || rate.currency === 'USD'}
                          class="px-3 py-1 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 text-sm"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          on:click={cancelEdit}
                          disabled={saving}
                          class="px-3 py-1 bg-white border border-gray-400 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </td>
                  {:else}
                    <!-- View Mode -->
                    <td class="py-3 px-4 font-medium">{rate.currency}</td>
                    <td class="py-3 px-4">
                      <span class="font-medium">{(rate.rateToUsd ?? 0).toFixed(6)}</span>
                      <p class="text-xs text-accent-muted">
                        {t('currencyRate.rateDisplay')
                          .replace('{rate}', String(rate.rateToUsd ?? ''))
                          .replace('{currency}', rate.currency)}
                      </p>
                    </td>
                    <td class="py-3 px-4">
                      <span
                        class="px-2 py-1 text-xs font-medium {rate.isActive
                          ? 'bg-black text-white'
                          : 'bg-gray-300 text-black'}"
                      >
                        {rate.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right">
                      <div class="flex justify-end gap-2">
                        <button
                          on:click={() => startEdit(rate)}
                          disabled={saving || rate.currency === 'USD'}
                          class="px-3 py-1 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 text-sm"
                        >
                          {t('common.edit')}
                        </button>
                        {#if rate.currency !== 'USD'}
                          <button
                            on:click={() => deleteRate(rate.currency)}
                            disabled={saving}
                            class="px-3 py-1 bg-gray-200 text-black border border-gray-400 hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm"
                          >
                            {t('common.delete')}
                          </button>
                        {/if}
                      </div>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- API settings for automatic rates -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-2">{t('currencyRate.apiSettings')}</h3>
        <p class="text-sm text-accent-muted mb-4">{t('currencyRate.apiSettingsHint')}</p>
        {#if settingsLoading}
          <div class="py-4"><LoadingBar /></div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label for="currency-api-provider" class="block text-sm font-medium mb-2"
                >{t('currencyRate.apiProvider')}</label
              >
              <select
                id="currency-api-provider"
                bind:value={settingsForm.provider}
                class="w-full px-4 py-2 bg-black border border-gray-600 text-white"
              >
                {#each PROVIDERS as p}
                  <option value={p.value}>{t(p.labelKey)}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="currency-api-key" class="block text-sm font-medium mb-2"
                >{t('currencyRate.apiKey')}</label
              >
              <input
                id="currency-api-key"
                type="password"
                bind:value={settingsForm.apiKey}
                placeholder={settings?.apiKeyMasked
                  ? '••••••••'
                  : t('currencyRate.apiKeyPlaceholder')}
                autocomplete="off"
                class="w-full px-4 py-2 bg-black border border-gray-600 text-white"
              />
            </div>
            <div class="md:col-span-2">
              <label for="currency-api-baseurl" class="block text-sm font-medium mb-2"
                >{t('currencyRate.baseUrlOptional')}</label
              >
              <input
                id="currency-api-baseurl"
                type="text"
                bind:value={settingsForm.baseUrl}
                placeholder={t('currencyRate.baseUrlPlaceholder')}
                class="w-full px-4 py-2 bg-black border border-gray-600 text-white"
              />
            </div>
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoUpdate"
                bind:checked={settingsForm.autoUpdateEnabled}
                class="w-4 h-4"
              />
              <label for="autoUpdate" class="text-sm">{t('currencyRate.autoUpdateEnabled')}</label>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                on:click={saveSettings}
                disabled={settingsSaving}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
              >
                {settingsSaving ? t('common.loading') : t('currencyRate.saveSettings')}
              </button>
              <button
                type="button"
                on:click={fetchRatesFromApi}
                disabled={fetchLoading || saving}
                class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {fetchLoading ? t('common.loading') : t('currencyRate.fetchRatesNow')}
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Info Box -->
      <div class="bg-gray-100 border border-gray-300 p-4">
        <h4 class="font-medium mb-2 text-black">{t('currencyRate.howItWorks')}</h4>
        <ul class="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>{t('currencyRate.info1')}</li>
          <li>{t('currencyRate.info2')}</li>
          <li>{t('currencyRate.info3')}</li>
          <li>{t('currencyRate.info4')}</li>
        </ul>
      </div>
    </div>
  {/if}
</div>
