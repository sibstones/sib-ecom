<script lang="ts">
  import { onMount } from 'svelte';
  import { gptAssistantSettingsApi } from '$lib/api/gpt-assistant-settings.api';
  import { gptAssistantApi, type AssistantResponse } from '$lib/api/gpt-assistant.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';

  let testMessage = '';
  let testUserType: 'admin' | 'customer' = 'admin';
  let testResponse: AssistantResponse | null = null;
  let testing = false;
  let connectionTesting = false;
  let connectionResult: { success: boolean; message?: string; error?: string } | null = null;
  let testHistory: Array<{ message: string; response: AssistantResponse; timestamp: Date }> = [];

  async function testConnection() {
    connectionTesting = true;
    connectionResult = null;
    try {
      const result = await gptAssistantSettingsApi.testConnection();
      connectionResult = {
        success: result.success,
        message: result.message || t('gptAssistant.test.connectionSuccess'),
      };
      if (result.response) {
        connectionResult.message += `\n${t('gptAssistant.test.response')}: ${result.response}`;
      }
    } catch (error: any) {
      connectionResult = {
        success: false,
        error: error.message || t('gptAssistant.test.connectionError'),
      };
    } finally {
      connectionTesting = false;
    }
  }

  async function testChat() {
    if (!testMessage.trim()) {
      notificationStore.error(t('gptAssistant.test.enterMessage'));
      return;
    }

    testing = true;
    testResponse = null;

    try {
      const response =
        testUserType === 'admin'
          ? await gptAssistantApi.chatAdmin({
              message: testMessage,
              context: {
                currentPage: '/admin/settings/gpt-assistant/test',
              },
            })
          : await gptAssistantApi.chatCustomer({
              message: testMessage,
              context: {
                currentPage: '/shop',
              },
            });

      testResponse = response;
      testHistory.unshift({
        message: testMessage,
        response,
        timestamp: new Date(),
      });

      // Limit history to 10 records
      if (testHistory.length > 10) {
        testHistory = testHistory.slice(0, 10);
      }

      testMessage = '';
    } catch (error: any) {
      notificationStore.error(error.message || t('gptAssistant.test.testingError'));
      testResponse = {
        response: `${t('gptAssistant.test.testingError')}: ${error.message || t('gptAssistant.test.unknownError')}`,
        intent: 'UNKNOWN',
        executionTime: 0,
      };
    } finally {
      testing = false;
    }
  }

  function formatExecutionTime(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  function getIntentColor(intent: string): string {
    if (intent.includes('PRODUCT')) return 'bg-blue-100 text-blue-800';
    if (intent.includes('ORDER')) return 'bg-green-100 text-green-800';
    if (intent.includes('CUSTOMER')) return 'bg-purple-100 text-purple-800';
    if (intent.includes('INVENTORY')) return 'bg-yellow-100 text-yellow-800';
    if (intent === 'UNKNOWN') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">{t('gptAssistant.test.title')}</h1>
  </div>

  <!-- Connection Test -->
  <div class="bg-gray-50 p-6 rounded-lg mb-6">
    <h2 class="text-xl font-medium mb-4">{t('gptAssistant.test.connectionTest')}</h2>
    <p class="text-sm text-gray-600 mb-4">
      {t('gptAssistant.test.connectionDescription')}
    </p>
    <button
      on:click={testConnection}
      disabled={connectionTesting}
      class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      {connectionTesting ? t('gptAssistant.test.testing') : t('gptAssistant.test.testConnection')}
    </button>

    {#if connectionResult}
      <div
        class="mt-4 p-4 rounded {connectionResult.success
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'}"
      >
        <div class="flex items-start gap-2">
          {#if connectionResult.success}
            <svg
              class="w-5 h-5 text-green-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          {:else}
            <svg
              class="w-5 h-5 text-red-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          {/if}
          <div>
            <p class="font-medium {connectionResult.success ? 'text-green-800' : 'text-red-800'}">
              {connectionResult.success
                ? t('gptAssistant.test.connectionSuccess')
                : t('gptAssistant.test.connectionError')}
            </p>
            {#if connectionResult.message}
              <p
                class="text-sm mt-1 whitespace-pre-wrap {connectionResult.success
                  ? 'text-green-700'
                  : 'text-red-700'}"
              >
                {connectionResult.message}
              </p>
            {/if}
            {#if connectionResult.error}
              <p class="text-sm mt-1 text-red-700">{connectionResult.error}</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Test Console -->
  <div class="bg-gray-50 p-6 rounded-lg mb-6">
    <h2 class="text-xl font-medium mb-4">{t('gptAssistant.test.testConsole')}</h2>

    <div class="mb-4">
      <p class="block text-sm font-medium mb-2">{t('gptAssistant.test.userType')}</p>
      <div class="flex gap-4">
        <label for="gptTestUserAdmin" class="flex items-center">
          <input
            id="gptTestUserAdmin"
            type="radio"
            bind:group={testUserType}
            value="admin"
            class="mr-2"
          />
          {t('gptAssistant.test.admin')}
        </label>
        <label for="gptTestUserCustomer" class="flex items-center">
          <input
            id="gptTestUserCustomer"
            type="radio"
            bind:group={testUserType}
            value="customer"
            class="mr-2"
          />
          {t('gptAssistant.test.customer')}
        </label>
      </div>
    </div>

    <div class="mb-4">
      <label for="gptTestMessage" class="block text-sm font-medium mb-2"
        >{t('gptAssistant.test.testMessage')}</label
      >
      <textarea
        id="gptTestMessage"
        bind:value={testMessage}
        placeholder={t('gptAssistant.test.testMessagePlaceholder')}
        rows="3"
        class="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-black"
        on:keydown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            testChat();
          }
        }}
      ></textarea>
      <p class="text-xs text-gray-500 mt-1">{t('gptAssistant.test.sendHint')}</p>
    </div>

    <button
      on:click={testChat}
      disabled={testing || !testMessage.trim()}
      class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      {testing ? t('gptAssistant.test.testing') : t('gptAssistant.test.send')}
    </button>

    {#if testResponse}
      <div class="mt-6 space-y-4">
        <div class="bg-white p-4 rounded-lg border border-gray-200">
          <h3 class="font-medium mb-2">{t('gptAssistant.test.response')}</h3>
          <p class="text-sm whitespace-pre-wrap mb-4">
            {testResponse.intent === 'UNKNOWN'
              ? t('gptAssistant.unavailable')
              : testResponse.response}
          </p>

          <div class="flex gap-4 text-xs">
            <div>
              <span class="text-gray-500">{t('gptAssistant.test.intent')}:</span>
              <span class="ml-2 px-2 py-1 rounded {getIntentColor(testResponse.intent)} font-mono">
                {testResponse.intent}
              </span>
            </div>
            <div>
              <span class="text-gray-500">{t('gptAssistant.test.executionTime')}:</span>
              <span class="ml-2 font-medium">{formatExecutionTime(testResponse.executionTime)}</span
              >
            </div>
          </div>

          {#if testResponse.data}
            <details class="mt-4">
              <summary class="cursor-pointer text-sm font-medium text-gray-700"
                >{t('gptAssistant.test.data')}</summary
              >
              <pre class="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">{JSON.stringify(
                  testResponse.data,
                  null,
                  2
                )}</pre>
            </details>
          {/if}

          {#if testResponse.suggestions && testResponse.suggestions.length > 0}
            <div class="mt-4">
              <p class="text-sm font-medium mb-2">{t('gptAssistant.test.suggestions')}:</p>
              <div class="flex flex-wrap gap-2">
                {#each testResponse.suggestions as suggestion}
                  <span class="px-2 py-1 bg-gray-100 rounded text-xs">{suggestion}</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if testResponse.quickActions && testResponse.quickActions.length > 0}
            <div class="mt-4">
              <p class="text-sm font-medium mb-2">{t('gptAssistant.test.quickActions')}:</p>
              <div class="flex flex-wrap gap-2">
                {#each testResponse.quickActions as action}
                  <span class="px-2 py-1 bg-black text-white rounded text-xs">{action.label}</span>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Test History -->
  {#if testHistory.length > 0}
    <div class="bg-gray-50 p-6 rounded-lg">
      <h2 class="text-xl font-medium mb-4">{t('gptAssistant.test.history')}</h2>
      <div class="space-y-3">
        {#each testHistory as test, index}
          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <div class="flex justify-between items-start mb-2">
              <div>
                <p class="font-medium text-sm">{test.message}</p>
                <p class="text-xs text-gray-500 mt-1">
                    {test.timestamp.toLocaleString()}
                </p>
              </div>
              <span class="px-2 py-1 rounded text-xs {getIntentColor(test.response.intent)}">
                {test.response.intent}
              </span>
            </div>
            <p class="text-sm text-gray-700 line-clamp-2">
              {test.response.intent === 'UNKNOWN'
                ? t('gptAssistant.unavailable')
                : test.response.response}
            </p>
            <div class="mt-2 text-xs text-gray-500">
              {t('gptAssistant.test.executionTime')}: {formatExecutionTime(
                test.response.executionTime
              )}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
