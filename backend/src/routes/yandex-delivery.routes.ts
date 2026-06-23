import { Router } from 'express';
import { yandexDeliveryController } from '../controllers/yandex-delivery.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';

const router = Router();

// Check that the controller is loaded correctly
if (!yandexDeliveryController) {
  throw new Error('yandexDeliveryController is not defined');
}

if (!yandexDeliveryController.geocodeAddress) {
  throw new Error('yandexDeliveryController.geocodeAddress is not defined');
}

if (!yandexDeliveryController.findNearestPickupPoints) {
  throw new Error('yandexDeliveryController.findNearestPickupPoints is not defined');
}

if (!yandexDeliveryController.calculateDeliveryCost) {
  throw new Error('yandexDeliveryController.calculateDeliveryCost is not defined');
}

if (!yandexDeliveryController.createDeliveryClaim) {
  throw new Error('yandexDeliveryController.createDeliveryClaim is not defined');
}

if (!yandexDeliveryController.getClaimInfo) {
  throw new Error('yandexDeliveryController.getClaimInfo is not defined');
}

if (!yandexDeliveryController.acceptClaim) {
  throw new Error('yandexDeliveryController.acceptClaim is not defined');
}

if (!yandexDeliveryController.updateOrderStatusFromClaim) {
  throw new Error('yandexDeliveryController.updateOrderStatusFromClaim is not defined');
}

if (!yandexDeliveryController.notifyUserAboutPickupPoint) {
  throw new Error('yandexDeliveryController.notifyUserAboutPickupPoint is not defined');
}

if (!yandexDeliveryController.webhook) {
  throw new Error('yandexDeliveryController.webhook is not defined');
}

/**
 * All routes require authentication
 * Some routes require admin rights
 */

// Geocoding address (available to all authenticated users)
router.post(
  '/geocode',
  authenticate,
  yandexDeliveryController.geocodeAddress.bind(yandexDeliveryController)
);

// Search for nearest pickup points (available to all authenticated users)
router.post(
  '/pickup-points',
  authenticate,
  yandexDeliveryController.findNearestPickupPoints.bind(yandexDeliveryController)
);

// Calculate delivery cost (available to all authenticated users)
router.post(
  '/calculate',
  authenticate,
  yandexDeliveryController.calculateDeliveryCost.bind(yandexDeliveryController)
);

// Create a delivery order (requires administrator rights)
router.post(
  '/claims/create',
  authenticate,
  requirePermission('canManageOrders'),
  yandexDeliveryController.createDeliveryClaim.bind(yandexDeliveryController)
);

// Get information about the claim (requires administrator rights)
router.get(
  '/claims/:claimId',
  authenticate,
  requirePermission('canManageOrders'),
  yandexDeliveryController.getClaimInfo.bind(yandexDeliveryController)
);

// Confirm the claim (requires administrator rights)
router.post(
  '/claims/:claimId/accept',
  authenticate,
  requirePermission('canManageOrders'),
  yandexDeliveryController.acceptClaim.bind(yandexDeliveryController)
);

// Update the order status (requires administrator rights)
router.post(
  '/claims/update-order-status',
  authenticate,
  requirePermission('canManageOrders'),
  yandexDeliveryController.updateOrderStatusFromClaim.bind(yandexDeliveryController)
);

// Send a notification about the pickup point (requires administrator rights)
router.post(
  '/notify-pickup-point',
  authenticate,
  requirePermission('canManageOrders'),
  yandexDeliveryController.notifyUserAboutPickupPoint.bind(yandexDeliveryController)
);

// Webhook for receiving status updates from Yandex Delivery
// Does not require authentication, but should check the request signature
router.post(
  '/webhook',
  yandexDeliveryController.webhook.bind(yandexDeliveryController)
);

export default router;
