import { Request, Response } from 'express';
import { salesPointService } from '../services/sales-point.service';

export class SalesPointController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const points = await salesPointService.getAll();
      res.json({ salesPoints: points });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get sales points',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const point = await salesPointService.getById(id);
      res.json({ salesPoint: point });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : 'Sales point not found',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, type, warehouseId, externalId, settings } = req.body;
      const point = await salesPointService.create({
        name,
        type,
        warehouseId: warehouseId || null,
        externalId: externalId || null,
        settings: settings || null,
      });
      res.status(201).json({ salesPoint: point });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create sales point',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, isActive, warehouseId, externalId, settings } = req.body;
      const point = await salesPointService.update(id, {
        name,
        isActive,
        warehouseId: warehouseId !== undefined ? warehouseId : undefined,
        externalId: externalId !== undefined ? externalId : undefined,
        settings: settings !== undefined ? settings : undefined,
      });
      res.json({ salesPoint: point });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update sales point',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await salesPointService.delete(id);
      res.json({ message: 'Sales point deleted' });
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Failed to delete';
      res.status(err.includes('not found') ? 404 : 400).json({ error: err });
    }
  }

  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const products = await salesPointService.getProducts(id);
      res.json({ products });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get products',
      });
    }
  }

  async addProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { productId, variantId, warehouseId, maxQuantity } = req.body;
      const item = await salesPointService.addProduct(id, {
        productId,
        variantId: variantId || null,
        warehouseId: warehouseId || null,
        maxQuantity: maxQuantity ?? null,
      });
      res.status(201).json({ salesPointProduct: item });
    } catch (error) {
      console.error('SalesPointController.addProduct error:', error);
      const err = error as Error & { code?: string };
      if (err.code === 'P2002') {
        res.status(400).json({ error: 'Product already added to this sales point' });
        return;
      }
      if (err.code === 'P2003') {
        res.status(400).json({ error: 'Product, variant or warehouse not found' });
        return;
      }
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add product',
      });
    }
  }

  async removeProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id, salesPointProductId } = req.params;
      await salesPointService.removeProduct(id, salesPointProductId);
      res.json({ message: 'Product removed' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to remove product',
      });
    }
  }

  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const { salesPointProductId } = req.params;
      const { warehouseId, maxQuantity, isActive } = req.body;
      const item = await salesPointService.updateProduct(salesPointProductId, {
        warehouseId: warehouseId !== undefined ? warehouseId : undefined,
        maxQuantity: maxQuantity !== undefined ? maxQuantity : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      });
      res.json({ salesPointProduct: item });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update product',
      });
    }
  }

  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId, shippingAddressId, items, notes } = req.body;
      const order = await salesPointService.createOrderFromSalesPoint(id, {
        userId,
        shippingAddressId,
        items,
        notes: notes || null,
      });
      res.status(201).json({
        order: {
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          shipping: Number(order.shipping),
          total: Number(order.total),
          items: order.items?.map((i) => ({ ...i, price: Number(i.price) })),
        },
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create order',
      });
    }
  }
}

export const salesPointController = new SalesPointController();
