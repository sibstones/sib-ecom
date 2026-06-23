<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { HomepageSection } from '$lib/api/homepage.api';
  import HomepageInlineEditable from '$lib/components/homepage/HomepageInlineEditable.svelte';
  import RevealSection from '$lib/components/homepage/RevealSection.svelte';
  import { t } from '$lib/utils/i18n';

  const dispatch = createEventDispatcher<{
    inlineEdit: {
      sectionId: string;
      field: 'title' | 'config.description';
      value: string;
    };
  }>();

  export let section: HomepageSection | null = null;
  export let inlineEditing = false;

  $: config = (section?.config || {}) as Record<string, unknown>;
  $: description = (config.description as string) || '';
  $: title = section?.title || '';
  $: textAlign = (config.textAlign as 'left' | 'center' | 'right') || 'center';
  $: alignClass =
    textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center';
  $: textBlockMaxWidth = (config.textBlockMaxWidth as string) || 'medium';
  $: maxWClass =
    {
      narrow: 'max-w-2xl',
      medium: 'max-w-3xl',
      wide: 'max-w-5xl',
      full: 'max-w-none',
    }[textBlockMaxWidth] || 'max-w-3xl';
  $: blockAlign =
    textAlign === 'center' ? 'mx-auto' : textAlign === 'right' ? 'ml-auto mr-0' : 'mr-auto ml-0';
  $: textBlockAnimation =
    (config.textBlockAnimation as 'fade_up' | 'fade' | 'scale' | 'none') || 'fade_up';
  $: bg = (config.backgroundColor as string)?.trim() || '';
  $: fg = (config.textColor as string)?.trim() || '';
  $: paddingTop = (config.paddingTop as string) || '';
  $: paddingBottom = (config.paddingBottom as string) || '';
  $: sectionStyle = bg ? `background-color: ${bg}` : undefined;
  $: vertPad =
    !paddingTop && !paddingBottom
      ? 'py-12 sm:py-16 md:py-20'
      : [paddingTop, paddingBottom].filter(Boolean).join(' ');
  $: proseInherit =
    fg &&
    '[&_p]:text-current [&_li]:text-current [&_h1]:text-current [&_h2]:text-current [&_h3]:text-current [&_h4]:text-current [&_a]:text-current [&_strong]:text-current';

  function emitInlineEdit(field: 'title' | 'config.description', value: string) {
    if (!section) return;
    dispatch('inlineEdit', { sectionId: section.id, field, value });
  }
</script>

{#if section?.isActive && (title || description)}
  <section class={bg ? '' : 'bg-white'} style={sectionStyle}>
    <div class="container-custom {vertPad}">
      <RevealSection animation={textBlockAnimation}>
        {#if title || inlineEditing}
          <h2 class="text-2xl sm:text-3xl font-semibold mb-6 text-balance w-full {alignClass}">
            <HomepageInlineEditable
              tag="span"
              value={title}
              enabled={inlineEditing}
              placeholder={t('homepage.editor.sectionTitle')}
              on:change={(event) => emitInlineEdit('title', event.detail)}
            />
          </h2>
        {/if}
        {#if description || inlineEditing}
          <HomepageInlineEditable
            tag="div"
            html={true}
            value={description}
            enabled={inlineEditing}
            placeholder={t('homepage.editor.sectionBody')}
            className="prose prose-neutral prose-lg {maxWClass} w-full {blockAlign} {alignClass} {proseInherit ||
              'text-gray-800'} [&_p]:mb-4 [&_a]:underline [&_a]:underline-offset-4"
            style={fg ? `color: ${fg}` : undefined}
            on:change={(event) => emitInlineEdit('config.description', event.detail)}
          />
        {/if}
      </RevealSection>
    </div>
  </section>
{/if}
