import { writable } from 'svelte/store';

/**
 * Store to trigger opening GPT Assistant from external sources (e.g. admin menu).
 * When set to true, GPTAssistantChat will open and reset this to false.
 */
function createGptAssistantOpenStore() {
  const { subscribe, set } = writable(false);

  return {
    subscribe,
    set,
    open() {
      set(true);
    },
  };
}

export const gptAssistantOpenStore = createGptAssistantOpenStore();
