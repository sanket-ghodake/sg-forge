import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Custom ltree type definition for PostgreSQL ltree extension
export const ltree = customType<{ data: string }>({
  dataType() {
    return "ltree";
  },
});

// Core User Account Profiles
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eid: varchar("eid", { length: 50 }).unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    isPasswordChanged: boolean("is_password_changed").default(false).notNull(),
    role: varchar("role", { length: 30 }).default("user").notNull(), // 'super_admin' | 'admin' | 'read_only_admin' | 'user'
    designationId: uuid("designation_id").references(() => structuralMetadata.id),
    verticalId: uuid("vertical_id").references(() => structuralMetadata.id),
    managerId: uuid("manager_id"), // Relational self-reference to immediate upline user id
    jobLevel: integer("job_level").default(1).notNull(), // (1 = Staff, 2 = Senior, 3 = Manager, 4 = VP, 5 = C-Suite)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
    uniqueIndex("users_eid_lower_idx").on(sql`lower(${table.eid})`),
  ],
);

// Dynamic Metadata Definition Matrix
export const structuralMetadata = pgTable("structural_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'company_name' | 'vertical' | 'job_level'
  name: varchar("name", { length: 255 }).notNull(),
  parentId: uuid("parent_id"), // Used for nested organizational levels or reporting units
  sortOrder: integer("sort_order").default(0).notNull(),
  extendedAttributes: jsonb("extended_attributes").default({}), // Caters to custom operational key-value fields
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// System Log Ring-Buffer Model
export const systemLogs = pgTable("system_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(), // 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  payload: jsonb("payload").default({}),
  ipAddress: varchar("ip_address", { length: 45 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Forge App Registry Ledger
export const forgeApps = pgTable("forge_apps", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 50 }).unique().notNull(), // e.g., 'nexus-provisioning'
  name: varchar("name", { length: 100 }).notNull(),
  entryUrl: varchar("entry_url", { length: 255 }).notNull(), // Intranet target IP or internal routing path
  isIsolatedLifecycle: boolean("is_isolated_lifecycle").default(true).notNull(),

  // App Manifest v2 Fields
  clientId: varchar("client_id", { length: 255 }).unique(),
  clientSecret: varchar("client_secret", { length: 255 }),
  redirectUri: varchar("redirect_uri", { length: 255 }),
  scopes: jsonb("scopes").default([]).notNull(), // List of base/requested permissions (e.g. ['user.profile.read'])

  // Conditional Allocation Matrix Rule
  // Example Value: { "designations": ["uuid-1"], "verticals": ["uuid-2"], "minJobLevel": 2 }
  targetRules: jsonb("target_rules").default({}).notNull(),

  // Sprint B Lifecycle & Health Monitoring
  isEnabled: boolean("is_enabled").default(true).notNull(),
  status: varchar("status", { length: 30 }).default("active").notNull(), // 'active' | 'offline' | 'degraded'
  lastSeen: timestamp("last_seen"),
  healthCheckUrl: varchar("health_check_url", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// App Database Isolation Provisioning Matrix
export const forgeAppStorage = pgTable("forge_app_storage", {
  id: uuid("id").defaultRandom().primaryKey(),
  appId: uuid("app_id")
    .references(() => forgeApps.id)
    .notNull(),
  customSchemaNamespace: varchar("custom_schema_namespace", { length: 63 }).unique().notNull(), // Isolated database namespace
  allowBaseReadAccess: boolean("allow_base_read_access").default(false).notNull(),
});

// Permission Engine (ACL / Hierarchical RBAC)
export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).unique().notNull(), // 'super_admin' | 'admin' | 'read_only_admin' | 'user'
  parentRoleId: uuid("parent_role_id").references((): any => roles.id), // Self reference for hierarchical RBAC delegation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: varchar("action", { length: 100 }).unique().notNull(), // e.g., 'user.profile.read', 'audit.log.write'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id")
    .references(() => roles.id, { onDelete: "cascade" })
    .notNull(),
  permissionId: uuid("permission_id")
    .references(() => permissions.id, { onDelete: "cascade" })
    .notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    roleId: uuid("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
  }),
);

// Handshake & Auth Handshake exchange flows
export const forgeAuthCodes = pgTable("forge_auth_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 255 }).unique().notNull(),
  appId: uuid("app_id")
    .references(() => forgeApps.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  scope: jsonb("scope").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const forgeAccessTokens = pgTable("forge_access_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  accessToken: varchar("access_token", { length: 255 }).unique().notNull(),
  appId: uuid("app_id")
    .references(() => forgeApps.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  scope: jsonb("scope").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Identity Foundation Tables (Departments, Teams, Groups)
export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: uuid("parent_id"), // hierarchical link to self
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userTeams = pgTable("user_teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
});

export const userGroups = pgTable("user_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  groupId: uuid("group_id")
    .references(() => groups.id, { onDelete: "cascade" })
    .notNull(),
});

// Unified Org Node Hierarchy (Vertical Dimension)
export const orgNodeTypes = pgTable("org_node_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).unique().notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const orgNodes = pgTable("org_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nodeTypeId: uuid("node_type_id").references(() => orgNodeTypes.id),
  parentId: uuid("parent_id").references((): any => orgNodes.id, { onDelete: "set null" }),
  path: ltree("path").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userOrgNodes = pgTable(
  "user_org_nodes",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nodeId: uuid("node_id")
      .references(() => orgNodes.id, { onDelete: "cascade" })
      .notNull(),
    roleType: varchar("role_type", { length: 50 }).default("member").notNull(), // 'member', 'lead', 'manager'
    isPrimary: boolean("is_primary").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.nodeId] }),
  }),
);

