import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  RefreshCw,
  Award,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  subDays,
  startOfYear,
  subYears,
} from 'date-fns';

import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { ordersApi } from '@/features/orders/api/ordersApi';
import { Order } from '@/features/orders/types';
import { showToast } from '@/utils/toast';

interface SalesPersonStats {
  salespersonId: number;
  salespersonName: string;
  totalSales: number;
  orderCount: number;
  onHoldAmount: number;
  onHoldCount: number;
  cancelledAmount: number;
  cancelledCount: number;
  avgOrderValue: number;
}

type DateRangePreset =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'last_year'
  | 'custom';

const getDateRange = (preset: DateRangePreset): { start: Date; end: Date } => {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { start: startOfMonth(now), end: now };
    case 'last_month':
      return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case 'last_3_months':
      return { start: subMonths(now, 3), end: now };
    case 'last_6_months':
      return { start: subMonths(now, 6), end: now };
    case 'this_year':
      return { start: startOfYear(now), end: now };
    case 'last_year':
      return {
        start: startOfYear(subYears(now, 1)),
        end: endOfMonth(subMonths(startOfYear(now), 1)),
      };
    default:
      return { start: subMonths(now, 1), end: now };
  }
};

// Helper function to format currency in Indian format
const formatCurrency = (amount: number, showDecimals = false): string => {
  if (amount == null || isNaN(amount)) return '0';

  const num = Number(amount);
  if (showDecimals) {
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const AdminSalesDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      // Fetch all orders (large limit to get comprehensive data)
      const data = await ordersApi.getAll({ limit: 5000, offset: 0 });
      setOrders(data || []);
      if (showRefreshToast) {
        showToast.success('Dashboard refreshed');
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      showToast.error('Failed to load sales data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Get date range based on preset or custom
  const dateRange = useMemo(() => {
    if (dateRangePreset === 'custom' && customStart && customEnd) {
      return {
        start: new Date(customStart),
        end: new Date(customEnd),
      };
    }
    return getDateRange(dateRangePreset);
  }, [dateRangePreset, customStart, customEnd]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = new Date(order.orderDate || order.createdAt);
      return orderDate >= dateRange.start && orderDate <= dateRange.end;
    });
  }, [orders, dateRange]);

  // Calculate salesperson stats
  const salesPersonStats = useMemo((): SalesPersonStats[] => {
    const statsMap = new Map<number, SalesPersonStats>();

    filteredOrders.forEach(order => {
      if (!order.salespersonId) return;

      const existing = statsMap.get(order.salespersonId) || {
        salespersonId: order.salespersonId,
        salespersonName: order.salespersonName || `Sales Person ${order.salespersonId}`,
        totalSales: 0,
        orderCount: 0,
        onHoldAmount: 0,
        onHoldCount: 0,
        cancelledAmount: 0,
        cancelledCount: 0,
        avgOrderValue: 0,
      };

      // Count based on status
      if (order.status === 'Cancelled') {
        existing.cancelledAmount += order.totalAmount || 0;
        existing.cancelledCount += 1;
      } else if (order.status === 'On Hold') {
        existing.onHoldAmount += order.totalAmount || 0;
        existing.onHoldCount += 1;
      } else if (
        [
          'Factory Approved',
          'Confirmed',
          'Scheduled for Production',
          'In Production',
          'Ready for Dispatch',
          'Dispatched',
          'Delivered',
          'Started',
          'Accepted',
        ].includes(order.status)
      ) {
        existing.totalSales += order.totalAmount || 0;
        existing.orderCount += 1;
      }

      statsMap.set(order.salespersonId, existing);
    });

    // Calculate average order value
    const result = Array.from(statsMap.values()).map(stat => ({
      ...stat,
      avgOrderValue: stat.orderCount > 0 ? stat.totalSales / stat.orderCount : 0,
    }));

    // Sort by total sales descending
    return result.sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredOrders]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalSales = salesPersonStats.reduce((sum, s) => sum + s.totalSales, 0);
    const totalOnHold = salesPersonStats.reduce((sum, s) => sum + s.onHoldAmount, 0);
    const totalCancelled = salesPersonStats.reduce((sum, s) => sum + s.cancelledAmount, 0);
    const totalOrders = salesPersonStats.reduce((sum, s) => sum + s.orderCount, 0);
    const topPerformer = salesPersonStats[0];

    return { totalSales, totalOnHold, totalCancelled, totalOrders, topPerformer };
  }, [salesPersonStats]);

  // Preset label
  const getPresetLabel = (preset: DateRangePreset): string => {
    const labels: Record<DateRangePreset, string> = {
      this_month: 'This Month',
      last_month: 'Last Month',
      last_3_months: 'Last 3 Months',
      last_6_months: 'Last 6 Months',
      this_year: 'This Year',
      last_year: 'Last Year',
      custom: 'Custom Range',
    };
    return labels[preset];
  };

  // Table columns
  const columns: ColumnDef<SalesPersonStats>[] = useMemo(
    () => [
      {
        accessorKey: 'rank',
        header: '#',
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.index === 0 ? (
              <div className="w-7 h-7 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-md">
                <Award size={14} className="text-white" />
              </div>
            ) : row.index === 1 ? (
              <div className="w-7 h-7 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-white">2</span>
              </div>
            ) : row.index === 2 ? (
              <div className="w-7 h-7 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-white">3</span>
              </div>
            ) : (
              <span className="text-[var(--text-secondary)] font-medium">{row.index + 1}</span>
            )}
          </div>
        ),
        size: 60,
      },
      {
        accessorKey: 'salespersonName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {row.original.salespersonName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">
                {row.original.salespersonName}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                {row.original.orderCount} orders
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'totalSales',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total Sales (₹)" />,
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right">
            <div className="font-bold text-lg text-green-600">
              ₹{formatCurrency(row.original.totalSales, true)}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              Avg: ₹{formatCurrency(row.original.avgOrderValue)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'onHoldAmount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="On Hold (₹)" />,
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.onHoldAmount > 0 ? (
              <>
                <div className="font-semibold text-orange-600">
                  ₹{formatCurrency(row.original.onHoldAmount, true)}
                </div>
                <div className="text-xs text-orange-500">{row.original.onHoldCount} orders</div>
              </>
            ) : (
              <span className="text-[var(--text-secondary)]">-</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'cancelledAmount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cancelled (₹)" />,
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.cancelledAmount > 0 ? (
              <>
                <div className="font-semibold text-red-600">
                  ₹{formatCurrency(row.original.cancelledAmount, true)}
                </div>
                <div className="text-xs text-red-500">{row.original.cancelledCount} orders</div>
              </>
            ) : (
              <span className="text-[var(--text-secondary)]">-</span>
            )}
          </div>
        ),
      },
      {
        id: 'performance',
        header: 'Performance',
        cell: ({ row }) => {
          const total =
            row.original.totalSales + row.original.onHoldAmount + row.original.cancelledAmount;
          const successRate = total > 0 ? (row.original.totalSales / total) * 100 : 0;
          return (
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Success Rate
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {successRate.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    successRate >= 80
                      ? 'bg-green-500'
                      : successRate >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(successRate, 100)}%` }}
                />
              </div>
            </div>
          );
        },
        size: 150,
      },
    ],
    []
  );

  return (
    <div className="container mx-auto pb-10 space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Sales Performance Dashboard"
        description="Track and analyze sales performance by salesperson"
      />

      {/* Date Range Selector */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Calendar size={18} />
            <span className="font-medium">Date Range:</span>
          </div>

          {/* Preset Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresetDropdown(!showPresetDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-highlight)] transition-colors"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {getPresetLabel(dateRangePreset)}
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${showPresetDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showPresetDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 min-w-[180px] overflow-hidden">
                {(
                  [
                    'this_month',
                    'last_month',
                    'last_3_months',
                    'last_6_months',
                    'this_year',
                    'last_year',
                    'custom',
                  ] as DateRangePreset[]
                ).map(preset => (
                  <button
                    key={preset}
                    onClick={() => {
                      setDateRangePreset(preset);
                      setShowPresetDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-[var(--surface-highlight)] transition-colors ${
                      dateRangePreset === preset
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {getPresetLabel(preset)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Date Inputs */}
          {dateRangePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[var(--text-secondary)]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Date Range Display */}
          <div className="flex-1 text-right text-sm text-[var(--text-secondary)]">
            {format(dateRange.start, 'dd MMM yyyy')} - {format(dateRange.end, 'dd MMM yyyy')}
          </div>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            leftIcon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <TrendingUp size={24} />
            </div>
            <DollarSign size={32} className="opacity-20" />
          </div>
          <div className="text-3xl font-bold mb-1">₹{formatCurrency(overallStats.totalSales)}</div>
          <div className="text-sm text-white/80">
            Total Sales ({overallStats.totalOrders} orders)
          </div>
        </div>

        {/* On Hold */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <AlertCircle size={24} />
            </div>
            <AlertCircle size={32} className="opacity-20" />
          </div>
          <div className="text-3xl font-bold mb-1">₹{formatCurrency(overallStats.totalOnHold)}</div>
          <div className="text-sm text-white/80">On Hold Amount</div>
        </div>

        {/* Cancelled */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <TrendingDown size={24} />
            </div>
            <TrendingDown size={32} className="opacity-20" />
          </div>
          <div className="text-3xl font-bold mb-1">
            ₹{formatCurrency(overallStats.totalCancelled)}
          </div>
          <div className="text-sm text-white/80">Cancelled Orders</div>
        </div>

        {/* Top Performer */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Award size={24} />
            </div>
            <Users size={32} className="opacity-20" />
          </div>
          <div className="text-xl font-bold mb-1 truncate">
            {overallStats.topPerformer?.salespersonName || 'N/A'}
          </div>
          <div className="text-sm text-white/80">
            Top Performer • ₹{formatCurrency(overallStats.topPerformer?.totalSales || 0)}
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border)] bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Sales Person Performance
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {salesPersonStats.length} sales persons • {getPresetLabel(dateRangePreset)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>Completed</span>
              <div className="w-3 h-3 bg-orange-500 rounded-full ml-3" />
              <span>On Hold</span>
              <div className="w-3 h-3 bg-red-500 rounded-full ml-3" />
              <span>Cancelled</span>
            </div>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[var(--text-secondary)]">Loading sales data...</p>
            </div>
          ) : salesPersonStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users size={48} className="text-[var(--text-secondary)] mb-4 opacity-50" />
              <p className="text-[var(--text-secondary)] text-lg">No sales data found</p>
              <p className="text-sm text-[var(--text-secondary)]">Try adjusting the date range</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={salesPersonStats}
              searchPlaceholder="Search sales person..."
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSalesDashboard;
