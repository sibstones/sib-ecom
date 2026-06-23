import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { partnerService } from '../services/partner.service';
import { partnerCommissionService } from '../services/partner-commission.service';
import { partnerPayoutService } from '../services/partner-payout.service';
import { partnerDocumentService } from '../services/partner-document.service';
import { storageService } from '../services/storage.service';
import prisma from '../config/database';
import { PRIVATE_STORAGE_FOLDERS } from '../constants/private-storage';

export class PartnerController {
  private buildDocumentDownloadUrl(documentId: string): string {
    return `/api/partner-documents/${documentId}/download`;
  }

  private mapDocumentForResponse<T extends { id: string }>(document: T): T & { downloadUrl: string } {
    return {
      ...document,
      downloadUrl: this.buildDocumentDownloadUrl(document.id),
    };
  }

  private async canAccessDocument(req: AuthRequest, documentId: string) {
    const document = await partnerDocumentService.getDocumentById(documentId);
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || !role) {
      throw new Error('Unauthorized');
    }

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isOwner = document.partnerId === userId;

    if (!isAdmin && !isOwner) {
      throw new Error('Forbidden');
    }

    return document;
  }

  // Admin: Get all partners
  async getAllPartners(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;

      const result = await partnerService.getAllPartners(page, limit, search);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get partners' });
    }
  }

  // Admin: Get partner by ID
  async getPartnerById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const partner = await partnerService.getPartnerById(id);
      res.json({ partner });
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Partner not found' });
    }
  }

  // Admin: Assign partner status
  async assignPartner(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      const partner = await partnerService.assignPartner(userId, status);
      res.json({ partner });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to assign partner' });
    }
  }

  // Admin: Remove partner status
  async removePartner(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const user = await partnerService.removePartner(userId);
      res.json({ user });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to remove partner' });
    }
  }

  // Admin: Update partner status
  async updatePartnerStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      const partner = await partnerService.updatePartnerStatus(id, status);
      res.json({ partner });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update partner status' });
    }
  }

  // Admin: Get partner statistics
  async getPartnerStats(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const stats = await partnerService.getPartnerStats(id);
      res.json(stats);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Partner not found' });
    }
  }

  // Admin: Get partner orders
  async getPartnerOrders(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await partnerService.getPartnerOrders(id, page, limit);
      res.json(result);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Partner not found' });
    }
  }

  // Partner: Get own promo codes (for link builder)
  async getOwnPromoCodes(req: AuthRequest, res: Response) {
    try {
      const partnerId = req.user!.userId;
      const user = await prisma.user.findUnique({
        where: { id: partnerId },
        select: { isPartner: true },
      });
      if (!user?.isPartner) {
        res.status(403).json({ error: 'User is not a partner' });
        return;
      }
      const promoCodes = await partnerService.getOwnPromoCodes(partnerId);
      res.json({ promoCodes });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get promo codes' });
    }
  }

  // Partner: Get own commissions
  async getOwnCommissions(req: AuthRequest, res: Response) {
    try {
      const partnerId = req.user!.userId;
      
      // Verify user is a partner
      const user = await prisma.user.findUnique({
        where: { id: partnerId },
        select: { isPartner: true },
      });
      
      if (!user?.isPartner) {
        res.status(403).json({ error: 'User is not a partner' });
        return;
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const result = await partnerCommissionService.getPartnerCommissions(partnerId, page, limit, status);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get commissions' });
    }
  }

  // Partner: Get commission statistics
  async getCommissionStats(req: AuthRequest, res: Response) {
    try {
      const partnerId = req.user!.userId;
      const stats = await partnerCommissionService.getCommissionStats(partnerId);
      res.json(stats);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get commission stats' });
    }
  }

  // Partner: Get available commissions for payout
  async getAvailableCommissions(req: AuthRequest, res: Response) {
    try {
      const partnerId = req.user!.userId;
      const commissions = await partnerCommissionService.getAvailableCommissions(partnerId);
      res.json({ commissions });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get available commissions' });
    }
  }

  // Partner: Create payout request
  async createPayoutRequest(req: AuthRequest, res: Response) {
    try {
      const partnerId = req.user!.userId;
      const { amount, commissionIds } = req.body;

      if (!amount || !commissionIds || !Array.isArray(commissionIds)) {
        res.status(400).json({ error: 'Missing required fields: amount, commissionIds' });
        return;
      }

      const payout = await partnerPayoutService.createPayoutRequest(partnerId, amount, commissionIds);
      res.status(201).json({ payout });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create payout request' });
    }
  }

  // Partner: Get own payouts
  async getOwnPayouts(req: AuthRequest, res: Response) {
    try {
      const partnerId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await partnerPayoutService.getPartnerPayouts(partnerId, page, limit);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get payouts' });
    }
  }

  // Admin: Get all payout requests
  async getAllPayouts(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const result = await partnerPayoutService.getAllPayouts(page, limit, status);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get payouts' });
    }
  }

  // Admin: Get payout by ID
  async getPayoutById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const payout = await partnerPayoutService.getPayoutById(id);
      res.json({ payout });
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Payout not found' });
    }
  }

  // Admin: Approve payout
  async approvePayout(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { adminNotes } = req.body;

      const payout = await partnerPayoutService.approvePayout(id, adminNotes);
      res.json({ payout });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to approve payout' });
    }
  }

  // Admin: Reject payout
  async rejectPayout(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        res.status(400).json({ error: 'Rejection reason is required' });
        return;
      }

      const payout = await partnerPayoutService.rejectPayout(id, rejectionReason);
      res.json({ payout });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to reject payout' });
    }
  }

  // Admin: Mark payout as paid
  async markPayoutAsPaid(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const payout = await partnerPayoutService.markPayoutAsPaid(id);
      res.json({ payout });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to mark payout as paid' });
    }
  }

  // Partner: Get own documents
  async getOwnDocuments(req: AuthRequest, res: Response) {
    try {
      const partnerId = req.user!.userId;
      
      // Verify user is a partner
      const user = await prisma.user.findUnique({
        where: { id: partnerId },
        select: { isPartner: true },
      });
      
      if (!user?.isPartner) {
        res.status(403).json({ error: 'User is not a partner' });
        return;
      }
      
      const type = req.query.type as string | undefined;

      const documents = await partnerDocumentService.getPartnerDocuments(partnerId, type);
      res.json({ documents: documents.map((document) => this.mapDocumentForResponse(document)) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get documents' });
    }
  }

  // Admin: Get partner documents
  async getPartnerDocuments(req: AuthRequest, res: Response) {
    try {
      const { partnerId } = req.params;
      const type = req.query.type as string | undefined;

      const documents = await partnerDocumentService.getPartnerDocuments(partnerId, type);
      res.json({ documents: documents.map((document) => this.mapDocumentForResponse(document)) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to get documents' });
    }
  }

  // Admin: Upload document for partner
  async uploadDocument(req: AuthRequest, res: Response) {
    try {
      const file = req.file as Express.Multer.File;
      const { partnerId, name, type, description, expiresAt } = req.body;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      if (!partnerId || !name || !type) {
        res.status(400).json({ error: 'Missing required fields: partnerId, name, type' });
        return;
      }

      // Upload file to storage
      const fileUrl = await storageService.uploadPrivateFile(
        file,
        PRIVATE_STORAGE_FOLDERS.partnerDocuments
      );

      const document = await partnerDocumentService.createDocument({
        partnerId,
        name,
        type: type as 'CONTRACT' | 'AGREEMENT' | 'OTHER',
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        description,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      res.status(201).json({ document: this.mapDocumentForResponse(document) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to upload document' });
    }
  }

  async downloadDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const document = await this.canAccessDocument(req, req.params.id);
      const file = await storageService.getFileBuffer(document.fileUrl);

      if (!file) {
        res.status(404).json({ error: 'Document file not found' });
        return;
      }

      res.setHeader('Content-Type', document.mimeType || file.contentType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(document.fileName || document.name || 'document')}"`
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(file.buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download document';
      if (message === 'Forbidden') {
        res.status(403).json({ error: message });
        return;
      }
      if (message === 'Unauthorized') {
        res.status(401).json({ error: message });
        return;
      }
      res.status(400).json({ error: message });
    }
  }

  // Admin: Delete document
  async deleteDocument(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const document = await partnerDocumentService.getDocumentById(id);
      await storageService.deleteFile(document.fileUrl).catch(() => false);
      await partnerDocumentService.deleteDocument(id);
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to delete document' });
    }
  }
}

export const partnerController = new PartnerController();
