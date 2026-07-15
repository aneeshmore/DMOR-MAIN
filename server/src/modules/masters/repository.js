import { eq, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  departments,
  units,
  employees,
  customers,
  customerTypes,
  orders,
  roles,
} from '../../db/schema/index.js';

export class MastersRepository {
  // Department methods
  async findAllDepartments() {
    return await db
      .select()
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(departments.departmentName);
  }

  async findDepartmentById(departmentId) {
    const result = await db
      .select()
      .from(departments)
      .where(eq(departments.departmentId, departmentId))
      .limit(1);

    return result[0] || null;
  }

  async createDepartment(departmentData) {
    const result = await db.insert(departments).values(departmentData).returning();

    return result[0];
  }

  async updateDepartment(departmentId, updateData) {
    const result = await db
      .update(departments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(departments.departmentId, departmentId))
      .returning();

    return result[0];
  }

  async deleteDepartment(departmentId) {
    const result = await db
      .delete(departments)
      .where(eq(departments.departmentId, departmentId))
      .returning();

    return result[0];
  }

  // Unit methods
  async findAllUnits() {
    return await db.select().from(units).orderBy(units.unitName);
  }

  async findUnitById(unitId) {
    const result = await db.select().from(units).where(eq(units.unitId, unitId)).limit(1);

    return result[0] || null;
  }

  async findUnitByName(unitName, excludeUnitId = null) {
    const { sql, and, ne } = await import('drizzle-orm');

    let query = db
      .select()
      .from(units)
      .where(sql`LOWER(${units.unitName}) = LOWER(${unitName})`);

    // If updating, exclude the current unit from the check
    if (excludeUnitId) {
      query = query.where(
        and(sql`LOWER(${units.unitName}) = LOWER(${unitName})`, ne(units.unitId, excludeUnitId))
      );
    }

    const result = await query.limit(1);
    return result[0] || null;
  }

  async createUnit(unitData) {
    const result = await db.insert(units).values(unitData).returning();

    return result[0];
  }

  async updateUnit(unitId, updateData) {
    const result = await db
      .update(units)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(units.unitId, unitId))
      .returning();

