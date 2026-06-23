import type { PageLoad } from './$types';
import type { HomepageSection } from '$lib/api/homepage.api';
import type { Product } from '$lib/api/product.api';

const DEFAULT_LANGUAGE = 'en';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:homepage');

  const languageCode = DEFAULT_LANGUAGE;

  try {
    const homepageResponse = await readJson<{ sections: HomepageSection[] }>(
      await fetch(`/api/homepage?active=true&languageCode=${languageCode}`)
    );

    const sections = homepageResponse.sections ?? [];
    const collectionSections = sections.filter(
      (section) => section.type === 'collection' && section.isActive
    );

    const collectionProductsBySection: Record<string, Product[]> = {};

    await Promise.all(
      collectionSections.map(async (section) => {
        const productIds = Array.isArray(section.config?.products) ? section.config.products : [];

        if (productIds.length === 0) {
          collectionProductsBySection[section.id] = [];
          return;
        }

        const productResponses = await Promise.all(
          productIds.map(async (productId) => {
            try {
              const response = await readJson<{ product: Product }>(
                await fetch(`/api/products/${productId}?languageCode=${languageCode}`)
              );
              return response.product;
            } catch {
              return null;
            }
          })
        );

        collectionProductsBySection[section.id] = productResponses.filter(
          (product): product is Product => product !== null
        );
      })
    );

    return {
      sections,
      collectionProductsBySection,
      languageCode,
      error: null,
    };
  } catch (error) {
    return {
      sections: [] as HomepageSection[],
      collectionProductsBySection: {} as Record<string, Product[]>,
      languageCode,
      error: error instanceof Error ? error.message : 'Failed to load homepage',
    };
  }
};
