<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { gptAssistantApi, type AIConversationListItem } from '$lib/api/gpt-assistant.api';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { t } from '$lib/utils/i18n';

  type ChannelFilter = 'admin' | 'customer';

  const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'WAITING_FOR_USER', label: 'Waiting for user' },
    { value: 'WAITING_FOR_ADMIN', label: 'Waiting for admin' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'ESCALATED', label: 'Escalated' },
    { value: 'RESOLVED', label: 'Resolved' },
  ];

  let conversations: AIConversationListItem[] = [];
  let loading = true;
  let error = '';
  let channel: ChannelFilter = 'customer';
  let status = '';
  let search = '';
  let currentPage = 1;
  let total = 0;
  const limit = 20;

  $: totalPages = Math.max(1, Math.ceil(total / limit));

  onMount(async () => {
    await loadConversations();
  });

  async function loadConversations() {
    loading = true;
    error = '';

    try {
      const response = await gptAssistantApi.getAdminConversations({
        channel,
        status: status || undefined,
        search: search || undefined,
        limit,
        offset: (currentPage - 1) * limit,
      });

      conversations = response.conversations;
      total = response.total;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load AI conversations';
    } finally {
      loading = false;
    }
  }

  async function switchChannel(nextChannel: ChannelFilter) {
    channel = nextChannel;
    currentPage = 1;
    await loadConversations();
  }

  async function applyQuickFilter(nextStatus: string) {
    status = nextStatus;
    currentPage = 1;
    await loadConversations();
  }

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatChannel(value: string) {
    return value === 'ADMIN' ? 'Admin AI' : 'Customer AI';
  }

  function formatStatus(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function getParticipantLabel(item: AIConversationListItem) {
    if (item.channel === 'ADMIN') {
      return item.admin?.email || item.adminId || 'Admin';
    }
    return item.customer?.email || item.guestSessionId || item.userId || 'Guest session';
  }

  function getStatusClass(value: string) {
    switch (value) {
      case 'FAILED':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'ESCALATED':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'WAITING_FOR_ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 class="text-3xl font-bold">AI Chats</h2>
      <p class="mt-1 text-sm text-gray-500">
        Separate supervision for admin AI and customer AI conversations.
      </p>
    </div>
  </div>

  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      on:click={() => switchChannel('customer')}
      class="px-4 py-2 text-sm border transition-colors"
      class:bg-black={channel === 'customer'}
      class:text-white={channel === 'customer'}
      class:border-black={channel === 'customer'}
      class:bg-white={channel !== 'customer'}
      class:text-black={channel !== 'customer'}
      class:border-gray-300={channel !== 'customer'}
    >
      Customer AI
    </button>
    <button
      type="button"
      on:click={() => switchChannel('admin')}
      class="px-4 py-2 text-sm border transition-colors"
      class:bg-black={channel === 'admin'}
      class:text-white={channel === 'admin'}
      class:border-black={channel === 'admin'}
      class:bg-white={channel !== 'admin'}
      class:text-black={channel !== 'admin'}
      class:border-gray-300={channel !== 'admin'}
    >
      Admin AI
    </button>
  </div>

  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      on:click={() => applyQuickFilter('')}
      class="px-3 py-1.5 text-sm border transition-colors"
      class:bg-black={!status}
      class:text-white={!status}
      class:border-black={!status}
      class:bg-white={!!status}
      class:text-black={!!status}
      class:border-gray-300={!!status}
    >
      All
    </button>
    <button
      type="button"
      on:click={() => applyQuickFilter('OPEN')}
      class="px-3 py-1.5 text-sm border transition-colors"
      class:bg-black={status === 'OPEN'}
      class:text-white={status === 'OPEN'}
      class:border-black={status === 'OPEN'}
      class:bg-white={status !== 'OPEN'}
      class:text-black={status !== 'OPEN'}
      class:border-gray-300={status !== 'OPEN'}
    >
      Unresolved
    </button>
    <button
      type="button"
      on:click={() => applyQuickFilter('FAILED')}
      class="px-3 py-1.5 text-sm border transition-colors"
      class:bg-black={status === 'FAILED'}
      class:text-white={status === 'FAILED'}
      class:border-black={status === 'FAILED'}
      class:bg-white={status !== 'FAILED'}
      class:text-black={status !== 'FAILED'}
      class:border-gray-300={status !== 'FAILED'}
    >
      Failed
    </button>
    <button
      type="button"
      on:click={() => applyQuickFilter('ESCALATED')}
      class="px-3 py-1.5 text-sm border transition-colors"
      class:bg-black={status === 'ESCALATED'}
      class:text-white={status === 'ESCALATED'}
      class:border-black={status === 'ESCALATED'}
      class:bg-white={status !== 'ESCALATED'}
      class:text-black={status !== 'ESCALATED'}
      class:border-gray-300={status !== 'ESCALATED'}
    >
      Escalated
    </button>
    <button
      type="button"
      on:click={() => applyQuickFilter('WAITING_FOR_ADMIN')}
      class="px-3 py-1.5 text-sm border transition-colors"
      class:bg-black={status === 'WAITING_FOR_ADMIN'}
      class:text-white={status === 'WAITING_FOR_ADMIN'}
      class:border-black={status === 'WAITING_FOR_ADMIN'}
      class:bg-white={status !== 'WAITING_FOR_ADMIN'}
      class:text-black={status !== 'WAITING_FOR_ADMIN'}
      class:border-gray-300={status !== 'WAITING_FOR_ADMIN'}
    >
      Waiting For Admin
    </button>
  </div>

  <div class="flex flex-wrap gap-4 items-end">
    <input
      type="text"
      bind:value={search}
      placeholder="Search by title, topic or intent"
      class="w-full flex-1 min-w-[260px] px-4 py-2 bg-white border border-gray-300 text-black"
      on:keydown={(event) => {
        if (event.key === 'Enter') {
          currentPage = 1;
          loadConversations();
        }
      }}
    />
    <CustomSelect
      bind:value={status}
      fitContent={true}
      options={STATUS_OPTIONS}
      on:change={() => {
        currentPage = 1;
        loadConversations();
      }}
    />
    <button
      type="button"
      on:click={() => {
        currentPage = 1;
        loadConversations();
      }}
      class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
    >
      Apply
    </button>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-black">{t('common.error')}: {error}</p>
  {:else if conversations.length === 0}
    <div class="border border-dashed border-gray-300 bg-gray-50 p-8 text-sm text-gray-500">
      No AI conversations found for this filter.
    </div>
  {:else}
    <div class="overflow-hidden border border-gray-200 bg-white">
      <table class="w-full">
        <thead class="border-b border-gray-200 bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-sm font-medium">Conversation</th>
            <th class="px-6 py-3 text-left text-sm font-medium">Participant</th>
            <th class="px-6 py-3 text-left text-sm font-medium">Topic</th>
            <th class="px-6 py-3 text-left text-sm font-medium">Status</th>
            <th class="px-6 py-3 text-left text-sm font-medium">Messages</th>
            <th class="px-6 py-3 text-left text-sm font-medium">Updated</th>
            <th class="px-6 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          {#each conversations as item}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4">
                <div class="max-w-sm">
                  <div class="font-medium text-black">{item.title || 'Untitled conversation'}</div>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{formatChannel(item.channel)}</span>
                    {#if item.language}
                      <span class="uppercase">{item.language}</span>
                    {/if}
                    {#if item.supportTicketId}
                      <span>Ticket linked</span>
                    {/if}
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-700">{getParticipantLabel(item)}</td>
              <td class="px-6 py-4 text-sm text-gray-700">
                {item.topicLabel || item.lastIntent || '—'}
              </td>
              <td class="px-6 py-4">
                <span
                  class={`inline-flex border px-2 py-1 text-xs font-medium ${getStatusClass(item.status)}`}
                >
                  {formatStatus(item.status)}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-700">
                {item._count?.messages || 0}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">{formatDate(item.lastMessageAt)}</td>
              <td class="px-6 py-4">
                <button
                  type="button"
                  on:click={() => goto(`/admin/ai-chats/${item.id}`)}
                  class="px-3 py-1 text-sm border border-gray-300 bg-white text-black hover:bg-gray-100 transition-colors"
                >
                  View
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2">
        <button
          type="button"
          on:click={() => {
            currentPage -= 1;
            loadConversations();
          }}
          disabled={currentPage === 1}
          class="px-4 py-2 border border-gray-300 bg-white disabled:opacity-50"
        >
          {t('common.previous')}
        </button>
        <span class="text-sm text-gray-500">
          {t('common.page')}
          {currentPage}
          {t('common.of')}
          {totalPages}
        </span>
        <button
          type="button"
          on:click={() => {
            currentPage += 1;
            loadConversations();
          }}
          disabled={currentPage >= totalPages}
          class="px-4 py-2 border border-gray-300 bg-white disabled:opacity-50"
        >
          {t('common.next')}
        </button>
      </div>
    {/if}
  {/if}
</div>
