/**
 * Production Manager Service
 *
 * Business logic for production manager workflows:
 * - Order assessment and inventory checking
 * - Batch scheduling with BOM calculation
 * - Material requirement planning
 * - Delivery date setting
 */

import { ProductionManagerRepository } from './repository.js';
import { AppError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';
import { db } from '../../db/index.js';
import {
  orderDetails,
  products,
  batchProducts,
  batchMaterials,
  inventoryTransactions,
  masterProductRM,
  productionBatch,
} from '../../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
import { ReportsService } from '../reports/service.js';

export class ProductionManagerService {
  constructor() {
    this.repo = new ProductionManagerRepository();
  }

  /**
   * Get all accepted orders awaiting production assessment
   */
  async getAcceptedOrders() {
    logger.info('Fetching accepted orders for production assessment');
    const orders = await this.repo.getAcceptedOrders();
    return orders;
  }

  /**
   * Get batchable orders (Accepted or Scheduled for Production)
   */
  async getBatchableOrders() {
    logger.info('Fetching batchable orders for production assessment');
    const orders = await this.repo.getBatchableOrders();
    return orders;
  }

  /**
   * Get order details with products
   */
  async getOrderDetails(orderId) {
    logger.info('Fetching order details', { orderId });

    const orderData = await this.repo.getOrderWithDetails(orderId);

    if (!orderData.order) {
      throw new AppError('Order not found', 404);
    }

    return orderData;
  }

  /**
   * Check inventory availability for order products
   */
  async checkInventoryAvailability(orderDetails) {
    logger.info('Checking inventory availability');

    const productIds = orderDetails.map(d => d.productId);
    const productsData = await this.repo.checkInventoryForProducts(productIds);

    const results = [];

    for (const detail of orderDetails) {
      const productData = productsData.find(p => p.product.productId === detail.productId);

      if (!productData) {
        throw new AppError(`Product ${detail.productId} not found`, 404);
      }

      const product = productData.product;

      // Get BOM requirements
      const bomItems = await this.repo.getBomForProduct(detail.productId, detail.quantity);

      const availableQuantity = Math.max(0, parseFloat(product.availableQuantity) || 0);
      const reservedQuantity = Math.max(0, parseFloat(product.reservedQuantity) || 0);
      const freeQuantity = Math.max(0, availableQuantity - reservedQuantity);

      // Check if all materials are available (ensure non-negative comparison)
      const materialsAvailable = bomItems.every(
        item => Math.max(0, item.availableQuantity) >= item.requiredQuantity
      );

      results.push({
        productId: detail.productId,
        productName: product.productName,
        orderedQuantity: detail.quantity,
        availableQuantity: freeQuantity,
        canFulfill: freeQuantity >= detail.quantity,
        materials: bomItems.map(m => ({
          ...m,
          availableQuantity: Math.max(0, m.availableQuantity),
        })),
        materialsAvailable,
      });
    }

    return results;
  }

  /**
   * Schedule a production batch
   * Note: Neon-HTTP driver doesn't support transactions, so operations are performed sequentially.
   * Batch creation is critical, but post-creation steps are non-critical to ensure batch is created even if some operations fail.
   */
  async scheduleBatch(batchData, orderIds, performedBy) {
    logger.info('Scheduling production batch', { orderIds, performedBy });

    let batch = null;

    try {
      // CRITICAL VALIDATIONS (will throw if fail)
      // Validate that all products are finished goods (not raw materials)
      const productIds = batchData.orders.map(o => o.productId);

      let productInfo = [];
      if (productIds.length > 0) {
        productInfo = await this.repo.checkInventoryForProducts(productIds);
      }

      const rawMaterials = productInfo.filter(p => p.productType === 'RM');
      if (rawMaterials.length > 0) {
        const rmNames = rawMaterials.map(p => p.product.productName).join(', ');
        throw new AppError(
          `Cannot schedule batch: The following raw materials cannot be included in production batches: ${rmNames}. Only finished goods (FG) can be scheduled for production.`,
          400
        );
      }

      // VALIDATION: Check if ALL materials have sufficient stock BEFORE creating batch
      if (batchData.materials && batchData.materials.length > 0) {
        const insufficientMaterials = await this.repo.checkMultipleMaterialsStock(
          batchData.materials
        );

        if (insufficientMaterials.length > 0) {
          logger.warn('Insufficient raw material stock for batch', { insufficientMaterials });

          // Create error with structured data for frontend
          const error = new AppError(
            `Cannot start batch: ${insufficientMaterials.length} material(s) have insufficient stock`,
            400
          );
          // Attach structured data to error for frontend to use
          error.data = {
            type: 'INSUFFICIENT_STOCK',
            insufficientMaterials: insufficientMaterials.map(m => ({
              materialId: m.materialId,
              materialName: m.materialName,
              required: m.required,
              available: m.available,
              shortfall: m.shortfall,
            })),
          };
          throw error;
        }

        logger.info('Stock validation passed for all materials');
      }

      // CRITICAL: Generate batch number and create batch
      let batchNo = await this.repo.generateBatchNumber();
      logger.info('Generated batch number', { batchNo });

      // scheduledDate should be YYYY-MM-DD string from frontend date input
      const formattedScheduledDate = batchData.scheduledDate.toString().split('T')[0];
      logger.info('Batch scheduled date', {
        raw: batchData.scheduledDate,
        formatted: formattedScheduledDate,
      });

      // SNAPSHOT: Fetch Product Development data to store formulation values at batch creation time
      // This ensures reports show the formulation that was actually used, not current values
      const devData = await this.repo.getProductDevelopmentData(batchData.masterProductId);
      logger.info('Product Development data for snapshot', {
        masterProductId: batchData.masterProductId,
        density: devData?.density,
        viscosity: devData?.viscosity,
        waterPercentage: devData?.waterPercentage,
      });

      // Create batch with retry in case of duplicate batchNo
      let attempts = 0;
      while (!batch && attempts < 5) {
        try {
          batch = await this.repo.createBatch({
            batchNo,
            masterProductId: batchData.masterProductId,
            scheduledDate: formattedScheduledDate,
            plannedQuantity: batchData.plannedQuantity,
            // SNAPSHOT: Store formulation values from Product Development at creation time
            density: devData?.density || batchData.density || null,
            viscosity: devData?.viscosity || batchData.viscosity || null,
            waterPercentage: devData?.waterPercentage || batchData.waterPercentage || null,
            status: 'In Progress', // Started batches are In Progress (not just Scheduled)
            startedAt: new Date(),
            supervisorId: batchData.supervisorId,
            labourNames: batchData.labourNames || null,
            machineNo: batchData.machineNo || null,
            createdBy: performedBy,
          });

          logger.info('Batch created successfully', { batchId: batch.batchId, batchNo });
        } catch (err) {
          const msg = (err.message || '').toLowerCase();
          // Unique constraint violation - retry with new batchNo
          if (
            msg.includes('duplicate') ||
            msg.includes('unique') ||
            msg.includes('already exists')
          ) {
            attempts += 1;
            batchNo = await this.repo.generateBatchNumber();
            continue;
          }
          throw err; // Re-throw non-duplicate errors
        }
      }
      if (!batch) throw new Error('Failed to create batch after retries');

      // NON-CRITICAL POST-CREATION STEPS (wrapped in try-catch, don't fail batch creation)
      // Link all orders to batch (map orderId 0 to null for MTS)
      // We want to track ALL products being produced, even if not linked to a specific customer order
      const orderData = batchData.orders.map(o => ({
        batchId: batch.batchId,
        orderId: o.orderId > 0 ? o.orderId : null, // Set null for MTS
        masterProductId: batch.masterProductId,
        productId: o.productId,
        quantity: o.quantity,
      }));

      if (orderData.length > 0) {
        // Link orders to batch (non-critical)
        try {
          await this.repo.linkOrdersToBatch(batch.batchId, orderData);
          logger.info('Orders linked to batch', { count: orderData.length });
        } catch (linkError) {
          logger.warn('Failed to link orders to batch, batch created but orders not linked', {
            batchId: batch.batchId,
            error: linkError.message,
          });
        }

        // Update orders status to "Scheduled for Production" (non-critical)
        try {
          const updateData = {
            productionBatchId: batch.batchId,
          };

          if (batchData.expectedDeliveryDate) {
            // Convert to YYYY-MM-DD format for date column
            const date = new Date(batchData.expectedDeliveryDate);
            updateData.expectedDeliveryDate = date.toISOString().split('T')[0];
          }

          if (batchData.pmRemarks) {
            updateData.pmRemarks = batchData.pmRemarks;
          }

          const validOrderIds = batchData.orders.filter(o => o.orderId > 0).map(o => o.orderId);
          const uniqueValidOrderIds = [...new Set(validOrderIds)];

          if (uniqueValidOrderIds.length > 0) {
            await this.repo.updateMultipleOrdersStatus(
              uniqueValidOrderIds,
              'Scheduled for Production',
              updateData
            );
            logger.info('Orders status updated');
          }
        } catch (statusError) {
          logger.warn('Failed to update order statuses, batch created but statuses not updated', {
            batchId: batch.batchId,
            error: statusError.message,
          });
        }
      } else {
        // Make-to-Stock batch: Create batchProducts entries for ALL SKUs of this master product
        logger.info('No valid customer orders to link (Make-to-Stock batch)');

        try {
          const allSkus = await db
            .select({
              productId: products.productId,
              productName: products.productName,
              packageCapacityKg: products.packageCapacityKg,
            })
            .from(products)
            .where(eq(products.masterProductId, batch.masterProductId));

          if (allSkus.length > 0) {
            const mtsOrderData = allSkus.map(sku => ({
              batchId: batch.batchId,
              orderId: null,
              productId: sku.productId,
              quantity: 0,
              packageCapacityKg: sku.packageCapacityKg,
            }));

            await this.repo.linkOrdersToBatch(batch.batchId, mtsOrderData);
            logger.info('Created batchProducts entries for MTS SKUs', { count: allSkus.length });
          }
        } catch (mtsError) {
          logger.warn(
            'Failed to create MTS batch products, batch created but MTS entries not created',
            {
              batchId: batch.batchId,
              error: mtsError.message,
            }
          );
        }
      }

      // Add materials to batch and reserve stock (non-critical)
      if (batchData.materials && batchData.materials.length > 0) {
        try {
          await this.repo.addMaterialsToBatch(batch.batchId, batchData.materials);
          logger.info('Materials added to batch', { count: batchData.materials.length });
        } catch (materialsError) {
          logger.warn('Failed to add materials to batch, batch created but materials not added', {
            batchId: batch.batchId,
            error: materialsError.message,
          });
        }

        try {
          for (const material of batchData.materials) {
            await this.repo.reserveRawMaterial(
              material.materialId,
              material.requiredQuantity,
              batch.batchId,
              performedBy
            );
            logger.info('Raw material reserved', {
              materialId: material.materialId,
              quantity: material.requiredQuantity,
            });
          }
          logger.info('All materials reserved successfully');
        } catch (reserveError) {
          logger.warn('Failed to reserve raw materials, batch created but materials not reserved', {
            batchId: batch.batchId,
            error: reserveError.message,
          });
        }
      }

      // Create distributions (non-critical)
      try {
        await this.createBatchDistributions(batch.batchId, batchData.orders);
        logger.info('Production batch distributions created');
      } catch (distError) {
        logger.warn(
          'Failed to create batch distributions, batch created but distributions not created',
          {
            batchId: batch.batchId,
            error: distError.message,
          }
        );
      }

      // Log activity (non-critical)
      try {
        await this.repo.logBatchActivity(batch.batchId, 'Batch Scheduled', performedBy, {
          newStatus: 'Scheduled',
          notes: `Batch scheduled for ${orderIds.length} orders`,
          metadata: { orderIds },
        });
      } catch (logError) {
        logger.warn('Failed to log batch activity, batch created but activity not logged', {
          batchId: batch.batchId,
          error: logError.message,
        });
      }

      logger.info('Batch scheduling completed (with possible warnings)', {
        batchId: batch.batchId,
      });
      return await this.repo.getBatchById(batch.batchId);
    } catch (error) {
      // If batch was created but some post-creation step failed, still return success
      if (batch) {
        logger.warn('Batch created but some post-creation steps failed', {
          batchId: batch.batchId,
          error: error.message,
        });
        return await this.repo.getBatchById(batch.batchId);
      }

      // If batch creation itself failed, throw the error
      logger.error('Error scheduling batch - batch creation failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Auto-schedule an order (create tentative batch)
   * Moves order status to 'Scheduled for Production' and creates a batch
   * with NULL supervisor to be assigned later.
   */
  async autoScheduleOrder(orderId, expectedDate, performedBy) {
    logger.info('Auto-scheduling order', { orderId, expectedDate, performedBy });

    try {
      // 1. Get Order Details
      const { order, details } = await this.repo.getOrderWithDetails(orderId);
      if (!order) throw new AppError('Order not found', 404);
      if (details.length === 0) throw new AppError('Order has no products', 400);

      // 2. Validate Products (Must be FG)
      const productIds = details.map(d => d.productId);
      const productInfo = await this.repo.checkInventoryForProducts(productIds);
      const rawMaterials = productInfo.filter(p => p.productType === 'RM');
      if (rawMaterials.length > 0) {
        throw new AppError('Cannot schedule batch for Raw Materials', 400);
      }

      // 3. Determine Master Product (Use first product's master for now, assuming order is coherent)
      const masterProductId = details[0].product.masterProductId;

      // Calculate total planned quantity
      const plannedQuantity = details.reduce((sum, d) => sum + d.orderDetail.quantity, 0);

      // 4. Generate Batch Number
      const batchNo = await this.repo.generateBatchNumber();

      // 5. Create Batch (Tentative/Scheduled)
      // Note: Supervisor is NULL, to be assigned later
      // Using expectedDate as scheduledDate
      const scheduledDate = expectedDate.split('T')[0];

      const batch = await this.repo.createBatch({
        batchNo,
        masterProductId,
        scheduledDate,
        plannedQuantity,
        status: 'Scheduled', // Status is Scheduled
        supervisorId: null, // Explicitly null
        createdBy: performedBy,
      });

      // 6. Link Order to Batch
      const orderData = details.map(d => ({
        batchId: batch.batchId,
        orderId: order.orderId,
        orderDetailId: d.orderDetail.orderDetailId,
        productId: d.orderDetail.productId,
        quantity: d.orderDetail.quantity,
        packageCapacityKg: d.product.packageCapacityKg || null,
      }));

      await this.repo.linkOrdersToBatch(batch.batchId, orderData);

      // 7. Update Order Status
      await this.repo.updateOrderStatus(orderId, 'Scheduled for Production', {
        productionBatchId: batch.batchId,
        expectedDeliveryDate: scheduledDate, // Sync delivery date
      });

      // 8. Create Distributions (Tentative)
      // Ideally pass full structure, but createBatchDistributions fetches details internally
      // We just need the orderId wrapper
      await this.createBatchDistributions(batch.batchId, [{ orderId }]);

      // 9. Log Activity
      await this.repo.logBatchActivity(batch.batchId, 'Auto Scheduled', performedBy, {
        newStatus: 'Scheduled',
        notes: `Auto-scheduled order #${order.orderNumber || orderId}`,
      });

      return {
        batchId: batch.batchId,
        batchNo: batch.batchNo,
        status: 'Scheduled',
      };
    } catch (error) {
      logger.error('Error auto-scheduling order', { error: error.message });
      throw error;
    }
  }

  /**
   * Create distributions for batch during scheduling
   * Calculates package requirements based on order weight specifications
   * Creates/updates batch product distributions with weight calculations.
   * Note: Batch products are already created in linkOrdersToBatch.
   * This method enriches them with weight calculations from order details.
   */
  async createBatchDistributions(batchId, batchOrders) {
    logger.info('Updating batch product distributions', {
      batchId,
      orderCount: batchOrders.length,
    });

    for (const batchOrder of batchOrders) {
      // Skip aggregated/internal orders (orderId = 0)
      if (batchOrder.orderId === 0) {
        logger.info(`Skipping for aggregated order (orderId: 0)`);
        continue;
      }

      // Get the order details to calculate weight
      const orderDetailsList = await db
        .select()
        .from(orderDetails)
        .where(eq(orderDetails.orderId, batchOrder.orderId));

      if (!orderDetailsList || orderDetailsList.length === 0) {
        logger.warn(`No order details found for order ${batchOrder.orderId}`);
        continue;
      }

      for (const orderDetail of orderDetailsList) {
        // Get product details
        const [sku] = await db
          .select()
          .from(products)
          .where(eq(products.productId, orderDetail.productId));

        if (!sku) continue;

        const packageCapacityKg = parseFloat(sku.packageCapacityKg || 0);
        const quantity = parseInt(orderDetail.quantity) || 0;
        const plannedWeightKg = quantity * packageCapacityKg;

        // Update existing batch product with weight info
        await db
          .update(batchProducts)
          .set({
            packageCapacityKg: String(packageCapacityKg),
            plannedWeightKg: String(plannedWeightKg),
            updatedAt: new Date(),
          })
          .where(eq(batchProducts.batchId, batchId))
          .where(eq(batchProducts.orderId, batchOrder.orderId))
          .where(eq(batchProducts.productId, orderDetail.productId));

        logger.debug(`Updated batch product weight`, {
          orderId: batchOrder.orderId,
          productId: orderDetail.productId,
          plannedWeight: plannedWeightKg,
        });
      }
    }

    logger.info('Batch distributions update complete', { batchId });
  }

  /**
   * Update expected delivery date for orders
   */
  async updateDeliveryDate(orderIds, deliveryDate, _performedBy) {
    logger.info('Updating delivery dates', { orderIds, deliveryDate });

    await this.repo.updateMultipleOrdersStatus(orderIds, undefined, {
      expectedDeliveryDate: deliveryDate,
    });

    logger.info('Delivery dates updated');

    return { success: true, orderIds, deliveryDate };
  }

  /**
   * Update order details (delivery date, PM remarks)
   */
  async updateOrderDetails(orderId, updates) {
    logger.info('Updating order details', { orderId, updates });

    const existing = await this.repo.getOrderWithDetails(orderId);
    if (!existing.order) {
      throw new AppError('Order not found', 404);
    }

    const updateData = {};
    if (updates.expectedDeliveryDate !== undefined) {
      // PostgreSQL DATE column expects YYYY-MM-DD string format
      updateData.expectedDeliveryDate = updates.expectedDeliveryDate
        ? new Date(updates.expectedDeliveryDate).toISOString().split('T')[0]
        : null;
    }
    if (updates.pmRemarks !== undefined) {
      updateData.pmRemarks = updates.pmRemarks;
    }
    updateData.updatedAt = new Date();

    await this.repo.updateOrderDetails(orderId, updateData);
    logger.info('Order details updated successfully', { orderId });

    return await this.repo.getOrderWithDetails(orderId);
  }

  /**
   * Send order to dispatch (mark as Ready for Dispatch)
   * NOTE: Stock is NOT reserved here - reservation happens when Load checkbox is clicked in Dispatch Planning
   */
  async sendToDispatch(orderId, performedBy) {
    logger.info('Sending order to dispatch', { orderId, performedBy });

    const existing = await this.repo.getOrderWithDetails(orderId);
    if (!existing || !existing.order) {
      throw new AppError('Order not found', 404);
    }

    const allowedStatuses = [
      'Factory Approved',
      'Pending Accounts Approval',
      'Pending Factory Approval',
      'Scheduled for Production',
      'Ready for Dispatch',
      // Legacy status names (existing orders)
      'Accepted',
      'Pending',
      'Verified',
    ];
    if (!allowedStatuses.includes(existing.order.status)) {
      throw new AppError(
        `Order status '${existing.order.status}' is not valid for dispatch. Must be one of: ${allowedStatuses.join(', ')}`,
        400
      );
    }

    const details = existing.details;
    if (!details || details.length === 0) {
      throw new AppError('Order has no items', 400);
    }

    // Just verify order has items - don't check or reserve inventory here
    // Inventory check and reservation happens when Load checkbox is clicked in Dispatch Planning

    // Update order status to Ready for Dispatch
    await this.repo.updateOrderStatus(orderId, 'Ready for Dispatch', {
      updatedAt: new Date(),
    });

    logger.info('Order sent to dispatch successfully', { orderId });

    return { success: true, orderId, status: 'Ready for Dispatch' };
  }

  /**
   * Reserve stock for an order (when Load checkbox is checked in Dispatch Planning)
   */
  async reserveOrderStock(orderId, performedBy) {
    logger.info('Reserving stock for order', { orderId, performedBy });

    const existing = await this.repo.getOrderWithDetails(orderId);
    if (!existing || !existing.order) {
      throw new AppError('Order not found', 404);
    }

    const details = existing.details;
    if (!details || details.length === 0) {
      throw new AppError('Order has no items', 400);
    }

    // Check inventory availability before reserving
    const productIds = details.map(d => d.orderDetail.productId);
    const productsData = await this.repo.checkInventoryForProducts(productIds);

    for (const d of details) {
      const pData = productsData.find(p => p.product.productId === d.orderDetail.productId);
      if (!pData) {
        throw new AppError(`Product ${d.orderDetail.productId} not found`, 404);
      }

      const available = Math.max(0, parseFloat(pData.product.availableQuantity) || 0);
      const reserved = Math.max(0, parseFloat(pData.product.reservedQuantity) || 0);
      const orderQty = parseFloat(d.orderDetail.quantity) || 0;
      const freeQty = Math.max(0, available - reserved);

      if (freeQty < orderQty) {
        throw new AppError(
          `Insufficient inventory for product ${pData.product.productName}. Required: ${orderQty}, Free: ${freeQty}`,
          400
        );
      }
    }

    // Reserve inventory for each product
    for (const d of details) {
      await this.repo.reserveInventory(d.orderDetail.productId, d.orderDetail.quantity);
      logger.info('Reserved inventory', {
        orderId,
        productId: d.orderDetail.productId,
        quantity: d.orderDetail.quantity,
      });
    }

    return { success: true, orderId, message: 'Stock reserved' };
  }

  /**
   * Release reserved stock for an order (when Load checkbox is unchecked in Dispatch Planning)
   */
  async releaseOrderStock(orderId, performedBy) {
    logger.info('Releasing reserved stock for order', { orderId, performedBy });

    const existing = await this.repo.getOrderWithDetails(orderId);
    if (!existing || !existing.order) {
      throw new AppError('Order not found', 404);
    }

    const details = existing.details;
    if (!details || details.length === 0) {
      throw new AppError('Order has no items', 400);
    }

    // Release reserved inventory for each product
    for (const d of details) {
      await this.repo.releaseReservedInventory(d.orderDetail.productId, d.orderDetail.quantity);
      logger.info('Released reserved inventory', {
        orderId,
        productId: d.orderDetail.productId,
        quantity: d.orderDetail.quantity,
      });
    }

    return { success: true, orderId, message: 'Stock released' };
  }

  /**
   * Get all batches with optional filters
   */
  async getAllBatches(filters = {}) {
    logger.info('Fetching all batches', { filters });
    return await this.repo.getAllBatches(filters);
  }

  /**
   * Get batch details by ID
   */
  async getBatchDetails(batchId) {
    logger.info('Fetching batch details', { batchId });

    const batch = await this.repo.getBatchById(batchId);

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    return batch;
  }

  /**
   * Update batch details
   */
  async updateBatch(batchId, updates, performedBy) {
    logger.info('Updating batch', { batchId, updates });

    const batch = await this.repo.getBatchById(batchId);

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    if (batch.batch.status !== 'Scheduled') {
      throw new AppError('Can only update scheduled batches', 400);
    }

    const updatedBatch = await this.repo.updateBatch(batchId, updates);

    // Log activity
    await this.repo.logBatchActivity(batchId, 'Batch Updated', performedBy, {
      notes: 'Batch details updated',
      metadata: updates,
    });

    logger.info('Batch updated successfully', { batchId });

    return updatedBatch[0];
  }

  /**
   * Cancel a scheduled batch
   * Note: Neon-HTTP driver doesn't support transactions, so operations are performed sequentially.
   */
  async cancelBatch(batchId, reason, performedBy) {
    logger.info('Cancelling batch', { batchId, reason });

    const batch = await this.repo.getBatchById(batchId);

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    if (batch.batch.status === 'Completed') {
      throw new AppError('Cannot cancel completed batch', 400);
    }

    // Release reserved raw materials back to masterProductRM.availableQty
    for (const material of batch.materials) {
      await this.repo.releaseRawMaterial(
        material.batchMaterial.materialId,
        material.batchMaterial.requiredQuantity
      );
      logger.info('Raw material released', {
        materialId: material.batchMaterial.materialId,
        quantity: material.batchMaterial.requiredQuantity,
      });
    }

    // Cancel batch
    await this.repo.cancelBatch(batchId, performedBy, reason);

    // Revert orders to Factory Approved status
    const orderIds = batch.orders.map(o => o.batchProduct.orderId);
    await this.repo.updateMultipleOrdersStatus(orderIds, 'Factory Approved', {
      productionBatchId: null,
      pmRemarks: `Previous batch cancelled: ${reason}`,
    });

    // Log activity
    await this.repo.logBatchActivity(batchId, 'Batch Cancelled', performedBy, {
      previousStatus: batch.batch.status,
      newStatus: 'Cancelled',
      notes: reason,
    });

    logger.info('Batch cancelled successfully', { batchId });

    return { success: true, batchId, reason };
  }

  /**
   * Calculate BOM for multiple orders
   */
  async calculateConsolidatedBOM(orders) {
    logger.info('Calculating consolidated BOM for multiple orders', { orders });

    const materialMap = new Map();
    const productsWithoutBOM = [];

    for (const order of orders) {
      logger.info('Fetching BOM for product', {
        productId: order.productId,
        quantity: order.quantity,
      });
      const bomItems = await this.repo.getBomForProduct(order.productId, order.quantity);

      logger.info('BOM items found', { productId: order.productId, itemCount: bomItems.length });

      if (bomItems.length === 0) {
        logger.warn('No BOM configured for product', { productId: order.productId });
        productsWithoutBOM.push(order.productId);
      }

      for (const item of bomItems) {
        if (materialMap.has(item.materialId)) {
          const existing = materialMap.get(item.materialId);
          existing.requiredQuantity += item.requiredQuantity;
        } else {
          materialMap.set(item.materialId, { ...item });
        }
      }
    }

    const result = Array.from(materialMap.values());
    logger.info('Consolidated BOM calculated', {
      totalMaterials: result.length,
      productsWithoutBOM,
    });

    if (result.length === 0 && productsWithoutBOM.length > 0) {
      throw new AppError(
        `No BOM configured for product IDs: ${productsWithoutBOM.join(', ')}. Only finished goods with configured BOMs can be used for batch production.`,
        400
      );
    }

    return result;
  }

  /**
   * Get planning dashboard data
   */
  async getPlanningDashboardData() {
    logger.info('Fetching planning dashboard data');
    const data = await this.repo.getPlanningDashboardData();

    // Process data to calculate production needs
    const processedData = await Promise.all(
      data.map(async item => {
        const totalOrderQty = Math.max(0, parseFloat(item.totalOrderQty) || 0);
        const availableQty = Math.max(0, parseFloat(item.availableQty) || 0);

        // Fetch latest Product Development data for this Master Product
        // This is crucial for new products that might not have density set in Master FG yet
        const devData = await this.repo.getProductDevelopmentData(item.masterProductId);

        // Production qty is always non-negative
        let productionQty = 0;
        if (availableQty < totalOrderQty) {
          productionQty = Math.max(0, totalOrderQty - availableQty);
        }

        let packageCapacityKg = parseFloat(item.packageCapacityKg) || 0;

        // DENSITY RESOLUTION LOGIC
        // 1. filingDensity (SKU specific override)
        // 2. devData.density (Latest formula from R&D - most accurate for new products)
        // 3. fgDensity (Master Product default)

        const fillingDensity = parseFloat(item.fillingDensity) || 0;
        const devDensity = parseFloat(devData?.density) || 0;
        const masterDensity = parseFloat(item.density) || 0; // This comes from masterProductFG via query alias

        // Determine which density to use for calculations
        // We prioritize SKU specific -> Development -> Master default
        let densityToUse = 0;
        if (fillingDensity > 0) {
          densityToUse = fillingDensity;
        } else if (devDensity > 0) {
          densityToUse = devDensity;
        } else {
          densityToUse = masterDensity;
        }

        const pmCapacity = parseFloat(item.pmCapacity) || 0;
        const expectedCapacity = pmCapacity > 0 && densityToUse > 0 ? pmCapacity * densityToUse : 0;

        // Auto-fix: Calculate and persist package capacity if missing OR mismatched (stale)
        // We use a small tolerance (0.01) for float comparison
        let shouldUpdate = false;
        if (expectedCapacity > 0) {
          if (packageCapacityKg <= 0) {
            shouldUpdate = true;
          } else if (Math.abs(packageCapacityKg - expectedCapacity) > 0.01) {
            shouldUpdate = true;
            logger.info(`Detected stale package capacity for product ${item.productId}`, {
              stored: packageCapacityKg,
              expected: expectedCapacity,
              pmCapacity,
              fillingDensity,
              devDensity,
              masterDensity,
              used: densityToUse,
            });
          }
        }

        if (shouldUpdate) {
          packageCapacityKg = expectedCapacity;
          logger.info(`Auto-fixing package packageCapacityKg for product ${item.productId}`, {
            newCapacity: packageCapacityKg,
            densityUsed: densityToUse,
            source: fillingDensity > 0 ? 'SKU' : devDensity > 0 ? 'Dev' : 'Master',
          });

          // Persist to database
          try {
            await this.repo.updateProduct(item.productId, {
              packageCapacityKg: String(packageCapacityKg),
            });
            logger.info(`Persisted updated package capacity for product ${item.productId}`);
          } catch (err) {
            logger.error(`Failed to persist package capacity for product ${item.productId}`, {
              error: err.message,
            });
          }
        }

        console.log(`[PM Dashboard] Product: ${item.productName} (ID: ${item.productId})`);
        console.log(`  - Total Order Qty: ${totalOrderQty}`);
        console.log(`  - Available Qty: ${availableQty}`);
        console.log(`  - Production Qty (Calc): ${productionQty}`);
        console.log(
          `  - Package Capacity (kg): ${item.packageCapacityKg} -> Parsed: ${packageCapacityKg}`
        );
        console.log(
          `  - Densities: SKU=${fillingDensity} | Dev=${devDensity} | Master=${masterDensity} | USED=${densityToUse}`
        );

        const productionWeight = productionQty * packageCapacityKg;
        console.log(`  - Calculated Production Weight: ${productionWeight}`);

        return {
          ...item,
          packageCapacityKg, // Ensure we return the repaired value
          density: densityToUse, // Return the resolved density for frontend display
          devDensity, // Return specific densities for debugging/info if needed
          fillingDensity,
          masterDensity,
          totalOrderQty,
          availableQty,
          productionQty,
          productionWeight,
        };
      })
    );

    return processedData;
  }

  /**
   * Check production feasibility for a product
   */
  async checkProductionFeasibility(productId, productionQty) {
    logger.info('Checking production feasibility', { productId, productionQty });

    const bomItems = await this.repo.getBomForProduct(productId, productionQty);

    const materialsAvailable = bomItems.every(
      item => item.availableQuantity >= item.requiredQuantity
    );

    return {
      productId,
      productionQty,
      feasible: materialsAvailable,
      materials: bomItems,
    };
  }

  /**
   * Check feasibility for a group of products (aggregate RM check)
   */
  async checkGroupFeasibility(products) {
    logger.info('Checking group feasibility', { count: products.length });

    const materialMap = new Map();

    // Aggregate requirements based on Production Qty
    // Logic:
    // 1. getBomForProduct calculates requirement based on percentage vs Input Qty
    // 2. Input Qty here is "Production Qty" (Total - Available) passed from frontend
    for (const p of products) {
      if (p.quantity <= 0) continue;

      const bomItems = await this.repo.getBomForProduct(p.productId, p.quantity);
      // bomItems already has requiredQuantity = (percentage / 100) * quantity

      for (const item of bomItems) {
        if (materialMap.has(item.materialId)) {
          const existing = materialMap.get(item.materialId);
          existing.requiredQuantity += item.requiredQuantity;
        } else {
          materialMap.set(item.materialId, { ...item });
        }
      }
    }

    const aggregatedMaterials = Array.from(materialMap.values()).map(item => ({
      ...item,
      availableQuantity: Math.max(0, item.availableQuantity || 0),
      requiredQuantity: Math.max(0, item.requiredQuantity || 0),
    }));

    // Check availability against aggregated requirements
    const materialsAvailable = aggregatedMaterials.every(
      item => item.availableQuantity >= item.requiredQuantity
    );

    // If no materials found (no recipe), mark as not feasible to prevent creation
    if (aggregatedMaterials.length === 0) {
      return {
        feasible: false,
        materials: [],
        noRecipe: true,
      };
    }

    return {
      feasible: materialsAvailable,
      materials: aggregatedMaterials,
    };
  }

  /**
   * Complete a production batch
   * - Updates batch with actual production data
   * - Records actual material consumption
   * - Deducts inventory for consumed materials
   * - Updates linked orders to 'Ready for Dispatch'
   */
  async completeBatch(batchId, completionData, performedBy) {
    try {
      // 1. Calculate actual time in hours from start/end timestamps
      let actualTimeHours = null;
      if (completionData.startedAt && completionData.completedAt) {
        const start = new Date(completionData.startedAt);
        const end = new Date(completionData.completedAt);
        const diffMs = end.getTime() - start.getTime();
        actualTimeHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }

      // PRE-VALIDATION: Validate formulation balance and positive quantities
      // Note: Trace materials with very small formulation percentages may have
      // requiredQuantity rounded to 0.0000 in the database (numeric(18,4) precision).
      // These materials must be allowed through validation — they are legitimate
      // formulation components, not user errors.
      const TRACE_THRESHOLD = 0.0001; // Minimum non-zero value at scale 4
      let totalReduced = 0;
      let totalAdded = 0;

      if (completionData.materials && completionData.materials.length > 0) {
        for (const m of completionData.materials) {
          const planned = parseFloat(m.plannedQuantity) || 0;
          const actual = parseFloat(m.actualQuantity) || 0;

          // Diagnostic logging for batch completion validation
          logger.info('Batch completion material validation', {
            materialId: m.materialId,
            rawPlannedQuantity: m.plannedQuantity,
            rawActualQuantity: m.actualQuantity,
            parsedPlanned: planned,
            parsedActual: actual,
            isAdditional: m.isAdditional,
            plannedType: typeof m.plannedQuantity,
            actualType: typeof m.actualQuantity,
          });

          if (actual < 0) {
            throw new AppError(`Cannot complete batch: Material quantity cannot be negative.`, 400);
          }

          if (m.isAdditional === false) {
            // Only reject zero actual quantity when planned quantity is meaningful.
            // Trace materials (planned <= TRACE_THRESHOLD) are skipped — their
            // zero value is due to database decimal precision, not a user error.
            if (actual === 0 && planned > TRACE_THRESHOLD) {
              throw new AppError(
                `Cannot complete batch: Final quantity for standard material ${m.materialId} cannot be zero.`,
                400
              );
            }
            if (actual > planned && planned > TRACE_THRESHOLD) {
              throw new AppError(
                `Cannot complete batch: Final quantity for standard material ${m.materialId} cannot exceed planned quantity.`,
                400
              );
            }
            totalReduced += Math.max(0, planned - actual);
          } else {
            if (actual === 0) {
              throw new AppError(
                `Cannot complete batch: Quantity for added material ${m.materialId} cannot be zero.`,
                400
              );
            }
            totalAdded += actual;
          }
        }
        logger.info('Batch completion validation summary', { totalReduced, totalAdded });
      }

      // Allow complete batch without forcing additions to be less than or equal to reductions

      // PRE-VALIDATION: Check extra materials stock BEFORE updating batch
      let extraMaterials = [];
      if (completionData.materials && completionData.materials.length > 0) {
        extraMaterials = completionData.materials.filter(m => m.isAdditional === true);

        if (extraMaterials.length > 0) {
          logger.info('Validating stock for extra materials', { count: extraMaterials.length });

          // Group and aggregate by materialId to handle duplicate materials correctly
          const aggregatedMaterialsMap = new Map();
          for (const m of extraMaterials) {
            const mId = m.materialId;
            const qty = parseFloat(m.actualQuantity) || 0;
            if (aggregatedMaterialsMap.has(mId)) {
              aggregatedMaterialsMap.set(mId, aggregatedMaterialsMap.get(mId) + qty);
            } else {
              aggregatedMaterialsMap.set(mId, qty);
            }
          }

          const materialsToCheck = Array.from(aggregatedMaterialsMap.entries()).map(
            ([materialId, requiredQuantity]) => ({
              materialId,
              requiredQuantity,
            })
          );

          const insufficientMaterials =
            await this.repo.checkMultipleMaterialsStock(materialsToCheck);

          if (insufficientMaterials.length > 0) {
            const errorDetails = insufficientMaterials
              .map(
                m =>
                  `${m.materialName}: Required ${m.required.toFixed(3)} kg, Available ${m.available.toFixed(3)} kg`
              )
              .join(', ');

            logger.warn('Insufficient stock for extra materials', { insufficientMaterials });

            throw new AppError(
              `Cannot complete batch: Insufficient stock for extra materials. ${errorDetails}`,
              400
            );
          }
        }
      }

      // PRE-VALIDATION: Check output SKUs constraints
      if (completionData.outputSkus && completionData.outputSkus.length > 0) {
        // Validate that at least one SKU has producedUnits > 0
        const hasValidOutput = completionData.outputSkus.some(
          sku => parseInt(sku.producedUnits) > 0
        );

        if (!hasValidOutput) {
          throw new AppError(
            'Please enter at least one SKU quantity greater than 0 in Finished Goods Output',
            400
          );
        }

        // Validate total output weight is within ±5% of actual batch weight
        const actualBatchWeight =
          completionData.actualQuantity && completionData.actualDensity
            ? parseFloat(completionData.actualQuantity) * parseFloat(completionData.actualDensity)
            : parseFloat(completionData.actualQuantity) || 0;

        let totalOutputWeight = 0;

        for (const sku of completionData.outputSkus) {
          // const units = parseInt(sku.producedUnits) || 0;
          const weight = parseFloat(sku.weightKg) || 0;
          totalOutputWeight += weight;
        }

        const tolerance = actualBatchWeight * 0.05; // 5% tolerance
        const minWeight = actualBatchWeight - tolerance;
        const maxWeight = actualBatchWeight + tolerance;

        if (totalOutputWeight > maxWeight) {
          throw new AppError(
            `Total packed output weight (${totalOutputWeight.toFixed(2)} kg) exceeds the produced batch weight (${actualBatchWeight.toFixed(2)} kg) by more than 5% (maximum allowed: ${maxWeight.toFixed(2)} kg). Batch weight = Actual Quantity × Actual Density, so please re-check the Actual Density and Actual Quantity — a very low density makes the batch weight too small.`,
            400
          );
        }
      }

      // 2. Calculate actual weight
      const actualWeightKg =
        completionData.actualQuantity && completionData.actualDensity
          ? (
              parseFloat(completionData.actualQuantity) * parseFloat(completionData.actualDensity)
            ).toFixed(4)
          : null;

      // Note: Raw materials are already deducted at scheduling time from masterProductRM.availableQty
      // At completion, we only need to handle variance (if actual consumption differs from planned)

      // 3. Update batch with actual data
      const batchUpdate = {
        actualQuantity: completionData.actualQuantity,
        actualDensity: completionData.actualDensity,
        actualWeightKg,
        actualWaterPercentage: completionData.actualWaterPercentage,
        actualViscosity: completionData.actualViscosity,
        startedAt: completionData.startedAt ? new Date(completionData.startedAt) : null,
        completedAt: completionData.completedAt ? new Date(completionData.completedAt) : null,
        actualTimeHours,
        productionRemarks: completionData.productionRemarks,
        completedBy: performedBy,
      };

      const [completedBatch] = await this.repo.completeBatch(batchId, batchUpdate);
      logger.info('Batch completed', { batchId, batchNo: completedBatch?.batchNo });

      // 4a. Handle standard materials (reductions) at completion
      if (completionData.materials && completionData.materials.length > 0) {
        const standardMaterials = completionData.materials.filter(m => m.isAdditional === false);
        for (const mat of standardMaterials) {
          const plannedQty = parseFloat(mat.plannedQuantity) || 0;
          const actualQty = parseFloat(mat.actualQuantity) || 0;
          const diff = plannedQty - actualQty;

          if (diff > 0) {
            logger.info('Processing reduced material at completion', {
              materialId: mat.materialId,
              plannedQuantity: plannedQty,
              actualQuantity: actualQty,
              reducedAmount: diff,
            });

            // Update requiredQuantity in batch_materials table to the final adjusted quantity
            await db
              .update(batchMaterials)
              .set({ requiredQuantity: String(actualQty) })
              .where(eq(batchMaterials.batchMaterialId, mat.batchMaterialId));

            // Release the reduced quantity back to inventory (add back to availableQty)
            await this.repo.releaseRawMaterial(mat.materialId, diff);
          }
        }
      }

      // 4. Handle materials at completion
      if (extraMaterials.length > 0) {
        logger.info('Processing extra materials at completion', { count: extraMaterials.length });

        // Clear out any previously recorded additional materials for this batch to prevent duplicates on completion retries
        await db
          .delete(batchMaterials)
          .where(and(eq(batchMaterials.batchId, batchId), eq(batchMaterials.isAdditional, true)));

        // Deduct stock and create batch_materials records for extra materials
        // Stock check already passed in validation
        for (const mat of extraMaterials) {
          const qty = parseFloat(mat.actualQuantity) || 0;

          // Reserve (deduct) from raw material stock without generating inline transaction logs
          await this.repo.reserveRawMaterial(mat.materialId, qty, null, null);
          logger.info('Extra material stock deducted', {
            materialId: mat.materialId,
            quantity: qty,
          });

          // Add to batch_materials table
          await this.repo.addMaterialsToBatch(batchId, [
            {
              materialId: mat.materialId,
              requiredQuantity: qty,
              isAdditional: true,
            },
          ]);
          logger.info('Extra material added to batch_materials', {
            materialId: mat.materialId,
            quantity: qty,
          });
        }
      }

      // 4b. Update Finished Goods Output (Actual Production)
      if (completionData.outputSkus && completionData.outputSkus.length > 0) {
        // Validations already done

        logger.info('Updating finished goods output', { count: completionData.outputSkus.length });

        for (const sku of completionData.outputSkus) {
          const producedUnits = parseInt(sku.producedUnits) || 0;

          // Check if this SKU was already planned in batch_products
          const existingBp = await db
            .select()
            .from(batchProducts)
            .where(
              and(eq(batchProducts.batchId, batchId), eq(batchProducts.productId, sku.productId))
            )
            .limit(1);

          // If no produced units and not planned (MTS), skip
          if (producedUnits <= 0 && existingBp.length === 0) {
            continue;
          }

          let batchProductId;
          const weightKg = parseFloat(sku.weightKg);
          // Note: weightKg should be calculated as Produced Units * Package Capacity
          // But here we might just take what frontend sends or calculate:
          // We need packageCapacity. Let's assume frontend sends correct weight or we fetch it.
          // Ideally we fetch product to get capacity again to be safe.
          const [productInfo] = await db
            .select({ packageCapacityKg: products.packageCapacityKg })
            .from(products)
            .where(eq(products.productId, sku.productId));

          const pkgCap = parseFloat(productInfo?.packageCapacityKg || 0);
          const producedWeightKg = (producedUnits * pkgCap).toFixed(4);

          if (existingBp.length > 0) {
            // Update existing entry (even if producedUnits is 0)
            batchProductId = existingBp[0].batchProductId;
            await db
              .update(batchProducts)
              .set({
                producedUnits,
                producedWeightKg,
                inventoryUpdated: true,
                inventoryUpdatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(batchProducts.batchProductId, batchProductId));
          } else {
            // Create new entry (MTS) - only if > 0 (handled by check above)
            const [newBp] = await db
              .insert(batchProducts)
              .values({
                batchId,
                productId: sku.productId,
                orderId: null, // Make to stock
                plannedUnits: 0, // Wasn't planned
                packageCapacityKg: pkgCap,
                plannedWeightKg: 0,
                producedUnits,
                producedWeightKg,
                fulfillmentType: 'MAKE_TO_STOCK',
                inventoryUpdated: true,
                inventoryUpdatedAt: new Date(),
              })
              .returning();
            batchProductId = newBp.batchProductId;
          }

          // Add to inventory
          await this.repo.addInventory(
            sku.productId,
            producedUnits,
            producedWeightKg,
            batchId,
            performedBy
          );
          logger.info('Added produced units to inventory', {
            productId: sku.productId,
            units: producedUnits,
            weight: producedWeightKg,
          });

          // Deduct Packaging Material inventory
          // Each SKU has a packagingId linking to master_product_pm
          const packagingId = await this.repo.getProductPackagingId(sku.productId);
          if (packagingId && producedUnits > 0) {
            await this.repo.deductPackagingMaterial(packagingId, producedUnits);
            logger.info('Deducted packaging material from inventory', {
              packagingId,
              quantity: producedUnits,
            });
          }
        }
      }

      // 5. Update linked orders to 'Ready for Dispatch' AND Add FG Inventory (Legacy/Planned logic)
      // Note: We modified step 5 to rely on step 4b if outputSkus is present.
      // But if outputSkus is NOT sent (legacy frontend), we fall back to plannedUnits.
      // Or we should prevent double counting.
      // Let's assume: If outputSkus is sent, we use that. If not, we run the old loop (lines 926-941).

      if (!completionData.outputSkus || completionData.outputSkus.length === 0) {
        // Legacy path: Auto-add planned units as produced
        const batchProductsList = await this.repo.getBatchProducts(batchId);
        for (const bp of batchProductsList) {
          if (bp.productId && bp.plannedUnits > 0 && !bp.inventoryUpdated) {
            await this.repo.addInventory(
              bp.productId,
              bp.plannedUnits,
              bp.plannedWeightKg,
              batchId,
              performedBy
            );
            // Mark as updated
            await db
              .update(batchProducts)
              .set({
                inventoryUpdated: true,
                inventoryUpdatedAt: new Date(),
                producedUnits: bp.plannedUnits,
              })
              .where(eq(batchProducts.batchProductId, bp.batchProductId));

            logger.info('Auto-added planned FG to inventory (legacy path)', {
              productId: bp.productId,
              qty: bp.plannedUnits,
            });

            // Deduct Packaging Material inventory (legacy path)
            const packagingId = await this.repo.getProductPackagingId(bp.productId);
            if (packagingId && bp.plannedUnits > 0) {
              await this.repo.deductPackagingMaterial(packagingId, bp.plannedUnits);
              logger.info('Deducted packaging material (legacy path)', {
                packagingId,
                quantity: bp.plannedUnits,
              });
            }
          }
        }
      }

      // Fetch fresh list for order status check logic
      const batchProductsList = await this.repo.getBatchProducts(batchId);

      const orderIds = [
        ...new Set(
          batchProductsList.filter(bp => bp.orderId && bp.orderId > 0).map(bp => bp.orderId)
        ),
      ];

      if (orderIds.length > 0) {
        // Smart status update: Only mark as 'Ready for Dispatch' if ALL batches for the order are completed
        const ordersToDispatch = [];

        for (const orderId of orderIds) {
          // Check if this order has products in other batches
          const allBatchesForOrder = await db
            .select()
            .from(batchProducts)
            .where(eq(batchProducts.orderId, orderId));

          // Get unique batch IDs for this order
          const batchIds = [...new Set(allBatchesForOrder.map(bp => bp.batchId))];

          // Check status of all batches
          let allBatchesCompleted = true;
          for (const bId of batchIds) {
            const batchData = await this.repo.getBatchById(bId);
            if (batchData && batchData.batch && batchData.batch.status !== 'Completed') {
              allBatchesCompleted = false;
              break;
            }
          }

          if (allBatchesCompleted) {
            ordersToDispatch.push(orderId);
          } else {
            logger.info('Order has incomplete batches. Keeping status as Scheduled.', {
              orderId,
              totalBatches: batchIds.length,
              completedBatch: batchId,
            });
          }
        }

        if (ordersToDispatch.length > 0) {
          await this.repo.updateMultipleOrdersStatus(ordersToDispatch, 'Ready for Dispatch');
          logger.info('Orders updated to Ready for Dispatch', { orderIds: ordersToDispatch });
        }
      }

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
            const qty = parseFloat(mat.requiredQuantity) || 0;
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
                  notes: `Consolidated Production Consumption for Batch #${numericBatchId}`,
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
                createdBy: performedBy,
                notes: `Consolidated Production Consumption for Batch #${numericBatchId}`,
              });
            }
          }
        }
      } catch (syncError) {
        logger.error(
          'Failed to synchronize inventory transactions on batch completion:',
          syncError
        );
      }

      // Capture an immutable report snapshot from the just-completed (committed)
      // batch, so the Batch Production Report and Batch Report For Accounts never
      // change when master data is edited later. Non-fatal: never block completion.
      try {
        const snapshot = await new ReportsService().buildBatchReportSnapshot(batchId);
        if (snapshot) {
          await db
            .update(productionBatch)
            .set({ reportSnapshot: snapshot })
            .where(eq(productionBatch.batchId, batchId));
          logger.info('Captured immutable report snapshot for batch', { batchId });
        }
      } catch (snapErr) {
        logger.error(
          'Failed to capture batch report snapshot (reports will fall back to live data):',
          { batchId, error: snapErr.message }
        );
      }

      return {
        batch: completedBatch,
        inventoryDeducted: completionData.materials?.length || 0,
        ordersUpdated: orderIds.length,
      };
    } catch (error) {
      // Preserve intentional, client-facing errors (AppError with their own
      // status — e.g. the 400 mass-balance validation) so the user sees the real,
      // understandable message instead of a generic 500 "Server error".
      if (error instanceof AppError) {
        logger.error('Batch completion rejected', { batchId, error: error.message });
        throw error;
      }
      logger.error('Error completing batch', { batchId, error: error.message });
      throw new AppError('Failed to complete batch: ' + error.message, 500);
    }
  }
}
