import { DashboardRepository } from './repository.js';
import { ProductStockDTO, OrderPaymentDTO, ProductionStatusDTO } from './dto.js';
import { AppError, ValidationError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';

export class DashboardService {
  constructor() {
    this.repository = new DashboardRepository();
  }

  async getProductStockView() {
    try {
      const data = await this.repository.getProductStockView();
      return data.map(item => new ProductStockDTO(item));
    } catch (error) {
      logger.error('Error in getProductStockView', { error: error.message });
      throw new AppError('Failed to fetch product stock view', 500);
    }
  }

  async getOrderPaymentStatus(status = 'Pending Accounts Approval') {
    try {
      const validStatuses = [
        // New workflow statuses
        'Pending Accounts Approval',
        'Pending Factory Approval',
        'Factory Approved',
        'Scheduled for Production',
        'Ready for Dispatch',
        'Dispatched',
        'On Hold',
        // Legacy statuses (existing orders)
        'Pending',
        'Verified',
        'Accepted',
        'Delivered',
        'Cancelled',
      ];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid order status');
      }

      const data = await this.repository.getOrderPaymentStatus(status);
      return data.map(order => new OrderPaymentDTO(order));
    } catch (error) {
      logger.error('Error in getOrderPaymentStatus', { error: error.message, status });
      if (error instanceof ValidationError) throw error;
      throw new AppError('Failed to fetch order payment status', 500);
    }
  }

  async getProductionStatusReport() {
    try {
      const data = await this.repository.getProductionStatusReport();
      return data.map(batch => new ProductionStatusDTO(batch));
    } catch (error) {
      logger.error('Error in getProductionStatusReport', { error: error.message });
      throw new AppError('Failed to fetch production status report', 500);
    }
  }

  async getPaymentClearedOrders() {
    try {
      const data = await this.repository.getPaymentClearedOrders();
      return data.map(item => ({
        ...item,
        TimeSpan: `${Math.floor(item.TimeSpanDays || 0)} days`,
      }));
    } catch (error) {
      logger.error('Error in getPaymentClearedOrders', { error: error.message });
      throw error;
    }
  }

  async getOrderCountsByMonth() {
    try {
      return await this.repository.getOrderCountsByMonth();
    } catch (error) {
      logger.error('Error in getOrderCountsByMonth', { error: error.message });
      throw error;
    }
  }

  async getCancelledOrders(year, month) {
    try {
      return await this.repository.getCancelledOrders(year, month);
    } catch (error) {
      logger.error('Error in getCancelledOrders', { error: error.message, year, month });
      throw error;
    }
  }

  async getProfitLossReport() {
    try {
      return await this.repository.getProfitLossReport();
    } catch (error) {
      logger.error('Error in getProfitLossReport', { error: error.message });
      throw error;
    }
  }
}
