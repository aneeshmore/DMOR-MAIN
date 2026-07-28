// Orders Feature Types

export interface Order {
  orderId: number;
  orderUuid?: string;
  orderNumber?: string;
  customerId: number;
  salespersonId?: number;
  salespersonName?: string;
  orderDate: string;
  deliveryAddress?: string;
  remarks?: string;
  status:
  // New workflow statuses
  | 'Pending Accounts Approval'
  | 'Pending Factory Approval'
  | 'Factory Approved'
  | 'Scheduled for Production'
  | 'Ready for Dispatch'
  | 'Dispatched'
  | 'On Hold'
  // Legacy statuses (existing orders)
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Confirmed'
  | 'In Production'
  | 'Started'
  | 'Delivered'
  | 'Verified'
  | 'Cancelled'
  // Terminal status for a parent order superseded by two split child orders.
  | 'Split';
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  totalAmount: number;
  expectedDeliveryDate?: string; // Production manager field
  dispatchDate?: string; // Actual dispatch date from the Dispatch module
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  companyName?: string;
  productNames?: string;
  totalQuantity?: number;
  billNo?: string; // Added for split order and account management
  paymentMethod?: string; // Added for Invoice generation
}

export interface OrderDetail {
  orderDetailId: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  productName?: string;
  hsnCode?: string;
}

export interface OrderWithDetails extends Order {
  orderDetails: OrderDetail[];
}

export interface CreateOrderInput {
  customerId: number;
  salespersonId: number;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  status?: 'Pending Accounts Approval' | 'Pending' | 'On Hold' | 'Confirmed';
  orderDate?: string;
  deliveryAddress?: string;
  remarks?: string;
  orderDetails: {
    productId: number;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }[];
}

export interface UpdateOrderInput {
  customerId?: number;
  salespersonId?: number;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  status?: Order['status'];
  deliveryAddress?: string;
  remarks?: string;
}
