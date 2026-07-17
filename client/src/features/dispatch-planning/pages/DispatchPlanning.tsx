import { useState, useEffect, useMemo, useCallback } from 'react';
import { dispatchPlanningApi } from '../api/dispatchPlanningApi';
import { productionManagerApi } from '@/features/production-manager/api/productionManagerApi';
import { showToast } from '@/utils/toast';
import {
  Truck,
  Plus,
  Scale,
  AlertCircle,
  FileText,
  MapPin,
  Package,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  Clock,
  ShoppingCart,
  Loader2,
  Search,
} from 'lucide-react';
import { PageHeader, PriorityBadge } from '@/components/common';
import { Button } from '@/components/ui/Button';
import { decodeHtml } from '@/utils/stringUtils';

interface Vehicle {
  id: number;
  vehicleNo: string;
  model: string;
  capacity: number; // in Tons
}

// Dummy initial vehicles
const INITIAL_VEHICLES: Vehicle[] = [
  { id: 1, vehicleNo: 'MH-12-AB-1234', model: 'Tata Ace', capacity: 1.5 },
  { id: 2, vehicleNo: 'MH-14-XY-9876', model: 'Eicher Pro', capacity: 5.0 },
  { id: 3, vehicleNo: 'MH-12-CD-5555', model: 'Mahindra Bolero', capacity: 1.2 },
];

// Orders View Types
interface OrderViewItem {
  orderId: number;
  orderNumber: string;
  customerName: string;
  location?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: string;
  priorityLevel?: string;
  billNo?: string;
  products: Array<{
    productId: number;
    productName: string;
    orderedQty: number;
    availableQty: number;
    packageCapacityKg: number;
    isReady: boolean;
  }>;
  totalItems: number;
  readyItems: number;
  isFullyReady: boolean;
  readinessPercentage: number;
  totalWeightKg: number;
}

