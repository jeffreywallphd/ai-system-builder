export const EXECUTION_NODE_PERSISTENCE_SCHEMA_VERSION = 2;

export const EXECUTION_NODE_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS execution_node_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS execution_node_records (
      node_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      node_type TEXT NOT NULL CHECK (node_type IN ('compute', 'hybrid', 'edge')),
      capability_enabled_json TEXT NOT NULL,
      capability_profile_version TEXT,
      supports_remote_scheduling INTEGER NOT NULL CHECK (supports_remote_scheduling IN (0, 1)),
      max_concurrent_workloads INTEGER CHECK (max_concurrent_workloads IS NULL OR max_concurrent_workloads >= 1),
      backend_family_capabilities_json TEXT NOT NULL,
      approval_status TEXT NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
      trust_state TEXT NOT NULL CHECK (
        trust_state IN ('pending-enrollment', 'pending-approval', 'trusted', 'quarantined', 'revoked')
      ),
      activation_status TEXT NOT NULL CHECK (
        activation_status IN ('inactive', 'pending', 'approved', 'active', 'degraded', 'unavailable', 'revoked')
      ),
      health_status TEXT NOT NULL CHECK (health_status IN ('unknown', 'ready', 'degraded', 'unavailable')),
      deployment_tags_json TEXT NOT NULL,
      endpoint_ref TEXT NOT NULL,
      configuration_ref TEXT,
      certificate_ref TEXT,
      last_seen_at TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      CHECK (
        (activation_status = 'revoked' AND trust_state = 'revoked')
        OR (activation_status != 'revoked' AND trust_state != 'revoked')
      ),
      CHECK (
        health_status != 'ready'
        OR activation_status = 'active'
      )
    );

    CREATE INDEX IF NOT EXISTS execution_node_records_status_idx
      ON execution_node_records(activation_status, health_status, trust_state, approval_status, last_modified_at DESC);
    CREATE INDEX IF NOT EXISTS execution_node_records_last_seen_idx
      ON execution_node_records(last_seen_at DESC)
      WHERE last_seen_at IS NOT NULL;

    CREATE TABLE IF NOT EXISTS execution_node_capabilities_lookup (
      node_id TEXT NOT NULL,
      capability TEXT NOT NULL,
      PRIMARY KEY (node_id, capability),
      FOREIGN KEY (node_id) REFERENCES execution_node_records(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS execution_node_capabilities_lookup_idx
      ON execution_node_capabilities_lookup(capability, node_id);

    CREATE TABLE IF NOT EXISTS execution_node_deployment_tags_lookup (
      node_id TEXT NOT NULL,
      deployment_tag TEXT NOT NULL,
      PRIMARY KEY (node_id, deployment_tag),
      FOREIGN KEY (node_id) REFERENCES execution_node_records(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS execution_node_deployment_tags_lookup_idx
      ON execution_node_deployment_tags_lookup(deployment_tag, node_id);

    CREATE TABLE IF NOT EXISTS execution_node_backend_families_lookup (
      node_id TEXT NOT NULL,
      backend_family TEXT NOT NULL,
      PRIMARY KEY (node_id, backend_family),
      FOREIGN KEY (node_id) REFERENCES execution_node_records(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS execution_node_backend_families_lookup_idx
      ON execution_node_backend_families_lookup(backend_family, node_id);

    CREATE TABLE IF NOT EXISTS execution_node_execution_targets_lookup (
      node_id TEXT NOT NULL,
      backend_family TEXT NOT NULL,
      execution_target TEXT NOT NULL,
      PRIMARY KEY (node_id, backend_family, execution_target),
      FOREIGN KEY (node_id) REFERENCES execution_node_records(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS execution_node_execution_targets_lookup_idx
      ON execution_node_execution_targets_lookup(execution_target, node_id, backend_family);

    CREATE TABLE IF NOT EXISTS execution_node_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (
        mutation_kind IN (
          'register-execution-node',
          'save-execution-node',
          'update-health',
          'update-capabilities',
          'update-availability'
        )
      ),
      record_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS execution_node_status_history (
      history_entry_id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      history_kind TEXT NOT NULL CHECK (
        history_kind IN (
          'registration',
          'state-save',
          'health-refresh',
          'capability-refresh',
          'availability-change'
        )
      ),
      activation_status TEXT NOT NULL CHECK (
        activation_status IN ('inactive', 'pending', 'approved', 'active', 'degraded', 'unavailable', 'revoked')
      ),
      health_status TEXT NOT NULL CHECK (health_status IN ('unknown', 'ready', 'degraded', 'unavailable')),
      availability_summary TEXT NOT NULL CHECK (
        availability_summary IN ('routable', 'degraded', 'unavailable', 'non-routable', 'revoked')
      ),
      backend_family_summary_json TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by_actor_id TEXT NOT NULL,
      operation_key TEXT NOT NULL,
      reason TEXT,
      details_json TEXT,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (node_id) REFERENCES execution_node_records(node_id) ON DELETE CASCADE,
      UNIQUE (node_id, operation_key, history_kind)
    );

    CREATE INDEX IF NOT EXISTS execution_node_status_history_node_idx
      ON execution_node_status_history(node_id, changed_at DESC, history_entry_id DESC);
    CREATE INDEX IF NOT EXISTS execution_node_status_history_kind_idx
      ON execution_node_status_history(history_kind, changed_at DESC, history_entry_id DESC);
    CREATE INDEX IF NOT EXISTS execution_node_status_history_operation_idx
      ON execution_node_status_history(operation_key, node_id, changed_at DESC);
  `],
  [2, `
    ALTER TABLE execution_node_records
      ADD COLUMN availability_override_mode TEXT NOT NULL DEFAULT 'enabled'
      CHECK (availability_override_mode IN ('enabled', 'disabled', 'suppressed'));
    ALTER TABLE execution_node_records
      ADD COLUMN availability_override_suppressed_until TEXT;
    ALTER TABLE execution_node_records
      ADD COLUMN availability_override_reason TEXT;
    ALTER TABLE execution_node_records
      ADD COLUMN availability_override_updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

    UPDATE execution_node_records
      SET availability_override_updated_at = last_modified_at
      WHERE availability_override_updated_at = '1970-01-01T00:00:00.000Z';

    CREATE INDEX IF NOT EXISTS execution_node_records_availability_override_idx
      ON execution_node_records(availability_override_mode, availability_override_suppressed_until, last_modified_at DESC);
  `],
]);
