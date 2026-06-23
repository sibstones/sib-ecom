// GPT Assistant Types

export enum IntentType {
  // Admin: Products
  PRODUCT_SEARCH = 'PRODUCT_SEARCH',
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  
  // Admin: Inventory
  INVENTORY_VIEW = 'INVENTORY_VIEW',
  WAREHOUSE_CREATE = 'WAREHOUSE_CREATE',
  INVENTORY_ADD = 'INVENTORY_ADD',
  INVENTORY_TRANSFER = 'INVENTORY_TRANSFER',
  INVENTORY_UPDATE_STATUS = 'INVENTORY_UPDATE_STATUS',
  
  // Admin: Orders
  ORDER_SEARCH = 'ORDER_SEARCH',
  ORDER_VIEW = 'ORDER_VIEW',
  ORDER_UPDATE_STATUS = 'ORDER_UPDATE_STATUS',
  ORDER_UPDATE_PAYMENT_STATUS = 'ORDER_UPDATE_PAYMENT_STATUS',
  
  // Admin: Payment Requests
  PAYMENT_REQUEST_CREATE = 'PAYMENT_REQUEST_CREATE',
  PAYMENT_REQUEST_VIEW = 'PAYMENT_REQUEST_VIEW',
  
  // Admin: Returns
  RETURN_REQUEST_VIEW = 'RETURN_REQUEST_VIEW',
  RETURN_REQUEST_APPROVE = 'RETURN_REQUEST_APPROVE',
  RETURN_REQUEST_REJECT = 'RETURN_REQUEST_REJECT',
  
  // Admin: Customers
  CUSTOMER_SEARCH = 'CUSTOMER_SEARCH',
  CUSTOMER_VIEW = 'CUSTOMER_VIEW',
  CUSTOMER_UPDATE = 'CUSTOMER_UPDATE',
  CUSTOMER_NOTE_ADD = 'CUSTOMER_NOTE_ADD',
  CUSTOMER_NOTE_VIEW = 'CUSTOMER_NOTE_VIEW',
  
  // Admin: Integrations
  INTEGRATION_CONFIGURE = 'INTEGRATION_CONFIGURE',
  INTEGRATION_VIEW = 'INTEGRATION_VIEW',
  
  // Admin: Payment Gateways
  PAYMENT_GATEWAY_CONFIGURE = 'PAYMENT_GATEWAY_CONFIGURE',
  PAYMENT_GATEWAY_VIEW = 'PAYMENT_GATEWAY_VIEW',
  PAYMENT_GATEWAY_ENABLE = 'PAYMENT_GATEWAY_ENABLE',
  
  // Admin: Delivery Services
  DELIVERY_SERVICE_CONFIGURE = 'DELIVERY_SERVICE_CONFIGURE',
  DELIVERY_SERVICE_VIEW = 'DELIVERY_SERVICE_VIEW',
  
  // Admin: Email Services
  EMAIL_SERVICE_CONFIGURE = 'EMAIL_SERVICE_CONFIGURE',
  EMAIL_SERVICE_VIEW = 'EMAIL_SERVICE_VIEW',
  EMAIL_SERVICE_TEST = 'EMAIL_SERVICE_TEST',
  
  // Admin: OAuth Providers
  OAUTH_PROVIDER_CONFIGURE = 'OAUTH_PROVIDER_CONFIGURE',
  OAUTH_PROVIDER_VIEW = 'OAUTH_PROVIDER_VIEW',
  OAUTH_PROVIDER_ENABLE = 'OAUTH_PROVIDER_ENABLE',
  
  // Admin: Analytics
  ANALYTICS_VIEW = 'ANALYTICS_VIEW',
  REPORT_GENERATE = 'REPORT_GENERATE',
  MARKETING_ADVICE = 'MARKETING_ADVICE',
  
  // Admin: Support
  TICKET_VIEW = 'TICKET_VIEW',
  TICKET_CREATE = 'TICKET_CREATE',
  TICKET_RESPOND = 'TICKET_RESPOND',
  TICKET_UPDATE_STATUS = 'TICKET_UPDATE_STATUS',
  
  // Admin: Content Management
  LOOKBOOK_VIEW = 'LOOKBOOK_VIEW',
  LOOKBOOK_CREATE = 'LOOKBOOK_CREATE',
  LOOKBOOK_UPDATE = 'LOOKBOOK_UPDATE',
  PAGE_VIEW = 'PAGE_VIEW',
  PAGE_CREATE = 'PAGE_CREATE',
  PAGE_UPDATE = 'PAGE_UPDATE',
  BLOG_POST_VIEW = 'BLOG_POST_VIEW',
  BLOG_POST_CREATE = 'BLOG_POST_CREATE',
  BLOG_POST_UPDATE = 'BLOG_POST_UPDATE',
  BLOG_POST_PUBLISH = 'BLOG_POST_PUBLISH',
  
  // Admin: Promo Codes
  PROMO_CODE_VIEW = 'PROMO_CODE_VIEW',
  PROMO_CODE_CREATE = 'PROMO_CODE_CREATE',
  PROMO_CODE_UPDATE = 'PROMO_CODE_UPDATE',
  PROMO_CODE_STATS = 'PROMO_CODE_STATS',
  
