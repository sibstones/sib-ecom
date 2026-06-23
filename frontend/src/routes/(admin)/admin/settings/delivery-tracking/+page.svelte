<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.store';
  import type { FeatureSettings } from '$lib/api/settings.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { goto } from '$app/navigation';
  import { deliveryTrackingApi } from '$lib/api/delivery-tracking.api';

  const PROVIDER_OPTIONS = [
    { value: 'RUSSIAN_POST', labelKey: 'settings.deliveryTrackingProviderRussianPost' },
    { value: 'CDEK', labelKey: 'settings.deliveryTrackingProviderCDEK' },
    { value: 'BOXBERRY', labelKey: 'settings.deliveryTrackingProviderBoxberry' },
    { value: 'YANDEX_DELIVERY', labelKey: 'settings.deliveryTrackingProviderYandexDelivery' },
    { value: 'DHL', labelKey: 'settings.deliveryTrackingProviderDHL' },
    { value: 'FEDEX', labelKey: 'settings.deliveryTrackingProviderFedEx' },
    { value: 'UPS', labelKey: 'settings.deliveryTrackingProviderUPS' },
    { value: 'USPS', labelKey: 'settings.deliveryTrackingProviderUSPS' },
    { value: 'ARAMEX', labelKey: 'settings.deliveryTrackingProviderAramex' },
    { value: 'AFTERSHIP', labelKey: 'settings.deliveryTrackingProviderAfterShip' },
    { value: 'TRACKINGMORE', labelKey: 'settings.deliveryTrackingProviderTrackingMore' },
    { value: 'CUSTOM_API', labelKey: 'settings.deliveryTrackingProviderCustom' },
  ] as const;

  const DEFAULT_PROVIDER_URLS: Record<string, string> = {
    RUSSIAN_POST: 'https://otpravka-api.pochta.ru',
    CDEK: 'https://api.cdek.ru',
    BOXBERRY: 'https://api.boxberry.ru',
    YANDEX_DELIVERY: 'https://b2b.taxi.yandex.ru',
    DHL: 'https://api-eu.dhl.com',
    FEDEX: 'https://apis.fedex.com',
    UPS: 'https://onlinetools.ups.com',
    USPS: 'https://secure.shippingapis.com',
    ARAMEX: 'https://ws.aramex.net',
    AFTERSHIP: 'https://api.aftership.com',
    TRACKINGMORE: 'https://api.trackingmore.com',
  };

  let settings = $settingsStore;
  let loading = false;
  let saving = false;
  let testingConnection = false;
  let connectionTestResult: { success: boolean; message: string } | null = null;

  type ProviderRow = { id: string; provider: string; apiKey: string; apiUrl: string };
  let providerRows: ProviderRow[] = [];
  let testingProviderId: string | null = null;
  let providerTestResult: Record<string, { success: boolean; message: string }> = {};

  function parseProviderRowsFromSettings(): ProviderRow[] {
    try {
      const raw = settings.deliveryTrackingProviders || '{}';
      const obj = JSON.parse(raw) as Record<string, { apiKey?: string; apiUrl?: string }>;
      return Object.entries(obj).map(([provider, cred]) => ({
        id: `${provider}-${Date.now()}`,
        provider,
        apiKey: cred?.apiKey ?? '',
        apiUrl: cred?.apiUrl ?? DEFAULT_PROVIDER_URLS[provider] ?? '',
      }));
    } catch {
      return [];
    }
  }

  onMount(async () => {
    await settingsStore.load();
    providerRows = parseProviderRowsFromSettings();
  });

  async function updateSetting(key: keyof FeatureSettings, value: boolean | string | number) {
    saving = true;
    try {
      await settingsStore.updateSetting(key, value);
      notificationStore.success(t('settings.settingUpdated'));
    } catch (e) {
      notificationStore.error(t('error.failedToUpdate'));
    } finally {
      saving = false;
    }
  }

  function buildProvidersJson(): string {
    const obj: Record<string, { apiKey: string; apiUrl: string }> = {};
    for (const row of providerRows) {
      if (row.provider?.trim()) {
        obj[row.provider] = { apiKey: row.apiKey?.trim() ?? '', apiUrl: row.apiUrl?.trim() ?? '' };
      }
    }
    return JSON.stringify(obj);
  }

  async function saveAll() {
    saving = true;
    try {
      const updates = { ...settings, deliveryTrackingProviders: buildProvidersJson() };
      await settingsStore.updateMultiple(updates);
      notificationStore.success(t('settings.savedSuccessfully'));
    } catch (e) {
      notificationStore.error(t('error.failedToSave'));
    } finally {
      saving = false;
    }
  }

  function addProviderRow() {
    providerRows = [
      ...providerRows,
      { id: `new-${Date.now()}`, provider: '', apiKey: '', apiUrl: '' },
    ];
  }

  function removeProviderRow(id: string) {
    providerRows = providerRows.filter((r) => r.id !== id);
  }

  async function testConnectionForProvider(row: ProviderRow) {
    if (!row.apiKey?.trim()) {
      notificationStore.error(t('settings.deliveryTrackingApiKeyRequired'));
      return;
    }
    const apiUrl = row.apiUrl?.trim() || DEFAULT_PROVIDER_URLS[row.provider] || '';
    if (!row.provider || (!apiUrl && row.provider !== 'MANUAL')) {
      notificationStore.error(t('settings.deliveryTrackingApiUrlRequired'));
      return;
    }
    testingProviderId = row.id;
    providerTestResult = { ...providerTestResult, [row.id]: { success: false, message: '' } };
    try {
      const result = await deliveryTrackingApi.testConnection(row.provider, row.apiKey, apiUrl);
      providerTestResult = {
        ...providerTestResult,
        [row.id]: {
          success: result.success ?? false,
          message: result.message || result.error || '',
        },
      };
      if (result.success)
        notificationStore.success(
          result.message || t('settings.deliveryTrackingConnectionSuccess')
        );
      else
        notificationStore.error(
          result.error || result.message || t('settings.deliveryTrackingConnectionFailed')
        );
    } catch (err: any) {
      providerTestResult = {
        ...providerTestResult,
        [row.id]: { success: false, message: err?.message || '' },
      };
      notificationStore.error(err?.message || t('settings.deliveryTrackingConnectionFailed'));
    } finally {
      testingProviderId = null;
    }
  }

  function handleCheckboxChange(key: keyof FeatureSettings, event: Event) {
    const target = event.target;
    if (target && target instanceof HTMLInputElement) {
      const checked = target.checked;
      (settings as unknown as Record<string, unknown>)[key] = checked;
      updateSetting(key, checked);
    }
  }

  async function testConnection() {
    if (!settings.deliveryTrackingApiKey || settings.deliveryTrackingApiKey.trim() === '') {
      notificationStore.error(t('settings.deliveryTrackingApiKeyRequired'));
      return;
    }

    if (settings.deliveryTrackingProvider === 'MANUAL') {
      notificationStore.info(t('settings.deliveryTrackingManualModeNoTest'));
      return;
    }

    let apiUrl = settings.deliveryTrackingApiUrl;
    if (!apiUrl || apiUrl.trim() === '') {
      const defaultUrls: Record<string, string> = {
        RUSSIAN_POST: 'https://otpravka-api.pochta.ru',
        CDEK: 'https://api.cdek.ru',
        BOXBERRY: 'https://api.boxberry.ru',
        YANDEX_DELIVERY: 'https://b2b.taxi.yandex.net',
        DHL: 'https://api-eu.dhl.com',
        FEDEX: 'https://apis.fedex.com',
        UPS: 'https://onlinetools.ups.com',
        USPS: 'https://secure.shippingapis.com',
        ARAMEX: 'https://ws.aramex.net',
        AFTERSHIP: 'https://api.aftership.com',
        TRACKINGMORE: 'https://api.trackingmore.com',
      };
      apiUrl = defaultUrls[settings.deliveryTrackingProvider] || '';
    }

    if (!apiUrl || apiUrl.trim() === '') {
      notificationStore.error(t('settings.deliveryTrackingApiUrlRequired'));
      return;
    }

    testingConnection = true;
    connectionTestResult = null;

    try {
      const result = await deliveryTrackingApi.testConnection(
        settings.deliveryTrackingProvider,
        settings.deliveryTrackingApiKey,
        apiUrl
      );

      connectionTestResult = {
        success: result.success || false,
        message: result.message || result.error || 'Unknown result',
      };

      if (result.success) {
        notificationStore.success(
          result.message || t('settings.deliveryTrackingConnectionSuccess')
        );
      } else {
        notificationStore.error(
          result.error || result.message || t('settings.deliveryTrackingConnectionFailed')
        );
      }
    } catch (error: any) {
      connectionTestResult = {
        success: false,
        message: error.message || t('settings.deliveryTrackingConnectionFailed'),
      };
      notificationStore.error(error.message || t('settings.deliveryTrackingConnectionFailed'));
    } finally {
      testingConnection = false;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <div>
      <h2 class="text-3xl font-bold">{t('settings.deliveryTracking')}</h2>
      <p class="text-accent-muted mt-2">{t('settings.deliveryTrackingPageDescription')}</p>
    </div>
    <div class="flex gap-4">
      <button
        on:click={() => goto('/admin/settings')}
        class="px-6 py-2 bg-white border border-gray-300 text-black hover:bg-gray-100 transition-colors"
      >
        {t('common.back')}
      </button>
      <button
        on:click={saveAll}
        disabled={saving}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
      >
        {t('settings.saveAll')}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <div class="space-y-6">
      <!-- Enable Delivery Tracking -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">{t('settings.enableDeliveryTracking')}</h3>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">{t('settings.enableDeliveryTracking')}</p>
            <p class="text-sm text-accent-muted">
              {t('settings.enableDeliveryTrackingDescription')}
            </p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.deliveryTrackingEnabled}
              on:change={(e) => handleCheckboxChange('deliveryTrackingEnabled', e)}
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
            ></div>
          </label>
        </div>
      </div>

      {#if settings.deliveryTrackingEnabled}
        <!-- Provider Selection -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.deliveryTrackingProvider')}</h3>
          <div>
            <label for="delivery-tracking-provider" class="block text-sm font-medium mb-2"
              >{t('settings.deliveryTrackingProvider')}</label
            >
            <select
              id="delivery-tracking-provider"
              bind:value={settings.deliveryTrackingProvider}
              on:change={() =>
                updateSetting('deliveryTrackingProvider', settings.deliveryTrackingProvider)}
              class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="MANUAL">{t('settings.deliveryTrackingProviderManual')}</option>
              <optgroup label={t('settings.deliveryTrackingProviderGroupRussian')}>
                <option value="RUSSIAN_POST"
                  >{t('settings.deliveryTrackingProviderRussianPost')}</option
                >
                <option value="CDEK">{t('settings.deliveryTrackingProviderCDEK')}</option>
                <option value="BOXBERRY">{t('settings.deliveryTrackingProviderBoxberry')}</option>
                <option value="YANDEX_DELIVERY"
                  >{t('settings.deliveryTrackingProviderYandexDelivery')}</option
                >
              </optgroup>
              <optgroup label={t('settings.deliveryTrackingProviderGroupInternational')}>
                <option value="DHL">{t('settings.deliveryTrackingProviderDHL')}</option>
                <option value="FEDEX">{t('settings.deliveryTrackingProviderFedEx')}</option>
                <option value="UPS">{t('settings.deliveryTrackingProviderUPS')}</option>
                <option value="USPS">{t('settings.deliveryTrackingProviderUSPS')}</option>
                <option value="ARAMEX">{t('settings.deliveryTrackingProviderAramex')}</option>
              </optgroup>
              <optgroup label={t('settings.deliveryTrackingProviderGroupMulti')}>
                <option value="AFTERSHIP">{t('settings.deliveryTrackingProviderAfterShip')}</option>
                <option value="TRACKINGMORE"
                  >{t('settings.deliveryTrackingProviderTrackingMore')}</option
                >
              </optgroup>
              <option value="CUSTOM_API">{t('settings.deliveryTrackingProviderCustom')}</option>
            </select>
            <p class="text-sm text-accent-muted mt-1">
              {t('settings.deliveryTrackingProviderDescription')}
            </p>
          </div>

          {#if settings.deliveryTrackingProvider !== 'MANUAL'}
            <!-- API Key -->
            <div class="mt-4">
              <label for="delivery-tracking-api-key" class="block text-sm font-medium mb-2"
                >{t('settings.deliveryTrackingApiKey')}</label
              >
              <input
                id="delivery-tracking-api-key"
                type="password"
                bind:value={settings.deliveryTrackingApiKey}
                on:change={() =>
                  updateSetting('deliveryTrackingApiKey', settings.deliveryTrackingApiKey)}
                class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={t('settings.deliveryTrackingApiKeyPlaceholder')}
              />
              <p class="text-sm text-accent-muted mt-1">
                {t('settings.deliveryTrackingApiKeyDescription')}
              </p>
              {#if settings.deliveryTrackingProvider === 'DHL'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingDHLApiKeyHint')}
                </p>
              {/if}
              {#if settings.deliveryTrackingProvider === 'FEDEX'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingFedExApiKeyHint')}
                </p>
              {/if}
              {#if settings.deliveryTrackingProvider === 'UPS'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingUPSApiKeyHint')}
                </p>
              {/if}
              {#if settings.deliveryTrackingProvider === 'USPS'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingUSPSApiKeyHint')}
                </p>
              {/if}
              {#if settings.deliveryTrackingProvider === 'ARAMEX'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingAramexApiKeyHint')}
                </p>
              {/if}
              {#if settings.deliveryTrackingProvider === 'AFTERSHIP'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingAfterShipApiKeyHint')}
                </p>
              {/if}
              {#if settings.deliveryTrackingProvider === 'TRACKINGMORE'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingTrackingMoreApiKeyHint')}
                </p>
              {/if}
              {#if settings.deliveryTrackingProvider === 'YANDEX_DELIVERY'}
                <p class="text-xs text-accent-muted mt-1">
                  {t('settings.deliveryTrackingYandexDeliveryApiKeyHint')}
                </p>
              {/if}
            </div>

            <!-- API URL (for custom API and international carriers) -->
            {#if settings.deliveryTrackingProvider === 'CUSTOM_API' || settings.deliveryTrackingProvider === 'DHL' || settings.deliveryTrackingProvider === 'FEDEX' || settings.deliveryTrackingProvider === 'UPS' || settings.deliveryTrackingProvider === 'USPS' || settings.deliveryTrackingProvider === 'ARAMEX' || settings.deliveryTrackingProvider === 'AFTERSHIP' || settings.deliveryTrackingProvider === 'TRACKINGMORE' || settings.deliveryTrackingProvider === 'YANDEX_DELIVERY'}
              <div class="mt-4">
                <label for="delivery-tracking-api-url" class="block text-sm font-medium mb-2"
                  >{t('settings.deliveryTrackingApiUrl')}</label
                >
                <div class="flex gap-2">
                  <input
                    id="delivery-tracking-api-url"
                    type="url"
                    bind:value={settings.deliveryTrackingApiUrl}
                    on:change={() =>
                      updateSetting('deliveryTrackingApiUrl', settings.deliveryTrackingApiUrl)}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder={settings.deliveryTrackingProvider === 'DHL'
                      ? 'https://api-eu.dhl.com'
                      : settings.deliveryTrackingProvider === 'FEDEX'
                        ? 'https://apis.fedex.com'
                        : settings.deliveryTrackingProvider === 'UPS'
                          ? 'https://onlinetools.ups.com'
                          : settings.deliveryTrackingProvider === 'USPS'
                            ? 'https://secure.shippingapis.com'
                            : settings.deliveryTrackingProvider === 'ARAMEX'
                              ? 'https://ws.aramex.net'
                              : settings.deliveryTrackingProvider === 'AFTERSHIP'
                                ? 'https://api.aftership.com'
                                : settings.deliveryTrackingProvider === 'TRACKINGMORE'
                                  ? 'https://api.trackingmore.com'
                                  : settings.deliveryTrackingProvider === 'YANDEX_DELIVERY'
                                    ? 'https://b2b.taxi.yandex.ru'
                                    : 'https://api.example.com'}
                  />
                  <button
                    type="button"
                    on:click={testConnection}
                    disabled={testingConnection ||
                      !settings.deliveryTrackingApiKey ||
                      settings.deliveryTrackingApiKey.trim() === ''}
                    class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {testingConnection
                      ? t('settings.testingConnection')
                      : t('settings.testConnection')}
                  </button>
                </div>
                <p class="text-sm text-accent-muted mt-1">
                  {t('settings.deliveryTrackingApiUrlDescription')}
                </p>

                {#if connectionTestResult}
                  <div
                    class={`mt-2 p-3 rounded ${connectionTestResult.success ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}
                  >
                    <p
                      class={`text-sm ${connectionTestResult.success ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {connectionTestResult.success ? '✓' : '✗'}
                      {connectionTestResult.message}
                    </p>
                  </div>
                {/if}
              </div>
            {/if}
          {/if}
        </div>

        <!-- Yandex Geocoder: required for address geocoding when using Yandex Delivery -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.yandexGeocoderTitle')}</h3>
          <p class="text-sm text-accent-muted mb-4">{t('settings.yandexGeocoderDescription')}</p>
          <div>
            <label for="yandex-geocoder-api-key" class="block text-sm font-medium mb-2"
              >{t('settings.yandexGeocoderApiKey')}</label
            >
            <input
              id="yandex-geocoder-api-key"
              type="password"
              bind:value={settings.yandexGeocoderApiKey}
              on:change={() => updateSetting('yandexGeocoderApiKey', settings.yandexGeocoderApiKey)}
              class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            <p class="text-sm text-accent-muted mt-1">{t('settings.yandexGeocoderApiKeyHint')}</p>
          </div>
        </div>

        <!-- Multiple providers (keys per carrier): used when marking order as shipped with a carrier -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">
            {t('settings.deliveryTrackingMultipleProviders')}
          </h3>
          <p class="text-sm text-accent-muted mb-4">
            {t('settings.deliveryTrackingMultipleProvidersDescription')}
          </p>
          <div class="space-y-4">
            {#each providerRows as row (row.id)}
              <div class="p-4 border border-white/10 rounded flex flex-wrap items-end gap-3">
                <div class="min-w-[140px]">
                  <label for={`deliveryProvider-${row.id}`} class="block text-xs font-medium mb-1"
                    >{t('settings.deliveryTrackingProvider')}</label
                  >
                  <select
                    id={`deliveryProvider-${row.id}`}
                    bind:value={row.provider}
                    class="w-full px-3 py-2 bg-white border border-gray-300 rounded text-black text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">—</option>
                    {#each PROVIDER_OPTIONS as opt}
                      <option value={opt.value}>{t(opt.labelKey)}</option>
                    {/each}
                  </select>
                </div>
                <div class="flex-1 min-w-[160px]">
                  <label for={`deliveryApiKey-${row.id}`} class="block text-xs font-medium mb-1"
                    >{t('settings.deliveryTrackingApiKey')}</label
                  >
                  <input
                    id={`deliveryApiKey-${row.id}`}
                    type="password"
                    bind:value={row.apiKey}
                    class="w-full px-3 py-2 bg-white border border-gray-300 rounded text-black text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder={t('settings.deliveryTrackingApiKeyPlaceholder')}
                  />
                </div>
                <div class="flex-1 min-w-[200px]">
                  <label for={`deliveryApiUrl-${row.id}`} class="block text-xs font-medium mb-1"
                    >{t('settings.deliveryTrackingApiUrl')}</label
                  >
                  <input
                    id={`deliveryApiUrl-${row.id}`}
                    type="url"
                    bind:value={row.apiUrl}
                    placeholder={row.provider ? DEFAULT_PROVIDER_URLS[row.provider] : ''}
                    class="w-full px-3 py-2 bg-white border border-gray-300 rounded text-black text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    on:click={() => testConnectionForProvider(row)}
                    disabled={testingProviderId !== null || !row.provider || !row.apiKey?.trim()}
                    class="px-3 py-2 bg-accent text-dark text-sm hover:bg-accent-muted transition-colors disabled:opacity-50"
                  >
                    {testingProviderId === row.id
                      ? t('settings.testingConnection')
                      : t('settings.testConnection')}
                  </button>
                  <button
                    type="button"
                    on:click={() => removeProviderRow(row.id)}
                    class="px-3 py-2 border border-red-500/50 text-red-500 text-sm hover:bg-red-500/10 transition-colors"
                  >
                    {t('settings.deliveryTrackingRemoveProvider')}
                  </button>
                </div>
                {#if providerTestResult[row.id]}
                  <div class="w-full mt-1">
                    <span
                      class={`text-xs ${providerTestResult[row.id].success ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {providerTestResult[row.id].success ? '✓' : '✗'}
                      {providerTestResult[row.id].message}
                    </span>
                  </div>
                {/if}
              </div>
            {/each}
            <button
              type="button"
              on:click={addProviderRow}
              class="px-4 py-2 border border-dashed border-white/30 text-accent-muted hover:border-accent hover:text-accent transition-colors"
            >
              {t('settings.deliveryTrackingAddProvider')}
            </button>
          </div>
        </div>

        <!-- Auto Update Settings -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">{t('settings.deliveryTrackingAutoUpdate')}</h3>
          <div class="space-y-6">
            <!-- Auto Update -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.deliveryTrackingAutoUpdate')}</p>
                <p class="text-sm text-accent-muted">
                  {t('settings.deliveryTrackingAutoUpdateDescription')}
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.deliveryTrackingAutoUpdate}
                  disabled={!settings.deliveryTrackingEnabled}
                  on:change={(e) => handleCheckboxChange('deliveryTrackingAutoUpdate', e)}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>

            {#if settings.deliveryTrackingAutoUpdate}
              <!-- Update Interval -->
              <div>
                <label
                  for="delivery-tracking-update-interval"
                  class="block text-sm font-medium mb-2"
                  >{t('settings.deliveryTrackingUpdateInterval')}</label
                >
                <input
                  id="delivery-tracking-update-interval"
                  type="number"
                  bind:value={settings.deliveryTrackingUpdateInterval}
                  on:change={() =>
                    updateSetting(
                      'deliveryTrackingUpdateInterval',
                      Number(settings.deliveryTrackingUpdateInterval)
                    )}
                  class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-accent"
                  min="1"
                  max="1440"
                />
                <p class="text-sm text-accent-muted mt-1">
                  {t('settings.deliveryTrackingUpdateIntervalDescription')}
                </p>
              </div>
            {/if}
          </div>
        </div>

        <!-- Auto Status Management -->
        <div class="bg-dark-light p-6">
          <h3 class="text-xl font-medium mb-4">
            {t('settings.deliveryTrackingAutoStatusManagement')}
          </h3>
          <div class="space-y-6">
            <!-- Auto Mark Delivered -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.deliveryTrackingAutoMarkDelivered')}</p>
                <p class="text-sm text-accent-muted">
                  {t('settings.deliveryTrackingAutoMarkDeliveredDescription')}
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.deliveryTrackingAutoMarkDelivered}
                  disabled={!settings.deliveryTrackingEnabled}
                  on:change={(e) => handleCheckboxChange('deliveryTrackingAutoMarkDelivered', e)}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>

            <!-- Auto Mark Not Received -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.deliveryTrackingAutoMarkNotReceived')}</p>
                <p class="text-sm text-accent-muted">
                  {t('settings.deliveryTrackingAutoMarkNotReceivedDescription')}
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.deliveryTrackingAutoMarkNotReceived}
                  disabled={!settings.deliveryTrackingEnabled}
                  on:change={(e) => handleCheckboxChange('deliveryTrackingAutoMarkNotReceived', e)}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>

            {#if settings.deliveryTrackingAutoMarkNotReceived}
              <!-- Not Received Days -->
              <div>
                <label
                  for="delivery-tracking-not-received-days"
                  class="block text-sm font-medium mb-2"
                  >{t('settings.deliveryTrackingNotReceivedDays')}</label
                >
                <input
                  id="delivery-tracking-not-received-days"
                  type="number"
                  bind:value={settings.deliveryTrackingNotReceivedDays}
                  on:change={() =>
                    updateSetting(
                      'deliveryTrackingNotReceivedDays',
                      Number(settings.deliveryTrackingNotReceivedDays)
                    )}
                  class="w-full px-4 py-2 bg-white border border-gray-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-accent"
                  min="1"
                  max="365"
                />
                <p class="text-sm text-accent-muted mt-1">
                  {t('settings.deliveryTrackingNotReceivedDaysDescription')}
                </p>
              </div>
            {/if}

            <!-- Auto Mark Returned -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{t('settings.deliveryTrackingAutoMarkReturned')}</p>
                <p class="text-sm text-accent-muted">
                  {t('settings.deliveryTrackingAutoMarkReturnedDescription')}
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.deliveryTrackingAutoMarkReturned}
                  disabled={!settings.deliveryTrackingEnabled}
                  on:change={(e) => handleCheckboxChange('deliveryTrackingAutoMarkReturned', e)}
                  class="sr-only peer disabled:opacity-50"
                />
                <div
                  class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white disabled:opacity-50"
                ></div>
              </label>
            </div>
          </div>
        </div>
      {:else}
        <div class="bg-dark-light p-6">
          <p class="text-accent-muted">{t('settings.deliveryTrackingDisabledMessage')}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>
