import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  MapPin,
  ClipboardList,
  ChevronRight,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { DashboardSummary } from './types/fieldIntelligence.types';

// Register ChartJS elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export const FieldIntelligenceDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const summary = await fieldIntelligenceApi.getDashboardSummary();
        setData(summary);
      } catch (err: any) {
        console.error('Failed to load dashboard metrics', err);
        setError('Could not retrieve dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-500 font-semibold">Loading dashboard metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8 text-center border-red-200 bg-red-50 text-red-700 max-w-md mx-auto mt-12">
        <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-red-500" />
        <h3 className="font-bold text-lg mb-1">Error Loading Dashboard</h3>
        <p className="text-sm mb-4">{error || 'An unexpected error occurred.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-4 py-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // Pre-process chart data
  const dateLabels = Object.keys(data.visitsPerDay).sort();
  const dateValues = dateLabels.map(label => data.visitsPerDay[label]);

  const execLabels = Object.keys(data.visitsPerExecutive);
  const execValues = execLabels.map(label => data.visitsPerExecutive[label]);

  const compLabels = Object.keys(data.competitorAnalysis);
  const compValues = compLabels.map(label => data.competitorAnalysis[label]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-primary-500 text-white p-1 rounded-lg">
              <Activity className="h-6 w-6" />
            </span>
            CRM Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time market insights, customer acquisitions, and competitor movements
          </p>
        </div>
        <button
          onClick={() => navigate('/operations/smart-crm/new')}
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-4 py-2.5 shadow-md flex items-center justify-center gap-2 font-semibold w-full sm:w-auto text-sm min-h-[44px]"
        >
          + Create Visit Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 sm:p-6 flex items-center justify-between hover-lift rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-gray-550 uppercase tracking-wider">
              Total Customer Visits
            </p>
            <h3 className="text-xl sm:text-3xl font-extrabold text-gray-800 mt-1 sm:mt-2">
              {data.totalVisits}
            </h3>
            <p className="text-[9px] sm:text-[11px] text-green-500 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Active conversion tracking
            </p>
          </div>
          <div className="bg-primary-50 text-primary p-2.5 sm:p-4 rounded-lg sm:rounded-xl flex-shrink-0 ml-2 hidden sm:block">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div className="card p-4 sm:p-6 flex items-center justify-between hover-lift rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-gray-555 uppercase tracking-wider">
              Avg. Conversion Probability
            </p>
            <h3 className="text-xl sm:text-3xl font-extrabold text-gray-800 mt-1 sm:mt-2">
              {data.conversionRate}%
            </h3>
            <p className="text-[9px] sm:text-[11px] text-gray-500 font-semibold mt-1">
              Weighted conversion forecast
            </p>
          </div>
          <div className="bg-success/15 text-success p-2.5 sm:p-4 rounded-lg sm:rounded-xl flex-shrink-0 ml-2 hidden sm:block">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div className="card p-4 sm:p-6 flex items-center justify-between hover-lift rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-gray-550 uppercase tracking-wider">
              Revenue Pipeline
            </p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-gray-800 mt-1 sm:mt-2 font-mono">
              ₹{(data.expectedRevenue || 0).toLocaleString('en-IN')}
            </h3>
            <p className="text-[9px] sm:text-[11px] text-primary-500 font-semibold mt-1">
              Total pipeline value
            </p>
          </div>
          <div className="bg-info/15 text-info p-2.5 sm:p-4 rounded-lg sm:rounded-xl flex-shrink-0 ml-2 hidden sm:block">
            <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div className="card p-4 sm:p-6 flex items-center justify-between hover-lift rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-gray-550 uppercase tracking-wider">
              Action Items Overdue
            </p>
            <h3 className="text-xl sm:text-3xl font-extrabold text-gray-800 mt-1 sm:mt-2">
              {data.followupsMissed}
            </h3>
            <p className="text-[9px] sm:text-[11px] text-red-500 font-semibold mt-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Requires action
            </p>
          </div>
          <div className="bg-red-50 text-red-600 p-2.5 sm:p-4 rounded-lg sm:rounded-xl flex-shrink-0 ml-2 hidden sm:block">
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      {/* Primary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Visit Activity Timeline</h3>
          <div className="h-72">
            {dateLabels.length > 0 ? (
              <Line
                data={{
                  labels: dateLabels,
                  datasets: [
                    {
                      label: 'Visits',
                      data: dateValues,
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                      tension: 0.3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                }}
              />
            ) : (
              <p className="text-center text-gray-400 pt-28">
                No visit log history data available.
              </p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Competitor Frequency</h3>
          <div className="h-72 flex items-center justify-center">
            {compLabels.length > 0 ? (
              <Doughnut
                data={{
                  labels: compLabels,
                  datasets: [
                    {
                      data: compValues,
                      backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#3b82f6',
                        '#10b981',
                        '#6366f1',
                        '#ec4899',
                        '#8b5cf6',
                      ],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                }}
              />
            ) : (
              <p className="text-center text-gray-400">No competitor analysis data captured.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Executive Visit Volume</h3>
          <div className="h-72">
            {execLabels.length > 0 ? (
              <Bar
                data={{
                  labels: execLabels,
                  datasets: [
                    {
                      label: 'Visits Logged',
                      data: execValues,
                      backgroundColor: '#60a5fa',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true } },
                }}
              />
            ) : (
              <p className="text-center text-gray-400 pt-28">No executive records found.</p>
            )}
          </div>
        </div>

        {/* Territory Performance Table */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-500" />
            Territory & Region Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">State / City</th>
                  <th className="py-2.5 px-3 text-center">Total Visits</th>
                  <th className="py-2.5 px-3 text-right">Potential Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.territoryPerformance).length > 0 ? (
                  Object.entries(data.territoryPerformance).map(([loc, stats]) => (
                    <tr key={loc} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3 font-semibold text-gray-800">{loc}</td>
                      <td className="py-3 px-3 text-center text-gray-700">{stats.visits}</td>
                      <td className="py-3 px-3 text-right font-bold text-primary">
                        ₹{stats.revenue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-500 py-12">
                      No regional visit logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
export default FieldIntelligenceDashboardPage;
