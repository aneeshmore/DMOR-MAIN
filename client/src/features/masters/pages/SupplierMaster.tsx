import { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { Supplier } from '../types';
import { supplierApi } from '../api/supplierApi';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Input, Button, Modal } from '@/components/ui';
import { ColumnDef } from '@tanstack/react-table';

// ============================================================
// Validation helpers
// ============================================================

const validateSupplierName = (name: string) => {
  if (!name) return '';
  if (name.trim().length < 2 || name.trim().length > 255)
    return 'Supplier name must be between 2 and 255 characters';
  return '';
};

const validateMobileNo = (mobile: string) => {
  if (!mobile) return '';
  if (!/^\d{10}$/.test(mobile.trim())) return 'Mobile number must be exactly 10 digits';
  return '';
};

const validatePincode = (pin: string) => {
  if (!pin) return '';
  if (!/^\d{6}$/.test(pin.trim())) return 'Pincode must be exactly 6 digits';
  return '';
};

const validateGstNo = (gst: string) => {
  if (!gst) return '';
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst.trim()))
    return 'Enter a valid GST number (e.g. 27AAPFU0939F1ZV)';
  return '';
};

// ============================================================
// SupplierForm component
// ============================================================

const emptyForm: Partial<Supplier> = {
  supplierName: '',
  contactPerson: '',
  mobileNo: '',
  mobileNo2: '',
  address: '',
  pincode: '',
  state: '',
  gstNo: '',
  paymentTerms: '',
};

