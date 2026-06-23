<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.store';
  import { settingsApi, type FeatureSettings } from '$lib/api/settings.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import {
    emailTemplateApi,
    type EmailTemplate,
    type EmailTemplateType,
    type EmailTemplateTranslation,
  } from '$lib/api/email-template.api';
  import { languageApi } from '$lib/api/language.api';
  import type { Language } from '$lib/api/language.api';

  let settings = $settingsStore;
  let loading = false;
  let saving = false;
  let error = '';
  let success = '';

  // Pinterest settings
  let pinterestSettings = {
    enabled: false,
    accessToken: '',
    boardId: '',
    frontendBaseUrl: 'http://localhost:5173',
  };

  // Email settings
  let emailSettings = {
    enabled: false,
    provider: 'CONSOLE' as
      | 'CONSOLE'
      | 'NODEMAILER'
      | 'SENDGRID'
      | 'AWS_SES'
      | 'RESEND'
      | 'MAILGUN'
      | 'BREVO',
    fromEmail: 'noreply@example.com',
    fromName: 'Fashion Store',
    // Nodemailer
    nodemailerHost: '',
    nodemailerPort: 587,
    nodemailerSecure: false,
    nodemailerUser: '',
    nodemailerPassword: '',
    // SendGrid
    sendgridApiKey: '',
    // AWS SES
    awsSesRegion: '',
    awsSesAccessKeyId: '',
    awsSesSecretAccessKey: '',
    // Resend
    resendApiKey: '',
    // Mailgun
    mailgunApiKey: '',
    mailgunDomain: '',
    mailgunRegion: 'us',
    // Brevo
    brevoApiKey: '',
    /** Optional recipient for test send (defaults to fromEmail) */
    testEmailTo: '',
    // Styles
    primaryColor: '#1c1b1b',
    secondaryColor: '#666666',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    fontFamily: 'Arial, sans-serif',
    fontSize: '16px',
    buttonColor: '#1c1b1b',
    buttonTextColor: '#ffffff',
  };

  // Analytics settings
  let analyticsSettings = {
    enabled: false,
    googleAnalyticsId: '',
    yandexMetricaId: '',
  };

  let activeTab: 'pinterest' | 'email' | 'analytics' | 'loyalty' = 'pinterest';

  // Email templates
  let emailTemplates: EmailTemplate[] = [];
  let selectedTemplate: EmailTemplate | null = null;
  let editingTemplate: {
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    enabled?: boolean;
  } = {};
  let showTemplateEditor = false;
  let loadingTemplates = false;
  /** Editor view: code only, preview only, or split (code + preview) */
  let emailEditorView: 'code' | 'preview' | 'split' = 'split';
  /** Active languages for template translation tabs (loaded when editor opens) */
  let templateLanguages: Language[] = [];
  /** Current tab in template editor: 'default' or locale code (en, ru, ...) */
  let templateEditorLanguage: 'default' | string = 'default';
  /** Per-locale content for template (subject, htmlContent, textContent) */
  let editingTranslations: Record<string, EmailTemplateTranslation> = {};

  /** Strip script tags for safe iframe preview */
  function getSafePreviewHtml(html: string | undefined): string {
    if (!html || !html.trim())
      return (
        '<p style="color:#888;">' +
        (typeof t === 'function' ? t('marketing.htmlContentPlaceholder') : 'Enter HTML body') +
        '</p>'
      );
    const doc =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:16px;}</style></head><body>';
    const noScript = (html || '').replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    );
    return doc + noScript + '</body></html>';
  }

  onMount(async () => {
    loading = true;
    try {
      await settingsStore.load();
      // Load Pinterest settings
      pinterestSettings.enabled = settings.pinterestEnabled || false;
      pinterestSettings.accessToken = settings.pinterestAccessToken || '';
      pinterestSettings.boardId = settings.pinterestBoardId || '';
      pinterestSettings.frontendBaseUrl = settings.frontendBaseUrl || 'http://localhost:5173';

      // Load Email settings
      emailSettings.enabled = settings.emailEnabled || false;
      emailSettings.provider = (settings.emailProvider as any) || 'CONSOLE';
      emailSettings.fromEmail = settings.emailFromEmail || 'noreply@example.com';
      emailSettings.fromName = settings.emailFromName || 'Fashion Store';
      emailSettings.testEmailTo = settings.emailFromEmail || '';
      emailSettings.nodemailerHost = settings.emailNodemailerHost || '';
      emailSettings.nodemailerPort = settings.emailNodemailerPort || 587;
      emailSettings.nodemailerSecure = settings.emailNodemailerSecure || false;
      emailSettings.nodemailerUser = settings.emailNodemailerUser || '';
      emailSettings.nodemailerPassword = settings.emailNodemailerPassword || '';
      emailSettings.sendgridApiKey = settings.emailSendgridApiKey || '';
      emailSettings.awsSesRegion = settings.emailAwsSesRegion || '';
      emailSettings.awsSesAccessKeyId = settings.emailAwsSesAccessKeyId || '';
      emailSettings.awsSesSecretAccessKey = settings.emailAwsSesSecretAccessKey || '';
      emailSettings.resendApiKey = settings.emailResendApiKey || '';
      emailSettings.mailgunApiKey = settings.emailMailgunApiKey || '';
      emailSettings.mailgunDomain = settings.emailMailgunDomain || '';
      emailSettings.mailgunRegion = settings.emailMailgunRegion || 'us';
      emailSettings.brevoApiKey = settings.emailBrevoApiKey || '';
      emailSettings.primaryColor = settings.emailPrimaryColor || '#1c1b1b';
      emailSettings.secondaryColor = settings.emailSecondaryColor || '#666666';
      emailSettings.backgroundColor = settings.emailBackgroundColor || '#ffffff';
      emailSettings.textColor = settings.emailTextColor || '#000000';
      emailSettings.fontFamily = settings.emailFontFamily || 'Arial, sans-serif';
      emailSettings.fontSize = settings.emailFontSize || '16px';
      emailSettings.buttonColor = settings.emailButtonColor || '#1c1b1b';
      emailSettings.buttonTextColor = settings.emailButtonTextColor || '#ffffff';

      // Load Analytics settings
      analyticsSettings.enabled = settings.analyticsEnabled || false;
      analyticsSettings.googleAnalyticsId = settings.googleAnalyticsId || '';
      analyticsSettings.yandexMetricaId = settings.yandexMetricaId || '';
      // Loyalty is loaded from settings.loyaltyProgramEnabled (same store)
    } catch (e) {
      error = t('marketing.failedToLoad');
      console.error(e);
    } finally {
      loading = false;
    }
  });

  async function savePinterestSettings() {
    saving = true;
    error = '';
    success = '';

    try {
      // Validate required fields if enabled
      if (pinterestSettings.enabled) {
        if (!pinterestSettings.accessToken) {
          notificationStore.error(t('marketing.accessTokenRequired'));
          saving = false;
          return;
        }
        if (!pinterestSettings.frontendBaseUrl) {
          notificationStore.error(t('marketing.frontendBaseUrlRequired'));
          saving = false;
          return;
        }
      }

      // Update settings
      await settingsStore.updateSetting('pinterestEnabled', pinterestSettings.enabled);
      await settingsStore.updateSetting('pinterestAccessToken', pinterestSettings.accessToken);
      await settingsStore.updateSetting('pinterestBoardId', pinterestSettings.boardId);
      await settingsStore.updateSetting('frontendBaseUrl', pinterestSettings.frontendBaseUrl);

      notificationStore.success(t('marketing.pinterestSettingsSaved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('marketing.failedToSave'));
    } finally {
      saving = false;
    }
  }

  async function testPinterestConnection() {
    if (!pinterestSettings.enabled || !pinterestSettings.accessToken) {
      notificationStore.error(t('marketing.enablePinterestFirst'));
      return;
    }
    saving = true;
    try {
      const result = await settingsApi.testPinterest();
      if (result.success) {
        notificationStore.success(result.message || t('marketing.testConnectionSuccess'));
      } else {
        notificationStore.error(result.error || t('marketing.testConnectionFailed'));
      }
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('marketing.testConnectionFailed'));
    } finally {
      saving = false;
    }
  }

  async function saveEmailSettings(): Promise<boolean> {
    saving = true;
    error = '';
    success = '';

    try {
      // Validate required fields if enabled
      if (emailSettings.enabled) {
        if (!emailSettings.fromEmail || !emailSettings.fromName) {
          notificationStore.error(t('marketing.fromEmailAndNameRequired'));
          return false;
        }

        if (emailSettings.provider === 'NODEMAILER') {
          if (
            !emailSettings.nodemailerHost ||
            !emailSettings.nodemailerUser ||
            !emailSettings.nodemailerPassword
          ) {
            notificationStore.error(t('marketing.nodemailerRequired'));
            return false;
          }
        } else if (emailSettings.provider === 'SENDGRID') {
          if (!emailSettings.sendgridApiKey) {
            notificationStore.error(t('marketing.sendgridApiKeyRequired'));
            return false;
          }
        } else if (emailSettings.provider === 'AWS_SES') {
          if (
            !emailSettings.awsSesRegion ||
            !emailSettings.awsSesAccessKeyId ||
            !emailSettings.awsSesSecretAccessKey
          ) {
            notificationStore.error(t('marketing.awsSesRequired'));
            return false;
          }
        } else if (emailSettings.provider === 'RESEND') {
          if (!emailSettings.resendApiKey) {
            notificationStore.error(t('marketing.resendApiKeyRequired'));
            return false;
          }
        } else if (emailSettings.provider === 'MAILGUN') {
          if (!emailSettings.mailgunApiKey || !emailSettings.mailgunDomain) {
            notificationStore.error(t('marketing.mailgunRequired'));
            return false;
          }
        } else if (emailSettings.provider === 'BREVO') {
          if (!emailSettings.brevoApiKey) {
            notificationStore.error(t('marketing.brevoApiKeyRequired'));
            return false;
          }
        }
      }

      // Update settings
      await settingsStore.updateSetting('emailEnabled', emailSettings.enabled);
      await settingsStore.updateSetting('emailProvider', emailSettings.provider);
      await settingsStore.updateSetting('emailFromEmail', emailSettings.fromEmail);
      await settingsStore.updateSetting('emailFromName', emailSettings.fromName);
      await settingsStore.updateSetting('emailNodemailerHost', emailSettings.nodemailerHost);
      await settingsStore.updateSetting('emailNodemailerPort', emailSettings.nodemailerPort);
      await settingsStore.updateSetting('emailNodemailerSecure', emailSettings.nodemailerSecure);
      await settingsStore.updateSetting('emailNodemailerUser', emailSettings.nodemailerUser);
      await settingsStore.updateSetting(
        'emailNodemailerPassword',
        emailSettings.nodemailerPassword
      );
      await settingsStore.updateSetting('emailSendgridApiKey', emailSettings.sendgridApiKey);
      await settingsStore.updateSetting('emailAwsSesRegion', emailSettings.awsSesRegion);
      await settingsStore.updateSetting('emailAwsSesAccessKeyId', emailSettings.awsSesAccessKeyId);
      await settingsStore.updateSetting(
        'emailAwsSesSecretAccessKey',
        emailSettings.awsSesSecretAccessKey
      );
      await settingsStore.updateSetting('emailResendApiKey', emailSettings.resendApiKey);
      await settingsStore.updateSetting('emailMailgunApiKey', emailSettings.mailgunApiKey);
      await settingsStore.updateSetting('emailMailgunDomain', emailSettings.mailgunDomain);
      await settingsStore.updateSetting('emailMailgunRegion', emailSettings.mailgunRegion);
      await settingsStore.updateSetting('emailBrevoApiKey', emailSettings.brevoApiKey);
      await settingsStore.updateSetting('emailPrimaryColor', emailSettings.primaryColor);
      await settingsStore.updateSetting('emailSecondaryColor', emailSettings.secondaryColor);
      await settingsStore.updateSetting('emailBackgroundColor', emailSettings.backgroundColor);
      await settingsStore.updateSetting('emailTextColor', emailSettings.textColor);
      await settingsStore.updateSetting('emailFontFamily', emailSettings.fontFamily);
      await settingsStore.updateSetting('emailFontSize', emailSettings.fontSize);
      await settingsStore.updateSetting('emailButtonColor', emailSettings.buttonColor);
      await settingsStore.updateSetting('emailButtonTextColor', emailSettings.buttonTextColor);

      notificationStore.success(t('marketing.emailSettingsSaved'));
      return true;
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('marketing.failedToSave'));
      return false;
    } finally {
      saving = false;
    }
  }

  async function testEmail() {
    if (!emailSettings.enabled) {
      notificationStore.error(t('marketing.enableEmailServiceFirst'));
      return;
    }

    if (emailSettings.provider === 'CONSOLE') {
      notificationStore.error(t('marketing.consoleProviderTestBlocked'));
      return;
    }

    saving = true;
    error = '';
    success = '';

    try {
      // Test uses settings from DB — save current form first
      const saved = await saveEmailSettings();
      if (!saved) return;

      const testTo = (emailSettings.testEmailTo || emailSettings.fromEmail).trim();
      const result = await settingsApi.testEmail(testTo);
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
      saving = false;
    }
  }

  async function saveAnalyticsSettings() {
    saving = true;
    error = '';
    success = '';

    try {
      // Validate required fields if enabled
      if (analyticsSettings.enabled) {
        if (!analyticsSettings.googleAnalyticsId && !analyticsSettings.yandexMetricaId) {
          notificationStore.error(t('marketing.atLeastOneAnalyticsRequired'));
          saving = false;
          return;
        }
      }

      // Update settings
      await settingsStore.updateSetting('analyticsEnabled', analyticsSettings.enabled);
      await settingsStore.updateSetting('googleAnalyticsId', analyticsSettings.googleAnalyticsId);
      await settingsStore.updateSetting('yandexMetricaId', analyticsSettings.yandexMetricaId);

      notificationStore.success(t('marketing.analyticsSettingsSaved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('marketing.failedToSave'));
    } finally {
      saving = false;
    }
  }

  function onLoyaltyToggle(e: Event) {
    const input = e.currentTarget;
    const checked = input instanceof HTMLInputElement ? input.checked : false;
    settings.loyaltyProgramEnabled = checked;
    updateLoyaltySetting(checked);
  }

  async function updateLoyaltySetting(value: boolean) {
    saving = true;
    try {
      await settingsStore.updateSetting('loyaltyProgramEnabled', value);
      notificationStore.success(t('marketing.loyaltySettingsSaved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('marketing.failedToSave'));
    } finally {
      saving = false;
    }
  }

  // Safe defaults for loyalty conditions (in case API doesn't return them yet)
  $: loyaltyEarnPerUnit = settings.loyaltyPointsEarnPerUnit ?? 1;
  $: loyaltySpendPerUnit = settings.loyaltyPointsSpendPerUnit ?? 100;

  async function saveLoyaltyConditions() {
    const earn = Math.max(0.01, Number(loyaltyEarnPerUnit) || 1);
    const spend = Math.max(1, Math.floor(Number(loyaltySpendPerUnit) || 100));
    saving = true;
    try {
      await settingsStore.updateSetting('loyaltyPointsEarnPerUnit', earn);
      await settingsStore.updateSetting('loyaltyPointsSpendPerUnit', spend);
      notificationStore.success(t('marketing.loyaltyConditionsSaved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('marketing.failedToSave'));
    } finally {
      saving = false;
    }
  }

  async function loadTemplates() {
    loadingTemplates = true;
    try {
      const response = await emailTemplateApi.getAll();
      emailTemplates = response.templates;
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('marketing.failedToLoadTemplates')
      );
    } finally {
      loadingTemplates = false;
    }
  }

  async function editTemplate(template: EmailTemplate) {
    selectedTemplate = template;
    editingTemplate = {
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      enabled: template.enabled,
    };
    editingTranslations = { ...(template.translations || {}) };
    templateEditorLanguage = 'default';
    showTemplateEditor = true;
    try {
      const res = await languageApi.getAll(true);
      templateLanguages = res.languages || [];
    } catch {
      templateLanguages = [];
    }
  }

  function ensureTranslationSlot(code: string) {
    if (!editingTranslations[code]) {
      editingTranslations[code] = { subject: '', htmlContent: '', textContent: '' };
      editingTranslations = { ...editingTranslations };
    }
  }

  /** HTML content for preview iframe (current tab) */
  $: htmlForPreview =
    templateEditorLanguage === 'default'
      ? (editingTemplate.htmlContent ?? '')
      : (editingTranslations[templateEditorLanguage]?.htmlContent ?? '');

  function getTemplateTypeName(type: EmailTemplateType): string {
    const typeMap: Record<EmailTemplateType, string> = {
      PASSWORD_RESET: t('marketing.passwordReset'),
      WELCOME: t('marketing.welcomeEmail'),
      EMAIL_VERIFICATION: t('marketing.emailVerification') || 'Email verification',
      ORDER_CONFIRMATION: t('marketing.orderConfirmation'),
      SHIPPING: t('marketing.orderShipped'),
      DELIVERY: t('marketing.delivery'),
      PAYMENT_REQUEST: t('marketing.paymentRequest'),
      PAYMENT_CONFIRMED: t('marketing.paymentConfirmed'),
      RETURN_NOTIFICATION: t('marketing.returnNotification'),
      PROMOTIONAL: t('marketing.promotional'),
    };
    return typeMap[type] || type;
  }

  async function saveTemplate() {
    if (!selectedTemplate || !editingTemplate.subject || !editingTemplate.htmlContent) {
      notificationStore.error(t('marketing.subjectAndHtmlRequired'));
      return;
    }

    const translationsToSave: Record<string, EmailTemplateTranslation> = {};
    for (const [code, tr] of Object.entries(editingTranslations)) {
      if (tr?.subject?.trim() && tr?.htmlContent?.trim()) {
        translationsToSave[code] = {
          subject: tr.subject,
          htmlContent: tr.htmlContent,
          textContent: tr.textContent,
        };
      }
    }

    saving = true;
    try {
      await emailTemplateApi.createOrUpdate(selectedTemplate.type, {
        ...editingTemplate,
        translations: Object.keys(translationsToSave).length > 0 ? translationsToSave : undefined,
      });
      notificationStore.success(t('marketing.templateSaved'));
      showTemplateEditor = false;
      selectedTemplate = null;
      editingTemplate = {};
      editingTranslations = {};
      await loadTemplates();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('marketing.failedToSaveTemplate'));
    } finally {
      saving = false;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('marketing.marketingSettings')}</h2>
  </div>

  {#if error}
    <div class="mb-6 p-4 bg-red-500/20 border border-red-500 text-red-400">
      {error}
    </div>
  {/if}

  {#if success}
    <div class="mb-6 p-4 bg-green-500/20 border border-green-500 text-green-400">
      {success}
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <!-- Tabs -->
    <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
      <button
        type="button"
        on:click={() => (activeTab = 'pinterest')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'pinterest'}
        class:shadow-sm={activeTab === 'pinterest'}
        class:text-accent={activeTab === 'pinterest'}
        class:text-gray-600={activeTab !== 'pinterest'}
        class:hover:bg-gray-50={activeTab !== 'pinterest'}
        class:hover:text-gray-900={activeTab !== 'pinterest'}
      >
        {t('marketing.pinterest')}
      </button>
      <button
        type="button"
        on:click={() => (activeTab = 'email')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'email'}
        class:shadow-sm={activeTab === 'email'}
        class:text-accent={activeTab === 'email'}
        class:text-gray-600={activeTab !== 'email'}
        class:hover:bg-gray-50={activeTab !== 'email'}
        class:hover:text-gray-900={activeTab !== 'email'}
      >
        {t('marketing.emailService')}
      </button>
      <button
        type="button"
        on:click={() => (activeTab = 'analytics')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'analytics'}
        class:shadow-sm={activeTab === 'analytics'}
        class:text-accent={activeTab === 'analytics'}
        class:text-gray-600={activeTab !== 'analytics'}
        class:hover:bg-gray-50={activeTab !== 'analytics'}
        class:hover:text-gray-900={activeTab !== 'analytics'}
      >
        {t('marketing.analytics')}
      </button>
      <button
        type="button"
        on:click={() => (activeTab = 'loyalty')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'loyalty'}
        class:shadow-sm={activeTab === 'loyalty'}
        class:text-accent={activeTab === 'loyalty'}
        class:text-gray-600={activeTab !== 'loyalty'}
        class:hover:bg-gray-50={activeTab !== 'loyalty'}
        class:hover:text-gray-900={activeTab !== 'loyalty'}
      >
        {t('marketing.loyalty')}
      </button>
    </div>

    <div class="space-y-6">
      {#if activeTab === 'pinterest'}
        <!-- Pinterest Integration -->
        <div class="bg-dark-light p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-medium mb-2">{t('marketing.pinterestIntegration')}</h3>
              <p class="text-sm text-accent-muted">
                {t('marketing.pinterestDescription')}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                bind:checked={pinterestSettings.enabled}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>

          {#if pinterestSettings.enabled}
            <div class="space-y-4 mt-6">
              <!-- Access Token -->
              <div>
                <label for="pinterestAccessToken" class="block text-sm font-medium mb-2">
                  {t('marketing.accessToken')} <span class="text-red-400">*</span>
                </label>
                <input
                  id="pinterestAccessToken"
                  type="password"
                  bind:value={pinterestSettings.accessToken}
                  placeholder={t('marketing.accessTokenPlaceholder')}
                  class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                />
                <p class="text-xs text-accent-muted mt-1">
                  {t('marketing.getAccessTokenFrom')}{' '}
                  <a
                    href="https://developers.pinterest.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-accent hover:underline"
                  >
                    {t('marketing.pinterestDevelopers')}
                  </a>
                </p>
              </div>

              <!-- Board ID -->
              <div>
                <label for="pinterestBoardId" class="block text-sm font-medium mb-2">
                  {t('marketing.boardId')}
                  <span class="text-accent-muted">({t('common.optional')})</span>
                </label>
                <input
                  id="pinterestBoardId"
                  type="text"
                  bind:value={pinterestSettings.boardId}
                  placeholder={t('marketing.boardIdPlaceholder')}
                  class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                />
                <p class="text-xs text-accent-muted mt-1">
                  {t('marketing.boardIdHint')}
                </p>
              </div>

              <!-- Frontend Base URL -->
              <div>
                <label for="pinterestFrontendBaseUrl" class="block text-sm font-medium mb-2">
                  {t('marketing.frontendBaseUrl')} <span class="text-red-400">*</span>
                </label>
                <input
                  id="pinterestFrontendBaseUrl"
                  type="text"
                  bind:value={pinterestSettings.frontendBaseUrl}
                  placeholder={t('marketing.frontendBaseUrlPlaceholder')}
                  class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                />
                <p class="text-xs text-accent-muted mt-1">
                  {t('marketing.frontendBaseUrlHint')}
                </p>
              </div>

              <!-- Info Box -->
              <div class="bg-blue-500/10 border border-blue-500/30 p-4">
                <h4 class="font-medium mb-2">{t('marketing.howItWorks')}</h4>
                <ul class="text-sm text-accent-muted space-y-1 list-disc list-inside">
                  <li>{t('marketing.pinterestInfo1')}</li>
                  <li>{t('marketing.pinterestInfo2')}</li>
                  <li>{t('marketing.pinterestInfo3')}</li>
                  <li>{t('marketing.pinterestInfo4')}</li>
                </ul>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-4 pt-4">
                <button
                  on:click={savePinterestSettings}
                  disabled={saving}
                  class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('marketing.saveSettings')}
                </button>
                <button
                  on:click={testPinterestConnection}
                  disabled={saving || !pinterestSettings.enabled}
                  class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {t('marketing.testConnection')}
                </button>
              </div>
            </div>
          {:else}
            <div class="mt-4 text-sm text-accent-muted">
              {t('marketing.enablePinterestToIndex')}
            </div>
          {/if}
        </div>

        <!-- Documentation Link -->
        <div class="bg-dark-light p-4">
          <p class="text-sm text-accent-muted">
            {t('marketing.needHelp')}{' '}
            <a
              href="/docs/PINTEREST_INTEGRATION.md"
              target="_blank"
              class="text-accent hover:underline"
            >
              {t('marketing.pinterestDocumentation')}
            </a>
          </p>
        </div>
      {:else if activeTab === 'email'}
        <!-- Email Service -->
        <div class="bg-dark-light p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-medium mb-2">{t('marketing.emailService')}</h3>
              <p class="text-sm text-accent-muted">
                {t('marketing.emailServiceDescription')}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={emailSettings.enabled} class="sr-only peer" />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>

          {#if emailSettings.enabled}
            <div class="space-y-6 mt-6">
              <!-- Provider Selection -->
              <div>
                <label for="emailProvider" class="block text-sm font-medium mb-2">
                  {t('marketing.emailProvider')} <span class="text-red-400">*</span>
                </label>
                <select
                  id="emailProvider"
                  bind:value={emailSettings.provider}
                  class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                >
                  <option value="CONSOLE">{t('marketing.console')}</option>
                  <option value="NODEMAILER">{t('marketing.nodemailer')}</option>
                  <option value="SENDGRID">{t('marketing.sendgrid')}</option>
                  <option value="AWS_SES">{t('marketing.awsSes')}</option>
                  <option value="RESEND">{t('marketing.resend')}</option>
                  <option value="MAILGUN">{t('marketing.mailgun')}</option>
                  <option value="BREVO">{t('marketing.brevo')}</option>
                </select>
              </div>

              <!-- From Email & Name -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="emailFromAddress" class="block text-sm font-medium mb-2">
                    {t('marketing.fromEmail')} <span class="text-red-400">*</span>
                  </label>
                  <input
                    id="emailFromAddress"
                    type="email"
                    bind:value={emailSettings.fromEmail}
                    placeholder={t('marketing.fromEmailPlaceholder')}
                    class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label for="emailFromName" class="block text-sm font-medium mb-2">
                    {t('marketing.fromName')} <span class="text-red-400">*</span>
                  </label>
                  <input
                    id="emailFromName"
                    type="text"
                    bind:value={emailSettings.fromName}
                    placeholder={t('marketing.fromNamePlaceholder')}
                    class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <!-- Nodemailer Settings -->
              {#if emailSettings.provider === 'NODEMAILER'}
                <div class="bg-blue-500/10 border border-blue-500/30 p-4">
                  <h4 class="font-medium mb-4">{t('marketing.nodemailerSettings')}</h4>

                  <!-- Security Warning for Gmail -->
                  {#if emailSettings.nodemailerHost && (emailSettings.nodemailerHost.includes('gmail.com') || emailSettings.nodemailerHost.includes('googlemail.com'))}
                    {@const smtpDomain = emailSettings.nodemailerUser?.split('@')[1]?.toLowerCase()}
                    {@const fromDomain = emailSettings.fromEmail.split('@')[1]?.toLowerCase()}
                    {#if smtpDomain && fromDomain && smtpDomain !== fromDomain && !fromDomain.includes('gmail.com') && !fromDomain.includes('googlemail.com')}
                      <div class="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/50">
                        <h5 class="font-semibold text-yellow-600 mb-2">
                          ⚠️ {t('marketing.securityWarning')}
                        </h5>
                        <p class="text-sm text-yellow-700 mb-2">
                          {t('marketing.gmailSmtpWarning')}
                        </p>
                        <ul class="text-sm text-yellow-700 list-disc list-inside mb-2 space-y-1">
                          <li>{t('marketing.gmailWarning1')}</li>
                          <li>{t('marketing.gmailWarning2')}</li>
                          <li>{t('marketing.gmailWarning3')}</li>
                        </ul>
                        <p class="text-sm text-yellow-700 font-medium">
                          {t('marketing.gmailRecommendation')}
                        </p>
                      </div>
                    {/if}
                  {/if}
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="smtpHost" class="block text-sm font-medium mb-2"
                        >{t('marketing.smtpHost')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="smtpHost"
                        type="text"
                        bind:value={emailSettings.nodemailerHost}
                        placeholder={t('marketing.smtpHostPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label for="smtpPort" class="block text-sm font-medium mb-2"
                        >{t('marketing.smtpPort')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="smtpPort"
                        type="number"
                        bind:value={emailSettings.nodemailerPort}
                        placeholder={t('marketing.smtpPortPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label for="smtpUser" class="block text-sm font-medium mb-2"
                        >{t('marketing.smtpUser')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="smtpUser"
                        type="text"
                        bind:value={emailSettings.nodemailerUser}
                        placeholder={t('marketing.smtpUserPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label for="smtpPassword" class="block text-sm font-medium mb-2"
                        >{t('marketing.smtpPassword')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="smtpPassword"
                        type="password"
                        bind:value={emailSettings.nodemailerPassword}
                        placeholder={t('marketing.passwordPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div class="mt-4">
                    <label class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        bind:checked={emailSettings.nodemailerSecure}
                        class=""
                      />
                      <span class="text-sm">{t('marketing.useSecureConnection')}</span>
                    </label>
                  </div>

                  <!-- Security Info -->
                  <div class="mt-4 p-3 bg-blue-500/10 border border-blue-500/30">
                    <p class="text-xs text-blue-700 font-medium mb-1">
                      🔒 {t('marketing.security')}:
                    </p>
                    <ul class="text-xs text-blue-600 space-y-1 list-disc list-inside">
                      <li>{t('marketing.securityInfo1')}</li>
                      <li>{t('marketing.securityInfo2')}</li>
                      <li>{t('marketing.securityInfo3')}</li>
                      <li>{t('marketing.securityInfo4')}</li>
                    </ul>
                  </div>
                </div>

                <!-- Security Warning for Gmail with different domain -->
                {#if emailSettings.provider === 'NODEMAILER' && emailSettings.nodemailerHost && (emailSettings.nodemailerHost.includes('gmail.com') || emailSettings.nodemailerHost.includes('googlemail.com'))}
                  {@const smtpDomain = emailSettings.nodemailerUser?.split('@')[1]?.toLowerCase()}
                  {@const fromDomain = emailSettings.fromEmail.split('@')[1]?.toLowerCase()}
                  {#if smtpDomain && fromDomain && smtpDomain !== fromDomain && !fromDomain.includes('gmail.com') && !fromDomain.includes('googlemail.com')}
                    <div class="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50">
                      <h5 class="font-semibold text-yellow-600 mb-2">
                        ⚠️ {t('marketing.securityWarning')}
                      </h5>
                      <p class="text-sm text-yellow-700 mb-2">
                        {t('marketing.gmailSmtpWarning')}
                      </p>
                      <ul class="text-sm text-yellow-700 list-disc list-inside mb-2 space-y-1">
                        <li>{t('marketing.gmailWarning1')}</li>
                        <li>{t('marketing.gmailWarning2')}</li>
                        <li>{t('marketing.gmailWarning3')}</li>
                      </ul>
                      <p class="text-sm text-yellow-700 font-medium">
                        {t('marketing.gmailRecommendation')}
                      </p>
                    </div>
                  {/if}
                {/if}
              {/if}

              <!-- SendGrid Settings -->
              {#if emailSettings.provider === 'SENDGRID'}
                <div class="bg-blue-500/10 border border-blue-500/30 p-4">
                  <h4 class="font-medium mb-4">{t('marketing.sendgridSettings')}</h4>
                  <div>
                    <label for="sendgridApiKey" class="block text-sm font-medium mb-2">
                      {t('marketing.apiKey')} <span class="text-red-400">*</span>
                    </label>
                    <input
                      id="sendgridApiKey"
                      type="password"
                      bind:value={emailSettings.sendgridApiKey}
                      placeholder={t('marketing.sendgridApiKeyPlaceholder')}
                      class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                    />
                    <p class="text-xs text-accent-muted mt-1">
                      {t('marketing.getApiKeyFrom')}{' '}
                      <a
                        href="https://app.sendgrid.com/settings/api_keys"
                        target="_blank"
                        class="text-accent hover:underline">{t('marketing.sendgridDashboard')}</a
                      >
                    </p>
                  </div>
                </div>
              {/if}

              <!-- Resend Settings -->
              {#if emailSettings.provider === 'RESEND'}
                <div class="bg-green-500/10 border border-green-500/30 p-4">
                  <h4 class="font-medium mb-4">{t('marketing.resendSettings')}</h4>
                  <div>
                    <label for="resendApiKey" class="block text-sm font-medium mb-2">
                      {t('marketing.apiKey')} <span class="text-red-400">*</span>
                    </label>
                    <input
                      id="resendApiKey"
                      type="password"
                      bind:value={emailSettings.resendApiKey}
                      placeholder={t('marketing.resendApiKeyPlaceholder')}
                      class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                    />
                    <p class="text-xs text-accent-muted mt-1">
                      {t('marketing.getApiKeyFrom')}{' '}
                      <a
                        href="https://resend.com/api-keys"
                        target="_blank"
                        class="text-accent hover:underline">{t('marketing.resendDashboard')}</a
                      >
                      {' '}{t('marketing.resendFree')}
                    </p>
                  </div>
                </div>
              {/if}

              <!-- Mailgun Settings -->
              {#if emailSettings.provider === 'MAILGUN'}
                <div class="bg-green-500/10 border border-green-500/30 p-4">
                  <h4 class="font-medium mb-4">{t('marketing.mailgunSettings')}</h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="mailgunApiKey" class="block text-sm font-medium mb-2"
                        >{t('marketing.apiKey')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="mailgunApiKey"
                        type="password"
                        bind:value={emailSettings.mailgunApiKey}
                        placeholder={t('marketing.mailgunApiKeyPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label for="mailgunDomain" class="block text-sm font-medium mb-2"
                        >{t('marketing.domain')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="mailgunDomain"
                        type="text"
                        bind:value={emailSettings.mailgunDomain}
                        placeholder={t('marketing.mailgunDomainPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div class="col-span-2">
                      <label for="mailgunRegion" class="block text-sm font-medium mb-2"
                        >{t('marketing.region')}</label
                      >
                      <select
                        id="mailgunRegion"
                        bind:value={emailSettings.mailgunRegion}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      >
                        <option value="us">{t('marketing.usDefault')}</option>
                        <option value="eu">{t('marketing.eu')}</option>
                      </select>
                    </div>
                  </div>
                  <p class="text-xs text-accent-muted mt-2">
                    {t('marketing.getApiKeyAndDomainFrom')}{' '}
                    <a
                      href="https://app.mailgun.com/app/domains"
                      target="_blank"
                      class="text-accent hover:underline">{t('marketing.mailgunDashboard')}</a
                    >
                    {' '}{t('marketing.mailgunFree')}
                  </p>
                </div>
              {/if}

              <!-- Brevo Settings -->
              {#if emailSettings.provider === 'BREVO'}
                <div class="bg-green-500/10 border border-green-500/30 p-4">
                  <h4 class="font-medium mb-4">{t('marketing.brevoSettings')}</h4>
                  <div>
                    <label for="brevoApiKey" class="block text-sm font-medium mb-2">
                      {t('marketing.apiKey')} <span class="text-red-400">*</span>
                    </label>
                    <input
                      id="brevoApiKey"
                      type="password"
                      bind:value={emailSettings.brevoApiKey}
                      placeholder={t('marketing.brevoApiKeyPlaceholder')}
                      class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                    />
                    <p class="text-xs text-accent-muted mt-1">
                      {t('marketing.getApiKeyFrom')}{' '}
                      <a
                        href="https://app.brevo.com/settings/keys/api"
                        target="_blank"
                        class="text-accent hover:underline">{t('marketing.brevoDashboard')}</a
                      >
                      {' '}{t('marketing.brevoFree')}
                    </p>
                  </div>
                </div>
              {/if}

              <!-- AWS SES Settings -->
              {#if emailSettings.provider === 'AWS_SES'}
                <div class="bg-blue-500/10 border border-blue-500/30 p-4">
                  <h4 class="font-medium mb-4">{t('marketing.awsSesSettings')}</h4>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="awsSesRegion" class="block text-sm font-medium mb-2"
                        >{t('marketing.region')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="awsSesRegion"
                        type="text"
                        bind:value={emailSettings.awsSesRegion}
                        placeholder={t('marketing.awsSesRegionPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label for="awsSesAccessKeyId" class="block text-sm font-medium mb-2"
                        >{t('marketing.accessKeyId')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="awsSesAccessKeyId"
                        type="text"
                        bind:value={emailSettings.awsSesAccessKeyId}
                        placeholder={t('marketing.accessKeyIdPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div class="col-span-2">
                      <label for="awsSesSecretAccessKey" class="block text-sm font-medium mb-2"
                        >{t('marketing.secretAccessKey')} <span class="text-red-400">*</span></label
                      >
                      <input
                        id="awsSesSecretAccessKey"
                        type="password"
                        bind:value={emailSettings.awsSesSecretAccessKey}
                        placeholder={t('marketing.passwordPlaceholder')}
                        class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Email Styles -->
              <div class="bg-purple-500/10 border border-purple-500/30 p-4">
                <h4 class="font-medium mb-4">{t('marketing.emailStyles')}</h4>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="emailPrimaryColor" class="block text-sm font-medium mb-2"
                      >{t('marketing.primaryColor')}</label
                    >
                    <input
                      id="emailPrimaryColor"
                      type="color"
                      bind:value={emailSettings.primaryColor}
                      class="wrounded h-10 bg-dark border border-dark-lighter"
                    />
                  </div>
                  <div>
                    <label for="emailSecondaryColor" class="block text-sm font-medium mb-2"
                      >{t('marketing.secondaryColor')}</label
                    >
                    <input
                      id="emailSecondaryColor"
                      type="color"
                      bind:value={emailSettings.secondaryColor}
                      class="wrounded h-10 bg-dark border border-dark-lighter"
                    />
                  </div>
                  <div>
                    <label for="emailBackgroundColor" class="block text-sm font-medium mb-2"
                      >{t('marketing.backgroundColor')}</label
                    >
                    <input
                      id="emailBackgroundColor"
                      type="color"
                      bind:value={emailSettings.backgroundColor}
                      class="wrounded h-10 bg-dark border border-dark-lighter"
                    />
                  </div>
                  <div>
                    <label for="emailTextColor" class="block text-sm font-medium mb-2"
                      >{t('marketing.textColor')}</label
                    >
                    <input
                      id="emailTextColor"
                      type="color"
                      bind:value={emailSettings.textColor}
                      class="wrounded h-10 bg-dark border border-dark-lighter"
                    />
                  </div>
                  <div>
                    <label for="emailButtonColor" class="block text-sm font-medium mb-2"
                      >{t('marketing.buttonColor')}</label
                    >
                    <input
                      id="emailButtonColor"
                      type="color"
                      bind:value={emailSettings.buttonColor}
                      class="wrounded h-10 bg-dark border border-dark-lighter"
                    />
                  </div>
                  <div>
                    <label for="emailButtonTextColor" class="block text-sm font-medium mb-2"
                      >{t('marketing.buttonTextColor')}</label
                    >
                    <input
                      id="emailButtonTextColor"
                      type="color"
                      bind:value={emailSettings.buttonTextColor}
                      class="wrounded h-10 bg-dark border border-dark-lighter"
                    />
                  </div>
                  <div>
                    <label for="emailFontFamily" class="block text-sm font-medium mb-2"
                      >{t('marketing.fontFamily')}</label
                    >
                    <input
                      id="emailFontFamily"
                      type="text"
                      bind:value={emailSettings.fontFamily}
                      placeholder={t('marketing.fontFamilyPlaceholder')}
                      class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label for="emailFontSize" class="block text-sm font-medium mb-2"
                      >{t('marketing.fontSize')}</label
                    >
                    <input
                      id="emailFontSize"
                      type="text"
                      bind:value={emailSettings.fontSize}
                      placeholder={t('marketing.fontSizePlaceholder')}
                      class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>

              <!-- Email Templates Section -->
              <div class="bg-purple-500/10 border border-purple-500/30 p-4">
                <div class="flex items-center justify-between mb-4">
                  <h4 class="font-medium">{t('marketing.emailTemplates')}</h4>
                  <button
                    on:click={loadTemplates}
                    disabled={loadingTemplates}
                    class="px-4 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {loadingTemplates ? t('common.loading') : t('marketing.manageTemplates')}
                  </button>
                </div>
                <p class="text-sm text-accent-muted mb-4">
                  {t('marketing.emailTemplatesDescription')}
                </p>
                <div class="bg-green-500/10 border border-green-500/30 p-4">
                  <h5 class="font-medium mb-2">{t('marketing.emailTypes')}:</h5>
                  <ul class="text-sm text-accent-muted space-y-1 list-disc list-inside">
                    <li>
                      <strong>{t('marketing.passwordReset')}:</strong>
                      {t('marketing.passwordResetDesc')}
                    </li>
                    <li>
                      <strong>{t('marketing.welcomeEmail')}:</strong>
                      {t('marketing.welcomeEmailDesc')}
                    </li>
                    <li>
                      <strong>{t('marketing.orderConfirmation')}:</strong>
                      {t('marketing.orderConfirmationDesc')}
                    </li>
                    <li>
                      <strong>{t('marketing.orderShipped')}:</strong>
                      {t('marketing.orderShippedDesc')}
                    </li>
                    <li>
                      <strong>{t('marketing.paymentRequest')}:</strong>
                      {t('marketing.paymentRequestDesc')}
                    </li>
                    <li>
                      <strong>{t('marketing.paymentConfirmed')}:</strong>
                      {t('marketing.paymentConfirmedDesc')}
                    </li>
                    <li>
                      <strong>{t('marketing.promotional')}:</strong>
                      {t('marketing.promotionalDesc')}
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Template Editor Modal -->
              {#if showTemplateEditor && selectedTemplate}
                <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-dark-lighter">
                      <div class="flex items-center justify-between">
                        <h3 class="text-xl font-medium">
                          {t('marketing.editTemplate')}: {getTemplateTypeName(
                            selectedTemplate.type
                          )}
                        </h3>
                        <button
                          on:click={() => {
                            showTemplateEditor = false;
                            selectedTemplate = null;
                            editingTemplate = {};
                            editingTranslations = {};
                            templateEditorLanguage = 'default';
                          }}
                          class="text-accent-muted hover:text-accent"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div class="p-6 space-y-4">
                      <!-- Language tabs: Default + active languages for translations -->
                      <div>
                        <p class="block text-sm font-medium mb-2">
                          {t('marketing.templateTranslations')}
                        </p>
                        <div class="flex flex-wrap gap-2 border-b border-dark-lighter pb-2">
                          <button
                            type="button"
                            class="px-3 py-1.5 text-sm rounded {templateEditorLanguage === 'default'
                              ? 'bg-accent text-dark'
                              : 'bg-dark-light text-accent-muted hover:bg-dark'}"
                            on:click={() => (templateEditorLanguage = 'default')}
                          >
                            {t('marketing.templateDefaultLanguage')}
                          </button>
                          {#each templateLanguages as lang}
                            <button
                              type="button"
                              class="px-3 py-1.5 text-sm rounded {templateEditorLanguage ===
                              lang.code
                                ? 'bg-accent text-dark'
                                : 'bg-dark-light text-accent-muted hover:bg-dark'}"
                              on:click={() => {
                                ensureTranslationSlot(lang.code);
                                templateEditorLanguage = lang.code;
                              }}
                            >
                              {lang.nameNative || lang.name}
                            </button>
                          {/each}
                        </div>
                      </div>

                      <!-- Subject -->
                      <div>
                        <label for="templateSubject" class="block text-sm font-medium mb-2">
                          {t('marketing.emailSubject')} <span class="text-red-400">*</span>
                        </label>
                        {#if templateEditorLanguage === 'default'}
                          <input
                            id="templateSubject"
                            type="text"
                            bind:value={editingTemplate.subject}
                            placeholder={t('marketing.emailSubjectPlaceholder')}
                            class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                          />
                        {:else if editingTranslations[templateEditorLanguage]}
                          <input
                            type="text"
                            bind:value={editingTranslations[templateEditorLanguage].subject}
                            placeholder={t('marketing.emailSubjectPlaceholder')}
                            class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                          />
                        {/if}
                      </div>

                      <!-- HTML Content: constructor with Code / Preview / Split -->
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <label for="templateHtmlContent" class="block text-sm font-medium">
                            {t('marketing.htmlContent')} <span class="text-red-400">*</span>
                          </label>
                          <div
                            class="flex rounded border border-dark-lighter overflow-hidden"
                            role="tablist"
                          >
                            <button
                              type="button"
                              role="tab"
                              class="px-3 py-1.5 text-sm {emailEditorView === 'code'
                                ? 'bg-accent text-dark'
                                : 'bg-dark text-accent-muted hover:bg-dark-light'}"
                              on:click={() => (emailEditorView = 'code')}
                            >
                              {t('marketing.viewCode')}
                            </button>
                            <button
                              type="button"
                              role="tab"
                              class="px-3 py-1.5 text-sm border-l border-dark-lighter {emailEditorView ===
                              'preview'
                                ? 'bg-accent text-dark'
                                : 'bg-dark text-accent-muted hover:bg-dark-light'}"
                              on:click={() => (emailEditorView = 'preview')}
                            >
                              {t('marketing.viewPreview')}
                            </button>
                            <button
                              type="button"
                              role="tab"
                              class="px-3 py-1.5 text-sm border-l border-dark-lighter {emailEditorView ===
                              'split'
                                ? 'bg-accent text-dark'
                                : 'bg-dark text-accent-muted hover:bg-dark-light'}"
                              on:click={() => (emailEditorView = 'split')}
                            >
                              {t('marketing.viewSplit')}
                            </button>
                          </div>
                        </div>
                        <p class="text-xs text-accent-muted mb-2">
                          {t('marketing.htmlContentHint')}
                        </p>
                        <!-- Code view -->
                        {#if emailEditorView === 'code' || emailEditorView === 'split'}
                          <div
                            class={emailEditorView === 'split'
                              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                              : ''}
                          >
                            <div class={emailEditorView === 'split' ? 'min-h-[320px]' : ''}>
                              {#if templateEditorLanguage === 'default'}
                                <textarea
                                  id="templateHtmlContent"
                                  bind:value={editingTemplate.htmlContent}
                                  rows={emailEditorView === 'split' ? 14 : 15}
                                  placeholder={t('marketing.htmlContentPlaceholder')}
                                  class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent font-mono text-sm resize-y min-h-[200px]"
                                ></textarea>
                              {:else if editingTranslations[templateEditorLanguage]}
                                <textarea
                                  id="templateHtmlContent"
                                  bind:value={
                                    editingTranslations[templateEditorLanguage].htmlContent
                                  }
                                  rows={emailEditorView === 'split' ? 14 : 15}
                                  placeholder={t('marketing.htmlContentPlaceholder')}
                                  class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent font-mono text-sm resize-y min-h-[200px]"
                                ></textarea>
                              {/if}
                            </div>
                            {#if emailEditorView === 'split'}
                              <div
                                class="min-h-[320px] rounded border border-dark-lighter bg-white overflow-hidden"
                              >
                                <div
                                  class="text-xs text-accent-muted px-2 py-1 border-b border-dark-lighter"
                                >
                                  {t('marketing.viewPreview')}
                                </div>
                                <iframe
                                  title="Email preview"
                                  class="w-full min-h-[280px] border-0 bg-white"
                                  srcdoc={getSafePreviewHtml(htmlForPreview)}
                                ></iframe>
                              </div>
                            {/if}
                          </div>
                        {/if}
                        <!-- Preview-only view -->
                        {#if emailEditorView === 'preview'}
                          <div
                            class="rounded border border-dark-lighter bg-white overflow-hidden min-h-[360px]"
                          >
                            <div
                              class="text-xs text-accent-muted px-2 py-1 border-b border-dark-lighter"
                            >
                              {t('marketing.viewPreview')}
                            </div>
                            <iframe
                              title="Email preview"
                              class="w-full min-h-[320px] border-0 bg-white"
                              srcdoc={getSafePreviewHtml(htmlForPreview)}
                            ></iframe>
                          </div>
                        {/if}
                      </div>

                      <!-- Text Content -->
                      <div>
                        <label for="templateTextContent" class="block text-sm font-medium mb-2">
                          {t('marketing.textContent')}
                          <span class="text-accent-muted">({t('common.optional')})</span>
                        </label>
                        {#if templateEditorLanguage === 'default'}
                          <textarea
                            id="templateTextContent"
                            bind:value={editingTemplate.textContent}
                            rows="8"
                            placeholder={t('marketing.textContentPlaceholder')}
                            class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent font-mono text-sm"
                          ></textarea>
                        {:else if editingTranslations[templateEditorLanguage]}
                          <textarea
                            bind:value={editingTranslations[templateEditorLanguage].textContent}
                            rows="8"
                            placeholder={t('marketing.textContentPlaceholder')}
                            class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent font-mono text-sm"
                          ></textarea>
                        {/if}
                      </div>

                      <!-- Enabled Toggle (only for default) -->
                      {#if templateEditorLanguage === 'default'}
                        <div class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editingTemplate.enabled}
                            on:change={(e) => (editingTemplate.enabled = e.currentTarget.checked)}
                            id="template-enabled"
                            class=""
                          />
                          <label for="template-enabled" class="text-sm">
                            {t('marketing.templateEnabled')}
                          </label>
                        </div>
                      {/if}

                      <!-- Available Variables -->
                      {#if selectedTemplate.variables}
                        <div class="bg-blue-500/10 border border-blue-500/30 p-4">
                          <h5 class="font-medium mb-2">{t('marketing.availableVariables')}:</h5>
                          <ul class="text-sm text-accent-muted space-y-1">
                            {#each Object.keys(selectedTemplate.variables) as key}
                              <li>
                                <code class="bg-dark px-1 rounded">{`{{${key}}}`}</code> - {selectedTemplate
                                  .variables?.[key]}
                              </li>
                            {/each}
                          </ul>
                        </div>
                      {/if}
                    </div>
                    <div class="p-6 border-t border-dark-lighter flex gap-4 justify-end">
                      <button
                        on:click={() => {
                          showTemplateEditor = false;
                          selectedTemplate = null;
                          editingTemplate = {};
                          editingTranslations = {};
                          templateEditorLanguage = 'default';
                        }}
                        class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        on:click={saveTemplate}
                        disabled={saving}
                        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
                      >
                        {saving ? t('common.saving') : t('common.save')}
                      </button>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Templates List -->
              {#if emailTemplates.length > 0}
                <div class="bg-dark-light p-6">
                  <h4 class="font-medium mb-4">{t('marketing.emailTemplates')}</h4>
                  <div class="space-y-2">
                    {#each emailTemplates as template}
                      <div
                        class="flex items-center justify-between p-3 bg-dark border border-dark-lighter rounded"
                      >
                        <div>
                          <div class="font-medium">{getTemplateTypeName(template.type)}</div>
                          <div class="text-sm text-accent-muted">
                            {template.description || template.subject}
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <span
                            class="text-xs px-2 py-1 rounded {template.enabled
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'}"
                          >
                            {template.enabled ? t('common.enabled') : t('common.disabled')}
                          </span>
                          <button
                            on:click={() => editTemplate(template)}
                            class="px-3 py-1 text-sm bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                          >
                            {t('common.edit')}
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Test recipient -->
              <div class="pt-2">
                <label for="testEmailTo" class="block text-sm font-medium mb-2">
                  {t('marketing.testEmailTo')}
                </label>
                <input
                  id="testEmailTo"
                  type="email"
                  bind:value={emailSettings.testEmailTo}
                  placeholder={emailSettings.fromEmail}
                  class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent max-w-md"
                />
                <p class="text-xs text-accent-muted mt-1">{t('marketing.testEmailToHint')}</p>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-4 pt-4">
                <button
                  on:click={saveEmailSettings}
                  disabled={saving}
                  class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('marketing.saveSettings')}
                </button>
                <button
                  on:click={testEmail}
                  disabled={saving || !emailSettings.enabled}
                  class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {t('marketing.sendTestEmail')}
                </button>
              </div>
            </div>
          {:else}
            <div class="mt-4 text-sm text-accent-muted">
              {t('marketing.enableEmailServiceDesc')}
            </div>
          {/if}
        </div>
      {:else if activeTab === 'analytics'}
        <!-- Analytics Service -->
        <div class="bg-dark-light p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-medium mb-2">{t('marketing.analytics')}</h3>
              <p class="text-sm text-accent-muted">
                {t('marketing.analyticsDescription')}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                bind:checked={analyticsSettings.enabled}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>

          {#if analyticsSettings.enabled}
            <div class="space-y-6 mt-6">
              <!-- Google Analytics -->
              <div>
                <label for="googleAnalyticsId" class="block text-sm font-medium mb-2">
                  {t('marketing.googleAnalyticsId')}
                  <span class="text-accent-muted">({t('common.optional')})</span>
                </label>
                <input
                  id="googleAnalyticsId"
                  type="text"
                  bind:value={analyticsSettings.googleAnalyticsId}
                  placeholder={t('marketing.googleAnalyticsIdPlaceholder')}
                  class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                />
                <p class="text-xs text-accent-muted mt-1">
                  {t('marketing.googleAnalyticsIdHint')}
                </p>
              </div>

              <!-- Yandex Metrica -->
              <div>
                <label for="yandexMetricaId" class="block text-sm font-medium mb-2">
                  {t('marketing.yandexMetricaId')}
                  <span class="text-accent-muted">({t('common.optional')})</span>
                </label>
                <input
                  id="yandexMetricaId"
                  type="text"
                  bind:value={analyticsSettings.yandexMetricaId}
                  placeholder={t('marketing.yandexMetricaIdPlaceholder')}
                  class="wrounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                />
                <p class="text-xs text-accent-muted mt-1">
                  {t('marketing.yandexMetricaIdHint')}
                </p>
              </div>

              <!-- Info Box -->
              <div class="bg-blue-500/10 border border-blue-500/30 p-4">
                <h4 class="font-medium mb-2">{t('marketing.howItWorks')}</h4>
                <ul class="text-sm text-accent-muted space-y-1 list-disc list-inside">
                  <li>{t('marketing.analyticsInfo1')}</li>
                  <li>{t('marketing.analyticsInfo2')}</li>
                  <li>{t('marketing.analyticsInfo3')}</li>
                </ul>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-4 pt-4">
                <button
                  on:click={saveAnalyticsSettings}
                  disabled={saving}
                  class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('marketing.saveSettings')}
                </button>
              </div>
            </div>
          {:else}
            <div class="mt-4 text-sm text-accent-muted">
              {t('marketing.enableAnalyticsToTrack')}
            </div>
          {/if}
        </div>
      {:else if activeTab === 'loyalty'}
        <!-- Loyalty Program -->
        <div class="bg-dark-light p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-medium mb-2">{t('marketing.loyaltyProgram')}</h3>
              <p class="text-sm text-accent-muted">
                {t('marketing.loyaltyDescription')}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.loyaltyProgramEnabled}
                on:change={onLoyaltyToggle}
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
              ></div>
            </label>
          </div>
          <!-- Conditions: earn / spend rates -->
          <div class="mt-6 p-4 bg-dark border border-dark-lighter rounded">
            <h4 class="font-medium mb-4">{t('marketing.loyaltyConditions')}</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="loyaltyEarnPerUnit" class="block text-sm font-medium mb-2"
                  >{t('marketing.loyaltyEarnPerUnit')}</label
                >
                <input
                  id="loyaltyEarnPerUnit"
                  type="number"
                  min="0.01"
                  step="0.1"
                  bind:value={loyaltyEarnPerUnit}
                  class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                />
                <p class="text-xs text-accent-muted mt-1">
                  {t('marketing.loyaltyEarnPerUnitHint')}
                </p>
              </div>
              <div>
                <label for="loyaltySpendPerUnit" class="block text-sm font-medium mb-2"
                  >{t('marketing.loyaltySpendPerUnit')}</label
                >
                <input
                  id="loyaltySpendPerUnit"
                  type="number"
                  min="1"
                  step="1"
                  bind:value={loyaltySpendPerUnit}
                  class="w-full rounded px-4 py-2 bg-dark border border-dark-lighter focus:outline-none focus:border-accent"
                />
                <p class="text-xs text-accent-muted mt-1">
                  {t('marketing.loyaltySpendPerUnitHint')}
                </p>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button
                on:click={saveLoyaltyConditions}
                disabled={saving}
                class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('marketing.saveConditions')}
              </button>
            </div>
          </div>
          <div class="mt-4 p-4 bg-blue-500/10 border border-blue-500/30">
            <h4 class="font-medium mb-2">{t('marketing.howItWorks')}</h4>
            <ul class="text-sm text-accent-muted space-y-1 list-disc list-inside">
              <li>{t('marketing.loyaltyInfo1')}</li>
              <li>{t('marketing.loyaltyInfo2')}</li>
              <li>{t('marketing.loyaltyInfo3')}</li>
            </ul>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
