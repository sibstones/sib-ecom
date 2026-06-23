import { Intent, IntentType, ASSISTANT_UNAVAILABLE_MESSAGE } from '../types/gpt-assistant';
import { adminService } from './admin.service';
import { productService } from './product.service';
import { customerService } from './customer.service';
import { paymentRequestService } from './payment-request.service';
import { returnService } from './return.service';
import { paymentGatewayService } from './payment-gateway.service';
import { deliveryTrackingService } from './delivery-tracking.service';
import { settingsService } from './settings.service';
import { lookbookService } from './lookbook.service';
import { pageService } from './page.service';
import { blogService } from './blog.service';
import { promoService } from './promo.service';
import { ticketService } from './ticket.service';
import { CreateProductDto, UpdateProductDto } from '../types/product';
import prisma from '../config/database';
import { gptApiService } from './gpt-api.service';

export class ActionExecutorService {
  /**
   * Execute action based on intent
   */
  async execute(
    intent: Intent,
    userType: 'admin' | 'customer' | 'guest',
    userId: string | null,
    context?: any
  ): Promise<any> {
    try {
      if (userType === 'admin') {
        return await this.executeAdminAction(intent, userId, context);
      } else {
        return await this.executeCustomerAction(intent, userId, context);
      }
    } catch (error) {
      console.error('Action execution error:', error);
      throw error;
    }
  }

  /**
   * Execute admin actions
   */
  private async executeAdminAction(
    intent: Intent,
    userId: string | null,
    _context?: any
  ): Promise<any> {
    const { type, params } = intent;

    switch (type) {
      case IntentType.PRODUCT_SEARCH:
        return await this.searchProducts(params);
      
      case IntentType.PRODUCT_CREATE:
        return await this.createProduct(params);
      
      case IntentType.PRODUCT_UPDATE:
        return await this.updateProduct(params);
      
      case IntentType.ORDER_SEARCH:
        return await adminService.getAllOrders(
          params.page || 1,
          params.limit || 20,
          {
            status: params.status,
            paymentStatus: params.paymentStatus,
            search: params.search,
          }
        );
      
      case IntentType.ORDER_VIEW:
        if (!params.orderId && !params.orderNumber) {
          throw new Error('Order ID or order number is required');
        }
        // Find order by number if ID not provided
        if (params.orderNumber && !params.orderId) {
          const order = await prisma.order.findUnique({
            where: { orderNumber: params.orderNumber },
          });
          if (!order) {
            throw new Error('Order not found');
          }
          params.orderId = order.id;
        }
        return await adminService.getOrderById(params.orderId);
      
      case IntentType.ORDER_UPDATE_STATUS: {
        if (!params.orderId && !params.orderNumber) {
          throw new Error('Order ID or order number is required');
        }
        // Find order by number if ID not provided
        let orderIdForStatus = params.orderId;
        if (!orderIdForStatus && params.orderNumber) {
          const order = await prisma.order.findUnique({
            where: { orderNumber: params.orderNumber },
          });
          if (!order) {
            throw new Error('Order not found');
          }
          orderIdForStatus = order.id;
        }
        return await adminService.updateOrderStatus(
          orderIdForStatus,
          params.status,
          params.notes
        );
      }

      case IntentType.ORDER_UPDATE_PAYMENT_STATUS: {
        if (!params.orderId && !params.orderNumber) {
          throw new Error('Order ID or order number is required');
        }
        // Find order by number if ID not provided
        let orderIdForPayment = params.orderId;
        if (!orderIdForPayment && params.orderNumber) {
          const order = await prisma.order.findUnique({
            where: { orderNumber: params.orderNumber },
          });
          if (!order) {
            throw new Error('Order not found');
          }
          orderIdForPayment = order.id;
        }
        return await this.updatePaymentStatus(orderIdForPayment, params.paymentStatus);
      }

      case IntentType.PAYMENT_REQUEST_CREATE:
        return await this.createPaymentRequest(params);
      
      case IntentType.PAYMENT_REQUEST_VIEW:
        return await this.viewPaymentRequests(params);
      
      case IntentType.RETURN_REQUEST_VIEW:
        return await this.viewReturnRequests(params);
      
      case IntentType.RETURN_REQUEST_APPROVE:
        return await this.processReturnRequest({ ...params, status: 'APPROVED', adminId: userId });
      
      case IntentType.RETURN_REQUEST_REJECT:
        return await this.processReturnRequest({ ...params, status: 'REJECTED', adminId: userId });
      
      case IntentType.PAYMENT_GATEWAY_CONFIGURE:
        return await this.configurePaymentGateway(params, userId);
      
      case IntentType.PAYMENT_GATEWAY_VIEW:
        return await this.viewPaymentGateways(params);
      
      case IntentType.PAYMENT_GATEWAY_ENABLE:
        return await this.enablePaymentGateway(params, userId);
      
      case IntentType.DELIVERY_SERVICE_CONFIGURE:
        return await this.configureDeliveryService(params, userId);
      
      case IntentType.DELIVERY_SERVICE_VIEW:
        return await this.viewDeliveryServices(params);
      
      case IntentType.EMAIL_SERVICE_CONFIGURE:
        return await this.configureEmailService(params, userId);
      
      case IntentType.EMAIL_SERVICE_VIEW:
        return await this.viewEmailService(params);
      
      case IntentType.EMAIL_SERVICE_TEST:
        return await this.testEmailService(params);
      
      case IntentType.OAUTH_PROVIDER_CONFIGURE:
        return await this.configureOAuthProvider(params, userId);
      
      case IntentType.OAUTH_PROVIDER_VIEW:
        return await this.viewOAuthProviders(params);
      
      case IntentType.OAUTH_PROVIDER_ENABLE:
        return await this.enableOAuthProvider(params, userId);
      
      case IntentType.LOOKBOOK_VIEW:
        return await this.viewLookbooks(params);
      
      case IntentType.LOOKBOOK_CREATE:
        return await this.createLookbook(params);
      
      case IntentType.LOOKBOOK_UPDATE:
        return await this.updateLookbook(params);
      
      case IntentType.PAGE_VIEW:
        return await this.viewPages(params);
      
      case IntentType.PAGE_CREATE:
        return await this.createPage(params);
      
      case IntentType.PAGE_UPDATE:
        return await this.updatePage(params);
      
      case IntentType.BLOG_POST_VIEW:
        return await this.viewBlogPosts(params);
      
      case IntentType.BLOG_POST_CREATE:
        return await this.createBlogPost(params, userId);
      
      case IntentType.BLOG_POST_UPDATE:
        return await this.updateBlogPost(params);
      
      case IntentType.BLOG_POST_PUBLISH:
        return await this.publishBlogPost(params);
      
      case IntentType.PROMO_CODE_VIEW:
        return await this.viewPromoCodes(params);
      
      case IntentType.PROMO_CODE_CREATE:
        return await this.createPromoCode(params);
      
      case IntentType.PROMO_CODE_UPDATE:
        return await this.updatePromoCode(params);
      
      case IntentType.PROMO_CODE_STATS:
        return await this.getPromoCodeStats(params);
      
      case IntentType.TICKET_VIEW:
        return await this.viewTickets(params);
      
      case IntentType.TICKET_CREATE:
        return await this.createTicket(params, userId);
      
      case IntentType.TICKET_RESPOND:
        return await this.respondToTicket(params, userId);
      
      case IntentType.TICKET_UPDATE_STATUS:
        return await this.updateTicketStatus(params, userId);
      
      case IntentType.REPORT_GENERATE:
        return await this.generateReport(params);
      
      case IntentType.CUSTOMER_SEARCH:
        return await adminService.getAllCustomers(
          params.page || 1,
          params.limit || 20,
          { search: params.search }
        );
      
      case IntentType.CUSTOMER_VIEW:
        if (!params.customerId && !params.email) {
          throw new Error('Customer ID or email is required');
        }
        // Find customer by email if ID not provided
        if (params.email && !params.customerId) {
          const customer = await prisma.user.findUnique({
            where: { email: params.email },
          });
          if (!customer) {
            throw new Error('Customer not found');
          }
          params.customerId = customer.id;
        }
        return await adminService.getCustomerDetails(params.customerId);

      case IntentType.CUSTOMER_UPDATE: {
        if (!params.customerId && !params.email) {
          throw new Error('Customer ID or email is required');
        }
        let customerIdForUpdate = params.customerId;
        if (params.email && !customerIdForUpdate) {
          const customer = await prisma.user.findUnique({
            where: { email: params.email },
          });
          if (!customer) {
            throw new Error('Customer not found');
          }
          customerIdForUpdate = customer.id;
        }
        return await adminService.updateCustomer(customerIdForUpdate!, {
          email: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          isPartner: params.isPartner,
          partnerStatus: params.partnerStatus,
        });
      }

      case IntentType.CUSTOMER_NOTE_ADD: {
        if (!params.customerId && !params.email) {
          throw new Error('Customer ID or email is required');
        }
        if (!params.content && !params.note) {
          throw new Error('Note content is required');
        }
        let customerIdForNote = params.customerId;
        if (params.email && !customerIdForNote) {
          const customer = await prisma.user.findUnique({
            where: { email: params.email },
          });
          if (!customer) {
            throw new Error('Customer not found');
          }
          customerIdForNote = customer.id;
        }
        if (!userId) {
          throw new Error('Admin ID is required');
        }
        return await adminService.addCustomerNote(
          customerIdForNote!,
          (params.content || params.note) as string,
          userId
        );
      }

      case IntentType.CUSTOMER_NOTE_VIEW: {
        if (!params.customerId && !params.email) {
          throw new Error('Customer ID or email is required');
        }
        let customerIdForNotes = params.customerId;
        if (params.email && !customerIdForNotes) {
          const customer = await prisma.user.findUnique({
            where: { email: params.email },
          });
          if (!customer) {
            throw new Error('Customer not found');
          }
          customerIdForNotes = customer.id;
        }
        return await adminService.getCustomerNotes(customerIdForNotes!);
      }

      case IntentType.INVENTORY_VIEW:
        if (params.warehouseId) {
          return await adminService.getWarehouseInventory(
            params.warehouseId,
            {
              status: params.status,
              search: params.search,
            }
          );
        }
        return await adminService.getAllWarehouses();

      case IntentType.WAREHOUSE_CREATE:
        if (!params.name || !String(params.name).trim()) {
          throw new Error('Warehouse name is required. Example: "create warehouse Main MAIN, NY".');
        }
        return await adminService.createWarehouse({
          name: String(params.name).trim(),
          address: params.address ? String(params.address).trim() : undefined,
          city: params.city ? String(params.city).trim() : undefined,
          country: params.country ? String(params.country).trim() : undefined,
          type: params.type,
          priority:
            params.priority !== undefined && Number.isFinite(Number(params.priority))
              ? Number(params.priority)
              : undefined,
        });
      
      case IntentType.INVENTORY_ADD:
        if (!params.warehouseId || !params.productId || params.quantity === undefined) {
          throw new Error('Warehouse ID, product ID, and quantity are required');
        }
        return await adminService.addInventory(
          params.warehouseId,
          params.productId,
          params.variantId || null,
          params.quantity,
          params.reason,
          params.status,
          params.palletId
        );
      
      case IntentType.ANALYTICS_VIEW:
        return await adminService.getDashboardStats();

      case IntentType.MARKETING_ADVICE:
        return await this.getMarketingAdvice(params);

      case IntentType.HELP:
        return {
          help: true,
          topic: params?.topic,
          message:
            params?.topic === 'ping'
              ? 'Connection to the assistant is working. Ready to help with the admin panel.'
              : 'I can help with products, orders, customers, warehouse, content and settings. Formulate your task in one phrase.',
        };

      default:
        if (type === IntentType.UNKNOWN) {
          throw new Error(ASSISTANT_UNAVAILABLE_MESSAGE);
        }
        throw new Error(`Action not implemented for intent: ${type}`);
    }
  }

