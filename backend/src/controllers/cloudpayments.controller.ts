import { Request, Response } from 'express';
import { cloudpaymentsService } from '../services/cloudpayments.service';
import { customerService } from '../services/customer.service';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { config } from '../config/env';
import { PaymentStatus } from '@prisma/client';
import { emailService } from '../services/email.service';
import { verifyGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';
import { convertUsdForOrderPayment } from '../services/order-pricing.service';

type CloudPaymentsWebhookBody = Record<string, unknown> & {
  TransactionId?: number;
  Amount?: number;
  Currency?: string;
  InvoiceId?: string;
  AccountId?: string;
  Status?: string;
  ReasonCode?: number;
};

export class CloudPaymentsController {
  /**
   * Returns widget params for frontend to open CloudPayments widget.
   * POST /api/payments/cloudpayments/widget-params
   */
  async getWidgetParams(req: AuthRequest, res: Response): Promise<void> {
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

      const order = await customerService.getOrder(userId, orderId);
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
        where: { id: userId },
        select: { email: true },
      });
      const frontendBaseUrl = config.frontend.baseUrl;
      const returnUrl = `${frontendBaseUrl}/payment/success?order_id=${orderId}`;

      const payCurrency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
      const totalUsd = Number(order.total);
      let amount: number;
      try {
        amount = await convertUsdForOrderPayment(totalUsd, order);
      } catch {
        amount = payCurrency === 'RUB' ? Math.round((totalUsd * 80) / 10) * 10 : totalUsd;
      }

      const params = await cloudpaymentsService.getWidgetParams(
        order.id,
        order.orderNumber,
        amount,
        payCurrency,
        `Order ${order.orderNumber}`,
        returnUrl,
        user?.email ?? undefined
      );

      if (!params) {
        res.status(503).json({ error: 'CloudPayments is not configured or enabled' });
        return;
      }

      res.json(params);
    } catch (error) {
      console.error('Error getting CloudPayments widget params:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get widget params',
      });
    }
  }

  async getGuestWidgetParams(req: Request, res: Response): Promise<void> {
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
      const frontendBaseUrl = config.frontend.baseUrl;
      const returnUrl = `${frontendBaseUrl}/payment/success?order_id=${orderId}`;

      const payCurrency = (order.checkoutCurrency || 'USD').trim().toUpperCase();
      const totalUsd = Number(order.total);
      let amount: number;
      try {
        amount = await convertUsdForOrderPayment(totalUsd, order);
      } catch {
        amount = payCurrency === 'RUB' ? Math.round((totalUsd * 80) / 10) * 10 : totalUsd;
      }

      const params = await cloudpaymentsService.getWidgetParams(
        order.id,
        order.orderNumber,
        amount,
        payCurrency,
        `Order ${order.orderNumber}`,
        returnUrl,
        user?.email ?? undefined
      );

      if (!params) {
        res.status(503).json({ error: 'CloudPayments is not configured or enabled' });
        return;
      }

      res.json(params);
    } catch (error) {
      console.error('Error getting guest CloudPayments widget params:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get widget params',
      });
    }
  }

  /**
   * Webhook: single endpoint for Check, Pay, Fail. CloudPayments may send to one URL; type inferred from payload.
   * Body must be raw for HMAC verification. Use express.raw for this route.
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const rawBody = req.body;
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
      const signature = (req.headers['x-content-hmac'] ?? req.headers['content-hmac']) as string | undefined;

      const isValid = await cloudpaymentsService.verifyWebhookSignature(bodyStr, signature);
      if (!isValid) {
        res.status(400).json({ code: 13 });
        return;
      }

      let body: CloudPaymentsWebhookBody;
      try {
        body = JSON.parse(bodyStr) as CloudPaymentsWebhookBody;
      } catch {
        res.status(400).json({ code: 13 });
        return;
      }

      const invoiceId = body.InvoiceId ?? body.invoiceId;
      const orderNumber = typeof invoiceId === 'string' ? invoiceId : invoiceId != null ? String(invoiceId) : null;

      // Fail: has ReasonCode
      if (body.ReasonCode != null) {
        const code = await cloudpaymentsService.handleFail(body);
        if (orderNumber) {
          const order = await prisma.order.findUnique({ where: { orderNumber } });
          if (order && order.paymentStatus !== 'PAID') {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: PaymentStatus.FAILED,
                statusHistory: {
                  create: {
                    status: order.status,
                    notes: 'orderDetail.statusHistory.paymentFailed',
                  },
                },
              },
            });
          }
        }
        res.json(code);
        return;
      }

      // Pay: Status Completed or Authorized
      if (body.Status === 'Completed' || body.Status === 'Authorized') {
        const code = await cloudpaymentsService.handlePay(body);
        if (orderNumber) {
          const order = await prisma.order.findUnique({
            where: { orderNumber },
            include: { user: true, promoCode: true },
          });
          if (order && order.paymentStatus !== 'PAID') {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: PaymentStatus.PAID,
                statusHistory: {
                  create: {
                    status: order.status,
                    notes: 'orderDetail.statusHistory.paymentReceived',
                  },
                },
              },
              include: { promoCode: true },
            });

            if (order.promoCode?.isPartnerPromo && order.promoCode.partnerId && order.promoCode.partnerCommissionRate) {
              try {
                const { partnerCommissionService } = await import('../services/partner-commission.service');
                await partnerCommissionService.createCommission(
                  order.promoCode.partnerId,
                  order.id,
                  order.promoCode.id,
                  Number(order.total),
                  Number(order.promoCode.partnerCommissionRate)
                );
              } catch (e) {
                console.error('Failed to create partner commission:', e);
              }
            }
            if (order.user?.email) {
              try {
                await emailService.sendPaymentConfirmed(order.id, order.user.email, order.orderNumber);
              } catch (e) {
                console.error('Failed to send payment confirmation email:', e);
              }
            }
          }
        }
        res.json(code);
        return;
      }

      // Check: validate and return code
      const code = await cloudpaymentsService.handleCheck(body);
      res.json(code);
    } catch (error) {
      console.error('Error processing CloudPayments webhook:', error);
      res.status(500).json({ code: 13 });
    }
  }
}

export const cloudpaymentsController = new CloudPaymentsController();
