import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Download, FileText, Save, X, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { ColumnDef } from '@tanstack/react-table';

import { showToast } from '@/utils/toast';
import { numberToWords } from '@/utils/formatters';
import { QuotationData, QuotationItem } from '../types';
import { addPdfFooter } from '@/utils/pdfUtils';
import { formatGoogleDriveUrl } from '@/utils/stringUtils';

import { Product } from '@/features/inventory/types';

import { tncApi } from '@/features/tnc/api/tncApi';
import { Tnc } from '@/features/tnc/types';

import SearchableSelect from '@/components/ui/SearchableSelect';
import { Select, Modal, Input } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { quotationApi, QuotationRecord } from '../api/quotationApi';
import { companyApi } from '@/features/company/api/companyApi';

// Additional imports for Create Quotation functionality
import { customerApi } from '@/features/masters/api/customerApi';
import { employeeApi } from '@/features/employees/api/employeeApi';
import { inventoryApi } from '@/features/inventory/api/inventoryApi';
import { Customer } from '@/features/masters/types';
import { Employee } from '@/features/employees/types';

const INITIAL_DATA: QuotationData = {
  quotationNo: '',
  date: format(new Date(), 'dd-MMM-yy'),
  paymentTerms: '30 Days',
  buyerRef: '',
  otherRef: '',
  dispatchThrough: '',
  destination: '',
  deliveryTerms: '',

  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyGSTIN: '',
  companyState: '',
  companyCode: '',
  companyPAN: '',
  termsAndConditions: '',

  udyamRegistrationNumber: '',
  companyPincode: '',
  companyCGST: '',
  companySGST: '',
  companyIGST: '',

  items: [
    {
      id: 1,
      description: '',
      hsn: '',
      dueOn: '',
      quantity: 0,
      rate: 0,
      per: 'no.',
      discount: 0,
      cgstRate: 9,
      sgstRate: 9,
    },
  ],
  bankName: '',
  accountNo: '',
  ifsc: '',
  branch: '',
};

const EditableInput = ({
  value,
  onChange,
  className = '',
  type = 'text',
  isPdfMode = false,
  readOnly = false,
}: {
  value: string | number;
  onChange: (val: string) => void;
  className?: string;
  type?: string;
  isPdfMode?: boolean;
  readOnly?: boolean;
}) => {
  if (isPdfMode) {
    return (
      <span className={`inline-block px-1 min-h-[1.2rem] text-[100%] ${className}`}>{value}</span>
    );
  }
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      readOnly={readOnly}
      className={`bg-transparent border-b border-dashed border-gray-300 text-[100%] ${readOnly ? 'cursor-default' : 'hover:border-gray-400 focus:border-blue-500'} focus:ring-0 outline-none w-full px-1 ${className}`}
    />
  );
};

const EditableTextArea = ({
  value,
  onChange,
  className = '',
  rows = 3,
  isPdfMode = false,
  readOnly = false,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  rows?: number;
  isPdfMode?: boolean;
  readOnly?: boolean;
}) => {
  if (isPdfMode) {
    return <div className={`whitespace-pre-wrap px-1 text-[100%] ${className}`}>{value}</div>;
  }
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      readOnly={readOnly}
      className={`bg-transparent border border-dashed border-gray-300 text-[100%] ${readOnly ? 'cursor-default' : 'hover:border-gray-400 focus:border-blue-500'} focus:ring-0 outline-none w-full p-1 resize-none ${className}`}
    />
  );
};

const calculateItemAmount = (item: QuotationItem) => {
  return item.quantity * item.rate * (1 - item.discount / 100);
};

// Interface for Modal Props
interface QuotationMakerProps {
  initialData?: QuotationData;
  isModal?: boolean;
  onClose?: () => void;
  onUpdate?: () => void;
}

