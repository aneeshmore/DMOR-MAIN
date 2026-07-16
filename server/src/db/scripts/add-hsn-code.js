/**
 * Adds the hsn_code column to the master product subtype tables.
 *
 * Idempotent: uses ADD COLUMN IF NOT EXISTS, safe to run multiple times.
 * Existing rows keep hsn_code = NULL (backward compatible).
 *
 * Run: node src/db/scripts/add-hsn-code.js
 */

import { sql } from 'drizzle-orm';
import { db } from '../index.js';

async function addHsnCode() {
  console.log('🔄 Adding hsn_code column to master product subtype tables...');

  try {
    console.log('➕ app.master_product_fg.hsn_code');
    await db.execute(
      sql`ALTER TABLE app.master_product_fg ADD COLUMN IF NOT EXISTS hsn_code varchar(50)`
    );

    console.log('➕ app.master_product_rm.hsn_code');
    await db.execute(
      sql`ALTER TABLE app.master_product_rm ADD COLUMN IF NOT EXISTS hsn_code varchar(50)`
    );

    console.log('➕ app.master_product_pm.hsn_code');
    await db.execute(
      sql`ALTER TABLE app.master_product_pm ADD COLUMN IF NOT EXISTS hsn_code varchar(50)`
    );

    console.log('✅ hsn_code columns added successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding hsn_code columns:', err);
    process.exit(1);
  }
}

addHsnCode();
