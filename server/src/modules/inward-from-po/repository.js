import { eq, desc, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { suppliers } from '../../db/schema/index.js';
import { purchaseOrders, purchaseOrderItems } from '../../db/schema/index.js';
import logger from '../../config/logger.js';

// Idempotent table creation guard
let _tablesReady = false;

async function ensureTables() {
  if (_tablesReady) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.inward_from_po (
        inward_po_id    SERIAL PRIMARY KEY,
        purchase_order_id INTEGER NOT NULL REFERENCES app.purchase_orders(purchase_order_id),
        supplier_id     INTEGER REFERENCES app.suppliers(supplier_id),
        bill_no         VARCHAR(50),
        inward_date     DATE NOT NULL DEFAULT CURRENT_DATE,
        notes           TEXT,
        total_cost      NUMERIC(14,2) DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.inward_from_po_items (
        item_id                SERIAL PRIMARY KEY,
        inward_po_id           INTEGER NOT NULL REFERENCES app.inward_from_po(inward_po_id),
        purchase_order_item_id INTEGER REFERENCES app.purchase_order_items(item_id),
        master_product_id      INTEGER REFERENCES app.master_products(master_product_id),
        product_id             INTEGER REFERENCES app.products(product_id),
        unit_id                INTEGER REFERENCES app.units(unit_id),
        item_description       VARCHAR(500) NOT NULL,
        received_quantity      NUMERIC(14,4) NOT NULL,
        unit                   VARCHAR(50),
        unit_price             NUMERIC(14,2) DEFAULT 0,
        total_cost             NUMERIC(14,2) DEFAULT 0,
        created_at             TIMESTAMPTZ DEFAULT NOW(),
        updated_at             TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    _tablesReady = true;
    logger.info('inward_from_po tables verified/created');
  } catch (err) {
    logger.warn('ensureTables (inward-from-po) warning (non-fatal):', err.message);
    _tablesReady = true;
  }
}

export class InwardFromPoRepository {
  async findAll({ limit = 50, offset = 0 } = {}) {
    await ensureTables();
    const rows = await db.execute(sql`
      SELECT
        ifp.inward_po_id,
        ifp.purchase_order_id,
        po.po_number,
        ifp.supplier_id,
        s.supplier_name,
        ifp.bill_no,
        ifp.inward_date,
        ifp.notes,
        ifp.total_cost,
        ifp.created_at,
        ifp.updated_at
      FROM app.inward_from_po ifp
      LEFT JOIN app.purchase_orders po ON po.purchase_order_id = ifp.purchase_order_id
      LEFT JOIN app.suppliers s ON s.supplier_id = ifp.supplier_id
      ORDER BY ifp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.rows || rows;
  }

  async findById(inwardPoId) {
    await ensureTables();
    const rows = await db.execute(sql`
      SELECT
        ifp.inward_po_id,
        ifp.purchase_order_id,
        po.po_number,
        ifp.supplier_id,
        s.supplier_name,
        ifp.bill_no,
        ifp.inward_date,
        ifp.notes,
        ifp.total_cost,
        ifp.created_at,
        ifp.updated_at
      FROM app.inward_from_po ifp
      LEFT JOIN app.purchase_orders po ON po.purchase_order_id = ifp.purchase_order_id
      LEFT JOIN app.suppliers s ON s.supplier_id = ifp.supplier_id
      WHERE ifp.inward_po_id = ${inwardPoId}
      LIMIT 1
    `);
    const data = rows.rows || rows;
    return data[0] || null;
  }

  async findItemsByInwardPoId(inwardPoId) {
    await ensureTables();
    const rows = await db.execute(sql`
      SELECT
        item_id,
        inward_po_id,
        purchase_order_item_id,
        master_product_id,
        product_id,
        unit_id,
        item_description,
        received_quantity,
        unit,
        unit_price,
        total_cost,
        created_at,
        updated_at
      FROM app.inward_from_po_items
      WHERE inward_po_id = ${inwardPoId}
      ORDER BY item_id
    `);
    return rows.rows || rows;
  }

  async create(headerData) {
    await ensureTables();
    const rows = await db.execute(sql`
      INSERT INTO app.inward_from_po
        (purchase_order_id, supplier_id, bill_no, inward_date, notes, total_cost)
      VALUES (
        ${headerData.purchaseOrderId},
        ${headerData.supplierId || null},
        ${headerData.billNo || null},
        ${headerData.inwardDate || new Date().toISOString().slice(0, 10)},
        ${headerData.notes || null},
        ${headerData.totalCost || 0}
      )
      RETURNING *
    `);
    const data = rows.rows || rows;
    return data[0];
  }

  async createItem(itemData) {
    await ensureTables();
    const rows = await db.execute(sql`
      INSERT INTO app.inward_from_po_items
        (inward_po_id, purchase_order_item_id, master_product_id, product_id, unit_id, item_description, received_quantity, unit, unit_price, total_cost)
      VALUES (
        ${itemData.inwardPoId},
        ${itemData.purchaseOrderItemId || null},
        ${itemData.masterProductId || null},
        ${itemData.productId || null},
        ${itemData.unitId || null},
        ${itemData.itemDescription},
        ${itemData.receivedQuantity},
        ${itemData.unit || null},
        ${itemData.unitPrice || 0},
        ${itemData.totalCost || 0}
      )
      RETURNING *
    `);
    const data = rows.rows || rows;
    return data[0];
  }

  async update(inwardPoId, updateData) {
    await ensureTables();
    const sets = [];
    if (updateData.billNo !== undefined) sets.push(sql`bill_no = ${updateData.billNo}`);
    if (updateData.inwardDate !== undefined) sets.push(sql`inward_date = ${updateData.inwardDate}`);
    if (updateData.notes !== undefined) sets.push(sql`notes = ${updateData.notes}`);
    if (updateData.totalCost !== undefined) sets.push(sql`total_cost = ${updateData.totalCost}`);
    sets.push(sql`updated_at = NOW()`);

    const setClause = sql.join(sets, sql`, `);
    const rows = await db.execute(
      sql`UPDATE app.inward_from_po SET ${setClause} WHERE inward_po_id = ${inwardPoId} RETURNING *`
    );
    const data = rows.rows || rows;
    return data[0];
  }

  async deleteItemsByInwardPoId(inwardPoId) {
    await ensureTables();
    await db.execute(sql`DELETE FROM app.inward_from_po_items WHERE inward_po_id = ${inwardPoId}`);
  }

  async delete(inwardPoId) {
    await ensureTables();
    await db.execute(sql`DELETE FROM app.inward_from_po_items WHERE inward_po_id = ${inwardPoId}`);
    await db.execute(sql`DELETE FROM app.inward_from_po WHERE inward_po_id = ${inwardPoId}`);
  }
}
