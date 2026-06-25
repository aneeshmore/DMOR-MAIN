import { eq, and, desc, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  testCertificates,
  testCertificateResults,
} from '../../db/schema/test-certificate/test-certificate.js';
import { productionBatch } from '../../db/schema/production/production-batch.js';
import { masterProducts } from '../../db/schema/products/master-products.js';
import { batchProducts } from '../../db/schema/production/batch-products.js';
import { orders } from '../../db/schema/sales/orders.js';
import { customers } from '../../db/schema/sales/customers.js';
import { employees } from '../../db/schema/organization/employees.js';

/**
 * Roles that bypass user-level data isolation and can see ALL certificates.
 * Only SuperAdmin and Admin have full visibility per business requirements.
 */
const ADMIN_ROLES = ['SuperAdmin', 'Admin'];

function isAdmin(userContext) {
  if (!userContext) return false;
  const role = userContext.role || userContext.Role;
  return ADMIN_ROLES.includes(role);
}

export class TestCertificateRepository {
  /**
   * Fetch all test certificates with filters, scoped by tenant.
   * @param {Object} userContext - { employeeId, role } — used for row-level security.
   *   SuperAdmin / Admin: see ALL records.
   *   All other roles: see ONLY records where createdBy = their own employeeId.
   */
  async getTestCertificates(filters = {}, companyId, tenantId, userContext = null) {
    const baseConditions = [
      eq(testCertificates.companyId, companyId),
      eq(testCertificates.tenantId, tenantId),
    ];

    // User-level isolation: non-admins only see their own certificates
    if (!isAdmin(userContext) && userContext?.employeeId) {
      baseConditions.push(eq(testCertificates.createdBy, userContext.employeeId));
    }

    let query = db
      .select({
        test_certificates: testCertificates,
        creator: {
          firstName: employees.firstName,
          lastName: employees.lastName,
        },
        colourResultValue: testCertificateResults.resultValue,
      })
      .from(testCertificates)
      .leftJoin(employees, eq(testCertificates.createdBy, employees.employeeId))
      .leftJoin(
        testCertificateResults,
        and(
          eq(testCertificates.id, testCertificateResults.certificateId),
          eq(sql`LOWER(TRIM(${testCertificateResults.propertyName}))`, 'colour / shade')
        )
      )
      .where(and(...baseConditions))
      .$dynamic();

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query = query.where(
        sql`(${testCertificates.certificateNo} ILIKE ${searchPattern} OR ${testCertificates.batchNumber} ILIKE ${searchPattern} OR ${testCertificates.productName} ILIKE ${searchPattern})`
      );
    }

    if (filters.status) {
      query = query.where(eq(testCertificates.status, filters.status));
    }

