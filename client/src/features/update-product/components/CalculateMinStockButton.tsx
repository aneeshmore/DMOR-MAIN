import React, { useState } from 'react';
import { Calculator, Check, Loader, RotateCcw } from 'lucide-react';
import { confirmDialog } from '@/components/ui';
import { showToast } from '@/utils/toast';
import {
  buildMinStockPreview,
  fetchRecommendedMinStock,
  getHistoryWindow,
  MinStockResult,
  MinStockSection,
} from '../calculateMinStock';

/** "30 Apr 2026 – 30 Jul 2026" for the window actually used. */
const historyWindowLabel = () => {
  const { start, end } = getHistoryWindow();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
};

const SECTION_LABEL: Record<MinStockSection, string> = {
  FG: 'Finished Goods',
  RM: 'Raw Materials',
  PM: 'Packaging Materials',
};

interface CalculateMinStockButtonProps {
  section: MinStockSection;
  /** Products of the current section, using that section's own identifier. */
  products: { id: number }[];
  /**
   * Receives the calculated values as pending edits. Nothing is saved here — the
   * table's existing Save flow remains the only thing that commits them.
   */
  onPreview: (values: { id: number; minStockLevel: number }[]) => void;
  /** True while calculated values are sitting unsaved in the column. */
  hasPreview: boolean;
  /** Commits the pending values through the table's existing Save flow. */
  onSave: () => void;
  /** Discards the calculated values, restoring the saved ones. */
  onRevert: () => void;
}

/**
 * Bulk recalculation of Minimum Stock for the section currently on screen.
 * Confirms first, then fills the Min Stock column with the calculated values for
 * review. The user saves or discards them using the controls already on the page.
 */
const CalculateMinStockButton: React.FC<CalculateMinStockButtonProps> = ({
  section,
  products,
  onPreview,
  hasPreview,
  onSave,
  onRevert,
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
        `This will calculate a recommended Minimum Stock for all ` +
        `${SECTION_LABEL[section]} from their outward quantity between ` +
        `${historyWindowLabel()}, converted to a 15-day stock level.\n\n` +
        `The calculated values will be shown in the Min Stock column for your review. ` +
        `Nothing is saved until you click Save.\n\n` +
        `Products with no outward in those 3 months will be left unchanged.\n\n` +
        `Do you want to continue?`,
      confirmLabel: 'Calculate',
      cancelLabel: 'Cancel',
      variant: 'info',
    });
    if (!confirmed) return;

    setRunning(true);
    try {
      const recommendations = await fetchRecommendedMinStock(section);
      const { values, result } = buildMinStockPreview(products, recommendations);
      onPreview(values);
      setSummary(result);
    } catch (err) {
      console.error('Minimum stock calculation failed', err);
      showToast.error('Could not calculate minimum stock. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      {hasPreview ? (
        // Calculated values are pending — offer to commit or discard them.
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide">
          <button
            type="button"
            onClick={onSave}
            title="Save the calculated Minimum Stock values"
            className="inline-flex items-center gap-1 text-green-600 transition-opacity hover:opacity-75"
          >
            <Check className="h-2.5 w-2.5" />
            Save
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={onRevert}
            title="Discard the calculated values and restore the saved ones"
            className="inline-flex items-center gap-1 text-gray-500 transition-opacity hover:opacity-75"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Revert
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={running}
          title="Calculate Minimum Stock from the last 3 calendar months of outward history"
          className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)] transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <Loader className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Calculator className="h-2.5 w-2.5" />
          )}
          {running ? 'Calculating…' : 'Calculate'}
        </button>
      )}

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
                <dt className="text-gray-500">Values Calculated</dt>
                <dd className="font-semibold text-green-600">{summary.updated}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Products Skipped (No Outward History)</dt>
                <dd className="font-semibold text-gray-900">{summary.skipped}</dd>
              </div>
            </dl>

            {summary.updated > 0 ? (
              <p className="mt-4 rounded-md bg-amber-50 p-2 text-xs leading-relaxed text-amber-800">
                These values are <strong>not saved yet</strong>. Review them in the Min Stock
                column, then use <strong>Save</strong> above the column to apply them, or{' '}
                <strong>Revert</strong> to discard. Leaving or refreshing the page also discards
                them.
              </p>
            ) : (
              <p className="mt-4 rounded-md bg-blue-50 p-2 text-xs leading-relaxed text-blue-800">
                No {SECTION_LABEL[section]} recorded any outward quantity between{' '}
                <strong>{historyWindowLabel()}</strong>, so there is nothing to recommend and no
                Minimum Stock value has been changed. Check the Current Stock Report for that period
                to confirm the outward history.
              </p>
            )}

            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Calculated from outward quantity between {historyWindowLabel()}, converted to a
              recommended 15-day stock level.
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
