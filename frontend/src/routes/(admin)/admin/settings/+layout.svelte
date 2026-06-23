<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/utils/i18n';
  import { authStore } from '$lib/stores/auth.store';

  const SETTINGS_NAV: { path: string; labelKey: string }[] = [
    { path: '/admin/settings', labelKey: 'settings.featureSettings' },
    { path: '/admin/settings/delivery-tracking', labelKey: 'menu.deliveryTracking' },
    { path: '/admin/settings/api-keys', labelKey: 'menu.apiKeys' },
    { path: '/admin/settings/admins', labelKey: 'menu.adminManagement' },
    { path: '/admin/settings/activity-logs', labelKey: 'menu.activityLogs' },
  ];
  const HIDE_SETTINGS_NAV_PREFIXES = ['/admin/settings/gpt-assistant'];

  $: isSuperAdmin = $authStore.user?.role === 'SUPER_ADMIN';
  $: visibleSettingsNav = SETTINGS_NAV.filter((item) => {
    if (isSuperAdmin) return true;
    return item.path !== '/admin/settings/admins' && item.path !== '/admin/settings/activity-logs';
  });
  $: hideSettingsNav = HIDE_SETTINGS_NAV_PREFIXES.some(
    (prefix) => $page.url.pathname === prefix || $page.url.pathname.startsWith(prefix + '/')
  );

  function normalizePath(path: string): string {
    return path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
  }

  function isActivePath(path: string): boolean {
    return normalizePath($page.url.pathname) === normalizePath(path);
  }
</script>

<div>
  {#if !hideSettingsNav}
    <nav class="flex gap-1 mb-6 p-2 bg-gray-100 rounded-lg overflow-x-auto">
      {#each visibleSettingsNav as item (item.path)}
        <a
          href={item.path}
          data-sveltekit-preload-data="hover"
          aria-current={isActivePath(item.path) ? 'page' : undefined}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={isActivePath(item.path)}
          class:shadow-sm={isActivePath(item.path)}
          class:text-accent={isActivePath(item.path)}
          class:text-gray-600={!isActivePath(item.path)}
          class:hover:bg-gray-50={!isActivePath(item.path)}
          class:hover:text-gray-900={!isActivePath(item.path)}
        >
          {t(item.labelKey)}
        </a>
      {/each}
    </nav>
  {/if}

  <slot />
</div>
