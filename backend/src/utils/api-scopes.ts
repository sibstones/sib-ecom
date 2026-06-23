/**
 * API Scopes definitions and utilities
 * 
 * Scopes format: "resource:action"
 * - resource: the API resource (products, orders, etc.)
 * - action: read, write, or * (all actions)
 * 
 * Empty scopes array = full access to all endpoints
 */

export type ApiScope = string;

export interface ScopeDefinition {
  scope: ApiScope;
  description: string;
  endpoints: string[];
  methods: string[];
}

/**
 * Available API scopes
 */
export const API_SCOPES: Record<string, ScopeDefinition> = {
  // Products
  'products:read': {
    scope: 'products:read',
    description: 'Read products (GET /api/products)',
    endpoints: ['/api/products'],
    methods: ['GET'],
  },
  'products:write': {
    scope: 'products:write',
    description: 'Create, update, delete products',
    endpoints: ['/api/products'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Categories
  'categories:read': {
    scope: 'categories:read',
    description: 'Read categories',
    endpoints: ['/api/categories'],
    methods: ['GET'],
  },
  'categories:write': {
    scope: 'categories:write',
    description: 'Create, update, delete categories',
    endpoints: ['/api/categories'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Brands
  'brands:read': {
    scope: 'brands:read',
    description: 'Read brands',
    endpoints: ['/api/brands'],
    methods: ['GET'],
  },
  'brands:write': {
    scope: 'brands:write',
    description: 'Create, update, delete brands',
    endpoints: ['/api/brands'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Cart
  'cart:read': {
    scope: 'cart:read',
    description: 'Read cart',
    endpoints: ['/api/cart'],
    methods: ['GET'],
  },
  'cart:write': {
    scope: 'cart:write',
    description: 'Modify cart (add, update, remove items)',
    endpoints: ['/api/cart'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Orders
  'orders:read': {
    scope: 'orders:read',
    description: 'Read orders',
    endpoints: ['/api/customer/orders', '/api/admin/orders'],
    methods: ['GET'],
  },
  'orders:write': {
    scope: 'orders:write',
    description: 'Create and update orders',
    endpoints: ['/api/customer/orders', '/api/admin/orders'],
    methods: ['POST', 'PUT'],
  },

  // Customers
  'customers:read': {
    scope: 'customers:read',
    description: 'Read customer data',
    endpoints: ['/api/customer', '/api/admin/customers'],
    methods: ['GET'],
  },
  'customers:write': {
    scope: 'customers:write',
    description: 'Create and update customer data',
    endpoints: ['/api/customer', '/api/admin/customers'],
    methods: ['POST', 'PUT'],
  },

  // Reviews
  'reviews:read': {
    scope: 'reviews:read',
    description: 'Read reviews',
    endpoints: ['/api/reviews'],
    methods: ['GET'],
  },
  'reviews:write': {
    scope: 'reviews:write',
    description: 'Create, update, delete reviews',
    endpoints: ['/api/reviews'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Promo codes
  'promo:read': {
    scope: 'promo:read',
    description: 'Read promo codes',
    endpoints: ['/api/promo'],
    methods: ['GET'],
  },
  'promo:write': {
    scope: 'promo:write',
    description: 'Create, update, delete promo codes',
    endpoints: ['/api/promo'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Loyalty
  'loyalty:read': {
    scope: 'loyalty:read',
    description: 'Read loyalty program data',
    endpoints: ['/api/loyalty'],
    methods: ['GET'],
  },
  'loyalty:write': {
    scope: 'loyalty:write',
    description: 'Modify loyalty points',
    endpoints: ['/api/loyalty'],
    methods: ['POST'],
  },

  // Homepage
  'homepage:read': {
    scope: 'homepage:read',
    description: 'Read homepage sections',
    endpoints: ['/api/homepage'],
    methods: ['GET'],
  },
  'homepage:write': {
    scope: 'homepage:write',
    description: 'Create, update, delete homepage sections',
    endpoints: ['/api/homepage'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Pages
  'pages:read': {
    scope: 'pages:read',
    description: 'Read pages',
    endpoints: ['/api/pages'],
    methods: ['GET'],
  },
  'pages:write': {
    scope: 'pages:write',
    description: 'Create, update, delete pages',
    endpoints: ['/api/pages'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Lookbook
  'lookbook:read': {
    scope: 'lookbook:read',
    description: 'Read lookbook',
    endpoints: ['/api/lookbook'],
    methods: ['GET'],
  },
  'lookbook:write': {
    scope: 'lookbook:write',
    description: 'Create, update, delete lookbook',
    endpoints: ['/api/lookbook'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Blog
  'blog:read': {
    scope: 'blog:read',
    description: 'Read blog posts',
    endpoints: ['/api/blog'],
    methods: ['GET'],
  },
  'blog:write': {
    scope: 'blog:write',
    description: 'Create, update, delete blog posts',
    endpoints: ['/api/blog'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Settings
  'settings:read': {
    scope: 'settings:read',
    description: 'Read settings',
    endpoints: ['/api/settings'],
    methods: ['GET'],
  },
  'settings:write': {
    scope: 'settings:write',
    description: 'Update settings',
    endpoints: ['/api/settings'],
    methods: ['PUT', 'POST'],
  },

  // Countries
  'countries:read': {
    scope: 'countries:read',
    description: 'Read countries',
    endpoints: ['/api/countries'],
    methods: ['GET'],
  },
  'countries:write': {
    scope: 'countries:write',
    description: 'Create, update, delete countries',
    endpoints: ['/api/countries'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Languages
  'languages:read': {
    scope: 'languages:read',
    description: 'Read languages',
    endpoints: ['/api/languages'],
    methods: ['GET'],
  },
  'languages:write': {
    scope: 'languages:write',
    description: 'Create, update, delete languages',
    endpoints: ['/api/languages'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Currency rates
  'currency-rates:read': {
    scope: 'currency-rates:read',
    description: 'Read currency rates',
    endpoints: ['/api/currency-rates'],
    methods: ['GET'],
  },
  'currency-rates:write': {
    scope: 'currency-rates:write',
    description: 'Update currency rates',
    endpoints: ['/api/currency-rates'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Payment gateways
  'payment-gateways:read': {
    scope: 'payment-gateways:read',
    description: 'Read payment gateways',
    endpoints: ['/api/payment-gateways'],
    methods: ['GET'],
  },
  'payment-gateways:write': {
    scope: 'payment-gateways:write',
    description: 'Create, update, delete payment gateways',
    endpoints: ['/api/payment-gateways'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Payment requests
  'payment-requests:read': {
    scope: 'payment-requests:read',
    description: 'Read payment requests',
    endpoints: ['/api/payment-requests'],
    methods: ['GET'],
  },
  'payment-requests:write': {
    scope: 'payment-requests:write',
    description: 'Update payment requests',
    endpoints: ['/api/payment-requests'],
    methods: ['PUT', 'POST'],
  },

  // Admin (full admin access)
  'admin:*': {
    scope: 'admin:*',
    description: 'Full admin access (all admin endpoints)',
    endpoints: ['/api/admin'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },

  // Reports
  'reports:read': {
    scope: 'reports:read',
    description: 'Read reports',
    endpoints: ['/api/admin/reports'],
    methods: ['GET'],
  },

  // Partner program
  'partner:read': {
    scope: 'partner:read',
    description: 'Read partner data',
    endpoints: ['/api/partner', '/api/admin/partners'],
    methods: ['GET'],
  },
  'partner:write': {
    scope: 'partner:write',
    description: 'Manage partner data',
    endpoints: ['/api/partner', '/api/admin/partners'],
    methods: ['POST', 'PUT'],
  },

  // Delivery tracking
  'delivery-tracking:read': {
    scope: 'delivery-tracking:read',
    description: 'Read delivery tracking data',
    endpoints: ['/api/delivery-tracking'],
    methods: ['GET'],
  },
  'delivery-tracking:write': {
    scope: 'delivery-tracking:write',
    description: 'Update delivery tracking',
    endpoints: ['/api/delivery-tracking'],
    methods: ['POST'],
  },

  // Messenger
  'messenger:read': {
    scope: 'messenger:read',
    description: 'Read messenger contacts',
    endpoints: ['/api/messenger'],
    methods: ['GET'],
  },
  'messenger:write': {
    scope: 'messenger:write',
    description: 'Manage messenger contacts',
    endpoints: ['/api/messenger'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Translations
  'translations:read': {
    scope: 'translations:read',
    description: 'Read translations',
    endpoints: ['/api/translations'],
    methods: ['GET'],
  },
  'translations:write': {
    scope: 'translations:write',
    description: 'Create, update, delete translations',
    endpoints: ['/api/translations'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Header
  'header:read': {
    scope: 'header:read',
    description: 'Read header settings',
    endpoints: ['/api/header'],
    methods: ['GET'],
  },
  'header:write': {
    scope: 'header:write',
    description: 'Update header settings',
    endpoints: ['/api/header'],
    methods: ['PUT', 'DELETE'],
  },

  // Footer
  'footer:read': {
    scope: 'footer:read',
    description: 'Read footer settings',
    endpoints: ['/api/footer'],
    methods: ['GET'],
  },
  'footer:write': {
    scope: 'footer:write',
    description: 'Create, update, delete footer settings',
    endpoints: ['/api/footer'],
    methods: ['POST', 'PUT', 'DELETE'],
  },

  // Backups
  'backups:read': {
    scope: 'backups:read',
    description: 'Read backups',
    endpoints: ['/api/backups'],
    methods: ['GET'],
  },
  'backups:write': {
    scope: 'backups:write',
    description: 'Create, restore, delete backups',
    endpoints: ['/api/backups'],
    methods: ['POST', 'DELETE'],
  },
};

/**
 * Check if API key has required scope for endpoint
 */
export function hasScope(
  scopes: ApiScope[],
  path: string,
  method: string
): boolean {
  // Empty scopes = full access
  if (scopes.length === 0) {
    return true;
  }

  // Check for admin:* scope (full access)
  if (scopes.includes('admin:*')) {
    return true;
  }

  // Normalize path (remove query params, trailing slashes)
  const normalizedPath = path.split('?')[0].replace(/\/$/, '');

  // Check each scope
  for (const scope of scopes) {
    const scopeDef = API_SCOPES[scope];
    if (!scopeDef) continue;

    // Check if path matches any endpoint pattern
    const pathMatches = scopeDef.endpoints.some((endpoint) => {
      // Exact match
      if (normalizedPath === endpoint) return true;
      // Path starts with endpoint (for nested routes)
      if (normalizedPath.startsWith(endpoint + '/')) return true;
      return false;
    });

    if (!pathMatches) continue;

    // Check if method matches
    if (scopeDef.methods.includes(method) || scopeDef.methods.includes('*')) {
      return true;
    }
  }

  return false;
}

/**
 * Get all available scopes
 */
export function getAllScopes(): ScopeDefinition[] {
  return Object.values(API_SCOPES);
}

/**
 * Get scopes grouped by resource
 */
export function getScopesByResource(): Record<string, ScopeDefinition[]> {
  const grouped: Record<string, ScopeDefinition[]> = {};

  for (const scopeDef of Object.values(API_SCOPES)) {
    const [resource] = scopeDef.scope.split(':');
    if (!grouped[resource]) {
      grouped[resource] = [];
    }
    grouped[resource].push(scopeDef);
  }

  return grouped;
}
