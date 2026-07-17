export class AdminAccountOrderDTO {
  constructor(order, customer, salesPerson, account) {
    this.orderId = order.orderId;
    this.orderNumber = order.orderNumber;
    this.orderUuid = order.orderUuid;
    this.customerName = customer?.companyName || 'Unknown';
    this.location = customer?.location || customer?.address || 'Unknown';
    this.area = customer?.area || '';
    this.salesPersonName = salesPerson
      ? `${salesPerson.firstName} ${salesPerson.lastName}`
      : 'Unknown';
    this.salespersonRemark = order.notes || '';
    this.priorityLevel = order.priorityLevel || 'Normal';
    this.orderCreatedDate = order.createdAt;
    this.timeSpan = order.createdAt; // Will format in client or here. Sending raw date is better.

    // Payment/Account information from accounts table
    this.billNo = account?.billNo || '';
    this.paymentCleared = account?.paymentCleared || false;
    this.paymentStatus = account?.paymentStatus || 'Pending';
    this.adminRemarks = account?.remarks || '';

    // Order status information
    this.onHold = order.status === 'On Hold';
    this.status = order.status;
    this.totalAmount = order.totalAmount;
  }
}
