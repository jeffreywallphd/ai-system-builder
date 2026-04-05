export const NODE_TRUST_PERSISTENCE_SCHEMA_VERSION = 1;

export const NODE_TRUST_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS node_trust_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_trust_identities (
      node_id TEXT PRIMARY KEY,
      node_type TEXT NOT NULL CHECK (node_type IN ('compute', 'hybrid', 'edge')),
      display_name TEXT NOT NULL,
      capability_enabled_json TEXT NOT NULL,
      capability_profile_version TEXT,
      supports_remote_scheduling INTEGER NOT NULL CHECK (supports_remote_scheduling IN (0, 1)),
      max_concurrent_workloads INTEGER,
      approval_status TEXT NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
      trust_state TEXT NOT NULL CHECK (
        trust_state IN ('pending-enrollment', 'pending-approval', 'trusted', 'quarantined', 'revoked')
      ),
      certificate_ref TEXT,
      certificate_assigned_at TEXT,
      certificate_expires_at TEXT,
      certificate_authority_ref TEXT,
      certificate_thumbprint TEXT,
      deployment_tags_json TEXT NOT NULL,
      last_seen_at TEXT,
      heartbeat_status TEXT CHECK (heartbeat_status IN ('online', 'degraded', 'offline')),
      last_seen_observed_by TEXT,
      revocation_state TEXT NOT NULL CHECK (revocation_state IN ('active', 'pending-revocation', 'revoked')),
      revocation_reason TEXT CHECK (
        revocation_reason IN (
          'owner-request',
          'operator-action',
          'certificate-compromise',
          'policy-violation',
          'decommissioned'
        )
      ),
      revocation_revoked_at TEXT,
      revocation_revoked_by_user_identity_id TEXT,
      revocation_note TEXT,
      enrolled_at TEXT NOT NULL,
      approved_at TEXT,
      revoked_at TEXT,
      enrollment_request_id TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      CHECK (
        (last_seen_at IS NULL AND heartbeat_status IS NULL AND last_seen_observed_by IS NULL)
        OR (last_seen_at IS NOT NULL AND heartbeat_status IS NOT NULL)
      ),
      CHECK (
        (max_concurrent_workloads IS NULL)
        OR (max_concurrent_workloads >= 1)
      ),
      CHECK (
        (trust_state != 'revoked')
        OR (revocation_state = 'revoked' AND revoked_at IS NOT NULL)
      ),
      CHECK (
        (revocation_state != 'revoked')
        OR (
          trust_state = 'revoked'
          AND revocation_reason IS NOT NULL
          AND revocation_revoked_at IS NOT NULL
        )
      )
    );

    CREATE INDEX IF NOT EXISTS node_trust_identities_trust_idx
      ON node_trust_identities(trust_state, approval_status, revocation_state, enrolled_at DESC);
    CREATE INDEX IF NOT EXISTS node_trust_identities_type_idx
      ON node_trust_identities(node_type, trust_state, enrolled_at DESC);
    CREATE INDEX IF NOT EXISTS node_trust_identities_last_seen_idx
      ON node_trust_identities(last_seen_at DESC)
      WHERE last_seen_at IS NOT NULL;

    CREATE TABLE IF NOT EXISTS node_trust_identity_capabilities (
      node_id TEXT NOT NULL,
      capability TEXT NOT NULL CHECK (
        capability IN (
          'ui',
          'api',
          'scheduler',
          'executor',
          'storage-access',
          'preview-worker'
        )
      ),
      PRIMARY KEY (node_id, capability),
      FOREIGN KEY (node_id) REFERENCES node_trust_identities(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS node_trust_identity_capabilities_lookup_idx
      ON node_trust_identity_capabilities(capability, node_id);

    CREATE TABLE IF NOT EXISTS node_trust_identity_deployment_tags (
      node_id TEXT NOT NULL,
      deployment_tag TEXT NOT NULL,
      PRIMARY KEY (node_id, deployment_tag),
      FOREIGN KEY (node_id) REFERENCES node_trust_identities(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS node_trust_identity_deployment_tags_lookup_idx
      ON node_trust_identity_deployment_tags(deployment_tag, node_id);

    CREATE TABLE IF NOT EXISTS node_enrollment_requests (
      request_id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      node_type TEXT NOT NULL CHECK (node_type IN ('compute', 'hybrid', 'edge')),
      display_name TEXT NOT NULL,
      capability_enabled_json TEXT NOT NULL,
      capability_profile_version TEXT,
      supports_remote_scheduling INTEGER NOT NULL CHECK (supports_remote_scheduling IN (0, 1)),
      max_concurrent_workloads INTEGER,
      deployment_tags_json TEXT NOT NULL,
      certificate_ref TEXT,
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('submitted', 'under-review', 'approved', 'rejected', 'withdrawn', 'expired')
      ),
      reviewed_at TEXT,
      reviewed_by_user_identity_id TEXT,
      decision_note TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      CHECK (
        (max_concurrent_workloads IS NULL)
        OR (max_concurrent_workloads >= 1)
      ),
      CHECK (
        (status NOT IN ('approved', 'rejected'))
        OR reviewed_at IS NOT NULL
      )
    );

    CREATE INDEX IF NOT EXISTS node_enrollment_requests_status_requested_idx
      ON node_enrollment_requests(status, requested_at DESC, request_id ASC);
    CREATE INDEX IF NOT EXISTS node_enrollment_requests_node_status_idx
      ON node_enrollment_requests(node_id, status, requested_at DESC, request_id ASC);
    CREATE INDEX IF NOT EXISTS node_enrollment_requests_type_status_idx
      ON node_enrollment_requests(node_type, status, requested_at DESC, request_id ASC);

    CREATE TABLE IF NOT EXISTS node_trust_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('node-identity', 'enrollment-request')),
      record_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `],
]);
