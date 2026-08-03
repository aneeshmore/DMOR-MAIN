import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  materialDiscard,
  products,
  stockLedger,
  masterProducts,
  masterProductRM,
  masterProductPM,
  inventoryTransactions,
} from '../../db/schema/index.js';
import { AppError } from '../../utils/AppError.js';

export class DiscardRepository {
  async findAllDiscards(filters) {
    const conditions = [];

    if (filters?.productType && filters.productType !== 'ALL') {
      conditions.push(eq(materialDiscard.productType, filters.productType));
    }

    if (filters?.productId) {
      conditions.push(eq(materialDiscard.productId, filters.productId));
    }

    let query = db
      .select({
        discardId: materialDiscard.discardId,
        productId: materialDiscard.productId,
        productType: materialDiscard.productType,
        discardDate: materialDiscard.discardDate,
        quantity: materialDiscard.quantity,
        reason: materialDiscard.reason,
        notes: materialDiscard.notes,
        createdAt: materialDiscard.createdAt,
        stockAfterDiscard: inventoryTransactions.balanceAfter,
      })
      .from(materialDiscard)
      .leftJoin(
        inventoryTransactions,
        and(
          eq(inventoryTransactions.referenceType, 'Discard'),
          eq(inventoryTransactions.referenceId, materialDiscard.discardId)
        )
      );

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const discards = await query.orderBy(desc(materialDiscard.discardDate));

    // Enrich each discard with product name and stock based on type
    const enrichedDiscards = await Promise.all(
      discards.map(async discard => {
        // Use stored productType. Fallback to 'detect' only if missing (legacy data safety)
        let type = discard.productType;
        if (!type) {
          const detected = await this.detectProductType(discard.productId);
          type = detected.type;
        }

        let productName = `Product #${discard.productId}`;
        let currentStock = 0;
        const productType = type;

        if (type === 'FG') {
          // Get from products table
          const product = await db
            .select({
              productName: products.productName,
              availableQuantity: products.availableQuantity,
            })
            .from(products)
            .where(eq(products.productId, discard.productId))
            .limit(1);

          if (product.length > 0) {
            productName = product[0].productName || productName;
            currentStock = parseFloat(product[0].availableQuantity || 0);
          }
        } else if (type === 'RM' || type === 'PM') {
          // Get from master_products table
          const mp = await db
            .select({
              masterProductName: masterProducts.masterProductName,
            })
            .from(masterProducts)
            .where(eq(masterProducts.masterProductId, discard.productId))
            .limit(1);

          if (mp.length > 0) {
            productName = mp[0].masterProductName || productName;
          }

          // Get stock from respective table
          if (type === 'RM') {
            const rm = await db
              .select({ availableQty: masterProductRM.availableQty })
              .from(masterProductRM)
              .where(eq(masterProductRM.masterProductId, discard.productId))
              .limit(1);
            currentStock = rm.length > 0 ? parseFloat(rm[0].availableQty || 0) : 0;
          } else {
            const pm = await db
              .select({ availableQty: masterProductPM.availableQty })
              .from(masterProductPM)
              .where(eq(masterProductPM.masterProductId, discard.productId))
              .limit(1);
            currentStock = pm.length > 0 ? parseFloat(pm[0].availableQty || 0) : 0;
          }
        }

        return {
          ...discard,
          productName,
          productType,
          currentStock,
        };
      })
    );

    return enrichedDiscards;
  }

  async findDiscardById(discardId) {
    const result = await db
      .select()
      .from(materialDiscard)
      .where(eq(materialDiscard.discardId, discardId));
    return result[0];
  }

  /**
   * Determine if the given ID is a master product (RM/PM) or a product SKU (FG)
   * Returns: { type: 'RM' | 'PM' | 'FG', productType: string }
   */
  async detectProductType(productId) {
    // First, check if it's a master product
    const masterProduct = await db
      .select({ productType: masterProducts.productType })
      .from(masterProducts)
      .where(eq(masterProducts.masterProductId, productId))
      .limit(1);

    if (masterProduct.length > 0) {
      const type = masterProduct[0].productType;
      if (type === 'RM' || type === 'PM') {
        return { type, isMasterProduct: true };
      }
    }

    // Check if it's a product SKU (FG)
    const product = await db
      .select({ productId: products.productId })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);

    if (product.length > 0) {
      return { type: 'FG', isMasterProduct: false };
    }

