<script lang="ts">
  /** Short black segment sliding left-to-right (page / inline loading indicator). */
  export let className: string = '';
</script>

<div
  class="loading-bar-track w-full h-[2px] overflow-hidden {className}"
  role="progressbar"
  aria-label="Loading"
  aria-valuetext="loading"
>
  <div class="loading-bar-segment"></div>
</div>

<style>
  .loading-bar-track {
    position: relative;
    background: transparent;
  }

  .loading-bar-segment {
    position: absolute;
    top: 0;
    left: -35%;
    width: 35%;
    max-width: 7rem;
    min-width: 2.5rem;
    height: 100%;
    background: #000;
    animation: loading-slide 1.1s ease-in-out infinite;
  }

  @keyframes loading-slide {
    0% {
      left: -35%;
    }
    100% {
      left: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-bar-segment {
      animation: none;
      left: 32%;
    }
  }
</style>
