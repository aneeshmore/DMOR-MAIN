import { OrdersService } from '../orders/service.js';
import { AppError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';
import db from '../../db/index.js';
import { orders, accounts } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export class SplitOrdersService {
  constructor() {
    this.ordersService = new OrdersService();
  }

  /**
   * Split an order into two new orders
   * @param {string} originalOrderId - ID of the order to split
   * @param {Object} splitData - Data containing details for the two new orders
   * @returns {Object} Result containing the original order and the two new orders
   */
  async splitOrder(originalOrderId, splitData) {
    const { order1, order2 } = splitData;

    logger.info(`Splitting order ${originalOrderId}`);

    // 1. Get original order
    const originalOrder = await this.ordersService.getOrderById(originalOrderId);
    if (!originalOrder) {
      throw new AppError('Original order not found', 404);
    }

    if (originalOrder.status === 'Cancelled') {
      throw new AppError('Order is already cancelled', 400);
    }

    if (originalOrder.status === 'Split') {
      throw new AppError('Order has already been split', 400);
    }

    // Quantity conservation: the combined quantities of both child orders must exactly equal
    // the parent order's quantities, per product. Enforced here on the server because the
    // client is not authoritative — without this, a malformed or bypassed request could
    // silently create or lose stock-bearing quantity during the split.
    this._assertQuantitiesConserved(originalOrder, order1, order2);

    // 2. Mark the original order as 'Split' — not 'Cancelled'. The order was not cancelled,
    // it was superseded by two child orders, and conflating the two put split parents into
    // the Cancelled Orders Report as if the business had lost them. 'Split' is a terminal
    // status: the parent is no longer processed directly, and both children carry the work
    // forward. The parent stays discoverable via order search and via the "Split from
    // Order #X" remark on each child.
    logger.info(`Marking original order ${originalOrderId} as Split`);
    const splitRemark = 'Order split into two orders.';

    await this.ordersService.updateOrder(
      originalOrderId,
      {
        status: 'Split',
        notes: (originalOrder.remarks ? originalOrder.remarks + '\n' : '') + splitRemark,
      },
      true
    );

    // Record the split on the parent's accounts row for audit/history.
    //
    // If the parent already had a Bill No, it is cleared here (not merely left in place) —
    // that Bill No is inherited by Child A below, and "inherit" means the live claim to that
    // number transfers to the child, not that parent and child both keep it simultaneously.
    // Leaving it on the parent's row previously caused a real bug: with two accounts rows
    // (parent + Child A) carrying the same billNo, the accounts-approval duplicate check
    // (admin-accounts findByBillNo, unscoped) could return the parent's row instead of the
    // child's own, so accepting Child A with its own inherited Bill No was wrongly rejected
    // as "Bill Number already exists". Clearing the parent's copy removes the collision at
    // its source; the parent is 'Split' (terminal) and was never going to be billed itself.
    const parentHadBillNo = !!originalOrder.billNo;
    await db
      .update(accounts)
      .set({ remarks: splitRemark, ...(parentHadBillNo ? { billNo: null } : {}) })
      .where(eq(accounts.orderId, originalOrder.orderId));

    // 3. Create first new order
    // Ensure we create a clean object for creation, copying relevant fields from original if not provided
    const newOrder1Data = this._prepareNewOrderData(originalOrder, order1);
    logger.info('Creating first split order');
    const newOrder1 = await this.ordersService.createOrder(newOrder1Data);

    // Child Order A (Dispatch) automatically inherits the parent order's Bill Number so the
    // dispatched portion keeps invoice continuity with the order it came from. It is shown
    // read-only in Accounts Approval — the Accounts Manager cannot change it, they only
    // review and approve the order. If the parent has no Bill No yet, leave this blank and
    // fall back to normal manual entry (same as Child Order B).
    //
    // Inheriting a Bill No does NOT approve the order or skip any stage: the child is still
    // created at 'Pending Accounts Approval' and must be accepted by Accounts, then pass
    // Factory Approval and the rest of the workflow independently, exactly like any other order.
    const inheritedBillNo = order1.billNo || originalOrder.billNo;
    if (inheritedBillNo) {
      await db
        .update(accounts)
        .set({ billNo: inheritedBillNo })
        .where(eq(accounts.orderId, newOrder1.orderId));
    }

    // 4. Create second new order only if order2 is provided with items
    let newOrder2 = null;
    if (order2 && order2.orderDetails && order2.orderDetails.length > 0) {
      const newOrder2Data = this._prepareNewOrderData(originalOrder, order2);
      logger.info('Creating second split order');
      newOrder2 = await this.ordersService.createOrder(newOrder2Data);

      // Child Order B (Balance) never inherits the parent's Bill Number — the Accounts
      // Manager must enter a new, unique one manually during Accounts Approval, exactly
      // like any normal newly created order. Only an explicitly supplied Bill No is used.
      if (order2.billNo) {
        await db
          .update(accounts)
          .set({ billNo: order2.billNo })
          .where(eq(accounts.orderId, newOrder2.orderId));
      }
    } else {
      logger.info('No second order created - dispatching full quantity');
    }

    return {
      originalOrder: { ...originalOrder, status: 'Split' },
      newOrder1,
      newOrder2,
    };
  }

  /**
   * Search for an order by ID, Order Number, or Bill No
   * @param {string} query
   * @returns {Object} Order details
   */
  async searchOrder(query) {
    let orderId = null;

    // 1. Try if query is a number (Order ID)
    if (!isNaN(query) && Number.isInteger(Number(query))) {
      const id = Number(query);
      const exists = await db
        .select({ id: orders.orderId })
        .from(orders)
        .where(eq(orders.orderId, id))
        .limit(1)
        .then(res => res[0]);

      if (exists) {
        orderId = id;
      }
    }

    // 2. Try finding by Bill No (in accounts)
    if (!orderId) {
      const account = await db
        .select({ orderId: accounts.orderId })
        .from(accounts)
        .where(eq(accounts.billNo, query))
        .limit(1)
        .then(res => res[0]);

      if (account) {
        orderId = account.orderId;
      }
    }

    // 3. Try finding by Order Number (in orders)
    if (!orderId) {
      const order = await db
        .select({ orderId: orders.orderId })
        .from(orders)
        .where(eq(orders.orderNumber, query))
        .limit(1)
        .then(res => res[0]);

      if (order) {
        orderId = order.orderId;
      }
    }

    if (orderId) {
      return await this.ordersService.getOrderById(orderId);
    }

    throw new AppError('Order not found', 404);
  }

  /**
   * Verify that Child A + Child B quantities reconcile exactly against the parent order.
   * Throws AppError(400) on any mismatch, so the split is rejected before any order is
   * created and the parent is left untouched.
   */
  _assertQuantitiesConserved(originalOrder, order1, order2) {
    // Tolerance for floating point noise only (quantities are numeric/decimal in the DB).
    const EPSILON = 0.0001;

    const totals = new Map();
    for (const detail of originalOrder.orderDetails || []) {
      const productId = Number(detail.productId);
      const qty = parseFloat(detail.quantity) || 0;
      totals.set(productId, (totals.get(productId) || 0) + qty);
    }

    const childTotals = new Map();
    for (const child of [order1, order2]) {
      for (const item of child?.orderDetails || []) {
        const productId = Number(item.productId);
        const qty = parseFloat(item.quantity) || 0;
        if (qty < 0) {
          throw new AppError('Split quantities cannot be negative', 400);
        }
        childTotals.set(productId, (childTotals.get(productId) || 0) + qty);
      }
    }

    // A product appearing in the children that was never on the parent order is quantity
    // created out of nothing.
    for (const productId of childTotals.keys()) {
      if (!totals.has(productId)) {
        throw new AppError(
          `Split is invalid: product ${productId} is not part of the original order`,
          400
        );
      }
    }

    for (const [productId, parentQty] of totals.entries()) {
      const childQty = childTotals.get(productId) || 0;
      if (Math.abs(parentQty - childQty) > EPSILON) {
        throw new AppError(
          `Split quantity mismatch for product ${productId}: original ${parentQty}, split total ${childQty}. ` +
            'The combined quantity of both split orders must equal the original order quantity.',
          400
        );
      }
    }
  }

  _prepareNewOrderData(originalOrder, newOrderPartial) {
    // We expect newOrderPartial to contain: billNo, orderDetails (array of { productId, quantity, unitPrice })
    // We retain customerId, salespersonId, and address from original order
    return {
      customerId: originalOrder.customerId,
      salespersonId: originalOrder.salespersonId,
      address: originalOrder.address,
      priority: originalOrder.priority,
      status: 'Pending Accounts Approval', // Split orders go to admin for approval
      paymentCleared: false,
      ...newOrderPartial, // Overwrites billNo and orderDetails
      remarks:
        newOrderPartial.remarks ||
        `Split from Order ${originalOrder.billNo || originalOrder.orderNumber}`,
    };
  }
}
