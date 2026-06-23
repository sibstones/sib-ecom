<script lang="ts">
  /** Skeleton for the ProductPageGrid — same layout: gallery + info overlay. */
</script>

<div class="grid-skeleton py-8 relative">
  <div class="flex items-start gap-4">
    <div class="flex-1 space-y-12 min-w-0">
      <!-- Row 1: Grid — journal-container, flex lg:flex-row -->
      <div
        class="relative overflow-visible w-full max-w-full mx-auto lg:px-0 lg:max-w-[80%] lg:pl-[clamp(4rem,3vw,20rem)]"
      >
        <div class="flex flex-col lg:flex-row gap-8 items-start w-full overflow-visible max-w-full">
          <!-- Image block: mobile full width, desktop ~40% / slider -->
          <div class="relative flex-shrink-0 w-full lg:w-[40%] lg:max-w-[40%]">
            <div class="w-full overflow-hidden relative aspect-[9/16] bg-gray-100 rounded-none">
              <div class="grid-skeleton-line absolute inset-0"></div>
            </div>
          </div>
          <!-- Product Info panel — Grid: w-full lg:w-[25%] lg:absolute right-0 -->
          <div
            class="flex-shrink-0 w-full lg:w-[20%] lg:max-w-[400px] space-y-6 relative lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:z-30 bg-white lg:bg-transparent lg:flex lg:flex-col lg:justify-center lg:min-h-[738px]"
            style="min-width: 320px;"
          >
            <div>
              <div class="grid-skeleton-line h-9 w-[80%] mb-2 rounded"></div>
              <div class="grid-skeleton-line h-4 w-24 mb-4 rounded"></div>
              <div class="flex items-center gap-4 mb-4">
                <div class="grid-skeleton-line h-8 w-28 rounded"></div>
                <div class="grid-skeleton-line h-6 w-20 rounded"></div>
              </div>
            </div>
            <div class="border-t border-gray-200 pt-4 space-y-2">
              <div class="grid-skeleton-line h-4 w-24 rounded"></div>
              <div class="grid-skeleton-line h-4 w-full rounded"></div>
              <div class="grid-skeleton-line h-4 w-5/6 rounded"></div>
            </div>
            <div class="space-y-2">
              <div class="grid-skeleton-line h-4 w-16 rounded"></div>
              <div class="flex gap-2 flex-wrap">
                {#each [1, 2, 3, 4] as _}
                  <div class="grid-skeleton-line h-10 w-14 rounded"></div>
                {/each}
              </div>
            </div>
            <div class="space-y-2">
              <div class="grid-skeleton-line h-4 w-20 rounded"></div>
              <div class="grid-skeleton-line h-12 w-full rounded"></div>
            </div>
            <div class="grid-skeleton-line h-12 w-full rounded"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .grid-skeleton .grid-skeleton-line {
    background: linear-gradient(
      90deg,
      #f5f5f5 0%,
      #e8e8e8 25%,
      #f5f5f5 50%,
      #e8e8e8 75%,
      #f5f5f5 100%
    );
    background-size: 200% 100%;
    animation: grid-skeleton-shimmer 2s ease-in-out infinite;
  }

  @keyframes grid-skeleton-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
