import React, { useState } from 'react';
import { Calculator, Loader } from 'lucide-react';
import { confirmDialog } from '@/components/ui';
import { showToast } from '@/utils/toast';
import {
  applyMinStockRecommendations,
  fetchRecommendedMinStock,
  MinStockResult,
  MinStockSection,
} from '../calculateMinStock';

const SECTION_LABEL: Record<MinStockSection, string> = {
  FG: 'Finished Goods',
  RM: 'Raw Materials',
  PM: 'Packaging Materials',
};

interface CalculateMinStockButtonProps {
  section: MinStockSection;
  /** Products of the current section, using that section's own identifier. */
  products: { id: number }[];
  /** Called after a successful run so the table can refresh its data. */
  onCompleted: () => void;
}

/**
 * Bulk recalculation of Minimum Stock for the section currently on screen.
 * Confirms before doing anything, then reports what was changed.
 */
const CalculateMinStockButton: React.FC<CalculateMinStockButtonProps> = ({
  section,
  products,
  onCompleted,
}) => {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<MinStockResult | null>(null);

  const handleClick = async () => {
    if (running) return;

    if (!products || products.length === 0) {
      showToast.error('No products available to calculate.');
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Calculate Minimum Stock Levels',
      message:
        `This action will automatically recalculate the Minimum Stock value for all ` +
        `${SECTION_LABEL[section]} based on their historical outward quantity.\n\n` +
        `The system will consider up to the last 3 months of outward transactions and ` +
        `calculate a recommended 15-day Minimum Stock.\n\n` +
        `Existing Minimum Stock values for eligible products will be updated. ` +
        `Products without outward history will remain unchanged.\n\n` +
        `This action cannot be undone automatically. Do you want to continue?`,
      confirmLabel: 'Calculate',
      cancelLabel: 'Cancel',
      variant: 'warning',
    });
    if (!confirmed) return;

    setRunning(true);
    try {
      const recommendations = await fetchRecommendedMinStock(section);
      const result = await applyMinStockRecommendations(section, products, recommendations);
      setSummary(result);
      if (result.updated > 0) onCompleted();
    } catch (err) {
      console.error('Minimum stock calculation failed', err);
      showToast.error('Could not calculate minimum stock. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        title="Recalculate Minimum Stock from the last 3 months of outward history"
        className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)] transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? (
          <Loader className="h-2.5 w-2.5 animate-spin" />
        ) : (
          <Calculator className="h-2.5 w-2.5" />
        )}
        {running ? 'Calculating…' : 'Calculate'}
      </button>

      {summary && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Minimum Stock Calculation Completed
            </h3>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Products Processed</dt>
                <dd className="font-semibold text-gray-900">{summary.processed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Products Updated</dt>
                <dd className="font-semibold text-green-600">{summary.updated}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Products Skipped (No Outward History)</dt>
                <dd className="font-semibold text-gray-900">{summary.skipped}</dd>
              </div>
              {summary.failed > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Products Failed</dt>
                  <dd className="font-semibold text-red-600">{summary.failed}</dd>
                </div>
              )}
            </dl>

            {summary.failed > 0 && (
              <p className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700">
                {summary.failed} product{summary.failed === 1 ? '' : 's'} could not be updated and
                kept their previous value
                {summary.firstError ? `: ${summary.firstError}` : '.'}
              </p>
            )}

            <p className="mt-4 text-xs leading-relaxed text-gray-500">
              Minimum Stock values have been updated using the last available 3 months of outward
              history, converted to a recommended 15-day stock level.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSummary(null)}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CalculateMinStockButton;
