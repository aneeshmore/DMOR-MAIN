export class SupplierDTO {
  constructor(data) {
    this.supplierId = data.supplierId || data.supplier_id;
    this.supplierName = data.supplierName || data.supplier_name;
    this.contactPerson = data.contactPerson || data.contact_person || null;
    this.mobileNo = data.mobileNo || data.mobile_no || null;
    this.mobileNo2 = data.mobileNo2 || data.mobile_no2 || null;
    this.address = data.address || null;
    this.pincode = data.pincode || null;
    this.state = data.state || null;
    this.gstNo = data.gstNo || data.gst_no || null;
    this.creditDays = data.creditDays ?? data.credit_days ?? null;
    // Derive paymentTerms from creditDays for invoice generation
    // Use != null to distinguish from 0 (zero credit days is valid)
    this.paymentTerms =
      data.paymentTerms ||
      (this.creditDays != null && this.creditDays !== '' ? `${this.creditDays} Days` : null);
    this.isActive = data.isActive ?? data.is_active ?? true;
    // Set by the service for list responses; defaults to true so single-record
    // responses and existing consumers keep their previous behaviour.
    this.isDeletable = data.isDeletable ?? true;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }
}
