import prisma from '../config/database';
import { CreateBrandDto, UpdateBrandDto } from '../types/brand';

export class BrandService {
  async getAll() {
    return prisma.brand.findMany({
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    return prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async getBySlug(slug: string) {
    return prisma.brand.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async create(data: CreateBrandDto) {
    let slug = data.slug;
    if (!slug) {
      slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const existing = await prisma.brand.findUnique({ where: { slug } });
      if (existing) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    return prisma.brand.create({
      data: {
        name: data.name,
        slug,
        logo: data.logo,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateBrandDto) {
    // Check if brand exists
    const brand = await prisma.brand.findUnique({
      where: { id },
    });
    if (!brand) {
      throw new Error('Brand not found');
    }

    let slug = data.slug;
    if (!slug && data.name) {
      slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const existing = await prisma.brand.findFirst({
        where: { slug, id: { not: id } },
      });
      if (existing) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    return prisma.brand.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(slug && { slug }),
        ...(data.logo !== undefined && { logo: data.logo || null }),
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    // Check if brand has products
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!brand) {
      throw new Error('Brand not found');
    }

    if (brand._count.products > 0) {
      throw new Error('Cannot delete brand with products');
    }

    return prisma.brand.delete({
      where: { id },
    });
  }
}

export const brandService = new BrandService();
