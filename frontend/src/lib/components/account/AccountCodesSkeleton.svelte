<script lang="ts">
  /** Loading skeleton for promo codes: title + «Available» block + «Used» block with cards. */
</script>

<div class="account-codes-skeleton">
  <div class="sk-line h-9 w-40 rounded mb-6"></div>
  <div class="space-y-8">
    <div>
      <div class="sk-line h-7 w-52 rounded mb-4"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each [1, 2] as _}
          <div class="bg-white border-2 border-black overflow-hidden">
            <div class="bg-black h-14 sk-line rounded-none"></div>
            <div class="p-6">
              <div class="sk-line sk-line-dark h-12 w-24 mx-auto mb-2 rounded"></div>
              <div class="sk-line sk-line-dark h-3 w-20 mx-auto mb-6 rounded"></div>
              <div class="sk-line sk-line-dark h-4 w-16 mb-2 rounded"></div>
              <div class="sk-line sk-line-dark h-10 w-full mb-6 rounded"></div>
              <div class="space-y-3">
                <div class="sk-line sk-line-dark h-4 w-full rounded"></div>
                <div class="sk-line sk-line-dark h-4 w-3/4 rounded"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    <div>
      <div class="sk-line h-7 w-40 rounded mb-4"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each [1, 2] as _}
          <div class="bg-white border-2 border-black/30 overflow-hidden opacity-75">
            <div class="h-14 sk-line sk-line-header-used rounded-none"></div>
            <div class="p-6">
              <div class="sk-line sk-line-dark h-12 w-24 mx-auto mb-2 rounded"></div>
              <div class="sk-line sk-line-dark h-3 w-20 mx-auto mb-6 rounded"></div>
              <div class="sk-line sk-line-dark h-4 w-16 mb-2 rounded"></div>
              <div class="sk-line sk-line-dark h-10 w-full rounded"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .account-codes-skeleton .sk-line {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.12) 75%,
      rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-codes-shimmer 2s ease-in-out infinite;
  }
  .account-codes-skeleton .bg-black.sk-line,
  .account-codes-skeleton .sk-line-header-used {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.15) 0%,
      rgba(255, 255, 255, 0.3) 25%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.3) 75%,
      rgba(255, 255, 255, 0.15) 100%
    );
    background-size: 200% 100%;
    animation: account-codes-shimmer 2s ease-in-out infinite;
  }
  .account-codes-skeleton .sk-line-dark {
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.06) 0%,
      rgba(0, 0, 0, 0.14) 25%,
      rgba(0, 0, 0, 0.06) 50%,
      rgba(0, 0, 0, 0.14) 75%,
      rgba(0, 0, 0, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-codes-shimmer 2s ease-in-out infinite;
  }
  @keyframes account-codes-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
