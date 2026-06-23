jest.mock('otplib', () => ({
  verifySync: jest.fn(),
}));

import { OrderStatus, PaymentStatus } from '@prisma/client';
import prisma from '../../config/database';
import { cartService } from '../../services/cart.service';
import { customerService } from '../../services/customer.service';
import { returnService } from '../../services/return.service';
import { TestHelpers } from '../helpers/test-helpers';

describe('ReturnService', () => {
  let user: any;
  let otherUser: any;
  let category: any;
  let product: any;
  let address: any;
  let warehouse: any;

  beforeEach(async () => {
    user = await TestHelpers.createUser({ email: 'returns-customer@example.com' });
    otherUser = await TestHelpers.createUser({ email: 'returns-other@example.com' });
    category = await TestHelpers.createCategory({ name: 'Returns Category', slug: 'returns-category' });
    product = await TestHelpers.createProduct({
      name: 'Returns Product',
      slug: 'returns-product',
      sku: 'RET-001',
      price: 120,
      categoryId: category.id,
    });
    address = await TestHelpers.createAddress({
      userId: user.id,
      firstName: 'Jane',
      lastName: 'Returner',
      address: '45 Return St',
      city: 'Chicago',
      country: 'US',
      postalCode: '60601',
    });
    warehouse = await TestHelpers.createWarehouse({ name: 'Returns Warehouse' });
  });

  async function createEligibleOrder(ownerId: string, shippingAddressId: string) {
    const existingInventory = await prisma.inventory.findFirst({
      where: {
        warehouseId: warehouse.id,
        productId: product.id,
        variantId: null,
      },
    });

    if (!existingInventory) {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });
    }

    await cartService.addToCart(product.id, 2, undefined, undefined, ownerId);

    const order = await customerService.createOrder(ownerId, {
      shippingAddressId,
      paymentMethod: 'BANK_TRANSFER',
      currency: 'USD',
      countryCode: 'US',
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    return prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
  }

  describe('createReturnRequest', () => {
    it('should create a return request for an order and update the order status', async () => {
      const order = await createEligibleOrder(user.id, address.id);

      const returnRequest = await returnService.createReturnRequest(user.id, {
        orderId: order.id,
        reason: 'CUSTOMER_REQUESTED',
        customerNotes: 'Need a different fit',
        items: [
          {
            orderItemId: order.items[0].id,
            quantity: 1,
            itemStatus: 'RETURN_TO_SALE',
            warehouseId: warehouse.id,
          },
        ],
      });

      expect(returnRequest.orderId).toBe(order.id);
      expect(returnRequest.userId).toBe(user.id);
      expect(returnRequest.reason).toBe('CUSTOMER_REQUESTED');
      expect(returnRequest.items).toHaveLength(1);
      expect(returnRequest.items[0].quantity).toBe(1);
      expect(returnRequest.items[0].itemStatus).toBe('RETURN_TO_SALE');
      expect(returnRequest.items[0].orderItem.product.slug).toBe('returns-product');

      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          statusHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      expect(updatedOrder?.status).toBe(OrderStatus.RETURN_REQUESTED);
      expect(updatedOrder?.statusHistory[0]?.status).toBe(OrderStatus.RETURN_REQUESTED);
    });
  });

  describe('getAllReturnRequests', () => {
    it('should return return requests filtered by user and order with nested order item data', async () => {
      const userOrder = await createEligibleOrder(user.id, address.id);

      const otherAddress = await TestHelpers.createAddress({
        userId: otherUser.id,
        firstName: 'Other',
        lastName: 'Customer',
        address: '78 Side St',
        city: 'Boston',
        country: 'US',
        postalCode: '02108',
      });
      const otherOrder = await createEligibleOrder(otherUser.id, otherAddress.id);

      const userReturn = await returnService.createReturnRequest(user.id, {
        orderId: userOrder.id,
        reason: 'CUSTOMER_REQUESTED',
        customerNotes: 'Need to exchange this item',
        items: [
          {
            orderItemId: userOrder.items[0].id,
            quantity: 1,
            itemStatus: 'WRITE_OFF',
          },
        ],
      });

      await returnService.createReturnRequest(otherUser.id, {
        orderId: otherOrder.id,
        reason: 'CUSTOMER_REQUESTED',
        items: [
          {
            orderItemId: otherOrder.items[0].id,
            quantity: 1,
            itemStatus: 'WRITE_OFF',
          },
        ],
      });

      const result = await returnService.getAllReturnRequests({
        userId: user.id,
        orderId: userOrder.id,
      });

      expect(result.returnRequests).toHaveLength(1);
      expect(result.returnRequests[0].id).toBe(userReturn.id);
      expect(result.returnRequests[0].order.id).toBe(userOrder.id);
      expect(result.returnRequests[0].order.user.email).toBe(user.email);
      expect(result.returnRequests[0].items[0].orderItem.product.slug).toBe('returns-product');
      expect(result.returnRequests[0].items[0].orderItem.quantity).toBe(2);
      expect(result.pagination.total).toBe(1);
    });
  });
});
