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

  // Generate deterministic AI insights based on report fields + visit type
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
    const dealerConf = parseInt(report.dealerConfidence || 5, 10);
    const relStrength = parseInt(report.relationshipStrength || 5, 10);
    const visitType = (report.visitType || '').toLowerCase();

    // ── Compute composite intelligence scores ──────────────────────────────
    // Interest Score (0-100): weighted from conversion, longTerm, mood
    const moodBoost =
      report.customerMood === 'Highly Interested'
        ? 20
        : report.customerMood === 'Neutral'
          ? 5
          : report.customerMood === 'Dissatisfied'
            ? 10
            : 0;
    const interestScore = Math.min(100, Math.round(conversion * 0.4 + longTerm * 5 + moodBoost));

    // Payment Risk Score (0-100): lower is safer
    const paymentRiskScore = Math.min(
      100,
      Math.round(
        (credit > 90 ? 40 : credit > 60 ? 20 : 5) +
          (10 - reliability) * 5 +
          (outstanding >= 500000 ? 30 : outstanding >= 200000 ? 15 : 0)
      )
    );

    // Competitor Threat Score (0-100)
    const competitorCount = Array.isArray(report.competitors) ? report.competitors.length : 0;
    const competitorThreatScore = Math.min(
      100,
      Math.round(
        competitorCount * 20 +
          (report.currentSupplier && report.currentSupplier.trim() ? 25 : 0) +
          (10 - dealerConf) * 3
      )
    );

    // Follow-up Urgency Score (direct from executive 1-10 → 0-100)
    const followupScore = Math.min(100, urgency * 10);

    // Business Potential Score (0-100)
    const businessPotentialScore = Math.min(
      100,
      Math.round(
        (pValue >= 5000000 ? 40 : pValue >= 1000000 ? 25 : pValue >= 500000 ? 15 : 5) +
          (expMonthly >= 500000 ? 30 : expMonthly >= 200000 ? 20 : expMonthly >= 50000 ? 10 : 0) +
          longTerm * 3
      )
    );

    // Store computed scores on report object for downstream use
    report._computedScores = {
      interestScore,
      paymentRiskScore,
      competitorThreatScore,
      followupScore,
      businessPotentialScore,
    };

    // ── Universal Insights ─────────────────────────────────────────────────

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
    if (paymentRiskScore >= 50 || credit > 90 || reliability <= 4 || outstanding >= 500000) {
      insights.push({
        insightType: 'Payment Risk',
        observation: `Warning: High Payment Risk Detected (Risk Score: ${paymentRiskScore}/100)`,
        reasoning: `Account terms check: ${credit} credit days requested, ₹${outstanding.toLocaleString('en-IN')} current outstanding, payment reliability rating is ${reliability}/10.`,
        severity: paymentRiskScore >= 70 ? 'critical' : 'high',
      });
    }

    // 3. High Potential Customer
    if (businessPotentialScore >= 60 || monthlyCons >= 500000 || expMonthly >= 200000) {
      insights.push({
        insightType: 'High Potential Customer',
        observation: `High-Value Target: Business Potential Score ${businessPotentialScore}/100`,
        reasoning: `Monthly consumption ₹${monthlyCons.toLocaleString('en-IN')}/mo. Expected monthly business ₹${expMonthly.toLocaleString('en-IN')}.`,
        severity: 'high',
      });
    }

    // 4. Competitor Threat
    if (competitorThreatScore >= 40) {
      insights.push({
        insightType: 'Competitor Weakness',
        observation: `Competitor Threat Score: ${competitorThreatScore}/100 – Displacement strategy needed`,
        reasoning: `${competitorCount} competitor(s) identified. Current supplier: ${report.currentSupplier || 'N/A'}. Dealer confidence: ${dealerConf}/10.`,
        severity: competitorThreatScore >= 70 ? 'critical' : 'medium',
      });
    }

    // 5. Urgent Followup
    if (followupScore >= 70 || report.status === 'Trial Running') {
      insights.push({
        insightType: 'Urgent Followup',
        observation: `Follow-up Urgency: ${followupScore}/100 – Immediate action required`,
        reasoning: `Executive urgency rating is ${urgency}/10. Status: ${report.status}. Relationship strength: ${relStrength}/10.`,
        severity: followupScore >= 90 ? 'critical' : 'high',
      });
    }

    // 6. High Interest – likely order
    if (interestScore >= 70 && conversion >= 60) {
      insights.push({
        insightType: 'Strategic Opportunity',
        observation: `High probability of order within 7 days (Interest Score: ${interestScore}/100)`,
        reasoning: `Customer mood: ${report.customerMood}. Conversion probability: ${conversion}%. Prepare quotation immediately.`,
        severity: 'high',
      });
    }

    // ── Visit-Type Specific Insights ───────────────────────────────────────

    // Complaint Visit
    if (visitType.includes('complaint')) {
      insights.push({
        insightType: 'Urgent Followup',
        observation: 'Complaint Visit recorded – resolution timeline must be tracked',
        reasoning:
          'Complaints require immediate technical review and response within 48 hours to preserve customer relationship.',
        severity: 'critical',
      });
    }

    // Dealer Visit
    if (visitType.includes('dealer')) {
      if (relStrength < 5) {
        insights.push({
          insightType: 'Competitor Weakness',
          observation: 'Dealer relationship score low – competitor displacement risk high',
          reasoning: `Relationship strength is ${relStrength}/10. Schedule a scheme discussion or offer exclusive pricing to strengthen ties.`,
          severity: 'high',
        });
      }
    }

    // Industrial Visit
    if (visitType.includes('industrial')) {
      if (report.trialApproved) {
        insights.push({
          insightType: 'Strategic Opportunity',
          observation: 'Industrial trial approved – high conversion potential',
          reasoning:
            'Trial approval at industrial site indicates strong interest. Ensure technical support is available during trial phase.',
          severity: 'high',
        });
      }
    }

    // Technical Visit
    if (visitType.includes('technical')) {
      insights.push({
        insightType: 'Urgent Followup',
        observation: 'Technical Visit completed – send TDS / product documentation',
        reasoning:
          'Technical visits require immediate follow-up with product data sheets, application guides, and support contact.',
        severity: 'medium',
      });
    }

    // Architect Visit
    if (visitType.includes('architect')) {
      if (report.sampleGiven) {
        insights.push({
          insightType: 'Strategic Opportunity',
          observation: 'Shade samples provided to architect – schedule shade approval follow-up',
          reasoning:
            'Architects influence large project specifications. Track sample response within 5 working days.',
          severity: 'medium',
        });
      }
    }

    // Market Feedback
    if (visitType.includes('market feedback')) {
      if (competitorCount >= 2) {
        insights.push({
          insightType: 'Competitor Weakness',
          observation: `Market intelligence: ${competitorCount} competitor brands identified in this territory`,
          reasoning:
            'High competitor presence in territory. Management should review pricing and scheme strategy for this zone.',
          severity: 'high',
        });
      }
    }

    return insights;
  }

  // Generate clean Report Number: CRM-YYYYMMDD-XXXX
  generateReportNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CRM-${dateStr}-${rand}`;
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
      await this.recalculateDashboardMetrics(
        companyId,
        tenantId,
        userContext.employeeId,
        userContext,
        tx
      );
      await this.recalculateDashboardMetrics(
        companyId,
        tenantId,
        userContext.employeeId,
        { role: 'Admin' },
        tx
      );

      return report;
    });
  }

  async updateReport(id, data, userContext, companyId, tenantId) {
    return await this.repository.runTransaction(async tx => {
      // Check existing report
      const existing = await this.repository.getReportById(id, companyId, tenantId, userContext);
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
      const report = await this.repository.updateReport(
        id,
        reportPayload,
        companyId,
        tenantId,
        userContext,
        tx
      );

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
      const ownerContext = { employeeId: existing.report.createdBy, role: 'Employee' };
      await this.recalculateDashboardMetrics(
        companyId,
        tenantId,
        existing.report.createdBy,
        ownerContext,
        tx
      );
      await this.recalculateDashboardMetrics(
        companyId,
        tenantId,
        userContext.employeeId,
        { role: 'Admin' },
        tx
      );

      return report;
    });
  }

  async deleteReport(id, userContext, companyId, tenantId) {
    return await this.repository.runTransaction(async tx => {
      const existing = await this.repository.getReportById(id, companyId, tenantId, userContext);
      if (!existing) {
        throw new AppError('Field report not found', 404);
      }

      const deleted = await this.repository.deleteReport(id, companyId, tenantId, userContext, tx);

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

      const ownerContext = { employeeId: existing.report.createdBy, role: 'Employee' };
      await this.recalculateDashboardMetrics(
        companyId,
        tenantId,
        existing.report.createdBy,
        ownerContext,
        tx
      );
      await this.recalculateDashboardMetrics(
        companyId,
        tenantId,
        userContext.employeeId,
        { role: 'Admin' },
        tx
      );

      return deleted;
    });
  }

  async getReportDetails(id, userContext, companyId, tenantId) {
    const details = await this.repository.getReportById(id, companyId, tenantId, userContext);
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

  async getReportsList(filters, userContext, companyId, tenantId) {
    const reports = await this.repository.getReportsList(filters, companyId, tenantId, userContext);
    return reports.map(r => new CompleteReportDTO(r));
  }

  async getDashboardSummary(companyId, tenantId, userContext) {
    const isUserAdmin = isAdmin(userContext);
    const metricKey = isUserAdmin
      ? 'dashboard_summary'
      : `dashboard_summary_emp_${userContext.employeeId}`;

    let metrics = await this.repository.getLatestDashboardMetrics(companyId, tenantId, metricKey);
    if (!metrics) {
      metrics = await this.recalculateDashboardMetrics(
        companyId,
        tenantId,
        userContext.employeeId,
        userContext
      );
    }
    return metrics;
  }

  async recalculateDashboardMetrics(
    companyId,
    tenantId,
    employeeId,
    userContext = null,
    tx = null
  ) {
    const isUserAdmin = userContext ? isAdmin(userContext) : false;
    const metricKey = isUserAdmin ? 'dashboard_summary' : `dashboard_summary_emp_${employeeId}`;

    const metricValue = await this.repository.getAggregatedDashboardMetrics(
      companyId,
      tenantId,
      userContext,
      tx
    );
    await this.repository.saveDashboardMetrics(
      companyId,
      tenantId,
      metricValue,
      employeeId,
      metricKey,
      tx
    );
    return metricValue;
  }

  async exportToCsv(companyId, tenantId, userContext = null) {
    const reports = await this.repository.getReportsList({}, companyId, tenantId, userContext);

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

  // ── Customer Intelligence ─────────────────────────────────────────────────

  async getCustomerSummary(filters, companyId, tenantId, userContext = null) {
    return await this.repository.getCustomerSummaryList(filters, companyId, tenantId, userContext);
  }

  async getCustomerHistory(customerId, companyId, tenantId, userContext = null) {
    const id = parseInt(customerId, 10);
    if (isNaN(id)) throw new AppError('Invalid customerId', 400);
    return await this.repository.getCustomerVisitHistory(id, companyId, tenantId, userContext);
  }

  async getCustomerDashboard(customerId, companyId, tenantId, userContext = null) {
    const id = parseInt(customerId, 10);
    if (isNaN(id)) throw new AppError('Invalid customerId', 400);

    // 1. Get all reports globally for this customer (no employee filter) to check existence
    const allReports = await this.repository.getCustomerVisitHistory(id, companyId, tenantId, null);
    if (allReports.length === 0) {
      throw new AppError('Customer record not found', 404);
    }

    // 2. Enforce ownership access check for non-admins
    const isUserAdmin = userContext ? isAdmin(userContext) : false;
    if (userContext && !isUserAdmin) {
      const hasOwnedReport = allReports.some(r => r.createdBy === userContext.employeeId);
      if (!hasOwnedReport) {
        throw new AppError('Access denied. You do not have permission to view this customer.', 403);
      }
    }

    // 3. Retrieve aggregated dashboard data scoped to the user
    const data = await this.repository.getCustomerDashboardData(
      id,
      companyId,
      tenantId,
      userContext
    );
    if (!data) throw new AppError('Customer record not found', 404);
    return data;
  }

  async getCustomerUnlinkedHistory(customerName, companyId, tenantId, userContext = null) {
    if (!customerName) throw new AppError('Customer name is required', 400);
    return await this.repository.getCustomerUnlinkedHistory(
      customerName,
      companyId,
      tenantId,
      userContext
    );
  }

  async linkCustomerBulk(customerId, customerName, companyId, tenantId, userContext = null) {
    const custId = parseInt(customerId, 10);
    if (isNaN(custId)) throw new AppError('Invalid customerId', 400);
    if (!customerName) throw new AppError('Customer name is required', 400);
    return await this.repository.linkCustomerBulk(
      custId,
      customerName,
      companyId,
      tenantId,
      userContext
    );
  }
}

function isAdmin(userContext) {
  if (!userContext) return false;
  const role = userContext.role || userContext.Role;
  return ['SuperAdmin', 'Admin', 'Accounts Manager', 'Production Manager'].includes(role);
}
