<script lang="ts">
  import { authStore } from '$lib/stores/auth.store';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { t, translateError } from '$lib/utils/i18n';

  let token = '';
  let pending = false;
  let emailHint = '';
  let error = '';
  let success = false;
  let loading = false;
  let resendBusy = false;
  let resendMsg = '';

  $: token = $page.url.searchParams.get('token') || '';
  $: pending = $page.url.searchParams.get('pending') === '1';
  $: emailHint = $page.url.searchParams.get('email') || '';

  onMount(async () => {
    if (!token || pending) return;
    loading = true;
    error = '';
    try {
      await authStore.verifyEmail(token);
      success = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('auth.verifyEmailFailed');
      error = translateError(msg);
    } finally {
      loading = false;
    }
  });

  async function resend() {
    const email = emailHint.trim().toLowerCase();
    if (!email) {
      error = t('auth.resendVerificationNeedEmail');
      return;
    }
    resendBusy = true;
    resendMsg = '';
    error = '';
    try {
      const r = await authStore.resendVerification(email);
      resendMsg = r.message;
    } catch (e) {
      error = translateError(e instanceof Error ? e.message : '');
    } finally {
      resendBusy = false;
    }
  }
</script>

<main class="min-h-screen flex items-center justify-center bg-white py-12">
  <div class="w-full max-w-md px-6">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2 text-black">{t('auth.verifyEmailTitle')}</h1>
      <p class="text-gray-600">{t('auth.verifyEmailSubtitle')}</p>
    </div>

    {#if pending}
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded">
        <p class="text-green-800 text-sm">{t('auth.verifyEmailPending')}</p>
      </div>
      <div class="space-y-4">
        <p class="text-sm text-gray-600">{t('auth.verifyEmailResendHint')}</p>
        {#if emailHint}
          <button
            type="button"
            disabled={resendBusy}
            class="w-full py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            on:click={resend}
          >
            {resendBusy ? t('common.loading') : t('auth.resendVerificationEmail')}
          </button>
        {:else}
          <p class="text-sm text-gray-500">{t('auth.resendVerificationNeedEmail')}</p>
        {/if}
        {#if resendMsg}
          <p class="text-sm text-gray-700">{resendMsg}</p>
        {/if}
      </div>
      <div class="mt-8 text-center">
        <a href="/login" class="text-black hover:underline font-medium text-sm"
          >{t('auth.backToLogin')}</a
        >
      </div>
    {:else if loading}
      <p class="text-gray-600 text-sm">{t('common.loading')}</p>
    {:else if success}
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded">
        <p class="text-green-700 text-sm">{t('auth.verifyEmailSuccess')}</p>
      </div>
      <a
        href="/"
        class="block w-full py-3 text-center bg-black text-white font-medium hover:bg-gray-800 transition-colors"
      >
        {t('cart.continueShopping')}
      </a>
    {:else if !token}
      <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
        <p class="text-amber-800 text-sm">{t('auth.verifyEmailNoToken')}</p>
      </div>
      <a
        href="/login"
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
      <div class="space-y-4">
        {#if emailHint}
          <button
            type="button"
            disabled={resendBusy}
            class="w-full py-3 border border-gray-300 text-black font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            on:click={resend}
          >
            {resendBusy ? t('common.loading') : t('auth.resendVerificationEmail')}
          </button>
        {/if}
        {#if resendMsg}
          <p class="text-sm text-gray-700">{resendMsg}</p>
        {/if}
      </div>
      <div class="mt-6 text-center">
        <a href="/login" class="text-black hover:underline font-medium text-sm"
          >{t('auth.backToLogin')}</a
        >
      </div>
    {/if}
  </div>
</main>
