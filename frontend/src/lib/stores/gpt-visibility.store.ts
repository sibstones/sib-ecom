import { writable } from 'svelte/store';
import {
  gptAssistantSettingsApi,
  type GPTAssistantVisibility,
} from '$lib/api/gpt-assistant-settings.api';
import { browser } from '$app/environment';

const initialState: GPTAssistantVisibility | null = null;

function createGptVisibilityStore() {
  const { subscribe, set } = writable<GPTAssistantVisibility | null>(initialState);

  return {
    subscribe,
    async load(): Promise<GPTAssistantVisibility | null> {
      if (!browser) return null;
      try {
        const data = await gptAssistantSettingsApi.getVisibility();
        const visibility: GPTAssistantVisibility = {
          enabledAdmin: Boolean(data.enabledAdmin),
          enabledCustomer: Boolean(data.enabledCustomer),
          enabledGuest: Boolean(data.enabledGuest),
          mode: data.mode ?? 'production',
        };
        set(visibility);
        return visibility;
      } catch (e) {
        console.warn('GPT visibility load failed:', e);
        set(null);
        return null;
      }
    },
    clear() {
      set(null);
    },
  };
}

export const gptVisibilityStore = createGptVisibilityStore();
