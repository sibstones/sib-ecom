<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gptAssistantApi, type AIConversationDetail } from '$lib/api/gpt-assistant.api';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { t } from '$lib/utils/i18n';

  let conversation: AIConversationDetail | null = null;
  let loading = true;
  let error = '';
  let draftReply = '';
  let ticketSubject = '';
  let supportActionLoading = false;
  let draftLoading = false;
  const ticketSubjectInputId = 'ai-chat-ticket-subject';
  const draftReplyInputId = 'ai-chat-draft-reply';

  $: conversationId = $page.params?.id;

  onMount(async () => {
    await loadConversation();
  });

  async function loadConversation() {
    if (!conversationId) {
      error = 'Conversation id is required';
      loading = false;
      return;
    }

    loading = true;
    error = '';

    try {
      conversation = await gptAssistantApi.getAdminConversationById(conversationId);
      if (!ticketSubject && conversation) {
        ticketSubject = conversation.title || 'AI conversation follow-up';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load conversation';
    } finally {
      loading = false;
    }
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

  function formatStatus(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function participantLabel() {
    if (!conversation) return '—';
    if (conversation.channel === 'ADMIN') {
      return conversation.admin?.email || conversation.adminId || 'Admin';
    }
    return (
      conversation.customer?.email ||
      conversation.userId ||
      conversation.guestSessionId ||
      'Guest session'
    );
  }

  function prettyJson(value: unknown) {
    if (value == null) return '—';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function messageClass(role: string, isError: boolean) {
    if (isError) return 'bg-red-50 border-red-200';
    if (role === 'ASSISTANT') return 'bg-gray-50 border-gray-200';
    return 'bg-white border-gray-200';
  }

  async function handleDraftReply() {
    if (!conversationId) return;
    draftLoading = true;
    try {
      const response = await gptAssistantApi.draftReplyForConversation(conversationId);
      draftReply = response.draft;
      if (!ticketSubject && conversation?.title) {
        ticketSubject = conversation.title;
      }
      notificationStore.success('Draft reply prepared');
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to draft reply');
    } finally {
      draftLoading = false;
    }
  }

  async function handleCreateTicket() {
    if (!conversationId) return;

    supportActionLoading = true;
    try {
      const response = await gptAssistantApi.createTicketFromConversation(conversationId, {
        subject: ticketSubject || undefined,
        message: draftReply || undefined,
      });
      notificationStore.success('Support ticket created from AI conversation');
      await loadConversation();
      goto(`/admin/tickets/${response.ticket.id}`);
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to create support ticket');
    } finally {
      supportActionLoading = false;
    }
  }

  async function handleEscalate() {
    if (!conversationId) return;

    supportActionLoading = true;
    try {
      await gptAssistantApi.escalateConversation(conversationId);
      notificationStore.success('Conversation escalated');
      await loadConversation();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to escalate conversation');
    } finally {
      supportActionLoading = false;
    }
  }

  async function handleResolve() {
    if (!conversationId) return;

    supportActionLoading = true;
    try {
      await gptAssistantApi.resolveConversation(conversationId);
      notificationStore.success('Conversation marked as resolved');
      await loadConversation();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to resolve conversation');
    } finally {
      supportActionLoading = false;
    }
  }

  async function handleSendReply() {
    if (!conversationId) return;

    if (!conversation?.supportTicketId) {
      notificationStore.error('Create or link a support ticket before sending a reply');
      return;
    }

    supportActionLoading = true;
    try {
      await gptAssistantApi.sendReplyForConversation(conversationId, {
        message: draftReply || undefined,
      });
      notificationStore.success('Reply sent to linked support ticket');
      await loadConversation();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      supportActionLoading = false;
    }
  }
</script>

<div class="space-y-6">
  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-black">{t('common.error')}: {error}</p>
  {:else if !conversation}
    <p class="text-gray-500">Conversation not found.</p>
  {:else}
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 class="text-3xl font-bold">{conversation.title || 'AI Conversation'}</h2>
        <p class="mt-1 text-sm text-gray-500">
          {conversation.channel === 'ADMIN' ? 'Admin AI' : 'Customer AI'} · {participantLabel()}
        </p>
      </div>
      <div class="flex gap-2">
        {#if conversation.supportTicketId}
          <button
            type="button"
            on:click={() => goto(`/admin/tickets/${conversation?.supportTicketId}`)}
            class="px-4 py-2 border border-gray-300 bg-white text-black hover:bg-gray-100 transition-colors"
          >
            Open Ticket
          </button>
        {/if}
        <button
          type="button"
          on:click={() => goto('/admin/ai-chats')}
          class="px-4 py-2 border border-gray-300 bg-white text-black hover:bg-gray-100 transition-colors"
        >
          Back
        </button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-4">
      <div class="border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Status</p>
        <p class="mt-2 text-lg font-semibold">{formatStatus(conversation.status)}</p>
      </div>
      <div class="border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Topic</p>
        <p class="mt-2 text-lg font-semibold">
          {conversation.topicLabel || conversation.lastIntent || '—'}
        </p>
      </div>
      <div class="border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Language</p>
        <p class="mt-2 text-lg font-semibold uppercase">{conversation.language || '—'}</p>
      </div>
      <div class="border border-gray-200 bg-white p-4">
        <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Updated</p>
        <p class="mt-2 text-lg font-semibold">{formatDate(conversation.lastMessageAt)}</p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">Transcript</h3>
          <span class="text-sm text-gray-500">{conversation.messages.length} messages</span>
        </div>

        <div class="space-y-3">
          {#each conversation.messages as message}
            <div class={`border p-4 ${messageClass(message.role, message.isError)}`}>
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{message.role}</span>
                  {#if message.intent}
                    <span class="text-xs text-gray-500">{message.intent}</span>
                  {/if}
                  {#if message.isError}
                    <span class="text-xs font-medium text-red-600">Error</span>
                  {/if}
                </div>
                <span class="text-xs text-gray-500">{formatDate(message.createdAt)}</span>
              </div>
              <p class="whitespace-pre-wrap text-sm text-gray-800">{message.content}</p>
            </div>
          {/each}
        </div>
      </section>

      <aside class="space-y-4">
        <div class="border border-gray-200 bg-white p-4">
          <h3 class="text-lg font-semibold">Support Actions</h3>
          <div class="mt-4 space-y-4">
            {#if !conversation.userId && !conversation.supportTicketId}
              <div class="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This is a guest conversation without a linked customer account. You can escalate it,
                review it, or wait until the guest is identified, but automatic ticket creation is
                disabled for this thread right now.
              </div>
            {/if}

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                on:click={handleDraftReply}
                disabled={draftLoading || supportActionLoading}
                class="px-4 py-2 border border-gray-300 bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {draftLoading ? 'Preparing...' : 'Draft Reply'}
              </button>
              <button
                type="button"
                on:click={handleEscalate}
                disabled={supportActionLoading}
                class="px-4 py-2 border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                Escalate
              </button>
              <button
                type="button"
                on:click={handleResolve}
                disabled={supportActionLoading}
                class="px-4 py-2 border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                Mark Resolved
              </button>
              <button
                type="button"
                on:click={handleSendReply}
                disabled={supportActionLoading || !conversation.supportTicketId}
                class="px-4 py-2 border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                Send Reply
              </button>
            </div>

            {#if !conversation.supportTicketId && conversation.userId}
              <div class="space-y-3">
                <div>
                  <label
                    for={ticketSubjectInputId}
                    class="mb-1 block text-sm font-medium text-gray-700">Ticket Subject</label
                  >
                  <input
                    id={ticketSubjectInputId}
                    type="text"
                    bind:value={ticketSubject}
                    class="w-full border border-gray-300 px-3 py-2 text-sm text-black"
                    placeholder="AI conversation follow-up"
                  />
                </div>
                <div>
                  <label
                    for={draftReplyInputId}
                    class="mb-1 block text-sm font-medium text-gray-700"
                    >Reply Draft / First Message</label
                  >
                  <textarea
                    id={draftReplyInputId}
                    bind:value={draftReply}
                    rows="8"
                    class="w-full border border-gray-300 px-3 py-2 text-sm text-black"
                    placeholder="Draft a reply first, or write the first support message here."
                  ></textarea>
                </div>
                <button
                  type="button"
                  on:click={handleCreateTicket}
                  disabled={supportActionLoading || !ticketSubject.trim()}
                  class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {supportActionLoading ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            {:else if conversation.supportTicketId}
              <p class="text-sm text-gray-500">
                This conversation is already linked to support ticket `{conversation.supportTicketId}`.
              </p>
            {/if}
          </div>
        </div>

        <div class="border border-gray-200 bg-white p-4">
          <h3 class="text-lg font-semibold">Execution Timeline</h3>
          {#if conversation.executions.length === 0}
            <p class="mt-3 text-sm text-gray-500">
              No action executions were recorded for this thread yet.
            </p>
          {:else}
            <div class="mt-4 space-y-3">
              {#each conversation.executions as execution}
                <div class="border border-gray-200 bg-gray-50 p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-medium text-black">{execution.actionId}</p>
                      <p class="text-xs text-gray-500">{formatStatus(execution.status)}</p>
                    </div>
                    <span class="text-xs text-gray-500">{formatDate(execution.createdAt)}</span>
                  </div>

                  <div class="mt-3 space-y-3">
                    <div>
                      <p
                        class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500"
                      >
                        Arguments
                      </p>
                      <pre
                        class="overflow-x-auto whitespace-pre-wrap text-xs text-gray-700">{prettyJson(
                          execution.arguments
                        )}</pre>
                    </div>

                    {#if execution.resultData}
                      <div>
                        <p
                          class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500"
                        >
                          Result
                        </p>
                        <pre
                          class="overflow-x-auto whitespace-pre-wrap text-xs text-gray-700">{prettyJson(
                            execution.resultData
                          )}</pre>
                      </div>
                    {/if}

                    {#if execution.errorMessage}
                      <div>
                        <p
                          class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-600"
                        >
                          Error
                        </p>
                        <pre
                          class="overflow-x-auto whitespace-pre-wrap text-xs text-red-700">{prettyJson(
                            execution.errorMessage
                          )}</pre>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="border border-gray-200 bg-white p-4">
          <h3 class="text-lg font-semibold">Metadata</h3>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-start justify-between gap-4">
              <dt class="text-gray-500">Conversation ID</dt>
              <dd class="font-mono text-right text-xs text-gray-700">{conversation.id}</dd>
            </div>
            <div class="flex items-start justify-between gap-4">
              <dt class="text-gray-500">Participant</dt>
              <dd class="text-right text-gray-700">{participantLabel()}</dd>
            </div>
            <div class="flex items-start justify-between gap-4">
              <dt class="text-gray-500">Support Ticket</dt>
              <dd class="text-right text-gray-700">{conversation.supportTicketId || '—'}</dd>
            </div>
            <div class="flex items-start justify-between gap-4">
              <dt class="text-gray-500">Created</dt>
              <dd class="text-right text-gray-700">{formatDate(conversation.createdAt)}</dd>
            </div>
            <div class="flex items-start justify-between gap-4">
              <dt class="text-gray-500">Resolved</dt>
              <dd class="text-right text-gray-700">
                {conversation.resolvedAt ? formatDate(conversation.resolvedAt) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  {/if}
</div>
