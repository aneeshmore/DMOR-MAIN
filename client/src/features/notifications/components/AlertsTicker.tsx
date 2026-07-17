import React, { useMemo, useState } from 'react';
import { useAllNotifications, useDeleteNotification } from '../hooks';
import { AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/utils/cn';
import { decodeHtml } from '@/utils/stringUtils';
import { confirmDialog } from '@/components/ui';

export const AlertsTicker = () => {
  const [isTickerModalOpen, setIsTickerModalOpen] = useState(false);

  // Use All Notifications for the Ticker to ensure system-wide alerts are seen
  const { data: notifications = [] } = useAllNotifications(true);
  const deleteNotification = useDeleteNotification();

  // Ticker Content Logic
  const tickerItems = useMemo(() => {
    const items: string[] = [];

    // Low Stock (Unique Materials)
    const activeShortages = new Set<string>();
    notifications.forEach((n: any) => {
      if (n.type === 'MaterialShortage' || n.data?.shortages) {
        const list = n.data?.shortages || [];
        list.forEach((s: any) => activeShortages.add(s.materialName));
      }
    });
    activeShortages.forEach(name => items.push(`⚠️ Low Stock: ${decodeHtml(name)}`));

    // Pending Orders
    notifications.forEach((n: any) => {
      if (n.type === 'NewOrder') {
        const orderNum = n.data?.orderNumber;
        const customer = n.data?.customerName;
        items.push(
          `📦 Pending Order: ${customer ? `${decodeHtml(customer)}` : orderNum ? `#${orderNum}` : 'Unknown'}`
        );
      }
    });

    return items;
  }, [notifications]);

  const handleDelete = async (id: number) => {
    if (
      await confirmDialog({
        title: 'Delete Notification',
        message: 'Delete notification?',
        confirmLabel: 'Delete',
        variant: 'danger',
      })
    ) {
      deleteNotification.mutate(id);
    }
  };

  if (tickerItems.length === 0) return null;

  return (
    <>
      <div
        className="relative overflow-hidden bg-red-50 text-red-900 py-2.5 rounded-lg shadow-sm border border-red-200 cursor-pointer mb-6"
        onClick={() => setIsTickerModalOpen(true)}
      >
        <div className="flex whitespace-nowrap animate-ticker w-max hover:pause">
          {tickerItems.length > 0 ? (
            <>
              {tickerItems.map((item, i) => (
                <span
                  key={`original-${i}`}
                  className="mx-8 font-medium flex items-center text-sm tracking-wide"
                >
                  {item.includes('Low Stock') ? (
                    <span className="text-red-400 mr-2">●</span>
                  ) : (
                    <span className="text-blue-400 mr-2">●</span>
                  )}
                  {item}
                </span>
              ))}
              {/* Duplicate for continuous look */}
              {tickerItems.map((item, i) => (
                <span
                  key={`dup-${i}`}
                  className="mx-8 font-medium flex items-center text-sm tracking-wide"
                >
                  {item.includes('Low Stock') ? (
                    <span className="text-red-400 mr-2">●</span>
                  ) : (
                    <span className="text-blue-400 mr-2">●</span>
                  )}
                  {item}
                </span>
              ))}
            </>
          ) : null}
        </div>
        <style>{`
          @keyframes ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-ticker {
            animation: ticker ${Math.max(40, tickerItems.length * 5)}s linear infinite;
          }
          .hover\\:pause:hover {
            animation-play-state: paused;
          }
        `}</style>
      </div>

      <Modal
        isOpen={isTickerModalOpen}
        onClose={() => setIsTickerModalOpen(false)}
        title="Active Alerts"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          {notifications.filter(
            (n: any) =>
              n.type === 'MaterialShortage' || n.priority === 'critical' || n.priority === 'high'
          ).length === 0 ? (
            <div className="text-center p-8 text-gray-500">No active alerts.</div>
          ) : (
            notifications
              .filter(
                (n: any) =>
                  n.type === 'MaterialShortage' ||
                  n.priority === 'critical' ||
                  n.priority === 'high'
              )
              .sort(
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              .map((n: any) => (
                <div
                  key={n.notificationId}
                  className={cn(
                    'p-4 rounded-lg flex gap-4 border',
                    n.priority === 'critical'
                      ? 'bg-red-50 border-red-100'
                      : 'bg-orange-50 border-orange-100'
                  )}
                >
                  <div className="mt-0.5">
                    {n.priority === 'critical' ? (
                      <AlertTriangle className="text-red-500 w-5 h-5" />
                    ) : (
                      <AlertCircle className="text-orange-500 w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4
                        className={cn(
                          'font-bold text-base pr-8',
                          n.priority === 'critical' ? 'text-gray-900' : 'text-gray-900'
                        )}
                      >
                        {decodeHtml(n.title)}
                      </h4>
                      <button
                        onClick={() => handleDelete(n.notificationId)}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-white/50 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{decodeHtml(n.message)}</p>
                    <p className="text-xs text-gray-500 mt-3 font-medium">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
          )}
        </div>
      </Modal>
    </>
  );
};
