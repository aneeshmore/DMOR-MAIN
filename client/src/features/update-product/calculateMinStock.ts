import { reportsApi } from '@/features/reports/api/reportsApi';

/**
 * Bulk "Calculate Min Stock" utility.
 *
 * Recommends a 15-day minimum stock level for each product from the three calendar
 * months immediately before the current one — in July that is April, May and June:
 *
 *   average monthly outward = total outward across those three months / 3
 *   recommended min stock   = average monthly outward / 2
 *
 * The window is fixed. A month with no outward counts as 0 and still divides by 3; the
 * calculation never reaches further back to substitute an older month. Only when all
 * three months are empty is the product skipped, keeping its existing minimum stock.
 *
 * Outward history is read through the existing stock report, one call per month
 * (three calls in total regardless of how many products exist), so this stays cheap
 * for catalogues with thousands of products.
 */

export type MinStockSection = 'FG' | 'RM' | 'PM';

export interface MinStockResult {
  processed: number;
  /** Products given a new pending value, awaiting the user's Save. */
  updated: number;
  /** Products with no outward in the window — left untouched. */
  skipped: number;
  failed: number;
}

/** Number of trailing calendar months of outward history considered. */
const HISTORY_MONTHS = 3;
/** Average monthly outward covers ~30 days; a 15-day level is half of it. */
const FIFTEEN_DAY_DIVISOR = 2;
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

/** Steps a date back by whole months, clamping to the last valid day of the target. */
const subtractMonths = (from: Date, months: number) => {
  const target = new Date(from.getFullYear(), from.getMonth() - months, 1);
  const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), lastDayOfTarget));
  return target;
};

/**
 * A single rolling window: the three months immediately before today, ending
 * yesterday. On 31 July this runs 30 April to 30 July — roughly the last 90 days.
 *
 * Today is excluded because the day is still in progress; the window then always
 * covers whole, settled days.
 */
export const getHistoryWindow = (reference: Date = new Date()) => {
  const end = new Date(reference);
  end.setDate(end.getDate() - 1); // yesterday

  const start = subtractMonths(reference, HISTORY_MONTHS);

  return { start: toDateInput(start), end: toDateInput(end) };
};

/**
 * Recommended minimum stock from a product's total outward across the rolling window.
 *
 * The window spans three months, so the monthly average is the window total divided by
 * three — quiet periods inside the window simply pull the average down rather than
 * being skipped. Returns null when the window holds no outward at all, in which case
 * the product's existing minimum stock is left alone.
 */
export const recommendMinStock = (
  totalOutward: number
): { recommended: number; average: number } | null => {
  const total = Math.max(Number(totalOutward) || 0, 0);
  if (total <= 0) return null;

  const average = total / HISTORY_MONTHS;
  return { recommended: average / FIFTEEN_DAY_DIVISOR, average };
};

/**
 * Reads outward quantity across the rolling window for a section and returns the
 * recommended minimum stock per product id. Products with no outward are absent.
 *
 * One request covers the whole window and every product in the section, so this costs
 * the same whether the catalogue holds fifty products or five thousand.
 */
export const fetchRecommendedMinStock = async (
  section: MinStockSection
): Promise<Map<number, { recommended: number; average: number }>> => {
  const { start, end } = getHistoryWindow();

  const rows = await reportsApi.getStockReport(section, undefined, start, end);

  const recommendations = new Map<number, { recommended: number; average: number }>();

  (rows || []).forEach(row => {
    const id = Number(row.productId);
    if (!Number.isFinite(id)) return;
    const result = recommendMinStock(Number(row.totalOutward || 0));
    if (result) recommendations.set(id, result);
  });

  return recommendations;
};

/**
 * Turns recommendations into pending values for the products of a section, ready to be
 * shown in the Min Stock column for review.
 *
 * Nothing is written here. The values become unsaved edits in the table exactly as if
 * they had been typed by hand, so the existing Save button remains the only thing that
 * commits them, and leaving or refreshing the page discards them.
 *
 * `products` must carry the id used by that section — the SKU id for Finished Goods,
 * the master product id for Raw and Packaging Materials.
 */
export const buildMinStockPreview = (
  products: { id: number }[],
  recommendations: Map<number, { recommended: number }>
): { values: { id: number; minStockLevel: number }[]; result: MinStockResult } => {
  const values: { id: number; minStockLevel: number }[] = [];

  products.forEach(product => {
    const recommendation = recommendations.get(product.id);
    if (!recommendation) return; // no outward in the window — leave this product alone
    values.push({
      id: product.id,
      minStockLevel: toStorableMinStock(recommendation.recommended),
    });
  });

  return {
    values,
    result: {
      processed: products.length,
      updated: values.length,
      skipped: products.length - values.length,
      failed: 0,
    },
  };
};
