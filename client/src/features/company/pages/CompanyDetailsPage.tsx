import React, { useState, useEffect } from 'react';
import { Upload, Save, Trash2 } from 'lucide-react';
import { showToast } from '@/utils/toast';
import { Button, Input } from '@/components/ui';
import { companyApi } from '@/features/company/api/companyApi';
import { PageHeader } from '@/components/common';

interface CompanyData {
  companyName: string;
  companyLogo?: string;
  companyAddress: string;
  factoryAddress?: string;
  companyGSTIN: string;
  companyEmail: string;
  companyPhone: string;
  companyPAN?: string;
  termsAndConditions?: string;
  udyamRegistrationNumber?: string;
  companyPincode?: string;
  state?: string;
  companyCGST?: number | string;
  companySGST?: number | string;
  companyIGST?: number | string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  branch?: string;
}

const INITIAL_DATA: CompanyData = {
  companyName: '',
  companyLogo: '',
  companyAddress: '',
  factoryAddress: '',
  companyGSTIN: '',
  companyEmail: '',
  companyPhone: '',
  companyPAN: '',
  termsAndConditions: '',
  udyamRegistrationNumber: '',
  companyPincode: '',
  state: '',
  companyCGST: 9,
  companySGST: 9,
  companyIGST: 18,
  bankName: '',
  accountNo: '',
  ifsc: '',
  branch: '',
};

