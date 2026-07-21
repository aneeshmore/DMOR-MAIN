import { eq, and, or, like, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  fieldIntelligenceReports,
  fieldIntelligenceFollowups,
  fieldIntelligenceUploads,
  fieldIntelligenceCompetitors,
  fieldIntelligenceActivityLog,
  fieldIntelligenceAiInsights,
  fieldIntelligenceDashboardMetrics,
} from '../../db/schema/field-intelligence.schema.js';
import { customers } from '../../db/schema/sales/customers.js';

function isAdmin(userContext) {
  if (!userContext) return false;
  const role = userContext.role || userContext.Role;
  return ['SuperAdmin', 'Admin', 'Accounts Manager', 'Production Manager'].includes(role);
}

export class FieldIntelligenceRepository {
  async createReport(reportData, tx) {
    const client = tx || db;
    const [report] = await client.insert(fieldIntelligenceReports).values(reportData).returning();
    return report;
  }

  async updateReport(id, reportData, companyId, tenantId, userContext = null, tx = null) {
    const client = tx || db;
    const conditions = [
      eq(fieldIntelligenceReports.id, id),
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];
    if (userContext && !isAdmin(userContext)) {
      conditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }
    const [report] = await client
      .update(fieldIntelligenceReports)
      .set({ ...reportData, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return report;
  }

  async deleteReport(id, companyId, tenantId, userContext = null, tx = null) {
    const client = tx || db;
    const conditions = [
      eq(fieldIntelligenceReports.id, id),
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];
    if (userContext && !isAdmin(userContext)) {
      conditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }
    const [report] = await client
      .delete(fieldIntelligenceReports)
      .where(and(...conditions))
      .returning();
    return report;
  }

  async getReportById(id, companyId, tenantId, userContext = null) {
    const conditions = [
      eq(fieldIntelligenceReports.id, id),
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];
    if (userContext && !isAdmin(userContext)) {
      conditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }

    const [report] = await db
      .select()
      .from(fieldIntelligenceReports)
      .where(and(...conditions))
      .limit(1);

    if (!report) return null;

    if (report.dynamicFields) {
      Object.assign(report, report.dynamicFields);
    }

    const followups = await db
      .select()
      .from(fieldIntelligenceFollowups)
      .where(eq(fieldIntelligenceFollowups.reportId, id))
      .orderBy(asc(fieldIntelligenceFollowups.followupDate));

    const competitors = await db
      .select()
      .from(fieldIntelligenceCompetitors)
      .where(eq(fieldIntelligenceCompetitors.reportId, id));

    const uploads = await db
      .select()
      .from(fieldIntelligenceUploads)
      .where(eq(fieldIntelligenceUploads.reportId, id));

    const insights = await db
      .select()
      .from(fieldIntelligenceAiInsights)
      .where(eq(fieldIntelligenceAiInsights.reportId, id));

    const logs = await db
      .select()
      .from(fieldIntelligenceActivityLog)
      .where(eq(fieldIntelligenceActivityLog.reportId, id))
      .orderBy(desc(fieldIntelligenceActivityLog.createdAt));

    return {
      report,
      followups,
      competitors,
      uploads,
      insights,
      activityLogs: logs,
    };
  }

  async getReportsList(filters = {}, companyId, tenantId, userContext = null) {
    const conditions = [
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];

    if (userContext && !isAdmin(userContext)) {
      conditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }

    if (filters.status) {
      conditions.push(eq(fieldIntelligenceReports.status, filters.status));
    }

    if (filters.executiveId) {
      conditions.push(eq(fieldIntelligenceReports.executiveId, filters.executiveId));
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(fieldIntelligenceReports.customerName, searchPattern),
          like(fieldIntelligenceReports.currentSupplier, searchPattern),
          like(fieldIntelligenceReports.city, searchPattern),
          like(fieldIntelligenceReports.state, searchPattern)
        )
      );
    }

    const query = db
      .select()
      .from(fieldIntelligenceReports)
      .where(and(...conditions));

    if (filters.sortBy === 'visitDate') {
      query.orderBy(
        filters.sortOrder === 'asc'
          ? asc(fieldIntelligenceReports.visitDate)
          : desc(fieldIntelligenceReports.visitDate)
      );
    } else {
      query.orderBy(desc(fieldIntelligenceReports.createdAt));
    }

    if (filters.limit) {
      query.limit(filters.limit);
    }
    if (filters.offset) {
      query.offset(filters.offset);
    }

    const reports = await query;
    reports.forEach(r => {
      if (r && r.dynamicFields) {
        Object.assign(r, r.dynamicFields);
      }
    });
    return reports;
  }

