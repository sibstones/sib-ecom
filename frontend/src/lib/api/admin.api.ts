import { apiClient } from './client';
import { normalizeUploadFile, normalizeUploadFiles } from '$lib/utils/file-upload';
import type { Order, CustomerAddress } from './customer.api';
import type { Product, ProductVariant } from './product.api';
import type { Lookbook } from './lookbook.api';
import type { HomepageSection } from './homepage.api';

export interface OrderWithUser extends Order {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface DashboardStats {
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    totalProducts: number;
    pendingOrders: number;
    openTickets?: number;
    inProgressTickets?: number;
    pendingPaymentRequests?: number;
    pendingReturns?: number;
  };
  recentOrders: OrderWithUser[];
}

export interface CustomerDetails {
  customer: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    emailVerified?: boolean;
    passwordLoginAvailable?: boolean;
    createdAt: string;
  };
  orders: Order[];
  addresses: CustomerAddress[];
}

export type InventoryStatus =
  | 'AWAITING_RECEIPT' // Awaiting receipt on the warehouse
  | 'RECEIVED' // Received on the warehouse
  | 'IN_SALE' // In sale
  | 'COMING_SOON' // Coming soon
  | 'RESERVED' // Reserved for an order
  | 'IN_DELIVERY' // In delivery to the customer
  | 'DELIVERED' // Delivered to the customer
  | 'RETURNED' // Returned
  | 'OUT_OF_STOCK'; // Out of stock

export type WarehouseType = 'MAIN' | 'STORE' | 'MARKETPLACE';

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  type?: WarehouseType;
  priority?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    inventory: number;
    pallets?: number;
  };
  pallets?: Pallet[];
}

export interface SalesPoint {
  id: string;
  name: string;
  type: 'MARKETPLACE' | 'STORE_OFFLINE';
  isActive: boolean;
  warehouseId?: string | null;
  externalId?: string | null;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    country?: string;
  } | null;
  _count?: { products: number; orders: number };
}

export interface SalesPointDetail extends SalesPoint {
  products: SalesPointProduct[];
}

export interface SalesPointProduct {
  id: string;
  salesPointId: string;
  productId: string;
  variantId?: string | null;
  warehouseId?: string | null;
  maxQuantity?: number | null;
  isActive: boolean;
  product?: { id: string; name: string; sku: string; images?: Array<{ url: string }> };
  variant?: { id: string; name: string; sku: string; size?: string | null } | null;
  warehouse?: { id: string; name: string } | null;
}

export interface Pallet {
  id: string;
  warehouseId: string;
  code: string;
  location?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

export interface InventoryItem {
  id: string;
  productId: string;
  variantId?: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    images?: Array<{ url: string }>;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
    size?: string | null;
  };
  items?: InventoryItemDetail[];
}

export interface InventoryItemDetail {
  id: string;
  inventoryId: string;
  palletId?: string;
  orderId?: string;
  quantity: number;
  status: InventoryStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  inventory?: {
    id: string;
    warehouseId: string;
    warehouse?: {
      id: string;
      name: string;
      address?: string | null;
      city?: string | null;
      country?: string | null;
    };
    product?: { id: string; name: string; sku: string };
    variant?: { id: string; name: string; sku: string; size?: string | null };
  };
  pallet?: {
    id: string;
    code: string;
    location?: string;
  };
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
  };
  qrCodes?: DeliveryQRCode[];
}

export interface DeliveryQRCode {
  id: string;
  inventoryItemId: string;
  orderId?: string;
  code: string;
  qrImageUrl?: string;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
  inventoryItem?: InventoryItemDetail;
  order?: {
    id: string;
    orderNumber: string;
  };
}

export interface ProductImportRowResult {
  row: number;
  sku?: string;
  name?: string;
  status: 'created' | 'created_with_warnings' | 'skipped' | 'failed';
  messageKey:
    | 'productImport.emptyRowSkipped'
    | 'productImport.productCreated'
    | 'productImport.productCreatedMissingImages'
    | 'productImport.fieldRequired'
    | 'productImport.priceRequiredUnlessPriceOnRequest'
    | 'productImport.referenceNotFound'
    | 'productImport.importFailed';
  messageParams?: Record<string, string | number>;
  message: string;
}

