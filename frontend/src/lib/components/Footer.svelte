<script lang="ts">
  import { onMount } from 'svelte';
  import { categoryApi, type Category } from '$lib/api/category.api';
  import { footerApi, type Footer, type FooterColumn } from '$lib/api/footer.api';
  import { settingsStore } from '$lib/stores/settings.store';
  import { i18nStore } from '$lib/stores/i18n.store';
  import { t, resolveFooterText } from '$lib/utils/i18n';

  let topLevelCategories: Category[] = [];
  let popularCategories: Category[] = [];
  let footer: Footer | null = null;
  let footerLoading = true;
  let footerBackgroundColor = '#ffffff';
  let footerTextColor = '#111111';
  let footerMutedTextColor = '#6b7280';
  let footerAccentColor = '#111111';
  let footerSpacing = 'comfortable';
  let footerAlignment = 'left';
  let footerBrandTitleScale = 'medium';
  let footerLinkTextSize = 'small';

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

  // Reactive subscription to language store
  $: currentLanguage = $i18nStore;
  let previousLanguage: string | undefined = undefined;

  async function loadCategories() {
    try {
      const response = await categoryApi.getAll(false, true, false, currentLanguage);
      const allCategories = response.categories;

      // Filter out Lookbook
      const shopCategories = allCategories.filter((c) => {
        const slugLower = c.slug?.toLowerCase() || '';
        const nameLower = c.name?.toLowerCase() || '';
        return slugLower !== 'lookbook' && nameLower !== 'lookbook';
      });

      // Get top-level categories (isMain = true or parentId is null)
      topLevelCategories = shopCategories.filter((c) => {
        if (c.isMain === true) return true;
        if (c.isMain === false) return false;
        return !c.parentId;
      });

      // Get first few subcategories as popular categories
      popularCategories = shopCategories
        .filter((c) => {
          if (c.isMain === true) return false;
          return !!c.parentId;
        })
        .slice(0, 3);
    } catch (e) {
      console.error('Failed to load categories in Footer:', e);
    }
  }

  async function loadFooter() {
    try {
      footerLoading = true;
      const response = await footerApi.get(currentLanguage);
      footer = response.footer;
    } catch (e) {
      console.error('Failed to load footer:', e);
      // Fallback to default if API fails
      footer = {
        id: '',
        brandName: '',
        tagline: '',
        columns: [],
        copyright: `© ${new Date().getFullYear()} .`,
        links: [],
        isActive: true,
        createdAt: '',
        updatedAt: '',
      };
    } finally {
      footerLoading = false;
    }
  }

  function getCopyrightText() {
    if (!footer) return '';
    const year = new Date().getFullYear();
    return footer.copyright.replace('{year}', year.toString());
  }

  $: hasSocialLinks = Boolean(
    footer?.socialLinks?.instagram?.trim() ||
    footer?.socialLinks?.tiktok?.trim() ||
    footer?.socialLinks?.facebook?.trim() ||
    footer?.socialLinks?.youtube?.trim()
  );
  $: footerBackgroundColor = $settingsStore.footerBackgroundColor ?? '#ffffff';
  $: footerTextColor = $settingsStore.footerTextColor ?? '#111111';
  $: footerMutedTextColor = $settingsStore.footerMutedTextColor ?? '#6b7280';
  $: footerAccentColor = $settingsStore.footerAccentColor ?? '#111111';
  $: footerSpacing = $settingsStore.footerSpacing ?? 'comfortable';
  $: footerAlignment = $settingsStore.footerAlignment ?? 'left';
  $: footerBrandTitleScale = $settingsStore.footerBrandTitleScale ?? 'medium';
  $: footerLinkTextSize = $settingsStore.footerLinkTextSize ?? 'small';
  $: footerSpacingClass = footerSpacingClassMap[footerSpacing] ?? footerSpacingClassMap.comfortable;
  $: footerAlignmentClass =
    footerAlignmentClassMap[footerAlignment] ?? footerAlignmentClassMap.left;
  $: footerGridAlignmentClass =
    footerGridAlignmentClassMap[footerAlignment] ?? footerGridAlignmentClassMap.left;
  $: footerBrandTitleScaleClass =
    footerBrandTitleScaleClassMap[footerBrandTitleScale] ?? footerBrandTitleScaleClassMap.medium;
  $: footerLinkTextSizeClass =
    footerLinkTextSizeClassMap[footerLinkTextSize] ?? footerLinkTextSizeClassMap.small;

  onMount(async () => {
    await Promise.all([loadCategories(), loadFooter(), settingsStore.load()]);
  });

  // Reload categories and footer when language changes (but not on initial mount)
  $: if (currentLanguage) {
    if (previousLanguage && previousLanguage !== currentLanguage) {
      loadCategories();
      loadFooter();
    }
    previousLanguage = currentLanguage;
  }
