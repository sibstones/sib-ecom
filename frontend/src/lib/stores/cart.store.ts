import { writable } from 'svelte/store';
import { cartApi, type CartItem } from '../api/cart.api';
import { browser } from '$app/environment';
import { lastAddedToCartStore } from './last-added-to-cart.store';

interface CartState {
  items: CartItem[];
  loading: boolean;
}

const createCartStore = () => {
  const { subscribe, set, update } = writable<CartState>({
    items: [],
    loading: false,
  });

  // Generate session ID for guest users
  const getSessionId = (): string => {
    if (!browser) return '';

    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  };

  return {
    subscribe,
    load: async () => {
      update((state) => ({ ...state, loading: true }));
      try {
        const sessionId = getSessionId();
        const response = await cartApi.getCart(sessionId);
        console.log('Cart API response:', response);
        console.log(
          'Cart items from API:',
          response.items.map((item) => ({
            id: item.id,
            name: item.product.name,
            size: item.size,
            sizeType: typeof item.size,
            hasSize: !!item.size,
          }))
        );
        set({ items: response.items, loading: false });
      } catch (error) {
        console.error('Failed to load cart:', error);
        update((state) => ({ ...state, loading: false }));
      }
    },
    add: async (productId: string, quantity: number = 1, variantId?: string, size?: string) => {
      try {
        const sessionId = getSessionId();
        console.log('cartStore.add - calling API with:', { productId, quantity, variantId, size });
        const response = await cartApi.addToCart(productId, quantity, variantId, size, sessionId);
        console.log('cartStore.add - API response:', response);
        console.log('cartStore.add - item:', response.item);
        console.log('cartStore.add - item size:', response.item?.size);
        console.log('cartStore.add - full item data:', JSON.stringify(response.item, null, 2));
        await cartStore.load();
        if (response?.item) {
          lastAddedToCartStore.set(response.item);
        }
      } catch (error) {
        console.error('Failed to add to cart:', error);
        throw error;
      }
    },
    updateQuantity: async (itemId: string, quantity: number) => {
      try {
        const sessionId = getSessionId();
        await cartApi.updateQuantity(itemId, quantity, sessionId);
        await cartStore.load();
      } catch (error) {
        console.error('Failed to update quantity:', error);
        throw error;
      }
    },
    remove: async (itemId: string) => {
      try {
        const sessionId = getSessionId();
        await cartApi.removeFromCart(itemId, sessionId);
        await cartStore.load();
      } catch (error) {
        console.error('Failed to remove from cart:', error);
        throw error;
      }
    },
    clear: async () => {
      try {
        const sessionId = getSessionId();
        await cartApi.clearCart(sessionId);
        await cartStore.load();
      } catch (error) {
        console.error('Failed to clear cart:', error);
        throw error;
      }
    },
    getTotal: () => {
      let total = 0;
      subscribe((state) => {
        total = state.items.reduce((sum, item) => {
          if (item.product?.priceOnRequest) {
            return sum;
          }
          const raw = item.variant?.price ?? item.product.price;
          const price = typeof raw === 'number' ? raw : Number(raw) || 0;
          return sum + price * item.quantity;
        }, 0);
      })();
      return total;
    },
    getItemCount: () => {
      let count = 0;
      subscribe((state) => {
        count = state.items.reduce((sum, item) => sum + item.quantity, 0);
      })();
      return count;
    },
  };
};

export const cartStore = createCartStore();
