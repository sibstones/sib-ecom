<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { gptVisibilityStore } from '$lib/stores/gpt-visibility.store';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { t } from '$lib/utils/i18n';
  import GPTAssistantChat from '$lib/components/GPTAssistantChat.svelte';
  import { customerApi, type NotificationCounts } from '$lib/api/customer.api';

  let isAuthenticated = $authStore.isAuthenticated;
  $: isAuthenticated = $authStore.isAuthenticated;

  let user = $authStore.user;
  $: user = $authStore.user;
  let notificationCounts: NotificationCounts = { ordersInProgress: 0, unreadTickets: 0 };

  onMount(() => {
    if (!isAuthenticated) {
      goto('/login');
      return;
    }
    loadNotificationCounts();
    const interval = setInterval(loadNotificationCounts, 30000);
    return () => clearInterval(interval);
  });

  async function loadNotificationCounts() {
    try {
      notificationCounts = await customerApi.getNotificationCounts();
    } catch {
      // ignore
    }
  }

  $: currentPath = $page.url.pathname;
  $: isWishlistPage = currentPath === '/account/wishlist';

  function isActive(href: string) {
    if (href === '/account/profile') return currentPath === '/account/profile';
    if (href === '/account/orders')
      return currentPath === '/account/orders' || currentPath.startsWith('/account/orders/');
    if (href === '/account/wishlist') return currentPath === '/account/wishlist';
    if (href === '/account/codes') return currentPath === '/account/codes';
    if (href === '/account/partner')
      return currentPath === '/account/partner' || currentPath.startsWith('/account/partner/');
    return false;
  }
</script>

