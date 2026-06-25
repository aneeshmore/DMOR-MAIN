import { ForbiddenError, UnauthorizedError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import db from '../db/index.js';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/index.js';

/**
 * Get effective permissions for a user
 * Returns all granted API routes (e.g., ['GET:/orders', 'POST:/orders'])
 */
export const getEffectivePermissions = async employeeId => {
  const result = await db
    .select({
      grantedActions: schema.rolePermissions.grantedActions,
    })
    .from(schema.employeeRoles)
    .innerJoin(
      schema.rolePermissions,
      eq(schema.employeeRoles.roleId, schema.rolePermissions.roleId)
    )
    .where(eq(schema.employeeRoles.employeeId, employeeId));

  // Collect all granted API routes
  const allApiRoutes = new Set();
  result.forEach(r => {
    if (Array.isArray(r.grantedActions)) {
      r.grantedActions.forEach(action => allApiRoutes.add(action));
    }
  });

  return Array.from(allApiRoutes);
};

/**
 * Normalize route for comparison (handles :id params)
 */
const normalizeRoute = route => route.replace(/\/:\w+/g, '/:param').toLowerCase();

/**
 * requirePermission Middleware
 *
 * Checks if the user has permission to access an API route.
 * Uses METHOD:/path format (e.g., 'GET:/orders', 'POST:/orders')
 *
 * @param {string} apiRoute - API route in METHOD:/path format
 *
 * @example
 * router.get('/', requirePermission('GET:/orders'), controller.getAll);
 * router.post('/', requirePermission('POST:/orders'), controller.create);
 * router.get('/:id', requirePermission('GET:/orders/:id'), controller.getById);
 */
export const requirePermission = apiRoute => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return next(new UnauthorizedError('Not authenticated'));
      }

      // Admin bypass
      // if (req.user.role === 'Admin' || req.user.role === 'SuperAdmin') {
      //   req.permissionContext = { apiRoute, granted: true, isAdmin: true };
      //   return next();
      // }

      if (req.user.role === 'Admin' || req.user.role === 'SuperAdmin') {
        req.permissionContext = { apiRoute, granted: true, isAdmin: true };
        return next();
      }

      // Get user's granted API routes
      const grantedRoutes = await getEffectivePermissions(req.user.employeeId);
      const normalizedTarget = normalizeRoute(apiRoute);

      // Check if user has this route granted
      const hasAccess = grantedRoutes.some(route => normalizeRoute(route) === normalizedTarget);

      if (!hasAccess) {
        logger.warn('Permission denied', {
          userId: req.user.employeeId,
          username: req.user.username,
          apiRoute,
          ip: req.ip,
        });
        return next(
          new ForbiddenError(`Access denied: You don't have permission for '${apiRoute}'`)
        );
      }

      req.permissionContext = { apiRoute, granted: true };
      next();
    } catch (error) {
      logger.error('Permission check failed', { error: error.message });
      next(error);
    }
  };
};

/**
 * requireAnyPermission Middleware
 * Allows access if user has ANY of the specified API routes
 */
export const requireAnyPermission = apiRoutes => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Not authenticated'));
      }

      if (req.user.role === 'Admin' || req.user.role === 'SuperAdmin') {
        return next();
      }

      const grantedRoutes = await getEffectivePermissions(req.user.employeeId);

      const hasAnyAccess = apiRoutes.some(targetRoute => {
        const normalizedTarget = normalizeRoute(targetRoute);
        return grantedRoutes.some(route => normalizeRoute(route) === normalizedTarget);
      });

      if (!hasAnyAccess) {
        return next(new ForbiddenError('Access denied: Insufficient permissions'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Clear permission cache (stub - no caching)
 */
export const clearPermissionCache = () => {};

export default requirePermission;
