export const PLATFORM_PERSISTENCE_SCHEMA_VERSION = 7;

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
  [4, `
    ALTER TABLE platform_run_dispatch_attempts ADD COLUMN dispatch_result_json TEXT;
  `],
  [5, `
    CREATE TABLE IF NOT EXISTS platform_run_node_placement_holds (
      node_id TEXT PRIMARY KEY,
      hold_token TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL,
      queue_id TEXT NOT NULL,
      reservation_owner TEXT NOT NULL,
      claim_token TEXT NOT NULL,
      decision_id TEXT,
      held_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES platform_run_records(run_id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS platform_run_node_placement_holds_token_uidx
      ON platform_run_node_placement_holds(hold_token);
    CREATE INDEX IF NOT EXISTS platform_run_node_placement_holds_expiry_idx
      ON platform_run_node_placement_holds(expires_at ASC, node_id ASC);
    CREATE INDEX IF NOT EXISTS platform_run_node_placement_holds_owner_idx
      ON platform_run_node_placement_holds(reservation_owner, expires_at ASC, node_id ASC);
  `],
  [6, `
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN defer_count INTEGER NOT NULL DEFAULT 0 CHECK (defer_count >= 0);
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN last_no_placement_category TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN last_no_placement_reason_codes_json TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN last_no_placement_reason_message TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN last_no_placement_decision_id TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN last_no_placement_recorded_at TEXT;
    ALTER TABLE platform_run_orchestration_queue ADD COLUMN last_no_placement_admin_attention INTEGER NOT NULL DEFAULT 0 CHECK (last_no_placement_admin_attention IN (0, 1));
  `],
  [7, `
    CREATE TABLE IF NOT EXISTS platform_run_status_history (
      history_entry_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      workspace_id TEXT,
      lifecycle_state TEXT NOT NULL,
      platform_status TEXT NOT NULL CHECK (platform_status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'blocked')),
      run_revision INTEGER NOT NULL CHECK (run_revision >= 1),
      changed_at TEXT NOT NULL,
      changed_by_actor_id TEXT NOT NULL,
      reason TEXT,
      dispatch_attempt_id TEXT,
      dispatch_id TEXT,
      backend_kind TEXT,
      backend_run_id TEXT,
      safe_failure_code TEXT,
      safe_failure_message TEXT,
      snapshot_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES platform_run_records(run_id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS platform_run_status_history_run_revision_uidx
      ON platform_run_status_history(run_id, run_revision);
    CREATE INDEX IF NOT EXISTS platform_run_status_history_run_changed_idx
      ON platform_run_status_history(run_id, changed_at DESC, history_entry_id DESC);
    CREATE INDEX IF NOT EXISTS platform_run_status_history_workspace_changed_idx
      ON platform_run_status_history(workspace_id, changed_at DESC, history_entry_id DESC)
      WHERE workspace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS platform_run_status_history_lifecycle_changed_idx
      ON platform_run_status_history(lifecycle_state, changed_at DESC, history_entry_id DESC);
  `],
]);
