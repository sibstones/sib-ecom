<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    gptAssistantApi,
    type ChatMessage,
    type AssistantResponse,
    type AssistantDisplayConfig,
  } from '$lib/api/gpt-assistant.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { authStore } from '$lib/stores/auth.store';
  import { lastAddedToCartStore } from '$lib/stores/last-added-to-cart.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { browser } from '$app/environment';
  import { t } from '$lib/utils/i18n';
  import { gptAssistantOpenStore } from '$lib/stores/gpt-assistant-open.store';
  import { i18nStore } from '$lib/stores/i18n.store';

  /** Minimal typings — Web Speech API is not in all TS lib.dom builds. */
  type WebSpeechRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((ev: WebSpeechRecognitionEvent) => void) | null;
    onerror: ((ev: Event) => void) | null;
    onend: (() => void) | null;
  };
  type WebSpeechRecognitionEvent = {
    resultIndex: number;
    results: Array<{ isFinal: boolean; 0: { transcript: string } }>;
  };

  export let userType: 'admin' | 'customer' = 'admin';
  export let sessionId: string | undefined = undefined;

  let messages: ChatMessage[] = [];
  let inputMessage = '';
  let isLoading = false;
  let isOpen = false;
  let suggestions: string[] = [];
  let quickActions: any[] = [];
  let activeRequestController: AbortController | null = null;
  let currentSessionId: string | undefined = undefined;
  let isMobile = false;
  let isAnimating = false;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let showHeaderMenu = false;
  let clearingHistory = false;
  let headerMenuElement: HTMLDivElement | null = null;

  /** Display config from API (title, FAB icon URL, quick prompts). Fallback to i18n when empty. */
  let displayConfig: AssistantDisplayConfig | null = null;

  /** Web Speech API: live transcript into input only (no auto-send). */
  let browserSpeechSupported = false;
  let speechListening = false;
  let speechUpdating = false;
  let speechPrefix = '';
  let speechFinal = '';
  let speechInterim = '';
  let speechRecognition: WebSpeechRecognition | null = null;

  function speechLangFromUiLocale(locale: string): string {
    const map: Record<string, string> = {
      en: 'en-US',
      ru: 'ru-RU',
      fr: 'fr-FR',
      de: 'de-DE',
      es: 'es-ES',
      ja: 'ja-JP',
      zh: 'zh-CN',
      ko: 'ko-KR',
      ar: 'ar-SA',
      hi: 'hi-IN',
      it: 'it-IT',
      nl: 'nl-NL',
      pl: 'pl-PL',
      pt: 'pt-BR',
    };
    return map[locale] || 'en-US';
  }

  /** Show mic when admin enabled STT; browser path only works with Web Speech API. */
  $: sttConfigured =
    displayConfig?.sttEnabled === true &&
    displayConfig?.sttProvider != null &&
    displayConfig.sttProvider !== 'none';

  $: sttMicMode = displayConfig?.sttProvider ?? 'none';

  function stopSpeechRecognition() {
    const rec = speechRecognition;
    speechRecognition = null;
    speechListening = false;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    }
    if (speechInterim) {
      speechFinal += speechInterim;
      speechInterim = '';
    }
    speechUpdating = true;
    inputMessage = speechPrefix + speechFinal;
    speechUpdating = false;
    speechPrefix = '';
    speechFinal = '';
    speechInterim = '';
  }

  function toggleBrowserDictation() {
    if (!browser || !sttConfigured || sttMicMode !== 'browser') return;
    if (!browserSpeechSupported) {
      notificationStore.error(t('gptAssistant.chat.dictationUnsupported'));
      return;
    }
    if (speechListening) {
      stopSpeechRecognition();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => WebSpeechRecognition;
      webkitSpeechRecognition?: new () => WebSpeechRecognition;
    };
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      notificationStore.error(t('gptAssistant.chat.dictationUnsupported'));
      return;
    }
    speechUpdating = true;
    let p = inputMessage;
    if (p.length > 0 && !/\s$/.test(p)) p += ' ';
    speechPrefix = p;
    speechFinal = '';
    speechInterim = '';
    inputMessage = speechPrefix;
    speechUpdating = false;

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechLangFromUiLocale($i18nStore);

    rec.onresult = (event: WebSpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const segment = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) final += segment;
        else interim += segment;
      }
      speechFinal += final;
      speechInterim = interim;
      speechUpdating = true;
      inputMessage = speechPrefix + speechFinal + speechInterim;
      speechUpdating = false;
    };

    rec.onerror = () => {
      if (speechInterim) {
        speechFinal += speechInterim;
        speechInterim = '';
        speechUpdating = true;
        inputMessage = speechPrefix + speechFinal;
        speechUpdating = false;
      }
      speechListening = false;
      speechRecognition = null;
    };

    rec.onend = () => {
      if (!speechRecognition) return;
      if (speechInterim) {
        speechFinal += speechInterim;
        speechInterim = '';
        speechUpdating = true;
        inputMessage = speechPrefix + speechFinal;
        speechUpdating = false;
      }
      speechListening = false;
      speechRecognition = null;
    };

    speechRecognition = rec;
    speechListening = true;
    try {
      rec.start();
    } catch {
      speechListening = false;
      speechRecognition = null;
      notificationStore.error(t('gptAssistant.chat.dictationUnsupported'));
    }
  }

  function onSttMicClick() {
    if (sttMicMode === 'browser') {
      toggleBrowserDictation();
      return;
    }
    if (sttMicMode === 'openai' || sttMicMode === 'custom') {
      notificationStore.error(t('gptAssistant.chat.dictationServerSoon'));
    }
  }

  // When opened from external trigger (e.g. admin menu), open the chat
  $: if ($gptAssistantOpenStore && !isOpen && !isAnimating) {
    toggleChat();
    gptAssistantOpenStore.set(false);
  }

  // Generate or get session ID for guests
  function getSessionId(): string | undefined {
    if (userType === 'admin' || $authStore.isAuthenticated) {
      return undefined; // No session ID needed for authenticated users
    }

    if (!browser) return undefined;

    // Use cart session ID if available, otherwise generate new one
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  }

  // Check if mobile device
  function checkMobile() {
    if (!browser) return;
    isMobile = window.innerWidth < 768; // md breakpoint
  }

  // Handle window resize
  function handleResize() {
    const wasMobile = isMobile;
    checkMobile();
    // If switching from mobile to desktop while chat is open, ensure body scroll is restored
    if (wasMobile && !isMobile && browser) {
      document.body.style.overflow = '';
      // Update chat sidebar class based on current state
      const mainElement = document.querySelector('main.flex-1');
      const navElement = document.querySelector('nav.sticky');
      if (mainElement) {
        if (isOpen) {
          mainElement.classList.add('chat-sidebar-open');
        } else {
          mainElement.classList.remove('chat-sidebar-open');
        }
      }
      if (navElement) {
        if (isOpen) {
          navElement.classList.add('chat-sidebar-open');
        } else {
          navElement.classList.remove('chat-sidebar-open');
        }
      }
    }
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!showHeaderMenu || !headerMenuElement) return;
    const target = event.target;
    if (target instanceof Node && !headerMenuElement.contains(target)) {
      showHeaderMenu = false;
    }
  }

  function getChatHistoryClearStorageKey(): string {
    if (userType === 'admin') {
      return `gpt-assistant-cleared-at:admin:${$authStore.user?.id || 'anonymous'}`;
    }
    return `gpt-assistant-cleared-at:customer:${currentSessionId || sessionId || $authStore.user?.id || 'guest'}`;
  }

  function getChatHistoryClearedAt(): number {
    if (!browser) return 0;
    const raw = localStorage.getItem(getChatHistoryClearStorageKey());
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function setChatHistoryClearedAt(timestamp: number) {
    if (!browser) return;
    localStorage.setItem(getChatHistoryClearStorageKey(), String(timestamp));
  }

  // Load history and display config on mount
  onMount(() => {
    currentSessionId = getSessionId();
    loadHistory();
    loadDisplayConfig();
    checkMobile();
    if (browser) {
      const w = window as unknown as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      };
      browserSpeechSupported = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    }
    window.addEventListener('resize', handleResize);
    document.addEventListener('click', handleDocumentClick);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('click', handleDocumentClick);
      // Restore body scroll on unmount
      if (browser) {
        document.body.style.overflow = '';
        // Remove chat sidebar class
        const mainElement = document.querySelector('main.flex-1');
        const navElement = document.querySelector('nav.sticky');
        if (mainElement) {
          mainElement.classList.remove('chat-sidebar-open');
        }
        if (navElement) {
          navElement.classList.remove('chat-sidebar-open');
        }
      }
    };
  });

  // Cleanup on destroy
  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleDocumentClick);
      stopSpeechRecognition();
      document.body.style.overflow = '';
      // Remove chat sidebar class
      const mainElement = document.querySelector('main.flex-1');
      const navElement = document.querySelector('nav.sticky');
      if (mainElement) {
        mainElement.classList.remove('chat-sidebar-open');
      }
      if (navElement) {
        navElement.classList.remove('chat-sidebar-open');
      }
    }
  });

  async function loadHistory() {
    try {
      const response =
        userType === 'admin'
          ? await gptAssistantApi.getHistoryAdmin(20, 0)
          : await gptAssistantApi.getHistoryCustomer(20, 0, currentSessionId || sessionId);
      const clearedAt = getChatHistoryClearedAt();

      // Convert history to chat messages
      messages = response.messages
        .slice()
        .filter((item) => new Date(item.createdAt).getTime() > clearedAt)
        .reverse()
        .flatMap((item) => [
          { role: 'user' as const, content: item.message, timestamp: new Date(item.createdAt) },
          {
            role: 'assistant' as const,
            content: item.response,
            timestamp: new Date(item.createdAt),
          },
        ]);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }

  async function loadDisplayConfig() {
    try {
      const cfg = await gptAssistantApi.getConfig();
      displayConfig = {
        ...cfg,
        sttProvider: cfg.sttProvider ?? 'none',
        sttEnabled: cfg.sttEnabled === true,
      };
    } catch (error) {
      console.error('Failed to load assistant display config:', error);
    }
  }

  /** Title shown in chat header (desktop and mobile). */
  $: assistantTitle =
    displayConfig?.displayTitle && displayConfig.displayTitle.trim()
      ? displayConfig.displayTitle.trim()
      : t('gptAssistant.title');

  /** Quick prompt items for empty state: from config or fallback to i18n keys. */
  $: quickPromptItems = (() => {
    if (userType === 'admin') {
      const fromConfig = displayConfig?.quickPromptsAdmin;
      if (fromConfig && fromConfig.length > 0)
        return fromConfig.map((p) => ({ key: '', text: p.text }));
      return adminQuickPromptKeys.map((key) => ({ key, text: t(key) }));
    } else {
      const fromConfig = displayConfig?.quickPromptsCustomer;
      if (fromConfig && fromConfig.length > 0)
        return fromConfig.map((p) => ({ key: '', text: p.text }));
      return customerQuickPromptKeys.map((key) => ({ key, text: t(key) }));
    }
  })();

  /** Quick prompt keys shown when chat is empty (business-case templates) */
  const adminQuickPromptKeys = [
    'gptAssistant.quickPrompts.admin.newOrders',
    'gptAssistant.quickPrompts.admin.problemOrders',
    'gptAssistant.quickPrompts.admin.payments',
    'gptAssistant.quickPrompts.admin.returns',
    'gptAssistant.quickPrompts.admin.productPolicy',
    'gptAssistant.quickPrompts.admin.content',
  ];
  const customerQuickPromptKeys = [
    'gptAssistant.quickPrompts.customer.sizeHelp',
    'gptAssistant.quickPrompts.customer.careHelp',
    'gptAssistant.quickPrompts.customer.outfitHelp',
  ];

  function sendQuickPrompt(keyOrText: string) {
    const text = keyOrText.startsWith('gptAssistant.') ? t(keyOrText) : keyOrText;
    if (!text.trim()) return;
    if (keyOrText.startsWith('gptAssistant.') && text === keyOrText) return;
    sendMessage(text);
  }

  async function sendMessage(overrideMessage?: string) {
    const messageToSend = (overrideMessage ?? inputMessage).trim();
    if (!messageToSend || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    // Add user message immediately and trigger reactivity
    messages = [...messages, userMessage];
    if (!overrideMessage) inputMessage = '';

    // Reset textarea height
    setTimeout(() => {
      const textarea = (document.getElementById('chat-input') ||
        document.getElementById('chat-input-mobile')) as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = '40px';
      }
    }, 10);

    isLoading = true;
    suggestions = [];
    quickActions = [];
    activeRequestController = new AbortController();

    // Auto-scroll to bottom after user message
    setTimeout(() => {
      const chatContainer =
        document.getElementById('chat-messages') || document.getElementById('chat-messages-mobile');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 50);

    try {
      const response: AssistantResponse =
        userType === 'admin'
          ? await gptAssistantApi.chatAdmin(
              {
                message: messageToSend,
                context: {
                  previousMessages: messages.slice(-10), // Last 10 messages for context
                  currentPage: window.location.pathname,
                },
              },
              { signal: activeRequestController.signal }
            )
          : await gptAssistantApi.chatCustomer(
              {
                message: messageToSend,
                context: {
                  previousMessages: messages.slice(-10),
                  currentPage: window.location.pathname,
                },
              },
              currentSessionId || sessionId,
              { signal: activeRequestController.signal }
            );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content:
          response.intent === 'UNKNOWN'
            ? t('gptAssistant.unavailable')
            : response.response || t('gptAssistant.unavailable'),
        timestamp: new Date(),
      };

      messages = [...messages, assistantMessage];
      suggestions = response.suggestions || [];
      quickActions = response.quickActions || [];

      // Auto-scroll to bottom after assistant response
      setTimeout(() => {
        const chatContainer =
          document.getElementById('chat-messages') ||
          document.getElementById('chat-messages-mobile');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }

      console.error('Chat error:', error);

      // Show fallback response instead of removing user message
      const fallbackMessage: ChatMessage = {
        role: 'assistant',
        content:
          'Sorry, the service is temporarily unavailable. Please try again later or contact support.',
        timestamp: new Date(),
      };

      messages = [...messages, fallbackMessage];

      // Show notification
      notificationStore.error(error.message || t('error.failedToSend') || 'Failed to send message');

      // Auto-scroll to bottom after fallback response
      setTimeout(() => {
        const chatContainer =
          document.getElementById('chat-messages') ||
          document.getElementById('chat-messages-mobile');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    } finally {
      activeRequestController = null;
      isLoading = false;
    }
  }

  function stopGenerating() {
    if (!isLoading || !activeRequestController) return;
    activeRequestController.abort();
  }

  function handleSendOrStop() {
    if (isLoading) {
      stopGenerating();
      return;
    }
    sendMessage();
  }

  function handleSuggestionClick(suggestion: string) {
    sendMessage(suggestion);
  }

  function handleQuickAction(action: any) {
    // Handle quick actions based on type
    if (action.type === 'add_to_cart' && action.productId) {
      // Navigate to product or add to cart
      window.location.href = `/shop/product/${action.productId}`;
    } else if (action.type === 'view_order' && action.orderId) {
      window.location.href =
        userType === 'admin'
          ? `/admin/orders/${action.orderId}`
          : `/account/orders/${action.orderId}`;
    }
  }

  function toggleChat() {
    if (isAnimating) return;

    showHeaderMenu = false;
    isAnimating = true;
    isOpen = !isOpen;

    // Prevent body scroll when mobile modal is open
    if (browser) {
      if (isOpen && isMobile) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }

      // Add/remove class to shift content on desktop
      if (!isMobile) {
        const mainElement = document.querySelector('main.flex-1');
        const navElement = document.querySelector('nav.sticky');
        if (mainElement) {
          if (isOpen) {
            mainElement.classList.add('chat-sidebar-open');
          } else {
            mainElement.classList.remove('chat-sidebar-open');
          }
        }
        if (navElement) {
          if (isOpen) {
            navElement.classList.add('chat-sidebar-open');
          } else {
            navElement.classList.remove('chat-sidebar-open');
          }
        }
      }
    }

    setTimeout(() => {
      isAnimating = false;
      if (isOpen) {
        void loadDisplayConfig();
        // Focus input when opening
        setTimeout(() => {
          const input = document.getElementById(isMobile ? 'chat-input-mobile' : 'chat-input');
          if (input) {
            input.focus();
          }
        }, 100);
      }
    }, 300);
  }

  function closeChat() {
    if (isAnimating) return;
    showHeaderMenu = false;
    toggleChat();
  }

  function toggleHeaderMenu(event?: MouseEvent) {
    event?.stopPropagation();
    showHeaderMenu = !showHeaderMenu;
  }

  async function clearChatHistory() {
    if (clearingHistory) return;

    showHeaderMenu = false;
    const confirmed = await dialogStore.confirm(
      userType === 'admin'
        ? 'Clear chat history for the current administrator?'
        : 'Clear chat history?',
      'Clear chat',
      'Clear',
      'Cancel'
    );

    if (!confirmed) return;

    clearingHistory = true;
    const clearedAt = Date.now();
    try {
      setChatHistoryClearedAt(clearedAt);
      messages = [];
      suggestions = [];
      quickActions = [];
      inputMessage = '';
      notificationStore.success('Chat cleared');

      try {
        if (userType === 'admin') {
          await gptAssistantApi.clearHistoryAdmin();
        } else {
          await gptAssistantApi.clearHistoryCustomer(currentSessionId || sessionId);
        }
      } catch (error) {
        console.warn('Server-side chat history clear is unavailable, kept local clear only.', error);
      }
    } catch (error) {
      notificationStore.error(
        error instanceof Error ? error.message : 'Failed to clear chat history'
      );
    } finally {
      clearingHistory = false;
    }
  }

  function goToCheckoutFromWidget() {
    lastAddedToCartStore.clear();
    goto('/cart');
  }

  function askAboutLastAdded() {
    const item = $lastAddedToCartStore;
    if (!item?.product?.name) return;
    inputMessage = t('gptAssistant.askAboutAddedToBag', { name: item.product.name });
    lastAddedToCartStore.clear();
    setTimeout(() => {
      const input = document.getElementById(isMobile ? 'chat-input-mobile' : 'chat-input');
      if (input) {
        input.focus();
      }
    }, 50);
  }

  /** True when swipe-to-close should run (gesture did not start on the scrollable thread). */
  function isChatMessagesTouchTarget(target: EventTarget | null): boolean {
    if (!browser || !target || !(target instanceof Node)) return false;
    const el = document.getElementById('chat-messages-mobile');
    return !!(el && el.contains(target));
  }

  // Handle swipe left to close on mobile (right-side sidebar).
  // Skip when the user scrolls the message list — bubbling touchmove here freezes WebView scrolling.
  function handleTouchStart(event: TouchEvent) {
    if (!isMobile || !isOpen) return;
    if (isChatMessagesTouchTarget(event.target)) return;
    startY = event.touches[0].clientX; // Use clientX for horizontal swipe
    isDragging = true;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isMobile || !isOpen || !isDragging) return;
    currentY = event.touches[0].clientX; // Use clientX for horizontal swipe
    const diff = startY - currentY; // Negative diff means swiping left (closing)

    if (diff < 0) {
      const modal = document.getElementById('mobile-chat-modal');
      if (modal) {
        const translateX = Math.max(-320, diff); // Max width is 320px (w-80)
        modal.style.transform = `translateX(${-translateX}px)`;
        const opacity = Math.max(0.3, 1 + diff / 300);
        const backdrop = document.getElementById('mobile-chat-backdrop');
        if (backdrop) {
          backdrop.style.opacity = opacity.toString();
        }
      }
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!isMobile || !isOpen || !isDragging) return;
    isDragging = false;

    const diff = startY - currentY; // Negative diff means swiping left
    const modal = document.getElementById('mobile-chat-modal');
    const backdrop = document.getElementById('mobile-chat-backdrop');

    if (diff < -100) {
      // Close if dragged left more than 100px
      if (modal) modal.style.transform = '';
      if (backdrop) backdrop.style.opacity = '';
      closeChat();
    } else {
      // Snap back
      if (modal) modal.style.transform = '';
      if (backdrop) backdrop.style.opacity = '';
    }

    startY = 0;
    currentY = 0;
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function autoResizeTextarea(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }

  function handleChatInput(event: Event) {
    if (!speechUpdating && speechListening) {
      stopSpeechRecognition();
    }
    autoResizeTextarea(event);
  }
</script>

<!-- Floating Chat Button (hidden on mobile admin - use menu instead) -->
{#if !isOpen && !(userType === 'admin' && isMobile)}
  <button
    on:click={toggleChat}
    class="fixed right-6 w-14 h-14 bg-black text-white rounded-full shadow-xl hover:shadow-2xl hover:bg-gray-900 transition-all duration-300 flex items-center justify-center z-50 group hover:scale-110 active:scale-95 overflow-hidden"
    style={isMobile ? 'bottom: calc(6rem + env(safe-area-inset-bottom, 0px));' : 'bottom: 1.5rem;'}
    aria-label={t('gptAssistant.openChat')}
  >
    {#if displayConfig?.fabIconUrl && displayConfig.fabIconUrl.trim()}
      <img
        src={displayConfig.fabIconUrl.trim()}
        alt=""
        class="h-6 w-6 object-contain group-hover:scale-110 transition-transform duration-300"
      />
    {:else}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 group-hover:scale-110 transition-transform duration-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
    {/if}
    <span
      class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"
    ></span>
  </button>
{/if}

<!-- Desktop Chat Sidebar (Right-side slide-out, shifts content) -->
{#if !isMobile}
  <!-- Sidebar -->
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <aside
    id="desktop-chat-modal"
    class="fixed top-0 right-0 h-full w-96 bg-white z-40 transform transition-transform duration-300 ease-in-out shadow-xl overflow-hidden border-l border-gray-200 flex flex-col {isOpen
      ? 'translate-x-0'
      : 'translate-x-full'}"
    role="dialog"
    aria-modal="true"
    aria-label="Chat"
    aria-hidden={!isOpen}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-black text-white"
    >
      <div class="flex items-center gap-3">
        <h3 class="font-semibold text-sm">{assistantTitle}</h3>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="relative" bind:this={headerMenuElement}>
          <button
            type="button"
            on:click={toggleHeaderMenu}
            class="text-gray-300 hover:text-white transition-colors px-2 py-1.5 hover:bg-white/10 rounded-lg"
            aria-label="Chat settings"
            aria-expanded={showHeaderMenu}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="4" cy="10" r="1.4" />
              <circle cx="10" cy="10" r="1.4" />
              <circle cx="16" cy="10" r="1.4" />
            </svg>
          </button>

          {#if showHeaderMenu}
            <div
              class="absolute right-0 top-full mt-2 min-w-[170px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-2xl"
            >
              <button
                type="button"
                on:click={clearChatHistory}
                disabled={messages.length === 0 || clearingHistory}
                class="flex w-full items-center justify-between px-3 py-2 text-left text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>{clearingHistory ? 'Clearing...' : 'Clear chat'}</span>
              </button>
            </div>
          {/if}
        </div>
        <button
          on:click={closeChat}
          class="text-gray-300 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
          aria-label={t('gptAssistant.closeChat')}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div
      id="chat-messages"
      class="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white"
    >
      <!-- Added to bag widget (customer only) -->
      {#if userType === 'customer' && $lastAddedToCartStore}
        <div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-4">
          <div
            class="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-green-50"
          >
            <span class="text-xs font-medium text-green-800">{t('gptAssistant.addedToBag')}</span>
            <button
              type="button"
              on:click={() => lastAddedToCartStore.clear()}
              class="p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                /></svg
              >
            </button>
          </div>
          <div class="p-3">
            <p class="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
              {$lastAddedToCartStore.product?.name ?? ''}
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                on:click={goToCheckoutFromWidget}
                class="flex-1 px-3 py-2 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                {t('gptAssistant.goToCheckout')}
              </button>
              <button
                type="button"
                on:click={askAboutLastAdded}
                class="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('gptAssistant.askAboutIt')}
              </button>
            </div>
          </div>
        </div>
      {/if}

      {#if messages.length === 0}
        <div class="flex flex-col items-center justify-center min-h-0 px-4 py-6">
          <div
            class="w-14 h-14 bg-black/5 rounded-full flex items-center justify-center mb-3 flex-shrink-0"
          >
            <svg
              class="w-7 h-7 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-700 mb-1">{t('gptAssistant.startDialog')}</p>
          <p class="text-xs text-gray-500 mb-4">{t('gptAssistant.example')}</p>
          <p
            class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 w-full text-left"
          >
            {t('gptAssistant.quickPrompts.title')}
          </p>
          <div class="flex flex-wrap gap-2 w-full justify-start">
            {#each quickPromptItems as item}
              <button
                type="button"
                on:click={() => sendQuickPrompt(item.key || item.text)}
                class="text-xs px-3 py-2 bg-white border border-gray-200 hover:border-black hover:bg-gray-50 rounded-xl transition-all duration-200 text-gray-700 hover:text-gray-900 text-left max-w-full line-clamp-2"
              >
                {item.text}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#each messages as message, index (message.timestamp.getTime() + index)}
        <div
          class="flex items-start gap-3 {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}"
        >
          <!-- Avatar -->
          <div
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center {message.role ===
            'user'
              ? 'bg-black'
              : 'bg-gray-100'}"
          >
            {#if message.role === 'user'}
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            {:else}
              <svg
                class="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            {/if}
          </div>

          <!-- Message Bubble -->
          <div
            class="flex flex-col {message.role === 'user'
              ? 'items-end'
              : 'items-start'} max-w-[75%]"
          >
            <div
              class="rounded-2xl px-4 py-2.5 shadow-sm {message.role === 'user'
                ? 'bg-black text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'}"
            >
              <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
            <span class="text-xs text-gray-400 mt-1 px-1">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="flex items-start gap-3">
          <!-- Avatar -->
          <div
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100"
          >
            <svg
              class="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <!-- Loading Bubble -->
          <div
            class="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
          >
            <div class="flex gap-1.5">
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0s"
              ></div>
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.15s"
              ></div>
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.3s"
              ></div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Suggestions -->
    {#if suggestions.length > 0 && !isLoading}
      <div class="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <p class="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Suggestions</p>
        <div class="flex flex-wrap gap-2">
          {#each suggestions as suggestion}
            <button
              on:click={() => handleSuggestionClick(suggestion)}
              class="text-xs px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 text-gray-700 hover:text-gray-900"
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    {#if quickActions.length > 0 && !isLoading}
      <div class="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <p class="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Quick Actions</p>
        <div class="flex flex-wrap gap-2">
          {#each quickActions as action}
            <button
              on:click={() => handleQuickAction(action)}
              class="text-xs px-3 py-1.5 bg-black text-white hover:bg-gray-900 rounded-full transition-all duration-200 shadow-sm hover:shadow"
            >
              {action.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Input -->
    <div class="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
      <div class="flex items-end gap-2">
        <textarea
          id="chat-input"
          bind:value={inputMessage}
          on:keypress={handleKeyPress}
          on:input={handleChatInput}
          placeholder={t('gptAssistant.enterMessage')}
          disabled={isLoading}
          rows="1"
          class="flex-1 px-3 py-2.5 border-0 border-b-2 border-gray-300 bg-transparent resize-none focus:outline-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm placeholder:text-gray-400 focus:placeholder:text-gray-300 overflow-hidden"
          style="min-height: 40px; max-height: 120px;"
        ></textarea>
        {#if sttConfigured}
          <button
            type="button"
            on:click={onSttMicClick}
            disabled={isLoading || (sttMicMode === 'browser' && !browserSpeechSupported)}
            class="flex-shrink-0 w-10 h-10 rounded-none flex items-center justify-center transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed {speechListening
              ? 'text-red-600'
              : sttMicMode === 'browser' && browserSpeechSupported
                ? 'text-gray-600 hover:text-black'
                : 'text-gray-500 hover:text-black'}"
            aria-pressed={speechListening}
            aria-label={speechListening
              ? t('gptAssistant.chat.dictationStop')
              : t('gptAssistant.chat.dictationStart')}
            title={sttMicMode === 'openai' || sttMicMode === 'custom'
              ? t('gptAssistant.chat.dictationServerSoon')
              : undefined}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-18a3 3 0 016 0v6a3 3 0 01-6 0V4z"
              />
            </svg>
          </button>
        {/if}
        <button
          on:click={handleSendOrStop}
          disabled={!isLoading && !inputMessage.trim()}
          class="flex-shrink-0 w-10 h-10 bg-transparent rounded-none transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center {!inputMessage.trim() &&
          !isLoading
            ? 'text-black'
            : 'text-gray-500'}"
          aria-label={isLoading ? 'Stop generating' : 'Send message'}
          type="button"
        >
          {#if isLoading}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            </svg>
          {:else}
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </aside>
{/if}

<!-- Mobile Chat Sidebar (Right-side slide-out) -->
{#if isMobile}
  <!-- Backdrop -->
  <div
    id="mobile-chat-backdrop"
    class="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 ease-in-out {isOpen
      ? 'opacity-100 pointer-events-auto'
      : 'opacity-0 pointer-events-none'}"
    on:click={closeChat}
    on:keydown={(e) => e.key === 'Escape' && closeChat()}
    role="button"
    tabindex="-1"
    aria-label="Close chat"
    aria-hidden={!isOpen}
  ></div>

  <!-- Sidebar -->
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <aside
    id="mobile-chat-modal"
    class="fixed top-0 right-0 h-full w-full max-w-full bg-white z-50 transform transition-transform duration-300 ease-in-out shadow-xl overflow-hidden {isOpen
      ? 'translate-x-0'
      : 'translate-x-full'}"
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
    role="dialog"
    aria-modal="true"
    aria-label="Chat"
    aria-hidden={!isOpen}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-black text-white"
    >
      <div class="flex items-center gap-3">
        <h3 class="font-semibold text-sm">{assistantTitle}</h3>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="relative" bind:this={headerMenuElement}>
          <button
            type="button"
            on:click={toggleHeaderMenu}
            class="text-gray-300 hover:text-white transition-colors px-2 py-1.5 hover:bg-white/10 rounded-lg"
            aria-label="Chat settings"
            aria-expanded={showHeaderMenu}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="4" cy="10" r="1.4" />
              <circle cx="10" cy="10" r="1.4" />
              <circle cx="16" cy="10" r="1.4" />
            </svg>
          </button>

          {#if showHeaderMenu}
            <div
              class="absolute right-0 top-full mt-2 min-w-[170px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-2xl"
            >
              <button
                type="button"
                on:click={clearChatHistory}
                disabled={messages.length === 0 || clearingHistory}
                class="flex w-full items-center justify-between px-3 py-2 text-left text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>{clearingHistory ? 'Clearing...' : 'Clear chat'}</span>
              </button>
            </div>
          {/if}
        </div>
        <button
          on:click={closeChat}
          class="text-gray-300 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
          aria-label={t('gptAssistant.closeChat')}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div
      id="chat-messages-mobile"
      class="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white"
    >
      <!-- Added to bag widget (customer only) -->
      {#if userType === 'customer' && $lastAddedToCartStore}
        <div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-4">
          <div
            class="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-green-50"
          >
            <span class="text-xs font-medium text-green-800">{t('gptAssistant.addedToBag')}</span>
            <button
              type="button"
              on:click={() => lastAddedToCartStore.clear()}
              class="p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                /></svg
              >
            </button>
          </div>
          <div class="p-3">
            <p class="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
              {$lastAddedToCartStore.product?.name ?? ''}
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                on:click={goToCheckoutFromWidget}
                class="flex-1 px-3 py-2 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                {t('gptAssistant.goToCheckout')}
              </button>
              <button
                type="button"
                on:click={askAboutLastAdded}
                class="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('gptAssistant.askAboutIt')}
              </button>
            </div>
          </div>
        </div>
      {/if}

      {#if messages.length === 0}
        <div class="flex flex-col items-center justify-center min-h-0 px-4 py-6 text-center">
          <div
            class="w-14 h-14 bg-black/5 rounded-full flex items-center justify-center mb-3 flex-shrink-0 mx-auto"
          >
            <svg
              class="w-7 h-7 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-700 mb-1">{t('gptAssistant.startDialog')}</p>
          <p class="text-xs text-gray-500 mb-4">{t('gptAssistant.example')}</p>
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            {t('gptAssistant.quickPrompts.title')}
          </p>
          <div class="flex flex-wrap gap-2 justify-center">
            {#each quickPromptItems as item}
              <button
                type="button"
                on:click={() => sendQuickPrompt(item.key || item.text)}
                class="text-xs px-3 py-2 bg-white border border-gray-200 hover:border-black hover:bg-gray-50 rounded-xl transition-all duration-200 text-gray-700 hover:text-gray-900 text-left max-w-full line-clamp-2"
              >
                {item.text}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#each messages as message, index (message.timestamp.getTime() + index)}
        <div
          class="flex items-start gap-3 {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}"
        >
          <!-- Avatar -->
          <div
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center {message.role ===
            'user'
              ? 'bg-black'
              : 'bg-gray-100'}"
          >
            {#if message.role === 'user'}
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            {:else}
              <svg
                class="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            {/if}
          </div>

          <!-- Message Bubble -->
          <div
            class="flex flex-col {message.role === 'user'
              ? 'items-end'
              : 'items-start'} max-w-[75%]"
          >
            <div
              class="rounded-2xl px-4 py-2.5 shadow-sm {message.role === 'user'
                ? 'bg-black text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'}"
            >
              <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
            <span class="text-xs text-gray-400 mt-1 px-1">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="flex items-start gap-3">
          <!-- Avatar -->
          <div
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100"
          >
            <svg
              class="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <!-- Loading Bubble -->
          <div
            class="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
          >
            <div class="flex gap-1.5">
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0s"
              ></div>
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.15s"
              ></div>
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.3s"
              ></div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Suggestions -->
    {#if suggestions.length > 0 && !isLoading}
      <div class="px-4 py-3 border-t border-gray-100 bg-white">
        <p class="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Suggestions</p>
        <div class="flex flex-wrap gap-2">
          {#each suggestions as suggestion}
            <button
              on:click={() => handleSuggestionClick(suggestion)}
              class="text-xs px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 text-gray-700 hover:text-gray-900"
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    {#if quickActions.length > 0 && !isLoading}
      <div class="px-4 py-3 border-t border-gray-100 bg-white">
        <p class="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Quick Actions</p>
        <div class="flex flex-wrap gap-2">
          {#each quickActions as action}
            <button
              on:click={() => handleQuickAction(action)}
              class="text-xs px-3 py-1.5 bg-black text-white hover:bg-gray-900 rounded-full transition-all duration-200 shadow-sm hover:shadow"
            >
              {action.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Input -->
    <div class="px-4 py-3 border-t border-gray-200 bg-white safe-area-inset-bottom">
      <div class="flex items-end gap-2">
        <textarea
          id="chat-input-mobile"
          bind:value={inputMessage}
          on:keypress={handleKeyPress}
          on:input={handleChatInput}
          placeholder={t('gptAssistant.enterMessage')}
          disabled={isLoading}
          rows="1"
          class="flex-1 px-3 py-2.5 border-0 border-b-2 border-gray-300 bg-transparent resize-none focus:outline-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm placeholder:text-gray-400 focus:placeholder:text-gray-300 overflow-hidden"
          style="min-height: 40px; max-height: 120px;"
        ></textarea>
        {#if sttConfigured}
          <button
            type="button"
            on:click={onSttMicClick}
            disabled={isLoading || (sttMicMode === 'browser' && !browserSpeechSupported)}
            class="flex-shrink-0 w-10 h-10 rounded-none flex items-center justify-center transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed {speechListening
              ? 'text-red-600'
              : sttMicMode === 'browser' && browserSpeechSupported
                ? 'text-gray-600 hover:text-black'
                : 'text-gray-500 hover:text-black'}"
            aria-pressed={speechListening}
            aria-label={speechListening
              ? t('gptAssistant.chat.dictationStop')
              : t('gptAssistant.chat.dictationStart')}
            title={sttMicMode === 'openai' || sttMicMode === 'custom'
              ? t('gptAssistant.chat.dictationServerSoon')
              : undefined}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-18a3 3 0 016 0v6a3 3 0 01-6 0V4z"
              />
            </svg>
          </button>
        {/if}
        <button
          on:click={handleSendOrStop}
          disabled={!isLoading && !inputMessage.trim()}
          class="flex-shrink-0 w-10 h-10 bg-transparent rounded-none transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center {!inputMessage.trim() &&
          !isLoading
            ? 'text-black'
            : 'text-gray-500'}"
          aria-label={isLoading ? 'Stop generating' : 'Send message'}
          type="button"
        >
          {#if isLoading}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            </svg>
          {:else}
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </aside>
{/if}

<style>
  #chat-messages,
  #chat-messages-mobile {
    scrollbar-width: thin;
    scrollbar-color: #d1d5db #f9fafb;
  }

  #chat-messages::-webkit-scrollbar,
  #chat-messages-mobile::-webkit-scrollbar {
    width: 6px;
  }

  #chat-messages::-webkit-scrollbar-track,
  #chat-messages-mobile::-webkit-scrollbar-track {
    background: transparent;
  }

  #chat-messages::-webkit-scrollbar-thumb,
  #chat-messages-mobile::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 10px;
  }

  #chat-messages::-webkit-scrollbar-thumb:hover,
  #chat-messages-mobile::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  /* `smooth` + WebView + many nodes causes jank; programmatic scrollTop stays instant */
  #chat-messages,
  #chat-messages-mobile {
    scroll-behavior: auto;
    min-height: 0; /* Required for flex-1 overflow to work correctly */
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior-y: contain;
  }

  /* Mobile sidebar animations - iOS style */
  #mobile-chat-modal {
    will-change: transform;
  }

  /* Smooth backdrop fade */
  #mobile-chat-backdrop {
    will-change: opacity;
  }

  /* Desktop sidebar animations */
  #desktop-chat-modal {
    will-change: transform;
  }

  /* Shift main content when chat is open on desktop */
  :global(main.flex-1.chat-sidebar-open) {
    margin-right: 384px; /* w-96 = 384px */
    transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Shift navigation when chat is open on desktop */
  :global(nav.sticky.chat-sidebar-open) {
    margin-right: 384px; /* w-96 = 384px */
    transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Ensure smooth transition */
  :global(main.flex-1),
  :global(nav.sticky) {
    transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Safe area for mobile devices (notch support) */
  .safe-area-inset-bottom {
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  /* Ensure input area stays above keyboard on mobile */
  @media (max-width: 768px) {
    #mobile-chat-modal {
      display: flex;
      flex-direction: column;
    }

    #chat-messages-mobile {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
  }
</style>
