import { Request, Response } from 'express';
import { reportService } from '../services/report.service';

/** Parse date range: startDate at midnight, endDate at end-of-day (23:59:59.999) so same-day orders are included */
function parseDateRange(req: Request, defaultDaysBack = 30): { startDate: Date; endDate: Date } {
  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : new Date(Date.now() - defaultDaysBack * 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
  // endDate at end-of-day so orders created on that day are included
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

function parseOverviewFilters(req: Request): {
  country?: string;
  currency?: string;
  source?: string;
  warehouseId?: string;
} {
  const country = String(req.query.country || '').trim();
  const currency = String(req.query.currency || '').trim();
  const source = String(req.query.source || '').trim();
  const warehouseId = String(req.query.warehouseId || '').trim();

  return {
    ...(country ? { country } : {}),
    ...(currency ? { currency } : {}),
    ...(source ? { source } : {}),
    ...(warehouseId ? { warehouseId } : {}),
  };
}

export class ReportController {
  async generateOverviewReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const filters = parseOverviewFilters(req);
      const report = await reportService.generateOverviewReport(startDate, endDate, filters);
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate overview report',
      });
    }
  }

  async exportOverviewReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const filters = parseOverviewFilters(req);
      const report = await reportService.generateOverviewReport(startDate, endDate, filters);
      const csv = await reportService.exportOverviewReportToCSV(report);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=overview-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export overview report',
      });
    }
  }

  async exportOverviewReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const filters = parseOverviewFilters(req);
      const report = await reportService.generateOverviewReport(startDate, endDate, filters);
      const buffer = await reportService.exportOverviewReportToXLSX(report);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=overview-report-${Date.now()}.xlsx`
      );
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export overview report (XLSX)',
      });
    }
  }

  async generateSalesReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);

      const report = await reportService.generateSalesReport(startDate, endDate);
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate sales report',
      });
    }
  }

  async generateCustomerReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generateCustomerReport(startDate, endDate);
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate customer report',
      });
    }
  }

  async exportSalesReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);

      const report = await reportService.generateSalesReport(startDate, endDate);
      const csv = await reportService.exportSalesReportToCSV(report.orders);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export sales report',
      });
    }
  }

  async exportSalesReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);

      const report = await reportService.generateSalesReport(startDate, endDate);
      const buffer = await reportService.exportSalesReportToXLSX(report.orders);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export sales report (XLSX)',
      });
    }
  }

  async exportCustomerReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generateCustomerReport(startDate, endDate);
      const csv = await reportService.exportCustomerReportToCSV(report);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=customer-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export customer report',
      });
    }
  }

  async exportCustomerReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generateCustomerReport(startDate, endDate);
      const buffer = await reportService.exportCustomerReportToXLSX(report);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=customer-report-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export customer report (XLSX)',
      });
    }
  }

  async generatePurchasesReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const warehouseId = req.query.warehouseId as string | undefined;

      const report = await reportService.generatePurchasesReport(
        startDate,
        endDate,
        warehouseId
      );
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate purchases report',
      });
    }
  }

  async exportPurchasesReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const warehouseId = req.query.warehouseId as string | undefined;

      const report = await reportService.generatePurchasesReport(
        startDate,
        endDate,
        warehouseId
      );
      const csv = await reportService.exportPurchasesReportToCSV(report.movements);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=purchases-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export purchases report',
      });
    }
  }

  async exportPurchasesReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const warehouseId = req.query.warehouseId as string | undefined;
      const report = await reportService.generatePurchasesReport(startDate, endDate, warehouseId);
      const buffer = await reportService.exportPurchasesReportToXLSX(report.movements);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=purchases-report-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export purchases report (XLSX)',
      });
    }
  }

  async generateReturnsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generateReturnsReport(startDate, endDate);
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate returns report',
      });
    }
  }

  async exportReturnsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generateReturnsReport(startDate, endDate);
      const csv = await reportService.exportReturnsReportToCSV(report.returnRequests);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=returns-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export returns report',
      });
    }
  }

  async exportReturnsReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generateReturnsReport(startDate, endDate);
      const buffer = await reportService.exportReturnsReportToXLSX(report.returnRequests);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=returns-report-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export returns report (XLSX)',
      });
    }
  }

  async generatePaymentMethodsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generatePaymentMethodsReport(startDate, endDate);
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate payment methods report',
      });
    }
  }

  async exportPaymentMethodsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generatePaymentMethodsReport(startDate, endDate);
      const csv = await reportService.exportPaymentMethodsReportToCSV(report.methods);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=payment-methods-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export payment methods report',
      });
    }
  }

  async exportPaymentMethodsReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generatePaymentMethodsReport(startDate, endDate);
      const buffer = await reportService.exportPaymentMethodsReportToXLSX(report.methods);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=payment-methods-report-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to export payment methods report (XLSX)',
      });
    }
  }

  async generateDeliveryReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);

      const report = await reportService.generateDeliveryReport(startDate, endDate);
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate delivery report',
      });
    }
  }

  async exportDeliveryReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);

      const report = await reportService.generateDeliveryReport(startDate, endDate);
      const csv = await reportService.exportDeliveryReportToCSV(report.orders);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=delivery-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export delivery report',
      });
    }
  }

  async exportDeliveryReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const report = await reportService.generateDeliveryReport(startDate, endDate);
      const buffer = await reportService.exportDeliveryReportToXLSX(report.orders);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=delivery-report-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export delivery report (XLSX)',
      });
    }
  }

  async generateCustomsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req, 365);

      const report = await reportService.generateCustomsReport(startDate, endDate);
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate customs report',
      });
    }
  }

  async exportCustomsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req, 365);

      const report = await reportService.generateCustomsReport(startDate, endDate);
      const csv = await reportService.exportCustomsReportToCSV(report.declarations);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=customs-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export customs report',
      });
    }
  }

  async exportCustomsReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req, 365);
      const report = await reportService.generateCustomsReport(startDate, endDate);
      const buffer = await reportService.exportCustomsReportToXLSX(report.declarations);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=customs-report-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export customs report (XLSX)',
      });
    }
  }

  async generateTaxSummaryReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const region = (req.query.region as string) || 'RU';

      const report = await reportService.generateTaxSummaryReport(
        startDate,
        endDate,
        region
      );
      res.json({ report });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate tax summary report',
      });
    }
  }

  async exportTaxSummaryReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const region = (req.query.region as string) || 'RU';
      const report = await reportService.generateTaxSummaryReport(startDate, endDate, region);
      const csv = await reportService.exportTaxSummaryReportToCSV(report);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=tax-summary-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export tax summary report',
      });
    }
  }

  async exportTaxSummaryReportXLSX(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = parseDateRange(req);
      const region = (req.query.region as string) || 'RU';
      const report = await reportService.generateTaxSummaryReport(startDate, endDate, region);
      const buffer = await reportService.exportTaxSummaryReportToXLSX(report);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=tax-summary-${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export tax summary report (XLSX)',
      });
    }
  }
}

export const reportController = new ReportController();
