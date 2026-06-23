<script lang="ts">
  /** Profile page loading skeleton — repeats the layout: notifications, personal data, password, orders, tickets. */
</script>

<div class="profile-skeleton space-y-6">
  <!-- Title -->
  <div class="profile-skeleton-line h-9 w-48 rounded"></div>

  <!-- Notification blocks (2 cards) -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div class="bg-dark-light p-6 border border-white/10 rounded">
      <div class="profile-skeleton-line h-6 w-3/4 mb-4 rounded"></div>
      <div class="profile-skeleton-line h-8 w-12 rounded ml-auto"></div>
    </div>
    <div class="bg-dark-light p-6 border border-white/10 rounded">
      <div class="profile-skeleton-line h-6 w-3/4 mb-4 rounded"></div>
      <div class="profile-skeleton-line h-8 w-12 rounded ml-auto"></div>
    </div>
  </div>

  <!-- Personal data -->
  <div class="bg-dark-light p-6 border border-white/10 rounded">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-48 rounded"></div>
      <div class="profile-skeleton-line h-10 w-24 rounded"></div>
    </div>
    <div class="space-y-3">
      <div class="profile-skeleton-line h-4 w-full max-w-md rounded"></div>
      <div class="profile-skeleton-line h-4 w-full max-w-sm rounded"></div>
      <div class="profile-skeleton-line h-4 w-64 rounded"></div>
    </div>
  </div>

  <!-- Change password -->
  <div class="bg-dark-light p-6 border border-white/10 rounded">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-40 rounded"></div>
      <div class="profile-skeleton-line h-10 w-36 rounded"></div>
    </div>
  </div>

  <!-- Latest orders -->
  <div class="bg-dark-light p-6 border border-white/10 rounded">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-32 rounded"></div>
      <div class="profile-skeleton-line h-4 w-20 rounded"></div>
    </div>
    <div class="space-y-3">
      {#each [1, 2, 3] as _}
        <div class="p-4 bg-dark/50 border border-white/5 rounded">
          <div class="profile-skeleton-line h-4 w-36 mb-2 rounded"></div>
          <div class="profile-skeleton-line h-3 w-48 rounded"></div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Latest tickets -->
  <div class="bg-dark-light p-6 border border-white/10 rounded">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-40 rounded"></div>
      <div class="profile-skeleton-line h-4 w-20 rounded"></div>
    </div>
    <div class="space-y-3">
      {#each [1, 2, 3] as _}
        <div class="p-4 bg-dark/50 border border-white/5 rounded">
          <div class="profile-skeleton-line h-4 w-44 mb-2 rounded"></div>
          <div class="profile-skeleton-line h-3 w-32 rounded"></div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .profile-skeleton .profile-skeleton-line {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.12) 75%,
      rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: profile-skeleton-shimmer 2s ease-in-out infinite;
  }

  @keyframes profile-skeleton-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