    return await query.orderBy(desc(testCertificates.createdAt));
  }

  /**
   * Fetch a single test certificate with its results, scoped by tenant.
   * @param {Object} userContext - { employeeId, role } — enforces row-level ownership.
   *   Non-admin users can only fetch records they created.
   */
  async getTestCertificateById(id, companyId, tenantId, userContext = null) {
    const conditions = [
      eq(testCertificates.id, id),
      eq(testCertificates.companyId, companyId),
      eq(testCertificates.tenantId, tenantId),
    ];

    // User-level isolation: non-admins can only access their own certificates
    if (!isAdmin(userContext) && userContext?.employeeId) {
      conditions.push(eq(testCertificates.createdBy, userContext.employeeId));
    }

    const certRow = await db
      .select({
        test_certificates: testCertificates,
        creator: {
          firstName: employees.firstName,
          lastName: employees.lastName,
        },
      })
      .from(testCertificates)
      .leftJoin(employees, eq(testCertificates.createdBy, employees.employeeId))
      .where(and(...conditions))
      .limit(1);

    if (!certRow.length) return null;

    const results = await db
      .select()
      .from(testCertificateResults)
      .where(eq(testCertificateResults.certificateId, id))
      .orderBy(testCertificateResults.sortOrder);

    return {
      ...certRow[0],
      results,
    };
  }

  /**
   * Save a test certificate and its results in a transaction
   */
  async createTestCertificate(data, companyId, tenantId, tx) {
    const execute = async databaseClient => {
      const [newCert] = await databaseClient
        .insert(testCertificates)
        .values({
          companyId,
          tenantId,
          certificateNo: data.certificateNo,
          batchId: data.batchId,
          batchNumber: data.batchNumber,
          productName: data.productName,
          colour: data.colour,
          manufacturingDate: data.manufacturingDate,
          testingDate: data.testingDate,
          remarks: data.remarks,
          status: data.status || 'Draft',
          createdBy: data.createdBy,
        })
        .returning();

      if (data.results && data.results.length > 0) {
        const resultsToInsert = data.results.map((r, index) => ({
          certificateId: newCert.id,
          propertyName: r.propertyName,
          resultValue: r.resultValue,
          specification: r.specification || '',
          sortOrder: r.sortOrder !== undefined ? r.sortOrder : index,
        }));
        await databaseClient.insert(testCertificateResults).values(resultsToInsert);
      }

      return newCert;
    };

    if (tx) {
      return await execute(tx);
    }
    return await db.transaction(async t => await execute(t));
  }

  /**
   * Update a test certificate and its results in a transaction
   */
  async updateTestCertificate(id, data, companyId, tenantId, tx) {
    const execute = async databaseClient => {
      // 1. Verify existence and tenant ownership
      const [existing] = await databaseClient
        .select()
        .from(testCertificates)
        .where(
          and(
            eq(testCertificates.id, id),
            eq(testCertificates.companyId, companyId),
            eq(testCertificates.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error('Test certificate not found or unauthorized');
      }

      // 2. Update parent
      const [updatedCert] = await databaseClient
        .update(testCertificates)
        .set({
          colour: data.colour,
          testingDate: data.testingDate,
          remarks: data.remarks,
          status: data.status,
          updatedAt: new Date(),
        })
        .where(eq(testCertificates.id, id))
        .returning();

      // 3. Re-insert results if provided
      if (data.results) {
        await databaseClient
          .delete(testCertificateResults)
          .where(eq(testCertificateResults.certificateId, id));

        if (data.results.length > 0) {
          const resultsToInsert = data.results.map((r, index) => ({
            certificateId: id,
            propertyName: r.propertyName,
            resultValue: r.resultValue,
            specification: r.specification || '',
            sortOrder: r.sortOrder !== undefined ? r.sortOrder : index,
          }));
          await databaseClient.insert(testCertificateResults).values(resultsToInsert);
        }
      }

      return updatedCert;
    };

    if (tx) {
      return await execute(tx);
    }
    return await db.transaction(async t => await execute(t));
  }

  /**
   * Update the status of a test certificate to Approved
   */
  async approveTestCertificate(id, status, companyId, tenantId) {
    const [updatedCert] = await db
      .update(testCertificates)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(testCertificates.id, id),
          eq(testCertificates.companyId, companyId),
          eq(testCertificates.tenantId, tenantId)
        )
      )
      .returning();
    return updatedCert;
  }

  /**
   * Delete a test certificate, scoped by tenant only.
   * Approval/delete workflows apply to all permitted users (no ownership restriction on delete).
   */
  async deleteTestCertificate(id, companyId, tenantId) {
    return await db.transaction(async tx => {
      // 1. Verify existence and tenant ownership
      const [existing] = await tx
        .select()
        .from(testCertificates)
        .where(
          and(
            eq(testCertificates.id, id),
            eq(testCertificates.companyId, companyId),
            eq(testCertificates.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error('Test certificate not found or unauthorized');
      }

      // Cascade delete results first due to foreign keys (or rely on Cascade in DB schema)
      await tx.delete(testCertificateResults).where(eq(testCertificateResults.certificateId, id));

      await tx.delete(testCertificates).where(eq(testCertificates.id, id));

      return true;
    });
  }

  /**
   * Get all completed production batches (Read-only join)
   */
  async getCompletedBatches() {
    return await db
      .select({
        batchId: productionBatch.batchId,
        batchNo: productionBatch.batchNo,
        masterProductId: productionBatch.masterProductId,
        productName: masterProducts.masterProductName,
        completedAt: productionBatch.completedAt,
        scheduledDate: productionBatch.scheduledDate,
        actualQuantity: productionBatch.actualQuantity,
        actualDensity: productionBatch.actualDensity,
        actualViscosity: productionBatch.actualViscosity,
        customerName: sql`STRING_AGG(DISTINCT ${customers.companyName}, ', ')`.as('customer_name'),
      })
      .from(productionBatch)
      .leftJoin(masterProducts, eq(productionBatch.masterProductId, masterProducts.masterProductId))
      .leftJoin(batchProducts, eq(productionBatch.batchId, batchProducts.batchId))
      .leftJoin(orders, eq(batchProducts.orderId, orders.orderId))
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .where(eq(productionBatch.status, 'Completed'))
      .groupBy(
        productionBatch.batchId,
        productionBatch.batchNo,
        productionBatch.masterProductId,
        masterProducts.masterProductName,
        productionBatch.completedAt,
        productionBatch.scheduledDate,
        productionBatch.actualQuantity,
        productionBatch.actualDensity,
        productionBatch.actualViscosity
      )
      .orderBy(desc(productionBatch.completedAt));
  }

  /**
   * Check if a certificate number already exists
   */
  async checkCertificateNoExists(certificateNo, companyId, tenantId) {
    const rows = await db
      .select({ id: testCertificates.id })
      .from(testCertificates)
      .where(
        and(
          eq(testCertificates.certificateNo, certificateNo),
          eq(testCertificates.companyId, companyId),
          eq(testCertificates.tenantId, tenantId)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Get details of a single completed production batch (Read-only join)
   */
  async getCompletedBatchById(batchId) {
    const rows = await db
      .select({
        batchId: productionBatch.batchId,
        batchNo: productionBatch.batchNo,
        masterProductId: productionBatch.masterProductId,
        productName: masterProducts.masterProductName,
        completedAt: productionBatch.completedAt,
        scheduledDate: productionBatch.scheduledDate,
        actualQuantity: productionBatch.actualQuantity,
        actualDensity: productionBatch.actualDensity,
        actualViscosity: productionBatch.actualViscosity,
        customerName: sql`STRING_AGG(DISTINCT ${customers.companyName}, ', ')`.as('customer_name'),
      })
      .from(productionBatch)
      .leftJoin(masterProducts, eq(productionBatch.masterProductId, masterProducts.masterProductId))
      .leftJoin(batchProducts, eq(productionBatch.batchId, batchProducts.batchId))
      .leftJoin(orders, eq(batchProducts.orderId, orders.orderId))
      .leftJoin(customers, eq(orders.customerId, customers.customerId))
      .where(and(eq(productionBatch.status, 'Completed'), eq(productionBatch.batchId, batchId)))
      .groupBy(
        productionBatch.batchId,
        productionBatch.batchNo,
        productionBatch.masterProductId,
        masterProducts.masterProductName,
        productionBatch.completedAt,
        productionBatch.scheduledDate,
        productionBatch.actualQuantity,
        productionBatch.actualDensity,
        productionBatch.actualViscosity
      )
      .limit(1);

    return rows[0] || null;
  }

  /**
   * Get latest total solids for all products
   */
  async getLatestTotalSolidsMap() {
    const query = sql`
      SELECT DISTINCT ON (pd.master_product_id)
        pd.master_product_id,
        SUM(CAST(pdm.percentage AS NUMERIC) * COALESCE(rm.rm_solids, 0) / 100) as total_solid
      FROM app.product_development pd
      JOIN app.product_development_materials pdm ON pd.development_id = pdm.development_id
      LEFT JOIN app.master_product_rm rm ON pdm.material_id = rm.master_product_id
      GROUP BY pd.master_product_id, pd.development_id, pd.created_at
      ORDER BY pd.master_product_id, pd.created_at DESC
    `;
    const res = await db.execute(query);
    const map = new Map();
    for (const r of res.rows) {
      const mId = parseInt(r.master_product_id, 10);
      const val = parseFloat(r.total_solid);
      if (!isNaN(mId) && !isNaN(val)) {
        map.set(mId, val);
      }
    }
    return map;
  }
}
