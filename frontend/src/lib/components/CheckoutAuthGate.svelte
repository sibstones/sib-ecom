<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import { settingsStore } from '$lib/stores/settings.store';
  import { t, translateError } from '$lib/utils/i18n';
  import Captcha from '$lib/components/Captcha.svelte';
  import type CaptchaComponent from '$lib/components/Captcha.svelte';

  export let mode: 'login' | 'register' = 'login';

  const dispatch = createEventDispatcher<{ authenticated: void }>();

  let email = '';
  let password = '';
  let confirmPassword = '';
  let firstName = '';
  let lastName = '';
  let promoCode = '';
  let error = '';
  let loading = false;
  let loginCaptchaRef: CaptchaComponent;
  let registerCaptchaRef: CaptchaComponent;
  let loginCaptchaToken = '';
  let registerCaptchaToken = '';

  $: captchaRequiredLogin = $settingsStore.captchaEnabled && $settingsStore.captchaRequiredForLogin;
  $: captchaRequiredRegister =
    $settingsStore.captchaEnabled && $settingsStore.captchaRequiredForRegistration;

  function onLoginCaptchaVerify(token: string) {
    loginCaptchaToken = token;
  }
  function onLoginCaptchaError(err: string) {
    error = err;
  }
  function onLoginCaptchaExpire() {
    loginCaptchaToken = '';
  }
  function onRegisterCaptchaVerify(token: string) {
    registerCaptchaToken = token;
  }
  function onRegisterCaptchaError(err: string) {
    error = err;
  }
  function onRegisterCaptchaExpire() {
    registerCaptchaToken = '';
  }

  async function handleLogin(e: Event) {
    e.preventDefault();
    error = '';
    if (captchaRequiredLogin && !loginCaptchaToken) {
      error = t('auth.captchaRequired');
      return;
    }
    loading = true;
    try {
      const result = await authStore.login(email, password, loginCaptchaToken);
      if (result.step === 'twoFactor') {
        error = t('auth.twoFactorUseFullLogin');
        return;
      }
      dispatch('authenticated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.loginFailed');
      error = translateError(msg);
      if (captchaRequiredLogin && loginCaptchaRef) {
        loginCaptchaRef.reset();
        loginCaptchaToken = '';
      }
    } finally {
      loading = false;
    }
  }

  async function handleRegister(e: Event) {
    e.preventDefault();
    error = '';
    if (password !== confirmPassword) {
      error = t('auth.passwordsDoNotMatch');
      return;
    }
    if (password.length < 8) {
      error = t('auth.passwordMinLength');
      return;
    }
    if (captchaRequiredRegister && !registerCaptchaToken) {
      error = t('auth.captchaRequired');
      return;
    }
    loading = true;
    try {
      const res = await authStore.register(
        email,
        password,
        firstName || undefined,
        lastName || undefined,
        promoCode ? promoCode.toUpperCase().trim() : undefined,
        registerCaptchaToken
      );
      if (res.requiresEmailVerification) {
        error = t('auth.checkEmailToVerifyCheckout');
        return;
      }
      dispatch('authenticated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.registrationFailed');
      error = translateError(msg);
      if (captchaRequiredRegister && registerCaptchaRef) {
        registerCaptchaRef.reset();
        registerCaptchaToken = '';
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="bg-white border border-gray-200 p-6">
  <h2 class="text-xl font-bold mb-4 text-black">{t('checkout.loginOrRegister')}</h2>
  <p class="text-gray-600 text-sm mb-4">{t('checkout.loginToProceed')}</p>

  <div class="flex border-b border-gray-200 mb-4">
    <button
      type="button"
      class="px-4 py-2 text-sm font-medium transition-colors {mode === 'login'
        ? 'text-black border-b-2 border-black'
        : 'text-gray-500 hover:text-black'}"
      on:click={() => (mode = 'login')}
    >
      {t('auth.login')}
    </button>
    <button
      type="button"
      class="px-4 py-2 text-sm font-medium transition-colors {mode === 'register'
        ? 'text-black border-b-2 border-black'
        : 'text-gray-500 hover:text-black'}"
      on:click={() => (mode = 'register')}
    >
      {t('checkout.registerAtCheckout')}
    </button>
  </div>

  {#if error}
    <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded">
      <p class="text-red-600 text-sm">{error}</p>
    </div>
  {/if}

  {#if mode === 'login'}
    <form on:submit|preventDefault={handleLogin} class="space-y-4">
      <div>
        <label for="checkout-email" class="block text-sm font-medium mb-1 text-black"
          >{t('auth.email')}</label
        >
        <input
          id="checkout-email"
          type="email"
          bind:value={email}
          required
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
          placeholder={t('auth.emailPlaceholder')}
        />
      </div>
      <div>
        <label for="checkout-password" class="block text-sm font-medium mb-1 text-black"
          >{t('auth.password')}</label
        >
        <input
          id="checkout-password"
          type="password"
          bind:value={password}
          required
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
          placeholder={t('auth.passwordPlaceholder')}
        />
        <div class="mt-1 text-right">
          <a
            href="/forgot-password?returnUrl=%2Fcheckout"
            class="text-xs text-gray-600 hover:text-black transition-colors"
            >{t('auth.forgotPassword')}</a
          >
        </div>
      </div>
      {#if captchaRequiredLogin}
        <Captcha
          bind:this={loginCaptchaRef}
          required={true}
          onVerify={onLoginCaptchaVerify}
          onError={onLoginCaptchaError}
          onExpire={onLoginCaptchaExpire}
        />
      {/if}
      <button
        type="submit"
        disabled={loading}
        class="w-full py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t('auth.signingIn') : t('auth.signIn')}
      </button>
    </form>
  {:else}
    <form on:submit|preventDefault={handleRegister} class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="checkout-firstName" class="block text-sm font-medium mb-1 text-black"
            >{t('auth.firstName')}</label
          >
          <input
            id="checkout-firstName"
            type="text"
            bind:value={firstName}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
            placeholder={t('auth.firstNamePlaceholder')}
          />
        </div>
        <div>
          <label for="checkout-lastName" class="block text-sm font-medium mb-1 text-black"
            >{t('auth.lastName')}</label
          >
          <input
            id="checkout-lastName"
            type="text"
            bind:value={lastName}
            class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
            placeholder={t('auth.lastNamePlaceholder')}
          />
        </div>
      </div>
      <div>
        <label for="checkout-reg-email" class="block text-sm font-medium mb-1 text-black"
          >{t('auth.email')}</label
        >
        <input
          id="checkout-reg-email"
          type="email"
          bind:value={email}
          required
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
          placeholder={t('auth.emailPlaceholder')}
        />
      </div>
      <div>
        <label for="checkout-reg-password" class="block text-sm font-medium mb-1 text-black"
          >{t('auth.password')}</label
        >
        <input
          id="checkout-reg-password"
          type="password"
          bind:value={password}
          required
          minlength="8"
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
          placeholder={t('auth.passwordPlaceholder')}
        />
        <p class="mt-0.5 text-xs text-gray-500">{t('auth.passwordAtLeast8')}</p>
      </div>
      <div>
        <label for="checkout-confirmPassword" class="block text-sm font-medium mb-1 text-black"
          >{t('auth.confirmPassword')}</label
        >
        <input
          id="checkout-confirmPassword"
          type="password"
          bind:value={confirmPassword}
          required
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black"
          placeholder={t('auth.passwordPlaceholder')}
        />
      </div>
      <div>
        <label for="checkout-promo" class="block text-sm font-medium mb-1 text-black"
          >{t('auth.promoCode')}</label
        >
        <input
          id="checkout-promo"
          type="text"
          bind:value={promoCode}
          class="w-full px-4 py-2 bg-white border border-gray-300 text-black placeholder:text-gray-400 focus:outline-none focus:border-black uppercase"
          placeholder={t('auth.promoCodePlaceholder')}
        />
      </div>
      {#if captchaRequiredRegister}
        <Captcha
          bind:this={registerCaptchaRef}
          required={true}
          onVerify={onRegisterCaptchaVerify}
          onError={onRegisterCaptchaError}
          onExpire={onRegisterCaptchaExpire}
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
  {/if}
</div>
