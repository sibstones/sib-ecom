import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { SalesPointType, OrderStatus, PaymentStatus, OrderSource } from '@prisma/client';

export class SalesPointService {
  async getAll() {
    return prisma.salesPoint.findMany({
      where: {},
      include: {
        warehouse: {
          select: { id: true, name: true, address: true, city: true, country: true },
        },
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const point = await prisma.salesPoint.findUnique({
      where: { id },
      include: {
        warehouse: true,
        products: {
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
              select: { id: true, name: true, sku: true },
            },
            warehouse: {
              select: { id: true, name: true },
            },
          },
        },
        _count: { select: { orders: true } },
      },
    });
    if (!point) throw new Error('Sales point not found');
    return point;
  }

  async create(data: {
    name: string;
    type: SalesPointType;
    warehouseId?: string | null;
    externalId?: string | null;
    settings?: Record<string, unknown> | null;
  }) {
    if (data.type === 'STORE_OFFLINE' && !data.warehouseId) {
      throw new Error('Warehouse is required for offline store');
    }
    return prisma.salesPoint.create({
      data: {
        name: data.name,
        type: data.type,
        warehouseId: data.warehouseId ?? null,
        externalId: data.externalId ?? null,
        settings: (data.settings ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: {
        warehouse: { select: { id: true, name: true } },
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      isActive?: boolean;
      warehouseId?: string | null;
      externalId?: string | null;
      settings?: Record<string, unknown> | null;
    }
  ) {
    const existing = await prisma.salesPoint.findUnique({ where: { id } });
    if (!existing) throw new Error('Sales point not found');
    if (existing.type === 'STORE_OFFLINE' && data.warehouseId === null) {
      throw new Error('Warehouse cannot be removed from offline store');
    }
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId;
    if (data.externalId !== undefined) updateData.externalId = data.externalId;
    if (data.settings !== undefined) updateData.settings = data.settings;
    return prisma.salesPoint.update({
      where: { id },
      data: updateData as any,
      include: {
        warehouse: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string) {
    const count = await prisma.salesPointProduct.count({ where: { salesPointId: id } });
    if (count > 0) {
      throw new Error('Cannot delete: sales point has products. Remove products first.');
    }
    return prisma.salesPoint.delete({ where: { id } });
  }

  async getProducts(salesPointId: string) {
    return prisma.salesPointProduct.findMany({
      where: { salesPointId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        variant: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
  }

  async addProduct(
    salesPointId: string,
    data: {
      productId: string;
      variantId?: string | null;
      warehouseId?: string | null;
      maxQuantity?: number | null;
    }
  ) {
    const point = await prisma.salesPoint.findUnique({ where: { id: salesPointId } });
    if (!point) throw new Error('Sales point not found');
    if (point.type === 'MARKETPLACE' && !data.warehouseId) {
      throw new Error('Warehouse is required for marketplace products');
    }
    const existing = await prisma.salesPointProduct.findFirst({
      where: {
        salesPointId,
        productId: data.productId,
        variantId: data.variantId ?? null,
      },
    });
    if (existing) throw new Error('Product already in this sales point');
    return prisma.salesPointProduct.create({
      data: {
        salesPointId,
        productId: data.productId,
        variantId: data.variantId ?? null,
        warehouseId: data.warehouseId ?? null,
        maxQuantity: data.maxQuantity ?? null,
      },
      include: {
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
  }

  async removeProduct(salesPointId: string, salesPointProductId: string) {
    const item = await prisma.salesPointProduct.findFirst({
      where: { id: salesPointProductId, salesPointId },
    });
    if (!item) throw new Error('Product not found in this sales point');
    return prisma.salesPointProduct.delete({
      where: { id: salesPointProductId },
    });
  }

  async updateProduct(
    id: string,
    data: { warehouseId?: string | null; maxQuantity?: number | null; isActive?: boolean }
  ) {
    return prisma.salesPointProduct.update({
      where: { id },
      data: {
        ...(data.warehouseId !== undefined && { warehouseId: data.warehouseId }),
        ...(data.maxQuantity !== undefined && { maxQuantity: data.maxQuantity }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
  }

  /** Create order from sales point (manual import) */
  async createOrderFromSalesPoint(
    salesPointId: string,
    data: {
      userId: string;
      shippingAddressId: string;
      items: Array<{ productId: string; variantId?: string | null; quantity: number; price: number }>;
      notes?: string | null;
    }
  ) {
    const point = await prisma.salesPoint.findUnique({
      where: { id: salesPointId },
      include: { products: true, warehouse: true },
    });
    if (!point) throw new Error('Sales point not found');
    if (!point.isActive) throw new Error('Sales point is not active');

    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new Error('User not found');

    const address = await prisma.customerAddress.findFirst({
      where: { id: data.shippingAddressId, userId: data.userId },
    });
    if (!address) throw new Error('Shipping address not found or does not belong to user');

    if (!data.items.length) throw new Error('Order must have at least one item');

    let fulfillmentWarehouseId: string | null = null;
    const orderItems: Array<{
      productId: string;
      variantId: string | null;
      size: string | null;
      quantity: number;
      price: Prisma.Decimal;
    }> = [];

    let subtotal = new Prisma.Decimal(0);
    for (const item of data.items) {
      const spProduct = point.products.find((p) => {
        if (p.productId !== item.productId) return false;
        const pVariant = p.variantId ?? null;
        const iVariant = item.variantId ?? null;
        return pVariant === iVariant || pVariant === null;
      });
      if (!spProduct) {
        throw new Error(`Product ${item.productId} (variant ${item.variantId ?? 'any'}) is not in this sales point`);
      }
      if (!spProduct.isActive) throw new Error(`Product ${item.productId} is disabled in this sales point`);

      const warehouseId = spProduct.warehouseId ?? point.warehouseId;
      if (!fulfillmentWarehouseId && warehouseId) fulfillmentWarehouseId = warehouseId;

      const price = new Prisma.Decimal(item.price);
      const itemTotal = price.mul(item.quantity);
      subtotal = subtotal.add(itemTotal);

      let size: string | null = null;
      if (item.variantId) {
        const v = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
          select: { size: true },
        });
        if (v?.size) size = v.size;
      }

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        size,
        quantity: item.quantity,
        price,
      });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const tax = new Prisma.Decimal(0);
    const shipping = new Prisma.Decimal(0);
    const total = subtotal.add(tax).add(shipping);

    const orderSource: OrderSource = point.type === 'MARKETPLACE' ? OrderSource.MARKETPLACE_OTHER : OrderSource.STORE_OFFLINE;

    let checkoutFxCapturedAt: Date | undefined;
    let checkoutFxRatesSnapshot: Prisma.InputJsonValue | undefined;
    try {
      const { currencyRateService } = await import('./currency-rate.service');
      const rates = await currencyRateService.getActive();
      checkoutFxRatesSnapshot = rates as unknown as Prisma.InputJsonValue;
      checkoutFxCapturedAt = new Date();
    } catch {
      // optional
    }

    const order = await prisma.order.create({
      data: {
        userId: data.userId,
        orderNumber,
        shippingAddressId: data.shippingAddressId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: 'BANK_TRANSFER',
        paymentGatewayType: null,
        checkoutCurrency: 'USD',
        checkoutFxCapturedAt,
        checkoutFxRatesSnapshot,
        subtotal,
        tax,
        shipping,
        total,
        notes: data.notes ?? null,
        orderSource,
        fulfillmentWarehouseId,
        salesPointId,
        items: { create: orderItems },
        statusHistory: {
          create: {
            status: OrderStatus.PENDING,
            notes: 'orderDetail.statusHistory.orderCreated',
          },
        },
      },
      include: {
        items: { include: { product: true, variant: true } },
        shippingAddress: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        salesPoint: { select: { id: true, name: true, type: true } },
      },
    });

    return order;
  }
}

export const salesPointService = new SalesPointService();
