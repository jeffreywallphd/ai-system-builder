import type { AssetId } from "./asset-id";
import type { AssetLifecycleStatus } from "./asset-lifecycle-status";
import type { AssetProvenance } from "./asset-provenance";
import type { AssetReference } from "./asset-reference";
import type { AssetReviewStatus } from "./asset-review-status";
import type { AssetValidationSummary } from "./asset-validation-issue";
import type { AssetVersion } from "./asset-version";

export const ASSET_COMPOSITION_TYPES = [
  "feature",
  "workflow",
  "page",
  "subsystem",
  "system",
  "system-of-subsystems",
] as const;

export type AssetCompositionType = (typeof ASSET_COMPOSITION_TYPES)[number];

export interface AssetComposition {
  readonly compositionId: AssetId | string;
  readonly compositionType: AssetCompositionType;
  readonly displayName: string;
  readonly description?: string;
  readonly version: AssetVersion;
  readonly lifecycleStatus: AssetLifecycleStatus;
  readonly reviewStatus?: AssetReviewStatus;
  readonly rootInstanceRefs: readonly AssetReference[];
  readonly instanceRefs: readonly AssetReference[];
  readonly bindingRefs: readonly AssetReference[];
  readonly provenance: AssetProvenance;
  readonly validationSummary?: AssetValidationSummary;
  readonly metadata?: Record<string, unknown>;
}

export function isAssetCompositionType(value: string): value is AssetCompositionType {
  return ASSET_COMPOSITION_TYPES.includes(value as AssetCompositionType);
}

export function normalizeAssetCompositionType(value: string): AssetCompositionType {
  const normalized = value.trim().toLowerCase();

  if (!isAssetCompositionType(normalized)) {
    throw new Error(
      `Asset composition type must be one of ${ASSET_COMPOSITION_TYPES.join(", ")}. Received "${value}".`,
    );
  }

  return normalized;
}
