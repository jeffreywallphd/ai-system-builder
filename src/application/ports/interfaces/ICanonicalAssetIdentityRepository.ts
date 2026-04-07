import type { CompositionTaxonomyDescriptor } from "@domain/taxonomy/CompositionTaxonomy";
export type CanonicalEntityType = "workflow-definition" | "installed-model" | "dataset-version" | "base-model" | "execution-artifact";

export interface CanonicalAssetIdentityRecord {
  readonly entityType: CanonicalEntityType;
  readonly entityId: string;
  readonly assetId: string;
  readonly latestVersionId?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly updatedAt: Date;
}

export interface ICanonicalAssetIdentityRepository {
  upsertIdentity(record: {
    readonly entityType: CanonicalEntityType;
    readonly entityId: string;
    readonly assetId: string;
    readonly latestVersionId?: string;
    readonly taxonomy?: CompositionTaxonomyDescriptor;
    readonly updatedAt?: Date;
  }): Promise<void>;
  getIdentity(entityType: CanonicalEntityType, entityId: string): Promise<CanonicalAssetIdentityRecord | undefined>;
}

