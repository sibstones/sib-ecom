import { Request, Response } from 'express';
import { translationService } from '../services/translation.service';
import { 
  CreateProductTranslationDto, 
  UpdateProductTranslationDto,
  CreateCategoryTranslationDto,
  UpdateCategoryTranslationDto,
  CreatePageTranslationDto,
  UpdatePageTranslationDto,
  CreateHomepageSectionTranslationDto,
  UpdateHomepageSectionTranslationDto,
  CreateLookbookTranslationDto,
  UpdateLookbookTranslationDto,
  CreateProductPageDesignTranslationDto,
  UpdateProductPageDesignTranslationDto,
  CreateFooterTranslationDto,
  UpdateFooterTranslationDto,
  CreateBlogPostTranslationDto,
  UpdateBlogPostTranslationDto
} from '../types/translation';
import { gptApiService, resolveGptClientConfig } from '../services/gpt-api.service';
import prisma from '../config/database';
import { decryptGptAssistantSecrets } from '../utils/crypto';

export class TranslationController {
  /**
   * Get all translations for a product
   */
  async getProductTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const translations = await translationService.getProductTranslations(productId);
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for a product in a specific language
   */
  async getProductTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { productId, languageCode } = req.params;
      const translation = await translationService.getProductTranslation(productId, languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update product translation
   */
  async upsertProductTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const data: CreateProductTranslationDto & UpdateProductTranslationDto = {
        productId,
        ...req.body,
      };
      
      const translation = await translationService.upsertProductTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete product translation
   */
  async deleteProductTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { productId, languageCode } = req.params;
      await translationService.deleteProductTranslation(productId, languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Get all translations for a category
   */
  async getCategoryTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const translations = await translationService.getCategoryTranslations(categoryId);
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for a category in a specific language
   */
  async getCategoryTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId, languageCode } = req.params;
      const translation = await translationService.getCategoryTranslation(categoryId, languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update category translation
   */
  async upsertCategoryTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const data: CreateCategoryTranslationDto & UpdateCategoryTranslationDto = {
        categoryId,
        ...req.body,
      };
      
      const translation = await translationService.upsertCategoryTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete category translation
   */
  async deleteCategoryTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId, languageCode } = req.params;
      await translationService.deleteCategoryTranslation(categoryId, languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Get all translations for a page
   */
  async getPageTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { pageId } = req.params;
      const translations = await translationService.getPageTranslations(pageId);
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for a page in a specific language
   */
  async getPageTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { pageId, languageCode } = req.params;
      const translation = await translationService.getPageTranslation(pageId, languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update page translation
   */
  async upsertPageTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { pageId } = req.params;
      const data: CreatePageTranslationDto & UpdatePageTranslationDto = {
        pageId,
        ...req.body,
      };
      
      const translation = await translationService.upsertPageTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete page translation
   */
  async deletePageTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { pageId, languageCode } = req.params;
      await translationService.deletePageTranslation(pageId, languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Get all translations for a homepage section
   */
  async getHomepageSectionTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { sectionId } = req.params;
      const translations = await translationService.getHomepageSectionTranslations(sectionId);
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for a homepage section in a specific language
   */
  async getHomepageSectionTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { sectionId, languageCode } = req.params;
      const translation = await translationService.getHomepageSectionTranslation(sectionId, languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update homepage section translation
   */
  async upsertHomepageSectionTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { sectionId } = req.params;
      const data: CreateHomepageSectionTranslationDto & UpdateHomepageSectionTranslationDto = {
        sectionId,
        ...req.body,
      };
      
      const translation = await translationService.upsertHomepageSectionTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete homepage section translation
   */
  async deleteHomepageSectionTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { sectionId, languageCode } = req.params;
      await translationService.deleteHomepageSectionTranslation(sectionId, languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Get all translations for product page design
   */
  async getProductPageDesignTranslations(req: Request, res: Response): Promise<void> {
    try {
      const translations = await translationService.getProductPageDesignTranslations();
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for product page design in a specific language
   */
  async getProductPageDesignTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { languageCode } = req.params;
      const translation = await translationService.getProductPageDesignTranslation(languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update product page design translation
   */
  async upsertProductPageDesignTranslation(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateProductPageDesignTranslationDto & UpdateProductPageDesignTranslationDto = {
        ...req.body,
      };
      
      const translation = await translationService.upsertProductPageDesignTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete product page design translation
   */
  async deleteProductPageDesignTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { languageCode } = req.params;
      await translationService.deleteProductPageDesignTranslation(languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Get all translations for a lookbook
   */
  async getLookbookTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { lookbookId } = req.params;
      const translations = await translationService.getLookbookTranslations(lookbookId);
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for a lookbook in a specific language
   */
  async getLookbookTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { lookbookId, languageCode } = req.params;
      const translation = await translationService.getLookbookTranslation(lookbookId, languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update lookbook translation
   */
  async upsertLookbookTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { lookbookId } = req.params;
      const data: CreateLookbookTranslationDto & UpdateLookbookTranslationDto = {
        lookbookId,
        ...req.body,
      };
      
      const translation = await translationService.upsertLookbookTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete lookbook translation
   */
  async deleteLookbookTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { lookbookId, languageCode } = req.params;
      await translationService.deleteLookbookTranslation(lookbookId, languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Get all translations for a footer
   */
  async getFooterTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { footerId } = req.params;
      const translations = await translationService.getFooterTranslations(footerId);
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for a footer in a specific language
   */
  async getFooterTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { footerId, languageCode } = req.params;
      const translation = await translationService.getFooterTranslation(footerId, languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update footer translation
   */
  async upsertFooterTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { footerId } = req.params;
      const data: CreateFooterTranslationDto & UpdateFooterTranslationDto = {
        footerId,
        ...req.body,
      };
      const translation = await translationService.upsertFooterTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete footer translation
   */
  async deleteFooterTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { footerId, languageCode } = req.params;
      await translationService.deleteFooterTranslation(footerId, languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Get all translations for a blog post
   */
  async getBlogPostTranslations(req: Request, res: Response): Promise<void> {
    try {
      const { blogPostId } = req.params;
      const translations = await translationService.getBlogPostTranslations(blogPostId);
      res.json({ translations });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translations',
      });
    }
  }

  /**
   * Get translation for a blog post in a specific language
   */
  async getBlogPostTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { blogPostId, languageCode } = req.params;
      const translation = await translationService.getBlogPostTranslation(blogPostId, languageCode);
      
      if (!translation) {
        res.status(404).json({ error: 'Translation not found' });
        return;
      }

      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }

  /**
   * Create or update blog post translation
   */
  async upsertBlogPostTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { blogPostId } = req.params;
      const data: CreateBlogPostTranslationDto & UpdateBlogPostTranslationDto = {
        blogPostId,
        ...req.body,
      };
      
      const translation = await translationService.upsertBlogPostTranslation(data);
      res.json({ translation });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }

  /**
   * Delete blog post translation
   */
  async deleteBlogPostTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { blogPostId, languageCode } = req.params;
      await translationService.deleteBlogPostTranslation(blogPostId, languageCode);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete translation',
      });
    }
  }

  /**
   * Generate translation using GPT Assistant
   */
  async generateGPTTranslation(req: Request, res: Response): Promise<void> {
    try {
      const { sourceLanguage, targetLanguage, content } = req.body;

      if (!sourceLanguage || !targetLanguage || !content) {
        res.status(400).json({
          error: 'sourceLanguage, targetLanguage, and content are required',
        });
        return;
      }

      // Get GPT settings
      const settings = decryptGptAssistantSecrets(await prisma.gPTAssistantSettings.findFirst());
      const gptCfg = settings ? resolveGptClientConfig(settings) : null;
      if (!settings || !gptCfg) {
        res.status(400).json({
          error: 'GPT Assistant is not configured. Please configure API key (or LM Studio) in settings.',
        });
        return;
      }

      gptApiService.ensureClient(gptCfg);

      // Build translation prompt
      const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}. 
Return only the translated text without any explanations or additional text.
Preserve HTML tags and formatting if present.

Text to translate:
${content}`;

      const messages = [
        {
          role: 'user' as const,
          content: prompt,
          timestamp: new Date(),
        },
      ];

      // Generate translation
      const translation = await gptApiService.chatCompletion(messages, {
        model: settings.model || 'gpt-4',
        maxTokens: settings.maxTokens || 2000,
        temperature: 0.3, // Lower temperature for more consistent translations
      });

      res.json({ translation: translation.trim() });
    } catch (error) {
      console.error('GPT translation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate translation',
      });
    }
  }
}

export const translationController = new TranslationController();
