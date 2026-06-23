<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import {
    onboardingStore,
    onboardingLoadingStore,
    ONBOARDING_STEPS,
  } from '$lib/stores/onboarding.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { settingsApi } from '$lib/api/settings.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { countryApi, type Country } from '$lib/api/country.api';
  import { supportedCurrencies } from '$lib/stores/currency.store';
  import { normalizeUploadFile } from '$lib/utils/file-upload';
  import {
    gptAssistantSettingsApi,
    type GPTAssistantSettings,
  } from '$lib/api/gpt-assistant-settings.api';

  let step = 0;
  let storeName = '';
  let frontendBaseUrl = '';
  let gptEnabledCustomer = true;
  let gptApiKey = '';
  let gptModel = 'gpt-4o-mini';
  let hasSavedGptApiKey = false;
  let testingGptConnection = false;
  let brandsEnabled = true;
  let lookbookEnabled = false;
  let reviewsEnabled = true;
  let wishlistEnabled = true;
  let fontFamily = 'Helvetica';
  let colorAccent = '#1c1b1b';
  let borderRadiusCard = '0rem';
  let borderRadiusButton = '0rem';
  let siteFaviconUrl = '';
  let siteAppleTouchIconUrl = '';
  let faviconUploading = false;
  let appleTouchUploading = false;
  let emailEnabled = false;
  let emailProvider = 'NODEMAILER';
  let emailFromEmail = '';
  let emailFromName = '';
  let emailNodemailerHost = '';
  let emailNodemailerPort = 587;
  let emailNodemailerSecure = false;
  let emailNodemailerUser = '';
  let emailNodemailerPassword = '';
  let emailTestTo = '';
  let testingEmail = false;
  let languages: Language[] = [];
  let countries: Country[] = [];
  let selectedLanguageIds: string[] = [];
  let selectedCountryIds: string[] = [];
  let defaultLanguageId = '';
  let defaultCountryId = '';
  let selectedCurrencyCodes: string[] = [];
  let defaultCurrencyCode = 'USD';
  let saving = false;

  $: state = $onboardingStore;
  $: loading = $onboardingLoadingStore;

  $: STEP_LABELS = [
    t('onboarding.stepWelcome'),
    t('onboarding.stepStore'),
    t('onboarding.stepCatalog'),
    t('onboarding.stepWarehouses'),
    t('onboarding.stepDesign'),
    t('onboarding.stepContent'),
    t('onboarding.stepEmail'),
    t('onboarding.stepComplete'),
  ];

  const FONT_OPTIONS = [
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Playfair Display', label: 'Playfair Display' },
  ];

  onMount(async () => {
    const [s, _settingsLoaded, languageResponse, countryResponse, gptSettings] = await Promise.all([
      onboardingStore.load(),
      settingsStore.load(),
      languageApi.getAll(false),
      countryApi.getAll(false),
      gptAssistantSettingsApi.getSettings().catch(() => null),
    ]);
    if (s?.completedAt) {
      goto('/admin/dashboard');
      return;
    }
    languages = languageResponse.languages;
    countries = countryResponse.countries;
    step = s?.currentStep ?? 0;
    const d = s?.data ?? {};
    storeName = d.storeName ?? '';
    frontendBaseUrl =
      d.frontendBaseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
    hasSavedGptApiKey = gptSettings?.apiKey === '***hidden***';
    gptEnabledCustomer = d.gptEnabledCustomer ?? gptSettings?.enabledCustomer ?? true;
    gptModel = d.gptModel ?? gptSettings?.model ?? 'gpt-4o-mini';
    selectedLanguageIds = Array.isArray(d.languageIds)
      ? d.languageIds
      : languages.filter((language) => language.isActive).map((language) => language.id);
    selectedCountryIds = Array.isArray(d.countryIds)
      ? d.countryIds
      : countries.filter((country) => country.isActive).map((country) => country.id);
    selectedCurrencyCodes = Array.isArray(d.currencyCodes) ? d.currencyCodes : supportedCurrencies;
    defaultLanguageId =
      d.defaultLanguageId ??
      languages.find((language) => language.isDefault)?.id ??
      selectedLanguageIds[0] ??
      '';
    defaultCountryId =
      d.defaultCountryId ??
      countries.find((country) => country.isDefault)?.id ??
      selectedCountryIds[0] ??
      '';
    defaultCurrencyCode = d.defaultCurrencyCode ?? selectedCurrencyCodes[0] ?? 'USD';
    brandsEnabled = d.brandsEnabled ?? true;
    lookbookEnabled = d.lookbookEnabled ?? false;
    reviewsEnabled = d.reviewsEnabled ?? true;
    wishlistEnabled = d.wishlistEnabled ?? true;
    fontFamily = d.fontFamily ?? $settingsStore.fontFamily ?? 'Helvetica';
    colorAccent = d.colorAccent ?? $settingsStore.colorAccent ?? '#1c1b1b';
    borderRadiusCard = d.borderRadiusCard ?? $settingsStore.borderRadiusCard ?? '0rem';
    borderRadiusButton = d.borderRadiusButton ?? $settingsStore.borderRadiusButton ?? '0rem';
    siteFaviconUrl = d.siteFaviconUrl ?? $settingsStore.siteFaviconUrl ?? '';
    siteAppleTouchIconUrl = d.siteAppleTouchIconUrl ?? $settingsStore.siteAppleTouchIconUrl ?? '';
    emailEnabled = d.emailEnabled ?? $settingsStore.emailEnabled ?? false;
    emailProvider = d.emailProvider ?? $settingsStore.emailProvider ?? 'NODEMAILER';
    emailFromEmail = d.emailFromEmail ?? $settingsStore.emailFromEmail ?? '';
    emailFromName = d.emailFromName ?? $settingsStore.emailFromName ?? storeName ?? 'Fashion Store';
    emailNodemailerHost = d.emailNodemailerHost ?? $settingsStore.emailNodemailerHost ?? '';
    emailNodemailerPort = d.emailNodemailerPort ?? $settingsStore.emailNodemailerPort ?? 587;
    emailNodemailerSecure =
      d.emailNodemailerSecure ?? $settingsStore.emailNodemailerSecure ?? false;
    emailNodemailerUser = d.emailNodemailerUser ?? $settingsStore.emailNodemailerUser ?? '';
    emailTestTo = d.emailTestTo ?? $settingsStore.emailFromEmail ?? '';
  });

  async function applyGptSettings() {
    const current = await gptAssistantSettingsApi.getSettings().catch(() => null);
    const payload: Partial<GPTAssistantSettings> = {
      enabledAdmin: current?.enabledAdmin ?? true,
      enabledCustomer: gptEnabledCustomer,
      enabledGuest: current?.enabledGuest ?? false,
      model: gptModel.trim() || current?.model || 'gpt-4o-mini',
      providerType: current?.providerType ?? 'openai',
      mode:
        gptEnabledCustomer && current?.mode === 'disabled'
          ? 'production'
          : (current?.mode ?? 'production'),
    };

    if (gptApiKey.trim()) {
      payload.apiKey = gptApiKey.trim();
    }

    const updated = await gptAssistantSettingsApi.updateSettings(payload);
    hasSavedGptApiKey = updated.apiKey === '***hidden***';
    gptApiKey = '';
  }

  async function testGptConnection() {
    testingGptConnection = true;
    try {
      const result = await gptAssistantSettingsApi.testConnection({
        providerType: 'openai',
        mode: 'production',
        apiKey: gptApiKey.trim() || undefined,
        model: gptModel.trim() || 'gpt-4o-mini',
      });

      if (result.success) {
        notificationStore.success(result.message || t('gptAssistant.connectionSuccess'));
        if (gptApiKey.trim()) {
          hasSavedGptApiKey = true;
        }
      } else {
        notificationStore.error(result.error || t('gptAssistant.connectionError'));
      }
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('gptAssistant.connectionError'));
    } finally {
      testingGptConnection = false;
    }
  }

  async function applyToSettings() {
    try {
      await settingsStore.load();
      await settingsStore.updateSetting(
        'frontendBaseUrl',
        frontendBaseUrl || 'http://localhost:5173'
      );
      await settingsStore.updateSetting('emailFromName', storeName || 'Fashion Store');
      await settingsStore.updateSetting('brandsEnabled', brandsEnabled);
      await settingsStore.updateSetting('lookbookEnabled', lookbookEnabled);
      await settingsStore.updateSetting('reviewsEnabled', reviewsEnabled);
      await settingsStore.updateSetting('wishlistEnabled', wishlistEnabled);
    } catch (e) {
      console.error('Failed to apply onboarding to settings:', e);
    }
  }

  async function applyLocalizationSelections() {
    const selectedLanguages = new Set(selectedLanguageIds);
    const selectedCountries = new Set(selectedCountryIds);

    await Promise.all(
      languages.map((language) =>
        languageApi.update(language.id, {
          isActive: selectedLanguages.has(language.id),
        })
      )
    );

    await Promise.all(
      countries.map((country) =>
        countryApi.update(country.id, {
          isActive: selectedCountries.has(country.id),
        })
      )
    );

    if (defaultLanguageId && selectedLanguages.has(defaultLanguageId)) {
      await languageApi.setDefault(defaultLanguageId);
    }

    if (defaultCountryId && selectedCountries.has(defaultCountryId)) {
      await countryApi.setDefault(defaultCountryId);
    }
  }

  async function applyCurrencySelections() {
    await settingsStore.updateMultiple({
      storeCurrencies: selectedCurrencyCodes,
      defaultStoreCurrency: defaultCurrencyCode,
    });
  }

  function toggleLanguage(id: string) {
    if (selectedLanguageIds.includes(id)) {
      selectedLanguageIds = selectedLanguageIds.filter((item) => item !== id);
      if (defaultLanguageId === id) {
        defaultLanguageId = selectedLanguageIds[0] ?? '';
      }
      return;
    }

    selectedLanguageIds = [...selectedLanguageIds, id];
    if (!defaultLanguageId) {
      defaultLanguageId = id;
    }
  }

  function toggleCountry(id: string) {
    if (selectedCountryIds.includes(id)) {
      selectedCountryIds = selectedCountryIds.filter((item) => item !== id);
      if (defaultCountryId === id) {
        defaultCountryId = selectedCountryIds[0] ?? '';
      }
      return;
    }

    selectedCountryIds = [...selectedCountryIds, id];
    if (!defaultCountryId) {
      defaultCountryId = id;
    }
  }

  function toggleCurrency(code: string) {
    if (selectedCurrencyCodes.includes(code)) {
      selectedCurrencyCodes = selectedCurrencyCodes.filter((item) => item !== code);
      if (defaultCurrencyCode === code) {
        defaultCurrencyCode = selectedCurrencyCodes[0] ?? 'USD';
      }
      return;
    }

    selectedCurrencyCodes = [...selectedCurrencyCodes, code];
    if (!defaultCurrencyCode) {
      defaultCurrencyCode = code;
    }
  }

  async function applyDesignToSettings() {
    try {
      await settingsStore.load();
      await settingsStore.updateMultiple({
        fontFamily,
        colorAccent,
        borderRadiusCard,
        borderRadiusButton,
        siteFaviconUrl,
        siteAppleTouchIconUrl,
      });
    } catch (e) {
      console.error('Failed to apply design to settings:', e);
    }
  }

  async function handleFaviconUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    faviconUploading = true;
    try {
      const { url } = await settingsApi.uploadSiteFavicon(normalizeUploadFile(file));
      siteFaviconUrl = url;
      notificationStore.success(t('settings.siteFaviconUploaded'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('error.failedToUpdate'));
    } finally {
      faviconUploading = false;
    }
  }

  async function clearSiteFavicon() {
    siteFaviconUrl = '';
  }

  async function handleAppleTouchUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    appleTouchUploading = true;
    try {
      const { url } = await settingsApi.uploadSiteAppleTouchIcon(normalizeUploadFile(file));
      siteAppleTouchIconUrl = url;
      notificationStore.success(t('settings.siteAppleTouchIconUploaded'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('error.failedToUpdate'));
    } finally {
      appleTouchUploading = false;
    }
  }

  async function clearSiteAppleTouchIcon() {
    siteAppleTouchIconUrl = '';
  }

  function validateEmailSettings(): boolean {
    if (!emailEnabled) {
      return true;
    }
    if (!emailFromEmail.trim() || !emailFromName.trim()) {
      notificationStore.error(t('onboarding.emailFromRequired'));
      return false;
    }
    if (emailProvider === 'NODEMAILER') {
      if (
        !emailNodemailerHost.trim() ||
        !emailNodemailerUser.trim() ||
        !emailNodemailerPassword.trim()
      ) {
        notificationStore.error(t('onboarding.emailSmtpRequired'));
        return false;
      }
    }
    return true;
  }

  async function applyEmailSettings() {
    await settingsStore.updateMultiple({
      emailEnabled,
      emailProvider,
      emailFromEmail,
      emailFromName,
      emailNodemailerHost,
      emailNodemailerPort,
      emailNodemailerSecure,
      emailNodemailerUser,
      emailNodemailerPassword,
    });
  }

  async function testEmailSettings() {
    if (!validateEmailSettings()) {
      return;
    }
    if (emailProvider !== 'NODEMAILER') {
      notificationStore.error(t('onboarding.emailOnlySmtpInOnboarding'));
      return;
    }

    testingEmail = true;
    try {
      await applyEmailSettings();
      const result = await settingsApi.testEmail((emailTestTo || emailFromEmail).trim());
      if (result.success) {
        notificationStore.success(result.message || t('marketing.testEmailSent'));
      } else {
        notificationStore.error(result.error || t('marketing.failedToSendTestEmail'));
      }
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('marketing.failedToSendTestEmail')
      );
    } finally {
      testingEmail = false;
    }
  }

  async function handleNext() {
    saving = true;
    try {
      if (step === 0) {
        step = 1;
        await onboardingStore.updateStep(1);
      } else if (step === 1) {
        if (selectedLanguageIds.length === 0) {
          notificationStore.error(t('onboarding.languagesRequired'));
          return;
        }
        if (selectedCountryIds.length === 0) {
          notificationStore.error(t('onboarding.regionsRequired'));
          return;
        }
        if (selectedCurrencyCodes.length === 0) {
          notificationStore.error(t('onboarding.currenciesRequired'));
          return;
        }
        if (!defaultLanguageId || !selectedLanguageIds.includes(defaultLanguageId)) {
          defaultLanguageId = selectedLanguageIds[0] ?? '';
        }
        if (!defaultCountryId || !selectedCountryIds.includes(defaultCountryId)) {
          defaultCountryId = selectedCountryIds[0] ?? '';
        }
        if (!defaultCurrencyCode || !selectedCurrencyCodes.includes(defaultCurrencyCode)) {
          defaultCurrencyCode = selectedCurrencyCodes[0] ?? 'USD';
        }
        if (gptEnabledCustomer && !gptApiKey.trim() && !hasSavedGptApiKey) {
          notificationStore.error(t('onboarding.gptApiKeyRequired'));
          return;
        }
        if (gptEnabledCustomer && !gptModel.trim()) {
          notificationStore.error(t('onboarding.gptModelRequired'));
          return;
        }
        await onboardingStore.updateStep(2, {
          storeName: storeName.trim() || undefined,
          frontendBaseUrl: frontendBaseUrl.trim() || undefined,
          gptEnabledCustomer,
          gptModel: gptModel.trim() || undefined,
          languageIds: selectedLanguageIds,
          defaultLanguageId: defaultLanguageId || undefined,
          countryIds: selectedCountryIds,
          defaultCountryId: defaultCountryId || undefined,
          currencyCodes: selectedCurrencyCodes,
          defaultCurrencyCode: defaultCurrencyCode || undefined,
        });
        await applyToSettings();
        await applyLocalizationSelections();
        await applyCurrencySelections();
        await applyGptSettings();
        step = 2;
      } else if (step === 2) {
        await onboardingStore.updateStep(3, {
          brandsEnabled,
          lookbookEnabled,
          reviewsEnabled,
          wishlistEnabled,
        });
        await applyToSettings();
        step = 3;
      } else if (step === 3) {
        await onboardingStore.updateStep(4);
        step = 4;
      } else if (step === 4) {
        await onboardingStore.updateStep(5, {
          fontFamily,
          colorAccent,
          borderRadiusCard,
          borderRadiusButton,
          siteFaviconUrl: siteFaviconUrl || undefined,
          siteAppleTouchIconUrl: siteAppleTouchIconUrl || undefined,
        });
        await applyDesignToSettings();
        step = 5;
      } else if (step === 5) {
        await onboardingStore.updateStep(6);
        step = 6;
      } else if (step === 6) {
        if (!validateEmailSettings()) {
          return;
        }
        await onboardingStore.updateStep(7, {
          emailEnabled,
          emailProvider,
          emailFromEmail: emailFromEmail.trim() || undefined,
          emailFromName: emailFromName.trim() || undefined,
          emailNodemailerHost: emailNodemailerHost.trim() || undefined,
          emailNodemailerPort,
          emailNodemailerSecure,
          emailNodemailerUser: emailNodemailerUser.trim() || undefined,
          emailTestTo: emailTestTo.trim() || undefined,
        });
        await applyEmailSettings();
        step = 7;
      } else if (step === 7) {
        await onboardingStore.complete();
        notificationStore.success(t('onboarding.completeTitle'));
        goto('/admin/dashboard');
      }
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  function handleBack() {
    if (step > 0) {
      step -= 1;
      onboardingStore.updateStep(step);
    }
  }

  async function handleSkip() {
    saving = true;
    try {
      await onboardingStore.skip();
      goto('/admin/dashboard');
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to skip');
    } finally {
      saving = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 md:p-8">
  {#if loading && !state}
    <div class="w-full max-w-xl animate-pulse">
      <div class="h-4 bg-gray-200 rounded w-3/4 mb-8"></div>
      <div class="bg-white rounded-xl shadow-lg h-64"></div>
    </div>
  {:else}
    <div class="w-full max-w-xl">
      <!-- Progress -->
      <div class="mb-8">
        <div class="flex flex-wrap gap-x-3 gap-y-1.5 text-sm mb-3">
          {#each Array(ONBOARDING_STEPS) as _, i}
            <span
              class="transition-colors {step === i ? 'font-semibold text-accent' : 'text-gray-400'}"
            >
              {i + 1}. {STEP_LABELS[i]}
            </span>
          {/each}
        </div>
        <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-accent transition-all duration-300"
            style="width: {((step + 1) / ONBOARDING_STEPS) * 100}%"
          ></div>
        </div>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <!-- Step 0: Welcome -->
        {#if step === 0}
          <div class="p-8 md:p-10 text-center">
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {t('onboarding.welcomeTitle')}
            </h1>
            <p class="text-gray-600 mb-8 max-w-md mx-auto">
              {t('onboarding.welcomeDesc')}
            </p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                on:click={handleNext}
                disabled={saving}
                class="btn btn-primary px-8 py-3"
              >
                {t('onboarding.startSetup')}
              </button>
              <button
                type="button"
                on:click={handleSkip}
                disabled={saving}
                class="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-8 py-3"
              >
                {t('onboarding.skipAll')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 1: Store basics -->
        {#if step === 1}
          <div class="p-8 md:p-10">
            <h2 class="text-xl font-bold text-gray-900 mb-2">{t('onboarding.storeTitle')}</h2>
            <p class="text-gray-600 text-sm mb-6">{t('onboarding.storeDesc')}</p>
            <div class="space-y-4">
              <div>
                <label for="storeName" class="block text-sm font-medium text-gray-700 mb-1">
                  {t('onboarding.storeName')}
                </label>
                <input
                  id="storeName"
                  type="text"
                  bind:value={storeName}
                  placeholder={t('onboarding.storeNamePlaceholder')}
                  class="input w-full"
                />
              </div>
              <div>
                <label for="frontendUrl" class="block text-sm font-medium text-gray-700 mb-1">
                  {t('onboarding.frontendUrl')}
                </label>
                <input
                  id="frontendUrl"
                  type="url"
                  bind:value={frontendBaseUrl}
                  placeholder={t('onboarding.frontendUrlPlaceholder')}
                  class="input w-full"
                />
              </div>
              <div class="pt-2">
                <div class="rounded-xl border border-gray-200 p-4 space-y-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-sm font-medium text-gray-900">{t('onboarding.gptTitle')}</h3>
                      <p class="text-xs text-gray-500">{t('onboarding.gptDesc')}</p>
                    </div>
                    <label class="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" bind:checked={gptEnabledCustomer} />
                      <span>{t('onboarding.gptEnableCustomer')}</span>
                    </label>
                  </div>
                  <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <div>
                      <label for="gptApiKey" class="block text-sm font-medium text-gray-700 mb-1">
                        {t('onboarding.gptApiKey')}
                      </label>
                      <input
                        id="gptApiKey"
                        type="password"
                        bind:value={gptApiKey}
                        placeholder={hasSavedGptApiKey ? t('onboarding.gptApiKeySaved') : 'sk-...'}
                        class="input w-full"
                      />
                      <p class="mt-1 text-xs text-gray-500">
                        {hasSavedGptApiKey
                          ? t('onboarding.gptApiKeyOptional')
                          : t('onboarding.gptApiKeyHint')}
                      </p>
                    </div>
                    <div>
                      <label for="gptModel" class="block text-sm font-medium text-gray-700 mb-1">
                        {t('onboarding.gptModel')}
                      </label>
                      <input
                        id="gptModel"
                        type="text"
                        bind:value={gptModel}
                        placeholder="gpt-4o-mini"
                        class="input w-full"
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      on:click={testGptConnection}
                      disabled={testingGptConnection ||
                        (!gptApiKey.trim() && !hasSavedGptApiKey) ||
                        !gptModel.trim()}
                      class="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      {testingGptConnection
                        ? t('common.saving')
                        : t('onboarding.gptTestConnection')}
                    </button>
                    <span class="text-xs text-gray-500">
                      {t('onboarding.gptTestHint')}
                    </span>
                  </div>
                </div>
              </div>
              <div class="pt-2">
                <div class="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 class="text-sm font-medium text-gray-900">
                      {t('onboarding.languagesTitle')}
                    </h3>
                    <p class="text-xs text-gray-500">{t('onboarding.languagesDesc')}</p>
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {#each languages as language}
                    <label
                      class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:border-gray-300 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLanguageIds.includes(language.id)}
                        on:change={() => toggleLanguage(language.id)}
                      />
                      <span class="text-sm text-gray-800">
                        {language.name}{language.nameNative ? ` / ${language.nameNative}` : ''}
                      </span>
                    </label>
                  {/each}
                </div>
                <div class="mt-3">
                  <label for="defaultLanguage" class="block text-sm font-medium text-gray-700 mb-1">
                    {t('onboarding.defaultLanguage')}
                  </label>
                  <select
                    id="defaultLanguage"
                    bind:value={defaultLanguageId}
                    class="input w-full"
                    disabled={selectedLanguageIds.length === 0}
                  >
                    {#each languages.filter( (language) => selectedLanguageIds.includes(language.id) ) as language}
                      <option value={language.id}>{language.name}</option>
                    {/each}
                  </select>
                </div>
              </div>
              <div class="pt-2">
                <div class="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 class="text-sm font-medium text-gray-900">
                      {t('onboarding.regionsTitle')}
                    </h3>
                    <p class="text-xs text-gray-500">{t('onboarding.regionsDesc')}</p>
                  </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {#each countries as country}
                    <label
                      class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:border-gray-300 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCountryIds.includes(country.id)}
                        on:change={() => toggleCountry(country.id)}
                      />
                      <span class="text-sm text-gray-800">
                        {country.name} ({country.code})
                      </span>
                    </label>
                  {/each}
                </div>
                <div class="mt-3">
                  <label for="defaultCountry" class="block text-sm font-medium text-gray-700 mb-1">
                    {t('onboarding.defaultRegion')}
                  </label>
                  <select
                    id="defaultCountry"
                    bind:value={defaultCountryId}
                    class="input w-full"
                    disabled={selectedCountryIds.length === 0}
                  >
                    {#each countries.filter( (country) => selectedCountryIds.includes(country.id) ) as country}
                      <option value={country.id}>{country.name} ({country.code})</option>
                    {/each}
                  </select>
                </div>
              </div>
              <div class="pt-2">
                <div class="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 class="text-sm font-medium text-gray-900">
                      {t('onboarding.currenciesTitle')}
                    </h3>
                    <p class="text-xs text-gray-500">{t('onboarding.currenciesDesc')}</p>
                  </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {#each supportedCurrencies as currency}
                    <label
                      class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:border-gray-300 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCurrencyCodes.includes(currency)}
                        on:change={() => toggleCurrency(currency)}
                      />
                      <span class="text-sm text-gray-800">{currency}</span>
                    </label>
                  {/each}
                </div>
                <div class="mt-3">
                  <label for="defaultCurrency" class="block text-sm font-medium text-gray-700 mb-1">
                    {t('onboarding.defaultCurrency')}
                  </label>
                  <select
                    id="defaultCurrency"
                    bind:value={defaultCurrencyCode}
                    class="input w-full"
                    disabled={selectedCurrencyCodes.length === 0}
                  >
                    {#each selectedCurrencyCodes as currency}
                      <option value={currency}>{currency}</option>
                    {/each}
                  </select>
                </div>
              </div>
            </div>
            <div class="flex justify-between items-center mt-8 gap-4">
              <button
                type="button"
                on:click={handleBack}
                class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                disabled={step <= 0}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t('onboarding.back')}
              </button>
              <button type="button" on:click={handleNext} disabled={saving} class="btn btn-primary">
                {saving ? t('common.saving') : t('onboarding.saveAndNext')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 2: Catalog features -->
        {#if step === 2}
          <div class="p-8 md:p-10">
            <h2 class="text-xl font-bold text-gray-900 mb-2">{t('onboarding.catalogTitle')}</h2>
            <p class="text-gray-600 text-sm mb-6">{t('onboarding.catalogDesc')}</p>
            <div class="space-y-4">
              <label
                class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-accent/30 cursor-pointer"
              >
                <input type="checkbox" bind:checked={brandsEnabled} class="mt-1" />
                <div>
                  <span class="font-medium">{t('onboarding.enableBrands')}</span>
                  <p class="text-sm text-gray-500">{t('onboarding.enableBrandsDesc')}</p>
                </div>
              </label>
              <label
                class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-accent/30 cursor-pointer"
              >
                <input type="checkbox" bind:checked={lookbookEnabled} class="mt-1" />
                <div>
                  <span class="font-medium">{t('onboarding.enableLookbook')}</span>
                  <p class="text-sm text-gray-500">{t('onboarding.enableLookbookDesc')}</p>
                </div>
              </label>
              <label
                class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-accent/30 cursor-pointer"
              >
                <input type="checkbox" bind:checked={reviewsEnabled} class="mt-1" />
                <div>
                  <span class="font-medium">{t('onboarding.enableReviews')}</span>
                  <p class="text-sm text-gray-500">{t('onboarding.enableReviewsDesc')}</p>
                </div>
              </label>
              <label
                class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-accent/30 cursor-pointer"
              >
                <input type="checkbox" bind:checked={wishlistEnabled} class="mt-1" />
                <div>
                  <span class="font-medium">{t('onboarding.enableWishlist')}</span>
                  <p class="text-sm text-gray-500">{t('onboarding.enableWishlistDesc')}</p>
                </div>
              </label>
            </div>
            <div class="flex justify-between items-center mt-8 gap-4">
              <button
                type="button"
                on:click={handleBack}
                class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                disabled={step <= 0}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t('onboarding.back')}
              </button>
              <button type="button" on:click={handleNext} disabled={saving} class="btn btn-primary">
                {saving ? t('common.saving') : t('onboarding.saveAndNext')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 3: Warehouses & Reports -->
        {#if step === 3}
          <div class="p-8 md:p-10">
            <h2 class="text-xl font-bold text-gray-900 mb-2">{t('onboarding.warehousesTitle')}</h2>
            <p class="text-gray-600 text-sm mb-6">{t('onboarding.warehousesDesc')}</p>
            <div class="space-y-3">
              <a
                href="/admin/warehouses"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <span class="font-medium">{t('onboarding.createWarehouse')}</span>
                <span class="text-accent">→</span>
              </a>
              <a
                href="/admin/reports"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <span class="font-medium">{t('onboarding.viewReports')}</span>
                <span class="text-accent">→</span>
              </a>
            </div>
            <div class="flex justify-between items-center mt-8 gap-4">
              <button
                type="button"
                on:click={handleBack}
                class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                disabled={step <= 0}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t('onboarding.back')}
              </button>
              <button type="button" on:click={handleNext} disabled={saving} class="btn btn-primary">
                {t('onboarding.next')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 4: Design system -->
        {#if step === 4}
          <div class="p-8 md:p-10">
            <h2 class="text-xl font-bold text-gray-900 mb-2">{t('onboarding.designTitle')}</h2>
            <p class="text-gray-600 text-sm mb-6">{t('onboarding.designDesc')}</p>
            <div class="space-y-4">
              <a
                href="/admin/header"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span class="font-medium">{t('onboarding.logoTitle')}</span>
                  <p class="text-sm text-gray-500">{t('onboarding.logoDesc')}</p>
                </div>
                <span class="text-accent">→</span>
              </a>
              <div>
                <label for="fontFamily" class="block text-sm font-medium text-gray-700 mb-1">
                  {t('onboarding.fontFamily')}
                </label>
                <select id="fontFamily" bind:value={fontFamily} class="input w-full">
                  {#each FONT_OPTIONS as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label for="colorAccent" class="block text-sm font-medium text-gray-700 mb-1">
                  {t('onboarding.accentColor')}
                </label>
                <div class="flex gap-3 items-center">
                  <input
                    id="colorAccent"
                    type="color"
                    bind:value={colorAccent}
                    class="w-12 h-12 rounded border border-gray-300 cursor-pointer"
                  />
                  <input type="text" bind:value={colorAccent} class="input flex-1 font-mono" />
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    for="borderRadiusCard"
                    class="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('onboarding.borderRadiusCard')}
                  </label>
                  <select id="borderRadiusCard" bind:value={borderRadiusCard} class="input w-full">
                    <option value="0">0 (Square)</option>
                    <option value="0.25rem">0.25rem (4px)</option>
                    <option value="0.5rem">0.5rem (8px)</option>
                    <option value="0.75rem">0.75rem (12px)</option>
                    <option value="1rem">1rem (16px)</option>
                    <option value="1.5rem">1.5rem (24px)</option>
                    <option value="2rem">2rem (32px)</option>
                  </select>
                </div>
                <div>
                  <label
                    for="borderRadiusButton"
                    class="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('onboarding.borderRadiusButton')}
                  </label>
                  <select
                    id="borderRadiusButton"
                    bind:value={borderRadiusButton}
                    class="input w-full"
                  >
                    <option value="0">0 (Square)</option>
                    <option value="0.25rem">0.25rem (4px)</option>
                    <option value="0.5rem">0.5rem (8px)</option>
                    <option value="0.75rem">0.75rem (12px)</option>
                    <option value="1rem">1rem (16px)</option>
                    <option value="1.5rem">1.5rem (24px)</option>
                    <option value="9999px">9999px (Fully Rounded)</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div class="flex items-center gap-4">
                    <div
                      class="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-gray-200 bg-white overflow-hidden"
                    >
                      {#if siteFaviconUrl}
                        <img
                          src={siteFaviconUrl}
                          alt=""
                          class="max-h-full max-w-full object-contain"
                        />
                      {:else}
                        <span class="text-xs text-gray-400">favicon</span>
                      {/if}
                    </div>
                    <div>
                      <h3 class="text-sm font-medium text-gray-900">
                        {t('onboarding.faviconTitle')}
                      </h3>
                      <p class="text-xs text-gray-500">{t('onboarding.faviconDesc')}</p>
                    </div>
                  </div>
                  <input
                    type="url"
                    bind:value={siteFaviconUrl}
                    class="input w-full"
                    placeholder={t('settings.siteFaviconUrlPlaceholder')}
                  />
                  <div class="flex flex-wrap gap-3 items-center">
                    <label
                      class="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
                        class="sr-only"
                        disabled={faviconUploading}
                        on:change={handleFaviconUpload}
                      />
                      {faviconUploading ? t('common.loading') : t('onboarding.uploadFavicon')}
                    </label>
                    {#if siteFaviconUrl}
                      <button
                        type="button"
                        class="text-sm text-red-600 hover:underline"
                        on:click={clearSiteFavicon}
                      >
                        {t('onboarding.clearFavicon')}
                      </button>
                    {/if}
                  </div>
                </div>
                <div class="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div class="flex items-center gap-4">
                    <div
                      class="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white overflow-hidden"
                    >
                      {#if siteAppleTouchIconUrl}
                        <img
                          src={siteAppleTouchIconUrl}
                          alt=""
                          class="max-h-full max-w-full object-cover"
                        />
                      {:else}
                        <span class="text-xs text-gray-400 px-1 text-center">180x180</span>
                      {/if}
                    </div>
                    <div>
                      <h3 class="text-sm font-medium text-gray-900">
                        {t('onboarding.appleTouchTitle')}
                      </h3>
                      <p class="text-xs text-gray-500">{t('onboarding.appleTouchDesc')}</p>
                    </div>
                  </div>
                  <input
                    type="url"
                    bind:value={siteAppleTouchIconUrl}
                    class="input w-full"
                    placeholder={t('settings.siteAppleTouchIconUrlPlaceholder')}
                  />
                  <div class="flex flex-wrap gap-3 items-center">
                    <label
                      class="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        class="sr-only"
                        disabled={appleTouchUploading}
                        on:change={handleAppleTouchUpload}
                      />
                      {appleTouchUploading ? t('common.loading') : t('onboarding.uploadAppleTouch')}
                    </label>
                    {#if siteAppleTouchIconUrl}
                      <button
                        type="button"
                        class="text-sm text-red-600 hover:underline"
                        on:click={clearSiteAppleTouchIcon}
                      >
                        {t('onboarding.clearAppleTouch')}
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
            <div class="flex justify-between items-center mt-8 gap-4">
              <button
                type="button"
                on:click={handleBack}
                class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                disabled={step <= 0}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t('onboarding.back')}
              </button>
              <button type="button" on:click={handleNext} disabled={saving} class="btn btn-primary">
                {saving ? t('common.saving') : t('onboarding.saveAndNext')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 5: Content pages -->
        {#if step === 5}
          <div class="p-8 md:p-10">
            <h2 class="text-xl font-bold text-gray-900 mb-2">{t('onboarding.contentTitle')}</h2>
            <p class="text-gray-600 text-sm mb-6">{t('onboarding.contentDesc')}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="/admin/header"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <span class="font-medium">{t('onboarding.configureHeader')}</span>
                <span class="text-accent">→</span>
              </a>
              <a
                href="/admin/footer"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <span class="font-medium">{t('onboarding.configureFooter')}</span>
                <span class="text-accent">→</span>
              </a>
              <a
                href="/admin/homepage"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <span class="font-medium">{t('onboarding.configureHomepage')}</span>
                <span class="text-accent">→</span>
              </a>
              <a
                href="/admin/product-page-design"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <span class="font-medium">{t('onboarding.configureProductPage')}</span>
                <span class="text-accent">→</span>
              </a>
              <a
                href="/admin/shop-page-design"
                class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors sm:col-span-2"
              >
                <span class="font-medium">{t('onboarding.configureShopPage')}</span>
                <span class="text-accent">→</span>
              </a>
            </div>
            <div class="flex justify-between items-center mt-8 gap-4">
              <button
                type="button"
                on:click={handleBack}
                class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                disabled={step <= 0}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t('onboarding.back')}
              </button>
              <button type="button" on:click={handleNext} disabled={saving} class="btn btn-primary">
                {t('onboarding.next')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 6: Complete -->
        {#if step === 6}
          <div class="p-8 md:p-10">
            <h2 class="text-xl font-bold text-gray-900 mb-2">{t('onboarding.emailTitle')}</h2>
            <p class="text-gray-600 text-sm mb-6">{t('onboarding.emailDesc')}</p>

            <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
              <h3 class="text-sm font-semibold text-amber-900 mb-2">
                {t('onboarding.emailInstructionTitle')}
              </h3>
              <ol class="list-decimal pl-5 space-y-1 text-sm text-amber-900">
                <li>{t('onboarding.emailInstructionStep1')}</li>
                <li>{t('onboarding.emailInstructionStep2')}</li>
                <li>{t('onboarding.emailInstructionStep3')}</li>
              </ol>
            </div>

            <div class="space-y-4">
              <div class="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                  <p class="font-medium text-gray-900">{t('onboarding.emailEnable')}</p>
                  <p class="text-sm text-gray-500">{t('onboarding.emailEnableDesc')}</p>
                </div>
                <input type="checkbox" bind:checked={emailEnabled} />
              </div>

              <div>
                <label for="emailProvider" class="block text-sm font-medium text-gray-700 mb-1">
                  {t('onboarding.emailProvider')}
                </label>
                <select id="emailProvider" bind:value={emailProvider} class="input w-full">
                  <option value="NODEMAILER">SMTP / Nodemailer</option>
                  <option value="CONSOLE">Console</option>
                </select>
                <p class="mt-1 text-xs text-gray-500">{t('onboarding.emailProviderHint')}</p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="emailFromName" class="block text-sm font-medium text-gray-700 mb-1">
                    {t('onboarding.emailFromName')}
                  </label>
                  <input
                    id="emailFromName"
                    type="text"
                    bind:value={emailFromName}
                    class="input w-full"
                  />
                </div>
                <div>
                  <label for="emailFromEmail" class="block text-sm font-medium text-gray-700 mb-1">
                    {t('onboarding.emailFromEmail')}
                  </label>
                  <input
                    id="emailFromEmail"
                    type="email"
                    bind:value={emailFromEmail}
                    class="input w-full"
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>

              {#if emailProvider === 'NODEMAILER'}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label for="emailHost" class="block text-sm font-medium text-gray-700 mb-1">
                      {t('onboarding.emailSmtpHost')}
                    </label>
                    <input
                      id="emailHost"
                      type="text"
                      bind:value={emailNodemailerHost}
                      class="input w-full"
                      placeholder="smtp.timeweb.ru"
                    />
                  </div>
                  <div>
                    <label for="emailPort" class="block text-sm font-medium text-gray-700 mb-1">
                      {t('onboarding.emailSmtpPort')}
                    </label>
                    <input
                      id="emailPort"
                      type="number"
                      bind:value={emailNodemailerPort}
                      class="input w-full"
                    />
                  </div>
                  <div>
                    <label for="emailUser" class="block text-sm font-medium text-gray-700 mb-1">
                      {t('onboarding.emailSmtpUser')}
                    </label>
                    <input
                      id="emailUser"
                      type="text"
                      bind:value={emailNodemailerUser}
                      class="input w-full"
                    />
                  </div>
                  <div>
                    <label for="emailPassword" class="block text-sm font-medium text-gray-700 mb-1">
                      {t('onboarding.emailSmtpPassword')}
                    </label>
                    <input
                      id="emailPassword"
                      type="password"
                      bind:value={emailNodemailerPassword}
                      class="input w-full"
                    />
                  </div>
                </div>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" bind:checked={emailNodemailerSecure} />
                  <span>{t('onboarding.emailSmtpSecure')}</span>
                </label>
              {/if}

              <div>
                <label for="emailTestTo" class="block text-sm font-medium text-gray-700 mb-1">
                  {t('onboarding.emailTestTo')}
                </label>
                <input
                  id="emailTestTo"
                  type="email"
                  bind:value={emailTestTo}
                  class="input w-full"
                  placeholder="you@example.com"
                />
                <p class="mt-1 text-xs text-gray-500">{t('onboarding.emailTestHint')}</p>
              </div>

              <div class="flex flex-wrap gap-3">
                <button
                  type="button"
                  on:click={testEmailSettings}
                  disabled={testingEmail}
                  class="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  {testingEmail ? t('common.loading') : t('onboarding.emailTestButton')}
                </button>
                <a
                  href="/admin/marketing"
                  class="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  {t('onboarding.emailOpenMarketing')}
                </a>
              </div>
            </div>

            <div class="flex justify-between items-center mt-8 gap-4">
              <button
                type="button"
                on:click={handleBack}
                class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                disabled={step <= 0}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t('onboarding.back')}
              </button>
              <button type="button" on:click={handleNext} disabled={saving} class="btn btn-primary">
                {saving ? t('common.saving') : t('onboarding.saveAndNext')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Step 7: Complete -->
        {#if step === 7}
          <div class="p-8 md:p-10 text-center">
            <div
              class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6"
            >
              <svg
                class="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-900 mb-2">{t('onboarding.completeTitle')}</h2>
            <p class="text-gray-600 mb-8 max-w-md mx-auto">
              {t('onboarding.completeDesc')}
            </p>
            <div class="flex flex-col gap-3">
              <button
                type="button"
                on:click={handleNext}
                disabled={saving}
                class="btn btn-primary w-full py-3"
              >
                {saving ? t('common.saving') : t('onboarding.goToDashboard')}
              </button>
              <div class="flex flex-wrap justify-center gap-3 text-sm">
                <a href="/admin/products" class="text-accent hover:text-accent-muted font-medium">
                  {t('onboarding.addProducts')} →
                </a>
                <a href="/admin/warehouses" class="text-accent hover:text-accent-muted font-medium">
                  {t('onboarding.createWarehouse')} →
                </a>
                <a href="/admin/reports" class="text-accent hover:text-accent-muted font-medium">
                  {t('onboarding.viewReports')} →
                </a>
                <a
                  href="/admin/payment-gateways"
                  class="text-accent hover:text-accent-muted font-medium"
                >
                  {t('onboarding.configurePayments')} →
                </a>
                <a href="/admin/header" class="text-accent hover:text-accent-muted font-medium">
                  {t('onboarding.configureHeader')} →
                </a>
                <a href="/admin/settings" class="text-accent hover:text-accent-muted font-medium">
                  {t('onboarding.exploreSettings')} →
                </a>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <p class="text-center text-sm text-gray-500 mt-6">
        <button type="button" on:click={handleSkip} class="hover:text-gray-700 underline">
          {t('onboarding.skipAll')}
        </button>
      </p>
    </div>
  {/if}
</div>
