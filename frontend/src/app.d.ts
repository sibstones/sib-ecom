// See https://kit.svelte.dev/docs/types#app
// for information about these types
/// <reference types="@sveltejs/kit" />

declare module '$app/environment' {
  export const browser: boolean;
  export const dev: boolean;
  export const building: boolean;
}

declare module '$app/navigation' {
  export function goto(
    url: string | URL,
    opts?: {
      replaceState?: boolean;
      noScroll?: boolean;
      keepFocus?: boolean;
      invalidateAll?: boolean;
    }
  ): Promise<void>;
  export function invalidate(resource: string | URL | ((url: URL) => boolean)): Promise<void>;
  export function invalidateAll(): Promise<void>;
  export function beforeNavigate(callback: (navigation: unknown) => void): void;
  export function afterNavigate(callback: (navigation: unknown) => void): void;
  export function onNavigate(callback: (navigation: unknown) => unknown): void;
  export function disableScrollHandling(): void;
}

declare module '$app/stores' {
  import type { Readable } from 'svelte/store';
  export const page: Readable<{
    params: Record<string, string>;
    url: URL;
    route: { id: string | null };
    data: unknown;
    form: unknown;
    state: unknown;
  }>;
  export const navigating: Readable<{ from: URL; to: URL; type: string; delta?: number } | null>;
  export const updated: Readable<boolean> & { check(): Promise<boolean> };
  export function getStores(): {
    page: typeof page;
    navigating: typeof navigating;
    updated: typeof updated;
  };
}

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }

  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => number;
      reset: (widgetId: number) => void;
    };
    hcaptcha?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (error: any) => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      execute: (widgetId: string, options: {}) => Promise<string>;
    };
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export {};
