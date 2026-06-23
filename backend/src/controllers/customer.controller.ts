import { Request, Response } from 'express';
import { customerService } from '../services/customer.service';
import { ticketService } from '../services/ticket.service';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  CreateAddressDto,
  UpdateAddressDto,
  CreateOrderDto,
  CreateGuestOrderDto,
  UpdatePaymentMethodDto,
} from '../types/customer';
import { AuthRequest } from '../middleware/auth.middleware';

export class CustomerController {
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const profile = await customerService.getProfile(req.user.userId);
      res.json({ profile });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get profile',
      });
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: UpdateProfileDto = req.body;
      const profile = await customerService.updateProfile(req.user.userId, data);
      res.json({ profile });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update profile',
      });
    }
  }

  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: ChangePasswordDto = req.body;
      await customerService.changePassword(req.user.userId, data);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to change password',
      });
    }
  }

  // Addresses
  async getAddresses(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const addresses = await customerService.getAddresses(req.user.userId);
      res.json({ addresses });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get addresses',
      });
    }
  }

  async createAddress(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: CreateAddressDto = req.body;
      const address = await customerService.createAddress(req.user.userId, data);
      res.status(201).json({ address });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create address',
      });
    }
  }

  async updateAddress(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { addressId } = req.params;
      const data: UpdateAddressDto = req.body;
      const address = await customerService.updateAddress(req.user.userId, addressId, data);
      res.json({ address });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update address',
      });
    }
  }

  async deleteAddress(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { addressId } = req.params;
      await customerService.deleteAddress(req.user.userId, addressId);
      res.json({ message: 'Address deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete address',
      });
    }
  }

  // Orders
  async getOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await customerService.getOrders(req.user.userId, page, limit);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedResult = {
        ...result,
        orders: result.orders.map((order) => ({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          shipping: Number(order.shipping),
          total: Number(order.total),
          loyaltyDiscount: Number(order.loyaltyDiscount || 0),
          loyaltyPointsSpent: Number(order.loyaltyPointsSpent || 0),
          items: order.items?.map((item) => ({
            ...item,
            price: Number(item.price),
          })) || [],
        })),
      };
      
      res.json(serializedResult);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get orders',
      });
    }
  }

  async getOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { orderId } = req.params;
      const order = await customerService.getOrder(req.user.userId, orderId);
      
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        loyaltyDiscount: Number(order.loyaltyDiscount || 0),
        loyaltyPointsSpent: Number(order.loyaltyPointsSpent || 0),
        items: order.items.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
      };

      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get order',
      });
    }
  }

  async createOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: CreateOrderDto = req.body;
      const sessionId = req.headers['x-session-id'] as string;
      const order = await customerService.createOrder(req.user.userId, data, sessionId);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        loyaltyDiscount: Number(order.loyaltyDiscount || 0),
        loyaltyPointsSpent: Number(order.loyaltyPointsSpent || 0),
        items: order.items.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
      };

      res.status(201).json({ order: serializedOrder });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create order',
      });
    }
  }

  async createGuestOrder(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateGuestOrderDto = req.body;
      const sessionId = req.headers['x-session-id'] as string;
      const { order, guestPaymentToken } = await customerService.createGuestOrder(data, sessionId);

      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        loyaltyDiscount: Number(order.loyaltyDiscount || 0),
        loyaltyPointsSpent: Number(order.loyaltyPointsSpent || 0),
        items: order.items.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
      };

      res.status(201).json({ order: serializedOrder, guestPaymentToken });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create guest order',
      });
    }
  }

  async checkGuestCheckoutEmail(req: Request, res: Response): Promise<void> {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
      const result = await customerService.checkGuestCheckoutEmail(email);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to check guest checkout email',
      });
    }
  }

  // Wishlist
  async getWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const items = await customerService.getWishlist(req.user.userId);
      res.json({ items });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get wishlist',
      });
    }
  }

  async addToWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { productId } = req.body;
      const item = await customerService.addToWishlist(req.user.userId, productId);
      res.status(201).json({ item });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add to wishlist',
      });
    }
  }

  async removeFromWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { productId } = req.params;
      await customerService.removeFromWishlist(req.user.userId, productId);
      res.json({ message: 'Removed from wishlist' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to remove from wishlist',
      });
    }
  }

  async checkWishlist(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { productId } = req.params;
      const isInWishlist = await customerService.isInWishlist(req.user.userId, productId);
      res.json({ isInWishlist });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to check wishlist',
      });
    }
  }

  async updatePaymentMethod(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { orderId } = req.params;
      const data: UpdatePaymentMethodDto = req.body;
      const order = await customerService.updatePaymentMethod(req.user.userId, orderId, data);
      
      // Convert Prisma Decimal to numbers for JSON serialization
      const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
      };

      res.json({ order: serializedOrder });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update payment method',
      });
    }
  }

  async getPromoCodes(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await customerService.getPromoCodes(req.user.userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get promo codes',
      });
    }
  }

  /** Notification counts for profile: orders in progress, unread ticket replies */
  async getNotificationCounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const userId = req.user.userId;
      const [ordersInProgress, unreadTickets] = await Promise.all([
        customerService.getOrdersInProgressCount(userId),
        ticketService.getUnreadTicketsCount(userId),
      ]);
      res.json({ ordersInProgress, unreadTickets });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get notification counts',
      });
    }
  }
}

export const customerController = new CustomerController();
