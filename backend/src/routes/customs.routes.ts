import { Router } from 'express';
import { customsController } from '../controllers/customs.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/', customsController.list.bind(customsController));
router.get('/:id', customsController.getById.bind(customsController));
router.post('/', customsController.create.bind(customsController));
router.patch('/:id', customsController.update.bind(customsController));
router.delete('/:id', customsController.delete.bind(customsController));

export default router;
