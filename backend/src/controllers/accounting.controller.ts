import { Request, Response } from 'express';
import { accountingService } from '../services/accounting.service';
import { AccountingAccountType } from '@prisma/client';

export class AccountingController {
  async listCharts(req: Request, res: Response) {
    try {
      const region = req.query.region as string | undefined;
      const charts = await accountingService.listCharts(region);
      res.json({ charts });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list charts' });
    }
  }

  async getChartById(req: Request, res: Response) {
    try {
      const chart = await accountingService.getChartById(req.params.id);
      if (!chart) return res.status(404).json({ error: 'Chart not found' });
      res.json(chart);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get chart' });
    }
  }

  async createChart(req: Request, res: Response) {
    try {
      const { region, name } = req.body;
      const chart = await accountingService.createChart({ region, name });
      res.status(201).json(chart);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create chart' });
    }
  }

  async updateChart(req: Request, res: Response) {
    try {
      const chart = await accountingService.updateChart(req.params.id, req.body);
      res.json(chart);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to update chart' });
    }
  }

  async deleteChart(req: Request, res: Response) {
    try {
      await accountingService.deleteChart(req.params.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete chart' });
    }
  }

  async addChartItem(req: Request, res: Response) {
    try {
      const { chartId } = req.params;
      const { code, name, type } = req.body;
      const item = await accountingService.addChartItem(chartId, {
        code,
        name,
        type: type as AccountingAccountType,
      });
      res.status(201).json(item);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to add chart item' });
    }
  }

  async updateChartItem(req: Request, res: Response) {
    try {
      const item = await accountingService.updateChartItem(req.params.id, req.body);
      res.json(item);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to update chart item' });
    }
  }

  async deleteChartItem(req: Request, res: Response) {
    try {
      await accountingService.deleteChartItem(req.params.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete chart item' });
    }
  }

  async listTemplates(req: Request, res: Response) {
    try {
      const region = req.query.region as string | undefined;
      const legalRegime = req.query.legalRegime as string | undefined;
      const templates = await accountingService.listTemplates(region, legalRegime);
      res.json({ templates });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list templates' });
    }
  }

  async getTemplateById(req: Request, res: Response) {
    try {
      const template = await accountingService.getTemplateById(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.json(template);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to get template' });
    }
  }

  async createTemplate(req: Request, res: Response) {
    try {
      const template = await accountingService.createTemplate(req.body);
      res.status(201).json(template);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create template' });
    }
  }

  async updateTemplate(req: Request, res: Response) {
    try {
      const template = await accountingService.updateTemplate(req.params.id, req.body);
      res.json(template);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to update template' });
    }
  }

  async deleteTemplate(req: Request, res: Response) {
    try {
      await accountingService.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete template' });
    }
  }

  async listEntries(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }
      const region = req.query.region as string | undefined;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const result = await accountingService.listEntries({
        startDate,
        endDate,
        region,
        entityType,
        entityId,
        limit,
        offset,
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to list entries' });
    }
  }

  async exportEntries(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      endDate.setHours(23, 59, 59, 999);
      const region = req.query.region as string | undefined;
      const { items } = await accountingService.listEntries({
        startDate,
        endDate,
        region,
        limit: 10000,
        offset: 0,
      });
      const csv = await accountingService.exportEntriesToCSV(items);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=accounting-entries-${Date.now()}.csv`);
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to export entries' });
    }
  }

  async generateEntries(req: Request, res: Response) {
    try {
      const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date();
      endDate.setHours(23, 59, 59, 999);
      const region = (req.body.region as string) || 'RU';
      const legalRegime = req.body.legalRegime as string | undefined;
      const result = await accountingService.generateEntries({
        startDate,
        endDate,
        region,
        legalRegime,
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to generate entries' });
    }
  }

  async getConstants(_req: Request, res: Response) {
    res.json({
      regions: accountingService.SUPPORTED_REGIONS,
      triggerEvents: accountingService.TRIGGER_EVENTS,
      accountTypes: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'],
      legalRegimesByRegion: accountingService.LEGAL_REGIMES_BY_REGION,
    });
  }
}

export const accountingController = new AccountingController();
