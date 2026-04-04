export const IDENTITY_PERSISTENCE_SCHEMA_VERSION = 1;

export const IDENTITY_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS identity_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS identity_auth_providers (
      provider_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('local-password', 'oidc', 'oauth2', 'saml', 'passkey', 'custom')),
      category TEXT NOT NULL CHECK (category IN ('local', 'external')),
      display_name TEXT NOT NULL,
      is_first_party INTEGER NOT NULL CHECK (is_first_party IN (0, 1)),
      status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'deprecated')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS identity_credential_policies (
      policy_id TEXT PRIMARY KEY,
      min_length INTEGER NOT NULL,
      max_length INTEGER NOT NULL,
      require_lowercase INTEGER NOT NULL CHECK (require_lowercase IN (0, 1)),
      require_uppercase INTEGER NOT NULL CHECK (require_uppercase IN (0, 1)),
      require_number INTEGER NOT NULL CHECK (require_number IN (0, 1)),
      require_symbol INTEGER NOT NULL CHECK (require_symbol IN (0, 1)),
      min_unique_characters INTEGER NOT NULL,
      max_repeated_characters INTEGER NOT NULL,
      blocked_substrings_json TEXT NOT NULL,
      min_password_age_days INTEGER NOT NULL,
      max_password_age_days INTEGER NOT NULL,
      password_history_count INTEGER NOT NULL,
      max_failed_attempts INTEGER NOT NULL,
      lockout_duration_minutes INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS identity_user_identities (
      user_identity_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending-activation', 'active', 'suspended', 'locked', 'deactivated')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      activated_at TEXT,
      suspended_at TEXT,
      locked_at TEXT,
      deactivated_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS identity_user_identities_username_unique
      ON identity_user_identities(username);
    CREATE UNIQUE INDEX IF NOT EXISTS identity_user_identities_email_unique
      ON identity_user_identities(email)
      WHERE email IS NOT NULL;

    CREATE TABLE IF NOT EXISTS identity_user_provider_links (
      user_identity_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      is_primary INTEGER NOT NULL CHECK (is_primary IN (0, 1)),
      linked_at TEXT NOT NULL,
      unlinked_at TEXT,
      credential_status TEXT CHECK (credential_status IN ('active', 'reset-required', 'locked', 'compromised', 'disabled')),
      credential_policy_id TEXT,
      credential_failed_attempts INTEGER,
      credential_lockout_until TEXT,
      credential_password_changed_at TEXT,
      credential_reset_required_at TEXT,
      credential_compromised_at TEXT,
      credential_disabled_at TEXT,
      last_authenticated_at TEXT,
      PRIMARY KEY (user_identity_id, provider_id, provider_subject),
      FOREIGN KEY (user_identity_id) REFERENCES identity_user_identities(user_identity_id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES identity_auth_providers(provider_id),
      FOREIGN KEY (credential_policy_id) REFERENCES identity_credential_policies(policy_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS identity_user_provider_links_provider_subject_unique
      ON identity_user_provider_links(provider_id, provider_subject);
    CREATE UNIQUE INDEX IF NOT EXISTS identity_user_provider_links_primary_per_user_unique
      ON identity_user_provider_links(user_identity_id)
      WHERE is_primary = 1 AND unlinked_at IS NULL;
    CREATE INDEX IF NOT EXISTS identity_user_provider_links_user_idx
      ON identity_user_provider_links(user_identity_id, linked_at ASC);

    CREATE TABLE IF NOT EXISTS identity_credential_material_records (
      credential_material_id TEXT PRIMARY KEY,
      user_identity_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      hash_algorithm TEXT NOT NULL,
      hash_value TEXT NOT NULL,
      salt TEXT,
      pepper_version TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'revoked', 'expired')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      superseded_at TEXT,
      expires_at TEXT,
      FOREIGN KEY (user_identity_id) REFERENCES identity_user_identities(user_identity_id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES identity_auth_providers(provider_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS identity_credential_material_active_unique
      ON identity_credential_material_records(provider_id, provider_subject)
      WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS identity_credential_material_history_idx
      ON identity_credential_material_records(provider_id, provider_subject, created_at ASC);

    CREATE TABLE IF NOT EXISTS identity_sessions (
      session_id TEXT PRIMARY KEY,
      user_identity_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'rotated', 'expired', 'revoked')),
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      rotated_at TEXT,
      replaced_by_session_id TEXT,
      revocation_reason TEXT CHECK (revocation_reason IN ('logout', 'security', 'rotation', 'admin')),
      revoked_at TEXT,
      client_user_agent TEXT,
      client_ip_address TEXT,
      client_device_id TEXT,
      FOREIGN KEY (user_identity_id) REFERENCES identity_user_identities(user_identity_id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES identity_auth_providers(provider_id),
      FOREIGN KEY (replaced_by_session_id) REFERENCES identity_sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS identity_sessions_user_idx
      ON identity_sessions(user_identity_id, issued_at DESC);
    CREATE INDEX IF NOT EXISTS identity_sessions_provider_subject_idx
      ON identity_sessions(provider_id, provider_subject, issued_at DESC);
    CREATE INDEX IF NOT EXISTS identity_sessions_status_expiry_idx
      ON identity_sessions(status, expires_at ASC);
  `],
]);
