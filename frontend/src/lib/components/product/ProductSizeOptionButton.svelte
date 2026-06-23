<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    getSizeButtonLabel,
    productSizeButtonClass,
    type CustomSizeEntry,
  } from '$lib/utils/size.utils';

  export let size: CustomSizeEntry | string;
  export let selected = false;
  export let idleClass = 'bg-white text-black border border-gray-300 hover:border-gray-800';
  export let selectedClass = 'bg-accent text-dark border-2 border-accent';
  export let buttonClass = 'px-3 py-2 text-sm font-medium transition-colors';

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();
</script>

<button
  type="button"
  class="{productSizeButtonClass} {buttonClass} {selected ? selectedClass : idleClass}"
  on:click={(e) => dispatch('click', e)}
>
  <span class="product-size-option__label">{getSizeButtonLabel(size)}</span>
</button>
