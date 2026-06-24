import prisma from '../config/database';
import {
  CreateReturnRequestDto,
  ProcessReturnRequestDto,
} from '../types/return-request';
import {
  OrderStatus,
  PaymentStatus,
  InventoryStatus,
  Prisma,
} from '@prisma/client';

import { stripeService } from './stripe.service';
import { emailService } from './email.service';

export class ReturnService {
  /**
   * Create return request from customer
   */
  async createReturnRequest(
    userId: string,
    data: CreateReturnRequestDto
  ): Promise<any> {
    // Check if order belongs to user
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        items: true,
        user: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== userId) {
      throw new Error('Order does not belong to user');
    }

    // Check if order can be returned (status DELIVERED or SHIPPED)
    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.SHIPPED &&
      order.status !== OrderStatus.PROCESSING
    ) {
      throw new Error(
        'Return can only be requested for delivered, shipped, or processing orders'
      );
    }

    // Check if there is no active return request
    const existingRequest = await (prisma as any).returnRequest.findFirst({
      where: {
        orderId: data.orderId,
        status: {
          in: ['REQUESTED', 'APPROVED', 'PROCESSING'],
        },
      },
    });

    if (existingRequest) {
      throw new Error('Return request already exists for this order');
    }

    // Check if all orderItemId belong to order
    const orderItemIds = order.items.map((item) => item.id);
    const invalidItems = data.items.filter(
      (item) => !orderItemIds.includes(item.orderItemId)
    );
    if (invalidItems.length > 0) {
      throw new Error('Some order items do not belong to this order');
    }

    // Check quantity of returned items
    for (const returnItem of data.items) {
      const orderItem = order.items.find(
        (item) => item.id === returnItem.orderItemId
      );
      if (!orderItem) {
        throw new Error(`Order item ${returnItem.orderItemId} not found`);
      }
      if (returnItem.quantity > orderItem.quantity) {
        throw new Error(
          `Return quantity exceeds order quantity for item ${returnItem.orderItemId}`
        );
      }
    }

    // Create return request
    const returnRequest = await (prisma as any).returnRequest.create({
      data: {
        orderId: data.orderId,
        userId,
        reason: data.reason,
        customerNotes: data.customerNotes,
        items: {
          create: data.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            itemStatus: item.itemStatus,
            warehouseId: item.warehouseId,
          })),
        },
        statusHistory: {
          create: {
            status: 'REQUESTED',
            notes: `Return request created. Reason: ${data.reason}`,
          },
        },
      },
      include: {
        order: {
          include: {
            user: true,
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                product: {
                  include: {
                    images: { take: 1, orderBy: { order: 'asc' } },
                  },
                },
                variant: true,
              },
            },
          },
        },
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: data.orderId },
      data: {
        status: OrderStatus.RETURN_REQUESTED,
        statusHistory: {
          create: {
            status: OrderStatus.RETURN_REQUESTED,
            notes: `Return requested: ${data.reason}`,
          },
        },
      },
    });

    // Send notification to admins about new return request
    try {
      await this.notifyAdminsAboutNewReturnRequest(returnRequest, order);
    } catch (error) {
      console.error('Failed to send return request notification to admins:', error);
    }

    return returnRequest;
  }

  /**
   * Process return request by admin
   */
  async processReturnRequest(
    returnRequestId: string,
    data: ProcessReturnRequestDto,
    adminId: string
  ): Promise<any> {
    const returnRequest = await (prisma as any).returnRequest.findUnique({
      where: { id: returnRequestId },
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
            inventoryItems: true,
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    });

    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    const order = returnRequest.order;

    // Validation of required fields
    if (data.status === 'COMPLETED') {
      if (!data.refundMethod) {
        throw new Error('Refund method is required when completing return');
      }
      if (!data.refundAmount || data.refundAmount <= 0) {
        throw new Error('Refund amount must be greater than 0 when completing return');
      }
      if (data.refundAmount > Number(order.total)) {
        throw new Error('Refund amount cannot exceed order total');
      }
    }

    // Validation for items with RETURN_TO_SALE
    if (data.items) {
      for (const item of data.items) {
        const returnItem = returnRequest.items.find(
          (ri: { id: string }) => ri.id === item.returnRequestItemId
        );
        if (!returnItem) {
          continue;
        }

        const itemStatus = item.itemStatus || returnItem.itemStatus;
        if (itemStatus === 'RETURN_TO_SALE') {
          // Check if warehouseId is specified or will be taken from original InventoryItem
          // This is not critical, as we can use the original warehouse
          // But better to warn the admin
          if (!item.warehouseId && !returnItem.warehouseId) {
            // Warning, but not error - use the original warehouse
            console.warn(
              `No warehouse specified for return item ${item.returnRequestItemId}, will use source warehouse`
            );
          }
        }
      }
    }

    // Validation for APPROVED/PROCESSING - check pickupMethod if required
    if (
      (data.status === 'APPROVED' || data.status === 'PROCESSING') &&
      data.pickupMethod &&
      (data.pickupMethod === 'COURIER' || data.pickupMethod === 'POST')
    ) {
      if (!data.pickupAddress || data.pickupAddress.trim() === '') {
        throw new Error(
          'Pickup address is required when pickup method is COURIER or POST'
        );
      }
    }

    // Get current status for history
    const currentStatus = returnRequest.status;

    // Update return request status
    const updatedReturnRequest = await (prisma as any).returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status: data.status,
        processedBy: adminId,
        adminNotes: data.adminNotes,
        refundMethod: data.refundMethod,
        refundAmount: data.refundAmount
          ? new Prisma.Decimal(data.refundAmount)
          : null,
        refundProcessedAt:
          data.status === 'COMPLETED' ? new Date() : undefined,
        pickupMethod: data.pickupMethod,
        pickupAddress: data.pickupAddress,
        pickupDate: data.pickupDate ? new Date(data.pickupDate) : null,
        pickupNotes: data.pickupNotes,
        // Write history of changes, if status changed
        ...(currentStatus !== data.status && {
          statusHistory: {
            create: {
              status: data.status,
              notes: this.buildStatusHistoryNotes(
                currentStatus,
                data.status,
                data
              ),
              changedBy: adminId,
            },
          },
        }),
      },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
                variant: true,
              },
            },
            warehouse: true,
          },
        },
      },
    });

    // If status APPROVED or PROCESSING, update item statuses
    if (
      data.status === 'APPROVED' ||
      data.status === 'PROCESSING' ||
      data.status === 'COMPLETED'
    ) {
      // Update item statuses in inventory
      for (const returnItem of updatedReturnRequest.items) {
        const processItem = data.items?.find(
          (item) => item.returnRequestItemId === returnItem.id
        );
        const itemStatus = processItem?.itemStatus || returnItem.itemStatus;
        const targetWarehouseId = processItem?.warehouseId || returnItem.warehouseId;

        // Find InventoryItem associated with this order and item
        const inventoryItems = await prisma.inventoryItem.findMany({
          where: {
            orderId: order.id,
            inventory: {
              productId: returnItem.orderItem.productId,
              variantId: returnItem.orderItem.variantId || null,
            },
            status: {
              in: [
                InventoryStatus.IN_DELIVERY,
                InventoryStatus.DELIVERED,
                InventoryStatus.RESERVED,
              ],
            },
          },
          include: {
            inventory: true,
          },
          take: returnItem.quantity,
        });

        // Update InventoryItem statuses
        for (const inventoryItem of inventoryItems) {
          if (itemStatus === 'RETURN_TO_SALE') {
            // Return to sale
            await prisma.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: {
                status: InventoryStatus.RETURNED,
                orderId: null, // Remove link to order
                notes: `Returned to sale from order ${order.orderNumber}`,
              },
            });

            // Define target warehouse for return
            const sourceInventory = inventoryItem.inventory;
            const finalWarehouseId = targetWarehouseId || sourceInventory.warehouseId;

            // Define which warehouse to return the item to
            const isSameWarehouse = finalWarehouseId === sourceInventory.warehouseId;

            if (isSameWarehouse) {
              // Return to the same warehouse - simply increase quantity
              await prisma.inventory.update({
                where: { id: sourceInventory.id },
                data: {
                  quantity: { increment: inventoryItem.quantity },
                  status: InventoryStatus.IN_SALE,
                },
              });
            } else {
              // Return to another warehouse - create/update Inventory on the target warehouse
              // Do not decrease quantity on the original warehouse, as the item was already written off when the order was placed
              const targetInventory = await prisma.inventory.findUnique({
                where: {
                  productId_variantId_warehouseId: {
                    productId: returnItem.orderItem.productId,
                    variantId: returnItem.orderItem.variantId || null,
                    warehouseId: finalWarehouseId,
                  },
                },
              });

              if (targetInventory) {
                // Update existing Inventory on the target warehouse
                await prisma.inventory.update({
                  where: { id: targetInventory.id },
                  data: {
                    quantity: { increment: inventoryItem.quantity },
                    status: InventoryStatus.IN_SALE,
                  },
                });
              } else {
                // Create new Inventory on the target warehouse
                await prisma.inventory.create({
                  data: {
                    warehouseId: finalWarehouseId,
                    productId: returnItem.orderItem.productId,
                    variantId: returnItem.orderItem.variantId || null,
                    quantity: inventoryItem.quantity,
                    status: InventoryStatus.IN_SALE,
                    reserved: 0,
                  },
                });
              }
            }
          } else if (itemStatus === 'WRITE_OFF') {
            // Write off
            await prisma.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: {
                status: InventoryStatus.OUT_OF_STOCK,
                notes: `Written off from return for order ${order.orderNumber}`,
              },
            });
          }
        }

        // Update ReturnRequestItem status
        await (prisma as any).returnRequestItem.update({
          where: { id: returnItem.id },
          data: {
            itemStatus,
            warehouseId: targetWarehouseId || null,
            replacementProductId: processItem?.replacementProductId || null,
            replacementVariantId: processItem?.replacementVariantId || null,
          },
        });
      }

      // Send notification to warehouse
      await this.notifyWarehouse(updatedReturnRequest);

      // Process replacement of items, if specified
      await this.processReplacementOrders(updatedReturnRequest, order);
    }

    // Send notification to customer about return status
    try {
      const user = await prisma.user.findUnique({ where: { id: returnRequest.userId } });
      if (user && user.email) {
        await emailService.sendReturnRequestNotification(
          updatedReturnRequest.id,
          user.email,
          order.orderNumber,
          data.status,
          {
            pickupMethod: data.pickupMethod,
            pickupAddress: data.pickupAddress,
            pickupDate: data.pickupDate,
            pickupNotes: data.pickupNotes,
            refundMethod: data.refundMethod,
            refundAmount: data.refundAmount,
            adminNotes: data.adminNotes,
            items: updatedReturnRequest.items.map((item: any) => ({
              productName: item.orderItem.product.name,
              quantity: item.quantity,
              replacementProductId: item.replacementProductId,
              replacementVariantId: item.replacementVariantId,
            })),
          }
        );
      }
    } catch (error) {
      console.error('Failed to send return request notification:', error);
    }

    // If status COMPLETED, process refund
    if (data.status === 'COMPLETED' && data.refundMethod && data.refundAmount) {
      await this.processRefund(order, data.refundMethod, data.refundAmount);
    }

    // Update order status
    if (data.status === 'COMPLETED') {
      // Check if all items from the order have been returned
      const totalOrderQuantity = order.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0
      );
      const totalReturnedQuantity = updatedReturnRequest.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0
      );
      const allItemsReturned = totalOrderQuantity === totalReturnedQuantity;

      // Check if there are other active return requests for this order
      const otherActiveReturns = await (prisma as any).returnRequest.findMany({
        where: {
          orderId: order.id,
          id: { not: returnRequestId },
          status: {
            in: ['REQUESTED', 'APPROVED', 'PROCESSING'],
          },
        },
      });

      const hasOtherActiveReturns = otherActiveReturns.length > 0;

      // Update order status only if all items have been returned and there are no other active return requests
      if (allItemsReturned && !hasOtherActiveReturns) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.RETURNED,
            paymentStatus: PaymentStatus.REFUNDED,
            statusHistory: {
              create: {
                status: OrderStatus.RETURNED,
                notes: `Return completed. Refund: ${data.refundMethod}`,
              },
            },
          },
        });
      } else {
        // Partial return - update only payment status if return was completed
        const refundAmount = data.refundAmount ? Number(data.refundAmount) : 0;
        const orderTotal = Number(order.total);
        const isPartialRefund = refundAmount > 0 && refundAmount < orderTotal;

        // Update order status, but not change to RETURNED if partial return
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: hasOtherActiveReturns
              ? OrderStatus.RETURN_REQUESTED
              : OrderStatus.PROCESSING,
            paymentStatus: isPartialRefund
              ? PaymentStatus.PAID // Keep PAID if partial return
              : PaymentStatus.REFUNDED,
            statusHistory: {
              create: {
                status: hasOtherActiveReturns
                  ? OrderStatus.RETURN_REQUESTED
                  : OrderStatus.PROCESSING,
                notes: `Partial return completed. Refund: ${data.refundMethod}, Amount: ${refundAmount}`,
              },
            },
          },
        });
      }
    } else if (data.status === 'REJECTED') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: order.status, // Return to previous status
          statusHistory: {
            create: {
              status: order.status,
              notes: 'Return request rejected',
            },
          },
        },
      });
    }

    return updatedReturnRequest;
  }

  /**
   * Process refund
   */
  private async processRefund(
    order: any,
    refundMethod: string,
    refundAmount: number
  ): Promise<void> {
    if (refundMethod === 'STRIPE' && order.paymentMethod === 'GATEWAY') {
      try {
        // Get paymentIntentId from Stripe Checkout Session
        // To do this, we need to find checkout session by orderId in metadata
        const stripeConfig = await stripeService.getStripeConfig();
        if (!stripeConfig) {
          throw new Error('Stripe is not configured');
        }

        // Find checkout sessions with this orderId in metadata
        const sessions = await stripeConfig.stripe.checkout.sessions.list({
          limit: 100,
        });

        const session = sessions.data.find(
          (s) => s.metadata?.orderId === order.id && s.payment_intent
        );

        if (session && session.payment_intent) {
          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id;

          await stripeService.refundPayment(paymentIntentId, refundAmount);
          console.log(
            `Refund processed via Stripe: ${refundAmount} for order ${order.orderNumber}`
          );
        } else {
          throw new Error('Payment intent not found for this order');
        }
      } catch (error) {
        console.error('Failed to process Stripe refund:', error);
        throw error;
      }
    } else if (refundMethod === 'BANK_TRANSFER' || refundMethod === 'MANUAL') {
      // For bank transfer and manual refund, simply mark in the system
      // Admin should handle refund manually
      console.log(
        `Manual refund required: ${refundAmount} for order ${order.orderNumber}`
      );
    }
  }

  /**
   * Build notes for history of status changes
   */
  private buildStatusHistoryNotes(
    oldStatus: string,
    newStatus: string,
    data: ProcessReturnRequestDto
  ): string {
    const notes: string[] = [`Status changed from ${oldStatus} to ${newStatus}`];

    if (data.adminNotes) {
      notes.push(`Admin notes: ${data.adminNotes}`);
    }

    if (data.pickupMethod) {
      notes.push(`Pickup method: ${data.pickupMethod}`);
    }

    if (data.refundMethod && data.refundAmount) {
      notes.push(
        `Refund: ${data.refundMethod}, Amount: ${data.refundAmount}`
      );
    }

    return notes.join('. ');
  }

  /**
   * Process replacement orders
   */
  private async processReplacementOrders(
    returnRequest: any,
    originalOrder: any
  ): Promise<void> {
    try {
      // Find items with specified replacementProductId
      const itemsWithReplacement = returnRequest.items.filter(
        (item: any) => item.replacementProductId
      );

      if (itemsWithReplacement.length === 0) {
        return; // No items for replacement
      }

      // Get shipping address from original order
      const shippingAddress = await prisma.customerAddress.findUnique({
        where: { id: originalOrder.shippingAddressId },
      });

      if (!shippingAddress) {
        console.error(
          `Shipping address not found for order ${originalOrder.orderNumber}`
        );
        return;
      }

      // Group items for replacement by replacementProductId and replacementVariantId
      const replacementGroups: Record<
        string,
        Array<{ item: any; quantity: number }>
      > = {};

      for (const returnItem of itemsWithReplacement) {
        const key = `${returnItem.replacementProductId}-${returnItem.replacementVariantId || 'no-variant'}`;
        if (!replacementGroups[key]) {
          replacementGroups[key] = [];
        }
        replacementGroups[key].push({
          item: returnItem,
          quantity: returnItem.quantity,
        });
      }

      // Create replacement orders for each group
      for (const [key, group] of Object.entries(replacementGroups)) {
        const [productId, variantIdStr] = key.split('-');
        const variantId = variantIdStr === 'no-variant' ? null : variantIdStr;

        // Get information about the replacement product
        const replacementProduct = await prisma.product.findUnique({
          where: { id: productId },
          include: {
            variants: variantId ? { where: { id: variantId } } : true,
          },
        });

        if (!replacementProduct) {
          console.error(`Replacement product ${productId} not found`);
          continue;
        }

        const variants = (replacementProduct as { variants?: { id: string }[] }).variants;
        const replacementVariant = variantId && variants
          ? variants.find((v: { id: string }) => v.id === variantId)
          : null;

        // Calculate total quantity for replacement
        const totalQuantity = group.reduce(
          (sum, g) => sum + g.quantity,
          0
        );

        // Define price for replacement product
        const variantWithPrice = replacementVariant as { price?: unknown; size?: string } | null;
        let price: Prisma.Decimal | null = null;
        if (!replacementProduct.priceOnRequest) {
          price = variantWithPrice?.price != null
            ? new Prisma.Decimal(Number(variantWithPrice.price))
            : replacementProduct.price != null
            ? new Prisma.Decimal(replacementProduct.price)
            : null;
        }

        // Create replacement order (free or with discount)
        const orderNumber = `EXCH-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`;

        const exchangeOrder = await prisma.order.create({
          data: {
            userId: returnRequest.userId,
            orderNumber,
            shippingAddressId: originalOrder.shippingAddressId,
            paymentMethod: originalOrder.paymentMethod,
            paymentGatewayType: originalOrder.paymentGatewayType,
            checkoutCurrency: originalOrder.checkoutCurrency || 'USD',
            checkoutFxCapturedAt: originalOrder.checkoutFxCapturedAt ?? undefined,
            checkoutFxRatesSnapshot: originalOrder.checkoutFxRatesSnapshot ?? undefined,
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            subtotal: price ? price.mul(totalQuantity) : new Prisma.Decimal(0),
            tax: new Prisma.Decimal(0), // Tax is not applied to replacement
            shipping: new Prisma.Decimal(0), // Free shipping for replacement
            total: new Prisma.Decimal(0), // Free order for customer
            notes: `Exchange order for return request ${returnRequest.id}. Original order: ${originalOrder.orderNumber}`,
            items: {
              create: {
                productId,
                variantId,
                size: variantWithPrice?.size ?? null,
                quantity: totalQuantity,
                price: new Prisma.Decimal(0), // Free for customer
              },
            },
            statusHistory: {
              create: {
                status: OrderStatus.PENDING,
                notes: `Exchange order created for return request ${returnRequest.id}`,
              },
            },
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
          },
        });

        // Send notification to customer about creation of replacement order
        try {
          const user = await prisma.user.findUnique({
            where: { id: returnRequest.userId },
          });
          if (user && user.email) {
            await emailService.sendOrderConfirmation(
              exchangeOrder.id,
              user.email,
              exchangeOrder.orderNumber,
              {
                items: exchangeOrder.items.map((item: any) => ({
                  name:
                    item.variant?.name ||
                    item.product.name,
                  quantity: item.quantity,
                  price: 0, // Free
                  size: item.size,
                })),
                total: 0,
              },
              user.preferredLanguage ?? undefined
            );
          }
        } catch (error) {
          console.error(
            'Failed to send exchange order confirmation email:',
            error
          );
        }

        console.log(
          `Exchange order ${exchangeOrder.orderNumber} created for return request ${returnRequest.id}`
        );
      }
    } catch (error) {
      console.error('Failed to process replacement orders:', error);
      // Do not interrupt return processing due to error in creating replacement order
    }
  }

  /**
   * Notify admins about new return request
   */
  private async notifyAdminsAboutNewReturnRequest(
    returnRequest: any,
    order: any
  ): Promise<void> {
    try {
      // Get all admins
      const { UserRole } = await import('@prisma/client');
      const admins = await prisma.user.findMany({
        where: {
          role: {
            in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          },
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (admins.length === 0) {
        console.log('No admins found to notify about return request');
        return;
      }

      // Get information about items for return
      const itemsInfo = returnRequest.items.map((item: any) => ({
        productName: item.orderItem.product.name,
        quantity: item.quantity,
        size: item.orderItem.size,
      }));

      const { resolveFrontendBaseUrl } = await import('../utils/frontend-url');
      const baseUrl = await resolveFrontendBaseUrl();

      // Send notifications to all admins
      for (const admin of admins) {
        try {
          const adminName = admin.firstName || admin.email;
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New return request</h2>
              <p>Hello, ${adminName}!</p>
              <p>New return request:</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Order number:</strong> ${order.orderNumber}</p>
                <p><strong>Customer:</strong> ${order.user.email}${order.user.firstName ? ` (${order.user.firstName} ${order.user.lastName || ''})` : ''}</p>
                <p><strong>Return reason:</strong> ${this.getReasonLabel(returnRequest.reason)}</p>
                <p><strong>Number of items:</strong> ${returnRequest.items.length}</p>
                ${returnRequest.customerNotes ? `<p><strong>Customer notes:</strong> ${returnRequest.customerNotes}</p>` : ''}
              </div>
              <h3>Items for return:</h3>
              <ul>
                ${itemsInfo.map((item: any) => `<li>${item.productName}${item.size ? ` (Size: ${item.size})` : ''} - Quantity: ${item.quantity}</li>`).join('')}
              </ul>
              <div style="margin-top: 30px;">
                <a href="${baseUrl}/admin/returns?orderId=${order.id}" 
                   style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Process request
                </a>
              </div>
            </div>
          `;

          const text = `New return request\n\nOrder: ${order.orderNumber}\nCustomer: ${order.user.email}\nReason: ${this.getReasonLabel(returnRequest.reason)}\n\nProcess: ${baseUrl}/admin/returns?orderId=${order.id}`;

          await emailService.sendEmail(
            admin.email,
            `New return request - Order ${order.orderNumber}`,
            html,
            text,
            'RETURN_REQUEST_NOTIFICATION',
            admin.id,
            order.id
          );
        } catch (error) {
          console.error(
            `Failed to send notification to admin ${admin.email}:`,
            error
          );
        }
      }

      console.log(
        `Notifications sent to ${admins.length} admin(s) about return request ${returnRequest.id}`
      );
    } catch (error) {
      console.error('Failed to notify admins about return request:', error);
    }
  }

  /**
   * Get text description of return reason
   */
  private getReasonLabel(reason: string): string {
    const reasonLabels: Record<string, string> = {
      PRODUCT_NOT_DELIVERED: 'Product not delivered',
      CUSTOMER_NOT_RECEIVED: 'Customer did not receive product',
      CUSTOMER_REQUESTED: 'Customer requested return',
    };
    return reasonLabels[reason] || reason;
  }

  /**
   * Notify warehouse about return
   */
  private async notifyWarehouse(returnRequest: any): Promise<void> {
    try {
      // Collect information about items for return
      const warehouseItems: Record<string, any[]> = {};

      for (const item of returnRequest.items) {
        const warehouseId = item.warehouseId || 'default';
        if (!warehouseItems[warehouseId]) {
          warehouseItems[warehouseId] = [];
        }

        warehouseItems[warehouseId].push({
          productName: item.orderItem.product.name,
          size: item.orderItem.size,
          quantity: item.quantity,
          status: item.itemStatus,
        });
      }

      // Send notifications to warehouses
      for (const [warehouseId, items] of Object.entries(warehouseItems)) {
        const warehouse = await prisma.warehouse.findUnique({
          where: { id: warehouseId },
        });

        if (warehouse) {
          // Create record in EmailNotification for warehouse notification
          await prisma.emailNotification.create({
            data: {
              type: 'RETURN_NOTIFICATION',
              subject: `Return Request for Order ${returnRequest.order.orderNumber}`,
              body: JSON.stringify({
                warehouseId: warehouse.id,
                warehouseName: warehouse.name,
                orderNumber: returnRequest.order.orderNumber,
                items,
                returnRequestId: returnRequest.id,
              }),
              status: 'PENDING',
            },
          });

          console.log(
            `Warehouse notification created for ${warehouse.name} about return request ${returnRequest.id}`
          );
        }
      }
    } catch (error) {
      console.error('Failed to notify warehouse:', error);
    }
  }

  /**
   * Get all return requests
   */
  async getAllReturnRequests(filters?: {
    status?: string;
    orderId?: string;
    userId?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ returnRequests: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = filters?.page ?? 1;
    const limit = Math.min(50, Math.max(1, filters?.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.orderId) where.orderId = filters.orderId;
    if (filters?.userId) where.userId = filters.userId;
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

    const [returnRequests, total] = await Promise.all([
      (prisma as any).returnRequest.findMany({
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
                },
              },
            },
          },
          items: {
            include: {
              orderItem: {
                include: {
                  product: {
                    include: {
                      images: { take: 1, orderBy: { order: 'asc' } },
                    },
                  },
                  variant: true,
                },
              },
              warehouse: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      (prisma as any).returnRequest.count({ where }),
    ]);

    return {
      returnRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
  * Get return request by ID
   */
  async getReturnRequestById(returnRequestId: string): Promise<any> {
    return (prisma as any).returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: {
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
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                product: {
                  include: {
                    images: { take: 1, orderBy: { order: 'asc' } },
                  },
                },
                variant: true,
              },
            },
            warehouse: true,
          },
        },
      },
    });
  }
}

export const returnService = new ReturnService();
