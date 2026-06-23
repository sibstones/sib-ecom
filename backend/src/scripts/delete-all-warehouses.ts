import prisma from '../config/database';

async function deleteAllWarehouses() {
  try {
    console.log('🗑️  Starting deletion of all warehouses...\n');
    
    // Get counts before deletion
    const warehousesCount = await prisma.warehouse.count();
    const inventoryCount = await prisma.inventory.count({
      where: {
        warehouse: {
          id: { not: undefined }
        }
      }
    });
    const palletsCount = await prisma.pallet.count();
    const movementsCount = await prisma.inventoryMovement.count();
    
    console.log(`📊 Found:`);
    console.log(`   - Warehouses: ${warehousesCount}`);
    console.log(`   - Inventory items: ${inventoryCount}`);
    console.log(`   - Pallets: ${palletsCount}`);
    console.log(`   - Inventory movements: ${movementsCount}\n`);
    
    if (warehousesCount === 0) {
      console.log('✅ No warehouses to delete.\n');
      process.exit(0);
    }
    
    // Check if any warehouse has inventory
    const warehousesWithInventory = await prisma.warehouse.findMany({
      where: {
        inventory: {
          some: {}
        }
      },
      include: {
        _count: {
          select: {
            inventory: true
          }
        }
      }
    });
    
    if (warehousesWithInventory.length > 0) {
      console.log('⚠️  Warning: Some warehouses contain inventory items:');
      warehousesWithInventory.forEach(wh => {
        console.log(`   - ${wh.name}: ${wh._count.inventory} items`);
      });
      console.log('\n⚠️  These warehouses will be deleted along with their inventory, pallets, and movements.\n');
    }
    
    // Delete in correct order due to foreign key constraints
    console.log('🗑️  Deleting inventory movements...');
    const deletedMovements = await prisma.inventoryMovement.deleteMany({});
    console.log(`   ✅ Deleted ${deletedMovements.count} inventory movements\n`);
    
    console.log('🗑️  Deleting inventory items...');
    const deletedInventoryItems = await prisma.inventoryItem.deleteMany({});
    console.log(`   ✅ Deleted ${deletedInventoryItems.count} inventory items\n`);
    
    console.log('🗑️  Deleting inventory...');
    const deletedInventory = await prisma.inventory.deleteMany({});
    console.log(`   ✅ Deleted ${deletedInventory.count} inventory entries\n`);
    
    console.log('🗑️  Deleting pallets...');
    const deletedPallets = await prisma.pallet.deleteMany({});
    console.log(`   ✅ Deleted ${deletedPallets.count} pallets\n`);
    
    console.log('🗑️  Deleting warehouses...');
    const deletedWarehouses = await prisma.warehouse.deleteMany({});
    console.log(`   ✅ Deleted ${deletedWarehouses.count} warehouses\n`);
    
    console.log('✅ Successfully deleted all warehouses!\n');
    console.log('📊 Summary:');
    console.log(`   - Warehouses: ${deletedWarehouses.count}`);
    console.log(`   - Inventory: ${deletedInventory.count}`);
    console.log(`   - Inventory Items: ${deletedInventoryItems.count}`);
    console.log(`   - Pallets: ${deletedPallets.count}`);
    console.log(`   - Movements: ${deletedMovements.count}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during warehouse deletion:', error);
    process.exit(1);
  }
}

deleteAllWarehouses();
