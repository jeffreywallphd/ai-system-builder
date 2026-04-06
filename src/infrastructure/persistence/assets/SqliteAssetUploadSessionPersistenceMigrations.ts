export const ASSET_UPLOAD_SESSION_PERSISTENCE_SCHEMA_VERSION = 1;

export const ASSET_UPLOAD_SESSION_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS asset_upload_session_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_upload_sessions (
      upload_session_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      storage_instance_id TEXT NOT NULL,
      object_key TEXT NOT NULL,
      storage_area TEXT NOT NULL CHECK (storage_area IN ('input', 'output', 'preview', 'reference', 'temporary')),
      expected_file_name TEXT NOT NULL,
      expected_mime_type TEXT NOT NULL,
      expected_size_bytes INTEGER NOT NULL CHECK (expected_size_bytes >= 0),
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'incomplete')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finalized_version_id TEXT,
      finalized_mime_type TEXT,
      finalized_size_bytes INTEGER,
      finalized_checksum_algorithm TEXT,
      finalized_checksum_digest TEXT,
      finalized_original_file_name TEXT,
      incomplete_reason_code TEXT,
      incomplete_reason_message TEXT,
      CHECK (
        (status = 'pending' AND finalized_version_id IS NULL)
        OR status IN ('completed', 'incomplete')
      )
    );

    CREATE INDEX IF NOT EXISTS asset_upload_sessions_asset_status_idx
      ON asset_upload_sessions(asset_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS asset_upload_sessions_workspace_status_idx
      ON asset_upload_sessions(workspace_id, status, updated_at DESC);
  `],
]);
