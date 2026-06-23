<script lang="ts">
  import { goto } from '$app/navigation';

  /** HTTP status (may be missing when error is from failed chunk load / preload). */
  export let status: number = 500;
  /** Error instance (may be missing in some SvelteKit error paths). */
  export let error: Error & { message?: string } = new Error('Unknown error');
  /** Absorb params so SvelteKit doesn't warn when it passes route params in some error paths. */
  export let params: Record<string, string> = {};
  function consumeValue(..._values: unknown[]) {}
  consumeValue(params);

  $: statusCode = typeof status === 'number' ? status : 500;
  $: message = error?.message ?? 'Something went wrong';

  function goHome() {
    goto('/');
  }
</script>

<main class="min-h-screen flex items-center justify-center bg-white">
  <div class="text-center px-4">
    <h1 class="text-6xl md:text-8xl font-bold mb-4 text-black">{statusCode}</h1>
    <p class="text-xl md:text-2xl mb-8 text-gray-600">
      {statusCode === 404 ? 'Page not found' : message}
    </p>
    <button
      on:click={goHome}
      class="px-8 py-3 bg-black text-white hover:bg-gray-800 transition-colors font-medium"
    >
      Return to Home
    </button>
  </div>
</main>
