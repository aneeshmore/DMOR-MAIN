import React, { useState, useEffect, useRef } from 'react';
import { InwardForm } from '../components/InwardForm';
import { FGInwardForm } from '../components/FGInwardForm';
import { InwardTable } from '../components/InwardTable';
import { inwardApi } from '../api/inwardApi';
import { InwardEntry, CreateInwardInput } from '../types';
import { PageHeader } from '@/components/common';
import { showToast } from '@/utils/toast';

export const InwardDashboard: React.FC = () => {
  const [inwards, setInwards] = useState<InwardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEntries, setEditingEntries] = useState<InwardEntry[] | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'FG' | 'RM_PM'>('RM_PM'); // Track which form to show
  const [activeViewTab, setActiveViewTab] = useState<'ALL' | 'FG' | 'RM' | 'PM'>('ALL');
  const [isFormDirty, setIsFormDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    loadInwards();
  }, []);

  const loadInwards = async () => {
    setIsLoading(true);
    try {
      const data = await inwardApi.getAllInwards();
      setInwards(data);
    } catch (error) {
      console.error('Failed to load inwards', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (data: CreateInwardInput) => {
    setIsSubmitting(true);
    try {
      if (editingEntries && editingEntries.length > 0) {
        // Edit Mode: Update existing entries
        const oldEntries = editingEntries;
        const newItems = data.items;

        // Update or create each item
        for (const newItem of newItems) {
          if (newItem.inwardId) {
            // Item has ID - update existing entry
            await inwardApi.updateInward(newItem.inwardId, {
              masterProductId: newItem.masterProductId,
              productId: newItem.productId,
              quantity: newItem.quantity,
              unitId: newItem.unitId,
              unitPrice: newItem.unitPrice,
              totalCost: newItem.totalCost,
              billNo: data.billNo,
              notes: data.notes,
              supplierId: data.supplierId,
              customerId: data.customerId,
            });
          } else {
            // New item - create it
            await inwardApi.createInward({
              billNo: data.billNo,
              supplierId: data.supplierId,
              customerId: data.customerId,
              notes: data.notes,
              items: [newItem],
            });
          }
        }

        // Delete removed items
        const newItemIds = new Set(newItems.map(item => item.inwardId).filter(Boolean));
        for (const oldEntry of oldEntries) {
          if (!newItemIds.has(oldEntry.inwardId)) {
            await inwardApi.deleteInward(oldEntry.inwardId);
          }
        }

        showToast.success('Inward entries updated successfully');
        setEditingEntries(null);
      } else {
        // Create Mode
        await inwardApi.createInward(data);
        showToast.success('Inward entries created successfully');
      }
      await loadInwards();
      setIsFormDirty(false); // Reset dirty state after successful submission
    } catch (error: any) {
      console.error('Failed to submit inward', error);
      showToast.error(error.response?.data?.message || 'Failed to submit inward entry');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (entries: InwardEntry[]) => {
    setEditingEntries(entries);
    // Determine which form to show based on product type
    if (entries.length > 0 && entries[0].productType === 'FG') {
      setActiveFormTab('FG');
    } else {
      setActiveFormTab('RM_PM');
    }
    // Set dirty state to true when editing to lock tabs immediately if needed,
    // or rely on the form to report dirty state once it loads items.
    // Usually form will report back 'true' via onDirtyStateChange anyway.
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingEntries(null);
    setIsFormDirty(false); // Reset dirty state on cancel
  };

  const handleDelete = async (entries: InwardEntry[]) => {
    if (
      !confirm(
        `Are you sure you want to delete ${entries.length} inward ${entries.length === 1 ? 'entry' : 'entries'}?`
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      for (const entry of entries) {
        await inwardApi.deleteInward(entry.inwardId);
      }
      showToast.success('Inward entries deleted successfully');
      await loadInwards();
    } catch (error: any) {
      console.error('Failed to delete inward entries', error);
      showToast.error(
        error.response?.data?.message || 'Failed to delete inward entries. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInwards = inwards.filter(entry => {
    if (activeViewTab !== 'ALL' && entry.productType !== activeViewTab) return false;

    // Apply quantity filters: PM > 1 (whole numbers), RM > 0
    if (entry.productType === 'PM' && (Number(entry.quantity) <= 1 || !Number.isInteger(Number(entry.quantity)))) return false;
    if (entry.productType === 'RM' && Number(entry.quantity) <= 0) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Material Inward"
        description="Manage incoming raw materials, packaging materials, and finished goods returns"
      />

      {/* Form Tab Selector */}
      <div className="flex p-1 bg-[var(--surface)] rounded-xl shadow-sm border border-[var(--border)] max-w-md">
        <button
          onClick={() => setActiveFormTab('RM_PM')}
          disabled={activeFormTab === 'FG' && isFormDirty}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeFormTab === 'RM_PM'
              ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
              : activeFormTab === 'FG' && isFormDirty
                ? 'text-[var(--text-disabled)] cursor-not-allowed opacity-50'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
          title={activeFormTab === 'FG' && isFormDirty ? 'Complete current form first' : ''}
        >
          RM / PM Purchase
        </button>
        <button
          onClick={() => setActiveFormTab('FG')}
          disabled={activeFormTab === 'RM_PM' && isFormDirty}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeFormTab === 'FG'
              ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
              : activeFormTab === 'RM_PM' && isFormDirty
                ? 'text-[var(--text-disabled)] cursor-not-allowed opacity-50'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
          title={activeFormTab === 'RM_PM' && isFormDirty ? 'Complete current form first' : ''}
        >
          FG Inward
        </button>
      </div>

      {/* Conditional Form Rendering */}
      {activeFormTab === 'FG' ? (
        <FGInwardForm
          ref={formRef}
          onSubmit={handleFormSubmit}
          isLoading={isSubmitting}
          initialData={editingEntries}
          onCancel={editingEntries ? handleCancelEdit : undefined}
          onDirtyStateChange={setIsFormDirty}
        />
      ) : (
        <InwardForm
          ref={formRef}
          onSubmit={handleFormSubmit}
          isLoading={isSubmitting}
          initialData={editingEntries}
          onCancel={editingEntries ? handleCancelEdit : undefined}
          onDirtyStateChange={setIsFormDirty}
        />
      )}

      <div className="space-y-6">
        <div className="flex p-1 bg-[var(--surface)] rounded-xl shadow-sm border border-[var(--border)]">
          <button
            onClick={() => setActiveViewTab('ALL')}
            className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
              activeViewTab === 'ALL'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            All Inwards
          </button>
          <button
            onClick={() => setActiveViewTab('FG')}
            className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
              activeViewTab === 'FG'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Finished Good
          </button>
          <button
            onClick={() => setActiveViewTab('RM')}
            className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
              activeViewTab === 'RM'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Raw Material
          </button>
          <button
            onClick={() => setActiveViewTab('PM')}
            className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
              activeViewTab === 'PM'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Packaging Material
          </button>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Recent Inward Entries
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">Loading...</div>
          ) : (
            <InwardTable data={filteredInwards} onEdit={handleEdit} onDelete={handleDelete} />
          )}
        </div>
      </div>
    </div>
  );
};
