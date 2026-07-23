/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPORARY RCA (Root Cause Analysis) Diagnostic Logger
 * ─────────────────────────────────────────────────────────────────────────────
 * Used ONLY during the investigation of production HTTP 500 errors on the
 * Smart CRM field-intelligence endpoints.
 *
 * ACTIVATION   : Set  DEBUG_RCA=true  in server/.env
 * DEACTIVATION : Remove DEBUG_RCA (or set to false) — silences all output
 *                without touching controller/service code.
 * REMOVAL      : Once root cause is confirmed and fixed:
 *                1. Delete this file.
 *                2. Remove  import { rca } from './rcaDebug.js'  from
 *                   controller.js and service.js.
 *                3. Remove  rcaMiddleware  from routes.js.
 *                4. Remove  DEBUG_RCA  from .env / hosting env vars.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CORRELATION ID + ELAPSED TIMING
 * ─────────────────────────────────────────────────────────────────────────────
 * Every request gets a unique 6-hex-char ID (e.g. "4f9d2c").
 * All log entries for that request are tagged  [req=4f9d2c].
 * Every entry also shows elapsed milliseconds since the request started:
 *
 *   [RCA:getCustomerHistory][req=4f9d2c] REQUEST            { path: '/customer/541/history', ... }
 *   [RCA:getCustomerHistory][req=4f9d2c] TENANT_CONTEXT +2ms { companyId: 1, tenantId: '...' }
 *   [RCA:getCustomerHistory][req=4f9d2c] service ENTER    +3ms { parsed: 541, ... }
 *   [RCA:getCustomerHistory][req=4f9d2c] DB_QUERY_ENTER   +4ms → repository.getCustomerVisitHistory
 *   [RCA:getCustomerHistory][req=4f9d2c] DB_QUERY_RESULT  +9ms ← repository.getCustomerVisitHistory { rowCount: 0 }
 *   [RCA:getCustomerHistory][req=4f9d2c] ❌ CRASH         +10ms @ controller catch { ... }
 *
 * This format lets you grep a single request across interleaved multi-user logs:
 *   grep "req=4f9d2c" logs/combined.log
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';
import logger from '../../config/logger.js';

const RCA_ENABLED = process.env.DEBUG_RCA === 'true';

// ── Per-request context store ─────────────────────────────────────────────────
const rcaStore = new AsyncLocalStorage();

/** Get the current request's correlation context (or a fallback if called outside a request). */
function getCtx() {
  return rcaStore.getStore() ?? { reqId: 'no-req', startTime: Date.now() };
}

/** Format elapsed time since request start as "+Xms". */
function elapsed(startTime) {
  return `+${Date.now() - startTime}ms`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Safely stringify a value for logging without throwing. */
function safeStr(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? `Invalid Date (raw: "${val.toString()}")` : val.toISOString();
  }
  try {
    return String(val);
  } catch {
    return '[unstringifiable]';
  }
}

/** Extract PostgreSQL / Drizzle driver-level error details from any error. */
function extractDbErrorDetails(err) {
  if (!err) return {};
  const cause = err.cause || err;
  const details = {
    pgCode: cause.code || err.code,
    pgSeverity: cause.severity,
    pgDetail: cause.detail,
    pgHint: cause.hint,
    pgPosition: cause.position,
    pgWhere: cause.where,
    pgRoutine: cause.routine,
    pgMessage: cause.message !== err.message ? cause.message : undefined,
  };
  Object.keys(details).forEach(k => details[k] === undefined && delete details[k]);
  return details;
}

/** Return up to N lines of a stack trace as an array of strings. */
function trimStack(err, lines = 12) {
  if (!err?.stack) return [];
  return err.stack
    .split('\n')
    .slice(0, lines)
    .map(l => l.trim());
}

/** Build the log entry prefix: "[RCA:endpoint][req=ID] stage +Xms" */
function prefix(endpoint, stage) {
  const { reqId, startTime } = getCtx();
  const ms = elapsed(startTime);
  return `[RCA:${endpoint}][req=${reqId}] ${stage} ${ms}`;
}

// ── Exported middleware ───────────────────────────────────────────────────────

export const rcaMiddleware = (req, res, next) => {
  if (!RCA_ENABLED) return next();
  const reqId = crypto.randomBytes(3).toString('hex');
  const startTime = Date.now();
  rcaStore.run({ reqId, startTime }, next);
};

// ── Public API ────────────────────────────────────────────────────────────────

