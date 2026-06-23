<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/utils/i18n';

  const dispatch = createEventDispatcher<{ change: string }>();

  export let value = '';
  export let enabled = false;
  export let html = false;
  export let tag = 'div';
  export let className = '';
  export let placeholder = '';
  export let style: string | undefined = undefined;

  let element: HTMLElement | null = null;
  let isFocused = false;

  function getCurrentValue() {
    if (!element) return value;
    return html ? element.innerHTML : element.textContent || '';
  }

  function syncValue() {
    if (!element || isFocused) return;
    const nextValue = value || '';
    if (html) {
      if (element.innerHTML !== nextValue) {
        element.innerHTML = nextValue;
      }
      return;
    }
    if ((element.textContent || '') !== nextValue) {
      element.textContent = nextValue;
    }
  }

  function emitChange() {
    dispatch('change', getCurrentValue());
  }

  function handleFocus() {
    isFocused = true;
  }

  function handleBlur() {
    isFocused = false;
    emitChange();
    syncValue();
  }

  $: syncValue();
</script>

<svelte:element
  this={tag}
  bind:this={element}
  class={`${className} ${enabled ? 'homepage-inline-editable is-editing' : ''}`}
  {style}
  contenteditable={enabled}
  spellcheck={enabled}
  tabindex={enabled ? 0 : undefined}
  role={enabled ? 'textbox' : undefined}
  data-placeholder={enabled ? placeholder || t('homepage.editor.clickToEdit') : undefined}
  on:input={emitChange}
  on:focus={handleFocus}
  on:blur={handleBlur}
>
  {#if html}
    {@html value}
  {:else}
    {value}
  {/if}
</svelte:element>

<style>
  :global(.homepage-inline-editable.is-editing) {
    min-height: 1em;
    outline: none;
    transition:
      box-shadow 0.2s ease,
      background-color 0.2s ease;
  }

  :global(.homepage-inline-editable.is-editing:hover) {
    background: rgba(255, 255, 255, 0.18);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45);
  }

  :global(.homepage-inline-editable.is-editing:focus) {
    background: rgba(255, 255, 255, 0.24);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
  }

  :global(.homepage-inline-editable.is-editing:empty::before) {
    content: attr(data-placeholder);
    color: rgba(17, 24, 39, 0.45);
  }
</style>
