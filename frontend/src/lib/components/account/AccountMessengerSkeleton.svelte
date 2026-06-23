<script lang="ts">
  /** Messenger contact loading skeleton: title + button + description + list of contacts. */
</script>

<div class="account-messenger-skeleton">
  <div class="flex justify-between items-center mb-6">
    <div class="sk-line h-9 w-56 rounded"></div>
    <div class="sk-line h-10 w-28 rounded"></div>
  </div>
  <div class="sk-line h-4 w-full max-w-2xl rounded mb-6"></div>
  <div class="space-y-4">
    {#each [1, 2, 3, 4] as _}
      <div class="bg-dark-light p-6">
        <div class="flex justify-between items-start">
          <div class="space-y-2">
            <div class="sk-line h-6 w-24 rounded"></div>
            <div class="sk-line h-4 w-40 rounded"></div>
            <div class="sk-line h-3 w-32 rounded"></div>
          </div>
          <div class="flex gap-2">
            <div class="sk-line h-9 w-14 rounded"></div>
            <div class="sk-line h-9 w-16 rounded"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .account-messenger-skeleton .sk-line {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.12) 75%,
      rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-messenger-shimmer 2s ease-in-out infinite;
  }
  @keyframes account-messenger-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
