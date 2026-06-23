import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { AccountingAccountType } from '@prisma/client';

const SUPPORTED_REGIONS = ['RU', 'CN', 'EU', 'US', 'AE', 'HK'] as const;
const TRIGGER_EVENTS = [
  'ORDER_PAID',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'INVENTORY_RECEIVED',
  'RETURN_ACCEPTED',
  'CUSTOMS_IMPORT_REGISTERED',
] as const;

/** Reference of legal regimes by region for reports and entries (RU — full; CN/EU — templates; US/AE/HK — custom) */
const LEGAL_REGIMES_BY_REGION: Record<string, string[]> = {
  RU: ['RU_OSN', 'RU_USN', 'RU_PATENT'],
  CN: ['CN_DOMESTIC', 'CN_CROSS_BORDER', 'CN_FTZ'],
  EU: ['EU_OSS', 'EU_DOMESTIC', 'EU_B2B', 'EU_B2C'],
  US: ['US_STANDARD', 'US_SALES_TAX', 'US_EXEMPT'],
  AE: ['AE_STANDARD', 'AE_FREE_ZONE', 'AE_EXEMPT'],
  HK: ['HK_STANDARD', 'HK_EXEMPT'],
};

export type Region = (typeof SUPPORTED_REGIONS)[number];
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

/** Resolve dot path (e.g. order.total) from context object */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.trim().split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

/** Convert Prisma Decimal / value to number */
function toFormulaNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'object' && v !== null && 'toNumber' in v)
    return (v as { toNumber: () => number }).toNumber();
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Evaluate amount formula with context (order, movement, declaration, return).
 * Supports dot paths (order.total, movement.quantity * movement.purchasePrice) and arithmetic * / + -
 */