  /**
   * Execute customer actions
   */
  private async executeCustomerAction(
    intent: Intent,
    userId: string | null,
    _context?: any
  ): Promise<any> {
    const { type, params } = intent;

    if (
      !userId &&
      type !== IntentType.CUSTOMER_STORE_INFO &&
      type !== IntentType.CUSTOMER_DELIVERY_INFO &&
      type !== IntentType.CUSTOMER_PAYMENT_INFO &&
      type !== IntentType.HELP
    ) {
      throw new Error('Authentication required for this action');
    }

    switch (type) {
      case IntentType.CUSTOMER_PRODUCT_SEARCH:
        return await this.searchProducts(params);
      
      case IntentType.CUSTOMER_PRODUCT_INFO:
        if (!params.productId && !params.sku && !params.slug) {
          throw new Error('Product ID, SKU, or slug is required');
        }
        // Find product by SKU or slug if ID not provided
        if (params.sku && !params.productId) {
          const product = await prisma.product.findUnique({
            where: { sku: params.sku },
          });
          if (!product) {
            throw new Error('Product not found');
          }
          params.productId = product.id;
        } else if (params.slug && !params.productId) {
          const product = await prisma.product.findUnique({
            where: { slug: params.slug },
          });
          if (!product) {
            throw new Error('Product not found');
          }
          params.productId = product.id;
        }
        return await productService.getById(params.productId);
      
      case IntentType.CUSTOMER_ORDER_TRACK:
        if (!userId) {
          throw new Error('Authentication required');
        }
        if (!params.orderId && !params.orderNumber) {
          const latestOrder = await customerService.getLatestOrderForTracking(userId);
          if (!latestOrder) {
            throw new Error('Order not found');
          }
          return latestOrder;
        }
        // Find order by number if ID not provided
        if (params.orderNumber && !params.orderId) {
          const order = await prisma.order.findFirst({
            where: {
              orderNumber: params.orderNumber,
              userId: userId,
            },
          });
          if (!order) {
            throw new Error('Order not found');
          }
          params.orderId = order.id;
        }
        return await customerService.getOrder(userId, params.orderId);
      
      case IntentType.CUSTOMER_ORDER_HISTORY:
        if (!userId) {
          throw new Error('Authentication required');
        }
        return await customerService.getOrders(userId, params.page || 1, params.limit || 20);
      
      case IntentType.CUSTOMER_CART_VIEW:
        // Cart is handled by cart service/store
        return { message: 'Cart functionality will be implemented in frontend' };
      
      case IntentType.CUSTOMER_WISHLIST_VIEW:
        if (!userId) {
          throw new Error('Authentication required');
        }
        return await customerService.getWishlist(userId);
      
      case IntentType.CUSTOMER_STORE_INFO:
        // Return store information
        return {
          name: 'Fashion Store',
          description: 'Premium fashion e-commerce platform',
        };
      
      case IntentType.CUSTOMER_DELIVERY_INFO:
        // Return delivery information
        return {
          methods: ['Courier', 'Pickup', 'Post'],
          costs: 'Varies by location',
        };
      
      case IntentType.CUSTOMER_PAYMENT_INFO:
        // Return payment information
        return {
          methods: ['Card', 'Bank Transfer', 'P2P', 'Cash on delivery'],
        };
      
      case IntentType.HELP:
        return {
          help: true,
          topic: params?.topic,
          message:
            params?.topic === 'ping'
              ? 'I am on the line, the connection is working. I can help with products, delivery and orders.'
              : 'Tell me what you are looking for or what question you have about the order — I will help you with the catalog and order placement.',
        };

      default:
        if (type === IntentType.UNKNOWN) {
          throw new Error(ASSISTANT_UNAVAILABLE_MESSAGE);
        }
        throw new Error(`Action not implemented for intent: ${type}`);
    }
  }

  /**
   * Search products
   */
  private async searchProducts(params: any): Promise<any> {
    const filters: any = {};
    
    if (params.categoryId) filters.categoryId = params.categoryId;
    if (params.brandId) filters.brandId = params.brandId;
    if (params.minPrice) filters.minPrice = parseFloat(params.minPrice);
    if (params.maxPrice) filters.maxPrice = parseFloat(params.maxPrice);
    if (params.search) filters.search = params.search;
    if (params.color) filters.color = params.color;
    if (params.material) filters.material = params.material;

    return await productService.getAll(
      params.page || 1,
      params.limit || 20,
      filters
    );
  }

