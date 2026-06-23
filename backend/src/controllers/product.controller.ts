import { Request, Response } from 'express';
import { productService } from '../services/product.service';
import { storageService } from '../services/storage.service';
import { pinterestService } from '../services/pinterest.service';
import { productImportService } from '../services/product-import.service';
import { ProductFilters, ProductSort, CreateProductDto, UpdateProductDto, CreateProductImageDto, CreateProductVariantDto } from '../types/product';
import { AuthRequest } from '../middleware/auth.middleware';
import { disableCache, setPublicStorefrontCache } from '../utils/response-cache';

export class ProductController {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const filters: ProductFilters = {};
      if (req.query.categoryId) filters.categoryId = req.query.categoryId as string;
      if (req.query.brandId) filters.brandId = req.query.brandId as string;
      if (req.query.minPrice) filters.minPrice = parseFloat(req.query.minPrice as string);
      if (req.query.maxPrice) filters.maxPrice = parseFloat(req.query.maxPrice as string);
      if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
      if (req.query.isFeatured !== undefined) filters.isFeatured = req.query.isFeatured === 'true';
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.color) filters.color = req.query.color as string;
      if (req.query.material) filters.material = req.query.material as string;
      if (req.query.countryOfOrigin) filters.countryOfOrigin = req.query.countryOfOrigin as string;
      if (req.query.size) filters.size = req.query.size as string;
      if (req.query.inventoryStatus) {
        const status = req.query.inventoryStatus as string;
        if (status === 'IN_SALE' || status === 'COMING_SOON' || status === 'OUT_OF_STOCK') {
          filters.inventoryStatus = status;
        }
      }
      if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom as string;
      if (req.query.dateTo) filters.dateTo = req.query.dateTo as string;

      // Skip inventory check for admin users (they need to see all products)
      if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN')) {
        filters.skipInventoryCheck = true;
      }

      const sort: ProductSort | undefined = req.query.sortBy
        ? {
            field: (req.query.sortBy as string) as 'price' | 'createdAt' | 'name',
            order: ((req.query.sortOrder as string) || 'asc') as 'asc' | 'desc',
          }
        : undefined;

      // List of products: 2 images per product (second one — on hover), read from query or default 2
      const imagesPerProduct = Math.min(20, Math.max(2, parseInt(req.query.imagesLimit as string) || 2));

      const result = await productService.getAll(page, limit, filters, sort, imagesPerProduct);
      // Transform color + explicit serialization of images for the list (id, url, alt, order) — so the frontend always receives an array of up to 2 elements
      const transformedResult = {
        ...result,
        products: result.products.map((p) => {
          const product = this.transformProductColor(p);
          const images = Array.isArray(product.images)
            ? product.images.slice(0, imagesPerProduct).map((img: any) => ({
                id: img.id,
                productId: img.productId,
                url: img.url,
                alt: img.alt ?? null,
                order: img.order,
              }))
            : [];
          return { ...product, images };
        }),
      };
      if (req.user) {
        disableCache(res);
      } else {
        setPublicStorefrontCache(res);
      }
      res.json(transformedResult);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get products',
      });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const languageCode = req.query.languageCode as string | undefined;
      const product = await productService.getById(id, languageCode);
      
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      // Transform color field for backward compatibility
      const transformedProduct = this.transformProductColor(product);
      if (req.user) {
        disableCache(res);
      } else {
        setPublicStorefrontCache(res);
      }
      res.json({ product: transformedProduct });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get product',
      });
    }
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const languageCode = req.query.languageCode as string | undefined;
      const product = await productService.getBySlug(slug, languageCode);
      
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      // Transform color field for backward compatibility
      const transformedProduct = this.transformProductColor(product);
      setPublicStorefrontCache(res);
      res.json({ product: transformedProduct });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get product',
      });
    }
  }

  async getSimilar(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.params.productId;
      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 8));
      const result = await productService.getSimilar(productId, limit);
      const products = result.products.map((p: any) => this.transformProductColor(p));
      setPublicStorefrontCache(res);
      res.json({ products });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get similar products',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateProductDto = req.body;
      console.log('ProductController.create - Received data:', JSON.stringify(data, null, 2));
      console.log('ProductController.create - relatedProducts:', data.relatedProducts);
      const product = await productService.create(data);
      console.log('ProductController.create - Created product:', product.id, 'relatedProducts:', product.relatedProducts);
      res.status(201).json({ product });
    } catch (error) {
      console.error('ProductController.create - Error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create product',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const data: UpdateProductDto = req.body;
      console.log('Updating product:', id, 'with data:', JSON.stringify(data, null, 2));
      const product = await productService.update(id, data);
      
      // If the product became active and it has images, index it in Pinterest
      if (product.isActive && data.isActive !== false) {
        const productWithImages = await productService.getById(id);
        if (productWithImages && productWithImages.images && productWithImages.images.length > 0) {
          const imageUrls = productWithImages.images.map(img => img.url);
          // Do this asynchronously, so as not to block the response
          this.indexProductInPinterest(id, imageUrls).catch((error) => {
            console.error('Failed to index product in Pinterest:', error);
          });
        }
      }
      
      res.json({ product });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update product',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      
      // Get product with images before deletion
      const product = await productService.getById(id);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      // Delete all product images from MinIO
      if (product.images && product.images.length > 0) {
        const imageUrls = product.images.map(img => img.url).filter(Boolean);
        if (imageUrls.length > 0) {
          await storageService.deleteFiles(imageUrls);
        }
      }

      // Delete product from database (cascade will handle related records)
      await productService.delete(id);
      
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Error deleting product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete product';
      
      // Check for foreign key constraint errors (Prisma and database errors)
      const errorString = errorMessage.toLowerCase();
      if (
        errorString.includes('foreign key constraint') ||
        errorString.includes('violates foreign key constraint') ||
        errorString.includes('foreign key violation') ||
        errorString.includes('record to delete has related records') ||
        (error instanceof Error && 'code' in error && (error as any).code === 'P2003')
      ) {
        res.status(400).json({
          error: 'Cannot delete product: it is referenced by orders or other records. Please remove all references first.',
        });
      } else {
        res.status(400).json({
          error: errorMessage,
        });
      }
    }
  }

  async addImage(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File;
      
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Upload file to MinIO
      const fileUrl = await storageService.uploadFile(file, 'products');

      // Get additional data from request body
      const { productId, alt, order } = req.body;

      if (!productId) {
        res.status(400).json({ error: 'productId is required' });
        return;
      }

      const data: CreateProductImageDto = {
        productId,
        url: fileUrl,
        alt: alt || file.originalname,
        order: order ? parseInt(order, 10) : 0,
      };

      const image = await productService.addImage(data);
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

      const { productId } = req.body;

      if (!productId) {
        res.status(400).json({ error: 'productId is required' });
        return;
      }

      // Upload all files to MinIO
      const fileUrls = await storageService.uploadFiles(files, 'products');

      // Create image records
      const images = await Promise.all(
        fileUrls.map((url, index) => {
          const file = files[index];
          const data: CreateProductImageDto = {
            productId,
            url,
            alt: file.originalname,
            order: index,
          };
          return productService.addImage(data);
        })
      );

      // Index the product in Pinterest after loading images
      // Do this asynchronously, so as not to block the response
      this.indexProductInPinterest(productId, fileUrls).catch((error) => {
        console.error('Failed to index product in Pinterest:', error);
      });

      res.status(201).json({ images });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add images',
      });
    }
  }

  /**
   * Indexes the product in Pinterest
   * Called asynchronously after the product is created and images are loaded
   */
  private transformProductColor(product: any): any {
    // Transform color field: convert JSON array to colors array
    // After migration, color is stored as JSONB array in format: [{"name": "ColorName", "hex": "#000000"}]
    if (product.color !== null && product.color !== undefined) {
      if (Array.isArray(product.color)) {
        // Already an array (from Prisma JSON field)
        product.colors = product.color;
      } else if (typeof product.color === 'string') {
        // Legacy format: try to parse as JSON or treat as plain string
        try {
          const parsed = JSON.parse(product.color);
          if (Array.isArray(parsed)) {
            product.colors = parsed;
          } else {
            // It's a plain string, convert to array format
            product.colors = [{ name: product.color, hex: '#000000' }];
          }
        } catch {
          // It's a plain string, convert to array format
          product.colors = [{ name: product.color, hex: '#000000' }];
        }
      }
      // Remove old color field to avoid confusion
      delete product.color;
    } else {
      product.colors = [];
    }

    // Transform productType field: convert JSON array to productTypes array
    // After migration, productType is stored as JSONB array in format: ["CLOTHING", "SHOES"]
    if (product.productType !== null && product.productType !== undefined) {
      if (Array.isArray(product.productType)) {
        // Already an array (from Prisma JSON field)
        product.productTypes = product.productType;
      } else if (typeof product.productType === 'string') {
        // Legacy format: single type value
        product.productTypes = [product.productType];
      }
      // Remove old productType field to avoid confusion
      delete product.productType;
    } else {
      product.productTypes = [];
    }

    // Transform sizes field: ensure it's in the new format
    // New format: { CLOTHING: [...], SHOES: [...], CUSTOM: [...] }
    // Legacy format: array of strings or array of objects
    if (product.sizes !== null && product.sizes !== undefined) {
      if (typeof product.sizes === 'object' && !Array.isArray(product.sizes)) {
        // Already in new format
        // No transformation needed
      } else if (Array.isArray(product.sizes)) {
        // Legacy format: convert to new format based on productTypes
        const sizesObj: any = {};
        if (product.productTypes && product.productTypes.length > 0) {
          const firstType = product.productTypes[0];
          if (firstType === 'CUSTOM' && product.sizes.length > 0 && typeof product.sizes[0] === 'object') {
            sizesObj.CUSTOM = product.sizes;
          } else {
            sizesObj[firstType] = product.sizes;
          }
        }
        product.sizes = sizesObj;
      }
    } else {
      product.sizes = {};
    }

	    // Transform relatedProducts field: convert JSON array to relatedProducts array
	    if (product.relatedProducts !== null && product.relatedProducts !== undefined) {
	      if (Array.isArray(product.relatedProducts)) {
	        // Already an array (from Prisma JSON field)
	        // No transformation needed
	      } else if (typeof product.relatedProducts === 'string') {
	        // Legacy format: try to parse as JSON
	        try {
	          const parsed = JSON.parse(product.relatedProducts);
	          product.relatedProducts = Array.isArray(parsed) ? parsed : [];
	        } catch {
	          product.relatedProducts = [];
	        }
	      }
	    } else {
	      product.relatedProducts = [];
	    }

    return product;
  }

  private async indexProductInPinterest(productId: string, imageUrls: string[]): Promise<void> {
    try {
      // Get full information about the product
      const product = await productService.getById(productId);
      
      if (!product || !product.isActive) {
        console.log('Product not found or not active. Skipping Pinterest indexing.');
        return;
      }

      // Index the product in Pinterest
      await pinterestService.indexProduct(
        {
          id: product.id,
          name: product.name,
          description: product.description,
          slug: product.slug,
          price: Number(product.price),
        },
        imageUrls
      );
    } catch (error) {
      // Log the error, but do not interrupt execution
      console.error('Error indexing product in Pinterest:', error);
    }
  }

  async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.imageId;
      
      // Get image to retrieve URL before deletion
      const image = await productService.getImageById(id);
      
      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      const imageUrl = image.url;

      // Delete from database first
      await productService.deleteImage(id);

      // Delete from MinIO (don't fail if file doesn't exist in storage)
      if (imageUrl) {
        try {
          const deleted = await storageService.deleteFile(imageUrl);
          if (!deleted) {
            console.warn(`Failed to delete file from MinIO: ${imageUrl}`);
            // Don't fail the request if file deletion fails - it's already deleted from DB
          }
        } catch (storageError) {
          console.error('Error deleting file from MinIO:', storageError);
          // Don't fail the request if file deletion fails - it's already deleted from DB
        }
      }

      res.json({ message: 'Image deleted successfully' });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete image',
      });
    }
  }

  async reorderImages(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.params.productId;
      const { imageOrders } = req.body as { imageOrders: { id: string; order: number }[] };
      await productService.reorderImages(productId, imageOrders);
      res.json({ message: 'Images reordered successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to reorder images',
      });
    }
  }

  async addVariant(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateProductVariantDto = req.body;
      const variant = await productService.addVariant(data);
      res.status(201).json({ variant });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add variant',
      });
    }
  }

  async updateVariant(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.variantId;
      const data = req.body;
      const variant = await productService.updateVariant(id, data);
      res.json({ variant });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update variant',
      });
    }
  }

  async deleteVariant(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.variantId;
      await productService.deleteVariant(id);
      res.json({ message: 'Variant deleted successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to delete variant',
      });
    }
  }

  async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const searchQuery = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const excludeProductId = req.query.excludeId as string | undefined;

      console.log('ProductController.searchProducts - Request:', {
        searchQuery,
        limit,
        excludeProductId,
        query: req.query
      });

      if (!searchQuery || searchQuery.trim().length < 2) {
        console.log('ProductController.searchProducts - Query too short, returning empty');
        res.json({ products: [] });
        return;
      }

      const products = await productService.searchProducts(searchQuery.trim(), limit, excludeProductId);
      console.log('ProductController.searchProducts - Found products:', products.length);
      res.json({ products });
    } catch (error) {
      console.error('ProductController.searchProducts - Error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to search products',
      });
    }
  }

  async getCatalogAttributes(req: Request, res: Response): Promise<void> {
    try {
      const data = await productService.getCatalogAttributeSuggestions();
      res.json(data);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get catalog attributes',
      });
    }
  }

  async getAvailableStock(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const size = req.query.size as string | undefined;

      if (!productId) {
        res.status(400).json({ error: 'Product ID is required' });
        return;
      }

      const availableStock = await productService.getAvailableStock(productId, size || null);
      res.json({ availableStock });
    } catch (error) {
      console.error('ProductController.getAvailableStock - Error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get available stock',
      });
    }
  }

  async downloadImportTemplate(req: Request, res: Response): Promise<void> {
    try {
      const languageCode = typeof req.query.lang === 'string' ? req.query.lang : undefined;
      const archive = await productImportService.generateTemplateArchive(languageCode);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.zip"');
      res.send(archive);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate import template',
      });
    }
  }

  async importProducts(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ error: 'ZIP archive is required' });
        return;
      }

      const result = await productImportService.importArchive(file.buffer);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to import products',
      });
    }
  }
}

export const productController = new ProductController();
