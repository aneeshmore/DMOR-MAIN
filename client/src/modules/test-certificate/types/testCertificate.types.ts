export interface TestCertificateResult {
  id?: number;
  propertyName: string;
  resultValue: string;
  specification?: string;
  sortOrder: number;
  checked?: boolean;
}

export interface TestCertificate {
  id?: number;
  certificateNo: string;
  batchId: number;
  batchNumber: string;
  productName: string;
  colour: string;
  manufacturingDate?: string;
  testingDate: string;
  remarks: string;
  status: 'Draft' | 'Approved';
  createdBy?: number;
  creatorName?: string;
  createdAt?: string;
  updatedAt?: string;
  results: TestCertificateResult[];
}

export interface CompletedBatch {
  batchId: number;
  batchNo: string;
  masterProductId: number;
  productName: string;
  productCode: string;
  colour: string;
  manufacturingDate: string;
  actualQuantity: number;
  actualDensity?: number | null;
  actualViscosity?: number | null;
  totalSolid?: number | null;
  customerName: string;
}
