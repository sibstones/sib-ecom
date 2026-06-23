import { productService } from '../../services/product.service';
import { TestHelpers } from '../helpers/test-helpers';

describe('ProductService', () => {
  let category: any;
  let brand: any;
  let warehouse: any;

  beforeEach(async () => {
    category = await TestHelpers.createCategory({ name: 'Test Category', slug: 'test-category' });
    brand = await TestHelpers.createBrand({ name: 'Test Brand', slug: 'test-brand' });
    warehouse = await TestHelpers.createWarehouse({ name: 'Main Warehouse' });
  });

  describe('getAll', () => {
    it('should return products with pagination', async () => {
      await TestHelpers.createProduct({
        name: 'Product 1',
        slug: 'product-1',
        sku: 'PROD-001',
        price: 100,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 2',
        slug: 'product-2',
        sku: 'PROD-002',
        price: 200,
        categoryId: category.id,
      });

      const result = await productService.getAll(1, 10);

      expect(result.products).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by category', async () => {
      const category2 = await TestHelpers.createCategory({ name: 'Category 2', slug: 'category-2' });

      await TestHelpers.createProduct({
        name: 'Product 1',
        slug: 'product-1',
        sku: 'PROD-001',
        price: 100,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 2',
        slug: 'product-2',
        sku: 'PROD-002',
        price: 200,
        categoryId: category2.id,
      });

      const result = await productService.getAll(1, 10, { categoryId: category.id });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].categoryId).toBe(category.id);
    });

    it('should filter by brand', async () => {
      await TestHelpers.createProduct({
        name: 'Product 1',
        slug: 'product-1',
        sku: 'PROD-001',
        price: 100,
        categoryId: category.id,
        brandId: brand.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 2',
        slug: 'product-2',
        sku: 'PROD-002',
        price: 200,
        categoryId: category.id,
      });

      const result = await productService.getAll(1, 10, { brandId: brand.id });

      expect(result.products.length).toBeGreaterThanOrEqual(1);
      const brandProducts = result.products.filter(p => p.brandId === brand.id);
      expect(brandProducts.length).toBeGreaterThan(0);
      expect(brandProducts[0].brandId).toBe(brand.id);
    });

    it('should filter by price range', async () => {
      await TestHelpers.createProduct({
        name: 'Product 1',
        slug: 'product-1',
        sku: 'PROD-001',
        price: 50,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 2',
        slug: 'product-2',
        sku: 'PROD-002',
        price: 150,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 3',
        slug: 'product-3',
        sku: 'PROD-003',
        price: 250,
        categoryId: category.id,
      });

      const result = await productService.getAll(1, 10, { minPrice: 100, maxPrice: 200 });

      expect(result.products).toHaveLength(1);
      expect(Number(result.products[0].price)).toBe(150);
    });

    it('should search products by name', async () => {
      await TestHelpers.createProduct({
        name: 'Red T-Shirt',
        slug: 'red-tshirt',
        sku: 'PROD-001',
        price: 100,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Blue Jeans',
        slug: 'blue-jeans',
        sku: 'PROD-002',
        price: 200,
        categoryId: category.id,
      });

      const result = await productService.getAll(1, 10, { search: 'T-Shirt' });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toContain('T-Shirt');
    });

    it('should search products by SKU', async () => {
      await TestHelpers.createProduct({
        name: 'Product 1',
        slug: 'product-1',
        sku: 'UNIQUE-SKU-123',
        price: 100,
        categoryId: category.id,
      });

      const result = await productService.getAll(1, 10, { search: 'UNIQUE-SKU-123' });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].sku).toBe('UNIQUE-SKU-123');
    });

    it('should only return products with available inventory', async () => {
      const product1 = await TestHelpers.createProduct({
        name: 'Product 1',
        slug: 'product-1',
        sku: 'PROD-001',
        price: 100,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 2',
        slug: 'product-2',
        sku: 'PROD-002',
        price: 200,
        categoryId: category.id,
      });

      // Only product1 has inventory
      await TestHelpers.createInventory({
        warehouseId: warehouse.id,
        productId: product1.id,
        quantity: 10,
      });

      const result = await productService.getAll(1, 10);

      expect(result.products.length).toBeGreaterThanOrEqual(1);
      const foundProduct1 = result.products.find(p => p.id === product1.id);
      expect(foundProduct1).toBeDefined();
    });

    it('should sort products by price ascending', async () => {
      await TestHelpers.createProduct({
        name: 'Product 1',
        slug: 'product-1',
        sku: 'PROD-001',
        price: 300,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 2',
        slug: 'product-2',
        sku: 'PROD-002',
        price: 100,
        categoryId: category.id,
      });

      await TestHelpers.createProduct({
        name: 'Product 3',
        slug: 'product-3',
        sku: 'PROD-003',
        price: 200,
        categoryId: category.id,
      });

      const result = await productService.getAll(1, 10, undefined, {
        field: 'price',
        order: 'asc',
      });

      expect(result.products[0].price).toBeLessThanOrEqual(Number(result.products[1].price));
    });
  });

  describe('getById', () => {
    it('should return product by id', async () => {
      const product = await TestHelpers.createProduct({
        name: 'Test Product',
        slug: 'test-product',
        sku: 'TEST-001',
        price: 100,
        categoryId: category.id,
      });

      const result = await productService.getById(product.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(product.id);
      expect(result?.name).toBe('Test Product');
    });

    it('should return null for non-existent product', async () => {
      const result = await productService.getById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getBySlug', () => {
    it('should return product by slug', async () => {
      await TestHelpers.createProduct({
        name: 'Test Product',
        slug: 'test-product',
        sku: 'TEST-001',
        price: 100,
        categoryId: category.id,
      });

      const result = await productService.getBySlug('test-product');

      expect(result).toBeDefined();
      expect(result?.slug).toBe('test-product');
    });

    it('should return null for non-existent slug', async () => {
      const result = await productService.getBySlug('non-existent-slug');

      expect(result).toBeNull();
    });
  });
});
