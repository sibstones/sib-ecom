import { Router } from 'express';
import { accountingController } from '../controllers/accounting.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/constants', accountingController.getConstants.bind(accountingController));

// Charts
router.get('/charts', accountingController.listCharts.bind(accountingController));
router.get('/charts/:id', accountingController.getChartById.bind(accountingController));
router.post('/charts', accountingController.createChart.bind(accountingController));
router.patch('/charts/:id', accountingController.updateChart.bind(accountingController));
router.delete('/charts/:id', accountingController.deleteChart.bind(accountingController));

// Chart items
router.post('/charts/:chartId/items', accountingController.addChartItem.bind(accountingController));
router.patch('/chart-items/:id', accountingController.updateChartItem.bind(accountingController));
router.delete('/chart-items/:id', accountingController.deleteChartItem.bind(accountingController));

// Templates
router.get('/templates', accountingController.listTemplates.bind(accountingController));
router.get('/templates/:id', accountingController.getTemplateById.bind(accountingController));
router.post('/templates', accountingController.createTemplate.bind(accountingController));
router.patch('/templates/:id', accountingController.updateTemplate.bind(accountingController));
router.delete('/templates/:id', accountingController.deleteTemplate.bind(accountingController));

// Entries
router.get('/entries', accountingController.listEntries.bind(accountingController));
router.get('/entries/export', accountingController.exportEntries.bind(accountingController));
router.post('/entries/generate', accountingController.generateEntries.bind(accountingController));

export default router;
