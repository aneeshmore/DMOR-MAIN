import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Trash2,
  Eye,
  Edit,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { fieldIntelligenceApi } from './services/fieldIntelligenceApi';
import { FieldIntelligenceReport } from './types/fieldIntelligence.types';

export const FieldIntelligenceListPage: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<FieldIntelligenceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchReports = async () => {
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
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [search, status, sortBy, sortOrder]);

  const handleDelete = async (id: string) => {
    if (
      window.confirm('Are you sure you want to delete this report? This action cannot be undone.')
    ) {
      try {
        await fieldIntelligenceApi.delete(id);
        setReports(prev => prev.filter(r => r.id !== id));
      } catch (err) {
        console.error('Delete failed', err);
        alert('Failed to delete the report.');
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
      link.setAttribute('download', `FIR_Data_Export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to export report data.');
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
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-primary-500 text-white p-1 rounded-lg">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            Field Intelligence Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage, filter, and track customer intelligence and acquisitions
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>

          <button
            onClick={() => navigate('/operations/field-intelligence/dashboard')}
            className="btn border border-[var(--primary)] text-[var(--primary)] hover:bg-primary-50 px-4 py-2"
          >
            Dashboard
          </button>

          <button
            onClick={() => navigate('/operations/field-intelligence/new')}
            className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-4 py-2 shadow-sm font-semibold"
          >
            + Create Report
          </button>
        </div>
      </div>

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

      {/* Reports Table Card */}
      {loading ? (
        <div className="card p-12 text-center flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-500 font-semibold">Retrieving reports...</span>
        </div>
      ) : error ? (
        <div className="card p-8 border-red-200 bg-red-50 text-red-700 text-center">
          <p>{error}</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">
            No field intelligence reports found matching your parameters.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden bg-white shadow-sm border rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-700 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Report Number</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4 cursor-pointer" onClick={() => toggleSort('visitDate')}>
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
                  const statusBadges =
                    {
                      Draft: 'bg-gray-100 text-gray-600',
                      Submitted: 'bg-blue-50 text-blue-700 border-blue-100',
                      Qualified: 'bg-yellow-50 text-yellow-700 border-yellow-100',
                      'Proposal Sent': 'bg-indigo-50 text-indigo-700 border-indigo-100',
                      'Trial Running': 'bg-pink-50 text-pink-700 border-pink-100',
                      Negotiation: 'bg-orange-50 text-orange-700 border-orange-100',
                      Won: 'bg-green-50 text-green-700 border-green-100',
                      Lost: 'bg-red-50 text-red-700 border-red-100',
                      Archived: 'bg-gray-200 text-gray-800',
                    }[report.status] || 'bg-gray-100 text-gray-600';

                  return (
                    <tr key={report.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-primary">
                        {report.reportNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-800">{report.customerName}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {report.visitDate ? new Date(report.visitDate).toLocaleDateString() : 'N/A'}
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
                        <span className={`badge ${statusBadges} border`}>{report.status}</span>
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/operations/field-intelligence/${report.id}`)}
                          className="text-gray-500 hover:text-primary p-1.5 rounded-lg hover:bg-gray-100"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/operations/field-intelligence/${report.id}/edit`)
                          }
                          className="text-gray-500 hover:text-yellow-600 p-1.5 rounded-lg hover:bg-gray-100"
                          title="Edit Report"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(report.id!)}
                          className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-gray-100"
                          title="Delete Report"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default FieldIntelligenceListPage;
