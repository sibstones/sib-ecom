<script lang="ts">
  import { onMount } from 'svelte';
  import { categoryApi, type Category } from '$lib/api/category.api';
  import { translationApi, type CategoryTranslation } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { t } from '$lib/utils/i18n';
  import { resolveApiError } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import AdminKebabMenu from '$lib/components/admin/AdminKebabMenu.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';

  let categories: Category[] = [];
  let mainCategories: Category[] = [];
  let loading = true;
  let showAddForm = false;
  let editingCategory: Category | null = null;
  /** When set, edit form is shown inline under this category's row */
  let editingCategoryId: string | null = null;
  /** When set, actions dropdown is open for this category id */
  let openActionsId: string | null = null;
  let showMainOnly = false;

  function toggleActions(id: string) {
    openActionsId = openActionsId === id ? null : id;
  }

  function closeActions() {
    openActionsId = null;
  }

  // Translation management
  let languages: Language[] = [];
  let translations: CategoryTranslation[] = [];
  let showTranslations = false;
  let editingTranslation: CategoryTranslation | null = null;
  let selectedLanguageForTranslation = '';
  let gptTranslating = false;
  let translationFormData = {
    name: '',
    description: '',
  };

  let formData = {
    name: '',
    slug: '',
    description: '',
    parentId: '',
    isMain: false,
  };

  onMount(async () => {
    await Promise.all([loadCategories(), loadMainCategories(), loadLanguages()]);
  });

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll();
      languages = response.languages;
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadTranslations() {
    if (!editingCategory) return;
    try {
      const response = await translationApi.getCategoryTranslations(editingCategory.id);
      translations = response.translations;
    } catch (e) {
      console.error('Failed to load translations:', e);
      translations = [];
    }
  }

  function openTranslationEditor() {
    if (!editingCategory) return;
    showTranslations = true;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = { name: '', description: '' };
    loadTranslations();
  }

  function closeTranslationEditor() {
    showTranslations = false;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = { name: '', description: '' };
  }

  function editTranslation(translation: CategoryTranslation) {
    editingTranslation = translation;
    selectedLanguageForTranslation = translation.languageCode;
    translationFormData = {
      name: translation.name || '',
      description: translation.description || '',
    };
  }

  async function saveTranslation() {
    if (!editingCategory) return;

    try {
      await translationApi.upsertCategoryTranslation(editingCategory.id, {
        languageCode: selectedLanguageForTranslation,
        ...translationFormData,
      });
      notificationStore.success(t('notification.translationSaved'));
      await loadTranslations();
      editingTranslation = null;
      selectedLanguageForTranslation = '';
      translationFormData = { name: '', description: '' };
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteTranslation(languageCode: string) {
    if (!editingCategory) return;

    const confirmed = await dialogStore.confirm(
      t('alert.deleteTranslation'),
      t('common.confirm'),
      t('common.ok'),
      t('common.cancel')
    );
    if (!confirmed) return;

    try {
      await translationApi.deleteCategoryTranslation(editingCategory.id, languageCode);
      notificationStore.success(t('notification.translationDeleted'));
      await loadTranslations();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  async function translateWithGPT() {
    if (!editingCategory) return;

    gptTranslating = true;
    try {
      const sourceLanguage = 'en';
      const targetLanguage = selectedLanguageForTranslation;

      const targetLang = languages.find((l) => l.code === targetLanguage);
      if (!targetLang) {
        notificationStore.error(t('notification.targetLanguageNotFound'));
        return;
      }

      // Translate name
      if (editingCategory.name) {
        try {
          const nameTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: editingCategory.name,
          });
          translationFormData.name = nameTranslation.translation;
        } catch (e) {
          console.error('Failed to translate name:', e);
        }
      }

      // Translate description
      if (editingCategory.description) {
        try {
          const descTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: editingCategory.description,
          });
          translationFormData.description = descTranslation.translation;
        } catch (e) {
          console.error('Failed to translate description:', e);
        }
      }

      notificationStore.success(
        `Translation generated for ${targetLang.nameNative || targetLang.name}`
      );
    } catch (e) {
      notificationStore.error(resolveApiError(e, 'error.failedToGenerateTranslation'));
    } finally {
      gptTranslating = false;
    }
  }

  async function loadCategories() {
    loading = true;
    try {
      const response = showMainOnly
        ? await categoryApi.getAll(false, false, true)
        : await categoryApi.getAll(false, true);
      categories = response.categories;
    } catch (e) {
      notificationStore.error(t('error.failedToLoad'));
    } finally {
      loading = false;
    }
  }

  async function loadMainCategories() {
    try {
      const response = await categoryApi.getAll(false, false, true);
      mainCategories = response.categories;
      console.log(
        'Loaded main categories:',
        mainCategories.map((c) => c.name)
      );
    } catch (e) {
      console.error('Failed to load main categories:', e);
      // Fallback: try to get main categories from all categories
      try {
        const allResponse = await categoryApi.getAll(false, true);
        mainCategories = allResponse.categories.filter(
          (c) => c.isMain === true || (!c.isMain && !c.parentId)
        );
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  }

  async function openAddForm() {
    if (mainCategories.length === 0) {
      await loadMainCategories();
    }
    editingCategory = null;
    editingCategoryId = null;
    formData = {
      name: '',
      slug: '',
      description: '',
      parentId: '',
      isMain: false,
    };
    showAddForm = true;
  }

  async function openEditForm(category: Category) {
    if (mainCategories.length === 0) {
      await loadMainCategories();
    }
    showAddForm = false;
    editingCategory = category;
    editingCategoryId = category.id;
    formData = {
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parentId: category.parentId || '',
      isMain: category.isMain || false,
    };
  }

  function closeForm() {
    showAddForm = false;
    editingCategory = null;
    editingCategoryId = null;
  }

  async function saveCategory() {
    try {
      // If main category, clear parent
      if (formData.isMain) {
        formData.parentId = '';
      }

      if (editingCategory) {
        await categoryApi.update(editingCategory.id, {
          ...formData,
          parentId: formData.parentId || undefined,
        });
      } else {
        await categoryApi.create({
          ...formData,
          parentId: formData.parentId || undefined,
        });
      }
      closeForm();
      await Promise.all([loadCategories(), loadMainCategories()]);
      notificationStore.success(t('common.saved'));
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteCategory(id: string) {
    const confirmed = await dialogStore.confirm(
      t('alert.deleteCategory'),
      t('common.confirm'),
      t('common.ok'),
      t('common.cancel')
    );
    if (!confirmed) return;
    try {
      await categoryApi.delete(id);
      await loadCategories();
      notificationStore.success(t('common.success'));
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  function getCategoryPath(category: Category): string {
    const path: string[] = [];
    let current: Category | undefined = category;
    while (current) {
      path.unshift(current.name);
      current = current.parent;
    }
    return path.join(' > ');
  }

  function getAvailableParents(): Category[] {
    // Get all categories that can be parents
    // Exclude: current editing category, its descendants, and categories that would create circular references
    const available = categories.filter((cat) => {
      // Can't select itself
      if (cat.id === editingCategory?.id) return false;

      // Can't select descendants of current category (if editing)
      if (editingCategory) {
        let parent: Category | undefined = cat;
        while (parent) {
          if (parent.id === editingCategory.id) return false;
          parent = categories.find((c) => c.id === parent?.parentId);
        }
      }

      return true;
    });

    // Sort by path for better UX
    return available.sort((a, b) => {
      const pathA = getCategoryPath(a);
      const pathB = getCategoryPath(b);
      return pathA.localeCompare(pathB);
    });
  }
</script>

<svelte:window on:click={closeActions} />

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('category.categories')}</h2>
    <div class="flex gap-4 items-center">
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={showMainOnly} on:change={loadCategories} class="" />
        <span class="text-sm">{t('category.showMainOnly')}</span>
      </label>
      <button
        type="button"
        on:click={openAddForm}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('category.addCategory')}
      </button>
    </div>
  </div>

  <!-- Add category form (only at top when adding new) -->
  {#if showAddForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('category.addCategory')}</h3>
      <div class="space-y-4">
        <div>
          <label for="category-add-name" class="block text-sm font-medium mb-2"
            >{t('category.categoryName')} *</label
          >
          <input
            id="category-add-name"
            type="text"
            bind:value={formData.name}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={t('category.categoryName')}
          />
        </div>
        <div>
          <label for="category-add-slug" class="block text-sm font-medium mb-2"
            >{t('common.slug')} ({t('category.autoGenerated')})</label
          >
          <input
            id="category-add-slug"
            type="text"
            bind:value={formData.slug}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder="category-slug"
          />
        </div>
        <div>
          <label for="category-add-description" class="block text-sm font-medium mb-2"
            >{t('common.description')}</label
          >
          <textarea
            id="category-add-description"
            bind:value={formData.description}
            rows="3"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={t('common.description')}
          ></textarea>
        </div>
        <div class="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            bind:checked={formData.isMain}
            id="isMain"
            class=""
            on:change={() => {
              if (formData.isMain) {
                formData.parentId = '';
              }
            }}
          />
          <label for="isMain" class="text-sm font-medium">
            {t('category.isMain')}
          </label>
        </div>
        <div>
          <label for="category-add-parent" class="block text-sm font-medium mb-2"
            >{t('category.parentCategory')}</label
          >
          <select
            id="category-add-parent"
            bind:value={formData.parentId}
            disabled={formData.isMain}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{t('category.none')}</option>
            {#each getAvailableParents() as cat}
              <option value={cat.id} selected={formData.parentId === cat.id}>
                {getCategoryPath(cat)}
              </option>
            {/each}
          </select>
          {#if formData.isMain}
            <p class="text-xs text-accent-muted mt-1">
              {t('category.mainCannotHaveParent')}
            </p>
          {:else}
            <p class="text-xs text-accent-muted mt-1">
              {t('category.selectParentHint')}
            </p>
          {/if}
        </div>
        <div class="flex gap-4">
          <button
            type="button"
            on:click={saveCategory}
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
  {:else if categories.length === 0}
    <p class="text-accent-muted">{t('category.noCategories')}</p>
  {:else}
    <div class="bg-white">
      <table class="w-full min-w-[800px]">
        <thead class="bg-white">
          <tr>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.name')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.slug')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('common.type')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('category.parentCategory')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium">{t('menu.products')}</th>
            <th class="px-4 py-2 text-left text-sm font-medium w-0">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each categories as category}
            <tr
              class="border-t border-accent/10 {category.isMain
                ? 'bg-accent/5'
                : ''} cursor-pointer hover:bg-white/5 transition-colors"
              role="button"
              tabindex="0"
              on:click={() => openEditForm(category)}
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openEditForm(category);
                }
              }}
            >
              <td class="px-4 py-2">
                <div>
                  <p class="font-medium">
                    {category.name}
                    {#if category.isMain}
                      <span class="ml-2 px-2 py-0.5 bg-accent/20 text-accent text-xs">
                        {t('category.isMain')}
                      </span>
                    {/if}
                  </p>
                  {#if category.description}
                    <p class="text-sm text-accent-muted">{category.description}</p>
                  {/if}
                </div>
              </td>
              <td class="px-4 py-2">
                <span class="font-mono text-sm">{category.slug}</span>
              </td>
              <td class="px-4 py-2">
                {#if category.isMain}
                  <span class="px-2 py-0.5 bg-accent/20 text-accent text-xs"
                    >{t('category.isMain')}</span
                  >
                {:else if category.parentId}
                  <span class="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs"
                    >{t('category.subcategory')}</span
                  >
                {:else}
                  <span class="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs"
                    >{t('category.regular')}</span
                  >
                {/if}
              </td>
              <td class="px-4 py-2">
                {#if category.parent}
                  <span class="text-sm">{category.parent.name}</span>
                {:else}
                  <span class="text-sm text-accent-muted">—</span>
                {/if}
              </td>
              <td class="px-4 py-2">
                <span class="text-sm">{category._count?.products || 0}</span>
              </td>
              <td class="px-4 py-2 align-middle">
                <AdminKebabMenu
                  open={openActionsId === category.id}
                  title={t('common.actions')}
                  menuToggle={() => toggleActions(category.id)}
                >
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      openEditForm(category);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-black"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    on:click={() => {
                      deleteCategory(category.id);
                      closeActions();
                    }}
                    class="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600"
                  >
                    {t('common.delete')}
                  </button>
                </AdminKebabMenu>
              </td>
            </tr>
            <!-- Edit form inline under this category's row -->
            {#if editingCategoryId === category.id}
              <tr class="border-t-0 bg-dark-light/50">
                <td colspan="6" class="px-4 py-4">
                  <div class="p-4 border-2 border-accent/30 rounded-lg">
                    <h3 class="text-lg font-medium mb-4">
                      {t('category.editCategory')} — {category.name}
                    </h3>
                    <div class="space-y-4">
                      <div>
                        <label for="category-name" class="block text-sm font-medium mb-2"
                          >{t('category.categoryName')} *</label
                        >
                        <input
                          id="category-name"
                          type="text"
                          bind:value={formData.name}
                          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                          placeholder={t('category.categoryName')}
                        />
                      </div>
                      <div>
                        <label for="category-slug" class="block text-sm font-medium mb-2"
                          >{t('common.slug')} ({t('category.autoGenerated')})</label
                        >
                        <input
                          id="category-slug"
                          type="text"
                          bind:value={formData.slug}
                          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                          placeholder="category-slug"
                        />
                      </div>
                      <div>
                        <label for="category-description" class="block text-sm font-medium mb-2"
                          >{t('common.description')}</label
                        >
                        <textarea
                          id="category-description"
                          bind:value={formData.description}
                          rows="3"
                          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                          placeholder={t('common.description')}
                        ></textarea>
                      </div>
                      <div class="flex items-center gap-2 mb-4">
                        <input
                          type="checkbox"
                          bind:checked={formData.isMain}
                          id="edit-isMain-{category.id}"
                          class=""
                          on:change={() => {
                            if (formData.isMain) {
                              formData.parentId = '';
                            }
                          }}
                        />
                        <label for="edit-isMain-{category.id}" class="text-sm font-medium">
                          {t('category.isMain')}
                        </label>
                      </div>
                      <div>
                        <label for="category-parent" class="block text-sm font-medium mb-2"
                          >{t('category.parentCategory')}</label
                        >
                        <select
                          id="category-parent"
                          bind:value={formData.parentId}
                          disabled={formData.isMain}
                          class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">{t('category.none')}</option>
                          {#each getAvailableParents() as cat}
                            <option value={cat.id} selected={formData.parentId === cat.id}>
                              {getCategoryPath(cat)}
                            </option>
                          {/each}
                        </select>
                        {#if formData.isMain}
                          <p class="text-xs text-accent-muted mt-1">
                            {t('category.mainCannotHaveParent')}
                          </p>
                        {:else}
                          <p class="text-xs text-accent-muted mt-1">
                            {t('category.selectParentHint')}
                          </p>
                        {/if}
                      </div>
                      <div class="flex gap-4 pt-2">
                        <button
                          type="button"
                          on:click={saveCategory}
                          class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          type="button"
                          on:click={openTranslationEditor}
                          class="px-6 py-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        >
                          {t('category.translations')}
                        </button>
                        <button
                          type="button"
                          on:click={closeForm}
                          class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>

                      <!-- Translations panel (below edit form) -->
                      {#if showTranslations && editingCategory}
                        <div
                          class="mt-6 pt-6 border-t border-gray-300 bg-dark-light/50 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg"
                        >
                          <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-medium">
                              {t('category.translations')} - {editingCategory.name}
                            </h3>
                            <button
                              on:click={closeTranslationEditor}
                              class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                            >
                              {t('common.close')}
                            </button>
                          </div>

                          <div class="mb-6 p-4 bg-white border border-gray-300">
                            <h4 class="text-lg font-medium mb-4">
                              {editingTranslation
                                ? t('category.editTranslation')
                                : t('category.addTranslation')}
                            </h4>
                            <div class="space-y-4">
                              <div>
                                <label
                                  for="translation-language"
                                  class="block text-sm font-medium mb-2"
                                  >{t('language.language')} *</label
                                >
                                <select
                                  id="translation-language"
                                  bind:value={selectedLanguageForTranslation}
                                  disabled={!!editingTranslation}
                                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
                                >
                                  <option value=""
                                    >{t('common.select')}
                                    {t('language.language').toLowerCase()}</option
                                  >
                                  {#each languages as lang}
                                    {#if !translations.find((t) => t.languageCode === lang.code) || editingTranslation?.languageCode === lang.code}
                                      <option value={lang.code}>{lang.name} ({lang.code})</option>
                                    {/if}
                                  {/each}
                                </select>
                              </div>
                              <div>
                                <label
                                  for="translation-category-name"
                                  class="block text-sm font-medium mb-2"
                                  >{t('category.categoryName')}</label
                                >
                                <input
                                  id="translation-category-name"
                                  type="text"
                                  bind:value={translationFormData.name}
                                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                                  placeholder={editingCategory.name}
                                />
                              </div>
                              <div>
                                <label
                                  for="translation-category-description"
                                  class="block text-sm font-medium mb-2"
                                  >{t('common.description')}</label
                                >
                                <textarea
                                  id="translation-category-description"
                                  bind:value={translationFormData.description}
                                  rows="3"
                                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                                  placeholder={editingCategory.description || ''}
                                ></textarea>
                              </div>
                              <div class="flex gap-4 flex-wrap">
                                <button
                                  on:click={translateWithGPT}
                                  disabled={gptTranslating || !selectedLanguageForTranslation}
                                  class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {#if gptTranslating}
                                    <svg
                                      class="animate-spin h-4 w-4"
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
                                    Translating...
                                  {:else}
                                    <svg
                                      class="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                      ></path>
                                    </svg>
                                    GPT Assistant
                                  {/if}
                                </button>
                                <button
                                  on:click={saveTranslation}
                                  disabled={!selectedLanguageForTranslation}
                                  class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                  {t('common.save')}
                                </button>
                                {#if editingTranslation}
                                  <button
                                    on:click={() => {
                                      editingTranslation = null;
                                      selectedLanguageForTranslation = '';
                                      translationFormData = { name: '', description: '' };
                                    }}
                                    class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                {/if}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 class="text-lg font-medium mb-4">
                              {t('category.existingTranslations')}
                            </h4>
                            {#if translations.length === 0}
                              <p class="text-accent-muted">{t('category.noTranslations')}</p>
                            {:else}
                              <div class="space-y-2">
                                {#each translations as translation}
                                  <div
                                    class="flex items-center justify-between p-4 bg-white border border-gray-300"
                                  >
                                    <div>
                                      <p class="font-medium">
                                        {languages.find((l) => l.code === translation.languageCode)
                                          ?.name || translation.languageCode}
                                      </p>
                                      {#if translation.name}
                                        <p class="text-sm text-accent-muted">
                                          {t('common.name')}: {translation.name}
                                        </p>
                                      {/if}
                                      {#if translation.description}
                                        <p class="text-sm text-accent-muted">
                                          {t('common.description')}: {translation.description.substring(
                                            0,
                                            50
                                          )}...
                                        </p>
                                      {/if}
                                    </div>
                                    <div class="flex gap-2">
                                      <button
                                        on:click={() => editTranslation(translation)}
                                        class="px-3 py-1 bg-white border border-gray-300 text-sm hover:bg-gray-100 transition-colors text-black"
                                      >
                                        {t('common.edit')}
                                      </button>
                                      <button
                                        on:click={() => deleteTranslation(translation.languageCode)}
                                        class="px-3 py-1 bg-red-500 text-white text-sm hover:bg-red-600 transition-colors"
                                      >
                                        {t('common.delete')}
                                      </button>
                                    </div>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/if}
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
