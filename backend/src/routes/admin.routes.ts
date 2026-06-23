import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { salesPointController } from '../controllers/sales-point.controller';
import { ticketController } from '../controllers/ticket.controller';
import { returnController } from '../controllers/return.controller';
import { onboardingController } from '../controllers/onboarding.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Onboarding (must be before other routes to avoid path conflicts)
router.get('/onboarding', onboardingController.getStatus.bind(onboardingController));
router.put('/onboarding', onboardingController.update.bind(onboardingController));
router.post('/onboarding/complete', onboardingController.complete.bind(onboardingController));
router.post('/onboarding/skip', onboardingController.skip.bind(onboardingController));
router.post('/onboarding/reset', onboardingController.reset.bind(onboardingController));

// Validation schemas
const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURN_REQUESTED', 'RETURNED']),
    notes: z.string().optional(),
  }),
});

const updateOrderPaymentStatusSchema = z.object({
  body: z.object({
    paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
    notes: z.string().optional(),
  }),
});

const addNoteSchema = z.object({
  body: z.object({
    content: z.string().min(1),
  }),
});

const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    type: z.enum(['MAIN', 'STORE', 'MARKETPLACE']).optional(),
    priority: z.number().int().min(-128).max(127).optional(),
  }),
});

const updateWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    type: z.enum(['MAIN', 'STORE', 'MARKETPLACE']).optional(),
    priority: z.number().int().min(-128).max(127).optional(),
  }),
});

const addInventorySchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().nonnegative(), // Allow 0 for out of stock
    reason: z.string().optional(),
    status: z.enum(['AWAITING_RECEIPT', 'RECEIVED', 'IN_SALE', 'COMING_SOON', 'RESERVED', 'IN_DELIVERY', 'DELIVERED', 'RETURNED', 'OUT_OF_STOCK']).optional(),
    palletId: z.string().uuid().optional(),
    // Admin-only: for reports (Delivery by Seller)
    documentNumber: z.string().optional(),
    documentDate: z.string().optional(),
    supplierName: z.string().optional(),
    supplierInn: z.string().optional(),
    supplierVatNumber: z.string().optional(),
    customsDeclarationId: z.string().uuid().optional(),
    purchasePrice: z.number().optional(),
    purchaseCurrency: z.string().optional(),
    receivedAt: z.string().optional(),
    batchNumber: z.string().optional(),
  }),
});

const transferInventorySchema = z.object({
  body: z.object({
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().positive(),
  }),
});

const createPalletSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    location: z.string().optional(),
    description: z.string().optional(),
  }),
});

const updateInventoryStatusSchema = z.object({
  body: z.object({
    status: z.enum(['AWAITING_RECEIPT', 'RECEIVED', 'IN_SALE', 'COMING_SOON', 'RESERVED', 'IN_DELIVERY', 'DELIVERED', 'RETURNED', 'OUT_OF_STOCK']),
  }),
});

const updateInventoryQuantitySchema = z.object({
  body: z.object({
    quantity: z.number().int().min(0),
    status: z.enum(['AWAITING_RECEIPT', 'RECEIVED', 'IN_SALE', 'COMING_SOON', 'RESERVED', 'IN_DELIVERY', 'DELIVERED', 'RETURNED', 'OUT_OF_STOCK']).optional(),
  }),
});

// Query validation for list endpoints
const listOrdersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.union([z.string().max(50), z.array(z.string().max(50))]).optional(),
    paymentStatus: z.string().max(50).optional(),
    search: z.string().max(500).optional(),
    dateFrom: z.string().max(50).optional(),
    dateTo: z.string().max(50).optional(),
    sortBy: z.enum(['createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    deliveryStage: z.string().max(50).optional(),
  }).optional(),
});
const listCustomersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(500).optional(),
    dateFrom: z.string().max(50).optional(),
    dateTo: z.string().max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional(),
});
const orderIdParamsSchema = z.object({
  params: z.object({ orderId: z.string().uuid() }),
});
const customerIdParamsSchema = z.object({
  params: z.object({ customerId: z.string().uuid() }),
});
const updateCustomerEmailSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});
const assignItemToPalletSchema = z.object({
  body: z.object({
    palletId: z.string().uuid().optional().nullable(),
  }),
});

