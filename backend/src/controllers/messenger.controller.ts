import { Response } from 'express';
import { messengerService } from '../services/messenger.service';
import { CreateMessengerContactDto, UpdateMessengerContactDto } from '../types/messenger';
import { AuthRequest } from '../middleware/auth.middleware';

export class MessengerController {
  async getContacts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const contacts = await messengerService.getContacts(userId);
      res.json({ contacts });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get messenger contacts',
      });
    }
  }

  async createContact(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const data = req.body as CreateMessengerContactDto;
      const contact = await messengerService.createContact(userId, data);
      res.status(201).json({ contact });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create messenger contact',
      });
    }
  }

  async updateContact(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { id } = req.params;
      const data = req.body as UpdateMessengerContactDto;
      const contact = await messengerService.updateContact(id, userId, data);
      res.json({ contact });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update messenger contact',
      });
    }
  }

  async deleteContact(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { id } = req.params;
      await messengerService.deleteContact(id, userId);
      res.json({ message: 'Messenger contact deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete messenger contact',
      });
    }
  }
}

export const messengerController = new MessengerController();
