/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Smart CRM - Centralized Formatting & Legacy Data Normalization Helper
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces strict display standards for missing/legacy values:
 * - Replaces null, undefined, NaN, Invalid Date, empty strings, empty arrays [],
 *   and empty objects {} with user-friendly placeholders ("-" or "N/A").
 * - Never produces literal "null" or "undefined" text anywhere in UI or CSV export.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Universal Formatter: Formats any value according to the Smart CRM missing value standard.
 *
 * @param {any} val - Input value
 * @param {string} placeholder - Placeholder to use if value is missing/invalid (default: '-')
 * @returns {string} Clean formatted string or placeholder
 */
export function formatDisplayValue(val, placeholder = '-') {
  if (val === null || val === undefined) return placeholder;

  if (typeof val === 'number') {
    return isNaN(val) ? placeholder : String(val);
  }

  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? placeholder : val.toLocaleDateString();
  }

  if (Array.isArray(val)) {
    return val.length === 0
      ? placeholder
      : val.map(item => formatDisplayValue(item, placeholder)).join(', ');
  }

  if (typeof val === 'object') {
    return Object.keys(val).length === 0 ? placeholder : JSON.stringify(val);
  }

  const str = String(val).trim();
  const lower = str.toLowerCase();
  if (
    str === '' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'nan' ||
    lower === 'invalid date'
  ) {
    return placeholder;
  }

  return str;
}

/**
 * Safely parse a date value and return an ISO date string or placeholder.
 *
 * @param {any} val - Date, string, or timestamp
 * @param {string} fallback - Fallback if invalid (default: 'N/A')
 * @returns {string} ISO date string or fallback
 */
export function safeIsoDate(val, fallback = 'N/A') {
  if (val === null || val === undefined) return fallback;
  if (
    typeof val === 'string' &&
    (val.trim() === '' || val.trim().toUpperCase() === 'N/A' || val.trim() === '-')
  ) {
    return fallback;
  }

  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

/**
 * Safely parse a date value and return a user-friendly locale date string or placeholder.
 *
 * @param {any} val - Date, string, or timestamp
 * @param {string} fallback - Fallback if invalid (default: '-')
 * @returns {string} Formatted local date string or fallback
 */
export function safeLocalDate(val, fallback = '-') {
  if (val === null || val === undefined) return fallback;
  if (
    typeof val === 'string' &&
    (val.trim() === '' || val.trim().toUpperCase() === 'N/A' || val.trim() === '-')
  ) {
    return fallback;
  }

  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString();
}

/**
 * Safely convert any value to string with a clean fallback placeholder.
 * Never returns "null", "undefined", or "NaN".
 *
 * @param {any} val - Input value
 * @param {string} fallback - Fallback string if missing/invalid (default: '-')
 * @returns {string} Clean string or fallback
 */
export function safeString(val, fallback = '-') {
  return formatDisplayValue(val, fallback);
}

/**
 * Safely parse numeric values (integers or floats).
 *
 * @param {any} val - Input value
 * @param {number} fallback - Default value if NaN/null/undefined (default: 0)
 * @returns {number} Parsed number or fallback
 */
export function safeNumber(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? fallback : num;
}

/**
 * Safely split a delimiter-separated string into a trimmed string array.
 * Returns empty array [] if value is missing/invalid.
 *
 * @param {any} val - String or array input
 * @param {string} delimiter - Delimiter string (default: ',')
 * @returns {string[]} Array of strings
 */
export function safeSplit(val, delimiter = ',') {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    return val.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(delimiter)
      .map(s => s.trim())
      .filter(s => s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined');
  }
  const str = String(val).trim();
  return str && str.toLowerCase() !== 'null' ? [str] : [];
}

/**
 * Ensures array output for multi-select fields.
 * Handles legacy string formats, JSON arrays, single strings, and nulls.
 *
 * @param {any} val - Input value
 * @returns {any[]} Guaranteed array
 */
export function safeArray(val) {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fall back to split if JSON parsing fails
      }
    }
    return safeSplit(trimmed, ',');
  }
  return [val];
}

/**
 * Sanitize a string specifically for CSV export cells.
 * Uses "-" as placeholder for missing values. Never outputs "null" or "undefined".
 *
 * @param {any} val - Input value
 * @param {string} placeholder - Missing value placeholder (default: '-')
 * @returns {string} Sanitized string for CSV cell
 */
export function sanitizeCsvCell(val, placeholder = '-') {
  const formatted = formatDisplayValue(val, placeholder);
  let str = formatted.replace(/\r?\n|\r/g, ' ');

  // Prevent CSV formula injection attack (=, +, -, @ at start of formula-like text)
  if (/^[=+@]/.test(str)) {
    str = `'${str}`;
  }

  return str;
}

/**
 * Comprehensive runtime normalization layer for a Field Intelligence Report DB object.
 * Applies user-friendly "-" and "N/A" placeholders across all fields.
 *
 * @param {object} report - Raw database report row
 * @returns {object} Normalized report object
 */
export function normalizeReportData(report) {
  if (!report || typeof report !== 'object') return {};

  const normalized = { ...report };

  // 1. Dynamic fields normalization
  normalized.dynamicFields =
    report.dynamicFields && typeof report.dynamicFields === 'object' ? report.dynamicFields : {};

  // 2. Ensure non-null arrays for multi-select fields
  normalized.paintRequirementTypes = safeArray(report.paintRequirementTypes);
  normalized.surfaceTypes = safeArray(report.surfaceTypes);
  normalized.applicationMethods = safeArray(report.applicationMethods);
  normalized.technicalChallenges = safeArray(report.technicalChallenges);

  // 3. Normalized string fields with placeholders
  normalized.reportNumber = safeString(report.reportNumber, `CRM-LEGACY-${report.id || '0'}`);
  normalized.customerName = safeString(report.customerName, 'Unspecified Customer');
  normalized.executiveName = safeString(report.executiveName, '-');
  normalized.status = safeString(report.status, 'Submitted');
  normalized.visitType = safeString(report.visitType, 'General Visit');
  normalized.currentSupplier = safeString(report.currentSupplier, '-');
  normalized.discussionNotes = safeString(report.discussionNotes, '-');
  normalized.importantObservations = safeString(report.importantObservations, '-');

  // 4. Safe dates
  if (report.visitDate) {
    const d = new Date(report.visitDate);
    normalized.visitDate = !isNaN(d.getTime()) ? d : new Date();
  } else {
    normalized.visitDate = report.createdAt ? new Date(report.createdAt) : new Date();
  }

  if (report.expectedOrderDate) {
    const d = new Date(report.expectedOrderDate);
    normalized.expectedOrderDate = !isNaN(d.getTime()) ? d : null;
  } else {
    normalized.expectedOrderDate = null;
  }

  return normalized;
}
