import prisma from '../config/database';
import { CreatePaymentRequestDto, UpdatePaymentRequestDto } from '../types/payment-request';
import { PaymentStatus, OrderStatus, InventoryStatus } from '@prisma/client';
import { cartService } from './cart.service';

/** Unpaid manual payment (bank transfer, P2P, COD, manager chat) auto-cancel after this TTL. */
export const MANUAL_PAYMENT_PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export class PaymentRequestService {
  async getAll(filters?: {
    status?: string;
    orderId?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = filters?.page ?? 1;
    const limit = Math.min(50, Math.max(1, filters?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.orderId) where.orderId = filters.orderId;
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

    const [requests, total] = await Promise.all([
      prisma.paymentRequest.findMany({
        where,
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
              items: {
                include: {
                  product: {
                    include: {
                      images: {
                        take: 1,
                        orderBy: { order: 'asc' },
                      },
                    },
                  },
                  variant: true,
                },
              },
              shippingAddress: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.paymentRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
          },
        },
      },
    });
  }

  async getByOrderId(orderId: string) {
    return prisma.paymentRequest.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
          },
        },
      },
    });
  }

  async create(data: CreatePaymentRequestDto, updatedBy?: string) {
    // Check if order exists and doesn't have payment request
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { paymentRequest: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.paymentRequest) {
      throw new Error('Payment request already exists for this order');
    }

    return prisma.paymentRequest.create({
      data: {
        orderId: data.orderId,
        bankDetails: data.bankDetails as any,
        p2pDetails: data.p2pDetails as any,
        cashOnDeliveryDetails: data.cashOnDeliveryDetails as any,
        updatedBy,
      },
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdatePaymentRequestDto, updatedBy?: string) {
    const updateData: any = {
      ...(data.status && { status: data.status }),
      ...(data.bankDetails !== undefined && { bankDetails: data.bankDetails ? (data.bankDetails as any) : null }),
      ...(data.p2pDetails !== undefined && { p2pDetails: data.p2pDetails ? (data.p2pDetails as any) : null }),
      ...(data.cashOnDeliveryDetails !== undefined && { cashOnDeliveryDetails: data.cashOnDeliveryDetails ? (data.cashOnDeliveryDetails as any) : null }),
      ...(data.paymentProof !== undefined && { paymentProof: data.paymentProof }),
      ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
      ...(data.logisticsInfo !== undefined && { logisticsInfo: data.logisticsInfo ? (data.logisticsInfo as any) : null }),
      ...(updatedBy && { updatedBy }),
    };

    // Update timestamps based on status changes
    if (data.status === 'PAID') {
      updateData.paidAt = new Date();
    }
    if (data.logisticsInfo && typeof data.logisticsInfo === 'object' && 'shippedDate' in data.logisticsInfo && data.logisticsInfo.shippedDate) {
      updateData.shippedAt = new Date(data.logisticsInfo.shippedDate as string);
    }

    const paymentRequest = await prisma.paymentRequest.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
          },
        },
      },
    });

    // Update order status and payment status based on payment request status
    if (data.status === 'PAID') {
      const order = await prisma.order.update({
        where: { id: paymentRequest.orderId },
        data: { paymentStatus: PaymentStatus.PAID },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      // Update inventory: move from reserved to IN_DELIVERY and decrease quantity
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

        // Find inventory and update
        const inventories = await prisma.inventory.findMany({
          where: {
            productId: orderItem.productId,
            variantId: targetVariantId || null,
            reserved: { gt: 0 },
          },
          orderBy: { reserved: 'desc' },
        });

        let remainingQuantity = orderItem.quantity;
        
        for (const inventory of inventories) {
          if (remainingQuantity <= 0) break;
          
          const toProcess = Math.min(remainingQuantity, inventory.reserved);
          
          await prisma.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: { decrement: toProcess },
              reserved: { decrement: toProcess },
              status: InventoryStatus.IN_DELIVERY,
            },
          });
          
          remainingQuantity -= toProcess;
        }
      }
    } else if (data.status === 'CANCELLED') {
      // When payment request is cancelled, cancel the order and release reserved inventory
      const order = await prisma.order.update({
        where: { id: paymentRequest.orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
        },
        include: { items: true },
      });
      const itemsToRelease = order.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        quantity: item.quantity,
      }));
      await cartService.releaseReservationForOrderItems(itemsToRelease);
    }

    return paymentRequest;
  }

  /**
   * Cancel stale manual-payment requests (bank transfer, P2P, COD, manager chat) after
   * {@link MANUAL_PAYMENT_PENDING_TTL_MS}. Releases reserved inventory via order cancel.
   */
  async releaseExpiredPendingPaymentRequests(): Promise<{ cancelled: number }> {
    const cutoff = new Date(Date.now() - MANUAL_PAYMENT_PENDING_TTL_MS);

    const expiredRequests = await prisma.paymentRequest.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
        order: {
          paymentStatus: PaymentStatus.PENDING,
        },
      },
      select: {
        id: true,
      },
    });

    for (const request of expiredRequests) {
      try {
        await this.update(request.id, { status: 'CANCELLED' });
      } catch (error) {
        console.error(`[PaymentRequest] Failed to cancel expired request ${request.id}:`, error);
      }
    }

    if (expiredRequests.length > 0) {
      console.log(`[PaymentRequest] Cancelled ${expiredRequests.length} expired pending payment request(s)`);
    }

    return { cancelled: expiredRequests.length };
  }

  async markAsNotified(id: string) {
    return prisma.paymentRequest.update({
      where: { id },
      data: { notifiedAt: new Date() },
    });
  }

  async markAsPaidByCustomer(id: string) {
    // Customer marks payment as done - only set paidAt, keep status as PENDING
    // Admin will later confirm and change status to PAID
    const paymentRequest = await prisma.paymentRequest.update({
      where: { id },
      data: {
        paidAt: new Date(),
        status: 'PENDING', // Explicitly keep status as PENDING
      },
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
          },
        },
      },
    });

    console.log('[markAsPaidByCustomer] Updated payment request:', {
      id: paymentRequest.id,
      status: paymentRequest.status,
      paidAt: paymentRequest.paidAt,
    });

    return paymentRequest;
  }

  async markAsPaid(id: string, updatedBy?: string) {
    const paymentRequest = await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        updatedBy,
      },
      include: {
        order: {
          include: {
            user: true,
            promoCode: true,
          },
        },
      },
    });

    // Update order payment status
    const updatedOrder = await prisma.order.update({
      where: { id: paymentRequest.orderId },
      data: { paymentStatus: PaymentStatus.PAID },
      include: {
        promoCode: true,
      },
    });

    // Create partner commission if order has partner promo code
    if (updatedOrder.promoCode?.isPartnerPromo && updatedOrder.promoCode.partnerId && updatedOrder.promoCode.partnerCommissionRate) {
      try {
        const { partnerCommissionService } = await import('./partner-commission.service');
        await partnerCommissionService.createCommission(
          updatedOrder.promoCode.partnerId,
          updatedOrder.id,
          updatedOrder.promoCode.id,
          Number(updatedOrder.total),
          Number(updatedOrder.promoCode.partnerCommissionRate)
        );
      } catch (error) {
        console.error('Failed to create partner commission:', error);
        // Don't fail the payment confirmation if commission creation fails
      }
    }

    return paymentRequest;
  }

  async markAsShipped(id: string, logisticsInfo: any, updatedBy?: string) {
    const shippedAt =
      logisticsInfo?.shippedDate ? new Date(logisticsInfo.shippedDate as string) : new Date();

    const paymentRequest = await prisma.paymentRequest.update({
      where: { id },
      data: {
        logisticsInfo: logisticsInfo as any,
        shippedAt,
        updatedBy,
      },
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
          },
        },
      },
    });

    // Update order status and shippedAt for reports (delivery, accounting, sales)
    const orderUpdate: { status?: OrderStatus; shippedAt?: Date } = { shippedAt };
    if (paymentRequest.order.status !== OrderStatus.SHIPPED && paymentRequest.order.status !== OrderStatus.DELIVERED) {
      orderUpdate.status = OrderStatus.SHIPPED;
      await prisma.order.update({
        where: { id: paymentRequest.orderId },
        data: orderUpdate,
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: paymentRequest.orderId,
          status: OrderStatus.SHIPPED,
          notes: 'orderDetail.statusHistory.orderShipped',
        },
      });
    } else {
      await prisma.order.update({
        where: { id: paymentRequest.orderId },
        data: { shippedAt },
      });
    }

    return paymentRequest;
  }

  /**
   * Get or create PaymentRequest for paid orders that don't have one (e.g. GATEWAY payments).
   * Allows adding delivery info for orders paid via gateway where PaymentRequest was never created.
   */
  async getOrCreateForShipping(orderId: string, updatedBy?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentRequest: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.paymentRequest) {
      return order.paymentRequest;
    }

    // Only create for PAID orders (e.g. GATEWAY - no PaymentRequest was created at checkout)
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new Error('Payment request not found for this order. Order must be paid before adding delivery info.');
    }

    return prisma.paymentRequest.create({
      data: {
        orderId: order.id,
        status: 'PAID',
        paidAt: new Date(),
        updatedBy,
      },
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            shippingAddress: true,
          },
        },
      },
    });
  }

  /**
   * Mark order as shipped by orderId. Creates PaymentRequest if needed for GATEWAY-paid orders.
   */
  async markAsShippedByOrderId(orderId: string, logisticsInfo: any, updatedBy?: string) {
    const paymentRequest = await this.getOrCreateForShipping(orderId, updatedBy);
    return this.markAsShipped(paymentRequest.id, logisticsInfo, updatedBy);
  }
}

export const paymentRequestService = new PaymentRequestService();
