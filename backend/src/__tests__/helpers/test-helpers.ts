import { InventoryStatus, PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../../utils/hash';

const prisma = new PrismaClient();

export class TestHelpers {
  static async createUser(data: {
    email: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    isActive?: boolean;
    isPartner?: boolean;
    partnerStatus?: string | null;
  }) {
    const passwordHash = data.password ? await hashPassword(data.password) : await hashPassword('testpassword123');
    
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || UserRole.CUSTOMER,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isPartner: data.isPartner ?? false,
        partnerStatus: data.partnerStatus ?? null,
      },
    });
  }

  static async createCategory(data: { name: string; slug: string; parentId?: string; isMain?: boolean }) {
    return prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId,
        isMain: data.isMain || false,
      },
    });
  }

  static async createBrand(data: { name: string; slug: string }) {
    return prisma.brand.create({
      data: {
        name: data.name,
        slug: data.slug,
      },
    });
  }

  static async createProduct(data: {
    name: string;
    slug: string;
    sku: string;
    price: number;
    categoryId: string;
    brandId?: string;
    isActive?: boolean;
    priceOnRequest?: boolean;
  }) {
    return prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        sku: data.sku,
        price: data.price,
        categoryId: data.categoryId,
        brandId: data.brandId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        priceOnRequest: data.priceOnRequest || false,
      },
    });
  }

  static async createInventory(data: {
    warehouseId: string;
    productId: string;
    variantId?: string;
    quantity: number;
    reserved?: number;
    status?: InventoryStatus;
  }) {
    return prisma.inventory.create({
      data: {
        warehouseId: data.warehouseId,
        productId: data.productId,
        variantId: data.variantId,
        quantity: data.quantity,
        reserved: data.reserved || 0,
        status: data.status ? InventoryStatus[data.status] : InventoryStatus.IN_SALE,
      },
    });
  }

  static async createWarehouse(data: { name: string; address?: string }) {
    return prisma.warehouse.create({
      data: {
        name: data.name,
        address: data.address,
      },
    });
  }

  static async createPromoCode(data: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    validFrom: Date;
    validUntil: Date;
    usageLimit?: number;
    minPurchase?: number;
    maxDiscount?: number;
  }) {
    return prisma.promoCode.create({
      data: {
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountValue: data.discountValue,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        usageLimit: data.usageLimit,
        minPurchase: data.minPurchase,
        maxDiscount: data.maxDiscount,
        isActive: true,
        usedCount: 0,
      },
    });
  }

  static async createAddress(data: {
    userId: string;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    phone?: string;
  }) {
    return prisma.customerAddress.create({
      data: {
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        address: data.address,
        city: data.city,
        country: data.country,
        postalCode: data.postalCode,
        phone: data.phone,
        isDefault: false,
      },
    });
  }

  static async createCartItem(data: {
    userId?: string;
    sessionId?: string;
    productId: string;
    quantity: number;
    variantId?: string;
    size?: string;
  }) {
    return prisma.cartItem.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        productId: data.productId,
        quantity: data.quantity,
        variantId: data.variantId,
        size: data.size,
      },
    });
  }
}
