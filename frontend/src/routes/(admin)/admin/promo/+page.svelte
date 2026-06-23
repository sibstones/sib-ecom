<script lang="ts">
  import { onMount } from 'svelte';
  import { promoApi, type PromoCode } from '$lib/api/promo.api';
  import { adminApi } from '$lib/api/admin.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { i18nStore } from '$lib/stores/i18n.store';

  let codes: PromoCode[] = [];
  let loading = true;
  let error = '';
  let creating = false;
  let userSearchQuery = '';
  let userSearchResults: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }> = [];
  let searchingUsers = false;
  let showUserSearch = false;

  let newCode = {
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED' | 'BALANCE',
    discountValue: 10,
    minPurchase: undefined as number | undefined,
    maxDiscount: undefined as number | undefined,
    usageLimit: undefined as number | undefined,
    userId: undefined as string | undefined,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
  };

  function formatDate(dateString: string) {
    const lang = $i18nStore;
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  onMount(async () => {
    await loadCodes();
  });

  async function loadCodes() {
    loading = true;
    try {
      const response = await promoApi.getAll(false);
      codes = response.codes;
    } catch (e) {
      error = e instanceof Error ? e.message : t('error.failedToLoad');
    } finally {
      loading = false;
    }
  }

  async function createCode() {
    try {
      await promoApi.create(newCode);
      newCode = {
        code: '',
        description: '',
        discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED' | 'BALANCE',
        discountValue: 10,
        minPurchase: undefined,
        maxDiscount: undefined,
        usageLimit: undefined,
        userId: undefined,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isActive: true,
      };
      userSearchQuery = '';
      userSearchResults = [];
      showUserSearch = false;
      creating = false;
      await loadCodes();
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : t('error.failedToSave'));
    }
  }

  async function deleteCode(id: string) {
    const confirmed = await dialogStore.confirm(t('alert.deletePromoCode'), t('common.confirm'));
    if (!confirmed) return;

    try {
      await promoApi.delete(id);
      await loadCodes();
    } catch (e) {
      notificationStore.error(t('error.failedToDelete'));
    }
  }

  async function searchUsers() {
    if (!userSearchQuery.trim()) {
      userSearchResults = [];
      return;
    }
    searchingUsers = true;
    try {
      const response = await adminApi.getAllCustomers(1, 10, { search: userSearchQuery });
      userSearchResults = response.customers;
    } catch (e) {
      console.error('Failed to search users:', e);
      userSearchResults = [];
    } finally {
      searchingUsers = false;
    }
  }

  function selectUser(user: { id: string; email: string; firstName?: string; lastName?: string }) {
    newCode.userId = user.id;
    userSearchQuery = `${user.firstName || ''} ${user.lastName || ''} (${user.email})`.trim();
    userSearchResults = [];
    showUserSearch = false;
  }

  function clearUser() {
    newCode.userId = undefined;
    userSearchQuery = '';
    userSearchResults = [];
    showUserSearch = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-search-container')) {
      showUserSearch = false;
    }
  }

  $: if (userSearchQuery.length > 2 && !newCode.userId) {
    searchUsers();
  } else if (userSearchQuery.length <= 2) {
    userSearchResults = [];
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('menu.promo')}</h2>
    {#if !creating}
      <button
        on:click={() => (creating = true)}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('promo.addPromoCode')}
      </button>
    {/if}
  </div>

  {#if creating}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('promo.newPromoCode')}</h3>
      <form on:submit|preventDefault={createCode} class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="promoCode" class="block text-sm font-medium mb-2"
              >{t('promo.codeRequired')}</label
            >
            <input
              id="promoCode"
              type="text"
              bind:value={newCode.code}
              required
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="SUMMER2024"
            />
          </div>
          <div>
            <label for="promoDiscountType" class="block text-sm font-medium mb-2"
              >{t('promo.discountTypeRequired')}</label
            >
            <select
              id="promoDiscountType"
              bind:value={newCode.discountType}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="PERCENTAGE">{t('promo.percentage')}</option>
              <option value="FIXED">{t('promo.fixedAmount')}</option>
              <option value="BALANCE">{t('promo.balance') || 'Balance (Gift Card)'}</option>
            </select>
          </div>
        </div>
        <div>
          <label for="promoDiscountValue" class="block text-sm font-medium mb-2">
            {newCode.discountType === 'BALANCE'
              ? (t('promo.balanceAmount') || 'Balance Amount') + ' *'
              : t('promo.discountValueRequired')}
          </label>
          <input
            id="promoDiscountValue"
            type="number"
            bind:value={newCode.discountValue}
            required
            min="0"
            step="0.01"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={newCode.discountType === 'BALANCE' ? '100.00' : undefined}
          />
          {#if newCode.discountType === 'BALANCE'}
            <p class="text-xs text-accent-muted mt-1">
              {t('promo.balanceHint') ||
                'Amount that can be deducted from the order total (like a gift card)'}
            </p>
          {/if}
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="promoMinPurchase" class="block text-sm font-medium mb-2"
              >{t('promo.minPurchase')}</label
            >
            <input
              id="promoMinPurchase"
              type="number"
              bind:value={newCode.minPurchase}
              min="0"
              step="0.01"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="promoMaxDiscount" class="block text-sm font-medium mb-2"
              >{t('promo.maxDiscount')}</label
            >
            <input
              id="promoMaxDiscount"
              type="number"
              bind:value={newCode.maxDiscount}
              min="0"
              step="0.01"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="promoUsageLimit" class="block text-sm font-medium mb-2"
              >{t('promo.usageLimit')}</label
            >
            <input
              id="promoUsageLimit"
              type="number"
              bind:value={newCode.usageLimit}
              min="1"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={newCode.discountType === 'BALANCE'
                ? '1 (recommended for gift cards)'
                : undefined}
            />
            {#if newCode.discountType === 'BALANCE'}
              <p class="text-xs text-accent-muted mt-1">
                {t('promo.usageLimitHint') || 'Recommended: 1 for one-time use (like a gift card)'}
              </p>
            {/if}
          </div>
          <div class="user-search-container">
            <label for="user-search-input" class="block text-sm font-medium mb-2"
              >{t('promo.assignToUser') || 'Assign to User (Optional)'}</label
            >
            <div class="relative">
              <input
                id="user-search-input"
                type="text"
                bind:value={userSearchQuery}
                on:focus={() => (showUserSearch = true)}
                on:blur={() => setTimeout(() => (showUserSearch = false), 200)}
                placeholder={t('promo.searchUser') || 'Search user by email or name...'}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                disabled={!!newCode.userId}
              />
              {#if newCode.userId}
                <button
                  type="button"
                  on:click={clearUser}
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700"
                  title={t('promo.clearUser') || 'Clear user'}
                >
                  ×
                </button>
              {/if}
              {#if showUserSearch && !newCode.userId && userSearchResults.length > 0}
                <div
                  class="absolute z-10 w-full mt-1 bg-white border border-gray-300 max-h-60 overflow-y-auto shadow-lg"
                >
                  {#each userSearchResults as user}
                    <button
                      type="button"
                      on:mousedown|preventDefault={() => selectUser(user)}
                      class="w-full text-left px-4 py-2 hover:bg-gray-100 text-black"
                    >
                      {user.firstName || ''}
                      {user.lastName || ''} ({user.email})
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            <p class="text-xs text-accent-muted mt-1">
              {t('promo.userHint') ||
                'Leave empty for public promo code, or assign to specific user for personal gift card'}
            </p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="promoValidFrom" class="block text-sm font-medium mb-2"
              >{t('promo.validFrom')} *</label
            >
            <input
              id="promoValidFrom"
              type="date"
              bind:value={newCode.validFrom}
              required
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="promoValidUntil" class="block text-sm font-medium mb-2"
              >{t('promo.validUntil')} *</label
            >
            <input
              id="promoValidUntil"
              type="date"
              bind:value={newCode.validUntil}
              required
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>
        <div>
          <label for="promoDescription" class="block text-sm font-medium mb-2"
            >{t('promo.description')}</label
          >
          <textarea
            id="promoDescription"
            bind:value={newCode.description}
            rows="3"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          ></textarea>
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" bind:checked={newCode.isActive} id="isActive" class="w-4 h-4" />
          <label for="isActive" class="text-sm">{t('promo.active')}</label>
        </div>
        <div class="flex gap-4">
          <button
            type="submit"
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('promo.create')}
          </button>
          <button
            type="button"
            on:click={() => (creating = false)}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if codes.length === 0}
    <p class="text-accent-muted">{t('promo.noPromoCodes')}</p>
  {:else}
    <div class="bg-white overflow-hidden">
      <table class="w-full">
        <thead class="bg-white border-b border-accent/20">
          <tr>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('promo.code')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('promo.type')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('promo.value')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('promo.used')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('promo.validUntil')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('promo.status')}</th>
            <th class="px-6 py-3 text-left text-sm font-medium">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-accent/20">
          {#each codes as code}
            <tr>
              <td class="px-6 py-4 font-mono">{code.code}</td>
              <td class="px-6 py-4">{code.discountType}</td>
              <td class="px-6 py-4">
                {code.discountType === 'PERCENTAGE'
                  ? `${code.discountValue}%`
                  : code.discountType === 'BALANCE'
                    ? `$${code.discountValue} ${t('promo.balance') || '(Balance)'}`
                    : `$${code.discountValue}`}
                {#if code.userId}
                  <span class="text-xs text-accent-muted block mt-1">
                    {t('promo.assignedToUser') || 'Assigned to user'}
                  </span>
                {/if}
              </td>
              <td class="px-6 py-4">
                {code.usedCount}
                {code.usageLimit ? `/ ${code.usageLimit}` : ''}
              </td>
              <td class="px-6 py-4">
                {formatDate(code.validUntil)}
              </td>
              <td class="px-6 py-4">
                <span
                  class="px-2 py-1 text-xs {code.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'}"
                >
                  {code.isActive ? t('promo.active') : t('promo.inactive')}
                </span>
              </td>
              <td class="px-6 py-4">
                <button
                  on:click={() => deleteCode(code.id)}
                  class="text-red-400 hover:text-red-300 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
