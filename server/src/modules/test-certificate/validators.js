import { z } from 'zod';

const TestResultItemSchema = z.object({
  propertyName: z.string().min(1, 'Property name is required'),
  resultValue: z.string().min(1, 'Result value is required'),
  specification: z.string().optional().nullable().default(''),
  sortOrder: z.number().int().optional().default(0),
});

export const CreateTestCertificateSchema = z.object({
  batchId: z.number().int('Batch selection is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  productName: z.string().min(1, 'Product name is required'),
  colour: z.string().optional().nullable(),
  manufacturingDate: z
    .preprocess(val => {
      if (val === null || val === undefined || val === '') return undefined;
      return val;
    }, z.string().optional())
    .transform(v => (v ? new Date(v) : undefined)),
  testingDate: z
    .string()
    .min(1, 'Testing date is required')
    .transform(v => new Date(v)),
  remarks: z.string().optional().nullable().default(''),
  status: z.enum(['Draft', 'Approved']).optional().default('Draft'),
  results: z.array(TestResultItemSchema).min(1, 'At least one test result row is required'),
});

export const UpdateTestCertificateSchema = CreateTestCertificateSchema.partial().extend({
  id: z.number().int(),
});

export const validateCreateTestCertificate = (req, res, next) => {
  const result = CreateTestCertificateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }
  req.validatedBody = result.data;
  next();
};

export const validateUpdateTestCertificate = (req, res, next) => {
  const result = UpdateTestCertificateSchema.safeParse({
    ...req.body,
    id: parseInt(req.params.id, 10),
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }
  req.validatedBody = result.data;
  next();
};
