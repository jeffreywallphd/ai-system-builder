import { describe, expect, it } from "../../../testing/node-test";

import * as assetContracts from "..";

describe("asset family invariants", () => {
  it("exports the core Asset Kernel contract vocabulary through the family barrel", () => {
    expect(Object.keys(assetContracts).sort()).toEqual([
      "ASSET_BINDING_KINDS",
      "ASSET_COMPOSITION_TYPES",
      "ASSET_FAMILIES",
      "ASSET_ID_FORMAT_DESCRIPTION",
      "ASSET_LIFECYCLE_STATUSES",
      "ASSET_PROVENANCE_SOURCE_KINDS",
      "ASSET_REFERENCE_KINDS",
      "ASSET_REVIEW_STATUSES",
      "ASSET_TYPES",
      "ASSET_VALIDATION_ISSUE_CATEGORIES",
      "ASSET_VALIDATION_ISSUE_SEVERITIES",
      "isAssetBindingKind",
      "isAssetCompositionType",
      "isAssetFamily",
      "isAssetId",
      "isAssetLifecycleStatus",
      "isAssetProvenanceSourceKind",
      "isAssetReferenceKind",
      "isAssetReviewStatus",
      "isAssetType",
      "isAssetValidationIssueCategory",
      "isAssetValidationIssueSeverity",
      "isAssetVersion",
      "normalizeAssetBindingKind",
      "normalizeAssetCompositionType",
      "normalizeAssetFamily",
      "normalizeAssetId",
      "normalizeAssetLifecycleStatus",
      "normalizeAssetProvenanceSourceKind",
      "normalizeAssetReferenceKind",
      "normalizeAssetReviewStatus",
      "normalizeAssetType",
      "normalizeAssetValidationIssueCategory",
      "normalizeAssetValidationIssueSeverity",
      "normalizeAssetVersion",
    ]);
  });
});
