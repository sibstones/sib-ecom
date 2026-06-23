import { cartService } from '../../services/cart.service';
import { TestHelpers } from '../helpers/test-helpers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('CartService', () => {
  let user: any;
  let category: any;
  let product: any;
  let warehouse: any;

  beforeEach(async () => {
    user = await TestHelpers.createUser({ email: 'cart@example.com' });
    category = await TestHelpers.createCategory({ name: 'Test Category', slug: 'test-category' });
    product = await TestHelpers.createProduct({
      name: 'Test Product',
      slug: 'test-product',
      sku: 'TEST-001',
      price: 100,
      categoryId: category.id,
    });
    warehouse = await TestHelpers.createWarehouse({ name: 'Main Warehouse' });
  });

  describe('addToCart', () => {
    it('should add item to cart for authenticated user', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      const item = await cartService.addToCart(
        product.id,
        2,
        undefined,
        undefined,
        user.id
      );

      expect(item.productId).toBe(product.id);
      expect(item.quantity).toBe(2);
      expect(item.userId).toBe(user.id);
    });

    it('should add item to cart for guest user', async () => {
      const sessionId = 'test-session-123';
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      const item = await cartService.addToCart(
        product.id,
        1,
        undefined,
        undefined,
        undefined,
        sessionId
      );

      expect(item.productId).toBe(product.id);
      expect(item.sessionId).toBe(sessionId);
    });

    it('should increment quantity if item already exists', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);
      const item = await cartService.addToCart(product.id, 3, undefined, undefined, user.id);

      expect(item.quantity).toBe(5);
    });

    it('should reserve inventory when adding to cart', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
        reserved: 0,
      });

      await cartService.addToCart(product.id, 3, undefined, undefined, user.id);

      const inventory = await prisma.inventory.findFirst({
        where: { productId: product.id },
      });

      expect(inventory?.reserved).toBe(3);
      expect(inventory?.quantity).toBe(10);
    });

    it('should handle size parameter correctly', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      const item = await cartService.addToCart(
        product.id,
        1,
        undefined,
        'M',
        user.id
      );

      expect(item.size).toBe('M');
    });
  });

  describe('getCart', () => {
    it('should return cart items for user', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);

      const cart = await cartService.getCart(user.id);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe(product.id);
      expect(cart.items[0].quantity).toBe(2);
    });

    it('should return empty cart for user with no items', async () => {
      const cart = await cartService.getCart(user.id);

      expect(cart.items).toHaveLength(0);
    });

    it('should return cart items for guest session', async () => {
      const sessionId = 'test-session-456';
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 1, undefined, undefined, undefined, sessionId);

      const cart = await cartService.getCart(undefined, sessionId);

      expect(cart.items).toHaveLength(1);
    });
  });

  describe('updateQuantity', () => {
    it('should update item quantity', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      const item = await cartService.addToCart(product.id, 2, undefined, undefined, user.id);
      const updated = await cartService.updateQuantity(item.id, 5);

      expect(updated).not.toBeNull();
      expect(updated!.quantity).toBe(5);
    });

    it('should remove item if quantity is 0', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      const item = await cartService.addToCart(product.id, 2, undefined, undefined, user.id);
      await cartService.updateQuantity(item.id, 0);

      const cart = await cartService.getCart(user.id);
      expect(cart.items).toHaveLength(0);
    });

    it('should update inventory reservation when quantity changes', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
        reserved: 0,
      });

      const item = await cartService.addToCart(product.id, 2, undefined, undefined, user.id);
      
      let inventory = await prisma.inventory.findFirst({
        where: { productId: product.id },
      });
      expect(inventory?.reserved).toBe(2);

      await cartService.updateQuantity(item.id, 5);

      inventory = await prisma.inventory.findFirst({
        where: { productId: product.id },
      });
      expect(inventory?.reserved).toBe(5);
    });
  });

  describe('removeFromCart', () => {
    it('should remove item from cart', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      const item = await cartService.addToCart(product.id, 2, undefined, undefined, user.id);
      await cartService.removeFromCart(item.id);

      const cart = await cartService.getCart(user.id);
      expect(cart.items).toHaveLength(0);
    });

    it('should release inventory reservation when removing item', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
        reserved: 0,
      });

      const item = await cartService.addToCart(product.id, 3, undefined, undefined, user.id);
      
      let inventory = await prisma.inventory.findFirst({
        where: { productId: product.id },
      });
      expect(inventory?.reserved).toBe(3);

      await cartService.removeFromCart(item.id);

      inventory = await prisma.inventory.findFirst({
        where: { productId: product.id },
      });
      expect(inventory?.reserved).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from user cart', async () => {
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 2, undefined, undefined, user.id);
      await cartService.clearCart(user.id);

      const cart = await cartService.getCart(user.id);
      expect(cart.items).toHaveLength(0);
    });

    it('should clear all items from guest session cart', async () => {
      const sessionId = 'test-session-789';
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 10,
      });

      await cartService.addToCart(product.id, 1, undefined, undefined, undefined, sessionId);
      await cartService.clearCart(undefined, sessionId);

      const cart = await cartService.getCart(undefined, sessionId);
      expect(cart.items).toHaveLength(0);
    });
  });
});
