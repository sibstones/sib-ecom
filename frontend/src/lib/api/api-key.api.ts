import { apiClient } from './client';

export interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  description?: string;
  allowedIPs: string[];
  allowedDomains: string[];
  scopes?: string[];
  rateLimit: number;
  quota?: number;
  quotaUsed: number;
  expiresAt?: string;
  lastUsedAt?: string;
  lastUsedIP?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface CreateApiKeyInput {
  name: string;
  description?: string;
  allowedIPs?: string[];
  allowedDomains?: string[];
  scopes?: string[];
  rateLimit?: number;
  quota?: number;
  expiresAt?: string;
}

export interface ApiScope {
  scope: string;
  description: string;
  endpoints: string[];
  methods: string[];
}

export interface UpdateApiKeyInput {
  name?: string;
  description?: string;
  allowedIPs?: string[];
  allowedDomains?: string[];
  scopes?: string[];
  rateLimit?: number;
  quota?: number;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface ApiKeyWithKey extends ApiKey {
  key: string; // Only returned on creation/rotation
}

export interface ApiKeyStats {
  apiKeyId: string;
  period: string;
  stats: {
    totalRequests: number;
    requestsByEndpoint: Array<{ endpoint: string; count: number }>;
    requestsByDay: Array<{ date: string; count: number }>;
    recentRequests: Array<{
      id: string;
      ip: string;
      endpoint: string;
      method: string;
      statusCode: number;
      responseTime: number;
      createdAt: string;
    }>;
  };
}

export const apiKeyApi = {
  /**
   * Create a new API key
   */
  async create(input: CreateApiKeyInput): Promise<ApiKeyWithKey> {
    const response = await apiClient.post<{ apiKey: ApiKey; key: string; message: string }>(
      '/api-keys',
      input
    );
    return {
      ...response.apiKey,
      key: response.key,
    };
  },

  /**
   * Get all API keys
   */
  async getAll(): Promise<ApiKey[]> {
    const response = await apiClient.get<{ apiKeys: ApiKey[] }>('/api-keys');
    return response.apiKeys;
  },

  /**
   * Get API key by ID
   */
  async getById(id: string): Promise<ApiKey & { usageLogs?: any[] }> {
    const response = await apiClient.get<{ apiKey: ApiKey & { usageLogs?: any[] } }>(
      `/api-keys/${id}`
    );
    return response.apiKey;
  },

  /**
   * Update API key
   */
  async update(id: string, input: UpdateApiKeyInput): Promise<ApiKey> {
    const response = await apiClient.put<{ apiKey: ApiKey }>(`/api-keys/${id}`, input);
    return response.apiKey;
  },

  /**
   * Delete API key
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api-keys/${id}`);
  },

  /**
   * Rotate API key (create new, deactivate old)
   */
  async rotate(id: string, input: CreateApiKeyInput): Promise<ApiKeyWithKey> {
    const response = await apiClient.post<{ apiKey: ApiKey; key: string; message: string }>(
      `/api-keys/${id}/rotate`,
      input
    );
    return {
      ...response.apiKey,
      key: response.key,
    };
  },

  /**
   * Get usage statistics
   */
  async getStats(id: string, days: number = 30): Promise<ApiKeyStats> {
    const response = await apiClient.get<ApiKeyStats>(`/api-keys/${id}/stats`, {
      params: { days },
    });
    return response;
  },

  /**
   * Get available API scopes
   */
  async getScopes(): Promise<{ scopes: ApiScope[]; grouped: Record<string, ApiScope[]> }> {
    const response = await apiClient.get<{
      scopes: ApiScope[];
      grouped: Record<string, ApiScope[]>;
    }>('/api-keys/scopes');
    return response;
  },
};
