<script lang="ts">
  import { authStore } from '$lib/stores/auth.store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { t, translateError } from '$lib/utils/i18n';

  let email = '';
  let error = '';
  let success = false;
  let loading = false;

  function getReturnUrl(): string {
    const returnUrl = $page.url.searchParams.get('returnUrl');
    return returnUrl || '/login';
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    success = false;
    if (!email.trim()) {
      error = t('auth.email') + ' is required';
      return;
    }
    loading = true;
    try {
      await authStore.requestPasswordReset(email.trim());
      success = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send reset link';
      error = translateError(msg);
    } finally {
      loading = false;
    }
  }
</script>

<main class="min-h-screen flex items-center justify-center bg-white">
  <div class="w-full max-w-md px-6">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2 text-black">{t('auth.forgotPasswordTitle')}</h1>
      <p class="text-gray-600">{t('auth.forgotPasswordDesc')}</p>
    </div>

    {#if success}
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded">
        <p class="text-green-700 text-sm">{t('auth.checkEmailForResetLink')}</p>
      </div>
      <a
        href={getReturnUrl()}
        class="block w-full py-3 text-center bg-black text-white font-medium hover:bg-gray-800 transition-colors"
      >
        {t('auth.backToLogin')}
      </a>
    {:else}
      {#if error}
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <p class="text-red-600 text-sm">{error}</p>
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium mb-2 text-black"
            >{t('auth.email')}</label
          >
          <input
            id="email"
            type="email"
            bind:value={email}
            required
            class="w-full px-4 py-3 bg-white border border-gray-300 focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-black placeholder:text-gray-400"
            placeholder={t('auth.emailPlaceholder')}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          class="w-full py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
        </button>
      </form>

      <div class="mt-6 text-center">
        <a
          href={getReturnUrl()}
          class="text-black hover:underline font-medium text-sm transition-colors hover:text-gray-700"
        >
          {t('auth.backToLogin')}
        </a>
      </div>
    {/if}
  </div>
</main>
