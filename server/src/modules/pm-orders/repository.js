import { eq, desc, and, inArray } from 'drizzle-orm';
import db from '../../db/index.js';
import { orders, customers, employees, accounts } from '../../db/schema/index.js';

export class PMOrdersRepository {
  async findApprovalQueue() {
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
      .where(inArray(orders.status, ['Factory Approved', 'Accepted'])) // Approved by Accounts (new + legacy status names)
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

  async update(orderId, updateData) {
    const result = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.orderId, orderId))
      .returning();

    return result[0];
  }
}
