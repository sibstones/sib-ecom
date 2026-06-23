<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { onMount, onDestroy } from 'svelte';

  export let src: string;
  export let alt: string = '';
  export let className: string = '';
  export let style: string = '';
  export let loading: 'lazy' | 'eager' = 'lazy'; // Lazy loading
  export let eager: boolean = false; // For critical images
  export let fetchPriority: 'high' | 'low' | 'auto' = 'auto';
  export let decoding: 'sync' | 'async' | 'auto' = 'async';

  let imageElement: HTMLImageElement;
  let videoElement: HTMLVideoElement;
  let containerElement: HTMLDivElement;
  let isLoaded = false;
  let isLoading = false;
  let observer: IntersectionObserver | null = null;
  let imageSrc = '';
  let isMounted = false;
  let previousSrc = '';

  const dispatch = createEventDispatcher<{
    loadstatechange: {
      src: string;
      status: 'idle' | 'loading' | 'loaded' | 'error';
    };
  }>();

  const VIDEO_EXT = /\.(mp4|webm|mov|ogg)(\?|#|$)/i;
  $: isVideoUrl = typeof src === 'string' && VIDEO_EXT.test(src);

  $: isAuthenticated = $authStore.isAuthenticated;
  $: blurEnabled = $settingsStore.imageBlurEnabled ?? false;
  $: shouldBlur = blurEnabled && !isAuthenticated;
  $: isBlurred = shouldBlur;
  $: shouldLoadEagerly = eager || loading === 'eager';
  $: imageFetchPriority = shouldLoadEagerly && fetchPriority === 'auto' ? 'high' : fetchPriority;

  function emitLoadState(status: 'idle' | 'loading' | 'loaded' | 'error') {
    dispatch('loadstatechange', {
      src,
      status,
    });
  }

  function resetMediaState() {
    isLoaded = false;
    isLoading = false;
    imageSrc = shouldLoadEagerly && !isVideoUrl ? src : '';
    emitLoadState('idle');
  }

  function handleImageClick() {
    if (shouldBlur && !$authStore.isAuthenticated) {
      // Redirect to login with return URL
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
    }
  }

  function handleImageLoad() {
    isLoaded = true;
    isLoading = false;
    emitLoadState('loaded');
  }

  function handleImageError() {
    isLoading = false;
    isLoaded = false;
    emitLoadState('error');
    console.error('Failed to load image:', src);
  }

  function loadImage() {
    if (!isLoaded && !isLoading && src && !isVideoUrl) {
      isLoading = true;
      imageSrc = src;
      emitLoadState('loading');
      // Check that src is a valid URL
      if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
        console.warn('Invalid image src format:', src);
      }
    }
  }

  function handleVideoLoaded() {
    isLoaded = true;
    isLoading = false;
    emitLoadState('loaded');
  }

  function handleVideoError() {
    isLoading = false;
    isLoaded = false;
    emitLoadState('error');
  }

  function observeContainer() {
    if (typeof IntersectionObserver === 'undefined') {
      loadImage();
      return;
    }

    if (!containerElement) {
      loadImage();
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isLoaded && !isLoading && src) {
              loadImage();
              observer?.unobserve(containerElement);
            }
          });
        },
        {
          rootMargin: '300px',
          threshold: 0.01,
        }
      );
    }

    observer.observe(containerElement);
  }

  $: if (src !== previousSrc) {
    previousSrc = src;
    resetMediaState();

    if (isMounted) {
      if (isVideoUrl) {
        isLoading = !!src;
        emitLoadState(src ? 'loading' : 'idle');
      } else if (shouldLoadEagerly && src) {
        loadImage();
      } else if (src) {
        observeContainer();
      }
    }
  }

  onMount(() => {
    isMounted = true;

    if (isVideoUrl) {
      isLoaded = false;
      isLoading = true;
      emitLoadState(src ? 'loading' : 'idle');
      return;
    }
    // If the image should be loaded eagerly, load it
    if (shouldLoadEagerly && src) {
      loadImage();
      return;
    }

    observeContainer();
  });

  onDestroy(() => {
    if (observer) {
      observer.disconnect();
    }
  });
</script>

<div
  bind:this={containerElement}
  class="relative w-full h-full overflow-hidden {className}"
  class:blur-container={shouldBlur}
  class:loading-placeholder={!isLoaded}
  {style}
  on:click={handleImageClick}
  role={shouldBlur ? 'button' : 'presentation'}
  {...shouldBlur && { tabindex: 0 }}
  on:keydown={(e) => {
    if (shouldBlur && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleImageClick();
    }
  }}
>
  {#if !isLoaded}
    <div class="absolute inset-0 shimmer-gradient" aria-hidden="true"></div>
  {/if}

  {#if isVideoUrl}
    <video
      bind:this={videoElement}
      {src}
      class="blurred-media w-full h-full object-cover object-center transition-all duration-700 ease-out"
      class:blurred={isBlurred}
      class:opacity-0={!isLoaded}
      class:opacity-100={isLoaded}
      muted
      loop
      playsinline
      autoplay
      draggable="false"
      on:loadeddata={handleVideoLoaded}
      on:error={handleVideoError}
      aria-label={alt}
    ></video>
  {:else}
    <img
      bind:this={imageElement}
      src={imageSrc}
      {alt}
      loading={shouldLoadEagerly ? 'eager' : 'lazy'}
      fetchpriority={imageFetchPriority}
      {decoding}
      class="blurred-media w-full h-full object-cover object-center transition-all duration-700 ease-out"
      class:blurred={isBlurred}
      class:opacity-0={!isLoaded && !shouldLoadEagerly}
      class:opacity-100={isLoaded || shouldLoadEagerly}
      draggable="false"
      on:load={handleImageLoad}
      on:error={handleImageError}
    />
  {/if}

  {#if shouldBlur && !$authStore.isAuthenticated}
    <div
      class="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-700 z-10"
    >
      <div
        class="text-center px-6 py-4 bg-white/90 backdrop-blur-md rounded-lg shadow-lg transform transition-all duration-500 hover:scale-105"
      >
        <svg
          class="w-12 h-12 mx-auto mb-3 text-black/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <p class="text-sm font-medium text-black/80 mb-1">Sign in to view</p>
        <p class="text-xs text-black/60">Click to login or register</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .blurred {
    filter: blur(20px) brightness(0.7);
    transform: scale(1.1);
  }

  .blur-container {
    cursor: pointer;
  }

  .blur-container:hover .blurred {
    filter: blur(15px) brightness(0.75);
  }

  .blur-container:active .blurred {
    filter: blur(10px) brightness(0.8);
  }

  .shimmer-gradient {
    background: linear-gradient(
      90deg,
      #ffffff 0%,
      #f5f5f5 25%,
      #ffffff 50%,
      #f5f5f5 75%,
      #ffffff 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .loading-placeholder {
    background: linear-gradient(
      90deg,
      #ffffff 0%,
      #f5f5f5 25%,
      #ffffff 50%,
      #f5f5f5 75%,
      #ffffff 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
  }

  img.opacity-0 {
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }

  img.opacity-100 {
    opacity: 1;
    transition: opacity 0.3s ease-in-out;
  }
</style>
