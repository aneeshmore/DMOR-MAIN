import { db } from '../../db/index.js';
import { masterProducts } from '../../db/schema/products/master-products.js';
import { products } from '../../db/schema/products/products.js';
import { masterProductRM } from '../../db/schema/products/master-product-rm.js';
import { masterProductPM } from '../../db/schema/products/master-product-pm.js';
import { eq } from 'drizzle-orm';

export class UpdateProductRepository {
  // Final Goods (Process Products table)
  async getFinalGoods() {
    return await db
      .select({
        productId: products.productId,
        masterProductId: products.masterProductId,
        masterProductName: masterProducts.masterProductName,
        gst: masterProducts.gst,
        productName: products.productName, // The specific SKU
        sellingPrice: products.sellingPrice,
        minStockLevel: products.minStockLevel, // <--- From products (SKU level)
        incentiveAmount: products.incentiveAmount,
        fillingDensity: products.fillingDensity,
      })
      .from(products)
      .innerJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .where(eq(masterProducts.productType, 'FG'));
  }

  async updateFinalGood(id, data) {
    const updateData = {};
    if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice;
    if (data.incentiveAmount !== undefined) updateData.incentiveAmount = data.incentiveAmount;
    if (data.fillingDensity !== undefined) updateData.fillingDensity = data.fillingDensity;
    if (data.minStockLevel !== undefined) updateData.minStockLevel = data.minStockLevel;
    if (data.productName !== undefined) updateData.productName = data.productName;

    let productUpdate = [];

    if (data.gst !== undefined) {
      const product = await db
        .select({ masterProductId: products.masterProductId })
        .from(products)
        .where(eq(products.productId, id))
        .limit(1);

      if (product[0]?.masterProductId) {
        await db
          .update(masterProducts)
          .set({ gst: data.gst !== null && data.gst !== '' ? data.gst.toString() : null })
          .where(eq(masterProducts.masterProductId, product[0].masterProductId));
      }
    }

    // Update product specific fields only if there are changes
    if (Object.keys(updateData).length > 0) {
      productUpdate = await db
        .update(products)
        .set(updateData)
        .where(eq(products.productId, id))
        .returning();
    }

    return productUpdate;
  }

  // Raw Materials
  async getRawMaterials() {
    return await db
      .select({
        masterProductId: masterProducts.masterProductId,
        masterProductName: masterProducts.masterProductName,
        gst: masterProducts.gst,
        purchaseCost: masterProductRM.purchaseCost,
        density: masterProductRM.rmDensity,
        solids: masterProductRM.rmSolids,
        minStockLevel: masterProducts.minStockLevel,
        subcategory: masterProductRM.subcategory,
      })
      .from(masterProducts)
      .leftJoin(
        masterProductRM,
        eq(masterProducts.masterProductId, masterProductRM.masterProductId)
      )
      .where(eq(masterProducts.productType, 'RM'));
  }

  async updateRawMaterial(id, data) {
    const updateData = {};
    if (data.purchaseCost !== undefined) updateData.purchaseCost = data.purchaseCost;
    if (data.density !== undefined) updateData.rmDensity = data.density;
    if (data.solids !== undefined) updateData.rmSolids = data.solids;

    // For upsert, we need the PK
    updateData.masterProductId = id;

    // Update master product fields (name and min stock)
    const masterUpdateData = {};
    if (data.minStockLevel !== undefined) masterUpdateData.minStockLevel = data.minStockLevel;
    if (data.masterProductName !== undefined)
      masterUpdateData.masterProductName = data.masterProductName;
    if (data.gst !== undefined)
      masterUpdateData.gst = data.gst !== null && data.gst !== '' ? data.gst.toString() : null;

    if (Object.keys(masterUpdateData).length > 0) {
      await db
        .update(masterProducts)
        .set(masterUpdateData)
        .where(eq(masterProducts.masterProductId, id));
    }

    // Only perform upsert if we have fields to update other than ID, OR if we want to ensure existence
    // Since we're allowing partial updates, and it's a child table, we should ensure it exists.
    // However, onConflictDoUpdate with ONLY PK usually works as a "touch" or no-op update.
    return await db
      .insert(masterProductRM)
      .values(updateData)
      .onConflictDoUpdate({
        target: masterProductRM.masterProductId,
        set: updateData,
      })
      .returning();
  }

  // Packaging Materials
  async getPackagingMaterials() {
    return await db
      .select({
        masterProductId: masterProducts.masterProductId,
        masterProductName: masterProducts.masterProductName,
        gst: masterProducts.gst,
        purchaseCost: masterProductPM.purchaseCost,
        minStockLevel: masterProducts.minStockLevel,
      })
      .from(masterProducts)
      .leftJoin(
        masterProductPM,
        eq(masterProducts.masterProductId, masterProductPM.masterProductId)
      )
      .where(eq(masterProducts.productType, 'PM'));
  }

  async updatePackagingMaterial(id, data) {
    const updateData = {};
    if (data.purchaseCost !== undefined) updateData.purchaseCost = data.purchaseCost;

    // For upsert, we need the PK
    updateData.masterProductId = id;

    // Update master product fields (name and min stock)
    const masterUpdateData = {};
    if (data.minStockLevel !== undefined) masterUpdateData.minStockLevel = data.minStockLevel;
    if (data.masterProductName !== undefined)
      masterUpdateData.masterProductName = data.masterProductName;
    if (data.gst !== undefined)
      masterUpdateData.gst = data.gst !== null && data.gst !== '' ? data.gst.toString() : null;

    if (Object.keys(masterUpdateData).length > 0) {
      await db
        .update(masterProducts)
        .set(masterUpdateData)
        .where(eq(masterProducts.masterProductId, id));
    }

    return await db
      .insert(masterProductPM)
      .values(updateData)
      .onConflictDoUpdate({
        target: masterProductPM.masterProductId,
        set: updateData,
      })
      .returning();
  }
}

export const updateProductRepository = new UpdateProductRepository();
