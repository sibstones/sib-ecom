import { Request, Response } from 'express';
import { paymentRequestService } from '../services/payment-request.service';
import { UpdatePaymentRequestDto } from '../types/payment-request';
import { AuthRequest } from '../middleware/auth.middleware';
import { emailService } from '../services/email.service';
import { messengerService } from '../services/messenger.service';
import { storageService } from '../services/storage.service';
import { PRIVATE_STORAGE_FOLDERS } from '../constants/private-storage';

export class PaymentRequestController {
  private buildPaymentProofDownloadUrl(paymentRequestId: string): string {
    return `/api/payment-requests/${paymentRequestId}/payment-proof/download`;
  }

  private mapPaymentRequestForResponse<T extends { id: string; paymentProof?: string | null }>(
    request: T
  ): T & { paymentProofDownloadUrl?: string } {
    return {
      ...request,
      paymentProofDownloadUrl: request.paymentProof
        ? this.buildPaymentProofDownloadUrl(request.id)
        : undefined,
    };
  }

  private async canAccessPaymentRequest(req: AuthRequest, paymentRequestId: string) {
    const request = await paymentRequestService.getById(paymentRequestId);
    if (!request) {
      throw new Error('Payment request not found');
    }

    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new Error('Unauthorized');
    }

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isOwner = request.order?.userId === userId;

    if (!isAdmin && !isOwner) {
      throw new Error('Forbidden');
    }

