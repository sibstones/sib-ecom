<script lang="ts">
  import { authStore } from '$lib/stores/auth.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { t, translateError } from '$lib/utils/i18n';
  import Captcha from '$lib/components/Captcha.svelte';
  import type CaptchaComponent from '$lib/components/Captcha.svelte';
  import OAuthButtons from '$lib/components/OAuthButtons.svelte';

  let email = '';
  let password = '';
  let confirmPassword = '';
  let firstName = '';
  let lastName = '';
  let promoCode = '';
  let agreedToPrivacy = true;
  let error = '';
  let loading = false;
  let captchaComponent: CaptchaComponent;
  let captchaToken = '';

  $: captchaRequired =
    $settingsStore.captchaEnabled && $settingsStore.captchaRequiredForRegistration;

  function handleCaptchaVerify(token: string) {
    captchaToken = token;
  }

  function handleCaptchaError(err: string) {
    error = err;
  }

  function handleCaptchaExpire() {
    captchaToken = '';
  }

  function getReturnUrl(): string {
    const returnUrl = $page.url.searchParams.get('returnUrl');
    return returnUrl || '/';
  }

  onMount(() => {
    // Pre-fill promo from partner link (?promo= stored in session or still in URL)
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('applied_promo_code');
      if (stored?.trim()) promoCode = stored.trim();
    }
    if (!promoCode && typeof $page.url.searchParams.get('promo') === 'string') {
      const fromUrl = $page.url.searchParams.get('promo')?.trim();
      if (fromUrl) promoCode = fromUrl;
    }
    // Redirect if already logged in
    authStore.subscribe((state) => {
      if (state.isAuthenticated) {
        goto(getReturnUrl());
      }
    });
  });

  async function handleSubmit() {
    error = '';

    if (password !== confirmPassword) {
      error = t('auth.passwordsDoNotMatch');
      return;
    }

    if (password.length < 8) {
      error = t('auth.passwordMinLength');
      return;
    }

    if (!agreedToPrivacy) {
      error = t('auth.agreePrivacyRequired');
      return;
    }

    if (captchaRequired && !captchaToken) {
      error = t('auth.captchaRequired');
      return;
    }

    loading = true;

    try {
      const res = await authStore.register(
        email,
        password,
        firstName,
        lastName,
        promoCode,
        captchaToken
      );
      if (res.requiresEmailVerification) {
        goto(`/verify-email?pending=1&email=${encodeURIComponent(email)}`);
        return;
      }
      goto(getReturnUrl());
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('auth.registrationFailed');
      error = translateError(errorMessage);
      // Reset CAPTCHA on error
      if (captchaRequired && captchaComponent) {
        captchaComponent.reset();
        captchaToken = '';
      }
    } finally {
      loading = false;
    }
  }
</script>

<main class="min-h-screen flex items-center justify-center bg-white py-12">
  <div class="w-full max-w-md px-6">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2 text-black">{t('auth.createAccount')}</h1>
      <p class="text-gray-600">{t('auth.signUpToGetStarted')}</p>
    </div>

    {#if error}
      <div class="mb-6 p-4 bg-red-50 border border-red-200">
        <p class="text-red-600 text-sm">{error}</p>
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="firstName" class="block text-sm font-medium mb-2 text-black"
            >{t('auth.firstName')}</label
          >
          <input
            id="firstName"
            type="text"
            bind:value={firstName}
            class="w-full px-4 py-3 bg-white border border-gray-300 focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-black placeholder:text-gray-400"
            placeholder={t('auth.firstNamePlaceholder')}
          />
        </div>
        <div>
          <label for="lastName" class="block text-sm font-medium mb-2 text-black"
            >{t('auth.lastName')}</label
          >
          <input
            id="lastName"
            type="text"
            bind:value={lastName}
            class="w-full px-4 py-3 bg-white border border-gray-300 focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-black placeholder:text-gray-400"
            placeholder={t('auth.lastNamePlaceholder')}
          />
        </div>
      </div>

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

      <div>
        <label for="password" class="block text-sm font-medium mb-2 text-black"
          >{t('auth.password')}</label
        >
        <input
          id="password"
          type="password"
          bind:value={password}
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

      <div>
        <label for="promoCode" class="block text-sm font-medium mb-2 text-black"
          >{t('auth.promoCode')}</label
        >
        <input
          id="promoCode"
          type="text"
          bind:value={promoCode}
          class="w-full px-4 py-3 bg-white border border-gray-300 focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-black placeholder:text-gray-400 uppercase"
          placeholder={t('auth.promoCodePlaceholder')}
        />
        <p class="mt-1 text-xs text-gray-500">{t('auth.promoCodeRequired')}</p>
      </div>

      <div class="flex items-start gap-3">
        <input
          id="agreePrivacy"
          type="checkbox"
          bind:checked={agreedToPrivacy}
          class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-black focus:ring-black"
        />
        <label for="agreePrivacy" class="text-sm leading-snug text-gray-600">
          {t('auth.agreePrivacyPrefix')}
          <a href="/privacy" class="font-medium text-black underline hover:text-gray-700">
            {t('auth.privacyPolicyLink')}
          </a>
        </label>
      </div>

      {#if captchaRequired}
        <Captcha
          bind:this={captchaComponent}
          required={true}
          onVerify={handleCaptchaVerify}
          onError={handleCaptchaError}
          onExpire={handleCaptchaExpire}
        />
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="w-full py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t('auth.creatingAccount') : t('auth.createAccountButton')}
      </button>
    </form>

    <div class="mt-6">
      <OAuthButtons />
    </div>

    <div class="mt-6 text-center">
      <p class="text-gray-600 text-sm">
        {t('auth.alreadyHaveAccount')}
        <a
          href="/login"
          on:click={(e) => {
            e.preventDefault();
            const returnUrl = getReturnUrl();
            goto(`/login${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`);
          }}
          class="text-black hover:underline ml-1 cursor-pointer transition-colors hover:text-gray-700 font-medium"
        >
          {t('auth.signIn')}
        </a>
      </p>
    </div>
  </div>
</main>
