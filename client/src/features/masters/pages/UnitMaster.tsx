import { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { Unit } from '../types';
import { unitApi } from '../api/unitApi';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Input, Button, Modal } from '@/components/ui';
import { ColumnDef } from '@tanstack/react-table';

// Validation function
const validateUnitName = (name: string) => {
  if (!name) return ''; // Let browser handle empty check
  if (/^\d+$/.test(name.trim())) return 'Unit name cannot be only numbers';
  if (/[^a-zA-Z0-9\s]/.test(name))
    return 'Unit name must be alphanumeric (letters and numbers only)';
  if (name.trim().length < 2 || name.trim().length > 20)
    return 'Unit name must be between 2 and 20 characters';
  return '';
};

const UnitForm = ({
  item,
  onSave,
  onCancel,
  existingUnits,
}: {
  item: Partial<Unit> | null;
  onSave: (item: Unit) => void;
  onCancel: () => void;
  existingUnits: Unit[];
}) => {
  const [formData, setFormData] = useState<Partial<Unit>>({
    UnitName: item?.UnitName || '',
  });
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!item?.UnitID;

  // Sync form data when item changes (e.g. when clicking edit)
  useEffect(() => {
    setFormData({ UnitName: item?.UnitName || '' });
    setError('');
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, UnitName: val });

    // Immediate validation
    const validationError = validateUnitName(val);
    if (validationError) {
      setError(validationError);
    } else if (
      existingUnits.some(
        u => u.UnitName.toLowerCase() === val.trim().toLowerCase() && u.UnitID !== item?.UnitID
      )
    ) {
      setError('Unit already existing');
    } else {
      setError('');
    }
  };

  const handleSubmit = () => {
    if (!formData.UnitName?.trim()) {
      if (inputRef.current) {
        inputRef.current.reportValidity();
      }
      return;
    }

    const validationError = validateUnitName(formData.UnitName || '');
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if unit already exists
    const name = formData.UnitName?.trim();
    if (
      existingUnits.some(
        u => u.UnitName.toLowerCase() === name?.toLowerCase() && u.UnitID !== item?.UnitID
      )
    ) {
      setError('Unit already existing');
      return;
    }
    onSave({
      UnitID: item?.UnitID || 0,
      UnitName: formData.UnitName?.trim(),
    } as Unit);
  };

  const handleCancel = () => {
    // Reset form data when canceling in Add mode
    if (!isEditMode) {
      setFormData({ UnitName: '' });
    }
    onCancel();
  };

  return (
    <div className="space-y-6">
      <Input
        ref={inputRef}
        label="Unit Name"
        value={formData.UnitName || ''}
        onChange={handleChange}
        placeholder="Enter unit name"
        required
        autoFocus
        error={error}
      />

      <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)] mt-6">
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!!error}>
          {isEditMode ? 'Save Changes' : 'Add Unit'}
        </Button>
      </div>
    </div>
  );
};

