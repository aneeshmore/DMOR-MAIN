import { Router } from 'express';
import { mastersController } from './controller.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { authenticate } from '../../middleware/auth.js';
import { sanitizeBody, sanitizePlainTextBody } from '../../utils/sanitize.js';

const router = Router();

// Department routes
router.get(
  '/departments',
  requirePermission('GET:/masters/departments'),
  mastersController.getAllDepartments
);
router.get(
  '/departments/:id',
  requirePermission('GET:/masters/departments/:id'),
  mastersController.getDepartmentById
);
router.post(
  '/departments',
  requirePermission('POST:/masters/departments'),
  sanitizeBody(['DepartmentName', 'Description']),
  mastersController.createDepartment
);
router.put(
  '/departments/:id',
  requirePermission('PUT:/masters/departments/:id'),
  sanitizeBody(['DepartmentName', 'Description']),
  mastersController.updateDepartment
);
router.delete(
  '/departments/:id',
  requirePermission('DELETE:/masters/departments/:id'),
  mastersController.deleteDepartment
);

// Unit routes
router.get('/units', requirePermission('GET:/masters/units'), mastersController.getAllUnits);
router.get(
  '/units/:id',
  requirePermission('GET:/masters/units/:id'),
  mastersController.getUnitById
);
router.post(
  '/units',
  requirePermission('POST:/masters/units'),
  sanitizeBody(['UnitName', 'UnitSymbol', 'Description']),
  mastersController.createUnit
);
router.put(
  '/units/:id',
  requirePermission('PUT:/masters/units/:id'),
  sanitizeBody(['UnitName', 'UnitSymbol', 'Description']),
  mastersController.updateUnit
);
router.delete(
  '/units/:id',
  requirePermission('DELETE:/masters/units/:id'),
  mastersController.deleteUnit
);

// Customer Type routes
router.get(
  '/customer-types',
  requirePermission('GET:/masters/customer-types'),
  mastersController.getAllCustomerTypes
);
router.get(
  '/customer-types/:id',
  requirePermission('GET:/masters/customer-types/:id'),
  mastersController.getCustomerTypeById
);
router.post(
  '/customer-types',
  requirePermission('POST:/masters/customer-types'),
  sanitizeBody(['TypeName', 'Description']),
  mastersController.createCustomerType
);
router.put(
  '/customer-types/:id',
  requirePermission('PUT:/masters/customer-types/:id'),
  sanitizeBody(['TypeName', 'Description']),
  mastersController.updateCustomerType
);
router.delete(
  '/customer-types/:id',
  requirePermission('DELETE:/masters/customer-types/:id'),
  mastersController.deleteCustomerType
);

// Customer routes
router.get(
  '/customers',
  authenticate,
  requirePermission('GET:/masters/customers'),
  mastersController.getAllCustomers
);
router.get('/customers/my-customers', authenticate, mastersController.getCustomersForUser);
router.get('/customers/active-list', authenticate, mastersController.getActiveCustomers);
router.get(
  '/customers/:id',
  requirePermission('GET:/masters/customers/:id'),
  mastersController.getCustomerById
);
router.post(
  '/customers',
  requirePermission('POST:/masters/customers'),
  // Plain-text sanitisation: dangerous markup is still stripped, but business
  // characters (& / ' ") are stored as typed. HTML-entity escaping on write
  // re-encoded the value on every edit (& -> &amp; -> &amp;amp;).
  sanitizePlainTextBody([
    'CompanyName',
    'ContactPerson',
    'Address',
    'City',
    'State',
    'Notes',
    'Email',
    'Location',
    'Area',
  ]),
  mastersController.createCustomer
);
router.put(
  '/customers/:id',
  requirePermission('PUT:/masters/customers/:id'),
  // Same plain-text sanitisation as create - prevents re-encoding on each save.
  sanitizePlainTextBody([
    'CompanyName',
    'ContactPerson',
    'Address',
    'City',
    'State',
    'Notes',
    'Email',
    'Location',
    'Area',
  ]),
  mastersController.updateCustomer
);
router.delete(
  '/customers/:id',
  requirePermission('DELETE:/masters/customers/:id'),
  mastersController.deleteCustomer
);

// Customer transfer
router.post(
  '/customers/:id/transfer',
  requirePermission('POST:/masters/customers/:id/transfer'),
  mastersController.transferCustomer
);

// Role routes
router.get('/roles', requirePermission('GET:/roles'), mastersController.getAllRoles);
router.get('/roles/:id', requirePermission('GET:/roles/:id'), mastersController.getRoleById);
router.post(
  '/roles',
  requirePermission('POST:/roles'),
  sanitizeBody(['RoleName', 'Description']),
  mastersController.createRole
);
router.put(
  '/roles/:id',
  requirePermission('PUT:/roles/:id'),
  sanitizeBody(['RoleName', 'Description']),
  mastersController.updateRole
);
router.delete('/roles/:id', requirePermission('DELETE:/roles/:id'), mastersController.deleteRole);

export default router;
export { router as mastersRoutes };