</script>

{#if !footerLoading && footer && footer.isActive}
  <footer
    class="border-t"
    style={`background:${footerBackgroundColor}; color:${footerTextColor}; border-color:${footerMutedTextColor}33; --footer-muted:${footerMutedTextColor}; --footer-accent:${footerAccentColor};`}
  >
    <div class={`container-custom ${footerSpacingClass}`}>
      <div class={`grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 ${footerGridAlignmentClass}`}>
        <!-- Brand Column -->
        <div class={`flex flex-col gap-4 ${footerAlignmentClass}`}>
          <h3 class={`font-bold ${footerBrandTitleScaleClass}`}>{footer.brandName}</h3>
          {#if footer.tagline}
            <p class={footerLinkTextSizeClass} style={`color:${footerMutedTextColor};`}>
              {footer.tagline}
            </p>
          {/if}
        </div>

        <!-- Footer Columns from API (title/link.text: i18n key → auto-translated, else custom) -->
        {#each footer.columns as column}
          <div class={`flex flex-col ${footerAlignmentClass}`}>
            <h4 class="font-medium mb-4">{resolveFooterText(column.title)}</h4>
            <ul
              class={`space-y-2 ${footerLinkTextSizeClass}`}
              style={`color:${footerMutedTextColor};`}
            >
              {#each column.links as link}
                <li>
                  <a
                    href={link.url}
                    class="transition-colors [color:var(--footer-muted)] hover:[color:var(--footer-accent)]"
                  >
                    {resolveFooterText(link.text)}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>

      <!-- Follow us: social links with B&W SVG icons -->
      {#if hasSocialLinks}
        <div class={`mb-8 flex flex-col gap-4 ${footerAlignmentClass}`}>
          <h4 class="font-medium">{t('footer.followUs')}</h4>
          <div class="flex items-center gap-6" style={`color:${footerTextColor};`}>
            {#if footer?.socialLinks?.instagram?.trim()}
              <a
                href={footer.socialLinks?.instagram ?? ''}
                target="_blank"
                rel="noopener noreferrer"
                class="transition-opacity hover:opacity-70"
                aria-label={t('footer.instagram')}
              >
                <svg
                  class="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
            {/if}
            {#if footer?.socialLinks?.tiktok?.trim()}
              <a
                href={footer.socialLinks?.tiktok ?? ''}
                target="_blank"
                rel="noopener noreferrer"
                class="transition-opacity hover:opacity-70"
                aria-label={t('footer.tiktok')}
              >
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88 2.2V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                  />
                </svg>
              </a>
            {/if}
            {#if footer?.socialLinks?.facebook?.trim()}
              <a
                href={footer.socialLinks?.facebook ?? ''}
                target="_blank"
                rel="noopener noreferrer"
                class="transition-opacity hover:opacity-70"
                aria-label={t('footer.facebook')}
              >
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                  />
                </svg>
              </a>
            {/if}
            {#if footer?.socialLinks?.youtube?.trim()}
              <a
                href={footer.socialLinks?.youtube ?? ''}
                target="_blank"
                rel="noopener noreferrer"
                class="transition-opacity hover:opacity-70"
                aria-label={t('footer.youtube')}
              >
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
                  />
                </svg>
              </a>
            {/if}
          </div>
        </div>
      {/if}

      <div
        class={`border-t pt-8 flex flex-col md:flex-row justify-between gap-4 ${footerLinkTextSizeClass} ${footerAlignment === 'center' ? 'items-center text-center' : 'items-start text-left'}`}
        style={`border-color:${footerMutedTextColor}33; color:${footerMutedTextColor};`}
      >
        <p>{getCopyrightText()}</p>
        {#if footer.links && footer.links.length > 0}
          <div class="flex items-center space-x-4 mt-4 md:mt-0">
            <div
              class={`flex flex-wrap gap-x-6 gap-y-2 ${footerAlignment === 'center' ? 'justify-center' : 'justify-start'}`}
            >
              {#each footer.links as link}
                <a
                  href={link.url}
                  class="transition-colors [color:var(--footer-muted)] hover:[color:var(--footer-accent)]"
                >
                  {resolveFooterText(link.text)}
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </footer>
{/if}
