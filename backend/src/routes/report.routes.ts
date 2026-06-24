import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/overview', reportController.generateOverviewReport.bind(reportController));
router.get('/overview/export', reportController.exportOverviewReport.bind(reportController));
router.get('/overview/export/xlsx', reportController.exportOverviewReportXLSX.bind(reportController));
router.get('/sales', reportController.generateSalesReport.bind(reportController));
router.get('/sales/export', reportController.exportSalesReport.bind(reportController));
router.get('/sales/export/xlsx', reportController.exportSalesReportXLSX.bind(reportController));
router.get('/customers', reportController.generateCustomerReport.bind(reportController));
router.get('/customers/export', reportController.exportCustomerReport.bind(reportController));
router.get('/customers/export/xlsx', reportController.exportCustomerReportXLSX.bind(reportController));

// Delivery by Seller reports (tax & accounting)
router.get('/purchases', reportController.generatePurchasesReport.bind(reportController));
router.get('/purchases/export', reportController.exportPurchasesReport.bind(reportController));
router.get('/purchases/export/xlsx', reportController.exportPurchasesReportXLSX.bind(reportController));
router.get('/returns', reportController.generateReturnsReport.bind(reportController));
router.get('/returns/export', reportController.exportReturnsReport.bind(reportController));
router.get('/returns/export/xlsx', reportController.exportReturnsReportXLSX.bind(reportController));
router.get('/payment-methods', reportController.generatePaymentMethodsReport.bind(reportController));
router.get('/payment-methods/export', reportController.exportPaymentMethodsReport.bind(reportController));
router.get('/payment-methods/export/xlsx', reportController.exportPaymentMethodsReportXLSX.bind(reportController));
router.get('/delivery', reportController.generateDeliveryReport.bind(reportController));
router.get('/delivery/export', reportController.exportDeliveryReport.bind(reportController));
router.get('/delivery/export/xlsx', reportController.exportDeliveryReportXLSX.bind(reportController));
router.get('/customs', reportController.generateCustomsReport.bind(reportController));
router.get('/customs/export', reportController.exportCustomsReport.bind(reportController));
router.get('/customs/export/xlsx', reportController.exportCustomsReportXLSX.bind(reportController));
router.get('/tax-summary', reportController.generateTaxSummaryReport.bind(reportController));
router.get('/tax-summary/export', reportController.exportTaxSummaryReport.bind(reportController));
router.get('/tax-summary/export/xlsx', reportController.exportTaxSummaryReportXLSX.bind(reportController));

export default router;
