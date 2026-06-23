<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { adminApi, type SalesPointDetail, type SalesPointProduct } from '$lib/api/admin.api';
  import { productApi, type Product } from '$lib/api/product.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { getFirstImageUrl } from '$lib/utils/image.utils';

  let point: SalesPointDetail | null = null;
  let loading = true;
  let error = '';
  let warehouses: { id: string; name: string }[] = [];
  let addingProduct = false;
  let productSearch = '';
  let searchResults: Product[] = [];
  let searchingProducts = false;
  let selectedProduct: Product | null = null;
  let selectedVariantId: string | null = null;
  let selectedWarehouseId: string | null = null;
  let adding = false;
  let removingId: string | null = null;

  // Create order modal
  let showCreateOrderModal = false;
  let orderCustomers: Array<{ id: string; email: string; firstName?: string; lastName?: string }> =
    [];
  let orderCustomerSearch = '';
  let selectedCustomerId = '';
  let selectedAddressId = '';
  let customerAddresses: Array<{ id: string; address: string; city?: string; country?: string }> =
    [];
  let orderItems: Array<{
    productId: string;
    variantId: string | null;
    productName: string;
    variantName?: string;
    quantity: number;
    price: number;
  }> = [];
  let orderNotes = '';
  let creatingOrder = false;

  $: pointId = $page.params.id;

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showCreateOrderModal && e.key === 'Escape') {
        showCreateOrderModal = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    void loadPoint();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  async function loadPoint() {
    loading = true;
    try {
      const [res, whRes] = await Promise.all([
        adminApi.getSalesPointById(pointId),
        adminApi.getAllWarehouses(),
      ]);
      point = res.salesPoint;
      warehouses = whRes.warehouses.map((w) => ({ id: w.id, name: w.name }));
    } catch (e) {
      error = e instanceof Error ? e.message : t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function searchProducts() {
    if (!productSearch.trim() || productSearch.length < 2) return;
    searchingProducts = true;
    try {
      const res = await productApi.searchProducts(productSearch, 20);
      searchResults = res.products || [];
    } catch {
      searchResults = [];
    } finally {
      searchingProducts = false;
    }
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  $: if (productSearch.trim().length >= 2) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchProducts, 300);
  }

  async function selectProduct(p: Product) {
    try {
      const res = await productApi.getById(p.id);
      selectedProduct = res.product;
      selectedVariantId = null;
      productSearch = '';
      searchResults = [];
    } catch {
      selectedProduct = p;
      selectedVariantId = null;
      productSearch = '';
      searchResults = [];
    }
  }

  function clearSelection() {
    selectedProduct = null;
    selectedVariantId = null;
    selectedWarehouseId = null;
  }

  async function addProduct() {
    if (!point || !selectedProduct) return;
    if (point.type === 'MARKETPLACE' && !selectedWarehouseId) {
      notificationStore.error(t('admin.salesPoints.selectWarehouseForMarketplace'));
      return;
    }
    adding = true;
    try {
      const variantId =
        selectedVariantId && selectedVariantId !== 'null' ? selectedVariantId : null;
      const warehouseId =
        point.type === 'MARKETPLACE' && selectedWarehouseId && selectedWarehouseId !== 'null'
          ? selectedWarehouseId
          : null;
      await adminApi.addSalesPointProduct(point.id, {
        productId: selectedProduct.id,
        variantId,
        warehouseId,
      });
      notificationStore.success(t('admin.salesPoints.productAdded'));
      clearSelection();
      addingProduct = false;
      await loadPoint();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('admin.salesPoints.failedToAdd'));
    } finally {
      adding = false;
    }
  }

  async function removeProduct(salesPointProductId: string) {
    if (!point) return;
    removingId = salesPointProductId;
    try {
      await adminApi.removeSalesPointProduct(point.id, salesPointProductId);
      notificationStore.success(t('admin.salesPoints.productRemoved'));
      await loadPoint();
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('admin.salesPoints.failedToDelete')
      );
    } finally {
      removingId = null;
    }
  }

  function typeLabel(type: string) {
    return type === 'MARKETPLACE'
      ? t('admin.salesPoints.typeMarketplace')
      : t('admin.salesPoints.typeStoreOffline');
  }

  async function openCreateOrderModal() {
    if (!point || !point.products?.length) {
      notificationStore.error(t('admin.salesPoints.addProductsBeforeOrder'));
      return;
    }
    showCreateOrderModal = true;
    selectedCustomerId = '';
    selectedAddressId = '';
    customerAddresses = [];
    orderItems = point.products.map((p) => ({
      productId: p.productId,
      variantId: p.variantId ?? null,
      productName: p.product?.name ?? p.productId,
      variantName: p.variant?.name,
      quantity: 0,
      price: 0,
    }));
    orderNotes = '';
    await loadOrderCustomers();
  }

  async function loadOrderCustomers() {
    try {
      const res = await adminApi.getAllCustomers(1, 50, {
        search: orderCustomerSearch || undefined,
      });
      orderCustomers = res.customers;
    } catch {
      orderCustomers = [];
    }
  }

  async function onCustomerSelect() {
    if (!selectedCustomerId) {
      customerAddresses = [];
      selectedAddressId = '';
      return;
    }
    try {
      const res = await adminApi.getCustomerDetails(selectedCustomerId);
      customerAddresses = (res.addresses || []).map((a) => ({
        id: a.id,
        address: [a.address, a.city, a.country].filter(Boolean).join(', '),
        city: a.city,
        country: a.country,
      }));
      selectedAddressId = customerAddresses[0]?.id ?? '';
    } catch {
      customerAddresses = [];
      selectedAddressId = '';
    }
  }

  async function submitCreateOrder() {
    if (!point) return;
    const items = orderItems.filter((i) => i.quantity > 0 && i.price >= 0);
    if (!items.length) {
      notificationStore.error(t('admin.salesPoints.addAtLeastOneProduct'));
      return;
    }
    if (!selectedCustomerId || !selectedAddressId) {
      notificationStore.error(t('admin.salesPoints.selectCustomerAndAddress'));
      return;
    }
    creatingOrder = true;
    try {
      const res = await adminApi.createOrderFromSalesPoint(point.id, {
        userId: selectedCustomerId,
        shippingAddressId: selectedAddressId,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          price: i.price,
        })),
        notes: orderNotes || null,
      });
      notificationStore.success(
        t('admin.salesPoints.orderCreated', { orderNumber: res.order.orderNumber })
      );
      showCreateOrderModal = false;
      await loadPoint();
      goto(`/admin/orders/${res.order.id}`);
    } catch (e) {
      notificationStore.error(
        e instanceof Error ? e.message : t('admin.salesPoints.failedToCreateOrder')
      );
    } finally {
      creatingOrder = false;
    }
  }

  let orderCustomerSearchTimeout: ReturnType<typeof setTimeout>;
  $: if (showCreateOrderModal && orderCustomerSearch) {
    clearTimeout(orderCustomerSearchTimeout);
    orderCustomerSearchTimeout = setTimeout(loadOrderCustomers, 300);
  }
