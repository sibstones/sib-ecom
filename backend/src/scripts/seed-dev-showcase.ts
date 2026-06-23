import prisma from '../config/database';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';
import { hashPassword } from '../utils/hash';

async function ensureUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}) {
  const passwordHash = await hashPassword('DemoUser123!');
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      passwordHash,
      role: UserRole.CUSTOMER,
      emailVerified: true,
    },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      passwordHash,
      role: UserRole.CUSTOMER,
      emailVerified: true,
    },
  });
}

async function ensureAddress(userId: string, input: {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
}) {
  const existing = await prisma.customerAddress.findFirst({
    where: { userId, address: input.address, city: input.city },
  });
  if (existing) {
    return prisma.customerAddress.update({
      where: { id: existing.id },
      data: { ...input, isDefault: true },
    });
  }

  await prisma.customerAddress.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });

  return prisma.customerAddress.create({
    data: { userId, ...input, isDefault: true },
  });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { slug: 'showcase-category' },
    update: { name: 'Showcase Category' },
    create: {
      name: 'Showcase Category',
      slug: 'showcase-category',
      isMain: true,
    },
  });
}

async function ensureBrand() {
  return prisma.brand.upsert({
    where: { slug: 'showcase-brand' },
    update: { name: 'Showcase Brand' },
    create: {
      name: 'Showcase Brand',
      slug: 'showcase-brand',
    },
  });
}

async function ensureWarehouse() {
  const existing = await prisma.warehouse.findFirst({
    where: { name: 'Showcase Warehouse' },
  });
  if (existing) {
    return existing;
  }
  return prisma.warehouse.create({
    data: {
      name: 'Showcase Warehouse',
      address: '1 Warehouse Avenue, New York',
    },
  });
}

async function ensureProduct(categoryId: string, brandId: string) {
  const existing = await prisma.product.findUnique({
    where: { slug: 'showcase-trench-coat' },
  });
  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        name: 'Showcase Trench Coat',
        sku: 'SHOWCASE-COAT-001',
        price: 245,
        brandId,
        categoryId,
        isActive: true,
      },
    });
  }

  return prisma.product.create({
    data: {
      name: 'Showcase Trench Coat',
      slug: 'showcase-trench-coat',
      sku: 'SHOWCASE-COAT-001',
      description: 'Demo product for registration and order UI verification.',
      price: 245,
      brandId,
      categoryId,
      isActive: true,
    },
  });
}

async function ensureInventory(warehouseId: string, productId: string) {
  const existing = await prisma.inventory.findFirst({
    where: { warehouseId, productId, variantId: null },
  });
  if (existing) {
    return prisma.inventory.update({
      where: { id: existing.id },
      data: { quantity: 50, reserved: 0, status: 'IN_SALE' },
    });
  }

  return prisma.inventory.create({
    data: {
      warehouseId,
      productId,
      quantity: 50,
      reserved: 0,
      status: 'IN_SALE',
    },
  });
}

