import { eq, desc, and, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { materialInward } from '../../db/schema/inventory/material-inward.js';
import { suppliers } from '../../db/schema/inventory/suppliers.js';
import { customers } from '../../db/schema/sales/customers.js';
import { products } from '../../db/schema/products/products.js';
import { masterProducts } from '../../db/schema/products/master-products.js';
import { masterProductRM, masterProductPM, masterProductFG } from '../../db/schema/index.js';
import { units } from '../../db/schema/core/units.js';
import { inventoryTransactions } from '../../db/schema/index.js';

const mapInward = row => {
  if (!row) return null;
  return {
    ...row,
    inwardId: Number(row.inwardId),
    quantity: Number(row.quantity),
    unitPrice: row.unitPrice !== null ? Number(row.unitPrice) : 0,
    totalCost: row.totalCost !== null ? Number(row.totalCost) : 0,
  };
};

export class InwardRepository {
  async findByBillNo(billNo) {
    if (!billNo) return null;
    const result = await db
      .select({
        inwardId: materialInward.inwardId,
        billNo: materialInward.billNo,
      })
      .from(materialInward)
      .where(sql`LOWER(TRIM(${materialInward.billNo})) = LOWER(TRIM(${billNo}))`)
      .limit(1);
    return result[0] || null;
  }

  async findAllInwards(filters = {}) {
    try {
      let query = db
        .select({
          inwardId: materialInward.inwardId,
          inwardUuid: materialInward.inwardUuid,
          productId: materialInward.masterProductId, // Master Product ID (Aliased for frontend compatibility)
          skuId: materialInward.productId, // FG SKU ID
          productName: masterProducts.masterProductName,
          skuProductName: products.productName, // For FG: SKU name like "Black JAPAN 1L"
          productType: masterProducts.productType,
          supplierId: materialInward.supplierId,
          supplierName: suppliers.supplierName,

          inwardDate: materialInward.inwardDate,
          quantity: materialInward.quantity,
          unitId: materialInward.unitId,
          unitName: units.unitName,
          unitPrice: materialInward.unitPrice,
          totalCost: materialInward.totalCost,
          billNo: materialInward.billNo,
          notes: materialInward.notes,
          createdAt: materialInward.createdAt,
          updatedAt: materialInward.updatedAt,
        })
        .from(materialInward)
        .leftJoin(
          masterProducts,
          eq(materialInward.masterProductId, masterProducts.masterProductId)
        )
        .leftJoin(units, eq(materialInward.unitId, units.unitId))
        .leftJoin(suppliers, eq(materialInward.supplierId, suppliers.supplierId))

        .leftJoin(products, eq(materialInward.productId, products.productId)); // For FG SKUs

      if (filters.productId) {
        query = query.where(eq(materialInward.masterProductId, filters.productId));
      }

      const rows = await query.orderBy(desc(materialInward.inwardDate));
      return rows.map(mapInward);
    } catch (error) {
      console.error('InwardRepository.findAllInwards Error:', error);
      throw error;
    }
  }

  async findInwardById(inwardId) {
    const result = await db
      .select({
        inwardId: materialInward.inwardId,
        inwardUuid: materialInward.inwardUuid,
        productId: materialInward.masterProductId,
        skuId: materialInward.productId, // FG SKU ID
        productName: masterProducts.masterProductName,
        productType: masterProducts.productType,
        supplierId: materialInward.supplierId,
        supplierName: suppliers.supplierName,
        inwardDate: materialInward.inwardDate,
        quantity: materialInward.quantity,
        unitId: materialInward.unitId,
        unitName: units.unitName,
        unitPrice: materialInward.unitPrice,
        totalCost: materialInward.totalCost,
        billNo: materialInward.billNo,
        notes: materialInward.notes,
        createdAt: materialInward.createdAt,
      })
      .from(materialInward)
      .leftJoin(masterProducts, eq(materialInward.masterProductId, masterProducts.masterProductId))
      .leftJoin(units, eq(materialInward.unitId, units.unitId))
      .leftJoin(suppliers, eq(materialInward.supplierId, suppliers.supplierId))
      .where(eq(materialInward.inwardId, inwardId))
      .limit(1);

    return mapInward(result[0]);
  }

  async createInward(inwardData) {
    // Support batch insert
    if (Array.isArray(inwardData)) {
      const result = await db.insert(materialInward).values(inwardData).returning();
      // Re-fetch with JOIN to get productType and other joined data for ALL inserted items
      const inwardIds = result.map(r => r.inwardId);
      const fullData = await db
        .select({
          inwardId: materialInward.inwardId,
          inwardUuid: materialInward.inwardUuid,
          productId: materialInward.masterProductId,
          skuId: materialInward.productId, // Added
          productName: masterProducts.masterProductName,
          productType: masterProducts.productType,
          supplierId: materialInward.supplierId,
          supplierName: suppliers.supplierName,
          inwardDate: materialInward.inwardDate,
          quantity: materialInward.quantity,
          unitId: materialInward.unitId,
          unitName: units.unitName,
          unitPrice: materialInward.unitPrice,
          totalCost: materialInward.totalCost,
          billNo: materialInward.billNo,
          notes: materialInward.notes,
          createdAt: materialInward.createdAt,
        })
        .from(materialInward)
        .leftJoin(
          masterProducts,
          eq(materialInward.masterProductId, masterProducts.masterProductId)
        )
        .leftJoin(units, eq(materialInward.unitId, units.unitId))
        .leftJoin(suppliers, eq(materialInward.supplierId, suppliers.supplierId))
        .where(
          sql`${materialInward.inwardId} IN (${sql.join(
            inwardIds.map(id => sql`${id}`),
            sql`, `
          )})`
        );

      return fullData.map(mapInward);
    }

    const result = await db.insert(materialInward).values(inwardData).returning();
    // Re-fetch with JOIN to get productType and other joined data
    const fullData = await db
      .select({
        inwardId: materialInward.inwardId,
        inwardUuid: materialInward.inwardUuid,
        productId: materialInward.masterProductId,
        skuId: materialInward.productId, // Added
        productName: masterProducts.masterProductName,
        productType: masterProducts.productType,
        supplierId: materialInward.supplierId,
        supplierName: suppliers.supplierName,
        inwardDate: materialInward.inwardDate,
        quantity: materialInward.quantity,
        unitId: materialInward.unitId,
        unitName: units.unitName,
        unitPrice: materialInward.unitPrice,
        totalCost: materialInward.totalCost,
        billNo: materialInward.billNo,
        notes: materialInward.notes,
        createdAt: materialInward.createdAt,
      })
      .from(materialInward)
      .leftJoin(masterProducts, eq(materialInward.masterProductId, masterProducts.masterProductId))
      .leftJoin(units, eq(materialInward.unitId, units.unitId))
      .leftJoin(suppliers, eq(materialInward.supplierId, suppliers.supplierId))
      .where(eq(materialInward.inwardId, result[0].inwardId))
      .limit(1);

    return mapInward(fullData[0]);
  }

  async updateInward(inwardId, updateData) {
    const result = await db
      .update(materialInward)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(materialInward.inwardId, inwardId))
      .returning();

    return mapInward(result[0]);
  }

  async updateMasterProductStock(
    masterProductId,
    quantity,
    purchaseCost,
    productId = null,
    inwardId = null
  ) {
    console.log(
      `[Repo] Updating stock for MasterID: ${masterProductId}, SKU ID: ${productId}, Qty: ${quantity}, Cost: ${purchaseCost}`
    );

    // First, get the product type
    const masterProduct = await db
      .select({ productType: masterProducts.productType })
      .from(masterProducts)
      .where(eq(masterProducts.masterProductId, masterProductId))
      .limit(1);

    if (!masterProduct || masterProduct.length === 0) {
      console.error(`[Repo] Master product ${masterProductId} not found!`);
      throw new Error('Master product not found');
    }

    const productType = masterProduct[0].productType;
    console.log(`[Repo] Product Type is: ${productType}`);

    // Update the appropriate subtype table based on product type
    if (productType === 'FG') {
      if (productId) {
        console.log(`[Repo] Updating FG SKU stock in products table...`);
        await db
          .update(products)
          .set({
            availableQuantity: sql`COALESCE(${products.availableQuantity}, 0) + ${quantity}`,
          })
          .where(eq(products.productId, productId));
      } else {
        console.warn(
          `[Repo] Skipping FG Stock update: No SKU ID (productId) provided for MasterID ${masterProductId}`
        );
      }

      // Update FG purchase cost if a rate (unitPrice) was provided
      if (purchaseCost > 0) {
        console.log(`[Repo] Updating FG Master Purchase Cost to ${purchaseCost}...`);
        await db
          .insert(masterProductFG)
          .values({ masterProductId, purchaseCost })
          .onConflictDoUpdate({
            target: masterProductFG.masterProductId,
            set: { purchaseCost },
          });
      }
    } else if (productType === 'RM') {
      console.log(`[Repo] Upserting RM stock...`);

      // Build the set object for the upsert
      const insertData = {
        masterProductId,
        availableQty: quantity,
      };

      if (purchaseCost !== undefined && purchaseCost !== null && purchaseCost > 0) {
        insertData.purchaseCost = purchaseCost;
      }

      // Use upsert: insert if not exists, update if exists
      await db
        .insert(masterProductRM)
        .values(insertData)
        .onConflictDoUpdate({
          target: masterProductRM.masterProductId,
          set: {
            availableQty: sql`COALESCE(${masterProductRM.availableQty}, 0) + ${quantity}`,
            ...(purchaseCost > 0 ? { purchaseCost } : {}),
          },
        });
    } else if (productType === 'PM') {
      console.log(`[Repo] Upserting PM stock...`);

      const insertData = {
        masterProductId,
        availableQty: quantity,
      };

      if (purchaseCost !== undefined && purchaseCost !== null && purchaseCost > 0) {
        insertData.purchaseCost = purchaseCost;
      }

      // Use upsert: insert if not exists, update if exists
      await db
        .insert(masterProductPM)
        .values(insertData)
        .onConflictDoUpdate({
          target: masterProductPM.masterProductId,
          set: {
            availableQty: sql`COALESCE(${masterProductPM.availableQty}, 0) + ${quantity}`,
            ...(purchaseCost > 0 ? { purchaseCost } : {}),
          },
        });
    }

    // 3. Log Inventory Transaction
    // For FG: use productId (SKU ID from products table)
    // For RM/PM: use masterProductId directly (no SKUs for RM/PM)
    if (inwardId) {
      console.log(`[Repo] Logging Inward Transaction for InwardID: ${inwardId}`);
      try {
        if (productType === 'FG' && productId) {
          // FG: Log with productId (SKU)
          const currentProduct = await db
            .select({ availableQuantity: products.availableQuantity })
            .from(products)
            .where(eq(products.productId, productId))
            .limit(1);

          const balanceAfter = currentProduct[0]?.availableQuantity
            ? parseInt(currentProduct[0].availableQuantity)
            : parseInt(quantity);
          const balanceBefore = balanceAfter - parseInt(quantity);

          console.log(
            `[Repo] FG Balance tracking: Before=${balanceBefore}, After=${balanceAfter}, Qty=${quantity}`
          );

          await db.insert(inventoryTransactions).values({
            productId, // FG uses productId (SKU)
            masterProductId: null, // Not used for FG
            transactionType: 'Inward',
            quantity: parseInt(quantity),
            balanceBefore,
            balanceAfter,
            referenceType: 'Inward',
            referenceId: parseInt(inwardId),
            notes: 'Auto-generated from Material Inward (FG)',
            createdBy: 1,
            createdAt: new Date(),
          });
        } else if (productType === 'RM' || productType === 'PM') {
          // RM/PM: Log with masterProductId directly
          // Get balance from the appropriate master product table
          let balanceAfter = parseInt(quantity);

          if (productType === 'RM') {
            const rmStock = await db
              .select({ availableQty: masterProductRM.availableQty })
              .from(masterProductRM)
              .where(eq(masterProductRM.masterProductId, masterProductId))
              .limit(1);
            if (rmStock.length > 0) {
              balanceAfter = parseInt(rmStock[0].availableQty) || parseInt(quantity);
            }
          } else if (productType === 'PM') {
            const pmStock = await db
              .select({ availableQty: masterProductPM.availableQty })
              .from(masterProductPM)
              .where(eq(masterProductPM.masterProductId, masterProductId))
              .limit(1);
            if (pmStock.length > 0) {
              balanceAfter = parseInt(pmStock[0].availableQty) || parseInt(quantity);
            }
          }

          const balanceBefore = balanceAfter - parseInt(quantity);

          console.log(
            `[Repo] ${productType} Balance tracking: Before=${balanceBefore}, After=${balanceAfter}, Qty=${quantity}`
          );

          await db.insert(inventoryTransactions).values({
            productId: null, // Not used for RM/PM
            masterProductId, // RM/PM uses masterProductId
            transactionType: 'Inward',
            quantity: parseInt(quantity),
            balanceBefore,
            balanceAfter,
            referenceType: 'Inward',
            referenceId: parseInt(inwardId),
            notes: `Auto-generated from Material Inward (${productType})`,
            createdBy: 1,
            createdAt: new Date(),
          });
        }
      } catch (err) {
        console.error('[Repo] Failed to log inventory transaction:', err);
        // We log but don't fail the operation to preserve data integrity
      }
    }
  }

  // Removed getUniqueSuppliers - suppliers now come from suppliers table

  async getBillInfo(billNo, partyId, productType, inwardDate) {
    try {
      // Find all entries with this bill number, supplier/customer, product type, AND date combination
      const dateObj = new Date(inwardDate);
      const dateOnly = new Date(
        Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate())
      );

      console.log('🔍 getBillInfo called with:', {
        billNo,
        partyId,
        productType,
        inwardDate,
      });

      const whereConditions = [
        // sql`DATE(${materialInward.inwardDate}) = DATE(${dateOnly})`,
      ];

      if (billNo) {
        whereConditions.push(eq(materialInward.billNo, billNo));
      }

      // We only validate uniqueness via this method, so if we're checking strict duplicates:
      // We must check if date matches. If billNo is empty, maybe we don't care about duplicates in the same way?
      // But typically getBillInfo is used to see if we should block adding.
      // If billNo is empty, we generally allow multiple entries without bill number.

      if (!billNo) {
        // If no bill number, we can't really check for "duplicate bill" in the traditional sense
        // So we return null to imply "no conflict"
        return null;
      }

      whereConditions.push(sql`DATE(${materialInward.inwardDate}) = DATE(${dateOnly})`);
      whereConditions.push(eq(masterProducts.productType, productType));

      if (productType === 'FG') {
        // whereConditions.push(eq(materialInward.customerId, partyId)); // Removed customerId
      } else {
        whereConditions.push(eq(materialInward.supplierId, partyId));
      }

      const result = await db
        .select({
          billNo: materialInward.billNo,
          supplierId: materialInward.supplierId,

          inwardDate: materialInward.inwardDate,
          productType: masterProducts.productType,
          masterProductId: masterProducts.masterProductId,
          productName: masterProducts.masterProductName,
          skuId: materialInward.productId, // FG SKU ID
          skuName: products.productName, // FG SKU Name
        })
        .from(materialInward)
        .leftJoin(
          masterProducts,
          eq(materialInward.masterProductId, masterProducts.masterProductId)
        )
        .leftJoin(products, eq(materialInward.productId, products.productId)) // Join products for FG names
        .where(and(...whereConditions));

      console.log('📦 Query result:', {
        resultCount: result.length,
      });

      if (result.length === 0) {
        return null; // Bill doesn't exist with this combination
      }

      // Get unique products in this bill
      const uniqueProducts = result.map(row => ({
        masterProductId: row.masterProductId,
        skuId: row.skuId,
        productName: row.productType === 'FG' ? row.skuName || row.productName : row.productName,
      }));

      return {
        billNo: result[0].billNo,
        supplierId: result[0].supplierId,
        inwardDate: result[0].inwardDate,
        productType: result[0].productType,
        products: uniqueProducts,
      };
    } catch (error) {
      console.error('InwardRepository.getBillInfo Error:', error);
      throw error;
    }
  }

  async findBillEntries(billNo, supplierId, productType, inwardDate) {
    try {
      const dateObj = new Date(inwardDate);
      const dateOnly = new Date(
        Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate())
      );

      const result = await db
        .select({
          inwardId: materialInward.inwardId,
          masterProductId: materialInward.masterProductId,
          skuId: materialInward.productId, // FG SKU ID
          quantity: materialInward.quantity,
          unitPrice: materialInward.unitPrice,
          totalCost: materialInward.totalCost,
          productType: masterProducts.productType,
        })
        .from(materialInward)
        .leftJoin(
          masterProducts,
          eq(materialInward.masterProductId, masterProducts.masterProductId)
        )
        .where(
          and(
            eq(materialInward.billNo, billNo),
            eq(materialInward.supplierId, supplierId),
            eq(masterProducts.productType, productType),
            sql`DATE(${materialInward.inwardDate}) = DATE(${dateOnly})`
          )
        );

      return result.map(mapInward);
    } catch (error) {
      console.error('InwardRepository.findBillEntries Error:', error);
      throw error;
    }
  }

  async deleteBillTransactionally(billNo, supplierId, productType, inwardDate) {
    return await db.transaction(async tx => {
      // 1. Fetch all bill entries
      const dateObj = new Date(inwardDate);
      const dateOnly = new Date(
        Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate())
      );

      const entries = await tx
        .select({
          inwardId: materialInward.inwardId,
          masterProductId: materialInward.masterProductId,
          skuId: materialInward.productId,
          quantity: materialInward.quantity,
          productName: masterProducts.masterProductName,
        })
        .from(materialInward)
        .leftJoin(
          masterProducts,
          eq(materialInward.masterProductId, masterProducts.masterProductId)
        )
        .where(
          and(
            eq(materialInward.billNo, billNo),
            eq(materialInward.supplierId, supplierId),
            eq(masterProducts.productType, productType),
            sql`DATE(${materialInward.inwardDate}) = DATE(${dateOnly})`
          )
        );

      if (entries.length === 0) {
        throw new Error('Bill not found or no entries to delete');
      }

      console.log(`[Repo] Transaction: checking stock for ${entries.length} items...`);

      // 2. Validate Stock Levels
      for (const entry of entries) {
        const qtyToRemove = Number(entry.quantity);
        let currentStock = 0;
        let itemName = entry.productName;

        if (productType === 'FG') {
          // Check SKU stock in products table
          const skuResult = await tx
            .select({
              availableQuantity: products.availableQuantity,
              productName: products.productName,
            })
            .from(products)
            .where(eq(products.productId, entry.skuId))
            .limit(1);

          if (skuResult.length > 0) {
            currentStock = Number(skuResult[0].availableQuantity);
            itemName = skuResult[0].productName;
          }
        } else if (productType === 'RM') {
          const rmResult = await tx
            .select({ availableQty: masterProductRM.availableQty })
            .from(masterProductRM)
            .where(eq(masterProductRM.masterProductId, entry.masterProductId))
            .limit(1);

          if (rmResult.length > 0) currentStock = Number(rmResult[0].availableQty);
        } else if (productType === 'PM') {
          const pmResult = await tx
            .select({ availableQty: masterProductPM.availableQty })
            .from(masterProductPM)
            .where(eq(masterProductPM.masterProductId, entry.masterProductId))
            .limit(1);

          if (pmResult.length > 0) currentStock = Number(pmResult[0].availableQty);
        }

        console.log(
          `[Repo] Item: ${itemName} | Current: ${currentStock} | To Remove: ${qtyToRemove}`
        );

        if (currentStock < qtyToRemove) {
          throw new Error(
            `Cannot delete bill. Insufficient stock for '${itemName}'. Current: ${currentStock}, Bill Qty: ${qtyToRemove}.`
          );
        }
      }

      console.log(`[Repo] Stock check passed. Proceeding with deletion...`);

      // 3. Stock Reduction Execution
      for (const entry of entries) {
        const qtyToRemove = Number(entry.quantity);

        if (productType === 'FG' && entry.skuId) {
          await tx
            .update(products)
            .set({
              availableQuantity: sql`COALESCE(${products.availableQuantity}, 0) - ${qtyToRemove}`,
            })
            .where(eq(products.productId, entry.skuId));
        } else if (productType === 'RM') {
          await tx
            .update(masterProductRM)
            .set({
              availableQty: sql`COALESCE(${masterProductRM.availableQty}, 0) - ${qtyToRemove}`,
            })
            .where(eq(masterProductRM.masterProductId, entry.masterProductId));
        } else if (productType === 'PM') {
          await tx
            .update(masterProductPM)
            .set({
              availableQty: sql`COALESCE(${masterProductPM.availableQty}, 0) - ${qtyToRemove}`,
            })
            .where(eq(masterProductPM.masterProductId, entry.masterProductId));
        }
      }

      // 4. Delete Entries
      const inwardIds = entries.map(e => e.inwardId);
      await tx
        .delete(materialInward)
        .where(sql`${materialInward.inwardId} IN (${sql.join(inwardIds, sql`, `)})`);

      return entries.length;
    });
  }

  async deleteInwardTransactionally(inwardId) {
    console.log(
      `[Repo] deleteInwardTransactionally called with ID: ${inwardId} (Type: ${typeof inwardId})`
    );

    return await db.transaction(async tx => {
      // 1. Fetch Entry
      const result = await tx
        .select({
          inwardId: materialInward.inwardId,
          masterProductId: materialInward.masterProductId,
          skuId: materialInward.productId,
          quantity: materialInward.quantity,
          productName: masterProducts.masterProductName,
          productType: masterProducts.productType,
        })
        .from(materialInward)
        .leftJoin(
          masterProducts,
          eq(materialInward.masterProductId, masterProducts.masterProductId)
        )
        .where(eq(materialInward.inwardId, inwardId))
        .limit(1);

      console.log(`[Repo] Transaction Fetch result:`, result);

      if (result.length === 0) {
        throw new Error(`Inward entry not found for ID: ${inwardId}`);
      }

      const entry = result[0];
      const qtyToRemove = Number(entry.quantity);
      let currentStock = 0;
      let itemName = entry.productName;

      // 2. Fetch Current Stock & Validate
      if (entry.productType === 'FG') {
        const skuResult = await tx
          .select({
            availableQuantity: products.availableQuantity,
            productName: products.productName,
          })
          .from(products)
          .where(eq(products.productId, entry.skuId))
          .limit(1);

        if (skuResult.length > 0) {
          currentStock = Number(skuResult[0].availableQuantity);
          itemName = skuResult[0].productName;
        }
      } else if (entry.productType === 'RM') {
        const rmResult = await tx
          .select({ availableQty: masterProductRM.availableQty })
          .from(masterProductRM)
          .where(eq(masterProductRM.masterProductId, entry.masterProductId))
          .limit(1);

        if (rmResult.length > 0) currentStock = Number(rmResult[0].availableQty);
      } else if (entry.productType === 'PM') {
        const pmResult = await tx
          .select({ availableQty: masterProductPM.availableQty })
          .from(masterProductPM)
          .where(eq(masterProductPM.masterProductId, entry.masterProductId))
          .limit(1);

        if (pmResult.length > 0) currentStock = Number(pmResult[0].availableQty);
      }

      console.log(
        `[Repo] Validating deletion for '${itemName}'. Stock: ${currentStock}, Removing: ${qtyToRemove}`
      );

      if (currentStock < qtyToRemove) {
        throw new Error(
          `Cannot delete entry. Insufficient stock for '${itemName}'. Current: ${currentStock}, Bill Qty: ${qtyToRemove}.`
        );
      }

      // 3. Reduce Stock
      if (entry.productType === 'FG' && entry.skuId) {
        await tx
          .update(products)
          .set({
            availableQuantity: sql`COALESCE(${products.availableQuantity}, 0) - ${qtyToRemove}`,
          })
          .where(eq(products.productId, entry.skuId));
      } else if (entry.productType === 'RM') {
        await tx
          .update(masterProductRM)
          .set({
            availableQty: sql`COALESCE(${masterProductRM.availableQty}, 0) - ${qtyToRemove}`,
          })
          .where(eq(masterProductRM.masterProductId, entry.masterProductId));
      } else if (entry.productType === 'PM') {
        await tx
          .update(masterProductPM)
          .set({
            availableQty: sql`COALESCE(${masterProductPM.availableQty}, 0) - ${qtyToRemove}`,
          })
          .where(eq(masterProductPM.masterProductId, entry.masterProductId));
      }

      // 4. Delete Entry
      await tx.delete(materialInward).where(eq(materialInward.inwardId, inwardId));

      return true;
    });
  }
}
