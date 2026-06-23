import { Request, Response } from 'express';
import { returnService } from '../services/return.service';
import { CreateReturnRequestDto, ProcessReturnRequestDto } from '../types/return-request';
import { AuthRequest } from '../middleware/auth.middleware';

export class ReturnController {
  /**
  * Create return request (customer)
   */
  async createReturnRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        console.error('createReturnRequest: Unauthorized - no userId');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data = req.body as CreateReturnRequestDto;
      console.log('createReturnRequest: Received request', {
        userId,
        orderId: data.orderId,
        reason: data.reason,
        itemsCount: data.items?.length,
        items: data.items
      });

      const returnRequest = await returnService.createReturnRequest(userId, data);

      console.log('createReturnRequest: Success', {
        returnRequestId: returnRequest.id,
        orderId: returnRequest.orderId
      });

      res.status(201).json({ returnRequest });
    } catch (error) {
      console.error('createReturnRequest: Error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create return request',
      });
    }
  }

  /**
   * Get return requests for user (client)
   */
  async getMyReturnRequests(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await returnService.getAllReturnRequests({
        userId,
      });

      res.json({ returnRequests: result.returnRequests });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to get return requests',
      });
    }
  }

  /**
   * Get return request by ID (client)
   */
  async getReturnRequestById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { returnRequestId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const returnRequest = await returnService.getReturnRequestById(returnRequestId);

      if (!returnRequest) {
        res.status(404).json({ error: 'Return request not found' });
        return;
      }

      // Check that the request belongs to the user
      if (returnRequest.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.json({ returnRequest });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to get return request',
      });
    }
  }

  /**
   * Get all return requests (admin)
   */
  async getAllReturnRequests(req: Request, res: Response): Promise<void> {
    try {
      const { status, orderId, userId, page, limit, dateFrom, dateTo, sortOrder } = req.query;

      const result = await returnService.getAllReturnRequests({
        status: status ? (status as string) : undefined,
        orderId: orderId ? (orderId as string) : undefined,
        userId: userId ? (userId as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        dateFrom: dateFrom ? (dateFrom as string) : undefined,
        dateTo: dateTo ? (dateTo as string) : undefined,
        sortOrder: (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder as 'asc' | 'desc' : undefined,
      });

      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to get return requests',
      });
    }
  }

  /**
   * Get return request by ID (admin)
   */
  async getReturnRequest(req: Request, res: Response): Promise<void> {
    try {
      const { returnRequestId } = req.params;

      const returnRequest = await returnService.getReturnRequestById(returnRequestId);

      if (!returnRequest) {
        res.status(404).json({ error: 'Return request not found' });
        return;
      }

      res.json({ returnRequest });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to get return request',
      });
    }
  }

  /**
   * Process return request (admin)
   */
  async processReturnRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.userId;
      const { returnRequestId } = req.params;
      const data = req.body as ProcessReturnRequestDto;

      if (!adminId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const returnRequest = await returnService.processReturnRequest(
        returnRequestId,
        data,
        adminId
      );

      res.json({ returnRequest });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to process return request',
      });
    }
  }
}

export const returnController = new ReturnController();
