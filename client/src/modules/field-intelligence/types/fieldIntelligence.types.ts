export interface Competitor {
  id?: string;
  reportId?: string;
  competitorName: string;
  strengths?: string;
  weaknesses?: string;
  reasonUsingCompetitor?: string;
  reasonShiftToUs?: string;
}

export interface Followup {
  id?: string;
  reportId?: string;
  followupDate: string | Date;
  notes?: string;
  status: 'Open' | 'Pending' | 'Completed' | 'Missed' | 'Cancelled';
}

export interface Upload {
  id?: string;
  reportId?: string;
  fileType: string;
  fileName: string;
  filePath: string;
  mimeType?: string;
  fileSize?: number;
  uploadedBy?: number;
  createdAt?: string;
}

export interface AiInsight {
  id?: string;
  reportId?: string;
  insightType:
    | 'Strategic Opportunity'
    | 'Payment Risk'
    | 'High Potential Customer'
    | 'Competitor Weakness'
    | 'Urgent Followup';
  observation: string;
  reasoning?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActivityLog {
  id: string;
  reportId?: string;
  activityType:
    | 'Created'
    | 'Updated'
    | 'Deleted'
    | 'Status Changed'
    | 'Followup Added'
    | 'Followup Completed'
    | 'Upload Added'
    | 'Insight Generated';
  details?: Record<string, any>;
  createdBy: number;
  createdAt: string;
}

export interface FieldIntelligenceReport {
  id?: string;
  reportNumber?: string;
  visitDate: string | Date;
  timeIn?: string;
  timeOut?: string;
  visitDuration?: number;
  gpsLatitude?: string | number;
  gpsLongitude?: string | number;
  executiveId: number;
  executiveName?: string;
  branch?: string;
  region?: string;
  visitType: string;
  visitPurpose: string[];
  customerName: string;
  contactPerson?: string;
  designation?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  businessCategory?: string;
  monthlyConsumption?: number | string;
  currentSupplier?: string;
  paintRequirementTypes: string[];
  surfaceTypes: string[];
  applicationMethods: string[];
  requiredShade?: string;
  requiredFinish?: string;
  technicalChallenges: string[];
  currentSystemUsed?: string;
  monthlyConsumptionText?: string;
  currentPurchaseRate?: number | string;
  expectedRate?: number | string;
  creditDays?: number;
  outstandingAmount?: number | string;
  purchaseDecisionBy?: string;
  purchaseCycle?: string;
  potentialBusinessValue?: number | string;
  expectedMonthlyBusiness?: number | string;
  conversionProbability?: number;
  discussionNotes?: string;
  importantObservations?: string;
  customerMood?: string;
  hiddenOpportunity?: string;
  riskFactors?: string;
  immediateRequirement?: string;
  expectedOrderDate?: string | Date;
  expectedOrderQuantity?: number | string;
  trialApproved?: boolean;
  sampleGiven?: boolean;
  followupUrgencyScore?: number;
  dealerConfidence?: number;
  paymentReliability?: number;
  relationshipStrength?: number;
  technicalCapability?: number;
  longTermPotential?: number;
  executiveRecommendation?: string;
  status:
    | 'Draft'
    | 'Submitted'
    | 'Qualified'
    | 'Proposal Sent'
    | 'Trial Running'
    | 'Negotiation'
    | 'Won'
    | 'Lost'
    | 'Archived';
  companyId?: number;
  tenantId?: string;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;

  // Nested structures
  competitors?: Competitor[];
  followups?: Followup[];
  uploads?: Upload[];
  insights?: AiInsight[];
  activityLogs?: ActivityLog[];
}

export interface DashboardSummary {
  totalVisits: number;
  visitsPerDay: Record<string, number>;
  visitsPerExecutive: Record<string, number>;
  conversionRate: number;
  expectedRevenue: number;
  followupsDue: number;
  followupsMissed: number;
  highPotentialAccounts: number;
  competitorAnalysis: Record<string, number>;
  territoryPerformance: Record<string, { visits: number; revenue: number }>;
}
