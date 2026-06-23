import prisma from '../config/database';
import { InventoryStatus } from '@prisma/client';
import { settingsService } from './settings.service';
import { productService } from './product.service';

export const MAX_CART_RESERVATION_MS = 5 * 60 * 1000;

export class CartService {
  private getReservationWindowMs(
    settings: Awaited<ReturnType<typeof settingsService.getAllSettings>>,
    isRegisteredUser: boolean
  ): number {
    const configuredMs = isRegisteredUser
      ? (settings.cartReservationRegisteredHours ?? 1) * 60 * 60 * 1000
      : (settings.cartReservationGuestMinutes ?? 30) * 60 * 1000;

    return Math.min(configuredMs, MAX_CART_RESERVATION_MS);
  }

  // Reserve inventory when adding to cart
  private async reserveInventory(
    productId: string,
    variantId: string | null | undefined,
    size: string | null | undefined,
    quantity: number
  ): Promise<void> {
    try {
      // Find variant by size if variantId not provided
      let targetVariantId = variantId || null;
      
      if (!targetVariantId && size) {
        const sizeValue = size.includes(':') ? size.split(':')[1] : size;
        const variant = await prisma.productVariant.findFirst({
          where: {
            productId,
            OR: [
              { size: sizeValue },
              { name: { contains: `Size: ${sizeValue}`, mode: 'insensitive' } },
              { name: { contains: sizeValue, mode: 'insensitive' } },
            ],
          },
        });
        if (variant) {
          targetVariantId = variant.id;
        }
      }

      // Find inventory across all warehouses
      const inventories = await prisma.inventory.findMany({
        where: {
          productId,
          variantId: targetVariantId || null,
          status: InventoryStatus.IN_SALE,
          quantity: { gt: 0 },
        },
        orderBy: { quantity: 'desc' },
      });

      let remainingQuantity = quantity;
      
      for (const inventory of inventories) {
        if (remainingQuantity <= 0) break;
        
        // Calculate available quantity (total - reserved)
        const available = inventory.quantity - inventory.reserved;
        if (available <= 0) continue;
        
        const toReserve = Math.min(remainingQuantity, available);
        
        await prisma.inventory.update({
          where: { id: inventory.id },
          data: {
            reserved: { increment: toReserve },
          },
        });
        
        remainingQuantity -= toReserve;
      }

      if (remainingQuantity > 0) {
        console.warn(`Could not reserve full quantity. Requested: ${quantity}, Reserved: ${quantity - remainingQuantity}`);
      }
    } catch (error) {
      console.error('Error reserving inventory:', error);
      // Don't throw - allow cart addition even if reservation fails
    }
  }

  /**
   * Release inventory reservation for order items (e.g. when order is cancelled).
   * Call this when an order is cancelled to return reserved stock to available.
   */
  async releaseReservationForOrderItems(
    items: Array<{ productId: string; variantId?: string | null; size?: string | null; quantity: number }>
  ): Promise<void> {
    for (const item of items) {
      await this.releaseInventoryReservation(
        item.productId,
        item.variantId ?? null,
        item.size ?? null,
        item.quantity
      );
    }
  }

