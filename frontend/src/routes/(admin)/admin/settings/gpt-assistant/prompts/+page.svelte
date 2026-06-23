<script lang="ts">
  import { onMount } from 'svelte';
  import {
    gptAssistantSettingsApi,
    type GPTAssistantPrompt,
  } from '$lib/api/gpt-assistant-settings.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';

  let prompts: GPTAssistantPrompt[] = [];
  let loading = true;
  let activeTab: 'admin' | 'customer' | 'admin_intent' | 'customer_intent' = 'admin';
  let editingPrompt: GPTAssistantPrompt | null = null;
  let promptText = '';
  let promptComment = '';
  let creatingPrompt = false;
  let creatingQuickPrompt = false;
  let newPromptText = '';
  let newPromptComment = '';
  let newPromptVersion = '1.0';
  let promptSortOrder = 0;
  let promptActive = true;
  let newPromptSortOrder = 0;

  $: showTryAskingSection = activeTab === 'admin' || activeTab === 'customer';
  onMount(async () => {
    await loadPrompts();
  });

  async function loadPrompts() {
    loading = true;
    try {
      prompts = await gptAssistantSettingsApi.getPrompts();
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function getSystemPromptsForTab() {
    switch (activeTab) {
      case 'admin':
        return prompts.filter((prompt) => prompt.type === 'admin');
      case 'customer':
        return prompts.filter((prompt) => prompt.type === 'customer');
      case 'admin_intent':
        return prompts.filter((prompt) => prompt.type === 'admin_intent_recognition');
      case 'customer_intent':
        return prompts.filter((prompt) => prompt.type === 'customer_intent_recognition');
      default:
        return [];
    }
  }

  function getTryAskingPromptsForTab() {
    if (activeTab === 'admin') {
      return prompts
        .filter((prompt) => prompt.type === 'quick_admin')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    if (activeTab === 'customer') {
      return prompts
        .filter((prompt) => prompt.type === 'quick_customer')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return [];
  }

  function getPromptsForTab() {
    return getSystemPromptsForTab();
  }

  function editPrompt(prompt: GPTAssistantPrompt) {
    editingPrompt = prompt;
    promptText = prompt.prompt;
    promptComment = prompt.comment || '';
    promptSortOrder = prompt.sortOrder ?? 0;
    promptActive = prompt.isActive;
  }

  function cancelEdit() {
    editingPrompt = null;
    promptText = '';
    promptComment = '';
    promptSortOrder = 0;
    promptActive = true;
    if (creatingPrompt) {
      cancelCreate();
    }
  }

  async function savePrompt() {
    if (!editingPrompt) return;

    try {
      await gptAssistantSettingsApi.updatePrompt(editingPrompt.id, {
        prompt: promptText,
        comment: promptComment,
        ...(isQuickPromptType(editingPrompt.type)
          ? { sortOrder: promptSortOrder, isActive: promptActive }
          : {}),
      });
      notificationStore.success(t('gptAssistant.prompts.saved'));
      await loadPrompts();
      cancelEdit();
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToSave'));
    }
  }

  function getPromptTypeLabel(type: string): string {
    switch (type) {
      case 'admin':
        return t('gptAssistant.prompts.systemPromptAdmin');
      case 'customer':
        return t('gptAssistant.prompts.systemPromptCustomer');
      case 'quick_admin':
        return t('gptAssistant.prompts.quickPromptAdmin');
      case 'quick_customer':
        return t('gptAssistant.prompts.quickPromptCustomer');
      case 'admin_intent_recognition':
        return t('gptAssistant.prompts.intentRecognitionAdmin');
      case 'customer_intent_recognition':
        return t('gptAssistant.prompts.intentRecognitionCustomer');
      default:
        return type;
    }
  }

  function getSystemPromptTypeForTab(): string {
    switch (activeTab) {
      case 'admin':
        return 'admin';
      case 'customer':
        return 'customer';
      case 'admin_intent':
        return 'admin_intent_recognition';
      case 'customer_intent':
        return 'customer_intent_recognition';
      default:
        return 'admin';
    }
  }

  function getTryAskingPromptTypeForTab(): string {
    return activeTab === 'customer' ? 'quick_customer' : 'quick_admin';
  }

  function isQuickPromptType(type: string): boolean {
    return type === 'quick_admin' || type === 'quick_customer';
  }

  function startCreatingPrompt() {
    creatingPrompt = true;
    creatingQuickPrompt = false;
    newPromptText = '';
    newPromptComment = '';
    newPromptVersion = '1.0';
    newPromptSortOrder = getTryAskingPromptsForTab().length;
    if (editingPrompt) {
      editingPrompt = null;
      promptText = '';
      promptComment = '';
      promptSortOrder = 0;
      promptActive = true;
    }
  }

  function startCreatingTryAskingPrompt() {
    creatingPrompt = true;
    creatingQuickPrompt = true;
    newPromptText = '';
    newPromptComment = '';
    newPromptVersion = '1.0';
    newPromptSortOrder = getTryAskingPromptsForTab().length;
    if (editingPrompt) {
      editingPrompt = null;
      promptText = '';
      promptComment = '';
      promptSortOrder = 0;
      promptActive = true;
    }
  }

  function cancelCreate() {
    creatingPrompt = false;
    creatingQuickPrompt = false;
    newPromptText = '';
    newPromptComment = '';
    newPromptVersion = '1.0';
    newPromptSortOrder = 0;
  }

  async function createPrompt() {
    if (!newPromptText.trim()) {
      notificationStore.error(t('gptAssistant.prompts.emptyError'));
      return;
    }

    try {
      const isQuick = creatingQuickPrompt;
      await gptAssistantSettingsApi.createPrompt({
        type: isQuick ? getTryAskingPromptTypeForTab() : getSystemPromptTypeForTab(),
        prompt: newPromptText,
        version: isQuick ? undefined : newPromptVersion,
        comment: newPromptComment || undefined,
        sortOrder: isQuick ? newPromptSortOrder : undefined,
      });
      notificationStore.success(t('gptAssistant.prompts.created'));
      await loadPrompts();
      cancelCreate();
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToSave'));
    }
  }

  async function deletePrompt(prompt: GPTAssistantPrompt) {
    if (!confirm(t('gptAssistant.prompts.deleteConfirm'))) return;
    try {
      await gptAssistantSettingsApi.deletePrompt(prompt.id);
      notificationStore.success(t('gptAssistant.prompts.deleted'));
      await loadPrompts();
      if (editingPrompt?.id === prompt.id) {
        cancelEdit();
      }
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToDelete'));
    }
  }

  async function moveQuickPrompt(prompt: GPTAssistantPrompt, direction: -1 | 1) {
    const items = getTryAskingPromptsForTab();
    const index = items.findIndex((item) => item.id === prompt.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return;

    const other = items[targetIndex];
    try {
      await Promise.all([
        gptAssistantSettingsApi.updatePrompt(prompt.id, { sortOrder: targetIndex }),
        gptAssistantSettingsApi.updatePrompt(other.id, { sortOrder: index }),
      ]);
      await loadPrompts();
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToSave'));
    }
  }

  async function toggleQuickPromptActive(prompt: GPTAssistantPrompt) {
    try {
      await gptAssistantSettingsApi.updatePrompt(prompt.id, { isActive: !prompt.isActive });
      await loadPrompts();
    } catch (error: any) {
      notificationStore.error(error.message || t('error.failedToSave'));
    }
  }
</script>

{#snippet promptCard(prompt: GPTAssistantPrompt, index: number, quickList: GPTAssistantPrompt[])}
  <div class="bg-gray-50 p-6 rounded-lg">
    <div class="flex justify-between items-start mb-4">
      <div>
        <h3 class="text-lg font-medium">{getPromptTypeLabel(prompt.type)}</h3>
        {#if isQuickPromptType(prompt.type)}
          <p class="text-sm text-gray-500">
            {t('gptAssistant.prompts.sortOrder')}: {prompt.sortOrder ?? 0}
          </p>
        {:else}
          <p class="text-sm text-gray-500">{t('gptAssistant.prompts.version')}: {prompt.version}</p>
        {/if}
        {#if prompt.comment}
          <p class="text-sm text-gray-600 mt-1">{prompt.comment}</p>
        {/if}
      </div>
      <div class="flex flex-wrap gap-2 justify-end">
        {#if prompt.isDefault}
          <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
            >{t('gptAssistant.prompts.default')}</span
          >
        {/if}
        {#if prompt.isActive}
          <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
            >{t('gptAssistant.prompts.active')}</span
          >
        {:else}
          <span class="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded"
            >{t('gptAssistant.prompts.inactive')}</span
          >
        {/if}
        {#if isQuickPromptType(prompt.type)}
          <button
            type="button"
            on:click={() => moveQuickPrompt(prompt, -1)}
            disabled={index === 0}
            class="px-3 py-2 bg-gray-200 hover:bg-gray-300 transition-colors text-sm disabled:opacity-50"
          >
            {t('gptAssistant.prompts.moveUp')}
          </button>
          <button
            type="button"
            on:click={() => moveQuickPrompt(prompt, 1)}
            disabled={index === quickList.length - 1}
            class="px-3 py-2 bg-gray-200 hover:bg-gray-300 transition-colors text-sm disabled:opacity-50"
          >
            {t('gptAssistant.prompts.moveDown')}
          </button>
          <button
            type="button"
            on:click={() => toggleQuickPromptActive(prompt)}
            class="px-3 py-2 bg-gray-200 hover:bg-gray-300 transition-colors text-sm"
          >
            {prompt.isActive
              ? t('gptAssistant.prompts.inactive')
              : t('gptAssistant.prompts.active')}
          </button>
        {/if}
        <button
          type="button"
          on:click={() => editPrompt(prompt)}
          class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
        >
          {t('gptAssistant.prompts.edit')}
        </button>
        <button
          type="button"
          on:click={() => deletePrompt(prompt)}
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 transition-colors text-sm"
        >
          {t('gptAssistant.prompts.delete')}
        </button>
      </div>
    </div>

    {#if editingPrompt?.id === prompt.id}
      <div class="mt-4 space-y-4">
        <div>
          <label for={`edit-prompt-text-${prompt.id}`} class="block text-sm font-medium mb-2">
            {isQuickPromptType(prompt.type)
              ? t('gptAssistant.prompts.question')
              : t('gptAssistant.prompts.prompt')}
          </label>
          <textarea
            id={`edit-prompt-text-${prompt.id}`}
            bind:value={promptText}
            rows={isQuickPromptType(prompt.type) ? 3 : 10}
            class="w-full px-4 py-2 border border-gray-300 rounded font-mono text-sm"
          ></textarea>
        </div>
        {#if isQuickPromptType(prompt.type)}
          <div>
            <label
              for={`edit-prompt-sort-order-${prompt.id}`}
              class="block text-sm font-medium mb-2">{t('gptAssistant.prompts.sortOrder')}</label
            >
            <input
              id={`edit-prompt-sort-order-${prompt.id}`}
              type="number"
              min="0"
              bind:value={promptSortOrder}
              class="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={promptActive} />
            {t('gptAssistant.prompts.active')}
          </label>
        {/if}
        <div>
          <label for={`edit-prompt-comment-${prompt.id}`} class="block text-sm font-medium mb-2"
            >{t('gptAssistant.prompts.comment')}</label
          >
          <input
            id={`edit-prompt-comment-${prompt.id}`}
            type="text"
            bind:value={promptComment}
            placeholder={t('gptAssistant.prompts.commentPlaceholder')}
            class="w-full px-4 py-2 border border-gray-300 rounded"
          />
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            on:click={savePrompt}
            class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
          >
            {t('gptAssistant.save')}
          </button>
          <button
            type="button"
            on:click={cancelEdit}
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            {t('gptAssistant.prompts.cancel')}
          </button>
        </div>
      </div>
    {:else}
      <pre
        class="text-sm bg-white p-4 rounded border border-gray-200 overflow-x-auto max-h-48 overflow-y-auto">{prompt.prompt}</pre>
    {/if}
  </div>
{/snippet}

<div>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">{t('gptAssistant.prompts.title')}</h1>
    <button
      on:click={startCreatingPrompt}
      class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
    >
      {t('gptAssistant.prompts.createNew')}
    </button>
  </div>

  {#if loading}
    <p class="text-gray-500">{t('gptAssistant.loading')}</p>
  {:else}
    <div class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
      <button
        on:click={() => {
          activeTab = 'admin';
          if (creatingPrompt) cancelCreate();
        }}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'admin'}
        class:shadow-sm={activeTab === 'admin'}
        class:text-accent={activeTab === 'admin'}
        class:text-gray-600={activeTab !== 'admin'}
        class:hover:bg-gray-50={activeTab !== 'admin'}
        class:hover:text-gray-900={activeTab !== 'admin'}
      >
        {t('gptAssistant.prompts.tabs.admin')}
      </button>
      <button
        on:click={() => {
          activeTab = 'customer';
          if (creatingPrompt) cancelCreate();
        }}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'customer'}
        class:shadow-sm={activeTab === 'customer'}
        class:text-accent={activeTab === 'customer'}
        class:text-gray-600={activeTab !== 'customer'}
        class:hover:bg-gray-50={activeTab !== 'customer'}
        class:hover:text-gray-900={activeTab !== 'customer'}
      >
        {t('gptAssistant.prompts.tabs.customer')}
      </button>
      <button
        on:click={() => {
          activeTab = 'admin_intent';
          if (creatingPrompt) cancelCreate();
        }}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'admin_intent'}
        class:shadow-sm={activeTab === 'admin_intent'}
        class:text-accent={activeTab === 'admin_intent'}
        class:text-gray-600={activeTab !== 'admin_intent'}
        class:hover:bg-gray-50={activeTab !== 'admin_intent'}
        class:hover:text-gray-900={activeTab !== 'admin_intent'}
      >
        {t('gptAssistant.prompts.tabs.adminIntent')}
      </button>
      <button
        on:click={() => {
          activeTab = 'customer_intent';
          if (creatingPrompt) cancelCreate();
        }}
        class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
        class:bg-white={activeTab === 'customer_intent'}
        class:shadow-sm={activeTab === 'customer_intent'}
        class:text-accent={activeTab === 'customer_intent'}
        class:text-gray-600={activeTab !== 'customer_intent'}
        class:hover:bg-gray-50={activeTab !== 'customer_intent'}
        class:hover:text-gray-900={activeTab !== 'customer_intent'}
      >
        {t('gptAssistant.prompts.tabs.customerIntent')}
      </button>
    </div>

    {#if creatingPrompt}
      <div class="bg-gray-50 p-6 rounded-lg mb-6 border-2 border-black">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-medium">
            {creatingQuickPrompt
              ? t('gptAssistant.prompts.addQuestion')
              : t('gptAssistant.prompts.createNew')}
          </h2>
          <button on:click={cancelCreate} class="text-gray-500 hover:text-gray-700"> ✕ </button>
        </div>
        <div class="space-y-4">
          <div>
            <div class="block text-sm font-medium mb-2">{t('gptAssistant.prompts.promptType')}</div>
            <div class="px-4 py-2 bg-gray-200 rounded text-sm">
              {getPromptTypeLabel(
                creatingQuickPrompt ? getTryAskingPromptTypeForTab() : getSystemPromptTypeForTab()
              )}
            </div>
          </div>
          {#if !creatingQuickPrompt}
            <div>
              <label for="new-prompt-version" class="block text-sm font-medium mb-2"
                >{t('gptAssistant.prompts.version')}</label
              >
              <input
                id="new-prompt-version"
                type="text"
                bind:value={newPromptVersion}
                placeholder="1.0"
                class="w-full px-4 py-2 border border-gray-300 rounded"
              />
            </div>
          {:else}
            <div>
              <label for="new-prompt-sort-order" class="block text-sm font-medium mb-2"
                >{t('gptAssistant.prompts.sortOrder')}</label
              >
              <input
                id="new-prompt-sort-order"
                type="number"
                min="0"
                bind:value={newPromptSortOrder}
                class="w-full px-4 py-2 border border-gray-300 rounded"
              />
            </div>
          {/if}
          <div>
            <label for="new-prompt-text" class="block text-sm font-medium mb-2">
              {creatingQuickPrompt
                ? t('gptAssistant.prompts.question')
                : t('gptAssistant.prompts.prompt')}
            </label>
            <textarea
              id="new-prompt-text"
              bind:value={newPromptText}
              rows={creatingQuickPrompt ? 3 : 10}
              placeholder={creatingQuickPrompt
                ? t('gptAssistant.prompts.questionPlaceholder')
                : t('gptAssistant.prompts.promptPlaceholder')}
              class="w-full px-4 py-2 border border-gray-300 rounded font-mono text-sm"
            ></textarea>
          </div>
          <div>
            <label for="new-prompt-comment" class="block text-sm font-medium mb-2"
              >{t('gptAssistant.prompts.comment')}</label
            >
            <input
              id="new-prompt-comment"
              type="text"
              bind:value={newPromptComment}
              placeholder={t('gptAssistant.prompts.commentPlaceholder')}
              class="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>
          <div class="flex gap-2">
            <button
              on:click={createPrompt}
              class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
            >
              {t('gptAssistant.prompts.create')}
            </button>
            <button
              on:click={cancelCreate}
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              {t('gptAssistant.prompts.cancel')}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if showTryAskingSection}
      <div class="space-y-8">
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">{getPromptTypeLabel(getSystemPromptTypeForTab())}</h2>
          {#each getSystemPromptsForTab() as prompt, index (prompt.id)}
            {@render promptCard(prompt, index, [])}
          {:else}
            <p class="text-gray-500 text-center py-8">{t('gptAssistant.prompts.notFound')}</p>
          {/each}
        </section>

        <section class="space-y-4 border-t border-gray-200 pt-8">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold">{t('gptAssistant.quickPrompts.title')}</h2>
              <p class="mt-2 text-sm text-gray-600">{t('gptAssistant.prompts.tryAskingHint')}</p>
            </div>
            <button
              type="button"
              on:click={startCreatingTryAskingPrompt}
              class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
            >
              {t('gptAssistant.prompts.addQuestion')}
            </button>
          </div>
          {#each getTryAskingPromptsForTab() as prompt, index (prompt.id)}
            {@render promptCard(prompt, index, getTryAskingPromptsForTab())}
          {:else}
            <p class="text-gray-500 text-center py-8">{t('gptAssistant.prompts.notFound')}</p>
          {/each}
        </section>
      </div>
    {:else}
      <div class="space-y-4">
        {#each getPromptsForTab() as prompt, index (prompt.id)}
          {@render promptCard(prompt, index, [])}
        {:else}
          <p class="text-gray-500 text-center py-8">{t('gptAssistant.prompts.notFound')}</p>
        {/each}
      </div>
    {/if}
  {/if}
</div>
