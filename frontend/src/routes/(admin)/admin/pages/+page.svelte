<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { adminApi } from '$lib/api/admin.api';
  import { pageApi, type Page } from '$lib/api/page.api';
  import { translationApi, type PageTranslation } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { t } from '$lib/utils/i18n';
  import { getErrorMessage } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';

  let pages: Page[] = [];
  let loading = true;
  let error = '';
  let showForm = false;
  let editingPage: Page | null = null;
  let languages: Language[] = [];
  let showTranslations = false;
  let translations: PageTranslation[] = [];
  let creatingLoginPage = false;

  let formData = {
    slug: '',
    title: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
    isActive: true,
  };

  function getDefaultLoginPageContent() {
    return JSON.stringify({
      content: '',
      config: {
        imageUrl: '/login-showcase.png',
        videoUrl: '',
        buttonText: '',
        buttonLink: '',
        description:
          'Left panel is ready for a branded image, campaign visual, or showroom-style artwork while the form stays focused on the right.',
        backgroundColor: '#fcfaf7',
        textColor: '#ffffff',
        buttonColor: '#000000',
        buttonTextColor: '#ffffff',
        titleSize: '',
        subtitleSize: '',
        paddingTop: '',
        paddingBottom: '',
        textAlign: 'left',
        imageOpacity: '100',
        sectionHeight: '',
        overlayColor: '#000000',
        overlayOpacity: '35',
        mediaAspectRatio: 'auto',
        gridColumns: '1',
        gridGap: '4',
        gridLayout: 'default',
        badge: 'Content Management',
        eyebrow: 'Admin access',
        sideTitle: 'Visual workspace for your shop operations.',
      },
    });
  }

  // Translation data for each language
  let translationData: Record<
    string,
    {
      title: string;
      metaTitle: string;
      metaDescription: string;
    }
  > = {};

  onMount(async () => {
    await Promise.all([loadPages(), loadLanguages()]);
  });

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll(true);
      languages = response.languages;
      // Initialize translationData for all languages
      languages.forEach((lang) => {
        if (lang.code !== 'en' && !translationData[lang.code]) {
          translationData[lang.code] = {
            title: '',
            metaTitle: '',
            metaDescription: '',
          };
        }
      });
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadTranslations(pageId: string) {
    try {
      const response = await translationApi.getPageTranslations(pageId);
      translations = response.translations;
      // Populate translationData from existing translations
      translationData = {};
      // Initialize for all languages
      languages.forEach((lang) => {
        if (lang.code !== 'en') {
          const existing = translations.find((t) => t.languageCode === lang.code);
          translationData[lang.code] = {
            title: existing?.title || '',
            metaTitle: existing?.metaTitle || '',
            metaDescription: existing?.metaDescription || '',
          };
        }
      });
    } catch (e) {
      console.error('Failed to load translations:', e);
      translations = [];
      // Initialize for all languages
      translationData = {};
      languages.forEach((lang) => {
        if (lang.code !== 'en') {
          translationData[lang.code] = {
            title: '',
            metaTitle: '',
            metaDescription: '',
          };
        }
      });
    }
  }

  async function loadPages() {
    loading = true;
    try {
      const response = await pageApi.getAll(false);
      pages = response.pages;
    } catch (e) {
      error = getErrorMessage(e, 'page.failedToLoadPages');
    } finally {
      loading = false;
    }
  }

  function openForm(page?: Page) {
    if (page) {
      editingPage = page;
      formData = {
        slug: page.slug,
        title: page.title,
        content: page.content || '',
        metaTitle: page.metaTitle || '',
        metaDescription: page.metaDescription || '',
        isActive: page.isActive,
      };
      loadTranslations(page.id);
    } else {
      editingPage = null;
      formData = {
        slug: '',
        title: '',
        content: '',
        metaTitle: '',
        metaDescription: '',
        isActive: true,
      };
      translationData = {};
      translations = [];
      // Initialize translationData for all languages
      languages.forEach((lang) => {
        if (lang.code !== 'en') {
          translationData[lang.code] = {
            title: '',
            metaTitle: '',
            metaDescription: '',
          };
        }
      });
    }
    showForm = true;
    showTranslations = false;
  }

  async function savePage() {
    try {
      let pageId: string;
      if (editingPage) {
        await pageApi.update(editingPage.id, formData);
        pageId = editingPage.id;
      } else {
        const response = await pageApi.create(formData);
        if (!response.page) {
          notificationStore.error(t('error.failedToSave'));
          return;
        }
        pageId = response.page.id;
      }

      // Save translations
      if (Object.keys(translationData).length > 0) {
        for (const [langCode, data] of Object.entries(translationData)) {
          if (data.title || data.metaTitle || data.metaDescription) {
            try {
              await translationApi.upsertPageTranslation(pageId, {
                languageCode: langCode,
                title: data.title || undefined,
                metaTitle: data.metaTitle || undefined,
                metaDescription: data.metaDescription || undefined,
              });
            } catch (e) {
              console.error(`Failed to save translation for ${langCode}:`, e);
            }
          }
        }
      }

      showForm = false;
      await loadPages();

      if (!editingPage && pageId) {
        // Redirect to edit page after creation
        goto(`/admin/pages/${pageId}`);
      }
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function togglePage(id: string, isActive: boolean) {
    try {
      await pageApi.update(id, { isActive: !isActive });
      await loadPages();
    } catch (e) {
      notificationStore.error(t('page.updateFailed'));
    }
  }

  async function deletePage(id: string) {
    const confirmed = await dialogStore.confirm(t('alert.deletePage'), t('common.confirm'));
    if (!confirmed) return;

    try {
      await pageApi.delete(id);
      await loadPages();
    } catch (e) {
      notificationStore.error(t('page.deleteFailed'));
    }
  }

  function getPageSlugLabel(slug: string): string {
    const labels: Record<string, string> = {
      about: t('page.about'),
      contact: t('page.contact'),
      shipping: t('page.shipping'),
      returns: t('page.returns'),
      privacy: t('page.privacy'),
      terms: t('page.terms'),
      login: 'Login Page',
    };
    return labels[slug] || slug;
  }

  function getLoginPage() {
    return pages.find((page) => page.slug === 'login') || null;
  }

  async function ensureLoginPage() {
    const existing = getLoginPage();
    if (existing) {
      goto(`/admin/pages/${existing.id}`);
      return;
    }

    creatingLoginPage = true;
    try {
      const response = await pageApi.create({
        slug: 'login',
        title: 'Login Page',
        content: getDefaultLoginPageContent(),
        metaTitle: 'Login',
        metaDescription: 'Customize the login page hero image and copy.',
        isActive: true,
      });

      if (response.page) {
        await loadPages();
        goto(`/admin/pages/${response.page.id}`);
      }
    } catch (e) {
      await loadPages();
      const loginPage = getLoginPage();
      if (loginPage) {
        goto(`/admin/pages/${loginPage.id}`);
        return;
      }
      notificationStore.error(getErrorMessage(e, 'page.failedToLoadPages'));
    } finally {
      creatingLoginPage = false;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <div>
      <h2 class="text-3xl font-bold">{t('page.pages')}</h2>
      <p class="text-sm text-accent-muted mt-1">
        {t('page.managePages')}
      </p>
    </div>
    <button
      on:click={() => openForm()}
      class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
    >
      {t('page.addPage')}
    </button>
  </div>

  {#if showForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">
        {editingPage ? t('page.editPage') : t('page.newPage')}
      </h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="slug" class="block text-sm font-medium mb-2">{t('page.pageSlug')} *</label>
            <input
              id="slug"
              type="text"
              bind:value={formData.slug}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="about, contact, shipping, returns, login"
              disabled={!!editingPage}
            />
            <p class="text-xs text-accent-muted mt-1">
              {t('page.slugHint')}
            </p>
          </div>
          <div>
            <label for="title" class="block text-sm font-medium mb-2">{t('page.pageTitle')} *</label
            >
            <input
              id="title"
              type="text"
              bind:value={formData.title}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('page.pageTitle')}
            />
          </div>
        </div>

        <div>
          <label for="content" class="block text-sm font-medium mb-2">{t('page.pageContent')}</label
          >
          <textarea
            id="content"
            bind:value={formData.content}
            rows="10"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black font-mono text-sm"
            placeholder={t('page.contentPlaceholder')}
          ></textarea>
          <p class="text-xs text-accent-muted mt-1">
            {t('page.htmlHint')}
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="metaTitle" class="block text-sm font-medium mb-2"
              >{t('page.metaTitle')} (SEO)</label
            >
            <input
              id="metaTitle"
              type="text"
              bind:value={formData.metaTitle}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('page.seoTitle')}
            />
          </div>
          <div>
            <label for="metaDescription" class="block text-sm font-medium mb-2"
              >{t('page.metaDescription')} (SEO)</label
            >
            <textarea
              id="metaDescription"
              bind:value={formData.metaDescription}
              rows="2"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('page.seoDescription')}
            ></textarea>
          </div>
        </div>

        <!-- Translations Section -->
        <div class="border-t border-accent/20 pt-4">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-medium">{t('page.translations')}</h4>
            <button
              type="button"
              on:click={() => (showTranslations = !showTranslations)}
              class="text-sm text-accent hover:text-accent-muted transition-colors"
            >
              {showTranslations ? t('common.hide') : t('common.show')}
              {t('page.translations').toLowerCase()}
            </button>
          </div>

          {#if showTranslations}
            <div class="space-y-4 bg-white/5 p-4 rounded">
              {#each languages.filter((lang) => lang.code !== 'en') as lang}
                {@const langCode = lang.code}
                <div class="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                  <h5 class="text-sm font-medium mb-3 flex items-center gap-2">
                    <span>{lang.name}</span>
                    <span class="text-xs text-accent-muted">({lang.code})</span>
                  </h5>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        for={`pageTitle-${langCode}`}
                        class="block text-xs font-medium mb-1 text-accent-muted"
                        >{t('page.pageTitle')}</label
                      >
                      <input
                        id={`pageTitle-${langCode}`}
                        type="text"
                        bind:value={translationData[langCode].title}
                        class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm"
                        placeholder={formData.title}
                      />
                    </div>
                    <div>
                      <label
                        for={`pageMetaTitle-${langCode}`}
                        class="block text-xs font-medium mb-1 text-accent-muted"
                        >{t('page.metaTitle')} (SEO)</label
                      >
                      <input
                        id={`pageMetaTitle-${langCode}`}
                        type="text"
                        bind:value={translationData[langCode].metaTitle}
                        class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm"
                        placeholder={formData.metaTitle || t('page.seoTitle')}
                      />
                    </div>
                    <div class="md:col-span-2">
                      <label
                        for={`pageMetaDescription-${langCode}`}
                        class="block text-xs font-medium mb-1 text-accent-muted"
                        >{t('page.metaDescription')} (SEO)</label
                      >
                      <textarea
                        id={`pageMetaDescription-${langCode}`}
                        bind:value={translationData[langCode].metaDescription}
                        rows="2"
                        class="w-full px-3 py-2 bg-white border border-gray-300 text-black text-sm"
                        placeholder={formData.metaDescription || t('page.seoDescription')}
                      ></textarea>
                    </div>
                  </div>
                </div>
              {/each}
              {#if languages.filter((lang) => lang.code !== 'en').length === 0}
                <p class="text-sm text-accent-muted">{t('page.noLanguagesAvailable')}</p>
              {/if}
            </div>
          {/if}
        </div>

        <div class="flex items-center gap-2 pt-4 border-t border-accent/20">
          <input type="checkbox" bind:checked={formData.isActive} id="isActive" class="" />
          <label for="isActive" class="text-sm font-medium">
            {t('page.isActive')} ({t('page.visibleOnSite')})
          </label>
        </div>

        <div class="flex gap-4 pt-4">
          <button
            on:click={savePage}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {editingPage ? t('common.update') : t('common.create')}
            {t('page.pages')}
          </button>
          <button
            on:click={() => (showForm = false)}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <div class="bg-dark-light p-6 mb-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 class="text-xl font-medium mb-1">Login Page</h3>
        <p class="text-sm text-accent-muted">
          Manage the split-screen login hero image and supporting copy shown on <code>/login</code>.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        {#if getLoginPage()}
          <a
            href="/admin/pages/{getLoginPage()?.id}"
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
          >
            {t('common.edit')}
          </a>
          <a
            href="/login"
            target="_blank"
            class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
          >
            {t('common.view')}
          </a>
        {:else}
          <button
            on:click={ensureLoginPage}
            disabled={creatingLoginPage}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {creatingLoginPage ? t('common.loading') : 'Create Login Page'}
          </button>
        {/if}
      </div>
    </div>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">{t('notification.error')}: {error}</p>
  {:else if pages.length === 0}
    <div class="bg-dark-light p-8 text-center">
      <p class="text-accent-muted mb-4">{t('page.noPages')}</p>
      <button
        on:click={() => openForm()}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('page.createFirstPage')}
      </button>
    </div>
  {:else}
    <div class="space-y-4">
      {#each pages as page}
        <div class="bg-dark-light p-6 overflow-hidden {!page.isActive ? 'opacity-60' : ''}">
          <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-3 mb-2">
                <h3 class="text-xl font-medium">
                  {page.title}
                </h3>
                <span class="px-2 py-1 bg-white/20 text-white text-xs whitespace-nowrap">
                  /{page.slug}
                </span>
                <span class="px-2 py-1 bg-accent/20 text-accent text-xs whitespace-nowrap">
                  {getPageSlugLabel(page.slug)}
                </span>
                {#if !page.isActive}
                  <span class="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs whitespace-nowrap">
                    {t('common.inactive')}
                  </span>
                {/if}
              </div>
              <p class="text-sm text-accent-muted mb-2">
                {page.content
                  ? page.content.substring(0, 100) + (page.content.length > 100 ? '...' : '')
                  : t('page.noContent')}
              </p>
              {#if page.metaTitle || page.metaDescription}
                <div class="mt-2 text-xs text-accent-muted">
                  {#if page.metaTitle}
                    <div>Meta: {page.metaTitle}</div>
                  {/if}
                </div>
              {/if}
            </div>
            <div class="flex flex-wrap items-center gap-2 md:ml-4 flex-shrink-0">
              <label
                class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 whitespace-nowrap"
              >
                <input
                  type="checkbox"
                  checked={page.isActive}
                  on:change={() => togglePage(page.id, page.isActive)}
                  class="w-4 h-4"
                />
                <span class="text-sm text-black">{t('common.active')}</span>
              </label>
              <a
                href="/{page.slug}"
                target="_blank"
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
              >
                {t('common.view')}
              </a>
              <a
                href="/admin/pages/{page.id}"
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black whitespace-nowrap"
              >
                {t('common.edit')}
              </a>
              <button
                on:click={() => deletePage(page.id)}
                class="px-4 py-2 bg-white border border-red-500/20 hover:bg-red-50 transition-colors text-red-400 whitespace-nowrap"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
