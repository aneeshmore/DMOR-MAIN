import { NotificationsRepository } from './repository.js';
import { NotificationDTO } from './dto.js';
import { AppError } from '../../utils/AppError.js';

export class NotificationsService {
  constructor() {
    this.repository = new NotificationsRepository();
  }

  async createNotification(notificationData) {
    const notification = await this.repository.create(notificationData);
    return new NotificationDTO(notification);
  }

  // --- Rule Management ---

  async createRule(ruleData) {
    const rule = await this.repository.createRule(ruleData);

    // Auto-assign permissions if targeting a Role
    if (ruleData.targetType === 'ROLE' && ruleData.targetId) {
      await this.autoAssignPermissions(ruleData.targetId, ruleData.notificationType);
    }
    return rule;
  }

  async autoAssignPermissions(roleId, notificationType) {
    try {
      const { AuthorityRepository } = await import('../authority/repository.js');
      const authRepo = new AuthorityRepository();

      let requiredModule = '';
      switch (notificationType) {
        case 'MaterialShortage':
          requiredModule = 'inventory'; // Access to Low Stock products
          break;
        case 'OrderUpdate':
          requiredModule = 'orders'; // Access to Order details
          break;
      }

      if (!requiredModule) return;

      // 1. Get Permission ID
      const allPerms = await authRepo.getAllPermissions();
      const permDef = allPerms.find(p => p.permissionName === requiredModule);

      if (!permDef) {
        console.warn(`[AutoPerm] Check failed: Permission '${requiredModule}' not found in DB.`);
        return;
      }

      // 2. Check existing permissions for this role
      const rolePerms = await authRepo.getRolePermissionsById(roleId);
      const existing = rolePerms.find(rp => rp.permissionId === permDef.permissionId);

      let newActions = ['view'];
      if (existing) {
        // If already has 'view', do nothing
        if (existing.grantedActions.includes('view')) return;

        // Append 'view' to existing actions
        newActions = [...new Set([...existing.grantedActions, 'view'])];
      }

      // 3. Grant Permission
      await authRepo.updateRolePermission(roleId, permDef.permissionId, newActions);
      console.log(
        `[AutoPerm] Automatically granted 'view' access on '${requiredModule}' to Role ID ${roleId}`
      );
    } catch (error) {
      console.error('[AutoPerm] Failed to auto-assign permission:', error);
    }
  }

  async deleteRule(ruleId) {
    return await this.repository.deleteRule(ruleId);
  }

  async getAllRules() {
    const rules = await this.repository.getAllRules();
    return rules;
  }

  /**
   * Seed default notification rules
   * Creates rules for common notification types targeting appropriate roles
   */
  async seedDefaultRules() {
    const defaultRules = [
      // Material Shortage - notify Production Manager, Inventory Manager
      { notificationType: 'MaterialShortage', targetType: 'ROLE', targetId: 3 }, // Production Manager
      { notificationType: 'MaterialShortage', targetType: 'ROLE', targetId: 6 }, // Inventory Manager

      // New Order - notify Admin
      { notificationType: 'NewOrder', targetType: 'ROLE', targetId: 2 }, // Admin

      // Order Update - notify Admin, Sales Manager, Production Manager
      { notificationType: 'OrderUpdate', targetType: 'ROLE', targetId: 2 }, // Admin
      { notificationType: 'OrderUpdate', targetType: 'ROLE', targetId: 3 }, // Production Manager
      { notificationType: 'OrderUpdate', targetType: 'ROLE', targetId: 4 }, // Sales Manager
    ];

    let seeded = 0;
    for (const rule of defaultRules) {
      try {
        await this.createRule(rule);
        seeded++;
      } catch (error) {
        // Ignore duplicate errors (unique constraint)
        if (!error.message?.includes('unique') && !error.message?.includes('duplicate')) {
          console.error(`Failed to seed rule: ${rule.notificationType}`, error.message);
        }
      }
    }

    return { seeded, total: defaultRules.length };
  }

  /**
   * Helper to get recipients dynamically
   */
  async getRecipients(type) {
    const recipients = await this.repository.findRecipientsForType(type);
    return recipients || []; // Return empty if no rules found
  }

  // --- Refactored Notification Methods ---

