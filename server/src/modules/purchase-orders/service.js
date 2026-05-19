import { PurchaseOrdersRepository } from './repository.js';
import { PurchaseOrderDTO, PurchaseOrderWithItemsDTO } from './dto.js';
import { AppError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';

export class PurchaseOrdersService {
  constructor() {
    this.repository = new PurchaseOrdersRepository();
  }

  async getAllPurchaseOrders(limit, offset, status) {
    try {
      const pos = await this.repository.findAll({ limit, offset, status });
      const posWithItems = await Promise.all(
        pos.map(async po => {
          const items = await this.repository.getItems(po.purchaseOrderId);
          return new PurchaseOrderDTO(po, items);
        })
      );
      return posWithItems;
    } catch (error) {
      logger.error('Error in getAllPurchaseOrders service:', error);
      throw error;
    }
  }

  async getPurchaseOrderById(purchaseOrderId) {
    const po = await this.repository.findById(purchaseOrderId);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }
    const items = await this.repository.getItems(purchaseOrderId);
    return new PurchaseOrderWithItemsDTO(po, items);
  }

  async createPurchaseOrder(poData) {
    logger.info('Creating purchase order:', poData);

    const { items: itemsData, ...poInfo } = poData;

    // Calculate total amount from items
    const totalAmount = itemsData.reduce((sum, item) => {
      return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice || 0);
    }, 0);

    // Generate PO number
    const poNumber = await this.repository.getNextPoNumber();

    const mappedPoInfo = {
      poNumber,
      supplierId: poInfo.supplierId,
      orderDate: poInfo.orderDate,
      expectedDeliveryDate: poInfo.expectedDeliveryDate || null,
      status: poInfo.status || 'Pending',
      totalAmount: totalAmount.toFixed(2),
      notes: poInfo.notes || null,
      deliveryAddress: poInfo.deliveryAddress || null,
    };

    const po = await this.repository.create(mappedPoInfo);
    logger.info('Purchase order created with ID:', po.purchaseOrderId);

    // Create line items
    const createdItems = [];
    for (const item of itemsData) {
      const qty = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice || 0);
      const created = await this.repository.createItem({
        purchaseOrderId: po.purchaseOrderId,
        itemDescription: item.itemDescription,
        quantity: String(qty),
        unit: item.unit || null,
        unitPrice: String(price),
        totalPrice: String((qty * price).toFixed(2)),
      });
      createdItems.push(created);
    }

    return new PurchaseOrderWithItemsDTO({ ...po, supplierName: null }, createdItems);
  }

  async updatePurchaseOrder(purchaseOrderId, updateData) {
    const existing = await this.repository.findById(purchaseOrderId);
    if (!existing) {
      throw new AppError('Purchase order not found', 404);
    }

    const { items: itemsData, ...poInfo } = updateData;

    const updatePayload = {};
    if (poInfo.supplierId !== undefined) updatePayload.supplierId = poInfo.supplierId;
    if (poInfo.orderDate !== undefined) updatePayload.orderDate = poInfo.orderDate;
    if (poInfo.expectedDeliveryDate !== undefined)
      updatePayload.expectedDeliveryDate = poInfo.expectedDeliveryDate;
    if (poInfo.status !== undefined) updatePayload.status = poInfo.status;
    if (poInfo.notes !== undefined) updatePayload.notes = poInfo.notes;
    if (poInfo.deliveryAddress !== undefined)
      updatePayload.deliveryAddress = poInfo.deliveryAddress;

    if (Array.isArray(itemsData)) {
      const totalAmount = itemsData.reduce((sum, item) => {
        return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice || 0);
      }, 0);
      updatePayload.totalAmount = totalAmount.toFixed(2);
    }

    await this.repository.update(purchaseOrderId, updatePayload);

    if (Array.isArray(itemsData)) {
      await this.repository.deleteItemsByPoId(purchaseOrderId);
      for (const item of itemsData) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice || 0);
        await this.repository.createItem({
          purchaseOrderId,
          itemDescription: item.itemDescription,
          quantity: String(qty),
          unit: item.unit || null,
          unitPrice: String(price),
          totalPrice: String((qty * price).toFixed(2)),
        });
      }
    }

    return await this.getPurchaseOrderById(purchaseOrderId);
  }

  async deletePurchaseOrder(purchaseOrderId) {
    const existing = await this.repository.findById(purchaseOrderId);
    if (!existing) {
      throw new AppError('Purchase order not found', 404);
    }
    await this.repository.delete(purchaseOrderId);
    logger.info('Purchase order soft-deleted', { purchaseOrderId });
  }
}
