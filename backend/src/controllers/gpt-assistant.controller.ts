import { Response } from 'express';
import { gptAssistantService } from '../services/gpt-assistant.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { AssistantRequest } from '../types/gpt-assistant';
import prisma from '../config/database';
import { ragService } from '../services/rag.service';
import { aiConversationService } from '../services/ai-conversation.service';
import { ticketService } from '../services/ticket.service';

export class GPTAssistantController {
  async getHealth(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rag = await ragService.getHealth(req.user ? 'admin' : undefined, true);
      res.json({
        status: 'ok',
        rag,
      });
    } catch (error) {
      console.error('GPT Assistant health error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get GPT Assistant health',
      });
    }
  }

  /**
   * Handle chat request from admin
   */
  async chatAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { message, context } = req.body as AssistantRequest;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const response = await gptAssistantService.processRequest(
        req.user.userId,
        'admin',
        message,
        {
          previousMessages: context?.previousMessages,
          currentPage: context?.currentPage,
        }
      );

      res.json(response);
    } catch (error) {
      console.error('GPT Assistant admin chat error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to process request',
      });
    }
  }

  /**
   * Handle chat request from customer
   */
  async chatCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.headers['x-session-id'] as string | undefined;
      
      const { message, context } = req.body as AssistantRequest;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const userType = userId ? 'customer' : 'guest';

      const response = await gptAssistantService.processRequest(
        userId,
        userType,
        message,
        {
          previousMessages: context?.previousMessages,
          currentPage: context?.currentPage,
          sessionId,
        }
      );

      res.json(response);
    } catch (error) {
      console.error('GPT Assistant customer chat error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to process request',
      });
    }
  }

  /**
   * Get chat history for admin
   */
  async getHistoryAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await prisma.adminAssistantChatHistory.findMany({
        where: { adminId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const total = await prisma.adminAssistantChatHistory.count({
        where: { adminId: req.user.userId },
      });

      res.json({
        messages: history,
        total,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Get admin history error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get history',
      });
    }
  }

  async clearHistoryAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await prisma.adminAssistantChatHistory.deleteMany({
        where: { adminId: req.user.userId },
      });

      res.json({ deleted: result.count });
    } catch (error) {
      console.error('Clear admin history error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to clear history',
      });
    }
  }

  /**
   * Get chat history for customer
   */
  async getHistoryCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.headers['x-session-id'] as string | undefined;

      if (!userId && !sessionId) {
        res.status(400).json({ error: 'User ID or session ID is required' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const where: any = {};
      if (userId) {
        where.userId = userId;
      } else if (sessionId) {
        where.sessionId = sessionId;
      }

      const history = await prisma.customerAssistantChatHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const total = await prisma.customerAssistantChatHistory.count({ where });

      res.json({
        messages: history,
        total,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Get customer history error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get history',
      });
    }
  }

  async clearHistoryCustomer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.headers['x-session-id'] as string | undefined;

      if (!userId && !sessionId) {
        res.status(400).json({ error: 'User ID or session ID is required' });
        return;
      }

      const where: Record<string, string> = {};
      if (userId) {
        where.userId = userId;
      } else if (sessionId) {
        where.sessionId = sessionId;
      }

      const result = await prisma.customerAssistantChatHistory.deleteMany({ where });

      res.json({ deleted: result.count });
    } catch (error) {
      console.error('Clear customer history error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to clear history',
      });
    }
  }

  async getAdminConversations(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const channel = req.query.channel as 'admin' | 'customer' | undefined;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await aiConversationService.listConversations({
        channel,
        status,
        search,
        limit,
        offset,
      });

      res.json(result);
    } catch (error) {
      console.error('Get admin conversations error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get admin conversations',
      });
    }
  }

  async getAdminConversationById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const conversation = await aiConversationService.getConversationById(id);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.json(conversation);
    } catch (error) {
      console.error('Get admin conversation detail error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get conversation detail',
      });
    }
  }

  async createTicketFromConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { subject, message } = req.body as { subject?: string; message?: string };
      const conversation = await aiConversationService.getConversationById(id);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      if (conversation.supportTicketId) {
        res.status(400).json({ error: 'Conversation is already linked to a support ticket' });
        return;
      }

      if (!conversation.userId) {
        res.status(400).json({ error: 'This conversation is not linked to a customer account' });
        return;
      }

      const draft = aiConversationService.buildDraftReply(conversation);
      const ticket = await ticketService.createTicketForCustomer(
        null,
        conversation.userId,
        req.user.userId,
        subject?.trim() || conversation.title || 'AI conversation follow-up',
        message?.trim() || draft.draft,
        {
          source: conversation.channel === 'CUSTOMER' ? 'AI_CUSTOMER' : 'AI_ADMIN',
          messageSource: 'AI_DRAFT',
          category: conversation.topicLabel || null,
        }
      );

      await aiConversationService.linkSupportTicket(conversation.id, ticket.id, req.user.userId);

      res.status(201).json({ ticket });
    } catch (error) {
      console.error('Create ticket from conversation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create ticket from conversation',
      });
    }
  }

  async draftReplyForConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const conversation = await aiConversationService.getConversationById(id);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const draft = aiConversationService.buildDraftReply(conversation);
      res.json(draft);
    } catch (error) {
      console.error('Draft reply for conversation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to draft reply',
      });
    }
  }

  async sendReplyForConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { message } = req.body as { message?: string };
      const conversation = await aiConversationService.getConversationById(id);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      if (!conversation.supportTicketId) {
        res.status(400).json({ error: 'Create or link a support ticket before sending a reply' });
        return;
      }

      const draft = aiConversationService.buildDraftReply(conversation);
      const ticket = await ticketService.addAdminMessage(
        conversation.supportTicketId,
        req.user.userId,
        message?.trim() || draft.draft,
        {
          source: 'AI_SENT',
        }
      );

      await aiConversationService.markWaitingForUser(id, req.user.userId);
      res.json({ ticket });
    } catch (error) {
      console.error('Send reply for conversation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to send reply',
      });
    }
  }

  async escalateConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const conversation = await aiConversationService.markEscalated(id, req.user.userId);
      res.json({ conversation });
    } catch (error) {
      console.error('Escalate conversation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to escalate conversation',
      });
    }
  }

  async resolveConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const conversation = await aiConversationService.markResolved(id);
      await aiConversationService.syncLinkedTicketResolution(id);
      res.json({ conversation });
    } catch (error) {
      console.error('Resolve conversation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to resolve conversation',
      });
    }
  }
}

export const gptAssistantController = new GPTAssistantController();
