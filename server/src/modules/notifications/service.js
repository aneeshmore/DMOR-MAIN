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
    // Map of notificationType → role names that should receive it by default.
    // Resolved by role NAME (not hardcoded IDs) so seeding works regardless of
    // the order roles were created in.
    const defaultRoleRules = [
      // New Order — accounts approval queue
      { notificationType: 'NewOrder', roleName: 'SuperAdmin' },
      { notificationType: 'NewOrder', roleName: 'Admin' },
      { notificationType: 'NewOrder', roleName: 'Accounts Manager' },
      // Order Update — every status change
      { notificationType: 'OrderUpdate', roleName: 'SuperAdmin' },
      { notificationType: 'OrderUpdate', roleName: 'Admin' },
      { notificationType: 'OrderUpdate', roleName: 'Sales Person' },
      { notificationType: 'OrderUpdate', roleName: 'Production Manager' },
      // Material Shortage — low stock / shortage alerts
      { notificationType: 'MaterialShortage', roleName: 'SuperAdmin' },
      { notificationType: 'MaterialShortage', roleName: 'Admin' },
      { notificationType: 'MaterialShortage', roleName: 'Accounts Manager' },
      { notificationType: 'MaterialShortage', roleName: 'Production Manager' },
      // Dispatch — dispatched / delivered orders
      { notificationType: 'Dispatch', roleName: 'SuperAdmin' },
      { notificationType: 'Dispatch', roleName: 'Admin' },
      { notificationType: 'Dispatch', roleName: 'Sales Person' },
    ];

    const { AuthorityRepository } = await import('../authority/repository.js');
    const authRepo = new AuthorityRepository();
    const allRoles = await authRepo.getAllRoles();

    const roleByName = new Map(
      allRoles.map(r => [(r.roleName || r.RoleName || '').toLowerCase(), r.roleId || r.RoleID])
    );

    let seeded = 0;
    for (const rule of defaultRoleRules) {
      const roleId = roleByName.get(rule.roleName.toLowerCase());
      if (!roleId) {
        console.warn(`[SeedRules] Role '${rule.roleName}' not found — skipping.`);
        continue;
      }
      try {
        await this.createRule({
          notificationType: rule.notificationType,
          targetType: 'ROLE',
          targetId: roleId,
        });
        seeded++;
      } catch (error) {
        // Ignore duplicate errors (unique constraint)
        if (!error.message?.includes('unique') && !error.message?.includes('duplicate')) {
          console.error(`Failed to seed rule: ${rule.notificationType}`, error.message);
        }
      }
    }

    return { seeded, total: defaultRoleRules.length };
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

    // [ROLE-BASED VISIBILITY] Shortage alerts go to subscribers configured in
    // Notification Settings (Accounts Manager + Production Manager by default).
    const recipients = await this.getRecipients('MaterialShortage');

    // [ADMIN VISIBILITY] If no employee holds the target roles, record the event as
    // a single unassigned row (recipientId: null) so the admin /all view still shows
    // it. NULL never matches an employee's personal feed, so delivery is unchanged.
    const effectiveRecipients = recipients.length > 0 ? recipients : [{ employeeId: null }];

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

      for (const recipient of effectiveRecipients) {
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
            link: '/operations/purchase-orders',
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

  /**
   * [LOW STOCK] Threshold-based low stock notification (not tied to an order).
   * Recipients: MaterialShortage subscribers (Accounts Manager + Production
   * Manager by default; admins see all via /all). Uses the MaterialShortage
   * type/data shape so every existing UI surface (Low Stock tab, ticker,
   * banner, grouping, restock cleanup) works unchanged.
   */
  async createLowStockNotification({ productId, productName, availableQty, minLevel, unit = '', productType }) {
    const recipients = await this.getRecipients('MaterialShortage');
    const effectiveRecipients = recipients.length > 0 ? recipients : [{ employeeId: null }];

    const title = `Low Stock: ${productName}`;
    const message = `Low stock detected for ${productName} — Available: ${availableQty}${unit ? ` ${unit}` : ''}, Minimum: ${minLevel}${unit ? ` ${unit}` : ''}. Procurement/Production action required.`;

    for (const recipient of effectiveRecipients) {
      await this.createNotification({
        recipientId: recipient.employeeId,
        type: 'MaterialShortage',
        title,
        message,
        data: {
          lowStock: true,
          shortages: [
            {
              materialId: Number(productId),
              productType: productType || 'FG',
              materialName: productName,
              requiredQty: minLevel,
              availableQty,
              unit,
            },
          ],
          link: '/operations/purchase-orders',
        },
        priority: availableQty <= 0 ? 'critical' : 'high',
        isRead: false,
        isAcknowledged: false,
      });
    }
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

    const priority = status === 'Rejected' || status === 'On Hold' ? 'high' : 'normal';
    // customerName included so the frontend (e.g. alert ticker) can display it directly
    const data = { orderId, orderNumber, customerName, status };

    // -----------------------------------------------------------------------
    // RECIPIENT RESOLUTION — matches the designed workflow:
    //
    // Pending Factory Approval → Salesperson + Production Manager
    // Factory Approved         → Salesperson only (PM acted, no self-notify)
    // Scheduled for Production → Salesperson only
    // Ready for Dispatch       → Salesperson only
    // On Hold / Rejected       → Salesperson + rule-based subscribers
    //
    // Salespersons must only receive updates for their OWN orders, so other
    // rule-subscribed salespersons are excluded below.
    // -----------------------------------------------------------------------

    const ruleRecipients = await this.getRecipients('OrderUpdate');
    const ruleRecipientIds = new Set(ruleRecipients.map(r => r.employeeId));

    // Non-critical: if the role lookup fails, continue without salesperson scoping
    // rather than losing the notification entirely.
    let allSalespersons = [];
    try {
      allSalespersons = await this.repository.getEmployeesByRole(['Sales Person']);
    } catch (err) {
      console.error('[NotificationService] Salesperson role lookup failed:', err);
    }
    const salespersonIds = new Set(allSalespersons.map(r => r.employeeId));

    const employeeRecipients = new Set(); // track notified employee IDs to avoid duplication

    // 1. Notify the order's Salesperson for statuses they care about, IF subscribed
    const salespersonStatuses = [
      'Pending Factory Approval',
      'Factory Approved',
      'Scheduled for Production',
      'Ready for Dispatch',
      'On Hold',
      'Rejected',
      // Legacy status names (existing orders)
      'Verified',
      'Accepted',
    ];
    if (
      salesPersonId &&
      salespersonStatuses.includes(status) &&
      ruleRecipientIds.has(salesPersonId)
    ) {
      await this.createNotification({
        recipientId: salesPersonId,
        type: 'OrderUpdate',
        title,
        message,
        data,
        priority,
        isRead: false,
      });
      employeeRecipients.add(salesPersonId);
    }

    // 2. Notify other rule-based subscribers for all order updates
    for (const user of ruleRecipients) {
      // Prevent spamming salespersons with updates for orders they don't own
      if (salespersonIds.has(user.employeeId) && user.employeeId !== salesPersonId) {
        continue;
      }

      if (!employeeRecipients.has(user.employeeId)) {
        await this.createNotification({
          recipientId: user.employeeId,
          type: 'OrderUpdate',
          title,
          message,
          data,
          priority,
          isRead: false,
        });
        employeeRecipients.add(user.employeeId);
      }
    }

    // [ADMIN VISIBILITY] If no recipient row was created (e.g. order has no salesperson
    // and no matching role employees), record one unassigned row so the admin /all
    // view still shows the event. Invisible to employee personal feeds.
    if (employeeRecipients.size === 0) {
      await this.createNotification({
        recipientId: null,
        type: 'OrderUpdate',
        title,
        message,
        data,
        priority,
        isRead: false,
      });
    }
  }

  async createNewOrderNotification(
    orderId,
    customerName,
    totalAmount,
    salesPersonName,
    orderNumber = null,
    // { portion: 'Dispatch' | 'Balance', originalOrderNumber, customRemark } for a split
    // child order, or null for a normal order. Optional and defaulted, so every existing
    // caller keeps its current behaviour unchanged.
    splitInfo = null
  ) {
    const displayId = orderNumber ? `${orderNumber}` : `Order #${orderId}`;
    // A split produces two children at once. Without naming the portion and the parent,
    // both arrive as identical "Pending Order" entries and the Accounts Manager cannot tell
    // the dispatch half from the balance half.
    const title = splitInfo
      ? `Pending Split Order (${splitInfo.portion}): ${customerName}`
      : `Pending Order: ${customerName}`;
    const message = splitInfo
      ? `Split order — ${splitInfo.portion} portion${
          splitInfo.originalOrderNumber ? ` of ${splitInfo.originalOrderNumber}` : ''
        } — from ${customerName} (₹${totalAmount}) by ${salesPersonName}.${
          splitInfo.customRemark ? ` Remark: "${splitInfo.customRemark}".` : ''
        } Check payment.`
      : `New order from ${customerName} (₹${totalAmount}) by ${salesPersonName}. Check payment.`;

    // [ROLE-BASED VISIBILITY] New orders pending accounts approval go to the
    // Accounts Manager subscribers. Admins see all events via the /all view.
    const recipients = await this.getRecipients('NewOrder');

    // [ADMIN VISIBILITY] Fall back to one unassigned row when no subscribers exist
    const effectiveRecipients = recipients.length > 0 ? recipients : [{ employeeId: null }];

    for (const recipient of effectiveRecipients) {
      await this.createNotification({
        recipientId: recipient.employeeId,
        type: 'NewOrder',
        title,
        message,
        data: {
          orderId,
          orderNumber,
          customerName,
          status: 'Pending Accounts Approval',
          // Present only for split children, so the UI can label the portion and link back
          // to the parent without re-parsing the remark text.
          ...(splitInfo
            ? {
                isSplit: true,
                splitPortion: splitInfo.portion,
                parentOrderNumber: splitInfo.originalOrderNumber || null,
              }
            : {}),
        },
        priority: 'normal',
        isRead: false,
      });
    }
  }

  async createDispatchNotification(dispatchId, vehicleNo, orderIds, driverName) {
    const title = `Vehicle Dispatched: ${vehicleNo}`;

    // [ROLE-BASED VISIBILITY] Dispatch notifications are driven by Notification
    // Settings ('Dispatch' rules). Salespersons only see dispatches for their own
    // orders; other subscribers (e.g. Admin/PM) get the full order list.
    const ruleRecipients = await this.getRecipients('Dispatch');
    const ruleRecipientIds = new Set(ruleRecipients.map(r => r.employeeId));

    // Non-critical: if the role lookup fails, continue without salesperson scoping
    let allSalespersons = [];
    try {
      allSalespersons = await this.repository.getEmployeesByRole(['Sales Person']);
    } catch (err) {
      console.error('[NotificationService] Salesperson role lookup failed:', err);
    }
    const salespersonIds = new Set(allSalespersons.map(r => r.employeeId));

    const employeeRecipients = new Set();
    const orderOwners = await this.repository.getOrderSalespersons(orderIds);

    const ordersBySalesperson = new Map();
    for (const owner of orderOwners) {
      if (!owner.salespersonId) continue;
      if (!ordersBySalesperson.has(owner.salespersonId)) {
        ordersBySalesperson.set(owner.salespersonId, []);
      }
      ordersBySalesperson.get(owner.salespersonId).push(owner);
    }

    // Helper: display strings for a set of orders (order numbers + customer names)
    const describeOrders = list => {
      const orderLabels = list.map(o => o.orderNumber || `#${o.orderId}`);
      const customerNames = [...new Set(list.map(o => o.customerName).filter(Boolean))];
      return { orderLabels, customerNames };
    };
    const buildMessage = (orderLabels, customerNames) => {
      const customerSuffix = customerNames.length > 0 ? ` for ${customerNames.join(', ')}` : '';
      return `Dispatch #${dispatchId} initiated. Driver: ${driverName}. Orders: ${
        orderLabels.length > 0 ? orderLabels.join(', ') : orderIds.join(', ')
      }${customerSuffix}`;
    };

    // 1. Each salesperson: only their own orders, only if subscribed
    for (const [salespersonId, ownOrders] of ordersBySalesperson) {
      if (!ruleRecipientIds.has(salespersonId)) continue; // enforce privilege

      const { orderLabels, customerNames } = describeOrders(ownOrders);
      await this.createNotification({
        recipientId: salespersonId,
        type: 'Dispatch',
        title,
        message: buildMessage(orderLabels, customerNames),
        data: {
          dispatchId,
          orderIds: ownOrders.map(o => o.orderId),
          orderNumbers: orderLabels,
          customerNames,
        },
        priority: 'normal',
        isRead: false,
      });
      employeeRecipients.add(salespersonId);
    }

    // 2. Other rule-based subscribers (non-salespersons) get the full list
    for (const user of ruleRecipients) {
      if (salespersonIds.has(user.employeeId)) continue; // no cross-order dispatches for salespeople
      if (employeeRecipients.has(user.employeeId)) continue;

      const { orderLabels, customerNames } = describeOrders(orderOwners);
      await this.createNotification({
        recipientId: user.employeeId,
        type: 'Dispatch',
        title,
        message: buildMessage(orderLabels, customerNames),
        data: { dispatchId, orderIds, orderNumbers: orderLabels, customerNames },
        priority: 'normal',
        isRead: false,
      });
      employeeRecipients.add(user.employeeId);
    }

    // [ADMIN VISIBILITY] No recipient row created — record one unassigned row so
    // the admin /all view still shows the dispatch event.
    if (employeeRecipients.size === 0) {
      const { orderLabels, customerNames } = describeOrders(orderOwners);
      await this.createNotification({
        recipientId: null,
        type: 'Dispatch',
        title,
        message: buildMessage(orderLabels, customerNames),
        data: { dispatchId, orderIds, orderNumbers: orderLabels, customerNames },
        priority: 'normal',
        isRead: false,
      });
    }
  }

  async createBatchCompletionNotification(batchId, productName, quantity, batchCode) {
    const title = `Production Completed: ${batchCode || batchId}`;
    const message = `Batch ${batchCode || batchId} for ${productName} (${quantity} units) has been completed and added to stock.`;

    const recipients = await this.getRecipients('OrderUpdate');

    // [ADMIN VISIBILITY] Fall back to one unassigned row when no subscribers exist
    const effectiveRecipients = recipients.length > 0 ? recipients : [{ employeeId: null }];

    for (const u of effectiveRecipients) {
      await this.createNotification({
        recipientId: u.employeeId,
        // [TYPE FIX] The Accepted tab filters on type 'ProductionComplete';
        // 'OrderUpdate' without a status never surfaced there
        type: 'ProductionComplete',
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

    // [ADMIN VISIBILITY] Fall back to one unassigned row when no subscribers exist
    const effectiveRecipients = recipients.length > 0 ? recipients : [{ employeeId: null }];

    for (const u of effectiveRecipients) {
      await this.createNotification({
        recipientId: u.employeeId,
        // [TYPE FIX] The Dispatch tab filters on type 'Delivery' for delivered dispatches
        type: 'Delivery',
        title,
        message,
        data: { dispatchId, orderIds },
        priority: 'normal',
        isRead: false,
      });
    }
  }

  // --- Read/Query Methods ---

  /**
   * [CUSTOMER NAME ENRICHMENT] Older Dispatch/Delivery rows were created without
   * customerNames/orderNumbers in data. Resolve them at read time from the orders
   * table so the UI (ticker/cards) can always show the customer's company name.
   * Response-only — stored rows are not modified.
   */
  async enrichDispatchCustomerNames(notificationList) {
    const needing = notificationList.filter(
      n =>
        (n.type === 'Dispatch' || n.type === 'Delivery') &&
        n.data &&
        Array.isArray(n.data.orderIds) &&
        n.data.orderIds.length > 0 &&
        (!Array.isArray(n.data.customerNames) || n.data.customerNames.length === 0)
    );
    if (needing.length === 0) return notificationList;

    try {
      const allIds = [...new Set(needing.flatMap(n => n.data.orderIds.map(Number)))];
      const owners = await this.repository.getOrderSalespersons(allIds);
      const byId = new Map(owners.map(o => [o.orderId, o]));

      for (const n of needing) {
        const infos = n.data.orderIds.map(id => byId.get(Number(id))).filter(Boolean);
        const customerNames = [...new Set(infos.map(i => i.customerName).filter(Boolean))];
        const orderNumbers = infos.map(i => i.orderNumber).filter(Boolean);
        if (customerNames.length > 0 || orderNumbers.length > 0) {
          n.data = { ...n.data, customerNames, orderNumbers };
        }
      }
    } catch (err) {
      console.error('Failed to enrich dispatch notifications with customer names:', err);
    }
    return notificationList;
  }

  /**
   * [LIVE SHORTAGE REFRESH] Shortage notifications store a stock snapshot from
   * creation time. Refresh availableQty/shortfall against current stock at read
   * time so banners/cards show the real remaining shortage (response-only).
   */
  async refreshShortageAvailability(notificationList) {
    const rows = notificationList.filter(
      n =>
        n.type === 'MaterialShortage' &&
        Array.isArray(n.data?.shortages) &&
        n.data.shortages.length > 0
    );
    if (rows.length === 0) return notificationList;

    try {
      const ids = [
        ...new Set(
          rows.flatMap(n =>
            n.data.shortages.map(s => Number(s.materialId)).filter(id => !Number.isNaN(id))
          )
        ),
      ];
      const stockMap = await this.repository.getCurrentStockLevels(ids);

      for (const n of rows) {
        n.data = {
          ...n.data,
          shortages: n.data.shortages.map(s => {
            const live = stockMap.get(Number(s.materialId));
            if (live === undefined) return s;
            const requiredQty = Number(s.requiredQty) || 0;
            return {
              ...s,
              availableQty: live,
              shortfall: Math.max(0, requiredQty - live),
            };
          }),
        };
      }
    } catch (err) {
      console.error('Failed to refresh shortage availability:', err);
    }
    return notificationList;
  }

  async getUserNotifications(employeeId, { limit = 50, offset = 0, isRead, priority, type } = {}) {
    const notifications = await this.repository.findByRecipient(employeeId, {
      limit,
      offset,
      isRead,
      priority,
      type,
    });

    await this.enrichDispatchCustomerNames(notifications);
    await this.refreshShortageAvailability(notifications);

    // [LATEST PER ORDER] Employees see only the most recent lifecycle notification
    // for each order. Applies to 'OrderUpdate' rows only (status progression);
    // NewOrder, MaterialShortage, Dispatch etc. are left untouched.
    // Rows arrive sorted by createdAt DESC, so the first row per order wins.
    const seenOrderIds = new Set();
    const latestPerOrder = notifications.filter(n => {
      if (n.type !== 'OrderUpdate' || n.data?.orderId == null) return true;
      if (seenOrderIds.has(n.data.orderId)) return false;
      seenOrderIds.add(n.data.orderId);
      return true;
    });

    return latestPerOrder.map(n => new NotificationDTO(n));
  }

  async getAllSystemNotifications(employeeId, { limit = 100, offset = 0, role } = {}) {
    // [ROLE-BASED VISIBILITY] The system-wide view is admin-only. Employee
    // personal feeds already deliver everything each role should see.
    const isAdminViewer = ['Admin', 'SuperAdmin', 'Administrator', 'administrator'].includes(role);
    if (!isAdminViewer) {
      throw new AppError('Access denied: Admin view only', 403);
    }

    const notifications = await this.repository.findAll({ limit, offset });

    await this.enrichDispatchCustomerNames(notifications);
    await this.refreshShortageAvailability(notifications);

    // [ADMIN VISIBILITY] The caller is a verified admin (gate above), so no further
    // per-type filtering. The old 'inward'/'production' permission filter silently
    // stripped every MaterialShortage (Low Stock) row from the admin monitoring
    // view whenever the admin's permission set lacked those exact names.
    return notifications.map(n => new NotificationDTO(n));
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
