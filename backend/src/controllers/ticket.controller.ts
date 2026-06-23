import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ticketService } from '../services/ticket.service';
import { TicketStatus } from '@prisma/client';

export class TicketController {
  // Customer: Create ticket
  async createTicket(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { orderId, subject, message } = req.body;

      if (!orderId || !subject || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const ticket = await ticketService.createTicket(orderId, userId, subject, message);
      res.status(201).json({ ticket });
      return;
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create ticket' });
      return;
    }
  }

  // Customer: Get customer tickets
  async getCustomerTickets(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await ticketService.getCustomerTickets(userId, page, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get tickets' });
    }
  }

  // Customer: Get single ticket (optionally mark as read via query ?markRead=1)
  async getCustomerTicket(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { ticketId } = req.params;
      const markAsRead = req.query.markRead === '1' || req.query.markRead === 'true';

      const ticket = await ticketService.getCustomerTicket(ticketId, userId, markAsRead);
      res.json({ ticket });
      return;
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Ticket not found' });
      return;
    }
  }

  // Customer: Mark ticket as read
  async markTicketAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { ticketId } = req.params;

      await ticketService.markTicketAsRead(ticketId, userId);
      res.json({ message: 'OK' });
      return;
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to mark as read' });
      return;
    }
  }

  // Customer: Add message
  async addCustomerMessage(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { ticketId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const ticket = await ticketService.addCustomerMessage(ticketId, userId, message);
      res.json({ ticket });
      return;
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to add message' });
      return;
    }
  }

  // Admin: Get all tickets
  async getAllTickets(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as TicketStatus | undefined;
      const search = req.query.search as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const sortOrder = (req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc') ? req.query.sortOrder as 'asc' | 'desc' : undefined;

      const result = await ticketService.getAllTickets(page, limit, { status, search, dateFrom, dateTo, sortOrder });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get tickets' });
    }
  }

  // Admin: Get ticket details
  async getTicketDetails(req: AuthRequest, res: Response) {
    try {
      const { ticketId } = req.params;

      const ticket = await ticketService.getTicketDetails(ticketId);
      res.json({ ticket });
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Ticket not found' });
    }
  }

  // Admin: Assign ticket
  async assignTicket(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user!.userId;
      const { ticketId } = req.params;

      const ticket = await ticketService.assignTicket(ticketId, adminId);
      res.json({ ticket });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to assign ticket' });
      return;
    }
  }

  // Admin: Add admin message
  async addAdminMessage(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user!.userId;
      const { ticketId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const ticket = await ticketService.addAdminMessage(ticketId, adminId, message);
      res.json({ ticket });
      return;
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to add message' });
      return;
    }
  }

  // Admin: Update ticket status
  async updateTicketStatus(req: AuthRequest, res: Response) {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;

      if (!status || !Object.values(TicketStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const ticket = await ticketService.updateTicketStatus(ticketId, status);
      res.json({ ticket });
      return;
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update status' });
      return;
    }
  }

  // Admin: Create ticket for customer (orderId optional — e.g. proactive support)
  async createTicketForCustomer(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user!.userId;
      const { orderId, userId, subject, message } = req.body;

      if (!userId || !subject || !message) {
        return res.status(400).json({ error: 'Missing required fields: userId, subject, message' });
      }

      const ticket = await ticketService.createTicketForCustomer(
        orderId ?? null,
        userId,
        adminId,
        subject,
        message
      );
      res.status(201).json({ ticket });
      return;
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create ticket' });
      return;
    }
  }

  // Admin: Get ticket stats
  async getTicketStats(req: AuthRequest, res: Response) {
    try {
      const stats = await ticketService.getTicketStats();
      
      // Ensure stats object has all required properties
      const safeStats = {
        total: stats?.total ?? 0,
        open: stats?.open ?? 0,
        inProgress: stats?.inProgress ?? 0,
        resolved: stats?.resolved ?? 0,
        closed: stats?.closed ?? 0,
      };
      
      res.json({ stats: safeStats });
    } catch (error) {
      console.error('Error in getTicketStats controller:', error);
      // Return default stats instead of error to prevent frontend crashes
      res.json({
        stats: {
          total: 0,
          open: 0,
          inProgress: 0,
          resolved: 0,
          closed: 0,
        },
      });
    }
  }
}

export const ticketController = new TicketController();
