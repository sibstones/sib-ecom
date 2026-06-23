<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/utils/i18n';

  const letters = ['H', 'e', 'l', 'l', 'o'];

  let animate = false;
  let showSubtitle = false;
  let showCta = false;

  onMount(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
      animate = true;
      showSubtitle = true;
      showCta = true;
      return;
    }

    requestAnimationFrame(() => {
      animate = true;
      window.setTimeout(() => {
        showSubtitle = true;
      }, 720);
      window.setTimeout(() => {
        showCta = true;
      }, 1100);
    });
  });
</script>

<section
  class="homepage-setup flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center bg-white px-6 py-16"
  aria-label={t('homepage.setupAriaLabel')}
>
  <h1
    class="m-0 flex items-baseline justify-center gap-[0.02em] text-[clamp(3.5rem,12vw,7.5rem)] font-semibold leading-none tracking-[-0.04em] text-black"
  >
    {#each letters as letter, i}
      <span
        class="homepage-setup__letter inline-block {animate ? 'homepage-setup__letter--in' : ''}"
        style="--letter-i: {i}"
      >
        {letter}
      </span>
    {/each}
  </h1>

  <p
    class="homepage-setup__subtitle mt-8 max-w-md text-center text-base font-normal leading-relaxed text-neutral-500 sm:text-lg {showSubtitle
      ? 'homepage-setup__subtitle--in'
      : ''}"
  >
    {t('homepage.setupSubtitle')}
  </p>

  <div
    class="homepage-setup__cta mt-10 flex flex-col items-center gap-3 {showCta
      ? 'homepage-setup__cta--in'
      : ''}"
  >
    <a
      href="/login?returnUrl={encodeURIComponent('/admin/homepage')}"
      class="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-8 text-sm font-medium tracking-wide text-white transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      {t('homepage.setupCta')}
    </a>
    <p class="max-w-sm text-center text-xs text-neutral-400">
      {t('homepage.setupCtaHint')}
    </p>
  </div>
</section>

<style>
  .homepage-setup__letter {
    opacity: 0;
    filter: blur(14px);
    transform: translateY(0.12em) scale(1.03);
  }

  .homepage-setup__letter--in {
    animation: homepage-setup-letter 1.05s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: calc(var(--letter-i) * 0.07s + 0.05s);
  }

  .homepage-setup__subtitle {
    opacity: 0;
    filter: blur(8px);
    transform: translateY(12px);
  }

  .homepage-setup__subtitle--in {
    animation: homepage-setup-fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .homepage-setup__cta {
    opacity: 0;
    transform: translateY(10px);
  }

  .homepage-setup__cta--in {
    animation: homepage-setup-fade-up 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes homepage-setup-letter {
    to {
      opacity: 1;
      filter: blur(0);
      transform: translateY(0) scale(1);
    }
  }

  @keyframes homepage-setup-fade-up {
    to {
      opacity: 1;
      filter: blur(0);
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .homepage-setup__letter,
    .homepage-setup__subtitle,
    .homepage-setup__cta {
      opacity: 1;
      filter: none;
      transform: none;
      animation: none;
    }
  }
</style>
