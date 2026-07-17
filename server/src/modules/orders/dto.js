// DTOs for Orders module

export class OrderDTO {
  constructor(order) {
    this.orderId = order.orderId || order.order_id;
    this.orderUuid = order.orderUuid || order.order_uuid;
    this.customerId = order.customerId || order.customer_id;
    this.salespersonId = order.salespersonId || order.salesperson_id;
    this.orderNumber = order.orderNumber || order.order_number;
    this.orderDate = order.orderDate || order.order_date;
    this.deliveryAddress = order.deliveryAddress || order.delivery_address;
    this.remarks = order.remarks || order.notes;
    this.status = order.status;
    this.priority = order.priorityLevel || order.priority_level;
    this.totalAmount = order.totalAmount || order.total_amount;
    // Accountant-managed fields
    this.billNo = order.billNo || order.bill_no;
    this.paymentCleared = order.paymentCleared || order.payment_cleared || false;
    this.paymentDate = order.paymentDate || order.payment_date;
    this.expectedDeliveryTime = order.expectedDeliveryTime || order.expected_delivery_time;
    this.expectedDeliveryDate = order.expectedDeliveryDate || order.expected_delivery_date;
    this.dispatchDate = order.dispatchDate || order.dispatch_date || null;
    this.createdAt = order.createdAt || order.created_at;
    this.updatedAt = order.updatedAt || order.updated_at;

    // Additional fields for dashboard
    this.customerName = order.contactPerson;
    this.companyName = order.companyName;
    this.salespersonName = order.salespersonName;
    this.productNames = order.productNames;
    this.totalQuantity = order.totalQuantity;
  }
}

export class OrderDetailDTO {
  constructor(detail) {
    this.orderDetailId = detail.orderDetailId || detail.order_detail_id;
    this.orderId = detail.orderId || detail.order_id;
    this.productId = detail.productId || detail.product_id;
    this.quantity = detail.quantity;
    this.unitPrice = detail.unitPrice || detail.unit_price;
    this.discount = detail.discount || 0;
    this.totalPrice = detail.totalPrice || detail.total_price;
    this.createdAt = detail.createdAt || detail.created_at;
    this.updatedAt = detail.updatedAt || detail.updated_at;
    this.productName = detail.productName;
    this.hsnCode = detail.hsnCode;
  }
}

export class OrderWithDetailsDTO extends OrderDTO {
  constructor(order, details = []) {
    super(order);
    this.orderDetails = details.map(d => new OrderDetailDTO(d));
  }
}