export interface ProductImportResult {
  totalRows: number;
  created: number;
  warnings: number;
  failed: number;
  skipped: number;
  rows: ProductImportRowResult[];
}

export const adminApi = {
  // Dashboard
  getDashboard: () => apiClient.get<DashboardStats>('/admin/dashboard'),
  getWarehouseAnalytics: () =>
    apiClient.get<{
      totalStock: number;
      awaitingPayment: number;
      paid: number;
      returned: number;
      currentStock: number;
    }>('/admin/warehouses/analytics'),

  // Orders
  getAllOrders: (
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: string;
      statusIn?: string[];
      paymentStatus?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      sortOrder?: 'asc' | 'desc';
      deliveryStage?:
        | 'NO_TRACKING'
        | 'IN_TRANSIT'
        | 'AWAITING_PICKUP'
        | 'AWAITING_PICKUP_OVER_7_DAYS';
    }
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.statusIn && filters.statusIn.length > 0) {
      filters.statusIn.forEach((s) => params.append('status', s));
    } else if (filters?.status) {
      params.append('status', filters.status);
    }
    if (filters?.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.sortOrder) {
      params.append('sortBy', 'createdAt');
      params.append('sortOrder', filters.sortOrder);
    }
    if (filters?.deliveryStage) params.append('deliveryStage', filters.deliveryStage);

    return apiClient.get<{
      orders: Order[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/admin/orders?${params.toString()}`);
  },
  getOrderById: (orderId: string) => apiClient.get<{ order: Order }>(`/admin/orders/${orderId}`),
  updateOrderStatus: (orderId: string, status: string, notes?: string) =>
    apiClient.put<{ order: Order }>(`/admin/orders/${orderId}/status`, { status, notes }),
  updateOrderPaymentStatus: (orderId: string, paymentStatus: string, notes?: string) =>
    apiClient.put<{ order: Order }>(`/admin/orders/${orderId}/payment-status`, {
      paymentStatus,
      notes,
    }),
  updateOrderItemPrice: (orderId: string, orderItemId: string, price: number) =>
    apiClient.put<{ order: Order }>(`/admin/orders/${orderId}/items/${orderItemId}/price`, {
      price,
    }),
  updateOrderDeliveryInfo: (
    orderId: string,
    data: {
      invoiceNumber?: string | null;
      invoiceDate?: string | null;
      shippedAt?: string | null;
      deliveryMethod?: string | null;
      carrierName?: string | null;
      waybillNumber?: string | null;
      waybillDate?: string | null;
      trackingNumber?: string | null;
      customsDeclarationNumber?: string | null;
    }
  ) => apiClient.patch<{ order: Order }>(`/admin/orders/${orderId}/delivery-info`, data),

  // Customers
  getAllCustomers: (
    page: number = 1,
    limit: number = 20,
    filters?: {
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
    if (filters?.search) params.append('search', filters.search);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    return apiClient.get<{
      customers: Array<{
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        createdAt: string;
        _count: { orders: number };
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/admin/customers?${params.toString()}`);
  },
  getCustomerDetails: (customerId: string) =>
    apiClient.get<CustomerDetails>(`/admin/customers/${customerId}`),
  updateCustomerEmail: (customerId: string, email: string) =>
    apiClient.post<{ customer: CustomerDetails['customer']; message: string }>(
      `/admin/customers/${customerId}/update-email`,
      { email }
    ),
  resendCustomerVerification: (customerId: string) =>
    apiClient.post<{ message: string }>(`/admin/customers/${customerId}/resend-verification`),
  sendCustomerPasswordReset: (customerId: string) =>
    apiClient.post<{ message: string }>(`/admin/customers/${customerId}/send-password-reset`),
  addCustomerNote: (customerId: string, content: string) =>
    apiClient.post<{ note: { id: string; content: string; createdAt: string } }>(
      `/admin/customers/${customerId}/notes`,
      { content }
    ),
  getCustomerNotes: (customerId: string) =>
    apiClient.get<{ notes: Array<{ id: string; content: string; createdAt: string }> }>(
      `/admin/customers/${customerId}/notes`
    ),

  // Warehouses
  getAllWarehouses: () => apiClient.get<{ warehouses: Warehouse[] }>('/admin/warehouses'),
  getWarehouseDetails: (warehouseId: string) =>
    apiClient.get<{ warehouse: Warehouse }>(`/admin/warehouses/${warehouseId}`),

  // Sales Points
  getAllSalesPoints: () => apiClient.get<{ salesPoints: SalesPoint[] }>('/admin/sales-points'),
  getSalesPointById: (id: string) =>
    apiClient.get<{ salesPoint: SalesPointDetail }>(`/admin/sales-points/${id}`),
  createSalesPoint: (data: {
    name: string;
    type: string;
    warehouseId?: string | null;
    externalId?: string | null;
  }) => apiClient.post<{ salesPoint: SalesPoint }>('/admin/sales-points', data),
  updateSalesPoint: (
    id: string,
    data: {
      name?: string;
      isActive?: boolean;
      warehouseId?: string | null;
      externalId?: string | null;
    }
  ) => apiClient.patch<{ salesPoint: SalesPoint }>(`/admin/sales-points/${id}`, data),
  deleteSalesPoint: (id: string) =>
    apiClient.delete<{ message: string }>(`/admin/sales-points/${id}`),
  getSalesPointProducts: (id: string) =>
    apiClient.get<{ products: SalesPointProduct[] }>(`/admin/sales-points/${id}/products`),
  addSalesPointProduct: (
    id: string,
    data: {
      productId: string;
      variantId?: string | null;
      warehouseId?: string | null;
      maxQuantity?: number | null;
    }
  ) =>
    apiClient.post<{ salesPointProduct: SalesPointProduct }>(
      `/admin/sales-points/${id}/products`,
      data
    ),
  removeSalesPointProduct: (id: string, salesPointProductId: string) =>
    apiClient.delete<{ message: string }>(
      `/admin/sales-points/${id}/products/${salesPointProductId}`
    ),
  createOrderFromSalesPoint: (
    salesPointId: string,
    data: {
      userId: string;
      shippingAddressId: string;
      items: Array<{
        productId: string;
        variantId?: string | null;
        quantity: number;
        price: number;
      }>;
      notes?: string | null;
    }
  ) =>
    apiClient.post<{ order: { id: string; orderNumber: string } }>(
      `/admin/sales-points/${salesPointId}/orders`,
      data
    ),
  getWarehouseInventory: (
    warehouseId: string,
    filters?: { status?: InventoryStatus; search?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString();
    return apiClient.get<{ inventory: InventoryItem[] }>(
      `/admin/warehouses/${warehouseId}/inventory${query ? `?${query}` : ''}`
    );
  },
  createWarehouse: (data: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    type?: WarehouseType;
    priority?: number;
  }) => apiClient.post<{ warehouse: Warehouse }>('/admin/warehouses', data),
  updateWarehouse: (
    warehouseId: string,
    data: {
      name?: string;
      address?: string;
      city?: string;
      country?: string;
      type?: WarehouseType;
      priority?: number;
    }
  ) => apiClient.patch<{ warehouse: Warehouse }>(`/admin/warehouses/${warehouseId}`, data),
  deleteWarehouse: (warehouseId: string) =>
    apiClient.delete<{ message: string }>(`/admin/warehouses/${warehouseId}`),
  addInventory: (
    warehouseId: string,
    data: {
      productId: string;
      variantId?: string;
      quantity: number;
      reason?: string;
      status?: InventoryStatus;
      palletId?: string;
      documentNumber?: string;
      documentDate?: string;
      supplierName?: string;
      supplierInn?: string;
      supplierVatNumber?: string;
      customsDeclarationId?: string;
      purchasePrice?: number;
      purchaseCurrency?: string;
      receivedAt?: string;
      batchNumber?: string;
    }
  ) =>
    apiClient.post<{ inventory: InventoryItem }>(
      `/admin/warehouses/${warehouseId}/inventory`,
      data
    ),
  transferInventory: (data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    productId: string;
    variantId?: string;
    quantity: number;
  }) => apiClient.post<{ message: string }>('/admin/warehouses/transfer', data),

  // Pallets
  createPallet: (
    warehouseId: string,
    data: { code: string; location?: string; description?: string }
  ) => apiClient.post<{ pallet: Pallet }>(`/admin/warehouses/${warehouseId}/pallets`, data),
  getWarehousePallets: (warehouseId: string) =>
    apiClient.get<{ pallets: Pallet[] }>(`/admin/warehouses/${warehouseId}/pallets`),

  // Inventory Status Management
  updateInventoryStatus: (inventoryId: string, status: InventoryStatus) =>
    apiClient.put<{ inventory: InventoryItem }>(`/admin/inventory/${inventoryId}/status`, {
      status,
    }),
  updateInventoryQuantity: (inventoryId: string, quantity: number, status?: InventoryStatus) =>
    apiClient.put<{ inventory: InventoryItem }>(`/admin/inventory/${inventoryId}/quantity`, {
      quantity,
      status,
    }),
  resetAllInventory: () =>
    apiClient.post<{ updatedCount: number; message: string }>('/admin/inventory/reset-all'),
  resetOrdersTicketsPayments: () =>
    apiClient.post<{
      orders: number;
      orderItems: number;
      orderStatusHistory: number;
      paymentRequests: number;
      supportTickets: number;
      ticketMessages: number;
      deliveryQRCodes: number;
      inventoryItems: number;
      message: string;
    }>('/admin/orders/reset-all'),
  resetAll: () =>
    apiClient.post<{
      inventory: { resetCount: number };
      orders: number;
      orderItems: number;
      orderStatusHistory: number;
      paymentRequests: number;
      supportTickets: number;
      ticketMessages: number;
      deliveryQRCodes: number;
      inventoryItems: number;
      message: string;
    }>('/admin/reset-all'),
  assignItemToPallet: (itemId: string, palletId: string | null) =>
    apiClient.put<{ item: InventoryItemDetail }>(`/admin/inventory-items/${itemId}/pallet`, {
      palletId,
    }),
  createInventoryItems: (data: {
    inventoryId: string;
    quantity: number;
    palletId?: string;
    orderId?: string;
  }) => apiClient.post<{ items: InventoryItemDetail[] }>('/admin/inventory-items', data),
  updateInventoryItemStatus: (itemId: string, status: InventoryStatus) =>
    apiClient.put<{ item: InventoryItemDetail }>(`/admin/inventory-items/${itemId}/status`, {
      status,
    }),

  // QR Codes
  createDeliveryQRCode: (data: { inventoryItemId: string; orderId?: string }) =>
    apiClient.post<{ qrCode: DeliveryQRCode }>('/admin/qr-codes', data),
  markQRCodeAsUsed: (qrCodeId: string) =>
    apiClient.put<{ qrCode: DeliveryQRCode }>(`/admin/qr-codes/${qrCodeId}/used`),

  // Order Inventory Items & Warehouse
  getOrderInventoryItems: (orderId: string) =>
    apiClient.get<{ items: InventoryItemDetail[] }>(`/admin/orders/${orderId}/inventory-items`),
  getOrderWarehouse: (orderId: string) =>
    apiClient.get<{
      warehouse: {
        id: string;
        name: string;
        address?: string | null;
        city?: string | null;
        country?: string | null;
      } | null;
    }>(`/admin/orders/${orderId}/warehouse`),

  // Multi-channel: order source & fulfillment
  updateOrderSourceAndWarehouse: (
    orderId: string,
    data: { orderSource?: string; fulfillmentWarehouseId?: string | null }
  ) => apiClient.patch<{ order: OrderWithUser }>(`/admin/orders/${orderId}/source-warehouse`, data),
  getOrderAvailability: (orderId: string) =>
    apiClient.get<{
      items: Array<{
        orderItemId: string;
        productId: string;
        variantId: string | null;
        size: string | null;
        productName: string;
        quantityNeeded: number;
        warehouses: Array<{
          warehouseId: string;
          warehouseName: string;
          available: number;
          inventoryId: string;
        }>;
      }>;
    }>(`/admin/orders/${orderId}/availability`),
  fulfillFromWarehouse: (orderId: string, warehouseId: string) =>
    apiClient.post<{
      created: Array<{ inventoryId: string; orderItemId: string; quantity: number }>;
      items: InventoryItemDetail[];
    }>(`/admin/orders/${orderId}/fulfill-from-warehouse`, { warehouseId }),

  // Products (reuse from product.api but with admin endpoints)
  getAllProducts: (
    page: number = 1,
    limit: number = 20,
    search?: string,
    isActive?: boolean | null,
    sort?: { sortBy?: 'createdAt' | 'name' | 'price'; sortOrder?: 'asc' | 'desc' },
    dateRange?: { dateFrom?: string; dateTo?: string }
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    if (isActive !== undefined && isActive !== null) {
      params.append('isActive', isActive.toString());
    }
    if (sort?.sortBy) params.append('sortBy', sort.sortBy);
    if (sort?.sortOrder) params.append('sortOrder', sort.sortOrder);
    if (dateRange?.dateFrom) params.append('dateFrom', dateRange.dateFrom);
    if (dateRange?.dateTo) params.append('dateTo', dateRange.dateTo);
    return apiClient.get<{
      products: Product[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/products?${params.toString()}`);
  },
  createProduct: (data: any) => apiClient.post<{ product: Product }>('/products', data),
  updateProduct: (id: string, data: any) =>
    apiClient.put<{ product: Product }>(`/products/admin/${id}`, data),
  deleteProduct: (id: string) => apiClient.delete<{ message: string }>(`/products/admin/${id}`),
  uploadProductImage: (file: File, productId: string, alt?: string, order?: number) => {
    const formData = new FormData();
    const normalizedFile = normalizeUploadFile(file);
    formData.append('file', normalizedFile);
    formData.append('productId', productId);
    if (alt) formData.append('alt', alt);
    if (order !== undefined) formData.append('order', order.toString());

    return apiClient.post('/products/images', formData);
  },
  uploadMultipleProductImages: (files: File[], productId: string) => {
    const formData = new FormData();
    normalizeUploadFiles(files).forEach((file) => formData.append('files', file));
    formData.append('productId', productId);

    return apiClient.post('/products/images/multiple', formData);
  },
  importProducts: (archive: File) => {
    const formData = new FormData();
    formData.append('file', normalizeUploadFile(archive));
    return apiClient.post<ProductImportResult>('/products/import', formData);
  },
  deleteProductImage: (imageId: string) =>
    apiClient.delete<{ message: string }>(`/products/images/${imageId}`),
  reorderProductImages: (productId: string, imageOrders: { id: string; order: number }[]) =>
    apiClient.post<{ message: string }>(`/products/${productId}/images/reorder`, { imageOrders }),
  addProductVariant: (data: {
    productId: string;
    name: string;
    sku: string;
    price?: number;
    size?: string;
    showOnProduct?: boolean;
  }) => apiClient.post<{ variant: ProductVariant }>('/products/variants', data),
  updateProductVariant: (
    variantId: string,
    data: { name?: string; sku?: string; price?: number; size?: string; showOnProduct?: boolean }
  ) => apiClient.put<{ variant: ProductVariant }>(`/products/variants/${variantId}`, data),
  deleteProductVariant: (variantId: string) =>
    apiClient.delete<{ message: string }>(`/products/variants/${variantId}`),

  // Lookbook (reuse from lookbook.api but with admin endpoints)
  getAllLookbooks: () => apiClient.get<{ lookbooks: Lookbook[] }>('/lookbook'),
  createLookbook: (data: any) => apiClient.post<{ lookbook: Lookbook }>('/lookbook', data),
  updateLookbook: (id: string, data: any) =>
    apiClient.put<{ lookbook: Lookbook }>(`/lookbook/admin/${id}`, data),
  deleteLookbook: (id: string) => apiClient.delete<{ message: string }>(`/lookbook/admin/${id}`),
  uploadLookbookImage: (file: File, lookbookId: string, alt?: string, order?: number) => {
    const formData = new FormData();
    const normalizedFile = normalizeUploadFile(file);
    formData.append('file', normalizedFile);
    formData.append('lookbookId', lookbookId);
    if (alt) formData.append('alt', alt);
    if (order !== undefined) formData.append('order', order.toString());

    return apiClient.post('/lookbook/images', formData);
  },
  uploadMultipleLookbookImages: (files: File[], lookbookId: string) => {
    const formData = new FormData();
    normalizeUploadFiles(files).forEach((file) => {
      formData.append('files', file);
    });
    formData.append('lookbookId', lookbookId);

    return apiClient.post('/lookbook/images/multiple', formData);
  },

  // Homepage (reuse from homepage.api but with admin endpoints)
  getAllHomepageSections: () => apiClient.get<{ sections: HomepageSection[] }>('/homepage'),
  getHomepageSectionById: (id: string) =>
    apiClient.get<{ section: HomepageSection }>(`/homepage/admin/${id}`),
  createHomepageSection: (data: any) =>
    apiClient.post<{ section: HomepageSection }>('/homepage', data),
  updateHomepageSection: (id: string, data: any) =>
    apiClient.put<{ section: HomepageSection }>(`/homepage/admin/${id}`, data),
  deleteHomepageSection: (id: string) =>
    apiClient.delete<{ message: string }>(`/homepage/admin/${id}`),
  reorderHomepageSections: (sectionOrders: { id: string; order: number }[]) =>
    apiClient.post<{ message: string }>('/homepage/reorder', { sectionOrders }),
  uploadFile: (file: File, folder: string = 'homepage') => {
    const formData = new FormData();
    formData.append('file', normalizeUploadFile(file));
    formData.append('folder', folder);

    return apiClient.post<any>('/products/images', formData).then((data) => {
      // Return just the URL
      return { url: data.image?.url || data.url };
    });
  },

  // Pages
  getAllPages: () => apiClient.get<{ pages: any[] }>('/pages'),
  getPageById: (id: string) => apiClient.get<{ page: any }>(`/pages/admin/${id}`),
  createPage: (data: any) => apiClient.post<{ page: any }>('/pages', data),
  updatePage: (id: string, data: any) => apiClient.put<{ page: any }>(`/pages/admin/${id}`, data),
  deletePage: (id: string) => apiClient.delete<{ message: string }>(`/pages/admin/${id}`),

  // Footer
  getFooter: () => apiClient.get<{ footer: any }>('/footer'),
  getFooterById: (id: string) => apiClient.get<{ footer: any }>(`/footer/${id}`),
  createFooter: (data: any) => apiClient.post<{ footer: any }>('/footer', data),
  updateFooter: (id: string, data: any) => apiClient.put<{ footer: any }>(`/footer/${id}`, data),
  deleteFooter: (id: string) => apiClient.delete<{ message: string }>(`/footer/${id}`),

  // Accounting (charts, templates, entries)
  accounting: {
    getConstants: () =>
      apiClient.get<{ regions: string[]; triggerEvents: string[]; accountTypes: string[] }>(
        '/admin/accounting/constants'
      ),
    listCharts: (region?: string) =>
      apiClient.get<{ charts: any[] }>(
        '/admin/accounting/charts' + (region ? `?region=${region}` : '')
      ),
    getChartById: (id: string) => apiClient.get<any>('/admin/accounting/charts/' + id),
    createChart: (data: { region: string; name: string }) =>
      apiClient.post<any>('/admin/accounting/charts', data),
    updateChart: (id: string, data: any) =>
      apiClient.patch<any>('/admin/accounting/charts/' + id, data),
    deleteChart: (id: string) => apiClient.delete('/admin/accounting/charts/' + id),
    addChartItem: (chartId: string, data: { code: string; name: string; type: string }) =>
      apiClient.post<any>('/admin/accounting/charts/' + chartId + '/items', data),
    updateChartItem: (id: string, data: any) =>
      apiClient.patch<any>('/admin/accounting/chart-items/' + id, data),
    deleteChartItem: (id: string) => apiClient.delete('/admin/accounting/chart-items/' + id),
    listTemplates: (region?: string, legalRegime?: string) => {
      const params = new URLSearchParams();
      if (region) params.set('region', region);
      if (legalRegime) params.set('legalRegime', legalRegime);
      return apiClient.get<{ templates: any[] }>(
        '/admin/accounting/templates' + (params.toString() ? '?' + params : '')
      );
    },
    getTemplateById: (id: string) => apiClient.get<any>('/admin/accounting/templates/' + id),
    createTemplate: (data: any) => apiClient.post<any>('/admin/accounting/templates', data),
    updateTemplate: (id: string, data: any) =>
      apiClient.patch<any>('/admin/accounting/templates/' + id, data),
    deleteTemplate: (id: string) => apiClient.delete('/admin/accounting/templates/' + id),
    listEntries: (params?: { startDate?: string; endDate?: string; region?: string }) => {
      const q = new URLSearchParams();
      if (params?.startDate) q.set('startDate', params.startDate);
      if (params?.endDate) q.set('endDate', params.endDate);
      if (params?.region) q.set('region', params.region);
      return apiClient.get<{ items: any[]; total: number }>(
        '/admin/accounting/entries' + (q.toString() ? '?' + q : '')
      );
    },
    getExportEntriesUrl: (params?: { startDate?: string; endDate?: string; region?: string }) => {
      const q = new URLSearchParams();
      if (params?.startDate) q.set('startDate', params.startDate);
      if (params?.endDate) q.set('endDate', params.endDate);
      if (params?.region) q.set('region', params.region ?? 'RU');
      return '/api/admin/accounting/entries/export?' + q.toString();
    },
    generateEntries: (data: {
      startDate: string;
      endDate: string;
      region?: string;
      legalRegime?: string;
    }) =>
      apiClient.post<{ generated: number; entryIds?: string[] }>(
        '/admin/accounting/entries/generate',
        data
      ),
  },

  // Reports (use apiClient so Bearer token is sent; raw fetch was returning 401)
  reports: {
    getSales: (startDate: string, endDate: string) =>
      apiClient.get<{ report: any }>(
        `/admin/reports/sales?startDate=${startDate}&endDate=${endDate}`
      ),
    getCustomers: () => apiClient.get<{ report: any[] }>('/admin/reports/customers'),
    getPurchases: (startDate: string, endDate: string) =>
      apiClient.get<{ report: any }>(
        `/admin/reports/purchases?startDate=${startDate}&endDate=${endDate}`
      ),
    getDelivery: (startDate: string, endDate: string) =>
      apiClient.get<{ report: any }>(
        `/admin/reports/delivery?startDate=${startDate}&endDate=${endDate}`
      ),
    getCustoms: (startDate: string, endDate: string) =>
      apiClient.get<{ report: any }>(
        `/admin/reports/customs?startDate=${startDate}&endDate=${endDate}`
      ),
    getTaxSummary: (startDate: string, endDate: string, region: string) =>
      apiClient.get<{ report: any }>(
        `/admin/reports/tax-summary?startDate=${startDate}&endDate=${endDate}&region=${region}`
      ),
  },

  // License
  get: (endpoint: string) => apiClient.get(endpoint),
  post: (endpoint: string, data?: any) => apiClient.post(endpoint, data),
};
