<script lang="ts">
  import { onMount } from 'svelte';
  import { messengerApi, type MessengerContact } from '$lib/api/messenger.api';
  import CustomSelect from '$lib/components/CustomSelect.svelte';
  import { t } from '$lib/utils/i18n';
  import AccountMessengerSkeleton from '$lib/components/account/AccountMessengerSkeleton.svelte';

  let contacts: MessengerContact[] = [];
  let loading = true;
  let showForm = false;
  let editingContact: MessengerContact | null = null;

  let formData = {
    type: 'TELEGRAM' as 'TELEGRAM' | 'WHATSAPP' | 'VIBER' | 'OTHER',
    contactId: '',
    username: '',
  };

  onMount(async () => {
    await loadContacts();
  });

  async function loadContacts() {
    loading = true;
    try {
      const response = await messengerApi.getContacts();
      contacts = response.contacts;
    } catch (e) {
      alert(t('messenger.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function openForm(contact?: MessengerContact) {
    if (contact) {
      editingContact = contact;
      formData = {
        type: contact.type,
        contactId: contact.contactId,
        username: contact.username || '',
      };
    } else {
      editingContact = null;
      formData = {
        type: 'TELEGRAM',
        contactId: '',
        username: '',
      };
    }
    showForm = true;
  }

  async function saveContact() {
    try {
      if (editingContact) {
        await messengerApi.updateContact(editingContact.id, formData);
      } else {
        await messengerApi.createContact(formData);
      }
      showForm = false;
      await loadContacts();
    } catch (e) {
      alert(t('messenger.failedToSave'));
    }
  }

  async function deleteContact(id: string) {
    if (!confirm(t('messenger.deleteConfirm'))) return;
    try {
      await messengerApi.deleteContact(id);
      await loadContacts();
    } catch (e) {
      alert(t('messenger.failedToDelete'));
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'TELEGRAM':
        return t('messenger.telegram');
      case 'WHATSAPP':
        return t('messenger.whatsapp');
      case 'VIBER':
        return t('messenger.viber');
      default:
        return type;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h3 class="text-xl font-medium">{t('messenger.messengerContacts')}</h3>
    <button
      on:click={() => openForm()}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('messenger.addContact')}
    </button>
  </div>

  <p class="text-accent-muted mb-6">
    {t('messenger.description')}
  </p>

  {#if showForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">
        {editingContact ? t('messenger.editContact') : t('messenger.addContact')}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2" for="messenger-type"
            >{t('messenger.messengerType')}</label
          >
          <CustomSelect
            id="messenger-type"
            bind:value={formData.type}
            disabled={!!editingContact}
            options={[
              { value: 'TELEGRAM', label: t('messenger.telegram') },
              { value: 'WHATSAPP', label: t('messenger.whatsapp') },
              { value: 'VIBER', label: t('messenger.viber') },
              { value: 'OTHER', label: t('messenger.other') },
            ]}
            className="w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2" for="messenger-contact-id">
            {formData.type === 'TELEGRAM'
              ? t('messenger.telegramIdOrUsername')
              : formData.type === 'WHATSAPP'
                ? t('messenger.whatsappNumber')
                : t('messenger.contactId')}
          </label>
          <input
            id="messenger-contact-id"
            type="text"
            bind:value={formData.contactId}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={formData.type === 'TELEGRAM'
              ? t('messenger.telegramPlaceholder')
              : t('messenger.phonePlaceholder')}
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2" for="messenger-display-name"
            >{t('messenger.displayName')}</label
          >
          <input
            id="messenger-display-name"
            type="text"
            bind:value={formData.username}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={t('messenger.displayNamePlaceholder')}
          />
        </div>
        <div class="flex gap-4">
          <button
            on:click={saveContact}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('profile.save')}
          </button>
          <button
            on:click={() => (showForm = false)}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('profile.cancel')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <AccountMessengerSkeleton />
  {:else if contacts.length === 0}
    <div class="bg-dark-light p-12 text-center">
      <p class="text-xl text-accent-muted mb-4">{t('messenger.noContactsAdded')}</p>
      <p class="text-sm text-accent-muted mb-6">
        {t('messenger.description')}
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each contacts as contact}
        <div class="bg-dark-light p-6">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-lg font-medium mb-2">{getTypeLabel(contact.type)}</h3>
              <p class="text-accent-muted mb-1">
                {contact.username || contact.contactId}
              </p>
              <p class="text-sm text-accent-muted">
                {t('messenger.contactIdLabel')}: {contact.contactId}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                on:click={() => openForm(contact)}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-sm text-black"
              >
                {t('profile.edit')}
              </button>
              <button
                on:click={() => deleteContact(contact.id)}
                class="px-4 py-2 bg-white border border-red-500/20 text-red-400 hover:bg-red-50 transition-colors text-sm"
              >
                {t('messenger.remove')}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
