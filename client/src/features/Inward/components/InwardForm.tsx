import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui';
import { inventoryApi } from '@/features/inventory/api/inventoryApi';
import { unitApi } from '@/features/masters/api/unitApi';
import { inwardApi } from '../api/inwardApi';
import { suppliersApi, Supplier } from '@/api/suppliersApi';
import { CreateInwardInput, InwardEntry, InwardItemInput } from '../types';
import { Product } from '@/features/inventory/types';
import { Unit } from '@/features/masters/types';
import { Calendar, Plus, Trash2, Save, Edit2 } from 'lucide-react';
import { showToast } from '@/utils/toast';

interface InwardFormProps {
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
  unitPrice: string;
  totalPrice: number;
}

// Helper function to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const InwardForm = React.forwardRef<HTMLFormElement, InwardFormProps>(
  ({ onSubmit, isLoading, initialData, onCancel, onDirtyStateChange }, ref) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [activeTab, setActiveTab] = useState<'RM' | 'PM'>('RM');

    const productEntrySectionRef = React.useRef<HTMLDivElement>(null);

    const [billDetails, setBillDetails] = useState({
      billNo: '',
      supplierId: 0,
      supplierName: '',
      inwardDate: getLocalDateString(),
      notes: '',
    });

    const [items, setItems] = useState<InwardItemInput[]>([]);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    const [currentItem, setCurrentItem] = useState<CurrentItemState>({
      productId: 0,
      quantity: '',
      unitId: 0,
      unitPrice: '',
      totalPrice: 0,
    });

    useEffect(() => {
      if (onDirtyStateChange) {
        onDirtyStateChange(items.length > 0);
      }
    }, [items, onDirtyStateChange]);

    useEffect(() => {
      loadData();
    }, []);

    useEffect(() => {
      loadProductsByType(activeTab);
    }, [activeTab]);

    useEffect(() => {
      if (units.length > 0 && currentItem.unitId === 0) {
        const defaultId = getDefaultUnitId(activeTab);
        if (defaultId) {
          setCurrentItem(prev => ({ ...prev, unitId: defaultId }));
        }
      }
    }, [units, activeTab]);

    useEffect(() => {
      if (initialData && initialData.length > 0) {
        const firstItem = initialData[0];

        setBillDetails({
          billNo: firstItem.billNo || '',
          supplierId: firstItem.supplierId || 0,
          supplierName: firstItem.supplierName || '',
          inwardDate: firstItem.inwardDate
            ? new Date(firstItem.inwardDate).toISOString().split('T')[0]
            : getLocalDateString(),
          notes: firstItem.notes || '',
        });

        const mappedItems: InwardItemInput[] = initialData.map(entry => ({
          inwardId: entry.inwardId,
          masterProductId: entry.productId,
          inwardDate: entry.inwardDate,
          quantity: Number(entry.quantity),
          unitId: entry.unitId,
          unitPrice: Number(entry.unitPrice),
          totalCost: entry.totalCost || Number(entry.quantity) * Number(entry.unitPrice),
        }));
        setItems(mappedItems);
        resetCurrentItem();

        if (
          firstItem.productType &&
          (firstItem.productType === 'RM' || firstItem.productType === 'PM')
        ) {
          setActiveTab(firstItem.productType);
        }
      } else {
        setBillDetails({
          billNo: '',
          supplierId: 0,
          supplierName: '',
          inwardDate: getLocalDateString(),
          notes: '',
        });
        setItems([]);
        resetCurrentItem();
      }
    }, [initialData]);

    const loadData = async () => {
      try {
        const [unitsData, suppliersData] = await Promise.all([
          unitApi.getAll().then(res => res.data),
          suppliersApi.getAll({ isActive: true }),
        ]);
        // Normalize unit objects to expected shape { UnitID, UnitName }
        const normalizedUnits = (unitsData || []).map((u: any) => ({
          UnitID: u.UnitID ?? u.unitId ?? u.id ?? 0,
          UnitName: u.UnitName ?? u.unitName ?? u.name ?? '',
          UnitSymbol: u.UnitSymbol ?? u.unitSymbol ?? u.symbol ?? undefined,
        }));

        // Debug: log units for verification
        // eslint-disable-next-line no-console
        console.debug('InwardForm: unitsData ->', unitsData);
        // eslint-disable-next-line no-console
        console.debug('InwardForm: normalizedUnits ->', normalizedUnits);

        setUnits(normalizedUnits);
        setSuppliers(suppliersData || []);
      } catch (error) {
        console.error('Failed to load data', error);
      }
    };

    const loadProductsByType = async (type: 'RM' | 'PM') => {
      try {
        const productsData = await inventoryApi.getMasterProductsByType(type);
        setProducts(productsData);
      } catch (error) {
        console.error(`Failed to load ${type} products`, error);
        setProducts([]);
      }
    };

    const getDefaultUnitId = (type: 'RM' | 'PM') => {
      const targetName = type === 'RM' ? 'KG' : 'NO';
      return units.find(u => u.UnitName === targetName)?.UnitID || 0;
    };

    const resetCurrentItem = () => {
      setCurrentItem({
        productId: 0,
        quantity: '',
        unitId: getDefaultUnitId(activeTab),
        unitPrice: '',
        totalPrice: 0,
      });
    };

    const handleTabChange = (tab: 'RM' | 'PM') => {
      if (initialData || items.length > 0) {
        alert('Cannot change product type after adding products');
        return;
      }
      setActiveTab(tab);
      // Reset with new default unit
      setCurrentItem({
        productId: 0,
        quantity: '',
        unitId: getDefaultUnitId(tab),
        unitPrice: '',
        totalPrice: 0,
      });
    };

    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;

      // Prevent accepting zero as unit price
      if (name === 'unitPrice') {
        const num = parseFloat(String(value));
        if (!isNaN(num) && num === 0) {
          showToast.error('Enter a non-zero value for Unit Price');
          return;
        }
      }

      setCurrentItem(prev => {
        const updated = { ...prev, [name]: name === 'unitId' ? Number(value) : value } as any;

        // Sync quantity, unitPrice and totalPrice
        if (name === 'quantity' || name === 'unitPrice') {
          const qty = Number(name === 'quantity' ? value : updated.quantity);
          const unitPx = Number(name === 'unitPrice' ? value : updated.unitPrice);

          if (!isNaN(qty) && !isNaN(unitPx)) {
            updated.totalPrice = qty * unitPx;
          }
        } else if (name === 'totalPrice') {
          const total = Number(value);
          const qty = Number(updated.quantity);
          if (qty > 0 && !isNaN(total)) {
            updated.unitPrice = String(total / qty);
          }
        }

        return updated;
      });
    };

    const handleBillChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setBillDetails(prev => ({ ...prev, [name]: value }));
    };

    const handleAddItem = async () => {
      setIsAddingProduct(true);
      try {
        if (!currentItem.productId || currentItem.productId === 0 || isNaN(currentItem.productId)) {
          alert('Please select a product');
          return;
        }

        if (
          items.some(
            (item, idx) =>
              item.masterProductId === currentItem.productId && idx !== editingItemIndex
          )
        ) {
          alert(
            'This product is already added to the list. Please edit the existing item or remove it first.'
          );
          return;
        }

        // Bill number validation for RM/PM
        // Validation removed to allow creating separate entries even with same details
        /*
        if (billDetails.billNo && !initialData) {
          if (!billDetails.supplierId) {
            alert('Please select a supplier before adding products');
            return;
          }

          try {
             // ... duplicate check removed ...
          } catch (error) {
            console.error('Error checking bill number:', error);
          }
        }
        */

        const qty = Number(currentItem.quantity);
        if (!currentItem.quantity || isNaN(qty)) {
          alert('Please enter a valid quantity');
          return;
        }

        if (activeTab === 'PM' && (qty <= 1 || !Number.isInteger(qty))) {
          alert('Purchased Qty for Packing Material must be a whole number greater than 1');
          return;
        }

        if (activeTab === 'RM' && qty <= 0) {
          alert('Purchased Qty for Raw Material must be greater than 0');
          return;
        }

        const finalUnitId =
          currentItem.unitId ||
          products.find(p => p.masterProductId === currentItem.productId)?.unitId ||
          getDefaultUnitId(activeTab);

        if (!finalUnitId) {
          alert('Please select a unit');
          return;
        }

        const unitPx = currentItem.unitPrice ? Number(currentItem.unitPrice) : 0;
        const total = qty > 0 && unitPx > 0 ? qty * unitPx : 0;

        const newItem: InwardItemInput = {
          inwardId: currentItem.inwardId,
          masterProductId: currentItem.productId,
          inwardDate: '',
          quantity: qty,
          unitId: finalUnitId,
          unitPrice: unitPx,
          totalCost: total,
        };

        if (editingItemIndex !== null) {
          const updatedItems = [...items];
          updatedItems[editingItemIndex] = newItem;
          setItems(updatedItems);
          setEditingItemIndex(null);
        } else {
          setItems(prev => [...prev, newItem]);
        }

        resetCurrentItem();
      } catch (error) {
        alert((error as any).message || 'Failed to add item');
      } finally {
        setIsAddingProduct(false);
      }
    };

    const handleEditItem = (index: number) => {
      const item = items[index];

      setCurrentItem({
        inwardId: item.inwardId,
        productId: item.masterProductId,
        quantity: String(item.quantity),
        unitId: item.unitId || 0,
        unitPrice: item.unitPrice ? String(item.unitPrice) : '',
        totalPrice: item.totalCost || 0,
      });
      setEditingItemIndex(index);

      setTimeout(() => {
        productEntrySectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    };

    const handleRemoveItem = (index: number) => {
      if (editingItemIndex === index) {
        setEditingItemIndex(null);
        resetCurrentItem();
      }
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      let newItemToAdd: InwardItemInput | null = null;

      // Check if there is a pending item (product selected and quantity entered)
      if (currentItem.productId && currentItem.quantity) {
        try {
          // Validate and create the item object similar to handleAddItem logic
          const qty = Number(currentItem.quantity);
          if (isNaN(qty)) {
            alert('Invalid quantity for the pending item.');
            return;
          }

          if (activeTab === 'PM' && (qty <= 1 || !Number.isInteger(qty))) {
            alert('Purchased Qty for Packing Material must be a whole number greater than 1');
            return;
          }

          if (activeTab === 'RM' && qty <= 0) {
            alert('Purchased Qty for Raw Material must be greater than 0');
            return;
          }

          const finalUnitId =
            currentItem.unitId ||
            products.find(p => p.masterProductId === currentItem.productId)?.unitId;
          if (!finalUnitId) {
            alert('Please select a unit for the pending item.');
            return;
          }

          const unitPriceVal = currentItem.unitPrice ? Number(currentItem.unitPrice) : 0;
          const total = qty * unitPriceVal;

          newItemToAdd = {
            inwardId: currentItem.inwardId,
            masterProductId: currentItem.productId,
            inwardDate: '', // Will be set later
            quantity: qty,
            unitId: finalUnitId,
            unitPrice: unitPriceVal,
            totalCost: total,
          };
        } catch (e) {
          // Ignore or handle
          console.warn('Could not auto-add pending item', e);
        }
      }

      if (items.length === 0 && !newItemToAdd) {
        alert('Please add at least one item before finishing.');
        return;
      }

      try {
        if (!billDetails.supplierId) {
          alert('Please select a supplier');
          return;
        }

        const isoDate = new Date(billDetails.inwardDate).toISOString();

        const finalItems = [...items];
        if (newItemToAdd) {
          finalItems.push(newItemToAdd);
        }

        const itemsWithDate = finalItems.map(item => {
          const processedItem = {
            ...item,
            inwardDate: isoDate,
          };
          return processedItem;
        });

        const payload: CreateInwardInput = {
          billNo: billDetails.billNo,
          supplierId: billDetails.supplierId,
          notes: billDetails.notes,
          items: itemsWithDate,
        };

        await onSubmit(payload);

        // After successful submission, update the products state with new purchaseCost values
        // This syncs the RAM with the database so next selection shows updated prices
        setProducts(prevProducts =>
          prevProducts.map(product => {
            // Find if this product was submitted with a new price
            const submittedItem = finalItems.find(
              item => item.masterProductId === product.masterProductId
            );

            // Only update if the item was submitted with a price > 0
            if (submittedItem && submittedItem.unitPrice && submittedItem.unitPrice > 0) {
              return {
                ...product,
                purchaseCost: submittedItem.unitPrice,
              };
            }
            return product;
          })
        );

        if (!initialData) {
          setItems([]);
          setBillDetails({
            billNo: '',
            supplierId: 0,
            supplierName: '',
            inwardDate: getLocalDateString(),
            notes: '',
          });
          resetCurrentItem();
        }
      } catch (error) {
        alert((error as any).response?.data?.message || 'Failed to submit inward entry');
      }
    };

    const getProductName = (id: number) => {
      const product = products.find(p => p.masterProductId === id);
      return product?.masterProductName || 'Unknown';
    };

    const getUnitName = (id: number | undefined) =>
      units.find(u => u.UnitID === id)?.UnitName || '-';

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className="bg-[var(--surface)] p-6 rounded-lg shadow-md mb-6 border border-[var(--border)]"
      >
        <div className="mb-8">
          <div className="flex p-1 bg-[var(--surface)] rounded-xl shadow-sm border border-[var(--border)]">
            <button
              type="button"
              onClick={() => handleTabChange('RM')}
              disabled={(!!initialData || items.length > 0) && activeTab !== 'RM'}
              className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${activeTab === 'RM'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : !!initialData || items.length > 0
                  ? 'text-[var(--text-disabled)] cursor-not-allowed opacity-50'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              title={
                (!!initialData || items.length > 0) && activeTab !== 'RM'
                  ? 'Cannot change product type after adding products'
                  : ''
              }
            >
              Raw Material
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('PM')}
              disabled={(!!initialData || items.length > 0) && activeTab !== 'PM'}
              className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${activeTab === 'PM'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : !!initialData || items.length > 0
                  ? 'text-[var(--text-disabled)] cursor-not-allowed opacity-50'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              title={
                (!!initialData || items.length > 0) && activeTab !== 'PM'
                  ? 'Cannot change product type after adding products'
                  : ''
              }
            >
              Packaging Material
            </button>
          </div>
        </div>

        {/* Bill Details Section */}
        <div className="flex justify-end items-center mb-4">
          <Calendar size={18} className="text-gray-500 mr-2" />
          <span className="text-md font-semibold text-gray-700">
            {billDetails.inwardDate.split('-').reverse().join('/')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={suppliers.map(s => ({
                id: s.supplierId,
                label: s.supplierName,
                value: s.supplierId,
              }))}
              value={billDetails.supplierId || undefined}
              onChange={val => {
                const selectedSupplier = suppliers.find(s => s.supplierId === Number(val));
                setBillDetails(prev => ({
                  ...prev,
                  supplierId: Number(val),
                  supplierName: selectedSupplier?.supplierName || '',
                }));
              }}
              creatable={true}
              onCreateNew={async newSupplierName => {
                try {
                  const newSupplier = await suppliersApi.create({
                    supplierName: newSupplierName,
                  });
                  setSuppliers(prev => [...prev, newSupplier]);
                  setBillDetails(prev => ({
                    ...prev,
                    supplierId: newSupplier.supplierId,
                    supplierName: newSupplier.supplierName,
                  }));
                } catch (error) {
                  alert((error as any).response?.data?.message || 'Failed to create supplier');
                }
              }}
              placeholder="Type or select supplier"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Bill No</label>
            <Input
              type="text"
              name="billNo"
              value={billDetails.billNo}
              onChange={handleBillChange}
              placeholder="Enter bill number"
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
              <label className="text-sm font-medium text-gray-700">
                {activeTab === 'RM' ? 'Raw Material' : 'Packaging Material'}
              </label>
              <SearchableSelect
                options={products
                  .filter(p => {
                    const isAlreadyAdded = items.some(
                      (item, index) =>
                        (item.masterProductId || item.productId) === (p.masterProductId || 0) &&
                        index !== editingItemIndex
                    );
                    return !isAlreadyAdded;
                  })
                  .map(p => ({
                    id: p.masterProductId || 0,
                    label: p.masterProductName || p.productName || 'Unknown',
                    value: p.masterProductId || 0,
                  }))}
                value={currentItem.productId || undefined}
                onChange={val => {
                  const productId = val ? Number(val) : 0;
                  const product = products.find(p => p.masterProductId === productId);
                  const price = product?.purchaseCost || 0;

                  setCurrentItem(prev => ({
                    ...prev,
                    productId,
                    unitPrice: String(price),
                    totalPrice: prev.quantity ? Number(prev.quantity) * price : 0,
                  }));
                }}
                placeholder={`Select ${activeTab === 'RM' ? 'Raw Material' : 'Packaging Material'}`}
                required={items.length === 0}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Purchased Qty</label>
              <Input
                type="number"
                name="quantity"
                value={currentItem.quantity}
                onChange={handleItemChange}
                min={activeTab === 'PM' ? "2" : "0.001"}
                step={activeTab === 'PM' ? "1" : "any"}
                placeholder={activeTab === 'PM' ? "2" : "1"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Unit</label>
              <select
                name="unitId"
                value={currentItem.unitId}
                onChange={handleItemChange}
                className="w-full px-3 py-2 border border-[var(--border)] rounded focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none bg-[var(--surface)] text-[var(--text-primary)]"
              >
                <option value="">Select Unit</option>
                {units.map(unit => (
                  <option key={unit.UnitID} value={unit.UnitID}>
                    {unit.UnitName}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Price Per Unit</label>
              <Input
                type="number"
                name="unitPrice"
                value={currentItem.unitPrice}
                onChange={handleItemChange}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              {currentItem.totalPrice > 0 && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Total Price: ₹{currentItem.totalPrice.toFixed(2)}
                </p>
              )}
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
                      Purchased Qty
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-primary)] uppercase">
                      Unit
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[var(--text-primary)] uppercase">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-[var(--text-primary)] uppercase">
                      Total Price
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
                        {getProductName(item.masterProductId)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap">
                        {getUnitName(item.unitId)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap text-right">
                        ₹{(item.unitPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] font-semibold whitespace-nowrap text-right">
                        ₹{(item.totalCost || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditItem(idx)}
                            className="p-1.5 text-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-md transition-colors duration-150"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors duration-150"
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
            {initialData ? 'Update Bill' : 'Finish & Save Bill'}
          </Button>
        </div>
      </form>
    );
  }
);

InwardForm.displayName = 'InwardForm';
