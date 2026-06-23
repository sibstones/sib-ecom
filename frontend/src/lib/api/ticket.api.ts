import { apiClient } from './client';
import type { Order } from './customer.api';

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  orderId?: string | null;
  userId: string;
  subject: string;
  status: TicketStatus;
  adminId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  order?: {
    id: string;
    orderNumber: string;
    status?: string;
    total?: number;
    createdAt?: string;
    items?: Array<{
      product: {
        name: string;
        images?: Array<{ url: string }>;
      };
    }>;
  };
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  messages?: SupportTicketMessage[];
}

export const ticketApi = {
  // Customer: Create ticket
  createTicket: (data: { orderId: string; subject: string; message: string }) =>
    apiClient.post<{ ticket: SupportTicket }>('/customer/tickets', data),

  // Customer: Get customer tickets
  getCustomerTickets: (page: number = 1, limit: number = 20) =>
    apiClient.get<{
      tickets: SupportTicket[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/customer/tickets?page=${page}&limit=${limit}`),

  // Customer: Get single ticket (markRead=true to mark as read when opening)
  getCustomerTicket: (ticketId: string, markRead: boolean = false) =>
    apiClient.get<{ ticket: SupportTicket }>(
      `/customer/tickets/${ticketId}${markRead ? '?markRead=1' : ''}`
    ),
  // Customer: Mark ticket as read
  markTicketAsRead: (ticketId: string) =>
    apiClient.patch<{ message: string }>(`/customer/tickets/${ticketId}/read`),

  // Customer: Add message
  addCustomerMessage: (ticketId: string, message: string) =>
    apiClient.post<{ ticket: SupportTicket }>(`/customer/tickets/${ticketId}/messages`, {
      message,
    }),

  // Admin: Get all tickets
  getAllTickets: (
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: TicketStatus;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    return apiClient.get<{
      tickets: SupportTicket[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/admin/tickets?${params.toString()}`);
  },

  // Admin: Get ticket stats
  getTicketStats: () =>
    apiClient.get<{
      stats: {
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
        closed: number;
      };
    }>('/admin/tickets/stats'),

  // Admin: Get ticket details
  getTicketDetails: (ticketId: string) =>
    apiClient.get<{ ticket: SupportTicket }>(`/admin/tickets/${ticketId}`),

  // Admin: Assign ticket
  assignTicket: (ticketId: string) =>
    apiClient.post<{ ticket: SupportTicket }>(`/admin/tickets/${ticketId}/assign`),

  // Admin: Add admin message
  addAdminMessage: (ticketId: string, message: string) =>
    apiClient.post<{ ticket: SupportTicket }>(`/admin/tickets/${ticketId}/messages`, { message }),

  // Admin: Create ticket for customer (orderId optional — e.g. proactive support when customer has no orders)
  createTicketForCustomer: (data: {
    orderId?: string | null;
    userId: string;
    subject: string;
    message: string;
  }) => apiClient.post<{ ticket: SupportTicket }>('/admin/tickets/create', data),

  // Admin: Update ticket status
  updateTicketStatus: (ticketId: string, status: TicketStatus) =>
    apiClient.put<{ ticket: SupportTicket }>(`/admin/tickets/${ticketId}/status`, { status }),
};
