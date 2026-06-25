/**
 * Sync Permissions Script (CLEAN SYNC)
 *
 * ALWAYS clears ALL permissions and re-inserts fresh from routeRegistry.tsx
 * Ensures DB always matches route registry exactly.
 *
 * Run with: pnpm sync:permissions
 */

import db from '../index.js';
import { permissions, rolePermissions, roles } from '../schema/index.js';
import { eq, inArray, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_PATH = path.resolve(__dirname, '../../../../client/src/config/routeRegistry.tsx');

/**
 * Parse routeRegistry.tsx and extract route definitions with API dependencies
 */
function extractPermissionsFromRegistry(content) {
  const moduleMap = new Map();
  const lines = content.split('\n');
  const routeStack = [];

  let currentRoute = {};
  let depth = 0;
  let inRouteRegistry = false;
  let inApis = false;
  let currentApiBlock = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.includes('export const routeRegistry')) {
      inRouteRegistry = true;
      continue;
    }

    if (!inRouteRegistry) continue;

    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    if (trimmed.includes('apis: [')) {
      inApis = true;
      currentApiBlock = '';
      if (!currentRoute.apis) currentRoute.apis = [];
    }

    if (inApis) {
      currentApiBlock += trimmed;

      // Parse API entries
      const apiMatches = [
        ...currentApiBlock.matchAll(
          /\{\s*route:\s*['"]([^'"]+)['"]\s*,\s*method:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]/g
        ),
      ];

      for (const match of apiMatches) {
        const route = match[1];
        const method = match[2];
        const label = match[3];
        const apiKey = `${method}:${route}`;

        if (!currentRoute.apis.find(a => a.key === apiKey)) {
          currentRoute.apis.push({ key: apiKey, label });
        }
      }

      if (trimmed.includes('],') || (trimmed.includes(']') && !trimmed.includes('['))) {
        inApis = false;
        currentApiBlock = '';
      }
      continue;
    }

    if (trimmed === '{' || trimmed.startsWith('{ ')) {
      depth++;
      routeStack.push(currentRoute);
      currentRoute = {};
    }

    const idMatch = trimmed.match(/^id:\s*['"]([^'"]+)['"]/);
    if (idMatch) currentRoute.id = idMatch[1];

    const pathMatch = trimmed.match(/^path:\s*['"]([^'"]+)['"]/);
    if (pathMatch) currentRoute.path = pathMatch[1];

    const labelMatch = trimmed.match(/^label:\s*['"]([^'"]+)['"]/);
    if (labelMatch) currentRoute.label = labelMatch[1];

    const groupMatch = trimmed.match(/^group:\s*['"]([^'"]+)['"]/);
    if (groupMatch) currentRoute.group = groupMatch[1];

    if (trimmed.includes('showInSidebar: false')) {
      currentRoute.hidden = true;
    }

    const permMatch = trimmed.match(/permission:\s*\{\s*module:\s*['"]([^'"]+)['"]/);
    if (permMatch) {
      currentRoute.module = permMatch[1];
    }

    if (closeBraces > openBraces || trimmed === '},') {
      depth -= closeBraces - openBraces;

      if (currentRoute.module && currentRoute.path && currentRoute.label) {
        const moduleName = currentRoute.module;

        let parentModule = null;
        if (currentRoute.path.includes('/reports/') && moduleName !== 'reports') {
          parentModule = 'reports';
        }

        const entry = {
          name: moduleName,
          path: currentRoute.path,
          label: currentRoute.label,
          group: currentRoute.group || inferGroup(currentRoute.path),
          parent: parentModule,
          hidden: !!currentRoute.hidden,
          id: currentRoute.id,
          availableApis:
            currentRoute.apis && currentRoute.apis.length > 0
              ? currentRoute.apis.map(a => a.key)
              : [],
        };

        if (!moduleMap.has(moduleName)) {
          moduleMap.set(moduleName, []);
        }
        moduleMap.get(moduleName).push(entry);
      }
      currentRoute = routeStack.pop() || {};
    }

    if (depth < 0) break;
  }

  const pages = [];
  for (const [name, occurrences] of moduleMap.entries()) {
    // Filter out hidden routes - only use visible ones
    const visibleOccurrences = occurrences.filter(o => !o.hidden);

    // If no visible routes exist for this module, skip it entirely
    if (visibleOccurrences.length === 0) {
      console.log(`  ⏭️  Skipping hidden module: ${name}`);
      continue;
    }

    // Pick the best visible route (shortest path)
    const best = visibleOccurrences.sort((a, b) => a.path.length - b.path.length)[0];
    pages.push(best);
  }

  return pages;
}