    return request;
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const orderId = req.query.orderId as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const sortOrder = (req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc') ? req.query.sortOrder as 'asc' | 'desc' : undefined;
      const result = await paymentRequestService.getAll({ status, orderId, page, limit, dateFrom, dateTo, sortOrder });
      res.json({
        ...result,
        requests: result.requests.map((request) => this.mapPaymentRequestForResponse(request)),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get payment requests',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request = await paymentRequestService.getById(id);
      if (!request) {
        res.status(404).json({ error: 'Payment request not found' });
        return;
      }
      res.json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get payment request',
      });
    }
  }

  async getByOrderId(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const request = await paymentRequestService.getByOrderId(orderId);
      if (!request) {
        res.status(404).json({ error: 'Payment request not found' });
        return;
      }
      res.json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get payment request',
      });
    }
  }

  /** Get or create PaymentRequest for paid orders without one (e.g. GATEWAY). Enables adding delivery info. */
  async ensureForShipping(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const updatedBy = req.user?.userId;
      const request = await paymentRequestService.getOrCreateForShipping(orderId, updatedBy);
      res.json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to ensure payment request for shipping',
      });
    }
  }

  /** Mark order as shipped by orderId. Creates PaymentRequest if needed for GATEWAY-paid orders. */
  async markAsShippedByOrderId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { logisticsInfo } = req.body;
      const updatedBy = req.user?.userId;
      const request = await paymentRequestService.markAsShippedByOrderId(orderId, logisticsInfo, updatedBy);

      if (request.order.user) {
        await emailService.sendOrderShipped(
          request.orderId,
          request.order.user.email,
          request.order.orderNumber,
          logisticsInfo?.trackingNumber,
          logisticsInfo?.carrier,
          request.order.user.preferredLanguage ?? undefined
        );

        try {
          const contacts = await messengerService.getContacts(request.order.userId);
          const trackingInfo = logisticsInfo?.trackingNumber
            ? ` Tracking: ${logisticsInfo.trackingNumber}`
            : '';
          for (const contact of contacts) {
            await messengerService.sendNotification(
              request.order.userId,
              contact.type as any,
              `Your order ${request.order.orderNumber} has been shipped!${trackingInfo}`
            );
          }
        } catch (e) {
          console.error('Failed to send messenger notification:', e);
        }
      }

      res.json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to mark as shipped',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdatePaymentRequestDto;
      const updatedBy = req.user?.userId;
      const request = await paymentRequestService.update(id, data, updatedBy);

      // Send notifications if status changed
      if (data.status === 'PAID' && request.order.user) {
        await emailService.sendPaymentConfirmed(
          request.orderId,
          request.order.user.email,
          request.order.orderNumber
        );

        // Try to send messenger notification
        try {
          const contacts = await messengerService.getContacts(request.order.userId);
          for (const contact of contacts) {
            await messengerService.sendNotification(
              request.order.userId,
              contact.type as any,
              `Your payment for order ${request.order.orderNumber} has been confirmed!`
            );
          }
        } catch (error) {
          console.error('Failed to send messenger notification:', error);
        }
      }

      res.json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update payment request',
      });
    }
  }

  async markAsNotified(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await paymentRequestService.markAsNotified(id);
      res.json({ message: 'Payment request marked as notified' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to mark as notified',
      });
    }
  }

  async markAsPaidByCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get payment request by order ID
      const paymentRequest = await paymentRequestService.getByOrderId(orderId);
      if (!paymentRequest) {
        res.status(404).json({ error: 'Payment request not found' });
        return;
      }

      // Verify that the order belongs to the user
      if (paymentRequest.order.userId !== userId) {
        res.status(403).json({ error: 'Forbidden: This order does not belong to you' });
        return;
      }

      // Mark as paid by customer - only sets paidAt, status remains PENDING
      const request = await paymentRequestService.markAsPaidByCustomer(paymentRequest.id);

      res.json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to mark as paid',
      });
    }
  }

  async markAsPaid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updatedBy = req.user?.userId;
      const request = await paymentRequestService.markAsPaid(id, updatedBy);

      // Send confirmation email
      if (request.order.user) {
        await emailService.sendPaymentConfirmed(
          request.orderId,
          request.order.user.email,
          request.order.orderNumber
        );

        // Try to send messenger notification
        try {
          const contacts = await messengerService.getContacts(request.order.userId);
          for (const contact of contacts) {
            await messengerService.sendNotification(
              request.order.userId,
              contact.type as any,
              `Your payment for order ${request.order.orderNumber} has been confirmed!`
            );
          }
        } catch (error) {
          console.error('Failed to send messenger notification:', error);
        }
      }

      res.json({ request });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to mark as paid',
      });
    }
  }

  async markAsShipped(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { logisticsInfo } = req.body;
      const updatedBy = req.user?.userId;
      const request = await paymentRequestService.markAsShipped(id, logisticsInfo, updatedBy);

      // Send shipping notification
      if (request.order.user) {
        await emailService.sendOrderShipped(
          request.orderId,
          request.order.user.email,
          request.order.orderNumber,
          logisticsInfo?.trackingNumber,
          logisticsInfo?.carrier,
          request.order.user.preferredLanguage ?? undefined
        );

        // Try to send messenger notification
        try {
          const contacts = await messengerService.getContacts(request.order.userId);
          const trackingInfo = logisticsInfo?.trackingNumber
            ? ` Tracking: ${logisticsInfo.trackingNumber}`
            : '';
          for (const contact of contacts) {
            await messengerService.sendNotification(
              request.order.userId,
              contact.type as any,
              `Your order ${request.order.orderNumber} has been shipped!${trackingInfo}`
            );
          }
        } catch (error) {
          console.error('Failed to send messenger notification:', error);
        }
      }

      res.json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to mark as shipped',
      });
    }
  }

  async uploadPaymentProof(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const userId = req.user?.userId;
      const role = req.user?.role;
      const file = req.file as Express.Multer.File | undefined;

      if (!userId || !role) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const paymentRequest = await paymentRequestService.getByOrderId(orderId);
      if (!paymentRequest) {
        res.status(404).json({ error: 'Payment request not found' });
        return;
      }

      const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
      const isOwner = paymentRequest.order.userId === userId;
      if (!isAdmin && !isOwner) {
        res.status(403).json({ error: 'Forbidden: This order does not belong to you' });
        return;
      }

      if (paymentRequest.paymentProof) {
        await storageService.deleteFile(paymentRequest.paymentProof).catch(() => false);
      }

      const paymentProof = await storageService.uploadPrivateFile(
        file,
        PRIVATE_STORAGE_FOLDERS.paymentProofs
      );
      const request = await paymentRequestService.update(paymentRequest.id, { paymentProof }, userId);

      res.status(201).json({ request: this.mapPaymentRequestForResponse(request) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to upload payment proof',
      });
    }
  }

  async downloadPaymentProof(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const request = await this.canAccessPaymentRequest(req, req.params.id);
      if (!request.paymentProof) {
        res.status(404).json({ error: 'Payment proof not found' });
        return;
      }

      const file = await storageService.getFileBuffer(request.paymentProof);
      if (!file) {
        res.status(404).json({ error: 'Payment proof file not found' });
        return;
      }

      const orderNumber = request.order?.orderNumber || request.orderId;
      const fallbackName = `payment-proof-${orderNumber}`;
      res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(fallbackName)}"`
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(file.buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download payment proof';
      if (message === 'Forbidden') {
        res.status(403).json({ error: message });
        return;
      }
      if (message === 'Unauthorized') {
        res.status(401).json({ error: message });
        return;
      }
      if (message === 'Payment request not found') {
        res.status(404).json({ error: message });
        return;
      }
      res.status(400).json({ error: message });
    }
  }
}

export const paymentRequestController = new PaymentRequestController();
