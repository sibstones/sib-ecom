import { writable } from 'svelte/store';
import { headerApi, type HeaderSettings } from '$lib/api/header.api';

interface HeaderStore {
  settings: HeaderSettings | null;
  loading: boolean;
  error: string | null;
}

const createHeaderStore = () => {
  const { subscribe, set, update } = writable<HeaderStore>({
    settings: null,
    loading: false,
    error: null,
  });

  return {
    subscribe,
    load: async () => {
      update((state) => ({ ...state, loading: true, error: null }));
      try {
        const response = await headerApi.getActiveSettings();
        update((state) => ({
          ...state,
          settings: response.settings,
          loading: false,
        }));
      } catch (error) {
        update((state) => ({
          ...state,
          error: error instanceof Error ? error.message : 'Failed to load header settings',
          loading: false,
        }));
      }
    },
    setSettings: (settings: HeaderSettings | null) => {
      update((state) => ({ ...state, settings }));
    },
    reset: () => {
      set({
        settings: null,
        loading: false,
        error: null,
      });
    },
  };
};

export const headerStore = createHeaderStore();
