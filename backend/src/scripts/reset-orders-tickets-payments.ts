import prisma from '../config/database';

async function resetOrdersTicketsPayments() {
  try {
    console.log('Starting cleanup of orders, tickets, and payment requests...');
    
    // Get counts before deletion
    const ordersCount = await prisma.order.count();
    const ticketsCount = await prisma.supportTicket.count();
    const paymentRequestsCount = await prisma.paymentRequest.count();
    const orderItemsCount = await prisma.orderItem.count();
    const orderStatusHistoryCount = await prisma.orderStatusHistory.count();
    const ticketMessagesCount = await prisma.supportTicketMessage.count();
    
    console.log(`Found:`);
    console.log(`  - Orders: ${ordersCount}`);
    console.log(`  - Order Items: ${orderItemsCount}`);
    console.log(`  - Order Status History: ${orderStatusHistoryCount}`);
    console.log(`  - Payment Requests: ${paymentRequestsCount}`);
    console.log(`  - Support Tickets: ${ticketsCount}`);
    console.log(`  - Ticket Messages: ${ticketMessagesCount}`);
    
    // Delete in correct order due to foreign key constraints
    // Note: Some deletions will cascade automatically
    
    // 1. Delete ticket messages first (they reference tickets)
    console.log('\n1. Deleting support ticket messages...');
    const deletedMessages = await prisma.supportTicketMessage.deleteMany({});
    console.log(`   ✅ Deleted ${deletedMessages.count} ticket messages`);
    
    // 2. Delete support tickets (they reference orders)
    console.log('\n2. Deleting support tickets...');
    const deletedTickets = await prisma.supportTicket.deleteMany({});
    console.log(`   ✅ Deleted ${deletedTickets.count} support tickets`);
    
    // 3. Delete payment requests (they reference orders)
    console.log('\n3. Deleting payment requests...');
    const deletedPayments = await prisma.paymentRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedPayments.count} payment requests`);
    
    // 4. Delete order status history (they reference orders, will cascade but let's be explicit)
    console.log('\n4. Deleting order status history...');
    const deletedHistory = await prisma.orderStatusHistory.deleteMany({});
    console.log(`   ✅ Deleted ${deletedHistory.count} order status history entries`);
    
    // 5. Delete order items (they reference orders, will cascade but let's be explicit)
    console.log('\n5. Deleting order items...');
    const deletedItems = await prisma.orderItem.deleteMany({});
    console.log(`   ✅ Deleted ${deletedItems.count} order items`);
    
    // 6. Delete delivery QR codes that reference orders
    // Note: QR codes also reference inventory items, but we'll delete ones linked to orders
    console.log('\n6. Deleting delivery QR codes linked to orders...');
    const deletedQRCodes = await prisma.deliveryQRCode.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    console.log(`   ✅ Deleted ${deletedQRCodes.count} delivery QR codes`);
    
    // 7. Delete inventory items linked to orders
    console.log('\n7. Deleting inventory items linked to orders...');
    const deletedInventoryItems = await prisma.inventoryItem.deleteMany({
      where: {
        orderId: { not: null },
      },
    });
    console.log(`   ✅ Deleted ${deletedInventoryItems.count} inventory items linked to orders`);
    
    // 8. Finally, delete all orders (this will cascade delete remaining related data)
    console.log('\n8. Deleting all orders...');
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`   ✅ Deleted ${deletedOrders.count} orders`);
    
    console.log('\n✅ Successfully cleaned up all orders, tickets, and payment requests!');
    console.log('\nSummary:');
    console.log(`  - Orders: ${deletedOrders.count}`);
    console.log(`  - Order Items: ${deletedItems.count}`);
    console.log(`  - Order Status History: ${deletedHistory.count}`);
    console.log(`  - Payment Requests: ${deletedPayments.count}`);
    console.log(`  - Support Tickets: ${deletedTickets.count}`);
    console.log(`  - Ticket Messages: ${deletedMessages.count}`);
    console.log(`  - Delivery QR Codes: ${deletedQRCodes.count}`);
    console.log(`  - Inventory Items (linked to orders): ${deletedInventoryItems.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up orders, tickets, and payment requests:', error);
    process.exit(1);
  }
}

resetOrdersTicketsPayments();
