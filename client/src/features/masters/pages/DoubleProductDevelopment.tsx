import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, SearchableSelect } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { masterProductApi } from '@/features/master-products/api';
import { MasterProduct } from '@/features/master-products/types';
import { bomApi } from '@/features/production-manager/api/bomApi';
import { productDevelopmentApi } from '@/features/masters/api/productDevelopment';
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
  totalPercentage: number | string;
  wtInLtr: number | string;
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

const DoubleProductDevelopment = () => {
  const navigate = useNavigate();
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [rmMasterProducts, setRmMasterProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedMasterProductId, setSelectedMasterProductId] = useState<number | ''>('');
  const [linkedHardenerId, setLinkedHardenerId] = useState<number | null>(null);
  const [viscosity, setViscosity] = useState<string>('');

  // Ratios
  const [ratioBase, setRatioBase] = useState<string>('');
  const [ratioHardener, setRatioHardener] = useState<string>('');

  // Formulation Items
  const [selectedRmId, setSelectedRmId] = useState<number | ''>('');
  const [baseItems, setBaseItems] = useState<RawMaterialItem[]>([]);
  const [hardenerItems, setHardenerItems] = useState<RawMaterialItem[]>([]);

  /**
   * Handle Enter key press to navigate to the next row's input in the same column
   * Uses isHardener flag to differentiate between Base and Hardener tables
   * Also disables arrow key navigation
   */
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number,
    columnName: string,
    isHardener: boolean,
    items: RawMaterialItem[]
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      if (nextIndex < items.length) {
        const tablePrefix = isHardener ? 'hardener' : 'base';
        const nextInput = document.querySelector(
          `input[data-table="${tablePrefix}"][data-row-index="${nextIndex}"][data-column="${columnName}"]`
        ) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
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
      const activeId = active.id.toString();
      const overId = over.id.toString();

      // Check which list the item belongs to
      const isBaseItem = baseItems.some(item => item.id.toString() === activeId);

      if (isBaseItem) {
        setBaseItems(items => {
          const oldIndex = items.findIndex(i => i.id.toString() === activeId);
          const newIndex = items.findIndex(i => i.id.toString() === overId);
          if (oldIndex === -1 || newIndex === -1) return items; // Safety check

          const newItems = arrayMove(items, oldIndex, newIndex);
          return newItems.map((item, index) => ({ ...item, sequence: index + 1 }));
        });
      } else {
        // Must be hardener item
        setHardenerItems(items => {
          const oldIndex = items.findIndex(i => i.id.toString() === activeId);
          const newIndex = items.findIndex(i => i.id.toString() === overId);
          if (oldIndex === -1 || newIndex === -1) return items;

          const newItems = arrayMove(items, oldIndex, newIndex);
          return newItems.map((item, index) => ({ ...item, sequence: index + 1 }));
        });
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fgRes, rmRes] = await Promise.all([
        masterProductApi.getAll({ type: 'FG' }),
        masterProductApi.getAll({ type: 'RM' }),
      ]);

      if (fgRes.success && fgRes.data) {
        setMasterProducts(fgRes.data);
      }
      if (rmRes.success && rmRes.data) {
        setRmMasterProducts(rmRes.data);
      }
    } catch (error) {
      logger.error('Failed to load data:', error);
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Helper to fetch recipe items
  const fetchRecipeItems = async (
    mpId: number
  ): Promise<{
    materials: RawMaterialItem[];
    mixingRatioPart?: number;
    viscosity?: string;
  } | null> => {
    try {
      if (!Number.isFinite(Number(mpId))) {
        return null;
      }

      // 1. Try saved development record
      const devRes = await productDevelopmentApi.getByMasterProductId(mpId);
      if (devRes && devRes.success && devRes.data) {
        const materials = (devRes.data.materials || []).map((item: any, index: number) => {
          const rmDetails = rmMasterProducts.find(rm => rm.masterProductId === item.materialId);
          const totalPct = Number(item.totalPercentage) || 0;
          let wtCalculated = Number(item.wtPerLtr || item.wtInLtr) || 0; // Check DB fields

          // Recalculate if missing or 0
          if (wtCalculated === 0 && totalPct > 0) {
            const density = Number(rmDetails?.RMDensity) || 1;
            wtCalculated = totalPct / density;
          }

          return {
            id: Date.now() + Math.random(),
            productId: item.materialId,
            productName: rmDetails?.masterProductName || 'Unknown Material',
            percentage: Number(item.percentage),
            totalPercentage: totalPct,
            wtInLtr: wtCalculated ? wtCalculated.toFixed(3) : 0,
            sequence: item.sequence,
            waitingTime: item.waitingTime || 0,
          };
        });
        return {
          materials,
          mixingRatioPart:
            devRes.data.mixingRatioPart !== null && devRes.data.mixingRatioPart !== undefined
              ? Number(devRes.data.mixingRatioPart)
              : undefined,
          viscosity:
            devRes.data.viscosity !== null && devRes.data.viscosity !== undefined
              ? String(devRes.data.viscosity)
              : '',
        };
      }

      // 2. Fallback to BOM
      const bomItems = await bomApi.getBOMByFinishedGood(mpId);
      if (bomItems && bomItems.length > 0) {
        let mappedItems = bomItems.map((item: any, index: number) => {
          const rmId = item.RawMaterialID || item.rawMaterialId || item.raw_material_id;
          const rmDetails = rmMasterProducts.find(rm => rm.masterProductId == rmId);
          return {
            id: Date.now() + Math.random(),
            productId: Number(rmId),
            productName: rmDetails?.masterProductName || 'Unknown Material',
            percentage: Number(item.percentageRequired || item.PercentageRequired || 0),
            totalPercentage: 0,
            wtInLtr: 0,
            sequence: item.Sequence || item.sequence || index + 1,
            waitingTime: item.WaitingTime || item.waitingTime || 0,
          };
        });

        const totalPercent = mappedItems.reduce(
          (sum: number, item: any) => sum + (Number(item.percentage) || 0),
          0
        );
        if (totalPercent > 0 && totalPercent <= 1.05) {
          mappedItems = mappedItems.map((item: any) => ({
            ...item,
            percentage: Math.round((Number(item.percentage) || 0) * 100),
          }));
        }
        return { materials: mappedItems };
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  const handleMasterProductSelect = async (value: any) => {
    setSelectedMasterProductId(value);

    // Find selected Base product
    const baseProduct = masterProducts.find(p => p.masterProductId === value);

    // Load Base Recipe
    const baseData = await fetchRecipeItems(value);
    setBaseItems(baseData?.materials || []);
    setViscosity(baseData?.viscosity || '');
    if (baseData?.mixingRatioPart !== null && baseData?.mixingRatioPart !== undefined) {
      setRatioBase(String(baseData.mixingRatioPart));
    } else {
      setRatioBase('');
    }

    // Handle Hardener
    if (baseProduct && baseProduct.HardenerID) {
      setLinkedHardenerId(baseProduct.HardenerID);
      const hardenerData = await fetchRecipeItems(baseProduct.HardenerID);
      setHardenerItems(hardenerData?.materials || []);
      if (hardenerData?.mixingRatioPart !== null && hardenerData?.mixingRatioPart !== undefined) {
        setRatioHardener(String(hardenerData.mixingRatioPart));
      } else {
        setRatioHardener('');
      }
    } else {
      setLinkedHardenerId(null);
      setHardenerItems([]);
      setRatioHardener('');
    }
  };

  const handleAddItem = (isHardener: boolean, rmId?: number | '') => {
    const currentRmId = rmId !== undefined ? rmId : selectedRmId;
    if (!currentRmId) {
      showToast.error('Please select a raw material first');
      return;
    }

    const productToAdd = rmMasterProducts.find(p => p.masterProductId === currentRmId);
    if (!productToAdd) {
      showToast.error('Product not found');
      return;
    }

    const targetItems = isHardener ? hardenerItems : baseItems;
    const alreadyExists = targetItems.some(item => item.productId === productToAdd.masterProductId);

    if (alreadyExists && !productToAdd.CanBeAddedMultipleTimes) {
      showToast.error('Product already added to this section');
      return;
    }

    const newItem: RawMaterialItem = {
      id: Date.now(),
      productId: productToAdd.masterProductId,
      productName: productToAdd.masterProductName,
      percentage: '',
      totalPercentage: '',
      wtInLtr: '',
      sequence: '',
      waitingTime: '',
    };

    if (isHardener) {
      setHardenerItems([...hardenerItems, newItem]);
    } else {
      setBaseItems([...baseItems, newItem]);
    }
    setSelectedRmId('');
  };

  const handleRemoveItem = (id: number, isHardener: boolean) => {
    if (isHardener) {
      setHardenerItems(prev => prev.filter(item => item.id !== id));
    } else {
      setBaseItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleUpdateItem = (
    id: number,
    field: keyof RawMaterialItem,
    value: string | number,
    isHardener: boolean
  ) => {
    const baseRatio = parseFloat(ratioBase) || 0;
    const hardenerRatio = parseFloat(ratioHardener) || 0;
    const totalRatio = baseRatio + hardenerRatio;
    let targetTotalSum = 0;
    if (isHardener) {
      const baseTotal = calculateListTotalPercentage(baseItems);
      targetTotalSum = 100 - baseTotal;
    } else {
      if (totalRatio > 0) {
        targetTotalSum = (baseRatio / totalRatio) * 100;
      } else {
        targetTotalSum = 100;
      }
    }
    const updater = (prev: RawMaterialItem[]) => {
      // Step 1: Update the specific item's value
      let newItems = prev.map(item => {
        if (item.id !== id) return item;

        let newValue = value;
        if (
          typeof newValue === 'string' &&
          newValue.length > 1 &&
          newValue.startsWith('0') &&
          newValue[1] !== '.'
        ) {
          newValue = newValue.substring(1);
        }
        // Prevent negative values
        if (typeof newValue === 'number' && newValue < 0) {
          newValue = 0;
        } else if (typeof newValue === 'string') {
          const parsed = parseFloat(newValue);
          if (parsed < 0) {
            newValue = '0';
          }
        }

        const updatedItem = { ...item, [field]: newValue };
        const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
        const density =
          rmProduct?.RMDensity && parseFloat(rmProduct.RMDensity.toString()) > 0
            ? parseFloat(rmProduct.RMDensity.toString())
            : 1;

        // If updating Total %, calculate Wt/Ltr immediately
        if (field === 'totalPercentage') {
          const totalPct = parseFloat(newValue.toString()) || 0;
          updatedItem.wtInLtr = (totalPct / density).toFixed(3);
        }

        // If updating Percent %, calculate Total % and Wt/Ltr
        if (field === 'percentage') {
          const pct = parseFloat(newValue.toString()) || 0;

          if (isHardener) {
            // For hardener: Total % = Percent % × (hardenerTotal / 100)
            const baseTotal = calculateListTotalPercentage(baseItems);
            const hardenerTotal = 100 - baseTotal;
            const totalPct = hardenerTotal > 0 ? (pct * hardenerTotal) / 100 : 0;
            updatedItem.totalPercentage = totalPct.toFixed(3);
            updatedItem.wtInLtr = (totalPct / density).toFixed(3);
          } else {
            // For base: existing logic
            const otherItemsPercentSum = prev
              .filter(i => i.id !== id)
              .reduce((sum, i) => sum + (Number(i.percentage) || 0), 0);
            const newPercentSum = otherItemsPercentSum + pct;

            const currentTotalSum = prev.reduce(
              (sum, i) => sum + (Number(i.totalPercentage) || 0),
              0
            );

            let targetTotalSum = currentTotalSum;
            if (targetTotalSum === 0 && totalRatio > 0) {
              const componentRatio = baseRatio;
              targetTotalSum = (componentRatio / totalRatio) * 100;
            } else if (targetTotalSum === 0) {
              targetTotalSum = 100;
            }

            if (newPercentSum > 0) {
              const newTotalPct = (pct / newPercentSum) * targetTotalSum;
              updatedItem.totalPercentage = newTotalPct.toFixed(3);
              updatedItem.wtInLtr = (newTotalPct / density).toFixed(3);
            } else {
              updatedItem.totalPercentage = '0';
              updatedItem.wtInLtr = '0';
            }
          }
        }

        return updatedItem;
      });

      // Step 2: Global Recalculation (Only if Total % changed)
      if (field === 'totalPercentage') {
        let totalSum;
        if (isHardener) {
          // For hardener, use the fixed hardener total (100 - base total)
          totalSum = 100 - calculateListTotalPercentage(baseItems);
        } else {
          totalSum = newItems.reduce((sum, i) => sum + (Number(i.totalPercentage) || 0), 0);
        }
        newItems = newItems.map(item => {
          const itemTotal = Number(item.totalPercentage) || 0;
          let newPercent = '0';
          if (totalSum > 0) {
            newPercent = ((itemTotal / totalSum) * 100).toFixed(3);
          }
          return { ...item, percentage: newPercent };
        });
      }

      return newItems;
    };

    if (isHardener) {
      setHardenerItems(updater);
    } else {
      const newItems = updater(baseItems);
      const newBaseTotal = calculateListTotalPercentage(newItems);
      setBaseItems(newItems);
      // Recalculate hardener totalPercentages when base changes
      setHardenerItems(prevHardener =>
        prevHardener.map(item => {
          const pct = parseFloat(item.percentage.toString()) || 0;
          const hardenerTotal = 100 - newBaseTotal;
          const totalPct = hardenerTotal > 0 ? (pct * hardenerTotal) / 100 : 0;
          const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
          const density =
            rmProduct?.RMDensity && parseFloat(rmProduct.RMDensity.toString()) > 0
              ? parseFloat(rmProduct.RMDensity.toString())
              : 1;
          return {
            ...item,
            totalPercentage: totalPct.toFixed(3),
            wtInLtr: (totalPct / density).toFixed(3),
          };
        })
      );
    }
  };

  const calculateTotalPercentage = (items: RawMaterialItem[]) => {
    return items.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
  };

  const calculateTotalWtInLtr = (items: RawMaterialItem[]) => {
    return items.reduce((sum, item) => sum + (Number(item.wtInLtr) || 0), 0);
  };

  const calculateGrandTotalPercentage = () => {
    return 100; // Fixed at 100%
  };

  const calculateSolidVolumeRatio = (items: RawMaterialItem[]) => {
    let totalVolume = 0;
    let solidVolume = 0;

    for (const item of items) {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      if (rmProduct && rmProduct.RMDensity) {
        const density = Math.abs(parseFloat(rmProduct.RMDensity.toString())) || 1;
        const weight = Math.max(0, Number(item.percentage) || 0);

        // Total Volume uses liquid density for all materials
        totalVolume += weight / density;

        // Solid Volume calculation - use SolidDensity for Resins
        // RMSolids defaults to 0 if not set (treats unknown materials as solvents)
        if (rmProduct.RMSolids !== null && rmProduct.RMSolids !== undefined) {
          const solids = Math.max(0, Math.min(100, parseFloat(rmProduct.RMSolids.toString())));

          // For Resins: use SolidDensity if available, otherwise use RMDensity
          const isResin = rmProduct.Subcategory === 'Resin';
          const solidDensity =
            isResin && rmProduct.SolidDensity
              ? Math.abs(parseFloat(rmProduct.SolidDensity.toString())) || density
              : density;

          // sv = (weight × solids%) / solidDensity
          solidVolume += (weight * (solids / 100)) / solidDensity;
        }
      }
    }

    if (totalVolume === 0) return 0;
    return Math.max(0, Math.min(100, (solidVolume / totalVolume) * 100));
  };

  // Calculate Density for a formulation
  const calculateDensity = (items: RawMaterialItem[]) => {
    let totalMass = 0;
    let totalVolume = 0;

    for (const item of items) {
      const mass = Number(item.percentage) || 0;
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
  };

  // Calculate Production Cost/Ltr for a formulation
  const calculateProductionCost = (items: RawMaterialItem[]) => {
    let totalCostInvested = 0;

    for (const item of items) {
      const mass = Number(item.percentage) || 0;
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      const purchaseCost = rmProduct?.PurchaseCost ? Number(rmProduct.PurchaseCost) : 0;
      totalCostInvested += mass * purchaseCost;
    }

    const density = calculateDensity(items);
    if (density > 0) {
      return (totalCostInvested / 100) * density;
    }
    return 0;
  };

  /**
   * Calculate PVC (Pigment Volume Concentration) for a formulation
   * PVC = (Total Pigment Volume / (Total Pigment Volume + Total Binder Volume)) × 100
   * Only uses Extender and Resin subcategories; General RMs are excluded
   */
  const calculatePVC = (items: RawMaterialItem[]) => {
    let totalPigmentVolume = 0;
    let totalBinderVolume = 0;

    for (const item of items) {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      if (!rmProduct) continue;

      const weight = Number(item.percentage) || 0;
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
    }

    const totalVolume = totalPigmentVolume + totalBinderVolume;
    if (totalVolume === 0) return 0;

    return (totalPigmentVolume / totalVolume) * 100;
  };

  /**
   * Calculate CPVC (Critical Pigment Volume Concentration) for a formulation
   *
   * CPVC is material-dependent and not directly calculable from formulation data.
   * For typical alkyd/QD resin systems with Calcite + Talc + Rutile TiO₂:
   * - CPVC range: 50-55%
   * - Using 52% as the standard value
   *
   * Only uses Extender subcategory; returns 0 if no extenders present
   */
  const calculateCPVC = (items: RawMaterialItem[]) => {
    // Check if we have any Extenders in the formulation
    const hasExtenders = items.some(item => {
      const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
      return rmProduct?.Subcategory === 'Extender';
    });

    // Return 0 if no extenders in formulation
    if (!hasExtenders) return 0;

    // Standard CPVC for alkyd/QD resin systems with calcite, talc, TiO₂
    return 52;
  };

  // Calculate mixture values (weighted by ratios)
  const calculateMixtureValues = () => {
    const baseRatio = parseFloat(ratioBase) || 0;
    const hardenerRatio = parseFloat(ratioHardener) || 0;
    const totalRatio = baseRatio + hardenerRatio;

    if (totalRatio === 0) {
      return { mixtureSvr: 0, mixtureDensity: 0, mixtureCost: 0, mixturePvc: 0, mixtureCpvc: 0 };
    }

    const baseSvr = calculateSolidVolumeRatio(baseItems);
    const hardenerSvr = calculateSolidVolumeRatio(hardenerItems);
    const baseDensity = calculateDensity(baseItems);
    const hardenerDensity = calculateDensity(hardenerItems);
    const baseCost = calculateProductionCost(baseItems);
    const hardenerCost = calculateProductionCost(hardenerItems);
    const basePvc = calculatePVC(baseItems);
    const hardenerPvc = calculatePVC(hardenerItems);
    const baseCpvc = calculateCPVC(baseItems);
    const hardenerCpvc = calculateCPVC(hardenerItems);

    const baseWeight = baseRatio / totalRatio;
    const hardenerWeight = hardenerRatio / totalRatio;

    const mixtureSvr = baseSvr * baseWeight + hardenerSvr * hardenerWeight;
    const mixtureDensity = baseDensity * baseWeight + hardenerDensity * hardenerWeight;
    const mixtureCost = baseCost * baseWeight + hardenerCost * hardenerWeight;
    const mixturePvc = basePvc * baseWeight + hardenerPvc * hardenerWeight;
    const mixtureCpvc = baseCpvc * baseWeight + hardenerCpvc * hardenerWeight;

    return { mixtureSvr, mixtureDensity, mixtureCost, mixturePvc, mixtureCpvc };
  };

  const handleSave = async () => {
    if (!selectedMasterProductId) {
      showToast.error('Please select a Master Product');
      return;
    }

    // Check if any base item has Total % = 0
    if (baseItems.some(item => Number(item.totalPercentage) === 0)) {
      showToast.error('Some base items have Total % as 0. Please configure properly.');
      return;
    }

    // Check if hardener is linked but not configured.
    // Only enforce when expected hardener total > 0 (i.e., base total < 100).
    const baseTotalForSave = calculateListTotalPercentage(baseItems);
    const expectedHardenerTotal = Math.max(0, 100 - baseTotalForSave);
    if (linkedHardenerId && expectedHardenerTotal > 0) {
      // If hardener expected non-zero, ensure hardener has items and none have totalPercentage == 0
      if (
        hardenerItems.length === 0 ||
        hardenerItems.some(item => Number(item.totalPercentage) === 0)
      ) {
        showToast.error('Set the hardener first');
        return;
      }
    }

    try {
      setSaving(true);

      // Save Base
      const baseResponse = await productDevelopmentApi.create({
        masterProductId: selectedMasterProductId,
        density: calculateDensity(baseItems),
        viscosity: parseFloat(viscosity) || 0,
        hours: calculateProductionCost(baseItems),
        perPercent: 0,
        mixingRatioPart: parseFloat(ratioBase) || 0,
        materials: baseItems.map(item => ({
          ...item,
          wtInLtr: Number(item.wtInLtr) || 0,
          totalPercentage: Number(item.totalPercentage) || 0,
        })),
        status:
          Math.abs(calculateTotalPercentage(baseItems) - 100) < 0.01 ? 'Completed' : 'Incomplete',
      });

      if (!baseResponse || !baseResponse.success) {
        logger.error('Base save failed:', baseResponse?.error);
        showToast.error(baseResponse?.error || 'Failed to save base recipe');
        return;
      }

      // Save Hardener if exists
      if (linkedHardenerId && hardenerItems.length > 0) {
        const hardenerResponse = await productDevelopmentApi.create({
          masterProductId: linkedHardenerId,
          density: calculateDensity(hardenerItems),
          hours: calculateProductionCost(hardenerItems),
          perPercent: 0,
          mixingRatioPart: parseFloat(ratioHardener) || 0,
          materials: hardenerItems.map(item => ({
            ...item,
            wtInLtr: Number(item.wtInLtr) || 0,
            totalPercentage: Number(item.totalPercentage) || 0,
          })),
          status:
            Math.abs(calculateTotalPercentage(hardenerItems) - 100) < 0.01
              ? 'Completed'
              : 'Incomplete',
        });

        if (!hardenerResponse || !hardenerResponse.success) {
          logger.error('Hardener save failed:', hardenerResponse?.error);
          showToast.error(hardenerResponse?.error || 'Failed to save hardener recipe');
          return;
        }
      }

      // 3. Update Base Master Product Linkage
      if (selectedMasterProductId) {
        await masterProductApi.update(Number(selectedMasterProductId), {
          HardenerID: linkedHardenerId,
        });
      }

      showToast.success('Formulations and Linkage saved successfully');
      setSaving(false);
    } catch (error) {
      handleApiError(error, 'save product development recipes');
    } finally {
      setSaving(false);
    }
  };

  const baseTotal = calculateTotalPercentage(baseItems);
  const hardenerTotal = calculateTotalPercentage(hardenerItems);

  // Filter for Base products only
  const masterProductOptions = useMemo(
    () =>
      masterProducts
        .filter(mp => mp.Subcategory === 'Base')
        .map(mp => ({
          id: mp.masterProductId,
          label: mp.masterProductName,
          value: mp.masterProductId,
          subLabel: String(mp.masterProductId),
        })),
    [masterProducts]
  );

  const rmProductOptions = useMemo(
    () =>
      rmMasterProducts
        .filter(mp => {
          const isAlreadyAdded = baseItems.some(item => item.productId === mp.masterProductId);
          if (isAlreadyAdded && !mp.CanBeAddedMultipleTimes) return false;
          return true;
        })
        .map(mp => ({
          id: mp.masterProductId,
          label: mp.masterProductName,
          value: mp.masterProductId,
          subLabel: mp.CanBeAddedMultipleTimes ? '✓ Can add multiple times' : undefined,
        })),
    [rmMasterProducts, baseItems]
  );

  // Helper to calculate total percentage of a specific list (for local footer)
  const calculateListTotalPercentage = (items: RawMaterialItem[]) => {
    return items.reduce((sum, item) => sum + (Number(item.totalPercentage) || 0), 0);
  };

  const handleUpdateTotals = (newTotal: string, isHardener: boolean) => {
    const targetItems = isHardener ? hardenerItems : baseItems;
    const parsedNewTotal = parseFloat(newTotal) || 0;

    const updater = (prev: RawMaterialItem[]) => {
      let newItems = prev.map(item => {
        const pct = parseFloat(item.percentage.toString()) || 0;
        const newTotalPct = (pct / 100) * parsedNewTotal;
        const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
        const density =
          rmProduct?.RMDensity && parseFloat(rmProduct.RMDensity.toString()) > 0
            ? parseFloat(rmProduct.RMDensity.toString())
            : 1;
        return {
          ...item,
          totalPercentage: newTotalPct.toFixed(3),
          wtInLtr: (newTotalPct / density).toFixed(3),
        };
      });

      // Global recalc for percentage
      const totalSum = newItems.reduce((sum, i) => sum + (Number(i.totalPercentage) || 0), 0);
      newItems = newItems.map(item => {
        const itemTotal = Number(item.totalPercentage) || 0;
        let newPercent = '0';
        if (totalSum > 0) {
          newPercent = ((itemTotal / totalSum) * 100).toFixed(3);
        }
        return { ...item, percentage: newPercent };
      });

      return newItems;
    };

    if (isHardener) {
      setHardenerItems(updater);
    } else {
      setBaseItems(updater);
      // Recalculate hardener totalPercentages when base changes
      setHardenerItems(prevHardener =>
        prevHardener.map(item => {
          const pct = parseFloat(item.percentage.toString()) || 0;
          const baseTotal = calculateListTotalPercentage(baseItems);
          const hardenerTotal = 100 - baseTotal;
          const totalPct = hardenerTotal > 0 ? (pct * hardenerTotal) / 100 : 0;
          const rmProduct = rmMasterProducts.find(rm => rm.masterProductId === item.productId);
          const density =
            rmProduct?.RMDensity && parseFloat(rmProduct.RMDensity.toString()) > 0
              ? parseFloat(rmProduct.RMDensity.toString())
              : 1;
          return {
            ...item,
            totalPercentage: totalPct.toFixed(3),
            wtInLtr: (totalPct / density).toFixed(3),
          };
        })
      );
    }
  };

  // Per-Table Copy/Paste
  const handleCopyTable = (items: RawMaterialItem[]) => {
    if (items.length === 0) {
      showToast.error('No items to copy');
      return;
    }
    const dataToSave = items.map(({ id, ...rest }) => rest); // Exclude IDs
    try {
      localStorage.setItem('copiedTableData', JSON.stringify(dataToSave));
      showToast.success('Table data copied');
    } catch (err) {
      showToast.error('Failed to copy');
    }
  };

  const handlePasteTable = (isHardener: boolean) => {
    try {
      const saved = localStorage.getItem('copiedTableData');
      if (!saved) {
        showToast.error('No data in clipboard');
        return;
      }
      const data = JSON.parse(saved);
      const newItems = data.map((item: any) => ({
        ...item,
        id: Date.now() + Math.random(),
      }));

      if (isHardener) setHardenerItems(newItems);
      else setBaseItems(newItems);

      showToast.success('Data pasted');
    } catch (err) {
      showToast.error('Failed to paste');
    }
  };

  // Render Helper for Formulation Table
  const renderTable = (
    items: RawMaterialItem[],
    isHardener: boolean,
    productName: string,
    showGrandTotal: boolean = false,
    baseItemsForCalculation?: RawMaterialItem[]
  ) => {
    return (
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] mt-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="bg-[var(--surface-highlight)] px-4 py-2 border-b border-[var(--border)]">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-sm uppercase text-[var(--text-secondary)]">
                  {isHardener ? 'Hardener Formulation' : 'Base Formulation'}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCopyTable(items)}
                    className="p-1 hover:bg-[var(--surface)] rounded text-[var(--text-secondary)] hover:text-[var(--primary)]"
                    title="Copy Table"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handlePasteTable(isHardener)}
                    className="p-1 hover:bg-[var(--surface)] rounded text-[var(--text-secondary)] hover:text-[var(--primary)]"
                    title="Paste Table"
                  >
                    <Clipboard size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="text-sm font-medium text-[var(--primary)]">{productName || '--'}</div>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--surface-highlight)] text-[var(--text-secondary)] uppercase text-xs font-semibold">
              <tr>
                <th className="px-2 py-3 w-10"></th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 w-32">Total %</th>
                <th className="px-4 py-3 w-32">Percent %</th>
                <th className="px-4 py-3 w-32">Wt/Ltr</th>
                <th className="px-4 py-3 w-32">Sequence</th>
                <th className="px-4 py-3 w-32">Waiting Time</th>
                <th className="px-4 py-3 w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No materials added yet.
                  </td>
                </tr>
              ) : (
                <SortableContext
                  items={items.map(item => item.id.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map(item => (
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
                          type="number"
                          value={item.totalPercentage}
                          onChange={e =>
                            handleUpdateItem(item.id, 'totalPercentage', e.target.value, isHardener)
                          }
                          onKeyDown={e => {
                            handleInputKeyDown(
                              e,
                              items.indexOf(item),
                              'totalPercentage',
                              isHardener,
                              items
                            );
                            if (
                              ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          data-table={isHardener ? 'hardener' : 'base'}
                          data-row-index={items.indexOf(item)}
                          data-column="totalPercentage"
                          step="0.01"
                          readOnly={isHardener}
                          className={
                            isHardener
                              ? 'w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-highlight)] text-[var(--text-secondary)] cursor-not-allowed focus:outline-none'
                              : 'w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all'
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.percentage}
                          onChange={e =>
                            handleUpdateItem(item.id, 'percentage', e.target.value, isHardener)
                          }
                          onKeyDown={e => {
                            handleInputKeyDown(
                              e,
                              items.indexOf(item),
                              'percentage',
                              isHardener,
                              items
                            );
                            if (
                              ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          data-table={isHardener ? 'hardener' : 'base'}
                          data-row-index={items.indexOf(item)}
                          data-column="percentage"
                          step="0.01"
                          readOnly={isHardener}
                          className={
                            isHardener
                              ? 'w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-highlight)] text-[var(--text-secondary)] cursor-not-allowed focus:outline-none'
                              : 'w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all'
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.wtInLtr}
                          readOnly
                          className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-highlight)] text-[var(--text-secondary)] cursor-not-allowed focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.sequence}
                          onChange={e =>
                            handleUpdateItem(item.id, 'sequence', e.target.value, isHardener)
                          }
                          onKeyDown={e => {
                            handleInputKeyDown(
                              e,
                              items.indexOf(item),
                              'sequence',
                              isHardener,
                              items
                            );
                            if (
                              ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          data-table={isHardener ? 'hardener' : 'base'}
                          data-row-index={items.indexOf(item)}
                          data-column="sequence"
                          className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.waitingTime}
                          onChange={e =>
                            handleUpdateItem(item.id, 'waitingTime', e.target.value, isHardener)
                          }
                          onKeyDown={e => {
                            handleInputKeyDown(
                              e,
                              items.indexOf(item),
                              'waitingTime',
                              isHardener,
                              items
                            );
                            if (
                              ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          data-table={isHardener ? 'hardener' : 'base'}
                          data-row-index={items.indexOf(item)}
                          data-column="waitingTime"
                          className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleRemoveItem(item.id, isHardener)}
                          className="text-[var(--danger)] hover:text-[var(--danger-hover)] p-1 rounded hover:bg-[var(--danger-bg)] transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </SortableRow>
                  ))}
                </SortableContext>
              )}
            </tbody>
            <tfoot className="bg-[var(--surface-highlight)] border-t border-[var(--border)] font-semibold text-[var(--text-primary)]">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right">
                  Totals:
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={
                      isHardener
                        ? (
                            100 - calculateListTotalPercentage(baseItemsForCalculation || [])
                          ).toFixed(3)
                        : calculateListTotalPercentage(items).toFixed(3)
                    }
                    step="0.01"
                    readOnly
                    className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-highlight)] text-[var(--text-secondary)] cursor-not-allowed font-bold"
                  />
                </td>
                <td
                  className={`px-4 py-3 font-bold ${
                    calculateTotalPercentage(items).toFixed(3) === '100.000'
                      ? 'text-[var(--success)] bg-green-50'
                      : 'text-[var(--danger)] bg-red-50'
                  }`}
                >
                  {calculateTotalPercentage(items).toFixed(3)}%
                </td>
                <td className="px-4 py-3">{calculateTotalWtInLtr(items).toFixed(3)}</td>
                <td colSpan={3} className="px-4 py-3 text-right">
                  {!isHardener && linkedHardenerId && (() => {
                    const targetValue =
                      (parseFloat(ratioBase || '0') /
                        (parseFloat(ratioHardener || '1') || 1)) *
                      calculateTotalWtInLtr(hardenerItems);
                    const totalWtLtr = calculateTotalWtInLtr(items);
                    const difference = totalWtLtr - targetValue;
                    const diffVal = parseFloat(difference.toFixed(3));

                    let recText = '';
                    let recColor = '';
                    if (diffVal < 0) {
                      recText = '↑ Increase Base Volume';
                      recColor = '#d97706'; // Amber
                    } else if (diffVal > 0) {
                      recText = '↓ Reduce Base Volume';
                      recColor = '#2563eb'; // Blue
                    } else {
                      recText = '✓ Base Volume is Accurate';
                      recColor = '#16a34a'; // Green
                    }

                    return (
                      <span
                        style={{
                          color: recColor,
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      >
                        {recText}
                      </span>
                    );
                  })()}
                </td>
              </tr>
              {showGrandTotal && (
                <tr className="bg-[var(--surface)] border-t border-[var(--border)] border-dashed">
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-[var(--primary)]">
                    Grand Total %:
                  </td>
                  <td className="px-4 py-3 font-bold text-[var(--primary)]">
                    {calculateGrandTotalPercentage().toFixed(3)}%
                  </td>
                  {!isHardener && linkedHardenerId ? (
                    <>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text-secondary)]">
                        Target:
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                        {(() => {
                          const targetValue =
                            (parseFloat(ratioBase || '0') /
                              (parseFloat(ratioHardener || '1') || 1)) *
                            calculateTotalWtInLtr(hardenerItems);
                          return targetValue.toFixed(3);
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text-secondary)]">
                        Difference:
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                        {(() => {
                          const targetValue =
                            (parseFloat(ratioBase || '0') /
                              (parseFloat(ratioHardener || '1') || 1)) *
                            calculateTotalWtInLtr(hardenerItems);
                          const totalWtLtr = calculateTotalWtInLtr(items);
                          return (totalWtLtr - targetValue).toFixed(3);
                        })()}
                      </td>
                      <td></td>
                    </>
                  ) : (
                    <td colSpan={5}></td>
                  )}
                </tr>
              )}
            </tfoot>
          </table>
        </DndContext>

        {/* Per-table calculations: SVR, PVC, CPVC, Density, Production Cost */}
        {items.length > 0 && (
          <div className="bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)] font-medium">SVR:</span>
                <span className="text-[var(--text-primary)] font-semibold">
                  {calculateSolidVolumeRatio(items).toFixed(3)}%
                </span>
              </div>
              {/* <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)] font-medium">PVC:</span>
                <span className="text-[var(--text-primary)] font-semibold">
                  {calculatePVC(items).toFixed(3)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)] font-medium">CPVC:</span>
                <span className="text-[var(--text-primary)] font-semibold">
                  {calculateCPVC(items).toFixed(3)}%
                </span>
              </div> */}
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)] font-medium">Density:</span>
                <span className="text-[var(--text-primary)] font-semibold">
                  {calculateDensity(items).toFixed(3)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)] font-medium">
                  Production Cost/Ltr:
                </span>
                <span className="text-[var(--text-primary)] font-semibold">
                  ₹{calculateProductionCost(items).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleCopyRecipe = () => {
    if (baseItems.length === 0 && hardenerItems.length === 0) {
      showToast.error('No recipe data to copy');
      return;
    }
    const recipeData = {
      baseItems,
      hardenerItems,
      ratioBase,
      ratioHardener,
    };
    try {
      localStorage.setItem('copiedRecipe', JSON.stringify(recipeData));
      showToast.success('Recipe copied to clipboard');
    } catch (err) {
      showToast.error('Failed to copy recipe');
    }
  };

  const handlePasteRecipe = () => {
    try {
      const saved = localStorage.getItem('copiedRecipe');
      if (!saved) {
        showToast.error('No recipe found in clipboard');
        return;
      }
      const data = JSON.parse(saved);

      // Regenerate IDs to avoid conflicts
      const newBaseItems = (data.baseItems || []).map((item: RawMaterialItem) => ({
        ...item,
        id: Date.now() + Math.random(),
      }));
      const newHardenerItems = (data.hardenerItems || []).map((item: RawMaterialItem) => ({
        ...item,
        id: Date.now() + Math.random() + 1,
      }));

      setBaseItems(newBaseItems);
      setHardenerItems(newHardenerItems);
      setRatioBase(data.ratioBase || '');
      setRatioHardener(data.ratioHardener || '');

      showToast.success('Recipe pasted successfully');
    } catch (err) {
      showToast.error('Failed to paste recipe');
    }
  };

  if (loading) return <div className="flex justify-center p-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="2K Product Development Form"
        description="Manage formulations for Base and Linked Hardener"
      />

      <div className="card p-6 space-y-6">
        {/* Top Controls: Product Select & Ratio */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Base Master Product <span className="text-[var(--danger)]">*</span>
            </label>
            <SearchableSelect
              options={masterProductOptions}
              value={selectedMasterProductId}
              onChange={handleMasterProductSelect}
              placeholder="Select Base Product..."
              className="w-full"
            />
            {/* Hardener Selection */}
            {selectedMasterProductId && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Linked Hardener
                </label>
                <SearchableSelect
                  options={masterProducts
                    .filter(
                      p =>
                        p.productType === 'FG' &&
                        p.masterProductId !== selectedMasterProductId &&
                        (p.Subcategory === 'Hardener' || p.masterProductId === linkedHardenerId)
                    )
                    .map(p => ({
                      id: p.masterProductId,
                      value: p.masterProductId,
                      label: p.masterProductName,
                    }))}
                  value={linkedHardenerId || ''}
                  onChange={async value => {
                    const newId = Number(value) || null;
                    setLinkedHardenerId(newId);

                    if (newId) {
                      setLoading(true);
                      try {
                        const hardenerData = await fetchRecipeItems(newId);
                        setHardenerItems(hardenerData?.materials || []);
                        if (
                          hardenerData?.mixingRatioPart !== null &&
                          hardenerData?.mixingRatioPart !== undefined
                        ) {
                          setRatioHardener(String(hardenerData.mixingRatioPart));
                        } else {
                          setRatioHardener('');
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      setHardenerItems([]);
                      setRatioHardener('');
                    }
                  }}
                  placeholder="Select Hardener (Optional)..."
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Ratio Section */}
          <div className="bg-[var(--primary-bg)] p-4 rounded-lg flex items-center gap-4">
            <span className="font-semibold text-sm text-[var(--primary)]">Mixing Ratio:</span>
            <div className="flex items-center gap-2">
              <Input
                value={ratioBase}
                onChange={e => setRatioBase(e.target.value)}
                onKeyDown={e => {
                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder="Base"
                className="w-20 text-center"
              />
              <span className="font-bold text-[var(--text-secondary)]">:</span>
              <Input
                value={ratioHardener}
                onChange={e => setRatioHardener(e.target.value)}
                onKeyDown={e => {
                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder="Hardener"
                className="w-20 text-center"
              />
            </div>
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
        </div>

        <hr className="border-[var(--border)]" />

        {/* RM Search Bar (Common) */}
        <div className="flex gap-4 items-end bg-[var(--surface-highlight)] p-4 rounded-lg">
          <div className="flex-grow">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Search Raw Material to Add
            </label>
            <SearchableSelect
              options={rmProductOptions}
              value={selectedRmId}
              onChange={val => {
                setSelectedRmId(val ?? '');
                if (val) {
                  handleAddItem(false, val);
                  setSelectedRmId('');
                }
              }}
              placeholder="Search RM..."
              className="w-full"
              onEnter={() => {
                if (selectedRmId) {
                  handleAddItem(false);
                  setSelectedRmId('');
                }
              }}
            />
          </div>
        </div>

        {/* Base Section */}
        <div>
          {renderTable(
            baseItems,
            false,
            masterProducts.find(p => p.masterProductId === selectedMasterProductId)
              ?.masterProductName || '',
            true
          )}
        </div>

        <div className="border-t-2 border-[var(--border)] my-8"></div>

        {/* Hardener Section */}
        {linkedHardenerId ? (
          <div>
            {renderTable(
              hardenerItems,
              true,
              masterProducts.find(p => p.masterProductId === linkedHardenerId)?.masterProductName ||
                '',
              true,
              baseItems
            )}
          </div>
        ) : (
          <div className="text-center p-8 bg-[var(--surface-highlight)] rounded-lg text-[var(--text-secondary)] border border-dashed border-[var(--border)]">
            No Hardener linked to this Base product.
          </div>
        )}

        {/* Combined Totals Section */}
        {(baseItems.length > 0 || hardenerItems.length > 0) && (
          <div className="bg-gradient-to-r from-[var(--primary-bg)] to-[var(--surface-highlight)] border border-[var(--primary)] rounded-lg p-4 mt-6">
            <h4 className="text-sm font-semibold uppercase text-[var(--primary)] mb-3">
              Mixture Totals (Base + Hardener)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-[var(--surface)] rounded-lg p-3 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)] uppercase font-medium">
                  Total SVR
                </div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  {linkedHardenerId
                    ? `${calculateMixtureValues().mixtureSvr.toFixed(2)}%`
                    : `${calculateSolidVolumeRatio(baseItems).toFixed(2)}%`}
                </div>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-3 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)] uppercase font-medium">
                  Total PVC
                </div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  {linkedHardenerId
                    ? `${calculateMixtureValues().mixturePvc.toFixed(2)}%`
                    : `${calculatePVC(baseItems).toFixed(2)}%`}
                </div>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-3 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)] uppercase font-medium">
                  Total CPVC
                </div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  {linkedHardenerId
                    ? `${calculateMixtureValues().mixtureCpvc.toFixed(2)}%`
                    : `${calculateCPVC(baseItems).toFixed(2)}%`}
                </div>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-3 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)] uppercase font-medium">
                  Total Density
                </div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  {linkedHardenerId
                    ? calculateMixtureValues().mixtureDensity.toFixed(3)
                    : calculateDensity(baseItems).toFixed(3)}
                </div>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-3 border border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)] uppercase font-medium">
                  Total Cost/Ltr
                </div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  ₹
                  {linkedHardenerId
                    ? calculateMixtureValues().mixtureCost.toFixed(2)
                    : calculateProductionCost(baseItems).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="fixed bottom-0 right-0 p-6 z-50">
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
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
                'Save Formulations'
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

export default DoubleProductDevelopment;
