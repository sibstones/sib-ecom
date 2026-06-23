import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { deliveryTrackingService } from '../services/delivery-tracking.service';

export class DeliveryTrackingController {
  /**
   * Check tracking number
   */
  async checkTracking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { trackingNumber, carrier } = req.body;

      if (!trackingNumber) {
        res.status(400).json({
          error: 'Tracking number is required',
        });
        return;
      }

      const trackingInfo = await deliveryTrackingService.checkTrackingNumber(
        trackingNumber,
        carrier
      );

      if (!trackingInfo) {
        res.status(404).json({
          error: 'Tracking information not found',
        });
        return;
      }

      res.json({ trackingInfo });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to check tracking',
      });
    }
  }

  /**
   * Update the order status based on the tracking number
   */
  async updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;

      await deliveryTrackingService.updateOrderStatusByTracking(orderId);

      res.json({
        message: 'Order status updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update order status',
      });
    }
  }

  /**
   * Check all orders with tracking numbers
   */
  async checkAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      await deliveryTrackingService.checkAllTrackingNumbers();

      res.json({
        message: 'All tracking numbers checked successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to check all tracking numbers',
      });
    }
  }

  /**
   * Check orders that were not received
   */
  async checkNotReceived(req: AuthRequest, res: Response): Promise<void> {
    try {
      await deliveryTrackingService.checkNotReceivedOrders();

      res.json({
        message: 'Not received orders checked successfully',
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to check not received orders',
      });
    }
  }

  /**
   * Check connection to the API provider
   */
  async testConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { provider, apiKey, apiUrl } = req.body;

      if (!provider) {
        res.status(400).json({
          error: 'Provider is required',
        });
        return;
      }

      if (!apiKey) {
        res.status(400).json({
          error: 'API key is required',
        });
        return;
      }

      if (!apiUrl) {
        res.status(400).json({
          error: 'API URL is required',
        });
        return;
      }

      const result = await deliveryTrackingService.testConnection(provider, apiKey, apiUrl);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test connection',
      });
    }
  }
}

export const deliveryTrackingController = new DeliveryTrackingController();
