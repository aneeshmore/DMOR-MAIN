import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { DiscardForm } from '../components/DiscardForm';
import { DiscardTable } from '../components/DiscardTable';
import { discardApi } from '../api/discardApi';
import { DiscardEntry, CreateDiscardInput } from '../types';
import { showToast } from '@/utils/toast';
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui';
import { confirmDialog } from '@/components/ui';

export const DiscardDashboard: React.FC = () => {
  const [discards, setDiscards] = useState<DiscardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiscardEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'RM' | 'PM' | 'FG'>('RM');
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDiscards(activeTab, selectedProductId);
  }, [activeTab, selectedProductId]);

  const loadDiscards = async (
    tab: 'ALL' | 'RM' | 'PM' | 'FG' = activeTab,
    productId: number | undefined = selectedProductId
  ) => {
    setIsLoading(true);
    try {
      const data = await discardApi.getAllDiscards({
        productType: tab === 'ALL' ? undefined : tab,
        productId: productId || undefined,
      });
      setDiscards(data);
    } catch (error) {
      console.error('Failed to load discards', error);
      showToast.error('Failed to load discard records');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (data: CreateDiscardInput) => {
    setIsSubmitting(true);
    try {
      if (editingEntry) {
        await discardApi.updateDiscard(editingEntry.discardId, data);
        showToast.success('Discard record updated');
        setEditingEntry(null);
      } else {
        await discardApi.createDiscard(data);
        showToast.success('Material discarded successfully');
      }
      await loadDiscards(activeTab, selectedProductId);
    } catch (error: any) {
      console.error('Failed to save discard entry', error);
      // Show the actual error message from server if available
      const errorMessage =
        error?.response?.data?.message || error?.message || 'Failed to save discard entry';
      showToast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (entry: DiscardEntry) => {
    setEditingEntry(entry);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
  };

  const handleDelete = async (id: number) => {
    if (
      await confirmDialog({
        title: 'Delete Entry',
        message:
          'Are you sure you want to delete this entry? Stock adjustments might not be fully reverted.',
        confirmLabel: 'Delete',
        variant: 'danger',
      })
    ) {
      try {
        await discardApi.deleteDiscard(id);
        showToast.success('Record deleted');
        await loadDiscards(activeTab, selectedProductId);
      } catch (error) {
        console.error('Failed to delete discard entry', error);
        showToast.error('Failed to delete record');
      }
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[var(--background)] min-h-screen">
      {/* Page Header */}
      <PageHeader
        metadataPath="/operations/discard"
        title="Material Discard"
        description="Record and track damaged or expired inventory"
      />

      <DiscardForm
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
        initialData={editingEntry}
        onCancel={handleCancelEdit}
        materialType={activeTab === 'ALL' ? undefined : activeTab}
        onMaterialTypeChange={type => {
          setActiveTab(type);
          setSelectedProductId(undefined);
        }}
        onProductChange={id => setSelectedProductId(id)}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Discard History</h2>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3 sm:gap-6">
          <div className="flex gap-2">
            {(['ALL', 'RM', 'PM', 'FG'] as const).map(tab => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'primary' : 'secondary'}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'ALL') {
                    setSelectedProductId(undefined);
                  }
                }}
                size="sm"
              >
                {tab === 'ALL'
                  ? 'All'
                  : tab === 'RM'
                    ? 'Raw Material'
                    : tab === 'PM'
                      ? 'Packaging Material'
                      : 'Finished Good'}
              </Button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">Loading...</div>
        ) : (
          <DiscardTable
            data={discards.filter(
              d =>
                searchQuery.trim() === '' ||
                (d.productName || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
            )}
          />
        )}
      </div>
    </div>
  );
};
