<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/utils/i18n';

  /** From date (YYYY-MM-DD) */
  export let dateFrom: string = '';
  /** To date (YYYY-MM-DD) */
  export let dateTo: string = '';
  /** Optional placeholder for "from" input */
  export let placeholderFrom: string = '';
  /** Optional placeholder for "to" input */
  export let placeholderTo: string = '';
  /** Compact single-row layout */
  export let compact: boolean = true;
  /** Tighter min-width for toolbar (avoids horizontal scroll) */
  export let tight: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { dateFrom: string; dateTo: string };
  }>();

  function handleFromInput(e: Event) {
    const target = e.target as HTMLInputElement;
    dateFrom = target.value || '';
    dispatch('change', { dateFrom, dateTo });
  }

  function handleToInput(e: Event) {
    const target = e.target as HTMLInputElement;
    dateTo = target.value || '';
    dispatch('change', { dateFrom, dateTo });
  }

  function clearDates() {
    dateFrom = '';
    dateTo = '';
    dispatch('change', { dateFrom, dateTo });
  }
</script>

<div
  class="date-range-picker flex items-center gap-2 {compact ? 'flex-wrap' : 'flex-col sm:flex-row'}"
>
  <div class="flex items-center gap-2 flex-1 min-w-0">
    <label class="sr-only" for="date-range-from">{t('admin.dateFrom')}</label>
    <input
      id="date-range-from"
      type="date"
      value={dateFrom}
      on:input={handleFromInput}
      placeholder={placeholderFrom || t('admin.dateFrom')}
      class="px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded focus:ring-2 focus:ring-accent focus:border-accent {tight
        ? 'min-w-[100px]'
        : 'min-w-[130px]'}"
      aria-label={t('admin.dateFrom')}
    />
    <span class="text-accent-muted text-sm hidden sm:inline">–</span>
    <label class="sr-only" for="date-range-to">{t('admin.dateTo')}</label>
    <input
      id="date-range-to"
      type="date"
      value={dateTo}
      on:input={handleToInput}
      placeholder={placeholderTo || t('admin.dateTo')}
      class="px-3 py-2 bg-white border border-gray-300 text-black text-sm rounded focus:ring-2 focus:ring-accent focus:border-accent {tight
        ? 'min-w-[100px]'
        : 'min-w-[130px]'}"
      aria-label={t('admin.dateTo')}
    />
  </div>
  {#if dateFrom || dateTo}
    <button
      type="button"
      on:click={clearDates}
      class="px-2 py-1.5 text-sm text-accent-muted hover:text-accent border border-gray-300 hover:border-accent rounded transition-colors whitespace-nowrap"
    >
      {t('admin.clearDates')}
    </button>
  {/if}
</div>
