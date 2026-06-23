import { apiClient } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AssistantRequest {
  message: string;
  context?: {
    previousMessages?: ChatMessage[];
    currentPage?: string;
  };
}

type AssistantRequestOptions = {
  signal?: AbortSignal;
};

export interface AssistantResponse {
  response: string;
  intent: string;
  data?: any;
  suggestions?: string[];
  executionTime: number;
  requiresConfirmation?: boolean;
  quickActions?: QuickAction[];
}

export interface QuickAction {
  type: string;
  label: string;
  productId?: string;
  orderId?: string;
  [key: string]: any;
}

export interface ChatHistoryItem {
  id: string;
  message: string;
  response: string;
  intent: string;
  data?: any;
  executionTime: number;
  createdAt: string;
}

export interface ChatHistoryResponse {
  messages: ChatHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClearChatHistoryResponse {
  deleted: number;
}

export interface AIConversationListItem {
  id: string;
  channel: 'ADMIN' | 'CUSTOMER';
  status: string;
  adminId?: string | null;
  userId?: string | null;
  guestSessionId?: string | null;
  title?: string | null;
  language?: string | null;
  topicLabel?: string | null;
  summary?: string | null;
  lastIntent?: string | null;
  lastMessageAt: string;
  resolvedAt?: string | null;
  escalatedAt?: string | null;
  assignedAdminId?: string | null;
  supportTicketId?: string | null;
  createdAt: string;
  updatedAt: string;
  admin?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  customer?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  _count?: {
    messages: number;
    executions: number;
  };
}

export interface AIConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  actorUserId?: string | null;
  content: string;
  translatedContent?: string | null;
  intent?: string | null;
  toolData?: any;
  isError: boolean;
  createdAt: string;
}

export interface AIActionExecution {
  id: string;
  conversationId: string;
  messageId?: string | null;
  actionId: string;
  status: string;
  permissionChecked: boolean;
  confirmationRequired: boolean;
  arguments: any;
  previewData?: any;
  resultData?: any;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface AIConversationDetail extends AIConversationListItem {
  messages: AIConversationMessage[];
  executions: AIActionExecution[];
}

export interface AIConversationListResponse {
  conversations: AIConversationListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AIDraftReplyResponse {
  draft: string;
  summary: string;
}

export interface AssistantDisplayConfig {
  displayTitle: string | null;
  fabIconUrl: string | null;
  quickPromptsAdmin: { id: string; text: string }[];
  quickPromptsCustomer: { id: string; text: string }[];
  /** none | browser | openai | custom */
  sttProvider?: 'none' | 'browser' | 'openai' | 'custom';
  sttEnabled?: boolean;
}

export const gptAssistantApi = {
  /** Public: display config for chat UI (title, FAB icon, quick prompts). No auth. */
  getConfig: () =>
    apiClient.get<AssistantDisplayConfig>('/gpt-assistant/config', { cache: 'no-store' }),

  // Admin endpoints
  chatAdmin: (data: AssistantRequest, options?: AssistantRequestOptions) =>
    apiClient.post<AssistantResponse>('/gpt-assistant/admin/chat', data, options),

  getHistoryAdmin: (limit: number = 50, offset: number = 0) =>
    apiClient.get<ChatHistoryResponse>(
      `/gpt-assistant/admin/history?limit=${limit}&offset=${offset}`
    ),

  clearHistoryAdmin: () =>
    apiClient.delete<ClearChatHistoryResponse>('/gpt-assistant/admin/history'),

  getAdminConversations: (params?: {
    channel?: 'admin' | 'customer';
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.channel) query.set('channel', params.channel);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<AIConversationListResponse>(`/gpt-assistant/admin/conversations${suffix}`);
  },

  getAdminConversationById: (id: string) =>
    apiClient.get<AIConversationDetail>(`/gpt-assistant/admin/conversations/${id}`),

  createTicketFromConversation: (
    id: string,
    data?: {
      subject?: string;
      message?: string;
    }
  ) =>
    apiClient.post<{ ticket: { id: string } }>(
      `/gpt-assistant/admin/conversations/${id}/create-ticket`,
      data ?? {}
    ),

  draftReplyForConversation: (id: string) =>
    apiClient.post<AIDraftReplyResponse>(
      `/gpt-assistant/admin/conversations/${id}/draft-reply`,
      {}
    ),

  sendReplyForConversation: (id: string, data?: { message?: string }) =>
    apiClient.post<{ ticket: { id: string } }>(
      `/gpt-assistant/admin/conversations/${id}/send-reply`,
      data ?? {}
    ),

  escalateConversation: (id: string) =>
    apiClient.post<{ conversation: AIConversationDetail }>(
      `/gpt-assistant/admin/conversations/${id}/escalate`,
      {}
    ),

  resolveConversation: (id: string) =>
    apiClient.post<{ conversation: AIConversationDetail }>(
      `/gpt-assistant/admin/conversations/${id}/resolve`,
      {}
    ),

  // Customer endpoints
  chatCustomer: (data: AssistantRequest, sessionId?: string, options?: AssistantRequestOptions) =>
    apiClient.post<AssistantResponse>('/gpt-assistant/customer/chat', data, {
      ...(sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : {}),
      ...(options || {}),
    }),

  getHistoryCustomer: (limit: number = 50, offset: number = 0, sessionId?: string) =>
    apiClient.get<ChatHistoryResponse>(
      `/gpt-assistant/customer/history?limit=${limit}&offset=${offset}`,
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    ),

  clearHistoryCustomer: (sessionId?: string) =>
    apiClient.delete<ClearChatHistoryResponse>(
      '/gpt-assistant/customer/history',
      sessionId
        ? {
            headers: { 'x-session-id': sessionId },
          }
        : undefined
    ),
};
