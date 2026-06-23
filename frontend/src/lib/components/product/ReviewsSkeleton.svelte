<script lang="ts">
  /** Loading skeleton in the style of the Reviews component — for the LazyComponent placeholder on product pages. */
</script>

<div class="reviews-skeleton">
  <!-- Stats block like in Reviews: bg-white p-8 mb-8 -->
  <div class="bg-white p-8 mb-8">
    <div class="flex items-start gap-12">
      <div class="text-center">
        <div class="skeleton-line h-14 w-16 mx-auto mb-3 rounded" style="max-width: 4rem;"></div>
        <div class="skeleton-line h-6 w-24 mx-auto mb-3 rounded"></div>
        <div class="skeleton-line h-3 w-28 mx-auto rounded"></div>
      </div>
      <div class="flex-1 space-y-2.5">
        {#each [1, 2, 3, 4, 5] as _}
          <div class="flex items-center gap-3">
            <div class="skeleton-line h-4 w-8 rounded shrink-0"></div>
            <div class="skeleton-line flex-1 h-1.5 rounded"></div>
            <div class="skeleton-line h-4 w-8 rounded shrink-0"></div>
          </div>
        {/each}
      </div>
    </div>
  </div>
  <!-- Review cards like in Reviews: bg-white p-6 border-b -->
  <div class="space-y-6">
    {#each [1, 2, 3] as _}
      <div class="bg-white p-6 border-b border-gray-200 last:border-b-0">
        <div class="flex justify-between items-start mb-4">
          <div class="flex-1">
            <div class="skeleton-line h-5 w-32 mb-2 rounded"></div>
            <div class="skeleton-line h-5 w-24 mb-2 rounded"></div>
            <div class="skeleton-line h-4 w-full max-w-xs rounded"></div>
          </div>
          <div class="skeleton-line h-3 w-16 rounded shrink-0 ml-4"></div>
        </div>
        <div class="skeleton-line h-4 w-full rounded"></div>
        <div class="skeleton-line h-4 w-full max-w-sm mt-2 rounded"></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .reviews-skeleton .skeleton-line {
    background: linear-gradient(
      90deg,
      #f5f5f5 0%,
      #e5e5e5 25%,
      #f5f5f5 50%,
      #e5e5e5 75%,
      #f5f5f5 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 2s ease-in-out infinite;
  }

  @keyframes skeleton-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
