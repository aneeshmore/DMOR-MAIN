import { eq, desc, and, ilike, or, sql, notInArray, inArray, gte, between } from 'drizzle-orm';
import db from '../../db/index.js';
import { orders, products, orderDetails, customers, accounts } from '../../db/schema/index.js';

// Statuses that can still be cancelled
const CANCELLABLE_STATUSES = [
  // New workflow statuses
  'Pending Accounts Approval',
  'Pending Factory Approval',
  'Factory Approved',
  'Scheduled for Production',
  'Ready for Dispatch',
  'On Hold',
  // Legacy status names (existing orders)
  'Pending',
  'Verified',
  'Accepted',
  'Scheduled',
  'In Production',
  'Confirmed',
  'Started',
];

export class CancelOrderRepository {
  /**
   * Find all orders that can still be cancelled
   */
  async findCancellableOrders({ search }) {
    const whereConditions = [inArray(orders.status, CANCELLABLE_STATUSES)];

    if (search) {
      whereConditions.push(
        or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(customers.companyName, `%${search}%`),
          ilike(customers.customerName, `%${search}%`)
        )
      );
    }

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
      .where(and(...whereConditions))
      .orderBy(desc(orders.orderDate));

    return this.groupOrderRows(rows);
  }

  /**
   * Find all cancelled orders
   */
  async findCancelledOrders({ search }) {
    const whereConditions = [eq(orders.status, 'Cancelled')];

    if (search) {
      whereConditions.push(
        or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(customers.companyName, `%${search}%`),
          ilike(customers.customerName, `%${search}%`)
        )
      );
    }

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
      .where(and(...whereConditions))
      .orderBy(desc(orders.updatedAt));

    return this.groupOrderRows(rows);
  }

  /**
   * Get statistics for cancel orders
   */
  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total cancellable
    const [cancellableResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(orders)
      .where(inArray(orders.status, CANCELLABLE_STATUSES));

    // Total cancelled
    const [cancelledResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, 'Cancelled'));

    // Cancelled today
    const [cancelledTodayResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'Cancelled'), gte(orders.updatedAt, startOfDay)));

    // Cancelled this month
    const [cancelledMonthResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'Cancelled'), gte(orders.updatedAt, startOfMonth)));

    return {
      totalCancellable: cancellableResult?.count || 0,
      totalCancelled: cancelledResult?.count || 0,
      cancelledToday: cancelledTodayResult?.count || 0,
      cancelledThisMonth: cancelledMonthResult?.count || 0,
    };
  }

  /**
   * Cancel an order with reason
   */
  async cancelOrder(orderId, reason) {
    // 1. Get order details to know what to restore
    const details = await db
      .select({
        productId: orderDetails.productId,
        quantity: orderDetails.quantity,
      })
      .from(orderDetails)
      .where(eq(orderDetails.orderId, orderId));

    // 2. Check current order status to determine inventory handling
    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.orderId, orderId));

    if (!order) {
      throw new Error('Order not found');
    }

    // 3. Handle inventory based on current status
    if (['Ready for Dispatch', 'Dispatched'].includes(order.status)) {
      // Stock was already deducted from available, restore it
      for (const item of details) {
        await db
          .update(products)
          .set({
            availableQuantity: sql`COALESCE(${products.availableQuantity}, 0) + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.productId, item.productId));
      }
    } else if (
      [
        'Factory Approved',
        'Scheduled for Production',
        // Legacy status names (existing orders)
        'Accepted',
        'Scheduled',
        'In Production',
        'Confirmed',
        'Started',
      ].includes(order.status)
    ) {
      // Stock was reserved but not yet deducted from available
      // Release the reservation
      for (const item of details) {
        await db
          .update(products)
          .set({
            reservedQuantity: sql`GREATEST(0, COALESCE(${products.reservedQuantity}, 0) - ${item.quantity})`,
            updatedAt: new Date(),
          })
          .where(eq(products.productId, item.productId));
      }
    }
    // For 'Pending' or 'On Hold', no inventory changes needed

    // 4. Update order status to Cancelled and store the reason
    const result = await db
      .update(orders)
      .set({
        status: 'Cancelled',
        notes: sql`COALESCE(${orders.notes}, '') || ${reason ? `\n[CANCEL REASON]: ${reason}` : ''}`,
        updatedAt: new Date(),
      })
      .where(eq(orders.orderId, orderId))
      .returning();

    // 5. Free up bill number in accounts table if it exists
    await db
      .update(accounts)
      .set({
        billNo: null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.orderId, orderId));

    return result;
  }

  /**
   * Group flat rows into order objects with items
   */
  groupOrderRows(rows) {
    const grouped = {};
    for (const row of rows) {
      const oid = row.order.orderId;
      if (!grouped[oid]) {
        grouped[oid] = {
          orderId: row.order.orderId,
          orderNumber: row.order.orderNumber || `ORD-${row.order.orderId}`,
          billNo: row.account?.billNo || null,
          companyName: row.customer.companyName,
          customerName: row.customer.customerName,
          orderDate: row.order.orderDate,
          expectedDeliveryDate: row.order.expectedDeliveryDate,
          status: row.order.status,
          totalAmount: row.order.totalAmount,
          remarks: row.order.notes,
          cancelReason: row.order.notes?.includes('[CANCEL REASON]:')
            ? row.order.notes.split('[CANCEL REASON]:').pop()?.trim()
            : null,
          cancelledAt: row.order.status === 'Cancelled' ? row.order.updatedAt : null,
          items: [],
        };
      }

      if (row.product && row.orderDetail) {
        // Check if this item already exists (avoid duplicates from joins)
        const exists = grouped[oid].items.some(item => item.productId === row.product.productId);
        if (!exists) {
          grouped[oid].items.push({
            productId: row.product.productId,
            productName: row.product.productName,
            quantity: parseFloat(row.orderDetail.quantity) || 0,
            unitPrice: parseFloat(row.orderDetail.unitPrice) || 0,
            unit: row.product.unitId || '',
          });
        }
      }
    }

    return Object.values(grouped);
  }
}
