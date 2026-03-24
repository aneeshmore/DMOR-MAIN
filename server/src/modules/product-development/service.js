import {
  productDevelopment,
  productDevelopmentMaterials,
} from '../../db/schema/products/product-development.js';
import { masterProducts } from '../../db/schema/products/master-products.js';
import { masterProductFG } from '../../db/schema/products/master-product-fg.js';
import { masterProductRM } from '../../db/schema/products/master-product-rm.js';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';

export class ProductDevelopmentService {
  async createProductDevelopment(data) {
    // Explicit extraction and casting
    const title = data.productName || 'New Product Development';
    const masterProductId = parseInt(data.masterProductId);
    let density = data.density ? String(data.density) : null;
    const viscosity = data.viscosity ? String(data.viscosity) : null;
    const hours = data.hours ? String(data.hours) : null;
    const perPercent = data.perPercent ? String(data.perPercent) : null;
    const materials = data.materials || [];
    const notes = data.notes || '';
    const createdBy = parseInt(data.createdBy) || 1;
    // Use provided status or default to 'Draft'/'Incomplete'
    const status = data.status || 'Draft';
    const mixingRatioPart =
      data.mixingRatioPart !== null && data.mixingRatioPart !== undefined
        ? String(data.mixingRatioPart)
        : null;
    const calculationBasis = data.calculationBasis || 'Ltr'; // Default to Ltr if not provided

    // Calculate density from materials if materials are provided (always override)
    if (materials.length > 0) {
      let totalWeight = 0;
      let totalVolume = 0;

      for (const material of materials) {
        const materialId = parseInt(material.productId);
        const percentage = parseFloat(material.percentage) || 0;
        const wtPerLtr = parseFloat(material.wtInLtr) || 0;

        // Assume percentage is weight percentage, so weight for 100kg batch = percentage
        const weight = percentage; // e.g., 10% = 10kg for 100kg batch
        totalWeight += weight;

        // Get density from masterProductRM
        const rmData = await db
          .select({ rmDensity: masterProductRM.rmDensity })
          .from(masterProductRM)
          .where(eq(masterProductRM.masterProductId, materialId))
          .limit(1);

        if (rmData.length > 0 && rmData[0].rmDensity) {
          const materialDensity = parseFloat(rmData[0].rmDensity);
          if (materialDensity > 0) {
            const volume = weight / materialDensity; // Volume in liters
            totalVolume += volume;
          }
        }
      }

      if (totalVolume > 0) {
        const calculatedDensity = totalWeight / totalVolume;
        density = String(calculatedDensity.toFixed(3));
      }
    }

    console.log('Creating Product Development:', {
      masterProductId,
      density,
      materialsCount: materials.length,
      status,
      status,
      mixingRatioPart,
      calculationBasis,
    });

    if (isNaN(masterProductId)) {
      throw new Error('Invalid Master Product ID');
    }

    // 1. Get Master Product Name if not provided (to populate productName)
    let productName = title;
    try {
      const mp = await db
        .select()
        .from(masterProducts)
        .where(eq(masterProducts.masterProductId, masterProductId))
        .limit(1);
      if (mp.length > 0) {
        productName = mp[0].masterProductName;
      }
    } catch (e) {
      console.error('Error fetching master product name:', e);
    }

    // 2. Check for existing record to Update (Upsert logic)
    // We try to find the latest record for this master product to update it,
    // rather than creating indefinite duplicates.
    let devRecord;
    const existingRecords = await db
      .select()
      .from(productDevelopment)
      .where(eq(productDevelopment.masterProductId, masterProductId))
      .orderBy(desc(productDevelopment.createdAt))
      .limit(1);

    if (existingRecords.length > 0) {
      // UPDATE existing
      const existing = existingRecords[0];
      console.log('Updating existing development record:', existing.developmentId);

      const [updated] = await db
        .update(productDevelopment)
        .set({
          productName,
          density,
          viscosity,
          productionHours: hours,
          percentageValue: perPercent,
          mixingRatioPart,
          calculationBasis,
          status,
          notes,
          createdBy,
          updatedAt: new Date(),
        })
        .where(eq(productDevelopment.developmentId, existing.developmentId))
        .returning();
      devRecord = updated;

      // Delete old materials to replace with new ones
      await db
        .delete(productDevelopmentMaterials)
        .where(eq(productDevelopmentMaterials.developmentId, devRecord.developmentId));
    } else {
      // INSERT New
      const [inserted] = await db
        .insert(productDevelopment)
        .values({
          masterProductId,
          productName,
          density,
          viscosity,
          productionHours: hours,
          percentageValue: perPercent,
          mixingRatioPart,
          calculationBasis,
          status,
          notes,
          createdBy,
        })
        .returning();
      devRecord = inserted;
      console.log('Inserted new dev record:', devRecord.developmentId);
    }

    // 3. Insert Materials (for both items)
    if (materials && materials.length > 0) {
      const materialRecords = materials.map(m => ({
        developmentId: devRecord.developmentId,
        materialId: parseInt(m.productId), // Ensure integer
        percentage: String(parseFloat(m.percentage || 0).toFixed(4)), // Format to 3 decimal places
        totalPercentage: String(parseFloat(m.totalPercentage || 0).toFixed(4)), // Format to 3 decimal places
        sequence: parseInt(m.sequence) || 0,
        waitingTime: parseInt(m.waitingTime) || 0,
        wtPerLtr: String(m.wtInLtr || 0),
      }));

      await db.insert(productDevelopmentMaterials).values(materialRecords);
      // console.log('Inserted materials:', materialRecords.length);
    }

    // 4. Update Master Product FG Density and Production Cost
    const updates = {};
    if (density && !isNaN(parseFloat(density))) {
      updates.fgDensity = density;
    }
    // 'hours' from payload corresponds to 'productionCost' in FG table as per request
    if (hours && !isNaN(parseFloat(hours))) {
      updates.productionCost = hours;
    }

    if (Object.keys(updates).length > 0) {
      if (viscosity && !isNaN(parseFloat(viscosity))) {
        updates.viscosity = viscosity;
      }
      if (perPercent && !isNaN(parseFloat(perPercent))) {
        updates.waterPercentage = perPercent;
      }

      try {
        await db
          .update(masterProductFG)
          .set(updates)
          .where(eq(masterProductFG.masterProductId, masterProductId));

        console.log(`Updated Master Product FG details for ID: ${masterProductId}`, updates);
      } catch (err) {
        console.error('Failed to update Master Product FG details:', err);
        // We don't throw here to avoid failing the main creation flow, just log it.
      }
    }

    return devRecord;
  }

  async getLatestByMasterProductId(masterProductId) {
    const mId = parseInt(masterProductId);
    if (isNaN(mId)) return null;

    console.log(`Fetching latest product development for MasterID: ${mId}`);

    // Get the most recent development record for this master product
    const records = await db
      .select()
      .from(productDevelopment)
      .where(eq(productDevelopment.masterProductId, mId))
      .orderBy(desc(productDevelopment.createdAt))
      .limit(1);

    if (!records || records.length === 0) {
      console.log('No existing development record found.');
      return null;
    }

    const record = records[0];
    console.log('Found latest record:', record.developmentId);

    // Get materials
    const materials = await db
      .select()
      .from(productDevelopmentMaterials)
      .where(eq(productDevelopmentMaterials.developmentId, record.developmentId))
      .orderBy(productDevelopmentMaterials.sequence);

    // Format percentage values to 3 decimal places
    const formattedMaterials = materials.map(m => ({
      ...m,
      percentage: String(parseFloat(m.percentage || 0).toFixed(4)),
    }));

    return {
      ...record,
      materials: formattedMaterials,
    };
  }
}
