<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '$lib/api/admin.api';
  import {
    footerApi,
    type Footer,
    type FooterColumn,
    type FooterLink,
    type FooterSocialLinks,
  } from '$lib/api/footer.api';
  import {
    translationApi,
    type FooterTranslation,
    type FooterColumnTranslation,
    type FooterLinkTranslation,
  } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { resolveFooterText, t, tLang } from '$lib/utils/i18n';
  import { resolveApiError } from '$lib/utils/error-handler';
  import { supportedLanguages } from '$lib/stores/i18n.store';
  import LoadingBar from '$lib/components/LoadingBar.svelte';

  /** Default columns and bottom links with i18n keys (for apply-default and for new footer). */
  const DEFAULT_KEYS_COLUMNS: FooterColumn[] = [
    { title: 'footer.shop', links: [{ text: 'footer.allProducts', url: '/shop' }] },
    {
      title: 'footer.company',
      links: [
        { text: 'footer.about', url: '/about' },
        { text: 'footer.contact', url: '/contact' },
      ],
    },
    {
      title: 'footer.customer',
      links: [
        { text: 'footer.myAccount', url: '/account' },
        { text: 'footer.orders', url: '/account/orders' },
        { text: 'footer.shipping', url: '/shipping' },
        { text: 'footer.returns', url: '/returns' },
      ],
    },
  ];
  const DEFAULT_KEYS_LINKS: FooterLink[] = [
    { text: 'footer.privacy', url: '/privacy' },
    { text: 'footer.terms', url: '/terms' },
  ];

  /** Build default columns/links with i18n keys (resolved on frontend via resolveFooterText). */
  function getDefaultFooterContentForLocale(_lang: string) {
    return {
      columns: DEFAULT_KEYS_COLUMNS.map((c) => ({
        ...c,
        links: c.links.map((l) => ({ ...l })),
      })),
      links: DEFAULT_KEYS_LINKS.map((l) => ({ ...l })),
    };
  }

  let loading = true;
  let saving = false;
  let error = '';
  let footer: Footer | null = null;
  let footerBackgroundColor = '#ffffff';
  let footerTextColor = '#111111';
  let footerMutedTextColor = '#6b7280';
  let footerAccentColor = '#111111';
  let footerSpacing = 'comfortable';
  let footerAlignment = 'left';
  let footerBrandTitleScale = 'medium';
  let footerLinkTextSize = 'small';

  const footerSpacingOptions = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'airy', label: 'Airy' },
  ];

  const footerAlignmentOptions = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
  ];

  const footerBrandTitleScaleOptions = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];

  const footerLinkTextSizeOptions = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];

  const footerSpacingClassMap: Record<string, string> = {
    compact: 'py-10',
    comfortable: 'py-12',
    airy: 'py-16',
  };

  const footerAlignmentClassMap: Record<string, string> = {
    left: 'text-left items-start',
    center: 'text-center items-center',
  };

  const footerGridAlignmentClassMap: Record<string, string> = {
    left: 'justify-items-start',
    center: 'justify-items-center',
  };

  const footerBrandTitleScaleClassMap: Record<string, string> = {
    small: 'text-xl md:text-2xl',
    medium: 'text-2xl md:text-3xl',
    large: 'text-3xl md:text-4xl',
  };

  const footerLinkTextSizeClassMap: Record<string, string> = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  $: previewFooterSpacingClass =
    footerSpacingClassMap[footerSpacing] ?? footerSpacingClassMap.comfortable;
  $: previewFooterAlignmentClass =
    footerAlignmentClassMap[footerAlignment] ?? footerAlignmentClassMap.left;
  $: previewFooterGridAlignmentClass =
    footerGridAlignmentClassMap[footerAlignment] ?? footerGridAlignmentClassMap.left;
  $: previewFooterBrandTitleScaleClass =
    footerBrandTitleScaleClassMap[footerBrandTitleScale] ?? footerBrandTitleScaleClassMap.medium;
  $: previewFooterLinkTextSizeClass =
    footerLinkTextSizeClassMap[footerLinkTextSize] ?? footerLinkTextSizeClassMap.small;

  const defaultSocialLinks = (): FooterSocialLinks => ({
    instagram: '',
    tiktok: '',
    facebook: '',
    youtube: '',
  });

  let formData = {
    brandName: '',
    tagline: '',
    columns: [] as FooterColumn[],
    copyright: '',
    links: [] as FooterLink[],
    socialLinks: defaultSocialLinks(),
    isActive: true,
  };

  onMount(async () => {
    await Promise.all([loadFooter(), loadLanguages(), settingsStore.load()]);
    loadFooterDesignSettings();
  });

  async function loadFooter() {
    loading = true;
    error = '';
    try {
      const response = await footerApi.get();
      footer = response.footer;
      formData = {
        brandName: footer.brandName || '',
        tagline: footer.tagline || '',
        columns: (footer.columns as FooterColumn[]) || [],
        copyright: footer.copyright || '',
        links: (footer.links as FooterLink[]) || [],
        socialLinks: { ...defaultSocialLinks(), ...(footer.socialLinks || {}) },
        isActive: footer.isActive,
      };
      loadFooterDesignSettings();
    } catch (e: any) {
      error = e.response?.data?.error || e.message || t('error.failedToLoad');
      // If footer doesn't exist, create default one
      if (e.response?.status === 404) {
        await createDefaultFooter();
      }
    } finally {
      loading = false;
    }
  }

  async function createDefaultFooter() {
    try {
      const response = await footerApi.create({
        brandName: '',
        tagline: 'ONE TWO THREE',
        columns: [
          {
            title: 'footer.shop',
            links: [{ text: 'footer.allProducts', url: '/shop' }],
          },
          {
            title: 'footer.company',
            links: [
              { text: 'footer.about', url: '/about' },
              { text: 'footer.contact', url: '/contact' },
            ],
          },
          {
            title: 'footer.customer',
            links: [
              { text: 'footer.myAccount', url: '/account' },
              { text: 'footer.orders', url: '/account/orders' },
              { text: 'footer.shipping', url: '/shipping' },
              { text: 'footer.returns', url: '/returns' },
            ],
          },
        ],
        copyright: '© {year}.',
        links: [
          { text: 'footer.privacy', url: '/privacy' },
          { text: 'footer.terms', url: '/terms' },
        ],
        isActive: true,
      });
      footer = response.footer;
      formData = {
        brandName: footer.brandName || '',
        tagline: footer.tagline || '',
        columns: (footer.columns as FooterColumn[]) || [],
        copyright: footer.copyright || '',
        links: (footer.links as FooterLink[]) || [],
        socialLinks: { ...defaultSocialLinks(), ...(footer.socialLinks || {}) },
        isActive: footer.isActive,
      };
      loadFooterDesignSettings();
      await seedDefaultFooterTranslations(footer.id);
    } catch (e: any) {
      error = e.response?.data?.error || e.message || t('error.failedToCreate');
    }
  }

  /** Create footer translations for all supported languages so footer text follows locale when switching. */
  async function seedDefaultFooterTranslations(footerId: string) {
    try {
      for (const lang of supportedLanguages) {
        const { columns, links } = getDefaultFooterContentForLocale(lang);
        await translationApi.upsertFooterTranslation(footerId, {
          languageCode: lang,
          columns,
          links,
        });
      }
    } catch (e) {
      console.error('Failed to seed footer translations:', e);
    }
  }

  async function saveFooter() {
    if (!footer) return;
    saving = true;
    error = '';
    try {
      const data = {
        brandName: formData.brandName,
        tagline: formData.tagline || undefined,
        columns: formData.columns,
        copyright: formData.copyright,
        links: formData.links.length > 0 ? formData.links : undefined,
        socialLinks: formData.socialLinks,
        isActive: formData.isActive,
      };

      await Promise.all([
        adminApi.updateFooter(footer.id, data),
        settingsStore.updateMultiple({
          footerBackgroundColor,
          footerTextColor,
          footerMutedTextColor,
          footerAccentColor,
          footerSpacing,
          footerAlignment,
          footerBrandTitleScale,
          footerLinkTextSize,
        }),
      ]);
      notificationStore.success(t('footer.updatedSuccessfully'));
      await loadFooter();
    } catch (e: any) {
      error = e.response?.data?.error || e.message || t('error.failedToSave');
      notificationStore.error(error);
    } finally {
      saving = false;
    }
  }

  /** Default column title keys (used when adding new column). */
  const DEFAULT_COLUMN_KEYS = ['footer.shop', 'footer.company', 'footer.customer'];

  function addColumn() {
    const nextKey = DEFAULT_COLUMN_KEYS[formData.columns.length % DEFAULT_COLUMN_KEYS.length] ?? '';
    formData.columns = [
      ...formData.columns,
      {
        title: nextKey,
        links: [],
      },
    ];
  }

  function removeColumn(index: number) {
    formData.columns = formData.columns.filter((_, i) => i !== index);
  }

  /** Default link text keys (suggested when adding link; can leave empty for custom). */
  const DEFAULT_LINK_KEYS = [
    'footer.allProducts',
    'footer.about',
    'footer.contact',
    'footer.myAccount',
    'footer.orders',
    'footer.shipping',
    'footer.returns',
    'footer.privacy',
    'footer.terms',
  ];

  function addLinkToColumn(columnIndex: number) {
    const col = formData.columns[columnIndex];
    const linkCount = col.links.length;
    const nextKey = DEFAULT_LINK_KEYS[linkCount % DEFAULT_LINK_KEYS.length] ?? '';
    formData.columns[columnIndex].links = [...col.links, { text: nextKey, url: '' }];
  }

  function removeLinkFromColumn(columnIndex: number, linkIndex: number) {
    formData.columns[columnIndex].links = formData.columns[columnIndex].links.filter(
      (_, i) => i !== linkIndex
    );
  }

  function addBottomLink() {
    formData.links = [...formData.links, { text: '', url: '' }];
  }

  function removeBottomLink(index: number) {
    formData.links = formData.links.filter((_, i) => i !== index);
  }

  /** Apply default key-based columns and bottom links to the form (current state). Save to persist. */
  async function applyDefaultKeys() {
    const confirmed = await dialogStore.confirm(
      t('footer.applyDefaultKeysConfirm'),
      t('footer.applyDefaultKeys'),
      t('common.ok'),
      t('common.cancel')
    );
    if (!confirmed) return;
    formData.columns = DEFAULT_KEYS_COLUMNS.map((c) => ({
      ...c,
      links: c.links.map((l) => ({ ...l })),
    }));
    formData.links = DEFAULT_KEYS_LINKS.map((l) => ({ ...l }));
    notificationStore.success(t('footer.applyDefaultKeysDone'));
  }

  function replaceYearInCopyright() {
    formData.copyright = formData.copyright.replace('{year}', new Date().getFullYear().toString());
  }

  function loadFooterDesignSettings() {
    const settings = $settingsStore;
    footerBackgroundColor = settings.footerBackgroundColor ?? '#ffffff';
    footerTextColor = settings.footerTextColor ?? '#111111';
    footerMutedTextColor = settings.footerMutedTextColor ?? '#6b7280';
    footerAccentColor = settings.footerAccentColor ?? '#111111';
    footerSpacing = settings.footerSpacing ?? 'comfortable';
    footerAlignment = settings.footerAlignment ?? 'left';
    footerBrandTitleScale = settings.footerBrandTitleScale ?? 'medium';
    footerLinkTextSize = settings.footerLinkTextSize ?? 'small';
  }

  // Translation management
  let languages: Language[] = [];
  let translations: FooterTranslation[] = [];
  let showTranslations = false;
  let editingTranslation: FooterTranslation | null = null;
  let selectedLanguageForTranslation = '';
  let gptTranslating = false;
  const defaultSocialLinksTranslation = () => ({
    instagram: '',
    tiktok: '',
    facebook: '',
    youtube: '',
  });
  let translationFormData = {
    brandName: '',
    tagline: '',
    columns: [] as FooterColumnTranslation[],
    copyright: '',
    links: [] as FooterLinkTranslation[],
    socialLinks: defaultSocialLinksTranslation(),
  };

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll();
      languages = response.languages;
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadTranslations() {
    if (!footer) return;
    try {
      const response = await translationApi.getFooterTranslations(footer.id);
      translations = response.translations;
    } catch (e) {
      console.error('Failed to load translations:', e);
      translations = [];
    }
  }

  function openTranslationEditor() {
    if (!footer) return;
    showTranslations = true;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {
      brandName: '',
      tagline: '',
      columns: [],
      copyright: '',
      links: [],
      socialLinks: defaultSocialLinksTranslation(),
    };
    loadTranslations();
  }

  function closeTranslationEditor() {
    showTranslations = false;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {
      brandName: '',
      tagline: '',
      columns: [],
      copyright: '',
      links: [],
      socialLinks: defaultSocialLinksTranslation(),
    };
  }

  function editTranslation(translation: FooterTranslation) {
    editingTranslation = translation;
    selectedLanguageForTranslation = translation.languageCode;
    translationFormData = {
      brandName: translation.brandName || '',
      tagline: translation.tagline || '',
      columns: (translation.columns as FooterColumnTranslation[]) || [],
      copyright: translation.copyright || '',
      links: (translation.links as FooterLinkTranslation[]) || [],
      socialLinks: { ...defaultSocialLinksTranslation(), ...(translation.socialLinks || {}) },
    };
  }

  async function saveTranslation() {
    if (!footer || !selectedLanguageForTranslation) return;
    try {
      await translationApi.upsertFooterTranslation(footer.id, {
        languageCode: selectedLanguageForTranslation,
        ...translationFormData,
      });
      notificationStore.success(t('notification.translationSaved'));
      await loadTranslations();
      closeTranslationEditor();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteTranslation(languageCode: string) {
    if (!footer) return;
    const confirmed = await dialogStore.confirm(
      t('alert.deleteTranslation'),
      t('common.delete'),
      t('common.ok'),
      t('common.cancel')
    );
    if (!confirmed) return;
    try {
      await translationApi.deleteFooterTranslation(footer.id, languageCode);
      notificationStore.success(t('notification.translationDeleted'));
      await loadTranslations();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  async function translateWithGPT() {
    if (!footer) return;

    gptTranslating = true;
    try {
      const sourceLanguage = 'en';
      const targetLanguage = selectedLanguageForTranslation;

      const targetLang = languages.find((l) => l.code === targetLanguage);
      if (!targetLang) {
        notificationStore.error(t('notification.targetLanguageNotFound'));
        return;
      }

      // Translate brand name
      if (formData.brandName) {
        try {
          const brandTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.brandName,
          });
          translationFormData.brandName = brandTranslation.translation;
        } catch (e) {
          console.error('Failed to translate brand name:', e);
        }
      }

      // Translate tagline
      if (formData.tagline) {
        try {
          const taglineTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.tagline,
          });
          translationFormData.tagline = taglineTranslation.translation;
        } catch (e) {
          console.error('Failed to translate tagline:', e);
        }
      }

      // Translate copyright
      if (formData.copyright) {
        try {
          const copyrightTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.copyright,
          });
          translationFormData.copyright = copyrightTranslation.translation;
        } catch (e) {
          console.error('Failed to translate copyright:', e);
        }
      }

      // Translate columns
      if (formData.columns && formData.columns.length > 0) {
        for (let i = 0; i < formData.columns.length; i++) {
          const column = formData.columns[i];
          if (!translationFormData.columns[i]) {
            translationFormData.columns[i] = { title: '', links: [] };
          }

          // Translate column title
          if (column.title) {
            try {
              const titleTranslation = await translationApi.generateGPTTranslation({
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                content: column.title,
              });
              translationFormData.columns[i].title = titleTranslation.translation;
            } catch (e) {
              console.error('Failed to translate column title:', e);
            }
          }

          // Translate column links
          if (column.links && column.links.length > 0) {
            if (!translationFormData.columns[i].links) {
              translationFormData.columns[i].links = [];
            }
            for (let j = 0; j < column.links.length; j++) {
              const link = column.links[j];
              if (!translationFormData.columns[i].links[j]) {
                translationFormData.columns[i].links[j] = { text: '', url: link.url };
              }

              if (link.text) {
                try {
                  const linkTranslation = await translationApi.generateGPTTranslation({
                    sourceLanguage: sourceLanguage,
                    targetLanguage: targetLanguage,
                    content: link.text,
                  });
                  translationFormData.columns[i].links[j].text = linkTranslation.translation;
                } catch (e) {
                  console.error('Failed to translate link text:', e);
                }
              }
            }
          }
        }
      }

      // Translate footer links
      if (formData.links && formData.links.length > 0) {
        if (!translationFormData.links) {
          translationFormData.links = [];
        }
        for (let i = 0; i < formData.links.length; i++) {
          const link = formData.links[i];
          if (!translationFormData.links[i]) {
            translationFormData.links[i] = { text: '', url: link.url };
          }

          if (link.text) {
            try {
              const linkTranslation = await translationApi.generateGPTTranslation({
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                content: link.text,
              });
              translationFormData.links[i].text = linkTranslation.translation;
            } catch (e) {
              console.error('Failed to translate footer link:', e);
            }
          }
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

  function addTranslationColumn() {
    translationFormData.columns = [
      ...translationFormData.columns,
      {
        title: '',
        links: [],
      },
    ];
  }

  function removeTranslationColumn(index: number) {
    translationFormData.columns = translationFormData.columns.filter((_, i) => i !== index);
  }

  function addTranslationLinkToColumn(columnIndex: number) {
    translationFormData.columns[columnIndex].links = [
      ...translationFormData.columns[columnIndex].links,
      { text: '', url: '' },
    ];
  }

  function removeTranslationLinkFromColumn(columnIndex: number, linkIndex: number) {
    translationFormData.columns[columnIndex].links = translationFormData.columns[
      columnIndex
    ].links.filter((_, i) => i !== linkIndex);
  }

  function addTranslationBottomLink() {
    translationFormData.links = [...translationFormData.links, { text: '', url: '' }];
  }

  function removeTranslationBottomLink(index: number) {
    translationFormData.links = translationFormData.links.filter((_, i) => i !== index);
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <div>
      <h2 class="text-3xl font-bold">{t('footer.editFooter')}</h2>
      <p class="text-sm text-accent-muted mt-1">
        {t('footer.manageFooterContent')}
      </p>
    </div>
    {#if footer}
      <button
        on:click={openTranslationEditor}
        class="px-4 py-2 bg-black text-white hover:bg-accent transition-colors uppercase"
      >
        {t('homepage.translations')}
      </button>
    {/if}
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error && !footer}
    <div class="bg-red-500/10 border border-red-500/20 p-4">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if footer}
    {#if error}
      <div class="bg-red-500/10 border border-red-500/20 p-4 mb-6">
        <p class="text-red-400">{error}</p>
      </div>
    {/if}

    <div class="bg-dark-light p-6">
      <div class="space-y-6">
        <div class="border border-accent/15 bg-white p-5">
          <div class="mb-5">
            <h3 class="text-xl font-medium">Footer Design</h3>
            <p class="text-sm text-accent-muted mt-2">
              Customize footer background, text colors, spacing, sizing, and alignment.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <label class="block">
              <span class="block text-sm font-medium mb-2">Background</span>
              <div class="flex gap-2">
                <input
                  type="color"
                  bind:value={footerBackgroundColor}
                  class="h-11 w-14 border border-gray-300 bg-white"
                  aria-label="Footer background color picker"
                />
                <input
                  type="text"
                  bind:value={footerBackgroundColor}
                  class="flex-1 px-3 py-2 border border-gray-300 bg-white"
                />
              </div>
            </label>

            <label class="block">
              <span class="block text-sm font-medium mb-2">Primary text</span>
              <div class="flex gap-2">
                <input
                  type="color"
                  bind:value={footerTextColor}
                  class="h-11 w-14 border border-gray-300 bg-white"
                  aria-label="Footer primary text color picker"
                />
                <input
                  type="text"
                  bind:value={footerTextColor}
                  class="flex-1 px-3 py-2 border border-gray-300 bg-white"
                />
              </div>
            </label>

            <label class="block">
              <span class="block text-sm font-medium mb-2">Muted text</span>
              <div class="flex gap-2">
                <input
                  type="color"
                  bind:value={footerMutedTextColor}
                  class="h-11 w-14 border border-gray-300 bg-white"
                  aria-label="Footer muted text color picker"
                />
                <input
                  type="text"
                  bind:value={footerMutedTextColor}
                  class="flex-1 px-3 py-2 border border-gray-300 bg-white"
                />
              </div>
            </label>

            <label class="block">
              <span class="block text-sm font-medium mb-2">Accent / hover</span>
              <div class="flex gap-2">
                <input
                  type="color"
                  bind:value={footerAccentColor}
                  class="h-11 w-14 border border-gray-300 bg-white"
                  aria-label="Footer accent color picker"
                />
                <input
                  type="text"
                  bind:value={footerAccentColor}
                  class="flex-1 px-3 py-2 border border-gray-300 bg-white"
                />
              </div>
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div>
              <label for="footer-spacing" class="block text-sm font-medium mb-2"
                >Vertical spacing</label
              >
              <select
                id="footer-spacing"
                bind:value={footerSpacing}
                class="w-full px-3 py-2 border border-gray-300 bg-white"
              >
                {#each footerSpacingOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>

            <div>
              <label for="footer-alignment" class="block text-sm font-medium mb-2">Alignment</label>
              <select
                id="footer-alignment"
                bind:value={footerAlignment}
                class="w-full px-3 py-2 border border-gray-300 bg-white"
              >
                {#each footerAlignmentOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>

            <div>
              <label for="footer-brand-scale" class="block text-sm font-medium mb-2"
                >Brand title size</label
              >
              <select
                id="footer-brand-scale"
                bind:value={footerBrandTitleScale}
                class="w-full px-3 py-2 border border-gray-300 bg-white"
              >
                {#each footerBrandTitleScaleOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>

            <div>
              <label for="footer-link-size" class="block text-sm font-medium mb-2"
                >Link text size</label
              >
              <select
                id="footer-link-size"
                bind:value={footerLinkTextSize}
                class="w-full px-3 py-2 border border-gray-300 bg-white"
              >
                {#each footerLinkTextSizeOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
          </div>

          <div
            class="border border-accent/10 shadow-sm"
            style={`background:${footerBackgroundColor}; color:${footerTextColor};`}
          >
            <div class={`px-6 ${previewFooterSpacingClass}`}>
              <div
                class={`grid grid-cols-1 md:grid-cols-4 gap-8 ${previewFooterGridAlignmentClass}`}
              >
                <div class={`flex flex-col gap-3 ${previewFooterAlignmentClass}`}>
                  <div class={`font-semibold leading-none ${previewFooterBrandTitleScaleClass}`}>
                    {formData.brandName || 'LOGO'}
                  </div>
                  {#if formData.tagline}
                    <p
                      style={`color:${footerMutedTextColor};`}
                      class={previewFooterLinkTextSizeClass}
                    >
                      {formData.tagline}
                    </p>
                  {/if}
                </div>

                {#each formData.columns.slice(0, 3) as column}
                  <div class={`flex flex-col gap-3 ${previewFooterAlignmentClass}`}>
                    <h4 class="font-medium">{resolveFooterText(column.title) || 'Column'}</h4>
                    <div
                      class={`flex flex-col gap-2 ${previewFooterLinkTextSizeClass}`}
                      style={`color:${footerMutedTextColor};`}
                    >
                      {#each column.links.slice(0, 3) as link}
                        <span>{resolveFooterText(link.text) || 'Link'}</span>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>

              <div
                class="mt-8 border-t pt-6 flex flex-col md:flex-row gap-4 justify-between"
                style={`border-color:${footerMutedTextColor}33;`}
              >
                <p class={previewFooterLinkTextSizeClass} style={`color:${footerMutedTextColor};`}>
                  {formData.copyright || '© {year}.'}
                </p>
                <div
                  class={`flex flex-wrap gap-4 ${footerAlignment === 'center' ? 'justify-center' : 'justify-start'}`}
                >
                  {#each formData.links.slice(0, 3) as link}
                    <span
                      class={previewFooterLinkTextSizeClass}
                      style={`color:${footerAccentColor};`}
                    >
                      {resolveFooterText(link.text) || 'Footer link'}
                    </span>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Brand Name and Tagline -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="brandName" class="block text-sm font-medium mb-2"
              >{t('footer.brandName')} *</label
            >
            <input
              id="brandName"
              type="text"
              bind:value={formData.brandName}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder=""
            />
          </div>
          <div>
            <label for="tagline" class="block text-sm font-medium mb-2">{t('footer.tagline')}</label
            >
            <input
              id="tagline"
              type="text"
              bind:value={formData.tagline}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="ONE TWO THREE"
            />
          </div>
        </div>

        <!-- Copyright -->
        <div>
          <label for="copyright" class="block text-sm font-medium mb-2"
            >{t('footer.copyrightText')} *</label
          >
          <div class="flex gap-2">
            <input
              id="copyright"
              type="text"
              bind:value={formData.copyright}
              class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder="© {'{year}'}."
            />
            <button
              on:click={replaceYearInCopyright}
              class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
              title={t('footer.useYearPlaceholder')}
            >
              {t('footer.replaceYear')}
            </button>
          </div>
          <p class="text-xs text-accent-muted mt-1">
            {t('footer.useYearPlaceholder')}
          </p>
        </div>

        <!-- Columns -->
        <div>
          <div class="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h3 class="text-lg font-medium">{t('footer.columns')}</h3>
            <div class="flex gap-2">
              <button
                type="button"
                on:click={applyDefaultKeys}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                title={t('footer.keyOrCustomHint')}
              >
                {t('footer.applyDefaultKeys')}
              </button>
              <button
                on:click={addColumn}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
              >
                + {t('footer.addColumn')}
              </button>
            </div>
          </div>
          <p class="text-xs text-accent-muted mb-4">
            {t('footer.keyOrCustomHint')}
          </p>

          <div class="space-y-4">
            {#each formData.columns as column, columnIndex}
              <div class="bg-white border border-gray-300 p-4">
                <div class="flex justify-between items-center mb-4">
                  <input
                    type="text"
                    bind:value={column.title}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black font-medium"
                    placeholder={t('footer.columnTitle')}
                  />
                  <button
                    on:click={() => removeColumn(columnIndex)}
                    class="ml-2 px-3 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    {t('footer.delete')}
                  </button>
                </div>

                <div class="space-y-2">
                  {#each column.links as link, linkIndex}
                    <div class="flex gap-2">
                      <input
                        type="text"
                        bind:value={link.text}
                        class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={t('footer.linkText')}
                      />
                      <input
                        type="text"
                        bind:value={link.url}
                        class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={t('footer.linkUrl')}
                      />
                      <button
                        on:click={() => removeLinkFromColumn(columnIndex, linkIndex)}
                        class="px-3 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
                        title={t('footer.delete')}
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                  <button
                    on:click={() => addLinkToColumn(columnIndex)}
                    class="w-full px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                  >
                    + {t('footer.addLink')}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Bottom Links -->
        <div>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">{t('footer.bottomLinks')}</h3>
            <button
              on:click={addBottomLink}
              class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
            >
              + {t('footer.addLink')}
            </button>
          </div>

          <div class="space-y-2">
            {#each formData.links as link, linkIndex}
              <div class="flex gap-2">
                <input
                  type="text"
                  bind:value={link.text}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder={t('footer.linkText')}
                />
                <input
                  type="text"
                  bind:value={link.url}
                  class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                  placeholder={t('footer.linkUrl')}
                />
                <button
                  on:click={() => removeBottomLink(linkIndex)}
                  class="px-3 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title={t('footer.delete')}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- Follow us / Social links -->
        <div>
          <h3 class="text-lg font-medium mb-4">{t('footer.followUs')}</h3>
          <p class="text-sm text-accent-muted mb-4">{t('footer.socialLinks')}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="socialInstagram" class="block text-sm font-medium mb-2"
                >{t('footer.instagram')}</label
              >
              <input
                id="socialInstagram"
                type="url"
                bind:value={formData.socialLinks.instagram}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label for="socialTiktok" class="block text-sm font-medium mb-2"
                >{t('footer.tiktok')}</label
              >
              <input
                id="socialTiktok"
                type="url"
                bind:value={formData.socialLinks.tiktok}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="https://tiktok.com/@..."
              />
            </div>
            <div>
              <label for="socialFacebook" class="block text-sm font-medium mb-2"
                >{t('footer.facebook')}</label
              >
              <input
                id="socialFacebook"
                type="url"
                bind:value={formData.socialLinks.facebook}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label for="socialYoutube" class="block text-sm font-medium mb-2"
                >{t('footer.youtube')}</label
              >
              <input
                id="socialYoutube"
                type="url"
                bind:value={formData.socialLinks.youtube}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>
        </div>

        <!-- Active Toggle -->
        <div class="flex items-center gap-2 pt-4 border-t border-accent/20">
          <input type="checkbox" bind:checked={formData.isActive} id="isActive" />
          <label for="isActive" class="text-sm font-medium">
            {t('footer.active')}
          </label>
        </div>

        <!-- Save Button -->
        <div class="flex gap-4 pt-4">
          <button
            on:click={saveFooter}
            disabled={saving}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('common.saving') : t('common.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showTranslations && footer}
    <div class="bg-dark-light p-6 mb-6 mt-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('homepage.translations')} - {t('footer.editFooter')}</h3>
        <button
          on:click={closeTranslationEditor}
          class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
        >
          {t('common.close')}
        </button>
      </div>

      <!-- Translation Form -->
      <div class="mb-6 p-4 bg-white border border-gray-300">
        <h4 class="text-lg font-medium mb-4">
          {editingTranslation ? t('homepage.editTranslation') : t('homepage.addTranslation')}
        </h4>
        <div class="space-y-4">
          <div>
            <label for="translationLanguage" class="block text-sm font-medium mb-2"
              >{t('language.language')} *</label
            >
            <select
              id="translationLanguage"
              bind:value={selectedLanguageForTranslation}
              disabled={!!editingTranslation}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black disabled:opacity-50"
            >
              <option value="">{t('common.select')} {t('language.language').toLowerCase()}</option>
              {#each languages as lang}
                {#if !translations.find((t) => t.languageCode === lang.code) || editingTranslation?.languageCode === lang.code}
                  <option value={lang.code}>{lang.name} ({lang.code})</option>
                {/if}
              {/each}
            </select>
          </div>
          <div>
            <label for="translationBrandName" class="block text-sm font-medium mb-2"
              >{t('footer.brandName')}</label
            >
            <input
              id="translationBrandName"
              type="text"
              bind:value={translationFormData.brandName}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={formData.brandName}
            />
          </div>
          <div>
            <label for="translationTagline" class="block text-sm font-medium mb-2"
              >{t('footer.tagline')}</label
            >
            <input
              id="translationTagline"
              type="text"
              bind:value={translationFormData.tagline}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={formData.tagline}
            />
          </div>
          <div>
            <label for="translationCopyright" class="block text-sm font-medium mb-2"
              >{t('footer.copyrightText')}</label
            >
            <input
              id="translationCopyright"
              type="text"
              bind:value={translationFormData.copyright}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={formData.copyright}
            />
          </div>

          <!-- Translated Columns -->
          <div>
            <div class="flex justify-between items-center mb-4">
              <p class="block text-sm font-medium">{t('footer.columns')}</p>
              <button
                on:click={addTranslationColumn}
                class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
              >
                + {t('footer.addColumn')}
              </button>
            </div>
            <div class="space-y-4">
              {#each translationFormData.columns as column, columnIndex}
                <div class="bg-gray-50 border border-gray-300 p-4">
                  <div class="flex justify-between items-center mb-4">
                    <input
                      type="text"
                      bind:value={column.title}
                      class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black font-medium"
                      placeholder={t('footer.columnTitle')}
                    />
                    <button
                      on:click={() => removeTranslationColumn(columnIndex)}
                      class="ml-2 px-3 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      {t('footer.delete')}
                    </button>
                  </div>
                  <div class="space-y-2">
                    {#each column.links as link, linkIndex}
                      <div class="flex gap-2">
                        <input
                          type="text"
                          bind:value={link.text}
                          class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                          placeholder={t('footer.linkText')}
                        />
                        <input
                          type="text"
                          bind:value={link.url}
                          class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                          placeholder={t('footer.linkUrl')}
                        />
                        <button
                          on:click={() => removeTranslationLinkFromColumn(columnIndex, linkIndex)}
                          class="px-3 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
                          title={t('footer.delete')}
                        >
                          ×
                        </button>
                      </div>
                    {/each}
                    <button
                      on:click={() => addTranslationLinkToColumn(columnIndex)}
                      class="w-full px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                    >
                      + {t('footer.addLink')}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Translated Bottom Links -->
          <div>
            <div class="flex justify-between items-center mb-4">
              <p class="block text-sm font-medium">{t('footer.bottomLinks')}</p>
              <button
                on:click={addTranslationBottomLink}
                class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors text-sm"
              >
                + {t('footer.addLink')}
              </button>
            </div>
            <div class="space-y-2">
              {#each translationFormData.links as link, linkIndex}
                <div class="flex gap-2">
                  <input
                    type="text"
                    bind:value={link.text}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                    placeholder={t('footer.linkText')}
                  />
                  <input
                    type="text"
                    bind:value={link.url}
                    class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                    placeholder={t('footer.linkUrl')}
                  />
                  <button
                    on:click={() => removeTranslationBottomLink(linkIndex)}
                    class="px-3 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors"
                    title={t('footer.delete')}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <!-- Translated Follow us / Social links -->
          <div>
            <p class="block text-sm font-medium mb-2">{t('footer.followUs')}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="trSocialInstagram" class="block text-xs text-accent-muted mb-1"
                  >{t('footer.instagram')}</label
                >
                <input
                  id="trSocialInstagram"
                  type="url"
                  bind:value={translationFormData.socialLinks.instagram}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                />
              </div>
              <div>
                <label for="trSocialTiktok" class="block text-xs text-accent-muted mb-1"
                  >{t('footer.tiktok')}</label
                >
                <input
                  id="trSocialTiktok"
                  type="url"
                  bind:value={translationFormData.socialLinks.tiktok}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                />
              </div>
              <div>
                <label for="trSocialFacebook" class="block text-xs text-accent-muted mb-1"
                  >{t('footer.facebook')}</label
                >
                <input
                  id="trSocialFacebook"
                  type="url"
                  bind:value={translationFormData.socialLinks.facebook}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                />
              </div>
              <div>
                <label for="trSocialYoutube" class="block text-xs text-accent-muted mb-1"
                  >{t('footer.youtube')}</label
                >
                <input
                  id="trSocialYoutube"
                  type="url"
                  bind:value={translationFormData.socialLinks.youtube}
                  class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                />
              </div>
            </div>
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
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                on:click={closeTranslationEditor}
                class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
              >
                {t('common.cancel')}
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Existing Translations -->
      <div>
        <h4 class="text-lg font-medium mb-4">{t('homepage.existingTranslations')}</h4>
        {#if translations.length === 0}
          <p class="text-accent-muted">{t('homepage.noTranslations')}</p>
        {:else}
          <div class="space-y-2">
            {#each translations as translation}
              <div class="flex items-center justify-between p-4 bg-white border border-gray-300">
                <div>
                  <p class="font-medium">
                    {languages.find((l) => l.code === translation.languageCode)?.name ||
                      translation.languageCode}
                  </p>
                  {#if translation.brandName}
                    <p class="text-sm text-accent-muted">
                      {t('footer.brandName')}: {translation.brandName}
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
