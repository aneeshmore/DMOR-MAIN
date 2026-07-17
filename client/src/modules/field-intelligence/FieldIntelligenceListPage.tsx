import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Trash2,
  Eye,
  Edit,
  SlidersHorizontal,
  ArrowUpDown,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Building2,
  LayoutList,
  Users,
  ExternalLink,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';
import { Modal } from '@/components/ui/Modal';
import SearchableSelectUI from '@/components/ui/SearchableSelect';
import { customerApi } from '@/features/masters/api/customerApi';
import { Customer } from '@/features/masters/types';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { confirmDialog } from '@/components/ui';

type ActiveTab = 'reports' | 'customers';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-50 text-blue-700 border-blue-100',
  Qualified: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  'Proposal Sent': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Trial Running': 'bg-pink-50 text-pink-700 border-pink-100',
  Negotiation: 'bg-orange-50 text-orange-700 border-orange-100',
  Won: 'bg-green-50 text-green-700 border-green-100',
  Lost: 'bg-red-50 text-red-700 border-red-100',
  Archived: 'bg-gray-200 text-gray-800',
};

// ── Customer Row Component ──────────────────────────────────────────────────
interface CustomerRowProps {
  customer: any;
  isUnlinked?: boolean;
  onOpenDashboard: (customerId: number) => void;
  onLinkCustomer?: (customerName: string) => void;
}