const createInventoryItemsSchema = z.object({
  body: z.object({
    inventoryId: z.string().uuid(),
    quantity: z.number().int().positive(),
    palletId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
  }),
});

const createQRCodeSchema = z.object({
  body: z.object({
    inventoryItemId: z.string().uuid(),
    orderId: z.string().uuid().optional(),
  }),
});

const addTicketMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1),
  }),
});

const createTicketForCustomerSchema = z.object({
  body: z.object({
    orderId: z.string().uuid().optional().nullable(),
    userId: z.string().uuid(),
    subject: z.string().min(1),
    message: z.string().min(1),
  }),
});

const updateTicketStatusSchema = z.object({
  body: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  }),
});

const processReturnRequestSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED']),
    refundMethod: z.enum(['STRIPE', 'BANK_TRANSFER', 'MANUAL']).optional(),
    refundAmount: z.number().positive().optional(),
    adminNotes: z.string().optional(),
    items: z
      .array(
        z.object({
          returnRequestItemId: z.string().uuid(),
          itemStatus: z.enum(['WRITE_OFF', 'RETURN_TO_SALE']),
          warehouseId: z.string().uuid().optional(),
        })
      )
      .optional(),
  }),
});

// Dashboard
router.get('/dashboard', adminController.getDashboard.bind(adminController));
router.get('/warehouses/analytics', adminController.getWarehouseAnalytics.bind(adminController));

// Orders
router.get('/orders', validate(listOrdersQuerySchema), adminController.getAllOrders.bind(adminController));
router.get('/orders/:orderId', validate(orderIdParamsSchema), adminController.getOrderById.bind(adminController));
router.put(
  '/orders/:orderId/status',
  validate(updateOrderStatusSchema),
  adminController.updateOrderStatus.bind(adminController)
);
router.put(
  '/orders/:orderId/payment-status',
  validate(updateOrderPaymentStatusSchema),
  adminController.updateOrderPaymentStatus.bind(adminController)
);
router.put(
  '/orders/:orderId/items/:orderItemId/price',
  validate(z.object({
    body: z.object({
      price: z.number().positive(),
    }),
  })),
  adminController.updateOrderItemPrice.bind(adminController)
);
router.patch(
  '/orders/:orderId/delivery-info',
  adminController.updateOrderDeliveryInfo.bind(adminController)
);
router.patch(
  '/orders/:orderId/source-warehouse',
  validate(z.object({
    body: z.object({
      orderSource: z.enum(['STORE_ONLINE', 'STORE_OFFLINE', 'MARKETPLACE_WB', 'MARKETPLACE_OZON', 'MARKETPLACE_WILDBERRIES', 'MARKETPLACE_OTHER', 'MANUAL']).optional(),
      fulfillmentWarehouseId: z.string().uuid().nullable().optional(),
    }),
  })),
  adminController.updateOrderSourceAndWarehouse.bind(adminController)
);
router.get('/orders/:orderId/availability', adminController.getOrderAvailability.bind(adminController));
router.post(
  '/orders/:orderId/fulfill-from-warehouse',
  validate(z.object({
    body: z.object({
      warehouseId: z.string().uuid(),
    }),
  })),
  adminController.fulfillFromWarehouse.bind(adminController)
);