  // Release inventory reservation
  private async releaseInventoryReservation(
    productId: string,
    variantId: string | null | undefined,
    size: string | null | undefined,
    quantity: number
  ): Promise<void> {
    try {
      let targetVariantId = variantId || null;
      
      if (!targetVariantId && size) {
        const sizeValue = size.includes(':') ? size.split(':')[1] : size;
        const variant = await prisma.productVariant.findFirst({
          where: {
            productId,
            OR: [
              { size: sizeValue },
              { name: { contains: `Size: ${sizeValue}`, mode: 'insensitive' } },
              { name: { contains: sizeValue, mode: 'insensitive' } },
            ],
          },
        });
        if (variant) {
          targetVariantId = variant.id;
        }
      }

      const inventories = await prisma.inventory.findMany({
        where: {
          productId,
          variantId: targetVariantId || null,
          reserved: { gt: 0 },
        },
        orderBy: { reserved: 'desc' },
      });

      let remainingQuantity = quantity;
      
      for (const inventory of inventories) {
        if (remainingQuantity <= 0) break;
        
        const toRelease = Math.min(remainingQuantity, inventory.reserved);
        
        await prisma.inventory.update({
          where: { id: inventory.id },
          data: {
            reserved: { decrement: toRelease },
          },
        });
        
        remainingQuantity -= toRelease;
      }
    } catch (error) {
      console.error('Error releasing inventory reservation:', error);
    }
  }
  async getCart(userId?: string, sessionId?: string) {
    const where: { userId?: string; sessionId?: string } = {};
    
    if (userId) {
      where.userId = userId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    } else {
      return { items: [] };
    }

    const items = await prisma.cartItem.findMany({
      where,
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { order: 'asc' },
            },
          },
        },
        variant: true,
      },
    });

    // Reservation TTL: use configured value, but never let it exceed 5 minutes.
    const settings = await settingsService.getAllSettings();
    const reservationMs = this.getReservationWindowMs(settings, !!userId);
    const cutoff = new Date(Date.now() - reservationMs);
    const oldItems = items.filter(item => item.createdAt < cutoff);

    for (const item of oldItems) {
      await this.releaseInventoryReservation(
        item.productId,
        item.variantId,
        item.size,
        item.quantity
      );
    }

    if (oldItems.length > 0) {
      await prisma.cartItem.deleteMany({
        where: {
          id: { in: oldItems.map(i => i.id) },
        },
      });
    }

    const validItems = items.filter(item => item.createdAt >= cutoff);

    // Debug: log items to check if size is present
    console.log('Cart items from DB:', validItems.map(item => ({
      id: item.id,
      productId: item.productId,
      size: item.size,
      hasSize: !!item.size
    })));

    return { items: validItems };
  }

  /**
   * Release expired cart reservations for ALL users (background job).
   * Called periodically - reservations are only released on getCart otherwise,
   * so items stay reserved forever if user never opens cart again.
   */
  async releaseExpiredCartReservations(): Promise<{ deleted: number }> {
    const settings = await settingsService.getAllSettings();
    const guestCutoff = new Date(Date.now() - this.getReservationWindowMs(settings, false));
    const registeredCutoff = new Date(Date.now() - this.getReservationWindowMs(settings, true));

    const expiredItems = await prisma.cartItem.findMany({
      where: {
        OR: [
          { userId: { not: null }, createdAt: { lt: registeredCutoff } },
          { sessionId: { not: null }, createdAt: { lt: guestCutoff } },
        ],
      },
      select: { id: true, productId: true, variantId: true, size: true, quantity: true },
    });

    for (const item of expiredItems) {
      await this.releaseInventoryReservation(
        item.productId,
        item.variantId,
        item.size,
        item.quantity
      );
    }

    if (expiredItems.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { id: { in: expiredItems.map((i) => i.id) } },
      });
      console.log(`[Cart] Released ${expiredItems.length} expired cart reservation(s)`);
    }

    return { deleted: expiredItems.length };
  }

  async addToCart(
    productId: string,
    quantity: number = 1,
    variantId?: string,
    size?: string,
    userId?: string,
    sessionId?: string
  ) {
    const settings = await settingsService.getAllSettings();
    const maxPerProduct = Math.max(1, settings.cartMaxQuantityPerProduct ?? 3);
    quantity = Math.min(Math.max(1, quantity), maxPerProduct);

    if (await productService.isComingSoon(productId, size || null)) {
      throw new Error('Product is coming soon');
    }

    // CRITICAL: Log size parameter immediately
    console.log('=== CART SERVICE - FUNCTION CALL ===');
    console.log('Size parameter received:', size);
    console.log('Size parameter type:', typeof size);
    console.log('Size parameter value:', JSON.stringify(size));
    console.log('Size parameter is undefined:', size === undefined);
    console.log('Size parameter is null:', size === null);
    console.log('Size parameter is string:', typeof size === 'string');
    if (typeof size === 'string') {
      console.log('Size parameter length:', size.length);
      console.log('Size parameter trimmed:', size.trim());
    }
    console.log('CartService.addToCart - called with:', {
      productId,
      quantity,
      variantId,
      size,
      sizeType: typeof size,
      sizeValue: size,
      sizeIsString: typeof size === 'string',
      sizeTrimmed: size && typeof size === 'string' ? size.trim() : null,
      userId: userId || 'guest',
      sessionId: sessionId || 'none'
    });
    
    // Validate size parameter
    if (size !== undefined && size !== null && typeof size !== 'string') {
      console.warn('Size is not a string:', { size, sizeType: typeof size });
    }
    // First, try to find existing item with exact match (productId, variantId, size, userId/sessionId)
    const where: { userId?: string; sessionId?: string; productId: string; variantId?: string | null; size?: string | null } = {
      productId,
    };

    if (userId) {
      where.userId = userId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    } else {
      throw new Error('User ID or session ID required');
    }

    if (variantId) {
      where.variantId = variantId;
    } else {
      where.variantId = null;
    }

    // Always include size in the search - if size is provided, search for exact match
    // If size is not provided, search for items without size
    if (size && typeof size === 'string' && size.trim() !== '') {
      where.size = size.trim();
    } else {
      where.size = null;
    }

    console.log('Searching for existing cart item with where:', where);

    let existing = await prisma.cartItem.findFirst({ where });
    
    console.log('Found existing item:', existing ? {
      id: existing.id,
      size: existing.size,
      quantity: existing.quantity
    } : 'none');

    // If we're adding with a size but didn't find an item with that size,
    // check if there's an item without size (for the same product/variant/user)
    if (!existing && size && typeof size === 'string' && size.trim() !== '') {
      const whereWithoutSize: any = {
        productId,
        size: { equals: null },
      };
      
      if (userId) {
        whereWithoutSize.userId = userId;
      } else if (sessionId) {
        whereWithoutSize.sessionId = sessionId;
      }
      
      if (variantId) {
        whereWithoutSize.variantId = variantId;
      } else {
        whereWithoutSize.variantId = null;
      }
      
      console.log('Searching for item without size:', whereWithoutSize);
      existing = await prisma.cartItem.findFirst({ where: whereWithoutSize });
      
      console.log('Found item without size:', existing ? {
        id: existing.id,
        size: existing.size,
        quantity: existing.quantity
      } : 'none');
    }

    if (existing) {
      // Cap total quantity per product at maxPerProduct
      const newTotal = existing.quantity + quantity;
      const finalQuantity = Math.min(newTotal, maxPerProduct);
      const updateData: { quantity: number; size: string | null } = {
        quantity: finalQuantity,
        size: null, // Default is null
      };
      
      // ALWAYS UPDATE SIZE if provided - FORCE IT
      console.log('=== UPDATING SIZE ===');
      console.log('Size parameter:', size, 'Type:', typeof size);
      
      if (size !== undefined && size !== null && typeof size === 'string') {
        const trimmed = size.trim();
        if (trimmed.length > 0) {
          updateData.size = trimmed;
          console.log('✓ Size updated to:', updateData.size);
        } else {
          updateData.size = null;
          console.log('✗ Size is empty string after trim');
        }
      } else {
        updateData.size = null;
        console.log('✗ Size is undefined/null or not string, setting to null');
        console.log('  - size:', size, 'Type:', typeof size);
      }
      
      console.log('Update data:', JSON.stringify(updateData, null, 2));
      console.log('updateData.size exists:', 'size' in updateData);
      console.log('updateData.size value:', updateData.size);
      console.log('updateData.size type:', typeof updateData.size);
      
      console.log('Updating existing cart item:', {
        id: existing.id,
        currentSize: existing.size,
        newSize: size,
        updateData,
        updateDataSize: updateData.size
      });
      
      const updated = await prisma.cartItem.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          product: {
            include: {
              images: {
                take: 1,
                orderBy: { order: 'asc' },
              },
            },
          },
          variant: true,
        },
      });
      
      console.log('Updated cart item:', {
        id: updated.id,
        size: updated.size,
        sizeType: typeof updated.size,
        quantity: updated.quantity,
        fullItem: JSON.stringify(updated, null, 2)
      });
      
      // Reserve or release inventory for the quantity delta
      const quantityDiff = updated.quantity - existing.quantity;
      if (quantityDiff > 0) {
        await this.reserveInventory(productId, variantId, size, quantityDiff);
      } else if (quantityDiff < 0) {
        await this.releaseInventoryReservation(productId, variantId, size, Math.abs(quantityDiff));
      }
      
      // Verify size was saved
      const verifyItem = await prisma.cartItem.findUnique({
        where: { id: updated.id },
        select: { id: true, size: true, quantity: true }
      });
      console.log('Verified item from DB:', verifyItem);
      
      return updated;
    }

    // Debug: log what we're creating
    console.log('Creating cart item:', {
      productId,
      variantId,
      size,
      sizeType: typeof size,
      quantity,
      userId: userId || 'guest',
      sessionId: sessionId || 'none'
    });

    // New item: quantity already capped at maxPerProduct above
    const data: any = {
      productId,
      quantity,
    };

    if (userId) {
      data.userId = userId;
    } else if (sessionId) {
      data.sessionId = sessionId;
    }

    if (variantId) {
      data.variantId = variantId;
    }

    // ALWAYS SET SIZE - FORCE IT
    console.log('=== SETTING SIZE ===');
    console.log('Size parameter:', size, 'Type:', typeof size, 'Value:', JSON.stringify(size));
    
    // FORCE SET SIZE - always set, even if null
    if (size !== undefined && size !== null && typeof size === 'string' && size.trim().length > 0) {
      data.size = size.trim();
      console.log('✓ Size SET to:', data.size);
    } else {
      // Explicitly set null if not provided
      data.size = null;
      console.log('✗ Size NOT SET, using null. Size value:', size, 'Type:', typeof size);
    }
    
    // CHECK: ensure size is in data
    console.log('Final data object BEFORE Prisma:', JSON.stringify(data, null, 2));
    console.log('Final data.size BEFORE Prisma:', data.size);
    console.log('data.size exists:', 'size' in data);
    console.log('data keys:', Object.keys(data));

    console.log('=== CALLING PRISMA CREATE ===');
    console.log('Data being passed to Prisma:', JSON.stringify(data, null, 2));
    console.log('data.size value:', data.size);
    console.log('data.size type:', typeof data.size);
    console.log('data has size property:', 'size' in data);
    console.log('data object keys:', Object.keys(data));
    
    // CHECK: create data object again with EXPLICIT size
    // IMPORTANT: use original size parameter directly, not data.size
    const prismaData: {
      productId: string;
      quantity: number;
      userId?: string;
      sessionId?: string;
      variantId?: string;
      size: string | null;
    } = {
      productId: data.productId,
      quantity: data.quantity,
      size: null, // Default is null
    };
    
    if (data.userId) prismaData.userId = data.userId;
    if (data.sessionId) prismaData.sessionId = data.sessionId;
    if (data.variantId) prismaData.variantId = data.variantId;
    
    // CRITICAL: ALWAYS set size from original parameter
    // Check the original size parameter directly
    if (size !== undefined && size !== null && typeof size === 'string') {
      const trimmedSize = size.trim();
      if (trimmedSize.length > 0) {
        prismaData.size = trimmedSize;
        console.log('✓ PrismaData.size SET from parameter:', prismaData.size);
      } else {
        prismaData.size = null;
        console.log('✗ Size is empty string after trim');
      }
    } else {
      prismaData.size = null;
      console.log('✗ Size parameter is undefined/null or not string');
      console.log('  - size:', size, 'Type:', typeof size);
    }
    
    console.log('=== FINAL SIZE ASSIGNMENT ===');
    console.log('Original size parameter:', size, 'Type:', typeof size);
    console.log('data.size:', data.size, 'Type:', typeof data.size);
    console.log('prismaData.size:', prismaData.size, 'Type:', typeof prismaData.size);
    console.log('prismaData object:', JSON.stringify(prismaData, null, 2));
    
    console.log('=== PRISMA DATA OBJECT ===');
    console.log('Prisma data:', JSON.stringify(prismaData, null, 2));
    console.log('Prisma data.size:', prismaData.size);
    console.log('Prisma data.size type:', typeof prismaData.size);
    console.log('Prisma data keys:', Object.keys(prismaData));
    console.log('Prisma data has size:', 'size' in prismaData);
    
    // FINAL CHECK: make sure size is in prismaData before creating
    console.log('=== FINAL CHECK BEFORE PRISMA CREATE ===');
    console.log('prismaData object:', JSON.stringify(prismaData, null, 2));
    console.log('prismaData.size:', prismaData.size);
    console.log('prismaData.size type:', typeof prismaData.size);
    console.log('prismaData has size key:', 'size' in prismaData);
    console.log('prismaData keys:', Object.keys(prismaData));
    
    // CRITICAL: Create object for Prisma with EXPLICIT size
    const prismaCreateData = {
      productId: prismaData.productId,
      quantity: prismaData.quantity,
      size: prismaData.size, // EXPLICITLY set size
      ...(prismaData.userId && { userId: prismaData.userId }),
      ...(prismaData.sessionId && { sessionId: prismaData.sessionId }),
      ...(prismaData.variantId && { variantId: prismaData.variantId }),
    };
    
    console.log('=== PRISMA CREATE DATA (EXPLICIT) ===');
    console.log('prismaCreateData:', JSON.stringify(prismaCreateData, null, 2));
    console.log('prismaCreateData.size:', prismaCreateData.size);
    console.log('prismaCreateData.size type:', typeof prismaCreateData.size);
    console.log('prismaCreateData has size:', 'size' in prismaCreateData);
    
    const created = await prisma.cartItem.create({
      data: prismaCreateData,
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { order: 'asc' },
            },
          },
        },
        variant: true,
      },
    });
    
    console.log('=== PRISMA CREATE RESULT ===');
    console.log('Created cart item size:', created.size);
    console.log('Created cart item size type:', typeof created.size);
    console.log('Full created item:', JSON.stringify(created, null, 2));
    
    // Verify size was saved
    const verifyItem = await prisma.cartItem.findUnique({
      where: { id: created.id },
      select: { id: true, size: true, quantity: true }
    });
    console.log('=== VERIFICATION FROM DB ===');
    console.log('Verified item size:', verifyItem?.size);
    console.log('Full verified item:', verifyItem);
    
    // If size was not saved, but should have been - throw error
    if (size && size.trim().length > 0 && !created.size) {
      console.error('ERROR: Size was provided but not saved!', {
        providedSize: size,
        savedSize: created.size,
        prismaDataSize: prismaData.size
      });
    }
    
    // Reserve inventory for the new cart item
    await this.reserveInventory(productId, variantId, size, quantity);
    
    return created;
  }

  async updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      await this.removeFromCart(itemId);
      return null;
    }

    const settings = await settingsService.getAllSettings();
    const maxPerProduct = Math.max(1, settings.cartMaxQuantityPerProduct ?? 3);
    quantity = Math.min(quantity, maxPerProduct);

    // Get current item to calculate quantity difference
    const currentItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      select: { productId: true, variantId: true, size: true, quantity: true },
    });

    if (!currentItem) {
      throw new Error('Cart item not found');
    }

    const updated = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { order: 'asc' },
            },
          },
        },
        variant: true,
      },
    });

    // Update inventory reservation
    const quantityDiff = quantity - currentItem.quantity;
    if (quantityDiff > 0) {
      await this.reserveInventory(
        currentItem.productId,
        currentItem.variantId,
        currentItem.size,
        quantityDiff
      );
    } else if (quantityDiff < 0) {
      await this.releaseInventoryReservation(
        currentItem.productId,
        currentItem.variantId,
        currentItem.size,
        Math.abs(quantityDiff)
      );
    }

    return updated;
  }

  async removeFromCart(itemId: string) {
    // Get item before deletion to release reservation
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      select: { productId: true, variantId: true, size: true, quantity: true },
    });
    
    if (item) {
      // Release inventory reservation
      await this.releaseInventoryReservation(
        item.productId,
        item.variantId,
        item.size,
        item.quantity
      );
    }
    
    return prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  async clearCart(userId?: string, sessionId?: string) {
    const where: { userId?: string; sessionId?: string } = {};
    
    if (userId) {
      where.userId = userId;
    } else if (sessionId) {
      where.sessionId = sessionId;
    } else {
      return;
    }

    const items = await prisma.cartItem.findMany({
      where,
      select: { productId: true, variantId: true, size: true, quantity: true },
    });
    for (const item of items) {
      await this.releaseInventoryReservation(
        item.productId,
        item.variantId,
        item.size,
        item.quantity
      );
    }
    return prisma.cartItem.deleteMany({ where });
  }
}

export const cartService = new CartService();
