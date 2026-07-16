/**
 * Inventory Integrity Job
 *
 * Self-healing for legacy data: active RM/PM master products created by earlier
 * versions of the software may lack their master_product_rm / master_product_pm
 * sub-table row, which excludes them from inventory workflows.
 *
 * This job inserts ONLY the missing sub-table rows (primary key reference only,
 * quantities left NULL and treated as 0 by consumers). It never updates or
 * deletes existing rows, never touches quantities or min stock values, and is
 * fully idempotent — subsequent runs are no-ops.
 *
 * Runs once on server startup, mirroring the existing startup-job pattern.
 */
import { sql } from 'drizzle-orm';
import db from '../db/index.js';
import logger from '../config/logger.js';

export async function repairMissingInventorySubRows() {
  try {
    const rmResult = await db.execute(sql`
      INSERT INTO app.master_product_rm (master_product_id)
      SELECT mp.master_product_id
      FROM app.master_products mp
      WHERE mp.product_type = 'RM'
        AND mp.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM app.master_product_rm rm
          WHERE rm.master_product_id = mp.master_product_id
        )
      RETURNING master_product_id
    `);

    const pmResult = await db.execute(sql`
      INSERT INTO app.master_product_pm (master_product_id)
      SELECT mp.master_product_id
      FROM app.master_products mp
      WHERE mp.product_type = 'PM'
        AND mp.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM app.master_product_pm pm
          WHERE pm.master_product_id = mp.master_product_id
        )
      RETURNING master_product_id
    `);

    const rmRepaired = rmResult.rows?.length || 0;
    const pmRepaired = pmResult.rows?.length || 0;

    if (rmRepaired > 0 || pmRepaired > 0) {
      logger.info('Inventory integrity: repaired missing sub-table rows', {
        rmRowsCreated: rmRepaired,
        pmRowsCreated: pmRepaired,
      });
    } else {
      logger.info('Inventory integrity: no missing sub-table rows found');
    }
  } catch (error) {
    // Never block server startup on a repair failure
    logger.error('Inventory integrity repair failed', { error: error.message });
  }
}
