import React, { useState, useEffect } from 'react';
import { TncForm } from '../components/TncForm';
import { TncTable } from '../components/TncTable';
import { tncApi } from '../api/tncApi';
import { Tnc, CreateTncInput } from '../types';
import { Loader2, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { Modal, Button } from '@/components/ui';
import { showToast } from '@/utils/toast';

const TncPage: React.FC = () => {
  const [tncList, setTncList] = useState<Tnc[]>([]);
  const [editingTnc, setEditingTnc] = useState<Tnc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'save' | 'delete' | null;
    data: CreateTncInput | number | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    data: null,
    title: '',
    message: '',
  });

  const fetchTnc = async () => {
    try {
      setIsLoading(true);
      const response = await tncApi.getAllTnc();
      if (response && response.data) {
        setTncList(response.data);
      } else {
        setTncList((response as unknown as Tnc[]) || []);
      }
    } catch (error) {
      console.error('Failed to fetch terms:', error);
      showToast.error('Failed to load terms & conditions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTnc();
  }, []);

  const initiateSave = (data: CreateTncInput) => {
    setModalState({
      isOpen: true,
      type: 'save',
      data: data,
      title: editingTnc ? 'Update Term & Condition' : 'Add New Term & Condition',
      message: editingTnc
        ? 'Are you sure you want to update this term? This change will be reflected in future documents.'
        : 'Are you sure you want to add this new term and condition?',
    });
  };

  const initiateDelete = (id: number) => {
    setModalState({
      isOpen: true,
      type: 'delete',
      data: id,
      title: 'Delete Term & Condition',
      message:
        'Are you sure you want to delete this term? This action cannot be undone and may affect existing quotations.',
    });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirmAction = async () => {
    const { type, data } = modalState;
    closeModal();

    try {
      setIsSubmitting(true);

      if (type === 'save') {
        if (editingTnc) {
          const response = await tncApi.updateTnc(editingTnc.tncId, data as CreateTncInput);
          if (response.success) {
            await fetchTnc();
            setEditingTnc(null);
            showToast.success('Term & Condition updated successfully!');
          }
        } else {
          const response = await tncApi.createTnc(data as CreateTncInput);
          if (response.success) {
            await fetchTnc();
            showToast.success('Term & Condition created successfully!');
          }
        }
      } else if (type === 'delete') {
        const response = await tncApi.deleteTnc(data as number);
        if (response.success) {
          await fetchTnc();
          if (editingTnc?.tncId === (data as number)) setEditingTnc(null);
          showToast.success('Term & Condition deleted successfully!');
        }
      }
    } catch (error) {
      console.error(`Failed to ${type} term:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const uniqueTypes = React.useMemo(() => {
    const defaultTypes = ['Payment', 'Delivery'];
    const types = new Set([...defaultTypes, ...tncList.map(t => t.type || 'General')]);
    return Array.from(types).sort();
  }, [tncList]);

  return (
    <div className="container mx-auto pb-10 space-y-6 animate-fade-in">
      {/* Page Header */}
      <PageHeader
        metadataPath="/masters/terms"
        title="Terms & Conditions"
        description="Manage payment terms, delivery terms, and other conditions for quotations"
      />

      <div className="space-y-8">
        {/* Form */}
        <TncForm
          editingTnc={editingTnc}
          existingTypes={uniqueTypes}
          onSubmit={async data => initiateSave(data)}
          onCancel={() => setEditingTnc(null)}
          isLoading={isSubmitting}
        />

        {/* Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-[var(--primary)]/30 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="mt-4 text-[var(--text-secondary)] font-medium">
              Loading terms & conditions...
            </p>
          </div>
        ) : (
          <TncTable data={tncList} onEdit={setEditingTnc} onDelete={initiateDelete} />
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.title} size="md">
        <div className="space-y-4">
          {/* Icon and Message */}
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl flex-shrink-0 ${
                modalState.type === 'delete'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-indigo-100 text-indigo-600'
              }`}
            >
              {modalState.type === 'delete' ? (
                <AlertTriangle size={24} />
              ) : (
                <CheckCircle size={24} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-[var(--text-secondary)] leading-relaxed">{modalState.message}</p>

              {/* Preview for save */}
              {modalState.type === 'save' && modalState.data && (
                <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
                  <div className="text-xs font-semibold text-indigo-600 uppercase mb-2">
                    Preview
                  </div>
                  <div className="flex items-start gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        (modalState.data as CreateTncInput).type === 'Payment'
                          ? 'bg-emerald-100 text-emerald-700'
                          : (modalState.data as CreateTncInput).type === 'Delivery'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {(modalState.data as CreateTncInput).type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-primary)] italic">
                    {(modalState.data as CreateTncInput).description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmAction}
              disabled={isSubmitting}
              className={
                modalState.type === 'delete'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600'
              }
            >
              {isSubmitting ? 'Processing...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TncPage;
