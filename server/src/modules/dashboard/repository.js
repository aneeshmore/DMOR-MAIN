import db from '../../db/index.js';
import logger from '../../config/logger.js';
import { sql } from 'drizzle-orm';

export class DashboardRepository {
  /**
   * Get Product Stock View for Admin Dashboard
   * Shows FG stock levels with pending orders and current production
   */
  async getProductStockView() {
    const result = await db.execute(sql`
            SELECT
                p.product_id as "ProductID",
                mp.master_product_name as "MasterProductName",
                p.product_name as "ProductName",
                (
                    SELECT COALESCE(SUM(od.quantity), 0)
                    FROM app.order_details od
                    JOIN app.orders o ON od.order_id = o.order_id
                    WHERE od.product_id = p.product_id 
                        AND o.status IN ('Pending Accounts Approval', 'Pending', 'On Hold')
                ) AS "OrderQty",
                p.available_quantity AS "AvailableQty",
                (
                    SELECT COALESCE(SUM(pb.planned_quantity), 0)
                    FROM app.production_batches_enhanced pb
                    WHERE pb.master_product_id = p.master_product_id 
                        AND pb.status = 'In Progress'
                ) AS "ProductionQty"
            FROM app.products p
            LEFT JOIN app.master_products mp ON p.master_product_id = mp.master_product_id
            WHERE mp.product_type = 'FG' AND p.is_active = TRUE
            ORDER BY mp.master_product_name, p.product_name
        `);

    return result.rows;
  }

  /**
   * Get Order Payment Status (Pending and On Hold)
   */
  async getOrderPaymentStatus(status = 'Pending Accounts Approval') {
    // Map new/legacy equivalent status names so existing orders keep appearing
    const statusEquivalents = {
      'Pending Accounts Approval': ['Pending Accounts Approval', 'Pending'],
      Pending: ['Pending Accounts Approval', 'Pending'],
      'Pending Factory Approval': ['Pending Factory Approval', 'Verified'],
      Verified: ['Pending Factory Approval', 'Verified'],
      'Factory Approved': ['Factory Approved', 'Accepted'],
      Accepted: ['Factory Approved', 'Accepted'],
    };
    const statuses = statusEquivalents[status] || [status];

    const result = await db.execute(sql`
            SELECT
                o.order_id as "OrderID",
                c.company_name as "CompanyName",
                c.location as "Location",
                CONCAT(e.first_name, ' ', e.last_name) AS "SalesPerson",
                o.order_date as "OrderCreatedDate",
                o.bill_no as "BillNo",
                o.payment_cleared as "PaymentCleared",
                o.total_amount as "TotalAmount",
                EXTRACT(DAY FROM (CURRENT_TIMESTAMP - o.order_date)) AS "DaysAgo"
            FROM app.orders o
            JOIN app.customers c ON o.customer_id = c.customer_id
            JOIN app.employees e ON o.salesperson_id = e.employee_id
            WHERE o.status IN ${sql.raw(`('${statuses.join("','")}')`)}
            ORDER BY o.order_date DESC
        `);

    return result.rows;
  }

  /**
   * Get Production Status Report
   */
  async getProductionStatusReport() {
    const result = await db.execute(sql`
            SELECT
                pb.batch_id as "BatchID",
                pb.scheduled_date as "ProductionDate",
                CONCAT(e.first_name, ' ', e.last_name) AS "Supervisor",
                mp.master_product_name as "Product",
                0 as "Labour",
                (pb.time_required_hours * 60) as "TimeRequired",
                pb.planned_quantity as "STD_Qty",
                pb.actual_quantity as "Production_Qty",
                pb.actual_density as "Actual_Density",
                (pb.actual_quantity - pb.planned_quantity) AS "Diff",
                pb.status as "Status"
            FROM app.production_batches_enhanced pb
            LEFT JOIN app.employees e ON pb.supervisor_id = e.employee_id
            LEFT JOIN app.master_products mp ON pb.master_product_id = mp.master_product_id
            ORDER BY pb.scheduled_date DESC, pb.batch_id DESC
        `);

    return result.rows;
  }

