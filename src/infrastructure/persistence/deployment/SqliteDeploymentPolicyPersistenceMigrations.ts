export const DEPLOYMENT_POLICY_PERSISTENCE_SCHEMA_VERSION = 1;

export const DEPLOYMENT_POLICY_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS deployment_policy_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployment_policy_active_profile_selection (
      scope_kind TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      profile_id TEXT NOT NULL CHECK (profile_id IN ('home', 'classroom', 'organization')),
      changed_at TEXT NOT NULL,
      changed_by_user_identity_id TEXT NOT NULL,
      reason TEXT,
      ticket_reference TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      PRIMARY KEY (scope_kind, scope_id)
    );

    CREATE INDEX IF NOT EXISTS deployment_policy_active_profile_selection_profile_idx
      ON deployment_policy_active_profile_selection(profile_id, last_modified_at DESC);

    CREATE TABLE IF NOT EXISTS deployment_policy_overrides (
      scope_kind TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      profile_id TEXT NOT NULL CHECK (profile_id IN ('home', 'classroom', 'organization')),
      family_id TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean')),
      value_string TEXT,
      value_number REAL,
      value_boolean INTEGER,
      provenance_actor_user_identity_id TEXT,
      provenance_ticket_reference TEXT,
      provenance_reason TEXT,
      provenance_updated_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      PRIMARY KEY (scope_kind, scope_id, profile_id, family_id, setting_key),
      CHECK (
        (value_type = 'string' AND value_string IS NOT NULL AND value_number IS NULL AND value_boolean IS NULL)
        OR (value_type = 'number' AND value_string IS NULL AND value_number IS NOT NULL AND value_boolean IS NULL)
        OR (value_type = 'boolean' AND value_string IS NULL AND value_number IS NULL AND value_boolean IN (0, 1))
      )
    );

    CREATE INDEX IF NOT EXISTS deployment_policy_overrides_scope_profile_idx
      ON deployment_policy_overrides(scope_kind, scope_id, profile_id, family_id, setting_key);

    CREATE TABLE IF NOT EXISTS deployment_policy_override_history (
      change_id TEXT PRIMARY KEY,
      scope_kind TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      profile_id TEXT NOT NULL CHECK (profile_id IN ('home', 'classroom', 'organization')),
      family_id TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('upsert', 'remove')),
      value_type TEXT CHECK (value_type IN ('string', 'number', 'boolean')),
      value_string TEXT,
      value_number REAL,
      value_boolean INTEGER,
      provenance_actor_user_identity_id TEXT,
      provenance_ticket_reference TEXT,
      provenance_reason TEXT,
      provenance_updated_at TEXT,
      operation_key TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by_user_identity_id TEXT NOT NULL,
      reason TEXT,
      ticket_reference TEXT,
      correlation_id TEXT,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      created_at TEXT NOT NULL,
      CHECK (
        operation = 'remove'
        OR (
          value_type IS NOT NULL
          AND (
            (value_type = 'string' AND value_string IS NOT NULL AND value_number IS NULL AND value_boolean IS NULL)
            OR (value_type = 'number' AND value_string IS NULL AND value_number IS NOT NULL AND value_boolean IS NULL)
            OR (value_type = 'boolean' AND value_string IS NULL AND value_number IS NULL AND value_boolean IN (0, 1))
          )
        )
      )
    );

    CREATE INDEX IF NOT EXISTS deployment_policy_override_history_scope_profile_idx
      ON deployment_policy_override_history(scope_kind, scope_id, profile_id, changed_at DESC, change_id DESC);
    CREATE INDEX IF NOT EXISTS deployment_policy_override_history_operation_key_idx
      ON deployment_policy_override_history(operation_key);

    CREATE TABLE IF NOT EXISTS deployment_policy_effective_metadata (
      scope_kind TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      profile_id TEXT NOT NULL CHECK (profile_id IN ('home', 'classroom', 'organization')),
      evaluated_at TEXT NOT NULL,
      evaluation_layer TEXT NOT NULL CHECK (evaluation_layer IN ('domain', 'application')),
      contract_version TEXT NOT NULL,
      family_count INTEGER NOT NULL CHECK (family_count >= 0),
      setting_count INTEGER NOT NULL CHECK (setting_count >= 0),
      source_counts_json TEXT NOT NULL,
      validation_json TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      recorded_by_user_identity_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      PRIMARY KEY (scope_kind, scope_id)
    );

    CREATE INDEX IF NOT EXISTS deployment_policy_effective_metadata_profile_idx
      ON deployment_policy_effective_metadata(profile_id, evaluated_at DESC);

    CREATE TABLE IF NOT EXISTS deployment_policy_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (
        mutation_kind IN (
          'set-active-profile',
          'upsert-override',
          'remove-override',
          'save-effective-metadata'
        )
      ),
      record_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `],
]);

