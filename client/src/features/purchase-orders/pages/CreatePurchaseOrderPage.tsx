import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Modal, Input } from '@/components/ui';
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

// ── Supplier type (local) ──────────────────────────────────────
interface SupplierOption {
  supplierId: number;
  supplierName: string;
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
const emptyItem = (): Omit<PurchaseOrderItem, 'itemId' | 'purchaseOrderId' | 'totalPrice'> => ({
  itemDescription: '',
  quantity: 1,
  unit: '',
  unitPrice: 0,
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
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    Omit<PurchaseOrderItem, 'itemId' | 'purchaseOrderId' | 'totalPrice'>[]
  >([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [loadingMasterData, setLoadingMasterData] = useState(false);

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

        if (isMounted) {
          setMasterProducts(filteredMps);
          setUnitsList(allUnits);
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
      setNotes(editingPO.notes || '');
      setItems(
        editingPO.items.length > 0
          ? editingPO.items.map(i => ({
              itemDescription: i.itemDescription,
              quantity: Number(i.quantity),
              unit: i.unit || '',
              unitPrice: Number(i.unitPrice),
            }))
          : [emptyItem()]
      );
    } else {
      setSupplierId('');
      setOrderDate(format(new Date(), 'yyyy-MM-dd'));
      setExpectedDeliveryDate('');
      setDeliveryAddress('');
      setNotes('');
      setItems([emptyItem()]);
      setErrors({});
    }
  }, [editingPO]);

  const totalAmount = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const getMinDate = () => {
    if (isEditing && editingPO && editingPO.orderDate) {
      const originalDate = editingPO.orderDate.slice(0, 10);
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

    items.forEach((item, idx) => {
      if (!item.itemDescription.trim()) errs[`item_desc_${idx}`] = 'Description required';
      if (Number(item.quantity) <= 0) errs[`item_qty_${idx}`] = 'Qty must be > 0';
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
        setExpectedDeliveryDate('');
        setDeliveryAddress('');
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
          />
        </div>

        {/* Delivery Address */}
        <div className="md:col-span-2">
          <Input
            label="Delivery Address"
            value={deliveryAddress}
            onChange={e => setDeliveryAddress(e.target.value)}
            placeholder="Enter delivery address"
          />
        </div>

        {/* Notes */}
        <div>
          <Input
            label="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes"
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

        <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-[var(--surface-secondary,var(--surface))]">
              <tr>
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Description *</th>
                <th className="text-right p-3 font-medium">Qty *</th>
                <th className="text-left p-3 font-medium">Unit</th>
                <th className="text-right p-3 font-medium">Unit Price (₹)</th>
                <th className="text-right p-3 font-medium">Total (₹)</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-t border-[var(--border)]">
                  <td className="p-2 text-[var(--text-secondary)]">{idx + 1}</td>
                  <td className="p-2 min-w-[200px]">
                    <select
                      className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      value={item.itemDescription}
                      onChange={e => {
                        const selectedName = e.target.value;
                        updateItem(idx, 'itemDescription', selectedName);

                        // Auto-populate matching unit if defaultUnitId exists
                        const mp = masterProducts.find(p => p.masterProductName === selectedName);
                        if (mp && mp.defaultUnitId) {
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
                      }}
                    >
                      <option value="">Select product…</option>
                      {item.itemDescription &&
                        !masterProducts.some(p => p.masterProductName === item.itemDescription) && (
                          <option value={item.itemDescription}>{item.itemDescription}</option>
                        )}
                      {masterProducts.map(p => (
                        <option key={p.masterProductId} value={p.masterProductName}>
                          {p.masterProductName} ({p.productType})
                        </option>
                      ))}
                    </select>
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
                  </td>
                  <td className="p-2 w-32">
                    <input
                      className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm text-right focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice}
                      onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                    />
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
                <td colSpan={5} className="p-3 text-right font-semibold">
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
      .get<{ success: boolean; data: SupplierOption[] }>('/suppliers')
      .then(res => setSuppliers(res.data.data || []))
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
    } catch {
      showToast.error('Failed to delete purchase order');
    }
  }, []);

  const downloadPO = useCallback(async (po: PurchaseOrder) => {
    try {
      showToast.loading('Preparing PO…', 'po-dl');
      const full = await purchaseOrdersApi.getById(po.purchaseOrderId);
      showToast.dismiss('po-dl');

      const itemRows = (full.items || [])
        .map(
          (item, idx) => `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0">${idx + 1}</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${item.itemDescription}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${Number(item.quantity).toFixed(4)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${item.unit || '-'}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">&#8377;${Number(item.unitPrice).toFixed(2)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;font-weight:600">&#8377;${(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}</td>
        </tr>`
        )
        .join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Purchase Order - ${full.poNumber}</title>
        <style>
          body{font-family:Arial,sans-serif;font-size:13px;color:#1a202c;margin:0;padding:24px}
          h1{margin:0;font-size:22px;color:#4f46e5}
          .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0}
          .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e}
          .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
          .info-block label{font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:.5px}
          .info-block p{margin:2px 0 0;font-weight:600}
          table{width:100%;border-collapse:collapse;margin-bottom:16px}
          thead{background:#f7fafc}
          th{padding:8px;border:1px solid #e2e8f0;text-align:left;font-size:12px}
          tfoot td{background:#f7fafc;font-weight:700}
          .total-row td{background:#eef2ff;color:#4f46e5}
          @media print{body{padding:0}}
        </style></head><body>
        <div class="header">
          <div><h1>Purchase Order</h1><div style="font-size:18px;font-weight:700;color:#4f46e5;margin-top:4px">${full.poNumber}</div></div>
          <div style="text-align:right"><span class="badge">${full.status}</span><br/>
            <small style="color:#718096">Date: ${full.orderDate?.slice(0, 10) || '-'}</small>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-block"><label>Vendor</label><p>${full.supplierName || '-'}</p></div>
          <div class="info-block"><label>Expected Delivery</label><p>${full.expectedDeliveryDate?.slice(0, 10) || '-'}</p></div>
          ${full.deliveryAddress ? `<div class="info-block" style="grid-column:span 2"><label>Delivery Address</label><p>${full.deliveryAddress}</p></div>` : ''}
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Description</th><th style="text-align:right">Qty</th>
            <th>Unit</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr class="total-row">
            <td colspan="5" style="padding:10px;border:1px solid #e2e8f0;text-align:right">Total Amount</td>
            <td style="padding:10px;border:1px solid #e2e8f0;text-align:right">&#8377;${Number(full.totalAmount).toFixed(2)}</td>
          </tr></tfoot>
        </table>
        ${full.notes ? `<div style="background:#f7fafc;padding:12px;border-radius:8px"><strong>Notes:</strong> ${full.notes}</div>` : ''}
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch {
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Expected Delivery" />,
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

              {selectedPO.notes && (
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
