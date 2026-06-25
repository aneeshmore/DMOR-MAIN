import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  Calendar,
  Package,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  Hash,
  Clock,
  BarChart3,
  Eye,
  Edit,
  AlertTriangle,
  Award,
  Activity,
  ThumbsUp,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-50 text-blue-700 border-blue-100',
  Approved: 'bg-green-50 text-green-700 border-green-100',
  Qualified: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  'Proposal Sent': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Trial Running': 'bg-pink-50 text-pink-700 border-pink-100',
  Negotiation: 'bg-orange-50 text-orange-700 border-orange-100',
  Won: 'bg-green-50 text-green-700 border-green-100',
  Lost: 'bg-red-50 text-red-700 border-red-100',
  Archived: 'bg-gray-200 text-gray-800 border-gray-300',
};

// Enhancement 9: Centralized score color coding
export const getScoreColorClass = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-400 border-gray-200';
  const scoreNum = Number(score);
  if (isNaN(scoreNum)) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (scoreNum >= 8) return 'bg-green-100 text-green-800 border-green-200';
  if (scoreNum >= 5) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

// Date formatter helper: e.g. 14-Jan-2026
const formatDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '—';

  const day = date.getDate();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

const Chip: React.FC<{ label: string }> = ({ label }) =>
  label ? (
    <span className="inline-block bg-primary-50 text-[var(--primary)] text-xs font-semibold px-2.5 py-1 rounded-full mr-1.5 mb-1.5 border border-primary-100 hover:bg-primary-100 transition-colors">
      {label}
    </span>
  ) : null;

const InfoRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value?: string | number | null;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 px-2 rounded-lg transition-colors">
    {icon && <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>}
    <span className="text-xs font-bold text-gray-500 w-36 flex-shrink-0 uppercase tracking-wider">
      {label}
    </span>
    <span className="text-sm text-gray-800 font-semibold">{value || '—'}</span>
  </div>
);

