/**
 * Production Manager Repository
 *
 * Data access layer for production manager operations.
 * Handles database queries for batch management, inventory checks, and order assessment.
 */

import { db } from '../../db/index.js';
import {
  productionBatch,
  batchProducts,
  batchMaterials,
  batchActivityLog,
  orders,
  orderDetails,
  products,
  productDevelopment,
  productDevelopmentMaterials,
  customers,
  employees,
  masterProducts,
  masterProductFG,
  masterProductPM,
  masterProductRM,
  accounts,
  inventoryTransactions,
} from '../../db/schema/index.js';
import { eq, inArray, sql, desc, asc } from 'drizzle-orm';

export class ProductionManagerRepository {
  // ... (previous methods)

  /**
   * Get BOM requirements for a finished good
   * Fetches formula from Product Development module via Master Product ID
   */
  async getBomForProduct(productId, quantity) {
    // 1. Get Master Product ID for the SKU
    const product = await db
      .select({ masterProductId: products.masterProductId })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);

    if (!product || product.length === 0) return [];

    const masterProductId = product[0].masterProductId;

    // 2. Get latest Product Development formula for this Master Product
    // We assume the latest created formula is the active one for now
    const development = await db
      .select({ developmentId: productDevelopment.developmentId })
      .from(productDevelopment)
      .where(eq(productDevelopment.masterProductId, masterProductId))
      .orderBy(desc(productDevelopment.createdAt))
      .limit(1);

    if (!development || development.length === 0) return [];

    const developmentId = development[0].developmentId;

    // 3. Get materials from the formula (using bomComponents query below)

    // Consolidate duplicates if multiple SKUs exist for same RM (should grab the one with stock?)
    // For now, we map simply. A better approach is to sum available quantity of all SKUs for that RM.

    // We also need to filter to ensure we are looking at the right RM product if multiple exist.
    // Ideally, we sum up availableQuantity for all SKUs of that Master Product.

    // Let's optimize: Get materials, then for each material (Master ID), get total available stock.

    // Revised Query 3: Get BOM structure first
    const bomComponents = await db
      .select({
        materialId: productDevelopmentMaterials.materialId, // This is a MasterProductId
        percentage: productDevelopmentMaterials.percentage,
        materialName: masterProducts.masterProductName,
      })
      .from(productDevelopmentMaterials)
      .leftJoin(
        masterProducts,
        eq(productDevelopmentMaterials.materialId, masterProducts.masterProductId)
      )
      .where(eq(productDevelopmentMaterials.developmentId, developmentId))
      .orderBy(asc(productDevelopmentMaterials.sequence));

    // 4. Calculate requirements and check stock
    const result = [];

    // Get all material master IDs
    const materialMasterIds = bomComponents.map(b => b.materialId);

    if (materialMasterIds.length === 0) return [];

    // Get stock levels for these materials from masterProductRM table
    // Raw materials store their available quantity in masterProductRM.availableQty
    const stockLevels = await db
      .select({
        masterProductId: masterProductRM.masterProductId,
        totalAvailable: sql`COALESCE(${masterProductRM.availableQty}, 0)`.mapWith(Number),
      })
      .from(masterProductRM)
      .where(inArray(masterProductRM.masterProductId, materialMasterIds));

    const stockMap = new Map(stockLevels.map(s => [s.masterProductId, s.totalAvailable]));

    for (const item of bomComponents) {
      const percentage = parseFloat(item.percentage);
      const reqQty = (percentage / 100) * quantity;

      result.push({
        materialId: item.materialId, // Master Product ID of the material
        materialName: item.materialName,
        percentage,
        requiredQuantity: reqQty,
        availableQuantity: stockMap.get(item.materialId) || 0,
      });
    }

