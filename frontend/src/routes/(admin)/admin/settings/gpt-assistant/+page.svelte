<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    gptAssistantSettingsApi,
    type GPTAssistantSettings,
  } from '$lib/api/gpt-assistant-settings.api';
  import { apiClient } from '$lib/api/client';
  import { notificationStore } from '$lib/stores/notification.store';
  import { gptVisibilityStore } from '$lib/stores/gpt-visibility.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { t } from '$lib/utils/i18n';
  import { normalizeUploadFile } from '$lib/utils/file-upload';

  let settings: GPTAssistantSettings | null = null;
  let loading = true;
  let saving = false;
  let testingConnection = false;
  let loadingModels = false;
  let uploadingFabIcon = false;
  let isDraggingFabIcon = false;
  let fabIconFileInput: HTMLInputElement | null = null;
  /** Model ids from provider /v1/models — shown as datalist hints; model field stays free text. */
  let discoveredModels: string[] = [];
  let activeTab: 'general' | 'api' | 'behavior' | 'security' | 'cache' = 'general';

  onMount(async () => {
    await loadSettings();
  });

  function normalizeBooleanFlags(s: GPTAssistantSettings): GPTAssistantSettings {
    return {
      ...s,
      enabledAdmin: Boolean(s.enabledAdmin),
      enabledCustomer: Boolean(s.enabledCustomer),
      enabledGuest: Boolean(s.enabledGuest),
      displayTitle: s.displayTitle ?? '',
      fabIconUrl: s.fabIconUrl ?? '',
      apiBaseUrl: s.apiBaseUrl ?? '',
      ragEnabled: Boolean(s.ragEnabled),
      ragEmbeddingModel: s.ragEmbeddingModel?.trim() || 'text-embedding-3-large',
      sttProvider: s.sttProvider ?? 'none',
    };
  }

  async function loadSettings() {
    loading = true;
    try {
      const data = await gptAssistantSettingsApi.getSettings();
      settings = normalizeBooleanFlags(data);
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  async function fetchModelList() {
    if (!settings) return;
    const baseParsed = parseApiBaseUrlForSave(settings.apiBaseUrl);
    if (!baseParsed.ok) {
      notificationStore.error(baseParsed.message);
      return;
    }
    if (settings.providerType === 'custom' && !baseParsed.value) {
      notificationStore.error(t('gptAssistant.apiBaseUrlRequiredCustom'));
      return;
    }
    loadingModels = true;
    try {
      const { models } = await gptAssistantSettingsApi.discoverModels({
        apiBaseUrl: baseParsed.value === null ? undefined : baseParsed.value,
        providerType: settings.providerType,
      });
      discoveredModels = models;
      if (models.length === 0) {
        notificationStore.error(t('gptAssistant.modelsEmpty'));
      } else {
        notificationStore.success(t('gptAssistant.modelsLoaded', { count: String(models.length) }));
      }
    } catch (error: any) {
      notificationStore.error(error.message || t('gptAssistant.modelsLoadFailed'));
    } finally {
      loadingModels = false;
    }
  }

  function parseApiBaseUrlForSave(
    raw: string | undefined | null
  ): { ok: true; value: string | null } | { ok: false; message: string } {
    const s = String(raw ?? '').trim();
    if (!s) return { ok: true, value: null };
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return { ok: false, message: t('gptAssistant.apiBaseUrlInvalid') };
      }
      return { ok: true, value: s };
    } catch {
      return { ok: false, message: t('gptAssistant.apiBaseUrlInvalid') };
    }
  }

  function apiBasePlaceholder(providerType: string): string {
    switch (providerType) {
      case 'lm_studio':
        return 'http://127.0.0.1:1234/v1';
      case 'custom':
        return 'https://proxy.example.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  function modelExamples(providerType: string): string[] {
    switch (providerType) {
      case 'lm_studio':
        return ['qwen2.5-7b-instruct', 'llama-3.1-8b-instruct', 'mistral-7b-instruct'];
      case 'anthropic':
        return ['claude-3-5-sonnet-latest', 'claude-3-7-sonnet-latest'];
      case 'custom':
        return ['my-model-id', 'gpt-4o-mini', 'qwen2.5-7b-instruct'];
      default:
        return ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1'];
    }
  }

  function modelPlaceholder(providerType: string): string {
    return modelExamples(providerType)[0];
  }

  function isModelLooksLikeUrl(model: string | undefined | null): boolean {
    const m = String(model || '')
      .trim()
      .toLowerCase();
    if (!m) return false;
    return (
      m.startsWith('http://') ||
      m.startsWith('https://') ||
      m.includes('127.0.0.1:') ||
      m.includes('/v1')
    );
  }

  async function saveSettings() {
    if (!settings) return;

    const baseParsed = parseApiBaseUrlForSave(settings.apiBaseUrl);
    if (!baseParsed.ok) {
      notificationStore.error(baseParsed.message);
      return;
    }
    if (settings.providerType === 'custom' && !baseParsed.value) {
      notificationStore.error(t('gptAssistant.apiBaseUrlRequiredCustom'));
      return;
    }
    if (!String(settings.model || '').trim()) {
      notificationStore.error(t('gptAssistant.modelMustBeModelId'));
      return;
    }
    if (isModelLooksLikeUrl(settings.model)) {
      notificationStore.error(t('gptAssistant.modelMustBeModelId'));
      return;
    }

    saving = true;
    try {
      const payload: GPTAssistantSettings = {
        ...settings,
        apiBaseUrl: baseParsed.value ?? '',
        enabledAdmin: Boolean(settings.enabledAdmin),
        enabledCustomer: Boolean(settings.enabledCustomer),
        enabledGuest: Boolean(settings.enabledGuest),
        ragEnabled: Boolean(settings.ragEnabled),
        ragEmbeddingModel:
          String(settings.ragEmbeddingModel || '').trim() || 'text-embedding-3-large',
      };
      const data = await gptAssistantSettingsApi.updateSettings(payload);
      settings = normalizeBooleanFlags(data);
      await gptVisibilityStore.load();
      notificationStore.success(t('gptAssistant.settingsSaved'));
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToSave'));
    } finally {
      saving = false;
    }
  }

  async function uploadFabIconFile(file: File) {
    if (!settings) return;
    if (!file.type.startsWith('image/')) {
      notificationStore.error(t('gptAssistant.display.fabIconImagesOnly'));
      return;
    }
    uploadingFabIcon = true;
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', normalizeUploadFile(file));

      const data = await apiClient.post<{ image?: { url?: string }; url?: string }>(
        '/settings/favicon/upload',
        uploadFormData
      );
      settings.fabIconUrl = data.image?.url || data.url || '';
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('page.failedToUploadImage'));
    } finally {
      uploadingFabIcon = false;
    }
  }

  function handleFabIconFileSelect(event: Event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.files?.[0]) {
      uploadFabIconFile(target.files[0]);
      target.value = '';
    }
  }

  function handleFabIconDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingFabIcon = true;
  }

  function handleFabIconDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingFabIcon = false;
  }

  function handleFabIconDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingFabIcon = false;
    const f = event.dataTransfer?.files?.[0];
    if (f) uploadFabIconFile(f);
  }

  function openFabIconFileDialog() {
    fabIconFileInput?.click();
  }

  async function testConnection() {
    testingConnection = true;
    try {
      const result = (await gptAssistantSettingsApi.testConnection()) as {
        success: boolean;
        error?: string;
      };
      if (result.success) {
        notificationStore.success(t('gptAssistant.connectionSuccess'));
      } else {
        notificationStore.error(result.error || t('gptAssistant.connectionError'));
      }
    } catch (error: any) {
      notificationStore.error(error.message || t('gptAssistant.connectionError'));
    } finally {
      testingConnection = false;
    }
  }

  async function handleRagEnabledChange(nextValue: boolean) {
    if (!settings) return;

    if (!nextValue) {
      settings.ragEnabled = false;
      return;
    }

    const confirmed = await dialogStore.confirm(
      t('gptAssistant.rag.enableModal.message'),
      t('gptAssistant.rag.enableModal.title'),
      t('gptAssistant.rag.enableModal.confirm'),
      t('common.cancel')
    );

    settings.ragEnabled = confirmed;
  }
