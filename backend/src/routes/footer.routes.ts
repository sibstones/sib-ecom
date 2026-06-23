import { Router } from 'express';
import { footerController } from '../controllers/footer.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public route - get footer (for frontend)
router.get('/', footerController.get.bind(footerController));

// Protected routes (Admin only)
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/:id', footerController.getById.bind(footerController));
router.post('/', footerController.create.bind(footerController));
router.put('/:id', footerController.update.bind(footerController));
router.delete('/:id', footerController.delete.bind(footerController));

export default router;
