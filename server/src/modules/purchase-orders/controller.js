import { PurchaseOrdersService } from './service.js';
import { createPurchaseOrderSchema, updatePurchaseOrderSchema } from './schema.js';
import logger from '../../config/logger.js';

export class PurchaseOrdersController {
  constructor() {
    this.service = new PurchaseOrdersService();
  }

  getAllPurchaseOrders = async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status;
      const pos = await this.service.getAllPurchaseOrders(limit, offset, status);
      res.json({ success: true, data: pos });
    } catch (error) {
      next(error);
    }
  };

  getPurchaseOrderById = async (req, res, next) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const po = await this.service.getPurchaseOrderById(purchaseOrderId);
      res.json({ success: true, data: po });
    } catch (error) {
      next(error);
    }
  };

  createPurchaseOrder = async (req, res, next) => {
    try {
      const validatedData = createPurchaseOrderSchema.parse(req.body);
      const po = await this.service.createPurchaseOrder(validatedData);
      logger.info('Purchase order created', { purchaseOrderId: po.purchaseOrderId });
      res.status(201).json({ success: true, data: po });
    } catch (error) {
      next(error);
    }
  };

  updatePurchaseOrder = async (req, res, next) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const validatedData = updatePurchaseOrderSchema.parse(req.body);
      const po = await this.service.updatePurchaseOrder(purchaseOrderId, validatedData);
      logger.info('Purchase order updated', { purchaseOrderId });
      res.json({ success: true, data: po });
    } catch (error) {
      next(error);
    }
  };

  deletePurchaseOrder = async (req, res, next) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      await this.service.deletePurchaseOrder(purchaseOrderId);
      logger.info('Purchase order deleted', { purchaseOrderId });
      res.json({ success: true, message: 'Purchase order deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
