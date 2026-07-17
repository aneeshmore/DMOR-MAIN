import { useState, useEffect } from 'react';
import { showToast } from '@/utils/toast';
import { PauseCircle, AlertCircle, Ban } from 'lucide-react';
import { FullScreenLoader, Modal } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { PendingOrdersDataTable } from './PendingOrdersDataTable';
import { SplitOrdersTable } from '../components/SplitOrdersTable';
import { CancelledOrdersDataTable } from './CancelledOrdersDataTable';
import { AdminOrder, adminAccountsApi, AdminOrderDetails } from '../api/adminAccountsApi';
import { DashboardNotifications } from '@/features/notifications/components/DashboardNotifications';
import { promptDialog } from '@/components/ui';

export default function AccountsDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editedData, setEditedData] = useState<
    Record<
      number,
      {
        billNo: string;
        remarks: string;
        paymentCleared: boolean;
        accountsApproved: 'No' | 'Approved';
      }
    >
  >({});

  // New State for Details Modal
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrderDetails | null>(null);

  // Action Loading State
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const [pendingData, cancelledData] = await Promise.all([
        adminAccountsApi.getPendingPayments(),
        adminAccountsApi.getCancelledOrders(),
      ]);

      // Ensure data is an array before setting
      const safeData = Array.isArray(pendingData) ? pendingData : [];
      // Only show non-cancelled orders for now (unless we want to show them elsewhere)
      const nonCancelledData = safeData.filter(
        o => o.status !== 'Cancelled' && o.status !== 'Rejected'
      );
      setOrders(nonCancelledData);

      const safeCancelledData = Array.isArray(cancelledData) ? cancelledData : [];
      // Sort cancelled orders by creation time (descending - newest first)
      const sortedCancelledData = safeCancelledData.sort(
        (a, b) => new Date(b.orderCreatedDate).getTime() - new Date(a.orderCreatedDate).getTime()
      );
      setCancelledOrders(sortedCancelledData);

      const initialData: Record<
        number,
        {
          billNo: string;
          remarks: string;
          paymentCleared: boolean;
          accountsApproved: 'No' | 'Approved';
        }
      > = {};
      nonCancelledData.forEach(o => {
        initialData[o.orderId] = {
          billNo: o.billNo || '',
          remarks: '',
          paymentCleared: o.paymentCleared || false,
          accountsApproved: o.billNo || o.paymentCleared ? 'Approved' : 'No',
        };
      });
      setEditedData(initialData);
    } catch (error) {
      console.error('Fetch orders error:', error);
      showToast.error('Failed to fetch orders');
      setOrders([]); // Fallback to empty array
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleInputChange = (orderId: number, field: string, value: string | boolean) => {
    setEditedData(prev => {
      const updated = {
        ...prev[orderId],
        [field]: value,
      };
      // Keep paymentCleared in sync with the Account Approved selector so the
      // existing accept flow and API contract remain unchanged.
      if (field === 'accountsApproved') {
        updated.paymentCleared = value === 'Approved';
      }
      // Reverse sync: the Split Orders table still toggles paymentCleared directly.
      if (field === 'paymentCleared') {
        updated.accountsApproved = value ? 'Approved' : 'No';
      }
      return {
        ...prev,
        [orderId]: updated,
      };
    });
  };

  const handleAcceptOrder = async (orderId: number) => {
    // Only paymentCleared is needed for main logic if billNo is already there
    // But if they edit billNo in Pending table, accept it too.
    const data = editedData[orderId];
    if (data.accountsApproved !== 'Approved') {
      showToast.error('Account Approved must be set to Yes');
      return;
    }
    if (!data.billNo) {
      showToast.error('Please enter Bill No');
      return;
    }

    try {
      setActionLoading(true);
      await adminAccountsApi.acceptOrder(orderId, {
        billNo: data.billNo,
        adminRemarks: data.remarks,
      });
      // Success toast handled by API interceptor
      fetchOrders();
    } catch {
      // Error already shown by axios interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async (orderId: number) => {
    const rejectReason = await promptDialog({
      title: 'Reject Order',
      message: 'Please enter a reason for rejection/cancellation:',
      confirmLabel: 'Reject',
      variant: 'danger',
    });
    if (!rejectReason) {
      showToast.error('Rejection reason is required.');
      return;
    }
    try {
      setActionLoading(true);
      await adminAccountsApi.rejectOrder(orderId, { rejectReason });
      // Success toast handled by API interceptor
      fetchOrders();
    } catch (error) {
      // Error handled
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBillNo = async (orderId: number) => {
    const data = editedData[orderId];
    if (!data.billNo) {
      showToast.error('Please enter Bill No');
      return;
    }
    try {
      await adminAccountsApi.updateBillNo(orderId, { billNo: data.billNo });
      fetchOrders();
    } catch (error) {
      // Error handled
    }
  };

  const handleHoldOrder = async (orderId: number) => {
    const data = editedData[orderId];
    try {
      setActionLoading(true);
      await adminAccountsApi.holdOrder(orderId, { holdReason: data.remarks });
      // Success toast handled by API interceptor
      fetchOrders();
    } catch (error) {
      // Error already shown by axios interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeOrder = async (orderId: number) => {
    try {
      setActionLoading(true);
      await adminAccountsApi.resumeOrder(orderId);
      // Success toast handled by API interceptor
      fetchOrders();
    } catch (error) {
      // Error already shown by axios interceptor
    } finally {
      setActionLoading(false);
    }
  };

  // Details Modal logic
  const fetchOrderDetails = async (orderId: number) => {
    try {
      const data = await adminAccountsApi.getOrderDetails(orderId);
      setSelectedOrderDetails(data);
    } catch {
      showToast.error('Failed to load order details');
      setSelectedOrderId(null);
    }
  };

  const handleOpenDetails = (orderId: number) => {
    setSelectedOrderId(orderId);
    setSelectedOrderDetails(null); // Clear previous
    fetchOrderDetails(orderId);
  };

  const handleCloseDetails = () => {
    setSelectedOrderId(null);
    setSelectedOrderDetails(null);
  };

  const isSplitOrder = (order: AdminOrder) => {
    return order.adminRemarks && order.adminRemarks.includes('Split from Order');
  };

  const isAwaitingAccounts = (o: AdminOrder) =>
    o.status === 'Pending Accounts Approval' || o.status === 'Pending';

  const pendingOrders = orders.filter(o => isAwaitingAccounts(o) && !o.onHold && !isSplitOrder(o));
  const splitOrders = orders.filter(
    o => isAwaitingAccounts(o) && !o.onHold && !o.billNo && isSplitOrder(o)
  );
  const onHoldOrders = orders.filter(o => o.status === 'On Hold' || o.onHold);

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <>
      {/* Full Screen Loader */}
      <FullScreenLoader isLoading={actionLoading} message="Processing order..." />

      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Admin Accounts"
          description="Manage pending payments and order billing"
        />

        {/* Notifications Section */}
        <DashboardNotifications
          types={['NewOrder', 'OrderUpdate', 'Dispatch']}
          title="Recent Alerts & Updates"
        />

        {/* Pending Orders Section */}
        <PendingOrdersDataTable
          title="Pending Orders - Awaiting Acceptance"
          icon={<AlertCircle className="w-5 h-5 text-[var(--primary)]" />}
          data={pendingOrders}
          editedData={editedData}
          onInputChange={handleInputChange}
          onAccept={handleAcceptOrder}
          onHold={handleHoldOrder}
        />

        {/* Split Orders Section */}
        <SplitOrdersTable
          orders={splitOrders}
          editedData={editedData}
          handleInputChange={handleInputChange}
          onAccept={handleAcceptOrder}
          handleHold={handleHoldOrder}
          handleOpenDetails={handleOpenDetails}
        />

        {/* On Hold Orders Section */}
        <PendingOrdersDataTable
          title="Order Payment On Hold"
          icon={<PauseCircle className="w-5 h-5 text-[var(--warning)]" />}
          data={onHoldOrders}
          editedData={editedData}
          onInputChange={handleInputChange}
          onAccept={handleAcceptOrder}
          onHold={handleHoldOrder}
          onReject={handleRejectOrder}
          onResume={handleResumeOrder}
          isHoldTable={true}
        />

        {/* Cancelled Orders Section */}
        <CancelledOrdersDataTable
          title="Cancelled Orders"
          icon={<Ban className="w-5 h-5 text-[var(--error)]" />}
          data={cancelledOrders}
        />

        <Modal
          isOpen={!!selectedOrderId}
          onClose={handleCloseDetails}
          title={`Order Details: ${selectedOrderDetails ? selectedOrderDetails.orderNumber || selectedOrderDetails.orderId : 'Loading...'}`}
          size="lg"
        >
          {!selectedOrderDetails ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Order Summary */}
              <h3 className="text-sm font-bold text-gray-900 mb-2">Order Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Company:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedOrderDetails.customerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Salesperson:</span>
                  <span className="font-medium text-gray-900">
                    {selectedOrderDetails.salesPersonName || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Priority:</span>
                  <div className="font-medium text-gray-900">
                    {selectedOrderDetails.priority || 'Normal'}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Address:</span>
                  <span className="font-medium text-gray-900 text-right max-w-[200px]">
                    {selectedOrderDetails.address || selectedOrderDetails.location || '-'}
                  </span>
                </div>
              </div>
              {/* Add more details here if needed */}
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}
