import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionManagerApi } from '../api/productionManagerApi';
import { showToast } from '@/utils/toast';
import { PageHeader } from '@/components/common';
import {
  Factory,
  AlertCircle,
  CheckCircle2,
  Package,
  ChevronDown,
  ChevronRight,
  Layers,
  RefreshCw,
  Search,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ============================================================================
// Types
// ============================================================================

interface PlanningData {
  productId: number;
  productName: string;
  masterProductName: string;
  masterProductId: number;
  totalOrderQty: number;
  availableQty: number;
  productionQty: number;
  productionWeight: number;
  packageCapacityKg?: number;
  orderIds?: number[];
  density?: number;
}

interface FeasibilityResult {
  feasible: boolean;
  materials: Array<{
    materialId: number;
    materialName: string;
    requiredQuantity: number;
    availableQuantity: number;
    percentage?: number;
  }>;
}

interface GroupedData {
  masterProductId: number;
  masterProductName: string;
  products: PlanningData[];
  totalOrderQty: number;
  totalAvailableQty: number;
  totalProductionQty: number;
  totalProductionWeight: number;
  feasibilityChecked: boolean;
  feasible: boolean;
  materials?: FeasibilityResult['materials'];
  allOrderIds: number[];
  needsProduction: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function PMPlanningDashboard() {
  const [data, setData] = useState<PlanningData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feasibilityResults, setFeasibilityResults] = useState<Record<number, FeasibilityResult>>(
    {}
  );
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'production' | 'ready'>('all');

  const navigate = useNavigate();

  // ============================================================================
  // Data Fetching
  // ============================================================================

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const result = await productionManagerApi.getPlanningDashboardData();
      setData(result);
    } catch {
      showToast.error('Failed to fetch planning data');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleCheckGroupInventory = useCallback(
    async (masterProductId: number, products: PlanningData[]) => {
      try {
        setCheckingId(masterProductId);
        const productsToCheck = products
          .filter(p => p.productionQty > 0)
          .map(p => ({
            productId: p.productId,
            quantity: p.productionWeight,
          }));

        if (productsToCheck.length === 0) {
          showToast.error('No production required for this master product');
          return;
        }

        const result = await productionManagerApi.checkGroupFeasibility(productsToCheck);

        setFeasibilityResults(prev => ({
          ...prev,
          [masterProductId]: result,
        }));

        setExpandedRows(prev => new Set(prev).add(masterProductId));

        if (result.noRecipe || result.materials?.length === 0) {
          showToast.warning(
            'No recipe/formula configured for this product. Please set up Product Development first.'
          );
        } else if (result.feasible) {
          showToast.success('All materials available for production!');
        } else {
          showToast.warning('Material shortage detected');
        }
      } catch {
        showToast.error('Failed to check inventory');
      } finally {
        setCheckingId(null);
      }
    },
    []
  );

  const handleScheduleProduction = (group: GroupedData) => {
    navigate('/operations/create-batch', {
      state: {
        masterProductId: group.masterProductId,
        masterProductName: group.masterProductName,
        products: group.products.map(p => ({
          productId: p.productId,
          productName: p.productName,
          productionQty: p.productionQty,
          productionWeight: p.productionWeight,
        })),
        plannedQuantity: group.totalProductionWeight,
        orderIds: group.allOrderIds,
      },
    });
  };

  // ============================================================================
  // Computed Data
  // ============================================================================

  const groupedData = useMemo<GroupedData[]>(() => {
    let filteredData = data;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredData = filteredData.filter(
        item =>
          item.masterProductName.toLowerCase().includes(query) ||
          item.productName.toLowerCase().includes(query)
      );
    }

    const groups = filteredData.reduce(
      (acc, item) => {
        if (!acc[item.masterProductId]) {
          acc[item.masterProductId] = {
            masterProductId: item.masterProductId,
            masterProductName: item.masterProductName,
            products: [],
            totalOrderQty: 0,
            totalAvailableQty: 0,
            totalProductionQty: 0,
            totalProductionWeight: 0,
            feasibilityChecked: false,
            feasible: false,
            allOrderIds: [],
            needsProduction: false,
          };
        }
        acc[item.masterProductId].products.push(item);
        acc[item.masterProductId].totalOrderQty += item.totalOrderQty;
        acc[item.masterProductId].totalAvailableQty += item.availableQty;
        acc[item.masterProductId].totalProductionQty += item.productionQty;
        acc[item.masterProductId].totalProductionWeight += item.productionWeight;

        if (item.orderIds) {
          item.orderIds.forEach(id => {
            if (!acc[item.masterProductId].allOrderIds.includes(id)) {
              acc[item.masterProductId].allOrderIds.push(id);
            }
          });
        }

        return acc;
      },
      {} as Record<number, GroupedData>
    );

    return Object.values(groups)
      .map(group => {
        const feasibility = feasibilityResults[group.masterProductId];
        const needsProduction = group.products.some(p => p.productionQty > 0);
        return {
          ...group,
          feasibilityChecked: !!feasibility,
          feasible: feasibility?.feasible || false,
          materials: feasibility?.materials,
          needsProduction,
        };
      })
      .sort((a, b) => {
        if (a.needsProduction !== b.needsProduction) {
          return a.needsProduction ? -1 : 1;
        }
        return a.masterProductName.localeCompare(b.masterProductName);
      });
  }, [data, feasibilityResults, searchQuery]);

  const displayedData = useMemo(() => {
    if (activeTab === 'production') {
      return groupedData.filter(g => g.needsProduction);
    }
    if (activeTab === 'ready') {
      return groupedData.filter(g => !g.needsProduction);
    }
    return groupedData;
  }, [groupedData, activeTab]);

  // Stats
  const stats = useMemo(() => {
    const needsProduction = groupedData.filter(g => g.needsProduction);
    const readyToDispatch = groupedData.filter(g => !g.needsProduction);
    const totalWeight = groupedData.reduce((sum, g) => sum + g.totalProductionWeight, 0);

    return {
      totalProducts: groupedData.length,
      needsProductionCount: needsProduction.length,
      readyToDispatchCount: readyToDispatch.length,
      totalWeight,
    };
  }, [groupedData]);

  const toggleRowExpand = (masterProductId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(masterProductId)) {
        newSet.delete(masterProductId);
      } else {
        newSet.add(masterProductId);
      }
      return newSet;
    });
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-[var(--primary)] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)]">Loading production data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        metadataPath="/operations/pm-dashboard"
        title="Production Planning"
        description="Manage production batches and scheduling"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Total Products"
          value={stats.totalProducts}
          color="primary"
          onClick={() => setActiveTab('all')}
        />
        <StatCard
          icon={<Factory className="w-5 h-5" />}
          label="Needs Production"
          value={stats.needsProductionCount}
          color="warning"
          onClick={() => setActiveTab('production')}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Stock Ready"
          value={stats.readyToDispatchCount}
          color="success"
          onClick={() => setActiveTab('ready')}
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Total production weight"
          value={`${stats.totalWeight.toFixed(2)} kg`}
          color="secondary"
          onClick={() => setActiveTab('production')}
        />
      </div>

      {/* Action Bar */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Tab Buttons */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--surface-secondary)] rounded-lg w-full overflow-x-auto">
            <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
              All ({groupedData.length})
            </TabButton>
            <TabButton
              active={activeTab === 'production'}
              onClick={() => setActiveTab('production')}
              color="warning"
            >
              <Factory className="w-3.5 h-3.5" />
              Needs Production ({stats.needsProductionCount})
            </TabButton>
            <TabButton
              active={activeTab === 'ready'}
              onClick={() => setActiveTab('ready')}
              color="success"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Stock Ready ({stats.readyToDispatchCount})
            </TabButton>
          </div>

          {/* Search & Refresh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Products View */}
      <ProductsView
        displayedData={displayedData}
        expandedRows={expandedRows}
        checkingId={checkingId}
        onToggleExpand={toggleRowExpand}
        onCheckMaterials={handleCheckGroupInventory}
        onSchedule={handleScheduleProduction}
        searchQuery={searchQuery}
        activeTab={activeTab}
      />
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'primary' | 'success' | 'warning' | 'info' | 'secondary' | 'danger';
  onClick?: () => void;
}

