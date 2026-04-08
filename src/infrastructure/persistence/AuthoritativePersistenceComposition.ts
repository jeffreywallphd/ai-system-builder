import { createHash } from "node:crypto";
import path from "node:path";
import type { SqliteCompatDatabase } from "./sqlite/SqliteCompat";
import type { SqlitePersistenceMigrationHook } from "./sqlite/SqlitePersistenceRuntime";
import { SqliteIdentityPersistenceAdapter } from "./identity/SqliteIdentityPersistenceAdapter";
import { SqliteTrustedDevicePersistenceAdapter } from "./identity/SqliteTrustedDevicePersistenceAdapter";
import { IDENTITY_PERSISTENCE_MIGRATIONS } from "./identity/SqliteIdentityPersistenceMigrations";
import { SqliteWorkspacePersistenceAdapter } from "./workspaces/SqliteWorkspacePersistenceAdapter";
import { WORKSPACE_PERSISTENCE_MIGRATIONS } from "./workspaces/SqliteWorkspacePersistenceMigrations";
import { SqliteAuthorizationPersistenceAdapter } from "./authorization/SqliteAuthorizationPersistenceAdapter";
import { AUTHORIZATION_PERSISTENCE_MIGRATIONS } from "./authorization/SqliteAuthorizationPersistenceMigrations";
import { SqliteNodeTrustPersistenceAdapter } from "./nodes/SqliteNodeTrustPersistenceAdapter";
import { SqliteNodeTrustAuditRecorder } from "./nodes/SqliteNodeTrustAuditRecorder";
import { NODE_TRUST_PERSISTENCE_MIGRATIONS } from "./nodes/SqliteNodeTrustPersistenceMigrations";
import { SqliteCertificateAuthorityPersistenceAdapter } from "./security/SqliteCertificateAuthorityPersistenceAdapter";
import { CERTIFICATE_AUTHORITY_PERSISTENCE_MIGRATIONS } from "./security/SqliteCertificateAuthorityPersistenceMigrations";
import { SqliteSecretRecordPersistenceAdapter } from "./security/SqliteSecretRecordPersistenceAdapter";
import { SECRET_RECORD_PERSISTENCE_MIGRATIONS } from "./security/SqliteSecretRecordPersistenceMigrations";
import { SqliteStorageInstancePersistenceAdapter } from "./storage/SqliteStorageInstancePersistenceAdapter";
import { SqliteStorageManagementAuditRecorder } from "./storage/SqliteStorageManagementAuditRecorder";
import { STORAGE_INSTANCE_PERSISTENCE_MIGRATIONS } from "./storage/SqliteStorageInstancePersistenceMigrations";
import { SqliteAssetPersistenceAdapter } from "./assets/SqliteAssetPersistenceAdapter";
import { SqliteAssetAuditRecorder } from "./assets/SqliteAssetAuditRecorder";
import { ASSET_PERSISTENCE_MIGRATIONS } from "./assets/SqliteAssetPersistenceMigrations";
import { SqliteAssetUploadSessionPersistenceAdapter } from "./assets/SqliteAssetUploadSessionPersistenceAdapter";
import { ASSET_UPLOAD_SESSION_PERSISTENCE_MIGRATIONS } from "./assets/SqliteAssetUploadSessionPersistenceMigrations";
import { SqliteImageAssetPersistenceAdapter } from "./image-assets/SqliteImageAssetPersistenceAdapter";
import { IMAGE_ASSET_PERSISTENCE_MIGRATIONS } from "./image-assets/SqliteImageAssetPersistenceMigrations";
import { SqliteImageWorkflowSystemPersistenceAdapter } from "./image-workflows/SqliteImageWorkflowSystemPersistenceAdapter";
import { IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_MIGRATIONS } from "./image-workflows/SqliteImageWorkflowSystemPersistenceMigrations";
import { SqlitePlatformPersistenceAdapter } from "./platform/SqlitePlatformPersistenceAdapter";
import { PLATFORM_PERSISTENCE_MIGRATIONS } from "./platform/SqlitePlatformPersistenceMigrations";
import { SqliteAuditLedgerRepository } from "./audit/SqliteAuditLedgerRepository";
import { AUDIT_LEDGER_PERSISTENCE_MIGRATIONS } from "./audit/SqliteAuditLedgerPersistenceMigrations";
import { SqliteDeploymentPolicyPersistenceAdapter } from "./deployment/SqliteDeploymentPolicyPersistenceAdapter";
import { DEPLOYMENT_POLICY_PERSISTENCE_MIGRATIONS } from "./deployment/SqliteDeploymentPolicyPersistenceMigrations";

interface VersionedMigrationSource {
  readonly domainId: string;
  readonly migrationTableName: string;
  readonly migrations: ReadonlyArray<readonly [number, string]>;
}

