import { writable } from 'svelte/store';
import type { CartItem } from '$lib/api/cart.api';

/** Last item added to cart — shown as widget in GPT Assistant. Cleared on dismiss or after TTL. */
const TTL_MS = 60_000; // 1 minute

function createLastAddedToCartStore() {
  const { subscribe, set, update } = writable<CartItem | null>(null);
  let ttlTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    subscribe,
    set: (item: CartItem | null) => {
      if (ttlTimer) {
        clearTimeout(ttlTimer);
        ttlTimer = null;
      }
      set(item);
      if (item) {
        ttlTimer = setTimeout(() => {
          set(null);
          ttlTimer = null;
        }, TTL_MS);
      }
    },
    clear: () => {
      if (ttlTimer) {
        clearTimeout(ttlTimer);
        ttlTimer = null;
      }
      set(null);
    },
  };
}

export const lastAddedToCartStore = createLastAddedToCartStore();