function StatCard({ icon, label, value, color, onClick }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    success: 'bg-[var(--success)]/10 text-[var(--success)]',
    warning: 'bg-[var(--warning)]/10 text-[var(--warning)]',
    info: 'bg-blue-500/10 text-blue-500',
    secondary: 'bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]',
    danger: 'bg-[var(--danger)]/10 text-[var(--danger)]',
  };

  return (
    <div
      className={`bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 transition-all ${
        onClick ? 'cursor-pointer hover:border-[var(--primary)] hover:shadow-md' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
      </div>
    </div>
  );
}

interface ViewToggleProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}

function ViewToggle({ active, onClick, children, icon }: ViewToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        active
          ? 'bg-[var(--primary)] text-white shadow-sm'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'warning' | 'success' | 'danger';
}

function TabButton({ active, onClick, children, color }: TabButtonProps) {
  const activeColor =
    color === 'warning'
      ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
      : color === 'success'
        ? 'bg-[var(--success)]/20 text-[var(--success)]'
        : color === 'danger'
          ? 'bg-[var(--danger)]/20 text-[var(--danger)]'
          : 'bg-[var(--surface)] text-[var(--text-primary)]';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
        active
          ? activeColor + ' shadow-sm'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Products View
// ============================================================================

interface ProductsViewProps {
  displayedData: GroupedData[];
  expandedRows: Set<number>;
  checkingId: number | null;
  onToggleExpand: (id: number) => void;
  onCheckMaterials: (id: number, products: PlanningData[]) => void;
  onSchedule: (group: GroupedData) => void;
  searchQuery: string;
  activeTab: string;
}

function ProductsView({
  displayedData,
  expandedRows,
  checkingId,
  onToggleExpand,
  onCheckMaterials,
  onSchedule,
  searchQuery,
  activeTab,
}: ProductsViewProps) {
  if (displayedData.length === 0) {
    return (
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-12 text-center">
        <Package className="w-14 h-14 mx-auto text-[var(--text-tertiary)] opacity-40 mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No products found</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          {searchQuery
            ? `No products match "${searchQuery}". Try adjusting your search.`
            : activeTab === 'production'
              ? 'All products have sufficient stock. No production needed!'
              : activeTab === 'ready'
                ? 'No products are ready for dispatch yet.'
                : 'No pending production requirements at this time.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayedData.map(group => (
        <ProductCard
          key={group.masterProductId}
          group={group}
          isExpanded={expandedRows.has(group.masterProductId)}
          isChecking={checkingId === group.masterProductId}
          onToggle={() => onToggleExpand(group.masterProductId)}
          onCheckMaterials={() => onCheckMaterials(group.masterProductId, group.products)}
          onSchedule={() => onSchedule(group)}
        />
      ))}
    </div>
  );
}

interface ProductCardProps {
  group: GroupedData;
  isExpanded: boolean;
  isChecking: boolean;
  onToggle: () => void;
  onCheckMaterials: () => void;
  onSchedule: () => void;
}

function ProductCard({
  group,
  isExpanded,
  isChecking,
  onToggle,
  onCheckMaterials,
  onSchedule,
}: ProductCardProps) {
  const needsProduction = group.needsProduction;

  return (
    <div
      className={`bg-[var(--surface)] rounded-xl border transition-all overflow-hidden ${
        isExpanded
          ? 'border-[var(--primary)]/40 shadow-lg shadow-[var(--primary)]/5'
          : 'border-[var(--border)] hover:border-[var(--border-hover)]'
      }`}
    >
      {/* Header Row */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        onClick={onToggle}
      >
        {/* Top row: Toggle, Title, Status Badge */}
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:flex-1">
          <button className="p-1 rounded hover:bg-[var(--surface-secondary)] transition-colors flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
          </button>

          <div
            className={`w-1.5 h-10 sm:h-12 rounded-full flex-shrink-0 ${
              needsProduction ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'
            }`}
          />

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <h3 className="font-semibold text-[var(--text-primary)] uppercase tracking-wide text-sm sm:text-base">
                {group.masterProductName}
              </h3>
              {needsProduction ? (
                <span className="px-2 py-0.5 text-xs font-medium bg-[var(--warning)]/10 text-[var(--warning)] rounded-full w-fit">
                  Production Needed
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium bg-[var(--success)]/10 text-[var(--success)] rounded-full w-fit">
                  Stock Available
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
              <span>{group.products.length} SKU(s)</span>
              <span>•</span>
              <span>{group.allOrderIds.length} Order(s)</span>
            </div>
          </div>
        </div>

        {/* Bottom row on mobile, inline on desktop: Metrics */}
        <div className="flex items-center gap-2 sm:gap-4 text-center w-full sm:w-auto text-xs sm:text-base">
          <div>
            <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase">Ordered</p>
            <p className="font-bold text-[var(--text-primary)]">{group.totalOrderQty}</p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase">
              Available
            </p>
            <p
              className={`font-bold ${
                group.totalAvailableQty >= group.totalOrderQty
                  ? 'text-[var(--success)]'
                  : 'text-[var(--danger)]'
              }`}
            >
              {group.totalAvailableQty}
            </p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase">
              To Produce
            </p>
            <p className="font-bold text-[var(--primary)]">{group.totalProductionQty}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs text-[var(--text-tertiary)] uppercase">Weight</p>
            <p className="font-bold text-[var(--text-primary)]">
              {group.totalProductionWeight.toFixed(2)} kg
            </p>
          </div>
        </div>

        <div className="w-full sm:w-28 text-center text-xs sm:text-sm">
          {!group.feasibilityChecked ? (
            <span className="text-xs text-[var(--text-tertiary)]">Not checked</span>
          ) : group.feasible ? (
            <div className="flex items-center justify-center gap-1 text-[var(--success)]">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-medium">Materials OK</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 text-[var(--danger)]">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Shortage</span>
            </div>
          )}
        </div>

        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto"
          onClick={e => e.stopPropagation()}
        >
          {needsProduction ? (
            <>
              <Button
                size="sm"
                variant={group.feasibilityChecked ? 'ghost' : 'secondary'}
                onClick={onCheckMaterials}
                disabled={isChecking}
                leftIcon={
                  isChecking ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Layers className="w-4 h-4" />
                  )
                }
              >
                {isChecking ? 'Checking...' : group.feasibilityChecked ? 'Recheck' : 'Check RM'}
              </Button>

              {group.feasibilityChecked && group.feasible && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={onSchedule}
                  leftIcon={<Factory className="w-4 h-4" />}
                >
                  Create Batch
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              className="bg-[var(--success)] hover:bg-[var(--success)]/90 text-white"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Stock Ready
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* SKU Breakdown */}
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3">
                <Package className="w-4 h-4 text-[var(--primary)]" />
                Product SKUs ({group.products.length})
              </h4>
              <div className="space-y-2 max-h-72 overflow-auto pr-2">
                {group.products.map(product => (
                  <div
                    key={product.productId}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] text-sm truncate">
                        {product.productName}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        ID: {product.productId} • {product.packageCapacityKg || '-'} kg/unit
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Order</p>
                        <p className="font-medium">{product.totalOrderQty}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Avail</p>
                        <p
                          className={`font-medium ${
                            product.availableQty >= product.totalOrderQty
                              ? 'text-[var(--success)]'
                              : 'text-[var(--danger)]'
                          }`}
                        >
                          {product.availableQty}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase">Produce</p>
                        <p className="font-bold text-[var(--primary)]">{product.productionQty}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Material Requirements */}
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3">
                <Layers className="w-4 h-4 text-[var(--primary)]" />
                Raw Material Requirements
              </h4>

              {!group.feasibilityChecked ? (
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--surface)] rounded-lg border border-dashed border-[var(--border)]">
                  <Layers className="w-10 h-10 text-[var(--text-tertiary)] mb-3 opacity-50" />
                  <p className="text-sm text-[var(--text-secondary)] text-center">
                    Click &quot;Check RM&quot; to analyze material requirements
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={onCheckMaterials}
                    disabled={isChecking}
                    leftIcon={<Layers className="w-4 h-4" />}
                  >
                    Check Materials
                  </Button>
                </div>
              ) : group.materials?.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--warning)]/5 rounded-lg border border-[var(--warning)]/20">
                  <AlertCircle className="w-10 h-10 text-[var(--warning)] mb-3 opacity-70" />
                  <p className="text-sm text-[var(--text-primary)] text-center font-medium">
                    No Recipe Configured
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] text-center mt-1">
                    This product doesn&apos;t have a 1K Product Development formula. Please
                    configure Raw Materials in 1K Product Development first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto pr-2">
                  {group.materials?.map((material, idx) => {
                    const isAvailable = material.availableQuantity >= material.requiredQuantity;
                    const shortage = material.requiredQuantity - material.availableQuantity;

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-lg border ${
                          isAvailable
                            ? 'bg-[var(--success)]/5 border-[var(--success)]/20'
                            : 'bg-[var(--danger)]/5 border-[var(--danger)]/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isAvailable ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--success)] flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-[var(--danger)] flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {material.materialName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 text-sm whitespace-nowrap">
                          <span className="font-medium">
                            {material.requiredQuantity.toFixed(1)} kg
                          </span>
                          <span
                            className={`font-medium ${
                              isAvailable ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                            }`}
                          >
                            {isAvailable ? '✓' : `-${shortage.toFixed(1)} kg`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Linked Orders */}
          {group.allOrderIds.length > 0 && (
            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[var(--border)]">
              <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm flex-col sm:flex-row">
                <Layers className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                <span className="text-[var(--text-secondary)] break-words">
                  Linked Orders: {group.allOrderIds.map(id => `#${id}`).join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
