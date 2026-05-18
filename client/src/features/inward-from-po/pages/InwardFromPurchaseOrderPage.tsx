import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Modal, Input } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { Eye, Trash2, Plus, X, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';
import { showToast } from '@/utils/toast';
import {
  inwardFromPoApi,
  InwardFromPo,
  InwardFromPoWithItems,
  InwardFromPoItem,
  CreateInwardFromPoInput,
} from '../api/inwardFromPoApi';
import {
  purchaseOrdersApi,
  PurchaseOrderWithItems,
} from '@/features/purchase-orders/api/purchaseOrdersApi';
import { SearchableSelect } from '@/components/ui';
import { inventoryApi } from '@/features/inventory/api/inventoryApi';
import { unitApi } from '@/features/masters/api/unitApi';
import apiClient from '@/api/client';

interface PoOption {
  purchaseOrderId: number;
  poNumber: string;
  supplierId: number;
  supplierName?: string;
  status: string;
}

interface ProductOption {
  masterProductId: number;
  masterProductName: string;
  productType: string;
  unitId?: number;
  purchaseCost?: number;
}

interface UnitOption {
  UnitID: number;
  UnitName: string;
}

// ── Inward PO Form ─────────────────────────────────────────────
interface CreateInwardPoFormProps {
  pos: PoOption[];
  products: ProductOption[];
  units: UnitOption[];
  onSuccess: () => void;
}

const CreateInwardPoForm: React.FC<CreateInwardPoFormProps> = ({
  pos,
  products,
  units,
  onSuccess,
}) => {
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');
  const [poDetails, setPoDetails] = useState<PurchaseOrderWithItems | null>(null);

  const [billNo, setBillNo] = useState('');
  const [inwardDate, setInwardDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [loadingPo, setLoadingPo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mapping state for PO items: itemId -> { masterProductId, receivedQuantity, unitId }
  const [itemMappings, setItemMappings] = useState<
    Record<
      number,
      {
        masterProductId: number;
        receivedQuantity: number;
        unitId: number;
      }
    >
  >({});

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch full PO items when PO is selected
  useEffect(() => {
    if (selectedPoId) {
      setLoadingPo(true);
      setPoDetails(null);
      setItemMappings({});
      purchaseOrdersApi
        .getById(Number(selectedPoId))
        .then(full => {
          setPoDetails(full);
          // Pre-populate mapping fields: auto-match descriptions to products if possible
          const initialMap: typeof itemMappings = {};
          full.items.forEach(item => {
            // Find closest product name match (case-insensitive)
            const match = products.find(
              p => p.masterProductName.toLowerCase() === item.itemDescription.toLowerCase()
            );
            initialMap[item.itemId!] = {
              masterProductId: match ? match.masterProductId : 0,
              receivedQuantity: Number(item.quantity),
              unitId: match?.unitId || 0,
            };
          });
          setItemMappings(initialMap);
        })
        .catch(() => showToast.error('Failed to load purchase order items'))
        .finally(() => setLoadingPo(false));
    } else {
      setPoDetails(null);
      setItemMappings({});
    }
  }, [selectedPoId, products]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedPoId) errs.selectedPoId = 'Purchase Order is required';
    if (!inwardDate) errs.inwardDate = 'Inward date is required';

    if (poDetails) {
      poDetails.items.forEach(item => {
        const mapping = itemMappings[item.itemId!];
        if (!mapping || !mapping.masterProductId) {
          errs[`map_${item.itemId}`] = 'Map to inventory product';
        }
        if (!mapping || Number(mapping.receivedQuantity) <= 0) {
          errs[`qty_${item.itemId}`] = 'Qty must be > 0';
        }
      });
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      const payload: CreateInwardFromPoInput = {
        purchaseOrderId: Number(selectedPoId),
        supplierId: poDetails!.supplierId,
        billNo: billNo || undefined,
        inwardDate: new Date(inwardDate).toISOString(),
        notes: notes || undefined,
        items: poDetails!.items.map(item => {
          const mapping = itemMappings[item.itemId!];
          const matchedProd = products.find(p => p.masterProductId === mapping.masterProductId);
          return {
            purchaseOrderItemId: item.itemId,
            itemDescription: item.itemDescription,
            receivedQuantity: Number(mapping.receivedQuantity),
            unit: item.unit || undefined,
            unitPrice: Number(item.unitPrice),
            totalCost: Number(mapping.receivedQuantity) * Number(item.unitPrice),
            masterProductId: mapping.masterProductId,
            unitId: mapping.unitId || matchedProd?.unitId || undefined,
          };
        }),
      };

      await inwardFromPoApi.create(payload);
      showToast.success('Inward from PO completed successfully');

      // Reset form
      setSelectedPoId('');
      setBillNo('');
      setInwardDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
      setPoDetails(null);
      setItemMappings({});
      setErrors({});
      onSuccess();
    } catch (err: any) {
      showToast.error(err?.message || 'Failed to complete inward');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMappingChange = (itemId: number, field: string, value: number) => {
    setItemMappings(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 shadow-sm space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Inward Material from Purchase Order
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PO Selector */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Purchase Order <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            value={selectedPoId}
            onChange={e => setSelectedPoId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select PO…</option>
            {pos.map(po => (
              <option key={po.purchaseOrderId} value={po.purchaseOrderId}>
                {po.poNumber} ({po.supplierName || 'No Vendor'})
              </option>
            ))}
          </select>
          {errors.selectedPoId && (
            <p className="text-xs text-red-500 mt-1">{errors.selectedPoId}</p>
          )}
        </div>

        {/* Inward Date */}
        <div>
          <Input
            label="Inward Date"
            type="date"
            value={inwardDate}
            onChange={e => setInwardDate(e.target.value)}
            required
            error={errors.inwardDate}
          />
        </div>

        {/* Bill No */}
        <div>
          <Input
            label="Bill No"
            value={billNo}
            onChange={e => setBillNo(e.target.value)}
            placeholder="Optional bill number"
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

      {loadingPo && (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* PO Details & Item Mapping Table */}
      {poDetails && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-lg grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">Vendor:</span>
              <p className="font-semibold text-[var(--text-primary)]">
                {poDetails.supplierName || '—'}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">PO Date:</span>
              <p className="font-semibold text-[var(--text-primary)]">
                {poDetails.orderDate?.slice(0, 10)}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Expected Delivery:</span>
              <p className="font-semibold text-[var(--text-primary)]">
                {poDetails.expectedDeliveryDate?.slice(0, 10) || '—'}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">PO Total:</span>
              <p className="font-bold text-[var(--primary)]">
                ₹{Number(poDetails.totalAmount).toFixed(2)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
              Map PO Items to Inventory
            </h3>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-[var(--surface-secondary,var(--surface))]">
                  <tr>
                    <th className="text-left p-3 font-medium">PO Item Description</th>
                    <th className="text-right p-3 font-medium">Ordered Qty</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-left p-3 font-medium min-w-[220px]">
                      Map to Stock Product
                    </th>
                    <th className="text-right p-3 font-medium w-24">Received Qty</th>
                    <th className="text-left p-3 font-medium w-32">Stock Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {poDetails.items.map(item => {
                    const mapVal = itemMappings[item.itemId!] || {
                      masterProductId: 0,
                      receivedQuantity: 0,
                      unitId: 0,
                    };
                    return (
                      <tr key={item.itemId} className="border-t border-[var(--border)]">
                        <td className="p-3 font-medium">{item.itemDescription}</td>
                        <td className="p-3 text-right">{Number(item.quantity).toFixed(2)}</td>
                        <td className="p-3">{item.unit || '—'}</td>
                        <td className="p-2">
                          <select
                            className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            value={mapVal.masterProductId}
                            onChange={e =>
                              handleMappingChange(
                                item.itemId!,
                                'masterProductId',
                                Number(e.target.value)
                              )
                            }
                          >
                            <option value={0}>Select inventory product…</option>
                            {products.map(p => (
                              <option key={p.masterProductId} value={p.masterProductId}>
                                [{p.productType}] {p.masterProductName}
                              </option>
                            ))}
                          </select>
                          {errors[`map_${item.itemId}`] && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {errors[`map_${item.itemId}`]}
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm text-right focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            min={0.01}
                            step={0.01}
                            value={mapVal.receivedQuantity}
                            onChange={e =>
                              handleMappingChange(
                                item.itemId!,
                                'receivedQuantity',
                                Number(e.target.value)
                              )
                            }
                          />
                          {errors[`qty_${item.itemId}`] && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {errors[`qty_${item.itemId}`]}
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <select
                            className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            value={mapVal.unitId}
                            onChange={e =>
                              handleMappingChange(item.itemId!, 'unitId', Number(e.target.value))
                            }
                          >
                            <option value={0}>Default</option>
                            {units.map(u => (
                              <option key={u.UnitID} value={u.UnitID}>
                                {u.UnitName}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--border)]">
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving Inward…' : 'Receive Material & Update Stock'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────
const InwardFromPurchaseOrderPage: React.FC = () => {
  const [inwardList, setInwardList] = useState<InwardFromPo[]>([]);
  const [poOptions, setPoOptions] = useState<PoOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);

  // View modal
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedInward, setSelectedInward] = useState<InwardFromPoWithItems | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      const [inwards, pos, prods, rawUnits] = await Promise.all([
        inwardFromPoApi.getAll(),
        apiClient
          .get<{ success: boolean; data: PoOption[] }>('/purchase-orders?limit=100')
          .then(res => res.data.data),
        apiClient
          .get<{ success: boolean; data: any[] }>('/catalog/master-products?limit=500')
          .then(res => res.data.data),
        unitApi.getAll().then(res => res.data),
      ]);

      setInwardList(inwards);
      // Filter PO options to show Pending/Confirmed/Partial POs
      setPoOptions(
        (pos || []).filter(
          p => p.status === 'Pending' || p.status === 'Confirmed' || p.status === 'Partial'
        )
      );

      setProducts(
        (prods || []).map(p => ({
          masterProductId: p.masterProductId,
          masterProductName: p.masterProductName || p.productName || 'Unknown',
          productType: p.productType,
          unitId: p.unitId,
          purchaseCost: p.purchaseCost,
        }))
      );

      setUnits(
        (rawUnits || []).map((u: any) => ({
          UnitID: u.UnitID ?? u.unitId ?? u.id ?? 0,
          UnitName: u.UnitName ?? u.unitName ?? u.name ?? '',
        }))
      );
    } catch (err) {
      console.error('Failed to load page data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleView = useCallback(async (inward: InwardFromPo) => {
    try {
      setViewLoading(true);
      setViewOpen(true);
      const full = await inwardFromPoApi.getById(inward.inwardPoId);
      setSelectedInward(full);
    } catch {
      showToast.error('Failed to load details');
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async (inward: InwardFromPo) => {
    if (!window.confirm('Delete this inward record? This does not auto-revert stock levels.'))
      return;
    try {
      await inwardFromPoApi.delete(inward.inwardPoId);
      setInwardList(prev => prev.filter(i => i.inwardPoId !== inward.inwardPoId));
      showToast.success('Inward record deleted');
    } catch {
      showToast.error('Failed to delete inward');
    }
  }, []);

  const columns: ColumnDef<InwardFromPo>[] = [
    {
      accessorKey: 'poNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="PO Number" />,
      cell: ({ row }) => (
        <span className="font-mono font-medium text-[var(--primary)]">
          {row.original.poNumber || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor" />,
      cell: ({ row }) => <span className="font-medium">{row.original.supplierName || '—'}</span>,
    },
    {
      accessorKey: 'billNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bill No" />,
      cell: ({ row }) => <span>{row.original.billNo || '—'}</span>,
    },
    {
      accessorKey: 'inwardDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Inward Date" />,
      cell: ({ row }) => {
        try {
          return format(new Date(row.original.inwardDate), 'dd MMM yyyy');
        } catch {
          return row.original.inwardDate;
        }
      },
    },
    {
      accessorKey: 'totalCost',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total Cost" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">
          ₹{parseFloat(row.original.totalCost?.toString() || '0').toFixed(2)}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const inward = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleView(inward)}
              className="text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
            >
              <Eye size={14} className="mr-1" /> View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(inward)}
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
          title="Inward From Purchase Order"
          description="Receive materials from outstanding purchase orders and auto-update stock levels"
        />

        <CreateInwardPoForm
          pos={poOptions}
          products={products}
          units={units}
          onSuccess={loadPageData}
        />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Inward Logs</h2>
          {loading ? (
            <div className="flex justify-center p-8 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
              <DataTable
                columns={columns}
                data={inwardList}
                searchPlaceholder="Search PO inwards…"
              />
            </div>
          )}
        </div>

        {/* View Modal */}
        <Modal
          isOpen={viewOpen}
          onClose={() => {
            setViewOpen(false);
            setSelectedInward(null);
          }}
          title="PO Inward Details"
          size="lg"
        >
          {viewLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[var(--text-secondary)]">Loading details…</p>
            </div>
          ) : selectedInward ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 p-4 rounded-lg flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-[var(--primary)]">
                    Linked PO: {selectedInward.poNumber || '—'}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Inward Date: {format(new Date(selectedInward.inwardDate), 'dd MMM yyyy')}
                  </div>
                </div>
                {selectedInward.billNo && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-100 text-emerald-800 border-emerald-200"
                  >
                    Bill: {selectedInward.billNo}
                  </Badge>
                )}
              </div>

              <div className="bg-[var(--surface-secondary,var(--surface))] p-4 rounded-lg">
                <h4 className="font-semibold text-[var(--text-primary)] mb-2">Vendor Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">Vendor:</span>{' '}
                    <span className="ml-2 font-medium">{selectedInward.supplierName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Created Log:</span>{' '}
                    <span className="ml-2 font-medium">
                      {format(new Date(selectedInward.createdAt), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-3">Received Items</h4>
                <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-secondary,var(--surface))]">
                      <tr>
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">Description</th>
                        <th className="text-right p-3 font-medium">Received Qty</th>
                        <th className="text-left p-3 font-medium">Unit</th>
                        <th className="text-right p-3 font-medium">Rate</th>
                        <th className="text-right p-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInward.items?.map((item, idx) => (
                        <tr key={item.itemId || idx} className="border-t border-[var(--border)]">
                          <td className="p-3">{idx + 1}</td>
                          <td className="p-3 font-medium">{item.itemDescription}</td>
                          <td className="p-3 text-right">{item.receivedQuantity}</td>
                          <td className="p-3">{item.unit || '—'}</td>
                          <td className="p-3 text-right">
                            ₹{parseFloat(item.unitPrice?.toString() || '0').toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-semibold">
                            ₹{parseFloat(item.totalCost?.toString() || '0').toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[var(--surface-secondary,var(--surface))]">
                      <tr className="border-t-2 border-[var(--border)]">
                        <td colSpan={5} className="p-3 text-right font-semibold">
                          Total Cost:
                        </td>
                        <td className="p-3 text-right font-bold text-[var(--primary)]">
                          ₹{parseFloat(selectedInward.totalCost?.toString() || '0').toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedInward.notes && (
                <div className="bg-[var(--surface-secondary,var(--surface))] p-4 rounded-lg">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-2">Notes</h4>
                  <p className="text-sm">{selectedInward.notes}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-[var(--border)]">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setViewOpen(false);
                    setSelectedInward(null);
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

export default InwardFromPurchaseOrderPage;
