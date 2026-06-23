import prisma from '../config/database';
import { CreateLanguageDto, UpdateLanguageDto } from '../types/language';
import { defaultLanguages } from '../scripts/init-default-countries-languages';

export class LanguageService {
  private async ensureDefaultsExist() {
    const count = await prisma.language.count();
    if (count > 0) return;

    await prisma.language.createMany({
      data: defaultLanguages.map((language, index) => ({
        code: language.code,
        name: language.name,
        nameNative: language.nameNative,
        flag: language.flag,
        isActive: false,
        isDefault: false,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }

  async getAll(activeOnly = false) {
    await this.ensureDefaultsExist();
    const where = activeOnly ? { isActive: true } : {};
    return prisma.language.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    return prisma.language.findUnique({
      where: { id },
    });
  }

  async getByCode(code: string) {
    return prisma.language.findUnique({
      where: { code },
    });
  }

  async getDefault() {
    return prisma.language.findFirst({
      where: { isDefault: true, isActive: true },
    });
  }

  async create(data: CreateLanguageDto) {
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.language.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.language.create({
      data,
    });
  }

  async update(id: string, data: UpdateLanguageDto) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.language.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.language.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.language.delete({
      where: { id },
    });
  }

  async setDefault(id: string) {
    // Unset all defaults
    await prisma.language.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    return prisma.language.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}

export const languageService = new LanguageService();
