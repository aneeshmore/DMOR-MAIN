import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, SearchableSelect } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { masterProductApi } from '@/features/master-products/api';
import { MasterProduct, Product } from '@/features/master-products/types';
import { bomApi } from '@/features/production-manager/api/bomApi';
import { productDevelopmentApi } from '@/features/masters/api/productDevelopment';
import { productApi } from '@/features/master-products/api/productApi';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { handleApiError } from '@/utils/errorHandler';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Save, X, Trash2, Copy, Clipboard } from 'lucide-react';

interface RawMaterialItem {
  id: number;
  productId: number;
  productName: string;
  percentage: number | string;
  sequence: number | string;
  waitingTime: number | string;
}

// Sortable Row Component for DnD
function SortableRow({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: isDragging ? ('relative' as const) : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style} className={className}>
      <td className="px-2 py-2 text-center w-10">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <GripVertical size={16} />
        </button>
      </td>
      {children}
    </tr>
  );
}

const ProductDevelopment = () => {
  const navigate = useNavigate();
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [rmMasterProducts, setRmMasterProducts] = useState<MasterProduct[]>([]);
  const [pmMasterProducts, setPmMasterProducts] = useState<MasterProduct[]>([]);
  const [subProducts, setSubProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedMasterProductId, setSelectedMasterProductId] = useState<number | ''>('');

  const [density, setDensity] = useState<string>('');
  const [viscosity, setViscosity] = useState<string>('');
  const [productionCost, setProductionCost] = useState<string>(''); // Renamed from hours
  const [perPercent, setPerPercent] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [calculationBasis, setCalculationBasis] = useState<string>('Ltr');

  // RM Selection State
  const [selectedRmId, setSelectedRmId] = useState<number | ''>('');
  const [addedItems, setAddedItems] = useState<RawMaterialItem[]>([]);

  /**
   * Handle Enter key press to navigate to the next row's input in the same column
   */
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number,
    columnName: string
  ) => {
    // Prevent up/down arrow keys from changing values for percentage field
    if (columnName === 'percentage' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      if (nextIndex < addedItems.length) {
        // Find the next input in the same column
        const nextInput = document.querySelector(
          `input[data-row-index="${nextIndex}"][data-column="${columnName}"]`
        ) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setAddedItems(items => {
        const oldIndex = items.findIndex(i => i.id.toString() === active.id.toString());
        const newIndex = items.findIndex(i => i.id.toString() === over.id.toString());

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update sequence numbers after reordering
        return newItems.map((item, index) => ({
          ...item,
          sequence: index + 1, // Auto-update sequence to 1-based index
        }));
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate Theoretical Density (Memoized)
  const theoreticalDensity = useMemo(() => {
    if (addedItems.length === 0) return 0;

    let totalMass = 0;
    let totalVolume = 0;

    for (const item of addedItems) {
      const mass = parseFloat(String(item.percentage ?? '0'));

      totalMass += mass;

      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      const rmDensity = rmProduct?.RMDensity ? parseFloat(rmProduct.RMDensity.toString()) : 1;

      if (rmDensity > 0) {
        totalVolume += mass / rmDensity;
      }
    }

    if (totalVolume > 0) {
      return totalMass / totalVolume;
    }
    return 0;
  }, [addedItems, rmMasterProducts]);

  // Auto-fill Density and Production Cost based on formulation
  useEffect(() => {
    if (addedItems.length === 0) return;

    // Update form density from theoretical density
    if (theoreticalDensity > 0) {
      setDensity(theoreticalDensity.toFixed(3));
    }

    // Calculate Production Cost
    let totalCostInvested = 0;
    for (const item of addedItems) {
      const mass = Number(item.percentage) || 0;
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      const purchaseCost = rmProduct?.PurchaseCost ? Number(rmProduct.PurchaseCost) : 0;
      totalCostInvested += mass * purchaseCost;
    }

    // Calculate Production Cost / Ltr
    // Formula: (Total Cost Invested / 100) * FG Density
    // Using 100 as base divider for percentage sum normalization
    if (theoreticalDensity > 0) {
      let costBase = totalCostInvested / 100;

      // Adjust for Water Percentage if present
      const waterPer = parseFloat(perPercent) || 0;
      if (waterPer > 0) {
        costBase = costBase / ((waterPer + 100) / 100);
      }

      let finalCost = costBase;
      if (calculationBasis === 'Ltr') {
        finalCost = costBase * theoreticalDensity;
      }

      setProductionCost(finalCost.toFixed(2));
    }
  }, [theoreticalDensity, addedItems, rmMasterProducts, perPercent, calculationBasis]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fgRes, rmRes, pmRes] = await Promise.all([
        masterProductApi.getAll({ type: 'FG' }),
        masterProductApi.getAll({ type: 'RM' }),
        masterProductApi.getAll({ type: 'PM' }),
      ]);

      if (fgRes.success && fgRes.data) {
        // Include all FG products including Base and Hardener formulations
        setMasterProducts(fgRes.data);
      }
      if (rmRes.success && rmRes.data) {
        setRmMasterProducts(rmRes.data);
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

  const loadExistingRecipe = async (masterProductId: number) => {
    logger.info(`Checking for existing recipe for Master Product ID: ${masterProductId}`);
    try {
      // 1. Try to get from Product Development History first (Latest Draft/Saved)
      const devRes = await productDevelopmentApi.getByMasterProductId(masterProductId);

      if (devRes && devRes.success && devRes.data) {
        const devData = devRes.data;

        // Map development materials to table format
        if (devData.materials && devData.materials.length > 0) {
          const mappedItems: RawMaterialItem[] = devData.materials.map(
            (item: any, index: number) => {
              const rmDetails = rmMasterProducts.find(rm => rm.masterProductId === item.materialId);
              return {
                id: Date.now() + index,
                productId: item.materialId,
                productName: rmDetails?.masterProductName || 'Unknown Material',
                // Format percentage to 3 decimal places
                percentage: parseFloat(String(item.percentage || '0')).toFixed(4),

                sequence: item.sequence,
                waitingTime: item.waitingTime || 0,
              };
            }
          );
          setAddedItems(mappedItems);
        } else {
          setAddedItems([]);
        }

        // Set form fields from saved data
        setProductionCost(devData.productionHours || ''); // Map productionHours back to cost
        setPerPercent(devData.percentageValue || '');
        setCalculationBasis(devData.calculationBasis || 'Ltr');
        setNotes(devData.notes || '');

        showToast.success('Loaded saved product development recipe');
        return; // Exit if found
      }

      // 2. Fallback: Load from standard BOM if no development record exists
      const bomItems = await bomApi.getBOMByFinishedGood(masterProductId);

      if (bomItems && bomItems.length > 0) {
        // Check if values are fractional (Sum ~ 1) instead of percentage (Sum ~ 100)
        let mappedItems: RawMaterialItem[] = bomItems.map((item: any, index: number) => {
          const rmId = item.RawMaterialID || item.rawMaterialId || item.raw_material_id;
          const rmDetails = rmMasterProducts.find(rm => rm.masterProductId == rmId);

          return {
            id: Date.now() + index,
            productId: Number(rmId),
            productName:
              rmDetails?.masterProductName ||
              item.RawMaterialName ||
              item.rawMaterialName ||
              'Unknown Material',
            percentage:
              typeof (item.PercentageRequired ?? item.percentageRequired ?? item.percentage) ===
                'number'
                ? (item.PercentageRequired ?? item.percentageRequired ?? item.percentage).toString()
                : String(
                  item.PercentageRequired ?? item.percentageRequired ?? item.percentage ?? ''
                ),

            sequence: item.Sequence || item.sequence || index + 1,
            waitingTime: item.WaitingTime || item.waitingTime || 0,
          };
        });

        const totalPercent = mappedItems.reduce(
          (sum, item) => sum + parseFloat(String(item.percentage ?? '0')),
          0
        );

        // If total is typically 1 (e.g. 0.99 - 1.01), convert to 100-based scale
        if (totalPercent > 0 && totalPercent <= 1.05) {
          mappedItems = mappedItems.map(item => ({
            ...item,
            percentage: (parseFloat(String(item.percentage ?? '0')) * 100).toFixed(4),
          }));
        } else {
          // Ensure all percentages are formatted to 3 decimal places
          mappedItems = mappedItems.map(item => ({
            ...item,
            percentage: parseFloat(String(item.percentage ?? '0')).toFixed(4),
          }));
        }

        setAddedItems(mappedItems);
        showToast.success('Existing BOM loaded (No dev record found)');
      } else {
        setAddedItems([]);
        setDensity('');
        setViscosity('');
        setProductionCost('');
        setPerPercent('');
        setCalculationBasis('Ltr');
        setNotes('');
      }
    } catch (error) {
      console.error('Failed to load existing recipe', error);
    }
  };

  const handleMasterProductSelect = async (value: any) => {
    setSelectedMasterProductId(value);

    if (value) {
      loadExistingRecipe(value);
    } else {
      setAddedItems([]);
      setDensity('');
      setViscosity('');
      setProductionCost('');
      setPerPercent('');
      setCalculationBasis('Ltr');
      setNotes('');
    }

    // Fetch associated subproducts (SKUs)
    if (value) {
      try {
        const productRes = await productApi.getAll({ MasterProductID: value });
        if (productRes.success && productRes.data) {
          setSubProducts(productRes.data);
        } else {
          setSubProducts([]);
        }
      } catch (err) {
        console.error('Failed to load subproducts', err);
        setSubProducts([]);
      }
    } else {
      setSubProducts([]);
    }
  };

  const handleAddItem = (selectedId: number | '') => {
    if (!selectedId) {
      return;
    }

    const productToAdd = rmMasterProducts.find(p => p.masterProductId === selectedId);

    if (!productToAdd) {
      showToast.error('Product not found');
      return;
    }

    // Check if already added (only prevent duplicates for RMs that can't be added multiple times)
    const isAlreadyAdded = addedItems.some(item => item.productId === productToAdd.masterProductId);
    if (isAlreadyAdded && !productToAdd.CanBeAddedMultipleTimes) {
      showToast.error('Product already added');
      return;
    }

    const newItem: RawMaterialItem = {
      id: Date.now(),
      productId: productToAdd.masterProductId,
      productName: productToAdd.masterProductName,
      percentage: '',
      sequence: addedItems.length + 1, // Auto-assign next sequence number
      waitingTime: 0, // Default to 0
    };

    setAddedItems([...addedItems, newItem]);
    setSelectedRmId(''); // Reset selection
  };

  const handleRemoveItem = (id: number) => {
    setAddedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: number, field: keyof RawMaterialItem, value: string | number) => {
    setAddedItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          return { ...item, [field]: value }; // Just keep the value as-is!
        }
        return item;
      })
    );
  };

  const calculateTotalPercentage = () => {
    return addedItems.reduce((sum, item) => {
      const value = parseFloat(String(item.percentage || '0'));
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  };

  const calculateTotalVolume = () => {
    let totalVolume = 0;

    for (const item of addedItems) {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      if (rmProduct && rmProduct.RMDensity) {
        const density = Math.abs(parseFloat(rmProduct.RMDensity.toString())) || 1;
        const weight = Math.max(0, parseFloat(String(item.percentage ?? '0'))); // percentage is the weight in formulation
        // Total Volume = Σ(Weight / Density)
        totalVolume += weight / density;
      }
    }

    return Math.max(0, totalVolume);
  };

  const calculateSolidVolume = () => {
    let solidVolume = 0;

    for (const item of addedItems) {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      if (rmProduct) {
        // Determine density for SV calculation
        // Exception: If Resin, use SolidDensity if available, otherwise RMDensity
        const isResin = rmProduct.Subcategory === 'Resin';
        const rawDensity =
          isResin && rmProduct.SolidDensity ? rmProduct.SolidDensity : rmProduct.RMDensity;

        const density = Math.abs(parseFloat((rawDensity || 1).toString())) || 1;
        // RMSolids defaults to 0 if not set (treats unknown materials as solvents)
        // This ensures solvents like Xylene (0% solids) are correctly excluded
        const solids = Math.max(0, Math.min(100, parseFloat((rmProduct.RMSolids ?? 0).toString())));
        const weight = Math.max(0, parseFloat(String(item.percentage ?? '0')));

        // sv = solids / density
        // where solids = weight * (solids% / 100)
        solidVolume += (weight * (solids / 100)) / density;
      }
    }

    return Math.max(0, solidVolume);
  };

  /**
   * Calculate Total Solid (simple solid weight)
   * Formula: Σ(percent% × rmSolids / 100)
   * This is the sum of the Solids column values shown in the table
   */
  const calculateTotalSolid = () => {
    let totalSolid = 0;

    for (const item of addedItems) {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      if (rmProduct) {
        const solids = Math.max(0, Math.min(100, parseFloat((rmProduct.RMSolids ?? 0).toString())));
        const weight = parseFloat(String(item.percentage || '0'));

        // Make sure weight is valid
        if (!isNaN(weight) && weight > 0) {
          totalSolid += weight * (solids / 100);
        }
      }
    }

    return Math.max(0, totalSolid);
  };
  const calculateSolidVolumeRatio = () => {
    const totalVol = calculateTotalVolume();
    const solidVol = calculateSolidVolume();

    if (totalVol === 0) return 0;

    // SVR computation
    // User formula: svr = sum(wt/ltr) / sum(sv)  (which would be Total / Solid)
    // Standard industry SVR: Solid / Total
    // Assuming standard SVR is intended (0-100%)
    const svr = (solidVol / totalVol) * 100;
    return Math.max(0, svr);
  };

  /**
   * Calculate PVC (Pigment Volume Concentration)
   * PVC = (Total Pigment Volume / (Total Pigment Volume + Total Binder Volume)) × 100
   *
   * - Total Pigment Volume = Σ(percent% / density) for Extender materials only
   * - Total Binder Volume = Σ(Binder Solid Volume) for Resin materials only
   *   - Binder Solid Weight = percent% × Solids / 100
   *   - Binder Solid Volume = Binder Solid Weight / SolidDensity
   *
   * Note: General RMs are excluded from this calculation
   */
  const calculatePVC = () => {
    let totalPigmentVolume = 0;
    let totalBinderVolume = 0;

    for (const item of addedItems) {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      if (!rmProduct) continue;

      const weight = parseFloat(String(item.percentage ?? '0'));

      if (weight <= 0) continue;

      if (rmProduct.Subcategory === 'Extender') {
        // Total Pigment Volume = Σ(percent% / density)
        const density = Math.abs(parseFloat((rmProduct.RMDensity || 1).toString())) || 1;
        totalPigmentVolume += weight / density;
      } else if (rmProduct.Subcategory === 'Resin') {
        // Binder Solid Weight = percent% × Solids / 100
        // For Resins, default to 100% solids if not specified (most resins are high-solids)
        const solids = parseFloat((rmProduct.RMSolids ?? 100).toString()) || 100;
        const solidDensity =
          parseFloat((rmProduct.SolidDensity || rmProduct.RMDensity || 1).toString()) || 1;
        const binderSolidWeight = weight * (solids / 100);
        // Binder Solid Volume = Binder Solid Weight / SolidDensity
        totalBinderVolume += binderSolidWeight / solidDensity;
      }
      // General RMs are excluded
    }

    const totalVolume = totalPigmentVolume + totalBinderVolume;
    if (totalVolume === 0) return 0;

    return (totalPigmentVolume / totalVolume) * 100;
  };

  const calculateCPVC = () => {
    // Check if we have any Extenders in the formulation
    const hasExtenders = addedItems.some(item => {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      return rmProduct?.Subcategory === 'Extender';
    });

    // Return 0 if no extenders in formulation
    if (!hasExtenders) return 0;

    // Standard CPVC for alkyd/QD resin systems with calcite, talc, TiO₂
    return 52;
  };

  const handleSave = async () => {
    const totalPercentage = calculateTotalPercentage();
    // Constraint removed: Allow saving even if not 100%
    // Determine status based on completion (User requirement: 100.000 to 100.0009)
    const isComplete = totalPercentage >= 100 && totalPercentage <= 100.0009;
    const status = isComplete ? 'Completed' : 'Incomplete';

    if (!selectedMasterProductId) {
      showToast.error('Please select a Master Product');
      return;
    }

    // Validate Water Percentage
    const waterPercentValue = parseFloat(perPercent) || 0;
    if (waterPercentValue > 100) {
      showToast.error('Water Percentage cannot be greater than 100');
      return;
    }
    if (waterPercentValue < 0) {
      showToast.error('Water Percentage cannot be negative');
      return;
    }

    // Construct payload
    const payload = {
      masterProductId: selectedMasterProductId,
      density: parseFloat(density),
      viscosity: parseFloat(viscosity) || 0,
      hours: parseFloat(productionCost), // Send cost as 'hours' to match backend schema repurposing
      perPercent: parseFloat(perPercent) || 0,
      calculationBasis,

      materials: addedItems.map(item => ({
        ...item,
        percentage: parseFloat(parseFloat(String(item.percentage)).toFixed(4)) || 0, // Format to 3 decimal places
        sequence: typeof item.sequence === 'string' ? parseInt(item.sequence) : item.sequence,
        waitingTime:
          typeof item.waitingTime === 'string' ? parseFloat(item.waitingTime) : item.waitingTime,
      })),
      status: status, // Send calculated status
      notes: notes,
    };

    logger.info('Saving Product Development:', payload);

    try {
      setSaving(true);
      const response = await productDevelopmentApi.create(payload);

      if (response && response.success) {
        showToast.success('Recipe saved successfully!');
        // Optional: Navigate away or clear form
      } else if (response && !response.success) {
        logger.error('Save failed:', response.error);
        showToast.error(response.error || 'Failed to save recipe');
      }
    } catch (error) {
      handleApiError(error, 'save product development recipe');
    } finally {
      setSaving(false);
    }
  };

  // Copy/Paste Logic
  const handleCopyTable = () => {
    if (addedItems.length === 0) {
      showToast.error('No items to copy');
      return;
    }
    const dataToSave = addedItems.map(({ id, ...rest }) => rest); // Exclude IDs
    try {
      localStorage.setItem('copiedTableData', JSON.stringify(dataToSave));
      showToast.success('Table data copied');
    } catch (err) {
      showToast.error('Failed to copy');
    }
  };

  const handlePasteTable = () => {
    try {
      const saved = localStorage.getItem('copiedTableData');
      if (!saved) {
        showToast.error('No data in clipboard');
        return;
      }
      const data = JSON.parse(saved);
      // Ensure we don't have ID collisions and properly map properties if needed
      // The structure should be compatible as per plan
      const newItems = data.map((item: any) => ({
        ...item,
        id: Date.now() + Math.random(),
        percentage: parseFloat(String(item.percentage || '0')).toFixed(4), // Format to 3 decimal places
      }));

      setAddedItems(newItems);
      showToast.success('Data pasted');
    } catch (err) {
      showToast.error('Failed to paste');
    }
  };

  const totalPercentage = calculateTotalPercentage();

  // Create options for Select components
  const masterProductOptions = useMemo(
    () =>
      masterProducts
        .filter(mp => mp.Subcategory !== 'Base')
        .map(mp => ({
          id: mp.masterProductId,
          label: mp.masterProductName,
          value: mp.masterProductId,
        })),
    [masterProducts]
  );

  const rmProductOptions = useMemo(
    () =>
      rmMasterProducts
        .filter(mp => {
          // Check if this RM is already added
          const isAlreadyAdded = addedItems.some(item => item.productId === mp.masterProductId);

          // If already added and can't be added multiple times, hide it from dropdown
          if (isAlreadyAdded && !mp.CanBeAddedMultipleTimes) {
            return false;
          }

          return true;
        })
        .map(mp => ({
          id: mp.masterProductId,
          label: mp.masterProductName,
          value: mp.masterProductId,
          subLabel: mp.CanBeAddedMultipleTimes ? '✓ Can add multiple times' : undefined,
        })),
    [rmMasterProducts, addedItems]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="1K Product Development Form"
        description="Create and manage product recipes"
      />

      <div className="card p-6 space-y-8 pb-24">
        {/* Top Form Section */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="relative z-20">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Master Product Name <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={masterProductOptions}
                value={selectedMasterProductId}
                onChange={handleMasterProductSelect}
                placeholder="Search Master Product..."
                className="w-full"
              />
            </div>
            <Input
              label="Viscosity"
              value={viscosity}
              onChange={e => setViscosity(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                }
              }}
              placeholder="Viscosity"
              type="number"
              step="0.01"
            />
            <Input
              label="Water Percentage"
              value={perPercent}
              onChange={e => {
                const value = e.target.value;
                if (value === '') {
                  setPerPercent('');
                } else if (/^\d*\.?\d*$/.test(value)) {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    if (numValue < 0) {
                      setPerPercent('0');
                    } else if (numValue > 100) {
                      setPerPercent('100');
                    } else {
                      setPerPercent(value);
                    }
                  } else if (value.endsWith('.')) {
                    // Allow typing decimal point
                    setPerPercent(value);
                  }
                }
              }}
              onKeyDown={e => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                }
              }}
              placeholder="Water Percentage"
              type="text"
              inputMode="decimal"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
            <div className="relative min-w-0">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Add Raw Material
              </label>
              <SearchableSelect
                options={rmProductOptions}
                value={selectedRmId}
                onChange={val => handleAddItem(val ?? '')}
                placeholder={
                  !selectedMasterProductId ? 'Select Master Product first...' : 'Search and add...'
                }
                disabled={!selectedMasterProductId}
                className="w-full"
              />
            </div>
            <div className="min-w-0">
              <Input
                label="Density"
                value={density}
                onChange={e => setDensity(e.target.value)}
                placeholder="Density"
                type="number"
                step="0.01"
              />
            </div>

            <div className="space-y-4 min-w-0">
              <div className="relative min-w-0">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Calculation Basis
                </label>
                <div className="flex rounded-md shadow-sm" role="group">
                  <button
                    type="button"
                    onClick={() => setCalculationBasis('Ltr')}
                    className={`px-4 py-2 text-sm font-medium border border-[var(--border-color)] rounded-l-lg focus:z-10 focus:ring-2 focus:ring-[var(--primary)] ${calculationBasis === 'Ltr'
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                  >
                    Per Ltr
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalculationBasis('Kg')}
                    className={`px-4 py-2 text-sm font-medium border border-l-0 border-[var(--border-color)] rounded-r-lg focus:z-10 focus:ring-2 focus:ring-[var(--primary)] ${calculationBasis === 'Kg'
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                  >
                    Per Kg
                  </button>
                </div>
              </div>

              <Input
                label={`Production Cost / ${calculationBasis} (Auto-Calculated)`}
                value={productionCost}
                onChange={e => setProductionCost(e.target.value)}
                placeholder={`Cost / ${calculationBasis}`}
                type="number"
                className="bg-gray-50"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Action Buttons for Table */}
        <div className="flex justify-end gap-2 mt-8">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyTable}
            className="flex items-center gap-2"
          >
            <Copy size={16} />
            Copy Table
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePasteTable}
            className="flex items-center gap-2"
          >
            <Clipboard size={16} />
            Paste Table
          </Button>
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] mt-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--surface-highlight)] text-[var(--text-secondary)] uppercase text-xs font-semibold">
                <tr>
                  <th className="px-2 py-3 w-10"></th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3 w-32">Percent %</th>
                  <th className="px-4 py-3 w-32">Solids</th>
                  <th className="px-4 py-3 w-32">Sequence</th>
                  <th className="px-4 py-3 w-32">Waiting Time</th>
                  <th className="px-4 py-3 w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {addedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No materials added yet. Search and add products above.
                    </td>
                  </tr>
                ) : (
                  <SortableContext
                    items={addedItems.map(item => item.id.toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    {addedItems.map(item => {
                      const rmProduct = rmMasterProducts.find(
                        rm => rm.masterProductId === item.productId
                      );
                      // Solids column: percent% × rmSolids / 100 (simple solid weight)
                      // Solids column: percent% × rmSolids / 100 (simple solid weight)
                      let solidWeight = 0;
                      if (rmProduct) {
                        // RMSolids defaults to 0 if not set (treats unknown materials as solvents)
                        const solids = Math.max(
                          0,
                          Math.min(100, parseFloat((rmProduct.RMSolids ?? 0).toString()))
                        );
                        const weight = parseFloat(String(item.percentage || '0'));

                        // Only calculate if weight is a valid number
                        if (!isNaN(weight) && weight >= 0) {
                          solidWeight = weight * (solids / 100);
                        }
                      }

                      return (
                        <SortableRow
                          key={item.id}
                          id={item.id.toString()}
                          className="hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-2 font-medium text-[var(--text-primary)]">
                            {item.productName}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.percentage}
                              onChange={e => {
                                const value = e.target.value;
                                // Allow empty, numbers, and decimal points with max 3 decimal places
                                if (value === '') {
                                  handleUpdateItem(item.id, 'percentage', value);
                                } else if (/^\d*\.?\d*$/.test(value)) {
                                  // Check decimal places
                                  const parts = value.split('.');
                                  if (parts[1] && parts[1].length > 4) {
                                    // Don't update if more than 3 decimal places
                                    return;
                                  }
                                  handleUpdateItem(item.id, 'percentage', value);
                                }
                              }}
                              onBlur={e => {
                                // Format on blur to exactly 3 decimal places
                                const value = e.target.value;
                                if (value && !isNaN(parseFloat(value))) {
                                  const formatted = parseFloat(value).toFixed(4);
                                  handleUpdateItem(item.id, 'percentage', formatted);
                                } else if (value === '') {
                                  handleUpdateItem(item.id, 'percentage', '');
                                }
                              }}
                              onKeyDown={e => {
                                handleInputKeyDown(e, addedItems.indexOf(item), 'percentage');

                                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                }
                              }}
                              data-row-index={addedItems.indexOf(item)}
                              data-column="percentage"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={solidWeight.toFixed(3)}
                              readOnly
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-highlight)] text-[var(--text-secondary)] cursor-not-allowed outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.sequence}
                              readOnly
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-highlight)] text-[var(--text-secondary)] cursor-not-allowed outline-none"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.waitingTime}
                              onChange={e =>
                                handleUpdateItem(item.id, 'waitingTime', e.target.value)
                              }
                              onKeyDown={e => {
                                handleInputKeyDown(e, addedItems.indexOf(item), 'waitingTime');

                                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                }
                              }}
                              data-row-index={addedItems.indexOf(item)}
                              data-column="waitingTime"
                              className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </SortableRow>
                      );
                    })}
                  </SortableContext>
                )}
              </tbody>
              <tfoot className="bg-[var(--surface-highlight)] font-semibold text-[var(--text-primary)]">
                <tr>
                  <td className="px-2 py-3"></td>
                  <td className="px-4 py-3 text-right">Total:</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        totalPercentage.toFixed(3) === '100.000' ? 'text-green-600' : 'text-red-500'
                      }
                    >
                      {totalPercentage.toFixed(4)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">{calculateTotalSolid().toFixed(3)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </DndContext>
        </div>

        {/* Subproduct Costing Table */}
        {subProducts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-[var(--text-primary)]">Costing Analysis</h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--surface-highlight)] text-[var(--text-secondary)] uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-4 py-3">Per kg cost</th>
                    <th className="px-4 py-3">Packing Cost</th>
                    <th className="px-4 py-3">ProductName</th>
                    <th className="px-4 py-3">packQty</th>
                    <th className="px-4 py-3">Unit selling rate</th>
                    <th className="px-4 py-3">Per ltr cost price</th>
                    <th className="px-4 py-3">Production cost</th>
                    <th className="px-4 py-3">Gross Profit</th>
                    <th className="px-4 py-3">Gross Profit %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {subProducts.map(product => {
                    const pm = pmMasterProducts.find(
                      p => p.masterProductId === product.PackagingId
                    );

                    // Calculations
                    // 1. Per kg cost (User mapped this to Production Cost/Ltr from form)
                    const perKgCost = parseFloat(productionCost) || 0;

                    // 2. Packing Cost (From PM Master Product)
                    const packingCost = pm?.PurchaseCost ? Number(pm.PurchaseCost) : 0;

                    // 3. Pack Capacity (From Backend Join or PM lookup)
                    // Priority: Backend-joined capacity -> PM lookup -> 0
                    const packCapacity = product.PackagingCapacity
                      ? Number(product.PackagingCapacity)
                      : pm?.Capacity
                        ? Number(pm.Capacity)
                        : 0;

                    // 4. Production Cost = (Per kg cost * Pack Capacity) + Packing Cost
                    // Note: If capacity is 0, this logic might need a check, but assuming valid PMs
                    const calculatedProductionCost = perKgCost * packCapacity + packingCost;

                    // 5. Per ltr cost price = Production Cost / Pack Capacity
                    const perLtrCostPrice =
                      packCapacity > 0 ? calculatedProductionCost / packCapacity : 0;

                    // 6. Gross Profit = Unit Selling Price - Production Cost
                    const sellingPrice = product.SellingPrice ? Number(product.SellingPrice) : 0;
                    const grossProfit = sellingPrice - calculatedProductionCost;

                    // 7. Gross Profit %
                    const grossProfitPercentage =
                      sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

                    return (
                      <tr key={product.ProductID} className="hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-2 font-medium">{perKgCost.toFixed(2)}</td>
                        <td className="px-4 py-2">{packingCost.toFixed(3)}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)]">
                          {product.ProductName}
                        </td>
                        <td className="px-4 py-2">{packCapacity.toFixed(3)}</td>
                        <td className="px-4 py-2">{sellingPrice.toFixed(2)}</td>
                        <td className="px-4 py-2">{perLtrCostPrice.toFixed(2)}</td>
                        <td className="px-4 py-2">{calculatedProductionCost.toFixed(2)}</td>
                        <td className="px-4 py-2 font-semibold">{grossProfit.toFixed(2)}</td>
                        <td className="px-4 py-2 font-semibold text-blue-600">
                          {grossProfitPercentage.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Notes / Instructions
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any additional notes, observations, or instructions..."
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-y"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap gap-6 text-sm font-medium text-[var(--text-secondary)] pt-4 border-t border-[var(--border)]">
          <div>
            SVR:{' '}
            <span className="text-[var(--text-primary)]">
              {addedItems.length > 0 ? `${calculateSolidVolumeRatio().toFixed(3)}%` : '--'}
            </span>
          </div>
          <div>
            PVC:{' '}
            <span className="text-[var(--text-primary)]">
              {addedItems.length > 0 ? `${calculatePVC().toFixed(3)}%` : '--'}
            </span>
          </div>
          <div>
            CPVC:{' '}
            <span className="text-[var(--text-primary)]">
              {addedItems.length > 0 ? `${calculateCPVC().toFixed(3)}%` : '--'}
            </span>
          </div>
          <div>
            Total Volume:{' '}
            <span className="text-[var(--text-primary)]">
              {addedItems.length > 0 ? calculateTotalVolume().toFixed(4) : '--'}
            </span>
          </div>
          <div>
            Total Solid:{' '}
            <span className="text-[var(--text-primary)]">
              {addedItems.length > 0 ? calculateTotalSolid().toFixed(3) : '--'}
            </span>
          </div>
          <div>
            Σ sv:{' '}
            <span className="text-[var(--text-primary)]">
              {addedItems.length > 0 ? calculateSolidVolume().toFixed(4) : '--'}
            </span>
          </div>
          <div>
            Theoretical Density:{' '}
            <span className="text-[var(--text-primary)]">
              {theoreticalDensity ? theoreticalDensity.toFixed(3) : '--'}
            </span>
          </div>
        </div>
        <div className="fixed bottom-0 right-0 p-6 z-50">
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={addedItems.length === 0 || saving}
              leftIcon={saving ? undefined : <Save size={18} />}
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
                'Save'
              )}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/masters')} leftIcon={<X size={18} />}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDevelopment;