const SupplierForm = ({
  item,
  onSave,
  onCancel,
  existingSuppliers,
}: {
  item: Partial<Supplier> | null;
  onSave: (item: Supplier) => void;
  onCancel: () => void;
  existingSuppliers: Supplier[];
}) => {
  const [formData, setFormData] = useState<Partial<Supplier>>({
    supplierName: item?.supplierName || '',
    contactPerson: item?.contactPerson || '',
    mobileNo: item?.mobileNo || '',
    mobileNo2: item?.mobileNo2 || '',
    address: item?.address || '',
    pincode: item?.pincode || '',
    state: item?.state || '',
    gstNo: item?.gstNo || '',
    paymentTerms:
      (item?.paymentTerms ?? item?.creditDays !== undefined) ? String(item?.creditDays ?? '') : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFetchingState, setIsFetchingState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!item?.supplierId;

  useEffect(() => {
    setFormData({
      supplierName: item?.supplierName || '',
      contactPerson: item?.contactPerson || '',
      mobileNo: item?.mobileNo || '',
      mobileNo2: item?.mobileNo2 || '',
      address: item?.address || '',
      pincode: item?.pincode || '',
      state: item?.state || '',
      gstNo: item?.gstNo || '',
      paymentTerms:
        (item?.paymentTerms ?? item?.creditDays !== undefined)
          ? String(item?.creditDays ?? '')
          : '',
    });
    setErrors({});
  }, [item]);

  const setFieldError = (field: string, msg: string) =>
    setErrors(prev => ({ ...prev, [field]: msg }));

  const clearFieldError = (field: string) =>
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleField = (field: keyof Supplier) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, [field]: val }));

    if (field === 'supplierName') {
      const err = validateSupplierName(val);
      if (err) {
        setFieldError('supplierName', err);
        return;
      }
      if (
        existingSuppliers.some(
          s =>
            s.supplierName.toLowerCase() === val.trim().toLowerCase() &&
            s.supplierId !== item?.supplierId
        )
      ) {
        setFieldError('supplierName', 'Supplier already existing');
      } else {
        clearFieldError('supplierName');
      }
    }
    if (field === 'mobileNo') {
      const err = validateMobileNo(val);
      if (err) {
        setFieldError('mobileNo', err);
        return;
      }
      // Uniqueness check
      if (
        val.trim() &&
        existingSuppliers.some(
          s =>
            ((s.mobileNo && s.mobileNo === val.trim()) ||
              (s.mobileNo2 && s.mobileNo2 === val.trim())) &&
            s.supplierId !== item?.supplierId
        )
      ) {
        setFieldError('mobileNo', 'Mobile number already used by another supplier');
      } else {
        clearFieldError('mobileNo');
      }
    }
    if (field === 'mobileNo2') {
      const err = validateMobileNo(val);
      if (err) {
        setFieldError('mobileNo2', err);
        return;
      }
      // Uniqueness check
      if (
        val.trim() &&
        existingSuppliers.some(
          s =>
            ((s.mobileNo && s.mobileNo === val.trim()) ||
              (s.mobileNo2 && s.mobileNo2 === val.trim())) &&
            s.supplierId !== item?.supplierId
        )
      ) {
        setFieldError('mobileNo2', 'Mobile number already used by another supplier');
      } else {
        clearFieldError('mobileNo2');
      }
    }
    if (field === 'gstNo') {
      const err = validateGstNo(val);
      if (err) {
        setFieldError('gstNo', err);
        return;
      }
      // Uniqueness check
      if (
        val.trim() &&
        existingSuppliers.some(
          s =>
            s.gstNo &&
            s.gstNo.toUpperCase() === val.trim().toUpperCase() &&
            s.supplierId !== item?.supplierId
        )
      ) {
        setFieldError('gstNo', 'GST number already used by another supplier');
      } else {
        clearFieldError('gstNo');
      }
    }
  };

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, pincode: val, state: val.length < 6 ? '' : prev.state }));

    const err = validatePincode(val);
    if (err) {
      setFieldError('pincode', err);
      return;
    }
    clearFieldError('pincode');

    if (val.length === 6) {
      try {
        setIsFetchingState(true);
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await res.json();
        if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
          setFormData(prev => ({ ...prev, state: data[0].PostOffice[0].State }));
          clearFieldError('state');
        } else {
          setFormData(prev => ({ ...prev, state: '' }));
          setFieldError('pincode', 'Invalid pincode — no records found');
        }
      } catch {
        setFormData(prev => ({ ...prev, state: '' }));
      } finally {
        setIsFetchingState(false);
      }
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);

  const handleSubmit = () => {
    if (!formData.supplierName?.trim()) {
      if (inputRef.current) inputRef.current.reportValidity();
      return;
    }
    const nameErr = validateSupplierName(formData.supplierName || '');
    if (nameErr) {
      setFieldError('supplierName', nameErr);
      return;
    }

    const name = formData.supplierName?.trim();
    if (
      existingSuppliers.some(
        s =>
          s.supplierName.toLowerCase() === name?.toLowerCase() && s.supplierId !== item?.supplierId
      )
    ) {
      setFieldError('supplierName', 'Supplier already existing');
      return;
    }
    if (formData.mobileNo) {
      const err = validateMobileNo(formData.mobileNo);
      if (err) {
        setFieldError('mobileNo', err);
        return;
      }
      // Uniqueness check
      if (
        existingSuppliers.some(
          s =>
            ((s.mobileNo && s.mobileNo === formData.mobileNo!.trim()) ||
              (s.mobileNo2 && s.mobileNo2 === formData.mobileNo!.trim())) &&
            s.supplierId !== item?.supplierId
        )
      ) {
        setFieldError('mobileNo', 'Mobile number already used by another supplier');
        return;
      }
    }
    if (formData.mobileNo2) {
      const err = validateMobileNo(formData.mobileNo2);
      if (err) {
        setFieldError('mobileNo2', err);
        return;
      }
      // Uniqueness check
      if (
        existingSuppliers.some(
          s =>
            ((s.mobileNo && s.mobileNo === formData.mobileNo2!.trim()) ||
              (s.mobileNo2 && s.mobileNo2 === formData.mobileNo2!.trim())) &&
            s.supplierId !== item?.supplierId
        )
      ) {
        setFieldError('mobileNo2', 'Mobile number already used by another supplier');
        return;
      }
    }
    if (formData.gstNo) {
      const err = validateGstNo(formData.gstNo);
      if (err) {
        setFieldError('gstNo', err);
        return;
      }
      // Uniqueness check
      if (
        existingSuppliers.some(
          s =>
            s.gstNo &&
            s.gstNo.toUpperCase() === formData.gstNo!.trim().toUpperCase() &&
            s.supplierId !== item?.supplierId
        )
      ) {
        setFieldError('gstNo', 'GST number already used by another supplier');
        return;
      }
    }
    if (formData.pincode) {
      const err = validatePincode(formData.pincode);
      if (err) {
        setFieldError('pincode', err);
        return;
      }
    }

    onSave({
      supplierId: item?.supplierId || 0,
      supplierName: formData.supplierName?.trim(),
      contactPerson: formData.contactPerson?.trim() || undefined,
      mobileNo: formData.mobileNo?.trim() || undefined,
      mobileNo2: formData.mobileNo2?.trim() || undefined,
      address: formData.address?.trim() || undefined,
      pincode: formData.pincode?.trim() || undefined,
      state: formData.state?.trim() || undefined,
      gstNo: formData.gstNo?.trim() || undefined,
      paymentTerms: formData.paymentTerms?.trim() || undefined,
    } as Supplier);
  };

  const handleCancel = () => {
    if (!isEditMode) {
      setFormData({ ...emptyForm });
      setErrors({});
    }
    onCancel();
  };

  return (
    <div>
      {/* Form fields in a responsive 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Supplier Name */}
        <div>
          <Input
            ref={inputRef}
            label="Supplier Name"
            value={formData.supplierName || ''}
            onChange={handleField('supplierName')}
            placeholder="Enter supplier name"
            required
            autoFocus
            error={errors.supplierName}
          />
        </div>

        {/* Contact Person */}
        <div>
          <Input
            label="Contact Person"
            value={formData.contactPerson || ''}
            onChange={handleField('contactPerson')}
            placeholder="Enter contact person name"
            error={errors.contactPerson}
          />
        </div>

        {/* Mobile No */}
        <div>
          <Input
            label="Mobile No"
            value={formData.mobileNo || ''}
            onChange={handleField('mobileNo')}
            placeholder="Enter 10-digit mobile number"
            maxLength={10}
            error={errors.mobileNo}
          />
        </div>

        {/* Mobile No 2 */}
        <div>
          <Input
            label="Mobile No 2"
            value={formData.mobileNo2 || ''}
            onChange={handleField('mobileNo2')}
            placeholder="Enter alternate mobile number"
            maxLength={10}
            error={errors.mobileNo2}
          />
        </div>

        {/* GST No */}
        <div>
          <Input
            label="GST No"
            value={formData.gstNo || ''}
            onChange={handleField('gstNo')}
            placeholder="e.g. 27AAPFU0939F1ZV"
            maxLength={15}
            error={errors.gstNo}
          />
        </div>

        {/* Payment Terms */}
        <div>
          <Input
            label="Payment Terms"
            value={formData.paymentTerms || ''}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                paymentTerms: e.target.value,
              }))
            }
            placeholder="e.g. 30 days / Net 30 / Immediate"
            error={errors.paymentTerms}
          />
        </div>

        {/* Address — spans 2 columns */}
        <div className="md:col-span-2 lg:col-span-2">
          <Input
            label="Address"
            value={formData.address || ''}
            onChange={handleField('address')}
            placeholder="Enter full address"
            error={errors.address}
          />
        </div>

        {/* Pincode */}
        <div className="relative">
          <Input
            label="Pincode"
            value={formData.pincode || ''}
            onChange={handlePincodeChange}
            placeholder="Enter 6-digit pincode"
            maxLength={6}
            error={errors.pincode}
          />
          {isFetchingState && (
            <span className="absolute right-3 top-9 text-[var(--text-secondary)]">
              <Loader2 size={14} className="animate-spin" />
            </span>
          )}
        </div>

        {/* State — auto-filled, spans remaining cols */}
        <div className="md:col-span-2 lg:col-span-2">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            State{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">(auto-filled)</span>
          </label>
          <div className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt,var(--surface))] text-[var(--text-primary)] text-sm min-h-[38px] flex items-center">
            {formData.state ? (
              <span>{formData.state}</span>
            ) : (
              <span className="text-[var(--text-secondary)] italic text-xs">
                {isFetchingState ? 'Fetching state…' : 'Enter pincode above to auto-fill state'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)] mt-6">
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={hasErrors}>
          {isEditMode ? 'Save Changes' : 'Add Vendor'}
        </Button>
      </div>
    </div>
  );
};

