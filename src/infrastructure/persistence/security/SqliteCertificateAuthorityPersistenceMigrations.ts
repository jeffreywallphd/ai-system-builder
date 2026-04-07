export const CERTIFICATE_AUTHORITY_PERSISTENCE_SCHEMA_VERSION = 1;

export const CERTIFICATE_AUTHORITY_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS certificate_authority_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    -- Stores CA metadata only. Certificate/key materials are referenced by protected locator ids.
    CREATE TABLE IF NOT EXISTS certificate_authorities (
      certificate_authority_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'retired', 'compromised')),
      subject_json TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      validity_not_before TEXT NOT NULL,
      validity_not_after TEXT NOT NULL,
      signature_algorithm TEXT NOT NULL,
      root_certificate_material_ref TEXT NOT NULL,
      root_private_key_material_ref TEXT NOT NULL,
      rotation_policy_json TEXT NOT NULL,
      rotated_from_certificate_authority_id TEXT,
      retired_at TEXT,
      compromised_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      CHECK (
        (status = 'retired' AND retired_at IS NOT NULL)
        OR (status != 'retired')
      ),
      CHECK (
        (status = 'compromised' AND compromised_at IS NOT NULL)
        OR (status != 'compromised')
      )
    );

    CREATE INDEX IF NOT EXISTS certificate_authorities_status_validity_idx
      ON certificate_authorities(status, validity_not_before, validity_not_after);

    -- Stores issuance metadata only. PEM/key plaintext is never persisted in this table.
    CREATE TABLE IF NOT EXISTS issued_certificates (
      serial_number TEXT PRIMARY KEY,
      certificate_authority_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('issued', 'revoked', 'expired', 'superseded')),
      subject_json TEXT NOT NULL,
      subject_reference_kind TEXT NOT NULL CHECK (subject_reference_kind IN ('node', 'device', 'service')),
      subject_reference_id TEXT NOT NULL,
      subject_reference_workspace_id TEXT,
      usages_json TEXT NOT NULL,
      validity_not_before TEXT NOT NULL,
      validity_not_after TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      certificate_material_ref TEXT NOT NULL,
      certificate_chain_material_ref TEXT,
      trust_material_ref TEXT,
      public_key_algorithm TEXT NOT NULL,
      public_key_fingerprint_sha256 TEXT,
      revocation_json TEXT,
      superseded_by_serial_number TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      FOREIGN KEY (certificate_authority_id)
        REFERENCES certificate_authorities(certificate_authority_id)
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS issued_certificates_ca_status_issued_idx
      ON issued_certificates(certificate_authority_id, status, issued_at DESC);
    CREATE INDEX IF NOT EXISTS issued_certificates_subject_idx
      ON issued_certificates(subject_reference_kind, subject_reference_id, subject_reference_workspace_id, issued_at DESC);

    -- Append-only status transitions for auditability and lifecycle reconstruction.
    CREATE TABLE IF NOT EXISTS certificate_status_history (
      status_event_id TEXT PRIMARY KEY,
      certificate_authority_id TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      previous_status TEXT CHECK (previous_status IN ('issued', 'revoked', 'expired', 'superseded')),
      current_status TEXT NOT NULL CHECK (current_status IN ('issued', 'revoked', 'expired', 'superseded')),
      occurred_at TEXT NOT NULL,
      occurred_by TEXT NOT NULL,
      reason TEXT,
      note TEXT,
      FOREIGN KEY (serial_number) REFERENCES issued_certificates(serial_number) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS certificate_status_history_serial_occurred_idx
      ON certificate_status_history(serial_number, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS certificate_status_history_status_occurred_idx
      ON certificate_status_history(current_status, occurred_at DESC);

    -- Revocation history records are explicit to support revocation audits and CRL generation workflows.
    CREATE TABLE IF NOT EXISTS certificate_revocations (
      revocation_id TEXT PRIMARY KEY,
      certificate_authority_id TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      reason TEXT NOT NULL CHECK (
        reason IN (
          'unspecified',
          'key-compromise',
          'ca-compromise',
          'affiliation-changed',
          'superseded',
          'cessation-of-operation',
          'privilege-withdrawn',
          'policy-violation'
        )
      ),
      revoked_at TEXT NOT NULL,
      revoked_by_actor_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      FOREIGN KEY (serial_number) REFERENCES issued_certificates(serial_number) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS certificate_revocations_serial_revoked_idx
      ON certificate_revocations(serial_number, revoked_at DESC);
    CREATE INDEX IF NOT EXISTS certificate_revocations_reason_revoked_idx
      ON certificate_revocations(reason, revoked_at DESC);

    -- Trust-material references point to protected stores (vault/object store), not plaintext secrets.
    CREATE TABLE IF NOT EXISTS trust_material_references (
      material_ref TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('certificate-pem', 'certificate-chain-pem', 'private-key-encrypted-pem', 'crl-pem')),
      storage_locator TEXT NOT NULL,
      fingerprint_sha256 TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1)
    );

    CREATE INDEX IF NOT EXISTS trust_material_references_kind_material_idx
      ON trust_material_references(kind, material_ref);

    CREATE TABLE IF NOT EXISTS certificate_distribution_events (
      distribution_event_id TEXT PRIMARY KEY,
      material_ref TEXT NOT NULL,
      certificate_authority_id TEXT,
      serial_number TEXT,
      target_kind TEXT NOT NULL CHECK (target_kind IN ('node', 'server', 'device', 'service')),
      target_reference_id TEXT NOT NULL,
      workspace_id TEXT,
      transport TEXT NOT NULL,
      delivery_locator_ref TEXT,
      status TEXT NOT NULL CHECK (status IN ('queued', 'published', 'failed', 'acknowledged')),
      occurred_at TEXT NOT NULL,
      occurred_by TEXT NOT NULL,
      failure_reason TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      FOREIGN KEY (material_ref) REFERENCES trust_material_references(material_ref) ON DELETE RESTRICT,
      FOREIGN KEY (serial_number) REFERENCES issued_certificates(serial_number) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS certificate_distribution_events_target_idx
      ON certificate_distribution_events(target_kind, target_reference_id, workspace_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS certificate_distribution_events_status_idx
      ON certificate_distribution_events(status, occurred_at DESC);

    CREATE TABLE IF NOT EXISTS certificate_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (
        mutation_kind IN (
          'certificate-authority',
          'issued-certificate',
          'trust-material',
          'status-history',
          'certificate-revocation',
          'distribution-event'
        )
      ),
      record_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `],
]);
