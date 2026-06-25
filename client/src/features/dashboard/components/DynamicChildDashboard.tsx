import React from 'react';
import {
  AlertCircle,
  LucideIcon,
  LayoutDashboard,
  Database,
  BarChart3,
  Factory,
  Cpu,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { routeRegistry, findRouteByPath, RouteNode } from '@/config/routeRegistry';

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

export const DynamicChildDashboard: React.FC<DynamicChildDashboardProps> = ({
  parentPath,
  title,
  description,
  icon: TitleIcon,
}) => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { user } = useAuth();

  // Find the parent route
  const parentRoute = findRouteByPath(routeRegistry, parentPath);

  // If parent logic wasn't found or has no children
  const routes = parentRoute?.children || [];

  // Filter based on permissions
  const visibleRoutes = routes.filter((route: RouteNode) => {
    if (route.id === 'crm') return false;

    // 1. If not supposed to show in sidebar, likely shouldn't be a primary card either?
    // Actually, some detailed views might be hidden from sidebar. Typically dashboard cards link to main sidebar items.
    // Let's filter out explicit "showInSidebar: false" unless we want exceptions.
    // However, user asked for dynamic cards. Usually cards = sidebar items.
    if (route.showInSidebar === false) return false;

    // 2. Permission Check
    if (!route.permission) return true;
    return hasPermission(route.permission.module, 'view');
  });

  // Default values if not provided via props
  const pageTitle = title || parentRoute?.label || 'Dashboard';
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleRoutes.map((route: RouteNode) => {
          const meta = ROUTE_METADATA[route.id] || {};
          const DisplayIcon = route.icon || meta.icon || DEFAULT_META.icon;
          const bgClass = meta.iconBg || DEFAULT_META.iconBg;
          const colorClass = meta.iconColor || DEFAULT_META.iconColor;
          const desc = meta.description || DEFAULT_META.description;

          return (
            <div
              key={route.id}
              className="card hover-lift p-6 group relative cursor-pointer"
              onClick={() => navigate(route.path)}
            >
              <div className="flex flex-col h-full">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${bgClass} ${colorClass}`}
                >
                  <DisplayIcon size={24} />
                </div>

                <h3 className="font-bold text-[var(--text-primary)] mb-2 uppercase text-sm tracking-wide">
                  {route.label}
                </h3>

                <p className="text-sm text-[var(--text-secondary)] flex-grow">{desc}</p>

                <div className="mt-4 flex items-center text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Open Module
                  <svg
                    className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1"
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
              </div>
            </div>
          );
        })}

        {visibleRoutes.length === 0 && (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-highlight)]/5">
            <AlertCircle className="h-10 w-10 text-[var(--text-secondary)] mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-[var(--text-primary)]">
              No Accessible Modules
            </h3>
            <p className="text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
              You don&apos;t have permission to access any modules in this section. Please contact
              your administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
