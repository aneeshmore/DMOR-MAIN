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
  PurchaseOrder,
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
  gst?: number | null;
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
  inwards: any[];
  onSuccess: () => void;
  selectedPoId: number | '';
  setSelectedPoId: React.Dispatch<React.SetStateAction<number | ''>>;
}

const CreateInwardPoForm: React.FC<CreateInwardPoFormProps> = ({
  pos,
  products,
  units,
  inwards,
  onSuccess,
  selectedPoId,
  setSelectedPoId,
}) => {
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
            const match =
              products.find(
                p =>
                  p.masterProductName.trim().toLowerCase() ===
                  item.itemDescription.trim().toLowerCase()
              ) ||
              products.find(
                p =>
                  p.masterProductName
                    .trim()
                    .toLowerCase()
                    .includes(item.itemDescription.trim().toLowerCase()) ||
                  item.itemDescription
                    .trim()
                    .toLowerCase()
                    .includes(p.masterProductName.trim().toLowerCase())
              );
            const remaining =
              item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity;

            // Find matching unit in master units list by name
            const matchingUnit =
              units.find(
                u => item.unit && u.UnitName.trim().toLowerCase() === item.unit.trim().toLowerCase()
              ) ||
              units.find(
                u =>
                  item.unit &&
                  (u.UnitName.trim().toLowerCase().includes(item.unit.trim().toLowerCase()) ||
                    item.unit.trim().toLowerCase().includes(u.UnitName.trim().toLowerCase()))
              );

            initialMap[item.itemId!] = {
              masterProductId: match ? match.masterProductId || 0 : 0,
              receivedQuantity: Number(remaining),
              unitId: matchingUnit ? matchingUnit.UnitID : match?.unitId || 0,
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
  }, [selectedPoId, products, units]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedPoId) errs.selectedPoId = 'Purchase Order is required';
    if (!inwardDate) errs.inwardDate = 'Inward date is required';

    if (!billNo || !billNo.trim()) {
      errs.billNo = 'Bill No is required';
    }

    if (poDetails) {
      poDetails.items.forEach(item => {
        const remaining =
          item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity;
        if (Number(remaining) <= 0) return; // skip fully-received items
        const mapping = itemMappings[item.itemId!];
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
        items: poDetails!.items
          .filter(item => {
            const mapping = itemMappings[item.itemId!];
            return mapping && Number(mapping.receivedQuantity) > 0;
          })
          .map(item => {
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
        <div>
          <SearchableSelect
            label="Purchase Order"
            required
            options={pos.map(po => ({
              id: po.purchaseOrderId,
              label: po.poNumber,
              subLabel: po.supplierName ? `(${po.supplierName})` : undefined,
              value: po.purchaseOrderId,
            }))}
            value={selectedPoId || undefined}
            onChange={val => setSelectedPoId(val ? Number(val) : '')}
            placeholder="Select PO…"
            error={errors.selectedPoId}
          />
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
            onChange={e => {
              const val = e.target.value;
              setBillNo(val);
              if (!val || !val.trim()) {
                setErrors(prev => ({ ...prev, billNo: 'Bill No is required' }));
              } else {
                setErrors(prev => {
                  const next = { ...prev };
                  delete next.billNo;
                  return next;
                });
              }
            }}
            placeholder="Enter bill number"
            required
            error={errors.billNo}
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
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
              Map PO Items to Inventory
            </h3>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-[var(--surface-secondary,var(--surface))]">
                  <tr>
                    <th className="text-left p-3 font-medium">PO Item Description</th>
                    <th className="text-right p-3 font-medium">Ordered Qty</th>
                    <th className="text-right p-3 font-medium">Pending Qty</th>
                    <th className="text-left p-3 font-medium">Unit</th>
                    <th className="text-right p-3 font-medium">Unit Price (₹)</th>
                    <th className="text-left p-3 font-medium">GST (%)</th>
                    <th className="text-right p-3 font-medium w-24">Received Qty</th>
                    <th className="text-left p-3 font-medium w-32">Stock Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {poDetails.items
                    .filter(item => {
                      const remaining =
                        item.remainingQuantity !== undefined
                          ? item.remainingQuantity
                          : item.quantity;
                      return Number(remaining) > 0;
                    })
                    .map(item => {
                      const mapVal = itemMappings[item.itemId!] || {
                        masterProductId: 0,
                        receivedQuantity: 0,
                        unitId: 0,
                      };
                      const matchedProd = products.find(
                        p => p.masterProductId === mapVal.masterProductId
                      );
                      const itemGst =
                        item.gst !== undefined && item.gst !== null ? item.gst : matchedProd?.gst;
                      return (
                        <tr key={item.itemId} className="border-t border-[var(--border)]">
                          <td className="p-2 min-w-[180px]">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-secondary,var(--surface))] text-[var(--text-secondary)] text-sm focus:outline-none cursor-default"
                              value={item.itemDescription}
                              readOnly
                            />
                          </td>
                          <td className="p-2 w-24">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-secondary,var(--surface))] text-[var(--text-secondary)] text-sm text-right focus:outline-none cursor-default"
                              value={Number(item.quantity).toFixed(2)}
                              readOnly
                            />
                          </td>
                          <td className="p-2 w-24">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-secondary,var(--surface))] text-[var(--text-secondary)] text-sm text-right focus:outline-none cursor-default"
                              value={Number(
                                item.remainingQuantity !== undefined
                                  ? item.remainingQuantity
                                  : item.quantity
                              ).toFixed(2)}
                              readOnly
                            />
                          </td>
                          <td className="p-2 w-20">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-secondary,var(--surface))] text-[var(--text-secondary)] text-sm focus:outline-none cursor-default"
                              value={item.unit || '—'}
                              readOnly
                            />
                          </td>
                          <td className="p-2 w-28">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-secondary,var(--surface))] text-[var(--text-secondary)] text-sm text-right focus:outline-none cursor-default"
                              value={`₹${Number(item.unitPrice).toFixed(2)}`}
                              readOnly
                            />
                          </td>
                          <td className="p-2 w-20">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-secondary,var(--surface))] text-[var(--text-secondary)] text-sm text-center focus:outline-none cursor-default"
                              value={
                                itemGst !== undefined && itemGst !== null ? `${itemGst}%` : '—'
                              }
                              readOnly
                            />
                          </td>
                          <td className="p-2 w-24">
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
                          <td className="p-2 w-32">
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

          <div className="p-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">Vendor:</span>
              <p className="font-semibold text-[var(--text-primary)]">
                {poDetails.supplierName || '—'}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">PO Total:</span>
              <p className="font-bold text-[var(--primary)]">
                ₹{Number(poDetails.totalAmount).toFixed(2)}
              </p>
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

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls: Record<string, string> = {
    Pending: 'bg-orange-100 text-orange-800 border-orange-200',
    Confirmed: 'bg-teal-100 text-teal-800 border-teal-200',
    Received: 'bg-green-100 text-green-800 border-green-200',
    'Partially Received': 'bg-blue-100 text-blue-800 border-blue-200',
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

// ── Main Page ──────────────────────────────────────────────────
const InwardFromPurchaseOrderPage: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poOptions, setPoOptions] = useState<PoOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [inwards, setInwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');

  // View modal
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedInward, setSelectedInward] = useState<InwardFromPoWithItems | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      const [pos, prods, rawUnits, rawInwards] = await Promise.all([
        apiClient
          .get<{ success: boolean; data: any[] }>('/purchase-orders?limit=100')
          .then(res => res.data.data),
        apiClient
          .get<{ success: boolean; data: any[] }>('/catalog/master-products?limit=500')
          .then(res => res.data.data),
        unitApi.getAll().then(res => res.data),
        apiClient.get<{ success: boolean; data: any[] }>('/inward').then(res => res.data.data),
      ]);

      setInwards(rawInwards || []);
      setPurchaseOrders(pos || []);
      // Filter PO options to show Pending/Confirmed/Partial POs that have remaining items
      setPoOptions(
        (pos || []).filter(
          p =>
            (p.status === 'Pending' || p.status === 'Confirmed' || p.status === 'Partial') &&
            p.items?.some((item: any) => {
              const remaining =
                item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity;
              return Number(remaining) > 0;
            })
        )
      );

      setProducts(
        (prods || []).map(p => ({
          masterProductId: p.masterProductId || p.productId || 0,
          masterProductName: p.masterProductName || p.productName || 'Unknown',
          productType: p.productType || '',
          unitId: p.unitId || p.defaultUnitId || 0,
          purchaseCost: p.purchaseCost,
          gst:
            p.gst !== undefined && p.gst !== null
              ? Number(p.gst)
              : p.GST !== undefined && p.GST !== null
                ? Number(p.GST)
                : null,
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
      cell: ({ row }) => {
        const pendingItems =
          row.original.items?.filter((item: any) => {
            const remaining =
              item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity;
            return Number(remaining) > 0;
          }) || [];
        return (
          <div className="flex flex-col gap-1">
            {pendingItems.map((item: any, idx: number) => (
              <div key={idx} className="whitespace-nowrap font-medium text-xs">
                {item.itemDescription || '—'}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      id: 'qty',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Qty" className="justify-end" />
      ),
      cell: ({ row }) => {
        const pendingItems =
          row.original.items?.filter((item: any) => {
            const remaining =
              item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity;
            return Number(remaining) > 0;
          }) || [];
        return (
          <div className="flex flex-col gap-1 text-right">
            {pendingItems.map((item: any, idx: number) => (
              <div key={idx} className="font-mono text-xs">
                {item.remainingQuantity !== undefined
                  ? Number(item.remainingQuantity).toFixed(2)
                  : Number(item.quantity).toFixed(2)}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      id: 'unit',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Unit" />,
      cell: ({ row }) => {
        const pendingItems =
          row.original.items?.filter((item: any) => {
            const remaining =
              item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity;
            return Number(remaining) > 0;
          }) || [];
        return (
          <div className="flex flex-col gap-1">
            {pendingItems.map((item: any, idx: number) => (
              <div key={idx} className="text-[var(--text-secondary)] text-xs">
                {item.unit || '—'}
              </div>
            ))}
          </div>
        );
      },
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
          inwards={inwards}
          onSuccess={loadPageData}
          selectedPoId={selectedPoId}
          setSelectedPoId={setSelectedPoId}
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
                data={purchaseOrders.filter(
                  po =>
                    ['Pending', 'Confirmed', 'Partial'].includes(po.status as string) &&
                    po.items?.some((item: any) => {
                      const remaining =
                        item.remainingQuantity !== undefined
                          ? item.remainingQuantity
                          : item.quantity;
                      return Number(remaining) > 0;
                    })
                )}
                searchPlaceholder="Search purchase orders…"
                onRowClick={row => {
                  setSelectedPoId(row.original.purchaseOrderId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
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
