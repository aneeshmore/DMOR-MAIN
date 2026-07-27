import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, SearchableSelect } from '@/components/ui';
import { customerApi } from '@/features/masters/api/customerApi';
import { paymentApi, PaymentInput } from '@/features/operations/api/paymentApi';
import { ArrowLeft, Save, CreditCard, History, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@/utils/toast';
import { getModuleTitleByPath } from '@/config/moduleDisplayMetadata';

// Stable route path from routeRegistry.tsx - lookup key only.
const PAYMENT_ENTRY_PATH = '/operations/payment-entry';

const schema = z.object({
  customerId: z.number().min(1, 'Customer is required'),
  amount: z
    .string()
    .refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Amount must be positive'),
  paymentMode: z.string().min(1, 'Payment mode is required'),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
  paymentDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// Indian currency format e.g. 44,35,690.00
const formatINR = (value: number | string) =>
  Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PaymentEntry() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<{ id: number; label: string; value: number }[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentMode: 'Cash',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedCustomerId = watch('customerId');
  const selectedCustomer = customers.find(c => c.value === Number(selectedCustomerId));

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchBalance(selectedCustomerId);
      fetchRecentPayments(selectedCustomerId);
    } else {
      setCurrentBalance(null);
      setRecentPayments([]);
    }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    try {
      const res = await customerApi.getAll();
      const options = (res.data || []).map((c: any) => ({
        id: c.customerId || c.CustomerID,
        label: c.companyName || c.CompanyName,
        value: c.customerId || c.CustomerID,
      }));
      setCustomers(options);
    } catch (error) {
      console.error('Failed to load customers', error);
    }
  };

  const fetchBalance = async (id: number) => {
    try {
      const res = await paymentApi.getBalance(id);
      // API returns { success: true, data: { balance: ... } }
      // Axios response is res, body is res.data
      // So we need res.data.data.balance
      const balanceData = res.data?.data?.balance ?? res.data?.balance ?? 0;
      setCurrentBalance(Number(balanceData));
    } catch (error) {
      console.error('Failed to load balance', error);
    }
  };

  const fetchRecentPayments = async (id: number) => {
    try {
      const res = await paymentApi.getLedger(id);
      if (res.data && res.data.data) {
        // Show all recent transactions
        const payments = res.data.data.slice(0, 10); // Show top 10 recent
        setRecentPayments(payments);
      }
    } catch (error) {
      console.error('Failed to load recent payments', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await paymentApi.create({
        ...data,
        amount: Number(data.amount),
        customerId: Number(data.customerId), // Note: backend expects camelCase 'customerId'
        paymentDate: new Date(data.paymentDate || new Date()).toISOString(), // Convert YYYY-MM-DD to ISO
      });
      showToast.success('Payment recorded successfully!');
      // Keep the same customer selected so the ledger panel stays visible and
      // the refresh below is shown; only the payment-entry fields are cleared.
      // Without customerId here, reset() clears the selection, the selection
      // effect blanks the balance/ledger, and the refreshed data is discarded.
      reset({
        paymentMode: 'Cash',
        paymentDate: new Date().toISOString().split('T')[0],
        customerId: data.customerId,
        // Explicitly clear the Amount field after a successful payment so the
        // input returns to its placeholder; runs only in the success path.
        amount: '',
      });
      // Refresh balance and history from the backend for the customer just paid.
      if (data.customerId) {
        fetchBalance(Number(data.customerId));
        fetchRecentPayments(Number(data.customerId));
      } else {
        setCurrentBalance(null);
      }
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsLoading(false);
    }
  };

  const labelClass = 'text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-highlight)]/30 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-[var(--text-primary)]">
          {getModuleTitleByPath(PAYMENT_ENTRY_PATH, 'Payment Entry')}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Transaction Details ── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-[var(--surface)] rounded-lg shadow-md border border-[var(--border)] border-t-4 border-t-blue-600 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
            <CreditCard size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Transaction Details
            </h3>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className={labelClass}>
                Customer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={customers}
                value={selectedCustomerId}
                onChange={(val: string | number | undefined) =>
                  setValue('customerId', Number(val), { shouldValidate: true })
                }
                placeholder="Select Customer"
                error={errors.customerId?.message}
              />
            </div>

            {currentBalance !== null && (
              <div
                className={`rounded-md border p-4 flex justify-between items-start gap-4 ${
                  currentBalance > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
                }`}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Account Name
                  </p>
                  <p className="font-bold text-[var(--text-primary)]">
                    {selectedCustomer?.label || '-'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Closing Balance
                  </p>
                  <p
                    className={`font-bold flex items-center justify-end gap-1 ${currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {currentBalance > 0 ? 'DUE:' : 'ADVANCE:'} ₹{' '}
                    {formatINR(Math.abs(currentBalance))}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('amount')}
                  error={errors.amount?.message}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  {...register('paymentDate')}
                  error={errors.paymentDate?.message}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Payment Mode <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('paymentMode')}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded focus:ring-1 focus:ring-[var(--primary)] outline-none bg-[var(--surface)] text-[var(--text-primary)]"
                >
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
                {errors.paymentMode && (
                  <p className="text-xs text-red-500">{errors.paymentMode.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Reference No.</label>
                <Input {...register('referenceNo')} placeholder="Cheque No / TXN ID" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>Remarks / Notes</label>
              <Input {...register('notes')} placeholder="Enter remarks..." />
            </div>

            <div className="pt-2">
              <Button type="submit" isLoading={isLoading} className="w-full">
                <Save size={18} className="mr-2" /> Record Payment
              </Button>
            </div>
          </div>
        </form>

        {/* ── Account Ledger Statement ── */}
        <div className="bg-[var(--surface)] rounded-lg shadow-md border border-[var(--border)] border-t-4 border-t-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <History size={16} className="text-[var(--text-primary)]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Account Ledger Statement
              </h3>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-[var(--border)] rounded px-2.5 py-1">
              Recent Transactions
            </span>
          </div>

          {selectedCustomerId ? (
            recentPayments.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                <IndianRupee size={48} className="mx-auto mb-3 opacity-20" />
                <p>No payment history found</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 border-b border-[var(--border)]">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-600 border-r border-[var(--border)]">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-600 border-r border-[var(--border)]">
                        Description
                      </th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-600 border-r border-[var(--border)]">
                        Debit (₹)
                      </th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-600 border-r border-[var(--border)]">
                        Credit (₹)
                      </th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                        Balance (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment, index) => (
                      <tr
                        key={index}
                        className="border-b border-[var(--border)] hover:bg-[var(--surface-highlight)]/20 transition-colors"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-[var(--text-primary)] border-r border-[var(--border)]">
                          {formatDate(payment.transactionDate)}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--text-primary)] border-r border-[var(--border)]">
                          {payment.description}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-red-600 border-r border-[var(--border)] whitespace-nowrap">
                          {Number(payment.debit) > 0 ? (
                            formatINR(payment.debit)
                          ) : (
                            <span className="text-green-600 font-normal">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-green-600 border-r border-[var(--border)] whitespace-nowrap">
                          {Number(payment.credit) > 0 ? (
                            formatINR(payment.credit)
                          ) : (
                            <span className="font-normal">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-[var(--text-primary)] whitespace-nowrap">
                          {formatINR(payment.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="p-8 text-center text-[var(--text-secondary)]">
              <IndianRupee size={64} className="mx-auto mb-4 opacity-20" />
              <p>Select a customer to view recent payment history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
