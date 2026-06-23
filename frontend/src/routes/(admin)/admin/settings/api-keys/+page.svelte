<script lang="ts">
  import { onMount } from 'svelte';
  import {
    apiKeyApi,
    type ApiKey,
    type CreateApiKeyInput,
    type ApiScope,
  } from '$lib/api/api-key.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';

  let apiKeys: ApiKey[] = [];
  let loading = true;
  let showForm = false;
  let showKeyModal = false;
  let selectedApiKey: ApiKey | null = null;
  let newApiKey: string = '';
  let viewingStats: ApiKey | null = null;
  let stats: any = null;
  let availableScopes: ApiScope[] = [];
  let scopesGrouped: Record<string, ApiScope[]> = {};
  let loadingScopes = false;

  let formData: CreateApiKeyInput = {
    name: '',
    description: '',
    allowedIPs: [],
    allowedDomains: [],
    scopes: [],
    rateLimit: 1000,
    quota: undefined,
    expiresAt: undefined,
  };

  let ipInput = '';
  let domainInput = '';

  onMount(async () => {
    await Promise.all([loadApiKeys(), loadScopes()]);
  });

  async function loadScopes() {
    loadingScopes = true;
    try {
      const response = await apiKeyApi.getScopes();
      availableScopes = response.scopes || [];
      scopesGrouped = response.grouped || {};
      console.log('Loaded scopes:', {
        scopes: availableScopes.length,
        groups: Object.keys(scopesGrouped).length,
      });
    } catch (e) {
      console.error('Failed to load scopes:', e);
      notificationStore.error(t('admin.apiKeys.failedToLoadScopes'));
      availableScopes = [];
      scopesGrouped = {};
    } finally {
      loadingScopes = false;
    }
  }

  async function loadApiKeys() {
    loading = true;
    try {
      apiKeys = await apiKeyApi.getAll();
    } catch (e) {
      notificationStore.error(t('admin.apiKeys.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function openForm(key?: ApiKey) {
    if (key) {
      selectedApiKey = key;
      formData = {
        name: key.name,
        description: key.description || '',
        allowedIPs: [...key.allowedIPs],
        allowedDomains: [...key.allowedDomains],
        scopes: [...(key.scopes || [])],
        rateLimit: key.rateLimit,
        quota: key.quota || undefined,
        expiresAt: key.expiresAt || undefined,
      };
    } else {
      selectedApiKey = null;
      formData = {
        name: '',
        description: '',
        allowedIPs: [],
        allowedDomains: [],
        scopes: [],
        rateLimit: 1000,
        quota: undefined,
        expiresAt: undefined,
      };
    }
    ipInput = '';
    domainInput = '';
    showForm = true;
  }

  function addIP() {
    if (ipInput.trim() && !formData.allowedIPs?.includes(ipInput.trim())) {
      formData.allowedIPs = [...(formData.allowedIPs || []), ipInput.trim()];
      ipInput = '';
    }
  }

  function removeIP(ip: string) {
    formData.allowedIPs = formData.allowedIPs?.filter((i) => i !== ip) || [];
  }

  function addDomain() {
    if (domainInput.trim() && !formData.allowedDomains?.includes(domainInput.trim())) {
      formData.allowedDomains = [...(formData.allowedDomains || []), domainInput.trim()];
      domainInput = '';
    }
  }

  function removeDomain(domain: string) {
    formData.allowedDomains = formData.allowedDomains?.filter((d) => d !== domain) || [];
  }

  async function saveApiKey() {
    try {
      if (!formData.name) {
        notificationStore.error(t('admin.apiKeys.nameRequired'));
        return;
      }

      if (selectedApiKey) {
        await apiKeyApi.update(selectedApiKey.id, formData);
        notificationStore.success(t('admin.apiKeys.updatedSuccessfully'));
      } else {
        const result = await apiKeyApi.create(formData);
        newApiKey = result.key;
        showKeyModal = true;
        notificationStore.success(t('admin.apiKeys.createdSuccessfully'));
      }
      showForm = false;
      await loadApiKeys();
    } catch (e: any) {
      notificationStore.error(e.message || t('admin.apiKeys.failedToSave'));
    }
  }

  async function deleteApiKey(key: ApiKey) {
    const confirmed = await dialogStore.confirm(
      t('admin.apiKeys.deleteConfirm', { name: key.name }),
      t('admin.apiKeys.delete')
    );
    if (!confirmed) return;

    try {
      await apiKeyApi.delete(key.id);
      notificationStore.success(t('admin.apiKeys.deletedSuccessfully'));
      await loadApiKeys();
    } catch (e: any) {
      notificationStore.error(e.message || 'Failed to delete API key');
    }
  }

  async function toggleActive(key: ApiKey) {
    try {
      await apiKeyApi.update(key.id, { isActive: !key.isActive });
      notificationStore.success(
        t(!key.isActive ? 'admin.apiKeys.activated' : 'admin.apiKeys.deactivated')
      );
      await loadApiKeys();
    } catch (e: any) {
      notificationStore.error(e.message || t('admin.apiKeys.failedToUpdate'));
    }
  }

  async function rotateApiKey(key: ApiKey) {
    const confirmed = await dialogStore.confirm(
      t('admin.apiKeys.rotateConfirm', { name: key.name }),
      t('admin.apiKeys.rotate')
    );
    if (!confirmed) return;

    try {
      const result = await apiKeyApi.rotate(key.id, {
        name: key.name,
        description: key.description,
        allowedIPs: key.allowedIPs,
        allowedDomains: key.allowedDomains,
        scopes: key.scopes || [],
        rateLimit: key.rateLimit,
        quota: key.quota || undefined,
        expiresAt: key.expiresAt || undefined,
      });
      newApiKey = result.key;
      showKeyModal = true;
      notificationStore.success(t('admin.apiKeys.rotatedSuccessfully'));
      await loadApiKeys();
    } catch (e: any) {
      notificationStore.error(e.message || t('admin.apiKeys.failedToRotate'));
    }
  }

  async function viewStats(key: ApiKey) {
    viewingStats = key;
    try {
      stats = await apiKeyApi.getStats(key.id, 30);
    } catch (e: any) {
      notificationStore.error(e.message || t('admin.apiKeys.failedToLoadStatistics'));
    }
  }

  function formatDate(date: string | undefined) {
    if (!date) return t('admin.apiKeys.never');
    return new Date(date).toLocaleString();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    notificationStore.success(t('admin.apiKeys.copiedToClipboard'));
  }

  function isExpired(key: ApiKey) {
    if (!key.expiresAt) return false;
    return new Date(key.expiresAt) < new Date();
  }

  function isQuotaExceeded(key: ApiKey) {
    if (!key.quota) return false;
    return key.quotaUsed >= key.quota;
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('admin.apiKeys.title')}</h2>
    <button
      on:click={() => openForm()}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('admin.apiKeys.create')}
    </button>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if apiKeys.length === 0}
    <div class="bg-dark-light p-8 text-center">
      <p class="text-accent-muted mb-4">{t('admin.apiKeys.noKeysFound')}</p>
      <button
        on:click={() => openForm()}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('admin.apiKeys.createFirst')}
      </button>
    </div>
  {:else}
    <div class="space-y-4">
      {#each apiKeys as key}
        <div class="bg-dark-light p-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-xl font-semibold">{key.name}</h3>
                <span
                  class="px-2 py-1 text-xs rounded {key.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'}"
                >
                  {key.isActive ? t('admin.apiKeys.active') : t('admin.apiKeys.inactive')}
                </span>
                {#if isExpired(key)}
                  <span class="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">
                    {t('admin.apiKeys.expired')}
                  </span>
                {/if}
                {#if isQuotaExceeded(key)}
                  <span class="px-2 py-1 text-xs rounded bg-orange-500/20 text-orange-400">
                    {t('admin.apiKeys.quotaExceeded')}
                  </span>
                {/if}
              </div>
              <p class="text-sm text-accent-muted font-mono mb-2">{key.keyPrefix}...</p>
              {#if key.description}
                <p class="text-accent-muted mb-2">{key.description}</p>
              {/if}
            </div>
            <div class="flex gap-2">
              <button
                on:click={() => toggleActive(key)}
                class="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 transition-colors"
              >
                {key.isActive ? t('admin.apiKeys.deactivate') : t('admin.apiKeys.activate')}
              </button>
              <button
                on:click={() => viewStats(key)}
                class="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 transition-colors"
              >
                {t('admin.apiKeys.stats')}
              </button>
              <button
                on:click={() => rotateApiKey(key)}
                class="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 transition-colors"
              >
                {t('admin.apiKeys.rotateButton')}
              </button>
              <button
                on:click={() => openForm(key)}
                class="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 transition-colors"
              >
                {t('admin.apiKeys.editButton')}
              </button>
              <button
                on:click={() => deleteApiKey(key)}
                class="px-4 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                {t('admin.apiKeys.deleteButton')}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="text-accent-muted">{t('admin.apiKeys.rateLimit')}</p>
              <p class="font-medium">{key.rateLimit} / 15min</p>
            </div>
            <div>
              <p class="text-accent-muted">{t('admin.apiKeys.quota')}</p>
              <p class="font-medium">
                {key.quota ? `${key.quotaUsed} / ${key.quota}` : t('admin.apiKeys.unlimited')}
              </p>
            </div>
            <div>
              <p class="text-accent-muted">{t('admin.apiKeys.lastUsed')}</p>
              <p class="font-medium">{formatDate(key.lastUsedAt)}</p>
            </div>
            <div>
              <p class="text-accent-muted">{t('admin.apiKeys.expires')}</p>
              <p class="font-medium">
                {key.expiresAt ? formatDate(key.expiresAt) : t('admin.apiKeys.never')}
              </p>
            </div>
          </div>

          {#if key.scopes && key.scopes.length > 0}
            <div class="mt-4 pt-4 border-t border-white/10">
              <p class="text-sm text-accent-muted mb-2">{t('admin.apiKeys.scopes')}</p>
              <div class="flex flex-wrap gap-2">
                {#each key.scopes as scope}
                  <span class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">{scope}</span
                  >
                {/each}
              </div>
            </div>
          {:else if key.scopes && key.scopes.length === 0}
            <div class="mt-4 pt-4 border-t border-white/10">
              <p class="text-sm text-accent-muted">{t('admin.apiKeys.fullAccess')}</p>
            </div>
          {/if}
          {#if key.allowedIPs.length > 0 || key.allowedDomains.length > 0}
            <div class="mt-4 pt-4 border-t border-white/10">
              {#if key.allowedIPs.length > 0}
                <div class="mb-2">
                  <p class="text-sm text-accent-muted mb-1">{t('admin.apiKeys.allowedIPs')}</p>
                  <div class="flex flex-wrap gap-2">
                    {#each key.allowedIPs as ip}
                      <span class="px-2 py-1 bg-white/10 rounded text-xs font-mono">{ip}</span>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if key.allowedDomains.length > 0}
                <div>
                  <p class="text-sm text-accent-muted mb-1">{t('admin.apiKeys.allowedDomains')}</p>
                  <div class="flex flex-wrap gap-2">
                    {#each key.allowedDomains as domain}
                      <span class="px-2 py-1 bg-white/10 rounded text-xs">{domain}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create/Edit Form Modal -->
  {#if showForm}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        class="bg-dark-light p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <h3 class="text-2xl font-bold mb-6">
          {selectedApiKey ? t('admin.apiKeys.edit') : t('admin.apiKeys.create')}
        </h3>

        <div class="space-y-4">
          <div>
            <label for="apiKeyName" class="block text-sm font-medium mb-2"
              >{t('admin.apiKeys.name')}</label
            >
            <input
              id="apiKeyName"
              type="text"
              bind:value={formData.name}
              class="w-full px-4 py-2 bg-dark border border-white/10 rounded"
              placeholder={t('admin.apiKeys.namePlaceholder')}
            />
          </div>

          <div>
            <label for="apiKeyDescription" class="block text-sm font-medium mb-2"
              >{t('admin.apiKeys.description')}</label
            >
            <textarea
              id="apiKeyDescription"
              bind:value={formData.description}
              class="w-full px-4 py-2 bg-dark border border-white/10 rounded"
              rows="3"
              placeholder={t('admin.apiKeys.descriptionPlaceholder')}
            ></textarea>
          </div>

          <div>
            <label for="apiKeyRateLimit" class="block text-sm font-medium mb-2"
              >{t('admin.apiKeys.rateLimitLabel')}</label
            >
            <input
              id="apiKeyRateLimit"
              type="number"
              bind:value={formData.rateLimit}
              min="1"
              max="100000"
              class="w-full px-4 py-2 bg-dark border border-white/10 rounded"
            />
          </div>

          <div>
            <label for="apiKeyQuota" class="block text-sm font-medium mb-2"
              >{t('admin.apiKeys.quotaLabel')}</label
            >
            <input
              id="apiKeyQuota"
              type="number"
              bind:value={formData.quota}
              min="1"
              class="w-full px-4 py-2 bg-dark border border-white/10 rounded"
              placeholder={t('admin.apiKeys.quotaPlaceholder')}
            />
          </div>

          <div>
            <label for="apiKeyExpiresAt" class="block text-sm font-medium mb-2"
              >{t('admin.apiKeys.expirationDate')}</label
            >
            <input
              id="apiKeyExpiresAt"
              type="datetime-local"
              bind:value={formData.expiresAt}
              class="w-full px-4 py-2 bg-dark border border-white/10 rounded"
            />
          </div>

          <div>
            <label for="apiKeyScopes" class="block text-sm font-medium mb-2">
              {t('admin.apiKeys.scopesLabel')}
            </label>
            <p class="text-xs text-accent-muted mb-3">
              {t('admin.apiKeys.scopesHint')}
            </p>
            {#if loadingScopes}
              <p class="text-accent-muted">{t('admin.apiKeys.loadingScopes')}</p>
            {:else if Object.keys(scopesGrouped).length === 0}
              <div class="border border-white/10 rounded p-4">
                <p class="text-accent-muted text-sm">
                  {t('admin.apiKeys.noScopesAvailable')}
                </p>
              </div>
            {:else}
              <div class="max-h-64 overflow-y-auto border border-white/10 rounded p-4 space-y-4">
                {#each Object.entries(scopesGrouped) as [resource, scopes]}
                  <div>
                    <h5 class="font-medium mb-2 capitalize">{resource}</h5>
                    <div class="space-y-2 ml-4">
                      {#each scopes as scope}
                        <label class="flex items-center gap-2 cursor-pointer">
                          <input
                            id={`apiScope-${scope.scope}`}
                            type="checkbox"
                            checked={formData.scopes?.includes(scope.scope)}
                            on:change={() => {
                              if (!formData.scopes) formData.scopes = [];
                              const isChecked = formData.scopes.includes(scope.scope);
                              if (isChecked) {
                                formData.scopes = formData.scopes.filter((s) => s !== scope.scope);
                              } else {
                                formData.scopes = [...formData.scopes, scope.scope];
                              }
                            }}
                            class="w-4 h-4"
                          />
                          <div class="flex-1">
                            <span class="text-sm font-mono">{scope.scope}</span>
                            <p class="text-xs text-accent-muted">{scope.description}</p>
                          </div>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
              {#if formData.scopes && formData.scopes.length > 0}
                <div class="mt-3">
                  <p class="text-xs text-accent-muted mb-2">{t('admin.apiKeys.selectedScopes')}</p>
                  <div class="flex flex-wrap gap-2">
                    {#each formData.scopes as scope}
                      <span
                        class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-2"
                      >
                        {scope}
                        <button
                          on:click={() => {
                            formData.scopes = formData.scopes?.filter((s) => s !== scope) || [];
                          }}
                          class="text-blue-400 hover:text-blue-300"
                        >
                          ×
                        </button>
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            {/if}
          </div>

          <div>
            <label for="apiKeyAllowedIp" class="block text-sm font-medium mb-2"
              >{t('admin.apiKeys.allowedIPsLabel')}</label
            >
            <div class="flex gap-2 mb-2">
              <input
                id="apiKeyAllowedIp"
                type="text"
                bind:value={ipInput}
                on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addIP())}
                class="flex-1 px-4 py-2 bg-dark border border-white/10 rounded"
                placeholder={t('admin.apiKeys.allowedIPsPlaceholder')}
              />
              <button
                on:click={addIP}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
              >
                {t('admin.apiKeys.add')}
              </button>
            </div>
            {#if formData.allowedIPs && formData.allowedIPs.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each formData.allowedIPs as ip}
                  <span class="px-2 py-1 bg-white/10 rounded text-sm flex items-center gap-2">
                    {ip}
                    <button on:click={() => removeIP(ip)} class="text-red-400 hover:text-red-300">
                      ×
                    </button>
                  </span>
                {/each}
              </div>
            {/if}
          </div>

          <div>
            <label for="apiKeyAllowedDomain" class="block text-sm font-medium mb-2"
              >{t('admin.apiKeys.allowedDomainsLabel')}</label
            >
            <div class="flex gap-2 mb-2">
              <input
                id="apiKeyAllowedDomain"
                type="text"
                bind:value={domainInput}
                on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                class="flex-1 px-4 py-2 bg-dark border border-white/10 rounded"
                placeholder={t('admin.apiKeys.allowedDomainsPlaceholder')}
              />
              <button
                on:click={addDomain}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
              >
                {t('admin.apiKeys.add')}
              </button>
            </div>
            {#if formData.allowedDomains && formData.allowedDomains.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each formData.allowedDomains as domain}
                  <span class="px-2 py-1 bg-white/10 rounded text-sm flex items-center gap-2">
                    {domain}
                    <button
                      on:click={() => removeDomain(domain)}
                      class="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="flex gap-4 mt-6">
          <button
            on:click={saveApiKey}
            class="flex-1 px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {selectedApiKey ? t('admin.apiKeys.update') : t('admin.apiKeys.createButton')}
          </button>
          <button
            on:click={() => (showForm = false)}
            class="flex-1 px-6 py-2 bg-white/10 hover:bg-white/20 transition-colors"
          >
            {t('admin.apiKeys.cancel')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- New Key Modal -->
  {#if showKeyModal}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-dark-light p-6 max-w-2xl w-full" role="dialog" aria-modal="true">
        <h3 class="text-2xl font-bold mb-4">{t('admin.apiKeys.created')}</h3>
        <p class="text-accent-muted mb-4">
          {t('admin.apiKeys.storeSecurely')}
        </p>
        <div class="bg-dark p-4 rounded mb-4">
          <code class="text-sm font-mono break-all">{newApiKey}</code>
        </div>
        <div class="flex gap-4">
          <button
            on:click={() => copyToClipboard(newApiKey)}
            class="flex-1 px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('admin.apiKeys.copyToClipboard')}
          </button>
          <button
            on:click={() => (showKeyModal = false)}
            class="flex-1 px-6 py-2 bg-white/10 hover:bg-white/20 transition-colors"
          >
            {t('admin.apiKeys.close')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Stats Modal -->
  {#if viewingStats && stats}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        class="bg-dark-light p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <h3 class="text-2xl font-bold mb-4">
          {t('admin.apiKeys.usageStatistics')} - {viewingStats.name}
        </h3>
        <p class="text-accent-muted mb-6">{t('admin.apiKeys.period')} {stats.period}</p>

        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-dark p-4 rounded">
            <p class="text-sm text-accent-muted mb-1">{t('admin.apiKeys.totalRequests')}</p>
            <p class="text-2xl font-bold">{stats.stats.totalRequests}</p>
          </div>
          <div class="bg-dark p-4 rounded">
            <p class="text-sm text-accent-muted mb-1">{t('admin.apiKeys.quotaUsed')}</p>
            <p class="text-2xl font-bold">
              {viewingStats.quotaUsed} / {viewingStats.quota || '∞'}
            </p>
          </div>
          <div class="bg-dark p-4 rounded">
            <p class="text-sm text-accent-muted mb-1">{t('admin.apiKeys.rateLimit')}</p>
            <p class="text-2xl font-bold">{viewingStats.rateLimit} / 15min</p>
          </div>
        </div>

        {#if stats.stats.requestsByEndpoint.length > 0}
          <div class="mb-6">
            <h4 class="text-lg font-semibold mb-3">{t('admin.apiKeys.requestsByEndpoint')}</h4>
            <div class="space-y-2">
              {#each stats.stats.requestsByEndpoint as item}
                <div class="flex justify-between items-center bg-dark p-3 rounded">
                  <code class="text-sm font-mono">{item.endpoint}</code>
                  <span class="font-medium">{item.count}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if stats.stats.recentRequests.length > 0}
          <div>
            <h4 class="text-lg font-semibold mb-3">{t('admin.apiKeys.recentRequests')}</h4>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-white/10">
                    <th class="text-left p-2">{t('admin.apiKeys.time')}</th>
                    <th class="text-left p-2">{t('admin.apiKeys.ip')}</th>
                    <th class="text-left p-2">{t('admin.apiKeys.endpoint')}</th>
                    <th class="text-left p-2">{t('admin.apiKeys.method')}</th>
                    <th class="text-left p-2">{t('admin.apiKeys.status')}</th>
                    <th class="text-left p-2">{t('admin.apiKeys.responseTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each stats.stats.recentRequests as log}
                    <tr class="border-b border-white/5">
                      <td class="p-2 text-sm">{formatDate(log.createdAt)}</td>
                      <td class="p-2 text-sm font-mono">{log.ip}</td>
                      <td class="p-2 text-sm font-mono">{log.endpoint}</td>
                      <td class="p-2 text-sm">{log.method}</td>
                      <td class="p-2 text-sm">{log.statusCode}</td>
                      <td class="p-2 text-sm">{log.responseTime}ms</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <div class="mt-6">
          <button
            on:click={() => (viewingStats = null)}
            class="px-6 py-2 bg-white/10 hover:bg-white/20 transition-colors"
          >
            {t('admin.apiKeys.close')}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
