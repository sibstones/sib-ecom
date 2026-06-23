<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { onboardingStore } from '$lib/stores/onboarding.store';
  import { goto, afterNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { apiClient } from '$lib/api/client';
  import { adminApi } from '$lib/api/admin.api';
  import { ticketApi } from '$lib/api/ticket.api';
  import { paymentRequestApi } from '$lib/api/payment-request.api';
  import { t } from '$lib/utils/i18n';
  import { i18nBundleVersion, i18nStore } from '$lib/stores/i18n.store';
  import type { AdminPermissions } from '$lib/stores/auth.store';
  import { AuthenticationError } from '$lib/errors/AuthenticationError';
  import { dialogStore } from '$lib/stores/dialog.store';
  import GPTAssistantChat from '$lib/components/GPTAssistantChat.svelte';
  import { gptVisibilityStore } from '$lib/stores/gpt-visibility.store';
  import { gptAssistantOpenStore } from '$lib/stores/gpt-assistant-open.store';

  $: user = $authStore.user;
  $: isAuthenticated = $authStore.isAuthenticated;
  $: sessionResolved = $authStore.sessionResolved;
  $: onboardingState = $onboardingStore;
  $: _locale = `${$i18nStore}:${$i18nBundleVersion}`;

  let sessionExpiredDialogShown = false;

  // Map menu paths to required permissions
  const pathPermissions: Record<string, keyof AdminPermissions> = {
    '/admin/dashboard': 'canViewReports', // Dashboard is accessible to all admins
    '/admin/onboarding': 'canViewReports', // Onboarding for first-time setup
    '/admin/profile': 'canViewReports', // Profile is accessible to all admins
    '/admin/products': 'canManageProducts',
    '/admin/categories': 'canManageCategories',
    '/admin/brands': 'canManageBrands',
    '/admin/lookbook': 'canManageContent',
    '/admin/warehouses': 'canManageInventory',
    '/admin/sales-points': 'canManageInventory',
    '/admin/orders': 'canManageOrders',
    '/admin/payment-requests': 'canManagePayments',
    '/admin/returns': 'canManageOrders',
    '/admin/promo': 'canManagePromoCodes',
    '/admin/customers': 'canManageCustomers',
    '/admin/tickets': 'canManageSupport',
    '/admin/ai-chats': 'canManageSupport',
    '/admin/homepage': 'canManageContent',
    '/admin/pages': 'canManageContent',
    '/admin/blog': 'canManageContent',
    '/admin/product-page-design': 'canManageContent',
    '/admin/shop-page-design': 'canManageContent',
    '/admin/header': 'canManageContent',
    '/admin/footer': 'canManageContent',
    '/admin/reports': 'canViewReports',
    '/admin/accounting': 'canViewReports',
    '/admin/marketing': 'canManageSettings',
    '/admin/partners': 'canManageSettings',
    '/admin/settings': 'canManageSettings',
    '/admin/settings/delivery-tracking': 'canManageSettings',
    '/admin/settings/api-keys': 'canManageSettings',
    '/admin/settings/admins': 'canManageSettings',
    '/admin/settings/activity-logs': 'canManageSettings',
    '/admin/countries': 'canManageSettings',
    '/admin/languages': 'canManageSettings',
    '/admin/payment-gateways': 'canManagePayments',
    '/admin/currency-rates': 'canManageSettings',
    '/admin/backups': 'canManageSettings',
    '/admin/settings/gpt-assistant': 'canManageSettings',
    '/admin/settings/gpt-assistant/prompts': 'canManageSettings',
    '/admin/settings/gpt-assistant/analytics': 'canManageSettings',
    '/admin/settings/gpt-assistant/logs': 'canManageSettings',
    '/admin/settings/gpt-assistant/test': 'canManageSettings',
  };

  /** Resolve required permission for path (exact or longest parent match). */
  function getRequiredPermission(path: string): keyof AdminPermissions | undefined {
    let p = path.replace(/\/$/, '') || '/';
    while (p) {
      const perm = pathPermissions[p];
      if (perm) return perm;
      const lastSlash = p.lastIndexOf('/');
      if (lastSlash <= 0) break;
      p = p.slice(0, lastSlash);
    }
    return undefined;
  }

  // Check if user has permission to access a path
  function hasPermission(path: string): boolean {
    // Until checkAuth completes, user is null — keep UI visible (same as filterMenuItems)
    if (!sessionResolved) {
      return true;
    }

    // SUPER_ADMIN has access to everything
    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    // Admin management and activity logs are backend-restricted to SUPER_ADMIN only.
    if (
      path === '/admin/settings/admins' ||
      path.startsWith('/admin/settings/admins/') ||
      path === '/admin/settings/activity-logs' ||
      path.startsWith('/admin/settings/activity-logs/')
    ) {
      return false;
    }

    // If no user or no permissions, deny access
    if (!user || !user.permissions) {
      return false;
    }

    const requiredPermission = getRequiredPermission(path);
    // Unknown admin path: deny by default (secure)
    if (!requiredPermission) {
      return false;
    }

    return user.permissions[requiredPermission] === true;
  }

  async function handleLogout() {
    closeMobileMenu();
    await authStore.logout();
    goto('/login');
  }

  function isSessionExpiredError(error: unknown): error is AuthenticationError {
    return error instanceof AuthenticationError && !error.message.includes('No token provided');
  }

  async function handleSessionExpired() {
    if (sessionExpiredDialogShown) return;

    sessionExpiredDialogShown = true;
    closeMobileMenu();

    await dialogStore.alert(t('admin.sessionExpiredMessage'), t('admin.sessionExpiredTitle'));

    await authStore.logout();
    goto('/login');
  }

  // When auth is cleared after session was hydrated (e.g. refresh failed), leave admin — not before checkAuth runs
  $: if (
    typeof window !== 'undefined' &&
    sessionResolved &&
    !isAuthenticated &&
    $page.url.pathname.startsWith('/admin')
  ) {
    if (!sessionExpiredDialogShown) {
      goto('/');
    }
  }

  // Redirect to dashboard when current page is not allowed for this admin (dashboard is fallback)
  $: if (
    typeof window !== 'undefined' &&
    isAuthenticated &&
    user?.role === 'ADMIN' &&
    user?.permissions != null &&
    $page.url.pathname !== '/admin/dashboard' &&
    $page.url.pathname !== '/admin/onboarding' &&
    !hasPermission($page.url.pathname)
  ) {
    goto('/admin/dashboard');
  }

  // Notification counts
  let pendingOrdersCount = 0;
  let newTicketsCount = 0;
  let pendingPaymentRequestsCount = 0;
  let loadingNotifications = true;

  const ADMIN_MENU_EXPANDED_KEY = 'admin-menu-expanded';

  function loadAdminMenuExpandedState(): Record<number, boolean> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(ADMIN_MENU_EXPANDED_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const out: Record<number, boolean> = {};
      for (const k of Object.keys(parsed)) {
        const i = parseInt(k, 10);
        if (!Number.isNaN(i) && parsed[k] === true) out[i] = true;
      }
      return out;
    } catch {
      return {};
    }
  }

  function saveAdminMenuExpandedState(state: Record<number, boolean>) {
    if (typeof window === 'undefined') return;
    try {
      const toSave: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(state)) {
        if (v === true) toSave[k] = true;
      }
      localStorage.setItem(ADMIN_MENU_EXPANDED_KEY, JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }

  // Store expanded state: closed by default, only open if saved as true
  let groupExpandedState: Record<number, boolean> = {};

  // Mobile menu: Apple-style bottom sheet
  let mobileMenuOpen = false;
  let moreModalOpen = false;
  const MOBILE_VISIBLE_GROUPS = 4;

  $: visibleMenuGroups = menuGroups.slice(0, MOBILE_VISIBLE_GROUPS);
  $: overflowMenuGroups = menuGroups.slice(MOBILE_VISIBLE_GROUPS);
  $: hasOverflow = overflowMenuGroups.length > 0;

  function closeMobileMenu() {
    mobileMenuOpen = false;
    moreModalOpen = false;
  }

  function openMoreModal() {
    moreModalOpen = true;
  }

  function closeMoreModal() {
    moreModalOpen = false;
  }

  // Lock body scroll when mobile menu or more modal is open
  $: if (typeof document !== 'undefined') {
    if (mobileMenuOpen || moreModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  onMount(() => {
    groupExpandedState = { ...loadAdminMenuExpandedState() };
    groupExpandedState = { ...groupExpandedState };

    (async () => {
      try {
        await apiClient.prefetchCsrfToken();
      } catch {
        /* CSRF cookie may still work on next POST retry */
      }

      if (!get(authStore).sessionResolved) {
        try {
          await authStore.checkAuth();
        } catch (error) {
          if (isSessionExpiredError(error)) {
            await handleSessionExpired();
            return;
          }
          /* store cleared in checkAuth */
        }
      }

      const auth = get(authStore);
      if (
        !auth.isAuthenticated ||
        (auth.user?.role !== 'ADMIN' && auth.user?.role !== 'SUPER_ADMIN')
      ) {
        goto('/');
        return;
      }

      // Fix: Restore body scroll in case it was blocked by a modal
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }

      // Load user permissions if not already loaded
      if (
        !auth.user?.permissions &&
        (auth.user?.role === 'ADMIN' || auth.user?.role === 'SUPER_ADMIN')
      ) {
        try {
          await authStore.checkAuth();
        } catch (error) {
          if (isSessionExpiredError(error)) {
            await handleSessionExpired();
            return;
          }
          console.error('Failed to load user permissions:', error);
        }
      }

      // Load notification counts
      await loadNotificationCounts();

      const path = $page.url.pathname.replace(/\/$/, '') || '/admin';
      // Load onboarding for redirect check and banner
      if (path !== '/admin/onboarding') {
        try {
          const onboardingState = await onboardingStore.load();
          if ((path === '/admin/dashboard' || path === '/admin') && !onboardingState?.completedAt) {
            goto('/admin/onboarding');
            return;
          }
        } catch {
          // Don't block if onboarding API fails
        }
      }
    })();

    // Refresh counts every 30 seconds
    const interval = setInterval(loadNotificationCounts, 30000);

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  });

  async function loadNotificationCounts() {
    if (!$authStore.isAuthenticated) return;
    try {
      loadingNotifications = true;

      // Load pending orders count (only if user has permission)
      if (hasPermission('/admin/orders')) {
        try {
          const dashboardData = await adminApi.getDashboard();
          pendingOrdersCount = dashboardData.stats.pendingOrders || 0;
        } catch (error) {
          if (error instanceof AuthenticationError) {
            await handleSessionExpired();
            return;
          }
          console.error('Failed to load orders count:', error);
          pendingOrdersCount = 0;
        }
      }

      // Load new tickets count (only if user has permission)
      if (hasPermission('/admin/tickets')) {
        try {
          const ticketStats = await ticketApi.getTicketStats();
          newTicketsCount = (ticketStats.stats.open || 0) + (ticketStats.stats.inProgress || 0);
        } catch (error) {
          if (error instanceof AuthenticationError) {
            await handleSessionExpired();
            return;
          }
          console.error('Failed to load tickets count:', error);
          newTicketsCount = 0;
        }
      }

      // Load pending payment requests count (only if user has permission)
      if (hasPermission('/admin/payment-requests')) {
        try {
          const paymentRequestsData = await paymentRequestApi.getAll({ status: 'PENDING' });
          pendingPaymentRequestsCount = paymentRequestsData.requests?.length || 0;
        } catch (error) {
          if (error instanceof AuthenticationError) {
            await handleSessionExpired();
            return;
          }
          console.error('Failed to load payment requests count:', error);
          pendingPaymentRequestsCount = 0;
        }
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        await handleSessionExpired();
        return;
      }
      console.error('Failed to load notification counts:', error);
      pendingOrdersCount = 0;
      newTicketsCount = 0;
      pendingPaymentRequestsCount = 0;
    } finally {
      loadingNotifications = false;
    }
  }

  $: currentPath = $page.url.pathname;

  // Menu groups configuration
  interface MenuItem {
    label: string;
    path: string;
    exact?: boolean;
    badge?: number;
  }

  interface MenuGroup {
    title: string;
    items: MenuItem[];
    /** Fixed 0..9 index for accordion state / localStorage (survives .filter on groups). */
    canonicalIndex: number;
    expanded?: boolean;
  }

  // Filter menu items by permissions
  function filterMenuItems(items: MenuItem[]): MenuItem[] {
    // While checkAuth() has not finished (root +layout onMount), user is null and hasPermission
    // would hide everything — sidebar looks "empty" until a second navigation/reload.
    if (!sessionResolved) {
      return items;
    }
    // Avoid empty sidebar while /auth/me has not yet attached permissions (race after session)
    if (user?.role === 'ADMIN' && user.permissions == null) {
      return items;
    }
    return items.filter((item) => hasPermission(item.path));
  }

  // Base groups: no groupExpandedState here — avoids cyclical dependency with auto-expand reactive block.
  $: menuGroupsBase = [
    {
      canonicalIndex: 0,
      title: t('menu.overview'),
      items: filterMenuItems([
        { label: t('menu.dashboard'), path: '/admin/dashboard', exact: true },
        { label: t('menu.myProfile'), path: '/admin/profile', exact: true },
      ]),
    },
    {
      canonicalIndex: 1,
      title: t('menu.catalog'),
      items: filterMenuItems([
        { label: t('menu.products'), path: '/admin/products' },
        { label: t('menu.categories'), path: '/admin/categories' },
        ...($settingsStore.brandsEnabled
          ? [{ label: t('menu.brands'), path: '/admin/brands' }]
          : []),
        ...($settingsStore.lookbookEnabled
          ? [{ label: t('menu.lookbook'), path: '/admin/lookbook' }]
          : []),
      ]),
    },
    {
      canonicalIndex: 2,
      title: t('menu.inventory'),
      items: filterMenuItems([
        { label: t('menu.warehouses'), path: '/admin/warehouses' },
        { label: t('admin.salesPoints.title'), path: '/admin/sales-points' },
      ]),
    },
    {
      canonicalIndex: 3,
      title: t('menu.salesOrders'),
      items: filterMenuItems([
        { label: t('menu.orders'), path: '/admin/orders', badge: pendingOrdersCount },
        {
          label: t('menu.paymentRequests'),
          path: '/admin/payment-requests',
          badge: pendingPaymentRequestsCount,
        },
        { label: t('menu.returnRequests'), path: '/admin/returns' },
        { label: t('menu.promoCodes'), path: '/admin/promo' },
      ]),
    },
    {
      canonicalIndex: 4,
      title: t('menu.customersSupport'),
      items: filterMenuItems([
        { label: t('menu.customers'), path: '/admin/customers' },
        { label: t('menu.supportTickets'), path: '/admin/tickets', badge: newTicketsCount },
        { label: 'AI Chats', path: '/admin/ai-chats' },
      ]),
    },
    {
      canonicalIndex: 5,
      title: t('menu.contentManagement'),
      items: filterMenuItems([
        { label: t('menu.homepage'), path: '/admin/homepage' },
        { label: t('menu.pages'), path: '/admin/pages' },
        { label: t('menu.blog') || 'Blog', path: '/admin/blog' },
        { label: t('menu.productPageDesign'), path: '/admin/product-page-design' },
        { label: t('menu.shopPageDesign'), path: '/admin/shop-page-design' },
        { label: t('menu.header'), path: '/admin/header' },
        { label: t('menu.footer'), path: '/admin/footer' },
      ]),
    },
    {
      canonicalIndex: 6,
      title: t('menu.analytics'),
      items: filterMenuItems([
        { label: t('menu.reports'), path: '/admin/reports' },
        { label: t('menu.accounting') || 'Accounting', path: '/admin/accounting' },
      ]),
    },
    {
      canonicalIndex: 7,
      title: t('menu.marketing'),
      items: filterMenuItems([
        { label: t('menu.marketingSettings'), path: '/admin/marketing', exact: true },
        { label: t('menu.partners'), path: '/admin/partners' },
      ]),
    },
    {
      canonicalIndex: 8,
      title: t('menu.systemSettings'),
      items: filterMenuItems([
        { label: t('menu.settings'), path: '/admin/settings' },
        { label: t('menu.countries'), path: '/admin/countries' },
        { label: t('menu.languages'), path: '/admin/languages' },
        { label: t('menu.paymentGateways'), path: '/admin/payment-gateways' },
        { label: t('menu.currencyRates'), path: '/admin/currency-rates' },
        { label: t('menu.backups'), path: '/admin/backups' },
      ]),
    },
    {
      canonicalIndex: 9,
      title: t('menu.ai'),
      items: filterMenuItems([
        { label: t('gptAssistant.menu.settings'), path: '/admin/settings/gpt-assistant' },
        { label: t('gptAssistant.menu.prompts'), path: '/admin/settings/gpt-assistant/prompts' },
        {
          label: t('gptAssistant.menu.analytics'),
          path: '/admin/settings/gpt-assistant/analytics',
        },
        { label: t('gptAssistant.menu.logs'), path: '/admin/settings/gpt-assistant/logs' },
      ]),
    },
  ].filter((group) => group.items.length > 0);

  $: menuGroups = menuGroupsBase.map((group) => ({
    ...group,
    expanded: groupExpandedState[group.canonicalIndex] === true,
  }));

  function toggleGroup(canonicalIndex: number) {
    groupExpandedState[canonicalIndex] = !(groupExpandedState[canonicalIndex] === true);
    groupExpandedState = { ...groupExpandedState };
    saveAdminMenuExpandedState(groupExpandedState);
  }

  function isActive(item: MenuItem, currentPath: string): boolean {
    if (item.exact) {
      return currentPath === item.path;
    }
    // For non-exact matches, check for exact match or that the path starts with item.path + '/'
    if (currentPath === item.path) {
      return true;
    }
    // Check that the path starts with item.path + '/', but not just item.path as a substring
    return currentPath.startsWith(item.path + '/');
  }

  // Open the accordion group that contains the active page (use menuGroupsBase — no cycle with groupExpandedState)
  $: if (browser && menuGroupsBase.length > 0) {
    const path = currentPath.replace(/\/$/, '') || '/';
    let idxToExpand = -1;
    outer: for (const group of menuGroupsBase) {
      for (const item of group.items) {
        if (isActive(item, path)) {
          idxToExpand = group.canonicalIndex;
          break outer;
        }
      }
    }
    if (idxToExpand >= 0 && groupExpandedState[idxToExpand] !== true) {
      groupExpandedState = { ...groupExpandedState, [idxToExpand]: true };
      saveAdminMenuExpandedState(groupExpandedState);
    }
  }

  afterNavigate(() => {
    if (browser) {
      apiClient.prefetchCsrfToken().catch(() => {});
    }
  });

  function navigate(path: string) {
    goto(path);
  }

  // Bottom tab active state (for mobile)
  const DASHBOARD_PATHS = ['/admin/dashboard', '/admin/profile'];
  const CATALOG_PATHS = [
    '/admin/products',
    '/admin/categories',
    '/admin/brands',
    '/admin/lookbook',
  ];
  const ORDERS_PATHS = [
    '/admin/orders',
    '/admin/payment-requests',
    '/admin/returns',
    '/admin/promo',
  ];

  function isTabActive(paths: string[]): boolean {
    return paths.some((p) => currentPath === p || currentPath.startsWith(p + '/'));
  }
</script>

<div class="min-h-screen bg-white pb-20 md:pb-0">
  <div class="container-custom py-8 bg-white">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-2xl md:text-4xl font-bold">{t('admin.adminPanel')}</h1>
      <div class="flex items-center gap-3">
        <a
          href="/"
          class="text-accent-muted hover:text-accent transition-colors text-sm md:text-base"
          >{_locale && t('common.backToSite')}</a
        >
        <button
          type="button"
          on:click={handleLogout}
          class="hidden md:inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-black hover:text-black"
        >
          {_locale && t('auth.logout')}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
      <!-- Sidebar (desktop only) -->
      <nav class="hidden md:block md:col-span-1">
        <div class="space-y-1">
          {#each menuGroups as group}
            {#if group.items.length > 0}
              <div class="mb-2">
                <button
                  type="button"
                  on:click={() => toggleGroup(group.canonicalIndex)}
                  class="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <span>{group.title}</span>
                  <svg
                    class="w-4 h-4 text-gray-500 transition-transform duration-200 {group.expanded
                      ? 'rotate-180'
                      : ''}"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {#if group.expanded}
                  <ul class="mt-1 space-y-0.5 pl-2">
                    {#each group.items as item}
                      {@const active = isActive(item, currentPath)}
                      <li>
                        <a
                          href={item.path}
                          data-sveltekit-preload-data="hover"
                          on:click|preventDefault={() => navigate(item.path)}
                          class="block px-4 py-2 text-sm transition-colors"
                          class:bg-dark-light={active}
                          class:text-accent={active}
                          class:font-medium={active}
                          class:text-gray-600={!active}
                          class:hover:bg-gray-50={!active}
                          class:hover:text-gray-900={!active}
                        >
                          <span class="flex items-center justify-between">
                            <span>{item.label}</span>
                            {#if item.badge !== undefined && item.badge > 0}
                              <span
                                class="ml-2 flex items-center justify-center px-1.5 py-2.5 text-[10px] font-bold text-white bg-black rounded min-w-[16px] h-4"
                                >{item.badge > 99 ? '99+' : item.badge}</span
                              >
                            {/if}
                          </span>
                        </a>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </nav>

      <!-- Content -->
      <div class="md:col-span-4">
        <!-- Onboarding banner: show when setup not completed and not on onboarding page -->
        {#if $page.url.pathname !== '/admin/onboarding' && onboardingState && !onboardingState.completedAt}
          {@const stepLabels = [
            t('onboarding.stepWelcome'),
            t('onboarding.stepStore'),
            t('onboarding.stepCatalog'),
            t('onboarding.stepWarehouses'),
            t('onboarding.stepDesign'),
            t('onboarding.stepContent'),
            t('onboarding.stepComplete'),
          ]}
          {@const currentStep = Math.min(onboardingState.currentStep, 6)}
          {@const label = stepLabels[currentStep] ?? t('onboarding.stepComplete')}
          <a
            href="/admin/onboarding"
            class="flex items-center justify-between gap-4 p-4 mb-6 rounded-lg bg-amber-50 border border-amber-200/80 hover:bg-amber-100/80 transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span
                class="flex-shrink-0 w-8 h-8 rounded-full bg-amber-200/80 flex items-center justify-center text-amber-800 font-semibold text-sm"
              >
                {currentStep + 1}
              </span>
              <div class="min-w-0">
                <p class="font-medium text-amber-900">{t('onboarding.bannerTitle')}</p>
                <p class="text-sm text-amber-700 truncate">
                  {t('onboarding.bannerStep')
                    .replace('{current}', String(currentStep + 1))
                    .replace('{total}', '7')
                    .replace('{label}', label)}
                </p>
              </div>
            </div>
            <span class="flex-shrink-0 text-sm font-medium text-amber-800 hover:text-amber-900">
              {t('onboarding.continueSetup')} →
            </span>
          </a>
        {/if}
        <slot />
      </div>
    </div>
  </div>

  <!-- Mobile Menu: Apple-style bottom sheet -->
  {#if mobileMenuOpen}
    <!-- Backdrop -->
    <div
      class="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
      on:click={closeMobileMenu}
      on:keydown={(e) => e.key === 'Escape' && closeMobileMenu()}
      role="button"
      tabindex="-1"
      aria-label="Close"
    ></div>

    <!-- Bottom sheet -->
    <div
      class="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[20px] shadow-2xl max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
      style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
    >
      <!-- Handle bar -->
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-10 h-1 rounded-full bg-gray-300"></div>
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between px-5 pb-4 border-b border-gray-200/80">
        <h2 class="text-lg font-semibold text-gray-900">{t('menu.title')}</h2>
        <button
          type="button"
          on:click={closeMobileMenu}
          class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
          aria-label={t('common.close')}
        >
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {#if $gptVisibilityStore?.enabledAdmin}
          <button
            type="button"
            on:click={() => {
              gptAssistantOpenStore.open();
              closeMobileMenu();
            }}
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-black text-white hover:bg-gray-800 active:scale-[0.99] transition-all text-[15px] font-medium mb-4"
          >
            <svg
              class="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span>{t('gptAssistant.title')}</span>
            <span class="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          </button>
        {/if}
        {#each visibleMenuGroups as group}
          <div class="mb-4">
            <div class="rounded-xl bg-gray-50/80 overflow-hidden">
              <button
                type="button"
                on:click={() => toggleGroup(group.canonicalIndex)}
                class="w-full flex items-center justify-between px-4 py-3.5 text-[15px] font-medium text-gray-900 active:bg-gray-100 transition-colors"
              >
                <span>{group.title}</span>
                <svg
                  class="w-5 h-5 text-gray-500 transition-transform duration-200 {group.expanded
                    ? 'rotate-180'
                    : ''}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {#if group.expanded}
                <div class="border-t border-gray-200/60 divide-y divide-gray-200/40">
                  {#each group.items as item}
                    {@const active = isActive(item, currentPath)}
                    <a
                      href={item.path}
                      data-sveltekit-preload-data="hover"
                      on:click|preventDefault={() => {
                        navigate(item.path);
                        closeMobileMenu();
                      }}
                      class="flex items-center justify-between px-4 py-3.5 text-[15px] text-gray-600 hover:bg-gray-100/80 active:bg-gray-100 transition-colors {active
                        ? 'bg-gray-100/80 text-accent font-medium'
                        : ''}"
                    >
                      <span>{item.label}</span>
                      {#if item.badge !== undefined && item.badge > 0}
                        <span
                          class="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-semibold text-white bg-black rounded-full"
                          >{item.badge > 99 ? '99+' : item.badge}</span
                        >
                      {/if}
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}

        <!-- More button -->
        {#if hasOverflow}
          <button
            type="button"
            on:click={openMoreModal}
            class="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-gray-50/80 hover:bg-gray-100 active:scale-[0.99] transition-all text-[15px] font-medium text-gray-900"
          >
            <span>{t('menu.more')}</span>
            <span class="flex items-center gap-2 text-gray-500 text-sm">
              <span
                class="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-gray-200/80 text-gray-600"
                >{overflowMenuGroups.length}</span
              >
              <svg
                class="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- More Modal: overflow sections -->
  {#if moreModalOpen}
    <div
      class="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
      on:click={closeMoreModal}
      on:keydown={(e) => e.key === 'Escape' && closeMoreModal()}
      role="button"
      tabindex="-1"
    ></div>
    <div
      class="md:hidden fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[20px] shadow-2xl max-h-[75vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
      style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
    >
      <div class="flex justify-center pt-3 pb-2">
        <div class="w-10 h-1 rounded-full bg-gray-300"></div>
      </div>
      <div class="flex items-center justify-between px-5 pb-4 border-b border-gray-200/80">
        <h2 class="text-lg font-semibold text-gray-900">{t('menu.more')}</h2>
        <button
          type="button"
          on:click={closeMoreModal}
          class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
          aria-label={t('common.close')}
        >
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {#if $gptVisibilityStore?.enabledAdmin}
          <button
            type="button"
            on:click={() => {
              gptAssistantOpenStore.open();
              closeMobileMenu();
            }}
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-black text-white hover:bg-gray-800 active:scale-[0.99] transition-all text-[15px] font-medium mb-4"
          >
            <svg
              class="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span>{t('gptAssistant.title')}</span>
            <span class="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          </button>
        {/if}
        {#each overflowMenuGroups as group}
          <div class="mb-4">
            <div class="rounded-xl bg-gray-50/80 overflow-hidden">
              <button
                type="button"
                on:click={() => toggleGroup(group.canonicalIndex)}
                class="w-full flex items-center justify-between px-4 py-3.5 text-[15px] font-medium text-gray-900 active:bg-gray-100 transition-colors"
              >
                <span>{group.title}</span>
                <svg
                  class="w-5 h-5 text-gray-500 transition-transform duration-200 {group.expanded
                    ? 'rotate-180'
                    : ''}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {#if group.expanded}
                <div class="border-t border-gray-200/60 divide-y divide-gray-200/40">
                  {#each group.items as item}
                    {@const active = isActive(item, currentPath)}
                    <a
                      href={item.path}
                      data-sveltekit-preload-data="hover"
                      on:click|preventDefault={() => {
                        navigate(item.path);
                        closeMobileMenu();
                      }}
                      class="flex items-center justify-between px-4 py-3.5 text-[15px] text-gray-600 hover:bg-gray-100/80 active:bg-gray-100 transition-colors {active
                        ? 'bg-gray-100/80 text-accent font-medium'
                        : ''}"
                    >
                      <span>{item.label}</span>
                      {#if item.badge !== undefined && item.badge > 0}
                        <span
                          class="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-semibold text-white bg-black rounded-full"
                          >{item.badge > 99 ? '99+' : item.badge}</span
                        >
                      {/if}
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Mobile bottom tab bar (Apple-style) -->
  <nav
    class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
  >
    <div class="flex items-center justify-around h-16">
      <a
        href="/admin/dashboard"
        class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {isTabActive(
          DASHBOARD_PATHS
        )
          ? 'text-black font-medium'
          : 'text-gray-500'}"
        aria-label={t('menu.dashboard')}
      >
        <svg
          class="w-6 h-6 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width={isTabActive(DASHBOARD_PATHS) ? 2 : 1.5}
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        <span class="text-[10px] mt-0.5 truncate max-w-full">{t('menu.dashboard')}</span>
      </a>
      {#if hasPermission('/admin/products')}
        <a
          href="/admin/products"
          class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {isTabActive(
            CATALOG_PATHS
          )
            ? 'text-black font-medium'
            : 'text-gray-500'}"
          aria-label={t('menu.products')}
        >
          <svg
            class="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width={isTabActive(CATALOG_PATHS) ? 2 : 1.5}
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span class="text-[10px] mt-0.5 truncate max-w-full">{t('menu.products')}</span>
        </a>
      {/if}
      {#if hasPermission('/admin/orders')}
        <a
          href="/admin/orders"
          class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors relative {isTabActive(
            ORDERS_PATHS
          )
            ? 'text-black font-medium'
            : 'text-gray-500'}"
          aria-label={t('menu.orders')}
        >
          <span class="relative flex-shrink-0">
            <svg
              class="w-6 h-6 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width={isTabActive(ORDERS_PATHS) ? 2 : 1.5}
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            {#if pendingOrdersCount > 0 || pendingPaymentRequestsCount > 0}
              <span
                class="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-black text-white"
              >
                {pendingOrdersCount + pendingPaymentRequestsCount > 99
                  ? '99+'
                  : pendingOrdersCount + pendingPaymentRequestsCount}
              </span>
            {/if}
          </span>
          <span class="text-[10px] mt-0.5 truncate max-w-full">{t('menu.orders')}</span>
        </a>
      {/if}
      <button
        type="button"
        on:click={() => (mobileMenuOpen = true)}
        class="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-1 transition-colors {mobileMenuOpen
          ? 'text-black font-medium'
          : 'text-gray-500'}"
        aria-label={t('menu.title')}
      >
        <svg
          class="w-6 h-6 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width={mobileMenuOpen ? 2 : 1.5}
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span class="text-[10px] mt-0.5 truncate max-w-full">{t('menu.more')}</span>
      </button>
    </div>
  </nav>

  <!-- GPT Assistant Chat (only when enabled for admins in settings) -->
  {#if $authStore.isAuthenticated && ($authStore.user?.role === 'ADMIN' || $authStore.user?.role === 'SUPER_ADMIN') && $gptVisibilityStore?.enabledAdmin}
    <GPTAssistantChat userType="admin" />
  {/if}
</div>
