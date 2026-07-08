import db from '../index.js';
import {
  // Core
  units,
  // vehicles,
  suppliers,
  // Organization
  branches,
  departments,
  employees,
  // Auth
  roles,
  permissions,
  rolePermissions,
  employeeRoles,
  // Products
  masterProducts,
  masterProductFG,
  masterProductRM,
  masterProductPM,
  products,
  // productBom,
  productDevelopment,
  productDevelopmentMaterials,
  // Sales
  customers,
  orders,
  orderDetails,
  // dispatches,
  // Production
  // productionBatch,
  // batchProducts,
  // batchMaterials,
  // batchActivityLog,
  // Inventory
  // materialInward,
  // materialDiscard,
  // stockLedger,
  // inventoryTransactions,
  // notifications,
} from '../schema/index.js';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * Morex Technologies - Comprehensive Seed File
 *
 * Based on real product development data (PU 7038 / Epoxy Base White Coat formula)
 *
 * Seeds the complete flow:
 * 1. Core Setup (Units, Branches, Departments, Roles, Permissions)
 * 2. Employees with role assignments
 * 3. Suppliers for raw materials
 * 4. Master Products (FG, RM, PM) with realistic paint formulas
 * 5. Product SKUs with pricing
 * 6. Product Development (Recipes/Formulas with BOM percentages)
 * 7. Customers
 * 8. Sample Orders (for demo)
 * 9. Material Inward (to have stock for production)
 *
 * Usage:
 *   pnpm db:seed          # Add data without clearing
 *   pnpm db:seed:reset    # Clear all data and reseed
 */

