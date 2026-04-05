export const IDENTITY_SCHEMA_VERSION = 5;

export const IDENTITY_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
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
  [2, `
    ALTER TABLE identity_sessions
      ADD COLUMN client_access_channel TEXT CHECK (client_access_channel IN ('desktop', 'thin-client'));
  `],
  [3, `
    CREATE TABLE IF NOT EXISTS identity_session_token_material (
      session_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      hash_algorithm TEXT NOT NULL CHECK (hash_algorithm IN ('sha256')),
      token_type TEXT NOT NULL CHECK (token_type IN ('opaque-bearer')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      invalidated_at TEXT,
      FOREIGN KEY (session_id) REFERENCES identity_sessions(session_id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS identity_session_token_material_token_hash_unique
      ON identity_session_token_material(token_hash);
    CREATE INDEX IF NOT EXISTS identity_session_token_material_expiry_idx
      ON identity_session_token_material(expires_at ASC);
  `],
  [4, `
    ALTER TABLE identity_sessions
      ADD COLUMN client_trusted_device_binding_id TEXT;

    ALTER TABLE identity_sessions
      ADD COLUMN client_trust_marker TEXT;
  `],
  [5, `
    CREATE TABLE IF NOT EXISTS identity_trusted_devices (
      trusted_device_id TEXT PRIMARY KEY,
      user_identity_id TEXT NOT NULL,
      workspace_id TEXT,
      display_name TEXT NOT NULL,
      fingerprint_algorithm TEXT NOT NULL CHECK (fingerprint_algorithm IN ('sha256', 'sha512', 'opaque')),
      fingerprint_value TEXT NOT NULL,
      fingerprint_captured_at TEXT NOT NULL,
      pairing_method TEXT NOT NULL CHECK (pairing_method IN ('one-time-code', 'qr-code', 'passkey', 'admin-provisioned', 'recovery-flow')),
      trust_status TEXT NOT NULL CHECK (trust_status IN ('pending-pairing', 'trusted', 'revoked', 'expired')),
      trust_material_id TEXT,
      trust_material_kind TEXT CHECK (trust_material_kind IN ('session-signing-key', 'attestation-key', 'opaque-marker')),
      trust_material_version TEXT,
      trust_material_issued_at TEXT,
      trust_material_expires_at TEXT,
      registered_at TEXT NOT NULL,
      paired_at TEXT,
      last_seen_at TEXT,
      metadata_platform TEXT,
      metadata_os_version TEXT,
      metadata_app_version TEXT,
      metadata_device_model TEXT,
      metadata_locale TEXT,
      metadata_last_ip_address TEXT,
      revocation_reason TEXT CHECK (revocation_reason IN ('user-request', 'admin-action', 'lost-device', 'suspected-compromise', 'workspace-access-removed', 'policy-violation')),
      revoked_at TEXT,
      revoked_by_user_identity_id TEXT,
      revocation_note TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_identity_id) REFERENCES identity_user_identities(user_identity_id) ON DELETE CASCADE,
      FOREIGN KEY (revoked_by_user_identity_id) REFERENCES identity_user_identities(user_identity_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS identity_trusted_devices_user_workspace_fingerprint_unique
      ON identity_trusted_devices(
        user_identity_id,
        COALESCE(workspace_id, ''),
        fingerprint_algorithm,
        fingerprint_value
      );
    CREATE INDEX IF NOT EXISTS identity_trusted_devices_user_workspace_status_idx
      ON identity_trusted_devices(user_identity_id, workspace_id, trust_status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS identity_trusted_devices_status_updated_idx
      ON identity_trusted_devices(trust_status, updated_at ASC);

    CREATE TABLE IF NOT EXISTS identity_trusted_device_pairing_sessions (
      pairing_session_id TEXT PRIMARY KEY,
      trusted_device_id TEXT NOT NULL,
      user_identity_id TEXT NOT NULL,
      workspace_id TEXT,
      pairing_token_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('initiated', 'validated', 'completed', 'expired', 'invalidated', 'rejected')),
      initiated_at TEXT NOT NULL,
      validated_at TEXT,
      completed_at TEXT,
      completed_by_user_identity_id TEXT,
      trust_material_registration_kind TEXT CHECK (trust_material_registration_kind IN ('session-signing-key', 'attestation-key', 'opaque-marker')),
      trust_material_registration_pin_reference TEXT,
      trust_material_registration_public_key_fingerprint TEXT,
      rejected_at TEXT,
      rejection_reason TEXT CHECK (rejection_reason IN ('invalid-token', 'token-reused', 'token-expired', 'actor-scope-violation')),
      rejection_note TEXT,
      invalidated_at TEXT,
      expired_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (trusted_device_id) REFERENCES identity_trusted_devices(trusted_device_id) ON DELETE CASCADE,
      FOREIGN KEY (user_identity_id) REFERENCES identity_user_identities(user_identity_id) ON DELETE CASCADE,
      FOREIGN KEY (completed_by_user_identity_id) REFERENCES identity_user_identities(user_identity_id)
    );

    CREATE INDEX IF NOT EXISTS identity_trusted_device_pairing_sessions_device_status_idx
      ON identity_trusted_device_pairing_sessions(trusted_device_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS identity_trusted_device_pairing_sessions_status_expiry_idx
      ON identity_trusted_device_pairing_sessions(status, expired_at ASC);
    CREATE INDEX IF NOT EXISTS identity_trusted_device_pairing_sessions_user_workspace_idx
      ON identity_trusted_device_pairing_sessions(user_identity_id, workspace_id, initiated_at DESC);

    CREATE TABLE IF NOT EXISTS identity_trusted_device_pairing_tokens (
      pairing_token_id TEXT PRIMARY KEY,
      pairing_session_id TEXT NOT NULL UNIQUE,
      trusted_device_id TEXT NOT NULL,
      user_identity_id TEXT NOT NULL,
      workspace_id TEXT,
      artifact_type TEXT NOT NULL CHECK (artifact_type IN ('one-time-code', 'qr-payload')),
      token_hash TEXT NOT NULL UNIQUE,
      hash_algorithm TEXT NOT NULL CHECK (hash_algorithm IN ('sha256')),
      actor_scope TEXT NOT NULL CHECK (actor_scope IN ('same-user', 'workspace-admin', 'bootstrap-admin', 'session-bound')),
      actor_user_identity_id TEXT,
      actor_session_id TEXT,
      issuance_issued_by_user_identity_id TEXT,
      issuance_ip_address TEXT,
      issuance_user_agent TEXT,
      issuance_channel_hint TEXT,
      status TEXT NOT NULL CHECK (status IN ('issued', 'consumed', 'expired', 'invalidated')),
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      failed_validation_attempts INTEGER NOT NULL CHECK (failed_validation_attempts >= 0),
      max_validation_attempts INTEGER NOT NULL CHECK (max_validation_attempts >= 1),
      last_validation_attempt_at TEXT,
      consumed_at TEXT,
      consumed_by_user_identity_id TEXT,
      invalidation_reason TEXT CHECK (invalidation_reason IN ('manual-cancel', 'invalid-token-presented', 'token-reused', 'attempt-limit-reached', 'trusted-device-revoked')),
      invalidated_at TEXT,
      invalidated_by_user_identity_id TEXT,
      invalidation_note TEXT,
      updated_at TEXT NOT NULL,
      CHECK (failed_validation_attempts <= max_validation_attempts),
      FOREIGN KEY (pairing_session_id) REFERENCES identity_trusted_device_pairing_sessions(pairing_session_id) ON DELETE CASCADE,
      FOREIGN KEY (trusted_device_id) REFERENCES identity_trusted_devices(trusted_device_id) ON DELETE CASCADE,
      FOREIGN KEY (user_identity_id) REFERENCES identity_user_identities(user_identity_id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_identity_id) REFERENCES identity_user_identities(user_identity_id),
      FOREIGN KEY (issuance_issued_by_user_identity_id) REFERENCES identity_user_identities(user_identity_id),
      FOREIGN KEY (consumed_by_user_identity_id) REFERENCES identity_user_identities(user_identity_id),
      FOREIGN KEY (invalidated_by_user_identity_id) REFERENCES identity_user_identities(user_identity_id)
    );

    CREATE INDEX IF NOT EXISTS identity_trusted_device_pairing_tokens_status_expiry_idx
      ON identity_trusted_device_pairing_tokens(status, expires_at ASC);
    CREATE INDEX IF NOT EXISTS identity_trusted_device_pairing_tokens_device_status_idx
      ON identity_trusted_device_pairing_tokens(trusted_device_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS identity_trusted_device_pairing_tokens_user_workspace_idx
      ON identity_trusted_device_pairing_tokens(user_identity_id, workspace_id, issued_at DESC);
  `],
]);
