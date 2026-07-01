import { writable } from 'svelte/store';
import { apiClient } from '../api/client';
import { browser } from '$app/environment';

export interface AdminPermissions {
  canManageSupport: boolean;
  canManageOrders: boolean;
  canManageInventory: boolean;
  canManagePayments: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageBrands: boolean;
  canManageCustomers: boolean;
  canManagePromoCodes: boolean;
  canManageContent: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isPartner?: boolean;
  partnerStatus?: string | null;
  emailVerified?: boolean;
  permissions?: AdminPermissions | null;
  twoFactorEnabled?: boolean;
  twoFactorSetupPending?: boolean;
  passwordLoginAvailable?: boolean;
}

export type LoginResult =
  | { step: 'done'; user: User }
  | { step: 'twoFactor'; twoFactorToken: string; user: User };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True after the first /auth/me (checkAuth) attempt or explicit login/logout. Used to avoid treating the initial false as "logged out" before hydration. */
  sessionResolved: boolean;
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    isAuthenticated: false,
    sessionResolved: false,
  });

  // Cleanup legacy token storage: auth now uses secure httpOnly cookies.
  if (browser) {
    localStorage.removeItem('auth');
    localStorage.removeItem('auth_token');
  }

  return {
    subscribe,
    login: async (
      email: string,
      password: string,
      captchaToken?: string,
      twoFactor?: { token: string; code: string }
    ): Promise<LoginResult> => {
      try {
        const response = await apiClient.post<{
          user: User;
          requiresTwoFactor?: boolean;
          twoFactorToken?: string;
        }>('/auth/login', {
          email,
          password,
          ...(captchaToken && { captchaToken }),
          ...(twoFactor && {
            twoFactorToken: twoFactor.token,
            twoFactorCode: twoFactor.code,
          }),
        });

        if (response.requiresTwoFactor && response.twoFactorToken) {
          return {
            step: 'twoFactor',
            twoFactorToken: response.twoFactorToken,
            user: response.user,
          };
        }

        const state = {
          user: response.user,
          isAuthenticated: true,
          sessionResolved: true,
        };

        set(state);

        return { step: 'done', user: response.user };
      } catch (error) {
        console.error('Login error:', error);
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw new Error(
            'Unable to connect to server. Please check your connection and ensure the backend is running.'
          );
        }
        throw error;
      }
    },
    register: async (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
      promoCode?: string,
      captchaToken?: string
    ) => {
      try {
        const response = await apiClient.post<{
          user: User;
          requiresEmailVerification?: boolean;
        }>('/auth/register', {
          email,
          password,
          firstName,
          lastName,
          ...(promoCode && { promoCode: promoCode.toUpperCase().trim() }),
          ...(captchaToken && { captchaToken }),
        });

        if (!response.requiresEmailVerification) {
          set({
            user: response.user,
            isAuthenticated: true,
            sessionResolved: true,
          });
        }

        return response;
      } catch (error) {
        console.error('Register error:', error);
        throw error;
      }
    },
    verifyEmail: async (token: string) => {
      const response = await apiClient.post<{ message: string; user: User }>('/auth/verify-email', {
        token,
      });
      set({
        user: response.user,
        isAuthenticated: true,
        sessionResolved: true,
      });
      return response;
    },
    resendVerification: async (email?: string) => {
      return apiClient.post<{ message: string }>(
        '/auth/resend-verification',
        email ? { email } : {}
      );
    },
    requestPasswordReset: async (email: string) => {
      const response = await apiClient.post<{ message: string }>('/auth/forgot-password', {
        email,
      });
      return response;
    },
    resetPassword: async (token: string, newPassword: string) => {
      const response = await apiClient.post<{ message: string }>('/auth/reset-password', {
        token,
        newPassword,
      });
      return response;
    },
    setAuthData: async (data: { user: User }) => {
      const state = {
        user: data.user,
        isAuthenticated: true,
        sessionResolved: true,
      };

      set(state);

      return data;
    },
    logout: async () => {
      try {
        const state = { user: null, isAuthenticated: false, sessionResolved: true };
        set(state);
        await apiClient.post<{ message: string }>('/auth/logout');
      } catch (error) {
        // Ignore errors - ensure cleanup happens even if logout endpoint fails
        console.warn('Logout error (ignored):', error);
      }
    },
    refreshAccessToken: async () => {
      try {
        if (!browser) return null;

        const baseUrl = import.meta.env.VITE_API_URL || '/api';

        // Backend requires CSRF for POST; fetch token first (same-origin or CORS with credentials)
        let csrfToken: string | null = null;
        const csrfUrls = [`${baseUrl}/csrf-token`, `${baseUrl}/auth/csrf-token`];
        for (const url of csrfUrls) {
          try {
            const csrfRes = await fetch(url, { method: 'GET', credentials: 'include' });
            if (csrfRes.ok) {
              const data = (await csrfRes.json()) as { csrfToken?: string };
              if (typeof data.csrfToken === 'string' && data.csrfToken.length > 0) {
                csrfToken = data.csrfToken;
                break;
              }
            }
          } catch {
            // continue to next URL
          }
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }

        // Use fetch directly to avoid triggering token refresh logic in ApiClient
        const response = await fetch(`${baseUrl}/auth/refresh`, {
          method: 'POST',
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `HTTP error! status: ${response.status}`,
          }));
          throw new Error(errorData.error || errorData.message || 'Token refresh failed');
        }

        const data = (await response.json()) as { accessToken?: string };
        return data.accessToken ?? null;
      } catch (error) {
        console.error('Token refresh error:', error);
        // If refresh fails, clear auth state without calling logout
        // (which would trigger another API call and potential recursion)
        const state = { user: null, isAuthenticated: false, sessionResolved: true };
        set(state);
        throw error;
      }
    },
    checkAuth: async () => {
      try {
        const response = await apiClient.get<{ user: User }>('/auth/me', {
          refreshOnMissingToken: false,
        });
        const updatedState = {
          user: response.user,
          isAuthenticated: true,
          sessionResolved: true,
        };
        update((state) => ({
          ...state,
          ...updatedState,
        }));
        // Update localStorage with fresh user data
        return response.user;
      } catch (error) {
        // If check fails, clear auth
        set({
          user: null,
          isAuthenticated: false,
          sessionResolved: true,
        });
        throw error;
      }
    },
  };
};

export const authStore = createAuthStore();
