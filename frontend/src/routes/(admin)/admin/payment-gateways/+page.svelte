<script lang="ts">
  import { onMount } from 'svelte';
  import { paymentGatewayApi, type PaymentGateway } from '$lib/api/payment-gateway.api';
  import { countryApi } from '$lib/api/country.api';
  import { currencyStore } from '$lib/stores/currency.store';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import AdminKebabMenu from '$lib/components/admin/AdminKebabMenu.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import {
    ONLINE_PAYMENT_GATEWAY_TYPES,
    SUPPORTED_PAYMENT_GATEWAY_TYPES,
  } from '$lib/constants/payment-gateway';

  let gateways: PaymentGateway[] = [];
  let countries: { code: string; name: string }[] = [];
  let currencies = ['USD', 'EUR', 'GBP', 'RUB', 'JPY', 'CNY', 'KRW'];
  let loading = true;
  let showAddForm = false;
  let editingGateway: PaymentGateway | null = null;
  let testingConnection = false;
  let connectionTestResult: { success: boolean; message: string } | null = null;
  /** When set, edit form is shown inline under this gateway's row */
  let editingGatewayId: string | null = null;
  /** When set, actions dropdown is open for this gateway id */
  let openActionsId: string | null = null;
  /** Show YooKassa secret key as plain text for debugging input */
  let showYookassaSecret = false;
  /** Show localized instruction fields only on demand, like other translation editors */
  let showInstructionTranslations = false;
  $: gatewayTypeOptions = [
    { value: '', label: t('paymentGateway.selectType') },
    ...SUPPORTED_PAYMENT_GATEWAY_TYPES.map((type) => ({
      value: type,
      label:
        type === 'STRIPE'
          ? t('paymentGateway.stripe')
          : type === 'YOOKASSA'
            ? t('paymentGateway.yookassa')
            : type === 'BANK_TRANSFER'
              ? t('paymentGateway.bankTransfer')
              : type === 'CASH_ON_DELIVERY'
                ? t('paymentGateway.cashOnDelivery')
                : t('paymentGateway.managerChat'),
    })),
  ];

  function toggleActions(id: string) {
    openActionsId = openActionsId === id ? null : id;
  }

  function closeActions() {
    openActionsId = null;
  }

  let formData = {
    type: '',
    name: '',
    isEnabled: false,
    isTestMode: true,
    config: {} as Record<string, unknown>,
    supportedCountries: [] as string[],
    supportedCurrencies: [] as string[],
    sortOrder: 0,
  };

  onMount(async () => {
    await Promise.all([loadGateways(), loadCountries()]);
  });

  async function loadGateways() {
    loading = true;
    try {
      const response = await paymentGatewayApi.getAll();
      gateways = response.gateways;
    } catch (e) {
      notificationStore.error(t('paymentGateway.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  async function loadCountries() {
    try {
      const response = await countryApi.getAll(true);
      countries = response.countries.map((c) => ({ code: c.code, name: c.name }));
    } catch (e) {
      console.error('Failed to load countries');
    }
  }

  function openAddForm() {
    editingGateway = null;
    editingGatewayId = null;
    connectionTestResult = null;
    showInstructionTranslations = false;
    showAddForm = true;
    formData = {
      type: '',
      name: '',
      isEnabled: false,
      isTestMode: true,
      config: {},
      supportedCountries: [],
      supportedCurrencies: [],
      sortOrder: 0,
    };
  }

  function openEditForm(gateway: PaymentGateway) {
    showAddForm = false;
    connectionTestResult = null;
    editingGateway = gateway;
    editingGatewayId = gateway.id;
    showInstructionTranslations = Boolean(
      gateway.config?.instructionEn || gateway.config?.instructionZh
    );
    formData = {
      type: gateway.type,
      name: gateway.name,
      isEnabled: gateway.isEnabled,
      isTestMode: gateway.isTestMode,
      config: gateway.config ? ({ ...gateway.config } as Record<string, unknown>) : {},
      supportedCountries: [...gateway.supportedCountries],
      supportedCurrencies: [...gateway.supportedCurrencies],
      sortOrder: gateway.sortOrder,
    };
  }

  function closeForm() {
    showAddForm = false;
    editingGateway = null;
    editingGatewayId = null;
    connectionTestResult = null;
    showInstructionTranslations = false;
  }

  function supportsInstructionTranslations(type: string) {
    return type === 'CASH_ON_DELIVERY' || type === 'MANAGER_CHAT';
  }

  function isInstructionTranslationField(key: string) {
    return key === 'instructionEn' || key === 'instructionZh';
  }

  function getConfigFields(type: string) {
    switch (type.toUpperCase()) {
      case 'STRIPE':
        return [
          { key: 'publishableKey', label: t('paymentGateway.publishableKey'), type: 'text' },
          { key: 'secretKey', label: t('paymentGateway.secretKey'), type: 'password' },
          { key: 'webhookSecret', label: t('paymentGateway.webhookSecret'), type: 'password' },
        ];
      case 'PAYPAL':
        return [
          { key: 'clientId', label: t('paymentGateway.clientId'), type: 'text' },
          { key: 'clientSecret', label: t('paymentGateway.clientSecret'), type: 'password' },
          { key: 'merchantId', label: t('paymentGateway.merchantId'), type: 'text' },
        ];
      case 'YOOKASSA':
        return [
          { key: 'shopId', label: t('paymentGateway.shopIdOrGateId'), type: 'text' },
          { key: 'secretKey', label: t('paymentGateway.secretKey'), type: 'password' },
        ];
      case 'CLOUDPAYMENTS':
        return [
          { key: 'publicId', label: t('paymentGateway.publicId'), type: 'text' },
          { key: 'apiSecret', label: t('paymentGateway.apiSecret'), type: 'password' },
        ];
      case 'BANK_TRANSFER':
        return [
          { key: 'accountName', label: t('paymentGateway.accountName'), type: 'text' },
          { key: 'accountNumber', label: t('paymentGateway.accountNumber'), type: 'text' },
          { key: 'bankName', label: t('paymentGateway.bankName'), type: 'text' },
          { key: 'swiftCode', label: t('paymentGateway.swiftCode'), type: 'text' },
          { key: 'iban', label: t('paymentGateway.iban'), type: 'text' },
          { key: 'routingNumber', label: t('paymentGateway.routingNumber'), type: 'text' },
          { key: 'notes', label: t('paymentGateway.additionalNotes'), type: 'textarea' },
        ];
      case 'P2P':
        return [
          { key: 'cardNumber', label: t('paymentGateway.cardNumber'), type: 'text' },
          { key: 'cryptoWallet', label: t('paymentGateway.cryptoWalletAddress'), type: 'text' },
          { key: 'blockchain', label: t('paymentGateway.blockchain'), type: 'text' },
          { key: 'sbpPhone', label: t('paymentGateway.sbpPhone'), type: 'text' },
          { key: 'instruction', label: t('paymentGateway.paymentInstruction'), type: 'textarea' },
        ];
      case 'CASH_ON_DELIVERY':
        return [
          { key: 'instruction', label: t('paymentGateway.paymentInstruction'), type: 'textarea' },
          {
            key: 'instructionEn',
            label: t('paymentGateway.paymentInstructionEn'),
            type: 'textarea',
          },
          {
            key: 'instructionZh',
            label: t('paymentGateway.paymentInstructionZh'),
            type: 'textarea',
          },
        ];
      case 'MANAGER_CHAT':
        return [
          { key: 'managerName', label: t('paymentGateway.managerName'), type: 'text' },
          { key: 'telegramUsername', label: t('paymentGateway.telegramUsername'), type: 'text' },
          { key: 'whatsappNumber', label: t('paymentGateway.whatsappNumber'), type: 'text' },
          { key: 'wechatLink', label: t('paymentGateway.wechatLink'), type: 'text' },
          { key: 'maxLink', label: t('paymentGateway.maxLink'), type: 'text' },
          { key: 'instruction', label: t('paymentGateway.paymentInstruction'), type: 'textarea' },
          {
            key: 'instructionEn',
            label: t('paymentGateway.paymentInstructionEn'),
            type: 'textarea',
          },
          {
            key: 'instructionZh',
            label: t('paymentGateway.paymentInstructionZh'),
            type: 'textarea',
          },
        ];
      case 'ALIPAY':
        return [
          { key: 'appId', label: t('paymentGateway.alipayAppId'), type: 'text' },
          { key: 'privateKey', label: t('paymentGateway.alipayPrivateKey'), type: 'textarea' },
          { key: 'alipayPublicKey', label: t('paymentGateway.alipayPublicKey'), type: 'textarea' },
        ];
      case 'WECHATPAY':
        return [
          { key: 'appId', label: t('paymentGateway.wechatAppId'), type: 'text' },
          { key: 'mchId', label: t('paymentGateway.wechatMchId'), type: 'text' },
          { key: 'apiV3Key', label: t('paymentGateway.wechatApiV3Key'), type: 'password' },
          {
            key: 'merchantPrivateKey',
            label: t('paymentGateway.wechatMerchantPrivateKey'),
            type: 'textarea',
          },
          {
            key: 'merchantCertificateSerial',
            label: t('paymentGateway.wechatCertificateSerial'),
            type: 'text',
          },
          {
            key: 'merchantCertificate',
            label: t('paymentGateway.wechatMerchantCertificate'),
            type: 'textarea',
          },
        ];
      default:
        return [
          { key: 'apiKey', label: t('paymentGateway.apiKey'), type: 'text' },
          { key: 'apiSecret', label: t('paymentGateway.apiSecret'), type: 'password' },
        ];
    }
  }

  async function saveGateway() {
    try {
      // Validate required fields
      if (!formData.type || !formData.name) {
        notificationStore.error(t('paymentGateway.fillTypeAndName'));
        return;
      }

      // Validate YOOKASSA required fields (shopId, gateId, gate_id - any of them)
      if (formData.type === 'YOOKASSA') {
        const config = formData.config || {};
        const id = config.shopId || config.gateId || config.gate_id;
        if (!id || !config.secretKey) {
          notificationStore.error(t('paymentGateway.yookassaRequiredFields'));
          return;
        }
      }

      // Validate CLOUDPAYMENTS required fields
      if (formData.type === 'CLOUDPAYMENTS') {
        const config = formData.config || {};
        if (!config.publicId || !config.apiSecret) {
          notificationStore.error(t('paymentGateway.cloudpaymentsRequiredFields'));
          return;
        }
      }

      // Validate ALIPAY required fields
      if (formData.type === 'ALIPAY') {
        const config = formData.config || {};
        if (!config.appId || !config.privateKey || !config.alipayPublicKey) {
          notificationStore.error(t('paymentGateway.alipayRequiredFields'));
          return;
        }
      }

      // Validate WECHATPAY required fields
      if (formData.type === 'WECHATPAY') {
        const config = formData.config || {};
        if (
          !config.appId ||
          !config.mchId ||
          !config.apiV3Key ||
          !config.merchantPrivateKey ||
          !config.merchantCertificateSerial
        ) {
          notificationStore.error(t('paymentGateway.wechatpayRequiredFields'));
          return;
        }
      }

      // Validate BANK_TRANSFER required fields
      if (formData.type === 'BANK_TRANSFER') {
        const config = formData.config || {};
        if (!config.accountName || !config.accountNumber || !config.bankName) {
          notificationStore.error(t('paymentGateway.bankTransferRequiredFields'));
          return;
        }
      }

      // Validate P2P - at least one payment method should be provided
      if (formData.type === 'P2P') {
        const config = formData.config || {};
        const cardNumber = typeof config.cardNumber === 'string' ? config.cardNumber.trim() : '';
        const cryptoWallet =
          typeof config.cryptoWallet === 'string' ? config.cryptoWallet.trim() : '';
        const sbpPhone = typeof config.sbpPhone === 'string' ? config.sbpPhone.trim() : '';
        const blockchain = typeof config.blockchain === 'string' ? config.blockchain.trim() : '';

        const hasCardNumber = cardNumber !== '';
        const hasCryptoWallet = cryptoWallet !== '';
        const hasSbpPhone = sbpPhone !== '';

        if (!hasCardNumber && !hasCryptoWallet && !hasSbpPhone) {
          notificationStore.error(t('paymentGateway.p2pRequiredFields'));
          return;
        }

        // If crypto wallet is provided, blockchain should also be provided
        if (hasCryptoWallet && blockchain === '') {
          notificationStore.error(t('paymentGateway.blockchainRequired'));
          return;
        }
      }

      if (formData.type === 'MANAGER_CHAT') {
        const config = formData.config || {};
        const telegramUsername =
          typeof config.telegramUsername === 'string' ? config.telegramUsername.trim() : '';
        const whatsappNumber =
          typeof config.whatsappNumber === 'string'
            ? config.whatsappNumber.replace(/[^\d]/g, '')
            : '';
        const wechatLink = typeof config.wechatLink === 'string' ? config.wechatLink.trim() : '';
        const maxLink = typeof config.maxLink === 'string' ? config.maxLink.trim() : '';
        if (!telegramUsername && !whatsappNumber && !wechatLink && !maxLink) {
          notificationStore.error(t('paymentGateway.managerChatRequiredFields'));
          return;
        }
      }

      // Clean config - remove empty strings
      const cleanedConfig: Record<string, unknown> = {};
      if (formData.config) {
        Object.keys(formData.config).forEach((key) => {
          const value = formData.config[key];
          if (value !== null && value !== undefined && value !== '') {
            cleanedConfig[key] = value;
          }
        });
      }

      // Prepare data for API
      const dataToSend = {
        type: formData.type,
        name: formData.name,
        isEnabled: formData.isEnabled || false,
        isTestMode: formData.isTestMode !== undefined ? formData.isTestMode : true,
        config: cleanedConfig,
        supportedCountries: formData.supportedCountries || [],
        supportedCurrencies: formData.supportedCurrencies || [],
        sortOrder: formData.sortOrder || 0,
      };

      console.log('Saving payment gateway:', dataToSend);

      if (editingGateway) {
        await paymentGatewayApi.update(editingGateway.id, dataToSend);
      } else {
        await paymentGatewayApi.create(dataToSend);
      }
      closeForm();
      await loadGateways();
      notificationStore.success(t('common.saved'));
    } catch (e: any) {
      console.error('Failed to save payment gateway:', e);
      const errorMessage =
        e?.response?.data?.error || e?.message || t('paymentGateway.failedToSave');
      notificationStore.error(errorMessage);
    }
  }

  async function deleteGateway(id: string) {
    const confirmed = await dialogStore.confirm(
      t('paymentGateway.deleteConfirm'),
      t('paymentGateway.deleteGateway'),
      t('common.ok'),
      t('common.cancel')
    );
    if (!confirmed) return;
    try {
      await paymentGatewayApi.delete(id);
      await loadGateways();
      notificationStore.success(t('paymentGateway.deleted'));
    } catch (e) {
      notificationStore.error(t('paymentGateway.failedToDelete'));
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      await paymentGatewayApi.toggleEnabled(id, enabled);
      await loadGateways();
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(t('paymentGateway.failedToToggle'));
    }
  }

  function handleToggleEnabled(id: string, event: Event) {
    const target = event.target as HTMLInputElement;
    if (target) {
      toggleEnabled(id, target.checked);
    }
  }

  function toggleCountry(code: string) {
    const index = formData.supportedCountries.indexOf(code);
    if (index > -1) {
      formData.supportedCountries.splice(index, 1);
    } else {
      formData.supportedCountries.push(code);
    }
  }

  function toggleCurrency(currency: string) {
    const index = formData.supportedCurrencies.indexOf(currency);
    if (index > -1) {
      formData.supportedCurrencies.splice(index, 1);
    } else {
      formData.supportedCurrencies.push(currency);
    }
  }

  function handleConfigInput(key: string, event: Event) {
    if (!formData.config) formData.config = {};
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target) {
      formData.config[key] = target.value;
    }
  }

  async function testConnection() {
    if (!formData.type?.trim()) {
      notificationStore.error(t('paymentGateway.fillTypeAndName'));
      return;
    }
    const apiTestTypes: string[] = [...ONLINE_PAYMENT_GATEWAY_TYPES];
    const configTestTypes = ['BANK_TRANSFER', 'CASH_ON_DELIVERY', 'MANAGER_CHAT'];
    if (!apiTestTypes.includes(formData.type) && !configTestTypes.includes(formData.type)) {
      notificationStore.info(t('paymentGateway.testConnectionNotAvailable'));
      return;
    }
    testingConnection = true;
    connectionTestResult = null;
    try {
      const res = await paymentGatewayApi.testConnection(formData.type, formData.config || {});
      connectionTestResult = { success: res.success, message: res.message };
      if (res.success) {
        notificationStore.success(res.message);
      } else {
        notificationStore.error(res.message);
      }
    } catch (e: any) {
      connectionTestResult = {
        success: false,
        message:
          e?.response?.data?.message || e?.message || t('paymentGateway.testConnectionFailed'),
      };
      notificationStore.error(connectionTestResult.message);
    } finally {
      testingConnection = false;
    }
  }
</script>

<svelte:window on:click={closeActions} />

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('paymentGateway.paymentGateways')}</h2>
    <button
      type="button"
      on:click={openAddForm}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('paymentGateway.addGateway')}
    </button>
  </div>

  <!-- Add gateway form (only at top when adding new) -->
  {#if showAddForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('paymentGateway.addGateway')}</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="gatewayType" class="block text-sm font-medium mb-2"
              >{t('common.type')}</label
            >
            <CustomSelect
              id="gatewayType"
              bind:value={formData.type}
              disabled={!!editingGateway}
              options={gatewayTypeOptions}
              className="w-full"
            />
          </div>
          <div>
            <label for="gatewayName" class="block text-sm font-medium mb-2"
              >{t('common.name')}</label
            >
            <input
              id="gatewayName"
              type="text"
              bind:value={formData.name}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('paymentGateway.namePlaceholder')}
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex items-center justify-between">
            <label for="isEnabled" class="text-sm">{t('paymentGateway.enabled')}</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                bind:checked={formData.isEnabled}
                id="isEnabled"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
          <div class="flex items-center justify-between">
            <label for="isTestMode" class="text-sm">{t('paymentGateway.testMode')}</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                bind:checked={formData.isTestMode}
                id="isTestMode"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
        </div>

        {#if formData.type}
          <div>
            <p class="block text-sm font-medium mb-2">{t('paymentGateway.configuration')}</p>
            {#if formData.type === 'P2P'}
              <p class="text-xs text-accent-muted mb-2">
                {t('paymentGateway.p2pHint')}
              </p>
            {/if}
            {#if formData.type === 'YOOKASSA'}
              <p class="text-xs text-accent-muted mb-2">
                {t('paymentGateway.yookassaHint')}
              </p>
            {/if}
            {#if formData.type === 'ALIPAY'}
              <p class="text-xs text-accent-muted mb-2">
                {t('paymentGateway.alipayHint')}
              </p>
            {/if}
            {#if formData.type === 'WECHATPAY'}
              <p class="text-xs text-accent-muted mb-2">
                {t('paymentGateway.wechatpayHint')}
              </p>
            {/if}
            {#if formData.type === 'CASH_ON_DELIVERY'}
              <p class="text-xs text-accent-muted mb-2">
                {t('paymentGateway.cashOnDeliveryHint')}
              </p>
              <div class="mb-4 p-4 bg-white/5 border border-accent/20 rounded-lg">
                <h4 class="text-sm font-medium mb-2">
                  {t('paymentGateway.cashOnDeliveryYandexTitle')}
                </h4>
                <p class="text-xs text-accent-muted whitespace-pre-line">
                  {t('paymentGateway.cashOnDeliveryYandexInstruction')}
                </p>
              </div>
            {/if}
            {#if formData.type === 'MANAGER_CHAT'}
              <p class="text-xs text-accent-muted mb-2">
                {t('paymentGateway.managerChatHint')}
              </p>
            {/if}
            {#if supportsInstructionTranslations(formData.type)}
              <div class="mb-4 border-t border-accent/20 pt-4">
                <div class="flex items-center justify-between gap-3">
                  <h4 class="text-sm font-medium">{t('page.translations')}</h4>
                  <button
                    type="button"
                    on:click={() => (showInstructionTranslations = !showInstructionTranslations)}
                    class="text-sm text-accent hover:text-accent-muted transition-colors"
                  >
                    {showInstructionTranslations ? t('common.hide') : t('common.show')}
                    {t('page.translations').toLowerCase()}
                  </button>
                </div>
              </div>
            {/if}
            <div class="space-y-2">
              {#each getConfigFields(formData.type) as field}
                {@const cryptoWalletValue =
                  formData.type === 'P2P' && formData.config?.cryptoWallet
                    ? typeof formData.config.cryptoWallet === 'string'
                      ? formData.config.cryptoWallet.trim()
                      : ''
                    : ''}
                {#if formData.type === 'P2P' && field.key === 'blockchain' && cryptoWalletValue === ''}
                  <!-- Hide blockchain field if cryptoWallet is not filled -->
                {:else if isInstructionTranslationField(field.key) && !showInstructionTranslations}
                  <!-- Hide instruction translation fields until the translations block is opened -->
                {:else}
                  <div>
                    <label
                      for={`paymentGatewayConfig-${field.key}`}
                      class="block text-xs text-accent-muted mb-1"
                    >
                      {field.label}
                      {#if formData.type === 'BANK_TRANSFER' && (field.key === 'accountName' || field.key === 'accountNumber' || field.key === 'bankName')}
                        <span class="text-red-500">*</span>
                      {/if}
                      {#if formData.type === 'P2P' && field.key === 'blockchain' && cryptoWalletValue !== ''}
                        <span class="text-red-500">*</span>
                      {/if}
                    </label>
                    {#if field.type === 'password'}
                      <input
                        id={`paymentGatewayConfig-${field.key}`}
                        type={formData.type === 'YOOKASSA' && field.key === 'secretKey'
                          ? showYookassaSecret
                            ? 'text'
                            : 'password'
                          : 'password'}
                        value={formData.config[field.key] || ''}
                        on:input={(e) => handleConfigInput(field.key, e)}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={field.label}
                      />
                      {#if formData.type === 'YOOKASSA' && field.key === 'secretKey'}
                        <label
                          class="flex items-center gap-2 mt-1 text-xs text-accent-muted cursor-pointer"
                          for={`paymentGatewayConfigShowSecret-${field.key}`}
                        >
                          <input
                            id={`paymentGatewayConfigShowSecret-${field.key}`}
                            type="checkbox"
                            bind:checked={showYookassaSecret}
                          />
                          {t('paymentGateway.showSecretKeyHint')}
                        </label>
                      {/if}
                    {:else if field.type === 'textarea'}
                      <textarea
                        id={`paymentGatewayConfig-${field.key}`}
                        value={String(formData.config[field.key] ?? '')}
                        on:input={(e) => handleConfigInput(field.key, e)}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={field.label}
                        rows="3"
                      ></textarea>
                    {:else}
                      <input
                        id={`paymentGatewayConfig-${field.key}`}
                        type="text"
                        value={String(formData.config[field.key] ?? '')}
                        on:input={(e) => handleConfigInput(field.key, e)}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={field.label}
                      />
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <div>
          <p class="block text-sm font-medium mb-2">{t('paymentGateway.supportedCountries')}</p>
          <p class="text-xs text-accent-muted mb-2">
            {t('paymentGateway.leaveEmptyForAll')}
          </p>
          <div class="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-dark">
            {#each countries as country}
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.supportedCountries.includes(country.code)}
                  on:change={() => toggleCountry(country.code)}
                />
                <span>{country.name}</span>
              </label>
            {/each}
          </div>
        </div>

        <div>
          <p class="block text-sm font-medium mb-2">{t('paymentGateway.supportedCurrencies')}</p>
          <p class="text-xs text-accent-muted mb-2">
            {t('paymentGateway.leaveEmptyForAllCurrencies')}
          </p>
          <div class="grid grid-cols-4 gap-2">
            {#each currencies as currency}
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.supportedCurrencies.includes(currency)}
                  on:change={() => toggleCurrency(currency)}
                />
                <span>{currency}</span>
              </label>
            {/each}
          </div>
        </div>

        <div>
          <label for="gatewaySortOrder" class="block text-sm font-medium mb-2"
            >{t('common.sortOrder')}</label
          >
          <input
            id="gatewaySortOrder"
            type="number"
            bind:value={formData.sortOrder}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          />
        </div>

        {#if formData.type && ['STRIPE', 'YOOKASSA', 'CLOUDPAYMENTS', 'BANK_TRANSFER', 'P2P', 'CASH_ON_DELIVERY', 'MANAGER_CHAT'].includes(formData.type)}
          <div class="flex items-center gap-4">
            <button
              type="button"
              on:click={testConnection}
              disabled={testingConnection}
              class="px-4 py-2 bg-white border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
            >
              {testingConnection
                ? t('paymentGateway.testingConnection')
                : t('paymentGateway.testConnection')}
            </button>
            {#if connectionTestResult}
              <span
                class="text-sm {connectionTestResult.success ? 'text-green-600' : 'text-red-600'}"
              >
                {connectionTestResult.success ? '✓' : '✗'}
                {connectionTestResult.message}
              </span>
            {/if}
          </div>
        {/if}

        <div class="flex gap-4">
          <button
            type="button"
            on:click={saveGateway}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('common.save')}
          </button>
          <button
            type="button"
            on:click={closeForm}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if gateways.length === 0}
    <p class="text-accent-muted">{t('paymentGateway.noGatewaysFound')}</p>
  {:else}
    <div class="bg-white">
      <table class="w-full min-w-[800px]">
        <thead class="bg-white">
          <tr>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.type')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.name')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.status')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('paymentGateway.countries')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('paymentGateway.currencies')}</th
            >
            <th class="px-4 py-2 text-left text-sm font-medium w-0">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each gateways as gateway}
            <tr
              class="border-t border-accent/10 cursor-pointer hover:bg-white/5 transition-colors"
              role="button"
              tabindex="0"
              on:click={() => openEditForm(gateway)}
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openEditForm(gateway);
                }
              }}
            >
              <td class="px-4 py-2">
                <span class="font-mono text-sm">{gateway.type}</span>
                {#if gateway.isTestMode}
                  <span class="ml-2 px-2 py-1 bg-yellow-500/20 text-black text-xs"
                    >{t('paymentGateway.test')}</span
                  >
                {/if}
              </td>
              <td class="px-4 py-2 font-medium">{gateway.name}</td>
              <td class="px-4 py-2" on:click|stopPropagation>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gateway.isEnabled}
                    on:change={(e) => handleToggleEnabled(gateway.id, e)}
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                  ></div>
                </label>
              </td>
              <td class="px-4 py-2 text-sm text-accent-muted">
                {gateway.supportedCountries.length === 0
                  ? t('common.all')
                  : `${gateway.supportedCountries.length} ${t('paymentGateway.countries')}`}
              </td>
              <td class="px-4 py-2 text-sm text-accent-muted">
                {gateway.supportedCurrencies.length === 0
                  ? t('common.all')
                  : `${gateway.supportedCurrencies.length} ${t('paymentGateway.currencies')}`}
              </td>
              <td class="px-4 py-2 align-middle">
                <AdminKebabMenu
                  open={openActionsId === gateway.id}
                  title={t('common.actions')}
                  menuToggle={() => toggleActions(gateway.id)}
                >
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      openEditForm(gateway);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      deleteGateway(gateway.id);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600"
                  >
                    {t('common.delete')}
                  </button>
                </AdminKebabMenu>
              </td>
            </tr>
            <!-- Edit form inline under this gateway's row -->
            {#if editingGatewayId === gateway.id}
              <tr class="border-t-0 bg-dark-light/50">
                <td colspan="6" class="px-4 py-4">
                  <div class="p-4 border-2 border-accent/30 rounded-lg">
                    <h3 class="text-lg font-medium mb-4">
                      {t('paymentGateway.editGateway')} — {gateway.name}
                    </h3>
                    <div class="space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            for={`editGatewayType-${gateway.id}`}
                            class="block text-sm font-medium mb-2">{t('common.type')}</label
                          >
                          <CustomSelect
                            id={`editGatewayType-${gateway.id}`}
                            bind:value={formData.type}
                            disabled={true}
                            options={gatewayTypeOptions.filter((option) => option.value)}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label
                            for={`editGatewayName-${gateway.id}`}
                            class="block text-sm font-medium mb-2">{t('common.name')}</label
                          >
                          <input
                            id={`editGatewayName-${gateway.id}`}
                            type="text"
                            bind:value={formData.name}
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            placeholder={t('paymentGateway.namePlaceholder')}
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div class="flex items-center justify-between">
                          <label for="edit-isEnabled-{gateway.id}" class="text-sm"
                            >{t('paymentGateway.enabled')}</label
                          >
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              bind:checked={formData.isEnabled}
                              id="edit-isEnabled-{gateway.id}"
                              class="sr-only peer"
                            />
                            <div
                              class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                            ></div>
                          </label>
                        </div>
                        <div class="flex items-center justify-between">
                          <label for="edit-isTestMode-{gateway.id}" class="text-sm"
                            >{t('paymentGateway.testMode')}</label
                          >
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              bind:checked={formData.isTestMode}
                              id="edit-isTestMode-{gateway.id}"
                              class="sr-only peer"
                            />
                            <div
                              class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                            ></div>
                          </label>
                        </div>
                      </div>

                      {#if formData.type}
                        <div>
                          <p class="block text-sm font-medium mb-2">
                            {t('paymentGateway.configuration')}
                          </p>
                          {#if formData.type === 'P2P'}
                            <p class="text-xs text-accent-muted mb-2">
                              {t('paymentGateway.p2pHint')}
                            </p>
                          {/if}
                          {#if formData.type === 'ALIPAY'}
                            <p class="text-xs text-accent-muted mb-2">
                              {t('paymentGateway.alipayHint')}
                            </p>
                          {/if}
                          {#if formData.type === 'WECHATPAY'}
                            <p class="text-xs text-accent-muted mb-2">
                              {t('paymentGateway.wechatpayHint')}
                            </p>
                          {/if}
                          {#if formData.type === 'CASH_ON_DELIVERY'}
                            <p class="text-xs text-accent-muted mb-2">
                              {t('paymentGateway.cashOnDeliveryHint')}
                            </p>
                            <div class="mb-4 p-4 bg-white/5 border border-accent/20 rounded-lg">
                              <h4 class="text-sm font-medium mb-2">
                                {t('paymentGateway.cashOnDeliveryYandexTitle')}
                              </h4>
                              <p class="text-xs text-accent-muted whitespace-pre-line">
                                {t('paymentGateway.cashOnDeliveryYandexInstruction')}
                              </p>
                            </div>
                          {/if}
                          {#if formData.type === 'MANAGER_CHAT'}
                            <p class="text-xs text-accent-muted mb-2">
                              {t('paymentGateway.managerChatHint')}
                            </p>
                          {/if}
                          {#if supportsInstructionTranslations(formData.type)}
                            <div class="mb-4 border-t border-accent/20 pt-4">
                              <div class="flex items-center justify-between gap-3">
                                <h4 class="text-sm font-medium">{t('page.translations')}</h4>
                                <button
                                  type="button"
                                  on:click={() =>
                                    (showInstructionTranslations = !showInstructionTranslations)}
                                  class="text-sm text-accent hover:text-accent-muted transition-colors"
                                >
                                  {showInstructionTranslations
                                    ? t('common.hide')
                                    : t('common.show')}
                                  {t('page.translations').toLowerCase()}
                                </button>
                              </div>
                            </div>
                          {/if}
                          <div class="space-y-2">
                            {#each getConfigFields(formData.type) as field}
                              {@const cryptoWalletValue =
                                formData.type === 'P2P' && formData.config?.cryptoWallet
                                  ? typeof formData.config.cryptoWallet === 'string'
                                    ? formData.config.cryptoWallet.trim()
                                    : ''
                                  : ''}
                              {#if formData.type === 'P2P' && field.key === 'blockchain' && cryptoWalletValue === ''}
                                <!-- Hide blockchain field if cryptoWallet is not filled -->
                              {:else if isInstructionTranslationField(field.key) && !showInstructionTranslations}
                                <!-- Hide instruction translation fields until the translations block is opened -->
                              {:else}
                                <div>
                                  <label
                                    for={`editPaymentGatewayConfig-${gateway.id}-${field.key}`}
                                    class="block text-xs text-accent-muted mb-1"
                                  >
                                    {field.label}
                                    {#if formData.type === 'BANK_TRANSFER' && (field.key === 'accountName' || field.key === 'accountNumber' || field.key === 'bankName')}
                                      <span class="text-red-500">*</span>
                                    {/if}
                                    {#if formData.type === 'P2P' && field.key === 'blockchain' && cryptoWalletValue !== ''}
                                      <span class="text-red-500">*</span>
                                    {/if}
                                  </label>
                                  {#if field.type === 'password'}
                                    <input
                                      id={`editPaymentGatewayConfig-${gateway.id}-${field.key}`}
                                      type={formData.type === 'YOOKASSA' &&
                                      field.key === 'secretKey'
                                        ? showYookassaSecret
                                          ? 'text'
                                          : 'password'
                                        : 'password'}
                                      value={String(formData.config[field.key] ?? '')}
                                      on:input={(e) => handleConfigInput(field.key, e)}
                                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                                      placeholder={field.label}
                                    />
                                    {#if formData.type === 'YOOKASSA' && field.key === 'secretKey'}
                                      <label
                                        class="flex items-center gap-2 mt-1 text-xs text-accent-muted cursor-pointer"
                                        for={`editPaymentGatewayConfigShowSecret-${gateway.id}-${field.key}`}
                                      >
                                        <input
                                          id={`editPaymentGatewayConfigShowSecret-${gateway.id}-${field.key}`}
                                          type="checkbox"
                                          bind:checked={showYookassaSecret}
                                        />
                                        {t('paymentGateway.showSecretKey')}
                                      </label>
                                    {/if}
                                  {:else if field.type === 'textarea'}
                                    <textarea
                                      id={`editPaymentGatewayConfig-${gateway.id}-${field.key}`}
                                      value={String(formData.config[field.key] ?? '')}
                                      on:input={(e) => handleConfigInput(field.key, e)}
                                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                                      placeholder={field.label}
                                      rows="3"
                                    ></textarea>
                                  {:else}
                                    <input
                                      id={`editPaymentGatewayConfig-${gateway.id}-${field.key}`}
                                      type="text"
                                      value={String(formData.config[field.key] ?? '')}
                                      on:input={(e) => handleConfigInput(field.key, e)}
                                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                                      placeholder={field.label}
                                    />
                                  {/if}
                                </div>
                              {/if}
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <div>
                        <p class="block text-sm font-medium mb-2">
                          {t('paymentGateway.supportedCountries')}
                        </p>
                        <p class="text-xs text-accent-muted mb-2">
                          {t('paymentGateway.leaveEmptyForAll')}
                        </p>
                        <div class="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-dark">
                          {#each countries as country}
                            <label class="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.supportedCountries.includes(country.code)}
                                on:change={() => toggleCountry(country.code)}
                              />
                              <span>{country.name}</span>
                            </label>
                          {/each}
                        </div>
                      </div>

                      <div>
                        <p class="block text-sm font-medium mb-2">
                          {t('paymentGateway.supportedCurrencies')}
                        </p>
                        <p class="text-xs text-accent-muted mb-2">
                          {t('paymentGateway.leaveEmptyForAllCurrencies')}
                        </p>
                        <div class="grid grid-cols-4 gap-2">
                          {#each currencies as currency}
                            <label class="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.supportedCurrencies.includes(currency)}
                                on:change={() => toggleCurrency(currency)}
                              />
                              <span>{currency}</span>
                            </label>
                          {/each}
                        </div>
                      </div>

                      <div>
                        <label for="gatewaySortOrderEdit" class="block text-sm font-medium mb-2"
                          >{t('common.sortOrder')}</label
                        >
                        <input
                          id="gatewaySortOrderEdit"
                          type="number"
                          bind:value={formData.sortOrder}
                          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        />
                      </div>

                      {#if formData.type && ['STRIPE', 'YOOKASSA', 'CLOUDPAYMENTS', 'BANK_TRANSFER', 'P2P', 'CASH_ON_DELIVERY', 'MANAGER_CHAT'].includes(formData.type)}
                        <div class="flex items-center gap-4">
                          <button
                            type="button"
                            on:click={testConnection}
                            disabled={testingConnection}
                            class="px-4 py-2 bg-white border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                          >
                            {testingConnection
                              ? t('paymentGateway.testingConnection')
                              : t('paymentGateway.testConnection')}
                          </button>
                          {#if connectionTestResult}
                            <span
                              class="text-sm {connectionTestResult.success
                                ? 'text-green-600'
                                : 'text-red-600'}"
                            >
                              {connectionTestResult.success ? '✓' : '✗'}
                              {connectionTestResult.message}
                            </span>
                          {/if}
                        </div>
                      {/if}

                      <div class="flex gap-4 pt-2">
                        <button
                          type="button"
                          on:click={saveGateway}
                          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          type="button"
                          on:click={closeForm}
                          class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
