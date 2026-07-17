import { eq, ne, desc, and, gte, lte, lt, inArray, notInArray, sql, isNotNull } from 'drizzle-orm';
import db from '../../db/index.js';
import {
  materialInward,
  products,
  masterProducts,
  masterProductFG,
  masterProductRM,
  masterProductPM,
  orders,
  orderDetails,
  customers,
  productBom,
  inventoryTransactions,
  suppliers,
  batchMaterials,
  productionBatch,
  batchProducts,
  materialDiscard,
  employees,
  dispatches,
  vehicles,
} from '../../db/schema/index.js';

export class ReportsService {
  async getBatchProductionReport(status, startDate, endDate) {
    try {
      const conditions = [];

      if (status && status !== 'All') {
        conditions.push(eq(productionBatch.status, status));
      }

      // Context-aware date filtering based on status
      let dateField = productionBatch.scheduledDate; // Default to scheduledDate

      if (status === 'Completed') {
        dateField = productionBatch.completedAt;
      } else if (status === 'In Progress') {
        dateField = productionBatch.startedAt;
      }

      if (startDate) {
        conditions.push(gte(dateField, startDate));
      }

      if (endDate) {
        // For timestamp fields (startedAt, completedAt), ensure we include the whole end day
        if (status === 'Completed' || status === 'In Progress') {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          conditions.push(lte(dateField, end));
        } else {
          // For date-only field (scheduledDate)
          conditions.push(lte(dateField, endDate));
        }
      }

      // 1. Fetch Main Batches with their direct relations
      const batches = await db.query.productionBatch.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          masterProduct: {
            with: {
              fgDetails: true,
            },
          },
          supervisor: true,
          batchProducts: {
            with: {
              product: {
                with: {
                  masterProduct: true,
                  packaging: {
                    with: {
                      pmDetails: true,
                    },
                  },
                },
              },
              order: {
                with: {
                  account: true,
                },
              },
            },
          },
        },
        orderBy: (productionBatch, { desc }) => [desc(productionBatch.scheduledDate)],
      });

      if (batches.length === 0) return [];

      // 2. Prepare for Bulk Fetching
      const batchIds = batches.map(b => b.batchId);
      const masterProductIdsWithMissingRef = batches
        .filter(b => !b.productId && b.masterProductId)
        .map(b => b.masterProductId);

      // 3. Bulk Fetch Material Snapshots (Snapshotted recipe at batch creation)
      const allBatchMaterials = await db
        .select({
          batchId: batchMaterials.batchId,
          batchMaterialId: batchMaterials.batchMaterialId,
          materialId: batchMaterials.materialId,
          materialName: masterProducts.masterProductName,
          productType: masterProducts.productType,
          requiredQuantity: batchMaterials.requiredQuantity,
          sequence: batchMaterials.sequence,
          isAdditional: batchMaterials.isAdditional,
          percentage: batchMaterials.requiredUsePer,
        })
        .from(batchMaterials)
        .leftJoin(masterProducts, eq(batchMaterials.materialId, masterProducts.masterProductId))
        .where(inArray(batchMaterials.batchId, batchIds))
        .orderBy(batchMaterials.sequence);

      // Group materials by batchId
      const materialsByBatchMap = new Map();
      const uniqueMaterialIds = new Set();
      allBatchMaterials.forEach(bm => {
        if (!materialsByBatchMap.has(bm.batchId)) materialsByBatchMap.set(bm.batchId, []);
        materialsByBatchMap.get(bm.batchId).push(bm);
        if (bm.materialId) uniqueMaterialIds.add(bm.materialId);
      });

      // 4. Bulk Fetch Purchase Cost from masterProductRM (Update Product -> Raw Material)
      // This is the Purchase Cost configured in Update Product section
      const materialIdsArr = Array.from(uniqueMaterialIds);
      const purchaseCostMap = new Map();
      if (materialIdsArr.length > 0) {
        // Fetch purchaseCost directly from masterProductRM table
        const rmDetails = await db
          .select({
            masterProductId: masterProductRM.masterProductId,
            purchaseCost: masterProductRM.purchaseCost,
          })
          .from(masterProductRM)
          .where(inArray(masterProductRM.masterProductId, materialIdsArr));

        rmDetails.forEach(row => {
          if (!purchaseCostMap.has(row.masterProductId)) {
            purchaseCostMap.set(row.masterProductId, row.purchaseCost);
          }
        });
      }

      // 5. Bulk Fetch Reference Products (for MTS batches without direct productId)
      const refProductMap = new Map();
      if (masterProductIdsWithMissingRef.length > 0) {
        const refProducts = await db.query.products.findMany({
          where: inArray(products.masterProductId, masterProductIdsWithMissingRef),
        });
        // Group by masterProductId to take the first child
        refProducts.forEach(p => {
          if (!refProductMap.has(p.masterProductId)) {
            refProductMap.set(p.masterProductId, p.productId);
          }
        });
      }

      // 6. Final Assembly Object construction
      const batchesWithBom = batches.map(batch => {
        const startTime = batch.startedAt ? new Date(batch.startedAt).getTime() : null;
        const endTime = batch.completedAt ? new Date(batch.completedAt).getTime() : null;

        let timeRequired = 'N/A';
        if (batch.actualTimeHours) {
          timeRequired = `${batch.actualTimeHours} Hrs`;
        } else if (startTime && endTime) {
          const diffMs = endTime - startTime;
          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          timeRequired = `${diffHrs}h ${diffMins}m`;
        }

        // Resolve Reference Product ID
        let referenceProductId = batch.productId || refProductMap.get(batch.masterProductId);

        // Process Materials (Raw Materials)
        const batchMaterialsData = materialsByBatchMap.get(batch.batchId) || [];
        const rawMaterials = batchMaterialsData
          .map(bm => {
            const isAdditional = !!bm.isAdditional;

            return {
              bomId: bm.batchMaterialId,
              rawMaterialId: bm.materialId,
              rawMaterialName: bm.materialName || 'Unknown',
              productType: bm.productType,
              percentage: bm.percentage || 0,
              actualQty: bm.requiredQuantity,
              unitPrice: purchaseCostMap.get(bm.materialId) || null,
              isAdditional,
            };
          })
          .sort((a, b) => {
            if (a.isAdditional !== b.isAdditional) return a.isAdditional ? 1 : -1;
            return 0;
          });

        // Calculate Packaging Materials based on Batch Products
        const packagingMap = new Map();
        if (batch.batchProducts) {
          batch.batchProducts.forEach(sp => {
            const packaging = sp.product?.packaging;
            if (packaging) {
              const existing = packagingMap.get(packaging.masterProductId) || {
                packagingId: packaging.masterProductId,
                packagingName: packaging.masterProductName,
                plannedQty: 0,
                actualQty: 0,
              };
              existing.plannedQty += parseFloat(sp.plannedUnits || '0');
              existing.actualQty += parseFloat(sp.producedUnits || '0');
              packagingMap.set(packaging.masterProductId, existing);
            }
          });
        }

        return {
          batchId: batch.batchId,
          batchNo: batch.batchNo,
          productId: referenceProductId,
          masterProductId: batch.masterProductId,
          productName: batch.masterProduct?.masterProductName || 'Unknown Product',
          productType: batch.masterProduct?.productType,
          batchType:
            batch.batchType ||
            (batch.batchProducts?.some(sp => sp.orderId) ? 'MAKE_TO_ORDER' : 'MAKE_TO_STOCK'),
          scheduledDate: batch.scheduledDate,
          status: batch.status,
          plannedQuantity: batch.plannedQuantity,
          actualQuantity: batch.actualQuantity,
          actualWeightKg: batch.actualWeightKg,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
          timeRequired,
          supervisor: batch.supervisor
            ? `${batch.supervisor.firstName} ${batch.supervisor.lastName}`
            : null,
          density: batch.density || batch.masterProduct?.fgDetails?.fgDensity,
          actualDensity: batch.actualDensity,
          packingDensity:
            batch.actualWeightKg && batch.actualQuantity && parseFloat(batch.actualQuantity) > 0
              ? (parseFloat(batch.actualWeightKg) / parseFloat(batch.actualQuantity)).toFixed(4)
              : batch.actualDensity,
          viscosity: batch.viscosity || batch.masterProduct?.fgDetails?.viscosity,
          actualViscosity: batch.actualViscosity,
          waterPercentage: batch.waterPercentage || batch.masterProduct?.fgDetails?.waterPercentage,
          actualWaterPercentage: batch.actualWaterPercentage,
          productionRemarks: batch.productionRemarks,
          labourNames: batch.labourNames,
          qualityStatus: batch.qualityStatus,
          subProducts: (batch.batchProducts || []).map((sp, _, arr) => {
            const capacity =
              sp.product?.packaging?.pmDetails?.capacity || sp.product?.packageCapacityKg || 0;
            let actualQty =
              sp.producedUnits ??
              (batch.status === 'Completed' ? parseInt(sp.plannedUnits || 0) || '-' : '-');

            // Legacy MTS fallback for single-SKU
            if (
              actualQty === '-' &&
              batch.status === 'Completed' &&
              arr.length === 1 &&
              parseFloat(batch.actualQuantity) > 0 &&
              parseFloat(capacity) > 0
            ) {
              actualQty = Math.round(parseFloat(batch.actualQuantity) / parseFloat(capacity));
            }

            return {
              subProductId: sp.batchProductId,
              productName:
                sp.product?.productName ||
                sp.product?.masterProduct?.masterProductName ||
                'Unknown',
              batchQty: sp.plannedUnits || 0,
              actualQty,
              capacity: capacity || null,
              fillingDensity: sp.product?.fillingDensity || null,
            };
          }),
          rawMaterials: rawMaterials.filter(rm => rm.productType !== 'PM'),
          packagingMaterials: Array.from(packagingMap.values()),
        };
      });

      return batchesWithBom;
    } catch (error) {
      console.error('Error fetching batch production report:', error);
      throw error;
    }
  }

  async getSalesmanRevenueReport(startDate, endDate) {
    try {
      const conditions = [];

      // Filter by date range on orderDate
      if (startDate) {
        conditions.push(gte(orders.orderDate, new Date(startDate)));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.orderDate, end));
      }

      // Exclude cancelled/rejected/returned orders
      conditions.push(notInArray(orders.status, ['Cancelled', 'Rejected', 'Returned']));

      // Include valid salespersons (where salespersonId is set)
      conditions.push(isNotNull(orders.salespersonId));

      const salesmanOrders = await db.query.orders.findMany({
        where: and(...conditions),
        with: {
          salesperson: true,
          customer: true,
        },
        orderBy: (orders, { desc }) => [desc(orders.orderDate)],
      });

      // Group by Salesperson
      const grouped = {};

      salesmanOrders.forEach(order => {
        const spId = order.salespersonId;
        const spName = order.salesperson
          ? `${order.salesperson.firstName} ${order.salesperson.lastName}`
          : 'Unknown';

        // Initialize group if not exists
        if (!grouped[spId]) {
          grouped[spId] = {
            salespersonId: spId,
            salespersonName: spName,
            totalRevenue: 0,
            orderCount: 0,
            orders: [],
          };
        }

        const amount = parseFloat(order.totalAmount || '0');
        grouped[spId].totalRevenue += amount;
        grouped[spId].orderCount += 1;
        grouped[spId].orders.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerName: order.customer?.companyName || 'Unknown',
          amount: amount,
          date: order.orderDate,
          status: order.status,
          billNo: order.account?.billNo || '-',
        });
      });

      const result = Object.values(grouped);

      // Sort by Revenue DESC
      result.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return result;
    } catch (error) {
      console.error('Error fetching salesman revenue report:', error);
      throw error;
    }
  }

  async getSalespersonIncentiveReport(startDate, endDate) {
    try {
      const conditions = [];

      if (startDate) {
        conditions.push(gte(orders.orderDate, new Date(startDate)));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.orderDate, end));
      }

      // Exclude invalid orders
      conditions.push(notInArray(orders.status, ['Cancelled', 'Rejected', 'Returned']));
      // Ensure salesperson is assigned
      conditions.push(isNotNull(orders.salespersonId));
      // Only include products with incentive > 0
      conditions.push(sql`${products.incentiveAmount} > 0`);

      const validOrders = await db
        .select({
          salespersonId: orders.salespersonId,
          salespersonFirstName: employees.firstName,
          salespersonLastName: employees.lastName,
          productId: products.productId,
          productName: products.productName,
          incentiveAmount: products.incentiveAmount,
          quantity: orderDetails.quantity,
          orderId: orders.orderId,
          orderNumber: orders.orderNumber,
          date: orders.orderDate,
        })
        .from(orderDetails)
        .innerJoin(orders, eq(orderDetails.orderId, orders.orderId))
        .innerJoin(products, eq(orderDetails.productId, products.productId))
        .leftJoin(employees, eq(orders.salespersonId, employees.employeeId))
        .where(and(...conditions));

      // Group by Salesperson
      const grouped = {};

      validOrders.forEach(item => {
        const spId = item.salespersonId;
        const spName = item.salespersonFirstName
          ? `${item.salespersonFirstName} ${item.salespersonLastName || ''}`.trim()
          : 'Unknown';

        if (!grouped[spId]) {
          grouped[spId] = {
            salespersonId: spId,
            salespersonName: spName,
            totalIncentive: 0,
            details: [],
          };
        }

        const qty = parseFloat(item.quantity || 0);
        const rate = parseFloat(item.incentiveAmount || 0);
        const incentive = qty * rate;

        grouped[spId].totalIncentive += incentive;

        // Find if product already exists in details for this salesperson
        let productEntry = grouped[spId].details.find(d => d.productId === item.productId);
        if (!productEntry) {
          productEntry = {
            productId: item.productId,
            productName: item.productName,
            totalQuantity: 0,
            incentiveRate: rate,
            totalIncentive: 0,
            orders: [], // specific orders contributing to this
          };
          grouped[spId].details.push(productEntry);
        }

        productEntry.totalQuantity += qty;
        productEntry.totalIncentive += incentive;
        productEntry.orders.push({
          orderNumber: item.orderNumber,
          date: item.date,
          quantity: qty,
          incentive: incentive,
        });
      });

      const result = Object.values(grouped);
      // Sort by Total Incentive DESC
      result.sort((a, b) => b.totalIncentive - a.totalIncentive);

      return result;
    } catch (error) {
      console.error('Error fetching salesperson incentive report:', error);
      throw error;
    }
  }

  async getDailyConsumptionReport(date) {
    try {
      if (!date) {
        throw new Error('Date is required');
      }

      const queryDate = new Date(date);
      const startOfDay = new Date(queryDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(queryDate);
      endOfDay.setHours(23, 59, 59, 999);

      // 1. Fetch all Active RM and PM Master Products
      const materials = await db
        .select({
          masterProductId: masterProducts.masterProductId,
          masterProductName: masterProducts.masterProductName,
          productType: masterProducts.productType,
        })
        .from(masterProducts)
        .where(
          and(inArray(masterProducts.productType, ['RM', 'PM']), eq(masterProducts.isActive, true))
        );

      // 2. Calculate Opening Stock based on Inventory Transactions (Ledger)
      // This remains the "Ledger View" of what was in stock at start of day
      const openingStockMap = new Map();

      const openingStockData = await db
        .select({
          masterProductId: sql`COALESCE(${inventoryTransactions.masterProductId}, ${products.masterProductId})`,
          totalQty: sql`SUM(${inventoryTransactions.quantity})`,
        })
        .from(inventoryTransactions)
        .leftJoin(products, eq(inventoryTransactions.productId, products.productId))
        .where(and(lt(inventoryTransactions.createdAt, startOfDay)))
        .groupBy(
          sql`COALESCE(${inventoryTransactions.masterProductId}, ${products.masterProductId})`
        );

      openingStockData.forEach(item => {
        if (item.masterProductId) {
          openingStockMap.set(item.masterProductId, parseFloat(item.totalQty || '0'));
        }
      });

      // 3. Calculate Consumption based on COMPLETED BATCHES for the day
      // Instead of ledger transactions, we look at what was "Used" in batches finished today.
      const consumptionMap = new Map();

      // Find batches completed today
      const completedBatches = await db
        .select({
          batchId: productionBatch.batchId,
        })
        .from(productionBatch)
        .where(
          and(
            eq(productionBatch.status, 'Completed'),
            gte(productionBatch.completedAt, startOfDay),
            lte(productionBatch.completedAt, endOfDay)
          )
        );

      const completedBatchIds = completedBatches.map(b => b.batchId);

      if (completedBatchIds.length > 0) {
        // 3a. Calculate RM Consumption (from batchMaterials)
        const batchConsumptionData = await db
          .select({
            materialId: batchMaterials.materialId,
            totalConsumption: sql`SUM(${batchMaterials.requiredQuantity})`,
          })
          .from(batchMaterials)
          .where(inArray(batchMaterials.batchId, completedBatchIds))
          .groupBy(batchMaterials.materialId);

        batchConsumptionData.forEach(item => {
          consumptionMap.set(item.materialId, parseFloat(item.totalConsumption || '0'));
        });

        // 3b. Calculate PM Consumption (from batchProducts -> products -> packagingId)
        // We look at the products produced in these batches, find their packaging (PM),
        // and sum the units produced (1 Unit produced = 1 PM consumed usually)
        const pmConsumptionData = await db
          .select({
            packagingId: products.packagingId,
            totalProduced: sql`SUM(COALESCE(${batchProducts.producedUnits}, ${batchProducts.plannedUnits}, 0))`,
          })
          .from(batchProducts)
          .innerJoin(products, eq(batchProducts.productId, products.productId))
          .where(
            and(inArray(batchProducts.batchId, completedBatchIds), isNotNull(products.packagingId))
          )
          .groupBy(products.packagingId);

        pmConsumptionData.forEach(item => {
          if (item.packagingId) {
            const current = consumptionMap.get(item.packagingId) || 0;
            // Assuming 1 Unit Product = 1 Unit Packaging
            consumptionMap.set(item.packagingId, current + parseFloat(item.totalProduced || '0'));
          }
        });
      }

      // 4. Merge Data
      const reportData = materials.map(material => {
        const openingQty = openingStockMap.get(material.masterProductId) || 0;
        const consumption = consumptionMap.get(material.masterProductId) || 0;
        // Closing Stock is Opening - Consumption (Production View)
        // Note: This might diverge from Ledger Stock if there were Inwards/Other transactions today
        const closingQty = openingQty - consumption;

        return {
          masterProductId: material.masterProductId,
          masterProductName: material.masterProductName,
          productType: material.productType,
          openingQty,
          consumption,
          closingQty,
        };
      });

      // Filter to show only materials that were consumed on the selected day
      const filteredReportData = reportData.filter(item => item.consumption > 0);

      // Sort by Name
      filteredReportData.sort((a, b) => a.masterProductName.localeCompare(b.masterProductName));

      return filteredReportData;
    } catch (error) {
      console.error('Error fetching daily consumption report:', error);
      throw error;
    }
  }

  async getMaterialInwardReport(type, startDate, endDate) {
    try {
      // Validate type
      const validTypes = ['FG', 'RM', 'PM', 'All'];
      if (type && !validTypes.includes(type)) {
        throw new Error(`Invalid product type: ${type}`);
      }

      const conditions = [];
      if (type && type !== 'All') {
        conditions.push(eq(masterProducts.productType, type));
      }

      if (startDate) {
        conditions.push(gte(materialInward.inwardDate, new Date(startDate)));
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(materialInward.inwardDate, end));
      }

      const results = await db
        .select({
          inwardId: materialInward.inwardId,
          inwardDate: materialInward.inwardDate,
          createdAt: materialInward.createdAt,
          productName: sql`COALESCE(${products.productName}, ${masterProducts.masterProductName})`,
          supplierName: suppliers.supplierName,
          billNo: materialInward.billNo,
          quantity: materialInward.quantity,
          unitPrice: materialInward.unitPrice,
          totalCost: materialInward.totalCost,
          notes: materialInward.notes,
          productType: masterProducts.productType,
          balanceQty: inventoryTransactions.balanceAfter,
        })
        .from(materialInward)
        .innerJoin(
          masterProducts,
          eq(materialInward.masterProductId, masterProducts.masterProductId)
        )
        .leftJoin(products, eq(materialInward.productId, products.productId))
        .leftJoin(suppliers, eq(materialInward.supplierId, suppliers.supplierId))
        .leftJoin(
          inventoryTransactions,
          and(
            eq(inventoryTransactions.referenceId, materialInward.inwardId),
            eq(inventoryTransactions.referenceType, 'Inward')
          )
        )
        .where(and(...conditions))
        // Use group by to avoid duplicates if multiple transactions exists, though usually 1:1 for Inward
        // We select the max balance or distinct one. For simplicity in this report, we assume the latest transaction reflects the balance.
        .groupBy(
          materialInward.inwardId,
          materialInward.inwardDate,
          materialInward.createdAt,
          products.productName,
          masterProducts.masterProductName,
          suppliers.supplierName,
          materialInward.billNo,
          materialInward.quantity,
          materialInward.unitPrice,
          materialInward.totalCost,
          materialInward.notes,
          masterProducts.productType,
          inventoryTransactions.balanceAfter
        )
        .orderBy(desc(materialInward.inwardDate));

      return results.map(row => ({
        ...row,
        // If balanceQty is found from transaction, use it.
        // Note: multiple transactions might cause row duplication without aggregation.
        // But since we group by all fields including balanceAfter, duplicates with same balance merge.
        // Ideally there's 1 transaction per inward.
        balanceQty: row.balanceQty ? Number(row.balanceQty) : null,
      }));
    } catch (error) {
      console.error('Error fetching material inward report:', error);
      throw error;
    }
  }

  async getStockReport(type, productId, startDate, endDate) {
    try {
      // Validate type
      const validTypes = ['FG', 'RM', 'PM', 'All', 'Sub-Product'];
      if (type && !validTypes.includes(type)) {
        throw new Error(`Invalid product type: ${type}`);
      }

      // Default to current month if dates not provided
      const start = startDate
        ? new Date(startDate)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate
        ? new Date(endDate)
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      end.setHours(23, 59, 59, 999);

      const results = [];

      // Fetch FG products (from products table)
      if (!type || type === 'All' || type === 'FG' || type === 'Sub-Product') {
        const fgConditions = [eq(masterProducts.productType, 'FG'), eq(products.isActive, true)];
        if (type === 'Sub-Product') {
          fgConditions.push(eq(masterProductFG.subcategory, 'Sub-Product'));
        }
        if (productId) {
          fgConditions.push(eq(products.productId, parseInt(productId)));
        }

        const fgResults = await db
          .select({
            productId: products.productId,
            productName: products.productName,
            masterProductName: masterProducts.masterProductName,
            productType: masterProducts.productType,
            availableQuantity: products.availableQuantity,
            availableWeightKg: products.availableWeightKg,
            reservedQuantity: products.reservedQuantity,
            minStockLevel: products.minStockLevel,
            sellingPrice: products.sellingPrice,
            packageCapacityKg: products.packageCapacityKg,
            isActive: products.isActive,
            updatedAt: products.updatedAt,
            totalInward: sql`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} > 0 AND ${inventoryTransactions.createdAt} >= ${start.toISOString()} AND ${inventoryTransactions.createdAt} <= ${end.toISOString()} THEN ${inventoryTransactions.quantity} ELSE 0 END), 0)`,
            totalOutward: sql`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} < 0 AND ${inventoryTransactions.createdAt} >= ${start.toISOString()} AND ${inventoryTransactions.createdAt} <= ${end.toISOString()} THEN ABS(${inventoryTransactions.quantity}) ELSE 0 END), 0)`,
          })
          .from(products)
          .innerJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
          .leftJoin(
            masterProductFG,
            eq(masterProducts.masterProductId, masterProductFG.masterProductId)
          )
          .leftJoin(inventoryTransactions, eq(products.productId, inventoryTransactions.productId))
          .where(and(...fgConditions))
          .groupBy(
            products.productId,
            products.productName,
            products.availableQuantity,
            products.availableWeightKg,
            products.reservedQuantity,
            products.sellingPrice,
            products.packageCapacityKg,
            products.isActive,
            products.updatedAt,
            products.minStockLevel,
            masterProducts.masterProductName,
            masterProducts.productType
          )
          .orderBy(products.productName);

        results.push(...fgResults);
      }

      // Fetch RM products (from master_product_rm table)
      if (!type || type === 'All' || type === 'RM') {
        const rmConditions = [
          eq(masterProducts.productType, 'RM'),
          eq(masterProducts.isActive, true),
        ];
        if (productId) {
          rmConditions.push(eq(masterProducts.masterProductId, parseInt(productId)));
        }

        // Use Drizzle query builder with proper date handling (consistent with FG/PM)
        const rmResults = await db
          .select({
            productId: masterProducts.masterProductId,
            productName: masterProducts.masterProductName,
            masterProductName: masterProducts.masterProductName,
            productType: masterProducts.productType,
            availableQuantity: masterProductRM.availableQty,
            availableWeightKg: masterProductRM.availableQty,
            reservedQuantity: sql`(
              SELECT COALESCE(SUM(bm.required_quantity), 0)
              FROM app.batch_materials bm
              JOIN app.production_batches_enhanced pb ON bm.batch_id = pb.batch_id
              WHERE bm.material_id = ${masterProducts.masterProductId}
              AND pb.status NOT IN ('Completed', 'Cancelled')
            )`,
            minStockLevel: masterProducts.minStockLevel,
            sellingPrice: masterProductRM.purchaseCost,
            packageCapacityKg: sql`0`,
            isActive: masterProducts.isActive,
            updatedAt: sql`(SELECT MAX(it.created_at) FROM app.inventory_transactions it WHERE it.master_product_id = ${masterProducts.masterProductId})`,
            // Use proper date comparison with Drizzle operators (consistent with FG/PM)
            totalInward: sql`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} > 0 AND ${inventoryTransactions.createdAt} >= ${start} AND ${inventoryTransactions.createdAt} <= ${end} THEN ${inventoryTransactions.quantity} ELSE 0 END), 0)`,
            totalOutward: sql`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} < 0 AND ${inventoryTransactions.createdAt} >= ${start} AND ${inventoryTransactions.createdAt} <= ${end} THEN ABS(${inventoryTransactions.quantity}) ELSE 0 END), 0)`,
          })
          .from(masterProducts)
          // LEFT JOIN: active RM masters without a legacy sub-row still report (qty treated as 0)
          .leftJoin(
            masterProductRM,
            eq(masterProducts.masterProductId, masterProductRM.masterProductId)
          )
          .leftJoin(
            inventoryTransactions,
            eq(masterProducts.masterProductId, inventoryTransactions.masterProductId)
          )
          .where(and(...rmConditions))
          .groupBy(
            masterProducts.masterProductId,
            masterProducts.masterProductName,
            masterProducts.productType,
            masterProducts.minStockLevel,
            masterProducts.isActive,
            masterProducts.updatedAt,
            masterProductRM.availableQty,
            masterProductRM.purchaseCost,
            masterProductRM.rmDensity
          )
          .orderBy(masterProducts.masterProductName);

        results.push(...rmResults);
      }

      // Fetch PM products (from master_product_pm table)
      if (!type || type === 'All' || type === 'PM') {
        const pmConditions = [
          eq(masterProducts.productType, 'PM'),
          eq(masterProducts.isActive, true),
        ];
        if (productId) {
          pmConditions.push(eq(masterProducts.masterProductId, parseInt(productId)));
        }

        const pmResults = await db
          .select({
            productId: masterProducts.masterProductId,
            productName: masterProducts.masterProductName,
            masterProductName: masterProducts.masterProductName,
            productType: masterProducts.productType,
            availableQuantity: masterProductPM.availableQty,
            availableWeightKg: sql`0`, // PM doesn't track weight
            reservedQuantity: sql`0`,
            minStockLevel: masterProducts.minStockLevel,
            sellingPrice: masterProductPM.purchaseCost, // Show purchase cost for PM
            packageCapacityKg: masterProductPM.capacity,
            isActive: masterProducts.isActive,
            updatedAt: sql`(SELECT MAX(it.created_at) FROM app.inventory_transactions it WHERE it.master_product_id = ${masterProducts.masterProductId})`,
            totalInward: sql`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} > 0 AND ${inventoryTransactions.createdAt} >= ${start.toISOString()} AND ${inventoryTransactions.createdAt} <= ${end.toISOString()} THEN ${inventoryTransactions.quantity} ELSE 0 END), 0)`,
            totalOutward: sql`COALESCE(SUM(CASE WHEN ${inventoryTransactions.quantity} < 0 AND ${inventoryTransactions.createdAt} >= ${start.toISOString()} AND ${inventoryTransactions.createdAt} <= ${end.toISOString()} THEN ABS(${inventoryTransactions.quantity}) ELSE 0 END), 0)`,
          })
          .from(masterProducts)
          // LEFT JOIN: active PM masters without a legacy sub-row still report (qty treated as 0)
          .leftJoin(
            masterProductPM,
            eq(masterProducts.masterProductId, masterProductPM.masterProductId)
          )
          .leftJoin(
            inventoryTransactions,
            eq(masterProducts.masterProductId, inventoryTransactions.masterProductId)
          )
          .where(and(...pmConditions))
          .groupBy(
            masterProducts.masterProductId,
            masterProducts.masterProductName,
            masterProducts.productType,
            masterProducts.minStockLevel,
            masterProducts.isActive,
            masterProducts.updatedAt,
            masterProductPM.availableQty,
            masterProductPM.purchaseCost,
            masterProductPM.capacity
          )
          .orderBy(masterProducts.masterProductName);

        results.push(...pmResults);
      }

      // Sort all results by product name
      results.sort((a, b) => {
        const nameA = a.productName || a.masterProductName || '';
        const nameB = b.productName || b.masterProductName || '';
        return nameA.localeCompare(nameB);
      });

      return results.map(item => ({
        ...item,
        availableQuantity: parseFloat(item.availableQuantity || 0),
        availableWeightKg: parseFloat(item.availableWeightKg || 0),
        minStockLevel: parseFloat(item.minStockLevel || 0),
        sellingPrice: parseFloat(item.sellingPrice || 0),
        totalInward: parseFloat(item.totalInward || 0),
        totalOutward: parseFloat(item.totalOutward || 0),
      }));
    } catch (error) {
      console.error('Error fetching stock report:', error);
      throw error;
    }
  }

  async getProfitLossReport(startDate, endDate) {
    try {
      const conditions = [];

      if (startDate) {
        conditions.push(gte(orders.orderDate, new Date(startDate)));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(orders.orderDate, end));
      }

      conditions.push(notInArray(orders.status, ['Cancelled', 'Rejected', 'Returned']));

      const orderItems = await db
        .select({
          masterProductId: masterProducts.masterProductId,
          masterProductName: masterProducts.masterProductName,
          productId: products.productId,
          productName: products.productName,
          quantity: orderDetails.quantity,
          unitPrice: orderDetails.unitPrice,
          discount: orderDetails.discount,
          productionCost: masterProductFG.productionCost,
          packageCapacityKg: products.packageCapacityKg,
        })
        .from(orderDetails)
        .innerJoin(orders, eq(orderDetails.orderId, orders.orderId))
        .innerJoin(products, eq(orderDetails.productId, products.productId))
        .innerJoin(masterProducts, eq(products.masterProductId, masterProducts.masterProductId))
        .leftJoin(
          masterProductFG,
          eq(masterProducts.masterProductId, masterProductFG.masterProductId)
        )
        .where(and(...conditions));

      const grouped = {};

      for (const item of orderItems) {
        if (!grouped[item.masterProductId]) {
          grouped[item.masterProductId] = {
            masterProductId: item.masterProductId,
            masterProductName: item.masterProductName,
            products: {},
          };
        }

        if (!grouped[item.masterProductId].products[item.productId]) {
          const prodCostRate = parseFloat(item.productionCost || '0');
          let size = parseFloat(item.packageCapacityKg || '0');

          // Fallback: Parse size from Product Name if packageCapacityKg is 0
          if (size <= 0 && item.productName) {
            const match = item.productName.match(/(\d+(\.\d+)?)\s*(L|LTR|KG|ML|GM|G)\b/i);
            if (match) {
              let value = parseFloat(match[1]);
              const unit = match[3].toUpperCase();

              // Normalize to L/Kg
              if (unit === 'ML' || unit === 'GM' || unit === 'G') {
                value = value / 1000;
              }
              size = value;
            }
          }

          let unitProductionCost = 0;
          if (size > 0 && prodCostRate > 0) {
            unitProductionCost = prodCostRate * size;
          }

          grouped[item.masterProductId].products[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            orderQty: 0,
            unitProductionCost,
            totalProductionCost: 0,
            totalSellingPrice: 0,
            grossProfit: 0,
          };
        }

        const prodGroup = grouped[item.masterProductId].products[item.productId];
        prodGroup.orderQty += item.quantity;

        // Calculate total price manually to avoid generated column issues
        const price = parseFloat(item.unitPrice || '0');
        const qty = item.quantity;
        const disc = parseFloat(item.discount || '0');
        const total = price * qty * (1 - disc / 100);

        prodGroup.totalSellingPrice += total;
        prodGroup.totalProductionCost += prodGroup.unitProductionCost * item.quantity;
      }

      const result = Object.values(grouped).map(master => {
        const productList = Object.values(master.products).map(p => {
          p.grossProfit = p.totalSellingPrice - p.totalProductionCost;
          return p;
        });

        productList.sort((a, b) => a.productName.localeCompare(b.productName));

        const masterTotalProfit = productList.reduce((sum, p) => sum + p.grossProfit, 0);
        const masterTotalSales = productList.reduce((sum, p) => sum + p.totalSellingPrice, 0);

        return {
          ...master,
          products: productList,
          totalGrossProfit: masterTotalProfit,
          totalSales: masterTotalSales,
        };
      });

      result.sort((a, b) => a.masterProductName.localeCompare(b.masterProductName));

      return result;
    } catch (error) {
      console.error('Error fetching profit loss report:', error);
      throw error;
    }
  }

  // Fetches detailed product transaction history directly from inventory_transactions table (Ledger View)
  async getProductWiseReport(productId, startDate, endDate, productType) {
    try {
      const productIdNum = productId ? parseInt(productId) : null;

      let product = null;
      let bom = [];
      let isMasterProduct = false; // Flag to track if we're dealing with a master product (RM/PM)

      if (productIdNum) {
        // For RM/PM types, the productId is actually a masterProductId, so check master products first
        if (productType === 'RM' || productType === 'PM') {
          const masterProductData = await db.query.masterProducts.findFirst({
            where: (masterProducts, { eq }) => eq(masterProducts.masterProductId, productIdNum),
            with: {
              fgDetails: true,
              rmDetails: true,
              pmDetails: true,
            },
          });

          if (masterProductData) {
            isMasterProduct = true;
            // Transform master product to product-like structure
            product = {
              productId: masterProductData.masterProductId,
              productName: masterProductData.masterProductName,
              masterProductId: masterProductData.masterProductId,
              masterProduct: masterProductData,
              availableQuantity:
                masterProductData.productType === 'RM'
                  ? masterProductData.rmDetails?.availableQty || 0
                  : masterProductData.pmDetails?.availableQty || 0,
              availableWeightKg:
                masterProductData.productType === 'RM'
                  ? parseFloat(masterProductData.rmDetails?.availableQty || 0)
                  : null,
              reservedQuantity: 0, // Placeholder, calculated later for RM
            };
          }
        } else {
          // For FG or unknown types, try to find as a SKU (product) first
          product = await db.query.products.findFirst({
            where: (products, { eq }) => eq(products.productId, productIdNum),
            with: {
              masterProduct: {
                with: {
                  fgDetails: true,
                  rmDetails: true,
                  pmDetails: true,
                },
              },
            },
          });

          // If not found as SKU, try to find as master product (fallback for RM/PM)
          if (!product) {
            const masterProductData = await db.query.masterProducts.findFirst({
              where: (masterProducts, { eq }) => eq(masterProducts.masterProductId, productIdNum),
              with: {
                fgDetails: true,
                rmDetails: true,
                pmDetails: true,
              },
            });

            if (masterProductData) {
              isMasterProduct = true;
              // Transform master product to product-like structure
              product = {
                productId: masterProductData.masterProductId,
                productName: masterProductData.masterProductName,
                masterProductId: masterProductData.masterProductId,
                masterProduct: masterProductData,
                availableQuantity:
                  masterProductData.productType === 'RM'
                    ? masterProductData.rmDetails?.availableQty || 0
                    : masterProductData.pmDetails?.availableQty || 0,
                availableWeightKg:
                  masterProductData.productType === 'RM'
                    ? parseFloat(masterProductData.rmDetails?.availableQty || 0)
                    : null,
                reservedQuantity: 0, // Placeholder, calculated later for RM
              };
            }
          }
        }

        if (product && product.masterProduct?.productType === 'FG') {
          bom = await db.query.productBom.findMany({
            where: eq(productBom.finishedGoodId, productIdNum),
            with: {
              rawMaterial: {
                with: {
                  masterProduct: true,
                },
              },
            },
          });
        }
      }

      // Build basic filtering conditions for queries
      const buildConditions = (start, end) => {
        const conds = [];
        if (productIdNum) {
          if (isMasterProduct) {
            conds.push(eq(inventoryTransactions.masterProductId, productIdNum));
          } else {
            conds.push(eq(inventoryTransactions.productId, productIdNum));
          }
        } else if (productType && productType !== 'All') {
          if (productType === 'Sub-Product') {
            conds.push(eq(masterProductFG.subcategory, 'Sub-Product'));
          } else {
            conds.push(eq(masterProducts.productType, productType));
          }
        }

        if (start) {
          conds.push(gte(inventoryTransactions.createdAt, new Date(start)));
        }

        if (end) {
          const e = new Date(end);
          e.setHours(23, 59, 59, 999);
          conds.push(lte(inventoryTransactions.createdAt, e));
        }

        return conds;
      };

      // 1. Calculate Opening Stock (Balance before startDate)
      // Only do this if a specific product is selected, as running balance across mixed products is meaningless
      let openingBalance = 0;

      if (productIdNum) {
        // A. Calculate legitimate transaction history sum before start date
        if (startDate) {
          // Re-build just the product filters manually
          const productConds = [];
          if (isMasterProduct) {
            productConds.push(eq(inventoryTransactions.masterProductId, productIdNum));
          } else {
            productConds.push(eq(inventoryTransactions.productId, productIdNum));
          }

          const preResult = await db
            .select({
              totalQuantity: sql`SUM(${inventoryTransactions.quantity})`,
            })
            .from(inventoryTransactions)
            .leftJoin(products, eq(inventoryTransactions.productId, products.productId))
            .leftJoin(
              masterProducts,
              sql`COALESCE(${products.masterProductId}, ${inventoryTransactions.masterProductId}) = ${masterProducts.masterProductId}`
            )
            .where(and(...productConds, lt(inventoryTransactions.createdAt, new Date(startDate))));

          if (preResult.length > 0 && preResult[0].totalQuantity) {
            openingBalance = Number(preResult[0].totalQuantity);
          }
        }

        // B. Calculate "Drift" or "Implied Initial Stock" by comparing Total History vs Current Master Stock
        // This fixes the mismatch where actual stock exists but no "Initial Stock" transaction was ever recorded.
        // Formula: ImpliedInit = CurrentStock - Sum(All_Transactions)

        // i. Fetch Current Official Stock
        let currentOfficialStock = 0;
        if (product) {
          currentOfficialStock = Number(product.availableQuantity || 0);
        }

        // ii. Fetch Sum of ALL transactions (Lifetime)
        const productCondsAll = [];
        if (isMasterProduct) {
          productCondsAll.push(eq(inventoryTransactions.masterProductId, productIdNum));
        } else {
          productCondsAll.push(eq(inventoryTransactions.productId, productIdNum));
        }

        const lifetimeResult = await db
          .select({
            totalQuantity: sql`SUM(${inventoryTransactions.quantity})`,
          })
          .from(inventoryTransactions)
          .where(and(...productCondsAll));

        const lifetimeSum =
          lifetimeResult.length > 0 ? Number(lifetimeResult[0].totalQuantity || 0) : 0;

        // iii. Calculate Drift
        const discrepancy = currentOfficialStock - lifetimeSum;

        // iv. Apply Drift to Opening Balance
        // If there's a discrepancy, it means there was pre-existing stock not captured in transactions.
        // We treat this as an "Implied Opening Balance" constant.
        if (Math.abs(discrepancy) > 0.001) {
          openingBalance += discrepancy;
        }
      }

      // 2. Fetch Transactions for the Report Period
      const reportConditions = buildConditions(startDate, endDate);

      // Fetch inventory transactions with enriched references
      // For FG: join via products.masterProductId
      // For RM/PM: join directly via inventoryTransactions.masterProductId
      const query = db
        .select({
          tx: inventoryTransactions,
          inward: materialInward,
          order: orders,
          customer: customers,
          batch: productionBatch,
          discard: materialDiscard,
          p: products,
          mp: masterProducts,
          supplier: suppliers,
          fg: masterProductFG,
        })
        .from(inventoryTransactions)
        .leftJoin(products, eq(inventoryTransactions.productId, products.productId))
        // Join masterProducts: use products.masterProductId for FG, or inventoryTransactions.masterProductId for RM/PM
        .leftJoin(
          masterProducts,
          sql`COALESCE(${products.masterProductId}, ${inventoryTransactions.masterProductId}) = ${masterProducts.masterProductId}`
        )
        .leftJoin(
          masterProductFG,
          eq(masterProducts.masterProductId, masterProductFG.masterProductId)
        )
        .leftJoin(
          materialInward,
          and(
            eq(inventoryTransactions.referenceId, sql`CAST(${materialInward.inwardId} AS INTEGER)`),
            eq(inventoryTransactions.referenceType, 'Inward')
          )
        )
        .leftJoin(suppliers, eq(materialInward.supplierId, suppliers.supplierId))
        .leftJoin(
          orders,
          and(
            eq(inventoryTransactions.referenceId, orders.orderId),
            inArray(inventoryTransactions.referenceType, ['Order', 'Dispatch'])
          )
        )
        .leftJoin(customers, eq(orders.customerId, customers.customerId))
        .leftJoin(
          productionBatch,
          and(
            eq(inventoryTransactions.referenceId, productionBatch.batchId),
            eq(inventoryTransactions.referenceType, 'Batch')
          )
        )
        .leftJoin(
          materialDiscard,
          and(
            eq(inventoryTransactions.referenceId, materialDiscard.discardId),
            eq(inventoryTransactions.referenceType, 'Discard')
          )
        )
        .where(reportConditions.length > 0 ? and(...reportConditions) : undefined)
        // IMPORTANT: Sort ASCENDING for running balance calculation
        .orderBy(inventoryTransactions.createdAt, inventoryTransactions.transactionId);

      const transactions = await query;

      // 3. Get Batch Consumption Info if RM
      let batchConsumptions = [];
      if (productType === 'RM' && productIdNum) {
        batchConsumptions = await db
          .select({
            batchNo: productionBatch.batchNo,
            status: productionBatch.status,
            quantity: batchMaterials.requiredQuantity,
            createdAt: batchMaterials.createdAt,
          })
          .from(batchMaterials)
          .innerJoin(productionBatch, eq(batchMaterials.batchId, productionBatch.batchId))
          .where(
            and(
              eq(batchMaterials.materialId, productIdNum),
              ne(productionBatch.status, 'Cancelled'),
              ne(productionBatch.status, 'Completed')
            )
          );
      }

      // 4. Process Transactions & Calculate Running Balance
      let currentRunningBalance = openingBalance;

      const processedTransactions = transactions.map(
        ({ tx, inward, order, customer, batch, discard, p, mp, supplier, fg }) => {
          const quantity = Number(tx.quantity);
          const isInward = quantity > 0;
          const isOutward = quantity < 0;

          // Prioritize SKU product name (sub-product) over master product name
          const currentProductName = p?.productName || mp?.masterProductName || 'Unknown Product';

          // Determine a more descriptive "type" (Details) based on available reference data
          // For FG: customer name for dispatch, batch no for production output
          // For RM: supplier name for inward, batch no for production consumption
          let referenceInfo = '-';

          if (
            tx.transactionType === 'Dispatch' ||
            tx.referenceType === 'Dispatch' ||
            tx.referenceType === 'Order'
          ) {
            // Dispatch/Order - show customer name
            referenceInfo =
              customer?.companyName || (order ? `Order: ${order.orderNumber}` : tx.notes || '-');
          } else if (tx.transactionType === 'Production Consumption') {
            // Production Consumption (RM being used) - show batch number AND Date
            const dateStr = batch?.scheduledDate
              ? new Date(batch.scheduledDate).toLocaleDateString()
              : '';
            referenceInfo = batch?.batchNo
              ? `${batch.batchNo}${dateStr ? ` (${dateStr})` : ''}`
              : tx.notes || '-';
          } else if (tx.transactionType === 'Production Output' || tx.referenceType === 'Batch') {
            // Production Output (FG being created) - show batch number AND Date
            const dateStr = batch?.scheduledDate
              ? new Date(batch.scheduledDate).toLocaleDateString()
              : '';
            referenceInfo = batch?.batchNo
              ? `${batch.batchNo}${dateStr ? ` (${dateStr})` : ''}`
              : tx.notes || '-';
          } else if (tx.transactionType === 'Inward' || tx.referenceType === 'Inward') {
            // Inward (material received) - show supplier name
            referenceInfo = supplier?.supplierName || (inward ? inward.billNo : tx.notes || '-');
          } else if (tx.transactionType === 'Initial Stock') {
            // Initial stock entry
            referenceInfo = tx.notes || 'Initial Stock';
          } else if (tx.transactionType === 'Discard' || tx.referenceType === 'Discard') {
            // Discarded material - show reason
            referenceInfo = discard?.reason || tx.notes || 'Material Discarded';
          } else if (tx.transactionType === 'Adjustment') {
            // Manual adjustment
            referenceInfo = tx.notes || 'Adjustment';
          } else {
            // Fallback
            referenceInfo = tx.notes || tx.referenceType || tx.transactionType || '-';
          }

          // Use the actual transaction type from the database
          const transitionType = tx.transactionType;

          let category = mp?.productType || 'Unknown';
          if (fg?.subcategory === 'Sub-Product') {
            category = 'Sub-Product';
          }

          const cr = isInward ? quantity : 0;
          const dr = isOutward ? Math.abs(quantity) : 0;

          // DYNAMIC BALANCE CALCULATION
          // Update running balance
          currentRunningBalance += quantity;
          const balance = currentRunningBalance;

          // Formula: Available Stock = Balance + DR - CR (reversing logic for display if needed?)
          // No, with running balance: Balance BEFORE = Balance - Quantity
          const preTransactionStock = balance - quantity;

          return {
            transactionId: Number(tx.transactionId),
            productName: currentProductName,
            date: tx.createdAt ? new Date(tx.createdAt).toISOString() : '-', // Return full ISO string for time display
            type: referenceInfo,
            batchType: batch?.batchType, // Return batch type (MTS/MTO)
            inward: cr,
            outward: dr,
            balance, // Use the dynamically calculated balance
            stockBefore: preTransactionStock,
            transactionType: transitionType,
            productCategory: category,
            notes: tx.notes || '',
            originalSnapshotBalance: tx.balanceAfter, // (Optional debugging)
          };
        }
      );

      // Reverse list to show Newest First (standard report format)
      processedTransactions.reverse();

      return {
        product: product
          ? {
              ...product,
              masterProductName: product.masterProduct?.masterProductName,
              productType: product.masterProduct?.productType,
              fgDetails: product.masterProduct?.fgDetails,
              rmDetails: product.masterProduct?.rmDetails,
              pmDetails: product.masterProduct?.pmDetails,
              reservedQuantity:
                productType === 'RM'
                  ? (batchConsumptions || []).reduce(
                      (sum, item) => sum + parseFloat(item.quantity || 0),
                      0
                    )
                  : product.reservedQuantity || 0,
            }
          : null,
        transactions: processedTransactions,
        bom: bom.map(b => ({
          rawMaterialName:
            b.rawMaterial?.masterProduct?.masterProductName || b.rawMaterial?.productName,
          percentage: Number(b.percentage),
          notes: b.notes,
        })),
      };
    } catch (error) {
      console.error('Error fetching product wise report:', error);
      throw error;
    }
  }

  async getOrderCountsByMonth() {
    try {
      const result = await db.execute(sql`
        SELECT 
            EXTRACT(YEAR FROM order_date)::integer as "year",
            EXTRACT(MONTH FROM order_date)::integer as "month",
            COUNT(*)::integer as "count"
        FROM app.orders
        GROUP BY 1, 2
    `);
      return result.rows;
    } catch (error) {
      console.error('Error in getOrderCountsByMonth service', error);
      throw error;
    }
  }

  async getCancelledOrders(year, month) {
    try {
      // Use both order_date (placed date) and updated_at (approx. cancellation date)
      // to ensure highly recently cancelled items appear in the current filter.
      let whereClause = sql`LOWER(COALESCE(o.status, '')) IN ('cancelled', 'rejected', 'returned', 'cancel', 'reject')`;

      if (year) {
        const yearInt = parseInt(year);
        whereClause = sql`${whereClause} AND (
          EXTRACT(YEAR FROM o.order_date) = ${yearInt} 
          OR EXTRACT(YEAR FROM o.updated_at) = ${yearInt}
        )`;
      }

      if (month && month !== '') {
        const monthInt = parseInt(month) + 1; // Frontend is 0-indexed, DB 1-indexed
        whereClause = sql`${whereClause} AND (
          EXTRACT(MONTH FROM o.order_date) = ${monthInt} 
          OR EXTRACT(MONTH FROM o.updated_at) = ${monthInt}
        )`;
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
          ORDER BY GREATEST(o.order_date, o.updated_at) DESC
      `);

      return result.rows;
    } catch (error) {
      console.error('Error in getCancelledOrders service', error);
      throw error;
    }
  }

  async getDispatchReport(startDate, endDate) {
    try {
      const conditions = [];

      if (startDate) {
        conditions.push(gte(dispatches.dispatchDate, new Date(startDate)));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(dispatches.dispatchDate, end));
      }

      const results = await db
        .select({
          dispatchId: dispatches.dispatchId,
          dispatchDate: dispatches.dispatchDate,
          vehicleNumber: dispatches.vehicleNo,
          driverName: dispatches.driverName,
          status: dispatches.status,
          remarks: dispatches.remarks,
          dispatchManifest: sql`array_agg(DISTINCT jsonb_build_object('orderNumber', ${orders.orderNumber}, 'customerName', ${customers.companyName}, 'productName', ${products.productName}, 'quantity', ${orderDetails.quantity}))`,
          totalQuantity: sql`SUM(${orderDetails.quantity})`,
          loadedWeight: sql`SUM(${orderDetails.quantity} * COALESCE(${products.packageCapacityKg}, 0))`,
          vehicleCapacity: vehicles.capacity,
        })
        .from(dispatches)
        .leftJoin(orders, eq(dispatches.dispatchId, orders.dispatchId))
        .leftJoin(customers, eq(orders.customerId, customers.customerId))
        .leftJoin(orderDetails, eq(orders.orderId, orderDetails.orderId))
        .leftJoin(products, eq(orderDetails.productId, products.productId))
        .leftJoin(vehicles, eq(dispatches.vehicleNo, vehicles.vehicleNumber))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(
          dispatches.dispatchId,
          dispatches.dispatchDate,
          dispatches.vehicleNo,
          dispatches.driverName,
          dispatches.status,
          dispatches.remarks,
          vehicles.capacity
        )
        .orderBy(desc(dispatches.dispatchDate));

      return results.map(row => {
        const rawManifest = Array.isArray(row.dispatchManifest) ? row.dispatchManifest : [];
        const validManifest = rawManifest.filter(item => item && item.orderNumber);

        const orderNumbers = [...new Set(validManifest.map(m => m.orderNumber).filter(Boolean))];
        const customerNames = [...new Set(validManifest.map(m => m.customerName).filter(Boolean))];
        const productNames = [...new Set(validManifest.map(m => m.productName).filter(Boolean))];

        return {
          dispatchNo: row.dispatchId ? `DSP-${row.dispatchId}` : '-',
          dispatchDate: row.dispatchDate,
          vehicleNumber: row.vehicleNumber || '-',
          driverName: row.driverName || '-',
          orderNumbers,
          customers: customerNames,
          products: productNames,
          dispatchManifest: validManifest,
          totalQuantity: row.totalQuantity ? Number(row.totalQuantity) : 0,
          loadedWeight: row.loadedWeight ? parseFloat(row.loadedWeight) : 0,
          vehicleCapacity: row.vehicleCapacity != null ? parseFloat(row.vehicleCapacity) : null,
          status: row.status || '-',
          remarks: row.remarks || '-',
        };
      });
    } catch (error) {
      console.error('Error fetching dispatch report:', error);
      throw error;
    }
  }
}
