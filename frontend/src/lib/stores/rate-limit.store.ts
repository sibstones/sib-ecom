import { writable } from 'svelte/store';

export interface RateLimitState {
  /** Banner is visible when active is true */
  active: boolean;
  /** Seconds to wait before retrying (from Retry-After) */
  retryAfter: number;
}

const initialState: RateLimitState = {
  active: false,
  retryAfter: 60,
};

function createRateLimitStore() {
  const { subscribe, set, update } = writable<RateLimitState>(initialState);

  return {
    subscribe,
    /** Show rate limit banner (called from API client on 429 after retries exhausted) */
    show: (retryAfter: number = 60) => {
      update((s) => ({ ...s, active: true, retryAfter }));
    },
    /** Hide banner (user dismiss or after cooldown) */
    dismiss: () => {
      set({ ...initialState });
    },
  };
}

export const rateLimitStore = createRateLimitStore();
