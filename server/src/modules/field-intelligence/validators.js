import { z } from 'zod';

const WorkflowStatusSchema = z.enum([
  'Draft',
  'Submitted',
  'Qualified',
  'Proposal Sent',
  'Trial Running',
  'Negotiation',
  'Won',
  'Lost',
  'Archived',
]);

const FollowupStatusSchema = z.enum(['Open', 'Pending', 'Completed', 'Missed', 'Cancelled']);

const optionalString = z.preprocess(val => {
  if (val === null || val === undefined || val === '') return undefined;
  return String(val);
}, z.string().optional());

const numericField = schema =>
  z.preprocess(val => {
    if (
      val === '' ||
      val === null ||
      val === undefined ||
      (typeof val === 'number' && Number.isNaN(val))
    ) {
      return undefined;
    }
    const parsed = Number(val);
    return Number.isNaN(parsed) ? undefined : parsed;
    // NOTE: inner schema must accept undefined — preprocess coerces junk ('N/A', '') to undefined,
    // and outer .optional() cannot catch it because the raw input was not undefined.
  }, schema.optional());

const optionalStringArray = z.preprocess(val => {
  if (!Array.isArray(val)) return [];
  return val.filter(item => typeof item === 'string');
}, z.array(z.string()).optional().default([]));

export const CreateReportSchema = z
  .object({
    visitDate: z
      .string()
      .optional()
      .transform(v => (v ? new Date(v) : undefined)),
    timeIn: optionalString,
    timeOut: optionalString,
    visitDuration: numericField(z.number().int()).optional(),
    gpsLatitude: optionalString,
    gpsLongitude: optionalString,
    executiveId: numericField(z.number().int()).optional(),
    executiveName: optionalString,
    branch: optionalString,
    region: optionalString,
    visitType: z.string().optional().default('New Visit'),
    visitPurpose: optionalStringArray,
    customerName: z.preprocess(
      val => {
        if (val === null || val === undefined) return '';
        return String(val).trim();
      },
      z.string().min(1, 'Customer name is required')
    ),
    customerId: numericField(z.number().int()).optional(),
    contactPerson: optionalString,
    designation: optionalString,
    mobile: optionalString,
    whatsapp: optionalString,
    email: z.preprocess(
      val => {
        if (val === null || val === undefined || val === '') return undefined;
        const str = String(val).trim();
        if (str.toUpperCase() === 'N/A') return 'N/A';
        return str;
      },
      z.union([z.string().email('Invalid email format'), z.literal('N/A')]).optional()
    ),
    gstNumber: optionalString,
    address: optionalString,
    city: optionalString,
    state: optionalString,
    pinCode: optionalString,
    businessCategory: optionalString,
    dynamicFields: z.record(z.any()).optional(),
    monthlyConsumption: numericField(z.number())
      .optional()
      .transform(v => (v !== undefined ? String(v) : undefined)),
    currentSupplier: optionalString,
    paintRequirementTypes: optionalStringArray,
    surfaceTypes: optionalStringArray,
    applicationMethods: optionalStringArray,
    requiredShade: optionalString,
    requiredFinish: optionalString,
    technicalChallenges: optionalStringArray,
    currentSystemUsed: optionalString,
    monthlyConsumptionText: optionalString,
    currentPurchaseRate: numericField(z.number())
      .optional()
      .transform(v => (v !== undefined ? String(v) : undefined)),
    expectedRate: numericField(z.number())
      .optional()
      .transform(v => (v !== undefined ? String(v) : undefined)),
    creditDays: numericField(z.number().int()).optional().default(0),
    outstandingAmount: numericField(z.number())
      .optional()
      .transform(v => (v !== undefined ? String(v) : undefined)),
    purchaseDecisionBy: optionalString,
    purchaseCycle: optionalString,
    potentialBusinessValue: numericField(z.number())
      .optional()
      .transform(v => (v !== undefined ? String(v) : undefined)),
    expectedMonthlyBusiness: numericField(z.number())
      .optional()
      .transform(v => (v !== undefined ? String(v) : undefined)),
    conversionProbability: numericField(z.number().int().min(0).max(100)).optional().default(0),
    discussionNotes: optionalString,
    importantObservations: optionalString,
    customerMood: optionalString,
    hiddenOpportunity: optionalString,
    riskFactors: optionalString,
    immediateRequirement: optionalString,
    expectedOrderDate: z
      .preprocess(val => {
        if (
          val === null ||
          val === undefined ||
          val === '' ||
          String(val).trim().toUpperCase() === 'N/A'
        )
          return undefined;
        return String(val);
      }, z.string().optional())
      .transform(v => (v ? new Date(v) : undefined)),
    expectedOrderQuantity: numericField(z.number())
      .optional()
      .transform(v => (v !== undefined ? String(v) : undefined)),
    trialApproved: z.boolean().optional().default(false),
    sampleGiven: z.boolean().optional().default(false),
    followupUrgencyScore: numericField(z.number().int().min(0).max(10)).optional().default(0),
    dealerConfidence: numericField(z.number().int().min(0).max(10)).optional().default(0),
    paymentReliability: numericField(z.number().int().min(0).max(10)).optional().default(0),
    relationshipStrength: numericField(z.number().int().min(0).max(10)).optional().default(0),
    technicalCapability: numericField(z.number().int().min(0).max(10)).optional().default(0),
    longTermPotential: numericField(z.number().int().min(0).max(10)).optional().default(0),
    executiveRecommendation: optionalString,
    status: WorkflowStatusSchema.optional().default('Draft'),

    // Nested arrays
    competitors: z
      .array(
        z.object({
          competitorName: z.preprocess(
            val => (val === null || val === undefined ? '' : String(val).trim()),
            z.string().min(1, 'Competitor name is required')
          ),
          strengths: optionalString,
          weaknesses: optionalString,
          reasonUsingCompetitor: optionalString,
          reasonShiftToUs: optionalString,
        })
      )
      .optional()
      .default([]),

    followups: z
      .array(
        z.object({
          followupDate: z.string().min(1, 'Followup date is required'),
          notes: optionalString,
          actionType: optionalString,
          followupMode: optionalString,
          status: FollowupStatusSchema.optional().default('Open'),
        })
      )
      .optional()
      .default([]),

    uploads: z
      .array(
        z.object({
          fileType: z.string(),
          fileName: z.string(),
          filePath: z.string(),
          mimeType: optionalString,
          fileSize: numericField(z.number().int()).optional(),
        })
      )
      .optional()
      .default([]),
  })
  .passthrough();

export const UpdateReportSchema = CreateReportSchema.partial().extend({
  id: z.string().uuid(),
});

export const validateCreateReport = (req, res, next) => {
  const result = CreateReportSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: result.error.errors.map(err => ({ field: err.path.join('.'), message: err.message })),
    });
  }
  req.validatedBody = result.data;
  next();
};

export const validateUpdateReport = (req, res, next) => {
  const result = UpdateReportSchema.safeParse({ ...req.body, id: req.params.id });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: result.error.errors.map(err => ({ field: err.path.join('.'), message: err.message })),
    });
  }
  req.validatedBody = result.data;
  next();
};
