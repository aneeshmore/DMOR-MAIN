import React, { useMemo, useState } from 'react';
import { useNotifications, useMarkAsRead } from '../hooks';
import {
  Bell,
  Info,
  AlertTriangle,
  FileText,
  Truck,
  ChevronDown,
  ChevronUp,
  Eye,
  Check,
  X,
  PauseCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import {
  adminAccountsApi,
  AdminOrderDetails,
} from '@/features/admin-accounts/api/adminAccountsApi';
import { showToast } from '@/utils/toast';
import { decodeHtml } from '@/utils/stringUtils';

interface DashboardNotificationsProps {
  types?: string[]; // Filter by type: 'NewOrder', 'OrderUpdate', 'Dispatch', etc.
  priority?: string; // Filter by priority: 'critical', 'high'
  title?: string;
  orderStatuses?: string[]; // Filter OrderUpdate by status: 'On Hold', 'Accepted', etc.
  typeLabels?: Record<string, string>; // Custom labels for types
}

// Type display configuration
const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  NewOrder: {
    label: 'New Orders',
    icon: <FileText className="w-5 h-5" />,
    color: 'bg-blue-50 border-blue-200 text-blue-900',
  },
  OrderUpdate: {
    label: 'Orders On Hold',
    icon: <PauseCircle className="w-5 h-5" />,
    color: 'bg-orange-50 border-orange-200 text-orange-900',
  },
  Dispatch: {
    label: 'Dispatches',
    icon: <Truck className="w-5 h-5" />,
    color: 'bg-green-50 border-green-200 text-green-900',
  },
  Delivery: {
    label: 'Deliveries',
    icon: <Truck className="w-5 h-5" />,
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  },
  MaterialShortage: {
    label: 'Material Shortages',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'bg-red-50 border-red-200 text-red-900',
  },
  ProductionComplete: {
    label: 'Production Completed',
    icon: <Info className="w-5 h-5" />,
    color: 'bg-purple-50 border-purple-200 text-purple-900',
  },
};

interface NotificationItem {
  notificationId: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    orderId?: number;
    orderNumber?: string;
    dispatchId?: number;
    status?: string;
  };
}

interface GroupedNotification {
  count: number;
  ids: number[];
  items: NotificationItem[];
  latestMessage: string;
  hasCritical: boolean;
}