<div class="min-h-screen {isWishlistPage ? 'bg-white text-dark' : 'bg-white'} pb-20 md:pb-0">
  <div class="container-custom py-12">
    <h1 class="hidden md:block text-5xl font-bold mb-8 {isWishlistPage ? 'text-dark' : ''}">
      {t('account.myAccount')}
    </h1>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
      <!-- Sidebar (desktop only) -->
      <nav class="hidden md:block md:col-span-1">
        <!-- Navigation menu -->
        <ul class="space-y-2">
          <li>
            <a
              href="/account/profile"
              class="block px-4 py-2 {currentPath === '/account/profile'
                ? 'bg-dark-light'
                : 'hover:bg-dark-light'} transition-colors flex items-center justify-between"
            >
              <span>{t('account.profile')}</span>
              {#if notificationCounts.unreadTickets > 0}
                <span
                  class="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold rounded bg-accent text-dark"
                >
                  {notificationCounts.unreadTickets > 99 ? '99+' : notificationCounts.unreadTickets}
                </span>
              {/if}
            </a>
          </li>
          <li>
            <a
              href="/account/orders"
              class="block px-4 py-2 {currentPath === '/account/orders' ||
              currentPath.startsWith('/account/orders/')
                ? 'bg-dark-light'
                : 'hover:bg-dark-light'} transition-colors flex items-center justify-between"
            >
              <span>{t('account.orders')}</span>
              {#if notificationCounts.ordersInProgress > 0}
                <span
                  class="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold rounded bg-accent text-dark"
                >
                  {notificationCounts.ordersInProgress > 99
                    ? '99+'
                    : notificationCounts.ordersInProgress}
                </span>
              {/if}
            </a>
          </li>
          {#if $settingsStore.wishlistEnabled}
            <li>
              <a
                href="/account/wishlist"
                class="block px-4 py-2 {currentPath === '/account/wishlist'
                  ? 'bg-dark-light'
                  : 'hover:bg-dark-light'} transition-colors"
              >
                {t('account.wishlist')}
              </a>
            </li>
          {/if}
          <li>
            <a
              href="/account/codes"
              class="block px-4 py-2 {currentPath === '/account/codes'
                ? 'bg-dark-light'
                : 'hover:bg-dark-light'} transition-colors"
            >
              {t('account.codes')}
            </a>
          </li>
          {#if $authStore.user?.isPartner}
            <li>
              <a
                href="/account/partner"
                class="block px-4 py-2 {currentPath === '/account/partner' ||
                currentPath.startsWith('/account/partner/')
                  ? 'bg-dark-light'
                  : 'hover:bg-dark-light'} transition-colors"
              >
                {t('account.partner') || 'Partner'}
              </a>
            </li>
          {/if}
        </ul>
      </nav>

      <!-- Content -->
      <div class="md:col-span-3 min-w-0">
        <slot />
      </div>
    </div>
  </div>

  <!-- Mobile bottom tab bar (Apple-style) -->
  <nav
    class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-black/5 pb-[env(safe-area-inset-bottom)]"
  >
    <div class="flex items-center justify-around h-16">
      <a
        href="/account/profile"
        class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {isActive(
          '/account/profile'
        )
          ? 'text-accent'
          : 'text-accent-muted'}"
        aria-label={t('account.profile')}
      >
        <span class="relative flex-shrink-0">
          <svg
            class="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {#if notificationCounts.unreadTickets > 0}
            <span
              class="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[10px] font-bold rounded-full bg-accent text-white"
            >
              {notificationCounts.unreadTickets > 99 ? '99+' : notificationCounts.unreadTickets}
            </span>
          {/if}
        </span>
        <span class="text-[10px] mt-0.5 truncate max-w-full">{t('account.profile')}</span>
      </a>
      <a
        href="/account/orders"
        class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {isActive(
          '/account/orders'
        )
          ? 'text-accent'
          : 'text-accent-muted'}"
        aria-label={t('account.orders')}
      >
        <span class="relative flex-shrink-0">
          <svg
            class="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            />
            <path d="M3.27 6.96L12 12.01l8.73-5.05" />
            <path d="M12 22.08V12" />
          </svg>
          {#if notificationCounts.ordersInProgress > 0}
            <span
              class="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[10px] font-bold rounded-full bg-accent text-white"
            >
              {notificationCounts.ordersInProgress > 99
                ? '99+'
                : notificationCounts.ordersInProgress}
            </span>
          {/if}
        </span>
        <span class="text-[10px] mt-0.5 truncate max-w-full">{t('account.orders')}</span>
      </a>
      {#if $settingsStore.wishlistEnabled}
        <a
          href="/account/wishlist"
          class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {isActive(
            '/account/wishlist'
          )
            ? 'text-accent'
            : 'text-accent-muted'}"
          aria-label={t('account.wishlist')}
        >
          <span class="flex-shrink-0">
            <svg
              class="w-6 h-6 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
              />
            </svg>
          </span>
          <span class="text-[10px] mt-0.5 truncate max-w-full">{t('account.wishlist')}</span>
        </a>
      {/if}
      <a
        href="/account/codes"
        class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {isActive(
          '/account/codes'
        )
          ? 'text-accent'
          : 'text-accent-muted'}"
        aria-label={t('account.codes')}
      >
        <span class="flex-shrink-0">
          <svg
            class="w-6 h-6 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          </svg>
        </span>
        <span class="text-[10px] mt-0.5 truncate max-w-full">{t('account.codes')}</span>
      </a>
      {#if $authStore.user?.isPartner}
        <a
          href="/account/partner"
          class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {isActive(
            '/account/partner'
          )
            ? 'text-accent'
            : 'text-accent-muted'}"
          aria-label={t('account.partner')}
        >
          <span class="flex-shrink-0">
            <svg
              class="w-6 h-6 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
            </svg>
          </span>
          <span class="text-[10px] mt-0.5 truncate max-w-full"
            >{t('account.partner') || 'Partner'}</span
          >
        </a>
      {/if}
    </div>
  </nav>

  <!-- GPT Assistant Chat (respects visibility setting: enabledCustomer) -->
  {#if $authStore.isAuthenticated && $gptVisibilityStore?.enabledCustomer}
    <GPTAssistantChat userType="customer" />
  {/if}
</div>
