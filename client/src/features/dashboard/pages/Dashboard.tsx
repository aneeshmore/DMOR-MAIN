import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Package,
  Factory,
  ClipboardList,
  BarChart3,
  ShoppingCart,
  UserPlus,
  PlusCircle,
  CheckCircle,
  Download,
  GripHorizontal,
} from 'lucide-react';
import { productionManagerApi } from '@/features/production-manager/api/productionManagerApi';
import { reportsApi } from '@/features/reports/api/reportsApi';
import { employeeApi } from '@/features/employees/api/employeeApi';
import { customerApi } from '@/features/masters/api/customerApi';
import { productApi } from '@/features/master-products/api';
import { AlertsTicker } from '@/features/notifications/components/AlertsTicker';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { confirmDialog } from '@/components/ui';

// Define Card Interface
interface DashboardCard {
  title: string;
  icon: any;
  count: number | string;
  path: string;
  color: string;
  bg: string;
  description?: string;
  permission?: { module: string; action: string };
}

interface SortableDashboardCardProps {
  card: DashboardCard;
  isEditing: boolean;
  navigate: (path: string) => void;
}

const SortableDashboardCard: React.FC<SortableDashboardCardProps> = ({ card, isEditing, navigate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.title,
    disabled: !isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const Icon = card.icon;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...(isEditing ? { ...attributes, ...listeners } : {})}
      onClick={() => {
        if (!isEditing) navigate(card.path);
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-6 text-left transition-all select-none",
        isEditing
          ? "border-2 border-dashed border-[var(--primary)]/60 bg-[var(--surface-highlight)]/10 cursor-grab active:cursor-grabbing hover:border-[var(--primary)] hover:shadow-lg"
          : "border-[var(--border)] bg-[var(--surface)] hover:shadow-lg hover:border-[var(--primary)] cursor-pointer"
      )}
    >
      {isEditing && (
        <div className="absolute top-2 right-2 p-1 text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-md opacity-70 group-hover:opacity-100 transition-opacity">
          <GripHorizontal className="h-4 w-4 text-[var(--primary)]" />
        </div>
      )}
      <div className={cn("flex flex-col h-full", isDragging && "opacity-50")}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className={`inline-flex p-3 rounded-lg ${card.bg} mb-4`}>
              <Icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              {card.title}
            </h3>
            {card.description ? (
              <p className="text-sm text-[var(--text-secondary)]">{card.description}</p>
            ) : (
              <p className="text-2xl font-bold text-[var(--text-primary)]">{card.count}</p>
            )}
          </div>
        </div>
        {!isEditing && (
          <div className="mt-4 flex items-center text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
            {card.description ? 'Access' : 'View details'}
            <svg
              className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [activeProductionCount, setActiveProductionCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [productCount, setProductCount] = useState<number>(0);

  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<DashboardCard[]>([]);

  // Fallback / Admin Dashboard Logic (Data Fetching)
  useEffect(() => {
    const fetchData = async () => {
      // Production Data
      if (hasPermission('production-manager', 'view')) {
        try {
          const productionData = await productionManagerApi.getPlanningDashboardData();
          const uniqueMasterIds = new Set(productionData.map((item: any) => item.masterProductId));
          setActiveProductionCount(uniqueMasterIds.size);
        } catch (error) {
          console.error('Failed to fetch production data:', error);
        }
      }

      // Stock Data
      if (hasPermission('report-stock', 'view')) {
        try {
          const stockData = await reportsApi.getStockReport();

          const lowStock = stockData.filter(
            (item: any) => item.availableQuantity < item.minStockLevel
          ).length;
          setLowStockCount(lowStock);
        } catch (error) {
          console.error('Failed to fetch stock data:', error);
        }
      }

      // Employee Data
      if (hasPermission('employees', 'view')) {
        try {
          const employeeResponse = await employeeApi.getAll();
          const employees = (employeeResponse as any).data || [];
          setEmployeeCount(employees.length);
        } catch (error) {
          console.error('Failed to fetch employee data:', error);
        }
      }

      // Customer Data
      if (hasPermission('Add New Customer', 'view')) {
        try {
          const customerResponse = await customerApi.getAll();
          const customers = (customerResponse as any).data || [];
          setCustomerCount(customers.length);
        } catch (error) {
          console.error('Failed to fetch customer data:', error);
        }
      }

      // Product Data
      if (hasPermission('products', 'view')) {
        try {
          const productResponse = await productApi.getAll();
          if (productResponse.success && productResponse.data) {
            setProductCount(productResponse.data.length);
          }
        } catch (error) {
          console.error('Failed to fetch product data:', error);
        }
      }
    };

    fetchData();
  }, [hasPermission]);

  // Define Cards for different Roles
  const getCards = (): DashboardCard[] => {
    const role = user?.Role?.toLowerCase() || '';

    // --- SALES DASHBOARD ---
    if (role.includes('sales')) {
      return [
        {
          title: 'Add New Customer',
          icon: UserPlus,
          count: 'New',
          description: 'Register a new customer',
          path: '/masters/customers',
          color: 'text-cyan-500',
          bg: 'bg-cyan-500/10',
        },
        {
          title: 'Create & Manage Orders/Quotations',
          icon: PlusCircle,
          count: 'Create',
          description: 'Create and manage orders/quotations',
          path: '/operations/create-order',
          color: 'text-green-500',
          bg: 'bg-green-500/10',
        },
        {
          title: 'Quotation Requests',
          icon: ClipboardList,
          count: 'View',
          description: 'View and manage quotation requests',
          path: '/operations/quotation-requests',
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
        },
      ];
    }

    // --- PRODUCTION DASHBOARD ---
    if (role.includes('production') || role.includes('factory')) {
      return [
        {
          title: 'Batch Report',
          icon: BarChart3,
          count: 'View',
          description: 'View batch production reports',
          path: '/reports/batch-production',
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
        },
        {
          title: 'Material Inward',
          icon: Download,
          count: 'Inward',
          description: 'Manage material inward records',
          path: '/operations/pm-inward',
          color: 'text-orange-500',
          bg: 'bg-orange-500/10',
        },
        {
          title: 'Create & Manage Batch',
          icon: ShoppingCart,
          count: 'Orders',
          description: 'Create and view batches',
          path: '/operations/create-batch',
          color: 'text-green-500',
          bg: 'bg-green-500/10',
        },
        {
          title: 'PM Dashboard',
          icon: Download,
          count: 'View',
          description: 'View PM Dashboard',
          path: '/operations/pm-dashboard',
          color: 'text-orange-500',
          bg: 'bg-orange-500/10',
        }
      ];
    }

    // --- ACCOUNTS DASHBOARD ---
    if (role.includes('account')) {
      return [
        {
          title: 'Order Approval',
          icon: CheckCircle,
          count: 'Approve',
          description: 'Approve pending orders',
          path: '/operations/admin-accounts',
          color: 'text-rose-500',
          bg: 'bg-rose-500/10',
        },
        {
          title: 'Create & Manage Orders/Quotations',
          icon: ShoppingCart,
          count: 'Orders',
          description: 'Create and view orders/quotations',
          path: '/operations/create-order',
          color: 'text-green-500',
          bg: 'bg-green-500/10',
        },
        {
          title: 'Quotation Requests',
          icon: ClipboardList,
          count: 'Requests',
          description: 'Manage quotation requests',
          path: '/operations/quotation-requests',
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
        },
      ];
    }

    // --- DEFAULT / ADMIN DASHBOARD ---
    const defaultCards = [
      {
        title: 'Create Order',
        icon: ShoppingCart,
        count: 'New',
        path: '/operations/create-order',
        color: 'text-green-500',
        bg: 'bg-green-500/10',
        permission: { module: 'create-order', action: 'create' },
      },
      {
        title: 'Employees',
        icon: Users,
        count: employeeCount,
        path: '/masters/employees',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        permission: { module: 'employees', action: 'view' },
      },
      {
        title: 'Customers',
        icon: UserPlus,
        count: customerCount,
        path: '/masters/customers',
        color: 'text-cyan-500',
        bg: 'bg-cyan-500/10',
        permission: { module: 'Add New Customer', action: 'view' },
      },
      {
        title: 'Products',
        icon: Package,
        count: productCount,
        path: '/masters/product-sub-master',
        color: 'text-violet-500',
        bg: 'bg-violet-500/10',
        permission: { module: 'products', action: 'view' },
      },
      {
        title: 'Production',
        icon: Factory,
        count: `${activeProductionCount} Active`,
        path: '/operations/pm-dashboard',
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
        permission: { module: 'pm-orders', action: 'view' },
      },
      {
        title: 'Stock Report',
        icon: ClipboardList,
        count: `Low Stock: ${lowStockCount}`,
        path: '/reports/low-stock',
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
        permission: { module: 'report-stock', action: 'view' },
      },
      {
        title: 'Reports',
        icon: BarChart3,
        count: 'View All',
        path: '/reports',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        permission: { module: 'reports', action: 'view' },
      },
    ];

    // Filter default cards based on permissions
    return defaultCards.filter(
      card => !card.permission || hasPermission(card.permission.module, card.permission.action as any)
    );
  };

  const rawVisibleCards = useMemo(() => getCards(), [
    employeeCount,
    customerCount,
    productCount,
    activeProductionCount,
    lowStockCount,
    user,
    hasPermission
  ]);

  const storageKey = `morex_tab_order_${user?.EmployeeID || 'default'}_dashboard`;

  // Sort and sync cards
  useEffect(() => {
    const savedOrder = localStorage.getItem(storageKey);
    if (savedOrder) {
      try {
        const orderTitles = JSON.parse(savedOrder) as string[];
        const sorted = [...rawVisibleCards].sort((a, b) => {
          const idxA = orderTitles.indexOf(a.title);
          const idxB = orderTitles.indexOf(b.title);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setItems(sorted);
      } catch (e) {
        console.error('Failed to parse saved dashboard order', e);
        setItems(rawVisibleCards);
      }
    } else {
      setItems(rawVisibleCards);
    }
  }, [rawVisibleCards, storageKey]);

  const isAdmin = user?.Role?.toLowerCase() === 'admin' || user?.Role?.toLowerCase() === 'superadmin';

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
      setItems(prev => {
        const oldIndex = prev.findIndex(item => item.title === active.id);
        const newIndex = prev.findIndex(item => item.title === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    const orderTitles = items.map(item => item.title);
    localStorage.setItem(storageKey, JSON.stringify(orderTitles));
    setIsEditing(false);
  };

  const handleCancel = () => {
    const savedOrder = localStorage.getItem(storageKey);
    if (savedOrder) {
      try {
        const orderTitles = JSON.parse(savedOrder) as string[];
        const sorted = [...rawVisibleCards].sort((a, b) => {
          const idxA = orderTitles.indexOf(a.title);
          const idxB = orderTitles.indexOf(b.title);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setItems(sorted);
      } catch {
        setItems(rawVisibleCards);
      }
    } else {
      setItems(rawVisibleCards);
    }
    setIsEditing(false);
  };

  const handleReset = async () => {
    if (
      await confirmDialog({
        title: 'Reset Dashboard',
        message: 'Reset dashboard cards to default order?',
        confirmLabel: 'Continue',
        variant: 'warning',
      })
    ) {
      localStorage.removeItem(storageKey);
      setItems(rawVisibleCards);
      setIsEditing(false);
    }
  };

  // Dynamic Header Text based on Role
  const getHeaderText = () => {
    const role = user?.Role?.toLowerCase() || '';
    if (role.includes('sales')) return 'Sales Dashboard';
    if (role.includes('production') || role.includes('factory')) return 'Production Dashboard';
    if (role.includes('account')) return 'Accounts Dashboard';
    return 'Welcome to Morex Technologies';
  };

  const getSubHeaderText = () => {
    const role = user?.Role?.toLowerCase() || '';
    if (role.includes('sales')) return 'Manage your sales, orders, and customers';
    if (role.includes('production') || role.includes('factory')) return 'Manage production, reports, and batches';
    if (role.includes('account')) return 'Manage approvals, orders, and quotations';
    return 'Enterprise Resource Planning System';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-primary)]">
            {getHeaderText()}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {getSubHeaderText()}
          </p>
        </div>
        {isAdmin && items.length > 1 && (
          <div className="flex items-center gap-2 self-end md:self-auto">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
                >
                  Save Layout
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-[var(--border)] hover:bg-[var(--surface-highlight)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Reset Defaults
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-[var(--border)] hover:bg-[var(--surface-highlight)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-[var(--primary)] hover:bg-[var(--primary)]/10 text-[var(--primary)] rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Edit Tabs</span>
              </button>
            )}
          </div>
        )}
      </div>

      <AlertsTicker />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(item => item.title)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map(card => (
              <SortableDashboardCard
                key={card.title}
                card={card}
                isEditing={isEditing}
                navigate={navigate}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
