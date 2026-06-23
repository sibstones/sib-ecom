<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/utils/i18n';

  const dispatch = createEventDispatcher<{
    select: File;
  }>();

  export let enabled = false;
  export let accept = 'image/*,video/*,audio/*';
  export let label = '';
  export let hint = '';

  let dragging = false;
  let fileInput: HTMLInputElement | null = null;

  function openFileDialog() {
    fileInput?.click();
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    dispatch('select', input.files[0]);
    input.value = '';
  }

  function handleDragOver(event: DragEvent) {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = false;
  }

  function handleDrop(event: DragEvent) {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    dispatch('select', file);
  }
</script>

{#if enabled}
  <input bind:this={fileInput} type="file" {accept} class="hidden" on:change={handleFileChange} />

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="absolute inset-0 z-[15] flex items-end justify-end p-4"
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
  >
    <button
      type="button"
      class="rounded-2xl border border-white/25 bg-black/65 px-4 py-3 text-left text-white shadow-lg backdrop-blur transition hover:bg-black/75"
      on:click={openFileDialog}
    >
      <span class="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
        {label || t('homepage.editor.replaceMedia')}
      </span>
      <span class="mt-1 block text-sm font-medium">
        {dragging
          ? t('homepage.editor.releaseToUpload')
          : hint || t('homepage.editor.dropFileHereOrClick')}
      </span>
    </button>
  </div>
{/if}
