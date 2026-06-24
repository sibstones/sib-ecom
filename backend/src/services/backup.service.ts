import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import prisma from '../config/database';
import { adminActivityService } from './admin-activity.service';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface BackupData {
  version: string;
  createdAt: string;
  createdBy?: string;
  metadata: {
    totalRecords: number;
    tables: string[];
  };
  data: {
    // Users & Auth
    users: any[];
    sessions: any[];
    adminPermissions: any[];
    adminActivityLogs: any[];
    
    // Products
    categories: any[];
    categoryTranslations: any[];
    brands: any[];
    products: any[];
    productTranslations: any[];
    productImages: any[];
    productVariants: any[];
    
    // Inventory
    warehouses: any[];
    pallets: any[];
    inventory: any[];
    inventoryItems: any[];
    deliveryQRCodes: any[];
    inventoryMovements: any[];
    
    // Orders
    orders: any[];
    orderItems: any[];
    orderStatusHistory: any[];
    
    // Support
    supportTickets: any[];
    supportTicketMessages: any[];
    
    // Lookbook
    lookbooks: any[];
    lookbookTranslations: any[];
    lookbookImages: any[];
    lookbookProductTags: any[];
    
    // Homepage
    homepageSections: any[];
    homepageSectionTranslations: any[];
    
    // Pages
    pages: any[];
    pageTranslations: any[];
    
    // Footer
    footers: any[];
    footerTranslations: any[];
    
    // Customer
    customerAddresses: any[];
    wishlistItems: any[];
    cartItems: any[];
    
    // Admin
    adminNotes: any[];
    
    // Promo Codes
    promoCodes: any[];
    
    // Reviews
    productReviews: any[];
    
    // Loyalty
    loyaltyPoints: any[];
    loyaltyTransactions: any[];
    
    // Email
    emailNotifications: any[];
    
    // Settings
    featureSettings: any[];
    headerSettings: any[];
    countries: any[];
    languages: any[];
    paymentGateways: any[];
    currencyRates: any[];
    
    // Payment Requests
    paymentRequests: any[];
    
    // Returns
    returnRequests: any[];
    returnRequestItems: any[];
    
    // Messenger
    messengerContacts: any[];
    
    // Product Page Design Translations
    productPageDesignTranslations: any[];
  };
}

