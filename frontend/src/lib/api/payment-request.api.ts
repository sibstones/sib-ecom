import { apiClient } from './client';

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  notes?: string;
}

export interface P2PDetails {
  cardNumber?: string;
  cryptoWallet?: string;
  blockchain?: string;
  sbpPhone?: string;
  instruction?: string;
}

export interface LogisticsInfo {
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  shippedDate?: string;
  notes?: string;
  // Yandex Delivery fields
  yandexDeliveryClaimId?: string;
  pickupPointId?: string;
  trackingUrl?: string;
  pickupPoint?: {
    id: string;
    name: string;
    address: string;
    workingHours?: string;
    phone?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
}

export interface CashOnDeliveryDetails {
  instruction?: string;
}

export interface PaymentRequest {
  id: string;
  orderId: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  bankDetails?: BankDetails;
  p2pDetails?: P2PDetails;
  cashOnDeliveryDetails?: CashOnDeliveryDetails;
  paymentProof?: string;
  paymentProofDownloadUrl?: string;
  adminNotes?: string;
  logisticsInfo?: LogisticsInfo;
  notifiedAt?: string;
  paidAt?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    status?: string;
    paymentMethod?: string;
    user?: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    items?: Array<{
      id: string;
      quantity: number;
      price: number;
      product: {
        id: string;
        name: string;
        images?: Array<{ url: string }>;
      };
      variant?: {
        id: string;
        name: string;
      };
    }>;
    shippingAddress?: {
      address: string;
      city: string;
      country: string;
      postalCode?: string;
    };
  };
}

export const paymentRequestApi = {
  getAll: (filters?: {
    status?: string;
    orderId?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.orderId) params.append('orderId', filters.orderId);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    return apiClient.get<{
      requests: PaymentRequest[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/payment-requests?${params.toString()}`);
  },
  getById: (id: string) => apiClient.get<{ request: PaymentRequest }>(`/payment-requests/${id}`),
  getByOrderId: (orderId: string) =>
    apiClient.get<{ request: PaymentRequest }>(`/payment-requests/order/${orderId}`),
  update: (
    id: string,
    data: {
      status?: 'PENDING' | 'PAID' | 'CANCELLED';
      bankDetails?: BankDetails;
      paymentProof?: string;
      adminNotes?: string;
      logisticsInfo?: LogisticsInfo;
    }
  ) => apiClient.put<{ request: PaymentRequest }>(`/payment-requests/${id}`, data),
  markAsNotified: (id: string) =>
    apiClient.post<{ message: string }>(`/payment-requests/${id}/mark-notified`),
  markAsPaid: (id: string) =>
    apiClient.post<{ request: PaymentRequest }>(`/payment-requests/${id}/mark-paid`),
  markAsPaidByOrderId: (orderId: string) =>
    apiClient.post<{ request: PaymentRequest }>(`/payment-requests/order/${orderId}/mark-paid`),
  uploadPaymentProof: (orderId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<{ request: PaymentRequest }>(
      `/payment-requests/order/${orderId}/payment-proof`,
      formData
    );
  },
  downloadPaymentProofUrl: (paymentRequestId: string) =>
    `/api/payment-requests/${paymentRequestId}/payment-proof/download`,
  markAsShipped: (id: string, logisticsInfo: LogisticsInfo) =>
    apiClient.post<{ request: PaymentRequest }>(`/payment-requests/${id}/mark-shipped`, {
      logisticsInfo,
    }),
  /** Ensure PaymentRequest exists for shipping (creates for GATEWAY-paid orders). */
  ensureForShipping: (orderId: string) =>
    apiClient.get<{ request: PaymentRequest }>(
      `/payment-requests/order/${orderId}/ensure-for-shipping`
    ),
  /** Mark order as shipped by orderId. Creates PaymentRequest if needed for GATEWAY-paid orders. */
  markAsShippedByOrderId: (orderId: string, logisticsInfo: LogisticsInfo) =>
    apiClient.post<{ request: PaymentRequest }>(`/payment-requests/order/${orderId}/mark-shipped`, {
      logisticsInfo,
    }),
};