// Horizontal Matrix Projects
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }).unique().notNull(),
  description: text("description"),
  ownerId: uuid("owner_id")
    .references(() => users.id)
    .notNull(),
  status: varchar("status", { length: 30 }).default("active").notNull(), // 'planning' | 'active' | 'completed' | 'paused'
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 100 }).default("contributor").notNull(), // 'lead' | 'contributor' | 'observer'
  allocationPercent: integer("allocation_percent").default(100).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Granular App Entitlements Engine
export const forgeAppEntitlements = pgTable("forge_app_entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  appId: uuid("app_id")
    .references(() => forgeApps.id, { onDelete: "cascade" })
    .notNull(),
  subjectType: varchar("subject_type", { length: 50 }).notNull(), // 'user' | 'org_node' | 'project' | 'group' | 'designation'
  subjectId: uuid("subject_id").notNull(),
  accessType: varchar("access_type", { length: 10 }).default("grant").notNull(), // 'grant' | 'deny'
  grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).default("active").notNull(), // 'active' | 'revoked' | 'expired' | 'pending_provision'
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
  revocationReason: text("revocation_reason"),
  isBreakGlass: boolean("is_break_glass").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Marketplace Discoverability & Access Workflow
export const forgeAppAdmins = pgTable("forge_app_admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  appId: uuid("app_id")
    .references(() => forgeApps.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const forgeAppAccessRequests = pgTable("forge_app_access_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  appId: uuid("app_id")
    .references(() => forgeApps.id, { onDelete: "cascade" })
    .notNull(),
  requesterId: uuid("requester_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  reason: text("reason").notNull(),
  scope: varchar("scope", { length: 30 }).default("individual").notNull(), // 'individual' | 'org_node' | 'project'
  targetEntityId: uuid("target_entity_id"),
  status: varchar("status", { length: 30 }).default("pending_app_admin").notNull(), // 'pending_manager' | 'pending_app_admin' | 'pending_super_admin' | 'approved' | 'rejected'
  managerReviewedBy: uuid("manager_reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  managerNotes: text("manager_notes"),
  appAdminReviewedBy: uuid("app_admin_reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  appAdminNotes: text("app_admin_notes"),
  superAdminReviewedBy: uuid("super_admin_reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  superAdminNotes: text("super_admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const forgeAppAccessRequestMessages = pgTable("forge_app_access_request_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id")
    .references(() => forgeAppAccessRequests.id, { onDelete: "cascade" })
    .notNull(),
  senderId: uuid("sender_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  actorId: uuid("actor_id")
    .references(() => users.id)
    .notNull(),
  targetId: uuid("target_id").notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  signature: varchar("signature", { length: 256 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
