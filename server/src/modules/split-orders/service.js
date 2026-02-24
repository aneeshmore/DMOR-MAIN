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

    // 2. Mark original order as Cancelled
    logger.info(`Cancelling original order ${originalOrderId}`);
    const cancellationRemark = 'Order cancled by Split Order.';

    await this.ordersService.updateOrder(
      originalOrderId,
      {
        status: 'Cancelled',
        notes: (originalOrder.remarks ? originalOrder.remarks + '\n' : '') + cancellationRemark,
      },
      true
    );

    // Update account remarks for the original order so it shows up in Cancelled Orders Report
    await db
      .update(accounts)
      .set({ remarks: cancellationRemark })
      .where(eq(accounts.orderId, originalOrder.orderId));

    // 3. Create first new order
    // Ensure we create a clean object for creation, copying relevant fields from original if not provided
    const newOrder1Data = this._prepareNewOrderData(originalOrder, order1);
    logger.info('Creating first split order');
    const newOrder1 = await this.ordersService.createOrder(newOrder1Data);

    // Update Bill No in accounts for newOrder1
    if (order1.billNo) {
      await db
        .update(accounts)
        .set({ billNo: order1.billNo })
        .where(eq(accounts.orderId, newOrder1.orderId));
    }

    // 4. Create second new order only if order2 is provided with items
    let newOrder2 = null;
    if (order2 && order2.orderDetails && order2.orderDetails.length > 0) {
      const newOrder2Data = this._prepareNewOrderData(originalOrder, order2);
      logger.info('Creating second split order');
      newOrder2 = await this.ordersService.createOrder(newOrder2Data);

      // Update Bill No in accounts for newOrder2
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
      originalOrder: { ...originalOrder, status: 'Cancelled' },
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

  _prepareNewOrderData(originalOrder, newOrderPartial) {
    // We expect newOrderPartial to contain: billNo, orderDetails (array of { productId, quantity, unitPrice })
    // We retain customerId, salespersonId, and address from original order
    return {
      customerId: originalOrder.customerId,
      salespersonId: originalOrder.salespersonId,
      address: originalOrder.address,
      priority: originalOrder.priority,
      status: 'Pending', // Split orders go to admin for approval
      paymentCleared: false,
      ...newOrderPartial, // Overwrites billNo and orderDetails
      remarks:
        newOrderPartial.remarks ||
        `Split from Order ${originalOrder.billNo || originalOrder.orderNumber}`,
    };
  }
}
