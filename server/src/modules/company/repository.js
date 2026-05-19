import { eq, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { company } from '../../db/schema/index.js';
import logger from '../../config/logger.js';

let _columnsReady = false;

async function ensureCompanyColumns() {
  if (_columnsReady) return;
  try {
    await db.execute(sql`
            ALTER TABLE app.company
                ADD COLUMN IF NOT EXISTS factory_address TEXT,
                ADD COLUMN IF NOT EXISTS state VARCHAR(100)
        `);
    _columnsReady = true;
    logger.info('Company columns verified/added successfully');
  } catch (err) {
    logger.warn('ensureCompanyColumns warning (non-fatal):', err.message);
    _columnsReady = true;
  }
}

export class CompanyRepository {
  async getCompany() {
    await ensureCompanyColumns();
    // We assume there is only one company record for now.
    const result = await db.select().from(company).limit(1);
    return result[0] || null;
  }

  async create(data) {
    await ensureCompanyColumns();
    const result = await db.insert(company).values(data).returning();
    return result[0];
  }

  async update(id, data) {
    await ensureCompanyColumns();
    const result = await db
      .update(company)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(company.companyId, id))
      .returning();
    return result[0];
  }

  // Helper to ensure at least one record exists or update the first one
  async upsert(data) {
    const existing = await this.getCompany();
    if (existing) {
      return this.update(existing.companyId, data);
    }
    return this.create(data);
  }
}
