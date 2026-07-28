import { useState, useEffect } from 'react';
import { showToast } from '@/utils/toast';
import { PauseCircle, AlertCircle, Ban, Split } from 'lucide-react';
import { FullScreenLoader, Modal } from '@/components/ui';
import { PageHeader } from '@/components/common';

// Stable route path for this page, as declared in routeRegistry.tsx.
// Used only to look up the shared display title/description - the route,
// component name and permission key are unchanged.
const ADMIN_ACCOUNTS_PATH = '/operations/admin-accounts';
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
        // A split's Dispatch child (Child A) already has a Bill No the moment it is created,
        // inherited from the parent order — but that is not the same as the Accounts Manager
        // having reviewed and approved it. Exclude that inherited Bill No here so Accounts
        // Approved still defaults to 'No' and remains a deliberate action, i.e. inheriting a
        // Bill No never bypasses Accounts Approval.
        const isInheritedSplitBillNo =
          !!o.billNo &&
          !!o.salespersonRemark &&
          o.salespersonRemark.includes('Split from Order') &&
          !o.salespersonRemark.includes('(Balance)');

        initialData[o.orderId] = {
          billNo: o.billNo || '',
          remarks: '',
          paymentCleared: o.paymentCleared || false,
          accountsApproved:
            (o.billNo && !isInheritedSplitBillNo) || o.paymentCleared ? 'Approved' : 'No',
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
    // The backend requires a non-empty holdReason (see admin-accounts/schema.js) — not a Bill
    // No, which Hold never touches. Checking it here, the same way handleAcceptOrder already
    // checks billNo before calling the API, gives an accurate message immediately instead of
    // a round trip that (until the 500-handling fix is approved) surfaces as a generic
    // "Server error" rather than the real "reason is required" validation message.
    if (!data.remarks || !data.remarks.trim()) {
      showToast.error('Please enter a remark/reason to place this order on hold');
      return;
    }
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

  // The "Split from Order #X" marker is written to the order's own remark at split time
  // (orders.notes), which this dashboard receives as `salespersonRemark`. It was previously
  // read from `adminRemarks` (the accounts-table remark), which the split never populates —
  // so no split order was ever detected and the Split Orders table always rendered empty.
  const isSplitOrder = (order: AdminOrder) => {
    return !!order.salespersonRemark && order.salespersonRemark.includes('Split from Order');
  };

  const isAwaitingAccounts = (o: AdminOrder) =>
    o.status === 'Pending Accounts Approval' || o.status === 'Pending';

  const pendingOrders = orders.filter(o => isAwaitingAccounts(o) && !o.onHold && !isSplitOrder(o));
  // Child A keeps its inherited Bill No while still awaiting approval, so split orders are no
  // longer excluded once a Bill No is present — they stay here until Accounts accepts them.
  const splitOrders = orders.filter(o => isAwaitingAccounts(o) && !o.onHold && isSplitOrder(o));
  const onHoldOrders = orders.filter(o => o.status === 'On Hold' || o.onHold);

  // Summary cards jump the page down to their matching section instead of filtering/hiding
  // anything - every section stays rendered on the page, same as PaintOS's reference behavior.
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <>
      {/* Full Screen Loader */}
      <FullScreenLoader isLoading={actionLoading} message="Processing order..." />

      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          metadataPath={ADMIN_ACCOUNTS_PATH}
          title="Admin Accounts"
          description="Manage pending payments and order billing"
        />

        {/* Section counts — click a card to jump to that table below */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            onClick={() => scrollToSection('pending-accounts-approval-section')}
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 p-3 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 cursor-pointer hover:shadow-sm transition-shadow"
          >
            <AlertCircle className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
            <div>
              <div className="text-lg font-bold text-[var(--text-primary)] leading-none">
                {pendingOrders.length}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                Pending Accounts Approval
              </div>
            </div>
          </div>
          <div
            onClick={() => scrollToSection('split-orders-section')}
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 p-3 rounded-lg border border-sky-200 bg-sky-50 cursor-pointer hover:shadow-sm transition-shadow"
          >
            <Split className="w-4 h-4 text-sky-700 flex-shrink-0" />
            <div>
              <div className="text-lg font-bold text-[var(--text-primary)] leading-none">
                {splitOrders.length}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                Split Orders - Waiting for Bill No
              </div>
            </div>
          </div>
          <div
            onClick={() => scrollToSection('on-hold-orders-section')}
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 p-3 rounded-lg border border-[var(--warning)]/20 bg-[var(--warning)]/5 cursor-pointer hover:shadow-sm transition-shadow"
          >
            <PauseCircle className="w-4 h-4 text-[var(--warning)] flex-shrink-0" />
            <div>
              <div className="text-lg font-bold text-[var(--text-primary)] leading-none">
                {onHoldOrders.length}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                Order Payment On Hold
              </div>
            </div>
          </div>
          <div
            onClick={() => scrollToSection('cancelled-orders-section')}
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 p-3 rounded-lg border border-[var(--error)]/20 bg-[var(--error)]/5 cursor-pointer hover:shadow-sm transition-shadow"
          >
            <Ban className="w-4 h-4 text-[var(--error)] flex-shrink-0" />
            <div>
              <div className="text-lg font-bold text-[var(--text-primary)] leading-none">
                {cancelledOrders.length}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">Cancelled Orders</div>
            </div>
          </div>
        </div>

        {/* Notifications Section — hidden per request. Left commented (not deleted) so it can
            be restored by uncommenting; DashboardNotifications itself is unchanged and still
            used on the Factory Order Confirmation page.
        <DashboardNotifications
          types={['NewOrder', 'OrderUpdate', 'Dispatch']}
          title="Recent Alerts & Updates"
        /> */}

        {/* Pending Orders Section */}
        <div id="pending-accounts-approval-section">
          <PendingOrdersDataTable
            title="Pending Orders - Awaiting Acceptance"
            icon={<AlertCircle className="w-5 h-5 text-[var(--primary)]" />}
            data={pendingOrders}
            editedData={editedData}
            onInputChange={handleInputChange}
            onAccept={handleAcceptOrder}
            onHold={handleHoldOrder}
          />
        </div>

        {/* Split Orders Section */}
        <div id="split-orders-section">
          <SplitOrdersTable
            orders={splitOrders}
            editedData={editedData}
            handleInputChange={handleInputChange}
            onAccept={handleAcceptOrder}
            handleHold={handleHoldOrder}
            handleOpenDetails={handleOpenDetails}
          />
        </div>

        {/* On Hold Orders Section */}
        <div id="on-hold-orders-section">
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
        </div>

        {/* Cancelled Orders Section */}
        <div id="cancelled-orders-section">
          <CancelledOrdersDataTable
            title="Cancelled Orders"
            icon={<Ban className="w-5 h-5 text-[var(--error)]" />}
            data={cancelledOrders}
          />
        </div>

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
