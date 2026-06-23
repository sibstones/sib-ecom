<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.store';
  import { t, translateError } from '$lib/utils/i18n';

  export let message: string = t('error.sessionExpired');

  $: translatedMessage = translateError(message);

  async function handleGoToLogin() {
    // Clear auth state before redirecting
    await authStore.logout();
    goto('/login');
  }
</script>

<div class="min-h-[60vh] flex items-center justify-center bg-white py-20 px-4">
  <div class="text-center max-w-md w-full">
    <div class="mb-6">
      <svg
        class="mx-auto h-16 w-16 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
    <h2 class="text-2xl font-bold text-gray-900 mb-4">{t('error.authenticationError')}</h2>
    <p class="text-gray-600 mb-8">{translatedMessage}</p>
    <button
      on:click={handleGoToLogin}
      class="px-8 py-3 bg-black text-white hover:bg-gray-800 transition-colors font-medium text-base"
    >
      {t('error.goToLoginPage')}
    </button>
  </div>
</div>
