import type { AssetLineageRelationshipType } from "@domain/assets/AssetLineageEdge";
import type { RegistryDependencyReference } from "@domain/asset-registry/RegistryAsset";
import type { CompositionTaxonomyDescriptor } from "@domain/taxonomy/CompositionTaxonomy";

export interface RegistryGraphProjectionNodeRecord {
  readonly assetId: string;
  readonly versionId: string;
  readonly name?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly taxonomy?: CompositionTaxonomyDescriptor;
  readonly isRegistryProjected: boolean;
}

export interface RegistryGraphProjectionEdgeRecord {
  readonly fromAssetId: string;
  readonly fromVersionId: string;
  readonly toAssetId: string;
  readonly toVersionId: string;
  readonly relationshipType?: AssetLineageRelationshipType;
  readonly source: RegistryDependencyReference["source"];
}

export interface RegistryGraphProjectionSourceSignature {
  readonly versionCount: number;
  readonly lineageEdgeCount: number;
}

export interface RegistryGraphProjectionSnapshot {
  readonly nodes: ReadonlyArray<RegistryGraphProjectionNodeRecord>;
  readonly edges: ReadonlyArray<RegistryGraphProjectionEdgeRecord>;
  readonly computedAt: Date;
  readonly sourceSignature?: RegistryGraphProjectionSourceSignature;
}

export interface RegistryGraphProjectionState {
  readonly dirty: boolean;
  readonly computedAt?: Date;
  readonly sourceSignature?: RegistryGraphProjectionSourceSignature;
}

export interface IRegistryGraphProjectionRepository {
  loadProjection(): Promise<RegistryGraphProjectionSnapshot | undefined>;
  saveProjection(snapshot: RegistryGraphProjectionSnapshot): Promise<void>;
  markProjectionDirty(reason?: string): Promise<void>;
  getProjectionState(): Promise<RegistryGraphProjectionState | undefined>;
  getCurrentSourceSignature?(): Promise<RegistryGraphProjectionSourceSignature>;
}

