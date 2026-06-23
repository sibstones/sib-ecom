import { Request, Response } from 'express';
import { lookbookService } from '../services/lookbook.service';
import { storageService } from '../services/storage.service';
import { CreateLookbookDto, UpdateLookbookDto, CreateLookbookImageDto, UpdateLookbookImageDto, CreateProductTagDto } from '../types/lookbook';

export class LookbookController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const languageCode = req.query.languageCode as string | undefined;
      const lookbooks = await lookbookService.getAll(activeOnly, languageCode);
      res.json({ lookbooks });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get lookbooks',
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const lookbook = await lookbookService.getById(id);
      
      if (!lookbook) {
        res.status(404).json({ error: 'Lookbook not found' });
        return;
      }

      res.json({ lookbook });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get lookbook',
      });
    }
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const languageCode = req.query.languageCode as string | undefined;
      const lookbook = await lookbookService.getBySlug(slug, languageCode);
      
      if (!lookbook) {
        res.status(404).json({ error: 'Lookbook not found' });
        return;
      }

      res.json({ lookbook });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get lookbook',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateLookbookDto = req.body;
      const lookbook = await lookbookService.create(data);
      res.status(201).json({ lookbook });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create lookbook',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data: UpdateLookbookDto = req.body;
      const lookbook = await lookbookService.update(id, data);
      res.json({ lookbook });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update lookbook',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await lookbookService.delete(id);
      res.json({ message: 'Lookbook deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete lookbook',
      });
    }
  }

  // Image management
  async addImage(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Upload file to MinIO
      const fileUrl = await storageService.uploadFile(file, 'lookbook');

      // Get additional data from request body
      const { lookbookId, alt, order } = req.body;

      if (!lookbookId) {
        res.status(400).json({ error: 'lookbookId is required' });
        return;
      }

      const data: CreateLookbookImageDto = {
        lookbookId,
        url: fileUrl,
        alt: alt || file.originalname,
        order: order ? parseInt(order, 10) : 0,
      };

      const image = await lookbookService.addImage(data);
      res.status(201).json({ image });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add image',
      });
    }
  }

  async addMultipleImages(req: Request, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const { lookbookId } = req.body;

      if (!lookbookId) {
        res.status(400).json({ error: 'lookbookId is required' });
        return;
      }

      // Upload all files to MinIO
      const fileUrls = await storageService.uploadFiles(files, 'lookbook');

      // Create image records
      const images = await Promise.all(
        fileUrls.map((url, index) => {
          const file = files[index];
          const data: CreateLookbookImageDto = {
            lookbookId,
            url,
            alt: file.originalname,
            order: index,
          };
          return lookbookService.addImage(data);
        })
      );

      res.status(201).json({ images });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add images',
      });
    }
  }

  async updateImage(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.imageId;
      const data: UpdateLookbookImageDto = req.body;
      const image = await lookbookService.updateImage(id, data);
      res.json({ image });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update image',
      });
    }
  }

  async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.imageId;
      
      // Get image to retrieve URL before deletion
      const image = await lookbookService.getImageById(id);
      
      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Delete from database
      await lookbookService.deleteImage(id);

      // Delete from MinIO
      if (image.url) {
        await storageService.deleteFile(image.url);
      }

      res.json({ message: 'Image deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete image',
      });
    }
  }

  async reorderImages(req: Request, res: Response): Promise<void> {
    try {
      const lookbookId = req.params.lookbookId;
      const { imageOrders } = req.body as { imageOrders: { id: string; order: number }[] };
      await lookbookService.reorderImages(lookbookId, imageOrders);
      res.json({ message: 'Images reordered successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to reorder images',
      });
    }
  }

  // Product tags
  async addProductTag(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateProductTagDto = req.body;
      const tag = await lookbookService.addProductTag(data);
      res.status(201).json({ tag });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add product tag',
      });
    }
  }

  async deleteProductTag(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.tagId;
      await lookbookService.deleteProductTag(id);
      res.json({ message: 'Product tag deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete product tag',
      });
    }
  }
}

export const lookbookController = new LookbookController();
