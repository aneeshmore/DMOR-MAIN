import { DispatchPlanningRepository } from './repository.js';
import { NotificationsService } from '../notifications/service.js';
import { DispatchOrderDTO } from './dto.js';
import { AppError } from '../../utils/AppError.js';

export class DispatchPlanningService {
  constructor() {
    this.repository = new DispatchPlanningRepository();
    this.notificationsService = new NotificationsService();
  }

  async getDispatchQueue() {
    const results = await this.repository.findReadyForDispatch();
    return results.map(group => new DispatchOrderDTO(group.order, group.customer, group.items));
  }

  async getReturnedQueue() {
    const results = await this.repository.findReturnedOrders();
    return results.map(group => new DispatchOrderDTO(group.order, group.customer, group.items));
  }

  async getVehicles() {
    const vehicles = await this.repository.getVehicles();
    return vehicles.map(v => ({
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      vehicleModel: v.vehicleModel || '',
      driverName: v.driverName || '',
      capacity: v.capacity ? parseFloat(v.capacity) : 0,
      isAvailable: v.isAvailable,
    }));
  }

  async addVehicle(payload) {
    // Reuses the same insertion path as dispatch creation (ensureVehicleExists):
    // duplicate-safe and whitespace-trimmed
    const vehicle = await this.repository.ensureVehicleExists({
      vehicleNumber: payload.vehicleNumber,
      vehicleModel: payload.vehicleModel,
      driverName: payload.driverName,
      capacity: payload.capacity,
    });

    if (!vehicle) {
      throw new AppError('A valid vehicle number is required', 400);
    }

    // Same shape as getVehicles() items so the frontend can use it directly
    return {
      id: vehicle.vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleModel: vehicle.vehicleModel || '',
      driverName: vehicle.driverName || '',
      capacity: vehicle.capacity ? parseFloat(vehicle.capacity) : 0,
      isAvailable: vehicle.isAvailable,
    };
  }

  async createDispatch(payload) {
    // payload: { vehicleNo, vehicleModel, capacity, remarks, orderIds: [], driverName }

    const { vehicleNo, vehicleModel, remarks, orderIds, driverName, performedBy } = payload;

    // 1. Fetch Order Details to know what inventory to deduct
    const details = await this.repository.getOrderDetails(orderIds);

    // 2. Deduct Inventory
    // We process each line item.
    // Note: If multiple orders have the same product, we deduct sequentially.
    for (const item of details) {
      await this.repository.deductDispatchedInventory(
        item.orderDetail.productId,
        item.orderDetail.quantity,
        item.orderDetail.orderId,
        performedBy || 1 // Default system user if not provided
      );
    }

    // 3. Ensure vehicle exists in master (persists capacity for dispatch reporting)
    const { capacity } = payload;
    await this.repository.ensureVehicleExists({
      vehicleNumber: vehicleNo,
      vehicleModel,
      driverName,
      capacity,
    });

    // 4. Create Dispatch Record
    const dispatchRecord = await this.repository.createDispatchRecord({
      vehicleNo,
      driverName,
      remarks,
      status: 'In Transit',
      createdBy: performedBy,
    });

    const dispatchInfo = `Dispatched via ${vehicleNo} (${vehicleModel}). Driver: ${driverName || 'N/A'}. Rem: ${remarks}`;

    const updatedOrders = [];
    for (const orderId of orderIds) {
      const result = await this.repository.updateStatus(
        orderId,
        'Dispatched',
        dispatchInfo,
        dispatchRecord.dispatchId
      );
      updatedOrders.push(result);
    }

    // Send Notification
    try {
      await this.notificationsService.createDispatchNotification(
        dispatchRecord.dispatchId,
        vehicleNo,
        orderIds,
        driverName
      );

      // Clean up previous stage notifications for these orders
      for (const orderId of orderIds) {
        await this.notificationsService.clearNotificationsForOrder(orderId, [
          'OrderUpdate',
          'ProductionComplete',
        ]);
      }
    } catch (err) {
      console.error('Failed to send dispatch notification:', err);
    }

    return { success: true, count: updatedOrders.length, dispatchId: dispatchRecord.dispatchId };
  }

  async requeueOrder(orderId) {
    return await this.repository.updateStatusToReady(orderId);
  }

  async markAsDelivered(dispatchId, remarks) {
    const existing = await this.repository.findDispatchById(dispatchId);
    if (!existing) {
      throw new Error('Dispatch record not found'); // Should use AppError but assuming not imported or simple Error is caught by controller
    }

    const updated = await this.repository.updateDispatchStatus(dispatchId, 'Delivered', remarks);
    const linkedOrderIds = await this.repository.getLinkedOrderIds(dispatchId);

    // Send Notification
    try {
      await this.notificationsService.createDeliveryNotification(
        dispatchId,
        existing.vehicleNo,
        linkedOrderIds,
        remarks
      );
    } catch (err) {
      console.error('Failed to send delivery notification:', err);
    }

    return { success: true, dispatch: updated };
  }
  async getDispatchDetails(dispatchId) {
    return await this.repository.getDispatchDetails(dispatchId);
  }
}