async function seedDatabase() {
  try {
    console.log('🌱 Starting Morex Technologies database seed...\n');

    const shouldReset = process.argv.includes('--reset');
    if (shouldReset) {
      console.log('🗑️  Clearing existing data...');
      await db.execute(
        sql`TRUNCATE TABLE 
          app.inventory_transactions,
          app.stock_ledger, 
          app.material_discard, 
          app.material_inward,
          app.suppliers,
          app.batch_activity_log,
          app.batch_materials,
          app.batch_products,
          app.production_batches_enhanced,
          app.product_bom, 
          app.product_development_materials,
          app.product_development,
          app.dispatches,
          app.order_details, 
          app.orders,
          app.customers, 
          app.notifications,
          app.employee_roles, 
          app.role_permissions, 
          app.employees, 
          app.departments, 
          app.branches, 
          app.products, 
          app.master_product_fg, 
          app.master_product_rm, 
          app.master_product_pm, 
          app.master_products, 
          app.units, 
          app.permissions, 
          app.roles, 
          app.vehicles 
          RESTART IDENTITY CASCADE`
      );
      console.log('✅ Data cleared successfully!\n');
    }

    // ============================================================
    // LEVEL 1: Core Tables
    // ============================================================
    console.log('📦 Level 1: Core Tables...');

    // Units
    const unitRows = await db
      .insert(units)
      .values([
        { unitName: 'KG' },
        { unitName: 'LTR' },
        { unitName: 'PCS' },
        { unitName: 'BOXES' },
        { unitName: 'BAGS' },
        { unitName: 'MTR' },
        { unitName: 'NO' },
        { unitName: 'DRUM' },
      ])
      .returning();
    console.log(`   ✓ ${unitRows.length} units`);

    // Branches
    const branchRows = await db
      .insert(branches)
      .values([
        {
          branchName: 'Head Office',
          address: 'Plot 123, Sector 18, Gurugram, Haryana',
          isActive: true,
        },
        {
          branchName: 'Manufacturing Plant',
          address: 'Industrial Area Phase 2, Manesar, Haryana',
          isActive: true,
        },
        {
          branchName: 'Warehouse - Delhi NCR',
          address: 'Okhla Industrial Estate, New Delhi',
          isActive: true,
        },
      ])
      .returning();
    console.log(`   ✓ ${branchRows.length} branches`);

    // Departments
    const deptRows = await db
      .insert(departments)
      .values([
        { departmentName: 'Production' },
        { departmentName: 'Quality Control' },
        { departmentName: 'Sales & Marketing' },
        { departmentName: 'Human Resources' },
        { departmentName: 'IT & Systems' },
        { departmentName: 'Procurement' },
        { departmentName: 'Logistics' },
        { departmentName: 'Finance' },
        { departmentName: 'Dealer' },
      ])
      .returning();
    console.log(`   ✓ ${deptRows.length} departments`);

    // Roles
    const roleRows = await db
      .insert(roles)
      .values([
        { roleName: 'SuperAdmin', description: 'Complete system access', isActive: true },
        { roleName: 'Admin', description: 'Administrative access', isActive: true },
        { roleName: 'Production Manager', description: 'Manage production', isActive: true },
        {
          roleName: 'Sales Manager',
          description: 'Manage sales',
          isActive: true,
          isSalesRole: true,
        },
        {
          roleName: 'Sales Executive',
          description: 'Handle orders',
          isActive: true,
          isSalesRole: true,
        },
        { roleName: 'Inventory Manager', description: 'Manage inventory', isActive: true },
        {
          roleName: 'Production Supervisor',
          description: 'Execute production batches',
          isActive: true,
        },
        { roleName: 'Dealer', description: 'Read-only access', isActive: true },
      ])
      .returning();
    console.log(`   ✓ ${roleRows.length} roles`);

    // Permissions
    const permissionRows = await db
      .insert(permissions)
      .values([
        { permissionName: 'manage_employees', description: 'Manage employees' },
        { permissionName: 'view_employees', description: 'View employees' },
        { permissionName: 'manage_roles', description: 'Manage roles' },
        { permissionName: 'manage_permissions', description: 'Manage permissions' },
        { permissionName: 'view_roles', description: 'View roles' },
        { permissionName: 'manage_products', description: 'Manage products' },
        { permissionName: 'view_products', description: 'View products' },
        { permissionName: 'manage_master_products', description: 'Manage master products' },
        { permissionName: 'view_master_products', description: 'View master products' },
        { permissionName: 'manage_bom', description: 'Manage BOM' },
        { permissionName: 'view_bom', description: 'View BOM' },
        { permissionName: 'manage_orders', description: 'Manage orders' },
        { permissionName: 'view_orders', description: 'View orders' },
        { permissionName: 'approve_orders', description: 'Approve orders' },
        { permissionName: 'cancel_orders', description: 'Cancel orders' },
        { permissionName: 'manage_customers', description: 'Manage customers' },
        { permissionName: 'view_customers', description: 'View customers' },
        { permissionName: 'manage_inventory', description: 'Manage inventory' },
        { permissionName: 'view_inventory', description: 'View inventory' },
        { permissionName: 'manage_material_inward', description: 'Manage inward' },
        { permissionName: 'view_material_inward', description: 'View inward' },
        { permissionName: 'manage_material_discard', description: 'Manage discard' },
        { permissionName: 'view_material_discard', description: 'View discard' },
        { permissionName: 'view_stock_ledger', description: 'View stock ledger' },
        { permissionName: 'manage_production', description: 'Manage production' },
        { permissionName: 'view_production', description: 'View production' },
        { permissionName: 'approve_production', description: 'Approve production' },
        { permissionName: 'view_reports', description: 'View reports' },
        { permissionName: 'view_dashboard', description: 'View dashboard' },
        { permissionName: 'export_data', description: 'Export data' },
        { permissionName: 'manage_branches', description: 'Manage branches' },
        { permissionName: 'manage_departments', description: 'Manage departments' },
        { permissionName: 'manage_units', description: 'Manage units' },
        { permissionName: 'manage_vehicles', description: 'Manage vehicles' },
        { permissionName: 'system_settings', description: 'System settings' },
        { permissionName: 'view_audit_logs', description: 'View audit logs' },
        { permissionName: 'manage_backup', description: 'Manage backup' },
      ])
      .returning();
    console.log(`   ✓ ${permissionRows.length} permissions`);

    // ============================================================
    // LEVEL 2: Master Products (Based on Real Paint Formulas)
    // ============================================================
    console.log('\n📦 Level 2: Master Products (Paint Formulas)...');

    const masterProductRows = await db
      .insert(masterProducts)
      .values([
        // ============= FINISHED GOODS (FG) =============
        // Index 0: Epoxy Base White Coat (from Excel PU 7038) - will have subcategory='Base'
        {
          masterProductName: 'Epoxy Base White Coat',
          productType: 'FG',
          description: 'Industrial epoxy base white coating - Premium quality (2-component)',
          defaultUnitId: unitRows[1].unitId, // LTR
          isActive: true,
          // Add other needed fields if any, or accept defaults
        },
        // Index 1: PU Enamel Black
        {
          masterProductName: 'PU Enamel Black',
          productType: 'FG',
          description: 'Polyurethane enamel black finish',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // ... (rest of master products logic stays same, I'm just replacing the chunk surrounding the error)
        // Wait, I shouldn't replace the huge chunk if I can target small.
        // I will just target the Departments section and the Employees section.

        // Index 2: Exterior Weather Shield
        {
          masterProductName: 'Exterior Weather Shield',
          productType: 'FG',
          description: 'Weather-resistant exterior coating',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 3: Interior Premium Emulsion
        {
          masterProductName: 'Interior Premium Emulsion',
          productType: 'FG',
          description: 'Water-based interior wall emulsion',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 4: Premium White Primer
        {
          masterProductName: 'Premium White Primer',
          productType: 'FG',
          description: 'High-quality white primer for interior and exterior walls',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 5: Luxury Blue Emulsion
        {
          masterProductName: 'Luxury Blue Emulsion',
          productType: 'FG',
          description: 'Premium water-based blue emulsion paint',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 6: Royal Red Enamel
        {
          masterProductName: 'Royal Red Enamel',
          productType: 'FG',
          description: 'Oil-based red enamel paint with superior finish',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 7: Olive Green Primer
        {
          masterProductName: 'Olive Green Primer',
          productType: 'FG',
          description: 'Industrial green primer for metal surfaces',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 8: Golden Yellow Emulsion
        {
          masterProductName: 'Golden Yellow Emulsion',
          productType: 'FG',
          description: 'Bright yellow interior emulsion paint',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 9: Epoxy Hardener (Part B) - for 2-component system, subcategory='Hardener'
        {
          masterProductName: 'Epoxy Hardener (Part B)',
          productType: 'FG',
          description:
            'Polyamide hardener for epoxy base coatings - Mixing ratio 2:1 (Base:Hardener)',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },

        // ============= RAW MATERIALS (RM) - Based on Excel =============
        // Index 10: PU 929 60% (Polyurethane Resin)
        {
          masterProductName: 'PU 929 60%',
          productType: 'RM',
          description: 'Polyurethane resin 60% solids - Base binder',
          defaultUnitId: unitRows[0].unitId, // KG
          isActive: true,
        },
        // Index 11: Titanium Dioxide Rutile
        {
          masterProductName: 'Titanium Dioxide Rutile',
          productType: 'RM',
          description: 'High-grade white pigment (Rutile grade)',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 12: Carbon Black Pigment
        {
          masterProductName: 'Carbon Black Pigment',
          productType: 'RM',
          description: 'High tinting strength black pigment',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 13: Blue Phthalocyanine Pigment
        {
          masterProductName: 'Blue Phthalocyanine Pigment',
          productType: 'RM',
          description: 'Organic blue pigment - high color strength',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 14: Red Oxide Pigment
        {
          masterProductName: 'Red Oxide Pigment',
          productType: 'RM',
          description: 'Iron oxide red pigment - excellent coverage',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 15: Chrome Green Oxide
        {
          masterProductName: 'Chrome Green Oxide',
          productType: 'RM',
          description: 'Chromium oxide green pigment - weather resistant',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 16: Calcium Carbonate 8080
        {
          masterProductName: 'Calcium Carbonate 8080',
          productType: 'RM',
          description: 'Extender/filler - Whiting grade',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 17: Talc Powder
        {
          masterProductName: 'Talc Powder',
          productType: 'RM',
          description: 'Magnesium silicate filler',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 18: Yellow Oxide Pigment
        {
          masterProductName: 'Yellow Oxide Pigment',
          productType: 'RM',
          description: 'Iron oxide yellow pigment',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 19: Anti-Terra U
        {
          masterProductName: 'Anti-Terra U',
          productType: 'RM',
          description: 'Wetting and dispersing additive',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 20: I-Clay (Bentone Clay)
        {
          masterProductName: 'I-Clay (Bentone)',
          productType: 'RM',
          description: 'Rheology modifier / Anti-settling agent',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 21: Xylene Solvent
        {
          masterProductName: 'Xylene Solvent',
          productType: 'RM',
          description: 'Aromatic hydrocarbon solvent',
          defaultUnitId: unitRows[1].unitId, // LTR
          isActive: true,
        },
        // Index 22: Ethyl Cellosolve Acetate
        {
          masterProductName: 'Ethyl Cellosolve Acetate',
          productType: 'RM',
          description: 'Slow evaporating cosolvent',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 23: Butyl Acetate
        {
          masterProductName: 'Butyl Acetate',
          productType: 'RM',
          description: 'Medium evaporating solvent',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 24: DM100 (Dispersant/Additive)
        {
          masterProductName: 'DM100 Dispersant',
          productType: 'RM',
          description: 'Polymeric dispersant additive',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },
        // Index 25: Acrylic Resin Base
        {
          masterProductName: 'Acrylic Resin Emulsion',
          productType: 'RM',
          description: 'Water-based acrylic binder for emulsions',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 26: Water
        {
          masterProductName: 'DM Water',
          productType: 'RM',
          description: 'Demineralised water for emulsions',
          defaultUnitId: unitRows[1].unitId,
          isActive: true,
        },
        // Index 27: Zinc Phosphate Primer Base
        {
          masterProductName: 'Zinc Phosphate',
          productType: 'RM',
          description: 'Anti-corrosive primer pigment',
          defaultUnitId: unitRows[0].unitId,
          isActive: true,
        },

        // ============= PACKAGING MATERIALS (PM) =============
        // Index 28: 20L Metal Drum
        {
          masterProductName: '20L Metal Drum',
          productType: 'PM',
          description: '20 Liter metal drum with lid',
          defaultUnitId: unitRows[2].unitId, // PCS
          isActive: true,
        },
        // Index 29: 4L Metal Can
        {
          masterProductName: '4L Metal Can',
          productType: 'PM',
          description: '4 Liter metal tin with handle',
          defaultUnitId: unitRows[2].unitId,
          isActive: true,
        },
        // Index 30: 1L Metal Can
        {
          masterProductName: '1L Metal Can',
          productType: 'PM',
          description: '1 Liter metal tin',
          defaultUnitId: unitRows[2].unitId,
          isActive: true,
        },
        // Index 31: 20L Plastic Bucket
        {
          masterProductName: '20L Plastic Bucket',
          productType: 'PM',
          description: '20 Liter HDPE bucket with lid',
          defaultUnitId: unitRows[2].unitId,
          isActive: true,
        },
        // Index 32: 10L Plastic Bucket
        {
          masterProductName: '10L Plastic Bucket',
          productType: 'PM',
          description: '10 Liter plastic bucket',
          defaultUnitId: unitRows[2].unitId,
          isActive: true,
        },
      ])
      .returning();
    console.log(`   ✓ ${masterProductRows.length} master products created`);

    // FG Attributes (with real density and cost)
    // Indices: 0-Epoxy White Base, 1-PU Black, 2-Weather Shield, 3-Interior Emulsion,
    //          4-Premium White Primer, 5-Luxury Blue, 6-Royal Red, 7-Olive Green, 8-Golden Yellow, 9-Epoxy Hardener
    await db.insert(masterProductFG).values([
      // Epoxy Base White - 2-component product, linked to Hardener (index 9)
      {
        masterProductId: masterProductRows[0].masterProductId,
        defaultPackagingType: '20L Metal Drum',
        fgDensity: '1.08',
        productionCost: '129.05',
        availableQuantity: 0,
        subcategory: 'Base',
        hardenerId: masterProductRows[9].masterProductId, // Links to Epoxy Hardener
      },
      {
        masterProductId: masterProductRows[1].masterProductId,
        defaultPackagingType: '4L Metal Can',
        fgDensity: '1.12',
        productionCost: '145.00',
        availableQuantity: 0,
        subcategory: 'General',
      },
      {
        masterProductId: masterProductRows[2].masterProductId,
        defaultPackagingType: '20L Plastic Bucket',
        fgDensity: '1.35',
        productionCost: '95.00',
        availableQuantity: 0,
        subcategory: 'General',
      },
      {
        masterProductId: masterProductRows[3].masterProductId,
        defaultPackagingType: '20L Plastic Bucket',
        fgDensity: '1.40',
        productionCost: '75.00',
        availableQuantity: 0,
        subcategory: 'General',
      },
      {
        masterProductId: masterProductRows[4].masterProductId,
        defaultPackagingType: '20L Plastic Bucket',
        fgDensity: '1.42',
        productionCost: '85.50',
        availableQuantity: 0,
        subcategory: 'General',
      },
      {
        masterProductId: masterProductRows[5].masterProductId,
        defaultPackagingType: '20L Plastic Bucket',
        fgDensity: '1.38',
        productionCost: '92.00',
        availableQuantity: 0,
        subcategory: 'General',
      },
      {
        masterProductId: masterProductRows[6].masterProductId,
        defaultPackagingType: '4L Metal Can',
        fgDensity: '1.45',
        productionCost: '135.00',
        availableQuantity: 0,
        subcategory: 'General',
      },
      {
        masterProductId: masterProductRows[7].masterProductId,
        defaultPackagingType: '20L Metal Drum',
        fgDensity: '1.40',
        productionCost: '88.00',
        availableQuantity: 0,
        subcategory: 'General',
      },
      {
        masterProductId: masterProductRows[8].masterProductId,
        defaultPackagingType: '10L Plastic Bucket',
        fgDensity: '1.36',
        productionCost: '80.00',
        availableQuantity: 0,
        subcategory: 'General',
      },
      // Epoxy Hardener - Part B of 2-component system
      {
        masterProductId: masterProductRows[9].masterProductId,
        defaultPackagingType: '4L Metal Can',
        fgDensity: '0.98',
        productionCost: '165.00',
        availableQuantity: 0,
        subcategory: 'Hardener',
      },
    ]);
    console.log('   ✓ FG attributes set (with 2-component Epoxy Base + Hardener)');

    // RM Attributes (with real density and pricing)
    // Updated Indices after adding Epoxy Hardener FG at index 9:
    // 10-PU929, 11-TiO2, 12-Carbon Black, 13-Blue Phthalo, 14-Red Oxide, 15-Chrome Green
    // 16-CaCO3, 17-Talc, 18-Yellow Oxide, 19-Anti-Terra, 20-I-Clay, 21-Xylene
    // 22-Ethyl Cello, 23-Butyl Acetate, 24-DM100, 25-Acrylic Resin, 26-DM Water, 27-Zinc Phosphate
    await db.insert(masterProductRM).values([
      {
        masterProductId: masterProductRows[10].masterProductId,
        rmDensity: '1.02',
        rmSolids: '60.00',
        purchaseCost: '170.00',
        availableQty: 10000,
      }, // PU 929
      {
        masterProductId: masterProductRows[11].masterProductId,
        rmDensity: '4.20',
        rmSolids: '100.00',
        purchaseCost: '250.00',
        availableQty: 10000,
      }, // TiO2 Rutile
      {
        masterProductId: masterProductRows[12].masterProductId,
        rmDensity: '2.00',
        rmSolids: '100.00',
        purchaseCost: '265.00',
        availableQty: 10000,
      }, // Carbon Black
      {
        masterProductId: masterProductRows[13].masterProductId,
        rmDensity: '1.60',
        rmSolids: '100.00',
        purchaseCost: '850.00',
        availableQty: 10000,
      }, // Blue Phthalocyanine
      {
        masterProductId: masterProductRows[14].masterProductId,
        rmDensity: '5.00',
        rmSolids: '100.00',
        purchaseCost: '95.00',
        availableQty: 10000,
      }, // Red Oxide
      {
        masterProductId: masterProductRows[15].masterProductId,
        rmDensity: '5.20',
        rmSolids: '100.00',
        purchaseCost: '320.00',
        availableQty: 10000,
      }, // Chrome Green
      {
        masterProductId: masterProductRows[16].masterProductId,
        rmDensity: '2.70',
        rmSolids: '100.00',
        purchaseCost: '12.00',
        availableQty: 10000,
      }, // CaCO3 8080
      {
        masterProductId: masterProductRows[17].masterProductId,
        rmDensity: '2.70',
        rmSolids: '100.00',
        purchaseCost: '12.00',
        availableQty: 10000,
      }, // Talc
      {
        masterProductId: masterProductRows[18].masterProductId,
        rmDensity: '3.50',
        rmSolids: '100.00',
        purchaseCost: '45.00',
        availableQty: 10000,
      }, // Yellow Oxide
      {
        masterProductId: masterProductRows[19].masterProductId,
        rmDensity: '0.94',
        rmSolids: '0.00',
        purchaseCost: '1330.00',
        availableQty: 10000,
      }, // Anti-Terra U
      {
        masterProductId: masterProductRows[20].masterProductId,
        rmDensity: '2.00',
        rmSolids: '100.00',
        purchaseCost: '160.00',
        availableQty: 10000,
      }, // I-Clay
      {
        masterProductId: masterProductRows[21].masterProductId,
        rmDensity: '0.86',
        rmSolids: '0.00',
        purchaseCost: '90.00',
        availableQty: 10000,
      }, // Xylene
      {
        masterProductId: masterProductRows[22].masterProductId,
        rmDensity: '0.97',
        rmSolids: '0.00',
        purchaseCost: '120.00',
        availableQty: 10000,
      }, // Ethyl Cello
      {
        masterProductId: masterProductRows[23].masterProductId,
        rmDensity: '0.88',
        rmSolids: '0.00',
        purchaseCost: '145.00',
        availableQty: 10000,
      }, // Butyl Acetate
      {
        masterProductId: masterProductRows[24].masterProductId,
        rmDensity: '0.96',
        rmSolids: '0.00',
        purchaseCost: '1300.00',
        availableQty: 10000,
      }, // DM100
      {
        masterProductId: masterProductRows[25].masterProductId,
        rmDensity: '1.05',
        rmSolids: '50.00',
        purchaseCost: '85.00',
        availableQty: 10000,
      }, // Acrylic Resin
      {
        masterProductId: masterProductRows[26].masterProductId,
        rmDensity: '1.00',
        rmSolids: '0.00',
        purchaseCost: '0.50',
        availableQty: 10000,
      }, // DM Water
      {
        masterProductId: masterProductRows[27].masterProductId,
        rmDensity: '3.30',
        rmSolids: '100.00',
        purchaseCost: '180.00',
        availableQty: 10000,
      }, // Zinc Phosphate
    ]);
    console.log('   ✓ RM attributes set');

    // PM Attributes - Updated Indices: 28-20L Metal Drum, 29-4L Metal Can, 30-1L Metal Can, 31-20L Plastic Bucket, 32-10L Plastic Bucket
    await db.insert(masterProductPM).values([
      {
        masterProductId: masterProductRows[28].masterProductId,
        capacity: '20.00',
        purchaseCost: '85.00',
        availableQty: 5000,
      },
      {
        masterProductId: masterProductRows[29].masterProductId,
        capacity: '4.00',
        purchaseCost: '30.00',
        availableQty: 5000,
      },
      {
        masterProductId: masterProductRows[30].masterProductId,
        capacity: '1.00',
        purchaseCost: '15.00',
        availableQty: 5000,
      },
      {
        masterProductId: masterProductRows[31].masterProductId,
        capacity: '20.00',
        purchaseCost: '45.00',
        availableQty: 5000,
      },
      {
        masterProductId: masterProductRows[32].masterProductId,
        capacity: '10.00',
        purchaseCost: '28.00',
        availableQty: 5000,
      },
    ]);
    console.log('   ✓ PM attributes set');

    // ============================================================
    // LEVEL 3: Employees
    // ============================================================
    console.log('\n👥 Level 3: Employees...');

    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('password123', 10);

    const employeeRows = await db
      .insert(employees)
      .values([
        {
          firstName: 'Super',
          lastName: 'Admin',
          username: 'admin',
          passwordHash: adminHash,
          mobileNo: ['9999999999', null, null],
          emailId: 'admin@morex.com',
          departmentId: deptRows[4].departmentId,
          currentBranchId: branchRows[0].branchId,
          status: 'Active',
          joiningDate: '2024-01-01',
        },
        {
          firstName: 'Rajesh',
          lastName: 'Kumar',
          username: 'rajesh',
          passwordHash: userHash,
          mobileNo: ['9876543210', null, null],
          emailId: 'rajesh@morex.com',
          departmentId: deptRows[0].departmentId,
          currentBranchId: branchRows[1].branchId,
          status: 'Active',
          joiningDate: '2024-01-15',
        },
        {
          firstName: 'Priya',
          lastName: 'Sharma',
          username: 'priya',
          passwordHash: userHash,
          mobileNo: ['9876543211', null, null],
          emailId: 'priya@morex.com',
          departmentId: deptRows[2].departmentId,
          currentBranchId: branchRows[0].branchId,
          status: 'Active',
          joiningDate: '2024-02-01',
        },
        {
          firstName: 'Amit',
          lastName: 'Singh',
          username: 'amit',
          passwordHash: userHash,
          mobileNo: ['9876543212', null, null],
          emailId: 'amit@morex.com',
          departmentId: deptRows[2].departmentId,
          currentBranchId: branchRows[0].branchId,
          status: 'Active',
          joiningDate: '2024-02-15',
        },
        {
          firstName: 'Deepak',
          lastName: 'Verma',
          username: 'deepak',
          passwordHash: userHash,
          mobileNo: ['9876543213', null, null],
          emailId: 'deepak@morex.com',
          departmentId: deptRows[0].departmentId,
          currentBranchId: branchRows[1].branchId,
          status: 'Active',
          joiningDate: '2024-03-01',
        },
        {
          firstName: 'Sunita',
          lastName: 'Patel',
          username: 'sunita',
          passwordHash: userHash,
          mobileNo: ['9876543214', null, null],
          emailId: 'sunita@morex.com',
          departmentId: deptRows[5].departmentId,
          currentBranchId: branchRows[2].branchId,
          status: 'Active',
          joiningDate: '2024-03-15',
        },
      ])
      .returning();
    console.log(`   ✓ ${employeeRows.length} employees created`);

    // Create Dealer separately to link salesperson
    const dealerRows = await db
      .insert(employees)
      .values([
        {
          firstName: 'Dealer',
          lastName: 'North',
          username: 'dealer_north',
          passwordHash: userHash,
          mobileNo: ['9876543299', null, null],
          emailId: 'dealer.north@morex.com',
          departmentId: deptRows[8].departmentId, // Dealer Dept
          currentBranchId: branchRows[0].branchId, // Head Office
          status: 'Active',
          joiningDate: '2024-04-01',
          // Dealer Fields
          companyName: 'North India Paints & H/W',
          gstin: '07AAACD7890E1Z2',
          pincode: '110020',
          addressCity: 'New Delhi',
          addressState: 'Delhi',
          area: 'Okhla Phase 3',
          addressComplete: 'Shop 12B, Industrial Complex, Okhla',
          customerType: 'Dealer',
          assignedSalespersonId: employeeRows[3].employeeId, // Amit
        },
        {
          firstName: 'Dealer',
          lastName: 'West',
          username: 'dealer_west',
          passwordHash: userHash,
          mobileNo: ['9876543298', null, null],
          emailId: 'dealer.west@morex.com',
          departmentId: deptRows[8].departmentId,
          currentBranchId: branchRows[1].branchId, // Manufacturing Plant (Gurugram)
          status: 'Active',
          joiningDate: '2024-04-05',
          companyName: 'Gurugram Traders',
          gstin: '06BBACD7890E1Z3',
          pincode: '122050',
          addressCity: 'Gurugram',
          addressState: 'Haryana',
          area: 'Manesar Sector 1',
          addressComplete: 'Plot 45, Sector 1, Manesar',
          customerType: 'Dealer',
          assignedSalespersonId: employeeRows[2].employeeId, // Priya (Sales Manager)
        },
        {
          firstName: 'Dealer',
          lastName: 'South',
          username: 'dealer_south',
          passwordHash: userHash,
          mobileNo: ['9876543297', null, null],
          emailId: 'dealer.south@morex.com',
          departmentId: deptRows[8].departmentId,
          currentBranchId: branchRows[0].branchId,
          status: 'Active',
          joiningDate: '2024-04-10',
          companyName: 'Chennai Color World',
          gstin: '33CCACD7890E1Z4',
          pincode: '600001',
          addressCity: 'Chennai',
          addressState: 'Tamil Nadu',
          area: 'Parrys Corner',
          addressComplete: '123, NSC Bose Road, Parrys',
          customerType: 'Distributor',
          assignedSalespersonId: employeeRows[3].employeeId, // Amit
        },
        {
          firstName: 'Dealer',
          lastName: 'East',
          username: 'dealer_east',
          passwordHash: userHash,
          mobileNo: ['9876543296', null, null],
          emailId: 'dealer.east@morex.com',
          departmentId: deptRows[8].departmentId,
          currentBranchId: branchRows[0].branchId,
          status: 'Active',
          joiningDate: '2024-04-15',
          companyName: 'Kolkata Hardware Mart',
          gstin: '19DDACD7890E1Z5',
          pincode: '700001',
          addressCity: 'Kolkata',
          addressState: 'West Bengal',
          area: 'Dalhousie',
          addressComplete: '88, Strand Road, Dalhousie',
          customerType: 'Dealer',
          assignedSalespersonId: employeeRows[2].employeeId, // Priya
        },
      ])
      .returning();
    console.log(`   ✓ ${dealerRows.length} dealer created`);

    //Morex Authorized Dealer to role assignment (Dealer role - index 7)
    // We want to assign roles to ALL created dealers
    const dealerRoleUpdates = dealerRows.map(d => ({
      employeeId: d.employeeId,
      roleId: roleRows[7].roleId,
    }));
    await db.insert(employeeRoles).values(dealerRoleUpdates);

    // Role Permissions & Employee Roles
    const allPerms = permissionRows.map(p => ({
      roleId: roleRows[0].roleId,
      permissionId: p.permissionId,
      canCreate: true,
      canModify: true,
      canView: true,
      canLock: true,
    }));
    await db.insert(rolePermissions).values(allPerms);

    await db.insert(employeeRoles).values([
      { employeeId: employeeRows[0].employeeId, roleId: roleRows[0].roleId },
      { employeeId: employeeRows[1].employeeId, roleId: roleRows[2].roleId }, // Production Manager
      { employeeId: employeeRows[2].employeeId, roleId: roleRows[3].roleId }, // Sales Manager
      { employeeId: employeeRows[3].employeeId, roleId: roleRows[4].roleId }, // Sales Exec
      { employeeId: employeeRows[4].employeeId, roleId: roleRows[6].roleId }, // Production Supervisor
      { employeeId: employeeRows[5].employeeId, roleId: roleRows[5].roleId }, // Inventory Manager
    ]);
    console.log('   ✓ Role assignments done');

    // ============================================================
    // LEVEL 4: Suppliers
    // ============================================================
    console.log('\n🏭 Level 4: Suppliers...');

    const supplierRows = await db
      .insert(suppliers)
      .values([
        {
          supplierName: 'Asian Paints Raw Materials Ltd',
          contactPerson: 'Mr. Gupta',
          phone: '9800000001',
          email: 'supply@asianpaints.com',
        },
        {
          supplierName: 'Shalimar Chemicals Pvt Ltd',
          contactPerson: 'Mr. Reddy',
          phone: '9800000002',
          email: 'sales@shalimarchemicals.com',
        },
        {
          supplierName: 'Pidilite Industries',
          contactPerson: 'Mr. Joshi',
          phone: '9800000003',
          email: 'b2b@pidilite.com',
        },
        {
          supplierName: 'Balaji Packaging Solutions',
          contactPerson: 'Mr. Agarwal',
          phone: '9800000004',
          email: 'orders@balajipack.com',
        },
      ])
      .returning();
    console.log(`   ✓ ${supplierRows.length} suppliers created`);

    // ============================================================
    // LEVEL 5: Product SKUs
    // ============================================================
    console.log('\n📦 Level 5: Product SKUs...');

    const productRows = await db
      .insert(products)
      .values([
        // Epoxy Base White Coat SKUs
        {
          productName: 'Epoxy Base White Coat - 20L',
          masterProductId: masterProductRows[0].masterProductId,
          sellingPrice: '4500.00',
          packageCapacityKg: '21.60', // 20L x 1.08 density
          availableQuantity: 0,
          minStockLevel: 20,
          packagingId: masterProductRows[18].masterProductId,
          isActive: true,
        },
        {
          productName: 'Epoxy Base White Coat - 4L',
          masterProductId: masterProductRows[0].masterProductId,
          sellingPrice: '950.00',
          packageCapacityKg: '4.32',
          availableQuantity: 0,
          minStockLevel: 50,
          packagingId: masterProductRows[19].masterProductId,
          isActive: true,
        },
        {
          productName: 'Epoxy Base White Coat - 1L',
          masterProductId: masterProductRows[0].masterProductId,
          sellingPrice: '280.00',
          packageCapacityKg: '1.08',
          availableQuantity: 0,
          minStockLevel: 100,
          packagingId: masterProductRows[20].masterProductId,
          isActive: true,
        },
        // PU Enamel Black SKUs
        {
          productName: 'PU Enamel Black - 4L',
          masterProductId: masterProductRows[1].masterProductId,
          sellingPrice: '1100.00',
          packageCapacityKg: '4.48',
          availableQuantity: 0,
          minStockLevel: 40,
          packagingId: masterProductRows[19].masterProductId,
          isActive: true,
        },
        {
          productName: 'PU Enamel Black - 1L',
          masterProductId: masterProductRows[1].masterProductId,
          sellingPrice: '320.00',
          packageCapacityKg: '1.12',
          availableQuantity: 0,
          minStockLevel: 80,
          packagingId: masterProductRows[20].masterProductId,
          isActive: true,
        },
        // Weather Shield SKUs
        {
          productName: 'Exterior Weather Shield - 20L',
          masterProductId: masterProductRows[2].masterProductId,
          sellingPrice: '3200.00',
          packageCapacityKg: '27.00',
          availableQuantity: 0,
          minStockLevel: 30,
          packagingId: masterProductRows[21].masterProductId,
          isActive: true,
        },
        {
          productName: 'Exterior Weather Shield - 10L',
          masterProductId: masterProductRows[2].masterProductId,
          sellingPrice: '1700.00',
          packageCapacityKg: '13.50',
          availableQuantity: 0,
          minStockLevel: 40,
          packagingId: masterProductRows[22].masterProductId,
          isActive: true,
        },
        // Interior Emulsion SKUs
        {
          productName: 'Interior Premium Emulsion - 20L',
          masterProductId: masterProductRows[3].masterProductId,
          sellingPrice: '2800.00',
          packageCapacityKg: '28.00',
          availableQuantity: 0,
          minStockLevel: 50,
          packagingId: masterProductRows[21].masterProductId,
          isActive: true,
        },
        {
          productName: 'Interior Premium Emulsion - 10L',
          masterProductId: masterProductRows[3].masterProductId,
          sellingPrice: '1500.00',
          packageCapacityKg: '14.00',
          availableQuantity: 0,
          minStockLevel: 60,
          packagingId: masterProductRows[22].masterProductId,
          isActive: true,
        },
        // Raw Material SKUs (for tracking)
        {
          productName: 'PU 929 60% - 200L Drum',
          masterProductId: masterProductRows[4].masterProductId,
          sellingPrice: '0.00',
          packageCapacityKg: '204.00',
          availableQuantity: 100,
          minStockLevel: 50,
          isActive: true,
        },
        {
          productName: 'Titanium Dioxide Rutile - 25KG Bag',
          masterProductId: masterProductRows[5].masterProductId,
          sellingPrice: '0.00',
          packageCapacityKg: '25.00',
          availableQuantity: 500,
          minStockLevel: 200,
          isActive: true,
        },
        {
          productName: 'Carbon Black Pigment - 25KG Bag',
          masterProductId: masterProductRows[6].masterProductId,
          sellingPrice: '0.00',
          packageCapacityKg: '25.00',
          availableQuantity: 50,
          minStockLevel: 20,
          isActive: true,
        },
        {
          productName: 'Xylene Solvent - 200L Drum',
          masterProductId: masterProductRows[12].masterProductId,
          sellingPrice: '0.00',
          packageCapacityKg: '172.00',
          availableQuantity: 200,
          minStockLevel: 100,
          isActive: true,
        },
      ])
      .returning();
    console.log(`   ✓ ${productRows.length} product SKUs created`);

    // ============================================================
    // LEVEL 6: Product Development (BOM Recipes)
    // Complete formulas for all finished goods with proper BOM
    //
    // FG Indices: 0-Epoxy White, 1-PU Black, 2-Weather Shield, 3-Interior Emulsion,
    //             4-Premium White Primer, 5-Luxury Blue, 6-Royal Red, 7-Olive Green, 8-Golden Yellow
    // RM Indices: 9-PU929, 10-TiO2, 11-Carbon Black, 12-Blue Phthalo, 13-Red Oxide, 14-Chrome Green
    //             15-CaCO3, 16-Talc, 17-Yellow Oxide, 18-Anti-Terra, 19-I-Clay, 20-Xylene
    //             21-Ethyl Cello, 22-Butyl Acetate, 23-DM100, 24-Acrylic Resin, 25-DM Water, 26-Zinc Phosphate
    // ============================================================
    console.log('\n🧪 Level 6: Product Development (Formulas)...');

    const pdRows = await db
      .insert(productDevelopment)
      .values([
        // 0: Epoxy Base White Coat (from Excel PU 7038) - 2-component, ratio 2:1
        {
          masterProductId: masterProductRows[0].masterProductId,
          productName: 'Epoxy Base White Coat - Standard Formula',
          density: '1.08',
          percentageValue: '100.00',
          productionHours: '6.00',
          mixingRatioPart: '2', // Base part of 2:1 ratio
          status: 'Completed',
          notes:
            'Standard production formula based on PU 7038. 2-component system (Base:Hardener = 2:1).',
          createdBy: employeeRows[1].employeeId,
        },
        // 1: PU Enamel Black
        {
          masterProductId: masterProductRows[1].masterProductId,
          productName: 'PU Enamel Black - Standard Formula',
          density: '1.12',
          percentageValue: '100.00',
          productionHours: '5.00',
          status: 'Completed',
          notes: 'Standard black enamel formulation with Carbon Black pigment.',
          createdBy: employeeRows[1].employeeId,
        },
        // 2: Interior Premium Emulsion (White Base)
        {
          masterProductId: masterProductRows[3].masterProductId,
          productName: 'Interior Premium Emulsion - White Base',
          density: '1.40',
          percentageValue: '100.00',
          productionHours: '4.00',
          status: 'Completed',
          notes: 'Water-based acrylic emulsion for interior walls.',
          createdBy: employeeRows[1].employeeId,
        },
        // 3: Premium White Primer
        {
          masterProductId: masterProductRows[4].masterProductId,
          productName: 'Premium White Primer - Standard Formula',
          density: '1.42',
          percentageValue: '100.00',
          productionHours: '4.50',
          status: 'Completed',
          notes: 'High-quality white primer for wall preparation. Excellent coverage and adhesion.',
          createdBy: employeeRows[1].employeeId,
        },
        // 4: Luxury Blue Emulsion
        {
          masterProductId: masterProductRows[5].masterProductId,
          productName: 'Luxury Blue Emulsion - Standard Formula',
          density: '1.38',
          percentageValue: '100.00',
          productionHours: '5.00',
          status: 'Completed',
          notes: 'Premium water-based blue emulsion. Uses Blue Phthalocyanine for deep color.',
          createdBy: employeeRows[1].employeeId,
        },
        // 5: Royal Red Enamel
        {
          masterProductId: masterProductRows[6].masterProductId,
          productName: 'Royal Red Enamel - Standard Formula',
          density: '1.45',
          percentageValue: '100.00',
          productionHours: '5.50',
          status: 'Completed',
          notes: 'Oil-based red enamel with Red Oxide pigment. Superior gloss finish.',
          createdBy: employeeRows[1].employeeId,
        },
        // 6: Olive Green Primer
        {
          masterProductId: masterProductRows[7].masterProductId,
          productName: 'Olive Green Primer - Standard Formula',
          density: '1.40',
          percentageValue: '100.00',
          productionHours: '5.00',
          status: 'Completed',
          notes: 'Industrial green primer with Chrome Green and Zinc Phosphate for anti-corrosion.',
          createdBy: employeeRows[1].employeeId,
        },
        // 7: Golden Yellow Emulsion
        {
          masterProductId: masterProductRows[8].masterProductId,
          productName: 'Golden Yellow Emulsion - Standard Formula',
          density: '1.36',
          percentageValue: '100.00',
          productionHours: '4.00',
          status: 'Completed',
          notes: 'Bright yellow interior emulsion using Yellow Oxide pigment.',
          createdBy: employeeRows[1].employeeId,
        },
        // 8: Epoxy Hardener (Part B) - 2-component, ratio 2:1
        {
          masterProductId: masterProductRows[9].masterProductId,
          productName: 'Epoxy Hardener (Part B) - Standard Formula',
          density: '0.98',
          percentageValue: '100.00',
          productionHours: '4.00',
          mixingRatioPart: '1', // Hardener part of 2:1 ratio
          status: 'Completed',
          notes: 'Polyamide hardener formula for epoxy base coatings. Mix with Base at 2:1 ratio.',
          createdBy: employeeRows[1].employeeId,
        },
      ])
      .returning();
    console.log(`   ✓ ${pdRows.length} product development records (including 2-component Epoxy)`);

    // BOM Materials - Complete formulas (percentages total 100%)
    // Updated RM Indices: 10-PU929, 11-TiO2, 12-C.Black, 13-BluePht, 14-RedOx, 15-ChromeGrn
    //                     16-CaCO3, 17-Talc, 18-YellowOx, 19-AntiTerra, 20-IClay, 21-Xylene
    //                     22-EthylCello, 23-ButylAcet, 24-DM100, 25-AcrylicRsn, 26-DMWater, 27-ZincPhos
    await db.insert(productDevelopmentMaterials).values([
      // ======================================================================
      // Formula 0: Epoxy Base White Coat (from Excel PU 7038)
      // Total = 100% | Density = 1.08 | 2-component Base
      // ======================================================================
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[10].masterProductId,
        percentage: '55.64',
        sequence: 1,
      }, // PU 929 60%
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[11].masterProductId,
        percentage: '12.37',
        sequence: 2,
      }, // TiO2 Rutile
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[16].masterProductId,
        percentage: '1.24',
        sequence: 3,
      }, // CaCO3 8080
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[18].masterProductId,
        percentage: '0.06',
        sequence: 4,
      }, // Yellow Oxide
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[19].masterProductId,
        percentage: '0.25',
        sequence: 5,
      }, // Anti-Terra U
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[20].masterProductId,
        percentage: '0.99',
        sequence: 6,
      }, // I-Clay
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[21].masterProductId,
        percentage: '25.49',
        sequence: 7,
      }, // Xylene
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[22].masterProductId,
        percentage: '3.71',
        sequence: 8,
      }, // Ethyl Cello
      {
        developmentId: pdRows[0].developmentId,
        materialId: masterProductRows[24].masterProductId,
        percentage: '0.25',
        sequence: 9,
      }, // DM100

      // ======================================================================
      // Formula 1: PU Enamel Black
      // Total = 100% | Density = 1.12
      // ======================================================================
      {
        developmentId: pdRows[1].developmentId,
        materialId: masterProductRows[10].masterProductId,
        percentage: '50.00',
        sequence: 1,
      }, // PU 929 60%
      {
        developmentId: pdRows[1].developmentId,
        materialId: masterProductRows[12].masterProductId,
        percentage: '5.00',
        sequence: 2,
      }, // Carbon Black
      {
        developmentId: pdRows[1].developmentId,
        materialId: masterProductRows[21].masterProductId,
        percentage: '35.00',
        sequence: 3,
      }, // Xylene
      {
        developmentId: pdRows[1].developmentId,
        materialId: masterProductRows[19].masterProductId,
        percentage: '0.50',
        sequence: 4,
      }, // Anti-Terra U
      {
        developmentId: pdRows[1].developmentId,
        materialId: masterProductRows[20].masterProductId,
        percentage: '1.00',
        sequence: 5,
      }, // I-Clay
      {
        developmentId: pdRows[1].developmentId,
        materialId: masterProductRows[23].masterProductId,
        percentage: '8.50',
        sequence: 6,
      }, // Butyl Acetate

      // ======================================================================
      // Formula 2: Interior Premium Emulsion (White)
      // Total = 100% | Density = 1.40
      // ======================================================================
      {
        developmentId: pdRows[2].developmentId,
        materialId: masterProductRows[25].masterProductId,
        percentage: '35.00',
        sequence: 1,
      }, // Acrylic Resin
      {
        developmentId: pdRows[2].developmentId,
        materialId: masterProductRows[11].masterProductId,
        percentage: '20.00',
        sequence: 2,
      }, // TiO2 Rutile
      {
        developmentId: pdRows[2].developmentId,
        materialId: masterProductRows[16].masterProductId,
        percentage: '15.00',
        sequence: 3,
      }, // CaCO3
      {
        developmentId: pdRows[2].developmentId,
        materialId: masterProductRows[17].masterProductId,
        percentage: '5.00',
        sequence: 4,
      }, // Talc
      {
        developmentId: pdRows[2].developmentId,
        materialId: masterProductRows[26].masterProductId,
        percentage: '25.00',
        sequence: 5,
      }, // DM Water

      // ======================================================================
      // Formula 3: Premium White Primer
      // Total = 100% | Density = 1.42
      // ======================================================================
      {
        developmentId: pdRows[3].developmentId,
        materialId: masterProductRows[25].masterProductId,
        percentage: '30.00',
        sequence: 1,
      }, // Acrylic Resin
      {
        developmentId: pdRows[3].developmentId,
        materialId: masterProductRows[11].masterProductId,
        percentage: '25.00',
        sequence: 2,
      }, // TiO2 Rutile (higher for opacity)
      {
        developmentId: pdRows[3].developmentId,
        materialId: masterProductRows[16].masterProductId,
        percentage: '18.00',
        sequence: 3,
      }, // CaCO3
      {
        developmentId: pdRows[3].developmentId,
        materialId: masterProductRows[17].masterProductId,
        percentage: '7.00',
        sequence: 4,
      }, // Talc
      {
        developmentId: pdRows[3].developmentId,
        materialId: masterProductRows[26].masterProductId,
        percentage: '20.00',
        sequence: 5,
      }, // DM Water

      // ======================================================================
      // Formula 4: Luxury Blue Emulsion
      // Total = 100% | Density = 1.38
      // ======================================================================
      {
        developmentId: pdRows[4].developmentId,
        materialId: masterProductRows[25].masterProductId,
        percentage: '32.00',
        sequence: 1,
      }, // Acrylic Resin
      {
        developmentId: pdRows[4].developmentId,
        materialId: masterProductRows[11].masterProductId,
        percentage: '12.00',
        sequence: 2,
      }, // TiO2 Rutile (base white)
      {
        developmentId: pdRows[4].developmentId,
        materialId: masterProductRows[13].masterProductId,
        percentage: '8.00',
        sequence: 3,
      }, // Blue Phthalocyanine
      {
        developmentId: pdRows[4].developmentId,
        materialId: masterProductRows[16].masterProductId,
        percentage: '15.00',
        sequence: 4,
      }, // CaCO3
      {
        developmentId: pdRows[4].developmentId,
        materialId: masterProductRows[17].masterProductId,
        percentage: '5.00',
        sequence: 5,
      }, // Talc
      {
        developmentId: pdRows[4].developmentId,
        materialId: masterProductRows[24].masterProductId,
        percentage: '0.50',
        sequence: 6,
      }, // DM100
      {
        developmentId: pdRows[4].developmentId,
        materialId: masterProductRows[26].masterProductId,
        percentage: '27.50',
        sequence: 7,
      }, // DM Water

      // ======================================================================
      // Formula 5: Royal Red Enamel
      // Total = 100% | Density = 1.45
      // ======================================================================
      {
        developmentId: pdRows[5].developmentId,
        materialId: masterProductRows[10].masterProductId,
        percentage: '45.00',
        sequence: 1,
      }, // PU 929 60%
      {
        developmentId: pdRows[5].developmentId,
        materialId: masterProductRows[14].masterProductId,
        percentage: '18.00',
        sequence: 2,
      }, // Red Oxide Pigment
      {
        developmentId: pdRows[5].developmentId,
        materialId: masterProductRows[16].masterProductId,
        percentage: '5.00',
        sequence: 3,
      }, // CaCO3
      {
        developmentId: pdRows[5].developmentId,
        materialId: masterProductRows[19].masterProductId,
        percentage: '0.50',
        sequence: 4,
      }, // Anti-Terra U
      {
        developmentId: pdRows[5].developmentId,
        materialId: masterProductRows[20].masterProductId,
        percentage: '1.00',
        sequence: 5,
      }, // I-Clay
      {
        developmentId: pdRows[5].developmentId,
        materialId: masterProductRows[21].masterProductId,
        percentage: '25.00',
        sequence: 6,
      }, // Xylene
      {
        developmentId: pdRows[5].developmentId,
        materialId: masterProductRows[23].masterProductId,
        percentage: '5.50',
        sequence: 7,
      }, // Butyl Acetate

      // ======================================================================
      // Formula 6: Olive Green Primer (Anti-Corrosive)
      // Total = 100% | Density = 1.40
      // ======================================================================
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[10].masterProductId,
        percentage: '40.00',
        sequence: 1,
      }, // PU 929 60%
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[15].masterProductId,
        percentage: '12.00',
        sequence: 2,
      }, // Chrome Green Oxide
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[27].masterProductId,
        percentage: '10.00',
        sequence: 3,
      }, // Zinc Phosphate (anti-corrosion)
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[18].masterProductId,
        percentage: '3.00',
        sequence: 4,
      }, // Yellow Oxide (tinting)
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[16].masterProductId,
        percentage: '5.00',
        sequence: 5,
      }, // CaCO3
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[19].masterProductId,
        percentage: '0.50',
        sequence: 6,
      }, // Anti-Terra U
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[20].masterProductId,
        percentage: '1.50',
        sequence: 7,
      }, // I-Clay
      {
        developmentId: pdRows[6].developmentId,
        materialId: masterProductRows[21].masterProductId,
        percentage: '28.00',
        sequence: 8,
      }, // Xylene

      // ======================================================================
      // Formula 7: Golden Yellow Emulsion
      // Total = 100% | Density = 1.36
      // ======================================================================
      {
        developmentId: pdRows[7].developmentId,
        materialId: masterProductRows[25].masterProductId,
        percentage: '33.00',
        sequence: 1,
      }, // Acrylic Resin
      {
        developmentId: pdRows[7].developmentId,
        materialId: masterProductRows[11].masterProductId,
        percentage: '10.00',
        sequence: 2,
      }, // TiO2 Rutile (base white)
      {
        developmentId: pdRows[7].developmentId,
        materialId: masterProductRows[18].masterProductId,
        percentage: '12.00',
        sequence: 3,
      }, // Yellow Oxide Pigment
      {
        developmentId: pdRows[7].developmentId,
        materialId: masterProductRows[16].masterProductId,
        percentage: '12.00',
        sequence: 4,
      }, // CaCO3
      {
        developmentId: pdRows[7].developmentId,
        materialId: masterProductRows[17].masterProductId,
        percentage: '5.00',
        sequence: 5,
      }, // Talc
      {
        developmentId: pdRows[7].developmentId,
        materialId: masterProductRows[24].masterProductId,
        percentage: '0.50',
        sequence: 6,
      }, // DM100
      {
        developmentId: pdRows[7].developmentId,
        materialId: masterProductRows[26].masterProductId,
        percentage: '27.50',
        sequence: 7,
      }, // DM Water

      // ======================================================================
      // Formula 8: Epoxy Hardener (Part B) - for 2-component system
      // Total = 100% | Density = 0.98 | Polyamide-based hardener
      // ======================================================================
      {
        developmentId: pdRows[8].developmentId,
        materialId: masterProductRows[10].masterProductId,
        percentage: '55.00',
        sequence: 1,
      }, // PU 929 60% (amine modified)
      {
        developmentId: pdRows[8].developmentId,
        materialId: masterProductRows[21].masterProductId,
        percentage: '35.00',
        sequence: 2,
      }, // Xylene (solvent)
      {
        developmentId: pdRows[8].developmentId,
        materialId: masterProductRows[22].masterProductId,
        percentage: '8.00',
        sequence: 3,
      }, // Ethyl Cello
      {
        developmentId: pdRows[8].developmentId,
        materialId: masterProductRows[19].masterProductId,
        percentage: '1.00',
        sequence: 4,
      }, // Anti-Terra U
      {
        developmentId: pdRows[8].developmentId,
        materialId: masterProductRows[20].masterProductId,
        percentage: '1.00',
        sequence: 5,
      }, // I-Clay
    ]);
    console.log('   ✓ BOM materials added to all formulas (9 formulas including Epoxy Hardener)');

    // ============================================================
    // LEVEL 7: Customers
    // ============================================================
    console.log('\n👥 Level 7: Customers...');

    const customerRows = await db
      .insert(customers)
      .values([
        {
          companyName: 'ABC Industrial Coatings Pvt Ltd',
          contactPerson: 'Mr. Rakesh Mehta',
          mobileNo: ['9100000001', '9100000002'],
          countryCode: ['+91', '+91'],
          emailId: 'rakesh@abcindustrial.com',
          location: 'Mumbai',
          address: 'Plot 45, MIDC Industrial Area, Andheri East, Mumbai - 400093',
          gstNumber: '27AAAAA0000A1Z5',
          salesPersonId: employeeRows[2].employeeId,
          customerTypeId: null,
          isActive: true,
        },
        {
          companyName: 'Prime Paints Distributors',
          contactPerson: 'Mr. Sunil Verma',
          mobileNo: ['9200000001'],
          countryCode: ['+91'],
          emailId: 'sunil@primepaints.com',
          location: 'Delhi',
          address: '12, Okhla Industrial Estate Phase-2, New Delhi - 110020',
          gstNumber: '07BBBBB0000B1Z5',
          salesPersonId: employeeRows[3].employeeId,
          customerTypeId: null,
          isActive: true,
        },
        {
          companyName: 'Southern Coatings & Chemicals',
          contactPerson: 'Ms. Kavitha Reddy',
          mobileNo: ['9300000001'],
          countryCode: ['+91'],
          emailId: 'kavitha@southerncoatings.com',
          location: 'Chennai',
          address: 'No. 88, Industrial Estate, Ambattur, Chennai - 600058',
          gstNumber: '33CCCCC0000C1Z5',
          salesPersonId: employeeRows[2].employeeId,
          customerTypeId: null,
          isActive: true,
        },
        {
          companyName: 'Gujarat Paint House',
          contactPerson: 'Mr. Jayesh Patel',
          mobileNo: ['9400000001'],
          countryCode: ['+91'],
          emailId: 'jayesh@gujaratpaint.com',
          location: 'Ahmedabad',
          address: 'Survey No. 234, GIDC Phase-3, Vatva, Ahmedabad - 382445',
          gstNumber: '24DDDDD0000D1Z5',
          salesPersonId: employeeRows[3].employeeId,
          customerTypeId: null,
          isActive: true,
        },
        {
          companyName: 'Eastern Hardware & Paints',
          contactPerson: 'Mr. Santosh Das',
          mobileNo: ['9500000001'],
          countryCode: ['+91'],
          emailId: 'santosh@easternhw.com',
          location: 'Kolkata',
          address: 'Block C, Salt Lake Sector V, Kolkata - 700091',
          gstNumber: '19EEEEE0000E1Z5',
          salesPersonId: employeeRows[2].employeeId,
          customerTypeId: null,
          isActive: true,
        },
      ])
      .returning();
    console.log(`   ✓ ${customerRows.length} customers created`);

    // ============================================================
    // LEVEL 8: Sample Orders
    // ============================================================
    console.log('\n📋 Level 8: Sample Orders...');

    const orderRows = await db
      .insert(orders)
      .values([
        {
          orderNumber: 'ORD-2024-0001',
          customerId: customerRows[0].customerId,
          orderDate: new Date('2024-12-15'),
          status: 'Accepted',
          totalAmount: '45000.00',
          notes: 'Urgent order - Industrial project deadline',
          createdBy: employeeRows[2].employeeId,
        },
        {
          orderNumber: 'ORD-2024-0002',
          customerId: customerRows[1].customerId,
          orderDate: new Date('2024-12-16'),
          status: 'Pending',
          totalAmount: '28000.00',
          notes: 'Regular stock replenishment',
          createdBy: employeeRows[3].employeeId,
        },
        {
          orderNumber: 'ORD-2024-0003',
          customerId: customerRows[2].customerId,
          orderDate: new Date('2024-12-17'),
          status: 'Pending',
          totalAmount: '52000.00',
          notes: 'Large construction project requirement',
          createdBy: employeeRows[2].employeeId,
        },
      ])
      .returning();
    console.log(`   ✓ ${orderRows.length} sample orders created`);

    // Order Details
    await db.insert(orderDetails).values([
      // Order 1: Epoxy White 20L x 10
      {
        orderId: orderRows[0].orderId,
        productId: productRows[0].productId,
        quantity: 10,
        unitPrice: '4500.00',
        discount: '0',
        totalPrice: '45000.00',
      },

      // Order 2: Mix of products
      {
        orderId: orderRows[1].orderId,
        productId: productRows[5].productId,
        quantity: 5,
        unitPrice: '3200.00',
        discount: '0',
        totalPrice: '16000.00',
      },
      {
        orderId: orderRows[1].orderId,
        productId: productRows[7].productId,
        quantity: 4,
        unitPrice: '2800.00',
        discount: '5',
        totalPrice: '10640.00',
      },

      // Order 3: Large quantity
      {
        orderId: orderRows[2].orderId,
        productId: productRows[0].productId,
        quantity: 8,
        unitPrice: '4500.00',
        discount: '0',
        totalPrice: '36000.00',
      },
      {
        orderId: orderRows[2].orderId,
        productId: productRows[3].productId,
        quantity: 10,
        unitPrice: '1100.00',
        discount: '0',
        totalPrice: '11000.00',
      },
      {
        orderId: orderRows[2].orderId,
        productId: productRows[5].productId,
        quantity: 2,
        unitPrice: '3200.00',
        discount: '20',
        totalPrice: '5120.00',
      },
    ]);
    console.log('   ✓ Order details added');

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SEED COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n🔑 Login Credentials:');
    console.log('   admin    / admin123     (SuperAdmin)');
    console.log('   rajesh   / password123  (Production Manager)');
    console.log('   priya    / password123  (Sales Manager)');
    console.log('   amit     / password123  (Sales Executive)');
    console.log('   deepak   / password123  (Production Supervisor)');
    console.log('   sunita   / password123  (Inventory Manager)');
    console.log('\n📊 Data Summary:');
    console.log(`   • ${masterProductRows.length} Master Products (10 FG, 18 RM, 5 PM)`);
    console.log(`   • ${productRows.length} Product SKUs`);
    console.log(`   • ${pdRows.length} Product Formulas (with complete BOM)`);
    console.log(`   • ${customerRows.length} Customers`);
    console.log(`   • ${orderRows.length} Sample Orders`);
    console.log('\n🎨 Product Development Formulas (9 Formulas):');
    console.log('   1. Epoxy Base White Coat  - 2-component Base (Part A), ratio 2:1');
    console.log('   2. Epoxy Hardener         - 2-component Hardener (Part B)');
    console.log('   3. PU Enamel Black        - Polyurethane black enamel');
    console.log('   4. Interior Emulsion      - Water-based white emulsion');
    console.log('   5. Premium White Primer   - High-quality wall primer');
    console.log('   6. Luxury Blue Emulsion   - Premium blue interior paint');
    console.log('   7. Royal Red Enamel       - Oil-based red enamel');
    console.log('   8. Olive Green Primer     - Anti-corrosive industrial primer');
    console.log('   9. Golden Yellow Emulsion - Bright yellow interior paint');
    console.log('\n🔗 Double Product Development (2-Component):');
    console.log(
      '   • Epoxy Base White Coat (subcategory=Base) links to Epoxy Hardener (subcategory=Hardener)'
    );
    console.log('   • Mixing Ratio: 2:1 (Base:Hardener by volume)');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedDatabase();
