<script lang="ts">
  import { onMount } from 'svelte';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import AdminKebabMenu from '$lib/components/admin/AdminKebabMenu.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';

  let languages: Language[] = [];
  let loading = true;
  let showAddForm = false;
  let editingLanguage: Language | null = null;
  /** When set, edit form is shown inline under this language's row */
  let editingLanguageId: string | null = null;
  /** When set, actions dropdown is open for this language id */
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
    flag: '',
    isActive: true,
    isDefault: false,
    sortOrder: 0,
  };

  onMount(async () => {
    await loadLanguages();
  });

  async function loadLanguages() {
    loading = true;
    try {
      const response = await languageApi.getAll();
      languages = response?.languages ?? [];
    } catch (e) {
      notificationStore.error(t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  function openAddForm() {
    editingLanguage = null;
    editingLanguageId = null;
    showAddForm = true;
    formData = {
      code: '',
      name: '',
      nameNative: '',
      flag: '',
      isActive: true,
      isDefault: false,
      sortOrder: 0,
    };
  }

  function openEditForm(language: Language) {
    showAddForm = false;
    editingLanguage = language;
    editingLanguageId = language.id;
    formData = {
      code: language.code,
      name: language.name,
      nameNative: language.nameNative || '',
      flag: language.flag || '',
      isActive: language.isActive,
      isDefault: language.isDefault,
      sortOrder: language.sortOrder,
    };
  }

  function closeForm() {
    showAddForm = false;
    editingLanguage = null;
    editingLanguageId = null;
  }

  async function saveLanguage() {
    try {
      if (editingLanguage) {
        await languageApi.update(editingLanguage.id, formData);
      } else {
        await languageApi.create(formData);
      }
      closeForm();
      await loadLanguages();
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(t('error.failedToSave'));
    }
  }

  async function deleteLanguage(id: string) {
    const confirmed = await dialogStore.confirm(t('alert.deleteLanguage'), t('common.confirm'));
    if (!confirmed) return;
    try {
      await languageApi.delete(id);
      await loadLanguages();
      notificationStore.success(t('common.success'));
    } catch (e) {
      notificationStore.error(t('error.failedToDelete'));
    }
  }

  async function setDefault(id: string) {
    try {
      await languageApi.setDefault(id);
      await loadLanguages();
      notificationStore.success(t('common.saved'));
    } catch (e) {
      notificationStore.error(t('error.failedToUpdate'));
    }
  }
</script>

<svelte:window on:click={closeActions} />

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('menu.languages')}</h2>
    <button
      type="button"
      on:click={openAddForm}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('language.addLanguage')}
    </button>
  </div>

  <!-- Add language form (only at top when adding new) -->
  {#if showAddForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('language.addLanguage')}</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="languageCode" class="block text-sm font-medium mb-2"
              >{t('language.languageCode')} (ISO 639-1)</label
            >
            <input
              id="languageCode"
              type="text"
              bind:value={formData.code}
              maxlength="2"
              disabled={!!editingLanguage}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
              placeholder="en"
            />
          </div>
          <div>
            <label for="languageName" class="block text-sm font-medium mb-2"
              >{t('language.languageName')}</label
            >
            <input
              id="languageName"
              type="text"
              bind:value={formData.name}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="English"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="languageNativeName" class="block text-sm font-medium mb-2"
              >{t('language.nativeName')} ({t('common.optional')})</label
            >
            <input
              id="languageNativeName"
              type="text"
              bind:value={formData.nameNative}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="English"
            />
          </div>
          <div>
            <label for="languageFlag" class="block text-sm font-medium mb-2"
              >{t('language.flag')} ({t('language.emojiOrIcon')})</label
            >
            <input
              id="languageFlag"
              type="text"
              bind:value={formData.flag}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="🇺🇸"
            />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.isActive} id="isActive" />
            <label for="isActive" class="text-sm">{t('common.active')}</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" bind:checked={formData.isDefault} id="isDefault" />
            <label for="isDefault" class="text-sm">{t('language.isDefault')}</label>
          </div>
          <div>
            <label for="languageSortOrder" class="block text-sm font-medium mb-2"
              >{t('common.sortOrder')}</label
            >
            <input
              id="languageSortOrder"
              type="number"
              bind:value={formData.sortOrder}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>
        <div class="flex gap-4">
          <button
            type="button"
            on:click={saveLanguage}
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
  {:else if languages.length === 0}
    <p class="text-accent-muted">{t('language.noLanguages')}</p>
  {:else}
    <div class="bg-white overflow-x-auto -mx-1 px-1">
      <table class="w-full min-w-[800px]">
        <thead class="bg-white">
          <tr>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.code')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.name')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('language.flag')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.status')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium w-0">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each languages as language}
            <tr
              class="border-t border-accent/10 cursor-pointer hover:bg-white/5 transition-colors"
              role="button"
              tabindex="0"
              on:click={() => openEditForm(language)}
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openEditForm(language);
                }
              }}
            >
              <td class="px-4 py-2">
                <span class="font-mono text-sm">{language.code}</span>
                {#if language.isDefault}
                  <span class="ml-2 px-2 py-1 bg-accent/20 text-accent text-xs"
                    >{t('language.isDefault')}</span
                  >
                {/if}
              </td>
              <td class="px-4 py-2">
                <div>
                  <p class="font-medium">{language.name}</p>
                  {#if language.nameNative}
                    <p class="text-sm text-accent-muted">{language.nameNative}</p>
                  {/if}
                </div>
              </td>
              <td class="px-4 py-2 text-2xl">{language.flag || '—'}</td>
              <td class="px-4 py-2">
                <span
                  class="px-2 py-0.5 text-xs {language.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'}"
                >
                  {language.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </td>
              <td class="px-4 py-2 align-middle">
                <AdminKebabMenu
                  open={openActionsId === language.id}
                  title={t('common.actions')}
                  menuToggle={() => toggleActions(language.id)}
                >
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      openEditForm(language);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                  >
                    {t('common.edit')}
                  </button>
                  {#if !language.isDefault}
                    <button
                      type="button"
                      role="menuitem"
                      on:click={() => {
                        setDefault(language.id);
                        closeActions();
                      }}
                      class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                    >
                      {t('language.setDefault')}
                    </button>
                  {/if}
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      deleteLanguage(language.id);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600"
                  >
                    {t('common.delete')}
                  </button>
                </AdminKebabMenu>
              </td>
            </tr>
            <!-- Edit form inline under this language's row -->
            {#if editingLanguageId === language.id}
              <tr class="border-t-0 bg-dark-light/50">
                <td colspan="5" class="px-4 py-4">
                  <div class="p-4 border-2 border-accent/30 rounded-lg">
                    <h3 class="text-lg font-medium mb-4">
                      {t('language.editLanguage')} — {language.code}
                    </h3>
                    <div class="space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label for="editLanguageCode" class="block text-sm font-medium mb-2"
                            >{t('language.languageCode')} (ISO 639-1)</label
                          >
                          <input
                            id="editLanguageCode"
                            type="text"
                            bind:value={formData.code}
                            maxlength="2"
                            disabled
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label for="editLanguageName" class="block text-sm font-medium mb-2"
                            >{t('language.languageName')}</label
                          >
                          <input
                            id="editLanguageName"
                            type="text"
                            bind:value={formData.name}
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            placeholder="English"
                          />
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label for="editLanguageNativeName" class="block text-sm font-medium mb-2"
                            >{t('language.nativeName')} ({t('common.optional')})</label
                          >
                          <input
                            id="editLanguageNativeName"
                            type="text"
                            bind:value={formData.nameNative}
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            placeholder="English"
                          />
                        </div>
                        <div>
                          <label for="editLanguageFlag" class="block text-sm font-medium mb-2"
                            >{t('language.flag')} ({t('language.emojiOrIcon')})</label
                          >
                          <input
                            id="editLanguageFlag"
                            type="text"
                            bind:value={formData.flag}
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                            placeholder="🇺🇸"
                          />
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
                          <span class="text-sm">{t('language.isDefault')}</span>
                        </label>
                        <div>
                          <label for="editLanguageSortOrder" class="block text-sm font-medium mb-2"
                            >{t('common.sortOrder')}</label
                          >
                          <input
                            id="editLanguageSortOrder"
                            type="number"
                            bind:value={formData.sortOrder}
                            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                          />
                        </div>
                      </div>
                      <div class="flex gap-4 pt-2">
                        <button
                          type="button"
                          on:click={saveLanguage}
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
