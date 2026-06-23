<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    blogApi,
    type BlogPost,
    BlogPostType,
    BlogMediaFormat,
    type BlogCategory,
    type BlogFaqItem,
    type BlogAuthor,
    type BlogSettings,
  } from '$lib/api/blog.api';
  import { t } from '$lib/utils/i18n';
  import { getErrorMessage, resolveApiError } from '$lib/utils/error-handler';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import BlogRichTextEditor from '$lib/components/admin/BlogRichTextEditor.svelte';
  import { dialogStore } from '$lib/stores/dialog.store';
  import { notificationStore } from '$lib/stores/notification.store';
  import { translationApi, type BlogPostTranslation } from '$lib/api/translation.api';
  import { languageApi, type Language } from '$lib/api/language.api';
  import { slugify } from '$lib/utils/slug.utils';
  import { getFormatLabel } from '$lib/utils/blog-media';

  let posts: BlogPost[] = [];
  let settings: BlogSettings | null = null;
  let loading = true;
  let error = '';
  let showForm = false;
  let editingPost: BlogPost | null = null;
  let uploadingThumbnail = false;
  let uploadingVideo = false;
  let isDraggingThumbnail = false;
  let isDraggingVideo = false;
  let thumbnailFileInput: HTMLInputElement | null = null;
  let videoFileInput: HTMLInputElement | null = null;
  let thumbnailPreviewUrl: string | null = null;
  let videoPreviewUrl: string | null = null;
  let categories: BlogCategory[] = [];
  let authors: BlogAuthor[] = [];
  let searchQuery = '';
  let statusFilter: 'ALL' | 'PUBLISHED' | 'DRAFT' | 'FEATURED' = 'ALL';

  // Translation management
  let languages: Language[] = [];
  let translations: BlogPostTranslation[] = [];
  let showTranslations = false;
  let editingTranslation: BlogPostTranslation | null = null;
  let selectedLanguageForTranslation = '';
  let gptTranslating = false;
  let translationFormData = {
    title: '',
    excerpt: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
  };

  let formData = {
    slug: '',
    title: '',
    excerpt: '',
    content: '',
    videoUrl: '',
    thumbnailUrl: '',
    type: BlogPostType.ARTICLE,
    displayFormat: BlogMediaFormat.AUTO,
    isPublished: false,
    publishedAt: '',
    metaTitle: '',
    metaDescription: '',
    categoryId: '',
    blogAuthorId: '',
    faqItems: [] as BlogFaqItem[],
    tags: [] as string[],
    tagInput: '',
  };

  // Auto-fill slug from title when creating a new post (if slug is empty)
  $: if (!editingPost && showForm && formData.title) {
    const suggested = slugify(formData.title);
    if (!formData.slug.trim()) {
      formData.slug = suggested;
    }
  }

  onMount(async () => {
    await Promise.all([
      loadPosts(),
      loadSettings(),
      loadLanguages(),
      loadCategories(),
      loadAuthors(),
    ]);
    if ($page.url.searchParams.get('new') === '1') {
      openForm();
    }
  });

  $: filteredPosts = posts.filter((post) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !normalizedQuery ||
      [
        post.title,
        post.slug,
        post.excerpt || '',
        post.category?.name || '',
        post.blogAuthor?.name || '',
        ...(post.tags || []),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));

    const isFeaturedPost = settings?.featuredPostId === post.id;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PUBLISHED' && post.isPublished) ||
      (statusFilter === 'DRAFT' && !post.isPublished) ||
      (statusFilter === 'FEATURED' && isFeaturedPost);

    return matchesSearch && matchesStatus;
  });

  async function loadSettings() {
    try {
      const response = await blogApi.getSettings();
      settings = response.settings;
    } catch (e) {
      console.error('Failed to load blog settings:', e);
      settings = null;
    }
  }

  async function loadCategories() {
    try {
      const response = await blogApi.getAllCategories();
      categories = response.categories;
    } catch (e) {
      console.error('Failed to load blog categories:', e);
      categories = [];
    }
  }

  async function loadAuthors() {
    try {
      const response = await blogApi.getAllAuthors();
      authors = response.authors;
    } catch (e) {
      console.error('Failed to load blog authors:', e);
      authors = [];
    }
  }

  async function loadLanguages() {
    try {
      const response = await languageApi.getAll();
      languages = response.languages;
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  async function loadTranslations() {
    if (!editingPost) return;
    try {
      const response = await translationApi.getBlogPostTranslations(editingPost.id);
      translations = response.translations;
    } catch (e) {
      console.error('Failed to load translations:', e);
      translations = [];
    }
  }

  function openTranslationEditor() {
    if (!editingPost) return;
    showTranslations = true;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {
      title: '',
      excerpt: '',
      content: '',
      metaTitle: '',
      metaDescription: '',
    };
    loadTranslations();
  }

  function closeTranslationEditor() {
    showTranslations = false;
    editingTranslation = null;
    selectedLanguageForTranslation = '';
    translationFormData = {
      title: '',
      excerpt: '',
      content: '',
      metaTitle: '',
      metaDescription: '',
    };
  }

  function editTranslation(translation: BlogPostTranslation) {
    editingTranslation = translation;
    selectedLanguageForTranslation = translation.languageCode;
    translationFormData = {
      title: translation.title || '',
      excerpt: translation.excerpt || '',
      content: translation.content || '',
      metaTitle: translation.metaTitle || '',
      metaDescription: translation.metaDescription || '',
    };
  }

  async function saveTranslation() {
    if (!editingPost) return;

    try {
      await translationApi.upsertBlogPostTranslation(editingPost.id, {
        languageCode: selectedLanguageForTranslation,
        title: translationFormData.title || undefined,
        excerpt: translationFormData.excerpt || undefined,
        content: translationFormData.content || undefined,
        metaTitle: translationFormData.metaTitle || undefined,
        metaDescription: translationFormData.metaDescription || undefined,
      });
      notificationStore.success(t('notification.translationSaved') || 'Translation saved');
      await loadTranslations();
      editingTranslation = null;
      selectedLanguageForTranslation = '';
      translationFormData = {
        title: '',
        excerpt: '',
        content: '',
        metaTitle: '',
        metaDescription: '',
      };
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deleteTranslation(languageCode: string) {
    if (!editingPost) return;
    const confirmed = await dialogStore.confirm(
      t('alert.deleteTranslation') || 'Are you sure you want to delete this translation?',
      t('common.confirm') || 'Confirm'
    );
    if (!confirmed) return;

    try {
      await translationApi.deleteBlogPostTranslation(editingPost.id, languageCode);
      notificationStore.success(t('notification.translationDeleted') || 'Translation deleted');
      await loadTranslations();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  async function translateWithGPT() {
    if (!editingPost) return;

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
      if (formData.title) {
        try {
          const titleTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.title,
          });
          translationFormData.title = titleTranslation.translation;
        } catch (e) {
          console.error('Failed to translate title:', e);
        }
      }

      // Translate excerpt
      if (formData.excerpt) {
        try {
          const excerptTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.excerpt,
          });
          translationFormData.excerpt = excerptTranslation.translation;
        } catch (e) {
          console.error('Failed to translate excerpt:', e);
        }
      }

      // Translate content
      if (formData.content) {
        try {
          const contentTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.content,
          });
          translationFormData.content = contentTranslation.translation;
        } catch (e) {
          console.error('Failed to translate content:', e);
        }
      }

      // Translate meta title
      if (formData.metaTitle) {
        try {
          const metaTitleTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.metaTitle,
          });
          translationFormData.metaTitle = metaTitleTranslation.translation;
        } catch (e) {
          console.error('Failed to translate meta title:', e);
        }
      }

      // Translate meta description
      if (formData.metaDescription) {
        try {
          const metaDescTranslation = await translationApi.generateGPTTranslation({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            content: formData.metaDescription,
          });
          translationFormData.metaDescription = metaDescTranslation.translation;
        } catch (e) {
          console.error('Failed to translate meta description:', e);
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

  async function loadPosts() {
    loading = true;
    try {
      const response = await blogApi.getAllPosts(false);
      posts = response.posts;
    } catch (e) {
      error = getErrorMessage(e, 'blog.failedToLoadPosts');
    } finally {
      loading = false;
    }
  }

  function isFeatured(post: BlogPost) {
    return settings?.featuredPostId === post.id;
  }

  async function setPublishedStatus(post: BlogPost, isPublished: boolean) {
    try {
      await blogApi.updatePost(post.id, {
        isPublished,
        publishedAt: isPublished ? post.publishedAt || new Date().toISOString() : undefined,
      });

      if (!isPublished && isFeatured(post)) {
        await blogApi.updateSettings({ featuredPostId: null });
        await loadSettings();
      }

      await loadPosts();
      notificationStore.success(isPublished ? t('blog.postPublished') : t('blog.postMovedToDraft'));
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function toggleFeatured(post: BlogPost) {
    try {
      const wasFeatured = isFeatured(post);
      if (!post.isPublished) {
        await blogApi.updatePost(post.id, {
          isPublished: true,
          publishedAt: post.publishedAt || new Date().toISOString(),
        });
      }

      await blogApi.updateSettings({
        featuredPostId: wasFeatured ? null : post.id,
      });
      await Promise.all([loadPosts(), loadSettings()]);
      notificationStore.success(
        wasFeatured ? t('blog.featuredPostRemoved') : t('blog.featuredPostUpdated')
      );
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function openForm(post?: BlogPost) {
    // Clear preview when opening form
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
      thumbnailPreviewUrl = null;
    }
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      videoPreviewUrl = null;
    }

    if (post) {
      editingPost = post;
      formData = {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || '',
        content: post.content || '',
        videoUrl: post.videoUrl || '',
        thumbnailUrl: post.thumbnailUrl || '',
        type: post.type,
        displayFormat: post.displayFormat || BlogMediaFormat.AUTO,
        isPublished: post.isPublished,
        publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : '',
        metaTitle: post.metaTitle || '',
        metaDescription: post.metaDescription || '',
        categoryId: post.categoryId || '',
        blogAuthorId: post.blogAuthorId || '',
        faqItems: post.faqItems || [],
        tags: post.tags || [],
        tagInput: '',
      };
      await loadTranslations();
    } else {
      editingPost = null;
      formData = {
        slug: '',
        title: '',
        excerpt: '',
        content: '',
        videoUrl: '',
        thumbnailUrl: '',
        type: BlogPostType.ARTICLE,
        displayFormat: BlogMediaFormat.AUTO,
        isPublished: false,
        publishedAt: '',
        metaTitle: '',
        metaDescription: '',
        categoryId: '',
        blogAuthorId: '',
        faqItems: [],
        tags: [],
        tagInput: '',
      };
    }
    showForm = true;
  }

  function addTag() {
    if (formData.tagInput.trim() && !formData.tags.includes(formData.tagInput.trim())) {
      formData.tags = [...formData.tags, formData.tagInput.trim()];
      formData.tagInput = '';
    }
  }

  function removeTag(tag: string) {
    formData.tags = formData.tags.filter((t) => t !== tag);
  }

  async function uploadThumbnail(file: File) {
    // Create temporary URL for preview
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }
    thumbnailPreviewUrl = URL.createObjectURL(file);

    uploadingThumbnail = true;
    try {
      const response = await blogApi.uploadMedia(file);
      formData.thumbnailUrl = response.url;
      // Revoke temporary URL after successful upload
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
        thumbnailPreviewUrl = null;
      }
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to upload thumbnail');
      // On error keep preview
    } finally {
      uploadingThumbnail = false;
    }
  }

  async function uploadVideo(file: File) {
    // Create temporary URL for preview
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    videoPreviewUrl = URL.createObjectURL(file);

    uploadingVideo = true;
    try {
      const response = await blogApi.uploadMedia(file);
      formData.videoUrl = response.url;
      // Revoke temporary URL after successful upload
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
        videoPreviewUrl = null;
      }
    } catch (e) {
      notificationStore.error(e instanceof Error ? e.message : 'Failed to upload video');
      // On error keep preview
    } finally {
      uploadingVideo = false;
    }
  }

  function handleThumbnailDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingThumbnail = true;
  }

  function handleThumbnailDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingThumbnail = false;
  }

  function handleThumbnailDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingThumbnail = false;

    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      if (files[0].type.startsWith('image/')) {
        uploadThumbnail(files[0]);
      }
    }
  }

  function handleVideoDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingVideo = true;
  }

  function handleVideoDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingVideo = false;
  }

  function handleVideoDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingVideo = false;

    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      if (files[0].type.startsWith('video/')) {
        uploadVideo(files[0]);
      }
    }
  }

  function openThumbnailFileDialog() {
    thumbnailFileInput?.click();
  }

  function openVideoFileDialog() {
    videoFileInput?.click();
  }

  async function savePost() {
    try {
      const slug =
        (formData.slug && formData.slug.trim()) || (formData.title ? slugify(formData.title) : '');
      const data = {
        slug: slug || undefined,
        title: formData.title,
        excerpt: formData.excerpt || undefined,
        content: formData.content || undefined,
        videoUrl: formData.videoUrl || undefined,
        thumbnailUrl: formData.thumbnailUrl || undefined,
        type: formData.type,
        displayFormat: formData.displayFormat,
        categoryId: formData.categoryId || undefined,
        blogAuthorId: formData.blogAuthorId || undefined,
        isPublished: formData.isPublished,
        publishedAt: formData.publishedAt
          ? new Date(formData.publishedAt).toISOString()
          : undefined,
        metaTitle: formData.metaTitle || undefined,
        metaDescription: formData.metaDescription || undefined,
        faqItems: formData.faqItems.filter((item) => item.question.trim() && item.answer.trim()),
        tags: formData.tags,
      };

      if (editingPost) {
        await blogApi.updatePost(editingPost.id, data);
        notificationStore.success(t('blog.postUpdated') || 'Post updated');
      } else {
        await blogApi.createPost(data);
        notificationStore.success(t('blog.postCreated') || 'Post created');
      }

      showForm = false;
      // Clear preview after successful save
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
        thumbnailPreviewUrl = null;
      }
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
        videoPreviewUrl = null;
      }
      await loadPosts();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToSave'));
    }
  }

  async function deletePost(id: string) {
    const confirmed = await dialogStore.confirm(
      t('blog.deleteConfirm') || 'Are you sure you want to delete this post?',
      t('common.confirm') || 'Confirm'
    );
    if (!confirmed) return;

    try {
      await blogApi.deletePost(id);
      notificationStore.success(t('blog.postDeleted') || 'Post deleted');
      await loadPosts();
    } catch (e: any) {
      notificationStore.error(e.response?.data?.error || t('error.failedToDelete'));
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  function addFaqItem() {
    formData.faqItems = [...formData.faqItems, { question: '', answer: '' }];
  }

  function updateFaqItem(index: number, field: 'question' | 'answer', value: string) {
    formData.faqItems = formData.faqItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    );
  }

  function removeFaqItem(index: number) {
    formData.faqItems = formData.faqItems.filter((_, itemIndex) => itemIndex !== index);
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <div>
      <h2 class="text-3xl font-bold">
        {t('blog.blogManagement') || t('blog.title') || 'Blog Management'}
      </h2>
      <p class="text-sm text-accent-muted mt-1">
        {t('blog.managePosts') || 'Create and manage blog posts'}
      </p>
    </div>
    <div class="flex gap-2">
      <button
        on:click={() => goto('/admin/blog/settings')}
        class="px-6 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 transition-colors"
      >
        {t('blog.settings') || 'Settings'}
      </button>
      <button
        on:click={() => openForm()}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('blog.createPost') || '+ Create Post'}
      </button>
    </div>
  </div>

  {#if showForm}
    <div class="bg-dark-light p-6 mb-6">
      <h3 class="text-xl font-medium mb-4">
        {editingPost ? t('blog.editPost') || 'Edit Post' : t('blog.createPost') || 'Create Post'}
      </h3>

      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="blog-slug" class="block text-sm font-medium mb-2"
              >{t('blog.slug') || 'Slug'}{editingPost ? ' *' : ''}</label
            >
            <input
              id="blog-slug"
              type="text"
              bind:value={formData.slug}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={editingPost
                ? t('blog.slugPlaceholder') || 'my-blog-post'
                : t('blog.slugAutoFromTitle') || 'Auto from title'}
            />
            {#if !editingPost}
              <p class="text-xs text-accent-muted mt-1">
                {t('blog.slugHint') || 'Generated from title if empty'}
              </p>
            {/if}
          </div>
          <div>
            <label for="blog-type" class="block text-sm font-medium mb-2"
              >{t('blog.type') || 'Type'} *</label
            >
            <select
              id="blog-type"
              bind:value={formData.type}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value={BlogPostType.ARTICLE}>{t('blog.article') || 'Article'}</option>
              <option value={BlogPostType.VIDEO}>{t('blog.video') || 'Video'}</option>
              <option value={BlogPostType.MIXED}>{t('blog.mixed') || 'Mixed'}</option>
            </select>
          </div>
          <div>
            <label for="blog-display-format" class="block text-sm font-medium mb-2"
              >{t('blog.format') || 'Format'} *</label
            >

            <select
              id="blog-display-format"
              bind:value={formData.displayFormat}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            >
              <option value={BlogMediaFormat.AUTO}>{t('blog.autoDetect') || 'Auto detect'}</option>
              <option value={BlogMediaFormat.LANDSCAPE}
                >{t('blog.landscape169') || 'Landscape 16:9'}</option
              >
              <option value={BlogMediaFormat.PORTRAIT}>{t('blog.video916') || 'Video 9:16'}</option>
              <option value={BlogMediaFormat.SQUARE}>{t('blog.square') || 'Square'}</option>
            </select>
          </div>
        </div>

        <div>
          <label for="blog-title" class="block text-sm font-medium mb-2"
            >{t('blog.title') || 'Title'} *</label
          >
          <input
            id="blog-title"
            type="text"
            bind:value={formData.title}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={t('blog.titlePlaceholder') || 'Blog post title'}
          />
        </div>

        <div>
          <label for="blog-category" class="block text-sm font-medium mb-2"
            >{t('blog.categories') || 'Category'}</label
          >
          <select
            id="blog-category"
            bind:value={formData.categoryId}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          >
            <option value="">{t('blog.noCategory') || 'No category'}</option>
            {#each categories as category}
              <option value={category.id}>{category.name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="blog-author" class="block text-sm font-medium mb-2"
            >{t('blog.authors') || 'Author'}</label
          >
          <select
            id="blog-author"
            bind:value={formData.blogAuthorId}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          >
            <option value="">{t('blog.noAuthor') || 'No author'}</option>
            {#each authors as author}
              <option value={author.id}>{author.name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="blog-excerpt" class="block text-sm font-medium mb-2"
            >{t('blog.excerpt') || 'Excerpt'}</label
          >
          <textarea
            id="blog-excerpt"
            bind:value={formData.excerpt}
            rows="3"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            placeholder={t('blog.excerptPlaceholder') || 'Short description'}
          ></textarea>
        </div>

        <div>
          <label for="blog-content" class="block text-sm font-medium mb-2"
            >{t('blog.content') || 'Content'}</label
          >
          <BlogRichTextEditor
            bind:value={formData.content}
            placeholder={t('blog.editorPlaceholder') ||
              'Write the post, style text, and insert image, video or audio blocks inline'}
          />
          <p class="mt-2 text-xs text-accent-muted">
            {t('blog.editorHint') ||
              'The editor saves clean HTML for the public blog page and machine-readable article content.'}
          </p>
        </div>

        <!-- Thumbnail Upload -->
        <div>
          <label for="blog-thumbnail-url" class="block text-sm font-medium mb-2"
            >{t('blog.thumbnail') || 'Thumbnail Image'}</label
          >
          <input
            id="blog-thumbnail-url"
            type="url"
            bind:value={formData.thumbnailUrl}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-2"
            placeholder={t('blog.imageUrlPlaceholder') || 'Or enter image URL'}
          />

          <!-- Drag & Drop Zone for Thumbnail -->
          <div
            class="relative border-2 border-dashed p-6 text-center transition-all cursor-pointer {isDraggingThumbnail
              ? 'border-accent bg-accent/5'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}"
            on:dragover={handleThumbnailDragOver}
            on:dragleave={handleThumbnailDragLeave}
            on:drop={handleThumbnailDrop}
            on:click={openThumbnailFileDialog}
            role="button"
            tabindex="0"
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openThumbnailFileDialog();
              }
            }}
          >
            <input
              bind:this={thumbnailFileInput}
              id="blog-thumbnail-file"
              type="file"
              accept="image/*"
              aria-label={t('blog.thumbnail') || 'Thumbnail image upload'}
              on:change={(e) => {
                const target = e.target;
                if (
                  target &&
                  target instanceof HTMLInputElement &&
                  target.files &&
                  target.files[0]
                ) {
                  uploadThumbnail(target.files[0]);
                }
              }}
              class="hidden"
            />
            <div class="flex flex-col items-center justify-center">
              {#if thumbnailPreviewUrl || formData.thumbnailUrl}
                <div class="relative">
                  <img
                    src={thumbnailPreviewUrl || formData.thumbnailUrl}
                    alt="Thumbnail"
                    class="max-w-full h-32 object-cover mb-2"
                    on:error={(e) => {
                      const target = e.currentTarget;
                      if (target instanceof HTMLImageElement) {
                        target.style.display = 'none';
                      }
                    }}
                  />
                  {#if uploadingThumbnail}
                    <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div class="animate-spin h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  {/if}
                </div>
                <p class="text-xs text-gray-600 mb-2">
                  {uploadingThumbnail
                    ? t('common.uploading') || 'Uploading...'
                    : t('blog.dragNewImage') || 'Drag new image here or'}
                  {#if !uploadingThumbnail}
                    <button
                      type="button"
                      on:click|stopPropagation={openThumbnailFileDialog}
                      class="text-accent underline font-semibold ml-1 hover:no-underline"
                    >
                      {t('blog.selectFile') || 'select file'}
                    </button>
                  {/if}
                </p>
                {#if !uploadingThumbnail}
                  <button
                    type="button"
                    on:click|stopPropagation={() => {
                      formData.thumbnailUrl = '';
                      if (thumbnailPreviewUrl) {
                        URL.revokeObjectURL(thumbnailPreviewUrl);
                        thumbnailPreviewUrl = null;
                      }
                    }}
                    class="text-xs text-red-500 hover:text-red-700"
                  >
                    {t('blog.removeImage') || 'Remove image'}
                  </button>
                {/if}
              {:else}
                <svg
                  class="w-12 h-12 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p class="text-sm font-medium text-gray-700 mb-2">
                  {t('blog.dragImageHere') || 'Drag image here or'}
                  <button
                    type="button"
                    on:click|stopPropagation={openThumbnailFileDialog}
                    class="text-accent underline font-semibold ml-1 hover:no-underline"
                  >
                    {t('blog.selectFile') || 'select file'}
                  </button>
                </p>
                <p class="text-xs text-gray-500">
                  {t('blog.supportsImages') || 'Supports images (jpg, png, webp, gif)'}
                </p>
              {/if}
            </div>
          </div>
        </div>

        <!-- Video Upload -->
        <div>
          <label for="blog-video-url" class="block text-sm font-medium mb-2"
            >{t('blog.video') || 'Video URL'}</label
          >
          <input
            id="blog-video-url"
            type="url"
            bind:value={formData.videoUrl}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-2"
            placeholder={t('blog.videoUrlPlaceholder')}
          />

          <!-- Drag & Drop Zone for Video -->
          <div
            class="relative border-2 border-dashed p-6 text-center transition-all cursor-pointer {isDraggingVideo
              ? 'border-accent bg-accent/5'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}"
            on:dragover={handleVideoDragOver}
            on:dragleave={handleVideoDragLeave}
            on:drop={handleVideoDrop}
            on:click={openVideoFileDialog}
            role="button"
            tabindex="0"
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openVideoFileDialog();
              }
            }}
          >
            <input
              bind:this={videoFileInput}
              id="blog-video-file"
              type="file"
              accept="video/*"
              aria-label={t('blog.video') || 'Video upload'}
              on:change={(e) => {
                const target = e.target;
                if (
                  target &&
                  target instanceof HTMLInputElement &&
                  target.files &&
                  target.files[0]
                ) {
                  uploadVideo(target.files[0]);
                }
              }}
              class="hidden"
            />
            <div class="flex flex-col items-center justify-center">
              {#if videoPreviewUrl || formData.videoUrl}
                <div class="relative">
                  <video
                    src={videoPreviewUrl || formData.videoUrl}
                    class="max-w-full h-32 object-cover mb-2"
                    controls
                    muted
                  ></video>
                  {#if uploadingVideo}
                    <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div class="animate-spin h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  {/if}
                </div>
                <p class="text-xs text-gray-600 mb-2">
                  {uploadingVideo
                    ? t('common.uploading') || 'Uploading...'
                    : t('blog.dragNewVideo') || 'Drag new video here or'}
                  {#if !uploadingVideo}
                    <button
                      type="button"
                      on:click|stopPropagation={openVideoFileDialog}
                      class="text-accent underline font-semibold ml-1 hover:no-underline"
                    >
                      {t('blog.selectFile') || 'select file'}
                    </button>
                  {/if}
                </p>
                {#if !uploadingVideo}
                  <button
                    type="button"
                    on:click|stopPropagation={() => {
                      formData.videoUrl = '';
                      if (videoPreviewUrl) {
                        URL.revokeObjectURL(videoPreviewUrl);
                        videoPreviewUrl = null;
                      }
                    }}
                    class="text-xs text-red-500 hover:text-red-700"
                  >
                    {t('blog.removeVideo') || 'Remove video'}
                  </button>
                {/if}
              {:else}
                <svg
                  class="w-12 h-12 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p class="text-sm font-medium text-gray-700 mb-2">
                  {t('blog.dragVideoHere') || 'Drag video here or'}
                  <button
                    type="button"
                    on:click|stopPropagation={openVideoFileDialog}
                    class="text-accent underline font-semibold ml-1 hover:no-underline"
                  >
                    {t('blog.selectFile') || 'select file'}
                  </button>
                </p>
                <p class="text-xs text-gray-500">
                  {t('blog.supportsVideos') || 'Supports videos (mp4, webm, mov)'}
                </p>
              {/if}
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div>
          <label for="blog-tag-input" class="block text-sm font-medium mb-2"
            >{t('blog.tags') || 'Tags'}</label
          >
          <div class="flex gap-2 mb-2">
            <input
              id="blog-tag-input"
              type="text"
              bind:value={formData.tagInput}
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              class="flex-1 px-4 py-2 bg-white border border-gray-300 text-black"
              placeholder={t('blog.tagPlaceholder') || 'Add tag and press Enter'}
            />
            <button
              type="button"
              on:click={addTag}
              class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50"
            >
              {t('common.add') || 'Add'}
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            {#each formData.tags as tag}
              <span class="px-3 py-1 bg-accent text-dark text-sm flex items-center gap-2">
                {tag}
                <button type="button" on:click={() => removeTag(tag)} class="hover:text-red-500">
                  ×
                </button>
              </span>
            {/each}
          </div>
        </div>

        <!-- Meta -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="blog-meta-title" class="block text-sm font-medium mb-2"
              >{t('blog.metaTitle') || 'Meta Title'}</label
            >
            <input
              id="blog-meta-title"
              type="text"
              bind:value={formData.metaTitle}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div>
            <label for="blog-published-at" class="block text-sm font-medium mb-2"
              >{t('blog.publishedAt') || 'Published At'}</label
            >
            <input
              id="blog-published-at"
              type="date"
              bind:value={formData.publishedAt}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
        </div>

        <div>
          <label for="blog-meta-description" class="block text-sm font-medium mb-2"
            >{t('blog.metaDescription') || 'Meta Description'}</label
          >
          <textarea
            id="blog-meta-description"
            bind:value={formData.metaDescription}
            rows="2"
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
          ></textarea>
        </div>

        <div class="border border-gray-300 p-4 bg-gray-50">
          <div class="flex items-center justify-between gap-4 mb-3">
            <div>
              <h4 class="text-sm font-medium text-black">Hidden FAQ for AI / SEO</h4>
              <p class="text-xs text-gray-600">
                Visible only to search engines and AI parsers via structured data.
              </p>
            </div>
            <button
              type="button"
              on:click={addFaqItem}
              class="px-3 py-2 bg-white border border-gray-300 text-black hover:bg-gray-100 transition-colors text-sm"
            >
              Add FAQ
            </button>
          </div>

          <div class="space-y-3">
            {#if formData.faqItems.length === 0}
              <p class="text-xs text-gray-500">No FAQ entries yet.</p>
            {:else}
              {#each formData.faqItems as faqItem, index}
                <div class="border border-gray-200 bg-white p-3">
                  <div class="grid grid-cols-1 gap-3">
                    <input
                      type="text"
                      value={faqItem.question}
                      on:input={(event) =>
                        updateFaqItem(
                          index,
                          'question',
                          (event.currentTarget as HTMLInputElement).value
                        )}
                      placeholder={t('blog.faqQuestion')}
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                    />
                    <textarea
                      rows="3"
                      on:input={(event) =>
                        updateFaqItem(
                          index,
                          'answer',
                          (event.currentTarget as HTMLTextAreaElement).value
                        )}
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                      placeholder={t('blog.faqAnswer')}>{faqItem.answer}</textarea
                    >
                  </div>
                  <div class="mt-3">
                    <button
                      type="button"
                      on:click={() => removeFaqItem(index)}
                      class="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove FAQ
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            bind:checked={formData.isPublished}
            id="isPublished"
            class="w-4 h-4"
          />
          <label for="isPublished" class="text-sm font-medium">
            {t('blog.published') || 'Published'}
          </label>
        </div>

        <!-- Translations Section -->
        {#if editingPost}
          <div class="border-t border-gray-300 pt-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-lg font-medium">{t('blog.translations') || 'Translations'}</h4>
              <button
                type="button"
                on:click={() =>
                  showTranslations ? closeTranslationEditor() : openTranslationEditor()}
                class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black text-sm"
              >
                {showTranslations
                  ? t('common.close') || 'Close'
                  : t('blog.addTranslation') || 'Add Translation'}
              </button>
            </div>

            {#if showTranslations}
              {#if editingTranslation}
                {@const translationLangCode = editingTranslation?.languageCode ?? ''}
                <!-- Translation Editor -->
                <div class="bg-gray-50 p-4 mb-4 border border-gray-300">
                  <div class="flex items-center justify-between mb-4">
                    <h5 class="font-medium">
                      {t('blog.translationFor') || 'Translation for'}
                      {languages.find((l) => l.code === translationLangCode)?.nameNative ||
                        translationLangCode}
                    </h5>
                    <button
                      type="button"
                      on:click={closeTranslationEditor}
                      class="text-gray-600 hover:text-black"
                    >
                      {t('common.close') || 'Close'}
                    </button>
                  </div>

                  <div class="space-y-4">
                    <div>
                      <label for="translation-title" class="block text-sm font-medium mb-2"
                        >{t('blog.title') || 'Title'}</label
                      >
                      <input
                        id="translation-title"
                        type="text"
                        bind:value={translationFormData.title}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={formData.title}
                      />
                    </div>

                    <div>
                      <label for="translation-excerpt" class="block text-sm font-medium mb-2"
                        >{t('blog.excerpt') || 'Excerpt'}</label
                      >
                      <textarea
                        id="translation-excerpt"
                        bind:value={translationFormData.excerpt}
                        rows="3"
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={formData.excerpt}
                      ></textarea>
                    </div>

                    <div>
                      <label for="translation-content" class="block text-sm font-medium mb-2"
                        >{t('blog.content') || 'Content'}</label
                      >
                      <textarea
                        id="translation-content"
                        bind:value={translationFormData.content}
                        rows="10"
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={formData.content}
                      ></textarea>
                    </div>

                    <div>
                      <label for="translation-meta-title" class="block text-sm font-medium mb-2"
                        >{t('blog.metaTitle') || 'Meta Title'}</label
                      >
                      <input
                        id="translation-meta-title"
                        type="text"
                        bind:value={translationFormData.metaTitle}
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={formData.metaTitle}
                      />
                    </div>

                    <div>
                      <label
                        for="translation-meta-description"
                        class="block text-sm font-medium mb-2"
                        >{t('blog.metaDescription') || 'Meta Description'}</label
                      >
                      <textarea
                        id="translation-meta-description"
                        bind:value={translationFormData.metaDescription}
                        rows="2"
                        class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
                        placeholder={formData.metaDescription}
                      ></textarea>
                    </div>

                    <div class="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        on:click={translateWithGPT}
                        disabled={gptTranslating}
                        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                          <svg
                            class="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
                        type="button"
                        on:click={saveTranslation}
                        class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
                      >
                        {t('common.save') || 'Save'}
                      </button>
                      <button
                        type="button"
                        on:click={closeTranslationEditor}
                        class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black"
                      >
                        {t('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              {:else}
                <!-- Translation List -->
                <div class="space-y-2 mb-4">
                  {#each translations as translation}
                    {@const lang = languages.find((l) => l.code === translation.languageCode)}
                    <div
                      class="flex items-center justify-between p-3 bg-gray-50 border border-gray-300"
                    >
                      <div>
                        <span class="font-medium"
                          >{lang?.nameNative || lang?.name || translation.languageCode}</span
                        >
                        {#if translation.title}
                          <span class="text-sm text-gray-600 ml-2">({translation.title})</span>
                        {/if}
                      </div>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          on:click={() => editTranslation(translation)}
                          class="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-black text-sm"
                        >
                          {t('common.edit') || 'Edit'}
                        </button>
                        <button
                          type="button"
                          on:click={() => deleteTranslation(translation.languageCode)}
                          class="px-3 py-1 bg-red-500 text-white hover:bg-red-600 transition-colors text-sm"
                        >
                          {t('common.delete') || 'Delete'}
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Add Translation Button -->
                {#if languages.length > 0}
                  <div class="mb-4">
                    <label for="blog-add-translation" class="block text-sm font-medium mb-2"
                      >{t('blog.addTranslation') || 'Add Translation'}</label
                    >
                    <select
                      id="blog-add-translation"
                      bind:value={selectedLanguageForTranslation}
                      class="w-full px-4 py-2 bg-white border border-gray-300 text-black mb-2"
                    >
                      <option value="">{t('common.select') || 'Select'}...</option>
                      {#each languages.filter((l) => !translations.find((t) => t.languageCode === l.code)) as lang}
                        <option value={lang.code}>{lang.nameNative || lang.name}</option>
                      {/each}
                    </select>
                    {#if selectedLanguageForTranslation}
                      <button
                        type="button"
                        on:click={() => {
                          if (!editingPost) return;
                          editingTranslation = {
                            id: '',
                            blogPostId: editingPost.id,
                            languageCode: selectedLanguageForTranslation,
                            title: '',
                            excerpt: '',
                            content: '',
                            metaTitle: '',
                            metaDescription: '',
                            createdAt: '',
                            updatedAt: '',
                          };
                          translationFormData = {
                            title: '',
                            excerpt: '',
                            content: '',
                            metaTitle: '',
                            metaDescription: '',
                          };
                          selectedLanguageForTranslation = '';
                        }}
                        class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
                      >
                        {t('common.add') || 'Add'}
                      </button>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          </div>
        {/if}

        <div class="flex gap-4 pt-4">
          <button
            on:click={savePost}
            class="px-6 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
          >
            {t('common.save') || 'Save'}
          </button>
          <button
            on:click={() => {
              // Clear preview when closing form
              if (thumbnailPreviewUrl) {
                URL.revokeObjectURL(thumbnailPreviewUrl);
                thumbnailPreviewUrl = null;
              }
              if (videoPreviewUrl) {
                URL.revokeObjectURL(videoPreviewUrl);
                videoPreviewUrl = null;
              }
              showForm = false;
            }}
            class="px-6 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="w-full py-8"><LoadingBar /></div>
  {:else if error}
    <p class="text-red-400">Error: {error}</p>
  {:else if posts.length === 0}
    <div class="bg-dark-light p-8 text-center">
      <p class="text-accent-muted mb-4">{t('blog.noPosts') || 'No blog posts found'}</p>
      <button
        on:click={() => openForm()}
        class="px-6 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors"
      >
        {t('blog.createFirstPost') || 'Create First Post'}
      </button>
    </div>
  {:else}
    <div class="space-y-4">
      <div class="bg-dark-light p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="w-full lg:max-w-sm">
            <input
              type="search"
              bind:value={searchQuery}
              placeholder={t('blog.searchPosts')}
              class="w-full px-4 py-2 bg-white border border-gray-300 text-black"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              on:click={() => (statusFilter = 'ALL')}
              class="px-4 py-2 text-sm border transition-colors {statusFilter === 'ALL'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-gray-300'}"
            >
              All
            </button>
            <button
              type="button"
              on:click={() => (statusFilter = 'PUBLISHED')}
              class="px-4 py-2 text-sm border transition-colors {statusFilter === 'PUBLISHED'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-gray-300'}"
            >
              Published
            </button>
            <button
              type="button"
              on:click={() => (statusFilter = 'DRAFT')}
              class="px-4 py-2 text-sm border transition-colors {statusFilter === 'DRAFT'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-gray-300'}"
            >
              Draft
            </button>
            <button
              type="button"
              on:click={() => (statusFilter = 'FEATURED')}
              class="px-4 py-2 text-sm border transition-colors {statusFilter === 'FEATURED'
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-gray-300'}"
            >
              Featured
            </button>
          </div>
        </div>
      </div>

      {#if filteredPosts.length === 0}
        <div class="bg-dark-light p-8 text-center">
          <p class="text-accent-muted">No posts match the current filters.</p>
        </div>
      {/if}

      {#each filteredPosts as post}
        <div class="bg-dark-light p-6 {!post.isPublished ? 'opacity-60' : ''}">
          <div class="flex justify-between items-start gap-4">
            <div class="flex gap-4 flex-1">
              {#if post.thumbnailUrl}
                <div class="flex-shrink-0">
                  <img
                    src={post.thumbnailUrl}
                    alt={post.title}
                    class="w-24 h-24 object-cover rounded border border-gray-700"
                    on:error={(e) => {
                      const target = e.currentTarget;
                      if (target instanceof HTMLImageElement) {
                        target.style.display = 'none';
                      }
                    }}
                  />
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-xl font-medium">{post.title}</h3>
                </div>

                <div
                  class="mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]"
                >
                  <span class="border border-black bg-black px-2.5 py-1 text-white">
                    {post.isPublished
                      ? t('blog.published') || 'Published'
                      : t('blog.draft') || 'Draft'}
                  </span>
                  {#if isFeatured(post)}
                    <span class="border border-black px-2.5 py-1 text-black"> Featured </span>
                  {/if}
                  {#if post.category}
                    <span class="border border-gray-300 px-2.5 py-1 text-gray-700">
                      {t('blog.categories') || 'Category'}: {post.category.name}
                    </span>
                  {/if}
                  {#if post.blogAuthor}
                    <span class="border border-gray-300 px-2.5 py-1 text-gray-700">
                      {t('blog.authors') || 'Author'}: {post.blogAuthor.name}
                    </span>
                  {/if}
                  <span class="border border-gray-200 px-2.5 py-1 text-gray-500">
                    {post.type}
                  </span>
                  <span class="border border-gray-200 px-2.5 py-1 text-gray-500">
                    {getFormatLabel(post.displayFormat || BlogMediaFormat.AUTO)}
                  </span>
                </div>

                {#if post.excerpt}
                  <p class="text-sm text-accent-muted mb-2">{post.excerpt}</p>
                {/if}
                <div class="flex items-center gap-4 text-xs text-accent-muted">
                  <span>{t('blog.slug') || 'Slug'}: {post.slug}</span>
                  {#if post.publishedAt}
                    <span>{formatDate(post.publishedAt)}</span>
                  {/if}
                  <span>{post.views} {t('blog.views') || 'views'}</span>
                </div>
                {#if post.tags.length > 0}
                  <div class="flex flex-wrap gap-2 mt-2">
                    {#each post.tags as tag}
                      <span class="px-2 py-1 bg-accent/20 text-accent text-xs">
                        {tag}
                      </span>
                    {/each}
                  </div>
                {/if}

                <div class="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    on:click={() => setPublishedStatus(post, true)}
                    class="px-3 py-1 text-xs border transition-colors {post.isPublished
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-gray-300 hover:bg-gray-50'}"
                  >
                    Published
                  </button>
                  <button
                    type="button"
                    on:click={() => setPublishedStatus(post, false)}
                    class="px-3 py-1 text-xs border transition-colors {!post.isPublished
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-gray-300 hover:bg-gray-50'}"
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    on:click={() => toggleFeatured(post)}
                    class="px-3 py-1 text-xs border transition-colors {isFeatured(post)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-gray-300 hover:bg-gray-50'}"
                  >
                    Featured
                  </button>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-4 flex-shrink-0">
              <a
                href={`/blog/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 transition-colors text-sm"
              >
                View
              </a>
              <button
                on:click={() => openForm(post)}
                class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 transition-colors text-sm"
              >
                {t('common.edit') || 'Edit'}
              </button>
              <button
                on:click={() => deletePost(post.id)}
                class="px-4 py-2 bg-red-500 text-white hover:bg-red-600 transition-colors text-sm"
              >
                {t('common.delete') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
