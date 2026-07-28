import { AdminAccountsRepository } from './repository.js';
import { AppError } from '../../utils/AppError.js';
import { AdminAccountOrderDTO } from './dto.js';
import { BOMService } from '../bom/service.js';
import { NotificationsService } from '../notifications/service.js';
import { MasterProductsRepository } from '../master-products/repository.js';

export class AdminAccountsService {
  constructor() {
    this.repository = new AdminAccountsRepository();
    this.bomService = new BOMService();
    this.notificationsService = new NotificationsService();
    this.productsRepository = new MasterProductsRepository();
  }

  async getPendingPaymentOrders() {
    const results = await this.repository.findAllPending();
    // results is array of { orders, customers, employees, accounts }
    return results.map(
      row => new AdminAccountOrderDTO(row.orders, row.customers, row.employees, row.accounts)
    );
  }

  async getCancelledOrders() {
    const results = await this.repository.findAllCancelled();
    return results.map(
      row => new AdminAccountOrderDTO(row.orders, row.customers, row.employees, row.accounts)
    );
  }

  async getOrderDetails(orderId) {
    const data = await this.repository.getOrderDetails(orderId);
    if (!data) {
      throw new AppError('Order not found', 404);
    }

    const baseDto = new AdminAccountOrderDTO(
      data.orders,
      data.customers,
      data.employees,
      data.accounts
    );

    return {
      ...baseDto,
      address: data.customers.address || '',
      priority: data.orders.priority || data.orders.priorityLevel,
      items: data.items.map(i => ({
        productId: i.product.productId,
        productName: i.product.productName,
        size: i.product.size,
        quantity: i.detail.quantity,
        unit: i.product.unit,
        unitPrice: parseFloat(i.detail.unitPrice),
        discount: parseFloat(i.detail.discount || 0),
        totalPrice: parseFloat(i.detail.totalPrice),
      })),
    };
  }

  async acceptOrder(orderId, { billNo, adminRemarks }) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    // Check if billNo already exists on another order. excludeOrderId=orderId ensures this
    // order's own account row (e.g. a split Dispatch child's inherited Bill No) is never
    // mistaken for a conflicting duplicate of itself.
    if (billNo) {
      const duplicateBill = await this.repository.findByBillNo(billNo, orderId);
      if (duplicateBill) {
        throw new AppError(`Bill Number '${billNo}' already exists`, 400);
      }
    }

    // Update or create account record with payment already cleared
    const accountData = {
      billNo,
      remarks: adminRemarks,
      paymentCleared: true,
      paymentStatus: 'Cleared',
      paymentDate: new Date(),
    };

    // Determine Status Flow: Pending Accounts Approval -> Pending Factory Approval -> Factory Approved
    // If currently awaiting factory approval, move to Factory Approved (Ready for Production)
    // Otherwise (awaiting accounts approval), move to Pending Factory Approval
    // Legacy names ('Verified', 'Pending') are accepted so existing orders keep flowing.
    let newStatus = 'Pending Factory Approval';
    if (
      existing.orders.status === 'Verified' ||
      existing.orders.status === 'Pending Factory Approval'
    ) {
      newStatus = 'Factory Approved';
    }

    // Update the order status
    const orderData = {
      status: newStatus,
    };

    await this.repository.updateAccount(orderId, accountData);
    await this.repository.updateOrder(orderId, orderData);

    // Check for material shortages as soon as the order enters the production
    // pipeline (on every accounts approval, not only the final transition)
    await this.checkMaterialRequirements(orderId);

    // [STATUS NOTIFICATION FIX] Send the notification for BOTH transitions.
    // Previously gated on newStatus === 'Factory Approved', so the accounts-approval
    // step (-> 'Pending Factory Approval') never generated a notification and the
    // "Order approved by accounts / Pending Factory Approval" section stayed empty.
    try {
      const full = await this.repository.findById(orderId);
      const { customers: customer, employees: salesperson, orders: order } = full;
      const customerName = customer ? customer.companyName : 'Customer';

      // Notify the salesperson assigned to the order
      const recipientId = order?.salespersonId || salesperson?.employeeId;

      await this.notificationsService.createOrderStatusNotification(
        orderId,
        customerName,
        newStatus,
        recipientId,
        order?.orderNumber
      );

      // Clean up 'NewOrder' notifications once the order leaves accounts approval
      await this.notificationsService.clearNotificationsForOrder(orderId, ['NewOrder']);
    } catch (err) {
      console.error('Failed to send notification in acceptOrder:', err);
    }

