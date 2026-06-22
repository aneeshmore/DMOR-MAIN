import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  User,
  Activity,
  MapPin,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  Trash2,
  Edit,
  ClipboardList,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';

export const FieldIntelligenceViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FieldIntelligenceReport | null>(null);
  const [activeTab, setActiveTab] = useState<
    'profile' | 'technical' | 'commercial' | 'competitors' | 'followups' | 'ai' | 'logs'
  >('profile');

  const fetchReport = async () => {
    try {
      if (!id) return;
      setLoading(true);
      const data = await fieldIntelligenceApi.getById(id);
      setReport(data);
    } catch (err) {
      console.error('Failed to load report details', err);
      alert('Could not retrieve report data.');
      navigate('/operations/field-intelligence');
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
          onClick={() => navigate('/operations/field-intelligence')}
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-4 py-2"
        >
          Back to List
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this report? This action is permanent.')) {
      try {
        await fieldIntelligenceApi.delete(report.id!);
        alert('Report deleted successfully.');
        navigate('/operations/field-intelligence');
      } catch (err) {
        console.error('Failed to delete report', err);
        alert('Deletion failed.');
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

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/operations/field-intelligence')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            title="Back to list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-800">{report.reportNumber}</h1>
              <span className={`badge ${statusBadges} border`}>{report.status}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Logged by <span className="font-bold">{report.executiveName || 'System'}</span> on{' '}
              {report.visitDate ? new Date(report.visitDate).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/operations/field-intelligence/${report.id}/edit`)}
            className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 flex items-center gap-1.5"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="btn border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 flex items-center gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border p-2 flex flex-wrap gap-2">
        {(
          [
            { id: 'profile', label: 'Customer Profile', icon: User },
            { id: 'technical', label: 'Technical Spec', icon: FileText },
            { id: 'commercial', label: 'Commercials', icon: TrendingUp },
            { id: 'competitors', label: 'Competitors', icon: Activity },
            { id: 'followups', label: 'Action Followups', icon: Clock },
            { id: 'ai', label: 'AI Suggestion Panel', icon: AlertTriangle },
            { id: 'logs', label: 'Activity Logs', icon: ClipboardList },
          ] as const
        ).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
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
            </div>
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
                {report.discussionNotes}
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
                  const statusColors =
                    {
                      Open: 'bg-blue-50 text-blue-700 border-blue-200',
                      Pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                      Completed: 'bg-green-50 text-green-700 border-green-200',
                      Missed: 'bg-red-50 text-red-700 border-red-200',
                      Cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
                    }[follow.status] || 'bg-gray-50 text-gray-600';

                  return (
                    <div
                      key={idx}
                      className="flex flex-col md:flex-row md:items-center justify-between border p-4 rounded-xl bg-white shadow-sm gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="bg-primary-50 text-primary p-2 rounded-lg">
                          <Clock className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{follow.notes}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Due Date: {new Date(follow.followupDate).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className={`badge ${statusColors} border font-bold text-xs`}>
                          {follow.status}
                        </span>
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

        {/* AI Insight Panel Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">AI Insights summary</h3>
            {report.insights && report.insights.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
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
                No AI recommendations generated for this visit yet.
              </p>
            )}
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Activity Audit Log</h3>
            {report.activityLogs && report.activityLogs.length > 0 ? (
              <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6 py-2">
                {report.activityLogs.map((log, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[31px] top-0 bg-primary-100 text-primary-700 p-1 rounded-full border-2 border-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{log.activityType}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Logged on {new Date(log.createdAt).toLocaleString('en-IN')}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-[11px] bg-gray-50 p-2 rounded border mt-1 font-mono text-gray-600 max-w-lg overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl border border-dashed">
                No activity audit records registered.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default FieldIntelligenceViewPage;
