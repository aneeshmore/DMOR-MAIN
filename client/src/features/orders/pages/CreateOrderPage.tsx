import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/common';
import { ordersApi } from '../api/ordersApi';
import { Order, OrderWithDetails, OrderDetail } from '../types';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { RotateCcw, Eye, Download } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { CreateOrderForm, ModeSwitcher, ModeIndicatorBanner, type ViewMode } from '../components';
import { showToast } from '@/utils/toast';
import { downloadInvoicePDF } from '@/features/quotations/utils/pdfGenerator';
import { QuotationData } from '@/features/quotations/types';
import { companyApi } from '@/features/company/api/companyApi';
import { decodeHtml } from '@/utils/stringUtils';
import { apiClient } from '@/api/client';

import { Edit as EditIcon } from 'lucide-react';

const formatDisplayOrderId = (orderId: number, dateString: string) => {
  if (!dateString) return `ORD-${orderId}`;
  const date = new Date(dateString);
  const year = date.getFullYear();
  const idStr = orderId.toString();
  const shortId = idStr.length > 3 ? idStr.slice(-3) : idStr.padStart(3, '0');
  return `ORD-${year}-${shortId}`;
};

const CreateOrderPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('orders');

  // Modal States
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Edit State
  const [editingOrder, setEditingOrder] = useState<OrderWithDetails | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ordersApi.getAll(100, 0);
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSuccess = async (updatedOrder?: Order) => {
    if (updatedOrder?.orderId) {
      setOrders(prev =>
        prev.map(order =>
          order.orderId === updatedOrder.orderId ? { ...order, ...updatedOrder } : order
        )
      );
    }
    await fetchOrders();
    setEditingOrder(null);
  };

  const handleEditOrder = useCallback(async (order: Order) => {
    try {
      showToast.loading('Loading order for editing...');
      const fullOrder = await ordersApi.getById(order.orderId);
      setEditingOrder(fullOrder);
      showToast.dismiss();
      // Scroll to top to show form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Failed to load order for editing:', error);
      showToast.error('Failed to load order details');
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingOrder(null);
  }, []);

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: 'orderId',
      size: 110,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order No" />,
      enableColumnFilter: true,
      cell: ({ row }) => {
        const index = orders.findIndex(o => o.orderId === row.original.orderId);
        const seq = orders.length - index;
        const displayId =
          row.original.orderNumber ||
          formatDisplayOrderId(row.original.orderId, row.original.orderDate);
        return (
          <div className="flex flex-col">
            <span className="font-mono font-medium text-[var(--primary)]">ODR-{seq}</span>
            <span className="text-xs text-[var(--text-secondary)]">{displayId}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'orderDate',
      size: 95,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      enableColumnFilter: true,
      cell: ({ row }) => {
        try {
          return format(new Date(row.original.orderDate), 'dd MMM yyyy');
        } catch {
          return row.original.orderDate;
        }
      },
    },
    {
      accessorKey: 'companyName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
      enableColumnFilter: true,
      cell: ({ row }) => (
        <span className="font-medium">
          {decodeHtml(row.original.companyName || row.original.customerName) || 'Unknown'}
        </span>
      ),
    },
    {
      accessorKey: 'salespersonName',
      meta: { fitContent: true },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
      enableColumnFilter: true,
      cell: ({ row }) => {
        const fullName = row.original.salespersonName || '-';
        return <span className="font-medium whitespace-nowrap">{fullName}</span>;
      },
    },
    {
      accessorKey: 'productNames',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Products" />,
      cell: ({ row }) => {
        if (!row.original.productNames) return <span className="text-muted-foreground">-</span>;
        const products = row.original.productNames.split(',').map(p => decodeHtml(p.trim()));
        return (
          <div className="flex flex-col gap-1 my-1">
            {products.slice(0, 2).map((product, idx) => (
              <span
                key={idx}
                className="inline-block px-2 py-0.5 bg-secondary/30 rounded text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
                title={product}
              >
                {product}
              </span>
            ))}
            {products.length > 2 && (
              <span className="text-xs text-[var(--text-secondary)]">
                +{products.length - 2} more
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      size: 165,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      enableColumnFilter: true,
      cell: ({ row }) => {
        const status = row.original.status;
        let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
        let className = '';
        switch (status) {
          case 'Delivered':
            className = 'bg-green-100 text-green-800 border-green-200';
            break;
          case 'Dispatched':
            className = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            break;
          case 'Ready for Dispatch':
            className = 'bg-blue-100 text-blue-800 border-blue-200';
            break;
          case 'Scheduled for Production':
          case 'In Production':
            className = 'bg-purple-100 text-purple-800 border-purple-200';
            break;
          case 'Factory Approved':
          case 'Confirmed':
          case 'Accepted':
            className = 'bg-teal-100 text-teal-800 border-teal-200';
            break;
          case 'Pending Factory Approval':
          case 'Verified':
            className = 'bg-amber-100 text-amber-800 border-amber-200';
            break;
          case 'On Hold':
            className = 'bg-yellow-100 text-yellow-800 border-yellow-200';
            break;
          case 'Split':
            className = 'bg-slate-100 text-slate-700 border-slate-300';
            break;
          case 'Cancelled':
          case 'Rejected':
            variant = 'destructive';
            break;
          case 'Pending Accounts Approval':
          case 'Pending':
            className = 'bg-orange-100 text-orange-800 border-orange-200';
            break;
          default:
            variant = 'secondary';
        }
        const badgeLayoutClass = 'whitespace-nowrap leading-none px-2.5 py-1 text-xs';
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={variant} className={`${className} ${badgeLayoutClass}`}>
              {status}
            </Badge>
            {status === 'Ready for Dispatch' && row.original.expectedDeliveryDate && (
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                {format(new Date(row.original.expectedDeliveryDate), 'dd MMM yyyy')}
              </span>
            )}
            {status === 'Dispatched' && row.original.dispatchDate && (
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                {format(new Date(row.original.dispatchDate), 'dd MMM yyyy')}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'totalAmount',
      size: 110,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" className="justify-end" />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.original.totalAmount?.toString() || '0');
        return <div className="text-right font-medium">₹{amount.toFixed(2)}</div>;
      },
    },
    {
      id: 'actions',
      size: 115,
      header: 'Actions',
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewOrder(order)}
              title="View Order Details"
              className="!flex-col !h-auto !py-1 !px-2 !gap-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
            >
              <Eye size={15} />
              <span>View</span>
            </Button>
            {(order.status === 'Factory Approved' ||
              order.status === 'Pending Factory Approval' ||
              order.status === 'Scheduled for Production' ||
              order.status === 'Accepted' ||
              order.status === 'Confirmed' ||
              order.status === 'Delivered' ||
              order.status === 'Dispatched' ||
              order.status === 'Verified' ||
              order.status === 'Ready for Dispatch') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadInvoice(order)}
                  title="Download Invoice"
                  className="!flex-col !h-auto !py-1 !px-2 !gap-0.5 text-[11px] font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <Download size={15} />
                  <span>Invoice</span>
                </Button>
              )}
            {(order.status === 'Pending Accounts Approval' ||
              order.status === 'Pending' ||
              order.status === 'Rejected') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditOrder(order)}
                  title="Edit Order"
                  className="!flex-col !h-auto !py-1 !px-2 !gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <EditIcon size={15} />
                  <span>Edit</span>
                </Button>
              )}
          </div>
        );
      },
    },
  ];

  // Handle View Order
  const handleViewOrder = useCallback(async (order: Order) => {
    try {
      setViewLoading(true);
      setViewModalOpen(true);
      const orderDetails = await ordersApi.getById(order.orderId);
      setSelectedOrder(orderDetails);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      showToast.error('Failed to load order details');
      setViewModalOpen(false);
    } finally {
      setViewLoading(false);
    }
  }, []);

  const handleDownloadInvoice = useCallback(async (order: Order) => {
    // On mobile, open a blank tab immediately to keep the user gesture alive for the download
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const preOpenedWindow = isMobile ? window.open('', '_blank') : null;

    try {
      showToast.loading('Preparing Invoice...', 'invoice-dl');

      // Fetch full details including products and company info
      const [fullOrder, companyRes] = await Promise.all([
        ordersApi.getById(order.orderId),
        companyApi.get().catch(() => ({ data: null })),
      ]);

      const c: any = companyRes?.data?.data || companyRes?.data || {};

      const cid = order.customerId || fullOrder.customerId;
      let customerDetails: any = null;
      if (cid) {
        try {
          const custRes = await apiClient.get<{ success: boolean; data: any }>(
            `/masters/customers/${cid}`
          );
          customerDetails = custRes.data?.data || custRes.data;
        } catch (e) {
          console.error('Failed to fetch customer details', e);
        }
      }

      // Map Order to QuotationData structure for the Invoice generator
      const invoiceData: QuotationData = {
        quotationNo:
          fullOrder.billNo ||
          order.billNo ||
          order.orderNumber ||
          formatDisplayOrderId(order.orderId, order.orderDate),
        date: format(new Date(order.orderDate), 'dd-MMM-yy'),
        //Payment terms added
        paymentTerms:
          (fullOrder as any).paymentTerms ||
          fullOrder.paymentMethod ||
          'Net 30 Days from Invoice Date',
        buyerRef: `ORD-${order.orderId}`,
        otherRef: order.salespersonName || '',
        dispatchThrough: 'To be arranged',
        destination: fullOrder.deliveryAddress || '',
        deliveryTerms: 'Subject to approval',

        companyName: c.companyName || '',
        companyLogo: c.logoUrl || '',
        companyAddress: c.address || '',
        companyPhone: c.contactNumber || '',
        companyEmail: c.email || '',
        companyGSTIN: c.gstNumber || '',
        companyState: c.state || '',
        companyCode: '',
        companyPAN: c.panNumber || '',
        companyPincode: c.pincode || '',
        companyCGST: c.cgst || '',
        companySGST: c.sgst || '',
        companyIGST: c.igst || '',
        termsAndConditions: c.termsAndConditions || '',
        udyamRegistrationNumber: c.udyamRegistrationNumber || '',

        bankName: c.bankName || '',
        accountNo: c.accountNumber || '',
        ifsc: c.ifscCode || '',
        branch: c.branch || '',

        buyerName:
          fullOrder.companyName || fullOrder.customerName || customerDetails?.CompanyName || '',
        buyerAddress: fullOrder.deliveryAddress || customerDetails?.Address || '',
        buyerGSTIN: customerDetails?.GSTNumber || customerDetails?.gstNumber || '', // Would need to fetch customer details for this if not in order
        buyerState: customerDetails?.State || customerDetails?.state || '',

        items: (fullOrder.orderDetails || []).map((item: OrderDetail, index: number) => ({
          id: index + 1,
          description: item.productName || `Product ID: ${item.productId}`,
          // Note: In CreateOrderForm, productNames are fetched. Here we might need to rely on what's available or fetch product names.
          // However, fullOrder.orderDetails usually contains basic info.
          // Let's try to use what we have.
          hsn: item.hsnCode || '',
          dueOn: '',
          quantity: item.quantity,
          rate: Number(item.unitPrice),
          per: 'no.',
          discount: item.discount || 0,
          cgstRate: 9,
          sgstRate: 9,
        })),

        status: 'Generated',
      };

      // We might want to fetch product names properly if they are just IDs.
      // But for now let's send what we have.

      await downloadInvoicePDF(invoiceData, preOpenedWindow);
      showToast.success('Invoice Download Started', 'invoice-dl');
    } catch (error) {
      // If we opened a blank window and something failed, close it to avoid leaving a tab behind
      if (preOpenedWindow && !preOpenedWindow.closed) {
        preOpenedWindow.close();
      }
      console.error('Invoice download failed:', error);
      showToast.error('Failed to download invoice', 'invoice-dl');
    }
  }, []);

  return (
    <div className="container mx-auto pb-10">
      <div className="space-y-6 animate-fade-in">
        {/* Header with Mode Toggle — on lg+ this is a true left / center / right layout: the
            header stays pinned left, the toggle sits in the horizontal middle of the row
            (not flush against the right edge), and a matching spacer column on the right
            balances it so the centering is against the full row width, not just the
            leftover space after the header. Drops to a stacked, centered layout on
            narrower screens where there isn't room for three columns. */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center gap-4">
          <PageHeader
            title={
              editingOrder
                ? 'Edit Order'
                : viewMode === 'orders'
                  ? 'Create New Order'
                  : 'Create Quotation'
            }
            description={
              editingOrder
                ? `Editing Order ${editingOrder.orderNumber || formatDisplayOrderId(editingOrder.orderId, editingOrder.orderDate)}`
                : viewMode === 'orders'
                  ? 'Fill in the order details and confirm to create a new order'
                  : 'Create quotations for customer approval before placing orders'
            }
          />

          <div className="flex items-center justify-center">
            <ModeSwitcher viewMode={viewMode} onModeChange={setViewMode} />
          </div>

          <div className="hidden lg:block" />
        </div>

        {/* Mode Indicator Banner
        <ModeIndicatorBanner viewMode={viewMode} /> */}

        {/* Form Component */}
        <CreateOrderForm
          onSuccess={handleSuccess}
          viewMode={viewMode}
          editingOrder={editingOrder}
          onCancelEdit={handleCancelEdit}
        />

        {/* Orders Table - Only show in orders mode */}
        {viewMode === 'orders' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Recent Orders</h2>
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span>Live</span>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center p-8 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[var(--text-secondary)]">Loading orders...</span>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
                <DataTable columns={columns} data={orders} searchPlaceholder="Search orders..." />
              </div>
            )}
          </div>
        )}

        {/* Order View Modal */}
        <Modal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setSelectedOrder(null);
          }}
          title="Order Details"
          size="lg"
        >
          {viewLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--text-secondary)]">Loading order details...</p>
            </div>
          ) : selectedOrder ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-bold text-[var(--primary)]">
                      {selectedOrder.orderNumber ||
                        formatDisplayOrderId(selectedOrder.orderId, selectedOrder.orderDate)}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      Created: {format(new Date(selectedOrder.createdAt), 'dd MMM yyyy, hh:mm a')}
                    </div>
                    {selectedOrder.salespersonName && (
                      <div className="text-sm text-[var(--text-secondary)] mt-1 font-medium">
                        <span className="text-indigo-600">👤 {selectedOrder.salespersonName}</span>
                      </div>
                    )}
                  </div>
                  <Badge
                    variant={
                      selectedOrder.status === 'Rejected' || selectedOrder.status === 'Cancelled'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className={
                      selectedOrder.status === 'Delivered'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : selectedOrder.status === 'Dispatched'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : selectedOrder.status === 'Ready for Dispatch'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : selectedOrder.status === 'In Production' ||
                              selectedOrder.status === 'Scheduled for Production'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : selectedOrder.status === 'Factory Approved' ||
                                selectedOrder.status === 'Confirmed' ||
                                selectedOrder.status === 'Accepted'
                                ? 'bg-teal-100 text-teal-800 border-teal-200'
                                : selectedOrder.status === 'Pending Factory Approval' ||
                                  selectedOrder.status === 'Verified'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : selectedOrder.status === 'On Hold'
                                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                    : selectedOrder.status === 'Pending Accounts Approval' ||
                                      selectedOrder.status === 'Pending'
                                      ? 'bg-orange-100 text-orange-800 border-orange-200'
                                      : ''
                    }
                  >
                    {selectedOrder.status}
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
                      {selectedOrder.companyName || selectedOrder.customerName || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Priority:</span>
                    <span className="ml-2 font-medium">{selectedOrder.priority || 'Normal'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[var(--text-secondary)]">Delivery Address:</span>
                    <span className="ml-2 font-medium">{selectedOrder.deliveryAddress || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-3">Order Items</h4>
                <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-secondary)]">
                      <tr>
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">Product</th>
                        <th className="text-left p-3 font-medium">HSN</th>
                        <th className="text-right p-3 font-medium">Qty</th>
                        <th className="text-right p-3 font-medium">Rate</th>
                        <th className="text-right p-3 font-medium">Disc%</th>
                        <th className="text-right p-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.orderDetails?.map((item, idx) => {
                        const unitPrice = parseFloat(item.unitPrice?.toString() || '0');
                        const totalPrice = parseFloat(item.totalPrice?.toString() || '0');
                        return (
                          <tr key={item.orderDetailId} className="border-t border-[var(--border)]">
                            <td className="p-3">{idx + 1}</td>
                            <td className="p-3 font-medium">
                              {item.productName || `Product ID: ${item.productId}`}
                            </td>
                            <td className="p-3 text-[var(--text-secondary)]">
                              {item.hsnCode || '-'}
                            </td>
                            <td className="p-3 text-right">{item.quantity}</td>
                            <td className="p-3 text-right">₹{unitPrice.toFixed(2)}</td>
                            <td className="p-3 text-right">{item.discount || 0}%</td>
                            <td className="p-3 text-right font-semibold">
                              ₹{totalPrice.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-[var(--surface-secondary)]">
                      <tr className="border-t-2 border-[var(--border)]">
                        <td colSpan={6} className="p-3 text-right font-semibold">
                          Total:
                        </td>
                        <td className="p-3 text-right font-bold text-[var(--primary)]">
                          ₹{parseFloat(selectedOrder.totalAmount?.toString() || '0').toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              {selectedOrder.remarks && (
                <div className="bg-[var(--surface-secondary)] p-4 rounded-lg">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-2">Remarks</h4>
                  <p className="text-sm">{selectedOrder.remarks}</p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setViewModalOpen(false);
                    setSelectedOrder(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </div>
  );
};

export default CreateOrderPage;