function evaluateAmountFormula(formula: string | null, context: Record<string, unknown>): number {
  if (!formula || !formula.trim()) return 0;
  const expr = formula.trim();
  const pathRegex = /[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+/g;
  let replaced = expr;
  const matches = [...expr.matchAll(pathRegex)];
  const uniquePaths = [...new Set(matches.map((m) => m[0]))].sort((a, b) => b.length - a.length);
  for (const path of uniquePaths) {
    const val = getByPath(context, path);
    const num = toFormulaNumber(val);
    replaced = replaced.replace(new RegExp(path.replace(/\./g, '\\.'), 'g'), String(num));
  }
  const singleIdRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  replaced = replaced.replace(singleIdRegex, (id) => {
    if (/^\d+$/.test(id)) return id;
    const val = getByPath(context, id);
    return String(toFormulaNumber(val));
  });
  if (!/^[\d\s+\-*/.()]+$/.test(replaced)) return 0;
  try {
    const result = new Function('return (' + replaced + ')')() as number;
    return typeof result === 'number' && !Number.isNaN(result) ? result : 0;
  } catch {
    return 0;
  }
}

export const accountingService = {
  SUPPORTED_REGIONS,
  TRIGGER_EVENTS,
  LEGAL_REGIMES_BY_REGION,

  // ——— Charts ———
  async listCharts(region?: string) {
    const where: Prisma.AccountingChartWhereInput = { isActive: true };
    if (region) where.region = region;
    return prisma.accountingChart.findMany({
      where,
      include: { items: { orderBy: { code: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  },

  async getChartById(id: string) {
    return prisma.accountingChart.findUnique({
      where: { id },
      include: { items: { orderBy: { code: 'asc' } } },
    });
  },

  async createChart(data: { region: string; name: string }) {
    return prisma.accountingChart.create({
      data: { region: data.region, name: data.name },
    });
  },

  async updateChart(id: string, data: { name?: string; isActive?: boolean }) {
    return prisma.accountingChart.update({
      where: { id },
      data,
    });
  },

  async deleteChart(id: string) {
    return prisma.accountingChart.delete({ where: { id } });
  },

  async addChartItem(
    chartId: string,
    data: { code: string; name: string; type: AccountingAccountType }
  ) {
    return prisma.accountingChartItem.create({
      data: { chartId, code: data.code, name: data.name, type: data.type },
    });
  },

  async updateChartItem(
    id: string,
    data: { code?: string; name?: string; type?: AccountingAccountType }
  ) {
    return prisma.accountingChartItem.update({
      where: { id },
      data,
    });
  },

  async deleteChartItem(id: string) {
    return prisma.accountingChartItem.delete({ where: { id } });
  },

  // ——— Templates ———
  async listTemplates(region?: string, legalRegime?: string) {
    const where: Prisma.AccountingEntryTemplateWhereInput = { isActive: true };
    if (region) where.region = region;
    if (legalRegime) where.legalRegime = legalRegime;
    return prisma.accountingEntryTemplate.findMany({
      where,
      include: { chart: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  },

  async getTemplateById(id: string) {
    return prisma.accountingEntryTemplate.findUnique({
      where: { id },
      include: { chart: true },
    });
  },

  async createTemplate(data: {
    chartId?: string | null;
    region: string;
    legalRegime?: string | null;
    name: string;
    triggerEvent: string;
    debitAccountCode: string;
    creditAccountCode: string;
    amountFormula?: string | null;
    analyticsMapping?: Prisma.InputJsonValue;
    sortOrder?: number;
  }) {
    return prisma.accountingEntryTemplate.create({
      data: {
        chartId: data.chartId,
        region: data.region,
        legalRegime: data.legalRegime,
        name: data.name,
        triggerEvent: data.triggerEvent,
        debitAccountCode: data.debitAccountCode,
        creditAccountCode: data.creditAccountCode,
        amountFormula: data.amountFormula,
        analyticsMapping: data.analyticsMapping ?? undefined,
        sortOrder: data.sortOrder ?? 0,
      },
      include: { chart: true },
    });
  },

  async updateTemplate(
    id: string,
    data: Partial<{
      chartId: string | null;
      region: string;
      legalRegime: string | null;
      name: string;
      triggerEvent: string;
      debitAccountCode: string;
      creditAccountCode: string;
      amountFormula: string | null;
      analyticsMapping: Prisma.InputJsonValue;
      isActive: boolean;
      sortOrder: number;
    }>
  ) {
    return prisma.accountingEntryTemplate.update({
      where: { id },
      data,
      include: { chart: true },
    });
  },

  async deleteTemplate(id: string) {
    return prisma.accountingEntryTemplate.delete({ where: { id } });
  },

  // ——— Entries ———
  async listEntries(params: {
    startDate?: Date;
    endDate?: Date;
    region?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.AccountingEntryWhereInput = {};
    if (params.startDate || params.endDate) {
      where.eventDate = {};
      if (params.startDate) where.eventDate.gte = params.startDate;
      if (params.endDate) where.eventDate.lte = params.endDate;
    }
    if (params.region) where.region = params.region;
    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;

    const [items, total] = await Promise.all([
      prisma.accountingEntry.findMany({
        where,
        include: { template: true },
        orderBy: { eventDate: 'desc' },
        take: params.limit ?? 100,
        skip: params.offset ?? 0,
      }),
      prisma.accountingEntry.count({ where }),
    ]);
    return { items, total };
  },

  async exportEntriesToCSV(entries: Array<{
    eventDate: Date;
    entityType: string;
    entityId: string;
    amount: unknown;
    currency: string;
    debitAccountCode: string;
    creditAccountCode: string;
    debitAccountName: string | null;
    creditAccountName: string | null;
    template?: { name: string } | null;
  }>) {
    if (entries.length === 0) return '';
    const headers = [
      'Date',
      'EntityType',
      'EntityId',
      'Debit',
      'Credit',
      'Amount',
      'Currency',
      'Template',
    ];
    const rows = entries.map((e) => [
      e.eventDate instanceof Date ? e.eventDate.toISOString().split('T')[0] : e.eventDate,
      e.entityType,
      e.entityId,
      e.debitAccountCode,
      e.creditAccountCode,
      typeof e.amount === 'object' && e.amount !== null && 'toNumber' in e.amount
        ? (e.amount as { toNumber: () => number }).toNumber()
        : Number(e.amount),
      e.currency,
      e.template?.name ?? '',
    ]);
    const escape = (v: unknown) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  },

  /** Generate entries for period from templates (ORDER_PAID, ORDER_SHIPPED, ORDER_DELIVERED, INVENTORY_RECEIVED, CUSTOMS_IMPORT_REGISTERED, RETURN_ACCEPTED) */
  async generateEntries(params: {
    startDate: Date;
    endDate: Date;
    region: string;
    legalRegime?: string | null;
  }) {
    const triggerEvents = [
      'ORDER_PAID',
      'ORDER_SHIPPED',
      'ORDER_DELIVERED',
      'INVENTORY_RECEIVED',
      'CUSTOMS_IMPORT_REGISTERED',
      'RETURN_ACCEPTED',
    ];
    const templates = await prisma.accountingEntryTemplate.findMany({
      where: {
        isActive: true,
        region: params.region,
        legalRegime: params.legalRegime ?? null,
        triggerEvent: { in: triggerEvents },
      },
    });
    if (templates.length === 0) return { generated: 0, message: 'No templates for region' };

    const created: string[] = [];

    for (const template of templates) {
      // ORDER_PAID: payment of the order (date — paidAt or updatedAt)
      if (template.triggerEvent === 'ORDER_PAID') {
        const orders = await prisma.order.findMany({
          where: {
            paymentStatus: 'PAID',
            OR: [
              { paymentRequest: { paidAt: { gte: params.startDate, lte: params.endDate } } },
              { updatedAt: { gte: params.startDate, lte: params.endDate } },
            ],
          },
          include: {
            user: { select: { email: true } },
            paymentRequest: { select: { paidAt: true } },
          },
        });
        for (const order of orders) {
          const eventDate = order.paymentRequest?.paidAt ?? order.updatedAt;
          if (eventDate < params.startDate || eventDate > params.endDate) continue;
          const existing = await prisma.accountingEntry.findFirst({
            where: {
              templateId: template.id,
              entityType: 'order',
              entityId: order.id,
              eventDate,
            },
          });
          if (existing) continue;
          let amount = evaluateAmountFormula(template.amountFormula, { order });
          if (amount === 0 && !template.amountFormula?.trim()) amount = Number(order.total);
          const entry = await prisma.accountingEntry.create({
            data: {
              templateId: template.id,
              region: params.region,
              legalRegime: params.legalRegime,
              entityType: 'order',
              entityId: order.id,
              eventDate,
              amount: new Prisma.Decimal(amount),
              currency: 'RUB',
              debitAccountCode: template.debitAccountCode,
              creditAccountCode: template.creditAccountCode,
              analytics: { orderNumber: order.orderNumber, customerEmail: order.user?.email },
            },
          });
          created.push(entry.id);
        }
      }

      // ORDER_SHIPPED / ORDER_DELIVERED: shipment (shippedAt in the period)
      if (template.triggerEvent === 'ORDER_SHIPPED' || template.triggerEvent === 'ORDER_DELIVERED') {
        const orders = await prisma.order.findMany({
          where: {
            paymentStatus: 'PAID',
            shippedAt: { gte: params.startDate, lte: params.endDate, not: null },
          },
          include: { user: { select: { email: true } } },
        });
        for (const order of orders) {
          const eventDate = order.shippedAt!;
          const existing = await prisma.accountingEntry.findFirst({
            where: {
              templateId: template.id,
              entityType: 'order',
              entityId: order.id,
              eventDate,
            },
          });
          if (existing) continue;
          let amount = evaluateAmountFormula(template.amountFormula, { order });
          if (amount === 0 && !template.amountFormula?.trim()) amount = Number(order.total);
          const entry = await prisma.accountingEntry.create({
            data: {
              templateId: template.id,
              region: params.region,
              legalRegime: params.legalRegime,
              entityType: 'order',
              entityId: order.id,
              eventDate,
              amount: new Prisma.Decimal(amount),
              currency: 'RUB',
              debitAccountCode: template.debitAccountCode,
              creditAccountCode: template.creditAccountCode,
              analytics: { orderNumber: order.orderNumber, customerEmail: order.user?.email },
            },
          });
          created.push(entry.id);
        }
      }

      if (template.triggerEvent === 'INVENTORY_RECEIVED') {
        const movements = await prisma.inventoryMovement.findMany({
          where: {
            type: 'IN',
            createdAt: { gte: params.startDate, lte: params.endDate },
          },
        });
        for (const m of movements) {
          const existing = await prisma.accountingEntry.findFirst({
            where: {
              templateId: template.id,
              entityType: 'inventory_movement',
              entityId: m.id,
              eventDate: m.createdAt,
            },
          });
          if (existing) continue;

          let amount = evaluateAmountFormula(template.amountFormula, { movement: m });
          if (amount === 0 && !template.amountFormula?.trim() && m.purchasePrice != null) {
            amount = m.quantity * Number(m.purchasePrice);
          }

          const entry = await prisma.accountingEntry.create({
            data: {
              templateId: template.id,
              region: params.region,
              legalRegime: params.legalRegime,
              entityType: 'inventory_movement',
              entityId: m.id,
              eventDate: m.createdAt,
              amount: new Prisma.Decimal(amount),
              currency: m.purchaseCurrency ?? 'RUB',
              debitAccountCode: template.debitAccountCode,
              creditAccountCode: template.creditAccountCode,
              analytics: { documentNumber: m.documentNumber, supplierName: m.supplierName },
            },
          });
          created.push(entry.id);
        }
      }

      // CUSTOMS_IMPORT_REGISTERED: import registered (customs declaration IMPORT in the period through customs declaration)
      if (template.triggerEvent === 'CUSTOMS_IMPORT_REGISTERED') {
        const declarations = await prisma.customsDeclaration.findMany({
          where: {
            direction: 'IMPORT',
            declarationDate: { gte: params.startDate, lte: params.endDate },
          },
          include: { order: { select: { orderNumber: true } } },
        });
        for (const decl of declarations) {
          const existing = await prisma.accountingEntry.findFirst({
            where: {
              templateId: template.id,
              entityType: 'customs_declaration',
              entityId: decl.id,
              eventDate: decl.declarationDate,
            },
          });
          if (existing) continue;
          let amount = evaluateAmountFormula(template.amountFormula, { declaration: decl });
          if (amount === 0 && !template.amountFormula?.trim() && decl.totalCustomsValue != null) {
            amount = Number(decl.totalCustomsValue);
          }
          const entry = await prisma.accountingEntry.create({
            data: {
              templateId: template.id,
              region: params.region,
              legalRegime: params.legalRegime,
              entityType: 'customs_declaration',
              entityId: decl.id,
              eventDate: decl.declarationDate,
              amount: new Prisma.Decimal(amount),
              currency: decl.totalCustomsValueCurrency ?? 'RUB',
              debitAccountCode: template.debitAccountCode,
              creditAccountCode: template.creditAccountCode,
              analytics: {
                declarationNumber: decl.declarationNumber,
                orderNumber: decl.order?.orderNumber,
              },
            },
          });
          created.push(entry.id);
        }
      }

      // RETURN_ACCEPTED: return accepted (ReturnRequest APPROVED or COMPLETED, updatedAt in the period through return request)
      if (template.triggerEvent === 'RETURN_ACCEPTED') {
        const returns = await prisma.returnRequest.findMany({
          where: {
            status: { in: ['APPROVED', 'COMPLETED'] },
            updatedAt: { gte: params.startDate, lte: params.endDate },
          },
          include: { order: { select: { orderNumber: true, total: true } } },
        });
        for (const ret of returns) {
          const eventDate = ret.updatedAt;
          const existing = await prisma.accountingEntry.findFirst({
            where: {
              templateId: template.id,
              entityType: 'return_request',
              entityId: ret.id,
              eventDate,
            },
          });
          if (existing) continue;
          let amount = evaluateAmountFormula(template.amountFormula, { return: ret });
          if (amount === 0 && !template.amountFormula?.trim()) {
            if (ret.refundAmount != null) amount = Number(ret.refundAmount);
            else if (ret.order?.total != null) amount = Number(ret.order.total);
          }
          const entry = await prisma.accountingEntry.create({
            data: {
              templateId: template.id,
              region: params.region,
              legalRegime: params.legalRegime,
              entityType: 'return_request',
              entityId: ret.id,
              eventDate,
              amount: new Prisma.Decimal(amount),
              currency: 'RUB',
              debitAccountCode: template.debitAccountCode,
              creditAccountCode: template.creditAccountCode,
              analytics: { orderNumber: ret.order?.orderNumber, returnId: ret.id },
            },
          });
          created.push(entry.id);
        }
      }
    }

    return { generated: created.length, entryIds: created };
  },
};
