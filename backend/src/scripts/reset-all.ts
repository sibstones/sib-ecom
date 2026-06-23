import prisma from '../config/database';
import { InventoryStatus } from '@prisma/client';

async function resetAll() {
  try {
    console.log('🚀 Starting complete database reset...\n');
    
    // ============================================
    // PART 1: Reset Inventory
    // ============================================
    console.log('📦 PART 1: Resetting Inventory...');
    const inventoryResult = await prisma.inventory.updateMany({
      data: {
        quantity: 0,
        reserved: 0,
        status: InventoryStatus.OUT_OF_STOCK,
      },
    });
    console.log(`   ✅ Reset ${inventoryResult.count} inventory items (quantity: 0, reserved: 0, status: OUT_OF_STOCK)\n`);
    
    // ============================================
    // PART 2: Delete Orders, Tickets, Payments
    // ============================================
    console.log('📋 PART 2: Deleting Orders, Tickets, and Payment Requests...');
    
    // Get counts before deletion
    const ordersCount = await prisma.order.count();
    const ticketsCount = await prisma.supportTicket.count();
    const paymentRequestsCount = await prisma.paymentRequest.count();
    
    console.log(`   Found: ${ordersCount} orders, ${ticketsCount} tickets, ${paymentRequestsCount} payment requests`);
    
    // Delete in correct order due to foreign key constraints
    const deletedMessages = await prisma.supportTicketMessage.deleteMany({});
    const deletedTickets = await prisma.supportTicket.deleteMany({});
    const deletedPayments = await prisma.paymentRequest.deleteMany({});
    const deletedHistory = await prisma.orderStatusHistory.deleteMany({});
    const deletedItems = await prisma.orderItem.deleteMany({});
    const deletedQRCodes = await prisma.deliveryQRCode.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    const deletedInventoryItems = await prisma.inventoryItem.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    const deletedOrders = await prisma.order.deleteMany({});
    
    console.log(`   ✅ Deleted:`);
    console.log(`      - ${deletedOrders.count} orders`);
    console.log(`      - ${deletedItems.count} order items`);
    console.log(`      - ${deletedHistory.count} order status history entries`);
    console.log(`      - ${deletedPayments.count} payment requests`);
    console.log(`      - ${deletedTickets.count} support tickets`);
    console.log(`      - ${deletedMessages.count} ticket messages`);
    console.log(`      - ${deletedQRCodes.count} delivery QR codes`);
    console.log(`      - ${deletedInventoryItems.count} inventory items linked to orders\n`);
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('✅ Complete database reset finished successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Inventory: ${inventoryResult.count} items reset`);
    console.log(`   Orders: ${deletedOrders.count} deleted`);
    console.log(`   Tickets: ${deletedTickets.count} deleted`);
    console.log(`   Payment Requests: ${deletedPayments.count} deleted`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during database reset:', error);
    process.exit(1);
  }
}

resetAll();
