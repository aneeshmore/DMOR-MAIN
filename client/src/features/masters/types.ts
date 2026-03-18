// ============================================
// MASTER DATA TYPES
// ============================================

export interface Department {
  DepartmentID: number;
  DepartmentName: string;
  IsSystemDepartment?: boolean;
  DepartmentHeadID?: number;
  Status?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface Designation {
  DesignationID: number;
  DesignationName: string;
  Description?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface Unit {
  UnitID: number;
  UnitName: string;
  UnitSymbol?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface CustomerType {
  CustomerTypeID: number;
  CustomerTypeName: string;
  IsSystemType?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface MasterProduct {
  MasterProductID: number;
  CategoryName: string;
  Description?: string;
  CreatedAt?: string;
}

export interface Customer {
  CustomerID: number;
  CustomerUUID?: string;
  CompanyName: string;
  ContactPerson: string;
  MobileNo?: string;
  MobileNo2?: string;
  MobileNo3?: string;
  CountryCode?: string;
  CountryCode2?: string;
  CountryCode3?: string;
  EmailID?: string;
  Location?: string;
  State?: string;
  Area?: string;
  Address?: string;
  GSTNumber?: string;
  Pincode?: string;
  IsActive: boolean;
  OpeningBalance?: number;
  currentBalance?: number;
  SalesPersonID?: number;
  SalesPersonName?: string;
  CustomerTypeID?: number;
  CustomerTypeName?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}
