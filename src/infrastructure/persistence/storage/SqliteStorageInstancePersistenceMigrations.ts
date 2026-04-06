export const STORAGE_INSTANCE_PERSISTENCE_SCHEMA_VERSION = 2;

export const STORAGE_INSTANCE_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS storage_instance_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storage_instances (
      storage_instance_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      backend_type TEXT NOT NULL CHECK (backend_type IN ('managed-filesystem', 'object-storage', 'network-share')),
      lifecycle_state TEXT NOT NULL CHECK (
        lifecycle_state IN ('provisioning', 'active', 'suspended', 'degraded', 'archived', 'deleting', 'deleted', 'failed')
      ),
      workspace_id TEXT NOT NULL,
      owner_user_identity_id TEXT NOT NULL,
      access_mode TEXT NOT NULL CHECK (access_mode IN ('read-write', 'read-only', 'append-only')),
      access_scope TEXT NOT NULL CHECK (access_scope IN ('workspace', 'workspace-members', 'platform-managed')),
      replication_mode TEXT NOT NULL CHECK (replication_mode IN ('none', 'async-mirror', 'sync-mirror')),
      replica_storage_instance_id TEXT,
      sync_interval_seconds INTEGER,
      policy_id TEXT NOT NULL,
      policy_max_object_bytes INTEGER,
      policy_retention_days INTEGER,
      policy_immutable_writes INTEGER NOT NULL CHECK (policy_immutable_writes IN (0, 1)),
      policy_allow_cross_workspace_reads INTEGER NOT NULL CHECK (policy_allow_cross_workspace_reads IN (0, 1)),
      policy_labels_json TEXT NOT NULL,
      policy_encryption_profile_id TEXT NOT NULL,
      policy_encryption_key_reference_id TEXT,
      policy_encryption_envelope_required INTEGER NOT NULL CHECK (policy_encryption_envelope_required IN (0, 1)),
      policy_security_encryption_mode TEXT NOT NULL CHECK (
        policy_security_encryption_mode IN ('none', 'platform-managed', 'customer-managed')
      ),
      policy_security_content_encryption_required INTEGER NOT NULL
        CHECK (policy_security_content_encryption_required IN (0, 1)),
      policy_security_key_scope TEXT NOT NULL CHECK (
        policy_security_key_scope IN ('workspace', 'storage-instance', 'platform')
      ),
      policy_security_allow_preview_decryption INTEGER NOT NULL
        CHECK (policy_security_allow_preview_decryption IN (0, 1)),
      policy_security_allow_worker_decryption INTEGER NOT NULL
        CHECK (policy_security_allow_worker_decryption IN (0, 1)),
      policy_lifecycle_retention_expiry_action TEXT NOT NULL
        CHECK (policy_lifecycle_retention_expiry_action IN ('none', 'archive', 'delete')),
      policy_lifecycle_purge_grace_period_days INTEGER,
      backend_binding_reference_id TEXT,
      provisioning_reference_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_correlation_id TEXT NOT NULL,
      CHECK (
        (replication_mode = 'none' AND replica_storage_instance_id IS NULL AND sync_interval_seconds IS NULL)
        OR (replication_mode = 'async-mirror' AND replica_storage_instance_id IS NOT NULL AND sync_interval_seconds >= 10)
        OR (replication_mode = 'sync-mirror' AND replica_storage_instance_id IS NOT NULL AND sync_interval_seconds IS NULL)
      ),
      CHECK (
        policy_max_object_bytes IS NULL OR policy_max_object_bytes >= 1
      ),
      CHECK (
        policy_retention_days IS NULL OR policy_retention_days >= 1
      ),
      CHECK (
        policy_lifecycle_purge_grace_period_days IS NULL OR policy_lifecycle_purge_grace_period_days >= 1
      ),
      CHECK (
        (policy_lifecycle_retention_expiry_action = 'delete')
        OR policy_lifecycle_purge_grace_period_days IS NULL
      )
    );

    CREATE INDEX IF NOT EXISTS storage_instances_workspace_lifecycle_idx
      ON storage_instances(workspace_id, lifecycle_state, created_at DESC);
    CREATE INDEX IF NOT EXISTS storage_instances_workspace_backend_idx
      ON storage_instances(workspace_id, backend_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS storage_instances_owner_workspace_idx
      ON storage_instances(owner_user_identity_id, workspace_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS storage_instances_access_idx
      ON storage_instances(access_mode, access_scope, lifecycle_state, created_at DESC);
    CREATE INDEX IF NOT EXISTS storage_instances_replica_idx
      ON storage_instances(replica_storage_instance_id)
      WHERE replica_storage_instance_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS storage_instance_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('create-storage-instance', 'save-storage-instance')),
      storage_instance_id TEXT NOT NULL,
      mutation_snapshot_json TEXT NOT NULL,
      actor_user_identity_id TEXT NOT NULL,
      correlation_id TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS storage_instance_mutation_replays_storage_idx
      ON storage_instance_mutation_replays(storage_instance_id, created_at DESC);
  `],
  [2, `
    CREATE TABLE IF NOT EXISTS storage_management_audit_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor_user_identity_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      storage_instance_id TEXT,
      correlation_id TEXT,
      outcome TEXT,
      event_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS storage_management_audit_events_recent_idx
      ON storage_management_audit_events(occurred_at DESC, event_id DESC);
    CREATE INDEX IF NOT EXISTS storage_management_audit_events_workspace_idx
      ON storage_management_audit_events(workspace_id, occurred_at DESC, event_id DESC);
    CREATE INDEX IF NOT EXISTS storage_management_audit_events_storage_idx
      ON storage_management_audit_events(storage_instance_id, occurred_at DESC, event_id DESC);
    CREATE INDEX IF NOT EXISTS storage_management_audit_events_type_idx
      ON storage_management_audit_events(event_type, occurred_at DESC, event_id DESC);
  `],
]);
