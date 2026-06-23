export class TestCertificateDTO {
  constructor(data) {
    this.id = data.id;
    this.certificateNo = data.certificateNo;
    this.batchId = data.batchId;
    this.batchNumber = data.batchNumber;
    this.productName = data.productName;
    this.colour = data.colour;
    this.manufacturingDate = data.manufacturingDate;
    this.testingDate = data.testingDate;
    this.remarks = data.remarks || '';
    this.status = data.status;
    this.createdBy = data.createdBy;
    this.creatorName = data.creatorName || '';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    // Test Results Grid
    this.results = Array.isArray(data.results)
      ? data.results.map(r => ({
          id: r.id,
          propertyName: r.propertyName,
          resultValue: r.resultValue,
          specification: r.specification || '',
          sortOrder: r.sortOrder,
          checked: true,
        }))
      : [];
  }

  static fromDatabase(row) {
    if (!row) return null;

    // Handle query returning joined results
    const cert = row.test_certificates || row;
    const creator = row.creator;
    const results = row.results || [];

    let colour = cert.colour;
    if (row.colourResultValue !== undefined && row.colourResultValue !== null) {
      colour = row.colourResultValue;
    } else if (results && results.length > 0) {
      const colourRow = results.find(
        r => r.propertyName?.trim().toLowerCase() === 'colour / shade'
      );
      if (colourRow) {
        colour = colourRow.resultValue;
      }
    }

    return new TestCertificateDTO({
      ...cert,
      colour: colour || cert.colour || '-',
      creatorName: creator ? `${creator.firstName} ${creator.lastName}`.trim() : 'System',
      results,
    });
  }
}

export class CompletedBatchDTO {
  constructor(data) {
    this.batchId = data.batchId;
    this.batchNo = data.batchNo;
    this.masterProductId = data.masterProductId;
    this.productName = data.productName;
    this.productCode = data.productCode;
    this.colour = data.colour;
    this.manufacturingDate = data.manufacturingDate;
    this.actualQuantity = data.actualQuantity;
    this.actualDensity = data.actualDensity;
    this.actualViscosity = data.actualViscosity;
    this.totalSolid = data.totalSolid;
    this.customerName = data.customerName || 'Make to Stock';
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new CompletedBatchDTO({
      batchId: row.batchId,
      batchNo: row.batchNo,
      masterProductId: row.masterProductId,
      productName: row.productName,
      productCode: row.productCode,
      colour: row.colour,
      manufacturingDate: row.completedAt || row.scheduledDate,
      actualQuantity: row.actualQuantity ? parseFloat(row.actualQuantity) : 0,
      actualDensity: row.actualDensity ? parseFloat(row.actualDensity) : null,
      actualViscosity: row.actualViscosity ? parseFloat(row.actualViscosity) : null,
      totalSolid:
        row.totalSolid !== undefined && row.totalSolid !== null ? parseFloat(row.totalSolid) : null,
      customerName: row.customerName,
    });
  }
}
