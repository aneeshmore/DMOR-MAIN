import { MastersRepository } from './repository.js';
import { DepartmentDTO, UnitDTO, CustomerTypeDTO, CustomerDTO } from './dto.js';
import { NotFoundError, ConflictError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';

export class MastersService {
  constructor() {
    this.repository = new MastersRepository();
    this.postalDetailsCache = new Map();
  }

  async getPostalDetailsByPincode(pincode) {
    if (!pincode || !/^\d{6}$/.test(String(pincode))) {
      return null;
    }

    if (this.postalDetailsCache.has(pincode)) {
      return this.postalDetailsCache.get(pincode);
    }

    const request = fetch(`https://api.postalpincode.in/pincode/${pincode}`)
      .then(response => response.json())
      .then(data => {
        if (data?.[0]?.Status !== 'Success') {
          return null;
        }

        const postOffice = data?.[0]?.PostOffice?.[0];
        return {
          district: postOffice?.District || null,
          state: postOffice?.State || null,
        };
      })
      .catch(error => {
        logger.warn('Failed to fetch postal details for customer', {
          pincode,
          error: error.message,
        });
        return null;
      });

    this.postalDetailsCache.set(pincode, request);
    return request;
  }

  async enrichCustomerWithPostalDetails(customer) {
    const postalDetails = await this.getPostalDetailsByPincode(customer.pinCode || customer.pin_code);

    return {
      ...customer,
      district: postalDetails?.district || null,
      state: postalDetails?.state || null,
    };
  }

  async enrichCustomersWithPostalDetails(customers) {
    return Promise.all(customers.map(customer => this.enrichCustomerWithPostalDetails(customer)));
  }

  // Department methods
  async getAllDepartments() {
    try {
      const departments = await this.repository.findAllDepartments();
      return departments.map(dept => new DepartmentDTO(dept));
    } catch (error) {
      logger.error('Failed to fetch departments', { error: error.message });
      throw error;
    }
  }

  async getDepartmentById(departmentId) {
    const department = await this.repository.findDepartmentById(departmentId);
    if (!department) {
      throw new NotFoundError('Department not found');
    }
    return new DepartmentDTO(department);
  }

  async createDepartment(departmentData) {
    try {
      const department = await this.repository.createDepartment({
        departmentName: departmentData.DepartmentName,
        isActive: true,
      });
      logger.info('Department created', { id: department.departmentId });
      return new DepartmentDTO(department);
    } catch (error) {
      logger.error('Failed to create department', { error: error.message });
      throw error;
    }
  }

  async updateDepartment(departmentId, updateData) {
    const existing = await this.repository.findDepartmentById(departmentId);
    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    const systemDepartmentNames = [
      'Accounts',
      'Administration',
      'Production',
      'Sales & Marketing',
      'Sales & Marketing',
      'Dealer',
      'Administrator',
    ];

    if (systemDepartmentNames.includes(existing.departmentName)) {
      throw new ConflictError(
        `Cannot update system department: ${existing.departmentName}. These departments are essential for system operation.`
      );
    }

    const updateFields = {};
    if (updateData.DepartmentName !== undefined)
      updateFields.departmentName = updateData.DepartmentName;
    if (updateData.IsActive !== undefined) updateFields.isActive = updateData.IsActive;

    const updated = await this.repository.updateDepartment(departmentId, updateFields);
    logger.info('Department updated', { id: departmentId });
    return new DepartmentDTO(updated);
  }

  async deleteDepartment(departmentId) {
    const existing = await this.repository.findDepartmentById(departmentId);
    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    // Prevent deletion of system departments
    if (existing.isSystemDepartment) {
      throw new ConflictError('Cannot delete system departments');
    }

    const systemDepartmentNames = [
      'Accounts',
      'Administration',
      'Production',
      'Sales & Marketing',
      'Sales & Marketing',
      'Dealer',
      'Administrator',
    ];

    if (systemDepartmentNames.includes(existing.departmentName)) {
      throw new ConflictError(
        `Cannot delete system department: ${existing.departmentName}. These departments are essential for system operation.`
      );
    }

    await this.repository.deleteDepartment(departmentId);
    logger.info('Department deleted', { id: departmentId });
  }

  // Unit methods
  async getAllUnits() {
    try {
      const units = await this.repository.findAllUnits();
      return units.map(unit => new UnitDTO(unit));
    } catch (error) {
      logger.error('Failed to fetch units', { error: error.message });
      throw error;
    }
  }

  async getUnitById(unitId) {
    const unit = await this.repository.findUnitById(unitId);
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }
    return new UnitDTO(unit);
  }

  async createUnit(unitData) {
    try {
      // Check if unit with same name already exists (case-insensitive)
      const existingUnit = await this.repository.findUnitByName(unitData.UnitName);
      if (existingUnit) {
        throw new ConflictError(`Unit "${unitData.UnitName}" already exists`);
      }

      const unit = await this.repository.createUnit({
        unitName: unitData.UnitName,
      });
      logger.info('Unit created', { id: unit.unitId });
      return new UnitDTO(unit);
    } catch (error) {
      logger.error('Failed to create unit', { error: error.message });
      throw error;
    }
  }

  async updateUnit(unitId, updateData) {
    const existing = await this.repository.findUnitById(unitId);
    if (!existing) {
      throw new NotFoundError('Unit not found');
    }

    // Check if another unit with same name already exists (case-insensitive)
    const duplicateUnit = await this.repository.findUnitByName(updateData.UnitName, unitId);
    if (duplicateUnit) {
      throw new ConflictError(`Unit "${updateData.UnitName}" already exists`);
    }

    const updated = await this.repository.updateUnit(unitId, {
      unitName: updateData.UnitName,
    });
    logger.info('Unit updated', { id: unitId });
    return new UnitDTO(updated);
  }

  async deleteUnit(unitId) {
    const existing = await this.repository.findUnitById(unitId);
    if (!existing) {
      throw new NotFoundError('Unit not found');
    }

    await this.repository.deleteUnit(unitId);
    logger.info('Unit deleted', { id: unitId });
  }

  // Customer Type methods
  async getAllCustomerTypes() {
    try {
      const customerTypes = await this.repository.findAllCustomerTypes();
      return customerTypes.map(type => new CustomerTypeDTO(type));
    } catch (error) {
      logger.error('Failed to fetch customer types', { error: error.message });
      throw error;
    }
  }

  async getCustomerTypeById(customerTypeId) {
    const customerType = await this.repository.findCustomerTypeById(customerTypeId);
    if (!customerType) {
      throw new NotFoundError('Customer type not found');
    }
    return new CustomerTypeDTO(customerType);
  }

  async createCustomerType(customerTypeData) {
    try {
      // Check if customer type with same name already exists (case-insensitive)
      const existingCustomerType = await this.repository.findCustomerTypeByName(
        customerTypeData.CustomerTypeName
      );
      if (existingCustomerType) {
        throw new ConflictError(
          `Customer type "${customerTypeData.CustomerTypeName}" already exists`
        );
      }

      const customerType = await this.repository.createCustomerType({
        customerTypeName: customerTypeData.CustomerTypeName,
      });
      logger.info('Customer type created', { id: customerType.customerTypeId });
      return new CustomerTypeDTO(customerType);
    } catch (error) {
      logger.error('Failed to create customer type', { error: error.message });
      throw error;
    }
  }

  async updateCustomerType(customerTypeId, updateData) {
    const existing = await this.repository.findCustomerTypeById(customerTypeId);
    if (!existing) {
      throw new NotFoundError('Customer type not found');
    }

    // Check if another customer type with same name already exists (case-insensitive)
    const duplicateCustomerType = await this.repository.findCustomerTypeByName(
      updateData.CustomerTypeName,
      customerTypeId
    );
    if (duplicateCustomerType) {
      throw new ConflictError(`Customer type "${updateData.CustomerTypeName}" already exists`);
    }

    const updated = await this.repository.updateCustomerType(customerTypeId, {
      customerTypeName: updateData.CustomerTypeName,
    });
    logger.info('Customer type updated', { id: customerTypeId });
    return new CustomerTypeDTO(updated);
  }

  async deleteCustomerType(customerTypeId) {
    const existing = await this.repository.findCustomerTypeById(customerTypeId);
    if (!existing) {
      throw new NotFoundError('Customer type not found');
    }

    // Prevent deletion of system customer types
    if (existing.isSystemType) {
      throw new ConflictError(
        `Cannot delete system customer type: ${existing.customerTypeName}. This type is essential for system operation.`
      );
    }

    await this.repository.deleteCustomerType(customerTypeId);
    logger.info('Customer type deleted', { id: customerTypeId });
  }

  async seedDefaultCustomerTypes() {
    const defaultTypes = [
      'BUILDER',
      'CONTRACTOR',
      'DEALER',
      'DIRECT CUSTOMER',
      'INDUSTRIAL',
    ];

    let seededCount = 0;
    for (const typeName of defaultTypes) {
      try {
        const existing = await this.repository.findCustomerTypeByName(typeName);
        if (existing) {
          // If exists but not marked as system type, update it
          if (!existing.isSystemType) {
            await this.repository.updateCustomerType(existing.customerTypeId, {
              isSystemType: true,
            });
            seededCount++;
          }
        } else {
          // Create new system type
          await this.repository.createCustomerType({
            customerTypeName: typeName,
            isSystemType: true,
          });
          seededCount++;
        }
      } catch (error) {
        logger.error(`Failed to seed customer type: ${typeName}`, { error: error.message });
      }
    }

    if (seededCount > 0) {
      logger.info(`Seeded ${seededCount} default customer types`);
    }
    return seededCount;
  }

  // Customer methods
  async getAllCustomers() {
    try {
      const customers = await this.repository.findAllCustomers();
      const enrichedCustomers = await this.enrichCustomersWithPostalDetails(customers);
      return enrichedCustomers.map(cust => new CustomerDTO(cust));
    } catch (error) {
      logger.error('Failed to fetch customers', { error: error.message });
      throw error;
    }
  }

  async getActiveCustomers() {
    try {
      const customers = await this.repository.findAllActiveCustomers();
      const enrichedCustomers = await this.enrichCustomersWithPostalDetails(customers);
      return enrichedCustomers.map(cust => new CustomerDTO(cust));
    } catch (error) {
      logger.error('Failed to fetch active customers', { error: error.message });
      throw error;
    }
  }

  /**
   * Get customers filtered by user ownership
   * Non-admin users only see customers they created or are assigned to
   * @param {Object} userContext - { employeeId, role, isAdmin }
   */
  async getCustomersForUser(userContext) {
    try {
      const customers = await this.repository.findCustomersForUser(userContext);
      const enrichedCustomers = await this.enrichCustomersWithPostalDetails(customers);
      return enrichedCustomers.map(cust => new CustomerDTO(cust));
    } catch (error) {
      logger.error('Failed to fetch customers for user', { error: error.message, userContext });
      throw error;
    }
  }

  async getCustomerById(customerId) {
    const customer = await this.repository.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    const enrichedCustomer = await this.enrichCustomerWithPostalDetails(customer);
    return new CustomerDTO(enrichedCustomer);
  }

  async createCustomer(customerData) {
    try {
      console.log('Service - Received customer data:', JSON.stringify(customerData, null, 2));

      // Validate required fields
      if (!customerData.ContactPerson || !customerData.ContactPerson.trim()) {
        throw new ConflictError('Contact Person is required');
      }

      // Validate SalesPersonID if provided
      let salesPersonId = null;
      if (customerData.SalesPersonID) {
        const employee = await this.repository.findEmployeeById(customerData.SalesPersonID);
        if (employee) {
          salesPersonId = customerData.SalesPersonID;
        } else {
          logger.warn('Invalid SalesPersonID provided, setting to null', {
            id: customerData.SalesPersonID,
          });
        }
      }

      // Collect all mobile numbers into an array (filter out null/undefined values)
      const mobileNumbers = [
        customerData.MobileNo,
        customerData.MobileNo2,
        customerData.MobileNo3,
      ].filter(num => num !== null && num !== undefined && num !== '');

      // Collect all country codes into an array (matching mobile numbers)
      const countryCodes = [
        customerData.CountryCode || '+91',
        customerData.MobileNo2 ? customerData.CountryCode2 || '+91' : null,
        customerData.MobileNo3 ? customerData.CountryCode3 || '+91' : null,
      ].filter(code => code !== null);

      // Check if any of the mobile numbers already exist
      for (const mobile of mobileNumbers) {
        if (!mobile) continue;
        const existingCustomer = await this.repository.findCustomerByMobileNo(mobile);
        if (existingCustomer) {
          throw new ConflictError(
            `Mobile number ${mobile} is already registered to ${existingCustomer.companyName}`
          );
        }
      }

      // Check if GST Number is unique (if provided)
      if (customerData.GSTNumber) {
        const existingCustomer = await this.repository.findCustomerByGST(customerData.GSTNumber);
        if (existingCustomer) {
          throw new ConflictError(
            `GST Number ${customerData.GSTNumber} is already registered to ${existingCustomer.companyName}`
          );
        }
      }

      const dbData = {
        companyName: customerData.CompanyName,
        contactPerson: customerData.ContactPerson,
        mobileNo: mobileNumbers.length > 0 ? mobileNumbers : [''], // Ensure at least one element for array
        countryCode: countryCodes.length > 0 ? countryCodes : ['+91'], // Ensure at least one element for array
        emailId: customerData.EmailID,
        location: customerData.Location,
        area: customerData.Area,
        address: customerData.Address,
        gstNumber: customerData.GSTNumber,
        pinCode: customerData.Pincode,
        salesPersonId,
        customerTypeId: customerData.CustomerTypeID || null,
        isActive: true, // Default to true on creation
        createdBy: customerData.CreatedBy || null, // Track who created this customer
        currentBalance: customerData.OpeningBalance || 0, // Set initial balance
      };
      console.log('Service - Transformed to DB format:', JSON.stringify(dbData, null, 2));
      const customer = await this.repository.createCustomer(dbData);
      logger.info('Customer created', { id: customer.customerId, createdBy: dbData.createdBy });
      return new CustomerDTO(customer);
    } catch (error) {
      logger.error('Failed to create customer', { error: error.message });
      throw error;
    }
  }

  async updateCustomer(customerId, updateData) {
    const existing = await this.repository.findCustomerById(customerId);
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    const updateFields = {};
    if (updateData.CompanyName !== undefined) updateFields.companyName = updateData.CompanyName;
    if (updateData.ContactPerson !== undefined) {
      if (!updateData.ContactPerson || !updateData.ContactPerson.trim()) {
        throw new ConflictError('Contact Person is required');
      }
      updateFields.contactPerson = updateData.ContactPerson;
    }

    // Handle mobile numbers array
    if (
      updateData.MobileNo !== undefined ||
      updateData.MobileNo2 !== undefined ||
      updateData.MobileNo3 !== undefined
    ) {
      const mobileNumbers = [
        updateData.MobileNo,
        updateData.MobileNo2,
        updateData.MobileNo3,
      ].filter(num => num !== null && num !== undefined && num !== '');

      // Collect all country codes into an array (matching mobile numbers)
      const countryCodes = [
        updateData.CountryCode || '+91',
        updateData.MobileNo2 ? updateData.CountryCode2 || '+91' : null,
        updateData.MobileNo3 ? updateData.CountryCode3 || '+91' : null,
      ].filter(code => code !== null);

      // Check if any of the new mobile numbers already exist (excluding current customer)
      for (const mobile of mobileNumbers) {
        if (!mobile) continue;
        const existingCustomer = await this.repository.findCustomerByMobileNo(mobile, customerId);
        if (existingCustomer) {
          throw new ConflictError(
            `Mobile number ${mobile} is already registered to ${existingCustomer.companyName}`
          );
        }
      }

      updateFields.mobileNo = mobileNumbers.length > 0 ? mobileNumbers : [''];
      updateFields.countryCode = countryCodes.length > 0 ? countryCodes : ['+91'];
    }

    if (updateData.EmailID !== undefined) updateFields.emailId = updateData.EmailID;
    if (updateData.Location !== undefined) updateFields.location = updateData.Location;
    if (updateData.Area !== undefined) updateFields.area = updateData.Area;
    if (updateData.Address !== undefined) updateFields.address = updateData.Address;

    if (updateData.GSTNumber !== undefined) {
      // Check if GST Number is unique (if provided and different from current)
      if (updateData.GSTNumber) {
        const existingCustomer = await this.repository.findCustomerByGST(
          updateData.GSTNumber,
          customerId
        );
        if (existingCustomer) {
          throw new ConflictError(
            `GST Number ${updateData.GSTNumber} is already registered to ${existingCustomer.companyName}`
          );
        }
      }
      updateFields.gstNumber = updateData.GSTNumber;
    }
    if (updateData.Pincode !== undefined) updateFields.pinCode = updateData.Pincode;
    if (updateData.SalesPersonID !== undefined)
      updateFields.salesPersonId = updateData.SalesPersonID;
    if (updateData.CustomerTypeID !== undefined)
      updateFields.customerTypeId = updateData.CustomerTypeID;
    if (updateData.IsActive !== undefined) updateFields.isActive = updateData.IsActive;

    const updated = await this.repository.updateCustomer(customerId, updateFields);
    logger.info('Customer updated', { id: customerId });
    return new CustomerDTO(updated);
  }

  async deleteCustomer(customerId) {
    const existing = await this.repository.findCustomerById(customerId);
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    await this.repository.deleteCustomer(customerId);
    logger.info('Customer deleted', { id: customerId });
  }

  /**
   * Transfer customer ownership to a new salesperson
   * Updates both createdBy and salesPersonId for customer and all their orders
   * @param {number} customerId - Customer to transfer
   * @param {number} newSalesPersonId - New salesperson ID
   * @returns {Promise<Object>} Result with updated customer and order count
   */
  async transferCustomer(customerId, newSalesPersonId) {
    try {
      // Validate customer exists
      const customer = await this.repository.findCustomerById(customerId);
      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      // Validate new salesperson exists
      const employee = await this.repository.findEmployeeById(newSalesPersonId);
      if (!employee) {
        throw new NotFoundError('Salesperson not found');
      }

      // Transfer customer
      const updatedCustomer = await this.repository.transferCustomer(customerId, newSalesPersonId);

      // Transfer all orders for this customer
      const ordersUpdated = await this.repository.transferCustomerOrders(
        customerId,
        newSalesPersonId
      );

      logger.info('Customer transferred', {
        customerId,
        newSalesPersonId,
        ordersUpdated,
        previousOwner: customer.createdBy,
      });

      return {
        customer: new CustomerDTO(updatedCustomer),
        ordersTransferred: ordersUpdated,
      };
    } catch (error) {
      logger.error('Failed to transfer customer', {
        error: error.message,
        customerId,
        newSalesPersonId,
      });
      throw error;
    }
  }

  // Role methods
  async getAllRoles() {
    try {
      const roles = await this.repository.findAllRoles();
      return roles;
    } catch (error) {
      logger.error('Failed to fetch roles', { error: error.message });
      throw error;
    }
  }

  async getRoleById(roleId) {
    const role = await this.repository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return role;
  }

  async createRole(roleData) {
    try {
      const existingRole = await this.repository.findRoleByName(roleData.roleName);
      if (existingRole) {
        throw new ConflictError(`Role "${roleData.roleName}" already exists`);
      }

      const role = await this.repository.createRole({
        roleName: roleData.roleName,
        description: roleData.description || null,
        landingPage: roleData.landingPage || '/dashboard',
        isActive: roleData.isActive !== false,
      });
      logger.info('Role created', { id: role.roleId });
      return role;
    } catch (error) {
      logger.error('Failed to create role', { error: error.message });
      throw error;
    }
  }

  async updateRole(roleId, updateData) {
    const existing = await this.repository.findRoleById(roleId);
    if (!existing) {
      throw new NotFoundError('Role not found');
    }

    // Check if updating to existing name
    if (updateData.roleName && updateData.roleName !== existing.roleName) {
      const duplicate = await this.repository.findRoleByName(updateData.roleName);
      if (duplicate) {
        throw new ConflictError(`Role "${updateData.roleName}" already exists`);
      }
    }

    const updateFields = {};

    // Check for protected roles by name
    const protectedRoleNames = ['Admin', 'Administrator', 'SuperAdmin', 'Dealer'];
    if (protectedRoleNames.includes(existing.roleName) || (updateData.roleName && protectedRoleNames.includes(updateData.roleName))) {
      // Only allow specific updates or block completely? The requirement says "uneditable", so block.
      // However, we might want to allow updating description or landing page? 
      // "also uneditable" implies completely. 
      // But wait, system roles might need some updates? 
      // For now, I'll block any update if it is a protected role.
      throw new ConflictError(`Cannot update protected role: ${existing.roleName}`);
    }
    if (updateData.roleName !== undefined) updateFields.roleName = updateData.roleName;
    if (updateData.description !== undefined) updateFields.description = updateData.description;
    if (updateData.landingPage !== undefined) updateFields.landingPage = updateData.landingPage;
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive;

    const updated = await this.repository.updateRole(roleId, updateFields);
    logger.info('Role updated', { id: roleId });
    return updated;
  }

  async deleteRole(roleId) {
    const existing = await this.repository.findRoleById(roleId);
    if (!existing) {
      throw new NotFoundError('Role not found');
    }

    // Prevent deletion of system roles
    if (existing.isSystemRole) {
      throw new ConflictError('Cannot delete system roles');
    }

    // Check for protected roles by name
    const protectedRoleNames = ['Admin', 'Administrator', 'SuperAdmin', 'Dealer'];
    if (protectedRoleNames.includes(existing.roleName)) {
      throw new ConflictError(`Cannot delete protected role: ${existing.roleName}`);
    }

    // Check if role is in use
    const usersWithRole = await this.repository.countUsersWithRole(roleId);
    if (usersWithRole > 0) {
      throw new ConflictError(
        `Cannot delete role - ${usersWithRole} user(s) are assigned to this role`
      );
    }

    await this.repository.deleteRole(roleId);
    logger.info('Role deleted', { id: roleId });
  }
}
