<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/i18n';
  import { settingsStore } from '$lib/stores/settings.store';
  import ProfileTabContent from '$lib/components/account/ProfileTabContent.svelte';
  import AddressesTabContent from '$lib/components/account/AddressesTabContent.svelte';
  import LoyaltyTabContent from '$lib/components/account/LoyaltyTabContent.svelte';
  import MessengerTabContent from '$lib/components/account/MessengerTabContent.svelte';
  import SupportTicketsTabContent from '$lib/components/account/SupportTicketsTabContent.svelte';

  type TabId = 'profile' | 'addresses' | 'loyalty' | 'messenger' | 'tickets';

  const TAB_LABELS: Record<TabId, string> = {
    profile: 'account.profile',
    addresses: 'account.addresses',
    loyalty: 'account.loyaltyPoints',
    messenger: 'account.messengerContacts',
    tickets: 'account.supportTickets',
  };

  const TABS: { id: TabId; visible: boolean }[] = [
    { id: 'profile', visible: true },
    { id: 'addresses', visible: true },
    { id: 'loyalty', visible: true },
    { id: 'messenger', visible: true },
    { id: 'tickets', visible: true },
  ];

  $: visibleTabs = TABS.map((tab) => ({
    ...tab,
    label: t(TAB_LABELS[tab.id]),
    visible: tab.id === 'loyalty' ? $settingsStore.loyaltyProgramEnabled : true,
  })).filter((tab) => tab.visible);

  $: hash = $page.url.hash.slice(1) || 'profile';
  $: activeTab = (
    ['profile', 'addresses', 'loyalty', 'messenger', 'tickets'].includes(hash) ? hash : 'profile'
  ) as TabId;

  function setTab(tabId: TabId) {
    goto(`/account/profile#${tabId}`, { replaceState: true });
  }
</script>

<div class="min-w-0">
  <!-- Tabs: single row on mobile (horizontal scroll) -->
  <div
    class="account-profile-tabs flex flex-nowrap gap-1 sm:gap-2 overflow-x-auto border-b border-white/10 mb-6 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 min-w-0"
    role="tablist"
    aria-label={t('account.profile') || 'Profile sections'}
  >
    {#each visibleTabs as tab}
      <button
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls="profile-tabpanel"
        id="tab-{tab.id}"
        on:click={() => setTab(tab.id)}
        class="flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-base transition-colors {activeTab ===
        tab.id
          ? 'bg-dark-light'
          : 'hover:bg-dark-light'}"
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div id="profile-tabpanel" role="tabpanel" aria-labelledby="tab-{activeTab}">
    {#if activeTab === 'profile'}
      <ProfileTabContent />
    {:else if activeTab === 'addresses'}
      <AddressesTabContent />
    {:else if activeTab === 'loyalty'}
      <LoyaltyTabContent />
    {:else if activeTab === 'messenger'}
      <MessengerTabContent />
    {:else if activeTab === 'tickets'}
      <SupportTicketsTabContent />
    {/if}
  </div>
</div>

<style>
  .account-profile-tabs {
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .account-profile-tabs::-webkit-scrollbar {
    display: none;
  }
</style>
