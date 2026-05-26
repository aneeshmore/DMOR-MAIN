import { SuppliersRepository } from './repository.js';
import { SupplierDTO } from './dto.js';
import { NotFoundError, ValidationError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';

export class SuppliersService {
  constructor() {
    this.repository = new SuppliersRepository();
  }

  async getAllSuppliers(filters = {}) {
    try {
      const suppliers = await this.repository.findAll(filters);
      return suppliers.map(s => new SupplierDTO(s));
    } catch (error) {
      logger.error('Failed to fetch suppliers', { error: error.message });
      throw error;
    }
  }

  async getSupplierById(supplierId) {
    const supplier = await this.repository.findById(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    return new SupplierDTO(supplier);
  }

  async createSupplier(supplierData) {
    // Check if supplier name already exists (normalized, active-only)
    logger.info(`[Supplier] Duplicate check for create — name: "${supplierData.supplierName}"`);
    const existing = await this.repository.findByName(supplierData.supplierName);
    logger.info(`[Supplier] Duplicate found: ${!!existing}`);
    if (existing) {
      // Log exact matching row for production diagnostics
      logger.info(`[Supplier] Existing duplicate row: ${JSON.stringify(existing)}`);
      throw new ValidationError(
        `Supplier already exists (ID: ${existing.supplierId}, Name: ${existing.supplierName})`
      );
    }

    const supplier = await this.repository.create(supplierData);
    logger.info('Supplier created', { supplierId: supplier.supplierId });
    return new SupplierDTO(supplier);
  }

  async updateSupplier(supplierId, updateData) {
    const existing = await this.repository.findById(supplierId);
    if (!existing) {
      throw new NotFoundError('Supplier not found');
    }

    // If updating name, check for duplicates (exclude current supplier by id)
    if (updateData.supplierName) {
      logger.info(
        `[Supplier] Duplicate check for update — name: "${updateData.supplierName}", excludeId: ${supplierId}`
      );
      const duplicate = await this.repository.findByName(updateData.supplierName, supplierId);
      logger.info(`[Supplier] Duplicate found: ${!!duplicate}`);
      if (duplicate) {
        // Log exact matching row for production diagnostics
        logger.info(`[Supplier] Existing duplicate row: ${JSON.stringify(duplicate)}`);
        throw new ValidationError(
          `Supplier already exists (ID: ${duplicate.supplierId}, Name: ${duplicate.supplierName})`
        );
      }
    }

    const supplier = await this.repository.update(supplierId, updateData);
    logger.info('Supplier updated', { supplierId });
    return new SupplierDTO(supplier);
  }

  async deleteSupplier(supplierId) {
    const existing = await this.repository.findById(supplierId);
    if (!existing) {
      throw new NotFoundError('Supplier not found');
    }

    const dependencies = await this.repository.findSupplierDependencies(supplierId);
    if (dependencies.length > 0) {
      throw new ValidationError(dependencies[0].message);
    }

    await this.repository.delete(supplierId);
    logger.info('Supplier deleted (soft)', { supplierId });
  }
}
