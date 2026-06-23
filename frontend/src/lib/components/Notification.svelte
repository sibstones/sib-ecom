<script lang="ts">
  import { notificationStore, type Notification } from '$lib/stores/notification.store';
  import { onMount } from 'svelte';

  let notifications: Notification[] = [];
  let mounted = false;

  $: {
    notificationStore.subscribe((state) => {
      notifications = state.notifications;
    });
  }

  onMount(() => {
    mounted = true;
  });

  function getIcon(type: Notification['type']) {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  }

  function getStyles(type: Notification['type']) {
    switch (type) {
      case 'success':
        return 'bg-white border-l-4 border-green-500 text-gray-900 shadow-md';
      case 'error':
        return 'bg-white border-l-4 border-red-500 text-gray-900 shadow-md';
      case 'warning':
        return 'bg-white border-l-4 border-yellow-500 text-gray-900 shadow-md';
      case 'info':
        return 'bg-white border-l-4 border-blue-500 text-gray-900 shadow-md';
      default:
        return 'bg-white border-l-4 border-gray-500 text-gray-900 shadow-md';
    }
  }

  function getIconStyles(type: Notification['type']) {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-600';
      case 'error':
        return 'bg-red-100 text-red-600';
      case 'warning':
        return 'bg-yellow-100 text-yellow-600';
      case 'info':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }
</script>

{#if mounted}
  <div
    class="fixed top-4 right-4 z-[10000] flex flex-col gap-2 max-w-md w-full pointer-events-none"
    role="region"
    aria-live="polite"
    aria-label="Notifications"
  >
    {#each notifications as notification (notification.id)}
      <div
        class="pointer-events-auto {getStyles(
          notification.type
        )} -r-lg p-4 flex items-start gap-3 animate-slide-in"
        role="alert"
      >
        <div
          class="flex-shrink-0 w-8 h-8 -full flex items-center justify-center font-semibold text-sm {getIconStyles(
            notification.type
          )}"
        >
          {getIcon(notification.type)}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">{notification.message}</p>
        </div>
        <button
          on:click={() => notificationStore.remove(notification.id)}
          class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close notification"
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
    {/each}
  </div>
{/if}

<style>
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
</style>
