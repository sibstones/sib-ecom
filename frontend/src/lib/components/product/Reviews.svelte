<script lang="ts">
  import { onMount } from 'svelte';
  import { reviewApi, type ProductReview, type ReviewStats } from '$lib/api/review.api';
  import { t } from '$lib/utils/i18n';
  import { authStore } from '$lib/stores/auth.store';
  import { settingsStore } from '$lib/stores/settings.store';

  export let productId: string;

  let reviews: ProductReview[] = [];
  let stats: ReviewStats | null = null;
  let loading = true;
  let currentPage = 1;
  let totalPages = 1;
  let showReviewForm = false;

  let newReview = {
    rating: 5,
    title: '',
    comment: '',
  };

  $: reviewsEnabled = $settingsStore.reviewsEnabled;

  onMount(async () => {
    if (reviewsEnabled) {
      await Promise.all([loadReviews(), loadStats()]);
    }
  });

  async function loadReviews() {
    loading = true;
    try {
      const response = await reviewApi.getByProduct(productId, currentPage, 10);
      reviews = response.reviews;
      totalPages = response.pagination.totalPages;
    } catch (e) {
      console.error('Failed to load reviews:', e);
    } finally {
      loading = false;
    }
  }

  async function loadStats() {
    try {
      const response = await reviewApi.getProductStats(productId);
      stats = response.stats;
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }

  async function submitReview() {
    if (!$authStore.isAuthenticated) {
      alert(t('productReview.loginRequired'));
      return;
    }

    try {
      await reviewApi.create({
        productId,
        rating: newReview.rating,
        title: newReview.title,
        comment: newReview.comment,
      });
      newReview = { rating: 5, title: '', comment: '' };
      showReviewForm = false;
      await Promise.all([loadReviews(), loadStats()]);
      alert(t('productReview.submitted'));
    } catch (e) {
      alert(e instanceof Error ? e.message : t('productReview.failedToSubmit'));
    }
  }

  function renderStars(rating: number, filled: boolean = true) {
    return Array(5)
      .fill(0)
      .map((_, i) => {
        if (filled) {
          return i < rating ? '★' : '☆';
        } else {
          return '☆';
        }
      });
  }
</script>

{#if reviewsEnabled}
  <div class="mt-12">
    {#if stats}
      <div class="bg-white p-8 mb-8">
        <div class="flex items-start gap-12">
          <!-- Average Rating Section -->
          <div class="text-center">
            <p class="text-6xl font-bold text-black mb-3">{stats.averageRating.toFixed(1)}</p>
            <div class="text-2xl text-gray-400 mb-3 tracking-wider">
              {renderStars(0, false).join('')}
            </div>
            <p class="text-xs text-gray-500 uppercase tracking-wide">
              Based on {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
            </p>
          </div>

          <!-- Star Distribution -->
          <div class="flex-1 space-y-2.5">
            {#each [5, 4, 3, 2, 1] as rating}
              <div class="flex items-center gap-3">
                <span class="text-sm text-black w-8">{rating}★</span>
                <div class="flex-1 h-1.5 bg-gray-200 overflow-hidden">
                  <div
                    class="h-full bg-gray-300 transition-all duration-300"
                    style="width: {stats.totalReviews > 0 && stats.ratingDistribution[rating]
                      ? (stats.ratingDistribution[rating] / stats.totalReviews) * 100
                      : 0}%"
                  ></div>
                </div>
                <span class="text-sm text-gray-500 w-8 text-right">
                  {stats.ratingDistribution[rating] || 0}
                </span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if $authStore.isAuthenticated && !showReviewForm}
      <button
        on:click={() => (showReviewForm = true)}
        class="mb-8 px-6 py-2.5 bg-black text-white hover:bg-gray-800 transition-colors text-sm uppercase tracking-wide"
      >
        {t('productReview.writeReview')}
      </button>
    {/if}

    {#if showReviewForm}
      <div class="bg-white p-8 mb-8">
        <h3 class="text-lg font-medium mb-6 text-black">{t('productReview.writeReview')}</h3>
        <form on:submit|preventDefault={submitReview} class="space-y-5">
          <fieldset>
            <legend class="block text-sm font-medium mb-3 text-black">Rating</legend>
            <div class="flex gap-2">
              {#each [1, 2, 3, 4, 5] as rating}
                <button
                  type="button"
                  on:click={() => (newReview.rating = rating)}
                  class="text-3xl {newReview.rating >= rating
                    ? 'text-black'
                    : 'text-gray-300'} hover:text-gray-600 transition-colors"
                  aria-label="Rating {rating} stars"
                >
                  ★
                </button>
              {/each}
            </div>
          </fieldset>
          <div>
            <label for="review-title" class="block text-sm font-medium mb-2 text-black"
              >{t('productReview.titleOptional')}</label
            >
            <input
              id="review-title"
              type="text"
              bind:value={newReview.title}
              class="w-full px-4 py-2.5 bg-white border border-gray-300 text-black focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label for="review-comment" class="block text-sm font-medium mb-2 text-black"
              >Comment</label
            >
            <textarea
              id="review-comment"
              bind:value={newReview.comment}
              rows="4"
              class="w-full px-4 py-2.5 bg-white border border-gray-300 text-black focus:outline-none focus:border-black transition-colors resize-none"
            ></textarea>
          </div>
          <div class="flex gap-4">
            <button
              type="submit"
              class="px-6 py-2.5 bg-black text-white hover:bg-gray-800 transition-colors text-sm uppercase tracking-wide"
            >
              Submit Review
            </button>
            <button
              type="button"
              on:click={() => {
                showReviewForm = false;
                newReview = { rating: 5, title: '', comment: '' };
              }}
              class="px-6 py-2.5 bg-white border border-gray-300 text-black hover:bg-gray-50 transition-colors text-sm uppercase tracking-wide"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    {/if}

    {#if loading}
      <p class="text-gray-500 text-sm">{t('productReview.loadingReviews')}</p>
    {:else if reviews.length === 0}
      <div class="bg-white p-8 text-center">
        <p class="text-black text-sm uppercase tracking-wide">
          No reviews yet. Be the first to review!
        </p>
      </div>
    {:else}
      <div class="space-y-6">
        {#each reviews as review}
          <div class="bg-white p-6 border-b border-gray-200 last:border-b-0">
            <div class="flex justify-between items-start mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <p class="font-medium text-black">
                    {review.user?.firstName}
                    {review.user?.lastName}
                  </p>
                  {#if review.isVerified}
                    <span
                      class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs uppercase tracking-wide"
                    >
                      Verified Purchase
                    </span>
                  {/if}
                </div>
                <div class="text-lg text-gray-400 mb-2">
                  {renderStars(review.rating).join('')}
                </div>
                {#if review.title}
                  <h4 class="text-base font-medium mb-2 text-black">{review.title}</h4>
                {/if}
              </div>
              <p class="text-xs text-gray-500 whitespace-nowrap ml-4">
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>
            {#if review.comment}
              <p class="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
            {/if}
          </div>
        {/each}
      </div>

      {#if totalPages > 1}
        <div class="flex items-center justify-center gap-4 mt-8">
          <button
            on:click={() => {
              currentPage--;
              loadReviews();
            }}
            disabled={currentPage === 1}
            class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm uppercase tracking-wide"
          >
            {t('common.previous')}
          </button>
          <span class="text-sm text-gray-500"
            >{t('common.page')} {currentPage} {t('common.of')} {totalPages}</span
          >
          <button
            on:click={() => {
              currentPage++;
              loadReviews();
            }}
            disabled={currentPage >= totalPages}
            class="px-4 py-2 bg-white border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm uppercase tracking-wide"
          >
            {t('common.next')}
          </button>
        </div>
      {/if}
    {/if}
  </div>
{/if}
