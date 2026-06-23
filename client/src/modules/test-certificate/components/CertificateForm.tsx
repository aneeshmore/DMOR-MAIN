import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@/utils/toast';
import {
  TestCertificate,
  CompletedBatch,
  TestCertificateResult,
} from '../types/testCertificate.types';
import { BatchSelector } from './BatchSelector';
import { CertificateResultsTable } from './CertificateResultsTable';
import { CertificatePreview } from './CertificatePreview';
import { companyApi } from '@/features/company/api/companyApi';
import { FileText, Save, Eye, EyeOff } from 'lucide-react';

interface CertificateFormProps {
  initialData?: Partial<TestCertificate>;
  onSubmit: (data: TestCertificate) => void;
  isSubmitting: boolean;
}

const DEFAULT_RESULTS: TestCertificateResult[] = [
  {
    propertyName: 'Colour / Shade',
    resultValue: '',
    specification: '',
    sortOrder: 0,
    checked: false,
  },
  {
    propertyName: 'Appearance',
    resultValue: 'Complies',
    specification: 'Smooth Homogeneous',
    sortOrder: 1,
    checked: false,
  },
  { propertyName: 'Density', resultValue: '', specification: '', sortOrder: 2, checked: false },
  { propertyName: 'Viscosity', resultValue: '', specification: '', sortOrder: 3, checked: false },
  {
    propertyName: 'Solid Content',
    resultValue: '',
    specification: '',
    sortOrder: 4,
    checked: false,
  },
  { propertyName: 'Finish', resultValue: '', specification: '', sortOrder: 5, checked: false },
];

