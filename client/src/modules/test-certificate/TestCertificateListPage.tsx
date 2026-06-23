import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Trash2,
  Eye,
  Edit,
  SlidersHorizontal,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { testCertificateApi } from './services/testCertificateApi';
import { TestCertificate } from './types/testCertificate.types';
import { showToast } from '@/utils/toast';
import { downloadCertificatePdf } from './services/pdfGenerator';
import { companyApi } from '@/features/company/api/companyApi';
import { CertificateForm } from './components/CertificateForm';

export const TestCertificateListPage: React.FC = () => {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<TestCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // Form creation states
  const [formKey, setFormKey] = useState(0);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const data = await testCertificateApi.getAll({
        search: search || undefined,
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
    const timer = setTimeout(() => {
      fetchCertificates();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: number) => {
    if (
      window.confirm(
        'Are you sure you want to delete this test certificate? This action cannot be undone.'
      )
    ) {
      try {
        await testCertificateApi.delete(id);
        setCertificates(prev => prev.filter(c => c.id !== id));
        showToast.success('Test certificate deleted successfully.');
      } catch (err) {
        console.error('Delete failed', err);
        showToast.error('Failed to delete test certificate.');
      }
    }
  };

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

  const handleSubmitCreate = async (data: TestCertificate) => {
    try {
      setSubmittingCreate(true);

      const payload = {
        batchId: Number(data.batchId),
        batchNumber: data.batchNumber,
        productName: data.productName,
        colour: data.colour,
        manufacturingDate: data.manufacturingDate,
        testingDate: data.testingDate,
        remarks: data.remarks || '',
        status: data.status || 'Draft',
        results: data.results.map((r, idx) => ({
          propertyName: r.propertyName,
          resultValue: r.resultValue,
          specification: r.specification || '',
          sortOrder: idx,
        })),
      };

      await testCertificateApi.create(payload);
      showToast.success('Test certificate generated successfully.');
      setFormKey(prev => prev + 1); // Reset the form by remounting
      fetchCertificates(); // Reload the list
    } catch (err: any) {
      console.error('Failed to create test certificate', err);
      showToast.error(
        err.response?.data?.message ||
          'Failed to submit test certificate. Please check input values.'
      );
    } finally {
      setSubmittingCreate(false);
    }
  };

  const totalCerts = certificates.length;
  const approvedCerts = certificates.filter(c => c.status === 'Approved').length;
  const draftCerts = certificates.filter(c => c.status === 'Draft').length;

  const filteredCertificates = certificates.filter(c => !status || c.status === status);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* New Test Certificate Form */}
      <CertificateForm
        key={formKey}
        onSubmit={handleSubmitCreate}
        isSubmitting={submittingCreate}
      />

      {/* Generated Test Certificates Section */}
      <div className="border-t !mt-1 pt-2 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            onClick={() => setStatus('')}
            className={`group card p-6 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all duration-300 hover:shadow-md hover:shadow-blue-50/50 hover:-translate-y-0.5 select-none ${
              status === ''
                ? 'bg-blue-50/20 border-blue-400 ring-2 ring-blue-400/20'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/5'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Total Certificates
              </span>
              <span className="text-3xl font-black text-gray-800 block mt-1">{totalCerts}</span>
            </div>
            <div className="bg-blue-50 text-primary p-3.5 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-100/80">
              <FileText className="h-6 w-6" />
            </div>
          </div>

          <div
            onClick={() => setStatus('Approved')}
            className={`group card p-6 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all duration-300 hover:shadow-md hover:shadow-green-50/50 hover:-translate-y-0.5 select-none ${
              status === 'Approved'
                ? 'bg-green-50/20 border-green-400 ring-2 ring-green-400/20'
                : 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/5'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Approved & Sealed
              </span>
              <span className="text-3xl font-black text-green-600 block mt-1">{approvedCerts}</span>
            </div>
            <div className="bg-green-50 text-green-600 p-3.5 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-green-100/80">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>

          <div
            onClick={() => setStatus('Draft')}
            className={`group card p-6 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all duration-300 hover:shadow-md hover:shadow-yellow-50/50 hover:-translate-y-0.5 select-none ${
              status === 'Draft'
                ? 'bg-yellow-50/20 border-yellow-400 ring-2 ring-yellow-400/20'
                : 'bg-white border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/5'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Pending Drafts
              </span>
              <span className="text-3xl font-black text-yellow-600 block mt-1">{draftCerts}</span>
            </div>
            <div className="bg-yellow-50 text-yellow-600 p-3.5 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-yellow-100/80">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-800">Generated Test Certificates</h2>
          <p className="text-xs text-gray-500 mt-1">
            History of generated test certificates. Search, filter, edit drafts, or download/print
            PDFs.
          </p>
        </div>

        {/* Filters Bar */}
        <div className="card p-4 bg-white flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="input pl-10"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search by certificate no, batch, product..."
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
                <option value="Approved">Approved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Card */}
        {loading ? (
          <div className="card p-12 text-center flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-gray-500 font-semibold">Retrieving certificates...</span>
          </div>
        ) : error ? (
          <div className="card p-8 border-red-200 bg-red-50 text-red-700 text-center">
            <p>{error}</p>
          </div>
        ) : filteredCertificates.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">
            No test certificates found matching your parameters.
          </div>
        ) : (
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
                  {filteredCertificates.map(cert => {
                    const isDraft = cert.status === 'Draft';
                    const statusBadges = isDraft
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                      : 'bg-green-50 text-green-700 border-green-100';

                    return (
                      <tr key={cert.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-primary font-mono text-sm">
                          {cert.certificateNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          {cert.batchNumber}
                        </td>
                        <td className="py-3 px-4 text-gray-800 font-medium">{cert.productName}</td>
                        <td className="py-3 px-4 text-gray-600">{cert.colour}</td>
                        <td className="py-3 px-4 text-gray-600 font-medium">
                          {cert.testingDate
                            ? new Date(cert.testingDate).toLocaleDateString('en-GB')
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{cert.creatorName || 'System'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`badge ${statusBadges} border`}>{cert.status}</span>
                        </td>
                        <td className="py-3 px-4 text-right flex justify-end gap-1">
                          <button
                            onClick={() => navigate(`/operations/test-certificate/${cert.id}`)}
                            className="text-gray-500 hover:text-primary p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title="View & PDF controls"
                          >
                            <Eye className="h-4.5 w-4.5" />
                          </button>
                          {isDraft ? (
                            <>
                              <button
                                onClick={() =>
                                  navigate(`/operations/test-certificate/${cert.id}/edit`)
                                }
                                className="text-gray-500 hover:text-yellow-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Edit Certificate"
                              >
                                <Edit className="h-4.5 w-4.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(cert.id!)}
                                className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Delete Certificate"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </>
                          ) : (
                            <div className="w-18"></div> // spacer to keep alignment
                          )}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TestCertificateListPage;
