import React, { useEffect, useState } from 'react';
import {
  Search,
  Download,
  Loader2,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { testCertificateApi } from './services/testCertificateApi';
import { TestCertificate } from './types/testCertificate.types';
import { showToast } from '@/utils/toast';
import { downloadCertificatePdf } from './services/pdfGenerator';
import { companyApi } from '@/features/company/api/companyApi';

export const TestCertificateReportList: React.FC = () => {
  const [certificates, setCertificates] = useState<TestCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all approved/generated certificates once
      const data = await testCertificateApi.getAll({
        status: 'Approved',
      });
      setCertificates(data);
    } catch (err) {
      console.error('Failed to load certificates', err);
      setError('Could not retrieve test certificates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleDownload = async (id: number) => {
    try {
      setDownloadingId(id);
      const certData = await testCertificateApi.getById(id);

      let companyInfo = null;
      try {
        const compResponse = await companyApi.get();
        if (compResponse?.data?.data) {
          companyInfo = compResponse.data.data;
        }
      } catch (compErr) {
        console.warn('Failed to load company details, using fallbacks', compErr);
      }

      downloadCertificatePdf(certData, companyInfo);
      showToast.success('Test certificate downloaded successfully.');
    } catch (err) {
      console.error('Failed to download certificate', err);
      showToast.error('Could not download certificate.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter certificates client-side
  const filteredCertificates = React.useMemo(() => {
    if (!search.trim()) return certificates;
    const query = search.toLowerCase().trim();
    return certificates.filter(
      cert =>
        cert.certificateNo?.toLowerCase().includes(query) ||
        cert.batchNumber?.toLowerCase().includes(query) ||
        cert.productName?.toLowerCase().includes(query) ||
        cert.colour?.toLowerCase().includes(query)
    );
  }, [certificates, search]);

  // Reset to page 1 on new search
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Pagination calculations
  const totalItems = filteredCertificates.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedCertificates = filteredCertificates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header and Summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Test Certificate Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View and download approved generated test certificates.
          </p>
        </div>
      </div>

      {/* Stats Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group card p-6 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-between select-none">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Approved & Sealed Certificates
            </span>
            <span className="text-3xl font-black text-green-600 block mt-1">{totalItems}</span>
          </div>
          <div className="bg-green-50 text-green-600 p-3.5 rounded-2xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 bg-white flex flex-col md:flex-row gap-4 items-center justify-between border rounded-xl shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="input pl-10 w-full"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by certificate no, batch, product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table Card */}
      {loading ? (
        <div className="card p-12 text-center flex items-center justify-center border rounded-xl bg-white shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-gray-500 font-semibold">Retrieving reports...</span>
        </div>
      ) : error ? (
        <div className="card p-8 border-red-200 bg-red-50 text-red-700 text-center rounded-xl shadow-sm">
          <p>{error}</p>
        </div>
      ) : certificates.length === 0 ? (
        <div className="card p-12 text-center text-gray-500 border rounded-xl bg-white shadow-sm">
          No generated test certificates found matching your parameters.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card overflow-hidden bg-white shadow-sm border rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-700 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Certificate No</th>
                    <th className="py-3.5 px-4">Batch Number</th>
                    <th className="py-3.5 px-4">Product Name</th>
                    <th className="py-3.5 px-4">Colour</th>
                    <th className="py-3.5 px-4">Testing Date</th>
                    <th className="py-3.5 px-4">Created By</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCertificates.map(cert => (
                    <tr key={cert.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-primary font-mono text-sm">
                        {cert.certificateNo}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-800">{cert.batchNumber}</td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{cert.productName}</td>
                      <td className="py-3 px-4 text-gray-600">{cert.colour}</td>
                      <td className="py-3 px-4 text-gray-600 font-medium">
                        {cert.testingDate
                          ? new Date(cert.testingDate).toLocaleDateString('en-GB')
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{cert.creatorName || 'System'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="badge bg-green-50 text-green-700 border-green-100 border font-bold">
                          {cert.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-1">
                        <button
                          onClick={() => handleDownload(cert.id!)}
                          disabled={downloadingId === cert.id}
                          className="text-gray-500 hover:text-primary p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Download PDF"
                        >
                          {downloadingId === cert.id ? (
                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                          ) : (
                            <Download className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 border rounded-xl shadow-sm">
              <div className="text-sm text-gray-500">
                Showing{' '}
                <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-semibold">
                  {Math.min(currentPage * itemsPerPage, totalItems)}
                </span>{' '}
                of <span className="font-semibold">{totalItems}</span> certificates
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="flex items-center text-sm font-semibold px-2 text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestCertificateReportList;
