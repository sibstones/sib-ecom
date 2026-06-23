import { apiClient } from './client';

export interface GPTAssistantSettings {
  enabledAdmin: boolean;
  enabledCustomer: boolean;
  enabledGuest: boolean;
  mode: 'production' | 'test' | 'disabled';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  displayTitle?: string | null;
  fabIconUrl?: string | null;
  providerType: 'openai' | 'anthropic' | 'custom' | 'lm_studio';
  model: string;
  apiBaseUrl?: string | null;
  apiKey?: string;
  testApiKey?: string;
  timeout: number;
  adminMaxResponseLength: number;
  adminEnableSuggestions: boolean;
  adminEnableQuickActions: boolean;
  adminDetailLevel: 'detailed' | 'normal' | 'brief';
  customerMaxResponseLength: number;
  customerEnableSuggestions: boolean;
  customerEnableQuickActions: boolean;
  customerTone: 'friendly' | 'professional' | 'casual';
  customerEnableRecommendations: boolean;
  customerEnableContextHelp: boolean;
  rateLimitAdmin: number;
  rateLimitCustomer: number;
  rateLimitGuest: number;
  blockOnLimitExceeded: boolean;
  filterContent: boolean;
  checkPermissions: boolean;
  logAllRequests: boolean;
  anonymizeLogs: boolean;
  enableCache: boolean;
  cacheTTL: number;
  cacheFrequentQueries: boolean;
  maxCacheSize: number;
  ragEnabled: boolean;
  ragEmbeddingModel: string;
  /** none | browser | openai | custom */
  sttProvider: 'none' | 'browser' | 'openai' | 'custom';
}

export interface GPTAssistantPrompt {
  id: string;
  type: string;
  prompt: string;
  version: string;
  comment?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePromptDto {
  prompt?: string;
  version?: string;
  comment?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface GPTAssistantVisibility {
  enabledAdmin: boolean;
  enabledCustomer: boolean;
  enabledGuest: boolean;
  mode: string;
}

export interface GPTAssistantAnalytics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgExecutionTime: number;
  adminRequests: number;
  customerRequests: number;
  guestRequests: number;
  intentStats?: Record<string, number>;
}

export interface GPTAssistantLogItem {
  id: string;
  message: string;
  response?: string;
  intent: string;
  executionTime: number;
  createdAt: string;
  userType: 'admin' | 'customer' | 'guest';
}

export interface GPTAssistantLogsResponse {
  logs: GPTAssistantLogItem[];
  total: number;
}

export interface GPTAssistantTestConnectionResponse {
  success: boolean;
  message?: string;
  response?: string;
  error?: string;
}

export interface GPTAssistantTestConnectionRequest {
  providerType?: GPTAssistantSettings['providerType'];
  apiBaseUrl?: string;
  apiKey?: string;
  testApiKey?: string;
  model?: string;
  mode?: GPTAssistantSettings['mode'];
}

export const gptAssistantSettingsApi = {
  /** Public endpoint: visibility flags for showing/hiding GPT button (no auth required). Never cached. */
  getVisibility: () =>
    apiClient.get<GPTAssistantVisibility>('/gpt-assistant/visibility', { cache: 'no-store' }),

  // Settings
  getSettings: () => apiClient.get<GPTAssistantSettings>('/admin/gpt-assistant/settings'),

  updateSettings: (data: Partial<GPTAssistantSettings>) =>
    apiClient.put<GPTAssistantSettings>('/admin/gpt-assistant/settings', data),

  // Prompts
  getPrompts: (type?: string) => {
    const url = type ? `/admin/gpt-assistant/prompts?type=${type}` : '/admin/gpt-assistant/prompts';
    return apiClient.get<GPTAssistantPrompt[]>(url);
  },

  getPrompt: (id: string) =>
    apiClient.get<GPTAssistantPrompt>(`/admin/gpt-assistant/prompts/${id}`),

  updatePrompt: (id: string, data: UpdatePromptDto) =>
    apiClient.put<GPTAssistantPrompt>(`/admin/gpt-assistant/prompts/${id}`, data),

  createPrompt: (data: {
    type: string;
    prompt: string;
    version?: string;
    comment?: string;
    sortOrder?: number;
  }) => apiClient.post<GPTAssistantPrompt>('/admin/gpt-assistant/prompts', data),

  deletePrompt: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/admin/gpt-assistant/prompts/${id}`),

  // Analytics
  getAnalytics: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);
    const url = `/admin/gpt-assistant/analytics${params.toString() ? '?' + params.toString() : ''}`;
    return apiClient.get<GPTAssistantAnalytics>(url);
  },

  // Logs
  getLogs: (params?: {
    page?: number;
    limit?: number;
    userType?: string;
    intent?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.userType) queryParams.append('userType', params.userType);
    if (params?.intent) queryParams.append('intent', params.intent);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const url = `/admin/gpt-assistant/logs${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return apiClient.get<GPTAssistantLogsResponse>(url);
  },

  /** OpenAI-compatible GET /v1/models via backend (uses saved API key; optional overrides from form). */
  discoverModels: (body?: { apiBaseUrl?: string; providerType?: string }) =>
    apiClient.post<{ models: string[] }>('/admin/gpt-assistant/models/discover', body ?? {}),

  // Test
  testConnection: (data?: GPTAssistantTestConnectionRequest) =>
    apiClient.post<GPTAssistantTestConnectionResponse>(
      '/admin/gpt-assistant/test/connection',
      data ?? {}
    ),

  testChat: (data: { message: string; userType: 'admin' | 'customer' }) =>
    apiClient.post('/admin/gpt-assistant/test/chat', data),
};
