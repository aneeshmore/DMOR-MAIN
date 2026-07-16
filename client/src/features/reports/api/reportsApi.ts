import apiClient from '@/api/client';
import {
  BatchProductionReportItem,
  DailyConsumptionReportItem,
  MaterialInwardReportItem,
  StockReportItem,
  ProductWiseReportItem,
  ProductInfo,
  BOMItem,
} from '../types';

export const reportsApi = {
  getBatchProductionReport: async (
    status?: string,
    startDate?: string,
    endDate?: string
  ): Promise<BatchProductionReportItem[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = queryString
      ? `/reports/batch-production?${queryString}`
      : '/reports/batch-production';
    const response = await apiClient.get(url);
    return response.data.data;
  },

  getDailyConsumptionReport: async (date: string): Promise<DailyConsumptionReportItem[]> => {
    const response = await apiClient.get(`/reports/daily-consumption?date=${date}`);
    return response.data.data;
  },

  getMaterialInwardReport: async (
    type?: 'FG' | 'RM' | 'PM',
    startDate?: string,
    endDate?: string
  ): Promise<MaterialInwardReportItem[]> => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = queryString
      ? `/reports/material-inward?${queryString}`
      : '/reports/material-inward';
    const response = await apiClient.get(url);
    return response.data.data;
  },

  getStockReport: async (
    type?: 'FG' | 'RM' | 'PM' | 'Sub-Product',
    productId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<StockReportItem[]> => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (productId) params.append('productId', productId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = queryString ? `/reports/stock?${queryString}` : '/reports/stock';
    const response = await apiClient.get(url);
    return response.data.data;
  },

  getProductWiseReport: async (
    productId?: string,
    startDate?: string,
    endDate?: string,
    productType?: string
  ): Promise<{ product: ProductInfo; transactions: ProductWiseReportItem[]; bom: BOMItem[] }> => {
    const params = new URLSearchParams();
    if (productId) params.append('productId', productId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (productType) params.append('productType', productType);

    const queryString = params.toString();
    const url = `/reports/product-wise?${queryString}`;
    const response = await apiClient.get(url);
    return response.data.data;
  },

  getProductsList: async (type?: 'FG' | 'RM' | 'PM' | 'All'): Promise<any[]> => {
    let url = '/catalog/products';

    // If type is provided (even 'All'), use the type endpoint to get combined/specific lists
    if (type) {
      url = `/catalog/products/type/${type}`;
    }

    const response = await apiClient.get(url);
    return response.data.data || response.data;
  },

  getCancelledOrders: async (year?: string, month?: string) => {
    const response = await apiClient.get('/reports/cancelled-orders', {
      params: { year, month, _t: Date.now() },
    });
    return response.data.data;
  },

  getOrderCountsByMonth: async () => {
    const response = await apiClient.get('/reports/order-counts-by-month', {
      params: { _t: Date.now() },
    });
    return response.data.data;
  },

  getProfitLossData: async (startDate?: string, endDate?: string) => {
    const response = await apiClient.get('/reports/profit-loss', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  getCustomersForContactReport: async (limit: number = 1000, offset: number = 0) => {
    const response = await apiClient.get('/masters/customers', {
      params: { limit, offset },
    });
    return (
      response.data.data?.map((customer: any) => {
        const customerId = customer.CustomerID ?? customer.customerId ?? customer.customer_id;
        const companyName =
          customer.CompanyName ?? customer.companyName ?? customer.company_name ?? '';
        const location = customer.Location ?? customer.location ?? customer.city ?? '';
        const customerName =
          customer.ContactPerson ?? customer.contactPerson ?? customer.contact_person ?? '';
        const mobile1 = customer.MobileNo ?? customer.mobileNo ?? customer.mobile_no ?? '';
        const mobile2 = customer.mobile2 ?? customer.mobile_2 ?? '';
        return {
          customerId,
          companyName,
          location,
          customerName,
          mobile1,
          mobile2,
          dateOfBirth: customer.DateOfBirth || '',
          gstNo: customer.GSTNumber || '',
          salesPerson: customer.salespersonName || 'Unassigned',
          salesPersonId:
            customer.SalesPersonID ?? customer.salesPersonId ?? customer.sales_person_id,
          isActive: customer.isActive ?? true,
        };
      }) || []
    );
  },

  getSalespersons: async () => {
    const response = await apiClient.get('/employees/sales-persons');
    return (
      response.data.data?.map((emp: any) => ({
        id: emp.EmployeeID || emp.employeeId,
        name: `${emp.FirstName || emp.firstName || ''} ${emp.LastName || emp.lastName || ''}`.trim(),
        designation: emp.Role || emp.role || '',
      })) || []
    );
  },

  getAllOrders: async () => {
    const response = await apiClient.get('/orders', {
      params: { limit: 10000, _t: Date.now() },
    });
    return response.data.data;
  },

  getSalesmanRevenueReport: async (startDate?: string, endDate?: string) => {
    const response = await apiClient.get('/reports/salesman-revenue', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  getSalespersonIncentiveReport: async (startDate?: string, endDate?: string) => {
    const response = await apiClient.get('/reports/salesperson-incentives', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  getDispatchReport: async (startDate?: string, endDate?: string) => {
    const response = await apiClient.get('/reports/dispatch', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },
};
