import prisma from '../config/database';
import { InventoryStatus } from '@prisma/client';

async function resetAllInventory() {
  try {
    console.log('Starting inventory reset...');
    
    const result = await prisma.inventory.updateMany({
      data: {
        quantity: 0,
        reserved: 0,
        status: InventoryStatus.OUT_OF_STOCK,
      },
    });

    console.log(`✅ Successfully reset ${result.count} inventory items`);
    console.log('All quantities set to 0, reserved set to 0, status set to OUT_OF_STOCK');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting inventory:', error);
    process.exit(1);
  }
}

resetAllInventory();
