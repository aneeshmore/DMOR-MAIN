import { reportsApi } from '@/features/reports/api/reportsApi';
import { updateProductApi } from './api';

/**
 * Bulk "Calculate Min Stock" utility.
 *
 * Recommends a 15-day minimum stock level for each product from its recent outward
 * history:
 *
 *   average monthly outward = total outward of the months that had any outward,
 *                             over the last three calendar months, divided by the
 *                             number of those months (max 3)
 *   recommended min stock   = average monthly outward / 2
 *
 * A month with no outward is not counted, so a product that only moved in one of the
 * last three months is divided by 1 rather than 3. A product with no outward at all in
 * the window is skipped and keeps whatever minimum stock it already has.
 *
 * Outward history is read through the existing stock report, one call per month
 * (three calls in total regardless of how many products exist), so this stays cheap
 * for catalogues with thousands of products.
 */

export type MinStockSection = 'FG' | 'RM' | 'PM';

export interface MinStockPreviewRow {
  id: number;
  name: string;
  currentMinStock: number;
  recommendedMinStock: number;
  monthsUsed: number;
  averageMonthlyOutward: number;
}

export interface MinStockResult {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  /** First failure message, surfaced so a bulk run never fails silently. */
  firstError?: string;
}

/** Number of trailing calendar months of outward history considered. */
const HISTORY_MONTHS = 3;
/** Average monthly outward covers ~30 days; a 15-day level is half of it. */
const FIFTEEN_DAY_DIVISOR = 2;
/** Concurrent update requests, to avoid flooding the server on large catalogues. */
const UPDATE_CONCURRENCY = 6;

const toDateInput = (d: Date) => d.toLocaleDateString('en-CA');

/**
 * Minimum stock is stored as a whole number, so the recommendation is rounded to the
 * nearest unit. A product with real outward history is never set to 0, since a zero
 * threshold would silence its low-stock alert entirely.
 */
export const toStorableMinStock = (recommended: number): number => {
  if (!(recommended > 0)) return 0;
  return Math.max(1, Math.round(recommended));
};

/** The last `HISTORY_MONTHS` complete-to-date calendar months, oldest first. */
export const getHistoryMonthRanges = (reference: Date = new Date()) => {
  const ranges: { start: string; end: string }[] = [];
  for (let back = HISTORY_MONTHS - 1; back >= 0; back--) {
    const first = new Date(reference.getFullYear(), reference.getMonth() - back, 1);
    const last = new Date(reference.getFullYear(), reference.getMonth() - back + 1, 0);
    ranges.push({ start: toDateInput(first), end: toDateInput(last) });
  }
  return ranges;
};

/**
 * Recommended minimum stock from a product's per-month outward figures.
 * Returns null when there is no outward history to base a recommendation on.
 */
export const recommendMinStock = (
  monthlyOutward: number[]
): { recommended: number; monthsUsed: number; average: number } | null => {
  const activeMonths = monthlyOutward.filter(qty => Number(qty) > 0);
  if (activeMonths.length === 0) return null;

  const average = activeMonths.reduce((sum, qty) => sum + Number(qty), 0) / activeMonths.length;
  return {
    recommended: average / FIFTEEN_DAY_DIVISOR,
    monthsUsed: activeMonths.length,
    average,
  };
};

/**
 * Reads the last three months of outward quantity for a section and returns the
 * recommended minimum stock per product id. Products with no outward are absent.
 */
export const fetchRecommendedMinStock = async (
  section: MinStockSection
): Promise<Map<number, { recommended: number; monthsUsed: number; average: number }>> => {
  const ranges = getHistoryMonthRanges();

  const monthlyReports = await Promise.all(
    ranges.map(range => reportsApi.getStockReport(section, undefined, range.start, range.end))
  );

  // id -> outward per month, in the same order as `ranges`
  const outwardByProduct = new Map<number, number[]>();

  monthlyReports.forEach((rows, monthIdx) => {
    (rows || []).forEach(row => {
      const id = Number(row.productId);
      if (!Number.isFinite(id)) return;
      if (!outwardByProduct.has(id)) outwardByProduct.set(id, new Array(ranges.length).fill(0));
      outwardByProduct.get(id)![monthIdx] = Math.max(Number(row.totalOutward || 0), 0);
    });
  });

  const recommendations = new Map<
    number,
    { recommended: number; monthsUsed: number; average: number }
  >();

  outwardByProduct.forEach((monthly, id) => {
    const result = recommendMinStock(monthly);
    if (result) recommendations.set(id, result);
  });

  return recommendations;
};

/** Persists one product's minimum stock through the section's existing endpoint. */
const persistMinStock = async (section: MinStockSection, id: number, minStockLevel: number) => {
  const payload = { minStockLevel };
  if (section === 'FG') return updateProductApi.updateFinalGood(id, payload);
  if (section === 'RM') return updateProductApi.updateRawMaterial(id, payload);
  return updateProductApi.updatePackagingMaterial(id, payload);
};

/**
 * Applies recommended minimum stock to every eligible product of a section.
 * `products` must carry the id used by that section's update endpoint — the SKU id for
 * Finished Goods, the master product id for Raw and Packaging Materials.
 */
export const applyMinStockRecommendations = async (
  section: MinStockSection,
  products: { id: number }[],
  recommendations: Map<number, { recommended: number }>
): Promise<MinStockResult> => {
  const eligible = products.filter(p => recommendations.has(p.id));

  const result: MinStockResult = {
    processed: products.length,
    updated: 0,
    skipped: products.length - eligible.length,
    failed: 0,
  };

  for (let i = 0; i < eligible.length; i += UPDATE_CONCURRENCY) {
    const batch = eligible.slice(i, i + UPDATE_CONCURRENCY);
    const outcomes = await Promise.allSettled(
      batch.map(product =>
        persistMinStock(
          section,
          product.id,
          toStorableMinStock(recommendations.get(product.id)!.recommended)
        )
      )
    );
    outcomes.forEach(outcome => {
      if (outcome.status === 'fulfilled') {
        result.updated += 1;
      } else {
        const reason = outcome.reason as any;
        result.failed += 1;
        if (!result.firstError) {
          result.firstError =
            reason?.response?.data?.message || reason?.message || 'Update request failed';
        }
      }
    });
  }

  return result;
};
