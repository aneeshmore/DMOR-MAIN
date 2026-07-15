/**
 * Route Registry - Single Source of Truth
 *
 * This file consolidates:
 * - Client-side routing
 * - Sidebar navigation (auto-generated)
 * - Permission requirements (for authorization)
 * - API dependencies (for permission management)
 *
 * Structure:
 * - Routes are organized in a nested hierarchy
 * - Each route can specify required permissions
 * - Sidebar is auto-generated from visible routes
 * - API dependencies use METHOD:route format for permission checking
 */

import { ComponentType, lazy } from 'react';
import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Database,
  Factory,
  Settings,
  BarChart3,
  Users,
  Briefcase,
  Building,
  Package,
  FileText,
  UserPlus,
  Truck,
  ShoppingCart,
  Bell,
  XCircle,
  MapPin,
  ArrowLeftRight,
  Ruler,
  FlaskConical,
  RefreshCw,
  TrendingUp,
  CalendarClock,
  Download,
  GitFork,
  Trash2,
  Archive,
  DollarSign,
  PieChart,
  AlertCircle,
  Shield,
  Lock,
  KeyRound,
  ArrowRightLeft,
  Cpu,
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * API Dependency - defines an API endpoint used by a UI route
 */
export interface ApiDependency {
  /** API route path (e.g., '/orders', '/orders/:id') */
  route: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Human-readable short label for UI display */
  label: string;
  /** Whether enabled by default when permission granted (default: true) */
  defaultEnabled?: boolean;
}

/**
 * Route Permission - simplified to just module name
 */
export interface RoutePermission {
  /** Module/resource name (e.g., 'orders', 'customers') */
  module: string;
}

export interface RouteNode {
  /** Unique identifier for the route */
  id: string;
  /** URL path */
  path: string;
  /** Display label for sidebar */
  label: string;
  /** Icon for sidebar */
  icon?: LucideIcon;
  /** React component (can be lazy loaded) */
  component?: ComponentType<any>;
  /** Child routes (for nested navigation) */
  children?: RouteNode[];
  /** Permission requirements */
  permission?: RoutePermission;
  /** API dependencies this page uses */
  apis?: ApiDependency[];
  /** Whether to show in sidebar (default: true if has label) */
  showInSidebar?: boolean;
  /** Whether this is a redirect-only route */
  redirect?: string;
  /** Group for organizing in sidebar */
  group?: string;
}

// Export NavItem as alias for RouteNode for backward compatibility
export type NavItem = RouteNode;

// Navigation types (for sidebar compatibility)
export interface NavSubItem {
  id: string;
  label: string;
  path: string;
  icon?: LucideIcon;
  permission?: RoutePermission;
}

// ============================================
// LAZY IMPORTS FOR CODE SPLITTING
// ============================================

// Dashboard
const Dashboard = lazy(() =>
  import('@/features/dashboard/pages/Dashboard').then(module => ({ default: module.Dashboard }))
);
const AdminDashboard = lazy(() => import('@/features/dashboard/pages/AdminDashboard'));
const DynamicRoleDashboard = lazy(() =>
  import('@/features/dashboard/pages/DynamicRoleDashboard').then(module => ({
    default: module.DynamicRoleDashboard,
  }))
);

// Reports
const ReportsDashboard = lazy(() => import('@/features/reports/pages/ReportsDashboard'));
const CustomerContactReport = lazy(() => import('@/features/reports/pages/CustomerContactReport'));
const CustomerReport = lazy(() => import('@/features/reports/pages/CustomerReport'));
const CancelledOrdersReport = lazy(() => import('@/features/reports/pages/CancelledOrdersReport'));
const ProfitLossReport = lazy(() => import('@/features/reports/pages/ProfitLossReport'));
const BatchProductionReport = lazy(() => import('@/features/reports/pages/BatchProductionReport'));
const NewBatchProductionReport = lazy(
  () => import('@/features/reports/pages/NewBatchProductionReport')
);
const MaterialInwardReport = lazy(() => import('@/features/reports/pages/MaterialInwardReport'));
const StockReport = lazy(() => import('@/features/reports/pages/StockReport'));
const LowStockReport = lazy(() => import('@/features/reports/pages/LowStockReport'));
const ProductWiseReport = lazy(() => import('@/features/reports/pages/ProductWiseReport'));
const DailyConsumptionReport = lazy(
  () => import('@/features/reports/pages/DailyConsumptionReport')
);
const TestCertificateReportList = lazy(
  () => import('@/modules/test-certificate/TestCertificateReportList')
);
const TestCertificateReportView = lazy(
  () => import('@/modules/test-certificate/TestCertificateReportView')
);
// Masters
const MastersDashboard = lazy(() => import('@/features/masters/pages/MastersDashboard'));
const DepartmentMaster = lazy(() => import('@/features/masters/pages/DepartmentMaster'));
const UnitMaster = lazy(() => import('@/features/masters/pages/UnitMaster'));
const EmployeeMaster = lazy(() => import('@/features/employees/pages/EmployeeMaster'));
const ProductMaster = lazy(() => import('@/features/master-products/pages/ProductMaster'));
const MasterProduct = lazy(() => import('@/features/masters/pages/MasterProduct'));
const CustomerMaster = lazy(() => import('@/features/masters/pages/CustomerMaster'));
const CustomerTypeMaster = lazy(() => import('@/features/masters/pages/CustomerTypeMaster'));
const SupplierMaster = lazy(() => import('@/features/masters/pages/SupplierMaster'));
const ProductDevelopment = lazy(() => import('@/features/masters/pages/ProductDevelopment'));
const DoubleProductDevelopment = lazy(
  () => import('@/features/masters/pages/DoubleProductDevelopment')
);
const QuotationMasterPage = lazy(() => import('@/features/masters/pages/QuotationMasterPage'));
const TncPage = lazy(() => import('@/features/tnc/pages/TncPage'));
const UpdateProduct = lazy(() => import('@/features/update-product/UpdateProduct'));
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage'));

