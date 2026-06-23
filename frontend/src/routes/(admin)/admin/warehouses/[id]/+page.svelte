<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    adminApi,
    type Warehouse,
    type WarehouseType,
    type InventoryItem,
    type InventoryStatus,
    type Pallet,
    type InventoryItemDetail,
  } from '$lib/api/admin.api';
  import { productApi, type Product } from '$lib/api/product.api';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { formatOrderStatus, formatPaymentStatus } from '$lib/utils/i18n';
  import { getProductImageAlt, getFirstMedia, isVideoUrl } from '$lib/utils/image.utils';

  let warehouse: Warehouse | null = null;
  let inventory: InventoryItem[] = [];
  let pallets: Pallet[] = [];
  let loading = true;
  let error = '';
  let addingInventory = false;
  let products: Product[] = [];
  let loadingProducts = false;
  let selectedProduct: Product | null = null;
  let searchQuery = '';
  let statusFilter: InventoryStatus | '' = '';
  let selectedInventoryItem: InventoryItem | null = null;
  let showingItemDetails = false;
  let palletSearchQuery = '';
  let filteredPallets: Pallet[] = [];
  let expandedGroups: Set<string> = new Set(); // Track expanded product groups
  let activeTab: 'inventory' | 'analytics' = 'inventory';
  let creatingPallet = false;
  let transferringInventory = false;
  let allWarehouses: Warehouse[] = [];
  let editingWarehouse = false;
  let savingWarehouse = false;
  let warehouseEditForm = {
    name: '',
    type: 'MAIN' as WarehouseType,
    priority: 0,
  };

  $: WAREHOUSE_TYPES = [
    { value: 'MAIN' as WarehouseType, label: t('warehouse.typeMain') },
    { value: 'STORE' as WarehouseType, label: t('warehouse.typeStore') },
    { value: 'MARKETPLACE' as WarehouseType, label: t('warehouse.typeMarketplace') },
  ];

  let newPallet = {
    code: '',
    location: '',
    description: '',
  };

  let transferData = {
    fromWarehouseId: '',
    toWarehouseId: '',
    productId: '',
    variantId: '',
    quantity: 1,
  };
  let transferProduct: Product | null = null;
  let transferProductSearchQuery = '';

  $: warehouseId = $page.params.id;

  // Group inventory by product
  $: groupedInventory = inventory.reduce(
    (acc, item) => {
      const productId = item.productId;
      if (!acc[productId]) {
        acc[productId] = {
          product: item.product,
          items: [],
          totalQuantity: 0,
          totalReserved: 0,
        };
      }
      acc[productId].items.push(item);
      acc[productId].totalQuantity += item.quantity;
      acc[productId].totalReserved += item.reserved;
      return acc;
    },
    {} as Record<
      string,
      {
        product: (typeof inventory)[0]['product'];
        items: InventoryItem[];
        totalQuantity: number;
        totalReserved: number;
      }
    >
  );

  // Sort grouped inventory by product name
  $: groupedInventoryArray = Object.values(groupedInventory).sort((a, b) =>
    a.product.name.localeCompare(b.product.name)
  );

  function toggleGroup(productId: string) {
    if (expandedGroups.has(productId)) {
      expandedGroups.delete(productId);
    } else {
      expandedGroups.add(productId);
    }
    expandedGroups = expandedGroups; // Trigger reactivity
  }

  $: statusLabels = {
    AWAITING_RECEIPT: t('warehouse.awaitingReceipt'),
    RECEIVED: t('warehouse.received'),
    IN_SALE: t('warehouse.inSale'),
    COMING_SOON: t('warehouse.comingSoon'),
    RESERVED: t('warehouse.reserved'),
    IN_DELIVERY: t('warehouse.inDelivery'),
    DELIVERED: t('warehouse.delivered'),
    RETURNED: t('warehouse.returned'),
    OUT_OF_STOCK: t('warehouse.outOfStock'),
  };

  const statusColors: Record<InventoryStatus, string> = {
    AWAITING_RECEIPT: 'bg-gray-100 text-gray-800 border border-gray-300',
    RECEIVED: 'bg-gray-200 text-gray-900 border border-gray-400',
    IN_SALE: 'bg-white text-black border border-gray-500',
    COMING_SOON: 'bg-amber-100 text-amber-900 border border-amber-300',
    RESERVED: 'bg-gray-300 text-black border border-gray-600',
    IN_DELIVERY: 'bg-gray-400 text-white border border-gray-700',
    DELIVERED: 'bg-black text-white border border-gray-800',
    RETURNED: 'bg-gray-500 text-white border border-gray-700',
    OUT_OF_STOCK: 'bg-red-100 text-red-800 border border-red-300',
  };

  $: statusOptions = [
    { value: '', label: t('warehouse.allStatuses') },
    ...Object.entries(statusLabels).map(([status, label]) => ({
      value: status,
      label: label,
    })),
  ];

  $: statusSelectOptions = Object.entries(statusLabels).map(([status, label]) => ({
    value: status,
    label: label,
  }));

  let newInventory = {
    productId: '',
    variantId: '',
    quantity: 1,
    reason: '',
    palletId: '',
    documentNumber: '',
    documentDate: '',
    supplierName: '',
    supplierInn: '',
    supplierVatNumber: '',
    customsDeclarationId: '',
    purchasePrice: undefined as number | undefined,
    purchaseCurrency: '',
    receivedAt: '',
    batchNumber: '',
  };

  onMount(async () => {
    await loadWarehouse();
    await loadInventory();
    await loadPallets();
    await loadAllWarehouses();
  });

  async function loadWarehouse() {
    if (!warehouseId) return;
    loading = true;
    try {
      const response = await adminApi.getWarehouseDetails(warehouseId);
      warehouse = response.warehouse;
      warehouseEditForm = {
        name: warehouse?.name ?? '',
        type: (warehouse?.type ?? 'MAIN') as WarehouseType,
        priority: warehouse?.priority ?? 0,
      };
    } catch (e) {
      error = e instanceof Error ? e.message : t('warehouse.failedToLoad');
    } finally {
      loading = false;
    }
  }

  function cancelWarehouseEdit() {
    editingWarehouse = false;
    warehouseEditForm = {
      name: warehouse?.name ?? '',
      type: (warehouse?.type ?? 'MAIN') as WarehouseType,
      priority: warehouse?.priority ?? 0,
    };
  }

  async function saveWarehouseEdit() {
    if (!warehouseId) return;
    savingWarehouse = true;
    try {
      const updated = await adminApi.updateWarehouse(warehouseId, {
        name: warehouseEditForm.name,
        type: warehouseEditForm.type,
        priority: warehouseEditForm.priority,
      });
      warehouse = updated.warehouse;
      editingWarehouse = false;
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('error.failedToSave'));
    } finally {
      savingWarehouse = false;
    }
  }

  async function loadInventory() {
    if (!warehouseId) return;
    try {
      // If on analytics tab, load all inventory without filters
      const filters =
        activeTab === 'analytics'
          ? undefined
          : {
              status: statusFilter || undefined,
              search: searchQuery || undefined,
            };
      const response = await adminApi.getWarehouseInventory(warehouseId, filters);
      inventory = response.inventory;
    } catch (e) {
      console.error('Failed to load inventory', e);
    }
  }

  async function loadPallets() {
    if (!warehouseId) return;
    try {
      const response = await adminApi.getWarehousePallets(warehouseId);
      pallets = response.pallets;
    } catch (e) {
      console.error('Failed to load pallets', e);
    }
  }

  async function loadAllWarehouses() {
    try {
      const response = await adminApi.getAllWarehouses();
      allWarehouses = response.warehouses;
    } catch (e) {
      console.error('Failed to load warehouses', e);
    }
  }

  async function createPallet() {
    if (!warehouseId || !newPallet.code) {
      notificationStore.error(t('warehouse.fillRequiredFields'));
      return;
    }

    try {
      await adminApi.createPallet(warehouseId, {
        code: newPallet.code,
        location: newPallet.location || undefined,
        description: newPallet.description || undefined,
      });
      notificationStore.success(t('warehouse.palletCreated'));
      await loadPallets();
      await loadWarehouse(); // Reload to update pallet count
      creatingPallet = false;
      newPallet = { code: '', location: '', description: '' };
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('warehouse.failedToCreatePallet'));
    }
  }

  async function transferInventory() {
    if (
      !transferData.fromWarehouseId ||
      !transferData.toWarehouseId ||
      !transferData.productId ||
      transferData.quantity <= 0
    ) {
      notificationStore.error(t('warehouse.fillRequiredFields'));
      return;
    }

    try {
      await adminApi.transferInventory({
        fromWarehouseId: transferData.fromWarehouseId,
        toWarehouseId: transferData.toWarehouseId,
        productId: transferData.productId,
        variantId: transferData.variantId || undefined,
        quantity: transferData.quantity,
      });
      notificationStore.success(t('warehouse.inventoryTransferred'));
      await loadInventory();
      transferringInventory = false;
      transferData = {
        fromWarehouseId: '',
        toWarehouseId: '',
        productId: '',
        variantId: '',
        quantity: 1,
      };
      transferProduct = null;
      transferProductSearchQuery = '';
      products = [];
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('warehouse.failedToTransferInventory')
      );
    }
  }

  async function loadProducts(search: string = '') {
    if (search.length < 2) {
      products = [];
      return;
    }
    loadingProducts = true;
    try {
      const response = await adminApi.getAllProducts(1, 50, search);
      products = response.products;
    } catch (e) {
      console.error('Failed to load products', e);
      products = [];
    } finally {
      loadingProducts = false;
    }
  }

  async function selectProduct(product: Product) {
    try {
      const response = await productApi.getById(product.id);
      selectedProduct = response.product;
      newInventory.productId = selectedProduct.id;
      newInventory.variantId = '';
      products = [];
    } catch (e) {
      console.error('Failed to load product details', e);
      selectedProduct = product;
      newInventory.productId = product.id;
      newInventory.variantId = '';
      products = [];
    }
  }

  async function addInventory() {
    if (!warehouseId || !newInventory.productId || newInventory.quantity <= 0) {
      notificationStore.error(t('warehouse.fillRequiredFields'));
      return;
    }

    try {
      await adminApi.addInventory(warehouseId, {
        productId: newInventory.productId,
        variantId: newInventory.variantId || undefined,
        quantity: newInventory.quantity,
        reason: newInventory.reason || undefined,
        palletId: newInventory.palletId || undefined,
        documentNumber: newInventory.documentNumber || undefined,
        documentDate: newInventory.documentDate || undefined,
        supplierName: newInventory.supplierName || undefined,
        supplierInn: newInventory.supplierInn || undefined,
        supplierVatNumber: newInventory.supplierVatNumber || undefined,
        customsDeclarationId: newInventory.customsDeclarationId || undefined,
        purchasePrice: newInventory.purchasePrice,
        purchaseCurrency: newInventory.purchaseCurrency || undefined,
        receivedAt: newInventory.receivedAt || undefined,
        batchNumber: newInventory.batchNumber || undefined,
      });
      await loadInventory();
      addingInventory = false;
      newInventory = {
        productId: '',
        variantId: '',
        quantity: 1,
        reason: '',
        palletId: '',
        documentNumber: '',
        documentDate: '',
        supplierName: '',
        supplierInn: '',
        supplierVatNumber: '',
        customsDeclarationId: '',
        purchasePrice: undefined,
        purchaseCurrency: '',
        receivedAt: '',
        batchNumber: '',
      };
      selectedProduct = null;
      palletSearchQuery = '';
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('warehouse.failedToAddInventory'));
    }
  }

  async function updateStatus(inventoryId: string, status: InventoryStatus) {
    try {
      await adminApi.updateInventoryStatus(inventoryId, status);
      await loadInventory();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('warehouse.failedToUpdateStatus'));
    }
  }

  function handleStatusChange(itemId: string, event: CustomEvent<{ value: string | number }>) {
    const status = event.detail.value as InventoryStatus;
    updateStatus(itemId, status);
  }

  function handleFilterStatusChange(event: CustomEvent<{ value: string | number }>) {
    statusFilter = (event.detail.value as InventoryStatus) || '';
  }

  $: if ((searchQuery || statusFilter) && activeTab === 'inventory') {
    loadInventory();
  }

  $: filteredPallets = pallets.filter((pallet) => {
    if (!palletSearchQuery) return true;
    const query = palletSearchQuery.toLowerCase();
    return (
      pallet.code.toLowerCase().includes(query) ||
      (pallet.location && pallet.location.toLowerCase().includes(query))
    );
  });

  // Calculate warehouse analytics
  $: warehouseAnalytics = (() => {
    let totalStock = 0;
    let awaitingPayment = 0;
    let paid = 0;
    let returned = 0;
    let currentStock = 0;

    // Calculate analytics from inventory
    inventory.forEach((item) => {
      const available = item.quantity - item.reserved;
      totalStock += item.quantity;
      currentStock += available;

      // Count reserved items (in cart, awaiting payment)
      awaitingPayment += item.reserved;

      // Count by status from inventory items
      if (item.items) {
        item.items.forEach((invItem) => {
          if (invItem.status === 'IN_DELIVERY' || invItem.status === 'DELIVERED') {
            paid += invItem.quantity || 1;
          } else if (invItem.status === 'RETURNED') {
            returned += invItem.quantity || 1;
          }
        });
      }
    });

    return {
      totalStock,
      awaitingPayment,
      paid,
      returned,
      currentStock,
    };
  })();

  // Calculate status leaders (top products by status)
  $: statusLeaders = (() => {
    const leadersByStatus: Record<
      InventoryStatus,
      Array<{ product: (typeof inventory)[0]['product']; quantity: number; reserved: number }>
    > = {
      AWAITING_RECEIPT: [],
      RECEIVED: [],
      IN_SALE: [],
      COMING_SOON: [],
      RESERVED: [],
      IN_DELIVERY: [],
      DELIVERED: [],
      RETURNED: [],
      OUT_OF_STOCK: [],
    };

    // Group by product and status (considering both inventory status and items status)
    const productStatusMap = new Map<string, Map<InventoryStatus, number>>();

    inventory.forEach((item) => {
      const productId = item.productId;
      if (!productStatusMap.has(productId)) {
        productStatusMap.set(productId, new Map());
      }
      const statusMap = productStatusMap.get(productId)!;

      // Count by inventory items status if available, otherwise use inventory status
      if (item.items && item.items.length > 0) {
        item.items.forEach((invItem) => {
          const qty = invItem.quantity || 1;
          const currentQty = statusMap.get(invItem.status) || 0;
          statusMap.set(invItem.status, currentQty + qty);
        });
      } else {
        // Fallback to inventory status if no items
        const currentQty = statusMap.get(item.status) || 0;
        statusMap.set(item.status, currentQty + item.quantity);
      }
    });

    // Build leaders array
    productStatusMap.forEach((statusMap, productId) => {
      const product = inventory.find((item) => item.productId === productId)?.product;
      if (!product) return;

      statusMap.forEach((quantity, status) => {
        const productGroup = groupedInventory[productId];
        leadersByStatus[status].push({
          product,
          quantity,
          reserved: productGroup?.totalReserved || 0,
        });
      });
    });

    // Sort each status by quantity (descending) and take top 5
    Object.keys(leadersByStatus).forEach((status) => {
      leadersByStatus[status as InventoryStatus].sort((a, b) => b.quantity - a.quantity);
      leadersByStatus[status as InventoryStatus] = leadersByStatus[status as InventoryStatus].slice(
        0,
        5
      );
    });

    return leadersByStatus;
  })();

  // Convert statusLeaders to array format for easier iteration
  $: statusLeadersArray = Object.entries(statusLeaders).map(([status, leaders]) => ({
    status: status as InventoryStatus,
    leaders,
  }));
