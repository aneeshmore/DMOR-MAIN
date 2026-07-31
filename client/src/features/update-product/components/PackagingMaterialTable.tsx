import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/utils/toast';
import { Save, Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { updateProductApi } from '../api';
import UpdateConfirmationModal from './UpdateConfirmationModal';
import EditableName from './EditableName';
import { handleEnterKeyNavigation } from './EnterKeyNavigation';
import CalculateMinStockButton from './CalculateMinStockButton';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const PackagingMaterialTable = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: products, isLoading } = useQuery({
    queryKey: ['update-products-pm'],
    queryFn: updateProductApi.getPackagingMaterials,
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

  // Ids whose Min Stock came from the calculator, so Revert can undo exactly those
  // and leave any values the user typed by hand alone.
  const [minStockPreviewIds, setMinStockPreviewIds] = useState<number[]>([]);

  /**
   * Loads calculated Min Stock values into the pending edits, exactly as if they had
   * been typed. They appear in the column for review and are only written when the
   * user presses Save; refreshing or leaving discards them.
   */
  const applyMinStockPreview = (values: { id: number; minStockLevel: number }[]) => {
    setEdits(prev => {
      const next = { ...prev };
      values.forEach(({ id, minStockLevel }) => {
        next[id] = { ...next[id], minStockLevel };
      });
      return next;
    });
    setMinStockPreviewIds(values.map(v => v.id));
  };

  /** Drops the calculated Min Stock values, keeping any other pending edits. */
  const revertMinStockPreview = () => {
    setEdits(prev => {
      const next = { ...prev };
      minStockPreviewIds.forEach(id => {
        if (!next[id]) return;
        const { minStockLevel, ...rest } = next[id];
        if (Object.keys(rest).length > 0) next[id] = rest;
        else delete next[id];
      });
      return next;
    });
    setMinStockPreviewIds([]);
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
      const product = products?.data?.find((p: any) => p.masterProductId === id);
      if (!product) return;

      const changeRecord = {
        name: product.masterProductName,
        changes: [] as any[],
      };

      if (
        changes.masterProductName !== undefined &&
        changes.masterProductName !== product.masterProductName
      ) {
        changeRecord.changes.push({
          field: 'masterProductName',
          oldValue: product.masterProductName,
          newValue: changes.masterProductName,
        });
      }
      if (changes.purchaseCost !== undefined && changes.purchaseCost != product.purchaseCost) {
        changeRecord.changes.push({
          field: 'purchaseCost',
          oldValue: product.purchaseCost,
          newValue: changes.purchaseCost,
        });
      }
      if (changes.gst !== undefined && changes.gst != product.gst) {
        changeRecord.changes.push({
          field: 'gst',
          oldValue: product.gst,
          newValue: changes.gst,
        });
      }
      if (changes.minStockLevel !== undefined && changes.minStockLevel != product.minStockLevel) {
        changeRecord.changes.push({
          field: 'minStockLevel',
          oldValue: product.minStockLevel,
          newValue: changes.minStockLevel,
        });
      }
      if (changes.hsnCode !== undefined && changes.hsnCode !== product.hsnCode) {
        changeRecord.changes.push({
          field: 'hsnCode',
          oldValue: product.hsnCode || 'N/A',
          newValue: changes.hsnCode || 'N/A',
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
        updateProductApi.updatePackagingMaterial(Number(id), data)
      );
      await Promise.all(promises);
      showToast.success('Packaging materials updated successfully');
      queryClient.invalidateQueries({ queryKey: ['update-products-pm'] });
      setEdits({});
      setMinStockPreviewIds([]);
      setConfirmationOpen(false);
    } catch {
      showToast.error('Failed to update packaging materials');
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    if (!products?.data) return [];

    let result = [...products.data];

    // Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter((p: any) => p.masterProductName?.toLowerCase().includes(lowerTerm));
    }

    // Sort
    result.sort((a: any, b: any) => {
      const nameA = (a.masterProductName || '').toLowerCase();
      const nameB = (b.masterProductName || '').toLowerCase();
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
            placeholder="Search packaging materials..."
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
              <th className="px-4 py-3 font-medium">Packaging Custom Name</th>
              <th className="px-4 py-3 font-medium">HSN Code</th>
              <th className="px-4 py-3 font-medium">GST (%)</th>
              <th className="px-4 py-3 font-medium">Purchase Cost</th>
              <th className="px-4 py-3 font-medium">
                <div className="flex flex-col items-start gap-0.5 leading-tight">
                  <CalculateMinStockButton
                    section="PM"
                    products={(products?.data ?? []).map((p: any) => ({
                      id: p.masterProductId,
                    }))}
                    onPreview={applyMinStockPreview}
                    hasPreview={minStockPreviewIds.length > 0}
                    onSave={handleSaveAll}
                    onRevert={revertMinStockPreview}
                  />
                  <span>Min Stock</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {paginatedProducts.map((product: any) => {
              const elementId = product.masterProductId;
              const isEdited = !!edits[elementId];
              const currentCost = edits[elementId]?.purchaseCost ?? product.purchaseCost;
              const currentGst = edits[elementId]?.gst ?? product.gst ?? '';
              const currentHsnCode = edits[elementId]?.hsnCode ?? product.hsnCode ?? '';
              const currentMinStock = edits[elementId]?.minStockLevel ?? product.minStockLevel ?? 0;
              const editedName = edits[elementId]?.masterProductName;
              const isNameEdited =
                editedName !== undefined && editedName !== product.masterProductName;

              return (
                <tr
                  key={elementId}
                  className={`transition-colors ${
                    isEdited
                      ? 'bg-amber-50/50 hover:bg-amber-100/50'
                      : 'hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    <EditableName
                      value={product.masterProductName}
                      editedValue={editedName}
                      onEdit={newName => handleInputChange(elementId, 'masterProductName', newName)}
                      isEdited={isNameEdited}
                      onNameClick={() =>
                        navigate(`/masters/master-product?tab=PM&editId=${elementId}`)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      data-column="2"
                      className="w-24 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentHsnCode}
                      onChange={e => {
                        if (/^\d{0,8}$/.test(e.target.value)) {
                          handleInputChange(elementId, 'hsnCode', e.target.value);
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
                      onChange={e => handleInputChange(elementId, 'gst', e.target.value)}
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="4"
                      className="w-24 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentCost}
                      onChange={e => handleInputChange(elementId, 'purchaseCost', e.target.value)}
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="5"
                      className="w-20 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentMinStock}
                      onChange={e => handleInputChange(elementId, 'minStockLevel', e.target.value)}
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                </tr>
              );
            })}
            {paginatedProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  No packaging materials found matching your search.
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
        title="Update Packaging Materials"
        description="Are you sure you want to save these changes? This will update the packaging material details immediately."
        changes={changesSummary}
      />
    </div>
  );
};

export default PackagingMaterialTable;
