export const AUTHORIZATION_PERSISTENCE_SCHEMA_VERSION = 1;

export const AUTHORIZATION_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS authorization_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authorization_role_assignments (
      role_assignment_id TEXT PRIMARY KEY,
      actor_user_identity_id TEXT NOT NULL,
      role_key TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('global', 'workspace', 'resource')),
      workspace_id TEXT,
      resource_family TEXT,
      resource_type TEXT,
      resource_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
      assigned_at TEXT NOT NULL,
      assigned_by_user_identity_id TEXT NOT NULL,
      revoked_at TEXT,
      revoked_by_user_identity_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      CHECK (
        (
          scope = 'global'
          AND workspace_id IS NULL
          AND resource_family IS NULL
          AND resource_type IS NULL
          AND resource_id IS NULL
        )
        OR (
          scope = 'workspace'
          AND workspace_id IS NOT NULL
          AND resource_family IS NULL
          AND resource_type IS NULL
          AND resource_id IS NULL
        )
        OR (
          scope = 'resource'
          AND resource_family IS NOT NULL
          AND resource_type IS NOT NULL
          AND resource_id IS NOT NULL
        )
      ),
      CHECK (
        (
          status = 'active'
          AND revoked_at IS NULL
          AND revoked_by_user_identity_id IS NULL
        )
        OR (
          status = 'revoked'
          AND revoked_at IS NOT NULL
          AND revoked_by_user_identity_id IS NOT NULL
        )
      )
    );

    CREATE INDEX IF NOT EXISTS authorization_role_assignments_actor_scope_idx
      ON authorization_role_assignments(actor_user_identity_id, scope, status, assigned_at DESC);
    CREATE INDEX IF NOT EXISTS authorization_role_assignments_workspace_actor_idx
      ON authorization_role_assignments(workspace_id, actor_user_identity_id, status, assigned_at DESC)
      WHERE workspace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authorization_role_assignments_resource_idx
      ON authorization_role_assignments(resource_family, resource_type, resource_id, status, assigned_at DESC)
      WHERE resource_family IS NOT NULL;

    CREATE TABLE IF NOT EXISTS authorization_sharing_grants (
      sharing_grant_id TEXT PRIMARY KEY,
      resource_family TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      workspace_id TEXT,
      subject_kind TEXT NOT NULL CHECK (subject_kind IN ('user', 'workspace-role', 'workspace', 'public')),
      subject_user_identity_id TEXT,
      subject_workspace_id TEXT,
      subject_role_key TEXT,
      permission_keys_json TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      granted_by_user_identity_id TEXT NOT NULL,
      expires_at TEXT,
      revoked_at TEXT,
      revoked_by_user_identity_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      CHECK (
        (
          subject_kind = 'user'
          AND subject_user_identity_id IS NOT NULL
          AND subject_workspace_id IS NULL
          AND subject_role_key IS NULL
        )
        OR (
          subject_kind = 'workspace-role'
          AND subject_user_identity_id IS NULL
          AND subject_workspace_id IS NOT NULL
          AND subject_role_key IS NOT NULL
        )
        OR (
          subject_kind = 'workspace'
          AND subject_user_identity_id IS NULL
          AND subject_workspace_id IS NOT NULL
          AND subject_role_key IS NULL
        )
        OR (
          subject_kind = 'public'
          AND subject_user_identity_id IS NULL
          AND subject_workspace_id IS NULL
          AND subject_role_key IS NULL
        )
      ),
      CHECK (
        revoked_at IS NULL
        OR revoked_by_user_identity_id IS NOT NULL
      )
    );

    CREATE INDEX IF NOT EXISTS authorization_sharing_grants_resource_idx
      ON authorization_sharing_grants(resource_family, resource_type, resource_id, granted_at DESC);
    CREATE INDEX IF NOT EXISTS authorization_sharing_grants_workspace_idx
      ON authorization_sharing_grants(workspace_id, granted_at DESC)
      WHERE workspace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authorization_sharing_grants_subject_user_idx
      ON authorization_sharing_grants(subject_user_identity_id, granted_at DESC)
      WHERE subject_kind = 'user';
    CREATE INDEX IF NOT EXISTS authorization_sharing_grants_subject_workspace_idx
      ON authorization_sharing_grants(subject_workspace_id, subject_kind, granted_at DESC)
      WHERE subject_workspace_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS authorization_resource_policy_metadata (
      resource_family TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      owner_user_identity_id TEXT NOT NULL,
      ownership_scope TEXT NOT NULL CHECK (ownership_scope IN ('user-private', 'workspace')),
      workspace_id TEXT,
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'workspace', 'shared', 'published')),
      sharing_policy_mode TEXT NOT NULL CHECK (sharing_policy_mode IN ('owner-only', 'workspace-members', 'explicit', 'published')),
      allow_resharing INTEGER NOT NULL CHECK (allow_resharing IN (0, 1)),
      is_published_capable INTEGER NOT NULL CHECK (is_published_capable IN (0, 1)),
      published_at TEXT,
      deleted_at TEXT,
      deleted_by_user_identity_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      PRIMARY KEY (resource_family, resource_type, resource_id),
      CHECK (
        (ownership_scope = 'workspace' AND workspace_id IS NOT NULL)
        OR (ownership_scope = 'user-private')
      ),
      CHECK (
        deleted_at IS NULL
        OR deleted_by_user_identity_id IS NOT NULL
      )
    );

    CREATE INDEX IF NOT EXISTS authorization_resource_policy_metadata_workspace_visibility_idx
      ON authorization_resource_policy_metadata(workspace_id, visibility, last_modified_at DESC)
      WHERE workspace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authorization_resource_policy_metadata_owner_idx
      ON authorization_resource_policy_metadata(owner_user_identity_id, last_modified_at DESC);

    CREATE TABLE IF NOT EXISTS authorization_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('role-assignment', 'sharing-grant', 'resource-policy')),
      record_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `],
]);
