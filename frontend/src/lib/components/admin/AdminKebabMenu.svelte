<script lang="ts">
  import { tick, onMount } from 'svelte';

  /** Whether the dropdown is open */
  export let open = false;
  /** `title` / tooltip on the trigger */
  export let title = '';
  /** Called when the kebab trigger is clicked (parent toggles open state) */
  export let menuToggle: () => void;

  let triggerEl: HTMLButtonElement | null = null;
  let menuTop = 0;
  let menuLeft = 0;

  const GAP = 4;
  const MIN_W = 160;
  const EST_HEIGHT = 220;

  async function updatePosition() {
    await tick();
    if (!open || !triggerEl || typeof window === 'undefined') return;
    const r = triggerEl.getBoundingClientRect();
    let top = r.bottom + GAP;
    let left = Math.max(8, r.right - MIN_W);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + MIN_W > vw - 8) {
      left = Math.max(8, vw - MIN_W - 8);
    }
    if (top + EST_HEIGHT > vh - 8) {
      top = Math.max(8, r.top - EST_HEIGHT - GAP);
    }
    menuTop = top;
    menuLeft = left;
  }

  $: if (open) {
    void updatePosition();
  }

  function handleScrollResize() {
    if (open) void updatePosition();
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  });
</script>

<div class="inline-block">
  <button
    type="button"
    bind:this={triggerEl}
    on:click|stopPropagation={menuToggle}
    class="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 text-black transition-colors"
    {title}
    aria-haspopup="true"
    aria-expanded={open}
  >
    <span class="text-lg leading-none" aria-hidden="true">⋮</span>
  </button>
  {#if open}
    <div
      class="fixed z-[200] min-w-[160px] py-1 rounded-md border border-gray-200 bg-white shadow-lg"
      role="menu"
      style="top: {menuTop}px; left: {menuLeft}px;"
    >
      <slot />
    </div>
  {/if}
</div>