// Operations
const OperationsDashboard = lazy(() => import('@/features/production/pages/OperationsDashboard'));
const CreateOrderPage = lazy(() => import('@/features/orders/pages/CreateOrderPage'));
const OrderDetailPage = lazy(() => import('@/features/orders/pages/OrderDetailPage'));
const AccountsDashboard = lazy(() => import('@/features/admin-accounts/pages/AccountsDashboard'));
const AdminSalesDashboard = lazy(
  () => import('@/features/admin-accounts/pages/AdminSalesDashboard')
);
const AcceptedOrdersPage = lazy(
  () => import('@/features/production-manager/pages/AcceptedOrdersPage')
);
const PMPlanningDashboard = lazy(
  () => import('@/features/production-manager/pages/PMPlanningDashboard')
);
const DispatchPlanning = lazy(() => import('@/features/dispatch-planning/pages/DispatchPlanning'));
const ScheduleBatchPage = lazy(
  () => import('@/features/production-manager/pages/ScheduleBatchPage')
);
const InwardDashboard = lazy(() =>
  import('@/features/Inward').then(m => ({ default: m.InwardDashboard }))
);
const SplitOrderPage = lazy(() => import('@/features/split-orders/pages/SplitOrderPage'));
const DiscardDashboard = lazy(() =>
  import('@/features/Discard').then(m => ({ default: m.DiscardDashboard }))
);
const CancelOrderPage = lazy(() => import('@/features/cancel-order/pages/CancelOrderPage'));
const QuotationMaker = lazy(() => import('@/features/quotations/pages/QuotationMaker'));
const DeliveryComplete = lazy(() =>
  import('@/features/delivery-complete/pages/DeliveryComplete').then(m => ({
    default: m.DeliveryComplete,
  }))
);
const CreatePurchaseOrderPage = lazy(
  () => import('@/features/purchase-orders/pages/CreatePurchaseOrderPage')
);
const InwardFromPurchaseOrderPage = lazy(
  () => import('@/features/inward-from-po/pages/InwardFromPurchaseOrderPage')
);

// CRM
const CrmDashboard = lazy(() =>
  import('@/features/crm/pages').then(m => ({ default: m.CrmDashboard }))
);
const NewVisitPage = lazy(() =>
  import('@/features/crm/pages').then(m => ({ default: m.NewVisitPage }))
);

// Field Intelligence
const FieldIntelligenceDashboard = lazy(
  () => import('@/modules/field-intelligence/FieldIntelligenceDashboardPage')
);
const FieldIntelligenceList = lazy(
  () => import('@/modules/field-intelligence/FieldIntelligenceListPage')
);
const FieldIntelligenceCreate = lazy(
  () => import('@/modules/field-intelligence/FieldIntelligenceCreatePage')
);
const FieldIntelligenceEdit = lazy(
  () => import('@/modules/field-intelligence/FieldIntelligenceEditPage')
);
const FieldIntelligenceView = lazy(
  () => import('@/modules/field-intelligence/FieldIntelligenceViewPage')
);
const CustomerDashboard = lazy(() => import('@/modules/field-intelligence/CustomerDashboardPage'));

// Test Certificate
const TestCertificateDashboard = lazy(
  () => import('@/modules/test-certificate/TestCertificateDashboardPage')
);
const TestCertificateList = lazy(
  () => import('@/modules/test-certificate/TestCertificateListPage')
);
const TestCertificateCreate = lazy(
  () => import('@/modules/test-certificate/TestCertificateCreatePage')
);
const TestCertificateEdit = lazy(
  () => import('@/modules/test-certificate/TestCertificateEditPage')
);
const TestCertificateView = lazy(
  () => import('@/modules/test-certificate/TestCertificateViewPage')
);

// Settings
const SettingsDashboard = lazy(() => import('@/features/settings/pages/SettingsDashboard'));

const LockUserPage = lazy(() => import('@/features/settings/pages/LockUserPage'));
const ResetPasswordPage = lazy(() => import('@/features/settings/pages/ResetPasswordPage'));
const CustomerTransferPage = lazy(() => import('@/features/settings/pages/CustomerTransferPage'));
const CompanySettingsPage = lazy(() => import('@/features/company/pages/CompanySettingsPage'));

// Payments
const PaymentEntry = lazy(() => import('@/features/operations/pages/PaymentEntry'));

const PaymentReport = lazy(() => import('@/features/reports/pages/PaymentReport'));

const SalespersonRevenueReport = lazy(
  () => import('@/features/reports/pages/SalespersonRevenueReport')
);

// const SalespersonIncentiveReport = lazy(
//   () => import('@/features/reports/pages/SalespersonIncentiveReport')
// );

// Dashboard Redirect
const DashboardRedirect = lazy(() =>
  import('@/features/dashboard/components/DashboardRedirect').then(module => ({
    default: module.DashboardRedirect,
  }))
);

// ============================================
// ROUTE REGISTRY
// ============================================

