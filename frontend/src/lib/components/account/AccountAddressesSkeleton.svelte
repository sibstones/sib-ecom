<script lang="ts">
  /** Address loading skeleton: title + button + list of address cards. */
</script>

<div class="account-addresses-skeleton">
  <div class="flex justify-between items-center mb-6">
    <div class="sk-line h-9 w-48 rounded"></div>
    <div class="sk-line h-10 w-32 rounded"></div>
  </div>
  <div class="space-y-4">
    {#each [1, 2, 3] as _}
      <div class="bg-dark-light p-6">
        <div class="flex justify-between items-start">
          <div class="space-y-2">
            <div class="sk-line h-5 w-16 rounded"></div>
            <div class="sk-line h-6 w-44 rounded"></div>
            <div class="sk-line h-4 w-full max-w-sm rounded"></div>
            <div class="sk-line h-4 w-56 rounded"></div>
          </div>
          <div class="flex gap-2">
            <div class="sk-line h-9 w-16 rounded"></div>
            <div class="sk-line h-9 w-16 rounded"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .account-addresses-skeleton .sk-line {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.12) 75%,
      rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: account-addresses-shimmer 2s ease-in-out infinite;
  }
  @keyframes account-addresses-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
