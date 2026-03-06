import { eq, desc, sql, or, and, inArray } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  orders,
  orderDetails,
  customers,
  products,
  accounts,
  employees,
} from '../../db/schema/index.js';
import logger from '../../config/logger.js';
// Data access layer for orders

export class OrdersRepository {
  async getNextOrderNumber(year, month) {
    const monthPadded = String(month).padStart(2, '0');
    const pattern = `ORD-${year}-${monthPadded}-%`;
    const rows = await db
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(sql`${orders.orderNumber} LIKE ${pattern}`);

    let max = 0;
    for (const r of rows) {
      try {
        const parts = r.orderNumber.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!Number.isNaN(seq) && seq > max) max = seq;
      } catch (_) {
        // ignore parse errors
      }
    }
    const next = (max + 1).toString().padStart(4, '0');
    return `ORD-${year}-${monthPadded}-${next}`;
  }

  /**
   * Find all orders with optional filtering
   * @param {Object} options - Query options
   * @param {number} options.limit - Max results
   * @param {number} options.offset - Results offset
   * @param {string} options.status - Filter by status
   * @param {Object} options.userContext - User context for data scoping
   * @param {number} options.userContext.employeeId - Current user's employee ID
   * @param {boolean} options.userContext.isAdmin - Whether user is admin
   */
  async findAll({ limit = 50, offset = 0, status, userContext } = {}) {
    let query = db
      .select({
        orderId: orders.orderId,
        orderUuid: orders.orderUuid,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        salespersonId: orders.salespersonId,
        salespersonName: sql`concat(${employees.firstName}, ' ', ${employees.lastName})`,
        orderDate: orders.orderDate,
        totalAmount: orders.totalAmount,
        status: orders.status,
        address: orders.deliveryAddress,
        notes: orders.notes,
        priorityLevel: orders.priorityLevel,
        expectedDeliveryDate: orders.expectedDeliveryDate,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        productNames: sql`string_agg(${products.productName}, ', ')`,
        totalQuantity: sql`COALESCE(sum(${orderDetails.quantity}::numeric), 0)`,
        billNo: accounts.billNo,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(employees, eq(orders.salespersonId, employees.employeeId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .leftJoin(orderDetails, eq(orders.orderId, orderDetails.orderId))
      .leftJoin(products, eq(orderDetails.productId, products.productId));

    // Build where conditions
    const conditions = [];

    // Status filter
    if (status) {
      if (status.includes(',')) {
        const statuses = status.split(',').map(s => s.trim());
        conditions.push(inArray(orders.status, statuses));
      } else {
        conditions.push(eq(orders.status, status));
      }
    }

    // Data scoping: Non-admins only see orders where they are the salesperson
    // or orders for customers they created
    if (userContext && !userContext.isAdmin && userContext.employeeId) {
      logger.info('Applying data scoping for user', {
        employeeId: userContext.employeeId,
        role: userContext.role,
      });
      conditions.push(
        or(
          eq(orders.salespersonId, userContext.employeeId),
          eq(customers.createdBy, userContext.employeeId),
          eq(customers.salesPersonId, userContext.employeeId)
        )
      );
    }

    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query
      .groupBy(
        orders.orderId,
        orders.orderUuid,
        orders.orderNumber,
        orders.customerId,
        orders.salespersonId,
        employees.firstName,
        employees.lastName,
        orders.orderDate,
        orders.totalAmount,
        orders.status,
        orders.deliveryAddress,
        orders.notes,
        orders.priorityLevel,
        orders.expectedDeliveryDate,
        orders.createdAt,
        orders.updatedAt,
        customers.customerId,
        customers.companyName,
        customers.contactPerson,
        accounts.billNo
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findById(orderId) {
    const result = await db
      .select({
        ...orders,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        billNo: accounts.billNo,
        paymentMethod: accounts.paymentMethod,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(eq(orders.orderId, orderId))
      .limit(1);

    return result[0] || null;
  }

  async findByOrderNumber(orderNumber) {
    const result = await db
      .select({
        ...orders,
        billNo: accounts.billNo,
      })
      .from(orders)
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    return result[0] || null;
  }

  async getOrderDetails(orderId) {
    return await db
      .select()
      .from(orderDetails)
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .where(eq(orderDetails.orderId, orderId));
  }

  async create(orderData) {
    try {
      const result = await db.insert(orders).values(orderData).returning();
      return result[0];
    } catch (error) {
      logger.error('Error creating order:', error);
      // Fallback: use explicit column insert to avoid prepared statement issues
      if (error.message && error.message.includes('Failed query')) {
        logger.info('Using fallback insert method');
        // Build the insert with explicit columns
        const {
          customerId,
          salespersonId,
          orderNumber,
          status,
          totalAmount,
          priorityLevel,
          orderDate,
          address,
          notes,
        } = orderData;

        const result = await db
          .insert(orders)
          .values({
            customerId,
            salespersonId,
            // billNo, // Not in DB
            orderNumber,
            status,
            // paymentCleared, // Not in DB
            totalAmount,
            priorityLevel,
            orderDate,
            address,
            notes,
            // paymentDate, // Not in DB
          })
          .returning();

        return result[0];
      }
      throw error;
    }
  }

  async createOrderDetail(detailData) {
    try {
      const result = await db.insert(orderDetails).values(detailData).returning();
      return result[0];
    } catch (error) {
      logger.error('Error creating order detail:', error);
      logger.error('Detail data:', detailData);
      throw error;
    }
  }

  async update(orderId, updateData) {
    const result = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.orderId, orderId))
      .returning();

    return result[0];
  }

  async updateOrderDetail(orderDetailId, updateData) {
    const result = await db
      .update(orderDetails)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orderDetails.orderDetailId, orderDetailId))
      .returning();

    return result[0];
  }

  async delete(orderId) {
    await db.delete(orders).where(eq(orders.orderId, orderId));
  }

  async deleteOrderDetail(orderDetailId) {
    await db.delete(orderDetails).where(eq(orderDetails.orderDetailId, orderDetailId));
  }

  async deleteOrderDetailsByOrderId(orderId) {
    await db.delete(orderDetails).where(eq(orderDetails.orderId, orderId));
  }

  async getOrderStats() {
    const stats = await db
      .select({
        status: orders.status,
        count: sql`COUNT(*)::int`,
        totalAmount: sql`SUM(${orders.totalAmount})`,
      })
      .from(orders)
      .groupBy(orders.status);

    return stats;
  }
}
