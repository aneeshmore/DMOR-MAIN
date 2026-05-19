export interface CompanyInfo {
  companyId?: number;
  companyName: string;
  logoUrl?: string; // Text URL for now
  address?: string;
  factoryAddress?: string;
  gstNumber?: string;
  email?: string;
  contactNumber?: string;
  panNumber?: string;
  // Bank Details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  termsAndConditions?: string;

  udyamRegistrationNumber?: string;
  pincode?: string;
  state?: string;
  cgst?: string;
  sgst?: string;
  igst?: string;

  updatedAt?: string;
}
