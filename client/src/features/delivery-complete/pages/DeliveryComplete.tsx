import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { DeliveryCompleteTable } from '../components/DeliveryCompleteTable';
import { deliveryCompleteApi } from '../deliveryCompleteApi';
import { DeliveryRecord } from '../types';
import { showToast } from '@/utils/toast';
import { confirmDialog } from '@/components/ui';

export const DeliveryComplete: React.FC = () => {
  const [data, setData] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await deliveryCompleteApi.getDeliveries(search);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [search, fetchData]);

  return (
    <div className="min-h-screen bg-[var(--background)] p-6 md:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <PageHeader metadataPath="/operations/delivery-complete" title="Return Delivery" description="Manage return confirmations" />

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={fetchData}
          className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all shadow-sm hover:shadow-md"
          title="Refresh Data"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="bg-transparent">
        <DeliveryCompleteTable
          data={data}
          isLoading={isLoading}
          onReturnOrder={async id => {
            if (
              await confirmDialog({
                title: 'Return Order',
                message: 'Are you sure you want to return this order?',
                confirmLabel: 'Return',
                variant: 'warning',
              })
            ) {
              try {
                await deliveryCompleteApi.returnOrder(id);
                fetchData();
              } catch (error) {
                console.error(error);
                showToast.error('Failed to return order');
              }
            }
          }}
        />
      </div>
    </div>
  );
};
