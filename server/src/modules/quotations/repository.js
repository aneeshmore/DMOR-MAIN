import db from '../../db/index.js';
import { quotations, employees } from '../../db/schema/index.js';
import { eq, desc, and } from 'drizzle-orm';

export class QuotationsRepository {
  async create(data) {
    const [quotation] = await db.insert(quotations).values(data).returning();
    return quotation;
  }

  async findAll(createdBy = null) {
    let query = db
      .select({
        ...quotations,
        salesPersonName: employees.firstName,
        salesPersonLastName: employees.lastName,
      })
      .from(quotations)
      .leftJoin(employees, eq(quotations.createdBy, employees.employeeId));

    if (createdBy) {
      query = query.where(eq(quotations.createdBy, createdBy));
    }

    const results = await query.orderBy(desc(quotations.updatedAt));

    return results.map(row => ({
      ...row,
      salesPersonName: row.salesPersonName
        ? `${row.salesPersonName} ${row.salesPersonLastName}`
        : 'Unknown',
    }));
  }

  async findById(id) {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.quotationId, id));
    return quotation;
  }

  async findByCustomerId(customerId, createdBy = null) {
    const conditions = [eq(quotations.customerId, customerId)];

    if (createdBy) {
      conditions.push(eq(quotations.createdBy, createdBy));
    }

    const results = await db
      .select({
        ...quotations,
        salesPersonName: employees.firstName,
        salesPersonLastName: employees.lastName,
      })
      .from(quotations)
      .leftJoin(employees, eq(quotations.createdBy, employees.employeeId))
      .where(and(...conditions))
      .orderBy(desc(quotations.updatedAt));

    return results.map(row => ({
      ...row,
      salesPersonName: row.salesPersonName
        ? `${row.salesPersonName} ${row.salesPersonLastName}`
        : 'Unknown',
    }));
  }

  async updateStatus(id, status, rejectionRemark = null) {
    const updateData = {
      status,
    };

    // Add rejection remark if provided (for rejected quotations)
    if (rejectionRemark !== null) {
      updateData.rejectionRemark = rejectionRemark;
    }

    const [updated] = await db
      .update(quotations)
      .set(updateData)
      .where(eq(quotations.quotationId, id))
      .returning();
    return updated;
  }

  async getNextQuotationNumber() {
    // Generate quotation number like QT/24-25/0001
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Financial year: April to March
    const financialYearStart = month >= 4 ? year : year - 1;
    const financialYearEnd = (financialYearStart + 1) % 100;
    const yearStr = `${financialYearStart.toString().slice(-2)}-${financialYearEnd.toString().padStart(2, '0')}`;

    // Count existing quotations for this financial year
    const prefix = `QT/${yearStr}/`;
    const existing = await db.select().from(quotations);
    const sameYearQuotes = existing.filter(q => q.quotationNo?.startsWith(prefix));
    const nextNum = sameYearQuotes.length + 1;

    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  }

  async update(id, data) {
    const [updated] = await db
      .update(quotations)
      .set({
        ...data,
        status: 'Pending', // Reset to Pending for re-approval
        rejectionRemark: null, // Clear previous rejection
        updatedAt: new Date(),
      })
      .where(eq(quotations.quotationId, id))
      .returning();
    return updated;
  }
}