    return result[0];
  }

  async deleteUnit(unitId) {
    await db.delete(units).where(eq(units.unitId, unitId));
  }

  // Customer Type methods
  async findAllCustomerTypes() {
    return await db.select().from(customerTypes).orderBy(customerTypes.customerTypeName);
  }

  async findCustomerTypeById(customerTypeId) {
    const result = await db
      .select()
      .from(customerTypes)
      .where(eq(customerTypes.customerTypeId, customerTypeId))
      .limit(1);

    return result[0] || null;
  }

  async findCustomerTypeByName(customerTypeName, excludeCustomerTypeId = null) {
    const { sql, and, ne } = await import('drizzle-orm');

    let query = db
      .select()
      .from(customerTypes)
      .where(sql`LOWER(${customerTypes.customerTypeName}) = LOWER(${customerTypeName})`);

    // If updating, exclude the current customer type from the check
    if (excludeCustomerTypeId) {
      query = query.where(
        and(
          sql`LOWER(${customerTypes.customerTypeName}) = LOWER(${customerTypeName})`,
          ne(customerTypes.customerTypeId, excludeCustomerTypeId)
        )
      );
    }

    const result = await query.limit(1);
    return result[0] || null;
  }

  async createCustomerType(customerTypeData) {
    const result = await db.insert(customerTypes).values(customerTypeData).returning();

    return result[0];
  }

  async updateCustomerType(customerTypeId, updateData) {
    const result = await db
      .update(customerTypes)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(customerTypes.customerTypeId, customerTypeId))
      .returning();

    return result[0];
  }

  async deleteCustomerType(customerTypeId) {
    await db.delete(customerTypes).where(eq(customerTypes.customerTypeId, customerTypeId));
  }

  // Employee methods (for validation)
  async findEmployeeById(employeeId) {
    const result = await db
      .select()
      .from(employees)
      .where(eq(employees.employeeId, employeeId))
      .limit(1);

    return result[0] || null;
  }

  // Customer methods
  async findAllCustomers() {
    console.log('Fetching all customers...');

    const result = await db
      .select({
        customerId: customers.customerId,
        customerUuid: customers.customerUuid,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        mobileNo: customers.mobileNo,
        countryCode: customers.countryCode,
        emailId: customers.emailId,
        location: customers.location,
        area: customers.area,
        address: customers.address,
        gstNumber: customers.gstNumber,
        pinCode: customers.pinCode,
        salesPersonId: customers.salesPersonId,
        customerTypeId: customers.customerTypeId,
        isActive: customers.isActive,
        currentBalance: customers.currentBalance,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        salesPersonName: sql`concat(${employees.firstName}, ' ', ${employees.lastName})`,
      })
      .from(customers)
      .leftJoin(employees, eq(customers.salesPersonId, employees.employeeId))
      .orderBy(sql`${customers.isActive} DESC`, customers.companyName);

    return result;
  }

  async findAllActiveCustomers() {
    const result = await db
      .select({
        customerId: customers.customerId,
        customerUuid: customers.customerUuid,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        mobileNo: customers.mobileNo,
        countryCode: customers.countryCode,
        emailId: customers.emailId,
        location: customers.location,
        area: customers.area,
        address: customers.address,
        gstNumber: customers.gstNumber,
        pinCode: customers.pinCode,
        salesPersonId: customers.salesPersonId,
        customerTypeId: customers.customerTypeId,
        isActive: customers.isActive,
        currentBalance: customers.currentBalance,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        salesPersonName: sql`concat(${employees.firstName}, ' ', ${employees.lastName})`,
      })
      .from(customers)
      .leftJoin(employees, eq(customers.salesPersonId, employees.employeeId))
      .where(eq(customers.isActive, true))
      .orderBy(customers.companyName);

    return result;
  }

  /**
   * Find customers for a specific user with ownership filtering
   * @param {Object} userContext - { employeeId, role, isAdmin }
   * @returns {Promise<Array>} Customers filtered by ownership
   */
  async findCustomersForUser(userContext) {
    const { and, or } = await import('drizzle-orm');

    // Build query with ownership filter
    let query = db
      .select({
        customerId: customers.customerId,
        customerUuid: customers.customerUuid,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        mobileNo: customers.mobileNo,
        countryCode: customers.countryCode,
        emailId: customers.emailId,
        location: customers.location,
        area: customers.area,
        address: customers.address,
        gstNumber: customers.gstNumber,
        pinCode: customers.pinCode,
        salesPersonId: customers.salesPersonId,
        customerTypeId: customers.customerTypeId,
        isActive: customers.isActive,
        currentBalance: customers.currentBalance,
        createdBy: customers.createdBy,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        salesPersonName: sql`concat(${employees.firstName}, ' ', ${employees.lastName})`,
      })
      .from(customers)
      .leftJoin(employees, eq(customers.salesPersonId, employees.employeeId));

    // For admins, return all customers
    // For non-admins, filter by createdBy OR salesPersonId
    if (!userContext.isAdmin && userContext.employeeId) {
      const conditions = [
        eq(customers.createdBy, userContext.employeeId),
        eq(customers.salesPersonId, userContext.employeeId),
      ];

      // Allow dealers to see their own customer record (matched by company name)
      if (userContext.companyName) {
        conditions.push(eq(customers.companyName, userContext.companyName));
      }

      query = query.where(or(...conditions));
    }

    return await query.orderBy(customers.companyName);
  }

  async findCustomerById(customerId) {
    const result = await db
      .select({
        customerId: customers.customerId,
        customerUuid: customers.customerUuid,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        mobileNo: customers.mobileNo,
        countryCode: customers.countryCode,
        emailId: customers.emailId,
        location: customers.location,
        area: customers.area,
        address: customers.address,
        gstNumber: customers.gstNumber,
        pinCode: customers.pinCode,
        salesPersonId: customers.salesPersonId,
        customerTypeId: customers.customerTypeId,
        isActive: customers.isActive,
        currentBalance: customers.currentBalance,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        salesPersonName: sql`concat(${employees.firstName}, ' ', ${employees.lastName})`,
      })
      .from(customers)
      .leftJoin(employees, eq(customers.salesPersonId, employees.employeeId))
      .where(eq(customers.customerId, customerId))
      .limit(1);

    return result[0] || null;
  }

  async findCustomerByMobileNo(mobileNo, excludeCustomerId = null) {
    const { sql, and, eq: eqOp } = await import('drizzle-orm');

    const conditions = [
      sql`${mobileNo} = ANY(${customers.mobileNo})`,
      eqOp(customers.isActive, true), // Only check active customers (not soft-deleted)
    ];

    // If updating, exclude the current customer from the check
    if (excludeCustomerId) {
      const { ne } = await import('drizzle-orm');
      conditions.push(ne(customers.customerId, excludeCustomerId));
    }

    const query = db
      .select()
      .from(customers)
      .where(and(...conditions));

    const result = await query.limit(1);
    return result[0] || null;
  }

  async findCustomerByGST(gstNumber, excludeCustomerId = null) {
    const { eq, and, ne } = await import('drizzle-orm');

    let query = db.select().from(customers).where(eq(customers.gstNumber, gstNumber));

    // If updating, exclude the current customer from the check
    if (excludeCustomerId) {
      query = db
        .select()
        .from(customers)
        .where(
          and(eq(customers.gstNumber, gstNumber), ne(customers.customerId, excludeCustomerId))
        );
    }

    const result = await query.limit(1);
    return result[0] || null;
  }

  async createCustomer(customerData) {
    console.log('Repository - Creating customer with data:', JSON.stringify(customerData, null, 2));
    try {
      const result = await db.insert(customers).values(customerData).returning();
      console.log('Repository - Customer created successfully, fetching full details...');
      // Fetch complete record with joins
      return await this.findCustomerById(result[0].customerId);
    } catch (error) {
      console.error('Repository - Database insert error:', error.message);
      throw error;
    }
  }

  async updateCustomer(customerId, updateData) {
    await db
      .update(customers)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(customers.customerId, customerId));

    console.log('Repository - Customer updated successfully, fetching full details...');
    return await this.findCustomerById(customerId);
  }

  async deleteCustomer(customerId) {
    // Soft delete
    const result = await db
      .update(customers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(customers.customerId, customerId))
      .returning();

    return result[0];
  }

  /**
   * Transfer customer ownership to a new salesperson
   * Updates both createdBy and salesPersonId fields
   * @param {number} customerId - Customer to transfer
   * @param {number} newSalesPersonId - New salesperson ID
   * @returns {Promise<Object>} Updated customer
   */
  async transferCustomer(customerId, newSalesPersonId) {
    const result = await db
      .update(customers)
      .set({
        createdBy: newSalesPersonId,
        salesPersonId: newSalesPersonId,
        updatedAt: new Date(),
      })
      .where(eq(customers.customerId, customerId))
      .returning();

    return result[0];
  }

  /**
   * Transfer all orders for a customer to a new salesperson
   * Updates both createdBy and salespersonId fields on orders
   * @param {number} customerId - Customer whose orders to transfer
   * @param {number} newSalesPersonId - New salesperson ID
   * @returns {Promise<number>} Count of orders updated
   */
  async transferCustomerOrders(customerId, newSalesPersonId) {
    const result = await db
      .update(orders)
      .set({
        createdBy: newSalesPersonId,
        salespersonId: newSalesPersonId,
        updatedAt: new Date(),
      })
      .where(eq(orders.customerId, customerId))
      .returning();

    return result.length;
  }

  // Role methods
  async findAllRoles() {
    return await db.select().from(roles).orderBy(roles.roleName);
  }

  async findRoleById(roleId) {
    const result = await db.select().from(roles).where(eq(roles.roleId, roleId)).limit(1);

    return result[0] || null;
  }

  async findRoleByName(roleName) {
    const result = await db
      .select()
      .from(roles)
      .where(sql`LOWER(${roles.roleName}) = LOWER(${roleName})`)
      .limit(1);

    return result[0] || null;
  }

  async createRole(roleData) {
    const result = await db.insert(roles).values(roleData).returning();
    return result[0];
  }

  async updateRole(roleId, updateData) {
    const result = await db
      .update(roles)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(roles.roleId, roleId))
      .returning();

    return result[0];
  }

  async countUsersWithRole(roleId) {
    const result = await db
      .select({ count: sql`COUNT(*)` })
      .from(employees)
      .where(eq(employees.roleId, roleId));

    return parseInt(result[0]?.count || 0, 10);
  }

  async deleteRole(roleId) {
    // Soft delete
    const result = await db
      .update(roles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(roles.roleId, roleId))
      .returning();

    return result[0];
  }
}
