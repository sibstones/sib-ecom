<script lang="ts">
  import { currencyStore, enabledCurrenciesStore } from '$lib/stores/currency.store';
  import { syncCountryCodeForCurrency } from '$lib/utils/locale-preferences';
  import CustomSelect from './CustomSelect.svelte';

  let currentCurrency = $currencyStore;
  let enabledCurrencies = $enabledCurrenciesStore;

  $: currencyOptions = enabledCurrencies.map((currency) => ({
    value: currency,
    label: currency,
  }));

  async function changeCurrency(event: CustomEvent<{ value: string | number }>) {
    const next = String(event.detail.value);
    currencyStore.setCurrency(next);
    currentCurrency = next;
    await syncCountryCodeForCurrency(next);
  }
</script>

<CustomSelect
  bind:value={currentCurrency}
  options={currencyOptions}
  size="sm"
  on:change={changeCurrency}
/>
