import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productionManagerApi } from '../api/productionManagerApi';
import { masterProductApi } from '../../master-products/api/masterProductApi';
import { bomApi } from '../api/bomApi';
import { productApi } from '../../master-products/api/productApi';
import { productDevelopmentApi } from '../../masters/api/productDevelopment';
import { employeeApi } from '../../employees/api/employeeApi';
import { companyApi } from '../../company/api/companyApi';
import { CompanyInfo } from '../../company/types';
import { PageHeader } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import {
  User,
  Eye,
  Weight,
  Users,
  Check,
  Download,
  X,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Play,
  Clock,
  Calendar,
  Plus,
  Trash2,
} from 'lucide-react';
import { SearchableSelect, Button } from '@/components/ui';
import { showToast } from '@/utils/toast';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter } from '@/utils/pdfUtils';
import BatchReportModal from '../components/BatchReportModal';
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

interface SelectedProduct {
  orderId: number;
  orderNumber: string;
  productId: number;
  productName: string;
  quantity: number;
  customerId: number;
  customerName: string;
  requiredWeightKg?: number;
  packageCapacityKg?: number;
  masterProductId?: number;
  packagingId?: number;
  sellingPrice?: number;
}

export interface ProductCostInfo {
  productId: number;
  productName: string;
  pmCapacity: number; // New field
  packQty: string;
  productionQty: number | string;
  packagingName?: string;
  // Kept for interface compatibility if used elsewhere, but optional
  perKgCost?: number;
  packingCost?: number;
  unitSellingRate?: number;
  perLtrCost?: number;
  productionCost?: number;
  grossProfit?: number;
}

interface DistributionInfo {
  orderId: number;
  productId: number;
  productName: string;
  requiredWeightKg: number;
  packageCapacityKg: number;
  plannedPackages: number;
  totalDistributionWeight: number;
}

/**
 * Display helper for material quantities.
 * Internally all calculations keep full precision (up to 6 decimals).
 * UI shows 3 decimals; if a NON-ZERO value would display as 0.000,
 * show '0.000+' so it is never mistaken for exactly zero.
 */
const formatQty = (value: number | string | null | undefined): string => {
  const num = Number(value) || 0;
  const rounded = num.toFixed(3);
  if (num > 0 && parseFloat(rounded) === 0) return '0.000+';
  return rounded;
};

