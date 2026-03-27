import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}
import { PageHeader } from '@/components/common';
import { FileDown } from 'lucide-react';
import { showToast } from '@/utils/toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter, addPdfHeader } from '@/utils/pdfUtils';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Button, Input } from '@/components/ui';
import { reportsApi } from '../api/reportsApi';
import { companyApi } from '@/features/company/api/companyApi';
import { CompanyInfo } from '@/features/company/types';
import { Bar } from 'react-chartjs-2';
import { ProductInfo, BOMItem, StockReportItem } from '../types';
import ProductTransactionHistory from '../components/ProductTransactionHistory';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const ProductWiseReport = () => {
  const chartRef = useRef<ChartJS<'bar'> | null>(null);
  const isMountedRef = useRef(false);
  const [chartKey, setChartKey] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    companyApi
      .get()
      .then(res => {
        if (cancelled) return;
        setCompanyInfo(res.data.data);
      })
      .catch(err => {
        if (cancelled) return;
        console.error(err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [data, setData] = useState<StockReportItem[]>([]);
  // const [summaryData, setSummaryData] = useState<StockReportItem[]>([]); // Using 'data' for summary list now
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [_bomData, setBomData] = useState<BOMItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [productTypeFilter, setProductTypeFilter] = useState<string>('FG');
  const [selectedProduct, setSelectedProduct] = useState<string>(''); // Used for searching within the list
  const [products, setProducts] = useState<
    { id: string; value: string; label: string; type: string }[]
  >([]);
  // 👇 FIX #1: Stable batch consumption refs for child - prevents prop churn
  const batchConsumptionDataRef = useRef<
    Record<
      string,
      {
        total: number;
        entries: { quantity: number; batchNo?: string; completedAt?: string | null }[];
      }
    >
  >({});

  const [batchConsumptionByProductId, setBatchConsumptionByProductId] = useState<
    Record<
      string,
      {
        total: number;
        entries: { quantity: number; batchNo?: string; completedAt?: string | null }[];
      }
    >
  >({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const productIdsKey = useMemo(
    () =>
      data
        .map(item => item.productId)
        .filter(Boolean)
        .join('|'),
    [data]
  );

  const parseNumeric = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
  };

  // Everything is a ledger now as per user request
  const isLedgerMode = true;
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  // Increment key to force fresh canvas on data changes
  useEffect(() => {
    setChartKey(k => k + 1);
  }, [selectedProduct, productTypeFilter, data.length]);

  // Fetch products based on product type filter
  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      try {
        const type =
          productTypeFilter === 'Sub-Product'
            ? 'FG'
            : (productTypeFilter as 'FG' | 'RM' | 'PM' | 'All');
        const productsList = await reportsApi.getProductsList(type);

        if (cancelled) return;

        const formattedProducts = productsList.map(
          (p: {
            productId?: number;
            ProductID?: number;
            productName?: string;
            ProductName?: string;
            masterProductName?: string;
            productType?: string;
            ProductType?: string;
          }) => ({
            id: (p.productId || p.ProductID)?.toString() || '',
            value: (p.productId || p.ProductID)?.toString() || '',
            label: p.productName || p.ProductName || p.masterProductName || 'Unnamed Product',
            type: p.productType || p.ProductType || 'Unknown',
            subLabel:
              p.masterProductName && (p.productName || p.ProductName)
                ? p.masterProductName
                : undefined,
          })
        );

        setProducts(formattedProducts);
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching products:', error);
        showToast.error('Failed to load products');
        setProducts([]);
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [productTypeFilter]);

  // Reset selected product if it's no longer in the products list
  useEffect(() => {
    if (selectedProduct && products.length > 0) {
      const stillExists = products.find(p => p.value === selectedProduct);
      if (!stillExists) {
        setSelectedProduct('');
        setData([]);
        setProductInfo(null);
        setBomData([]);
      }
    }
  }, [products, selectedProduct]);

  // Fetch data based on selected product or fetch summary if none selected
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Default to Stock Report View (List of Products)
        // Pass filter directly (including 'Sub-Product') to backend, which handles the logic
        const type =
          productTypeFilter === 'Sub-Product'
            ? 'Sub-Product'
            : productTypeFilter === 'All'
              ? undefined
              : (productTypeFilter as 'FG' | 'RM' | 'PM' | 'Sub-Product');

        // Always fetch stock report for the list view
        const result = await reportsApi.getStockReport(
          type,
          selectedProduct || undefined, // If product selected from dropdown, filter the list
          startDate,
          endDate
        );

        if (cancelled) return;

        setData(result || []);
        setProductInfo(null);
        setBomData([]);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error('Error fetching data:', error);
        setData([]);
        setProductInfo(null);
        setBomData([]);
        const err = error as { response?: { status: number } };
        if (err.response?.status !== 404) {
          showToast.error('Failed to load report data');
        }
      } finally {
        if (cancelled || !isMountedRef.current) return;
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [selectedProduct, startDate, endDate, productTypeFilter]);

  const totalsFetchedRef = useRef<string>('');
  useEffect(() => {
    if (!productIdsKey || data.length === 0) return;
    if (totalsFetchedRef.current === productIdsKey) return;

    totalsFetchedRef.current = productIdsKey;
    let cancelled = false;

    const fetchTotalsForAll = async () => {
      const rows = data.filter(item => item.productId);
      const chunkSize = 5;

      for (let i = 0; i < rows.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = rows.slice(i, i + chunkSize);
        const results = await Promise.all(
          chunk.map(async item => {
            try {
              const res = await reportsApi.getProductWiseReport(
                item.productId?.toString(),
                startDate || undefined,
                endDate || undefined,
                item.productType
              );
              const transactions = res.transactions || [];
              const totalOutward = transactions.reduce(
                (sum, tx) => sum + parseNumeric(tx.outward),
                0
              );
              const totalInward = transactions.reduce(
                (sum, tx) => sum + parseNumeric(tx.inward),
                0
              );
              const productionConsumptionOutward = transactions.reduce(
                (sum, tx) =>
                  tx.transactionType === 'Production Consumption'
                    ? sum + parseNumeric(tx.outward)
                    : sum,
                0
              );
              const batchConsumptionTotal =
                batchConsumptionByProductId[item.productId?.toString() || '']?.total || 0;
              const shouldApplyBatchConsumption = item.productType === 'RM';
              const adjustedTotalOutward = shouldApplyBatchConsumption
                ? totalOutward - productionConsumptionOutward + batchConsumptionTotal
                : totalOutward;
              return {
                productId: item.productId?.toString(),
                totalOutward: adjustedTotalOutward,
                totalInward,
              };
            } catch (error) {
              if (!cancelled) {
                console.error('Error fetching totals for product', item.productId, error);
              }
              return null;
            }
          })
        );

        if (cancelled) return;

        setData(prev => {
          let changed = false;

          const updated = prev.map(p => {
            const match = results.find(r => r?.productId === p.productId?.toString());
            if (!match) return p;

            if (p.totalOutward === match.totalOutward && p.totalInward === match.totalInward) {
              return p;
            }

            changed = true;

            return {
              ...p,
              totalOutward: match.totalOutward,
              totalInward: match.totalInward,
            };
          });

          return changed ? updated : prev;
        });
      }
    };

    fetchTotalsForAll();

    return () => {
      cancelled = true;
    };
  }, [productIdsKey, startDate, endDate, productTypeFilter, batchConsumptionByProductId]);

  useEffect(() => {
    Object.keys(batchConsumptionDataRef.current).forEach(
      key => delete batchConsumptionDataRef.current[key]
    ); // 👇 Reset on filter change - TS safe
    let cancelled = false;

    const fetchBatchConsumption = async () => {
      if (productTypeFilter !== 'RM') {
        setBatchConsumptionByProductId({});
        Object.keys(batchConsumptionDataRef.current).forEach(
          key => delete batchConsumptionDataRef.current[key]
        );
        return;
      }

      try {
        const batches = await reportsApi.getBatchProductionReport(
          'Completed',
          startDate || undefined,
          endDate || undefined
        );

        if (cancelled) return;

        const consumptionMap: Record<
          string,
          {
            total: number;
            entries: { quantity: number; batchNo?: string; completedAt?: string | null }[];
          }
        > = {};

        (batches || []).forEach(batch => {
          if (!batch || batch.status !== 'Completed') return;

          const materials = batch.rawMaterials || [];
          materials.forEach(rm => {
            const materialId = rm.rawMaterialId ? rm.rawMaterialId.toString() : '';
            if (!materialId) return;
            const qty = parseNumeric(rm.actualQty ?? 0);
            if (qty <= 0) return;
            if (!consumptionMap[materialId]) {
              consumptionMap[materialId] = { total: 0, entries: [] };
            }
            consumptionMap[materialId].total += qty;
            consumptionMap[materialId].entries.push({
              quantity: qty,
              batchNo: batch.batchNo,
              completedAt: batch.completedAt,
            });
          });
        });

        Object.assign(batchConsumptionDataRef.current, consumptionMap); // 👇 Stable ref for child props
        setBatchConsumptionByProductId(consumptionMap);
      } catch (error) {
        console.error('Error fetching batch consumption data:', error);
        if (!cancelled) {
          setBatchConsumptionByProductId({});
          Object.keys(batchConsumptionDataRef.current).forEach(
            key => delete batchConsumptionDataRef.current[key]
          );
        }
      }
    };

    fetchBatchConsumption();

    return () => {
      cancelled = true;
    };
  }, [productTypeFilter, startDate, endDate]);

  type TotalsUpdate = {
    productId: string;
    totalInward: number;
    totalOutward: number;
  };

  const handleTotalsUpdate = useCallback((totals: TotalsUpdate) => {
    setData(prev => {
      let changed = false;

      const updated = prev.map(item => {
        if (item.productId?.toString() !== totals.productId) return item;

        // 🚫 prevent unnecessary updates (important for avoiding loops)
        if (item.totalInward === totals.totalInward && item.totalOutward === totals.totalOutward) {
          return item;
        }

        changed = true;

        return {
          ...item,
          totalInward: totals.totalInward,
          totalOutward: totals.totalOutward,
        };
      });

      // 🚫 avoid triggering re-render if nothing changed
      return changed ? updated : prev;
    });
  }, []);

  const handleExportPdf = () => {
    const isDetailView = !!selectedProduct;
    const exportData = data;

    if (exportData.length === 0) {
      showToast.error('No data to export');
      return;
    }

    const doc = new jsPDF('landscape');

    // Add Title
    const startY = addPdfHeader(doc, companyInfo, 'Product Transaction Ledger');

    // Add Info
    doc.setFontSize(10);
    if (isDetailView) {
      const selectedProductLabel =
        products.find(p => p.value === selectedProduct)?.label || selectedProduct;
      doc.text(`Product: ${selectedProductLabel}`, 14, startY + 10);
    } else {
      doc.text(`Category: ${productTypeFilter}`, 14, startY + 10);
    }

    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, startY + 15);
    if (startDate) doc.text(`From: ${startDate}`, 14, startY + 20);
    if (endDate) doc.text(`To: ${endDate}`, 14, startY + 25);

    // Define columns based on whether a specific product is selected
    const tableColumn = ['Product Name', 'Category', 'Avail. Qty', 'Total Inward', 'Total Outward'];

    // Define rows
    const tableRows = (data as StockReportItem[]).map(item => [
      item.productName || item.masterProductName,
      item.productType,
      item.availableQuantity,
      item.totalInward || 0,
      item.totalOutward || 0,
    ]);

    // Generate Table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: startY + 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
    });

    addPdfFooter(doc);

    // Save PDF
    const fileName = `product_stock_report_${productTypeFilter}_${
      new Date().toISOString().split('T')[0]
    }.pdf`;

    doc.save(fileName);
    showToast.success('Report exported successfully');
  };

  // Define Columns for DataTable
  const columns = useMemo<ColumnDef<any>[]>(() => {
    return [
      {
        accessorKey: 'productName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Product Name" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {row.original.productType}
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-[var(--text-primary)]">
                {row.original.productName || row.original.masterProductName}
              </span>
              {row.original.masterProductName &&
                row.original.productName !== row.original.masterProductName &&
                row.original.productType !== 'FG' && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {row.original.masterProductName}
                  </span>
                )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'productType',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ row }) => (
          <div className="text-[var(--text-primary)]">{row.original.productType}</div>
        ),
      },
      {
        accessorKey: 'availableQuantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Available Qty" />,
        cell: ({ row }) => (
          <div
            className={`font-bold ${
              row.original.availableQuantity <= (row.original.minStockLevel || 0)
                ? 'text-red-600'
                : 'text-green-600'
            }`}
          >
            {row.original.availableQuantity}
          </div>
        ),
      },
      {
        accessorKey: 'totalInward',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total Inward" />,
        cell: ({ row }) => (
          <div className="text-center font-medium text-green-700">
            {row.original.totalInward || 0}
          </div>
        ),
      },
      {
        accessorKey: 'totalOutward',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total Outward" />,
        cell: ({ row }) => (
          <div className="text-center font-medium text-red-700">
            {row.original.totalOutward || 0}
          </div>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Last Updated" />,
        cell: ({ row }) => {
          const date = row.original.updatedAt ? new Date(row.original.updatedAt) : null;
          if (!date || isNaN(date.getTime()))
            return <div className="text-center text-xs text-gray-400">-</div>;
          // Format as dd-mm-yy with time
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = String(date.getFullYear()).slice(-2);
          const time = date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Kolkata',
          });
          return (
            <div className="text-center text-xs text-gray-500">
              {`${day}-${month}-${year} ${time}`}
            </div>
          );
        },
      },
    ];
  }, []);

  // Prepare chart data
  const chartData = useMemo(() => {
    // Get top 10 products by name
    // Get top 10 products by available stock
    const sortedData = [...data]
      .filter(i => i.productName || i.masterProductName)
      .sort((a, b) => b.availableQuantity - a.availableQuantity)
      .slice(0, 10);

    const chartLabels = sortedData.map(i => i.productName || i.masterProductName || 'Unknown');
    const chartValues = sortedData.map(i => i.availableQuantity);

    return {
      labels: chartLabels,
      datasets: [
        {
          label: 'Available Stock',
          data: chartValues,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          barPercentage: 0.4, // Adjust for thinner bars
          categoryPercentage: 0.5,
        },
      ],
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Wise Stock Report"
        description="Overview of stock levels and transaction history"
        actions={
          <Button
            variant="primary"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleExportPdf}
            leftIcon={<FileDown size={20} />}
            disabled={data.length === 0}
          >
            Export PDF
          </Button>
        }
      />

      {/* Filters Container */}
      <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-end gap-4 flex-wrap">
          {/* Product Type Filter Buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 ml-1">Type</label>
            <div className="flex items-center gap-2">
              {(['FG', 'RM', 'PM'] as const).map(type => (
                <Button
                  key={type}
                  size="sm"
                  variant={productTypeFilter === type ? 'primary' : 'secondary'}
                  onClick={() => {
                    setProductTypeFilter(type);
                    setSelectedProduct('');
                  }}
                  className={`min-w-[3rem] transition-all duration-200 ${
                    productTypeFilter === type
                      ? 'bg-blue-600 text-white hover:bg-blue-700 border-none shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {type === 'FG'
                    ? 'FINISHED GOODS'
                    : type === 'RM'
                      ? 'RAW MATERIAL'
                      : 'PACKING MATERIAL'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Section (Single Product) */}
      {!isLoading && productInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in mb-6">
          <div className="card p-4 border-l-4 border-blue-500 bg-white shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Available Qty
            </p>
            <p className="text-xl font-bold text-blue-700 mt-1">
              {Number(productInfo.availableQuantity || 0).toFixed(2)}
            </p>
          </div>

          <div className="card p-4 border-l-4 border-emerald-500 bg-white shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Status</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              {productInfo.availableQuantity > productInfo.minStockLevel ? 'Healthy' : 'Low Stock'}
            </p>
          </div>
        </div>
      )}

      {/* Aggregate Stats Section - Optional: keep if helpful, or remove if too cluttered */}
      {!isLoading && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in mb-6">
          <div className="card p-4 border-l-4 border-green-500 bg-white shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Total Inward (Selected Period)
            </p>
            <p className="text-xl font-bold text-green-700 mt-1">
              {data.reduce((sum, item) => sum + (item.totalInward || 0), 0)}
            </p>
          </div>
          <div className="card p-4 border-l-4 border-red-500 bg-white shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Total Outward (Selected Period)
            </p>
            <p className="text-xl font-bold text-red-700 mt-1">
              {data.reduce((sum, item) => sum + (item.totalOutward || 0), 0)}
            </p>
          </div>
          <div className="card p-4 border-l-4 border-purple-500 bg-white shadow-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Total Products
            </p>
            <p className="text-xl font-bold text-purple-700 mt-1">{data.length}</p>
          </div>
        </div>
      )}

      {/* Chart Visualizations */}
      {!isLoading && data.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6">
          <div className="h-[400px]">
            {/* Dynamic Bar Chart: Inward vs Outward */}
            <Bar
              key={chartKey}
              ref={chartRef}
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' },
                  title: {
                    display: true,
                    text: 'Top Products by Available Stock',
                    font: { size: 16 },
                  },
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* DataTable */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[var(--text-secondary)] font-medium">Loading report data...</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data} // Now explicitly data is StockReportItem[]
          sorting={sorting}
          onSortingChange={setSorting}
          searchPlaceholder="Search products..."
          defaultPageSize={15}
          showToolbar={true}
          showPagination={true}
          autoResetExpanded={false}
          getRowId={(row, index) =>
            row.productId?.toString() ||
            row.masterProductId?.toString?.() ||
            row.productName ||
            String(index)
          }
          getRowCanExpand={() => true}
          renderSubComponent={({ row }) => (
            <ProductTransactionHistory
              productId={row.original.productId?.toString()}
              productType={row.original.productType}
              endDate={endDate} // Pass end date for "till date" context (ignores startDate for history)
              batchConsumptionTotal={
                batchConsumptionDataRef.current[row.original.productId?.toString() || '']?.total ||
                0
              }
              batchConsumptionEntries={
                batchConsumptionDataRef.current[row.original.productId?.toString() || '']
                  ?.entries || []
              } // 👇 FIX #2: Use stable ref - prevents child re-mount/refetch
              onTotalsUpdate={handleTotalsUpdate}
            />
          )}
        />
      )}
    </div>
  );
};

export default ProductWiseReport;
