import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
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

export class FieldIntelligenceRepository {
  async createReport(reportData, tx) {
    const client = tx || db;
    const [report] = await client.insert(fieldIntelligenceReports).values(reportData).returning();
    return report;
  }

  async updateReport(id, reportData, companyId, tenantId, tx) {
    const client = tx || db;
    const [report] = await client
      .update(fieldIntelligenceReports)
      .set({ ...reportData, updatedAt: new Date() })
      .where(
        and(
          eq(fieldIntelligenceReports.id, id),
          eq(fieldIntelligenceReports.companyId, companyId),
          eq(fieldIntelligenceReports.tenantId, tenantId)
        )
      )
      .returning();
    return report;
  }

  async deleteReport(id, companyId, tenantId, tx) {
    const client = tx || db;
    const [report] = await client
      .delete(fieldIntelligenceReports)
      .where(
        and(
          eq(fieldIntelligenceReports.id, id),
          eq(fieldIntelligenceReports.companyId, companyId),
          eq(fieldIntelligenceReports.tenantId, tenantId)
        )
      )
      .returning();
    return report;
  }

  async getReportById(id, companyId, tenantId) {
    const [report] = await db
      .select()
      .from(fieldIntelligenceReports)
      .where(
        and(
          eq(fieldIntelligenceReports.id, id),
          eq(fieldIntelligenceReports.companyId, companyId),
          eq(fieldIntelligenceReports.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!report) return null;

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

  async getReportsList(filters = {}, companyId, tenantId) {
    const conditions = [
      eq(fieldIntelligenceReports.companyId, companyId),
      eq(fieldIntelligenceReports.tenantId, tenantId),
    ];

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

    return await query;
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

  async getLatestDashboardMetrics(companyId, tenantId) {
    const [metrics] = await db
      .select()
      .from(fieldIntelligenceDashboardMetrics)
      .where(
        and(
          eq(fieldIntelligenceDashboardMetrics.companyId, companyId),
          eq(fieldIntelligenceDashboardMetrics.tenantId, tenantId)
        )
      )
      .orderBy(desc(fieldIntelligenceDashboardMetrics.calculatedAt))
      .limit(1);
    return metrics?.metricValue || null;
  }

  async saveDashboardMetrics(companyId, tenantId, metricValue, createdBy, tx) {
    const client = tx || db;
    const [metrics] = await client
      .insert(fieldIntelligenceDashboardMetrics)
      .values({
        metricKey: 'dashboard_summary',
        metricValue,
        companyId,
        tenantId,
        createdBy,
        calculatedAt: new Date(),
      })
      .returning();
    return metrics;
  }

  async getAggregatedDashboardMetrics(companyId, tenantId, tx) {
    const client = tx || db;
    const now = new Date();

    // 1. Total Visits, Average Conversion, Expected Revenue, High Potential Accounts
    const [summary] = await client
      .select({
        totalVisits: sql`COUNT(${fieldIntelligenceReports.id})::int`,
        avgConversion: sql`ROUND(AVG(${fieldIntelligenceReports.conversionProbability}))::int`,
        expectedRevenue: sql`COALESCE(SUM(${fieldIntelligenceReports.potentialBusinessValue}), 0)::numeric`,
        highPotentialCount: sql`COUNT(CASE WHEN ${fieldIntelligenceReports.conversionProbability} >= 70 OR ${fieldIntelligenceReports.monthlyConsumption} >= 500000 THEN 1 END)::int`,
      })
      .from(fieldIntelligenceReports)
      .where(
        and(
          eq(fieldIntelligenceReports.companyId, companyId),
          eq(fieldIntelligenceReports.tenantId, tenantId)
        )
      );

    // 2. Visits per Day
    const visitsPerDayResult = await client
      .select({
        day: sql`TO_CHAR(${fieldIntelligenceReports.visitDate}, 'YYYY-MM-DD')`,
        count: sql`COUNT(${fieldIntelligenceReports.id})::int`,
      })
      .from(fieldIntelligenceReports)
      .where(
        and(
          eq(fieldIntelligenceReports.companyId, companyId),
          eq(fieldIntelligenceReports.tenantId, tenantId),
          sql`${fieldIntelligenceReports.visitDate} IS NOT NULL`
        )
      )
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
      .where(
        and(
          eq(fieldIntelligenceReports.companyId, companyId),
          eq(fieldIntelligenceReports.tenantId, tenantId)
        )
      )
      .groupBy(fieldIntelligenceReports.executiveName);

    const visitsPerExecutive = {};
    visitsPerExecResult.forEach(r => {
      const name = r.exec || 'Unknown';
      visitsPerExecutive[name] = r.count;
    });

    // 4. Competitor Frequency
    const competitorResult = await client
      .select({
        name: fieldIntelligenceCompetitors.competitorName,
        count: sql`COUNT(${fieldIntelligenceCompetitors.id})::int`,
      })
      .from(fieldIntelligenceCompetitors)
      .where(
        and(
          eq(fieldIntelligenceCompetitors.companyId, companyId),
          eq(fieldIntelligenceCompetitors.tenantId, tenantId)
        )
      )
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
      .where(
        and(
          eq(fieldIntelligenceReports.companyId, companyId),
          eq(fieldIntelligenceReports.tenantId, tenantId)
        )
      )
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
    const [followupsSummary] = await client
      .select({
        due: sql`COUNT(CASE WHEN ${fieldIntelligenceFollowups.followupDate} >= ${now} THEN 1 END)::int`,
        missed: sql`COUNT(CASE WHEN ${fieldIntelligenceFollowups.followupDate} < ${now} THEN 1 END)::int`,
      })
      .from(fieldIntelligenceFollowups)
      .where(
        and(
          eq(fieldIntelligenceFollowups.companyId, companyId),
          eq(fieldIntelligenceFollowups.tenantId, tenantId),
          eq(fieldIntelligenceFollowups.status, 'Open')
        )
      );

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
}
