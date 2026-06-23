import { Router } from 'express';
import { gptAssistantController } from '../controllers/gpt-assistant.controller';
import { gptAssistantSettingsController } from '../controllers/gpt-assistant-settings.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';

const router = Router();

// Public: visibility flags for showing/hiding GPT button (no auth)
router.get(
  '/visibility',
  gptAssistantSettingsController.getVisibility.bind(gptAssistantSettingsController)
);

// Public: display config (title, FAB icon URL, quick prompts) for chat UI (no auth)
router.get(
  '/config',
  gptAssistantSettingsController.getDisplayConfig.bind(gptAssistantSettingsController)
);

// Validation schemas
const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1),
    context: z.object({
      previousMessages: z.array(z.any()).optional(),
      currentPage: z.string().optional(),
    }).optional(),
  }),
});

const createConversationTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  }),
});

const sendConversationReplySchema = z.object({
  body: z.object({
    message: z.string().min(1).optional(),
  }),
});

// Admin routes
router.post(
  '/admin/chat',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(chatSchema),
  gptAssistantController.chatAdmin.bind(gptAssistantController)
);

router.get(
  '/admin/history',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.getHistoryAdmin.bind(gptAssistantController)
);

router.delete(
  '/admin/history',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.clearHistoryAdmin.bind(gptAssistantController)
);

router.get(
  '/admin/conversations',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.getAdminConversations.bind(gptAssistantController)
);

router.get(
  '/admin/conversations/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.getAdminConversationById.bind(gptAssistantController)
);

router.post(
  '/admin/conversations/:id/create-ticket',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(createConversationTicketSchema),
  gptAssistantController.createTicketFromConversation.bind(gptAssistantController)
);

router.post(
  '/admin/conversations/:id/draft-reply',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.draftReplyForConversation.bind(gptAssistantController)
);

router.post(
  '/admin/conversations/:id/send-reply',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(sendConversationReplySchema),
  gptAssistantController.sendReplyForConversation.bind(gptAssistantController)
);

router.post(
  '/admin/conversations/:id/escalate',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.escalateConversation.bind(gptAssistantController)
);

router.post(
  '/admin/conversations/:id/resolve',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.resolveConversation.bind(gptAssistantController)
);

router.get(
  '/admin/health',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  gptAssistantController.getHealth.bind(gptAssistantController)
);

// Customer routes (authenticated)
router.post(
  '/customer/chat',
  authenticate, // Optional - allows guests
  validate(chatSchema),
  gptAssistantController.chatCustomer.bind(gptAssistantController)
);

router.get(
  '/customer/history',
  authenticate, // Optional - allows guests
  gptAssistantController.getHistoryCustomer.bind(gptAssistantController)
);

router.delete(
  '/customer/history',
  authenticate, // Optional - allows guests
  gptAssistantController.clearHistoryCustomer.bind(gptAssistantController)
);

export default router;
