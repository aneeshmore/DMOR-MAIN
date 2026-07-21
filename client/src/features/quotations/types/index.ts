export interface QuotationItem {
  id: number;
  description: string;
  productId?: number;
  hsn: string;
  dueOn: string;
  quantity: number;
  rate: number;
  per: string;
  discount: number;
  cgstRate?: number;
  sgstRate?: number;
}

export interface QuotationData {
  quotationNo: string;
  date: string;
  paymentTerms: string;
  deliveryTerms: string;
  buyerRef: string;
  otherRef: string;
  dispatchThrough: string;
  destination: string;
  validTillDays?: string | number;

  companyName: string;
  companyLogo?: string;
  companyAddress: string;
  companyGSTIN: string;
  companyState: string;
  companyCode: string;
  companyEmail: string;
  companyPhone?: string;
  companyWeb?: string;
  companyPAN?: string;
  termsAndConditions?: string;

  udyamRegistrationNumber?: string;
  companyPincode?: string;
  companyCGST?: string;
  companySGST?: string;
  companyIGST?: string;

  // Buyer/Customer Information
  buyerName?: string;
  buyerAddress?: string;
  buyerGSTIN?: string;
  buyerState?: string;

  // Customer address (for Create Order integration)
  customerAddress?: string;
  customerId?: number;

  items: QuotationItem[];
  cgstTotal?: number;
  sgstTotal?: number;

  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  status?: string;
  remarks?: string;
}

export interface QuotationRecord {
  quotationId: number;
  quotationNo: string;
  quotationDate: string;
  companyName: string;
  buyerName: string;
  customerId?: number;
  content: QuotationData;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Converted';
  rejectionRemark?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}
