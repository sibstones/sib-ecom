import { IntentType } from '../types/gpt-assistant';
import prisma from '../config/database';
import { AdminPermissionsDto } from '../types/admin';

/**
 * Maps intent types to required permissions
 */
const INTENT_PERMISSIONS: Partial<Record<IntentType, keyof AdminPermissionsDto | null>> = {
  // Products
  PRODUCT_SEARCH: 'canManageProducts',
  PRODUCT_CREATE: 'canManageProducts',
  PRODUCT_UPDATE: 'canManageProducts',
  PRODUCT_DELETE: 'canManageProducts',
  
  // Inventory
  INVENTORY_VIEW: 'canManageInventory',
  WAREHOUSE_CREATE: 'canManageInventory',
  INVENTORY_ADD: 'canManageInventory',
  INVENTORY_TRANSFER: 'canManageInventory',
  INVENTORY_UPDATE_STATUS: 'canManageInventory',
  
  // Orders
  ORDER_SEARCH: 'canManageOrders',
  ORDER_VIEW: 'canManageOrders',
  ORDER_UPDATE_STATUS: 'canManageOrders',
  ORDER_UPDATE_PAYMENT_STATUS: 'canManageOrders',
  PAYMENT_REQUEST_CREATE: 'canManageOrders',
  PAYMENT_REQUEST_VIEW: 'canManageOrders',
  RETURN_REQUEST_VIEW: 'canManageOrders',
  RETURN_REQUEST_APPROVE: 'canManageOrders',
  RETURN_REQUEST_REJECT: 'canManageOrders',
  
  // Customers
  CUSTOMER_SEARCH: 'canManageCustomers',
  CUSTOMER_VIEW: 'canManageCustomers',
  CUSTOMER_UPDATE: 'canManageCustomers',
  CUSTOMER_NOTE_ADD: 'canManageCustomers',
  CUSTOMER_NOTE_VIEW: 'canManageCustomers',
  
  // Integrations
  INTEGRATION_CONFIGURE: 'canManageSettings',
  INTEGRATION_VIEW: 'canManageSettings',
  
  // Payment Gateways
  PAYMENT_GATEWAY_CONFIGURE: 'canManageSettings',
  PAYMENT_GATEWAY_VIEW: 'canManageSettings',
  PAYMENT_GATEWAY_ENABLE: 'canManageSettings',
  
  // Delivery Services
  DELIVERY_SERVICE_CONFIGURE: 'canManageSettings',
  DELIVERY_SERVICE_VIEW: 'canManageSettings',
  
  // Email Services
  EMAIL_SERVICE_CONFIGURE: 'canManageSettings',
  EMAIL_SERVICE_VIEW: 'canManageSettings',
  EMAIL_SERVICE_TEST: 'canManageSettings',
  
  // OAuth Providers
  OAUTH_PROVIDER_CONFIGURE: 'canManageSettings',
  OAUTH_PROVIDER_VIEW: 'canManageSettings',
  OAUTH_PROVIDER_ENABLE: 'canManageSettings',
  
  // Analytics
  ANALYTICS_VIEW: 'canViewReports',
  REPORT_GENERATE: 'canViewReports',
  MARKETING_ADVICE: 'canViewReports',
  
  // Support
  TICKET_VIEW: 'canManageSupport',
  TICKET_CREATE: 'canManageSupport',
  TICKET_RESPOND: 'canManageSupport',
  TICKET_UPDATE_STATUS: 'canManageSupport',
  
  // Content Management
  LOOKBOOK_VIEW: 'canManageContent',
  LOOKBOOK_CREATE: 'canManageContent',
  LOOKBOOK_UPDATE: 'canManageContent',
  PAGE_VIEW: 'canManageContent',
  PAGE_CREATE: 'canManageContent',
  PAGE_UPDATE: 'canManageContent',
  BLOG_POST_VIEW: 'canManageContent',
  BLOG_POST_CREATE: 'canManageContent',
  BLOG_POST_UPDATE: 'canManageContent',
  BLOG_POST_PUBLISH: 'canManageContent',
  
  // Promo Codes
  PROMO_CODE_VIEW: 'canManagePromoCodes',
  PROMO_CODE_CREATE: 'canManagePromoCodes',
  PROMO_CODE_UPDATE: 'canManagePromoCodes',
  PROMO_CODE_STATS: 'canManagePromoCodes',
  
  // Customer intents (no permissions needed - handled separately)
  CUSTOMER_PRODUCT_SEARCH: null,
  CUSTOMER_PRODUCT_INFO: null,
  CUSTOMER_PRODUCT_RECOMMENDATIONS: null,
  CUSTOMER_ORDER_TRACK: null,
  CUSTOMER_ORDER_VIEW: null,
  CUSTOMER_ORDER_HISTORY: null,
  CUSTOMER_PROFILE_VIEW: null,
  CUSTOMER_PROFILE_UPDATE: null,
  CUSTOMER_ADDRESS_MANAGE: null,
  CUSTOMER_WISHLIST_VIEW: null,
  CUSTOMER_WISHLIST_ADD: null,
  CUSTOMER_WISHLIST_REMOVE: null,
  CUSTOMER_CART_VIEW: null,
  CUSTOMER_CART_ADD: null,
  CUSTOMER_CART_UPDATE: null,
  CUSTOMER_PROMO_SEARCH: null,
  CUSTOMER_PROMO_APPLY: null,
  CUSTOMER_LOYALTY_VIEW: null,
  CUSTOMER_DELIVERY_INFO: null,
  CUSTOMER_PAYMENT_INFO: null,
  CUSTOMER_RETURN_CREATE: null,
  CUSTOMER_RETURN_TRACK: null,
  CUSTOMER_SUPPORT_CREATE: null,
  CUSTOMER_SUPPORT_VIEW: null,
  CUSTOMER_STORE_INFO: null,
  CUSTOMER_FAQ: null,
  
  // General
  HELP: null,
  UNKNOWN: null,
};

