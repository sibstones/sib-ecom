import prisma from '../config/database';
import { CustomsDirection } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type CreateCustomsDeclarationDto = {
  declarationNumber: string;
  declarationDate: Date;
  direction: CustomsDirection;
  customsOffice?: string;
  customsProcedure?: string;
  totalCustomsValue?: number;
  totalCustomsValueCurrency?: string;
  vatAmount?: number;
  dutyAmount?: number;
  orderId?: string;
};

export type UpdateCustomsDeclarationDto = Partial<CreateCustomsDeclarationDto>;

export class CustomsService {
  async list(params: {
    startDate?: Date;
    endDate?: Date;
    direction?: CustomsDirection;
    orderId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.CustomsDeclarationWhereInput = {};
    if (params.startDate || params.endDate) {
      where.declarationDate = {};
      if (params.startDate) where.declarationDate.gte = params.startDate;
      if (params.endDate) where.declarationDate.lte = params.endDate;
    }
    if (params.direction) where.direction = params.direction;
    if (params.orderId) where.orderId = params.orderId;

    const [items, total] = await Promise.all([
      prisma.customsDeclaration.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, id: true } },
        },
        orderBy: { declarationDate: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      prisma.customsDeclaration.count({ where }),
    ]);

    return { items, total };
  }

  async getById(id: string) {
    return prisma.customsDeclaration.findUnique({
      where: { id },
      include: {
        order: { select: { orderNumber: true, id: true } },
        movements: true,
      },
    });
  }

  async create(dto: CreateCustomsDeclarationDto) {
    return prisma.customsDeclaration.create({
      data: {
        declarationNumber: dto.declarationNumber,
        declarationDate: dto.declarationDate,
        direction: dto.direction,
        customsOffice: dto.customsOffice,
        customsProcedure: dto.customsProcedure,
        totalCustomsValue: dto.totalCustomsValue != null ? new Prisma.Decimal(dto.totalCustomsValue) : null,
        totalCustomsValueCurrency: dto.totalCustomsValueCurrency,
        vatAmount: dto.vatAmount != null ? new Prisma.Decimal(dto.vatAmount) : null,
        dutyAmount: dto.dutyAmount != null ? new Prisma.Decimal(dto.dutyAmount) : null,
        orderId: dto.orderId,
      },
      include: {
        order: { select: { orderNumber: true } },
      },
    });
  }

  async update(id: string, dto: UpdateCustomsDeclarationDto) {
    const data: Prisma.CustomsDeclarationUpdateInput = {};
    if (dto.declarationNumber != null) data.declarationNumber = dto.declarationNumber;
    if (dto.declarationDate != null) data.declarationDate = dto.declarationDate;
    if (dto.direction != null) data.direction = dto.direction;
    if (dto.customsOffice !== undefined) data.customsOffice = dto.customsOffice;
    if (dto.customsProcedure !== undefined) data.customsProcedure = dto.customsProcedure;
    if (dto.totalCustomsValue !== undefined)
      data.totalCustomsValue = dto.totalCustomsValue != null ? new Prisma.Decimal(dto.totalCustomsValue) : null;
    if (dto.totalCustomsValueCurrency !== undefined) data.totalCustomsValueCurrency = dto.totalCustomsValueCurrency;
    if (dto.vatAmount !== undefined)
      data.vatAmount = dto.vatAmount != null ? new Prisma.Decimal(dto.vatAmount) : null;
    if (dto.dutyAmount !== undefined)
      data.dutyAmount = dto.dutyAmount != null ? new Prisma.Decimal(dto.dutyAmount) : null;
    if (dto.orderId !== undefined) data.order = { connect: { id: dto.orderId } };

    return prisma.customsDeclaration.update({
      where: { id },
      data,
      include: {
        order: { select: { orderNumber: true } },
      },
    });
  }

  async delete(id: string) {
    return prisma.customsDeclaration.delete({
      where: { id },
    });
  }
}

export const customsService = new CustomsService();
