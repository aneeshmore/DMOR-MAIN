import { InwardFromPoService } from './service.js';
import { createInwardFromPoSchema, updateInwardFromPoSchema } from './schema.js';
import logger from '../../config/logger.js';

export class InwardFromPoController {
  constructor() {
    this.service = new InwardFromPoService();
  }

  getAll = async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const inwards = await this.service.getAll(limit, offset);
      res.json({ success: true, data: inwards });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const inwardPoId = parseInt(req.params.id);
      const inward = await this.service.getById(inwardPoId);
      res.json({ success: true, data: inward });
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const validatedData = createInwardFromPoSchema.parse(req.body);
      const inward = await this.service.create(validatedData);
      logger.info('Inward from PO created', { inwardPoId: inward.inward_po_id });
      res.status(201).json({ success: true, data: inward });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      const inwardPoId = parseInt(req.params.id);
      await this.service.delete(inwardPoId);
      logger.info('Inward from PO deleted', { inwardPoId });
      res.json({ success: true, message: 'Inward from Purchase Order deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
