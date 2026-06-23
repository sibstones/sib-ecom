<script lang="ts">
  import { onMount } from 'svelte';
  import { authApi } from '$lib/api/auth.api';
  import { authStore } from '$lib/stores/auth.store';
  import { t } from '$lib/utils/i18n';
  import LoadingBar from '$lib/components/LoadingBar.svelte';
  import { notificationStore } from '$lib/stores/notification.store';

  let user = $authStore.user;
  let loading = false;
  let error = '';
  let success = '';

  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let changingPassword = false;

  let twoFaQr: string | null = null;
  let twoFaBusy = false;
  let twoFaSetupCode = '';
  let twoFaDisablePassword = '';
  let twoFaDisableCode = '';

  onMount(async () => {
    await loadUser();
  });

  async function loadUser() {
    try {
      loading = true;
      await authStore.checkAuth();
      user = $authStore.user;
      error = '';
    } catch (e: any) {
      error = e.message || t('profile.failedToLoadUser');
      notificationStore.error(t('profile.failedToLoadUser'));
    } finally {
      loading = false;
    }
  }

  async function changePassword() {
    if (!newPassword || !currentPassword) {
      error = t('profile.fillAllPasswordFields');
      notificationStore.error(t('profile.fillAllPasswordFields'));
      return;
    }

    if (newPassword.length < 8) {
      error = t('profile.passwordMinLength');
      notificationStore.error(t('profile.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      error = t('profile.passwordMismatch');
      notificationStore.error(t('profile.passwordMismatch'));
      return;
    }

    changingPassword = true;
    error = '';
    success = '';

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      success = t('profile.passwordChanged');
      notificationStore.success(t('profile.passwordChanged'));
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (e: any) {
      error = e.message || t('profile.failedToChangePassword');
      notificationStore.error(t('profile.failedToChangePassword'));
    } finally {
      changingPassword = false;
    }
  }

  async function startTwoFaSetup() {
    twoFaBusy = true;
    error = '';
    try {
      const { qrDataUrl } = await authApi.twoFaSetupStart();
      twoFaQr = qrDataUrl;
      twoFaSetupCode = '';
      await loadUser();
    } catch (e: any) {
      error = e.message || t('profile.twoFaStartFailed');
      notificationStore.error(t('profile.twoFaStartFailed'));
    } finally {
      twoFaBusy = false;
    }
  }

  async function confirmTwoFaSetup() {
    const digits = twoFaSetupCode.replace(/\D/g, '');
    if (digits.length < 6) {
      notificationStore.error(t('auth.twoFactorInvalidLength'));
      return;
    }
    twoFaBusy = true;
    error = '';
    try {
      await authApi.twoFaSetupConfirm(digits.slice(0, 8));
      twoFaQr = null;
      twoFaSetupCode = '';
      await loadUser();
      notificationStore.success(t('profile.twoFaEnabled'));
    } catch (e: any) {
      error = e.message || t('profile.twoFaConfirmFailed');
      notificationStore.error(t('profile.twoFaConfirmFailed'));
    } finally {
      twoFaBusy = false;
    }
  }

  async function cancelTwoFaSetup() {
    twoFaBusy = true;
    try {
      await authApi.twoFaSetupCancel();
      twoFaQr = null;
      twoFaSetupCode = '';
      await loadUser();
    } catch (e: any) {
      error = e.message || t('profile.twoFaCancelFailed');
    } finally {
      twoFaBusy = false;
    }
  }

  async function disableTwoFa() {
    const d = twoFaDisableCode.replace(/\D/g, '');
    if (!twoFaDisablePassword || d.length < 6) {
      notificationStore.error(t('profile.twoFaDisableNeedFields'));
      return;
    }
    twoFaBusy = true;
    error = '';
    try {
      await authApi.twoFaDisable(twoFaDisablePassword, d.slice(0, 8));
      twoFaDisablePassword = '';
      twoFaDisableCode = '';
      await loadUser();
      notificationStore.success(t('profile.twoFaDisabled'));
    } catch (e: any) {
      error = e.message || t('profile.twoFaDisableFailed');
      notificationStore.error(t('profile.twoFaDisableFailed'));
    } finally {
      twoFaBusy = false;
    }
  }
</script>

<div>
  <h2 class="text-2xl font-bold mb-6">{t('profile.myProfile')}</h2>

  {#if error}
    <div class="mb-4 p-4 bg-red-50 border border-red-200 text-red-700">
      {error}
    </div>
  {/if}

  {#if success}
    <div class="mb-4 p-4 bg-green-50 border border-green-200 text-green-700">
      {success}
    </div>
  {/if}

  {#if user}
    <div class="space-y-6">
      <!-- User Info -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-semibold mb-4">{t('profile.accountInformation')}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="block text-sm font-medium mb-1">{t('common.email')}</p>
            <p class="text-gray-700">{user.email}</p>
          </div>
          <div>
            <p class="block text-sm font-medium mb-1">{t('profile.role')}</p>
            <p class="text-gray-700">
              <span class="px-2 py-1 bg-blue-100 text-xs">
                {user.role}
              </span>
            </p>
          </div>
          {#if user.firstName || user.lastName}
            <div>
              <p class="block text-sm font-medium mb-1">{t('common.name')}</p>
              <p class="text-gray-700">
                {user.firstName || ''}
                {user.lastName || ''}
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Change Password -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-semibold mb-4">{t('profile.changePassword')}</h3>
        <p class="text-sm text-gray-600 mb-4">
          {t('profile.changePasswordDescription')}
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="currentPassword" class="block text-sm font-medium mb-1"
              >{t('profile.currentPassword')}</label
            >
            <input
              id="currentPassword"
              type="password"
              bind:value={currentPassword}
              class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
              placeholder={t('profile.enterCurrentPassword')}
            />
          </div>
          <div>
            <label for="newPassword" class="block text-sm font-medium mb-1"
              >{t('profile.newPassword')}</label
            >
            <input
              id="newPassword"
              type="password"
              bind:value={newPassword}
              class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
              placeholder={t('profile.enterNewPassword')}
            />
          </div>
          <div>
            <label for="confirmPassword" class="block text-sm font-medium mb-1"
              >{t('profile.confirmNewPassword')}</label
            >
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
              placeholder={t('profile.confirmNewPasswordPlaceholder')}
            />
          </div>
        </div>
        <div class="mt-4">
          <button
            on:click={changePassword}
            disabled={changingPassword}
            class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted transition-colors disabled:opacity-50"
          >
            {changingPassword ? t('profile.changing') : t('profile.changePassword')}
          </button>
        </div>
      </div>

      <!-- Two-factor authentication -->
      <div class="bg-dark-light p-6">
        <h3 class="text-xl font-semibold mb-2">{t('profile.twoFaTitle')}</h3>
        <p class="text-sm text-gray-600 mb-4">{t('profile.twoFaDescription')}</p>

        {#if user.passwordLoginAvailable === false}
          <p class="text-sm text-gray-600">{t('profile.twoFaPasswordOnly')}</p>
        {:else if user.twoFactorEnabled}
          <p class="text-sm text-green-800 mb-4">{t('profile.twoFaOn')}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label for="twoFaDisablePassword" class="block text-sm font-medium mb-1"
                >{t('profile.currentPassword')}</label
              >
              <input
                id="twoFaDisablePassword"
                type="password"
                bind:value={twoFaDisablePassword}
                class="w-full px-3 py-2 border border-gray-300 bg-white text-dark"
                autocomplete="current-password"
              />
            </div>
            <div>
              <label for="twoFaDisableCode" class="block text-sm font-medium mb-1"
                >{t('auth.twoFactorTitle')}</label
              >
              <input
                id="twoFaDisableCode"
                type="text"
                inputmode="numeric"
                maxlength="8"
                bind:value={twoFaDisableCode}
                class="w-full px-3 py-2 border border-gray-300 bg-white text-dark font-mono tracking-widest"
                placeholder="000000"
              />
            </div>
          </div>
          <button
            type="button"
            class="mt-4 px-4 py-2 border border-gray-400 text-dark hover:bg-gray-100 transition-colors disabled:opacity-50"
            disabled={twoFaBusy}
            on:click={disableTwoFa}
          >
            {twoFaBusy ? t('profile.changing') : t('profile.twoFaTurnOff')}
          </button>
        {:else if user.twoFactorSetupPending || twoFaQr}
          <p class="text-sm mb-3">{t('profile.twoFaFinishSetup')}</p>
          {#if twoFaQr}
            <img src={twoFaQr} alt="" class="w-44 h-44 mb-4 border border-gray-200 bg-white p-2" />
          {/if}
          <div class="max-w-xs mb-3">
            <label for="twoFaSetupCode" class="block text-sm font-medium mb-1"
              >{t('auth.twoFactorTitle')}</label
            >
            <input
              id="twoFaSetupCode"
              type="text"
              inputmode="numeric"
              maxlength="8"
              bind:value={twoFaSetupCode}
              class="w-full px-3 py-2 border border-gray-300 bg-white text-dark font-mono tracking-widest"
              placeholder="000000"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-4 py-2 bg-accent text-dark hover:bg-accent-muted disabled:opacity-50"
              disabled={twoFaBusy}
              on:click={confirmTwoFaSetup}
            >
              {t('profile.twoFaConfirmEnable')}
            </button>
            <button
              type="button"
              class="px-4 py-2 border border-gray-400 text-dark hover:bg-gray-100 disabled:opacity-50"
              disabled={twoFaBusy}
              on:click={cancelTwoFaSetup}
            >
              {t('profile.cancel')}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-600 hover:text-dark underline disabled:opacity-50"
              disabled={twoFaBusy}
              on:click={startTwoFaSetup}
            >
              {t('profile.twoFaNewQr')}
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            disabled={twoFaBusy}
            on:click={startTwoFaSetup}
          >
            {t('profile.twoFaTurnOn')}
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <div class="w-full py-8"><LoadingBar /></div>
  {/if}
</div>
