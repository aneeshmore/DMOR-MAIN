import { eq, and, aliasedTable, ne, sql, or } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  products,
  masterProducts,
  masterProductFG,
  masterProductRM,
  masterProductPM,
  units,
} from '../../db/schema/index.js';

let _columnsReady = false;

async function ensureProductColumns() {
  if (_columnsReady) return;
  try {
    await db.execute(sql`
      ALTER TABLE app.master_products
        ADD COLUMN IF NOT EXISTS gst VARCHAR(50);
      ALTER TABLE app.master_product_fg ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(255);
      ALTER TABLE app.master_product_rm ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(255);
      ALTER TABLE app.master_product_pm ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(255);
    `);
    _columnsReady = true;
  } catch (err) {
    console.error('Error ensuring product columns:', err);
    _columnsReady = true;
  }
}

export class MasterProductsRepository {
  // Master Products methods
  async findAllMasterProducts(filters = {}) {
    await ensureProductColumns();
    // Build conditions array
    const conditions = [eq(masterProducts.isActive, true)];

    if (filters.productType) {
      conditions.push(eq(masterProducts.productType, filters.productType));
    }

    // Use and() for multiple conditions, or single condition directly
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const query = db
      .select({
        masterProduct: masterProducts,
        fgDetails: masterProductFG,
        rmDetails: masterProductRM,
        pmDetails: masterProductPM,
      })
      .from(masterProducts)
      .leftJoin(
        masterProductFG,
        eq(masterProducts.masterProductId, masterProductFG.masterProductId)
      )
      .leftJoin(
        masterProductRM,
        eq(masterProducts.masterProductId, masterProductRM.masterProductId)
      )
      .leftJoin(
        masterProductPM,
        eq(masterProducts.masterProductId, masterProductPM.masterProductId)
      )
      .where(whereClause);

    return await query.orderBy(masterProducts.masterProductName);
  }

  async findMasterProductById(masterProductId) {
    await ensureProductColumns();
    const result = await db
      .select({
        masterProduct: masterProducts,
        fgDetails: masterProductFG,
        rmDetails: masterProductRM,
        pmDetails: masterProductPM,
      })
      .from(masterProducts)
      .leftJoin(
        masterProductFG,
        eq(masterProducts.masterProductId, masterProductFG.masterProductId)
      )
      .leftJoin(
        masterProductRM,
        eq(masterProducts.masterProductId, masterProductRM.masterProductId)
      )
      .leftJoin(
        masterProductPM,
        eq(masterProducts.masterProductId, masterProductPM.masterProductId)
      )
      .where(eq(masterProducts.masterProductId, masterProductId))
      .limit(1);

    return result[0] || null;
  }

  async createMasterProduct(masterProductData) {
    await ensureProductColumns();
    const result = await db.insert(masterProducts).values(masterProductData).returning();

    return result[0];
  }

  async updateMasterProduct(masterProductId, updateData) {
    await ensureProductColumns();
    const result = await db
      .update(masterProducts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(masterProducts.masterProductId, masterProductId))
      .returning();

    return result[0];
  }

  async deleteMasterProduct(masterProductId) {
    const result = await db
      .update(masterProducts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(masterProducts.masterProductId, masterProductId))
      .returning();

    return result[0];
  }

  // Subtype methods for FG, RM, PM
  async createMasterProductFG(masterProductId, fgData) {
    const result = await db
      .insert(masterProductFG)
      .values({ masterProductId, ...fgData })
      .returning();
    return result[0];
  }

  async createMasterProductRM(masterProductId, rmData) {
    const result = await db
      .insert(masterProductRM)
      .values({ masterProductId, ...rmData })
      .returning();
    return result[0];
  }

  async createMasterProductPM(masterProductId, pmData) {
    const result = await db
      .insert(masterProductPM)
      .values({ masterProductId, ...pmData })
      .returning();
    return result[0];
  }

