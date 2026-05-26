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

const quoteIdentifier = value => `"${String(value).replace(/"/g, '""')}"`;

export class SuppliersRepository {
  async findAll(filters = {}) {
    await ensureSupplierColumns();
    let query = db.select().from(suppliers);

    const isActive = filters.isActive !== undefined ? filters.isActive : true;
    query = query.where(eq(suppliers.isActive, isActive));

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

  async tableExists(schemaName, tableName) {
    const result = await db.execute(sql`
      SELECT to_regclass(${`${schemaName}.${tableName}`}) AS table_name
    `);
    const rows = result.rows || result;
    return Boolean(rows[0]?.table_name);
  }

  async countRowsBySupplierId(tableName, supplierId) {
    const exists = await this.tableExists('app', tableName);
    if (!exists) return 0;

    const isActiveClause = tableName === 'purchase_orders' ? ' AND is_active = true' : '';

    const result = await db.execute(
      sql.raw(
        `SELECT COUNT(*)::int AS count FROM app.${quoteIdentifier(tableName)} WHERE supplier_id = ${Number(supplierId)}${isActiveClause}`
      )
    );
    const rows = result.rows || result;
    return Number(rows[0]?.count || 0);
  }

  async findSupplierDependencies(supplierId) {
    const dependencies = [];

    const knownReferences = [
      {
        key: 'purchaseOrders',
        tableName: 'purchase_orders',
        label: 'Purchase Orders',
        message: 'Vendor cannot be deleted because Purchase Orders exist.',
      },
      {
        key: 'inwardFromPo',
        tableName: 'inward_from_po',
        label: 'Inward From Purchase Order',
        message: 'Vendor cannot be deleted because Inward From Purchase Order records exist.',
      },
      {
        key: 'materialInward',
        tableName: 'material_inward',
        label: 'Inward Logs',
        message: 'Vendor cannot be deleted because Inward Logs exist.',
      },
    ];

    for (const reference of knownReferences) {
      const count = await this.countRowsBySupplierId(reference.tableName, supplierId);
      if (count > 0) {
        dependencies.push({ ...reference, count });
      }
    }

    const fkResult = await db.execute(sql`
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = 'app'
        AND ccu.table_name = 'suppliers'
        AND ccu.column_name = 'supplier_id'
    `);
    const fkRows = fkResult.rows || fkResult;
    const knownTables = new Set(knownReferences.map(reference => reference.tableName));

    for (const row of fkRows) {
      if (row.table_schema !== 'app' || knownTables.has(row.table_name)) continue;

      const countResult = await db.execute(
        sql.raw(
          `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(row.table_schema)}.${quoteIdentifier(row.table_name)} WHERE ${quoteIdentifier(row.column_name)} = ${Number(supplierId)}`
        )
      );
      const rows = countResult.rows || countResult;
      const count = Number(rows[0]?.count || 0);

      if (count > 0) {
        dependencies.push({
          key: row.table_name,
          tableName: row.table_name,
          label: row.table_name,
          message: 'Vendor is linked with operational records and cannot be deleted.',
          count,
        });
      }
    }

    return dependencies;
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