const CompanyDetailsPage: React.FC = () => {
  const [data, setData] = useState<CompanyData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFetchingState, setIsFetchingState] = useState(false);

  useEffect(() => {
    fetchCompanyDetails();
  }, []);

  const fetchCompanyDetails = async () => {
    try {
      setDataLoading(true);
      const res = await companyApi.get();
      if (res.data && res.data.data) {
        const c = res.data.data;
        setData(prev => ({
          ...prev,
          companyName: c.companyName || prev.companyName,
          companyLogo: c.logoUrl || prev.companyLogo,
          companyAddress: c.address || prev.companyAddress,
          factoryAddress: c.factoryAddress || prev.factoryAddress,
          companyGSTIN: c.gstNumber || prev.companyGSTIN,
          companyEmail: c.email || prev.companyEmail,
          companyPhone: c.contactNumber || prev.companyPhone,
          companyPAN: c.panNumber || prev.companyPAN,
          termsAndConditions: c.termsAndConditions || prev.termsAndConditions,
          udyamRegistrationNumber: c.udyamRegistrationNumber || prev.udyamRegistrationNumber,
          companyPincode: c.pincode || prev.companyPincode,
          state: c.state || prev.state,
          companyCGST: c.cgst || prev.companyCGST,
          companySGST: c.sgst || prev.companySGST,
          companyIGST: c.igst || prev.companyIGST,
          bankName: c.bankName || prev.bankName,
          accountNo: c.accountNumber || prev.accountNo,
          ifsc: c.ifscCode || prev.ifsc,
          branch: c.branch || prev.branch,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch company details:', error);
      showToast.error('Failed to load company details');
    } finally {
      setDataLoading(false);
    }
  };

  const updateField = (field: keyof CompanyData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setData(prev => ({ ...prev, companyPincode: val, state: val.length < 6 ? '' : prev.state }));

    if (val.length < 6) {
      setErrors(prev => ({ ...prev, companyPincode: 'Invalid pincode (6 digits required)' }));
      return;
    }

    if (val === data.companyPincode) return;

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.companyPincode;
      return newErrors;
    });

    const target = e.target;

    try {
      setIsFetchingState(true);
      let resData = null;

      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        if (!res.ok) throw new Error('API fetch failed');
        resData = await res.json();
      } catch (err) {
        const fallbackRes = await fetch(`https://api.zippopotam.us/in/${val}`);
        if (!fallbackRes.ok) throw new Error('Fallback API fetch failed');
        const fallbackData = await fallbackRes.json();
        if (fallbackData && fallbackData.places && fallbackData.places.length > 0) {
          resData = [{ Status: 'Success', PostOffice: [{ State: fallbackData.places[0].state }] }];
        } else {
          throw new Error('No records found in fallback');
        }
      }

      if (target.value.replace(/\D/g, '').slice(0, 6) !== val) return;

      if (resData?.[0]?.Status === 'Success' && resData[0].PostOffice?.length > 0) {
        setData(prev => ({ ...prev, state: resData[0].PostOffice[0].State }));
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.state;
          return newErrors;
        });
      } else {
        setErrors(prev => ({ ...prev, companyPincode: 'Invalid pincode — no records found' }));
      }
    } catch (error) {
      if (target.value.replace(/\D/g, '').slice(0, 6) !== val) return;
      setErrors(prev => ({
        ...prev,
        companyPincode: 'Failed to auto-fetch state. Please enter manually.',
      }));
    } finally {
      if (target.value.replace(/\D/g, '').slice(0, 6) === val) {
        setIsFetchingState(false);
      }
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (data.companyPhone && !/^\d{10}$/.test(data.companyPhone.replace(/\D/g, ''))) {
      newErrors.companyPhone = 'Invalid phone number (10 digits required)';
    }

    if (data.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.companyEmail)) {
      newErrors.companyEmail = 'Invalid email address';
    }

    if (data.companyPincode && !/^\d{6}$/.test(data.companyPincode)) {
      newErrors.companyPincode = 'Invalid pincode (6 digits required)';
    }

    const validateRate = (val: string | number | undefined, field: string) => {
      if (val !== undefined && val !== '' && isNaN(Number(val))) {
        newErrors[field] = 'Must be a number';
      }
    };

    validateRate(data.companyCGST, 'companyCGST');
    validateRate(data.companySGST, 'companySGST');
    validateRate(data.companyIGST, 'companyIGST');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showToast.error('Please fix validation errors');
      return;
    }

    try {
      setLoading(true);
      await companyApi.update({
        companyName: data.companyName,
        logoUrl: data.companyLogo,
        address: data.companyAddress,
        factoryAddress: data.factoryAddress,
        gstNumber: data.companyGSTIN,
        email: data.companyEmail,
        contactNumber: data.companyPhone,
        panNumber: data.companyPAN,
        termsAndConditions: data.termsAndConditions,
        udyamRegistrationNumber: data.udyamRegistrationNumber,
        pincode: data.companyPincode,
        state: data.state,
        cgst: data.companyCGST?.toString() || '',
        sgst: data.companySGST?.toString() || '',
        igst: data.companyIGST?.toString() || '',
        bankName: data.bankName,
        accountNumber: data.accountNo,
        ifscCode: data.ifsc,
        branch: data.branch,
      });
      showToast.success('Company details saved successfully');
    } catch (err) {
      console.error(err);
      showToast.error('Failed to save company details');
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return <div className="p-8 text-center text-gray-500">Loading company details...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in bg-[var(--background)] min-h-screen">
      <PageHeader
        metadataPath="/company-details"
        title="Company Details"
        description="Configure your company details for quotations and invoices"
      />

      <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)] shadow-sm max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 border-b pb-2">
          Company Information
        </h3>

        <div className="space-y-6">
          {/* Company Name and Logo */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Company Name
              </label>
              <Input
                value={data.companyName}
                onChange={e => updateField('companyName', e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Company Logo
              </label>
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div className="h-24 w-24 border border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                  {data.companyLogo ? (
                    <img
                      src={data.companyLogo}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">No Logo</span>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <input
                      type="file"
                      id="logo-upload"
                      className="hidden"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 500 * 1024) {
                            // 500KB limit
                            showToast.error('File too large. Please upload an image under 500KB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            updateField('companyLogo', reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="logo-upload"
                      className="cursor-pointer px-4 py-2 bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--primary)] transition-all flex items-center gap-2 shadow-sm justify-center"
                    >
                      <Upload size={16} className="text-[var(--primary)]" />
                      <span>Upload Logo</span>
                    </label>
                  </div>
                  {data.companyLogo && (
                    <button
                      onClick={() => updateField('companyLogo', '')}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 px-4 py-1"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact, Email, Pincode, State */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Contact Number
              </label>
              <Input
                value={data.companyPhone}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 10) updateField('companyPhone', val);
                }}
                error={errors.companyPhone}
                placeholder="Enter 10 digit number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Email Address
              </label>
              <Input
                value={data.companyEmail}
                onChange={e => updateField('companyEmail', e.target.value)}
                error={errors.companyEmail}
                placeholder="company@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Pincode
              </label>
              <Input
                value={data.companyPincode || ''}
                onChange={handlePincodeChange}
                error={errors.companyPincode}
                placeholder="6 digits"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                State
              </label>
              <Input
                value={data.state || ''}
                onChange={e => updateField('state', e.target.value)}
                error={errors.state}
                placeholder="State"
                disabled={isFetchingState}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Company Address
            </label>
            <textarea
              value={data.companyAddress}
              onChange={e => updateField('companyAddress', e.target.value)}
              rows={3}
              placeholder="Enter full company address"
              className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>

          {/* Factory Address */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Factory Address
            </label>
            <textarea
              value={data.factoryAddress || ''}
              onChange={e => updateField('factoryAddress', e.target.value)}
              rows={3}
              placeholder="Enter full factory address"
              className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>

          {/* GSTIN, PAN, Udyam */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                GSTIN
              </label>
              <Input
                value={data.companyGSTIN}
                onChange={e => updateField('companyGSTIN', e.target.value.toUpperCase())}
                placeholder="Enter GSTIN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                PAN Number
              </label>
              <Input
                value={data.companyPAN || ''}
                onChange={e => updateField('companyPAN', e.target.value.toUpperCase())}
                placeholder="Enter PAN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Udyam Reg. No
              </label>
              <Input
                value={data.udyamRegistrationNumber}
                onChange={e => updateField('udyamRegistrationNumber', e.target.value)}
                placeholder="Enter Udyam No"
              />
            </div>
          </div>

          {/* Tax Rates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[var(--border)]">
            <div className="md:col-span-3 pb-2">
              <h4 className="text-sm font-semibold text-[var(--text-secondary)]">
                Default Tax Rates (%)
              </h4>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                CGST Rate
              </label>
              <Input
                type="number"
                value={data.companyCGST}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) updateField('companyCGST', val);
                }}
                error={errors.companyCGST}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                SGST Rate
              </label>
              <Input
                type="number"
                value={data.companySGST}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) updateField('companySGST', val);
                }}
                error={errors.companySGST}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                IGST Rate
              </label>
              <Input
                type="number"
                value={data.companyIGST}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) updateField('companyIGST', val);
                }}
                error={errors.companyIGST}
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="border-t border-[var(--border)] pt-6 mt-6">
            <h4 className="text-md font-semibold text-[var(--text-primary)] mb-4">Bank Details</h4>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Bank Name
                  </label>
                  <Input
                    value={data.bankName}
                    onChange={e => updateField('bankName', e.target.value)}
                    placeholder="Enter Bank Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Account Number
                  </label>
                  <Input
                    value={data.accountNo}
                    onChange={e => updateField('accountNo', e.target.value)}
                    placeholder="Enter Account Number"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    IFSC Code
                  </label>
                  <Input
                    value={data.ifsc}
                    onChange={e => updateField('ifsc', e.target.value.toUpperCase())}
                    placeholder="Enter IFSC Code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Branch
                  </label>
                  <Input
                    value={data.branch}
                    onChange={e => updateField('branch', e.target.value)}
                    placeholder="Enter Branch Name"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="border-t border-[var(--border)] pt-6 mt-6">
            <h4 className="text-md font-semibold text-[var(--text-primary)] mb-4">
              Default Terms & Conditions
            </h4>
            <textarea
              value={data.termsAndConditions || ''}
              onChange={e => updateField('termsAndConditions', e.target.value)}
              rows={6}
              placeholder="Enter standard terms and conditions..."
              className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="pt-6 mt-6 border-t border-[var(--border)] flex justify-end">
            <Button
              onClick={handleSave}
              isLoading={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-8"
              size="lg"
            >
              <Save size={18} /> Save Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyDetailsPage;
