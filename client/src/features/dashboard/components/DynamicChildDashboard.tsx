import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  LucideIcon,
  LayoutDashboard,
  Database,
  BarChart3,
  Factory,
  Cpu,
  GripHorizontal,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { routeRegistry, findRouteByPath, RouteNode } from '@/config/routeRegistry';
import { getModuleTitleByPath, getModuleDescriptionByPath } from '@/config/moduleDisplayMetadata';
import { cn } from '@/utils/cn';
import {
  MODULE_CARD_SIZE,
  MODULE_CARD_TITLE_CLAMP,
  MODULE_CARD_DESCRIPTION_CLAMP,
} from '../constants/cardLayout';
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

interface DynamicChildDashboardProps {
  parentPath: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
}

// Default metadata fallback
const DEFAULT_META = {
  description: 'Manage section',
  iconBg: 'bg-gray-50',
  iconColor: 'text-gray-600',
  icon: AlertCircle,
};

// Map of route paths/IDs to metadata for common sections
// This allows us to inject descriptions/icons that might not be in the registry or need styling
const ROUTE_METADATA: Record<
  string,
  { description?: string; iconBg?: string; iconColor?: string; icon?: LucideIcon }
> = {
  // ========== MASTERS ==========
  departments: {
    description: 'Manage departments and roles',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  'notifications-master': {
    description: 'Configure notification settings',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  employees: {
    description: 'Manage employee records',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  units: {
    description: 'Manage measurement units',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  'master-product': {
    description: 'Base product definitions',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  'product-sub-master': {
    description: 'Manage finished goods',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  terms: {
    description: 'Terms and conditions templates',
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-600',
  },
  'quotation-master': {
    description: 'Manage quotation templates',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  customers: {
    description: 'Customer database',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
  },
  'customer-types': {
    description: 'Manage customer types',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  development: {
    description: 'Product R&D and formulation',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  'double-development': {
    description: '2K product development',
    iconBg: 'bg-fuchsia-50',
    iconColor: 'text-fuchsia-600',
  },
  'update-product': {
    description: 'Update product details',
    iconBg: 'bg-lime-50',
    iconColor: 'text-lime-600',
  },
  'quotation-maker': {
    description: 'Create and manage quotations',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },

  // ========== OPERATIONS ==========
  'create-order': {
    description: 'Create new sales orders',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  'admin-accounts': {
    description: 'Review and approve orders',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  'accepted-orders': {
    description: 'Orders ready for production',
    iconBg: 'bg-yellow-50',
    iconColor: 'text-yellow-600',
  },
  'pm-dashboard': {
    description: 'Production planning overview',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },

  'dispatch-planning': {
    description: 'Plan dispatches',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  'delivery-status': {
    description: 'Track and complete deliveries',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  'cancel-order': {
    description: 'Cancel existing orders',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },

  'create-batch': {
    description: 'Create and schedule batches',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  'pm-inward': {
    description: 'Material inward management',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  'split-order': {
    description: 'Split orders into parts',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  discard: {
    description: 'Manage material discards',
    iconBg: 'bg-zinc-50',
    iconColor: 'text-zinc-600',
  },
  'field-intelligence': {
    description: 'Smart CRM Operations and Business Intelligence',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    icon: Cpu,
  },
  crm: {
    description: 'Customer Relationship Management',
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
  },

  // ========== REPORTS ==========
  'batch-report': {
    description: 'View production batches',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  'new-batch-report': {
    description: 'New batch production report',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  'material-inward-report': {
    description: 'Material inward records',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  'stock-report': {
    description: 'Current inventory status',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  'customer-contact-report': {
    description: 'Customer contact list',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  'pl-report': {
    description: 'Profit and loss statements',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  'customer-sales-report': {
    description: 'Sales by customer',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
  },
  'cancelled-orders-report': {
    description: 'View cancelled orders',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  'product-wise-report': {
    description: 'Product-wise analytics',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  'low-stock-report': {
    description: 'Items below minimum level',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  'inward-outward-report': {
    description: 'Inward/outward transactions',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  'report-test-certificate': {
    description: 'View and Download Approved Test Certificates',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },

  // ========== SETTINGS ==========
  'permission-management': {
    description: 'Manage system permissions',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  'lock-user': {
    description: 'Lock or unlock user accounts',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  'password-reset': {
    description: 'Force reset user passwords',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  'customer-transfer': {
    description: 'Transfer customers between accounts',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  'notification-rules': {
    description: 'Configure notification rules',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
};

interface SortableRouteCardProps {
  route: RouteNode;
  isEditing: boolean;
  navigate: (path: string) => void;
}

const SortableRouteCard: React.FC<SortableRouteCardProps> = ({ route, isEditing, navigate }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: route.id,
    disabled: !isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const meta = ROUTE_METADATA[route.id] || {};
  const DisplayIcon = route.icon || meta.icon || DEFAULT_META.icon;
  const bgClass = meta.iconBg || DEFAULT_META.iconBg;
  const colorClass = meta.iconColor || DEFAULT_META.iconColor;
  // Central display metadata wins; existing local description stays as fallback.
  const desc = getModuleDescriptionByPath(route.path, meta.description || DEFAULT_META.description);
  const displayTitle = getModuleTitleByPath(route.path, route.label);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isEditing ? { ...attributes, ...listeners } : {})}
      className={cn(
        'card p-6 group relative select-none',
        MODULE_CARD_SIZE,
        isEditing
          ? 'border-2 border-dashed border-[var(--primary)]/60 bg-[var(--surface-highlight)]/10 cursor-grab active:cursor-grabbing hover:border-[var(--primary)] hover:shadow-md transition-shadow'
          : 'hover-lift cursor-pointer'
      )}
      onClick={() => {
        if (!isEditing) navigate(route.path);
      }}
    >
      {isEditing && (
        <div className="absolute top-2 right-2 p-1 text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-md opacity-70 group-hover:opacity-100 transition-opacity">
          <GripHorizontal className="h-4 w-4 text-[var(--primary)]" />
        </div>
      )}
      <div className={cn('flex flex-col h-full', isDragging && 'opacity-50')}>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${bgClass} ${colorClass}`}
        >
          <DisplayIcon size={24} />
        </div>

        <h3
          className={cn(
            'font-bold text-[var(--text-primary)] mb-2 uppercase text-sm tracking-wide',
            MODULE_CARD_TITLE_CLAMP
          )}
        >
          {displayTitle}
        </h3>

        <p
          className={cn(
            'text-sm text-[var(--text-secondary)] flex-grow',
            MODULE_CARD_DESCRIPTION_CLAMP
          )}
        >
          {desc}
        </p>
      </div>
    </div>
  );
};

export const DynamicChildDashboard: React.FC<DynamicChildDashboardProps> = ({
  parentPath,
  title,
  description,
  icon: TitleIcon,
}) => {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<RouteNode[]>([]);

  // Find the parent route
  const parentRoute = findRouteByPath(routeRegistry, parentPath);

  // If parent logic wasn't found or has no children
  const routes = parentRoute?.children || [];

  // Filter based on permissions
  const visibleRoutes = useMemo(() => {
    return routes.filter((route: RouteNode) => {
      if (route.id === 'crm') return false;
      if (route.showInSidebar === false) return false;
      if (!route.permission) return true;
      return hasPermission(route.permission.module, 'view');
    });
  }, [routes, hasPermission]);

  const storageKey = `morex_tab_order_${user?.EmployeeID || 'default'}_${parentPath}`;

  // Initialize and sort items based on localStorage custom order
  useEffect(() => {
    const savedOrder = localStorage.getItem(storageKey);
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder) as string[];
        const sorted = [...visibleRoutes].sort((a, b) => {
          const idxA = orderIds.indexOf(a.id);
          const idxB = orderIds.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setItems(sorted);
      } catch (e) {
        console.error('Failed to parse saved tab order', e);
        setItems(visibleRoutes);
      }
    } else {
      setItems(visibleRoutes);
    }
  }, [visibleRoutes, storageKey]);

  const isAdmin =
    user?.Role?.toLowerCase() === 'admin' || user?.Role?.toLowerCase() === 'superadmin';

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
        const oldIndex = prev.findIndex(item => item.id === active.id);
        const newIndex = prev.findIndex(item => item.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    const orderIds = items.map(item => item.id);
    localStorage.setItem(storageKey, JSON.stringify(orderIds));
    setIsEditing(false);
  };

  const handleCancel = () => {
    const savedOrder = localStorage.getItem(storageKey);
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder) as string[];
        const sorted = [...visibleRoutes].sort((a, b) => {
          const idxA = orderIds.indexOf(a.id);
          const idxB = orderIds.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setItems(sorted);
      } catch {
        setItems(visibleRoutes);
      }
    } else {
      setItems(visibleRoutes);
    }
    setIsEditing(false);
  };

  const handleReset = async () => {
    if (
      await confirmDialog({
        title: 'Reset Tabs',
        message: 'Reset tabs to default order?',
        confirmLabel: 'Continue',
        variant: 'warning',
      })
    ) {
      localStorage.removeItem(storageKey);
      setItems(visibleRoutes);
      setIsEditing(false);
    }
  };

  // Default values if not provided via props
  const pageTitle =
    title || getModuleTitleByPath(parentRoute?.path, parentRoute?.label) || 'Dashboard';
  const pageDesc = description || `Manage ${pageTitle.toLowerCase()} and view details.`;
  const PageIcon = TitleIcon || parentRoute?.icon || LayoutDashboard;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <PageIcon className="h-8 w-8 text-[var(--primary)]" />
            {pageTitle}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">{pageDesc}</p>
        </div>
        {isAdmin && visibleRoutes.length > 1 && (
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(item => item.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
            {items.map((route: RouteNode) => (
              <SortableRouteCard
                key={route.id}
                route={route}
                isEditing={isEditing}
                navigate={navigate}
              />
            ))}

            {items.length === 0 && (
              <div className="col-span-full p-12 text-center border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-highlight)]/5">
                <AlertCircle className="h-10 w-10 text-[var(--text-secondary)] mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  No Accessible Modules
                </h3>
                <p className="text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
                  You don&apos;t have permission to access any modules in this section. Please
                  contact your administrator.
                </p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
