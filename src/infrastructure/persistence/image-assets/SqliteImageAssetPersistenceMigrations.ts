export const IMAGE_ASSET_PERSISTENCE_SCHEMA_VERSION = 1;

export const IMAGE_ASSET_PERSISTENCE_MIGRATIONS: ReadonlyArray<readonly [number, string]> = Object.freeze([
  [1, `
    CREATE TABLE IF NOT EXISTS image_asset_repository_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_asset_records (
      asset_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      owner_user_id TEXT,
      origin_kind TEXT NOT NULL CHECK (origin_kind IN ('uploaded-source', 'generated-result')),
      visibility TEXT NOT NULL CHECK (visibility IN ('private', 'workspace', 'shared', 'published')),
      sharing_policy_mode TEXT NOT NULL CHECK (sharing_policy_mode IN ('owner-only', 'workspace-members', 'explicit', 'published')),
      sharing_policy_id TEXT,
      sharing_policy_version TEXT,
      storage_instance_id TEXT NOT NULL,
      storage_binding_reference TEXT,
      media_type TEXT NOT NULL CHECK (media_type IN (
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/avif',
        'image/heic',
        'image/heif'
      )),
      original_filename TEXT NOT NULL,
      normalized_filename TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes >= 1),
      fingerprint_algorithm TEXT NOT NULL CHECK (fingerprint_algorithm IN ('sha256', 'sha512', 'blake3')),
      fingerprint_digest TEXT NOT NULL,
      lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('ingesting', 'available', 'failed', 'archived', 'deleted')),
      lifecycle_ingested_at TEXT,
      lifecycle_failed_at TEXT,
      lifecycle_failed_by TEXT,
      lifecycle_failure_reason TEXT,
      lifecycle_archived_at TEXT,
      lifecycle_archived_by TEXT,
      lifecycle_deleted_at TEXT,
      lifecycle_deleted_by TEXT,
      latest_object_key TEXT,
      latest_object_version_id TEXT,
      preview_asset_id TEXT,
      preview_media_type TEXT,
      source_run_id TEXT,
      generation_operation_id TEXT,
      created_by TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
      CHECK (
        (visibility = 'private' AND owner_user_id IS NOT NULL)
        OR visibility <> 'private'
      ),
      CHECK (
        (
          visibility IN ('private', 'workspace')
          AND sharing_policy_id IS NULL
          AND sharing_policy_version IS NULL
        )
        OR (
          visibility IN ('shared', 'published')
          AND sharing_policy_id IS NOT NULL
        )
      ),
      CHECK (
        (lifecycle_status = 'ingesting'
          AND lifecycle_failed_at IS NULL
          AND lifecycle_failed_by IS NULL
          AND lifecycle_failure_reason IS NULL
          AND lifecycle_archived_at IS NULL
          AND lifecycle_archived_by IS NULL
          AND lifecycle_deleted_at IS NULL
          AND lifecycle_deleted_by IS NULL)
        OR (lifecycle_status = 'available'
          AND lifecycle_ingested_at IS NOT NULL
          AND lifecycle_failed_at IS NULL
          AND lifecycle_failed_by IS NULL
          AND lifecycle_failure_reason IS NULL
          AND lifecycle_archived_at IS NULL
          AND lifecycle_archived_by IS NULL
          AND lifecycle_deleted_at IS NULL
          AND lifecycle_deleted_by IS NULL)
        OR (lifecycle_status = 'failed'
          AND lifecycle_failed_at IS NOT NULL
          AND lifecycle_failed_by IS NOT NULL
          AND lifecycle_failure_reason IS NOT NULL
          AND lifecycle_archived_at IS NULL
          AND lifecycle_archived_by IS NULL
          AND lifecycle_deleted_at IS NULL
          AND lifecycle_deleted_by IS NULL)
        OR (lifecycle_status = 'archived'
          AND lifecycle_ingested_at IS NOT NULL
          AND lifecycle_archived_at IS NOT NULL
          AND lifecycle_archived_by IS NOT NULL
          AND lifecycle_deleted_at IS NULL
          AND lifecycle_deleted_by IS NULL)
        OR (lifecycle_status = 'deleted'
          AND lifecycle_deleted_at IS NOT NULL
          AND lifecycle_deleted_by IS NOT NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS image_asset_records_workspace_created_idx
      ON image_asset_records(workspace_id, created_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS image_asset_records_workspace_owner_idx
      ON image_asset_records(workspace_id, owner_user_id, created_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS image_asset_records_workspace_status_idx
      ON image_asset_records(workspace_id, lifecycle_status, updated_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS image_asset_records_workspace_origin_idx
      ON image_asset_records(workspace_id, origin_kind, created_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS image_asset_records_workspace_visibility_idx
      ON image_asset_records(workspace_id, visibility, created_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS image_asset_records_workspace_media_idx
      ON image_asset_records(workspace_id, media_type, created_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS image_asset_records_storage_idx
      ON image_asset_records(storage_instance_id, created_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS image_asset_records_source_run_idx
      ON image_asset_records(source_run_id, created_at DESC, asset_id ASC)
      WHERE source_run_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS image_asset_records_generation_operation_idx
      ON image_asset_records(generation_operation_id, created_at DESC, asset_id ASC)
      WHERE generation_operation_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS image_asset_lineage_upstreams (
      asset_id TEXT NOT NULL,
      upstream_asset_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
      PRIMARY KEY (asset_id, upstream_asset_id),
      FOREIGN KEY (asset_id) REFERENCES image_asset_records(asset_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS image_asset_lineage_upstreams_asset_idx
      ON image_asset_lineage_upstreams(asset_id, ordinal ASC);
    CREATE INDEX IF NOT EXISTS image_asset_lineage_upstreams_upstream_idx
      ON image_asset_lineage_upstreams(upstream_asset_id, asset_id ASC);

    CREATE TABLE IF NOT EXISTS image_asset_mutation_replays (
      operation_key TEXT PRIMARY KEY,
      mutation_kind TEXT NOT NULL CHECK (mutation_kind IN (
        'create-image-asset',
        'save-image-asset',
        'archive-image-asset',
        'soft-delete-image-asset'
      )),
      asset_id TEXT NOT NULL,
      mutation_snapshot_json TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      correlation_id TEXT,
      reason TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS image_asset_mutation_replays_asset_idx
      ON image_asset_mutation_replays(asset_id, created_at DESC);
  `],
]);
