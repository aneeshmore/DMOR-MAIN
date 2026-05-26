import { and, eq, desc, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  masterProducts,
} from '../../db/schema/index.js';
import logger from '../../config/logger.js';

// Ensure tables exist at startup (idempotent)
let _tablesReady = false;

async function ensureTables() {
  if (_tablesReady) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.purchase_orders (
        purchase_order_id SERIAL PRIMARY KEY,
        po_number         VARCHAR(50) NOT NULL UNIQUE,
        supplier_id       INTEGER REFERENCES app.suppliers(supplier_id),
        order_date        DATE NOT NULL,
        expected_delivery_date DATE,
        status            VARCHAR(50) NOT NULL DEFAULT 'Pending',
        total_amount      NUMERIC(14,2) DEFAULT 0,
        delivery_terms    TEXT,
        notes             TEXT,
        delivery_address  TEXT,
        is_active         BOOLEAN DEFAULT TRUE,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE app.purchase_orders
      ADD COLUMN IF NOT EXISTS delivery_terms TEXT
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.purchase_order_items (
        item_id             SERIAL PRIMARY KEY,
        purchase_order_id   INTEGER NOT NULL REFERENCES app.purchase_orders(purchase_order_id),
        item_description    VARCHAR(500) NOT NULL,
        quantity            NUMERIC(14,4) NOT NULL,
        unit                VARCHAR(50),
        unit_price          NUMERIC(14,2) DEFAULT 0,
        total_price         NUMERIC(14,2) DEFAULT 0,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    _tablesReady = true;
    logger.info('Purchase order tables verified/created');
  } catch (err) {
    logger.warn('ensureTables warning (non-fatal):', err.message);
    _tablesReady = true;
  }
}

const quoteIdentifier = value => `"${String(value).replace(/"/g, '""')}"`;

export class PurchaseOrdersRepository {
  async getNextPoNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PO-${year}-${month}-`;

    const rows = await db
      .select({ poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(sql`${purchaseOrders.poNumber} LIKE ${prefix + '%'}`);

    let max = 0;
    for (const r of rows) {
      const parts = (r.poNumber || '').split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  async findAll({ limit = 50, offset = 0, status } = {}) {
    await ensureTables();

    let query = db
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        poNumber: purchaseOrders.poNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.supplierName,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        deliveryTerms: purchaseOrders.deliveryTerms,
        notes: purchaseOrders.notes,
        deliveryAddress: purchaseOrders.deliveryAddress,
        isActive: purchaseOrders.isActive,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId));

    const conditions = [eq(purchaseOrders.isActive, true)];
    if (status) conditions.push(eq(purchaseOrders.status, status));

    query = query.where(and(...conditions));

    return await query.orderBy(desc(purchaseOrders.createdAt)).limit(limit).offset(offset);
  }

  async findById(purchaseOrderId) {
    await ensureTables();
    const result = await db
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        poNumber: purchaseOrders.poNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.supplierName,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        deliveryTerms: purchaseOrders.deliveryTerms,
        notes: purchaseOrders.notes,
        deliveryAddress: purchaseOrders.deliveryAddress,
        isActive: purchaseOrders.isActive,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
      .where(
        and(eq(purchaseOrders.purchaseOrderId, purchaseOrderId), eq(purchaseOrders.isActive, true))
      )
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

  async countRowsByColumn(tableName, columnName, value) {
    const exists = await this.tableExists('app', tableName);
    if (!exists) return 0;

    const result = await db.execute(
      sql.raw(
        `SELECT COUNT(*)::int AS count FROM app.${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(columnName)} = ${Number(value)}`
      )
    );
    const rows = result.rows || result;
    return Number(rows[0]?.count || 0);
  }

  async countInwardPoItemsByPurchaseOrderId(purchaseOrderId) {
    const inwardItemsTableExists = await this.tableExists('app', 'inward_from_po_items');
    const poItemsTableExists = await this.tableExists('app', 'purchase_order_items');
    if (!inwardItemsTableExists || !poItemsTableExists) return 0;

    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM app.inward_from_po_items ipoi
      INNER JOIN app.purchase_order_items poi
        ON poi.item_id = ipoi.purchase_order_item_id
      WHERE poi.purchase_order_id = ${purchaseOrderId}
    `);
    const rows = result.rows || result;
    return Number(rows[0]?.count || 0);
  }

  async findPurchaseOrderDependencies(purchaseOrderId) {
    const dependencies = [];

    const inwardFromPoCount = await this.countRowsByColumn(
      'inward_from_po',
      'purchase_order_id',
      purchaseOrderId
    );
    if (inwardFromPoCount > 0) {
      dependencies.push({
        key: 'inwardFromPo',
        tableName: 'inward_from_po',
        label: 'Inward From Purchase Order',
        message: 'Purchase Order cannot be deleted because inward entries exist.',
        count: inwardFromPoCount,
      });
    }

    const inwardItemCount = await this.countInwardPoItemsByPurchaseOrderId(purchaseOrderId);
    if (inwardItemCount > 0 && inwardFromPoCount === 0) {
      dependencies.push({
        key: 'inwardFromPoItems',
        tableName: 'inward_from_po_items',
        label: 'Inward Logs',
        message: 'Purchase Order cannot be deleted because inward entries exist.',
        count: inwardItemCount,
      });
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
        AND ccu.table_name = 'purchase_orders'
        AND ccu.column_name = 'purchase_order_id'
    `);
    const fkRows = fkResult.rows || fkResult;
    const knownTables = new Set(['purchase_order_items', 'inward_from_po']);

    for (const row of fkRows) {
      if (row.table_schema !== 'app' || knownTables.has(row.table_name)) continue;

      const countResult = await db.execute(
        sql.raw(
          `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(row.table_schema)}.${quoteIdentifier(row.table_name)} WHERE ${quoteIdentifier(row.column_name)} = ${Number(purchaseOrderId)}`
        )
      );
      const rows = countResult.rows || countResult;
      const count = Number(rows[0]?.count || 0);

      if (count > 0) {
        dependencies.push({
          key: row.table_name,
          tableName: row.table_name,
          label: row.table_name,
          message: 'Purchase Order is already used in operational records.',
          count,
        });
      }
    }

    return dependencies;
  }

  async getItems(purchaseOrderId) {
    await ensureTables();
    const inwardItemsTableExists = await this.tableExists('app', 'inward_from_po_items');
    return await db
      .select({
        itemId: purchaseOrderItems.itemId,
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        itemDescription: purchaseOrderItems.itemDescription,
        quantity: purchaseOrderItems.quantity,
        unit: purchaseOrderItems.unit,
        unitPrice: purchaseOrderItems.unitPrice,
        totalPrice: purchaseOrderItems.totalPrice,
        createdAt: purchaseOrderItems.createdAt,
        updatedAt: purchaseOrderItems.updatedAt,
        gst: sql`(
          SELECT gst
          FROM app.master_products
          WHERE LOWER(master_product_name) = LOWER(${purchaseOrderItems.itemDescription})
          LIMIT 1
        )`,
        totalReceived: inwardItemsTableExists
          ? sql`(
              SELECT COALESCE(SUM(received_quantity), 0)
              FROM app.inward_from_po_items
              WHERE purchase_order_item_id = ${purchaseOrderItems.itemId}
            )`
          : sql`0`,
      })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async create(poData) {
    await ensureTables();
    const result = await db.insert(purchaseOrders).values(poData).returning();
    return result[0];
  }

  async createItem(itemData) {
    await ensureTables();
    const result = await db.insert(purchaseOrderItems).values(itemData).returning();
    return result[0];
  }

  async update(purchaseOrderId, updateData) {
    await ensureTables();
    const result = await db
      .update(purchaseOrders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .returning();
    return result[0];
  }

  async deleteItemsByPoId(purchaseOrderId) {
    await ensureTables();
    await db
      .delete(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async delete(purchaseOrderId) {
    await ensureTables();
    await db
      .update(purchaseOrders)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId));
  }
}
