import { get, writable } from 'svelte/store';

export interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'alert' | 'confirm';
}

interface DialogState {
  isOpen: boolean;
  options: DialogOptions | null;
  resolve: ((value: boolean) => void) | null;
}

const createDialogStore = () => {
  const { subscribe, set, update } = writable<DialogState>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  return {
    subscribe,
    alert: (message: string, title?: string): Promise<void> => {
      return new Promise((resolve) => {
        set({
          isOpen: true,
          options: {
            message,
            title,
            type: 'alert',
            confirmText: 'OK',
          },
          resolve: () => {
            set({ isOpen: false, options: null, resolve: null });
            resolve();
          },
        });
      });
    },
    confirm: (
      message: string,
      title?: string,
      confirmText?: string,
      cancelText?: string
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        set({
          isOpen: true,
          options: {
            message,
            title,
            type: 'confirm',
            confirmText,
            cancelText,
          },
          resolve: (result: boolean) => {
            set({ isOpen: false, options: null, resolve: null });
            resolve(result);
          },
        });
      });
    },
    close: (result: boolean = false) => {
      const state = get({ subscribe });
      set({ isOpen: false, options: null, resolve: null });
      state.resolve?.(result);
    },
  };
};

export const dialogStore = createDialogStore();
