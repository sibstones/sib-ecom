import { Request, Response } from 'express';
import { stripeService } from '../services/stripe.service';
import { customerService } from '../services/customer.service';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { emailService } from '../services/email.service';
import { convertUsdForOrderPayment } from '../services/order-pricing.service';
import { verifyGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';

type OrderForStripe = NonNullable<Awaited<ReturnType<typeof customerService.getOrder>>>;

async function buildStripeLineItemsFromOrder(order: OrderForStripe): Promise<
  Array<{ name: string; quantity: number; amount: number }>
> {
  const toPay = async (amountUsd: number) => convertUsdForOrderPayment(amountUsd, order);

  const lineItems: { name: string; quantity: number; amount: number }[] = [];
  for (const item of order.items) {
    const unitUsd = Number(item.price || 0);
    lineItems.push({
      name: `${item.product.name}${item.variant ? ` - ${item.variant.name}` : ''}${item.size ? ` (${item.size})` : ''}`,
      quantity: item.quantity,
      amount: unitUsd > 0 ? await toPay(unitUsd) : 0,
    });
  }

  if (Number(order.shipping) > 0) {
    lineItems.push({
      name: 'Shipping',
      quantity: 1,
      amount: await toPay(Number(order.shipping)),
    });
  }

  if (Number(order.tax) > 0) {
    lineItems.push({
      name: 'Tax',
      quantity: 1,
      amount: await toPay(Number(order.tax)),
    });
  }

  return lineItems;
}

export class StripeController {
  async createCheckoutSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { orderId } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
      }

      // Get order
      const order = await customerService.getOrder(userId, orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Check if order is already paid
      if (order.paymentStatus === 'PAID') {
        res.status(400).json({ error: 'Order is already paid' });
        return;
      }

      // Check if payment method is GATEWAY
      if (order.paymentMethod !== 'GATEWAY') {
        res.status(400).json({ error: 'Order payment method is not GATEWAY' });
        return;
      }

      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user?.email) {
        res.status(400).json({ error: 'User email is required' });
        return;
      }

      const payCurrency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
      const lineItems = await buildStripeLineItemsFromOrder(order);

      const { sessionId, url } = await stripeService.createCheckoutSession(
        order.id,
        order.orderNumber,
        payCurrency,
        user.email,
        lineItems
      );

      // Store session ID in order metadata (optional, can be stored in a separate table)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          // Store session ID in notes or create a separate field
        },
      });

      res.json({ sessionId, url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      });
    }
  }

  /** Guest checkout: token proves email owns the order (see guest-checkout-token). */
  async createGuestCheckoutSession(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, token } = req.body as { orderId?: string; token?: string };
      if (!orderId || !token) {
        res.status(400).json({ error: 'orderId and token are required' });
        return;
      }
      const payload = verifyGuestCheckoutPaymentToken(token);
      if (!payload || payload.orderId !== orderId) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      const order = await customerService.getOrderForGuestCheckout(orderId, payload.email);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      if (order.paymentStatus === 'PAID') {
        res.status(400).json({ error: 'Order is already paid' });
        return;
      }
      if (order.paymentMethod !== 'GATEWAY') {
        res.status(400).json({ error: 'Order payment method is not GATEWAY' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { email: true },
      });
      if (!user?.email) {
        res.status(400).json({ error: 'User email is required' });
        return;
      }

      const payCurrency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
      const lineItems = await buildStripeLineItemsFromOrder(order);
      const { sessionId, url } = await stripeService.createCheckoutSession(
        order.id,
        order.orderNumber,
        payCurrency,
        user.email,
        lineItems
      );

      res.json({ sessionId, url });
    } catch (error) {
      console.error('Error creating guest checkout session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      });
    }
  }

  async getGuestSessionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
      if (!sessionId || !token) {
        res.status(400).json({ error: 'Session ID and token are required' });
        return;
      }
      const payload = verifyGuestCheckoutPaymentToken(token);
      if (!payload) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      const session = await stripeService.getCheckoutSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const metaOrderId = session.metadata?.orderId;
      if (!metaOrderId || metaOrderId !== payload.orderId) {
        res.status(403).json({ error: 'Session does not match order' });
        return;
      }

      const order = await customerService.getOrderForGuestCheckout(payload.orderId, payload.email);
      if (!order || order.id !== metaOrderId) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.json({
        sessionId: session.id,
        paymentStatus: session.payment_status,
        status: session.status,
        orderId: session.metadata?.orderId,
      });
    } catch (error) {
      console.error('Error getting guest session status:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get session status',
      });
    }
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event;
    try {
      event = await stripeService.verifyWebhookSignature(
        req.body,
        sig as string
      );
    } catch (error) {
      console.error('Webhook verification failed:', error);
      res.status(400).json({ error: 'Webhook verification failed' });
      return;
    }

    if (!event) {
      res.status(400).json({ error: 'Invalid webhook event' });
      return;
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const orderId = session.metadata?.orderId;

          if (orderId) {
            // Update order payment status
            const order = await prisma.order.findUnique({
              where: { id: orderId },
              include: {
                user: true,
              },
            });

            if (order && order.paymentStatus !== 'PAID') {
              const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: {
                  paymentStatus: PaymentStatus.PAID,
                  statusHistory: {
                    create: {
                      status: order.status,
                      notes: 'orderDetail.statusHistory.paymentReceived',
                    },
                  },
                },
                include: {
                  promoCode: true,
                },
              });

              // Create partner commission if order has partner promo code
              if (updatedOrder.promoCode?.isPartnerPromo && updatedOrder.promoCode.partnerId && updatedOrder.promoCode.partnerCommissionRate) {
                try {
                  const { partnerCommissionService } = await import('../services/partner-commission.service');
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

              // Send payment confirmation email
              if (order.user.email) {
                try {
                  await emailService.sendPaymentConfirmed(
                    order.id,
                    order.user.email,
                    order.orderNumber
                  );
                } catch (emailError) {
                  console.error('Failed to send payment confirmation email:', emailError);
                }
              }
            }
          }
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as any;
          const orderId = paymentIntent.metadata?.orderId;

            if (orderId) {
            const order = await prisma.order.findUnique({
              where: { id: orderId },
              include: {
                promoCode: true,
              },
            });

            if (order && order.paymentStatus !== 'PAID') {
              const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: {
                  paymentStatus: PaymentStatus.PAID,
                },
                include: {
                  promoCode: true,
                },
              });

              // Create partner commission if order has partner promo code
              if (updatedOrder.promoCode?.isPartnerPromo && updatedOrder.promoCode.partnerId && updatedOrder.promoCode.partnerCommissionRate) {
                try {
                  const { partnerCommissionService } = await import('../services/partner-commission.service');
                  await partnerCommissionService.createCommission(
                    updatedOrder.promoCode.partnerId,
                    updatedOrder.id,
                    updatedOrder.promoCode.id,
                    Number(updatedOrder.total),
                    Number(updatedOrder.promoCode.partnerCommissionRate)
                  );
                } catch (error) {
                  console.error('Failed to create partner commission:', error);
                }
              }
            }
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as any;
          const orderId = paymentIntent.metadata?.orderId;

          if (orderId) {
            await prisma.order.update({
              where: { id: orderId },
              data: {
                paymentStatus: PaymentStatus.FAILED,
                statusHistory: {
                  create: {
                    status: OrderStatus.PENDING,
                    notes: 'orderDetail.statusHistory.paymentFailed',
                  },
                },
              },
            });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async getSessionStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const session = await stripeService.getCheckoutSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({
        sessionId: session.id,
        paymentStatus: session.payment_status,
        status: session.status,
        orderId: session.metadata?.orderId,
      });
    } catch (error) {
      console.error('Error getting session status:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get session status',
      });
    }
  }
}

export const stripeController = new StripeController();
