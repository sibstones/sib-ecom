import prisma from '../config/database';
import { CreateCountryDto, UpdateCountryDto } from '../types/country';
import { defaultCountries } from '../scripts/init-default-countries-languages';

export class CountryService {
  private async ensureDefaultsExist() {
    const count = await prisma.country.count();
    if (count > 0) return;

    await prisma.country.createMany({
      data: defaultCountries.map((country, index) => ({
        code: country.code,
        name: country.name,
        nameNative: country.nameNative,
        currency: country.currency,
        language: country.language,
        taxRate: country.taxRate,
        shippingCost: country.shippingCost,
        freeShippingThreshold: country.freeShippingThreshold,
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
    return prisma.country.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    return prisma.country.findUnique({
      where: { id },
    });
  }

  async getByCode(code: string) {
    return prisma.country.findUnique({
      where: { code },
    });
  }

  /** First active country for a currency (default country preferred). */
  async getByCurrency(currency: string) {
    const normalized = (currency || '').trim().toUpperCase();
    if (!normalized) return null;

    return prisma.country.findFirst({
      where: { currency: normalized, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getDefault() {
    return prisma.country.findFirst({
      where: { isDefault: true, isActive: true },
    });
  }

  async create(data: CreateCountryDto) {
    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.country.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.country.create({
      data,
    });
  }

  async update(id: string, data: UpdateCountryDto) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.country.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.country.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.country.delete({
      where: { id },
    });
  }

  async setDefault(id: string) {
    // Unset all defaults
    await prisma.country.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    return prisma.country.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}

export const countryService = new CountryService();
