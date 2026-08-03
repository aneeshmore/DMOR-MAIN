import { DiscardService } from './service.js';
import { createDiscardSchema, updateDiscardSchema } from './schema.js';
import { AppError } from '../../utils/AppError.js';

export class DiscardController {
  constructor() {
    this.service = new DiscardService();
  }

  getAllDiscards = async (req, res, next) => {
    try {
      const filters = {
        productId: req.query.productId ? parseInt(req.query.productId) : undefined,
        productType: req.query.productType ? String(req.query.productType) : undefined,
      };
      const discards = await this.service.getAllDiscards(filters);
      res.json({
        success: true,
        data: discards,
      });
    } catch (error) {
      next(error);
    }
  };

  getDiscardById = async (req, res, next) => {
    try {
      const discard = await this.service.getDiscardById(req.params.id);
      res.json({
        success: true,
        data: discard,
      });
    } catch (error) {
      next(error);
    }
  };

  createDiscard = async (req, res, next) => {
    console.log('Received Create Discard Request:', req.body);
    try {
      const validation = createDiscardSchema.safeParse(req.body);
      if (!validation.success) {
        const errorMessages = validation.error.errors
          .map(e => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError(`Validation Error: ${errorMessages}`, 400);
      }

      const { quantityPerUnit, numberOfUnits, unitId, productType, ...others } = validation.data;
      const totalQuantity = quantityPerUnit * numberOfUnits;

      const discardPayload = {
        ...others,
        unitId,
        productType,
        quantity: totalQuantity,
      };

      const discard = await this.service.createDiscard(discardPayload);
      res.status(201).json({
        success: true,
        data: discard,
        message: 'Discard entry created successfully',
      });
    } catch (error) {
      console.error('Create Discard Error:', error);
      next(error);
    }
  };

  updateDiscard = async (req, res, next) => {
    try {
      const validation = updateDiscardSchema.safeParse(req.body);
      if (!validation.success) {
        const errorMessages = validation.error.errors
          .map(e => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError(`Validation Error: ${errorMessages}`, 400);
      }

      const discard = await this.service.updateDiscard(req.params.id, validation.data);
      res.json({
        success: true,
        data: discard,
        message: 'Discard entry updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteDiscard = async (req, res, next) => {
    try {
      await this.service.deleteDiscard(req.params.id);
      res.json({
        success: true,
        message: 'Discard entry deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
