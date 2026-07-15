import { DispatchPlanningService } from './service.js';
import { createDispatchSchema, createVehicleSchema } from './schema.js';
import logger from '../../config/logger.js';

export class DispatchPlanningController {
  constructor() {
    this.service = new DispatchPlanningService();
  }

  getDispatchQueue = async (req, res, next) => {
    try {
      const data = await this.service.getDispatchQueue();
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getReturnedQueue = async (req, res, next) => {
    try {
      const data = await this.service.getReturnedQueue();
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getVehicles = async (req, res, next) => {
    try {
      const data = await this.service.getVehicles();
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  addVehicle = async (req, res, next) => {
    try {
      const payload = createVehicleSchema.parse(req.body);
      const vehicle = await this.service.addVehicle(payload);

      logger.info('Vehicle added from Dispatch Planning', {
        vehicleNumber: vehicle.vehicleNumber,
      });

      res.status(201).json({
        success: true,
        data: vehicle,
      });
    } catch (error) {
      next(error);
    }
  };

  createDispatch = async (req, res, next) => {
    try {
      const payload = createDispatchSchema.parse(req.body);

      // Inject user info
      const performedBy = req.user?.employeeId || 1;

      const result = await this.service.createDispatch({
        ...payload,
        performedBy,
      });

      logger.info('Dispatch created', { count: result.count, vehicle: payload.vehicleNo });

      res.json({
        success: true,
        message: `Successfully dispatched ${result.count} orders.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
  requeueOrder = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      await this.service.requeueOrder(orderId);
      res.json({
        success: true,
        message: 'Order moved to main queue',
      });
    } catch (error) {
      next(error);
    }
  };

  getDispatchDetails = async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await this.service.getDispatchDetails(id);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Dispatch not found' });
      }
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