  async batchInsertCompetitors(competitorsData, tx) {
    if (competitorsData.length === 0) return [];
    const client = tx || db;
    return await client.insert(fieldIntelligenceCompetitors).values(competitorsData).returning();
  }

  async deleteCompetitorsForReport(reportId, tx) {
    const client = tx || db;
    return await client
      .delete(fieldIntelligenceCompetitors)
      .where(eq(fieldIntelligenceCompetitors.reportId, reportId))
      .returning();
  }

  async batchInsertFollowups(followupsData, tx) {
    if (followupsData.length === 0) return [];
    const client = tx || db;
    return await client.insert(fieldIntelligenceFollowups).values(followupsData).returning();
  }

  async deleteFollowupsForReport(reportId, tx) {
    const client = tx || db;
    return await client
      .delete(fieldIntelligenceFollowups)
      .where(eq(fieldIntelligenceFollowups.reportId, reportId))
      .returning();
  }

  async batchInsertUploads(uploadsData, tx) {
    if (uploadsData.length === 0) return [];
    const client = tx || db;
    return await client.insert(fieldIntelligenceUploads).values(uploadsData).returning();
  }

  async deleteUploadsForReport(reportId, tx) {
    const client = tx || db;
    return await client
      .delete(fieldIntelligenceUploads)
      .where(eq(fieldIntelligenceUploads.reportId, reportId))
      .returning();
  }

  async insertActivityLog(logData, tx) {
    const client = tx || db;
    const [log] = await client.insert(fieldIntelligenceActivityLog).values(logData).returning();
    return log;
  }

  async batchInsertAiInsights(insightsData, tx) {
    if (insightsData.length === 0) return [];
    const client = tx || db;
    return await client.insert(fieldIntelligenceAiInsights).values(insightsData).returning();
  }

  async deleteAiInsightsForReport(reportId, tx) {
    const client = tx || db;
    return await client
      .delete(fieldIntelligenceAiInsights)
      .where(eq(fieldIntelligenceAiInsights.reportId, reportId))
      .returning();
  }

  async getFollowupsDue(companyId, tenantId, relativeDate = new Date()) {
    return await db
      .select({
        followup: fieldIntelligenceFollowups,
        report: fieldIntelligenceReports,
      })
      .from(fieldIntelligenceFollowups)
      .innerJoin(
        fieldIntelligenceReports,
        eq(fieldIntelligenceFollowups.reportId, fieldIntelligenceReports.id)
      )
      .where(
        and(
          eq(fieldIntelligenceFollowups.companyId, companyId),
          eq(fieldIntelligenceFollowups.tenantId, tenantId),
          eq(fieldIntelligenceFollowups.status, 'Open')
        )
      )
      .orderBy(asc(fieldIntelligenceFollowups.followupDate));
  }

  async getLatestDashboardMetrics(companyId, tenantId, metricKey = 'dashboard_summary') {
    const [metrics] = await db
      .select()
      .from(fieldIntelligenceDashboardMetrics)
      .where(
        and(
          eq(fieldIntelligenceDashboardMetrics.companyId, companyId),
          eq(fieldIntelligenceDashboardMetrics.tenantId, tenantId),
          eq(fieldIntelligenceDashboardMetrics.metricKey, metricKey)
        )
      )
      .orderBy(desc(fieldIntelligenceDashboardMetrics.calculatedAt))
      .limit(1);
    return metrics?.metricValue || null;
  }

