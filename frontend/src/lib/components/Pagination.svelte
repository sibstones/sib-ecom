<script lang="ts">
  import { t } from '$lib/utils/i18n';
  export let currentPage: number = 1;
  export let totalPages: number = 1;
  export let showViewAll: boolean = false;

  // Emit events for page changes
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  // Calculate which page numbers to show
  $: pageNumbers = getPageNumbers(currentPage, totalPages);

  function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
    if (total <= 7) {
      // Show all pages if 7 or fewer
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    if (current <= 3) {
      // Near the beginning: show 1, 2, 3, ..., last
      pages.push(1, 2, 3);
      if (total > 4) {
        pages.push('ellipsis');
      }
      pages.push(total);
    } else if (current >= total - 2) {
      // Near the end: show 1, ..., last-2, last-1, last
      pages.push(1);
      if (total > 4) {
        pages.push('ellipsis');
      }
      pages.push(total - 2, total - 1, total);
    } else {
      // In the middle: show 1, ..., current-1, current, current+1, ..., last
      pages.push(1);
      pages.push('ellipsis');
      pages.push(current - 1, current, current + 1);
      pages.push('ellipsis');
      pages.push(total);
    }

    return pages;
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      dispatch('pageChange', page);
    }
  }

  function goToPrevious() {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }

  function goToNext() {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }

  function handleViewAll() {
    dispatch('viewAll');
  }
</script>

{#if totalPages > 1}
  <div class="flex items-center gap-2">
    <!-- Previous Button -->
    <button
      on:click={goToPrevious}
      disabled={currentPage <= 1}
      class="px-2 py-1 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      aria-label="Previous page"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fill-rule="evenodd"
          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <!-- Page Numbers -->
    <div class="flex items-center gap-2">
      {#each pageNumbers as page}
        {#if page === 'ellipsis'}
          <span class="px-2 text-black">...</span>
        {:else}
          <button
            on:click={() => goToPage(page)}
            class="px-2 py-1 text-sm text-black hover:underline transition-all {currentPage === page
              ? 'underline'
              : ''}"
            aria-label="Go to page {page}"
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Next Button -->
    <button
      on:click={goToNext}
      disabled={currentPage >= totalPages}
      class="px-2 py-1 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      aria-label="Next page"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fill-rule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <!-- View All Button -->
    {#if showViewAll}
      <button
        on:click={handleViewAll}
        class="px-4 py-1 text-sm text-black hover:underline transition-all ml-2"
        aria-label={t('common.viewAll')}
      >
        {t('common.viewAll')}
      </button>
    {/if}
  </div>
{/if}
