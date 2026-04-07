export const ASSET_PERSISTENCE_SCHEMA_VERSION = 4;

export const ASSET_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS asset_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_records (
      asset_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      owner_user_id TEXT,
      storage_instance_id TEXT NOT NULL,
      storage_uri TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('uploaded-file', 'generated-output', 'preview', 'derived')),
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'workspace', 'shared', 'published')),
      sharing_policy_id TEXT,
      sharing_policy_version TEXT,
      lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active', 'archived', 'deleted')),
      archived_at TEXT,
      archived_by TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      display_name TEXT,
      current_version_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      CHECK (
        (visibility = 'private' AND owner_user_id IS NOT NULL)
        OR visibility <> 'private'
      ),
      CHECK (
        (
          visibility IN ('private', 'workspace')
          AND sharing_policy_id IS NULL
          AND sharing_policy_version IS NULL
        )
        OR (
          visibility IN ('shared', 'published')
          AND sharing_policy_id IS NOT NULL
        )
      ),
      CHECK (
        (lifecycle_state = 'active'
          AND archived_at IS NULL
          AND archived_by IS NULL
          AND deleted_at IS NULL
          AND deleted_by IS NULL)
        OR (lifecycle_state = 'archived'
          AND archived_at IS NOT NULL
          AND archived_by IS NOT NULL
          AND deleted_at IS NULL
          AND deleted_by IS NULL)
        OR (lifecycle_state = 'deleted'
          AND archived_at IS NOT NULL
          AND archived_by IS NOT NULL
          AND deleted_at IS NOT NULL
          AND deleted_by IS NOT NULL
          AND julianday(deleted_at) >= julianday(archived_at))
      )
    );

    CREATE TABLE IF NOT EXISTS asset_versions (
      asset_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      storage_instance_id TEXT NOT NULL,
      storage_uri TEXT NOT NULL,
      object_key TEXT NOT NULL,
      object_version_id TEXT,
      storage_area TEXT NOT NULL CHECK (storage_area IN ('input', 'output', 'preview', 'reference', 'temporary')),
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum_algorithm TEXT NOT NULL CHECK (checksum_algorithm IN ('sha256', 'sha512', 'md5')),
      checksum_digest TEXT NOT NULL,
      original_file_name TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (asset_id, version_id),
      UNIQUE (asset_id, revision),
      FOREIGN KEY (asset_id) REFERENCES asset_records(asset_id) ON DELETE CASCADE,
      CHECK (revision >= 1),
      CHECK (size_bytes >= 0)
    );

    CREATE TABLE IF NOT EXISTS asset_lineage_links (
      asset_id TEXT NOT NULL,
      source_asset_id TEXT NOT NULL,
      source_asset_version_id TEXT,
      relation TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (asset_id, source_asset_id, source_asset_version_id, relation),
      FOREIGN KEY (asset_id) REFERENCES asset_records(asset_id) ON DELETE CASCADE,
      CHECK (relation IN ('derived-from', 'generated-from', 'preview-of', 'transformed-from'))
    );

    CREATE INDEX IF NOT EXISTS asset_records_workspace_created_idx
      ON asset_records(workspace_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS asset_records_workspace_owner_created_idx
      ON asset_records(workspace_id, owner_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS asset_records_workspace_kind_visibility_idx
      ON asset_records(workspace_id, kind, visibility, created_at DESC);
    CREATE INDEX IF NOT EXISTS asset_records_storage_idx
      ON asset_records(storage_instance_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS asset_records_lifecycle_idx
      ON asset_records(lifecycle_state, last_modified_at DESC);

    CREATE INDEX IF NOT EXISTS asset_versions_asset_revision_idx
      ON asset_versions(asset_id, revision DESC);
    CREATE INDEX IF NOT EXISTS asset_versions_lookup_idx
      ON asset_versions(storage_instance_id, object_key);

    CREATE INDEX IF NOT EXISTS asset_lineage_links_source_idx
      ON asset_lineage_links(source_asset_id, source_asset_version_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS asset_lineage_links_asset_idx
      ON asset_lineage_links(asset_id, created_at DESC);
  `],
  [2, `
    ALTER TABLE asset_versions
      ADD COLUMN content_encryption_descriptor TEXT;
  `],
  [3, `
    CREATE TABLE IF NOT EXISTS asset_generated_output_sources (
      asset_id TEXT PRIMARY KEY,
      producer_type TEXT NOT NULL CHECK (producer_type IN ('run', 'system')),
      run_id TEXT,
      system_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES asset_records(asset_id) ON DELETE CASCADE,
      CHECK (
        (producer_type = 'run' AND run_id IS NOT NULL)
        OR (producer_type = 'system' AND system_id IS NOT NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS asset_generated_output_sources_run_idx
      ON asset_generated_output_sources(run_id);
    CREATE INDEX IF NOT EXISTS asset_generated_output_sources_system_idx
      ON asset_generated_output_sources(system_id);
  `],
  [4, `
    CREATE TABLE IF NOT EXISTS asset_audit_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      correlation_id TEXT,
      operation_key TEXT,
      asset_id TEXT NOT NULL,
      outcome TEXT,
      event_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS asset_audit_events_occurred_idx
      ON asset_audit_events(occurred_at DESC, event_id DESC);
    CREATE INDEX IF NOT EXISTS asset_audit_events_workspace_idx
      ON asset_audit_events(workspace_id, occurred_at DESC, event_id DESC);
    CREATE INDEX IF NOT EXISTS asset_audit_events_asset_idx
      ON asset_audit_events(asset_id, occurred_at DESC, event_id DESC);
  `],
]);
