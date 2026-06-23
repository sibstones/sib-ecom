import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface DashboardPreferences {
  /** Show warehouse analytics block on dashboard */
  showWarehouseAnalytics: boolean;
  /** Show support tickets block */
  showSupportTickets: boolean;
  /** Show recent orders block */
  showRecentOrders: boolean;
  /** Show extended analytics in sidebar */
  showExtendedAnalytics: boolean;
  /** Show admin tasks in sidebar */
  showAdminTasks: boolean;
}

const STORAGE_KEY = 'admin-dashboard-preferences';

const DEFAULT: DashboardPreferences = {
  showWarehouseAnalytics: true,
  showSupportTickets: true,
  showRecentOrders: true,
  showExtendedAnalytics: true,
  showAdminTasks: true,
};

function load(): DashboardPreferences {
  if (!browser) return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<DashboardPreferences>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

function save(prefs: DashboardPreferences) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function createDashboardPreferencesStore() {
  const { subscribe, set, update } = writable<DashboardPreferences>(DEFAULT);

  if (browser) {
    set(load());
  }

  return {
    subscribe,
    set: (prefs: DashboardPreferences) => {
      set(prefs);
      save(prefs);
    },
    update: (fn: (p: DashboardPreferences) => DashboardPreferences) => {
      update((p) => {
        const next = fn(p);
        save(next);
        return next;
      });
    },
    toggle: (key: keyof DashboardPreferences, value?: boolean) => {
      update((p) => {
        const next = { ...p, [key]: value ?? !p[key] };
        save(next);
        return next;
      });
    },
    reset: () => {
      set(DEFAULT);
      save(DEFAULT);
    },
  };
}

export const dashboardPreferencesStore = createDashboardPreferencesStore();
