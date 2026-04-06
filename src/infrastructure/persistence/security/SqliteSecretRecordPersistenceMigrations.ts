export const SECRET_RECORD_PERSISTENCE_SCHEMA_VERSION = 1;

export const SECRET_RECORD_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS secret_record_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    -- Canonical secret metadata. Sensitive encrypted payload material is stored in related version material tables.
    CREATE TABLE IF NOT EXISTS secret_records (
      secret_id TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('server', 'workspace', 'user')),
      scope_id TEXT NOT NULL,
      workspace_id TEXT,
      user_identity_id TEXT,
      machine_key_name TEXT NOT NULL,
      display_name TEXT,
      metadata_description TEXT,
      metadata_tags_json TEXT NOT NULL,
      metadata_labels_json TEXT NOT NULL,
      sensitivity_markers_json TEXT NOT NULL,
      secret_kind TEXT NOT NULL CHECK (
        secret_kind IN (
          'api-key',
          'access-token',
          'refresh-token',
          'password',
          'private-key',
          'certificate',
          'connection-string',
          'generic'
        )
      ),
      status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'revoked', 'deleted')),
      active_version_id TEXT,
      protection_policy_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      disabled_at TEXT,
      disabled_by TEXT,
      revoked_at TEXT,
      revoked_by TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      CHECK (
        (scope_type = 'server' AND workspace_id IS NULL AND user_identity_id IS NULL)
        OR (scope_type = 'workspace' AND workspace_id IS NOT NULL AND user_identity_id IS NULL)
        OR (scope_type = 'user' AND user_identity_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS secret_records_scope_key_unique
      ON secret_records(scope_type, scope_id, machine_key_name);
    CREATE INDEX IF NOT EXISTS secret_records_scope_status_idx
      ON secret_records(scope_type, scope_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS secret_records_machine_key_idx
      ON secret_records(machine_key_name, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS secret_records_active_version_idx
      ON secret_records(active_version_id)
      WHERE active_version_id IS NOT NULL;

    -- Version lineage metadata only.
    CREATE TABLE IF NOT EXISTS secret_versions (
      version_id TEXT PRIMARY KEY,
      secret_id TEXT NOT NULL,
      version_number INTEGER NOT NULL CHECK (version_number >= 1),
      state TEXT NOT NULL CHECK (state IN ('active', 'superseded', 'revoked')),
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      previous_version_id TEXT,
      superseded_by_version_id TEXT,
      UNIQUE (secret_id, version_number),
      FOREIGN KEY (secret_id) REFERENCES secret_records(secret_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS secret_versions_secret_version_idx
      ON secret_versions(secret_id, version_number ASC);
    CREATE INDEX IF NOT EXISTS secret_versions_state_idx
      ON secret_versions(state, created_at DESC);

    -- Encrypted payload material details live separately from secret metadata rows.
    CREATE TABLE IF NOT EXISTS secret_version_material (
      version_id TEXT PRIMARY KEY,
      encrypted_payload_ref TEXT NOT NULL,
      encrypted_payload_blob BLOB,
      payload_digest_sha256 TEXT NOT NULL,
      payload_byte_length INTEGER NOT NULL CHECK (payload_byte_length >= 0),
      key_encryption_context_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (version_id) REFERENCES secret_versions(version_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS secret_version_material_payload_ref_idx
      ON secret_version_material(encrypted_payload_ref);
    CREATE INDEX IF NOT EXISTS secret_version_material_digest_idx
      ON secret_version_material(payload_digest_sha256);

    CREATE TABLE IF NOT EXISTS secret_record_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('create-secret', 'save-secret', 'delete-secret')),
      mutation_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `],
]);
