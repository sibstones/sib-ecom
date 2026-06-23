<script lang="ts">
  /** Order loading skeleton: title + order cards (preview, number, date, amount, button). */
</script>

<div class="account-orders-skeleton">
  <div class="sk-line h-9 w-48 rounded mb-6"></div>
  <div class="space-y-4">
    {#each [1, 2, 3, 4] as _}
      <div class="bg-dark-light overflow-hidden flex min-w-0">
        <div class="w-20 sm:w-28 aspect-[9/16] flex-shrink-0 sk-line rounded-none"></div>
        <div class="flex-1 min-w-0 p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-4">
              <div>
                <div class="sk-line h-6 w-32 mb-2 rounded"></div>
                <div class="sk-line h-4 w-40 rounded"></div>
              </div>
              <div class="text-right">
                <div class="sk-line h-8 w-20 mb-2 rounded ml-auto"></div>
                <div class="sk-line h-4 w-16 rounded ml-auto"></div>
              </div>
            </div>
            <div class="mb-4">
              <div class="sk-line h-4 w-24 mb-2 rounded"></div>
              <div class="flex gap-2">
                <div class="w-9 h-16 sk-line rounded"></div>
                <div class="w-9 h-16 sk-line rounded"></div>
                <div class="w-9 h-16 sk-line rounded"></div>
              </div>
            </div>
          </div>
          <div class="sk-line h-10 w-28 rounded self-start"></div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .account-orders-skeleton .sk-line {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.12) 75%,
      rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-orders-shimmer 2s ease-in-out infinite;
  }
  @keyframes account-orders-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
