import { eq, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { suppliers } from '../../db/schema/index.js';
import logger from '../../config/logger.js';

// Run once: add new columns to suppliers table if they don't already exist.
// Idempotent — ADD COLUMN IF NOT EXISTS is a no-op when the column is present.
let _columnsReady = false;

async function ensureSupplierColumns() {
  if (_columnsReady) return;
  try {
    await db.execute(sql`
      ALTER TABLE app.suppliers
        ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
        ADD COLUMN IF NOT EXISTS mobile_no       VARCHAR(20),
        ADD COLUMN IF NOT EXISTS mobile_no2      VARCHAR(20),
        ADD COLUMN IF NOT EXISTS address         TEXT,
        ADD COLUMN IF NOT EXISTS pincode         VARCHAR(10),
        ADD COLUMN IF NOT EXISTS state           VARCHAR(100),
        ADD COLUMN IF NOT EXISTS gst_no          VARCHAR(20),
        ADD COLUMN IF NOT EXISTS credit_days     INTEGER
    `);
    _columnsReady = true;
    logger.info('Suppliers columns verified/added successfully');
  } catch (err) {
    logger.warn('ensureSupplierColumns warning (non-fatal):', err.message);
    // Do not block queries — if columns truly exist Drizzle will proceed fine.
    _columnsReady = true;
  }
}

export class SuppliersRepository {
  async findAll(filters = {}) {
    await ensureSupplierColumns();
    let query = db.select().from(suppliers);

    if (filters.isActive !== undefined) {
      query = query.where(eq(suppliers.isActive, filters.isActive));
    }

    return await query.orderBy(suppliers.supplierName);
  }

  async findById(supplierId) {
    await ensureSupplierColumns();
    const result = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.supplierId, supplierId))
      .limit(1);

    return result[0] || null;
  }

  async findByName(supplierName) {
    await ensureSupplierColumns();
    const result = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.supplierName, supplierName))
      .limit(1);

    return result[0] || null;
  }

  async create(supplierData) {
    await ensureSupplierColumns();
    const result = await db.insert(suppliers).values(supplierData).returning();
    return result[0];
  }

  async update(supplierId, updateData) {
    await ensureSupplierColumns();
    const result = await db
      .update(suppliers)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(suppliers.supplierId, supplierId))
      .returning();

    return result[0];
  }

  async delete(supplierId) {
    await ensureSupplierColumns();
    const result = await db
      .update(suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(suppliers.supplierId, supplierId))
      .returning();

    return result[0];
  }
}