    // Fetch full data again for DTO
    const fullData = await this.repository.findById(orderId);
    return new AdminAccountOrderDTO(
      fullData.orders,
      fullData.customers,
      fullData.employees,
      fullData.accounts
    );
  }

  async clearPayment(orderId, { billNo, remarks }) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    // Check if billNo already exists on another order (see acceptOrder for why excludeOrderId
    // matters — it prevents an order's own account row from being flagged as its own duplicate).
    if (billNo) {
      const duplicateBill = await this.repository.findByBillNo(billNo, orderId);
      if (duplicateBill) {
        throw new AppError(`Bill Number '${billNo}' already exists`, 400);
      }
    }

    // Update or create account record for payment clearing
    const accountData = {
      paymentCleared: true,
      paymentStatus: 'Cleared',
      billNo,
      remarks,
      paymentDate: new Date(),
    };

    // Determine Status Flow: Pending Accounts Approval -> Pending Factory Approval -> Factory Approved
    // Legacy names ('Verified', 'Pending') are accepted so existing orders keep flowing.
    let newStatus = 'Pending Factory Approval';
    if (
      existing.orders.status === 'Verified' ||
      existing.orders.status === 'Pending Factory Approval'
    ) {
      newStatus = 'Factory Approved';
    }

    // Update the order status
    const orderData = {
      status: newStatus,
    };

    await this.repository.updateAccount(orderId, accountData);
    await this.repository.updateOrder(orderId, orderData);

    // Only perform Production checks/notifications if fully Factory Approved
    if (newStatus === 'Factory Approved') {
      // Check for material shortages after payment clearance
      await this.checkMaterialRequirements(orderId);
    }

    // Fetch full data again for DTO
    const fullData = await this.repository.findById(orderId);
    return new AdminAccountOrderDTO(
      fullData.orders,
      fullData.customers,
      fullData.employees,
      fullData.accounts
    );
  }

  async toggleHold(orderId, { remarks }) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    const currentStatus = existing.orders.status;
    const newStatus = currentStatus === 'On Hold' ? 'Pending Accounts Approval' : 'On Hold';

    const orderData = {
      status: newStatus,
    };

    // Update remarks in accounts table if account exists
    if (existing.accounts) {
      await this.repository.updateAccount(orderId, { remarks });
    }

    await this.repository.updateOrder(orderId, orderData);

    const fullData = await this.repository.findById(orderId);
    return new AdminAccountOrderDTO(
      fullData.orders,
      fullData.customers,
      fullData.employees,
      fullData.accounts
    );
  }

  async updateBillNo(orderId, { billNo }) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    // Update account record with billNo
    await this.repository.updateAccount(orderId, { billNo });

    // Fetch full data again for DTO
    const fullData = await this.repository.findById(orderId);
    return new AdminAccountOrderDTO(
      fullData.orders,
      fullData.customers,
      fullData.employees,
      fullData.accounts
    );
  }

  async holdOrder(orderId, { holdReason }) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    const orderData = {
      status: 'On Hold',
    };

    const accountData = {
      remarks: holdReason,
    };

    await this.repository.updateOrder(orderId, orderData);
    // Determine if we need to create or update account
    // For now assuming updateAccount handles upsert or we just update remarks if exists
    // But repository.updateAccount might need logic. Let's assume it behaves like acceptOrder
    await this.repository.updateAccount(orderId, accountData);

    // Send Notification
    try {
      const full = await this.repository.findById(orderId);
      const { customers: customer, employees: salesperson, orders: order } = full;
      const customerName = customer ? customer.companyName : 'Customer';

      const recipientId = customer?.createdBy || salesperson?.employeeId;

      await this.notificationsService.createOrderStatusNotification(
        orderId,
        customerName,
        'On Hold',
        recipientId,
        order?.orderNumber
      );
    } catch (err) {
      console.error('Failed to send notification in holdOrder:', err);
    }

    const fullData = await this.repository.findById(orderId);
    return new AdminAccountOrderDTO(
      fullData.orders,
      fullData.customers,
      fullData.employees,
      fullData.accounts
    );
  }

  async rejectOrder(orderId, { rejectReason }) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    const orderData = {
      status: 'Rejected',
    };

    const accountData = {
      remarks: rejectReason,
    };

    await this.repository.updateOrder(orderId, orderData);
    await this.repository.updateAccount(orderId, accountData);

    // Send Notification
    try {
      const full = await this.repository.findById(orderId);
      const { customers: customer, employees: salesperson, orders: order } = full;
      const customerName = customer ? customer.companyName : 'Customer';

      const recipientId = customer?.createdBy || salesperson?.employeeId;

      await this.notificationsService.createOrderStatusNotification(
        orderId,
        customerName,
        'Rejected',
        recipientId,
        order?.orderNumber
      );
    } catch (err) {
      console.error('Failed to send notification in rejectOrder:', err);
    }

    const fullData = await this.repository.findById(orderId);
    return new AdminAccountOrderDTO(
      fullData.orders,
      fullData.customers,
      fullData.employees,
      fullData.accounts
    );
  }

  async resumeOrder(orderId) {
    const existing = await this.repository.findById(orderId);
    if (!existing) {
      throw new AppError('Order not found', 404);
    }

    const orderData = {
      status: 'Pending Accounts Approval',
    };

    await this.repository.updateOrder(orderId, orderData);

    // Optionally clear remarks or keep them? User didn't specify. Keeping them is safer.
    const fullData = await this.repository.findById(orderId);
    return new AdminAccountOrderDTO(
      fullData.orders,
      fullData.customers,
      fullData.employees,
      fullData.accounts
    );
  }

  async checkMaterialRequirements(orderId) {
    try {
      console.log(`Checking material requirements for order ${orderId}`);

      // Get order details with products
      const orderDetails = await this.repository.getOrderDetails(orderId);
      if (!orderDetails || !orderDetails.items) {
        console.log(`No order details found for order ${orderId}`);
        return;
      }

      console.log(`Found ${orderDetails.items.length} items in order ${orderId}`);
      const shortages = [];

      // Check each product in the order
      for (const item of orderDetails.items) {
        const productId = item.product.productId;
        const quantity = item.detail.quantity;
        const productName = item.product.productName;

        // 1. Check Finished Good Stock
        const productData = await this.productsRepository.findProductById(productId);
        const availableFG = productData ? productData.product.availableQuantity : 0;

        if (availableFG < quantity) {
          const productionNeeded = quantity - availableFG;

          // Alert for Finished Good Shortage
          shortages.push({
            materialId: productId,
            materialName: `${productName} (Finished Good)`,
            requiredQty: quantity,
            availableQty: availableFG,
            unit: 'Units', // Or fetch unit
            shortfall: productionNeeded,
            type: 'FinishedGood', // Helper tag
          });

          // 2. Check BOM Requirements ONLY for Production Needed
          if (productionNeeded > 0) {
            const requirements = await this.bomService.calculateBOMRequirements(
              productId,
              productionNeeded
            );

            // Filter out sufficient materials
            const criticalShortages = requirements.filter(
              req => req.Status === 'Critical' || req.Status === 'Low Stock'
            );

            for (const shortage of criticalShortages) {
              // Prevent duplicate RM alerts if multiple items use same RM (optional optimization, but strict check is fine)
              shortages.push({
                materialId: shortage.RawMaterialID,
                materialName: shortage.RawMaterialName,
                requiredQty: shortage.RequiredQty,
                availableQty: shortage.AvailableQty,
                unit: shortage.Unit,
                shortfall: shortage.RequiredQty - shortage.AvailableQty,
                type: 'RawMaterial',
              });
            }
          }
        }
      }

      console.log(`Found ${shortages.length} critical shortages for order ${orderId}`);

      // Create notifications if there are shortages
      if (shortages.length > 0) {
        console.log(`Creating notifications for ${shortages.length} shortages`);
        const customerName = orderDetails.customers?.companyName || 'Customer';
        await this.notificationsService.createMaterialShortageNotifications(
          orderId,
          shortages,
          orderDetails.orders?.orderNumber,
          customerName
        );
      } else {
        console.log(`No critical shortages found for order ${orderId}`);
      }
    } catch (error) {
      // Log error but don't fail the payment acceptance
      console.error('Error checking material requirements:', error);
    }
  }
}
