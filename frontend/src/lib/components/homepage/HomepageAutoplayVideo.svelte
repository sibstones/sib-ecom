<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { resolveStorefrontMediaSrc } from '$lib/utils/media-url';

  export let src = '';
  export let className = '';
  export let style = '';
  export let autoplay = true;
  export let loop = true;
  export let muted = true;
  export let controls = false;
  export let playsinline = true;
  export let preload: 'none' | 'metadata' | 'auto' = 'metadata';
  export let ariaLabel = '';

  let videoElement: HTMLVideoElement | null = null;
  let lastPlaybackKey = '';
  let playAttemptId = 0;
  let cleanupPageShow: (() => void) | null = null;
  let cleanupVisibilityChange: (() => void) | null = null;

  $: mediaSrc = resolveStorefrontMediaSrc(src);

  async function attemptAutoplay() {
    const video = videoElement;
    if (!video) return;
    if (!autoplay || !mediaSrc || video.getAttribute('src') !== mediaSrc) return;

    const attemptId = ++playAttemptId;

    try {
      if (video.paused && video.currentTime > 0 && !video.ended) {
        video.currentTime = 0;
      }
      await video.play();
    } catch (error) {
      if (attemptId === playAttemptId) {
        console.debug('Homepage video autoplay prevented:', error);
      }
    }
  }

  function syncPlayback() {
    const video = videoElement;
    if (!video) return;

    video.defaultMuted = muted;
    video.muted = muted;
    video.loop = loop;
    video.autoplay = autoplay;
    video.playsInline = playsinline;
    video.preload = preload;
    video.controls = controls;
    video.disablePictureInPicture = true;
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('disablePictureInPicture', 'true');
    video.setAttribute('disableremoteplayback', 'true');
    video.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen noremoteplayback');
    if (!controls) {
      video.removeAttribute('controls');
    }

    if (!mediaSrc) {
      playAttemptId += 1;
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    const currentSource = video.getAttribute('src') || '';
    if (currentSource !== mediaSrc) {
      playAttemptId += 1;
      video.pause();
      video.setAttribute('src', mediaSrc);
      video.load();
      return;
    } else if (video.readyState === 0) {
      video.load();
      return;
    }

    void attemptAutoplay();
  }

  $: {
    const nextPlaybackKey = JSON.stringify({
      mediaSrc,
      autoplay,
      loop,
      muted,
      controls,
      playsinline,
      preload,
    });

    if (nextPlaybackKey !== lastPlaybackKey) {
      lastPlaybackKey = nextPlaybackKey;
      tick().then(syncPlayback);
    }
  }

  onMount(() => {
    void syncPlayback();

    const handlePageShow = () => {
      void syncPlayback();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncPlayback();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    cleanupPageShow = () => window.removeEventListener('pageshow', handlePageShow);
    cleanupVisibilityChange = () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  onDestroy(() => {
    playAttemptId += 1;
    cleanupPageShow?.();
    cleanupVisibilityChange?.();
  });
</script>

<video
  bind:this={videoElement}
  {controls}
  {loop}
  {muted}
  {autoplay}
  playsinline={playsinline}
  {preload}
  class={className}
  {style}
  aria-label={ariaLabel}
  disablepictureinpicture={true}
  disableremoteplayback={true}
  controlslist="nodownload noplaybackrate nofullscreen noremoteplayback"
  tabindex="-1"
  on:canplay={() => void attemptAutoplay()}
></video>
