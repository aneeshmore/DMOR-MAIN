import { DashboardService } from './service.js';

export class DashboardController {
  constructor() {
    this.service = new DashboardService();
  }

  getProductStockView = async (req, res, next) => {
    try {
      const data = await this.service.getProductStockView();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getOrderPaymentStatus = async (req, res, next) => {
    try {
      const status = req.query.status || 'Pending Accounts Approval';
      const data = await this.service.getOrderPaymentStatus(status);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getProductionStatusReport = async (req, res, next) => {
    try {
      const data = await this.service.getProductionStatusReport();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getPaymentClearedOrders = async (req, res, next) => {
    try {
      const data = await this.service.getPaymentClearedOrders();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getOrderCountsByMonth = async (req, res, next) => {
    try {
      const data = await this.service.getOrderCountsByMonth();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getCancelledOrders = async (req, res, next) => {
    try {
      const { year, month } = req.query;
      const data = await this.service.getCancelledOrders(year, month);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getProfitLossReport = async (req, res, next) => {
    try {
      const data = await this.service.getProfitLossReport();
      console.log('Profit Loss Report Data:', data);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Profit Loss Report Error:', error);
      next(error);
    }
  };
}

export const dashboardController = new DashboardController();
