import { MasterProductsRepository } from './repository.js';
import { MasterProductDTO, ProductDTO } from './dto.js';
import { NotFoundError, ValidationError } from '../../utils/AppError.js';
import logger from '../../config/logger.js';

export class MasterProductsService {
  constructor() {
    this.repository = new MasterProductsRepository();
  }

  // Master Products methods
  async getAllMasterProducts(filters = {}) {
    try {
      const masterProducts = await this.repository.findAllMasterProducts(filters);
      return masterProducts.map(mp => new MasterProductDTO(mp));
    } catch (error) {
      logger.error('Failed to fetch master products', { error: error.message });
      throw error;
    }
  }

  async getMasterProductById(masterProductId) {
    const masterProduct = await this.repository.findMasterProductById(masterProductId);
    if (!masterProduct) {
      throw new NotFoundError('Master product not found');
    }
    return new MasterProductDTO(masterProduct);
  }

  /**
   * System-controlled default unit per product type:
   * FG -> NO, RM -> KG, PM -> NO.
   * The client-provided unit is always ignored.
   */
  async resolveDefaultUnitId(productType) {
    const unitName = productType === 'RM' ? 'KG' : 'NO';
    return await this.repository.getUnitIdByName(unitName);
  }

  async createMasterProduct(masterProductData) {
    try {
      // Unit is derived from Product Type — never taken from the client
      const defaultUnitId = await this.resolveDefaultUnitId(masterProductData.ProductType);

      // Create the master product first
      const masterProduct = await this.repository.createMasterProduct({
        masterProductName: masterProductData.MasterProductName,
        productType: masterProductData.ProductType,
        description: masterProductData.Description,
        defaultUnitId,
        gst:
          masterProductData.GST !== undefined && masterProductData.GST !== null
            ? masterProductData.GST.toString()
            : null,
        isActive: true,
      });

      const masterProductId = masterProduct.masterProductId;

      // Create type-specific subtype record
      if (masterProductData.ProductType === 'FG') {
        await this.repository.createMasterProductFG(masterProductId, {
          defaultPackagingType: masterProductData.DefaultPackagingType,
          purchaseCost: masterProductData.PurchaseCost || null,
          availableQty: masterProductData.AvailableQty || null,
          subcategory: masterProductData.Subcategory || 'General',
          hardenerId: masterProductData.HardenerID || null,
          hsnCode: masterProductData.HSNCode || null,
        });
      } else if (masterProductData.ProductType === 'RM') {
        await this.repository.createMasterProductRM(masterProductId, {
          rmDensity: masterProductData.RMDensity,
          rmSolids: masterProductData.RMSolids,
          stockQuantity: masterProductData.StockQuantity || 0,
          purchaseCost: masterProductData.PurchaseCost || null,
          availableQty: masterProductData.AvailableQty || null,
          canBeAddedMultipleTimes: masterProductData.CanBeAddedMultipleTimes || false,
          subcategory: masterProductData.Subcategory || 'General',
          solidDensity: masterProductData.SolidDensity || null,
          oilAbsorption: masterProductData.OilAbsorption || null,
          hsnCode: masterProductData.HSNCode || null,
        });
      } else if (masterProductData.ProductType === 'PM') {
        await this.repository.createMasterProductPM(masterProductId, {
          capacity: masterProductData.Capacity,
          stockQuantity: masterProductData.StockQuantity || 0,
          purchaseCost: masterProductData.PurchaseCost || null,
          availableQty: masterProductData.AvailableQty || null,
          hsnCode: masterProductData.HSNCode || null,
        });
      }

      logger.info('Master product created', { id: masterProductId });

      // Fetch the complete product with subtype details
      const completeProduct = await this.repository.findMasterProductById(masterProductId);
      return new MasterProductDTO(completeProduct);
    } catch (error) {
      logger.error('Failed to create master product', { error: error.message });
      throw error;
    }
  }