const CustomerRow: React.FC<CustomerRowProps> = ({
  customer,
  isUnlinked = false,
  onOpenDashboard,
  onLinkCustomer,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !historyLoaded) {
      setLoadingVisits(true);
      try {
        const data = isUnlinked
          ? await fieldIntelligenceApi.getCustomerUnlinkedHistory(customer.customerName)
          : await fieldIntelligenceApi.getCustomerHistory(customer.customerId);
        setVisits(data);
        setHistoryLoaded(true);
      } catch {
        setVisits([]);
      } finally {
        setLoadingVisits(false);
      }
    }
    setExpanded(prev => !prev);
  };

  const badge = STATUS_BADGE[customer.latestStatus] || 'bg-gray-100 text-gray-600';

  return (
    <>
      {/* Customer Summary Row */}
      <tr
        className={`border-b hover:bg-gray-50 transition-colors cursor-pointer ${isUnlinked ? 'bg-amber-50/40' : ''}`}
        onClick={handleExpand}
      >
        <td className="py-3 px-4 w-10">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isUnlinked ? 'bg-amber-100' : 'bg-primary-50'}`}>
              <Building2
                className={`h-4 w-4 ${isUnlinked ? 'text-amber-600' : 'text-[var(--primary)]'}`}
              />
            </div>
            <div>
              {!isUnlinked && customer.customerId ? (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onOpenDashboard(customer.customerId);
                  }}
                  className="font-bold text-primary hover:underline text-left text-sm block"
                >
                  {customer.customerName}
                </button>
              ) : (
                <p className="font-bold text-gray-800 text-sm">{customer.customerName}</p>
              )}
              {isUnlinked && (
                <p className="text-xs text-amber-600 font-medium">
                  Legacy — not linked to Customer Master
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          <span className="bg-primary-50 text-[var(--primary)] text-xs font-bold px-2.5 py-1 rounded-full">
            {customer.totalVisits}
          </span>
        </td>
        <td className="py-3 px-4 text-gray-600 text-sm">
          {customer.latestVisitDate
            ? new Date(customer.latestVisitDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </td>
        <td className="py-3 px-4 text-center font-bold text-gray-700">
          {customer.avgConversion ?? 0}%
        </td>
        <td className="py-3 px-4 text-center">
          <span className={`badge border text-xs ${badge}`}>{customer.latestStatus || '—'}</span>
        </td>
        <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
          {!isUnlinked && customer.customerId ? (
            <button
              onClick={() => onOpenDashboard(customer.customerId)}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors ml-auto"
              title="Open Customer Dashboard"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Dashboard
            </button>
          ) : isUnlinked && onLinkCustomer ? (
            <button
              onClick={() => onLinkCustomer(customer.customerName)}
              className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline px-2.5 py-1.5 rounded-lg hover:bg-amber-100/70 border border-amber-200 transition-colors ml-auto shadow-sm"
              title="Link these reports to a Customer Master record"
            >
              Link Customer
            </button>
          ) : null}
        </td>
      </tr>

      {/* Expanded Visit History */}
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 border-b px-8 py-3">
            {loadingVisits ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Loading visit history...
              </div>
            ) : visits.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No visit history found.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                    <th className="py-1.5 pr-4">Report No.</th>
                    <th className="py-1.5 pr-4">Visit Date</th>
                    <th className="py-1.5 pr-4">Visit Type</th>
                    <th className="py-1.5 pr-4">Executive</th>
                    <th className="py-1.5 pr-4 text-center">Conversion</th>
                    <th className="py-1.5 pr-4 text-center">Status</th>
                    <th className="py-1.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit: any) => (
                    <tr key={visit.id} className="border-b last:border-0 hover:bg-white">
                      <td className="py-2 pr-4 font-semibold text-[var(--primary)] text-xs">
                        {visit.reportNumber}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 text-xs">
                        {visit.visitDate
                          ? new Date(visit.visitDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 text-xs">{visit.visitType || '—'}</td>
                      <td className="py-2 pr-4 text-gray-600 text-xs">
                        {visit.executiveName || '—'}
                      </td>
                      <td className="py-2 pr-4 text-center text-xs font-bold text-gray-700">
                        {visit.conversionProbability ?? 0}%
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <span
                          className={`badge border text-xs ${STATUS_BADGE[visit.status] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {visit.status}
                        </span>
                      </td>
                      <td className="py-2 text-right flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/operations/field-intelligence/${visit.id}`)}
                          className="text-gray-400 hover:text-primary p-1 rounded hover:bg-gray-100"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {(user?.Role === 'Admin' || user?.Role === 'SuperAdmin') && (
                          <button
                            onClick={() =>
                              navigate(`/operations/field-intelligence/${visit.id}/edit`)
                            }
                            className="text-gray-400 hover:text-yellow-600 p-1 rounded hover:bg-gray-100"
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
};

// ── Customer Mobile Card Component ──────────────────────────────────────────
const CustomerMobileCard: React.FC<CustomerRowProps> = ({
  customer,
  isUnlinked = false,
  onOpenDashboard,
  onLinkCustomer,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded && !historyLoaded) {
      setLoadingVisits(true);
      try {
        const data = isUnlinked
          ? await fieldIntelligenceApi.getCustomerUnlinkedHistory(customer.customerName)
          : await fieldIntelligenceApi.getCustomerHistory(customer.customerId);
        setVisits(data);
        setHistoryLoaded(true);
      } catch {
        setVisits([]);
      } finally {
        setLoadingVisits(false);
      }
    }
    setExpanded(prev => !prev);
  };

  const badge = STATUS_BADGE[customer.latestStatus] || 'bg-gray-100 text-gray-600';

  return (
    <div
      onClick={handleExpand}
      className={`card p-4 bg-white shadow-sm border rounded-xl space-y-3 cursor-pointer hover:bg-gray-50 transition-all duration-205 ${
        isUnlinked ? 'border-amber-200 bg-amber-50/10' : ''
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isUnlinked ? 'bg-amber-100' : 'bg-primary-50'}`}>
            <Building2
              className={`h-4 w-4 ${isUnlinked ? 'text-amber-600' : 'text-[var(--primary)]'}`}
            />
          </div>
          <div>
            {!isUnlinked && customer.customerId ? (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onOpenDashboard(customer.customerId);
                }}
                className="font-bold text-primary hover:underline text-left text-sm"
              >
                {customer.customerName}
              </button>
            ) : (
              <p className="font-bold text-gray-800 text-sm">{customer.customerName}</p>
            )}
            {isUnlinked && (
              <p className="text-[10px] text-amber-600 font-semibold mt-0.5 whitespace-normal">
                Legacy — not linked to Customer Master
              </p>
            )}
          </div>
        </div>
        <div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
        <div>
          <span className="text-gray-400 font-bold uppercase tracking-wider block">Total Visits</span>
          <span className="bg-primary-50 text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5">
            {customer.totalVisits}
          </span>
        </div>
        <div>
          <span className="text-gray-400 font-bold uppercase tracking-wider block">Avg Conversion</span>
          <span className="text-gray-800 font-bold block mt-0.5">{customer.avgConversion ?? 0}%</span>
        </div>
        <div>
          <span className="text-gray-400 font-bold uppercase tracking-wider block">Latest Visit</span>
          <span className="text-gray-700 font-medium block mt-0.5">
            {customer.latestVisitDate
              ? new Date(customer.latestVisitDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-400 font-bold uppercase tracking-wider block">Latest Status</span>
          <span className={`badge border text-[9px] inline-block mt-0.5 whitespace-normal ${badge}`}>
            {customer.latestStatus || '—'}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3" onClick={e => e.stopPropagation()}>
        {!isUnlinked && customer.customerId ? (
          <button
            onClick={() => onOpenDashboard(customer.customerId)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors min-h-[44px]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Dashboard
          </button>
        ) : isUnlinked && onLinkCustomer ? (
          <button
            onClick={() => onLinkCustomer(customer.customerName)}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:underline px-3 py-1.5 rounded-lg hover:bg-amber-100/70 border border-amber-200 transition-colors shadow-sm min-h-[44px]"
          >
            Link Customer
          </button>
        ) : null}
      </div>

      {expanded && (
        <div
          className="bg-gray-50/70 rounded-lg p-3 border border-gray-100 space-y-3 mt-3 transition-all duration-200"
          onClick={e => e.stopPropagation()}
        >
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5">
            Visit History
          </h4>
          {loadingVisits ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
              Loading visit history...
            </div>
          ) : visits.length === 0 ? (
            <p className="text-xs text-gray-500 py-1">No visit history found.</p>
          ) : (
            <div className="space-y-3">
              {visits.map((visit: any) => (
                <div
                  key={visit.id}
                  className="bg-white p-2.5 rounded-md border border-gray-100 text-xs space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                        Report No.
                      </span>
                      <span className="font-semibold text-[var(--primary)]">{visit.reportNumber}</span>
                    </div>
                    <span
                      className={`badge border text-[9px] whitespace-normal ${
                        STATUS_BADGE[visit.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {visit.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                        Visit Date
                      </span>
                      <span className="font-medium text-gray-700">
                        {visit.visitDate
                          ? new Date(visit.visitDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                        Visit Type
                      </span>
                      <span className="font-medium text-gray-700">{visit.visitType || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                        Executive
                      </span>
                      <span className="font-medium text-gray-700">{visit.executiveName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                        Conversion
                      </span>
                      <span className="font-bold text-gray-800">
                        {visit.conversionProbability ?? 0}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 border-t pt-2 mt-1">
                    <button
                      onClick={() => navigate(`/operations/field-intelligence/${visit.id}`)}
                      className="text-gray-500 hover:text-primary p-2 rounded hover:bg-gray-100 flex items-center gap-1 text-[10px] min-h-[32px]"
                      title="View"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    {(user?.Role === 'Admin' || user?.Role === 'SuperAdmin') && (
                      <button
                        onClick={() => navigate(`/operations/field-intelligence/${visit.id}/edit`)}
                        className="text-gray-500 hover:text-yellow-600 p-2 rounded hover:bg-gray-100 flex items-center gap-1 text-[10px] min-h-[32px]"
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main List Page ──────────────────────────────────────────────────────────
export const FieldIntelligenceListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Tab state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('reports');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── Reports tab state ─────────────────────────────────────────
  const [reports, setReports] = useState<FieldIntelligenceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ── Customers tab state ────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerData, setCustomerData] = useState<{ linked: any[]; unlinked: any[] } | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // ── Re-linking state ──────────────────────────────────────────
  const [masterCustomers, setMasterCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
  const [linkingCustomerName, setLinkingCustomerName] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);

  useEffect(() => {
    const fetchMasterCustomers = async () => {
      try {
        const response = await customerApi.getAll();
        if (response.success && response.data) {
          setMasterCustomers(response.data);
        }
      } catch (err) {
        console.error('Failed to load customers from Customer Master:', err);
      }
    };
    fetchMasterCustomers();
  }, []);

  const handleLinkSave = async () => {
    if (!linkingCustomerName || !selectedCustomer) return;
    try {
      setLinkSaving(true);
      const res = await fieldIntelligenceApi.linkCustomer({
        customerName: linkingCustomerName,
        customerId: selectedCustomer.CustomerID,
      });
      showToast.success(`${res.updatedCount} historical reports linked successfully.`);
      setLinkingCustomerName(null);
      setSelectedCustomer(undefined);
      // Refresh both tabs immediately
      fetchReports();
      fetchCustomers();
    } catch (err: any) {
      console.error('Failed to link customer', err);
      showToast.error(err.message || 'Failed to link customer.');
    } finally {
      setLinkSaving(false);
    }
  };

  // ── Reports fetch ──────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fieldIntelligenceApi.getAll({
        search: search || undefined,
        status: status || undefined,
        sortBy,
        sortOrder,
      });
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports', err);
      setError('Could not retrieve reports list.');
    } finally {
      setLoading(false);
    }
  }, [search, status, sortBy, sortOrder]);

  useEffect(() => {
    if (activeTab !== 'reports') return;
    const timer = setTimeout(fetchReports, 300);
    return () => clearTimeout(timer);
  }, [search, status, sortBy, sortOrder, activeTab, fetchReports]);

  // ── Customers fetch ────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    try {
      setCustomerLoading(true);
      setCustomerError(null);
      const data = await fieldIntelligenceApi.getCustomerSummary({
        search: customerSearch || undefined,
      });
      setCustomerData(data);
    } catch (err) {
      console.error('Failed to load customer summary', err);
      setCustomerError('Could not retrieve customer data.');
    } finally {
      setCustomerLoading(false);
    }
  }, [customerSearch]);

  useEffect(() => {
    if (activeTab !== 'customers') return;
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, activeTab, fetchCustomers]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (
      await confirmDialog({
        title: 'Delete Report',
        message: 'Are you sure you want to delete this report? This action cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'danger',
      })
    ) {
      try {
        await fieldIntelligenceApi.delete(id);
        showToast.success('SMART CRM Visit Report deleted successfully.');
        setReports(prev => prev.filter(r => r.id !== id));
      } catch (err) {
        console.error('Delete failed', err);
        showToast.error('Failed to delete the report.');
      }
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const csvBlob = await fieldIntelligenceApi.exportCsv();
      const url = window.URL.createObjectURL(new Blob([csvBlob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SMART_CRM_Visit_Data_Export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
      showToast.error('Failed to export report data.');
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-primary-500 text-white p-1 rounded-lg">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            SMART CRM
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage, filter, and track customer intelligence and acquisitions
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 flex items-center justify-center gap-2 flex-1 sm:flex-initial text-sm min-h-[44px]"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>

          <button
            onClick={() => navigate('/operations/field-intelligence/dashboard')}
            className="btn border border-[var(--primary)] text-[var(--primary)] hover:bg-primary-50 px-4 py-2 flex-1 sm:flex-initial text-center text-sm min-h-[44px]"
          >
            Dashboard
          </button>

          <button
            onClick={() => navigate('/operations/field-intelligence/new')}
            className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-4 py-2 shadow-sm font-semibold flex-1 sm:flex-initial text-center text-sm min-h-[44px]"
          >
            + Create Report
          </button>
        </div>
      </div>

      {/* ── Tab Toggle ───────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'reports'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutList className="h-4 w-4" />
          Reports
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'customers'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          Customers
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          REPORTS TAB — 100% unchanged existing implementation
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'reports' && (
        <>
          {/* Filters Bar */}
          <div className="card p-4 bg-white flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Search by customer, city, state, supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <SlidersHorizontal className="h-4 w-4 text-gray-400" />
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="input w-full md:w-44"
                >
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Proposal Sent">Proposal Sent</option>
                  <option value="Trial Running">Trial Running</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Won">Won</option>
                  <option value="Lost">Lost</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reports Table */}
          {loading ? (
            <div className="card p-12 text-center flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-3 text-gray-500 font-semibold">Retrieving reports...</span>
            </div>
          ) : error ? (
            <div className="card p-8 border-red-200 bg-red-50 text-red-700 text-center">
              <p>{error}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-gray-500">
                No SMART CRM visit reports found matching your parameters.
              </p>
            </div>
          ) : isMobile ? (
            <div className="grid grid-cols-1 gap-4">
              {reports.map(report => {
                const statusBadge =
                  STATUS_BADGE[report.status] || 'bg-gray-100 text-gray-600';

                return (
                  <div
                    key={report.id}
                    className="card p-4 bg-white shadow-sm border rounded-xl space-y-3 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                          Report Number
                        </span>
                        <p className="font-bold text-primary text-sm">{report.reportNumber}</p>
                      </div>
                      <span className={`badge ${statusBadge} border whitespace-normal`}>
                        {report.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                        Customer Name
                      </span>
                      <p className="font-bold text-gray-800 text-base">
                        {report.customerId ? (
                          <button
                            onClick={() =>
                              navigate(
                                `/operations/field-intelligence/customer/${report.customerId}`
                              )
                            }
                            className="text-left text-primary hover:underline font-bold"
                          >
                            {report.customerName}
                          </button>
                        ) : (
                          <span
                            className="text-gray-800 font-bold"
                            title="Customer not linked to Customer Master"
                          >
                            {report.customerName}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                          Visit Date
                        </span>
                        <span className="text-gray-700 font-medium">
                          {report.visitDate
                            ? new Date(report.visitDate).toLocaleDateString('en-IN')
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                          Representative
                        </span>
                        <span className="text-gray-700 font-medium">
                          {report.executiveName || 'System'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                          City / State
                        </span>
                        <span className="text-gray-700 font-medium truncate block" title={report.city}>
                          {report.city
                            ? `${report.city}, ${report.state || ''}`
                            : report.state || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                          Conversion %
                        </span>
                        <span className="text-gray-800 font-bold">
                          {report.conversionProbability}%
                        </span>
                      </div>
                    </div>

                    {report.paintRequirementTypes && report.paintRequirementTypes.length > 0 && (
                      <div className="border-t pt-2.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                          Products Focus
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {report.paintRequirementTypes.slice(0, 3).map((type: string) => (
                            <span
                              key={type}
                              className="inline-block bg-primary-50 text-[var(--primary)] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-primary-100"
                            >
                              {type}
                            </span>
                          ))}
                          {report.paintRequirementTypes.length > 3 && (
                            <span className="text-[10px] text-gray-400 font-bold self-center">
                              +{report.paintRequirementTypes.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 border-t pt-3 mt-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/operations/field-intelligence/${report.id}`)}
                        className="btn border border-gray-200 text-gray-600 hover:bg-gray-50 p-2.5 rounded-lg text-xs flex items-center gap-1.5 min-h-[44px]"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      {(user?.Role === 'Admin' || user?.Role === 'SuperAdmin') && (
                        <>
                          <button
                            onClick={() =>
                              navigate(`/operations/field-intelligence/${report.id}/edit`)
                            }
                            className="btn border border-gray-200 text-yellow-600 hover:bg-yellow-50 p-2.5 rounded-lg text-xs flex items-center gap-1.5 min-h-[44px]"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(report.id!)}
                            className="btn border border-red-200 text-red-600 hover:bg-red-50 p-2.5 rounded-lg text-xs flex items-center gap-1.5 min-h-[44px]"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card overflow-hidden bg-white shadow-sm border rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-700 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Report Number</th>
                      <th className="py-3 px-4">Customer Name</th>
                      <th
                        className="py-3 px-4 cursor-pointer"
                        onClick={() => toggleSort('visitDate')}
                      >
                        <div className="flex items-center gap-1">
                          Visit Date
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Sales Executive</th>
                      <th className="py-3 px-4">City / State</th>
                      <th className="py-3 px-4 text-center">Conversion %</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => {
                      const statusBadge =
                        STATUS_BADGE[report.status] || 'bg-gray-100 text-gray-600';

                      return (
                        <tr key={report.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-primary">
                            {report.reportNumber}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-800">
                            {report.customerId ? (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/operations/field-intelligence/customer/${report.customerId}`
                                  )
                                }
                                className="text-left text-primary hover:underline hover:text-primary-hover font-bold"
                              >
                                {report.customerName}
                              </button>
                            ) : (
                              <span
                                className="text-gray-800 font-bold cursor-help"
                                title="Customer not linked to Customer Master"
                              >
                                {report.customerName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {report.visitDate
                              ? new Date(report.visitDate).toLocaleDateString()
                              : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-gray-800">
                            {report.executiveName || 'System'}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {report.city
                              ? `${report.city}, ${report.state || ''}`
                              : report.state || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-gray-700">
                            {report.conversionProbability}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`badge ${statusBadge} border`}>{report.status}</span>
                          </td>
                          <td className="py-3 px-4 text-right flex justify-end gap-2">
                            <button
                              onClick={() =>
                                navigate(`/operations/field-intelligence/${report.id}`)
                              }
                              className="text-gray-500 hover:text-primary p-1.5 rounded-lg hover:bg-gray-100"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {(user?.Role === 'Admin' || user?.Role === 'SuperAdmin') && (
                              <button
                                onClick={() =>
                                  navigate(`/operations/field-intelligence/${report.id}/edit`)
                                }
                                className="text-gray-500 hover:text-yellow-600 p-1.5 rounded-lg hover:bg-gray-100"
                                title="Edit Report"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {(user?.Role === 'Admin' || user?.Role === 'SuperAdmin') && (
                              <button
                                onClick={() => handleDelete(report.id!)}
                                className="text-gray-550 hover:text-red-650 p-1.5 rounded-lg hover:bg-gray-100"
                                title="Delete Report"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CUSTOMERS TAB — grouped by customerId
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <>
          {/* Customer Search */}
          <div className="card p-4 bg-white flex gap-4 items-center">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Search customers..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400 hidden md:block">
              Click a row to expand visit history · Click Dashboard to open customer intelligence
            </p>
          </div>

          {customerLoading ? (
            <div className="card p-12 text-center flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-3 text-gray-500 font-semibold">Loading customer data...</span>
            </div>
          ) : customerError ? (
            <div className="card p-8 border-red-200 bg-red-50 text-red-700 text-center">
              <p>{customerError}</p>
            </div>
          ) : (
            <>
              {/* Linked Customers Table / Card List */}
              {(customerData?.linked?.length ?? 0) > 0 && (
                <div className="card overflow-hidden bg-white shadow-sm border rounded-xl">
                  <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--primary)]" />
                    <h3 className="font-bold text-gray-700 text-sm">
                      Linked Customers ({customerData!.linked.length})
                    </h3>
                    <span className="ml-auto text-xs text-gray-400">
                      Grouped by Customer Master ID
                    </span>
                  </div>
                  {isMobile ? (
                    <div className="p-4 grid grid-cols-1 gap-4">
                      {customerData!.linked.map((customer: any) => (
                        <CustomerMobileCard
                          key={customer.customerId}
                          customer={customer}
                          onOpenDashboard={id =>
                            navigate(`/operations/field-intelligence/customer/${id}`)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b text-gray-600 text-xs font-bold uppercase tracking-wider">
                            <th className="py-3 px-4 w-10" />
                            <th className="py-3 px-4">Customer Name</th>
                            <th className="py-3 px-4 text-center">Total Visits</th>
                            <th className="py-3 px-4">Latest Visit</th>
                            <th className="py-3 px-4 text-center">Avg Conversion</th>
                            <th className="py-3 px-4 text-center">Latest Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerData!.linked.map((customer: any) => (
                            <CustomerRow
                              key={customer.customerId}
                              customer={customer}
                              onOpenDashboard={id =>
                                navigate(`/operations/field-intelligence/customer/${id}`)
                              }
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Unlinked Historical Records Table / Card List */}
              {(customerData?.unlinked?.length ?? 0) > 0 && (
                <div className="card overflow-hidden bg-white shadow-sm border border-amber-200 rounded-xl mt-6">
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-600" />
                    <h3 className="font-bold text-amber-700 text-sm">
                      Unlinked Historical Records ({customerData!.unlinked.length})
                    </h3>
                    <span className="ml-auto text-xs text-amber-500">
                      These reports were created before Customer Master linking was enabled
                    </span>
                  </div>
                  {isMobile ? (
                    <div className="p-4 grid grid-cols-1 gap-4">
                      {customerData!.unlinked.map((customer: any) => (
                        <CustomerMobileCard
                          key={customer.customerName}
                          customer={customer}
                          isUnlinked
                          onOpenDashboard={() => {}}
                          onLinkCustomer={setLinkingCustomerName}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-amber-50/50 border-b text-gray-600 text-xs font-bold uppercase tracking-wider">
                            <th className="py-3 px-4 w-10" />
                            <th className="py-3 px-4">Customer Name</th>
                            <th className="py-3 px-4 text-center">Total Visits</th>
                            <th className="py-3 px-4">Latest Visit</th>
                            <th className="py-3 px-4 text-center">Avg Conversion</th>
                            <th className="py-3 px-4 text-center">Latest Status</th>
                            <th className="py-3 px-4 text-right" />
                          </tr>
                        </thead>
                        <tbody>
                          {customerData!.unlinked.map((customer: any) => (
                            <CustomerRow
                              key={customer.customerName}
                              customer={customer}
                              isUnlinked
                              onOpenDashboard={() => {}}
                              onLinkCustomer={setLinkingCustomerName}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {(customerData?.linked?.length ?? 0) === 0 &&
                (customerData?.unlinked?.length ?? 0) === 0 && (
                  <div className="card p-12 text-center">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-semibold">No customer data found.</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Create a SMART CRM Visit Report and select a customer to see them here.
                    </p>
                  </div>
                )}
            </>
          )}
        </>
      )}

      {/* Link Customer Modal */}
      <Modal
        isOpen={!!linkingCustomerName}
        onClose={() => {
          setLinkingCustomerName(null);
          setSelectedCustomer(undefined);
        }}
        title={`Link Customer: ${linkingCustomerName}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-505">
            Select a customer from the Customer Master list to link all historical records for
            <strong className="text-gray-800 ml-1">&quot;{linkingCustomerName}&quot;</strong>.
          </p>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Select Customer Master Record
            </label>
            <SearchableSelectUI<Customer>
              options={masterCustomers.map(c => ({
                id: c.CustomerID,
                label: c.CompanyName,
                subLabel: c.ContactPerson ? `Contact: ${c.ContactPerson}` : undefined,
                value: c,
              }))}
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              placeholder="Search Customer Master..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setLinkingCustomerName(null);
                setSelectedCustomer(undefined);
              }}
              className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLinkSave}
              disabled={!selectedCustomer || linkSaving}
              className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-5 py-2 font-semibold shadow-sm disabled:opacity-50"
            >
              {linkSaving ? 'Linking...' : 'Link Customer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default FieldIntelligenceListPage;
