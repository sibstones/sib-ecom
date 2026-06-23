import prisma from '../config/database';
import { sanitizeHtmlContent } from '../utils/sanitize';
import { ProductFilters, ProductSort, CreateProductDto, UpdateProductDto, CreateProductImageDto, CreateProductVariantDto } from '../types/product';
import { Prisma, InventoryStatus } from '@prisma/client';
import { categoryService } from './category.service';
import { translationService } from './translation.service';
import { isInternationalClothingSize, normalizeInternationalSize } from '../constants/international-sizes';

export class ProductService {
  private readonly storefrontStatuses = [InventoryStatus.IN_SALE, InventoryStatus.COMING_SOON] as const;

  private normalizeLanguageCode(languageCode?: string): string | undefined {
    if (typeof languageCode !== 'string') return undefined;
    const normalized = languageCode.trim().toLowerCase();
    if (!normalized) return undefined;
    return normalized.split('-')[0] || undefined;
  }

  private hasAvailableInventory(quantity: number, reserved: number): boolean {
    return quantity - reserved > 0;
  }

  private extractComingSoonState(
    product: { variants?: Array<{ id: string; size?: string | null }> },
    inventory: Array<{ status: InventoryStatus; quantity: number; reserved: number; variantId?: string | null }>
  ): { isComingSoon: boolean; comingSoonSizes: string[] } {
    const activeInventory = inventory.filter((inv) => this.hasAvailableInventory(inv.quantity, inv.reserved));
    const inSaleInventory = activeInventory.filter((inv) => inv.status === InventoryStatus.IN_SALE);
    const comingSoonInventory = activeInventory.filter((inv) => inv.status === InventoryStatus.COMING_SOON);

    const inSaleVariantIds = new Set(
      inSaleInventory.map((inv) => inv.variantId).filter((variantId): variantId is string => Boolean(variantId))
    );

    const comingSoonSizes = Array.from(
      new Set(
        comingSoonInventory
          .map((inv) => {
            if (!inv.variantId) return null;
            const variant = product.variants?.find((item) => item.id === inv.variantId);
            return variant?.size?.trim() || null;
          })
          .filter((size): size is string => Boolean(size))
      )
    ).filter((size) => {
      const matchingVariant = product.variants?.find((variant) => {
        const variantSize = variant.size?.trim();
        return variantSize ? variantSize.toLowerCase() === size.toLowerCase() : false;
      });
      return matchingVariant ? !inSaleVariantIds.has(matchingVariant.id) : true;
    });

    return {
      isComingSoon: inSaleInventory.length === 0 && comingSoonInventory.length > 0,
      comingSoonSizes,
    };
  }