export class BackupService {
  private ensureBackupDirectory(): string {
    const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  /**
   * Create a complete backup of all database data
   */
  async createBackup(createdBy?: string): Promise<{ filePath: string; fileName: string; size: number }> {
    try {
      console.log('📦 Starting database backup...');

      const backupData: BackupData = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        createdBy,
        metadata: {
          totalRecords: 0,
          tables: [],
        },
        data: {
          // Users & Auth
          users: [],
          sessions: [],
          adminPermissions: [],
          adminActivityLogs: [],
          
          // Products
          categories: [],
          categoryTranslations: [],
          brands: [],
          products: [],
          productTranslations: [],
          productImages: [],
          productVariants: [],
          
          // Inventory
          warehouses: [],
          pallets: [],
          inventory: [],
          inventoryItems: [],
          deliveryQRCodes: [],
          inventoryMovements: [],
          
          // Orders
          orders: [],
          orderItems: [],
          orderStatusHistory: [],
          
          // Support
          supportTickets: [],
          supportTicketMessages: [],
          
          // Lookbook
          lookbooks: [],
          lookbookTranslations: [],
          lookbookImages: [],
          lookbookProductTags: [],
          
          // Homepage
          homepageSections: [],
          homepageSectionTranslations: [],
          
          // Pages
          pages: [],
          pageTranslations: [],
          
          // Footer
          footers: [],
          footerTranslations: [],
          
          // Customer
          customerAddresses: [],
          wishlistItems: [],
          cartItems: [],
          
          // Admin
          adminNotes: [],
          
          // Promo Codes
          promoCodes: [],
          
          // Reviews
          productReviews: [],
          
          // Loyalty
          loyaltyPoints: [],
          loyaltyTransactions: [],
          
          // Email
          emailNotifications: [],
          
          // Settings
          featureSettings: [],
          headerSettings: [],
          countries: [],
          languages: [],
          paymentGateways: [],
          currencyRates: [],
          
          // Payment Requests
          paymentRequests: [],
          
          // Returns
          returnRequests: [],
          returnRequestItems: [],
          
          // Messenger
          messengerContacts: [],
          
          // Product Page Design Translations
          productPageDesignTranslations: [],
        },
      };

      // Fetch all data from database
      console.log('   Fetching data from database...');

      // Users & Auth
      backupData.data.users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.users.length;
      backupData.metadata.tables.push('users');

      backupData.data.sessions = await prisma.session.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.sessions.length;
      backupData.metadata.tables.push('sessions');

      backupData.data.adminPermissions = await prisma.adminPermissions.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.adminPermissions.length;
      backupData.metadata.tables.push('admin_permissions');

      backupData.data.adminActivityLogs = await prisma.adminActivityLog.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.adminActivityLogs.length;
      backupData.metadata.tables.push('admin_activity_logs');

      // Products
      backupData.data.categories = await prisma.category.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.categories.length;
      backupData.metadata.tables.push('categories');

      backupData.data.categoryTranslations = await prisma.categoryTranslation.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.categoryTranslations.length;
      backupData.metadata.tables.push('category_translations');

      backupData.data.brands = await prisma.brand.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.brands.length;
      backupData.metadata.tables.push('brands');

      backupData.data.products = await prisma.product.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.products.length;
      backupData.metadata.tables.push('products');

      backupData.data.productTranslations = await prisma.productTranslation.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.productTranslations.length;
      backupData.metadata.tables.push('product_translations');

      backupData.data.productImages = await prisma.productImage.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.productImages.length;
      backupData.metadata.tables.push('product_images');

      backupData.data.productVariants = await prisma.productVariant.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.productVariants.length;
      backupData.metadata.tables.push('product_variants');

      // Inventory
      backupData.data.warehouses = await prisma.warehouse.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.warehouses.length;
      backupData.metadata.tables.push('warehouses');

      backupData.data.pallets = await prisma.pallet.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.pallets.length;
      backupData.metadata.tables.push('pallets');

      backupData.data.inventory = await prisma.inventory.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.inventory.length;
      backupData.metadata.tables.push('inventory');

      backupData.data.inventoryItems = await prisma.inventoryItem.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.inventoryItems.length;
      backupData.metadata.tables.push('inventory_items');

      backupData.data.deliveryQRCodes = await prisma.deliveryQRCode.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.deliveryQRCodes.length;
      backupData.metadata.tables.push('delivery_qr_codes');

      backupData.data.inventoryMovements = await prisma.inventoryMovement.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.inventoryMovements.length;
      backupData.metadata.tables.push('inventory_movements');

      // Orders
      backupData.data.orders = await prisma.order.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.orders.length;
      backupData.metadata.tables.push('orders');

      backupData.data.orderItems = await prisma.orderItem.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.orderItems.length;
      backupData.metadata.tables.push('order_items');

      backupData.data.orderStatusHistory = await prisma.orderStatusHistory.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.orderStatusHistory.length;
      backupData.metadata.tables.push('order_status_history');

      // Support
      backupData.data.supportTickets = await prisma.supportTicket.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.supportTickets.length;
      backupData.metadata.tables.push('support_tickets');

      backupData.data.supportTicketMessages = await prisma.supportTicketMessage.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.supportTicketMessages.length;
      backupData.metadata.tables.push('support_ticket_messages');

      // Lookbook
      backupData.data.lookbooks = await prisma.lookbook.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.lookbooks.length;
      backupData.metadata.tables.push('lookbooks');

      backupData.data.lookbookTranslations = await prisma.lookbookTranslation.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.lookbookTranslations.length;
      backupData.metadata.tables.push('lookbook_translations');

      backupData.data.lookbookImages = await prisma.lookbookImage.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.lookbookImages.length;
      backupData.metadata.tables.push('lookbook_images');

      backupData.data.lookbookProductTags = await prisma.lookbookProductTag.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.lookbookProductTags.length;
      backupData.metadata.tables.push('lookbook_product_tags');

      // Homepage
      backupData.data.homepageSections = await prisma.homepageSection.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.homepageSections.length;
      backupData.metadata.tables.push('homepage_sections');

      backupData.data.homepageSectionTranslations = await prisma.homepageSectionTranslation.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.homepageSectionTranslations.length;
      backupData.metadata.tables.push('homepage_section_translations');

      // Pages
      backupData.data.pages = await prisma.page.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.pages.length;
      backupData.metadata.tables.push('pages');

      backupData.data.pageTranslations = await prisma.pageTranslation.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.pageTranslations.length;
      backupData.metadata.tables.push('page_translations');

      // Footer
      backupData.data.footers = await prisma.footer.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.footers.length;
      backupData.metadata.tables.push('footers');

      backupData.data.footerTranslations = await prisma.footerTranslation.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.footerTranslations.length;
      backupData.metadata.tables.push('footer_translations');

      // Customer
      backupData.data.customerAddresses = await prisma.customerAddress.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.customerAddresses.length;
      backupData.metadata.tables.push('customer_addresses');

      backupData.data.wishlistItems = await prisma.wishlistItem.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.wishlistItems.length;
      backupData.metadata.tables.push('wishlist_items');

      backupData.data.cartItems = await prisma.cartItem.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.cartItems.length;
      backupData.metadata.tables.push('cart_items');

      // Admin
      backupData.data.adminNotes = await prisma.adminNote.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.adminNotes.length;
      backupData.metadata.tables.push('admin_notes');

      // Promo Codes
      backupData.data.promoCodes = await prisma.promoCode.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.promoCodes.length;
      backupData.metadata.tables.push('promo_codes');

      // Reviews
      backupData.data.productReviews = await prisma.productReview.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.productReviews.length;
      backupData.metadata.tables.push('product_reviews');

      // Loyalty
      backupData.data.loyaltyPoints = await prisma.loyaltyPoints.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.loyaltyPoints.length;
      backupData.metadata.tables.push('loyalty_points');

      backupData.data.loyaltyTransactions = await prisma.loyaltyTransaction.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.loyaltyTransactions.length;
      backupData.metadata.tables.push('loyalty_transactions');

      // Email
      backupData.data.emailNotifications = await prisma.emailNotification.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.emailNotifications.length;
      backupData.metadata.tables.push('email_notifications');

      // Settings
      backupData.data.featureSettings = await prisma.featureSettings.findMany({
        orderBy: { updatedAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.featureSettings.length;
      backupData.metadata.tables.push('feature_settings');

      backupData.data.headerSettings = await prisma.headerSettings.findMany({
        orderBy: { updatedAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.headerSettings.length;
      backupData.metadata.tables.push('header_settings');

      backupData.data.countries = await prisma.country.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.countries.length;
      backupData.metadata.tables.push('countries');

      backupData.data.languages = await prisma.language.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.languages.length;
      backupData.metadata.tables.push('languages');

      backupData.data.paymentGateways = await prisma.paymentGateway.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.paymentGateways.length;
      backupData.metadata.tables.push('payment_gateways');

      backupData.data.currencyRates = await prisma.currencyRate.findMany({
        orderBy: { updatedAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.currencyRates.length;
      backupData.metadata.tables.push('currency_rates');

      // Payment Requests
      backupData.data.paymentRequests = await prisma.paymentRequest.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.paymentRequests.length;
      backupData.metadata.tables.push('payment_requests');

      // Returns
      backupData.data.returnRequests = await prisma.returnRequest.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.returnRequests.length;
      backupData.metadata.tables.push('return_requests');

      backupData.data.returnRequestItems = await prisma.returnRequestItem.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.returnRequestItems.length;
      backupData.metadata.tables.push('return_request_items');

      // Messenger
      backupData.data.messengerContacts = await prisma.messengerContact.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.messengerContacts.length;
      backupData.metadata.tables.push('messenger_contacts');

      // Product Page Design Translations
      backupData.data.productPageDesignTranslations = await prisma.productPageDesignTranslation.findMany({
        orderBy: { createdAt: 'asc' },
      });
      backupData.metadata.totalRecords += backupData.data.productPageDesignTranslations.length;
      backupData.metadata.tables.push('product_page_design_translations');

      console.log(`   ✅ Fetched ${backupData.metadata.totalRecords} records from ${backupData.metadata.tables.length} tables`);

      // Save backup file
      const backupDir = this.ensureBackupDirectory();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
        new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `backup_${timestamp}.json.gz`;
      const filePath = path.join(backupDir, fileName);

      // Compress and save
      const jsonData = JSON.stringify(backupData, null, 2);
      const compressed = await gzip(jsonData);
      fs.writeFileSync(filePath, compressed);

      const size = fs.statSync(filePath).size;

      console.log(`✅ Backup created: ${fileName} (${(size / 1024 / 1024).toFixed(2)} MB)`);

      return {
        filePath,
        fileName,
        size,
      };
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Restore database from backup file
   */
  async restoreBackup(filePath: string, createdBy?: string, options?: { skipUsers?: boolean; skipOrders?: boolean }): Promise<void> {
    try {
      console.log('🔄 Starting database restoration...');

      if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file not found: ${filePath}`);
      }

      // Read and decompress backup file
      const compressed = fs.readFileSync(filePath);
      const decompressed = await gunzip(compressed);
      const backupData: BackupData = JSON.parse(decompressed.toString());

      console.log(`   Backup version: ${backupData.version}`);
      console.log(`   Created at: ${backupData.createdAt}`);
      console.log(`   Total records: ${backupData.metadata.totalRecords}`);
      console.log(`   Tables: ${backupData.metadata.tables.length}`);

      // Start transaction
      await prisma.$transaction(async (tx) => {
        // Delete all existing data in reverse order of dependencies
        console.log('   Clearing existing data...');

        // Delete in reverse dependency order
        await tx.deliveryQRCode.deleteMany();
        await tx.inventoryItem.deleteMany();
        await tx.inventoryMovement.deleteMany();
        await tx.inventory.deleteMany();
        await tx.pallet.deleteMany();
        await tx.warehouse.deleteMany();

        await tx.returnRequestItem.deleteMany();
        await tx.returnRequest.deleteMany();
        await tx.paymentRequest.deleteMany();
        await tx.orderStatusHistory.deleteMany();
        await tx.orderItem.deleteMany();
        await tx.order.deleteMany();

        await tx.supportTicketMessage.deleteMany();
        await tx.supportTicket.deleteMany();

        await tx.lookbookProductTag.deleteMany();
        await tx.lookbookImage.deleteMany();
        await tx.lookbookTranslation.deleteMany();
        await tx.lookbook.deleteMany();

        await tx.homepageSectionTranslation.deleteMany();
        await tx.homepageSection.deleteMany();

        await tx.pageTranslation.deleteMany();
        await tx.page.deleteMany();

        await tx.footerTranslation.deleteMany();
        await tx.footer.deleteMany();

        await tx.productPageDesignTranslation.deleteMany();
        await tx.productReview.deleteMany();
        await tx.productTranslation.deleteMany();
        await tx.productImage.deleteMany();
        await tx.productVariant.deleteMany();
        await tx.product.deleteMany();

        await tx.categoryTranslation.deleteMany();
        await tx.category.deleteMany();
        await tx.brand.deleteMany();

        await tx.cartItem.deleteMany();
        await tx.wishlistItem.deleteMany();
        await tx.customerAddress.deleteMany();

        await tx.loyaltyTransaction.deleteMany();
        await tx.loyaltyPoints.deleteMany();

        await tx.emailNotification.deleteMany();
        await tx.promoCode.deleteMany();
        await tx.adminNote.deleteMany();

        await tx.messengerContact.deleteMany();

        await tx.adminActivityLog.deleteMany();
        await tx.adminPermissions.deleteMany();
        await tx.session.deleteMany();

        // Users - skip if requested
        if (!options?.skipUsers) {
          await tx.user.deleteMany();
        }

        // Settings - keep or restore based on preference
        await tx.currencyRate.deleteMany();
        await tx.paymentGateway.deleteMany();
        await tx.language.deleteMany();
        await tx.country.deleteMany();
        await tx.headerSettings.deleteMany();
        await tx.featureSettings.deleteMany();

        console.log('   ✅ Existing data cleared');

        // Restore data in correct dependency order
        console.log('   Restoring data...');

        // Users & Auth
        if (!options?.skipUsers && backupData.data.users.length > 0) {
          console.log(`   Restoring ${backupData.data.users.length} users...`);
          for (const user of backupData.data.users) {
            await tx.user.create({
              data: {
                id: user.id,
                email: user.email,
                passwordHash: user.passwordHash,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                emailVerified: user.emailVerified,
                isActive: user.isActive,
                createdAt: new Date(user.createdAt),
                updatedAt: new Date(user.updatedAt),
              },
            });
          }
        }

        if (backupData.data.sessions.length > 0) {
          console.log(`   Restoring ${backupData.data.sessions.length} sessions...`);
          for (const session of backupData.data.sessions) {
            await tx.session.create({
              data: {
                id: session.id,
                userId: session.userId,
                token: session.token,
                expiresAt: new Date(session.expiresAt),
                createdAt: new Date(session.createdAt),
              },
            });
          }
        }

        if (backupData.data.adminPermissions.length > 0) {
          console.log(`   Restoring ${backupData.data.adminPermissions.length} admin permissions...`);
          for (const perm of backupData.data.adminPermissions) {
            await tx.adminPermissions.create({
              data: {
                id: perm.id,
                userId: perm.userId,
                canManageSupport: perm.canManageSupport,
                canManageOrders: perm.canManageOrders,
                canManageInventory: perm.canManageInventory,
                canManagePayments: perm.canManagePayments,
                canManageProducts: perm.canManageProducts,
                canManageCategories: perm.canManageCategories,
                canManageBrands: perm.canManageBrands,
                canManageCustomers: perm.canManageCustomers,
                canManagePromoCodes: perm.canManagePromoCodes,
                canManageContent: perm.canManageContent,
                canManageSettings: perm.canManageSettings,
                canViewReports: perm.canViewReports,
                createdAt: new Date(perm.createdAt),
                updatedAt: new Date(perm.updatedAt),
              },
            });
          }
        }

        if (backupData.data.adminActivityLogs.length > 0) {
          console.log(`   Restoring ${backupData.data.adminActivityLogs.length} admin activity logs...`);
          for (const log of backupData.data.adminActivityLogs) {
            await tx.adminActivityLog.create({
              data: {
                id: log.id,
                adminId: log.adminId,
                createdById: log.createdById,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                details: log.details,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                createdAt: new Date(log.createdAt),
              },
            });
          }
        }

        // Settings
        if (backupData.data.featureSettings.length > 0) {
          console.log(`   Restoring ${backupData.data.featureSettings.length} feature settings...`);
          for (const setting of backupData.data.featureSettings) {
            await tx.featureSettings.create({
              data: {
                id: setting.id,
                key: setting.key,
                value: setting.value,
                description: setting.description,
                category: setting.category,
                updatedAt: new Date(setting.updatedAt),
                updatedBy: setting.updatedBy,
              },
            });
          }
        }

        if (backupData.data.headerSettings.length > 0) {
          console.log(`   Restoring ${backupData.data.headerSettings.length} header settings...`);
          for (const setting of backupData.data.headerSettings) {
            await tx.headerSettings.create({
              data: {
                id: setting.id,
                isActive: setting.isActive,
                logoType: setting.logoType,
                logoText: setting.logoText,
                logoImageUrl: setting.logoImageUrl,
                logoSvg: setting.logoSvg,
                logoPosition: setting.logoPosition,
                logoSize: setting.logoSize,
                logoColor: setting.logoColor,
                logoLink: setting.logoLink,
                backgroundColor: setting.backgroundColor,
                textColor: setting.textColor,
                borderColor: setting.borderColor,
                shadowEnabled: setting.shadowEnabled,
                stickyEnabled: setting.stickyEnabled,
                height: setting.height,
                categoryLinksEnabled: setting.categoryLinksEnabled,
                categoryLinksPosition: setting.categoryLinksPosition,
                categoryLinksColor: setting.categoryLinksColor,
                categoryLinksHoverColor: setting.categoryLinksHoverColor,
                categoryLinksActiveColor: setting.categoryLinksActiveColor,
                categoryLinksFontSize: setting.categoryLinksFontSize,
                categoryLinksFontWeight: setting.categoryLinksFontWeight,
                iconsEnabled: setting.iconsEnabled,
                iconsPosition: setting.iconsPosition,
                iconsColor: setting.iconsColor,
                iconsHoverColor: setting.iconsHoverColor,
                iconsSize: setting.iconsSize,
                customIcons: setting.customIcons,
                categoryConditions: setting.categoryConditions,
                navigationBlocks: setting.navigationBlocks,
                createdAt: new Date(setting.createdAt),
                updatedAt: new Date(setting.updatedAt),
                updatedBy: setting.updatedBy,
              },
            });
          }
        }

        if (backupData.data.countries.length > 0) {
          console.log(`   Restoring ${backupData.data.countries.length} countries...`);
          for (const country of backupData.data.countries) {
            await tx.country.create({
              data: {
                id: country.id,
                code: country.code,
                name: country.name,
                nameNative: country.nameNative,
                currency: country.currency,
                language: country.language,
                isActive: country.isActive,
                isDefault: country.isDefault,
                sortOrder: country.sortOrder,
                createdAt: new Date(country.createdAt),
                updatedAt: new Date(country.updatedAt),
              },
            });
          }
        }

        if (backupData.data.languages.length > 0) {
          console.log(`   Restoring ${backupData.data.languages.length} languages...`);
          for (const lang of backupData.data.languages) {
            await tx.language.create({
              data: {
                id: lang.id,
                code: lang.code,
                name: lang.name,
                nameNative: lang.nameNative,
                flag: lang.flag,
                isActive: lang.isActive,
                isDefault: lang.isDefault,
                sortOrder: lang.sortOrder,
                createdAt: new Date(lang.createdAt),
                updatedAt: new Date(lang.updatedAt),
              },
            });
          }
        }

        if (backupData.data.paymentGateways.length > 0) {
          console.log(`   Restoring ${backupData.data.paymentGateways.length} payment gateways...`);
          for (const gateway of backupData.data.paymentGateways) {
            await tx.paymentGateway.create({
              data: {
                id: gateway.id,
                type: gateway.type,
                name: gateway.name,
                isEnabled: gateway.isEnabled,
                isTestMode: gateway.isTestMode,
                config: gateway.config,
                supportedCountries: gateway.supportedCountries,
                supportedCurrencies: gateway.supportedCurrencies,
                sortOrder: gateway.sortOrder,
                createdAt: new Date(gateway.createdAt),
                updatedAt: new Date(gateway.updatedAt),
                updatedBy: gateway.updatedBy,
              },
            });
          }
        }

        if (backupData.data.currencyRates.length > 0) {
          console.log(`   Restoring ${backupData.data.currencyRates.length} currency rates...`);
          for (const rate of backupData.data.currencyRates) {
            await tx.currencyRate.create({
              data: {
                id: rate.id,
                currency: rate.currency,
                rateToUsd: rate.rateToUsd,
                isActive: rate.isActive,
                updatedAt: new Date(rate.updatedAt),
                updatedBy: rate.updatedBy,
              },
            });
          }
        }

        // Categories
        if (backupData.data.categories.length > 0) {
          console.log(`   Restoring ${backupData.data.categories.length} categories...`);
          for (const category of backupData.data.categories) {
            await tx.category.create({
              data: {
                id: category.id,
                name: category.name,
                slug: category.slug,
                description: category.description,
                parentId: category.parentId,
                isMain: category.isMain,
                createdAt: new Date(category.createdAt),
                updatedAt: new Date(category.updatedAt),
              },
            });
          }
        }

        if (backupData.data.categoryTranslations.length > 0) {
          console.log(`   Restoring ${backupData.data.categoryTranslations.length} category translations...`);
          for (const trans of backupData.data.categoryTranslations) {
            await tx.categoryTranslation.create({
              data: {
                id: trans.id,
                categoryId: trans.categoryId,
                languageCode: trans.languageCode,
                name: trans.name,
                description: trans.description,
                createdAt: new Date(trans.createdAt),
                updatedAt: new Date(trans.updatedAt),
              },
            });
          }
        }

        // Brands
        if (backupData.data.brands.length > 0) {
          console.log(`   Restoring ${backupData.data.brands.length} brands...`);
          for (const brand of backupData.data.brands) {
            await tx.brand.create({
              data: {
                id: brand.id,
                name: brand.name,
                slug: brand.slug,
                logo: brand.logo,
                createdAt: new Date(brand.createdAt),
                updatedAt: new Date(brand.updatedAt),
              },
            });
          }
        }

        // Products
        if (backupData.data.products.length > 0) {
          console.log(`   Restoring ${backupData.data.products.length} products...`);
          for (const product of backupData.data.products) {
            await tx.product.create({
              data: {
                id: product.id,
                name: product.name,
                slug: product.slug,
                description: product.description,
                sku: product.sku,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                priceOnRequest: product.priceOnRequest,
                categoryId: product.categoryId,
                brandId: product.brandId,
                isActive: product.isActive,
                isFeatured: product.isFeatured,
                productType: product.productType,
                sizes: product.sizes,
                color: product.color,
                material: product.material,
                lining: product.lining,
                countryOfOrigin: product.countryOfOrigin,
                hideColor: product.hideColor,
                hideMaterial: product.hideMaterial,
                hideLining: product.hideLining,
                hideCountryOfOrigin: product.hideCountryOfOrigin,
                relatedProducts: product.relatedProducts,
                showCompleteTheLook: product.showCompleteTheLook,
                createdAt: new Date(product.createdAt),
                updatedAt: new Date(product.updatedAt),
              },
            });
          }
        }

        if (backupData.data.productTranslations.length > 0) {
          console.log(`   Restoring ${backupData.data.productTranslations.length} product translations...`);
          for (const trans of backupData.data.productTranslations) {
            await tx.productTranslation.create({
              data: {
                id: trans.id,
                productId: trans.productId,
                languageCode: trans.languageCode,
                name: trans.name,
                description: trans.description,
                material: trans.material,
                lining: trans.lining,
                countryOfOrigin: trans.countryOfOrigin,
                createdAt: new Date(trans.createdAt),
                updatedAt: new Date(trans.updatedAt),
              },
            });
          }
        }

        if (backupData.data.productImages.length > 0) {
          console.log(`   Restoring ${backupData.data.productImages.length} product images...`);
          for (const image of backupData.data.productImages) {
            await tx.productImage.create({
              data: {
                id: image.id,
                productId: image.productId,
                url: image.url,
                alt: image.alt,
                order: image.order,
                createdAt: new Date(image.createdAt),
              },
            });
          }
        }

        if (backupData.data.productVariants.length > 0) {
          console.log(`   Restoring ${backupData.data.productVariants.length} product variants...`);
          for (const variant of backupData.data.productVariants) {
            await tx.productVariant.create({
              data: {
                id: variant.id,
                productId: variant.productId,
                name: variant.name,
                sku: variant.sku,
                price: variant.price,
                size: variant.size,
                showOnProduct: variant.showOnProduct,
                createdAt: new Date(variant.createdAt),
                updatedAt: new Date(variant.updatedAt),
              },
            });
          }
        }

        if (backupData.data.productPageDesignTranslations.length > 0) {
          console.log(`   Restoring ${backupData.data.productPageDesignTranslations.length} product page design translations...`);
          for (const trans of backupData.data.productPageDesignTranslations) {
            await tx.productPageDesignTranslation.create({
              data: {
                id: trans.id,
                languageCode: trans.languageCode,
                sizeChartLabels: trans.sizeChartLabels,
                createdAt: new Date(trans.createdAt),
                updatedAt: new Date(trans.updatedAt),
              },
            });
          }
        }

        // Inventory
        if (backupData.data.warehouses.length > 0) {
          console.log(`   Restoring ${backupData.data.warehouses.length} warehouses...`);
          for (const warehouse of backupData.data.warehouses) {
            await tx.warehouse.create({
              data: {
                id: warehouse.id,
                name: warehouse.name,
                address: warehouse.address,
                city: warehouse.city,
                country: warehouse.country,
                type: ((warehouse as { type?: 'MAIN' | 'STORE' | 'MARKETPLACE' }).type ?? 'MAIN') as 'MAIN' | 'STORE' | 'MARKETPLACE',
                priority: (warehouse as { priority?: number }).priority ?? 0,
                isActive: warehouse.isActive,
                createdAt: new Date(warehouse.createdAt),
                updatedAt: new Date(warehouse.updatedAt),
              },
            });
          }
        }

        if (backupData.data.pallets.length > 0) {
          console.log(`   Restoring ${backupData.data.pallets.length} pallets...`);
          for (const pallet of backupData.data.pallets) {
            await tx.pallet.create({
              data: {
                id: pallet.id,
                warehouseId: pallet.warehouseId,
                code: pallet.code,
                location: pallet.location,
                description: pallet.description,
                createdAt: new Date(pallet.createdAt),
                updatedAt: new Date(pallet.updatedAt),
              },
            });
          }
        }

        if (backupData.data.inventory.length > 0) {
          console.log(`   Restoring ${backupData.data.inventory.length} inventory records...`);
          for (const inv of backupData.data.inventory) {
            await tx.inventory.create({
              data: {
                id: inv.id,
                productId: inv.productId,
                variantId: inv.variantId,
                warehouseId: inv.warehouseId,
                quantity: inv.quantity,
                reserved: inv.reserved,
                status: inv.status,
                createdAt: new Date(inv.createdAt),
                updatedAt: new Date(inv.updatedAt),
              },
            });
          }
        }

        if (backupData.data.inventoryItems.length > 0) {
          console.log(`   Restoring ${backupData.data.inventoryItems.length} inventory items...`);
          for (const item of backupData.data.inventoryItems) {
            await tx.inventoryItem.create({
              data: {
                id: item.id,
                inventoryId: item.inventoryId,
                palletId: item.palletId,
                orderId: item.orderId,
                quantity: item.quantity,
                status: item.status,
                notes: item.notes,
                createdAt: new Date(item.createdAt),
                updatedAt: new Date(item.updatedAt),
              },
            });
          }
        }

        if (backupData.data.deliveryQRCodes.length > 0) {
          console.log(`   Restoring ${backupData.data.deliveryQRCodes.length} delivery QR codes...`);
          for (const qr of backupData.data.deliveryQRCodes) {
            await tx.deliveryQRCode.create({
              data: {
                id: qr.id,
                inventoryItemId: qr.inventoryItemId,
                orderId: qr.orderId,
                code: qr.code,
                qrImageUrl: qr.qrImageUrl,
                isUsed: qr.isUsed,
                usedAt: qr.usedAt ? new Date(qr.usedAt) : null,
                createdAt: new Date(qr.createdAt),
              },
            });
          }
        }

        if (backupData.data.inventoryMovements.length > 0) {
          console.log(`   Restoring ${backupData.data.inventoryMovements.length} inventory movements...`);
          for (const movement of backupData.data.inventoryMovements) {
            await tx.inventoryMovement.create({
              data: {
                id: movement.id,
                warehouseId: movement.warehouseId,
                productId: movement.productId,
                variantId: movement.variantId,
                quantity: movement.quantity,
                type: movement.type,
                reason: movement.reason,
                createdAt: new Date(movement.createdAt),
              },
            });
          }
        }

        // Orders - skip if requested
        if (!options?.skipOrders && backupData.data.orders.length > 0) {
          console.log(`   Restoring ${backupData.data.orders.length} orders...`);
          for (const order of backupData.data.orders) {
            await tx.order.create({
              data: {
                id: order.id,
                userId: order.userId,
                orderNumber: order.orderNumber,
                status: order.status,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                paymentGatewayType: order.paymentGatewayType,
                subtotal: order.subtotal,
                tax: order.tax,
                shipping: order.shipping,
                total: order.total,
                shippingAddressId: order.shippingAddressId,
                promoCodeId: order.promoCodeId,
                notes: order.notes,
                createdAt: new Date(order.createdAt),
                updatedAt: new Date(order.updatedAt),
              },
            });
          }
        }

        if (!options?.skipOrders && backupData.data.orderItems.length > 0) {
          console.log(`   Restoring ${backupData.data.orderItems.length} order items...`);
          for (const item of backupData.data.orderItems) {
            await tx.orderItem.create({
              data: {
                id: item.id,
                orderId: item.orderId,
                productId: item.productId,
                variantId: item.variantId,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                createdAt: new Date(item.createdAt),
              },
            });
          }
        }

        if (!options?.skipOrders && backupData.data.orderStatusHistory.length > 0) {
          console.log(`   Restoring ${backupData.data.orderStatusHistory.length} order status history records...`);
          for (const history of backupData.data.orderStatusHistory) {
            await tx.orderStatusHistory.create({
              data: {
                id: history.id,
                orderId: history.orderId,
                status: history.status,
                notes: history.notes,
                createdAt: new Date(history.createdAt),
              },
            });
          }
        }

        // Customer addresses
        if (backupData.data.customerAddresses.length > 0) {
          console.log(`   Restoring ${backupData.data.customerAddresses.length} customer addresses...`);
          for (const address of backupData.data.customerAddresses) {
            await tx.customerAddress.create({
              data: {
                id: address.id,
                userId: address.userId,
                firstName: address.firstName,
                lastName: address.lastName,
                phone: address.phone,
                address: address.address,
                city: address.city,
                country: address.country,
                postalCode: address.postalCode,
                isDefault: address.isDefault,
                createdAt: new Date(address.createdAt),
                updatedAt: new Date(address.updatedAt),
              },
            });
          }
        }

        if (backupData.data.wishlistItems.length > 0) {
          console.log(`   Restoring ${backupData.data.wishlistItems.length} wishlist items...`);
          for (const item of backupData.data.wishlistItems) {
            await tx.wishlistItem.create({
              data: {
                id: item.id,
                userId: item.userId,
                productId: item.productId,
                createdAt: new Date(item.createdAt),
              },
            });
          }
        }

        if (backupData.data.cartItems.length > 0) {
          console.log(`   Restoring ${backupData.data.cartItems.length} cart items...`);
          for (const item of backupData.data.cartItems) {
            await tx.cartItem.create({
              data: {
                id: item.id,
                userId: item.userId,
                sessionId: item.sessionId,
                productId: item.productId,
                variantId: item.variantId,
                size: item.size,
                quantity: item.quantity,
                createdAt: new Date(item.createdAt),
                updatedAt: new Date(item.updatedAt),
              },
            });
          }
        }

        // Support
        if (backupData.data.supportTickets.length > 0) {
          console.log(`   Restoring ${backupData.data.supportTickets.length} support tickets...`);
          for (const ticket of backupData.data.supportTickets) {
            await tx.supportTicket.create({
              data: {
                id: ticket.id,
                orderId: ticket.orderId,
                userId: ticket.userId,
                subject: ticket.subject,
                status: ticket.status,
                adminId: ticket.adminId,
                createdAt: new Date(ticket.createdAt),
                updatedAt: new Date(ticket.updatedAt),
                resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
              },
            });
          }
        }

        if (backupData.data.supportTicketMessages.length > 0) {
          console.log(`   Restoring ${backupData.data.supportTicketMessages.length} support ticket messages...`);
          for (const message of backupData.data.supportTicketMessages) {
            await tx.supportTicketMessage.create({
              data: {
                id: message.id,
                ticketId: message.ticketId,
                userId: message.userId,
                message: message.message,
                isAdmin: message.isAdmin,
                createdAt: new Date(message.createdAt),
              },
            });
          }
        }

        // Lookbook
        if (backupData.data.lookbooks.length > 0) {
          console.log(`   Restoring ${backupData.data.lookbooks.length} lookbooks...`);
          for (const lookbook of backupData.data.lookbooks) {
            await tx.lookbook.create({
              data: {
                id: lookbook.id,
                title: lookbook.title,
                slug: lookbook.slug,
                description: lookbook.description,
                season: lookbook.season,
                year: lookbook.year,
                isActive: lookbook.isActive,
                createdAt: new Date(lookbook.createdAt),
                updatedAt: new Date(lookbook.updatedAt),
              },
            });
          }
        }

        if (backupData.data.lookbookTranslations.length > 0) {
          console.log(`   Restoring ${backupData.data.lookbookTranslations.length} lookbook translations...`);
          for (const trans of backupData.data.lookbookTranslations) {
            await tx.lookbookTranslation.create({
              data: {
                id: trans.id,
                lookbookId: trans.lookbookId,
                languageCode: trans.languageCode,
                title: trans.title,
                description: trans.description,
                createdAt: new Date(trans.createdAt),
                updatedAt: new Date(trans.updatedAt),
              },
            });
          }
        }

        if (backupData.data.lookbookImages.length > 0) {
          console.log(`   Restoring ${backupData.data.lookbookImages.length} lookbook images...`);
          for (const image of backupData.data.lookbookImages) {
            await tx.lookbookImage.create({
              data: {
                id: image.id,
                lookbookId: image.lookbookId,
                url: image.url,
                alt: image.alt,
                order: image.order,
                createdAt: new Date(image.createdAt),
              },
            });
          }
        }

        if (backupData.data.lookbookProductTags.length > 0) {
          console.log(`   Restoring ${backupData.data.lookbookProductTags.length} lookbook product tags...`);
          for (const tag of backupData.data.lookbookProductTags) {
            await tx.lookbookProductTag.create({
              data: {
                id: tag.id,
                lookbookImageId: tag.lookbookImageId,
                productId: tag.productId,
                x: tag.x,
                y: tag.y,
                createdAt: new Date(tag.createdAt),
              },
            });
          }
        }

        // Homepage
        if (backupData.data.homepageSections.length > 0) {
          console.log(`   Restoring ${backupData.data.homepageSections.length} homepage sections...`);
          for (const section of backupData.data.homepageSections) {
            await tx.homepageSection.create({
              data: {
                id: section.id,
                type: section.type,
                title: section.title,
                order: section.order,
                isActive: section.isActive,
                config: section.config,
                createdAt: new Date(section.createdAt),
                updatedAt: new Date(section.updatedAt),
              },
            });
          }
        }

        if (backupData.data.homepageSectionTranslations.length > 0) {
          console.log(`   Restoring ${backupData.data.homepageSectionTranslations.length} homepage section translations...`);
          for (const trans of backupData.data.homepageSectionTranslations) {
            await tx.homepageSectionTranslation.create({
              data: {
                id: trans.id,
                sectionId: trans.sectionId,
                languageCode: trans.languageCode,
                title: trans.title,
                config: trans.config,
                createdAt: new Date(trans.createdAt),
                updatedAt: new Date(trans.updatedAt),
              },
            });
          }
        }

        // Pages
        if (backupData.data.pages.length > 0) {
          console.log(`   Restoring ${backupData.data.pages.length} pages...`);
          for (const page of backupData.data.pages) {
            await tx.page.create({
              data: {
                id: page.id,
                slug: page.slug,
                title: page.title,
                content: page.content,
                metaTitle: page.metaTitle,
                metaDescription: page.metaDescription,
                isActive: page.isActive,
                createdAt: new Date(page.createdAt),
                updatedAt: new Date(page.updatedAt),
              },
            });
          }
        }

        if (backupData.data.pageTranslations.length > 0) {
          console.log(`   Restoring ${backupData.data.pageTranslations.length} page translations...`);
          for (const trans of backupData.data.pageTranslations) {
            await tx.pageTranslation.create({
              data: {
                id: trans.id,
                pageId: trans.pageId,
                languageCode: trans.languageCode,
                title: trans.title,
                content: trans.content,
                metaTitle: trans.metaTitle,
                metaDescription: trans.metaDescription,
                config: trans.config,
                createdAt: new Date(trans.createdAt),
                updatedAt: new Date(trans.updatedAt),
              },
            });
          }
        }

        // Footer
        if (backupData.data.footers.length > 0) {
          console.log(`   Restoring ${backupData.data.footers.length} footers...`);
          for (const footer of backupData.data.footers) {
            await tx.footer.create({
              data: {
                id: footer.id,
                brandName: footer.brandName,
                tagline: footer.tagline,
                columns: footer.columns,
                copyright: footer.copyright,
                links: footer.links,
                isActive: footer.isActive,
                createdAt: new Date(footer.createdAt),
                updatedAt: new Date(footer.updatedAt),
              },
            });
          }
        }

        if (backupData.data.footerTranslations.length > 0) {
          console.log(`   Restoring ${backupData.data.footerTranslations.length} footer translations...`);
          for (const trans of backupData.data.footerTranslations) {
            await tx.footerTranslation.create({
              data: {
                id: trans.id,
                footerId: trans.footerId,
                languageCode: trans.languageCode,
                brandName: trans.brandName,
                tagline: trans.tagline,
                columns: trans.columns,
                copyright: trans.copyright,
                links: trans.links,
                createdAt: new Date(trans.createdAt),
                updatedAt: new Date(trans.updatedAt),
              },
            });
          }
        }

        // Admin Notes
        if (backupData.data.adminNotes.length > 0) {
          console.log(`   Restoring ${backupData.data.adminNotes.length} admin notes...`);
          for (const note of backupData.data.adminNotes) {
            await tx.adminNote.create({
              data: {
                id: note.id,
                userId: note.userId,
                orderId: note.orderId,
                content: note.content,
                createdBy: note.createdBy,
                createdAt: new Date(note.createdAt),
                updatedAt: new Date(note.updatedAt),
              },
            });
          }
        }

        // Promo Codes
        if (backupData.data.promoCodes.length > 0) {
          console.log(`   Restoring ${backupData.data.promoCodes.length} promo codes...`);
          for (const promo of backupData.data.promoCodes) {
            await tx.promoCode.create({
              data: {
                id: promo.id,
                code: promo.code,
                description: promo.description,
                discountType: promo.discountType,
                discountValue: promo.discountValue,
                minPurchase: promo.minPurchase,
                maxDiscount: promo.maxDiscount,
                usageLimit: promo.usageLimit,
                usedCount: promo.usedCount,
                validFrom: new Date(promo.validFrom),
                validUntil: new Date(promo.validUntil),
                isActive: promo.isActive,
                createdAt: new Date(promo.createdAt),
                updatedAt: new Date(promo.updatedAt),
              },
            });
          }
        }

        // Reviews
        if (backupData.data.productReviews.length > 0) {
          console.log(`   Restoring ${backupData.data.productReviews.length} product reviews...`);
          for (const review of backupData.data.productReviews) {
            await tx.productReview.create({
              data: {
                id: review.id,
                productId: review.productId,
                userId: review.userId,
                orderId: review.orderId,
                rating: review.rating,
                title: review.title,
                comment: review.comment,
                isVerified: review.isVerified,
                isPublished: review.isPublished,
                createdAt: new Date(review.createdAt),
                updatedAt: new Date(review.updatedAt),
              },
            });
          }
        }

        // Loyalty
        if (backupData.data.loyaltyPoints.length > 0) {
          console.log(`   Restoring ${backupData.data.loyaltyPoints.length} loyalty points records...`);
          for (const loyalty of backupData.data.loyaltyPoints) {
            await tx.loyaltyPoints.create({
              data: {
                id: loyalty.id,
                userId: loyalty.userId,
                balance: loyalty.balance,
                totalEarned: loyalty.totalEarned,
                totalSpent: loyalty.totalSpent,
                createdAt: new Date(loyalty.createdAt),
                updatedAt: new Date(loyalty.updatedAt),
              },
            });
          }
        }

        if (backupData.data.loyaltyTransactions.length > 0) {
          console.log(`   Restoring ${backupData.data.loyaltyTransactions.length} loyalty transactions...`);
          for (const trans of backupData.data.loyaltyTransactions) {
            await tx.loyaltyTransaction.create({
              data: {
                id: trans.id,
                loyaltyPointsId: trans.loyaltyPointsId,
                orderId: trans.orderId,
                points: trans.points,
                type: trans.type,
                description: trans.description,
                createdAt: new Date(trans.createdAt),
              },
            });
          }
        }

        // Email Notifications
        if (backupData.data.emailNotifications.length > 0) {
          console.log(`   Restoring ${backupData.data.emailNotifications.length} email notifications...`);
          for (const email of backupData.data.emailNotifications) {
            await tx.emailNotification.create({
              data: {
                id: email.id,
                userId: email.userId,
                orderId: email.orderId,
                type: email.type,
                subject: email.subject,
                body: email.body,
                status: email.status,
                sentAt: email.sentAt ? new Date(email.sentAt) : null,
                createdAt: new Date(email.createdAt),
              },
            });
          }
        }

        // Payment Requests
        if (backupData.data.paymentRequests.length > 0) {
          console.log(`   Restoring ${backupData.data.paymentRequests.length} payment requests...`);
          for (const request of backupData.data.paymentRequests) {
            await tx.paymentRequest.create({
              data: {
                id: request.id,
                orderId: request.orderId,
                status: request.status,
                bankDetails: request.bankDetails,
                p2pDetails: request.p2pDetails,
                paymentProof: request.paymentProof,
                adminNotes: request.adminNotes,
                logisticsInfo: request.logisticsInfo,
                notifiedAt: request.notifiedAt ? new Date(request.notifiedAt) : null,
                paidAt: request.paidAt ? new Date(request.paidAt) : null,
                shippedAt: request.shippedAt ? new Date(request.shippedAt) : null,
                createdAt: new Date(request.createdAt),
                updatedAt: new Date(request.updatedAt),
                updatedBy: request.updatedBy,
              },
            });
          }
        }

        // Returns
        if (backupData.data.returnRequests.length > 0) {
          console.log(`   Restoring ${backupData.data.returnRequests.length} return requests...`);
          for (const request of backupData.data.returnRequests) {
            await tx.returnRequest.create({
              data: {
                id: request.id,
                orderId: request.orderId,
                userId: request.userId,
                reason: request.reason,
                status: request.status,
                refundMethod: request.refundMethod,
                refundAmount: request.refundAmount,
                refundProcessedAt: request.refundProcessedAt ? new Date(request.refundProcessedAt) : null,
                pickupMethod: request.pickupMethod,
                pickupAddress: request.pickupAddress,
                pickupDate: request.pickupDate ? new Date(request.pickupDate) : null,
                pickupNotes: request.pickupNotes,
                adminNotes: request.adminNotes,
                customerNotes: request.customerNotes,
                processedBy: request.processedBy,
                createdAt: new Date(request.createdAt),
                updatedAt: new Date(request.updatedAt),
              },
            });
          }
        }

        if (backupData.data.returnRequestItems.length > 0) {
          console.log(`   Restoring ${backupData.data.returnRequestItems.length} return request items...`);
          for (const item of backupData.data.returnRequestItems) {
            await tx.returnRequestItem.create({
              data: {
                id: item.id,
                returnRequestId: item.returnRequestId,
                orderItemId: item.orderItemId,
                quantity: item.quantity,
                replacementProductId: item.replacementProductId,
                replacementVariantId: item.replacementVariantId,
                itemStatus: item.itemStatus,
                warehouseId: item.warehouseId,
                notes: item.notes,
                createdAt: new Date(item.createdAt),
                updatedAt: new Date(item.updatedAt),
              },
            });
          }
        }

        // Messenger Contacts
        if (backupData.data.messengerContacts.length > 0) {
          console.log(`   Restoring ${backupData.data.messengerContacts.length} messenger contacts...`);
          for (const contact of backupData.data.messengerContacts) {
            await tx.messengerContact.create({
              data: {
                id: contact.id,
                userId: contact.userId,
                type: contact.type,
                contactId: contact.contactId,
                username: contact.username,
                isActive: contact.isActive,
                createdAt: new Date(contact.createdAt),
                updatedAt: new Date(contact.updatedAt),
              },
            });
          }
        }

        console.log('   ✅ Data restoration completed');
      });

      // Log restoration activity
      if (createdBy) {
        await adminActivityService.logActivity({
          adminId: createdBy,
          action: 'RESTORE_BACKUP',
          entityType: 'BACKUP',
          details: {
            filePath,
            options,
            backupVersion: backupData.version,
            backupCreatedAt: backupData.createdAt,
          },
        });
      }

      console.log('✅ Database restoration completed successfully!');
    } catch (error) {
      console.error('❌ Error restoring backup:', error);
      throw error;
    }
  }

  /**
   * List all available backup files
   */
  async listBackups(): Promise<Array<{ fileName: string; filePath: string; size: number; createdAt: Date }>> {
    const backupDir = this.ensureBackupDirectory();
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.json.gz'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          filePath,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return files;
  }

  /**
   * Save an uploaded backup file to the backup directory.
   * Used for restoring from external backup (e.g. drag-and-drop).
   */
  saveUploadedBackup(
    buffer: Buffer,
    originalFilename: string
  ): { fileName: string; filePath: string; size: number } {
    const backupDir = this.ensureBackupDirectory();
    const base = originalFilename.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.json\.gz$/i, '') || 'uploaded_backup';
    let fileName = `${base}.json.gz`;
    let filePath = path.join(backupDir, fileName);
    if (fs.existsSync(filePath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      fileName = `${base}_${timestamp}.json.gz`;
      filePath = path.join(backupDir, fileName);
    }
    fs.writeFileSync(filePath, buffer);
    const size = fs.statSync(filePath).size;
    return { fileName, filePath, size };
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(fileName: string): Promise<void> {
    const backupDir = this.ensureBackupDirectory();
    const filePath = path.join(backupDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${fileName}`);
    }

    fs.unlinkSync(filePath);
  }

  /**
   * Get backup file info
   */
  async getBackupInfo(fileName: string): Promise<{ version: string; createdAt: string; createdBy?: string; metadata: any }> {
    const backupDir = this.ensureBackupDirectory();
    const filePath = path.join(backupDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${fileName}`);
    }

    const compressed = fs.readFileSync(filePath);
    const decompressed = await gunzip(compressed);
    const backupData: BackupData = JSON.parse(decompressed.toString());

    return {
      version: backupData.version,
      createdAt: backupData.createdAt,
      createdBy: backupData.createdBy,
      metadata: backupData.metadata,
    };
  }
}

export const backupService = new BackupService();
