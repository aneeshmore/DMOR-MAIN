import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui';
import { inventoryApi } from '@/features/inventory/api/inventoryApi';
import { unitApi } from '@/features/masters/api/unitApi';
import { supplierApi } from '@/features/masters/api/supplierApi';
import { Supplier } from '@/features/masters/types';
import { CreateInwardInput, InwardEntry, InwardItemInput } from '../types';
import { Product } from '@/features/inventory/types';
import { Unit } from '@/features/masters/types';
import { Calendar, Plus, Trash2, Save, Edit2 } from 'lucide-react';
import { showToast } from '@/utils/toast';
import { confirmDialog } from '@/components/ui';
import { updateProductApi } from '@/features/update-product/api';

interface FGInwardFormProps {
  onSubmit: (data: CreateInwardInput) => Promise<void>;
  isLoading?: boolean;
  initialData?: InwardEntry[] | null;
  onCancel?: () => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

interface CurrentItemState {
  inwardId?: number;
  productId: number;
  quantity: string;
  unitId: number;
  totalPrice: string;
  unitPrice: number;
  pricePerUnit: string;          // Purchase rate displayed/entered by the user
  autoFilledCostPrice: number;   // The value that was auto-filled when the FG was selected
  isProductionCostSource: boolean; // True if the auto-fill came from production cost (not a stored purchaseCost)
}

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const FGInwardForm = React.forwardRef<HTMLFormElement, FGInwardFormProps>(
  ({ onSubmit, isLoading, initialData, onCancel, onDirtyStateChange }, ref) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const productEntrySectionRef = React.useRef<HTMLDivElement>(null);
    const [billDetails, setBillDetails] = useState({
      inwardDate: getLocalDateString(),
      notes: '',
      billNo: '',
      supplierId: undefined as number | undefined,
      rate: '',
    });
    const [items, setItems] = useState<InwardItemInput[]>([]);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [currentItem, setCurrentItem] = useState<CurrentItemState>({
      productId: 0,
      quantity: '',
      unitId: 0,
      totalPrice: '',
      unitPrice: 0,
      pricePerUnit: '',
      autoFilledCostPrice: 0,
      isProductionCostSource: false,
    });

    useEffect(() => {
      if (onDirtyStateChange) onDirtyStateChange(items.length > 0);
    }, [items, onDirtyStateChange]);

    useEffect(() => {
      loadData();
      loadProducts();
    }, []);

    useEffect(() => {
      if (initialData && initialData.length > 0) {
        const firstItem = initialData[0];
        setBillDetails({
          inwardDate: firstItem.inwardDate
            ? new Date(firstItem.inwardDate).toISOString().split('T')[0]
            : getLocalDateString(),
          notes: firstItem.notes || '',
          billNo: firstItem.billNo || '',
          supplierId: firstItem.supplierId || undefined,
          rate: firstItem.unitPrice ? String(firstItem.unitPrice) : '',
        });
        setItems(
          initialData.map(entry => ({
            inwardId: entry.inwardId,
            masterProductId: entry.productId,
            productId: entry.skuId || entry.productId,
            inwardDate: entry.inwardDate,
            quantity: Number(entry.quantity),
            unitId: entry.unitId,
            unitPrice: Number(entry.unitPrice) || 0,
            totalCost: entry.totalCost || 0,
          }))
        );
        resetCurrentItem();
      } else {
        setBillDetails({
          inwardDate: getLocalDateString(),
          notes: '',
          billNo: '',
          supplierId: undefined,
          rate: '',
        });
        setItems([]);
        resetCurrentItem();
      }
    }, [initialData]);

    const loadData = async () => {
      try {
        const [unitsData, suppliersResult] = await Promise.all([
          unitApi.getAll().then(res => res.data),
          supplierApi.getAll(),
        ]);
        const suppliersData = suppliersResult.success ? suppliersResult.data ?? [] : [];
        setUnits(
          (unitsData || []).map((u: any) => ({
            UnitID: u.UnitID ?? u.unitId ?? u.id ?? 0,
            UnitName: u.UnitName ?? u.unitName ?? u.name ?? '',
            UnitSymbol: u.UnitSymbol ?? u.unitSymbol ?? u.symbol ?? undefined,
          }))
        );
        setSuppliers(suppliersData || []);
      } catch (error) {
        console.error('Failed to load data', error);
      }
    };

    const getDefaultUnitId = () => units.find(u => u.UnitName === 'NO')?.UnitID || 0;

    useEffect(() => {
      if (units.length > 0 && (currentItem.unitId === 0 || currentItem.unitId === 7)) {
        const defaultId = getDefaultUnitId();
        if (defaultId) setCurrentItem(prev => ({ ...prev, unitId: defaultId }));
      }
    }, [units]);

    const loadProducts = async () => {
      try {
        const productsData = await inventoryApi.getAllProducts();
        const fgs = productsData.filter((p: Product) => p.productType === 'FG');

        try {
          // getFinalGoods returns { status, data: [...] } — extract .data array
          const pricingResponse = await updateProductApi.getFinalGoods();
          const pricingArray: any[] = Array.isArray(pricingResponse)
            ? pricingResponse
            : (pricingResponse?.data ?? []);

          const costPriceMap = new Map<number, { cost: number; isProductionOnly: boolean }>();
          pricingArray.forEach((fg: any) => {
            // Same formula used by the Update Product page (FinalGoodTable):
            // - costPrice    = masterProductFG.purchaseCost (stored per-unit cost; set via inward)
            // - devCostPrice = masterProductFG.productionCost (per-kg production rate)
            // - devUnitCost  = devCostPrice × pmCapacity + packingCost (computed production cost)
            // Priority: stored purchase cost > computed production cost
            const inwardCost = Number(fg.costPrice) || 0;
            const packCapacity = Number(fg.pmCapacity) || 1;
            const packingCost = Number(fg.packingCost) || 0;
            const devUnitCost = (Number(fg.devCostPrice) || 0) * packCapacity + packingCost;
            const isProductionOnly = inwardCost === 0; // no stored purchaseCost
            const finalCost = inwardCost > 0 ? inwardCost : devUnitCost;
            costPriceMap.set(Number(fg.productId), { cost: finalCost, isProductionOnly });
          });

          const enhancedFgs = fgs.map((p: Product) => ({
            ...p,
            costPrice: costPriceMap.get(p.productId)?.cost || 0,
            isProductionCostSource: costPriceMap.get(p.productId)?.isProductionOnly ?? true,
          }));
          setProducts(enhancedFgs);
        } catch (e) {
          console.warn('Failed to load final goods pricing, skipping cost price auto-fill:', e);
          setProducts(fgs);
        }
      } catch (error) {
        console.error('Failed to load FG products', error);
        setProducts([]);
      }
    };

    const resetCurrentItem = () =>
      setCurrentItem({
        productId: 0,
        quantity: '',
        unitId: getDefaultUnitId(),
        totalPrice: '',
        unitPrice: 0,
        pricePerUnit: '',
        autoFilledCostPrice: 0,
        isProductionCostSource: false,
      });

    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      if (name === 'unitId') setCurrentItem(prev => ({ ...prev, unitId: Number(value) }));
      else setCurrentItem(prev => ({ ...prev, [name]: value }));
    };

