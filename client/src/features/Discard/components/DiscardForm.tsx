import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui';
import { inventoryApi } from '@/features/inventory/api/inventoryApi';
import { CreateDiscardInput, DiscardEntry } from '../types';
import { Product } from '@/features/inventory/types';
import { Calendar, Save } from 'lucide-react';
import { showToast } from '@/utils/toast';
import { confirmDialog } from '@/components/ui';

interface DiscardFormProps {
  onSubmit: (data: CreateDiscardInput) => Promise<void>;
  isLoading?: boolean;
  initialData?: DiscardEntry | null;
  onCancel?: () => void;
  materialType?: 'RM' | 'PM' | 'FG';
  onMaterialTypeChange?: (type: 'RM' | 'PM' | 'FG') => void;
  onProductChange?: (productId?: number) => void;
}

interface DiscardFormState {
  productId: number;
  masterProductId: number;
  unitId: number;
  discardDate: string;
  quantityPerUnit: string;
  numberOfUnits: string;
  reason: string;
  notes: string;
}

// Helper function to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DiscardForm: React.FC<DiscardFormProps> = ({
  onSubmit,
  isLoading,
  initialData,
  onCancel,
  materialType: propMaterialType,
  onMaterialTypeChange,
  onProductChange,
}) => {
  // Separate states for different product types
  const [rmProducts, setRmProducts] = useState<Product[]>([]);
  const [pmProducts, setPmProducts] = useState<Product[]>([]);
  const [fgProducts, setFgProducts] = useState<Product[]>([]);

  const [internalMaterialType, setInternalMaterialType] = useState<'RM' | 'PM' | 'FG'>('RM');
  const materialType = propMaterialType || internalMaterialType;

  const [formData, setFormData] = useState<DiscardFormState>({
    productId: 0,
    masterProductId: 0,
    unitId: 0,
    discardDate: getLocalDateString(),
    quantityPerUnit: '1',
    numberOfUnits: '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    if (propMaterialType && propMaterialType !== internalMaterialType) {
      setInternalMaterialType(propMaterialType);
    }
  }, [propMaterialType]);

  useEffect(() => {
    loadProductsByType(materialType);
  }, [materialType]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        productId: initialData.productId,
        masterProductId: 0,
        unitId: 0,
        discardDate: initialData.discardDate,
        quantityPerUnit: '1',
        numberOfUnits: String(initialData.quantity),
        reason: initialData.reason || '',
        notes: initialData.notes || '',
      });
    } else {
      setFormData({
        productId: 0,
        masterProductId: 0,
        unitId: 0,
        discardDate: getLocalDateString(),
        quantityPerUnit: '1',
        numberOfUnits: '',
        reason: '',
        notes: '',
      });
    }
  }, [initialData]);

  const loadProductsByType = async (type: 'RM' | 'PM' | 'FG') => {
    try {
      if (type === 'RM') {
        // Fetch from master_products + master_product_rm
        const productsData = await inventoryApi.getMasterProductsByType('RM');
        setRmProducts(productsData);
      } else if (type === 'PM') {
        // Fetch from master_products + master_product_pm
        const productsData = await inventoryApi.getMasterProductsByType('PM');
        setPmProducts(productsData);
      } else {
        // Fetch from products table (SKUs)
        const productsData = await inventoryApi.getAllProducts();
        setFgProducts(productsData.filter((p: Product) => p.productType === 'FG'));
      }
    } catch (error) {
      console.error(`Failed to load ${type} products`, error);
    }
  };

  // Get current products based on material type
  const getCurrentProducts = (): Product[] => {
    if (materialType === 'RM') return rmProducts;
    if (materialType === 'PM') return pmProducts;
    return fgProducts;
  };

  // Get selected product details
  const getSelectedProduct = (): Product | undefined => {
    const products = getCurrentProducts();
    if (materialType === 'FG') {
      return products.find(p => p.productId === formData.productId);
    } else {
      // For RM/PM, we use masterProductId
      return products.find(p => p.masterProductId === formData.masterProductId);
    }
  };

  // Get available quantity from selected product
  const getAvailableQty = (): number => {
    const product = getSelectedProduct();
    if (!product) return 0;

    // For RM and PM, use AvailableQuantity from master product DTO
    // For FG, use availableQuantity from products table
    // Type assertion needed as Product type may not include all DTO fields
    return Number((product as any).AvailableQuantity || product.availableQuantity || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For RM/PM, we need masterProductId; for FG, we need productId
    const selectedId = materialType === 'FG' ? formData.productId : formData.masterProductId;

    if (selectedId === 0) {
      showToast.error('Please select a product');
      return;
    }

    const numUnits = Number(formData.numberOfUnits);

    if (isNaN(numUnits) || numUnits <= 0) {
      showToast.error('Quantity must be greater than 0');
      return;
    }

    if (!formData.reason || formData.reason.trim() === '') {
      showToast.error('Please provide a reason for the discard');
      return;
    }

    // Confirmation dialog
    const selectedProduct = getSelectedProduct();
    const productName =
      materialType === 'FG'
        ? selectedProduct?.productName
        : selectedProduct?.masterProductName || selectedProduct?.productName;

    const confirmed = await confirmDialog({
      title: 'Discard Material',
      message: `Are you sure you want to discard ${numUnits} units of "${productName}"?\n\nThis action cannot be undone.`,
      confirmLabel: 'Discard',
      variant: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const payload: CreateDiscardInput = {
      // For discard, we pass the appropriate ID based on type
      productId: materialType === 'FG' ? formData.productId : formData.masterProductId,
      productType: materialType,
      unitId: formData.unitId || undefined,
      discardDate: formData.discardDate,
      quantityPerUnit: 1,
      numberOfUnits: numUnits,
      reason: formData.reason,
      notes: formData.notes,
    };

    await onSubmit(payload);

    // After successful discard, update the local product state to reflect reduced quantity
    // This syncs RAM with database so the next selection shows updated stock
    if (materialType === 'FG') {
      setFgProducts(prevProducts =>
        prevProducts.map(product => {
          if (product.productId === formData.productId) {
            const currentQty = Number(product.availableQuantity || 0);
            return {
              ...product,
              availableQuantity: currentQty - numUnits,
            };
          }
          return product;
        })
      );
    } else if (materialType === 'RM') {
      setRmProducts(prevProducts =>
        prevProducts.map(product => {
          if (product.masterProductId === formData.masterProductId) {
            const currentQty = Number(
              (product as any).AvailableQuantity || product.availableQuantity || 0
            );
            return {
              ...product,
              AvailableQuantity: currentQty - numUnits,
              availableQuantity: currentQty - numUnits,
            };
          }
          return product;
        })
      );
    } else if (materialType === 'PM') {
      setPmProducts(prevProducts =>
        prevProducts.map(product => {
          if (product.masterProductId === formData.masterProductId) {
            const currentQty = Number(
              (product as any).AvailableQuantity || product.availableQuantity || 0
            );
            return {
              ...product,
              AvailableQuantity: currentQty - numUnits,
              availableQuantity: currentQty - numUnits,
            };
          }
          return product;
        })
      );
    }

    if (!initialData) {
      setFormData({
        productId: 0,
        masterProductId: 0,
        unitId: 0,
        discardDate: getLocalDateString(),
        quantityPerUnit: '1',
        numberOfUnits: '',
        reason: '',
        notes: '',
      });
    }
  };

  const handleProductChange = (value: string | number | undefined) => {
    const id = value ? Number(value) : 0;

    if (materialType === 'FG') {
      const product = fgProducts.find(p => p.productId === id);
      setFormData(prev => ({
        ...prev,
        productId: id,
        masterProductId: 0,
        unitId: product?.unitId || 0,
      }));
    } else {
      // For RM/PM, store masterProductId
      const products = materialType === 'RM' ? rmProducts : pmProducts;
      const product = products.find(p => p.masterProductId === id);
      setFormData(prev => ({
        ...prev,
        productId: 0,
        masterProductId: id,
        unitId: product?.unitId || 0,
      }));
    }

    if (onProductChange) {
      onProductChange(id !== 0 ? id : undefined);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'unitId' ? Number(value) : value,
    }));
  };

  const handleTabChange = (type: 'RM' | 'PM' | 'FG') => {
    setInternalMaterialType(type);
    if (onMaterialTypeChange) {
      onMaterialTypeChange(type);
    }
    if (onProductChange) {
      onProductChange(undefined);
    }
    setFormData(prev => ({
      ...prev,
      productId: 0,
      masterProductId: 0,
      unitId: 0,
      numberOfUnits: '',
    }));
  };

  const currentProducts = getCurrentProducts();
  const selectedProduct = getSelectedProduct();
  const availableQty = getAvailableQty();
  const discardQty = Number(formData.numberOfUnits || 0);
  const remainingQty = availableQty - discardQty;

  // Get the correct ID for the dropdown value
  const getDropdownValue = () => {
    if (materialType === 'FG') {
      return formData.productId || undefined;
    }
    return formData.masterProductId || undefined;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--surface)] p-6 rounded-lg shadow-md mb-6 border border-[var(--border)]"
    >
      {/* Material Type Tab Selector - styled like InwardForm */}
      <div className="mb-8">
        <div className="flex p-1 bg-[var(--surface)] rounded-xl shadow-sm border border-[var(--border)]">
          <button
            type="button"
            onClick={() => handleTabChange('RM')}
            className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
              materialType === 'RM'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Raw Material
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('PM')}
            className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
              materialType === 'PM'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Packaging Material
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('FG')}
            className={`flex-1 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
              materialType === 'FG'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary-light)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Finished Good
          </button>
        </div>
      </div>

      {/* Date Display - styled like InwardForm */}
      <div className="flex justify-end items-center mb-4">
        <Calendar size={18} className="text-gray-500 mr-2" />
        <span className="text-md font-semibold text-gray-700">
          {formData.discardDate.split('-').reverse().join('/')}
        </span>
      </div>

      {/* Product Entry Section - styled like InwardForm */}
      <div className="bg-[var(--surface-secondary)] p-4 rounded-lg border border-[var(--border)] mb-6">
        <h3 className="text-md font-medium text-[var(--text-primary)] mb-4">
          {initialData ? 'Edit Discard Entry' : 'Discard Details'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {materialType === 'RM'
                ? 'Raw Material'
                : materialType === 'PM'
                  ? 'Packaging Material'
                  : 'Finished Good'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={currentProducts.map(p => ({
                id: materialType === 'FG' ? p.productId : p.masterProductId || 0,
                label:
                  materialType === 'FG'
                    ? p.productName || 'Unknown'
                    : p.masterProductName || p.productName || 'Unknown',
                value: materialType === 'FG' ? p.productId : p.masterProductId || 0,
              }))}
              value={getDropdownValue()}
              onChange={handleProductChange}
              placeholder={`Select ${materialType === 'RM' ? 'Raw Material' : materialType === 'PM' ? 'Packaging Material' : 'Finished Good'}`}
              required
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Discard Quantity <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              name="numberOfUnits"
              value={formData.numberOfUnits}
              onChange={handleChange}
              min="0.01"
              step="0.01"
              required
              placeholder="Enter quantity"
            />
          </div>

          {/* Stock Info Display - shown when product is selected */}
          {selectedProduct && (
            <div className="col-span-1 md:col-span-2 mt-1 text-sm space-y-1 bg-[var(--surface)] p-3 rounded border border-[var(--border)]">
              <div className="flex justify-between items-center">
                <div className="text-[var(--text-secondary)]">
                  Available Stock:{' '}
                  <span className="font-medium text-blue-600">{availableQty.toFixed(4)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[var(--text-secondary)]">
                    To Discard:{' '}
                    <span className="font-medium text-red-600">-{discardQty.toFixed(4)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        numberOfUnits: String(availableQty),
                      }));
                    }}
                  >
                    Max
                  </Button>
                </div>
                <div
                  className={`${remainingQty < 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}
                >
                  Remaining: <span className="font-medium">{remainingQty.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="col-span-1 md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Reason / Remark <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Reason for discard"
              required
            />
          </div>
        </div>
      </div>

      {/* Actions - styled like InwardForm */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={isLoading || remainingQty < 0}
          className="bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
          title={remainingQty < 0 ? 'Cannot discard more than available stock' : ''}
        >
          {!isLoading && <Save size={16} className="mr-2" />}
          {initialData ? 'Update Discard' : 'Save Discard'}
        </Button>
      </div>
    </form>
  );
};