</script>

<div>
  <div class="flex flex-wrap justify-between items-center gap-4 mb-6 min-w-0">
    <h1 class="text-3xl font-bold min-w-0 shrink-0">{t('gptAssistant.settings')}</h1>
    <div class="flex flex-wrap gap-4 min-w-0">
      <button
        on:click={() => goto('/admin/settings/gpt-assistant/prompts')}
        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        {t('gptAssistant.prompts')}
      </button>
      <button
        on:click={() => goto('/admin/settings/gpt-assistant/analytics')}
        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        {t('gptAssistant.analytics')}
      </button>
      <button
        on:click={() => goto('/admin/settings/gpt-assistant/logs')}
        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        {t('gptAssistant.logs')}
      </button>
      <button
        type="button"
        on:click={testConnection}
        disabled={testingConnection}
        class="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {testingConnection ? t('gptAssistant.testingConnection') : t('gptAssistant.testConnection')}
      </button>
      <button
        type="button"
        on:click={() => saveSettings()}
        disabled={saving || !settings}
        class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {saving ? t('gptAssistant.saving') : t('gptAssistant.save')}
      </button>
    </div>
  </div>

  {#if loading}
    <p class="text-gray-500">{t('gptAssistant.loading')}</p>
  {:else if settings}
    <!-- Tabs -->
    <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
      <button
        on:click={() => (activeTab = 'general')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'general'}
        class:shadow-sm={activeTab === 'general'}
        class:text-accent={activeTab === 'general'}
        class:text-gray-600={activeTab !== 'general'}
        class:hover:bg-gray-50={activeTab !== 'general'}
        class:hover:text-gray-900={activeTab !== 'general'}
      >
        {t('gptAssistant.tabs.general')}
      </button>
      <button
        on:click={() => (activeTab = 'api')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'api'}
        class:shadow-sm={activeTab === 'api'}
        class:text-accent={activeTab === 'api'}
        class:text-gray-600={activeTab !== 'api'}
        class:hover:bg-gray-50={activeTab !== 'api'}
        class:hover:text-gray-900={activeTab !== 'api'}
      >
        {t('gptAssistant.tabs.api')}
      </button>
      <button
        on:click={() => (activeTab = 'behavior')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'behavior'}
        class:shadow-sm={activeTab === 'behavior'}
        class:text-accent={activeTab === 'behavior'}
        class:text-gray-600={activeTab !== 'behavior'}
        class:hover:bg-gray-50={activeTab !== 'behavior'}
        class:hover:text-gray-900={activeTab !== 'behavior'}
      >
        {t('gptAssistant.tabs.behavior')}
      </button>
      <button
        on:click={() => (activeTab = 'security')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'security'}
        class:shadow-sm={activeTab === 'security'}
        class:text-accent={activeTab === 'security'}
        class:text-gray-600={activeTab !== 'security'}
        class:hover:bg-gray-50={activeTab !== 'security'}
        class:hover:text-gray-900={activeTab !== 'security'}
      >
        {t('gptAssistant.tabs.security')}
      </button>
      <button
        on:click={() => (activeTab = 'cache')}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'cache'}
        class:shadow-sm={activeTab === 'cache'}
        class:text-accent={activeTab === 'cache'}
        class:text-gray-600={activeTab !== 'cache'}
        class:hover:bg-gray-50={activeTab !== 'cache'}
        class:hover:text-gray-900={activeTab !== 'cache'}
      >
        {t('gptAssistant.tabs.cache')}
      </button>
    </div>

    <!-- General Settings -->
    {#if activeTab === 'general'}
      <div class="space-y-6">
        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.display.title')}</h3>
          <p class="text-sm text-gray-600 mb-4">{t('gptAssistant.display.description')}</p>
          <div class="space-y-4">
            <label for="gpt-display-title" class="block">
              <span class="block text-sm font-medium mb-1"
                >{t('gptAssistant.display.assistantTitle')}</span
              >
              <input
                id="gpt-display-title"
                type="text"
                bind:value={settings.displayTitle}
                placeholder={t('gptAssistant.title')}
                class="w-full px-4 py-2 border border-gray-300 rounded"
                aria-label={t('gptAssistant.display.assistantTitle')}
              />
              <span class="block text-xs text-gray-500 mt-1"
                >{t('gptAssistant.display.assistantTitleHint')}</span
              >
            </label>
            <div class="block">
              <span class="block text-sm font-medium mb-1"
                >{t('gptAssistant.display.fabIconUrl')}</span
              >
              <input
                id="gpt-fab-icon-url"
                type="url"
                bind:value={settings.fabIconUrl}
                placeholder="https://..."
                class="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                aria-label={t('gptAssistant.display.fabIconUrl')}
              />
              <span class="block text-xs text-gray-500 mt-1"
                >{t('gptAssistant.display.fabIconUrlHint')}</span
              >

              <div
                class="relative mt-3 border-2 border-dashed rounded-lg p-5 text-center transition-all {isDraggingFabIcon
                  ? 'border-black bg-black/5'
                  : 'border-black/30 bg-white hover:border-black/50 hover:bg-black/5'}"
                on:dragover={handleFabIconDragOver}
                on:dragleave={handleFabIconDragLeave}
                on:drop={handleFabIconDrop}
                role="button"
                tabindex="0"
                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFabIconFileDialog();
                  }
                }}
              >
                <input
                  bind:this={fabIconFileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
                  on:change={handleFabIconFileSelect}
                  class="hidden"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  on:click={openFabIconFileDialog}
                  disabled={uploadingFabIcon}
                  class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black disabled:opacity-50 rounded"
                >
                  {uploadingFabIcon ? t('page.uploading') : t('page.uploadImage')}
                </button>
                <p class="text-xs text-gray-500 mt-2">{t('page.dragAndDrop')}</p>
              </div>

              {#if settings.fabIconUrl?.trim()}
                <div class="mt-3 flex items-center gap-4">
                  <span class="text-xs text-gray-500"
                    >{t('gptAssistant.display.fabIconPreview')}</span
                  >
                  <div
                    class="w-14 h-14 rounded-full border border-gray-200 bg-gray-100 overflow-hidden flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <img
                      src={settings.fabIconUrl}
                      alt=""
                      class="w-full h-full object-cover"
                      on:error={(e) => {
                        const el = e.currentTarget;
                        if (el instanceof HTMLImageElement) el.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.tabs.general')}</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-4">
              <span id="gpt-enabled-admin-label">{t('gptAssistant.enableForAdmins')}</span>
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  bind:checked={settings.enabledAdmin}
                  class="sr-only peer"
                  aria-labelledby="gpt-enabled-admin-label"
                />
                <div
                  class="relative w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span id="gpt-enabled-customer-label">{t('gptAssistant.enableForCustomers')}</span>
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  bind:checked={settings.enabledCustomer}
                  class="sr-only peer"
                  aria-labelledby="gpt-enabled-customer-label"
                />
                <div
                  class="relative w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span id="gpt-enabled-guest-label">{t('gptAssistant.enableForGuests')}</span>
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  bind:checked={settings.enabledGuest}
                  class="sr-only peer"
                  aria-labelledby="gpt-enabled-guest-label"
                />
                <div
                  class="relative w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                ></div>
              </label>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.mode')}</h3>
          <div class="space-y-4">
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.mode')}</span>
              <select bind:value={settings.mode} class="px-4 py-2 border border-gray-300 rounded">
                <option value="production">Production</option>
                <option value="test">Test</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.logLevel')}</span>
              <select
                bind:value={settings.logLevel}
                class="px-4 py-2 border border-gray-300 rounded"
              >
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    {/if}

    <!-- API Settings -->
    {#if activeTab === 'api'}
      <div class="space-y-6">
        <p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-4 py-2">
          {t('gptAssistant.saveBeforeTestHint')}
        </p>
        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.providerType')}</h3>
          <div class="space-y-4">
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.providerType')}</span>
              <select
                bind:value={settings.providerType}
                class="px-4 py-2 border border-gray-300 rounded"
              >
                <option value="openai">OpenAI</option>
                <option value="lm_studio">LM Studio</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span>{t('gptAssistant.apiBaseUrl')}</span>
              <input
                type="text"
                inputmode="url"
                autocomplete="off"
                spellcheck="false"
                bind:value={settings.apiBaseUrl}
                placeholder={apiBasePlaceholder(settings.providerType)}
                class="px-4 py-2 border border-gray-300 rounded bg-white font-mono text-sm"
                aria-label={t('gptAssistant.apiBaseUrl')}
              />
              <span class="text-xs text-gray-500"
                >{t('gptAssistant.apiBaseUrlHintAllProviders')}</span
              >
            </label>
            <label class="flex flex-col gap-2">
              <span>{t('gptAssistant.model')}</span>
              <div class="flex flex-col sm:flex-row gap-2 sm:items-center sm:flex-wrap">
                <input
                  type="text"
                  list="gpt-model-suggestions"
                  bind:value={settings.model}
                  placeholder={modelPlaceholder(settings.providerType)}
                  class="px-4 py-2 border border-gray-300 rounded flex-1 min-w-[200px]"
                  aria-label={t('gptAssistant.model')}
                />
                <datalist id="gpt-model-suggestions">
                  {#each discoveredModels as id}
                    <!-- svelte-ignore element_invalid_self_closing_tag -->
                    <option value={id}></option>
                  {/each}
                </datalist>
                <button
                  type="button"
                  class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-60 whitespace-nowrap"
                  disabled={loadingModels}
                  on:click={fetchModelList}
                >
                  {loadingModels ? t('gptAssistant.loadingModels') : t('gptAssistant.loadModels')}
                </button>
              </div>
              <span class="text-xs text-gray-500">
                {t('gptAssistant.modelFetchHint')} Примеры model id: {modelExamples(
                  settings.providerType
                ).join(', ')}.
              </span>
            </label>
            <label class="flex flex-col">
              <span class="mb-2">{t('gptAssistant.apiKey')}</span>
              <input
                type="password"
                bind:value={settings.apiKey}
                placeholder="sk-..."
                class="px-4 py-2 border border-gray-300 rounded"
              />
            </label>
            <label class="flex flex-col">
              <span class="mb-2">{t('gptAssistant.testApiKey')}</span>
              <input
                type="password"
                bind:value={settings.testApiKey}
                placeholder="sk-test-..."
                class="px-4 py-2 border border-gray-300 rounded"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span>{t('gptAssistant.sttProvider')}</span>
              <select
                bind:value={settings.sttProvider}
                class="px-4 py-2 border border-gray-300 rounded bg-white max-w-md"
              >
                <option value="none">{t('gptAssistant.sttProvider.none')}</option>
                <option value="browser">{t('gptAssistant.sttProvider.browser')}</option>
                <option value="openai">{t('gptAssistant.sttProvider.openai')}</option>
                <option value="custom">{t('gptAssistant.sttProvider.custom')}</option>
              </select>
              <span class="text-xs text-gray-500">{t('gptAssistant.sttProvider.hint')}</span>
            </label>
          </div>
        </div>

        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.tabs.api')}</h3>
          <div class="space-y-4">
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h4 class="font-medium text-amber-900">{t('gptAssistant.rag.title')}</h4>
                  <p class="mt-1 text-sm text-amber-800">{t('gptAssistant.rag.description')}</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.ragEnabled}
                    on:change={(event) => {
                      const target = event.currentTarget;
                      if (target instanceof HTMLInputElement) {
                        handleRagEnabledChange(target.checked);
                      }
                    }}
                    class="sr-only peer"
                    aria-label={t('gptAssistant.rag.enable')}
                  />
                  <div
                    class="relative w-11 h-6 bg-dark peer-focus:outline-none rounded peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-accent after:rounded after:h-5 after:w-5 after:transition-all peer-checked:bg-white"
                  ></div>
                </label>
              </div>

              <div class="mt-4 space-y-3">
                <label class="flex flex-col gap-1">
                  <span>{t('gptAssistant.rag.embeddingModel')}</span>
                  <input
                    type="text"
                    bind:value={settings.ragEmbeddingModel}
                    placeholder="text-embedding-3-large"
                    class="px-4 py-2 border border-gray-300 rounded bg-white"
                    aria-label={t('gptAssistant.rag.embeddingModel')}
                  />
                  <span class="text-xs text-gray-600"
                    >{t('gptAssistant.rag.embeddingModelHint')}</span
                  >
                </label>

                <div class="text-xs text-gray-700 whitespace-pre-line">
                  {t('gptAssistant.rag.checklist')}
                </div>
              </div>
            </div>

            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.timeout')}</span>
              <input
                type="number"
                bind:value={settings.timeout}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
          </div>
        </div>
      </div>
    {/if}

    <!-- Behavior Settings -->
    {#if activeTab === 'behavior'}
      <div class="space-y-6">
        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.analytics.admins')}</h3>
          <div class="space-y-4">
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.adminMaxResponseLength')}</span>
              <input
                type="number"
                bind:value={settings.adminMaxResponseLength}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.adminEnableSuggestions')}</span>
              <input
                type="checkbox"
                bind:checked={settings.adminEnableSuggestions}
                class="w-5 h-5"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.adminEnableQuickActions')}</span>
              <input
                type="checkbox"
                bind:checked={settings.adminEnableQuickActions}
                class="w-5 h-5"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.adminDetailLevel')}</span>
              <select
                bind:value={settings.adminDetailLevel}
                class="px-4 py-2 border border-gray-300 rounded"
              >
                <option value="detailed">{t('gptAssistant.adminDetailLevel.detailed')}</option>
                <option value="normal">{t('gptAssistant.adminDetailLevel.normal')}</option>
                <option value="brief">{t('gptAssistant.adminDetailLevel.brief')}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.analytics.customers')}</h3>
          <div class="space-y-4">
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.customerMaxResponseLength')}</span>
              <input
                type="number"
                bind:value={settings.customerMaxResponseLength}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.customerEnableSuggestions')}</span>
              <input
                type="checkbox"
                bind:checked={settings.customerEnableSuggestions}
                class="w-5 h-5"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.customerEnableQuickActions')}</span>
              <input
                type="checkbox"
                bind:checked={settings.customerEnableQuickActions}
                class="w-5 h-5"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.customerTone')}</span>
              <select
                bind:value={settings.customerTone}
                class="px-4 py-2 border border-gray-300 rounded"
              >
                <option value="friendly">{t('gptAssistant.customerTone.friendly')}</option>
                <option value="professional">{t('gptAssistant.customerTone.professional')}</option>
                <option value="casual">{t('gptAssistant.customerTone.casual')}</option>
              </select>
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.customerEnableRecommendations')}</span>
              <input
                type="checkbox"
                bind:checked={settings.customerEnableRecommendations}
                class="w-5 h-5"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.customerEnableContextHelp')}</span>
              <input
                type="checkbox"
                bind:checked={settings.customerEnableContextHelp}
                class="w-5 h-5"
              />
            </label>
          </div>
        </div>
      </div>
    {/if}

    <!-- Security Settings -->
    {#if activeTab === 'security'}
      <div class="space-y-6">
        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.tabs.security')}</h3>
          <div class="space-y-4">
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.rateLimitAdmin')}</span>
              <input
                type="number"
                bind:value={settings.rateLimitAdmin}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.rateLimitCustomer')}</span>
              <input
                type="number"
                bind:value={settings.rateLimitCustomer}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.rateLimitGuest')}</span>
              <input
                type="number"
                bind:value={settings.rateLimitGuest}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.blockOnLimitExceeded')}</span>
              <input type="checkbox" bind:checked={settings.blockOnLimitExceeded} class="w-5 h-5" />
            </label>
          </div>
        </div>

        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.tabs.security')}</h3>
          <div class="space-y-4">
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.filterContent')}</span>
              <input type="checkbox" bind:checked={settings.filterContent} class="w-5 h-5" />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.checkPermissions')}</span>
              <input type="checkbox" bind:checked={settings.checkPermissions} class="w-5 h-5" />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.logAllRequests')}</span>
              <input type="checkbox" bind:checked={settings.logAllRequests} class="w-5 h-5" />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.anonymizeLogs')}</span>
              <input type="checkbox" bind:checked={settings.anonymizeLogs} class="w-5 h-5" />
            </label>
          </div>
        </div>
      </div>
    {/if}

    <!-- Cache Settings -->
    {#if activeTab === 'cache'}
      <div class="space-y-6">
        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-medium mb-4">{t('gptAssistant.tabs.cache')}</h3>
          <div class="space-y-4">
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.enableCache')}</span>
              <input type="checkbox" bind:checked={settings.enableCache} class="w-5 h-5" />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.cacheTTL')}</span>
              <input
                type="number"
                bind:value={settings.cacheTTL}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.cacheFrequentQueries')}</span>
              <input type="checkbox" bind:checked={settings.cacheFrequentQueries} class="w-5 h-5" />
            </label>
            <label class="flex items-center justify-between">
              <span>{t('gptAssistant.maxCacheSize')}</span>
              <input
                type="number"
                bind:value={settings.maxCacheSize}
                class="px-4 py-2 border border-gray-300 rounded w-32"
              />
            </label>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