</script>

<div class="space-y-6">
  <!-- Back Button -->
  <button
    on:click={() => goto('/admin/warehouses')}
    class="flex items-center gap-2 text-accent-muted hover:text-accent transition-colors"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
    {t('warehouse.backToWarehouses')}
  </button>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('common.error')}: {error}</p>
  {:else if warehouse}
    <!-- Warehouse Information Section -->
    <div class="bg-dark-light p-8 border border-dark">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div class="flex-1">
          {#if editingWarehouse}
            <div class="space-y-4">
              <div>
                <label for="warehouse-name" class="block text-sm font-medium mb-1"
                  >{t('common.name')} *</label
                >
                <input
                  id="warehouse-name"
                  type="text"
                  bind:value={warehouseEditForm.name}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="warehouse-type" class="block text-sm font-medium mb-1"
                    >{t('warehouse.type')}</label
                  >
                  <select
                    id="warehouse-type"
                    bind:value={warehouseEditForm.type}
                    class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  >
                    {#each WAREHOUSE_TYPES as opt}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label for="warehouse-priority" class="block text-sm font-medium mb-1"
                    >{t('warehouse.priority')}</label
                  >
                  <input
                    id="warehouse-priority"
                    type="number"
                    min="-128"
                    max="127"
                    bind:value={warehouseEditForm.priority}
                    class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  />
                </div>
              </div>
              <div class="flex gap-3">
                <button
                  on:click={saveWarehouseEdit}
                  disabled={savingWarehouse}
                  class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
                >
                  {savingWarehouse ? t('common.saving') : t('common.save')}
                </button>
                <button
                  on:click={cancelWarehouseEdit}
                  class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          {:else}
            <div class="flex items-center gap-3 mb-3">
              <h1 class="text-4xl font-bold">{warehouse.name}</h1>
              <button
                on:click={() => (editingWarehouse = true)}
                class="text-sm text-accent-muted hover:text-accent transition-colors"
                title={t('warehouse.editWarehouse')}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            </div>
            <div class="flex items-center gap-2 mb-2">
              <span
                class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded {warehouse.type ===
                'MAIN'
                  ? 'bg-amber-100 text-amber-800'
                  : warehouse.type === 'STORE'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'}"
              >
                {warehouse.type === 'MAIN'
                  ? t('warehouse.typeMain')
                  : warehouse.type === 'STORE'
                    ? t('warehouse.typeStore')
                    : t('warehouse.typeMarketplace')}
              </span>
              {#if (warehouse.priority ?? 0) !== 0}
                <span class="text-sm text-accent-muted"
                  >{t('warehouse.priority')}: {warehouse.priority ?? 0}</span
                >
              {/if}
            </div>
          {/if}
          <div class="space-y-2 text-accent-muted">
            {#if warehouse.city || warehouse.country}
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p class="text-lg">
                  {warehouse.city}{warehouse.city && warehouse.country
                    ? ', '
                    : ''}{warehouse.country}
                </p>
              </div>
            {/if}
            {#if warehouse.address}
              <p class="text-sm">{warehouse.address}</p>
            {/if}
          </div>
        </div>
        <div class="flex gap-6">
          {#if warehouse._count}
            <div class="text-center">
              <p class="text-3xl font-bold">{warehouse._count.inventory || 0}</p>
              <p class="text-sm text-accent-muted mt-1">{t('warehouse.items')}</p>
            </div>
            {#if warehouse._count.pallets !== undefined}
              <div class="text-center">
                <p class="text-3xl font-bold">{warehouse._count.pallets || 0}</p>
                <p class="text-sm text-accent-muted mt-1">{t('warehouse.pallets')}</p>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>

    <!-- Inventory Section -->
    <div class="bg-dark-light p-6 border border-dark space-y-6">
      <!-- Tabs -->
      <div class="flex gap-1 p-2 bg-gray-100 rounded-lg overflow-x-auto mb-6">
        <button
          type="button"
          on:click={async () => {
            activeTab = 'inventory';
            await loadInventory();
          }}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={activeTab === 'inventory'}
          class:shadow-sm={activeTab === 'inventory'}
          class:text-accent={activeTab === 'inventory'}
          class:text-gray-600={activeTab !== 'inventory'}
          class:hover:bg-gray-50={activeTab !== 'inventory'}
          class:hover:text-gray-900={activeTab !== 'inventory'}
        >
          {t('warehouse.inventory')}
        </button>
        <button
          type="button"
          on:click={async () => {
            activeTab = 'analytics';
            await loadInventory();
          }}
          class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md"
          class:bg-white={activeTab === 'analytics'}
          class:shadow-sm={activeTab === 'analytics'}
          class:text-accent={activeTab === 'analytics'}
          class:text-gray-600={activeTab !== 'analytics'}
          class:hover:bg-gray-50={activeTab !== 'analytics'}
          class:hover:text-gray-900={activeTab !== 'analytics'}
        >
          {t('warehouse.analytics')}
        </button>
      </div>

      {#if activeTab === 'inventory'}
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 class="text-2xl font-bold">{t('warehouse.inventory')}</h2>
          <div class="flex flex-wrap gap-2">
            {#if !addingInventory && !creatingPallet && !transferringInventory}
              <button
                on:click={() => (creatingPallet = true)}
                class="px-4 py-2 text-sm bg-accent text-dark hover:bg-accent-muted transition-colors font-medium flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                {t('warehouse.createPallet')}
              </button>
              <button
                on:click={() => (transferringInventory = true)}
                class="px-4 py-2 text-sm bg-accent text-dark hover:bg-accent-muted transition-colors font-medium flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                {t('warehouse.transferInventory')}
              </button>
              <button
                on:click={() => (addingInventory = true)}
                class="px-4 py-2 text-sm bg-accent text-dark hover:bg-accent-muted transition-colors font-medium flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t('warehouse.addInventory')}
              </button>
            {/if}
          </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1 relative">
            <svg
              class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={t('warehouse.searchProducts')}
              bind:value={searchQuery}
              class="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
          <div class="w-full sm:w-64" style="position: relative; z-index: 10;">
            <CustomSelect
              bind:value={statusFilter}
              options={statusOptions}
              placeholder={t('warehouse.allStatuses')}
              on:change={handleFilterStatusChange}
              className="w-full"
            />
          </div>
        </div>

        <!-- Create Pallet Form -->
        {#if creatingPallet}
          <div class="bg-dark p-6 border border-dark space-y-5">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-bold">{t('warehouse.createPallet')}</h3>
              <button
                aria-label={t('common.close')}
                on:click={() => {
                  creatingPallet = false;
                  newPallet = { code: '', location: '', description: '' };
                }}
                class="text-accent-muted hover:text-accent transition-colors"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- Pallet Code -->
            <div>
              <label for="new-pallet-code" class="block text-sm font-medium mb-2"
                >{t('warehouse.palletCode')} *</label
              >
              <input
                id="new-pallet-code"
                type="text"
                placeholder={t('warehouse.palletCodePlaceholder')}
                bind:value={newPallet.code}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>

            <!-- Location -->
            <div>
              <label for="new-pallet-location" class="block text-sm font-medium mb-2"
                >{t('warehouse.location')} ({t('common.optional')})</label
              >
              <input
                id="new-pallet-location"
                type="text"
                placeholder={t('warehouse.locationPlaceholder')}
                bind:value={newPallet.location}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>

            <!-- Description -->
            <div>
              <label for="new-pallet-description" class="block text-sm font-medium mb-2"
                >{t('warehouse.description')} ({t('common.optional')})</label
              >
              <textarea
                id="new-pallet-description"
                placeholder={t('warehouse.descriptionPlaceholder')}
                bind:value={newPallet.description}
                rows="3"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              ></textarea>
            </div>

            <div class="flex gap-3 pt-2">
              <button
                on:click={createPallet}
                class="px-6 py-2.5 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium"
              >
                {t('common.create')}
              </button>
              <button
                on:click={() => {
                  creatingPallet = false;
                  newPallet = { code: '', location: '', description: '' };
                }}
                class="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Transfer Inventory Form -->
        {#if transferringInventory}
          <div class="bg-dark p-6 border border-dark space-y-5">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-bold">{t('warehouse.transferInventory')}</h3>
              <button
                aria-label={t('common.close')}
                on:click={() => {
                  transferringInventory = false;
                  transferData = {
                    fromWarehouseId: '',
                    toWarehouseId: '',
                    productId: '',
                    variantId: '',
                    quantity: 1,
                  };
                  transferProduct = null;
                  transferProductSearchQuery = '';
                  products = [];
                }}
                class="text-accent-muted hover:text-accent transition-colors"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- From Warehouse -->
            <div>
              <label for="transfer-from-warehouse" class="block text-sm font-medium mb-2"
                >{t('warehouse.fromWarehouse')} *</label
              >
              <select
                id="transfer-from-warehouse"
                bind:value={transferData.fromWarehouseId}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">{t('warehouse.selectWarehouse')}</option>
                {#each allWarehouses as wh}
                  <option value={wh.id}>{wh.name} {wh.city ? `(${wh.city})` : ''}</option>
                {/each}
              </select>
            </div>

            <!-- To Warehouse -->
            <div>
              <label for="transfer-to-warehouse" class="block text-sm font-medium mb-2"
                >{t('warehouse.toWarehouse')} *</label
              >
              <select
                id="transfer-to-warehouse"
                bind:value={transferData.toWarehouseId}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">{t('warehouse.selectWarehouse')}</option>
                {#each allWarehouses as wh}
                  <option value={wh.id}>{wh.name} {wh.city ? `(${wh.city})` : ''}</option>
                {/each}
              </select>
            </div>

            <!-- Product Search -->
            <div class="relative">
              <label for="transfer-product-search" class="block text-sm font-medium mb-2"
                >{t('warehouse.product')} *</label
              >
              {#if !transferProduct}
                <div class="relative">
                  <input
                    id="transfer-product-search"
                    type="text"
                    placeholder={t('warehouse.searchProductsOrSku')}
                    bind:value={transferProductSearchQuery}
                    class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                    on:input={(e) => {
                      transferProductSearchQuery = e.currentTarget.value;
                      if (transferProductSearchQuery.length >= 2) {
                        loadProducts(transferProductSearchQuery);
                      } else {
                        products = [];
                      }
                    }}
                  />
                  {#if loadingProducts}
                    <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <svg
                        class="animate-spin h-5 w-5 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </div>
                  {/if}
                  {#if products.length > 0 && transferProductSearchQuery.length >= 2}
                    <div
                      class="absolute z-20 w-full mt-1 bg-white border border-gray-300 shadow-lg max-h-80 overflow-y-auto rounded-md"
                    >
                      {#each products as product}
                        {@const firstMedia = getFirstMedia(product.images)}
                        <button
                          type="button"
                          on:click={async () => {
                            try {
                              const response = await productApi.getById(product.id);
                              transferProduct = response.product;
                            } catch (e) {
                              transferProduct = product;
                            }
                            transferData.productId = transferProduct.id;
                            transferData.variantId = '';
                            products = [];
                            transferProductSearchQuery = '';
                          }}
                          class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div class="flex items-center gap-3">
                            {#if firstMedia}
                              {#if isVideoUrl(firstMedia.url)}
                                <video
                                  src={firstMedia.url}
                                  class="w-12 h-12 object-cover border border-gray-200 rounded"
                                  muted
                                  playsinline
                                  preload="metadata"
                                ></video>
                              {:else}
                                <img
                                  src={firstMedia.url}
                                  alt={getProductImageAlt(firstMedia.alt, product.name)}
                                  class="w-12 h-12 object-cover border border-gray-200 rounded"
                                />
                              {/if}
                            {:else}
                              <div
                                class="w-12 h-12 bg-gray-100 border border-gray-200 rounded flex items-center justify-center"
                              >
                                <svg
                                  class="w-6 h-6 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                            {/if}
                            <div class="flex-1 min-w-0">
                              <p class="font-medium text-black truncate">{product.name}</p>
                              <div class="flex items-center gap-2 mt-1">
                                <p class="text-sm text-gray-600">{t('warehouse.sku')}:</p>
                                <code class="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-800"
                                  >{product.sku}</code
                                >
                              </div>
                            </div>
                            <svg
                              class="w-5 h-5 text-gray-400 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else}
                {@const transferFirstMedia = getFirstMedia(transferProduct.images)}
                <!-- Selected Product Confirmation -->
                <div class="bg-gray-50 border-2 border-accent rounded-lg p-4">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex items-start gap-4 flex-1">
                      {#if transferFirstMedia}
                        {#if isVideoUrl(transferFirstMedia.url)}
                          <video
                            src={transferFirstMedia.url}
                            class="w-16 h-16 object-cover border border-gray-300 rounded"
                            muted
                            playsinline
                            preload="metadata"
                          ></video>
                        {:else}
                          <img
                            src={transferFirstMedia.url}
                            alt={getProductImageAlt(transferFirstMedia.alt, transferProduct.name)}
                            class="w-16 h-16 object-cover border border-gray-300 rounded"
                          />
                        {/if}
                      {:else}
                        <div
                          class="w-16 h-16 bg-gray-200 border border-gray-300 rounded flex items-center justify-center flex-shrink-0"
                        >
                          <svg
                            class="w-8 h-8 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      {/if}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <svg
                            class="w-5 h-5 text-green-600 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <p class="font-semibold text-black">{transferProduct.name}</p>
                        </div>
                        <div class="flex items-center gap-2 mt-2">
                          <p class="text-sm text-gray-600">{t('warehouse.sku')}:</p>
                          <code
                            class="text-sm bg-white px-2 py-1 rounded border border-gray-300 text-gray-800 font-mono"
                            >{transferProduct.sku}</code
                          >
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      on:click={() => {
                        transferProduct = null;
                        transferData.productId = '';
                        transferData.variantId = '';
                        transferProductSearchQuery = '';
                      }}
                      class="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                      title={t('common.remove')}
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Variant Selection -->
            {#if transferProduct && transferProduct.variants && transferProduct.variants.length > 0}
              <div>
                <label for="transfer-variant" class="block text-sm font-medium mb-2"
                  >{t('warehouse.variant')} ({t('common.optional')})</label
                >
                <select
                  id="transfer-variant"
                  bind:value={transferData.variantId}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="">{t('warehouse.noVariant')}</option>
                  {#each transferProduct.variants as variant}
                    <option value={variant.id}
                      >{variant.name} ({t('warehouse.sku')}: {variant.sku})</option
                    >
                  {/each}
                </select>
              </div>
            {/if}

            <!-- Quantity -->
            <div>
              <label for="transfer-quantity" class="block text-sm font-medium mb-2"
                >{t('warehouse.quantity')} *</label
              >
              <input
                id="transfer-quantity"
                type="number"
                min="1"
                bind:value={transferData.quantity}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>

            <div class="flex gap-3 pt-2">
              <button
                on:click={transferInventory}
                class="px-6 py-2.5 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium"
              >
                {t('warehouse.transfer')}
              </button>
              <button
                on:click={() => {
                  transferringInventory = false;
                  transferData = {
                    fromWarehouseId: '',
                    toWarehouseId: '',
                    productId: '',
                    variantId: '',
                    quantity: 1,
                  };
                  transferProduct = null;
                  transferProductSearchQuery = '';
                  products = [];
                }}
                class="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Add Inventory Form -->
        {#if addingInventory}
          <div class="bg-dark p-6 border border-dark space-y-5">
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-bold">{t('warehouse.addInventory')}</h3>
              <button
                aria-label={t('common.close')}
                on:click={() => {
                  addingInventory = false;
                  newInventory = {
                    productId: '',
                    variantId: '',
                    quantity: 1,
                    reason: '',
                    palletId: '',
                    documentNumber: '',
                    documentDate: '',
                    supplierName: '',
                    supplierInn: '',
                    supplierVatNumber: '',
                    customsDeclarationId: '',
                    purchasePrice: undefined,
                    purchaseCurrency: '',
                    receivedAt: '',
                    batchNumber: '',
                  };
                  selectedProduct = null;
                  palletSearchQuery = '';
                }}
                class="text-accent-muted hover:text-accent transition-colors"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- Product Search -->
            <div class="relative">
              <label for="inventory-product-search" class="block text-sm font-medium mb-2"
                >{t('warehouse.product')} *</label
              >
              <input
                id="inventory-product-search"
                type="text"
                placeholder={t('warehouse.searchProducts')}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                on:input={(e) => loadProducts(e.currentTarget.value)}
              />
              {#if products.length > 0}
                <div
                  class="absolute z-10 w-full mt-1 bg-white border border-gray-300 shadow-lg max-h-60 overflow-y-auto"
                >
                  {#each products as product}
                    <button
                      type="button"
                      on:click={() => selectProduct(product)}
                      class="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                    >
                      <p class="font-medium">{product.name}</p>
                      <p class="text-sm text-gray-600">{t('warehouse.sku')}: {product.sku}</p>
                    </button>
                  {/each}
                </div>
              {/if}
              {#if selectedProduct}
                <div class="mt-2 p-2 bg-gray-100">
                  <p class="font-medium text-black">{selectedProduct.name}</p>
                  <p class="text-sm text-gray-600">{t('warehouse.sku')}: {selectedProduct.sku}</p>
                </div>
              {/if}
            </div>

            <!-- Variant Selection -->
            {#if selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0}
              <div>
                <label for="inventory-variant" class="block text-sm font-medium mb-2"
                  >{t('warehouse.variant')} ({t('common.optional')})</label
                >
                <select
                  id="inventory-variant"
                  bind:value={newInventory.variantId}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                >
                  <option value="">{t('warehouse.noVariant')}</option>
                  {#each selectedProduct.variants as variant}
                    <option value={variant.id}
                      >{variant.name} ({t('warehouse.sku')}: {variant.sku})</option
                    >
                  {/each}
                </select>
              </div>
            {/if}

            <!-- Quantity -->
            <div>
              <label for="inventory-quantity" class="block text-sm font-medium mb-2"
                >{t('warehouse.quantity')} *</label
              >
              <input
                id="inventory-quantity"
                type="number"
                min="1"
                bind:value={newInventory.quantity}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>

            <!-- Reason -->
            <div>
              <label for="inventory-reason" class="block text-sm font-medium mb-2"
                >{t('warehouse.reason')} ({t('common.optional')})</label
              >
              <input
                id="inventory-reason"
                type="text"
                placeholder={t('warehouse.reasonPlaceholder')}
                bind:value={newInventory.reason}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>

            <!-- Admin-only: purchase reporting (receipt) -->
            <details
              class="bg-gray-100 dark:bg-dark border border-gray-200 dark:border-white/10 rounded p-4"
            >
              <summary
                class="cursor-pointer text-sm font-medium text-accent-muted hover:text-accent"
              >
                Purchase reporting (receipt) - only for admin
              </summary>
              <p class="mt-2 text-xs text-accent-muted">{t('warehouse.fillForPurchaseReport')}</p>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="document-number" class="block text-xs font-medium mb-1"
                    >{t('warehouse.documentNumber')}</label
                  >
                  <input
                    id="document-number"
                    type="text"
                    bind:value={newInventory.documentNumber}
                    placeholder="Invoice, act"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div>
                  <label for="document-date" class="block text-xs font-medium mb-1"
                    >{t('warehouse.documentDate')}</label
                  >
                  <input
                    id="document-date"
                    type="date"
                    bind:value={newInventory.documentDate}
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label for="supplier-name" class="block text-xs font-medium mb-1"
                    >{t('warehouse.supplier')}</label
                  >
                  <input
                    id="supplier-name"
                    type="text"
                    bind:value={newInventory.supplierName}
                    placeholder="Name"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div>
                  <label for="supplier-inn" class="block text-xs font-medium mb-1"
                    >{t('warehouse.supplierInn')}</label
                  >
                  <input
                    id="supplier-inn"
                    type="text"
                    bind:value={newInventory.supplierInn}
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div>
                  <label for="supplier-vat" class="block text-xs font-medium mb-1"
                    >{t('warehouse.supplierVatNumber')}</label
                  >
                  <input
                    id="supplier-vat"
                    type="text"
                    bind:value={newInventory.supplierVatNumber}
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div>
                  <label for="purchase-price" class="block text-xs font-medium mb-1"
                    >{t('warehouse.purchasePrice')}</label
                  >
                  <input
                    id="purchase-price"
                    type="number"
                    step="0.01"
                    bind:value={newInventory.purchasePrice}
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div>
                  <label for="purchase-currency" class="block text-xs font-medium mb-1"
                    >{t('warehouse.purchaseCurrency')}</label
                  >
                  <input
                    id="purchase-currency"
                    type="text"
                    bind:value={newInventory.purchaseCurrency}
                    placeholder="RUB"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label for="customs-declaration-id" class="block text-xs font-medium mb-1"
                    >{t('warehouse.customsDeclarationId')}</label
                  >
                  <input
                    id="customs-declaration-id"
                    type="text"
                    bind:value={newInventory.customsDeclarationId}
                    placeholder={t('warehouse.customsDeclarationIdPlaceholder')}
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div>
                  <label for="received-at" class="block text-xs font-medium mb-1"
                    >{t('warehouse.receivedAt')}</label
                  >
                  <input
                    id="received-at"
                    type="date"
                    bind:value={newInventory.receivedAt}
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
                <div>
                  <label for="batch-number" class="block text-xs font-medium mb-1"
                    >{t('warehouse.batchNumber')}</label
                  >
                  <input
                    id="batch-number"
                    type="text"
                    bind:value={newInventory.batchNumber}
                    placeholder="For traceability"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded"
                  />
                </div>
              </div>
            </details>

            <!-- Pallet Selection -->
            <div class="relative">
              <label for="inventory-pallet-search" class="block text-sm font-medium mb-2"
                >{t('warehouse.pallet')} ({t('common.optional')})</label
              >
              <input
                id="inventory-pallet-search"
                type="text"
                placeholder={t('warehouse.searchPallets') ||
                'Search pallets by code or location'}
                bind:value={palletSearchQuery}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                on:focus={() => {
                  if (palletSearchQuery) {
                    // Keep filtered results visible
                  }
                }}
              />
              {#if palletSearchQuery && !newInventory.palletId && filteredPallets.length > 0}
                <div
                  class="absolute z-10 w-full mt-1 bg-white border border-gray-300 shadow-lg max-h-60 overflow-y-auto"
                >
                  {#each filteredPallets as pallet}
                    <button
                      type="button"
                      on:click={() => {
                        newInventory.palletId = pallet.id;
                        palletSearchQuery =
                          pallet.code + (pallet.location ? ` - ${pallet.location}` : '');
                      }}
                      class="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                    >
                      <p class="font-medium text-black">{pallet.code}</p>
                      {#if pallet.location}
                        <p class="text-sm text-gray-600">{pallet.location}</p>
                      {/if}
                      {#if pallet._count && pallet._count.items !== undefined}
                        <p class="text-xs text-gray-500">
                          {pallet._count.items}
                          {t('warehouse.items')}
                        </p>
                      {/if}
                    </button>
                  {/each}
                </div>
              {:else if palletSearchQuery && !newInventory.palletId && filteredPallets.length === 0}
                <div
                  class="absolute z-10 w-full mt-1 bg-white border border-gray-300 shadow-lg p-4"
                >
                  <p class="text-sm text-gray-600">
                    {t('warehouse.noPalletsFound') || 'No pallets found'}
                  </p>
                </div>
              {/if}
              {#if newInventory.palletId}
                {@const selectedPallet = pallets.find((p) => p.id === newInventory.palletId)}
                {#if selectedPallet}
                  <div class="mt-2 p-2 bg-gray-100">
                    <p class="font-medium text-black">{selectedPallet.code}</p>
                    {#if selectedPallet.location}
                      <p class="text-sm text-gray-600">{selectedPallet.location}</p>
                    {/if}
                    <button
                      type="button"
                      on:click={() => {
                        newInventory.palletId = '';
                        palletSearchQuery = '';
                      }}
                      class="mt-1 text-xs text-red-600 hover:text-red-800"
                    >
                      {t('common.remove') || 'Remove'}
                    </button>
                  </div>
                {/if}
              {/if}
            </div>

            <div class="flex gap-3 pt-2">
              <button
                on:click={addInventory}
                class="px-6 py-2.5 bg-accent text-dark hover:bg-accent-muted transition-colors font-medium"
              >
                {t('common.add')}
              </button>
              <button
                on:click={() => {
                  addingInventory = false;
                  newInventory = {
                    productId: '',
                    variantId: '',
                    quantity: 1,
                    reason: '',
                    palletId: '',
                    documentNumber: '',
                    documentDate: '',
                    supplierName: '',
                    supplierInn: '',
                    supplierVatNumber: '',
                    customsDeclarationId: '',
                    purchasePrice: undefined,
                    purchaseCurrency: '',
                    receivedAt: '',
                    batchNumber: '',
                  };
                  selectedProduct = null;
                  palletSearchQuery = '';
                }}
                class="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        {/if}

        <!-- Inventory Table -->
        {#if inventory.length === 0}
          <div class="text-center py-12">
            <svg
              class="mx-auto h-12 w-12 text-accent-muted mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p class="text-accent-muted text-lg">{t('warehouse.noInventoryFound')}</p>
          </div>
        {:else}
          <div class="overflow-x-auto border border-dark" style="overflow-y: visible;">
            <table class="w-full">
              <thead>
                <tr class="bg-dark border-b border-dark">
                  <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider w-8"
                  ></th>
                  <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                    >{t('warehouse.product')}</th
                  >
                  <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                    >{t('warehouse.sku')}</th
                  >
                  <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                    >{t('warehouse.quantity')}</th
                  >
                  <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                    >{t('warehouse.reserved')}</th
                  >
                  <th class="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wider"
                    >{t('common.actions')}</th
                  >
                </tr>
              </thead>
              <tbody class="divide-y divide-dark">
                {#each groupedInventoryArray as group}
                  {@const productId = group.product.id}
                  {@const isExpanded = expandedGroups.has(productId)}
                  {@const hasVariants = group.items.some((item) => item.variant)}
                  {@const baseProductItem = group.items.find((item) => !item.variant)}
                  {@const variantItems = group.items
                    .filter((item) => item.variant)
                    .sort((a, b) => {
                      // Sort by variant name (which includes size info)
                      const aName = a.variant?.name || '';
                      const bName = b.variant?.name || '';
                      // Try to extract size from name (e.g., "Size: S" or "Size: 35")
                      const aSizeMatch = aName.match(/Size:\s*([^,]+)/i);
                      const bSizeMatch = bName.match(/Size:\s*([^,]+)/i);
                      if (aSizeMatch && bSizeMatch) {
                        const aSize = aSizeMatch[1].trim();
                        const bSize = bSizeMatch[1].trim();
                        // Try numeric comparison first (for shoe sizes like 35, 36, etc.)
                        const aNum = parseInt(aSize);
                        const bNum = parseInt(bSize);
                        if (!isNaN(aNum) && !isNaN(bNum)) {
                          return aNum - bNum;
                        }
                        // Otherwise alphabetical
                        return aSize.localeCompare(bSize);
                      }
                      // Fallback to variant name
                      return aName.localeCompare(bName);
                    })}
                  {@const hasMultipleItems =
                    group.items.length > 1 || (baseProductItem && variantItems.length > 0)}
                  {@const groupFirstMedia = getFirstMedia(group.product.images)}

                  <!-- Product Group Header -->
                  <tr class="hover:bg-dark/50 transition-colors bg-dark/30">
                    <td class="py-3 px-6">
                      {#if hasMultipleItems}
                        <button
                          type="button"
                          on:click={() => toggleGroup(productId)}
                          class="text-accent-muted hover:text-accent transition-colors"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          <svg
                            class="w-5 h-5 transition-transform {isExpanded ? 'rotate-90' : ''}"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      {/if}
                    </td>
                    <td class="py-3 px-6">
                      <div class="flex items-center gap-3">
                        {#if groupFirstMedia}
                          {#if isVideoUrl(groupFirstMedia.url)}
                            <video
                              src={groupFirstMedia.url}
                              class="w-14 h-14 object-cover border border-dark"
                              muted
                              playsinline
                              preload="metadata"
                            ></video>
                          {:else}
                            <img
                              src={groupFirstMedia.url}
                              alt={getProductImageAlt(groupFirstMedia.alt, group.product.name)}
                              class="w-14 h-14 object-cover border border-dark"
                            />
                          {/if}
                        {:else}
                          <div
                            class="w-14 h-14 bg-dark border border-dark flex items-center justify-center"
                          >
                            <svg
                              class="w-6 h-6 text-accent-muted"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        {/if}
                        <div class="flex-1">
                          <a
                            href="/admin/products/{group.product.id}"
                            class="font-medium text-accent hover:text-accent-muted hover:underline transition-colors"
                            title="Edit product and stock by size"
                          >
                            {group.product.name}
                          </a>
                          {#if hasMultipleItems}
                            {@const totalItems = variantItems.length + (baseProductItem ? 1 : 0)}
                            <p class="text-xs text-accent-muted mt-1">
                              {totalItems}
                              {totalItems === 1 ? 'item' : 'items'} • Click to expand
                            </p>
                          {:else}
                            <p class="text-xs text-accent-muted mt-1">Single item</p>
                          {/if}
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-6">
                      <code class="text-sm bg-dark px-2 py-1 text-accent-muted">
                        {group.product.sku}
                      </code>
                    </td>
                    <td class="py-3 px-6">
                      <span class="font-semibold text-lg">{group.totalQuantity}</span>
                    </td>
                    <td class="py-3 px-6">
                      {#if group.totalReserved > 0}
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-800"
                        >
                          {group.totalReserved}
                        </span>
                      {:else}
                        <span class="text-gray-400">-</span>
                      {/if}
                    </td>
                    <td class="py-3 px-6">
                      <a
                        href="/admin/products/{group.product.id}"
                        class="text-xs text-accent hover:text-accent-muted hover:underline transition-colors flex items-center gap-1 w-fit"
                        title="Edit product and stock by size"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit Stock by Size
                      </a>
                    </td>
                  </tr>

                  <!-- Variants and General Stock List (Expandable) -->
                  {#if isExpanded && hasMultipleItems}
                    <!-- Show General Stock first if exists -->
                    {#if baseProductItem}
                      <tr class="hover:bg-dark/30 transition-colors bg-dark/10">
                        <td class="py-2 px-6"></td>
                        <td class="py-2 px-6 pl-12">
                          <div class="flex items-center gap-2">
                            <span class="text-xs text-accent-muted">└─</span>
                            <span class="text-sm text-accent-muted">General Stock (No Size)</span>
                          </div>
                        </td>
                        <td class="py-2 px-6">
                          <code class="text-xs bg-dark px-2 py-1 text-accent-muted">
                            {baseProductItem.product.sku}
                          </code>
                        </td>
                        <td class="py-2 px-6">
                          <span class="font-medium">{baseProductItem.quantity}</span>
                        </td>
                        <td class="py-2 px-6">
                          {#if baseProductItem.reserved > 0}
                            <span
                              class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-800"
                            >
                              {baseProductItem.reserved}
                            </span>
                          {:else}
                            <span class="text-gray-400">-</span>
                          {/if}
                        </td>
                        <td class="py-2 px-6">
                          <div class="flex items-center gap-2">
                            <div class="w-40" style="position: relative; z-index: 1;">
                              <CustomSelect
                                value={baseProductItem.status}
                                options={statusSelectOptions}
                                size="sm"
                                on:change={(e) => handleStatusChange(baseProductItem.id, e)}
                                className="w-full"
                              />
                            </div>
                            {#if baseProductItem.items && baseProductItem.items.length > 0}
                              <button
                                on:click={() => {
                                  selectedInventoryItem = baseProductItem;
                                  showingItemDetails = true;
                                }}
                                class="px-2 py-1 bg-dark hover:bg-dark-light border border-gray-600 text-xs transition-colors"
                                title={t('common.view')}
                              >
                                <svg
                                  class="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              </button>
                            {/if}
                          </div>
                        </td>
                      </tr>
                    {/if}

                    <!-- Show Variants -->
                    {#each variantItems as item}
                      <tr class="hover:bg-dark/30 transition-colors bg-dark/10">
                        <td class="py-2 px-6"></td>
                        <td class="py-2 px-6 pl-12">
                          <div class="flex items-center gap-2">
                            <span class="text-xs text-accent-muted">└─</span>
                            <span class="text-sm text-accent-muted">
                              {#if item.variant?.name}
                                {item.variant.name}
                              {:else}
                                <span class="text-gray-400">-</span>
                              {/if}
                            </span>
                          </div>
                        </td>
                        <td class="py-2 px-6">
                          <code class="text-xs bg-dark px-2 py-1 text-accent-muted">
                            {item.variant?.sku || group.product.sku}
                          </code>
                        </td>
                        <td class="py-2 px-6">
                          <span class="font-medium">{item.quantity}</span>
                        </td>
                        <td class="py-2 px-6">
                          {#if item.reserved > 0}
                            <span
                              class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-800"
                            >
                              {item.reserved}
                            </span>
                          {:else}
                            <span class="text-gray-400">-</span>
                          {/if}
                        </td>
                        <td class="py-2 px-6">
                          <div class="flex items-center gap-2">
                            <div class="w-40" style="position: relative; z-index: 1;">
                              <CustomSelect
                                value={item.status}
                                options={statusSelectOptions}
                                size="sm"
                                on:change={(e) => handleStatusChange(item.id, e)}
                                className="w-full"
                              />
                            </div>
                            {#if item.items && item.items.length > 0}
                              <button
                                on:click={() => {
                                  selectedInventoryItem = item;
                                  showingItemDetails = true;
                                }}
                                class="px-2 py-1 bg-dark hover:bg-dark-light border border-gray-600 text-xs transition-colors"
                                title={t('common.view')}
                              >
                                <svg
                                  class="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              </button>
                            {/if}
                          </div>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}

      {#if activeTab === 'analytics'}
        <!-- Warehouse Analytics -->
        <div class="bg-dark-light p-8 border border-dark space-y-8">
          <div class="border-b border-dark-lighter pb-4">
            <h2 class="text-3xl font-bold text-accent">
              {t('warehouse.stockManagementAnalytics')}
            </h2>
            <p class="text-sm text-accent-muted mt-2">
              {t('warehouse.totalStock')}: {warehouse?.name || ''}
            </p>
          </div>

          <!-- Main Analytics Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div
              class="bg-white border border-dark-lighter p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div class="text-xs text-accent-muted mb-2 font-medium uppercase tracking-wide">
                {t('warehouse.totalStock')}
              </div>
              <div class="text-3xl font-bold text-accent mb-1">{warehouseAnalytics.totalStock}</div>
              <div class="text-xs text-accent-muted">{t('warehouse.allTimeReceived')}</div>
            </div>

            <div
              class="bg-white border border-dark-lighter p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div class="text-xs text-accent-muted mb-2 font-medium uppercase tracking-wide">
                {t('warehouse.awaitingPayment')}
              </div>
              <div class="text-3xl font-bold text-accent mb-1">
                {warehouseAnalytics.awaitingPayment}
              </div>
              <div class="text-xs text-accent-muted">{t('warehouse.inCartReserved')}</div>
            </div>

            <div
              class="bg-white border border-dark-lighter p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div class="text-xs text-accent-muted mb-2 font-medium uppercase tracking-wide">
                {t('warehouse.paidDelivered')}
              </div>
              <div class="text-3xl font-bold text-accent mb-1">{warehouseAnalytics.paid}</div>
              <div class="text-xs text-accent-muted">{t('warehouse.soldItems')}</div>
            </div>

            <div
              class="bg-white border border-dark-lighter p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div class="text-xs text-accent-muted mb-2 font-medium uppercase tracking-wide">
                {t('warehouse.returns')}
              </div>
              <div class="text-3xl font-bold text-accent mb-1">{warehouseAnalytics.returned}</div>
              <div class="text-xs text-accent-muted">{t('warehouse.returnedItems')}</div>
            </div>

            <div
              class="bg-white border border-dark-lighter p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div class="text-xs text-accent-muted mb-2 font-medium uppercase tracking-wide">
                {t('warehouse.currentStock')}
              </div>
              <div class="text-3xl font-bold text-accent mb-1">
                {warehouseAnalytics.currentStock}
              </div>
              <div class="text-xs text-accent-muted">{t('warehouse.availableForSale')}</div>
            </div>
          </div>

          <!-- Status Leaders -->
          <div class="mt-8">
            <div class="border-b border-dark-lighter pb-3 mb-6">
              <h3 class="text-xl font-bold text-accent">{t('warehouse.leadersByStatus')}</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {#each statusLeadersArray as item}
                {#if item.leaders.length > 0}
                  <div class="bg-white border border-dark-lighter p-5 rounded-lg shadow-sm">
                    <h4
                      class="font-semibold text-sm mb-4 text-accent uppercase tracking-wide border-b border-dark-lighter pb-2"
                    >
                      {statusLabels[item.status]}
                    </h4>
                    <div class="space-y-2">
                      {#each item.leaders as leader}
                        <a
                          href="/admin/products/{leader.product.id}"
                          class="block p-3 hover:bg-dark-light rounded transition-colors group border border-transparent hover:border-dark-lighter"
                        >
                          <div class="flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                              <p
                                class="text-sm font-medium text-accent truncate group-hover:text-accent-muted transition-colors"
                              >
                                {leader.product.name}
                              </p>
                              <p class="text-xs text-accent-muted truncate mt-0.5">
                                {t('warehouse.sku')}: {leader.product.sku}
                              </p>
                            </div>
                            <div class="ml-3 text-right flex-shrink-0">
                              <p class="text-sm font-bold text-accent">{leader.quantity}</p>
                              {#if leader.reserved > 0}
                                <p class="text-xs text-accent-muted mt-0.5">
                                  {t('warehouse.reservedLabel')}
                                  {leader.reserved}
                                </p>
                              {/if}
                            </div>
                          </div>
                        </a>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>

          <!-- Products Summary Table -->
          <div class="mt-8">
            <div class="border-b border-dark-lighter pb-3 mb-6">
              <h3 class="text-xl font-bold text-accent">{t('warehouse.allProductsSummary')}</h3>
            </div>
            <div class="bg-white border border-dark-lighter rounded-lg overflow-hidden shadow-sm">
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead class="bg-dark-light border-b border-dark-lighter">
                    <tr>
                      <th
                        class="text-left py-4 px-6 font-semibold text-sm text-accent uppercase tracking-wider"
                        >{t('warehouse.product')}</th
                      >
                      <th
                        class="text-left py-4 px-6 font-semibold text-sm text-accent uppercase tracking-wider"
                        >{t('warehouse.sku')}</th
                      >
                      <th
                        class="text-center py-4 px-6 font-semibold text-sm text-accent uppercase tracking-wider"
                        >{t('warehouse.totalStock')}</th
                      >
                      <th
                        class="text-center py-4 px-6 font-semibold text-sm text-accent uppercase tracking-wider"
                        >{t('warehouse.reserved')}</th
                      >
                      <th
                        class="text-center py-4 px-6 font-semibold text-sm text-accent uppercase tracking-wider"
                        >{t('warehouse.available')}</th
                      >
                      <th
                        class="text-left py-4 px-6 font-semibold text-sm text-accent uppercase tracking-wider"
                        >{t('common.status')}</th
                      >
                      <th
                        class="text-left py-4 px-6 font-semibold text-sm text-accent uppercase tracking-wider"
                        >{t('common.actions')}</th
                      >
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-dark-lighter">
                    {#each groupedInventoryArray as group}
                      {@const available = group.totalQuantity - group.totalReserved}
                      {@const mainStatus = group.items[0]?.status || 'OUT_OF_STOCK'}
                      {@const invFirstMedia = getFirstMedia(group.product.images)}
                      <tr class="hover:bg-dark-light transition-colors">
                        <td class="py-4 px-6">
                          <div class="flex items-center gap-3">
                            {#if invFirstMedia}
                              {#if isVideoUrl(invFirstMedia.url)}
                                <video
                                  src={invFirstMedia.url}
                                  class="w-12 h-12 object-cover border border-dark-lighter rounded"
                                  muted
                                  playsinline
                                  preload="metadata"
                                ></video>
                              {:else}
                                <img
                                  src={invFirstMedia.url}
                                  alt={getProductImageAlt(invFirstMedia.alt, group.product.name)}
                                  class="w-12 h-12 object-cover border border-dark-lighter rounded"
                                />
                              {/if}
                            {:else}
                              <div
                                class="w-12 h-12 bg-dark-light border border-dark-lighter rounded flex items-center justify-center"
                              >
                                <svg
                                  class="w-6 h-6 text-accent-muted"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                            {/if}
                            <div>
                              <a
                                href="/admin/products/{group.product.id}"
                                class="font-medium text-accent hover:text-accent-muted hover:underline transition-colors"
                              >
                                {group.product.name}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td class="py-4 px-6">
                          <code
                            class="text-xs bg-dark-light px-2.5 py-1.5 text-accent rounded border border-dark-lighter"
                          >
                            {group.product.sku}
                          </code>
                        </td>
                        <td class="py-4 px-6 text-center">
                          <span class="font-semibold text-accent">{group.totalQuantity}</span>
                        </td>
                        <td class="py-4 px-6 text-center">
                          {#if group.totalReserved > 0}
                            <span
                              class="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-dark-light text-accent rounded border border-dark-lighter"
                            >
                              {group.totalReserved}
                            </span>
                          {:else}
                            <span class="text-accent-muted">-</span>
                          {/if}
                        </td>
                        <td class="py-4 px-6 text-center">
                          <span class="font-semibold text-accent">{available}</span>
                        </td>
                        <td class="py-4 px-6">
                          <span
                            class="inline-flex items-center px-2.5 py-1 text-xs font-medium {statusColors[
                              mainStatus
                            ]} rounded"
                          >
                            {statusLabels[mainStatus]}
                          </span>
                        </td>
                        <td class="py-4 px-6">
                          <a
                            href="/admin/products/{group.product.id}"
                            class="text-xs text-accent hover:text-accent-muted hover:underline transition-colors flex items-center gap-1.5 w-fit"
                          >
                            <svg
                              class="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            {t('warehouse.viewDetails')}
                          </a>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Item Details Modal -->
{#if showingItemDetails && selectedInventoryItem}
  <button
    type="button"
    class="fixed inset-0 bg-black/50 z-50"
    aria-label={t('common.close')}
    on:click={() => (showingItemDetails = false)}
  ></button>
  <div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
    <div
      class="bg-dark-light p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-item-details-title"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 id="inventory-item-details-title" class="text-2xl font-bold">
          {t('warehouse.inventoryItemDetails')}
        </h3>
        <button
          type="button"
          on:click={() => (showingItemDetails = false)}
          class="text-accent-muted hover:text-accent"
          aria-label={t('common.close')}
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {#if selectedInventoryItem.items && selectedInventoryItem.items.length > 0}
        <div class="space-y-4">
          {#each selectedInventoryItem.items as item}
            <div class="bg-dark p-4 space-y-2">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-medium">{t('warehouse.itemId')}: {item.id}</p>
                  <p class="text-sm text-accent-muted">
                    {t('common.status')}:
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 text-xs font-medium {statusColors[
                        item.status
                      ]}"
                    >
                      {statusLabels[item.status]}
                    </span>
                  </p>
                </div>
              </div>
              {#if item.pallet}
                <div class="text-sm text-accent-muted">
                  <p>{t('warehouse.pallet')}: {item.pallet.code}</p>
                  {#if item.pallet.location}
                    <p>{t('warehouse.location')}: {item.pallet.location}</p>
                  {/if}
                </div>
              {/if}
              {#if item.order}
                <div class="text-sm text-accent-muted">
                  <p>{t('order.order')}: {item.order.orderNumber}</p>
                  <p>
                    {t('order.orderStatus')}: {formatOrderStatus(item.order.status)} / {t(
                      'order.paymentStatus'
                    )}: {formatPaymentStatus(item.order.paymentStatus)}
                  </p>
                </div>
              {/if}
              {#if item.qrCodes && item.qrCodes.length > 0}
                <div class="text-sm">
                  <p class="font-medium mb-1">{t('warehouse.qrCodes')}:</p>
                  {#each item.qrCodes as qr}
                    <div class="flex items-center gap-2">
                      <code class="px-2 py-1 bg-dark-light text-xs">{qr.code}</code>
                      {#if qr.isUsed}
                        <span class="text-xs text-green-400">{t('warehouse.used')}</span>
                      {:else}
                        <span class="text-xs text-black">{t('common.active')}</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-accent-muted">{t('warehouse.noItemDetails')}</p>
      {/if}
    </div>
  </div>
{/if}
