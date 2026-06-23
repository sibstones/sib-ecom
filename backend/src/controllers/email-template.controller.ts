import { Request, Response } from 'express';
import { emailTemplateService, EmailTemplateData, EmailTemplateType } from '../services/email-template.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class EmailTemplateController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const templates = await emailTemplateService.getAllTemplates();
      res.json({ templates });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get email templates',
      });
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const template = await emailTemplateService.getTemplate(type as EmailTemplateType);
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      res.json({ template });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get email template',
      });
    }
  }

  async createOrUpdateTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body as EmailTemplateData;
      const updatedBy = req.user?.userId;

      if (!data.type || !data.subject || !data.htmlContent) {
        res.status(400).json({ error: 'Type, subject, and htmlContent are required' });
        return;
      }

      const template = await emailTemplateService.createOrUpdateTemplate(data, updatedBy);
      res.json({ template });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to save email template',
      });
    }
  }

  async deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      await emailTemplateService.deleteTemplate(type as EmailTemplateType);
      res.json({ message: 'Template deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete email template',
      });
    }
  }
}

export const emailTemplateController = new EmailTemplateController();
