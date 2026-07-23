import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  BarChart2,
  RefreshCw,
  Plus,
  Minus,
  LayoutDashboard,
  Calendar,
  Download,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  'Draft',
  'Submitted',
  'Qualified',
  'Proposal Sent',
  'Trial Running',
  'Negotiation',
  'Won',
  'Lost',
  'Archived',
];

const MOOD_OPTIONS = [
  'Highly Interested',
  'Interested',
  'Neutral',
  'Hesitant',
  'Dissatisfied',
  'Not Interested',
];

const STATUS_BADGE: Record<string, string> = {
  Draft: 'text-gray-500',
  Submitted: 'bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs',
  Qualified: 'bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-2 py-0.5 text-xs',
  'Proposal Sent':
    'bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-2 py-0.5 text-xs',
  'Trial Running': 'bg-pink-50 text-pink-700 border border-pink-200 rounded px-2 py-0.5 text-xs',
  Negotiation: 'bg-orange-50 text-orange-700 border border-orange-200 rounded px-2 py-0.5 text-xs',
  Won: 'bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 text-xs',
  Lost: 'bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 text-xs',
  Archived: 'bg-gray-100 text-gray-600 border border-gray-200 rounded px-2 py-0.5 text-xs',
};

function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CustomerRow — expandable company row matching the reference screenshot
// ─────────────────────────────────────────────────────────────────────────────
interface CustomerRowProps {
  customer: any;
  isUnlinked?: boolean;
  onOpenDashboard: (customerId: number) => void;
  onRefreshNeeded?: () => void;
}

