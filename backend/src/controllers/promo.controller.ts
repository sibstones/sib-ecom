import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { promoService } from '../services/promo.service';
import { CreatePromoCodeDto, UpdatePromoCodeDto, ApplyPromoCodeDto } from '../types/promo';
import { settingsService } from '../services/settings.service';

export class PromoController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const codes = await promoService.getAll(activeOnly);
      res.json({ codes });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get promo codes',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const code = await promoService.getById(id);
      
      if (!code) {
        res.status(404).json({ error: 'Promo code not found' });
        return;
      }

      res.json({ code });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get promo code',
      });
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if promo code creation is disabled (only for non-admin users)
      // Admins and super admins can always create promo codes
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      if (!isAdmin) {
        const settings = await settingsService.getAllSettings();
        if (settings.promoCodeCreationDisabled) {
          res.status(403).json({ 
            error: 'Promo code creation is disabled',
            message: 'Promo code creation is temporarily disabled by the administrator'
          });
          return;
        }
      }

      const data: CreatePromoCodeDto = req.body;
      
      // If creating a partner promo code
      if (data.isPartnerPromo) {
        if (!req.user?.userId) {
          res.status(401).json({ error: 'Authentication required for partner promo codes' });
          return;
        }
        
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
        
        // If admin is creating promo code for a partner, use provided partnerId
        if (isAdmin && data.partnerId) {
          // Admin can create promo codes for any partner - no verification needed
          // partnerId is already set in data
        } else {
          // Partner creating their own promo code - verify they are a partner
          const prismaClient = (await import('../config/database')).default;
          const user = await prismaClient.user.findUnique({
            where: { id: req.user.userId },
            select: { isPartner: true, partnerStatus: true },
          });
          
          if (!user?.isPartner || user.partnerStatus !== 'ACTIVE') {
            res.status(403).json({ error: 'Only active partners can create partner promo codes' });
            return;
          }
          
          // Set partnerId from authenticated user
          data.partnerId = req.user.userId;
        }
      }
      
      const code = await promoService.create(data);
      res.status(201).json({ code });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create promo code',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdatePromoCodeDto = req.body;
      const code = await promoService.update(id, data);
      res.json({ code });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update promo code',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await promoService.delete(id);
      res.json({ message: 'Promo code deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete promo code',
      });
    }
  }

  async apply(req: Request, res: Response): Promise<void> {
    try {
      const data: ApplyPromoCodeDto = req.body;
      // Get userId from auth token if available (for user-specific promo codes)
      const authReq = req as AuthRequest;
      if (authReq.user?.userId) {
        data.userId = authReq.user.userId;
      }
      const result = await promoService.applyPromoCode(data);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to apply promo code',
      });
    }
  }
}

export const promoController = new PromoController();