</script>

<svelte:head>
  <title
    >{point?.name
      ? t('admin.salesPoints.pageTitleDetail', { name: point.name })
      : t('admin.salesPoints.pageTitleDefault')}</title
  >
</svelte:head>

<div>
  <div class="flex items-center gap-4 mb-6">
    <button
      on:click={() => goto('/admin/sales-points')}
      class="text-accent-muted hover:text-accent transition-colors"
    >
      ← {t('common.back')}
    </button>
    <h2 class="text-3xl font-bold">{point?.name ?? t('admin.salesPoints.salesPoint')}</h2>
    {#if point}
      <span class="px-2 py-1 rounded bg-white/10 text-sm">{typeLabel(point.type)}</span>
    {/if}
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{error}</p>
  {:else if point}
    <div class="space-y-6">
      <div class="bg-dark-light p-6 border border-white/10">
        <h3 class="text-xl font-medium mb-4">{t('admin.salesPoints.info')}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-accent-muted">{t('common.type')}</p>
            <p class="font-medium">{typeLabel(point.type)}</p>
          </div>
          {#if point.warehouse}
            <div>
              <p class="text-sm text-accent-muted">{t('admin.salesPoints.warehouse')}</p>
              <p class="font-medium">{point.warehouse.name}</p>
            </div>
          {/if}
          {#if point._count}
            <div>
              <p class="text-sm text-accent-muted">{t('admin.salesPoints.productsOrders')}</p>
              <p class="font-medium">
                {point._count.products ?? point.products?.length ?? 0} / {point._count.orders ?? 0}
              </p>
            </div>
          {/if}
        </div>
      </div>

      <div class="bg-dark-light p-6 border border-white/10">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-medium">{t('admin.salesPoints.productsInPoint')}</h3>
          <div class="flex gap-2">
            {#if point.products && point.products.length > 0}
              <button
                on:click={openCreateOrderModal}
                class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                {t('admin.salesPoints.createOrder')}
              </button>
            {/if}
            {#if !addingProduct}
              <button
                on:click={() => (addingProduct = true)}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
              >
                {t('admin.salesPoints.addProduct')}
              </button>
            {/if}
          </div>
        </div>

        {#if addingProduct}
          <div class="mt-4 p-4 border border-white/10 rounded">
            <h4 class="font-medium mb-3">{t('admin.salesPoints.addProductTitle')}</h4>
            {#if !selectedProduct}
              <div class="mb-3">
                <input
                  type="text"
                  bind:value={productSearch}
                  placeholder={t('admin.salesPoints.productSearchPlaceholder')}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                />
                {#if searchingProducts}
                  <p class="text-sm text-accent-muted mt-1">{t('admin.salesPoints.searching')}</p>
                {:else if searchResults.length > 0}
                  <ul
                    class="mt-2 border border-white/10 divide-y divide-white/10 max-h-48 overflow-auto"
                  >
                    {#each searchResults as p}
                      <li>
                        <button
                          type="button"
                          on:click={() => selectProduct(p)}
                          class="w-full px-4 py-2 text-left hover:bg-white/10 flex items-center gap-2"
                        >
                          {#if getFirstImageUrl(p.images)}
                            <img
                              src={getFirstImageUrl(p.images)}
                              alt=""
                              class="w-10 h-10 object-cover"
                            />
                          {/if}
                          <span>{p.name} ({p.sku})</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {:else}
              <div class="space-y-3">
                <p class="font-medium">
                  {t('admin.salesPoints.selected')}: {selectedProduct.name}
                  <button
                    type="button"
                    on:click={clearSelection}
                    class="ml-2 text-sm text-accent-muted hover:text-accent"
                  >
                    {t('admin.salesPoints.change')}
                  </button>
                </p>
                {#if selectedProduct.variants && selectedProduct.variants.length > 0}
                  <div>
                    <label for="selectedVariant" class="block text-sm font-medium mb-1"
                      >{t('admin.salesPoints.variantOptional')}</label
                    >
                    <select
                      id="selectedVariant"
                      bind:value={selectedVariantId}
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                    >
                      <option value={null}>{t('admin.salesPoints.allVariants')}</option>
                      {#each selectedProduct.variants as v}
                        <option value={v.id}>{v.name} ({v.sku})</option>
                      {/each}
                    </select>
                  </div>
                {/if}
                {#if point.type === 'MARKETPLACE'}
                  <div>
                    <label for="selectedShipmentWarehouse" class="block text-sm font-medium mb-1"
                      >{t('admin.salesPoints.shipmentWarehouseRequired')}</label
                    >
                    <select
                      id="selectedShipmentWarehouse"
                      bind:value={selectedWarehouseId}
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                    >
                      <option value={null}>{t('admin.salesPoints.selectWarehouse')}</option>
                      {#each warehouses as w}
                        <option value={w.id}>{w.name}</option>
                      {/each}
                    </select>
                  </div>
                {/if}
                <div class="flex gap-2">
                  <button
                    on:click={addProduct}
                    disabled={adding || (point.type === 'MARKETPLACE' && !selectedWarehouseId)}
                    class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50"
                  >
                    {adding ? t('admin.salesPoints.adding') : t('common.add')}
                  </button>
                  <button
                    on:click={() => {
                      addingProduct = false;
                      clearSelection();
                    }}
                    class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-100"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        {#if point.products && point.products.length > 0}
          <div class="mt-6 space-y-4">
            {#each point.products as item}
              <div
                class="flex items-center justify-between py-3 border-b border-white/10 last:border-0"
              >
                <div class="flex items-center gap-4">
                  {#if item.product && getFirstImageUrl(item.product.images)}
                    <img
                      src={getFirstImageUrl(item.product.images)}
                      alt=""
                      class="w-16 h-16 object-cover"
                    />
                  {:else}
                    <div
                      class="w-16 h-16 bg-white/10 flex items-center justify-center text-accent-muted text-xs"
                    >
                      {t('admin.salesPoints.noImage')}
                    </div>
                  {/if}
                  <div>
                    <p class="font-medium">{item.product?.name ?? item.productId}</p>
                    {#if item.variant}
                      <p class="text-sm text-accent-muted">{item.variant.name}</p>
                    {/if}
                    {#if item.warehouse}
                      <p class="text-sm text-accent-muted">
                        {t('admin.salesPoints.warehouseLabel', { name: item.warehouse.name })}
                      </p>
                    {/if}
                  </div>
                </div>
                <button
                  on:click={() => removeProduct(item.id)}
                  disabled={removingId === item.id}
                  class="px-3 py-1 text-red-400 hover:text-red-500 hover:bg-red-50 rounded text-sm disabled:opacity-50"
                >
                  {t('common.delete')}
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-accent-muted mt-4">{t('admin.salesPoints.noProducts')}</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if showCreateOrderModal}
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div
        class="bg-dark-light border border-white/10 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div class="p-6">
          <h3 class="text-xl font-medium mb-4">{t('admin.salesPoints.createOrderFromPoint')}</h3>

          <div class="space-y-4">
            <div>
              <p class="block text-sm font-medium mb-1">{t('admin.salesPoints.customer')}</p>
              <input
                type="text"
                bind:value={orderCustomerSearch}
                placeholder={t('admin.salesPoints.searchByEmail')}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-2"
              />
              <select
                bind:value={selectedCustomerId}
                on:change={onCustomerSelect}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="">{t('admin.salesPoints.selectCustomer')}</option>
                {#each orderCustomers as c}
                  <option value={c.id}
                    >{c.email} {c.firstName ? `(${c.firstName} ${c.lastName || ''})` : ''}</option
                  >
                {/each}
              </select>
            </div>

            {#if selectedCustomerId}
              <div>
                <label for="selectedCustomerAddress" class="block text-sm font-medium mb-1"
                  >{t('admin.salesPoints.shippingAddress')}</label
                >
                {#if customerAddresses.length === 0}
                  <p class="text-yellow-500 text-sm">{t('admin.salesPoints.noAddresses')}</p>
                {:else}
                  <select
                    id="selectedCustomerAddress"
                    bind:value={selectedAddressId}
                    class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                  >
                    <option value="">{t('admin.salesPoints.selectAddress')}</option>
                    {#each customerAddresses as a}
                      <option value={a.id}>{a.address}</option>
                    {/each}
                  </select>
                {/if}
              </div>
            {/if}

            <div>
              <p class="block text-sm font-medium mb-2">
                {t('admin.salesPoints.productsQuantityPrice')}
              </p>
              <div class="border border-white/10 rounded overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-white/5">
                    <tr>
                      <th class="text-left px-4 py-2">{t('admin.salesPoints.product')}</th>
                      <th class="text-left px-4 py-2 w-24">{t('admin.salesPoints.qty')}</th>
                      <th class="text-left px-4 py-2 w-28">{t('admin.salesPoints.price')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each orderItems as item}
                      <tr class="border-t border-white/10">
                        <td class="px-4 py-2">
                          {item.productName}
                          {#if item.variantName}
                            <span class="text-accent-muted text-xs">({item.variantName})</span>
                          {/if}
                        </td>
                        <td class="px-4 py-2">
                          <input
                            type="number"
                            bind:value={item.quantity}
                            min="0"
                            class="w-full px-2 py-1 bg-white border border-gray-300 text-black"
                          />
                        </td>
                        <td class="px-4 py-2">
                          <input
                            type="number"
                            bind:value={item.price}
                            min="0"
                            step="0.01"
                            class="w-full px-2 py-1 bg-white border border-gray-300 text-black"
                          />
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label for="orderNote" class="block text-sm font-medium mb-1"
                >{t('admin.salesPoints.note')}</label
              >
              <textarea
                id="orderNote"
                bind:value={orderNotes}
                rows="2"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              ></textarea>
            </div>
          </div>

          <div class="flex gap-2 justify-end mt-6">
            <button
              on:click={() => (showCreateOrderModal = false)}
              class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-100"
            >
              {t('common.cancel')}
            </button>
            <button
              on:click={submitCreateOrder}
              disabled={creatingOrder || !selectedAddressId || customerAddresses.length === 0}
              class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50"
            >
              {creatingOrder
                ? t('admin.salesPoints.creating')
                : t('admin.salesPoints.createOrderButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