  async updateMasterProduct(masterProductId, updateData) {
    const existing = await this.repository.findMasterProductById(masterProductId);
    if (!existing) {
      throw new NotFoundError('Master product not found');
    }

    const masterProduct = existing.masterProduct || existing;
    const productType = masterProduct.productType || masterProduct.product_type;

    // Update master product fields
    const updateFields = {};
    if (updateData.MasterProductName !== undefined)
      updateFields.masterProductName = updateData.MasterProductName;
    if (updateData.Description !== undefined) updateFields.description = updateData.Description;
    // Unit is system-controlled (FG/PM -> NO, RM -> KG) and never client-editable.
    // Product type is immutable here, so an existing valid unit is preserved;
    // legacy records without a unit are backfilled from their product type.
    const existingUnitId = masterProduct.defaultUnitId ?? masterProduct.default_unit_id;
    if (existingUnitId === null || existingUnitId === undefined) {
      updateFields.defaultUnitId = await this.resolveDefaultUnitId(productType);
    }
    if (updateData.IsActive !== undefined) updateFields.isActive = updateData.IsActive;
    if (updateData.GST !== undefined)
      updateFields.gst = updateData.GST !== null ? updateData.GST.toString() : null;

    if (Object.keys(updateFields).length > 0) {
      await this.repository.updateMasterProduct(masterProductId, updateFields);
    }

    // Update type-specific subtype record

    if (
      productType === 'FG' &&
      (updateData.DefaultPackagingType !== undefined ||
        updateData.PurchaseCost !== undefined ||
        updateData.AvailableQty !== undefined ||
        updateData.Subcategory !== undefined ||
        updateData.HardenerID !== undefined ||
        updateData.HSNCode !== undefined)
    ) {
      const fgData = {};
      if (updateData.DefaultPackagingType !== undefined)
        fgData.defaultPackagingType = updateData.DefaultPackagingType;
      if (updateData.PurchaseCost !== undefined) fgData.purchaseCost = updateData.PurchaseCost;
      if (updateData.AvailableQty !== undefined) fgData.availableQty = updateData.AvailableQty;
      if (updateData.Subcategory !== undefined) fgData.subcategory = updateData.Subcategory;
      if (updateData.HardenerID !== undefined) fgData.hardenerId = updateData.HardenerID;
      if (updateData.HSNCode !== undefined) fgData.hsnCode = updateData.HSNCode;

      if (Object.keys(fgData).length > 0) {
        await this.repository.updateMasterProductFG(masterProductId, fgData);
      }
    } else if (
      productType === 'RM' &&
      (updateData.RMDensity !== undefined ||
        updateData.RMSolids !== undefined ||
        updateData.StockQuantity !== undefined ||
        updateData.PurchaseCost !== undefined ||
        updateData.AvailableQty !== undefined ||
        updateData.CanBeAddedMultipleTimes !== undefined ||
        updateData.Subcategory !== undefined ||
        updateData.SolidDensity !== undefined ||
        updateData.OilAbsorption !== undefined ||
        updateData.HSNCode !== undefined)
    ) {
      const rmData = {};
      if (updateData.RMDensity !== undefined) rmData.rmDensity = updateData.RMDensity;
      if (updateData.RMSolids !== undefined) rmData.rmSolids = updateData.RMSolids;
      if (updateData.StockQuantity !== undefined) rmData.stockQuantity = updateData.StockQuantity;
      if (updateData.PurchaseCost !== undefined) rmData.purchaseCost = updateData.PurchaseCost;
      if (updateData.AvailableQty !== undefined) rmData.availableQty = updateData.AvailableQty;
      if (updateData.CanBeAddedMultipleTimes !== undefined)
        rmData.canBeAddedMultipleTimes = updateData.CanBeAddedMultipleTimes;
      if (updateData.Subcategory !== undefined) rmData.subcategory = updateData.Subcategory;
      if (updateData.SolidDensity !== undefined) rmData.solidDensity = updateData.SolidDensity;
      if (updateData.OilAbsorption !== undefined) rmData.oilAbsorption = updateData.OilAbsorption;
      if (updateData.HSNCode !== undefined) rmData.hsnCode = updateData.HSNCode;

      if (Object.keys(rmData).length > 0) {
        await this.repository.updateMasterProductRM(masterProductId, rmData);
      }
    } else if (
      productType === 'PM' &&
      (updateData.Capacity !== undefined ||
        updateData.StockQuantity !== undefined ||
        updateData.PurchaseCost !== undefined ||
        updateData.AvailableQty !== undefined ||
        updateData.HSNCode !== undefined)
    ) {
      const pmData = {};
      if (updateData.Capacity !== undefined) pmData.capacity = updateData.Capacity;
      if (updateData.StockQuantity !== undefined) pmData.stockQuantity = updateData.StockQuantity;
      if (updateData.PurchaseCost !== undefined) pmData.purchaseCost = updateData.PurchaseCost;
      if (updateData.AvailableQty !== undefined) pmData.availableQty = updateData.AvailableQty;
      if (updateData.HSNCode !== undefined) pmData.hsnCode = updateData.HSNCode;

      if (Object.keys(pmData).length > 0) {
        await this.repository.updateMasterProductPM(masterProductId, pmData);
      }
    }

    logger.info('Master product updated', { id: masterProductId });

    // Fetch the complete updated product
    const updated = await this.repository.findMasterProductById(masterProductId);
    return new MasterProductDTO(updated);
  }

