import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, X, Trash2, Search, Calculator, TrendingUp, Edit2 } from 'lucide-react';
import { Button, Input, Select, SearchableSelect } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { productApi, masterProductApi } from '../api';
import { Product, MasterProduct } from '../types';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { handleApiError } from '@/utils/errorHandler';
import apiClient from '@/api/client';
import { confirmDialog } from '@/components/ui';

const API_PREFIX = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const ProductMaster = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [pmMasterProducts, setPmMasterProducts] = useState<MasterProduct[]>([]);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    ProductType: 'FG',
    UnitID: 1,
    IncentiveAmount: 0,
    PackQty: 0,
    SellingPrice: 0,
    MinStockLevel: 0,
    FillingDensity: 0,
    IsFdSyncWithDensity: true, // Default: synced with density
  });

  // Search states for dropdowns
  // const [mpSearchTerm, setMpSearchTerm] = useState(''); // Handled by SearchableSelect
  // const [showMpDropdown, setShowMpDropdown] = useState(false);
  // const [pmSearchTerm, setPmSearchTerm] = useState('');
  // const [showPmDropdown, setShowPmDropdown] = useState(false);

  // Table search
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Pending edit ID from URL params (to be applied after products load)
  const [pendingEditId, setPendingEditId] = useState<number | null>(null);

  // No longer need manual calculation states
  // const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  // const [costBreakdown, setCostBreakdown] = useState<any>(null);
  // const [calculatingCost, setCalculatingCost] = useState(false);
  // const [recalculatingAll, setRecalculatingAll] = useState(false);

  // Read URL params on mount
  useEffect(() => {
    const editIdParam = searchParams.get('editId');

    if (editIdParam) {
      setPendingEditId(Number(editIdParam));
      // Clear URL params after reading
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Apply pending edit when products are loaded
  useEffect(() => {
    if (pendingEditId && products.length > 0) {
      const productToEdit = products.find(p => p.ProductID === pendingEditId);
      if (productToEdit) {
        handleEdit(productToEdit);
        showToast.success(`Editing: ${productToEdit.ProductName}`);
      } else {
        showToast.error('Product not found');
      }
      setPendingEditId(null);
    }
  }, [pendingEditId, products]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsRes, fgRes, pmRes] = await Promise.all([
        productApi.getAll(),
        masterProductApi.getAll({ type: 'FG' }),
        masterProductApi.getAll({ type: 'PM' }),
      ]);

      if (productsRes.success && productsRes.data) {
        setProducts(productsRes.data);
      }

      if (fgRes.success && fgRes.data) {
        setMasterProducts(fgRes.data);
      }

      if (pmRes.success && pmRes.data) {
        setPmMasterProducts(pmRes.data);
      }
    } catch (error) {
      logger.error('Failed to load data:', error);
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setIsEditing(false);
    setSelectedProduct(null);
    setFormData({
      ProductType: 'FG',
      UnitID: 1,
      IncentiveAmount: 0,
      PackQty: 0,
      SellingPrice: 0,
      MinStockLevel: 0,
      FillingDensity: 0,
      IsFdSyncWithDensity: true, // Default: synced with density
    });
  };

  const handleEdit = async (product: Product) => {
    setIsEditing(true);
    setSelectedProduct(product);

    // Scroll to form
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // When editing, we might want to refresh the cost/density from the master product
    // or just show what was stored. However, for "Direct Display" requirement,
    // we should try to show current Master Product values.

    let density = product.Density;
    let cost = product.RawMaterialCost;

    // Try to find fresh values from loaded master products
    if (product.MasterProductID) {
      const mp = masterProducts.find(m => m.masterProductId === product.MasterProductID);
      if (mp) {
        density = mp.FGDensity || density;
        cost = mp.ProductionCost || cost;
      }
    }

    // Set FillingDensity: use product value if exists, otherwise use density
    const fillingDensity = product.FillingDensity || density;
    // IsFdSyncWithDensity: use product value if exists (from DB), default TRUE for new
    const isSynced = product.IsFdSyncWithDensity ?? true;

    setFormData({
      ...product,
      Density: density,
      RawMaterialCost: cost,
      FillingDensity: fillingDensity,
      IsFdSyncWithDensity: isSynced,
    });
  };

  const handleSave = async () => {
    if (!formData.ProductName || !formData.MasterProductID || !formData.PackagingId) {
      showToast.error('Product Name, Master Product, and Packed In are required');
      return;
    }

    // Check for duplicate product name within the same Master Product
    if (!isEditing) {
      const duplicateProduct = products.find(
        p =>
          p.MasterProductID === formData.MasterProductID &&
          p.ProductName.toLowerCase().trim() === formData.ProductName!.toLowerCase().trim()
      );

      if (duplicateProduct) {
        showToast.error(
          `Product "${formData.ProductName!}" already exists under this Master Product. Please use a different name or select the existing product.`
        );
        return;
      }
    } else if (selectedProduct) {
      // When editing, check for duplicates excluding the current product
      const duplicateProduct = products.find(
        p =>
          p.ProductID !== selectedProduct.ProductID &&
          p.MasterProductID === formData.MasterProductID &&
          p.ProductName.toLowerCase().trim() === formData.ProductName!.toLowerCase().trim()
      );

      if (duplicateProduct) {
        showToast.error(
          `Product "${formData.ProductName!}" already exists under this Master Product. Please use a different name.`
        );
        return;
      }
    }

    try {
      setSaving(true);

      // These three fields are edited as raw strings (so decimals/backspace work);
      // convert them back to numbers before sending. Empty → 0.
      const num = (v: unknown, isInt = false) => {
        if (v === '' || v === null || v === undefined) return 0;
        const n = isInt ? parseInt(String(v), 10) : parseFloat(String(v));
        return Number.isFinite(n) ? n : 0;
      };
      const payload = {
        ...formData,
        MinStockLevel: num(formData.MinStockLevel, true),
        SellingPrice: num(formData.SellingPrice),
        IncentiveAmount: num(formData.IncentiveAmount),
      } as Product;

      if (isEditing && selectedProduct) {
        logger.info('Updating product:', { id: selectedProduct.ProductID, data: payload });
        const response = await productApi.update(selectedProduct.ProductID, payload);
        logger.info('Update response:', response);

        if (response.success && response.data) {
          showToast.success('Product updated successfully');
          handleNew();
          loadData();
        } else if (!response.success) {
          logger.error('Update failed:', response.error);
          showToast.error(response.error || 'Failed to update product');
        }
      } else {
        logger.info('Creating product:', payload);
        const response = await productApi.create(payload);
        logger.info('Create response:', response);

        if (response.success && response.data) {
          showToast.success('Product created successfully');
          handleNew();
          setFormKey(prev => prev + 1); // Force form reset
          loadData();
        } else if (!response.success) {
          logger.error('Create failed:', response.error);
          showToast.error(response.error || 'Failed to create product');
        }
      }
    } catch (error) {
      const action = isEditing ? 'update product' : 'create product';
      handleApiError(error, action);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !(await confirmDialog({
        title: 'Delete Product',
        message: 'Are you sure you want to delete this product?',
        confirmLabel: 'Delete',
        variant: 'danger',
      }))
    )
      return;

    try {
      logger.info('Deleting product:', { id });
      const response = await productApi.delete(id);

      // Only update state and show success if server responds successfully
      if (response.success) {
        showToast.success('Product deleted successfully');
        logger.info('Product deleted successfully:', { id });

        if (selectedProduct?.ProductID === id) {
          handleNew();
        }
        setProducts(prev => prev.filter(p => p.ProductID !== id));
      } else {
        // Server returned error
        logger.error('Delete failed:', response.error);
        showToast.error(response.error || 'Failed to delete product');
      }
    } catch (error) {
      handleApiError(error, 'delete product');
    }
  };

  // const filteredMasterProducts = masterProducts.filter(mp =>
  //   mp.masterProductName.toLowerCase().includes(mpSearchTerm.toLowerCase())
  // );

  // const filteredPmMasterProducts = pmMasterProducts.filter(mp =>
  //   mp.masterProductName.toLowerCase().includes(pmSearchTerm.toLowerCase())
  // );

  const filteredProducts = products.filter(
    p =>
      p.ProductName.toLowerCase().includes(tableSearchQuery.toLowerCase()) ||
      p.ProductID.toString().includes(tableSearchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="Sub Product Master" description="Manage individual SKUs" />

      <div className="flex flex-col gap-6">
        {/* Top: Form */}
        <div ref={formRef} className="card p-6 w-full">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
              {isEditing ? 'Edit Product' : 'New Product'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Row 1 */}
              {/* Master Product Search */}
              <SearchableSelect
                label="Master Product (FG)"
                placeholder="Search or click to select..."
                options={masterProducts.map(mp => ({
                  id: mp.masterProductId,
                  label: mp.masterProductName || '',
                  value: mp.masterProductId,
                }))}
                value={formData.MasterProductID}
                disabled={saving}
                onChange={async val => {
                  if (!val) {
                    setFormData(prev => ({
                      ...prev,
                      MasterProductID: undefined,
                      Density: 0,
                      RawMaterialCost: 0,
                      FillingDensity: 0,
                    }));
                    return;
                  }

                  // Find selected product to get basic info
                  const selectedMp = masterProducts.find(mp => mp.masterProductId === val);

                  // Directly use values from the Master Product list if available
                  const density = selectedMp?.FGDensity || 0;
                  const productionCost = selectedMp?.ProductionCost || 0;

                  setFormData(prev => ({
                    ...prev,
                    MasterProductID: val,
                    Density: density,
                    RawMaterialCost: productionCost,
                    // If synced, update FillingDensity to match Density
                    FillingDensity: prev.IsFdSyncWithDensity ? density : prev.FillingDensity,
                  }));
                }}
                required
              />

              <SearchableSelect
                label="Product Name"
                placeholder="Search existing or create new..."
                options={
                  formData.MasterProductID
                    ? products
                        .filter(p => p.MasterProductID === formData.MasterProductID)
                        .map(p => ({
                          id: p.ProductID,
                          label: p.ProductName,
                          value: p.ProductName,
                        }))
                    : []
                }
                value={formData.ProductName}
                onChange={val => {
                  setFormData(prev => ({ ...prev, ProductName: val }));
                }}
                creatable={true}
                onCreateNew={newProductName => {
                  setFormData(prev => ({ ...prev, ProductName: newProductName }));
                }}
                allowCustomValue={true}
                required
                disabled={saving || !formData.MasterProductID}
              />

              {/* Packed In (PM Search) */}
              <SearchableSelect
                label="Packed In (PM)"
                placeholder="Search or click to select..."
                options={pmMasterProducts.map(mp => ({
                  id: mp.masterProductId,
                  label: mp.masterProductName || '',
                  value: mp.masterProductId,
                }))}
                value={formData.PackagingId}
                disabled={saving}
                onChange={async val => {
                  setFormData(prev => ({ ...prev, PackagingId: val }));
                  // Logic for capacity is handled in backend
                }}
                required
              />

              {/* Row 2 */}
              {/* Removed Package Capacity and Unit - Handled in Backend */}

              <Input
                label="Min Stock Level"
                type="text"
                inputMode="numeric"
                disabled={saving}
                // Show empty for a real numeric 0/blank (so the field isn't stuck on "0"
                // and Backspace can clear it), but keep any raw string the user types.
                value={
                  formData.MinStockLevel === 0 || formData.MinStockLevel == null
                    ? ''
                    : String(formData.MinStockLevel)
                }
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || /^\d*$/.test(v)) {
                    setFormData(prev => ({ ...prev, MinStockLevel: v as unknown as number }));
                  }
                }}
                placeholder="0"
              />

              <Input
                label="Selling Price"
                type="text"
                inputMode="decimal"
                disabled={saving}
                value={
                  formData.SellingPrice === 0 || formData.SellingPrice == null
                    ? ''
                    : String(formData.SellingPrice)
                }
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) {
                    setFormData(prev => ({ ...prev, SellingPrice: v as unknown as number }));
                  }
                }}
                placeholder="0.00"
              />

              <Input
                label="Incentive"
                type="text"
                inputMode="decimal"
                disabled={saving}
                value={
                  formData.IncentiveAmount === 0 || formData.IncentiveAmount == null
                    ? ''
                    : String(formData.IncentiveAmount)
                }
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) {
                    setFormData(prev => ({ ...prev, IncentiveAmount: v as unknown as number }));
                  }
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4 border-t border-[var(--border)] mt-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-sm text-[var(--text-primary)]">
                <span className="font-medium">Production Cost/Ltr:</span>{' '}
                <span className="font-normal">
                  ₹{Math.max(0, formData.RawMaterialCost || 0).toFixed(2)}
                </span>
              </div>

              <div className="text-sm text-[var(--text-primary)]">
                <span className="font-medium">Density:</span>{' '}
                <span className="font-normal">{formData.Density?.toFixed(2) || '0.00'}</span>
              </div>

              {/* Filling Density with Sync Checkbox */}
              <div className="flex items-center gap-3 border-l border-[var(--border)] pl-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                    Filling Density:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.FillingDensity ?? ''}
                    onChange={e => {
                      setFormData(prev => ({
                        ...prev,
                        FillingDensity: Number(e.target.value),
                      }));
                    }}
                    disabled={formData.IsFdSyncWithDensity}
                    className={`w-20 px-2 py-1 text-sm rounded border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                      formData.IsFdSyncWithDensity
                        ? 'bg-gray-100 cursor-not-allowed opacity-60'
                        : 'bg-[var(--surface)]'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.IsFdSyncWithDensity ?? true}
                    onChange={e => {
                      const isChecked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        IsFdSyncWithDensity: isChecked,
                        // If checked, sync filling density with density
                        FillingDensity: isChecked ? prev.Density : prev.FillingDensity,
                      }));
                    }}
                    className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-[var(--text-secondary)] whitespace-nowrap">
                    Sync with Density
                  </span>
                </label>
              </div>
            </div>

            <Button variant="ghost" onClick={handleNew} className="min-w-[120px]">
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              className="min-w-[120px]"
              disabled={saving}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Bottom: Table */}
        <div className="card flex flex-col h-[600px]">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-highlight)] rounded-t-lg flex items-center gap-4">
            <div className="relative flex-grow">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                size={18}
              />
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={tableSearchQuery}
                onChange={e => setTableSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          </div>

          <div className="flex-grow overflow-auto p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--surface-highlight)] text-[var(--text-secondary)] uppercase text-xs font-semibold sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 w-20">ID</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Unit</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3">Min Stock</th>
                  <th className="px-6 py-3 text-center">Available</th>
                  <th className="px-6 py-3 text-center">Free</th>
                  <th className="px-6 py-3 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-[var(--text-secondary)]">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => (
                    <tr
                      key={product.ProductID}
                      className={`hover:bg-[var(--surface-hover)] transition-colors ${selectedProduct?.ProductID === product.ProductID ? 'bg-[var(--surface-highlight)]' : ''}`}
                    >
                      <td className="px-6 py-3 font-mono text-[var(--text-secondary)]">
                        {product.ProductID}
                      </td>
                      <td className="px-6 py-3 font-medium text-[var(--text-primary)]">
                        {product.ProductName}
                      </td>
                      <td className="px-6 py-3 text-[var(--text-secondary)]">
                        {product.UnitID === 1 ? 'L' : product.UnitID === 2 ? 'KG' : 'Nos'}
                      </td>
                      <td className="px-6 py-3 font-mono">
                        ₹{product.SellingPrice?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={
                            product.MinStockLevel && product.MinStockLevel > 0
                              ? 'text-green-600'
                              : 'text-red-500'
                          }
                        >
                          {product.MinStockLevel || 0}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="font-medium text-blue-600">
                          {product.AvailableQuantity || 0}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`font-bold ${
                            (product.AvailableQuantity || 0) - (product.ReservedQuantity || 0) > 0
                              ? 'text-green-600'
                              : 'text-red-500'
                          }`}
                        >
                          {(product.AvailableQuantity || 0) - (product.ReservedQuantity || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 rounded-lg hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors border border-transparent hover:border-[var(--border)] focus-ring"
                            title="Edit"
                            aria-label="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleDelete(product.ProductID);
                            }}
                            className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors border border-transparent hover:border-red-200 focus-ring"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-[var(--border)] text-xs text-[var(--text-secondary)] text-right">
            Total Records: {filteredProducts.length}
          </div>
        </div>
      </div>

      {/* Cost Breakdown Modal Removed */}
    </div>
  );
};

export default ProductMaster;
