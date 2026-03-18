import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Save, X, Trash2, Search, Edit2, CheckCircle2 } from 'lucide-react';
import { Button, Input, SearchableSelect } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { masterProductApi } from '@/features/master-products/api';
import { MasterProduct as MasterProductType } from '@/features/master-products/types';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { handleApiError } from '@/utils/errorHandler';

const MasterProduct = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState<MasterProductType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MasterProductType | null>(null);
  const [activeTab, setActiveTab] = useState<'FG' | 'RM' | 'PM'>('FG');

  // Fields
  const [productName, setProductName] = useState('');
  const [rmDensity, setRmDensity] = useState<number | ''>('');
  const [rmSolids, setRmSolids] = useState<number | ''>('');
  const [solidDensity, setSolidDensity] = useState<number | ''>('');
  const [oilAbsorption, setOilAbsorption] = useState<number | ''>('');

  const [capacity, setCapacity] = useState<number | ''>('');
  const [canBeAddedMultipleTimes, setCanBeAddedMultipleTimes] = useState(false);

  // FG Specific Fields
  const [subcategory, setSubcategory] = useState<
    'General' | 'Hardener' | 'Base' | 'Resin' | 'Extender'
  >('General');

  // Keyboard navigation for search results
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedHardenerId, setSelectedHardenerId] = useState<number | null>(null);

  // Table search state
  const [tableSearch, setTableSearch] = useState('');

  // Name field autocomplete state
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  // Pending edit ID from URL params (to be applied after products load)
  const [pendingEditId, setPendingEditId] = useState<number | null>(null);

  // Read URL params on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const editIdParam = searchParams.get('editId');

    if (tabParam && ['FG', 'RM', 'PM'].includes(tabParam)) {
      setActiveTab(tabParam as 'FG' | 'RM' | 'PM');
    }

    if (editIdParam) {
      setPendingEditId(Number(editIdParam));
    }

    // Clear URL params after reading
    if (tabParam || editIdParam) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  // Apply pending edit when products are loaded
  useEffect(() => {
    if (pendingEditId && products.length > 0) {
      const productToEdit = products.find(p => p.masterProductId === pendingEditId);
      if (productToEdit) {
        handleEdit(productToEdit);
        showToast.success(`Editing: ${productToEdit.masterProductName}`);
      } else {
        showToast.error('Product not found');
      }
      setPendingEditId(null);
    }
  }, [pendingEditId, products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await masterProductApi.getAll();
      if (response.success && response.data) {
        setProducts(response.data);
      }
    } catch (error) {
      logger.error('Failed to load master products:', error);
      showToast.error('Failed to load master products');
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setIsEditing(false);
    setSelectedProduct(null);
    setProductName('');
    setRmDensity('');
    setRmSolids('');
    setSolidDensity('');
    setOilAbsorption('');
    setCapacity('');
    setCanBeAddedMultipleTimes(false);
    setSubcategory('General');
    setSelectedHardenerId(null);
    setHighlightedIndex(-1);
  };

  const handleEdit = (product: MasterProductType) => {
    setIsEditing(true);
    setSelectedProduct(product);
    setActiveTab(product.productType || 'FG');
    setProductName(product.masterProductName);
    setRmDensity(product.RMDensity || '');
    setRmSolids(product.RMSolids || '');
    setSolidDensity(product.SolidDensity || '');
    setOilAbsorption(product.OilAbsorption || '');
    setCanBeAddedMultipleTimes(product.CanBeAddedMultipleTimes || false);
    setCapacity(product.Capacity || '');
    setSubcategory(product.Subcategory || 'General');
    setSelectedHardenerId(product.HardenerID || null);
  };

  const handleSave = async () => {
    if (!productName.trim()) {
      showToast.error('Master Product Name is required');
      return;
    }

    // RM validation
    if (activeTab === 'RM') {
      if (rmDensity === '' || rmDensity === null || rmDensity === undefined) {
        showToast.error('Density is required for Raw Material');
        return;
      }
      if (rmSolids === '' || rmSolids === null || rmSolids === undefined) {
        showToast.error('Solid % is required for Raw Material');
        return;
      }
      if (Number(rmSolids) > 100) {
        showToast.error('Solid % cannot be greater than 100');
        return;
      }
      if (Number(rmSolids) < 0) {
        showToast.error('Solid % cannot be negative');
        return;
      }
      if (
        subcategory === 'Resin' &&
        (solidDensity === '' || solidDensity === null || solidDensity === undefined)
      ) {
        showToast.error('Solid Density is required for Resin subcategory');
        return;
      }
      if (
        subcategory === 'Extender' &&
        (oilAbsorption === '' || oilAbsorption === null || oilAbsorption === undefined)
      ) {
        showToast.error('Oil Absorption is required for Extender subcategory');
        return;
      }
      if (subcategory === 'Extender' && Number(oilAbsorption) < 0) {
        showToast.error('Oil Absorption (ml/g) cannot be negative');
        return;
      }
    }

    // PM validation
    if (activeTab === 'PM') {
      if (capacity === '' || capacity === null || capacity === undefined) {
        showToast.error('Capacity is required for Packing Material');
        return;
      }
    }

    try {
      setSaving(true);
      const payload: any = {
        MasterProductName: productName,
        IsActive: true,
        ProductType: activeTab,
      };

      if (activeTab === 'RM') {
        payload.RMDensity = Number(rmDensity);
        payload.RMSolids = Number(rmSolids);
        payload.CanBeAddedMultipleTimes = canBeAddedMultipleTimes;
        payload.Subcategory = subcategory;

        if (subcategory === 'Resin') {
          payload.SolidDensity = Number(solidDensity);
        } else if (subcategory === 'Extender') {
          payload.OilAbsorption = Number(oilAbsorption);
        }
      }

      if (activeTab === 'FG') {
        payload.Subcategory = subcategory;
        if (subcategory === 'Base') {
          if (!selectedHardenerId) {
            showToast.error('Please select a hardener for Base product');
            setSaving(false);
            return;
          }
          payload.HardenerID = selectedHardenerId;
        }
      }

      if (activeTab === 'PM') {
        payload.Capacity = Number(capacity);
      }

      if (isEditing && selectedProduct) {
        logger.info('Updating master product:', {
          id: selectedProduct.masterProductId,
          data: payload,
        });
        const response = await masterProductApi.update(selectedProduct.masterProductId, payload);
        logger.info('Update response:', response);

        if (response.success && response.data) {
          showToast.success('Master Product updated successfully');
          handleNew();
          loadProducts();
        } else if (!response.success) {
          logger.error('Update failed:', response.error);
          showToast.error(response.error || 'Failed to update master product');
        }
      } else {
        logger.info('Creating master product:', payload);
        const response = await masterProductApi.create(payload);
        logger.info('Create response:', response);

        if (response.success && response.data) {
          showToast.success('Master Product created successfully');
          handleNew();
          loadProducts();
        } else if (!response.success) {
          logger.error('Create failed:', response.error);
          showToast.error(response.error || 'Failed to create master product');
        }
      }
    } catch (error) {
      const action = isEditing ? 'update master product' : 'create master product';
      handleApiError(error, action);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this master product?')) return;

    try {
      logger.info('Deleting master product:', { id });
      const response = await masterProductApi.delete(id);

      // Only update state and show success if server responds successfully
      if (response.success) {
        showToast.success('Master Product deleted successfully');
        logger.info('Master product deleted successfully:', { id });

        if (selectedProduct?.masterProductId === id) {
          handleNew();
        }
        loadProducts();
      } else {
        // Server returned error
        logger.error('Delete failed:', response.error);
        showToast.error(response.error || 'Failed to delete master product');
      }
    } catch (error) {
      handleApiError(error, 'delete master product');
    }
  };

  // Filter products based on table search only
  const filteredProducts = products.filter(
    p =>
      p.productType === activeTab &&
      (tableSearch.trim() === '' ||
        p.masterProductName.toLowerCase().includes(tableSearch.toLowerCase()) ||
        p.masterProductId.toString().includes(tableSearch))
  );

  // Filter products for name field autocomplete
  const nameFilteredProducts = products.filter(
    p =>
      p.productType === activeTab &&
      nameSearchQuery.trim() !== '' &&
      p.masterProductName.toLowerCase().includes(nameSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Master Product"
        description="Manage master products (Finished Goods, Raw Materials, Packing Materials)"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Form */}
        <div className="lg:col-span-4 card p-4 flex flex-col gap-4 lg:h-[calc(100vh-240px)] lg:sticky lg:top-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
            {isEditing ? 'Edit Master Product' : 'New Master Product'}
          </h2>

          {/* Type Selection Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {(['FG', 'RM', 'PM'] as const).map(type => {
              const fullForm = {
                FG: 'Finished Goods',
                RM: 'Raw Material',
                PM: 'Packing Material',
              }[type];

              return (
                <button
                  key={type}
                  onClick={() => {
                    setActiveTab(type);
                    // Reset form when switching tabs
                    setProductName('');
                    setSubcategory('General');
                    setIsEditing(false);
                    setSelectedProduct(null);
                    setRmDensity('');
                    setRmSolids('');
                    setSolidDensity('');
                    setOilAbsorption('');
                    setCapacity('');
                    setCanBeAddedMultipleTimes(false);
                    setSelectedHardenerId(null);
                    setHighlightedIndex(-1);
                  }}
                  className={`py-2 px-1 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === type
                      ? 'bg-[var(--primary)] text-white shadow-md'
                      : 'bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {fullForm}
                </button>
              );
            })}
          </div>
          <div className="flex-grow space-y-4 overflow-y-auto pr-2 min-h-0">
            <div className="relative">
              <Input
                label="Name"
                value={productName}
                onChange={e => {
                  setProductName(e.target.value);
                  setNameSearchQuery(e.target.value);
                  setShowNameDropdown(e.target.value.length > 0);
                }}
                onFocus={() => {
                  if (productName.length > 0) {
                    setShowNameDropdown(true);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex(prev =>
                      prev < nameFilteredProducts.length - 1 ? prev + 1 : prev
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (nameFilteredProducts.length > 0 && highlightedIndex >= 0) {
                      handleEdit(nameFilteredProducts[highlightedIndex]);
                      setShowNameDropdown(false);
                    } else if (nameFilteredProducts.length > 0) {
                      handleEdit(nameFilteredProducts[0]);
                      setShowNameDropdown(false);
                    }
                  } else if (e.key === 'Escape') {
                    setShowNameDropdown(false);
                  }
                }}
                placeholder={`Enter ${activeTab} name`}
                required
                autoFocus
              />

              {/* Name autocomplete dropdown */}
              {showNameDropdown && nameFilteredProducts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {nameFilteredProducts.map((product, index) => (
                    <div
                      key={product.masterProductId}
                      onClick={() => {
                        handleEdit(product);
                        setShowNameDropdown(false);
                        setNameSearchQuery('');
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer transition-colors border-b border-[var(--border)] last:border-b-0 ${
                        index === highlightedIndex
                          ? 'bg-[var(--primary)]/10 text-[var(--text-primary)]'
                          : 'hover:bg-[var(--surface-hover)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="font-medium">{product.masterProductName}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        ID: {product.masterProductId} • {product.Subcategory || 'General'}
                        {product.productType === 'RM' &&
                          ` • Density: ${product.RMDensity || '-'} • Solid%: ${product.RMSolids || '-'}`}
                        {product.productType === 'PM' && ` • Capacity: ${product.Capacity || '-'}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'FG' && (
              <div className="space-y-3 p-3 bg-[var(--surface-highlight)] rounded-md border border-[var(--border)]">
                <label className="text-sm font-medium text-[var(--text-secondary)] block">
                  Subcategory
                </label>
                <div className="flex gap-4">
                  {(['General', 'Hardener', 'Base'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="subcategory"
                        checked={subcategory === opt}
                        onChange={() => setSubcategory(opt)}
                        className="accent-[var(--primary)] w-4 h-4"
                      />
                      <span className="text-sm text-[var(--text-primary)]">
                        {' '}
                        {opt === 'General' ? '1K' : opt}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'FG' && subcategory === 'Base' && (
              <SearchableSelect
                label="Select Hardener"
                value={selectedHardenerId?.toString() || ''}
                onChange={val => setSelectedHardenerId(val ? Number(val) : null)}
                options={products
                  .filter(p => p.productType === 'FG' && p.Subcategory === 'Hardener')
                  .map(h => ({
                    id: h.masterProductId,
                    value: h.masterProductId.toString(),
                    label: h.masterProductName,
                  }))}
                placeholder="Search hardener..."
                required
              />
            )}

            {activeTab === 'RM' && (
              <>
                <div className="space-y-3 p-3 bg-[var(--surface-highlight)] rounded-md border border-[var(--border)]">
                  <label className="text-sm font-medium text-[var(--text-secondary)] block">
                    Subcategory
                  </label>
                  <div className="flex gap-4">
                    {(['General', 'Resin', 'Extender'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="rmSubcategory"
                          checked={subcategory === opt}
                          onChange={() => setSubcategory(opt)}
                          className="accent-[var(--primary)] w-4 h-4"
                        />
                        <span className="text-sm text-[var(--text-primary)]">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Input
                  label="Density"
                  type="number"
                  step="0.01"
                  value={rmDensity}
                  onChange={e => setRmDensity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  required
                />
                <Input
                  label="Solid %"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rmSolids}
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '') {
                      setRmSolids('');
                    } else {
                      const numValue = Number(value);
                      // Clamp between 0 and 100
                      if (numValue < 0) {
                        setRmSolids(0);
                      } else if (numValue > 100) {
                        setRmSolids(100);
                      } else {
                        setRmSolids(numValue);
                      }
                    }
                  }}
                  placeholder="0.00"
                  required
                />

                {subcategory === 'Resin' && (
                  <Input
                    label="Solid Density"
                    type="number"
                    step="0.01"
                    value={solidDensity}
                    onChange={e =>
                      setSolidDensity(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="0.00"
                    required
                  />
                )}

                {subcategory === 'Extender' && (
                  <Input
                    label="Oil Absorption (ml/g)"
                    type="number"
                    step="0.01"
                    value={oilAbsorption}
                    onChange={e => {
                      const value = e.target.value;
                      if (value === '') {
                        setOilAbsorption('');
                      } else {
                        const numValue = Number(value);
                        // Allow any positive value for ml/g
                        if (numValue < 0) {
                          setOilAbsorption(0);
                        } else {
                          setOilAbsorption(numValue);
                        }
                      }
                    }}
                    placeholder="0.00"
                    required
                  />
                )}

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-[var(--surface-highlight)] transition-colors w-full border border-[var(--border)]">
                    <input
                      type="checkbox"
                      checked={canBeAddedMultipleTimes}
                      onChange={e => setCanBeAddedMultipleTimes(e.target.checked)}
                      className="accent-[var(--primary)] w-4 h-4"
                    />
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      Can be added multiple times?
                    </span>
                  </label>
                </div>
              </>
            )}

            {activeTab === 'PM' && (
              <Input
                label="Capacity"
                type="number"
                step="0.01"
                value={capacity}
                onChange={e => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                required
              />
            )}
          </div>

          <div className="flex-shrink-0 grid grid-cols-2 gap-3 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={handleNew} className="w-full">
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} className="w-full" disabled={saving}>
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

        {/* Right Side: Table */}
        <div className="lg:col-span-8 card flex flex-col min-h-0">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-highlight)] rounded-t-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-grow">
              <Search size={18} className="text-[var(--text-secondary)] flex-shrink-0" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search by name or ID..."
                className="flex-grow bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-0 transition-all"
              />
            </div>
            <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
              {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-grow p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--surface-highlight)] text-[var(--text-secondary)] uppercase text-xs font-semibold sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 w-24">ID</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Sub Category</th>
                  <th className="px-6 py-3">Details</th>
                  <th className="px-6 py-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-secondary)]">
                      No master products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, index) => (
                    <tr
                      key={product.masterProductId}
                      onClick={() => handleEdit(product)}
                      className={`transition-colors cursor-pointer ${
                        index === highlightedIndex
                          ? 'bg-[var(--primary)]/10 border-l-4 border-l-[var(--primary)]'
                          : selectedProduct?.masterProductId === product.masterProductId
                            ? 'bg-[var(--surface-highlight)]'
                            : 'hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <td className="px-6 py-3 font-mono text-[var(--text-secondary)]">
                        {product.masterProductId}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            product.productType === 'FG'
                              ? 'bg-blue-100 text-blue-700'
                              : product.productType === 'RM'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {product.productType || 'FG'}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium text-[var(--text-primary)]">
                        {product.masterProductName}
                      </td>
                      <td className="px-6 py-3 text-[var(--text-secondary)]">
                        {product.Subcategory || '-'}
                      </td>
                      <td className="px-6 py-3 text-[var(--text-secondary)]">
                        {product.productType === 'FG' ? (
                          <span className="text-xs">
                            {product.Subcategory || 'General'}
                            {product.Subcategory === 'Base' && product.HardenerID && (
                              <span className="text-[var(--text-secondary)] ml-1">
                                (H:{' '}
                                {products.find(p => p.masterProductId === product.HardenerID)
                                  ?.masterProductName || product.HardenerID}
                                )
                              </span>
                            )}
                          </span>
                        ) : product.productType === 'RM' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              Density: {product.RMDensity || '-'} | Solid%:{' '}
                              {product.RMSolids || '-'}
                            </span>
                            {product.CanBeAddedMultipleTimes && (
                              <div className="text-[var(--success)]" title="Can be added double">
                                <CheckCircle2 size={16} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs">Capacity: {product.Capacity || '-'}</span>
                        )}
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
                              handleDelete(product.masterProductId);
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
        </div>
      </div>
    </div>
  );
};

export default MasterProduct;
