<script lang="ts">
  import {
    adminManagementApi,
    type Admin,
    type CreateAdminDto,
    type AdminPermissions,
  } from '$lib/api/admin-management.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import AdminKebabMenu from '$lib/components/admin/AdminKebabMenu.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { authStore } from '$lib/stores/auth.store';
  import { goto } from '$app/navigation';

  let admins: Admin[] = [];
  let loading = false;
  let error = '';
  let showCreateForm = false;
  let showPasswordModal = false;
  let generatedPassword = '';
  let page = 1;
  let limit = 20;
  let total = 0;
  /** When set, edit form is shown inline under this admin's row */
  let editingAdminId: string | null = null;
  let editingAdmin: Admin | null = null;
  /** When set, actions dropdown is open for this admin id */
  let openActionsId: string | null = null;

  function toggleActions(id: string) {
    openActionsId = openActionsId === id ? null : id;
  }

  function closeActions() {
    openActionsId = null;
  }

  let formData: CreateAdminDto = {
    email: '',
    firstName: '',
    lastName: '',
    role: 'ADMIN',
    permissions: {
      canManageSupport: false,
      canManageOrders: false,
      canManageInventory: false,
      canManagePayments: false,
      canManageProducts: false,
      canManageCategories: false,
      canManageBrands: false,
      canManageCustomers: false,
      canManagePromoCodes: false,
      canManageContent: false,
      canManageSettings: false,
      canViewReports: false,
    },
  };

  const defaultPermissions: AdminPermissions = {
    canManageSupport: false,
    canManageOrders: false,
    canManageInventory: false,
    canManagePayments: false,
    canManageProducts: false,
    canManageCategories: false,
    canManageBrands: false,
    canManageCustomers: false,
    canManagePromoCodes: false,
    canManageContent: false,
    canManageSettings: false,
    canViewReports: false,
  };

  let editFormData = {
    firstName: '',
    lastName: '',
    permissions: { ...defaultPermissions },
  };
  let hasLoadedAdmins = false;

  // Permission presets
  const permissionPresets = {
    support: {
      canManageSupport: true,
      canManageCustomers: true,
    },
    orders: {
      canManageOrders: true,
      canManageCustomers: true,
    },
    inventory: {
      canManageInventory: true,
      canManageProducts: true,
    },
    payments: {
      canManagePayments: true,
    },
    warehouse: {
      canManageInventory: true,
    },
  };

  $: isSuperAdmin = $authStore.user?.role === 'SUPER_ADMIN';

  $: if ($authStore.sessionResolved && !isSuperAdmin) {
    goto('/admin/dashboard');
  }

  $: if ($authStore.sessionResolved && isSuperAdmin && !hasLoadedAdmins) {
    hasLoadedAdmins = true;
    loadAdmins();
  }

  async function loadAdmins() {
    loading = true;
    error = '';
    try {
      const result = await adminManagementApi.getAllAdmins(page, limit);
      admins = result.admins;
      total = result.total;
    } catch (e: any) {
      error = e.message || t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    formData = {
      email: '',
      firstName: '',
      lastName: '',
      role: 'ADMIN',
      permissions: { ...defaultPermissions },
    };
  }

  function applyPreset(presetName: keyof typeof permissionPresets) {
    const preset = permissionPresets[presetName];
    formData.permissions = { ...formData.permissions, ...preset };
  }

  function openEditForm(admin: Admin) {
    editingAdmin = admin;
    editingAdminId = admin.id;
    editFormData = {
      firstName: admin.firstName ?? '',
      lastName: admin.lastName ?? '',
      permissions: admin.permissions
        ? { ...defaultPermissions, ...admin.permissions }
        : { ...defaultPermissions },
    };
  }

  function closeForm() {
    editingAdminId = null;
    editingAdmin = null;
  }

  function applyPresetForEdit(presetName: keyof typeof permissionPresets) {
    const preset = permissionPresets[presetName];
    editFormData.permissions = { ...editFormData.permissions, ...preset };
  }

  async function updateAdmin() {
    if (!editingAdmin) return;
    loading = true;
    error = '';
    try {
      await adminManagementApi.updateAdmin(editingAdmin.id, {
        firstName: editFormData.firstName?.trim() || undefined,
        lastName: editFormData.lastName?.trim() || undefined,
        permissions: editFormData.permissions,
      });
      closeForm();
      await loadAdmins();
      notificationStore.success(t('common.saved'));
    } catch (e: any) {
      error = e.message || t('error.failedToSave');
    } finally {
      loading = false;
    }
  }

  async function createAdmin() {
    if (!formData.email) {
      error = 'Email is required';
      return;
    }

    loading = true;
    error = '';
    try {
      const result = await adminManagementApi.createAdmin(formData);
      generatedPassword = result.generatedPassword;
      showPasswordModal = true;
      showCreateForm = false;
      resetForm();
      await loadAdmins();
      notificationStore.success(t('common.saved'));
    } catch (e: any) {
      error = e.message || t('error.failedToSave');
    } finally {
      loading = false;
    }
  }

  async function toggleActive(admin: Admin) {
    const confirmed = await dialogStore.confirm(
      admin.isActive ? t('admin.deactivateConfirm') : t('admin.activateConfirm'),
      t('common.confirm')
    );
    if (!confirmed) return;

    loading = true;
    error = '';
    try {
      if (admin.isActive) {
        await adminManagementApi.deactivateAdmin(admin.id);
      } else {
        await adminManagementApi.activateAdmin(admin.id);
      }
      await loadAdmins();
      notificationStore.success(t('common.saved'));
    } catch (e: any) {
      error = e.message || t('error.failedToUpdate');
    } finally {
      loading = false;
    }
  }

  function getPermissionLabels(permissions: AdminPermissions | null): string[] {
    if (!permissions) return [];
    const labels: string[] = [];
    if (permissions.canManageSupport) labels.push(t('menu.supportTickets'));
    if (permissions.canManageOrders)
      labels.push(t('menu.orders') + ', ' + t('menu.returnRequests'));
    if (permissions.canManageInventory)
      labels.push(t('admin.inventory') + ', ' + t('menu.warehouses'));
    if (permissions.canManagePayments)
      labels.push(
        t('admin.payments') + ', ' + t('menu.paymentRequests') + ', ' + t('menu.paymentGateways')
      );
    if (permissions.canManageProducts) labels.push(t('menu.products'));
    if (permissions.canManageCategories) labels.push(t('menu.categories'));
    if (permissions.canManageBrands) labels.push(t('menu.brands'));
    if (permissions.canManageCustomers) labels.push(t('menu.customers'));
    if (permissions.canManagePromoCodes) labels.push(t('menu.promoCodes'));
    if (permissions.canManageContent)
      labels.push(
        t('admin.content') +
          ' (Homepage, Pages, Blog, Product Page Design, Header, Footer, Lookbook)'
      );
    if (permissions.canManageSettings)
      labels.push(
        t('menu.settings') +
          ' (Settings, License, Delivery Tracking, Countries, Languages, Currency Rates, Backups, Admins, Activity Logs, Marketing, Partners)'
      );
    if (permissions.canViewReports) labels.push(t('menu.reports') + ', ' + t('menu.dashboard'));
    return labels;
  }

  $: totalPages = Math.ceil(total / limit);
</script>

<svelte:window on:click={closeActions} />

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-2xl font-bold">{t('admin.adminManagement')}</h2>
    <button
      type="button"
      on:click={() => {
        showCreateForm = true;
        closeForm();
        resetForm();
      }}
      class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      + {t('admin.addAdmin')}
    </button>
  </div>

  {#if error}
    <div class="mb-4 p-4 bg-red-50 border border-red-200 text-red-700">
      {error}
    </div>
  {/if}

  {#if showCreateForm}
    <div class="mb-6 p-6 bg-dark-light">
      <h3 class="text-xl font-semibold mb-4">{t('admin.createNewAdmin')}</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label for="adminEmail" class="block text-sm font-medium mb-1"
            >{t('common.email')} *</label
          >
          <input
            id="adminEmail"
            type="email"
            bind:value={formData.email}
            class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
            placeholder="admin@example.com"
          />
        </div>
        <div>
          <label for="adminRole" class="block text-sm font-medium mb-1">{t('admin.role')}</label>
          <select
            id="adminRole"
            bind:value={formData.role}
            class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
          >
            <option value="ADMIN">{t('admin.admin')}</option>
            <option value="SUPER_ADMIN">{t('admin.superAdmin')}</option>
          </select>
        </div>
        <div>
          <label for="adminFirstName" class="block text-sm font-medium mb-1"
            >{t('admin.firstName')}</label
          >
          <input
            id="adminFirstName"
            type="text"
            bind:value={formData.firstName}
            class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
          />
        </div>
        <div>
          <label for="adminLastName" class="block text-sm font-medium mb-1"
            >{t('admin.lastName')}</label
          >
          <input
            id="adminLastName"
            type="text"
            bind:value={formData.lastName}
            class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
          />
        </div>
      </div>

      <div class="mb-4">
        <p class="block text-sm font-medium mb-2">{t('admin.quickPresets')}</p>
        <div class="flex gap-2 flex-wrap">
          <button
            type="button"
            on:click={() => applyPreset('support')}
            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            {t('admin.supportOnly')}
          </button>
          <button
            type="button"
            on:click={() => applyPreset('orders')}
            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            {t('admin.ordersProcessing')}
          </button>
          <button
            type="button"
            on:click={() => applyPreset('inventory')}
            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            {t('admin.inventoryManagement')}
          </button>
          <button
            type="button"
            on:click={() => applyPreset('payments')}
            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            {t('admin.paymentsOnly')}
          </button>
          <button
            type="button"
            on:click={() => applyPreset('warehouse')}
            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            {t('admin.warehouseOnly')}
          </button>
        </div>
      </div>

      <div class="mb-4">
        <p class="block text-sm font-medium mb-2">{t('admin.permissions')}</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageSupport}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.tickets')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageOrders}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.orders')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageInventory}
              class="mr-2"
            />
            <span class="text-sm">{t('admin.inventory')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManagePayments}
              class="mr-2"
            />
            <span class="text-sm">{t('admin.payments')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageProducts}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.products')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageCategories}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.categories')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageBrands}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.brands')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageCustomers}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.customers')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManagePromoCodes}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.promo')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageContent}
              class="mr-2"
            />
            <span class="text-sm">{t('admin.content')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canManageSettings}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.settings')}</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              bind:checked={formData.permissions.canViewReports}
              class="mr-2"
            />
            <span class="text-sm">{t('menu.reports')}</span>
          </label>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          on:click={createAdmin}
          disabled={loading}
          class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
        >
          {t('admin.createAdmin')}
        </button>
        <button
          type="button"
          on:click={() => {
            showCreateForm = false;
            resetForm();
          }}
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  {/if}

  {#if showPasswordModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-semibold mb-4">{t('admin.createdSuccessfully')}</h3>
        <p class="mb-4 text-gray-700">
          {t('admin.passwordGenerated')}
        </p>
        <div class="mb-4 p-4 bg-gray-100 border-2 border-dashed border-gray-300">
          <p class="font-mono text-lg font-bold text-center">{generatedPassword}</p>
        </div>
        <p class="mb-4 text-sm text-gray-600">
          {t('admin.passwordChangeHint')}
        </p>
        <button
          type="button"
          on:click={() => {
            showPasswordModal = false;
            generatedPassword = '';
          }}
          class="w-full px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  {/if}

  {#if loading && admins.length === 0}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else}
    <div class="bg-white">
      <table class="w-full min-w-[800px]">
        <thead class="bg-white">
          <tr>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.email')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.name')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('admin.role')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('admin.permissions')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.status')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium w-0">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each admins as admin (admin.id)}
            <tr class="border-t border-accent/10">
              <td class="px-4 py-2">{admin.email}</td>
              <td class="px-4 py-2">
                {admin.firstName || ''}
                {admin.lastName || ''}
              </td>
              <td class="px-4 py-2">
                <span class="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs">
                  {admin.role === 'SUPER_ADMIN' ? t('admin.superAdmin') : t('admin.admin')}
                </span>
              </td>
              <td class="px-4 py-2">
                <div class="flex flex-wrap gap-1">
                  {#each getPermissionLabels(admin.permissions) as label}
                    <span class="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs">{label}</span>
                  {/each}
                  {#if !admin.permissions || getPermissionLabels(admin.permissions).length === 0}
                    <span class="text-gray-400 text-xs">{t('admin.noPermissions')}</span>
                  {/if}
                </div>
              </td>
              <td class="px-4 py-2">
                <span
                  class="px-2 py-0.5 text-xs {admin.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'}"
                >
                  {admin.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </td>
              <td class="px-4 py-2 align-middle">
                <AdminKebabMenu
                  open={openActionsId === admin.id}
                  title={t('common.actions')}
                  menuToggle={() => toggleActions(admin.id)}
                >
                  <a
                    href="/admin/settings/admins/{admin.id}/activity-logs"
                    role="menuitem"
                    class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                  >
                    {t('admin.viewLogs')}
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      openEditForm(admin);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                  >
                    {t('common.edit')}
                  </button>
                  {#if admin.role !== 'SUPER_ADMIN'}
                    <button
                      type="button"
                      role="menuitem"
                      on:click={() => {
                        toggleActive(admin);
                        closeActions();
                      }}
                      class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                    >
                      {admin.isActive ? t('admin.deactivate') : t('admin.activate')}
                    </button>
                  {/if}
                </AdminKebabMenu>
              </td>
            </tr>
            <!-- Edit form inline under this admin's row -->
            {#if editingAdminId === admin.id}
              <tr class="border-t-0 bg-dark-light/50">
                <td colspan="6" class="px-4 py-4">
                  <div class="p-4 border-2 border-accent/30 rounded-lg">
                    <h3 class="text-lg font-medium mb-4">{t('common.edit')} — {admin.email}</h3>
                    <div class="space-y-4">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label for="editAdminFirstName" class="block text-sm font-medium mb-1"
                            >{t('admin.firstName')}</label
                          >
                          <input
                            id="editAdminFirstName"
                            type="text"
                            bind:value={editFormData.firstName}
                            class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
                          />
                        </div>
                        <div>
                          <label for="editAdminLastName" class="block text-sm font-medium mb-1"
                            >{t('admin.lastName')}</label
                          >
                          <input
                            id="editAdminLastName"
                            type="text"
                            bind:value={editFormData.lastName}
                            class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
                          />
                        </div>
                      </div>
                      <div>
                        <p class="block text-sm font-medium mb-2">{t('admin.quickPresets')}</p>
                        <div class="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            on:click={() => applyPresetForEdit('support')}
                            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            {t('admin.supportOnly')}
                          </button>
                          <button
                            type="button"
                            on:click={() => applyPresetForEdit('orders')}
                            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            {t('admin.ordersProcessing')}
                          </button>
                          <button
                            type="button"
                            on:click={() => applyPresetForEdit('inventory')}
                            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            {t('admin.inventoryManagement')}
                          </button>
                          <button
                            type="button"
                            on:click={() => applyPresetForEdit('payments')}
                            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            {t('admin.paymentsOnly')}
                          </button>
                          <button
                            type="button"
                            on:click={() => applyPresetForEdit('warehouse')}
                            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            {t('admin.warehouseOnly')}
                          </button>
                        </div>
                      </div>
                      <div>
                        <p class="block text-sm font-medium mb-2">{t('admin.permissions')}</p>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageSupport}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.tickets')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageOrders}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.orders')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageInventory}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('admin.inventory')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManagePayments}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('admin.payments')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageProducts}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.products')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageCategories}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.categories')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageBrands}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.brands')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageCustomers}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.customers')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManagePromoCodes}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.promo')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageContent}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('admin.content')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canManageSettings}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.settings')}</span>
                          </label>
                          <label class="flex items-center">
                            <input
                              type="checkbox"
                              bind:checked={editFormData.permissions.canViewReports}
                              class="mr-2"
                            />
                            <span class="text-sm">{t('menu.reports')}</span>
                          </label>
                        </div>
                      </div>
                      <div class="flex gap-4 pt-2">
                        <button
                          type="button"
                          on:click={updateAdmin}
                          disabled={loading}
                          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          type="button"
                          on:click={closeForm}
                          class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="mt-4 flex justify-center gap-2">
        <button
          on:click={() => {
            if (page > 1) {
              page--;
              loadAdmins();
            }
          }}
          disabled={page === 1}
          class="px-4 py-2 border disabled:opacity-50"
        >
          {t('common.previous')}
        </button>
        <span class="px-4 py-2">
          {t('common.page')}
          {page}
          {t('common.of')}
          {totalPages}
        </span>
        <button
          on:click={() => {
            if (page < totalPages) {
              page++;
              loadAdmins();
            }
          }}
          disabled={page === totalPages}
          class="px-4 py-2 border disabled:opacity-50"
        >
          {t('common.next')}
        </button>
      </div>
    {/if}
  {/if}
</div>
