<script lang="ts">
  /** Loading skeleton for the admin dashboard: title, 4 statistics cards, warehouse analytics, tickets, latest orders. */
</script>

<div class="dashboard-skeleton">
  <!-- Title -->
  <div class="dashboard-skeleton-line h-9 w-48 rounded mb-6"></div>

  <!-- Stats Cards (4 cards) -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {#each [1, 2, 3, 4] as _}
      <div class="bg-dark-light p-6">
        <div class="dashboard-skeleton-line h-4 w-24 mb-2 rounded"></div>
        <div class="dashboard-skeleton-line h-9 w-20 rounded"></div>
      </div>
    {/each}
  </div>

  <!-- Warehouse Analytics -->
  <div class="bg-dark-light p-8 border border-dark mb-8">
    <div class="border-b border-dark-lighter pb-4 mb-6">
      <div class="flex justify-between items-center">
        <div>
          <div class="dashboard-skeleton-line h-7 w-64 mb-2 rounded"></div>
          <div class="dashboard-skeleton-line h-4 w-32 rounded"></div>
        </div>
        <div class="dashboard-skeleton-line h-4 w-20 rounded"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {#each [1, 2, 3, 4, 5] as _}
        <div class="bg-white/5 border border-dark-lighter p-6">
          <div class="dashboard-skeleton-line h-3 w-24 mb-2 rounded"></div>
          <div class="dashboard-skeleton-line h-9 w-16 mb-1 rounded"></div>
          <div class="dashboard-skeleton-line h-3 w-28 rounded"></div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Support Tickets -->
  <div class="bg-dark-light p-6 mb-8">
    <div class="flex justify-between items-center mb-4">
      <div class="dashboard-skeleton-line h-6 w-44 rounded"></div>
      <div class="dashboard-skeleton-line h-4 w-20 rounded"></div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      {#each [1, 2, 3, 4, 5] as _}
        <div>
          <div class="dashboard-skeleton-line h-4 w-12 mb-1 rounded"></div>
          <div class="dashboard-skeleton-line h-8 w-10 rounded"></div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Recent Orders -->
  <div class="bg-dark-light p-6">
    <div class="dashboard-skeleton-line h-6 w-40 rounded mb-4"></div>
    <div class="space-y-4">
      {#each [1, 2, 3, 4, 5] as _}
        <div class="flex justify-between items-center pb-4 border-b border-white/10 last:border-0">
          <div class="space-y-2">
            <div class="dashboard-skeleton-line h-5 w-24 rounded"></div>
            <div class="dashboard-skeleton-line h-4 w-48 rounded"></div>
          </div>
          <div class="text-right space-y-2">
            <div class="dashboard-skeleton-line h-5 w-16 rounded ml-auto"></div>
            <div class="dashboard-skeleton-line h-4 w-20 rounded ml-auto"></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .dashboard-skeleton .dashboard-skeleton-line {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.12) 75%,
      rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: dashboard-skeleton-shimmer 2s ease-in-out infinite;
  }

  @keyframes dashboard-skeleton-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
