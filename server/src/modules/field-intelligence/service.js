import { FieldIntelligenceRepository } from './repository.js';
import { CompleteReportDTO } from './dto.js';
import { AppError } from '../../utils/AppError.js';
import { db } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import {
  fieldIntelligenceCompetitors,
  fieldIntelligenceFollowups,
  fieldIntelligenceUploads,
} from '../../db/schema/field-intelligence.schema.js';

export class FieldIntelligenceService {
  constructor() {
    this.repository = new FieldIntelligenceRepository();
  }

  // Generate deterministic AI insights based on report fields
  generateAiInsights(report) {
    const insights = [];
    const pValue = parseFloat(report.potentialBusinessValue || 0);
    const expMonthly = parseFloat(report.expectedMonthlyBusiness || 0);
    const monthlyCons = parseFloat(report.monthlyConsumption || 0);
    const credit = parseInt(report.creditDays || 0, 10);
    const outstanding = parseFloat(report.outstandingAmount || 0);
    const reliability = parseInt(report.paymentReliability || 10, 10);
    const urgency = parseInt(report.followupUrgencyScore || 0, 10);
    const conversion = parseInt(report.conversionProbability || 0, 10);
    const longTerm = parseInt(report.longTermPotential || 0, 10);

    // 1. Strategic Opportunity
    if ((pValue >= 1000000 && conversion >= 50) || longTerm >= 8) {
      insights.push({
        insightType: 'Strategic Opportunity',
        observation: `Strategic Account Opportunity detected: Potential value ₹${pValue.toLocaleString('en-IN')}`,
        reasoning: `High strategic fit with long-term potential score of ${longTerm}/10 and conversion feasibility of ${conversion}%.`,
        severity: 'high',
      });
    }

    // 2. Payment Risk
    if (credit > 90 || reliability <= 4 || outstanding >= 500000) {
      insights.push({
        insightType: 'Payment Risk',
        observation: 'Warning: Elevate credit check (High Payment Risk)',
        reasoning: `Account terms check: ${credit} credit days requested, ₹${outstanding.toLocaleString('en-IN')} current outstanding, payment reliability rating is ${reliability}/10.`,
        severity: 'critical',
      });
    }

    // 3. High Potential Customer
    if (monthlyCons >= 500000 || expMonthly >= 200000) {
      insights.push({
        insightType: 'High Potential Customer',
        observation: `High-Consumption Target: Est. consumption ₹${monthlyCons.toLocaleString('en-IN')}/mo`,
        reasoning: `Monthly purchase potential exceeds baseline thresholds. Expected monthly sales value target ₹${expMonthly.toLocaleString('en-IN')}.`,
        severity: 'high',
      });
    }

    // 4. Competitor Weakness
    if (report.currentSupplier && report.currentSupplier.trim().length > 0) {
      insights.push({
        insightType: 'Competitor Weakness',
        observation: `Supplier displacement capability: Targeting ${report.currentSupplier}`,
        reasoning: `Analysis of current systems indicates potential entry points through specialized shade match or faster lead times.`,
        severity: 'medium',
      });
    }

    // 5. Urgent Followup
    if (urgency >= 7 || report.status === 'Trial Running') {
      insights.push({
        insightType: 'Urgent Followup',
        observation: 'Urgent follow-up requested by executive',
        reasoning: `Executive urgency rating is ${urgency}/10. Active workflows (such as Trial Running) demand immediate support.`,
        severity: 'high',
      });
    }

    return insights;
  }

