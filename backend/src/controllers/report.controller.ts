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

export class ReportController {
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
      const report = await reportService.generateCustomerReport();
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
      const report = await reportService.generateCustomerReport();
      
      // Format customer report data for CSV
      const formattedReport = report.map((customer) => ({
        id: customer.id,
        email: customer.email,
        name: customer.name || '',
        totalOrders: customer.totalOrders,
        totalSpent: Number(customer.totalSpent).toFixed(2),
        averageOrderValue: Number(customer.averageOrderValue).toFixed(2),
        lastOrderDate: customer.lastOrderDate 
          ? (customer.lastOrderDate instanceof Date 
              ? customer.lastOrderDate.toISOString().split('T')[0]
              : new Date(customer.lastOrderDate).toISOString().split('T')[0])
          : '',
      }));
      
      const csv = await reportService.exportToCSV(formattedReport, 'customer-report');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=customer-report-${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export customer report',
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
}

export const reportController = new ReportController();