export class PermissionCheckerService {
  /**
   * Check if admin has permission for intent
   */
  async checkPermission(adminId: string, intent: IntentType): Promise<boolean> {
    try {
      // Get required permission
      const requiredPermission = INTENT_PERMISSIONS[intent];
      
      // If no permission required, allow
      if (!requiredPermission) {
        return true;
      }

      // Get admin with permissions
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        include: {
          adminPermissions: true,
        },
      });

      if (!admin) {
        return false;
      }

      // SUPER_ADMIN has all permissions
      if (admin.role === 'SUPER_ADMIN') {
        return true;
      }

      // Check if admin has permissions record
      if (!admin.adminPermissions) {
        return false;
      }

      // Check specific permission
      const permissions = admin.adminPermissions as any;
      return permissions[requiredPermission] === true;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Get missing permission message
   */
  getMissingPermissionMessage(intent: IntentType, language: string = 'en'): string {
    const requiredPermission = INTENT_PERMISSIONS[intent];
    
    if (!requiredPermission) {
      return '';
    }

    const permissionNames: Record<keyof AdminPermissionsDto, string> = {
      canManageSupport: 'management of support',
      canManageOrders: 'management of orders',
      canManageInventory: 'management of inventory',
      canManagePayments: 'management of payments',
      canManageProducts: 'management of products',
      canManageCategories: 'management of categories',
      canManageBrands: 'management of brands',
      canManageCustomers: 'management of customers',
      canManagePromoCodes: 'management of promo codes',
      canManageContent: 'management of content',
      canManageSettings: 'management of settings',
      canViewReports: 'viewing reports',
    };

    if (language === 'ru') {
      return `You do not have permission to perform this action. Required permission: ${permissionNames[requiredPermission]}.`;
    }
    if (language === 'zh') {
      return `You do not have permission to perform this action. Required permission: ${permissionNames[requiredPermission]}.`;
    }

    return `You do not have permission to perform this action. Required permission: ${permissionNames[requiredPermission]}.`;
  }
}

export const permissionCheckerService = new PermissionCheckerService();