  async saveDashboardMetrics(
    companyId,
    tenantId,
    metricValue,
    createdBy,
    metricKey = 'dashboard_summary',
    tx
  ) {
    const client = tx || db;
    const [metrics] = await client
      .insert(fieldIntelligenceDashboardMetrics)
      .values({
        metricKey,
        metricValue,
        companyId,
        tenantId,
        createdBy,
        calculatedAt: new Date(),
      })
      .returning();
    return metrics;
  }

  async getAggregatedDashboardMetrics(companyId, tenantId, userContext = null, tx) {
    const client = tx || db;
    const now = new Date();

    // 1. Total Visits, Average Conversion, Expected Revenue, High Potential Accounts
    const reportConditions = [
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];
    if (userContext && !isAdmin(userContext)) {
      reportConditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }

    const [summary] = await client
      .select({
        totalVisits: sql`COUNT(${fieldIntelligenceReports.id})::int`,
        avgConversion: sql`ROUND(AVG(${fieldIntelligenceReports.conversionProbability}))::int`,
        expectedRevenue: sql`COALESCE(SUM(${fieldIntelligenceReports.potentialBusinessValue}), 0)::numeric`,
        highPotentialCount: sql`COUNT(CASE WHEN ${fieldIntelligenceReports.conversionProbability} >= 70 OR ${fieldIntelligenceReports.monthlyConsumption} >= 500000 THEN 1 END)::int`,
      })
      .from(fieldIntelligenceReports)
      .where(and(...reportConditions));

    // 2. Visits per Day
    const visitsPerDayResult = await client
      .select({
        day: sql`TO_CHAR(${fieldIntelligenceReports.visitDate}, 'YYYY-MM-DD')`,
        count: sql`COUNT(${fieldIntelligenceReports.id})::int`,
      })
      .from(fieldIntelligenceReports)
      .where(and(...reportConditions, sql`${fieldIntelligenceReports.visitDate} IS NOT NULL`))
      .groupBy(sql`TO_CHAR(${fieldIntelligenceReports.visitDate}, 'YYYY-MM-DD')`);

    const visitsPerDay = {};
    visitsPerDayResult.forEach(r => {
      if (r.day) visitsPerDay[r.day] = r.count;
    });

    // 3. Visits per Executive
    const visitsPerExecResult = await client
      .select({
        exec: fieldIntelligenceReports.executiveName,
        count: sql`COUNT(${fieldIntelligenceReports.id})::int`,
      })
      .from(fieldIntelligenceReports)
      .where(and(...reportConditions))
      .groupBy(fieldIntelligenceReports.executiveName);

    const visitsPerExecutive = {};
    visitsPerExecResult.forEach(r => {
      const name = r.exec || 'Unknown';
      visitsPerExecutive[name] = r.count;
    });

    // 4. Competitor Frequency
    const competitorConditions = [
      eq(fieldIntelligenceCompetitors.companyId, companyId),
      eq(fieldIntelligenceCompetitors.tenantId, tenantId),
    ];
    if (userContext && !isAdmin(userContext)) {
      competitorConditions.push(eq(fieldIntelligenceCompetitors.createdBy, userContext.employeeId));
    }

    const competitorResult = await client
      .select({
        name: fieldIntelligenceCompetitors.competitorName,
        count: sql`COUNT(${fieldIntelligenceCompetitors.id})::int`,
      })
      .from(fieldIntelligenceCompetitors)
      .where(and(...competitorConditions))
      .groupBy(fieldIntelligenceCompetitors.competitorName);

    const competitorAnalysis = {};
    competitorResult.forEach(r => {
      const name = r.name || 'Other';
      competitorAnalysis[name] = r.count;
    });

    // 5. Territory Performance
    const territoryResult = await client
      .select({
        state: fieldIntelligenceReports.state,
        city: fieldIntelligenceReports.city,
        visits: sql`COUNT(${fieldIntelligenceReports.id})::int`,
        revenue: sql`COALESCE(SUM(${fieldIntelligenceReports.potentialBusinessValue}), 0)::numeric`,
      })
      .from(fieldIntelligenceReports)
      .where(and(...reportConditions))
      .groupBy(fieldIntelligenceReports.state, fieldIntelligenceReports.city);

    const territoryPerformance = {};
    territoryResult.forEach(r => {
      const loc = r.state || r.city || 'Other';
      if (!territoryPerformance[loc]) {
        territoryPerformance[loc] = { visits: 0, revenue: 0 };
      }
      territoryPerformance[loc].visits += r.visits;
      territoryPerformance[loc].revenue += parseFloat(r.revenue);
    });

    // 6. Followups Due vs Missed
    const followupConditions = [
      eq(fieldIntelligenceFollowups.companyId, companyId),
      eq(fieldIntelligenceFollowups.tenantId, tenantId),
      eq(fieldIntelligenceFollowups.status, 'Open'),
    ];
    if (userContext && !isAdmin(userContext)) {
      followupConditions.push(eq(fieldIntelligenceFollowups.createdBy, userContext.employeeId));
    }

    const [followupsSummary] = await client
      .select({
        due: sql`COUNT(CASE WHEN ${fieldIntelligenceFollowups.followupDate} >= ${now} THEN 1 END)::int`,
        missed: sql`COUNT(CASE WHEN ${fieldIntelligenceFollowups.followupDate} < ${now} THEN 1 END)::int`,
      })
      .from(fieldIntelligenceFollowups)
      .where(and(...followupConditions));

    return {
      totalVisits: summary?.totalVisits || 0,
      visitsPerDay,
      visitsPerExecutive,
      conversionRate: summary?.avgConversion || 0,
      expectedRevenue: parseFloat(summary?.expectedRevenue || 0),
      followupsDue: followupsSummary?.due || 0,
      followupsMissed: followupsSummary?.missed || 0,
      highPotentialAccounts: summary?.highPotentialCount || 0,
      competitorAnalysis,
      territoryPerformance,
    };
  }

