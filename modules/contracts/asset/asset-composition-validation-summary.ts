import type { AssetConfigurationMetadata } from "./asset-configuration-value";
import type { AssetReference } from "./asset-reference";

export const ASSET_COMPOSITION_VALIDATION_STATUSES = [
  "not-validated",
  "valid",
  "valid-with-warnings",
  "invalid",
] as const;

export type AssetCompositionValidationStatus =
  (typeof ASSET_COMPOSITION_VALIDATION_STATUSES)[number];

export interface AssetCompositionValidationSummary {
  readonly status: AssetCompositionValidationStatus;
  readonly issueRefs?: readonly AssetReference[];
  readonly issueCount?: number;
  readonly lastValidatedAt?: string;
  readonly metadata?: AssetConfigurationMetadata;
}

export function isAssetCompositionValidationStatus(
  value: string,
): value is AssetCompositionValidationStatus {
  return ASSET_COMPOSITION_VALIDATION_STATUSES.includes(
    value as AssetCompositionValidationStatus,
  );
}

export function normalizeAssetCompositionValidationStatus(
  value: string,
): AssetCompositionValidationStatus {
  const normalized = value.trim().toLowerCase();

  if (!isAssetCompositionValidationStatus(normalized)) {
    throw new Error(
      `Asset composition validation status must be one of ${ASSET_COMPOSITION_VALIDATION_STATUSES.join(", ")}. Received "${value}".`,
    );
  }

  return normalized;
}