    return result;
  }
  async getAcceptedOrders() {
    const ordersData = await db
      .select({
        order: orders,
        customer: customers,
        salesperson: employees,
        account: accounts,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(employees, eq(orders.salespersonId, employees.employeeId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(
        inArray(orders.status, [
          'Factory Approved',
          'Pending Factory Approval',
          // Legacy status names (existing orders)
          'Accepted',
          'Verified',
        ])
      )
      .orderBy(desc(orders.orderDate));

    if (ordersData.length === 0) {
      return [];
    }

    const orderIds = ordersData.map(item => item.order.orderId);

    // Get product counts and types for each order
    const orderProductInfo = await db
      .select({
        orderId: orderDetails.orderId,
        productCount: sql`COUNT(*)`.as('product_count'),
        hasFinishedGoods:
          sql`COUNT(CASE WHEN ${masterProducts.productType} = 'FG' THEN 1 END) > 0`.as('has_fg'),
        hasRawMaterials:
          sql`COUNT(CASE WHEN ${masterProducts.productType} = 'RM' THEN 1 END) > 0`.as('has_rm'),
      })
      .from(orderDetails)
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .where(inArray(orderDetails.orderId, orderIds))
      .groupBy(orderDetails.orderId);

    // Create maps for quick lookup
    const infoMap = new Map(
      orderProductInfo.map(info => [
        info.orderId,
        {
          productCount: parseInt(info.productCount),
          hasFinishedGoods: info.hasFinishedGoods,
          hasRawMaterials: info.hasRawMaterials,
        },
      ])
    );

    // Filter and map orders - only include orders with finished goods
    return ordersData
      .map(item => {
        const info = infoMap.get(item.order.orderId) || {
          productCount: 0,
          hasFinishedGoods: false,
          hasRawMaterials: false,
        };
        // Merge adminRemarks from accounts table into order object
        const orderWithRemarks = {
          ...item.order,
          adminRemarks: item.account?.remarks || item.order.adminRemarks || '',
        };
        return {
          order: orderWithRemarks,
          customer: item.customer,
          salesperson: item.salesperson,
          account: item.account,
          productCount: info.productCount,
          hasFinishedGoods: info.hasFinishedGoods,
          hasRawMaterials: info.hasRawMaterials,
          isEligibleForBatch: info.hasFinishedGoods && !info.hasRawMaterials,
        };
      })
      .filter(item => item.hasFinishedGoods); // Only return orders with finished goods
  }

  /**
   * Get orders eligible for batching (Accepted or Scheduled for Production)
   */
  async getBatchableOrders() {
    const ordersData = await db
      .select({
        order: orders,
        customer: customers,
        salesperson: employees,
        account: accounts,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(employees, eq(orders.salespersonId, employees.employeeId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(
        inArray(orders.status, [
          'Factory Approved',
          'Pending Factory Approval',
          'Scheduled for Production',
          // Legacy status names (existing orders)
          'Accepted',
          'Verified',
        ])
      )
      .orderBy(desc(orders.orderDate));

    if (ordersData.length === 0) {
      return [];
    }
    // ... same logic as getAcceptedOrders to filter for FGs if needed
    // For brevity, assuming batchable orders implies FGs check, but let's replicate the logic to be safe.
    // Actually, reuse the logic via helper or just duplicate for now.
    // Replicating logic:
    const orderIds = ordersData.map(item => item.order.orderId);

    const orderProductInfo = await db
      .select({
        orderId: orderDetails.orderId,
        productCount: sql`COUNT(*)`.as('product_count'),
        hasFinishedGoods:
          sql`COUNT(CASE WHEN ${masterProducts.productType} = 'FG' THEN 1 END) > 0`.as('has_fg'),
        hasRawMaterials:
          sql`COUNT(CASE WHEN ${masterProducts.productType} = 'RM' THEN 1 END) > 0`.as('has_rm'),
      })
      .from(orderDetails)
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .where(inArray(orderDetails.orderId, orderIds))
      .groupBy(orderDetails.orderId);

    const infoMap = new Map(
      orderProductInfo.map(info => [
        info.orderId,
        {
          productCount: parseInt(info.productCount),
          hasFinishedGoods: info.hasFinishedGoods,
          hasRawMaterials: info.hasRawMaterials,
        },
      ])
    );

    return ordersData
      .map(item => {
        const info = infoMap.get(item.order.orderId) || {
          productCount: 0,
          hasFinishedGoods: false,
          hasRawMaterials: false,
        };
        // Merge adminRemarks from accounts table into order object
        const orderWithRemarks = {
          ...item.order,
          adminRemarks: item.account?.remarks || item.order.adminRemarks || '',
        };
        return {
          order: orderWithRemarks,
          customer: item.customer,
          salesperson: item.salesperson,
          account: item.account,
          productCount: info.productCount,
          hasFinishedGoods: info.hasFinishedGoods,
          hasRawMaterials: info.hasRawMaterials,
          isEligibleForBatch: info.hasFinishedGoods && !info.hasRawMaterials,
        };
      })
      .filter(item => item.hasFinishedGoods);
  }

  /**
   * Get order with details including master product and customer information
   */
  async getOrderWithDetails(orderId) {
    // Get order with customer info
    const orderResult = await db
      .select({
        order: orders,
        customer: customers,
        account: accounts,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(eq(orders.orderId, orderId))
      .limit(1);

    let details = [];
    try {
      details = await db
        .select({
          orderDetail: orderDetails,
          product: products,
          masterProduct: masterProducts,
        })
        .from(orderDetails)
        .leftJoin(products, eq(orderDetails.productId, products.productId))
        .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
        .where(eq(orderDetails.orderId, orderId));
    } catch (err) {
      console.error('getOrderWithDetails query error:', err);
      console.error('Original error:', err.cause || err.originalError || 'No original error');
      throw err;
    }

    return {
      order: orderResult[0]?.order,
      customer: orderResult[0]?.customer,
      account: orderResult[0]?.account,
      details,
    };
  }

  /**
   * Check inventory availability for products
   */
  async checkInventoryForProducts(productIds) {
    return await db
      .select({
        product: products,
        productType: masterProducts.productType,
      })
      .from(products)
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .where(inArray(products.productId, productIds));
  }

  /**
   * Create a new batch
   */
  async createBatch(batchData) {
    const [batch] = await db.insert(productionBatch).values(batchData).returning();

    return batch;
  }

  /**
   * Link orders to a batch (using consolidated batchProducts)
   */
  async linkOrdersToBatch(batchId, orderData) {
    const values = orderData.map(item => ({
      batchId,
      productId: item.productId,
      orderId: item.orderId,
      orderDetailId: item.orderDetailId || null,
      plannedUnits: item.quantity !== undefined ? item.quantity : item.plannedUnits || 0,
      packageCapacityKg: item.packageCapacityKg || null,
      plannedWeightKg: item.plannedWeightKg || null,
      fulfillmentType: item.orderId ? 'MAKE_TO_ORDER' : 'MAKE_TO_STOCK',
    }));

    return await db.insert(batchProducts).values(values).returning();
  }

  /**
   * Add materials to batch
   */
  async addMaterialsToBatch(batchId, materials) {
    const values = materials.map(m => ({
      batchId,
      materialId: m.materialId,
      requiredQuantity: m.requiredQuantity,
      requiredUsePer: m.requiredUsePer,
      requiredUseQty: m.requiredUseQty,
      sequence: m.sequence,
      waitingTime: m.waitingTime,
      isAdditional: m.isAdditional,
    }));

    return await db.insert(batchMaterials).values(values).returning();
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status, updates = {}) {
    return await db
      .update(orders)
      .set({
        status,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(orders.orderId, orderId))
      .returning();
  }

  /**
   * Update multiple orders status
   */
  async updateMultipleOrdersStatus(orderIds, status, updates = {}) {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    // Only include status if it's provided
    if (status !== undefined) {
      updateData.status = status;
    }

    return await db
      .update(orders)
      .set(updateData)
      .where(inArray(orders.orderId, orderIds))
      .returning();
  }

  /**
   * Update order details (for PM/Admin edits)
   */
  async updateOrderDetails(orderId, updates) {
    return await db.update(orders).set(updates).where(eq(orders.orderId, orderId)).returning();
  }

  /**
   * Get batch by ID with all related data
   */
  async getBatchById(batchId) {
    const batchResult = await db
      .select({
        batch: productionBatch,
        masterProductName: masterProducts.masterProductName,
        fgDensity: masterProductFG.fgDensity,
        viscosity: masterProductFG.viscosity,
        waterPercentage: masterProductFG.waterPercentage,
        supervisorName: sql`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`.as(
          'supervisor_name'
        ),
      })
      .from(productionBatch)
      .leftJoin(masterProducts, eq(productionBatch.masterProductId, masterProducts.masterProductId))
      .leftJoin(
        masterProductFG,
        eq(productionBatch.masterProductId, masterProductFG.masterProductId)
      )
      .leftJoin(employees, eq(productionBatch.supervisorId, employees.employeeId))
      .where(eq(productionBatch.batchId, batchId))
      .limit(1);

    if (!batchResult.length) return null;

    // Fetch latest product development data for this master product to get calculated values
    const devData = await db
      .select({
        density: productDevelopment.density,
        viscosity: productDevelopment.viscosity,
        waterPercentage: productDevelopment.percentageValue,
      })
      .from(productDevelopment)
      .where(eq(productDevelopment.masterProductId, batchResult[0].batch.masterProductId))
      .orderBy(desc(productDevelopment.createdAt))
      .limit(1);

    const batchData = {
      ...batchResult[0].batch,
      masterProductName: batchResult[0].masterProductName,
      // Use calculated values from Product Development if available, otherwise fallback to Master Product FG defaults
      fgDensity: devData[0]?.density || batchResult[0].fgDensity,
      viscosity: devData[0]?.viscosity || batchResult[0].viscosity,
      waterPercentage: devData[0]?.waterPercentage || batchResult[0].waterPercentage,
      supervisorName: batchResult[0].supervisorName,
    };

    // Join packaging master products and PM details
    const linkedOrders = await db
      .select({
        batchProduct: batchProducts,
        order: orders,
        customer: customers,
        product: products,
        packagingMasterProductName: masterProducts.masterProductName,
        packagingMasterProductId: masterProducts.masterProductId,
        packagingPurchaseCost: masterProductPM.purchaseCost,
        packagingCapacity: masterProductPM.capacity,
      })
      .from(batchProducts)
      .leftJoin(orders, eq(batchProducts.orderId, orders.orderId))
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(products, eq(batchProducts.productId, products.productId))
      .leftJoin(masterProducts, eq(products.packagingId, masterProducts.masterProductId))
      .leftJoin(masterProductPM, eq(products.packagingId, masterProductPM.masterProductId))
      .where(eq(batchProducts.batchId, batchId));

    const materials = await db
      .select({
        batchMaterial: batchMaterials,
        material: products,
        masterProduct: masterProducts,
      })
      .from(batchMaterials)
      .leftJoin(products, eq(batchMaterials.materialId, products.productId))
      .leftJoin(masterProducts, eq(batchMaterials.materialId, masterProducts.masterProductId))
      .where(eq(batchMaterials.batchId, batchId));

    // Fetch all SKUs for this Master Product (for output entry)
    console.log('Fetching relatedSkus for masterProductId:', batchData.masterProductId);
    const relatedSkus = await db
      .select({
        productId: products.productId,
        productName: products.productName,
        packageCapacityKg: products.packageCapacityKg, // Keeping for fallback
        fillingDensity: products.fillingDensity,
        availableQuantity: products.availableQuantity,
        packagingCapacityLtr: masterProductPM.capacity, // Fetching volume in L
      })
      .from(products)
      .leftJoin(masterProductPM, eq(products.packagingId, masterProductPM.masterProductId))
      .where(eq(products.masterProductId, batchData.masterProductId));

    console.log('relatedSkus query result count:', relatedSkus.length);
    console.log('relatedSkus:', relatedSkus);

    return {
      batch: batchData,
      orders: linkedOrders, // This contains ALREADY linked/planned SKus
      materials,
      relatedSkus, // This contains ALL possible SKUs for the master product
    };
  }

  /**
   * Get all batches with filters
   */
  async getAllBatches(filters = {}) {
    let query = db
      .select({
        batchId: productionBatch.batchId,
        batchNo: productionBatch.batchNo,
        masterProductId: productionBatch.masterProductId,
        masterProductName: masterProducts.masterProductName,
        scheduledDate: productionBatch.scheduledDate,
        plannedQuantity: productionBatch.plannedQuantity,
        density: productionBatch.density,
        actualDensity: productionBatch.actualDensity,
        status: productionBatch.status,
        supervisorId: productionBatch.supervisorId,
        supervisorName: sql`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`.as(
          'supervisor_name'
        ),
        pmRemarks: sql`''`.as('pm_remarks'), // Placeholder for now
        labourNames: productionBatch.labourNames,
        timeRequired: productionBatch.timeRequiredHours,
        createdAt: productionBatch.createdAt,
        startedAt: productionBatch.startedAt,
      })
      .from(productionBatch)
      .leftJoin(masterProducts, eq(productionBatch.masterProductId, masterProducts.masterProductId))
      .leftJoin(employees, eq(productionBatch.supervisorId, employees.employeeId))
      .$dynamic();

    if (filters.status) {
      query = query.where(eq(productionBatch.status, filters.status));
    }

    if (filters.supervisorId) {
      query = query.where(eq(productionBatch.supervisorId, filters.supervisorId));
    }

    return await query.orderBy(desc(productionBatch.createdAt));
  }

  /**
   * Log batch activity
   */
  async logBatchActivity(batchId, action, performedBy, data = {}) {
    return await db.insert(batchActivityLog).values({
      batchId,
      action,
      performedBy,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      notes: data.notes,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    });
  }

  /**
   * Generate batch number
   */
  async generateBatchNumber() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const latestBatch = await db
      .select({ batchNo: productionBatch.batchNo })
      .from(productionBatch)
      .orderBy(desc(productionBatch.createdAt))
      .limit(1);

    let nextSeq = 1;

    if (latestBatch.length > 0) {
      try {
        const parts = latestBatch[0].batchNo.split('-');
        const lastSeq = parseInt(parts[0], 10);

        if (!Number.isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      } catch (err) {
        console.error('Error parsing previous batch number:', err);
      }
    }

    if (nextSeq > 9999) {
      nextSeq = 1;
    }

    const nextSeqStr = String(nextSeq).padStart(4, '0');
    return `${nextSeqStr}-${month}-${year}`;
  }

  /**
   * Update batch
   */
  async updateBatch(batchId, updates) {
    return await db
      .update(productionBatch)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(productionBatch.batchId, batchId))
      .returning();
  }

  /**
   * Cancel batch
   */
  async cancelBatch(batchId, cancelledBy, reason) {
    return await db
      .update(productionBatch)
      .set({
        status: 'Cancelled',
        cancelledBy,
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(productionBatch.batchId, batchId))
      .returning();
  }

  /**
   * Release reserved inventory (never go below 0)
   */
  async releaseReservedInventory(materialId, quantity) {
    return await db
      .update(products)
      .set({
        reservedQuantity: sql`GREATEST(0, COALESCE(${products.reservedQuantity}, 0) - ${quantity})`,
        updatedAt: new Date(),
      })
      .where(eq(products.productId, materialId))
      .returning();
  }

  /**
   * Get planning dashboard data (aggregated orders and inventory)
   */
  async getPlanningDashboardData() {
    const result = await db
      .select({
        productId: products.productId,
        productName: products.productName,
        masterProductName: sql`COALESCE(${masterProducts.masterProductName}, 'Uncategorized')`.as(
          'master_product_name'
        ),
        masterProductId: sql`COALESCE(${masterProducts.masterProductId}, 0)`
          .mapWith(Number)
          .as('master_product_id'),
        totalOrderQty: sql`SUM(${orderDetails.quantity})`.mapWith(Number).as('total_order_qty'),
        availableQty: products.availableQuantity,
        reservedQty: products.reservedQuantity,

        packageCapacityKg: products.packageCapacityKg,
        // Use fillingDensity from products table, fallback to masterProductFG.fgDensity, then 0
        fillingDensity: sql`COALESCE(${products.fillingDensity}, ${masterProductFG.fgDensity}, 0)`
          .mapWith(Number)
          .as('filling_density'),
        density: sql`COALESCE(${products.fillingDensity}, 0)`.mapWith(Number).as('density'),
        pmCapacity: sql`COALESCE(${masterProductPM.capacity}, 0)`.mapWith(Number).as('pm_capacity'),
        orderIds: sql`array_agg(${orderDetails.orderId})`.as('order_ids'),
      })
      .from(orderDetails)
      .leftJoin(orders, eq(orderDetails.orderId, orders.orderId))
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .leftJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
      .leftJoin(
        masterProductFG,
        eq(masterProducts.masterProductId, masterProductFG.masterProductId)
      )
      .leftJoin(masterProductPM, eq(products.packagingId, masterProductPM.masterProductId))
      .where(sql`${orders.status} IN ('Scheduled for Production', 'Ready for Dispatch')`)
      .groupBy(
        products.productId,
        products.productName,
        masterProducts.masterProductName,
        masterProducts.masterProductId,
        products.availableQuantity,
        products.reservedQuantity,
        products.reservedQuantity,
        products.packageCapacityKg,
        masterProductFG.fgDensity,
        masterProductPM.capacity
      );

    return result;
  }

  /**
   * Update product details (internal use)
   */
  async updateProduct(productId, updates) {
    return await db
      .update(products)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(products.productId, productId))
      .returning();
  }

  /**
   * Complete a batch with actual production data
   */
  async completeBatch(batchId, completionData) {
    return await db
      .update(productionBatch)
      .set({
        actualQuantity: completionData.actualQuantity,
        actualDensity: completionData.actualDensity,
        actualWeightKg: completionData.actualWeightKg,
        actualWaterPercentage: completionData.actualWaterPercentage,
        actualViscosity: completionData.actualViscosity,
        startedAt: completionData.startedAt,
        completedAt: completionData.completedAt,
        actualTimeHours: completionData.actualTimeHours,
        productionRemarks: completionData.productionRemarks,
        status: 'Completed',
        completedBy: completionData.completedBy,
        updatedAt: new Date(),
      })
      .where(eq(productionBatch.batchId, batchId))
      .returning();
  }

  /**
   * Get raw material stock from masterProductRM table
   * Used for validating stock availability before batch start or completion
   */
  async getRawMaterialStock(masterProductId) {
    const result = await db
      .select({
        masterProductId: masterProductRM.masterProductId,
        availableQty: masterProductRM.availableQty,
      })
      .from(masterProductRM)
      .where(eq(masterProductRM.masterProductId, masterProductId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Check stock availability for multiple materials
   * Returns array of materials with insufficient stock
   */
  async checkMultipleMaterialsStock(materials) {
    const insufficientMaterials = [];

    // Defensive check for empty or undefined materials
    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return insufficientMaterials;
    }

    for (const mat of materials) {
      // Skip if materialId is missing
      if (!mat.materialId) {
        continue;
      }

      const stock = await this.getRawMaterialStock(mat.materialId);
      const availableQty = parseFloat(stock?.availableQty || 0);
      const requiredQty = parseFloat(mat.requiredQuantity || mat.quantity || 0);

      if (availableQty < requiredQty) {
        // Get material name
        const materialInfoResult = await db
          .select({ masterProductName: masterProducts.masterProductName })
          .from(masterProducts)
          .where(eq(masterProducts.masterProductId, mat.materialId))
          .limit(1);

        const materialInfo = materialInfoResult[0];

        insufficientMaterials.push({
          materialId: mat.materialId,
          materialName: materialInfo?.masterProductName || 'Unknown Material',
          required: requiredQty,
          available: availableQty,
          shortfall: requiredQty - availableQty,
        });
      }
    }

    return insufficientMaterials;
  }

  /**
   * Deduct inventory for a material (never go below 0)
   */
  async deductInventory(materialId, quantity) {
    // Try to deduct from products table (ensure non-negative)
    await db
      .update(products)
      .set({
        availableQuantity: sql`GREATEST(0, COALESCE(${products.availableQuantity}, 0) - ${quantity})`,
        updatedAt: new Date(),
      })
      .where(eq(products.productId, materialId));

    // Also try to deduct from master_products RM table (if materialId is a master product ID)
    await db
      .update(masterProductRM)
      .set({
        availableQty: sql`GREATEST(0, COALESCE(${masterProductRM.availableQty}, 0) - ${quantity})`,
        stockQuantity: sql`GREATEST(0, COALESCE(${masterProductRM.stockQuantity}, 0) - ${quantity})`,
      })
      .where(eq(masterProductRM.masterProductId, materialId));
  }

  /**
   * Add inventory for a product (Finished Good)
   */
  async addInventory(productId, quantity, weightKg = null, batchId = null, performedBy = null) {
    const updateData = {
      availableQuantity: sql`COALESCE(${products.availableQuantity}, 0) + ${quantity}`,
      updatedAt: new Date(),
    };

    if (weightKg !== null) {
      updateData.availableWeightKg = sql`COALESCE(${products.availableWeightKg}, 0) + ${weightKg}`;
    }

    const result = await db
      .update(products)
      .set(updateData)
      .where(eq(products.productId, productId));

    // Log transaction if batch info is provided
    if (batchId && performedBy) {
      await db.insert(inventoryTransactions).values({
        productId,
        transactionType: 'Production Output',
        quantity,
        weightKg,
        referenceType: 'Batch',
        referenceId: batchId,
        createdBy: performedBy,
        notes: `Production Output for Batch #${batchId}`,
      });
    }

    return result;
  }

  /**
   * Reserve inventory for batch
   */
  async reserveInventory(materialId, quantity, weightKg = null) {
    const updateData = {
      reservedQuantity: sql`COALESCE(${products.reservedQuantity}, 0) + ${quantity}`,
      updatedAt: new Date(),
    };

    if (weightKg !== null) {
      updateData.reservedWeightKg = sql`COALESCE(${products.reservedWeightKg}, 0) + ${weightKg}`;
    }

    return await db
      .update(products)
      .set(updateData)
      .where(eq(products.productId, materialId))
      .returning();
  }

  /**
   * Get batch products (linked orders/products)
   */
  async getBatchProducts(batchId) {
    return await db.select().from(batchProducts).where(eq(batchProducts.batchId, batchId));
  }

  /**
   * Reserve raw material from masterProductRM table
   * Deducts from availableQty when scheduling a batch
   * This prevents the same RM from being used for other orders
   */
  async reserveRawMaterial(masterProductId, quantity, batchId = null, performedBy = null) {
    const result = await db
      .update(masterProductRM)
      .set({
        availableQty: sql`GREATEST(0, COALESCE(${masterProductRM.availableQty}, 0) - ${quantity})`,
      })
      .where(eq(masterProductRM.masterProductId, masterProductId))
      .returning();

    // Log transaction if batch info is provided
    if (batchId && performedBy) {
      // We need a productId for the transaction table.
      // Since RM stock is managed at Master Product level, we just pick the first associated SKU.
      const product = await db
        .select({ productId: products.productId })
        .from(products)
        .where(eq(products.masterProductId, masterProductId))
        .limit(1);

      if (product.length > 0) {
        await db.insert(inventoryTransactions).values({
          productId: product[0].productId,
          masterProductId: masterProductId,
          transactionType: 'Production Consumption',
          quantity: -Math.abs(quantity), // Negative for consumption
          referenceType: 'Batch',
          referenceId: batchId,
          createdBy: performedBy,
          notes: `Production Consumption for Batch #${batchId}`,
        });
      }
    }

    return result;
  }

  /**
   * Release reserved raw material back to masterProductRM table
   * Adds back to availableQty when cancelling a batch
   */
  async releaseRawMaterial(masterProductId, quantity) {
    return await db
      .update(masterProductRM)
      .set({
        availableQty: sql`COALESCE(${masterProductRM.availableQty}, 0) + ${quantity}`,
      })
      .where(eq(masterProductRM.masterProductId, masterProductId))
      .returning();
  }

  /**
   * Deduct packaging material from masterProductPM table
   * Called after batch completion to reduce PM inventory based on actual FG output
   * @param {number} masterProductId - The master product ID of the packaging material
   * @param {number} quantity - The quantity to deduct (number of units used)
   */
  async deductPackagingMaterial(masterProductId, quantity) {
    return await db
      .update(masterProductPM)
      .set({
        availableQty: sql`GREATEST(0, COALESCE(${masterProductPM.availableQty}, 0) - ${quantity})`,
      })
      .where(eq(masterProductPM.masterProductId, masterProductId))
      .returning();
  }

  /**
   * Get packaging ID for a product (SKU)
   * Returns the master product ID of the packaging material linked to this SKU
   */
  async getProductPackagingId(productId) {
    const result = await db
      .select({ packagingId: products.packagingId })
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);
    return result[0]?.packagingId || null;
  }

  /**
   * Get Product Development data for a master product
   * Returns the latest density, viscosity, and water percentage values
   * Used for snapshotting formulation values at batch creation time
   */
  async getProductDevelopmentData(masterProductId) {
    const result = await db
      .select({
        density: productDevelopment.density,
        viscosity: productDevelopment.viscosity,
        waterPercentage: productDevelopment.percentageValue,
      })
      .from(productDevelopment)
      .where(eq(productDevelopment.masterProductId, masterProductId))
      .orderBy(desc(productDevelopment.createdAt))
      .limit(1);

    return result[0] || null;
  }
}
