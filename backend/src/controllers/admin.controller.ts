import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { OrderStatus, PaymentStatus, InventoryStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

export class AdminController {
  async getDashboard(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats();
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedStats = {
        ...stats,
        stats: {
          ...stats.stats,
          totalRevenue: Number(stats.stats.totalRevenue),
        },
        recentOrders: stats.recentOrders.map((order) => ({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          shipping: Number(order.shipping),
          total: Number(order.total),
          items: (order as any).items?.map((item: any) => ({
            ...item,
            price: item.price ? Number(item.price) : null,
          })) || [],
        })),
      };
      
      res.json(serializedStats);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get dashboard stats',
      });
    }
  }

  async getWarehouseAnalytics(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const analytics = await adminService.getWarehouseAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get warehouse analytics',
      });
    }
  }

  // Orders
  async getAllOrders(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters: {
        status?: OrderStatus;
        statusIn?: OrderStatus[];
        paymentStatus?: PaymentStatus;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        sortBy?: 'createdAt';
        sortOrder?: 'asc' | 'desc';
        deliveryStage?: 'NO_TRACKING' | 'IN_TRANSIT' | 'AWAITING_PICKUP' | 'AWAITING_PICKUP_OVER_7_DAYS';
      } = {};

      const deliveryStageValues = ['NO_TRACKING', 'IN_TRANSIT', 'AWAITING_PICKUP', 'AWAITING_PICKUP_OVER_7_DAYS'] as const;
      const statusParam = req.query.status;
      if (Array.isArray(statusParam)) {
        (filters as any).statusIn = statusParam.filter((s): s is OrderStatus => typeof s === 'string') as OrderStatus[];
      } else if (statusParam) {
        filters.status = statusParam as OrderStatus;
      }
      if (req.query.paymentStatus) filters.paymentStatus = req.query.paymentStatus as PaymentStatus;
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom as string;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo as string;
      if (req.query.sortBy === 'createdAt') filters.sortBy = 'createdAt';
      if (req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc') filters.sortOrder = req.query.sortOrder as 'asc' | 'desc';
      if (req.query.deliveryStage && deliveryStageValues.includes(req.query.deliveryStage as typeof deliveryStageValues[number])) {
        filters.deliveryStage = req.query.deliveryStage as typeof deliveryStageValues[number];
      }

      const result = await adminService.getAllOrders(page, limit, filters);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedResult = {
        ...result,
        orders: result.orders.map((order) => ({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          shipping: Number(order.shipping),
          total: Number(order.total),
          items: order.items?.map((item) => ({
            ...item,
            price: Number(item.price),
          })) || [],
        })),
      };
      
      res.json(serializedResult);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get orders',
      });
    }
  }

  async updateOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;
      const order = await adminService.updateOrderStatus(orderId, status, notes);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
      };
      
      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update order status',
      });
    }
  }

  async updateOrderDeliveryInfo(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const body = req.body as Record<string, unknown>;
      const data = {
        invoiceNumber: body.invoiceNumber as string | null | undefined,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate as string) : undefined,
        shippedAt: body.shippedAt ? new Date(body.shippedAt as string) : body.shippedAt === null ? null : undefined,
        deliveryMethod: body.deliveryMethod as string | null | undefined,
        carrierName: body.carrierName as string | null | undefined,
        waybillNumber: body.waybillNumber as string | null | undefined,
        waybillDate: body.waybillDate ? new Date(body.waybillDate as string) : body.waybillDate === null ? null : undefined,
        trackingNumber: body.trackingNumber as string | null | undefined,
        customsDeclarationNumber: body.customsDeclarationNumber as string | null | undefined,
      };
      const order = await adminService.updateOrderDeliveryInfo(orderId, data);
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        items: order.items?.map((item) => ({ ...item, price: item.price ? Number(item.price) : null })) || [],
      };
      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update order delivery info',
      });
    }
  }

  async updateOrderPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { paymentStatus, notes } = req.body;
      const order = await adminService.updateOrderPaymentStatus(orderId, paymentStatus, notes);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
      };
      
      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update payment status',
      });
    }
  }

  async getOrderById(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const order = await adminService.getOrderById(orderId);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        items: order.items?.map((item) => ({
          ...item,
          price: item.price ? Number(item.price) : null,
        })) || [],
      };
      
      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get order',
      });
    }
  }

  async updateOrderItemPrice(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, orderItemId } = req.params;
      const { price } = req.body;
      
      if (!price || price <= 0) {
        res.status(400).json({ error: 'Price must be greater than 0' });
        return;
      }
      
      const order = await adminService.updateOrderItemPrice(orderId, orderItemId, price);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        items: order.items?.map((item) => ({
          ...item,
          price: item.price ? Number(item.price) : null,
        })) || [],
      };
      
      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update order item price',
      });
    }
  }

  async updateOrderSourceAndWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { orderSource, fulfillmentWarehouseId } = req.body;
      const order = await adminService.updateOrderSourceAndWarehouse(orderId, {
        orderSource,
        fulfillmentWarehouseId,
      });
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        items: order.items?.map((item) => ({
          ...item,
          price: item.price ? Number(item.price) : null,
        })) || [],
      };
      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update order source/warehouse',
      });
    }
  }

  async getOrderAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const result = await adminService.getOrderAvailability(orderId);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to get order availability',
      });
    }
  }

  async fulfillFromWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { warehouseId } = req.body;
      if (!warehouseId) {
        res.status(400).json({ error: 'warehouseId is required' });
        return;
      }
      const result = await adminService.fulfillFromWarehouse(orderId, warehouseId);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to fulfill from warehouse',
      });
    }
  }

  // Customers
  async getAllCustomers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const sortOrder = (req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc') ? req.query.sortOrder as 'asc' | 'desc' : undefined;

      const result = await adminService.getAllCustomers(page, limit, {
        search,
        dateFrom,
        dateTo,
        sortOrder,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get customers',
      });
    }
  }

  async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isPartner, partnerStatus } = req.body;

      const customer = await adminService.updateCustomer(id, { isPartner, partnerStatus });
      res.json({ customer });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update customer',
      });
    }
  }

  async getCustomerDetails(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const details = await adminService.getCustomerDetails(customerId);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedDetails = {
        ...details,
        orders: details.orders.map((order) => ({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          shipping: Number(order.shipping),
          total: Number(order.total),
          items: order.items?.map((item) => ({
            ...item,
            price: Number(item.price),
          })) || [],
        })),
      };
      
      res.json(serializedDetails);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get customer details',
      });
    }
  }

  async updateCustomerEmail(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { email } = req.body as { email?: string };
      const customer = await adminService.updateCustomerEmail(customerId, email || '');
      res.json({
        customer,
        message: 'Customer email updated. Verification email sent.',
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update customer email',
      });
    }
  }

  async resendCustomerVerification(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const result = await adminService.resendCustomerVerification(customerId);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to send verification email',
      });
    }
  }

  async sendCustomerPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const result = await adminService.sendCustomerPasswordReset(customerId);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to send password reset email',
      });
    }
  }

  async addCustomerNote(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { customerId } = req.params;
      const { content } = req.body;
      const note = await adminService.addCustomerNote(customerId, content, req.user.userId);
      res.status(201).json({ note });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add note',
      });
    }
  }

  async getCustomerNotes(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const notes = await adminService.getCustomerNotes(customerId);
      res.json({ notes });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get notes',
      });
    }
  }

  // Warehouses
  async getAllWarehouses(_req: Request, res: Response): Promise<void> {
    try {
      const warehouses = await adminService.getAllWarehouses();
      res.json({ warehouses });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get warehouses',
      });
    }
  }

  async getWarehouseDetails(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId } = req.params;
      const warehouse = await adminService.getWarehouseDetails(warehouseId);
      res.json({ warehouse });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get warehouse details',
      });
    }
  }

  async getWarehouseInventory(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId } = req.params;
      const status = req.query.status as InventoryStatus | undefined;
      const search = req.query.search as string | undefined;
      const inventory = await adminService.getWarehouseInventory(warehouseId, { status, search });
      res.json({ inventory });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get inventory',
      });
    }
  }

  async createWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const { name, address, city, country, type, priority } = req.body;
      const warehouse = await adminService.createWarehouse({ name, address, city, country, type, priority });
      res.status(201).json({ warehouse });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create warehouse',
      });
    }
  }

  async updateWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId } = req.params;
      const { name, address, city, country, type, priority } = req.body;
      const warehouse = await adminService.updateWarehouse(warehouseId, {
        name,
        address,
        city,
        country,
        type,
        priority,
      });
      res.json({ warehouse });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update warehouse',
      });
    }
  }

  async deleteWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId } = req.params;
      const result = await adminService.deleteWarehouse(warehouseId);
      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete warehouse';
      const statusCode = errorMessage.includes('not found') ? 404 : 
                         errorMessage.includes('Cannot delete') ? 400 : 500;
      res.status(statusCode).json({
        error: errorMessage,
      });
    }
  }

  async addInventory(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId } = req.params;
      const body = req.body as Record<string, unknown>;
      const { productId, variantId, quantity, reason, status, palletId } = body;
      const movementDetails = (body.documentNumber != null || body.documentDate != null || body.supplierName != null ||
        body.supplierInn != null || body.supplierVatNumber != null || body.customsDeclarationId != null ||
        body.purchasePrice != null || body.purchaseCurrency != null ||
        body.receivedAt != null || body.batchNumber != null)
        ? {
            documentNumber: body.documentNumber as string | null | undefined,
            documentDate: body.documentDate ? new Date(body.documentDate as string) : undefined,
            supplierName: body.supplierName as string | null | undefined,
            supplierInn: body.supplierInn as string | null | undefined,
            supplierVatNumber: body.supplierVatNumber as string | null | undefined,
            customsDeclarationId: body.customsDeclarationId as string | null | undefined,
            purchasePrice: body.purchasePrice != null ? Number(body.purchasePrice) : undefined,
            purchaseCurrency: body.purchaseCurrency as string | null | undefined,
            receivedAt: body.receivedAt ? new Date(body.receivedAt as string) : undefined,
            batchNumber: body.batchNumber as string | null | undefined,
          }
        : undefined;
      const inventory = await adminService.addInventory(
        warehouseId,
        productId as string,
        (variantId as string) || null,
        Number(quantity),
        reason as string | undefined,
        status as InventoryStatus | undefined,
        palletId as string | undefined,
        movementDetails
      );
      res.status(201).json({ inventory });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add inventory',
      });
    }
  }

  async transferInventory(req: Request, res: Response): Promise<void> {
    try {
      const { fromWarehouseId, toWarehouseId, productId, variantId, quantity } = req.body;
      await adminService.transferInventory(
        fromWarehouseId,
        toWarehouseId,
        productId,
        variantId || null,
        quantity
      );
      res.json({ message: 'Inventory transferred successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to transfer inventory',
      });
    }
  }

  // Pallet Management
  async createPallet(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId } = req.params;
      const { code, location, description } = req.body;
      const pallet = await adminService.createPallet(warehouseId, { code, location, description });
      res.status(201).json({ pallet });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create pallet',
      });
    }
  }

  async getWarehousePallets(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId } = req.params;
      const pallets = await adminService.getWarehousePallets(warehouseId);
      res.json({ pallets });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get pallets',
      });
    }
  }

  // Inventory Status Management
  async updateInventoryStatus(req: Request, res: Response): Promise<void> {
    try {
      const { inventoryId } = req.params;
      const { status } = req.body;
      const inventory = await adminService.updateInventoryStatus(inventoryId, status);
      res.json({ inventory });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update inventory status',
      });
    }
  }

  async updateInventoryQuantity(req: Request, res: Response): Promise<void> {
    try {
      const { inventoryId } = req.params;
      const { quantity, status } = req.body;
      const inventory = await adminService.updateInventoryQuantity(inventoryId, quantity, status);
      res.json({ inventory });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update inventory quantity',
      });
    }
  }

  async assignItemToPallet(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const { palletId } = req.body;
      const item = await adminService.assignItemToPallet(itemId, palletId || null);
      res.json({ item });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to assign item to pallet',
      });
    }
  }

  async createInventoryItems(req: Request, res: Response): Promise<void> {
    try {
      const { inventoryId, quantity, palletId, orderId } = req.body;
      const items = await adminService.createInventoryItems(inventoryId, quantity, palletId, orderId);
      res.status(201).json({ items });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create inventory items',
      });
    }
  }

  async updateInventoryItemStatus(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const { status } = req.body;
      const item = await adminService.updateInventoryItemStatus(itemId, status);
      res.json({ item });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update item status',
      });
    }
  }

  // QR Code Management
  async createDeliveryQRCode(req: Request, res: Response): Promise<void> {
    try {
      const { inventoryItemId, orderId } = req.body;
      const qrCode = await adminService.createDeliveryQRCode(inventoryItemId, orderId);
      res.status(201).json({ qrCode });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create QR code',
      });
    }
  }

  async getOrderInventoryItems(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const items = await adminService.getOrderInventoryItems(orderId);
      res.json({ items });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get order inventory items',
      });
    }
  }

  async getOrderWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const warehouse = await adminService.getOrderWarehouse(orderId);
      res.json({ warehouse });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get order warehouse',
      });
    }
  }

  async markQRCodeAsUsed(req: Request, res: Response): Promise<void> {
    try {
      const { qrCodeId } = req.params;
      const qrCode = await adminService.markQRCodeAsUsed(qrCodeId);
      res.json({ qrCode });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to mark QR code as used',
      });
    }
  }

  async resetAllInventory(_req: Request, res: Response): Promise<void> {
    try {
      const result = await adminService.resetAllInventory();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reset inventory',
      });
    }
  }

  async resetOrdersTicketsPayments(_req: Request, res: Response): Promise<void> {
    try {
      const result = await adminService.resetOrdersTicketsPayments();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reset orders, tickets, and payment requests',
      });
    }
  }

  async resetAll(_req: Request, res: Response): Promise<void> {
    try {
      const result = await adminService.resetAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reset all data',
      });
    }
  }
}

export const adminController = new AdminController();
