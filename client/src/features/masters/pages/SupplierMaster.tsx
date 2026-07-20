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
import { confirmDialog } from '@/components/ui';

// ============================================================
// Validation helpers
// ============================================================

/** Strict normalizer — trim + collapse to lowercase for exact-match duplicate checks */
const normalize = (v: string | undefined | null): string => (v || '').trim().toLowerCase();

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
    paymentTerms: item?.creditDays ? `${item.creditDays} Days` : '',
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
      paymentTerms: item?.creditDays ? `${item.creditDays} Days` : '',
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
      // Only check for duplicates when there is an actual value to compare
      const safeSuppliers = Array.isArray(existingSuppliers) ? existingSuppliers : [];
      const normalizedInput = normalize(val);
      const isDuplicate =
        normalizedInput.length > 0 &&
        safeSuppliers.some(
          s =>
            s.isActive !== false &&
            normalize(s.supplierName) === normalizedInput &&
            s.supplierId !== item?.supplierId
        );
      if (isDuplicate) {
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
      const dup = val.trim()
        ? existingSuppliers.find(
            s =>
              ((s.mobileNo && s.mobileNo === val.trim()) ||
                (s.mobileNo2 && s.mobileNo2 === val.trim())) &&
              s.supplierId !== item?.supplierId
          )
        : null;
      if (dup) {
        setFieldError('mobileNo', `Mobile number already used by another ${dup.supplierName}`);
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
      const dup = val.trim()
        ? existingSuppliers.find(
            s =>
              ((s.mobileNo && s.mobileNo === val.trim()) ||
                (s.mobileNo2 && s.mobileNo2 === val.trim())) &&
              s.supplierId !== item?.supplierId
          )
        : null;
      if (dup) {
        setFieldError('mobileNo2', `Mobile number already used by another ${dup.supplierName}`);
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
      const dup = val.trim()
        ? existingSuppliers.find(
            s =>
              s.gstNo &&
              s.gstNo.toUpperCase() === val.trim().toUpperCase() &&
              s.supplierId !== item?.supplierId
          )
        : null;
      if (dup) {
        setFieldError('gstNo', `GST already used by another ${dup.supplierName}`);
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

    if (val === formData.pincode) return;

    clearFieldError('pincode');
    const target = e.target;

    try {
      setIsFetchingState(true);
      let resData = null;

      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        if (!res.ok) throw new Error('API fetch failed');
        resData = await res.json();
      } catch (err) {
        const fallbackRes = await fetch(`https://api.zippopotam.us/in/${val}`);
        if (!fallbackRes.ok) throw new Error('Fallback API fetch failed');
        const fallbackData = await fallbackRes.json();
        if (fallbackData && fallbackData.places && fallbackData.places.length > 0) {
          resData = [{ Status: 'Success', PostOffice: [{ State: fallbackData.places[0].state }] }];
        } else {
          throw new Error('No records found in fallback');
        }
      }

      if (target.value.replace(/\D/g, '').slice(0, 6) !== val) return;

      if (resData?.[0]?.Status === 'Success' && resData[0].PostOffice?.length > 0) {
        setFormData(prev => ({ ...prev, state: resData[0].PostOffice[0].State }));
        clearFieldError('state');
      } else {
        setFieldError('pincode', 'Invalid pincode — no records found');
      }
    } catch (error) {
      if (target.value.replace(/\D/g, '').slice(0, 6) !== val) return;
      setFieldError('pincode', 'Failed to auto-fetch state. Please enter manually.');
    } finally {
      if (target.value.replace(/\D/g, '').slice(0, 6) === val) {
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
    const safeSuppliers = Array.isArray(existingSuppliers) ? existingSuppliers : [];
    const normalizedName = normalize(name);
    if (
      normalizedName.length > 0 &&
      safeSuppliers.some(
        s =>
          s.isActive !== false &&
          normalize(s.supplierName) === normalizedName &&
          s.supplierId !== item?.supplierId
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
      const dup = existingSuppliers.find(
        s =>
          ((s.mobileNo && s.mobileNo === formData.mobileNo!.trim()) ||
            (s.mobileNo2 && s.mobileNo2 === formData.mobileNo!.trim())) &&
          s.supplierId !== item?.supplierId
      );
      if (dup) {
        setFieldError('mobileNo', `Mobile number already used by another ${dup.supplierName}`);
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
      const dup = existingSuppliers.find(
        s =>
          ((s.mobileNo && s.mobileNo === formData.mobileNo2!.trim()) ||
            (s.mobileNo2 && s.mobileNo2 === formData.mobileNo2!.trim())) &&
          s.supplierId !== item?.supplierId
      );
      if (dup) {
        setFieldError('mobileNo2', `Mobile number already used by another ${dup.supplierName}`);
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
      const dup = existingSuppliers.find(
        s =>
          s.gstNo &&
          s.gstNo.toUpperCase() === formData.gstNo!.trim().toUpperCase() &&
          s.supplierId !== item?.supplierId
      );
      if (dup) {
        setFieldError('gstNo', `GST already used by another ${dup.supplierName}`);
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

        {/* State — spans remaining cols */}
        <div className="md:col-span-2 lg:col-span-2">
          <Input
            label="State"
            value={formData.state || ''}
            onChange={handleField('state')}
            placeholder={isFetchingState ? 'Fetching state…' : 'Enter state manually'}
            disabled={isFetchingState}
            error={errors.state}
          />
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
        creditDays:
          pendingItem.paymentTerms && !isNaN(parseInt(pendingItem.paymentTerms, 10))
            ? parseInt(pendingItem.paymentTerms, 10)
            : undefined,
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
        creditDays:
          pendingItem.paymentTerms && !isNaN(parseInt(pendingItem.paymentTerms, 10))
            ? parseInt(pendingItem.paymentTerms, 10)
            : undefined,
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
    const confirmed = await confirmDialog({
      title: 'Delete Supplier',
      message: 'Are you sure you want to delete this supplier? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      logger.info('Deleting supplier:', { id });
      const response = await supplierApi.delete(id);
      if (!response.success) {
        showToast.error(response.error || 'Failed to delete supplier');
        return;
      }
      setSuppliers(prev => prev.filter(s => s.supplierId !== id));
      showToast.success('Supplier deleted successfully');
    } catch (error) {
      logger.error('Failed to delete supplier:', error);
      showToast.error('Failed to delete supplier');
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
      cell: ({ row }) => {
        // Show both mobile numbers when the second one exists (no duplicate commas)
        const numbers = [row.original.mobileNo, row.original.mobileNo2]
          .map(n => (n || '').trim())
          .filter(Boolean);
        return <span>{numbers.length > 0 ? numbers.join(', ') : '—'}</span>;
      },
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
          {row.original.isDeletable !== false && (
            <button
              onClick={() => handleDelete(row.original.supplierId)}
              className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors border border-transparent hover:border-red-200 focus-ring"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Show ALL active suppliers from DB — including legacy/imported rows with partial optional fields.
  // The backend duplicate check scans the full active suppliers table; the table must reflect the
  // same dataset so no supplier is an invisible blocker.
  const displayedSuppliers = suppliers;

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
        <PageHeader title="Create Vendor/Supplier" description="Manage your vendor/supplier records" />

        {/* ── FORM (top) ── */}
        <div
          ref={formRef}
          className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
            {editingSupplier ? 'Edit Vendor/Supplier' : 'Add New Vendor/Supplier'}
          </h2>
          <SupplierForm
            key={formResetKey}
            item={editingSupplier}
            existingSuppliers={displayedSuppliers}
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
