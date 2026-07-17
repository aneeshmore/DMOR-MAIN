import { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { CustomerType } from '../types';
import { customerTypeApi } from '../api/customerTypeApi';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Input, Button, Modal } from '@/components/ui';
import { ColumnDef } from '@tanstack/react-table';
import { confirmDialog } from '@/components/ui';

// Validation function
const validateCustomerTypeName = (name: string) => {
  if (!name) return ''; // Let browser handle empty check
  if (/^\d+$/.test(name.trim())) return 'Customer type name cannot be only numbers';
  if (/[^a-zA-Z0-9\s]/.test(name))
    return 'Customer type name must be alphanumeric (letters and numbers only)';
  if (name.trim().length < 2 || name.trim().length > 50)
    return 'Customer type name must be between 2 and 50 characters';
  return '';
};

const CustomerTypeForm = ({
  item,
  onSave,
  onCancel,
  existingCustomerTypes,
}: {
  item: Partial<CustomerType> | null;
  onSave: (item: CustomerType) => void;
  onCancel: () => void;
  existingCustomerTypes: CustomerType[];
}) => {
  const [formData, setFormData] = useState<Partial<CustomerType>>({
    CustomerTypeName: item?.CustomerTypeName || '',
  });
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!item?.CustomerTypeID;

  // Sync form data when item changes (e.g. when clicking edit)
  useEffect(() => {
    setFormData({ CustomerTypeName: item?.CustomerTypeName || '' });
    setError('');
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, CustomerTypeName: val });

    // Immediate validation
    const validationError = validateCustomerTypeName(val);
    if (validationError) {
      setError(validationError);
    } else if (
      existingCustomerTypes.some(
        ct =>
          ct.CustomerTypeName.toLowerCase() === val.trim().toLowerCase() &&
          ct.CustomerTypeID !== item?.CustomerTypeID
      )
    ) {
      setError('Customer type already existing');
    } else {
      setError('');
    }
  };

  const handleSubmit = () => {
    if (!formData.CustomerTypeName?.trim()) {
      if (inputRef.current) {
        inputRef.current.reportValidity();
      }
      return;
    }

    const validationError = validateCustomerTypeName(formData.CustomerTypeName || '');
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if customer type already exists
    const name = formData.CustomerTypeName?.trim();
    if (
      existingCustomerTypes.some(
        ct =>
          ct.CustomerTypeName.toLowerCase() === name?.toLowerCase() &&
          ct.CustomerTypeID !== item?.CustomerTypeID
      )
    ) {
      setError('Customer type already existing');
      return;
    }
    onSave({
      CustomerTypeID: item?.CustomerTypeID || 0,
      CustomerTypeName: formData.CustomerTypeName?.trim(),
    } as CustomerType);
  };

  const handleCancel = () => {
    // Reset form data when canceling in Add mode
    if (!isEditMode) {
      setFormData({ CustomerTypeName: '' });
    }
    onCancel();
  };

  return (
    <div className="space-y-6">
      <Input
        ref={inputRef}
        label="Customer Type Name"
        value={formData.CustomerTypeName || ''}
        onChange={handleChange}
        placeholder="Enter customer type name"
        required
        autoFocus
        error={error}
        disabled={item?.IsSystemType}
      />

      <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)] mt-6">
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!!error}>
          {isEditMode ? 'Save Changes' : 'Add Customer Type'}
        </Button>
      </div>
    </div>
  );
};