  private async getMarketingAdvice(params: any): Promise<any> {
    const now = new Date();
    const last14Start = new Date(now);
    last14Start.setDate(now.getDate() - 14);
    const prev14Start = new Date(now);
    prev14Start.setDate(now.getDate() - 28);

    const [
      dashboard,
      activePromos,
      paidOrdersLast14,
      paidOrdersPrev14,
      createdOrdersLast14,
      createdOrdersPrev14,
    ] = await Promise.all([
      adminService.getDashboardStats(),
      promoService.getAll(true),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          paymentStatus: 'PAID' as any,
          createdAt: { gte: last14Start },
        },
      }).catch(() => ({ _sum: { total: null } })),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          paymentStatus: 'PAID' as any,
          createdAt: { gte: prev14Start, lt: last14Start },
        },
      }).catch(() => ({ _sum: { total: null } })),
      prisma.order.count({
        where: {
          createdAt: { gte: last14Start },
        },
      }).catch(() => 0),
      prisma.order.count({
        where: {
          createdAt: { gte: prev14Start, lt: last14Start },
        },
      }).catch(() => 0),
    ]);

    const stats = dashboard?.stats || {};
    const revenueLast14 = Number(paidOrdersLast14?._sum?.total || 0);
    const revenuePrev14 = Number(paidOrdersPrev14?._sum?.total || 0);
    const revenueDelta =
      revenuePrev14 > 0 ? ((revenueLast14 - revenuePrev14) / revenuePrev14) * 100 : null;
    const orderDelta =
      createdOrdersPrev14 > 0
        ? ((createdOrdersLast14 - createdOrdersPrev14) / createdOrdersPrev14) * 100
        : null;

    const recommendations: Array<{ key: string; priority: 'high' | 'medium'; action: string }> = [];

    if (createdOrdersLast14 === 0) {
      recommendations.push({
        key: 'restart-demand',
        priority: 'high',
        action: 'Launch a homepage offer, refresh hero content, and send a win-back message to old customers.',
      });
    }

    if (activePromos.length === 0) {
      recommendations.push({
        key: 'promo-launch',
        priority: 'high',
        action: 'Create a limited promo code for first or repeat orders and place it on the homepage and in messages.',
      });
    }

    if (revenueDelta !== null && revenueDelta < 0) {
      recommendations.push({
        key: 'revenue-drop',
        priority: 'high',
        action: 'Revenue is down versus the previous 14 days. Run a short campaign with urgency: bestseller bundle, deadline, and reminder message.',
      });
    }

    if ((stats.pendingOrders || 0) > 5) {
      recommendations.push({
        key: 'pending-orders',
        priority: 'medium',
        action: 'There are many pending orders. Speed up payment and delivery communication so demand is not lost after checkout.',
      });
    }

    if ((stats.totalProducts || 0) < 12) {
      recommendations.push({
        key: 'small-assortment',
        priority: 'medium',
        action: 'Assortment is still small. Focus on a narrow bestseller offer, bundles, and stronger content instead of broad campaigns.',
      });
    }

    recommendations.push({
      key: 'content-loop',
      priority: 'medium',
      action: 'Prepare three content blocks for the homepage: bestseller proof, clear offer, and social proof or FAQ to reduce hesitation.',
    });

    recommendations.push({
      key: 'retention-loop',
      priority: 'medium',
      action: 'Segment recent customers, abandoned carts, and inactive buyers into separate messages instead of one generic mailing.',
    });

    return {
      marketingAdvice: true,
      topic: params?.topic || 'sales',
      summary: {
        totalOrders: Number(stats.totalOrders || 0),
        totalRevenue: Number(stats.totalRevenue || 0),
        totalCustomers: Number(stats.totalCustomers || 0),
        totalProducts: Number(stats.totalProducts || 0),
        pendingOrders: Number(stats.pendingOrders || 0),
        activePromos: activePromos.length,
        createdOrdersLast14,
        createdOrdersPrev14,
        revenueLast14,
        revenuePrev14,
        revenueDelta,
        orderDelta,
      },
      recommendations,
    };
  }

  /**
   * Create product
   */
  private async createProduct(params: any): Promise<any> {
    // Validate required fields
    if (!params.name) {
      throw new Error('Product name is required');
    }
    if (!params.sku) {
      throw new Error('Product SKU is required');
    }
    if (!params.categoryId && !params.categoryName) {
      throw new Error('Category ID or category name is required');
    }

    // Find category by name if ID not provided
    let categoryId = params.categoryId;
    if (!categoryId && params.categoryName) {
      const category = await prisma.category.findFirst({
        where: {
          name: {
            contains: params.categoryName,
            mode: 'insensitive',
          },
        },
      });
      if (!category) {
        throw new Error(`Category "${params.categoryName}" not found`);
      }
      categoryId = category.id;
    }

    // Find brand by name if provided
    let brandId = params.brandId;
    if (!brandId && params.brandName) {
      const brand = await prisma.brand.findFirst({
        where: {
          name: {
            contains: params.brandName,
            mode: 'insensitive',
          },
        },
      });
      if (brand) {
        brandId = brand.id;
      }
    }

    // Parse sizes if provided as string array
    let sizes: any = null;
    if (params.sizes) {
      if (typeof params.sizes === 'string') {
        // Try to parse as JSON or split by comma
        try {
          sizes = JSON.parse(params.sizes);
        } catch {
          // Split by comma and create sizes object
          const sizeArray = params.sizes.split(',').map((s: string) => s.trim());
          sizes = {
            CLOTHING: sizeArray,
          };
        }
      } else if (Array.isArray(params.sizes)) {
        sizes = {
          CLOTHING: params.sizes,
        };
      } else {
        sizes = params.sizes;
      }
    }

    // Parse colors if provided
    let colors: any = null;
    if (params.colors) {
      if (typeof params.colors === 'string') {
        try {
          colors = JSON.parse(params.colors);
        } catch {
          // Split by comma and create color objects
          const colorArray = params.colors.split(',').map((c: string) => ({
            name: c.trim(),
            hex: '#000000', // Default hex
          }));
          colors = colorArray;
        }
      } else if (Array.isArray(params.colors)) {
        colors = params.colors.map((c: string | any) =>
          typeof c === 'string' ? { name: c, hex: '#000000' } : c
        );
      } else {
        colors = params.colors;
      }
    }

    // Parse product types
    let productTypes: any = null;
    if (params.productTypes) {
      if (typeof params.productTypes === 'string') {
        productTypes = params.productTypes.split(',').map((t: string) => t.trim().toUpperCase());
      } else if (Array.isArray(params.productTypes)) {
        productTypes = params.productTypes.map((t: string) => t.toUpperCase());
      } else {
        productTypes = params.productTypes;
      }
    }

    const productData: CreateProductDto = {
      name: params.name,
      slug: params.slug,
      description: params.description,
      sku: params.sku,
      price: params.price !== undefined && params.price !== null && params.price !== '' ? parseFloat(params.price) : undefined,
      compareAtPrice: params.compareAtPrice !== undefined && params.compareAtPrice !== null && params.compareAtPrice !== '' ? parseFloat(params.compareAtPrice) : undefined,
      priceOnRequest: params.priceOnRequest ?? false,
      categoryId,
      brandId,
      isActive: params.isActive !== undefined ? params.isActive : true,
      isFeatured: params.isFeatured || false,
      productTypes,
      sizes,
      colors,
      material: params.material,
      lining: params.lining,
      countryOfOrigin: params.countryOfOrigin,
      hideColor: params.hideColor || false,
      hideMaterial: params.hideMaterial || false,
      hideLining: params.hideLining || false,
      hideCountryOfOrigin: params.hideCountryOfOrigin || false,
      metaTitle: params.metaTitle,
      metaDescription: params.metaDescription,
      metaKeywords: params.metaKeywords,
    };

    const product = await productService.create(productData);
    return {
      success: true,
      product,
      message: `Product "${product.name}" successfully created`,
    };
  }

  /**
   * Update product
   */
  private async updateProduct(params: any): Promise<any> {
    if (!params.productId && !params.sku) {
      throw new Error('Product ID or SKU is required');
    }

    // Find product by SKU if ID not provided
    let productId = params.productId;
    if (!productId && params.sku) {
      const product = await prisma.product.findUnique({
        where: { sku: params.sku },
      });
      if (!product) {
        throw new Error(`Product with SKU "${params.sku}" not found`);
      }
      productId = product.id;
    }

    // Build update data
    const updateData: UpdateProductDto = {};

    if (params.name) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.price !== undefined) updateData.price = params.price === null || params.price === '' ? undefined : parseFloat(params.price);
    if (params.compareAtPrice !== undefined) updateData.compareAtPrice = params.compareAtPrice === null || params.compareAtPrice === '' ? undefined : parseFloat(params.compareAtPrice);
    if (params.priceOnRequest !== undefined) updateData.priceOnRequest = params.priceOnRequest;
    if (params.isActive !== undefined) updateData.isActive = params.isActive;
    if (params.isFeatured !== undefined) updateData.isFeatured = params.isFeatured;
    if (params.material !== undefined) updateData.material = params.material;
    if (params.lining !== undefined) updateData.lining = params.lining;
    if (params.countryOfOrigin !== undefined) updateData.countryOfOrigin = params.countryOfOrigin;
    if (params.hideLining !== undefined) updateData.hideLining = params.hideLining;

    // Handle category update
    if (params.categoryId) {
      updateData.categoryId = params.categoryId;
    } else if (params.categoryName) {
      const category = await prisma.category.findFirst({
        where: {
          name: {
            contains: params.categoryName,
            mode: 'insensitive',
          },
        },
      });
      if (!category) {
        throw new Error(`Category "${params.categoryName}" not found`);
      }
      updateData.categoryId = category.id;
    }

    // Handle brand update
    if (params.brandId) {
      updateData.brandId = params.brandId;
    } else if (params.brandName) {
      const brand = await prisma.brand.findFirst({
        where: {
          name: {
            contains: params.brandName,
            mode: 'insensitive',
          },
        },
      });
      if (brand) {
        updateData.brandId = brand.id;
      }
    }

    // Handle sizes update
    if (params.sizes !== undefined) {
      if (typeof params.sizes === 'string') {
        try {
          updateData.sizes = JSON.parse(params.sizes);
        } catch {
          const sizeArray = params.sizes.split(',').map((s: string) => s.trim());
          updateData.sizes = {
            CLOTHING: sizeArray,
          };
        }
      } else {
        updateData.sizes = params.sizes;
      }
    }

    // Handle colors update
    if (params.colors !== undefined) {
      if (typeof params.colors === 'string') {
        try {
          updateData.colors = JSON.parse(params.colors);
        } catch {
          const colorArray = params.colors.split(',').map((c: string) => ({
            name: c.trim(),
            hex: '#000000',
          }));
          updateData.colors = colorArray;
        }
      } else {
        updateData.colors = params.colors;
      }
    }

    const product = await productService.update(productId, updateData);
    return {
      success: true,
      product,
      message: `Product "${product.name}" successfully updated`,
    };
  }

  /**
   * Update payment status
   */
  private async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<any> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentRequest: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.paymentRequest) {
      throw new Error('Payment request not found for this order');
    }

    // Use appropriate method based on status
    let updated;
    if (paymentStatus === 'PAID' || paymentStatus === 'paid') {
      updated = await paymentRequestService.markAsPaid(order.paymentRequest.id);
    } else {
      // Use update method for other statuses
      updated = await paymentRequestService.update(
        order.paymentRequest.id,
        { status: paymentStatus as any },
        'system'
      );
    }

    return {
      success: true,
      order: updated.order,
      message: `Payment status of order #${order.orderNumber} updated to "${paymentStatus}"`,
    };
  }

  /**
   * Create payment request
   */
  private async createPaymentRequest(params: any): Promise<any> {
    if (!params.orderId && !params.orderNumber) {
      throw new Error('Order ID or order number is required');
    }

    // Find order by number if ID not provided
    let orderId = params.orderId;
    if (!orderId && params.orderNumber) {
      const order = await prisma.order.findUnique({
        where: { orderNumber: params.orderNumber },
      });
      if (!order) {
        throw new Error('Order not found');
      }
      orderId = order.id;
    }

    const paymentRequest = await paymentRequestService.create(
      {
        orderId,
        bankDetails: params.bankDetails,
        p2pDetails: params.p2pDetails,
      },
      params.updatedBy
    );

    return {
      success: true,
      paymentRequest,
      message: `Payment request for order #${paymentRequest.order.orderNumber} created`,
    };
  }

  /**
   * View payment requests
   */
  private async viewPaymentRequests(params: any): Promise<any> {
    const result = await paymentRequestService.getAll({
      status: params.status,
      orderId: params.orderId,
      limit: 100,
    });

    return {
      success: true,
      paymentRequests: result.requests,
      total: result.pagination.total,
    };
  }

  /**
   * View return requests
   */
  private async viewReturnRequests(params: any): Promise<any> {
    // Return service doesn't have getAll method, so we'll query directly
    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.orderId) {
      where.orderId = params.orderId;
    }

    const returnRequests = await (prisma as any).returnRequest.findMany({
      where,
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      returnRequests,
      total: returnRequests.length,
    };
  }

  /**
   * Process return request (approve/reject)
   */
  private async processReturnRequest(params: any): Promise<any> {
    if (!params.returnRequestId) {
      throw new Error('Return request ID is required');
    }

    const status = params.status || params.action; // 'APPROVED' or 'REJECTED'
    if (!status) {
      throw new Error('Status or action is required');
    }

    if (status === 'APPROVED' || status === 'approve') {
      const result = await returnService.processReturnRequest(
        params.returnRequestId,
        {
          status: 'APPROVED',
          adminNotes: params.notes || params.adminNotes,
          items: (params.items || []).map((it: { returnRequestItemId: string; itemStatus: string; warehouseId?: string }) => ({
            returnRequestItemId: it.returnRequestItemId,
            itemStatus: it.itemStatus as 'WRITE_OFF' | 'RETURN_TO_SALE',
            ...(it.warehouseId && { warehouseId: it.warehouseId }),
          })),
        },
        params.adminId || 'system'
      );

      return {
        success: true,
        returnRequest: result,
        message: `Return #${params.returnRequestId} approved`,
      };
    } else if (status === 'REJECTED' || status === 'reject') {
      const result = await returnService.processReturnRequest(
        params.returnRequestId,
        {
          status: 'REJECTED',
          adminNotes: params.notes || params.rejectionReason,
        },
        params.adminId || 'system'
      );

      return {
        success: true,
        returnRequest: result,
        message: `Return #${params.returnRequestId} rejected`,
      };
    } else {
      throw new Error('Invalid status. Use APPROVED or REJECTED');
    }
  }

  /**
   * Configure payment gateway
   */
  private async configurePaymentGateway(params: any, userId: string | null): Promise<any> {
    if (!params.type) {
      throw new Error('Payment gateway type is required (STRIPE, PAYPAL, YOOKASSA, etc.)');
    }

    // Check if gateway exists
    const existing = await paymentGatewayService.getByType(params.type);
    
    const config: any = {};
    
    // Parse config based on gateway type
    if (params.type === 'STRIPE' || params.type === 'stripe') {
      if (params.apiKey) config.secretKey = params.apiKey;
      if (params.publishableKey) config.publishableKey = params.publishableKey;
      if (params.webhookSecret) config.webhookSecret = params.webhookSecret;
    } else if (params.type === 'PAYPAL' || params.type === 'paypal') {
      if (params.clientId) config.clientId = params.clientId;
      if (params.clientSecret) config.clientSecret = params.clientSecret;
      if (params.mode) config.mode = params.mode; // 'sandbox' or 'live'
    } else if (params.type === 'YOOKASSA' || params.type === 'yookassa') {
      if (params.shopId) config.shopId = params.shopId;
      if (params.secretKey) config.secretKey = params.secretKey;
    } else if (params.type === 'CLOUDPAYMENTS' || params.type === 'cloudpayments') {
      if (params.publicId) config.publicId = params.publicId;
      if (params.apiSecret) config.apiSecret = params.apiSecret;
    } else if (params.type === 'BANK_TRANSFER' || params.type === 'bank_transfer') {
      if (params.accountName) config.accountName = params.accountName;
      if (params.accountNumber) config.accountNumber = params.accountNumber;
      if (params.bankName) config.bankName = params.bankName;
      if (params.swiftCode) config.swiftCode = params.swiftCode;
      if (params.iban) config.iban = params.iban;
    } else if (params.type === 'P2P' || params.type === 'p2p') {
      if (params.cardNumber) config.cardNumber = params.cardNumber;
      if (params.cryptoWallet) config.cryptoWallet = params.cryptoWallet;
      if (params.sbpPhone) config.sbpPhone = params.sbpPhone;
    } else if (params.type === 'CASH_ON_DELIVERY' || params.type === 'cash_on_delivery') {
      if (params.instruction) config.instruction = params.instruction;
    } else if (params.type === 'MANAGER_CHAT' || params.type === 'manager_chat') {
      if (params.managerName) config.managerName = params.managerName;
      if (params.telegramUsername) config.telegramUsername = params.telegramUsername;
      if (params.whatsappNumber) config.whatsappNumber = params.whatsappNumber;
      if (params.wechatLink) config.wechatLink = params.wechatLink;
      if (params.maxLink) config.maxLink = params.maxLink;
      if (params.instruction) config.instruction = params.instruction;
    }

    // Parse supported countries and currencies
    let supportedCountries: string[] = [];
    if (params.supportedCountries) {
      if (typeof params.supportedCountries === 'string') {
        supportedCountries = params.supportedCountries.split(',').map((c: string) => c.trim().toUpperCase());
      } else if (Array.isArray(params.supportedCountries)) {
        supportedCountries = params.supportedCountries.map((c: string) => c.toUpperCase());
      }
    }

    let supportedCurrencies: string[] = [];
    if (params.supportedCurrencies) {
      if (typeof params.supportedCurrencies === 'string') {
        supportedCurrencies = params.supportedCurrencies.split(',').map((c: string) => c.trim().toUpperCase());
      } else if (Array.isArray(params.supportedCurrencies)) {
        supportedCurrencies = params.supportedCurrencies.map((c: string) => c.toUpperCase());
      }
    }

    if (existing) {
      // Update existing gateway
      const updated = await paymentGatewayService.update(
        existing.id,
        {
          name: params.name || existing.name,
          isEnabled: params.isEnabled !== undefined ? params.isEnabled : existing.isEnabled,
          isTestMode: params.isTestMode !== undefined ? params.isTestMode : existing.isTestMode,
          config: Object.keys(config).length > 0 ? config : existing.config,
          supportedCountries: supportedCountries.length > 0 ? supportedCountries : existing.supportedCountries,
          supportedCurrencies: supportedCurrencies.length > 0 ? supportedCurrencies : existing.supportedCurrencies,
        },
        userId || undefined
      );

      return {
        success: true,
        gateway: paymentGatewayService.maskGatewaySecrets(updated),
        message: `Payment system ${updated.name} successfully updated`,
      };
    } else {
      // Create new gateway
      const created = await paymentGatewayService.create(
        {
          type: params.type.toUpperCase(),
          name: params.name || params.type,
          isEnabled: params.isEnabled || false,
          isTestMode: params.isTestMode !== undefined ? params.isTestMode : true,
          config,
          supportedCountries,
          supportedCurrencies,
        },
        userId || undefined
      );

      return {
        success: true,
        gateway: paymentGatewayService.maskGatewaySecrets(created),
        message: `Payment system ${created.name} successfully configured`,
      };
    }
  }

  /**
   * View payment gateways
   */
  private async viewPaymentGateways(params: any): Promise<any> {
    const gateways = await paymentGatewayService.getAll();
    
    // Filter by enabled status if specified
    let filtered = gateways;
    if (params.enabled !== undefined) {
      filtered = gateways.filter(g => g.isEnabled === params.enabled);
    }

    return {
      success: true,
      gateways: paymentGatewayService.maskGatewaySecretsList(filtered),
      total: filtered.length,
    };
  }

  /**
   * Enable/disable payment gateway
   */
  private async enablePaymentGateway(params: any, userId: string | null): Promise<any> {
    if (!params.type && !params.gatewayId) {
      throw new Error('Payment gateway type or ID is required');
    }

    let gateway;
    if (params.gatewayId) {
      gateway = await paymentGatewayService.getById(params.gatewayId);
    } else {
      gateway = await paymentGatewayService.getByType(params.type);
    }

    if (!gateway) {
      throw new Error('Payment gateway not found');
    }

    const enabled = params.enabled !== undefined ? params.enabled : !gateway.isEnabled;
    const updated = await paymentGatewayService.toggleEnabled(gateway.id, enabled, userId || undefined);

    return {
      success: true,
      gateway: paymentGatewayService.maskGatewaySecrets(updated),
      message: `Payment system ${updated.name} ${enabled ? 'enabled' : 'disabled'}`,
    };
  }

  /**
   * Configure delivery service
   */
  private async configureDeliveryService(params: any, userId: string | null): Promise<any> {
    // Delivery tracking is configured via settings
    const settings: Record<string, any> = {};

    if (params.provider) {
      settings.deliveryTrackingProvider = params.provider;
    }
    if (params.apiKey !== undefined) {
      settings.deliveryTrackingApiKey = params.apiKey;
    }
    if (params.apiUrl !== undefined) {
      settings.deliveryTrackingApiUrl = params.apiUrl;
    }
    if (params.enabled !== undefined) {
      settings.deliveryTrackingEnabled = params.enabled;
    }
    if (params.autoMarkNotReceived !== undefined) {
      settings.deliveryTrackingAutoMarkNotReceived = params.autoMarkNotReceived;
    }
    if (params.notReceivedDays !== undefined) {
      settings.deliveryTrackingNotReceivedDays = params.notReceivedDays;
    }

    // Update settings
    for (const [key, value] of Object.entries(settings)) {
      await settingsService.updateSetting(key, value, undefined, userId || undefined);
    }

    // Test connection if API key and URL provided
    let testResult = null;
    if (params.apiKey && params.apiUrl && params.provider) {
      try {
        testResult = await deliveryTrackingService.testConnection(
          params.provider,
          params.apiKey,
          params.apiUrl
        );
      } catch (error) {
        testResult = {
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
        };
      }
    }

    return {
      success: true,
      message: 'Delivery settings updated',
      testResult,
    };
  }

  /**
   * View delivery services
   */
  private async viewDeliveryServices(_params: any): Promise<any> {
    const settings = await settingsService.getAllSettings();
    
    return {
      success: true,
      provider: settings.deliveryTrackingProvider,
      enabled: settings.deliveryTrackingEnabled,
      apiKey: settings.deliveryTrackingApiKey ? '***hidden***' : null,
      apiUrl: settings.deliveryTrackingApiUrl,
      autoMarkNotReceived: settings.deliveryTrackingAutoMarkNotReceived,
      notReceivedDays: settings.deliveryTrackingNotReceivedDays,
    };
  }

  /**
   * Configure email service
   */
  private async configureEmailService(params: any, userId: string | null): Promise<any> {
    const settings: Record<string, any> = {};
    const changedKeys: string[] = [];
    const changedLabels: string[] = [];
    const markChanged = (key: string, label: string, value: any) => {
      settings[key] = value;
      changedKeys.push(key);
      changedLabels.push(label);
    };

    if (params.provider) {
      const provider = params.provider.toUpperCase();
      markChanged('emailProvider', 'provider', provider); // 'RESEND', 'MAILGUN', 'BREVO', 'SENDGRID', 'SMTP', 'CONSOLE'
    }
    
    // Common settings
    if (params.fromEmail !== undefined) {
      markChanged('emailFromEmail', 'from email', params.fromEmail);
    }
    if (params.fromName !== undefined) {
      markChanged('emailFromName', 'from name', params.fromName);
    }
    if (params.enabled !== undefined) {
      markChanged('emailEnabled', 'enabled flag', params.enabled);
    }

    // Provider-specific API keys
    const provider = params.provider?.toUpperCase();
    if (params.apiKey !== undefined) {
      if (provider === 'RESEND') {
        markChanged('emailResendApiKey', 'Resend API key', params.apiKey);
      } else if (provider === 'MAILGUN') {
        markChanged('emailMailgunApiKey', 'Mailgun API key', params.apiKey);
      } else if (provider === 'BREVO') {
        markChanged('emailBrevoApiKey', 'Brevo API key', params.apiKey);
      } else if (provider === 'SENDGRID') {
        markChanged('emailSendgridApiKey', 'SendGrid API key', params.apiKey);
      }
    }

    // Mailgun specific
    if (params.mailgunDomain !== undefined) {
      markChanged('emailMailgunDomain', 'Mailgun domain', params.mailgunDomain);
    }
    if (params.mailgunRegion !== undefined) {
      markChanged('emailMailgunRegion', 'Mailgun region', params.mailgunRegion);
    }

    // SMTP settings
    if (params.smtpHost !== undefined) {
      markChanged('emailNodemailerHost', 'SMTP host', params.smtpHost);
    }
    if (params.smtpPort !== undefined) {
      markChanged('emailNodemailerPort', 'SMTP port', parseInt(params.smtpPort));
    }
    if (params.smtpUser !== undefined) {
      markChanged('emailNodemailerUser', 'SMTP user', params.smtpUser);
    }
    if (params.smtpPassword !== undefined) {
      markChanged('emailNodemailerPassword', 'SMTP password', params.smtpPassword);
    }
    if (params.smtpSecure !== undefined) {
      markChanged('emailNodemailerSecure', 'SMTP secure flag', params.smtpSecure);
    }

    // AWS SES settings
    if (params.awsSesRegion !== undefined) {
      markChanged('emailAwsSesRegion', 'AWS SES region', params.awsSesRegion);
    }
    if (params.awsSesAccessKeyId !== undefined) {
      markChanged('emailAwsSesAccessKeyId', 'AWS SES access key', params.awsSesAccessKeyId);
    }
    if (params.awsSesSecretAccessKey !== undefined) {
      markChanged('emailAwsSesSecretAccessKey', 'AWS SES secret key', params.awsSesSecretAccessKey);
    }

    if (changedKeys.length === 0) {
      throw new Error(
        'Nothing updated: no email parameters were passed. Example: "configure email SMTP host smtp.example.com port 587 user user@example.com password *** fromEmail noreply@example.com fromName Fashion".'
      );  
    }

    // Update settings
    for (const [key, value] of Object.entries(settings)) {
      await settingsService.updateSetting(key, value, undefined, userId || undefined);
    }

    return {
      success: true,
      message: `Email service settings ${provider || ''} updated`,
      changedKeys,
      changedLabels,
      provider: provider || null,
    };
  }

  /**
   * View email service
   */
  private async viewEmailService(_params: any): Promise<any> {
    const settings = await settingsService.getAllSettings();
    
    // Get provider-specific API key
    let apiKey = null;
    const provider = settings.emailProvider;
    if (provider === 'RESEND' && settings.emailResendApiKey) {
      apiKey = '***hidden***';
    } else if (provider === 'MAILGUN' && settings.emailMailgunApiKey) {
      apiKey = '***hidden***';
    } else if (provider === 'BREVO' && settings.emailBrevoApiKey) {
      apiKey = '***hidden***';
    } else if (provider === 'SENDGRID' && settings.emailSendgridApiKey) {
      apiKey = '***hidden***';
    }
    
    return {
      success: true,
      enabled: settings.emailEnabled,
      provider: settings.emailProvider,
      fromEmail: settings.emailFromEmail,
      fromName: settings.emailFromName,
      apiKey,
      mailgunDomain: settings.emailMailgunDomain,
      mailgunRegion: settings.emailMailgunRegion,
      smtpHost: settings.emailNodemailerHost,
      smtpPort: settings.emailNodemailerPort,
      smtpUser: settings.emailNodemailerUser,
      smtpPassword: settings.emailNodemailerPassword ? '***hidden***' : null,
      smtpSecure: settings.emailNodemailerSecure,
      awsSesRegion: settings.emailAwsSesRegion,
      awsSesAccessKeyId: settings.emailAwsSesAccessKeyId ? '***hidden***' : null,
    };
  }

  /**
   * Test email service
   */
  private async testEmailService(params: any): Promise<any> {
    const { emailService } = await import('./email.service');
    const settings = await settingsService.getAllSettings();
    
    const testEmail = params.testEmail || settings.emailFromEmail || 'test@example.com';
    
    try {
      const result = await emailService.sendEmail(
        testEmail,
        'Test Email from GPT Assistant',
        '<p>This is a test email from GPT Assistant.</p>',
        'This is a test email from GPT Assistant.',
        'SYSTEM'
      );

      return {
        success: result.success,
        message: result.success 
          ? `Test email successfully sent to ${testEmail}`
          : `Error sending email: ${result.error || 'Unknown error'}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send test email',
      };
    }
  }

  /**
   * Configure OAuth provider
   */
  private async configureOAuthProvider(params: any, userId: string | null): Promise<any> {
    if (!params.provider) {
      throw new Error('OAuth provider is required (GOOGLE, YANDEX, VKONTAKTE, FACEBOOK, APPLE)');
    }

    let provider = params.provider.toUpperCase();
    // Normalize VK
    if (provider === 'VK') {
      provider = 'VKONTAKTE';
    }

    const settings: Record<string, any> = {};

    // OAuth settings are stored with provider prefix
    if (params.clientId) {
      settings[`oauth${provider}ClientId`] = params.clientId;
    }
    if (params.clientSecret) {
      settings[`oauth${provider}ClientSecret`] = params.clientSecret;
    }
    if (params.enabled !== undefined) {
      settings[`oauth${provider}Enabled`] = params.enabled;
    }
    
    // Apple-specific settings
    if (provider === 'APPLE') {
      if (params.teamId) {
        settings.oauthAppleTeamId = params.teamId;
      }
      if (params.keyId) {
        settings.oauthAppleKeyId = params.keyId;
      }
      if (params.privateKey) {
        settings.oauthApplePrivateKey = params.privateKey;
      }
    }

    // Update settings
    for (const [key, value] of Object.entries(settings)) {
      await settingsService.updateSetting(key, value, undefined, userId || undefined);
    }

    return {
      success: true,
      message: `OAuth provider ${provider} successfully configured`,
    };
  }

  /**
   * View OAuth providers
   */
  private async viewOAuthProviders(_params: any): Promise<any> {
    const settings = await settingsService.getAllSettings();
    const providers = ['GOOGLE', 'YANDEX', 'VK', 'FACEBOOK', 'APPLE'];
    
    const result: any = {};
    for (const provider of providers) {
      const clientId = settings[`oauth${provider}ClientId` as keyof typeof settings];
      const enabled = settings[`oauth${provider}Enabled` as keyof typeof settings];
      
      if (clientId || enabled) {
        result[provider] = {
          enabled: enabled || false,
          clientId: clientId ? '***hidden***' : null,
          hasClientSecret: !!settings[`oauth${provider}ClientSecret` as keyof typeof settings],
        };
      }
    }

    return {
      success: true,
      providers: result,
    };
  }

  /**
   * Enable/disable OAuth provider
   */
  private async enableOAuthProvider(params: any, userId: string | null): Promise<any> {
    if (!params.provider) {
      throw new Error('OAuth provider is required');
    }

    let provider = params.provider.toUpperCase();
    // Normalize VK
    if (provider === 'VK') {
      provider = 'VKONTAKTE';
    }
    
    const enabled = params.enabled !== undefined ? params.enabled : true;
    
    await settingsService.updateSetting(
      `oauth${provider}Enabled`,
      enabled,
      undefined,
      userId || undefined
    );

    return {
      success: true,
      message: `OAuth provider ${provider} ${enabled ? 'enabled' : 'disabled'}`,
    };
  }

  /**
   * View lookbooks
   */
  private async viewLookbooks(params: any): Promise<any> {
    const lookbooks = await lookbookService.getAll(params.activeOnly || false);
    
    return {
      success: true,
      lookbooks,
      total: lookbooks.length,
    };
  }

  /**
   * Create lookbook
   */
  private async createLookbook(params: any): Promise<any> {
    if (!params.title) {
      throw new Error('Lookbook title is required');
    }

    const lookbook = await lookbookService.create({
      title: params.title,
      slug: params.slug,
      description: params.description,
      season: params.season,
      year: params.year ? parseInt(params.year) : undefined,
      isActive: params.isActive !== undefined ? params.isActive : true,
    });

    return {
      success: true,
      lookbook,
      message: `Lookbook "${lookbook.title}" successfully created`,
    };
  }

  /**
   * Update lookbook
   */
  private async updateLookbook(params: any): Promise<any> {
    if (!params.lookbookId && !params.slug) {
      throw new Error('Lookbook ID or slug is required');
    }

    // Find lookbook by slug if ID not provided
    let lookbookId = params.lookbookId;
    if (!lookbookId && params.slug) {
      const lookbook = await prisma.lookbook.findUnique({
        where: { slug: params.slug },
      });
      if (!lookbook) {
        throw new Error('Lookbook not found');
      }
      lookbookId = lookbook.id;
    }

    const lookbook = await lookbookService.update(lookbookId, {
      title: params.title,
      slug: params.slug,
      description: params.description,
      season: params.season,
      year: params.year ? parseInt(params.year) : undefined,
      isActive: params.isActive,
    });

    return {
      success: true,
      lookbook,
      message: `Lookbook "${lookbook.title}" successfully updated`,
    };
  }

  /**
   * View pages
   */
  private async viewPages(params: any): Promise<any> {
    const pages = await pageService.getAllPages(params.activeOnly || false);
    
    return {
      success: true,
      pages,
      total: pages.length,
    };
  }

  /**
   * Create page
   */
  private async createPage(params: any): Promise<any> {
    if (!params.title) {
      throw new Error('Page title is required');
    }
    if (!params.slug) {
      throw new Error('Page slug is required');
    }

    const page = await pageService.createPage({
      slug: params.slug,
      title: params.title,
      content: params.content,
      metaTitle: params.metaTitle,
      metaDescription: params.metaDescription,
      isActive: params.isActive !== undefined ? params.isActive : true,
    });

    return {
      success: true,
      page,
      message: `Page "${page.title}" created successfully`,
    };
  }

  /**
   * Update page
   */
  private async updatePage(params: any): Promise<any> {
    if (!params.pageId && !params.slug) {
      throw new Error('Page ID or slug is required');
    }

    // Find page by slug if ID not provided
    let pageId = params.pageId;
    if (!pageId && params.slug) {
      const page = await prisma.page.findUnique({
        where: { slug: params.slug },
      });
      if (!page) {
        throw new Error('Page not found');
      }
      pageId = page.id;
    }

    const page = await pageService.updatePage(pageId, {
      slug: params.slug,
      title: params.title,
      content: params.content,
      metaTitle: params.metaTitle,
      metaDescription: params.metaDescription,
      isActive: params.isActive,
    });

    return {
      success: true,
      page,
      message: `Page "${page.title}" updated successfully`,
    };
  }

  /**
   * View blog posts
   */
  private async viewBlogPosts(params: any): Promise<any> {
    const posts = await blogService.getAllPosts(params.activeOnly || false);
    
    return {
      success: true,
      posts,
      total: posts.length,
    };
  }

  /**
   * Create blog post
   */
  private async createBlogPost(params: any, userId: string | null): Promise<any> {
    if (!params.title) {
      throw new Error('Blog post title is required');
    }
    if (!params.slug) {
      throw new Error('Blog post slug is required');
    }

    const post = await blogService.createPost({
      slug: params.slug,
      title: params.title,
      excerpt: params.excerpt,
      content: params.content,
      videoUrl: params.videoUrl,
      thumbnailUrl: params.thumbnailUrl,
      type: params.type || 'ARTICLE',
      displayFormat: params.displayFormat || 'AUTO',
      isPublished: params.isPublished || false,
      publishedAt: params.publishedAt ? new Date(params.publishedAt) : undefined,
      metaTitle: params.metaTitle,
      metaDescription: params.metaDescription,
      tags: params.tags ? (Array.isArray(params.tags) ? params.tags : params.tags.split(',').map((t: string) => t.trim())) : [],
      linkedProductIds: params.linkedProductIds || params.productIds || [],
    }, userId || undefined);

    return {
      success: true,
      post,
      message: `Blog post "${post.title}" created successfully`,
    };
  }

  /**
   * Update blog post
   */
  private async updateBlogPost(params: any): Promise<any> {
    if (!params.postId && !params.slug) {
      throw new Error('Blog post ID or slug is required');
    }

    // Find post by slug if ID not provided
    let postId = params.postId;
    if (!postId && params.slug) {
      const post = await prisma.blogPost.findUnique({
        where: { slug: params.slug },
      });
      if (!post) {
        throw new Error('Blog post not found');
      }
      postId = post.id;
    }

    const updateData: any = {};
    if (params.title) updateData.title = params.title;
    if (params.slug) updateData.slug = params.slug;
    if (params.excerpt !== undefined) updateData.excerpt = params.excerpt;
    if (params.content !== undefined) updateData.content = params.content;
    if (params.videoUrl !== undefined) updateData.videoUrl = params.videoUrl;
    if (params.thumbnailUrl !== undefined) updateData.thumbnailUrl = params.thumbnailUrl;
    if (params.type) updateData.type = params.type;
    if (params.isPublished !== undefined) updateData.isPublished = params.isPublished;
    if (params.publishedAt) updateData.publishedAt = new Date(params.publishedAt);
    if (params.metaTitle !== undefined) updateData.metaTitle = params.metaTitle;
    if (params.metaDescription !== undefined) updateData.metaDescription = params.metaDescription;
    if (params.tags !== undefined) {
      updateData.tags = Array.isArray(params.tags) 
        ? params.tags 
        : params.tags.split(',').map((t: string) => t.trim());
    }
    if (params.linkedProductIds !== undefined || params.productIds !== undefined) {
      updateData.linkedProductIds = params.linkedProductIds ?? params.productIds ?? [];
    }

    const post = await blogService.updatePost(postId, updateData);

    return {
      success: true,
      post,
      message: `Blog post "${post.title}" updated successfully`,
    };
  }

  /**
   * Publish blog post
   */
  private async publishBlogPost(params: any): Promise<any> {
    if (!params.postId && !params.slug) {
      throw new Error('Blog post ID or slug is required');
    }

    // Find post by slug if ID not provided
    let postId = params.postId;
    if (!postId && params.slug) {
      const post = await prisma.blogPost.findUnique({
        where: { slug: params.slug },
      });
      if (!post) {
        throw new Error('Blog post not found');
      }
      postId = post.id;
    }

    const post = await blogService.updatePost(postId, {
      isPublished: true,
      publishedAt: params.publishedAt ? new Date(params.publishedAt) : new Date(),
    });

    return {
      success: true,
      post,
      message: `Blog post "${post.title}" published successfully`,
    };
  }

  /**
   * View promo codes
   */
  private async viewPromoCodes(params: any): Promise<any> {
    const promoCodes = await promoService.getAll(params.activeOnly || false);
    
    return {
      success: true,
      promoCodes,
      total: promoCodes.length,
    };
  }

  /**
   * Create promo code
   */
  private async createPromoCode(params: any): Promise<any> {
    // Check if promo code creation is disabled
    const settings = await settingsService.getAllSettings();
    if (settings.promoCodeCreationDisabled) {
      throw new Error('Promo code creation is disabled');
    }

    if (!params.code) {
      throw new Error('Promo code is required');
    }
    if (!params.discountType) {
      throw new Error('Discount type is required (PERCENTAGE, FIXED, BALANCE)');
    }
    if (params.discountValue === undefined) {
      throw new Error('Discount value is required');
    }
    if (!params.validFrom) {
      throw new Error('Valid from date is required');
    }
    if (!params.validUntil) {
      throw new Error('Valid until date is required');
    }

    const promoCode = await promoService.create({
      code: params.code.toUpperCase(),
      description: params.description,
      discountType: params.discountType.toUpperCase(),
      discountValue: parseFloat(params.discountValue),
      minPurchase: params.minPurchase ? parseFloat(params.minPurchase) : undefined,
      maxDiscount: params.maxDiscount ? parseFloat(params.maxDiscount) : undefined,
      usageLimit: params.usageLimit ? parseInt(params.usageLimit) : undefined,
      userId: params.userId,
      validFrom: params.validFrom,
      validUntil: params.validUntil,
      isActive: params.isActive !== undefined ? params.isActive : true,
      isPartnerPromo: params.isPartnerPromo || false,
      partnerId: params.partnerId,
      partnerCommissionRate: params.partnerCommissionRate ? parseFloat(params.partnerCommissionRate) : undefined,
    });

    return {
      success: true,
      promoCode,
      message: `Promo code ${promoCode.code} created successfully`,
    };
  }

  /**
   * Update promo code
   */
  private async updatePromoCode(params: any): Promise<any> {
    if (!params.promoCodeId && !params.code) {
      throw new Error('Promo code ID or code is required');
    }

    // Find promo code by code if ID not provided
    let promoCodeId = params.promoCodeId;
    if (!promoCodeId && params.code) {
      const promoCode = await prisma.promoCode.findUnique({
        where: { code: params.code.toUpperCase() },
      });
      if (!promoCode) {
        throw new Error('Promo code not found');
      }
      promoCodeId = promoCode.id;
    }

    const updateData: any = {};
    if (params.description !== undefined) updateData.description = params.description;
    if (params.discountType) updateData.discountType = params.discountType.toUpperCase();
    if (params.discountValue !== undefined) updateData.discountValue = parseFloat(params.discountValue);
    if (params.minPurchase !== undefined) updateData.minPurchase = params.minPurchase ? parseFloat(params.minPurchase) : null;
    if (params.maxDiscount !== undefined) updateData.maxDiscount = params.maxDiscount ? parseFloat(params.maxDiscount) : null;
    if (params.usageLimit !== undefined) updateData.usageLimit = params.usageLimit ? parseInt(params.usageLimit) : null;
    if (params.validFrom) updateData.validFrom = new Date(params.validFrom);
    if (params.validUntil) updateData.validUntil = new Date(params.validUntil);
    if (params.isActive !== undefined) updateData.isActive = params.isActive;

    const promoCode = await promoService.update(promoCodeId, updateData);

    return {
      success: true,
      promoCode,
      message: `Promo code ${promoCode.code} successfully updated`,
    };
  }

  /**
   * Get promo code statistics
   */
  private async getPromoCodeStats(params: any): Promise<any> {
    if (!params.code && !params.promoCodeId) {
      throw new Error('Promo code ID or code is required');
    }

    // Find promo code
    let promoCode;
    if (params.promoCodeId) {
      promoCode = await promoService.getById(params.promoCodeId);
    } else {
      promoCode = await prisma.promoCode.findUnique({
        where: { code: params.code.toUpperCase() },
      });
    }

    if (!promoCode) {
      throw new Error('Promo code not found');
    }

    return {
      success: true,
      promoCode,
      stats: {
        code: promoCode.code,
        usedCount: promoCode.usedCount,
        usageLimit: promoCode.usageLimit,
        usagePercentage: promoCode.usageLimit 
          ? (promoCode.usedCount / promoCode.usageLimit) * 100 
          : null,
        isActive: promoCode.isActive,
        validFrom: promoCode.validFrom,
        validUntil: promoCode.validUntil,
        isValid: new Date() >= promoCode.validFrom && new Date() <= promoCode.validUntil,
      },
    };
  }

  /**
   * View tickets
   */
  private async viewTickets(params: any): Promise<any> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const filters: any = {};
    
    if (params.status) {
      filters.status = params.status;
    }
    if (params.search) {
      filters.search = params.search;
    }

    const tickets = await ticketService.getAllTickets(page, limit, filters);

    return {
      success: true,
      tickets: tickets.tickets,
      pagination: tickets.pagination,
    };
  }

  /**
   * Create ticket
   */
  private async createTicket(params: any, userId: string | null): Promise<any> {
    if (!params.orderId) {
      throw new Error('Order ID is required');
    }
    if (!params.subject) {
      throw new Error('Subject is required');
    }
    if (!params.message) {
      throw new Error('Message is required');
    }

    // If userId is provided, create ticket for that customer
    // Otherwise, create ticket for the admin's own order (if applicable)
    const customerUserId = params.userId || userId;
    if (!customerUserId) {
      throw new Error('User ID is required');
    }

    const ticket = await ticketService.createTicketForCustomer(
      params.orderId,
      customerUserId,
      userId || 'system',
      params.subject,
      params.message
    );

    return {
      success: true,
      ticket,
      message: `Ticket #${ticket.id} successfully created for the customer`,
    };
  }

  /**
   * Respond to ticket. If autoReply is true, generates reply in the same language as the customer's message.
   */
  private async respondToTicket(params: any, userId: string | null): Promise<any> {
    if (!params.ticketId) {
      throw new Error('Ticket ID is required');
    }

    if (!userId) {
      throw new Error('Admin ID is required');
    }

    let messageToSend = params.message as string | undefined;

    if (params.autoReply && gptApiService.isInitialized()) {
      const ticketDetails = await ticketService.getTicketDetails(params.ticketId);
      const customerMessages = (ticketDetails.messages || []).filter((m: { isAdmin: boolean }) => !m.isAdmin);
      const lastCustomerMessage = customerMessages.length > 0
        ? (customerMessages[customerMessages.length - 1] as { message: string }).message
        : (ticketDetails as { subject?: string }).subject || '';

      if (lastCustomerMessage) {
        const langHint = /[\u0400-\u04FF]/.test(lastCustomerMessage) ? 'Russian' : 'English';
        const systemPrompt = `You are a support agent. Reply to this customer message in the SAME language as the customer (detected: ${langHint}). Be helpful, professional, and concise. Reply only with the message text, no meta-commentary.`;
        const userContent = `Customer message:\n${lastCustomerMessage}`;
        try {
          messageToSend = await gptApiService.chatCompletion(
            [
              { role: 'system', content: systemPrompt, timestamp: new Date() },
              { role: 'user', content: userContent, timestamp: new Date() },
            ],
            { maxTokens: 500, temperature: 0.5 }
          );
        } catch (e) {
          console.error('GPT auto-reply for ticket failed:', e);
        }
      }
    }

    if (!messageToSend || !messageToSend.trim()) {
      throw new Error('Message is required (or enable autoReply when GPT is configured)');
    }

    const ticket = await ticketService.addAdminMessage(
      params.ticketId,
      userId,
      messageToSend.trim()
    );

    return {
      success: true,
      ticket,
      message: `Answer to ticket #${params.ticketId} added`,
      autoReply: !!params.autoReply,
    };
  }

  /**
   * Update ticket status
   */
  private async updateTicketStatus(params: any, userId: string | null): Promise<any> {
    if (!params.ticketId) {
      throw new Error('Ticket ID is required');
    }
    if (!params.status) {
      throw new Error('Status is required');
    }

    if (!userId) {
      throw new Error('Admin ID is required');
    }

    const ticket = await ticketService.updateTicketStatus(
      params.ticketId,
      params.status as any
    );

    return {
      success: true,
      ticket,
      message: `Ticket #${params.ticketId} status updated to "${params.status}"`,
    };
  }

  /**
   * Generate report
   */
  private async generateReport(params: any): Promise<any> {
    const reportType = params.type || params.reportType || 'SALES';
    const startDate = params.startDate ? new Date(params.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = params.endDate ? new Date(params.endDate) : new Date();

    let report: any = {};

    switch (reportType.toUpperCase()) {
      case 'SALES':
      case 'PROДАЖИ': {
        // Sales report
        const orders = await prisma.order.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
            status: {
              not: 'CANCELLED',
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        const totalRevenue = orders.reduce((sum, order) => {
          return sum + Number(order.total || 0);
        }, 0);

        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Top products
        const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
        orders.forEach(order => {
          order.items.forEach(item => {
            const productId = item.productId;
            if (!productSales[productId]) {
              productSales[productId] = {
                name: item.product.name,
                quantity: 0,
                revenue: 0,
              };
            }
            productSales[productId].quantity += item.quantity;
            productSales[productId].revenue += Number(item.price || 0) * item.quantity;
          });
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        report = {
          type: 'SALES',
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          summary: {
            totalOrders,
            totalRevenue,
            avgOrderValue,
          },
          topProducts,
        };
        break;
      }

      case 'PRODUCTS':
      case 'PRODUCTS_REPORT': {
        // Products report
        const products = await prisma.product.findMany({
          include: {
            _count: {
              select: {
                orderItems: true,
              },
            },
          },
        });

        const productsWithSales = products.map(product => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: Number(product.price || 0),
          totalSales: product._count.orderItems,
        }));

        report = {
          type: 'PRODUCTS',
          totalProducts: products.length,
          products: productsWithSales.sort((a, b) => b.totalSales - a.totalSales).slice(0, 20),
        };
        break;
      }

      case 'CUSTOMERS':
      case 'CUSTOMERS_REPORT': {
        // Customers report
        const customers = await prisma.user.findMany({
          where: {
            role: 'CUSTOMER',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            orders: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        });

        const customersWithStats = customers.map(customer => ({
          id: customer.id,
          email: customer.email,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          totalOrders: customer.orders.length,
          totalSpent: customer.orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        }));

        report = {
          type: 'CUSTOMERS',
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          totalCustomers: customers.length,
          customers: customersWithStats.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20),
        };
        break;
      }

      case 'INVENTORY':
      case 'INVENTORY_REPORT': {
        // Inventory report
        const inventory = await prisma.inventory.findMany({
          include: {
            product: true,
            warehouse: true,
          },
        });

        const inventoryByStatus: Record<string, number> = {};
        const inventoryByWarehouse: Record<string, number> = {};

        inventory.forEach(item => {
          inventoryByStatus[item.status] = (inventoryByStatus[item.status] || 0) + item.quantity;
          const warehouseName = item.warehouse?.name || 'Unknown';
          inventoryByWarehouse[warehouseName] = (inventoryByWarehouse[warehouseName] || 0) + item.quantity;
        });

        report = {
          type: 'INVENTORY',
          summary: {
            totalItems: inventory.length,
            totalQuantity: inventory.reduce((sum, item) => sum + item.quantity, 0),
            byStatus: inventoryByStatus,
            byWarehouse: inventoryByWarehouse,
          },
        };
        break;
      }

      case 'ACCOUNTING':
      case 'ACCOUNTING_REPORT':
      case 'ACCOUNTING_REPORT': {
        // Accounting report: revenue, orders, payments, refunds
        const [accOrders, refunds] = await Promise.all([
          prisma.order.findMany({
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: { not: 'CANCELLED' },
            },
            include: {
              items: { include: { product: true } },
            },
          }),
          prisma.returnRequest.findMany({
            where: {
              status: 'APPROVED',
              updatedAt: { gte: startDate, lte: endDate },
            },
            include: { order: true },
          }),
        ]);

        const accTotalRevenue = accOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0);
        const paymentStatusCounts: Record<string, number> = {};
        accOrders.forEach(o => {
          const s = (o.paymentStatus || 'PENDING') as string;
          paymentStatusCounts[s] = (paymentStatusCounts[s] || 0) + 1;
        });

        report = {
          type: 'ACCOUNTING',
          period: { start: startDate.toISOString(), end: endDate.toISOString() },
          summary: {
            totalOrders: accOrders.length,
            totalRevenue: accTotalRevenue,
            totalRefunds,
            netRevenue: accTotalRevenue - totalRefunds,
            byPaymentStatus: paymentStatusCounts,
          },
          refundsCount: refunds.length,
        };
        break;
      }

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    return {
      success: true,
      report,
      message: `Report "${reportType}" successfully generated`,
    };
  }

}

export const actionExecutorService = new ActionExecutorService();
