import db from '../index.js';
import { permissions, roles, rolePermissions } from '../schema/index.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initFieldIntelligence() {
  console.log('🔄 Initializing Field Intelligence Report (FIR) Database Components...');

  try {
    // 1. Run Migration SQL
    const sqlPath = path.resolve(
      __dirname,
      '../../../database_schemas/migrations/field-intelligence-tables.sql'
    );
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration SQL not found at: ${sqlPath}`);
    }

    const migrationSql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📖 Executing Migration SQL to create tables...');

    // Split by semicolons and execute each statement
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
    console.log('✅ Tables created successfully in "app" schema.');

    // 2. Insert Permissions
    const newPermissions = [
      {
        permissionName: 'field_intelligence.view',
        description: 'View Field Intelligence Reports List & Details',
        pagePath: '/operations/field-intelligence',
        pageLabel: 'Field Intelligence',
        pageGroup: 'Sales',
        isPage: true,
        availableActions: [
          'GET:/field-intelligence',
          'GET:/field-intelligence/:id',
          'GET:/field-intelligence/:id/insights',
        ],
      },
      {
        permissionName: 'field_intelligence.create',
        description: 'Create new Field Intelligence Reports',
        pagePath: '/operations/field-intelligence/new',
        pageLabel: 'New Field Intelligence Report',
        pageGroup: 'Sales',
        isPage: true,
        availableActions: ['POST:/field-intelligence', 'POST:/field-intelligence/:id/upload'],
      },
      {
        permissionName: 'field_intelligence.edit',
        description: 'Edit existing Field Intelligence Reports',
        pagePath: '/operations/field-intelligence/:id/edit',
        pageLabel: 'Edit Field Intelligence Report',
        pageGroup: 'Sales',
        isPage: false,
        availableActions: ['PATCH:/field-intelligence/:id'],
      },
      {
        permissionName: 'field_intelligence.delete',
        description: 'Delete Field Intelligence Reports',
        pagePath: '',
        pageLabel: 'Delete Field Intelligence Report',
        pageGroup: 'Sales',
        isPage: false,
        availableActions: ['DELETE:/field-intelligence/:id'],
      },
      {
        permissionName: 'field_intelligence.export',
        description: 'Export Field Intelligence Reports data',
        pagePath: '',
        pageLabel: 'Export Field Intelligence Report',
        pageGroup: 'Sales',
        isPage: false,
        availableActions: ['GET:/field-intelligence/export'],
      },
      {
        permissionName: 'field_intelligence.dashboard',
        description: 'View Field Intelligence Dashboard & Analytics',
        pagePath: '/operations/field-intelligence/dashboard',
        pageLabel: 'Field Intelligence Dashboard',
        pageGroup: 'Sales',
        isPage: true,
        availableActions: ['GET:/field-intelligence/dashboard'],
      },
    ];

    console.log('🔑 Seeding new permissions...');
    const insertedPermissions = [];

    for (const perm of newPermissions) {
      // Check if permission already exists
      const [existing] = await db
        .select()
        .from(permissions)
        .where(eq(permissions.permissionName, perm.permissionName));

      if (!existing) {
        const [inserted] = await db
          .insert(permissions)
          .values({
            permissionName: perm.permissionName,
            description: perm.description,
            pagePath: perm.pagePath,
            pageLabel: perm.pageLabel,
            pageGroup: perm.pageGroup,
            isPage: perm.isPage,
            availableActions: perm.availableActions,
          })
          .returning();
        insertedPermissions.push(inserted);
        console.log(`   ✓ Created permission: ${perm.permissionName}`);
      } else {
        insertedPermissions.push(existing);
        console.log(`   - Permission already exists: ${perm.permissionName}`);
      }
    }

    // 3. Grant Permissions to target roles: SuperAdmin, Admin, Sales Person
    console.log('👑 Granting role-based permissions...');
    const allRoles = await db.select().from(roles);
    const targetRoleNames = ['SuperAdmin', 'Admin', 'Sales Person'];

    for (const roleName of targetRoleNames) {
      const role = allRoles.find(r => r.roleName === roleName);
      if (!role) {
        console.log(`   ⚠️ Role not found in database: ${roleName}`);
        continue;
      }

      for (const perm of insertedPermissions) {
        // Check if role already has this permission
        const [existingMapping] = await db
          .select()
          .from(rolePermissions)
          .where(
            sql`${rolePermissions.roleId} = ${role.roleId} AND ${rolePermissions.permissionId} = ${perm.permissionId}`
          );

        if (!existingMapping) {
          await db.insert(rolePermissions).values({
            roleId: role.roleId,
            permissionId: perm.permissionId,
            grantedActions: perm.availableActions || [],
          });
          console.log(`   ✓ Granted "${perm.permissionName}" to "${role.roleName}"`);
        } else {
          console.log(`   - "${perm.permissionName}" is already mapped to "${role.roleName}"`);
        }
      }
    }

    console.log('🎉 Field Intelligence Report (FIR) initialization complete!');
  } catch (err) {
    console.error('❌ Initialization failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

initFieldIntelligence();