export interface AuthoritativePersistentPlatformServices {
  readonly databasePath: string;
  readonly identityRepository: SqliteIdentityPersistenceAdapter;
  readonly trustedDeviceRepository: SqliteTrustedDevicePersistenceAdapter;
  readonly workspaceRepository: SqliteWorkspacePersistenceAdapter;
  readonly authorizationRepository: SqliteAuthorizationPersistenceAdapter;
  readonly nodeTrustRepository: SqliteNodeTrustPersistenceAdapter;
  readonly nodeTrustAuditRecorder: SqliteNodeTrustAuditRecorder;
  readonly certificateAuthorityRepository: SqliteCertificateAuthorityPersistenceAdapter;
  readonly secretRecordRepository: SqliteSecretRecordPersistenceAdapter;
  readonly storageInstanceRepository: SqliteStorageInstancePersistenceAdapter;
  readonly storageManagementAuditRecorder: SqliteStorageManagementAuditRecorder;
  readonly assetRepository: SqliteAssetPersistenceAdapter;
  readonly assetAuditRecorder: SqliteAssetAuditRecorder;
  readonly assetUploadSessionRepository: SqliteAssetUploadSessionPersistenceAdapter;
  readonly imageAssetRepository: SqliteImageAssetPersistenceAdapter;
  readonly imageWorkflowSystemRepository: SqliteImageWorkflowSystemPersistenceAdapter;
  readonly platformPersistenceRepository: SqlitePlatformPersistenceAdapter;
  readonly auditLedgerRepository: SqliteAuditLedgerRepository;
  readonly deploymentPolicyRepository: SqliteDeploymentPolicyPersistenceAdapter;
  dispose(): void;
}

const VersionedMigrationSources = Object.freeze<ReadonlyArray<VersionedMigrationSource>>([
  Object.freeze({
    domainId: "identity",
    migrationTableName: "identity_repository_migrations",
    migrations: IDENTITY_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "workspaces",
    migrationTableName: "workspace_repository_migrations",
    migrations: WORKSPACE_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "authorization",
    migrationTableName: "authorization_repository_migrations",
    migrations: AUTHORIZATION_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "nodes",
    migrationTableName: "node_trust_repository_migrations",
    migrations: NODE_TRUST_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "storage",
    migrationTableName: "storage_instance_repository_migrations",
    migrations: STORAGE_INSTANCE_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "assets",
    migrationTableName: "asset_repository_migrations",
    migrations: ASSET_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "asset-upload-sessions",
    migrationTableName: "asset_upload_session_repository_migrations",
    migrations: ASSET_UPLOAD_SESSION_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "image-assets",
    migrationTableName: "image_asset_repository_migrations",
    migrations: IMAGE_ASSET_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "image-workflow-system",
    migrationTableName: "image_workflow_system_repository_migrations",
    migrations: IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "platform",
    migrationTableName: "platform_repository_migrations",
    migrations: PLATFORM_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "deployment-policy",
    migrationTableName: "deployment_policy_repository_migrations",
    migrations: DEPLOYMENT_POLICY_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "audit-ledger",
    migrationTableName: "audit_ledger_repository_migrations",
    migrations: AUDIT_LEDGER_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "certificate-authority",
    migrationTableName: "certificate_authority_repository_migrations",
    migrations: CERTIFICATE_AUTHORITY_PERSISTENCE_MIGRATIONS,
  }),
  Object.freeze({
    domainId: "secret-records",
    migrationTableName: "secret_record_repository_migrations",
    migrations: SECRET_RECORD_PERSISTENCE_MIGRATIONS,
  }),
]);

const AddColumnStatementPattern = /^\s*ALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b/i;
const DuplicateColumnErrorPattern = /duplicate column name:/i;