function inferGroup(pathStr) {
  if (pathStr.startsWith('/dashboard')) return 'Main';
  if (pathStr.startsWith('/sales') || pathStr.includes('crm')) return 'Sales';
  if (pathStr.startsWith('/inventory')) return 'Inventory';
  if (pathStr.startsWith('/operations')) return 'Operations';
  if (pathStr.startsWith('/masters')) return 'Masters';
  if (pathStr.startsWith('/reports')) return 'Reports';
  if (pathStr.startsWith('/settings')) return 'Settings';
  return 'Other';
}

async function syncPermissions() {
  console.log('🔄 CLEAN SYNC: Parsing routeRegistry.tsx...\n');

  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      throw new Error(`Registry file not found at: ${REGISTRY_PATH}`);
    }
    const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf-8');

    const pagePermissions = extractPermissionsFromRegistry(registryContent);

    // Add manual settings pages
    const hasRoles = pagePermissions.find(p => p.name === 'roles');
    if (!hasRoles) {
      pagePermissions.push({
        name: 'roles',
        label: 'Roles',
        path: '/settings/roles',
        group: 'Settings',
        availableApis: ['GET:/roles', 'POST:/roles', 'PUT:/roles/:id', 'DELETE:/roles/:id'],
      });
    }

    console.log(`📝 Found ${pagePermissions.length} permissions in route registry:`);
    pagePermissions.forEach(p => {
      const apiCount = p.availableApis?.length || 0;
      console.log(`   - ${p.label} (${p.name}) [${apiCount} APIs]`);
    });

    // ============================================
    // STEP 1: Insert/Update Permissions (Upsert)
    // ============================================
    console.log('\n🚀 Syncing permissions with database...');
    const parentIdMap = {};

    // Get all existing permissions from database
    const existingPerms = await db.select().from(permissions);
    const existingPermMap = new Map(existingPerms.map(p => [p.permissionName, p]));

    for (const page of pagePermissions) {
      const existing = existingPermMap.get(page.name);

      const valuesToUpsert = {
        permissionName: page.name,
        description: `Access to ${page.label}`,
        pagePath: page.path,
        pageLabel: page.label,
        pageGroup: page.group,
        isPage: true,
        availableActions: page.availableApis || [],
      };

      let permissionId;
      if (existing) {
        // Update existing permission
        await db
          .update(permissions)
          .set(valuesToUpsert)
          .where(eq(permissions.permissionId, existing.permissionId));
        permissionId = existing.permissionId;
        console.log(`   ✓ Updated permission: ${page.name}`);
      } else {
        // Insert new permission
        const [created] = await db.insert(permissions).values(valuesToUpsert).returning();
        permissionId = created.permissionId;
        console.log(`   ✓ Created permission: ${page.name}`);
      }
      parentIdMap[page.name] = permissionId;
    }

    // Link parents
    console.log('🔗 Linking parent pages...');
    for (const page of pagePermissions) {
      if (page.parent && parentIdMap[page.parent]) {
        await db
          .update(permissions)
          .set({ parentId: parentIdMap[page.parent] })
          .where(eq(permissions.permissionName, page.name));
      }
    }

    // ============================================
    // STEP 2: Grant/Update Permissions by Role (Upsert)
    // ============================================
    console.log('\n👑 Syncing Role-Based Permissions...');

    const allRoles = await db.select().from(roles);
    const allPerms = await db
      .select({
        id: permissions.permissionId,
        name: permissions.permissionName,
        apis: permissions.availableActions,
      })
      .from(permissions);

    // Get existing role permissions mapping from database
    const existingRolePerms = await db.select().from(rolePermissions);
    const existingMappings = new Map(
      existingRolePerms.map(rp => [`${rp.roleId}_${rp.permissionId}`, rp])
    );

    // Helper to grant permissions
    const grantToRole = async (roleName, allowedModules, isExclusion = false) => {
      const role = allRoles.find(
        r => r.roleName === roleName || (roleName === 'Sales%' && r.roleName.startsWith('Sales'))
      );
      if (!role) {
        console.warn(`   ⚠️ Role not found: ${roleName}`);
        return;
      }

      let targetPerms = [];
      if (isExclusion) {
        // Grant ALL except excluded
        targetPerms = allPerms.filter(
          p => !allowedModules.includes(p.name) && !allowedModules.some(m => p.name.startsWith(m))
        );
      } else {
        // Grant ONLY allowed
        targetPerms = allPerms.filter(p => allowedModules.includes(p.name));
      }

      for (const perm of targetPerms) {
        const key = `${role.roleId}_${perm.id}`;
        const existingMapping = existingMappings.get(key);
        const desiredApis = Array.isArray(perm.apis) ? perm.apis : [];

        if (existingMapping) {
          // Merge APIs (ensure new APIs are added, keep existing ones)
          const currentApis = Array.isArray(existingMapping.grantedActions)
            ? existingMapping.grantedActions
            : [];

          const mergedApis = Array.from(new Set([...currentApis, ...desiredApis]));
          const hasChange =
            mergedApis.length !== currentApis.length ||
            !currentApis.every(api => mergedApis.includes(api));

          if (hasChange) {
            await db
              .update(rolePermissions)
              .set({ grantedActions: mergedApis })
              .where(
                sql`${rolePermissions.roleId} = ${role.roleId} AND ${rolePermissions.permissionId} = ${perm.id}`
              );
            console.log(`   ✓ Updated mapping: ${role.roleName} -> ${perm.name} (merged APIs)`);
          }
        } else {
          // Insert new mapping
          await db.insert(rolePermissions).values({
            roleId: role.roleId,
            permissionId: perm.id,
            grantedActions: desiredApis,
          });
          console.log(`   ✓ Granted new mapping: ${role.roleName} -> ${perm.name}`);
        }
      }
    };

    // 1. SuperAdmin (ALL)
    await grantToRole('SuperAdmin', [], true); // Exclude nothing = Grant All

    // 2. Admin
    const adminExcluded = [
      'departments',
      'notifications',
      'employees',
      'units',
      'tnc',
      'product-development',
      'double-development',
      'update-product',
      'roles', // Settings
    ];
    await grantToRole('Admin', adminExcluded, true);

    // 3. Production Manager / Production
    const productionIncluded = [
      'admin-dashboard',
      'accepted-orders',
      'production-manager',
      'dispatch-planning',
      'delivery-complete',
      'production',
      'inward',
      'inward-from-po',
      'split-order',
      'report-batch',
      'report-inward',
      'report-stock',
      'test_certificate', // Test Certificate permission for Production Manager
    ];
    await grantToRole('Production Manager', productionIncluded);
    await grantToRole('Production', productionIncluded);

    // 4. Sales
    const salesIncluded = [
      'admin-dashboard',
      'sales_access',
      'orders',
      'quotations',
      'notifications',
      'Add New Customer',
      'report-customer-contact',
      'report-customer-sales',
      'quotation-maker',
      'payment-entry',
      'payment-report',
      'field_intelligence', // SMART CRM permission for Sales Person
    ];
    const salesRoleList = allRoles.filter(
      r => r.roleName.startsWith('Sales') && r.roleName !== 'Dealer'
    );
    for (const r of salesRoleList) {
      await grantToRole(r.roleName, salesIncluded);
    }

    // 5. Dealer
    // Inclusions: admin-dashboard, orders, quotations
    const dealerIncluded = ['admin-dashboard', 'orders', 'quotations', 'quotation-maker'];
    await grantToRole('Dealer', dealerIncluded);

    console.log(`\n✅ CLEAN SYNC complete! Permissions matched to route registry.`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

syncPermissions()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
