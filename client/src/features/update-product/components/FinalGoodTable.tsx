import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/utils/toast';
import { Save, Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { updateProductApi } from '../api';
import UpdateConfirmationModal from './UpdateConfirmationModal';
import EditableName from './EditableName';
import { handleEnterKeyNavigation } from './EnterKeyNavigation';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const FinalGoodTable = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: products, isLoading } = useQuery({
    queryKey: ['update-products-fg'],
    queryFn: updateProductApi.getFinalGoods,
  });

  const [edits, setEdits] = useState<Record<number, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [changesSummary, setChangesSummary] = useState<any[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleInputChange = (id: number, field: string, value: any) => {
    setEdits(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveAll = () => {
    // Validate HSN codes before saving (blank allowed for legacy products)
    const invalidHsn = Object.values(edits).some(
      (changes: any) =>
        changes.hsnCode !== undefined &&
        changes.hsnCode !== '' &&
        !/^(\d{4}|\d{6}|\d{8})$/.test(changes.hsnCode)
    );
    if (invalidHsn) {
      showToast.error('HSN Code must be a 4, 6, or 8 digit number');
      return;
    }

    const summary: any[] = [];
    Object.entries(edits).forEach(([idStr, changes]) => {
      const id = Number(idStr);
      const product = products?.data?.find((p: any) => p.productId === id);
      if (!product) return;

      const changeRecord = {
        name: product.productName,
        changes: [] as any[],
      };

      if (changes.productName !== undefined && changes.productName !== product.productName) {
        changeRecord.changes.push({
          field: 'productName',
          oldValue: product.productName,
          newValue: changes.productName,
        });
      }
      if (changes.sellingPrice !== undefined && changes.sellingPrice != product.sellingPrice) {
        changeRecord.changes.push({
          field: 'sellingPrice',
          oldValue: product.sellingPrice,
          newValue: changes.sellingPrice,
        });
      }
      if (changes.minStockLevel !== undefined && changes.minStockLevel != product.minStockLevel) {
        changeRecord.changes.push({
          field: 'minStockLevel',
          oldValue: product.minStockLevel,
          newValue: changes.minStockLevel,
        });
      }
      if (changes.gst !== undefined && changes.gst != product.gst) {
        changeRecord.changes.push({
          field: 'gst',
          oldValue: product.gst,
          newValue: changes.gst,
        });
      }
      if (
        changes.incentiveAmount !== undefined &&
        changes.incentiveAmount != product.incentiveAmount
      ) {
        changeRecord.changes.push({
          field: 'incentiveAmount',
          oldValue: product.incentiveAmount,
          newValue: changes.incentiveAmount,
        });
      }
      if (
        changes.fillingDensity !== undefined &&
        changes.fillingDensity != product.fillingDensity
      ) {
        changeRecord.changes.push({
          field: 'fillingDensity',
          oldValue: product.fillingDensity,
          newValue: changes.fillingDensity,
        });
      }
      if (changes.hsnCode !== undefined && changes.hsnCode !== product.hsnCode) {
        changeRecord.changes.push({
          field: 'hsnCode',
          oldValue: product.hsnCode || 'N/A',
          newValue: changes.hsnCode || 'N/A',
        });
      }
      
      const inwardCost = Number(product.costPrice) || 0;
      const packCapacity = Number(product.pmCapacity) || 1;
      const packingCost = Number(product.packingCost) || 0;
      const devUnitCost = (Number(product.devCostPrice) || 0) * packCapacity + packingCost;
      const oldCp = inwardCost > 0 ? inwardCost : devUnitCost;
      
      if (changes.costPrice !== undefined && Number(changes.costPrice) !== Number(oldCp.toFixed(2))) {
        changeRecord.changes.push({
          field: 'costPrice',
          oldValue: oldCp.toFixed(2),
          newValue: changes.costPrice,
        });
      }

      if (changeRecord.changes.length > 0) {
        summary.push(changeRecord);
      }
    });

    setChangesSummary(summary);
    setConfirmationOpen(true);
  };

  const handleConfirmUpdate = async () => {
    try {
      const promises = Object.entries(edits).map(([id, data]) =>
        updateProductApi.updateFinalGood(Number(id), data)
      );
      await Promise.all(promises);
      showToast.success('Products updated successfully');
      queryClient.invalidateQueries({ queryKey: ['update-products-fg'] });
      setEdits({});
      setConfirmationOpen(false);
    } catch (error) {
      showToast.error('Failed to update products');
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    if (!products?.data) return [];

    let result = [...products.data];

    // Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (p: any) =>
          p.masterProductName?.toLowerCase().includes(lowerTerm) ||
          p.productName?.toLowerCase().includes(lowerTerm)
      );
    }

    // Sort
    result.sort((a: any, b: any) => {
      const nameA = (a.productName || '').toLowerCase();
      const nameB = (b.productName || '').toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    return result;
  }, [products?.data, searchTerm, sortAsc]);

  // Pagination calculations
  const totalItems = filteredAndSortedProducts.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedProducts = filteredAndSortedProducts.slice(startIndex, endIndex);

  // Reset to page 1 when search/filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortAsc, pageSize]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
        >
          <ArrowUpDown size={18} />
          <span>Sort {sortAsc ? 'A-Z' : 'Z-A'}</span>
        </button>

        <button
          onClick={handleSaveAll}
          disabled={Object.keys(edits).length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            Object.keys(edits).length > 0
              ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed hidden'
          }`}
        >
          <Save size={18} />
          <span>Save Changes ({Object.keys(edits).length})</span>
        </button>
      </div>

      <div className="overflow-x-auto bg-[var(--surface)] rounded-lg shadow border border-[var(--border)]">
        <table className="w-full text-sm text-left">
          <thead className="bg-[var(--surface-hover)] text-[var(--text-secondary)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 font-medium">Product Name (SKU)</th>
              <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Cost Price</th>
              <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Profit / Loss (%)</th>
              <th className="px-4 py-3 font-medium">HSN Code</th>
              <th className="px-4 py-3 font-medium">GST (%)</th>
              <th className="px-4 py-3 font-medium">Selling Price</th>
              <th className="px-4 py-3 font-medium">Min Stock</th>
              <th className="px-4 py-3 font-medium">Filling Density</th>
              <th className="px-4 py-3 font-medium">Incentives</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {paginatedProducts.map((product: any) => {
              const isEdited = !!edits[product.productId];
              const currentSellingPrice =
                edits[product.productId]?.sellingPrice ?? product.sellingPrice;
              const currentMinStock =
                edits[product.productId]?.minStockLevel ?? product.minStockLevel ?? 0;
              const currentGst = edits[product.productId]?.gst ?? product.gst ?? '';
              const currentHsnCode = edits[product.productId]?.hsnCode ?? product.hsnCode ?? '';
              const currentIncentive =
                edits[product.productId]?.incentiveAmount ?? product.incentiveAmount;
              const editedName = edits[product.productId]?.productName;
              const isNameEdited = editedName !== undefined && editedName !== product.productName;

              const inwardCost = Number(product.costPrice) || 0;
              const packCapacity = Number(product.pmCapacity) || 1;
              const packingCost = Number(product.packingCost) || 0;
              const devUnitCost = (Number(product.devCostPrice) || 0) * packCapacity + packingCost;

              const cp = Number(edits[product.productId]?.costPrice) || (inwardCost > 0 ? inwardCost : devUnitCost) || 0;
              const sp = Number(currentSellingPrice) || 0;
              let profitLossPercent: number | null = null;
              if (cp > 0) {
                profitLossPercent = ((sp - cp) / cp) * 100;
              }

              return (
                <tr
                  key={product.productId}
                  className={`transition-colors ${
                    isEdited
                      ? 'bg-amber-50/50 hover:bg-amber-100/50'
                      : 'hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    <EditableName
                      value={product.productName}
                      editedValue={editedName}
                      onEdit={newName =>
                        handleInputChange(product.productId, 'productName', newName)
                      }
                      isEdited={isNameEdited}
                      onNameClick={() =>
                        navigate(`/masters/product-sub-master?editId=${product.productId}`)
                      }
                    />
                  </td>
                  {/* Cost Price — Editable input field */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col relative">
                      <input
                        type="number"
                        data-column="1"
                        className="w-24 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                        value={edits[product.productId]?.costPrice ?? (inwardCost > 0 ? inwardCost : devUnitCost).toFixed(2)}
                        onChange={e =>
                          handleInputChange(product.productId, 'costPrice', e.target.value)
                        }
                        onKeyDown={handleEnterKeyNavigation}
                      />
                      {(!product.costPrice || Number(product.costPrice) === 0) && (
                        <span className="text-[10px] text-blue-500 font-normal mt-0.5 leading-none absolute -bottom-3">
                          (Production Cost)
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Profit / Loss % */}
                  <td className="px-4 py-3">
                    {profitLossPercent !== null ? (
                      <span className={`text-sm font-medium ${profitLossPercent > 0 ? 'text-green-600' : profitLossPercent < 0 ? 'text-red-600' : 'text-[var(--text-secondary)]'}`}>
                        {profitLossPercent > 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-xs italic text-[var(--text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      data-column="2"
                      className="w-24 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentHsnCode}
                      onChange={e => {
                        if (/^\d{0,8}$/.test(e.target.value)) {
                          handleInputChange(product.productId, 'hsnCode', e.target.value);
                        }
                      }}
                      onKeyDown={handleEnterKeyNavigation}
                      placeholder="HSN Code"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="3"
                      className="w-16 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentGst}
                      onChange={e => handleInputChange(product.productId, 'gst', e.target.value)}
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="4"
                      className="w-24 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentSellingPrice}
                      onChange={e =>
                        handleInputChange(product.productId, 'sellingPrice', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="5"
                      className="w-20 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentMinStock}
                      onChange={e =>
                        handleInputChange(product.productId, 'minStockLevel', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.001"
                      data-column="6"
                      className="w-20 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={
                        edits[product.productId]?.fillingDensity ??
                        Number(product.fillingDensity ?? 0).toFixed(3)
                      }
                      onChange={e =>
                        handleInputChange(product.productId, 'fillingDensity', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="7"
                      className="w-20 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentIncentive}
                      onChange={e =>
                        handleInputChange(product.productId, 'incentiveAmount', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                </tr>
              );
            })}
            {paginatedProducts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  No products found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="px-2 py-1 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>per page</span>
          </div>

          <div className="text-sm text-[var(--text-secondary)]">
            Showing {startIndex + 1} - {endIndex} of {totalItems} items
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 py-1 text-sm text-[var(--text-primary)] font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      <UpdateConfirmationModal
        isOpen={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={handleConfirmUpdate}
        title="Update Products"
        description="Are you sure you want to save these changes? This will update the product details immediately."
        changes={changesSummary}
      />
    </div>
  );
};

export default FinalGoodTable;
