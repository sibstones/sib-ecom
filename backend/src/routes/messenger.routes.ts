import { Router } from 'express';
import { messengerController } from '../controllers/messenger.controller';
import { authenticate } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createMessengerContactSchema = z.object({
  body: z.object({
    type: z.enum(['TELEGRAM', 'WHATSAPP', 'VIBER', 'OTHER']),
    contactId: z.string().min(1),
    username: z.string().optional(),
  }),
});

const updateMessengerContactSchema = z.object({
  body: z.object({
    contactId: z.string().optional(),
    username: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

// Protected routes (authenticated users)
router.get('/', authenticate, messengerController.getContacts.bind(messengerController));

router.post(
  '/',
  authenticate,
  validate(createMessengerContactSchema),
  messengerController.createContact.bind(messengerController)
);

router.put(
  '/:id',
  authenticate,
  validate(updateMessengerContactSchema),
  messengerController.updateContact.bind(messengerController)
);

router.delete(
  '/:id',
  authenticate,
  messengerController.deleteContact.bind(messengerController)
);

export default router;
