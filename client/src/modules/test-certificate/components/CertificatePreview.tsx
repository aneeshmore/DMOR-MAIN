import React from 'react';
import { TestCertificate } from '../types/testCertificate.types';
import { CertificateHeader } from './CertificateHeader';

interface CertificatePreviewProps {
  certificate: Partial<TestCertificate>;
  companyInfo?: any;
}

export const CertificatePreview: React.FC<CertificatePreviewProps> = ({
  certificate,
  companyInfo,
}) => {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const allResults = certificate.results || [];
  const checkedResults = allResults.filter(r => r.checked);
  const results = checkedResults.length > 0 ? checkedResults : allResults;

  return (
    <div className="bg-gray-100 p-4 rounded-xl flex justify-center overflow-x-auto select-none border">
      {/* A4 Aspect Ratio Box */}
      <div
        className="bg-white p-12 shadow-md w-[210mm] min-h-[297mm] flex flex-col justify-between text-gray-800 text-xs font-sans print:p-0 print:shadow-none"
        style={{ boxSizing: 'border-box' }}
      >
        <div>
          {/* Header */}
          <CertificateHeader companyInfo={companyInfo} />

          {/* Title & Cert No */}
          <div className="text-center my-6">
            <h2 className="text-lg font-black tracking-widest text-gray-800 border-b border-gray-300 pb-1 inline-block uppercase">
              TEST CERTIFICATE
            </h2>
            <div className="text-sm font-bold text-primary-700 mt-2 font-mono">
              Certificate No: {certificate.certificateNo || 'TC/CODE/BATCH/YEAR'}
            </div>
          </div>

          {/* Batch Details Table */}
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Batch & Manufacturing Details
            </h3>
            <table className="w-full border-collapse border border-gray-300">
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50 w-1/4">
                    Product Name
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 w-1/4 font-medium">
                    {certificate.productName || '-'}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50 w-1/4">
                    Colour / Shade
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 w-1/4 font-medium">
                    {certificate.colour || '-'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50">
                    Batch Number
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 font-bold text-gray-800">
                    {certificate.batchNumber || '-'}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50">
                    Manufacturing Date
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 font-medium">
                    {formatDate(certificate.manufacturingDate)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50">
                    Testing Date
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 font-medium">
                    {formatDate(certificate.testingDate)}
                  </td>
                  <td
                    className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50 bg-opacity-0"
                    colSpan={2}
                  ></td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50">
                    Tested By
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 font-medium">
                    In-house Quality Control Lab
                  </td>
                  <td
                    className="border border-gray-300 px-3 py-1.5 font-semibold bg-gray-50 bg-opacity-0"
                    colSpan={2}
                  ></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Results Table */}
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Technical Testing Specifications
            </h3>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold">
                  <th className="border border-gray-300 py-1.5 px-3 w-16 text-center">Sr No</th>
                  <th className="border border-gray-300 py-1.5 px-3 text-left w-1/3">
                    Property / Parameter
                  </th>
                  <th className="border border-gray-300 py-1.5 px-3 text-left w-1/3">
                    Specification
                  </th>
                  <th className="border border-gray-300 py-1.5 px-3 text-left w-1/3">
                    Result / Observed Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-gray-300 py-4 text-center text-gray-400 italic"
                    >
                      No parameters specified
                    </td>
                  </tr>
                ) : (
                  results.map((row, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 py-1.5 px-3 text-center font-bold text-gray-500">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 py-1.5 px-3 font-medium">
                        {row.propertyName || '-'}
                      </td>
                      <td className="border border-gray-300 py-1.5 px-3 font-medium">
                        {row.specification || '-'}
                      </td>
                      <td className="border border-gray-300 py-1.5 px-3 font-semibold text-gray-800">
                        {row.resultValue || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Remarks */}
          <div className="mt-6">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              Remarks
            </h3>
            <div className="text-xs text-gray-700 leading-relaxed space-y-3">
              <p>
                The above material has been tested in our in-house Quality Control Lab and found
                satisfactory as per{' '}
                <span className="font-semibold">
                  {companyInfo?.companyName || 'DMOR POLYMERS PRIVATE LIMITED'}
                </span>{' '}
                internal quality standards.
              </p>
              <p>
                The product is suitable for application on properly prepared surfaces as per
                recommended application guidelines.
              </p>
              <p className="italic text-gray-500 mt-2">
                Note: This is a computer-generated test certificate. Signature is not required.
              </p>
              <div className="mt-4 pt-2">
                <p className="text-gray-700">Tested By:</p>
                <p className="font-bold text-gray-800 mt-2">Quality Control Officer</p>
                <p className="font-bold text-gray-800 mt-2">
                  {companyInfo?.companyName || 'DMOR POLYMERS PRIVATE LIMITED'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-4 mt-auto text-center text-gray-500">
          <div className="text-xs font-semibold text-gray-700">
            Generated by Morex Technologies ERP
          </div>
        </div>
      </div>
    </div>
  );
};
export default CertificatePreview;
