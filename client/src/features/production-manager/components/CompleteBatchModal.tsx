import { useState, useEffect } from 'react';
import { X, Check, Clock, Beaker, Plus, Trash2 } from 'lucide-react';
import { productionManagerApi } from '../api/productionManagerApi';
import { masterProductApi } from '../../master-products/api/masterProductApi';
import { SearchableSelect } from '@/components/ui';
import { showToast } from '@/utils/toast';
import { formatQty, formatPercent } from '@/utils/formatters';

interface Material {
  batchMaterialId: number;
  materialId: number;
  materialName: string;
  plannedQuantity: number;
  actualQuantity: number;
  variance: number;
  isAdditional?: boolean;
}

interface CompleteBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  batchId: number;
  batchNo: string;
}

export default function CompleteBatchModal({
  isOpen,
  onClose,
  onSuccess,
  batchId,
  batchNo,
}: CompleteBatchModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchData, setBatchData] = useState<any>(null);

  // Form State
  const [actualQuantity, setActualQuantity] = useState<number>(0);
  const [actualDensity, setActualDensity] = useState<number>(0);
  const [actualWaterPercentage, setActualWaterPercentage] = useState<number>(0);
  const [actualViscosity, setActualViscosity] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [productionRemarks, setProductionRemarks] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);

  // Calculate total hours
  const calculateTotalHours = () => {
    if (!startDate || !startTime || !endDate || !endTime) return 0;
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  };

  const totalHours = calculateTotalHours();

  // Fetch batch details and master products
  useEffect(() => {
    if (!isOpen || !batchId) return;

    const fetchBatchData = async () => {
      setIsLoading(true);
      try {
        const [batchRes, productsRes] = await Promise.all([
          productionManagerApi.getBatchDetails(batchId),
          masterProductApi.getAll(),
        ]);

        const data = batchRes;
        setBatchData(data);

        // Strain RM products for dropdown
        const allProducts = productsRes.data || [];
        // Filter for RMs. Note: ProductType might be PascalCase or camelCase depending on API
        const rms = allProducts.filter(
          (p: any) => p.productType === 'RM' || p.ProductType === 'RM'
        );
        setMasterProducts(rms);

        // Pre-fill form with planned values
        setActualQuantity(parseFloat(data.batch?.plannedQuantity) || 0);
        setActualDensity(parseFloat(data.batch?.density) || 0);
        setActualWaterPercentage(parseFloat(data.batch?.waterPercentage) || 0);
        setActualViscosity(0);

        // Set default dates (today)
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
        setStartTime('08:00');
        setEndTime('16:00');

        // Map materials
        const mappedMaterials = (data.materials || []).map((m: any) => ({
          batchMaterialId: m.batchMaterial?.batchMaterialId,
          materialId: m.batchMaterial?.materialId,
          materialName: m.masterProduct?.masterProductName || m.material?.productName || 'Unknown',
          plannedQuantity: parseFloat(m.batchMaterial?.requiredQuantity) || 0,
          actualQuantity: parseFloat(m.batchMaterial?.requiredQuantity) || 0, // Default to planned
          variance: 0,
          isAdditional: m.batchMaterial?.isAdditional || false,
        }));
        setMaterials(mappedMaterials);
      } catch (error) {
        console.error('Failed to fetch batch data:', error);
        showToast.error('Failed to load batch details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchData();
  }, [isOpen, batchId]);

  // Update material actual quantity
  const updateMaterialActual = (index: number, value: number) => {
    setMaterials(prev =>
      prev.map((mat, i) => {
        if (i === index) {
          return {
            ...mat,
            actualQuantity: value,
            variance: value - mat.plannedQuantity,
          };
        }
        return mat;
      })
    );
  };

  // Add additional material
  const handleAddMaterial = () => {
    if (!selectedMaterialId) return;

    // Find selected product
    const selectedProduct = masterProducts.find(
      (p: any) => (p.masterProductId || p.MasterProductID) === selectedMaterialId
    );

    if (!selectedProduct) return;

    // Check if already exists in materials list
    const exists = materials.some(m => m.materialId === selectedMaterialId);
    if (exists) {
      showToast.error('Material already exists in list');
      return;
    }

    // Check if water - if so, it's NOT additional (treated as RM)
    const isWater = (selectedProduct.masterProductName || selectedProduct.MasterProductName)
      .toLowerCase()
      .includes('water');

    const newMaterial: Material = {
      batchMaterialId: -Date.now(), // Temporary ID
      materialId: selectedMaterialId,
      materialName: selectedProduct.masterProductName || selectedProduct.MasterProductName,
      plannedQuantity: 0,
      actualQuantity: 0,
      variance: 0,
      isAdditional: !isWater,
    };

    setMaterials(prev => [...prev, newMaterial]);
    setSelectedMaterialId(null);
    showToast.success('Material added');
  };

  // Remove additional material
  const removeMaterial = (index: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!startDate || !startTime || !endDate || !endTime) {
      showToast.error('Please enter start and end date/time');
      return;
    }

    setIsSubmitting(true);
    try {
      const startedAt = new Date(`${startDate}T${startTime}`).toISOString();
      const completedAt = new Date(`${endDate}T${endTime}`).toISOString();

      const completionData = {
        actualQuantity,
        actualDensity,
        actualWaterPercentage,
        actualViscosity,
        startedAt,
        completedAt,
        productionRemarks,
        materials: materials.map(m => ({
          batchMaterialId: m.batchMaterialId < 0 ? 0 : m.batchMaterialId, // Use 0 for new materials
          materialId: m.materialId,
          plannedQuantity: m.plannedQuantity,
          actualQuantity: m.actualQuantity,
          isAdditional: m.isAdditional,
        })),
      };

      await productionManagerApi.completeBatch(batchId, completionData);

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to complete batch:', error);
      showToast.error(error?.message || 'Failed to complete batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--primary)]">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Check className="w-5 h-5" />
            Complete Batch {batchNo}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Production Details */}
              <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Beaker className="w-4 h-4" />
                  Production Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Actual Quantity (L)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={actualQuantity}
                      onChange={e => setActualQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Actual Density (kg/L)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={actualDensity}
                      onChange={e => setActualDensity(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Actual Water %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={actualWaterPercentage}
                      onChange={e => setActualWaterPercentage(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Actual Viscosity
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={actualViscosity}
                      onChange={e => setActualViscosity(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Production Times */}
              <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Production Times
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Total Hours
                    </label>
                    <div className="w-full px-3 py-2 rounded bg-[var(--surface-active)] text-[var(--text-primary)] font-semibold">
                      {totalHours.toFixed(2)} hrs
                    </div>
                  </div>
                </div>
              </div>

              {/* Labours */}
              <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Labours</h3>
                <p className="text-[var(--text-primary)]">
                  {batchData?.batch?.labourNames || 'Not specified'}
                </p>
              </div>

              {/* Material Consumption */}
              <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                  Actual Material Consumption
                </h3>
                {/* Add Additional Material */}
                <div className="flex gap-2 items-end mb-4">
                  <div className="flex-1 max-w-sm">
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Add Additional Material
                    </label>
                    <SearchableSelect
                      options={masterProducts.map((p: any) => ({
                        id: p.masterProductId || p.MasterProductID,
                        value: p.masterProductId || p.MasterProductID,
                        label: p.masterProductName || p.MasterProductName,
                      }))}
                      value={selectedMaterialId}
                      onChange={val => setSelectedMaterialId(val as number | null)}
                      placeholder="Select material..."
                      className="w-full"
                    />
                  </div>
                  <button
                    onClick={handleAddMaterial}
                    disabled={!selectedMaterialId}
                    className="px-3 py-2 rounded bg-[var(--surface-active)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                          Material
                        </th>
                        <th className="text-right py-2 px-3 text-[var(--text-secondary)]">
                          Percentage
                        </th>
                        <th className="text-right py-2 px-3 text-[var(--text-secondary)]">
                          Weight
                        </th>
                        <th className="text-right py-2 px-3 text-[var(--text-secondary)]">
                          Actual
                        </th>
                        <th className="text-right py-2 px-3 text-[var(--text-secondary)]">
                          Variance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalPlannedWeight = materials.reduce(
                          (sum, mat) => sum + mat.plannedQuantity,
                          0
                        );
                        return [...materials]
                          .sort((a, b) => {
                            const isA_Additional = a.isAdditional || a.plannedQuantity <= 0;
                            const isB_Additional = b.isAdditional || b.plannedQuantity <= 0;
                            if (isA_Additional === isB_Additional) return 0;
                            return isA_Additional ? 1 : -1;
                          })
                          .map((mat, index) => {
                            const percentage =
                              totalPlannedWeight > 0
                                ? (mat.plannedQuantity / totalPlannedWeight) * 100
                                : 0;
                            return (
                              <tr
                                key={mat.batchMaterialId}
                                className="border-b border-[var(--border)]/50"
                              >
                                <td className="py-2 px-3 text-[var(--text-primary)]">
                                  <span
                                    className={
                                      mat.isAdditional || mat.plannedQuantity <= 0
                                        ? 'font-bold'
                                        : ''
                                    }
                                  >
                                    {mat.materialName || 'Unknown Material'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                                  {formatPercent(percentage)}%
                                </td>
                                <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                                  {formatQty(mat.plannedQuantity)}
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    step="0.000001"
                                    value={mat.actualQuantity}
                                    onChange={e =>
                                      updateMaterialActual(index, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-24 px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-right"
                                  />
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-medium ${
                                    mat.variance > 0
                                      ? 'text-red-500'
                                      : mat.variance < 0
                                        ? 'text-green-500'
                                        : 'text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {mat.variance > 0 ? '+' : ''}
                                  {formatQty(mat.variance)}
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[var(--border)] font-semibold bg-[var(--surface-active)]">
                        <td className="py-2 px-3 text-[var(--text-primary)]">Total</td>
                        <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                          100.00%
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                          {formatQty(materials.reduce((sum, mat) => sum + mat.plannedQuantity, 0))}
                        </td>
                        <td className="py-2 px-3"></td>
                        <td className="py-2 px-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Production Remarks */}
              <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Production Remarks
                </h3>
                <textarea
                  value={productionRemarks}
                  onChange={e => setProductionRemarks(e.target.value)}
                  placeholder="Enter any remarks about the production..."
                  rows={3}
                  className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-hover)]">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-active)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
            className="px-6 py-2 rounded bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Completing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Complete Batch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
