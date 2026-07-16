import { eq, desc, inArray, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  orders,
  customers,
  orderDetails,
  products,
  inventoryTransactions,
  dispatches,
  accounts,
  vehicles,
} from '../../db/schema/index.js';
import inventoryTransactionService from '../../services/inventory-transaction.service.js';

export class DispatchPlanningRepository {
  async findReadyForDispatch() {
    // Fetch orders that are 'Ready for Dispatch'
    // Join with OrderDetails, Products, and Accounts to get Item info and Bill No

    const rows = await db
      .select({
        order: orders,
        customer: customers,
        orderDetail: orderDetails,
        product: products,
        account: accounts,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(orderDetails, eq(orders.orderId, orderDetails.orderId))
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      // Include Ready for Dispatch so orders sent from PM show up
      .where(inArray(orders.status, ['Ready for Dispatch']))
      .orderBy(desc(orders.createdAt));

    // Group by Order since join produces rows per item
    const grouped = {};

    for (const row of rows) {
      const oid = row.order.orderId;
      if (!grouped[oid]) {
        grouped[oid] = {
          order: {
            ...row.order,
            billNo: row.account?.billNo || null, // Include billNo from accounts table
          },
          customer: row.customer,
          items: [],
        };
      }
      if (row.product) {
        grouped[oid].items.push({
          productName: row.product.productName,
          quantity: row.orderDetail.quantity,
          availableQty: row.product.availableQuantity,
          unitId: row.product.unitId,
          packageCapacityKg: parseFloat(row.product.packageCapacityKg) || 0, // Weight per unit in kg
        });
      }
    }

    return Object.values(grouped);
  }

  async findReturnedOrders() {
    const rows = await db
      .select({
        order: orders,
        customer: customers,
        orderDetail: orderDetails,
        product: products,
        account: accounts,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(orderDetails, eq(orders.orderId, orderDetails.orderId))
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(eq(orders.status, 'Returned'))
      .orderBy(desc(orders.updatedAt));

    const grouped = {};
    for (const row of rows) {
      const oid = row.order.orderId;
      if (!grouped[oid]) {
        grouped[oid] = {
          order: {
            ...row.order,
            billNo: row.account?.billNo || null,
          },
          customer: row.customer,
          items: [],
        };
      }
      if (row.product) {
        grouped[oid].items.push({
          productName: row.product.productName,
          quantity: row.orderDetail.quantity,
          availableQty: row.product.availableQuantity,
          unitId: row.product.unitId,
          packageCapacityKg: parseFloat(row.product.packageCapacityKg) || 0, // Weight per unit in kg
        });
      }
    }

    return Object.values(grouped);
  }

  async findById(orderId) {
    const rows = await db
      .select({
        order: orders,
        customer: customers,
        orderDetail: orderDetails,
        product: products,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(orderDetails, eq(orders.orderId, orderDetails.orderId))
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .where(eq(orders.orderId, orderId));

    if (rows.length === 0) return null;

    const grouped = {
      order: rows[0].order,
      customer: rows[0].customer,
      items: rows.map(r => ({
        productName: r.product?.productName,
        quantity: r.orderDetail?.quantity,
        availableQty: r.product?.availableQuantity,
      })),
    };
    return grouped;
  }

  async updateStatusToReady(orderId) {
    // 1. Get order details to know what to reserve
    const details = await db
      .select({
        productId: orderDetails.productId,
        quantity: orderDetails.quantity,
      })
      .from(orderDetails)
      .where(eq(orderDetails.orderId, orderId));

    // 2. Reserve inventory for re-queue
    // When re-queueing a returned order, we need to reserve the stock again
    // Note: The available qty was already restored when the order was returned
    for (const item of details) {
      await db
        .update(products)
        .set({
          reservedQuantity: sql`COALESCE(${products.reservedQuantity}, 0) + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.productId, item.productId));
    }

    // 3. Update order status
    return await db
      .update(orders)
      .set({
        status: 'Ready for Dispatch',
        updatedAt: new Date(),
      })
      .where(eq(orders.orderId, orderId))
      .returning();
  }

  /**
   * Get order details for a list of order IDs
   * Used to determine products and quantities to deduct from inventory
   */
  async getOrderDetails(orderIds) {
    if (!orderIds || orderIds.length === 0) return [];

    return await db
      .select({
        orderDetail: orderDetails,
        product: products,
      })
      .from(orderDetails)
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .where(inArray(orderDetails.orderId, orderIds));
  }

  /**
   * Deduct inventory for dispatched items (never go below 0)
   * Decrements both available and reserved quantities
   */
  async deductDispatchedInventory(productId, quantity, referenceId, performedBy) {
    // Get product info for weight calculation
    const [product] = await db.select().from(products).where(eq(products.productId, productId));

    // 1. Update Product Inventory (ensure non-negative)
    await db
      .update(products)
      .set({
        availableQuantity: sql`GREATEST(0, COALESCE(${products.availableQuantity}, 0) - ${quantity})`,
        reservedQuantity: sql`GREATEST(0, COALESCE(${products.reservedQuantity}, 0) - ${quantity})`,
        updatedAt: new Date(),
      })
      .where(eq(products.productId, productId));

    // 2. Record Inventory Transaction using centralized service
    try {
      const weightKg = product?.packageCapacityKg
        ? parseFloat(product.packageCapacityKg) * quantity
        : null;

      await inventoryTransactionService.recordDispatch({
        productId,
        quantity,
        weightKg,
        orderId: referenceId,
        createdBy: performedBy || 1,
        notes: 'Order Dispatched',
      });
    } catch (txnError) {
      console.error('[DispatchRepository] Failed to record inventory transaction:', txnError);
      // Don't fail the dispatch if transaction recording fails
    }
  }

  /**
   * Update order status
   */
  async updateStatus(orderId, status, remarks, dispatchId = null) {
    const updateData = {
      status,
      dispatchRemarks: remarks,
      updatedAt: new Date(),
    };

    if (dispatchId) {
      updateData.dispatchId = dispatchId;
    }

    return await db.update(orders).set(updateData).where(eq(orders.orderId, orderId)).returning();
  }

  async createDispatchRecord(data) {
    const result = await db.insert(dispatches).values(data).returning();
    return result[0];
  }

  async getVehicles() {
    return await db
      .select({
        id: vehicles.vehicleId,
        vehicleNumber: vehicles.vehicleNumber,
        driverName: vehicles.driverName,
        capacity: vehicles.capacity,
        isAvailable: vehicles.isAvailable,
      })
      .from(vehicles)
      .orderBy(vehicles.vehicleNumber);
  }

  async ensureVehicleExists(data) {
    const { vehicleNumber, driverName, capacity } = data;

    // Normalize: trim whitespace; keep original casing (dispatch records join
    // vehicles by the raw vehicle_number string, so casing must not be rewritten)
    const normalizedNumber = (vehicleNumber || '').toString().trim();
    if (!normalizedNumber || normalizedNumber === 'Customer Pickup') return null;

    // Duplicate check: case-insensitive
    const [existing] = await db
      .select()
      .from(vehicles)
      .where(sql`LOWER(${vehicles.vehicleNumber}) = LOWER(${normalizedNumber})`);
    if (existing) return existing;

    const result = await db
      .insert(vehicles)
      .values({
        vehicleNumber: normalizedNumber,
        driverName: driverName ? driverName.toString().trim() : driverName,
        capacity,
        isAvailable: true,
      })
      .returning();
    return result[0];
  }

  async findDispatchById(dispatchId) {
    const result = await db.select().from(dispatches).where(eq(dispatches.dispatchId, dispatchId));
    return result[0];
  }

  async updateDispatchStatus(dispatchId, status, remarks) {
    // 1. Update Dispatch Record
    const result = await db
      .update(dispatches)
      .set({ status, remarks, updatedAt: new Date() })
      .where(eq(dispatches.dispatchId, dispatchId))
      .returning();

    // 2. Update Linked Orders Status if status is 'Delivered' or 'Returned'
    // Use the dispatchId foreign key in orders table
    if (status === 'Delivered') {
      await db
        .update(orders)
        .set({ status: 'Delivered', updatedAt: new Date() })
        .where(eq(orders.dispatchId, dispatchId));
    }

    return result[0];
  }

  async getLinkedOrderIds(dispatchId) {
    const linkedOrders = await db
      .select({ orderId: orders.orderId })
      .from(orders)
      .where(eq(orders.dispatchId, dispatchId));

    return linkedOrders.map(o => o.orderId);
  }

  async getDispatchDetails(dispatchId) {
    // 1. Get Dispatch Info
    const result = await db.select().from(dispatches).where(eq(dispatches.dispatchId, dispatchId));
    const dispatch = result[0];

    if (!dispatch) return null;

    // 2. Get Linked Orders with Customer Info
    const linkedOrders = await db
      .select({
        order: orders,
        customer: customers,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.customerId))
      .where(eq(orders.dispatchId, dispatchId));

    return {
      ...dispatch,
      orders: linkedOrders.map(row => ({
        orderId: row.order.orderId,
        orderNumber: row.order.orderNumber,
        status: row.order.status,
        customerName: row.customer.companyName,
        location: row.customer.address,
        totalAmount: row.order.totalAmount,
      })),
    };
  }
}
