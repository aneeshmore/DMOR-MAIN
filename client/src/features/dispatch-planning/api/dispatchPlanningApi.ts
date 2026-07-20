import apiClient from '@/api/client';

export interface DispatchOrderItem {
  orderId: number;
  orderNumber: string;
  companyName: string;
  location: string;
  productName: string; // Aggregated string
  availableQty: number;
  qty: number;
  dispatchDate: string;
  orderDate: string;
  billNo: string;
  weightInTons: number;
  items?: {
    productName: string;
    quantity: number;
    availableQty: number;
    packageCapacityKg: number;
  }[];
}

export interface CreateDispatchPayload {
  vehicleNo: string;
  vehicleModel?: string;
  capacity?: number;
  driverName?: string;
  remarks?: string;
  orderIds: number[];
}

export const dispatchPlanningApi = {
  getDispatchQueue: async (): Promise<DispatchOrderItem[]> => {
    const { data } = await apiClient.get('/dispatch-planning/queue');
    return data.data;
  },

  getReturnedQueue: async (): Promise<DispatchOrderItem[]> => {
    const { data } = await apiClient.get('/dispatch-planning/returned-queue');
    return data.data;
  },

  createDispatch: async (payload: CreateDispatchPayload) => {
    const { data } = await apiClient.post('/dispatch-planning/create', payload);
    return data;
  },

  getVehicles: async () => {
    const { data } = await apiClient.get('/dispatch-planning/vehicles');
    return data.data;
  },

  addVehicle: async (payload: {
    vehicleNumber: string;
    vehicleModel?: string;
    driverName?: string;
    capacity?: number;
  }) => {
    const { data } = await apiClient.post('/dispatch-planning/vehicles', payload);
    return data.data;
  },

  requeueOrder: async (orderId: number) => {
    const { data } = await apiClient.patch(`/dispatch-planning/${orderId}/requeue`);
    return data;
  },

  getDispatchDetails: async (dispatchId: number) => {
    const { data } = await apiClient.get(`/dispatch-planning/${dispatchId}/details`);
    return data.data;
  },
};