  async getAll(
    page: number = 1,
    limit: number = 20,
    filters?: ProductFilters,
    sort?: ProductSort,
    imagesPerProduct: number = 2
  ) {
    const skip = (page - 1) * limit;
    
    const where: Prisma.ProductWhereInput = {};
    
    if (filters?.categoryId) {
      // Get all subcategory IDs (including nested) for this category
      const categoryIds = await categoryService.getCategoryAndDescendantsIds(filters.categoryId);
      where.categoryId = { in: categoryIds };
    }
    
    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }
    
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = new Prisma.Decimal(filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = new Prisma.Decimal(filters.maxPrice);
      }
      // Exclude products with price on request from price filters
      where.priceOnRequest = false;
    }
    
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    
    if (filters?.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }
    
    if (filters?.search) {
      const trimmedSearch = filters.search.trim();
      where.OR = [
        { name: { contains: trimmedSearch, mode: 'insensitive' } },
        { description: { contains: trimmedSearch, mode: 'insensitive' } },
        { sku: { contains: trimmedSearch, mode: 'insensitive' } },
        { sku: { equals: trimmedSearch, mode: 'insensitive' } }, // Exact match for SKU (higher priority)
        // Search by variant SKU
        {
          variants: {
            some: {
              sku: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
        },
        {
          variants: {
            some: {
              sku: { equals: trimmedSearch, mode: 'insensitive' }, // Exact match for variant SKU
            },
          },
        },
      ];
    }
    
    // Color filtering: color is JSON (string or array of strings). Use array_contains for arrays, string_contains for legacy.
    if (filters?.color) {
      const colorFilter = filters.color.trim();
      const colorCondition: Prisma.ProductWhereInput = {
        OR: [
          { color: { path: ['$'], array_contains: [colorFilter] } as any },
          { color: { string_contains: colorFilter } as any },
        ],
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), colorCondition];
    }
    
    if (filters?.material) {
      where.material = { contains: filters.material, mode: 'insensitive' };
    }
    
    if (filters?.countryOfOrigin) {
      where.countryOfOrigin = { contains: filters.countryOfOrigin, mode: 'insensitive' };
    }

    if (filters?.size) {
      const rawSize = filters.size.trim();
      if (isInternationalClothingSize(rawSize)) {
        const sizeFilter = normalizeInternationalSize(rawSize);
        const sizeJsonNeedle = `"${sizeFilter}"`;
        const sizeCondition: Prisma.ProductWhereInput = {
          OR: [
            {
              sizes: {
                path: ['CLOTHING'],
                array_contains: [sizeFilter],
              } as Prisma.JsonFilter,
            },
            {
              sizes: {
                string_contains: sizeJsonNeedle,
              } as Prisma.JsonFilter,
            },
            {
              variants: {
                some: {
                  OR: [
                    { size: { equals: sizeFilter, mode: 'insensitive' } },
                    { size: { equals: `CLOTHING:${sizeFilter}`, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        };
        where.AND = [...(Array.isArray(where.AND) ? where.AND : []), sizeCondition];
      }
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const d = new Date(filters.dateTo);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    // Filter products by storefront inventory availability.
    // Only apply for public-facing requests (when isActive is true or not specified).
    // Skip this check if explicitly requested (for admin panel).
    if ((filters?.isActive === undefined || filters?.isActive === true) && filters?.skipInventoryCheck !== true) {
      const andConditions = Array.isArray(where.AND) ? [...where.AND] : [];

      if (filters?.inventoryStatus === 'IN_SALE') {
        where.inventory = {
          some: {
            status: InventoryStatus.IN_SALE,
            quantity: { gt: 0 },
          },
        };
      } else if (filters?.inventoryStatus === 'COMING_SOON') {
        andConditions.push(
          {
            inventory: {
              some: {
                status: InventoryStatus.COMING_SOON,
                quantity: { gt: 0 },
              },
            },
          },
          {
            NOT: {
              inventory: {
                some: {
                  status: InventoryStatus.IN_SALE,
                  quantity: { gt: 0 },
                },
              },
            },
          }
        );
        where.AND = andConditions;
      } else if (filters?.inventoryStatus === 'OUT_OF_STOCK') {
        andConditions.push({
          NOT: {
            inventory: {
              some: {
                status: { in: [...this.storefrontStatuses] },
                quantity: { gt: 0 },
              },
            },
          },
        });
        where.AND = andConditions;
      } else {
        where.inventory = {
          some: {
            status: { in: [...this.storefrontStatuses] },
            quantity: { gt: 0 },
          },
        };
      }
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    let needsPostSort = false;
    
    if (sort && sort.field === 'onSale') {
      // For onSale sorting, we need to sort after fetching
      // First sort by createdAt as default, then we'll re-sort
      orderBy.createdAt = 'desc';
      needsPostSort = true;
    } else if (sort) {
      (orderBy as Record<string, 'asc' | 'desc'>)[sort.field] = sort.order;
    } else {
      orderBy.createdAt = 'desc';
    }

    // For onSale sorting, we need to fetch all products first, then sort
    const fetchLimit = needsPostSort ? undefined : limit;
    const fetchSkip = needsPostSort ? undefined : skip;

    // For storefront list, we need 2 images (first + second on hover). We fetch all images by order, then truncate in code — nested take in Prisma can only return 1.
    const imagesTake = Math.max(2, Math.min(imagesPerProduct || 2, 20));

    const [productsRaw, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: {
            orderBy: { order: 'asc' },
          },
          category: true,
          brand: true,
        },
        skip: fetchSkip,
        take: fetchLimit,
        orderBy,
      }),
      prisma.product.count({ where }),
    ]);

    // Images for list: raw SQL to product_images (bypass Prisma — guaranteed all rows by productId)
    const products = await Promise.all(
      productsRaw.map(async (p: any) => {
        const raw = await prisma.$queryRaw<
          Array<{ id: string; productId: string; url: string; alt: string | null; order: number }>
        >(Prisma.sql`
          SELECT id, "productId", url, alt, "order"
          FROM product_images
          WHERE "productId" = ${p.id}
          ORDER BY "order" ASC
        `);
        const images = raw.slice(0, imagesTake).map((row) => ({
          id: row.id,
          productId: row.productId,
          url: row.url,
          alt: row.alt,
          order: row.order,
        }));
        const inventory = await prisma.inventory.findMany({
          where: {
            productId: p.id,
            status: { in: [...this.storefrontStatuses] },
            quantity: { gt: 0 },
          },
          select: {
            status: true,
            quantity: true,
            reserved: true,
            variantId: true,
          },
        });
        return { ...p, images, ...this.extractComingSoonState(p, inventory) };
      })
    );

    // Post-sort for onSale: products with discount first (compareAtPrice > price)
    let sortedProducts = products;
    if (needsPostSort && sort) {
      sortedProducts = [...products].sort((a, b) => {
        // Helper function to convert Prisma Decimal to number
        const toNumber = (value: any): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number') return value;
          if (typeof value === 'object' && 'toNumber' in value) {
            return (value as any).toNumber();
          }
          if (typeof value === 'string') return parseFloat(value);
          return Number(value);
        };
        
        const aComparePrice = toNumber(a.compareAtPrice);
        const aPrice = toNumber(a.price);
        const bComparePrice = toNumber(b.compareAtPrice);
        const bPrice = toNumber(b.price);
        
        const aHasDiscount = aComparePrice !== null && aPrice !== null && aComparePrice > aPrice;
        const bHasDiscount = bComparePrice !== null && bPrice !== null && bComparePrice > bPrice;
        
        // Products with discount first
        if (aHasDiscount && !bHasDiscount) return -1;
        if (!aHasDiscount && bHasDiscount) return 1;
        
        // If both have discount or both don't, maintain original order (createdAt desc)
        return 0;
      });
      
      // Apply pagination after sorting
      sortedProducts = sortedProducts.slice(skip, skip + limit);
    }

    return {
      products: sortedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, languageCode?: string) {
    const normalizedLanguageCode = this.normalizeLanguageCode(languageCode);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        variants: true,
        category: true,
        brand: true,
        translations: true,
      },
    });

    if (!product) {
      return null;
    }

    // If language code is provided, merge translations
    if (normalizedLanguageCode) {
      const translation = await translationService.getProductTranslation(id, normalizedLanguageCode);
      if (translation) {
          return {
            ...product,
            name: translation.name || product.name,
            description: translation.description || product.description,
            material: translation.material || product.material,
            lining: translation.lining || product.lining,
            countryOfOrigin: translation.countryOfOrigin || product.countryOfOrigin,
          };
        }
    }

    return product;
  }

  async getBySlug(slug: string, languageCode?: string) {
    const normalizedLanguageCode = this.normalizeLanguageCode(languageCode);
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        variants: true,
        category: true,
        brand: true,
        translations: true,
      },
    });

    if (!product) {
      return null;
    }

    const hasSizesDefined = (s: unknown): boolean => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
      const o = s as Record<string, unknown>;
      const keys = ['CLOTHING', 'SHOES', 'CUSTOM', 'VOLUME', 'WEIGHT'];
      return keys.some(k => Array.isArray(o[k]) && (o[k] as unknown[]).length > 0);
    };

    const needsInventory =
      hasSizesDefined(product.sizes) || (product.variants && product.variants.length > 0);

    type InventoryWithVariant = Prisma.InventoryGetPayload<{
      include: { variant: { select: { id: true; name: true; sku: true; size: true } } };
    }>;
    let availableInventory: InventoryWithVariant[] = [];
    if (needsInventory) {
      const allInventory = await prisma.inventory.findMany({
        where: {
          productId: product.id,
          status: { in: [...this.storefrontStatuses] },
          quantity: { gt: 0 },
        },
        include: {
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              size: true,
            },
          },
        },
      });
      availableInventory = allInventory.filter(inv => this.hasAvailableInventory(inv.quantity, inv.reserved));
    }

    const displayInventory = availableInventory.filter(
      (inv) => inv.status === InventoryStatus.IN_SALE || inv.status === InventoryStatus.COMING_SOON
    );
    const comingSoonState = this.extractComingSoonState(product, availableInventory);

    // When product.sizes is null/empty but product has variants with IN_SALE stock, build sizes from variants
    if (!hasSizesDefined(product.sizes) && product.variants && product.variants.length > 0) {
      const sizeType =
        (Array.isArray(product.productType) && typeof product.productType[0] === 'string' && product.productType[0])
          ? String(product.productType[0])
          : 'CLOTHING';
      const sizeSet = new Set<string>();
      for (const inv of displayInventory) {
        if (inv.variantId && inv.variant?.size) {
          sizeSet.add(inv.variant.size.trim());
        }
      }
      // Base inventory (variantId null): show all variant sizes so UI is not "out of stock"
      if (sizeSet.size === 0 && displayInventory.some(inv => !inv.variantId)) {
        for (const v of product.variants) {
          if (v.size && String(v.size).trim()) sizeSet.add(String(v.size).trim());
        }
      }
      if (sizeSet.size > 0) {
        const arr = Array.from(sizeSet);
        product.sizes = { [sizeType]: arr } as Prisma.JsonObject;
      }
    }

    // Filter sizes based on available IN_SALE inventory
    if (product.sizes && typeof product.sizes === 'object' && !Array.isArray(product.sizes)) {
      const filteredSizes: any = {};

      const hasInventoryForSize = (size: string): boolean => {
        const sizeLower = size.toLowerCase().trim();
        const matchingVariant = product.variants?.find(v => {
          if (v.size && v.size.toLowerCase().trim() === sizeLower) return true;
          const variantName = v.name.toLowerCase();
          return variantName.includes(`size: ${sizeLower}`) ||
                 variantName.includes(`size:${sizeLower}`) ||
                 variantName === sizeLower ||
                 variantName.endsWith(` ${sizeLower}`) ||
                 variantName.startsWith(`${sizeLower} `);
        });
        if (matchingVariant) {
          return displayInventory.some(inv => inv.variantId === matchingVariant.id);
        }
        return displayInventory.some(inv => !inv.variantId);
      };

      if (product.sizes.CLOTHING && Array.isArray(product.sizes.CLOTHING)) {
        filteredSizes.CLOTHING = (product.sizes.CLOTHING as unknown as string[]).filter((size: string) =>
          hasInventoryForSize(size)
        );
      }
      if (product.sizes.SHOES && Array.isArray(product.sizes.SHOES)) {
        filteredSizes.SHOES = (product.sizes.SHOES as unknown as string[]).filter((size: string) =>
          hasInventoryForSize(size)
        );
      }
      if (product.sizes.CUSTOM && Array.isArray(product.sizes.CUSTOM)) {
        filteredSizes.CUSTOM = product.sizes.CUSTOM.filter((sizeObj: any) => {
          const sizeValue = typeof sizeObj === 'object' && 'value' in sizeObj ? sizeObj.value : String(sizeObj);
          return hasInventoryForSize(sizeValue);
        });
      }
      if (product.sizes.VOLUME && Array.isArray(product.sizes.VOLUME)) {
        filteredSizes.VOLUME = (product.sizes.VOLUME as unknown as string[]).filter((size: string) =>
          hasInventoryForSize(size)
        );
      }
      if (product.sizes.WEIGHT && Array.isArray(product.sizes.WEIGHT)) {
        filteredSizes.WEIGHT = (product.sizes.WEIGHT as unknown as string[]).filter((size: string) =>
          hasInventoryForSize(size)
        );
      }
      product.sizes = filteredSizes;
    }

    // If language code is provided, merge translations
    if (normalizedLanguageCode) {
      const translation = await translationService.getProductTranslation(product.id, normalizedLanguageCode);
      if (translation) {
        return {
          ...product,
          ...comingSoonState,
          name: translation.name || product.name,
          description: translation.description || product.description,
          material: translation.material || product.material,
          lining: translation.lining || product.lining,
          countryOfOrigin: translation.countryOfOrigin || product.countryOfOrigin,
        };
      }
    }

    return {
      ...product,
      ...comingSoonState,
    };
  }

  async create(data: CreateProductDto) {
    let slug = data.slug;
    if (!slug) {
      slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const existing = await prisma.product.findUnique({ where: { slug } });
      if (existing) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    // Validate: if priceOnRequest is true, price should be null/undefined
    // If priceOnRequest is false, price is required
    if (data.priceOnRequest && data.price !== undefined && data.price !== null) {
      throw new Error('Price must be empty when priceOnRequest is true');
    }
    if (!data.priceOnRequest && (data.price === undefined || data.price === null)) {
      throw new Error('Price is required when priceOnRequest is false');
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug,
        description: sanitizeHtmlContent(data.description) ?? data.description ?? null,
        sku: data.sku,
        price: data.price !== undefined && data.price !== null ? new Prisma.Decimal(data.price) : null,
        compareAtPrice: data.compareAtPrice ? new Prisma.Decimal(data.compareAtPrice) : null,
        priceOnRequest: data.priceOnRequest || false,
        categoryId: data.categoryId,
        brandId: data.brandId,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        productType: data.productTypes && data.productTypes.length > 0 ? (data.productTypes as Prisma.InputJsonValue) : Prisma.JsonNull,
        sizes: data.sizes ? (data.sizes as Prisma.InputJsonValue) : Prisma.JsonNull,
        color: data.colors && data.colors.length > 0 ? (data.colors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        material: data.material || null,
        lining: data.lining || null,
        application: data.application || null,
        countryOfOrigin: data.countryOfOrigin || null,
        hideColor: data.hideColor || false,
        hideMaterial: data.hideMaterial || false,
        hideLining: data.hideLining || false,
        hideCountryOfOrigin: data.hideCountryOfOrigin || false,
        relatedProducts: data.relatedProducts && data.relatedProducts.length > 0 ? (data.relatedProducts as Prisma.InputJsonValue) : Prisma.JsonNull,
        showCompleteTheLook: data.showCompleteTheLook !== undefined ? data.showCompleteTheLook : true,
        // SEO fields
        metaTitle: data.metaTitle || null,
        metaDescription: sanitizeHtmlContent(data.metaDescription) ?? data.metaDescription ?? null,
        metaKeywords: data.metaKeywords || null,
        // Admin-only: accounting & customs
        costPrice: data.costPrice != null ? new Prisma.Decimal(data.costPrice) : null,
        costCurrency: data.costCurrency || null,
        customsCode: data.customsCode || null,
        vatRate: data.vatRate != null ? new Prisma.Decimal(data.vatRate) : null,
        exciseGoods: data.exciseGoods ?? false,
        importDeclarationNumber: data.importDeclarationNumber || null,
        importDeclarationDate: data.importDeclarationDate ? new Date(data.importDeclarationDate) : null,
        customsValue: data.customsValue != null ? new Prisma.Decimal(data.customsValue) : null,
        customsValueCurrency: data.customsValueCurrency || null,
        weightNet: data.weightNet != null ? new Prisma.Decimal(data.weightNet) : null,
        weightGross: data.weightGross != null ? new Prisma.Decimal(data.weightGross) : null,
      },
    });
    
    console.log('ProductService.create - Created product with relatedProducts:', product.relatedProducts);
    return product;
  }

  async update(id: string, data: UpdateProductDto) {
    let slug = data.slug;
    if (!slug && data.name) {
      slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const existing = await prisma.product.findFirst({
        where: { slug, id: { not: id } },
      });
      if (existing) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    const currentProduct = await prisma.product.findUnique({ where: { id } });
    if (!currentProduct) {
      throw new Error('Product not found');
    }

    // Prepare update data
    const updateData: any = {};
    
    if (data.name) updateData.name = data.name;
    if (slug) updateData.slug = slug;
    if (data.description !== undefined) updateData.description = sanitizeHtmlContent(data.description) ?? data.description ?? null;
    if (data.sku) updateData.sku = data.sku;
    
    // Handle price and priceOnRequest
    if ('priceOnRequest' in data) {
      updateData.priceOnRequest = data.priceOnRequest;
      // If priceOnRequest is true, price should be null
      if (data.priceOnRequest) {
        updateData.price = null;
      } else {
        const nextPrice = 'price' in data ? data.price : currentProduct.price;
        if (nextPrice === undefined || nextPrice === null) {
          throw new Error('Price is required when priceOnRequest is false');
        }
      }
    }
    if ('price' in data) {
      // Validate: if priceOnRequest is true, price should be null/undefined
      const willBePriceOnRequest = data.priceOnRequest !== undefined ? data.priceOnRequest : (currentProduct.priceOnRequest || false);
      
      if (willBePriceOnRequest && data.price !== undefined && data.price !== null) {
        throw new Error('Price must be empty when priceOnRequest is true');
      }
      if (!willBePriceOnRequest && (data.price === undefined || data.price === null)) {
        throw new Error('Price is required when priceOnRequest is false');
      }
      
      updateData.price = data.price !== undefined && data.price !== null ? new Prisma.Decimal(data.price) : null;
    }
    
    if (data.compareAtPrice !== undefined) {
      updateData.compareAtPrice = data.compareAtPrice ? new Prisma.Decimal(data.compareAtPrice) : null;
    }
    if (data.categoryId) updateData.categoryId = data.categoryId;
    if (data.brandId !== undefined) updateData.brandId = data.brandId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    
    // Always update these fields if they are in the request (even if null/undefined)
    if ('productTypes' in data) {
      updateData.productType = data.productTypes && data.productTypes.length > 0 ? (data.productTypes as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if ('sizes' in data) {
      updateData.sizes = data.sizes ? (data.sizes as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if ('colors' in data) {
      updateData.color = data.colors && data.colors.length > 0 ? (data.colors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if ('material' in data) updateData.material = data.material || null;
    if ('lining' in data) updateData.lining = data.lining || null;
    if ('application' in data) updateData.application = data.application || null;
    if ('countryOfOrigin' in data) updateData.countryOfOrigin = data.countryOfOrigin || null;
    if ('hideColor' in data) updateData.hideColor = data.hideColor;
    if ('hideMaterial' in data) updateData.hideMaterial = data.hideMaterial;
    if ('hideLining' in data) updateData.hideLining = data.hideLining;
    if ('hideCountryOfOrigin' in data) updateData.hideCountryOfOrigin = data.hideCountryOfOrigin;
    if ('relatedProducts' in data) {
      updateData.relatedProducts = data.relatedProducts && data.relatedProducts.length > 0 ? (data.relatedProducts as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if ('showCompleteTheLook' in data) updateData.showCompleteTheLook = data.showCompleteTheLook;
    // SEO fields
    if ('metaTitle' in data) updateData.metaTitle = data.metaTitle || null;
    if ('metaDescription' in data) updateData.metaDescription = sanitizeHtmlContent(data.metaDescription) ?? data.metaDescription ?? null;
    if ('metaKeywords' in data) updateData.metaKeywords = data.metaKeywords || null;
    // Admin-only: accounting & customs
    if ('costPrice' in data) updateData.costPrice = data.costPrice != null ? new Prisma.Decimal(data.costPrice) : null;
    if ('costCurrency' in data) updateData.costCurrency = data.costCurrency || null;
    if ('customsCode' in data) updateData.customsCode = data.customsCode || null;
    if ('vatRate' in data) updateData.vatRate = data.vatRate != null ? new Prisma.Decimal(data.vatRate) : null;
    if ('exciseGoods' in data) updateData.exciseGoods = data.exciseGoods;
    if ('importDeclarationNumber' in data) updateData.importDeclarationNumber = data.importDeclarationNumber || null;
    if ('importDeclarationDate' in data) updateData.importDeclarationDate = data.importDeclarationDate ? new Date(data.importDeclarationDate) : null;
    if ('customsValue' in data) updateData.customsValue = data.customsValue != null ? new Prisma.Decimal(data.customsValue) : null;
    if ('customsValueCurrency' in data) updateData.customsValueCurrency = data.customsValueCurrency || null;
    if ('weightNet' in data) updateData.weightNet = data.weightNet != null ? new Prisma.Decimal(data.weightNet) : null;
    if ('weightGross' in data) updateData.weightGross = data.weightGross != null ? new Prisma.Decimal(data.weightGross) : null;
    if ('lengthCm' in data) updateData.lengthCm = data.lengthCm != null ? new Prisma.Decimal(data.lengthCm) : null;
    if ('widthCm' in data) updateData.widthCm = data.widthCm != null ? new Prisma.Decimal(data.widthCm) : null;
    if ('heightCm' in data) updateData.heightCm = data.heightCm != null ? new Prisma.Decimal(data.heightCm) : null;

    console.log('Updating product in database with:', JSON.stringify(updateData, null, 2));

    return prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    return prisma.product.delete({
      where: { id },
    });
  }

  // Images
  async addImage(data: CreateProductImageDto) {
    return prisma.productImage.create({
      data: {
        productId: data.productId,
        url: data.url,
        alt: data.alt,
        order: data.order,
      },
    });
  }

  async getImageById(id: string) {
    return prisma.productImage.findUnique({
      where: { id },
    });
  }

  async deleteImage(id: string) {
    return prisma.productImage.delete({
      where: { id },
    });
  }

  async reorderImages(_productId: string, imageOrders: { id: string; order: number }[]) {
    const updates = imageOrders.map(({ id, order }) =>
      prisma.productImage.update({
        where: { id },
        data: { order },
      })
    );

    return prisma.$transaction(updates);
  }

  // Variants
  async addVariant(data: CreateProductVariantDto) {
    return prisma.productVariant.create({
      data: {
        productId: data.productId,
        name: data.name,
        sku: data.sku,
        price: data.price ? new Prisma.Decimal(data.price) : null,
        size: data.size || null,
        showOnProduct: data.showOnProduct ?? false,
        costPrice: data.costPrice != null ? new Prisma.Decimal(data.costPrice) : null,
        customsCode: data.customsCode || null,
        vatRate: data.vatRate != null ? new Prisma.Decimal(data.vatRate) : null,
      },
    });
  }

  async updateVariant(
    id: string,
    data: {
      name?: string;
      sku?: string;
      price?: number | null;
      size?: string | null;
      showOnProduct?: boolean;
      costPrice?: number | null;
      customsCode?: string | null;
      vatRate?: number | null;
    }
  ) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.price !== undefined) updateData.price = data.price !== null ? new Prisma.Decimal(data.price) : null;
    if (data.size !== undefined) updateData.size = data.size || null;
    if (data.showOnProduct !== undefined) updateData.showOnProduct = data.showOnProduct;
    if (data.costPrice !== undefined) updateData.costPrice = data.costPrice != null ? new Prisma.Decimal(data.costPrice) : null;
    if (data.customsCode !== undefined) updateData.customsCode = data.customsCode || null;
    if (data.vatRate !== undefined) updateData.vatRate = data.vatRate != null ? new Prisma.Decimal(data.vatRate) : null;
    return prisma.productVariant.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteVariant(id: string) {
    return prisma.productVariant.delete({
      where: { id },
    });
  }

  // Search products for "Complete the look" feature
  // Note: This is for admin use, so we show all products (active and inactive)
  async searchProducts(searchQuery: string, limit: number = 20, excludeProductId?: string) {
    const trimmedQuery = searchQuery.trim();
    
    const where: Prisma.ProductWhereInput = {
      OR: [
        { name: { contains: trimmedQuery, mode: 'insensitive' } },
        { sku: { contains: trimmedQuery, mode: 'insensitive' } },
        { sku: { equals: trimmedQuery, mode: 'insensitive' } }, // Exact match for SKU (higher priority)
        { description: { contains: trimmedQuery, mode: 'insensitive' } },
        // Search by variant SKU
        {
          variants: {
            some: {
              sku: { contains: trimmedQuery, mode: 'insensitive' },
            },
          },
        },
        {
          variants: {
            some: {
              sku: { equals: trimmedQuery, mode: 'insensitive' }, // Exact match for variant SKU
            },
          },
        },
      ],
    };

    if (excludeProductId) {
      where.id = { not: excludeProductId };
    }

    console.log('ProductService.searchProducts - Query:', trimmedQuery, 'Where:', JSON.stringify(where, null, 2));

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        slug: true,
        price: true,
        priceOnRequest: true,
        isActive: true,
        images: {
          take: 1,
          orderBy: { order: 'asc' },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            name: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    console.log('ProductService.searchProducts - Found products:', products.length);
    console.log('ProductService.searchProducts - Products:', JSON.stringify(products.map(p => ({ id: p.id, name: p.name, sku: p.sku, variants: p.variants })), null, 2));
    return products;
  }

  /**
   * Get similar products (same category, optionally same brand) for "You might like" section.
   * Public API: only active products with stock.
   */
  async getSimilar(productId: string, limit: number = 8) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, brandId: true },
    });
    if (!product) return { products: [] };

    const categoryIds = await categoryService.getCategoryAndDescendantsIds(product.categoryId);
    const where: Prisma.ProductWhereInput = {
      id: { not: productId },
      isActive: true,
      categoryId: { in: categoryIds },
      inventory: {
        some: {
          status: { in: [...this.storefrontStatuses] },
          quantity: { gt: 0 },
        },
      },
    };
    if (product.brandId) {
      where.brandId = product.brandId;
    }

    const productsRaw = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { order: 'asc' } },
        category: true,
        brand: true,
      },
    });

    const products = await Promise.all(
      productsRaw.map(async (p: any) => {
        const raw = await prisma.$queryRaw<
          Array<{ id: string; productId: string; url: string; alt: string | null; order: number }>
        >(Prisma.sql`
          SELECT id, "productId", url, alt, "order"
          FROM product_images
          WHERE "productId" = ${p.id}
          ORDER BY "order" ASC
        `);
        const images = raw.slice(0, 2).map((row) => ({
          id: row.id,
          productId: row.productId,
          url: row.url,
          alt: row.alt,
          order: row.order,
        }));
        const inventory = await prisma.inventory.findMany({
          where: {
            productId: p.id,
            status: { in: [...this.storefrontStatuses] },
            quantity: { gt: 0 },
          },
          select: {
            status: true,
            quantity: true,
            reserved: true,
            variantId: true,
          },
        });
        return { ...p, images, ...this.extractComingSoonState(p, inventory) };
      })
    );

    return { products };
  }

  /**
   * Get available stock quantity for a product and size
   * Returns the total available quantity (quantity - reserved) across all warehouses
   * If size is provided but no variant found, returns 0 (not total product stock)
   */
  async getAvailableStock(productId: string, size?: string | null): Promise<number> {
    // If no size provided, return total stock for product without variants
    if (!size) {
      const inventories = await prisma.inventory.findMany({
        where: {
          productId,
          variantId: null, // Only base product inventory
          status: InventoryStatus.IN_SALE,
          quantity: { gt: 0 },
        },
      });

      return inventories.reduce((sum, inv) => {
        const available = inv.quantity - inv.reserved;
        return sum + Math.max(0, available);
      }, 0);
    }

    // Find variant by size if size is provided
    // Handle formats like "CLOTHING:S", "SHOES:42", "CUSTOM:100" or just "S"
    const sizeValue = size.includes(':') ? size.split(':')[1].trim() : size.trim();
    
    console.log(`[getAvailableStock] Looking for variant: productId=${productId}, size="${size}", sizeValue="${sizeValue}"`);
    
    // Try to find variant by size field first (most accurate)
    let variant = await prisma.productVariant.findFirst({
      where: {
        productId,
        size: {
          equals: sizeValue,
          mode: 'insensitive',
        },
      },
    });

    // If not found by size field, try by name with various patterns
    if (!variant) {
      variant = await prisma.productVariant.findFirst({
        where: {
          productId,
          OR: [
            { name: { contains: `Size: ${sizeValue}`, mode: 'insensitive' } },
            { name: { contains: `size: ${sizeValue}`, mode: 'insensitive' } },
            { name: { contains: `Size:${sizeValue}`, mode: 'insensitive' } },
            { name: { contains: `size:${sizeValue}`, mode: 'insensitive' } },
            { name: { equals: sizeValue, mode: 'insensitive' } },
            { name: { contains: sizeValue, mode: 'insensitive' } },
          ],
        },
      });
    }

    // If size is provided but variant not found, return 0
    // This ensures we don't return total product stock when checking specific size
    if (!variant) {
      console.warn(`[getAvailableStock] Variant not found for product ${productId} with size "${sizeValue}" (original: "${size}"). Returning 0.`);
      // Debug: list all variants for this product to help diagnose
      const allVariants = await prisma.productVariant.findMany({
        where: { productId },
        select: { id: true, name: true, size: true },
      });
      console.log(`[getAvailableStock] Available variants for product ${productId}:`, allVariants);
      return 0;
    }

    console.log(`[getAvailableStock] Found variant: id=${variant.id}, name="${variant.name}", size="${variant.size}"`);

    // Get all inventory for this specific variant
    const inventories = await prisma.inventory.findMany({
      where: {
        productId,
        variantId: variant.id,
        status: InventoryStatus.IN_SALE,
        quantity: { gt: 0 },
      },
    });

    let totalAvailable = inventories.reduce((sum, inv) => {
      const available = inv.quantity - inv.reserved;
      return sum + Math.max(0, available);
    }, 0);

    // Fallback: base inventory (variantId null) is shared across sizes — use it when variant has 0
    if (totalAvailable === 0) {
      const baseInventories = await prisma.inventory.findMany({
        where: {
          productId,
          variantId: null,
          status: InventoryStatus.IN_SALE,
          quantity: { gt: 0 },
        },
      });
      totalAvailable = baseInventories.reduce((sum, inv) => {
        const available = inv.quantity - inv.reserved;
        return sum + Math.max(0, available);
      }, 0);
    }

    return totalAvailable;
  }

  async isComingSoon(productId: string, size?: string | null): Promise<boolean> {
    const inventory = await prisma.inventory.findMany({
      where: {
        productId,
        status: { in: [...this.storefrontStatuses] },
        quantity: { gt: 0 },
      },
      include: {
        variant: {
          select: {
            id: true,
            size: true,
          },
        },
      },
    });

    const activeInventory = inventory.filter((inv) => this.hasAvailableInventory(inv.quantity, inv.reserved));
    if (activeInventory.length === 0) {
      return false;
    }

    if (!size) {
      const hasInSale = activeInventory.some((inv) => inv.status === InventoryStatus.IN_SALE);
      const hasComingSoon = activeInventory.some((inv) => inv.status === InventoryStatus.COMING_SOON);
      return !hasInSale && hasComingSoon;
    }

    const sizeValue = size.includes(':') ? size.split(':')[1].trim().toLowerCase() : size.trim().toLowerCase();
    const matchingInventory = activeInventory.filter(
      (inv) => {
        const variantSize = inv.variant?.size?.trim();
        return variantSize ? variantSize.toLowerCase() === sizeValue : false;
      }
    );

    if (matchingInventory.length === 0) {
      return false;
    }

    const hasInSale = matchingInventory.some((inv) => inv.status === InventoryStatus.IN_SALE);
    const hasComingSoon = matchingInventory.some((inv) => inv.status === InventoryStatus.COMING_SOON);
    return !hasInSale && hasComingSoon;
  }

  async getCatalogAttributeSuggestions(): Promise<{
    colors: Array<{ name: string; hex: string }>;
    countries: string[];
  }> {
    const colorRows = await prisma.$queryRaw<Array<{ name: string; hex: string }>>`
      SELECT DISTINCT ON (lower(trim(elem->>'name')))
        trim(elem->>'name') AS name,
        CASE
          WHEN trim(elem->>'hex') ~ '^#' THEN upper(trim(elem->>'hex'))
          ELSE '#' || upper(trim(elem->>'hex'))
        END AS hex
      FROM products, jsonb_array_elements(COALESCE(color, '[]'::jsonb)) AS elem
      WHERE jsonb_typeof(color) = 'array'
        AND elem->>'name' IS NOT NULL
        AND trim(elem->>'name') <> ''
        AND elem->>'hex' IS NOT NULL
        AND trim(elem->>'hex') <> ''
      ORDER BY lower(trim(elem->>'name')), trim(elem->>'name')
    `;

    const countryRows = await prisma.$queryRaw<Array<{ country: string }>>`
      SELECT DISTINCT trim("countryOfOrigin") AS country
      FROM products
      WHERE "countryOfOrigin" IS NOT NULL AND trim("countryOfOrigin") <> ''
      ORDER BY country
    `;

    const colors = colorRows
      .filter((row) => row.name && /^#[0-9A-F]{6}$/.test(row.hex))
      .map((row) => ({ name: row.name, hex: row.hex }));

    return {
      colors,
      countries: countryRows.map((row) => row.country).filter(Boolean),
    };
  }
}

export const productService = new ProductService();
