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
  import type { FeatureSettings } from '$lib/api/settings.api';
  import type { PageData } from './$types';

  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  let captchaComponent: CaptchaComponent;
  let captchaToken = '';
  export let data: PageData;

  let loginStep: 'credentials' | 'twoFactor' = 'credentials';
  let pendingTwoFactorToken = '';
  let twoFactorCode = '';

  const fallbackThemeSettings: Pick<
    FeatureSettings,
    | 'fontFamily'
    | 'fontSizeBody'
    | 'textTransformUppercase'
    | 'colorBackground'
    | 'colorBackgroundSecondary'
    | 'colorBlack'
  > = {
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontSizeBody: '1rem',
    textTransformUppercase: false,
    colorBackground: '#ffffff',
    colorBackgroundSecondary: '#f9f9f9',
    colorBlack: '#000000',
  };

  $: captchaRequired = $settingsStore.captchaEnabled && $settingsStore.captchaRequiredForLogin;
  $: loginShowcaseImage = data.loginConfig.imageUrl;
  $: loginHeroBadge = data.loginConfig.badge;
  $: loginHeroEyebrow = data.loginConfig.eyebrow;
  $: loginHeroTitle = data.loginConfig.sideTitle;
  $: loginHeroDescription = data.loginConfig.description;
  $: loginTheme = {
    ...fallbackThemeSettings,
    ...(data.themeSettings ?? {}),
  };
  $: loginPageStyle = [
    `font-family: ${loginTheme.fontFamily}`,
    `font-size: ${loginTheme.fontSizeBody}`,
    `text-transform: ${loginTheme.textTransformUppercase ? 'uppercase' : 'none'}`,
    `background-color: ${loginTheme.colorBackground}`,
    `color: ${loginTheme.colorBlack}`,
  ].join('; ');
  $: loginPanelStyle = `background-color: ${loginTheme.colorBackgroundSecondary};`;

  function handleCaptchaVerify(token: string) {
    captchaToken = token;
  }

  function handleCaptchaError(err: string) {
    error = err;
  }

  function handleCaptchaExpire() {
    captchaToken = '';
  }

  // Reactive check for authentication
  $: isAuthenticated = $authStore.isAuthenticated;
  $: if (isAuthenticated) {
    goto(getReturnUrl());
  }

  function getReturnUrl(): string {
    const returnUrl = $page.url.searchParams.get('returnUrl');
    return returnUrl || '/account/profile';
  }

  onMount(() => {
    // Check authentication status on mount
    if ($authStore.isAuthenticated) {
      goto(getReturnUrl());
      return;
    }
  });

  async function handleSubmit() {
    error = '';

    if (loginStep === 'twoFactor') {
      const digits = twoFactorCode.replace(/\D/g, '');
      if (digits.length < 6) {
        error = t('auth.twoFactorInvalidLength');
        return;
      }
      loading = true;
      try {
        const result = await authStore.login(email, password, undefined, {
          token: pendingTwoFactorToken,
          code: digits.slice(0, 8),
        });
        if (result.step === 'done') {
          goto(getReturnUrl());
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : t('auth.loginFailed');
        error = translateError(errorMessage);
      } finally {
        loading = false;
      }
      return;
    }

    if (captchaRequired && !captchaToken) {
      error = t('auth.captchaRequired');
      return;
    }

    loading = true;

    try {
      const result = await authStore.login(email, password, captchaToken);
      if (result.step === 'twoFactor') {
        pendingTwoFactorToken = result.twoFactorToken;
        loginStep = 'twoFactor';
        twoFactorCode = '';
        error = '';
        return;
      }
      goto(getReturnUrl());
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('auth.loginFailed');
      error = translateError(errorMessage);
      if (captchaRequired && captchaComponent) {
        captchaComponent.reset();
        captchaToken = '';
      }
    } finally {
      loading = false;
    }
  }

  function backToCredentials() {
    loginStep = 'credentials';
    pendingTwoFactorToken = '';
    twoFactorCode = '';
    error = '';
  }

  function handleSignUpClick(e: MouseEvent) {
    e.preventDefault();
    const returnUrl = getReturnUrl();
    goto(`/register${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`);
  }
</script>

<main class="min-h-screen bg-[#f3ede6] px-4 py-6 sm:px-6 lg:px-8" style={loginPageStyle}>
  <div
    class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_30px_80px_rgba(27,22,18,0.12)]"
  >
    <section class="relative hidden min-h-full flex-1 overflow-hidden bg-[#1f1a17] lg:flex">
      <img
        src={loginShowcaseImage}
        alt="Editorial preview"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <div
        class="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/35"
      ></div>
      <div class="relative z-10 flex w-full flex-col justify-between p-10 text-white xl:p-14">
        <div
          class="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] backdrop-blur-sm"
        >
          {loginHeroBadge}
        </div>
        <div class="max-w-md space-y-5">
          <p class="text-sm uppercase tracking-[0.35em] text-white/70">{loginHeroEyebrow}</p>
          <h2 class="text-5xl font-semibold leading-[0.95] text-white">
            {loginHeroTitle}
          </h2>
          <p class="max-w-sm text-sm leading-6 text-white/78">
            {loginHeroDescription}
          </p>
        </div>
      </div>
    </section>

    <section
      class="flex w-full items-center justify-center bg-[#fcfaf7] px-6 py-10 sm:px-10 lg:max-w-[540px] lg:px-12 xl:px-16"
      style={loginPanelStyle}
    >
      <div class="w-full max-w-md">
        <div class="mb-8">
          <p class="mb-3 text-xs font-medium uppercase tracking-[0.32em] text-[#8f7563]">
            Welcome back
          </p>
          <h1 class="mb-2 text-4xl font-bold text-black">{t('auth.login')}</h1>
          <p class="text-gray-600">
            {loginStep === 'twoFactor' ? t('auth.twoFactorHint') : t('auth.signInToAccount')}
          </p>
        </div>

        {#if error}
          <div class="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p class="text-sm text-red-600">{error}</p>
          </div>
        {/if}

        <form on:submit|preventDefault={handleSubmit} class="space-y-6">
          {#if loginStep === 'twoFactor'}
            <div
              class="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm"
            >
              {email}
            </div>
            <div>
              <label for="totp" class="mb-2 block text-sm font-medium text-black"
                >{t('auth.twoFactorTitle')}</label
              >
              <input
                id="totp"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="8"
                bind:value={twoFactorCode}
                class="w-full border border-gray-300 bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="000000"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              class="w-full bg-black py-3 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('auth.signingIn') : t('auth.twoFactorVerify')}
            </button>
            <button
              type="button"
              on:click={backToCredentials}
              class="w-full py-2 text-sm text-gray-600 hover:text-black"
            >
              {t('auth.twoFactorBack')}
            </button>
          {:else}
            <div>
              <label for="email" class="mb-2 block text-sm font-medium text-black"
                >{t('auth.email')}</label
              >
              <input
                id="email"
                type="email"
                bind:value={email}
                required
                class="w-full border border-gray-300 bg-white px-4 py-3 text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>

            <div>
              <label for="password" class="mb-2 block text-sm font-medium text-black"
                >{t('auth.password')}</label
              >
              <input
                id="password"
                type="password"
                bind:value={password}
                required
                class="w-full border border-gray-300 bg-white px-4 py-3 text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder={t('auth.passwordPlaceholder')}
              />
              <div class="mt-2 text-right">
                <a
                  href="/forgot-password?returnUrl={encodeURIComponent(
                    getReturnUrl() !== '/account/profile'
                      ? `/login?returnUrl=${encodeURIComponent(getReturnUrl())}`
                      : '/login'
                  )}"
                  class="text-sm text-gray-600 transition-colors hover:text-black"
                >
                  {t('auth.forgotPassword')}
                </a>
              </div>
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
              class="w-full bg-black py-3 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          {/if}
        </form>

        {#if loginStep === 'credentials'}
          <div class="mt-6">
            <OAuthButtons />
          </div>
        {/if}

        <div class="mt-6 text-center">
          <span class="text-sm text-gray-600">
            {t('auth.dontHaveAccount')}
          </span>
          <a
            href="/register"
            on:click={handleSignUpClick}
            class="ml-1 cursor-pointer text-sm font-medium text-black transition-colors hover:text-gray-700 hover:underline"
          >
            {t('auth.signUp')}
          </a>
        </div>
      </div>
    </section>
  </div>
</main>
