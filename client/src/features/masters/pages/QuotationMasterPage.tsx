import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Check,
  X,
  Download,
  PackagePlus,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Edit,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

import { PageHeader } from '@/components/common';
import { Button, Modal } from '@/components/ui';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { quotationApi, QuotationRecord } from '@/features/quotations/api/quotationApi';
import { inventoryApi } from '@/features/inventory/api/inventoryApi';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { downloadQuotationPDF } from '@/features/quotations/utils/pdfGenerator';
import { decodeHtml } from '@/utils/stringUtils';

interface Product {
  productId?: number;
  ProductID?: number;
  productName?: string;
  ProductName?: string;
  CapacityLtr?: number | null;
  packageCapacityKg?: string | number;
  PackageCapacityKg?: string | number;
  TotalDensity?: string | number;
  hsnCode?: string;
}

const QuotationMasterPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.Role
    ? ['Admin', 'SuperAdmin', 'Accounts Manager'].includes(user.Role)
    : false;

  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  // Modal States
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationRecord | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectRemark, setRejectRemark] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected' | 'converted'
  >('all');

  // Stats
  const stats = useMemo(() => {
    const pending = quotations.filter(q => q.status === 'Pending').length;
    const approved = quotations.filter(q => q.status === 'Approved').length;
    const rejected = quotations.filter(q => q.status === 'Rejected').length;
    const converted = quotations.filter(q => q.status === 'Converted').length;
    return { pending, approved, rejected, converted, total: quotations.length };
  }, [quotations]);

  // Filtered quotations based on current filter
  const filteredQuotations = useMemo(() => {
    if (currentFilter === 'all') return quotations;
    const statusMap = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      converted: 'Converted',
    };
    return quotations.filter(q => q.status === statusMap[currentFilter]);
  }, [quotations, currentFilter]);

  // Helper to get package capacity for a product
  const getPackageCapacity = useCallback(
    (productId: number, description?: string): number => {
      const product = productId
        ? products.find(p => (p.productId || p.ProductID) === productId)
        : null;

      if (product) {
        const capacity = product.packageCapacityKg || product.PackageCapacityKg;
        const weight = typeof capacity === 'string' ? parseFloat(capacity) || 0 : capacity || 0;

        // Check for density to calculate volume (L) from weight (Kg)
        const densityVal = product.TotalDensity;
        const density =
          typeof densityVal === 'string' ? parseFloat(densityVal) || 0 : densityVal || 0;

        // Existing formula path
        if (density > 0 && weight > 0) {
          return weight / density;
        }

        // Fallback to CapacityLtr from product DTO
        if (product.CapacityLtr) {
          const ltr =
            typeof product.CapacityLtr === 'string'
              ? parseFloat(product.CapacityLtr) || 0
              : product.CapacityLtr;
          if (ltr > 0) {
            return ltr;
          }
        }
      }

      // If product lookup fails or CapacityLtr is missing/zero, extract from description string
      if (description) {
        const match = description.match(/-?\s*(\d+(?:\.\d+)?)\s*(?:LTR|L|LITER|LITERS)\b/i);
        if (match && match[1]) {
          const parsed = parseFloat(match[1]);
          if (parsed > 0) {
            return parsed;
          }
        }
      }

      return 0;
    },
    [products]
  );

  // Fetch quotations
  const fetchQuotations = useCallback(async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await quotationApi.getAll();
      setQuotations(response.data?.data || []);
      if (showRefreshToast) {
        showToast.success('Quotations refreshed');
      }
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      showToast.error('Failed to load quotations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
    // Fetch FG products for package capacity lookup
    inventoryApi
      .getProductsByType('FG')
      .then((data: Product[]) => {
        console.log('Products loaded for package capacity:', data?.length || 0);
        setProducts(data || []);
      })
      .catch((err: Error) => {
        console.error('Failed to fetch products:', err);
      });
  }, [fetchQuotations]);

  // Handle View
  const handleView = useCallback((quotation: QuotationRecord) => {
    setSelectedQuotation(quotation);
    setViewModalOpen(true);
  }, []);

  // Handle Approve
  const handleApprove = useCallback(
    async (id: number) => {
      try {
        setActionLoading(true);
        showToast.loading('Approving quotation...', 'approve');
        await quotationApi.approve(id);
        showToast.success('Quotation approved successfully!', 'approve');
        await fetchQuotations();
      } catch (error: any) {
        console.error('Error approving quotation:', error);
        showToast.error(error.response?.data?.error || 'Failed to approve quotation', 'approve');
      } finally {
        setActionLoading(false);
      }
    },
    [fetchQuotations]
  );

  // Handle Reject Modal Open
  const openRejectModal = useCallback((id: number) => {
    setRejectingId(id);
    setRejectRemark('');
    setRejectModalOpen(true);
  }, []);

  // Handle Reject Submit
  const handleReject = useCallback(async () => {
    if (!rejectingId || !rejectRemark.trim()) {
      showToast.error('Please provide a rejection remark');
      return;
    }

    try {
      setActionLoading(true);
      showToast.loading('Rejecting quotation...', 'reject');
      await quotationApi.reject(rejectingId, rejectRemark.trim());
      showToast.success('Quotation rejected', 'reject');
      setRejectModalOpen(false);
      setRejectingId(null);
      setRejectRemark('');
      await fetchQuotations();
    } catch (error: any) {
      console.error('Error rejecting quotation:', error);
      showToast.error(error.response?.data?.error || 'Failed to reject quotation', 'reject');
    } finally {
      setActionLoading(false);
    }
  }, [rejectingId, rejectRemark, fetchQuotations]);

  // Handle Download - Direct PDF download
  const handleDownload = useCallback(async (quotation: QuotationRecord) => {
    try {
      showToast.loading('Generating PDF...', 'pdf-download');
      await downloadQuotationPDF(quotation.content);
      showToast.success('PDF downloaded successfully!', 'pdf-download');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast.error('Failed to generate PDF', 'pdf-download');
    }
  }, []);

  // Handle Edit - Navigate to Editor Page
  const handleEdit = useCallback(
    (quotation: QuotationRecord) => {
      navigate('/quotation-print', {
        state: {
          importedData: quotation.content,
          quotationId: quotation.quotationId,
          editMode: true, // Signal that we are editing an existing quotation
          status: quotation.status,
        },
      });
    },
    [navigate]
  );

  // Table Columns
  const columns: ColumnDef<QuotationRecord>[] = useMemo(
    () => [
      {
        accessorKey: 'quotationNo',
        header: 'Quotation No',
        enableColumnFilter: true,
        cell: ({ row }) => {
          // Add sequence prefix like QTN-1, QTN-2
          const index = quotations.findIndex(q => q.quotationId === row.original.quotationId);
          const seq = quotations.length - index;
          return (
            <div className="flex flex-col">
              <span className="font-mono font-semibold text-[var(--primary)]">QTN-{seq}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {row.original.quotationNo}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Date',
        enableColumnFilter: true,
        cell: ({ row }) => {
          try {
            const createdDate = new Date(row.original.createdAt);
            const updatedAtStr = row.original.updatedAt;
            const updatedDate = updatedAtStr ? new Date(updatedAtStr) : null;
            const isEdited = updatedDate && (updatedDate.getTime() - createdDate.getTime() > 1000);

            return (
              <div className="flex flex-col text-sm space-y-1">
                <div>
                  <div className="text-gray-500 font-medium text-[10px] uppercase tracking-wider">Created:</div>
                  <div className="font-semibold text-gray-800">{format(createdDate, 'dd MMM yyyy')}</div>
                  <div className="text-xs text-gray-500">{format(createdDate, 'hh:mm a')}</div>
                </div>
                {isEdited && (
                  <div>
                    <div className="text-amber-500 font-medium text-[10px] uppercase tracking-wider">Edited:</div>
                    <div className="font-semibold text-amber-700">{format(updatedDate, 'dd MMM yyyy')}</div>
                    <div className="text-xs text-amber-600">{format(updatedDate, 'hh:mm a')}</div>
                  </div>
                )}
              </div>
            );
          } catch {
            return row.original.quotationDate || '-';
          }
        },
      },
      {
        accessorKey: 'buyerName',
        header: 'Customer',
        enableColumnFilter: true,
        cell: ({ row }) => (
          <div
            className="font-medium max-w-[200px] truncate"
            title={decodeHtml(row.original.buyerName)}
          >
            {decodeHtml(row.original.buyerName) || '-'}
          </div>
        ),
      },
      {
        accessorKey: 'salesPersonName',
        meta: { fitContent: true },
        header: 'Sales Person',
        enableColumnFilter: true,
        cell: ({ row }) => (
          <div className="text-[var(--text-secondary)] whitespace-nowrap">
            {row.original.salesPersonName || '-'}
          </div>
        ),
      },
      {
        header: 'Items',
        cell: ({ row }) => {
          const items = row.original.content?.items || [];
          const total = items.reduce((sum: number, item: any) => {
            const lineTotal = item.quantity * item.rate * (1 - (item.discount || 0) / 100);
            return sum + lineTotal;
          }, 0);
          return (
            <div>
              <div className="font-medium">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                ₹{total.toFixed(2)} <span className="italic">(+18% GST)</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableColumnFilter: true,
        cell: ({ row }) => {
          const status = row.original.status;
          let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
          let className = '';
          let Icon = Clock;

          switch (status) {
            case 'Approved':
              className = 'bg-green-100 text-green-800 border-green-200';
              Icon = CheckCircle;
              break;
            case 'Pending':
              className = 'bg-orange-100 text-orange-800 border-orange-200';
              Icon = Clock;
              break;
            case 'Rejected':
              variant = 'destructive';
              Icon = XCircle;
              break;
            case 'Converted':
              className = 'bg-purple-100 text-purple-800 border-purple-200';
              Icon = PackagePlus;
              break;
            default:
              className = 'bg-gray-100 text-gray-800 border-gray-200';
          }

          return (
            <div className="space-y-1">
              <Badge variant={variant} className={`${className} flex items-center gap-1 w-fit`}>
                <Icon size={12} />
                {status}
              </Badge>
              {status === 'Rejected' && row.original.rejectionRemark && (
                <div
                  className="text-xs text-red-600 max-w-[150px] truncate cursor-help"
                  title={`Rejection Reason: ${row.original.rejectionRemark}`}
                >
                  ⚠ {row.original.rejectionRemark}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        size: 145,
        header: 'Actions',
        cell: ({ row }) => {
          const quotation = row.original;
          const isPending = quotation.status === 'Pending';
          const isApproved = quotation.status === 'Approved';
          const isConverted = quotation.status === 'Converted';
          const isRejected = quotation.status === 'Rejected';

          return (
            <div className="flex items-center gap-1 whitespace-nowrap">
              {/* View Details Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleView(quotation)}
                title="View Details"
                className="!px-2 text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
              >
                <Eye size={16} />
              </Button>

              {/* Admin Actions for Pending */}
              {isPending && isAdmin && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleApprove(quotation.quotationId)}
                    disabled={actionLoading}
                    title="Approve Quotation"
                    className="!flex-col !h-auto !py-1 !px-2.5 !gap-0.5 text-[11px] font-medium bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  >
                    <Check size={15} />
                    <span>Approve</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openRejectModal(quotation.quotationId)}
                    disabled={actionLoading}
                    title="Reject Quotation"
                    className="!flex-col !h-auto !py-1 !px-2.5 !gap-0.5 text-[11px] font-medium bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  >
                    <X size={15} />
                    <span>Reject</span>
                  </Button>
                </>
              )}

              {/* Download for Approved/Converted */}
              {(isApproved || isConverted) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(quotation)}
                  title="Download PDF"
                  className="!px-2 text-blue-600 hover:bg-blue-50"
                >
                  <Download size={16} />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [
      isAdmin,
      actionLoading,
      handleView,
      handleApprove,
      openRejectModal,
      handleDownload,
      handleEdit,
      quotations,
    ]
  );

  return (
    <div className="container mx-auto pb-10 space-y-6">
      {/* Page Header */}
      <PageHeader metadataPath="/operations/quotation-requests"
        title="Quotation Management"
        description="Review, approve, and manage quotations"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div
          className={`p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer ${
            currentFilter === 'all'
              ? 'bg-blue-50 border-blue-300 shadow-md'
              : 'bg-[var(--surface)] border-[var(--border)]'
          }`}
          onClick={() => setCurrentFilter('all')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-sm text-[var(--text-secondary)]">Total</div>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer ${
            currentFilter === 'pending'
              ? 'bg-orange-50 border-orange-300 shadow-md'
              : 'bg-[var(--surface)] border-orange-200'
          }`}
          onClick={() => setCurrentFilter('pending')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock size={20} className="text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
              <div className="text-sm text-[var(--text-secondary)]">Pending</div>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer ${
            currentFilter === 'approved'
              ? 'bg-green-50 border-green-300 shadow-md'
              : 'bg-[var(--surface)] border-green-200'
          }`}
          onClick={() => setCurrentFilter('approved')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <div className="text-sm text-[var(--text-secondary)]">Approved</div>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer ${
            currentFilter === 'rejected'
              ? 'bg-red-50 border-red-300 shadow-md'
              : 'bg-[var(--surface)] border-red-200'
          }`}
          onClick={() => setCurrentFilter('rejected')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle size={20} className="text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <div className="text-sm text-[var(--text-secondary)]">Rejected</div>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer ${
            currentFilter === 'converted'
              ? 'bg-purple-50 border-purple-300 shadow-md'
              : 'bg-[var(--surface)] border-purple-200'
          }`}
          onClick={() => setCurrentFilter('converted')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <PackagePlus size={20} className="text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{stats.converted}</div>
              <div className="text-sm text-[var(--text-secondary)]">Converted</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {currentFilter === 'all'
                ? 'All Quotations'
                : `${currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)} Quotations`}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {isAdmin ? 'Review and manage quotation approvals' : 'View quotation status'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchQuotations(true)}
            disabled={refreshing}
            leftIcon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--text-secondary)]">Loading quotations...</p>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText size={48} className="text-[var(--text-secondary)] mb-4 opacity-50" />
              <p className="text-[var(--text-secondary)] text-lg">
                {currentFilter === 'all'
                  ? 'No quotations found'
                  : `No ${currentFilter} quotations found`}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {currentFilter === 'all'
                  ? 'Quotations will appear here when created'
                  : `No quotations with ${currentFilter} status`}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredQuotations}
              searchPlaceholder="Search quotations..."
              theme={{ cell: '!px-2 !py-2', headerCell: '!px-2' }}
            />
          )}
        </div>
      </div>

      {/* View Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Quotation Details"
        size="lg"
      >
        {selectedQuotation && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-[var(--primary)]">
                    {selectedQuotation.quotationNo}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Created: {format(new Date(selectedQuotation.createdAt), 'dd MMM yyyy, hh:mm a')}
                  </div>
                  {selectedQuotation.content?.otherRef && (
                    <div className="text-sm text-[var(--text-secondary)] mt-1 font-medium">
                      <span className="text-indigo-600">
                        👤 {selectedQuotation.content.otherRef}
                      </span>
                    </div>
                  )}
                </div>
                <Badge
                  variant={selectedQuotation.status === 'Rejected' ? 'destructive' : 'secondary'}
                  className={
                    selectedQuotation.status === 'Approved'
                      ? 'bg-green-100 text-green-800'
                      : selectedQuotation.status === 'Pending'
                        ? 'bg-orange-100 text-orange-800'
                        : selectedQuotation.status === 'Converted'
                          ? 'bg-purple-100 text-purple-800'
                          : ''
                  }
                >
                  {selectedQuotation.status}
                </Badge>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-[var(--surface-secondary)] p-4 rounded-lg">
              <h4 className="font-semibold text-[var(--text-primary)] mb-2">Customer Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[var(--text-secondary)]">Name:</span>
                  <span className="ml-2 font-medium">
                    {decodeHtml(selectedQuotation.buyerName)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">GSTIN:</span>
                  <span className="ml-2 font-medium">
                    {selectedQuotation.content?.buyerGSTIN || '-'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--text-secondary)]">Address:</span>
                  <span className="ml-2 font-medium">
                    {decodeHtml(
                      selectedQuotation.content?.customerAddress ||
                        selectedQuotation.content?.buyerAddress
                    ) || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--surface-secondary)] p-4 rounded-lg">
                <h4 className="font-semibold text-[var(--text-primary)] mb-2">Payment Terms</h4>
                <p className="text-sm">{selectedQuotation.content?.paymentTerms || '-'}</p>
              </div>
              <div className="bg-[var(--surface-secondary)] p-4 rounded-lg">
                <h4 className="font-semibold text-[var(--text-primary)] mb-2">Delivery Terms</h4>
                <p className="text-sm">{selectedQuotation.content?.deliveryTerms || '-'}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-3">Quotation Items</h4>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-secondary)]">
                    <tr>
                      <th className="text-left p-3 font-medium">#</th>
                      <th className="text-left p-3 font-medium">Product</th>
                      <th className="text-left p-3 font-medium">HSN</th>
                      <th className="text-right p-3 font-medium">Qty</th>
                      <th className="text-right p-3 font-medium">Pkg (L)</th>
                      <th className="text-right p-3 font-medium">Rate</th>
                      <th className="text-right p-3 font-medium">Disc%</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-right p-3 font-medium text-indigo-600">₹/Liter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedQuotation.content?.items || []).map((item: any, idx: number) => {
                      const amount = item.quantity * item.rate * (1 - (item.discount || 0) / 100);
                      const packageCapacity = getPackageCapacity(item.productId, item.description);
                      const totalLiters = item.quantity * packageCapacity;
                      const perLiterCost = totalLiters > 0 ? amount / totalLiters : 0;

                      return (
                        <tr key={idx} className="border-t border-[var(--border)]">
                          <td className="p-3">{idx + 1}</td>
                          <td className="p-3 font-medium">{decodeHtml(item.description)}</td>
                          <td className="p-3 text-[var(--text-secondary)]">
                            {item.hsn ||
                              (products.find(
                                p => (p.productId || (p as any).ProductID) === item.productId
                              ) as any)?.hsnCode ||
                              '-'}
                          </td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right text-[var(--text-secondary)]">
                            {packageCapacity > 0
                              ? `${parseFloat(packageCapacity.toFixed(2))}L`
                              : '-'}
                          </td>
                          <td className="p-3 text-right">₹{item.rate?.toFixed(2)}</td>
                          <td className="p-3 text-right">{item.discount || 0}%</td>
                          <td className="p-3 text-right font-semibold">₹{amount.toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold text-indigo-600">
                            {perLiterCost > 0 ? `₹${perLiterCost.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[var(--surface-secondary)]">
                    <tr className="border-t-2 border-[var(--border)]">
                      <td colSpan={7} className="p-3 text-right font-semibold">
                        Total:
                      </td>
                      <td className="p-3 text-right font-bold text-[var(--primary)]">
                        ₹
                        {(selectedQuotation.content?.items || [])
                          .reduce((sum: number, item: any) => {
                            return (
                              sum + item.quantity * item.rate * (1 - (item.discount || 0) / 100)
                            );
                          }, 0)
                          .toFixed(2)}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                    <tr>
                      <td
                        colSpan={9}
                        className="p-2 text-right text-xs text-[var(--text-secondary)] italic"
                      >
                        (Incl. 18% GST)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Rejection Remark */}
            {selectedQuotation.status === 'Rejected' && selectedQuotation.rejectionRemark && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <h4 className="font-semibold text-red-800 mb-2">Rejection Reason</h4>
                <p className="text-sm text-red-700">
                  {decodeHtml(selectedQuotation.rejectionRemark)}
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
              <Button variant="ghost" onClick={() => setViewModalOpen(false)}>
                Close
              </Button>
              {selectedQuotation.status === 'Approved' && (
                <Button
                  variant="secondary"
                  onClick={() => handleDownload(selectedQuotation)}
                  leftIcon={<Download size={16} />}
                >
                  Download PDF
                </Button>
              )}
              {selectedQuotation.status === 'Pending' && isAdmin && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setViewModalOpen(false);
                      openRejectModal(selectedQuotation.quotationId);
                    }}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      handleApprove(selectedQuotation.quotationId);
                      setViewModalOpen(false);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Quotation"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <p className="text-sm text-red-800">
              Are you sure you want to reject this quotation? The salesperson will be notified with
              your rejection remark.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Rejection Remark <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectRemark}
              onChange={e => setRejectRemark(e.target.value)}
              placeholder="Please provide a reason for rejection..."
              rows={4}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-red-500 resize-none"
              maxLength={500}
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {rejectRemark.length}/500 characters
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
            <Button
              variant="ghost"
              onClick={() => setRejectModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleReject}
              disabled={actionLoading || !rejectRemark.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QuotationMasterPage;
