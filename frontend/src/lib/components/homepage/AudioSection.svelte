<script lang="ts">
  import type { HomepageSection } from '$lib/api/homepage.api';

  export let section: HomepageSection | null = null;

  let audioEl: HTMLAudioElement;
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let progress = 0;
  let volume = 1;

  $: config = section?.config || {};
  $: configAny = config as Record<string, unknown>;

  $: audioUrl = (configAny.audioUrl as string) || '';
  $: playerVariant = (configAny.playerVariant as 'minimal' | 'bar' | 'compact') || 'minimal';
  $: accentColor = (configAny.playerAccentColor as string) || '#000000';
  $: bgColor = (configAny.playerBgColor as string) || '#fafafa';
  $: showPlayPause = configAny.showPlayPause !== false;
  $: showProgress = configAny.showProgress !== false;
  $: showTime = configAny.showTime !== false;
  $: showVolume = configAny.showVolume !== false;
  $: autoplay = configAny.autoplay === true;
  $: title = (section?.title || configAny.title) as string;

  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function togglePlay() {
    if (!audioEl || !audioUrl) return;
    if (isPlaying) {
      audioEl.pause();
    } else {
      audioEl.play();
    }
    isPlaying = !isPlaying;
  }

  function onTimeUpdate() {
    if (!audioEl) return;
    currentTime = audioEl.currentTime;
    duration = audioEl.duration;
    progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  }

  function onLoadedMetadata() {
    if (!audioEl) return;
    duration = audioEl.duration;
  }

  function onEnded() {
    isPlaying = false;
    currentTime = 0;
    progress = 0;
  }

  function setVolume(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target || !audioEl) return;
    volume = parseFloat(target.value);
    audioEl.volume = volume;
  }

  function handleProgressInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!audioEl || !target) return;
    const v = parseFloat(target.value);
    audioEl.currentTime = v;
    currentTime = v;
    progress = duration > 0 ? (v / duration) * 100 : 0;
  }

  $: if (audioEl && autoplay && audioUrl && !isPlaying && currentTime === 0) {
    audioEl
      .play()
      .then(() => {
        isPlaying = true;
      })
      .catch(() => {});
  }
</script>

{#if section?.isActive && audioUrl}
  <section class="w-full" style="background-color: {bgColor};">
    <div class="mx-auto max-w-2xl px-6 py-12 md:py-16">
      {#if title}
        <p class="text-sm tracking-widest uppercase opacity-60 mb-4" style="color: {accentColor};">
          {title}
        </p>
      {/if}

      <div class="rounded-lg border border-black/6 p-4 md:p-5" style="background: {bgColor};">
        <audio
          bind:this={audioEl}
          src={audioUrl}
          on:timeupdate={onTimeUpdate}
          on:loadedmetadata={onLoadedMetadata}
          on:ended={onEnded}
        ></audio>

        <div class="flex items-center gap-4">
          {#if showPlayPause}
            <button
              type="button"
              on:click={togglePlay}
              class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style="background-color: {accentColor}; color: {bgColor};"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {#if isPlaying}
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              {:else}
                <svg class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              {/if}
            </button>
          {/if}

          <div class="flex-1 min-w-0">
            {#if showProgress}
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 100}
                step="0.1"
                value={currentTime}
                on:input={handleProgressInput}
                class="w-full h-1 rounded-full cursor-pointer accent-black/80 appearance-none bg-black/8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                style="--thumb-color: {accentColor}"
              />
            {/if}
            {#if showTime}
              <div
                class="flex justify-between mt-1.5 text-xs opacity-60"
                style="color: {accentColor};"
              >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            {/if}
          </div>

          {#if showVolume}
            <div class="flex-shrink-0 flex items-center gap-1.5" style="color: {accentColor};">
              <svg class="w-4 h-4 opacity-70" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
                />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                on:input={setVolume}
                class="w-16 h-1 rounded accent-black/60 cursor-pointer"
              />
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
{/if}
