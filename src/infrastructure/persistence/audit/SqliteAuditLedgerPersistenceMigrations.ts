export const AUDIT_LEDGER_PERSISTENCE_SCHEMA_VERSION = 1;

export const AUDIT_LEDGER_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS audit_ledger_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authoritative_audit_ledger_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      category TEXT NOT NULL CHECK (
        category IN (
          'security-sensitive',
          'administrative',
          'sharing',
          'policy',
          'orchestration',
          'protected-data'
        )
      ),
      action TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed', 'rejected')),
      occurred_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user', 'service', 'system')),
      actor_user_identity_id TEXT,
      actor_service_id TEXT,
      actor_session_id TEXT,
      scope_kind TEXT NOT NULL CHECK (scope_kind IN ('global', 'workspace')),
      scope_workspace_id TEXT,
      resource_type TEXT,
      resource_id TEXT,
      resource_ref TEXT,
      resource_sensitivity_class TEXT CHECK (
        resource_sensitivity_class IS NULL OR resource_sensitivity_class IN ('standard', 'sensitive', 'protected')
      ),
      resource_workspace_id TEXT,
      payload_has_protected_data INTEGER NOT NULL CHECK (payload_has_protected_data IN (0, 1)),
      payload_redaction_reasons_json TEXT NOT NULL,
      payload_user_safe_json TEXT,
      payload_admin_only_json TEXT,
      integrity_schema_version TEXT NOT NULL,
      integrity_hash_algorithm TEXT NOT NULL,
      integrity_event_digest TEXT,
      integrity_previous_event_digest TEXT,
      retention TEXT NOT NULL CHECK (retention IN ('operational', 'governance', 'legal-hold')),
      immutability TEXT NOT NULL CHECK (immutability IN ('append-only', 'append-only-hash-chained')),
      correlation_id TEXT,
      request_id TEXT,
      event_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_occurred_idx
      ON authoritative_audit_ledger_events(occurred_at DESC, sequence DESC);
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_recorded_idx
      ON authoritative_audit_ledger_events(recorded_at DESC, sequence DESC);
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_category_idx
      ON authoritative_audit_ledger_events(category, occurred_at DESC, sequence DESC);
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_action_idx
      ON authoritative_audit_ledger_events(action, occurred_at DESC, sequence DESC);
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_type_idx
      ON authoritative_audit_ledger_events(event_type, occurred_at DESC, sequence DESC);
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_actor_idx
      ON authoritative_audit_ledger_events(actor_id, occurred_at DESC, sequence DESC);
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_workspace_idx
      ON authoritative_audit_ledger_events(scope_workspace_id, occurred_at DESC, sequence DESC)
      WHERE scope_workspace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_resource_idx
      ON authoritative_audit_ledger_events(resource_type, resource_id, occurred_at DESC, sequence DESC)
      WHERE resource_type IS NOT NULL AND resource_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_resource_ref_idx
      ON authoritative_audit_ledger_events(resource_ref, occurred_at DESC, sequence DESC)
      WHERE resource_ref IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_correlation_idx
      ON authoritative_audit_ledger_events(correlation_id, occurred_at DESC, sequence DESC)
      WHERE correlation_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_request_idx
      ON authoritative_audit_ledger_events(request_id, occurred_at DESC, sequence DESC)
      WHERE request_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_events_protected_idx
      ON authoritative_audit_ledger_events(payload_has_protected_data, occurred_at DESC, sequence DESC);

    CREATE TABLE IF NOT EXISTS authoritative_audit_ledger_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      actor_id TEXT NOT NULL,
      correlation_id TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES authoritative_audit_ledger_events(event_id)
    );

    CREATE INDEX IF NOT EXISTS authoritative_audit_ledger_mutation_replays_event_idx
      ON authoritative_audit_ledger_mutation_replays(event_id, created_at DESC);
  `],
]);
