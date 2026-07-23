import {
  safeIsoDate,
  safeArray,
  safeString,
  normalizeReportData,
} from './utils/legacyNormalizer.js';

export class FieldIntelligenceReportDTO {
  constructor(rawReport) {
    const report = normalizeReportData(rawReport || {});

    const mapNA = val => {
      if (val === null || val === undefined) return 'N/A';
      const strVal = String(val).trim();
      return strVal === '' ||
        strVal.toLowerCase() === 'null' ||
        strVal.toLowerCase() === 'undefined'
        ? 'N/A'
        : val;
    };

    this.id = report.id;
    this.reportNumber = report.reportNumber;
    this.visitDate = safeIsoDate(report.visitDate, new Date().toISOString());
    this.timeIn = mapNA(report.timeIn);
    this.timeOut = report.timeOut;
    this.visitDuration = mapNA(report.visitDuration);
    this.gpsLatitude = report.gpsLatitude;
    this.gpsLongitude = report.gpsLongitude;
    this.executiveId = report.executiveId;
    this.executiveName = report.executiveName;
    this.branch = report.branch;
    this.region = report.region;
    this.visitType = report.visitType;
    this.visitPurpose = report.visitPurpose;
    this.customerName = report.customerName;
    this.customerId = report.customerId || report.customer_id || null;
    this.contactPerson = mapNA(report.contactPerson);
    this.designation = mapNA(report.designation);
    this.mobile = mapNA(report.mobile);
    this.whatsapp = mapNA(report.whatsapp);
    this.email = mapNA(report.email);
    this.gstNumber = mapNA(report.gstNumber);
    this.address = report.address;
    this.city = report.city;
    this.state = report.state;
    this.pinCode = mapNA(report.pinCode);
    this.businessCategory = report.businessCategory;
    this.dynamicFields = report.dynamicFields ?? {};
    this.monthlyConsumption = mapNA(report.monthlyConsumption);
    this.currentSupplier = mapNA(report.currentSupplier);
    this.paintRequirementTypes = safeArray(report.paintRequirementTypes);
    this.surfaceTypes = safeArray(report.surfaceTypes);
    this.applicationMethods = safeArray(report.applicationMethods);
    this.requiredShade = mapNA(report.requiredShade);
    this.requiredFinish = mapNA(report.requiredFinish);
    this.technicalChallenges = safeArray(report.technicalChallenges);
    this.currentSystemUsed = mapNA(report.currentSystemUsed);
    this.monthlyConsumptionText = mapNA(report.monthlyConsumptionText);
    this.currentPurchaseRate = mapNA(report.currentPurchaseRate);
    this.expectedRate = mapNA(report.expectedRate);
    this.creditDays = mapNA(report.creditDays);
    this.outstandingAmount = mapNA(report.outstandingAmount);
    this.purchaseDecisionBy = mapNA(report.purchaseDecisionBy);
    this.purchaseCycle = mapNA(report.purchaseCycle);
    this.potentialBusinessValue = mapNA(report.potentialBusinessValue);
    this.expectedMonthlyBusiness = mapNA(report.expectedMonthlyBusiness);
    this.conversionProbability = mapNA(report.conversionProbability);
    this.discussionNotes = safeString(report.discussionNotes);
    this.importantObservations = mapNA(report.importantObservations);
    this.customerMood = mapNA(report.customerMood);
    this.hiddenOpportunity = mapNA(report.hiddenOpportunity);
    this.riskFactors = mapNA(report.riskFactors);
    this.immediateRequirement = mapNA(report.immediateRequirement);
    this.expectedOrderDate = safeIsoDate(report.expectedOrderDate, 'N/A');
    this.expectedOrderQuantity = mapNA(report.expectedOrderQuantity);
    this.trialApproved = !!report.trialApproved;
    this.sampleGiven = !!report.sampleGiven;
    this.followupUrgencyScore = report.followupUrgencyScore;
    this.dealerConfidence = report.dealerConfidence;
    this.paymentReliability = report.paymentReliability;
    this.relationshipStrength = report.relationshipStrength;
    this.technicalCapability = report.technicalCapability;
    this.longTermPotential = report.longTermPotential;
    this.executiveRecommendation = mapNA(report.executiveRecommendation);
    this.status = report.status;
    this.companyId = report.companyId;
    this.tenantId = report.tenantId;
    this.createdBy = report.createdBy;
    this.createdAt = safeIsoDate(report.createdAt, new Date().toISOString());
    this.updatedAt = safeIsoDate(report.updatedAt, new Date().toISOString());

    // Copy dynamic/custom fields dynamically to DTO
    if (report.dynamicFields && typeof report.dynamicFields === 'object') {
      Object.entries(report.dynamicFields).forEach(([k, v]) => {
        if (!(k in this)) {
          this[k] = v;
        }
      });
    }
    // Also copy other non-declared flat fields that might be on the report object
    Object.entries(report).forEach(([k, v]) => {
      if (!(k in this) && k !== 'dynamicFields') {
        this[k] = v;
      }
    });
  }
}

