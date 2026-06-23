<script lang="ts">
  import { blogApi } from '$lib/api/blog.api';
  import { notificationStore } from '$lib/stores/notification.store';
  import { t } from '$lib/utils/i18n';

  export let value = '';
  export let placeholder = 'Write your story...';

  let editorElement: HTMLDivElement | null = null;
  let fileInput: HTMLInputElement | null = null;
  let isFocused = false;
  let showMediaPanel = false;
  let activeMediaType: 'image' | 'video' | 'audio' = 'image';
  let uploadInProgress = false;
  let isDraggingUpload = false;
  let mediaUrl = '';
  let mediaAlt = '';
  let mediaCaption = '';

  const mediaAcceptMap: Record<'image' | 'video' | 'audio', string> = {
    image: 'image/*',
    video: 'video/*',
    audio: 'audio/*',
  };

  $: if (editorElement && !isFocused && editorElement.innerHTML !== (value || '')) {
    editorElement.innerHTML = value || '';
  }

  function focusEditor() {
    editorElement?.focus();
  }

  function syncValue() {
    if (!editorElement) return;
    value = editorElement.innerHTML;
  }

  function runCommand(command: string, commandValue?: string) {
    focusEditor();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function applyBlock(tag: 'p' | 'h2' | 'h3' | 'blockquote') {
    runCommand('formatBlock', tag);
  }

  function clearFormatting() {
    runCommand('removeFormat');
  }

  function insertLink() {
    const link = window.prompt(t('blog.editorLink') || 'Enter link URL');
    if (!link?.trim()) return;
    runCommand('createLink', link.trim());
  }

  function escapeHtml(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildMediaHtml() {
    const safeUrl = mediaUrl.trim();
    const safeAlt = escapeHtml(mediaAlt.trim());
    const safeCaption = mediaCaption.trim()
      ? `<figcaption class="mt-3 text-sm text-gray-500">${escapeHtml(mediaCaption.trim())}</figcaption>`
      : '';

    if (activeMediaType === 'image') {
      return `
        <figure class="my-8">
          <img src="${escapeHtml(safeUrl)}" alt="${safeAlt}" class="w-full h-auto rounded-xl" />
          ${safeCaption}
        </figure>
      `;
    }

    if (activeMediaType === 'video') {
      return `
        <figure class="my-8">
          <video src="${escapeHtml(safeUrl)}" controls playsinline preload="metadata" class="w-full rounded-xl bg-black"></video>
          ${safeCaption}
        </figure>
      `;
    }

    return `
      <figure class="my-8">
        <audio src="${escapeHtml(safeUrl)}" controls preload="metadata" class="w-full"></audio>
        ${safeCaption}
      </figure>
    `;
  }

  function insertMedia() {
    if (!mediaUrl.trim()) {
      notificationStore.error(
        t('blog.editorMediaUrlRequired') || 'Add a media URL or upload a file first'
      );
      return;
    }

    focusEditor();
    document.execCommand('insertHTML', false, buildMediaHtml());
    syncValue();
    mediaUrl = '';
    mediaAlt = '';
    mediaCaption = '';
    showMediaPanel = false;
  }

  async function uploadMedia(file: File) {
    uploadInProgress = true;
    try {
      const response = await blogApi.uploadMedia(file);
      mediaUrl = response.url;
      notificationStore.success(t('blog.editorMediaUploaded') || 'Media uploaded');
    } catch (error) {
      notificationStore.error(
        error instanceof Error
          ? error.message
          : t('blog.editorMediaUploadFailed') || 'Failed to upload media'
      );
    } finally {
      uploadInProgress = false;
      isDraggingUpload = false;
    }
  }

  function openFileDialog() {
    fileInput?.click();
  }

  function onUploadChange(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement) || !target.files?.[0]) return;
    uploadMedia(target.files[0]);
    target.value = '';
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingUpload = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    uploadMedia(file);
  }

  function onPaste() {
    syncValue();
  }

  function toggleMediaPanel(type?: 'image' | 'video' | 'audio') {
    showMediaPanel = !showMediaPanel || !!type;
    if (type) activeMediaType = type;
  }
</script>

