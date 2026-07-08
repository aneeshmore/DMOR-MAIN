/**
 * Production Supervisor Service - Enhanced with Weight Tracking
 *
 * Handles batch completion with weight calculations and order distributions
 * Manages inventory updates with weight-based tracking
 */

import { eq, inArray, sql, and } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  productionBatch,
  batchProducts,
  batchMaterials,
  batchActivityLog,
  orders,
  orderDetails,
  products,
  masterProducts,
  masterProductRM,
  masterProductPM,
  inventoryTransactions,
} from '../../db/schema/index.js';
import { AppError } from '../../utils/AppError.js';
import { ProductionSupervisorRepository } from './repository.js';
import { NotificationsService } from '../notifications/service.js';
import inventoryTransactionService from '../../services/inventory-transaction.service.js';

export class ProductionSupervisorService {
  constructor() {
    this.repository = new ProductionSupervisorRepository();
    this.notificationsService = new NotificationsService();
  }

  async getMySupervisorBatches(supervisorId, status) {
    return await this.repository.findBySupervisor(supervisorId, status);
  }

  async getBatchFullDetails(batchId) {
    const batch = await this.repository.findBatchWithDetails(batchId);
    if (!batch) {
      throw new AppError('Batch not found', 404);
    }
    return batch;
  }

  async startBatch(batchId, startData) {
    // Get batch details
    const [batch] = await db
      .select()
      .from(productionBatch)
      .where(eq(productionBatch.batchId, batchId));

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    if (batch.status !== 'Scheduled') {
      throw new AppError('Batch can only be started from Scheduled status', 400);
    }

    // Verify material availability
    const materials = await db
      .select()
      .from(batchMaterials)
      .where(eq(batchMaterials.batchId, batchId));

    for (const material of materials) {
      // Determine if accessing Master Product (RM) or SKU
      // batchMaterials links to Master Product ID

      const [mp] = await db
        .select({
          type: masterProducts.productType,
          name: masterProducts.masterProductName,
        })
        .from(masterProducts)
        .where(eq(masterProducts.masterProductId, material.materialId));

      let available = 0;
      let name = mp ? mp.name : 'Unknown Material';

      if (mp && mp.type === 'RM') {
        // Check RM Stock
        const [rm] = await db
          .select({ availableQty: masterProductRM.availableQty })
          .from(masterProductRM)
          .where(eq(masterProductRM.masterProductId, material.materialId));

        available = rm ? parseFloat(rm.availableQty || 0) : 0;
      } else {
        // Fallback to checking products table (SKU) if not RM (or if legacy data)
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.productId, material.materialId));

        if (product) {
          available =
            parseFloat(product.availableQuantity || 0) - parseFloat(product.reservedQuantity || 0);
          name = product.productName;
        }
      }

