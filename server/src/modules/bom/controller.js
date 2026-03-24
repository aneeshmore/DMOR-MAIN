import { BOMService } from './service.js';
import { createBOMSchema, updateBOMSchema } from './schema.js';
import logger from '../../config/logger.js';
import { AppError } from '../../utils/AppError.js';
import { z } from 'zod';

export class BOMController {
  constructor() {
    this.service = new BOMService();
  }

  getFinishedGoods = async (req, res, next) => {
    try {
      const finishedGoods = await this.service.getFinishedGoods();
      res.json({
        success: true,
        data: finishedGoods,
      });
    } catch (error) {
      next(error);
    }
  };

  calculateBOM = async (req, res, next) => {
    try {
      const { finishedGoodId, productionQuantity } = req.body;
      const requirements = await this.service.calculateBOMRequirements(
        finishedGoodId,
        productionQuantity
      );
      res.json({
        success: true,
        data: requirements,
      });
    } catch (error) {
      next(error);
    }
  };

  getBOMByFinishedGood = async (req, res, next) => {
    try {
      const finishedGoodId = parseInt(req.params.finishedGoodId);
      if (isNaN(finishedGoodId)) {
        throw new AppError('Invalid finished good ID', 400);
      }
      const bom = await this.service.getBOMByFinishedGood(finishedGoodId);

      res.json({
        success: true,
        data: bom,
      });
    } catch (error) {
      next(error);
    }
  };

  createBOM = async (req, res, next) => {
    try {
      const validatedData = createBOMSchema.parse(req.body);
      const bom = await this.service.createBOM(validatedData);

      logger.info('BOM entry created', { bomId: bom.bomId });

      res.status(201).json({
        success: true,
        data: bom,
      });
    } catch (error) {
      next(error);
    }
  };

  updateBOM = async (req, res, next) => {
    try {
      const bomId = parseInt(req.params.id);
      const validatedData = updateBOMSchema.parse(req.body);

      const bom = await this.service.updateBOM(bomId, validatedData);

      logger.info('BOM entry updated', { bomId });

      res.json({
        success: true,
        data: bom,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteBOM = async (req, res, next) => {
    try {
      const bomId = parseInt(req.params.id);
      await this.service.deleteBOM(bomId);

      logger.info('BOM entry deleted', { bomId });

      res.json({
        success: true,
        message: 'BOM entry deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  replaceBOM = async (req, res, next) => {
    try {
      const finishedGoodId = parseInt(req.params.finishedGoodId);
      const schema = z.object({
        bomItems: z.array(createBOMSchema.omit({ finishedGoodId: true })),
      });

      const { bomItems } = schema.parse(req.body);
      const bom = await this.service.replaceBOM(finishedGoodId, bomItems);

      logger.info('BOM replaced', { finishedGoodId });

      res.json({
        success: true,
        data: bom,
      });
    } catch (error) {
      next(error);
    }
  };
}