// Customers (CRM)
router.get('/customers', validate(listCustomersQuerySchema), adminController.getAllCustomers.bind(adminController));
router.get('/customers/:customerId', validate(customerIdParamsSchema), adminController.getCustomerDetails.bind(adminController));
router.put('/customers/:id', adminController.updateCustomer.bind(adminController));
router.post(
  '/customers/:customerId/update-email',
  validate(customerIdParamsSchema.merge(updateCustomerEmailSchema)),
  adminController.updateCustomerEmail.bind(adminController)
);
router.post(
  '/customers/:customerId/resend-verification',
  validate(customerIdParamsSchema),
  adminController.resendCustomerVerification.bind(adminController)
);
router.post(
  '/customers/:customerId/send-password-reset',
  validate(customerIdParamsSchema),
  adminController.sendCustomerPasswordReset.bind(adminController)
);
router.post(
  '/customers/:customerId/notes',
  validate(addNoteSchema),
  adminController.addCustomerNote.bind(adminController)
);
router.get('/customers/:customerId/notes', adminController.getCustomerNotes.bind(adminController));

// Sales Points
router.get('/sales-points', salesPointController.getAll.bind(salesPointController));
router.get('/sales-points/:id', salesPointController.getById.bind(salesPointController));
router.post(
  '/sales-points',
  validate(z.object({
    body: z.object({
      name: z.string().min(1),
      type: z.enum(['MARKETPLACE', 'STORE_OFFLINE']),
      warehouseId: z.string().uuid().optional().nullable(),
      externalId: z.string().optional().nullable(),
      settings: z.record(z.unknown()).optional().nullable(),
    }),
  })),
  salesPointController.create.bind(salesPointController)
);
router.patch(
  '/sales-points/:id',
  validate(z.object({
    body: z.object({
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
      warehouseId: z.string().uuid().optional().nullable(),
      externalId: z.string().optional().nullable(),
      settings: z.record(z.unknown()).optional().nullable(),
    }),
  })),
  salesPointController.update.bind(salesPointController)
);
router.delete('/sales-points/:id', salesPointController.delete.bind(salesPointController));
router.get('/sales-points/:id/products', salesPointController.getProducts.bind(salesPointController));
router.post(
  '/sales-points/:id/products',
  validate(z.object({
    body: z.object({
      productId: z.string().uuid(),
      variantId: z
        .union([z.string().uuid(), z.literal(''), z.literal('null')])
        .optional()
        .nullable()
        .transform((v) => (v === '' || v === 'null' ? null : v)),
      warehouseId: z
        .union([z.string().uuid(), z.literal(''), z.literal('null')])
        .optional()
        .nullable()
        .transform((v) => (v === '' || v === 'null' ? null : v)),
      maxQuantity: z.number().int().nonnegative().optional().nullable(),
    }),
  })),
  salesPointController.addProduct.bind(salesPointController)
);
router.delete('/sales-points/:id/products/:salesPointProductId', salesPointController.removeProduct.bind(salesPointController));
router.post(
  '/sales-points/:id/orders',
  validate(z.object({
    body: z.object({
      userId: z.string().uuid(),
      shippingAddressId: z.string().uuid(),
      items: z.array(z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
      })).min(1),
      notes: z.string().optional().nullable(),
    }),
  })),
  salesPointController.createOrder.bind(salesPointController)
);
router.patch(
  '/sales-points/:id/products/:salesPointProductId',
  validate(z.object({
    body: z.object({
      warehouseId: z.string().uuid().optional().nullable(),
      maxQuantity: z.number().int().nonnegative().optional().nullable(),
      isActive: z.boolean().optional(),
    }),
  })),
  salesPointController.updateProduct.bind(salesPointController)
);

// Warehouses
router.get('/warehouses', adminController.getAllWarehouses.bind(adminController));
router.get('/warehouses/:warehouseId', adminController.getWarehouseDetails.bind(adminController));
router.get('/warehouses/:warehouseId/inventory', adminController.getWarehouseInventory.bind(adminController));
router.post(
  '/warehouses',
  validate(createWarehouseSchema),
  adminController.createWarehouse.bind(adminController)
);
router.patch(
  '/warehouses/:warehouseId',
  validate(updateWarehouseSchema),
  adminController.updateWarehouse.bind(adminController)
);
router.delete('/warehouses/:warehouseId', adminController.deleteWarehouse.bind(adminController));
router.post(
  '/warehouses/:warehouseId/inventory',
  validate(addInventorySchema),
  adminController.addInventory.bind(adminController)
);
router.post(
  '/warehouses/transfer',
  validate(transferInventorySchema),
  adminController.transferInventory.bind(adminController)
);

