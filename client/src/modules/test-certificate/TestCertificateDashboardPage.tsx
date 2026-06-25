import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { testCertificateApi } from './services/testCertificateApi';
import { TestCertificate } from './types/testCertificate.types';
import {
  FileText,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Eye,
  ListFilter,
  ArrowLeft,
} from 'lucide-react';

export const TestCertificateDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<TestCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCertificates = async () => {
      try {
        setLoading(true);
        const data = await testCertificateApi.getAll();
        setCertificates(data);
      } catch (err) {
        console.error('Failed to load certificates for dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    loadCertificates();
  }, []);

  const totalCerts = certificates.length;
  const approvedCerts = certificates.filter(c => c.status === 'Approved').length;
  const draftCerts = certificates.filter(c => c.status === 'Draft').length;
  const recentCerts = certificates.slice(0, 5); // Latest 5

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Title section */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/operations/test-certificate')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-primary-500 text-white p-1 rounded-lg">
                <FileText className="h-6 w-6" />
              </span>
              Quality Assurance Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Overview of Quality Control (QC) Test Certificates, verification statuses, and batch
              history
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/operations/test-certificate/create')}
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-5 py-2.5 shadow-sm font-semibold flex items-center gap-2"
        >
          <Plus className="h-4.5 w-4.5" />
          Create Test Certificate
        </button>
      </div>

      {loading ? (
        <div className="card p-12 text-center flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-500 font-semibold">Loading dashboard metrics...</span>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card bg-white p-6 border rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                  Total Certificates
                </span>
                <span className="text-3xl font-black text-gray-800 block mt-1">{totalCerts}</span>
              </div>
              <div className="bg-blue-50 text-primary p-3.5 rounded-2xl">
                <FileText className="h-6 w-6" />
              </div>
            </div>

            <div className="card bg-white p-6 border rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                  Approved & Sealed
                </span>
                <span className="text-3xl font-black text-green-600 block mt-1">
                  {approvedCerts}
                </span>
              </div>
              <div className="bg-green-50 text-green-600 p-3.5 rounded-2xl">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <div className="card bg-white p-6 border rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                  Pending Drafts
                </span>
                <span className="text-3xl font-black text-yellow-600 block mt-1">{draftCerts}</span>
              </div>
              <div className="bg-yellow-50 text-yellow-600 p-3.5 rounded-2xl">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions & Links */}
            <div className="card bg-white p-6 border rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 mb-4">
                  Quick Actions
                </h3>
                <p className="text-xs text-gray-500 mb-6">
                  Select and register test specifications against verified, completed production
                  batches.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/operations/test-certificate/create')}
                  className="w-full btn bg-primary-50 text-primary hover:bg-primary-100 py-3 flex justify-between items-center px-4 font-semibold text-sm transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> New Certificate
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  onClick={() => navigate('/operations/test-certificate')}
                  className="w-full btn border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 flex justify-between items-center px-4 font-semibold text-sm transition-all"
                >
                  <span className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4" /> View History Registry
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Recent History Table */}
            <div className="lg:col-span-2 card bg-white p-6 border rounded-xl shadow-sm">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Recent Activity / Certificates History
                </h3>
                <button
                  onClick={() => navigate('/operations/test-certificate')}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  View All History <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {recentCerts.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400 italic">
                  No recent test certificates found.
                </div>
              ) : (
                <div className="divide-y max-h-[300px] overflow-y-auto pr-1">
                  {recentCerts.map(cert => (
                    <div
                      key={cert.id}
                      className="py-3 flex justify-between items-center hover:bg-gray-50/50 px-2 rounded-lg transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-primary font-mono text-sm block">
                          {cert.certificateNo}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          Batch {cert.batchNumber} · {cert.productName} ({cert.colour})
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`badge text-[10px] px-2 py-0.5 rounded-full border ${
                            cert.status === 'Draft'
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                              : 'bg-green-50 text-green-700 border-green-100'
                          }`}
                        >
                          {cert.status}
                        </span>
                        <button
                          onClick={() => navigate(`/operations/test-certificate/${cert.id}`)}
                          className="text-gray-400 hover:text-primary p-1 rounded"
                          title="View certificate"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default TestCertificateDashboardPage;
