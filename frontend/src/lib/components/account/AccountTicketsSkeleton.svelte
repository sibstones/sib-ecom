<script lang="ts">
  /** Loading skeleton for support tickets: title + list of ticket cards. */
</script>

<div class="account-tickets-skeleton">
  <div class="sk-line h-9 w-52 rounded mb-6"></div>
  <div class="space-y-4">
    {#each [1, 2, 3, 4, 5] as _}
      <div class="bg-dark-light p-6 border border-white/10">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1 space-y-2">
            <div class="sk-line h-6 w-3/4 rounded"></div>
            <div class="sk-line h-4 w-32 rounded"></div>
          </div>
          <div class="sk-line h-6 w-20 rounded shrink-0"></div>
        </div>
        <div class="sk-line h-4 w-full max-w-md rounded mb-2"></div>
        <div class="sk-line h-4 w-48 rounded"></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .account-tickets-skeleton .sk-line {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.12) 75%,
      rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-tickets-shimmer 2s ease-in-out infinite;
  }
  @keyframes account-tickets-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
