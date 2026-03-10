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

const RawMaterialTable = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: products, isLoading } = useQuery({
    queryKey: ['update-products-rm'],
    queryFn: updateProductApi.getRawMaterials,
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
      if (changes.density !== undefined && changes.density != product.density) {
        changeRecord.changes.push({
          field: 'density',
          oldValue: product.density,
          newValue: changes.density,
        });
      }
      if (changes.solids !== undefined && changes.solids != product.solids) {
        changeRecord.changes.push({
          field: 'solids',
          oldValue: product.solids,
          newValue: changes.solids,
        });
      }
      if (changes.minStockLevel !== undefined && changes.minStockLevel != product.minStockLevel) {
        changeRecord.changes.push({
          field: 'minStockLevel',
          oldValue: product.minStockLevel,
          newValue: changes.minStockLevel,
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
        updateProductApi.updateRawMaterial(Number(id), data)
      );
      await Promise.all(promises);
      showToast.success('Raw materials updated successfully');
      queryClient.invalidateQueries({ queryKey: ['update-products-rm'] });
      setEdits({});
      setConfirmationOpen(false);
    } catch {
      showToast.error('Failed to update raw materials');
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
            placeholder="Search raw materials..."
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
              <th className="px-4 py-3 font-medium">Raw Material Name</th>
              <th className="px-4 py-3 font-medium">Purchase Cost</th>
              <th className="px-4 py-3 font-medium">Density</th>
              <th className="px-4 py-3 font-medium">Solids %</th>
              <th className="px-4 py-3 font-medium">Min Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {paginatedProducts.map((product: any) => {
              const isEdited = !!edits[product.masterProductId];
              const currentCost =
                edits[product.masterProductId]?.purchaseCost ?? product.purchaseCost;
              const currentDensity = edits[product.masterProductId]?.density ?? product.density;
              const currentSolids = edits[product.masterProductId]?.solids ?? product.solids;
              const currentMinStock =
                edits[product.masterProductId]?.minStockLevel ?? product.minStockLevel ?? 0;
              const editedName = edits[product.masterProductId]?.masterProductName;
              const isNameEdited =
                editedName !== undefined && editedName !== product.masterProductName;

              return (
                <tr
                  key={product.masterProductId}
                  className={`transition-colors ${
                    isEdited
                      ? 'bg-amber-50/50 hover:bg-amber-100/50'
                      : 'hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    <div className="flex items-center gap-2">
                      <EditableName
                        value={product.masterProductName}
                        editedValue={editedName}
                        onEdit={newName =>
                          handleInputChange(product.masterProductId, 'masterProductName', newName)
                        }
                        isEdited={isNameEdited}
                        onNameClick={() =>
                          navigate(
                            `/masters/master-product?tab=RM&editId=${product.masterProductId}`
                          )
                        }
                      />
                      {product.subcategory === 'Extender' && (
                        <span
                          title="Extender"
                          className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="2"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentCost}
                      onChange={e =>
                        handleInputChange(product.masterProductId, 'purchaseCost', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="3"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentDensity}
                      onChange={e =>
                        handleInputChange(product.masterProductId, 'density', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="4"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentSolids}
                      onChange={e =>
                        handleInputChange(product.masterProductId, 'solids', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      data-column="5"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 focus:ring-1 focus:ring-[var(--primary)] outline-none"
                      value={currentMinStock}
                      onChange={e =>
                        handleInputChange(product.masterProductId, 'minStockLevel', e.target.value)
                      }
                      onKeyDown={handleEnterKeyNavigation}
                    />
                  </td>
                </tr>
              );
            })}
            {paginatedProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  No raw materials found matching your search.
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
        title="Update Raw Materials"
        description="Are you sure you want to save these changes? This will update the raw material details immediately."
        changes={changesSummary}
      />
    </div>
  );
};

export default RawMaterialTable;
