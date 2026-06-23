<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // Redirect to profile page by default
    goto('/account/profile', { replaceState: true });
  });
</script>

<div class="min-h-screen bg-dark flex items-center justify-center">
  <div class="text-center">
    <p class="text-white">Redirecting...</p>
  </div>
</div>
