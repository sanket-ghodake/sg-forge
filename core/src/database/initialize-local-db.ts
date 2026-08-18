import { db } from "@database/connection";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Initializing local database schema...");

  // Drop existing tables to ensure clean state
  await db.execute(sql`DROP TABLE IF EXISTS audit_events CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_app_access_request_messages CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_app_access_requests CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_app_admins CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_app_entitlements CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS project_members CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS projects CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS user_org_nodes CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS org_nodes CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS org_node_types CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS user_groups CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS user_teams CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS groups CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS teams CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS departments CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_access_tokens CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_auth_codes CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS user_roles CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS role_permissions CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS permissions CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS roles CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_app_storage CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS forge_apps CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS system_logs CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS users CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS structural_metadata CASCADE;`);

  await db.execute(sql`DROP TRIGGER IF EXISTS trigger_prevent_circular_reporting ON users;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS check_circular_manager;`);
  await db.execute(sql`DROP TRIGGER IF EXISTS trigger_prevent_circular_org_node ON org_nodes;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS check_circular_org_node;`);
  await db.execute(sql`DROP TRIGGER IF EXISTS trigger_enforce_admin_separation ON users;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS enforce_admin_separation;`);

  // Create structural_metadata table
  await db.execute(sql`
    CREATE TABLE structural_metadata (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_id UUID,
      sort_order INTEGER DEFAULT 0 NOT NULL,
      extended_attributes JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create users table
  await db.execute(sql`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      eid VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_password_changed BOOLEAN DEFAULT false NOT NULL,
      role VARCHAR(30) DEFAULT 'user' NOT NULL,
      designation_id UUID REFERENCES structural_metadata(id),
      vertical_id UUID REFERENCES structural_metadata(id),
      manager_id UUID,
      job_level INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
    CREATE UNIQUE INDEX IF NOT EXISTS users_eid_lower_idx ON users (lower(eid));
  `);

  // Create system_logs table
  await db.execute(sql`
    CREATE TABLE system_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      payload JSONB DEFAULT '{}'::jsonb,
      ip_address VARCHAR(45),
      timestamp TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create forge_apps table
  await db.execute(sql`
    CREATE TABLE forge_apps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      entry_url VARCHAR(255) NOT NULL,
      is_isolated_lifecycle BOOLEAN DEFAULT true NOT NULL,
      client_id VARCHAR(255) UNIQUE,
      client_secret VARCHAR(255),
      redirect_uri VARCHAR(255),
      scopes JSONB DEFAULT '[]'::jsonb NOT NULL,
      target_rules JSONB DEFAULT '{}'::jsonb NOT NULL,
      is_enabled BOOLEAN DEFAULT true NOT NULL,
      status VARCHAR(30) DEFAULT 'active' NOT NULL,
      last_seen TIMESTAMP,
      health_check_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create forge_app_storage table
  await db.execute(sql`
    CREATE TABLE forge_app_storage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id UUID REFERENCES forge_apps(id) NOT NULL,
      custom_schema_namespace VARCHAR(63) UNIQUE NOT NULL,
      allow_base_read_access BOOLEAN DEFAULT false NOT NULL
    );
  `);

  // Create roles table
  await db.execute(sql`
    CREATE TABLE roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      parent_role_id UUID REFERENCES roles(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create permissions table
  await db.execute(sql`
    CREATE TABLE permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create role_permissions table
  await db.execute(sql`
    CREATE TABLE role_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
      permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE NOT NULL
    );
  `);

  // Create user_roles table
  await db.execute(sql`
    CREATE TABLE user_roles (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
      PRIMARY KEY (user_id, role_id)
    );
  `);

  // Create forge_auth_codes table
  await db.execute(sql`
    CREATE TABLE forge_auth_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(255) UNIQUE NOT NULL,
      app_id UUID REFERENCES forge_apps(id) ON DELETE CASCADE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT false NOT NULL,
      scope JSONB DEFAULT '[]'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create forge_access_tokens table
  await db.execute(sql`
    CREATE TABLE forge_access_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      access_token VARCHAR(255) UNIQUE NOT NULL,
      app_id UUID REFERENCES forge_apps(id) ON DELETE CASCADE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      scope JSONB DEFAULT '[]'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Drop obsolete rolling system log buffer trigger
  console.log("Dropping obsolete rolling system log buffer trigger...");
  await db.execute(sql`DROP TRIGGER IF EXISTS trigger_prune_system_logs ON system_logs;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS prune_system_logs_buffer;`);

  console.log("Seeding initial system structures from company_data.json...");

  // Read company_data.json
  const dataPath = path.join(__dirname, "../../../test/dummy-data/company_data.json");
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `Mock company data file not found at ${dataPath}. Please run generator script first.`,
    );
  }
  const mockData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  // Seed default metadata
  await db.execute(sql`
    INSERT INTO structural_metadata (id, type, name, sort_order)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'company_name', 'SG Forge', 0)
    ON CONFLICT DO NOTHING;
  `);

  // Stable Vertical IDs mapping to align with proxyGuard and integration tests
  const verticalIds: Record<string, string> = {
    Executive: "10000000-0000-0000-0000-000000000001",
    Engineering: "10000000-0000-0000-0000-000000000002",
    "Product Management": "10000000-0000-0000-0000-000000000003",
    "Sales & Operations": "10000000-0000-0000-0000-000000000004",
    "Human Resources": "10000000-0000-0000-0000-000000000005",
    Finance: "10000000-0000-0000-0000-000000000006",
  };

  // Stable Designation IDs mapping to align with allocation and security tests
  const designationIds: Record<string, string> = {
    "L12 CEO": "20000000-0000-0000-0000-000000000001",
    "L10 VP of Engineering": "20000000-0000-0000-0000-000000000002",
    "L10 VP of Product": "20000000-0000-0000-0000-000000000003",
    "L10 VP of Operations": "20000000-0000-0000-0000-000000000004",
    "L8 Director of Engineering": "20000000-0000-0000-0000-000000000008",
    "L8 Director of Product": "20000000-0000-0000-0000-000000000009",
    "L8 Director of Operations": "20000000-0000-0000-0000-000000000010",
    "L8 Director of HR": "20000000-0000-0000-0000-000000000011",
    "L8 Director of Finance": "20000000-0000-0000-0000-000000000012",
    "L6 Engineering Manager": "20000000-0000-0000-0000-000000000005",
    "L6 Product Manager": "20000000-0000-0000-0000-000000000013",
    "L6 Operations Manager": "20000000-0000-0000-0000-000000000014",
    "L6 Sales Manager": "20000000-0000-0000-0000-000000000015",
    "L6 HR Manager": "20000000-0000-0000-0000-000000000016",
    "L6 Finance Manager": "20000000-0000-0000-0000-000000000017",
    "L5 Senior Software Engineer": "20000000-0000-0000-0000-000000000006",
    "L5 Senior Product Specialist": "20000000-0000-0000-0000-000000000018",
    "L5 Senior Sales Executive": "20000000-0000-0000-0000-000000000019",
    "L5 Senior Operations Specialist": "20000000-0000-0000-0000-000000000020",
    "L4 Software Engineer II": "20000000-0000-0000-0000-000000000007",
    "L4 Product Analyst": "20000000-0000-0000-0000-000000000021",
    "L4 Operations Analyst": "20000000-0000-0000-0000-000000000022",
    "L3 Software Engineer I": "20000000-0000-0000-0000-000000000023",
    "L3 Associate Analyst": "20000000-0000-0000-0000-000000000024",
  };

  // Seed Verticals and Designations from JSON
  const verticalIdMap = new Map<string, string>();
  const designationIdMap = new Map<string, string>();

  // 1. Seed Verticals
  for (let i = 0; i < mockData.verticals.length; i++) {
    const vName = mockData.verticals[i].name;
    const id = verticalIds[vName] || crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO structural_metadata (id, type, name, sort_order)
      VALUES (${id}, 'vertical', ${vName}, ${i});
    `);
    verticalIdMap.set(vName, id);
  }

  // 2. Seed Job levels (Designations)
  for (let i = 0; i < mockData.jobLevels.length; i++) {
    const dName = mockData.jobLevels[i].name;
    const id = designationIds[dName] || crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO structural_metadata (id, type, name, sort_order)
      VALUES (${id}, 'job_level', ${dName}, ${i});
    `);
    designationIdMap.set(dName, id);
  }

  // 3. Seed Users with temporary manager_id = NULL
  // Safe mock bcrypt hash representing 'password123' used purely for local development database seeding.
  const adminPasswordHash = "$2b$10$8Gub3V3ScET0bRZPdM8ONeG543SkOwVKLcfO6jU0CjmGlGxPRrAVm"; // password123 // nosemgrep: generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash
  const userEidToIdMap = new Map<string, string>();

  for (const emp of mockData.employees) {
    let designationId = designationIdMap.get(emp.designation) || null;
    if (emp.designation && !designationId) {
      const newId = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO structural_metadata (id, type, name, sort_order)
        VALUES (${newId}, 'job_level', ${emp.designation}, 100);
      `);
      designationIdMap.set(emp.designation, newId);
      designationId = newId;
    }
    const verticalId = verticalIdMap.get(emp.vertical) || null;

    let jobLevel = 1;
    const desName = emp.designation.toLowerCase();
    if (desName.includes("ceo")) jobLevel = 5;
    else if (desName.includes("vp")) jobLevel = 4;
    else if (desName.includes("director") || desName.includes("manager")) jobLevel = 3;
    else if (desName.includes("senior")) jobLevel = 2;

    const result = await db.execute(sql`
      INSERT INTO users (eid, name, email, password_hash, is_password_changed, role, designation_id, vertical_id, manager_id, job_level)
      VALUES (${emp.eid}, ${emp.name}, ${emp.email.toLowerCase().trim()}, ${adminPasswordHash}, false, ${emp.role}, ${designationId}, ${verticalId}, NULL, ${jobLevel})
      RETURNING id;
    `);
    const id = (result.rows || result)[0].id as string;
    userEidToIdMap.set(emp.eid, id);
  }

  // 4. Update manager_id for users based on managerEid references
  for (const emp of mockData.employees) {
    if (emp.managerEid) {
      const userId = userEidToIdMap.get(emp.eid);
      const managerId = userEidToIdMap.get(emp.managerEid) || null;
      if (userId && managerId) {
        await db.execute(sql`
          UPDATE users
          SET manager_id = ${managerId}
          WHERE id = ${userId};
        `);
      }
    }
  }

  console.log("Seeding roles & permissions hierarchy...");

  // Seed Roles
  const rolesSeed = [
    { id: "30000000-0000-0000-0000-000000000001", name: "super_admin", parentRoleId: null },
    {
      id: "30000000-0000-0000-0000-000000000002",
      name: "admin",
      parentRoleId: "30000000-0000-0000-0000-000000000001",
    },
    {
      id: "30000000-0000-0000-0000-000000000003",
      name: "read_only_admin",
      parentRoleId: "30000000-0000-0000-0000-000000000002",
    },
    {
      id: "30000000-0000-0000-0000-000000000004",
      name: "user",
      parentRoleId: "30000000-0000-0000-0000-000000000003",
    },
  ];

  for (const r of rolesSeed) {
    await db.execute(sql`
      INSERT INTO roles (id, name, parent_role_id)
      VALUES (${r.id}, ${r.name}, ${r.parentRoleId});
    `);
  }

  // Seed Permissions
  const permissionsSeed = [
    { id: "40000000-0000-0000-0000-000000000001", action: "user.profile.read" },
    { id: "40000000-0000-0000-0000-000000000002", action: "user.manager.read" },
    { id: "40000000-0000-0000-0000-000000000003", action: "audit.log.write" },
    { id: "40000000-0000-0000-0000-000000000004", action: "expense.create" },
    { id: "40000000-0000-0000-0000-000000000005", action: "expense.read" },
    { id: "40000000-0000-0000-0000-000000000006", action: "expense.approve" },
    { id: "40000000-0000-0000-0000-000000000007", action: "expense.delete" },
  ];

  for (const p of permissionsSeed) {
    await db.execute(sql`
      INSERT INTO permissions (id, action)
      VALUES (${p.id}, ${p.action});
    `);
  }

  // Seed Role Permissions (user gets base access, admin gets audit access)
  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES 
      ('30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001'),
      ('30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002'),
      ('30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003'),
      -- User role gets expense create/read
      ('30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004'),
      ('30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000005'),
      -- Admin role gets expense approve/delete
      ('30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000006'),
      ('30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000007');
  `);

  // Map users to roles in user_roles
  for (const emp of mockData.employees) {
    const userId = userEidToIdMap.get(emp.eid);
    if (userId) {
      const roleName = emp.role; // 'super_admin' | 'admin' | 'read_only_admin' | 'user'
      const roleId =
        rolesSeed.find((r) => r.name === roleName)?.id || "30000000-0000-0000-0000-000000000004"; // default to user
      await db.execute(sql`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (${userId}, ${roleId});
      `);
    }
  }

  // Create Sprint B identity foundation tables
  console.log("Seeding Sprint B Identity tables...");
  await db.execute(sql`
    CREATE TABLE departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      parent_id UUID REFERENCES departments(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE TABLE teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE TABLE groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE TABLE user_teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE TABLE user_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL
    );
  `);

  console.log("Creating Org Node Hierarchy and Marketplace tables...");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS ltree;`);

  await db.execute(sql`
    CREATE TABLE org_node_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(50) UNIQUE NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    );
  `);

  await db.execute(sql`
    CREATE TABLE org_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      node_type_id UUID REFERENCES org_node_types(id),
      parent_id UUID REFERENCES org_nodes(id) ON DELETE SET NULL,
      path ltree NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`CREATE INDEX idx_org_nodes_path ON org_nodes USING gist(path);`);

  await db.execute(sql`
    CREATE TABLE user_org_nodes (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      node_id UUID REFERENCES org_nodes(id) ON DELETE CASCADE,
      role_type VARCHAR(50) DEFAULT 'member',
      is_primary BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      PRIMARY KEY (user_id, node_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      owner_id UUID NOT NULL REFERENCES users(id),
      status VARCHAR(30) DEFAULT 'active' NOT NULL,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE project_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(100) DEFAULT 'contributor' NOT NULL,
      allocation_percent INT DEFAULT 100 NOT NULL,
      joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(project_id, user_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE forge_app_entitlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id UUID NOT NULL REFERENCES forge_apps(id) ON DELETE CASCADE,
      subject_type VARCHAR(50) NOT NULL,
      subject_id UUID NOT NULL,
      access_type VARCHAR(10) NOT NULL DEFAULT 'grant',
      granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      starts_at TIMESTAMP DEFAULT NOW() NOT NULL,
      expires_at TIMESTAMP,
      revoked_at TIMESTAMP,
      revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
      revocation_reason TEXT,
      is_break_glass BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(
    sql`CREATE INDEX idx_entitlements_lookup ON forge_app_entitlements (app_id, subject_type, subject_id);`,
  );

  await db.execute(sql`
    CREATE TABLE forge_app_admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id UUID NOT NULL REFERENCES forge_apps(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(app_id, user_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE forge_app_access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id UUID NOT NULL REFERENCES forge_apps(id) ON DELETE CASCADE,
      requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      scope VARCHAR(30) NOT NULL DEFAULT 'individual',
      target_entity_id UUID,
      status VARCHAR(30) NOT NULL DEFAULT 'pending_app_admin',
      manager_reviewed_by UUID REFERENCES users(id),
      manager_notes TEXT,
      app_admin_reviewed_by UUID REFERENCES users(id),
      app_admin_notes TEXT,
      super_admin_reviewed_by UUID REFERENCES users(id),
      super_admin_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE forge_app_access_request_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID REFERENCES forge_app_access_requests(id) ON DELETE CASCADE NOT NULL,
      sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(100) NOT NULL,
      actor_id UUID NOT NULL REFERENCES users(id),
      target_id UUID NOT NULL,
      before_state JSONB,
      after_state JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      signature VARCHAR(256) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  console.log("Creating database circular reporting prevention triggers...");
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION check_circular_manager()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.manager_id IS NOT NULL THEN
            IF EXISTS (
                WITH RECURSIVE reporting_chain AS (
                    SELECT id, manager_id FROM users WHERE id = NEW.manager_id
                    UNION ALL
                    SELECT u.id, u.manager_id 
                    FROM users u
                    INNER JOIN reporting_chain rc ON rc.manager_id = u.id
                )
                SELECT 1 FROM reporting_chain WHERE id = NEW.id
            ) THEN
                RAISE EXCEPTION 'Circular reporting loop detected: User cannot report directly or indirectly to their subordinate.';
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    CREATE TRIGGER trigger_prevent_circular_reporting
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION check_circular_manager();
  `);

  console.log("Creating database admin separation triggers...");
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION enforce_admin_separation()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.role IN ('super_admin', 'admin', 'read_only_admin') THEN
            IF NEW.manager_id IS NOT NULL OR NEW.designation_id IS NOT NULL OR NEW.vertical_id IS NOT NULL THEN
                RAISE EXCEPTION 'Admin separation violation: Administrative accounts cannot have a manager, designation, or vertical.';
            END IF;
            IF EXISTS (
                SELECT 1 FROM users WHERE manager_id = NEW.id
            ) THEN
                RAISE EXCEPTION 'Admin separation violation: Administrative accounts cannot be managers of other users.';
            END IF;
        END IF;

        IF NEW.manager_id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM users 
                WHERE id = NEW.manager_id AND role IN ('super_admin', 'admin', 'read_only_admin')
            ) THEN
                RAISE EXCEPTION 'Admin separation violation: Standard users cannot report to administrative accounts.';
            END IF;
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    CREATE TRIGGER trigger_enforce_admin_separation
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION enforce_admin_separation();
  `);

  await db.execute(sql`
    CREATE OR REPLACE FUNCTION check_circular_org_node()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.parent_id IS NOT NULL THEN
            IF EXISTS (
                WITH RECURSIVE node_chain AS (
                    SELECT id, parent_id FROM org_nodes WHERE id = NEW.parent_id
                    UNION ALL
                    SELECT o.id, o.parent_id 
                    FROM org_nodes o
                    INNER JOIN node_chain nc ON nc.parent_id = o.id
                )
                SELECT 1 FROM node_chain WHERE id = NEW.id
            ) THEN
                RAISE EXCEPTION 'Circular node reference loop detected: Org Node cannot report directly or indirectly to its child node.';
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    CREATE TRIGGER trigger_prevent_circular_org_node
    BEFORE INSERT OR UPDATE ON org_nodes
    FOR EACH ROW EXECUTE FUNCTION check_circular_org_node();
  `);

  console.log("Seeding departments, teams, groups, and user memberships...");

  // 1. Seed Departments based on Verticals in the generated data
  const verticalToDeptIdMap = new Map<string, string>();
  for (const vName of mockData.verticals.map((v: any) => v.name)) {
    const result = await db.execute(sql`
      INSERT INTO departments (name)
      VALUES (${vName})
      RETURNING id;
    `);
    const deptId = (result.rows || result)[0].id as string;
    verticalToDeptIdMap.set(vName, deptId);
  }

  // 2. Seed Teams inside departments
  const verticalToTeamsMap = new Map<string, string[]>();

  // Define team names for each vertical
  const teamDefinitions: Record<string, string[]> = {
    Engineering: ["Core Engine", "Cloud Infra", "AI Models"],
    "Product Management": ["Product Management Team"],
    "Sales & Operations": ["Operations Team", "Sales Team"],
    "Human Resources": ["People Operations Team"],
    Finance: ["Finance Team"],
    Executive: ["Executive Team"],
  };

  for (const [vName, tNames] of Object.entries(teamDefinitions)) {
    const deptId = verticalToDeptIdMap.get(vName);
    if (deptId) {
      const teamIds: string[] = [];
      for (const tName of tNames) {
        const result = await db.execute(sql`
          INSERT INTO teams (name, department_id)
          VALUES (${tName}, ${deptId})
          RETURNING id;
        `);
        const teamId = (result.rows || result)[0].id as string;
        teamIds.push(teamId);
      }
      verticalToTeamsMap.set(vName, teamIds);
    }
  }

  // 3. User Teams associations (assign employees to corresponding teams in their vertical)
  // Admins do not belong to departments/teams.
  for (const emp of mockData.employees) {
    if (emp.role === "user") {
      // working employees only
      const userId = userEidToIdMap.get(emp.eid);
      const teamIds = verticalToTeamsMap.get(emp.vertical);
      if (userId && teamIds && teamIds.length > 0) {
        // Choose team deterministically using EID number
        const eidNum = parseInt(emp.eid.replace(/\D/g, "")) || 0;
        const selectedTeamId = teamIds[eidNum % teamIds.length];
        await db.execute(sql`
          INSERT INTO user_teams (user_id, team_id)
          VALUES (${userId}, ${selectedTeamId});
        `);
      }
    }
  }

  // 4. Seed Groups & User Groups
  const groupNames = ["All Employees", "All Engineers", "Managers & Leads"];
  const groupNameToIdMap = new Map<string, string>();
  for (const gName of groupNames) {
    const result = await db.execute(sql`
      INSERT INTO groups (name)
      VALUES (${gName})
      RETURNING id;
    `);
    const groupId = (result.rows || result)[0].id as string;
    groupNameToIdMap.set(gName, groupId);
  }

  const allEmployeesGroupId = groupNameToIdMap.get("All Employees");
  const allEngineersGroupId = groupNameToIdMap.get("All Engineers");
  const managersLeadsGroupId = groupNameToIdMap.get("Managers & Leads");

  for (const emp of mockData.employees) {
    const userId = userEidToIdMap.get(emp.eid);
    if (!userId) continue;

    if (emp.role === "user") {
      // Add to "All Employees"
      if (allEmployeesGroupId) {
        await db.execute(sql`
          INSERT INTO user_groups (user_id, group_id)
          VALUES (${userId}, ${allEmployeesGroupId});
        `);
      }

      // Add to "All Engineers" if in Engineering vertical
      if (emp.vertical === "Engineering" && allEngineersGroupId) {
        await db.execute(sql`
          INSERT INTO user_groups (user_id, group_id)
          VALUES (${userId}, ${allEngineersGroupId});
        `);
      }

      // Add to "Managers & Leads" if designation matches manager/VP/Director/Senior
      const isLead =
        emp.designation.includes("Manager") ||
        emp.designation.includes("VP") ||
        emp.designation.includes("Director") ||
        emp.designation.includes("CEO") ||
        emp.designation.includes("Senior");
      if (isLead && managersLeadsGroupId) {
        await db.execute(sql`
          INSERT INTO user_groups (user_id, group_id)
          VALUES (${userId}, ${managersLeadsGroupId});
        `);
      }
    }
  }

  console.log("Seeding org node types...");
  const companyTypeId = crypto.randomUUID();
  const divisionTypeId = crypto.randomUUID();
  const departmentTypeId = crypto.randomUUID();
  const teamTypeId = crypto.randomUUID();
  const podTypeId = crypto.randomUUID();

  await db.execute(sql`
    INSERT INTO org_node_types (id, name, sort_order)
    VALUES 
      (${companyTypeId}, 'company', 0),
      (${divisionTypeId}, 'division', 1),
      (${departmentTypeId}, 'department', 2),
      (${teamTypeId}, 'team', 3),
      (${podTypeId}, 'pod', 4);
  `);

  console.log("Seeding root org node...");
  const sanitizeLtreeLabel = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, "_");
  const rootNodeId = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO org_nodes (id, node_type_id, name, parent_id, path, metadata)
    VALUES (${rootNodeId}, ${companyTypeId}, 'SG Forge Root', NULL, 'Top', '{}'::jsonb);
  `);

  // 1. Create Division nodes for each Vertical
  const verticalToNodeIdMap = new Map<string, string>();
  for (const vName of mockData.verticals.map((v: any) => v.name)) {
    const divisionNodeId = crypto.randomUUID();
    const divisionPath = "Top." + sanitizeLtreeLabel(vName);
    await db.execute(sql`
      INSERT INTO org_nodes (id, node_type_id, name, parent_id, path)
      VALUES (${divisionNodeId}, ${divisionTypeId}, ${vName + " Division"}, ${rootNodeId}, ${divisionPath});
    `);
    verticalToNodeIdMap.set(vName, divisionNodeId);
  }

  // 2. Create Team nodes under each Division
  const teamToNodeIdMap = new Map<string, string>();
  for (const [vName, tNames] of Object.entries(teamDefinitions)) {
    const divisionNodeId = verticalToNodeIdMap.get(vName);
    if (divisionNodeId) {
      for (const tName of tNames) {
        const teamNodeId = crypto.randomUUID();
        const teamPath = "Top." + sanitizeLtreeLabel(vName) + "." + sanitizeLtreeLabel(tName);
        await db.execute(sql`
          INSERT INTO org_nodes (id, node_type_id, name, parent_id, path)
          VALUES (${teamNodeId}, ${teamTypeId}, ${tName}, ${divisionNodeId}, ${teamPath});
        `);
        teamToNodeIdMap.set(tName, teamNodeId);
      }
    }
  }

  // 3. User Org Nodes membership (Primary teams and managers/leads)
  for (const emp of mockData.employees) {
    if (emp.role !== "user") continue;
    const userId = userEidToIdMap.get(emp.eid);
    if (!userId) continue;

    const roleType = emp.designation.includes("CEO")
      ? "manager"
      : emp.designation.includes("VP")
        ? "manager"
        : emp.designation.includes("Director")
          ? "manager"
          : emp.designation.includes("Manager")
            ? "lead"
            : "member";

    // If CEO, place them in the root node as 'manager'
    if (emp.designation.includes("CEO")) {
      await db.execute(sql`
        INSERT INTO user_org_nodes (user_id, node_id, role_type, is_primary)
        VALUES (${userId}, ${rootNodeId}, 'manager', true);
      `);
      continue;
    }

    // If VP or Director, place them in their Vertical's Division node as 'manager' / 'lead'
    if (emp.designation.includes("VP") || emp.designation.includes("Director")) {
      const divisionNodeId = verticalToNodeIdMap.get(emp.vertical);
      if (divisionNodeId) {
        await db.execute(sql`
          INSERT INTO user_org_nodes (user_id, node_id, role_type, is_primary)
          VALUES (${userId}, ${divisionNodeId}, ${roleType}, true);
        `);
      }
      continue;
    }

    // For other employees, choose their team deterministically
    const teamNames = teamDefinitions[emp.vertical];
    if (teamNames && teamNames.length > 0) {
      const eidNum = parseInt(emp.eid.replace(/\D/g, "")) || 0;
      const selectedTeamName = teamNames[eidNum % teamNames.length];
      const teamNodeId = teamToNodeIdMap.get(selectedTeamName);
      if (teamNodeId) {
        await db.execute(sql`
          INSERT INTO user_org_nodes (user_id, node_id, role_type, is_primary)
          VALUES (${userId}, ${teamNodeId}, ${roleType}, true);
        `);
      }
    }
  }

  console.log("Seeding projects & project members...");
  const projectOwnerRes = await db.execute(sql`SELECT id FROM users WHERE eid = 'E0005'`);
  const projectOwnerId =
    (projectOwnerRes.rows || projectOwnerRes)[0]?.id || Array.from(userEidToIdMap.values())[0];

  const projectId = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO projects (id, name, code, description, owner_id, status, start_date, end_date)
    VALUES (
      ${projectId}, 
      'Project Delta', 
      'PROJ-DELTA', 
      'End-to-end telemetry system enhancement initiative.', 
      ${projectOwnerId}, 
      'active', 
      '2026-01-01', 
      '2026-12-31'
    );
  `);

  const membersEids = ["E0007", "E0008", "E0009"];
  for (const mEid of membersEids) {
    const memberId = userEidToIdMap.get(mEid);
    if (memberId) {
      await db.execute(sql`
        INSERT INTO project_members (project_id, user_id, role, allocation_percent)
        VALUES (${projectId}, ${memberId}, 'contributor', 50);
      `);
    }
  }

  // Seeding app admins
  const allApps = await db.execute(sql`SELECT id FROM forge_apps`);
  const apps = allApps.rows || allApps;
  const appAdminUserRes = await db.execute(sql`SELECT id FROM users WHERE eid = 'E0005'`);
  const appAdminUserId = (appAdminUserRes.rows || appAdminUserRes)[0]?.id;
  if (appAdminUserId && apps.length > 0) {
    console.log("Seeding app admins...");
    for (const app of apps) {
      await db.execute(sql`
        INSERT INTO forge_app_admins (app_id, user_id)
        VALUES (${app.id}, ${appAdminUserId})
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  // 2026 Security Standards: Database Role Segregation (Principle of Least Privilege)
  console.log("Provisioning isolated database roles and schema permissions...");

  // Create roles if they don't exist
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_reference_expenses') THEN
        CREATE ROLE app_reference_expenses WITH LOGIN PASSWORD 'change_me_expenses_password';
      END IF;
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_reference_go') THEN
        CREATE ROLE app_reference_go WITH LOGIN PASSWORD 'change_me_go_password';
      END IF;
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_reference_python') THEN
        CREATE ROLE app_reference_python WITH LOGIN PASSWORD 'change_me_python_password';
      END IF;
    END
    $$;
  `);

  // Grant CREATE privileges on database to allow isolated schemas and schema-creation on boot
  await db.execute(sql`GRANT CREATE ON DATABASE org_db TO app_reference_expenses;`);
  await db.execute(sql`GRANT CREATE ON DATABASE org_db TO app_reference_go;`);
  await db.execute(sql`GRANT CREATE ON DATABASE org_db TO app_reference_python;`);

  // Drop and recreate schema under individual owners
  await db.execute(sql`DROP SCHEMA IF EXISTS forge_reference_expenses CASCADE;`);
  await db.execute(sql`DROP SCHEMA IF EXISTS forge_reference_go CASCADE;`);
  await db.execute(
    sql`CREATE SCHEMA forge_reference_expenses AUTHORIZATION app_reference_expenses;`,
  );
  await db.execute(sql`CREATE SCHEMA forge_reference_go AUTHORIZATION app_reference_go;`);

  // Grant read-only access to public core tables for JWT offline validation lookup
  await db.execute(sql`GRANT USAGE ON SCHEMA public TO app_reference_expenses;`);
  await db.execute(sql`GRANT SELECT ON public.users TO app_reference_expenses;`);
  await db.execute(sql`GRANT SELECT ON public.forge_access_tokens TO app_reference_expenses;`);
  await db.execute(sql`GRANT SELECT ON public.forge_apps TO app_reference_expenses;`);

  await db.execute(sql`GRANT USAGE ON SCHEMA public TO app_reference_go;`);
  await db.execute(sql`GRANT SELECT ON public.users TO app_reference_go;`);
  await db.execute(sql`GRANT SELECT ON public.forge_access_tokens TO app_reference_go;`);
  await db.execute(sql`GRANT SELECT ON public.forge_apps TO app_reference_go;`);

  console.log("Local database initialization completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to initialize local database:", err);
  process.exit(1);
});
