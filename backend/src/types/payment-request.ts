export interface PaymentRequest {
  id: string;
  orderId: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode?: string;
    iban?: string;
    routingNumber?: string;
    notes?: string;
  };
  p2pDetails?: {
    cardNumber?: string;
    cryptoWallet?: string;
    blockchain?: string;
    sbpPhone?: string;
    instruction?: string;
  };
  cashOnDeliveryDetails?: {
    instruction?: string;
  };
  paymentProof?: string;
  adminNotes?: string;
  logisticsInfo?: {
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: string;
    shippedDate?: string;
    notes?: string;
  };
  notifiedAt?: Date;
  paidAt?: Date;
  shippedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

export interface CreatePaymentRequestDto {
  orderId: string;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode?: string;
    iban?: string;
    routingNumber?: string;
    notes?: string;
  };
  p2pDetails?: {
    cardNumber?: string;
    cryptoWallet?: string;
    blockchain?: string;
    sbpPhone?: string;
    instruction?: string;
  };
  cashOnDeliveryDetails?: {
    instruction?: string;
  };
}

export interface UpdatePaymentRequestDto {
  status?: 'PENDING' | 'PAID' | 'CANCELLED';
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode?: string;
    iban?: string;
    routingNumber?: string;
    notes?: string;
  } | null;
  p2pDetails?: {
    cardNumber?: string;
    cryptoWallet?: string;
    blockchain?: string;
    sbpPhone?: string;
    instruction?: string;
  } | null;
  cashOnDeliveryDetails?: {
    instruction?: string;
  } | null;
  paymentProof?: string;
  adminNotes?: string;
  logisticsInfo?: {
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: string;
    shippedDate?: string;
    notes?: string;
  } | null;
}
