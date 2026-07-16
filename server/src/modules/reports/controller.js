import { ReportsService } from './service.js';

const reportsService = new ReportsService();

export const getBatchProductionReport = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;
    const data = await reportsService.getBatchProductionReport(status, startDate, endDate);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getDailyConsumptionReport = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }
    const data = await reportsService.getDailyConsumptionReport(date);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMaterialInwardReport = async (req, res, next) => {
  try {
    const { type, startDate, endDate } = req.query;
    // Type is optional now, defaults to All if not provided or handled in service

    const data = await reportsService.getMaterialInwardReport(type, startDate, endDate);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getStockReport = async (req, res, next) => {
  try {
    const { type, productId, startDate, endDate } = req.query;
    // Type is optional now

    const data = await reportsService.getStockReport(type, productId, startDate, endDate);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfitLossReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportsService.getProfitLossReport(startDate, endDate);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductWiseReport = async (req, res, next) => {
  try {
    const { productId, productType, startDate, endDate } = req.query;

    const data = await reportsService.getProductWiseReport(
      productId,
      startDate,
      endDate,
      productType
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderCountsByMonth = async (req, res, next) => {
  try {
    const data = await reportsService.getOrderCountsByMonth();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCancelledOrders = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const data = await reportsService.getCancelledOrders(year, month);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSalesmanRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportsService.getSalesmanRevenueReport(startDate, endDate);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSalespersonIncentiveReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportsService.getSalespersonIncentiveReport(startDate, endDate);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getDispatchReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportsService.getDispatchReport(startDate, endDate);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