// Pallets
router.post(
  '/warehouses/:warehouseId/pallets',
  validate(createPalletSchema),
  adminController.createPallet.bind(adminController)
);
router.get('/warehouses/:warehouseId/pallets', adminController.getWarehousePallets.bind(adminController));

// Inventory Status Management
router.put(
  '/inventory/:inventoryId/status',
  validate(updateInventoryStatusSchema),
  adminController.updateInventoryStatus.bind(adminController)
);
router.put(
  '/inventory/:inventoryId/quantity',
  validate(updateInventoryQuantitySchema),
  adminController.updateInventoryQuantity.bind(adminController)
);
router.post(
  '/inventory/reset-all',
  authorize('SUPER_ADMIN'), // Only SUPER_ADMIN can reset all inventory
  adminController.resetAllInventory.bind(adminController)
);
router.post(
  '/orders/reset-all',
  authorize('SUPER_ADMIN'), // Only SUPER_ADMIN can reset all orders, tickets, and payments
  adminController.resetOrdersTicketsPayments.bind(adminController)
);
router.post(
  '/reset-all',
  authorize('SUPER_ADMIN'), // Only SUPER_ADMIN can reset everything
  adminController.resetAll.bind(adminController)
);
router.put(
  '/inventory-items/:itemId/pallet',
  validate(assignItemToPalletSchema),
  adminController.assignItemToPallet.bind(adminController)
);
router.post(
  '/inventory-items',
  validate(createInventoryItemsSchema),
  adminController.createInventoryItems.bind(adminController)
);
router.put(
  '/inventory-items/:itemId/status',
  validate(updateInventoryStatusSchema),
  adminController.updateInventoryItemStatus.bind(adminController)
);

// QR Codes
router.post(
  '/qr-codes',
  validate(createQRCodeSchema),
  adminController.createDeliveryQRCode.bind(adminController)
);
router.put('/qr-codes/:qrCodeId/used', adminController.markQRCodeAsUsed.bind(adminController));

// Order Inventory Items & Warehouse & Multi-channel
router.get('/orders/:orderId/inventory-items', adminController.getOrderInventoryItems.bind(adminController));
router.get('/orders/:orderId/warehouse', adminController.getOrderWarehouse.bind(adminController));

// Support Tickets
router.get('/tickets', ticketController.getAllTickets.bind(ticketController));
router.get('/tickets/stats', ticketController.getTicketStats.bind(ticketController));
router.get('/tickets/:ticketId', ticketController.getTicketDetails.bind(ticketController));
router.post(
  '/tickets/create',
  validate(createTicketForCustomerSchema),
  ticketController.createTicketForCustomer.bind(ticketController)
);
router.post('/tickets/:ticketId/assign', ticketController.assignTicket.bind(ticketController));
router.post(
  '/tickets/:ticketId/messages',
  validate(addTicketMessageSchema),
  ticketController.addAdminMessage.bind(ticketController)
);
router.put(
  '/tickets/:ticketId/status',
  validate(updateTicketStatusSchema),
  ticketController.updateTicketStatus.bind(ticketController)
);

// Return Requests routes
router.get('/returns', returnController.getAllReturnRequests.bind(returnController));
router.get('/returns/:returnRequestId', returnController.getReturnRequest.bind(returnController));
router.put(
  '/returns/:returnRequestId/process',
  validate(processReturnRequestSchema),
  returnController.processReturnRequest.bind(returnController)
);

export default router;