<div class="rounded-2xl border border-gray-200 bg-white shadow-sm">
  <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
    <button type="button" on:click={() => applyBlock('p')} class="toolbar-btn"
      >{t('blog.editorBody') || 'Body'}</button
    >
    <button type="button" on:click={() => applyBlock('h2')} class="toolbar-btn">H2</button>
    <button type="button" on:click={() => applyBlock('h3')} class="toolbar-btn">H3</button>
    <button type="button" on:click={() => runCommand('bold')} class="toolbar-btn"
      ><strong>B</strong></button
    >
    <button type="button" on:click={() => runCommand('italic')} class="toolbar-btn"
      ><em>I</em></button
    >
    <button type="button" on:click={() => runCommand('underline')} class="toolbar-btn"
      ><span class="underline">U</span></button
    >
    <button type="button" on:click={() => runCommand('insertUnorderedList')} class="toolbar-btn"
      >{t('blog.editorList') || 'List'}</button
    >
    <button type="button" on:click={() => runCommand('insertOrderedList')} class="toolbar-btn"
      >1.</button
    >
    <button type="button" on:click={() => applyBlock('blockquote')} class="toolbar-btn"
      >{t('blog.editorQuote') || 'Quote'}</button
    >
    <button type="button" on:click={insertLink} class="toolbar-btn"
      >{t('blog.editorLink') || 'Link'}</button
    >
    <button type="button" on:click={() => runCommand('insertHorizontalRule')} class="toolbar-btn"
      >{t('blog.editorDivider') || 'Divider'}</button
    >
    <button type="button" on:click={clearFormatting} class="toolbar-btn"
      >{t('blog.editorClear') || 'Clear'}</button
    >
    <div class="h-6 w-px bg-gray-200 mx-1"></div>
    <button type="button" on:click={() => toggleMediaPanel('image')} class="toolbar-btn"
      >{t('blog.editorImage') || 'Image'}</button
    >
    <button type="button" on:click={() => toggleMediaPanel('video')} class="toolbar-btn"
      >{t('blog.video') || 'Video'}</button
    >
    <button type="button" on:click={() => toggleMediaPanel('audio')} class="toolbar-btn"
      >{t('blog.editorAudio') || 'Audio'}</button
    >
  </div>

  {#if showMediaPanel}
    <div class="border-b border-gray-200 bg-gray-50 px-4 py-4">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          on:click={() => (activeMediaType = 'image')}
          class="media-type-btn {activeMediaType === 'image' ? 'active' : ''}"
        >
          {t('blog.editorImage') || 'Image'}
        </button>
        <button
          type="button"
          on:click={() => (activeMediaType = 'video')}
          class="media-type-btn {activeMediaType === 'video' ? 'active' : ''}"
        >
          {t('blog.video') || 'Video'}
        </button>
        <button
          type="button"
          on:click={() => (activeMediaType = 'audio')}
          class="media-type-btn {activeMediaType === 'audio' ? 'active' : ''}"
        >
          {t('blog.editorAudio') || 'Audio'}
        </button>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <input
          type="url"
          bind:value={mediaUrl}
          placeholder={t('blog.editorPasteMediaUrl', { type: activeMediaType }) ||
            `Paste ${activeMediaType} URL`}
          class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-black"
        />
        <input
          type="text"
          bind:value={mediaAlt}
          placeholder={activeMediaType === 'image'
            ? t('blog.editorAltText') || 'Alt text'
            : t('blog.editorOptionalLabel') || 'Optional label'}
          class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-black"
        />
      </div>

      <textarea
        bind:value={mediaCaption}
        rows="2"
        placeholder={t('blog.editorCaption') || 'Caption'}
        class="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-black"
      ></textarea>

      <input
        bind:this={fileInput}
        type="file"
        accept={mediaAcceptMap[activeMediaType]}
        class="hidden"
        on:change={onUploadChange}
      />

      <div
        class="mt-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all {isDraggingUpload
          ? 'border-black bg-white'
          : 'border-gray-300 bg-white/70'}"
        role="button"
        tabindex="0"
        on:dragover|preventDefault={() => (isDraggingUpload = true)}
        on:dragleave|preventDefault={() => (isDraggingUpload = false)}
        on:drop={onDrop}
        on:click={openFileDialog}
        on:keydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFileDialog();
          }
        }}
      >
        <p class="text-sm text-gray-700">
          {uploadInProgress
            ? t('blog.editorUploadingMedia') || 'Uploading media...'
            : t('blog.editorDropMedia', { type: activeMediaType }) ||
              `Drop ${activeMediaType} here or`}
          {#if !uploadInProgress}
            <button type="button" class="ml-1 font-medium underline" on:click={openFileDialog}
              >{t('blog.editorChooseFile') || 'choose file'}</button
            >
          {/if}
        </p>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-gray-500">
          {t('blog.editorSupportsMedia') ||
            'Supports rich article blocks with image, video and audio embeds inside the story.'}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            on:click={() => (showMediaPanel = false)}
            class="rounded-xl border border-gray-300 px-4 py-2 text-sm text-black"
          >
            {t('blog.editorClose') || 'Close'}
          </button>
          <button
            type="button"
            on:click={insertMedia}
            class="rounded-xl bg-black px-4 py-2 text-sm text-white"
          >
            {t('blog.editorInsertMedia') || 'Insert media'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <div
    bind:this={editorElement}
    class="editor min-h-[360px] px-5 py-5 text-black"
    contenteditable="true"
    data-placeholder={placeholder}
    on:focus={() => (isFocused = true)}
    on:blur={() => {
      isFocused = false;
      syncValue();
    }}
    on:input={syncValue}
    on:paste={onPaste}
  ></div>
</div>

<style>
  .toolbar-btn {
    border: 1px solid rgb(229 231 235);
    border-radius: 9999px;
    background: white;
    padding: 0.45rem 0.8rem;
    font-size: 0.875rem;
    line-height: 1;
    color: black;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .toolbar-btn:hover {
    background: rgb(249 250 251);
    border-color: rgb(209 213 219);
  }

  .media-type-btn {
    border: 1px solid rgb(209 213 219);
    border-radius: 9999px;
    padding: 0.45rem 0.85rem;
    font-size: 0.875rem;
    background: white;
    color: black;
  }

  .media-type-btn.active {
    background: black;
    color: white;
    border-color: black;
  }

  .editor {
    outline: none;
  }

  .editor:empty::before {
    content: attr(data-placeholder);
    color: rgb(156 163 175);
  }

  .editor :global(h2) {
    margin: 1.5rem 0 0.85rem;
    font-size: 1.875rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .editor :global(h3) {
    margin: 1.25rem 0 0.75rem;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .editor :global(p) {
    margin: 0 0 1rem;
    line-height: 1.8;
  }

  .editor :global(blockquote) {
    margin: 1.5rem 0;
    border-left: 3px solid black;
    padding-left: 1rem;
    color: rgb(75 85 99);
  }

  .editor :global(ul),
  .editor :global(ol) {
    margin: 1rem 0 1rem 1.5rem;
  }

  .editor :global(figure) {
    margin: 2rem 0;
  }

  .editor :global(figcaption) {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: rgb(107 114 128);
  }
</style>
