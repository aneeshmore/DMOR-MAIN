import { InwardFromPoRepository } from './repository.js';
import { InwardRepository } from '../Inward/repository.js';
import { NotificationsService } from '../notifications/service.js';
import { InventoryRepository } from '../inventory/repository.js';
import { PurchaseOrdersRepository } from '../purchase-orders/repository.js';
import { AppError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';
import { sql } from 'drizzle-orm';
import db from '../../db/index.js';

export class InwardFromPoService {
  constructor() {
    this.repository = new InwardFromPoRepository();
    this.inwardRepository = new InwardRepository();
    this.notificationsService = new NotificationsService();
    this.inventoryRepository = new InventoryRepository();
  }

  async getAll(limit, offset) {
    try {
      return await this.repository.findAll({ limit, offset });
    } catch (error) {
      logger.error('Failed to get inward entries from PO:', error);
      throw error;
    }
  }

  async getById(inwardPoId) {
    const header = await this.repository.findById(inwardPoId);
    if (!header) {
      throw new AppError('Inward from Purchase Order not found', 404);
    }
    const items = await this.repository.findItemsByInwardPoId(inwardPoId);
    return { ...header, items };
  }

  async create(payload) {
    logger.info('Creating Inward from Purchase Order:', payload);

    const { items: itemsData, ...headerInfo } = payload;

    // Calculate total cost
    const totalCost = itemsData.reduce((sum, item) => {
      return sum + parseFloat(item.receivedQuantity) * parseFloat(item.unitPrice || 0);
    }, 0);

    const createdHeader = await this.repository.create({
      purchaseOrderId: headerInfo.purchaseOrderId,
      supplierId: headerInfo.supplierId,
      billNo: headerInfo.billNo || null,
      inwardDate: headerInfo.inwardDate || new Date().toISOString().slice(0, 10),
      notes: headerInfo.notes || null,
      totalCost,
    });

    const createdItems = [];
    for (const item of itemsData) {
      const qty = parseFloat(item.receivedQuantity);
      const price = parseFloat(item.unitPrice || 0);
      const itemCost = qty * price;

      const createdItem = await this.repository.createItem({
        inwardPoId: createdHeader.inward_po_id,
        purchaseOrderItemId: item.purchaseOrderItemId || null,
        masterProductId: item.masterProductId || null,
        productId: item.productId || null,
        unitId: item.unitId || null,
        itemDescription: item.itemDescription,
        receivedQuantity: String(qty),
        unit: item.unit || null,
        unitPrice: String(price),
        totalCost: String(itemCost.toFixed(2)),
      });

      createdItems.push(createdItem);

      // Now, update stock in database!
      // Reuse the established InwardRepository.updateMasterProductStock to handle product stock and transaction logging!
      if (item.masterProductId) {
        try {
          await this.inwardRepository.updateMasterProductStock(
            item.masterProductId, // Master Product ID
            qty, // quantity to add
            price, // purchase cost / unit price
            item.productId || null, // SKU ID for FG
            createdHeader.inward_po_id // Pass ID to log inventory transactions
          );

          // Auto-clear low-stock shortage notifications exactly like standard Inward module
          const skuProducts = await this.inventoryRepository.findAllProducts({
            masterProductId: item.masterProductId,
          });
          for (const product of skuProducts) {
            if (product.masterProductId === item.masterProductId) {
              await this.notificationsService.clearResolvedShortageAlerts(
                product.productId,
                product.availableQuantity,
                product.minStockLevel || 0
              );
            }
          }
        } catch (stockError) {
          logger.error('Failed to update stock / log transaction for item:', {
            masterProductId: item.masterProductId,
            error: stockError.message,
          });
          // Do not fail the transaction to maintain resilience, but log the error
        }
      }
    }

    // Auto-calculate and update Purchase Order status
    await this.updatePurchaseOrderStatus(headerInfo.purchaseOrderId);

    return { ...createdHeader, items: createdItems };
  }

  async updatePurchaseOrderStatus(purchaseOrderId) {
    try {
      const poRepository = new PurchaseOrdersRepository();

      // 1. Fetch all ordered items
      const poItems = await poRepository.getItems(purchaseOrderId);
      if (!poItems || poItems.length === 0) return;

      // 2. Fetch all received quantities from inward_from_po_items for this PO
      const receivedRows = await db.execute(sql`
        SELECT 
          ipoi.purchase_order_item_id,
          SUM(ipoi.received_quantity) as total_received
        FROM app.inward_from_po_items ipoi
        INNER JOIN app.inward_from_po ipo ON ipo.inward_po_id = ipoi.inward_po_id
        WHERE ipo.purchase_order_id = ${purchaseOrderId}
        GROUP BY ipoi.purchase_order_item_id
      `);

      const receivedMap = {};
      const rows = receivedRows.rows || receivedRows;
      rows.forEach(r => {
        receivedMap[r.purchase_order_item_id] = parseFloat(r.total_received || 0);
      });

      // 3. Determine status
      let allCompleted = true;
      let anyReceived = false;

      for (const poItem of poItems) {
        const ordered = parseFloat(poItem.quantity || 0);
        const received = receivedMap[poItem.item_id || poItem.itemId] || 0;

        if (received > 0) {
          anyReceived = true;
        }
        if (received < ordered) {
          allCompleted = false;
        }
      }

      let newStatus = 'Pending';
      if (allCompleted) {
        newStatus = 'Completed';
      } else if (anyReceived) {
        newStatus = 'Partial';
      }

      logger.info(`Updating Purchase Order ${purchaseOrderId} status to ${newStatus}`);
      await poRepository.update(purchaseOrderId, { status: newStatus });
    } catch (err) {
      logger.error('Failed to auto-update Purchase Order status:', err);
    }
  }

  async delete(inwardPoId) {
    // Standard delete flow: removes inward_from_po records.
    // Stock adjustment could be handled, but simple CRUD deletion as reference is ideal.
    const existing = await this.repository.findById(inwardPoId);
    if (!existing) {
      throw new AppError('Inward entry not found', 404);
    }
    await this.repository.delete(inwardPoId);
    logger.info('Inward from PO entry deleted:', { inwardPoId });

    // Re-calculate and update Purchase Order status
    if (existing.purchase_order_id) {
      await this.updatePurchaseOrderStatus(existing.purchase_order_id);
    }
  }
}
