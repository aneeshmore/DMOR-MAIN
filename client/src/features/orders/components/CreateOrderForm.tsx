import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  FileText,
  Download,
  ShoppingCart,
  Eye,
  Edit,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Input, Button, Modal, Select } from '@/components/ui';
import UpdateConfirmModal from './UpdateConfirmModal';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useCreateOrder, useUpdateOrder } from '../hooks/useOrders';
import { showToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { decodeHtml } from '@/utils/stringUtils';

import { customerApi } from '@/features/masters/api/customerApi';
import { employeeApi } from '@/features/employees/api/employeeApi';
import { inventoryApi } from '@/features/inventory/api/inventoryApi';
import { Customer } from '@/features/masters/types';
import { Employee } from '@/features/employees/types';
import { Product } from '@/features/inventory/types';
import { Order, OrderWithDetails } from '../types';
import { quotationApi, QuotationRecord } from '@/features/quotations/api/quotationApi';
import { tncApi } from '@/features/tnc/api/tncApi';
import { Tnc } from '@/features/tnc/types';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { downloadQuotationPDF } from '@/features/quotations/utils/pdfGenerator';
import { productDevelopmentApi } from '@/features/masters/api/productDevelopment';

type FlexibleCustomer = Customer & {
  customerId?: number;
  contactPerson?: string;
  companyName?: string;
  address?: string;
  gstin?: string;
  GSTIN?: string;
  state?: string;
  State?: string;
  salesPersonId?: number;
  area?: string;
  location?: string;
  pinCode?: string;
  isActive?: boolean;
  IsActive?: boolean;
};
type FlexibleEmployee = Employee & {
  employeeId?: number;
  firstName?: string;
  lastName?: string;
  Department?: { DepartmentName?: string; departmentName?: string };
  department?: { DepartmentName?: string; departmentName?: string };
  departmentName?: string;
};

// =====================
// TYPES
// =====================

interface OrderDetailLine {
  id: string; // Unique row ID
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  linkedHardenerRowId?: string; // For Base: points to its Hardener
  linkedBaseRowId?: string; // For Hardener: points to its Base
  isAutoHardener?: boolean; // True if this was auto-added by a Base
}

interface CreateOrderFormProps {
  onSuccess?: (order?: Order | OrderWithDetails) => void;
  viewMode?: 'orders' | 'quotations';
  editingOrder?: OrderWithDetails | null;
  onCancelEdit?: () => void;
}

interface ValidationTooltipProps {
  message: string;
}

const ValidationTooltip: React.FC<ValidationTooltipProps> = ({ message }) => (
  <div className="absolute top-full left-0 mt-2 z-50 animate-fade-in">
    <div className="relative bg-white text-gray-800 text-sm rounded shadow-lg px-3 py-2 flex items-center gap-2 border border-orange-200">
      {/* Triangle Arrow */}
      <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-t border-l border-orange-200 transform rotate-45"></div>

      {/* Icon */}
      <div className="bg-orange-500 rounded-sm text-white p-0.5 flex-shrink-0 flex items-center justify-center w-5 h-5">
        <AlertTriangle size={12} fill="white" className="text-white" />
      </div>

      {/* Message */}
      <span className="font-medium text-xs text-nowrap">{message}</span>
    </div>
  </div>
);

// =====================
// COMPONENT
// =====================

const CreateOrderForm: React.FC<CreateOrderFormProps> = ({
  onSuccess,
  viewMode = 'orders',
  editingOrder,
  onCancelEdit,
}) => {
  const { createOrder, loading: createLoading } = useCreateOrder();
  const { updateOrder, loading: updateLoading } = useUpdateOrder(); // Assuming useUpdateOrder exists or will be added
  const [loading, setLoading] = useState(false);

  // Sync loading state
  useEffect(() => {
    setLoading(createLoading || updateLoading);
  }, [createLoading, updateLoading]);

  const { user } = useAuth();

  // Refs for auto-focus
  const firstFieldRef = useRef<HTMLDivElement>(null);
  const orderItemsContainerRef = useRef<HTMLDivElement>(null);

  // Data State
  const [customers, setCustomers] = useState<FlexibleCustomer[]>([]);
  const [employees, setEmployees] = useState<FlexibleEmployee[]>([]);
  const [salesPersonEmployees, setSalesPersonEmployees] = useState<FlexibleEmployee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // TNC Data for quotation
  const [tncList, setTncList] = useState<Tnc[]>([]);

  // Form state - Main Order Fields
  const [customerId, setCustomerId] = useState<number | ''>('');

  const [companyName, setCompanyName] = useState('');
  const [salesPersonId, setSalesPersonId] = useState<number | ''>('');
  const [priority, setPriority] = useState<'Low' | 'Normal' | 'High' | 'Urgent'>('Normal');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  // Order details (line items)
  const [orderDetails, setOrderDetails] = useState<OrderDetailLine[]>([
    { id: crypto.randomUUID(), productId: 0, quantity: 1, unitPrice: 0, discount: 0 },
  ]);

  // UI State
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<OrderWithDetails | null>(null);

  // Quotation Modal State
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [quotationAddress, setQuotationAddress] = useState('');
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState('');
  const [selectedDeliveryTerms, setSelectedDeliveryTerms] = useState('');
  const [quotationLoading, setQuotationLoading] = useState(false);

  // Quotations List State
  const [quotationsList, setQuotationsList] = useState<QuotationRecord[]>([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);

  // Preview Modal State
  const [previewQuotation, setPreviewQuotation] = useState<QuotationRecord | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Edit Mode State for Quotation Updates
  const [editingQuotation, setEditingQuotation] = useState<QuotationRecord | null>(null);
  const [showUpdateConfirmModal, setShowUpdateConfirmModal] = useState(false);

  // Fullscreen State for Order Items
  const [isOrderItemsFullScreen, setIsOrderItemsFullScreen] = useState(false);

  // Validation State
  const [validationErrors, setValidationErrors] = useState<{
    customerId: boolean;
    salesPersonId: boolean;
    items: { productId: boolean; quantity: boolean }[];
  }>({
    customerId: false,
    salesPersonId: false,
    items: [{ productId: false, quantity: false }],
  });

  // Hardener Selection Modal State
  const [showHardenerModal, setShowHardenerModal] = useState(false);
  const [hardenerModalData, setHardenerModalData] = useState<{
    baseProduct: Product | null;
    baseProductId: number;
    baseRowId: string;
    requiredPackSize: number;
    availableHardeners: Product[];
    baseQty: number;
  } | null>(null);

  // Check if user is Admin or SuperAdmin - they can select any salesperson
  const isAdminUser = user?.Role
    ? ['Admin', 'SuperAdmin', 'Accounts Manager', 'Production Manager'].includes(user.Role)
    : false;
  const isSalesPerson = !isAdminUser;

  // Payment terms options from TNC
  const paymentTermsOptions = useMemo(() => {
    const options = tncList
      .filter(t => {
        const type = (t.type || '').toLowerCase();
        return type === 'payment' || type.includes('payment');
      })
      .map(t => ({
        value: t.description,
        label: t.description,
      }));

    if (options.length === 0) {
      return [{ value: '', label: 'No payment terms available' }];
    }
    return [{ value: '', label: 'Select payment terms...' }, ...options];
  }, [tncList]);

  const deliveryTermsOptions = useMemo(() => {
    const options = tncList
      .filter(t => {
        const type = (t.type || '').toLowerCase();
        return type === 'delivery' || type.includes('delivery');
      })
      .map(t => ({
        value: t.description,
        label: t.description,
      }));

    if (options.length === 0) {
      return [{ value: '', label: 'No delivery terms available' }];
    }
    return [{ value: '', label: 'Select delivery terms...' }, ...options];
  }, [tncList]);

  // Fetch quotations
  const fetchQuotations = useCallback(async () => {
    try {
      setQuotationsLoading(true);
      const response = await quotationApi.getAll();
      const data = response.data?.data || response.data || [];
      setQuotationsList(data);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
    } finally {
      setQuotationsLoading(false); // ensure loading state resets
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (viewMode === 'quotations') {
      const fetch = async () => {
        try {
          setQuotationsLoading(true);
          const response = await quotationApi.getAll();
          const data = response.data?.data || response.data || [];
          if (isMounted) setQuotationsList(data);
        } catch (error) {
          console.error('Failed to fetch quotations:', error);
          if (isMounted) setQuotationsList([]);
        } finally {
          if (isMounted) setQuotationsLoading(false);
        }
      };

      fetch();
    }

    return () => {
      isMounted = false;
    };
  }, [viewMode]);

  // =====================
  // EDIT ORDER EFFECT
  // =====================
  useEffect(() => {
    if (editingOrder && viewMode === 'orders') {
      setCustomerId(editingOrder.customerId);
      setCompanyName(editingOrder.companyName || editingOrder.customerName || '');
      setSalesPersonId(editingOrder.salespersonId || '');
      setPriority((editingOrder.priority as any) || 'Normal');
      setDeliveryAddress(editingOrder.deliveryAddress || '');
      setRemarks(editingOrder.remarks || '');

      if (editingOrder.orderDetails && editingOrder.orderDetails.length > 0) {
        const newDetails: OrderDetailLine[] = editingOrder.orderDetails.map(d => ({
          id: crypto.randomUUID(),
          productId: d.productId,
          quantity: d.quantity,
          unitPrice: Number(d.unitPrice),
          discount: d.discount || 0,
        }));

        // Pass 2: Reconstruct bidirectional Auto-Hardener links
        if (products.length > 0) {
          newDetails.forEach((item, index) => {
            const product = products.find(p => p.productId === item.productId);
            if (product?.Subcategory === 'Base' && product?.HardenerId && !item.linkedHardenerRowId) {
              const hardenerSkus = products.filter(p => p.masterProductId === product.HardenerId);
              const hardenerProductIds = hardenerSkus.map(p => p.productId);
              
              // Find the NEXT available hardener row that matches
              const hardenerIndex = newDetails.findIndex((d, i) => 
                i > index && 
                hardenerProductIds.includes(d.productId) && 
                !d.linkedBaseRowId
              );

              if (hardenerIndex !== -1) {
                item.linkedHardenerRowId = newDetails[hardenerIndex].id;
                newDetails[hardenerIndex].linkedBaseRowId = item.id;
                newDetails[hardenerIndex].isAutoHardener = true;
              }
            }
          });
        }

        setOrderDetails(newDetails);
      }

      // Auto-validate form
      setValidationErrors({
        customerId: false,
        salesPersonId: false,
        items: editingOrder.orderDetails.map(() => ({ productId: false, quantity: false })),
      });
    }
  }, [editingOrder, viewMode, products.length]);

  // =====================
  // DATA FETCHING
  // =====================

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        const [customersRes, employeesRes, salesPersonsRes, productsData, tncRes] =
          await Promise.all([
            customerApi.getMyCustomers(), // Fetch all customers (including inactive)
            employeeApi.getAll(),
            employeeApi.getSalesPersons(), // Fetch employees with isSalesRole on their role
            inventoryApi.getAllProducts({ isActive: true }),
            tncApi.getAllTnc(),
          ]);

        // Log the raw responses for debugging
        console.log('Raw Customers Response:', customersRes);

        // Handle Active Customers Response
        if (customersRes) {
          let rawData: unknown = customersRes.data || customersRes;

          if (
            rawData &&
            typeof rawData === 'object' &&
            'data' in (rawData as Record<string, unknown>)
          ) {
            rawData = (rawData as Record<string, unknown>).data;
          }

          if (Array.isArray(rawData)) {
            console.log('Parsed Customers Array:', rawData.length, rawData[0]);
            setCustomers(rawData as FlexibleCustomer[]);
          } else {
            console.error('Customers data format invalid:', rawData);
            setCustomers([]);
          }
        }

        if (employeesRes.success && employeesRes.data) {
          const allEmployees = employeesRes.data as FlexibleEmployee[];
          setEmployees(allEmployees);
        }

        // Use dedicated sales persons API (role-based isSalesRole flag)
        if (salesPersonsRes.success && salesPersonsRes.data) {
          const salesEmployees = salesPersonsRes.data as FlexibleEmployee[];
          setSalesPersonEmployees(salesEmployees);

          // Auto-set current user as salesperson if they have sales role
          if (user && user.Role !== 'Admin' && user.Role !== 'SuperAdmin') {
            const currentUserInSales = salesEmployees.find(
              (emp: any) => (emp.employeeId || emp.EmployeeID) === user.EmployeeID
            );
            if (currentUserInSales) {
              const empId = currentUserInSales.employeeId || currentUserInSales.EmployeeID || '';
              setSalesPersonId(empId);
              if (empId) {
                setValidationErrors(prev => ({ ...prev, salesPersonId: false }));
              }
            }
          }
        }

        if (productsData) {
          const finishedGoodsOnly = productsData.filter((p: Product) => p.productType === 'FG');
          setProducts(finishedGoodsOnly);
        }

        if (tncRes) {
          // tncRes might be direct array or have .data property
          const tncData = Array.isArray(tncRes) ? tncRes : (tncRes as any)?.data || [];
          setTncList(tncData);
        }

        // Fetch quotations
        await fetchQuotations();
      } catch (error) {
        console.error('Error fetching form data:', error);
        showToast.error('Failed to load form data');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, fetchQuotations]);

  // =====================
  // HELPER FUNCTIONS
  // =====================

  const getCompanyName = useCallback(
    (id: number) => {
      const customer = customers.find(c => (c.customerId || c.CustomerID) === id);
      return customer?.companyName || customer?.CompanyName || '';
    },
    [customers]
  );

  const getProductName = useCallback(
    (id: number) => {
      const product = products.find(p => p.productId === id);
      return product?.productName || '';
    },
    [products]
  );

  const getProductPrice = useCallback(
    (id: number) => {
      const product = products.find(p => p.productId === id);
      return product?.sellingPrice ? Number(product.sellingPrice) : 0;
    },
    [products]
  );

  const getEmployeeName = useCallback(
    (id: number) => {
      const employee = employees.find(e => (e.employeeId || e.EmployeeID) === id);
      return employee?.firstName || employee?.FirstName
        ? `${employee?.firstName || employee?.FirstName} ${employee?.lastName || employee?.LastName || ''}`.trim()
        : '';
    },
    [employees]
  );

  // =====================
  // ORDER DETAIL HANDLERS
  // =====================

  const handleAddOrderDetail = useCallback(() => {
    const lastItemIndex = orderDetails.length - 1;
    const lastItem = orderDetails[lastItemIndex];
    if (lastItem.productId === 0 || lastItem.quantity < 1) {
      showToast.error('Please fill in the current item before adding a new one');

      setValidationErrors(prev => {
        const newItems = [...prev.items];
        if (!newItems[lastItemIndex])
          newItems[lastItemIndex] = { productId: false, quantity: false };

        newItems[lastItemIndex] = {
          productId: lastItem.productId === 0,
          quantity: lastItem.quantity < 1,
        };
        return { ...prev, items: newItems };
      });

      setTimeout(() => {
        if (orderItemsContainerRef.current) {
          const itemCards = orderItemsContainerRef.current.querySelectorAll('[data-item-card]');
          const lastCard = itemCards[itemCards.length - 1];
          if (lastCard) {
            lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const productSelectButton = lastCard.querySelector('button');
            const quantityInput = lastCard.querySelector('input[type="number"]');

            if (lastItem.productId === 0 && productSelectButton instanceof HTMLElement) {
              productSelectButton.focus();
            } else if (lastItem.quantity < 1 && quantityInput instanceof HTMLElement) {
              quantityInput.focus();
            }
          }
        }
      }, 100);

      return;
    }

    setOrderDetails(prevDetails => [
      ...prevDetails,
      { id: crypto.randomUUID(), productId: 0, quantity: 1, unitPrice: 0, discount: 0 },
    ]);

    setValidationErrors(prev => ({
      ...prev,
      items: [...prev.items, { productId: false, quantity: false }],
    }));

    setTimeout(() => {
      if (orderItemsContainerRef.current) {
        orderItemsContainerRef.current.scrollTo({
          top: orderItemsContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });

        const itemCards = orderItemsContainerRef.current.querySelectorAll('[data-item-card]');
        const lastCard = itemCards[itemCards.length - 1];
        if (lastCard) {
          const productSelectButton = lastCard.querySelector('button');
          if (productSelectButton instanceof HTMLElement) {
            productSelectButton.focus();
          }
        }
      }
    }, 100);
  }, [orderDetails]);

  const handleRemoveOrderDetail = useCallback((index: number) => {
    const idsToRemove: string[] = [];

    setOrderDetails(prevDetails => {
      if (prevDetails.length === 1) {
        showToast.error('At least one item is required');
        return prevDetails;
      }
      
      const rowToRemove = prevDetails[index];
      const newDetails = [...prevDetails];
      idsToRemove.push(rowToRemove.id);
      
      // If deleting an Auto-Hardener directly
      if (rowToRemove.isAutoHardener && rowToRemove.linkedBaseRowId) {
        // Unlink it from its Base
        const baseIndex = newDetails.findIndex(d => d.id === rowToRemove.linkedBaseRowId);
        if (baseIndex !== -1) {
          newDetails[baseIndex] = { ...newDetails[baseIndex], linkedHardenerRowId: undefined };
        }
      }
      
      // If deleting a Base that has a linked Auto-Hardener
      if (rowToRemove.linkedHardenerRowId) {
        const hardenerIndex = newDetails.findIndex(
          d => d.id === rowToRemove.linkedHardenerRowId && d.isAutoHardener
        );
        if (hardenerIndex !== -1) {
          idsToRemove.push(newDetails[hardenerIndex].id);
        }
      }
      
      return newDetails.filter(d => !idsToRemove.includes(d.id));
    });

    setValidationErrors(prev => {
      // Re-map validation errors to match new order details length
      // Because we might delete 1 or 2 items, it's safer to just rebuild it
      // or filter based on the same logic. Let's just filter out the indexes.
      // But we don't have the exact indexes in the prev state (it's just an array parallel to orderDetails).
      // Since orderDetails isn't accessible synchronously here, we can use a functional update and the fact that we know the indexes.
      // A cleaner way is to let the main submit handle validation, or just slice.
      // Since we know idsToRemove, and items maps 1:1 with prevDetails... wait! We can't access prevDetails here.
      // So we just remove the specific index. If a linked hardener was also removed, the lengths will mismatch.
      // Let's just reset validation items to match the new length.
      return {
        ...prev,
        // The safest fallback is to clear validation errors for items, they get re-validated on submit anyway
        items: [],
      };
    });
    
    // Trigger a micro-task to properly sync validation array length
    setTimeout(() => {
      setOrderDetails(currentDetails => {
        setValidationErrors(prev => ({
          ...prev,
          items: currentDetails.map(() => ({ productId: false, quantity: false }))
        }));
        return currentDetails;
      });
    }, 0);
  }, []);

  const handleOrderDetailChange = useCallback(
    async (index: number, field: keyof OrderDetailLine, value: string | number) => {
      if (field === 'productId') {
        const productId = Number(value);

        // Check if this is a Base product with linked Hardener
        const selectedProduct = products.find(p => p.productId === productId);
        if (selectedProduct?.Subcategory === 'Base' && selectedProduct?.HardenerId) {
          // Find hardener SKUs for this master product
          const hardenerSkus = products.filter(
            p => p.masterProductId === selectedProduct.HardenerId
          );

          if (hardenerSkus.length > 0 && selectedProduct.CapacityLtr) {
            try {
              // Get mixing ratios
              const ratioRes = await productDevelopmentApi.getMixingRatios(
                selectedProduct.masterProductId!,
                selectedProduct.HardenerId
              );

              if (ratioRes.success && ratioRes.data) {
                const { baseRatio, hardenerRatio } = ratioRes.data;
                // Calculate required hardener pack size
                const hardenerPackSize = selectedProduct.CapacityLtr * (hardenerRatio / baseRatio);

                // Find matching hardener SKU by pack size
                const matchingHardener = hardenerSkus.find(
                  sku => Math.abs((sku.CapacityLtr || 0) - hardenerPackSize) < 0.01
                );

                if (matchingHardener) {
                  // Wait until the main setOrderDetails (at the end) to update everything together to avoid race conditions.
                  // We will store the matching hardener to be processed in the setOrderDetails callback below.
                  // Actually, it's safer to just do the state update here if we are careful, but doing it in one pass is best.
                  // Let's do it right here using a functional update so we have the most current state.
                  setOrderDetails(prev => {
                    const newDetails = [...prev];
                    const baseRow = newDetails[index];
                    const baseQty = baseRow?.quantity || 1;
                    
                    if (baseRow.linkedHardenerRowId) {
                      // Already has a linked hardener. Update it instead of creating a new one.
                      const hardenerIdx = newDetails.findIndex(
                        d => d.id === baseRow.linkedHardenerRowId && d.isAutoHardener
                      );
                      if (hardenerIdx !== -1) {
                        newDetails[hardenerIdx] = {
                          ...newDetails[hardenerIdx],
                          productId: matchingHardener.productId,
                          quantity: baseQty,
                          unitPrice: Number(matchingHardener.sellingPrice) || 0,
                        };
                        return newDetails;
                      }
                    }

                    // Create new linked hardener
                    const hardenerRowId = crypto.randomUUID();
                    const newHardener: OrderDetailLine = {
                      id: hardenerRowId,
                      productId: matchingHardener.productId,
                      quantity: baseQty,
                      unitPrice: Number(matchingHardener.sellingPrice) || 0,
                      discount: 0,
                      linkedBaseRowId: baseRow.id,
                      isAutoHardener: true,
                    };
                    
                    // Update base row to link to the new hardener
                    newDetails[index] = { ...baseRow, linkedHardenerRowId: hardenerRowId };
                    newDetails.push(newHardener);
                    return newDetails;
                  });

                  setValidationErrors(prev => ({
                    ...prev,
                    items: [...prev.items, { productId: false, quantity: false }],
                  }));

                  showToast.success(
                    `Added/Updated ${matchingHardener.productName} (Hardener) - ${hardenerPackSize}L × ${orderDetails[index]?.quantity || 1} qty`
                  );
                } else {
                  // No exact match found - show modal with available options
                  const baseQty = orderDetails[index]?.quantity || 1;
                  setHardenerModalData({
                    baseProduct: selectedProduct,
                    baseProductId: productId,
                    baseRowId: orderDetails[index]?.id || '',
                    requiredPackSize: hardenerPackSize,
                    availableHardeners: hardenerSkus,
                    baseQty,
                  });
                  setShowHardenerModal(true);
                }
              }
            } catch (err) {
              console.error('Error fetching mixing ratios:', err);
            }
          }
        }
      }

      setOrderDetails(prevDetails => {
        const newDetails = [...prevDetails];
        if (field === 'productId') {
          const productId = Number(value);
          const oldRow = newDetails[index];
          
          // If this row had a linked Auto-Hardener and the product changed, we should unlink or delete it.
          // Since it's a product switch, we can just let the above async logic handle updating it if the new product is a Base.
          // BUT if the new product is NOT a Base, we need to delete the old Hardener.
          const selectedProduct = products.find(p => p.productId === productId);
          if (oldRow.linkedHardenerRowId && (!selectedProduct || selectedProduct.Subcategory !== 'Base')) {
            const hardenerIdx = newDetails.findIndex(d => d.id === oldRow.linkedHardenerRowId && d.isAutoHardener);
            if (hardenerIdx !== -1) {
               // Remove the hardener since the base is no longer a Base
               newDetails.splice(hardenerIdx, 1);
            }
          }

          newDetails[index] = {
            ...newDetails[index],
            productId,
            unitPrice: getProductPrice(productId),
          };
          
          // Clear link if it's no longer a base
          if (!selectedProduct || selectedProduct.Subcategory !== 'Base') {
            newDetails[index].linkedHardenerRowId = undefined;
          }

          setValidationErrors(prev => {
            const newItems = [...prev.items];
            if (newItems[index]) newItems[index].productId = false;
            return { ...prev, items: newItems };
          });
        } else if (field === 'quantity') {
          let qty = Number(value) || 0;
          if (qty < 0) qty = 0;
          if (qty > 5000) qty = 5000;
          newDetails[index] = { ...newDetails[index], quantity: qty };

          // Update linked Hardener quantity if this is a Base product (only for Auto-Hardeners)
          const linkedHardenerRowId = newDetails[index].linkedHardenerRowId;
          
          if (linkedHardenerRowId && qty > 0) {
            const hardenerIndex = newDetails.findIndex(d => d.id === linkedHardenerRowId && d.isAutoHardener);
            if (hardenerIndex !== -1) {
              newDetails[hardenerIndex] = { ...newDetails[hardenerIndex], quantity: qty };
            }
          }

          if (qty > 0) {
            setValidationErrors(prev => {
              const newItems = [...prev.items];
              if (newItems[index]) newItems[index].quantity = false;
              return { ...prev, items: newItems };
            });
          }
        } else if (field === 'discount') {
          let disc = Number(value) || 0;
          if (disc < 0) disc = 0;
          if (disc > 20) disc = 20;
          newDetails[index] = { ...newDetails[index], discount: disc };
        } else {
          newDetails[index] = {
            ...newDetails[index],
            [field]: Number(value) || 0,
          };
        }
        return newDetails;
      });
    },
    [getProductPrice, orderDetails, products]
  );

  const calculateLineTotal = (row: OrderDetailLine) => {
    const subtotal = row.quantity * row.unitPrice;
    const discountAmount = (subtotal * row.discount) / 100;
    return Number((subtotal - discountAmount).toFixed(2));
  };

  const calculateOrderTotal = () => {
    return Number(orderDetails.reduce((sum, item) => sum + calculateLineTotal(item), 0).toFixed(2));
  };

  // =====================
  // CUSTOMER SELECTION HANDLER
  // =====================

  const handleCustomerChange = useCallback(
    (id: number) => {
      setCustomerId(id);
      setValidationErrors(prev => ({ ...prev, customerId: false }));

      // For Dealers selecting themselves, strict priority to user profile data
      if (user?.Role === 'Dealer' && id === user.EmployeeID) {
        setCompanyName(user.companyName || '');
        // Enforce user profile address as primary
        if (user.address) {
          setDeliveryAddress(user.address);
          // We do strictly what user requested: deliveryAddress = company address from dealer user
          // If user has address, we STOP here and don't look up customer record address.
          return;
        }
        // Only fallback to customer record if user profile address is missing
      } else {
        setCompanyName(getCompanyName(id));
      }

      const customer = customers.find(c => (c.customerId || c.CustomerID) === id);
      if (customer) {
        // If we are here as a Dealer, it means user.address was missing, so we use customer record
        // If we are NOT a Dealer, we always use customer record

        // Construct full address from components
        const addressParts = [
          customer.address || customer.Address,
          customer.area || customer.Area,
          customer.location || customer.Location,
          customer.pinCode || customer.Pincode,
        ].filter(part => part && part.trim());

        setDeliveryAddress(addressParts.join(', '));

        // Auto-populate sales person from customer
        const customerSalesPersonId = customer.SalesPersonID || customer.salesPersonId;
        if (customerSalesPersonId) {
          setSalesPersonId(customerSalesPersonId);
          // Clear sales person error since it's auto-populated
          setValidationErrors(prev => ({ ...prev, salesPersonId: false }));
        } else {
          // If customer has no sales person, clear the field
          setSalesPersonId('');
        }
      }
    },
    [customers, getCompanyName, user]
  );

  // Auto-fill for Dealer Role
  useEffect(() => {
    if (user?.Role === 'Dealer') {
      // 1. Auto-select Sales Person (Self)
      const empId = user.EmployeeID;
      if (empId) {
        setSalesPersonId(empId);
        setValidationErrors(prev => ({ ...prev, salesPersonId: false }));
      }

      console.log('Dealer Auto-fill Debug:', {
        userCompanyName: user.companyName,
        userAddress: user.address,
        userCustomerId: user.customerId, // Access new field directly
        totalCustomers: customers.length,
      });

      // 2. Pre-fill Company Name from Dealer Profile
      const dealerCompanyName = (user.companyName || '').trim();
      setCompanyName(dealerCompanyName);

      // 3. Auto-select Customer
      // PRIORITY 1: Use customerId from Backend Login response (Most Reliable)
      const backendCustomerId = user.customerId;

      if (backendCustomerId) {
        setCustomerId(backendCustomerId);
        setValidationErrors(prev => ({ ...prev, customerId: false }));
      }
      // PRIORITY 2: Match by Company Name (Fallback)
      else if (customers.length > 0 && dealerCompanyName) {
        const matchingCustomer = customers.find(
          c =>
            (c.companyName || c.CompanyName || '').trim().toLowerCase() ===
            dealerCompanyName.toLowerCase()
        );

        if (matchingCustomer) {
          setCustomerId(matchingCustomer.customerId || matchingCustomer.CustomerID);
          setValidationErrors(prev => ({ ...prev, customerId: false }));
        }
      }

      // 4. Address Logic
      // ALWAYS use the Dealer's profile address as the primary source
      if (user.address) {
        setDeliveryAddress(user.address);
      } else {
        // Fallback: Try to find address from matching customer record
        const currentCustId = backendCustomerId || customerId;
        const matchingCustomer = customers.find(
          c => (c.customerId || c.CustomerID) === currentCustId
        );

        if (matchingCustomer) {
          const addressParts = [
            matchingCustomer.address || matchingCustomer.Address,
            matchingCustomer.area || matchingCustomer.Area,
            matchingCustomer.location || matchingCustomer.Location,
            matchingCustomer.pinCode || matchingCustomer.Pincode,
          ].filter(part => part && part.trim());

          if (addressParts.length > 0) {
            setDeliveryAddress(addressParts.join(', '));
          }
        }
      }
    }
  }, [user, customers]);

  // =====================
  // FORM SUBMISSION
  // =====================

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    const newErrors = {
      customerId: !customerId,
      salesPersonId: !salesPersonId,
      items: orderDetails.map(item => ({
        productId: item.productId === 0,
        quantity: item.quantity <= 0,
      })),
    };

    if (newErrors.customerId || newErrors.salesPersonId) {
      hasError = true;
    }

    if (newErrors.items.some(item => item.productId || item.quantity)) {
      hasError = true;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      if (newErrors.customerId) showToast.error('Please select a customer');
      else if (newErrors.salesPersonId) showToast.error('Please select a salesperson');
      else showToast.error('Please check order items');
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true);

      const validDetails = orderDetails.filter(d => d.productId > 0 && d.quantity > 0);

      // Common Payload
      const orderPayload: any = {
        customerId: Number(customerId),
        salespersonId: Number(salesPersonId),
        priority,
        // status: 'Pending', // Status should not be reset on update usually, or depends on requirements. For new orders it is Pending.
        // For update, we might want to keep existing status or validated it's pending.
        orderDate: editingOrder ? editingOrder.orderDate : new Date().toISOString(),
        paymentCleared: editingOrder ? (editingOrder as any).paymentCleared : false,
        orderDetails: validDetails.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: item.discount || 0,
        })),
        deliveryAddress: deliveryAddress?.trim() || null,
        remarks: remarks?.trim() || null,
      };

      if (!editingOrder) {
        orderPayload.status = 'Pending';
      }

      let result;
      if (editingOrder) {
        result = await updateOrder(editingOrder.orderId, orderPayload);
        showToast.success('Order updated successfully!');
      } else {
        result = await createOrder(orderPayload);
        setLastCreatedOrder(result);
        showToast.success('Order created successfully!');
      }

      setSubmitting(false);
      setShowConfirmation(false);

      if (onSuccess) onSuccess(result);

      // If updating, maybe we want to close edit mode?
      if (editingOrder && onCancelEdit) {
        onCancelEdit();
      } else if (!editingOrder) {
        // Reset form only if creating new
        handleClearAll();
      }
    } catch (error: any) {
      console.error('Submit failed:', error);
      showToast.error(error.message || 'Failed to submit order');
      setSubmitting(false);
      setShowConfirmation(false);
    }
  };

  // Old handleConfirmSubmit was here, replacing it with unified one.
  // We need to remove the old implementation below.

  const resetForm = useCallback(() => {
    setCustomerId('');
    setCompanyName('');
    if (!isSalesPerson) {
      setSalesPersonId('');
    }
    setPriority('Normal');
    setDeliveryAddress('');
    setRemarks('');
    setOrderDetails([{ id: crypto.randomUUID(), productId: 0, quantity: 1, unitPrice: 0, discount: 0 }]);
  }, [isSalesPerson]);

  /**
   * Handle selection from Hardener modal
   */
  const handleSelectHardener = useCallback(
    (selectedHardener: Product) => {
      if (!hardenerModalData) return;

      const { baseRowId, baseQty } = hardenerModalData;

      // Add Hardener to order
      setOrderDetails(prev => {
        const newDetails = [...prev];
        const baseIndex = newDetails.findIndex(d => d.id === baseRowId);
        
        if (baseIndex !== -1) {
          const hardenerRowId = crypto.randomUUID();
          
          newDetails[baseIndex] = {
            ...newDetails[baseIndex],
            linkedHardenerRowId: hardenerRowId
          };
          
          newDetails.push({
            id: hardenerRowId,
            productId: selectedHardener.productId,
            quantity: baseQty,
            unitPrice: Number(selectedHardener.sellingPrice) || 0,
            discount: 0,
            linkedBaseRowId: baseRowId,
            isAutoHardener: true,
          });
        }
        return newDetails;
      });

      setValidationErrors(prev => ({
        ...prev,
        items: [...prev.items, { productId: false, quantity: false }],
      }));

      showToast.success(`Added ${selectedHardener.productName} (Hardener) × ${baseQty} qty`);

      setShowHardenerModal(false);
      setHardenerModalData(null);
    },
    [hardenerModalData]
  );

  const totalAmount = calculateOrderTotal();
  const validItemsCount = orderDetails.filter(d => d.productId > 0 && d.quantity > 0).length;
  const isFormValid = customerId && salesPersonId && validItemsCount > 0;

  // =====================
  // QUOTATION HANDLERS
  // =====================

  const handleOpenQuotationModal = useCallback(() => {
    if (!isFormValid) {
      showToast.error('Please complete the form before creating a quotation');
      return;
    }

    // Pre-fill address from customer
    const customer = customers.find(c => (c.customerId || c.CustomerID) === customerId);
    setQuotationAddress(customer?.address || customer?.Address || deliveryAddress || '');
    setSelectedPaymentTerms(paymentTermsOptions[0]?.value || '');
    setSelectedDeliveryTerms(deliveryTermsOptions[0]?.value || '');
    setShowQuotationModal(true);
  }, [
    isFormValid,
    customers,
    customerId,
    deliveryAddress,
    paymentTermsOptions,
    deliveryTermsOptions,
  ]);

  const handleCreateQuotation = async () => {
    if (!selectedPaymentTerms || !selectedDeliveryTerms) {
      showToast.error('Please select payment terms and delivery terms');
      return;
    }

    try {
      setQuotationLoading(true);
      showToast.loading('Creating quotation...', 'quotation-create');

      const customer = customers.find(c => (c.customerId || c.CustomerID) === customerId);
      const validDetails = orderDetails.filter(d => d.productId > 0 && d.quantity > 0);

      // Get the selected salesperson's name from the dropdown
      let salespersonName = '';

      // First, try to find in salesPersonEmployees list
      let selectedSalesperson = salesPersonEmployees.find(
        e => String(e.employeeId || e.EmployeeID) === String(salesPersonId)
      );

      // If not found, try the full employees list
      if (!selectedSalesperson && salesPersonId) {
        selectedSalesperson = employees.find(
          e => String(e.employeeId || e.EmployeeID) === String(salesPersonId)
        );
      }

      // Extract the name
      if (selectedSalesperson) {
        salespersonName = selectedSalesperson.FirstName || selectedSalesperson.LastName || '';
      }

      // Fallback to logged-in user if salesperson not found
      if (!salespersonName) {
        salespersonName = user?.FirstName || user?.Username || 'Sales Team';
      }

      // Build quotation data with ALL required fields
      const quotationData = {
        // Metadata
        quotationNo: `QT-${Date.now()}`, // Temporary, backend may override
        date: new Date()
          .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
          .replace(/ /g, '-'),
        customerId: Number(customerId),

        // Salesperson Info (for order conversion)
        salespersonId: typeof salesPersonId === 'number' ? salesPersonId : undefined,
        salespersonName: salespersonName,

        // Buyer/Customer Details
        buyerName: customer?.companyName || customer?.CompanyName || '',
        buyerAddress: quotationAddress,
        buyerGSTIN: customer?.GSTNumber || '',
        buyerState: customer?.state || customer?.State || '',
        buyerCode: '',
        customerAddress: quotationAddress,

        // Consignee (same as buyer for now)
        consigneeName: customer?.companyName || customer?.CompanyName || '',
        consigneeAddress: quotationAddress,
        consigneeGSTIN: customer?.gstin || customer?.GSTIN || '',
        consigneeState: customer?.state || customer?.State || '',
        consigneeCode: '',

        // Terms & References
        paymentTerms: selectedPaymentTerms,
        deliveryTerms: selectedDeliveryTerms,
        buyerRef: '',
        otherRef: `${salespersonName}`, // *** KEY FIELD ***
        dispatchThrough: '',
        destination: '',

        // Items
        items: validDetails.map((item, index) => ({
          id: index + 1,
          description: getProductName(item.productId),
          productId: item.productId,
          hsn: '',
          dueOn: '',
          quantity: item.quantity,
          rate: item.unitPrice,
          per: 'no.',
          discount: item.discount,
          cgstRate: 9,
          sgstRate: 9,
        })),

        // Bank Details (optional, can be empty)
        bankName: '',
        accountNo: '',
        ifsc: '',
        branch: '',

        // Additional
        remarks: remarks,
      };

      await quotationApi.create(quotationData);

      showToast.success('Quotation created and sent for approval!', 'quotation-create');
      setShowQuotationModal(false);

      // Refresh quotations list
      await fetchQuotations();

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error creating quotation:', error);
      showToast.error('Failed to create quotation', 'quotation-create');
    } finally {
      setQuotationLoading(false);
    }
  };

  const handlePlaceOrderFromQuotation = async (quotation: QuotationRecord) => {
    try {
      showToast.loading('Creating order from quotation...', 'quotation-order');
      await quotationApi.convertOrder(quotation.quotationId);
      showToast.success('Order created successfully!', 'quotation-order');
      await fetchQuotations();
      if (onSuccess) {
        setTimeout(() => onSuccess(), 500);
      }
    } catch (error: any) {
      console.error('Error converting quotation:', error);
      showToast.error(
        error.response?.data?.error || 'Failed to create order from quotation',
        'quotation-order'
      );
    }
  };

  const handleDownloadQuotation = useCallback(async (quotation: QuotationRecord) => {
    // Direct PDF download
    try {
      showToast.loading('Generating PDF...', 'pdf-download');
      await downloadQuotationPDF(quotation.content);
      showToast.success('PDF downloaded successfully!', 'pdf-download');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast.error('Failed to generate PDF', 'pdf-download');
    }
  }, []);

  // =====================
  // QUOTATION EDIT HANDLERS
  // =====================

  const handleLoadQuotationForEdit = useCallback(
    (quotation: QuotationRecord) => {
      const content = quotation.content;
      if (!content) return;

      // Find and set customer
      const customer = customers.find(
        c =>
          (c.companyName || c.CompanyName) === content.buyerName ||
          (c.customerId || c.CustomerID) === content.customerId
      );

      if (customer) {
        const custId = customer.customerId || customer.CustomerID || 0;
        setCustomerId(custId);
        setCompanyName(decodeHtml(customer.companyName || customer.CompanyName) || '');
        setDeliveryAddress(decodeHtml(content.buyerAddress || content.customerAddress) || '');

        // Set salesperson from content
        if (content.salespersonId) {
          setSalesPersonId(content.salespersonId);
        } else {
          const spId = customer.SalesPersonID || customer.salesPersonId;
          if (spId !== undefined) {
            setSalesPersonId(spId);
          }
        }
      }

      // Set remarks
      setRemarks(decodeHtml(content.remarks) || '');

      // Load items
      if (content.items && content.items.length > 0) {
        const loadedItems: OrderDetailLine[] = content.items.map((item: any) => {
          const product = products.find(
            p => p.productId === item.productId || p.productName === item.description
          );
          return {
            id: crypto.randomUUID(),
            productId: item.productId || product?.productId || 0,
            quantity: item.quantity || 1,
            unitPrice: item.rate || product?.sellingPrice || 0,
            discount: item.discount || 0,
          };
        });
        
        // Pass 2: Reconstruct bidirectional Auto-Hardener links
        if (products.length > 0) {
          loadedItems.forEach((item, index) => {
            const product = products.find(p => p.productId === item.productId);
            if (product?.Subcategory === 'Base' && product?.HardenerId && !item.linkedHardenerRowId) {
              const hardenerSkus = products.filter(p => p.masterProductId === product.HardenerId);
              const hardenerProductIds = hardenerSkus.map(p => p.productId);
              
              const hardenerIndex = loadedItems.findIndex((d, i) => 
                i > index && 
                hardenerProductIds.includes(d.productId) && 
                !d.linkedBaseRowId
              );

              if (hardenerIndex !== -1) {
                item.linkedHardenerRowId = loadedItems[hardenerIndex].id;
                loadedItems[hardenerIndex].linkedBaseRowId = item.id;
                loadedItems[hardenerIndex].isAutoHardener = true;
              }
            }
          });
        }
        
        setOrderDetails(loadedItems);
      }

      // Set editing quotation
      setEditingQuotation(quotation);

      // Pre-fill quotation modal fields
      setQuotationAddress(decodeHtml(content.buyerAddress || content.customerAddress) || '');
      setSelectedPaymentTerms(content.paymentTerms || '');
      setSelectedDeliveryTerms(content.deliveryTerms || '');

      showToast.success('Quotation loaded for editing');

      // Scroll to form and focus first field
      setTimeout(() => {
        if (firstFieldRef.current) {
          firstFieldRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    },
    [customers, products]
  );

  const handleUpdateQuotation = async () => {
    if (!editingQuotation) return;

    try {
      setQuotationLoading(true);
      showToast.loading('Updating quotation...', 'quotation-update');

      const customer = customers.find(c => (c.customerId || c.CustomerID) === customerId);
      const validDetails = orderDetails.filter(d => d.productId > 0 && d.quantity > 0);

      // Get salesperson name
      let salespersonName = '';
      const selectedSalesperson =
        salesPersonEmployees.find(
          e => String(e.employeeId || e.EmployeeID) === String(salesPersonId)
        ) || employees.find(e => String(e.employeeId || e.EmployeeID) === String(salesPersonId));

      if (selectedSalesperson) {
        salespersonName = selectedSalesperson.FirstName || selectedSalesperson.LastName || '';
      }
      if (!salespersonName) {
        salespersonName = user?.FirstName || user?.Username || 'Sales Team';
      }

      const updatedData = {
        ...editingQuotation.content,
        quotationNo: editingQuotation.quotationNo,
        customerId: Number(customerId),
        companyName: 'Morex Technologies',
        buyerName: customer?.companyName || customer?.CompanyName || '',
        buyerAddress: quotationAddress || deliveryAddress,
        buyerGSTIN: customer?.gstin || customer?.GSTIN || '',
        buyerState: customer?.state || customer?.State || '',
        customerAddress: quotationAddress || deliveryAddress,
        salespersonId: typeof salesPersonId === 'number' ? salesPersonId : undefined,
        salespersonName: salespersonName,
        otherRef: salespersonName,
        paymentTerms: selectedPaymentTerms,
        deliveryTerms: selectedDeliveryTerms,
        remarks: remarks,
        status: 'Pending', // Reset status to Pending when updated
        items: validDetails.map((item, index) => ({
          id: index + 1,
          description: getProductName(item.productId),
          productId: item.productId,
          hsn: '',
          dueOn: '',
          quantity: item.quantity,
          rate: item.unitPrice,
          per: 'no.',
          discount: item.discount,
          cgstRate: 9,
          sgstRate: 9,
        })),
      };

      await quotationApi.update(editingQuotation.quotationId, updatedData);

      showToast.success('Quotation updated successfully!', 'quotation-update');
      setShowUpdateConfirmModal(false);
      setEditingQuotation(null);

      // Refresh and reset
      await fetchQuotations();
      resetForm();
    } catch (error) {
      console.error('Error updating quotation:', error);
      showToast.error('Failed to update quotation', 'quotation-update');
    } finally {
      setQuotationLoading(false);
    }
  };

  const handleCancelEdit = useCallback(() => {
    setEditingQuotation(null);
    resetForm();
    showToast.success('Edit cancelled');
  }, [resetForm]);

  // =====================
  // CLEAR ALL HANDLER
  // =====================

  const handleClearAll = useCallback(() => {
    setEditingQuotation(null);
    resetForm();
    showToast.success('Form cleared successfully');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resetForm]);

  // Listen for clear form event from parent
  useEffect(() => {
    const handleClearEvent = () => handleClearAll();
    window.addEventListener('clear-order-form', handleClearEvent);
    return () => window.removeEventListener('clear-order-form', handleClearEvent);
  }, [handleClearAll]);

  // =====================
  // QUOTATIONS TABLE COLUMNS
  // =====================

  const quotationsColumns: ColumnDef<QuotationRecord>[] = useMemo(
    () => [
      {
        accessorKey: 'quotationNo',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Quotation No" />,
        enableColumnFilter: true,
        enableSorting: true,
        cell: ({ row }) => {
          // Add sequence prefix like QTN-1, QTN-2
          const index = quotationsList.findIndex(q => q.quotationId === row.original.quotationId);
          const seq = quotationsList.length - index;
          return (
            <div className="flex flex-col">
              <span className="font-mono font-medium text-[var(--primary)]">QTN-{seq}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {row.original.quotationNo}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        enableColumnFilter: true,
        enableSorting: true,
        cell: ({ row }) => {
          try {
            if (row.original.createdAt) {
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
            }
            return row.original.quotationDate || '-';
          } catch {
            return row.original.quotationDate || '-';
          }
        },
      },
      {
        accessorKey: 'buyerName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
        enableColumnFilter: true,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-medium">{decodeHtml(row.original.buyerName) || '-'}</span>
        ),
      },
      {
        accessorKey: 'salesPerson',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sales Person" />,
        cell: ({ row }) => {
          const name =
            decodeHtml(row.original.content?.salespersonName || row.original.content?.otherRef) ||
            '-';
          return <span className="font-medium">{name}</span>;
        },
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
            <div className="flex items-center gap-2">
              <div
                className="max-w-[150px] truncate text-sm text-[var(--text-secondary)]"
                title={items.map((i: any) => i.description).join(', ')}
              >
                {items.length} item{items.length !== 1 ? 's' : ''} • ₹{total.toFixed(0)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreviewQuotation(row.original);
                  setShowPreviewModal(true);
                }}
                title="Preview Items"
                className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              >
                <Eye size={16} />
              </Button>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        enableColumnFilter: true,
        enableSorting: true,
        cell: ({ row }) => {
          const status = row.original.status;
          let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
          let className = '';

          switch (status) {
            case 'Approved':
              className = 'bg-green-100 text-green-800 border-green-200';
              break;
            case 'Pending':
              className = 'bg-orange-100 text-orange-800 border-orange-200';
              break;
            case 'Rejected':
              variant = 'destructive';
              break;
            default:
              className = 'bg-gray-100 text-gray-800 border-gray-200';
          }

          return (
            <div className="flex flex-col gap-1">
              <Badge variant={variant} className={className}>
                {status}
              </Badge>
              {status === 'Rejected' && row.original.rejectionRemark && (
                <span
                  className="text-xs text-red-600 max-w-[150px] truncate cursor-help"
                  title={`Rejection Reason: ${row.original.rejectionRemark}`}
                >
                  ⚠ {row.original.rejectionRemark}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const quotation = row.original;
          const isApproved = quotation.status === 'Approved';
          const isRejected = quotation.status === 'Rejected';
          const isPending = quotation.status === 'Pending';

          return (
            <div className="flex flex-col gap-1.5">
              {/* Download Button - For approved quotations */}
              {isApproved && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadQuotation(quotation)}
                  title="Download PDF"
                  className="text-blue-600 hover:bg-blue-50 justify-start h-7"
                >
                  <Download size={14} className="mr-1.5" />
                  Download
                </Button>
              )}

              {/* Place Order Button - Only for approved quotations */}
              {isApproved && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePlaceOrderFromQuotation(quotation)}
                  title="Place Order"
                  className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 justify-start h-7"
                >
                  <ShoppingCart size={14} className="mr-1.5" />
                  Order
                </Button>
              )}

              {/* Edit Button for Pending, Approved, or Rejected Quotations (only when managing quotations) */}
              {(isPending || isApproved || isRejected) && viewMode === 'quotations' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleLoadQuotationForEdit(quotation)}
                  title="Edit Quotation"
                  className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 justify-start h-7"
                >
                  <Edit size={14} className="mr-1.5" />
                  Edit
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [handleDownloadQuotation, handleLoadQuotationForEdit, quotationsList, viewMode]
  );

  // =====================
  // RENDER
  // =====================

  return (
    <>
      {/* Update Quotation Confirmation Modal */}
      <UpdateConfirmModal
        isOpen={showUpdateConfirmModal}
        onClose={() => setShowUpdateConfirmModal(false)}
        onConfirm={handleUpdateQuotation}
        loading={quotationLoading}
        quotationNo={editingQuotation?.quotationNo}
        totalAmount={totalAmount}
        companyName={companyName}
        salespersonName={salesPersonId ? getEmployeeName(Number(salesPersonId)) : ''}
        deliveryAddress={quotationAddress || deliveryAddress}
        remarks={remarks}
        paymentTerms={selectedPaymentTerms}
        deliveryTerms={selectedDeliveryTerms}
        onPaymentTermsChange={setSelectedPaymentTerms}
        onDeliveryTermsChange={setSelectedDeliveryTerms}
        paymentTermsOptions={paymentTermsOptions}
        deliveryTermsOptions={deliveryTermsOptions}
        items={orderDetails
          .filter(d => d.productId > 0 && d.quantity > 0)
          .map(item => ({
            productName: getProductName(item.productId),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: calculateLineTotal(item),
          }))}
      />

      {/* Order Confirmation Dialog */}
      {showConfirmation && (
        <Modal
          isOpen={true}
          onClose={() => setShowConfirmation(false)}
          title={editingOrder ? 'Confirm Order Update' : 'Confirm Order Creation'}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-[var(--surface)] p-4 rounded-lg">
              <h3 className="font-semibold text-[var(--text-primary)] mb-3">Order Summary</h3>

              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <div className="flex justify-between">
                  <span>Company:</span>
                  <span className="font-medium text-[var(--text-primary)]">{companyName}</span>
                </div>

                <div className="flex justify-between">
                  <span>Salesperson:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {salesPersonId ? getEmployeeName(Number(salesPersonId)) : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Priority:</span>
                  <span className="font-medium text-[var(--text-primary)]">{priority}</span>
                </div>

                {deliveryAddress && (
                  <div className="flex justify-between">
                    <span>Delivery Address:</span>
                    <span className="font-medium text-[var(--text-primary)] text-right max-w-[200px]">
                      {deliveryAddress}
                    </span>
                  </div>
                )}

                <div className="border-t border-[var(--border)] pt-2 mt-2">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-2">Items</h4>
                  <div className="space-y-1">
                    {orderDetails
                      .filter(d => d.productId > 0)
                      .map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>
                            {getProductName(item.productId)} x {item.quantity}
                            {item.discount > 0 && ` (${item.discount}% off)`}
                          </span>
                          <span className="font-medium">₹{calculateLineTotal(item)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-bold">Total Amount:</span>
                    <span className="font-bold text-lg text-[var(--success)]">
                      ₹{totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmation(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmSubmit} disabled={submitting}>
                {submitting
                  ? editingOrder
                    ? 'Updating...'
                    : 'Creating...'
                  : editingOrder
                    ? 'Confirm & Update'
                    : 'Confirm & Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quotation Preview Modal */}
      {showQuotationModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowQuotationModal(false)}
          title="Create Quotation"
          size="lg"
        >
          <div className="space-y-6">
            {/* Selected Items Preview */}
            <div className="bg-[var(--surface-secondary)] p-4 rounded-lg">
              <h4 className="font-semibold text-[var(--text-primary)] mb-3">Selected Items</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {orderDetails
                  .filter(d => d.productId > 0 && d.quantity > 0)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 bg-[var(--surface)] rounded border border-[var(--border)]"
                    >
                      <div>
                        <span className="font-medium">{getProductName(item.productId)}</span>
                        <span className="text-sm text-[var(--text-secondary)] ml-2">
                          x {item.quantity} @ ₹{item.unitPrice}
                          {item.discount > 0 && ` (-${item.discount}%)`}
                        </span>
                      </div>
                      <span className="font-semibold text-[var(--primary)]">
                        ₹{calculateLineTotal(item).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-lg text-[var(--primary)]">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Customer Address */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Customer Address (Editable)
              </label>
              <textarea
                value={quotationAddress}
                onChange={e => setQuotationAddress(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] resize-none"
                placeholder="Enter customer address..."
              />
            </div>

            {/* Payment Terms Dropdown */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Payment Terms <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedPaymentTerms}
                onChange={e => setSelectedPaymentTerms(e.target.value)}
                options={paymentTermsOptions}
                fullWidth
              />
              {paymentTermsOptions.length <= 1 && (
                <p className="text-xs text-orange-600 mt-1">
                  No payment terms found. Add them in the Terms & Conditions page.
                </p>
              )}
            </div>

            {/* Delivery Terms Dropdown */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Terms of Delivery <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedDeliveryTerms}
                onChange={e => setSelectedDeliveryTerms(e.target.value)}
                options={deliveryTermsOptions}
                fullWidth
              />
              {deliveryTermsOptions.length <= 1 && (
                <p className="text-xs text-orange-600 mt-1">
                  No delivery terms found. Add them in the Terms & Conditions page.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
              <Button
                variant="ghost"
                onClick={() => setShowQuotationModal(false)}
                disabled={quotationLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateQuotation}
                disabled={quotationLoading || !selectedPaymentTerms || !selectedDeliveryTerms}
              >
                {quotationLoading ? 'Creating...' : 'Create Quotation'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Horizontal Layout: Company Info (Left - Narrower) + Order Items (Right - Wider) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT SIDE: Company Information - Takes 1 column */}
          <div className="bg-[var(--surface)] p-6 rounded-lg h-fit lg:sticky lg:top-4 lg:col-span-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Company Information
            </h3>

            <div className="space-y-4">
              {/* Company Name and Salesperson - Stacked */}
              <div className="space-y-4">
                {/* Customer Selection */}
                <div ref={firstFieldRef} className="relative">
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={(() => {
                      // If Dealer, ensure their own entry is in the list
                      if (user?.Role === 'Dealer') {
                        const dealerId = user.EmployeeID;
                        const exists = customers.some(
                          c => (c.customerId || c.CustomerID) === dealerId
                        );

                        const list = customers.map(c => ({
                          id: c.customerId || c.CustomerID || 0,
                          label: c.companyName || c.CompanyName || 'Unknown',
                          subLabel: c.contactPerson || c.ContactPerson,
                          value: c.customerId || c.CustomerID,
                        }));

                        if (!exists) {
                          list.unshift({
                            id: dealerId,
                            label: user.companyName || 'My Company',
                            subLabel: `${user.FirstName || ''} ${user.LastName || ''}`.trim(),
                            value: dealerId,
                          });
                        }
                        return list;
                      }

                      return customers.map(c => {
                        const isInactive = c.isActive === false || c.IsActive === false;
                        return {
                          id: c.customerId || c.CustomerID || 0,
                          label: c.companyName || c.CompanyName || 'Unknown',
                          subLabel: c.contactPerson || c.ContactPerson,
                          value: c.customerId || c.CustomerID,
                          className: isInactive ? 'text-red-500 font-medium' : '',
                        };
                      });
                    })()}
                    value={customerId}
                    onChange={(val: any) => handleCustomerChange(Number(val))}
                    disabled={dataLoading || user?.Role === 'Dealer'}
                    placeholder={
                      dataLoading
                        ? 'Loading...'
                        : user?.Role === 'Dealer'
                          ? 'Auto-selected (You)'
                          : 'Select Company'
                    }
                  />
                  {validationErrors.customerId && (
                    <ValidationTooltip message="Please select an item in the list." />
                  )}
                </div>

                {/* Salesperson */}
                <div className="relative">
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Salesperson <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={(() => {
                      // If Dealer, ensure their own entry is in the list
                      if (user?.Role === 'Dealer') {
                        const dealerId = user.EmployeeID;
                        const exists = salesPersonEmployees.some(
                          e => (e.employeeId || e.EmployeeID) === dealerId
                        );

                        const list = salesPersonEmployees.map(e => ({
                          id: e.employeeId || e.EmployeeID || 0,
                          label:
                            `${e.firstName || e.FirstName} ${e.lastName || e.LastName || ''}`.trim(),
                          value: e.employeeId || e.EmployeeID,
                        }));

                        if (!exists) {
                          list.unshift({
                            id: dealerId,
                            label: `${user.FirstName || ''} ${user.LastName || ''}`.trim(),
                            value: dealerId,
                          });
                        }
                        return list;
                      }

                      return salesPersonEmployees.map(e => ({
                        id: e.employeeId || e.EmployeeID || 0,
                        label:
                          `${e.firstName || e.FirstName} ${e.lastName || e.LastName || ''}`.trim(),
                        value: e.employeeId || e.EmployeeID,
                      }));
                    })()}
                    value={salesPersonId}
                    onChange={(val: any) => {
                      setSalesPersonId(Number(val));
                      setValidationErrors(prev => ({ ...prev, salesPersonId: false }));
                    }}
                    disabled={
                      dataLoading || isSalesPerson || !!customerId || user?.Role === 'Dealer'
                    }
                    placeholder={
                      dataLoading
                        ? 'Loading...'
                        : isSalesPerson || user?.Role === 'Dealer'
                          ? 'Auto-selected'
                          : customerId
                            ? 'Linked to customer'
                            : 'Select Salesperson'
                    }
                  />
                  {validationErrors.salesPersonId && (
                    <ValidationTooltip message="Please select an item in the list." />
                  )}
                  {(isSalesPerson || user?.Role === 'Dealer') && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Your account is automatically selected
                    </p>
                  )}
                </div>
              </div>

              {/* Delivery Address - Full Width Below */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Delivery Address
                </label>
                <Input
                  type="text"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery address (max 100 chars)"
                  maxLength={100}
                />
              </div>

              {/* Priority */}
              <div>
                <Select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  options={[
                    { value: 'Low', label: 'Low' },
                    { value: 'Normal', label: 'Normal' },
                    { value: 'High', label: 'High' },
                    { value: 'Urgent', label: 'Urgent' },
                  ]}
                  label="Priority"
                  fullWidth
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Add any notes or remarks... (max 200 chars)"
                  rows={3}
                  maxLength={200}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] resize-none"
                />
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Order Items - Takes 2 columns (or fullscreen via Portal) */}
          {(() => {
            const orderItemsContent = (
              <div
                className={`bg-[var(--surface)] p-6 rounded-lg flex flex-col transition-all duration-300 ${isOrderItemsFullScreen
                  ? 'fixed inset-0 rounded-none overflow-auto'
                  : 'lg:col-span-2'
                  }`}
                style={isOrderItemsFullScreen ? { zIndex: 999999, isolation: 'isolate' } : {}}
              >
                {/* Header with Expand Button */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                      Order Items
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {validItemsCount} of {orderDetails.length} item
                      {orderDetails.length !== 1 ? 's' : ''} completed
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOrderItemsFullScreen(!isOrderItemsFullScreen)}
                    className="hover:bg-[var(--surface-highlight)]"
                    title={isOrderItemsFullScreen ? 'Exit Fullscreen' : 'Expand to Fullscreen'}
                  >
                    {isOrderItemsFullScreen ? (
                      <Minimize2 size={18} className="text-[var(--text-secondary)]" />
                    ) : (
                      <Maximize2 size={18} className="text-[var(--text-secondary)]" />
                    )}
                  </Button>
                </div>

                {/* Order Items - Card Based - Scrollable */}
                <div
                  ref={orderItemsContainerRef}
                  className="space-y-4 flex-1 overflow-y-auto pr-2"
                  style={{
                    maxHeight: isOrderItemsFullScreen
                      ? 'calc(100vh - 200px)'
                      : 'calc(100vh - 300px)',
                  }}
                >
                  {orderDetails.map((item, index) => {
                    const isComplete = item.productId > 0 && item.quantity > 0;
                    return (
                      <div
                        key={index}
                        data-item-card
                        className={`border rounded-lg p-4 transition-all ${isComplete
                          ? 'border-[var(--success)]/50 bg-[var(--success)]/5'
                          : 'border-[var(--border)] bg-[var(--surface-secondary)]'
                          } hover:border-[var(--primary)] hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-secondary)]">
                              Item #{index + 1}
                            </span>
                            {isComplete && (
                              <CheckCircle size={16} className="text-[var(--success)]" />
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => handleRemoveOrderDetail(index)}
                            disabled={orderDetails.length === 1}
                            className="p-1 hover:bg-[var(--danger)]/10 disabled:opacity-50"
                            size="sm"
                            title="Remove item"
                            leftIcon={<Trash2 size={16} className="text-[var(--danger)]" />}
                          ></Button>
                        </div>

                        <div className="space-y-3">
                          {/* Product Selection */}
                          <div className="relative">
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                              Product <span className="text-red-500">*</span>
                            </label>
                            <SearchableSelect
                              options={products.map(p => ({
                                id: p.productId,
                                label: p.productName,
                                value: p.productId,
                              }))}
                              value={item.productId}
                              onChange={(val: any) =>
                                handleOrderDetailChange(index, 'productId', val || 0)
                              }
                              placeholder="Select Product"
                            />
                            {validationErrors.items[index]?.productId && (
                              <ValidationTooltip message="Please select an item in the list." />
                            )}
                          </div>

                          {/* Quantity and Unit Price */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                Quantity <span className="text-red-500">*</span>
                              </label>
                              <Input
                                type="number"
                                step="1"
                                min="1"
                                max="5000"
                                value={item.quantity || ''}
                                onChange={e => {
                                  handleOrderDetailChange(index, 'quantity', e.target.value);
                                }}
                                placeholder="1"
                              />
                              {validationErrors.items[index]?.quantity && (
                                <ValidationTooltip message="Enter quantity." />
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                Unit Price
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice || ''}
                                onChange={e =>
                                  handleOrderDetailChange(index, 'unitPrice', e.target.value)
                                }
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          {/* Discount and Line Total */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                Discount %
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="20"
                                value={item.discount || ''}
                                onChange={e =>
                                  handleOrderDetailChange(index, 'discount', e.target.value)
                                }
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                Line Total
                              </label>
                              <div
                                className={`px-3 py-2 border rounded-lg font-semibold ${isComplete
                                  ? 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]'
                                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]'
                                  }`}
                              >
                                ₹{calculateLineTotal(item).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Item Button - Below all items */}
                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={handleAddOrderDetail}
                      leftIcon={<Plus size={18} />}
                      className="w-full border-2 border-dashed border-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10"
                    >
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>
            );

            // Use Portal when in fullscreen mode to bypass sidebar stacking context
            return isOrderItemsFullScreen
              ? createPortal(orderItemsContent, document.body)
              : orderItemsContent;
          })()}
        </div>

        {/* Sticky Form Actions at Bottom */}
        <div className="sticky bottom-0 bg-[var(--background)] pt-4 pb-2 border-t border-[var(--border)] -mx-6 px-6 z-20">
          {/* Edit Mode Banner */}
          {editingQuotation && (
            <div className="mb-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                  <Edit size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-medium text-amber-800">
                    Editing: {editingQuotation.quotationNo}
                  </p>
                  <p className="text-xs text-amber-600">Make changes and click Update to save</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="text-amber-700 hover:bg-amber-100"
              >
                <X size={16} className="mr-1" />
                Cancel Edit
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Edit Mode - Update Quotation Button */}
            {editingQuotation && (
              <div className="flex items-center gap-2 order-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearAll}
                  leftIcon={<RotateCcw size={16} />}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Clear all fields"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowUpdateConfirmModal(true)}
                  disabled={!isFormValid}
                  leftIcon={<Edit size={18} />}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50"
                  title={!isFormValid ? 'Complete the form first' : 'Update quotation'}
                >
                  Update Quotation
                </Button>
              </div>
            )}

            {/* Quotation Mode - Create Quotation Button */}
            {!editingQuotation && viewMode === 'quotations' && (
              <div className="flex items-center gap-2 order-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearAll}
                  leftIcon={<RotateCcw size={16} />}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Clear all fields"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleOpenQuotationModal}
                  disabled={!isFormValid}
                  leftIcon={<FileText size={18} />}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50"
                  title={
                    !isFormValid ? 'Complete the form first' : 'Create a quotation for approval'
                  }
                >
                  Create Quotation
                </Button>
              </div>
            )}

            {/* Center - Items & Total Amount */}
            <div className="flex items-center gap-4 px-4 py-2 bg-[var(--surface)] rounded-lg border border-[var(--border)] order-3 lg:order-2 w-full lg:w-auto justify-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">Items:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {validItemsCount} {validItemsCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div className="h-4 w-px bg-[var(--border)]"></div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">Total:</span>
                <span className="font-bold text-lg text-[var(--primary)]">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Order Mode - Create Order Button */}
            {!editingQuotation && viewMode === 'orders' && (
              <div className="flex items-center gap-2 order-2 lg:order-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearAll}
                  leftIcon={<RotateCcw size={16} />}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Clear all fields"
                >
                  Clear
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading || submitting || !isFormValid}
                  className="shadow-lg min-w-[180px]"
                  title={
                    !isFormValid
                      ? 'Please fill in all required fields'
                      : editingOrder
                        ? 'Update Order'
                        : 'Create Order'
                  }
                >
                  {loading || submitting
                    ? editingOrder
                      ? 'Updating...'
                      : 'Creating...'
                    : editingOrder
                      ? 'Update Order'
                      : 'Create Order'}
                </Button>
                {editingOrder && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancelEdit}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
          {!isFormValid && (
            <p className="text-xs text-[var(--danger)] text-center mt-2">
              Please select a company, salesperson, and add at least one complete item
            </p>
          )}
        </div>
      </form>

      {/* Quotations Table - Only show in Quotations mode */}

      {/* Quotations Table - Only show in Quotations mode */}
      {viewMode === 'quotations' && (
        <div className="mt-8 bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border)] bg-gradient-to-r from-purple-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">My Quotations</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  View status and manage your quotations
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <span>{quotationsList.length} quotations</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            {/* Loading State */}
            {quotationsLoading ? (
              <div className="flex justify-center py-8">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[var(--text-secondary)]">Loading quotations...</span>
                </div>
              </div>
            ) : quotationsList.filter(q => q.status !== 'Converted').length === 0 ? (
              <p className="text-center text-[var(--text-secondary)] py-8">No quotations found.</p>
            ) : (
              <DataTable
                columns={quotationsColumns}
                data={quotationsList
                  .filter(q => q.status !== 'Converted')
                  .sort(
                    (a, b) =>
                      new Date(b.updatedAt || b.createdAt).getTime() -
                      new Date(a.updatedAt || a.createdAt).getTime()
                  )}
                searchPlaceholder="Search quotations..."
              />
            )}
          </div>
        </div>
      )}

      {/* Quotation Preview Modal */}
      {showPreviewModal && previewQuotation && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewQuotation(null);
          }}
          title={`Quotation: ${previewQuotation.quotationNo}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--text-secondary)]">Customer:</span>
                <span className="ml-2 font-medium">{previewQuotation.buyerName}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Date:</span>
                <span className="ml-2 font-medium">{previewQuotation.quotationDate}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Status:</span>
                <Badge
                  variant={previewQuotation.status === 'Rejected' ? 'destructive' : 'secondary'}
                  className={`ml-2 ${previewQuotation.status === 'Approved'
                    ? 'bg-green-100 text-green-800'
                    : previewQuotation.status === 'Pending'
                      ? 'bg-orange-100 text-orange-800'
                      : ''
                    }`}
                >
                  {previewQuotation.status}
                </Badge>
              </div>
            </div>

            {previewQuotation.status === 'Rejected' && previewQuotation.rejectionRemark && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-sm font-medium text-red-800">Rejection Reason:</span>
                <p className="text-sm text-red-700 mt-1">{previewQuotation.rejectionRemark}</p>
              </div>
            )}

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)] border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Product</th>
                    <th className="text-right p-2 font-medium w-20">Qty</th>
                    <th className="text-right p-2 font-medium w-24">Rate</th>
                    <th className="text-right p-2 font-medium w-16">Disc%</th>
                    <th className="text-right p-2 font-medium w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(previewQuotation.content?.items || []).map((item: any, idx: number) => {
                    const amount = item.quantity * item.rate * (1 - (item.discount || 0) / 100);
                    return (
                      <tr key={idx}>
                        <td className="p-2">{item.description || '-'}</td>
                        <td className="p-2 text-right">{item.quantity}</td>
                        <td className="p-2 text-right">₹{item.rate?.toFixed(2)}</td>
                        <td className="p-2 text-right">{item.discount || 0}%</td>
                        <td className="p-2 text-right font-medium">₹{amount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[var(--surface)] border-t">
                  <tr>
                    <td colSpan={4} className="p-2 text-right font-medium">
                      Total:
                    </td>
                    <td className="p-2 text-right font-bold">
                      ₹
                      {(previewQuotation.content?.items || [])
                        .reduce((sum: number, item: any) => {
                          return sum + item.quantity * item.rate * (1 - (item.discount || 0) / 100);
                        }, 0)
                        .toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={5}
                      className="p-2 text-right text-xs text-[var(--text-secondary)] italic"
                    >
                      (Incl. 18% GST)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewQuotation(null);
                }}
              >
                Close
              </Button>
              {previewQuotation.status === 'Approved' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    handleDownloadQuotation(previewQuotation);
                    setShowPreviewModal(false);
                    setPreviewQuotation(null);
                  }}
                >
                  <Download size={14} className="mr-1.5" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Hardener Selection Modal */}
      {showHardenerModal && hardenerModalData && (
        <Modal
          isOpen={showHardenerModal}
          onClose={() => {
            setShowHardenerModal(false);
            setHardenerModalData(null);
          }}
          title="Select Hardener"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-amber-800">Hardener Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    <strong>{hardenerModalData.baseProduct?.productName}</strong> requires{' '}
                    <strong>{hardenerModalData.requiredPackSize.toFixed(1)}L</strong> Hardener (not
                    available).
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Available Hardener sizes:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {hardenerModalData.availableHardeners.map(hardener => (
                  <button
                    key={hardener.productId}
                    onClick={() => handleSelectHardener(hardener)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{hardener.productName}</p>
                      <p className="text-sm text-gray-500">
                        {hardener.CapacityLtr ? `${hardener.CapacityLtr}L` : 'Size N/A'} • ₹
                        {Number(hardener.sellingPrice).toFixed(2)}
                      </p>
                    </div>
                    <Plus className="text-gray-400" size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowHardenerModal(false);
                  setHardenerModalData(null);
                }}
              >
                Skip
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default CreateOrderForm;