  async createMaterialShortageNotifications(orderId, shortages, orderNumber = null, customerName = null) {
    console.log(
      `[NotificationService] Processing material shortage notifications for order ${orderId}`
    );

    // DYNAMIC RECIPIENTS
    const recipients = await this.getRecipients('MaterialShortage');

    // Fallback/Safety: If no rules, user might miss critical alerts.
    // In production, we'd want a failsafe. For now, we trust the System Designer (ME) to seed rules.
    console.log(
      `[NotificationService] Sending 'MaterialShortage' to ${recipients.length} recipients.`
    );

    const notifications = [];

    for (const shortage of shortages) {
      const priority =
        shortage.availableQty === 0
          ? 'critical'
          : shortage.availableQty < shortage.requiredQty * 0.5
            ? 'critical'
            : shortage.availableQty < shortage.requiredQty * 0.8
              ? 'high'
              : 'normal';

      const displayCustomer = customerName ? `${customerName}` : `Order #${orderId}`;
      const title = `${displayCustomer} - Material Shortage`;

      const message =
        priority === 'critical'
          ? `${displayCustomer} requires ${shortage.materialName}. Required: ${shortage.requiredQty} ${shortage.unit}, Available: ${shortage.availableQty} ${shortage.unit}. Immediate procurement needed.`
          : `${displayCustomer} requires ${shortage.materialName}. Required: ${shortage.requiredQty} ${shortage.unit}, Available: ${shortage.availableQty} ${shortage.unit}. Plan procurement soon.`;

      for (const recipient of recipients) {
        const notification = await this.createNotification({
          recipientId: recipient.employeeId,
          type: 'MaterialShortage',
          title,
          message,
          data: {
            orderId,
            orderNumber,
            customerName,
            shortages: [shortage],
            link: '/operations/pm-inward',
          },
          priority,
          isRead: false,
          isAcknowledged: false,
        });
        notifications.push(notification);
      }
    }
    return notifications;
  }

  async createOrderStatusNotification(
    orderId,
    customerName,
    status,
    salesPersonId,
    orderNumber = null
  ) {
    const displayId = orderNumber ? `${orderNumber}` : `Order #${orderId}`;
    const title = `${customerName} - ${status}`;

    let message;
    if (status === 'Factory Approved' || status === 'Accepted') {
      message = `${displayId} for ${customerName} has been approved for production.`;
    } else if (status === 'Pending Factory Approval') {
      message = `${displayId} for ${customerName} approved by accounts, awaiting factory approval.`;
    } else if (status === 'Scheduled for Production') {
      message = `${displayId} for ${customerName} has been scheduled for production.`;
    } else if (status === 'Ready for Dispatch') {
      message = `${displayId} for ${customerName} is ready for dispatch.`;
    } else if (status === 'On Hold') {
      message = `${displayId} for ${customerName} has been put on hold by accountant.`;
    } else if (status === 'Rejected') {
      message = `${displayId} for ${customerName} has been rejected/cancelled by accountant.`;
    } else {
      message = `${displayId} for ${customerName} status updated to ${status}.`;
    }

    // 1. Always notify the relevant Salesperson (Direct Logic remains)
    if (salesPersonId) {
      await this.createNotification({
        recipientId: salesPersonId,
        type: 'OrderUpdate',
        title,
        message,
        data: { orderId, status },
        priority: status === 'Rejected' || status === 'On Hold' ? 'high' : 'normal',
        isRead: false,
      });
    }

    // 2. Dynamic Rules for other stakeholders
    if (['Factory Approved', 'Accepted', 'On Hold', 'Rejected'].includes(status)) {
      const recipients = await this.getRecipients('OrderUpdate'); // General subscribers

      // We might want to filter contextually (e.g., Accountants only care about X).
      // For now, the Rule System is "If you sub to OrderUpdate, you get OrderUpdates".
      // Users can refine via UI later if we add 'event_subtype' to rules.

      // Dedup against salesperson
      const uniqueRecipients = recipients.filter(r => r.employeeId !== salesPersonId);

      for (const user of uniqueRecipients) {
        await this.createNotification({
          recipientId: user.employeeId,
          type: 'OrderUpdate',
          title,
          message,
          data: { orderId, orderNumber, status },
          priority: status === 'Factory Approved' || status === 'Accepted' ? 'normal' : 'high',
          isRead: false,
        });
      }
    }
  }

  async createNewOrderNotification(
    orderId,
    customerName,
    totalAmount,
    salesPersonName,
    orderNumber = null
  ) {
    const displayId = orderNumber ? `${orderNumber}` : `Order #${orderId}`;
    const title = `Pending Order: ${customerName}`;
    const message = `New order from ${customerName} (₹${totalAmount}) by ${salesPersonName}. Check payment.`;

    const recipients = await this.getRecipients('NewOrder');

    for (const recipient of recipients) {
      await this.createNotification({
        recipientId: recipient.employeeId,
        type: 'NewOrder',
        title,
        message,
        data: { orderId, orderNumber, customerName, status: 'Pending Accounts Approval' },
        priority: 'normal',
        isRead: false,
      });
    }
  }

  async createDispatchNotification(dispatchId, vehicleNo, orderIds, driverName) {
    const title = `Vehicle Dispatched: ${vehicleNo}`;
    const message = `Dispatch #${dispatchId} initiated. Driver: ${driverName}. Orders: ${orderIds.join(', ')}`;

    const recipients = await this.getRecipients('OrderUpdate');

    for (const recipient of recipients) {
      await this.createNotification({
        recipientId: recipient.employeeId,
        type: 'OrderUpdate',
        title,
        message,
        data: { dispatchId, orderIds },
        priority: 'normal',
        isRead: false,
      });
    }
  }

