import type { RuntimeEngine } from "../../models/interfaces/IModelCompatibility";

/**
 * IAsset represents a persisted or generated artifact owned by the domain.
 *
 * It is intentionally broader than "image output" so it can support:
 * - generated images
 * - generated audio/video
 * - text responses and transcripts
 * - embeddings and structured outputs
 * - workflow export/import files
 * - intermediate execution artifacts
 * - logs, prompts, metadata sidecars
 * - user-uploaded source assets
 *
 * The interface stays domain-level:
 * - no filesystem APIs
 * - no database concerns
 * - no transport/protocol concerns
 */

export type AssetKind =
  | "image"
  | "audio"
  | "video"
  | "text"
  | "document"
  | "dataset"
  | "json"
  | "binary"
  | "embedding"
  | "model-output"
  | "workflow-definition"
  | "workflow-export"
  | "prompt"
  | "transcript"
  | "log"
  | "intermediate"
  | "thumbnail"
  | "archive"
  | "generic";

export type AssetLifecycleStatus =
  | "draft"
  | "pending"
  | "available"
  | "missing"
  | "failed"
  | "archived"
  | "deleted";

export type AssetSourceType =
  | "generated"
  | "uploaded"
  | "imported"
  | "derived"
  | "system"
  | "external"
  | "unknown";

export type AssetAccessMethod =
  | "local-file"
  | "local-directory"
  | "remote-url"
  | "memory"
  | "virtual"
  | "unknown";

export interface IAssetIdentity {
  /**
   * Stable internal identifier.
   */
  readonly id: string;

  /**
   * Human-facing name or title.
   */
  readonly name: string;

  /**
   * Optional version or revision label.
   */
  readonly version?: string;
}

export interface IAssetLocation {
  /**
   * How the asset is accessed.
   */
  readonly accessMethod: AssetAccessMethod;

  /**
   * Domain-safe location reference.
   * This may be a path-like string, URL-like string, or opaque identifier,
   * but the domain does not interpret it beyond presence/absence.
   */
  readonly location?: string;

  /**
   * Optional content format/extension.
   * Examples:
   * - png
   * - wav
   * - mp4
   * - txt
   * - json
   */
  readonly format?: string;

  /**
   * Optional MIME/content type.
   */
  readonly contentType?: string;
}

export interface IAssetSourceInfo {
  /**
   * High-level source category.
   */
  readonly type: AssetSourceType;

  /**
   * Optional workflow that produced or owns the asset.
   */
  readonly workflowId?: string;

  /**
   * Optional node that produced or owns the asset.
   */
  readonly nodeId?: string;

  /**
   * Optional execution/run identifier.
   */
  readonly executionId?: string;

  /**
   * Optional upstream asset identifier when this asset is derived from another.
   */
  readonly parentAssetId?: string;

  /**
   * Optional runtime/engine associated with generation.
   */
  readonly runtime?: RuntimeEngine;

  /**
   * Optional freeform provider/source label.
   * Examples:
   * - comfyui
   * - upload
   * - openai-compatible
   */
  readonly provider?: string;
}

export interface IAssetTechnicalMetadata {
  /**
   * Optional size in bytes.
   */
  readonly sizeBytes?: number;

  /**
   * Optional checksum for identity/integrity.
   */
  readonly sha256?: string;

  /**
   * Optional width/height for visual assets.
   */
  readonly width?: number;
  readonly height?: number;

  /**
   * Optional duration in milliseconds for time-based assets.
   */
  readonly durationMs?: number;

  /**
   * Optional sample rate for audio assets.
   */
  readonly sampleRateHz?: number;

  /**
   * Optional channel count for audio assets.
   */
  readonly channels?: number;

  /**
   * Optional frame rate for video assets.
   */
  readonly frameRate?: number;

  /**
   * Optional token count for text-like assets.
   */
  readonly tokenCount?: number;

  /**
   * Optional item count for embeddings/datasets/batches.
   */
  readonly itemCount?: number;
}

export interface IAssetSemanticMetadata {
  /**
   * Optional user-facing summary/description.
   */
  readonly description?: string;

  /**
   * Optional tags for filtering/grouping.
   */
  readonly tags?: ReadonlyArray<string>;

  /**
   * Optional language codes relevant to the asset.
   */
  readonly languageCodes?: ReadonlyArray<string>;

  /**
   * Optional custom key-value metadata.
   * Stays domain-safe and serializable.
   */
  readonly attributes?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface IAssetAuditInfo {
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface IAssetRelationship {
  /**
   * The related asset ID.
   */
  readonly assetId: string;

  /**
   * Relationship type.
   * Examples:
   * - parent
   * - child
   * - source
   * - derivative
   * - thumbnail
   * - sidecar
   * - preview
   */
  readonly kind: string;
}

export interface IAsset extends IAssetIdentity {
  /**
   * High-level asset kind.
   */
  readonly kind: AssetKind;

  /**
   * Lifecycle state.
   */
  readonly status: AssetLifecycleStatus;

  /**
   * Where the asset comes from.
   */
  readonly source: IAssetSourceInfo;

  /**
   * How the asset is accessed and what its primary format is.
   */
  readonly location: IAssetLocation;

  /**
   * Technical characteristics.
   */
  readonly technicalMetadata?: IAssetTechnicalMetadata;

  /**
   * Semantic/user-facing metadata.
   */
  readonly semanticMetadata?: IAssetSemanticMetadata;

  /**
   * Optional relationships to other assets.
   */
  readonly relationships: ReadonlyArray<IAssetRelationship>;

  /**
   * Optional audit timestamps.
   */
  readonly audit?: IAssetAuditInfo;

  /**
   * Indicates whether the asset is currently usable.
   */
  isAvailable(): boolean;

  /**
   * Indicates whether the asset is generated rather than uploaded/imported.
   */
  isGenerated(): boolean;

  /**
   * Indicates whether the asset is derived from another asset.
   */
  isDerived(): boolean;

  /**
   * Indicates whether the asset belongs to a specific workflow.
   */
  belongsToWorkflow(workflowId: string): boolean;

  /**
   * Indicates whether the asset was produced by a specific node.
   */
  belongsToNode(nodeId: string): boolean;

  /**
   * Indicates whether this asset is related to another asset by ID.
   */
  isRelatedTo(assetId: string): boolean;

  /**
   * Returns true when the asset matches the given kind.
   */
  isKind(kind: AssetKind): boolean;

  /**
   * Returns a concise display/reference string.
   */
  toReferenceString(): string;
}