// ============================================================
// SupplierMaster page — form on top, table on bottom
// ============================================================

export default function SupplierMaster() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Edit & Confirmation States
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAddConfirmModalOpen, setIsAddConfirmModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<Supplier | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await supplierApi.getAll();
      if (response.success && response.data) {
        setSuppliers(response.data);
      }
    } catch (error) {
      logger.error('Failed to load suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmAdd = async () => {
    if (!pendingItem) return;
    try {
      setIsAdding(true);
      const createData = {
        supplierName: pendingItem.supplierName.trim(),
        contactPerson: pendingItem.contactPerson || undefined,
        mobileNo: pendingItem.mobileNo || undefined,
        mobileNo2: pendingItem.mobileNo2 || undefined,
        address: pendingItem.address || undefined,
        pincode: pendingItem.pincode || undefined,
        state: pendingItem.state || undefined,
        gstNo: pendingItem.gstNo || undefined,
        paymentTerms: pendingItem.paymentTerms || undefined,
      };
      logger.info('Creating supplier:', createData);
      const response = await supplierApi.create(createData as any);

      if (response.success && response.data) {
        setSuppliers(prev => [...prev, response.data as Supplier]);
        showToast.success('Supplier created successfully');
        setPendingItem(null);
        setIsAddConfirmModalOpen(false);
        setFormResetKey(prev => prev + 1); // reset form fields
      } else if (!response.success) {
        logger.error('Create failed:', response.error);
        showToast.error(response.error || 'Failed to create supplier');
      }
    } catch (error) {
      logger.error('Failed to create supplier:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const confirmUpdate = async () => {
    if (!pendingItem) return;
    try {
      setIsAdding(true);
      const updateData = {
        supplierName: pendingItem.supplierName.trim(),
        contactPerson: pendingItem.contactPerson || undefined,
        mobileNo: pendingItem.mobileNo || undefined,
        mobileNo2: pendingItem.mobileNo2 || undefined,
        address: pendingItem.address || undefined,
        pincode: pendingItem.pincode || undefined,
        state: pendingItem.state || undefined,
        gstNo: pendingItem.gstNo || undefined,
        paymentTerms: pendingItem.paymentTerms || undefined,
      };
      logger.info('Updating supplier:', { id: pendingItem.supplierId, data: updateData });
      const response = await supplierApi.update(pendingItem.supplierId, updateData as any);

      if (response.success && response.data) {
        setSuppliers(prev =>
          prev.map(s => (s.supplierId === pendingItem.supplierId ? (response.data as Supplier) : s))
        );
        showToast.success('Supplier updated successfully');
        setEditingSupplier(null);
        setIsConfirmModalOpen(false);
        setPendingItem(null);
      } else if (!response.success) {
        logger.error('Update failed:', response.error);
        showToast.error(response.error || 'Failed to update supplier');
      }
    } catch (error) {
      logger.error('Failed to update supplier:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    // Scroll form into view
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const initiateUpdate = (item: Supplier) => {
    setPendingItem(item);
    setIsConfirmModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this supplier? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      logger.info('Deleting supplier:', { id });
      await supplierApi.delete(id);
      setSuppliers(prev => prev.filter(s => s.supplierId !== id));
      showToast.success('Supplier deleted successfully');
    } catch (error) {
      logger.error('Failed to delete supplier:', error);
    }
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      id: 'serialNumber',
      accessorFn: (_, index) => index + 1,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sr. No." />,
      cell: ({ row }) => <span>{row.index + 1}</span>,
    },
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span>,
    },
    {
      accessorKey: 'contactPerson',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact Person" />,
      cell: ({ row }) => <span>{row.original.contactPerson || '—'}</span>,
    },
    {
      accessorKey: 'mobileNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mobile No" />,
      cell: ({ row }) => <span>{row.original.mobileNo || '—'}</span>,
    },
    {
      accessorKey: 'state',
      header: ({ column }) => <DataTableColumnHeader column={column} title="State" />,
      cell: ({ row }) => <span>{row.original.state || '—'}</span>,
    },
    {
      accessorKey: 'gstNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="GST No" />,
      cell: ({ row }) => <span>{row.original.gstNo || '—'}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
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
            onClick={() => handleDelete(row.original.supplierId)}
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

  // Hide incomplete legacy records — only show rows where all four key fields are filled.
  // Records remain untouched in the database.
  const displayedSuppliers = suppliers.filter(
    s => s.contactPerson && s.mobileNo && s.state && s.gstNo
  );

  if (loading && suppliers.length === 0) {
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
        <PageHeader title="Create Vendor" description="Manage your vendor records" />

        {/* ── FORM (top) ── */}
        <div
          ref={formRef}
          className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
            {editingSupplier ? 'Edit Vendor' : 'Add New Vendor'}
          </h2>
          <SupplierForm
            key={formResetKey}
            item={editingSupplier}
            existingSuppliers={suppliers}
            onSave={
              editingSupplier
                ? initiateUpdate
                : item => {
                    setPendingItem(item);
                    setIsAddConfirmModalOpen(true);
                  }
            }
            onCancel={() => {
              setEditingSupplier(null);
            }}
          />
        </div>

        {/* ── TABLE (bottom) ── */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <DataTable
            data={displayedSuppliers}
            columns={columns}
            searchPlaceholder="Search suppliers..."
          />
        </div>
      </div>

      {/* Confirmation Modal for Update */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Supplier Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Supplier ID:</span>
              <p>{pendingItem?.supplierId}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Supplier Name:</span>
              <p>{pendingItem?.supplierName}</p>
            </div>
            {pendingItem?.contactPerson && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">Contact Person:</span>
                <p>{pendingItem.contactPerson}</p>
              </div>
            )}
            {pendingItem?.mobileNo && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">Mobile No:</span>
                <p>{pendingItem.mobileNo}</p>
              </div>
            )}
            {pendingItem?.state && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">State:</span>
                <p>{pendingItem.state}</p>
              </div>
            )}
            {pendingItem?.gstNo && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">GST No:</span>
                <p>{pendingItem.gstNo}</p>
              </div>
            )}
            {pendingItem?.paymentTerms && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">Payment Terms:</span>
                <p>{pendingItem.paymentTerms}</p>
              </div>
            )}
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
        title="Confirm Supplier Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <span className="font-semibold text-[var(--text-secondary)]">Supplier Name:</span>
              <p>{pendingItem?.supplierName}</p>
            </div>
            {pendingItem?.contactPerson && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">Contact Person:</span>
                <p>{pendingItem.contactPerson}</p>
              </div>
            )}
            {pendingItem?.mobileNo && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">Mobile No:</span>
                <p>{pendingItem.mobileNo}</p>
              </div>
            )}
            {pendingItem?.address && (
              <div className="col-span-2">
                <span className="font-semibold text-[var(--text-secondary)]">Address:</span>
                <p>{pendingItem.address}</p>
              </div>
            )}
            {pendingItem?.state && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">State:</span>
                <p>{pendingItem.state}</p>
              </div>
            )}
            {pendingItem?.pincode && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">Pincode:</span>
                <p>{pendingItem.pincode}</p>
              </div>
            )}
            {pendingItem?.gstNo && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">GST No:</span>
                <p>{pendingItem.gstNo}</p>
              </div>
            )}
            {pendingItem?.paymentTerms && (
              <div>
                <span className="font-semibold text-[var(--text-secondary)]">Payment Terms:</span>
                <p>{pendingItem.paymentTerms}</p>
              </div>
            )}
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
