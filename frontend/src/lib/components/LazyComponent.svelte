<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';

  export let rootMargin: string = '200px'; // Start loading 200px before appearing in viewport
  export let threshold: number = 0.01; // Minimum visibility percentage for loading
  export let placeholderHeight: string = 'auto'; // Height of the placeholder
  export let showPlaceholder: boolean = true; // Show placeholder

  let containerElement: HTMLDivElement;
  let placeholderElement: HTMLDivElement;
  let isVisible = false;
  let observer: IntersectionObserver | null = null;
  let hasLoaded = false;

  async function initObserver() {
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback for old browsers - load immediately
      isVisible = true;
      hasLoaded = true;
      return;
    }

    // Wait for the next tick to guarantee that containerElement is bound
    await tick();

    if (!containerElement) {
      // If the element is still not found, load immediately
      isVisible = true;
      hasLoaded = true;
      return;
    }

    try {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasLoaded) {
              isVisible = true;
              hasLoaded = true;
              // Disable observer after the first load
              if (observer && containerElement) {
                observer.unobserve(containerElement);
              }
            }
          });
        },
        {
          rootMargin,
          threshold,
        }
      );

      observer.observe(containerElement);
    } catch (error) {
      // If IntersectionObserver is not supported or an error occurred, load immediately
      console.warn('IntersectionObserver failed, loading component immediately:', error);
      isVisible = true;
      hasLoaded = true;
    }
  }

  onMount(() => {
    initObserver();
  });

  onDestroy(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });
</script>

<div
  bind:this={containerElement}
  class="lazy-component-container"
  style="position: relative; min-height: {placeholderHeight};"
>
  {#if isVisible}
    <!-- Component loaded and visible -->
    <slot />
  {:else if showPlaceholder}
    <!-- Custom placeholder through slot or default skeleton -->
    <div
      bind:this={placeholderElement}
      class="lazy-component-placeholder"
      style="position: relative; width: 100%; min-height: {placeholderHeight};"
    >
      <slot name="placeholder">
        <!-- Neutral placeholder: inherits the page background, without a «typical» loader -->
        <div
          class="lazy-placeholder-reserved"
          style="width: 100%; min-height: {placeholderHeight};"
        ></div>
      </slot>
    </div>
  {/if}
</div>

<style>
  :global(.lazy-component-container) {
    /* Container preserves structure and positioning */
    display: block;
    width: 100%;
  }

  :global(.lazy-component-placeholder) {
    /* Placeholder exactly matches the size and position of the content */
    display: block;
    width: 100%;
    position: relative;
    /* Preserve the structure and content margins */
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(.lazy-placeholder-reserved) {
    width: 100%;
    background: transparent;
    /* Reserve space without a visual «loader» — does not conflict with the page style */
  }
</style>