  async updateMasterProductFG(masterProductId, fgData) {
    const result = await db
      .update(masterProductFG)
      .set(fgData)
      .where(eq(masterProductFG.masterProductId, masterProductId))
      .returning();
    return result[0];
  }

  async updateMasterProductRM(masterProductId, rmData) {
    const result = await db
      .update(masterProductRM)
      .set(rmData)
      .where(eq(masterProductRM.masterProductId, masterProductId))
      .returning();
    return result[0];
  }

  async updateMasterProductPM(masterProductId, pmData) {
    const result = await db
      .update(masterProductPM)
      .set(pmData)
      .where(eq(masterProductPM.masterProductId, masterProductId))
      .returning();
    return result[0];
  }

  async deleteMasterProductFG(masterProductId) {
    await db.delete(masterProductFG).where(eq(masterProductFG.masterProductId, masterProductId));
  }

  async deleteMasterProductRM(masterProductId) {
    await db.delete(masterProductRM).where(eq(masterProductRM.masterProductId, masterProductId));
  }

  async deleteMasterProductPM(masterProductId) {
    await db.delete(masterProductPM).where(eq(masterProductPM.masterProductId, masterProductId));
  }

  // Products methods
  async findAllProducts(filters = {}) {
    await ensureProductColumns();
    // Build conditions array - all conditions must be in a single .where() call
    const conditions = [eq(products.isActive, true)];

    if (filters.productType) {
      conditions.push(eq(masterProducts.productType, filters.productType));
    } else {
      // Default: Exclude 'RM' from products list (as they shouldn't have SKUs)
      // or strictly 'FG' if that's the rule. User said "rm should only reflect in master_products".
      // We will exclude RM to be safe.
      conditions.push(ne(masterProducts.productType, 'RM'));
    }

    if (filters.masterProductId) {
      conditions.push(eq(products.masterProductId, filters.masterProductId));
    }

    // Use and() for multiple conditions, or single condition directly
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const packagingPmDetails = aliasedTable(masterProductPM, 'packaging_pm_details');

    return await db
      .select({
        product: products,
        masterProduct: masterProducts,
        unit: units,
        fgDetails: masterProductFG,
        rmDetails: masterProductRM,
        pmDetails: masterProductPM,
        packagingDetails: packagingPmDetails,
      })
      .from(products)
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .leftJoin(units, eq(masterProducts.defaultUnitId, units.unitId))
      .leftJoin(
        masterProductFG,
        eq(masterProducts.masterProductId, masterProductFG.masterProductId)
      )
      .leftJoin(
        masterProductRM,
        eq(masterProducts.masterProductId, masterProductRM.masterProductId)
      )
      .leftJoin(
        masterProductPM,
        eq(masterProducts.masterProductId, masterProductPM.masterProductId)
      )
      .leftJoin(packagingPmDetails, eq(products.packagingId, packagingPmDetails.masterProductId))
      .where(whereClause)
      .orderBy(products.productName);
  }

  async findProductById(productId) {
    const result = await db
      .select({
        product: products,
        masterProduct: masterProducts,
        unit: units,
      })
      .from(products)
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .leftJoin(units, eq(masterProducts.defaultUnitId, units.unitId))
      .where(eq(products.productId, productId))
      .limit(1);

    return result[0] || null;
  }

  async findLowStockProducts() {
    return await db
      .select({
        product: products,
        masterProduct: masterProducts,
        unit: units,
      })
      .from(products)
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .leftJoin(units, eq(masterProducts.defaultUnitId, units.unitId))
      .where(eq(products.isActive, true))
      .orderBy(products.productName);
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
    const result = await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.productId, productId))
      .returning();

    return result[0];
  }

  async countLinkedProducts(masterProductId) {
    // Check if this master product is used as a parent for any active SKUs
    // OR if it is used as packaging for any active SKUs
    const result = await db
      .select({ count: sql`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          or(
            eq(products.masterProductId, masterProductId),
            eq(products.packagingId, masterProductId)
          )
        )
      );

    return parseInt(result[0].count);
  }
}
