<script lang="ts">
  import { onMount } from 'svelte';
  import { countryApi, type Country } from '$lib/api/country.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import AdminKebabMenu from '$lib/components/admin/AdminKebabMenu.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';

  let countries: Country[] = [];
  let loading = true;
  let showAddForm = false;
  let editingCountry: Country | null = null;
  /** When set, edit form is shown inline under this country's row */
  let editingCountryId: string | null = null;
  /** When set, actions dropdown is open for this country id */
  let openActionsId: string | null = null;

  function toggleActions(id: string) {
    openActionsId = openActionsId === id ? null : id;
  }

  function closeActions() {
    openActionsId = null;
  }

  let formData = {
    code: '',
    name: '',
    nameNative: '',
    currency: '',
    language: '',
    taxRate: 0.1,
    shippingCost: 10,
    freeShippingThreshold: 100,
    isActive: true,
    isDefault: false,
    sortOrder: 0,
  };

  onMount(async () => {
    await loadCountries();
  });

  async function loadCountries(noCache = false) {
    loading = true;
    try {
      const response = await countryApi.getAll(false, noCache ? { cache: 'no-store' } : undefined);
      const list = response?.countries ?? [];
      countries = Array.isArray(list) ? [...list] : [];
    } catch (e) {
      notificationStore.error(t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function openAddForm() {
    editingCountry = null;
    editingCountryId = null;
    showAddForm = true;
    formData = {
      code: '',
      name: '',
      nameNative: '',
      currency: '',
      language: '',
      taxRate: 0.1,
      shippingCost: 10,
      freeShippingThreshold: 100,
      isActive: true,
      isDefault: false,
      sortOrder: 0,
    };
  }

  function openEditForm(country: Country) {
    showAddForm = false;
    editingCountry = country;
    editingCountryId = country.id;
    formData = {
      code: country.code,
      name: country.name,
      nameNative: country.nameNative || '',
      currency: country.currency,
      language: country.language,
      taxRate: country.taxRate,
      shippingCost: country.shippingCost,
      freeShippingThreshold: country.freeShippingThreshold ?? 100,
      isActive: country.isActive,
      isDefault: country.isDefault,
      sortOrder: country.sortOrder,
    };
  }

  function closeForm() {
    showAddForm = false;
    editingCountry = null;
    editingCountryId = null;
  }

  async function saveCountry() {
    try {
      if (editingCountry) {
        // Backend update schema does not accept `code`; numbers must be number type (not null/string)
        const updateData = {
          name: formData.name?.trim() ?? '',
          nameNative: formData.nameNative?.trim() ?? undefined,
          currency: (formData.currency?.trim() ?? '').toUpperCase(),
          language: (formData.language?.trim() ?? '').toLowerCase(),
          taxRate: Number(formData.taxRate),
          shippingCost: Number(formData.shippingCost),
          freeShippingThreshold:
            formData.freeShippingThreshold != null &&
            String(formData.freeShippingThreshold).trim() !== ''
              ? Number(formData.freeShippingThreshold)
              : null,
          isActive: Boolean(formData.isActive),
          isDefault: Boolean(formData.isDefault),
          sortOrder: Number(formData.sortOrder) || 0,
        };
        await countryApi.update(editingCountry.id, updateData);
      } else {
        const createData = {
          code: (formData.code?.trim() ?? '').toUpperCase(),
          name: formData.name?.trim() ?? '',
          nameNative: formData.nameNative?.trim() || undefined,
          currency: (formData.currency?.trim() ?? '').toUpperCase(),
          language: (formData.language?.trim() ?? '').toLowerCase(),
          taxRate: Number(formData.taxRate),
          shippingCost: Number(formData.shippingCost) ?? 0,
          freeShippingThreshold:
            formData.freeShippingThreshold != null &&
            String(formData.freeShippingThreshold).trim() !== ''
              ? Number(formData.freeShippingThreshold)
              : null,
          isActive: Boolean(formData.isActive),
          isDefault: Boolean(formData.isDefault),
          sortOrder: Number(formData.sortOrder) || 0,
        };
        await countryApi.create(createData);
      }
      closeForm();
      await loadCountries(true);
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(t('error.failedToSave'));
    }
  }

  async function deleteCountry(id: string) {
    const confirmed = await dialogStore.confirm(t('alert.deleteCountry'), t('common.confirm'));
    if (!confirmed) return;
    try {
      await countryApi.delete(id);
      await loadCountries(true);
      notificationStore.success(t('common.success'));
    } catch (e) {
      notificationStore.error(t('error.failedToDelete'));
    }
  }

  async function setDefault(id: string) {
    try {
      await countryApi.setDefault(id);
      await loadCountries(true);
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(t('error.failedToUpdate'));
    }
  }
</script>

<svelte:window on:click={closeActions} />

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('menu.countries')}</h2>
    <button
      type="button"
      on:click={openAddForm}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('country.addCountry')}
    </button>
  </div>

  <!-- Add country form (only at top when adding new) -->
  {#if showAddForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('country.addCountry')}</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="country-code" class="block text-sm font-medium mb-2"
              >{t('country.codeIso')}</label
            >
            <input
              id="country-code"
              type="text"
              bind:value={formData.code}
              maxlength="2"
              disabled={!!editingCountry}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
              placeholder="US"
            />
          </div>
          <div>
            <label for="country-name" class="block text-sm font-medium mb-2"
              >{t('common.name')}</label
            >
            <input
              id="country-name"
              type="text"
              bind:value={formData.name}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="United States"
            />
          </div>
        </div>
        <div>
          <label for="country-native-name" class="block text-sm font-medium mb-2"
            >{t('country.nativeNameOptional')}</label
          >
          <input
            id="country-native-name"
            type="text"
            bind:value={formData.nameNative}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder="United States"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="country-currency" class="block text-sm font-medium mb-2"
              >{t('country.currencyCode')}</label
            >
            <input
              id="country-currency"
              type="text"
              bind:value={formData.currency}
              maxlength="3"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="USD"
            />
          </div>
          <div>
            <label for="country-language" class="block text-sm font-medium mb-2"
              >{t('country.languageCode')}</label
            >
            <input
              id="country-language"
              type="text"
              bind:value={formData.language}
              maxlength="2"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="en"
            />
          </div>
        </div>
        <div class="border-t border-gray-300 pt-4 mt-4">
          <h4 class="text-lg font-medium mb-4">{t('country.taxAndShipping')}</h4>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label for="country-tax-rate" class="block text-sm font-medium mb-2"
                >{t('country.taxRate')}</label
              >
              <input
                id="country-tax-rate"
                type="number"
                bind:value={formData.taxRate}
                step="0.01"
                min="0"
                max="1"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="0.1"
              />
              <p class="text-xs text-gray-500 mt-1">{t('country.taxRateDescription')}</p>
            </div>
            <div>
              <label for="country-shipping-cost" class="block text-sm font-medium mb-2"
                >{t('country.shippingCost')}</label
              >
              <input
                id="country-shipping-cost"
                type="number"
                bind:value={formData.shippingCost}
                step="0.01"
                min="0"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="10"
              />
              <p class="text-xs text-gray-500 mt-1">{t('country.shippingCostDescription')}</p>
            </div>
            <div>
              <label for="country-free-shipping" class="block text-sm font-medium mb-2"
                >{t('country.freeShippingThreshold')}</label
              >
              <input
                id="country-free-shipping"
                type="number"
                bind:value={formData.freeShippingThreshold}
                step="0.01"
                min="0"
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="100"
              />
              <p class="text-xs text-gray-500 mt-1">
                {t('country.freeShippingThresholdDescription')}
              </p>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.isActive} id="isActive" />
            <label for="isActive" class="text-sm">{t('common.active')}</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.isDefault} id="isDefault" />
            <label for="isDefault" class="text-sm">{t('country.default')}</label>
          </div>
          <div>
            <label for="country-sort-order" class="block text-sm font-medium mb-2"
              >{t('common.sortOrder')}</label
            >
            <input
              id="country-sort-order"
              type="number"
              bind:value={formData.sortOrder}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>
        <div class="flex gap-4">
          <button
            type="button"
            on:click={saveCountry}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
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
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if countries.length === 0}
    <p class="text-accent-muted">{t('country.noCountries')}</p>
  {:else}
    <div class="bg-white">
      <table class="w-full min-w-[800px]">
        <thead class="bg-white">
          <tr>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.code')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.name')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('country.currency')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('country.language')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('country.taxRate')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('country.shippingCost')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.status')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium w-0">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each countries as country}
            <tr class="border-t border-accent/10">
              <td class="px-4 py-2">
                <span class="font-mono text-sm">{country.code}</span>
                {#if country.isDefault}
                  <span class="ml-2 px-2 py-1 bg-accent/20 text-accent text-xs"
                    >{t('country.isDefault')}</span
                  >
                {/if}
              </td>
              <td class="px-4 py-2">
                <div>
                  <p class="font-medium">{country.name}</p>
                  {#if country.nameNative}
                    <p class="text-sm text-accent-muted">{country.nameNative}</p>
                  {/if}
                </div>
              </td>
              <td class="px-4 py-2 font-mono text-sm">{country.currency}</td>
              <td class="px-4 py-2 font-mono text-sm">{country.language}</td>
              <td class="px-4 py-2">
                <span class="font-mono text-sm"
                  >{((Number(country.taxRate) ?? 0) * 100).toFixed(1)}%</span
                >
              </td>
              <td class="px-4 py-3">
                <div class="text-sm">
                  <span class="font-mono"
                    >{(Number(country.shippingCost) ?? 0).toFixed(2)} {country.currency}</span
                  >
                  {#if country.freeShippingThreshold != null}
                    <p class="text-xs text-gray-500 mt-1">
                      {t('country.freeShippingAbove')}
                      {(Number(country.freeShippingThreshold) ?? 0).toFixed(2)}
                    </p>
                  {/if}
                </div>
              </td>
              <td class="px-4 py-2">
                <span
                  class="px-2 py-0.5 text-xs {country.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'}"
                >
                  {country.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </td>
              <td class="px-4 py-2 align-middle">
                <AdminKebabMenu
                  open={openActionsId === country.id}
                  title={t('common.actions')}
                  menuToggle={() => toggleActions(country.id)}
                >
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      openEditForm(country);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                  >
                    {t('common.edit')}
                  </button>
                  {#if !country.isDefault}
                    <button
                      type="button"
                      role="menuitem"
                      on:click={() => {
                        setDefault(country.id);
                        closeActions();
                      }}
                      class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                    >
                      {t('country.setDefault')}
                    </button>
                  {/if}
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      deleteCountry(country.id);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600"
                  >
                    {t('common.delete')}
                  </button>
                </AdminKebabMenu>
              </td>
            </tr>
            <!-- Edit form inline under this country's row -->
            {#if editingCountryId === country.id}
              <tr class="border-t-0 bg-dark-light/50">
                <td colspan="8" class="px-4 py-4">
                  <div class="p-4 border-2 border-accent/30 rounded-lg">
                    <h3 class="text-lg font-medium mb-4">
                      {t('country.editCountry')} — {country.code}
                    </h3>
                    <div class="space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            for={`country-code-${country.id}`}
                            class="block text-sm font-medium mb-2">{t('country.codeIso')}</label
                          >
                          <input
                            id={`country-code-${country.id}`}
                            type="text"
                            bind:value={formData.code}
                            maxlength="2"
                            disabled
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label
                            for={`country-name-${country.id}`}
                            class="block text-sm font-medium mb-2">{t('common.name')}</label
                          >
                          <input
                            id={`country-name-${country.id}`}
                            type="text"
                            bind:value={formData.name}
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            placeholder="United States"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          for={`country-native-name-${country.id}`}
                          class="block text-sm font-medium mb-2"
                          >{t('country.nativeNameOptional')}</label
                        >
                        <input
                          id={`country-native-name-${country.id}`}
                          type="text"
                          bind:value={formData.nameNative}
                          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            for={`country-currency-${country.id}`}
                            class="block text-sm font-medium mb-2"
                            >{t('country.currencyCode')}</label
                          >
                          <input
                            id={`country-currency-${country.id}`}
                            type="text"
                            bind:value={formData.currency}
                            maxlength="3"
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                          />
                        </div>
                        <div>
                          <label
                            for={`country-language-${country.id}`}
                            class="block text-sm font-medium mb-2"
                            >{t('country.languageCode')}</label
                          >
                          <input
                            id={`country-language-${country.id}`}
                            type="text"
                            bind:value={formData.language}
                            maxlength="2"
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                          />
                        </div>
                      </div>
                      <div class="border-t border-gray-300 pt-4 mt-4">
                        <h4 class="text-sm font-medium mb-3">{t('country.taxAndShipping')}</h4>
                        <div class="grid grid-cols-3 gap-4">
                          <div>
                            <label
                              for={`country-tax-rate-${country.id}`}
                              class="block text-sm font-medium mb-2">{t('country.taxRate')}</label
                            >
                            <input
                              id={`country-tax-rate-${country.id}`}
                              type="number"
                              bind:value={formData.taxRate}
                              step="0.01"
                              min="0"
                              max="1"
                              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            />
                          </div>
                          <div>
                            <label
                              for={`country-shipping-cost-${country.id}`}
                              class="block text-sm font-medium mb-2"
                              >{t('country.shippingCost')}</label
                            >
                            <input
                              id={`country-shipping-cost-${country.id}`}
                              type="number"
                              bind:value={formData.shippingCost}
                              step="0.01"
                              min="0"
                              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            />
                          </div>
                          <div>
                            <label
                              for={`country-free-shipping-${country.id}`}
                              class="block text-sm font-medium mb-2"
                              >{t('country.freeShippingThreshold')}</label
                            >
                            <input
                              id={`country-free-shipping-${country.id}`}
                              type="number"
                              bind:value={formData.freeShippingThreshold}
                              step="0.01"
                              min="0"
                              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            />
                          </div>
                        </div>
                      </div>
                      <div class="grid grid-cols-3 gap-4 items-center">
                        <label class="flex items-center gap-2">
                          <input type="checkbox" bind:checked={formData.isActive} class="w-4 h-4" />
                          <span class="text-sm">{t('common.active')}</span>
                        </label>
                        <label class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            bind:checked={formData.isDefault}
                            class="w-4 h-4"
                          />
                          <span class="text-sm">{t('country.default')}</span>
                        </label>
                        <div>
                          <label
                            for={`country-sort-order-${country.id}`}
                            class="block text-sm font-medium mb-2">{t('common.sortOrder')}</label
                          >
                          <input
                            id={`country-sort-order-${country.id}`}
                            type="number"
                            bind:value={formData.sortOrder}
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                          />
                        </div>
                      </div>
                      <div class="flex gap-4 pt-2">
                        <button
                          type="button"
                          on:click={saveCountry}
                          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
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
  {/if}
</div>
