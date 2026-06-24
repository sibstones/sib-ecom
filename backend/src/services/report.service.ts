import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

export class ReportService {
  private createXLSXBuffer(
    sheetName: string,
    rows: Record<string, unknown>[],
    headers: string[]
  ): Buffer {
    const ws =
      rows.length > 0
        ? XLSX.utils.json_to_sheet(rows, { header: headers })
        : XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  private buildCSV(headers: string[], rows: Array<Array<string | number>>): string {
    const csvRows = rows.map((row) => row.map((cell) => this.formatCSVValue(cell)).join(','));
    return [headers.join(','), ...csvRows].join('\n');
  }

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

  async generateCustomerReport(startDate?: Date, endDate?: Date) {
    const orderDateFilter =
      startDate && endDate
        ? {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {};

    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(startDate && endDate
          ? {
              orders: {
                some: orderDateFilter,
              },
            }
          : {}),
      },
      include: {
        orders: {
          where: orderDateFilter,
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'desc',
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

    return this.buildCSV(headers, rows);
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
      'Line Total',
      'Subtotal',
      'Tax',
      'Shipping',
      'Total',
    ];
    return this.createXLSXBuffer('Sales', rows, headers);
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
    return this.createXLSXBuffer('Purchases', rows, headers);
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
    return this.createXLSXBuffer('Delivery', rows, headers);
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
    const headers = [
      'Declaration Number',
      'Declaration Date',
      'Direction',
      'Customs Office',
      'Procedure',
      'Total Customs Value',
      'Currency',
      'VAT Amount',
      'Duty Amount',
      'Order Number',
    ];
    return this.createXLSXBuffer('Customs', rows, headers);
  }

  async exportCustomerReportToXLSX(customers: any[]): Promise<Buffer> {
    const rows = customers.map((customer: any) => ({
      'Customer ID': customer.id,
      'Email': customer.email,
      'Name': customer.name || '',
      'Total Orders': customer.totalOrders,
      'Total Spent': Number(customer.totalSpent ?? 0),
      'Average Order Value': Number(customer.averageOrderValue ?? 0),
      'Last Order Date': customer.lastOrderDate
        ? customer.lastOrderDate instanceof Date
          ? customer.lastOrderDate.toISOString().split('T')[0]
          : new Date(customer.lastOrderDate).toISOString().split('T')[0]
        : '',
    }));
    const headers = [
      'Customer ID',
      'Email',
      'Name',
      'Total Orders',
      'Total Spent',
      'Average Order Value',
      'Last Order Date',
    ];
    return this.createXLSXBuffer('Customers', rows, headers);
  }

  async exportCustomerReportToCSV(customers: any[]): Promise<string> {
    const headers = [
      'Customer ID',
      'Email',
      'Name',
      'Total Orders',
      'Total Spent',
      'Average Order Value',
      'Last Order Date',
    ];
    const rows = customers.map((customer: any) => [
      customer.id,
      customer.email,
      customer.name || '',
      customer.totalOrders ?? 0,
      Number(customer.totalSpent ?? 0).toFixed(2),
      Number(customer.averageOrderValue ?? 0).toFixed(2),
      customer.lastOrderDate
        ? customer.lastOrderDate instanceof Date
          ? customer.lastOrderDate.toISOString().split('T')[0]
          : new Date(customer.lastOrderDate).toISOString().split('T')[0]
        : '',
    ]);
    return this.buildCSV(headers, rows);
  }

  async exportTaxSummaryReportToCSV(report: {
    period: { start: Date; end: Date };
    region: string;
    summary: {
      totalRevenue: number;
      totalOrders: number;
      totalPurchaseValue: number;
      customsVat: number;
      customsDuty: number;
    };
  }): Promise<string> {
    const headers = [
      'Start Date',
      'End Date',
      'Region',
      'Total Revenue',
      'Total Orders',
      'Total Purchase Value',
      'Customs VAT',
      'Customs Duty',
    ];
    const rows = [[
      report.period.start.toISOString().split('T')[0],
      report.period.end.toISOString().split('T')[0],
      report.region,
      Number(report.summary.totalRevenue ?? 0).toFixed(2),
      report.summary.totalOrders ?? 0,
      Number(report.summary.totalPurchaseValue ?? 0).toFixed(2),
      Number(report.summary.customsVat ?? 0).toFixed(2),
      Number(report.summary.customsDuty ?? 0).toFixed(2),
    ]];
    return this.buildCSV(headers, rows);
  }

  async exportTaxSummaryReportToXLSX(report: {
    period: { start: Date; end: Date };
    region: string;
    summary: {
      totalRevenue: number;
      totalOrders: number;
      totalPurchaseValue: number;
      customsVat: number;
      customsDuty: number;
    };
  }): Promise<Buffer> {
    const rows = [{
      'Start Date': report.period.start.toISOString().split('T')[0],
      'End Date': report.period.end.toISOString().split('T')[0],
      'Region': report.region,
      'Total Revenue': Number(report.summary.totalRevenue ?? 0),
      'Total Orders': report.summary.totalOrders ?? 0,
      'Total Purchase Value': Number(report.summary.totalPurchaseValue ?? 0),
      'Customs VAT': Number(report.summary.customsVat ?? 0),
      'Customs Duty': Number(report.summary.customsDuty ?? 0),
    }];
    const headers = [
      'Start Date',
      'End Date',
      'Region',
      'Total Revenue',
      'Total Orders',
      'Total Purchase Value',
      'Customs VAT',
      'Customs Duty',
    ];
    return this.createXLSXBuffer('Tax Summary', rows, headers);
  }

  async exportReturnsReportToCSV(returnRequests: any[]): Promise<string> {
    const headers = [
      'Return Request ID',
      'Created At',
      'Order Number',
      'Customer Email',
      'Reason',
      'Status',
      'Items Count',
      'Items Quantity',
      'Refund Method',
      'Refund Amount',
      'Refund Processed At',
      'Pickup Method',
      'Pickup Date',
      'Pickup Address',
      'Customer Notes',
      'Admin Notes',
    ];
    const rows = returnRequests.map((request: any) => {
      const itemsCount = Array.isArray(request.items) ? request.items.length : 0;
      const itemsQuantity = Array.isArray(request.items)
        ? request.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
        : 0;
      return [
        request.id,
        request.createdAt instanceof Date
          ? request.createdAt.toISOString().split('T')[0]
          : new Date(request.createdAt).toISOString().split('T')[0],
        request.order?.orderNumber ?? '',
        request.order?.user?.email ?? '',
        request.reason ?? '',
        request.status ?? '',
        itemsCount,
        itemsQuantity,
        request.refundMethod ?? '',
        request.refundAmount != null ? Number(request.refundAmount).toFixed(2) : '',
        request.refundProcessedAt
          ? request.refundProcessedAt instanceof Date
            ? request.refundProcessedAt.toISOString().split('T')[0]
            : new Date(request.refundProcessedAt).toISOString().split('T')[0]
          : '',
        request.pickupMethod ?? '',
        request.pickupDate
          ? request.pickupDate instanceof Date
            ? request.pickupDate.toISOString().split('T')[0]
            : new Date(request.pickupDate).toISOString().split('T')[0]
          : '',
        request.pickupAddress ?? '',
        request.customerNotes ?? '',
        request.adminNotes ?? '',
      ];
    });
    return this.buildCSV(headers, rows);
  }

  async exportReturnsReportToXLSX(returnRequests: any[]): Promise<Buffer> {
    const rows = returnRequests.map((request: any) => ({
      'Return Request ID': request.id,
      'Created At':
        request.createdAt instanceof Date
          ? request.createdAt.toISOString().split('T')[0]
          : new Date(request.createdAt).toISOString().split('T')[0],
      'Order Number': request.order?.orderNumber ?? '',
      'Customer Email': request.order?.user?.email ?? '',
      'Reason': request.reason ?? '',
      'Status': request.status ?? '',
      'Items Count': Array.isArray(request.items) ? request.items.length : 0,
      'Items Quantity': Array.isArray(request.items)
        ? request.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
        : 0,
      'Refund Method': request.refundMethod ?? '',
      'Refund Amount': request.refundAmount != null ? Number(request.refundAmount) : '',
      'Refund Processed At': request.refundProcessedAt
        ? request.refundProcessedAt instanceof Date
          ? request.refundProcessedAt.toISOString().split('T')[0]
          : new Date(request.refundProcessedAt).toISOString().split('T')[0]
        : '',
      'Pickup Method': request.pickupMethod ?? '',
      'Pickup Date': request.pickupDate
        ? request.pickupDate instanceof Date
          ? request.pickupDate.toISOString().split('T')[0]
          : new Date(request.pickupDate).toISOString().split('T')[0]
        : '',
      'Pickup Address': request.pickupAddress ?? '',
      'Customer Notes': request.customerNotes ?? '',
      'Admin Notes': request.adminNotes ?? '',
    }));
    const headers = [
      'Return Request ID',
      'Created At',
      'Order Number',
      'Customer Email',
      'Reason',
      'Status',
      'Items Count',
      'Items Quantity',
      'Refund Method',
      'Refund Amount',
      'Refund Processed At',
      'Pickup Method',
      'Pickup Date',
      'Pickup Address',
      'Customer Notes',
      'Admin Notes',
    ];
    return this.createXLSXBuffer('Returns', rows, headers);
  }

  async exportPaymentMethodsReportToCSV(methods: any[]): Promise<string> {
    const headers = [
      'Payment Method',
      'Total Orders',
      'Paid Orders',
      'Refunded Orders',
      'Failed Orders',
      'Pending Orders',
      'Paid Revenue',
      'Refund Amount',
      'Net Revenue',
      'Conversion To Paid (%)',
    ];
    const rows = methods.map((method: any) => [
      method.paymentMethod ?? '',
      method.totalOrders ?? 0,
      method.paidOrders ?? 0,
      method.refundedOrders ?? 0,
      method.failedOrders ?? 0,
      method.pendingOrders ?? 0,
      Number(method.paidRevenue ?? 0).toFixed(2),
      Number(method.refundAmount ?? 0).toFixed(2),
      Number(method.netRevenue ?? 0).toFixed(2),
      Number(method.conversionToPaid ?? 0).toFixed(2),
    ]);
    return this.buildCSV(headers, rows);
  }

  async exportPaymentMethodsReportToXLSX(methods: any[]): Promise<Buffer> {
    const rows = methods.map((method: any) => ({
      'Payment Method': method.paymentMethod ?? '',
      'Total Orders': method.totalOrders ?? 0,
      'Paid Orders': method.paidOrders ?? 0,
      'Refunded Orders': method.refundedOrders ?? 0,
      'Failed Orders': method.failedOrders ?? 0,
      'Pending Orders': method.pendingOrders ?? 0,
      'Paid Revenue': Number(method.paidRevenue ?? 0),
      'Refund Amount': Number(method.refundAmount ?? 0),
      'Net Revenue': Number(method.netRevenue ?? 0),
      'Conversion To Paid (%)': Number(method.conversionToPaid ?? 0),
    }));
    const headers = [
      'Payment Method',
      'Total Orders',
      'Paid Orders',
      'Refunded Orders',
      'Failed Orders',
      'Pending Orders',
      'Paid Revenue',
      'Refund Amount',
      'Net Revenue',
      'Conversion To Paid (%)',
    ];
    return this.createXLSXBuffer('Payment Methods', rows, headers);
  }

  async exportOverviewReportToCSV(report: {
    period: { start: Date; end: Date };
    summary: Record<string, number>;
    breakdowns: {
      countries: Array<Record<string, unknown>>;
      currencies: Array<Record<string, unknown>>;
      sources: Array<Record<string, unknown>>;
      warehouses: Array<Record<string, unknown>>;
      paymentMethods: Array<Record<string, unknown>>;
    };
  }): Promise<string> {
    const headers = ['Section', 'Name', 'Metric', 'Value', 'Extra'];
    const rows: Array<Array<string | number>> = [];

    rows.push(['period', 'range', 'startDate', report.period.start.toISOString().split('T')[0], '']);
    rows.push(['period', 'range', 'endDate', report.period.end.toISOString().split('T')[0], '']);

    for (const [metric, value] of Object.entries(report.summary)) {
      rows.push(['summary', 'overall', metric, Number(value || 0).toFixed(2), '']);
    }

    report.breakdowns.countries.forEach((country) => {
      rows.push([
        'countries',
        String(country.country || 'UNKNOWN'),
        'grossRevenue',
        Number(country.grossRevenue || 0).toFixed(2),
        `orders=${country.totalOrders || 0}; paidOrders=${country.paidOrders || 0}; shareOfOrders=${Number(country.shareOfOrders || 0).toFixed(2)}%`,
      ]);
    });

    report.breakdowns.currencies.forEach((currency) => {
      rows.push([
        'currencies',
        String(currency.currency || 'UNKNOWN'),
        'grossRevenue',
        Number(currency.grossRevenue || 0).toFixed(2),
        `orders=${currency.totalOrders || 0}`,
      ]);
    });

    report.breakdowns.sources.forEach((source) => {
      rows.push([
        'sources',
        String(source.source || 'UNKNOWN'),
        'grossRevenue',
        Number(source.grossRevenue || 0).toFixed(2),
        `orders=${source.totalOrders || 0}`,
      ]);
    });

    report.breakdowns.warehouses.forEach((warehouse) => {
      rows.push([
        'warehouses',
        String(warehouse.warehouseName || 'UNASSIGNED'),
        'grossRevenue',
        Number(warehouse.grossRevenue || 0).toFixed(2),
        `orders=${warehouse.totalOrders || 0}; warehouseId=${warehouse.warehouseId || ''}`,
      ]);
    });

    report.breakdowns.paymentMethods.forEach((method) => {
      rows.push([
        'paymentMethods',
        String(method.paymentMethod || 'UNKNOWN'),
        'netRevenue',
        Number(method.netRevenue || 0).toFixed(2),
        `orders=${method.totalOrders || 0}; paidOrders=${method.paidOrders || 0}; conversionToPaid=${Number(method.conversionToPaid || 0).toFixed(2)}%`,
      ]);
    });

    return this.buildCSV(headers, rows);
  }

  async exportOverviewReportToXLSX(report: {
    period: { start: Date; end: Date };
    summary: Record<string, number>;
    breakdowns: {
      countries: Array<Record<string, unknown>>;
      currencies: Array<Record<string, unknown>>;
      sources: Array<Record<string, unknown>>;
      warehouses: Array<Record<string, unknown>>;
      paymentMethods: Array<Record<string, unknown>>;
    };
  }): Promise<Buffer> {
    const rows: Record<string, unknown>[] = [
      {
        Section: 'period',
        Name: 'range',
        Metric: 'startDate',
        Value: report.period.start.toISOString().split('T')[0],
        Extra: '',
      },
      {
        Section: 'period',
        Name: 'range',
        Metric: 'endDate',
        Value: report.period.end.toISOString().split('T')[0],
        Extra: '',
      },
    ];

    for (const [metric, value] of Object.entries(report.summary)) {
      rows.push({
        Section: 'summary',
        Name: 'overall',
        Metric: metric,
        Value: Number(value || 0),
        Extra: '',
      });
    }

    report.breakdowns.countries.forEach((country) => {
      rows.push({
        Section: 'countries',
        Name: String(country.country || 'UNKNOWN'),
        Metric: 'grossRevenue',
        Value: Number(country.grossRevenue || 0),
        Extra: `orders=${country.totalOrders || 0}; paidOrders=${country.paidOrders || 0}; shareOfOrders=${Number(country.shareOfOrders || 0).toFixed(2)}%`,
      });
    });

    report.breakdowns.currencies.forEach((currency) => {
      rows.push({
        Section: 'currencies',
        Name: String(currency.currency || 'UNKNOWN'),
        Metric: 'grossRevenue',
        Value: Number(currency.grossRevenue || 0),
        Extra: `orders=${currency.totalOrders || 0}`,
      });
    });

    report.breakdowns.sources.forEach((source) => {
      rows.push({
        Section: 'sources',
        Name: String(source.source || 'UNKNOWN'),
        Metric: 'grossRevenue',
        Value: Number(source.grossRevenue || 0),
        Extra: `orders=${source.totalOrders || 0}`,
      });
    });

    report.breakdowns.warehouses.forEach((warehouse) => {
      rows.push({
        Section: 'warehouses',
        Name: String(warehouse.warehouseName || 'UNASSIGNED'),
        Metric: 'grossRevenue',
        Value: Number(warehouse.grossRevenue || 0),
        Extra: `orders=${warehouse.totalOrders || 0}; warehouseId=${warehouse.warehouseId || ''}`,
      });
    });

    report.breakdowns.paymentMethods.forEach((method) => {
      rows.push({
        Section: 'paymentMethods',
        Name: String(method.paymentMethod || 'UNKNOWN'),
        Metric: 'netRevenue',
        Value: Number(method.netRevenue || 0),
        Extra: `orders=${method.totalOrders || 0}; paidOrders=${method.paidOrders || 0}; conversionToPaid=${Number(method.conversionToPaid || 0).toFixed(2)}%`,
      });
    });

    return this.createXLSXBuffer('Overview', rows, ['Section', 'Name', 'Metric', 'Value', 'Extra']);
  }

  async generateOverviewReport(
    startDate: Date,
    endDate: Date,
    filters?: {
      country?: string;
      currency?: string;
      source?: string;
      warehouseId?: string;
    }
  ) {
    const normalizedCountry = String(filters?.country || '')
      .trim()
      .toUpperCase();
    const normalizedCurrency = String(filters?.currency || '')
      .trim()
      .toUpperCase();
    const normalizedSource = String(filters?.source || '')
      .trim()
      .toUpperCase();
    const normalizedWarehouseId = String(filters?.warehouseId || '').trim();

    const orderWhere: Prisma.OrderWhereInput = {
      createdAt: { gte: startDate, lte: endDate },
      ...(normalizedCurrency ? { checkoutCurrency: normalizedCurrency } : {}),
      ...(normalizedSource ? { orderSource: normalizedSource as any } : {}),
      ...(normalizedWarehouseId ? { fulfillmentWarehouseId: normalizedWarehouseId } : {}),
      ...(normalizedCountry
        ? {
            shippingAddress: {
              is: {
                country: normalizedCountry,
              },
            },
          }
        : {}),
    };

    const [allPeriodOrders, orders, purchasesReport, filteredReturnRequests, customsDeclarations] =
      await Promise.all([
        prisma.order.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          select: {
            checkoutCurrency: true,
            orderSource: true,
            shippingAddress: {
              select: {
                country: true,
              },
            },
            fulfillmentWarehouse: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.order.findMany({
          where: orderWhere,
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            paymentGatewayType: true,
            total: true,
            checkoutCurrency: true,
            orderSource: true,
            shippingAddress: {
              select: {
                country: true,
              },
            },
            fulfillmentWarehouse: {
              select: {
                id: true,
                name: true,
              },
            },
            returnRequests: {
              where: {
                status: 'COMPLETED',
              },
              select: {
                refundAmount: true,
              },
            },
          },
        }),
        this.generatePurchasesReport(startDate, endDate, normalizedWarehouseId || undefined),
        (prisma as any).returnRequest.findMany({
          where: {
            createdAt: { gte: startDate, lte: endDate },
            order: {
              is: {
                ...orderWhere,
              },
            },
          },
          select: {
            id: true,
            status: true,
            refundAmount: true,
          },
        }),
        prisma.customsDeclaration.findMany({
          where: {
            declarationDate: { gte: startDate, lte: endDate },
            ...(normalizedCountry || normalizedCurrency || normalizedSource || normalizedWarehouseId
              ? {
                  order: {
                    is: {
                      ...(normalizedCurrency ? { checkoutCurrency: normalizedCurrency } : {}),
                      ...(normalizedSource ? { orderSource: normalizedSource as any } : {}),
                      ...(normalizedWarehouseId
                        ? { fulfillmentWarehouseId: normalizedWarehouseId }
                        : {}),
                      ...(normalizedCountry
                        ? {
                            shippingAddress: {
                              is: {
                                country: normalizedCountry,
                              },
                            },
                          }
                        : {}),
                    },
                  },
                }
              : {}),
          },
          select: {
            vatAmount: true,
            dutyAmount: true,
          },
        }),
      ]);

    const totalOrders = orders.length;
    const paidOrders = orders.filter(
      (order) => order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED'
    );
    const deliveredOrders = orders.filter((order) => order.status === 'DELIVERED').length;
    const grossRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const totalRefundAmount = filteredReturnRequests.reduce(
      (sum: number, request: any) => sum + Number(request.refundAmount || 0),
      0
    );
    const netRevenue = grossRevenue - totalRefundAmount;
    const totalPurchaseValue = Number(purchasesReport.summary.totalPurchaseValue || 0);
    const totalCustomsCost = customsDeclarations.reduce(
      (sum, declaration) =>
        sum + Number(declaration.vatAmount || 0) + Number(declaration.dutyAmount || 0),
      0
    );
    const averagePaidOrderValue = paidOrders.length > 0 ? grossRevenue / paidOrders.length : 0;
    const returnRate =
      totalOrders > 0 ? (filteredReturnRequests.length / totalOrders) * 100 : 0;
    const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
    const marginAfterOperations = netRevenue - totalPurchaseValue - totalCustomsCost;

    const countries = new Map<
      string,
      { country: string; totalOrders: number; paidOrders: number; grossRevenue: number }
    >();
    const currencies = new Map<string, { currency: string; totalOrders: number; grossRevenue: number }>();
    const sources = new Map<string, { source: string; totalOrders: number; grossRevenue: number }>();
    const warehouses = new Map<
      string,
      { warehouseId: string | null; warehouseName: string; totalOrders: number; grossRevenue: number }
    >();
    const paymentMethods = new Map<
      string,
      {
        paymentMethod: string;
        totalOrders: number;
        paidOrders: number;
        refundedOrders: number;
        failedOrders: number;
        pendingOrders: number;
        paidRevenue: number;
        refundAmount: number;
        netRevenue: number;
        conversionToPaid: number;
      }
    >();

    for (const order of orders) {
      const isPaidLifecycle =
        order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED';
      const orderTotal = Number(order.total || 0);

      const country = String(order.shippingAddress?.country || '').trim().toUpperCase() || 'UNKNOWN';
      const currency = String(order.checkoutCurrency || '').trim().toUpperCase() || 'UNKNOWN';
      const source = String(order.orderSource || '').trim().toUpperCase() || 'UNKNOWN';
      const warehouseId = order.fulfillmentWarehouse?.id || null;
      const warehouseName = order.fulfillmentWarehouse?.name || 'UNASSIGNED';

      const countryRow = countries.get(country) || {
        country,
        totalOrders: 0,
        paidOrders: 0,
        grossRevenue: 0,
      };
      countryRow.totalOrders += 1;
      if (isPaidLifecycle) {
        countryRow.paidOrders += 1;
        countryRow.grossRevenue += orderTotal;
      }
      countries.set(country, countryRow);

      const currencyRow = currencies.get(currency) || {
        currency,
        totalOrders: 0,
        grossRevenue: 0,
      };
      currencyRow.totalOrders += 1;
      if (isPaidLifecycle) {
        currencyRow.grossRevenue += orderTotal;
      }
      currencies.set(currency, currencyRow);

      const sourceRow = sources.get(source) || {
        source,
        totalOrders: 0,
        grossRevenue: 0,
      };
      sourceRow.totalOrders += 1;
      if (isPaidLifecycle) {
        sourceRow.grossRevenue += orderTotal;
      }
      sources.set(source, sourceRow);

      const warehouseKey = warehouseId || 'UNASSIGNED';
      const warehouseRow = warehouses.get(warehouseKey) || {
        warehouseId,
        warehouseName,
        totalOrders: 0,
        grossRevenue: 0,
      };
      warehouseRow.totalOrders += 1;
      if (isPaidLifecycle) {
        warehouseRow.grossRevenue += orderTotal;
      }
      warehouses.set(warehouseKey, warehouseRow);

      const paymentMethod =
        String(order.paymentMethod || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
      const paymentGatewayType =
        paymentMethod === 'GATEWAY'
          ? String(order.paymentGatewayType || '').trim().toUpperCase()
          : '';
      const paymentKey = paymentGatewayType || paymentMethod;
      const paymentRow = paymentMethods.get(paymentKey) || {
        paymentMethod: paymentKey,
        totalOrders: 0,
        paidOrders: 0,
        refundedOrders: 0,
        failedOrders: 0,
        pendingOrders: 0,
        paidRevenue: 0,
        refundAmount: 0,
        netRevenue: 0,
        conversionToPaid: 0,
      };

      paymentRow.totalOrders += 1;
      if (isPaidLifecycle) {
        paymentRow.paidOrders += 1;
        paymentRow.paidRevenue += orderTotal;
      } else if (order.paymentStatus === 'FAILED') {
        paymentRow.failedOrders += 1;
      } else {
        paymentRow.pendingOrders += 1;
      }

      const refundAmount = Array.isArray(order.returnRequests)
        ? order.returnRequests.reduce(
            (sum: number, request: any) => sum + Number(request.refundAmount || 0),
            0
          )
        : 0;

      if (order.paymentStatus === 'REFUNDED' || refundAmount > 0) {
        paymentRow.refundedOrders += 1;
      }
      paymentRow.refundAmount += refundAmount;
      paymentMethods.set(paymentKey, paymentRow);
    }

    const paymentMethodsBreakdown = Array.from(paymentMethods.values())
      .map((method) => {
        const netRevenue = method.paidRevenue - method.refundAmount;
        const conversionToPaid =
          method.totalOrders > 0 ? (method.paidOrders / method.totalOrders) * 100 : 0;
        return {
          ...method,
          netRevenue,
          conversionToPaid,
        };
      })
      .sort((a, b) => b.paidRevenue - a.paidRevenue);

    const availableCountries = Array.from(
      new Set(
        allPeriodOrders
          .map((order) => String(order.shippingAddress?.country || '').trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
    const availableCurrencies = Array.from(
      new Set(
        allPeriodOrders
          .map((order) => String(order.checkoutCurrency || '').trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
    const availableSources = Array.from(
      new Set(
        allPeriodOrders
          .map((order) => String(order.orderSource || '').trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
    const availableWarehouses = Array.from(
      new Map(
        allPeriodOrders
          .filter((order) => order.fulfillmentWarehouse?.id && order.fulfillmentWarehouse?.name)
          .map((order) => [
            order.fulfillmentWarehouse?.id as string,
            {
              id: order.fulfillmentWarehouse?.id as string,
              name: order.fulfillmentWarehouse?.name as string,
            },
          ])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalOrders,
        paidOrders: paidOrders.length,
        deliveredOrders,
        grossRevenue,
        totalRefundAmount,
        netRevenue,
        totalPurchaseValue,
        totalCustomsCost,
        averagePaidOrderValue,
        returnRate,
        deliveryRate,
        marginAfterOperations,
      },
      appliedFilters: {
        country: normalizedCountry || null,
        currency: normalizedCurrency || null,
        source: normalizedSource || null,
        warehouseId: normalizedWarehouseId || null,
      },
      filterOptions: {
        countries: availableCountries,
        currencies: availableCurrencies,
        sources: availableSources,
        warehouses: availableWarehouses,
      },
      breakdowns: {
        countries: Array.from(countries.values())
          .map((row) => ({
            ...row,
            shareOfOrders: totalOrders > 0 ? (row.totalOrders / totalOrders) * 100 : 0,
          }))
          .sort((a, b) => b.grossRevenue - a.grossRevenue),
        currencies: Array.from(currencies.values()).sort((a, b) => b.grossRevenue - a.grossRevenue),
        sources: Array.from(sources.values()).sort((a, b) => b.grossRevenue - a.grossRevenue),
        warehouses: Array.from(warehouses.values()).sort((a, b) => b.grossRevenue - a.grossRevenue),
        paymentMethods: paymentMethodsBreakdown,
      },
      highlights: {
        topCountry: Array.from(countries.values()).sort((a, b) => b.grossRevenue - a.grossRevenue)[0] || null,
        topCurrency:
          Array.from(currencies.values()).sort((a, b) => b.grossRevenue - a.grossRevenue)[0] || null,
        topSource: Array.from(sources.values()).sort((a, b) => b.grossRevenue - a.grossRevenue)[0] || null,
        topWarehouse:
          Array.from(warehouses.values()).sort((a, b) => b.grossRevenue - a.grossRevenue)[0] || null,
        topPaymentMethod: paymentMethodsBreakdown[0] || null,
      },
    };
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

  /** Returns report */
  async generateReturnsReport(startDate: Date, endDate: Date) {
    const returnRequests = await (prisma as any).returnRequest.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            paymentStatus: true,
            status: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            itemStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRefundAmount = returnRequests.reduce(
      (sum: number, request: any) => sum + Number(request.refundAmount || 0),
      0
    );
    const totalItems = returnRequests.reduce(
      (sum: number, request: any) =>
        sum +
        request.items.reduce(
          (itemSum: number, item: any) => itemSum + Number(item.quantity || 0),
          0
        ),
      0
    );
    const statusCounts = returnRequests.reduce((acc: Record<string, number>, request: any) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {});

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalReturns: returnRequests.length,
        totalRefundAmount,
        totalItems,
        requested: statusCounts.REQUESTED || 0,
        approved: statusCounts.APPROVED || 0,
        processing: statusCounts.PROCESSING || 0,
        completed: statusCounts.COMPLETED || 0,
        rejected: statusCounts.REJECTED || 0,
      },
      returnRequests,
    };
  }

  /** Payment methods report */
  async generatePaymentMethodsReport(startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        returnRequests: {
          where: { status: 'COMPLETED' },
          select: { refundAmount: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byMethod = new Map<
      string,
      {
        paymentMethod: string;
        totalOrders: number;
        paidOrders: number;
        refundedOrders: number;
        failedOrders: number;
        pendingOrders: number;
        paidRevenue: number;
        refundAmount: number;
        netRevenue: number;
        conversionToPaid: number;
      }
    >();

    for (const order of orders) {
      const paymentMethod =
        String(order.paymentMethod || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
      const paymentGatewayType =
        paymentMethod === 'GATEWAY'
          ? String(order.paymentGatewayType || '').trim().toUpperCase()
          : '';
      const reportKey = paymentGatewayType || paymentMethod;
      const current = byMethod.get(reportKey) || {
        paymentMethod: reportKey,
        totalOrders: 0,
        paidOrders: 0,
        refundedOrders: 0,
        failedOrders: 0,
        pendingOrders: 0,
        paidRevenue: 0,
        refundAmount: 0,
        netRevenue: 0,
        conversionToPaid: 0,
      };

      current.totalOrders += 1;

      const isPaidLifecycle =
        order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED';

      if (isPaidLifecycle) {
        current.paidOrders += 1;
        current.paidRevenue += Number(order.total || 0);
      } else if (order.paymentStatus === 'FAILED') {
        current.failedOrders += 1;
      } else {
        current.pendingOrders += 1;
      }

      const refundAmount = order.returnRequests.reduce(
        (sum, request) => sum + Number(request.refundAmount || 0),
        0
      );

      if (order.paymentStatus === 'REFUNDED' || refundAmount > 0) {
        current.refundedOrders += 1;
      }
      current.refundAmount += refundAmount;

      byMethod.set(reportKey, current);
    }

    const methods = Array.from(byMethod.values()).map((method) => {
      const netRevenue = method.paidRevenue - method.refundAmount;
      const conversionToPaid =
        method.totalOrders > 0 ? (method.paidOrders / method.totalOrders) * 100 : 0;
      return {
        ...method,
        netRevenue,
        conversionToPaid,
      };
    });

    const summary = methods.reduce(
      (acc, method) => {
        acc.totalOrders += method.totalOrders;
        acc.paidOrders += method.paidOrders;
        acc.refundedOrders += method.refundedOrders;
        acc.failedOrders += method.failedOrders;
        acc.pendingOrders += method.pendingOrders;
        acc.paidRevenue += method.paidRevenue;
        acc.refundAmount += method.refundAmount;
        acc.netRevenue += method.netRevenue;
        return acc;
      },
      {
        totalOrders: 0,
        paidOrders: 0,
        refundedOrders: 0,
        failedOrders: 0,
        pendingOrders: 0,
        paidRevenue: 0,
        refundAmount: 0,
        netRevenue: 0,
      }
    );

    return {
      period: { start: startDate, end: endDate },
      summary,
      methods: methods.sort((a, b) => b.paidRevenue - a.paidRevenue),
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
    return this.buildCSV(headers, rows);
  }

  async exportDeliveryReportToCSV(orders: any[]): Promise<string> {
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
    return this.buildCSV(headers, rows);
  }

  async exportCustomsReportToCSV(declarations: any[]): Promise<string> {
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
    return this.buildCSV(headers, rows);
  }

  /**
   * Export customer report or other simple data structures to CSV
   */
  async exportToCSV(data: any[], _filename: string): Promise<string> {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    if (headers.length === 0) return '';
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
