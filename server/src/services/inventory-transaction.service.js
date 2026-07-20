/**
 * Inventory Transaction Service
 *
 * Centralized service for recording all inventory movements.
 * This ensures complete audit trail for stock changes.
 */

import db from '../db/index.js';
import { inventoryTransactions, products } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export class InventoryTransactionService {
  /**
   * Record an inventory transaction
   * @param {Object} params - Transaction parameters
   * @param {number} params.productId - Product ID
   * @param {string} params.transactionType - Type: 'Inward', 'Production Consumption', 'Production Output', 'Dispatch', 'Adjustment', 'Return', 'Discard'
   * @param {number} params.quantity - Quantity (positive for inward, negative for outward)
   * @param {number} params.weightKg - Weight in kg (optional)
   * @param {number} params.densityKgPerL - Density (optional)
   * @param {string} params.referenceType - Reference type: 'Batch', 'Order', 'Inward', 'Dispatch', 'Manual Adjustment'
   * @param {number} params.referenceId - Reference ID (optional)
   * @param {number} params.unitPrice - Unit price (optional)
   * @param {string} params.notes - Additional notes (optional)
   * @param {number} params.createdBy - Employee ID who created the transaction
   * @returns {Promise<Object>} Created transaction record
   */
  async recordTransaction({
    productId,
    transactionType,
    quantity,
    weightKg = null,
    densityKgPerL = null,
    referenceType = null,
    referenceId = null,
    unitPrice = null,
    notes = null,
    createdBy,
  }) {
    try {
      // 1. Try to find in standard Products table (FG/SKU)
      let product = await db.query.products.findFirst({
        where: eq(products.productId, productId),
        with: {
          masterProduct: true
        }
      });

      let currentStock = 0;
      let masterProductId = null;
      let productName = null;
      let minStockLevel = 0;

      if (product) {
        // It's an SKU (FG)
        currentStock = parseFloat(product.availableQuantity || 0);
        masterProductId = product.masterProductId;
        productName = product.productName;
        minStockLevel = parseFloat(product.minStockLevel || 0);
        var productType = 'FG';
      } else {
        // 2. Failing that, check if it's a Master Product (RM/PM) passed as productId
        // We assume the caller might be passing masterProductId as productId for RM/PM
        const masterProductData = await db.query.masterProducts.findFirst({
          where: eq(masterProducts.masterProductId, productId),
          with: {
            rmDetails: true,
            pmDetails: true
          }
        });

        if (!masterProductData) {
          throw new Error(`Product with ID ${productId} not found (checked SKU and Master)`);
        }

        masterProductId = masterProductData.masterProductId;
        productName = masterProductData.masterProductName;
        minStockLevel = parseFloat(masterProductData.minStockLevel || 0);
        productType = masterProductData.productType;

        if (masterProductData.productType === 'RM') {
          currentStock = parseFloat(masterProductData.rmDetails?.availableQty || 0);
        } else if (masterProductData.productType === 'PM') {
          currentStock = parseFloat(masterProductData.pmDetails?.availableQty || 0);
        } else {
          // If FG Master is passed, we can't really track stock on Master for FG usually, 
          // but maybe they want to? Assuming 0 or throw?
          // For now, let's treat as 0 if not RM/PM, or maybe assuming it's an error.
          // But existing logic threw error if not in products.
          // Let's settle on using 0 if structure exists but no stock field matches.
          currentStock = 0;
        }
      }

      // Since transactions are usually recorded AFTER the stock update, 
      // the currentStock represents the balance AFTER transaction.

      const balanceAfter = currentStock;
      const balanceBefore = currentStock - quantity;

      // Calculate total value if unit price is provided
      const totalValue = unitPrice ? Math.abs(quantity) * unitPrice : null;

      // Prepare values with proper type conversion
      const values = {
        productId: parseInt(productId),
        transactionType,
        quantity: parseInt(quantity),
        weightKg:
          weightKg !== null && weightKg !== undefined ? parseFloat(weightKg).toString() : null,
        densityKgPerL:
          densityKgPerL !== null && densityKgPerL !== undefined
            ? parseFloat(densityKgPerL).toString()
            : null,
        balanceBefore: parseInt(balanceBefore),
        balanceAfter: parseInt(balanceAfter),
        referenceType,
        referenceId:
          referenceId !== null && referenceId !== undefined ? parseInt(referenceId) : null,
        unitPrice:
          unitPrice !== null && unitPrice !== undefined ? parseFloat(unitPrice).toString() : null,
        totalValue:
          totalValue !== null && totalValue !== undefined
            ? parseFloat(totalValue).toString()
            : null,
        notes,
        createdBy: parseInt(createdBy),
        // Use the resolved masterProductId (product is null for RM/PM master rows)
        masterProductId: masterProductId,
      };

      // Insert transaction record
      const [transaction] = await db.insert(inventoryTransactions).values(values).returning();

      console.log(
        `✅ Inventory transaction recorded: ${transactionType} for product ${productId}, qty: ${quantity}`
      );

      // [LOW STOCK NOTIFICATION] Threshold monitoring on every stock movement.
      // Below minimum -> create one notification for the MaterialShortage
      // subscribers (deduped). Back above minimum -> clear the active alert.
      // Non-blocking: never fails the transaction itself.
      try {
        if (productName && minStockLevel > 0) {
          // Lazy import to avoid circular dependencies at module load
          const { NotificationsService } = await import('../modules/notifications/service.js');
          const notifService = new NotificationsService();

          if (balanceAfter < minStockLevel) {
            const exists = await notifService.repository.hasActiveLowStockNotification(productId, productType);
            if (!exists) {
              await notifService.createLowStockNotification({
                productId,
                productName,
                availableQty: balanceAfter,
                minLevel: minStockLevel,
                productType,
              });
            }
          } else {
            // Stock recovered — remove active low-stock/shortage alerts for this product
            await notifService.clearResolvedShortageAlerts(productId, balanceAfter, minStockLevel);
          }
        }
      } catch (lowStockErr) {
        console.error('Low stock notification check failed (non-blocking):', lowStockErr);
      }

      return transaction;
    } catch (error) {
      console.error('Error recording inventory transaction:', error);
      throw error;
    }
  }

  /**
   * Record multiple transactions in a batch
   * @param {Array<Object>} transactions - Array of transaction objects
   * @returns {Promise<Array>} Created transaction records
   */
  async recordBatchTransactions(transactions) {
    try {
      const results = [];
      for (const txn of transactions) {
        const result = await this.recordTransaction(txn);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('Error recording batch transactions:', error);
      throw error;
    }
  }

  /**
   * Record inward transaction (material receipt)
   */
  async recordInward({ productId, quantity, weightKg, inwardId, unitPrice, createdBy, notes }) {
    return this.recordTransaction({
      productId,
      transactionType: 'Inward',
      quantity: Math.abs(quantity), // Ensure positive
      weightKg,
      referenceType: 'Inward',
      referenceId: inwardId,
      unitPrice,
      notes,
      createdBy,
    });
  }

  /**
   * Record production consumption (raw material usage)
   */
  async recordProductionConsumption({ productId, quantity, weightKg, batchId, createdBy, notes }) {
    return this.recordTransaction({
      productId,
      transactionType: 'Production Consumption',
      quantity: -Math.abs(quantity), // Ensure negative
      weightKg,
      referenceType: 'Batch',
      referenceId: batchId,
      notes,
      createdBy,
    });
  }

  /**
   * Record production output (finished goods produced)
   */
  async recordProductionOutput({ productId, quantity, weightKg, batchId, createdBy, notes }) {
    return this.recordTransaction({
      productId,
      transactionType: 'Production Output',
      quantity: Math.abs(quantity), // Ensure positive
      weightKg,
      referenceType: 'Batch',
      referenceId: batchId,
      notes,
      createdBy,
    });
  }

  /**
   * Record dispatch (order fulfillment)
   */
  async recordDispatch({ productId, quantity, weightKg, orderId, createdBy, notes }) {
    return this.recordTransaction({
      productId,
      transactionType: 'Dispatch',
      quantity: -Math.abs(quantity), // Ensure negative
      weightKg,
      referenceType: 'Dispatch',
      referenceId: orderId,
      notes,
      createdBy,
    });
  }

  /**
   * Record manual adjustment
   */
  async recordAdjustment({ productId, quantity, weightKg, createdBy, notes }) {
    return this.recordTransaction({
      productId,
      transactionType: 'Adjustment',
      quantity,
      weightKg,
      referenceType: 'Manual Adjustment',
      notes,
      createdBy,
    });
  }

  /**
   * Record discard transaction (damaged/expired material)
   */
  async recordDiscard({ productId, quantity, discardId, createdBy, notes }) {
    return this.recordTransaction({
      productId,
      transactionType: 'Discard',
      quantity: -Math.abs(quantity), // Ensure negative
      referenceType: 'Discard',
      referenceId: discardId,
      notes,
      createdBy,
    });
  }

  /**
   * Backfill historical transactions from existing data
   * This is useful for populating the table with historical data
   */
  async backfillHistoricalTransactions(createdBy = 1) {
    try {
      console.log('🔄 Starting historical transaction backfill...');

      // Get all products with their current quantities
      const allProducts = await db.query.products.findMany();

      const transactions = [];

      for (const product of allProducts) {
        if (product.availableQuantity && product.availableQuantity > 0) {
          // Create an initial stock transaction for existing inventory
          const weightKg = product.availableWeightKg ? parseFloat(product.availableWeightKg) : null;

          transactions.push({
            productId: product.productId,
            transactionType: 'Initial Stock',
            quantity: product.availableQuantity,
            weightKg,
            referenceType: 'Manual Adjustment',
            notes: 'Historical data backfill - initial stock',
            createdBy,
          });
        }
      }

      console.log(`📊 Found ${transactions.length} products with existing inventory`);

      if (transactions.length > 0) {
        // Insert all transactions
        for (const txn of transactions) {
          await this.recordTransaction(txn);
        }
        console.log(`✅ Successfully backfilled ${transactions.length} historical transactions`);
      } else {
        console.log('ℹ️ No historical transactions to backfill');
      }

      return transactions.length;
    } catch (error) {
      console.error('Error backfilling historical transactions:', error);
      throw error;
    }
  }
}

export default new InventoryTransactionService();
