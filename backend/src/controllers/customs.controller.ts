import { Request, Response } from 'express';
import { customsService } from '../services/customs.service';
import { CustomsDirection } from '@prisma/client';

export class CustomsController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const direction = req.query.direction as CustomsDirection | undefined;
      const orderId = req.query.orderId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await customsService.list({
        startDate,
        endDate,
        direction,
        orderId,
        limit,
        offset,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list customs declarations',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const item = await customsService.getById(id);
      if (!item) {
        res.status(404).json({ error: 'Customs declaration not found' });
        return;
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get customs declaration',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;
      const dto = {
        declarationNumber: body.declarationNumber,
        declarationDate: body.declarationDate
          ? new Date(body.declarationDate)
          : new Date(),
        direction: body.direction as CustomsDirection,
        customsOffice: body.customsOffice,
        customsProcedure: body.customsProcedure,
        totalCustomsValue: body.totalCustomsValue != null ? Number(body.totalCustomsValue) : undefined,
        totalCustomsValueCurrency: body.totalCustomsValueCurrency,
        vatAmount: body.vatAmount != null ? Number(body.vatAmount) : undefined,
        dutyAmount: body.dutyAmount != null ? Number(body.dutyAmount) : undefined,
        orderId: body.orderId,
      };
      const item = await customsService.create(dto);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create customs declaration',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body;
      const dto: Record<string, unknown> = {};
      if (body.declarationNumber != null) dto.declarationNumber = body.declarationNumber;
      if (body.declarationDate != null) dto.declarationDate = new Date(body.declarationDate);
      if (body.direction != null) dto.direction = body.direction;
      if (body.customsOffice !== undefined) dto.customsOffice = body.customsOffice;
      if (body.customsProcedure !== undefined) dto.customsProcedure = body.customsProcedure;
      if (body.totalCustomsValue !== undefined)
        dto.totalCustomsValue = body.totalCustomsValue != null ? Number(body.totalCustomsValue) : null;
      if (body.totalCustomsValueCurrency !== undefined)
        dto.totalCustomsValueCurrency = body.totalCustomsValueCurrency;
      if (body.vatAmount !== undefined)
        dto.vatAmount = body.vatAmount != null ? Number(body.vatAmount) : null;
      if (body.dutyAmount !== undefined)
        dto.dutyAmount = body.dutyAmount != null ? Number(body.dutyAmount) : null;
      if (body.orderId !== undefined) dto.orderId = body.orderId;

      const item = await customsService.update(id, dto as Parameters<typeof customsService.update>[1]);
      res.json(item);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update customs declaration',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await customsService.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete customs declaration',
      });
    }
  }
}

export const customsController = new CustomsController();