const CustomerRow: React.FC<CustomerRowProps> = ({
  customer,
  isUnlinked = false,
  onOpenDashboard,
  onRefreshNeeded,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const handleToggle = async () => {
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

  const handleDeleteVisit = async (visitId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this visit report? This action cannot be undone.'
      )
    )
      return;
    try {
      await fieldIntelligenceApi.delete(visitId);
      showToast.success('Smart CRM visit report deleted successfully.');
      setVisits(prev => prev.filter(v => v.id !== visitId));
      onRefreshNeeded?.();
    } catch (err) {
      console.error('Delete failed', err);
      showToast.error('Failed to delete the report.');
    }
  };

  return (
    <>
      {/* ── Company Summary Row ── */}
      <tr className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
        {/* Expand icon */}
        <td className="py-4 pl-4 pr-2 w-10">
          <button
            onClick={handleToggle}
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 transition-colors text-gray-500"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3 text-gray-400" />}
          </button>
        </td>

        {/* Customer Name + City */}
        <td className="py-4 px-3">
          <div>
            <p
              className={`font-semibold text-sm leading-tight ${
                !isUnlinked && customer.customerId
                  ? 'text-gray-800 hover:text-[var(--primary)] cursor-pointer'
                  : 'text-gray-800'
              }`}
              onClick={() => {
                if (!isUnlinked && customer.customerId) {
                  onOpenDashboard(customer.customerId);
                }
              }}
            >
              {customer.customerName}
            </p>
            {customer.city && <p className="text-xs text-gray-400 mt-0.5">{customer.city}</p>}
            {isUnlinked && (
              <span className="text-[10px] text-amber-600 font-medium">
                Legacy — not linked to Customer Master
              </span>
            )}
          </div>
        </td>

        {/* Spacer to push Total Visits to the right column */}
        <td className="py-4 px-3" />

        {/* Total Visits badge */}
        <td className="py-4 px-3 text-center">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
            {customer.totalVisits ?? 0}
          </span>
        </td>

        {/* Latest Visit Date */}
        <td className="py-4 px-3 text-sm text-gray-600">{formatDate(customer.latestVisitDate)}</td>

        {/* Actions */}
        <td className="py-4 px-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {/* Hide/Show History */}
            <button
              onClick={handleToggle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide History
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Show History
                </>
              )}
            </button>

            {!isUnlinked && customer.customerId ? (
              <button
                onClick={() => onOpenDashboard(customer.customerId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#4f46e5] text-white hover:bg-[#4338ca] transition-colors shadow-sm"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Intelligence Dashboard
              </button>
            ) : null}
          </div>
        </td>
      </tr>

      {/* ── Expanded Visit History ── */}
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50/80 border-b border-gray-100 px-0">
            <div className="mx-4 my-3">
              {loadingVisits ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4 px-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary)]" />
                  Loading visit history...
                </div>
              ) : visits.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 px-2">No visit history found.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                      <th className="py-2.5 px-4 font-medium">Visit Date</th>
                      <th className="py-2.5 px-4 font-medium">Report No</th>
                      <th className="py-2.5 px-4 font-medium" />
                      <th className="py-2.5 px-4 font-medium">Category</th>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((visit: any) => (
                      <tr
                        key={visit.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-white/70 transition-colors"
                      >
                        {/* Visit Date — first one in orange/primary */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`text-sm ${
                              visit === visits[0]
                                ? 'text-orange-500 font-semibold'
                                : 'text-gray-600'
                            }`}
                          >
                            {formatDate(visit.visitDate)}
                          </span>
                        </td>

                        {/* Report No — monospaced blue */}
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-xs text-[#4f46e5] font-semibold tracking-wide">
                            {visit.reportNumber}
                          </span>
                        </td>

                        {/* Empty spacer aligned with customer name column */}
                        <td className="py-2.5 px-4" />

                        {/* Category = visitType with bullet */}
                        <td className="py-2.5 px-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                            {visit.visitType || 'General'}
                          </span>
                        </td>

                        {/* Status badge */}
                        <td className="py-2.5 px-4">
                          <span
                            className={`text-xs font-medium ${
                              STATUS_BADGE[visit.status] || 'text-gray-500 text-xs'
                            }`}
                          >
                            {visit.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                navigate(
                                  `/operations/smart-crm/${encodeURIComponent(visit.reportNumber || visit.id)}`
                                )
                              }
                              className="p-1.5 rounded text-gray-400 hover:text-[var(--primary)] hover:bg-blue-50 transition-colors"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {/* Edit only for Draft reports (admin or owner). Submitted → no Edit. */}
                            {visit.status === 'Draft' &&
                              (user?.Role === 'Admin' ||
                                user?.Role === 'SuperAdmin' ||
                                Number(visit.executiveId) === Number(user?.EmployeeID) ||
                                Number(visit.createdBy) === Number(user?.EmployeeID)) && (
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/operations/smart-crm/${encodeURIComponent(visit.reportNumber || visit.id)}/edit`
                                    )
                                  }
                                  className="p-1.5 rounded text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                            {(user?.Role === 'Admin' ||
                              user?.Role === 'SuperAdmin' ||
                              (visit.status === 'Draft' &&
                                (Number(visit.executiveId) === Number(user?.EmployeeID) ||
                                  Number(visit.createdBy) === Number(user?.EmployeeID)))) && (
                              <button
                                onClick={() => handleDeleteVisit(visit.id)}
                                className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export const FieldIntelligenceListPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Data state ─────────────────────────────────────────────────────────────
  const [customerData, setCustomerData] = useState<{ linked: any[]; unlinked: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Filter state ────────────────────────────────────────────────────────────
  // Status and Mood quick-filters are hidden from the dashboard per product
  // decision; the underlying state is retained so filtering logic stays intact.
  const SHOW_STATUS_MOOD_FILTERS = false;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Fetch customer summary ──────────────────────────────────────────────────
  const fetchCustomers = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await fieldIntelligenceApi.getCustomerSummary();
      setCustomerData(data);
    } catch (err) {
      console.error('Failed to load customer data', err);
      setError('Could not load Smart CRM data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── Client-side filtering ───────────────────────────────────────────────────
  const filterCustomers = (list: any[]) => {
    return list.filter(c => {
      // Search by name or city
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (c.customerName || '').toLowerCase().includes(q);
        const cityMatch = (c.city || '').toLowerCase().includes(q);
        if (!nameMatch && !cityMatch) return false;
      }
      // Status filter on latest status
      if (statusFilter && c.latestStatus !== statusFilter) return false;
      // Mood filter on latest mood
      if (moodFilter && c.latestMood !== moodFilter) return false;
      // Date range on latestVisitDate
      if (startDate && c.latestVisitDate) {
        if (new Date(c.latestVisitDate) < new Date(startDate)) return false;
      }
      if (endDate && c.latestVisitDate) {
        if (new Date(c.latestVisitDate) > new Date(endDate + 'T23:59:59')) return false;
      }
      return true;
    });
  };

  const filteredLinked = useMemo(
    () => filterCustomers(customerData?.linked ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customerData, search, statusFilter, moodFilter, startDate, endDate]
  );

  const filteredUnlinked = useMemo(
    () => filterCustomers(customerData?.unlinked ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customerData, search, statusFilter, moodFilter, startDate, endDate]
  );

  const totalActive = (customerData?.linked?.length ?? 0) + (customerData?.unlinked?.length ?? 0);

  // Detect if API returns mood data at all
  const hasMoodData = useMemo(() => {
    const all = [...(customerData?.linked ?? []), ...(customerData?.unlinked ?? [])];
    return all.some(c => c.latestMood !== undefined && c.latestMood !== null);
  }, [customerData]);

  // ── Export CSV handler ──────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

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
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      showToast.error('Failed to export Smart CRM data.');
    } finally {
      setExporting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 leading-tight">Smart CRM</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading
              ? 'Loading companies...'
              : `${totalActive} active ${totalActive === 1 ? 'company' : 'companies'} track records`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={() => navigate('/operations/smart-crm/dashboard')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <BarChart2 className="h-4 w-4" />
            Overall Dashboard
          </button>
          <button
            onClick={() => navigate('/operations/smart-crm/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Report
          </button>
        </div>
      </div>

      {/* ── Filters Row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by customer name, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors placeholder:text-gray-400"
          />
        </div>

        {/* Status */}
        {SHOW_STATUS_MOOD_FILTERS && (
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] cursor-pointer min-w-[110px]"
            >
              <option value="">Status</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Mood (only if backend returns it) */}
        {SHOW_STATUS_MOOD_FILTERS && hasMoodData && (
          <div className="relative">
            <select
              value={moodFilter}
              onChange={e => setMoodFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] cursor-pointer min-w-[100px]"
            >
              <option value="">Mood</option>
              {MOOD_OPTIONS.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Mood placeholder (greyed out when not available) */}
        {SHOW_STATUS_MOOD_FILTERS && !hasMoodData && customerData && (
          <div className="relative opacity-50 cursor-not-allowed" title="Mood data not available">
            <select
              disabled
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed min-w-[100px]"
            >
              <option>Mood</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
          </div>
        )}

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] w-[130px]"
              title="Start date"
            />
          </div>
          <span className="text-gray-400 text-sm">→</span>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] w-[130px]"
              title="End date"
            />
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchCustomers(true)}
          disabled={refreshing}
          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          <span className="text-gray-500 font-medium text-sm">Loading Smart CRM data...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-700">
          <p className="font-semibold mb-2">Error loading data</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchCustomers()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : filteredLinked.length === 0 && filteredUnlinked.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <LayoutDashboard className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No companies found</p>
          <p className="text-gray-400 text-sm mt-1">
            {search || statusFilter || moodFilter || startDate || endDate
              ? 'Try adjusting your filters.'
              : 'Create your first Smart CRM visit report to get started.'}
          </p>
          {!search && !statusFilter && !moodFilter && !startDate && !endDate && (
            <button
              onClick={() => navigate('/operations/smart-crm/new')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Report
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="py-3 pl-4 pr-2 w-10" />
                <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="py-3 px-3 w-12" />
                <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Visits
                </th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Latest Visit Date
                </th>
                <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pr-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Linked Customers */}
              {filteredLinked.map((customer: any) => (
                <CustomerRow
                  key={`linked-${customer.customerId}`}
                  customer={customer}
                  onOpenDashboard={id => navigate(`/operations/smart-crm/customer/${id}`)}
                  onRefreshNeeded={() => fetchCustomers()}
                />
              ))}

              {/* Unlinked Customers */}
              {filteredUnlinked.map((customer: any) => (
                <CustomerRow
                  key={`unlinked-${customer.customerName}`}
                  customer={customer}
                  isUnlinked
                  onOpenDashboard={() => {}}
                  onRefreshNeeded={() => fetchCustomers()}
                />
              ))}
            </tbody>
          </table>

          {/* Footer count */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-600">
                {filteredLinked.length + filteredUnlinked.length}
              </span>{' '}
              of <span className="font-semibold text-gray-600">{totalActive}</span> companies
            </span>
            <span className="text-xs text-gray-400">Click a row to expand visit history</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldIntelligenceListPage;