  async createBatchCompletionNotification(batchId, productName, quantity, batchCode) {
    const title = `Production Completed: ${batchCode || batchId}`;
    const message = `Batch ${batchCode || batchId} for ${productName} (${quantity} units) has been completed and added to stock.`;

    const recipients = await this.getRecipients('OrderUpdate');

    for (const u of recipients) {
      await this.createNotification({
        recipientId: u.employeeId,
        type: 'OrderUpdate',
        title,
        message,
        data: { batchId, batchCode },
        priority: 'normal',
        isRead: false,
      });
    }
  }

  async createDeliveryNotification(dispatchId, vehicleNo, orderIds, remarks) {
    const title = `Delivery Completed: Dispatch #${dispatchId}`;
    const ordersStr = orderIds.length > 0 ? `Orders: ${orderIds.join(', ')}.` : '';
    const message = `Dispatch #${dispatchId} (${vehicleNo}) has been marked as Delivered. ${ordersStr} ${remarks ? `Remarks: ${remarks}` : ''}`;

    const recipients = await this.getRecipients('OrderUpdate');

    for (const u of recipients) {
      await this.createNotification({
        recipientId: u.employeeId,
        type: 'OrderUpdate',
        title,
        message,
        data: { dispatchId, orderIds },
        priority: 'normal',
        isRead: false,
      });
    }
  }

  // --- Read/Query Methods (Unchanged mostly) ---

  async getUserNotifications(employeeId, { limit = 50, offset = 0, isRead, priority, type } = {}) {
    const notifications = await this.repository.findByRecipient(employeeId, {
      limit,
      offset,
      isRead,
      priority,
      type,
    });

    return notifications.map(n => new NotificationDTO(n));
  }

  async getAllSystemNotifications(employeeId, { limit = 100, offset = 0 } = {}) {
    const notifications = await this.repository.findAll({ limit, offset });

    try {
      // Fetch user permissions for dynamic filtering
      const { AuthorityRepository } = await import('../authority/repository.js');
      const authorityRepository = new AuthorityRepository();
      const permissions = await authorityRepository.getUserPermissions(employeeId);

      // Define capability checks
      const canViewInward = permissions.some(
        p => p.permissionName === 'inward' && p.grantedActions.includes('view')
      );
      const canViewProduction = permissions.some(
        p => p.permissionName === 'production' && p.grantedActions.includes('view')
      );
      const canViewStock = canViewInward || canViewProduction;

      // Filter
      return notifications
        .filter(n => {
          if (n.type === 'MaterialShortage' && !canViewStock) return false;
          return true;
        })
        .map(n => new NotificationDTO(n));
    } catch (error) {
      console.error('[NotificationsService] Error fetching permissions for filtering:', error);
      return notifications.map(n => new NotificationDTO(n));
    }
  }

  async markAsRead(notificationId, employeeId, userRole) {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    const isAdmin = ['Admin', 'SuperAdmin', 'Administrator'].includes(userRole);
    if (notification.recipientId !== employeeId && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    await this.repository.update(notificationId, { isRead: true });
    return { success: true };
  }

  async acknowledgeNotification(notificationId, employeeId, userRole) {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    const isAdmin = ['Admin', 'SuperAdmin', 'Administrator'].includes(userRole);
    if (notification.recipientId !== employeeId && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    await this.repository.update(notificationId, {
      isAcknowledged: true,
      isRead: true,
    });

    this.scheduleAutoDeletion(notificationId);

    return { success: true };
  }

  async deleteNotification(notificationId, employeeId, userRole) {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    const isAdmin = ['Admin', 'SuperAdmin', 'Administrator'].includes(userRole);
    if (notification.recipientId !== employeeId && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    await this.repository.delete(notificationId);
    return { success: true };
  }

  scheduleAutoDeletion(notificationId) {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    setTimeout(async () => {
      try {
        await this.repository.delete(notificationId);
        console.log(
          `[NotificationService] Auto-deleted notification ${notificationId} after 12 hours`
        );
      } catch (error) {
        console.error(
          `[NotificationService] Failed to auto-delete notification ${notificationId}:`,
          error
        );
      }
    }, TWELVE_HOURS);
  }

  async getUnreadCount(employeeId) {
    return await this.repository.getUnreadCount(employeeId);
  }

  async getCriticalAlerts(employeeId) {
    const notifications = await this.repository.findCriticalUnacknowledged(employeeId);
    return notifications.map(n => new NotificationDTO(n));
  }

  async clearResolvedShortageAlerts(productId, currentQty, threshold) {
    if (currentQty >= threshold) {
      console.log(
        `[NotificationService] Stock level resolved for material ${productId} (${currentQty} >= ${threshold}). Clearing alerts.`
      );
      await this.repository.deleteByMaterialId(Number(productId));
      return true;
    }
    return false;
  }

  async clearNotificationsForOrder(orderId, types) {
    return await this.repository.deleteByOrderIdAndType(orderId, types);
  }
}
