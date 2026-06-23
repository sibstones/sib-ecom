<script lang="ts">
  /** Loading skeleton for the profile page — repeats the layout: notifications, personal data, password, orders, tickets. */
</script>

<div class="profile-skeleton space-y-6">
  <!-- Title -->
  <div class="profile-skeleton-line h-9 w-48 rounded mb-6"></div>

  <!-- Notification blocks (2 cards) -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {#each [1, 2] as _}
      <div class="bg-dark-light p-6 border border-white/10 flex items-center justify-between">
        <div class="profile-skeleton-line h-6 w-48 rounded"></div>
        <div class="profile-skeleton-line h-8 w-10 rounded"></div>
      </div>
    {/each}
  </div>

  <!-- Profile Info block -->
  <div class="bg-dark-light p-6">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-52 rounded"></div>
      <div class="profile-skeleton-line h-9 w-20 rounded"></div>
    </div>
    <div class="space-y-3">
      <div class="profile-skeleton-line h-4 w-full max-w-sm rounded"></div>
      <div class="profile-skeleton-line h-4 w-full max-w-md rounded"></div>
      <div class="profile-skeleton-line h-4 w-64 rounded"></div>
    </div>
  </div>

  <!-- Change Password block -->
  <div class="bg-dark-light p-6">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-40 rounded"></div>
      <div class="profile-skeleton-line h-9 w-32 rounded"></div>
    </div>
  </div>

  <!-- Recent Orders block -->
  <div class="bg-dark-light p-6">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-24 rounded"></div>
      <div class="profile-skeleton-line h-4 w-16 rounded"></div>
    </div>
    <div class="space-y-3">
      {#each [1, 2, 3] as _}
        <div class="p-4 bg-dark border border-white/10 flex justify-between items-start">
          <div class="flex-1 space-y-2">
            <div class="profile-skeleton-line h-4 w-32 rounded"></div>
            <div class="profile-skeleton-line h-3 w-40 rounded"></div>
          </div>
          <div class="profile-skeleton-line h-3 w-16 rounded shrink-0 ml-4"></div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Recent Tickets block -->
  <div class="bg-dark-light p-6">
    <div class="flex justify-between items-center mb-4">
      <div class="profile-skeleton-line h-6 w-36 rounded"></div>
      <div class="profile-skeleton-line h-4 w-16 rounded"></div>
    </div>
    <div class="space-y-3">
      {#each [1, 2, 3] as _}
        <div class="p-4 bg-dark border border-white/10 flex justify-between items-start">
          <div class="flex-1 space-y-2">
            <div class="profile-skeleton-line h-4 w-48 rounded"></div>
            <div class="profile-skeleton-line h-3 w-24 rounded"></div>
          </div>
          <div class="profile-skeleton-line h-3 w-14 rounded shrink-0 ml-4"></div>
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