  // Customer: Product Search & Info
  CUSTOMER_PRODUCT_SEARCH = 'CUSTOMER_PRODUCT_SEARCH',
  CUSTOMER_PRODUCT_INFO = 'CUSTOMER_PRODUCT_INFO',
  CUSTOMER_PRODUCT_RECOMMENDATIONS = 'CUSTOMER_PRODUCT_RECOMMENDATIONS',
  
  // Customer: Orders
  CUSTOMER_ORDER_TRACK = 'CUSTOMER_ORDER_TRACK',
  CUSTOMER_ORDER_VIEW = 'CUSTOMER_ORDER_VIEW',
  CUSTOMER_ORDER_HISTORY = 'CUSTOMER_ORDER_HISTORY',
  
  // Customer: Profile & Account
  CUSTOMER_PROFILE_VIEW = 'CUSTOMER_PROFILE_VIEW',
  CUSTOMER_PROFILE_UPDATE = 'CUSTOMER_PROFILE_UPDATE',
  CUSTOMER_ADDRESS_MANAGE = 'CUSTOMER_ADDRESS_MANAGE',
  
  // Customer: Wishlist & Cart
  CUSTOMER_WISHLIST_VIEW = 'CUSTOMER_WISHLIST_VIEW',
  CUSTOMER_WISHLIST_ADD = 'CUSTOMER_WISHLIST_ADD',
  CUSTOMER_WISHLIST_REMOVE = 'CUSTOMER_WISHLIST_REMOVE',
  CUSTOMER_CART_VIEW = 'CUSTOMER_CART_VIEW',
  CUSTOMER_CART_ADD = 'CUSTOMER_CART_ADD',
  CUSTOMER_CART_UPDATE = 'CUSTOMER_CART_UPDATE',
  
  // Customer: Promo & Loyalty
  CUSTOMER_PROMO_SEARCH = 'CUSTOMER_PROMO_SEARCH',
  CUSTOMER_PROMO_APPLY = 'CUSTOMER_PROMO_APPLY',
  CUSTOMER_LOYALTY_VIEW = 'CUSTOMER_LOYALTY_VIEW',
  
  // Customer: Delivery & Payment Info
  CUSTOMER_DELIVERY_INFO = 'CUSTOMER_DELIVERY_INFO',
  CUSTOMER_PAYMENT_INFO = 'CUSTOMER_PAYMENT_INFO',
  
  // Customer: Returns
  CUSTOMER_RETURN_CREATE = 'CUSTOMER_RETURN_CREATE',
  CUSTOMER_RETURN_TRACK = 'CUSTOMER_RETURN_TRACK',
  
  // Customer: Support
  CUSTOMER_SUPPORT_CREATE = 'CUSTOMER_SUPPORT_CREATE',
  CUSTOMER_SUPPORT_VIEW = 'CUSTOMER_SUPPORT_VIEW',
  
  // Customer: General Info
  CUSTOMER_STORE_INFO = 'CUSTOMER_STORE_INFO',
  CUSTOMER_FAQ = 'CUSTOMER_FAQ',
  
  // General
  HELP = 'HELP',
  UNKNOWN = 'UNKNOWN'
}

export interface AssistantRequest {
  message: string;
  context?: AssistantContext;
}

export interface AssistantContext {
  previousMessages?: ChatMessage[];
  filters?: Record<string, any>;
  currentPage?: string; // Current page in admin panel or store
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AssistantResponse {
  response: string; // Text response from assistant
  intent: IntentType;
  data?: any; // Structured data (if applicable)
  suggestions?: string[]; // Suggestions for next actions
  executionTime: number; // Execution time in ms
  requiresConfirmation?: boolean; // Whether action requires confirmation
  quickActions?: QuickAction[]; // Quick actions for customers
}

export interface QuickAction {
  type: string;
  label: string;
  productId?: string;
  orderId?: string;
  [key: string]: any;
}

export interface Intent {
  type: IntentType;
  confidence: number; // Confidence in recognition (0-1)
  params: Record<string, any>; // Extracted parameters
}

export interface AssistantError {
  code: string;
  message: string;
  details?: any;
}

export type UserType = 'admin' | 'customer' | 'guest';

export interface GPTAssistantSettings {
  enabledAdmin: boolean;
  enabledCustomer: boolean;
  enabledGuest: boolean;
  mode: 'production' | 'test' | 'disabled';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  providerType: 'openai' | 'anthropic' | 'custom' | 'lm_studio';
  model: string;
  /** OpenAI-compatible API base (LM Studio, local proxy, Azure-style URL). */
  apiBaseUrl?: string | null;
  apiKey?: string;
  testApiKey?: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
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

/** User-facing message when the assistant is temporarily unavailable (e.g. model not available, intent UNKNOWN). */
export const ASSISTANT_UNAVAILABLE_MESSAGE = 'The assistant is not available at the moment. Please try again later.';
