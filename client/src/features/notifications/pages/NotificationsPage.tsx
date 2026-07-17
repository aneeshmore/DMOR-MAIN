import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  FileText,
  Truck,
  Eye,
  Search,
  Clock,
  CheckSquare,
} from 'lucide-react';
import { useNotifications, useAllNotifications, useMarkAsRead } from '../hooks';
import { cn } from '@/utils/cn';
import { showToast } from '@/utils/toast'; // Or path to stringUtils if already imported but we need to add it.
import { decodeHtml } from '@/utils/stringUtils';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import {
  adminAccountsApi,
  AdminOrderDetails,
} from '@/features/admin-accounts/api/adminAccountsApi';
import { ordersApi } from '@/features/orders/api/ordersApi';
import { dispatchPlanningApi } from '@/features/dispatch-planning/api/dispatchPlanningApi';

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'critical':
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    case 'high':
      return <AlertCircle className="w-5 h-5 text-orange-500" />;
    case 'normal':
    default:
      return <Info className="w-5 h-5 text-blue-500" />;
  }
};

const getPriorityClass = (priority: string) => {
  switch (priority) {
    case 'critical':
      return 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-900/10';
    case 'high':
      return 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-900/10';
    case 'normal':
    default:
      return 'border-l-4 border-l-blue-500 bg-white dark:bg-[var(--surface)]';
  }
};