export default function CustomerTypeMaster() {
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  // Incremented after a successful create to remount the form in a clean state
  const [formResetKey, setFormResetKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  // Edit & Confirmation States
  const [editingCustomerType, setEditingCustomerType] = useState<CustomerType | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAddConfirmModalOpen, setIsAddConfirmModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<CustomerType | null>(null);

  useEffect(() => {
    loadCustomerTypes();
  }, []);

  const loadCustomerTypes = async () => {
    try {
      setLoading(true);
      const response = await customerTypeApi.getAll();
      if (response.success && response.data) {
        setCustomerTypes(response.data);
      }
    } catch (error) {
      logger.error('Failed to load customer types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateSave = (item: CustomerType) => {
    setPendingItem(item);
    if (item.CustomerTypeID > 0) {
      // Edit mode - show confirmation modal
      setIsConfirmModalOpen(true);
    } else {
      // Add mode - show add confirmation modal
      setIsAddConfirmModalOpen(true);
    }
  };

  const confirmAdd = async () => {
    if (!pendingItem) return;
    try {
      setIsAdding(true);
      const createData = {
        CustomerTypeName: pendingItem.CustomerTypeName.trim(),
      };
      logger.info('Creating customer type:', createData);
      const response = await customerTypeApi.create(createData as any);

      if (response.success && response.data) {
        setCustomerTypes(prev => [...prev, response.data as CustomerType]);
        showToast.success('Customer type created successfully');
        setPendingItem(null);
        setIsAddConfirmModalOpen(false);
        // Reset the form to its initial empty state (only on API success)
        setFormResetKey(k => k + 1);
      } else if (!response.success) {
        logger.error('Create failed:', response.error);
      }
    } catch (error) {
      logger.error('Failed to create customer type:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const confirmUpdate = async () => {
    if (!pendingItem) return;

    try {
      setIsAdding(true);
      const updateData = {
        CustomerTypeName: pendingItem.CustomerTypeName.trim(),
      };
      logger.info('Updating customer type:', { id: pendingItem.CustomerTypeID, data: updateData });
      const response = await customerTypeApi.update(pendingItem.CustomerTypeID, updateData as any);

      if (response.success && response.data) {
        setCustomerTypes(prev =>
          prev.map(ct =>
            ct.CustomerTypeID === pendingItem.CustomerTypeID ? (response.data as CustomerType) : ct
          )
        );
        showToast.success('Customer type updated successfully');
        setEditingCustomerType(null);
        setIsConfirmModalOpen(false);
        setPendingItem(null);
      } else if (!response.success) {
        logger.error('Update failed:', response.error);
      }
    } catch (error) {
      logger.error('Failed to update customer type:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = (customerType: CustomerType) => {
    setEditingCustomerType(customerType);
  };

  const initiateUpdate = (item: CustomerType) => {
    setPendingItem(item);
    setIsConfirmModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingCustomerType(null);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDialog({
      title: 'Delete Customer Type',
      message: 'Are you sure you want to delete this customer type? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      logger.info('Deleting customer type:', { id });
      await customerTypeApi.delete(id);
      setCustomerTypes(prev => prev.filter(ct => ct.CustomerTypeID !== id));
      showToast.success('Customer type deleted successfully');
    } catch (error) {
      logger.error('Failed to delete customer type:', error);
    }
  };

  const columns: ColumnDef<CustomerType>[] = [
    {
      accessorKey: 'CustomerTypeID',
      header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
      cell: ({ row }) => <span>{row.original.CustomerTypeID}</span>,
    },
    {
      accessorKey: 'CustomerTypeName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer Type Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.CustomerTypeName}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) =>
        row.original.IsSystemType ? (
          <div className="flex items-center justify-end pr-2">
            <span className="text-xs italic text-[var(--text-secondary)]">Default</span>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleEdit(row.original)}
              className="p-2 rounded-lg hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors border border-transparent hover:border-[var(--border)] focus-ring"
              title="Edit"
              aria-label="Edit"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleDelete(row.original.CustomerTypeID)}
              className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors border border-transparent hover:border-red-200 focus-ring"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
    },
  ];

  if (loading && customerTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <PageHeader title="Customer Type Master" description="Manage your customer type records" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Type Form Section - Left Side (1/3 width) */}
          <div className="lg:col-span-1">
            <div
              ref={formRef}
              className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 sticky top-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                {editingCustomerType ? 'Edit Customer Type' : 'Add New Customer Type'}
              </h2>
              <CustomerTypeForm
                key={formResetKey}
                item={editingCustomerType}
                existingCustomerTypes={customerTypes}
                onSave={
                  editingCustomerType
                    ? initiateUpdate
                    : item => {
                      setPendingItem(item);
                      setIsAddConfirmModalOpen(true);
                    }
                }
                onCancel={() => {
                  setEditingCustomerType(null);
                }}
              />
            </div>
          </div>

          {/* Customer Type List Section - Right Side (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
              <DataTable
                data={customerTypes}
                columns={columns}
                searchPlaceholder="Search customer types..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Update */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Customer Type Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Customer Type ID:</span>
              <p>{pendingItem?.CustomerTypeID}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">
                Customer Type Name:
              </span>
              <p>{pendingItem?.CustomerTypeName}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmUpdate} disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Add */}
      <Modal
        isOpen={isAddConfirmModalOpen}
        onClose={() => setIsAddConfirmModalOpen(false)}
        title="Confirm Customer Type Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">
                Customer Type Name:
              </span>
              <p>{pendingItem?.CustomerTypeName}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setIsAddConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmAdd} disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
