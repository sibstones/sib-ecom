import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

interface NotificationState {
  notifications: Notification[];
}

const createNotificationStore = () => {
  const { subscribe, set, update } = writable<NotificationState>({
    notifications: [],
  });

  const show = (message: string, type: NotificationType = 'info', duration: number = 3000) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: Notification = { id, message, type, duration };

    update((state) => ({
      notifications: [...state.notifications, notification],
    }));

    if (duration > 0) {
      setTimeout(() => {
        update((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, duration);
    }

    return id;
  };

  const store = {
    subscribe,
    show,
    success: (message: string, duration?: number) => show(message, 'success', duration ?? 3000),
    error: (message: string, duration?: number) => show(message, 'error', duration ?? 5000),
    info: (message: string, duration?: number) => show(message, 'info', duration ?? 3000),
    warning: (message: string, duration?: number) => show(message, 'warning', duration ?? 3000),
    remove: (id: string) => {
      update((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    },
    clear: () => {
      set({ notifications: [] });
    },
  };

  return store;
};

export const notificationStore = createNotificationStore();
