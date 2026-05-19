import { eq, desc, sql } from 'drizzle-orm';
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
        notes             TEXT,
        delivery_address  TEXT,
        is_active         BOOLEAN DEFAULT TRUE,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
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
        notes: purchaseOrders.notes,
        deliveryAddress: purchaseOrders.deliveryAddress,
        isActive: purchaseOrders.isActive,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId));

    if (status) {
      query = query.where(eq(purchaseOrders.status, status));
    }

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
        notes: purchaseOrders.notes,
        deliveryAddress: purchaseOrders.deliveryAddress,
        isActive: purchaseOrders.isActive,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .limit(1);

    return result[0] || null;
  }

  async getItems(purchaseOrderId) {
    await ensureTables();
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
