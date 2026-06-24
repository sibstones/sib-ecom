import prisma from '../config/database';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  CreateAddressDto,
  UpdateAddressDto,
  CreateOrderDto,
  CreateGuestOrderDto,
  UpdatePaymentMethodDto,
} from '../types/customer';
import { comparePassword, hashPassword } from '../utils/hash';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { authService } from './auth.service';
import { settingsService } from './settings.service';
import { signGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';
import { resolvePaymentInstruction } from '../utils/payment-gateway';
import { normalizeCountryCode } from '../utils/country';
import {
  isOnlinePaymentGatewayType,
  normalizePaymentGatewayType,
} from '../constants/payment-gateway';

export class CustomerService {
  private hasOnlineGateway(gateways: Array<{ type?: string | null }>): boolean {
    return gateways.some((gateway) => isOnlinePaymentGatewayType(gateway.type));
  }

  private getPrimaryOnlineGatewayType(
    gateways: Array<{ type?: string | null }>
  ): string | null {
    const onlineGateway = gateways.find((gateway) => isOnlinePaymentGatewayType(gateway.type));
    return onlineGateway ? normalizePaymentGatewayType(onlineGateway.type) : null;
  }

  private getManualFallbackPaymentMethod(
    gateways: Array<{ type?: string | null }>
  ): 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT' {
    const types = gateways.map((gateway) => normalizePaymentGatewayType(gateway.type));
    if (types.includes('MANAGER_CHAT')) return 'MANAGER_CHAT';
    if (types.includes('BANK_TRANSFER')) return 'BANK_TRANSFER';
    if (types.includes('CASH_ON_DELIVERY')) return 'CASH_ON_DELIVERY';
    return 'BANK_TRANSFER';
  }

  /**
   * Checkout estimate: base amounts in USD (catalog). Optional `displayCurrency` returns `display`
   * using one frozen quote from current active rates and `quoteExpiresAt` (10 minutes).
   */
  async getCheckoutEstimate(
    countryCode: string,
    subtotalUsd: number,
    discountUsd = 0,
    displayCurrency?: string,
    loyaltyDiscountUsd = 0
  ): Promise<{
    subtotal: number;
    discount: number;
    subtotalAfterDiscount: number;
    tax: number;
    shipping: number;
    total: number;
    displayCurrency?: string;
    display?: {
      subtotal: number;
      discount: number;
      subtotalAfterDiscount: number;
      tax: number;
      shipping: number;
      total: number;
    };
    quoteExpiresAt?: string;
  }> {
    const { normalizeCountryCode } = await import('../utils/country');
    const { computeCheckoutUsdTotals } = await import('./checkout-pricing');
    const code = normalizeCountryCode(countryCode);
    const displayCode = (displayCurrency || '').trim().toUpperCase();

    const priced = await computeCheckoutUsdTotals({
      countryCode: code,
      checkoutCurrency: displayCode || undefined,
      subtotalUsd,
      discountUsd,
      loyaltyDiscountUsd,
    });

    const base = {
      subtotal: subtotalUsd,
      discount: discountUsd,
      subtotalAfterDiscount: priced.subtotalAfterDiscount,
      tax: priced.tax,
      shipping: priced.shipping,
      total: priced.total,
    };

    const supported = new Set(['USD', 'EUR', 'GBP', 'RUB', 'JPY', 'CNY', 'KRW']);
    if (!displayCode || displayCode === 'USD' || !supported.has(displayCode)) {
      return base;
    }

    try {
      const { currencyRateService } = await import('./currency-rate.service');
      const quoteRates = await currencyRateService.getActive();
      const toDisplay = (usd: number) =>
        currencyRateService.convertWithRatesMap(usd, 'USD', displayCode, quoteRates);
      const dSub = toDisplay(subtotalUsd);
      const dDisc = toDisplay(discountUsd);
      const dAfter = toDisplay(base.subtotalAfterDiscount);
      const dTax = toDisplay(base.tax);
      const dShip = toDisplay(base.shipping);
      const dTotal = dAfter + dTax + dShip;
      const quoteExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      return {
        ...base,
        displayCurrency: displayCode,
        quoteExpiresAt,
        display: {
          subtotal: dSub,
          discount: dDisc,
          subtotalAfterDiscount: dAfter,
          tax: dTax,
          shipping: dShip,
          total: dTotal,
        },
      };
    } catch {
      return base;
    }
  }

  async getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        preferredLanguage: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email && { email: data.email }),
        ...(data.preferredLanguage !== undefined && { preferredLanguage: data.preferredLanguage || null }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        preferredLanguage: true,
        emailVerified: true,
      },
    });
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has a password (OAuth-only users don't have passwordHash)
    if (!user.passwordHash) {
      throw new Error('This account does not have a password. Please use OAuth login or set a password first.');
    }

    const isValid = await comparePassword(data.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  // Addresses
  async getAddresses(userId: string) {
    return prisma.customerAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getAddress(userId: string, addressId: string) {
    return prisma.customerAddress.findFirst({
      where: { id: addressId, userId },
    });
  }

  async createAddress(userId: string, data: CreateAddressDto) {
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.create({
      data: {
        userId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        postalCode: data.postalCode,
        isDefault: data.isDefault || false,
      },
    });
  }

  async updateAddress(userId: string, addressId: string, data: UpdateAddressDto) {
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { userId, id: { not: addressId }, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address && { address: data.address }),
        ...(data.city && { city: data.city }),
        ...(data.country && { country: data.country }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
  }

  async deleteAddress(_userId: string, addressId: string) {
    return prisma.customerAddress.delete({
      where: { id: addressId },
    });
  }

  // Orders
  async getOrders(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: {
          items: {
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
          },
          shippingAddress: true,
          paymentRequest: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Count of orders in progress (CONFIRMED, PROCESSING, SHIPPED) for notification badge */
  async getOrdersInProgressCount(userId: string): Promise<number> {
    return prisma.order.count({
      where: {
        userId,
        status: {
          in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED],
        },
      },
    });
  }

  async getOrder(userId: string, orderId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        paymentRequest: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getLatestOrderForTracking(userId: string) {
    const activeOrder = await prisma.order.findFirst({
      where: {
        userId,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        paymentRequest: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (activeOrder) {
      return activeOrder;
    }

    return prisma.order.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        paymentRequest: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /** Same shape as getOrder, but for guest payment flows (order must belong to user with this email). */
  async getOrderForGuestCheckout(orderId: string, email: string) {
    const norm = email.trim().toLowerCase();
    return prisma.order.findFirst({
      where: { id: orderId, user: { email: norm } },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        paymentRequest: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async createOrder(userId: string, data: CreateOrderDto, sessionId?: string) {
    // Get cart items by userId
    const userCartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: true,
        variant: true,
      },
    });

    // Get cart items by sessionId if provided
    let sessionCartItems: typeof userCartItems = [];
    if (sessionId) {
      sessionCartItems = await prisma.cartItem.findMany({
        where: { sessionId },
        include: {
          product: true,
          variant: true,
        },
      });

      // Migrate session cart items to userId if any exist
      if (sessionCartItems.length > 0) {
        await prisma.cartItem.updateMany({
          where: { sessionId },
          data: { userId, sessionId: null },
        });
      }
    }

    // Combine cart items (user cart + migrated session cart)
    const cartItems = [...userCartItems, ...sessionCartItems];

    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Get shipping address to determine country
    const shippingAddress = await prisma.customerAddress.findUnique({
      where: { id: data.shippingAddressId },
    });

    if (!shippingAddress) {
      throw new Error('Shipping address not found');
    }

    // Determine payment method
    let paymentMethod: 'GATEWAY' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY' | 'MANAGER_CHAT' =
      data.paymentMethod || 'GATEWAY';
    let paymentGatewayType: string | null = null;
    const pricingCountryCode = normalizeCountryCode(
      shippingAddress.country || data.countryCode
    );
    const countryCode = pricingCountryCode;
    const currency = (data.currency || 'USD').trim().toUpperCase();

    // Check if payment gateway is available for this country/currency
    if (paymentMethod === 'GATEWAY') {
      try {
        const { paymentGatewayService } = await import('./payment-gateway.service');
        const availableGateways = await paymentGatewayService.getForCountryAndCurrency(
          countryCode,
          currency
        );
        
        if (!this.hasOnlineGateway(availableGateways)) {
          paymentMethod = this.getManualFallbackPaymentMethod(availableGateways);
          paymentGatewayType = null;
        } else {
          paymentGatewayType = this.getPrimaryOnlineGatewayType(availableGateways);
        }
      } catch (error) {
        console.error('Error checking payment gateways:', error);
        // Default to bank transfer if check fails
        paymentMethod = 'BANK_TRANSFER';
        paymentGatewayType = null;
      }
    }

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    const orderItems = cartItems.map((item) => {
      // Check if product has price on request
      const isPriceOnRequest = item.product.priceOnRequest || false;
      
      let price: Prisma.Decimal | null = null;
      if (!isPriceOnRequest) {
        price = item.variant?.price
          ? new Prisma.Decimal(item.variant.price)
          : (item.product.price ? new Prisma.Decimal(item.product.price) : null);
        
        if (price) {
          const itemTotal = price.mul(item.quantity);
          subtotal = subtotal.add(itemTotal);
        }
      }

      // Build order item data
      const orderItemData: {
        productId: string;
        variantId: string | null;
        size: string | null;
        quantity: number;
        price: Prisma.Decimal | null;
      } = {
        productId: item.productId,
        variantId: item.variantId || null,
        size: (item.size && item.size.trim().length > 0) ? item.size.trim() : null,
        quantity: item.quantity,
        price: price,
      };

      return orderItemData;
    });

    // Apply promo code if provided
    let promoCodeId: string | null = null;
    let discount = new Prisma.Decimal(0);
    
    if (data.promoCode) {
      const { promoService } = await import('./promo.service');
      try {
        const promoResult = await promoService.applyPromoCode({
          code: data.promoCode,
          subtotal: Number(subtotal),
          userId, // Pass userId to check user-specific promo codes
        });
        discount = new Prisma.Decimal(promoResult.discount);
        promoCodeId = promoResult.promoCode.id;
      } catch (error) {
        // If promo code is invalid, continue without it
        console.error('Promo code error:', error);
        throw error; // Re-throw to prevent order creation with invalid promo code
      }
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Verify user exists and has CUSTOMER role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, preferredLanguage: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify user has CUSTOMER role
    if (user.role !== UserRole.CUSTOMER) {
      console.warn(`Order created for user ${userId} with role ${user.role}, expected CUSTOMER`);
    }

    let checkoutFxCapturedAt: Date | undefined;
    let checkoutFxRatesSnapshot: Prisma.InputJsonValue | undefined;
    try {
      const { currencyRateService } = await import('./currency-rate.service');
      const rates = await currencyRateService.getActive();
      checkoutFxRatesSnapshot = rates as unknown as Prisma.InputJsonValue;
      checkoutFxCapturedAt = new Date();
    } catch {
      // Rates optional if service/DB unavailable
    }

    const loyaltyRequestedPoints = Math.max(0, Math.floor(Number(data.loyaltyRedeemPoints || 0)));
    let loyaltyDiscount = new Prisma.Decimal(0);
    let loyaltyPointsSpent = 0;
    let subtotalAfterDiscount = new Prisma.Decimal(0);
    let tax = new Prisma.Decimal(0);
    let shipping = new Prisma.Decimal(0);
    let total = new Prisma.Decimal(0);

    const order = await prisma.$transaction(async (tx) => {
      if (loyaltyRequestedPoints > 0) {
        const settings = await settingsService.getAllSettings();
        if (!settings.loyaltyProgramEnabled) {
          throw new Error('Loyalty program is currently disabled.');
        }

        const spendPerUnit = Number(settings.loyaltyPointsSpendPerUnit ?? 100) || 100;
        const usableSubtotal = Math.max(0, Number(subtotal.sub(discount)));
        const maxPointsBySubtotal = Math.max(0, Math.floor(usableSubtotal * spendPerUnit));
        const loyaltyPointsRecord = await tx.loyaltyPoints.findUnique({
          where: { userId },
          select: { id: true, balance: true },
        });

        const balance = loyaltyPointsRecord?.balance || 0;
        loyaltyPointsSpent = Math.min(loyaltyRequestedPoints, balance, maxPointsBySubtotal);
        loyaltyDiscount = new Prisma.Decimal(loyaltyPointsSpent).div(spendPerUnit);
      }

      // Same pricing path as getCheckoutEstimate — preview and persisted order must match.
      const { computeCheckoutUsdTotals } = await import('./checkout-pricing');
      const priced = await computeCheckoutUsdTotals({
        countryCode: pricingCountryCode,
        checkoutCurrency: currency,
        subtotalUsd: Number(subtotal),
        discountUsd: Number(discount),
        loyaltyDiscountUsd: Number(loyaltyDiscount),
      });

      subtotalAfterDiscount = new Prisma.Decimal(priced.subtotalAfterDiscount);
      tax = new Prisma.Decimal(priced.tax);
      shipping = new Prisma.Decimal(priced.shipping);
      total = new Prisma.Decimal(priced.total);

      const createdOrder = await tx.order.create({
        data: {
          userId,
          orderNumber,
          shippingAddressId: data.shippingAddressId,
          promoCodeId,
          paymentMethod,
          paymentGatewayType,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          checkoutCurrency: currency,
          checkoutFxCapturedAt,
          checkoutFxRatesSnapshot,
          subtotal: subtotalAfterDiscount,
          tax,
          shipping,
          total,
          loyaltyDiscount,
          loyaltyPointsSpent,
          notes: data.notes,
          items: {
            create: orderItems,
          },
          statusHistory: {
            create: {
              status: OrderStatus.PENDING,
              notes: 'orderDetail.statusHistory.orderCreated',
            },
          },
        },
        include: {
          items: {
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
          },
          shippingAddress: true,
        },
      });

      await tx.cartItem.deleteMany({
        where: { userId },
      });

      if (promoCodeId) {
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: {
            usedCount: { increment: 1 },
          },
        });
      }

      if (loyaltyPointsSpent > 0) {
        let loyaltyPoints = await tx.loyaltyPoints.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (!loyaltyPoints) {
          loyaltyPoints = await tx.loyaltyPoints.create({
            data: {
              userId,
              balance: 0,
              totalEarned: 0,
              totalSpent: 0,
            },
            select: { id: true },
          });
        }

        await tx.loyaltyPoints.update({
          where: { userId },
          data: {
            balance: { decrement: loyaltyPointsSpent },
            totalSpent: { increment: loyaltyPointsSpent },
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            loyaltyPointsId: loyaltyPoints.id,
            orderId: createdOrder.id,
            points: -loyaltyPointsSpent,
            type: 'SPENT',
            description: `Spent ${loyaltyPointsSpent} points on checkout`,
          },
        });
      }

      return createdOrder;
    });

    // Award loyalty points based on the final order total after discounts.
    try {
      const { loyaltyService } = await import('./loyalty.service');
      await loyaltyService.earnPoints(userId, order.id, Number(order.total));
    } catch (error) {
      console.error('Failed to award loyalty points:', error);
    }

    // Create payment request for all manual payment methods.
    if (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CASH_ON_DELIVERY' || paymentMethod === 'MANAGER_CHAT') {
      try {
        const { paymentRequestService } = await import('./payment-request.service');
        const { paymentGatewayService } = await import('./payment-gateway.service');
        
        let bankDetails = undefined;
        let p2pDetails = undefined;
        let cashOnDeliveryDetails = undefined;
        
        if (paymentMethod === 'BANK_TRANSFER') {
          try {
            const bankTransferGateway = await paymentGatewayService.getByType('BANK_TRANSFER');
            if (bankTransferGateway && bankTransferGateway.config) {
              const config = bankTransferGateway.config as any;
              if (config.accountName && config.accountNumber && config.bankName) {
                bankDetails = {
                  accountName: config.accountName,
                  accountNumber: config.accountNumber,
                  bankName: config.bankName,
                  swiftCode: config.swiftCode,
                  iban: config.iban,
                  routingNumber: config.routingNumber,
                  notes: config.notes,
                };
              }
            }
          } catch (error) {
            console.error('Failed to get bank details from payment gateway:', error);
          }
        } else if (paymentMethod === 'CASH_ON_DELIVERY') {
          try {
            const codGateway = await paymentGatewayService.getByType('CASH_ON_DELIVERY');
            if (codGateway && codGateway.config) {
              const config = codGateway.config as any;
              cashOnDeliveryDetails = {
                instruction:
                  resolvePaymentInstruction(
                    config,
                    data.languageCode || user.preferredLanguage || undefined
                  ) || undefined,
              };
            }
          } catch (error) {
            console.error('Failed to get cash-on-delivery details from payment gateway:', error);
          }
        } else if (paymentMethod === 'MANAGER_CHAT') {
          try {
            const managerChatGateway = await paymentGatewayService.getByType('MANAGER_CHAT');
            if (managerChatGateway && managerChatGateway.config) {
              const config = managerChatGateway.config as any;
              p2pDetails = {
                instruction:
                  resolvePaymentInstruction(
                    config,
                    data.languageCode || user.preferredLanguage || undefined
                  ) || undefined,
              };
            }
          } catch (error) {
            console.error('Failed to get manager chat details from payment gateway:', error);
          }
        }
        
        await paymentRequestService.create({
          orderId: order.id,
          bankDetails,
          p2pDetails,
          cashOnDeliveryDetails,
        });
      } catch (error) {
        console.error('Failed to create payment request:', error);
      }
    }

    // Send order confirmation email
    try {
      const { emailService } = await import('./email.service');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const orderDetails = {
          items: order.items.map((item) => ({
            name: item.variant?.name || item.product.name,
            quantity: item.quantity,
            price: Number(item.price),
            size: item.size,
            isPriceOnRequest: item.price == null,
          })),
          total: Number(order.total),
          hasPriceOnRequestItems: order.items.some((item) => item.price == null),
        };
        
        if (paymentMethod === 'BANK_TRANSFER') {
          const bankDetails = order.items.length > 0 ? {
            accountNumber: 'N/A',
            bankName: 'N/A',
          } : undefined;
          await emailService.sendPaymentRequest(order.id, user.email, order.orderNumber, bankDetails, user.preferredLanguage ?? undefined);
        } else {
          // GATEWAY, CASH_ON_DELIVERY — send order confirmation
          await emailService.sendOrderConfirmation(order.id, user.email, order.orderNumber, orderDetails, user.preferredLanguage ?? undefined);
        }
      }
    } catch (error) {
      console.error('Failed to send order confirmation email:', error);
    }

    return order;
  }

  async createGuestOrder(data: CreateGuestOrderDto, sessionId?: string) {
    const email = data.email.trim().toLowerCase();
    if (!sessionId || !sessionId.trim()) {
      throw new Error('Guest checkout requires a valid session id.');
    }

    // For security and ownership clarity, require login when a full account already exists.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.passwordHash) {
      throw new Error('An account with this email already exists. Please sign in to continue checkout.');
    }

    const user =
      existingUser ||
      (await prisma.user.create({
        data: {
          email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: UserRole.CUSTOMER,
          emailVerified: false,
        },
      }));

    if (existingUser) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: data.firstName || existingUser.firstName,
          lastName: data.lastName || existingUser.lastName,
          phone: data.phone ?? existingUser.phone,
        },
      });
    }

    const address = await prisma.customerAddress.create({
      data: {
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        postalCode: data.postalCode,
        isDefault: false,
      },
    });

    const order = await this.createOrder(
      user.id,
      {
        shippingAddressId: address.id,
        notes: data.notes,
        paymentMethod: data.paymentMethod,
        currency: data.currency,
        countryCode: data.countryCode,
        promoCode: data.promoCode,
        languageCode: data.languageCode,
      },
      sessionId
    );

    // Start account-claim flow for guest orders:
    // - verification link for email ownership
    // - password setup/recovery link
    await Promise.allSettled([
      authService.resendVerificationByEmail(email),
      authService.forgotPassword(email),
    ]);

    const guestPaymentToken = signGuestCheckoutPaymentToken(order.id, email);
    return { order, guestPaymentToken };
  }

  async checkGuestCheckoutEmail(email: string): Promise<{ canCheckout: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { passwordHash: true },
    });

    return {
      canCheckout: !existingUser?.passwordHash,
    };
  }

  // Wishlist
  async getWishlist(userId: string) {
    return prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addToWishlist(userId: string, productId: string) {
    return prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
  }

  async removeFromWishlist(userId: string, productId: string) {
    return prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });
  }

  async isInWishlist(userId: string, productId: string) {
    const item = await prisma.wishlistItem.findFirst({
      where: { userId, productId },
    });
    return !!item;
  }

  async updatePaymentMethod(userId: string, orderId: string, data: UpdatePaymentMethodDto) {
    // Get order and verify ownership
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        shippingAddress: true,
        paymentRequest: true,
        user: {
          select: {
            preferredLanguage: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if order is already paid
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new Error('Cannot change payment method for paid order');
    }

    // Get country and currency from shipping address
    const countryCode = order.shippingAddress?.country || 'US';
    const currency = 'USD'; // Default currency, can be enhanced later
    let paymentGatewayType: string | null = null;

    // Validate payment method availability
    if (data.paymentMethod === 'GATEWAY') {
      try {
        const { paymentGatewayService } = await import('./payment-gateway.service');
        const availableGateways = await paymentGatewayService.getForCountryAndCurrency(
          countryCode,
          currency
        );
        
        if (!this.hasOnlineGateway(availableGateways)) {
          throw new Error('Payment gateway is not available for this country/currency');
        }
        paymentGatewayType = this.getPrimaryOnlineGatewayType(availableGateways);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not available')) {
          throw error;
        }
        console.error('Error checking payment gateways:', error);
        throw new Error('Failed to validate payment gateway availability');
      }
    }

    // Update order payment method
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: data.paymentMethod,
        paymentGatewayType: data.paymentMethod === 'GATEWAY' ? paymentGatewayType : null,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
              },
            },
            variant: true,
          },
        },
        shippingAddress: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Handle payment request based on payment method change
    const { paymentRequestService } = await import('./payment-request.service');
    const { paymentGatewayService } = await import('./payment-gateway.service');

    if (data.paymentMethod === 'GATEWAY') {
      // Cancel existing payment request if changing to GATEWAY
      if (order.paymentRequest) {
        try {
          await paymentRequestService.update(order.paymentRequest.id, {
            status: 'CANCELLED',
          });
        } catch (error) {
          console.error('Failed to cancel payment request:', error);
        }
      }
    } else if (data.paymentMethod === 'BANK_TRANSFER' || data.paymentMethod === 'CASH_ON_DELIVERY' || data.paymentMethod === 'MANAGER_CHAT') {
      let bankDetails = undefined;
      let p2pDetails = undefined;
      let cashOnDeliveryDetails = undefined;

      if (data.paymentMethod === 'BANK_TRANSFER') {
        try {
          const bankTransferGateway = await paymentGatewayService.getByType('BANK_TRANSFER');
          if (bankTransferGateway && bankTransferGateway.config) {
            const config = bankTransferGateway.config as any;
            if (config.accountName && config.accountNumber && config.bankName) {
              bankDetails = {
                accountName: config.accountName,
                accountNumber: config.accountNumber,
                bankName: config.bankName,
                swiftCode: config.swiftCode,
                iban: config.iban,
                routingNumber: config.routingNumber,
                notes: config.notes,
              };
            }
          }
        } catch (error) {
          console.error('Failed to get bank details from payment gateway:', error);
        }
      } else if (data.paymentMethod === 'CASH_ON_DELIVERY') {
        try {
          const codGateway = await paymentGatewayService.getByType('CASH_ON_DELIVERY');
          if (codGateway && codGateway.config) {
            const config = codGateway.config as any;
            cashOnDeliveryDetails = {
              instruction:
                resolvePaymentInstruction(config, order.user?.preferredLanguage || undefined) ||
                undefined,
            };
          }
        } catch (error) {
          console.error('Failed to get cash-on-delivery details from payment gateway:', error);
        }
      } else if (data.paymentMethod === 'MANAGER_CHAT') {
        try {
          const managerChatGateway = await paymentGatewayService.getByType('MANAGER_CHAT');
          if (managerChatGateway && managerChatGateway.config) {
            const config = managerChatGateway.config as any;
            p2pDetails = {
              instruction:
                resolvePaymentInstruction(config, order.user?.preferredLanguage || undefined) ||
                undefined,
            };
          }
        } catch (error) {
          console.error('Failed to get manager chat details from payment gateway:', error);
        }
      }

      if (order.paymentRequest) {
        const updateData: any = { status: 'PENDING' };
        if (data.paymentMethod === 'BANK_TRANSFER') {
          updateData.bankDetails = bankDetails;
          updateData.p2pDetails = null;
          updateData.cashOnDeliveryDetails = null;
        } else if (data.paymentMethod === 'CASH_ON_DELIVERY') {
          updateData.cashOnDeliveryDetails = cashOnDeliveryDetails;
          updateData.bankDetails = null;
          updateData.p2pDetails = null;
        } else {
          updateData.p2pDetails = p2pDetails;
          updateData.bankDetails = null;
          updateData.cashOnDeliveryDetails = null;
        }
        try {
          await paymentRequestService.update(order.paymentRequest.id, updateData);
        } catch (error) {
          console.error('Failed to update payment request:', error);
        }
      } else {
        try {
          await paymentRequestService.create({
            orderId: orderId,
            bankDetails,
            p2pDetails,
            cashOnDeliveryDetails,
          });
        } catch (error) {
          console.error('Failed to create payment request:', error);
        }
      }
    }

    return updatedOrder;
  }

  // Promo Codes
  async getPromoCodes(userId: string) {
    // Get promo codes used by user in orders
    const ordersWithPromoCodes = await prisma.order.findMany({
      where: {
        userId,
        promoCodeId: { not: null },
      },
      include: {
        promoCode: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get unique promo codes used by user
    const usedPromoCodes = ordersWithPromoCodes
      .map((order) => order.promoCode)
      .filter((code): code is NonNullable<typeof code> => code !== null)
      .reduce((acc, code) => {
        if (code && !acc.find((c) => c && c.id === code.id)) {
          acc.push(code);
        }
        return acc;
      }, [] as NonNullable<typeof ordersWithPromoCodes[0]['promoCode']>[]);

    // Get all active promo codes
    const now = new Date();
    const activePromoCodes = await prisma.promoCode.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      used: usedPromoCodes.map((code) => {
        if (!code) return null;
        return {
          ...code,
          discountValue: Number(code.discountValue),
          minPurchase: code.minPurchase ? Number(code.minPurchase) : undefined,
          maxDiscount: code.maxDiscount ? Number(code.maxDiscount) : undefined,
        };
      }).filter((code): code is NonNullable<typeof code> => code !== null),
      available: activePromoCodes
        .filter((code) => {
          // Filter out codes that have reached usage limit
          if (code.usageLimit && code.usedCount >= code.usageLimit) {
            return false;
          }
          // Filter out codes already in used list
          return !usedPromoCodes.find((used) => used.id === code.id);
        })
        .map((code) => ({
          ...code,
          discountValue: Number(code.discountValue),
          minPurchase: code.minPurchase ? Number(code.minPurchase) : undefined,
          maxDiscount: code.maxDiscount ? Number(code.maxDiscount) : undefined,
        })),
    };
  }
}

export const customerService = new CustomerService();
