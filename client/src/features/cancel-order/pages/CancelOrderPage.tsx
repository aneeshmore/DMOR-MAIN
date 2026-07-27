import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, XCircle, ClipboardList, TrendingDown, Calendar, Search } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { CancelOrderTable } from '../components/CancelOrderTable';
import { cancelOrderApi } from '../cancelOrderApi';
import { CancelOrderRecord } from '../types';
import { showToast } from '@/utils/toast';
import { isSameDay, isSameMonth, parseISO } from 'date-fns';

type TabType = 'cancellable' | 'cancelled';
type DateFilterType = 'all' | 'today' | 'month';

export const CancelOrderPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('cancellable');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellableOrders, setCancellableOrders] = useState<CancelOrderRecord[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<CancelOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCancellable: 0,
    totalCancelled: 0,
    cancelledToday: 0,
    cancelledThisMonth: 0,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cancellable, cancelled, statsData] = await Promise.all([
        cancelOrderApi.getCancellableOrders(),
        cancelOrderApi.getCancelledOrders(),
        cancelOrderApi.getStats(),
      ]);
      setCancellableOrders(cancellable);
      setCancelledOrders(cancelled);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch cancel order data:', error);
      showToast.error('Failed to load order data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancelOrder = async (orderId: number, reason: string) => {
    try {
      await cancelOrderApi.cancelOrder({ orderId, reason });
      fetchData();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      showToast.error('Failed to cancel order');
    }
  };

  const filteredData = useMemo(() => {
    let data = activeTab === 'cancellable' ? cancellableOrders : cancelledOrders;

    // Apply Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter(order =>
      (order.orderNumber?.toString().toLowerCase().includes(query) ||
        order.orderId.toString().includes(query) ||
        (order.companyName || order.customerName)?.toLowerCase().includes(query) ||
        order.billNo?.toLowerCase().includes(query))
      );
    }

    // Apply Date Filter (Only for Cancelled Orders)
    if (activeTab === 'cancelled' && dateFilter !== 'all') {
      const now = new Date();
      data = data.filter(order => {
        if (!order.cancelledAt) return false;
        const cancelledDate = parseISO(order.cancelledAt);

        if (dateFilter === 'today') {
          return isSameDay(cancelledDate, now);
        } else if (dateFilter === 'month') {
          return isSameMonth(cancelledDate, now);
        }
        return true;
      });
    }

    return data;
  }, [activeTab, cancellableOrders, cancelledOrders, searchQuery, dateFilter]);

  const handleCardClick = (tab: TabType, filter: DateFilterType = 'all') => {
    setActiveTab(tab);
    setDateFilter(filter);
    // Reset search when switching major contexts if desired, but keeping it might be better UX
    // setSearchQuery(''); 
  };

  const getCardStyle = (isActive: boolean) => {
    return `bg-[var(--surface)] rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${isActive
        ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]'
        : 'border-[var(--border)] hover:border-[var(--primary)]/50'
      }`;
  };

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'cancellable', label: 'Cancellable Orders', count: stats.totalCancellable },
    { id: 'cancelled', label: 'Cancelled Orders', count: stats.totalCancelled },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] p-6 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader metadataPath="/operations/cancel-order"
        title="Cancel Order"
        description="Manage order cancellations and view cancelled orders"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => handleCardClick('cancellable')}
          className={getCardStyle(activeTab === 'cancellable')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.totalCancellable}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">Cancellable Orders</div>
            </div>
          </div>
        </div>
        <div
          onClick={() => handleCardClick('cancelled', 'all')}
          className={getCardStyle(activeTab === 'cancelled' && dateFilter === 'all')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.totalCancelled}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">Total Cancelled</div>
            </div>
          </div>
        </div>
        <div
          onClick={() => handleCardClick('cancelled', 'today')}
          className={getCardStyle(activeTab === 'cancelled' && dateFilter === 'today')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.cancelledToday}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">Cancelled Today</div>
            </div>
          </div>
        </div>
        <div
          onClick={() => handleCardClick('cancelled', 'month')}
          className={getCardStyle(activeTab === 'cancelled' && dateFilter === 'month')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {stats.cancelledThisMonth}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">This Month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs, Search and Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'cancelled') setDateFilter('all');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id
                    ? 'bg-[var(--primary)] text-white shadow-lg'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--primary)]'
                  }`}
              >
                {tab.label}
                <span
                  className={`px-1.5 py-0.5 rounded text-xs ${activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
            />
          </div>
        </div>

        <button
          onClick={fetchData}
          className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all shadow-sm hover:shadow-md self-end md:self-auto"
          title="Refresh Data"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="bg-transparent">
        <CancelOrderTable
          data={filteredData}
          isLoading={isLoading}
          onCancelOrder={handleCancelOrder}
          mode={activeTab}
        />
      </div>
    </div>
  );
};

export default CancelOrderPage;
