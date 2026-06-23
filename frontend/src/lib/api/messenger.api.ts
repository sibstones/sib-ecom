import { apiClient } from './client';

export interface MessengerContact {
  id: string;
  userId: string;
  type: 'TELEGRAM' | 'WHATSAPP' | 'VIBER' | 'OTHER';
  contactId: string;
  username?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const messengerApi = {
  getContacts: () => apiClient.get<{ contacts: MessengerContact[] }>('/messenger'),
  createContact: (data: {
    type: 'TELEGRAM' | 'WHATSAPP' | 'VIBER' | 'OTHER';
    contactId: string;
    username?: string;
  }) => apiClient.post<{ contact: MessengerContact }>('/messenger', data),
  updateContact: (
    id: string,
    data: {
      contactId?: string;
      username?: string;
      isActive?: boolean;
    }
  ) => apiClient.put<{ contact: MessengerContact }>(`/messenger/${id}`, data),
  deleteContact: (id: string) => apiClient.delete<{ message: string }>(`/messenger/${id}`),
};