// Sortable Row Component for DnD
function SortableRow({
  id,
  children,
  isDisabled = false,
}: {
  id: string;
  children: React.ReactNode;
  isDisabled?: boolean;
}) {
  const sortable = useSortable({ id, disabled: isDisabled });

  if (isDisabled) {
    return (
      <tr className="hover:bg-[var(--surface-hover)]">
        <td className="px-2 py-2 text-center">
          <div className="p-1 text-[var(--text-secondary)]">
            <GripVertical size={16} />
          </div>
        </td>
        {children}
      </tr>
    );
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-[var(--surface-hover)]">
      <td className="px-2 py-2 text-center">
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

export default function ScheduleBatchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission, isAuthenticated } = useAuth();

  // Check if user has permission to create batches
  // NOTE: Access-denied guard is rendered AFTER all hooks (below, before the main return)
  // so that hooks always execute in the same order on every render (React Rules of Hooks).
  const canCreateBatch = hasPermission('production-manager', 'create');

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [distributions, setDistributions] = useState<DistributionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasProcessedRedirect, setHasProcessedRedirect] = useState(false);

  // Master Products
  // Master Products
  const [masterProducts, setMasterProducts] = useState<any[]>([]); // FD Dropdown
  const [allMasterProducts, setAllMasterProducts] = useState<any[]>([]); // ALL (RM, PM, FG) - for Stock/Cost lookup
  // const [mpSearchQuery, setMpSearchQuery] = useState('');
  // const [isMpDropdownOpen, setIsMpDropdownOpen] = useState(false);
  // const mpDropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [masterProductId, setMasterProductId] = useState<number>(0);
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [plannedQuantity, setPlannedQuantity] = useState<number>(0);
  const [supervisorId, setSupervisorId] = useState<number>(0);
  const [laborName, setLaborName] = useState('');

  // Hidden/Default fields
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [isBOMExpanded, setIsBOMExpanded] = useState(true);

  const [pmRemarks, setPmRemarks] = useState('');

  // Complete Batch Mode State
  const [isCompletingBatch, setIsCompletingBatch] = useState(false);
  const [completingBatchId, setCompletingBatchId] = useState<number | null>(null);
  const [completingBatchNo, setCompletingBatchNo] = useState('');
  const [completingMasterProductName, setCompletingMasterProductName] = useState('');

  // Output SKU State
  const [availableSkus, setAvailableSkus] = useState<any[]>([]);
  const [skuOutput, setSkuOutput] = useState<{ [productId: number]: number }>({});

  // Complete Batch Form State (Moved from Modal)
  const [actualQuantity, setActualQuantity] = useState<number | ''>('');
  const [actualDensity, setActualDensity] = useState<number | ''>('');
  const [actualViscosity, setActualViscosity] = useState<number | ''>('');

  // Planned Values (Reference for UI)
  const [plannedQuantityRef, setPlannedQuantityRef] = useState<number>(0);
  const [plannedDensityRef, setPlannedDensityRef] = useState<number>(0);
  const [plannedWaterPercentageRef, setPlannedWaterPercentageRef] = useState<number>(0);
  const [plannedViscosityRef, setPlannedViscosityRef] = useState<number>(0);

  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [productionRemarks, setProductionRemarks] = useState<string>('');

  const [actualMaterials, setActualMaterials] = useState<any[]>([]);
  const [pdDensity, setPdDensity] = useState<number>(0);
  const [pdWaterPercentage, setPdWaterPercentage] = useState<number>(0); // Water % from product development

  // Extra Materials State
  const [extraMaterials, setExtraMaterials] = useState<any[]>([]);
  const [selectedExtraMaterialId, setSelectedExtraMaterialId] = useState<number | null>(null);
  const [extraMaterialQty, setExtraMaterialQty] = useState<string>('');

  // Reduced Materials State
  const [reducedMaterials, setReducedMaterials] = useState<any[]>([]);
  const [selectedReduceMaterialId, setSelectedReduceMaterialId] = useState<number | null>(null);
  const [reduceMaterialQty, setReduceMaterialQty] = useState<string>('');

  // Dynamic running totals for formulation balance
  const totalReducedQuantity = useMemo(() => {
    return reducedMaterials.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
  }, [reducedMaterials]);

  const totalAddedQuantity = useMemo(() => {
    return extraMaterials.reduce((sum, e) => sum + (parseFloat(e.quantity) || 0), 0);
  }, [extraMaterials]);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  // Calculate Total Output Weight
  const totalOutputWeight = useMemo(() => {
    return availableSkus.reduce((sum, sku) => {
      const qty = skuOutput[sku.productId] || 0;

      const capacityLtr = parseFloat(sku.packagingCapacityLtr || '0');
      if (capacityLtr > 0) {
        const fillingDensity = parseFloat(sku.fillingDensity || '0');
        const density =
          fillingDensity > 0
            ? fillingDensity
            : actualDensity && actualDensity > 0
              ? actualDensity
              : 1;
        return sum + qty * capacityLtr * density;
      }

      const pkgWeight = parseFloat(sku.packageCapacityKg || '0');
      return sum + qty * pkgWeight;
    }, 0);
  }, [availableSkus, skuOutput, actualDensity]);

  // Auto-set actual quantity to total output weight when completing batch
  useEffect(() => {
    if (isCompletingBatch && totalOutputWeight > 0) {
      setActualQuantity(Number(totalOutputWeight.toFixed(6)));
    }
  }, [totalOutputWeight, isCompletingBatch]);

  // Fetch Product Development Density and Water % when Master Product changes
  useEffect(() => {
    if (!masterProductId) {
      setPdDensity(0);
      setPdWaterPercentage(0);
      return;
    }

    const fetchPdData = async () => {
      try {
        const devRes = await productDevelopmentApi.getByMasterProductId(masterProductId);
        if (devRes && devRes.success && devRes.data) {
          // Use density from Product Development
          setPdDensity(parseFloat(devRes.data.density) || 0);
          // Use water percentage from Product Development (stored as percentageValue)
          setPdWaterPercentage(parseFloat(devRes.data.percentageValue) || 0);
        } else {
          // Fallback to Master Product FG Density
          const mp = allMasterProducts.find(p => p.masterProductId === masterProductId);
          setPdDensity(parseFloat(mp?.FGDensity) || 0);
          setPdWaterPercentage(0);
        }
      } catch (error) {
        console.warn('Failed to fetch PD data:', error);
        // Fallback
        const mp = allMasterProducts.find(p => p.masterProductId === masterProductId);
        setPdDensity(parseFloat(mp?.FGDensity) || 0);
        setPdWaterPercentage(0);
      }
    };

    fetchPdData();
  }, [masterProductId, allMasterProducts]);

  // Fetch all SKUs (Product Sub Masters) for the selected Master Product
  useEffect(() => {
    if (!masterProductId) {
      setMasterProductSkus([]);
      return;
    }

    const fetchMasterProductSkus = async () => {
      try {
        const res = await productApi.getByMasterProductId(masterProductId);
        const skus = res?.data || [];
        console.log('Fetched all SKUs for Master Product', masterProductId, ':', skus);
        setMasterProductSkus(skus);
      } catch (error) {
        console.warn('Failed to fetch SKUs for master product:', error);
        setMasterProductSkus([]);
      }
    };

    fetchMasterProductSkus();
  }, [masterProductId]);

  const calculateTotalDuration = () => {
    if (!startDate || !startTime || !endDate || !endTime) return '-';
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '-';

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

    return parts.join(' ');
  };
  const totalDuration = calculateTotalDuration();

  // BOM Materials
  const [consolidatedBOM, setConsolidatedBOM] = useState<any[]>([]);
  const [isLoadingBOM, setIsLoadingBOM] = useState(false);

  // RM Products for ID resolution
  const [rmProducts, setRmProducts] = useState<any[]>([]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Supervisors list
  // Supervisors list
  const [supervisors, setSupervisors] = useState<any[]>([]);

  // State for Batches Table
  const [scheduledBatches, setScheduledBatches] = useState<any[]>([]);

  const fetchSupervisors = async () => {
    try {
      // Fetch employees from Production department (departmentId: 1)
      const response = await employeeApi.getAll({ departmentId: 1, status: 'Active' });
      const productionEmployees = response.data || [];

      // Map to supervisor format with full name
      const supervisorList = productionEmployees.map((emp: any) => ({
        employeeId: emp.EmployeeID,
        name: `${emp.FirstName} ${emp.LastName}`,
      }));

      // Add the logged-in production manager if not already in the list
      if (user && user.EmployeeID) {
        const userInList = supervisorList.some(sup => sup.employeeId === user.EmployeeID);
        if (!userInList) {
          supervisorList.push({
            employeeId: user.EmployeeID,
            name: `${user.FirstName} ${user.LastName}`,
          });
        }
      }

      setSupervisors(supervisorList);
    } catch (error) {
      console.error('Failed to fetch supervisors:', error);
      showToast.error('Failed to load supervisors');
      setSupervisors([]);
    }
  };

  // Complete Batch Modal State
  const [completeBatchModalOpen, setCompleteBatchModalOpen] = useState(false);
  const [selectedBatchForComplete, setSelectedBatchForComplete] = useState<{
    id: number;
    batchNo: string;
  } | null>(null);

  // Batch Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedBatchForReport, setSelectedBatchForReport] = useState<{
    id: number;
    batchNo: string;
    type: 'batch-chart' | 'completion-chart';
  } | null>(null);

  // Profit Table Data
  const [profitTableData, setProfitTableData] = useState<ProductCostInfo[]>([]);

  // All SKUs for the selected Master Product (to show in right table)
  const [masterProductSkus, setMasterProductSkus] = useState<any[]>([]);

  // RM Availability Check
  const [insufficientMaterials, setInsufficientMaterials] = useState<Set<number>>(new Set());

  // Recalculate BOM quantities when planned quantity changes
  useEffect(() => {
    if (consolidatedBOM.length > 0 && plannedQuantity > 0) {
      // Calculate water and net quantities, treating water% as relative to solids:
      const netQuantityForRecipe = plannedQuantity / (1 + pdWaterPercentage / 100);
      const waterQty = plannedQuantity - netQuantityForRecipe;

      setConsolidatedBOM(prev =>
        prev.map(m => {
          if (m.isWater) {
            // Water: recalculate as the difference between total planned and net solids
            // Keep percentage as 0 so it doesn't affect total sum
            return {
              ...m,
              requiredQuantity: waterQty,
              percentage: 0, // Keep at 0 - water is extra, not part of recipe %
              waterPercent: pdWaterPercentage, // Store actual % for display
            };
          } else {
            // Other materials: distribute net solids according to their percentages
            return {
              ...m,
              requiredQuantity: (netQuantityForRecipe * Number(m.percentage)) / 100,
            };
          }
        })
      );
    }
  }, [plannedQuantity, pdWaterPercentage]);

  // Proactively check for insufficient stock whenever BOM changes
  useEffect(() => {
    const insufficient = new Set<number>();
    consolidatedBOM.forEach(m => {
      // Check if required is greater than available (with small tolerance for float precision)
      if (m.requiredQuantity > (m.availableQuantity || 0) + 0.001) {
        insufficient.add(m.materialId);
      }
    });

    // Only update if the set is different to avoid unnecessary re-renders
    setInsufficientMaterials(prev => {
      if (prev.size !== insufficient.size) return insufficient;
      for (const id of insufficient) {
        if (!prev.has(id)) return insufficient;
      }
      return prev;
    });
  }, [consolidatedBOM]);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchSupervisors(), fetchMasterProducts(), fetchRmProducts()]);
      } catch (error) {
        console.error('Error initializing data', error);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
    fetchScheduledBatches();

    // Fetch Company Info
    const fetchCompanyInfo = async () => {
      try {
        const res = await companyApi.get();
        if (res.data) {
          setCompanyInfo((res.data as any).data || res.data);
        }
      } catch (err) {
        console.error('Failed to fetch company info', err);
      }
    };
    fetchCompanyInfo();
  }, []);

  // Click outside listener for MP and RM Dropdowns
  // Click outside listener for MP and RM Dropdowns - REMOVED (Handled by SearchableSelect)
  /*
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mpDropdownRef.current && !mpDropdownRef.current.contains(event.target as Node)) {
        setIsMpDropdownOpen(false);
      }
      if (rmDropdownRef.current && !rmDropdownRef.current.contains(event.target as Node)) {
        setIsRmDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  */

  // Sync MP Search Query when Master Product ID changes - Handled by SearchableSelect
  // useEffect(() => {
  //   if (masterProductId && masterProducts.length > 0) {
  //     const selected = masterProducts.find(mp => mp.MasterProductID === masterProductId);
  //     if (selected && mpSearchQuery !== selected.MasterProductName) {
  //       setMpSearchQuery(selected.MasterProductName);
  //     }
  //   }
  // }, [masterProductId, masterProducts]);

  // Filter Master Products based on search - Handled by SearchableSelect
  // useEffect(() => {
  //   if (!mpSearchQuery) {
  //     setFilteredMasterProducts(masterProducts);
  //     return;
  //   }
  //   const query = mpSearchQuery.toLowerCase();
  //   const filtered = masterProducts.filter(mp =>
  //     mp.MasterProductName.toLowerCase().includes(query)
  //   );
  //   setFilteredMasterProducts(filtered);
  // }, [mpSearchQuery, masterProducts]);

  // Filter Raw Materials based on search - Handled by SearchableSelect
  // useEffect(() => {
  //   if (!rmSearchQuery) {
  //     setFilteredRMs([]);
  //     return;
  //   }
  //   const query = rmSearchQuery.toLowerCase();
  //   const filtered = allMasterProducts.filter(
  //     mp => mp.MasterProductName.toLowerCase().includes(query) && mp.ProductType !== 'FG' // Assume RMs are not FGs
  //   );
  //   setFilteredRMs(filtered);
  // }, [rmSearchQuery, allMasterProducts]);

  // Update weights if planned quantity changes (optional, but good UX if users change planned qty after BOM calc)
  // For now, only recalculate when they hit 'Calculate' or edit percentage manually.
  // Actually, if they change Planned Quantity, the weights SHOULD update if percentages are fixed?
  // Let's stick to simple logic: Calculate BOM resets everything based on current PlannedQty.
  // Edits to percentage update weight based on current PlannedQty.

  // Handle redirect logic... (same as before)
  useEffect(() => {
    if (location.state?.batchId) {
      const { batchId } = location.state;
      console.log('Loading batch for editing:', batchId);
      // Clean up state from previous navigations if any?
      // Actually fetchBatchDetails handles setting state.
      // We don't use hasProcessedRedirect for edit mode usually, or we should?
      // Existing code didn't use it for batchId, so leaving as is.
      fetchBatchDetails(batchId);
    } else if (!hasProcessedRedirect && location.state) {
      const { masterProductId, products, plannedQuantity: quantityFromState } = location.state;

      // 1. Set Master Product ID if present
      if (masterProductId) {
        setMasterProductId(Number(masterProductId));
      }

      // 1.5 Set Planned Quantity if passed (Production Weight from Dashboard)
      if (quantityFromState) {
        setPlannedQuantity(Number(quantityFromState));
      }

      // 2. Handle Products directly from Dashboard (Aggregated View)
      if (products && Array.isArray(products)) {
        const fetchProductDetails = async () => {
          try {
            setIsLoading(true);
            const enrichedProducts = await Promise.all(
              products.map(async (p: any) => {
                try {
                  const res = await productApi.getById(p.productId);
                  const details = res?.data;
                  console.log('Fetched Product Details for ID', p.productId, ':', details);
                  // Cast to any to handle flexible DTO properties
                  const d = details as any;
                  return {
                    orderId: 0,
                    orderNumber: 'AGGREGATED',
                    productId: p.productId,
                    productName: p.productName,
                    quantity: p.productionQty,
                    customerId: 0,
                    customerName: 'Internal',
                    requiredWeightKg: p.productionWeight,
                    packageCapacityKg:
                      d?.packageCapacityKg || d?.PackageCapacityKg || p.packageCapacityKg || 0,
                    sellingPrice: d?.sellingPrice || d?.SellingPrice || 0,
                    packagingId: d?.packagingId || d?.PackagingID || 0,
                    masterProductId: d?.masterProductID || d?.MasterProductID || 0,
                    packagingCapacityLtr:
                      d?.CapacityLtr || d?.packagingCapacityLtr || d?.packageQuantity || 0, // Try all aliases
                    fillingDensity: d?.fillingDensity || d?.FillingDensity || 0, // Filling density for weight calculation
                  };
                } catch (e) {
                  console.warn(`Failed to fetch details for product ${p.productId}`, e);
                  return {
                    orderId: 0,
                    orderNumber: 'AGGREGATED',
                    productId: p.productId,
                    productName: p.productName,
                    quantity: p.productionQty,
                    customerId: 0,
                    customerName: 'Internal',
                    requiredWeightKg: p.productionWeight,
                    packageCapacityKg: p.packageCapacityKg || 0,
                    sellingPrice: 0,
                    packagingId: 0,
                    masterProductId: 0,
                  };
                }
              })
            );

            setSelectedProducts(enrichedProducts);
          } catch (err) {
            console.error('Error enriching products', err);
            setSelectedProducts(
              products.map((p: any) => ({
                orderId: 0,
                orderNumber: 'AGGREGATED',
                productId: p.productId,
                productName: p.productName,
                quantity: p.productionQty,
                customerId: 0,
                customerName: 'Internal',
                requiredWeightKg: p.productionWeight,
                packageCapacityKg: p.packageCapacityKg || 0,
                sellingPrice: 0,
                packagingId: 0,
                masterProductId: 0, // Fallback
              }))
            );
          } finally {
            setHasProcessedRedirect(true);
            setIsLoading(false);
          }
        };

        fetchProductDetails();
      } else {
        setHasProcessedRedirect(true);
      }
    }
  }, [location.state, hasProcessedRedirect]);

  const fetchScheduledBatches = async () => {
    try {
      const data = await productionManagerApi.getAllBatches();
      setScheduledBatches(data || []);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    }
  };

  const fetchMasterProducts = async () => {
    try {
      // 1. Fetch RAW LIST of ALL master products (RM, PM, FG) to enable looking up PM costs and RM stocks
      const allRes = await masterProductApi.getAll();
      const allProducts = allRes.data || [];
      setAllMasterProducts(allProducts);

      // 2. Filter FG for the dropdown
      const fgProducts = allProducts.filter((p: any) => p.productType === 'FG');
      setMasterProducts(fgProducts);
    } catch (error) {
      console.error('Failed to fetch master products:', error);
      showToast.error('Failed to load master products');
    }
  };

  // Fetch RM Inventory Products for ID resolution
  const fetchRmProducts = async () => {
    try {
      const res = await productApi.getAll();
      const rms = (res.data || []).filter(
        (p: any) => p.ProductType === 'RM' || p.productType === 'RM'
      );
      setRmProducts(rms);
    } catch (error) {
      console.error('Failed to fetch RM products:', error);
    }
  };

  // DnD Drag End Handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setConsolidatedBOM(items => {
      const oldIndex = items.findIndex(item => `bom-${item.materialId}` === active.id);
      const newIndex = items.findIndex(item => `bom-${item.materialId}` === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      // Update sequence numbers
      return newItems.map((item, idx) => ({
        ...item,
        sequence: idx + 1,
      }));
    });
  };

  const fetchBatchDetails = async (batchId: number) => {
    // ... (same implementation)
    // For brevity, keeping it simple or reusing standard logic.
    try {
      setIsLoading(true);
      const data = await productionManagerApi.getBatchDetails(batchId);
      const batch = data.batch;
      setScheduledDate(batch.scheduledDate.split('T')[0]);
      setPlannedQuantity(batch.plannedQuantity);
      setSupervisorId(batch.supervisorId);
      setMasterProductId(batch.masterProductId);

      if (batch.pmRemarks && batch.pmRemarks.includes('| Labor: ')) {
        const parts = batch.pmRemarks.split('| Labor: ');
        setPmRemarks(parts[0].trim());
        setLaborName(parts[1].trim());
      } else {
        setPmRemarks(batch.pmRemarks || '');
      }
      showToast.success(`Loaded batch #${batch.batchNo}`);
    } catch (error) {
      console.error('Failed to load batch details', error);
      showToast.error('Failed to load batch details');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-calculate Profit Table whenever selectedProducts, masterProductId or masterProductSkus changes
  useEffect(() => {
    if (!masterProductId) {
      setProfitTableData([]);
      return;
    }

    // Find the FG Master Product to get Per Kg Cost (PurchaseCost/ProductionCost)
    const fgMaster = allMasterProducts.find(p => p.masterProductId === masterProductId);
    // DTO uses PurchaseCost (PascalCase) for FG
    // User requested to use ProductionCost instead
    const perKgCost = parseFloat(fgMaster?.ProductionCost) || 0;

    // Create a map of selected products by productId for quick lookup
    const selectedProductMap = new Map<number, any>();
    selectedProducts.forEach(prod => {
      const p = prod as any;
      selectedProductMap.set(p.productId, p);
    });

    // Use all SKUs from masterProductSkus, or fallback to selectedProducts if no SKUs fetched yet
    const allSkus = masterProductSkus.length > 0 ? masterProductSkus : selectedProducts;

    const tableData = allSkus.map((sku: any) => {
      // Check if this SKU has an order (is in selectedProducts)
      const selectedProduct = selectedProductMap.get(sku.productId || sku.ProductID);

      // Merge data: Use selected product data if available, otherwise use SKU data
      const p = selectedProduct || sku;
      const productionQty = selectedProduct?.quantity || 0;

      let packingCost = 0;
      let packagingName = '';

      // Get packagingId from either source
      const packagingId = p.packagingId || p.PackagingID || sku.packagingId || sku.PackagingID;

      const pmMaster = packagingId
        ? allMasterProducts.find(mp => mp.masterProductId === packagingId)
        : null;

      if (pmMaster) {
        // PM fields in DTO are now PascalCase
        packingCost = parseFloat(pmMaster.PurchaseCost) || 0;
        packagingName = pmMaster.masterProductName;
      }

      const unitSellingRate = parseFloat(p.sellingPrice || p.SellingPrice) || 0;

      // 1. Get PM Capacity (Volume in Liters) from Master Product
      // This maps to 'capacity' in master_product_pm table
      let pmCapacityVal = p.packagingCapacityLtr || sku.CapacityLtr || 0;

      if (pmCapacityVal === 0 && pmMaster && pmMaster.Capacity) {
        // Fallback to PM Master Capacity if not set on Product
        pmCapacityVal = parseFloat(pmMaster.Capacity.toString());
      }

      // 2. Get Filling Density from Product Sub Master
      const fillingDensity =
        parseFloat(p.fillingDensity || sku.fillingDensity || sku.FillingDensity) || 0;

      // 3. Calculate Pack Qty/Weight (kg) = PM Capacity (L) × Filling Density
      // This is the weight per unit package for this SKU
      const packQtyValue = pmCapacityVal * fillingDensity;
      const packQty = packQtyValue.toFixed(2);

      return {
        productId: sku.productId || sku.ProductID,
        productName: sku.productName || sku.ProductName,
        pmCapacity: parseFloat(pmCapacityVal.toFixed(2)), // Capacity in Liters
        packQty: packQty, // Pack Weight (capacity × filling density)
        fillingDensity: fillingDensity, // Filling density
        productionQty: productionQty, // Production Qty (0 if no order)
        perKgCost: perKgCost,
        packingCost: packingCost,
        unitSellingRate: unitSellingRate,
        perLtrCost: 0,
        productionCost: 0,
        grossProfit: 0,
        packagingName,
      };
    });

    setProfitTableData(tableData);
  }, [selectedProducts, masterProductId, allMasterProducts, pdDensity, masterProductSkus]);

  const removeProduct = (index: number) => {
    setSelectedProducts(prev => {
      const updated = prev.filter((_, i) => i !== index);
      const totalQty = updated.reduce((sum, p) => sum + p.quantity, 0);
      setPlannedQuantity(totalQty);
      return updated;
    });
  };

  // BOM MANIPULATION FUNCTIONS

  const updatePercentage = (materialId: number, newPercentage: string | number) => {
    // Sanitize string input
    let sanitizedValue = newPercentage;
    if (typeof sanitizedValue === 'string') {
      if (
        sanitizedValue.length > 1 &&
        sanitizedValue.startsWith('0') &&
        sanitizedValue[1] !== '.'
      ) {
        sanitizedValue = sanitizedValue.substring(1);
      }
    }

    // Calculate numeric value for math (allow empty string as 0)
    const numericValue = Number(sanitizedValue) || 0;

    // Optional: Validation if strict positive is needed, but we allow typing 0
    if (numericValue < 0) return;

    setConsolidatedBOM(prev =>
      prev.map(item => {
        if (item.materialId === materialId) {
          return {
            ...item,
            percentage: sanitizedValue,
            requiredQuantity: (plannedQuantity * numericValue) / 100,
          };
        }
        return item;
      })
    );
  };

  const removeMaterial = (materialId: number) => {
    setConsolidatedBOM(prev => prev.filter(item => item.materialId !== materialId));
  };

  const addRawMaterial = (mp: any) => {
    // Check if already exists (handle both camelCase and PascalCase)
    const mpId = mp.masterProductId || mp.MasterProductID;
    if (consolidatedBOM.some(item => item.materialId === mpId)) {
      showToast.error('Material already added');
      return;
    }

    const materialName = mp.masterProductName || mp.MasterProductName;
    // Check if water - if so, it's NOT additional (treated as RM)
    const isWater = materialName.toLowerCase().includes('water');

    const newMaterial = {
      materialId: mpId,
      materialName: materialName,
      requiredQuantity: 0, // Default 0 until percentage set
      availableQuantity: 0,
      percentage: '',
      unit: 'KG',
      sequence: consolidatedBOM.length + 1,
      waitingTime: 0,
      isAdditional: !isWater, // Water is not additional for manual add
      isWater: isWater,
    };

    setConsolidatedBOM(prev => [...prev, newMaterial]);
    showToast.success('Material added');
  };

  const calculateBOM = async () => {
    if (!masterProductId) {
      showToast.error('Please select a Master Product first');
      return;
    }

    if (!plannedQuantity || plannedQuantity <= 0) {
      showToast.error('Please enter a valid Planned Quantity');
      return;
    }

    try {
      setIsLoadingBOM(true);
      setConsolidatedBOM([]);

      // 1. Try to get Latest Recipe from Product Development
      let devRecipeFound = false;
      let waterPercentageFromDev = 0;

      try {
        const devRes = await productDevelopmentApi.getByMasterProductId(masterProductId);
        if (devRes && devRes.success && devRes.data && devRes.data.materials?.length > 0) {
          // Get water percentage from product development (stored as percentageValue)
          // Use already-fetched state or parse from API response
          const waterPctFromApi = parseFloat(devRes.data.percentageValue) || 0;
          waterPercentageFromDev = waterPctFromApi;

          // Update state if it differs (for consistency)
          if (waterPctFromApi !== pdWaterPercentage) {
            setPdWaterPercentage(waterPctFromApi);
          }

          // Calculate net quantity considering water % is relative to solids (water = solids * water%)
          const netQuantityForRecipe = plannedQuantity / (1 + waterPercentageFromDev / 100);
          const waterQty = plannedQuantity - netQuantityForRecipe;

          const mappedBOM = devRes.data.materials
            .map((item: any) => {
              const rmInfo = allMasterProducts.find(p => p.masterProductId === item.materialId);
              const percentage = Number(item.percentage);
              // Calculate required weight based on NET quantity (after subtracting water)
              const requiredWeight = (netQuantityForRecipe * percentage) / 100;
              // RM uses AvailableQuantity (PascalCase from DTO)
              const stockQty = parseFloat(
                rmInfo?.AvailableQuantity || rmInfo?.availableQuantity || 0
              );

              return {
                materialId: item.materialId,
                materialName: rmInfo?.masterProductName || `Unknown (${item.materialId})`,
                requiredQuantity: requiredWeight,
                availableQuantity: stockQty, // Populate stock
                percentage: percentage,
                unit: 'KG',
                sequence: item.sequence || 0,
                waitingTime: item.waitingTime || 0,
                isAdditional: false, // Standard ingredients are not additional
              };
            })
            .sort((a: any, b: any) => a.sequence - b.sequence);

          // Auto-add water if water percentage > 0
          if (waterPercentageFromDev > 0) {
            // Find water material in allMasterProducts (look for "DM Water" or "Water")
            const waterMaterial = allMasterProducts.find(
              p =>
                p.productType === 'RM' &&
                (p.masterProductName?.toLowerCase().includes('water') ||
                  p.masterProductName === 'DM Water')
            );

            if (waterMaterial) {
              const waterStockQty = parseFloat(
                waterMaterial.AvailableQuantity || waterMaterial.availableQuantity || 0
              );

              // Add water as the last item - with percentage 0 so it doesn't add to recipe total
              // Water is extra material added on top of 100% recipe
              mappedBOM.push({
                materialId: waterMaterial.masterProductId,
                materialName: waterMaterial.masterProductName,
                requiredQuantity: waterQty,
                availableQuantity: waterStockQty,
                percentage: 0, // Don't add to percentage total - water is extra
                unit: 'KG',
                sequence: mappedBOM.length + 1,
                waitingTime: 0,
                isAdditional: true, // Mark as auto-added water
                isWater: true, // Special flag for water
                waterPercent: waterPercentageFromDev, // Store actual water % for display only
              });

              showToast.success(
                `Loaded Recipe (${mappedBOM.length - 1} items) + Water ${waterQty.toFixed(2)} kg`
              );
            } else {
              console.warn('Water material not found in master products');
              showToast.success(`Loaded Development Recipe (${mappedBOM.length} items)`);
            }
          } else {
            showToast.success(`Loaded Development Recipe (${mappedBOM.length} items)`);
          }

          setConsolidatedBOM(mappedBOM);
          devRecipeFound = true;
        }
      } catch (e) {
        console.warn('No development recipe found or error:', e);
      }

      if (devRecipeFound) {
        if (selectedProducts.length > 0) await calculateDistributions();
        return;
      }

      // 2. Fallback to standard BOM
      const response = await bomApi.calculateRequirements(masterProductId, plannedQuantity);

      if (!response || response.length === 0) {
        showToast.error('No recipe found for this Master Product');
        setConsolidatedBOM([]);
      } else {
        const mappedBOM = response.map((item: any) => {
          const rmInfo = allMasterProducts.find(p => p.masterProductId === item.RawMaterialID);
          // RM uses AvailableQuantity (PascalCase from DTO)
          const stockQty =
            parseFloat(rmInfo?.AvailableQuantity || rmInfo?.availableQuantity) ||
            item.AvailableQty ||
            0;

          return {
            materialId: item.RawMaterialID,
            materialName: item.RawMaterialName,
            requiredQuantity: item.RequiredQty,
            availableQuantity: stockQty,
            percentage: (item.RequiredQty / plannedQuantity) * 100,
            unit: item.Unit,
            sequence: item.Sequence || 0,
            waitingTime: 0,
            isAdditional: false, // Standard BOM items are never additional by default
          };
        });

        setConsolidatedBOM(mappedBOM);
        showToast.success(`BOM calculated - ${mappedBOM.length} materials found`);
      }

      if (selectedProducts.length > 0) {
        await calculateDistributions();
      }
    } catch (error: any) {
      console.error('Failed to calculate BOM:', error);
      showToast.error(error?.message || 'Failed to calculate BOM');
      setConsolidatedBOM([]);
      setConsolidatedBOM(prev => {
        // Run availability check
        const insufficient = new Set<number>();
        prev.forEach(item => {
          if (item.requiredQuantity > item.availableQuantity) {
            insufficient.add(item.materialId);
          }
        });
        setInsufficientMaterials(insufficient);
        if (insufficient.size > 0) {
          showToast.error(`Insufficient stock for ${insufficient.size} material(s)!`);
        }
        return prev;
      });
    } finally {
      setIsLoadingBOM(false);
    }
  };

  const calculateDistributions = async () => {
    try {
      const distList: DistributionInfo[] = [];
      for (const product of selectedProducts) {
        const requiredWeightKg =
          product.requiredWeightKg || product.quantity * (product.packageCapacityKg || 0);
        const packageCapacityKg = product.packageCapacityKg || 0;
        const plannedPackages = Math.ceil(requiredWeightKg / (packageCapacityKg || 1));
        const totalDistributionWeight = plannedPackages * packageCapacityKg;

        distList.push({
          orderId: product.orderId,
          productId: product.productId,
          productName: product.productName,
          requiredWeightKg,
          packageCapacityKg,
          plannedPackages,
          totalDistributionWeight,
        });
      }
      setDistributions(distList);
    } catch (error: any) {
      console.error('Failed to calculate distributions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: Require products only if we don't have a manual planned quantity and master product
    // Actually, for Make to Stock, we might not have selectedProducts.
    // So we should just check if we have either selected products OR (masterProductId and plannedQuantity)
    if (selectedProducts.length === 0 && (!masterProductId || !plannedQuantity)) {
      showToast.error('Please select orders OR specify Master Product and Quantity');
      return;
    }
    if (!supervisorId) {
      showToast.error('Please select a supervisor');
      return;
    }
    if (!masterProductId) {
      showToast.error('Please select a master product');
      return;
    }
    if (consolidatedBOM.length === 0) {
      showToast.error('Please calculate BOM before scheduling');
      return;
    }

    // Strict Stock Check Block
    if (insufficientMaterials.size > 0) {
      showToast.error('Cannot schedule: Insufficient Raw Materials!');
      return;
    }

    // Validate Total Percentage (optional but recommended)
    const totalPercent = consolidatedBOM.reduce((sum, m) => sum + Number(m.percentage), 0);
    if (Math.abs(totalPercent - 100) > 0.5) {
      // Allow small float margin - show warning and allow user to proceed
      showToast.warning(
        `Total percentage is ${totalPercent.toFixed(2)}% (not 100%). Please review the BOM before proceeding.`
      );
      // Allow them to proceed anyway
      return; // Halt for confirmation (or proceed if they confirm, but better to force user to fix?)
      // User asked "new formulation should not reflect in original receipe...".
      // Let's just warn but allow submission via the toast button or just warn?
      // For now, I'll block. Actually, let's just proceed with submitBatch if validation passes or maybe just let it be?
      // User didn't ask for validation.
    }

    submitBatch();
  };

  const submitBatch = async () => {
    try {
      setIsSubmitting(true);

      const finalRemarks = laborName ? `${pmRemarks} | Labor: ${laborName}` : pmRemarks;

      // Filter valid orders first
      const validOrders = selectedProducts
        .filter(p => Number(p.quantity) > 0)
        .map(p => ({
          orderId: Number(p.orderId),
          productId: Number(p.productId),
          quantity: Number(p.quantity),
        }));

      // Validate we have at least one valid order - REMOVED for MTS support
      /*
      if (validOrders.length === 0) {
        showToast.error(
          'No valid products to schedule. Please add products with quantity greater than 0.'
        );
        setIsSubmitting(false);
        return;
      }
      */

      const batchData = {
        masterProductId: masterProductId,
        scheduledDate,
        plannedQuantity: Number(plannedQuantity), // Allow decimals
        density: pdDensity || 0, // Use fetched/calculated density
        viscosity: plannedViscosityRef || 0, // Use fetched/calculated viscosity
        waterPercentage: pdWaterPercentage || 0, // Use fetched water percentage
        supervisorId: Number(supervisorId),
        labourNames: laborName,
        orders: validOrders,
        materials: consolidatedBOM.map((m, idx) => ({
          materialId: Number(m.materialId),
          requiredQuantity: Number(m.requiredQuantity), // Allow decimals
          requiredUsePer: Number(m.percentage),
          requiredUseQty: Number(m.requiredQuantity),
          sequence: idx + 1,
          waitingTime: Number(m.waitingTime),
          isAdditional: m.isAdditional || false,
        })),
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        pmRemarks: finalRemarks || undefined,
      };

      await productionManagerApi.scheduleBatch(batchData);

      // Reset Form State
      setMasterProductId(0);
      setSelectedProducts([]);
      setPlannedQuantity(0);
      setSupervisorId(0);
      setLaborName('');
      setPmRemarks('');
      setExpectedDeliveryDate('');
      setScheduledDate(new Date().toISOString().split('T')[0]);
      setConsolidatedBOM([]);
      setDistributions([]);
      setInsufficientMaterials(new Set());

      // Reset completion/extra materials tracking state
      setExtraMaterials([]);
      setSelectedExtraMaterialId(null);
      setExtraMaterialQty('');
      setActualMaterials([]);

      // Refresh the batches table to show the newly created batch
      await fetchScheduledBatches();

      // Optionally scroll to the table
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (error: any) {
      console.error('Failed to schedule batch:', error);
      console.error('Error response:', error?.response);
      console.error('Error data:', error?.response?.data);

      const errorData = error?.response?.data;
      const errorMessage = errorData?.message || error?.message || 'Failed to schedule batch';

      // Check if it's an insufficient stock error with structured data
      if (
        errorData?.data?.type === 'INSUFFICIENT_STOCK' &&
        errorData?.data?.insufficientMaterials
      ) {
        const insufficientList = errorData.data.insufficientMaterials;

        // Store material IDs for highlighting in BOM table (using existing Set state)
        setInsufficientMaterials(new Set(insufficientList.map((m: any) => m.materialId)));

        // Show simple toast with count
        showToast.error(
          `Cannot start batch: ${insufficientList.length} material(s) have insufficient stock. Check highlighted rows above.`
        );

        // Scroll to BOM table so user can see highlighted rows
        const bomSection = document.getElementById('bom-requirements-section');
        if (bomSection) {
          bomSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        showToast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBatch = (batchId: number) => {
    navigate('.', { state: { batchId } });
    window.scrollTo(0, 0);
  };

  const handleCancelBatch = async (batchId: number) => {
    if (!window.confirm('Are you sure you want to cancel this batch?')) return;
    try {
      await productionManagerApi.cancelBatch(batchId, 'User cancelled');
      showToast.success('Batch cancelled');
      fetchScheduledBatches();
    } catch (error) {
      showToast.error('Failed to cancel batch');
    }
  };

  // --- INLINE COMPLETION HANDLERS ---

  const handleInitCompletion = async (
    batchId: number,
    batchNo: string,
    masterProductName: string
  ) => {
    // Clear previous temporary tracking state
    setExtraMaterials([]);
    setSelectedExtraMaterialId(null);
    setExtraMaterialQty('');
    setReducedMaterials([]);
    setSelectedReduceMaterialId(null);
    setReduceMaterialQty('');
    setActualMaterials([]);

    setCompletingBatchId(batchId);
    setCompletingBatchNo(batchNo);
    setCompletingMasterProductName(masterProductName); // Set immediately from table data
    setIsCompletingBatch(true);
    setIsLoading(true);

    try {
      const data = await productionManagerApi.getBatchDetails(batchId);

      // We already set this from table, but can update if needed or keep as fallback
      // const mpName = data.batch?.masterProduct?.masterProductName || '';
      // setCompletingMasterProductName(mpName);

      // Pre-fill form & References
      const pQty = parseFloat(data.batch?.plannedQuantity) || 0;
      // Get calculated values from the master product FG data (these are the "standard" values)
      const calculatedDensity = parseFloat(data.batch?.fgDensity) || 0;
      const calculatedWater = parseFloat(data.batch?.waterPercentage) || 0;
      const calculatedViscosity = parseFloat(data.batch?.viscosity) || 0;

      // Auto-fill actual values with calculated/planned values by default - CHANGED: Set to '' as per user request to force manual entry
      setActualQuantity('');
      setActualDensity('');
      setActualViscosity('');

      // Set planned/reference values from the recipe (fetched from master_product_fg via DB join)
      setPlannedDensityRef(calculatedDensity);
      setPlannedWaterPercentageRef(calculatedWater);
      setPlannedViscosityRef(calculatedViscosity);
      setPlannedQuantityRef(pQty);

      setPlannedQuantityRef(data.batch.plannedQuantity || 0);

      // Set available SKUs for output AND enrich with planned quantities from linked orders
      const allSkus = data.relatedSkus || [];
      const linkedOrders = data.orders || [];

      const enrichedSkus = allSkus.map((sku: any) => {
        // Find if this SKU was planned in any of the orders/batchProducts
        // The structure of linkedOrders is { batchProduct: {...}, ... }
        let plannedUnits = 0;

        linkedOrders.forEach((o: any) => {
          if (o.batchProduct?.productId === sku.productId) {
            plannedUnits += o.batchProduct.plannedUnits || 0;
          }
        });

        return {
          ...sku,
          plannedUnits,
        };
      });

      setAvailableSkus(enrichedSkus);
      setSkuOutput({}); // Reset output input

      // Set masterProductId to trigger fetching of all SKUs for the right table
      const batchMasterProductId = data.batch?.masterProductId || 0;
      setMasterProductId(batchMasterProductId);

      // Create selectedProducts from enriched SKUs for the right table
      // This allows the profit table to show SKUs with their planned quantities
      const productsForRightTable = enrichedSkus
        .filter((sku: any) => sku.plannedUnits > 0) // Only SKUs with orders
        .map((sku: any) => ({
          orderId: 0,
          orderNumber: 'BATCH',
          productId: sku.productId,
          productName: sku.productName,
          quantity: sku.plannedUnits || 0, // Production qty = planned units
          customerId: 0,
          customerName: 'Batch Production',
          packageCapacityKg: sku.packageCapacityKg || 0,
          packagingId: sku.packagingId || 0,
          masterProductId: batchMasterProductId,
          fillingDensity: sku.fillingDensity || 0,
        }));
      setSelectedProducts(productsForRightTable);

      // Determine Start Time: Use batch creation time if available, otherwise fallback to scheduled date or now
      // The user wants "timer start when start batch btn pressed", so creation time is the best proxy.
      const creationTime = data.batch?.createdAt ? new Date(data.batch.createdAt) : new Date();
      const stDate = creationTime.toISOString().split('T')[0];
      const stTime = creationTime.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

      setStartDate(stDate);
      setStartTime(stTime);

      // End Time: NOW
      const now = new Date();
      const edDate = now.toISOString().split('T')[0];
      const edTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

      setEndDate(edDate);
      setEndTime(edTime);

      const mappedMaterials = (data.materials || []).map((m: any) => ({
        batchMaterialId: m.batchMaterial?.batchMaterialId,
        materialId: m.batchMaterial?.materialId,
        materialName: m.masterProduct?.masterProductName || m.material?.productName || 'Unknown',
        plannedQuantity: parseFloat(m.batchMaterial?.requiredQuantity) || 0,
        actualQuantity: parseFloat(m.batchMaterial?.requiredQuantity) || 0,
        variance: 0,
      }));
      setActualMaterials(mappedMaterials);
    } catch (error) {
      console.error('Failed to init completion:', error);
      showToast.error('Failed to load batch data');
      setIsCompletingBatch(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Get available stock for a material
  const getAvailableStock = (materialId: number) => {
    const mp = allMasterProducts.find(p => p.masterProductId === materialId);
    return parseFloat(mp?.AvailableQuantity || mp?.availableQuantity || 0);
  };

  // Handler to add extra raw material
  const handleAddExtraMaterial = () => {
    if (!selectedExtraMaterialId) {
      showToast.error('Please select a raw material');
      return;
    }
    const qtyValue = parseFloat(extraMaterialQty);
    if (!extraMaterialQty || isNaN(qtyValue) || qtyValue <= 0) {
      showToast.error('Please enter a valid quantity');
      return;
    }

    // Find the material details first to check CanBeAddedMultipleTimes
    const material = allMasterProducts.find(m => m.masterProductId === selectedExtraMaterialId);
    if (!material) {
      showToast.error('Material not found');
      return;
    }

    const canAddMultiple =
      material.CanBeAddedMultipleTimes || material.canBeAddedMultipleTimes || false;

    const availableQty = getAvailableStock(selectedExtraMaterialId);
    if (qtyValue > availableQty) {
      showToast.warning(`Insufficient stock! Available: ${formatQty(availableQty)} kg`);
    }

    // Check if the material has active reductions. If so, reduce the reduction balance first.
    const matReductions = reducedMaterials.filter(r => r.materialId === selectedExtraMaterialId);
    const totalReducedForMat = matReductions.reduce(
      (sum, r) => sum + (parseFloat(r.quantity) || 0),
      0
    );

    if (totalReducedForMat > 0) {
      if (qtyValue <= totalReducedForMat) {
        // Fully absorbed by the active reduction. We subtract from the reductions.
        let remainingToSubtract = qtyValue;
        const newReduced = reducedMaterials
          .map(r => {
            if (r.materialId === selectedExtraMaterialId && remainingToSubtract > 0) {
              const sub = Math.min(parseFloat(r.quantity) || 0, remainingToSubtract);
              remainingToSubtract -= sub;
              return { ...r, quantity: (parseFloat(r.quantity) || 0) - sub };
            }
            return r;
          })
          .filter(r => r.quantity > 0.0001);

        setReducedMaterials(newReduced);
        setSelectedExtraMaterialId(null);
        setExtraMaterialQty('');
        showToast.success(
          `Added back ${formatQty(qtyValue)} kg to ${material.masterProductName} (reduction balance decreased)`
        );
      } else {
        // Partially absorbed, remainder is treated as extra
        const extraQty = qtyValue - totalReducedForMat;

        // Apply changes: clear all reductions for this material
        const filteredReduced = reducedMaterials.filter(
          r => r.materialId !== selectedExtraMaterialId
        );
        setReducedMaterials(filteredReduced);

        // Add the remainder to extraMaterials
        const alreadyAddedInExtra = extraMaterials.some(
          m => m.materialId === selectedExtraMaterialId
        );
        if (alreadyAddedInExtra && !canAddMultiple) {
          showToast.error('This material is already added');
          return;
        }

        const isWater = material.masterProductName.toLowerCase().includes('water');
        const newExtraMaterial = {
          materialId: selectedExtraMaterialId,
          materialName: material.masterProductName,
          quantity: extraQty,
          isExtra: !isWater,
          canAddMultiple,
        };

        setExtraMaterials(prev => [...prev, newExtraMaterial]);
        setSelectedExtraMaterialId(null);
        setExtraMaterialQty('');
        showToast.success(
          `Restored original quantity of ${material.masterProductName} and added ${formatQty(extraQty)} kg as extra`
        );
        return;
      }
    } else {
      // Normal Add: No active reductions for this material.
      // Check if already added in extra materials (only block if can't add multiple)
      const alreadyAddedInExtra = extraMaterials.some(
        m => m.materialId === selectedExtraMaterialId
      );
      if (alreadyAddedInExtra && !canAddMultiple) {
        showToast.error('This material is already added');
        return;
      }

      const isWater = material.masterProductName.toLowerCase().includes('water');
      const newExtraMaterial = {
        materialId: selectedExtraMaterialId,
        materialName: material.masterProductName,
        quantity: qtyValue,
        isExtra: !isWater, // Water is not extra for manual add
        canAddMultiple,
      };

      setExtraMaterials(prev => [...prev, newExtraMaterial]);
      setSelectedExtraMaterialId(null);
      setExtraMaterialQty('');
      showToast.success('Extra material added');
    }
  };

  // Handler to remove extra material
  const handleRemoveExtraMaterial = (index: number) => {
    setExtraMaterials(prev => prev.filter((_, i) => i !== index));
  };

  // Handler to reduce raw material quantity
  const handleReduceMaterial = () => {
    if (!selectedReduceMaterialId) {
      showToast.error('Please select a raw material to reduce');
      return;
    }
    const qtyValue = parseFloat(reduceMaterialQty);
    if (!reduceMaterialQty || isNaN(qtyValue) || qtyValue <= 0) {
      showToast.error('Please enter a valid quantity');
      return;
    }

    const mat = actualMaterials.find(m => m.materialId === selectedReduceMaterialId);
    if (!mat) {
      showToast.error('Material not found in batch recipe');
      return;
    }

    const existingReduction = reducedMaterials
      .filter(r => r.materialId === selectedReduceMaterialId)
      .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);

    if (existingReduction + qtyValue >= mat.plannedQuantity) {
      showToast.error(`Cannot reduce to zero or less. Final quantity must be greater than 0 kg.`);
      return;
    }

    const newReduction = {
      materialId: selectedReduceMaterialId,
      materialName: mat.materialName,
      quantity: qtyValue,
    };

    setReducedMaterials(prev => [...prev, newReduction]);
    setSelectedReduceMaterialId(null);
    setReduceMaterialQty('');
    showToast.success('Material quantity reduced');
  };

  // Handler to remove a reduction
  const handleRemoveReduction = (index: number) => {
    setReducedMaterials(prev => prev.filter((_, i) => i !== index));
    showToast.success('Reduction removed');
  };

  const handleCompleteSubmit = async () => {
    if (isSubmitting || !completingBatchId) return;

    if (actualQuantity === '' || !actualQuantity || Number(actualQuantity) <= 0) {
      showToast.error('Please enter actual quantity produced');
      return;
    }

    if (
      actualDensity === '' ||
      actualDensity === undefined ||
      actualDensity === null ||
      Number(actualDensity) <= 0
    ) {
      showToast.error('Please enter actual density');
      return;
    }

    if (
      actualViscosity === '' ||
      actualViscosity === undefined ||
      actualViscosity === null ||
      Number(actualViscosity) < 0
    ) {
      showToast.error('Please enter actual viscosity');
      return;
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      showToast.error('Please enter start and end date/time');
      return;
    }

    // Validate Finished Goods Output
    const hasOutput = Object.values(skuOutput).some(qty => qty > 0);
    if (!hasOutput) {
      showToast.error('Please enter at least one SKU quantity in Finished Goods Output');
      return;
    }

    // Calculate total output weight
    const totalOutputWeight = availableSkus.reduce((sum, sku) => {
      const qty = skuOutput[sku.productId] || 0;

      const capacityLtr = parseFloat(sku.packagingCapacityLtr || '0');
      if (capacityLtr > 0) {
        const density =
          actualDensity && actualDensity > 0
            ? actualDensity
            : parseFloat(sku.fillingDensity || '1');
        return sum + qty * capacityLtr * density;
      }

      const pkgWeight = parseFloat(sku.packageCapacityKg || '0');
      return sum + qty * pkgWeight;
    }, 0);

    const actualWeight = actualQuantity;
    const tolerance = actualWeight * 0.05; // 5% tolerance
    const minWeight = actualWeight - tolerance;
    const maxWeight = actualWeight + tolerance;

    // if (totalOutputWeight < minWeight || totalOutputWeight > maxWeight) {
    //   showToast.error(
    //     `Total output weight (${totalOutputWeight.toFixed(2)} kg) must be within ±5% of actual batch weight (${actualWeight.toFixed(2)} kg). Allowed range: ${minWeight.toFixed(2)} - ${maxWeight.toFixed(2)} kg`
    //   );
    //   return;
    // }

    // Validate extra materials stock
    for (const mat of extraMaterials) {
      const available = getAvailableStock(mat.materialId);
      if (mat.quantity > available) {
        showToast.error(
          `Insufficient stock for extra material: ${mat.materialName} (Available: ${formatQty(available)} kg)`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Build outputSkus and compute total output weight client-side for validation
      const outputSkus = Object.entries(skuOutput).map(([pId, qty]) => {
        const productId = parseInt(pId);
        const sku = availableSkus.find(s => s.productId === productId);

        let weight = 0;
        const capacityLtr = parseFloat(sku?.packagingCapacityLtr || '0');
        if (capacityLtr > 0) {
          const density = parseFloat(sku?.fillingDensity || '1');
          weight = qty * capacityLtr * density;
        } else {
          weight = qty * (parseFloat(sku?.packageCapacityKg) || 0);
        }

        return {
          productId,
          producedUnits: qty,
          weightKg: Number(weight.toFixed(6)),
        };
      });

      // Compute actual batch weight (if density provided, treat actualQuantity as volume)
      const actualBatchWeight =
        actualQuantity && actualDensity
          ? Number(actualQuantity) * Number(actualDensity)
          : Number(actualQuantity) || 0;

      const totalOutputWeight = outputSkus.reduce((sum, s) => sum + (Number(s.weightKg) || 0), 0);

      const tolerance = actualBatchWeight * 0.05; // 5% tolerance
      const maxWeight = actualBatchWeight + tolerance;

      // if (totalOutputWeight > maxWeight) {
      //   showToast.error(
      //     `Total output weight (${totalOutputWeight.toFixed(2)} kg) exceeds +5% of actual batch weight (${actualBatchWeight.toFixed(2)} kg). Maximum allowed: ${maxWeight.toFixed(2)} kg`
      //   );
      //   setIsSubmitting(false);
      //   return;
      // }

      const completionData = {
        actualQuantity: Number(actualQuantity),
        actualDensity: Number(actualDensity),
        actualViscosity: Number(actualViscosity),
        startedAt: `${startDate}T${startTime}:00.000Z`,
        completedAt: `${endDate}T${endTime}:00.000Z`,
        productionRemarks,
        materials: [
          // Planned materials adjusted for reductions
          ...actualMaterials.map(m => {
            const reduction = reducedMaterials
              .filter(r => r.materialId === m.materialId)
              .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
            return {
              batchMaterialId: m.batchMaterialId,
              materialId: m.materialId,
              plannedQuantity: m.plannedQuantity,
              actualQuantity: m.plannedQuantity - reduction,
              isAdditional: false,
            };
          }),
          // Extra materials
          ...extraMaterials.map(m => ({
            batchMaterialId: 0,
            materialId: m.materialId,
            plannedQuantity: 0,
            actualQuantity: m.quantity,
            isAdditional: m.isExtra !== undefined ? m.isExtra : true,
          })),
        ],
        outputSkus: outputSkus.map(s => ({
          productId: s.productId,
          producedUnits: s.producedUnits,
          weightKg: s.weightKg.toFixed(6),
        })),
      };

      await productionManagerApi.completeBatch(completingBatchId, completionData);

      setIsCompletingBatch(false);
      setCompletingBatchId(null);
      setExtraMaterials([]); // Reset extra materials
      setSelectedExtraMaterialId(null);
      setExtraMaterialQty('');
      setReducedMaterials([]); // Reset reduced materials
      setSelectedReduceMaterialId(null);
      setReduceMaterialQty('');
      setActualMaterials([]);
      fetchScheduledBatches();

      // Optional: Open report modal or redirect
    } catch (error: any) {
      console.error('Failed to complete batch:', error);
      // Extract helpful error message from server response when available
      const serverMessage =
        (error?.response && error.response.data && error.response.data.message) ||
        error?.message ||
        'Failed to complete batch';
      showToast.error(serverMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // PDF Download Handler - Updated Version
  // Copy this function to replace the existing handleDownload in ScheduleBatchPage.tsx

  const handleDownload = async (batchId: number) => {
    try {
      showToast.loading('Generating PDF...');
      const data = await productionManagerApi.getBatchDetails(batchId);
      const { batch, materials, orders } = data;

      const doc = new jsPDF();

      // Full Page Border
      doc.setLineWidth(0.5);
      doc.rect(5, 5, 200, 287);

      // Header
      doc.setFontSize(16);
      // 1. Header: Company Info + Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const companyHeaderName = companyInfo?.companyName || 'MOREX TECHNOLOGIES';
      doc.text(companyHeaderName.toUpperCase(), 105, 15, { align: 'center' });

      doc.setFontSize(10);
      doc.text(`Batch No : ${batch.batchNo} / ${batch.masterProductName || ''}`, 14, 25);
      doc.text(`Date : ${new Date(batch.scheduledDate).toLocaleDateString()}`, 150, 25);

      doc.text(`Supervisor : Mr. ${batch.supervisorName || 'N/A'}`, 14, 32);

      // Use labourNames here
      const labor =
        batch.labourNames ||
        (batch.pmRemarks && batch.pmRemarks.includes('Labor:')
          ? batch.pmRemarks.split('Labor:')[1].trim()
          : 'abc');
      doc.text(`Labours : ${labor}`, 14, 38);

      doc.text(`Start Date Time : -`, 14, 44);
      doc.text(`End Date Time : -`, 14, 50);

      doc.text(`Density : ${batch.density || '-'}`, 14, 56);
      doc.text(`Water % : ${batch.waterPercentage || '0.00'}`, 14, 62);
      doc.text(`Production Qty : ${batch.plannedQuantity}`, 14, 68);

      // Tables - Data Preparation
      // Use autoTable for layout

      // Filter materials
      const standardMaterials = materials.filter((m: any) => !m.batchMaterial.isAdditional);
      const additionalMaterials = materials.filter((m: any) => m.batchMaterial.isAdditional);

      const bomData = standardMaterials.map((m: any) => [
        m.material?.productName || m.materialName || 'Unknown',
        formatQty(m.batchMaterial.requiredQuantity),
        '',
      ]);

      // Get all SKUs for this master product (from relatedSkus)
      // Merge with order quantities, setting qty to 0 for SKUs without orders
      const allSkus = data.relatedSkus || [];
      const ordersByProductId = new Map<number, any>();

      console.log('Batch Chart PDF Debug:', {
        batchId,
        allSkusCount: allSkus.length,
        ordersCount: orders.length,
        allSkus,
        orders,
      });

      // Create a map of orders by productId for quick lookup
      // orders is linkedOrders which has batchProduct containing plannedUnits
      orders.forEach((o: any) => {
        const productId = o.batchProduct?.productId || o.product?.productId;
        if (productId) {
          ordersByProductId.set(productId, o);
        }
      });

      // Build prodData: either from allSkus (all products for master) or from orders (linked products)
      let prodData: string[][] = [];

      if (allSkus.length > 0) {
        // Use all SKUs for this master product
        prodData = allSkus.map((sku: any) => {
          const order = ordersByProductId.get(sku.productId);
          const productName = sku.productName || 'Unknown Product';
          const productionQty = order?.batchProduct?.plannedUnits || 0;

          return [
            productName, // Shade = Product Name
            productionQty > 0 ? productionQty.toString() : '0', // QTY = Production Qty
            '', // LTR - to be filled manually
            '', // KG - to be filled manually
          ];
        });
      } else if (orders.length > 0) {
        // Fallback: use linked orders if no relatedSkus
        orders.forEach((o: any) => {
          const productName =
            o.product?.productName || o.batchProduct?.productId?.toString() || 'Unknown Product';
          const productionQty = o.batchProduct?.plannedUnits || 0;
          prodData.push([productName, productionQty > 0 ? productionQty.toString() : '0', '', '']);
        });
      } else {
        // No SKUs and no orders - show placeholder
        prodData.push([batch.masterProductName || 'No SKUs', '0', '', '']);
      }

      // Pad BOM Data to have some empty rows for manual entries if needed
      const paddedBomData = [...bomData];
      // Add a few empty rows to BOM for manual additions (optional)
      while (paddedBomData.length < Math.max(bomData.length, 5)) {
        paddedBomData.push(['', '', '']);
      }

      // Use prodData directly without padding - show only actual SKUs
      const paddedProdData = [...prodData];

      // Draw Tables Side-by-Side
      autoTable(doc, {
        startY: 75,
        head: [['Product', 'UseQty', 'Check']],
        body: paddedBomData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { textColor: [0, 0, 0], fontStyle: 'bold' },
        margin: { left: 14, right: 110 }, // Width approx 86
        tableWidth: 86,
      });

      // Prod Table (Right side)
      autoTable(doc, {
        startY: 75,
        head: [['Shade', 'QTY', 'LTR', 'KG']],
        body: paddedProdData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { textColor: [0, 0, 0], fontStyle: 'bold' },
        margin: { left: 110 },
        tableWidth: 86,
      });

      // Additional Materials Table (if any)
      if (additionalMaterials.length > 0) {
        const finalY = (doc as any).lastAutoTable.finalY || 150;

        doc.setFontSize(10);
        doc.text('Additional Raw Materials', 14, finalY + 10);

        const addData = additionalMaterials.map((m: any) => [
          m.material?.productName || m.materialName || 'Unknown',
          formatQty(m.batchMaterial.requiredQuantity),
          '',
        ]);

        autoTable(doc, {
          startY: finalY + 12,
          head: [['Material', 'Quantity', 'Check']],
          body: addData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
          headStyles: { textColor: [0, 0, 0], fontStyle: 'bold' },
          margin: { left: 14 },
          tableWidth: 86,
        });
      }

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY;

      doc.text('Production Remark :', 14, finalY + 15);

      doc.text('Labours Sign :-', 40, finalY + 40);
      doc.text(labor, 40, finalY + 46);

      doc.text('Superviser Sign :-', 150, finalY + 40);
      doc.text(`Mr. ${batch.supervisorName || ''}`, 150, finalY + 46);

      const fileName = `Batch_${batch.batchNo}.pdf`;
      addPdfFooter(doc);
      doc.save(fileName);
      showToast.success('PDF Downloaded!');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      showToast.error('Failed to generate PDF');
    }
  };

  // If not authenticated or no permission, show access denied.
  // Placed here (after all hooks) to comply with the React Rules of Hooks.
  if (!isAuthenticated || !canCreateBatch) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Access Denied</div>
          <div className="text-gray-600">
            {!isAuthenticated
              ? 'Please log in to access this page.'
              : 'You do not have permission to create production batches.'}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Create Production Batch"
          description="Consolidate orders and create batch production"
        />

        <div className="grid grid-cols-12 gap-6">
          {/* LEFT COLUMN: Form & BOM */}
          <div className="col-span-12 md:col-span-7 space-y-6">
            {isCompletingBatch ? (
              // COMPLETE BATCH FORM INLINE
              <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--primary)] text-white">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    Complete Batch {completingBatchNo} / {completingMasterProductName}
                  </h3>
                  <button
                    onClick={() => {
                      setIsCompletingBatch(false);
                      setCompletingBatchId(null);
                      setExtraMaterials([]);
                      setSelectedExtraMaterialId(null);
                      setExtraMaterialQty('');
                      setReducedMaterials([]);
                      setSelectedReduceMaterialId(null);
                      setReduceMaterialQty('');
                      setActualMaterials([]);
                    }}
                    className="text-white/80 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Production Details */}
                  <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <div className="w-4 h-4" /> {/* Placeholder icon or import Beaker */}
                      Production Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-[var(--text-secondary)]">
                            Produced Quantity (kg) <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--surface-muted)] px-1 rounded">
                            Planned: {plannedQuantityRef}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={actualQuantity}
                          readOnly
                          className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-[var(--text-secondary)]">
                            Actual Density <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--surface-muted)] px-1 rounded">
                            Calculated: {plannedDensityRef}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="0.001"
                          value={actualDensity}
                          onChange={e => {
                            const val = e.target.value;
                            const numVal = val === '' ? '' : parseFloat(val);

                            if (numVal === 0) {
                              showToast.error('Enter a non-zero value for Actual Density'); // Display toast
                              return; // Do not update state with 0
                            }

                            setActualDensity(numVal);
                          }}
                          onWheel={e => e.preventDefault()}
                          onKeyDown={e => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                          }}
                          className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                          required
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-[var(--text-secondary)]">
                            Actual Viscosity <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--surface-muted)] px-1 rounded">
                            Calculated: {plannedViscosityRef}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          value={actualViscosity}
                          onChange={e => {
                            const val = e.target.value;
                            setActualViscosity(val === '' ? '' : parseFloat(val));
                          }}
                          onWheel={e => e.preventDefault()}
                          onKeyDown={e => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                          }}
                          className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Production Times (Compact Timeline) */}
                  <div className="bg-[var(--surface-hover)] rounded-lg p-4 border border-[var(--border)]">
                    <div className="flex items-center justify-between gap-4">
                      {/* Start */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-500 flex items-center justify-center">
                          <Play className="w-3.5 h-3.5 text-green-600 dark:text-green-400 fill-current ml-0.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase">
                            Start
                          </span>
                          <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                            {startTime}
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">
                            {startDate}
                          </span>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="flex-1 flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--primary)] text-[var(--primary)] px-3 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="font-bold text-sm">{totalDuration}</span>
                        </div>
                      </div>

                      {/* End */}
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] font-semibold text-[var(--primary)] uppercase">
                            End
                          </span>
                          <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                            {endTime}
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{endDate}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-[var(--primary)] flex items-center justify-center">
                          <Check className="w-4 h-4 text-[var(--primary)]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Material Consumption */}
                  <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                      Actual Material Consumption
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                              Material
                            </th>
                            <th className="text-right py-2 px-3 text-[var(--text-secondary)]">
                              Planned Weight
                            </th>
                            <th className="w-12 text-center py-2 px-3 text-[var(--text-secondary)]">
                              {/* Actions */}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]/50">
                          {/* Planned Materials */}
                          {actualMaterials
                            .filter(mat => mat.plannedQuantity > 0)
                            .sort((a, b) => {
                              const aIsWater = a.materialName.toLowerCase().includes('water');
                              const bIsWater = b.materialName.toLowerCase().includes('water');
                              if (aIsWater && !bIsWater) return 1;
                              if (!aIsWater && bIsWater) return -1;
                              return 0;
                            })
                            .map(mat => (
                              <tr key={mat.batchMaterialId}>
                                <td
                                  className={`py-2 px-3 text-[var(--text-primary)] ${mat.materialName.toLowerCase().includes('water') ? 'font-bold' : ''}`}
                                >
                                  {mat.materialName}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right text-[var(--text-secondary)] ${mat.materialName.toLowerCase().includes('water') ? 'font-bold' : ''}`}
                                >
                                  {(() => {
                                    const reduction = reducedMaterials
                                      .filter(r => r.materialId === mat.materialId)
                                      .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                                    return formatQty(mat.plannedQuantity - reduction);
                                  })()}
                                </td>
                                <td className="py-2 px-3"></td>
                              </tr>
                            ))}
                          {/* Extra Materials */}
                          {extraMaterials.map((mat, index) => {
                            const available = getAvailableStock(mat.materialId);
                            const isInsufficient = mat.quantity > available;
                            return (
                              <tr
                                key={`extra-${mat.materialId}-${index}`}
                                className={`bg-green-50 dark:bg-green-900/10 ${isInsufficient ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                              >
                                <td className="py-2 px-3 text-[var(--text-primary)]">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 text-xs ${isInsufficient ? 'bg-red-500' : 'bg-green-500'} text-white rounded-full`}
                                    >
                                      {isInsufficient ? 'Low Stock' : 'Extra'}
                                    </span>
                                    {mat.materialName}
                                  </div>
                                  {isInsufficient && (
                                    <div className="text-xs text-red-500 font-medium mt-1 ml-14">
                                      Required: {formatQty(mat.quantity)} / Avail:{' '}
                                      {formatQty(available)}
                                    </div>
                                  )}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-medium ${isInsufficient ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}
                                >
                                  {formatQty(mat.quantity)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExtraMaterial(index)}
                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Remove Extra Material"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {/* Total Consumption Row */}
                          <tr className="border-t-2 border-[var(--border)] font-semibold bg-gray-50/30 dark:bg-gray-900/10">
                            <td className="py-2.5 px-3 text-[var(--text-primary)]">
                              Total Actual Consumption
                            </td>
                            <td className="py-2.5 px-3 text-right text-[var(--text-primary)]">
                              {(() => {
                                const plannedSum = actualMaterials
                                  .filter(mat => mat.plannedQuantity > 0)
                                  .reduce((sum, mat) => {
                                    const reduction = reducedMaterials
                                      .filter(r => r.materialId === mat.materialId)
                                      .reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
                                    return sum + (mat.plannedQuantity - reduction);
                                  }, 0);
                                const extraSum = extraMaterials.reduce(
                                  (sum, mat) => sum + (parseFloat(mat.quantity?.toString()) || 0),
                                  0
                                );
                                return formatQty(plannedSum + extraSum);
                              })()}
                            </td>
                            <td className="py-2.5 px-3"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Add Extra Material Section */}
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
                        Add Extra Raw Material
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1">
                          <SearchableSelect
                            label="Select Raw Material"
                            placeholder="Search raw material..."
                            options={allMasterProducts
                              .filter((p: any) => {
                                // Only show RM type products
                                if (p.productType !== 'RM') return false;

                                // Check if material can be added multiple times
                                const canAddMultiple =
                                  p.CanBeAddedMultipleTimes || p.canBeAddedMultipleTimes || false;

                                // If it can be added multiple times, always show it
                                if (canAddMultiple) return true;

                                // Check if already in extra materials
                                const inExtra = extraMaterials.some(
                                  m => m.materialId === p.masterProductId
                                );
                                if (inExtra) return false;

                                return true;
                              })
                              .map((mp: any) => ({
                                id: mp.masterProductId,
                                label: mp.masterProductName,
                                value: mp.masterProductId,
                                subLabel:
                                  mp.CanBeAddedMultipleTimes || mp.canBeAddedMultipleTimes
                                    ? '✓ Can add multiple times'
                                    : undefined,
                              }))}
                            value={selectedExtraMaterialId || undefined}
                            onChange={(val: any) => setSelectedExtraMaterialId(val || null)}
                            onCreateNew={undefined}
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <label className="block text-xs text-[var(--text-secondary)] mb-1">
                            Quantity (kg)
                          </label>
                          <input
                            type="number"
                            step="0.000001"
                            min="0"
                            value={extraMaterialQty}
                            onChange={e => setExtraMaterialQty(e.target.value)}
                            onWheel={e => e.preventDefault()}
                            onKeyDown={e => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                            }}
                            placeholder="0.000"
                            className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddExtraMaterial}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Reduce Extra Raw Material Section */}
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                          Reduce Extra Raw Material
                        </h4>
                        {totalReducedQuantity > 0 && (
                          <span className="text-xs font-medium text-red-600 dark:text-red-400">
                            Total Reduced: {formatQty(totalReducedQuantity)} kg (Added:{' '}
                            {formatQty(totalAddedQuantity)} kg)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1">
                          <SearchableSelect
                            label="Select Raw Material"
                            placeholder="Search raw material to reduce..."
                            options={actualMaterials
                              .filter(mat => mat.plannedQuantity > 0)
                              .filter(mat => {
                                const masterProduct = allMasterProducts.find(
                                  p => p.masterProductId === mat.materialId
                                );
                                if (!masterProduct) return false;
                                const pType =
                                  masterProduct.productType || masterProduct.ProductType;
                                if (pType !== 'RM') return false;
                                const pStatus = masterProduct.status || masterProduct.Status;
                                if (pStatus === 'Inactive' || pStatus === 'inactive') return false;
                                return true;
                              })
                              .map(mat => ({
                                id: mat.materialId,
                                label: mat.materialName,
                                value: mat.materialId,
                              }))}
                            value={selectedReduceMaterialId || undefined}
                            onChange={(val: any) => setSelectedReduceMaterialId(val || null)}
                            onCreateNew={undefined}
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <label className="block text-xs text-[var(--text-secondary)] mb-1">
                            Quantity (kg)
                          </label>
                          <input
                            type="number"
                            step="0.000001"
                            min="0"
                            value={reduceMaterialQty}
                            onChange={e => setReduceMaterialQty(e.target.value)}
                            onWheel={e => e.preventDefault()}
                            onKeyDown={e => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                            }}
                            placeholder="0.000"
                            className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleReduceMaterial}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          Reduce
                        </button>
                      </div>

                      {/* Active Reductions List */}
                      {reducedMaterials.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <label className="block text-xs font-medium text-[var(--text-secondary)]">
                            Active Reductions:
                          </label>
                          <div className="space-y-1">
                            {reducedMaterials.map((red, idx) => (
                              <div
                                key={`reduction-${red.materialId}-${idx}`}
                                className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-950 px-3 py-2 rounded text-sm text-[var(--text-primary)]"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full font-medium">
                                    Reduced
                                  </span>
                                  <span>{red.materialName}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-red-600 dark:text-red-400">
                                    -{formatQty(red.quantity)} kg
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveReduction(idx)}
                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                    title="Remove Reduction"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Finished Goods Output */}
                <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                    Finished Goods Output
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 px-3 text-[var(--text-secondary)]">
                            SKU Name
                          </th>
                          <th className="text-right py-2 px-3 text-[var(--text-secondary)]">
                            Production Qty
                          </th>
                          <th className="text-right py-2 px-3 text-[var(--text-secondary)]">
                            Actual Qty (Units)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]/50">
                        {availableSkus.map(sku => {
                          const requiredQty = sku.plannedUnits || 0;

                          return (
                            <tr key={sku.productId}>
                              <td className="py-2 px-3 text-[var(--text-primary)]">
                                {sku.productName}
                              </td>
                              <td className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[var(--text-primary)]">
                                {requiredQty > 0 ? requiredQty : '-'}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={skuOutput[sku.productId] || ''}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setSkuOutput(prev => ({ ...prev, [sku.productId]: val }));
                                  }}
                                  onWheel={e => e.preventDefault()}
                                  onKeyDown={e => {
                                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
                                      e.preventDefault();
                                  }}
                                  className="w-24 px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-right float-right"
                                />
                              </td>
                            </tr>
                          );
                        })}
                        {availableSkus.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-4 text-center text-[var(--text-tertiary)]"
                            >
                              No output SKUs found for this product.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="py-2 px-3 text-right">
                            {(() => {
                              const totalOutputWeight = availableSkus.reduce((sum, sku) => {
                                const qty = skuOutput[sku.productId] || 0;

                                const capacityLtr = parseFloat(sku.packagingCapacityLtr || '0');
                                if (capacityLtr > 0) {
                                  const fillingDensity = parseFloat(sku.fillingDensity || '0');
                                  const density =
                                    fillingDensity > 0
                                      ? fillingDensity
                                      : actualDensity && actualDensity > 0
                                        ? actualDensity
                                        : 1;
                                  return sum + qty * capacityLtr * density;
                                }

                                const pkgWeight = parseFloat(sku.packageCapacityKg || '0');
                                return sum + qty * pkgWeight;
                              }, 0);

                              const actualWeight = actualQuantity || 0;
                              // Validation uses tolerance (±5%) but we display available relative to Actual Weight
                              // or should we display available relative to Max Weight?
                              // "block submission if tolerance limit is hit"
                              // "do not include tolerance wt" in the display?
                              // Let's use Actual Weight as the target for "Available" to be consistent with "no tolerance wt"
                              const availableWeight = actualWeight - totalOutputWeight;

                              const tolerance = actualWeight * 0.05;
                              const minWeight = actualWeight - tolerance;
                              const maxWeight = actualWeight + tolerance;

                              const isValid =
                                totalOutputWeight >= minWeight && totalOutputWeight <= maxWeight;
                              const isOverMax = totalOutputWeight > maxWeight;

                              return (
                                <>
                                  <span className="font-semibold text-[var(--text-secondary)]">
                                    Total Produced Quantity :{' '}
                                  </span>
                                  <span className="font-bold text-[var(--text-primary)]">
                                    {totalOutputWeight.toFixed(2)} kg
                                  </span>
                                </>
                              );
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Remarks */}
                  <div className="bg-[var(--surface-hover)] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                      Production Remarks
                    </h3>
                    <textarea
                      value={productionRemarks}
                      onChange={e => setProductionRemarks(e.target.value)}
                      placeholder="Enter any remarks..."
                      rows={3}
                      className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompletingBatch(false);
                        setCompletingBatchId(null);
                        setExtraMaterials([]);
                        setSelectedExtraMaterialId(null);
                        setExtraMaterialQty('');
                        setActualMaterials([]);
                      }}
                      className="px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteSubmit}
                      disabled={
                        isSubmitting ||
                        extraMaterials.some(m => m.quantity > getAvailableStock(m.materialId))
                      }
                      className="px-6 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Completing...' : 'Complete Batch'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Main Form Fields */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Master Product (Searchable Dropdown) */}
                    <SearchableSelect
                      label="Master Product *"
                      placeholder="Search Master Product..."
                      options={masterProducts.map(mp => ({
                        id: mp.masterProductId,
                        label: mp.masterProductName,
                        value: mp.masterProductId,
                      }))}
                      value={masterProductId || undefined}
                      onChange={(val: any) => {
                        setMasterProductId(val || 0);
                      }}
                      required
                      onCreateNew={undefined}
                    />

                    {/* Planned Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Planned Quantity (kg) *
                      </label>
                      <div className="flex items-center gap-2">
                        <Weight className="w-5 h-5 text-[var(--text-tertiary)]" />
                        <input
                          type="number"
                          step="0.01"
                          value={plannedQuantity}
                          onChange={e => setPlannedQuantity(parseFloat(e.target.value))}
                          onWheel={e => e.preventDefault()}
                          onKeyDown={e => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                          }}
                          className="flex-1 px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Water Percentage from Product Development */}
                    {masterProductId > 0 && pdWaterPercentage > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                          Water Percentage (from 1K Product Development)
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 text-[var(--text-tertiary)] flex items-center justify-center">
                            💧
                          </div>
                          <input
                            type="text"
                            value={`${pdWaterPercentage}%`}
                            readOnly
                            className="flex-1 px-4 py-2 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] rounded-lg cursor-not-allowed"
                          />
                        </div>
                      </div>
                    )}

                    {/* Supervisor */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Supervisor Name *
                      </label>
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-[var(--text-tertiary)]" />
                        <select
                          value={supervisorId}
                          onChange={e => setSupervisorId(parseInt(e.target.value))}
                          className="flex-1 px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                          required
                        >
                          <option value="">Select Supervisor</option>
                          {supervisors.map(sup => (
                            <option key={sup.employeeId} value={sup.employeeId}>
                              {sup.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Labor Name */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Labor Name *
                      </label>
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-[var(--text-tertiary)]" />
                        <input
                          type="text"
                          value={laborName}
                          onChange={e => setLaborName(e.target.value)}
                          placeholder="Enter labor name"
                          className="flex-1 px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculate BOM Button */}
                  <div className="flex justify-start pt-2">
                    <button
                      type="button"
                      onClick={calculateBOM}
                      disabled={isLoadingBOM}
                      className="inline-flex items-center gap-2 px-6 py-2 bg-[var(--success)] text-white rounded-lg hover:bg-[var(--success)]/90 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Eye className="w-4 h-4" />
                      {isLoadingBOM ? 'Calculating...' : 'Calculate BOM'}
                    </button>
                  </div>

                  {/* BOM Results */}
                  {consolidatedBOM.length > 0 && (
                    <div
                      id="bom-requirements-section"
                      className="bg-[var(--surface-secondary)] rounded-lg border border-[var(--border)] overflow-hidden mt-6"
                    >
                      <div
                        className="p-4 border-b border-[var(--border)] bg-[var(--surface-muted)] flex justify-between items-center cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
                        onClick={() => setIsBOMExpanded(!isBOMExpanded)}
                      >
                        <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          BOM Requirements (Batch Specific)
                          <span className="text-xs text-[var(--text-tertiary)] font-normal">
                            ({consolidatedBOM.length} items)
                          </span>
                        </h4>
                        {isBOMExpanded ? (
                          <ChevronUp className="w-5 h-5 text-[var(--text-secondary)]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
                        )}
                      </div>

                      {isBOMExpanded && (
                        <>
                          <table className="w-full">
                            <thead className="bg-[var(--surface-muted)] text-left">
                              <tr>
                                <th className="px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                                  Product Name
                                </th>
                                <th className="px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                                  Percentage %
                                </th>
                                <th className="px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                                  Weight (KG)
                                </th>
                                <th className="px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                                  Seq
                                </th>
                                <th className="px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                                  Wait Time
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {consolidatedBOM.map(material => (
                                <tr
                                  key={material.materialId}
                                  className={`hover:bg-[var(--surface-hover)] ${insufficientMaterials.has(material.materialId) ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500' : ''}`}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                                    {material.materialName}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">
                                    {material.isWater
                                      ? `${material.waterPercent}%`
                                      : `${Number(material.percentage).toFixed(2)}%`}
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-sm font-semibold ${insufficientMaterials.has(material.materialId) ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-primary)]'}`}
                                  >
                                    {formatQty(material.requiredQuantity)} kg
                                    {insufficientMaterials.has(material.materialId) && (
                                      <div className="text-xs text-red-500 font-normal">
                                        Avail: {formatQty(material.availableQuantity)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                                    {material.sequence}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                                    {material.waitingTime || 0} min
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-[var(--surface-muted)] font-semibold">
                                <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                                  Total
                                </td>
                                <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">
                                  {consolidatedBOM
                                    .reduce((sum, m) => sum + Number(m.percentage), 0)
                                    .toFixed(2)}
                                  %
                                </td>
                                <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                                  {consolidatedBOM
                                    .reduce((sum, m) => sum + Number(m.requiredQuantity), 0)
                                    .toFixed(2)}{' '}
                                  kg
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-6 mt-6 border-t justify-end">
                    <button
                      type="button"
                      onClick={() => navigate('/operations/accepted-orders')}
                      className="px-6 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors font-medium"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSubmitting}
                      disabled={isSubmitting || insufficientMaterials.size > 0}
                      title={insufficientMaterials.size > 0 ? 'Insufficient Raw Materials' : ''}
                    >
                      {isSubmitting ? 'Starting Batch...' : 'Start Batch'}
                    </Button>

                    {/* Action Buttons moved inside form (already there at bottom) */}
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Costing Table */}
          <div className="col-span-12 md:col-span-5 space-y-6">
            <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm overflow-hidden h-full">
              <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <h3 className="font-semibold text-[var(--text-primary)]">Selected Products</h3>
              </div>

              <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-[var(--surface-highlight)] text-[var(--text-secondary)] font-semibold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 border border-[var(--border)]">Product Name</th>
                      <th className="px-4 py-3 border border-[var(--border)] text-center">
                        PM Capacity (L)
                      </th>
                      <th className="px-4 py-3 border border-[var(--border)] text-center">
                        Pack Qty (kg)
                      </th>
                      <th className="px-4 py-3 border border-[var(--border)] text-center">
                        Production Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {profitTableData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-6 text-center text-[var(--text-muted)] border border-[var(--border)] bg-[var(--surface-highlight)]/10"
                        >
                          Select products to see details
                        </td>
                      </tr>
                    ) : (
                      profitTableData.map((row, idx) => (
                        <tr
                          key={row.productId}
                          className={`hover:bg-[var(--surface-hover)] transition-colors ${idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]/30'}`}
                        >
                          <td className="px-4 py-3 border border-[var(--border)] font-medium">
                            {row.productName}
                          </td>
                          <td className="px-4 py-3 border border-[var(--border)] text-center">
                            {row.pmCapacity}
                          </td>
                          <td className="px-4 py-3 border border-[var(--border)] text-center">
                            {row.packQty}
                          </td>
                          <td className="px-4 py-3 border border-[var(--border)] text-center">
                            {row.productionQty}
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

        {/* New Scheduled Batches Table */}
        <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-muted)] flex justify-between items-center">
            <h3 className="font-semibold text-[var(--text-primary)]">Started Batches</h3>
            <div>
              <button
                onClick={fetchScheduledBatches}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--surface-highlight)] text-[var(--text-secondary)] font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Batch ID</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Supervisor</th>
                  <th className="px-4 py-3">Labor</th>
                  <th className="px-4 py-3">Time Req</th>
                  <th className="px-4 py-3">Prod Qty</th>
                  <th className="px-4 py-3 text-center">Download</th>
                  <th className="px-4 py-3 text-center">Complete</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {scheduledBatches.filter(batch => batch.status === 'In Progress').length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No started batches found.
                    </td>
                  </tr>
                ) : (
                  scheduledBatches
                    .filter(batch => batch.status === 'In Progress') // Only show In Progress (started) batches
                    .map(batch => {
                      const labor = batch.labourNames || 'N/A';

                      return (
                        <tr key={batch.batchId} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-3 font-medium">{batch.batchNo}</td>
                          <td className="px-4 py-3 text-sm">
                            {batch.startedAt || batch.createdAt
                              ? new Date(
                                  batch.startedAt || batch.createdAt || ''
                                ).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                              : '-'}
                          </td>
                          <td className="px-4 py-3 min-w-[150px]">{batch.masterProductName}</td>
                          <td className="px-4 py-3">{batch.supervisorName || 'N/A'}</td>
                          <td className="px-4 py-3">{labor}</td>
                          <td className="px-4 py-3">{batch.timeRequired || 'N/A'}</td>
                          <td className="px-4 py-3">{batch.plannedQuantity}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setSelectedBatchForReport({
                                    id: batch.batchId,
                                    batchNo: batch.batchNo,
                                    type: 'batch-chart',
                                  });
                                  setReportModalOpen(true);
                                }}
                                className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="View Batch Chart"
                              >
                                <FileText size={18} />
                              </button>
                              {batch.status === 'Completed' && (
                                <button
                                  onClick={() => {
                                    setSelectedBatchForReport({
                                      id: batch.batchId,
                                      batchNo: batch.batchNo,
                                      type: 'completion-chart',
                                    });
                                    setReportModalOpen(true);
                                  }}
                                  className="p-2 text-purple-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                  title="View Completion Report"
                                >
                                  <FileText size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                handleInitCompletion(
                                  batch.batchId,
                                  batch.batchNo,
                                  batch.masterProductName
                                );
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                              title="Complete Batch"
                              disabled={batch.status === 'Completed'}
                            >
                              <Check size={16} />
                              Complete
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {batch.status !== 'Completed' && (
                              <button
                                onClick={() => handleCancelBatch(batch.batchId)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                title="Cancel Batch"
                              >
                                <X size={16} />
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Batch Report Modal */}
      {selectedBatchForReport && (
        <BatchReportModal
          isOpen={reportModalOpen}
          onClose={() => {
            setReportModalOpen(false);
            setSelectedBatchForReport(null);
          }}
          batchId={selectedBatchForReport.id}
          batchNo={selectedBatchForReport.batchNo}
          reportType={selectedBatchForReport.type}
        />
      )}
    </>
  );
}
