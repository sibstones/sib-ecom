import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { yandexDeliveryService } from '../services/yandex-delivery.service';

export class YandexDeliveryController {
  /**
   * Geocode address through Yandex Delivery API
   */
  async geocodeAddress(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { address, city, country } = req.body;

      if (!address) {
        res.status(400).json({
          error: 'Address is required',
        });
        return;
      }

      const result = await yandexDeliveryService.geocodeAddress(
        address,
        city,
        country || 'RU'
      );

      res.json({ result });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to geocode address',
      });
    }
  }

  /**
   * Find nearest pickup points through Yandex Delivery API
   */
  async findNearestPickupPoints(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { lat, lon, radius } = req.body;

      if (!lat || !lon) {
        res.status(400).json({
          error: 'Coordinates (lat, lon) are required',
        });
        return;
      }

      const pickupPoints = await yandexDeliveryService.findNearestPickupPoints(
        { lat: parseFloat(lat), lon: parseFloat(lon) },
        radius ? parseInt(radius) : 5000
      );

      res.json({ pickupPoints });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to find pickup points',
      });
    }
  }

  /**
   * Calculate delivery cost through Yandex Delivery API
   */
  async calculateDeliveryCost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        fromAddress,
        toAddress,
        items,
        pickupPointId,
      } = req.body;

      if (!fromAddress || !toAddress || !items || !Array.isArray(items)) {
        res.status(400).json({
          error: 'fromAddress, toAddress, and items array are required',
        });
        return;
      }

      const offers = await yandexDeliveryService.calculateDeliveryCost(
        fromAddress,
        toAddress,
        items,
        pickupPointId
      );

      res.json({ offers });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to calculate delivery cost',
      });
    }
  }

  /**
   * Create delivery order through Yandex Delivery API
   */
  async createDeliveryClaim(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        orderId,
        fromAddress,
        toAddress,
        items,
        pickupPointId,
        offerId,
      } = req.body;

      if (!orderId || !fromAddress || !toAddress || !items || !Array.isArray(items)) {
        res.status(400).json({
          error: 'orderId, fromAddress, toAddress, and items array are required',
        });
        return;
      }

      const claim = await yandexDeliveryService.createDeliveryClaim(
        orderId,
        fromAddress,
        toAddress,
        items,
        pickupPointId,
        offerId
      );

      res.json({ claim });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create delivery claim',
      });
    }
  }

  /**
   * Get delivery claim info through Yandex Delivery API
   */
  async getClaimInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { claimId } = req.params;

      if (!claimId) {
        res.status(400).json({
          error: 'claimId is required',
        });
        return;
      }

      const claim = await yandexDeliveryService.getClaimInfo(claimId);

      res.json({ claim });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get claim info',
      });
    }
  }

  /**
   * Accept delivery claim through Yandex Delivery API
   */
  async acceptClaim(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { claimId } = req.params;

      if (!claimId) {
        res.status(400).json({
          error: 'claimId is required',
        });
        return;
      }

      await yandexDeliveryService.acceptClaim(claimId);

      res.json({ message: 'Claim accepted successfully' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to accept claim',
      });
    }
  }

  /**
   * Update order status based on delivery status through Yandex Delivery API
   */
  async updateOrderStatusFromClaim(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { claimId, orderId } = req.body;

      if (!claimId || !orderId) {
        res.status(400).json({
          error: 'claimId and orderId are required',
        });
        return;
      }

      await yandexDeliveryService.updateOrderStatusFromClaim(claimId, orderId);

      res.json({ message: 'Order status updated successfully' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update order status',
      });
    }
  }

  /**
   * Send notification to user about pickup point through Yandex Delivery API
   */
  async notifyUserAboutPickupPoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId, pickupPoint } = req.body;

      if (!orderId || !pickupPoint) {
        res.status(400).json({
          error: 'orderId and pickupPoint are required',
        });
        return;
      }

      await yandexDeliveryService.notifyUserAboutPickupPoint(orderId, pickupPoint);

      res.json({ message: 'Notification sent successfully' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to send notification',
      });
    }
  }

  /**
   * Webhook for receiving status updates from Yandex Delivery API
   * This endpoint does not require authentication, but should check the request signature
   */
  async webhook(req: any, res: Response): Promise<void> {
    try {
      const { claim_id, status, order_id } = req.body;

      if (!claim_id || !status) {
        res.status(400).json({
          error: 'claim_id and status are required',
        });
        return;
      }

      // If order_id is specified, update the order status through Yandex Delivery API
      if (order_id) {
        await yandexDeliveryService.updateOrderStatusFromClaim(claim_id, order_id);
      }

      // Send successful response
      res.json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      // Send successful response to avoid repeated requests from Yandex
      res.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

// Create an instance of the controller with error handling
let yandexDeliveryControllerInstance: YandexDeliveryController | null = null;

try {
  yandexDeliveryControllerInstance = new YandexDeliveryController();
} catch (error) {
  console.error('Error creating YandexDeliveryController:', error);
  throw error;
}

export const yandexDeliveryController = yandexDeliveryControllerInstance;
