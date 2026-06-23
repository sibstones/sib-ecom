<script lang="ts">
  import { authStore } from '$lib/stores/auth.store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { t, translateError } from '$lib/utils/i18n';

  let token = $page.url.searchParams.get('token') || '';
  let newPassword = '';
  let confirmPassword = '';
  let error = '';
  let success = false;
  let loading = false;

  $: hasToken = !!token;

  function getLoginUrl(): string {
    const returnUrl = $page.url.searchParams.get('returnUrl');
    return returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login';
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    if (!token) {
      error = t('auth.invalidResetLink');
      return;
    }
    if (newPassword !== confirmPassword) {
      error = t('auth.passwordsDoNotMatch');
      return;
    }
    if (newPassword.length < 8) {
      error = t('auth.passwordMinLength');
      return;
    }
    loading = true;
    try {
      await authStore.resetPassword(token, newPassword);
      success = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to reset password';
      error = translateError(msg);
    } finally {
      loading = false;
    }
  }
</script>

<main class="min-h-screen flex items-center justify-center bg-white">
  <div class="w-full max-w-md px-6">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2 text-black">{t('auth.resetPasswordTitle')}</h1>
      <p class="text-gray-600">{t('auth.resetPasswordDesc')}</p>
    </div>

    {#if !hasToken}
      <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
        <p class="text-amber-800 text-sm">{t('auth.invalidResetLink')}</p>
      </div>
      <a
        href="/forgot-password"
        class="block w-full py-3 text-center bg-black text-white font-medium hover:bg-gray-800 transition-colors"
      >
        {t('auth.requestNewResetLink')}
      </a>
      <div class="mt-6 text-center">
        <a href={getLoginUrl()} class="text-black hover:underline font-medium text-sm"
          >{t('auth.backToLogin')}</a
        >
      </div>
    {:else if success}
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded">
        <p class="text-green-700 text-sm">{t('auth.resetPasswordSuccess')}</p>
      </div>
      <a
        href={getLoginUrl()}
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
          <label for="newPassword" class="block text-sm font-medium mb-2 text-black"
            >{t('auth.newPassword')}</label
          >
          <input
            id="newPassword"
            type="password"
            bind:value={newPassword}
            required
            minlength="8"
            class="w-full px-4 py-3 bg-white border border-gray-300 focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-black placeholder:text-gray-400"
            placeholder={t('auth.passwordPlaceholder')}
          />
          <p class="mt-1 text-xs text-gray-500">{t('auth.passwordAtLeast8')}</p>
        </div>
        <div>
          <label for="confirmPassword" class="block text-sm font-medium mb-2 text-black"
            >{t('auth.confirmPassword')}</label
          >
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            required
            class="w-full px-4 py-3 bg-white border border-gray-300 focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-black placeholder:text-gray-400"
            placeholder={t('auth.passwordPlaceholder')}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          class="w-full py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('auth.resettingPassword') : t('auth.resetPasswordButton')}
        </button>
      </form>

      <div class="mt-6 text-center">
        <a href={getLoginUrl()} class="text-black hover:underline font-medium text-sm"
          >{t('auth.backToLogin')}</a
        >
      </div>
    {/if}
  </div>
</main>
