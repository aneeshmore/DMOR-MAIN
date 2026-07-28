import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Split,
  X,
  Package,
  ArrowRight,
  Check,
  AlertTriangle,
  Layers,
  Building2,
  Calendar,
  MapPin,
  FileText,
  Sparkles,
  Boxes,
  TrendingUp,
  Minus,
  Plus,
  Info,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { ordersApi } from '@/features/orders/api/ordersApi';
import { splitOrdersApi } from '../api';
import { productApi } from '@/features/master-products/api/productApi';
import { showToast } from '@/utils/toast';
import { OrderWithDetails, OrderDetail } from '@/features/orders/types';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/DataTableColumnHeader';
import { PageHeader } from '@/components/common';
import { Badge } from '@/components/ui';
import { decodeHtml } from '@/utils/stringUtils';

interface ProductWithMaster extends OrderDetail {
  masterProductName?: string;
  masterProductId?: number;
  availableQty: number;
  isShort: boolean;
}

interface MasterProductGroup {
  masterProductId: number;
  masterProductName: string;
  products: ProductWithMaster[];
  totalOrdered: number;
  totalAvailable: number;
  isExpanded: boolean;
  isFullyAssignedToOrder1: boolean;
  isFullyAssignedToOrder2: boolean;
}

// Helper for time span
const getTimeSpan = (dateStr?: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days > 0) return `${days} Days to go`;
  return `${Math.abs(days)} Days ago`;
};