  async deleteMasterProduct(masterProductId) {
    const existing = await this.repository.findMasterProductById(masterProductId);
    if (!existing) {
      throw new NotFoundError('Master product not found');
    }

    // Check for linked active sub-products or packaging usage
    const linkedCount = await this.repository.countLinkedProducts(masterProductId);
    if (linkedCount > 0) {
      throw new ValidationError(
        `Cannot delete Master Product because it is linked to ${linkedCount} active sub-products or used as packaging.`
      );
    }

    await this.repository.deleteMasterProduct(masterProductId);
    logger.info('Master product deleted', { id: masterProductId });
  }

  // Products methods
  async getAllProducts(filters = {}) {
    try {
      const products = await this.repository.findAllProducts(filters);
      return products.map(p => new ProductDTO(p));
    } catch (error) {
      logger.error('Failed to fetch products', { error: error.message });
      throw error;
    }
  }

  async getProductById(productId) {
    const product = await this.repository.findProductById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    return new ProductDTO(product);
  }

  async getProductsByType(productType) {
    const validTypes = ['FG', 'RM', 'PM', 'ALL'];
    if (!validTypes.includes(productType)) {
      throw new ValidationError('Invalid product type');
    }

    if (productType === 'ALL') {
      // 1. Get all FG SKUs
      const fgProducts = await this.getAllProducts({ productType: 'FG' });

      // 2. Get RM and PM Master Products
      const rmMasters = await this.repository.findAllMasterProducts({ productType: 'RM' });
      const pmMasters = await this.repository.findAllMasterProducts({ productType: 'PM' });

      // 3. Format RM/PM to match Product structure
      const formatMaster = mp => ({
        productId: mp.masterProduct?.masterProductId,
        ProductID: mp.masterProduct?.masterProductId,
        productName: mp.masterProduct?.masterProductName,
        ProductName: mp.masterProduct?.masterProductName,
        masterProductName: mp.masterProduct?.masterProductName,
        productType: mp.masterProduct?.productType,
        ProductType: mp.masterProduct?.productType,
        availableQuantity:
          mp.masterProduct?.productType === 'RM'
            ? mp.rmDetails?.availableQty || 0
            : mp.pmDetails?.availableQty || 0,
        availableWeightKg:
          mp.masterProduct?.productType === 'RM'
            ? parseFloat(mp.rmDetails?.availableQty || 0)
            : null,
        minStockLevel: mp.masterProduct?.minStockLevel || 0,
        isActive: mp.masterProduct?.isActive,
      });

      const formattedRMs = rmMasters.map(formatMaster);
      const formattedPMs = pmMasters.map(formatMaster);

      return [...fgProducts, ...formattedRMs, ...formattedPMs];
    }

    if (productType === 'FG') {
      return await this.getAllProducts({ productType });
    } else {
      // For RM and PM, return master products formatted like products
      const masterProductsData = await this.repository.findAllMasterProducts({ productType });

      return masterProductsData.map(mp => ({
        productId: mp.masterProduct?.masterProductId,
        ProductID: mp.masterProduct?.masterProductId,
        productName: mp.masterProduct?.masterProductName,
        ProductName: mp.masterProduct?.masterProductName,
        masterProductName: mp.masterProduct?.masterProductName,
        productType: mp.masterProduct?.productType,
        ProductType: mp.masterProduct?.productType,
        availableQuantity:
          productType === 'RM' ? mp.rmDetails?.availableQty || 0 : mp.pmDetails?.availableQty || 0,
        availableWeightKg:
          productType === 'RM' ? parseFloat(mp.rmDetails?.availableQty || 0) : null,
        minStockLevel: mp.masterProduct?.minStockLevel || 0,
        isActive: mp.masterProduct?.isActive,
      }));
    }
  }

