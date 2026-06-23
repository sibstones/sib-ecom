import { Router } from 'express';
import { adminManagementController } from '../controllers/admin-management.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication and super admin role
router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN));

// Admin management routes
router.post('/', adminManagementController.createAdmin.bind(adminManagementController));
router.get('/', adminManagementController.getAllAdmins.bind(adminManagementController));
router.get('/:adminId', adminManagementController.getAdminById.bind(adminManagementController));
router.put('/:adminId', adminManagementController.updateAdmin.bind(adminManagementController));
router.post('/:adminId/deactivate', adminManagementController.deactivateAdmin.bind(adminManagementController));
router.post('/:adminId/activate', adminManagementController.activateAdmin.bind(adminManagementController));

// Activity logs routes
router.get('/:adminId/activity-logs', adminManagementController.getAdminActivityLogs.bind(adminManagementController));
router.get('/activity-logs/all', adminManagementController.getAllActivityLogs.bind(adminManagementController));

export default router;