    const handleBillChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setBillDetails(prev => ({ ...prev, [name]: value }));
    };

    const handleAddItem = async () => {
      setIsAddingProduct(true);
      try {
        if (!currentItem.productId || currentItem.productId === 0 || isNaN(currentItem.productId)) {
          showToast.error('Please select a product');
          return;
        }
        if (
          items.some(
            (item, idx) => item.productId === currentItem.productId && idx !== editingItemIndex
          )
        ) {
          showToast.error('This product is already added to the list. Please edit the existing item or remove it first.');
          return;
        }
        const qty = Number(currentItem.quantity);
        if (!currentItem.quantity || isNaN(qty) || qty <= 0) {
          showToast.error('Please enter a valid quantity');
          return;
        }
        const finalUnitId = currentItem.unitId || getDefaultUnitId();
        const selectedProduct = products.find(p => p.productId === currentItem.productId);

        const pricePerUnit = currentItem.pricePerUnit ? Number(currentItem.pricePerUnit) : 0;
        if (currentItem.pricePerUnit && (isNaN(pricePerUnit) || pricePerUnit < 0)) {
          showToast.error('Please enter a valid price per unit');
          return;
        }
        // Business rule: if the price shown was auto-filled from *production cost* (not a
        // stored purchaseCost) and the user did not change it, we still save the price in
        // the inward record (so it shows in Recent Inward Entries), but set skipCostUpdate=true
        // so the server does NOT overwrite masterProductFG.purchaseCost — keeping the label
        // "Production Cost" on the Update Product page instead of switching to "Material Inward".
        const priceWasChanged =
          pricePerUnit > 0 && Math.abs(pricePerUnit - currentItem.autoFilledCostPrice) > 0.001;
        const skipCostUpdate = currentItem.isProductionCostSource && !priceWasChanged;

        const newItem: InwardItemInput = {
          inwardId: currentItem.inwardId,
          masterProductId: selectedProduct?.masterProductId || currentItem.productId,
          productId: currentItem.productId,
          inwardDate: '',
          quantity: qty,
          unitId: finalUnitId,
          unitPrice: pricePerUnit,
          totalCost: pricePerUnit > 0 ? pricePerUnit * qty : 0,
          skipCostUpdate,
        };
        if (editingItemIndex !== null) {
          const u = [...items];
          u[editingItemIndex] = newItem;
          setItems(u);
          setEditingItemIndex(null);
        } else {
          setItems(prev => [...prev, newItem]);
        }
        resetCurrentItem();
      } catch (error) {
        console.error('Error adding item:', error);
      } finally {
        setIsAddingProduct(false);
      }
    };

    const handleEditItem = (index: number) => {
      const item = items[index];
      setCurrentItem({
        inwardId: item.inwardId,
        productId: item.productId || 0,
        quantity: String(item.quantity),
        unitId: item.unitId || getDefaultUnitId(),
        totalPrice: item.totalCost ? String(item.totalCost) : '',
        unitPrice: 0,
        pricePerUnit: item.unitPrice ? String(item.unitPrice) : '',
        // When editing a saved item, treat the stored price as a confirmed purchase cost
        // (not production-only) so editing it always saves the new value.
        autoFilledCostPrice: item.unitPrice || 0,
        isProductionCostSource: false,
      });
      setEditingItemIndex(index);
    };

    const handleRemoveItem = async (index: number) => {
      if (
        await confirmDialog({
          title: 'Remove Item',
          message: 'Are you sure you want to remove this item?',
          confirmLabel: 'Remove',
          variant: 'danger',
        })
      ) {
        setItems(prev => prev.filter((_, i) => i !== index));
        if (editingItemIndex === index) {
          setEditingItemIndex(null);
          resetCurrentItem();
        }
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      let newItemToAdd: InwardItemInput | null = null;
      if (currentItem.productId && currentItem.quantity) {
        const qty = Number(currentItem.quantity);
        if (
          !isNaN(qty) &&
          qty > 0 &&
          !items.some(
            (item, idx) => item.productId === currentItem.productId && idx !== editingItemIndex
          )
        ) {
          const selectedProduct = products.find(p => p.productId === currentItem.productId);
          const pendingPricePerUnit = currentItem.pricePerUnit ? Number(currentItem.pricePerUnit) : 0;
          // Same gate as handleAddItem — send actual price but flag skipCostUpdate when
          // the auto-filled production cost was not changed by the user.
          const pendingPriceWasChanged =
            pendingPricePerUnit > 0 &&
            Math.abs(pendingPricePerUnit - currentItem.autoFilledCostPrice) > 0.001;
          const pendingSkipCostUpdate = currentItem.isProductionCostSource && !pendingPriceWasChanged;
          newItemToAdd = {
            inwardId: currentItem.inwardId,
            masterProductId: selectedProduct?.masterProductId || currentItem.productId,
            productId: currentItem.productId,
            inwardDate: '',
            quantity: qty,
            unitId: currentItem.unitId || getDefaultUnitId(),
            unitPrice: pendingPricePerUnit,
            totalCost: pendingPricePerUnit > 0 ? pendingPricePerUnit * qty : 0,
            skipCostUpdate: pendingSkipCostUpdate,
          };
        }
      }
      if (items.length === 0 && !newItemToAdd) {
        showToast.error('Please add at least one product');
        return;
      }
      const finalItems = newItemToAdd ? [...items, newItemToAdd] : [...items];
      const payload: CreateInwardInput = {
        billNo: billDetails.billNo || '',
        supplierId: billDetails.supplierId,
        notes: billDetails.notes,
        items: finalItems.map(item => ({
          ...item,
          inwardDate: new Date(billDetails.inwardDate).toISOString(),
        })),
      };
      try {
        await onSubmit(payload);
        setItems([]);
        resetCurrentItem();
        setBillDetails({
          inwardDate: getLocalDateString(),
          notes: '',
          billNo: '',
          supplierId: undefined,
          rate: '',
        });
        resetCurrentItem();
        setEditingItemIndex(null);
      } catch (error) {
        console.error('Submit failed:', error);
      }
    };

    const getProductName = (item: InwardItemInput) => {
      const p = products.find(p => p.productId === item.productId);
      return p ? p.productName : `Product ID: ${item.productId}`;
    };

    const getUnitName = (id: number | undefined) =>
      units.find(u => u.UnitID === id)?.UnitName || '-';

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className="bg-[var(--surface)] p-6 rounded-lg shadow-md mb-6 border border-[var(--border)]"
      >
        <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Finished Goods Inward</h2>

        {/* Date Display */}
        <div className="flex justify-end items-center mb-4">
          <Calendar size={18} className="text-gray-500 mr-2" />
          <span className="text-md font-semibold text-gray-700">
            {billDetails.inwardDate.split('-').reverse().join('/')}
          </span>
        </div>

        {/* Bill-Level Fields: Supplier, Bill No */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-[var(--surface-secondary)] rounded-lg border border-[var(--border)]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Supplier Company Name{' '}
            </label>
            <SearchableSelect
              options={suppliers.map(s => ({
                id: s.supplierId,
                label: s.supplierName,
                value: s.supplierId,
              }))}
              value={billDetails.supplierId || undefined}
              onChange={val =>
                setBillDetails(prev => ({ ...prev, supplierId: val ? Number(val) : undefined }))
              }
              placeholder="Select Supplier"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Bill Number{' '}
            </label>
            <Input
              type="text"
              name="billNo"
              value={billDetails.billNo}
              onChange={handleBillChange}
              placeholder="e.g. INV-001"
            />
          </div>
        </div>

        {/* Item Entry Section */}
        <div
          ref={productEntrySectionRef}
          className="bg-[var(--surface-secondary)] p-4 rounded-lg border border-[var(--border)] mb-6"
        >
          <h3 className="text-md font-medium text-[var(--text-primary)] mb-4">
            {initialData
              ? 'Entry Details'
              : editingItemIndex !== null
                ? 'Edit Product'
                : 'Add Product'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Finished Good</label>
              <SearchableSelect
                options={products
                  .filter(
                    p =>
                      !items.some(
                        (item, index) => item.productId === p.productId && index !== editingItemIndex
                      )
                  )
                  .map(p => ({ id: p.productId, label: p.productName, value: p.productId }))}
                value={currentItem.productId || undefined}
                onChange={val => {
                  const productId = val ? Number(val) : 0;
                  const product = products.find(p => p.productId === productId);
                  const fetchedCostPrice =
                    product && (product as any).costPrice && (product as any).costPrice > 0
                      ? Number((product as any).costPrice)
                      : 0;
                  setCurrentItem(prev => ({
                    ...prev,
                    productId,
                    unitId: getDefaultUnitId() || product?.unitId || prev.unitId,
                    pricePerUnit: fetchedCostPrice > 0 ? fetchedCostPrice.toFixed(2) : '',
                    autoFilledCostPrice: fetchedCostPrice,
                    isProductionCostSource: (product as any)?.isProductionCostSource ?? false,
                  }));
                }}
                placeholder="Select Finished Good"
                required={items.length === 0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Quantity</label>
              <Input
                type="number"
                name="quantity"
                value={currentItem.quantity}
                onChange={handleItemChange}
                min="1"
                step="1"
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Unit</label>
              {/* System-assigned for Finished Goods (NO) — not user-editable */}
              <input
                type="text"
                value={units.find(u => u.UnitID === currentItem.unitId)?.UnitName || 'NO'}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-[var(--border)] rounded outline-none bg-[var(--surface)] text-[var(--text-primary)] opacity-60 cursor-not-allowed"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Price Per Unit
              </label>
              <Input
                type="number"
                name="pricePerUnit"
                value={currentItem.pricePerUnit}
                onChange={handleItemChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button
                type="button"
                onClick={handleAddItem}
                isLoading={isAddingProduct}
                disabled={isAddingProduct}
                className="w-full"
              >
                {!isAddingProduct && <Plus size={16} className="mr-2" />}
                {editingItemIndex !== null ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </div>
        </div>

        {/* Added Inventory Table */}
        {items.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-[var(--text-primary)] mb-3">Added Inventory</h3>
            <div className="overflow-x-auto border border-[var(--border)] rounded">
              <table className="w-full">
                <thead className="bg-[var(--surface-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase">
                      Product
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase">
                      Unit
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-[var(--text-primary)] uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`transition-colors duration-150 ${editingItemIndex === idx
                        ? 'bg-[var(--primary-light)] border-l-4 border-l-[var(--primary)]'
                        : 'hover:bg-[var(--surface-hover)]'
                        }`}
                    >
                      <td className="px-4 py-3 text-[var(--text-primary)] font-medium whitespace-nowrap">
                        {getProductName(item)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap">
                        {getUnitName(item.unitId)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditItem(idx)}
                            className="p-1.5 text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700">Notes</label>
          <textarea
            name="notes"
            value={billDetails.notes}
            onChange={handleBillChange}
            rows={3}
            className="w-full px-3 py-2 border border-[var(--border)] rounded focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none bg-[var(--surface)] text-[var(--text-primary)]"
            placeholder="Add any notes..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isLoading || (items.length === 0 && !currentItem.productId)}
          >
            {!isLoading && <Save size={16} className="mr-2" />}
            {initialData ? 'Update Inward' : 'Finish & Save Inward'}
          </Button>
        </div>
      </form>
    );
  }
);

FGInwardForm.displayName = 'FGInwardForm';
