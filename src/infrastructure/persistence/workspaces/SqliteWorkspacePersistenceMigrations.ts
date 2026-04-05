export const WORKSPACE_PERSISTENCE_SCHEMA_VERSION = 1;

export const WORKSPACE_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS workspace_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_records (
      workspace_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK (status IN ('provisioning', 'active', 'suspended', 'archived')),
      owner_user_id TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'team', 'public')),
      created_by TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_modified_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS workspace_records_slug_unique
      ON workspace_records(slug);
    CREATE INDEX IF NOT EXISTS workspace_records_owner_status_idx
      ON workspace_records(owner_user_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS workspace_records_visibility_status_idx
      ON workspace_records(visibility, status, created_at DESC);

    CREATE TABLE IF NOT EXISTS workspace_invitations (
      invitation_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      invited_email TEXT NOT NULL,
      invited_by_user_id TEXT NOT NULL,
      invited_roles_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      responded_at TEXT,
      accepted_by_user_identity_id TEXT,
      last_modified_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      UNIQUE (invitation_id, workspace_id),
      FOREIGN KEY (workspace_id) REFERENCES workspace_records(workspace_id) ON DELETE CASCADE,
      CHECK (julianday(expires_at) > julianday(created_at)),
      CHECK (
        (
          status = 'accepted'
          AND responded_at IS NOT NULL
          AND accepted_by_user_identity_id IS NOT NULL
        )
        OR (
          status = 'declined'
          AND responded_at IS NOT NULL
          AND accepted_by_user_identity_id IS NULL
        )
        OR (
          status IN ('pending', 'revoked', 'expired')
          AND accepted_by_user_identity_id IS NULL
        )
      )
    );

    CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_status_expires_idx
      ON workspace_invitations(workspace_id, status, expires_at ASC, created_at DESC);
    CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_email_idx
      ON workspace_invitations(workspace_id, invited_email, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_workspace_pending_email_unique
      ON workspace_invitations(workspace_id, invited_email)
      WHERE status = 'pending';

    CREATE TABLE IF NOT EXISTS workspace_memberships (
      membership_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_identity_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
      invited_by_user_id TEXT,
      invitation_id TEXT,
      joined_at TEXT,
      suspended_at TEXT,
      removed_at TEXT,
      removed_by_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      UNIQUE (workspace_id, user_identity_id),
      FOREIGN KEY (workspace_id) REFERENCES workspace_records(workspace_id) ON DELETE CASCADE,
      FOREIGN KEY (invitation_id, workspace_id)
        REFERENCES workspace_invitations(invitation_id, workspace_id)
        ON DELETE SET NULL,
      CHECK (
        (
          status = 'active'
          AND joined_at IS NOT NULL
          AND suspended_at IS NULL
          AND removed_at IS NULL
          AND removed_by_user_id IS NULL
        )
        OR (
          status = 'pending'
          AND joined_at IS NULL
          AND suspended_at IS NULL
          AND removed_at IS NULL
          AND removed_by_user_id IS NULL
        )
        OR (
          status = 'suspended'
          AND suspended_at IS NOT NULL
          AND removed_at IS NULL
          AND removed_by_user_id IS NULL
        )
        OR (
          status = 'removed'
          AND suspended_at IS NULL
          AND removed_at IS NOT NULL
          AND removed_by_user_id IS NOT NULL
        )
      )
    );

    CREATE INDEX IF NOT EXISTS workspace_memberships_workspace_status_idx
      ON workspace_memberships(workspace_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS workspace_memberships_user_idx
      ON workspace_memberships(user_identity_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS workspace_memberships_invitation_idx
      ON workspace_memberships(invitation_id, workspace_id)
      WHERE invitation_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS workspace_role_assignments (
      role_assignment_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_identity_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
      status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
      assigned_at TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      revoked_at TEXT,
      revoked_by TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspace_records(workspace_id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id, user_identity_id)
        REFERENCES workspace_memberships(workspace_id, user_identity_id)
        ON DELETE CASCADE,
      CHECK (
        (
          status = 'active'
          AND revoked_at IS NULL
          AND revoked_by IS NULL
        )
        OR (
          status = 'revoked'
          AND revoked_at IS NOT NULL
          AND revoked_by IS NOT NULL
        )
      )
    );

    CREATE INDEX IF NOT EXISTS workspace_role_assignments_workspace_user_status_idx
      ON workspace_role_assignments(workspace_id, user_identity_id, status, assigned_at DESC);
    CREATE INDEX IF NOT EXISTS workspace_role_assignments_workspace_role_status_idx
      ON workspace_role_assignments(workspace_id, role, status, assigned_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_role_assignments_active_user_role_unique
      ON workspace_role_assignments(workspace_id, user_identity_id, role)
      WHERE status = 'active';
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_role_assignments_single_active_owner_unique
      ON workspace_role_assignments(workspace_id)
      WHERE status = 'active' AND role = 'owner';
  `],
]);