export const CertificateForm: React.FC<CertificateFormProps> = ({
  initialData,
  onSubmit,
  isSubmitting,
}) => {
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await companyApi.get();
        if (res?.data?.data) {
          setCompanyInfo(res.data.data);
        }
      } catch (err) {
        console.warn('Failed to load company details in form', err);
      }
    };
    fetchCompany();
  }, []);

  // Set default checked to true for saved database rows in initialData
  let initialResults = DEFAULT_RESULTS;
  if (initialData?.results && initialData.results.length > 0) {
    initialResults = initialData.results.map(r => ({
      ...r,
      checked: true,
    }));
  }

  // Default values setup
  const defaultValues: Partial<TestCertificate> = {
    testingDate: new Date().toISOString().split('T')[0],
    status: 'Draft',
    remarks: '',
    ...initialData,
    results: initialResults,
  };

  const { register, control, setValue, handleSubmit, watch, getValues } = useForm<TestCertificate>({
    defaultValues: defaultValues as TestCertificate,
  });

  const watchedValues = watch();

  // Watch testingDate, batchNumber, and productName to dynamically generate certificate number
  const testingDate = useWatch({ control, name: 'testingDate' });
  const productName = useWatch({ control, name: 'productName' });
  const batchNumber = useWatch({ control, name: 'batchNumber' });

  // Generate certificate number dynamically
  useEffect(() => {
    if (productName && batchNumber) {
      // Helper function to extract initials matching backend behavior
      const generateCode = (name: string) => {
        if (!name) return 'PROD';
        const clean = name.replace(/-\s*\d+\s*(L|KG|Ltr|Kg|G|Gm|Bag|Drum)\b/gi, '').trim();
        const parts = clean.split(/\s+/);
        if (parts.length > 1) {
          return (
            parts
              .map(p => p[0])
              .join('')
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '') || 'PROD'
          );
        }
        return (
          clean
            .substring(0, 3)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '') || 'PROD'
        );
      };

      const productCode = generateCode(productName);
      const year = testingDate ? new Date(testingDate).getFullYear() : new Date().getFullYear();
      const certNo = `TC/${productCode}/${batchNumber}/${year}`;

      setValue('certificateNo', certNo);
    }
  }, [productName, batchNumber, testingDate, setValue]);

  // Handle batch selection
  const handleBatchSelect = (batch: CompletedBatch) => {
    setValue('batchId', batch.batchId);
    setValue('batchNumber', batch.batchNo);
    setValue('productName', batch.productName);
    setValue('colour', batch.colour || 'Standard');
    if (batch.manufacturingDate) {
      setValue('manufacturingDate', batch.manufacturingDate.split('T')[0]);
    }

    // Auto-populate actual density and viscosity in the results grid
    const currentResults = getValues('results') || [];
    const updatedResults = currentResults.map(row => {
      const nameCleaned = row.propertyName?.trim().toLowerCase();
      if (nameCleaned === 'density') {
        const densityVal =
          batch.actualDensity !== undefined && batch.actualDensity !== null
            ? String(batch.actualDensity)
            : '';
        return {
          ...row,
          resultValue: densityVal,
          specification: densityVal ? `${densityVal} ± 0.05` : '',
        };
      }
      if (nameCleaned === 'viscosity') {
        const viscosityVal =
          batch.actualViscosity !== undefined && batch.actualViscosity !== null
            ? String(batch.actualViscosity)
            : '';
        return {
          ...row,
          resultValue: viscosityVal,
          specification: viscosityVal ? `${viscosityVal} ± 10` : '',
        };
      }
      if (nameCleaned === 'solid content') {
        const solidVal =
          batch.totalSolid !== undefined && batch.totalSolid !== null
            ? parseFloat(String(batch.totalSolid)).toFixed(3)
            : '';
        return {
          ...row,
          resultValue: solidVal,
          specification: solidVal ? `${solidVal} ± 5` : '',
        };
      }
      return row;
    });
    setValue('results', updatedResults);

    showToast.success(`Batch ${batch.batchNo} loaded. Fields populated.`);
  };

  // Form custom validation
  const validateForm = (data: TestCertificate): boolean => {
    if (!data.batchId) {
      showToast.error('Batch selection is required.');
      return false;
    }
    if (!data.productName) {
      showToast.error('Product name is required.');
      return false;
    }
    if (!data.batchNumber) {
      showToast.error('Batch number is required.');
      return false;
    }
    if (!data.certificateNo) {
      showToast.error('Certificate number is required.');
      return false;
    }
    if (!data.testingDate) {
      showToast.error('Testing date is required.');
      return false;
    }
    if (!data.results || data.results.length === 0) {
      showToast.error(
        'Please select at least one test parameter before generating the certificate.'
      );
      return false;
    }

    const hasEmptyProp = data.results.some(r => !r.propertyName.trim());
    if (hasEmptyProp) {
      showToast.error('All test parameter rows must have a property name.');
      return false;
    }

    const hasEmptyVal = data.results.some(r => !r.resultValue.trim());
    if (hasEmptyVal) {
      showToast.error('All test parameter rows must have an observed value.');
      return false;
    }

    return true;
  };

  const handleFormSubmit = (data: TestCertificate) => {
    const allResults = data.results || [];
    const checkedResults = allResults.filter(r => r.checked);
    const finalResults = checkedResults.length > 0 ? checkedResults : allResults;
    const cleanedData = { ...data, results: finalResults };
    if (validateForm(cleanedData)) {
      onSubmit(cleanedData);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6 max-w-6xl mx-auto pb-28 animate-fade-in"
    >
      {/* Form Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-primary-500 text-white p-1 rounded-lg">
              <FileText className="h-5 w-5" />
            </span>
            {initialData?.id
              ? `Edit Test Certificate: ${watchedValues.certificateNo}`
              : 'New Test Certificate'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {initialData?.id
              ? 'Update the test results and parameters in Draft mode.'
              : 'Pull batch metadata and record dynamic specifications.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 text-sm flex items-center gap-2"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-4 w-4" /> Hide Preview
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" /> Visual Preview
            </>
          )}
        </button>
      </div>

      {showPreview && (
        <div className="border border-primary-100 rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-primary-50 px-6 py-2.5 border-b font-semibold text-primary text-xs tracking-wider uppercase">
            A4 Visual Layout Preview (Mockup)
          </div>
          <CertificatePreview certificate={watchedValues} companyInfo={companyInfo} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Inputs Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card bg-white p-6 border shadow-sm rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 mb-2">
              Batch Information
            </h3>

            {/* Batch Selector */}
            <BatchSelector
              selectedBatchId={watchedValues.batchId}
              onSelect={handleBatchSelect}
              disabled={!!initialData?.id}
            />

            {/* Auto Populated Metadata fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  readOnly
                  className="input bg-gray-50 text-gray-500 font-medium cursor-not-allowed"
                  placeholder="Auto-populated product name"
                  {...register('productName')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Manufacturing Date
                </label>
                <input
                  type="date"
                  readOnly
                  className="input bg-gray-50 text-gray-500 font-medium cursor-not-allowed"
                  {...register('manufacturingDate')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Batch Number
                </label>
                <input
                  type="text"
                  readOnly
                  className="input bg-gray-50 text-gray-500 font-bold cursor-not-allowed"
                  placeholder="Auto-populated batch number"
                  {...register('batchNumber')}
                />
              </div>
            </div>
          </div>

          {/* Specifications Table */}
          <CertificateResultsTable
            results={watchedValues.results || []}
            onChange={res => setValue('results', res)}
            batchSelected={!!watchedValues.batchId}
          />
        </div>

        {/* Status + Metadata Panel */}
        <div className="space-y-6">
          <div className="card bg-white p-6 border shadow-sm rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2">
              Certificate Settings
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Testing Date <span className="text-red-500">*</span>
              </label>
              <input type="date" className="input font-medium" {...register('testingDate')} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Generated Certificate No
              </label>
              <input
                type="text"
                readOnly
                className="input bg-gray-50 text-primary-700 font-bold font-mono text-center tracking-wide border-primary-300 cursor-not-allowed"
                placeholder="TC/CODE/BATCH/YEAR"
                {...register('certificateNo')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select className="input font-bold" {...register('status')}>
                <option value="Draft">Draft (Editable)</option>
                <option value="Approved">Approved (Finalised)</option>
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                Note: Approved certificates cannot be modified or deleted.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-white border border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex justify-between items-center rounded-xl">
        <button
          type="button"
          onClick={() => navigate('/operations/test-certificate')}
          className="btn border border-gray-300 text-gray-700 hover:bg-gray-100 px-6 py-2.5 rounded-lg font-semibold cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] px-8 py-2.5 rounded-lg shadow-sm font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? 'Saving...' : initialData?.id ? 'Save Updates' : 'Generate Certificate'}
        </button>
      </div>
    </form>
  );
};
export default CertificateForm;
