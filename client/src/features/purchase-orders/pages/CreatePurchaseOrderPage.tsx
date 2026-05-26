import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Modal, Input, SearchableSelect } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { Eye, Trash2, Plus, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { showToast } from '@/utils/toast';
import {
  purchaseOrdersApi,
  PurchaseOrder,
  PurchaseOrderWithItems,
  PurchaseOrderItem,
  CreatePurchaseOrderInput,
} from '../api/purchaseOrdersApi';
import apiClient from '@/api/client';
import { masterProductApi } from '@/features/master-products/api';
import { unitApi } from '@/features/masters/api/unitApi';
import { companyApi } from '@/features/company/api/companyApi';
import { tncApi } from '@/features/tnc/api/tncApi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ── Supplier type (local) ──────────────────────────────────────
interface SupplierOption {
  supplierId: number;
  supplierName: string;
  contactPerson?: string | null;
  mobileNo?: string | null;
  state?: string | null;
  gstNo?: string | null;
}

// ── Status badge ───────────────────────────────────────────────
const StatusBadge: React.FC<{ status: PurchaseOrder['status'] }> = ({ status }) => {
  const cls: Record<string, string> = {
    Pending: 'bg-orange-100 text-orange-800 border-orange-200',
    Confirmed: 'bg-teal-100 text-teal-800 border-teal-200',
    Received: 'bg-green-100 text-green-800 border-green-200',
    'Partially Received': 'bg-blue-100 text-blue-800 border-blue-200',
    Cancelled: '',
  };
  return (
    <Badge
      variant={status === 'Cancelled' ? 'destructive' : 'secondary'}
      className={cls[status] || ''}
    >
      {status}
    </Badge>
  );
};

// ── Empty line item ────────────────────────────────────────────
const emptyItem = (): Omit<
  PurchaseOrderItem,
  'itemId' | 'purchaseOrderId' | 'totalPrice' | 'gst'
> & { gst?: number | '' | null } => ({
  itemDescription: '',
  quantity: 1,
  unit: '',
  unitPrice: 0,
  gst: '',
});

// ── Create PO Form ─────────────────────────────────────────────
interface CreatePOFormProps {
  suppliers: SupplierOption[];
  editingPO: PurchaseOrderWithItems | null;
  onSuccess: (po: PurchaseOrderWithItems) => void;
  onCancelEdit: () => void;
}

const CreatePOForm: React.FC<CreatePOFormProps> = ({
  suppliers,
  editingPO,
  onSuccess,
  onCancelEdit,
}) => {
  const isEditing = !!editingPO;

  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [factoryAddressDefault, setFactoryAddressDefault] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    (Omit<PurchaseOrderItem, 'itemId' | 'purchaseOrderId' | 'totalPrice' | 'gst'> & {
      gst?: number | '' | null;
    })[]
  >([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const tempValuesRef = React.useRef<Record<string, string | number>>({});

  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [loadingMasterData, setLoadingMasterData] = useState(false);
  const [deliveryTermsList, setDeliveryTermsList] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadMasterData = async () => {
      try {
        setLoadingMasterData(true);
        const mpResponse = await masterProductApi.getAll();
        const allMps = mpResponse.success && mpResponse.data ? mpResponse.data : [];
        const filteredMps = allMps.filter(p => p.productType === 'RM' || p.productType === 'PM');

        const unitsResponse = await unitApi.getAll();
        const allUnits = unitsResponse.success && unitsResponse.data ? unitsResponse.data : [];

        const tncResponse = await tncApi.getAllTnc().catch(() => null);
        const allTnc = tncResponse && tncResponse.data ? tncResponse.data : [];
        const filteredTnc = allTnc.filter(
          (t: any) => t.type === 'Delivery' || t.type?.toLowerCase() === 'delivery'
        );

        if (isMounted) {
          setMasterProducts(filteredMps);
          setUnitsList(allUnits);
          setDeliveryTermsList(filteredTnc);
        }
      } catch (err) {
        console.error('Failed to load master products or units:', err);
      } finally {
        if (isMounted) {
          setLoadingMasterData(false);
        }
      }
    };
    loadMasterData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (editingPO) {
      setSupplierId(editingPO.supplierId);
      setOrderDate(editingPO.orderDate?.slice(0, 10) || format(new Date(), 'yyyy-MM-dd'));
      setExpectedDeliveryDate(editingPO.expectedDeliveryDate?.slice(0, 10) || '');
      setDeliveryAddress(editingPO.deliveryAddress || '');
      setDeliveryTerms(editingPO.deliveryTerms || editingPO.notes || '');
      setNotes(editingPO.deliveryTerms ? editingPO.notes || '' : '');
      setItems(
        editingPO.items.length > 0
          ? editingPO.items.map(i => {
              const mp = masterProducts.find(p => p.masterProductName === i.itemDescription);
              return {
                itemDescription: i.itemDescription,
                quantity: Number(i.quantity),
                unit: i.unit || '',
                unitPrice: Number(i.unitPrice),
                gst: mp && mp.gst !== undefined && mp.gst !== null ? mp.gst : '',
              };
            })
          : [emptyItem()]
      );
    } else {
      setSupplierId('');
      setOrderDate(format(new Date(), 'yyyy-MM-dd'));
      setExpectedDeliveryDate(format(new Date(), 'yyyy-MM-dd'));
      setDeliveryAddress(factoryAddressDefault);
      setDeliveryTerms('');
      setNotes('');
      setItems([emptyItem()]);
      setErrors({});
    }
  }, [editingPO, masterProducts, factoryAddressDefault]);

  // Load Company Details for default Delivery Address
  useEffect(() => {
    let isMounted = true;
    const loadCompanyInfo = async () => {
      try {
        const res = await companyApi.get();
        if (res.data && res.data.data) {
          const factoryAddr = res.data.data.factoryAddress || '';
          if (isMounted) {
            setFactoryAddressDefault(factoryAddr);
            if (!isEditing) {
              setDeliveryAddress(factoryAddr);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load company factory address:', err);
      }
    };
    loadCompanyInfo();
    return () => {
      isMounted = false;
    };
  }, [isEditing]);

  const totalAmount = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const getMinDate = () => {
    if (isEditing && editingPO && editingPO.orderDate) {
      const originalDate = editingPO.orderDate.slice(0, 10);
      return originalDate < todayStr ? originalDate : todayStr;
    }
    return todayStr;
  };

  const getMinDispatchDate = () => {
    if (isEditing && editingPO && editingPO.expectedDeliveryDate) {
      const originalDate = editingPO.expectedDeliveryDate.slice(0, 10);
      return originalDate < todayStr ? originalDate : todayStr;
    }
    return todayStr;
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!supplierId) errs.supplierId = 'Vendor is required';

    if (!orderDate) {
      errs.orderDate = 'Order date is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(orderDate);
      selected.setHours(0, 0, 0, 0);
      if (selected < today) {
        const isOriginalDate =
          isEditing && editingPO && editingPO.orderDate?.slice(0, 10) === orderDate;
        if (!isOriginalDate) {
          errs.orderDate = 'Order date cannot be in the past';
        }
      }
    }

    if (!expectedDeliveryDate) {
      errs.expectedDeliveryDate = 'Dispatch Date is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(expectedDeliveryDate);
      selected.setHours(0, 0, 0, 0);
      if (selected < today) {
        const isOriginalDate =
          isEditing &&
          editingPO &&
          editingPO.expectedDeliveryDate?.slice(0, 10) === expectedDeliveryDate;
        if (!isOriginalDate) {
          errs.expectedDeliveryDate = 'Dispatch date cannot be in the past';
        }
      }
    }

    if (!deliveryAddress.trim()) {
      errs.deliveryAddress = 'Delivery Address is required';
    }

    if (!deliveryTerms.trim()) {
      errs.deliveryTerms = 'Delivery Terms are required';
    }

    items.forEach((item, idx) => {
      if (!item.itemDescription.trim()) {
        errs[`item_desc_${idx}`] = 'Description required';
      }
      if (Number(item.quantity) <= 0) {
        errs[`item_qty_${idx}`] = 'Qty must be > 0';
      }
      if (!item.unit || !item.unit.trim()) {
        errs[`item_unit_${idx}`] = 'Unit is required';
      }
      if (Number(item.unitPrice) <= 0) {
        errs[`item_price_${idx}`] = 'Unit price must be > 0';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      const payload: CreatePurchaseOrderInput = {
        supplierId: Number(supplierId),
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        deliveryAddress: deliveryAddress || null,
        deliveryTerms: deliveryTerms || null,
        notes: notes || null,
        items: items.map(i => ({
          itemDescription: i.itemDescription.trim(),
          quantity: Number(i.quantity),
          unit: i.unit || undefined,
          unitPrice: Number(i.unitPrice),
        })),
      };

      let result: PurchaseOrderWithItems;
      if (isEditing) {
        result = await purchaseOrdersApi.update(editingPO!.purchaseOrderId, payload);
        showToast.success('Purchase order updated successfully');
      } else {
        result = await purchaseOrdersApi.create(payload);
        showToast.success('Purchase order created successfully');
        // Reset form
        setSupplierId('');
        setOrderDate(format(new Date(), 'yyyy-MM-dd'));
        setExpectedDeliveryDate(format(new Date(), 'yyyy-MM-dd'));
        setDeliveryAddress(factoryAddressDefault);
        setDeliveryTerms('');
        setNotes('');
        setItems([emptyItem()]);
        setErrors({});
      }
      onSuccess(result);
    } catch (err: any) {
      showToast.error(err?.message || 'Failed to save purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const updateItem = (idx: number, field: string, value: string | number) =>
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 shadow-sm space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        {isEditing ? `Edit PO — ${editingPO!.poNumber}` : 'Create New Purchase Order'}
      </h2>

      {/* Header fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Vendor */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Vendor <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            value={supplierId}
            onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select vendor…</option>
            {suppliers.map(s => (
              <option key={s.supplierId} value={s.supplierId}>
                {s.supplierName}
              </option>
            ))}
          </select>
          {errors.supplierId && <p className="text-xs text-red-500 mt-1">{errors.supplierId}</p>}
        </div>

        {/* Order Date */}
        <div>
          <Input
            label="Order Date"
            type="date"
            value={orderDate}
            onChange={e => setOrderDate(e.target.value)}
            required
            error={errors.orderDate}
            min={getMinDate()}
          />
        </div>

        {/* Expected Delivery Date */}
        <div>
          <Input
            label="Dispatch Date"
            type="date"
            value={expectedDeliveryDate}
            onChange={e => setExpectedDeliveryDate(e.target.value)}
            required
            error={errors.expectedDeliveryDate}
            min={getMinDispatchDate()}
          />
        </div>

        {/* Delivery Address */}
        <div className="md:col-span-2">
          <Input
            label="Delivery Address"
            value={deliveryAddress}
            onChange={e => setDeliveryAddress(e.target.value)}
            placeholder="Enter delivery address"
            required
            error={errors.deliveryAddress}
          />
        </div>

        {/* Delivery Terms Dropdown */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Delivery Terms <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            value={deliveryTerms}
            onChange={e => setDeliveryTerms(e.target.value)}
          >
            <option value="">Select delivery term…</option>
            {deliveryTermsList.map((t, idx) => (
              <option key={idx} value={t.description}>
                {t.description}
              </option>
            ))}
          </select>
          {errors.deliveryTerms && (
            <p className="text-xs text-red-500 mt-1">{errors.deliveryTerms}</p>
          )}
        </div>

        {/* Notes */}
        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Notes</label>
          <textarea
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] min-h-[80px]"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Enter notes"
          />
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Items</h3>
          <Button variant="ghost" size="sm" onClick={addItem}>
            <Plus size={14} className="mr-1" /> Add Item
          </Button>
        </div>

        <div className="border border-[var(--border)] rounded-lg overflow-visible">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-[var(--surface-secondary,var(--surface))]">
              <tr>
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Description *</th>
                <th className="text-right p-3 font-medium">Qty *</th>
                <th className="text-left p-3 font-medium">Unit</th>
                <th className="text-right p-3 font-medium">GST (%)</th>
                <th className="text-right p-3 font-medium">Unit Price (₹)</th>
                <th className="text-right p-3 font-medium">Total (₹)</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-t border-[var(--border)]">
                  <td className="p-2 text-[var(--text-secondary)]">{idx + 1}</td>
                  <td className="p-2 min-w-[200px] relative focus-within:z-50">
                    <SearchableSelect
                      options={[
                        ...(item.itemDescription &&
                        !masterProducts.some(p => p.masterProductName === item.itemDescription)
                          ? [
                              {
                                id: `custom-${item.itemDescription}`,
                                label: item.itemDescription,
                                value: item.itemDescription,
                              },
                            ]
                          : []),
                        ...masterProducts.map(p => ({
                          id: p.masterProductId,
                          label: p.masterProductName,
                          subLabel: `(${p.productType})`,
                          value: p.masterProductName,
                        })),
                      ]}
                      value={item.itemDescription || undefined}
                      onChange={value => {
                        const selectedName = value || '';
                        updateItem(idx, 'itemDescription', selectedName);

                        // Auto-populate matching unit if defaultUnitId exists
                        const mp = masterProducts.find(p => p.masterProductName === selectedName);
                        if (mp) {
                          // Auto-populate GST
                          updateItem(
                            idx,
                            'gst',
                            mp.gst !== undefined && mp.gst !== null ? mp.gst : ''
                          );

                          if (mp.defaultUnitId) {
                            const matchingUnit = unitsList.find(
                              u => (u.UnitID ?? u.unitId) === mp.defaultUnitId
                            );
                            if (matchingUnit) {
                              updateItem(
                                idx,
                                'unit',
                                matchingUnit.UnitName ?? matchingUnit.unitName ?? ''
                              );
                            }
                          }
                        } else {
                          updateItem(idx, 'gst', '');
                        }
                      }}
                      placeholder="Select product…"
                      className="w-full"
                    />
                    {errors[`item_desc_${idx}`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`item_desc_${idx}`]}</p>
                    )}
                  </td>
                  <td className="p-2 w-24">
                    <input
                      className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm text-right focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      onFocus={() => {
                        tempValuesRef.current[`${idx}_quantity`] = item.quantity;
                        updateItem(idx, 'quantity', '');
                      }}
                      onBlur={e => {
                        if (e.target.value === '') {
                          const prev = tempValuesRef.current[`${idx}_quantity`];
                          updateItem(idx, 'quantity', prev !== undefined ? prev : 1);
                        }
                      }}
                    />
                    {errors[`item_qty_${idx}`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`item_qty_${idx}`]}</p>
                    )}
                  </td>
                  <td className="p-2 w-24">
                    <select
                      className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      value={item.unit || ''}
                      onChange={e => updateItem(idx, 'unit', e.target.value)}
                    >
                      <option value="">Unit…</option>
                      {item.unit &&
                        !unitsList.some(u => (u.UnitName ?? u.unitName) === item.unit) && (
                          <option value={item.unit}>{item.unit}</option>
                        )}
                      {unitsList.map(u => {
                        const uName = u.UnitName ?? u.unitName ?? '';
                        const uId = u.UnitID ?? u.unitId ?? 0;
                        return (
                          <option key={uId} value={uName}>
                            {uName}
                          </option>
                        );
                      })}
                    </select>
                    {errors[`item_unit_${idx}`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`item_unit_${idx}`]}</p>
                    )}
                  </td>
                  <td className="p-2 w-24">
                    <input
                      className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-highlight)] text-[var(--text-secondary)] text-sm text-right focus:outline-none cursor-not-allowed"
                      type="text"
                      value={
                        item.gst !== undefined && item.gst !== null && String(item.gst) !== ''
                          ? `${item.gst}%`
                          : '—'
                      }
                      readOnly
                    />
                  </td>
                  <td className="p-2 w-32">
                    <input
                      className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm text-right focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                      onFocus={() => {
                        tempValuesRef.current[`${idx}_unitPrice`] = item.unitPrice;
                        updateItem(idx, 'unitPrice', '');
                      }}
                      onBlur={e => {
                        if (e.target.value === '') {
                          const prev = tempValuesRef.current[`${idx}_unitPrice`];
                          updateItem(idx, 'unitPrice', prev !== undefined ? prev : 0);
                        }
                      }}
                    />
                    {errors[`item_price_${idx}`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`item_price_${idx}`]}</p>
                    )}
                  </td>
                  <td className="p-2 text-right font-medium w-28">
                    ₹{(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                  </td>
                  <td className="p-2">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-1 rounded hover:bg-red-50 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[var(--surface-secondary,var(--surface))]">
              <tr className="border-t-2 border-[var(--border)]">
                <td colSpan={6} className="p-3 text-right font-semibold">
                  Total Amount:
                </td>
                <td className="p-3 text-right font-bold text-[var(--primary)]">
                  ₹{totalAmount.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
        {isEditing && (
          <Button variant="ghost" onClick={onCancelEdit}>
            Cancel
          </Button>
        )}
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Purchase Order'}
        </Button>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────
const CreatePurchaseOrderPage: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPO, setEditingPO] = useState<PurchaseOrderWithItems | null>(null);

  // View Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithItems | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchPOs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await purchaseOrdersApi.getAll(100, 0);
      setPurchaseOrders(data);
    } catch (err) {
      console.error('Failed to fetch purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPOs();
    // Load vendors for the form dropdown
    apiClient
      .get<{ success: boolean; data: SupplierOption[] }>('/suppliers?isActive=true')
      .then(res => {
        const data = res.data.data || [];
        setSuppliers(data.filter(s => s.contactPerson && s.mobileNo && s.state && s.gstNo));
      })
      .catch(() => setSuppliers([]));
  }, [fetchPOs]);

  const handleSuccess = async (po: PurchaseOrderWithItems) => {
    await fetchPOs();
    setEditingPO(null);
  };

  const handleEdit = useCallback(async (po: PurchaseOrder) => {
    try {
      showToast.loading('Loading PO for editing…');
      const full = await purchaseOrdersApi.getById(po.purchaseOrderId);
      setEditingPO(full);
      showToast.dismiss();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      showToast.error('Failed to load purchase order');
    }
  }, []);

  const handleView = useCallback(async (po: PurchaseOrder) => {
    try {
      setViewLoading(true);
      setViewModalOpen(true);
      const full = await purchaseOrdersApi.getById(po.purchaseOrderId);
      setSelectedPO(full);
    } catch {
      showToast.error('Failed to load purchase order details');
      setViewModalOpen(false);
    } finally {
      setViewLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async (po: PurchaseOrder) => {
    if (!window.confirm(`Delete PO ${po.poNumber}? This cannot be undone.`)) return;
    try {
      await purchaseOrdersApi.delete(po.purchaseOrderId);
      setPurchaseOrders(prev => prev.filter(p => p.purchaseOrderId !== po.purchaseOrderId));
      showToast.success('Purchase order deleted');
    } catch (err: any) {
      showToast.error(err?.message || 'Failed to delete purchase order');
    }
  }, []);

  const downloadPO = useCallback(async (po: PurchaseOrder) => {
    try {
      showToast.loading('Preparing PO…', 'po-dl');
      const [full, companyRes] = await Promise.all([
        purchaseOrdersApi.getById(po.purchaseOrderId),
        companyApi.get().catch(() => null),
      ]);

      let supplierDetails: any = null;
      if (full.supplierId) {
        try {
          const suppRes = await apiClient.get<{ success: boolean; data: any }>(
            `/suppliers/${full.supplierId}`
          );
          supplierDetails = suppRes.data.data || suppRes.data;
          console.log('🔍 SUPPLIER API RESPONSE:', {
            supplierId: full.supplierId,
            creditDays: supplierDetails?.creditDays,
            paymentTerms: supplierDetails?.paymentTerms,
            fullSupplier: supplierDetails,
          });
        } catch (e) {
          console.error('Failed to fetch supplier details', e);
        }
      }

      let masterProducts: any[] = [];
      try {
        const mpRes = await masterProductApi.getAll();
        masterProducts = mpRes.success && mpRes.data ? mpRes.data : [];
      } catch (e) {
        console.error('Failed to fetch master products', e);
      }

      showToast.dismiss('po-dl');

      // Helper to format invoice date
      const formatInvoiceDate = (dateStr?: string | null) => {
        if (!dateStr) return '—';
        try {
          const d = new Date(dateStr);
          const day = String(d.getDate()).padStart(2, '0');
          const months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ];
          const month = months[d.getMonth()];
          const year = String(d.getFullYear()).slice(-2);
          return `${day}-${month}-${year}`;
        } catch {
          return dateStr;
        }
      };

      // Helper to get state code
      const getStateCode = (stateName: string) => {
        const s = (stateName || '').toLowerCase();
        if (s.includes('maharashtra')) return '27';
        if (s.includes('delhi')) return '07';
        if (s.includes('gujarat')) return '24';
        if (s.includes('karnataka')) return '29';
        if (s.includes('tamil nadu')) return '33';
        return '';
      };

      // Helper to convert number to Indian words
      const numberToIndianWords = (num: number) => {
        const a = [
          '',
          'One',
          'Two',
          'Three',
          'Four',
          'Five',
          'Six',
          'Seven',
          'Eight',
          'Nine',
          'Ten',
          'Eleven',
          'Twelve',
          'Thirteen',
          'Fourteen',
          'Fifteen',
          'Sixteen',
          'Seventeen',
          'Eighteen',
          'Nineteen',
        ];
        const b = [
          '',
          '',
          'Twenty',
          'Thirty',
          'Forty',
          'Fifty',
          'Sixty',
          'Seventy',
          'Eighty',
          'Ninety',
        ];

        function numToWords(n: number): string {
          if (n < 20) return a[n];
          if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
          if (n < 1000)
            return (
              a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + numToWords(n % 100) : '')
            );
          if (n < 100000)
            return (
              numToWords(Math.floor(n / 1000)) +
              ' Thousand' +
              (n % 1000 !== 0 ? ' ' + numToWords(n % 1000) : '')
            );
          if (n < 10000000)
            return (
              numToWords(Math.floor(n / 100000)) +
              ' Lakh' +
              (n % 100000 !== 0 ? ' ' + numToWords(n % 100000) : '')
            );
          return (
            numToWords(Math.floor(n / 10000000)) +
            ' Crore' +
            (n % 10000000 !== 0 ? ' ' + numToWords(n % 10000000) : '')
          );
        }

        const rounded = Math.round(num);
        if (rounded === 0) return 'Zero';
        return numToWords(rounded) + ' Only';
      };

      const supplierName = supplierDetails?.supplierName || full.supplierName || '—';
      const supplierAddress = supplierDetails?.address || '—';
      const supplierGSTIN = supplierDetails?.gstNo || '—';
      const supplierState = supplierDetails?.state || '—';
      const supplierStateCode = getStateCode(supplierState);

      const companyData: any = companyRes?.data?.data || {};
      const companyName = companyData.companyName || 'Dmor Polymers Private Limited';
      const companyAddress =
        companyData.address ||
        companyData.companyAddress ||
        'Office No. 403 & 404, "Ambegaon Valley", In Front of Swaminarayan Temple, Ambegaon Khurd, Pune - 411046';
      const companyGSTIN = companyData.gstNumber || companyData.companyGSTIN || '27AAGCD5732R1Z1';
      const companyPAN = companyData.panNumber || companyData.companyPAN || 'AAGCD5732R';
      const companyState = companyData.state || 'Maharashtra';
      const companyStateCode = getStateCode(companyState);

      // Determine if supplier and company are in the same state by comparing normalized state names.
      const normalizeState = (value?: string | null) =>
        value?.trim().toLowerCase().replace(/\s+/g, ' ') || '';

      const companyStateNorm = normalizeState(companyState);
      const supplierStateNorm = normalizeState(supplierState);

      // Debug logs (temporary)
      console.log('Company State:', companyState);
      console.log('Supplier State:', supplierState);
      console.log(
        'Is Same State:',
        !!(companyStateNorm && supplierStateNorm && companyStateNorm === supplierStateNorm)
      );

      const isSameState = !!(
        companyStateNorm &&
        supplierStateNorm &&
        companyStateNorm === supplierStateNorm
      );

      const orderDateFormatted = formatInvoiceDate(full.orderDate);
      const deliveryDateFormatted = formatInvoiceDate(full.expectedDeliveryDate);

      const paymentTerms =
        supplierDetails?.paymentTerms ||
        (supplierDetails?.creditDays != null && supplierDetails?.creditDays !== ''
          ? `${supplierDetails.creditDays} Days`
          : '—');

      console.log('📝 INVOICE PAYMENT TERMS LOGIC:', {
        supplierPaymentTerms: supplierDetails?.paymentTerms,
        supplierCreditDays: supplierDetails?.creditDays,
        resolvedPaymentTerms: paymentTerms,
      });

      const termsOfDelivery = full.deliveryTerms || full.notes || '—';
      const poNotes = full.deliveryTerms ? full.notes || '' : '';
      const factoryAddress = companyData.factoryAddress || '—';

      let taxableAmount = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalIGST = 0;
      let totalQuantity = 0;

      const taxGroups: Record<number, number> = {};

      const itemRowsHtml = (full.items || [])
        .map((item, idx) => {
          const mp = masterProducts.find((p: any) => p.masterProductName === item.itemDescription);
          const gstRate = mp && mp.gst !== undefined && mp.gst !== null ? Number(mp.gst) : 18;
          const qty = Number(item.quantity);
          const rate = Number(item.unitPrice);
          const amount = qty * rate;

          taxableAmount += amount;
          totalQuantity += qty;

          taxGroups[gstRate] = (taxGroups[gstRate] || 0) + amount;

          return `
            <tr>
              <td style="width: 5%; border-right: 1px solid #000; text-align: center; padding: 5px 6px; vertical-align: top;">${idx + 1}</td>
              <td style="width: 45%; border-right: 1px solid #000; padding: 5px 6px; vertical-align: top; font-weight: bold;">${item.itemDescription}</td>
              <td style="width: 10%; border-right: 1px solid #000; text-align: center; padding: 5px 6px; vertical-align: top;">${deliveryDateFormatted}</td>
              <td style="width: 12%; border-right: 1px solid #000; text-align: right; padding: 5px 6px; vertical-align: top; font-weight: bold; white-space: nowrap;">${qty.toFixed(4)} ${item.unit || ''}</td>
              <td style="width: 10%; border-right: 1px solid #000; text-align: right; padding: 5px 6px; vertical-align: top;">${rate.toFixed(2)}</td>
              <td style="width: 5%; border-right: 1px solid #000; text-align: center; padding: 5px 6px; vertical-align: top;">${item.unit || ''}</td>
              <td style="width: 3%; border-right: 1px solid #000; text-align: center; padding: 5px 6px; vertical-align: top;">&nbsp;</td>
              <td style="width: 10%; text-align: right; padding: 5px 6px; vertical-align: top; font-weight: bold;">${amount.toFixed(2)}</td>
            </tr>
          `;
        })
        .join('');

      const taxRowsHtmlList: string[] = [];
      Object.entries(taxGroups).forEach(([rateStr, amount]) => {
        const rate = Number(rateStr);
        const taxVal = amount * (rate / 100);
        if (isSameState) {
          const cgst = taxVal / 2;
          const sgst = taxVal / 2;
          totalCGST += cgst;
          totalSGST += sgst;
          taxRowsHtmlList.push(`
            <tr>
              <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 45%; border-right: 1px solid #000; padding: 4px 6px; text-align: right; font-style: italic; font-weight: bold;">Input CGST @ ${rate / 2}%</td>
              <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 12%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px; text-align: right; font-weight: bold;">${rate / 2}%</td>
              <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 3%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 10%; text-align: right; padding: 4px 6px; font-weight: bold;">${cgst.toFixed(2)}</td>
            </tr>
          `);
          taxRowsHtmlList.push(`
            <tr>
              <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 45%; border-right: 1px solid #000; padding: 4px 6px; text-align: right; font-style: italic; font-weight: bold;">Input SGST @ ${rate / 2}%</td>
              <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 12%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px; text-align: right; font-weight: bold;">${rate / 2}%</td>
              <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 3%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 10%; text-align: right; padding: 4px 6px; font-weight: bold;">${sgst.toFixed(2)}</td>
            </tr>
          `);
        } else {
          totalIGST += taxVal;
          taxRowsHtmlList.push(`
            <tr>
              <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 45%; border-right: 1px solid #000; padding: 4px 6px; text-align: right; font-style: italic; font-weight: bold;">Input IGST @ ${rate}%</td>
              <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 12%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px; text-align: right; font-weight: bold;">${rate}%</td>
              <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 3%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
              <td style="width: 10%; text-align: right; padding: 4px 6px; font-weight: bold;">${taxVal.toFixed(2)}</td>
            </tr>
          `);
        }
      });

      const rawTotal = taxableAmount + totalCGST + totalSGST + totalIGST;
      const finalTotal = Math.round(rawTotal);
      const roundingOff = finalTotal - rawTotal;

      if (roundingOff !== 0) {
        taxRowsHtmlList.push(`
          <tr>
            <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
            <td style="width: 45%; border-right: 1px solid #000; padding: 4px 6px; text-align: right; font-style: italic; font-weight: bold;">Rounding Off</td>
            <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
            <td style="width: 12%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
            <td style="width: 10%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
            <td style="width: 5%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
            <td style="width: 3%; border-right: 1px solid #000; padding: 4px 6px;">&nbsp;</td>
            <td style="width: 10%; text-align: right; padding: 4px 6px; font-weight: bold;">${roundingOff.toFixed(2)}</td>
          </tr>
        `);
      }

      const taxRowsHtml = taxRowsHtmlList.join('');
      const amountInWords = numberToIndianWords(finalTotal);

      // Compute precise heights for A4 framing
      // Target viewport dimensions of main-table in pixel representation of A4 (794x1123 minus 80px margins = 714px width, 1043px height)
      // Headers, company details and details block totals about 370px.
      // Total amount block, declarations and footer totals about 195px.
      // Table Header = 28px. Table Footer/Total row = 28px.
      // Total height remaining for body rows, tax rows, and spacer row is:
      // 1043 - 370 - 195 - 28 - 28 = 422px (use 420 for safety).
      const itemsCount = full.items?.length || 1;
      const taxRowsCount = taxRowsHtmlList.length;
      const occupiedHeight = (itemsCount + taxRowsCount) * 24;
      const spacerHeight = Math.max(50, 420 - occupiedHeight);

      // Create temporary offscreen element for high definition A4 rendering
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '794px';
      container.style.height = '1123px';
      container.style.boxSizing = 'border-box';
      container.style.backgroundColor = '#ffffff';
      container.style.zIndex = '-9999';

      container.innerHTML = `
        <div style="width: 794px; height: 1123px; padding: 40px; box-sizing: border-box; background: #ffffff;">
          <div style="border: 2px solid #000; width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff;">
            <div>
              <div style="text-align: center; font-size: 14px; font-weight: bold; border-bottom: 2px solid #000; padding: 6px 0; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif;">
                Purchase Order
              </div>

              <table style="width: 100%; border-bottom: 2px solid #000; border-collapse: collapse; font-family: Arial, sans-serif;">
                <tr>
                  <td style="width: 50%; border-right: 1px solid #000; padding: 0; vertical-align: top;">
                    <div style="padding: 8px; border-bottom: 1px solid #000; min-height: 115px; box-sizing: border-box;">
                      <div style="font-size: 8px; color: #555; font-style: italic; margin-bottom: 2px;">Invoice To</div>
                      <div style="font-size: 11px; font-weight: bold;">${companyName}</div>
                      <div style="white-space: pre-wrap; margin-top: 2px; line-height: 1.3; font-size: 10px;">${companyAddress}</div>
                      <div style="margin-top: 4px; font-size: 10px;"><strong>GSTIN/UIN:</strong> ${companyGSTIN}</div>
                      <div style="font-size: 10px;"><strong>State Name:</strong> ${companyState}${companyStateCode ? `, Code : ${companyStateCode}` : ''}</div>
                    </div>
                    <div style="padding: 8px; min-height: 115px; box-sizing: border-box;">
                      <div style="font-size: 8px; color: #555; font-style: italic; margin-bottom: 2px;">Supplier (Bill from)</div>
                      <div style="font-size: 11px; font-weight: bold;">${supplierName}</div>
                      <div style="white-space: pre-wrap; margin-top: 2px; line-height: 1.3; font-size: 10px;">${supplierAddress}</div>
                      <div style="margin-top: 4px; font-size: 10px;"><strong>GSTIN/UIN:</strong> ${supplierGSTIN}</div>
                      <div style="font-size: 10px;"><strong>State Name:</strong> ${supplierState}${supplierStateCode ? `, Code : ${supplierStateCode}` : ''}</div>
                    </div>
                  </td>

                  <td style="width: 50%; padding: 0; vertical-align: top;">
                    <table style="width: 100%; border-collapse: collapse; border: none;">
                      <tr>
                        <td style="width: 50%; border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 6px; height: 42px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Po No.</div>
                          <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">${full.poNumber}</div>
                        </td>
                        <td style="width: 50%; border-bottom: 1px solid #000; padding: 6px; height: 42px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Dated</div>
                          <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">${orderDateFormatted}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 6px; height: 42px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Mode/Terms of Payment</div>
                          <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">${paymentTerms}</div>
                        </td>
                        <td style="width: 50%; border-bottom: 1px solid #000; padding: 6px; height: 42px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Other References</div>
                          <div style="font-size: 10px; margin-top: 2px; white-space: pre-wrap; line-height: 1.3;">${poNotes || '—'}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 6px; height: 42px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Reference No. & Date</div>
                          <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">${full.poNumber}</div>
                        </td>
                        <td style="width: 50%; border-bottom: 1px solid #000; padding: 6px; height: 42px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Dispatched through </div>
                          <div style="font-size: 10px; margin-top: 2px;">—</div>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-bottom: 1px solid #000; padding: 6px; height: 42px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Terms of Delivery</div>
                          <div style="font-size: 10px; font-weight: bold; white-space: pre-wrap; margin-top: 2px; line-height: 1.3;">${termsOfDelivery || '—'}</div>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 6px; min-height: 62px; box-sizing: border-box; vertical-align: top;">
                          <div style="font-size: 8px; color: #555;">Factory Address</div>
                          <div style="font-size: 10px; font-weight: bold; white-space: pre-wrap; margin-top: 2px; line-height: 1.3;">${factoryAddress || '—'}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
                <thead>
                  <tr style="border-bottom: 1px solid #000; font-weight: bold; text-align: center; background: #ffffff;">
                    <th style="width: 5%; border-right: 1px solid #000; padding: 6px 4px; font-size: 10px;">SI No.</th>
                    <th style="width: 45%; border-right: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 10px;">Description of Goods</th>
                    <th style="width: 10%; border-right: 1px solid #000; padding: 6px 4px; font-size: 10px;">Due on</th>
                    <th style="width: 12%; border-right: 1px solid #000; padding: 6px 4px; text-align: right; font-size: 10px;">Quantity</th>
                    <th style="width: 10%; border-right: 1px solid #000; padding: 6px 4px; text-align: right; font-size: 10px;">Rate</th>
                    <th style="width: 5%; border-right: 1px solid #000; padding: 6px 4px; font-size: 10px;">per</th>
                    <th style="width: 3%; border-right: 1px solid #000; padding: 6px 4px; font-size: 10px;">Disc. %</th>
                    <th style="width: 10%; padding: 6px 4px; text-align: right; font-size: 10px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml}
                  ${taxRowsHtml}
                  <tr style="height: ${spacerHeight}px;">
                    <td style="width: 5%; border-right: 1px solid #000; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                    <td style="width: 45%; border-right: 1px solid #000; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                    <td style="width: 10%; border-right: 1px solid #000; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                    <td style="width: 12%; border-right: 1px solid #000; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                    <td style="width: 10%; border-right: 1px solid #000; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                    <td style="width: 5%; border-right: 1px solid #000; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                    <td style="width: 3%; border-right: 1px solid #000; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                    <td style="width: 10%; border-bottom: 1px solid #000; height: ${spacerHeight}px;">&nbsp;</td>
                  </tr>
                  <tr style="font-weight: bold; border-bottom: 2px solid #000; font-size: 10px;">
                    <td style="width: 5%; border-right: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="width: 45%; border-right: 1px solid #000; text-align: right; padding: 6px;">Total</td>
                    <td style="width: 10%; border-right: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="width: 12%; border-right: 1px solid #000; text-align: right; padding: 6px; white-space: nowrap;">${totalQuantity.toFixed(4)} ${full.items?.[0]?.unit || ''}</td>
                    <td style="width: 10%; border-right: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="width: 5%; border-right: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="width: 3%; border-right: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="width: 10%; text-align: right; padding: 6px;">₹ ${finalTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; margin-top: auto;">
              <tr>
                <td colspan="2" style="padding: 8px 10px; border-bottom: 1px solid #000; font-size: 10px;">
                  <div style="font-size: 8px; color: #555; font-style: italic;">Amount Chargeable (in words)</div>
                  <div style="font-size: 11px; font-weight: bold; margin-top: 3px;">INR ${amountInWords}</div>
                </td>
              </tr>
              <tr style="height: 110px;">
                <td style="width: 55%; border-right: 1px solid #000; padding: 8px 10px; vertical-align: top; font-size: 10px;">
                  <div style="margin-bottom: 12px; font-size: 10px;">
                    <strong>Company's PAN</strong> : <span style="font-weight: bold;">${companyPAN}</span>
                  </div>
                  <div>
                    <strong style="font-size: 9px;">Declaration:</strong>
                    <div style="font-size: 9px; line-height: 1.4; color: #333; margin-top: 3px;">
                      We declare that this purchase order shows the actual price of the goods described and that all particulars are true and correct.
                    </div>
                  </div>
                </td>
                <td style="width: 45%; padding: 8px 10px; text-align: right; vertical-align: top; font-size: 10px; position: relative; height: 110px; box-sizing: border-box;">
                  <div style="font-size: 10px; font-weight: bold;">for ${companyName}</div>
                  <div style="font-size: 9px; font-weight: bold; color: #444; position: absolute; bottom: 12px; right: 10px;">Authorised Signatory</div>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="text-align: center; border-top: 1px solid #000; padding: 8px 0 10px 0; font-size: 8px; line-height: 1.4;">
                  <div style="font-weight: bold; font-style: normal; color: #000; letter-spacing: 0.5px;">GENERATED BY MOREX TECHNOLOGIES</div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      `;

      showToast.loading('Generating PDF…', 'po-dl');
      document.body.appendChild(container);

      // Give browser time to complete rendering layout inside offscreen div
      await new Promise(r => setTimeout(r, 600));

      const canvas = await html2canvas(container, {
        scale: 2.5, // Ultra sharp scale factor
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      pdf.save(`PO-${full.poNumber}.pdf`);

      showToast.dismiss('po-dl');
      showToast.success('Purchase Order PDF downloaded successfully');
    } catch (err: any) {
      console.error(err);
      showToast.dismiss('po-dl');
      showToast.error('Failed to download purchase order');
    }
  }, []);

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: 'poNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="PO Number" />,
      cell: ({ row }) => (
        <span className="font-mono font-medium text-[var(--primary)]">{row.original.poNumber}</span>
      ),
    },
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />,
      cell: ({ row }) => <span className="font-medium">{row.original.supplierName || '—'}</span>,
    },
    {
      id: 'material',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Material" />,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.items?.map((item, idx) => (
            <div key={idx} className="whitespace-nowrap font-medium text-xs">
              {item.itemDescription || '—'}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'qty',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Qty" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-right">
          {row.original.items?.map((item, idx) => (
            <div key={idx} className="font-mono text-xs">
              {item.quantity !== undefined && item.quantity !== null
                ? Number(item.quantity).toFixed(2)
                : '—'}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'unit',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Unit" />,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.items?.map((item, idx) => (
            <div key={idx} className="text-[var(--text-secondary)] text-xs">
              {item.unit || '—'}
            </div>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'orderDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order Date" />,
      cell: ({ row }) => {
        try {
          return format(new Date(row.original.orderDate), 'dd MMM yyyy');
        } catch {
          return row.original.orderDate;
        }
      },
    },
    {
      accessorKey: 'expectedDeliveryDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Dispatch Date" />,
      cell: ({ row }) => {
        if (!row.original.expectedDeliveryDate)
          return <span className="text-[var(--text-secondary)]">—</span>;
        try {
          return format(new Date(row.original.expectedDeliveryDate), 'dd MMM yyyy');
        } catch {
          return row.original.expectedDeliveryDate;
        }
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'totalAmount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">
          ₹{parseFloat(row.original.totalAmount?.toString() || '0').toFixed(2)}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const po = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleView(po)}
              className="text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
            >
              <Eye size={14} className="mr-1" /> View
            </Button>
            {(po.status === 'Pending' || po.status === 'Confirmed') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(po)}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 ml-1"
              >
                Edit
              </Button>
            )}
            {po.status !== 'Cancelled' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadPO(po)}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 ml-1"
                title="Download PO as PDF"
              >
                <Download size={14} className="mr-1" /> Download
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(po)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 ml-1"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="container mx-auto pb-10">
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title={editingPO ? 'Edit Purchase Order' : 'Create Purchase Order'}
          description="Raise and manage purchase orders for vendors"
        />

        {/* Form */}
        <CreatePOForm
          suppliers={suppliers}
          editingPO={editingPO}
          onSuccess={handleSuccess}
          onCancelEdit={() => setEditingPO(null)}
        />

        {/* Table */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Purchase Orders</h2>
          {loading ? (
            <div className="flex justify-center p-8 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
              <DataTable
                columns={columns}
                data={purchaseOrders}
                searchPlaceholder="Search purchase orders…"
              />
            </div>
          )}
        </div>

        {/* View Modal */}
        <Modal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setSelectedPO(null);
          }}
          title="Purchase Order Details"
          size="lg"
        >
          {viewLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[var(--text-secondary)]">Loading…</p>
            </div>
          ) : selectedPO ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-[var(--primary)]">
                    {selectedPO.poNumber}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Created: {format(new Date(selectedPO.createdAt), 'dd MMM yyyy, hh:mm a')}
                  </div>
                </div>
                <StatusBadge status={selectedPO.status} />
              </div>

              <div className="bg-[var(--surface-secondary,var(--surface))] p-4 rounded-lg">
                <h4 className="font-semibold text-[var(--text-primary)] mb-2">Vendor Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">Vendor:</span>{' '}
                    <span className="ml-2 font-medium">{selectedPO.supplierName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Order Date:</span>{' '}
                    <span className="ml-2 font-medium">{selectedPO.orderDate?.slice(0, 10)}</span>
                  </div>
                  {selectedPO.expectedDeliveryDate && (
                    <div>
                      <span className="text-[var(--text-secondary)]">Expected Delivery:</span>{' '}
                      <span className="ml-2 font-medium">
                        {selectedPO.expectedDeliveryDate?.slice(0, 10)}
                      </span>
                    </div>
                  )}
                  {selectedPO.deliveryAddress && (
                    <div className="col-span-2">
                      <span className="text-[var(--text-secondary)]">Delivery Address:</span>{' '}
                      <span className="ml-2 font-medium">{selectedPO.deliveryAddress}</span>
                    </div>
                  )}
                  {(selectedPO.deliveryTerms || selectedPO.notes) && (
                    <div className="col-span-2">
                      <span className="text-[var(--text-secondary)]">Delivery Terms:</span>{' '}
                      <span className="ml-2 font-medium">
                        {selectedPO.deliveryTerms || selectedPO.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-3">Items</h4>
                <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-secondary,var(--surface))]">
                      <tr>
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">Description</th>
                        <th className="text-right p-3 font-medium">Qty</th>
                        <th className="text-left p-3 font-medium">Unit</th>
                        <th className="text-right p-3 font-medium">Rate</th>
                        <th className="text-right p-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items?.map((item, idx) => (
                        <tr key={item.itemId || idx} className="border-t border-[var(--border)]">
                          <td className="p-3">{idx + 1}</td>
                          <td className="p-3 font-medium">{item.itemDescription}</td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3">{item.unit || '—'}</td>
                          <td className="p-3 text-right">
                            ₹{parseFloat(item.unitPrice?.toString() || '0').toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-semibold">
                            ₹{(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[var(--surface-secondary,var(--surface))]">
                      <tr className="border-t-2 border-[var(--border)]">
                        <td colSpan={5} className="p-3 text-right font-semibold">
                          Total:
                        </td>
                        <td className="p-3 text-right font-bold text-[var(--primary)]">
                          ₹{parseFloat(selectedPO.totalAmount?.toString() || '0').toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedPO.deliveryTerms && selectedPO.notes && (
                <div className="bg-[var(--surface-secondary,var(--surface))] p-4 rounded-lg">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-2">Notes</h4>
                  <p className="text-sm">{selectedPO.notes}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-[var(--border)]">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setViewModalOpen(false);
                    setSelectedPO(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </div>
  );
};

export default CreatePurchaseOrderPage;
