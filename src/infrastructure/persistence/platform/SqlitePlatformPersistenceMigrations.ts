export const PLATFORM_PERSISTENCE_SCHEMA_VERSION = 3;

export const PLATFORM_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS platform_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_run_records (
      run_id TEXT PRIMARY KEY,
      run_kind TEXT NOT NULL CHECK (run_kind IN ('workflow', 'agent', 'system')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'blocked')),
      workspace_id TEXT,
      user_identity_id TEXT,
      source_aggregate_ref TEXT NOT NULL,
      initiated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      terminal_reason TEXT,
      metadata_json TEXT,
      actor_id TEXT NOT NULL,
      correlation_id TEXT,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
      created_at TEXT NOT NULL,
      last_modified_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS platform_run_records_lookup_idx
      ON platform_run_records(run_kind, status, initiated_at DESC, run_id ASC);
    CREATE INDEX IF NOT EXISTS platform_run_records_workspace_idx
      ON platform_run_records(workspace_id, initiated_at DESC, run_id ASC)
      WHERE workspace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS platform_run_records_user_idx
      ON platform_run_records(user_identity_id, initiated_at DESC, run_id ASC)
      WHERE user_identity_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS platform_run_records_source_idx
      ON platform_run_records(source_aggregate_ref, initiated_at DESC, run_id ASC);

    CREATE TABLE IF NOT EXISTS platform_audit_events (
      event_id TEXT PRIMARY KEY,
      event_kind TEXT NOT NULL CHECK (
        event_kind IN (
          'identity',
          'workspace',
          'authorization',
          'nodes',
          'storage',
          'assets',
          'runs',
          'security',
          'secrets',
          'sessions',
          'system'
        )
      ),
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      workspace_id TEXT,
      user_identity_id TEXT,
      target_ref TEXT,
      outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed', 'rejected')),
      occurred_at TEXT NOT NULL,
      correlation_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS platform_audit_events_recent_idx
      ON platform_audit_events(occurred_at DESC, event_id ASC);
    CREATE INDEX IF NOT EXISTS platform_audit_events_kind_idx
      ON platform_audit_events(event_kind, occurred_at DESC, event_id ASC);
    CREATE INDEX IF NOT EXISTS platform_audit_events_workspace_idx
      ON platform_audit_events(workspace_id, occurred_at DESC, event_id ASC)
      WHERE workspace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS platform_audit_events_user_idx
      ON platform_audit_events(user_identity_id, occurred_at DESC, event_id ASC)
      WHERE user_identity_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS platform_audit_events_actor_idx
      ON platform_audit_events(actor_id, occurred_at DESC, event_id ASC);
    CREATE INDEX IF NOT EXISTS platform_audit_events_target_idx
      ON platform_audit_events(target_ref, occurred_at DESC, event_id ASC)
      WHERE target_ref IS NOT NULL;

    CREATE TABLE IF NOT EXISTS platform_persistence_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN ('create-run', 'save-run', 'append-audit-event')),
      record_scope TEXT NOT NULL CHECK (record_scope IN ('run', 'audit')),
      record_id TEXT NOT NULL,
      record_snapshot_json TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      correlation_id TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS platform_persistence_mutation_replays_record_idx
      ON platform_persistence_mutation_replays(record_scope, record_id, created_at DESC);
  `],
  [2, `
    CREATE TABLE IF NOT EXISTS platform_run_orchestration_queue (
      run_id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL,
      workspace_id TEXT,
      lifecycle_state TEXT NOT NULL,
      entered_at TEXT NOT NULL,
      order_key TEXT NOT NULL,
      eligibility_marker TEXT NOT NULL CHECK (eligibility_marker IN ('ready', 'deferred', 'blocked')),
      eligible_at TEXT NOT NULL,
      claim_token TEXT,
      claimed_by TEXT,
      claimed_at TEXT,
      claim_expires_at TEXT,
      dequeued_at TEXT,
      updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      FOREIGN KEY (run_id) REFERENCES platform_run_records(run_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS platform_run_orchestration_queue_ready_idx
      ON platform_run_orchestration_queue(
        queue_id,
        eligibility_marker,
        eligible_at ASC,
        order_key ASC,
        entered_at ASC,
        run_id ASC
      );
    CREATE INDEX IF NOT EXISTS platform_run_orchestration_queue_workspace_ready_idx
      ON platform_run_orchestration_queue(
        workspace_id,
        queue_id,
        eligibility_marker,
        eligible_at ASC,
        order_key ASC,
        entered_at ASC,
        run_id ASC
      )
      WHERE workspace_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS platform_run_orchestration_queue_claim_token_uidx
      ON platform_run_orchestration_queue(claim_token)
      WHERE claim_token IS NOT NULL;
  `],
  [3, `
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN assignment_node_id TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN assignment_claimed_at TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN dispatch_prepared_at TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN last_dispatch_attempt_id TEXT;

    CREATE TABLE IF NOT EXISTS platform_run_dispatch_attempts (
      attempt_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      queue_id TEXT NOT NULL,
      workspace_id TEXT,
      node_id TEXT NOT NULL,
      reservation_owner TEXT NOT NULL,
      claim_token TEXT NOT NULL,
      prepared_at TEXT NOT NULL,
      dispatch_metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES platform_run_records(run_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS platform_run_dispatch_attempts_run_idx
      ON platform_run_dispatch_attempts(run_id, prepared_at DESC, attempt_id ASC);
    CREATE UNIQUE INDEX IF NOT EXISTS platform_run_dispatch_attempts_claim_uidx
      ON platform_run_dispatch_attempts(run_id, claim_token);
  `],
]);