  /**
   * Get Payment Cleared Orders Report
   */
  async getPaymentClearedOrders() {
    const result = await db.execute(sql`
        SELECT
            o.order_id as "OrderID",
            c.company_name as "CompanyName",
            CONCAT(e.first_name, ' ', e.last_name) AS "SalesPerson",
            o.order_date as "OrderCreatedDate",
            a.bill_no as "BillNo",
            a.remarks as "Remark",
            a.payment_date as "PaymentDate",
            a.bill_amount as "BillAmount",
            (a.payment_date::date - o.order_date::date) AS "TimeSpanDays"
        FROM app.orders o
        JOIN app.accounts a ON o.order_id = a.order_id
        JOIN app.customers c ON o.customer_id = c.customer_id
        LEFT JOIN app.employees e ON o.salesperson_id = e.employee_id
        WHERE a.payment_status = 'Cleared'
        ORDER BY a.payment_date DESC
    `);

    return result.rows;
  }

  async getOrderCountsByMonth() {
    const result = await db.execute(sql`
        SELECT 
            EXTRACT(YEAR FROM order_date)::integer as "year",
            EXTRACT(MONTH FROM order_date)::integer as "month",
            COUNT(*)::integer as "count"
        FROM app.orders
        GROUP BY 1, 2
    `);
    return result.rows;
  }

  /**
   * Get Cancelled Orders Report with optional year/month filtering
   */
  async getCancelledOrders(year, month) {
    try {
      // Use order_date for stable filtering so items don't jump months when updated
      let whereClause = sql`LOWER(COALESCE(o.status, '')) IN ('cancelled', 'rejected', 'returned', 'cancel', 'reject')`;

      if (year) {
        whereClause = sql`${whereClause} AND EXTRACT(YEAR FROM o.order_date) = ${parseInt(year)}`;
      }

      if (month && month !== '') {
        // Month from frontend is 0-indexed, PostgreSQL uses 1-indexed
        whereClause = sql`${whereClause} AND EXTRACT(MONTH FROM o.order_date) = ${parseInt(month) + 1}`;
      }

      const result = await db.execute(sql`
          SELECT
              o.order_id as "OrderID",
              c.company_name as "CompanyName",
              CONCAT(e.first_name, ' ', e.last_name) AS "SalesPerson",
              o.order_date as "OrderCreatedDate",
              c.location as "Location",
              COALESCE(a.remarks, o.notes) as "Remark",
              o.total_amount as "Amount",
              o.status as "Status",
              o.updated_at as "UpdatedAt"
          FROM app.orders o
          JOIN app.customers c ON o.customer_id = c.customer_id
          LEFT JOIN app.employees e ON o.salesperson_id = e.employee_id
          LEFT JOIN app.accounts a ON o.order_id = a.order_id
          WHERE ${whereClause}
          ORDER BY o.order_date DESC
      `);

      logger.info(`Fetched ${result.rows.length} cancelled/rejected orders`, { year, month });
      return result.rows;
    } catch (error) {
      logger.error('Error in getCancelledOrders repository', { error: error.message, year, month });
      throw error;
    }
  }

  /**
   * Get Profit & Loss Report
   */
  async getProfitLossReport() {
    const result = await db.execute(sql`
        SELECT
            p.product_id as "ProductID",
            mp.master_product_name as "MasterProductName",
            p.product_name as "SubProductName",
            SUM(od.quantity)::integer as "OrderQuantity",
            COALESCE(pd.production_cost, 0)::numeric as "ProductionCost",
            COALESCE(p.selling_price, 0)::numeric as "SellingPrice",
            SUM(od.unit_price * od.quantity)::numeric as "Sale",
            (SUM(od.unit_price * od.quantity) - (COALESCE(pd.production_cost, 0) * SUM(od.quantity)))::numeric as "GrossProfit"
        FROM app.order_details od
        JOIN app.products p ON od.product_id = p.product_id
        JOIN app.master_products mp ON p.master_product_id = mp.master_product_id
        JOIN app.orders o ON od.order_id = o.order_id
        LEFT JOIN app.product_development pd ON p.product_id = pd.master_product_id
        WHERE o.status IN ('Delivered', 'Dispatched', 'Ready for Dispatch')
        GROUP BY p.product_id, mp.master_product_name, p.product_name, p.selling_price, pd.production_cost
        ORDER BY "Sale" DESC
    `);

    return result.rows;
  }
}
