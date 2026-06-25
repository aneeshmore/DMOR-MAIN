export class FieldIntelligenceReportDTO {
  constructor(report) {
    this.id = report.id;
    this.reportNumber = report.reportNumber;
    this.visitDate = report.visitDate;
    this.timeIn = report.timeIn;
    this.timeOut = report.timeOut;
    this.visitDuration = report.visitDuration;
    this.gpsLatitude = report.gpsLatitude;
    this.gpsLongitude = report.gpsLongitude;
    this.executiveId = report.executiveId;
    this.executiveName = report.executiveName;
    this.branch = report.branch;
    this.region = report.region;
    this.visitType = report.visitType;
    this.visitPurpose = report.visitPurpose;
    this.customerName = report.customerName;
    this.customerId = report.customerId || report.customer_id;
    this.contactPerson = report.contactPerson;
    this.designation = report.designation;
    this.mobile = report.mobile;
    this.whatsapp = report.whatsapp;
    this.email = report.email;
    this.gstNumber = report.gstNumber;
    this.address = report.address;
    this.city = report.city;
    this.state = report.state;
    this.pinCode = report.pinCode;
    this.businessCategory = report.businessCategory;
    this.monthlyConsumption = report.monthlyConsumption;
    this.currentSupplier = report.currentSupplier;
    this.paintRequirementTypes = report.paintRequirementTypes;
    this.surfaceTypes = report.surfaceTypes;
    this.applicationMethods = report.applicationMethods;
    this.requiredShade = report.requiredShade;
    this.requiredFinish = report.requiredFinish;
    this.technicalChallenges = report.technicalChallenges;
    this.currentSystemUsed = report.currentSystemUsed;
    this.monthlyConsumptionText = report.monthlyConsumptionText;
    this.currentPurchaseRate = report.currentPurchaseRate;
    this.expectedRate = report.expectedRate;
    this.creditDays = report.creditDays;
    this.outstandingAmount = report.outstandingAmount;
    this.purchaseDecisionBy = report.purchaseDecisionBy;
    this.purchaseCycle = report.purchaseCycle;
    this.potentialBusinessValue = report.potentialBusinessValue;
    this.expectedMonthlyBusiness = report.expectedMonthlyBusiness;
    this.conversionProbability = report.conversionProbability;
    this.discussionNotes = report.discussionNotes;
    this.importantObservations = report.importantObservations;
    this.customerMood = report.customerMood;
    this.hiddenOpportunity = report.hiddenOpportunity;
    this.riskFactors = report.riskFactors;
    this.immediateRequirement = report.immediateRequirement;
    this.expectedOrderDate = report.expectedOrderDate;
    this.expectedOrderQuantity = report.expectedOrderQuantity;
    this.trialApproved = report.trialApproved;
    this.sampleGiven = report.sampleGiven;
    this.followupUrgencyScore = report.followupUrgencyScore;
    this.dealerConfidence = report.dealerConfidence;
    this.paymentReliability = report.paymentReliability;
    this.relationshipStrength = report.relationshipStrength;
    this.technicalCapability = report.technicalCapability;
    this.longTermPotential = report.longTermPotential;
    this.executiveRecommendation = report.executiveRecommendation;
    this.status = report.status;
    this.companyId = report.companyId;
    this.tenantId = report.tenantId;
    this.createdBy = report.createdBy;
    this.createdAt = report.createdAt;
    this.updatedAt = report.updatedAt;
  }
}

export class FollowupDTO {
  constructor(followup) {
    this.id = followup.id;
    this.reportId = followup.reportId;
    this.followupDate = followup.followupDate;
    this.notes = followup.notes;
    this.status = followup.status;
    this.companyId = followup.companyId;
    this.tenantId = followup.tenantId;
    this.createdBy = followup.createdBy;
    this.createdAt = followup.createdAt;
    this.updatedAt = followup.updatedAt;
  }
}

export class CompetitorDTO {
  constructor(competitor) {
    this.id = competitor.id;
    this.reportId = competitor.reportId;
    this.competitorName = competitor.competitorName;
    this.strengths = competitor.strengths;
    this.weaknesses = competitor.weaknesses;
    this.reasonUsingCompetitor = competitor.reasonUsingCompetitor;
    this.reasonShiftToUs = competitor.reasonShiftToUs;
    this.companyId = competitor.companyId;
    this.tenantId = competitor.tenantId;
    this.createdBy = competitor.createdBy;
    this.createdAt = competitor.createdAt;
    this.updatedAt = competitor.updatedAt;
  }
}

export class UploadDTO {
  constructor(upload) {
    this.id = upload.id;
    this.reportId = upload.reportId;
    this.fileType = upload.fileType;
    this.fileName = upload.fileName;
    this.filePath = upload.filePath;
    this.mimeType = upload.mimeType;
    this.fileSize = upload.fileSize;
    this.uploadedBy = upload.uploadedBy;
    this.companyId = upload.companyId;
    this.tenantId = upload.tenantId;
    this.createdBy = upload.createdBy;
    this.createdAt = upload.createdAt;
    this.updatedAt = upload.updatedAt;
  }
}

export class ActivityLogDTO {
  constructor(log) {
    this.id = log.id;
    this.reportId = log.reportId;
    this.activityType = log.activityType;
    this.details = log.details;
    this.companyId = log.companyId;
    this.tenantId = log.tenantId;
    this.createdBy = log.createdBy;
    this.createdAt = log.createdAt;
    this.updatedAt = log.updatedAt;
  }
}

export class AiInsightDTO {
  constructor(insight) {
    this.id = insight.id;
    this.reportId = insight.reportId;
    this.insightType = insight.insightType;
    this.observation = insight.observation;
    this.reasoning = insight.reasoning;
    this.severity = insight.severity;
    this.companyId = insight.companyId;
    this.tenantId = insight.tenantId;
    this.createdBy = insight.createdBy;
    this.createdAt = insight.createdAt;
    this.updatedAt = insight.updatedAt;
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
