export class FieldIntelligenceReportDTO {
  constructor(report) {
    const mapNA = val => {
      if (val === null || val === undefined) return 'N/A';
      const strVal = String(val).trim();
      return strVal === '' ? 'N/A' : val;
    };

    this.id = report.id;
    this.reportNumber = report.reportNumber;
    this.visitDate = report.visitDate;
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
    this.customerId = report.customerId || report.customer_id;
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
    this.paintRequirementTypes = report.paintRequirementTypes;
    this.surfaceTypes = report.surfaceTypes;
    this.applicationMethods = report.applicationMethods;
    this.requiredShade = mapNA(report.requiredShade);
    this.requiredFinish = mapNA(report.requiredFinish);
    this.technicalChallenges = report.technicalChallenges;
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
    this.discussionNotes = report.discussionNotes;
    this.importantObservations = mapNA(report.importantObservations);
    this.customerMood = mapNA(report.customerMood);
    this.hiddenOpportunity = mapNA(report.hiddenOpportunity);
    this.riskFactors = mapNA(report.riskFactors);
    this.immediateRequirement = mapNA(report.immediateRequirement);
    this.expectedOrderDate =
      report.expectedOrderDate !== null && report.expectedOrderDate !== undefined
        ? report.expectedOrderDate instanceof Date
          ? report.expectedOrderDate.toISOString()
          : report.expectedOrderDate
        : 'N/A';
    this.expectedOrderQuantity = mapNA(report.expectedOrderQuantity);
    this.trialApproved = report.trialApproved;
    this.sampleGiven = report.sampleGiven;
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
    this.createdAt = report.createdAt;
    this.updatedAt = report.updatedAt;

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
  constructor(followup) {
    const mapNA = val => {
      if (val === null || val === undefined) return 'N/A';
      const strVal = String(val).trim();
      return strVal === '' ? 'N/A' : val;
    };
    this.id = followup.id;
    this.reportId = followup.reportId;
    this.followupDate = followup.followupDate;
    this.notes = mapNA(followup.notes);
    this.actionType = mapNA(followup.actionType);
    this.followupMode = mapNA(followup.followupMode);
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
    const mapNA = val => {
      if (val === null || val === undefined) return 'N/A';
      const strVal = String(val).trim();
      return strVal === '' ? 'N/A' : val;
    };
    this.id = competitor.id;
    this.reportId = competitor.reportId;
    this.competitorName = competitor.competitorName;
    this.strengths = mapNA(competitor.strengths);
    this.weaknesses = mapNA(competitor.weaknesses);
    this.reasonUsingCompetitor = mapNA(competitor.reasonUsingCompetitor);
    this.reasonShiftToUs = mapNA(competitor.reasonShiftToUs);
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