  async runTransaction(callback) {
    return await db.transaction(callback);
  }

  // ── Customer Intelligence Methods ────────────────────────────────────────

  /**
   * Returns one row per customerId (linked customers) + a separate group
   * for legacy reports that have no customerId (NULL).
   */
  async getCustomerSummaryList(filters = {}, companyId, tenantId, userContext = null) {
    const conditions = [
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(like(fieldIntelligenceReports.customerName, searchPattern));
    }

    if (userContext && !isAdmin(userContext)) {
      conditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }

    const isEmp = userContext && !isAdmin(userContext);
    const linkedStatusSql = isEmp
      ? sql`(
          SELECT status FROM app.field_intelligence_reports fir2
          WHERE fir2.customer_id = ${fieldIntelligenceReports.customerId}
            AND fir2.company_id = ${companyId}
            AND fir2.tenant_id = ${tenantId}::uuid
            AND fir2.created_by = ${userContext.employeeId}
          ORDER BY fir2.visit_date DESC
          LIMIT 1
        )`
      : sql`(
          SELECT status FROM app.field_intelligence_reports fir2
          WHERE fir2.customer_id = ${fieldIntelligenceReports.customerId}
            AND fir2.company_id = ${companyId}
            AND fir2.tenant_id = ${tenantId}::uuid
          ORDER BY fir2.visit_date DESC
          LIMIT 1
        )`;

    const unlinkedStatusSql = isEmp
      ? sql`(
          SELECT status FROM app.field_intelligence_reports fir2
          WHERE fir2.customer_name = ${fieldIntelligenceReports.customerName}
            AND fir2.customer_id IS NULL
            AND fir2.company_id = ${companyId}
            AND fir2.tenant_id = ${tenantId}::uuid
            AND fir2.created_by = ${userContext.employeeId}
          ORDER BY fir2.visit_date DESC
          LIMIT 1
        )`
      : sql`(
          SELECT status FROM app.field_intelligence_reports fir2
          WHERE fir2.customer_name = ${fieldIntelligenceReports.customerName}
            AND fir2.customer_id IS NULL
            AND fir2.company_id = ${companyId}
            AND fir2.tenant_id = ${tenantId}::uuid
          ORDER BY fir2.visit_date DESC
          LIMIT 1
        )`;

    // Linked customers: GROUP BY customerId
    const linked = await db
      .select({
        customerId: fieldIntelligenceReports.customerId,
        customerName: sql`COALESCE(${customers.companyName}, MAX(${fieldIntelligenceReports.customerName}))`,
        totalVisits: sql`COUNT(${fieldIntelligenceReports.id})::int`,
        latestVisitDate: sql`MAX(${fieldIntelligenceReports.visitDate})`,
        avgConversion: sql`ROUND(AVG(${fieldIntelligenceReports.conversionProbability}))::int`,
        latestStatus: linkedStatusSql,
      })
      .from(fieldIntelligenceReports)
      .leftJoin(customers, eq(fieldIntelligenceReports.customerId, customers.customerId))
      .where(and(...conditions, sql`${fieldIntelligenceReports.customerId} IS NOT NULL`))
      .groupBy(fieldIntelligenceReports.customerId, customers.customerId, customers.companyName)
      .orderBy(sql`MAX(${fieldIntelligenceReports.visitDate}) DESC`);

    // Unlinked historical records: customerId IS NULL – group by customerName
    const unlinked = await db
      .select({
        customerId: sql`NULL::int`,
        customerName: fieldIntelligenceReports.customerName,
        totalVisits: sql`COUNT(${fieldIntelligenceReports.id})::int`,
        latestVisitDate: sql`MAX(${fieldIntelligenceReports.visitDate})`,
        avgConversion: sql`ROUND(AVG(${fieldIntelligenceReports.conversionProbability}))::int`,
        latestStatus: unlinkedStatusSql,
      })
      .from(fieldIntelligenceReports)
      .where(and(...conditions, sql`${fieldIntelligenceReports.customerId} IS NULL`))
      .groupBy(fieldIntelligenceReports.customerName)
      .orderBy(sql`MAX(${fieldIntelligenceReports.visitDate}) DESC`);

    return { linked, unlinked };
  }

