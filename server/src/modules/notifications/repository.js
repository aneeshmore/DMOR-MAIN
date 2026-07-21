import db from '../../db/index.js';
import { notifications } from '../../db/schema/auth/notifications.js';
import { notificationRules } from '../../db/schema/auth/notification-rules.js';
import { orders, customers, products } from '../../db/schema/index.js';
import { eq, and, desc, or, count, sql, inArray } from 'drizzle-orm';

export class NotificationsRepository {
  async create(notificationData) {
    const [notification] = await db.insert(notifications).values(notificationData).returning();
    return notification;
  }

  // --- Rules Management ---

  async createRule(ruleData) {
    const [rule] = await db.insert(notificationRules).values(ruleData).returning();
    return rule;
  }

  async deleteRule(ruleId) {
    const [deleted] = await db
      .delete(notificationRules)
      .where(eq(notificationRules.ruleId, ruleId))
      .returning();
    return deleted;
  }

  async getAllRules() {
    return await db.select().from(notificationRules).orderBy(notificationRules.notificationType);
  }

  /**
   * Resolves all unique employee IDs that should receive a notification of a given type.
   * Handles TargetType: 'USER', 'ROLE', 'DEPARTMENT'
   */
  async findRecipientsForType(type) {
    // We use a raw query for complex joins across multiple possible targets
    // This efficiently resolves the union of all targets into a distinct list of employees
    const query = sql`
      WITH active_rules AS (
        SELECT target_type, target_id
        FROM app.notification_rules
        WHERE notification_type = ${type} AND is_active = true
      )
      SELECT DISTINCT e.employee_id as "employeeId", e.first_name, e.last_name, e.email_id
      FROM app.employees e
      LEFT JOIN app.employee_roles er ON e.employee_id = er.employee_id
      LEFT JOIN app.roles r ON er.role_id = r.role_id
      LEFT JOIN app.departments d ON e.department_id = d.department_id
      WHERE 
        -- Rule Type: USER
        e.employee_id IN (SELECT target_id FROM active_rules WHERE target_type = 'USER')
        
        -- Rule Type: ROLE
        OR r.role_id IN (SELECT target_id FROM active_rules WHERE target_type = 'ROLE')
        
        -- Rule Type: DEPARTMENT
        OR d.department_id IN (SELECT target_id FROM active_rules WHERE target_type = 'DEPARTMENT')
        
        -- Ensure employee is active/not locked if applicable
        -- AND e.is_locked = false 
    `;

    const result = await db.execute(query);
    return result.rows;
  }

  // --- End Rules Management ---

