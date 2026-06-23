<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { HomepageSection } from '$lib/api/homepage.api';
  import { t } from '$lib/utils/i18n';

  const dispatch = createEventDispatcher<{
    select: { sectionId: string };
    assetSelected: { sectionId: string; file: File };
  }>();

  export let section: HomepageSection;
  export let editorOpen = false;
  export let selected = false;
  export let label = '';
  export let supportsMediaUpload = false;
  export let mediaUploadLabel = '';
  export let showSectionMediaButton = true;

  let isDragging = false;
  let fileInput: HTMLInputElement | null = null;

  function handleSelect() {
    dispatch('select', { sectionId: section.id });
  }

  function openFileDialog() {
    fileInput?.click();
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    dispatch('assetSelected', { sectionId: section.id, file: input.files[0] });
    input.value = '';
  }

  function handleDragOver(event: DragEvent) {
    if (!(editorOpen && selected && supportsMediaUpload)) return;
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    if (!(editorOpen && selected && supportsMediaUpload)) return;
    event.preventDefault();
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    if (!(editorOpen && selected && supportsMediaUpload)) return;
    event.preventDefault();
    isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    dispatch('assetSelected', { sectionId: section.id, file });
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id={`homepage-section-${section.id}`}
  class="relative transition-[margin,transform] duration-300 ease-out {editorOpen
    ? 'scroll-mt-24'
    : ''}"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <div
    class="relative transition-all duration-200 {editorOpen
      ? selected
        ? isDragging
          ? 'ring-2 ring-black ring-offset-4 ring-offset-white bg-black/[0.03]'
          : 'ring-2 ring-black ring-offset-4 ring-offset-white'
        : 'ring-1 ring-black/20 ring-offset-2 ring-offset-white'
      : ''}"
  >
    <slot />
  </div>

  {#if editorOpen && !selected}
    <button
      type="button"
      class="absolute inset-0 z-20 cursor-pointer bg-black/0 transition hover:bg-black/5"
      on:click={handleSelect}
      aria-label={t('homepage.editor.editSectionAria', {
        label: label || section.title || section.type,
      })}
    >
      <span
        class="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black shadow-sm"
      >
        {label || section.title || section.type}
      </span>
      {#if selected}
        <span
          class="absolute right-4 top-4 rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
        >
          {t('homepage.editor.editing')}
        </span>
      {/if}
    </button>
  {:else if editorOpen && selected}
    <div class="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2">
      <span
        class="rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black shadow-sm"
      >
        {label || section.title || section.type}
      </span>
      <span
        class="rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
      >
        {t('homepage.editor.editing')}
      </span>
    </div>

    {#if supportsMediaUpload && showSectionMediaButton}
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*,video/*,audio/*"
        class="hidden"
        on:change={handleFileChange}
      />

      <button
        type="button"
        class="absolute bottom-4 right-4 z-20 rounded-2xl border border-black/10 bg-white/95 px-4 py-3 text-left text-xs text-black shadow-lg backdrop-blur transition hover:bg-white"
        on:click={openFileDialog}
      >
        <span class="block text-[11px] font-semibold uppercase tracking-[0.16em] text-black/55">
          {t('homepage.editor.media')}
        </span>
        <span class="mt-1 block text-sm font-medium">
          {isDragging
            ? t('homepage.editor.releaseToUpload')
            : mediaUploadLabel || t('homepage.editor.dropMediaHereOrClickToUpload')}
        </span>
      </button>
    {/if}
  {/if}
</div>
