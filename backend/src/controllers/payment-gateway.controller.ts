import { Request, Response } from 'express';
import { paymentGatewayService } from '../services/payment-gateway.service';
import { CreatePaymentGatewayDto, UpdatePaymentGatewayDto } from '../types/payment-gateway';
import { AuthRequest } from '../middleware/auth.middleware';
import { isSupportedPaymentGatewayType } from '../constants/payment-gateway';

export class PaymentGatewayController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const enabledOnly = req.query.enabledOnly === 'true';
      const gateways = enabledOnly
        ? await paymentGatewayService.getEnabled()
        : await paymentGatewayService.getAll();
      res.json({ gateways: paymentGatewayService.maskGatewaySecretsList(gateways) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get payment gateways',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const gateway = await paymentGatewayService.getById(id);
      if (!gateway) {
        res.status(404).json({ error: 'Payment gateway not found' });
        return;
      }
      res.json({ gateway: paymentGatewayService.maskGatewaySecrets(gateway) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get payment gateway',
      });
    }
  }

  async getForCheckout(req: Request, res: Response): Promise<void> {
    try {
      const countryCode = req.query.countryCode as string;
      const currency = req.query.currency as string;

      if (!countryCode || !currency) {
        res.status(400).json({ error: 'countryCode and currency are required' });
        return;
      }

      const gateways = await paymentGatewayService.getForCountryAndCurrency(
        countryCode,
        currency
      );
      res.json({ gateways: paymentGatewayService.maskGatewaySecretsList(gateways) });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get payment gateways',
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body as CreatePaymentGatewayDto;
      const updatedBy = req.user?.userId;
      
      // Validate required fields
      if (!data.type || !data.name) {
        res.status(400).json({
          error: 'Type and name are required',
        });
        return;
      }
      if (!isSupportedPaymentGatewayType(data.type)) {
        res.status(400).json({
          error: `Unsupported payment gateway type: ${data.type}`,
        });
        return;
      }

      const gateway = await paymentGatewayService.create(data, updatedBy);
      res.status(201).json({ gateway: paymentGatewayService.maskGatewaySecrets(gateway) });
    } catch (error) {
      console.error('Error creating payment gateway:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create payment gateway',
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdatePaymentGatewayDto;
      const updatedBy = req.user?.userId;
      const gateway = await paymentGatewayService.update(id, data, updatedBy);
      res.json({ gateway: paymentGatewayService.maskGatewaySecrets(gateway) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update payment gateway',
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await paymentGatewayService.delete(id);
      res.json({ message: 'Payment gateway deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete payment gateway',
      });
    }
  }

  async toggleEnabled(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const updatedBy = req.user?.userId;
      const gateway = await paymentGatewayService.toggleEnabled(id, enabled, updatedBy);
      res.json({ gateway: paymentGatewayService.maskGatewaySecrets(gateway) });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to toggle payment gateway',
      });
    }
  }

  async testConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { type, config } = req.body as { type?: string; config?: Record<string, unknown> };
      if (!type || !config || typeof config !== 'object') {
        res.status(400).json({ error: 'type and config are required' });
        return;
      }
      const result = await paymentGatewayService.testConnection(type, config as any);
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  }
}

export const paymentGatewayController = new PaymentGatewayController();
