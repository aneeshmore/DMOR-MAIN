import { eq, desc, sql, and, getTableColumns, aliasedTable } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  products,
  stockLedger,
  units,
  masterProducts,
  masterProductFG,
  masterProductRM,
  masterProductPM,
} from '../../db/schema/index.js';

export class InventoryRepository {
  async findAllProducts(filters = {}) {
    // PM subtype joined on the product's own master (for HSN), distinct from the
    // packaging join below which is on products.packagingId (for capacity).
    const pmMain = aliasedTable(masterProductPM, 'pm_main');

    let query = db
      .select({
        ...getTableColumns(products),
        productType: masterProducts.productType,
        unitName: units.unitName,
        // FG Details for auto-add hardener feature
        subcategory: masterProductFG.subcategory,
        hardenerId: masterProductFG.hardenerId,
        // PM Capacity from packaging
        pmCapacity: masterProductPM.capacity,
        hsnCode: sql`COALESCE(${masterProductFG.hsnCode}, ${masterProductRM.hsnCode}, ${pmMain.hsnCode})`,
      })
      .from(products)
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .leftJoin(units, eq(masterProducts.defaultUnitId, units.unitId))
      .leftJoin(masterProductFG, eq(products.masterProductId, masterProductFG.masterProductId))
      .leftJoin(masterProductRM, eq(products.masterProductId, masterProductRM.masterProductId))
      .leftJoin(pmMain, eq(products.masterProductId, pmMain.masterProductId))
      .leftJoin(masterProductPM, eq(products.packagingId, masterProductPM.masterProductId));

    const whereConditions = [];

    if (filters.productType) {
      whereConditions.push(eq(masterProducts.productType, filters.productType));
    }

    if (filters.masterProductId) {
      whereConditions.push(eq(products.masterProductId, filters.masterProductId));
    }

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(products.isActive, filters.isActive));
    }

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    } else {
      query = query.where(eq(products.isActive, true)); // Default filter
    }

    return await query.orderBy(desc(products.createdAt));
  }

  async findProductById(productId) {
    const result = await db
      .select({
        ...getTableColumns(products),
        productType: masterProducts.productType,
        unitName: units.unitName,
      })
      .from(products)
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .leftJoin(units, eq(masterProducts.defaultUnitId, units.unitId))
      .where(eq(products.productId, productId))
      .limit(1);

    return result[0] || null;
  }

  async createProduct(productData) {
    const result = await db.insert(products).values(productData).returning();

    return result[0];
  }

  async updateProduct(productId, updateData) {
    const result = await db
      .update(products)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(products.productId, productId))
      .returning();

    return result[0];
  }

  async deleteProduct(productId) {
    await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.productId, productId));
  }

  async getStockLedger(productId, limit = 100) {
    return await db
      .select()
      .from(stockLedger)
      .where(eq(stockLedger.productId, productId))
      .orderBy(desc(stockLedger.createdAt))
      .limit(limit);
  }

  async getLowStockProducts() {
    // FG stock lives in app.products; RM/PM stock lives in master_product_rm/pm
    // with min_stock_level on app.master_products. UNION ALL keeps a uniform
    // column shape so ProductDTO maps every row identically.
    const result = await db.execute(sql`
      SELECT p.product_id,
             p.product_name,
             p.master_product_id,
             p.available_quantity,
             p.min_stock_level,
             'FG' AS product_type
      FROM app.products p
      WHERE p.is_active = true
        AND p.min_stock_level IS NOT NULL
        AND p.min_stock_level > 0
        AND p.available_quantity < p.min_stock_level
      UNION ALL
      SELECT mp.master_product_id AS product_id,
             mp.master_product_name AS product_name,
             mp.master_product_id AS master_product_id,
             COALESCE(rm.available_qty, 0) AS available_quantity,
             mp.min_stock_level,
             mp.product_type
      FROM app.master_products mp
      JOIN app.master_product_rm rm ON rm.master_product_id = mp.master_product_id
      WHERE mp.product_type = 'RM'
        AND mp.is_active = true
        AND mp.min_stock_level IS NOT NULL
        AND mp.min_stock_level > 0
        AND COALESCE(rm.available_qty, 0) < mp.min_stock_level
      UNION ALL
      SELECT mp.master_product_id AS product_id,
             mp.master_product_name AS product_name,
             mp.master_product_id AS master_product_id,
             COALESCE(pm.available_qty, 0) AS available_quantity,
             mp.min_stock_level,
             mp.product_type
      FROM app.master_products mp
      JOIN app.master_product_pm pm ON pm.master_product_id = mp.master_product_id
      WHERE mp.product_type = 'PM'
        AND mp.is_active = true
        AND mp.min_stock_level IS NOT NULL
        AND mp.min_stock_level > 0
        AND COALESCE(pm.available_qty, 0) < mp.min_stock_level
    `);
    return result.rows || result;
  }

  async updateStock(
    productId,
    quantity,
    { changeType, referenceTable, referenceId, notes, createdBy }
  ) {
    return await db.transaction(async tx => {
      // Update product available quantity
      const [product] = await tx
        .update(products)
        .set({
          availableQuantity: sql`${products.availableQuantity} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.productId, productId))
        .returning();

      if (!product) {
        throw new Error('Product not found');
      }

      // Create ledger entry
      const [ledger] = await tx
        .insert(stockLedger)
        .values({
          productId,
          changeType,
          changeQty: quantity,
          referenceTable,
          referenceId: referenceId ? BigInt(referenceId) : null,
          createdBy,
          notes,
          createdAt: new Date(),
        })
        .returning();

      return { product, ledger };
    });
  }
}
