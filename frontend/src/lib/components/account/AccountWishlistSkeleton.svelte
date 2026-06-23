<script lang="ts">
  /** Wishlist loading skeleton: title + grid of product cards (image, name, price, buttons). */
</script>

<div class="account-wishlist-skeleton">
  <div class="sk-line sk-title h-9 w-48 rounded mb-6"></div>
  <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
    {#each [1, 2, 3, 4, 5, 6, 7, 8] as _}
      <div class="bg-white overflow-hidden rounded">
        <div class="sk-image aspect-[9/16] rounded-none"></div>
        <div class="p-4 sk-card">
          <div class="sk-line sk-card-line h-5 w-3/4 mb-2 rounded"></div>
          <div class="sk-line sk-card-line h-7 w-20 mb-4 rounded"></div>
          <div class="flex flex-col gap-2">
            <div class="sk-line sk-card-line h-10 w-full rounded"></div>
            <div class="sk-line sk-card-line h-10 w-full rounded"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .account-wishlist-skeleton .sk-title {
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.06) 0%,
      rgba(0, 0, 0, 0.12) 25%,
      rgba(0, 0, 0, 0.06) 50%,
      rgba(0, 0, 0, 0.12) 75%,
      rgba(0, 0, 0, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-wishlist-shimmer 2s ease-in-out infinite;
  }
  .account-wishlist-skeleton .sk-image {
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.06) 0%,
      rgba(0, 0, 0, 0.12) 25%,
      rgba(0, 0, 0, 0.06) 50%,
      rgba(0, 0, 0, 0.12) 75%,
      rgba(0, 0, 0, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-wishlist-shimmer 2s ease-in-out infinite;
  }
  .account-wishlist-skeleton .sk-line.sk-card-line {
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.05) 0%,
      rgba(0, 0, 0, 0.1) 25%,
      rgba(0, 0, 0, 0.05) 50%,
      rgba(0, 0, 0, 0.1) 75%,
      rgba(0, 0, 0, 0.05) 100%
    );
    background-size: 200% 100%;
    animation: account-wishlist-shimmer 2s ease-in-out infinite;
  }
  @keyframes account-wishlist-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
