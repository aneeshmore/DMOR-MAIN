import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User,
  Activity,
  MapPin,
  TrendingUp,
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  Trash2,
  Edit,
  Star,
  Image as ImageIcon,
  Sparkles,
  Paperclip,
  X,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { confirmDialog } from '@/components/ui';

const deserializeOrderStatus = (
  notes: string | undefined
): { cleanNotes: string; statuses: string[] } => {
  if (!notes) return { cleanNotes: '', statuses: [] };
  const markerRegex = /\n\n\[Order Status:\s*([^\]]*)\]$/s;
  const match = notes.match(markerRegex);
  if (match) {
    const statusesStr = match[1].trim();
    const statuses = statusesStr
      ? statusesStr
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    const cleanNotes = notes.replace(markerRegex, '');
    return { cleanNotes, statuses };
  }
  return { cleanNotes: notes, statuses: [] };
};

export const FieldIntelligenceViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FieldIntelligenceReport | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'profile'
    | 'technical'
    | 'commercial'
    | 'ratings'
    | 'competitors'
    | 'followups'
    | 'attachments'
    | 'ai'
    | 'logs'
  >('profile');
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Build an absolute URL for uploaded files (served at <API>/uploads/...).
  const fileUrl = (filePath?: string): string => {
    if (!filePath) return '';
    // base64 data URLs and absolute URLs are used as-is.
    if (/^(https?:|data:)/i.test(filePath)) return filePath;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
    return `${base}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
  };

  const isImageUpload = (u: {
    mimeType?: string;
    fileName?: string;
    filePath?: string;
  }): boolean => {
    if (u.mimeType && u.mimeType.startsWith('image/')) return true;
    if (u.filePath && u.filePath.startsWith('data:image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(u.fileName || u.filePath || '');
  };

  // Prettify a dynamic-field key into a human label, e.g. "expectedRate" → "Expected Rate".
  const prettyLabel = (k: string): string =>
    k
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, c => c.toUpperCase())
      .trim();

  const displayVal = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return 'N/A';
    if (Array.isArray(v)) return v.length ? v.join(', ') : 'N/A';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const { cleanNotes, statuses } = React.useMemo(() => {
    return deserializeOrderStatus(report?.discussionNotes);
  }, [report?.discussionNotes]);

  // Decision Console metrics computed from the ACTUAL report data (no mock
  // values). These render even when AI enrichment is unavailable (e.g. provider
  // quota exhausted), so the console is always functional and data-accurate.
  const consoleData = React.useMemo(() => {
    if (!report) return null;
    const normalizeRating = (v: unknown): number => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 5;
      if (n > 10) return n / 10;
      return n;
    };
    const num = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
    const relationship = normalizeRating(report.relationshipStrength); // 0–10
    const payment = normalizeRating(report.paymentReliability); // 0–10
    const dealerConf = normalizeRating(report.dealerConfidence); // 0–10
    const longTerm = normalizeRating(report.longTermPotential); // 0–10
    const tech = normalizeRating(report.technicalCapability); // 0–10
    const urgency = normalizeRating(report.followupUrgencyScore); // 0–10
    const conversion = clamp(num(report.conversionProbability), 0, 100); // 0–100 %
    const monthlyForecast = num(report.expectedMonthlyBusiness);
    const level = (v: number) => (v >= 7 ? 'High' : v >= 4 ? 'Moderate' : 'Low');
    return {
      healthScore: Math.round(((relationship + payment + dealerConf) / 30) * 100),
      opportunityScore: Math.round(
        clamp(((longTerm + relationship + payment + tech) / 40) * 100, 0, 100)
      ),
      winProbability: conversion,
      monthlyForecast,
      annualForecast: monthlyForecast * 12,
      urgency,
      relationshipLevel: level(relationship),
      confidenceLevel: level(dealerConf),
      paymentLevel: level(payment),
      competitorThreat:
        Array.isArray(report.competitors) && report.competitors.length > 0 ? 'Present' : 'Low',
      hasForecast: monthlyForecast > 0,
    };
  }, [report]);

  // AI Decision Console States
  const [showAiConsole, setShowAiConsole] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [consoleTab, setConsoleTab] = useState<'dashboard' | 'assistant'>('dashboard');

  // Copilot Chat States
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAbortController, setChatAbortController] = useState<AbortController | null>(null);
  const chatMessagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll chat window
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchAiInsights = async () => {
    if (!id) return;
    try {
      setInsightsLoading(true);
      const result = await fieldIntelligenceApi.getReportAiInsights(id);
      setAiInsights(result);
    } catch (err) {
      console.error('Failed to load AI structured insights', err);
      showToast.error('Could not generate/load AI Decision Support Console data.');
    } finally {
      setInsightsLoading(false);
    }
  };

  const fetchReport = async () => {
    try {
      if (!id) return;
      setLoading(true);
      const data = await fieldIntelligenceApi.getById(id);
      setReport(data);
    } catch (err) {
      console.error('Failed to load report details', err);
      showToast.error('Could not retrieve report data.');
      navigate('/operations/smart-crm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-500 font-semibold">Loading report details...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card p-8 text-center border-red-200 bg-red-50 text-red-700 max-w-md mx-auto mt-12">
        <h3 className="font-bold text-lg mb-1">Report Not Found</h3>
        <p className="text-sm mb-4">
          The report you are looking for does not exist or you do not have permission to view it.
        </p>
        <button
          onClick={() => navigate('/operations/smart-crm')}
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-4 py-2"
        >
          Back to List
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (
      await confirmDialog({
        title: 'Delete Report',
        message: 'Are you sure you want to delete this report? This action is permanent.',
        confirmLabel: 'Delete',
        variant: 'danger',
      })
    ) {
      try {
        await fieldIntelligenceApi.delete(report.id!);
        showToast.success('CRM Visit Report deleted successfully.');
        navigate('/operations/smart-crm');
      } catch (err) {
        console.error('Failed to delete report', err);
        showToast.error('Deletion failed.');
      }
    }
  };

  const statusBadges =
    {
      Draft: 'bg-gray-100 text-gray-600 border-gray-200',
      Submitted: 'bg-blue-50 text-blue-700 border-blue-200',
      Qualified: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'Proposal Sent': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Trial Running': 'bg-pink-50 text-pink-700 border-pink-200',
      Negotiation: 'bg-orange-50 text-orange-700 border-orange-200',
      Won: 'bg-green-50 text-green-700 border-green-200',
      Lost: 'bg-red-50 text-red-700 border-red-200',
      Archived: 'bg-gray-200 text-gray-800 border-gray-300',
    }[report.status] || 'bg-gray-100 text-gray-600 border-gray-200';

  // ── Dynamic fields (render everything stored, no hardcoding) ──────────────
  const dynamicObj = (report.dynamicFields || {}) as Record<string, unknown>;
  const productRequirements: any[] = Array.isArray(dynamicObj.productRequirements)
    ? (dynamicObj.productRequirements as any[])
    : [];
  const extraDynamicEntries = Object.entries(dynamicObj).filter(
    ([k, v]) =>
      k !== 'productRequirements' &&
      v !== null &&
      v !== undefined &&
      v !== '' &&
      !(Array.isArray(v) && v.length === 0)
  );

  // ── Ratings (0–10 sliders) + conversion probability ──────────────────────
  const ratingItems: { label: string; value?: number }[] = [
    { label: 'Follow-up Urgency', value: report.followupUrgencyScore },
    { label: 'Customer Confidence', value: report.dealerConfidence },
    { label: 'Payment Reliability', value: report.paymentReliability },
    { label: 'Relationship Strength', value: report.relationshipStrength },
    { label: 'Technical Capability', value: report.technicalCapability },
    { label: 'Long-Term Potential', value: report.longTermPotential },
  ];

  const uploads = Array.isArray(report.uploads) ? report.uploads : [];
  const imageUploads = uploads.filter(isImageUpload);
  const docUploads = uploads.filter(u => !isImageUpload(u));

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/operations/smart-crm')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Back to list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800">
                {report.customerName || 'Unnamed Customer'}
              </h1>
              <span className={`badge ${statusBadges} border whitespace-normal`}>
                {report.status}
              </span>
              {statuses.map(status => (
                <span
                  key={status}
                  className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold px-2 py-0.5 rounded-full"
                >
                  {status}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
              <span>
                Report{' '}
                <span className="font-bold text-gray-700">{report.reportNumber || 'N/A'}</span>
              </span>
              <span>
                Visit Date{' '}
                <span className="font-bold text-gray-700">
                  {report.visitDate
                    ? new Date(report.visitDate).toLocaleDateString('en-IN')
                    : 'N/A'}
                </span>
              </span>
              <span>
                Executive{' '}
                <span className="font-bold text-gray-700">{report.executiveName || 'System'}</span>
              </span>
              <span>
                Customer{' '}
                <span className="font-bold text-gray-700">
                  {report.contactPerson || report.customerName || 'N/A'}
                </span>
              </span>
              <span>
                Created{' '}
                <span className="font-bold text-gray-700">
                  {report.createdAt
                    ? new Date(report.createdAt).toLocaleDateString('en-IN')
                    : 'N/A'}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setShowAiConsole(true);
              setConsoleTab('dashboard');
              if (!aiInsights) {
                fetchAiInsights();
              }
            }}
            className="btn bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-4 py-2.5 flex items-center justify-center gap-1.5 flex-1 sm:flex-initial text-sm min-h-[44px] w-full sm:w-auto font-semibold shadow-sm border border-indigo-500/20"
          >
            <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
            Decision Console
          </button>
          {/* Edit is available only for Draft reports (admin or the report owner).
              Submitted (and any non-draft) reports are locked — no Edit. */}
          {report.status === 'Draft' &&
            (user?.Role === 'Admin' ||
              user?.Role === 'SuperAdmin' ||
              Number(report.executiveId) === Number(user?.EmployeeID) ||
              Number(report.createdBy) === Number(user?.EmployeeID)) && (
              <button
                onClick={() => navigate(`/operations/smart-crm/${report.id}/edit`)}
                className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2.5 flex items-center justify-center gap-1.5 flex-1 sm:flex-initial text-sm min-h-[44px] w-full sm:w-auto"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
            )}
          {(user?.Role === 'Admin' || user?.Role === 'SuperAdmin') && (
            <button
              onClick={handleDelete}
              className="btn border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2.5 flex items-center justify-center gap-1.5 flex-1 sm:flex-initial text-sm min-h-[44px] w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border p-2 flex flex-wrap gap-2">
        {(
          [
            { id: 'profile', label: 'Customer Profile', icon: User },
            { id: 'technical', label: 'Technical Spec', icon: FileText },
            { id: 'commercial', label: 'Commercials', icon: TrendingUp },
            { id: 'ratings', label: 'Ratings & Intelligence', icon: Star },
            { id: 'competitors', label: 'Competitors', icon: Activity },
            { id: 'followups', label: 'Action Followups', icon: Clock },
            { id: 'attachments', label: 'Attachments', icon: ImageIcon },
            { id: 'ai', label: 'Paint OS AI', icon: Sparkles },
          ] as const
        ).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center text-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer min-h-[44px] flex-1 sm:flex-initial ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[300px]">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
              Customer & Visit Profile
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Customer Name</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{report.customerName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Category</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.businessCategory || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Contact Person</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.contactPerson || 'N/A'} ({report.designation || 'N/A'})
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Mobile / WhatsApp</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.mobile || 'N/A'} {report.whatsapp && `/ WA: ${report.whatsapp}`}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">GSTIN</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{report.gstNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Email ID</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{report.email || 'N/A'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">Address</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.address || 'N/A'}
                  {report.city && `, ${report.city}`}
                  {report.state && `, ${report.state}`}
                  {report.pinCode && ` - ${report.pinCode}`}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">GPS Location</p>
                <p className="text-sm font-bold text-gray-800 mt-1 flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-red-500" />
                  {report.gpsLatitude ? `${report.gpsLatitude}, ${report.gpsLongitude}` : 'N/A'}
                </p>
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Visit Duration</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.visitDuration ? `${report.visitDuration} Minutes` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Visit Purpose</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {Array.isArray(report.visitPurpose) && report.visitPurpose.length > 0
                    ? report.visitPurpose.join(', ')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Time In / Out</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.timeIn || 'N/A'} — {report.timeOut || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Branch / Region</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.branch || 'N/A'}
                  {report.region ? ` / ${report.region}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Area</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{report.area || 'N/A'}</p>
              </div>
            </div>

            {/* Additional stored customer fields — rendered generically so any new
                form field automatically appears here without code changes. */}
            {extraDynamicEntries.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-bold text-gray-800 mb-3">Additional Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {extraDynamicEntries.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs font-semibold text-gray-400 uppercase">
                        {prettyLabel(k)}
                      </p>
                      <p className="text-sm font-bold text-gray-800 mt-1 break-words">
                        {displayVal(v)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product requirements captured on the visit */}
            {productRequirements.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-bold text-gray-800 mb-3">Product Requirements</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productRequirements.map((pr, idx) => (
                    <div key={idx} className="card p-4 border bg-gray-50">
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(pr).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase">
                              {prettyLabel(k)}
                            </p>
                            <p className="text-xs font-bold text-gray-800 mt-0.5 break-words">
                              {displayVal(v)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Technical Specs Tab */}
        {activeTab === 'technical' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
              Technical Specifications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Paint Requirements</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {Array.isArray(report.paintRequirementTypes) &&
                  report.paintRequirementTypes.length > 0
                    ? report.paintRequirementTypes.join(', ')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Surface Substrates</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {Array.isArray(report.surfaceTypes) && report.surfaceTypes.length > 0
                    ? report.surfaceTypes.join(', ')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Application Systems</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {Array.isArray(report.applicationMethods) && report.applicationMethods.length > 0
                    ? report.applicationMethods.join(', ')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  Technical Challenges
                </p>
                <p className="text-sm font-bold text-gray-800 mt-1 text-red-600">
                  {Array.isArray(report.technicalChallenges) &&
                  report.technicalChallenges.length > 0
                    ? report.technicalChallenges.join(', ')
                    : 'None Reported'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Required Shade</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.requiredShade || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Required Finish</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.requiredFinish || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Commercials Tab */}
        {activeTab === 'commercial' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Commercial Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Current Supplier</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.currentSupplier || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  Est. Monthly Consumption
                </p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  ₹{parseFloat(String(report.monthlyConsumption || 0)).toLocaleString('en-IN')}{' '}
                  {report.monthlyConsumptionText && `(${report.monthlyConsumptionText})`}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  Credit Days Required
                </p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.creditDays || 0} Days
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  Subcontractor Outstanding
                </p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  ₹{parseFloat(String(report.outstandingAmount || 0)).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  Expected Purchase Price (₹/Ltr)
                </p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  ₹{parseFloat(String(report.expectedRate || 0))} (Current: ₹
                  {parseFloat(String(report.currentPurchaseRate || 0))})
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  Procurement Decision Maker
                </p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.purchaseDecisionBy || 'N/A'}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-800 mb-2">Discussion Notes & Strategy</h4>
              <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border whitespace-pre-line">
                {cleanNotes}
              </p>
            </div>
          </div>
        )}

        {/* Competitors Tab */}
        {activeTab === 'competitors' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Competitor Analysis</h3>
            {report.competitors && report.competitors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.competitors.map((comp, idx) => (
                  <div key={idx} className="card p-5 border bg-gray-50 relative hover-lift">
                    <h4 className="font-bold text-base text-primary mb-3 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary-500"></span>
                      {comp.competitorName}
                    </h4>
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="font-bold text-gray-500 uppercase">Strengths</span>
                        <p className="text-sm text-gray-700 mt-0.5">{comp.strengths || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-gray-500 uppercase">Weaknesses</span>
                        <p className="text-sm text-gray-700 mt-0.5">{comp.weaknesses || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-gray-500 uppercase">
                          Reason Using Competitor
                        </span>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {comp.reasonUsingCompetitor || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-bold text-gray-500 uppercase">
                          Displacement Strategy
                        </span>
                        <p className="text-sm text-gray-700 mt-0.5">
                          {comp.reasonShiftToUs || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl border border-dashed">
                No competitors cataloged for this customer visit.
              </p>
            )}
          </div>
        )}

        {/* Followups Tab */}
        {activeTab === 'followups' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Action Followups</h3>
            {report.followups && report.followups.length > 0 ? (
              <div className="space-y-4">
                {report.followups.map((follow, idx) => {
                  return (
                    <div
                      key={idx}
                      className="flex items-start border p-4 rounded-xl bg-white shadow-sm gap-3"
                    >
                      <span className="bg-primary-50 text-primary p-2 rounded-lg flex-shrink-0">
                        <Clock className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{follow.notes}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Due Date: {new Date(follow.followupDate).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl border border-dashed">
                No followups scheduled for this report.
              </p>
            )}
          </div>
        )}

        {/* Ratings & Executive Intelligence Tab */}
        {activeTab === 'ratings' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
              Ratings & Executive Intelligence
            </h3>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                Conversion Probability
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 max-w-xs">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(Number(report.conversionProbability) || 0, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {report.conversionProbability ?? 0}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ratingItems.map(r => (
                <div key={r.label} className="border rounded-xl p-4 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase">{r.label}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${((Number(r.value) || 0) / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-800">{r.value ?? 0}/10</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Customer Mood</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.customerMood || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">
                  Immediate Requirement
                </p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.immediateRequirement || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Expected Order Qty</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.expectedOrderQuantity || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Expected Order Date</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.expectedOrderDate && !isNaN(new Date(report.expectedOrderDate).getTime())
                    ? new Date(report.expectedOrderDate).toLocaleDateString('en-IN')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Trial Approved</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.trialApproved ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Sample Given</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {report.sampleGiven ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              {[
                { label: 'Important Observations', value: report.importantObservations },
                { label: 'Risk Factors', value: report.riskFactors },
                { label: 'Hidden Opportunity', value: report.hiddenOpportunity },
                { label: 'Executive Recommendation', value: report.executiveRecommendation },
              ].map(item => (
                <div key={item.label}>
                  <h4 className="font-bold text-gray-800 mb-1">{item.label}</h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border whitespace-pre-line">
                    {item.value || 'N/A'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments Tab */}
        {activeTab === 'attachments' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Attachments</h3>
            {uploads.length === 0 ? (
              <p className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl border border-dashed">
                No photos or documents attached to this report.
              </p>
            ) : (
              <>
                {imageUploads.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> Photos ({imageUploads.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {imageUploads.map((u, idx) => (
                        <button
                          key={u.id || idx}
                          type="button"
                          onClick={() => setLightbox(fileUrl(u.filePath))}
                          className="group relative aspect-square rounded-xl overflow-hidden border bg-gray-100 flex"
                          title={u.fileName}
                        >
                          <img
                            src={fileUrl(u.filePath)}
                            alt={u.fileName || `Photo ${idx + 1}`}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={e => {
                              const el = e.currentTarget as HTMLImageElement;
                              el.onerror = null;
                              el.src =
                                'data:image/svg+xml;utf8,' +
                                encodeURIComponent(
                                  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" font-size="9" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">Image unavailable</text></svg>'
                                );
                            }}
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1.5 py-0.5 truncate">
                            {u.fileType || 'Photo'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {docUploads.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Paperclip className="h-4 w-4" /> Documents ({docUploads.length})
                    </h4>
                    <div className="space-y-2">
                      {docUploads.map((u, idx) => (
                        <a
                          key={u.id || idx}
                          href={fileUrl(u.filePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 border rounded-xl p-3 hover:bg-gray-50"
                        >
                          <FileText className="h-5 w-5 text-primary" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">
                              {u.fileName || 'Document'}
                            </p>
                            <p className="text-xs text-gray-500">{u.fileType || 'File'}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* AI Insight Panel Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-lg font-extrabold text-indigo-950 flex items-center justify-center md:justify-start gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                  PaintOS Sales Decision Support Console
                </h3>
                <p className="text-sm text-indigo-800 max-w-xl">
                  Analyze this visit report dynamically using advanced paint-industry strategic
                  models. View health scores, win probabilities, objections playbooks, and interact
                  with the AI assistant.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAiConsole(true);
                  setConsoleTab('dashboard');
                  if (!aiInsights) {
                    fetchAiInsights();
                  }
                }}
                className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-md border border-indigo-700/30 whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                Launch Support Console
              </button>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                Static Visit Observations
              </h3>
              {report.insights && report.insights.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 max-h-[380px] overflow-y-auto pr-1">
                  {report.insights.map((insight, idx) => {
                    const severityColors =
                      {
                        low: 'bg-blue-50 border-blue-200 text-blue-800',
                        medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                        high: 'bg-orange-50 border-orange-200 text-orange-800',
                        critical: 'bg-red-50 border-red-200 text-red-800',
                      }[insight.severity] || 'bg-gray-50 border-gray-200 text-gray-800';

                    return (
                      <div
                        key={idx}
                        className={`border p-4 rounded-xl shadow-sm ${severityColors} flex flex-col gap-2`}
                      >
                        <div className="flex justify-between items-center border-b pb-1.5 border-black/10">
                          <span className="text-xs font-extrabold uppercase tracking-wide">
                            {insight.insightType}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-white/70 uppercase">
                            {insight.severity}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm">{insight.observation}</h4>
                        {insight.reasoning && (
                          <p className="text-xs opacity-90">{insight.reasoning}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl border border-dashed">
                  No Paint OS AI recommendations generated for this visit yet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox for enlarging photos — portal so it overlays the whole viewport */}
      {lightbox &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
              title="Close"
            >
              <X className="h-7 w-7" />
            </button>
            <img
              src={lightbox}
              alt="Attachment preview"
              className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
      {/* CRM Sales Decision Support Console Modal.
          Rendered via portal to document.body so it is anchored to the VIEWPORT —
          not clipped by the sidebar/header stacking contexts or any transformed
          ancestor inside the page layout. */}
      {showAiConsole &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div
              className="bg-slate-50 border rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[92vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg flex-shrink-0">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                      CRM Sales Decision Support Console
                    </h2>
                    <p className="text-xs text-slate-500 font-medium hidden sm:block">
                      Evaluate strategic health, objections playbook and opportunity insights
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[10px] uppercase px-3 py-1 rounded-full tracking-wider hidden md:flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-500 fill-indigo-500" />
                    Powered by PaintOS AI
                  </span>
                  <button
                    onClick={() => setShowAiConsole(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    title="Close Console"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal Sub-Tabs */}
              <div className="bg-slate-100 px-4 sm:px-6 py-2 border-b flex flex-wrap gap-2 flex-shrink-0">
                <button
                  onClick={() => setConsoleTab('dashboard')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    consoleTab === 'dashboard'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  Executive Dashboard
                </button>
                <button
                  onClick={() => {
                    setConsoleTab('assistant');
                    // Pre-initialize chat messages if empty
                    if (chatMessages.length === 0) {
                      setChatMessages([
                        {
                          role: 'assistant',
                          content: `Hello! I am your PaintOS CRM Copilot. I have loaded this visit report for **${report.customerName || 'Unnamed Customer'}** (${report.visitType || 'Visit'}). \n\nHow can I help you prepare for the next follow-up?`,
                          timestamp: new Date(),
                        },
                      ]);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    consoleTab === 'assistant'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  PaintOS AI Assistant
                </button>
              </div>

              {/* Modal Content Scroll Area */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                {insightsLoading ? (
                  <div className="flex flex-col items-center justify-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <span className="mt-4 text-slate-500 font-bold text-sm tracking-wide">
                      AI Engine generating structured sales insights...
                    </span>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                      Parsing visit data, comparing customer timeline history, and computing pricing
                      block risk profiles.
                    </p>
                  </div>
                ) : consoleTab === 'dashboard' ? (
                  // EXECUTIVE DASHBOARD CONTENT — computed from the real report;
                  // AI narrative sections enrich it when available.
                  <div className="space-y-6">
                    {/* AI enrichment notice when the AI provider returned nothing */}
                    {!aiInsights && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-xs flex items-center justify-between gap-3 flex-wrap">
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                          AI enrichment is unavailable right now — showing metrics computed from
                          this report.
                        </span>
                        <button
                          onClick={fetchAiInsights}
                          className="font-bold underline hover:no-underline whitespace-nowrap"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Row 1: 4 Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {/* Customer Health */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-40">
                        <div>
                          <div className="flex justify-between items-center mb-1 gap-2">
                            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                              🍬 Customer Health
                            </span>
                            <span className="text-2xl font-black text-emerald-600">
                              {consoleData?.healthScore ?? 0}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${consoleData?.healthScore ?? 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal line-clamp-3">
                          Composite of relationship strength, payment reliability and customer
                          confidence recorded on this visit.
                        </p>
                      </div>

                      {/* Opportunity Score */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-40">
                        <div>
                          <div className="flex justify-between items-center mb-1 gap-2">
                            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                              🎯 Opportunity Score
                            </span>
                            <span className="text-2xl font-black text-violet-600">
                              {consoleData?.opportunityScore ?? 0}/100
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3 overflow-hidden">
                            <div
                              className="bg-violet-500 h-full rounded-full"
                              style={{ width: `${consoleData?.opportunityScore ?? 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal line-clamp-3">
                          Calculated from long-term potential, relationship strength, payment
                          reliability, and technical capability.
                        </p>
                      </div>

                      {/* Win Probability */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-40">
                        <div>
                          <div className="flex justify-between items-center mb-1 gap-2">
                            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                              📊 Win Probability
                            </span>
                            <span className="text-2xl font-black text-blue-600">
                              {consoleData?.winProbability ?? 0}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full"
                              style={{ width: `${consoleData?.winProbability ?? 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal line-clamp-3">
                          Conversion probability captured on this visit report.
                        </p>
                      </div>

                      {/* Monthly Forecast */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-40">
                        <div>
                          <div className="flex justify-between items-center mb-1 gap-2">
                            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                              💰 Monthly Forecast
                            </span>
                            <span className="text-xl font-black text-amber-600 break-all">
                              {consoleData?.hasForecast
                                ? `₹${(consoleData?.monthlyForecast ?? 0).toLocaleString('en-IN')}`
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3 overflow-hidden opacity-0">
                            <div className="h-full rounded-full"></div>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200/50 p-2 rounded-xl text-center break-all">
                          {consoleData?.hasForecast
                            ? `Annual: ₹${(consoleData?.annualForecast ?? 0).toLocaleString('en-IN')}`
                            : 'Annual forecast not available'}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: 2 Column Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left Column: Change Detection & Blockers */}
                      <div className="space-y-6">
                        {/* Change & Exception Detection */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-blue-500 text-white p-1 rounded-md text-[10px]">
                              🔄
                            </span>
                            Change & Exception Detection
                          </h4>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-50 p-3 rounded-xl border min-w-0">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                                Current Supplier
                              </span>
                              <p className="text-sm font-bold text-slate-800 mt-0.5 break-words">
                                {report.currentSupplier && report.currentSupplier !== 'N/A'
                                  ? report.currentSupplier
                                  : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border min-w-0">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                                Monthly Volume
                              </span>
                              <p className="text-sm font-bold text-slate-800 mt-0.5 break-words">
                                {report.monthlyConsumptionText &&
                                report.monthlyConsumptionText !== 'N/A'
                                  ? report.monthlyConsumptionText
                                  : consoleData?.hasForecast
                                    ? `₹${(consoleData?.monthlyForecast ?? 0).toLocaleString('en-IN')}`
                                    : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border min-w-0">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                                Credit Cycle
                              </span>
                              <p className="text-sm font-bold text-slate-800 mt-0.5">
                                {report.creditDays ? `${report.creditDays}d` : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border min-w-0">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                                Win Chance
                              </span>
                              <p className="text-sm font-bold text-slate-800 mt-0.5">
                                {consoleData?.winProbability ?? 0}%
                              </p>
                            </div>
                          </div>

                          <div className="border-t pt-3">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-2">
                              Signal Summary
                            </span>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1">
                                📊 Conversion: {consoleData?.winProbability ?? 0}%
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border ${
                                  consoleData?.competitorThreat === 'Present'
                                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                                    : 'bg-green-50 border-green-200 text-green-700'
                                }`}
                              >
                                🛡️ Competitor threat: {consoleData?.competitorThreat ?? 'Low'}
                              </span>
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-1">
                                🤝 Relationship: {consoleData?.relationshipLevel ?? 'N/A'}
                              </span>
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1">
                                ⭐ Confidence: {consoleData?.confidenceLevel ?? 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Active Order Blockers & Playbook Counters */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span className="bg-rose-500 text-white p-1 rounded-md text-[10px]">
                              🛡️
                            </span>
                            Active Order Blockers & Playbook Counters
                          </h4>

                          <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                            {(aiInsights?.objectionsDetected || []).map(
                              (objection: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="border border-rose-100 bg-rose-50/20 p-4 rounded-xl space-y-2"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <span className="h-2 w-2 rounded-full bg-rose-600 mt-1.5 flex-shrink-0"></span>
                                    <p className="text-xs font-bold text-slate-800">
                                      BLOCKER: {objection}
                                    </p>
                                  </div>
                                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-start gap-2">
                                    <span className="text-slate-600 mt-0.5 text-xs flex-shrink-0">
                                      👉
                                    </span>
                                    <p className="text-xs text-slate-600 italic break-words">
                                      Playbook Counter:{' '}
                                      {aiInsights?.salespersonCoaching?.negotiationTips ||
                                        'Prepare a tailored counter for this objection.'}
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                            {(!aiInsights?.objectionsDetected ||
                              aiInsights?.objectionsDetected.length === 0) &&
                              (report.riskFactors && report.riskFactors !== 'N/A' ? (
                                <div className="border border-rose-100 bg-rose-50/20 p-4 rounded-xl">
                                  <div className="flex items-start gap-2.5">
                                    <span className="h-2 w-2 rounded-full bg-rose-600 mt-1.5 flex-shrink-0"></span>
                                    <p className="text-xs font-bold text-slate-800 break-words">
                                      Risk noted on visit: {report.riskFactors}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 text-center py-4">
                                  No active blockers recorded on this visit.
                                </p>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Discussion Topics & Opportunities */}
                      <div className="space-y-6">
                        {/* Recommended Discussion Topics (Prioritized) */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-violet-500 text-white p-1 rounded-md text-[10px]">
                              📋
                            </span>
                            Recommended Discussion Topics (Prioritized)
                          </h4>

                          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                            {(aiInsights?.nextBestActions || []).map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 border-b pb-2 last:border-0 last:pb-0"
                              >
                                <span className="text-indigo-600 font-bold text-sm mt-0.5">✓</span>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{item.action}</p>
                                  {item.reason && (
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      {item.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {(!aiInsights?.nextBestActions ||
                              aiInsights?.nextBestActions.length === 0) && (
                              <p className="text-xs text-slate-500 text-center py-4">
                                No recommended topics generated.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Highest Growth Opportunity */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="bg-emerald-500 text-white p-1 rounded-md text-[10px]">
                              ⚡
                            </span>
                            Highest Growth Opportunity
                          </h4>

                          <div className="space-y-4">
                            <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100/50 min-w-0">
                              <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-600 block mb-1">
                                Target Product / Requirement
                              </span>
                              <p className="text-sm font-extrabold text-emerald-950 break-words">
                                {aiInsights?.recommendedProducts?.[0]?.product ||
                                  (report.requiredShade && report.requiredShade !== 'N/A'
                                    ? report.requiredShade
                                    : report.paintRequirementTypes &&
                                        report.paintRequirementTypes.length > 0
                                      ? report.paintRequirementTypes.join(', ')
                                      : 'N/A')}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 break-words">
                                {consoleData?.hasForecast
                                  ? `Forecast value: ₹${(consoleData?.annualForecast ?? 0).toLocaleString('en-IN')} annual`
                                  : 'Annual forecast not available'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                              <div className="min-w-0">
                                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                                  Cross-Sell Options
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {aiInsights?.crossSellingOpportunities?.[0]?.opportunity ? (
                                    <span className="text-[10px] font-extrabold bg-violet-50 border border-violet-200 text-violet-700 px-2 py-0.5 rounded-md break-words">
                                      + {aiInsights.crossSellingOpportunities[0].opportunity}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">N/A</span>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                                    Expected Closing
                                  </span>
                                  <span className="text-xs font-bold text-slate-800 block mt-0.5">
                                    {aiInsights?.salesForecast?.expectedClosingTime || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">
                                    Follow-up Urgency
                                  </span>
                                  <span className="text-xs font-bold text-slate-800 block mt-0.5">
                                    {consoleData?.urgency ?? 0}/10
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Footer Decision Directive Banner */}
                    <div className="bg-indigo-900 text-white px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="bg-amber-400 text-indigo-950 p-1.5 rounded-xl text-xs font-black">
                          ⚡
                        </span>
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase tracking-wider text-indigo-300 font-extrabold block">
                            Decision Directive: Immediate Next Visit Action
                          </span>
                          <p className="text-sm font-extrabold break-words">
                            {aiInsights?.followUpPlan?.[0]?.action ||
                              aiInsights?.aiRecommendations?.[0]?.action ||
                              (report.immediateRequirement && report.immediateRequirement !== 'N/A'
                                ? report.immediateRequirement
                                : report.executiveRecommendation &&
                                    report.executiveRecommendation !== 'N/A'
                                  ? report.executiveRecommendation
                                  : 'No specific next-visit directive recorded on this report.')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                        <span className="text-[11px] font-bold text-indigo-200 whitespace-nowrap">
                          Target:{' '}
                          {aiInsights?.followUpPlan?.[0]?.suggestedDate &&
                          !isNaN(new Date(aiInsights.followUpPlan[0].suggestedDate).getTime())
                            ? new Date(aiInsights.followUpPlan[0].suggestedDate).toLocaleDateString(
                                'en-IN',
                                { day: 'numeric', month: 'short', year: 'numeric' }
                              )
                            : 'Not scheduled'}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase bg-amber-400 text-indigo-950 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {aiInsights?.followUpPlan?.[0]?.priority ||
                            ((consoleData?.urgency ?? 0) >= 7
                              ? 'High'
                              : (consoleData?.urgency ?? 0) >= 4
                                ? 'Medium'
                                : 'Low')}{' '}
                          Priority
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // PAINTOS AI ASSISTANT CHAT CONTENT
                  <div className="flex flex-col h-[52vh] bg-white rounded-2xl border shadow-sm overflow-hidden">
                    {/* Messages list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-3 max-w-[85%] ${
                            msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              msg.role === 'user'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 text-slate-700 border'
                            }`}
                          >
                            {msg.role === 'user' ? 'U' : 'AI'}
                          </div>
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                              msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-white border rounded-tl-none text-slate-800 shadow-sm'
                            }`}
                          >
                            {msg.content || (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                                  style={{ animationDelay: '0ms' }}
                                ></span>
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                                  style={{ animationDelay: '150ms' }}
                                ></span>
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                                  style={{ animationDelay: '300ms' }}
                                ></span>
                              </span>
                            )}
                            <span
                              className={`block text-[9px] mt-1.5 text-right ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div ref={chatMessagesEndRef} />
                    </div>

                    {/* Chat input form */}
                    <form
                      onSubmit={async e => {
                        e.preventDefault();
                        if (!chatInput.trim() || chatLoading) return;
                        const text = chatInput.trim();
                        setChatInput('');
                        setChatLoading(true);

                        const userMsg = {
                          role: 'user' as const,
                          content: text,
                          timestamp: new Date(),
                        };
                        const updatedMessages = [...chatMessages, userMsg];
                        setChatMessages(updatedMessages);

                        const abortCtrl = new AbortController();
                        setChatAbortController(abortCtrl);

                        const placeholderMsg = {
                          role: 'assistant' as const,
                          content: '',
                          timestamp: new Date(),
                        };
                        setChatMessages(prev => [...prev, placeholderMsg]);

                        try {
                          const apiHistory = updatedMessages.map(m => ({
                            role: m.role,
                            content: m.content,
                          }));

                          const response = await fieldIntelligenceApi.chatWithCopilot(
                            id!,
                            apiHistory,
                            abortCtrl.signal
                          );

                          if (!response.ok) {
                            throw new Error('Connection failed');
                          }

                          const reader = response.body?.getReader();
                          const decoder = new TextDecoder();
                          let accumulated = '';

                          if (reader) {
                            while (true) {
                              const { done, value } = await reader.read();
                              if (done) break;

                              const chunk = decoder.decode(value);
                              const lines = chunk.split('\n');
                              for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                  const jsonStr = line.slice(6).trim();
                                  if (jsonStr === '[DONE]') continue;
                                  try {
                                    const parsed = JSON.parse(jsonStr);
                                    const textChunk = parsed.choices?.[0]?.delta?.content || '';
                                    accumulated += textChunk;

                                    setChatMessages(prev => {
                                      const copy = [...prev];
                                      if (copy.length > 0) {
                                        copy[copy.length - 1] = {
                                          ...copy[copy.length - 1],
                                          content: accumulated,
                                        };
                                      }
                                      return copy;
                                    });
                                  } catch {
                                    // ignore json parse errors
                                  }
                                }
                              }
                            }
                          }
                        } catch (err: any) {
                          if (err.name === 'AbortError') {
                            showToast.error('Chat stopped.');
                          } else {
                            setChatMessages(prev => {
                              const copy = [...prev];
                              if (copy.length > 0) {
                                copy[copy.length - 1] = {
                                  ...copy[copy.length - 1],
                                  content:
                                    '⚠️ Failed to connect to PaintOS AI engine. Please verify network or API keys.',
                                };
                              }
                              return copy;
                            });
                          }
                        } finally {
                          setChatLoading(false);
                          setChatAbortController(null);
                        }
                      }}
                      className="border-t p-3 bg-white flex gap-2 flex-shrink-0"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        disabled={chatLoading}
                        placeholder="Ask PaintOS AI about supplier risks, products, or closing tips..."
                        className="flex-1 border rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      {chatLoading ? (
                        <button
                          type="button"
                          onClick={() => {
                            chatAbortController?.abort();
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={!chatInput.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all whitespace-nowrap shadow-sm"
                        >
                          Send
                        </button>
                      )}
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
export default FieldIntelligenceViewPage;
