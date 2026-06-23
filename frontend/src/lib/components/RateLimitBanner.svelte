<script lang="ts">
  import { rateLimitStore } from '$lib/stores/rate-limit.store';
  import { t } from '$lib/utils/i18n';

  function dismiss() {
    rateLimitStore.dismiss();
  }

  function refresh() {
    window.location.reload();
  }
</script>

{#if $rateLimitStore.active}
  <div
    class="rate-limit-banner bg-black text-white px-3 py-3 sm:px-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3 sm:gap-x-4 sm:gap-y-2 text-center text-sm sm:text-left"
    role="alert"
  >
    <div class="flex-1 min-w-0 w-full sm:w-auto">
      <strong class="font-semibold block sm:inline">{t('error.rateLimitTitle')}</strong>
      <span class="block sm:inline sm:ml-1 mt-0.5 sm:mt-0 break-words">
        {t('error.rateLimitMessage', { seconds: $rateLimitStore.retryAfter })}
      </span>
    </div>
    <div
      class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:shrink-0 max-w-xs sm:max-w-none mx-auto sm:mx-0"
    >
      <button
        type="button"
        on:click={refresh}
        class="rate-limit-banner__refresh px-4 py-2.5 sm:px-3 sm:py-1.5 border border-white text-white hover:bg-white hover:text-black transition-colors rounded touch-manipulation min-h-[44px] sm:min-h-0"
      >
        {t('error.rateLimitRefresh')}
      </button>
      <button
        type="button"
        on:click={dismiss}
        class="rate-limit-banner__dismiss px-4 py-2.5 sm:px-3 sm:py-1.5 text-white/90 hover:text-white underline touch-manipulation min-h-[44px] sm:min-h-0"
        aria-label={t('error.rateLimitDismiss')}
      >
        {t('error.rateLimitDismiss')}
      </button>
    </div>
  </div>
{/if}