  async findById(notificationId) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.notificationId, notificationId));
    return notification;
  }

  async findByRecipient(employeeId, { limit = 50, offset = 0, isRead, priority, type } = {}) {
    const whereConditions = [eq(notifications.recipientId, employeeId)];

    if (isRead !== undefined) {
      whereConditions.push(eq(notifications.isRead, isRead));
    }

    if (priority) {
      whereConditions.push(eq(notifications.priority, priority));
    }

    if (type) {
      whereConditions.push(eq(notifications.type, type));
    }

    const results = await db
      .select()
      .from(notifications)
      .where(and(...whereConditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  async findAll({ limit = 50, offset = 0 } = {}) {
    // Fetch all notifications regardless of recipient
    const results = await db
      .select({
        notificationId: notifications.notificationId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        priority: notifications.priority,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        recipientId: notifications.recipientId,
        data: notifications.data,
      })
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  async update(notificationId, updateData) {
    const [notification] = await db
      .update(notifications)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(notifications.notificationId, notificationId))
      .returning();
    return notification;
  }

  async getUnreadCount(employeeId) {
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.recipientId, employeeId), eq(notifications.isRead, false)));
    return result?.count || 0;
  }

  async findCriticalUnacknowledged(employeeId) {
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, employeeId),
          eq(notifications.isAcknowledged, false),
          or(eq(notifications.priority, 'critical'), eq(notifications.priority, 'high'))
        )
      )
      .orderBy(desc(notifications.createdAt));
  }

  async delete(notificationId) {
    await db.delete(notifications).where(eq(notifications.notificationId, notificationId));
  }

  // Helper for manual role lookups if needed
  async getEmployeesByRole(roles) {
    const roleNames = Array.isArray(roles) ? roles : [roles];
    if (roleNames.length === 0) return [];

    // [FIX 22P02] Bind role names as an IN list. Interpolating a JS array into
    // ANY(...) can send a plain-text param that Postgres rejects
    // ("Array value must start with {"), which aborts recipient resolution
    // and prevents notification rows from being created.
    const roleList = sql.join(
      roleNames.map(name => sql`${name}`),
      sql`, `
    );

    const result = await db.execute(sql`
        SELECT DISTINCT
            e.employee_id as "employeeId",
            e.first_name as "firstName",
            e.last_name as "lastName",
            e.email_id as "email"
        FROM app.employees e
        INNER JOIN app.employee_roles er ON e.employee_id = er.employee_id
        INNER JOIN app.roles r ON er.role_id = r.role_id
        WHERE r.role_name IN (${roleList})
    `);

    return result.rows;
  }

  /**
   * Order → salesperson/customer lookup used to scope order-based notifications
   * (e.g. Dispatch) to the employee responsible for each order.
   */
  async getOrderSalespersons(orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return [];
    const numericIds = orderIds.map(Number).filter(id => !Number.isNaN(id));
    if (numericIds.length === 0) return [];

    return await db
      .select({
        orderId: orders.orderId,
        orderNumber: orders.orderNumber,
        salespersonId: orders.salespersonId,
        customerName: customers.companyName,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .where(inArray(orders.orderId, numericIds));
  }

  /**
   * [LIVE SHORTAGE REFRESH] Current stock for a set of material ids.
   * FG SKUs live in app.products; RM/PM stock lives in master_product_rm/pm.
   * Returns Map<materialId, availableQty>.
   */
  async getCurrentStockLevels(materialIds) {
    const ids = [...new Set((materialIds || []).map(Number).filter(id => !Number.isNaN(id)))];
    const stockMap = new Map();
    if (ids.length === 0) return stockMap;

    // FG (products table)
    const fgRows = await db
      .select({ id: products.productId, qty: products.availableQuantity })
      .from(products)
      .where(inArray(products.productId, ids));
    fgRows.forEach(r => stockMap.set(Number(r.id), parseFloat(r.qty || 0)));

    // RM/PM (master product detail tables) — only ids not already resolved as FG
    const remaining = ids.filter(id => !stockMap.has(id));
    if (remaining.length > 0) {
      const idList = sql.join(
        remaining.map(id => sql`${id}`),
        sql`, `
      );
      const result = await db.execute(sql`
        SELECT mp.master_product_id AS id,
               COALESCE(rm.available_qty, pm.available_qty, 0) AS qty
        FROM app.master_products mp
        LEFT JOIN app.master_product_rm rm ON rm.master_product_id = mp.master_product_id
        LEFT JOIN app.master_product_pm pm ON pm.master_product_id = mp.master_product_id
        WHERE mp.master_product_id IN (${idList})
      `);
      (result.rows || []).forEach(r => stockMap.set(Number(r.id), parseFloat(r.qty || 0)));
    }

    return stockMap;
  }

  /**
   * [LOW STOCK] Is there already an active (not deleted) low-stock notification
   * for this product? Prevents one row per inventory transaction.
   */
  async hasActiveLowStockNotification(productId, productType) {
    const matchObj = { materialId: Number(productId) };
    if (productType) {
      matchObj.productType = productType;
    }
    const matchCriteria = JSON.stringify([matchObj]);
    const [row] = await db
      .select({ notificationId: notifications.notificationId })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, 'MaterialShortage'),
          sql`${notifications.data}->>'lowStock' = 'true'`,
          sql`(${notifications.data}->'shortages')::jsonb @> ${matchCriteria}::jsonb`
        )
      )
      .limit(1);
    return !!row;
  }

  async deleteByMaterialId(productId) {
    try {
      const id = Number(productId);
      const matchCriteria = JSON.stringify([{ materialId: id }]);
      const result = await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.type, 'MaterialShortage'),
            sql`data ? 'shortages'`,
            sql`(data->'shortages')::jsonb @> ${matchCriteria}::jsonb`
          )
        )
        .returning();
      return result;
    } catch (error) {
      console.error(`[NotificationsRepository] Failed cleanup:`, error);
      return null;
    }
  }

  async deleteByOrderIdAndType(orderId, types) {
    try {
      const typeList = Array.isArray(types) ? types : [types];
      const result = await db
        .delete(notifications)
        .where(
          and(inArray(notifications.type, typeList), sql`data->>'orderId' = ${orderId.toString()}`)
        )
        .returning();
      return result;
    } catch (error) {
      console.error(`[NotificationsRepository] Failed cleanup:`, error);
      return [];
    }
  }
}