export const CustomerDashboardPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [activeTrendMetric, setActiveTrendMetric] = useState<'conversion' | 'relationship'>(
    'conversion'
  );

  useEffect(() => {
    if (!customerId || isNaN(Number(customerId))) {
      setError('Invalid customerId');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fieldIntelligenceApi.getCustomerDashboard(Number(customerId));
        if (!result || !result.profile) {
          setError('Customer record not found');
        } else {
          setData(result);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Customer record not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 border-t-2" />
        <span className="text-gray-500 font-bold text-sm tracking-wide">
          Retrieving Customer Intelligence...
        </span>
      </div>
    );
  }

  // Enhancement 2: Customer Dashboard Route Protection
  if (error || !data) {
    const isAccessDenied =
      error?.toLowerCase().includes('access denied') ||
      error?.toLowerCase().includes('permission') ||
      error?.toLowerCase().includes('forbidden');
    return (
      <div className="card p-8 text-center border-red-200 bg-red-50 text-red-700 max-w-md mx-auto mt-12 shadow-lg rounded-2xl">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-500 animate-bounce" />
        <h3 className="font-extrabold text-xl mb-1.5">
          {isAccessDenied ? 'ACCESS DENIED' : 'Customer record not found'}
        </h3>
        <p className="text-sm mb-5 text-red-650">
          {isAccessDenied
            ? 'You do not have permission to view this customer dashboard.'
            : 'The requested customer record does not exist or has been deleted.'}
        </p>
        <button
          onClick={() => navigate('/operations/field-intelligence')}
          className="btn bg-[var(--primary)] text-white px-5 py-2.5 font-bold shadow-md rounded-xl transition-all cursor-pointer"
        >
          {isAccessDenied ? 'Back to Customer Intelligence' : 'Back to SMART CRM'}
        </button>
      </div>
    );
  }

  const { profile, analytics, sales, products, visits } = data;

  // Chronological visits (oldest first for line chart)
  const chronologicalVisits = [...visits].sort(
    (a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
  );

  // SVG Chart Calculations
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const getCoordinates = (metric: 'conversion' | 'relationship') => {
    if (chronologicalVisits.length === 0) return [];

    return chronologicalVisits.map((visit, index) => {
      const x =
        chronologicalVisits.length > 1
          ? paddingX + (index * (chartWidth - 2 * paddingX)) / (chronologicalVisits.length - 1)
          : chartWidth / 2;

      let value = 0;
      if (metric === 'conversion') {
        value = visit.conversionProbability ?? 0;
      } else {
        // Normalize rating out of 10 to a percentage (e.g. 5 -> 50%)
        value = (visit.relationshipStrength ?? 5) * 10;
      }

      const y = chartHeight - paddingY - (value * (chartHeight - 2 * paddingY)) / 100;
      return { x, y, value, visit };
    });
  };

  const points = getCoordinates(activeTrendMetric);

  // Build SVG Path
  const getLinePath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    return coords.reduce(
      (acc, c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`),
      ''
    );
  };

  const getAreaPath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    const linePath = getLinePath(coords);
    const startX = coords[0].x;
    const endX = coords[coords.length - 1].x;
    const baseY = chartHeight - paddingY;
    return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  };

  const linePath = getLinePath(points);
  const areaPath = getAreaPath(points);

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/operations/field-intelligence')}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-[var(--primary)]" />
              {profile.customerName}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 font-medium">
              Customer Intelligence Dashboard · Account ID #{customerId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-primary-50 text-[var(--primary)] text-xs font-bold px-3 py-1.5 rounded-xl border border-primary-100">
            {analytics.totalVisits} Total Visits
          </span>
          <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-green-100">
            {analytics.avgConversionProbability}% Avg Conversion
          </span>
          {visits[0]?.status && (
            <span
              className={`badge border text-xs px-3 py-1.5 rounded-xl font-bold ${STATUS_BADGE[visits[0].status] || 'bg-gray-100 text-gray-600'}`}
            >
              Latest Status: {visits[0].status}
            </span>
          )}
        </div>
      </div>

      {/* KPI Row (Enhancement 6 & 8) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: 'Total Visits',
            value: analytics.totalVisits,
            icon: <Calendar className="h-5 w-5" />,
            color: 'bg-blue-50 text-blue-600 border-blue-100',
          },
          {
            label: 'Submitted Reports',
            value: analytics.submittedVisits ?? 0,
            icon: <ThumbsUp className="h-5 w-5" />,
            color: 'bg-green-50 text-green-600 border-green-100',
          },
          {
            label: 'Draft Reports',
            value: analytics.draftVisits ?? 0,
            icon: <Edit className="h-5 w-5" />,
            color: 'bg-gray-50 text-gray-600 border-gray-100',
          },
          {
            label: 'Average Conversion',
            value: `${analytics.avgConversionProbability}%`,
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
          },
          {
            label: 'Latest Visit',
            value: formatDate(analytics.latestVisitDate),
            icon: <BarChart3 className="h-5 w-5" />,
            color: 'bg-purple-50 text-purple-600 border-purple-100',
          },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="card p-4 flex items-center gap-3 border shadow-sm rounded-2xl hover:shadow-md transition-all"
          >
            <div className={`p-2.5 rounded-xl ${kpi.color} border`}>{kpi.icon}</div>
            <div>
              <p className="text-[9px] font-bold text-gray-405 uppercase tracking-widest">
                {kpi.label}
              </p>
              <p className="text-lg font-extrabold text-gray-800 mt-0.5">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile & Sales Information */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <div className="card p-5 border shadow-sm rounded-2xl bg-white">
            <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <Building2 className="h-4.5 w-4.5 text-[var(--primary)]" />
              Customer Profile
            </h3>
            <div className="space-y-1">
              <InfoRow
                icon={<Phone className="h-4 w-4" />}
                label="Contact Person"
                value={profile.contactPerson}
              />
              <InfoRow label="Designation" value={profile.designation} />
              <InfoRow label="Business Category" value={profile.businessCategory} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={profile.mobile} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
              <InfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="City / State"
                value={[profile.city, profile.state].filter(Boolean).join(', ')}
              />
              <InfoRow label="Pin Code" value={profile.pinCode} />
              <InfoRow
                icon={<Hash className="h-4 w-4" />}
                label="GST Number"
                value={profile.gstNumber}
              />
              <InfoRow label="Complete Address" value={profile.address} />
            </div>
          </div>

          {/* Supplier/Sales Intelligence Card */}
          <div className="card p-5 border shadow-sm rounded-2xl bg-white">
            <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <DollarSign className="h-4.5 w-4.5 text-green-600" />
              Supplier / Sales Intelligence
            </h3>
            <div className="space-y-1">
              <InfoRow label="Supplier History" value={sales.currentSupplier} />
              <InfoRow
                label="Purchase Rate"
                value={
                  sales.currentPurchaseRate
                    ? `₹${Number(sales.currentPurchaseRate).toLocaleString('en-IN')}`
                    : null
                }
              />
              <InfoRow
                label="Expected Rate"
                value={
                  sales.expectedRate
                    ? `₹${Number(sales.expectedRate).toLocaleString('en-IN')}`
                    : null
                }
              />
              <InfoRow
                label="Credit Terms"
                value={sales.creditDays ? `${sales.creditDays} Days` : 'N/A'}
              />
              <InfoRow
                label="Outstanding Amount"
                value={
                  sales.outstandingAmount
                    ? `₹${Number(sales.outstandingAmount).toLocaleString('en-IN')}`
                    : null
                }
              />
              <InfoRow
                label="Monthly Consumption"
                value={
                  sales.monthlyConsumption
                    ? `₹${Number(sales.monthlyConsumption).toLocaleString('en-IN')}`
                    : null
                }
              />
              <InfoRow
                label="Expected Monthly Biz"
                value={
                  sales.expectedMonthlyBusiness
                    ? `₹${Number(sales.expectedMonthlyBusiness).toLocaleString('en-IN')}`
                    : null
                }
              />
              <InfoRow
                label="Pipeline Value"
                value={
                  sales.potentialBusinessValue
                    ? `₹${Number(sales.potentialBusinessValue).toLocaleString('en-IN')}`
                    : null
                }
              />
            </div>
          </div>
        </div>

        {/* Right & Middle Column: Analytics, Trends, Ratings and Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interactive Trends Card (Conversion & Relationship) */}
          <div className="card p-5 border shadow-sm rounded-2xl bg-white relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-800 flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-indigo-600" />
                  Conversion & Relationship Trends
                </h3>
                <p className="text-xs text-gray-400 font-medium">
                  Hover over points to inspect individual visit parameters
                </p>
              </div>
              <div className="flex bg-gray-100 p-1 rounded-xl w-fit border text-xs">
                <button
                  onClick={() => {
                    setActiveTrendMetric('conversion');
                    setHoveredPoint(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    activeTrendMetric === 'conversion'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Conversion %
                </button>
                <button
                  onClick={() => {
                    setActiveTrendMetric('relationship');
                    setHoveredPoint(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    activeTrendMetric === 'relationship'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Relationship (x10)
                </button>
              </div>
            </div>

            {/* Line Chart Component using pure SVG (Enhancement 1 - single visit support) */}
            {chronologicalVisits.length > 0 ? (
              <div className="relative mt-2">
                {chronologicalVisits.length === 1 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] bg-gray-50/50 border border-dashed rounded-xl p-6">
                    <Activity className="h-8 w-8 text-gray-300 mb-2 animate-pulse" />
                    <p className="text-sm font-bold text-gray-500">
                      Trend data requires at least 2 visits
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Only 1 report has been recorded for this customer.
                    </p>
                  </div>
                ) : (
                  <>
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="w-full h-auto overflow-visible"
                    >
                      {/* Gradients */}
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal gridlines */}
                      {[0, 25, 50, 75, 100].map(yVal => {
                        const gridY =
                          chartHeight - paddingY - (yVal * (chartHeight - 2 * paddingY)) / 100;
                        return (
                          <g key={yVal}>
                            <line
                              x1={paddingX}
                              y1={gridY}
                              x2={chartWidth - paddingX}
                              y2={gridY}
                              stroke="#e5e7eb"
                              strokeDasharray="4 4"
                            />
                            <text
                              x={paddingX - 10}
                              y={gridY + 4}
                              textAnchor="end"
                              className="text-[10px] font-bold fill-gray-400"
                            >
                              {yVal}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Date labels on X-axis */}
                      {chronologicalVisits.map((visit, i) => {
                        const x =
                          chronologicalVisits.length > 1
                            ? paddingX +
                              (i * (chartWidth - 2 * paddingX)) / (chronologicalVisits.length - 1)
                            : chartWidth / 2;
                        const dateStr = visit.visitDate
                          ? new Date(visit.visitDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })
                          : '';
                        return (
                          <text
                            key={visit.id}
                            x={x}
                            y={chartHeight - paddingY + 18}
                            textAnchor="middle"
                            className="text-[9px] font-bold fill-gray-400"
                          >
                            {dateStr}
                          </text>
                        );
                      })}

                      {/* Area Path under line */}
                      {areaPath && (
                        <path
                          d={areaPath}
                          fill="url(#chartGradient)"
                          className="transition-all duration-300"
                        />
                      )}

                      {/* Trend Line Path */}
                      {linePath && (
                        <path
                          d={linePath}
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all duration-300"
                        />
                      )}

                      {/* Interactive points */}
                      {points.map((pt, i) => (
                        <g key={i}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="6"
                            className="fill-white stroke-[var(--primary)] stroke-3 cursor-pointer hover:r-8 transition-all"
                            onMouseEnter={() => setHoveredPoint(pt)}
                          />
                          {hoveredPoint?.visit?.id === pt.visit.id && (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="10"
                              className="fill-[var(--primary)]/20 pointer-events-none"
                            />
                          )}
                        </g>
                      ))}
                    </svg>

                    {/* Live Tooltip details */}
                    <div className="mt-4 p-4 bg-gray-50 border rounded-2xl shadow-sm text-sm min-h-[96px] flex flex-col justify-center">
                      {hoveredPoint ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              Visit Date & Report
                            </p>
                            <p className="font-extrabold text-gray-800 mt-0.5">
                              {formatDate(hoveredPoint.visit.visitDate)}
                            </p>
                            <p className="text-xs text-[var(--primary)] font-semibold">
                              {hoveredPoint.visit.reportNumber}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              Conversion Probability
                            </p>
                            <p className="font-extrabold text-green-700 text-base mt-0.5">
                              {hoveredPoint.visit.conversionProbability ?? 0}%
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              Relationship Strength
                            </p>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-bold mt-1 ${getScoreColorClass(hoveredPoint.visit.relationshipStrength)}`}
                            >
                              {hoveredPoint.visit.relationshipStrength ?? '—'}/10
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              Supplier Status
                            </p>
                            <p
                              className="font-semibold text-gray-700 text-xs mt-1 truncate"
                              title={hoveredPoint.visit.currentSupplier}
                            >
                              {hoveredPoint.visit.currentSupplier || 'Not Recorded'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center font-semibold italic text-xs">
                          Hover over any circular node on the trend graph above to view detailed
                          metrics.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm py-12 text-center">
                No timeline data available.
              </p>
            )}
          </div>

          {/* Executive Ratings History Card */}
          <div className="card p-5 border shadow-sm rounded-2xl bg-white">
            <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <Award className="h-4.5 w-4.5 text-amber-500" />
              Executive Ratings Matrix (Chronological)
            </h3>
            {chronologicalVisits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-500 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date / Report</th>
                      <th className="py-2.5 px-3 text-center">Dealer Confidence</th>
                      <th className="py-2.5 px-3 text-center">Payment Reliability</th>
                      <th className="py-2.5 px-3 text-center">Relationship Strength</th>
                      <th className="py-2.5 px-3 text-center">Technical Capability</th>
                      <th className="py-2.5 px-3 text-center">Long-term Potential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chronologicalVisits.map((visit: any) => (
                      <tr
                        key={visit.id}
                        className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="py-3 px-3 font-semibold">
                          <p className="text-gray-800 font-bold">{formatDate(visit.visitDate)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                            {visit.reportNumber}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.dealerConfidence)}`}
                          >
                            {visit.dealerConfidence ?? '—'}/10
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.paymentReliability)}`}
                          >
                            {visit.paymentReliability ?? '—'}/10
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.relationshipStrength)}`}
                          >
                            {visit.relationshipStrength ?? '—'}/10
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.technicalCapability)}`}
                          >
                            {visit.technicalCapability ?? '—'}/10
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.longTermPotential)}`}
                          >
                            {visit.longTermPotential ?? '—'}/10
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm py-6 text-center">
                No executive scores available.
              </p>
            )}
          </div>

          {/* Product Intelligence Card (Enhancement 1 / Features check) */}
          <div className="card p-5 border shadow-sm rounded-2xl bg-white">
            <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <Package className="h-4.5 w-4.5 text-teal-600" />
              Product Intelligence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider mb-1.5">
                    Required Products (Shades)
                  </span>
                  <div className="flex flex-wrap">
                    {products.requiredShade && products.requiredShade.length > 0 ? (
                      products.requiredShade.map((s: string) => <Chip key={s} label={s} />)
                    ) : (
                      <span className="text-xs text-gray-405 italic">None recorded</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider mb-1.5">
                    Required Finish
                  </span>
                  <div className="flex flex-wrap">
                    {products.requiredFinish && products.requiredFinish.length > 0 ? (
                      products.requiredFinish.map((f: string) => <Chip key={f} label={f} />)
                    ) : (
                      <span className="text-xs text-gray-405 italic">None recorded</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider mb-1.5">
                    Paint Types
                  </span>
                  <div className="flex flex-wrap">
                    {products.paintRequirementTypes && products.paintRequirementTypes.length > 0 ? (
                      products.paintRequirementTypes.map((t: string) => <Chip key={t} label={t} />)
                    ) : (
                      <span className="text-xs text-gray-405 italic">None recorded</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider mb-1.5">
                    Substrates / Surface Types
                  </span>
                  <div className="flex flex-wrap">
                    {products.surfaceTypes && products.surfaceTypes.length > 0 ? (
                      products.surfaceTypes.map((s: string) => <Chip key={s} label={s} />)
                    ) : (
                      <span className="text-xs text-gray-405 italic">None recorded</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider mb-1.5">
                    Technical Challenges
                  </span>
                  <div className="flex flex-wrap">
                    {products.technicalChallenges && products.technicalChallenges.length > 0 ? (
                      products.technicalChallenges.map((c: string) => (
                        <span
                          key={c}
                          className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full mr-1.5 mb-1.5"
                        >
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-full border border-green-150">
                        No technical challenges reported
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Visit Timeline Card */}
          <div className="card p-5 border shadow-sm rounded-2xl bg-white">
            <h3 className="text-base font-extrabold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <Calendar className="h-4.5 w-4.5 text-blue-600" />
              Visit Timeline & Details
              <span className="ml-auto text-xs text-gray-400 font-semibold">
                {visits.length} Visits, Newest First
              </span>
            </h3>

            <div className="relative pl-4 border-l border-gray-200 ml-2 space-y-6 py-2">
              {visits.map((visit: any) => (
                <div key={visit.id} className="relative">
                  {/* Timeline bullet dot */}
                  <div className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full bg-[var(--primary)] border-2 border-white ring-4 ring-primary-100 flex-shrink-0" />

                  {/* Visit Card layout */}
                  <div className="bg-gray-50/70 hover:bg-gray-50 rounded-2xl p-4 border border-gray-100 hover:border-primary-200 transition-colors shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-gray-505">
                            {formatDate(visit.visitDate)}
                          </p>
                          <span className="text-gray-300">•</span>
                          <p className="font-extrabold text-gray-800 text-sm">
                            {visit.reportNumber}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-[var(--primary)] mt-1.5">
                          {visit.visitType}
                          {visit.executiveName && ` · Led by ${visit.executiveName}`}
                        </p>

                        {/* Ratings badges row (Enhancement 9) */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {visit.relationshipStrength !== undefined &&
                            visit.relationshipStrength !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.relationshipStrength)}`}
                                title="Relationship Strength"
                              >
                                Rel: {visit.relationshipStrength}/10
                              </span>
                            )}
                          {visit.dealerConfidence !== undefined &&
                            visit.dealerConfidence !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.dealerConfidence)}`}
                                title="Dealer Confidence"
                              >
                                Conf: {visit.dealerConfidence}/10
                              </span>
                            )}
                          {visit.paymentReliability !== undefined &&
                            visit.paymentReliability !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.paymentReliability)}`}
                                title="Payment Reliability"
                              >
                                Pay: {visit.paymentReliability}/10
                              </span>
                            )}
                          {visit.technicalCapability !== undefined &&
                            visit.technicalCapability !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.technicalCapability)}`}
                                title="Technical Capability"
                              >
                                Tech: {visit.technicalCapability}/10
                              </span>
                            )}
                          {visit.longTermPotential !== undefined &&
                            visit.longTermPotential !== null && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getScoreColorClass(visit.longTermPotential)}`}
                                title="Long-Term Potential"
                              >
                                LT: {visit.longTermPotential}/10
                              </span>
                            )}
                        </div>
                        {visit.discussionNotes && (
                          <div className="mt-3 text-xs text-gray-600 bg-white p-3 rounded-xl border border-gray-100 italic shadow-sm leading-relaxed">
                            &ldquo;{visit.discussionNotes}&rdquo;
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0">
                        <span
                          className={`badge border text-xs px-2.5 py-1 rounded-lg font-semibold ${STATUS_BADGE[visit.status] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {visit.status}
                        </span>
                        {visit.conversionProbability > 0 && (
                          <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                            {visit.conversionProbability}% Conversion
                          </span>
                        )}
                        <div className="flex gap-1.5 mt-2 bg-white p-1 rounded-xl border shadow-sm">
                          <button
                            onClick={() => navigate(`/operations/field-intelligence/${visit.id}`)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors"
                            title="View Report"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              navigate(`/operations/field-intelligence/${visit.id}/edit`)
                            }
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-yellow-600 transition-colors"
                            title="Edit Report"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboardPage;
