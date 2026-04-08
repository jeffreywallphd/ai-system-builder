export const IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_SCHEMA_VERSION = 1;

export const IMAGE_WORKFLOW_SYSTEM_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS image_workflow_system_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_workflow_definition_records (
      workflow_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      owner_user_id TEXT,
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'team', 'public')),
      operation_kind TEXT NOT NULL,
      lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('draft', 'review', 'published', 'deprecated', 'retired')),
      activation_status TEXT NOT NULL CHECK (activation_status IN ('active', 'inactive')),
      lineage_id TEXT NOT NULL,
      version_tag TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 0),
      translator_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      persistence_revision INTEGER NOT NULL CHECK (persistence_revision >= 1),
      schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
      definition_json TEXT NOT NULL,
      CHECK ((visibility = 'private' AND owner_user_id IS NOT NULL) OR visibility <> 'private')
    );

    CREATE INDEX IF NOT EXISTS image_workflow_definition_workspace_idx
      ON image_workflow_definition_records(workspace_id, updated_at DESC, workflow_id ASC);
    CREATE INDEX IF NOT EXISTS image_workflow_definition_workspace_owner_idx
      ON image_workflow_definition_records(workspace_id, owner_user_id, updated_at DESC, workflow_id ASC);
    CREATE INDEX IF NOT EXISTS image_workflow_definition_workspace_visibility_idx
      ON image_workflow_definition_records(workspace_id, visibility, updated_at DESC, workflow_id ASC);
    CREATE INDEX IF NOT EXISTS image_workflow_definition_workspace_operation_idx
      ON image_workflow_definition_records(workspace_id, operation_kind, updated_at DESC, workflow_id ASC);
    CREATE INDEX IF NOT EXISTS image_workflow_definition_workspace_lifecycle_idx
      ON image_workflow_definition_records(workspace_id, lifecycle_state, activation_status, updated_at DESC, workflow_id ASC);
    CREATE INDEX IF NOT EXISTS image_workflow_definition_workspace_lineage_idx
      ON image_workflow_definition_records(workspace_id, lineage_id, revision DESC, updated_at DESC, workflow_id ASC);

    CREATE TABLE IF NOT EXISTS image_system_definition_records (
      system_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      owner_user_id TEXT,
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'team', 'public')),
      sharing_policy_id TEXT,
      workflow_id TEXT NOT NULL,
      workflow_lineage_id TEXT NOT NULL,
      workflow_version_tag TEXT NOT NULL,
      workflow_revision INTEGER NOT NULL CHECK (workflow_revision >= 0),
      lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('draft', 'ready', 'archived')),
      runtime_status TEXT NOT NULL CHECK (runtime_status IN ('enabled', 'disabled')),
      tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      persistence_revision INTEGER NOT NULL CHECK (persistence_revision >= 1),
      schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
      definition_json TEXT NOT NULL,
      CHECK ((visibility = 'private' AND owner_user_id IS NOT NULL) OR visibility <> 'private')
    );

    CREATE INDEX IF NOT EXISTS image_system_definition_workspace_idx
      ON image_system_definition_records(workspace_id, updated_at DESC, system_id ASC);
    CREATE INDEX IF NOT EXISTS image_system_definition_workspace_owner_idx
      ON image_system_definition_records(workspace_id, owner_user_id, updated_at DESC, system_id ASC);
    CREATE INDEX IF NOT EXISTS image_system_definition_workspace_visibility_idx
      ON image_system_definition_records(workspace_id, visibility, updated_at DESC, system_id ASC);
    CREATE INDEX IF NOT EXISTS image_system_definition_workspace_sharing_idx
      ON image_system_definition_records(workspace_id, sharing_policy_id, updated_at DESC, system_id ASC)
      WHERE sharing_policy_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS image_system_definition_workspace_workflow_idx
      ON image_system_definition_records(workspace_id, workflow_id, workflow_revision DESC, updated_at DESC, system_id ASC);
    CREATE INDEX IF NOT EXISTS image_system_definition_workspace_lineage_idx
      ON image_system_definition_records(workspace_id, workflow_lineage_id, workflow_revision DESC, updated_at DESC, system_id ASC);
    CREATE INDEX IF NOT EXISTS image_system_definition_workspace_lifecycle_idx
      ON image_system_definition_records(workspace_id, lifecycle_state, runtime_status, updated_at DESC, system_id ASC);

    CREATE TABLE IF NOT EXISTS image_workflow_system_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN (
        'create-workflow-definition',
        'save-workflow-definition',
        'archive-workflow-definition',
        'create-system-definition',
        'save-system-definition',
        'archive-system-definition'
      )),
      record_kind TEXT NOT NULL CHECK (record_kind IN ('workflow-definition', 'system-definition')),
      record_id TEXT NOT NULL,
      record_snapshot_json TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      correlation_id TEXT,
      reason TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS image_workflow_system_mutation_replays_record_idx
      ON image_workflow_system_mutation_replays(record_kind, record_id, created_at DESC);
  `],
]);
