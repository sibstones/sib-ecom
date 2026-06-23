import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { ticketController } from '../controllers/ticket.controller';
import { returnController } from '../controllers/return.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkoutLimiter } from '../middleware/rate-limit.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    preferredLanguage: z.string().min(2).max(10).optional(),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});

const createAddressSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    address: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().optional(),
    isDefault: z.boolean().optional(),
  }),
});

const updateAddressSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
    address: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    postalCode: z.string().optional(),
    isDefault: z.boolean().optional(),
  }),
});

const createOrderSchema = z.object({
  body: z.object({
    shippingAddressId: z.string().uuid(),
    notes: z.string().optional(),
    paymentMethod: z.enum(['GATEWAY', 'BANK_TRANSFER', 'CASH_ON_DELIVERY', 'MANAGER_CHAT']).optional(),
    currency: z.string().optional(),
    countryCode: z.string().optional(),
    promoCode: z.string().optional(),
    loyaltyRedeemPoints: z.number().int().nonnegative().optional(),
    languageCode: z.string().min(2).max(10).optional(),
  }),
});

const createGuestOrderSchema = z.object({
  body: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    address: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().optional(),
    notes: z.string().optional(),
    paymentMethod: z.enum(['GATEWAY', 'BANK_TRANSFER', 'CASH_ON_DELIVERY', 'MANAGER_CHAT']).optional(),
    currency: z.string().optional(),
    countryCode: z.string().optional(),
    promoCode: z.string().optional(),
    loyaltyRedeemPoints: z.number().int().nonnegative().optional(),
    languageCode: z.string().min(2).max(10).optional(),
  }),
});

const updatePaymentMethodSchema = z.object({
  body: z.object({
    paymentMethod: z.enum(['GATEWAY', 'BANK_TRANSFER', 'CASH_ON_DELIVERY', 'MANAGER_CHAT']),
  }),
});

const createTicketSchema = z.object({
  body: z.object({
    orderId: z.string().uuid(),
    subject: z.string().min(1),
    message: z.string().min(1),
  }),
});

const addTicketMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1),
  }),
});

// Guest checkout (no auth required)
router.get(
  '/guest/check-email',
  customerController.checkGuestCheckoutEmail.bind(customerController)
);

router.post(
  '/guest/orders',
  checkoutLimiter,
  validate(createGuestOrderSchema),
  customerController.createGuestOrder.bind(customerController)
);

// All routes below require authentication
router.use(authenticate);

// Profile routes
router.get('/profile', customerController.getProfile.bind(customerController));
router.get('/notifications', customerController.getNotificationCounts.bind(customerController));
router.put(
  '/profile',
  validate(updateProfileSchema),
  customerController.updateProfile.bind(customerController)
);
router.post(
  '/profile/change-password',
  validate(changePasswordSchema),
  customerController.changePassword.bind(customerController)
);

// Address routes
router.get('/addresses', customerController.getAddresses.bind(customerController));
router.post(
  '/addresses',
  validate(createAddressSchema),
  customerController.createAddress.bind(customerController)
);
router.put(
  '/addresses/:addressId',
  validate(updateAddressSchema),
  customerController.updateAddress.bind(customerController)
);
router.delete('/addresses/:addressId', customerController.deleteAddress.bind(customerController));

// Order routes
router.get('/orders', customerController.getOrders.bind(customerController));
router.get('/orders/:orderId', customerController.getOrder.bind(customerController));
router.post(
  '/orders',
  checkoutLimiter,
  validate(createOrderSchema),
  customerController.createOrder.bind(customerController)
);
router.put(
  '/orders/:orderId/payment-method',
  validate(updatePaymentMethodSchema),
  customerController.updatePaymentMethod.bind(customerController)
);

// Wishlist routes
router.get('/wishlist', customerController.getWishlist.bind(customerController));
router.post('/wishlist', customerController.addToWishlist.bind(customerController));
router.delete('/wishlist/:productId', customerController.removeFromWishlist.bind(customerController));
router.get('/wishlist/check/:productId', customerController.checkWishlist.bind(customerController));

// Support Tickets routes
router.post(
  '/tickets',
  validate(createTicketSchema),
  ticketController.createTicket.bind(ticketController)
);
router.get('/tickets', ticketController.getCustomerTickets.bind(ticketController));
router.get('/tickets/:ticketId', ticketController.getCustomerTicket.bind(ticketController));
router.patch('/tickets/:ticketId/read', ticketController.markTicketAsRead.bind(ticketController));
router.post(
  '/tickets/:ticketId/messages',
  validate(addTicketMessageSchema),
  ticketController.addCustomerMessage.bind(ticketController)
);

// Promo Codes routes
router.get('/promo-codes', customerController.getPromoCodes.bind(customerController));

// Return Requests routes
const createReturnRequestSchema = z.object({
  body: z.object({
    orderId: z.string().uuid(),
    reason: z.enum(['PRODUCT_NOT_DELIVERED', 'CUSTOMER_NOT_RECEIVED', 'CUSTOMER_REQUESTED']),
    customerNotes: z.string().optional(),
    items: z.array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
        itemStatus: z.enum(['WRITE_OFF', 'RETURN_TO_SALE']).default('WRITE_OFF'),
        warehouseId: z.string().uuid().optional(),
      })
    ),
  }),
});

router.post(
  '/returns',
  validate(createReturnRequestSchema),
  returnController.createReturnRequest.bind(returnController)
);
router.get('/returns', returnController.getMyReturnRequests.bind(returnController));
router.get('/returns/:returnRequestId', returnController.getReturnRequestById.bind(returnController));

export default router;