  // Generate clean Report Number: FIR-YYYYMMDD-XXXX
  generateReportNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `FIR-${dateStr}-${rand}`;
  }

  async createReport(data, userContext, companyId, tenantId) {
    const reportNum = this.generateReportNumber();

    return await this.repository.runTransaction(async tx => {
      // 1. Create primary report record
      const reportPayload = {
        ...data,
        reportNumber: reportNum,
        companyId,
        tenantId,
        createdBy: userContext.employeeId,
        executiveId: data.executiveId || userContext.employeeId,
        executiveName: data.executiveName || userContext.username,
        status: data.status || 'Draft',
        visitDate: data.visitDate ? new Date(data.visitDate) : new Date(),
        expectedOrderDate: data.expectedOrderDate ? new Date(data.expectedOrderDate) : null,
      };

      // Strip out nested structures before inserting
      delete reportPayload.competitors;
      delete reportPayload.followups;
      delete reportPayload.uploads;

      const report = await this.repository.createReport(reportPayload, tx);

      // 2. Insert competitors
      if (data.competitors && data.competitors.length > 0) {
        const competitorsPayload = data.competitors.map(c => ({
          ...c,
          reportId: report.id,
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
        }));
        await this.repository.batchInsertCompetitors(competitorsPayload, tx);
      }

      // 3. Insert followups
      if (data.followups && data.followups.length > 0) {
        const followupsPayload = data.followups.map(f => ({
          ...f,
          reportId: report.id,
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
          followupDate: new Date(f.followupDate),
        }));
        await this.repository.batchInsertFollowups(followupsPayload, tx);

        await this.repository.insertActivityLog(
          {
            reportId: report.id,
            activityType: 'Followup Added',
            details: { count: data.followups.length },
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
          },
          tx
        );
      }

      // 4. Insert uploads metadata
      if (data.uploads && data.uploads.length > 0) {
        const uploadsPayload = data.uploads.map(u => ({
          ...u,
          reportId: report.id,
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
          uploadedBy: userContext.employeeId,
        }));
        await this.repository.batchInsertUploads(uploadsPayload, tx);

        await this.repository.insertActivityLog(
          {
            reportId: report.id,
            activityType: 'Upload Added',
            details: { count: data.uploads.length },
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
          },
          tx
        );
      }

      // 5. Generate and save AI insights
      const insights = this.generateAiInsights(report);
      if (insights.length > 0) {
        const insightsPayload = insights.map(i => ({
          ...i,
          reportId: report.id,
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
        }));
        await this.repository.batchInsertAiInsights(insightsPayload, tx);

        await this.repository.insertActivityLog(
          {
            reportId: report.id,
            activityType: 'Insight Generated',
            details: { count: insights.length },
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
          },
          tx
        );
      }

      // 6. Log activity
      await this.repository.insertActivityLog(
        {
          reportId: report.id,
          activityType: 'Created',
          details: { reportNumber: reportNum, status: report.status },
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
        },
        tx
      );

      // 7. Update dashboard metrics in background/transaction
      await this.recalculateDashboardMetrics(companyId, tenantId, userContext.employeeId, tx);

      return report;
    });
  }

  async updateReport(id, data, userContext, companyId, tenantId) {
    return await this.repository.runTransaction(async tx => {
      // Check existing report
      const existing = await this.repository.getReportById(id, companyId, tenantId);
      if (!existing) {
        throw new AppError('Field report not found', 404);
      }

      const reportPayload = { ...data };
      delete reportPayload.competitors;
      delete reportPayload.followups;
      delete reportPayload.uploads;
      delete reportPayload.id;

      if (reportPayload.visitDate) reportPayload.visitDate = new Date(reportPayload.visitDate);
      if (reportPayload.expectedOrderDate)
        reportPayload.expectedOrderDate = new Date(reportPayload.expectedOrderDate);

      // 1. Update report
      const report = await this.repository.updateReport(id, reportPayload, companyId, tenantId, tx);

      // 2. Refresh competitors
      if (data.competitors) {
        await this.repository.deleteCompetitorsForReport(id, tx);
        if (data.competitors.length > 0) {
          const competitorsPayload = data.competitors.map(c => ({
            ...c,
            reportId: id,
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
          }));
          await this.repository.batchInsertCompetitors(competitorsPayload, tx);
        }
      }

      // 3. Refresh followups
      if (data.followups) {
        await this.repository.deleteFollowupsForReport(id, tx);
        if (data.followups.length > 0) {
          const followupsPayload = data.followups.map(f => ({
            ...f,
            reportId: id,
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
            followupDate: new Date(f.followupDate),
          }));
          await this.repository.batchInsertFollowups(followupsPayload, tx);
        }
      }

      // 4. Refresh uploads
      if (data.uploads) {
        await this.repository.deleteUploadsForReport(id, tx);
        if (data.uploads.length > 0) {
          const uploadsPayload = data.uploads.map(u => ({
            ...u,
            reportId: id,
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
            uploadedBy: userContext.employeeId,
          }));
          await this.repository.batchInsertUploads(uploadsPayload, tx);
        }
      }

      // 5. Regenerate AI Insights
      await this.repository.deleteAiInsightsForReport(id, tx);
      const insights = this.generateAiInsights(report);
      if (insights.length > 0) {
        const insightsPayload = insights.map(i => ({
          ...i,
          reportId: id,
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
        }));
        await this.repository.batchInsertAiInsights(insightsPayload, tx);
      }

      // 6. Log status change or update activity
      if (data.status && data.status !== existing.report.status) {
        await this.repository.insertActivityLog(
          {
            reportId: id,
            activityType: 'Status Changed',
            details: { oldStatus: existing.report.status, newStatus: data.status },
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
          },
          tx
        );
      } else {
        await this.repository.insertActivityLog(
          {
            reportId: id,
            activityType: 'Updated',
            details: { fieldsChanged: Object.keys(reportPayload) },
            companyId,
            tenantId,
            createdBy: userContext.employeeId,
          },
          tx
        );
      }

      // 7. Recalculate Dashboard
      await this.recalculateDashboardMetrics(companyId, tenantId, userContext.employeeId, tx);

      return report;
    });
  }

  async deleteReport(id, userContext, companyId, tenantId) {
    return await this.repository.runTransaction(async tx => {
      const existing = await this.repository.getReportById(id, companyId, tenantId);
      if (!existing) {
        throw new AppError('Field report not found', 404);
      }

      const deleted = await this.repository.deleteReport(id, companyId, tenantId, tx);

      await this.repository.insertActivityLog(
        {
          reportId: null,
          activityType: 'Deleted',
          details: {
            reportNumber: existing.report.reportNumber,
            customerName: existing.report.customerName,
          },
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
        },
        tx
      );

      await this.recalculateDashboardMetrics(companyId, tenantId, userContext.employeeId, tx);

      return deleted;
    });
  }

  async getReportDetails(id, companyId, tenantId) {
    const details = await this.repository.getReportById(id, companyId, tenantId);
    if (!details) {
      throw new AppError('Field report not found', 404);
    }
    return new CompleteReportDTO(
      details.report,
      details.followups,
      details.competitors,
      details.uploads,
      details.insights,
      details.activityLogs
    );
  }

  async getReportsList(filters, companyId, tenantId) {
    const reports = await this.repository.getReportsList(filters, companyId, tenantId);
    return reports.map(r => new CompleteReportDTO(r));
  }

  async getDashboardSummary(companyId, tenantId, userContext) {
    let metrics = await this.repository.getLatestDashboardMetrics(companyId, tenantId);
    if (!metrics) {
      metrics = await this.recalculateDashboardMetrics(companyId, tenantId, userContext.employeeId);
    }
    return metrics;
  }

  async recalculateDashboardMetrics(companyId, tenantId, employeeId, tx) {
    const metricValue = await this.repository.getAggregatedDashboardMetrics(
      companyId,
      tenantId,
      tx
    );
    await this.repository.saveDashboardMetrics(companyId, tenantId, metricValue, employeeId, tx);
    return metricValue;
  }

  async exportToCsv(companyId, tenantId) {
    const reports = await this.repository.getReportsList({}, companyId, tenantId);

    const headers = [
      'Report Number',
      'Customer Name',
      'Visit Date',
      'Executive',
      'Status',
      'Potential Value',
      'Expected Monthly Business',
      'Conversion %',
      'City',
      'State',
      'Current Supplier',
      'Discussion Notes',
    ];

    const rows = reports.map(r => [
      r.reportNumber,
      r.customerName,
      r.visitDate ? new Date(r.visitDate).toLocaleDateString() : '',
      r.executiveName,
      r.status,
      r.potentialBusinessValue,
      r.expectedMonthlyBusiness,
      r.conversionProbability,
      r.city,
      r.state,
      r.currentSupplier,
      (r.discussionNotes || '').replace(/\r?\n/g, ' '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  async logUpload(reportId, fileData, userContext, companyId, tenantId) {
    return await this.repository.runTransaction(async tx => {
      const uploadPayload = {
        reportId,
        fileType: fileData.fileType || 'Product Photo',
        fileName: fileData.fileName,
        filePath: fileData.filePath,
        mimeType: fileData.mimeType,
        fileSize: fileData.fileSize,
        uploadedBy: userContext.employeeId,
        companyId,
        tenantId,
        createdBy: userContext.employeeId,
      };

      const upload = await tx.insert(fieldIntelligenceUploads).values(uploadPayload).returning();

      await this.repository.insertActivityLog(
        {
          reportId,
          activityType: 'Upload Added',
          details: { fileName: fileData.fileName, fileType: fileData.fileType },
          companyId,
          tenantId,
          createdBy: userContext.employeeId,
        },
        tx
      );

      return upload[0];
    });
  }
}
