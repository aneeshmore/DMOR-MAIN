import { db } from '../../db/index.js';
import { masterProducts } from '../../db/schema/products/master-products.js';
import { products } from '../../db/schema/products/products.js';
import { masterProductRM } from '../../db/schema/products/master-product-rm.js';
import { masterProductPM } from '../../db/schema/products/master-product-pm.js';
import { masterProductFG } from '../../db/schema/products/master-product-fg.js';
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
        hsnCode: masterProductFG.hsnCode,
        costPrice: masterProductFG.purchaseCost,
        devCostPrice: masterProductFG.productionCost,
        packingCost: masterProductPM.purchaseCost,
        pmCapacity: masterProductPM.capacity,
      })
      .from(products)
      .innerJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .leftJoin(
        masterProductFG,
        eq(masterProducts.masterProductId, masterProductFG.masterProductId)
      )
      .leftJoin(
        masterProductPM,
        eq(products.packagingId, masterProductPM.masterProductId)
      )
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

    // Update masterProductFG hsnCode or costPrice if provided
    if (data.hsnCode !== undefined || data.costPrice !== undefined) {
      const productRecord = await db
        .select({ 
          masterProductId: products.masterProductId,
          packagingId: products.packagingId 
        })
        .from(products)
        .where(eq(products.productId, id))
        .limit(1);

      const masterId = productRecord[0]?.masterProductId;
      if (masterId) {
        let updateVals = {};
        if (data.hsnCode !== undefined) updateVals.hsnCode = data.hsnCode;
        
        if (data.costPrice !== undefined) {
          let pmCapacity = 1;
          let pmCost = 0;
          const packagingId = productRecord[0]?.packagingId;
          
          if (packagingId) {
             const pmRecord = await db.select({ capacity: masterProductPM.capacity, purchaseCost: masterProductPM.purchaseCost }).from(masterProductPM).where(eq(masterProductPM.masterProductId, packagingId)).limit(1);
             pmCapacity = Number(pmRecord[0]?.capacity) || 1;
             pmCost = Number(pmRecord[0]?.purchaseCost) || 0;
          }
          
          updateVals.purchaseCost = String((Number(data.costPrice) - pmCost) / pmCapacity);
        }

        if (Object.keys(updateVals).length > 0) {
          await db
            .insert(masterProductFG)
            .values({ masterProductId: masterId, ...updateVals })
            .onConflictDoUpdate({
              target: masterProductFG.masterProductId,
              set: updateVals,
            });
        }
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
        hsnCode: masterProductRM.hsnCode,
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
    if (data.hsnCode !== undefined) updateData.hsnCode = data.hsnCode;

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
        hsnCode: masterProductPM.hsnCode,
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
    if (data.hsnCode !== undefined) updateData.hsnCode = data.hsnCode;

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
