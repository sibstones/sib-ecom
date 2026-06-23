<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.store';
  import { apiClient } from '$lib/api/client';
  import { getErrorMessage } from '$lib/utils/error-handler';

  let loading = true;
  let error = '';

  function getReturnUrl(): string {
    const returnUrl = $page.url.searchParams.get('returnUrl');
    return returnUrl || '/account/profile';
  }

  onMount(async () => {
    const provider = $page.params.provider?.toUpperCase();
    const code = $page.url.searchParams.get('code');
    const state = $page.url.searchParams.get('state');
    const redirectUri = `${window.location.origin}${$page.url.pathname}`;

    if (!code) {
      error = 'Authorization code is missing';
      loading = false;
      return;
    }

    if (!provider) {
      error = 'OAuth provider is missing';
      loading = false;
      return;
    }
    if (!state) {
      error = 'OAuth state is missing';
      loading = false;
      return;
    }

    try {
      const result = await apiClient.get<{
        user: any;
      }>(
        `/auth/oauth/${provider}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&redirectUri=${encodeURIComponent(redirectUri)}`
      );

      // Store auth data
      authStore.setAuthData({
        user: result.user,
      });

      // Redirect to return URL
      goto(getReturnUrl());
    } catch (e) {
      error = getErrorMessage(e, 'auth.oauthAuthenticationFailed');
      loading = false;
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-white">
  <div class="text-center">
    {#if loading}
      <div class="mb-4">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
      <p class="text-gray-600">Completing login...</p>
    {:else if error}
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded">
        <p class="text-red-600">{error}</p>
      </div>
      <a href="/login" class="text-black hover:underline">Return to login</a>
    {/if}
  </div>
</div>
