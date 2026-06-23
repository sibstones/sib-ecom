import { Router } from 'express';
import { paymentRequestController } from '../controllers/payment-request.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadSingleDocument, handleUploadError } from '../middleware/upload.middleware';
import { checkoutLimiter, uploadLimiter } from '../middleware/rate-limit.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const updatePaymentRequestSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
    bankDetails: z
      .object({
        accountName: z.string(),
        accountNumber: z.string(),
        bankName: z.string(),
        swiftCode: z.string().optional(),
        iban: z.string().optional(),
        routingNumber: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional(),
    paymentProof: z.string().optional(),
    adminNotes: z.string().optional(),
    logisticsInfo: z
      .object({
        trackingNumber: z.string().optional(),
        carrier: z.string().optional(),
        estimatedDelivery: z.string().optional(),
        shippedDate: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional(),
  }),
});

const markAsShippedSchema = z.object({
  body: z.object({
    logisticsInfo: z
      .object({
        trackingNumber: z.string().optional(),
        carrier: z.string().optional(),
        estimatedDelivery: z.string().optional(),
        shippedDate: z.string().optional(),
        notes: z.string().optional(),
      })
      .passthrough(), // Allow yandexDeliveryClaimId, pickupPointId, etc.
  }),
});

// More specific routes first (before /order/:orderId)
// Admin: ensure PaymentRequest exists for shipping (creates for GATEWAY-paid orders)
router.get(
  '/order/:orderId/ensure-for-shipping',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  paymentRequestController.ensureForShipping.bind(paymentRequestController)
);

// Public routes (for customers to view their payment requests)
router.get(
  '/order/:orderId',
  authenticate,
  paymentRequestController.getByOrderId.bind(paymentRequestController)
);

// Admin: mark order as shipped by orderId (creates PaymentRequest if needed)
router.post(
  '/order/:orderId/mark-shipped',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(markAsShippedSchema),
  paymentRequestController.markAsShippedByOrderId.bind(paymentRequestController)
);

// Protected routes (Admin only)
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  paymentRequestController.getAll.bind(paymentRequestController)
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  paymentRequestController.getById.bind(paymentRequestController)
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(updatePaymentRequestSchema),
  paymentRequestController.update.bind(paymentRequestController)
);

router.post(
  '/:id/mark-notified',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  paymentRequestController.markAsNotified.bind(paymentRequestController)
);

// Customer route to mark their own payment request as paid
router.post(
  '/order/:orderId/mark-paid',
  checkoutLimiter,
  authenticate,
  paymentRequestController.markAsPaidByCustomer.bind(paymentRequestController)
);

router.post(
  '/order/:orderId/payment-proof',
  uploadLimiter,
  authenticate,
  uploadSingleDocument,
  handleUploadError,
  paymentRequestController.uploadPaymentProof.bind(paymentRequestController)
);

router.get(
  '/:id/payment-proof/download',
  authenticate,
  paymentRequestController.downloadPaymentProof.bind(paymentRequestController)
);

router.post(
  '/:id/mark-paid',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  paymentRequestController.markAsPaid.bind(paymentRequestController)
);

router.post(
  '/:id/mark-shipped',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(markAsShippedSchema),
  paymentRequestController.markAsShipped.bind(paymentRequestController)
);

export default router;
