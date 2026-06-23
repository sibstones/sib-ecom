<script lang="ts">
  import { onMount } from 'svelte';
  import { customerApi, type CustomerAddress } from '$lib/api/customer.api';
  import { t } from '$lib/utils/i18n';
  import AccountAddressesSkeleton from '$lib/components/account/AccountAddressesSkeleton.svelte';

  let addresses: CustomerAddress[] = [];
  let loading = true;
  let error = '';
  let editing: string | null = null;
  let creating = false;

  let formData = {
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    isDefault: false,
  };

  onMount(async () => {
    await loadAddresses();
  });

  async function loadAddresses() {
    loading = true;
    try {
      const response = await customerApi.getAddresses();
      addresses = response.addresses;
    } catch (e) {
      error = e instanceof Error ? e.message : t('address.failedToLoad');
    } finally {
      loading = false;
    }
  }

  function startEdit(address: CustomerAddress) {
    editing = address.id;
    formData = {
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone || '',
      address: address.address,
      city: address.city,
      country: address.country,
      postalCode: address.postalCode || '',
      isDefault: address.isDefault,
    };
  }

  function startCreate() {
    creating = true;
    formData = {
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      postalCode: '',
      isDefault: false,
    };
  }

  async function saveAddress() {
    try {
      if (editing) {
        await customerApi.updateAddress(editing, formData);
      } else {
        await customerApi.createAddress(formData);
      }
      editing = null;
      creating = false;
      await loadAddresses();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('address.failedToSave'));
    }
  }

  async function deleteAddress(addressId: string) {
    if (!confirm(t('address.deleteConfirm'))) return;

    try {
      await customerApi.deleteAddress(addressId);
      await loadAddresses();
    } catch (e) {
      alert(t('address.failedToDelete'));
    }
  }
</script>

<div class="flex justify-between items-center mb-6">
  <h3 class="text-xl font-medium">{t('address.addresses')}</h3>
  {#if !creating && !editing}
    <button
      on:click={startCreate}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('address.addAddress')}
    </button>
  {/if}
</div>

{#if loading}
  <AccountAddressesSkeleton />
{:else if error}
  <p class="text-red-400">{t('common.error')}: {error}</p>
{:else}
  <div class="space-y-4">
    {#if creating || editing}
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-medium mb-4">
          {editing ? t('address.editAddress') : t('address.newAddress')}
        </h3>
        <form on:submit|preventDefault={saveAddress} class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2" for="address-first-name"
                >{t('profile.firstName')}</label
              >
              <input
                id="address-first-name"
                type="text"
                bind:value={formData.firstName}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2" for="address-last-name"
                >{t('profile.lastName')}</label
              >
              <input
                id="address-last-name"
                type="text"
                bind:value={formData.lastName}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2" for="address-line"
              >{t('common.address')}</label
            >
            <input
              id="address-line"
              type="text"
              bind:value={formData.address}
              required
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2" for="address-city"
                >{t('common.city')}</label
              >
              <input
                id="address-city"
                type="text"
                bind:value={formData.city}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2" for="address-country"
                >{t('common.country')}</label
              >
              <input
                id="address-country"
                type="text"
                bind:value={formData.country}
                required
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2" for="address-postal-code"
                >{t('address.postalCode')}</label
              >
              <input
                id="address-postal-code"
                type="text"
                bind:value={formData.postalCode}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2" for="address-phone"
                >{t('address.phoneLabel')}</label
              >
              <input
                id="address-phone"
                type="tel"
                bind:value={formData.phone}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              bind:checked={formData.isDefault}
              id="isDefault"
              class="w-4 h-4"
            />
            <label for="isDefault" class="text-sm">{t('address.setAsDefault')}</label>
          </div>
          <div class="flex gap-4">
            <button
              type="submit"
              class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
            >
              {t('profile.save')}
            </button>
            <button
              type="button"
              on:click={() => {
                editing = null;
                creating = false;
              }}
              class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
            >
              {t('profile.cancel')}
            </button>
          </div>
        </form>
      </div>
    {/if}

    {#each addresses as address}
      <div class="bg-dark-light p-6">
        <div class="flex justify-between items-start">
          <div>
            {#if address.isDefault}
              <span class="inline-block px-2 py-1 bg-accent text-dark text-xs mb-2">
                {t('address.default')}
              </span>
            {/if}
            <p class="text-lg font-medium mb-2">
              {address.firstName}
              {address.lastName}
            </p>
            <p class="text-accent-muted">{address.address}</p>
            <p class="text-accent-muted">
              {address.city}, {address.country}
              {address.postalCode}
            </p>
            {#if address.phone}
              <p class="text-accent-muted mt-2">{t('address.phoneLabel')}: {address.phone}</p>
            {/if}
          </div>
          <div class="flex gap-2">
            <button
              on:click={() => startEdit(address)}
              class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
            >
              {t('profile.edit')}
            </button>
            <button
              on:click={() => deleteAddress(address.id)}
              class="px-4 py-2 bg-white border border-red-500/20 hover:bg-red-50 transition-colors text-red-400"
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    {:else}
      {#if !creating}
        <div class="bg-dark-light p-12 text-center">
          <p class="text-xl text-accent-muted mb-4">{t('address.noAddressesSaved')}</p>
          <button
            on:click={startCreate}
            class="px-6 py-3 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('address.addYourFirstAddress')}
          </button>
        </div>
      {/if}
    {/each}
  </div>
{/if}