const SplitOrderPage: React.FC = () => {
  const location = useLocation();
  const stateOrderId = location.state?.orderId;

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(stateOrderId || null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<OrderWithDetails | null>(null);
  const [products, setProducts] = useState<Record<number, any>>({});

  const [remark, setRemark] = useState('');

  // State for item quantities distribution
  const [distributions, setDistributions] = useState<Record<number, { q1: string; q2: string }>>(
    {}
  );

  // Split mode: 'quantity', 'product', or 'preference'

  // Expanded master product groups
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Pending Orders List
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // Fetch pending orders
  const fetchPendingOrders = useCallback(async () => {
    try {
      // 'Pending Factory Approval' and 'Factory Approved' were missing, which hid every order
      // sitting in the two most common states of the current workflow — financially cleared
      // but not yet in production, i.e. exactly the point where splitting is decided. Legacy
      // status names are kept so historical orders remain splittable.
      const statuses =
        'On Hold,Pending Factory Approval,Factory Approved,Scheduled for Production,In Production,Ready for Dispatch,Accepted,Confirmed,Started';
      const recent = await ordersApi.getAll({ limit: 50, offset: 0, status: statuses });
      setPendingOrders(recent || []);
    } catch (err) {
      console.error('Failed to load recent orders', err);
    }
  }, []);

  useEffect(() => {
    fetchPendingOrders();
  }, [fetchPendingOrders]);

  const handleCloseForm = () => {
    setSelectedOrderId(null);
    setOriginalOrder(null);
    setDistributions({});
    setRemark('');
    setExpandedGroups(new Set());
  };

  const handleSuccess = () => {
    showToast.success('Order split successfully');
    handleCloseForm();
    fetchPendingOrders();
  };

  const handleOrderSelect = (orderId: number) => {
    if (selectedOrderId === orderId) {
      handleCloseForm();
    } else {
      setSelectedOrderId(orderId);
    }
  };

  // Group products by master product
  const masterProductGroups = useMemo<MasterProductGroup[]>(() => {
    if (!originalOrder?.orderDetails) return [];

    const groups: Record<number, MasterProductGroup> = {};

    originalOrder.orderDetails.forEach(item => {
      const product = products[item.productId];
      const masterProductId = product?.MasterProductID || product?.masterProductId || 0;
      const masterProductName =
        product?.MasterProductName || product?.masterProductName || 'Other Products';
      const availableQty =
        product?.AvailableQuantity !== undefined
          ? Math.max(0, parseFloat(product.AvailableQuantity))
          : 0;
      const orderedQty = parseFloat(item.quantity as any) || 0;

      if (!groups[masterProductId]) {
        groups[masterProductId] = {
          masterProductId,
          masterProductName,
          products: [],
          totalOrdered: 0,
          totalAvailable: 0,
          isExpanded: expandedGroups.has(masterProductId),
          isFullyAssignedToOrder1: false,
          isFullyAssignedToOrder2: false,
        };
      }

      groups[masterProductId].products.push({
        ...item,
        masterProductId,
        masterProductName,
        availableQty,
        isShort: availableQty < orderedQty,
      });
      groups[masterProductId].totalOrdered += orderedQty;
      groups[masterProductId].totalAvailable += availableQty;
    });

    // Calculate if fully assigned
    Object.values(groups).forEach(group => {
      let allToOrder1 = true;
      let allToOrder2 = true;

      group.products.forEach(p => {
        const dist = distributions[p.productId];
        const q1 = parseFloat(dist?.q1 || '0');
        const q2 = parseFloat(dist?.q2 || '0');
        const total = parseFloat(p.quantity as any) || 0;

        if (q1 < total) allToOrder1 = false;
        if (q2 < total) allToOrder2 = false;
      });

      group.isFullyAssignedToOrder1 = allToOrder1;
      group.isFullyAssignedToOrder2 = allToOrder2;
    });

    return Object.values(groups);
  }, [originalOrder, products, distributions, expandedGroups]);

  const pendingOrdersColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'orderId',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order ID" />,
        cell: ({ row }) => (
          <div className="font-bold text-[var(--primary)]">#{row.getValue('orderId')}</div>
        ),
      },
      {
        accessorKey: 'companyName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
        cell: ({ row }) => {
          const companyName = row.original.companyName;
          const customerName = row.original.customerName;
          const customerId = row.original.customerId;
          return (
            <div className="font-medium text-[var(--text-primary)]">
              {decodeHtml(companyName || customerName) || `Customer #${customerId}`}
            </div>
          );
        },
      },
      {
        accessorKey: 'productNames',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Products" />,
        cell: ({ row }) => (
          <div className="text-[var(--text-secondary)] text-sm max-w-[200px] truncate">
            {decodeHtml(row.getValue('productNames')) || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'totalQuantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total Qty" />,
        cell: ({ row }) => (
          <div className="text-center font-semibold text-[var(--text-primary)]">
            {row.original.totalQuantity || 0}
          </div>
        ),
      },
      {
        id: 'timeSpan',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Deadline" />,
        cell: ({ row }) => {
          const span = getTimeSpan(row.original.expectedDeliveryDate || row.original.orderDate);
          const isOverdue = span.includes('ago');
          return (
            <div
              className={`text-sm font-medium ${isOverdue ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'}`}
            >
              {span}
            </div>
          );
        },
      },
      {
        accessorKey: 'billNo',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bill No" />,
        cell: ({ row }) => (
          <div className="font-medium text-[var(--text-secondary)]">
            {row.getValue('billNo') || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        meta: { fitContent: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          let colorClass = 'bg-gray-100 text-gray-800'; // Default

          switch (status) {
            case 'Pending Accounts Approval':
            case 'Pending':
              colorClass = 'bg-orange-100 text-orange-800';
              break;
            case 'Pending Factory Approval':
            case 'Verified':
              colorClass = 'bg-amber-100 text-amber-800';
              break;
            case 'Factory Approved':
            case 'Accepted':
              colorClass = 'bg-green-100 text-green-800';
              break;
            case 'Confirmed':
              colorClass = 'bg-blue-100 text-blue-800';
              break;
            case 'Scheduled for Production':
              colorClass = 'bg-purple-100 text-purple-800';
              break;
            case 'In Production':
              colorClass = 'bg-indigo-100 text-indigo-800';
              break;
            case 'Ready for Dispatch':
              colorClass = 'bg-teal-100 text-teal-800';
              break;
            case 'Started':
              colorClass = 'bg-orange-100 text-orange-800';
              break;
            case 'On Hold':
              colorClass = 'bg-yellow-100 text-yellow-800';
              break;
          }

          // Alignment/sizing only — mirrors the Create Order page's status
          // pill treatment so the badge stays on one line, without touching
          // the color-mapping logic above.
          return (
            <Badge
              className={`${colorClass} whitespace-nowrap leading-none px-4 py-1.5`}
              variant="secondary"
            >
              {status}
            </Badge>
          );
        },
      },
    ],
    []
  );

  // Load order details when selected
  useEffect(() => {
    if (selectedOrderId) {
      const loadData = async () => {
        setLoading(true);
        try {
          const [orderData, productsResponse] = await Promise.all([
            ordersApi.getById(selectedOrderId),
            productApi.getAll(),
          ]);

          if (!orderData) {
            throw new Error('Order not found');
          }

          setOriginalOrder(orderData);

          // Map products
          const productMap: Record<number, any> = {};
          const productList = Array.isArray(productsResponse)
            ? productsResponse
            : (productsResponse as any).data || [];

          productList.forEach((p: any) => {
            const id = p.productId || p.product_id || p.ProductID;
            if (id) productMap[id] = p;
          });
          setProducts(productMap);

          // Initialize distributions
          const initialDist: Record<number, { q1: string; q2: string }> = {};
          const initialExpanded = new Set<number>();

          if (orderData && orderData.orderDetails) {
            orderData.orderDetails.forEach((item: any) => {
              const product = productMap[item.productId];
              const originalQty = parseFloat(item.quantity as any) || 0;
              const availableQty =
                product?.AvailableQuantity !== undefined
                  ? Math.max(0, parseFloat(product.AvailableQuantity))
                  : 0;

              const dispatchQty = Math.min(originalQty, availableQty);
              const balanceQty = originalQty - dispatchQty;

              initialDist[item.productId] = {
                q1: dispatchQty.toString(),
                q2: balanceQty.toString(),
              };

              const masterProductId = product?.MasterProductID || product?.masterProductId || 0;
              if (availableQty < originalQty) {
                initialExpanded.add(masterProductId);
              }
            });
          }
          setDistributions(initialDist);
          setExpandedGroups(initialExpanded);
          setRemark('');
        } catch (error) {
          console.error('Failed to fetch data:', error);
          showToast.error('Failed to fetch order details.');
          setSelectedOrderId(null);
          setOriginalOrder(null);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    } else {
      setOriginalOrder(null);
    }
  }, [selectedOrderId]);

  const handleRevisedQtyChange = useCallback(
    (productId: number, value: string, targetOrder: 'q1' | 'q2' = 'q1') => {
      if (!/^\d*\.?\d*$/.test(value)) return;

      const item = originalOrder?.orderDetails.find(i => i.productId === productId);
      if (!item) return;

      const originalQty = parseFloat(item.quantity as any);
      const newVal = value === '' ? 0 : parseFloat(value);

      if (newVal > originalQty) {
        showToast.error("Can't exceed original quantity");
        return;
      }

      const otherVal = originalQty - newVal;

      setDistributions(prev => ({
        ...prev,
        [productId]:
          targetOrder === 'q1'
            ? { q1: value, q2: otherVal >= 0 ? otherVal.toString() : '0' }
            : { q1: otherVal >= 0 ? otherVal.toString() : '0', q2: value },
      }));
    },
    [originalOrder, products]
  );

  const handleAssignGroupToOrder = useCallback(
    (group: MasterProductGroup, targetOrder: 1 | 2) => {
      const newDistributions = { ...distributions };

      group.products.forEach(p => {
        const originalQty = parseFloat(p.quantity as any) || 0;
        const availableQty = p.availableQty;

        if (targetOrder === 1) {
          // Assign as much as available stock allows to the Dispatch order
          const dispatchQty = Math.min(originalQty, availableQty);
          const balanceQty = originalQty - dispatchQty;
          newDistributions[p.productId] = {
            q1: dispatchQty.toString(),
            q2: balanceQty.toString(),
          };
        } else {
          newDistributions[p.productId] = {
            q1: '0',
            q2: originalQty.toString(),
          };
        }
      });

      setDistributions(newDistributions);
    },
    [distributions]
  );

  // Calculate summary
  const orderSummaries = useMemo(() => {
    let order1Items = 0,
      order1Qty = 0,
      order1Amount = 0;
    let order2Items = 0,
      order2Qty = 0,
      order2Amount = 0;

    Object.entries(distributions).forEach(([pid, dist]) => {
      const q1 = parseFloat(dist.q1 || '0');
      const q2 = parseFloat(dist.q2 || '0');
      const item = originalOrder?.orderDetails.find(d => d.productId === Number(pid));
      const unitPrice = item?.unitPrice || 0;

      if (q1 > 0) {
        order1Items++;
        order1Qty += q1;
        order1Amount += q1 * unitPrice;
      }
      if (q2 > 0) {
        order2Items++;
        order2Qty += q2;
        order2Amount += q2 * unitPrice;
      }
    });

    return { order1Items, order1Qty, order1Amount, order2Items, order2Qty, order2Amount };
  }, [distributions, originalOrder]);

  const validateSplit = () => {
    if (orderSummaries.order1Items === 0) {
      showToast.error('Dispatch Order must have at least one item');
      return false;
    }

    const totalOriginalQty =
      originalOrder?.orderDetails.reduce(
        (sum, d) => sum + (parseFloat(d.quantity as any) || 0),
        0
      ) || 0;

    if (orderSummaries.order1Qty <= 0) {
      showToast.error('Dispatch quantity must be greater than 0');
      return false;
    }
    if (orderSummaries.order1Qty >= totalOriginalQty) {
      showToast.error(
        'Dispatch quantity must be less than the total ordered quantity — splitting the full quantity is not required'
      );
      return false;
    }

    // Quantity conservation: per product, Dispatch + Balance must equal the original
    // quantity. Preference mode does not cap the entry against the original quantity, so
    // without this a value above the original would silently create quantity that was never
    // ordered. The server re-checks this independently.
    for (const item of originalOrder?.orderDetails || []) {
      const dist = distributions[item.productId];
      const originalQty = parseFloat(item.quantity as any) || 0;
      const q1 = parseFloat(dist?.q1 || '0') || 0;
      const q2 = parseFloat(dist?.q2 || '0') || 0;
      if (Math.abs(originalQty - (q1 + q2)) > 0.0001) {
        showToast.error(
          `Quantity mismatch for ${item.productName || `product ${item.productId}`}: ` +
            `${q1} + ${q2} must equal the ordered quantity ${originalQty}`
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateSplit() || !originalOrder || !selectedOrderId) return;

    try {
      setSubmitting(true);

      const order1Items: any[] = [];
      const order2Items: any[] = [];

      for (const item of originalOrder.orderDetails) {
        const dist = distributions[item.productId];
        const q1 = parseFloat(dist.q1 || '0');
        const q2 = parseFloat(dist.q2 || '0');

        // Carry the parent line's unit price AND discount onto each child line. The server
        // recomputes each child's total from its own quantities using the existing order
        // calculation (qty × unitPrice × (1 - discount/100)), so dropping the discount here
        // would inflate both children and break "Dispatch + Balance = Parent".
        if (q1 > 0) {
          order1Items.push({
            productId: item.productId,
            quantity: q1,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
          });
        }
        if (q2 > 0) {
          order2Items.push({
            productId: item.productId,
            quantity: q2,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
          });
        }
      }

      const payload: any = {
        order1: {
          billNo: '',
          // Dispatch portion gets the "-A" suffix on the parent's own order number
          // (e.g. ORD-2026-07-0034-A), falling back to the internal id only for legacy
          // orders that never received a formatted order number.
          orderNumber: `${originalOrder.orderNumber || originalOrder.orderId}-A`,
          customerId: originalOrder.customerId,
          salespersonId: originalOrder.salespersonId || 0,
          orderDetails: order1Items,
          remarks: remark
            ? `${remark} - Split from Order #${originalOrder.orderId}`
            : `Split from Order #${originalOrder.orderId}`,
        },
      };

      if (order2Items.length > 0) {
        payload.order2 = {
          billNo: '',
          // Balance portion always gets the "-B" suffix on the parent's own order number.
          orderNumber: `${originalOrder.orderNumber || originalOrder.orderId}-B`,
          customerId: originalOrder.customerId,
          salespersonId: originalOrder.salespersonId || 0,
          orderDetails: order2Items,
          remarks: `Split from Order #${originalOrder.orderId} (Balance)`,
        };
      }

      await splitOrdersApi.split(selectedOrderId, payload);
      handleSuccess();
    } catch (error: any) {
      console.error('Split failed:', error);
      showToast.error(error.response?.data?.message || 'Failed to split order');
    } finally {
      setSubmitting(false);
    }
  };

  const adjustQty = (productId: number, delta: number) => {
    const currentDist = distributions[productId];
    const currentQ1 = parseFloat(currentDist?.q1 || '0');
    const newVal = Math.max(0, currentQ1 + delta);
    handleRevisedQtyChange(productId, newVal.toString(), 'q1');
  };

  // ===== RENDER =====
  return (
    <div className="w-full min-h-screen bg-[var(--background)] py-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4">
        {/* Page Header */}
        <PageHeader metadataPath="/operations/split-order"
          title="Split Orders"
          description="Divide orders based on stock availability"
          showBackButton={true}
        />

        {/* Split Form (Inline - Above Table) */}
        {selectedOrderId && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
            {loading ? (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-8 flex items-center justify-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
                <span className="text-[var(--text-secondary)]">Loading order details...</span>
              </div>
            ) : originalOrder ? (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-lg">
                {/* Form Header */}
                <div className="px-6 py-4 bg-[var(--primary)] text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Split className="w-5 h-5" />
                    <div>
                      <h2 className="text-lg font-bold">Split Order #{originalOrder.orderId}</h2>
                      <p className="text-white/80 text-sm">
                        {decodeHtml(originalOrder.companyName) || 'No Company'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseForm}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Order Info Bar */}
                <div className="px-6 py-3 bg-[var(--surface-secondary)] border-b border-[var(--border)] flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <FileText className="w-4 h-4" />
                    <span>Bill: {originalOrder.billNo || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {originalOrder.expectedDeliveryDate
                        ? new Date(originalOrder.expectedDeliveryDate).toLocaleDateString()
                        : 'Not Scheduled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">
                      {decodeHtml(originalOrder.deliveryAddress) || 'No location'}
                    </span>
                  </div>
                </div>

                {/* Form Content */}
                <div className="p-6">
                  {/* Split Product Header */}
                  <div className="mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[var(--primary)]" />
                    <h3 className="font-semibold text-[var(--text-primary)]">Split Product</h3>
                    <span className="text-xs text-[var(--text-secondary)] font-normal">
                      — adjust quantities per item, or assign a whole product group at once
                    </span>
                  </div>

                  {/* Products by Master Product Group */}
                  <div className="space-y-3 mb-5">
                    {masterProductGroups.map(group => (
                      <div
                        key={group.masterProductId}
                        className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden"
                      >
                        {/* Group Header */}
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1.5 rounded ${group.totalAvailable >= group.totalOrdered
                                ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                : 'bg-[var(--warning)]/10 text-[var(--warning)]'
                                }`}
                            >
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-medium text-[var(--text-primary)] text-sm">
                                {decodeHtml(group.masterProductName)}
                              </h4>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {group.products.length} SKU • Ord: {group.totalOrdered} • Avail:{' '}
                                <span
                                  className={
                                    group.totalAvailable >= group.totalOrdered
                                      ? 'text-[var(--success)]'
                                      : 'text-[var(--danger)]'
                                  }
                                >
                                  {group.totalAvailable}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAssignGroupToOrder(group, 1)}
                              title="Assign whole group to Dispatch Order"
                              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${group.isFullyAssignedToOrder1
                                ? 'bg-[var(--success)] text-white'
                                : 'bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20'
                                }`}
                            >
                              <TrendingUp className="w-4 h-4" />
                              Dispatch
                            </button>
                            <button
                              onClick={() => handleAssignGroupToOrder(group, 2)}
                              title="Assign whole group to Balance Order"
                              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${group.isFullyAssignedToOrder2
                                ? 'bg-[var(--warning)] text-white'
                                : 'bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20'
                                }`}
                            >
                              <Package className="w-4 h-4" />
                              Balance
                            </button>
                          </div>
                        </div>

                        {/* Products List — always shown, no collapse */}
                        <div className="border-t border-[var(--border)]">
                            {group.products.map((product, idx) => {
                              const dist = distributions[product.productId] || { q1: '0', q2: '0' };
                              const orderedQty = parseFloat(product.quantity as any) || 0;
                              const q1 = parseFloat(dist.q1 || '0');
                              const q2 = parseFloat(dist.q2 || '0');
                              const productInfo = products[product.productId];

                              return (
                                <div
                                  key={product.productId}
                                  className={`p-3 flex items-center gap-3 ${idx !== group.products.length - 1
                                    ? 'border-b border-[var(--border)]/50'
                                    : ''
                                    }`}
                                >
                                  {/* Product Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-[var(--text-primary)] text-sm truncate">
                                        {decodeHtml(productInfo?.ProductName) ||
                                          `Product #${product.productId}`}
                                      </span>
                                      {product.isShort && (
                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--danger)]/10 text-[var(--danger)] text-xs rounded">
                                          <AlertTriangle className="w-2.5 h-2.5" />
                                          Low
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-secondary)]">
                                      <span>Ord: {orderedQty}</span>
                                      <span
                                        className={
                                          product.isShort
                                            ? 'text-[var(--danger)]'
                                            : 'text-[var(--success)]'
                                        }
                                      >
                                        Avail: {product.availableQty}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Quantity Controls */}
                                  <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-[var(--success)] font-medium mb-0.5">
                                        Dispatch
                                      </span>
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          onClick={() => adjustQty(product.productId, -1)}
                                          className="p-1 rounded bg-[var(--surface-secondary)] hover:bg-[var(--border)] transition-colors"
                                          disabled={q1 <= 0}
                                        >
                                          <Minus className="w-3 h-3 text-[var(--text-secondary)]" />
                                        </button>
                                        <input
                                          type="text"
                                          value={dist.q1}
                                          onChange={e =>
                                            handleRevisedQtyChange(
                                              product.productId,
                                              e.target.value,
                                              'q1'
                                            )
                                          }
                                          className={`w-12 px-1.5 py-1 text-center text-sm font-semibold rounded focus:outline-none focus:ring-1 ${q1 > product.availableQty
                                            ? 'bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] focus:ring-[var(--danger)]/50'
                                            : 'bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] focus:ring-[var(--success)]/50'
                                            }`}
                                        />
                                        <button
                                          onClick={() => adjustQty(product.productId, 1)}
                                          className="p-1 rounded bg-[var(--surface-secondary)] hover:bg-[var(--border)] transition-colors"
                                          disabled={q1 >= Math.min(orderedQty, product.availableQty)}
                                        >
                                          <Plus className="w-3 h-3 text-[var(--text-secondary)]" />
                                        </button>
                                      </div>
                                    </div>

                                    <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)]" />

                                    <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-[var(--warning)] font-medium mb-0.5">
                                        Balance
                                      </span>
                                      <div className="w-12 px-1.5 py-1 text-center text-sm font-semibold bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded text-[var(--warning)]">
                                        {q2}
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end ml-1 min-w-[60px]">
                                      <span className="text-[10px] text-[var(--text-tertiary)]">
                                        Amt
                                      </span>
                                      <span className="font-semibold text-sm text-[var(--text-primary)]">
                                        ₹{(q1 * product.unitPrice).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-4 bg-[var(--success)]/5 rounded-lg border border-[var(--success)]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded bg-[var(--success)] text-white flex items-center justify-center font-bold text-xs">
                          1
                        </div>
                        <span className="font-semibold text-[var(--text-primary)] text-sm">
                          Dispatch Order
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                        <div className="flex justify-between">
                          <span>Items</span>
                          <span className="font-medium">{orderSummaries.order1Items}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Qty</span>
                          <span className="font-medium">{orderSummaries.order1Qty}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-[var(--success)]/20">
                          <span className="font-medium">Total</span>
                          <span className="font-bold text-[var(--success)]">
                            ₹{orderSummaries.order1Amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--warning)]/5 rounded-lg border border-[var(--warning)]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded bg-[var(--warning)] text-white flex items-center justify-center font-bold text-xs">
                          2
                        </div>
                        <span className="font-semibold text-[var(--text-primary)] text-sm">
                          Balance Order
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                        <div className="flex justify-between">
                          <span>Items</span>
                          <span className="font-medium">{orderSummaries.order2Items}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Qty</span>
                          <span className="font-medium">{orderSummaries.order2Qty}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-[var(--warning)]/20">
                          <span className="font-medium">Total</span>
                          <span className="font-bold text-[var(--warning)]">
                            ₹{orderSummaries.order2Amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Remark */}
                  <div className="mb-5">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={remark}
                      onChange={e => setRemark(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none rounded-lg text-sm transition-all"
                      placeholder="Add remarks..."
                    />
                  </div>

                  {/* Note */}
                  <div className="text-xs text-[var(--text-secondary)] bg-[var(--warning)]/5 p-3 rounded-lg border border-[var(--warning)]/20 mb-5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
                    <span>
                      Both split orders will go to Admin for approval. The original order will be
                      marked as Split.
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleCloseForm}
                      disabled={submitting}
                      className="px-5 py-2 bg-[var(--surface-secondary)] text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-all rounded-lg text-sm border border-[var(--border)]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || orderSummaries.order1Items === 0}
                      className="px-5 py-2 bg-[var(--primary)] text-white font-medium shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-lg text-sm flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Splitting...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Confirm Split
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Info Card */}
        {!selectedOrderId && (
          <div className="mb-5 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--primary)] mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-[var(--text-primary)] mb-1">How Split Works</p>
                <p className="text-[var(--text-secondary)]">
                  Click on any order below to split it into two parts: one for immediate dispatch
                  (based on available stock) and one as balance order.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              Accepted Orders ({pendingOrders.length})
            </h3>
          </div>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
            <DataTable
              columns={pendingOrdersColumns}
              data={pendingOrders}
              searchPlaceholder="Search by order ID, company, or bill no..."
              defaultPageSize={10}
              showToolbar={true}
              showPagination={true}
              onRowClick={row => handleOrderSelect(row.original.orderId)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplitOrderPage;
