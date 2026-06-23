<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/account/profile#messenger', { replaceState: true });
  });
</script>

<div class="min-h-screen bg-dark flex items-center justify-center">
  <p class="text-white">Redirecting...</p>
</div>
