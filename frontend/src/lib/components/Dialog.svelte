<script lang="ts">
  import { dialogStore, type DialogOptions } from '$lib/stores/dialog.store';
  import { get } from 'svelte/store';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { t } from '$lib/utils/i18n';
  import { i18nStore } from '$lib/stores/i18n.store';

  // Reactive subscription to language store for translations
  $: currentLanguage = $i18nStore;

  interface DialogState {
    isOpen: boolean;
    options: DialogOptions | null;
    resolve: ((value: boolean) => void) | null;
  }

  let mounted = false;
  let dialogState: DialogState = { isOpen: false, options: null, resolve: null };
  let confirmButton: HTMLButtonElement;
  let scrollbarWidth = 0;

  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    mounted = true;
    unsubscribe = dialogStore.subscribe((state) => {
      const wasOpen = dialogState.isOpen;
      dialogState = state;

      // Handle scroll lock/unlock
      if (browser) {
        if (state.isOpen && !wasOpen) {
          // Dialog opened - lock scroll
          scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
          document.body.style.overflow = 'hidden';
          if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
          }
        } else if (!state.isOpen && wasOpen) {
          // Dialog closed - unlock scroll
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
        }
      }

      // Focus confirm button when dialog opens
      if (state.isOpen && confirmButton) {
        setTimeout(() => confirmButton.focus(), 0);
      }
    });
  });

  onDestroy(() => {
    // Ensure scroll is restored when component is destroyed
    if (browser && dialogState.isOpen) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    if (unsubscribe) {
      unsubscribe();
    }
  });

  function handleConfirm(event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Get current state directly from store to ensure we have the latest resolve function
    const currentState = get(dialogStore);
    if (currentState.resolve) {
      dialogStore.close(true);
    }
  }

  function handleCancel(event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Get current state directly from store to ensure we have the latest resolve function
    const currentState = get(dialogStore);
    if (currentState.resolve) {
      dialogStore.close(false);
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      // Don't close on backdrop click for confirm dialogs
      if (dialogState.options?.type === 'alert') {
        handleConfirm();
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!dialogState.isOpen) return;

    if (event.key === 'Escape') {
      if (dialogState.options?.type === 'alert') {
        handleConfirm();
      } else {
        handleCancel();
      }
    } else if (event.key === 'Enter' && dialogState.options?.type === 'alert') {
      handleConfirm();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if mounted && dialogState.isOpen && dialogState.options}
  <div
    class="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in"
    role="dialog"
    aria-modal="true"
    aria-labelledby={dialogState.options?.title ? 'dialog-title' : undefined}
    aria-describedby="dialog-message"
  >
    <button
      type="button"
      class="absolute inset-0 h-full w-full cursor-default bg-transparent"
      aria-hidden="true"
      tabindex="-1"
      on:click={handleBackdropClick}
    ></button>
    <div
      class="relative z-10 bg-white border-2 border-black shadow-lg max-w-md w-full mx-4 transform transition-all animate-scale-in"
      role="document"
    >
      <div class="p-6">
        {#if dialogState.options.title}
          <h2 id="dialog-title" class="text-xl font-bold text-black mb-4">
            {dialogState.options.title}
          </h2>
        {/if}

        <p id="dialog-message" class="text-base text-black mb-6 whitespace-pre-line">
          {dialogState.options.message}
        </p>

        <div class="flex gap-3 justify-end">
          {#if dialogState.options.type === 'confirm'}
            <button
              type="button"
              on:click={(e) => handleCancel(e)}
              class="px-6 py-2 border-2 border-black bg-white text-black font-medium hover:bg-black hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              {dialogState.options.cancelText || t('common.cancel')}
            </button>
          {/if}
          <button
            type="button"
            on:click={(e) => handleConfirm(e)}
            class="px-6 py-2 border-2 border-black bg-black text-white font-medium hover:bg-white hover:text-black transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            bind:this={confirmButton}
          >
            {dialogState.options?.confirmText ??
              (dialogState.options?.type === 'confirm' ? t('common.confirm') : t('common.ok'))}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Removed CSS :has() selector - using JavaScript to control overflow instead */

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }

  .animate-scale-in {
    animation: scale-in 0.2s ease-out;
  }
</style>