    return { type: null, isMasterProduct: false };
  }

  async createDiscard(data) {
    // Detect if this is RM, PM, or FG
    const type = data.productType;

    if (!type) {
      throw new Error(`Product Type is required`);
    }

    let balanceBefore = 0;
    let balanceAfter = 0;

    if (type === 'FG') {
      // FG: Get current stock from products table
      const currentProduct = await db
        .select({ availableQuantity: products.availableQuantity })
        .from(products)
        .where(eq(products.productId, data.productId))
        .limit(1);

      balanceBefore = currentProduct[0]?.availableQuantity
        ? parseFloat(currentProduct[0].availableQuantity)
        : 0;
      balanceAfter = balanceBefore - data.quantity;
    } else if (type === 'RM') {
      // RM: Get current stock from master_product_rm
      const currentRM = await db
        .select({ availableQty: masterProductRM.availableQty })
        .from(masterProductRM)
        .where(eq(masterProductRM.masterProductId, data.productId))
        .limit(1);

      balanceBefore = currentRM[0]?.availableQty ? parseFloat(currentRM[0].availableQty) : 0;
      balanceAfter = balanceBefore - data.quantity;
    } else if (type === 'PM') {
      // PM: Get current stock from master_product_pm
      const currentPM = await db
        .select({ availableQty: masterProductPM.availableQty })
        .from(masterProductPM)
        .where(eq(masterProductPM.masterProductId, data.productId))
        .limit(1);

      balanceBefore = currentPM[0]?.availableQty ? parseFloat(currentPM[0].availableQty) : 0;
      balanceAfter = balanceBefore - data.quantity;
    }

    // Validation: Check if stock would go negative
    if (balanceAfter < 0) {
      const typeLabel =
        type === 'RM' ? 'Raw Material' : type === 'PM' ? 'Packaging Material' : 'Finished Good';
      throw new AppError(
        `Insufficient stock. Available: ${balanceBefore.toFixed(4)}, Requested to discard: ${data.quantity.toFixed(4)}. Cannot discard more than available ${typeLabel} stock.`,
        400
      );
    }

    // 1. Create Discard Entry
    const [newDiscard] = await db
      .insert(materialDiscard)
      .values({
        productId: data.productId,
        productType: type,
        discardDate: data.discardDate ? new Date(data.discardDate) : new Date(),
        quantity: data.quantity.toString(),
        reason: data.reason,
        notes: data.notes,
      })
      .returning();

    // 2. Reduce Stock based on product type
    if (type === 'FG') {
      // Update products table for FG
      await db.execute(
        sql`UPDATE app.products 
            SET available_quantity = COALESCE(available_quantity, 0) - ${data.quantity} 
            WHERE product_id = ${data.productId}`
      );
    } else if (type === 'RM') {
      // Update master_product_rm table for RM
      await db.execute(
        sql`UPDATE app.master_product_rm 
            SET available_qty = COALESCE(available_qty, 0) - ${data.quantity} 
            WHERE master_product_id = ${data.productId}`
      );
    } else if (type === 'PM') {
      // Update master_product_pm table for PM
      await db.execute(
        sql`UPDATE app.master_product_pm 
            SET available_qty = COALESCE(available_qty, 0) - ${data.quantity} 
            WHERE master_product_id = ${data.productId}`
      );
    }

    // 3. Add to Stock Ledger (only for FG which has product entries)
    if (type === 'FG') {
      await db.insert(stockLedger).values({
        productId: data.productId,
        changeType: 'DISCARD',
        changeQty: (-data.quantity).toString(),
        referenceTable: 'material_discard',
        referenceId: newDiscard.discardId,
        notes: `Material Discard: ${data.reason || 'No reason provided'}`,
      });
    }

    // 4. Record Inventory Transaction for Reports/Ledger
    // For FG: use productId
    // For RM/PM: use masterProductId directly (no fake SKUs needed)
    try {
      if (type === 'FG') {
        // FG: Log with productId (SKU)
        await db.insert(inventoryTransactions).values({
          productId: data.productId, // FG uses productId (SKU)
          masterProductId: null, // Not used for FG
          transactionType: 'Discard',
          quantity: -data.quantity, // Negative for outward/discard
          balanceBefore,
          balanceAfter,
          referenceType: 'Discard',
          referenceId: newDiscard.discardId,
          notes: `Discard (FG): ${data.reason || 'No reason provided'}`,
          createdBy: data.createdBy || 1,
          createdAt: new Date(),
        });
        console.log(
          `[DiscardRepo] Logged FG inventory transaction for productId: ${data.productId}`
        );
      } else if (type === 'RM' || type === 'PM') {
        // RM/PM: Log with masterProductId directly
        await db.insert(inventoryTransactions).values({
          productId: null, // Not used for RM/PM
          masterProductId: data.productId, // RM/PM uses masterProductId
          transactionType: 'Discard',
          quantity: -data.quantity, // Negative for outward/discard
          balanceBefore,
          balanceAfter,
          referenceType: 'Discard',
          referenceId: newDiscard.discardId,
          notes: `Discard (${type}): ${data.reason || 'No reason provided'}`,
          createdBy: data.createdBy || 1,
          createdAt: new Date(),
        });
        console.log(
          `[DiscardRepo] Logged ${type} inventory transaction for masterProductId: ${data.productId}`
        );
      }
    } catch (err) {
      console.error('[DiscardRepo] Failed to log inventory transaction:', err);
      // Don't fail the operation if transaction logging fails
    }

    console.log(
      `[DiscardRepo] Discarded ${data.quantity} units of ${type} product ID ${data.productId}`
    );
    console.log(`[DiscardRepo] Stock: ${balanceBefore} -> ${balanceAfter}`);

    return newDiscard;
  }

  async updateDiscard(discardId, data) {
    const [updated] = await db
      .update(materialDiscard)
      .set(data)
      .where(eq(materialDiscard.discardId, discardId))
      .returning();
    return updated;
  }

  async deleteDiscard(discardId) {
    await db.delete(materialDiscard).where(eq(materialDiscard.discardId, discardId));
  }
}
