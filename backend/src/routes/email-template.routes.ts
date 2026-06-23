import { Router } from 'express';
import { emailTemplateController } from '../controllers/email-template.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public route - get all templates (for preview)
router.get('/', emailTemplateController.getAll.bind(emailTemplateController));
router.get('/:type', emailTemplateController.getTemplate.bind(emailTemplateController));

// Protected routes (Admin only)
router.put(
  '/:type',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  emailTemplateController.createOrUpdateTemplate.bind(emailTemplateController)
);

router.delete(
  '/:type',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  emailTemplateController.deleteTemplate.bind(emailTemplateController)
);

export default router;
