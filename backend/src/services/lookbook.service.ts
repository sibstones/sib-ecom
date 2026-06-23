import prisma from '../config/database';
import { CreateLookbookDto, UpdateLookbookDto, CreateLookbookImageDto, UpdateLookbookImageDto, CreateProductTagDto } from '../types/lookbook';
import { translationService } from './translation.service';

export class LookbookService {
  async getAll(activeOnly: boolean = false, languageCode?: string) {
    try {
      const where = activeOnly ? { isActive: true } : {};
      
      const lookbooks = await prisma.lookbook.findMany({
        where,
        include: {
          images: {
            orderBy: { order: 'asc' },
            take: 1, // Get first image for preview
          },
        },
        orderBy: [
          { year: 'desc' },
          { season: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      // Apply translations if languageCode is provided
      if (languageCode) {
        const lookbooksWithTranslations = await Promise.all(
          lookbooks.map(async (lookbook) => {
            const translation = await translationService.getLookbookTranslation(
              lookbook.id,
              languageCode
            );

            if (translation) {
              return {
                ...lookbook,
                title: translation.title || lookbook.title,
                description: translation.description || lookbook.description,
              };
            }

            return lookbook;
          })
        );

        return lookbooksWithTranslations;
      }

      return lookbooks;
    } catch (error: unknown) {
      console.error('Error in lookbookService.getAll:', error);
      
      if (error instanceof Error) {
        const errorMessage = error.message;
        const errorCode = (error as any)?.code;
        
        // Table doesn't exist (P2021, P2022, or specific error messages)
        if (
          errorCode === 'P2021' || 
          errorCode === 'P2022' ||
          errorMessage.includes('does not exist') || 
          errorMessage.includes('Unknown table') ||
          errorMessage.includes('relation') ||
          (errorMessage.includes('table') && errorMessage.includes('not found'))
        ) {
          console.warn('⚠️  Lookbook table may not exist. Run migrations: npm run prisma:migrate');
          return [];
        }
        
        // Database connection error (P1001, P1002, P1003)
        if (
          errorCode === 'P1001' ||
          errorCode === 'P1002' ||
          errorCode === 'P1003' ||
          errorMessage.includes('Can\'t reach database') || 
          errorMessage.includes('Connection') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('timeout')
        ) {
          console.error('❌ Database connection error. Check DATABASE_URL in .env');
          throw new Error('Database connection failed. Please check your database configuration.');
        }
        
        // Read-only file system error (PostgreSQL file system issue)
        if (
          errorMessage.includes('Read-only file system') ||
          errorMessage.includes('read-only') ||
          errorMessage.includes('could not open file') ||
          errorCode === '42501'
        ) {
          console.error('❌ Database file system is read-only. This may indicate:');
          console.error('   1. Database volume is mounted as read-only');
          console.error('   2. Database container lacks write permissions');
          console.error('   3. Database filesystem is corrupted');
          console.error('   4. Disk space issues');
          console.error('   Solution: Check Docker volume permissions and restart the database container.');
          throw new Error('Database is in read-only mode. Please check database volume permissions and container configuration.');
        }
        
        // Prisma client not generated
        if (
          errorMessage.includes('PrismaClient') || 
          errorMessage.includes('generated') ||
          errorMessage.includes('Cannot find module')
        ) {
          console.error('❌ Prisma Client not generated. Run: npm run prisma:generate');
          throw new Error('Database client not initialized. Please run: npm run prisma:generate');
        }
        
        // Authentication error
        if (errorCode === 'P1000' || errorMessage.includes('authentication')) {
          console.error('❌ Database authentication failed. Check DATABASE_URL credentials.');
          throw new Error('Database authentication failed. Please check your database credentials.');
        }
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  async getById(id: string) {
    return prisma.lookbook.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { order: 'asc' },
          include: {
            productTags: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    price: true,
                    images: {
                      take: 1,
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getBySlug(slug: string, languageCode?: string) {
    const lookbook = await prisma.lookbook.findUnique({
      where: { slug },
      include: {
        images: {
          orderBy: { order: 'asc' },
          include: {
            productTags: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    price: true,
                    images: {
                      take: 1,
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lookbook) {
      return null;
    }

    // Apply translations if languageCode is provided
    if (languageCode) {
      const translation = await translationService.getLookbookTranslation(lookbook.id, languageCode);
      
      if (translation) {
        return {
          ...lookbook,
          title: translation.title || lookbook.title,
          description: translation.description || lookbook.description,
        };
      }
    }

    return lookbook;
  }

  async create(data: CreateLookbookDto) {
    // Generate slug if not provided
    let slug = data.slug;
    if (!slug) {
      slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Ensure uniqueness
      const existing = await prisma.lookbook.findUnique({ where: { slug } });
      if (existing) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    return prisma.lookbook.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        season: data.season,
        year: data.year,
        isActive: data.isActive,
      },
    });
  }

  async update(id: string, data: UpdateLookbookDto) {
    // Handle slug update
    if (data.slug || data.title) {
      let slug = data.slug;
      if (!slug && data.title) {
        slug = data.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        // Check uniqueness
        const existing = await prisma.lookbook.findFirst({
          where: { slug, id: { not: id } },
        });
        if (existing) {
          slug = `${slug}-${Date.now()}`;
        }
      }

      return prisma.lookbook.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title }),
          ...(slug && { slug }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.season !== undefined && { season: data.season }),
          ...(data.year !== undefined && { year: data.year }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
    }

    return prisma.lookbook.update({
      where: { id },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.season !== undefined && { season: data.season }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(id: string) {
    return prisma.lookbook.delete({
      where: { id },
    });
  }

  // Image management
  async addImage(data: CreateLookbookImageDto) {
    return prisma.lookbookImage.create({
      data: {
        lookbookId: data.lookbookId,
        url: data.url,
        alt: data.alt,
        order: data.order,
      },
    });
  }

  async updateImage(id: string, data: UpdateLookbookImageDto) {
    return prisma.lookbookImage.update({
      where: { id },
      data: {
        ...(data.url && { url: data.url }),
        ...(data.alt !== undefined && { alt: data.alt }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
  }

  async getImageById(id: string) {
    return prisma.lookbookImage.findUnique({
      where: { id },
    });
  }

  async deleteImage(id: string) {
    return prisma.lookbookImage.delete({
      where: { id },
    });
  }

  async reorderImages(lookbookId: string, imageOrders: { id: string; order: number }[]) {
    const updates = imageOrders.map(({ id, order }) =>
      prisma.lookbookImage.update({
        where: { id },
        data: { order },
      })
    );

    return prisma.$transaction(updates);
  }

  // Product tags
  async addProductTag(data: CreateProductTagDto) {
    return prisma.lookbookProductTag.create({
      data: {
        lookbookImageId: data.lookbookImageId,
        productId: data.productId,
        x: data.x,
        y: data.y,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
          },
        },
      },
    });
  }

  async deleteProductTag(id: string) {
    return prisma.lookbookProductTag.delete({
      where: { id },
    });
  }
}

export const lookbookService = new LookbookService();