export default function UnitMaster() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Edit & Confirmation States
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAddConfirmModalOpen, setIsAddConfirmModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<Unit | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<number | null>(null);

  // Default units that should always be present
  const DEFAULT_UNITS = [
    { UnitID: -1, UnitName: 'KG' },
    { UnitID: -2, UnitName: 'NO' },
    { UnitID: -3, UnitName: 'LTR' },
  ];

  const isDefaultUnit = (unit: Unit): boolean => {
    return unit.UnitID < 0;
  };

  const DEFAULT_UNIT_NAMES = ['KG', 'NO', 'LTR'];

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const response = await unitApi.getAll();
      if (response.success && response.data) {
        // Merge default units with fetched units, avoiding duplicates
        const fetchedUnitNames = new Set(response.data.map(u => u.UnitName));
        const defaultUnitsToAdd = DEFAULT_UNITS.filter(du => !fetchedUnitNames.has(du.UnitName));
        setUnits([...defaultUnitsToAdd, ...response.data]);
      }
    } catch (error) {
      logger.error('Failed to load units:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateSave = (item: Unit) => {
    setPendingItem(item);
    if (item.UnitID > 0) {
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
        UnitName: pendingItem.UnitName.trim(),
      };
      logger.info('Creating unit:', createData);
      const response = await unitApi.create(createData as any);

      if (response.success && response.data) {
        setUnits(prev => [...prev, response.data as Unit]);
        showToast.success('Unit created successfully');
        setPendingItem(null);
        setIsAddConfirmModalOpen(false);
        setFormResetKey(prev => prev + 1);
      } else if (!response.success) {
        logger.error('Create failed:', response.error);
      }
    } catch (error) {
      logger.error('Failed to create unit:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const confirmUpdate = async () => {
    if (!pendingItem) return;

    try {
      setIsAdding(true);
      const updateData = {
        UnitName: pendingItem.UnitName.trim(),
      };
      logger.info('Updating unit:', { id: pendingItem.UnitID, data: updateData });
      const response = await unitApi.update(pendingItem.UnitID, updateData as any);

      if (response.success && response.data) {
        setUnits(prev =>
          prev.map(u => (u.UnitID === pendingItem.UnitID ? (response.data as Unit) : u))
        );
        showToast.success('Unit updated successfully');
        setEditingUnit(null);
        setIsConfirmModalOpen(false);
        setPendingItem(null);
      } else if (!response.success) {
        logger.error('Update failed:', response.error);
      }
    } catch (error) {
      logger.error('Failed to update unit:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
  };

  const initiateUpdate = (item: Unit) => {
    setPendingItem(item);
    setIsConfirmModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingUnit(null);
  };

  const handleDelete = (id: number) => {
    setUnitToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (unitToDelete === null) return;
    try {
      setIsAdding(true);
      logger.info('Deleting unit:', { id: unitToDelete });
      await unitApi.delete(unitToDelete);
      setUnits(prev => prev.filter(u => u.UnitID !== unitToDelete));
      showToast.success('Unit deleted successfully');
      setIsDeleteModalOpen(false);
      setUnitToDelete(null);
    } catch (error) {
      logger.error('Failed to delete unit:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const columns: ColumnDef<Unit>[] = [
    {
      id: 'serialNumber',
      accessorFn: (_, index) => index + 1,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sr. No." />,
      cell: ({ row }) => <span>{row.index + 1}</span>,
    },
    {
      accessorKey: 'UnitName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Unit Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.UnitName}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const unit = row.original;

        // Hide actions for default units
        if (DEFAULT_UNIT_NAMES.includes(unit.UnitName.toUpperCase())) {
          return <span className="text-sm italic text-[var(--text-secondary)]">Default</span>;
        }

        return (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleEdit(unit)}
              className="p-2 rounded-lg hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors border border-transparent hover:border-[var(--border)] focus-ring"
              title="Edit"
            >
              <Edit2 size={16} />
            </button>

            <button
              onClick={() => handleDelete(unit.UnitID)}
              className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors border border-transparent hover:border-red-200 focus-ring"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  if (loading && units.length === 0) {
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
        <PageHeader title="Unit Master" description="Manage your unit records" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unit Form Section - Left Side (1/3 width) */}
          <div className="lg:col-span-1">
            <div
              ref={formRef}
              className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 sticky top-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                {editingUnit ? 'Edit Unit' : 'Add New Unit'}
              </h2>
              <UnitForm
                key={formResetKey}
                item={editingUnit}
                existingUnits={units}
                onSave={
                  editingUnit
                    ? initiateUpdate
                    : item => {
                        setPendingItem(item);
                        setIsAddConfirmModalOpen(true);
                      }
                }
                onCancel={() => {
                  setEditingUnit(null);
                }}
              />
            </div>
          </div>

          {/* Unit List Section - Right Side (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
              <DataTable data={units} columns={columns} searchPlaceholder="Search units..." />
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Update */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Unit Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Unit ID:</span>
              <p>{pendingItem?.UnitID}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Unit Name:</span>
              <p>{pendingItem?.UnitName}</p>
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
        title="Confirm Unit Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Unit Name:</span>
              <p>{pendingItem?.UnitName}</p>
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

      {/* Confirmation Modal for Delete */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Are you sure you want to delete this unit? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmDelete} 
              disabled={isAdding}
              className="!bg-red-500 hover:!bg-red-600 !border-red-500 text-white"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
