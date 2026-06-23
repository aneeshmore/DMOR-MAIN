import db from '../index.js';
import { permissions, roles, rolePermissions } from '../schema/index.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initTestCertificate() {
  console.log('🔄 Initializing Test Certificate Database Components...');

  try {
    // 1. Run Migration SQL (Note: In production/safety, user will execute this manually)
    const sqlPath = path.resolve(
      __dirname,
      '../../../database_schemas/test-certificate-migration.sql'
    );
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration SQL not found at: ${sqlPath}`);
    }

    const migrationSql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📖 Executing Migration SQL to create tables...');

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
        permissionName: 'test_certificate.view',
        description: 'View Test Certificates List & Details',
        pagePath: '/operations/test-certificate',
        pageLabel: 'Test Certificate',
        pageGroup: 'Operations',
        isPage: true,
        availableActions: [
          'GET:/test-certificates',
          'GET:/test-certificates/:id',
          'GET:/test-certificates/completed-batches',
          'GET:/test-certificates/completed-batches/:id',
        ],
      },
      {
        permissionName: 'test_certificate.create',
        description: 'Create new Test Certificates',
        pagePath: '/operations/test-certificate/create',
        pageLabel: 'Create Test Certificate',
        pageGroup: 'Operations',
        isPage: true,
        availableActions: ['POST:/test-certificates'],
      },
      {
        permissionName: 'test_certificate.edit',
        description: 'Edit existing Test Certificates',
        pagePath: '/operations/test-certificate/:id/edit',
        pageLabel: 'Edit Test Certificate',
        pageGroup: 'Operations',
        isPage: false,
        availableActions: ['PUT:/test-certificates/:id'],
      },
      {
        permissionName: 'test_certificate.delete',
        description: 'Delete Test Certificates',
        pagePath: '',
        pageLabel: 'Delete Test Certificate',
        pageGroup: 'Operations',
        isPage: false,
        availableActions: ['DELETE:/test-certificates/:id'],
      },
      {
        permissionName: 'test_certificate.print',
        description: 'Print or Download Test Certificates PDF',
        pagePath: '',
        pageLabel: 'Print Test Certificate',
        pageGroup: 'Operations',
        isPage: false,
        availableActions: ['GET:/test-certificates/:id'],
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

    // 3. Grant Permissions to target roles: SuperAdmin, Admin, Production Manager
    console.log('👑 Granting role-based permissions...');
    const allRoles = await db.select().from(roles);
    const targetRoleNames = ['SuperAdmin', 'Admin', 'Production Manager'];

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

    console.log('🎉 Test Certificate initialization complete!');
  } catch (err) {
    console.error('❌ Initialization failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

initTestCertificate();
