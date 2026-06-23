<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { HomepageSection } from '$lib/api/homepage.api';
  import BlurredImage from '$lib/components/BlurredImage.svelte';
  import HomepageInlineEditable from '$lib/components/homepage/HomepageInlineEditable.svelte';
  import HomepageInlineMediaDropzone from '$lib/components/homepage/HomepageInlineMediaDropzone.svelte';
  import { t } from '$lib/utils/i18n';

  const dispatch = createEventDispatcher<{
    inlineEdit: {
      sectionId: string;
      field: 'title' | 'config.description';
      value: string;
    };
    assetReplace: {
      sectionId: string;
      field: 'config.imageUrl';
      file: File;
    };
  }>();

  export let section: HomepageSection | null = null;
  export let inlineEditing = false;

  $: config = (section?.config ?? {}) as Record<string, unknown>;
  $: title = typeof section?.title === 'string' ? section.title.trim() : '';
  $: description = String(
    config.description ?? 'Explore our latest collection through our editorial lookbook'
  );
  $: imageUrl = String(config.imageUrl ?? '');
  $: lookbookId = config.lookbookId;

  function emitInlineEdit(field: 'title' | 'config.description', value: string) {
    if (!section) return;
    dispatch('inlineEdit', { sectionId: section.id, field, value });
  }

  function emitAssetReplace(file: File) {
    if (!section) return;
    dispatch('assetReplace', { sectionId: section.id, field: 'config.imageUrl', file });
  }
</script>

{#if section?.isActive}
  <section class="container-custom py-20">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <div>
        <h2 class="text-5xl font-bold mb-6">
          <HomepageInlineEditable
            tag="span"
            value={title}
            enabled={inlineEditing}
            placeholder={t('homepage.editor.sectionTitle')}
            on:change={(event) => emitInlineEdit('title', event.detail)}
          />
        </h2>
        <p class="text-xl text-accent-muted mb-8">
          <HomepageInlineEditable
            tag="span"
            value={description}
            enabled={inlineEditing}
            placeholder={t('homepage.editor.lookbookDescription')}
            on:change={(event) => emitInlineEdit('config.description', event.detail)}
          />
        </p>
        <a
          href={lookbookId ? `/lookbook/${lookbookId}` : '/lookbook'}
          class="inline-block px-8 py-4 border border-accent/20 hover:border-accent/50 transition-colors"
        >
          View Lookbook
        </a>
      </div>
      <div class="relative bg-dark-light aspect-[9/16] overflow-hidden">
        {#if imageUrl}
          <BlurredImage
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        {/if}
        <HomepageInlineMediaDropzone
          enabled={inlineEditing}
          accept="image/*"
          label={t('homepage.editor.lookbookImage')}
          hint={t('homepage.editor.replaceImage')}
          on:select={(event) => emitAssetReplace(event.detail)}
        />
      </div>
    </div>
  </section>
{/if}
