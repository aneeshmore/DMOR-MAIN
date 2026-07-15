import { eq } from 'drizzle-orm';
import db from './db/index.js';
import { productionBatch, batchProducts } from './src/db/schema/index.js';

async function verifyBatch() {
  const batchNo = '0015-12-2025';

  console.log(`Checking batch ${batchNo}...`);

  const [batch] = await db
    .select()
    .from(productionBatch)
    .where(eq(productionBatch.batchNo, batchNo));

  if (!batch) {
    console.log('Batch not found');
    return;
  }

  console.log('Batch found:', batch.batchId, 'Status:', batch.status);

  const products = await db
    .select()
    .from(batchProducts)
    .where(eq(batchProducts.batchId, batch.batchId));

  console.log('Batch Products:');
  products.forEach(p => {
    console.log(
      `- ProductID: ${p.productId}, Planned: ${p.plannedUnits}, Produced: ${p.producedUnits}, Weight: ${p.producedWeightKg}`
    );
  });

  process.exit(0);
}

verifyBatch();
