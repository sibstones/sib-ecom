import { dialogStore } from '$lib/stores/dialog.store';

/**
 * Custom alert function - use with await for proper async behavior
 * @param message - The message to display
 * @param title - Optional title for the dialog
 */
export async function alert(message: string, title?: string): Promise<void> {
  await dialogStore.alert(message, title);
}

/**
 * Custom confirm function - use with await for proper async behavior
 * @param message - The message to display
 * @param title - Optional title for the dialog
 * @param confirmText - Text for confirm button (default: 'OK')
 * @param cancelText - Text for cancel button (default: 'Cancel')
 * @returns Promise that resolves to true if confirmed, false if cancelled
 */
export async function confirm(
  message: string,
  title?: string,
  confirmText = 'OK',
  cancelText = 'Cancel'
): Promise<boolean> {
  return await dialogStore.confirm(message, title, confirmText, cancelText);
}

/**
 * Replace global window.alert and window.confirm with custom implementations
 * This should be called once in the app initialization
 *
 * Note: The custom implementations show our custom dialogs.
 * For proper async behavior with confirm(), use the exported confirm() function with await.
 */
export function setupGlobalDialogs() {
  if (typeof window !== 'undefined') {
    // Store original functions
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    // Replace with custom implementations
    // These will show our custom dialogs instead of browser alerts
    window.alert = (message?: any) => {
      const messageStr = String(message || '');
      // Show dialog (non-blocking)
      dialogStore.alert(messageStr).catch(() => {
        // Silently handle errors
      });
    };

    window.confirm = (message?: string): boolean => {
      const messageStr = message || '';
      // Show dialog and return false by default
      // Note: For proper async behavior, use the exported confirm() function with await
      dialogStore.confirm(messageStr).catch(() => {
        // Silently handle errors
      });
      return false; // Default to false since we can't block synchronously
    };

    // Return function to restore originals if needed
    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }
  return () => {};
}
