import { writable, derived } from 'svelte/store';
import { onboardingApi, type OnboardingState, type OnboardingData } from '$lib/api/onboarding.api';

export const ONBOARDING_STEPS = 8; // 0=welcome, 1=store, 2=catalog, 3=warehouses/reports, 4=design, 5=content, 6=email, 7=complete

function createOnboardingStore() {
  const { subscribe, set, update } = writable<OnboardingState | null>(null);

  const loading = writable(false);
  const error = writable<string | null>(null);

  return {
    subscribe,
    loading: { subscribe: loading.subscribe },
    error: { subscribe: error.subscribe },

    load: async () => {
      loading.set(true);
      error.set(null);
      try {
        const state = await onboardingApi.getStatus();
        set(state);
        return state;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load onboarding';
        error.set(msg);
        set(null);
        return null;
      } finally {
        loading.set(false);
      }
    },

    updateStep: async (step: number, data?: Partial<OnboardingData>) => {
      loading.set(true);
      error.set(null);
      try {
        const state = await onboardingApi.update({
          currentStep: step,
          data: data ? { ...data } : undefined,
        });
        set(state);
        return state;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to update';
        error.set(msg);
        throw e;
      } finally {
        loading.set(false);
      }
    },

    complete: async (data?: OnboardingData) => {
      loading.set(true);
      error.set(null);
      try {
        const state = await onboardingApi.complete({ data });
        set(state);
        return state;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to complete';
        error.set(msg);
        throw e;
      } finally {
        loading.set(false);
      }
    },

    resetProgress: async () => {
      loading.set(true);
      error.set(null);
      try {
        const state = await onboardingApi.reset();
        set(state);
        return state;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to reset';
        error.set(msg);
        throw e;
      } finally {
        loading.set(false);
      }
    },

    skip: async () => {
      loading.set(true);
      error.set(null);
      try {
        const state = await onboardingApi.skip();
        set(state);
        return state;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to skip';
        error.set(msg);
        throw e;
      } finally {
        loading.set(false);
      }
    },

    clear: () => {
      set(null);
      error.set(null);
    },
  };
}

export const onboardingStore = createOnboardingStore();

/** Separate store for loading state (use $onboardingLoadingStore in components). */
export const onboardingLoadingStore = (() => {
  const { subscribe } = onboardingStore.loading;
  return { subscribe };
})();

export const isOnboardingCompleted = derived(onboardingStore, ($s) => !!$s?.completedAt);
