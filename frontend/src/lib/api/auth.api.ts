import { apiClient } from './client';
import type { User } from '../stores/auth.store';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  login: (data: LoginDto) => apiClient.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterDto) => apiClient.post<AuthResponse>('/auth/register', data),
  logout: () => apiClient.post('/auth/logout'),
  refresh: () => apiClient.post<{ accessToken?: string }>('/auth/refresh'),
  me: () => apiClient.get<{ user: User }>('/auth/me'),
  changePassword: (data: ChangePasswordDto) =>
    apiClient.post<{ message: string }>('/auth/change-password', data),
  twoFaSetupStart: () =>
    apiClient.post<{ otpauthUrl: string; qrDataUrl: string }>('/auth/2fa/setup/start'),
  twoFaSetupConfirm: (code: string) =>
    apiClient.post<{ message: string }>('/auth/2fa/setup/confirm', { code }),
  twoFaSetupCancel: () => apiClient.post<{ message: string }>('/auth/2fa/setup/cancel'),
  twoFaDisable: (password: string, code: string) =>
    apiClient.post<{ message: string }>('/auth/2fa/disable', { password, code }),
};
