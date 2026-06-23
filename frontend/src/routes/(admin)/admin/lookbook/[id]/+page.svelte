<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { adminApi } from '$lib/api/admin.api';
  import { lookbookApi, type Lookbook, type LookbookImage } from '$lib/api/lookbook.api';
  import { goto } from '$app/navigation';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { t } from '$lib/utils/i18n';
  import LookbookSeasonSelect from '$lib/components/admin/LookbookSeasonSelect.svelte';
  import SortableMediaList from '$lib/components/admin/SortableMediaList.svelte';
  import { resolveApiError } from '$lib/utils/error-handler';
  import { normalizeUploadFiles } from '$lib/utils/file-upload';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';
  import { translationApi, type LookbookTranslation } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';

  let loading = true;
  let saving = false;
  let uploading = false;
  let error = '';
  let lookbook: Lookbook | null = null;
  let images: LookbookImage[] = [];
  let newImages: File[] = [];
  let newImagePreviews: string[] = [];
  let selectedFiles: File[] = [];
  let isDragging = false;
  let fileInputRef: HTMLInputElement | null = null;

  // Translation management
  let languages: Language[] = [];
  let translations: LookbookTranslation[] = [];
  let showTranslations = false;
  let editingTranslation: LookbookTranslation | null = null;
  let selectedLanguageForTranslation = '';
  let gptTranslating = false;
  let translationFormData = {
    title: '',
    description: '',
  };

  let formData = {
    title: '',
    slug: '',
    description: '',
    season: '',
    year: new Date().getFullYear(),
    isActive: true,
  };

  // Design settings for lookbook detail page
  let pageSettings = {
    titleSize: 'text-5xl',
    titleColor: '',
    backgroundColor: '',
    paddingTop: 'py-12',
    paddingBottom: '',
    // Collage settings
    gridColumns: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    gap: 'gap-4',
    imageAspectRatio: 'aspect-auto',
    masonryLayout: false,
  };

  $: lookbookId = $page.params.id;

  onMount(async () => {
    await Promise.all([loadLookbook(), loadPageSettings(), loadLanguages()]);
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
    if (!lookbook) return;
    try {
      const response = await translationApi.getLookbookTranslations(lookbook.id);
      translations = response.translations;
    } catch (e) {
      console.error('Failed to load translations:', e);
      translations = [];
    }
  }

  function openTranslationEditor() {
    if (!lookbook) return;
    showTranslations = true;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {
      title: '',
      description: '',
    };
    loadTranslations();
  }

  function closeTranslationEditor() {
    showTranslations = false;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {
      title: '',
      description: '',
    };
  }

  function editTranslation(translation: LookbookTranslation) {
    editingTranslation = translation;
    selectedLanguageForTranslation = translation.languageCode;
    translationFormData = {
      title: translation.title || '',
      description: translation.description || '',
    };
  }

  async function saveTranslation() {
    if (!lookbook) return;

    try {
      await translationApi.upsertLookbookTranslation(lookbook.id, {
        languageCode: selectedLanguageForTranslation,
        title: translationFormData.title || undefined,
        description: translationFormData.description || undefined,
      });
      notificationStore.success(t('notification.translationSaved'));
      await loadTranslations();
      editingTranslation = null;
      selectedLanguageForTranslation = '';
      translationFormData = {
        title: '',
        description: '',
      };
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteTranslation(languageCode: string) {
    if (!lookbook) return;

    const confirmed = await dialogStore.confirm(t('alert.deleteTranslation'), t('common.confirm'));
    if (!confirmed) return;

    try {
      await translationApi.deleteLookbookTranslation(lookbook.id, languageCode);
      notificationStore.success(t('notification.translationDeleted'));
      await loadTranslations();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  async function translateWithGPT() {
    if (!lookbook) return;

    gptTranslating = true;
    try {
      const sourceLanguage = 'en';
      const targetLanguage = selectedLanguageForTranslation;

      const targetLang = languages.find((l) => l.code === targetLanguage);
      if (!targetLang) {
        notificationStore.error(t('notification.targetLanguageNotFound'));
        return;
      }

      // Translate title
      if (lookbook.title) {
        try {
          const titleTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: lookbook.title,
          });
          translationFormData.title = titleTranslation.translation;
        } catch (e) {
          console.error('Failed to translate title:', e);
        }
      }

      // Translate description
      if (lookbook.description) {
        try {
          const descTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: lookbook.description,
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

  async function loadLookbook() {
    loading = true;
    error = '';
    try {
      const response = await lookbookApi.getById(lookbookId);

      if (!response.lookbook) {
        error = t('lookbook.notFound');
        return;
      }

      lookbook = response.lookbook;
      formData = {
        title: lookbook.title,
        slug: lookbook.slug,
        description: lookbook.description || '',
        season: lookbook.season || '',
        year: lookbook.year || new Date().getFullYear(),
        isActive: lookbook.isActive,
      };

      images = lookbook.images || [];
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      error = err.response?.data?.error || err.message || t('lookbook.failedToLoad');
    } finally {
      loading = false;
    }
  }

  function loadPageSettings() {
    const savedSettings = localStorage.getItem(`lookbookDetailSettings_${lookbookId}`);
    if (savedSettings) {
      try {
        pageSettings = { ...pageSettings, ...JSON.parse(savedSettings) };
      } catch (e) {
        console.error('Failed to load page settings:', e);
      }
    }
  }

  function handleImageSelect(event: Event) {
    const target = event.target;
    if (target && 'files' in target && target.files) {
      const files = normalizeUploadFiles(Array.from(target.files as FileList));
      newImages = [...newImages, ...files];

      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newImagePreviews = [...newImagePreviews, e.target.result as string];
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function removeNewImage(index: number) {
    newImages = newImages.filter((_, i) => i !== index);
    newImagePreviews = newImagePreviews.filter((_, i) => i !== index);
  }

  async function uploadNewImages() {
    if (newImages.length === 0 || !lookbook) return;

    try {
      for (let i = 0; i < newImages.length; i++) {
        const file = newImages[i];
        // Convert file to base64 or upload via API
        const formDataObj = new FormData();
        formDataObj.append('file', normalizeUploadFiles([file])[0]);
        formDataObj.append('lookbookId', lookbook.id);
        formDataObj.append('order', (images.length + i).toString());

        // Note: You'll need to implement image upload endpoint
        // For now, we'll use URL input instead
      }
      notificationStore.info(t('lookbook.imageUploadNotImplemented'));
      newImages = [];
      newImagePreviews = [];
      await loadLookbook();
    } catch (e: any) {
      notificationStore.error(e.message || t('lookbook.failedToUploadImages'));
    }
  }

  async function saveLookbook() {
    saving = true;
    error = '';
    try {
      await adminApi.updateLookbook(lookbookId, formData);
      goto('/admin/lookbook');
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      error = err.response?.data?.error || err.message || t('lookbook.failedToUpdate');
    } finally {
      saving = false;
    }
  }

  async function savePageSettings() {
    localStorage.setItem(`lookbookDetailSettings_${lookbookId}`, JSON.stringify(pageSettings));
    notificationStore.success(t('lookbook.pageSettingsSaved'));
  }

  async function deleteImage(imageId: string) {
    const confirmed = await dialogStore.confirm(
      t('lookbook.deleteImageConfirm'),
      t('lookbook.deleteImage'),
      t('common.ok'),
      t('common.cancel')
    );

    if (!confirmed) {
      return;
    }

    try {
      await lookbookApi.deleteImage(imageId);
      await loadLookbook();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : t('lookbook.failedToDeleteImage');
      notificationStore.error(errorMsg);
    }
  }

  async function reorderImages() {
    if (!lookbook) return;

    const imageOrders = images.map((img, index) => ({
      id: img.id,
      order: index,
    }));

    try {
      await lookbookApi.reorderImages(lookbook.id, imageOrders);
      await loadLookbook();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : t('lookbook.failedToReorderImages');
      notificationStore.error(errorMsg);
    }
  }

  async function handleImagesReorder(
    reordered: import('$lib/types/sortable-media').SortableMediaItem[]
  ) {
    images = reordered as typeof images;
    await reorderImages();
  }

  function generateSlug() {
    if (!formData.slug && formData.title) {
      formData.slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  }

  async function addImagesFromUrls() {
    const textarea = document.getElementById('imageUrls');
    if (!textarea || !(textarea instanceof HTMLTextAreaElement)) return;
    const urls = textarea.value.split('\n').filter((url) => url.trim());
    if (urls.length === 0 || !lookbook) return;

    try {
      for (let i = 0; i < urls.length; i++) {
        await lookbookApi.addImage({
          lookbookId: lookbook.id,
          url: urls[i].trim(),
          order: images.length + i,
        });
      }
      textarea.value = '';
      await loadLookbook();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : t('lookbook.failedToAddImages');
      notificationStore.error(errorMsg);
    }
  }

  function isVideoUrl(url: string): boolean {
    const videoRegex = /\.(mp4|webm|ogg|mov)$/i;
    return videoRegex.test(url) || url.includes('video');
  }

  function handleFileSelect(event: Event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.files) {
      selectedFiles = normalizeUploadFiles(Array.from(target.files));
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;

    if (event.dataTransfer?.files) {
      const files = normalizeUploadFiles(Array.from(event.dataTransfer.files));
      const validFiles = files.filter((file) => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        return isImage || isVideo;
      });
      selectedFiles = [...selectedFiles, ...validFiles];
    }
  }

  function removeSelectedFile(index: number) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
  }

  function openFileDialog() {
    if (fileInputRef) {
      fileInputRef.click();
    }
  }

  async function uploadFiles() {
    if (selectedFiles.length === 0 || !lookbook) return;

    uploading = true;
    error = '';
    try {
      if (selectedFiles.length === 1) {
        // Upload single file
        await adminApi.uploadLookbookImage(
          selectedFiles[0],
          lookbook.id,
          selectedFiles[0].name,
          images.length
        );
      } else {
        // Upload multiple files
        await adminApi.uploadMultipleLookbookImages(selectedFiles, lookbook.id);
      }
      selectedFiles = [];
      // Reset file input
      const fileInput = document.getElementById('fileInput') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      await loadLookbook();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : t('lookbook.failedToUploadFiles');
      error = errorMsg;
      alert(errorMsg);
    } finally {
      uploading = false;
    }
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-3xl font-bold">{t('lookbook.editLookbook')}</h2>
    <div class="flex gap-2">
      <button
        on:click={openTranslationEditor}
        class="px-4 py-2 bg-black text-white hover:bg-accent transition-colors"
      >
        {t('homepage.translations')}
      </button>
      <button
        on:click={() => goto('/admin/lookbook')}
        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
      >
        {t('common.back')}
      </button>
      <button
        on:click={async () => {
          const confirmed = await dialogStore.confirm(
            t('lookbook.deleteConfirm'),
            t('lookbook.deleteLookbook'),
            t('common.ok'),
            t('common.cancel')
          );

          if (!confirmed) {
            return;
          }

          try {
            await adminApi.deleteLookbook(lookbookId);
            goto('/admin/lookbook');
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : t('lookbook.failedToDelete');
            notificationStore.error(errorMsg);
          }
        }}
        class="px-4 py-2 bg-white border border-red-500/20 hover:bg-red-50 transition-colors text-red-400"
      >
        {t('common.delete')}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error && !lookbook}
    <div class="bg-red-500/10 border border-red-500/20 p-4">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if lookbook}
    {#if error}
      <div class="bg-red-500/10 border border-red-500/20 p-4 mb-6">
        <p class="text-red-400">{error}</p>
      </div>
    {/if}

    <!-- Lookbook Info -->
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('lookbook.lookbookInformation')}</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="lookbookTitle" class="block text-sm font-medium mb-2"
              >{t('lookbook.title')} *</label
            >
            <input
              id="lookbookTitle"
              type="text"
              bind:value={formData.title}
              on:input={generateSlug}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('lookbook.lookbookTitle')}
            />
          </div>
          <div>
            <label for="lookbookSlug" class="block text-sm font-medium mb-2"
              >{t('common.slug')}</label
            >
            <input
              id="lookbookSlug"
              type="text"
              bind:value={formData.slug}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>

        <div>
          <label for="lookbookDescription" class="block text-sm font-medium mb-2"
            >{t('common.description')}</label
          >
          <textarea
            id="lookbookDescription"
            bind:value={formData.description}
            rows="3"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="lookbookSeason" class="block text-sm font-medium mb-2"
              >{t('lookbook.season')}</label
            >
            <LookbookSeasonSelect id="lookbookSeason" bind:value={formData.season} />
          </div>
          <div>
            <label for="lookbookYear" class="block text-sm font-medium mb-2"
              >{t('lookbook.year')}</label
            >
            <input
              id="lookbookYear"
              type="number"
              bind:value={formData.year}
              min="2000"
              max="2100"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" bind:checked={formData.isActive} id="isActive" class="" />
          <label for="isActive" class="text-sm font-medium">
            {t('common.active')}
          </label>
        </div>

        <div class="flex gap-4 pt-4">
          <button
            on:click={saveLookbook}
            disabled={saving}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('common.saveChanges')}
          </button>
          <button
            on:click={() => goto('/admin/lookbook')}
            class="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>

    <!-- Images Management -->
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">{t('lookbook.images')}</h3>

      <SortableMediaList
        items={images}
        onReorder={handleImagesReorder}
        onDelete={(id) => deleteImage(id)}
        getAlt={(item) => item.alt || t('lookbook.lookbookImage')}
        isVideo={isVideoUrl}
      />
      <!-- File Upload Section -->
      <div class="mb-6">
        <h4 class="text-lg font-medium mb-4">{t('lookbook.uploadFiles')}</h4>

        <!-- Drag & Drop Zone -->
        <div
          class="relative border-2 border-dashed p-8 text-center transition-all {isDragging
            ? 'border-accent bg-accent/5'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}"
          on:dragover={handleDragOver}
          on:dragleave={handleDragLeave}
          on:drop={handleDrop}
          role="button"
          tabindex="0"
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFileDialog();
            }
          }}
        >
          <input
            bind:this={fileInputRef}
            id="fileInput"
            type="file"
            multiple
            accept="image/*,video/*"
            on:change={handleFileSelect}
            class="hidden"
          />

          <div class="flex flex-col items-center justify-center">
            <svg
              class="w-12 h-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p class="text-lg font-medium text-gray-700 mb-2">
              {t('lookbook.dragFilesHere')}
              <button
                type="button"
                on:click={openFileDialog}
                class="text-accent hover:text-accent-muted underline font-semibold ml-1"
              >
                {t('lookbook.selectFiles')}
              </button>
            </p>
            <p class="text-sm text-gray-500">
              {t('lookbook.supportsImagesVideos')}
            </p>
            <p class="text-xs text-gray-400 mt-1">
              {t('lookbook.maxFileSize')}
            </p>
          </div>
        </div>

        <!-- Selected Files Preview -->
        {#if selectedFiles.length > 0}
          <div class="mt-4 p-4 bg-white border border-gray-200">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-semibold text-gray-700">
                {t('lookbook.selectedFiles')}: {selectedFiles.length}
              </p>
              <button
                type="button"
                on:click={() => {
                  selectedFiles = [];
                  if (fileInputRef) fileInputRef.value = '';
                }}
                class="text-xs text-red-500 hover:text-red-700 underline"
              >
                {t('lookbook.clearAll')}
              </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each selectedFiles as file, index}
                <div
                  class="relative group bg-gray-50 p-3 border border-gray-200 hover:border-accent transition-colors"
                >
                  <div class="flex items-start gap-3">
                    {#if file.type.startsWith('image/')}
                      <div class="flex-shrink-0 w-16 h-16 bg-gray-200 overflow-hidden">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          class="w-full h-full object-cover"
                        />
                      </div>
                    {:else if file.type.startsWith('video/')}
                      <div
                        class="flex-shrink-0 w-16 h-16 bg-gray-200 flex items-center justify-center"
                      >
                        <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
                          />
                        </svg>
                      </div>
                    {/if}
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-medium text-gray-900 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p class="text-xs text-gray-500 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      on:click={() => removeSelectedFile(index)}
                      class="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                      title={t('common.remove')}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Upload Button -->
        <div class="mt-4 flex items-center gap-3">
          <button
            on:click={uploadFiles}
            disabled={selectedFiles.length === 0 || uploading}
            class="flex items-center gap-2 px-6 py-3 bg-accent text-dark hover:bg-accent-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md disabled:shadow-none"
          >
            {#if uploading}
              <svg
                class="animate-spin h-5 w-5"
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
              <span>{t('lookbook.uploading')}</span>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span
                >{t('lookbook.upload')}
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} ${t('lookbook.files')}`
                  : t('lookbook.files')}</span
              >
            {/if}
          </button>
          {#if selectedFiles.length > 0}
            <span class="text-sm text-gray-500">
              {t('lookbook.total')}: {(
                selectedFiles.reduce((sum, f) => sum + f.size, 0) /
                1024 /
                1024
              ).toFixed(2)} MB
            </span>
          {/if}
        </div>
      </div>

      <!-- URL Upload Section -->
      <div class="mb-4">
        <label for="imageUrls" class="block text-sm font-medium mb-2"
          >{t('lookbook.addImagesVideosByUrl')}</label
        >
        <textarea
          id="imageUrls"
          rows="6"
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          placeholder={t('lookbook.urlPlaceholder')}
        ></textarea>
        <p class="text-xs text-accent-muted mt-1 mb-2">
          {t('lookbook.urlHint')}
        </p>
        <button
          on:click={addImagesFromUrls}
          class="mt-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
        >
          {t('lookbook.addFromUrls')}
        </button>
      </div>
    </div>

    <!-- Page Design Settings -->
    <div class="bg-dark-light p-6">
      <h3 class="text-xl font-medium mb-4">{t('lookbook.pageDesignSettings')}</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="lookbookPageTitleSize" class="block text-sm font-medium mb-2"
              >{t('lookbook.titleSize')}</label
            >
            <select
              id="lookbookPageTitleSize"
              bind:value={pageSettings.titleSize}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="text-3xl">{t('lookbook.small')} (text-3xl)</option>
              <option value="text-4xl">{t('lookbook.medium')} (text-4xl)</option>
              <option value="text-5xl">{t('lookbook.large')} (text-5xl)</option>
              <option value="text-6xl">{t('lookbook.extraLarge')} (text-6xl)</option>
            </select>
          </div>
          <div>
            <label for="lookbookPageTitleColorText" class="block text-sm font-medium mb-2"
              >{t('lookbook.titleColor')}</label
            >
            <div class="flex gap-2">
              <input
                aria-label={t('lookbook.titleColor')}
                type="color"
                bind:value={pageSettings.titleColor}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="lookbookPageTitleColorText"
                type="text"
                bind:value={pageSettings.titleColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="lookbookPageBackgroundColorText" class="block text-sm font-medium mb-2"
              >{t('lookbook.backgroundColor')}</label
            >
            <div class="flex gap-2">
              <input
                aria-label={t('lookbook.backgroundColor')}
                type="color"
                bind:value={pageSettings.backgroundColor}
                class="w-16 h-10 border border-gray-300 cursor-pointer"
              />
              <input
                id="lookbookPageBackgroundColorText"
                type="text"
                bind:value={pageSettings.backgroundColor}
                class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div>
            <label for="lookbookPagePaddingTop" class="block text-sm font-medium mb-2"
              >{t('lookbook.paddingTop')}</label
            >
            <select
              id="lookbookPagePaddingTop"
              bind:value={pageSettings.paddingTop}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value="py-8">{t('lookbook.small')} (py-8)</option>
              <option value="py-12">{t('lookbook.medium')} (py-12)</option>
              <option value="py-20">{t('lookbook.large')} (py-20)</option>
            </select>
          </div>
        </div>

        <!-- Collage Settings -->
        <div class="pt-4 border-t border-accent/20">
          <h4 class="text-lg font-medium mb-4">{t('lookbook.collageSettings')}</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label for="lookbookPageGridColumns" class="block text-sm font-medium mb-2"
                >{t('lookbook.gridColumns')}</label
              >
              <select
                id="lookbookPageGridColumns"
                bind:value={pageSettings.gridColumns}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="grid-cols-1">1 {t('lookbook.column')}</option>
                <option value="grid-cols-1 md:grid-cols-2">2 {t('lookbook.columns')} (md+)</option>
                <option value="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  >3 {t('lookbook.columns')} (lg+)</option
                >
                <option value="grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                  >4 {t('lookbook.columns')} (lg+)</option
                >
                <option value="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  >4 {t('lookbook.columns')} {t('lookbook.dense')}</option
                >
              </select>
            </div>
            <div>
              <label for="lookbookPageGap" class="block text-sm font-medium mb-2"
                >{t('lookbook.gap')}</label
              >
              <select
                id="lookbookPageGap"
                bind:value={pageSettings.gap}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="gap-2">{t('lookbook.small')} (gap-2)</option>
                <option value="gap-4">{t('lookbook.medium')} (gap-4)</option>
                <option value="gap-6">{t('lookbook.large')} (gap-6)</option>
                <option value="gap-8">{t('lookbook.extraLarge')} (gap-8)</option>
              </select>
            </div>
            <div>
              <label for="lookbookPageAspectRatio" class="block text-sm font-medium mb-2"
                >{t('lookbook.imageAspectRatio')}</label
              >
              <select
                id="lookbookPageAspectRatio"
                bind:value={pageSettings.imageAspectRatio}
                class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              >
                <option value="aspect-auto">{t('lookbook.auto')} ({t('lookbook.natural')})</option>
                <option value="aspect-square">1:1 ({t('lookbook.square')})</option>
                <option value="aspect-[9/16]">9:16 ({t('lookbook.portrait')})</option>
                <option value="aspect-[4/5]">4:5 ({t('lookbook.portrait')})</option>
                <option value="aspect-[3/4]">3:4</option>
                <option value="aspect-[16/9]">16:9 ({t('lookbook.landscape')})</option>
              </select>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              bind:checked={pageSettings.masonryLayout}
              id="masonryLayout"
              class=""
            />
            <label for="masonryLayout" class="text-sm font-medium">
              {t('lookbook.masonryLayout')}
            </label>
          </div>
        </div>

        <div class="flex gap-4 pt-4">
          <button
            on:click={savePageSettings}
            class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
          >
            {t('lookbook.savePageSettings')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showTranslations && lookbook}
    <div class="bg-dark-light p-6 mb-6 mt-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-medium">{t('homepage.translations')} - {lookbook.title}</h3>
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
            <label for="translationLookbookTitle" class="block text-sm font-medium mb-2"
              >{t('lookbook.title')}</label
            >
            <input
              id="translationLookbookTitle"
              type="text"
              bind:value={translationFormData.title}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={lookbook.title || ''}
            />
          </div>
          <div>
            <label for="translationLookbookDescription" class="block text-sm font-medium mb-2"
              >{t('common.description')}</label
            >
            <textarea
              id="translationLookbookDescription"
              bind:value={translationFormData.description}
              rows="4"
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={lookbook.description || ''}
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
                on:click={() => {
                  editingTranslation = null;
                  selectedLanguageForTranslation = '';
                  translationFormData = {
                    title: '',
                    description: '',
                  };
                }}
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
                  {#if translation.title}
                    <p class="text-sm text-accent-muted">
                      {t('lookbook.title')}: {translation.title}
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
