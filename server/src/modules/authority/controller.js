import jwt from 'jsonwebtoken';
import logger from '../../config/logger.js';
import { AppError, UnauthorizedError, NotFoundError, ConflictError } from '../../utils/AppError.js';
import { compareHash } from '../../utils/encryption.js';
import { AuthorityRepository } from './repository.js';

// Import validated JWT_SECRET from auth middleware
import { JWT_SECRET } from '../../middleware/auth.js';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthorityController {
  constructor() {
    this.repository = new AuthorityRepository();
  }

  /**
   * Login user
   * @route POST /api/v1/auth/login
   */
  login = async (req, res, next) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        logger.warn('Login attempt with missing credentials');
        throw new AppError('Username and password are required', 400);
      }

      logger.debug('Attempting login', { username });

      // Find user by username using Drizzle
      const userResult = await this.repository.findByUsername(username);

      if (!userResult) {
        logger.warn('Login failed: User not found', { username });
        throw new UnauthorizedError('Invalid credentials');
      }

      const { employee: user, role } = userResult;

      // Check if user is active
      if (user.status !== 'Active') {
        throw new UnauthorizedError('User account is inactive');
      }

      // Verify password using encryption util
      const isPasswordValid = await compareHash(password, user.passwordHash);

      if (!isPasswordValid) {
        logger.warn('Login failed: Invalid password', { username });
        throw new UnauthorizedError('Invalid credentials');
      }

      logger.debug('Password verified, fetching permissions', {
        username,
        employeeId: user.employeeId,
        companyName: user.companyName, // Debug company name
      });

      // Fetch user permissions using Drizzle
      const permissionsResult = await this.repository.getUserPermissions(user.employeeId);

      const permissions = permissionsResult
        .filter(p => {
          const actions = Array.isArray(p.grantedActions) ? p.grantedActions : [];
          return actions.length > 0; // Only include permissions with granted APIs
        })
        .map(p => {
          const actions = Array.isArray(p.grantedActions) ? p.grantedActions : [];
          return {
            PageName: p.permissionName,
            CanCreate: true,
            CanModify: true,
            CanView: true,
            CanLock: true,
            grantedApis: actions,
          };
        });

      // Generate JWT token
      const token = jwt.sign(
        {
          employeeId: user.employeeId,
          username: user.username,
          role: role?.roleName,
          isSalesRole: role?.isSalesRole || false,
          isSupervisorRole: role?.isSupervisorRole || false,
          companyName: user.companyName,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Prepare user data (exclude password hash)
      const userData = {
        EmployeeID: user.employeeId,
        FirstName: user.firstName,
        LastName: user.lastName,
        Username: user.username,
        Role: role?.roleName,
        landingPage: '/dashboard', // Force default to Dashboard as per user request
        permissions,
        // Dealer specific fields
        companyName: user.companyName,
        address: user.addressComplete, // Map addressComplete to address
        gstin: user.gstin,
        mobileNo: user.mobileNo?.[0], // First mobile number
      };

      // == Dealer Customer Linking Logic ==
      // If user is a Dealer, ensure they have a corresponding Customer record
      // to satisfy Foreign Key constraints in Orders table.
      if (role?.roleName === 'Dealer') {
        const { MastersRepository } = await import('../masters/repository.js');
        const mastersRepo = new MastersRepository();

        // 1. Try to find existing customer linked to this dealer
        // Matching logic:
        // A. Match by Company Name (Strongest match for Dealers)
        // B. Match by createdBy (Ownership) - less reliable if created by Admin
        let linkedCustomer = null;

        if (user.companyName) {
          const allCustomers = await mastersRepo.findAllCustomers();
          linkedCustomer = allCustomers.find(
            c => c.companyName?.trim().toLowerCase() === user.companyName.trim().toLowerCase()
          );
        }

        // 2. If no customer found, CREATE one automatically
        if (!linkedCustomer) {
          logger.info('Dealer login: No linked customer found. Creating new Customer record.', {
            employeeId: user.employeeId,
            companyName: user.companyName
          });

          // Create new customer payload
          const newCustomerData = {
            companyName: user.companyName || `${user.firstName} ${user.lastName} (Dealer)`,
            contactPerson: `${user.firstName} ${user.lastName}`,
            mobileNo: user.mobileNo || [],
            emailId: user.email || '', // Assuming email might be on user object, or empty
            address: user.addressComplete,
            gstNumber: user.gstin,
            pinCode: user.pincode,
            salesPersonId: user.employeeId, // Dealer is their own salesperson
            createdBy: user.employeeId,
            isActive: true,
            customerTypeId: 1, // Default to 'Dealer' type if ID 1 (standard convention, or fetch dynamically if needed)
            // Note: If you have a specific 'Dealer' customer type in DB, it would be better to fetch it.
            // For now, assuming standard flow.
          };

          try {
            linkedCustomer = await mastersRepo.createCustomer(newCustomerData);
          } catch (err) {
            logger.error('Failed to create linked customer for dealer', err);
            // Verify if it failed due to unique constraint or other issue
          }
        }

        // 3. Attach customerId to response
        if (linkedCustomer) {
          userData.customerId = linkedCustomer.customerId;
          userData.customerUuid = linkedCustomer.customerUuid;
          logger.info('Dealer login: Linked to Customer ID', { customerId: linkedCustomer.customerId });
        }
      }

      logger.info('User logged in successfully', {
        username,
        employeeId: user.employeeId,
        companyName: user.companyName, // Log company name
        userType: user.customerType || 'Regular'
      });

      // Set httpOnly cookie for JWT (more secure than localStorage)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      res.cookie('auth_token', token, {
        httpOnly: true, // Prevents XSS attacks from accessing token
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge,
        path: '/',
      });

      res.json({
        success: true,
        token, // Still return token for backward compatibility / mobile apps
        user: userData,
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Logout user
   * @route POST /api/v1/auth/logout
   */
  logout = async (req, res, next) => {
    try {
      // Clear the httpOnly cookie
      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });

      logger.info('User logged out', { userId: req.user?.employeeId });

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current authenticated user
   * @route GET /api/v1/auth/me
   */
  getCurrentUser = async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      const userResult = await this.repository.findById(req.user.employeeId);

      if (!userResult) {
        throw new NotFoundError('User not found');
      }

      const { employee: user, role } = userResult;

      // Fetch permissions
      const permissionsResult = await this.repository.getUserPermissions(user.employeeId);

      const permissions = permissionsResult
        .filter(p => {
          const actions = Array.isArray(p.grantedActions) ? p.grantedActions : [];
          return actions.length > 0; // Only include permissions with granted APIs
        })
        .map(p => {
          const actions = Array.isArray(p.grantedActions) ? p.grantedActions : [];
          return {
            PageName: p.permissionName,
            CanCreate: true,
            CanModify: true,
            CanView: true,
            CanLock: true,
            grantedApis: actions,
          };
        });

      res.json({
        success: true,
        data: {
          EmployeeID: user.employeeId,
          FirstName: user.firstName,
          LastName: user.lastName,
          Username: user.username,
          Role: role?.roleName,
          landingPage: role?.landingPage || '/dashboard',
          landingPage: role?.landingPage || '/dashboard',
          permissions,
          // Dealer specific fields
          companyName: user.companyName,
          address: user.addressComplete,
          gstin: user.gstin,
          mobileNo: user.mobileNo?.[0],
        },
      });
    } catch (error) {
      next(error);
    }
  };
  /**
   * Get all roles
   */
  getRoles = async (req, res, next) => {
    try {
      const roles = await this.repository.getAllRoles();
      res.json({ success: true, data: roles });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all permissions
   */
  getPermissions = async (req, res, next) => {
    try {
      const permissions = await this.repository.getAllPermissions();
      res.json({ success: true, data: permissions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all role permissions
   */
  getRolePermissions = async (req, res, next) => {
    try {
      const rolePermissions = await this.repository.getAllRolePermissions();
      res.json({ success: true, data: rolePermissions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update role permission
   */
  updateRolePermission = async (req, res, next) => {
    try {
      const { roleId, permissionId, grantedActions } = req.body;

      if (!roleId || !permissionId || !Array.isArray(grantedActions)) {
        throw new AppError('Invalid input', 400);
      }

      // Validate actions - now accepts API route format (METHOD:/path) or legacy actions
      // New format: 'GET:/orders', 'POST:/orders', etc.
      // Legacy format: 'view', 'create', 'modify', etc.
      const API_ROUTE_PATTERN = /^(GET|POST|PUT|PATCH|DELETE):\/.+$/i;
      const LEGACY_ACTIONS = ['view', 'create', 'modify', 'delete', 'lock', 'export'];

      const invalidActions = grantedActions.filter(a => {
        // Accept new API route format OR legacy actions
        return !API_ROUTE_PATTERN.test(a) && !LEGACY_ACTIONS.includes(a.toLowerCase());
      });
      if (invalidActions.length > 0) {
        throw new AppError(`Invalid actions: ${invalidActions.join(', ')}`, 400);
      }

      const result = await this.repository.updateRolePermission(
        roleId,
        permissionId,
        grantedActions
      );

      // Clear permission cache for all users since role affects multiple users
      // Import at top: import { clearPermissionCache } from '../../middleware/requirePermission.js';
      const { clearPermissionCache } = await import('../../middleware/requirePermission.js');
      clearPermissionCache();
      logger.info('Permission cache cleared after role permission update', {
        roleId,
        permissionId,
      });

      res.json({ success: true, data: result[0], message: 'Permission updated' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Duplicate a role with all its permissions
   * @route POST /api/v1/auth/roles/:id/duplicate
   */
  duplicateRole = async (req, res, next) => {
    try {
      const sourceRoleId = parseInt(req.params.id);
      const { newRoleName, description } = req.body;

      if (!newRoleName || !newRoleName.trim()) {
        throw new AppError('New role name is required', 400);
      }

      // Check if source role exists
      const sourceRole = await this.repository.getRoleById(sourceRoleId);
      if (!sourceRole) {
        throw new NotFoundError('Source role not found');
      }

      // Check if new role name already exists
      const existingRole = await this.repository.getRoleByName(newRoleName.trim());
      if (existingRole) {
        throw new AppError('A role with this name already exists', 400);
      }

      // Create new role
      const newRole = await this.repository.createRole({
        roleName: newRoleName.trim(),
        description: description || `Copy of ${sourceRole.roleName}`,
        landingPage: sourceRole.landingPage || '/dashboard',
        isActive: true,
      });

      // Get source role's permissions
      const sourcePermissions = await this.repository.getRolePermissionsById(sourceRoleId);

      // Only copy permissions that have granted actions (skip empty ones)
      const nonEmptyPermissions = sourcePermissions.filter(
        perm => Array.isArray(perm.grantedActions) && perm.grantedActions.length > 0
      );

      // Copy permissions to new role
      for (const perm of nonEmptyPermissions) {
        await this.repository.updateRolePermission(
          newRole.roleId,
          perm.permissionId,
          perm.grantedActions
        );
      }

      logger.info('Role duplicated successfully', {
        sourceRoleId,
        newRoleId: newRole.roleId,
        newRoleName,
      });

      res.status(201).json({
        success: true,
        data: newRole,
        message: `Role "${newRoleName}" created with ${nonEmptyPermissions.length} permissions copied`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get roles by department ID
   * @route GET /api/v1/auth/roles/by-department/:departmentId
   */
  getRolesByDepartment = async (req, res, next) => {
    try {
      const departmentId = parseInt(req.params.departmentId);
      if (isNaN(departmentId)) {
        throw new AppError('Invalid department ID', 400);
      }
      const roles = await this.repository.getRolesByDepartment(departmentId);
      res.json({ success: true, data: roles });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new role
   * @route POST /api/v1/auth/roles
   */
  createRole = async (req, res, next) => {
    try {
      const { roleName, description, departmentId, landingPage } = req.body;

      if (!roleName || !roleName.trim()) {
        throw new AppError('Role name is required', 400);
      }

      // Check if role name already exists
      const existingRole = await this.repository.getRoleByName(roleName.trim());
      if (existingRole) {
        throw new AppError('A role with this name already exists', 400);
      }

      const newRole = await this.repository.createRole({
        roleName: roleName.trim(),
        description: description || null,
        departmentId: departmentId || null,
        landingPage: landingPage || '/dashboard',
        isActive: true,
      });

      logger.info('Role created', { roleId: newRole.roleId, roleName });

      res.status(201).json({
        success: true,
        data: newRole,
        message: 'Role created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a role
   * @route PUT /api/v1/auth/roles/:id
   */
  updateRole = async (req, res, next) => {
    try {
      const roleId = parseInt(req.params.id);
      const { roleName, description, departmentId, landingPage, isActive } = req.body;

      if (isNaN(roleId)) {
        throw new AppError('Invalid role ID', 400);
      }

      // Check if role exists
      const existingRole = await this.repository.getRoleById(roleId);
      if (!existingRole) {
        throw new NotFoundError('Role not found');
      }

      // If roleName is being changed, check for duplicates
      if (roleName && roleName.trim() !== existingRole.roleName) {
        const duplicateRole = await this.repository.getRoleByName(roleName.trim());
        if (duplicateRole) {
          throw new AppError('A role with this name already exists', 400);
        }
      }

      const updateData = {};
      if (roleName !== undefined) updateData.roleName = roleName.trim();
      if (description !== undefined) updateData.description = description;
      if (departmentId !== undefined) updateData.departmentId = departmentId;
      if (landingPage !== undefined) updateData.landingPage = landingPage;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedRole = await this.repository.updateRole(roleId, updateData);

      logger.info('Role updated', { roleId, roleName: updatedRole.roleName });

      res.json({
        success: true,
        data: updatedRole,
        message: 'Role updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a role
   * @route DELETE /api/v1/auth/roles/:id
   */
  deleteRole = async (req, res, next) => {
    try {
      const roleId = parseInt(req.params.id);

      if (isNaN(roleId)) {
        throw new AppError('Invalid role ID', 400);
      }

      // Check if role exists
      const existingRole = await this.repository.getRoleById(roleId);
      if (!existingRole) {
        throw new NotFoundError('Role not found');
      }

      // Prevent deletion of system roles or default admin roles
      if (
        existingRole.isSystemRole ||
        ['Admin', 'Administrator', 'SuperAdmin'].includes(existingRole.roleName)
      ) {
        throw new ConflictError('Cannot delete system or default admin roles');
      }

      await this.repository.deleteRole(roleId);

      logger.info('Role deleted', { roleId, roleName: existingRole.roleName });

      res.json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

const authorityController = new AuthorityController();
export default authorityController;
export { AuthorityController };