export const DashboardNotifications: React.FC<DashboardNotificationsProps> = ({
  types,
  priority,
  title = 'Recent Alerts',
  orderStatuses = ['On Hold'], // Default to On Hold for backward compatibility
  typeLabels = {}, // Custom labels
}) => {
  const { data: notifications = [] } = useNotifications();
  const markAsRead = useMarkAsRead();

  // State for expanded groups
  const [expandedType, setExpandedType] = useState<string | null>(null);

  // State for order details modal
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrderDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Filter and group notifications by type
  const groupedNotifications = useMemo(() => {
    const filtered = (notifications as NotificationItem[]).filter(n => {
      if (n.isRead) return false;
      if (priority && n.priority !== priority) return false;
      if (types && types.length > 0 && !types.includes(n.type)) return false;
      // For OrderUpdate, filter by specified statuses
      if (n.type === 'OrderUpdate' && (!n.data?.status || !orderStatuses.includes(n.data.status)))
        return false;
      return true;
    });

    // Group by type
    const groups: Record<string, GroupedNotification> = {};

    filtered.forEach(n => {
      if (!groups[n.type]) {
        groups[n.type] = {
          count: 0,
          ids: [],
          items: [],
          latestMessage: n.message,
          hasCritical: false,
        };
      }
      groups[n.type].count += 1;
      groups[n.type].ids.push(n.notificationId);
      groups[n.type].items.push(n);
      if (n.priority === 'critical' || n.priority === 'high') {
        groups[n.type].hasCritical = true;
      }
    });

    return groups;
  }, [notifications, types, priority]);

  const groupKeys = Object.keys(groupedNotifications);

  if (groupKeys.length === 0) return null;

  const handleToggleExpand = (type: string) => {
    setExpandedType(prev => (prev === type ? null : type));
  };

  const handleMarkAsRead = (notificationId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    markAsRead.mutate(notificationId);
  };

  const handleMarkAllAsRead = (type: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const ids = groupedNotifications[type]?.ids || [];
    ids.forEach(id => markAsRead.mutate(id));
  };

  const handleViewOrderDetails = async (orderId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsLoadingDetails(true);
    setIsDetailsOpen(true);
    setSelectedOrderDetails(null);
    try {
      const data = await adminAccountsApi.getOrderDetails(orderId);
      setSelectedOrderDetails(data);
    } catch {
      showToast.error('Failed to load order details');
      setIsDetailsOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <>
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] mb-2 px-1">
          <Bell className="w-4 h-4" />
          {title}
        </div>

        <div className="space-y-3">
          {groupKeys.map(type => {
            const config = typeConfig[type] || {
              label: type,
              icon: <Info className="w-5 h-5" />,
              color: 'bg-gray-50 border-gray-200 text-gray-900',
            };
            // Use custom label if provided
            const displayLabel = typeLabels[type] || config.label;
            const group = groupedNotifications[type];
            const isExpanded = expandedType === type;

            return (
              <div key={type} className="rounded-lg border shadow-sm overflow-hidden">
                {/* Group Header */}
                <div
                  className={cn(
                    'flex items-center gap-3 p-4 cursor-pointer transition-all hover:opacity-90',
                    config.color
                  )}
                  onClick={() => handleToggleExpand(type)}
                >
                  <div className="flex-shrink-0">{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{group.count}</span>
                      <span className="font-semibold text-sm">{displayLabel}</span>
                    </div>
                    <p className="text-xs opacity-75 mt-0.5 line-clamp-1">{decodeHtml(group.latestMessage)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs bg-white/50 hover:bg-white/80 text-current"
                      onClick={e => handleMarkAllAsRead(type, e)}
                    >
                      Clear All
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {/* Expanded Items List */}
                {isExpanded && (
                  <div className="bg-white border-t divide-y divide-gray-100">
                    {group.items.map(item => (
                      <div
                        key={item.notificationId}
                        className="p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm text-gray-900">{decodeHtml(item.title)}</h4>
                              {item.priority === 'critical' && (
                                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                                  Critical
                                </span>
                              )}
                              {item.priority === 'high' && (
                                <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                  High
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {decodeHtml(item.message)}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>{formatDate(item.createdAt)}</span>
                              {item.data?.orderNumber && (
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                  {item.data.orderNumber}
                                </span>
                              )}
                              {item.data?.status && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                                  {item.data.status}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {item.data?.orderId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={e => handleViewOrderDetails(item.data!.orderId!, e)}
                              >
                                <Eye size={14} className="mr-1" />
                                View
                              </Button>
                            )}
                            <button
                              onClick={e => handleMarkAsRead(item.notificationId, e)}
                              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                              title="Mark as read"
                            >
                              <Check size={14} className="text-green-600" />
                            </button>
                            <button
                              onClick={e => handleMarkAsRead(item.notificationId, e)}
                              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                              title="Dismiss"
                            >
                              <X size={14} className="text-gray-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={`Order Details: ${selectedOrderDetails?.orderNumber || selectedOrderDetails?.orderId || 'Loading...'}`}
        size="lg"
      >
        {isLoadingDetails || !selectedOrderDetails ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Banner */}
            <div
              className={cn(
                'px-4 py-2 rounded-lg flex justify-between items-center text-sm font-medium',
                selectedOrderDetails.status === 'Factory Approved' ||
                  selectedOrderDetails.status === 'Accepted'
                  ? 'bg-green-100 text-green-700'
                  : selectedOrderDetails.status === 'On Hold'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700'
              )}
            >
              <span>Status: {selectedOrderDetails.status}</span>
              <span>Payment: {selectedOrderDetails.paymentCleared ? 'Cleared' : 'Pending'}</span>
            </div>

            {/* Order Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 border-b pb-1">Customer Info</h4>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-gray-500">Company:</span>
                  <span className="font-medium text-gray-900">
                    {decodeHtml(selectedOrderDetails.customerName)}
                  </span>

                  <span className="text-gray-500">Address:</span>
                  <span className="text-gray-900 whitespace-pre-wrap">
                    {decodeHtml(selectedOrderDetails.address || selectedOrderDetails.location)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 border-b pb-1">Order Info</h4>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-gray-500">Order Date:</span>
                  <span className="font-medium text-gray-900">
                    {selectedOrderDetails.orderCreatedDate
                      ? formatDate(selectedOrderDetails.orderCreatedDate)
                      : 'N/A'}
                  </span>

                  <span className="text-gray-500">Salesperson:</span>
                  <span className="text-gray-900">
                    {selectedOrderDetails.salesPersonName || 'N/A'}
                  </span>

                  <span className="text-gray-500">Bill No:</span>
                  <span className="text-gray-900 font-mono">
                    {selectedOrderDetails.billNo || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks Section */}
            {selectedOrderDetails.adminRemarks && (
              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100 text-sm">
                <span className="font-semibold text-yellow-800">Remarks: </span>
                <span className="text-yellow-900">{decodeHtml(selectedOrderDetails.adminRemarks)}</span>
              </div>
            )}

            {/* Items Table */}
            <div>
              <h4 className="font-semibold mb-2 text-gray-900">Order Items</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left font-medium text-gray-500">Product</th>
                      <th className="p-2 text-center font-medium text-gray-500">Size</th>
                      <th className="p-2 text-center font-medium text-gray-500">Qty</th>
                      <th className="p-2 text-right font-medium text-gray-500">Unit Price</th>
                      <th className="p-2 text-right font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedOrderDetails.items?.map((item, idx) => (
                      <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
                        <td className="p-2 font-medium text-gray-900">{decodeHtml(item.productName)}</td>
                        <td className="p-2 text-center text-gray-600">{item.size}</td>
                        <td className="p-2 text-center text-gray-900 font-medium">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-2 text-right text-gray-600">₹{item.unitPrice}</td>
                        <td className="p-2 text-right font-medium text-gray-900">
                          ₹{item.totalPrice}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={4} className="p-2 text-right text-gray-900">
                        Grand Total:
                      </td>
                      <td className="p-2 text-right text-gray-900">
                        ₹{selectedOrderDetails.totalAmount?.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