export class FollowupDTO {
  constructor(followup = {}) {
    this.id = followup.id;
    this.reportId = followup.reportId;
    this.followupDate = safeIsoDate(followup.followupDate, '-');
    this.notes = safeString(followup.notes, '-');
    this.actionType = safeString(followup.actionType, 'N/A');
    this.followupMode = safeString(followup.followupMode, 'N/A');
    this.status = safeString(followup.status, 'Open');
    this.companyId = followup.companyId;
    this.tenantId = followup.tenantId;
    this.createdBy = followup.createdBy;
    this.createdAt = safeIsoDate(followup.createdAt, '-');
    this.updatedAt = safeIsoDate(followup.updatedAt, '-');
  }
}

export class CompetitorDTO {
  constructor(competitor = {}) {
    this.id = competitor.id;
    this.reportId = competitor.reportId;
    this.competitorName = safeString(competitor.competitorName, '-');
    this.strengths = safeString(competitor.strengths, '-');
    this.weaknesses = safeString(competitor.weaknesses, '-');
    this.reasonUsingCompetitor = safeString(competitor.reasonUsingCompetitor, '-');
    this.reasonShiftToUs = safeString(competitor.reasonShiftToUs, '-');
    this.companyId = competitor.companyId;
    this.tenantId = competitor.tenantId;
    this.createdBy = competitor.createdBy;
    this.createdAt = safeIsoDate(competitor.createdAt, '-');
    this.updatedAt = safeIsoDate(competitor.updatedAt, '-');
  }
}

export class UploadDTO {
  constructor(upload = {}) {
    this.id = upload.id;
    this.reportId = upload.reportId;
    this.fileType = safeString(upload.fileType, '-');
    this.fileName = safeString(upload.fileName, '-');
    this.filePath = safeString(upload.filePath, '-');
    this.mimeType = safeString(upload.mimeType, '-');
    this.fileSize = upload.fileSize || 0;
    this.uploadedBy = upload.uploadedBy;
    this.companyId = upload.companyId;
    this.tenantId = upload.tenantId;
    this.createdBy = upload.createdBy;
    this.createdAt = safeIsoDate(upload.createdAt, '-');
    this.updatedAt = safeIsoDate(upload.updatedAt, '-');
  }
}

export class ActivityLogDTO {
  constructor(log = {}) {
    this.id = log.id;
    this.reportId = log.reportId;
    this.activityType = safeString(log.activityType, '-');
    this.details = log.details && typeof log.details === 'object' ? log.details : {};
    this.companyId = log.companyId;
    this.tenantId = log.tenantId;
    this.createdBy = log.createdBy;
    this.createdAt = safeIsoDate(log.createdAt, '-');
    this.updatedAt = safeIsoDate(log.updatedAt, '-');
  }
}

export class AiInsightDTO {
  constructor(insight = {}) {
    this.id = insight.id;
    this.reportId = insight.reportId;
    this.insightType = safeString(insight.insightType, '-');
    this.observation = safeString(insight.observation, '-');
    this.reasoning = safeString(insight.reasoning, '-');
    this.severity = safeString(insight.severity, 'medium');
    this.companyId = insight.companyId;
    this.tenantId = insight.tenantId;
    this.createdBy = insight.createdBy;
    this.createdAt = safeIsoDate(insight.createdAt, '-');
    this.updatedAt = safeIsoDate(insight.updatedAt, '-');
  }
}

export class CompleteReportDTO extends FieldIntelligenceReportDTO {
  constructor(report, followups = [], competitors = [], uploads = [], insights = [], logs = []) {
    super(report);
    this.followups = followups.map(f => new FollowupDTO(f));
    this.competitors = competitors.map(c => new CompetitorDTO(c));
    this.uploads = uploads.map(u => new UploadDTO(u));
    this.insights = insights.map(i => new AiInsightDTO(i));
    this.activityLogs = logs.map(l => new ActivityLogDTO(l));
  }
}
