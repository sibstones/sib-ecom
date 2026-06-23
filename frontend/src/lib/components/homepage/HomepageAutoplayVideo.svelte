<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';

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
  let cleanupPageShow: (() => void) | null = null;
  let cleanupVisibilityChange: (() => void) | null = null;

  async function syncPlayback() {
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

    if (!src) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    const currentSource = video.getAttribute('src') || '';
    if (currentSource !== src) {
      video.pause();
      video.setAttribute('src', src);
      video.load();
    } else if (video.readyState === 0) {
      video.load();
    }

    if (!autoplay) return;

    try {
      if (video.paused && video.currentTime > 0 && !video.ended) {
        video.currentTime = 0;
      }
      await video.play();
    } catch (error) {
      console.debug('Homepage video autoplay prevented:', error);
    }
  }

  $: {
    const nextPlaybackKey = JSON.stringify({
      src,
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
  on:loadedmetadata={() => void syncPlayback()}
  on:canplay={() => void syncPlayback()}
></video>
