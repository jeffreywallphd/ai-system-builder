export const GENERATED_RESULT_PERSISTENCE_SCHEMA_VERSION = 1;

export const GENERATED_RESULT_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS generated_result_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generated_result_records (
      result_asset_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      owner_user_id TEXT,
      run_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      workflow_id TEXT NOT NULL,
      workflow_template_id TEXT,
      execution_node_id TEXT,
      output_slot TEXT NOT NULL,
      workflow_template_version_id TEXT,
      workflow_template_version_tag TEXT,
      system_snapshot_id TEXT,
      system_version_tag TEXT,
      parameter_snapshot_id TEXT,
      selected_node_id TEXT,
      execution_adapter_kind TEXT,
      execution_backend_family TEXT,
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'workspace', 'shared', 'published')),
      sharing_policy_id TEXT,
      sharing_policy_version TEXT,
      storage_instance_id TEXT NOT NULL,
      storage_binding_reference TEXT,
      media_type TEXT,
      status TEXT NOT NULL CHECK (status IN (
        'pending-collection',
        'available',
        'preview-ready',
        'failed-collection',
        'archived'
      )),
      pending_since TEXT NOT NULL,
      logical_asset_version_id TEXT,
      persisted_at TEXT,
      persisted_by TEXT,
      preview_ready_at TEXT,
      preview_ready_by TEXT,
      failed_at TEXT,
      failed_by TEXT,
      failure_code TEXT,
      failure_message TEXT,
      archived_at TEXT,
      archived_by TEXT,
      tenancy_scope TEXT NOT NULL CHECK (tenancy_scope IN ('platform', 'workspace', 'user', 'node', 'mixed')),
      tenancy_workspace_id TEXT,
      tenancy_user_identity_id TEXT,
      tenancy_node_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      schema_version INTEGER NOT NULL CHECK (schema_version >= 1)
    );

    CREATE INDEX IF NOT EXISTS generated_result_records_workspace_created_idx
      ON generated_result_records(workspace_id, created_at DESC, result_asset_id ASC);
    CREATE INDEX IF NOT EXISTS generated_result_records_workspace_updated_idx
      ON generated_result_records(workspace_id, last_modified_at DESC, result_asset_id ASC);
    CREATE INDEX IF NOT EXISTS generated_result_records_run_idx
      ON generated_result_records(run_id, created_at DESC, result_asset_id ASC);
    CREATE INDEX IF NOT EXISTS generated_result_records_system_idx
      ON generated_result_records(system_id, created_at DESC, result_asset_id ASC);
    CREATE INDEX IF NOT EXISTS generated_result_records_workflow_idx
      ON generated_result_records(workflow_id, created_at DESC, result_asset_id ASC);
    CREATE INDEX IF NOT EXISTS generated_result_records_status_idx
      ON generated_result_records(status, last_modified_at DESC, result_asset_id ASC);

    CREATE TABLE IF NOT EXISTS generated_result_lineage_inputs (
      result_asset_id TEXT NOT NULL,
      input_asset_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
      PRIMARY KEY (result_asset_id, input_asset_id),
      FOREIGN KEY (result_asset_id) REFERENCES generated_result_records(result_asset_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS generated_result_lineage_inputs_result_idx
      ON generated_result_lineage_inputs(result_asset_id, ordinal ASC);
    CREATE INDEX IF NOT EXISTS generated_result_lineage_inputs_input_idx
      ON generated_result_lineage_inputs(input_asset_id, result_asset_id ASC);

    CREATE TABLE IF NOT EXISTS generated_result_previews (
      derivative_id TEXT PRIMARY KEY,
      result_asset_id TEXT NOT NULL,
      result_logical_asset_version_id TEXT,
      preview_kind TEXT NOT NULL CHECK (preview_kind IN ('thumbnail', 'display-safe', 'history-safe')),
      availability_status TEXT NOT NULL CHECK (availability_status IN ('pending', 'available', 'failed', 'stale')),
      is_primary_preview INTEGER NOT NULL CHECK (is_primary_preview IN (0, 1)),
      protected_resource_id TEXT,
      access_handle TEXT,
      media_type TEXT,
      width INTEGER,
      height INTEGER,
      byte_size INTEGER,
      generated_at TEXT,
      failure_code TEXT,
      failure_message TEXT,
      tenancy_scope TEXT NOT NULL CHECK (tenancy_scope IN ('platform', 'workspace', 'user', 'node', 'mixed')),
      tenancy_workspace_id TEXT,
      tenancy_user_identity_id TEXT,
      tenancy_node_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
      FOREIGN KEY (result_asset_id) REFERENCES generated_result_records(result_asset_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS generated_result_previews_result_idx
      ON generated_result_previews(result_asset_id, is_primary_preview DESC, preview_kind ASC);

    CREATE TABLE IF NOT EXISTS generated_result_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('create-result', 'save-result')),
      result_asset_id TEXT NOT NULL,
      mutation_snapshot_json TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      correlation_id TEXT,
      reason TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generated_result_preview_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('save-preview')),
      derivative_id TEXT NOT NULL,
      mutation_snapshot_json TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      correlation_id TEXT,
      reason TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `],
]);
