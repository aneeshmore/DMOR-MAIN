import { CreateReportSchema } from './src/modules/field-intelligence/validators.js';

const result = CreateReportSchema.safeParse({ customerName: 'Test' });
if (!result.success) {
  console.log(
    'Errors:',
    result.error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
  );
} else {
  console.log('Success:', result.data);
}