  async getLowStockProducts() {
    try {
      const products = await this.repository.findLowStockProducts();
      return products.map(p => new ProductDTO(p));
    } catch (error) {
      logger.error('Failed to fetch low stock products', { error: error.message });
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      // 1. Validate and Fetch Master Product (FG)
      if (!productData.MasterProductID) {
        throw new ValidationError('Master Product ID is required');
      }

      const masterProductOriginal = await this.repository.findMasterProductById(
        productData.MasterProductID
      );

      if (!masterProductOriginal) {
        throw new NotFoundError('Master product not found');
      }

      const masterProduct = masterProductOriginal.masterProduct || masterProductOriginal;
      const fgDetails = masterProductOriginal.fgDetails;

      if (masterProduct.productType !== 'FG') {
        throw new ValidationError(
          `Cannot create SKU for ${masterProduct.productType} master product. Only FG master products can have SKUs.`
        );
      }

      // 2. Validate and Fetch Packaging Material (PM)
      if (!productData.PackagingId) {
        throw new ValidationError('Packaging (Packed In) is required');
      }

      const pmOriginal = await this.repository.findMasterProductById(productData.PackagingId);
      if (!pmOriginal) {
        throw new NotFoundError('Packaging Material not found');
      }

      const pmDetails = pmOriginal.pmDetails;
      if (!pmDetails) {
        throw new ValidationError('Selected packaging does not have valid PM details');
      }

      // 3. Calculate Package Capacity (Kg) and get Packaging Capacity from PM
      // Formula: Package Capacity (Kg) = PM Capacity * FG Density
      const fgDensity = parseFloat(fgDetails?.fgDensity || 0);
      const pmCapacity = parseFloat(pmDetails?.capacity || 0);
      const calculatedCapacityKg = pmCapacity * fgDensity;

      // Packaging Capacity = PM's capacity (in liters)
      const packagingCapacity = pmCapacity;

      // Filling Density: Use provided value OR default to FG Density
      const fillingDensity =
        productData.FillingDensity !== undefined
          ? parseFloat(productData.FillingDensity)
          : fgDensity;

      // Is FD Sync With Density: Read from frontend, explicitly convert to boolean
      // Log for debugging
      logger.info('IsFdSyncWithDensity from frontend:', {
        rawValue: productData.IsFdSyncWithDensity,
        typeOf: typeof productData.IsFdSyncWithDensity,
      });

      // Handle different possible values (true, false, 'true', 'false', undefined)
      let isFdSyncWithDensity = true; // Default
      if (productData.IsFdSyncWithDensity !== undefined) {
        isFdSyncWithDensity =
          productData.IsFdSyncWithDensity === true || productData.IsFdSyncWithDensity === 'true';
      }

      // 4. Determine Unit ID
      // Use provided UnitID or fallback to Master Product's default unit
      const unitId = productData.UnitID || masterProduct.defaultUnitId;

      // 5. Create Product
      const product = await this.repository.createProduct({
        productName: productData.ProductName,
        masterProductId: productData.MasterProductID,
        unitId,
        sellingPrice: productData.SellingPrice || 0,
        minStockLevel: productData.MinStockLevel || 0,
        packagingId: productData.PackagingId,
        incentiveAmount: productData.IncentiveAmount || 0,
        packageCapacityKg: calculatedCapacityKg, // Store calculated capacity in kg
        packagingCapacity, // Store PM capacity in liters
        fillingDensity, // Store filling density value
        isFdSyncWithDensity, // Store sync flag
        isActive: true,
      });

      logger.info('Product created', {
        id: product.productId,
        packageCapacityKg: calculatedCapacityKg,
        packagingCapacity,
        fillingDensity,
        isFdSyncWithDensity,
        unitId,
      });

      return new ProductDTO(product);
    } catch (error) {
      logger.error('Failed to create product', { error: error.message });
      throw error;
    }
  }

  async updateProduct(productId, updateData) {
    const existing = await this.repository.findProductById(productId);
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    const updateFields = {};
    if (updateData.ProductName !== undefined) updateFields.productName = updateData.ProductName;
    if (updateData.MasterProductID !== undefined)
      updateFields.masterProductId = updateData.MasterProductID;
    if (updateData.UnitID !== undefined) updateFields.unitId = updateData.UnitID;
    if (updateData.ProductType !== undefined) updateFields.productType = updateData.ProductType;
    if (updateData.SellingPrice !== undefined) updateFields.sellingPrice = updateData.SellingPrice;
    if (updateData.MinStockLevel !== undefined)
      updateFields.minStockLevel = updateData.MinStockLevel;
    if (updateData.PackagingId !== undefined) updateFields.packagingId = updateData.PackagingId;
    if (updateData.IncentiveAmount !== undefined)
      updateFields.incentiveAmount = updateData.IncentiveAmount;
    if (updateData.FillingDensity !== undefined)
      updateFields.fillingDensity = updateData.FillingDensity;
    if (updateData.IsFdSyncWithDensity !== undefined) {
      // Explicitly convert to boolean to handle 'true'/'false' strings
      updateFields.isFdSyncWithDensity =
        updateData.IsFdSyncWithDensity === true || updateData.IsFdSyncWithDensity === 'true';
    }
    if (updateData.IsActive !== undefined) updateFields.isActive = updateData.IsActive;

    const updated = await this.repository.updateProduct(productId, updateFields);
    logger.info('Product updated', { id: productId });

    // Reconcile low-stock notification state when min stock level changes (non-blocking)
    if (updateData.MinStockLevel !== undefined) {
      import('../../jobs/lowStockSweepJob.js')
        .then(({ reconcileLowStockForProduct }) => reconcileLowStockForProduct(productId))
        .catch(err => logger.error('Low stock reconcile failed:', err));
    }

    return new ProductDTO(updated);
  }

  async deleteProduct(productId) {
    const existing = await this.repository.findProductById(productId);
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    await this.repository.deleteProduct(productId);
    logger.info('Product deleted', { id: productId });
  }
}
