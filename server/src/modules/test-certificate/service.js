import { TestCertificateRepository } from './repository.js';
import { TestCertificateDTO, CompletedBatchDTO } from './dto.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Extracts standard colour names from product titles.
 */
export function parseColour(productName) {
  if (!productName) return 'Standard';
  const knownColours = [
    'White',
    'Black',
    'Red',
    'Blue',
    'Green',
    'Yellow',
    'Grey',
    'Gray',
    'Brown',
    'Orange',
    'Pink',
    'Purple',
    'Golden',
    'Olive',
    'Silver',
    'Bronze',
    'Clear',
  ];

  // Look for exact word boundary match
  const matched = knownColours.find(colour => new RegExp(`\\b${colour}\\b`, 'i').test(productName));

  return matched ? matched : 'Standard';
}

/**
 * Generates an uppercase initials code for a product.
 * e.g., "Interior Premium Emulsion" -> "IPE", "PU Enamel Black" -> "PUEB"
 */
export function generateProductCode(productName) {
  if (!productName) return 'PROD';

  // Clean volume strings (e.g., "- 20L", "25KG Bag", "4L", "1L")
  const cleanName = productName.replace(/-\s*\d+\s*(L|KG|Ltr|Kg|G|Gm|Bag|Drum)\b/gi, '').trim();

  const parts = cleanName.split(/\s+/);
  if (parts.length > 1) {
    const code = parts
      .map(p => p[0])
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return code || 'PROD';
  }

  return cleanName
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Increments the sequence portion of a certificate number to ensure uniqueness.
 * Format: TC/{PRODUCT_CODE}/{BATCH_NUMBER}/{YEAR}
 */
export function incrementCertificateNo(certificateNo) {
  const match = certificateNo.match(/^TC\/([^/]+)\/(.+)\/([^/]+)$/);
  if (!match) {
    return `${certificateNo}-1`;
  }

  const productCode = match[1];
  const batchNumber = match[2];
  const year = match[3];

  // Pattern 1: Leading digits in batchNumber, e.g. "0024-05-2026"
  const leadingDigitsMatch = batchNumber.match(/^(\d+)(.*)$/);
  if (leadingDigitsMatch) {
    const digitsStr = leadingDigitsMatch[1];
    const rest = leadingDigitsMatch[2];
    const nextNum = parseInt(digitsStr, 10) + 1;
    const nextDigitsStr = String(nextNum).padStart(digitsStr.length, '0');
    const nextBatch = nextDigitsStr + rest;
    return `TC/${productCode}/${nextBatch}/${year}`;
  }

  // Pattern 2: Suffix digits in batchNumber, e.g. "BATCH-1"
  const suffixDigitsMatch = batchNumber.match(/^(.*)-(\d+)$/);
  if (suffixDigitsMatch) {
    const prefix = suffixDigitsMatch[1];
    const digitsStr = suffixDigitsMatch[2];
    const nextNum = parseInt(digitsStr, 10) + 1;
    const nextDigitsStr = String(nextNum).padStart(digitsStr.length, '0');
    const nextBatch = `${prefix}-${nextDigitsStr}`;
    return `TC/${productCode}/${nextBatch}/${year}`;
  }

  // Fallback pattern: append "-1" to batchNumber
  return `TC/${productCode}/${batchNumber}-1/${year}`;
}

export class TestCertificateService {
  constructor() {
    this.repository = new TestCertificateRepository();
  }

  /**
   * List test certificates for the company/tenant
   */
  async getTestCertificatesList(filters, companyId, tenantId) {
    const rows = await this.repository.getTestCertificates(filters, companyId, tenantId);
    return rows.map(row => TestCertificateDTO.fromDatabase(row));
  }

  /**
   * Get specific certificate details
   */
  async getTestCertificateDetails(id, companyId, tenantId) {
    const row = await this.repository.getTestCertificateById(id, companyId, tenantId);
    if (!row) {
      throw new AppError('Test certificate not found or access denied', 404);
    }
    return TestCertificateDTO.fromDatabase(row);
  }

  /**
   * Create a new test certificate
   */
  async createTestCertificate(data, user, companyId, tenantId) {
    // Generate certificate number: TC/{PRODUCT_CODE}/{BATCH_NO}/{YEAR}
    const productCode = generateProductCode(data.productName);
    const dateToUse = data.testingDate ? new Date(data.testingDate) : new Date();
    const year = dateToUse.getFullYear();
    const baseCertificateNo = `TC/${productCode}/${data.batchNumber}/${year}`;

    // Ensure uniqueness by checking existence and incrementing the certificate number sequence if necessary
    let certificateNo = baseCertificateNo;
    while (true) {
      const exists = await this.repository.checkCertificateNoExists(
        certificateNo,
        companyId,
        tenantId
      );
      if (!exists) {
        break;
      }
      certificateNo = incrementCertificateNo(certificateNo);
    }

    const payload = {
      ...data,
      certificateNo,
      createdBy: user?.employeeId || null,
      colour: data.colour || parseColour(data.productName),
    };

    try {
      const newCert = await this.repository.createTestCertificate(payload, companyId, tenantId);
      return newCert;
    } catch (err) {
      if (err.code === '23505') {
        // Unique constraint violation in Postgres (race condition fallback)
        throw new AppError(`A test certificate for batch ${data.batchNumber} already exists.`, 400);
      }
      throw err;
    }
  }

  /**
   * Update an existing certificate (in Draft status)
   */
  async updateTestCertificate(id, data, companyId, tenantId) {
    const existing = await this.repository.getTestCertificateById(id, companyId, tenantId);
    if (!existing) {
      throw new AppError('Test certificate not found or access denied', 404);
    }

    if (existing.test_certificates.status === 'Approved') {
      throw new AppError('Cannot update an Approved test certificate', 400);
    }

    const payload = {
      ...data,
      colour: data.colour || parseColour(existing.test_certificates.productName),
    };

    return await this.repository.updateTestCertificate(id, payload, companyId, tenantId);
  }

  /**
   * Delete a certificate
   */
  async deleteTestCertificate(id, companyId, tenantId) {
    return await this.repository.deleteTestCertificate(id, companyId, tenantId);
  }

  /**
   * Get all completed production batches with parsed product codes and colours
   */
  async getCompletedBatches(_companyId, _tenantId) {
    const rows = await this.repository.getCompletedBatches();
    const solidsMap = await this.repository.getLatestTotalSolidsMap();

    return rows.map(row => {
      const productCode = generateProductCode(row.productName);
      const colour = parseColour(row.productName);
      const totalSolid = solidsMap.get(row.masterProductId) ?? null;
      return CompletedBatchDTO.fromDatabase({
        ...row,
        productCode,
        colour,
        totalSolid,
      });
    });
  }

  /**
   * Get details of a single completed production batch
   */
  async getCompletedBatchDetails(batchId, _companyId, _tenantId) {
    const row = await this.repository.getCompletedBatchById(batchId);
    if (!row) {
      throw new AppError('Completed production batch not found', 404);
    }

    const productCode = generateProductCode(row.productName);
    const colour = parseColour(row.productName);
    const solidsMap = await this.repository.getLatestTotalSolidsMap();
    const totalSolid = solidsMap.get(row.masterProductId) ?? null;

    return CompletedBatchDTO.fromDatabase({
      ...row,
      productCode,
      colour,
      totalSolid,
    });
  }
}
