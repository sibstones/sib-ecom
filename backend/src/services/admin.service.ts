import prisma from '../config/database';
import { OrderStatus, PaymentStatus, UserRole, InventoryStatus, TicketStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { cartService } from './cart.service';

export class AdminService {
  // Helper to safely get TicketStatus enum values
  private getTicketStatus(status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'): string {
    try {
      if (TicketStatus && TicketStatus[status]) {
        return TicketStatus[status];
      }
    } catch {
      // Fall through to return string literal
    }
    return status;
  }

  // Helper function to safely count support tickets
  private async safeSupportTicketCount(where?: { status?: TicketStatus | string }): Promise<number> {
    try {
      if (!prisma.supportTicket) {
        return 0;
      }
      return await prisma.supportTicket.count(where ? { where: where as any } : undefined).catch(() => 0);
    } catch {
      return 0;
    }
  }

  // Dashboard Statistics
  async getDashboardStats() {
    try {
      const [
        totalOrders,
        totalRevenue,
        totalCustomers,
        totalProducts,
        pendingOrders,
        recentOrders,
        openTickets,
        inProgressTickets,
        pendingPaymentRequests,
        pendingReturns,
      ] = await Promise.all([
        prisma.order.count().catch(() => 0),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { paymentStatus: PaymentStatus.PAID },
        }).catch(() => ({ _sum: { total: null } })),
        prisma.user.count({ where: { role: UserRole.CUSTOMER } }).catch(() => 0),
        prisma.product.count().catch(() => 0),
        prisma.order.count({ where: { status: OrderStatus.PENDING } }).catch(() => 0),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }).catch(() => []),
        this.safeSupportTicketCount({ status: this.getTicketStatus('OPEN') }),
        this.safeSupportTicketCount({ status: this.getTicketStatus('IN_PROGRESS') }),
        prisma.paymentRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
        prisma.returnRequest.count({ where: { status: 'REQUESTED' } }).catch(() => 0),
      ]);

      return {
        stats: {
          totalOrders: totalOrders ?? 0,
          totalRevenue: totalRevenue?._sum?.total || new Prisma.Decimal(0),
          totalCustomers: totalCustomers ?? 0,
          totalProducts: totalProducts ?? 0,
          pendingOrders: pendingOrders ?? 0,
          openTickets: openTickets ?? 0,
          inProgressTickets: inProgressTickets ?? 0,
          pendingPaymentRequests: pendingPaymentRequests ?? 0,
          pendingReturns: pendingReturns ?? 0,
        },
        recentOrders: recentOrders ?? [],
      };
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      // Return default values to prevent frontend crashes
      return {
        stats: {
          totalOrders: 0,
          totalRevenue: new Prisma.Decimal(0),
          totalCustomers: 0,
          totalProducts: 0,
          pendingOrders: 0,
          openTickets: 0,
          inProgressTickets: 0,
          pendingPaymentRequests: 0,
          pendingReturns: 0,
        },
        recentOrders: [],
      };
    }
  }

  // Warehouse Analytics for Dashboard
  async getWarehouseAnalytics() {
    try {
      // Get all active warehouses
      const warehouses = await prisma.warehouse.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const warehouseIds = warehouses.map(w => w.id);

      if (warehouseIds.length === 0) {
        return {
          totalStock: 0,
          awaitingPayment: 0,
          paid: 0,
          returned: 0,
          currentStock: 0,
        };
      }

      // Get all inventory across all warehouses
      const allInventory = await prisma.inventory.findMany({
        where: { warehouseId: { in: warehouseIds } },
        select: {
          id: true,
          quantity: true,
          reserved: true,
        },
      });

      // Get all inventory items with status
      const inventoryIds = allInventory.map(inv => inv.id);
      const allItems = inventoryIds.length > 0 ? await prisma.inventoryItem.findMany({
        where: { inventoryId: { in: inventoryIds } },
        select: {
          id: true,
          inventoryId: true,
          status: true,
          quantity: true,
        },
      }) : [];

      // Calculate analytics
      let totalStock = 0;
      let awaitingPayment = 0;
      let paid = 0;
      let returned = 0;
      let currentStock = 0;

      allInventory.forEach(inv => {
        const available = inv.quantity - inv.reserved;
        totalStock += inv.quantity;
        currentStock += available;
        awaitingPayment += inv.reserved;
      });

      // Count by status from inventory items
      allItems.forEach(item => {
        const quantity = item.quantity || 1;
        if (item.status === 'IN_DELIVERY' || item.status === 'DELIVERED') {
          paid += quantity;
        } else if (item.status === 'RETURNED') {
          returned += quantity;
        }
      });

      return {
        totalStock,
        awaitingPayment,
        paid,
        returned,
        currentStock,
      };
    } catch (error) {
      console.error('Error in getWarehouseAnalytics:', error);
      return {
        totalStock: 0,
        awaitingPayment: 0,
        paid: 0,
        returned: 0,
        currentStock: 0,
      };
    }
  }

  // Orders Management
  /** Delivery stage filter: NO_TRACKING | IN_TRANSIT | AWAITING_PICKUP | AWAITING_PICKUP_OVER_7_DAYS */
  async getAllOrders(page: number = 1, limit: number = 20, filters?: {
    status?: OrderStatus;
    statusIn?: OrderStatus[];
    paymentStatus?: PaymentStatus;
    search?: string;
    dateFrom?: string; // ISO date
    dateTo?: string; // ISO date
    sortBy?: 'createdAt';
    sortOrder?: 'asc' | 'desc';
    deliveryStage?: 'NO_TRACKING' | 'IN_TRANSIT' | 'AWAITING_PICKUP' | 'AWAITING_PICKUP_OVER_7_DAYS';
  }) {
    try {
      const skip = (page - 1) * limit;

      const where: Prisma.OrderWhereInput = {};
      if (filters?.statusIn && filters.statusIn.length > 0) {
        where.status = { in: filters.statusIn };
      } else if (filters?.status) {
        where.status = filters.status;
      }
      if (filters?.paymentStatus) where.paymentStatus = filters.paymentStatus;
      if (filters?.search) {
        where.OR = [
          { orderNumber: { contains: filters.search, mode: 'insensitive' } },
          { user: { email: { contains: filters.search, mode: 'insensitive' } } },
        ];
      }
      if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) {
          const d = new Date(filters.dateTo);
          d.setHours(23, 59, 59, 999);
          where.createdAt.lte = d;
        }
      }

      // Delivery stage: filter by tracking and status via raw SQL (logisticsInfo is JSON on payment_requests)
      if (filters?.deliveryStage) {
        const stage = filters.deliveryStage;
        const baseSql = Prisma.sql`
          SELECT o.id FROM orders o
          LEFT JOIN payment_requests pr ON pr.order_id = o.id
          WHERE 1=1
        `;
        const conditions: Prisma.Sql[] = [];
        if (stage === 'NO_TRACKING') {
          conditions.push(Prisma.sql`o.status IN ('CONFIRMED', 'PROCESSING')`);
          conditions.push(Prisma.sql`o.payment_status = 'PAID'`);
          conditions.push(Prisma.sql`(o.tracking_number IS NULL OR TRIM(COALESCE(o.tracking_number, '')) = '')`);
          conditions.push(Prisma.sql`(pr.id IS NULL OR pr.logistics_info->>'trackingNumber' IS NULL OR TRIM(COALESCE(pr.logistics_info->>'trackingNumber', '')) = '')`);
        } else if (stage === 'IN_TRANSIT') {
          conditions.push(Prisma.sql`o.status = 'SHIPPED'`);
          conditions.push(Prisma.sql`(
            (o.tracking_number IS NOT NULL AND TRIM(o.tracking_number) != '')
            OR (pr.logistics_info->>'trackingNumber' IS NOT NULL AND TRIM(COALESCE(pr.logistics_info->>'trackingNumber', '')) != '')
          )`);
        } else if (stage === 'AWAITING_PICKUP') {
          conditions.push(Prisma.sql`o.status = 'DELIVERED'`);
          conditions.push(Prisma.sql`(COALESCE(o.shipped_at, pr.shipped_at, o.updated_at, o.created_at) >= NOW() - INTERVAL '7 days')`);
        } else if (stage === 'AWAITING_PICKUP_OVER_7_DAYS') {
          conditions.push(Prisma.sql`o.status = 'DELIVERED'`);
          conditions.push(Prisma.sql`(COALESCE(o.shipped_at, pr.shipped_at, o.updated_at, o.created_at) < NOW() - INTERVAL '7 days')`);
        }
        if (conditions.length > 0) {
          const idsResult = await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`${baseSql} AND ${Prisma.join(conditions, ' AND ')}`
          ).catch(() => []);
          const ids = idsResult.map((r) => r.id);
          if (ids.length === 0) {
            return {
              orders: [],
              pagination: { page, limit, total: 0, totalPages: 0 },
            };
          }
          where.id = { in: ids };
        }
      }

      const orderBy = { createdAt: (filters?.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' };

      // Use string literals directly to avoid enum import issues
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            items: {
              take: 3,
              include: {
                product: {
                  select: {
                    name: true,
                    images: { take: 1, orderBy: { order: 'asc' } },
                  },
                },
              },
            },
            tickets: {
              where: {
                status: {
                  in: ['OPEN', 'IN_PROGRESS'] as any,
                },
              },
              select: {
                id: true,
                status: true,
              },
            },
            paymentRequest: {
              select: {
                id: true,
                status: true,
                logisticsInfo: true,
                shippedAt: true,
              },
            },
          },
          skip,
          take: limit,
        }).catch(() => []),
        prisma.order.count({ where }).catch(() => 0),
      ]);

      return {
        orders: orders ?? [],
        pagination: {
          page,
          limit,
          total: total ?? 0,
          totalPages: Math.ceil((total ?? 0) / limit),
        },
      };
    } catch (error) {
      console.error('Error in getAllOrders:', error);
      return {
        orders: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, notes?: string) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        statusHistory: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: { take: 1, orderBy: { order: 'asc' } },
              },
            },
          },
        },
        inventoryItems: true,
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status,
        notes: notes || `orderDetail.statusHistory.statusChanged`,
      },
    });

    // If the order is cancelled, release the reservation (product is returned to available for sale)
    if (status === OrderStatus.CANCELLED) {
      const itemsToRelease = order.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        quantity: item.quantity,
      }));
      await cartService.releaseReservationForOrderItems(itemsToRelease);
    }

    // If order status is set to RETURNED, return items to stock
    if (status === OrderStatus.RETURNED) {
      // Update inventory items status
      if (order.inventoryItems.length > 0) {
        await prisma.inventoryItem.updateMany({
          where: {
            orderId: orderId,
          },
          data: {
            status: InventoryStatus.RETURNED,
          },
        });
      }

      // Return inventory to stock: increase quantity and change status to IN_SALE
      for (const orderItem of order.items) {
        let targetVariantId = orderItem.variantId || null;
        
        // Find variant by size if needed
        if (!targetVariantId && orderItem.size) {
          const sizeValue = orderItem.size.includes(':') ? orderItem.size.split(':')[1] : orderItem.size;
          const variant = await prisma.productVariant.findFirst({
            where: {
              productId: orderItem.productId,
              OR: [
                { size: sizeValue },
                { name: { contains: `Size: ${sizeValue}`, mode: 'insensitive' } },
                { name: { contains: sizeValue, mode: 'insensitive' } },
              ],
            },
          });
          if (variant) {
            targetVariantId = variant.id;
          }
        }

        // Find inventory and return to stock
        const inventories = await prisma.inventory.findMany({
          where: {
            productId: orderItem.productId,
            variantId: targetVariantId || null,
          },
          orderBy: { quantity: 'asc' },
        });

        // Return to first available warehouse or create new inventory entry
        if (inventories.length > 0) {
          const inventory = inventories[0];
          await prisma.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: { increment: orderItem.quantity },
              status: InventoryStatus.IN_SALE,
            },
          });
        } else if (inventories.length === 0) {
          // Create new inventory entry if none exists
          const firstWarehouse = await prisma.warehouse.findFirst({
            where: { isActive: true },
          });
          if (firstWarehouse) {
            await prisma.inventory.create({
              data: {
                productId: orderItem.productId,
                variantId: targetVariantId,
                warehouseId: firstWarehouse.id,
                quantity: orderItem.quantity,
                status: InventoryStatus.IN_SALE,
              },
            });
          }
        }
      }
    }

    return order;
  }

  /** Admin-only: update delivery & invoice fields for reports */
  async updateOrderDeliveryInfo(
    orderId: string,
    data: {
      invoiceNumber?: string | null;
      invoiceDate?: Date | null;
      shippedAt?: Date | null;
      deliveryMethod?: string | null;
      carrierName?: string | null;
      waybillNumber?: string | null;
      waybillDate?: Date | null;
      trackingNumber?: string | null;
      customsDeclarationNumber?: string | null;
    }
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
    if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate;
    if (data.shippedAt !== undefined) updateData.shippedAt = data.shippedAt;
    if (data.deliveryMethod !== undefined) updateData.deliveryMethod = data.deliveryMethod;
    if (data.carrierName !== undefined) updateData.carrierName = data.carrierName;
    if (data.waybillNumber !== undefined) updateData.waybillNumber = data.waybillNumber;
    if (data.waybillDate !== undefined) updateData.waybillDate = data.waybillDate;
    if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
    if (data.customsDeclarationNumber !== undefined) updateData.customsDeclarationNumber = data.customsDeclarationNumber;

    return prisma.order.update({
      where: { id: orderId },
      data: updateData as any,
      include: {
        items: { include: { product: { select: { name: true, images: { take: 1, orderBy: { order: 'asc' } } } } } },
        user: { select: { email: true, firstName: true, lastName: true } },
        shippingAddress: true,
        paymentRequest: true,
      },
    });
  }

  async updateOrderPaymentStatus(orderId: string, paymentStatus: PaymentStatus, notes?: string) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus },
      include: {
        statusHistory: true,
        promoCode: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: { take: 1, orderBy: { order: 'asc' } },
              },
            },
          },
        },
      },
    });

    // Create status history entry for payment status change
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: order.status, // Keep current order status
        notes: notes || `orderDetail.statusHistory.paymentStatusChanged`,
      },
    });

    // Create partner commission if order is paid and has partner promo code
    if (paymentStatus === PaymentStatus.PAID && order.promoCode?.isPartnerPromo && order.promoCode.partnerId && order.promoCode.partnerCommissionRate) {
      try {
        const { partnerCommissionService } = await import('./partner-commission.service');
        await partnerCommissionService.createCommission(
          order.promoCode.partnerId,
          order.id,
          order.promoCode.id,
          Number(order.total),
          Number(order.promoCode.partnerCommissionRate)
        );
      } catch (error) {
        console.error('Failed to create partner commission:', error);
        // Don't fail the payment status update if commission creation fails
      }
    }

    return order;
  }

  async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { order: 'asc' } },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        paymentRequest: true,
        fulfillmentWarehouse: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            country: true,
          },
        },
        salesPoint: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  async updateOrderSourceAndWarehouse(
    orderId: string,
    data: { orderSource?: string; fulfillmentWarehouseId?: string | null }
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.orderSource !== undefined) {
      updateData.orderSource = data.orderSource;
    }
    if (data.fulfillmentWarehouseId !== undefined) {
      updateData.fulfillmentWarehouseId = data.fulfillmentWarehouseId || null;
    }
    if (Object.keys(updateData).length === 0) {
      return this.getOrderById(orderId);
    }
    await prisma.order.update({
      where: { id: orderId },
      data: updateData as any,
    });
    return this.getOrderById(orderId);
  }

  /** Returns availability per order item: which warehouses have stock */
  async getOrderAvailability(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true, variant: true } } },
    });
    if (!order) throw new Error('Order not found');

    const items: Array<{
      orderItemId: string;
      productId: string;
      variantId: string | null;
      size: string | null;
      productName: string;
      quantityNeeded: number;
      warehouses: Array<{ warehouseId: string; warehouseName: string; available: number; inventoryId: string }>;
    }> = [];

    for (const oi of order.items) {
      let targetVariantId = oi.variantId ?? null;
      if (!targetVariantId && oi.size) {
        const sizeValue = oi.size.includes(':') ? oi.size.split(':')[1] : oi.size;
        const variant = await prisma.productVariant.findFirst({
          where: {
            productId: oi.productId,
            OR: [
              { size: sizeValue },
              { name: { contains: `Size: ${sizeValue}`, mode: 'insensitive' } },
              { name: { contains: sizeValue, mode: 'insensitive' } },
            ],
          },
        });
        if (variant) targetVariantId = variant.id;
      }

      const inventories = await prisma.inventory.findMany({
        where: {
          productId: oi.productId,
          variantId: targetVariantId || null,
          status: InventoryStatus.IN_SALE,
          quantity: { gt: 0 },
        },
        include: { warehouse: true },
      });

      const warehouses: Array<{ warehouseId: string; warehouseName: string; available: number; inventoryId: string }> = [];
      for (const inv of inventories) {
        const available = inv.quantity - inv.reserved;
        if (available > 0) {
          warehouses.push({
            warehouseId: inv.warehouse.id,
            warehouseName: inv.warehouse.name,
            available,
            inventoryId: inv.id,
          });
        }
      }

      items.push({
        orderItemId: oi.id,
        productId: oi.productId,
        variantId: targetVariantId,
        size: oi.size,
        productName: oi.product?.name ?? '',
        quantityNeeded: oi.quantity,
        warehouses,
      });
    }

    return { items };
  }

  /** Create inventory items from specified warehouse and link to order */
  async fulfillFromWarehouse(orderId: string, warehouseId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new Error('Order not found');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new Error('Warehouse not found');

    const created: Array<{ inventoryId: string; orderItemId: string; quantity: number }> = [];

    for (const oi of order.items) {
      let targetVariantId = oi.variantId ?? null;
      if (!targetVariantId && oi.size) {
        const sizeValue = oi.size.includes(':') ? oi.size.split(':')[1] : oi.size;
        const variant = await prisma.productVariant.findFirst({
          where: {
            productId: oi.productId,
            OR: [
              { size: sizeValue },
              { name: { contains: `Size: ${sizeValue}`, mode: 'insensitive' } },
              { name: { contains: sizeValue, mode: 'insensitive' } },
            ],
          },
        });
        if (variant) targetVariantId = variant.id;
      }

      const inv = await prisma.inventory.findFirst({
        where: {
          warehouseId,
          productId: oi.productId,
          variantId: targetVariantId || null,
          status: InventoryStatus.IN_SALE,
        },
      });

      if (!inv) {
        throw new Error(
          `No inventory for product ${oi.productId} (variant ${targetVariantId ?? 'any'}) in warehouse ${warehouse.name}`
        );
      }

      const available = inv.quantity - inv.reserved;
      if (available < oi.quantity) {
        throw new Error(
          `Insufficient stock: ${available} available, ${oi.quantity} needed for product in ${warehouse.name}`
        );
      }

      await this.createInventoryItems(inv.id, oi.quantity, undefined, orderId);
      await prisma.inventory.update({
        where: { id: inv.id },
        data: { quantity: { decrement: oi.quantity } },
      });

      created.push({ inventoryId: inv.id, orderItemId: oi.id, quantity: oi.quantity });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentWarehouseId: warehouseId },
    });

    return { created, items: await this.getOrderInventoryItems(orderId) };
  }

  async updateOrderItemPrice(orderId: string, orderItemId: string, price: number) {
    // Update order item price
    const orderItem = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        price: new Prisma.Decimal(price),
      },
      include: {
        order: {
          include: {
            items: true,
            promoCode: true,
            shippingAddress: true,
          },
        },
      },
    });

    // Verify order item belongs to the order
    if (orderItem.orderId !== orderId) {
      throw new Error('Order item does not belong to this order');
    }

    // Get country settings for tax and shipping calculation
    const { countryService } = await import('./country.service');
    const { normalizeCountryCode } = await import('../utils/country');
    const countryCode = normalizeCountryCode(orderItem.order.shippingAddress?.country || 'US');
    let countrySettings = null;
    try {
      countrySettings = await countryService.getByCode(countryCode);
    } catch (error) {
      console.warn(`Country settings not found for code: ${countryCode}, using defaults`);
    }

    // Default tax and shipping values (fallback). All amounts in USD.
    const { resolveTaxRate } = await import('../utils/country');
    const taxRate = new Prisma.Decimal(resolveTaxRate(countrySettings, 0.1));

    let shippingCostUSD = 10;
    let freeShippingThresholdUSD = 100;
    if (countrySettings) {
      const countryCurrency = (countrySettings.currency || 'USD').trim().toUpperCase();
      const rawShipping = countrySettings.shippingCost != null ? Number(countrySettings.shippingCost) : 10;
      const rawThreshold = countrySettings.freeShippingThreshold != null ? Number(countrySettings.freeShippingThreshold) : 100;
      try {
        const { currencyRateService } = await import('./currency-rate.service');
        shippingCostUSD = countryCurrency === 'USD' ? rawShipping : await currencyRateService.convert(rawShipping, countryCurrency, 'USD');
        freeShippingThresholdUSD = countryCurrency === 'USD' ? rawThreshold : await currencyRateService.convert(rawThreshold, countryCurrency, 'USD');
      } catch {
        const { defaultExchangeRates } = await import('../config/currency');
        const rate = defaultExchangeRates[countryCurrency] || 1;
        shippingCostUSD = countryCurrency === 'USD' ? rawShipping : rawShipping / rate;
        freeShippingThresholdUSD = countryCurrency === 'USD' ? rawThreshold : rawThreshold / rate;
      }
      if (shippingCostUSD > 500) shippingCostUSD = 10;
      if (freeShippingThresholdUSD > 500) freeShippingThresholdUSD = 100;
    }
    const shippingCost = new Prisma.Decimal(shippingCostUSD);
    const freeShippingThreshold = new Prisma.Decimal(freeShippingThresholdUSD);

    // Recalculate order totals
    let subtotal = new Prisma.Decimal(0);
    orderItem.order.items.forEach((item) => {
      if (item.price) {
        const itemTotal = item.price.mul(item.quantity);
        subtotal = subtotal.add(itemTotal);
      }
    });

    // Apply promo code discount if exists
    let discount = new Prisma.Decimal(0);
    if (orderItem.order.promoCode) {
      const promo = orderItem.order.promoCode;
      if (promo.discountType === 'PERCENTAGE') {
        discount = subtotal.mul(promo.discountValue).div(100);
        if (promo.maxDiscount) {
          discount = Prisma.Decimal.min(discount, promo.maxDiscount);
        }
      } else {
        discount = promo.discountValue;
      }
    }

    const loyaltyDiscount = new Prisma.Decimal(Number(orderItem.order.loyaltyDiscount || 0));
    const subtotalAfterDiscount = subtotal.sub(discount).sub(loyaltyDiscount);
    
    // Calculate tax using country-specific tax rate
    const tax = subtotalAfterDiscount.mul(taxRate);
    
    // Calculate shipping: free if threshold is met, otherwise use country-specific shipping cost
    let shipping = new Prisma.Decimal(0);
    if (freeShippingThreshold.gt(0) && subtotalAfterDiscount.gte(freeShippingThreshold)) {
      shipping = new Prisma.Decimal(0); // Free shipping
    } else {
      shipping = shippingCost;
    }
    
    const total = subtotalAfterDiscount.add(tax).add(shipping);

    // Update order totals
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: subtotalAfterDiscount,
        tax,
        shipping,
        total,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { order: 'asc' } },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        paymentRequest: true,
      },
    });

    return updatedOrder;
  }

  // Customers Management (CRM)
  async getAllCustomers(page: number = 1, limit: number = 20, filters?: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
    };

    if (filters?.search) {
      where.AND = (where.AND as any[]) || [];
      (where.AND as any[]).push({
        OR: [
          { email: { contains: filters.search, mode: 'insensitive' } },
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const d = new Date(filters.dateTo);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    const orderBy = { createdAt: (filters?.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' };

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isPartner: true,
          partnerStatus: true,
          createdAt: true,
          role: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Ensure _count.orders is always a number (fallback to 0 if undefined)
    const customersWithOrders = customers.map(customer => ({
      ...customer,
      _count: {
        orders: customer._count?.orders ?? 0,
      },
    }));

    return {
      customers: customersWithOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateCustomer(
    customerId: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      isPartner?: boolean;
      partnerStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    }
  ) {
    return prisma.user.update({
      where: { id: customerId },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.isPartner !== undefined && { isPartner: data.isPartner }),
        ...(data.partnerStatus !== undefined && { partnerStatus: data.partnerStatus }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isPartner: true,
        partnerStatus: true,
        createdAt: true,
        role: true,
      },
    });
  }

  async getCustomerDetails(customerId: string) {
    const [customer, orders, addresses] = await Promise.all([
      prisma.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          emailVerified: true,
          passwordHash: true,
          isPartner: true,
          partnerStatus: true,
          createdAt: true,
        },
      }),
      prisma.order.findMany({
        where: { userId: customerId },
        include: {
          items: {
            take: 5,
            include: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.customerAddress.findMany({
        where: { userId: customerId },
      }),
    ]);

    return {
      customer: customer
        ? {
            ...customer,
            passwordLoginAvailable: !!customer.passwordHash,
          }
        : customer,
      orders,
      addresses,
    };
  }

  async updateCustomerEmail(customerId: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: customerId },
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const customer = await prisma.user.update({
      where: { id: customerId },
      data: {
        email: normalizedEmail,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerified: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    const { authService } = await import('./auth.service');
    await authService.resendVerificationForUser(customerId);

    return {
      ...customer,
      passwordLoginAvailable: !!customer.passwordHash,
    };
  }

  async resendCustomerVerification(customerId: string) {
    const { authService } = await import('./auth.service');
    return authService.resendVerificationForUser(customerId);
  }

  async sendCustomerPasswordReset(customerId: string) {
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (!customer) {
      throw new Error('User not found');
    }

    const { authService } = await import('./auth.service');
    return authService.forgotPassword(customer.email);
  }

  async addCustomerNote(customerId: string, content: string, createdBy: string) {
    return prisma.adminNote.create({
      data: {
        userId: customerId,
        content,
        createdBy,
      },
    });
  }

  async getCustomerNotes(customerId: string) {
    return prisma.adminNote.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Warehouses Management
  async getAllWarehouses() {
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
      include: {
        _count: {
          select: {
            inventory: true,
          },
        },
      },
    });

      // Ensure _count is always defined - NOTE: this is not implemented yet
    return warehouses.map(warehouse => ({
      ...warehouse,
      _count: {
        inventory: warehouse._count?.inventory ?? 0,
      },
    }));
  }

  async getWarehouseDetails(warehouseId: string) {
    const [warehouse, palletsCount, recentPallets] = await Promise.all([
      prisma.warehouse.findUnique({
        where: { id: warehouseId },
        include: {
          _count: {
            select: {
              inventory: true,
              movements: true,
            },
          },
        },
      }),
      prisma.pallet.count({
        where: { warehouseId },
      }),
      prisma.pallet.findMany({
        where: { warehouseId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
    ]);

    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    return {
      ...warehouse,
      _count: {
        inventory: warehouse._count?.inventory ?? 0,
        movements: warehouse._count?.movements ?? 0,
        pallets: palletsCount,
      },
      pallets: recentPallets,
    };
  }

  async getWarehouseInventory(warehouseId: string, filters?: {
    status?: InventoryStatus;
    search?: string;
  }) {
    const where: Prisma.InventoryWhereInput = { warehouseId };
    
    if (filters?.status) {
      where.status = filters.status;
    }
    
    if (filters?.search) {
      where.OR = [
        { product: { name: { contains: filters.search, mode: 'insensitive' } } },
        { product: { sku: { contains: filters.search, mode: 'insensitive' } } },
        { variant: { name: { contains: filters.search, mode: 'insensitive' } } },
        { variant: { sku: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Load all items in one request for all inventory
    const inventoryIds = inventory.map(inv => inv.id);
    const allItems = inventoryIds.length > 0 ? await prisma.inventoryItem.findMany({
      where: { inventoryId: { in: inventoryIds } },
      include: {
        pallet: {
          select: {
            id: true,
            code: true,
            location: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
          },
        },
        qrCodes: {
          where: { isUsed: false },
          take: 1,
        },
      },
    }) : [];

    // Group items by inventoryId
    const itemsByInventoryId = allItems.reduce((acc, item) => {
      if (!acc[item.inventoryId]) {
        acc[item.inventoryId] = [];
      }
      acc[item.inventoryId].push(item);
      return acc;
    }, {} as Record<string, typeof allItems>);

    // Combine inventory with their items
    return inventory.map(inv => ({
      ...inv,
      items: itemsByInventoryId[inv.id] || [],
    }));
  }

  async createWarehouse(data: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    type?: 'MAIN' | 'STORE' | 'MARKETPLACE';
    priority?: number;
  }) {
    return prisma.warehouse.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        country: data.country,
        type: data.type ?? 'MAIN',
        priority: data.priority ?? 0,
        isActive: true,
      },
    });
  }

  async updateWarehouse(warehouseId: string, data: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    type?: 'MAIN' | 'STORE' | 'MARKETPLACE';
    priority?: number;
  }) {
    return prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.type != null && { type: data.type }),
        ...(data.priority !== undefined && { priority: data.priority }),
      },
    });
  }

  async deleteWarehouse(warehouseId: string) {
    // Ensure warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        _count: {
          select: {
            inventory: true,
            pallets: true,
            movements: true,
            returnRequestItems: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    // Ensure warehouse has no inventory
    if (warehouse._count.inventory > 0) {
      throw new Error('Cannot delete warehouse: it contains inventory items. Please remove all inventory first.');
    }

    // Ensure warehouse has no return request items
    if (warehouse._count.returnRequestItems > 0) {
      throw new Error('Cannot delete warehouse: it is referenced by return requests.');
    }

    // Delete warehouse (pallets and movements will be handled by cascade or need to be deleted first) - NOTE: this is not implemented yet
    // First delete movements
    await prisma.inventoryMovement.deleteMany({
      where: { warehouseId },
    });

    // Delete pallets (cascade will handle items)
    await prisma.pallet.deleteMany({
      where: { warehouseId },
    });

    // Finally delete warehouse
    await prisma.warehouse.delete({
      where: { id: warehouseId },
    });

    return { message: 'Warehouse deleted successfully' };
  }

  async addInventory(
    warehouseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    reason?: string,
    status?: InventoryStatus,
    palletId?: string,
    movementDetails?: {
      documentNumber?: string | null;
      documentDate?: Date | null;
      supplierName?: string | null;
      supplierInn?: string | null;
      supplierVatNumber?: string | null;
      customsDeclarationId?: string | null;
      purchasePrice?: number | null;
      purchaseCurrency?: string | null;
      receivedAt?: Date | null;
      batchNumber?: string | null;
    }
  ) {
    // Check if warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Check if variant exists (if provided)
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });

      if (!variant || variant.productId !== productId) {
        throw new Error('Product variant not found or does not belong to this product');
      }
    }

    // Check if pallet exists and belongs to warehouse (if provided)
    if (palletId) {
      const pallet = await prisma.pallet.findUnique({
        where: { id: palletId },
      });

      if (!pallet) {
        throw new Error('Pallet not found');
      }

      if (pallet.warehouseId !== warehouseId) {
        throw new Error('Pallet does not belong to this warehouse');
      }
    }

    // Find existing inventory
    const existingInventory = await prisma.inventory.findFirst({
      where: {
        warehouseId,
        productId,
        variantId: variantId || null,
      },
    });

    let inventory;
    if (existingInventory) {
      // Update existing inventory
      inventory = await prisma.inventory.update({
        where: { id: existingInventory.id },
        data: { quantity: existingInventory.quantity + quantity },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              images: { take: 1, orderBy: { order: 'asc' } },
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      });
    } else {
      // Create new inventory with specified status or AWAITING_RECEIPT as default
      // Allow quantity = 0 for out of stock items
      const finalQuantity = Math.max(0, quantity);
      const finalStatus = finalQuantity === 0 
        ? (status || InventoryStatus.OUT_OF_STOCK)
        : (status || InventoryStatus.AWAITING_RECEIPT);
      
      inventory = await prisma.inventory.create({
        data: {
          warehouseId,
          productId,
          variantId: variantId || null,
          quantity: finalQuantity,
          status: finalStatus,
          reserved: 0, // No reserved items for new inventory
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              images: { take: 1, orderBy: { order: 'asc' } },
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      });
    }

    // Record movement (with optional admin-only fields for reports)
    const movementData: Parameters<typeof prisma.inventoryMovement.create>[0]['data'] = {
      warehouseId,
      productId,
      variantId: variantId || null,
      quantity,
      type: 'IN',
      reason: reason || 'Inventory added',
    };
    if (movementDetails) {
      if (movementDetails.documentNumber !== undefined) movementData.documentNumber = movementDetails.documentNumber;
      if (movementDetails.documentDate !== undefined) movementData.documentDate = movementDetails.documentDate;
      if (movementDetails.supplierName !== undefined) movementData.supplierName = movementDetails.supplierName;
      if (movementDetails.supplierInn !== undefined) movementData.supplierInn = movementDetails.supplierInn;
      if (movementDetails.supplierVatNumber !== undefined) movementData.supplierVatNumber = movementDetails.supplierVatNumber;
      if (movementDetails.customsDeclarationId !== undefined) movementData.customsDeclarationId = movementDetails.customsDeclarationId;
      if (movementDetails.purchasePrice !== undefined) movementData.purchasePrice = movementDetails.purchasePrice != null ? new Prisma.Decimal(movementDetails.purchasePrice) : null;
      if (movementDetails.purchaseCurrency !== undefined) movementData.purchaseCurrency = movementDetails.purchaseCurrency;
      if (movementDetails.receivedAt !== undefined) movementData.receivedAt = movementDetails.receivedAt;
      if (movementDetails.batchNumber !== undefined) movementData.batchNumber = movementDetails.batchNumber;
    }
    await prisma.inventoryMovement.create({
      data: movementData,
    });

    // Create inventory items if palletId is provided
    if (palletId) {
      await this.createInventoryItems(
        inventory.id,
        quantity,
        palletId,
        undefined
      );
    }

    return inventory;
  }

  async transferInventory(
    fromWarehouseId: string,
    toWarehouseId: string,
    productId: string,
    variantId: string | null,
    quantity: number
  ) {
    // Check if source has enough inventory
    const sourceInventory = await prisma.inventory.findFirst({
      where: {
        warehouseId: fromWarehouseId,
        productId,
        variantId: variantId || null,
      },
    });

    if (!sourceInventory || sourceInventory.quantity < quantity) {
      throw new Error('Insufficient inventory');
    }

    // Update source inventory
    await prisma.inventory.update({
      where: { id: sourceInventory.id },
      data: { quantity: sourceInventory.quantity - quantity },
    });

    // Update or create destination inventory
    const destInventory = await prisma.inventory.findFirst({
      where: {
        warehouseId: toWarehouseId,
        productId,
        variantId: variantId || null,
      },
    });

    if (destInventory) {
      await prisma.inventory.update({
        where: { id: destInventory.id },
        data: { quantity: destInventory.quantity + quantity },
      });
    } else {
      await prisma.inventory.create({
        data: {
          warehouseId: toWarehouseId,
          productId,
          variantId: variantId || null,
          quantity,
        },
      });
    }

    // Record movement
    await prisma.inventoryMovement.create({
      data: {
        warehouseId: fromWarehouseId,
        productId,
        variantId: variantId || null,
        quantity: -quantity,
        type: 'TRANSFER',
        reason: `Transferred to warehouse ${toWarehouseId}`,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        warehouseId: toWarehouseId,
        productId,
        variantId: variantId || null,
        quantity,
        type: 'TRANSFER',
        reason: `Received from warehouse ${fromWarehouseId}`,
      },
    });
  }

  // Pallet Management
  async createPallet(warehouseId: string, data: {
    code: string;
    location?: string;
    description?: string;
  }) {
    return prisma.pallet.create({
      data: {
        warehouseId,
        code: data.code,
        location: data.location,
        description: data.description,
      },
    });
  }

  async getWarehousePallets(warehouseId: string) {
    const pallets = await prisma.pallet.findMany({
      where: { warehouseId },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Make sure _count is always defined
    return pallets.map(pallet => ({
      ...pallet,
      _count: {
        items: pallet._count?.items ?? 0,
      },
    }));
  }

  async updateInventoryStatus(inventoryId: string, status: InventoryStatus) {
    return prisma.inventory.update({
      where: { id: inventoryId },
      data: { status },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });
  }

  async updateInventoryQuantity(inventoryId: string, quantity: number, status?: InventoryStatus) {
    const updateData: { quantity: number; status?: InventoryStatus; reserved?: number } = { 
      quantity: Math.max(0, quantity), // Ensure quantity is not negative
    };
    
    // If quantity is 0, automatically set status to OUT_OF_STOCK unless explicitly provided
    if (quantity === 0) {
      updateData.status = status || InventoryStatus.OUT_OF_STOCK;
      updateData.reserved = 0; // Reset reserved when out of stock
    } else {
      // If quantity > 0 and status provided, use it
      if (status) {
        updateData.status = status;
      }
    }
    
    return prisma.inventory.update({
      where: { id: inventoryId },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });
  }

  async assignItemToPallet(itemId: string, palletId: string | null) {
    return prisma.inventoryItem.update({
      where: { id: itemId },
      data: { palletId },
      include: {
        pallet: true,
        inventory: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });
  }

  async createInventoryItems(
    inventoryId: string,
    quantity: number,
    palletId?: string,
    orderId?: string
  ) {
    const items = [];
    for (let i = 0; i < quantity; i++) {
      const item = await prisma.inventoryItem.create({
        data: {
          inventoryId,
          palletId: palletId || null,
          orderId: orderId || null,
          status: orderId ? InventoryStatus.RESERVED : InventoryStatus.RECEIVED,
        },
        include: {
          pallet: true,
          inventory: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });
      items.push(item);
    }
    return items;
  }

  async createDeliveryQRCode(inventoryItemId: string, orderId?: string) {
    const code = uuidv4();
    // In a real application, here would be generated QR code image
    // and saved to storage, and the URL would be returned
    const qrCode = await prisma.deliveryQRCode.create({
      data: {
        inventoryItemId,
        orderId: orderId || null,
        code,
      },
      include: {
        inventoryItem: {
          include: {
            inventory: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    });

    return qrCode;
  }

  async getOrderInventoryItems(orderId: string) {
    return prisma.inventoryItem.findMany({
      where: { orderId },
      include: {
        inventory: {
          include: {
            warehouse: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                images: { take: 1, orderBy: { order: 'asc' } },
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        pallet: {
          select: {
            id: true,
            code: true,
            location: true,
          },
        },
        qrCodes: {
          where: { isUsed: false },
        },
      },
    });
  }

  /**
   * Returns warehouse for order: first by attached inventory items, then by order items (Inventory by productId/variantId).
   * Considers product-level (variantId null) and variant-level inventory.
   */
  async getOrderWarehouse(orderId: string): Promise<{ id: string; name: string; address: string | null; city: string | null; country: string | null } | null> {
    const items = await this.getOrderInventoryItems(orderId);
    const firstItem = items[0];
    if (firstItem?.inventory?.warehouse) {
      const w = firstItem.inventory.warehouse as { id: string; name: string; address: string | null; city: string | null; country: string | null };
      return w;
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order?.items?.length) return null;

    const warehouseShape = (inv: { warehouse: { id: string; name: string; address: string | null; city: string | null; country: string | null } }) =>
      inv.warehouse as { id: string; name: string; address: string | null; city: string | null; country: string | null };

    for (const orderItem of order.items) {
      const variantId = orderItem.variantId ?? null;
      // 1) Exact match: productId + variantId (or null)
      let inv = await prisma.inventory.findFirst({
        where: {
          productId: orderItem.productId,
          variantId,
        },
        include: { warehouse: true },
      });
      if (inv?.warehouse) return warehouseShape(inv);
      // 2) Product-level inventory (variantId null) when order has variant
      if (variantId !== null) {
        inv = await prisma.inventory.findFirst({
          where: {
            productId: orderItem.productId,
            variantId: null,
          },
          include: { warehouse: true },
        });
        if (inv?.warehouse) return warehouseShape(inv);
      }
      // 3) Any inventory for this product (any variant) — show at least one warehouse
      inv = await prisma.inventory.findFirst({
        where: { productId: orderItem.productId },
        include: { warehouse: true },
      });
      if (inv?.warehouse) return warehouseShape(inv);
    }
    return null;
  }

  async updateInventoryItemStatus(itemId: string, status: InventoryStatus) {
    return prisma.inventoryItem.update({
      where: { id: itemId },
      data: { status },
      include: {
        inventory: {
          include: {
            product: true,
            variant: true,
          },
        },
        pallet: true,
        order: true,
      },
    });
  }

  async markQRCodeAsUsed(qrCodeId: string) {
    return prisma.deliveryQRCode.update({
      where: { id: qrCodeId },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });
  }

  async resetAllInventory() {
    // Reset all inventory quantities to 0, reserved to 0, and status to OUT_OF_STOCK
    const result = await prisma.inventory.updateMany({
      data: {
        quantity: 0,
        reserved: 0,
        status: InventoryStatus.OUT_OF_STOCK,
      },
    });

    return {
      updatedCount: result.count,
      message: `Successfully reset ${result.count} inventory items`,
    };
  }

  async resetOrdersTicketsPayments() {
    // Get counts before deletion
    // Delete in correct order due to foreign key constraints
    const deletedMessages = await prisma.supportTicketMessage.deleteMany({});
    const deletedTickets = await prisma.supportTicket.deleteMany({});
    const deletedPayments = await prisma.paymentRequest.deleteMany({});
    const deletedHistory = await prisma.orderStatusHistory.deleteMany({});
    const deletedItems = await prisma.orderItem.deleteMany({});
    const deletedQRCodes = await prisma.deliveryQRCode.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    const deletedInventoryItems = await prisma.inventoryItem.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    const deletedOrders = await prisma.order.deleteMany({});

    return {
      orders: deletedOrders.count,
      orderItems: deletedItems.count,
      orderStatusHistory: deletedHistory.count,
      paymentRequests: deletedPayments.count,
      supportTickets: deletedTickets.count,
      ticketMessages: deletedMessages.count,
      deliveryQRCodes: deletedQRCodes.count,
      inventoryItems: deletedInventoryItems.count,
      message: `Successfully deleted ${deletedOrders.count} orders, ${deletedTickets.count} tickets, and ${deletedPayments.count} payment requests`,
    };
  }

  async resetAll() {
    // Reset inventory
    const inventoryResult = await prisma.inventory.updateMany({
      data: {
        quantity: 0,
        reserved: 0,
        status: InventoryStatus.OUT_OF_STOCK,
      },
    });

    // Delete orders, tickets, and payments
    const deletedMessages = await prisma.supportTicketMessage.deleteMany({});
    const deletedTickets = await prisma.supportTicket.deleteMany({});
    const deletedPayments = await prisma.paymentRequest.deleteMany({});
    const deletedHistory = await prisma.orderStatusHistory.deleteMany({});
    const deletedItems = await prisma.orderItem.deleteMany({});
    const deletedQRCodes = await prisma.deliveryQRCode.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    const deletedInventoryItems = await prisma.inventoryItem.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    const deletedOrders = await prisma.order.deleteMany({});

    return {
      inventory: {
        resetCount: inventoryResult.count,
      },
      orders: deletedOrders.count,
      orderItems: deletedItems.count,
      orderStatusHistory: deletedHistory.count,
      paymentRequests: deletedPayments.count,
      supportTickets: deletedTickets.count,
      ticketMessages: deletedMessages.count,
      deliveryQRCodes: deletedQRCodes.count,
      inventoryItems: deletedInventoryItems.count,
      message: `Successfully reset ${inventoryResult.count} inventory items and deleted ${deletedOrders.count} orders, ${deletedTickets.count} tickets, and ${deletedPayments.count} payment requests`,
    };
  }
}

export const adminService = new AdminService();
