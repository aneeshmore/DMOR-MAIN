export class DepartmentDTO {
  constructor(department) {
    this.DepartmentID = department.departmentId || department.department_id;
    this.DepartmentName = department.departmentName || department.department_name;
    this.IsSystemDepartment =
      department.isSystemDepartment ?? department.is_system_department ?? false;
    this.IsActive = department.isActive ?? department.is_active ?? true;
    this.CreatedAt = department.createdAt || department.created_at;
    this.UpdatedAt = department.updatedAt || department.updated_at;
  }
}

export class UnitDTO {
  constructor(unit) {
    this.UnitID = unit.unitId || unit.unit_id;
    this.UnitName = unit.unitName || unit.unit_name;
    this.CreatedAt = unit.createdAt || unit.created_at;
    this.UpdatedAt = unit.updatedAt || unit.updated_at;
  }
}

export class CustomerTypeDTO {
  constructor(customerType) {
    this.CustomerTypeID = customerType.customerTypeId || customerType.customer_type_id;
    this.CustomerTypeName = customerType.customerTypeName || customerType.customer_type_name;
    this.IsSystemType = customerType.isSystemType ?? customerType.is_system_type ?? false;
    this.CreatedAt = customerType.createdAt || customerType.created_at;
    this.UpdatedAt = customerType.updatedAt || customerType.updated_at;
  }
}

export class CustomerDTO {
  constructor(customer) {
    this.CustomerID = customer.customerId || customer.customer_id;
    this.CustomerUUID = customer.customerUuid || customer.customer_uuid;
    this.CompanyName = customer.companyName || customer.company_name;
    this.ContactPerson = customer.contactPerson || customer.contact_person;

    // Handle mobile numbers - database stores as array, frontend expects individual fields
    const mobileArray = customer.mobileNo || customer.mobile_no || [];
    this.MobileNo = Array.isArray(mobileArray) ? mobileArray[0] || '' : mobileArray;
    this.MobileNo2 = Array.isArray(mobileArray) ? mobileArray[1] || undefined : undefined;
    this.MobileNo3 = Array.isArray(mobileArray) ? mobileArray[2] || undefined : undefined;

    // Handle country codes - database stores as array, frontend expects individual fields
    const countryCodeArray = customer.countryCode || customer.country_code || [];
    this.CountryCode = Array.isArray(countryCodeArray)
      ? countryCodeArray[0] || '+91'
      : countryCodeArray || '+91';
    this.CountryCode2 = Array.isArray(countryCodeArray)
      ? countryCodeArray[1] || undefined
      : undefined;
    this.CountryCode3 = Array.isArray(countryCodeArray)
      ? countryCodeArray[2] || undefined
      : undefined;

    this.EmailID = customer.emailId || customer.email_id;
    this.Location = customer.location;
    this.District = customer.district || customer.District;
    this.State = customer.state || customer.State;
    this.Area = customer.area;
    this.Address = customer.address;
    this.GSTNumber = customer.gstNumber || customer.gst_number;
    this.Pincode = customer.pinCode || customer.pin_code;
    this.SalesPersonID = customer.salesPersonId || customer.sales_person_id;
    this.SalesPersonName = customer.salesPersonName;
    this.CustomerTypeID = customer.customerTypeId || customer.customer_type_id;
    this.CustomerTypeName = customer.customerTypeName || customer.customer_type_name || '';
    this.IsActive = customer.isActive ?? customer.is_active ?? true;
    this.CurrentBalance = customer.currentBalance || customer.current_balance || 0;
    this.CreatedBy = customer.createdBy;
    this.CreatedAt = customer.createdAt || customer.created_at;
    this.UpdatedAt = customer.updatedAt || customer.updated_at;
  }
}
