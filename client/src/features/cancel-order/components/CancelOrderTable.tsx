import React, { useState, useMemo } from 'react';
import {
  XCircle,
  ChevronDown,
  ChevronUp,
  Package,
  Building2,
  Calendar,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { CancelOrderRecord } from '../types';
import { format } from 'date-fns';
import { decodeHtml } from '@/utils/stringUtils';
import { showToast } from '@/utils/toast';

interface CancelOrderTableProps {
  data: CancelOrderRecord[];
  isLoading: boolean;
  onCancelOrder: (orderId: number, reason: string) => void;
  mode: 'cancellable' | 'cancelled';
}

export const CancelOrderTable: React.FC<CancelOrderTableProps> = ({
  data,
  isLoading,
  onCancelOrder,
  mode,
}) => {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [confirmingOrderId, setConfirmingOrderId] = useState<number | null>(null);

  const toggleExpand = (orderId: number) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
    setConfirmingOrderId(null);
    setCancelReason('');
  };

  const handleCancelClick = (orderId: number) => {
    setConfirmingOrderId(orderId);
  };

  const handleConfirmCancel = (orderId: number) => {
    if (!cancelReason.trim()) {
      showToast.error('Please provide a reason for cancellation');
      return;
    }
    onCancelOrder(orderId, cancelReason);
    setConfirmingOrderId(null);
    setCancelReason('');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-[var(--text-secondary)]">Loading orders...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <XCircle className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
        <h3 className="text-lg font-medium text-[var(--text-primary)]">
          {mode === 'cancellable' ? 'No Cancellable Orders' : 'No Cancelled Orders'}
        </h3>
        <p className="text-[var(--text-secondary)] mt-2">
          {mode === 'cancellable'
            ? 'There are no orders that can be cancelled at this time.'
            : 'No orders have been cancelled yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map(order => (
        <div
          key={order.orderId}
          className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Order Header */}
          <div
            className="p-4 cursor-pointer hover:bg-[var(--surface-secondary)]/50 transition-colors"
            onClick={() => toggleExpand(order.orderId)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${mode === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}
                >
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-bold text-[var(--text-primary)]">
                      #{order.orderNumber || order.orderId}
                    </span>
                    {order.billNo && (
                      <span className="text-xs px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded">
                        Bill: {order.billNo}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${mode === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                        }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {decodeHtml(order.companyName || order.customerName || 'Unknown')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(order.orderDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold text-[var(--text-primary)]">
                    ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {order.items?.length || 0} items
                  </div>
                </div>
                {mode === 'cancellable' && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedOrderId(order.orderId);
                      handleCancelClick(order.orderId);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                    title="Cancel this order"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                )}
                {expandedOrderId === order.orderId ? (
                  <ChevronUp className="w-5 h-5 text-[var(--text-secondary)]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
                )}
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedOrderId === order.orderId && (
            <div className="border-t border-[var(--border)] bg-[var(--background)]">
              {/* Items */}
              <div className="p-4">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order Items
                </h4>
                <div className="space-y-2">
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-[var(--surface)] rounded-lg"
                    >
                      <span className="text-sm text-[var(--text-primary)]">{decodeHtml(item.productName)}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-[var(--text-secondary)]">
                          Qty: {item.quantity} {item.unit}
                        </span>
                        <span className="font-medium text-[var(--text-primary)]">
                          ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cancelled Order Info */}
              {mode === 'cancelled' && order.cancelReason && (
                <div className="px-4 pb-4">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-red-700">Cancellation Reason</div>
                        <div className="text-sm text-red-600 mt-1">{decodeHtml(order.cancelReason)}</div>
                        {order.cancelledAt && (
                          <div className="text-xs text-red-500 mt-2">
                            Cancelled on {formatDate(order.cancelledAt)}
                            {order.cancelledBy && ` by ${decodeHtml(order.cancelledBy)}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancel Action */}
              {mode === 'cancellable' && (
                <div className="px-4 pb-4">
                  {confirmingOrderId === order.orderId ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <div className="text-sm font-medium text-amber-700">
                          Are you sure you want to cancel this order?
                        </div>
                      </div>
                      <textarea
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        placeholder="Please provide a reason for cancellation..."
                        className="w-full px-3 py-2 border border-[var(--border)] bg-white rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none resize-none"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setConfirmingOrderId(null);
                            setCancelReason('');
                          }}
                          className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-secondary)] transition-colors"
                        >
                          No, Keep Order
                        </button>
                        <button
                          onClick={() => handleConfirmCancel(order.orderId)}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Yes, Cancel Order
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleCancelClick(order.orderId);
                      }}
                      className="w-full py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel This Order
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
