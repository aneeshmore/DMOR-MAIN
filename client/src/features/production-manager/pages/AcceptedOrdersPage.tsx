import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionManagerApi, InventoryCheckResult } from '../api/productionManagerApi';
import { showToast } from '@/utils/toast';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { AcceptedOrdersDataTable } from './AcceptedOrdersDataTable';
import { BatchScheduleModal } from '../components/BatchScheduleModal';
import { DashboardNotifications } from '@/features/notifications/components/DashboardNotifications';

interface OrderWithDetails {
  order: any;
  customer: any;
  salesperson: any;
  details?: any[];
}

export default function AcceptedOrdersPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Editing state
  const [editedData, setEditedData] = useState<
    Record<number, { expectedDeliveryDate: string; remarks: string }>
  >({});

  // Interaction state
  const [loadingInventory, setLoadingInventory] = useState<Set<number>>(new Set());
  const [inventoryResults, setInventoryResults] = useState<Map<number, InventoryCheckResult[]>>(
    new Map()
  );

  // Details loading state
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());

  // Batch schedule modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedOrderForBatch, setSelectedOrderForBatch] = useState<{
    orderId: number;
    orderNumber: string;
    expectedDeliveryDate: string;
    pmRemarks?: string;
  } | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const data = await productionManagerApi.getAcceptedOrders();

      const ordersWithData = data.map((item: any) => ({
        ...item,
        details: [], // Initialize empty, fetch on demand
      }));

      // Sort orders by creation time (descending - newest first)
      const sortedOrdersWithData = ordersWithData.sort(
        (a, b) => new Date(b.order.orderDate).getTime() - new Date(a.order.orderDate).getTime()
      );

      setOrders(sortedOrdersWithData);

      // Initialize editing state
      const initialData: Record<number, any> = {};
      data.forEach((item: any) => {
        const o = item.order;
        initialData[o.orderId] = {
          expectedDeliveryDate: o.expectedDeliveryDate
            ? new Date(o.expectedDeliveryDate).toISOString().split('T')[0]
            : '',
          remarks: o.pmRemarks || '',
        };
      });
      setEditedData(initialData);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      showToast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useCallback((orderId: number, field: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  }, []);

  const fetchDetailsIfNeeded = async (orderId: number) => {
    const existingOrder = orders.find(o => o.order.orderId === orderId);
    if (existingOrder?.details && existingOrder.details.length > 0) return existingOrder.details;

    try {
      setLoadingDetails(prev => new Set(prev).add(orderId));
      const response = await productionManagerApi.getOrderDetails(orderId);
      const details = response.details || [];

      setOrders(prev => prev.map(o => (o.order.orderId === orderId ? { ...o, details } : o)));
      return details;
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      showToast.error('Failed to load details');
      return [];
    } finally {
      setLoadingDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const checkAvailability = useCallback(async (orderId: number) => {
    try {
      setLoadingInventory(prev => new Set(prev).add(orderId));

      // Ensure we have details
      const details = await fetchDetailsIfNeeded(orderId);

      if (!details || details.length === 0) {
        showToast.error('No products found in this order');
        return;
      }

      // Check Inventory
      const products = details.map((d: any) => ({
        productId: Number(d.orderDetail.productId),
        quantity: Number(d.orderDetail.quantity),
      }));

      const results = await productionManagerApi.checkInventory(products);
      setInventoryResults(prev => new Map(prev).set(orderId, results));

      const allCanFulfill = results.every(r => r.canFulfill);
      if (allCanFulfill) {
        showToast.success('All products available for dispatch');
      } else {
        showToast.warning('Inventory shortage - Scheduling required');
      }
    } catch (error: any) {
      console.error('Inventory check failed:', error);
      showToast.error('Failed to check inventory');
    } finally {
      setLoadingInventory(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, []);

  const handleProcessOrder = useCallback(
    async (orderId: number, action: 'dispatch' | 'schedule' | 'split') => {
      const data = editedData[orderId];
      if (!data.expectedDeliveryDate) {
        showToast.error('Please set expected delivery date');
        return;
      }

      try {
        if (action === 'dispatch') {
          // Update order details first (silent)
          await productionManagerApi.updateOrderDetails(
            orderId,
            {
              expectedDeliveryDate: data.expectedDeliveryDate,
              pmRemarks: data.remarks,
            },
            { successMessage: undefined }
          );

          // Send to dispatch directly (shows its own success toast)
          await productionManagerApi.sendToDispatch(orderId);
          fetchOrders();
        } else if (action === 'split') {
          // Navigate to Split Order Page
          navigate('/operations/split-order', { state: { orderId } });
        } else {
          // Schedule directly without opening modal
          setIsLoading(true);
          // Update order details first (silent)
          await productionManagerApi.updateOrderDetails(
            orderId,
            {
              expectedDeliveryDate: data.expectedDeliveryDate,
              pmRemarks: data.remarks,
            },
            { successMessage: undefined }
          );

          // Auto schedule the order (shows its own success toast)
          await productionManagerApi.autoScheduleOrder({
            orderId,
            expectedDeliveryDate: data.expectedDeliveryDate,
          });

          fetchOrders();
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to process order:', error);
        showToast.error('Failed to update order');
      }
    },
    [editedData, orders, navigate]
  );

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Accept Orders by Production Department"
        description="Manage factory orders and dispatch"
      />

      {/* Notifications for Pending Assessment */}
      <DashboardNotifications
        types={['OrderUpdate']}
        orderStatuses={['Factory Approved', 'Accepted']}
        typeLabels={{ OrderUpdate: 'Accepted Orders' }}
        title="Orders Pending Production Assessment"
      />

      <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm mb-8 overflow-hidden">
        <div className="bg-[var(--surface-secondary)] p-4 border-b border-[var(--border)] flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Factory Status</h2>
        </div>

        <div className="p-0">
          <AcceptedOrdersDataTable
            data={orders}
            editedData={editedData}
            handleInputChange={handleInputChange}
            checkAvailability={checkAvailability}
            loadingInventory={loadingInventory}
            inventoryResults={inventoryResults}
            handleProcessOrder={handleProcessOrder}
          />
        </div>
      </div>

      {/* Batch Schedule Modal */}
      {selectedOrderForBatch && (
        <BatchScheduleModal
          isOpen={batchModalOpen}
          onClose={() => {
            setBatchModalOpen(false);
            setSelectedOrderForBatch(null);
          }}
          orderId={selectedOrderForBatch.orderId}
          orderNumber={selectedOrderForBatch.orderNumber}
          expectedDeliveryDate={selectedOrderForBatch.expectedDeliveryDate}
          pmRemarks={selectedOrderForBatch.pmRemarks}
          onSuccess={() => {
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
