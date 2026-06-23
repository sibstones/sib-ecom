import prisma from '../config/database';
import { CreateFooterDto, UpdateFooterDto } from '../types/footer';

export class FooterService {
  async getFooter(languageCode?: string) {
    try {
      // Get the first (and only) footer, or create default if none exists
      let footer = await prisma.footer.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      // If no footer exists, create a default one
      if (!footer) {
        footer = await prisma.footer.create({
          data: {
            brandName: 'LOGO',
            tagline: 'Style that defines you',
            columns: [
              { title: 'footer.shop', links: [{ text: 'footer.allProducts', url: '/shop' }] },
              { title: 'footer.company', links: [{ text: 'footer.about', url: '/about' }, { text: 'footer.contact', url: '/contact' }] },
              { title: 'footer.customer', links: [{ text: 'footer.myAccount', url: '/account' }, { text: 'footer.orders', url: '/account/orders' }, { text: 'footer.shipping', url: '/shipping' }, { text: 'footer.returns', url: '/returns' }] },
            ],
            copyright: '© {year} LOGO. All rights reserved.',
            links: [
              { text: 'footer.privacy', url: '/privacy' },
              { text: 'footer.terms', url: '/terms' },
            ],
            isActive: true,
          },
        });
      }

      // Apply translations if languageCode is provided
      if (languageCode) {
        const translation = await prisma.footerTranslation.findUnique({
          where: {
            footerId_languageCode: {
              footerId: footer.id,
              languageCode,
            },
          },
        });

        if (translation) {
          return {
            ...footer,
            brandName: translation.brandName || footer.brandName,
            tagline: translation.tagline || footer.tagline,
            columns: translation.columns || footer.columns,
            copyright: translation.copyright || footer.copyright,
            links: translation.links || footer.links,
            socialLinks: (translation.socialLinks ?? footer.socialLinks) as any,
          };
        }
      }

      return footer;
    } catch (error: unknown) {
      console.error('Error in footerService.getFooter:', error);
      throw error;
    }
  }

  async getFooterById(id: string) {
    try {
      const footer = await prisma.footer.findUnique({
        where: { id },
        include: {
          translations: true,
        },
      });
      return footer;
    } catch (error: unknown) {
      console.error('Error in footerService.getFooterById:', error);
      throw error;
    }
  }

  async createFooter(data: CreateFooterDto) {
    try {
      const footer = await prisma.footer.create({
        data: {
          brandName: data.brandName || 'LOGO',
          tagline: data.tagline,
          columns: (data.columns || []) as any,
          copyright: data.copyright || '© {year} LOGO. All rights reserved.',
          links: (data.links || []) as any,
          socialLinks: (data.socialLinks ?? undefined) as any,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });
      return footer;
    } catch (error: unknown) {
      console.error('Error in footerService.createFooter:', error);
      throw error;
    }
  }

  async updateFooter(id: string, data: UpdateFooterDto) {
    const updateData = {
      ...(data.brandName !== undefined && { brandName: data.brandName }),
      ...(data.tagline !== undefined && { tagline: data.tagline }),
      ...(data.columns !== undefined && { columns: data.columns as any }),
      ...(data.copyright !== undefined && { copyright: data.copyright }),
      ...(data.links !== undefined && { links: data.links as any }),
      ...(data.socialLinks !== undefined && { socialLinks: data.socialLinks as any }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };

    try {
      const footer = await prisma.footer.update({
        where: { id },
        data: updateData,
      });
      return footer;
    } catch (error: unknown) {
      const err = error as { message?: string };
      const isSocialLinksUnknown =
        typeof err?.message === 'string' &&
        err.message.includes('Unknown argument') &&
        err.message.includes('socialLinks');

      if (isSocialLinksUnknown && data.socialLinks !== undefined) {
        const { socialLinks: _socialLinks, ...rest } = updateData as typeof updateData & { socialLinks?: unknown };
        await prisma.footer.update({
          where: { id },
          data: rest,
        });
        await prisma.$executeRaw`
          UPDATE footers SET "socialLinks" = ${JSON.stringify(data.socialLinks)}::jsonb WHERE id = ${id}
        `;
        const updated = await prisma.footer.findUnique({ where: { id } });
        if (!updated) throw new Error('Footer not found after update');
        return updated;
      }
      console.error('Error in footerService.updateFooter:', error);
      throw error;
    }
  }

  async deleteFooter(id: string) {
    try {
      await prisma.footer.delete({
        where: { id },
      });
    } catch (error: unknown) {
      console.error('Error in footerService.deleteFooter:', error);
      throw error;
    }
  }
}

export const footerService = new FooterService();