function splitSqlStatements(sql: string): ReadonlyArray<string> {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function isIgnorableDuplicateAddColumnError(error: unknown, statement: string): boolean {
  if (!AddColumnStatementPattern.test(statement)) {
    return false;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return DuplicateColumnErrorPattern.test(error.message);
}

function execVersionedMigrationSql(database: SqliteCompatDatabase, sql: string): void {
  for (const statement of splitSqlStatements(sql)) {
    try {
      database.exec(`${statement};`);
    } catch (error) {
      // Drift-safe replay: ignore duplicate-column faults only for ALTER TABLE ... ADD COLUMN statements.
      if (isIgnorableDuplicateAddColumnError(error, statement)) {
        continue;
      }
      throw error;
    }
  }
}

function createMigrationHookChecksum(input: {
  readonly domainId: string;
  readonly version: number;
  readonly sql: string;
}): string {
  const hash = createHash("sha256");
  hash.update(`${input.domainId}:v${input.version}`);
  hash.update("\n");
  hash.update(input.sql);
  return hash.digest("hex");
}

function createVersionedMigrationHooks(source: VersionedMigrationSource): ReadonlyArray<SqlitePersistenceMigrationHook> {
  return Object.freeze(source.migrations.map(([version, sql]) => {
    const migrationId = `${source.domainId}:v${version}`;
    return Object.freeze({
      migrationId,
      checksum: createMigrationHookChecksum({
        domainId: source.domainId,
        version,
        sql,
      }),
      apply(database: SqliteCompatDatabase): void {
        database.exec(`
          CREATE TABLE IF NOT EXISTS ${source.migrationTableName} (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
          );
        `);

        const existing = database
          .prepare(`SELECT version FROM ${source.migrationTableName} WHERE version = ?`)
          .get(version) as { version?: number } | undefined;
        if (typeof existing?.version === "number") {
          return;
        }

        execVersionedMigrationSql(database, sql);
        database
          .prepare(`INSERT INTO ${source.migrationTableName} (version, applied_at) VALUES (?, ?)`)
          .run(version, new Date().toISOString());
      },
    }) satisfies SqlitePersistenceMigrationHook;
  }));
}

export function createAuthoritativePersistenceMigrationHooks(): ReadonlyArray<SqlitePersistenceMigrationHook> {
  const hooks: SqlitePersistenceMigrationHook[] = [];
  for (const source of VersionedMigrationSources) {
    hooks.push(...createVersionedMigrationHooks(source));
  }
  return Object.freeze(hooks);
}

export function createAuthoritativePersistentPlatformServices(input: {
  readonly databasePath: string;
}): AuthoritativePersistentPlatformServices {
  const databasePath = path.resolve(input.databasePath);
  const identityRepository = new SqliteIdentityPersistenceAdapter(databasePath);
  const trustedDeviceRepository = new SqliteTrustedDevicePersistenceAdapter(databasePath);
  const workspaceRepository = new SqliteWorkspacePersistenceAdapter(databasePath);
  const authorizationRepository = new SqliteAuthorizationPersistenceAdapter(databasePath);
  const nodeTrustRepository = new SqliteNodeTrustPersistenceAdapter(databasePath);
  const nodeTrustAuditRecorder = new SqliteNodeTrustAuditRecorder(databasePath);
  const certificateAuthorityRepository = new SqliteCertificateAuthorityPersistenceAdapter(databasePath);
  const secretRecordRepository = new SqliteSecretRecordPersistenceAdapter(databasePath);
  const storageInstanceRepository = new SqliteStorageInstancePersistenceAdapter(databasePath);
  const storageManagementAuditRecorder = new SqliteStorageManagementAuditRecorder(databasePath);
  const assetRepository = new SqliteAssetPersistenceAdapter(databasePath);
  const assetAuditRecorder = new SqliteAssetAuditRecorder(databasePath);
  const assetUploadSessionRepository = new SqliteAssetUploadSessionPersistenceAdapter(databasePath);
  const imageAssetRepository = new SqliteImageAssetPersistenceAdapter(databasePath);
  const imageWorkflowSystemRepository = new SqliteImageWorkflowSystemPersistenceAdapter(databasePath);
  const platformPersistenceRepository = new SqlitePlatformPersistenceAdapter(databasePath);
  const auditLedgerRepository = new SqliteAuditLedgerRepository(databasePath);
  const deploymentPolicyRepository = new SqliteDeploymentPolicyPersistenceAdapter(databasePath);

  return Object.freeze({
    databasePath,
    identityRepository,
    trustedDeviceRepository,
    workspaceRepository,
    authorizationRepository,
    nodeTrustRepository,
    nodeTrustAuditRecorder,
    certificateAuthorityRepository,
    secretRecordRepository,
    storageInstanceRepository,
    storageManagementAuditRecorder,
    assetRepository,
    assetAuditRecorder,
    assetUploadSessionRepository,
    imageAssetRepository,
    imageWorkflowSystemRepository,
    platformPersistenceRepository,
    auditLedgerRepository,
    deploymentPolicyRepository,
    dispose(): void {
      identityRepository.dispose();
      trustedDeviceRepository.dispose();
      workspaceRepository.dispose();
      authorizationRepository.dispose();
      nodeTrustRepository.dispose();
      nodeTrustAuditRecorder.dispose();
      certificateAuthorityRepository.dispose();
      secretRecordRepository.dispose();
      storageInstanceRepository.dispose();
      storageManagementAuditRecorder.dispose();
      assetRepository.dispose();
      assetAuditRecorder.dispose();
      assetUploadSessionRepository.dispose();
      imageAssetRepository.dispose();
      imageWorkflowSystemRepository.dispose();
      platformPersistenceRepository.dispose();
      auditLedgerRepository.dispose();
      deploymentPolicyRepository.dispose();
    },
  });
}
