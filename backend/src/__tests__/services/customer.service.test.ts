jest.mock('otplib', () => ({
  verifySync: jest.fn(),
}));

import { customerService } from '../../services/customer.service';
import { cartService } from '../../services/cart.service';
import { TestHelpers } from '../helpers/test-helpers';
import prisma from '../../config/database';
import { verifyGuestCheckoutPaymentToken } from '../../utils/guest-checkout-token';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';

describe('CustomerService', () => {
  let user: any;
  let category: any;
  let product: any;
  let address: any;
  let warehouse: any;

  beforeEach(async () => {
    user = await TestHelpers.createUser({ email: 'customer@example.com' });
    category = await TestHelpers.createCategory({ name: 'Test Category', slug: 'test-category' });
    product = await TestHelpers.createProduct({
      name: 'Test Product',
      slug: 'test-product',
      sku: 'TEST-001',
      price: 100,
      categoryId: category.id,
    });
    address = await TestHelpers.createAddress({
      userId: user.id,
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St',
      city: 'New York',
      country: 'US',
      postalCode: '10001',
    });
    warehouse = await TestHelpers.createWarehouse({ name: 'Main Warehouse' });
  });

  describe('createOrder', () => {
    it('should create order from cart items', async () => {
      // Setup inventory
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      // Add items to cart
      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      const order = await customerService.createOrder(user.id, orderData);

      expect(order.checkoutCurrency).toBe('USD');
      expect(order.orderNumber).toBeDefined();
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].productId).toBe(product.id);
      expect(order.items[0].quantity).toBe(2);
    });

    it('should calculate totals correctly', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      const order = await customerService.createOrder(user.id, orderData);

      // Subtotal: 2 * 100 = 200
      // Tax: 200 * 0.08 = 16
      // Shipping: 0 (subtotal > 100)
      // Total: 200 + 16 = 216
      expect(Number(order.subtotal)).toBe(200);
      expect(Number(order.tax)).toBe(16);
      expect(Number(order.shipping)).toBe(0);
      expect(Number(order.total)).toBe(216);
    });

    it('should apply zero tax when country tax rate is 0', async () => {
      await prisma.country.updateMany({
        where: { code: 'RU' },
        data: { taxRate: 0 },
      });

      const ruAddress = await TestHelpers.createAddress({
        userId: user.id,
        firstName: 'Ivan',
        lastName: 'Ivanov',
        address: 'Red Square 1',
        city: 'Moscow',
        country: 'RU',
        postalCode: '101000',
      });

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const order = await customerService.createOrder(user.id, {
        shippingAddressId: ruAddress.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'RUB',
        countryCode: 'RU',
      });

      expect(Number(order.subtotal)).toBe(200);
      expect(Number(order.tax)).toBe(0);
    });

    it('should apply promo code discount', async () => {
      const promoCode = await TestHelpers.createPromoCode({
        code: 'DISCOUNT10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: new Date(Date.now() - 1000 * 60 * 60),
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
        promoCode: promoCode.code,
      };

      const order = await customerService.createOrder(user.id, orderData);

      // Subtotal: 200
      // Discount: 200 * 0.1 = 20
      // Subtotal after discount: 180
      // Tax: 180 * 0.08 = 14.4
      // Shipping: 0
      // Total: 194.4
      expect(Number(order.subtotal)).toBe(180);
      expect(Number(order.total)).toBe(194.4);
      expect(order.promoCodeId).toBe(promoCode.id);
    });

    it('should clear cart after order creation', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      await customerService.createOrder(user.id, orderData);

      const cart = await cartService.getCart(user.id);
      expect(cart.items).toHaveLength(0);
    });

    it('should award loyalty points after order', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      await customerService.createOrder(user.id, orderData);

      const { loyaltyService } = await import('../../services/loyalty.service');
      const points = await loyaltyService.getPoints(user.id);

      // Should have earned points based on order total
      expect(points.balance).toBeGreaterThan(0);
    });

    it('should throw error if cart is empty', async () => {
      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      await expect(
        customerService.createOrder(user.id, orderData)
      ).rejects.toThrow('Cart is empty');
    });

    it('should throw error if shipping address not found', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: 'non-existent-id',
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      await expect(
        customerService.createOrder(user.id, orderData)
      ).rejects.toThrow('Shipping address not found');
    });

    it('should handle items with price on request', async () => {
      const priceOnRequestProduct = await TestHelpers.createProduct({
        name: 'Price on Request Product',
        slug: 'price-on-request',
        sku: 'POR-001',
        price: 0,
        categoryId: category.id,
        priceOnRequest: true,
      });

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: priceOnRequestProduct.id,
        quantity: 10,
      });

      await cartService.addToCart(priceOnRequestProduct.id, 1, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      const createdOrder = await customerService.createOrder(user.id, orderData);

      // Price-on-request line is excluded from subtotal but shipping still applies
      expect(Number(createdOrder.subtotal)).toBe(0);
      expect(Number(createdOrder.total)).toBe(10);
      expect(createdOrder.items[0].price).toBeNull();
    });

    it('should keep priced items in totals when cart also has price on request items', async () => {
      const priceOnRequestProduct = await TestHelpers.createProduct({
        name: 'Mixed Price on Request Product',
        slug: 'mixed-price-on-request',
        sku: 'POR-002',
        price: 0,
        categoryId: category.id,
        priceOnRequest: true,
      });

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: priceOnRequestProduct.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);
      await cartService.addToCart(priceOnRequestProduct.id, 1, undefined, undefined, user.id);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      const createdOrder = await customerService.createOrder(user.id, orderData);
      const pricedItem = createdOrder.items.find((item) => item.productId === product.id);
      const porItem = createdOrder.items.find((item) => item.productId === priceOnRequestProduct.id);

      expect(Number(createdOrder.subtotal)).toBe(200);
      expect(Number(createdOrder.tax)).toBe(16);
      expect(Number(createdOrder.shipping)).toBe(0);
      expect(Number(createdOrder.total)).toBe(216);
      expect(pricedItem?.price ? Number(pricedItem.price) : null).toBe(100);
      expect(porItem?.price).toBeNull();
    });

    it('should migrate session cart items to user cart', async () => {
      const sessionId = 'test-session-123';
      
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 1, undefined, undefined, undefined, sessionId);

      const orderData = {
        shippingAddressId: address.id,
        paymentMethod: 'GATEWAY' as const,
        currency: 'USD',
        countryCode: 'US',
      };

      const order = await customerService.createOrder(user.id, orderData, sessionId);

      expect(order.items).toHaveLength(1);
      
      // Session cart should be migrated
      const sessionCart = await cartService.getCart(undefined, sessionId);
      expect(sessionCart.items).toHaveLength(0);
    });

    it('should return order with populated display fields for account screens', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 1, undefined, undefined, user.id);

      const createdOrder = await customerService.createOrder(user.id, {
        shippingAddressId: address.id,
        paymentMethod: 'BANK_TRANSFER',
        currency: 'USD',
        countryCode: 'US',
        notes: 'Leave at front desk',
      });

      const shippedAt = new Date('2026-06-18T10:00:00.000Z');
      await prisma.order.update({
        where: { id: createdOrder.id },
        data: {
          status: OrderStatus.SHIPPED,
          paymentStatus: PaymentStatus.PAID,
          notes: 'Leave at front desk',
          invoiceNumber: 'INV-2026-0001',
          invoiceDate: new Date('2026-06-17T10:00:00.000Z'),
          shippedAt,
          deliveryMethod: 'COURIER',
          carrierName: 'DHL',
          waybillNumber: 'WB-123456',
          waybillDate: new Date('2026-06-18T09:00:00.000Z'),
          trackingNumber: 'TRACK-123456',
          customsDeclarationNumber: 'CD-987654',
        },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId: createdOrder.id,
          status: OrderStatus.SHIPPED,
          notes: 'Packed and handed to courier',
        },
      });

      const order = await customerService.getOrder(user.id, createdOrder.id);

      expect(order).toBeTruthy();
      expect(order?.notes).toBe('Leave at front desk');
      expect(order?.invoiceNumber).toBe('INV-2026-0001');
      expect(order?.deliveryMethod).toBe('COURIER');
      expect(order?.carrierName).toBe('DHL');
      expect(order?.trackingNumber).toBe('TRACK-123456');
      expect(order?.customsDeclarationNumber).toBe('CD-987654');
      expect(order?.shippingAddress?.city).toBe('New York');
      expect(order?.statusHistory.length).toBeGreaterThan(0);
      expect(order?.items[0].product.slug).toBe('test-product');
      expect(order?.shippedAt?.toISOString()).toBe(shippedAt.toISOString());
    });
  });

  describe('createGuestOrder', () => {
    it('creates order, returns guestPaymentToken for session cart, and clears session cart', async () => {
      const sessionId = `guest-session-${Date.now()}`;
      const email = `guest-${Date.now()}@example.com`;

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 1, undefined, undefined, undefined, sessionId);

      const { order, guestPaymentToken } = await customerService.createGuestOrder(
        {
          email,
          firstName: 'Guest',
          lastName: 'User',
          address: '1 Guest St',
          city: 'NYC',
          country: 'United States',
          postalCode: '10001',
          paymentMethod: 'GATEWAY',
          currency: 'USD',
          countryCode: 'US',
        },
        sessionId
      );

      expect(order.id).toBeDefined();
      expect(order.paymentMethod).toBe('BANK_TRANSFER');
      expect(guestPaymentToken).toBeTruthy();
      const payload = verifyGuestCheckoutPaymentToken(guestPaymentToken);
      expect(payload?.orderId).toBe(order.id);
      expect(payload?.email).toBe(email);

      const sessionCart = await cartService.getCart(undefined, sessionId);
      expect(sessionCart.items).toHaveLength(0);
    });

    it('rejects when email belongs to an account that already has a password', async () => {
      const sessionId = `guest-session-pw-${Date.now()}`;

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 1, undefined, undefined, undefined, sessionId);

      await expect(
        customerService.createGuestOrder(
          {
            email: user.email,
            firstName: 'X',
            lastName: 'Y',
            address: '1 St',
            city: 'NYC',
            country: 'US',
            paymentMethod: 'BANK_TRANSFER',
            currency: 'USD',
            countryCode: 'US',
          },
          sessionId
        )
      ).rejects.toThrow(/sign in/i);
    });

    it('allows checkout for existing passwordless user with same email', async () => {
      const sessionId = `guest-session-pl-${Date.now()}`;
      const email = `passwordless-${Date.now()}@example.com`;

      await prisma.user.create({
        data: {
          email,
          passwordHash: null,
          firstName: 'Pl',
          lastName: 'User',
          role: UserRole.CUSTOMER,
          emailVerified: false,
        },
      });

      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 1, undefined, undefined, undefined, sessionId);

      const { order, guestPaymentToken } = await customerService.createGuestOrder(
        {
          email,
          firstName: 'Pl',
          lastName: 'User',
          phone: '+10000000000',
          address: '2 St',
          city: 'LA',
          country: 'United States',
          paymentMethod: 'BANK_TRANSFER',
          currency: 'USD',
          countryCode: 'US',
        },
        sessionId
      );

      expect(order.userId).toBeDefined();
      expect(guestPaymentToken).toBeTruthy();
      const u = await prisma.user.findUnique({ where: { email } });
      expect(u?.phone).toBe('+10000000000');
    });
  });
});
