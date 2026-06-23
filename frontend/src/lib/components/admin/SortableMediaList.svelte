<script lang="ts">
  import { reorderArrayItem } from '$lib/utils/drag-reorder';
  import { t } from '$lib/utils/i18n';
  import type { SortableMediaItem } from '$lib/types/sortable-media';

  export let items: SortableMediaItem[] = [];
  export let onReorder: (items: SortableMediaItem[]) => void | Promise<void>;
  export let onDelete: (id: string, event?: Event) => void | Promise<void>;
  export let getAlt: (item: SortableMediaItem) => string = (item) => item.alt || '';
  export let isVideo: (url: string) => boolean = (url) =>
    url.includes('video') || /\.(mp4|webm|mov)$/i.test(url);

  let draggedIndex: number | null = null;
  let dragOverIndex: number | null = null;

  function handleDragStart(index: number, event: DragEvent) {
    draggedIndex = index;
    dragOverIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  async function handleDrop(targetIndex: number) {
    if (draggedIndex === null) return;
    const from = draggedIndex;
    draggedIndex = null;
    dragOverIndex = null;
    if (from === targetIndex) return;
    const reordered = reorderArrayItem(items, from, targetIndex);
    await onReorder(reordered);
  }
</script>

{#if items.length > 0}
  <div class="space-y-2 mb-6" role="list">
    <p class="text-xs text-gray-500 mb-2">{t('product.dragToReorder')}</p>
    {#each items as item, index (item.id)}
      <div
        class="flex items-center gap-4 bg-white p-4 border transition-colors select-none
          {draggedIndex === index ? 'opacity-50 border-gray-400' : 'border-transparent'}
          {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
          ? 'border-black bg-gray-50'
          : ''}"
        role="listitem"
        draggable="true"
        on:dragstart={(e) => handleDragStart(index, e)}
        on:dragover={(e) => handleDragOver(index, e)}
        on:drop|preventDefault={() => handleDrop(index)}
        on:dragend={handleDragEnd}
      >
        <button
          type="button"
          class="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 p-1"
          aria-label={t('product.dragToReorder')}
          tabindex="-1"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M7 2a2 2 0 11-.001 4.001A2 2 0 017 2zm0 6a2 2 0 11-.001 4.001A2 2 0 017 8zm0 6a2 2 0 11-.001 4.001A2 2 0 017 14zm6-8a2 2 0 11-.001 4.001A2 2 0 0113 6zm0 6a2 2 0 11-.001 4.001A2 2 0 0113 12zm0 6a2 2 0 11-.001 4.001A2 2 0 0113 18z"
            />
          </svg>
        </button>
        <div class="relative flex-shrink-0 pointer-events-none">
          {#if isVideo(item.url)}
            <video src={item.url} class="w-24 h-24 object-cover" muted></video>
          {:else}
            <img src={item.url} alt={getAlt(item)} class="w-24 h-24 object-cover" />
          {/if}
        </div>
        <div class="flex-1 min-w-0 pointer-events-none">
          <p class="text-sm text-black font-medium">{t('common.order')}: {index + 1}</p>
          {#if item.alt}
            <p class="text-xs text-gray-600 truncate">{item.alt}</p>
          {/if}
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button
            type="button"
            on:click={(e) => onDelete(item.id, e)}
            class="px-3 py-1 bg-white border border-red-500/20 text-sm text-red-400 hover:bg-red-50 transition-colors"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
