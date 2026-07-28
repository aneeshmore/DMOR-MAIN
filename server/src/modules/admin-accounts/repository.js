import crypto from 'crypto';
import { eq, ne, desc, and, or, isNull } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  orders,
  customers,
  employees,
  accounts,
  orderDetails,
  products,
} from '../../db/schema/index.js';

export class AdminAccountsRepository {
  async findAllPending() {
    return await db
      .select({
        orders,
        customers,
        employees,
        accounts,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(employees, eq(orders.salespersonId, employees.employeeId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(
        or(
          // Orders awaiting accounts approval (new + legacy status names)
          eq(orders.status, 'Pending Accounts Approval'),
          eq(orders.status, 'Pending'),
          // Orders on hold
          eq(orders.status, 'On Hold'),
          // Orders approved by accounts but not yet released to factory (new + legacy)
          eq(orders.status, 'Pending Factory Approval'),
          eq(orders.status, 'Verified')
        )
      )
      .orderBy(desc(orders.createdAt));
  }

  async findAllCancelled() {
    return await db
      .select({
        orders,
        customers,
        employees,
        accounts,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(employees, eq(orders.salespersonId, employees.employeeId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(or(eq(orders.status, 'Rejected'), eq(orders.status, 'Cancelled')))
      .orderBy(desc(orders.createdAt));
  }

  async findById(orderId) {
    const result = await db
      .select({
        orders,
        customers,
        employees,
        accounts,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.customerId))
      .leftJoin(employees, eq(orders.salespersonId, employees.employeeId))
      .leftJoin(accounts, eq(orders.orderId, accounts.orderId))
      .where(eq(orders.orderId, orderId))
      .limit(1);

    return result[0];
  }

  // excludeOrderId scopes the duplicate check to "does another order own this Bill No",
  // not "does a row with this Bill No exist". Without it, a plain WHERE billNo = X LIMIT 1
  // can return an arbitrary matching row (e.g. a split parent's row that legitimately shares
  // its Bill No with the child that inherited it), which the caller has no reliable way to
  // recognize as "not actually a conflict" after the fact.
  async findByBillNo(billNo, excludeOrderId = null) {
    const result = await db
      .select()
      .from(accounts)
      .where(
        excludeOrderId
          ? and(eq(accounts.billNo, billNo), ne(accounts.orderId, Number(excludeOrderId)))
          : eq(accounts.billNo, billNo)
      )
      .limit(1);

    return result[0];
  }

  async getOrderDetails(orderId) {
    const orderData = await this.findById(orderId);
    if (!orderData) return null;

    const items = await db
      .select({
        detail: orderDetails,
        product: products,
      })
      .from(orderDetails)
      .leftJoin(products, eq(orderDetails.productId, products.productId))
      .where(eq(orderDetails.orderId, orderId));

    return {
      ...orderData,
      items,
    };
  }

  async updateOrder(orderId, updateData) {
    const result = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.orderId, orderId))
      .returning();

    return result[0];
  }

  async updateAccount(orderId, accountData) {
    try {
      // Use upsert to handle both create and update scenarios atomically
      const result = await db
        .insert(accounts)
        .values({
          orderId,
          accountUuid: crypto.randomUUID(), // explicit UUID to avoid DB generation issues
          ...accountData,
        })
        .onConflictDoUpdate({
          target: accounts.orderId,
          set: { ...accountData, updatedAt: new Date() },
        })
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error in updateAccount:', error);
      throw error;
    }
  }
}
