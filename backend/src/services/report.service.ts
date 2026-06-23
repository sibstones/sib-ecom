import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

export class ReportService {
  async generateSalesReport(startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        paymentStatus: 'PAID',
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                vatRate: true,
                customsCode: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Product sales
    const productSales = new Map<string, { name: string; sku: string; quantity: number; revenue: number }>();
    
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.productId;
        const existing = productSales.get(key) || {
          name: item.product.name,
          sku: item.product.sku,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += item.quantity;
        existing.revenue += Number(item.price) * item.quantity;
        productSales.set(key, existing);
      });
    });

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
      },
      orders,
      productSales: Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue),
    };
  }

  async generateCustomerReport() {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      include: {
        orders: {
          include: {
            items: true,
          },
        },
      },
    });

    return customers.map((customer) => {
      const totalSpent = customer.orders
        .filter((o) => o.paymentStatus === 'PAID')
        .reduce((sum, order) => sum + Number(order.total), 0);

      return {
        id: customer.id,
        email: customer.email,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
        totalOrders: customer.orders.length,
        totalSpent,
        averageOrderValue: customer.orders.length > 0 ? totalSpent / customer.orders.length : 0,
        lastOrderDate: customer.orders[0]?.createdAt || null,
      };
    });
  }

  /**
   * Format a value for CSV export
   */
  private formatCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Handle dates
    if (value instanceof Date) {
      return value.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Handle Decimal/Prisma Decimal
    if (typeof value === 'object' && value !== null && 'toNumber' in value) {
      return String(value.toNumber());
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((v) => this.formatCSVValue(v)).join('; ');
    }

    // Handle objects
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    // Handle strings - escape commas and quotes
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Export sales report to CSV format
   * Creates a flat structure where each row represents an order item
   */
  async exportSalesReportToCSV(orders: any[]): Promise<string> {
    if (orders.length === 0) {
      return '';
    }

    const headers = [
      'Order Number',
      'Order Date',
      'Customer Email',
      'Status',
      'Payment Status',
      'Product Name',
      'Product SKU',
      'Category',
      'Size',
      'Quantity',
      'Item Price',
      'Item Total',
      'Order Subtotal',
      'Tax',
      'Shipping',
      'Order Total',
    ];

    const rows: string[][] = [];

    orders.forEach((order) => {
      const orderDate = order.createdAt instanceof Date 
        ? order.createdAt.toISOString().split('T')[0]
        : new Date(order.createdAt).toISOString().split('T')[0];
      
      const customerEmail = order.user?.email || '';
      const orderSubtotal = Number(order.subtotal);
      const tax = Number(order.tax);
      const shipping = Number(order.shipping);
      const orderTotal = Number(order.total);

      if (order.items && order.items.length > 0) {
        order.items.forEach((item: any) => {
          const itemPrice = Number(item.price) || 0;
          const itemTotal = itemPrice * item.quantity;
          const productName = item.product?.name || '';
          const productSku = item.product?.sku || '';
          const category = item.product?.category?.name || '';

          rows.push([
            order.orderNumber,
            orderDate,
            customerEmail,
            order.status,
            order.paymentStatus,
            productName,
            productSku,
            category,
            item.size || '',
            String(item.quantity),
            itemPrice.toFixed(2),
            itemTotal.toFixed(2),
            orderSubtotal.toFixed(2),
            tax.toFixed(2),
            shipping.toFixed(2),
            orderTotal.toFixed(2),
          ]);
        });
      } else {
        // Order without items
        rows.push([
          order.orderNumber,
          orderDate,
          customerEmail,
          order.status,
          order.paymentStatus,
          '',
          '',
          '',
          '',
          '0',
          '0.00',
          '0.00',
          orderSubtotal.toFixed(2),
          tax.toFixed(2),
          shipping.toFixed(2),
          orderTotal.toFixed(2),
        ]);
      }
    });

    const csvRows = rows.map((row) =>
      row.map((cell) => this.formatCSVValue(cell)).join(',')
    );

    return [headers.join(','), ...csvRows].join('\n');
  }

  /**
   * Export sales report to XLSX (Phase 5 — export for FNS/1C)
   */
  async exportSalesReportToXLSX(orders: any[]): Promise<Buffer> {
    const rows: Record<string, unknown>[] = [];
    orders.forEach((order) => {
      const orderDate = order.createdAt instanceof Date
        ? order.createdAt.toISOString().split('T')[0]
        : new Date(order.createdAt).toISOString().split('T')[0];
      const customerEmail = order.user?.email || '';
      const orderSubtotal = Number(order.subtotal);
      const tax = Number(order.tax);
      const shipping = Number(order.shipping);
      const orderTotal = Number(order.total);

      if (order.items?.length) {
        order.items.forEach((item: any) => {
          const itemPrice = Number(item.price) || 0;
          const itemTotal = itemPrice * item.quantity;
          rows.push({
            'Order Number': order.orderNumber,
            'Order Date': orderDate,
            'Customer Email': customerEmail,
            'Status': order.status,
            'Payment Status': order.paymentStatus,
            'Product Name': item.product?.name || '',
            'Product SKU': item.product?.sku || '',
            'Category': item.product?.category?.name || '',
            'Size': item.size || '',
            'Quantity': item.quantity,
            'Item Price': itemPrice,
            'Line Total': itemTotal,
            'Subtotal': orderSubtotal,
            'Tax': tax,
            'Shipping': shipping,
            'Total': orderTotal,
          });
        });
      } else {
        rows.push({
          'Order Number': order.orderNumber,
          'Order Date': orderDate,
          'Customer Email': customerEmail,
          'Status': order.status,
          'Payment Status': order.paymentStatus,
          'Product Name': '',
          'Product SKU': '',
          'Category': '',
          'Size': '',
          'Quantity': 0,
          'Item Price': 0,
          'Line Total': 0,
          'Subtotal': orderSubtotal,
          'Tax': tax,
          'Shipping': shipping,
          'Total': orderTotal,
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No data': '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  /** Export purchases report to XLSX */
  async exportPurchasesReportToXLSX(movements: any[]): Promise<Buffer> {
    const rows = movements.map((m: any) => ({
      'Date': m.createdAt instanceof Date ? m.createdAt.toISOString().split('T')[0] : m.createdAt,
      'Document Number': m.documentNumber ?? '',
      'Document Date': m.documentDate ? (m.documentDate instanceof Date ? m.documentDate.toISOString().split('T')[0] : m.documentDate) : '',
      'Warehouse': m.warehouse?.name ?? '',
      'Supplier Name': m.supplierName ?? '',
      'Supplier INN': m.supplierInn ?? '',
      'Supplier VAT': m.supplierVatNumber ?? '',
      'Product ID': m.productId,
      'Quantity': m.quantity,
      'Purchase Price': m.purchasePrice != null ? Number(m.purchasePrice) : '',
      'Currency': m.purchaseCurrency ?? '',
      'Total': m.purchasePrice != null ? Number(m.purchasePrice) * m.quantity : '',
      'Customs Declaration': m.customsDeclaration?.declarationNumber ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No data': '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  /** Export delivery report to XLSX */
  async exportDeliveryReportToXLSX(orders: any[]): Promise<Buffer> {
    const rows = orders.map((o: any) => ({
      'Order Number': o.orderNumber,
      'Order Date': o.createdAt instanceof Date ? o.createdAt.toISOString().split('T')[0] : o.createdAt,
      'Shipped At': o.shippedAt ? (o.shippedAt instanceof Date ? o.shippedAt.toISOString().split('T')[0] : o.shippedAt) : '',
      'Customer Email': o.user?.email ?? '',
      'Delivery Method': o.deliveryMethod ?? '',
      'Carrier': o.carrierName ?? '',
      'Waybill Number': o.waybillNumber ?? '',
      'Waybill Date': o.waybillDate ? (o.waybillDate instanceof Date ? o.waybillDate.toISOString().split('T')[0] : o.waybillDate) : '',
      'Total': o.total != null ? Number(o.total) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No data': '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  /** Export customs report to XLSX */
  async exportCustomsReportToXLSX(declarations: any[]): Promise<Buffer> {
    const rows = declarations.map((d: any) => ({
      'Declaration Number': d.declarationNumber,
      'Declaration Date': d.declarationDate instanceof Date ? d.declarationDate.toISOString().split('T')[0] : d.declarationDate,
      'Direction': d.direction,
      'Customs Office': d.customsOffice ?? '',
      'Procedure': d.customsProcedure ?? '',
      'Total Customs Value': d.totalCustomsValue != null ? Number(d.totalCustomsValue) : '',
      'Currency': d.totalCustomsValueCurrency ?? '',
      'VAT Amount': d.vatAmount != null ? Number(d.vatAmount) : '',
      'Duty Amount': d.dutyAmount != null ? Number(d.dutyAmount) : '',
      'Order Number': d.order?.orderNumber ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No data': '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customs');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  /** Purchases report (inventory movements IN) for tax/accounting */
  async generatePurchasesReport(startDate: Date, endDate: Date, warehouseId?: string) {
    const where: Prisma.InventoryMovementWhereInput = {
      type: 'IN',
      createdAt: { gte: startDate, lte: endDate },
    };
    if (warehouseId) where.warehouseId = warehouseId;

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        warehouse: { select: { name: true, id: true } },
        customsDeclaration: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPurchaseValue = movements.reduce(
      (sum, m) => sum + (m.purchasePrice ? Number(m.purchasePrice) * m.quantity : 0),
      0
    );

    return {
      period: { start: startDate, end: endDate },
      summary: { totalMovements: movements.length, totalPurchaseValue },
      movements,
    };
  }

  /** Delivery report: orders with filled shipment date in period (no payment filter) */
  async generateDeliveryReport(startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        shippedAt: { gte: startDate, lte: endDate, not: null },
      },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        paymentRequest: { select: { logisticsInfo: true } },
      },
      orderBy: { shippedAt: 'desc' },
    });

    return {
      period: { start: startDate, end: endDate },
      summary: { totalOrders: orders.length },
      orders,
    };
  }

  /** Customs declarations report */
  async generateCustomsReport(startDate: Date, endDate: Date) {
    const declarations = await prisma.customsDeclaration.findMany({
      where: {
        declarationDate: { gte: startDate, lte: endDate },
      },
      include: {
        order: { select: { orderNumber: true, id: true } },
      },
      orderBy: { declarationDate: 'desc' },
    });

    const totalVat = declarations.reduce(
      (sum, d) => sum + (d.vatAmount ? Number(d.vatAmount) : 0),
      0
    );
    const totalDuty = declarations.reduce(
      (sum, d) => sum + (d.dutyAmount ? Number(d.dutyAmount) : 0),
      0
    );

    return {
      period: { start: startDate, end: endDate },
      summary: { totalDeclarations: declarations.length, totalVat, totalDuty },
      declarations,
    };
  }

  /** Tax summary for period (RU-oriented aggregates) */
  async generateTaxSummaryReport(
    startDate: Date,
    endDate: Date,
    region: string = 'RU'
  ) {
    const [salesReport, purchasesReport, customsReport] = await Promise.all([
      this.generateSalesReport(startDate, endDate),
      this.generatePurchasesReport(startDate, endDate),
      this.generateCustomsReport(startDate, endDate),
    ]);

    const totalRevenue = salesReport.summary.totalRevenue;
    const totalOrders = salesReport.summary.totalOrders;
    const totalPurchaseValue = purchasesReport.summary.totalPurchaseValue;
    const customsVat = (customsReport.summary as { totalVat: number }).totalVat;
    const customsDuty = (customsReport.summary as { totalDuty: number }).totalDuty;

    return {
      period: { start: startDate, end: endDate },
      region,
      summary: {
        totalRevenue,
        totalOrders,
        totalPurchaseValue,
        customsVat,
        customsDuty,
      },
    };
  }

  async exportPurchasesReportToCSV(movements: any[]): Promise<string> {
    if (movements.length === 0) return '';
    const headers = [
      'Date',
      'Document Number',
      'Document Date',
      'Warehouse',
      'Supplier Name',
      'Supplier INN',
      'Supplier VAT',
      'Product ID',
      'Quantity',
      'Purchase Price',
      'Currency',
      'Total',
      'Customs Declaration',
    ];
    const rows = movements.map((m: any) => [
      m.createdAt instanceof Date ? m.createdAt.toISOString().split('T')[0] : m.createdAt,
      m.documentNumber ?? '',
      m.documentDate ? (m.documentDate instanceof Date ? m.documentDate.toISOString().split('T')[0] : m.documentDate) : '',
      m.warehouse?.name ?? '',
      m.supplierName ?? '',
      m.supplierInn ?? '',
      m.supplierVatNumber ?? '',
      m.productId,
      String(m.quantity),
      m.purchasePrice != null ? Number(m.purchasePrice).toFixed(2) : '',
      m.purchaseCurrency ?? '',
      m.purchasePrice != null ? (Number(m.purchasePrice) * m.quantity).toFixed(2) : '',
      m.customsDeclaration?.declarationNumber ?? '',
    ]);
    const csvRows = rows.map((row: any[]) => row.map((c) => this.formatCSVValue(c)).join(','));
    return [headers.join(','), ...csvRows].join('\n');
  }

  async exportDeliveryReportToCSV(orders: any[]): Promise<string> {
    if (orders.length === 0) return '';
    const headers = [
      'Order Number',
      'Order Date',
      'Shipped At',
      'Customer Email',
      'Delivery Method',
      'Carrier',
      'Waybill Number',
      'Waybill Date',
      'Total',
    ];
    const rows = orders.map((o: any) => [
      o.orderNumber,
      o.createdAt instanceof Date ? o.createdAt.toISOString().split('T')[0] : o.createdAt,
      o.shippedAt ? (o.shippedAt instanceof Date ? o.shippedAt.toISOString().split('T')[0] : o.shippedAt) : '',
      o.user?.email ?? '',
      o.deliveryMethod ?? '',
      o.carrierName ?? '',
      o.waybillNumber ?? '',
      o.waybillDate ? (o.waybillDate instanceof Date ? o.waybillDate.toISOString().split('T')[0] : o.waybillDate) : '',
      o.total != null ? Number(o.total).toFixed(2) : '',
    ]);
    const csvRows = rows.map((row: any[]) => row.map((c) => this.formatCSVValue(c)).join(','));
    return [headers.join(','), ...csvRows].join('\n');
  }

  async exportCustomsReportToCSV(declarations: any[]): Promise<string> {
    if (declarations.length === 0) return '';
    const headers = [
      'Declaration Number',
      'Declaration Date',
      'Direction',
      'Customs Office',
      'Procedure',
      'Total Value',
      'Currency',
      'VAT Amount',
      'Duty Amount',
      'Order Number',
    ];
    const rows = declarations.map((d: any) => [
      d.declarationNumber,
      d.declarationDate instanceof Date ? d.declarationDate.toISOString().split('T')[0] : d.declarationDate,
      d.direction,
      d.customsOffice ?? '',
      d.customsProcedure ?? '',
      d.totalCustomsValue != null ? Number(d.totalCustomsValue).toFixed(2) : '',
      d.totalCustomsValueCurrency ?? '',
      d.vatAmount != null ? Number(d.vatAmount).toFixed(2) : '',
      d.dutyAmount != null ? Number(d.dutyAmount).toFixed(2) : '',
      d.order?.orderNumber ?? '',
    ]);
    const csvRows = rows.map((row: any[]) => row.map((c) => this.formatCSVValue(c)).join(','));
    return [headers.join(','), ...csvRows].join('\n');
  }

  /**
   * Export customer report or other simple data structures to CSV
   */
  async exportToCSV(data: any[], _filename: string): Promise<string> {
    if (data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        return this.formatCSVValue(value);
      })
    );

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    return csv;
  }
}

export const reportService = new ReportService();