      const required = parseFloat(material.requiredQuantity);
      if (available < required) {
        throw new AppError(
          `Insufficient material: ${name}. Required: ${required}, Available: ${available}`,
          400
        );
      }
    }

    // Reserve materials
    for (const material of materials) {
      // Only reserve if tracked in products table (SKU-based), as master_product_rm has no reserved_qty column
      // We skip reservation for RM for now to avoid errors, or until schema supports it.
      const [mp] = await db
        .select({ type: masterProducts.productType })
        .from(masterProducts)
        .where(eq(masterProducts.masterProductId, material.materialId));

      if (!mp || mp.type !== 'RM') {
        await db
          .update(products)
          .set({
            reservedQuantity: sql`reserved_quantity + ${parseFloat(material.requiredQuantity)}`,
          })
          .where(eq(products.productId, material.materialId));
      }
    }

    // Update batch status
    const [updatedBatch] = await db
      .update(productionBatch)
      .set({
        status: 'In Progress',
        startedAt: new Date(),
        supervisorId: startData.supervisorId,
        labourNames: startData.labourNames,
      })
      .where(eq(productionBatch.batchId, batchId))
      .returning();

    // Update linked orders
    const batchProductsList = await db
      .select()
      .from(batchProducts)
      .where(eq(batchProducts.batchId, batchId));

    if (batchProductsList.length > 0) {
      await db
        .update(orders)
        .set({ status: 'In Production' })
        .where(
          inArray(
            orders.orderId,
            batchProductsList.map(bo => bo.orderId)
          )
        );
    }

    // Log activity
    await db.insert(batchActivityLog).values({
      batchId,
      action: 'Start Batch',
      previousStatus: batch.status,
      newStatus: 'In Progress',
      performedBy: startData.supervisorId || updatedBatch.supervisorId || batch.supervisorId,
      notes: startData.notes || null,
    });

    return updatedBatch;
  }

  /**
   * Complete batch with weight tracking and distribution
   * Calculates actual weight and creates order distributions
   */
  async completeBatch(batchId, completionData) {
    // DEBUG LOGGING
    console.log('Completing Batch:', batchId);
    console.log('Output SKUs Received:', JSON.stringify(completionData.outputSkus, null, 2));

    // 1. Get batch details
    const [batch] = await db
      .select()
      .from(productionBatch)
      .where(eq(productionBatch.batchId, batchId));

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    if (batch.status !== 'In Progress') {
      throw new AppError('Only batches in progress can be completed', 400);
    }

    // 2. Calculate actual weight produced
    const actualQuantity = parseFloat(completionData.actualQuantity);
    const actualDensity = parseFloat(completionData.actualDensity || batch.density);
    const actualWeightKg = actualQuantity * actualDensity; // liters × kg/liter = kg

    // 3. Handle material consumption and inventory deductions
    const materials = await db
      .select()
      .from(batchMaterials)
      .where(eq(batchMaterials.batchId, batchId));

    for (const material of materials) {
      const actualQty = completionData.materialConsumption?.find(
        m => m.materialId === material.materialId
      )?.actualQuantity;

      const quantityToDeduct = actualQty || parseFloat(material.requiredQuantity);

      // Determine type
      const [mp] = await db
        .select({
          type: masterProducts.productType,
          name: masterProducts.masterProductName,
          unitId: masterProducts.defaultUnitId,
        })
        .from(masterProducts)
        .where(eq(masterProducts.masterProductId, material.materialId));

      if (mp && mp.type === 'RM') {
        // --- RM LOGIC ---
        // 1. Deduct from Master Product RM
        await db
          .update(masterProductRM)
          .set({ availableQty: sql`COALESCE(available_qty, 0) - ${quantityToDeduct}` })
          .where(eq(masterProductRM.masterProductId, material.materialId));

        // 2. Find/Create SKU for Transaction Log
        let transactionProductId = null;
        const [existingSku] = await db
          .select({ productId: products.productId })
          .from(products)
          .where(eq(products.masterProductId, material.materialId))
          .limit(1);

        if (existingSku) {
          transactionProductId = existingSku.productId;
        } else {
          // Create default SKU
          const [newSku] = await db
            .insert(products)
            .values({
              masterProductId: material.materialId,
              productName: mp.name,
              productType: 'RM',
              unitId: mp.unitId,
              isActive: true,
              availableQuantity: '0',
              sellingPrice: '0',
            })
            .returning({ productId: products.productId });
          if (newSku) transactionProductId = newSku.productId;
        }

        // 3. Skip inline transaction write for RM logic (will be handled by consolidation step at completion)
      } else {
        // --- LEGACY/SKU LOGIC ---
        // Unreserve and deduct from available
        await db
          .update(products)
          .set({
            reservedQuantity: sql`GREATEST(reserved_quantity - ${parseFloat(material.requiredQuantity)}, 0)`,
            availableQuantity: sql`available_quantity - ${quantityToDeduct}`,
          })
          .where(eq(products.productId, material.materialId));

        // Skip inline transaction write for SKU logic (will be handled by consolidation step at completion)
      }

      if (actualQty) {
        await db
          .update(batchMaterials)
          .set({
            actualQuantity: actualQty,
            variance: actualQty - parseFloat(material.requiredQuantity),
          })
          .where(eq(batchMaterials.batchMaterialId, material.batchMaterialId));
      }
    }

    // 4. Get batch products for distribution update
    const batchProductsForUpdate = await db
      .select()
      .from(batchProducts)
      .where(eq(batchProducts.batchId, batchId));

    // 5. Update batch products with production data
    // Pre-calculate total planned units to determine if we have a valid plan to follow
    const totalPlannedAll = batchProductsForUpdate.reduce(
      (sum, bp) => sum + (parseInt(bp.plannedUnits) || 0),
      0
    );
    const isMTS = totalPlannedAll === 0;

    // Create map of provided SKU outputs from frontend (if any)
    // Ensure productId is always a number for consistent lookup
    const outputSkuMap = new Map(
      (completionData.outputSkus || []).map(s => [Number(s.productId), s])
    );

    let totalDistributionWeight = 0;

    for (const batchProduct of batchProductsForUpdate) {
      // Get SKU details
      const [sku] = await db
        .select()
        .from(products)
        .where(eq(products.productId, batchProduct.productId));

      if (!sku) continue;

      const packageCapacityKg = parseFloat(
        batchProduct.packageCapacityKg || sku.packageCapacityKg || 0
      );

      const plannedUnits = parseInt(batchProduct.plannedUnits) || 0;
      let producedUnits = plannedUnits;
      let producedWeightKg = 0;

      // PRIORITY 1: Use explicit output data from frontend
      if (outputSkuMap.size > 0) {
        const skuOutput = outputSkuMap.get(Number(batchProduct.productId));
        console.log(
          `Matching Product ID ${batchProduct.productId} (Type: ${typeof batchProduct.productId}) against Map keys:`,
          Array.from(outputSkuMap.keys())
        );
        console.log('Found SKU Output:', skuOutput);

        producedUnits = skuOutput ? skuOutput.producedUnits : 0;
      }
      // PRIORITY 2: Auto-calculate for MTS (Unplanned) if no explicit data provided
      else if (isMTS && actualQuantity > 0) {
        // If we have no plan, we try to attribute production to the SKUs.
        // If there is only ONE SKU, we give it all.
        if (batchProductsForUpdate.length === 1) {
          if (packageCapacityKg > 0) {
            producedUnits = Math.round(actualWeightKg / packageCapacityKg);
          } else {
            producedUnits = 0;
          }
        } else {
          // Multiple SKUs and no plan. We cannot guess.
          producedUnits = 0;
        }
      }

      if (producedUnits > 0) {
        producedWeightKg = producedUnits * packageCapacityKg;
      }

      // Update the batch product with production results
      await db
        .update(batchProducts)
        .set({
          producedUnits, // Use calculated or planned
          producedWeightKg,
          variance: 0,
          isFulfilled: true,
          fulfilledAt: new Date(),
          inventoryUpdated: true,
          inventoryUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(batchProducts.batchProductId, batchProduct.batchProductId));

      totalDistributionWeight += producedWeightKg;

      // UPDATE SKU INVENTORY (UNITS)
      if (producedUnits > 0) {
        await db
          .update(products)
          .set({
            availableQuantity: sql`available_quantity + ${producedUnits}`,
            // We can also update weight if needed, but primary is Units for SKUs
            // availableWeightKg: sql`available_weight_kg + ${producedWeightKg}`,
          })
          .where(eq(products.productId, batchProduct.productId));

        // Record inventory transaction for THIS SKU
        try {
          await inventoryTransactionService.recordProductionOutput({
            productId: batchProduct.productId, // The SKU ID
            quantity: producedUnits, // Units
            weightKg: producedWeightKg,
            batchId,
            createdBy: completionData.completedBy,
            notes: `Produced from batch ${batch.batchNo} (SKU: ${sku.productName})`,
          });
        } catch (txnError) {
          console.error(
            '[ProductionSupervisor] Failed to record SKU output transaction:',
            txnError
          );
        }
      }
    }

    // Auto-clear notifications (Refactored to check all SKUs of Master)
    // We do this after the loop to ensure stock is updated
    try {
      const skuProducts = await db
        .select()
        .from(products)
        .where(eq(products.masterProductId, batch.masterProductId));

      for (const product of skuProducts) {
        // Fetch master product to get min stock level
        const [master] = await db
          .select({ minStockLevel: masterProducts.minStockLevel })
          .from(masterProducts)
          .where(eq(masterProducts.masterProductId, product.masterProductId));

        await this.notificationsService.clearResolvedShortageAlerts(
          product.productId,
          parseFloat(product.availableQuantity || 0),
          master?.minStockLevel || 0
        );
      }
    } catch (notifError) {
      console.error('[ProductionSupervisorService] Failed to clear alerts:', notifError);
    }

    // 7. Calculate actual time
    const startTime = new Date(batch.startedAt);
    const endTime = new Date(completionData.completedAt || new Date());
    const actualTimeHours = (endTime - startTime) / (1000 * 60 * 60);

    // 9. Update batch with weight information
    const [updatedBatch] = await db
      .update(productionBatch)
      .set({
        status: 'Completed',
        completedAt: completionData.completedAt ? new Date(completionData.completedAt) : new Date(),
        actualQuantity,
        actualDensity,
        actualWeightKg, // Store total weight produced
        actualWaterPercentage: completionData.actualWaterPercentage,
        actualViscosity: completionData.actualViscosity,
        actualTimeHours,
        productionRemarks: completionData.productionRemarks,
        completedBy: completionData.completedBy,
      })
      .where(eq(productionBatch.batchId, batchId))
      .returning();

    // 10. Update linked orders
    if (batchProductsForUpdate.length > 0) {
      await db
        .update(orders)
        .set({ status: 'Ready for Dispatch' })
        .where(
          inArray(
            orders.orderId,
            batchProductsForUpdate.map(bo => bo.orderId)
          )
        );
    }

    // 11. Log activity
    await db.insert(batchActivityLog).values({
      batchId,
      action: 'Complete Batch',
      previousStatus: batch.status,
      newStatus: 'Completed',
      performedBy: completionData.completedBy,
      notes: `Completed with ${actualQuantity} qty (${actualWeightKg}kg at ${actualDensity}kg/L)`,
    });

    // Group and consolidate Production Consumption transactions for the completed batch
    try {
      const numericBatchId = parseInt(batchId);
      const finalMaterials = await db
        .select()
        .from(batchMaterials)
        .where(eq(batchMaterials.batchId, numericBatchId));

      if (finalMaterials.length > 0) {
        // Group by materialId
        const materialConsumptions = new Map();
        for (const mat of finalMaterials) {
          const matId = mat.materialId;
          const qty = mat.actualQuantity !== null ? parseFloat(mat.actualQuantity) : parseFloat(mat.requiredQuantity) || 0;
          materialConsumptions.set(matId, (materialConsumptions.get(matId) || 0) + qty);
        }

        // Update or insert Production Consumption transactions per raw material
        for (const [materialId, totalQty] of materialConsumptions.entries()) {
          if (totalQty <= 0) continue;

          const existingTxs = await db
            .select()
            .from(inventoryTransactions)
            .where(
              and(
                eq(inventoryTransactions.referenceType, 'Batch'),
                eq(inventoryTransactions.referenceId, numericBatchId),
                eq(inventoryTransactions.masterProductId, materialId),
                eq(inventoryTransactions.transactionType, 'Production Consumption')
              )
            )
            .orderBy(inventoryTransactions.transactionId);

          // Fetch current stock from masterProductRM to align balances
          const [rmStock] = await db
            .select({ availableQty: masterProductRM.availableQty })
            .from(masterProductRM)
            .where(eq(masterProductRM.masterProductId, materialId));
          const currentBalance = rmStock ? parseFloat(rmStock.availableQty || 0) : 0;

          if (existingTxs.length > 0) {
            const primaryTx = existingTxs[0];

            // Update primary transaction with total quantity and updated balances
            await db
              .update(inventoryTransactions)
              .set({
                quantity: Math.round(-totalQty),
                weightKg: String(-totalQty),
                balanceBefore: Math.round(currentBalance + totalQty),
                balanceAfter: Math.round(currentBalance),
                notes: `Consolidated Production Consumption in batch ${batch.batchNo} (RM)`,
              })
              .where(eq(inventoryTransactions.transactionId, primaryTx.transactionId));

            // If there are duplicate transactions, delete them
            if (existingTxs.length > 1) {
              const duplicateIds = existingTxs.slice(1).map(tx => tx.transactionId);
              await db
                .delete(inventoryTransactions)
                .where(inArray(inventoryTransactions.transactionId, duplicateIds));
            }
          } else {
            // Create one new transaction if none existed (nullable productId is safe)
            const product = await db
              .select({ productId: products.productId })
              .from(products)
              .where(eq(products.masterProductId, materialId))
              .limit(1);

            const productIdVal = product.length > 0 ? product[0].productId : null;

            await db.insert(inventoryTransactions).values({
              productId: productIdVal,
              masterProductId: materialId,
              transactionType: 'Production Consumption',
              quantity: Math.round(-totalQty),
              weightKg: String(-totalQty),
              balanceBefore: Math.round(currentBalance + totalQty),
              balanceAfter: Math.round(currentBalance),
              referenceType: 'Batch',
              referenceId: numericBatchId,
              createdBy: completionData.completedBy,
              notes: `Consolidated Production Consumption in batch ${batch.batchNo} (RM)`,
            });
          }
        }
      }
    } catch (syncError) {
      console.error('Failed to synchronize inventory transactions on batch completion:', syncError);
    }

    return {
      batch: updatedBatch,
      actualWeightKg,
      totalDistributionWeight,
      ordersUpdated: batchProductsForUpdate.length,
    };
  }

  /**
   * Validate if production output meets order requirements
   */
  async validateProductionAgainstOrders(batchId, totalWeightKg) {
    const batchProductsList = await db
      .select()
      .from(batchProducts)
      .where(eq(batchProducts.batchId, batchId));

    const validationResults = [];

    for (const batchOrder of batchProductsList) {
      const orderDetailsList = await db
        .select()
        .from(orderDetails)
        .where(eq(orderDetails.orderId, batchOrder.orderId));

      let totalOrderWeight = 0;
      const capacityBreakdown = [];

      for (const detail of orderDetailsList) {
        const [sku] = await db
          .select()
          .from(products)
          .where(eq(products.productId, detail.productId));

        if (sku && sku.packageCapacityKg) {
          const requiredWeight = parseFloat(detail.requiredWeightKg || 0);
          totalOrderWeight += requiredWeight;
          const packageCapacity = parseFloat(sku.packageCapacityKg);

          capacityBreakdown.push({
            productId: sku.productId,
            productName: sku.productName,
            requiredWeightKg: requiredWeight,
            packageCapacityKg: packageCapacity,
            requiredPackages: Math.ceil(requiredWeight / packageCapacity),
          });
        }
      }

      validationResults.push({
        orderId: batchOrder.orderId,
        totalOrderWeight,
        isDirectAvailable: totalWeightKg >= totalOrderWeight,
        availabilityStatus: this._getAvailabilityStatus(totalWeightKg, totalOrderWeight),
        capacityBreakdown,
      });
    }

    return {
      batchId,
      totalProducedWeight: totalWeightKg,
      orderRequirements: validationResults,
      canFulfillAll: validationResults.every(v => v.isDirectAvailable),
    };
  }

  /**
   * Determine availability status (direct or indirect)
   */
  _getAvailabilityStatus(available, required) {
    if (available >= required) {
      return {
        type: 'DIRECT',
        description: 'Available in required capacity',
        surplusKg: available - required,
      };
    } else if (available > 0) {
      return {
        type: 'INDIRECT',
        description: 'Available but in different/mixed capacities',
        shortfallKg: required - available,
      };
    } else {
      return {
        type: 'NOT_AVAILABLE',
        description: 'Insufficient quantity',
        shortfallKg: required,
      };
    }
  }

  async cancelBatch(batchId, reason, cancelledBy) {
    const [batch] = await db
      .select()
      .from(productionBatch)
      .where(eq(productionBatch.batchId, batchId));

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    // Release reserved materials if batch was in progress
    if (batch.status === 'In Progress') {
      const materials = await db
        .select()
        .from(batchMaterials)
        .where(eq(batchMaterials.batchId, batchId));

      for (const material of materials) {
        await db
          .update(products)
          .set({
            reservedQuantity: sql`GREATEST(reserved_quantity - ${parseFloat(material.requiredQuantity)}, 0)`,
          })
          .where(eq(products.productId, material.materialId));
      }
    }

    // Update batch
    const [updatedBatch] = await db
      .update(productionBatch)
      .set({
        status: 'Cancelled',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason,
      })
      .where(eq(productionBatch.batchId, batchId))
      .returning();

    // Revert linked orders to Accepted
    const batchProductsList = await db
      .select()
      .from(batchProducts)
      .where(eq(batchProducts.batchId, batchId));

    if (batchProductsList.length > 0) {
      await db
        .update(orders)
        .set({ status: 'Accepted' })
        .where(
          inArray(
            orders.orderId,
            batchProductsList.map(bo => bo.orderId)
          )
        );
    }

    // Log activity
    await db.insert(batchActivityLog).values({
      batchId,
      action: 'Cancel Batch',
      previousStatus: batch.status,
      newStatus: 'Cancelled',
      performedBy: cancelledBy,
      notes: reason,
    });

    return updatedBatch;
  }

  async generateBatchChart(batchId) {
    const batch = await this.repository.findBatchWithDetails(batchId);
    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    // Return structured data for frontend to generate PDF/Excel
    return {
      batch: {
        batchNo: batch.batchNo,
        scheduledDate: batch.scheduledDate,
        supervisorName: batch.supervisor?.firstName + ' ' + batch.supervisor?.lastName,
        productName: batch.masterProduct?.productName,
        plannedQuantity: batch.plannedQuantity,
        density: batch.density,
        waterPercentage: batch.waterPercentage,
        viscosity: batch.viscosity,
      },
      materials: batch.materials,
      orders: batch.orders,
      subProducts: batch.subProducts,
    };
  }
}
