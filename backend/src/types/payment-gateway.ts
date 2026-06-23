export interface PaymentGatewayConfig {
  // Stripe
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  
  // PayPal
  clientId?: string;
  clientSecret?: string;
  merchantId?: string;
  
  // YooKassa
  shopId?: string;

  // CloudPayments (Public ID = login, API Secret = password for API/auth)
  publicId?: string;

  // AliPay (Alipay Global)
  appId?: string;
  privateKey?: string;
  alipayPublicKey?: string;

  // WeChat Pay (API v3)
  mchId?: string;
  apiV3Key?: string;
  merchantPrivateKey?: string;
  merchantCertificateSerial?: string;
  merchantCertificate?: string; // PEM content of apiclient_cert.pem (optional, for some SDKs)

  // P2P
  cardNumber?: string;
  cryptoWallet?: string;
  blockchain?: string;
  sbpPhone?: string;
  instruction?: string;
  instructionEn?: string;
  instructionZh?: string;

  // Manager chat
  managerName?: string;
  telegramUsername?: string;
  whatsappNumber?: string;
  wechatLink?: string;
  maxLink?: string;

  // Cash on delivery 
  // instruction — optional text shown to customer 
  // instructionEn / instructionZh — localized instruction variants for the storefront
  // (same key 'instruction' as P2P; config shape is just { instruction? } for CASH_ON_DELIVERY)

  // Common
  apiKey?: string;
  apiSecret?: string;
  [key: string]: unknown;
}

export interface PaymentGateway {
  id: string;
  type: string;
  name: string;
  isEnabled: boolean;
  isTestMode: boolean;
  config: PaymentGatewayConfig;
  supportedCountries: string[];
  supportedCurrencies: string[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

export interface CreatePaymentGatewayDto {
  type: string;
  name: string;
  isEnabled?: boolean;
  isTestMode?: boolean;
  config: PaymentGatewayConfig;
  supportedCountries?: string[];
  supportedCurrencies?: string[];
  sortOrder?: number;
}

export interface UpdatePaymentGatewayDto {
  name?: string;
  isEnabled?: boolean;
  isTestMode?: boolean;
  config?: PaymentGatewayConfig;
  supportedCountries?: string[];
  supportedCurrencies?: string[];
  sortOrder?: number;
}