async function upsertShowcaseOrder(input: {
  userId: string;
  addressId: string;
  productId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  checkoutCurrency: string;
  notes: string;
  invoiceNumber: string;
  deliveryMethod: string;
  carrierName: string;
  trackingNumber: string;
  waybillNumber: string;
  customsDeclarationNumber: string;
  createdAt: Date;
}) {
  const existing = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
  });

  const order = existing
    ? await prisma.order.update({
        where: { id: existing.id },
        data: {
          userId: input.userId,
          status: input.status,
          paymentStatus: input.paymentStatus,
          paymentMethod: input.paymentMethod,
          subtotal: input.subtotal,
          tax: input.tax,
          shipping: input.shipping,
          total: input.total,
          checkoutCurrency: input.checkoutCurrency,
          notes: input.notes,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.createdAt,
          shippedAt: input.status === OrderStatus.SHIPPED ? input.createdAt : null,
          deliveryMethod: input.deliveryMethod,
          carrierName: input.carrierName,
          waybillNumber: input.waybillNumber,
          waybillDate: input.createdAt,
          trackingNumber: input.trackingNumber,
          customsDeclarationNumber: input.customsDeclarationNumber,
          shippingAddressId: input.addressId,
        },
      })
    : await prisma.order.create({
        data: {
          userId: input.userId,
          orderNumber: input.orderNumber,
          status: input.status,
          paymentStatus: input.paymentStatus,
          paymentMethod: input.paymentMethod,
          subtotal: input.subtotal,
          tax: input.tax,
          shipping: input.shipping,
          total: input.total,
          checkoutCurrency: input.checkoutCurrency,
          notes: input.notes,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.createdAt,
          shippedAt: input.status === OrderStatus.SHIPPED ? input.createdAt : null,
          deliveryMethod: input.deliveryMethod,
          carrierName: input.carrierName,
          waybillNumber: input.waybillNumber,
          waybillDate: input.createdAt,
          trackingNumber: input.trackingNumber,
          customsDeclarationNumber: input.customsDeclarationNumber,
          shippingAddressId: input.addressId,
        },
      });

  const itemExisting = await prisma.orderItem.findFirst({
    where: { orderId: order.id, productId: input.productId },
  });
  if (itemExisting) {
    await prisma.orderItem.update({
      where: { id: itemExisting.id },
      data: { quantity: 1, price: input.subtotal },
    });
  } else {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: input.productId,
        quantity: 1,
        price: input.subtotal,
      },
    });
  }

  const historyCount = await prisma.orderStatusHistory.count({
    where: { orderId: order.id },
  });
  if (historyCount === 0) {
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PENDING,
        notes: 'Showcase order created',
      },
    });
    if (input.status !== OrderStatus.PENDING) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: input.status,
          notes: `Showcase order moved to ${input.status}`,
        },
      });
    }
  }

  return order;
}

async function ensureReturnRequest(input: {
  orderId: string;
  userId: string;
  warehouseId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: true,
    },
  });

  if (!order || order.items.length === 0) {
    return null;
  }

  const existing = await (prisma as any).returnRequest.findFirst({
    where: { orderId: input.orderId },
    include: {
      items: true,
    },
  });

  if (existing) {
    await (prisma as any).returnRequest.update({
      where: { id: existing.id },
      data: {
        reason: 'CUSTOMER_REQUESTED',
        status: 'REQUESTED',
        customerNotes: 'Showcase return request for admin UI verification.',
        adminNotes: 'Demo return awaiting processing in admin area.',
        pickupMethod: 'COURIER',
        pickupAddress: '10 Mercer Street, New York, NY 10012',
        pickupDate: new Date('2026-06-19T10:00:00.000Z'),
        pickupNotes: 'Call customer 30 minutes before pickup.',
      },
    });

    for (const item of existing.items) {
      await (prisma as any).returnRequestItem.update({
        where: { id: item.id },
        data: {
          quantity: 1,
          itemStatus: 'RETURN_TO_SALE',
          warehouseId: input.warehouseId,
        },
      });
    }

    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        status: OrderStatus.RETURN_REQUESTED,
      },
    });

    return existing;
  }

  const created = await (prisma as any).returnRequest.create({
    data: {
      orderId: input.orderId,
      userId: input.userId,
      reason: 'CUSTOMER_REQUESTED',
      status: 'REQUESTED',
      customerNotes: 'Showcase return request for admin UI verification.',
      adminNotes: 'Demo return awaiting processing in admin area.',
      pickupMethod: 'COURIER',
      pickupAddress: '10 Mercer Street, New York, NY 10012',
      pickupDate: new Date('2026-06-19T10:00:00.000Z'),
      pickupNotes: 'Call customer 30 minutes before pickup.',
      items: {
        create: {
          orderItemId: order.items[0].id,
          quantity: 1,
          itemStatus: 'RETURN_TO_SALE',
          warehouseId: input.warehouseId,
        },
      },
      statusHistory: {
        create: {
          status: 'REQUESTED',
          notes: 'Showcase return request created for admin UI verification.',
        },
      },
    },
  });

  await prisma.order.update({
    where: { id: input.orderId },
    data: {
      status: OrderStatus.RETURN_REQUESTED,
      statusHistory: {
        create: {
          status: OrderStatus.RETURN_REQUESTED,
          notes: 'Showcase return requested',
        },
      },
    },
  });

  return created;
}