  /** All visits for a specific customerId, ordered by visitDate DESC */
  async getCustomerVisitHistory(customerId, companyId, tenantId, userContext = null) {
    const conditions = [
      eq(fieldIntelligenceReports.customerId, customerId),
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];
    if (userContext && !isAdmin(userContext)) {
      conditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }
    return await db
      .select()
      .from(fieldIntelligenceReports)
      .where(and(...conditions))
      .orderBy(desc(fieldIntelligenceReports.visitDate));
  }

  /** Full aggregated data for the customer dashboard */
  async getCustomerDashboardData(customerId, companyId, tenantId, userContext = null) {
    const reports = await this.getCustomerVisitHistory(
      customerId,
      companyId,
      tenantId,
      userContext
    );
    if (reports.length === 0) return null;

    const latest = reports[0];
    const oldest = reports[reports.length - 1];

    const [customerRow] = await db
      .select({ companyName: customers.companyName })
      .from(customers)
      .where(eq(customers.customerId, customerId))
      .limit(1);
    const customerDisplayName = customerRow ? customerRow.companyName : latest.customerName;

    // Visit gap in days
    const totalDays =
      reports.length > 1
        ? Math.round(
            (new Date(latest.visitDate) - new Date(oldest.visitDate)) / (1000 * 60 * 60 * 24)
          )
        : 0;
    const avgGapDays = reports.length > 1 ? Math.round(totalDays / (reports.length - 1)) : 0;

    // Aggregate unique values from all reports
    const unique = arr => [...new Set(arr.filter(Boolean))];
    const flatUnique = arrays => unique(arrays.flat().filter(Boolean));

    const avgConversion = Math.round(
      reports.reduce((sum, r) => sum + (parseInt(r.conversionProbability) || 0), 0) / reports.length
    );

    const submittedCount = reports.filter(
      r => r.status === 'Submitted' || r.status === 'Approved'
    ).length;
    const draftCount = reports.filter(r => r.status === 'Draft').length;

    // Relationship age
    const oldestDate = new Date(oldest.visitDate);
    const diffTime = Math.abs(new Date().getTime() - oldestDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.ceil(diffDays / 30);
    const relationshipAgeText =
      diffMonths > 0 ? `${diffMonths} month${diffMonths > 1 ? 's' : ''}` : 'Less than a month';

    // Followups compliance & missed
    const reportIds = reports.map(r => r.id);
    const allFollowups =
      reportIds.length > 0
        ? await db
            .select()
            .from(fieldIntelligenceFollowups)
            .where(inArray(fieldIntelligenceFollowups.reportId, reportIds))
        : [];
    const totalFollowups = allFollowups.length;
    const completedFollowups = allFollowups.filter(f => f.status === 'Completed').length;
    const followupComplianceVal =
      totalFollowups > 0 ? `${Math.round((completedFollowups / totalFollowups) * 100)}%` : '100%';
    const missedFollowupsVal = allFollowups.filter(
      f => f.status === 'Missed' || (f.status === 'Open' && new Date(f.followupDate) < new Date())
    ).length;

    // Competitors detail list
    const competitorRows =
      reportIds.length > 0
        ? await db
            .select()
            .from(fieldIntelligenceCompetitors)
            .where(inArray(fieldIntelligenceCompetitors.reportId, reportIds))
        : [];

    // Sales Activity Trend calculation
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const recentCount = reports.filter(r => new Date(r.visitDate) >= thirtyDaysAgo).length;
    const priorCount = reports.filter(r => {
      const d = new Date(r.visitDate);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    }).length;
    const salesActivityTrend =
      recentCount > priorCount ? 'Increasing' : recentCount < priorCount ? 'Declining' : 'Stable';

    return {
      profile: {
        customerId,
        customerName: customerDisplayName,
        contactPerson: latest.contactPerson,
        designation: latest.designation,
        businessCategory: latest.businessCategory,
        mobile: latest.mobile,
        email: latest.email,
        address: latest.address,
        city: latest.city,
        state: latest.state,
        pinCode: latest.pinCode,
        gstNumber: latest.gstNumber,
      },
      analytics: {
        totalVisits: reports.length,
        submittedVisits: submittedCount,
        draftVisits: draftCount,
        firstVisitDate: oldest.visitDate,
        latestVisitDate: latest.visitDate,
        avgGapDays,
        avgConversionProbability: avgConversion,
        visitFrequency: avgGapDays > 0 ? `Every ${avgGapDays} days` : 'Single visit',
        relationshipAge: relationshipAgeText,
        followupCompliance: followupComplianceVal,
        missedFollowups: missedFollowupsVal,
        salesActivityTrend,
      },
      sales: {
        currentSupplier: unique(reports.map(r => r.currentSupplier)).join(', '),
        currentPurchaseRate: latest.currentPurchaseRate,
        expectedRate: latest.expectedRate,
        creditDays: latest.creditDays,
        outstandingAmount: latest.outstandingAmount,
        monthlyConsumption: latest.monthlyConsumption,
        expectedMonthlyBusiness: latest.expectedMonthlyBusiness,
        potentialBusinessValue: latest.potentialBusinessValue,
      },
      products: {
        requiredFinish: unique(reports.map(r => r.requiredFinish)),
        paintRequirementTypes: flatUnique(reports.map(r => r.paintRequirementTypes || [])),
        surfaceTypes: flatUnique(reports.map(r => r.surfaceTypes || [])),
        applicationMethods: flatUnique(reports.map(r => r.applicationMethods || [])),
        technicalChallenges: flatUnique(reports.map(r => r.technicalChallenges || [])),
        requiredShade: flatUnique(
          reports.map(r => (r.requiredShade ? r.requiredShade.split(',').map(s => s.trim()) : []))
        ),
      },
      visits: reports,
      competitorsDetail: competitorRows,
    };
  }

  async getCustomerUnlinkedHistory(customerName, companyId, tenantId, userContext = null) {
    const conditions = [
      eq(fieldIntelligenceReports.customerName, customerName),
      sql`customer_id IS NULL`,
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];
    if (userContext && !isAdmin(userContext)) {
      conditions.push(eq(fieldIntelligenceReports.createdBy, userContext.employeeId));
    }
    return await db
      .select()
      .from(fieldIntelligenceReports)
      .where(and(...conditions))
      .orderBy(desc(fieldIntelligenceReports.visitDate));
  }
}
