<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.store';

  export let required = false;
  export let onVerify: (token: string) => void = () => {};
  export let onError: (error: string) => void = () => {};
  export let onExpire: () => void = () => {};

  let captchaContainer: HTMLDivElement | null = null;
  let captchaWidgetId: string | number | null = null;
  let isLoaded = false;
  let settings = $settingsStore;
  let captchaToken = '';

  $: captchaEnabled = settings.captchaEnabled;
  $: siteKey = settings.captchaSiteKey;
  $: provider = settings.captchaProvider;

  onMount(async () => {
    await settingsStore.load();

    if (!captchaEnabled || !siteKey) {
      console.warn('CAPTCHA is not configured');
      return;
    }

    await loadCaptchaScript();
  });

  onDestroy(() => {
    if (captchaWidgetId !== null) {
      try {
        if (
          provider === 'GOOGLE_RECAPTCHA_V2' &&
          window.grecaptcha &&
          typeof captchaWidgetId === 'number'
        ) {
          window.grecaptcha.reset(captchaWidgetId);
        } else if (
          provider === 'HCAPTCHA' &&
          window.hcaptcha &&
          typeof captchaWidgetId === 'string'
        ) {
          window.hcaptcha.reset(captchaWidgetId);
        } else if (
          provider === 'CLOUDFLARE_TURNSTILE' &&
          window.turnstile &&
          typeof captchaWidgetId === 'string'
        ) {
          window.turnstile.reset(captchaWidgetId);
        }
      } catch (e) {
        console.error('Error resetting CAPTCHA:', e);
      }
    }
  });

  async function loadCaptchaScript() {
    if (isLoaded) return;

    return new Promise<void>((resolve, reject) => {
      let scriptUrl = '';
      let scriptId = '';

      // Determine script URL and ID based on provider
      switch (provider) {
        case 'GOOGLE_RECAPTCHA_V3':
          scriptUrl = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
          scriptId = 'google-recaptcha-v3';
          break;
        case 'GOOGLE_RECAPTCHA_V2':
          scriptUrl = 'https://www.google.com/recaptcha/api.js';
          scriptId = 'google-recaptcha-v2';
          break;
        case 'HCAPTCHA':
          scriptUrl = 'https://js.hcaptcha.com/1/api.js';
          scriptId = 'hcaptcha';
          break;
        case 'CLOUDFLARE_TURNSTILE':
          scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
          scriptId = 'cloudflare-turnstile';
          break;
        default:
          reject(new Error(`Unsupported CAPTCHA provider: ${provider}`));
          return;
      }

      // Check if script already loaded
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        isLoaded = true;
        initializeCaptcha();
        resolve();
        return;
      }

      // Check if provider-specific API is already available
      if (
        ((provider === 'GOOGLE_RECAPTCHA_V2' || provider === 'GOOGLE_RECAPTCHA_V3') &&
          window.grecaptcha) ||
        (provider === 'HCAPTCHA' && window.hcaptcha) ||
        (provider === 'CLOUDFLARE_TURNSTILE' && window.turnstile)
      ) {
        isLoaded = true;
        initializeCaptcha();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        isLoaded = true;
        // Wait a bit for the API to initialize
        setTimeout(() => {
          initializeCaptcha();
          resolve();
        }, 100);
      };

      script.onerror = () => {
        reject(new Error(`Failed to load CAPTCHA script for ${provider}`));
      };

      document.head.appendChild(script);
    });
  }

  function initializeCaptcha() {
    if (!captchaContainer) return;

    switch (provider) {
      case 'GOOGLE_RECAPTCHA_V3':
        if (!window.grecaptcha) return;
        // reCAPTCHA v3 - invisible, executes automatically
        window.grecaptcha.ready(() => {
          window
            .grecaptcha!.execute(siteKey, { action: 'submit' })
            .then((token: string) => {
              captchaToken = token;
              onVerify(token);
            })
            .catch((error: any) => {
              onError(error.message || 'CAPTCHA verification failed');
            });
        });
        break;

      case 'GOOGLE_RECAPTCHA_V2':
        if (!window.grecaptcha) return;
        // reCAPTCHA v2 - checkbox
        captchaWidgetId = window.grecaptcha.render(captchaContainer, {
          sitekey: siteKey,
          callback: (token: string) => {
            captchaToken = token;
            onVerify(token);
          },
          'error-callback': () => {
            captchaToken = '';
            onError('CAPTCHA error occurred');
          },
          'expired-callback': () => {
            captchaToken = '';
            onExpire();
          },
        });
        break;

      case 'HCAPTCHA':
        if (!window.hcaptcha) return;
        // hCaptcha - checkbox
        captchaWidgetId = window.hcaptcha.render(captchaContainer, {
          sitekey: siteKey,
          callback: (token: string) => {
            captchaToken = token;
            onVerify(token);
          },
          'error-callback': (error: any) => {
            captchaToken = '';
            onError(error?.message || 'CAPTCHA error occurred');
          },
          'expired-callback': () => {
            captchaToken = '';
            onExpire();
          },
        });
        break;

      case 'CLOUDFLARE_TURNSTILE':
        if (!window.turnstile) return;
        // Cloudflare Turnstile - checkbox
        captchaWidgetId = window.turnstile.render(captchaContainer, {
          sitekey: siteKey,
          callback: (token: string) => {
            captchaToken = token;
            onVerify(token);
          },
          'error-callback': () => {
            captchaToken = '';
            onError('CAPTCHA error occurred');
          },
          'expired-callback': () => {
            captchaToken = '';
            onExpire();
          },
        });
        break;
    }
  }

  export function reset() {
    captchaToken = '';

    if (captchaWidgetId === null) return;

    try {
      switch (provider) {
        case 'GOOGLE_RECAPTCHA_V2':
          if (window.grecaptcha && typeof captchaWidgetId === 'number') {
            window.grecaptcha.reset(captchaWidgetId);
          }
          break;
        case 'GOOGLE_RECAPTCHA_V3':
          if (window.grecaptcha) {
            window.grecaptcha.ready(() => {
              window.grecaptcha!.execute(siteKey, { action: 'submit' }).then((token: string) => {
                captchaToken = token;
                onVerify(token);
              });
            });
          }
          break;
        case 'HCAPTCHA':
          if (window.hcaptcha && typeof captchaWidgetId === 'string') {
            window.hcaptcha.reset(captchaWidgetId);
          }
          break;
        case 'CLOUDFLARE_TURNSTILE':
          if (window.turnstile && typeof captchaWidgetId === 'string') {
            window.turnstile.reset(captchaWidgetId);
          }
          break;
      }
    } catch (e) {
      console.error('Error resetting CAPTCHA:', e);
    }
  }

  export function execute() {
    if (provider === 'GOOGLE_RECAPTCHA_V3' && window.grecaptcha) {
      window.grecaptcha.ready(() => {
        window.grecaptcha!.execute(siteKey, { action: 'submit' }).then((token: string) => {
          captchaToken = token;
          onVerify(token);
        });
      });
    } else if (provider === 'HCAPTCHA' && window.hcaptcha && typeof captchaWidgetId === 'string') {
      window.hcaptcha
        .execute(captchaWidgetId, {})
        .then((token: string) => {
          captchaToken = token;
          onVerify(token);
        })
        .catch((error: any) => {
          onError(error?.message || 'CAPTCHA execution failed');
        });
    }
  }

  export function getToken(): string {
    return captchaToken;
  }
</script>

<svelte:window />

{#if captchaEnabled && siteKey}
  {#if provider === 'GOOGLE_RECAPTCHA_V3'}
    <!-- reCAPTCHA v3 is invisible, no UI needed -->
  {:else}
    <!-- Visible CAPTCHA widgets (v2, hCaptcha, Turnstile) -->
    <div bind:this={captchaContainer} class="captcha-container" aria-required={required}></div>
  {/if}
{/if}

<style>
  .captcha-container {
    margin: 1rem 0;
  }
</style>
