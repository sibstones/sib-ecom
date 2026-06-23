import { apiClient } from './client';
import type { OrderItem } from './customer.api';

export type ReturnReason = 'PRODUCT_NOT_DELIVERED' | 'CUSTOMER_NOT_RECEIVED' | 'CUSTOMER_REQUESTED';
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED';
export type ReturnItemStatus = 'WRITE_OFF' | 'RETURN_TO_SALE';
export type RefundMethod = 'STRIPE' | 'BANK_TRANSFER' | 'MANUAL';

export interface ReturnRequestItem {
  id: string;
  returnRequestId: string;
  orderItemId: string;
  quantity: number;
  itemStatus: ReturnItemStatus;
  warehouseId?: string;
  replacementProductId?: string;
  replacementVariantId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  orderItem: OrderItem;
  warehouse?: {
    id: string;
    name: string;
  };
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
  reason: ReturnReason;
  status: ReturnStatus;
  refundMethod?: RefundMethod;
  refundAmount?: number;
  refundProcessedAt?: string;
  pickupMethod?: PickupMethod;
  pickupAddress?: string;
  pickupDate?: string;
  pickupNotes?: string;
  adminNotes?: string;
  customerNotes?: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    total: number;
    user: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };
  };
  items: ReturnRequestItem[];
}

export interface CreateReturnRequestDto {
  orderId: string;
  reason: ReturnReason;
  customerNotes?: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    itemStatus?: ReturnItemStatus;
    warehouseId?: string;
  }>;
}

export type PickupMethod = 'COURIER' | 'POST' | 'PICKUP';

export interface ProcessReturnRequestDto {
  status: ReturnStatus;
  refundMethod?: RefundMethod;
  refundAmount?: number;
  pickupMethod?: PickupMethod;
  pickupAddress?: string;
  pickupDate?: string;
  pickupNotes?: string;
  adminNotes?: string;
  items?: Array<{
    returnRequestItemId: string;
    itemStatus: ReturnItemStatus;
    warehouseId?: string;
    replacementProductId?: string;
    replacementVariantId?: string;
  }>;
}

export const returnApi = {
  // Customer API
  createReturnRequest: (data: CreateReturnRequestDto) =>
    apiClient.post<{ returnRequest: ReturnRequest }>('/customer/returns', data),

  getMyReturnRequests: () =>
    apiClient.get<{ returnRequests: ReturnRequest[] }>('/customer/returns'),

  getReturnRequest: (returnRequestId: string) =>
    apiClient.get<{ returnRequest: ReturnRequest }>(`/customer/returns/${returnRequestId}`),

  // Admin API
  getAllReturnRequests: (filters?: {
    status?: ReturnStatus;
    orderId?: string;
    userId?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.orderId) params.append('orderId', filters.orderId);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    return apiClient.get<{
      returnRequests: ReturnRequest[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/admin/returns?${params.toString()}`);
  },

  getReturnRequestById: (returnRequestId: string) =>
    apiClient.get<{ returnRequest: ReturnRequest }>(`/admin/returns/${returnRequestId}`),

  processReturnRequest: (returnRequestId: string, data: ProcessReturnRequestDto) =>
    apiClient.put<{ returnRequest: ReturnRequest }>(
      `/admin/returns/${returnRequestId}/process`,
      data
    ),
};
