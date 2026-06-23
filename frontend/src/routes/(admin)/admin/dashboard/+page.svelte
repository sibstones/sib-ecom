<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi, type DashboardStats, type OrderWithUser } from '$lib/api/admin.api';
  import { blogApi } from '$lib/api/blog.api';
  import { ticketApi } from '$lib/api/ticket.api';
  import { isAuthenticationError, getErrorMessage } from '$lib/utils/error-handler';
  import AuthError from '$lib/components/AuthError.svelte';
  import { goto } from '$app/navigation';
  import { t, formatOrderStatus } from '$lib/utils/i18n';
  import AdminDashboardSkeleton from '$lib/components/admin/AdminDashboardSkeleton.svelte';
  import { i18nStore } from '$lib/stores/i18n.store';

  type TabId = 'overview' | 'analytics';
  type OrdersStatusTab = 'all' | 'attention' | 'progress' | 'completed';

  let stats: DashboardStats | null = null;
  let filteredOrders: OrderWithUser[] = [];
  let loadingOrders = false;
  let ordersStatusTab: OrdersStatusTab | string = 'all';
  let ticketStats: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  } | null = null;
  let warehouseAnalytics: {
    totalStock: number;
    awaitingPayment: number;
    paid: number;
    returned: number;
    currentStock: number;
  } | null = null;
  let blogStats: { total: number; published: number; drafts: number } | null = null;
  let loading = true;
  let error: Error | null = null;
  let activeTab: TabId = 'overview';

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  async function loadData() {
    loading = true;
    error = null;
    try {
      const [
        dashboardResponse,
        ticketStatsResponse,
        warehouseAnalyticsResponse,
        blogPostsResponse,
      ] = await Promise.all([
        adminApi.getDashboard().catch((e) => {
          if (import.meta.env.DEV) console.error('Failed to load dashboard stats:', e);
          return null;
        }),
        ticketApi.getTicketStats().catch((e) => {
          if (import.meta.env.DEV) console.error('Failed to load ticket stats:', e);
          return null;
        }),
        adminApi.getWarehouseAnalytics().catch((e) => {
          if (import.meta.env.DEV) console.error('Failed to load warehouse analytics:', e);
          return null;
        }),
        blogApi.getAllPosts(false).catch((e) => {
          if (import.meta.env.DEV) console.error('Failed to load blog stats:', e);
          return null;
        }),
      ]);

      if (dashboardResponse?.stats) {
        stats = dashboardResponse;
      } else {
        stats = null;
      }

      if (ticketStatsResponse?.stats) {
        const d = ticketStatsResponse.stats;
        ticketStats = {
          total: d.total ?? 0,
          open: d.open ?? 0,
          inProgress: d.inProgress ?? 0,
          resolved: d.resolved ?? 0,
          closed: d.closed ?? 0,
        };
      } else {
        ticketStats = null;
      }

      if (warehouseAnalyticsResponse) {
        warehouseAnalytics = warehouseAnalyticsResponse;
      } else {
        warehouseAnalytics = {
          totalStock: 0,
          awaitingPayment: 0,
          paid: 0,
          returned: 0,
          currentStock: 0,
        };
      }

      if (blogPostsResponse?.posts) {
        const posts = blogPostsResponse.posts;
        blogStats = {
          total: posts.length,
          published: posts.filter((post) => post.isPublished).length,
          drafts: posts.filter((post) => !post.isPublished).length,
        };
      } else {
        blogStats = null;
      }

      if (!stats) {
        error = new Error(t('dashboard.failedToLoad'));
      }
    } catch (e) {
      error = e instanceof Error ? e : new Error(getErrorMessage(e, 'dashboard.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  $: pendingOrders = stats?.stats?.pendingOrders ?? 0;
  $: pendingPaymentRequests = stats?.stats?.pendingPaymentRequests ?? 0;
  $: pendingReturns = stats?.stats?.pendingReturns ?? 0;
  $: openTickets = ticketStats?.open ?? stats?.stats?.openTickets ?? 0;
  $: inProgressTickets = ticketStats?.inProgress ?? stats?.stats?.inProgressTickets ?? 0;

  $: adminTasks = [
    {
      id: 'orders',
      label: t('dashboard.tasks.pendingOrders'),
      count: pendingOrders,
      path: '/admin/orders',
      completed: pendingOrders === 0,
    },
    {
      id: 'payments',
      label: t('dashboard.tasks.pendingPaymentRequests'),
      count: pendingPaymentRequests,
      path: '/admin/payment-requests',
      completed: pendingPaymentRequests === 0,
    },
    {
      id: 'returns',
      label: t('dashboard.tasks.pendingReturns'),
      count: pendingReturns,
      path: '/admin/returns',
      completed: pendingReturns === 0,
    },
    {
      id: 'tickets',
      label: t('dashboard.tasks.openTickets'),
      count: openTickets + inProgressTickets,
      path: '/admin/tickets',
      completed: openTickets + inProgressTickets === 0,
    },
  ];

  $: pendingTasks = adminTasks.filter((t) => !t.completed);
  $: completedTasks = adminTasks.filter((t) => t.completed);

  $: activeTicketsCount = openTickets + inProgressTickets;

  $: quickCards = [
    {
      id: 'add-product',
      title: t('dashboard.quickCards.addProduct'),
      href: '/admin/products/new',
      metric: stats?.stats?.totalProducts ?? 0,
      metricLabel: t('dashboard.totalProducts'),
      icon: 'product',
    },
    {
      id: 'orders',
      title: t('menu.orders'),
      href: '/admin/orders',
      metric: pendingOrders,
      metricLabel: t('dashboard.tasks.pendingOrders'),
      secondaryText: `${stats?.stats?.totalOrders ?? 0} ${t('dashboard.totalOrders').toLowerCase()}`,
      highlight: pendingOrders > 0,
      icon: 'orders',
    },
    {
      id: 'tickets',
      title: t('menu.tickets'),
      href: '/admin/tickets',
      metric: activeTicketsCount,
      metricLabel: t('dashboard.quickCards.activeTickets'),
      highlight: activeTicketsCount > 0,
      icon: 'tickets',
    },
    {
      id: 'blog',
      title: t('dashboard.quickCards.addBlogPost'),
      href: '/admin/blog?new=1',
      metric: blogStats?.published ?? 0,
      metricLabel: t('dashboard.quickCards.publishedPosts'),
      secondaryText:
        blogStats && blogStats.drafts > 0
          ? t('dashboard.quickCards.drafts', { count: blogStats.drafts })
          : undefined,
      icon: 'blog',
    },
  ];

  $: recentOrdersList = (() => {
    if (ordersStatusTab === 'all') return stats?.recentOrders ?? [];
    return filteredOrders;
  })();

  async function loadFilteredOrders() {
    if (ordersStatusTab === 'all') return;
    loadingOrders = true;
    try {
      let res: { orders: OrderWithUser[] };
      if (ordersStatusTab === 'attention') {
        res = await adminApi.getAllOrders(1, 15, {
          statusIn: ['PENDING', 'RETURN_REQUESTED'],
          sortOrder: 'desc',
        });
      } else if (ordersStatusTab === 'progress') {
        res = await adminApi.getAllOrders(1, 15, {
          statusIn: ['CONFIRMED', 'PROCESSING', 'SHIPPED'],
          sortOrder: 'desc',
        });
      } else {
        res = await adminApi.getAllOrders(1, 15, {
          status: 'DELIVERED',
          sortOrder: 'desc',
        });
      }
      filteredOrders = (res.orders || []) as OrderWithUser[];
    } catch (e) {
      filteredOrders = [];
    } finally {
      loadingOrders = false;
    }
  }

  $: if (ordersStatusTab !== 'all' && !loading && stats) {
    loadFilteredOrders();
  }

  function getOrderStatusColor(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'text-amber-600 bg-amber-100';
      case 'RETURN_REQUESTED':
        return 'text-orange-600 bg-orange-100';
      case 'DELIVERED':
        return 'text-green-600 bg-green-100';
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'SHIPPED':
        return 'text-blue-600 bg-blue-100';
      case 'CANCELLED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }
</script>

<div>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <h2 class="text-3xl font-bold">{t('menu.dashboard')}</h2>
    <!-- Tabs -->
    {#if !loading && !error}
      <div class="flex gap-1 p-2 bg-gray-100 rounded-lg">
        <button
          type="button"
          on:click={() => (activeTab = 'overview')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={activeTab === 'overview'}
          class:shadow-sm={activeTab === 'overview'}
          class:text-accent={activeTab === 'overview'}
          class:text-gray-600={activeTab !== 'overview'}
          class:hover:bg-gray-50={activeTab !== 'overview'}
          class:hover:text-gray-900={activeTab !== 'overview'}
        >
          {t('dashboard.tabs.overview')}
        </button>
        <button
          type="button"
          on:click={() => (activeTab = 'analytics')}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={activeTab === 'analytics'}
          class:shadow-sm={activeTab === 'analytics'}
          class:text-accent={activeTab === 'analytics'}
          class:text-gray-600={activeTab !== 'analytics'}
          class:hover:bg-gray-50={activeTab !== 'analytics'}
          class:hover:text-gray-900={activeTab !== 'analytics'}
        >
          {t('dashboard.tabs.analytics')}
        </button>
      </div>
    {/if}
  </div>

  {#if loading}
    <AdminDashboardSkeleton />
  {:else if error}
    {#if isAuthenticationError(error)}
      <AuthError message={getErrorMessage(error)} />
    {:else}
      <div class="flex flex-col gap-4">
        <p class="text-red-400">{t('notification.error')}: {getErrorMessage(error)}</p>
        <button type="button" class="btn btn-primary w-fit" on:click={() => loadData()}>
          {t('order.retryQRCode')}
        </button>
      </div>
    {/if}
  {:else if stats && stats.stats}
    <!-- Tab: Overview -->
    {#if activeTab === 'overview'}
      <div class="space-y-6">
        <!-- Quick action cards -->
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-accent-muted mb-4">
            {t('dashboard.quickCards.title')}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {#each quickCards as card}
              <a
                href={card.href}
                class="group relative flex flex-col gap-4 p-5 rounded-card border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 {card.highlight
                  ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                  : 'border-dark-lighter bg-dark-light hover:border-accent/30 hover:bg-accent/5'}"
              >
                <div class="flex items-start justify-between gap-3">
                  <div
                    class="flex items-center justify-center w-10 h-10 rounded-card shrink-0 transition-colors {card.highlight
                      ? 'bg-amber-100'
                      : 'bg-dark-lighter group-hover:bg-accent/10'}"
                  >
                    {#if card.icon === 'product'}
                      <svg
                        class="w-5 h-5 text-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.75"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    {:else if card.icon === 'orders'}
                      <svg
                        class="w-5 h-5 text-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.75"
                          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                        />
                      </svg>
                    {:else if card.icon === 'tickets'}
                      <svg
                        class="w-5 h-5 text-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.75"
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                      </svg>
                    {:else}
                      <svg
                        class="w-5 h-5 text-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.75"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    {/if}
                  </div>
                  <svg
                    class="w-4 h-4 text-accent-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <div>
                  <p class="font-semibold mb-2 group-hover:text-accent transition-colors">
                    {card.title}
                  </p>
                  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p class="text-2xl font-bold leading-none">{card.metric}</p>
                    <p class="text-xs text-accent-muted">{card.metricLabel}</p>
                  </div>
                  {#if card.secondaryText}
                    <p class="text-xs text-accent-muted mt-2">{card.secondaryText}</p>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-dark-light p-6 rounded-card border border-dark-lighter">
            <p class="text-sm text-accent-muted mb-1">{t('dashboard.totalOrders')}</p>
            <p class="text-2xl font-bold">{stats.stats.totalOrders ?? 0}</p>
          </div>
          <div class="bg-dark-light p-6 rounded-card border border-dark-lighter">
            <p class="text-sm text-accent-muted mb-1">{t('dashboard.totalRevenue')}</p>
            <p class="text-2xl font-bold">
              {formatCurrency(Number(stats.stats.totalRevenue ?? 0))}
            </p>
          </div>
          <div class="bg-dark-light p-6 rounded-card border border-dark-lighter">
            <p class="text-sm text-accent-muted mb-1">{t('dashboard.totalCustomers')}</p>
            <p class="text-2xl font-bold">{stats.stats.totalCustomers ?? 0}</p>
          </div>
          <div class="bg-dark-light p-6 rounded-card border border-dark-lighter">
            <p class="text-sm text-accent-muted mb-1">{t('dashboard.totalProducts')}</p>
            <p class="text-2xl font-bold">{stats.stats.totalProducts ?? 0}</p>
          </div>
        </div>

        <!-- Recent Orders -->
        <div class="bg-dark-light p-6 rounded-card border border-dark-lighter">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 class="text-lg font-semibold">{t('dashboard.recentOrders')}</h3>
            <div class="flex items-center gap-2 flex-wrap">
              <div class="flex rounded-button bg-dark-lighter/50 p-0.5">
                {#each ['all', 'attention', 'progress', 'completed'] as tab}
                  <button
                    type="button"
                    on:click={() => (ordersStatusTab = tab)}
                    class="px-3 py-1.5 text-xs font-medium rounded-button transition-colors"
                    class:bg-accent={ordersStatusTab === tab}
                    class:text-dark={ordersStatusTab === tab}
                    class:text-gray-600={ordersStatusTab !== tab}
                    class:hover:bg-gray-200={ordersStatusTab !== tab}
                  >
                    {tab === 'all' ? t('common.all') : t('dashboard.ordersTab.' + tab)}
                  </button>
                {/each}
              </div>
              <a
                href="/admin/orders"
                class="text-sm text-accent hover:text-accent-muted font-medium transition-colors"
              >
                {t('dashboard.viewAll')} →
              </a>
            </div>
          </div>
          {#if loadingOrders && ordersStatusTab !== 'all'}
            <p class="text-accent-muted py-4">{t('common.loading')}</p>
          {:else if !recentOrdersList?.length}
            <p class="text-accent-muted py-4">{t('dashboard.noRecentOrders')}</p>
          {:else}
            <div class="space-y-1 -mx-2">
              {#each recentOrdersList as order}
                <a
                  href="/admin/orders/{order.id}"
                  class="flex justify-between items-center py-3 px-4 rounded-card transition-all duration-200 -mx-2 group hover:bg-accent/5 hover:shadow-sm border border-transparent hover:border-accent/10"
                >
                  <div>
                    <p class="font-medium">#{order.orderNumber}</p>
                    <p class="text-sm text-accent-muted">
                      {order.user?.email || t('dashboard.unknown')} • {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div class="text-right flex items-center gap-3">
                    <span
                      class="px-2 py-0.5 text-xs font-medium rounded-button {getOrderStatusColor(
                        order.status
                      )}"
                    >
                      {formatOrderStatus(order.status)}
                    </span>
                    <p class="font-medium">${Number(order.total || 0).toFixed(2)}</p>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Tab: Analytics & Tasks -->
    {#if activeTab === 'analytics'}
      <div class="space-y-6">
        <!-- Unified block: Analytics + Tasks -->
        <div class="bg-dark-light rounded-card border border-dark-lighter overflow-hidden">
          <div class="p-6 border-b border-dark-lighter">
            <h3 class="text-lg font-semibold">{t('dashboard.tabs.analytics')}</h3>
            <p class="text-sm text-accent-muted mt-1">{t('dashboard.analyticsBlock.subtitle')}</p>
          </div>

          <div class="p-6 space-y-8">
            <!-- Admin Tasks -->
            <div>
              <h4 class="text-sm font-semibold uppercase tracking-wide text-accent-muted mb-4">
                {t('dashboard.sidebar.adminTasks')}
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                {#each adminTasks as task}
                  <a
                    href={task.path}
                    class="flex items-center justify-between p-4 rounded-card border transition-colors"
                    class:border-amber-200={!task.completed}
                    class:bg-amber-50={!task.completed}
                    class:hover:bg-amber-100={!task.completed}
                    class:border-green-200={task.completed}
                    class:bg-green-50={task.completed}
                    class:hover:bg-green-100={task.completed}
                  >
                    <span class="text-sm font-medium" class:line-through={task.completed}
                      >{task.label}</span
                    >
                    {#if task.completed}
                      <svg
                        class="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    {:else}
                      <span
                        class="flex items-center justify-center min-w-[28px] h-7 px-2 text-xs font-bold rounded-button"
                        class:bg-amber-200={!task.completed}
                        class:text-amber-800={!task.completed}
                      >
                        {task.count}
                      </span>
                    {/if}
                  </a>
                {/each}
              </div>
            </div>

            <!-- Warehouse Analytics -->
            {#if warehouseAnalytics}
              <div>
                <h4 class="text-sm font-semibold uppercase tracking-wide text-accent-muted mb-4">
                  {t('warehouse.stockManagementAnalytics')}
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('warehouse.totalStock')}</p>
                    <p class="text-xl font-bold">{warehouseAnalytics.totalStock}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('warehouse.awaitingPayment')}</p>
                    <p class="text-xl font-bold">{warehouseAnalytics.awaitingPayment}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('warehouse.paidDelivered')}</p>
                    <p class="text-xl font-bold">{warehouseAnalytics.paid}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('warehouse.returns')}</p>
                    <p class="text-xl font-bold">{warehouseAnalytics.returned}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('warehouse.currentStock')}</p>
                    <p class="text-xl font-bold">{warehouseAnalytics.currentStock}</p>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Support Tickets -->
            {#if ticketStats}
              <div>
                <h4 class="text-sm font-semibold uppercase tracking-wide text-accent-muted mb-4">
                  {t('dashboard.supportTickets')}
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('dashboard.total')}</p>
                    <p class="text-xl font-bold">{ticketStats.total}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('dashboard.open')}</p>
                    <p class="text-xl font-bold">{ticketStats.open}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('dashboard.inProgress')}</p>
                    <p class="text-xl font-bold">{ticketStats.inProgress}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('dashboard.resolved')}</p>
                    <p class="text-xl font-bold">{ticketStats.resolved}</p>
                  </div>
                  <div class="p-4 rounded-card bg-white border border-dark-lighter">
                    <p class="text-xs text-accent-muted mb-1">{t('dashboard.closed')}</p>
                    <p class="text-xl font-bold">{ticketStats.closed}</p>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Quick actions -->
            <div class="pt-4 border-t border-dark-lighter flex flex-wrap gap-3">
              <a
                href="/admin/reports"
                class="text-sm text-accent hover:text-accent-muted font-medium transition-colors"
              >
                {t('dashboard.sidebar.viewFullReports')} →
              </a>
              <a
                href="/admin/warehouses"
                class="text-sm text-accent hover:text-accent-muted font-medium transition-colors"
              >
                {t('dashboard.viewAll')}
                {t('menu.warehouses')} →
              </a>
              <a
                href="/admin/tickets"
                class="text-sm text-accent hover:text-accent-muted font-medium transition-colors"
              >
                {t('dashboard.viewAll')}
                {t('dashboard.supportTickets')} →
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