const QuotationMaker: React.FC<QuotationMakerProps> = ({
  initialData,
  isModal = false,
  onClose,
  onUpdate,
}) => {
  const [data, setData] = useState<QuotationData>(initialData || INITIAL_DATA);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salesPersonEmployees, setSalesPersonEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [tncList, setTncList] = useState<Tnc[]>([]);
  const [selectedTermType, setSelectedTermType] = useState<string>('');

  // Fetch TNC data for quotation terms
  useEffect(() => {
    const fetchTnc = async () => {
      try {
        const res = await tncApi.getAllTnc();
        if (res.data) setTncList(res.data);
        else setTncList((res as unknown as Tnc[]) || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTnc();
  }, []);

  const tncTypes = useMemo(() => {
    return Array.from(new Set(tncList.map(t => t.type || 'General'))).sort();
  }, [tncList]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [isPdfMode, setIsPdfMode] = useState(false);
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [autoDownloadPending, setAutoDownloadPending] = useState(false);
  const [shouldAutoClose, setShouldAutoClose] = useState(false);
  const [isEditMode, setIsEditMode] = useState(!!initialData); // Auto-set edit mode if initialData provided
  const [editQuotationId, setEditQuotationId] = useState<number | null>(null);
  const [isInvoice, setIsInvoice] = useState(false); // New state for Invoice mode

  // Quotation Modal State
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [quotationAddress, setQuotationAddress] = useState('');
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState('');
  const [selectedDeliveryTerms, setSelectedDeliveryTerms] = useState('');
  const [quotationLoading, setQuotationLoading] = useState(false);
  const toastShownRef = useRef(false);
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.Role
    ? ['Admin', 'SuperAdmin', 'Accounts Manager'].includes(user.Role)
    : false;
  // Check if current loaded data is Approved (for Sales)
  // Logic: Only allow download if status is Approved, Received, or Converted.
  // New/Draft/Pending/Generated are not downloadable by Sales.
  const isApprovedStatus = ['Approved', 'Received', 'Converted', 'Generated'].includes(
    data.status || ''
  );
  const canDownload = isAdmin || isApprovedStatus;

  // Initialize from initialData if provided (Modal Mode)
  useEffect(() => {
    if (initialData) {
      setData(prev => ({
        ...prev,
        ...initialData,
      }));
      if ((initialData as any).quotationId) {
        setEditQuotationId((initialData as any).quotationId);
        setIsEditMode(true);
      }
    }
  }, [initialData]);

  // Handle imported data from navigation state

  // Handle imported data from navigation state
  useEffect(() => {
    if (location.state?.importedData) {
      const imported = location.state.importedData;
      setData(prev => ({
        ...prev,
        ...imported,
        // Only use INITIAL_DATA if the imported does not have them
        companyName: imported.companyName || INITIAL_DATA.companyName,
        companyAddress: imported.companyAddress || INITIAL_DATA.companyAddress,
        companyGSTIN: imported.companyGSTIN || INITIAL_DATA.companyGSTIN,
        companyState: imported.companyState || INITIAL_DATA.companyState,
        companyCode: imported.companyCode || INITIAL_DATA.companyCode,
        companyEmail: imported.companyEmail || INITIAL_DATA.companyEmail,
      }));

      // Check for edit mode (updating rejected quotation)
      // Use a ref to prevent double toasts in Strict Mode if possible,
      // though state updates might still cause re-renders.
      if (location.state.editMode && location.state.quotationId) {
        setIsEditMode(true);
        setEditQuotationId(location.state.quotationId);
        if (!toastShownRef.current) {
          showToast.success('Edit mode: Update quotation and resubmit for approval');
          toastShownRef.current = true;
        }
      } else {
        if (!toastShownRef.current) {
          showToast.success('Data imported from Create Order');
          toastShownRef.current = true;
        }
      }

      // Check for auto-download flag
      if (location.state.autoDownload) {
        setAutoDownloadPending(true);
      }

      // Check for invoice mode
      if (location.state.isInvoice) {
        setIsInvoice(true);
      }

      // Removed window.history.replaceState to prevent data loss on remount (Strict Mode) and allow refresh
    }

    // Also check URL query param for download data key (from new window)
    const searchParams = new URLSearchParams(location.search);
    const downloadKey = searchParams.get('download');
    if (downloadKey) {
      const storedData = sessionStorage.getItem(downloadKey) || localStorage.getItem(downloadKey);
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          if (parsed.importedData) {
            setData(prev => ({
              ...prev,
              ...parsed.importedData,
              // Only use INITIAL_DATA if the importedData does not have them
              companyName: parsed.importedData.companyName || INITIAL_DATA.companyName,
              companyAddress: parsed.importedData.companyAddress || INITIAL_DATA.companyAddress,
              companyGSTIN: parsed.importedData.companyGSTIN || INITIAL_DATA.companyGSTIN,
              companyState: parsed.importedData.companyState || INITIAL_DATA.companyState,
              companyCode: parsed.importedData.companyCode || INITIAL_DATA.companyCode,
              companyEmail: parsed.importedData.companyEmail || INITIAL_DATA.companyEmail,
            }));

            if (parsed.autoDownload) {
              setAutoDownloadPending(true);
              setShouldAutoClose(true); // Flag to close window after download
            }
            if (parsed.isInvoice) {
              setIsInvoice(true);
            }
          }
          // Clean up
          sessionStorage.removeItem(downloadKey);
          localStorage.removeItem(downloadKey);
        } catch (e) {
          console.error('Failed to parse download data', e);
        }
      }
    }
  }, [location]);

  // Auto-download when pending and in preview mode
  useEffect(() => {
    if (autoDownloadPending && printRef.current && !isGenerating) {
      // Small delay to ensure render is complete
      const timer = setTimeout(() => {
        handleDownloadPDF(shouldAutoClose); // Pass auto-close flag
        setAutoDownloadPending(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoDownloadPending, isGenerating, shouldAutoClose]);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [customersRes, employeesRes, productsRes, companyRes] = await Promise.all([
          customerApi.getAll(),
          employeeApi.getAll(),
          inventoryApi.getAllProducts(),
          companyApi.get().catch(() => ({ data: null })),
        ]);

        setCustomers(customersRes.data || []);
        setEmployees(employeesRes.data || []);
        setSalesPersonEmployees(employeesRes.data || []);
        setProducts(productsRes || []);

        // Update company info if available
        if (companyRes?.data) {
          // Response structure is { success: true, data: CompanyInfo }
          const c = (companyRes.data as any).data;

          if (c) {
            setData(prev => ({
              ...prev,
              companyName: c.companyName || prev.companyName,
              companyLogo: c.logoUrl || prev.companyLogo,
              companyAddress: c.address || prev.companyAddress,
              companyGSTIN: c.gstNumber || prev.companyGSTIN,
              companyState: c.state || prev.companyState,
              companyEmail: c.email || prev.companyEmail,
              companyPhone: c.contactNumber || prev.companyPhone,
              companyPAN: c.panNumber || prev.companyPAN,
              termsAndConditions: c.termsAndConditions || prev.termsAndConditions,

              udyamRegistrationNumber: c.udyamRegistrationNumber || prev.udyamRegistrationNumber,
              companyPincode: c.pincode || prev.companyPincode,
              companyCGST: c.cgst || prev.companyCGST,
              companySGST: c.sgst || prev.companySGST,
              companyIGST: c.igst || prev.companyIGST,
              // Bank Details
              bankName: c.bankName || prev.bankName,
              accountNo: c.accountNumber || prev.accountNo,
              ifsc: c.ifscCode || prev.ifsc,
              branch: c.branch || prev.branch,
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        showToast.error('Failed to load data');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
    fetchQuotations();
  }, []);

  // Auto-sync rates from product master when products are loaded (especially useful for edit mode)
  useEffect(() => {
    if (products.length > 0 && isEditMode && data.items.length > 0) {
      // Check if any items have descriptions but need rate updates
      const itemsNeedUpdate = data.items.some(item => item.description && item.rate === 0);

      if (itemsNeedUpdate) {
        setData(prev => ({
          ...prev,
          items: prev.items.map(item => {
            if (item.description && item.rate === 0) {
              const product = products.find(p => p.productName === item.description);
              if (product) {
                return {
                  ...item,
                  rate: product.sellingPrice || item.rate,
                };
              }
            }
            return item;
          }),
        }));
      }
    }
  }, [products, isEditMode]);

  // Removed - not needed for view/download only mode
  // const fetchQuotations = async () => {
  //   try {
  //     const res = await quotationApi.getAll();
  //     setQuotationsList(res.data.data);
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

  // Fetch quotations (used to refresh list after save)
  const fetchQuotations = async () => {
    try {
      const res = await quotationApi.getAll();
      setQuotationsList(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
    }
  };

  const handleSaveQuotation = async () => {
    try {
      setQuotationLoading(true);
      const isUpdate = isEditMode && !!editQuotationId;
      console.log('Detailed Save/Update Logic:', { isEditMode, editQuotationId, isUpdate });

      showToast.loading(
        isUpdate ? 'Updating Quotation...' : 'Saving Quotation...',
        'quotation-save'
      );

      if (isUpdate) {
        // Explicit Update Call
        console.log('Calling quotationApi.update with ID:', editQuotationId);
        await quotationApi.update(editQuotationId!, data);
        showToast.success('Quotation Updated Successfully', 'quotation-save');

        // Reset edit mode only if NOT in modal (modal closes anyway)
        if (!isModal) {
          setData(prev => ({ ...prev, status: 'Pending' }));
          setIsEditMode(false);
          setEditQuotationId(null);
        }
      } else {
        // Create Call
        console.log('Calling quotationApi.create');
        await quotationApi.create(data);
        showToast.success(
          isAdmin ? 'Quotation Saved' : 'Quotation Sent for Approval',
          'quotation-save'
        );
        if (!isModal) {
          setData(prev => ({ ...prev, status: 'Pending' }));
        }
      }

      // Refresh local list if needed
      await fetchQuotations();

      // If in Modal mode, call parent handlers
      if (isModal) {
        if (onUpdate) onUpdate();
        if (onClose) onClose();
      }
    } catch (error) {
      console.error('Save Quotation Error:', error);
      showToast.error('Failed to save quotation', 'quotation-save');
    } finally {
      setQuotationLoading(false);
    }
  };

  // Removed - not needed for view/download only mode
  // const fetchProducts = async () => {
  //   try {
  //     const response = await productApi.getAll();
  //     setProducts(response.data || []);
  //   } catch (error) {
  //     console.error('Failed to fetch products', error);
  //     showToast.error('Failed to load products list', 'products-load');
  //   }
  // };

  const calculateTotal = () => {
    return data.items.reduce((sum, item) => sum + calculateItemAmount(item), 0);
  };

  const calculateTaxBreakdown = () => {
    let totalCGST = 0;
    let totalSGST = 0;

    data.items.forEach(item => {
      const taxable = calculateItemAmount(item);
      const cRate = item.cgstRate ?? 9;
      const sRate = item.sgstRate ?? 9;

      totalCGST += taxable * (cRate / 100);
      totalSGST += taxable * (sRate / 100);
    });

    return { totalCGST, totalSGST };
  };

  const totalAmount = calculateTotal();
  const { totalCGST, totalSGST } = calculateTaxBreakdown();

  // Use manual override if present, else calculated
  const finalCGST = data.cgstTotal ?? totalCGST;
  const finalSGST = data.sgstTotal ?? totalSGST;

  const finalTotal = totalAmount + finalCGST + finalSGST;

  const firstItem = data.items[0];

  // ── GST State Determination ──────────────────────────────────────────────
  // Determines CGST+SGST (intra-state) vs IGST (inter-state) using ONLY
  // the company state vs customer/buyer state comparison.
  // GSTIN prefix / GST code extraction is intentionally NOT used here.

  const normalizeState = (value?: string) => value?.trim().toLowerCase().replace(/\s+/g, ' ');

  const companyStateNorm = normalizeState(data.companyState);

  // Prefer explicit buyerState field; fall back to customer lookup
  const rawBuyerState: string =
    (data as any).buyerState ||
    (() => {
      if (data.customerId && customers.length > 0) {
        const cust = customers.find(c => c.CustomerID === data.customerId);
        return cust?.State || '';
      }
      return '';
    })();

  const customerStateNorm = normalizeState(rawBuyerState);

  // Debug logs (temporary – remove once verified)
  console.log('Company State:', data.companyState);
  console.log('Customer State:', rawBuyerState);
  console.log(
    'Is Same State:',
    !!(companyStateNorm && customerStateNorm && companyStateNorm === customerStateNorm)
  );

  const isSameState: boolean = !!(
    companyStateNorm &&
    customerStateNorm &&
    companyStateNorm === customerStateNorm
  );

  const isMobile = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleDownloadPDF = async (autoClose = false) => {
    if (!printRef.current) return;

    // Store original width to restore later
    const originalWidth = printRef.current.style.width;

    try {
      setIsGenerating(true);
      showToast.loading('Preparing PDF...', 'pdf-gen');

      // 1. Toggle to "PDF Mode" (Static Text)
      setIsPdfMode(true);

      // 2. Wait for React to render the text version
      await new Promise(resolve => setTimeout(resolve, 500));
      const element = printRef.current;

      // 3. Don't change width - keep it at 210mm for proper A4 proportions
      // The element is already styled to 210mm width in the render

      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2, // High quality
        width: 794, // Force A4 width in pixels (approx 210mm @ 96dpi)
        style: {
          margin: '0', // Remove margins during capture to prevent centering issues
          boxShadow: 'none', // Remove shadow
        },
        backgroundColor: '#ffffff',
        filter: node => {
          // Exclude elements with 'no-print' class
          if (node instanceof HTMLElement && node.classList.contains('no-print')) {
            return false;
          }
          return true;
        },
      });

      // Restore original width immediately after capture
      element.style.width = originalWidth;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm

      // Always use full page width and maintain aspect ratio
      // Height will extend beyond one page if needed, which is acceptable
      const finalWidth = pdfWidth;
      const finalHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, finalWidth, finalHeight);

      const prefix = isInvoice ? 'Invoice' : 'Quotation';
      const customerName = (data.buyerName || 'Customer').replace(/[^a-z0-9]/gi, '_');

      addPdfFooter(pdf);
      pdf.save(`${prefix}_${customerName}.pdf`);

      showToast.success('PDF Downloaded!', 'pdf-gen');
      setDownloadDone(true);

      // Auto close window if requested - DISABLED for mobile to prevent download interruption
      if (autoClose && !isMobile()) {
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } catch (error) {
      console.error('PDF Error:', error);
      showToast.error(`Failed to generate PDF: ${(error as any).message}`, 'pdf-gen');
      // Ensure width is restored on error
      if (printRef.current) printRef.current.style.width = originalWidth;
    } finally {
      setIsPdfMode(false); // Revert back to editable mode
      setIsGenerating(false);
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Phone validation (10 digits)
    if (data.companyPhone && !/^\d{10}$/.test(data.companyPhone.replace(/\D/g, ''))) {
      newErrors.companyPhone = 'Invalid phone number (10 digits required)';
    }

    // Email validation
    if (data.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.companyEmail)) {
      newErrors.companyEmail = 'Invalid email address';
    }

    // Pincode validation (6 digits)
    if (data.companyPincode && !/^\d{6}$/.test(data.companyPincode)) {
      newErrors.companyPincode = 'Invalid pincode (6 digits required)';
    }

    // Tax rates validation (numeric)
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

  const handleSaveCompanyInfo = async () => {
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
        gstNumber: data.companyGSTIN,
        email: data.companyEmail,
        contactNumber: data.companyPhone,
        panNumber: data.companyPAN,
        termsAndConditions: data.termsAndConditions,

        udyamRegistrationNumber: data.udyamRegistrationNumber,
        pincode: data.companyPincode,
        cgst: data.companyCGST,
        sgst: data.companySGST,
        igst: data.companyIGST,
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

  const updateField = (field: keyof QuotationData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field if it exists
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // useCallback prevents re-creation on every render, stabilizing the DataTable columns
  const updateItem = useCallback(
    (id: number, field: keyof QuotationItem, value: string | number) => {
      setData(prev => ({
        ...prev,
        items: prev.items.map(item => (item.id === id ? { ...item, [field]: value } : item)),
        cgstTotal: undefined,
        sgstTotal: undefined,
      }));
    },
    []
  );

  const handleProductSelect = useCallback((id: number, productName: string) => {
    if (!productName) return;
    return;
  }, []);

  // Real implementation with products dependency
  const handleProductSelectReal = useCallback(
    (id: number, productName: string) => {
      if (!productName) return;
      const product = products.find(p => p.productName === productName);

      setData(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
            return {
              ...item,
              description: productName,
              rate: product?.sellingPrice || item.rate,
              cgstRate: 9,
              sgstRate: 9,
            };
          }
          return item;
        }),
        cgstTotal: undefined,
        sgstTotal: undefined,
      }));
    },
    [products]
  );

  const addItem = useCallback(() => {
    setData(prev => {
      const newId = Math.max(...prev.items.map(i => i.id), 0) + 1;
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: newId,
            description: '',
            hsn: '',
            dueOn: prev.date,
            quantity: 0,
            rate: 0,
            per: 'no.',
            discount: 0,
            cgstRate: 9,
            sgstRate: 9,
          },
        ],
        cgstTotal: undefined,
        sgstTotal: undefined,
      };
    });
  }, []);

  const deleteItem = useCallback((id: number) => {
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
      cgstTotal: undefined,
      sgstTotal: undefined,
    }));
  }, []);

  const productOptions = useMemo(
    () =>
      products.map(p => {
        const label = p.productName || '';
        const price = p.sellingPrice || 0;

        return {
          id: p.productId,
          label,
          value: label,
          subLabel: `₹${price}`,
        };
      }),
    [products]
  );

  const columns = useMemo<ColumnDef<QuotationItem>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'No',
        cell: ({ row }) => <span className="text-center block">{row.index + 1}</span>,
        size: 50,
      },
      {
        accessorKey: 'description',
        header: 'Product',
        cell: ({ row }) => (
          <SearchableSelect
            options={productOptions}
            value={row.original.description}
            onChange={val => handleProductSelectReal(row.original.id, val as string)}
            placeholder="Select Product"
            creatable
            onCreateNew={val => updateItem(row.original.id, 'description', val)}
            className="w-full"
          />
        ),
        size: 300,
      },

      {
        accessorKey: 'quantity',
        header: 'Qty',
        cell: ({ row }) => (
          <Input
            type="number"
            value={row.original.quantity}
            onChange={e => updateItem(row.original.id, 'quantity', parseFloat(e.target.value) || 0)}
            className="h-9"
          />
        ),
        size: 80,
      },
      {
        accessorKey: 'rate',
        header: 'Rate',
        cell: ({ row }) => (
          <Input
            type="number"
            value={row.original.rate}
            onChange={e => updateItem(row.original.id, 'rate', parseFloat(e.target.value) || 0)}
            className="h-9"
          />
        ),
        size: 100,
      },
      {
        accessorKey: 'discount',
        header: 'Disc%',
        cell: ({ row }) => (
          <Input
            type="number"
            value={row.original.discount}
            onChange={e => {
              let val = parseFloat(e.target.value) || 0;
              if (val > 20) {
                val = 20;
                showToast.error('Discount cannot exceed 20%');
              }
              if (val < 0) val = 0;
              updateItem(row.original.id, 'discount', val);
            }}
            className="h-9"
            max={20}
            min={0}
          />
        ),
        size: 80,
      },
      {
        accessorKey: 'cgstRate',
        header: 'CGST%',
        cell: ({ row }) => (
          <Input
            type="number"
            value={row.original.cgstRate ?? 9}
            onChange={e => updateItem(row.original.id, 'cgstRate', parseFloat(e.target.value) || 0)}
            className="h-9"
          />
        ),
        size: 80,
      },
      {
        accessorKey: 'sgstRate',
        header: 'SGST%',
        cell: ({ row }) => (
          <Input
            type="number"
            value={row.original.sgstRate ?? 9}
            onChange={e => updateItem(row.original.id, 'sgstRate', parseFloat(e.target.value) || 0)}
            className="h-9"
          />
        ),
        size: 80,
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {calculateItemAmount(row.original).toFixed(2)}
          </div>
        ),
        size: 100,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-center">
            <button
              onClick={() => deleteItem(row.original.id)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
        size: 50,
      },
    ],
    [productOptions, handleProductSelectReal, updateItem, deleteItem]
  );

  // Removed 'form' mode check. Component now always renders the editor view.
  // The 'preview' return block below is now the main render.

  // Preview Mode
  return (
    <div className="p-6 max-w-[1250px] mx-auto relative bg-[var(--background)]">
      {/* Full-screen loading overlay - blocks all interactions during PDF generation */}
      {(autoDownloadPending || isGenerating || (isMobile() && downloadDone)) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-8 shadow-2xl max-w-md w-full text-center border border-[var(--border)]">
            {!downloadDone ? (
              <>
                <div className="relative mb-6">
                  <div className="w-20 h-20 border-4 border-blue-100 rounded-full mx-auto"></div>
                  <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full mx-auto animate-spin absolute top-0 left-1/2 -translate-x-1/2"></div>
                </div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                  {isGenerating ? 'Generating PDF...' : 'Preparing Quotation...'}
                </h3>
                <p className="text-[var(--text-secondary)] mb-6">
                  {isGenerating
                    ? 'Your quotation PDF is being created. High quality rendering in progress...'
                    : 'Loading quotation data for download...'}
                </p>
                <div className="flex justify-center gap-1.5">
                  {[0, 150, 300].map(delay => (
                    <div
                      key={delay}
                      className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    ></div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Download size={40} />
                </div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                  Ready for Download
                </h3>
                <p className="text-[var(--text-secondary)] mb-8">
                  Your PDF should start downloading automatically. If it doesn&apos;t, click the
                  button below.
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => handleDownloadPDF()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 h-auto text-lg font-semibold shadow-lg shadow-blue-200"
                  >
                    <Download size={20} className="mr-2" /> Download Again
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDownloadDone(false);
                      if (shouldAutoClose) window.close();
                    }}
                    className="w-full py-3 h-auto text-lg border-2"
                  >
                    Close Preview
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6 no-print">
        <div className="flex items-center gap-4">
          {/* Hide Edit button if in auto-close/download mode */}

          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quotation Preview</h1>
        </div>
        <div className="flex gap-3 items-center">
          {/* Add Update/Save Buttons for Modal Mode */}
          {(isEditMode || !isModal) && (
            <Button
              onClick={handleSaveQuotation}
              isLoading={quotationLoading}
              className={`flex items-center gap-2 text-white shadow-sm ${isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              <Save size={18} />
              {isEditMode ? 'Update & Resubmit' : 'Create Quotation'}
            </Button>
          )}

          {/* Invoice Mode Toggle */}
          <Button
            onClick={() => setIsInvoice(!isInvoice)}
            variant="secondary"
            className={`flex items-center gap-2 ${isInvoice ? 'bg-purple-50 text-purple-700 border-purple-200' : 'text-gray-600'}`}
          >
            <FileText size={16} />
            {isInvoice ? 'Invoice Mode' : 'Quotation Mode'}
          </Button>

          {!canDownload && (
            <span className="text-orange-600 font-medium text-sm flex items-center bg-orange-50 px-3 py-2 rounded border border-orange-200">
              {data.status === 'Pending' ? 'Wait for Admin Approval' : 'Approval Required'}
            </span>
          )}
          <Button
            onClick={() => handleDownloadPDF()}
            isLoading={isGenerating}
            disabled={!canDownload}
            className={`flex items-center gap-2 text-white no-print ${
              canDownload ? 'bg-[var(--primary)]' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <Download size={18} /> Download PDF
          </Button>

          {/* Close Button for Modal */}
          {isModal && (
            <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-[var(--background)] p-8 rounded-xl shadow-inner border border-[var(--border)] w-full">
        <div
          ref={printRef}
          id="quotation-print-area"
          className="bg-white mx-auto shadow-xl text-black shrink-0"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '15mm 12mm',
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* Header Title */}
          <div className="text-center font-bold text-[14pt] mb-2 uppercase text-black">
            {isInvoice ? 'TAX INVOICE' : 'QUOTATION'}
          </div>
          <div className="border-[0.75pt] border-black text-[8.5pt] leading-[1.2]">
            {/* Top Section: Split Columns */}
            <div className="grid grid-cols-[55%_45%] divide-x divide-black text-black">
              {/* LEFT COLUMN */}
              <div className="flex flex-col divide-y divide-black">
                {/* Company Details */}
                <div className="p-1 flex gap-2">
                  <div className="w-[100px] flex-shrink-0 flex items-start justify-center pt-1">
                    {/* Helper to process Google Drive links */}
                    {(() => {
                      const logoUrl = formatGoogleDriveUrl(data.companyLogo) || '/morex-logo.png';
                      return (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="w-auto max-h-[50px] object-contain"
                          crossOrigin="anonymous"
                          onError={e => {
                            (e.target as HTMLImageElement).src = '/morex-logo.png';
                          }}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex-grow">
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.companyName}
                      onChange={v => updateField('companyName', v)}
                      className="font-bold text-[9pt] mb-1"
                    />
                    <EditableTextArea
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.companyAddress}
                      onChange={v => updateField('companyAddress', v)}
                      className="text-[8.5pt] h-[60px]"
                    />
                    <div className="mt-1 text-[8.5pt]">
                      <span className="font-bold">GSTIN/UIN:</span>
                      <EditableInput
                        isPdfMode={isPdfMode}
                        readOnly={isPdfMode}
                        value={data.companyGSTIN}
                        onChange={v => updateField('companyGSTIN', v)}
                        className="w-40 inline-block ml-1"
                      />
                    </div>
                    <div className="text-[8.5pt]">
                      <span className="font-bold">Email:</span>
                      <EditableInput
                        isPdfMode={isPdfMode}
                        readOnly={isPdfMode}
                        value={data.companyEmail}
                        onChange={v => updateField('companyEmail', v)}
                        className="w-40 inline-block ml-1"
                      />
                    </div>
                    <div className="text-[8.5pt]">
                      <span className="font-bold">Contact:</span>
                      <EditableInput
                        isPdfMode={isPdfMode}
                        readOnly={isPdfMode}
                        value={data.companyPhone || ''}
                        onChange={v => updateField('companyPhone', v)}
                        className="w-40 inline-block ml-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Consignee (Buyer) Section */}
                <div className="p-1 border-t border-black">
                  <span className="font-bold block text-[8pt] mb-1">Consignee (Ship to)</span>
                  <div>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.buyerName || data.customerAddress?.split('\n')[0] || ''}
                      onChange={v => updateField('buyerName', v)}
                      className="font-bold text-[9pt] mb-1"
                    />
                    <EditableTextArea
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.buyerAddress || data.customerAddress || ''}
                      onChange={v => updateField('buyerAddress', v)}
                      className="text-[8.5pt] h-[50px]"
                      rows={2}
                    />
                    {data.buyerGSTIN && (
                      <div className="mt-1">
                        <span className="font-bold">GSTIN/UIN:</span>
                        <EditableInput
                          isPdfMode={isPdfMode}
                          readOnly={isPdfMode}
                          value={data.buyerGSTIN || ''}
                          onChange={v => updateField('buyerGSTIN', v)}
                          className="w-40 inline-block ml-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN - Metadata */}
              <div className="flex flex-col divide-y divide-black">
                {/* Quotation No & Date */}
                <div className="grid grid-cols-2 divide-x divide-black h-[50px]">
                  <div className="p-1">
                    <span className="font-bold block text-[8pt]">
                      {isInvoice ? 'Bill No.' : 'Quotation No.'}
                    </span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.quotationNo}
                      onChange={v => updateField('quotationNo', v)}
                      className="font-bold"
                    />
                  </div>
                  <div className="p-1">
                    <span className="font-bold block text-[8pt]">Dated</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.date}
                      onChange={v => updateField('date', v)}
                      className="font-bold"
                    />
                  </div>
                </div>

                {/* Buyer Ref / Other Ref */}
                <div className="grid grid-cols-2 divide-x divide-black h-[50px]">
                  <div className="p-1">
                    <span className="font-bold block text-[8pt]">Buyer&apos;s Ref./Order No.</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.buyerRef}
                      onChange={v => updateField('buyerRef', v)}
                      className="font-bold"
                    />
                  </div>
                  <div className="p-1">
                    <span className="font-bold block text-[8pt]">Sales Person</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.otherRef}
                      onChange={v => updateField('otherRef', v)}
                    />
                  </div>
                </div>

                {/* Dispatch */}
                <div className="h-[50px] p-1">
                  <span className="font-bold block text-[8pt]">Dispatched through</span>
                  <EditableInput
                    isPdfMode={isPdfMode}
                    readOnly={true}
                    value={data.dispatchThrough}
                    onChange={v => updateField('dispatchThrough', v)}
                  />
                </div>

                {/* NEW: Payment Terms - Matches Dispatched through layout */}
                <div className="p-1 ml-[5px]">
                  {/* Payment Terms */}
                  <div className="mb-2">
                    <span className="font-bold block text-[8pt]">Payment Terms</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={true}
                      value={data.paymentTerms}
                      onChange={v => updateField('paymentTerms', v)}
                    />
                  </div>

                  {/* Terms of Delivery */}
                  <div className="group relative">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold block text-[8pt]">Terms of Delivery</span>

                      {!isPdfMode && (
                        <div className="no-print flex gap-2">
                          <select
                            className="text-[8pt] border rounded p-0.5 bg-white outline-none cursor-pointer flex-1"
                            value={selectedTermType}
                            onChange={e => setSelectedTermType(e.target.value)}
                          >
                            <option value="">Select Type</option>
                            {tncTypes.map(type => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>

                          <select
                            className="text-[8pt] border rounded p-0.5 bg-white outline-none cursor-pointer flex-1"
                            value=""
                            onChange={e => {
                              const val = e.target.value;
                              if (val) {
                                const current = data.deliveryTerms || '';
                                const typeHeader = `Terms of ${selectedTermType}`;

                                const escapedHeader = typeHeader.replace(
                                  /[.*+?^${}()|[\]\\]/g,
                                  '\\$&'
                                );
                                const regex = new RegExp(
                                  `(${escapedHeader}[:]?)([\\s\\S]*?)(?=(\\n\\nTerms of|$))`
                                );
                                const match = current.match(regex);

                                let newVal;
                                if (match) {
                                  const fullMatch = match[0];
                                  const newSection = fullMatch + `\n   - ${val}`;
                                  newVal = current.replace(fullMatch, newSection);
                                } else {
                                  const prefix = current ? '\n\n' : '';
                                  newVal = `${current}${prefix}${typeHeader}:\n   - ${val}`;
                                }

                                updateField('deliveryTerms', newVal);
                              }
                            }}
                            disabled={!selectedTermType}
                          >
                            <option value="">+ Add Term</option>
                            {tncList
                              .filter(t => (t.type || 'General') === selectedTermType)
                              .map(t => (
                                <option key={t.tncId} value={t.description}>
                                  {t.description}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <EditableTextArea
                      isPdfMode={isPdfMode}
                      readOnly={isPdfMode}
                      value={data.deliveryTerms}
                      onChange={v => updateField('deliveryTerms', v)}
                      className="min-h-[50px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-black">
            <table className="w-full text-[8.5pt] border border-black">
              <thead>
                <tr className="bg-white border-b border-black divide-x divide-black">
                  <th className="p-1 w-8 text-center font-bold text-[8pt]">Sl No.</th>
                  <th className="p-1 text-left font-bold text-[8pt]">Description of Goods</th>

                  <th className="p-1 w-16 text-right font-bold text-[8pt]">Quantity</th>
                  <th className="p-1 w-20 text-right font-bold text-[8pt]">Rate</th>
                  <th className="p-1 w-12 text-center font-bold text-[8pt]">Disc %</th>
                  <th className="p-1 w-24 text-right font-bold text-[8pt]">Amount</th>
                  <th className="p-1 w-8 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {data.items.map((item, index) => {
                  // Filter out already selected products for this row
                  const _selectedProducts = data.items
                    .filter(i => i.id !== item.id && i.description)
                    .map(i => i.description);
                  // Note: currentRowOptions could be used for filtering dropdown options
                  void _selectedProducts; // Acknowledge unused variable

                  return (
                    <tr key={item.id} className="divide-x divide-black group">
                      <td className="p-1 text-center align-top">{index + 1}</td>
                      <td className="p-1 align-top relative">
                        <EditableTextArea
                          isPdfMode={isPdfMode}
                          readOnly={isPdfMode}
                          rows={1}
                          value={item.description}
                          onChange={v => updateItem(item.id, 'description', v)}
                          className="w-full text-left min-h-[1.5rem] overflow-hidden"
                        />
                      </td>

                      <td className="p-1 align-top text-right">
                        <EditableInput
                          isPdfMode={isPdfMode}
                          readOnly={isPdfMode}
                          type="number"
                          value={item.quantity || ''}
                          onChange={v => {
                            const val = parseFloat(v);
                            if (val >= 0) updateItem(item.id, 'quantity', val);
                          }}
                          className="text-right font-bold"
                        />
                      </td>
                      <td className="p-1 align-top text-right">
                        <EditableInput
                          isPdfMode={isPdfMode}
                          readOnly={isPdfMode}
                          type="number"
                          value={item.rate || ''}
                          onChange={v => updateItem(item.id, 'rate', parseFloat(v) || 0)}
                          className="text-right"
                        />
                      </td>
                      <td className="p-1 align-top text-center">
                        <EditableInput
                          isPdfMode={isPdfMode}
                          readOnly={isPdfMode}
                          type="number"
                          value={item.discount || ''}
                          onChange={v => {
                            let val = parseFloat(v) || 0;
                            if (val > 20) {
                              val = 20;
                              showToast.error('Discount cannot exceed 20%');
                            }
                            if (val < 0) val = 0;
                            updateItem(item.id, 'discount', val);
                          }}
                          className="text-center"
                        />
                      </td>
                      <td className="p-1 align-top text-right font-bold">
                        {calculateItemAmount(item).toFixed(2)}
                      </td>
                      <td className="p-1 text-center no-print">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr
                  className="no-print bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer"
                  onClick={addItem}
                >
                  <td
                    colSpan={9}
                    className="p-1 text-center text-blue-600 font-medium border-t border-dashed border-blue-200"
                  >
                    + Add New Row
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Totals Section */}
            <div className="border border-black text-[8.5pt]">
              <div className="grid grid-cols-[1fr_144px] divide-x divide-black border-b border-black">
                <div className="p-1 px-4 text-right italic">Sub Total</div>
                <div className="p-1 text-right">{totalAmount.toFixed(2)}</div>
              </div>
              {isSameState ? (
                <>
                  <div className="grid grid-cols-[1fr_144px] divide-x divide-black border-b border-black">
                    <div className="p-1 px-4 text-right italic">
                      CGST {firstItem?.cgstRate ?? 9}%
                    </div>
                    <div className="p-1 text-right">
                      <EditableInput
                        isPdfMode={isPdfMode}
                        readOnly={true}
                        value={finalCGST.toFixed(2)}
                        onChange={v => updateField('cgstTotal', parseFloat(v) || 0)}
                        className="text-right"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_144px] divide-x divide-black">
                    <div className="p-1 px-4 text-right italic">
                      SGST {firstItem?.sgstRate ?? 9}%
                    </div>
                    <div className="p-1 text-right">
                      <EditableInput
                        isPdfMode={isPdfMode}
                        readOnly={true}
                        value={finalSGST.toFixed(2)}
                        onChange={v => updateField('sgstTotal', parseFloat(v) || 0)}
                        className="text-right"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-[1fr_144px] divide-x divide-black">
                  <div className="p-1 px-4 text-right italic">
                    IGST {(firstItem?.cgstRate ?? 9) + (firstItem?.sgstRate ?? 9)}%
                  </div>
                  <div className="p-1 text-right">
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={true}
                      value={(finalCGST + finalSGST).toFixed(2)}
                      onChange={v => {
                        const totalIGSTVal = parseFloat(v) || 0;
                        updateField('cgstTotal', totalIGSTVal / 2);
                        updateField('sgstTotal', totalIGSTVal / 2);
                      }}
                      className="text-right"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border border-black grid grid-cols-[1fr_auto] divide-x divide-black font-bold text-[9pt]">
              <div className="p-1 text-right">Total</div>
              <div className="p-1 w-[144px] text-right">
                ₹ {finalTotal.toFixed(2)}
                <br />
                <span className="text-[7.5pt] text-gray-600 italic">
                  (Incl. {(firstItem?.cgstRate ?? 9) + (firstItem?.sgstRate ?? 9)}% GST)
                </span>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div className="border border-black p-2 text-[8.5pt]">
            <span className="font-normal">Amount Chargeable (in words)</span>
            <div className="font-bold italic mt-1">INR {numberToWords(finalTotal)} Only</div>
          </div>

          {/* Footer */}
          <div className="border border-black grid grid-cols-2 text-[8.5pt]">
            <div className="p-2 border-r border-black">
              <div className="mb-4">
                <span className="font-bold">Company&apos;s PAN</span> :{' '}
                <span className="font-bold">
                  <EditableInput
                    isPdfMode={isPdfMode}
                    readOnly={true}
                    value={data.companyPAN || ''}
                    onChange={v => updateField('companyPAN', v)}
                    className="font-bold inline-block w-auto min-w-[100px]"
                  />
                </span>
              </div>
              <div className="underline mb-1 font-bold">Declaration</div>
              <p className="text-[7.5pt] leading-tight text-gray-600">
                We declare that this invoice shows the actual price of the goods described and that
                all particulars are true and correct.
              </p>
              {!isInvoice && (
                <p className="text-[8pt] mt-2 font-semibold text-blue-700">
                  ✓ This quotation is valid from{' '}
                  {new Date().toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  to{' '}
                  {new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
              {isInvoice && (
                <div className="mt-2 text-[8pt] border-t border-black border-dashed pt-1">
                  <div className="font-bold underline mb-1">Bank Details:</div>
                  <div className="grid grid-cols-[60px_1fr] gap-x-2">
                    <span className="font-semibold">Bank:</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={true}
                      value={data.bankName || ''}
                      onChange={v => updateField('bankName', v)}
                      className="font-bold p-0 h-auto"
                    />
                    <span className="font-semibold">A/c No:</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={true}
                      value={data.accountNo || ''}
                      onChange={v => updateField('accountNo', v)}
                      className="font-bold p-0 h-auto"
                    />
                    <span className="font-semibold">IFSC:</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={true}
                      value={data.ifsc || ''}
                      onChange={v => updateField('ifsc', v)}
                      className="font-bold p-0 h-auto"
                    />
                    <span className="font-semibold">Branch:</span>
                    <EditableInput
                      isPdfMode={isPdfMode}
                      readOnly={true}
                      value={data.branch || ''}
                      onChange={v => updateField('branch', v)}
                      className="p-0 h-auto"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-2 flex flex-col justify-between items-end">
              <div className="font-bold text-right w-full">For {data.companyName}</div>
              <div className="h-10 mt-8 border-b border-black w-40 border-dashed"></div>
              <div className="text-right w-full">Authorized Signatory</div>
            </div>
          </div>
        </div>

        <div className="text-center text-[8pt] text-gray-500 mt-2">
          This is a Computer Generated Document
        </div>
      </div>
    </div>
  );
};

export default QuotationMaker;