const NotificationsPage = () => {
  const [activeTab, setActiveTab] = useState<
    'pending' | 'accepted' | 'dispatch' | 'low-stock' | 'all'
  >('pending');
  const [viewSystemWide, setViewSystemWide] = useState(true);
  const [orderStats, setOrderStats] = useState<{ status: string; count: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Modal State
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrderDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Dispatch Modal State
  const [selectedDispatch, setSelectedDispatch] = useState<any | null>(null);
  const [isDispatchDetailsOpen, setIsDispatchDetailsOpen] = useState(false);

  // Shortage Modal State
  const [shortageDetails, setShortageDetails] = useState<{
    materialName: string;
    orders: AdminOrderDetails[];
  } | null>(null);
  const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
  const [isLoadingShortage, setIsLoadingShortage] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // Fetch stats (Mock or API) - Using API
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await ordersApi.getStats();
        setOrderStats(data);
      } catch (e) {
        console.error('Failed to fetch stats', e);
      }
    };
    fetchStats();
  }, []);

  // Fetch notifications
  const {
    data: myNotifications = [],
    isLoading: loadingMy,
    refetch: refetchMy,
  } = useNotifications({ limit: 50 });

  const {
    data: allNotifications = [],
    isLoading: loadingAll,
    refetch: refetchAll,
  } = useAllNotifications(viewSystemWide);

  const notifications = viewSystemWide ? allNotifications : myNotifications;
  const isLoading = viewSystemWide ? loadingAll : loadingMy;
  const refetch = viewSystemWide ? refetchAll : refetchMy;

  const markAsRead = useMarkAsRead();

  const handleMarkAsRead = (id: number) => {
    markAsRead.mutate(id, { onSuccess: () => refetch() });
  };

  // Grouping Logic
  const groupedNotifications = useMemo(() => {
    const grouped: any[] = [];
    const shortageMap = new Map<string, any>(); // key: materialName
    const dispatchMap = new Map<number, any>(); // key: dispatchId

    notifications.forEach((n: any) => {
      // Logic for Material Shortage Grouping
      if (n.type === 'MaterialShortage' || n.data?.shortages) {
        const shortages = n.data?.shortages || [];
        shortages.forEach((s: any) => {
          if (shortageMap.has(s.materialName)) {
            const existing = shortageMap.get(s.materialName);
            existing.totalRequired += s.requiredQty;
            existing.ids.push(n.notificationId);

            // Add order detail if not present
            const orderId = n.data.orderId;
            if (!existing.orderMap.has(orderId)) {
              existing.orderMap.set(orderId, {
                orderId,
                orderNumber: n.data.orderNumber || `#${orderId}`,
                customerName: n.data.customerName,
                requiredQty: s.requiredQty,
              });
            }
          } else {
            const orderMap = new Map();
            orderMap.set(n.data.orderId, {
              orderId: n.data.orderId,
              orderNumber: n.data.orderNumber || `#${n.data.orderId}`,
              requiredQty: s.requiredQty,
            });

            shortageMap.set(s.materialName, {
              isGroup: true,
              type: 'MaterialShortageGroup',
              title: `Shortage: ${s.materialName}`,
              materialName: s.materialName,
              totalRequired: s.requiredQty,
              unit: s.unit,
              orderMap,
              ids: [n.notificationId],
              priority: 'critical',
              createdAt: n.createdAt,
            });
          }
        });
      }
      // Logic for Dispatch/Delivery Grouping
      else if ((n.type === 'Dispatch' || n.type === 'Delivery') && n.data?.dispatchId) {
        const dId = n.data.dispatchId;
        if (dispatchMap.has(dId)) {
          const existing = dispatchMap.get(dId);
          existing.ids.push(n.notificationId);
          // Update to latest status/message
          if (new Date(n.createdAt) > new Date(existing.createdAt)) {
            existing.createdAt = n.createdAt;
            existing.type = n.type;
            existing.title = n.title;
            existing.message = n.message;
            existing.data = n.data;
            existing.priority = n.priority;
            existing.isRead = existing.isRead && n.isRead; // Group is read only if all/latest is read? Or simple logic.
          }
        } else {
          dispatchMap.set(dId, {
            ...n,
            ids: [n.notificationId],
          });
        }
      } else {
        grouped.push(n);
      }
    });

    shortageMap.forEach(val => {
      const orderCount = val.orderMap.size;
      val.affectedOrders = Array.from(val.orderMap.values());
      val.message = `Shortage affecting ${orderCount} Order(s). Total Required: ${val.totalRequired} ${val.unit}`;
      val.notificationId = val.ids[0];
      grouped.push(val);
    });

    dispatchMap.forEach(val => {
      grouped.push(val);
    });

    return grouped.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, viewSystemWide]);

  const stats = useMemo(() => {
    const pending = groupedNotifications.filter(n => {
      const type = n.type;
      const status = n.data?.status;
      if (type === 'NewOrder') return true;
      if (
        type === 'OrderUpdate' &&
        ['On Hold', 'Pending', 'Pending Accounts Approval', 'Pending Factory Approval'].includes(
          status
        )
      )
        return true;
      return false;
    }).length;

    const accepted = groupedNotifications.filter(n => {
      const type = n.type;
      const status = n.data?.status;
      if (type === 'ProductionComplete') return true;
      if (
        type === 'OrderUpdate' &&
        ['Factory Approved', 'Accepted', 'Production Started'].includes(status)
      )
        return true;
      return false;
    }).length;

    // Low Stock based on active notifications
    const lowStock = groupedNotifications.filter(
      (n: any) => n.type === 'MaterialShortage' || n.type === 'MaterialShortageGroup'
    ).length;

    const dispatch = groupedNotifications.filter(
      n => n.type === 'Dispatch' || n.type === 'Delivery'
    ).length;

    return { pending, accepted, dispatch, lowStock };
  }, [groupedNotifications]);

  // Category Filtering
  const filteredNotifications = useMemo(() => {
    let list = groupedNotifications;

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => {
        if (n.title?.toLowerCase().includes(q)) return true;
        if (n.message?.toLowerCase().includes(q)) return true;
        if (n.data?.orderNumber?.toLowerCase().includes(q)) return true;
        if (n.data?.status?.toLowerCase().includes(q)) return true;
        if (n.data?.customerName?.toLowerCase().includes(q)) return true;
        if (n.isGroup && n.materialName?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    if (activeTab === 'all') return list;

    return list.filter(n => {
      const type = n.type;
      const status = n.data?.status;

      if (activeTab === 'pending') {
        if (type === 'NewOrder') return true;
        if (
          type === 'OrderUpdate' &&
          ['On Hold', 'Pending', 'Pending Accounts Approval', 'Pending Factory Approval'].includes(
            status
          )
        )
          return true;
        return false;
      }
      if (activeTab === 'accepted') {
        if (type === 'ProductionComplete') return true;
        if (
          type === 'OrderUpdate' &&
          ['Factory Approved', 'Accepted', 'Production Started'].includes(status)
        )
          return true;
        return false;
      }
      if (activeTab === 'low-stock') {
        return type === 'MaterialShortage' || type === 'MaterialShortageGroup';
      }
      if (activeTab === 'dispatch') {
        return type === 'Dispatch' || type === 'Delivery';
      }
      return false;
    });
  }, [groupedNotifications, activeTab]);

  const handleViewOrder = async (orderId: number) => {
    setIsLoadingDetails(true);
    setIsDetailsOpen(true);
    setSelectedOrderDetails(null);
    try {
      const data = await adminAccountsApi.getOrderDetails(orderId);
      setSelectedOrderDetails(data);
    } catch {
      showToast.error('Failed to load details');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleViewDispatch = async (dispatchId: number) => {
    setIsDispatchDetailsOpen(true);
    setSelectedDispatch(null);
    try {
      const data = await dispatchPlanningApi.getDispatchDetails(dispatchId);
      setSelectedDispatch(data);
    } catch {
      showToast.error('Failed to load dispatch details');
      setIsDispatchDetailsOpen(false);
    }
  };

  const handleViewShortageDetails = async (group: any) => {
    setIsShortageModalOpen(true);
    setIsLoadingShortage(true);
    setShortageDetails({ materialName: group.materialName, orders: [] });

    try {
      const orderIds = Array.from(group.orderMap.keys()) as number[];
      const ordersData = await Promise.all(
        orderIds.map(id => adminAccountsApi.getOrderDetails(id))
      );
      setShortageDetails({
        materialName: group.materialName,
        orders: ordersData,
      });
    } catch (e) {
      showToast.error('Failed to fetch order details');
    } finally {
      setIsLoadingShortage(false);
    }
  };

  // --- Redirection Logic ---
  const getNotificationAction = (n: any) => {
    const type = n.type;
    const data = n.data || {};

    // 1. Dynamic Dynamic Link (Backend provided)
    if (data.link) {
      return {
        label: 'View',
        action: () => navigate(data.link),
        icon: <FileText size={12} className="mr-1" />,
      };
    }

    // 2. Fallback Logic (For older notifications)
    switch (type) {
      case 'NewOrder':
      case 'OrderUpdate':
      case 'ProductionComplete':
        if (data.orderId) {
          // Flexible Redirection: Can go to Details Page OR Create Order Page (for editing)
          // Defaulting to Order Details as it's safer.
          // User asked for "create order page".
          // If we want to edit, we might go to /operations/create-order?edit=ID
          // But standard flow is Details.

          return {
            label: 'View Order',
            action: () => navigate(`/orders/${data.orderId}`), // Changed from Modal to Page
            icon: <FileText size={12} className="mr-1" />,
          };
        }
        break;

      case 'Dispatch':
      case 'Delivery':
        if (data.dispatchId) {
          // Can go to specific dispatch page if exists, or fallback to planning
          return {
            label: 'View Dispatch',
            action: () => navigate('/operations/dispatch-planning'), // Or specific ID if route exists
            icon: <Truck size={12} className="mr-1" />,
          };
        }
        break;

      case 'MaterialShortage':
      case 'MaterialShortageGroup':
        return {
          label: 'Resolve Shortage',
          action: () => navigate('/operations/pm-inward'),
          icon: <AlertTriangle size={12} className="mr-1" />,
        };

      default:
        return null;
    }
    return null;
  };

  // Rendering Helper
  const renderContent = (n: any) => {
    const action = getNotificationAction(n);

    // Group logic (keep existing specific logic for shortages if needed, else merge)
    if (n.isGroup) {
      // Material Shortage Group
      return (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-100 dark:border-red-800">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">
              Total Deficit: {n.totalRequired} {n.unit}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs bg-[var(--surface)] border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                onClick={() => handleViewShortageDetails(n)}
              >
                <Eye size={12} className="mr-1" /> Details
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs bg-[var(--surface)] border border-[var(--border)]"
                onClick={() => navigate('/operations/pm-inward')}
              >
                Resolve
              </Button>
            </div>
          </div>
          <p className="text-xs text-red-500 dark:text-red-400">
            Affecting {n.affectedOrders.length} orders.
          </p>
        </div>
      );
    }

    // Single Items
    const { data } = n;

    return (
      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          {data?.orderNumber && (
            <span className="font-mono p-1 bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded">
              Order: {data.orderNumber}
            </span>
          )}
          {data?.dispatchId && (
            <span className="font-mono p-1 bg-green-50 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">
              Dispatch #{data.dispatchId}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Quick Modal View (Existing) */}
          {data?.orderId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleViewOrder(data.orderId)}
            >
              <Eye size={12} className="mr-1" /> Quick View
            </Button>
          )}

          {/* New Redirection Action */}
          {action && (
            <Button
              size="sm"
              variant="secondary" // Distinct style logic
              className="h-7 text-xs border bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700"
              onClick={action.action}
            >
              {action.icon} {action.label}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Notification Management" description="Dashboard" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('pending')}
          className={cn(
            'p-4 rounded-lg border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
            activeTab === 'pending'
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
              : 'bg-[var(--surface)] border-[var(--border)]'
          )}
        >
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
            <Clock />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Pending Orders</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.pending}</p>
          </div>
        </div>
        <div
          onClick={() => setActiveTab('accepted')}
          className={cn(
            'p-4 rounded-lg border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
            activeTab === 'accepted'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
              : 'bg-[var(--surface)] border-[var(--border)]'
          )}
        >
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
            <CheckSquare />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Accepted/In Prod</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.accepted}</p>
          </div>
        </div>
        <div
          onClick={() => setActiveTab('dispatch')}
          className={cn(
            'p-4 rounded-lg border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
            activeTab === 'dispatch'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : 'bg-[var(--surface)] border-[var(--border)]'
          )}
        >
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
            <Truck />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Dispatched</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.dispatch}</p>
          </div>
        </div>
        <div
          onClick={() => setActiveTab('low-stock')}
          className={cn(
            'p-4 rounded-lg border shadow-sm flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
            activeTab === 'low-stock'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
              : 'bg-[var(--surface)] border-[var(--border)]'
          )}
        >
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
            <AlertTriangle />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Low Stock</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.lowStock}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] flex gap-6 text-sm font-medium text-[var(--text-secondary)]">
        {['pending', 'accepted', 'low-stock', 'dispatch', 'all'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={cn(
              'pb-3 capitalize transition-colors border-b-2',
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-[var(--text-primary)]'
            )}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center bg-[var(--surface-elevated)] p-2 rounded text-sm gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by Order #, Status, Customer..."
            className="w-full pl-9 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 placeholder:text-[var(--text-secondary)]"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 text-[var(--text-secondary)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={viewSystemWide}
              onChange={e => setViewSystemWide(e.target.checked)}
              className="rounded"
            />
            <span>Admin View (All)</span>
          </label>
          <span>Showing: {filteredNotifications.length}</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-[var(--text-secondary)]">Loading...</div>
        ) : (
          filteredNotifications.map(n => (
            <div
              key={n.notificationId}
              className={cn(
                'p-4 border border-[var(--border)] rounded-lg shadow-sm bg-[var(--surface)] flex gap-3',
                getPriorityClass(n.priority)
              )}
            >
              <div className="mt-1">{getPriorityIcon(n.priority)}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-[var(--text-primary)]">
                    {decodeHtml(n.title)}
                  </h4>
                  <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap ml-2 flex-shrink-0 font-medium">
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : ''}
                  </span>
                </div>
                <p className="text-[var(--text-secondary)] text-sm mt-1">{decodeHtml(n.message)}</p>
                {renderContent(n)}
              </div>
              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkAsRead(n.notificationId)}
                  title="Mark Read"
                >
                  <CheckCircle2 />
                </Button>
              )}
            </div>
          ))
        )}
        {filteredNotifications.length === 0 && (
          <div className="text-center py-10 text-[var(--text-secondary)]">
            No notifications in this category.
          </div>
        )}
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
                      ? new Date(selectedOrderDetails.orderCreatedDate).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
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
                <span className="text-yellow-900">
                  {decodeHtml(selectedOrderDetails.adminRemarks)}
                </span>
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
                        <td className="p-2 font-medium text-gray-900">
                          {decodeHtml(item.productName)}
                        </td>
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

      {/* Dispatch Details Modal */}
      <Modal
        isOpen={isDispatchDetailsOpen}
        onClose={() => setIsDispatchDetailsOpen(false)}
        title={`Dispatch Details: #${selectedDispatch?.dispatchId || ''}`}
        size="lg"
      >
        {!selectedDispatch ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block">Vehicle No</span>
                <span className="font-bold text-gray-900 text-lg">
                  {selectedDispatch.vehicleNo}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Dispatch Date</span>
                <span className="font-semibold text-gray-900">
                  {selectedDispatch.createdAt
                    ? new Date(selectedDispatch.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Driver Name</span>
                <span className="font-semibold text-gray-900">
                  {selectedDispatch.driverName || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Status</span>
                <span className="font-medium text-green-700">{selectedDispatch.status}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Created By</span>
                <span className="font-medium text-gray-900">
                  User #{selectedDispatch.createdBy}
                </span>
              </div>
              <div className="col-span-1">
                {' '}
                {/* Adjusted span */}
                {/* Spacer or extra field if needed */}
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 block">Remarks</span>
                <span className="text-gray-900">{selectedDispatch.remarks || 'None'}</span>
              </div>
            </div>

            {/* Orders List */}
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileText size={16} /> Included Orders
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Order #</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-left">Location</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDispatch.orders?.map((o: any) => (
                      <tr key={o.orderId} className="hover:bg-gray-50">
                        <td className="p-2 font-mono font-medium text-green-700">
                          {o.orderNumber}
                        </td>
                        <td className="p-2">{o.customerName}</td>
                        <td className="p-2 text-gray-500 truncate max-w-[200px]">{o.location}</td>
                        <td className="p-2 text-right">₹{o.totalAmount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Shortage Details Modal */}
      <Modal
        isOpen={isShortageModalOpen}
        onClose={() => setIsShortageModalOpen(false)}
        title={`Shortage Impact: ${shortageDetails?.materialName || 'Loading...'}`}
        size="xl"
      >
        {isLoadingShortage ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="overflow-hidden border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                <tr>
                  <th className="p-3">Order No</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Products</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {shortageDetails?.orders.map(order => (
                  <React.Fragment key={order.orderId}>
                    <tr
                      className={cn(
                        'transition-colors',
                        expandedOrderId === order.orderId ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                      )}
                    >
                      <td className="p-3 font-mono font-medium text-gray-900">
                        {order.orderNumber || `#${order.orderId}`}
                      </td>
                      <td className="p-3 text-gray-600">
                        {order.orderCreatedDate
                          ? new Date(order.orderCreatedDate).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })
                          : '-'}
                      </td>
                      <td className="p-3 font-medium text-gray-900">{order.customerName}</td>
                      <td className="p-3 text-gray-600">
                        <div className="flex flex-col gap-1">
                          {order.items?.map((item, idx) => (
                            <span key={idx} className="text-xs">
                              {item.productName} - {item.size} ({item.quantity} {item.unit})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          className={cn(
                            'h-7 text-xs border transition-colors',
                            expandedOrderId === order.orderId
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                          )}
                          onClick={() =>
                            setExpandedOrderId(
                              expandedOrderId === order.orderId ? null : order.orderId
                            )
                          }
                        >
                          <Eye size={12} className="mr-1" />{' '}
                          {expandedOrderId === order.orderId ? 'Hide' : 'View'} Details
                        </Button>
                      </td>
                    </tr>
                    {expandedOrderId === order.orderId && (
                      <tr className="animate-in fade-in duration-200">
                        <td colSpan={5} className="p-0 border-b">
                          <div className="bg-gray-50 p-6 space-y-6 border-t shadow-inner">
                            {/* Detailed View */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                              <div className="space-y-4">
                                <div
                                  className={cn(
                                    'px-4 py-2 rounded-lg flex justify-between items-center text-sm font-medium w-full',
                                    order.status === 'Factory Approved' ||
                                      order.status === 'Accepted'
                                      ? 'bg-green-100 text-green-700'
                                      : order.status === 'On Hold'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-blue-100 text-blue-700'
                                  )}
                                >
                                  <span>{order.status}</span>
                                  <span>
                                    {order.paymentCleared ? 'Payment Cleared' : 'Payment Pending'}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  <h4 className="font-semibold text-gray-900 border-b pb-1">
                                    Customer Info
                                  </h4>
                                  <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="text-gray-500">Company:</span>
                                    <span className="font-medium text-gray-900">
                                      {order.customerName}
                                    </span>
                                    <span className="text-gray-500">Address:</span>
                                    <span className="text-gray-900 whitespace-pre-wrap">
                                      {order.address || order.location}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                {order.adminRemarks && (
                                  <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100 text-sm mb-2">
                                    <span className="font-semibold text-yellow-800">Remarks: </span>
                                    <span className="text-yellow-900">{order.adminRemarks}</span>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-gray-900 border-b pb-1">
                                    Order Details
                                  </h4>
                                  <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="text-gray-500">Bill No:</span>
                                    <span className="text-gray-900 font-mono">
                                      {order.billNo || '-'}
                                    </span>
                                    <span className="text-gray-500">Salesperson:</span>
                                    <span className="text-gray-900">
                                      {order.salesPersonName || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold mb-3 text-gray-900">
                                Complete Item List
                              </h4>
                              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                      <th className="p-2 text-left">Product</th>
                                      <th className="p-2 text-center">Size</th>
                                      <th className="p-2 text-center">Qty</th>
                                      <th className="p-2 text-right">Unit Price</th>
                                      <th className="p-2 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {order.items?.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="p-2 font-medium text-gray-900">
                                          {item.productName}
                                        </td>
                                        <td className="p-2 text-center text-gray-500">
                                          {item.size}
                                        </td>
                                        <td className="p-2 text-center font-medium">
                                          {item.quantity} {item.unit}
                                        </td>
                                        <td className="p-2 text-right text-gray-500">
                                          ₹{item.unitPrice}
                                        </td>
                                        <td className="p-2 text-right font-medium">
                                          ₹{item.totalPrice}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-bold">
                                      <td colSpan={4} className="p-2 text-right">
                                        Grand Total:
                                      </td>
                                      <td className="p-2 text-right">
                                        ₹{order.totalAmount?.toLocaleString()}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NotificationsPage;