async function main() {
  console.log('🌟 Seeding dev showcase users and orders...');

  const category = await ensureCategory();
  const brand = await ensureBrand();
  const warehouse = await ensureWarehouse();
  const product = await ensureProduct(category.id, brand.id);
  await ensureInventory(warehouse.id, product.id);

  const users = [
    {
      email: 'showcase.customer1@fashion.local',
      firstName: 'Alice',
      lastName: 'Showcase',
      phone: '+12025550101',
      address: '10 Mercer Street',
      city: 'New York',
      country: 'US',
      postalCode: '10012',
      orderNumber: 'SHOWCASE-1001',
      status: OrderStatus.SHIPPED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: 'BANK_TRANSFER',
      subtotal: 245,
      tax: 24.5,
      shipping: 0,
      total: 269.5,
      checkoutCurrency: 'USD',
      notes: 'Call before delivery. Concierge at reception.',
      invoiceNumber: 'INV-SHOW-1001',
      deliveryMethod: 'COURIER',
      carrierName: 'DHL',
      trackingNumber: 'DHL-SHOW-1001',
      waybillNumber: 'WB-SHOW-1001',
      customsDeclarationNumber: 'CD-SHOW-1001',
      createdAt: new Date('2026-06-10T09:00:00.000Z'),
    },
    {
      email: 'showcase.customer2@fashion.local',
      firstName: 'Marco',
      lastName: 'Showcase',
      phone: '+442071838750',
      address: '25 Regent Street',
      city: 'London',
      country: 'GB',
      postalCode: 'SW1Y 4LR',
      orderNumber: 'SHOWCASE-1002',
      status: OrderStatus.PROCESSING,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: 'GATEWAY',
      subtotal: 245,
      tax: 49,
      shipping: 15,
      total: 309,
      checkoutCurrency: 'GBP',
      notes: 'Gift wrap requested.',
      invoiceNumber: 'INV-SHOW-1002',
      deliveryMethod: 'EXPRESS',
      carrierName: 'UPS',
      trackingNumber: 'UPS-SHOW-1002',
      waybillNumber: 'WB-SHOW-1002',
      customsDeclarationNumber: 'CD-SHOW-1002',
      createdAt: new Date('2026-06-12T14:30:00.000Z'),
    },
  ];

  const seededOrders: Array<{ orderId: string; userId: string; orderNumber: string }> = [];

  for (const entry of users) {
    const user = await ensureUser({
      email: entry.email,
      firstName: entry.firstName,
      lastName: entry.lastName,
      phone: entry.phone,
    });
    const address = await ensureAddress(user.id, {
      firstName: entry.firstName,
      lastName: entry.lastName,
      phone: entry.phone,
      address: entry.address,
      city: entry.city,
      country: entry.country,
      postalCode: entry.postalCode,
    });
    const order = await upsertShowcaseOrder({
      userId: user.id,
      addressId: address.id,
      productId: product.id,
      orderNumber: entry.orderNumber,
      status: entry.status,
      paymentStatus: entry.paymentStatus,
      paymentMethod: entry.paymentMethod,
      subtotal: entry.subtotal,
      tax: entry.tax,
      shipping: entry.shipping,
      total: entry.total,
      checkoutCurrency: entry.checkoutCurrency,
      notes: entry.notes,
      invoiceNumber: entry.invoiceNumber,
      deliveryMethod: entry.deliveryMethod,
      carrierName: entry.carrierName,
      trackingNumber: entry.trackingNumber,
      waybillNumber: entry.waybillNumber,
      customsDeclarationNumber: entry.customsDeclarationNumber,
      createdAt: entry.createdAt,
    });

    seededOrders.push({
      orderId: order.id,
      userId: user.id,
      orderNumber: order.orderNumber,
    });

    console.log(`  ✅ ${entry.email} -> ${order.orderNumber}`);
  }

  const returnRequest = await ensureReturnRequest({
    orderId: seededOrders[0].orderId,
    userId: seededOrders[0].userId,
    warehouseId: warehouse.id,
  });
  if (returnRequest) {
    console.log(`  ↩️  return request ready for ${seededOrders[0].orderNumber}`);
  }

  console.log('✅ Dev showcase data is ready.');
  console.log('   Demo password for seeded customers: DemoUser123!');
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed dev showcase data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
