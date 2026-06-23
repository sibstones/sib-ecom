<script lang="ts">
  import { onMount } from 'svelte';

  /** Optional class on the animated wrapper */
  export let wrapperClass = '';

  /** Scroll-in effect when the section enters the viewport */
  export let animation: 'fade_up' | 'fade' | 'scale' | 'none' = 'fade_up';

  let root: HTMLElement;
  let visible = false;

  const hidden: Record<typeof animation, string> = {
    fade_up: 'opacity-0 translate-y-6',
    fade: 'opacity-0',
    scale: 'opacity-0 scale-[0.97]',
    none: '',
  };

  const shown: Record<typeof animation, string> = {
    fade_up: 'opacity-100 translate-y-0',
    fade: 'opacity-100',
    scale: 'opacity-100 scale-100',
    none: '',
  };

  $: hideClass = hidden[animation] ?? hidden.fade_up;
  $: showClass = shown[animation] ?? shown.fade_up;

  onMount(() => {
    if (animation === 'none') {
      visible = true;
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
      visible = true;
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) {
          visible = true;
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
    );

    io.observe(root);
    return () => io.disconnect();
  });
</script>

<div
  bind:this={root}
  class="motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out {wrapperClass} {visible
    ? showClass
    : `${hideClass} motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100`}"
>
  <slot />
</div>
