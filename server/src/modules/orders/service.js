import { OrdersRepository } from './repository.js';
import { NotificationsService } from '../notifications/service.js';
import { OrderDTO, OrderWithDetailsDTO } from './dto.js';
import { AppError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';
import db from '../../db/index.js';
import { accounts, products, customers, employees } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export class OrdersService {
  constructor() {
    this.repository = new OrdersRepository();
    this.notificationsService = new NotificationsService();
  }

  /**
   * Calculate required weight from order lines
   * Iterates through order details and calculates total weight based on:
   * - Product SKU package capacity
   * - Order quantity
   * - Returns both total weight and breakdown by SKU
   */
  async calculateOrderWeight(orderDetails) {
    logger.info('Calculating required weight for order lines');

    if (!orderDetails || orderDetails.length === 0) {
      return {
        totalRequiredWeightKg: 0,
        breakdown: [],
      };
    }

    const breakdown = [];
    let totalRequiredWeightKg = 0;

    for (const detail of orderDetails) {
      // Get product details including package capacity
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.productId, detail.productId));

      if (!product) {
        logger.warn(`Product ${detail.productId} not found for weight calculation`);
        continue;
      }

      const packageCapacityKg = parseFloat(product.packageCapacityKg || 0);
      const quantity = parseFloat(detail.quantity || 0);

      if (packageCapacityKg <= 0 || quantity <= 0) {
        logger.warn(`Invalid capacity or quantity for product ${detail.productId}`, {
          packageCapacityKg,
          quantity,
        });
        continue;
      }

      // Calculate required weight: quantity × package capacity
      const requiredWeightKg = quantity * packageCapacityKg;
      totalRequiredWeightKg += requiredWeightKg;

      breakdown.push({
        productId: detail.productId,
        productName: product.productName,
        quantity,
        packageCapacityKg,
        requiredWeightKg,
      });

      logger.debug(`Weight calculated for ${product.productName}`, {
        quantity,
        packageCapacity: packageCapacityKg,
        totalWeight: requiredWeightKg,
      });
    }

    logger.info('Order weight calculation complete', {
      totalWeight: totalRequiredWeightKg,
      itemCount: breakdown.length,
    });

    return {
      totalRequiredWeightKg: parseFloat(totalRequiredWeightKg.toFixed(2)),
      breakdown,
    };
  }

  /**
   * Get weight information for an order
   * Useful for checking if order has weight calculated
   */
  async getOrderWeight(orderId) {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const details = await this.repository.getOrderDetails(orderId);
    if (!details || details.length === 0) {
      return {
        orderId,
        totalRequiredWeightKg: 0,
        breakdown: [],
      };
    }

    const detailsArray = details.map(d => d.order_details);
    return await this.calculateOrderWeight(detailsArray);
  }

  /**
   * Get all orders with optional filtering
   * @param {number} limit - Max results
   * @param {number} offset - Results offset
   * @param {string} status - Filter by status
   * @param {Object} userContext - User context for data scoping
   */
  async getAllOrders(limit, offset, status, userContext = null) {
    try {
      const orders = await this.repository.findAll({ limit, offset, status, userContext });
      logger.info(`Found ${orders.length} orders for user`, {
        employeeId: userContext?.employeeId,
        isAdmin: userContext?.isAdmin,
      });
      return orders.map(o => new OrderDTO(o));
    } catch (error) {
      logger.error('Error in getAllOrders service:', error);
      throw error;
    }
  }

  async getOrderById(orderId) {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const details = await this.repository.getOrderDetails(orderId);
    return new OrderWithDetailsDTO(
      order,
      details.map(d => {
        const detail = d.order_details || d;
        return {
          ...detail,
          productName: d.products?.productName,
          hsnCode: d.hsnCode,
        };
      }) // Handle if details query also changed, but usually details query returns raw join result?
    );
  }

  async createOrder(orderData) {
    logger.info('Creating order with data:', orderData);

    const { orderDetails: detailsData, ...orderInfo } = orderData;

    // Calculate total amount with discount
    const totalAmount = detailsData.reduce((sum, item) => {
      const subtotal = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      const discount = item.discount || 0;
      const discountAmount = (subtotal * discount) / 100;
      return sum + (subtotal - discountAmount);
    }, 0);

    // Calculate required weight from order lines
    const weightInfo = await this.calculateOrderWeight(detailsData);
    logger.info('Order weight calculated', {
      totalWeight: weightInfo.totalRequiredWeightKg,
      breakdown: weightInfo.breakdown,
    });

    // Helper to convert empty strings to null
    const normalizeString = value => {
      return typeof value === 'string' && !value.trim() ? null : value;
    };

    // Build order object with all required fields
    // Generate order number: ORD-<YYYY>-<MM>-<NNNN>
    const now = new Date(orderInfo.orderDate || new Date());
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    let orderNumber = await this.repository.getNextOrderNumber(year, month);

    // Build order object with all required fields
    const mappedOrderInfo = {
      customerId: orderInfo.customerId,
      salespersonId: orderInfo.salespersonId,
      orderNumber: orderInfo.orderNumber || orderNumber,
      status: orderInfo.status || 'Pending Accounts Approval',
      totalAmount,
      priorityLevel: orderInfo.priority || 'Normal',
      orderDate: orderInfo.orderDate ? new Date(orderInfo.orderDate) : new Date(),
      // Always include optional fields - convert empty strings to null
      deliveryAddress: normalizeString(orderInfo.deliveryAddress),
      notes: normalizeString(orderInfo.remarks),
    };

    logger.info('Mapped order info:', mappedOrderInfo);

    // Create order, retry in case of duplicate orderNumber (concurrency)
    let order;
    let attempts = 0;
    while (!order && attempts < 5) {
      try {
        order = await this.repository.create(mappedOrderInfo);
      } catch (err) {
        // If duplicate order number, regenerate and retry
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
          attempts += 1;
          orderNumber = await this.repository.getNextOrderNumber(year, month);
          mappedOrderInfo.orderNumber = orderNumber;
          continue;
        }
        throw err;
      }
    }
    if (!order) throw new Error('Failed to create order after retries');

    logger.info('Order created with ID:', order.orderId);

    // Create order details
    const details = [];
    for (const [index, item] of detailsData.entries()) {
      const detail = await this.repository.createOrderDetail({
        orderId: order.orderId,
        productId: item.productId,
        quantity: String(parseFloat(item.quantity)),
        unitPrice: String(parseFloat(item.unitPrice)),
        discount: String(parseFloat(item.discount || 0)),
        // Store calculated required weight based on package capacity
        requiredWeightKg: String(
          weightInfo.breakdown[index]?.requiredWeightKg || 0
        ),
        // Note: totalPrice is a generated column in the database, so we don't insert it
      });
      details.push(detail);
    }

    logger.info(`Created ${details.length} order details with weight tracking`);

    // Create corresponding account record with default values
    try {
      await db.insert(accounts).values({
        orderId: order.orderId,
        billAmount: order.totalAmount,
        paymentStatus: 'Pending',
        paymentCleared: false,
        // Admin remark starts empty — only populated when an Accounts/Admin user enters one.
        // (Salesperson remark lives on orders.notes and is displayed separately.)
      });
      logger.info('Created account record for order');
    } catch (accountError) {
      logger.error('Failed to create account record:', accountError);
      // Continue even if account creation fails
    }

    // [MOVED TO ACCOUNTS APPROVAL] The customer ledger debit used to be posted right here,
    // at creation — before the order had even been reviewed, billed, or approved. That meant
    // every order inflated the customer's outstanding balance immediately, and cancelling or
    // splitting an unapproved order had no correct "nothing to reverse" state to fall back on,
    // since a debit always existed. The debit is now posted by
    // AdminAccountsService.postOrderDebitIfNeeded(), called from acceptOrder()/clearPayment()
    // once the order is actually billed — matching that an order still "Pending Accounts
    // Approval" is not yet a finalized bill and must not affect the customer's balance. See
    // PaymentRepository.reverseOrderInvoiceIfExists() for the matching reversal used by
    // Cancel Order and Split Order.

    // Send Notification
    try {
      // Fetch names for the notification
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.customerId, order.customerId));
      const [salesperson] = await db
        .select()
        .from(employees)
        .where(eq(employees.employeeId, order.salespersonId));

      const customerName = customer ? customer.companyName : 'Unknown Customer';
      const salesPersonName = salesperson
        ? `${salesperson.firstName} ${salesperson.lastName}`
        : 'Salesperson';

      // Detect a split child from the "Split from Order #X" marker already written to the
      // order's own remark at split time, so the notification names the portion and its
      // parent instead of reading like an unrelated new order. Each notification carries
      // this order's own totalAmount, so the two children show their own values.
      const splitMatch = order.notes && order.notes.match(/Split from Order #?(\S+)/);
      // A custom remark typed on the split form is stored as a prefix before
      // " - Split from Order #X" — recover it so it surfaces in the notification too.
      const customRemark =
        splitMatch && !order.notes.startsWith('Split from Order')
          ? order.notes.split(' - Split from Order')[0]
          : null;
      const splitInfo = splitMatch
        ? {
            portion: order.notes.includes('(Balance)') ? 'Balance' : 'Dispatch',
            originalOrderNumber: splitMatch[1],
            customRemark,
          }
        : null;

      await this.notificationsService.createNewOrderNotification(
        order.orderId,
        customerName,
        order.totalAmount,
        salesPersonName,
        order.orderNumber,
        splitInfo
      );
      logger.info(`Notification sent for new order #${order.orderId}`);
    } catch (notifErr) {
      logger.error('Failed to send new order notification:', notifErr);
    }

    return new OrderWithDetailsDTO(order, details);
  }

  async updateOrder(orderId, updateData, bypassStatusCheck = false) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    // Check status - only allow editing if Pending or Rejected
    // "Accepted" orders are locked for general edits (but PM can update delivery date via specific endpoints)
    if (!bypassStatusCheck) {
      const allowedStatuses = ['Pending', 'Pending Accounts Approval', 'Rejected'];
      if (!allowedStatuses.includes(existing.status)) {
        throw new AppError(
          `Cannot edit order in '${existing.status}' status. Only orders pending accounts approval or rejected orders can be edited.`,
          400
        );
      }
    }

    // Map API fields to DB columns
    const mappedData = { ...updateData };
    if (mappedData.priority) {
      mappedData.priorityLevel = mappedData.priority;
      delete mappedData.priority;
    }
    if (Object.prototype.hasOwnProperty.call(mappedData, 'remarks')) {
      mappedData.notes = mappedData.remarks;
      delete mappedData.remarks;
    }

    const { orderDetails: detailsData, ...orderLevelData } = mappedData;

    // If line items are being edited, recompute totals and persist details.
    if (Array.isArray(detailsData)) {
      const totalAmount = detailsData.reduce((sum, item) => {
        const subtotal = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        const discount = item.discount || 0;
        const discountAmount = (subtotal * discount) / 100;
        return sum + (subtotal - discountAmount);
      }, 0);
      orderLevelData.totalAmount = totalAmount;
    }

    await this.repository.update(orderId, orderLevelData);

    if (Array.isArray(detailsData)) {
      const weightInfo = await this.calculateOrderWeight(detailsData);
      await this.repository.deleteOrderDetailsByOrderId(orderId);

      for (const [index, item] of detailsData.entries()) {
        await this.repository.createOrderDetail({
          orderId,
          productId: item.productId,
          quantity: String(parseFloat(item.quantity)),
          unitPrice: String(parseFloat(item.unitPrice)),
          discount: String(parseFloat(item.discount || 0)),
          requiredWeightKg: String(
            weightInfo.breakdown[index]?.requiredWeightKg || 0
          ),
        });
      }
    }

    // Return fully refreshed order data so frontend receives latest fields.
    return await this.getOrderById(orderId);
  }

  async deleteOrder(orderId) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    // Soft delete: Update status to Cancelled so it appears in reports
    await this.repository.update(orderId, { status: 'Cancelled' });
  }

  async getOrderStats() {
    return await this.repository.getOrderStats();
  }
}