export const routeRegistry: RouteNode[] = [
  // ========== DASHBOARD ==========
  {
    id: 'dashboard-redirect',
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    component: DashboardRedirect,
    group: 'Main',
  },
  {
    id: 'admin-dashboard',
    path: '/dashboard/admin',
    label: 'Dashboard',
    component: Dashboard,
    group: 'Main',
    apis: [{ route: '/dashboard/stats', method: 'GET', label: 'Load Dashboard Stats' }],
    showInSidebar: false,
  },
  {
    id: 'dynamic-dashboard',
    path: '/dashboard/:role',
    label: 'Role Dashboard',
    icon: LayoutDashboard,
    component: DynamicRoleDashboard,
    group: 'Main',
    permission: { module: 'dashboard' },
    showInSidebar: false,
    apis: [{ route: '/dashboard/stats', method: 'GET', label: 'Load Dashboard Stats' }],
  },
  {
    id: 'sales-access',
    path: '/sales-access',
    label: 'Sales Access',
    icon: Users,
    group: 'Sales',
    showInSidebar: false,
    permission: { module: 'sales_access' },
    apis: [
      {
        route: 'view_all_sales_persons',
        method: 'GET',
        label: 'View All Sales Persons',
      },
    ],
  },

  // ========== MASTERS ==========
  {
    id: 'masters',
    path: '/masters',
    label: 'Masters',
    icon: Database,
    component: MastersDashboard,
    group: 'Main',
    children: [
      {
        id: 'departments',
        path: '/masters/departments',
        label: 'Department',
        icon: Briefcase,
        component: DepartmentMaster,
        permission: { module: 'departments' },
        apis: [
          { route: '/masters/departments', method: 'GET', label: 'View Departments' },
          { route: '/masters/departments', method: 'POST', label: 'Create Department' },
          { route: '/masters/departments/:id', method: 'PUT', label: 'Update Department' },
          { route: '/masters/departments/:id', method: 'DELETE', label: 'Delete Department' },
        ],
      },
      {
        id: 'notifications-master',
        path: '/masters/notifications',
        label: 'Notification Management',
        icon: Bell,
        component: NotificationsPage,
        permission: { module: 'notifications' },
        apis: [
          { route: '/notifications', method: 'GET', label: 'View Notifications' },
          { route: '/notifications/:id', method: 'PATCH', label: 'Mark Read/Acknowledge' },
          { route: '/notifications/:id', method: 'DELETE', label: 'Delete Notification' },
          { route: '/notifications/all', method: 'GET', label: 'View All (Admin)' },
        ],
      },
      {
        id: 'employees',
        path: '/masters/employees',
        label: 'Employee Master',
        icon: Users,
        component: EmployeeMaster,
        permission: { module: 'employees' },
        apis: [
          { route: '/employees', method: 'GET', label: 'View Employees' },
          { route: '/employees', method: 'POST', label: 'Create Employee' },
          { route: '/employees/:id', method: 'PUT', label: 'Update Employee' },
          { route: '/masters/departments', method: 'GET', label: 'Load Departments' },
          { route: '/roles', method: 'GET', label: 'Load Roles' },
        ],
      },
      {
        id: 'units',
        path: '/masters/units',
        label: 'Unit Master',
        icon: Ruler,
        component: UnitMaster,
        permission: { module: 'units' },
        apis: [
          { route: '/masters/units', method: 'GET', label: 'View Units' },
          { route: '/masters/units', method: 'POST', label: 'Create Unit' },
          { route: '/masters/units/:id', method: 'PUT', label: 'Update Unit' },
        ],
      },
      {
        id: 'master-product',
        path: '/masters/master-product',
        label: 'Product Master',
        icon: Package,
        component: MasterProduct,
        permission: { module: 'master-product' },
        apis: [
          { route: '/catalog/master-products', method: 'GET', label: 'View Master Products' },
          { route: '/catalog/master-products', method: 'POST', label: 'Create Master Product' },
          { route: '/catalog/master-products/:id', method: 'PUT', label: 'Update Master Product' },
        ],
      },
      {
        id: 'product-sub-master',
        path: '/masters/product-sub-master',
        label: 'Sub Product Master',
        icon: Database,
        component: ProductMaster,
        permission: { module: 'products' },
        apis: [
          { route: '/inventory/products', method: 'GET', label: 'View Products' },
          { route: '/inventory/products', method: 'POST', label: 'Create Product' },
          { route: '/inventory/products/:id', method: 'PUT', label: 'Update Product' },
        ],
      },
      {
        id: 'terms',
        path: '/masters/terms',
        label: 'Quotation Terms and Conditions',
        icon: FileText,
        component: TncPage,
        permission: { module: 'tnc' },
        apis: [
          { route: '/tnc', method: 'GET', label: 'View Terms' },
          { route: '/tnc', method: 'POST', label: 'Create Term' },
          { route: '/tnc/:id', method: 'PUT', label: 'Update Term' },
          { route: '/tnc/:id', method: 'DELETE', label: 'Delete Term' },
        ],
      },

      {
        id: 'customers',
        path: '/masters/customers',
        label: 'Add New Customer',
        icon: UserPlus,
        component: CustomerMaster,
        permission: { module: 'Add New Customer' },
        apis: [
          { route: '/masters/customers', method: 'GET', label: 'View Customers' },
          { route: '/masters/customers', method: 'POST', label: 'Create Customer' },
          { route: '/masters/customers/:id', method: 'PUT', label: 'Update Customer' },
          { route: '/employees', method: 'GET', label: 'Load Sales Persons' },
          { route: '/masters/customer-types', method: 'GET', label: 'Load Customer Types' },
        ],
      },
      {
        id: 'customer-types',
        path: '/masters/customer-types',
        label: 'Customer Type Master',
        icon: Users,
        component: CustomerTypeMaster,
        permission: { module: 'customer-types' },
        apis: [
          { route: '/masters/customer-types', method: 'GET', label: 'View Customer Types' },
          { route: '/masters/customer-types', method: 'POST', label: 'Create Customer Type' },
          { route: '/masters/customer-types/:id', method: 'PUT', label: 'Update Customer Type' },
        ],
      },
      {
        id: 'suppliers',
        path: '/masters/suppliers',
        label: 'Create Vendor/Supplier',
        icon: Truck,
        component: SupplierMaster,
        permission: { module: 'suppliers' },
        apis: [
          { route: '/suppliers', method: 'GET', label: 'View Suppliers' },
          { route: '/suppliers', method: 'POST', label: 'Create Supplier' },
          { route: '/suppliers/:id', method: 'PUT', label: 'Update Supplier' },
          { route: '/suppliers/:id', method: 'DELETE', label: 'Delete Supplier' },
        ],
      },
      {
        id: 'development',
        path: '/masters/development',
        label: '1K Product Development',
        icon: FlaskConical,
        component: ProductDevelopment,
        permission: { module: 'product-development' },
        apis: [
          { route: '/product-development', method: 'GET', label: 'View Development' },
          { route: '/product-development', method: 'POST', label: 'Create Development' },
          { route: '/catalog/master-products', method: 'GET', label: 'View Master Products' },
        ],
      },
      {
        id: 'double-development',
        path: '/masters/double-development',
        label: '2K Product Development',
        icon: FlaskConical,
        component: DoubleProductDevelopment,
        permission: { module: 'double-development' },
        apis: [
          { route: '/product-development/double', method: 'GET', label: 'View Double Development' },
          {
            route: '/product-development/double',
            method: 'POST',
            label: 'Create Double Development',
          },
        ],
      },
      {
        id: 'update-product',
        path: '/masters/update-product',
        label: 'Update Product',
        icon: RefreshCw,
        component: UpdateProduct,
        permission: { module: 'update-product' },
        apis: [
          { route: '/update-product/final-goods', method: 'GET', label: 'View Final Goods' },
          { route: '/update-product/final-goods/:id', method: 'PUT', label: 'Update Final Goods' },
          { route: '/update-product/raw-materials', method: 'GET', label: 'View Raw Materials' },
          {
            route: '/update-product/raw-materials/:id',
            method: 'PUT',
            label: 'Update Raw Materials',
          },
          {
            route: '/update-product/packaging-materials',
            method: 'GET',
            label: 'View Packaging Materials',
          },
          {
            route: '/update-product/packaging-materials/:id',
            method: 'PUT',
            label: 'Update Packaging Materials',
          },
        ],
      },
      {
        id: 'company-details',
        path: '/company-details',
        label: 'Company Details',
        icon: FileText,
        component: lazy(() => import('@/features/company/pages/CompanyDetailsPage')),
        permission: { module: 'quotation-maker' },
        apis: [
          { route: '/company', method: 'GET', label: 'Get Company Details' },
          { route: '/company', method: 'PUT', label: 'Update Company Details' },
        ],
      },
      {
        id: 'quotation-print',
        path: '/quotation-print',
        label: 'Create Quotation',
        component: QuotationMaker,
        showInSidebar: false,
        permission: { module: 'quotation-maker' },
        apis: [
          { route: '/masters/customers', method: 'GET', label: 'Load Customers' },
          { route: '/inventory/products', method: 'GET', label: 'Load Products' },
          { route: '/quotations', method: 'POST', label: 'Create Quotation' },
        ],
      },
    ],
  },

  // ========== OPERATIONS ==========
  {
    id: 'operations',
    path: '/operations',
    label: 'Operations',
    icon: Factory,
    component: OperationsDashboard,
    group: 'Main',
    children: [
      {
        id: 'create-order',
        path: '/operations/create-order',
        label: 'Create & Manage Orders/Quotations',
        icon: ShoppingCart,
        component: CreateOrderPage,
        permission: { module: 'orders' },
        apis: [
          { route: '/masters/customers/active-list', method: 'GET', label: 'Load Customers' },
          { route: '/employees', method: 'GET', label: 'Load Salespersons' },
          { route: '/inventory/products', method: 'GET', label: 'Load Products' },
          { route: '/tnc', method: 'GET', label: 'Load Terms & Conditions' },
          { route: '/quotations', method: 'GET', label: 'View Quotations' },
          { route: '/quotations', method: 'POST', label: 'Create Quotation' },
          { route: '/quotations/:id', method: 'PUT', label: 'Update Quotation' },
          { route: '/quotations/:id/convert', method: 'POST', label: 'Convert to Order' },
          { route: '/orders', method: 'GET', label: 'View Orders' },
          { route: '/orders', method: 'POST', label: 'Create Order' },
          { route: '/orders/:id', method: 'GET', label: 'View Order Details' },
          { route: '/orders/:id', method: 'PUT', label: 'Update Order' },
          {
            route: '/product-development/ratios/:baseMpId/:hardenerMpId',
            method: 'GET',
            label: 'Get Mixing Ratios',
          },
        ],
      },
      {
        id: 'create-purchase-order',
        path: '/operations/purchase-orders',
        label: 'Create Purchase Order',
        icon: ShoppingCart,
        component: CreatePurchaseOrderPage,
        permission: { module: 'purchase-orders' },
        apis: [
          { route: '/purchase-orders', method: 'GET', label: 'View Purchase Orders' },
          { route: '/purchase-orders', method: 'POST', label: 'Create Purchase Order' },
          { route: '/purchase-orders/:id', method: 'GET', label: 'View Purchase Order Details' },
          { route: '/purchase-orders/:id', method: 'PUT', label: 'Update Purchase Order' },
          { route: '/purchase-orders/:id', method: 'DELETE', label: 'Delete Purchase Order' },
          { route: '/suppliers', method: 'GET', label: 'Load Vendors' },
        ],
      },
      {
        id: 'inward-from-purchase-order',
        path: '/operations/inward-from-po',
        label: 'Inward From PO',
        icon: ArrowLeftRight,
        component: InwardFromPurchaseOrderPage,
        permission: { module: 'inward-from-po' },
        apis: [
          { route: '/inward-from-po', method: 'GET', label: 'View Inward from PO' },
          { route: '/inward-from-po', method: 'POST', label: 'Create Inward from PO' },
          { route: '/inward-from-po/:id', method: 'GET', label: 'View Inward from PO Details' },
          { route: '/inward-from-po/:id', method: 'DELETE', label: 'Delete Inward from PO' },
          { route: '/purchase-orders', method: 'GET', label: 'View Purchase Orders' },
          { route: '/purchase-orders/:id', method: 'GET', label: 'View Purchase Order Details' },
          { route: '/catalog/master-products', method: 'GET', label: 'Load Products' },
          { route: '/masters/units', method: 'GET', label: 'Load Units' },
        ],
      },
      {
        id: 'quotation-master',
        path: '/operations/quotation-requests', // Updated path for consistency
        label: 'Quotation Requests', // Renamed
        icon: FileText,
        component: QuotationMasterPage,
        permission: { module: 'quotations' },
        apis: [
          { route: '/quotations', method: 'GET', label: 'View Quotations' },
          { route: '/catalog/products/type/:type', method: 'GET', label: 'View Products' },
          { route: '/catalog/master-products', method: 'GET', label: 'View Master Products' },
          { route: '/quotations/:id/approve', method: 'POST', label: 'Approve Quotation' },
          { route: '/quotations/:id/reject', method: 'POST', label: 'Reject Quotation' },
        ],
      },
      {
        id: 'admin-accounts',
        path: '/operations/admin-accounts',
        label: 'Order Approval by Accounts',
        icon: Briefcase,
        component: AccountsDashboard,
        permission: { module: 'admin-accounts' },
        apis: [
          { route: '/admin-accounts/:id', method: 'GET', label: 'View Order Details' },
          {
            route: '/admin-accounts/pending-payments',
            method: 'GET',
            label: 'View Pending Payments',
          },
          {
            route: '/admin-accounts/pending-payments/:id',
            method: 'PUT',
            label: 'Update Payment Status',
          },
          {
            route: '/admin-accounts/cancelled-orders',
            method: 'GET',
            label: 'View Cancelled Orders',
          },
          { route: '/admin-accounts/:id/hold', method: 'PUT', label: 'Hold Order' },
          { route: '/admin-accounts/:id/accept', method: 'POST', label: 'Accept Order' },
          { route: '/admin-accounts/:id/reject', method: 'PUT', label: 'Reject Order' },
          { route: '/admin-accounts/:id/bill-no', method: 'PUT', label: 'Update Bill No' },
          { route: '/admin-accounts/:id/resume', method: 'PUT', label: 'Resume Order' },
        ],
      },
      {
        id: 'payment-entry',
        path: '/operations/payment-entry',
        label: 'Payment Entry',
        icon: DollarSign,
        component: PaymentEntry,
        permission: { module: 'payment-entry' },
        apis: [
          { route: '/payments', method: 'POST', label: 'Create Payment' },
          { route: '/payments', method: 'GET', label: 'View Payments' },
          { route: '/masters/customers', method: 'GET', label: 'Load Customers' },
        ],
      },
      {
        id: 'sales-dashboard',
        path: '/operations/sales-dashboard',
        label: 'Sales Dashboard',
        icon: TrendingUp,
        component: AdminSalesDashboard,
        permission: { module: 'sales-dashboard' },
        showInSidebar: false,
        apis: [
          { route: '/admin-accounts/sales-summary', method: 'GET', label: 'View Sales Summary' },
        ],
      },
      {
        id: 'accepted-orders',
        path: '/operations/accept-orders',
        label: 'Accept Order at Factory',
        icon: Factory,
        component: AcceptedOrdersPage,
        permission: { module: 'accepted-orders' },
        apis: [
          {
            route: '/production-manager/accepted-orders',
            method: 'GET',
            label: 'View Accepted Orders',
          },
          {
            route: '/production-manager/check-inventory',
            method: 'POST',
            label: 'Check Inventory',
          },
          { route: '/production-manager/orders/:id', method: 'GET', label: 'View Order Details' },
          { route: '/production-manager/orders/:id', method: 'PUT', label: 'Update Order' },
          {
            route: '/production-manager/orders/:id/send-to-dispatch',
            method: 'POST',
            label: 'Send to Dispatch',
          },
          { route: '/production-manager/auto-schedule', method: 'POST', label: 'Auto Schedule' },
        ],
      },
      {
        id: 'pm-dashboard',
        path: '/operations/pm-dashboard',
        label: 'PM Dashboard',
        icon: LayoutDashboard,
        component: PMPlanningDashboard,
        permission: { module: 'production-manager' },
        apis: [
          {
            route: '/production-manager/planning-dashboard',
            method: 'GET',
            label: 'View Planning Dashboard',
          },
          { route: '/production-manager/batches', method: 'GET', label: 'View Batches' },
          {
            route: '/production-manager/batchable-orders',
            method: 'GET',
            label: 'View Batchable Orders',
          },
          {
            route: '/production-manager/check-group-feasibility',
            method: 'POST',
            label: 'Check Group Feasibility',
          },
        ],
      },

      {
        id: 'dispatch-planning',
        path: '/operations/dispatch-planning',
        label: 'Dispatch Planning',
        icon: Settings,
        component: DispatchPlanning,
        permission: { module: 'dispatch-planning' },
        apis: [
          { route: '/dispatch-planning/queue', method: 'GET', label: 'View Dispatch Queue' },
          {
            route: '/dispatch-planning/returned-queue',
            method: 'GET',
            label: 'View Returned Queue',
          },
          { route: '/dispatch-planning/create', method: 'POST', label: 'Create Dispatch' },
          { route: '/dispatch-planning/:id/requeue', method: 'PATCH', label: 'Requeue Order' },
          {
            route: '/production-manager/planning-dashboard',
            method: 'GET',
            label: 'Get Planning Dashboard',
          },
        ],
      },
      {
        id: 'delivery-status',
        path: '/operations/delivery-complete',
        label: 'Return Delivery',
        icon: Truck,
        component: DeliveryComplete,
        permission: { module: 'delivery-complete' },
        apis: [
          { route: '/dispatch', method: 'GET', label: 'View Dispatched Orders' },
          { route: '/delivery-complete/:id/return', method: 'PATCH', label: 'Return Delivery' },
          { route: '/delivery-complete', method: 'GET', label: 'View Delivery Complete' },
        ],
      },
      {
        id: 'cancel-order',
        path: '/operations/cancel-order',
        label: 'Cancel Order',
        icon: XCircle,
        component: CancelOrderPage,
        permission: { module: 'cancel-order' },
        apis: [
          { route: '/cancel-order/cancellable', method: 'GET', label: 'View Cancellable Orders' },
          { route: '/cancel-order/:id/cancel', method: 'PATCH', label: 'Cancel Order' },
          { route: '/cancel-order/cancelled', method: 'GET', label: 'View Cancelled Orders' },
          { route: '/cancel-order/stats', method: 'GET', label: 'View Cancel Order Stats' },
        ],
      },

      {
        id: 'create-batch',
        path: '/operations/create-batch',
        label: 'Create & Manage Batch',
        icon: CalendarClock,
        component: ScheduleBatchPage,
        permission: { module: 'production' },
        apis: [
          { route: '/production-manager/batches', method: 'GET', label: 'View Batches' },
          { route: '/production-manager/batches/:id', method: 'GET', label: 'View Batch' },
          { route: '/production-manager/schedule-batch', method: 'POST', label: 'Schedule Batch' },
          { route: '/production-manager/batches/:id', method: 'PUT', label: 'Update Batch' },
          {
            route: '/production-manager/batches/:id/complete',
            method: 'PUT',
            label: 'Complete Batch',
          },
          { route: '/production-manager/batches/:id/cancel', method: 'PUT', label: 'Cancel Batch' },
          {
            route: '/production-manager/check-inventory',
            method: 'POST',
            label: 'Check Inventory',
          },
          { route: '/bom/calculate', method: 'POST', label: 'Calculate BOM' },
          { route: '/catalog/master-products/:id', method: 'GET', label: 'Load Master Product' },
          { route: '/catalog/master-products', method: 'GET', label: 'Load Master Products' },
          { route: '/product-development/master/:id', method: 'GET', label: 'Load PD Data' },
          // Products require inventory permissions on server
          { route: '/inventory/products', method: 'GET', label: 'Load Products' },
          { route: '/inventory/products/:id', method: 'GET', label: 'Load Product Details' },
          { route: '/employees', method: 'GET', label: 'Load Supervisors' },
        ],
      },
      {
        id: 'pm-inward',
        path: '/operations/pm-inward',
        label: 'All Material Inward',
        icon: Download,
        component: InwardDashboard,
        permission: { module: 'inward' },
        apis: [
          { route: '/inward', method: 'GET', label: 'View Inward Records' },
          { route: '/inward', method: 'POST', label: 'Create Inward' },
          { route: '/catalog/products', method: 'GET', label: 'Load Products' },
          { route: '/masters/units', method: 'GET', label: 'Load Units' },
          { route: '/suppliers', method: 'GET', label: 'Load Suppliers' },
          { route: '/suppliers', method: 'POST', label: 'Create Supplier' },
          { route: '/catalog/master-products', method: 'GET', label: 'Load Raw Materials' },
          { route: '/masters/customers', method: 'GET', label: 'Load Customers' },
        ],
      },
      {
        id: 'split-order',
        path: '/operations/split-order',
        label: 'PM-Split Order',
        icon: GitFork,
        component: SplitOrderPage,
        permission: { module: 'split-order' },
        apis: [
          { route: '/orders', method: 'GET', label: 'View Orders' },
          { route: '/split-orders/:id/split', method: 'POST', label: 'Split Order' },
          { route: '/orders/:id', method: 'GET', label: 'View Order' },
          { route: '/catalog/products', method: 'GET', label: 'Load Products' },
        ],
      },
      {
        id: 'discard',
        path: '/operations/discard',
        label: 'Admin - Material Discard',
        icon: Trash2,
        component: DiscardDashboard,
        permission: { module: 'material-discard' },
        apis: [
          { route: '/discard', method: 'GET', label: 'View Discards' },
          { route: '/discard', method: 'POST', label: 'Create Discard' },
          { route: '/inventory/products', method: 'GET', label: 'Load Products' },
        ],
      },
      {
        id: 'crm',
        path: '/operations/crm',
        label: 'CRM',
        icon: MapPin,
        component: CrmDashboard,
        permission: { module: 'crm' },
        apis: [
          { route: '/crm/visits', method: 'GET', label: 'View Visits' },
          { route: '/crm/visits', method: 'POST', label: 'Create Visit' },
          { route: '/masters/customers', method: 'GET', label: 'Load Customers' },
          { route: '/quotations', method: 'GET', label: 'Load Quotations' },
        ],
        children: [
          {
            id: 'new-visit',
            path: '/operations/crm/new-visit',
            label: 'New Visit',
            component: NewVisitPage,
            permission: { module: 'crm' },
          },
        ],
      },
      {
        id: 'field-intelligence',
        path: '/operations/field-intelligence',
        label: 'SMART CRM',
        icon: Cpu,
        component: FieldIntelligenceList,
        permission: { module: 'field_intelligence' },
        apis: [
          { route: '/field-intelligence', method: 'GET', label: 'View Reports' },
          { route: '/field-intelligence/:id', method: 'GET', label: 'View Report Details' },
          { route: '/field-intelligence', method: 'POST', label: 'Create Report' },
          { route: '/field-intelligence/:id', method: 'PATCH', label: 'Edit Report' },
          { route: '/field-intelligence/:id', method: 'DELETE', label: 'Delete Report' },
          { route: '/field-intelligence/dashboard', method: 'GET', label: 'View Dashboard' },
          { route: '/field-intelligence/export', method: 'GET', label: 'Export Reports' },
          { route: '/field-intelligence/:id/upload', method: 'POST', label: 'Upload File' },
          {
            route: '/field-intelligence/customer-summary',
            method: 'GET',
            label: 'View Customer Summary',
          },
          {
            route: '/field-intelligence/customer/:customerId/history',
            method: 'GET',
            label: 'View Customer History',
          },
          {
            route: '/field-intelligence/customer/:customerId/dashboard',
            method: 'GET',
            label: 'View Customer Dashboard',
          },
          {
            route: '/field-intelligence/customer-unlinked-history',
            method: 'GET',
            label: 'View Customer Unlinked History',
          },
          {
            route: '/field-intelligence/link-customer',
            method: 'POST',
            label: 'Link Customer Reports',
          },
        ],
        children: [
          {
            id: 'field-intelligence-new',
            path: '/operations/field-intelligence/new',
            label: 'New Report',
            component: FieldIntelligenceCreate,
            permission: { module: 'field_intelligence' },
            showInSidebar: false,
          },
          {
            id: 'field-intelligence-edit',
            path: '/operations/field-intelligence/:id/edit',
            label: 'Edit Report',
            component: FieldIntelligenceEdit,
            permission: { module: 'field_intelligence' },
            showInSidebar: false,
          },
          {
            id: 'field-intelligence-customer-dashboard',
            path: '/operations/field-intelligence/customer/:customerId',
            label: 'Customer Intelligence Dashboard',
            component: CustomerDashboard,
            permission: { module: 'field_intelligence' },
            showInSidebar: false,
          },
          {
            id: 'field-intelligence-view',
            path: '/operations/field-intelligence/:id',
            label: 'View Report',
            component: FieldIntelligenceView,
            permission: { module: 'field_intelligence' },
            showInSidebar: false,
          },
          {
            id: 'field-intelligence-dashboard',
            path: '/operations/field-intelligence/dashboard',
            label: 'Dashboard',
            component: FieldIntelligenceDashboard,
            permission: { module: 'field_intelligence' },
            showInSidebar: false,
          },
        ],
      },
      {
        id: 'test-certificate',
        path: '/operations/test-certificate',
        label: 'Test Certificate',
        icon: FileText,
        component: TestCertificateList,
        group: 'Quality',
        permission: { module: 'test_certificate' },
        apis: [
          { route: '/test-certificates', method: 'GET', label: 'View Test Certificates' },
          {
            route: '/test-certificates/:id',
            method: 'GET',
            label: 'View Test Certificate Details',
          },
          { route: '/test-certificates', method: 'POST', label: 'Create Test Certificate' },
          { route: '/test-certificates/:id', method: 'PUT', label: 'Update Test Certificate' },
          { route: '/test-certificates/:id', method: 'DELETE', label: 'Delete Test Certificate' },
          {
            route: '/test-certificates/completed-batches',
            method: 'GET',
            label: 'View Completed Batches',
          },
          {
            route: '/test-certificates/completed-batches/:id',
            method: 'GET',
            label: 'View Completed Batch Details',
          },
        ],
        children: [
          {
            id: 'test-certificate-create',
            path: '/operations/test-certificate/create',
            label: 'Create Test Certificate',
            component: TestCertificateCreate,
            permission: { module: 'test_certificate' },
            showInSidebar: false,
          },
          {
            id: 'test-certificate-edit',
            path: '/operations/test-certificate/:id/edit',
            label: 'Edit Test Certificate',
            component: TestCertificateEdit,
            permission: { module: 'test_certificate' },
            showInSidebar: false,
          },
          {
            id: 'test-certificate-view',
            path: '/operations/test-certificate/:id',
            label: 'View Test Certificate',
            component: TestCertificateView,
            permission: { module: 'test_certificate' },
            showInSidebar: false,
          },
          {
            id: 'test-certificate-dashboard',
            path: '/operations/test-certificate/dashboard',
            label: 'Dashboard',
            component: TestCertificateDashboard,
            permission: { module: 'test_certificate' },
            showInSidebar: false,
          },
        ],
      },
    ],
  },

  // ========== REPORTS ==========
  {
    id: 'reports',
    path: '/reports',
    label: 'Reports',
    icon: BarChart3,
    component: ReportsDashboard,
    group: 'Main',
    // No permission required for parent - sidebar shows/hides based on accessible children
    children: [
      {
        id: 'batch-report',
        path: '/reports/batch-production',
        label: 'Batch Reports For Accounts',
        icon: BarChart3,
        component: BatchProductionReport,
        permission: { module: 'report-batch' },
        apis: [{ route: '/reports/batch-production', method: 'GET', label: 'View Batch Report' }],
      },
      {
        id: 'new-batch-report',
        path: '/reports/new-batch-production',
        label: 'Batch Report',
        icon: BarChart3,
        component: NewBatchProductionReport,
        permission: { module: 'report-batch' },
        apis: [{ route: '/reports/batch-production', method: 'GET', label: 'View Batch Report' }],
      },
      {
        id: 'salesperson-revenue',
        path: '/reports/salesperson-revenue',
        label: 'Salesperson Revenue Report',
        icon: DollarSign,
        component: SalespersonRevenueReport,
        permission: { module: 'report-salesperson-revenue' },
      },
      // {
      //   id: 'salesperson-incentive',
      //   path: '/reports/salesperson-incentives',
      //   label: 'Salesperson Incentive Report',
      //   icon: DollarSign,
      //   component: SalespersonIncentiveReport,
      //   permission: { module: 'report-salesperson-incentives' },
      //   apis: [
      //     { route: '/reports/salesperson-incentives', method: 'GET', label: 'View Incentive Report' },
      //   ],
      // },

      {
        id: 'payment-report',
        path: '/reports/payments',
        label: 'Payment Report',
        icon: DollarSign,
        component: PaymentReport,
        permission: { module: 'payment-report' },
        apis: [
          { route: '/reports/payments', method: 'GET', label: 'View Payment Report' },
          { route: '/masters/customers', method: 'GET', label: 'Load Customers' },
        ],
      },
      {
        id: 'material-inward-report',
        path: '/reports/material-inward',
        label: 'Material Inward',
        icon: Archive,
        component: MaterialInwardReport,
        permission: { module: 'report-inward' },
        apis: [{ route: '/reports/material-inward', method: 'GET', label: 'View Inward Report' }],
      },
      {
        id: 'stock-report',
        path: '/reports/stock',
        label: 'Stock Report',
        icon: TrendingUp,
        component: StockReport,
        permission: { module: 'report-stock' },
        apis: [{ route: '/reports/stock', method: 'GET', label: 'View Stock Report' }],
      },
      {
        id: 'low-stock-report',
        path: '/reports/low-stock',
        label: 'Low Stock Alert',
        icon: AlertCircle,
        component: LowStockReport,
        permission: { module: 'report-low-stock' },
        apis: [{ route: '/inventory/products/low-stock', method: 'GET', label: 'View Low Stock' }],
        // showInSidebar: false,
      },
      {
        id: 'customer-contact-report',
        path: '/reports/customer-contact',
        label: 'Customer Contact Report',
        icon: Users,
        component: CustomerContactReport,
        permission: { module: 'report-customer-contact' },
        apis: [
          { route: '/customers/contacts', method: 'GET', label: 'View Customer Contacts' },
          { route: '/masters/customers', method: 'GET', label: 'Load Customers' },
          { route: '/orders', method: 'GET', label: 'Load Orders' },
        ],
      },
      {
        id: 'pl-report',
        path: '/reports/profit-loss',
        label: 'P/L Statement',
        icon: DollarSign,
        component: ProfitLossReport,
        permission: { module: 'report-profit-loss' },
        apis: [{ route: '/reports/profit-loss', method: 'GET', label: 'View P/L Report' }],
      },
      {
        id: 'customer-sales-report',
        path: '/reports/customer-sales',
        label: 'Customer Sales Report',
        icon: PieChart,
        component: CustomerReport,
        permission: { module: 'report-customer-sales' },
        apis: [
          { route: '/orders', method: 'GET', label: 'View Sales Data' },
          { route: '/employees', method: 'GET', label: 'Load Employees' },
        ],
      },
      {
        id: 'cancelled-orders-report',
        path: '/reports/cancelled-orders',
        label: 'Cancel Order Report',
        icon: AlertCircle,
        component: CancelledOrdersReport,
        permission: { module: 'report-cancelled-orders' },
        apis: [
          { route: '/orders', method: 'GET', label: 'View Cancelled Orders' },
          { route: '/reports/order-counts', method: 'GET', label: 'View Order Counts by Month' },
          { route: '/reports/cancelled-orders', method: 'GET', label: 'View Cancelled Orders' },
        ],
      },
      {
        id: 'product-wise-report',
        path: '/reports/product-wise',
        label: 'Product Wise Report',
        icon: Factory,
        component: ProductWiseReport,
        permission: { module: 'report-product-wise' },
        apis: [
          { route: '/reports/product-wise', method: 'GET', label: 'View Product Report' },
          { route: '/catalog/products/type/:type', method: 'GET', label: 'View FG Products' },
        ],
      },
      {
        id: 'daily-consumption-report',
        path: '/reports/daily-consumption',
        label: 'Daily Consumption',
        icon: FileText,
        component: DailyConsumptionReport,
        permission: { module: 'report-daily-consumption' },
        apis: [
          {
            route: '/reports/daily-consumption',
            method: 'GET',
            label: 'View Daily Consumption',
          },
        ],
      },
      {
        id: 'report-test-certificate',
        path: '/reports/test-certificate',
        label: 'Test Certificate Report',
        icon: FileText,
        component: TestCertificateReportList,
        permission: { module: 'report_test_certificate' },
        apis: [
          {
            route: '/test-certificates',
            method: 'GET',
            label: 'View Test Certificate List',
          },
          {
            route: '/test-certificates/:id',
            method: 'GET',
            label: 'View Test Certificate Details',
          },
        ],
        children: [
          {
            id: 'report-test-certificate-view',
            path: '/reports/test-certificate/:id',
            label: 'View Test Certificate',
            component: TestCertificateReportView,
            permission: { module: 'report_test_certificate' },
            showInSidebar: false,
          },
        ],
      },
    ],
  },

  // ========== SETTINGS ==========
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    component: SettingsDashboard,
    group: 'Main',
    children: [
      {
        id: 'permission-management',
        path: '/settings/permissions',
        label: 'Permission Management',
        icon: Shield,
        component: lazy(() => import('@/features/authority/pages/PermissionManagement')),
        permission: { module: 'permissions' },
        apis: [
          { route: '/auth/roles', method: 'GET', label: 'View Roles' },
          { route: '/auth/permissions', method: 'GET', label: 'View Permissions' },
          { route: '/auth/role-permissions', method: 'GET', label: 'View Role Permissions' },
          { route: '/auth/role-permissions', method: 'PUT', label: 'Update Permissions' },
        ],
      },
      {
        id: 'lock-user',
        path: '/settings/lock-user',
        label: 'Lock User',
        icon: Lock,
        component: LockUserPage,
        permission: { module: 'lock-user' },
        apis: [
          { route: '/employees', method: 'GET', label: 'View Employees' },
          { route: '/employees/:id/status', method: 'PATCH', label: 'Update Status' },
        ],
      },
      {
        id: 'password-reset',
        path: '/settings/password-reset',
        label: 'Reset Password',
        icon: KeyRound,
        component: ResetPasswordPage,
        permission: { module: 'password-reset' },
        apis: [
          { route: '/employees', method: 'GET', label: 'View Employees' },
          { route: '/employees/:id/reset-password', method: 'POST', label: 'Reset Password' },
        ],
      },
      {
        id: 'customer-transfer',
        path: '/settings/customer-transfer',
        label: 'Customer Transfer',
        icon: ArrowRightLeft,
        component: CustomerTransferPage,
        permission: { module: 'customer-transfer' },
        apis: [
          { route: '/masters/customers', method: 'GET', label: 'View Customers' },
          { route: '/employees', method: 'GET', label: 'View Sales Persons' },
          { route: '/masters/customers/transfer', method: 'POST', label: 'Transfer Customer' },
        ],
      },
      {
        id: 'notification-rules',
        path: '/settings/notifications',
        label: 'Notification Rules',
        icon: Bell,
        component: lazy(() => import('@/features/notifications/pages/NotificationSettings')),
        permission: { module: 'notification-rules' },
        apis: [
          { route: '/notification-rules', method: 'GET', label: 'View Rules' },
          { route: '/notification-rules', method: 'POST', label: 'Create Rule' },
          { route: '/notification-rules/:id', method: 'PUT', label: 'Update Rule' },
          { route: '/notification-rules/:id', method: 'DELETE', label: 'Delete Rule' },
        ],
      },
      {
        id: 'company-settings',
        path: '/settings/company',
        label: 'Company Information',
        icon: Building,
        component: CompanySettingsPage,
        permission: { module: 'company-settings' },
        apis: [
          { route: '/company', method: 'GET', label: 'View Company Info' },
          { route: '/company', method: 'PUT', label: 'Update Company Info' },
        ],
      },
    ],
  },

  // ========== HIDDEN/DETAIL ROUTES ==========
  {
    id: 'order-detail',
    path: '/orders/:orderId',
    label: 'Order Detail',
    component: OrderDetailPage,
    permission: { module: 'orders' }, // Uses same permission as create-order
    showInSidebar: false,
    // No separate apis - uses same 'orders' permission from create-order route
  },

  {
    id: 'analytics-stock',
    path: '/analytics/stock',
    label: 'Stock Analytics',
    component: AdminDashboard,
    permission: { module: 'analytics-stock' },
    showInSidebar: false,
    apis: [{ route: '/analytics/stock', method: 'GET', label: 'View Stock Analytics' }],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Flatten route tree into a flat array
 */
export const flattenRoutes = (routes: RouteNode[], _parentPath = ''): RouteNode[] => {
  return routes.reduce<RouteNode[]>((acc, route) => {
    const fullPath = route.path;
    acc.push({ ...route, path: fullPath });
    if (route.children) {
      acc.push(...flattenRoutes(route.children, fullPath));
    }
    return acc;
  }, []);
};

/**
 * Get all routes that should appear in sidebar
 */
export const getSidebarRoutes = (routes: RouteNode[]): RouteNode[] => {
  return routes.filter(route => route.showInSidebar !== false && route.label);
};

// Helper to get all API routes for a route
export const getAllowedApis = (route: RouteNode): string[] => {
  if (!route.apis) return [];
  return route.apis.map(api => `${api.method}:${api.route}`);
};

// Legacy alias for backward compatibility
export const getAllowedActions = getAllowedApis;

/**
 * Extract all unique permissions from route registry
 * Used for syncing to database
 */
export const extractAllPermissions = (
  routes: RouteNode[]
): { module: string; apis: string[] }[] => {
  const permissions: Map<string, Set<string>> = new Map();

  const processRoute = (route: RouteNode) => {
    if (route.permission) {
      const existing = permissions.get(route.permission.module) || new Set();
      permissions.set(route.permission.module, existing);
    }

    // Collect API routes
    if (route.apis && route.permission) {
      route.apis.forEach(api => {
        const existing = permissions.get(route.permission!.module) || new Set();
        existing.add(`${api.method}:${api.route}`);
        permissions.set(route.permission!.module, existing);
      });
    }

    if (route.children) {
      route.children.forEach(processRoute);
    }
  };

  routes.forEach(processRoute);

  return Array.from(permissions.entries()).map(([module, apis]) => ({
    module,
    apis: Array.from(apis),
  }));
};

/**
 * Find a route by path
 */
export const findRouteByPath = (routes: RouteNode[], path: string): RouteNode | undefined => {
  const flat = flattenRoutes(routes);
  return flat.find(r => r.path === path);
};

/**
 * Get route permission by path
 */
export const getRoutePermission = (path: string): RoutePermission | undefined => {
  const route = findRouteByPath(routeRegistry, path);
  return route?.permission;
};

export default routeRegistry;
