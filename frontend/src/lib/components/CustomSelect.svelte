<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: string | number = '';
  export let options: Array<{ value: string | number; label: string }> = [];
  export let placeholder: string = 'Select...';
  export let disabled: boolean = false;
  export let className: string = '';
  export let id: string | undefined = undefined;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let searchable: boolean = false;
  export let searchThreshold: number = 5; // Show search if options count >= this
  /** When true, button width fits selected label only (no horizontal stretch). */
  export let fitContent: boolean = false;
  export let ariaLabel: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ change: { value: string | number } }>();

  let isOpen = false;
  let selectedLabel = '';
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let buttonElement: HTMLButtonElement;
  let dropdownElement: HTMLDivElement;
  let dropdownPosition = { top: 0, left: 0, width: 0 };

  $: {
    const selected = options.find((opt) => opt.value === value);
    selectedLabel = selected ? selected.label : placeholder;
  }

  $: showSearch = (searchable || options.length >= searchThreshold) && options.length > 0;

  $: filteredOptions =
    showSearch && searchQuery
      ? options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : options;

  // fitContent: width by selected text; otherwise — by the longest item (without jumps)
  $: minButtonWidth = fitContent
    ? Math.max(72, selectedLabel.length * 7 + 80)
    : options.length > 0
      ? Math.max(160, Math.max(...options.map((opt) => opt.label.length)) * 7 + 80)
      : 160;

  function updateDropdownPosition() {
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownMinWidth = 180;
      dropdownPosition = {
        top: rect.bottom + 4,
        left: rect.left,
        width: fitContent ? Math.max(rect.width, dropdownMinWidth) : rect.width,
      };
    }
  }

  function toggleDropdown() {
    if (!disabled) {
      isOpen = !isOpen;
      if (isOpen) {
        updateDropdownPosition();
        if (showSearch && searchInput) {
          setTimeout(() => searchInput.focus(), 0);
        }
      }
    }
  }

  function selectOption(option: { value: string | number; label: string }) {
    value = option.value;
    isOpen = false;
    searchQuery = '';
    dispatch('change', { value: option.value });
  }

  function handleClickOutside(node: HTMLElement) {
    const handleClick = (event: MouseEvent) => {
      if (
        node &&
        !node.contains(event.target as Node) &&
        dropdownElement &&
        !dropdownElement.contains(event.target as Node)
      ) {
        isOpen = false;
        searchQuery = '';
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    const handleResize = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      },
    };
  }

  function handleSearchInput(event: Event) {
    event.stopPropagation();
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
</script>

<div
  class="relative {className}"
  use:handleClickOutside
  role="combobox"
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  aria-controls="custom-select-listbox"
>
  <button
    bind:this={buttonElement}
    type="button"
    {id}
    class="{fitContent ? 'w-auto' : 'w-full'} {sizeClasses[
      size
    ]} bg-white border border-gray-300 text-black flex items-center justify-between hover:border-black focus:outline-none focus:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
    style="min-width: {minButtonWidth}px;"
    on:click={toggleDropdown}
    {disabled}
    aria-label={ariaLabel || selectedLabel}
  >
    <span class="truncate {value === '' ? 'text-gray-500' : ''}">
      {selectedLabel}
    </span>
    <svg
      class="ml-2 h-4 w-4 text-gray-600 transition-transform {isOpen ? 'rotate-180' : ''}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if isOpen}
    <div
      bind:this={dropdownElement}
      id="custom-select-listbox"
      class="bg-white border border-gray-300 shadow-xl max-h-60 overflow-hidden flex flex-col custom-select-dropdown"
      role="listbox"
      style="position: fixed; top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px; z-index: 99999;"
    >
      {#if showSearch}
        <div class="p-2 border-b border-gray-200">
          <input
            bind:this={searchInput}
            type="text"
            bind:value={searchQuery}
            on:input={handleSearchInput}
            on:click={handleSearchInput}
            placeholder="Search..."
            class="w-full px-3 py-1.5 bg-white border border-gray-300 text-black text-sm focus:outline-none focus:border-black"
          />
        </div>
      {/if}
      <div class="overflow-auto flex-1">
        {#if filteredOptions.length === 0}
          <div class="px-4 py-2 text-gray-500 text-sm text-center">No results found</div>
        {:else}
          {#each filteredOptions as option (option.value)}
            <button
              type="button"
              class="w-full text-left {sizeClasses[
                size
              ]} text-black hover:bg-gray-100 transition-colors {value === option.value
                ? 'bg-black text-white'
                : ''}"
              on:click={() => selectOption(option)}
              role="option"
              aria-selected={value === option.value}
            >
              {option.label}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.custom-select-dropdown) {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
  }

  :global(.custom-select-dropdown::-webkit-scrollbar) {
    width: 6px;
  }

  :global(.custom-select-dropdown::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.custom-select-dropdown::-webkit-scrollbar-thumb) {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
</style>
