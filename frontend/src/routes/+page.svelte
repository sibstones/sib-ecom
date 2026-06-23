<script lang="ts">
  import HomePageContent from '$lib/components/homepage/HomePageContent.svelte';
  import Footer from '$lib/components/Footer.svelte';

  export let data: {
    sections: import('$lib/api/homepage.api').HomepageSection[];
    collectionProductsBySection: Record<string, import('$lib/api/product.api').Product[]>;
    languageCode: string;
    error: string | null;
  };
</script>

<HomePageContent
  initialSections={data.sections}
  initialCollectionProductsBySection={data.collectionProductsBySection}
  initialLanguageCode={data.languageCode}
  initialError={data.error}
/>
<Footer />