export const rca = {
  request(endpoint, req) {
    if (!RCA_ENABLED) return;
    const { reqId, startTime } = getCtx();
    logger.debug(`[RCA:${endpoint}][req=${reqId}] REQUEST`, {
      elapsed: elapsed(startTime),
      path: req.originalUrl || req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.userId ?? req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      employeeId: req.user?.employeeId,
      customerId: req.params?.customerId,
      reportId: req.params?.id,
      query: req.query,
    });
  },

  tenantContext(endpoint, context) {
    if (!RCA_ENABLED) return;
    logger.debug(prefix(endpoint, 'TENANT_CONTEXT'), {
      companyId: context?.companyId,
      tenantId: context?.tenantId,
      resolved: !!context,
    });
  },

  userContext(endpoint, stage, userCtx) {
    if (!RCA_ENABLED) return;
    logger.debug(prefix(endpoint, `USER_CONTEXT @ ${stage}`), {
      username: userCtx?.username,
      role: userCtx?.role,
      employeeId: userCtx?.employeeId,
      userId: userCtx?.userId ?? userCtx?.id,
    });
  },

  queryEnter(endpoint, queryName, params = {}) {
    if (!RCA_ENABLED) return;
    logger.debug(prefix(endpoint, `DB_QUERY_ENTER → ${queryName}`), params);
  },

  queryResult(endpoint, queryName, rows) {
    if (!RCA_ENABLED) return;
    const count = Array.isArray(rows) ? rows.length : rows ? 1 : 0;
    logger.debug(prefix(endpoint, `DB_QUERY_RESULT ← ${queryName}`), {
      rowCount: count,
      firstRowId: Array.isArray(rows) ? rows[0]?.id : rows?.id,
    });
  },

  dtoInput(endpoint, index, row) {
    if (!RCA_ENABLED) return;
    logger.debug(prefix(endpoint, `DTO_INPUT [row ${index}]`), {
      reportId: row?.id,
      customerId: row?.customerId ?? row?.customer_id,
      status: row?.status,
      visitDate_raw: safeStr(row?.visitDate),
      visitDate_type: row?.visitDate?.constructor?.name ?? typeof row?.visitDate,
      expectedOrderDate_raw: safeStr(row?.expectedOrderDate),
      expectedOrderDate_type:
        row?.expectedOrderDate?.constructor?.name ?? typeof row?.expectedOrderDate,
      expectedOrderDate_isDate: row?.expectedOrderDate instanceof Date,
      expectedOrderDate_isValid:
        row?.expectedOrderDate instanceof Date ? !isNaN(row.expectedOrderDate.getTime()) : 'n/a',
    });
  },

  checkpoint(endpoint, stage, ctx = {}) {
    if (!RCA_ENABLED) return;
    logger.debug(prefix(endpoint, stage), ctx);
  },

  crash(endpoint, stage, err, extraContext = {}) {
    if (!RCA_ENABLED) return;
    const dbDetails = extractDbErrorDetails(err);
    logger.error(prefix(endpoint, `❌ CRASH @ ${stage}`), {
      endpoint,
      stage,
      errorClass: err?.constructor?.name,
      message: err?.message,
      isAppError: !!err?.statusCode,
      statusCode: err?.statusCode,
      stack: trimStack(err, 12),
      ...(Object.keys(dbDetails).length > 0 ? { db: dbDetails } : {}),
      ...extraContext,
    });
  },

  dtoCrash(endpoint, index, row, err) {
    if (!RCA_ENABLED) return;
    logger.error(prefix(endpoint, `❌ DTO_CRASH [row ${index}]`), {
      reportId: row?.id,
      customerId: row?.customerId ?? row?.customer_id,
      visitDate_raw: safeStr(row?.visitDate),
      visitDate_type: row?.visitDate?.constructor?.name ?? typeof row?.visitDate,
      expectedOrderDate_raw: safeStr(row?.expectedOrderDate),
      expectedOrderDate_type:
        row?.expectedOrderDate?.constructor?.name ?? typeof row?.expectedOrderDate,
      expectedOrderDate_isDate: row?.expectedOrderDate instanceof Date,
      expectedOrderDate_isValid:
        row?.expectedOrderDate instanceof Date ? !isNaN(row.expectedOrderDate.getTime()) : 'n/a',
      errorClass: err?.constructor?.name,
      message: err?.message,
      stack: trimStack(err, 12),
    });
  },
};
