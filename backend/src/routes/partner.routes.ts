import { Router } from 'express';
import { partnerController } from '../controllers/partner.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadSingleDocument, handleUploadError } from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// Admin routes
router.get('/admin/partners', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.getAllPartners.bind(partnerController));
router.get('/admin/partners/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.getPartnerById.bind(partnerController));
router.put('/admin/partners/:id/status', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.updatePartnerStatus.bind(partnerController));
router.get('/admin/partners/:id/stats', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.getPartnerStats.bind(partnerController));
router.get('/admin/partners/:id/orders', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.getPartnerOrders.bind(partnerController));
router.post('/admin/users/:userId/assign-partner', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.assignPartner.bind(partnerController));
router.post('/admin/users/:userId/remove-partner', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.removePartner.bind(partnerController));

// Admin payout routes
router.get('/admin/partner-payouts', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.getAllPayouts.bind(partnerController));
router.get('/admin/partner-payouts/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.getPayoutById.bind(partnerController));
router.post('/admin/partner-payouts/:id/approve', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.approvePayout.bind(partnerController));
router.post('/admin/partner-payouts/:id/reject', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.rejectPayout.bind(partnerController));
router.post('/admin/partner-payouts/:id/mark-paid', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.markPayoutAsPaid.bind(partnerController));

// Admin document routes
router.get('/admin/partners/:partnerId/documents', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.getPartnerDocuments.bind(partnerController));
router.post('/admin/partners/:partnerId/documents', uploadLimiter, authenticate, authorize('ADMIN', 'SUPER_ADMIN'), uploadSingleDocument, handleUploadError, partnerController.uploadDocument.bind(partnerController));
router.delete('/admin/partner-documents/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), partnerController.deleteDocument.bind(partnerController));
router.get('/partner-documents/:id/download', authenticate, partnerController.downloadDocument.bind(partnerController));

// Partner routes (for partners themselves)
router.get('/partner/promoCodes', authenticate, partnerController.getOwnPromoCodes.bind(partnerController));
router.get('/partner/commissions', authenticate, partnerController.getOwnCommissions.bind(partnerController));
router.get('/partner/commissions/stats', authenticate, partnerController.getCommissionStats.bind(partnerController));
router.get('/partner/commissions/available', authenticate, partnerController.getAvailableCommissions.bind(partnerController));
router.post('/partner/payouts', authenticate, partnerController.createPayoutRequest.bind(partnerController));
router.get('/partner/payouts', authenticate, partnerController.getOwnPayouts.bind(partnerController));
router.get('/partner/documents', authenticate, partnerController.getOwnDocuments.bind(partnerController));

export default router;