export default function DispatchPlanning() {
  // Vehicle State
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | '' | 'other'>('');
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);

  // Form State
  const [dispatchRemark, setDispatchRemark] = useState('');
  const [driverName, setDriverName] = useState('');

  // New Vehicle Form State
  const [newVehicle, setNewVehicle] = useState({ vehicleNo: '', model: '', capacity: '' });

  // Orders View State
  const [viewOrders, setViewOrders] = useState<OrderViewItem[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null);
  const [orderFilter, setOrderFilter] = useState<'all' | 'ready' | 'partial' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingViewOrders, setLoadingViewOrders] = useState(true);
  // Selected orders for dispatch (checkbox selection in Orders View)
  const [selectedViewOrderIds, setSelectedViewOrderIds] = useState<Set<number>>(new Set());
  const [isCreatingDispatch, setIsCreatingDispatch] = useState(false);

  // Fetch orders for the Orders View section
  const fetchOrdersView = useCallback(async () => {
    setLoadingViewOrders(true);
    try {
      // Get planning data which contains order IDs
      const planningData = await productionManagerApi.getPlanningDashboardData();

      // Get unique order IDs from planning data
      const orderIds = new Set<number>();
      planningData.forEach((item: { orderIds?: number[] }) => {
        item.orderIds?.forEach((id: number) => orderIds.add(id));
      });

      // Fetch details for each order
      const orderPromises = Array.from(orderIds).map(async orderId => {
        try {
          const orderData = await productionManagerApi.getOrderDetails(orderId);
          if (!orderData || !orderData.order) return null;

          const products = orderData.details.map(
            (d: {
              orderDetail: { productId: number; quantity: number };
              product: {
                productId: number;
                productName: string;
                availableQuantity: string;
                reservedQuantity: string;
                packageCapacityKg?: string;
              };
            }) => {
              // Use availableQuantity directly - NO reservation happens until Create Dispatch is clicked
              // This allows multiple orders to show as 100% ready if total available covers each individual order
              // The client-side virtual stock calculation handles showing reduced availability when orders are selected
              const availableQty = Math.max(0, parseFloat(d.product.availableQuantity) || 0);
              const orderedQty = d.orderDetail.quantity;
              const packageCapacityKg = parseFloat(d.product.packageCapacityKg || '0') || 0;

              // Check if available stock covers the ordered quantity
              const isReady = availableQty >= orderedQty;

              return {
                productId: d.orderDetail.productId,
                productName: decodeHtml(d.product.productName),
                orderedQty,
                availableQty,
                packageCapacityKg,
                isReady,
              };
            }
          );

          const readyItems = products.filter((p: { isReady: boolean }) => p.isReady).length;
          const totalItems = products.length;
          const isFullyReady = readyItems === totalItems && totalItems > 0;
          const readinessPercentage =
            totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 0;

          const totalWeightKg = products.reduce(
            (sum: number, p: { packageCapacityKg: number; orderedQty: number }) =>
              sum + p.packageCapacityKg * p.orderedQty,
            0
          );

          return {
            orderId,
            orderNumber: orderData.order.orderNumber,
            customerName:
              decodeHtml(
                orderData.customer?.companyName ||
                orderData.customer?.contactPerson
              ) || 'Unknown Customer',
            location:
              decodeHtml(orderData.customer?.area || orderData.customer?.city) || '',
            orderDate: orderData.order.orderDate,
            expectedDeliveryDate: orderData.order.expectedDeliveryDate,
            status: orderData.order.status,
            priorityLevel: orderData.order.priorityLevel,
            billNo: orderData.account?.billNo || '',
            products,
            totalItems,
            readyItems,
            isFullyReady,
            readinessPercentage,
            totalWeightKg,
          };
        } catch {
          return null;
        }
      });

      const orderResults: OrderViewItem[] = (await Promise.all(orderPromises)).flatMap(o =>
        o ? [o] : []
      );

      // Sort: Ready orders first, then by readiness percentage, then by date
      orderResults.sort((a, b) => {
        if (a.isFullyReady !== b.isFullyReady) return a.isFullyReady ? -1 : 1;
        if (a.readinessPercentage !== b.readinessPercentage)
          return b.readinessPercentage - a.readinessPercentage;
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      });

      setViewOrders(orderResults);
    } catch {
      console.error('Failed to fetch order details for view');
    } finally {
      setLoadingViewOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdersView();
  }, [fetchOrdersView]);

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.vehicleNo || !newVehicle.capacity) {
      showToast.error('Vehicle No and Capacity are required');
      return;
    }
    const v: Vehicle = {
      id: Date.now(),
      vehicleNo: newVehicle.vehicleNo,
      model: newVehicle.model,
      capacity: parseFloat(newVehicle.capacity),
    };
    setVehicles(prev => [...prev, v]);
    setSelectedVehicleId(v.id);
    setShowAddVehicleModal(false);
    setNewVehicle({ vehicleNo: '', model: '', capacity: '' });
    showToast.success('Vehicle added successfully');
  };

  const handleCreateDispatch = async () => {
    if (!selectedVehicleId) return;

    // Get selected orders from Orders View
    const selectedOrderIds = Array.from(selectedViewOrderIds);

    if (selectedOrderIds.length === 0) {
      showToast.error('Please select at least one order');
      return;
    }

    const vehicle =
      selectedVehicleId === 'other'
        ? { vehicleNo: 'Customer Pickup', model: 'N/A', capacity: 0 }
        : vehicles.find(v => v.id === selectedVehicleId);
    if (!vehicle) return;

    // Skip overload check for customer pickup
    if (!isCustomerPickup && isOverloaded) {
      if (!window.confirm('Warning: Vehicle is overloaded! Do you want to proceed?')) {
        return;
      }
    }

    // Validate that selected orders don't exceed available stock
    // This uses the client-side virtual stock calculation
    const selectedOrderData = ordersWithDynamicStock.filter(o =>
      selectedViewOrderIds.has(o.orderId)
    );

    // Check if any selected order has items that are not ready (after virtual consumption)
    for (const order of selectedOrderData) {
      if (!order.isFullyReady) {
        showToast.error(
          `Order ${order.orderNumber} has insufficient stock. Please uncheck and reselect.`
        );
        return;
      }
    }

    try {
      setIsCreatingDispatch(true);
      // Stock is deducted when dispatch is created on the server
      // No prior reservation needed - createDispatch API handles inventory deduction
      await dispatchPlanningApi.createDispatch({
        vehicleNo: vehicle.vehicleNo,
        vehicleModel: vehicle.model,
        capacity: vehicle.capacity,
        driverName: driverName,
        remarks: dispatchRemark,
        orderIds: selectedOrderIds,
      });

      showToast.success('Dispatch created successfully');
      setDispatchRemark('');
      setDriverName('');
      setSelectedViewOrderIds(new Set()); // Clear selections
      fetchOrdersView(); // Refresh orders view
    } catch (error) {
      console.error(error);
      showToast.error('Failed to create dispatch');
    } finally {
      setIsCreatingDispatch(false);
    }
  };

  // Orders View - Toggle expand/collapse
  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const selectedVehicle =
    selectedVehicleId !== 'other' ? vehicles.find(v => v.id === selectedVehicleId) : null;
  const isCustomerPickup = selectedVehicleId === 'other';
  const capacity = selectedVehicle?.capacity || 0;

  // Dynamic stock calculation - CLIENT-SIDE ONLY (no database changes)
  // This calculates how much stock is "virtually consumed" by selected orders
  // to show other orders whether they can still be loaded
  const ordersWithDynamicStock = useMemo(() => {
    // Calculate how much stock is "virtually consumed" by selected orders
    const virtuallyConsumed: Record<number, number> = {};

    viewOrders.forEach(order => {
      if (selectedViewOrderIds.has(order.orderId)) {
        order.products.forEach(p => {
          virtuallyConsumed[p.productId] = (virtuallyConsumed[p.productId] || 0) + p.orderedQty;
        });
      }
    });

    // Recalculate each order's readiness with remaining stock
    return viewOrders.map(order => {
      // For selected orders, keep their original readiness (they have their stock "claimed")
      if (selectedViewOrderIds.has(order.orderId)) {
        return order;
      }

      // For non-selected orders, recalculate based on remaining stock
      const updatedProducts = order.products.map(p => {
        const consumed = virtuallyConsumed[p.productId] || 0;
        const remainingStock = Math.max(0, p.availableQty - consumed);
        const isReady = remainingStock >= p.orderedQty;
        return { ...p, availableQty: remainingStock, isReady };
      });

      const readyItems = updatedProducts.filter(p => p.isReady).length;
      const totalItems = updatedProducts.length;
      const isFullyReady = readyItems === totalItems && totalItems > 0;
      const readinessPercentage = totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 0;

      return {
        ...order,
        products: updatedProducts,
        readyItems,
        isFullyReady,
        readinessPercentage,
      };
    });
  }, [viewOrders, selectedViewOrderIds]);

  // Orders View - Filtered orders (uses dynamic stock orders)
  const filteredViewOrders = useMemo(() => {
    let result = ordersWithDynamicStock;

    // Apply status filter
    if (orderFilter === 'ready') {
      result = result.filter(o => o.isFullyReady);
    } else if (orderFilter === 'partial') {
      result = result.filter(o => !o.isFullyReady && o.readinessPercentage > 0);
    } else if (orderFilter === 'pending') {
      result = result.filter(o => o.readinessPercentage === 0);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      result = result.filter(order =>
        order.orderNumber.toLowerCase().includes(searchLower) ||
        order.customerName.toLowerCase().includes(searchLower) ||
        (order.location && order.location.toLowerCase().includes(searchLower)) ||
        (order.billNo && order.billNo.toLowerCase().includes(searchLower)) ||
        order.products.some(p => p.productName.toLowerCase().includes(searchLower))
      );
    }

    return result;
  }, [ordersWithDynamicStock, orderFilter, searchTerm]);

  // Orders View - Stats (uses dynamic stock orders)
  const orderStats = useMemo(() => {
    const readyOrders = ordersWithDynamicStock.filter(o => o.isFullyReady).length;
    const partialOrders = ordersWithDynamicStock.filter(
      o => !o.isFullyReady && o.readinessPercentage > 0
    ).length;
    const pendingOrders = ordersWithDynamicStock.filter(o => o.readinessPercentage === 0).length;

    return {
      totalOrders: ordersWithDynamicStock.length,
      readyOrders,
      partialOrders,
      pendingOrders,
    };
  }, [ordersWithDynamicStock]);

  // Toggle order selection in Orders View - CLIENT-SIDE ONLY (no API calls)
  // Stock is only reserved when "Create Dispatch" button is clicked
  const toggleViewOrderSelection = (orderId: number) => {
    setSelectedViewOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Get selected orders from Orders View for dispatch
  const selectedViewOrders = useMemo(
    () => ordersWithDynamicStock.filter(o => selectedViewOrderIds.has(o.orderId)),
    [ordersWithDynamicStock, selectedViewOrderIds]
  );

  // Calculate total weight of selected Orders View orders (in kg)
  const totalWeightKg = useMemo(
    () => selectedViewOrders.reduce((sum, o) => sum + o.totalWeightKg, 0),
    [selectedViewOrders]
  );

  // Capacity calculations (convert capacity from tons to kg for comparison)
  const capacityKg = capacity * 1000;
  const remainingCapacityKg = capacityKg - totalWeightKg;
  const isOverloaded = remainingCapacityKg < 0;

  // Orders View - Dispatch individual order
  const handleDispatchViewOrder = async (orderId: number, orderNumber: string) => {
    setDispatchingOrder(orderId);
    try {
      await productionManagerApi.sendToDispatch(orderId);
      showToast.success(`Order ${orderNumber} sent to dispatch!`);

      // Refresh view
      fetchOrdersView();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      showToast.error(err.response?.data?.message || 'Failed to dispatch order');
    } finally {
      setDispatchingOrder(null);
    }
  };

  if (loadingViewOrders)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full"></div>
      </div>
    );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-6">
      <PageHeader
        title="Dispatch Planning"
        description="Select orders and assign to vehicles for dispatch"
      />

      {/* Vehicle Selection & Form Section */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-6 animate-in fade-in duration-300">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Vehicle Selection and Form */}
          <div className="space-y-4">
            {/* Vehicle Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Select Vehicle
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none bg-[var(--surface)] text-[var(--text-primary)] transition-colors"
                  value={selectedVehicleId}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'other') {
                      setSelectedVehicleId('other');
                    } else if (val === '') {
                      setSelectedVehicleId('');
                    } else {
                      setSelectedVehicleId(Number(val));
                    }
                  }}
                >
                  <option value="">-- Select a vehicle --</option>
                  <option value="other" className="font-medium text-[var(--primary)]">
                    🚶 Other (Customer Pickup)
                  </option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {decodeHtml(v.vehicleNo)} - {decodeHtml(v.model)} ({v.capacity} T)
                    </option>
                  ))}
                </select>
                <button
                  className="px-4 py-2.5 border border-[var(--border)] rounded-lg flex items-center gap-2 text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all font-medium"
                  onClick={() => setShowAddVehicleModal(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add Vehicle
                </button>
              </div>
            </div>

            {/* Driver Name Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Driver Name
              </label>
              <input
                type="text"
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none bg-[var(--surface)] text-[var(--text-primary)] transition-colors"
                placeholder="Enter driver name"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
              />
            </div>

            {/* Remarks Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Dispatch Remark
              </label>
              <input
                type="text"
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none bg-[var(--surface)] text-[var(--text-primary)] transition-colors"
                placeholder="Enter remarks here..."
                value={dispatchRemark}
                onChange={e => setDispatchRemark(e.target.value)}
              />
            </div>
          </div>

          {/* Right Column: Capacity Display */}
          <div className="h-full">
            {selectedVehicle ? (
              <div
                className={`h-full p-6 rounded-xl border transition-all duration-300 ${isOverloaded
                  ? 'bg-[var(--danger)]/5 border-[var(--danger)]/20'
                  : 'bg-[var(--success)]/5 border-[var(--success)]/20'
                  }`}
              >
                <div className="flex flex-col h-full justify-between space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Scale
                          className={
                            isOverloaded ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                          }
                        />
                        Vehicle Capacity
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Load Status Monitor
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                        {capacity}{' '}
                        <span className="text-lg text-[var(--text-secondary)] font-medium">
                          Tons
                        </span>
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mt-1 opacity-70">
                        Total Capacity
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-[var(--text-secondary)]">Current Load</span>
                      <span className="text-[var(--text-primary)] font-mono">
                        {totalWeightKg.toFixed(2)} kg
                      </span>
                    </div>
                    {selectedViewOrders.length > 0 && (
                      <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                        <span>Selected: {selectedViewOrders.length} orders</span>
                        <span>{totalWeightKg.toFixed(2)} kg</span>
                      </div>
                    )}
                    <div className="w-full bg-[var(--border)] rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isOverloaded ? 'bg-[var(--danger)] animate-pulse' : 'bg-[var(--success)]'
                          }`}
                        style={{
                          width: `${Math.min((totalWeightKg / capacityKg) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border text-center font-bold text-lg ${isOverloaded
                      ? 'bg-[var(--surface)] border-[var(--danger)]/30 text-[var(--danger)]'
                      : 'bg-[var(--surface)] border-[var(--success)]/30 text-[var(--success)]'
                      }`}
                  >
                    {isOverloaded ? (
                      <span className="flex items-center justify-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Overloaded by {Math.abs(remainingCapacityKg).toFixed(2)} kg
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Truck className="w-5 h-5" />
                        {remainingCapacityKg.toFixed(2)} kg Remaining
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : isCustomerPickup ? (
              // Customer Pickup - Show simplified total weight UI
              <div className="h-full p-6 rounded-xl border transition-all duration-300 bg-[var(--primary)]/5 border-[var(--primary)]/20">
                <div className="flex flex-col h-full justify-between space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <User className="w-5 h-5 text-[var(--primary)]" />
                        Customer Pickup
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Customer collects order directly
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-[var(--text-secondary)]">Total Weight</span>
                      <span className="text-[var(--text-primary)] font-mono">
                        {totalWeightKg.toFixed(2)} kg
                      </span>
                    </div>
                    {selectedViewOrders.length > 0 && (
                      <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                        <span>Selected: {selectedViewOrders.length} orders</span>
                        <span>{totalWeightKg.toFixed(2)} kg</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border text-center font-bold text-lg bg-[var(--surface)] border-[var(--primary)]/30 text-[var(--primary)]">
                    <span className="flex items-center justify-center gap-2">
                      <Package className="w-5 h-5" />
                      Ready for Pickup
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[200px] flex items-center justify-center border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                <div className="text-center p-4">
                  <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Select a vehicle first</p>
                  <p className="text-sm opacity-70">Capacity details will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center pt-2 border-t border-[var(--border)] pt-6">
          <Button
            onClick={handleCreateDispatch}
            disabled={selectedViewOrders.length === 0 || !selectedVehicleId || isCreatingDispatch}
            className="px-8 py-2.5 bg-[var(--success)] hover:bg-[var(--success)]/90 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isCreatingDispatch ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </span>
            ) : (
              `Create Dispatch Plan (${selectedViewOrders.length} orders)`
            )}
          </Button>
        </div>
      </div>

      {/* Orders View Section (moved from PM Dashboard) */}
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between px-2 mt-8 mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[var(--primary)]" />
              Orders View
            </h2>
            <span className="bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold px-2 py-1 rounded-md border border-[var(--primary)]/20">
              {orderStats.totalOrders} Orders
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none text-sm w-64"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--surface-secondary)] rounded-lg">
            <button
              onClick={() => setOrderFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${orderFilter === 'all'
                ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              All ({orderStats.totalOrders})
            </button>
            <button
              onClick={() => setOrderFilter('ready')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${orderFilter === 'ready'
                ? 'bg-[var(--success)]/20 text-[var(--success)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready ({orderStats.readyOrders})
            </button>
            <button
              onClick={() => setOrderFilter('partial')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${orderFilter === 'partial'
                ? 'bg-[var(--warning)]/20 text-[var(--warning)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Partial ({orderStats.partialOrders})
            </button>
            <button
              onClick={() => setOrderFilter('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${orderFilter === 'pending'
                ? 'bg-[var(--danger)]/20 text-[var(--danger)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Pending ({orderStats.pendingOrders})
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOrdersView}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>

        {/* Orders List */}
        {loadingViewOrders ? (
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-[var(--primary)] animate-spin mb-3" />
            <p className="text-[var(--text-secondary)]">Loading order details...</p>
          </div>
        ) : filteredViewOrders.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-12 text-center">
            <ShoppingCart className="w-14 h-14 mx-auto text-[var(--text-tertiary)] opacity-40 mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              No orders found
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              {orderFilter === 'ready'
                ? 'No orders are ready for dispatch yet.'
                : orderFilter === 'partial'
                  ? 'No orders have partial stock available.'
                  : orderFilter === 'pending'
                    ? 'No orders are pending production.'
                    : 'No orders in the system.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredViewOrders.map(order => (
              <OrderViewCard
                key={order.orderId}
                order={order}
                isExpanded={expandedOrders.has(order.orderId)}
                isSelected={selectedViewOrderIds.has(order.orderId)}
                canSelect={!!selectedVehicleId}
                _isDispatching={dispatchingOrder === order.orderId}
                onToggle={() => toggleOrderExpand(order.orderId)}
                _onDispatch={() => handleDispatchViewOrder(order.orderId, order.orderNumber)}
                onSelectChange={() => toggleViewOrderSelection(order.orderId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)]">Add New Vehicle</h2>
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
                  Vehicle No *
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                  value={newVehicle.vehicleNo}
                  onChange={e => setNewVehicle({ ...newVehicle, vehicleNo: e.target.value })}
                  placeholder="e.g. MH-12-AB-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
                  Model Name
                </label>
                <input
                  type="text"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                  value={newVehicle.model}
                  onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  placeholder="e.g. Tata Ace"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
                  Capacity (Tons) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                  value={newVehicle.capacity}
                  onChange={e => setNewVehicle({ ...newVehicle, capacity: e.target.value })}
                  placeholder="e.g. 1.5"
                />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
                >
                  Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// OrderViewCard Component
// ============================================================================

interface OrderViewCardProps {
  order: OrderViewItem;
  isExpanded: boolean;
  isSelected?: boolean;
  canSelect?: boolean;
  _isDispatching: boolean;
  onToggle: () => void;
  _onDispatch: () => void;
  onSelectChange?: (selected: boolean) => void;
}

function OrderViewCard({
  order,
  isExpanded,
  isSelected = false,
  canSelect = false,
  _isDispatching = false,
  _onDispatch,
  onToggle,
  onSelectChange,
}: OrderViewCardProps) {
  const getStatusColor = () => {
    if (order.isFullyReady) return 'success';
    if (order.readinessPercentage > 0) return 'warning';
    return 'danger';
  };

  const statusColor = getStatusColor();
  const borderColors = {
    success: 'border-[var(--success)]/40',
    warning: 'border-[var(--warning)]/40',
    danger: 'border-[var(--danger)]/40',
  };

  const bgColors = {
    success: 'bg-[var(--success)]/5',
    warning: 'bg-[var(--warning)]/5',
    danger: 'bg-[var(--danger)]/5',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysUntilDelivery = () => {
    if (!order.expectedDeliveryDate) return null;
    const today = new Date();
    const delivery = new Date(order.expectedDeliveryDate);
    const diff = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getDelayFromOrder = () => {
    const orderDate = new Date(order.orderDate);
    const today = new Date();
    const diff = Math.ceil((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return null;
    const days = Math.floor(diff);
    const hours = Math.floor((diff - days) * 24);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const delayText = getDelayFromOrder();
  const daysUntilDelivery = getDaysUntilDelivery();

  return (
    <div
      className={`bg-[var(--surface)] rounded-xl border-2 transition-all overflow-hidden ${isSelected
        ? 'border-[var(--primary)] shadow-lg ring-2 ring-[var(--primary)]/20'
        : isExpanded
          ? `${borderColors[statusColor]} shadow-lg`
          : 'border-[var(--border)] hover:border-[var(--border-hover)]'
        }`}
    >
      {/* Header Row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        onClick={onToggle}
      >
        {/* Expand Icon */}
        <button className="p-1 rounded hover:bg-[var(--surface-secondary)] transition-colors">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
          )}
        </button>

        {/* Readiness Progress Circle */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="28" cy="28" r="24" stroke="var(--border)" strokeWidth="4" fill="none" />
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke={`var(--${statusColor})`}
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${(order.readinessPercentage / 100) * 150.8} 150.8`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {order.readinessPercentage}%
            </span>
          </div>
        </div>

        {/* Order Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-[var(--text-primary)]">
              {order.billNo || order.orderNumber}
            </h3>
            {order.isFullyReady ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-[var(--success)]/10 text-[var(--success)] rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready For Dispatch
              </span>
            ) : order.readinessPercentage > 0 ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-[var(--warning)]/10 text-[var(--warning)] rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Partial Stock
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-[var(--danger)]/10 text-[var(--danger)] rounded-full flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Awaiting Stock
              </span>
            )}
            <PriorityBadge priority={order.priorityLevel} />
            {order.billNo && (
              <span className="px-2 py-0.5 text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] rounded-full flex items-center gap-1">
                <FileText className="w-3 h-3" /> Order: {order.orderNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-secondary)] flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> {order.customerName}
            </span>
            {order.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {order.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" /> {order.totalWeightKg.toFixed(2)} kg
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {formatDate(order.orderDate)}
            </span>
            {daysUntilDelivery !== null && (
              <span
                className={`flex items-center gap-1 ${daysUntilDelivery < 0
                  ? 'text-[var(--danger)]'
                  : daysUntilDelivery <= 2
                    ? 'text-[var(--warning)]'
                    : 'text-[var(--text-secondary)]'
                  }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {daysUntilDelivery < 0
                  ? `${Math.abs(daysUntilDelivery)} days overdue`
                  : daysUntilDelivery === 0
                    ? 'Due today'
                    : `${daysUntilDelivery} days left`}
              </span>
            )}
            {delayText && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-500/10 text-orange-500 rounded">
                {delayText}
              </span>
            )}
          </div>
        </div>

        {/* Item Count */}
        <div className="text-center px-4 border-l border-[var(--border)]">
          <p className="text-xs text-[var(--text-tertiary)] uppercase">Items</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">
            <span className="text-[var(--success)]">{order.readyItems}</span>
            <span className="text-[var(--text-tertiary)]">/</span>
            {order.totalItems}
          </p>
        </div>

        {/* Action Button */}
        <div onClick={e => e.stopPropagation()} className="pl-4 border-l border-[var(--border)]">
          {order.isFullyReady && canSelect ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={e => onSelectChange && onSelectChange(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-xs text-[var(--text-secondary)]">Load</span>
            </label>
          ) : order.isFullyReady ? (
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
              <span className="text-[10px] font-medium text-[var(--success)]">
                Ready to Dispatch
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 opacity-50">
              <AlertCircle className="w-5 h-5 text-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-tertiary)]">Not Ready</span>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={`border-t border-[var(--border)] ${bgColors[statusColor]} p-5`}>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-4">
            <Package className="w-4 h-4 text-[var(--primary)]" />
            Order Items - Stock Comparison
          </h4>

          <div className="grid grid-cols-12 gap-3 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase px-3 py-2 bg-[var(--surface)] rounded-t-lg border border-b-0 border-[var(--border)]">
            <div className="col-span-5">Product</div>
            <div className="col-span-2 text-right">Ordered</div>
            <div className="col-span-2 text-right">Available</div>
            <div className="col-span-2 text-right">Shortage</div>
            <div className="col-span-1 text-center">Status</div>
          </div>

          <div className="border border-[var(--border)] rounded-b-lg overflow-hidden">
            {order.products.map((product, idx) => {
              const shortage = Math.max(0, product.orderedQty - product.availableQty);
              return (
                <div
                  key={product.productId}
                  className={`grid grid-cols-12 gap-3 items-center px-3 py-3 ${idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-secondary)]/50'
                    } ${idx !== order.products.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                >
                  <div className="col-span-5 font-medium text-sm text-[var(--text-primary)] truncate">
                    {product.productName}
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium">
                    {product.orderedQty}
                  </div>
                  <div
                    className={`col-span-2 text-right text-sm font-medium ${product.isReady ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                      }`}
                  >
                    {product.availableQty.toFixed(2)}
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium text-[var(--danger)]">
                    {shortage > 0 ? `-${shortage.toFixed(2)}` : '-'}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {product.isReady ? (
                      <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[var(--danger)]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-[var(--success)]">
                <CheckCircle2 className="w-4 h-4" />
                {order.readyItems} items ready
              </span>
              {order.totalItems - order.readyItems > 0 && (
                <span className="flex items-center gap-1 text-[var(--danger)]">
                  <AlertCircle className="w-4 h-4" />
                  {order.totalItems - order.readyItems} items pending
                </span>
              )}
              <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                <Scale className="w-4 h-4" />
                Total: {order.totalWeightKg.toFixed(2)} kg
              </span>
            </div>

            {/* Footer Actions */}
            <div className="flex gap-2">
              {
                /* {order.isFullyReady && (
                <Button ... removed as per user request ...>
              )} */ null
              }
              {order.isFullyReady && canSelect && !isSelected && (
                <button
                  onClick={() => onSelectChange && onSelectChange(true)}
                  className="px-3 py-1.5 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90"
                >
                  Add to Vehicle
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
