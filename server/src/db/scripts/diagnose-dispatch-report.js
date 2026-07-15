/**
 * Dispatch Report Diagnostic Script (READ-ONLY)
 *
 * Investigates why GET /reports/dispatch returns no rows.
 * Executes SELECT statements only — no data or schema modification.
 *
 * Usage: node src/db/scripts/diagnose-dispatch-report.js
 */
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const run = async (label, query) => {
  try {
    const result = await client.query(query);
    console.log(`\n=== ${label} ===`);
    console.table(result.rows);
  } catch (error) {
    console.log(`\n=== ${label} === ERROR: ${error.message}`);
  }
};

const main = async () => {
  await client.connect();
  console.log('Connected (read-only diagnostics)\n');

  await run('1. Total dispatches', 'SELECT COUNT(*)::int AS total_dispatches FROM app.dispatches');

  await run(
    '2. Orders linked to a dispatch',
    'SELECT COUNT(*)::int AS orders_with_dispatch FROM app.orders WHERE dispatch_id IS NOT NULL'
  );

  await run(
    '3. Dispatches in current month (report default range)',
    `SELECT COUNT(*)::int AS current_month_dispatches
     FROM app.dispatches
     WHERE dispatch_date >= date_trunc('month', CURRENT_DATE)
       AND dispatch_date < date_trunc('month', CURRENT_DATE) + interval '1 month'`
  );

  await run(
    '4. dispatch_date population and actual data range',
    `SELECT COUNT(*) FILTER (WHERE dispatch_date IS NULL)::int AS null_dates,
            MIN(dispatch_date) AS earliest,
            MAX(dispatch_date) AS latest
     FROM app.dispatches`
  );

  await run(
    '5. Dispatch status distribution',
    'SELECT status, COUNT(*)::int AS count FROM app.dispatches GROUP BY status ORDER BY count DESC'
  );

  await run(
    '6. Newest dispatches through the exact report join chain',
    `SELECT d.dispatch_id, d.dispatch_date::date AS date, d.vehicle_no, d.status,
            o.order_number, c.company_name,
            od.quantity, p.product_name, p.package_capacity_kg,
            v.capacity AS vehicle_capacity
     FROM app.dispatches d
     LEFT JOIN app.orders o         ON d.dispatch_id = o.dispatch_id
     LEFT JOIN app.customers c      ON o.customer_id = c.customer_id
     LEFT JOIN app.order_details od ON o.order_id = od.order_id
     LEFT JOIN app.products p       ON od.product_id = p.product_id
     LEFT JOIN app.vehicles v       ON d.vehicle_no = v.vehicle_number
     ORDER BY d.dispatch_date DESC
     LIMIT 20`
  );

  await run(
    '7. Dispatches with no linked orders (orders returned or link cleared)',
    `SELECT COUNT(*)::int AS orphan_dispatches
     FROM app.dispatches d
     WHERE NOT EXISTS (SELECT 1 FROM app.orders o WHERE o.dispatch_id = d.dispatch_id)`
  );

  await run(
    '8. Vehicles master rows (expected 0 until Phase 2)',
    'SELECT COUNT(*)::int AS vehicle_rows FROM app.vehicles'
  );

  await run(
    '9. Vehicles master contents (number + capacity)',
    'SELECT vehicle_number, capacity FROM app.vehicles LIMIT 20'
  );

  await run(
    '10. Distinct vehicle numbers used in dispatches vs master match',
    `SELECT d.vehicle_no,
            COUNT(*)::int AS dispatch_count,
            EXISTS (
              SELECT 1 FROM app.vehicles v WHERE v.vehicle_number = d.vehicle_no
            ) AS exact_match_in_master,
            EXISTS (
              SELECT 1 FROM app.vehicles v
              WHERE LOWER(REPLACE(v.vehicle_number, '-', '')) = LOWER(REPLACE(d.vehicle_no, '-', ''))
            ) AS fuzzy_match_in_master
     FROM app.dispatches d
     GROUP BY d.vehicle_no
     ORDER BY dispatch_count DESC
     LIMIT 20`
  );

  await run(
    '11. Vehicles with NULL capacity',
    'SELECT COUNT(*)::int AS null_capacity_vehicles FROM app.vehicles WHERE capacity IS NULL'
  );

  await client.end();
  console.log('\nDone. All queries were SELECT-only.');
};

main().catch(error => {
  console.error('Connection failed:', error.message);
  process.exit(1);
});
