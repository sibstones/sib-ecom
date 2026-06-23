<script lang="ts">
  import { LOOKBOOK_SEASONS, LOOKBOOK_SEASON_I18N } from '$lib/constants/lookbook-seasons';
  import { t } from '$lib/utils/i18n';

  export let id = 'lookbookSeason';
  export let value = '';
  export let selectClass = 'w-full px-4 py-2 bg-white border border-gray-300 text-black';
</script>

<select {id} bind:value class={selectClass}>
  <option value="">{t('lookbook.selectSeason')}</option>
  {#each LOOKBOOK_SEASONS as season}
    <option value={season}>{t(LOOKBOOK_SEASON_I18N[season])}</option>
  {/each}
</select>
