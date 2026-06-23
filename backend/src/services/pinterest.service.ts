import { settingsService } from './settings.service';
import { resolveFrontendBaseUrl } from '../utils/frontend-url';

function appendUtmToUrl(url: string, params: Record<string, string>): string {
  const filtered = Object.entries(params).filter(([, v]) => v != null && String(v).trim() !== '');
  if (filtered.length === 0) return url;
  const search = new URLSearchParams(Object.fromEntries(filtered)).toString();
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${search}`;
}

interface PinterestPinData {
  board_id?: string;
  media_source: {
    source_type: 'image_url';
    url: string;
  };
  link?: string;
  title?: string;
  description?: string;
}

interface PinterestApiResponse {
  id?: string;
  error?: {
    message: string;
    code: number;
  };
}

export class PinterestService {
  private baseUrl: string = 'https://api.pinterest.com/v5';

  /**
   * Get Pinterest settings from database
   */
  private async getSettings(): Promise<{
    enabled: boolean;
    accessToken: string;
    boardId?: string;
    frontendBaseUrl: string;
  }> {
    try {
      const enabled = (await settingsService.getSetting('pinterestEnabled')) as boolean;
      const accessToken = (await settingsService.getSetting('pinterestAccessToken')) as string;
      const boardId = (await settingsService.getSetting('pinterestBoardId')) as string;
      const frontendBaseUrl = await resolveFrontendBaseUrl();

      return {
        enabled: enabled || false,
        accessToken: accessToken || '',
        boardId: boardId || undefined,
        frontendBaseUrl,
      };
    } catch (error) {
      console.error('Failed to load Pinterest settings:', error);
      // Fallback to environment variables for backward compatibility
      return {
        enabled: process.env.PINTEREST_ENABLED === 'true',
        accessToken: process.env.PINTEREST_ACCESS_TOKEN || '',
        boardId: process.env.PINTEREST_BOARD_ID,
        frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
      };
    }
  }

  /**
   * Check if Pinterest integration is configured
   */
  async isConfigured(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.enabled && !!settings.accessToken;
  }

  /**
   * Create a pin in Pinterest for a product
   * @param product - Product data
   * @param imageUrl - Product image URL
   * @returns Result of pin creation
   */
  async createProductPin(
    product: {
      id: string;
      name: string;
      description?: string | null;
      slug: string;
      price: number;
    },
    imageUrl: string
  ): Promise<{ success: boolean; pinId?: string; error?: string }> {
    const settings = await this.getSettings();

    if (!settings.enabled || !settings.accessToken) {
      console.log('Pinterest integration is not configured. Skipping pin creation.');
      return { success: false, error: 'Pinterest not configured' };
    }

    if (!imageUrl) {
      console.log('Product image URL is missing. Skipping Pinterest pin creation.');
      return { success: false, error: 'Image URL is required' };
    }

    try {
      const baseProductUrl = `${settings.frontendBaseUrl}/shop/product/${product.slug}`;
      const productUrl = appendUtmToUrl(baseProductUrl, {
        utm_source: 'pinterest',
        utm_medium: 'social',
      });
      let price = '0';
      if (product.price) {
        if (typeof product.price === 'object' && product.price !== null && 'toString' in product.price) {
          price = (product.price as { toString(): string }).toString();
        } else {
          price = String(product.price);
        }
      }
      
      const pinData: PinterestPinData = {
        media_source: {
          source_type: 'image_url',
          url: imageUrl,
        },
        link: productUrl,
        title: product.name,
        description: this.formatDescription(product.description || '', price),
      };

      // Add board_id if it is specified
      if (settings.boardId) {
        pinData.board_id = settings.boardId;
      }

      const response = await fetch(`${this.baseUrl}/pins`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pinData),
      });

      const result = await response.json() as PinterestApiResponse;

      if (!response.ok) {
        const errorMessage = result.error?.message || `HTTP ${response.status}`;
        console.error('Failed to create Pinterest pin:', errorMessage);
        return { success: false, error: errorMessage };
      }

      console.log(`Successfully created Pinterest pin for product: ${product.name}`);
      return { success: true, pinId: result.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating Pinterest pin:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Format the description for the Pinterest pin
   */
  private formatDescription(description: string, price: string): string {
    const maxLength = 500; // Pinterest limitation on the description length
    let formatted = description || '';
    
    // Add price to the beginning of the description
    if (price) {
      formatted = `$${price} - ${formatted}`;
    }

    // Truncate if too long
    if (formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength - 3) + '...';
    }

    return formatted || 'Check out this product!';
  }

  /**
   * Index the product in Pinterest (create a pin)
   * Called after the product is created and images are loaded
   */
  async indexProduct(
    product: {
      id: string;
      name: string;
      description?: string | null;
      slug: string;
      price: number;
    },
    imageUrls: string[]
  ): Promise<{ success: boolean; pinId?: string; error?: string }> {
    // Use the first available image
    const imageUrl = imageUrls && imageUrls.length > 0 ? imageUrls[0] : '';

    if (!imageUrl) {
      console.log('No images available for Pinterest pin. Skipping.');
      return { success: false, error: 'No images available' };
    }

    return this.createProductPin(product, imageUrl);
  }
}

export const pinterestService = new PinterestService();
